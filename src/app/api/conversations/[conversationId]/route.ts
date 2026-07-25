import { NextRequest, NextResponse } from "next/server";
import {
  deleteConversation,
  getConversationById,
  setConversationContext,
  setConversationExportCategory,
  type ExportCategory,
} from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { conversationId } = await params;
  const id = Number(conversationId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const conversation = getConversationById(id);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  deleteConversation(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = Number(conversationId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const body = (await req.json()) as {
    contextEnabled?: unknown;
    contextNotes?: unknown;
    exportCategory?: unknown;
  };

  const allowedCategories = new Set<ExportCategory>([
    "unclassified",
    "business",
    "personal",
    "excluded",
  ]);
  let conversation =
    typeof body.contextEnabled === "boolean" ||
    typeof body.contextNotes === "string"
      ? setConversationContext(
          id,
          body.contextEnabled === true,
          typeof body.contextNotes === "string" ? body.contextNotes : "",
        )
      : getConversationById(id);

  if (
    typeof body.exportCategory === "string" &&
    allowedCategories.has(body.exportCategory as ExportCategory)
  ) {
    conversation = setConversationExportCategory(
      id,
      body.exportCategory as ExportCategory,
    );
  }

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversacion no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, conversation });
}
