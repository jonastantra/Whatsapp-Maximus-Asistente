import assert from "node:assert/strict";
import test from "node:test";
import type { Conversation, ExportMessage } from "./db";
import {
  buildConversationJsonl,
  buildGoogleContactsCsv,
} from "./export-utils";

const conversation: Conversation = {
  id: 1,
  phone: "5215512345678@s.whatsapp.net",
  alternate_jid: "123456789@lid",
  name: "Cliente, Ejemplo",
  mode: "AI",
  context_enabled: 0,
  context_notes: null,
  export_category: "business",
  last_message_at: 10,
  created_at: 1,
};

test("creates Google Contacts-compatible CSV without claiming a saved-contact status", () => {
  const csv = buildGoogleContactsCsv([conversation]);
  assert.match(csv, /"Name","Phone 1 - Type","Phone 1 - Value"/);
  assert.match(csv, /"\+5215512345678"/);
  assert.match(csv, /no confirma que esté guardado en la agenda/);
  assert.doesNotMatch(csv, /contacto guardado/i);
});

test("builds a deterministic local JSONL summary and makes no AI claim", () => {
  const messages: ExportMessage[] = [
    {
      id: 1,
      conversation_id: 1,
      conversation_phone: conversation.phone,
      conversation_name: conversation.name,
      export_category: "business",
      role: "user",
      content: "Quiero conocer el precio del producto.",
      created_at: 100,
    },
  ];
  const record = JSON.parse(
    buildConversationJsonl([conversation], messages, true),
  ) as {
    local_summary: { message_count: number; method: string };
    messages: Array<{ content: string }>;
  };
  assert.equal(record.local_summary.message_count, 1);
  assert.match(record.local_summary.method, /no se envió contenido/i);
  assert.equal(record.messages[0]?.content, messages[0]?.content);
});
