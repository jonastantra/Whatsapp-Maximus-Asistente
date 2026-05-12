import { NextRequest, NextResponse } from "next/server";
import { setMode, type ConversationMode } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = Number(conversationId);
  const body = (await req.json()) as { mode?: unknown };
  const mode = body.mode;

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  if (mode !== "AI" && mode !== "HUMAN") {
    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  }

  const conversation = setMode(id, mode as ConversationMode);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, conversation });
}
