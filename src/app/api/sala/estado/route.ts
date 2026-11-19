import { NextRequest, NextResponse } from "next/server";
import { decidir } from "@/lib/sala";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const usuario = req.headers.get("x-usuario");
  if (!usuario) return NextResponse.json({ error: "Entra con tu usuario del panel" }, { status: 401 });
  try {
    const b = await req.json();
    const estado = b.estado === "rechazada" ? "rechazada" : "aprobada";
    decidir(usuario, Number(b.id), estado, String(b.nota ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 400 });
  }
}
