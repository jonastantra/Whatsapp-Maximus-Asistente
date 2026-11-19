import { NextRequest, NextResponse } from "next/server";
import { enviar, listar } from "@/lib/sala";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const canal = req.nextUrl.searchParams.get("canal") ?? "todo";
  return NextResponse.json({ mensajes: listar(canal) });
}

export async function POST(req: NextRequest) {
  const usuario = req.headers.get("x-usuario");
  if (!usuario) return NextResponse.json({ error: "Entra con tu usuario del panel" }, { status: 401 });
  try {
    const b = await req.json();
    const ids = enviar(usuario, String(b.canal ?? "general"), String(b.para ?? "todos"), String(b.texto ?? ""));
    return NextResponse.json({ ok: true, ids });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 400 });
  }
}
