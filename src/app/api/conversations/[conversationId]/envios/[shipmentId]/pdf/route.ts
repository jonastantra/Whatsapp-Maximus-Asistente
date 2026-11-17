import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { obtenerEnvios } from "@/lib/envios-cliente";

export async function GET(_request:Request,{params}:{params:Promise<{conversationId:string;shipmentId:string}>}) {
 const p=await params;const conversationId=Number(p.conversationId);const shipmentId=Number(p.shipmentId);
 if (!Number.isSafeInteger(conversationId)||conversationId<=0||!Number.isSafeInteger(shipmentId)||shipmentId<=0) return new NextResponse(null,{status:404});
 const shipment=obtenerEnvios(conversationId).shipments.find(s=>s.id===shipmentId);
 if(!shipment?.pdf_path) return new NextResponse(null,{status:404});
 try {
  const root=fs.realpathSync('/home/jon/guias-skydropx/guias');
  const target=fs.realpathSync(shipment.pdf_path);
  if (!target.startsWith(root+path.sep)||!target.toLowerCase().endsWith('.pdf')) return new NextResponse(null,{status:404});
  const data=fs.readFileSync(target);
  if(data.subarray(0,5).toString()!=='%PDF-') return new NextResponse(null,{status:404});
  return new NextResponse(new Uint8Array(data),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 } catch { return new NextResponse(null,{status:404}); }
}
