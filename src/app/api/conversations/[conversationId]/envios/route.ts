import { NextRequest, NextResponse } from "next/server";
import { getConversationById } from "@/lib/db";
import { confirmarDireccion, confirmarPago, obtenerEnvios } from "@/lib/envios-cliente";

interface Ctx { params: Promise<{ conversationId: string }> }
async function conversationId(ctx: Ctx): Promise<number | null> {
 const id=Number((await ctx.params).conversationId);
 return Number.isSafeInteger(id) && id>0 && getConversationById(id) ? id : null;
}
export async function GET(_req: Request, ctx: Ctx) {
 const id=await conversationId(ctx);
 if (!id) return NextResponse.json({ error: "Conversación no encontrada" },{ status:404 });
 return NextResponse.json(obtenerEnvios(id),{ headers:{"Cache-Control":"no-store"} });
}
export async function POST(req: NextRequest, ctx: Ctx) {
 const id=await conversationId(ctx);
 if (!id) return NextResponse.json({ error: "Conversación no encontrada" },{ status:404 });
 const body=await req.json().catch(()=>null) as {address?:unknown; action?:unknown}|null;
 if (body?.action === "confirmar_pago") {
  confirmarPago(id);
  return NextResponse.json(obtenerEnvios(id));
 }
 if (!obtenerEnvios(id).payment) return NextResponse.json({error:"Confirma primero que recibiste el pago"},{status:409});
 if (typeof body?.address !== "string" || body.address.trim().length<10 || body.address.length>1200) return NextResponse.json({error:"Escribe una dirección válida"},{status:400});
 confirmarDireccion(id,body.address);
 return NextResponse.json(obtenerEnvios(id));
}
