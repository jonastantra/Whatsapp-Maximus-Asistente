import assert from "node:assert/strict";
import test from "node:test";
import type { WASocket, WAMessage } from "baileys";
import {
  deleteConversation,
  getConversationByAddress,
  getMessages,
  setAiPaused,
} from "./db";

test("handles an owner command arriving as LID with the phone in remoteJidAlt", async () => {
  process.env.OWNER_ALERT_PHONE = "5215511111111";
  const { tryHandleOwnerCommand } = await import("./owner-commands");
  const lid = `${Date.now()}@lid`;
  const phoneJid = "5215511111111@s.whatsapp.net";
  const message = {
    key: {
      remoteJid: lid,
      remoteJidAlt: phoneJid,
      fromMe: false,
      id: "owner-command-test",
    },
    pushName: "Propietario",
    message: { conversation: "/pausar" },
  } as unknown as WAMessage;

  let conversationId: number | null = null;
  try {
    const handled = await tryHandleOwnerCommand(
      {} as WASocket,
      message,
      "/pausar",
    );
    assert.equal(handled, true);

    const conversation =
      getConversationByAddress(lid) ?? getConversationByAddress(phoneJid);
    assert.ok(conversation);
    conversationId = conversation.id;
    assert.equal(conversation.alternate_jid, phoneJid);

    const messages = getMessages(conversation.id);
    assert.deepEqual(
      messages.map((item) => [item.role, item.content]),
      [
        ["user", "/pausar"],
        ["assistant", "IA pausada globalmente."],
      ],
    );
    assert.equal(messages.at(-1)?.delivery_status, "pending");
  } finally {
    setAiPaused(false);
    if (conversationId) deleteConversation(conversationId);
  }
});
