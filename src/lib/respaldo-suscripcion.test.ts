import assert from "node:assert/strict";
import test from "node:test";
import { replyWithRecovery, validFallback } from "./respaldo-suscripcion";

test("respaldo rechaza importes, promociones, enlaces y promesas sin verificar",()=>{
  for(const bad of ["Cuesta $999", "Tiene 20%", "Hay promoción", "Envío gratis", "Pago contra entrega", "Visita https://ejemplo.com", "Ya te lo aparté"]) assert.equal(validFallback(bad),false);
  assert.equal(validFallback("Hola, ¿buscas un producto para barba o cabello?"),true);
});

test("respaldo solo se invoca si falla el modelo principal",async()=>{
  let calls=0;
  const ok=await replyWithRecovery(async()=>"normal",async()=>{calls++;return "respaldo";},50);
  assert.deepEqual(ok,{text:"normal",usedFallback:false});assert.equal(calls,0);
  const fail=await replyWithRecovery(async()=>{throw Error('sin servicio');},async()=>{calls++;return "respaldo";},50);
  assert.deepEqual(fail,{text:"respaldo",usedFallback:true});assert.equal(calls,1);
});

test("si el modelo tarda, usa respaldo una sola vez",async()=>{
  let calls=0;
  const reply=await replyWithRecovery(()=>new Promise(()=>{}),async()=>{calls++;return "respaldo";},5);
  assert.deepEqual(reply,{text:"respaldo",usedFallback:true});assert.equal(calls,1);
});
