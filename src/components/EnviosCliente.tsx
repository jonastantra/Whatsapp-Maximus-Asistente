"use client";

import { useCallback, useEffect, useState } from "react";
import type { DireccionEnvio, GuiaCliente, CasoPago } from "@/lib/envios-cliente";

type Datos={addresses:DireccionEnvio[];shipments:GuiaCliente[];payment:CasoPago|null};
const vacio:Datos={addresses:[],shipments:[],payment:null};

export function EnviosCliente({conversationId}:{conversationId:number}) {
 const [data,setData]=useState<Datos>(vacio);
 const [address,setAddress]=useState("");
 const [editing,setEditing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  const r=await fetch(`/api/conversations/${conversationId}/envios`,{cache:"no-store"});
  if(!r.ok) throw new Error("No se pudieron cargar los envíos.");
  return await r.json() as Datos;
 },[conversationId]);
 useEffect(()=>{
  let alive=true;
  setData(vacio);setAddress("");setEditing(false);setError("");setNotice("");
  void load().then(d=>{if(alive)setData(d)}).catch(()=>{if(alive)setError("No se pudieron cargar los envíos.")});
  const timer=window.setInterval(()=>{void load().then(d=>{if(alive)setData(d)}).catch(()=>{})},10000);
  return ()=>{alive=false;window.clearInterval(timer)};
 },[load]);
 async function act(body:object){
  setBusy(true);setError("");setNotice("");
  try {
   const r=await fetch(`/api/conversations/${conversationId}/envios`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const json=await r.json();if(!r.ok)throw new Error(json.error||"No se pudo guardar.");
   setData(json as Datos);setEditing(false);setNotice("Guardado.");
  } catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.")} finally {setBusy(false)}
 }
 const current=data.addresses.find(a=>a.status==="confirmada");
 const candidates=data.addresses.filter(a=>a.status==="detectada");
 const map=(value:string)=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
 return <aside aria-label="Envíos del cliente" className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-stone-200 bg-white p-4 md:w-80 md:border-l md:border-t-0 lg:w-96">
  <div><h2 className="text-base font-semibold text-stone-900">Envíos del cliente</h2><p className="mt-1 text-sm text-stone-600">Direcciones y guías de esta conversación.</p></div>
  <section className="mt-5 border-t border-stone-200 pt-4">
   <h3 className="text-sm font-semibold text-stone-900">Pago de este pedido</h3>
   {data.payment ? <p className="mt-2 text-sm font-medium text-emerald-700">Pago confirmado · pendiente de guía</p> : <><p className="mt-2 text-sm text-stone-600">Sin pago confirmado para un pedido nuevo.</p><button type="button" disabled={busy} onClick={()=>{if(window.confirm("¿Ya verificaste que el depósito llegó?")) void act({action:"confirmar_pago"})}} className="mt-3 rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50">Confirmar pago recibido</button></>}
  </section>
  <section className="mt-5 border-t border-stone-200 pt-4">
   <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-stone-900">Dirección de envío</h3>{data.payment&&!editing?<button type="button" onClick={()=>{setAddress(current?.address||candidates[0]?.address||"");setEditing(true)}} className="text-sm font-semibold text-stone-700 underline underline-offset-4">{current?"Editar":"Guardar"}</button>:null}</div>
   {editing ? <div className="mt-3"><label htmlFor="shipping-address" className="text-sm text-stone-700">Dirección completa</label><textarea id="shipping-address" rows={4} value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 w-full rounded-md border border-stone-300 p-2 text-sm text-stone-900 focus:outline-2 focus:outline-stone-700"/><div className="mt-2 flex gap-2"><button type="button" disabled={busy||address.trim().length<10} onClick={()=>void act({address})} className="rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar dirección</button><button type="button" onClick={()=>setEditing(false)} className="rounded-md border border-stone-300 px-3 py-2 text-sm">Cancelar</button></div></div> : current ? <div className="mt-2"><p className="whitespace-pre-wrap break-words text-sm text-stone-800">{current.address}</p><a href={map(current.address)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-stone-700 underline underline-offset-4">Ver ubicación en mapa</a></div> : <p className="mt-2 text-sm text-stone-600">{data.payment?"Guarda la dirección del cliente para esta compra.":"Se guardará después de confirmar el pago."}</p>}
   {data.payment && candidates.length>0 ? <div className="mt-4"><h4 className="text-sm font-semibold text-stone-800">Mensaje con posible dirección</h4><p className="mt-1 text-xs text-stone-600">Revísala antes de usarla; no se verifica automáticamente.</p>{candidates.slice(0,3).map(item=><div key={item.id} className="mt-3 border-t border-stone-100 pt-3"><p className="whitespace-pre-wrap break-words text-sm text-stone-700">{item.address}</p><button type="button" onClick={()=>{setAddress(item.address);setEditing(true)}} className="mt-2 text-sm font-semibold text-stone-700 underline underline-offset-4">Revisar y guardar</button></div>)}</div>:null}
  </section>
  <section className="mt-5 border-t border-stone-200 pt-4"><h3 className="text-sm font-semibold text-stone-900">Guías anteriores</h3>{data.shipments.length===0?<p className="mt-2 text-sm text-stone-600">Todavía no hay guías registradas.</p>:<ul className="mt-2 space-y-3">{data.shipments.map(g=><li key={g.id} className="border-b border-stone-100 pb-3"><p className="text-sm font-semibold text-stone-900">{g.carrier} · {g.service}</p><p className="mt-1 text-sm text-stone-700">{g.tracking}{g.cost!==null?` · $${g.cost.toFixed(2)}`:""}</p><p className="mt-1 break-words text-xs text-stone-600">{g.address}</p><div className="mt-2 flex flex-wrap gap-4"><a href={`https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(g.tracking)}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-stone-700 underline underline-offset-4">Rastrear guía</a>{g.pdf_path?<a href={`/api/conversations/${conversationId}/envios/${g.id}/pdf`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-stone-700 underline underline-offset-4">Abrir PDF</a>:null}</div></li>)}</ul>}</section>
  {notice?<p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>:null}{error?<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>:null}
 </aside>;
}
