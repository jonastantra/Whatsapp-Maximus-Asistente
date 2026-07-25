import { NextResponse } from "next/server";
import {
  getAllMessagesForExport,
  getMessagesForExport,
  listExportableConversations,
  listConversationsByIds,
} from "@/lib/db";
import {
  buildConversationCsv,
  buildConversationJsonl,
} from "@/lib/export-utils";

function dateToUnix(value: unknown, endOfDay = false): number | null {
  if (typeof value !== "string" || !value) return null;
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const timestamp = Date.parse(`${value}${suffix}`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    conversationIds?: unknown;
    format?: unknown;
    includeSummary?: unknown;
    from?: unknown;
    to?: unknown;
    allStored?: unknown;
  } | null;
  const allStored = body?.allStored === true;

  if (allStored) {
    const conversations = listExportableConversations();
    if (conversations.length === 0) {
      return NextResponse.json(
        { error: "No hay conversaciones exportables almacenadas." },
        { status: 400 },
      );
    }
    const csv = buildConversationCsv(
      getAllMessagesForExport(),
      conversations,
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="todas-conversaciones-almacenadas.csv"',
      },
    });
  }

  const ids = Array.isArray(body?.conversationIds)
    ? [...new Set(body.conversationIds)]
        .filter((id): id is number => Number.isInteger(id) && id > 0)
        .slice(0, 200)
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Selecciona al menos una conversación." },
      { status: 400 },
    );
  }

  const format = body?.format === "csv" ? "csv" : "jsonl";
  const conversations = listConversationsByIds(ids).filter(
    (conversation) => conversation.export_category !== "excluded",
  );
  if (conversations.length === 0) {
    return NextResponse.json(
      { error: "Todos los chats seleccionados están marcados como No exportar." },
      { status: 400 },
    );
  }
  const exportIds = conversations.map((conversation) => conversation.id);
  const messages = getMessagesForExport(exportIds, {
    from: dateToUnix(body?.from),
    to: dateToUnix(body?.to, true),
  });
  const content =
    format === "csv"
      ? buildConversationCsv(messages, conversations)
      : buildConversationJsonl(
          conversations,
          messages,
          body?.includeSummary === true,
        );

  return new NextResponse(content, {
    headers: {
      "Content-Type":
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="conversaciones-whatsapp.${format}"`,
    },
  });
}
