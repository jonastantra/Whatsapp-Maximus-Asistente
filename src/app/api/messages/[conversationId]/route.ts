import { NextRequest, NextResponse } from "next/server";
import {
  enqueueOutbox,
  getConversationById,
  getMessages,
  insertMessage,
} from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

function parseConversationId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = parseConversationId(conversationId);

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  return NextResponse.json({
    messages: getMessages(id, Number.isFinite(limit) ? limit : 50),
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = parseConversationId(conversationId);

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const conversation = getConversationById(id);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  const body = (await req.json()) as { content?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json(
      { error: "El mensaje no puede estar vacío" },
      { status: 400 },
    );
  }

  const messageId = insertMessage(id, "human", content);
  enqueueOutbox(id, conversation.phone, content);

  return NextResponse.json({ ok: true, messageId });
}
