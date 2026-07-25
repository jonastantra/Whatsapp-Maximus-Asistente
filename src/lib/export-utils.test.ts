import assert from "node:assert/strict";
import test from "node:test";
import type { Conversation, ExportMessage } from "./db";
import {
  buildAllGoogleContactsCsv,
  buildConversationCsv,
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

test("includes stored conversations with no messages in the all-chat CSV", () => {
  const emptyConversation: Conversation = {
    ...conversation,
    id: 4,
    phone: "5215599999999@s.whatsapp.net",
    name: "Chat vacío",
  };
  const csv = buildConversationCsv([], [emptyConversation]);
  assert.match(csv, /"Chat vacío"/);
  assert.match(csv, /"\+5215599999999"/);
  assert.match(csv, /"conversation_id","contact_name","phone"/);
});

test("deduplicates all-contact export by normalized phone and skips LID-only records", () => {
  const duplicate: Conversation = {
    ...conversation,
    id: 2,
    phone: "987654321@lid",
    alternate_jid: "5215512345678@s.whatsapp.net",
    name: null,
  };
  const lidOnly: Conversation = {
    ...conversation,
    id: 3,
    phone: "111222333@lid",
    alternate_jid: null,
    name: "Sin teléfono",
  };

  const result = buildAllGoogleContactsCsv([
    conversation,
    duplicate,
    lidOnly,
  ]);
  assert.equal(result.exportedCount, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.skippedLidOnly, 1);
  assert.equal(result.csv.match(/\+5215512345678/g)?.length, 1);
  assert.match(result.csv, /estado de agenda no disponible/i);
  assert.doesNotMatch(result.csv, /111222333@lid/);
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
