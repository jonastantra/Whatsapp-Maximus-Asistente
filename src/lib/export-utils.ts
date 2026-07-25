import type {
  Conversation,
  ExportMessage,
  MessageRole,
} from "./db";
import { exportablePhone } from "./whatsapp-identity";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "\uFEFF";
  const headers = Object.keys(rows[0]);
  return (
    "\uFEFF" +
    [
      headers.map(csvCell).join(","),
      ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")),
    ].join("\r\n")
  );
}

export function buildGoogleContactsCsv(
  conversations: Conversation[],
): string {
  return rowsToCsv(
    conversations.map((conversation) => {
      const phone = exportablePhone(
        conversation.phone,
        conversation.alternate_jid,
      );
      const identityNote = phone
        ? "Número observado en la conversación."
        : "WhatsApp solo proporcionó un identificador privado LID; no se inventó un número.";
      const nameNote = conversation.name
        ? "El nombre proviene del nombre mostrado por WhatsApp y no confirma que esté guardado en la agenda."
        : "WhatsApp no proporcionó un nombre.";

      return {
        Name: conversation.name || phone || "Contacto de WhatsApp",
        "Phone 1 - Type": phone ? "Mobile" : "",
        "Phone 1 - Value": phone,
        Notes: `${identityNote} ${nameNote} JID: ${conversation.phone}`,
        Labels:
          conversation.export_category === "business"
            ? "WhatsApp Maximus ::: Negocio"
            : "WhatsApp Maximus",
        "Custom Field 1 - Type": "WhatsApp JID",
        "Custom Field 1 - Value": conversation.phone,
        "Custom Field 2 - Type": "Origen del nombre",
        "Custom Field 2 - Value": conversation.name
          ? "Nombre mostrado por WhatsApp"
          : "Sin nombre disponible",
      };
    }),
  );
}

const stopWords = new Set([
  "para", "como", "pero", "porque", "esta", "este", "esto", "con", "una",
  "uno", "unos", "unas", "que", "del", "las", "los", "por", "más", "mas",
  "muy", "sin", "sus", "son", "hay", "hola", "gracias", "quiero", "puedo",
  "tiene", "tienen", "bien", "tambien", "también", "desde", "hasta",
]);

function topTerms(messages: ExportMessage[], limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const message of messages) {
    const words = message.content
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .match(/[a-z0-9]{4,}/g) ?? [];
    for (const word of words) {
      if (!stopWords.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export function buildLocalSummary(messages: ExportMessage[]) {
  const counts: Record<MessageRole, number> = {
    user: 0,
    assistant: 0,
    human: 0,
  };
  messages.forEach((message) => {
    counts[message.role] += 1;
  });

  return {
    message_count: messages.length,
    role_counts: counts,
    first_message_at: messages[0]?.created_at ?? null,
    last_message_at: messages.at(-1)?.created_at ?? null,
    frequent_terms: topTerms(messages),
    recent_excerpt: messages.slice(-3).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 280),
      created_at: message.created_at,
    })),
    method:
      "Resumen estadístico local; no se envió contenido a ningún servicio de IA.",
  };
}

export function buildConversationJsonl(
  conversations: Conversation[],
  messages: ExportMessage[],
  includeSummary: boolean,
): string {
  return conversations
    .map((conversation) => {
      const chatMessages = messages.filter(
        (message) => message.conversation_id === conversation.id,
      );
      return JSON.stringify({
        conversation: {
          id: conversation.id,
          name: conversation.name,
          phone: exportablePhone(
            conversation.phone,
            conversation.alternate_jid,
          ),
          whatsapp_jid: conversation.phone,
          category: conversation.export_category,
        },
        ...(includeSummary
          ? { local_summary: buildLocalSummary(chatMessages) }
          : {}),
        messages: chatMessages.map((message) => ({
          role: message.role,
          content: message.content,
          created_at: message.created_at,
        })),
      });
    })
    .join("\n");
}

export function buildConversationCsv(messages: ExportMessage[]): string {
  return rowsToCsv(
    messages.map((message) => ({
      conversation_id: message.conversation_id,
      contact_name: message.conversation_name ?? "",
      whatsapp_jid: message.conversation_phone,
      category: message.export_category,
      timestamp_iso: new Date(message.created_at * 1000).toISOString(),
      sender:
        message.role === "user"
          ? "contact"
          : message.role === "assistant"
            ? "assistant"
            : "human",
      message: message.content,
    })),
  );
}
