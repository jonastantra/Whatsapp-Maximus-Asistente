import { NextResponse } from "next/server";
import {
  listConversationsByIds,
  listExportableConversations,
} from "@/lib/db";
import {
  buildAllGoogleContactsCsv,
  buildGoogleContactsCsv,
} from "@/lib/export-utils";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    conversationIds?: unknown;
    allStored?: unknown;
  } | null;

  if (body?.allStored === true) {
    const result = buildAllGoogleContactsCsv(listExportableConversations());
    if (result.exportedCount === 0) {
      return NextResponse.json(
        {
          error:
            "No hay números telefónicos exportables. Los registros disponibles solo tienen LID o están marcados como No exportar.",
        },
        { status: 400 },
      );
    }
    return new NextResponse(result.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="todos-contactos-whatsapp-google.csv"',
        "X-Exported-Contacts": String(result.exportedCount),
        "X-Skipped-Lid-Only": String(result.skippedLidOnly),
        "X-Deduplicated-Contacts": String(result.duplicateCount),
      },
    });
  }

  const ids = Array.isArray(body?.conversationIds)
    ? [...new Set(body.conversationIds)]
        .filter((id): id is number => Number.isInteger(id) && id > 0)
        .slice(0, 1000)
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Selecciona al menos un contacto." },
      { status: 400 },
    );
  }

  const conversations = listConversationsByIds(ids).filter(
    (conversation) => conversation.export_category !== "excluded",
  );
  if (conversations.length === 0) {
    return NextResponse.json(
      { error: "Todos los contactos seleccionados están marcados como No exportar." },
      { status: 400 },
    );
  }
  const csv = buildGoogleContactsCsv(conversations);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="contactos-whatsapp-google.csv"',
    },
  });
}
