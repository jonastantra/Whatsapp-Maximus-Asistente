import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteConversation,
  enqueueOutbox,
  getAllMessagesForExport,
  getConversationById,
  getMessages,
  getOrCreateConversation,
  getPendingOutbox,
  insertMessage,
  listExportableConversations,
  markOutboxFailed,
  markOutboxSending,
  reactivateAiAfterInactivity,
  retryOutboxForMessage,
  setConversationExportCategory,
  setMode,
} from "./db";
import { AI_AUTO_REACTIVATION_SECONDS } from "./conversation-policy";

test("persists delivery state and allows an explicit retry", () => {
  const conversation = getOrCreateConversation(
    `test-${Date.now()}@lid`,
    "Prueba local",
    "5215500000000@s.whatsapp.net",
  );

  try {
    const messageId = insertMessage(
      conversation.id,
      "human",
      "Mensaje de prueba",
    );
    const outboxId = enqueueOutbox(
      conversation.id,
      conversation.phone,
      "Mensaje de prueba",
      messageId,
    );

    assert.ok(
      getPendingOutbox(100).some((item) => item.id === outboxId),
      "el mensaje debe quedar pendiente",
    );
    assert.equal(markOutboxSending(outboxId), true);
    markOutboxFailed(outboxId, "fallo simulado");

    const failed = getMessages(conversation.id).find(
      (message) => message.id === messageId,
    );
    assert.equal(failed?.delivery_status, "failed");
    assert.equal(retryOutboxForMessage(messageId), true);

    const retried = getMessages(conversation.id).find(
      (message) => message.id === messageId,
    );
    assert.equal(retried?.delivery_status, "pending");

    assert.ok(
      listExportableConversations().some(
        (item) => item.id === conversation.id,
      ),
    );
    assert.ok(
      getAllMessagesForExport().some((item) => item.id === messageId),
    );

    setConversationExportCategory(conversation.id, "excluded");
    assert.equal(
      listExportableConversations().some(
        (item) => item.id === conversation.id,
      ),
      false,
    );
    assert.equal(
      getAllMessagesForExport().some((item) => item.id === messageId),
      false,
    );
  } finally {
    deleteConversation(conversation.id);
  }
});

test("reactivates a HUMAN chat when the customer returns after 15 days", () => {
  const conversation = getOrCreateConversation(
    `reactivation-${Date.now()}@lid`,
    "Prueba reactivacion",
  );

  try {
    insertMessage(conversation.id, "user", "Mensaje anterior");
    setMode(conversation.id, "HUMAN");
    const lastActivity = getConversationById(conversation.id)?.last_message_at;
    assert.ok(lastActivity);

    assert.equal(
      reactivateAiAfterInactivity(
        conversation.id,
        AI_AUTO_REACTIVATION_SECONDS,
        lastActivity + AI_AUTO_REACTIVATION_SECONDS - 1,
      ),
      false,
    );
    assert.equal(getConversationById(conversation.id)?.mode, "HUMAN");

    assert.equal(
      reactivateAiAfterInactivity(
        conversation.id,
        AI_AUTO_REACTIVATION_SECONDS,
        lastActivity + AI_AUTO_REACTIVATION_SECONDS,
      ),
      true,
    );
    assert.equal(getConversationById(conversation.id)?.mode, "AI");
  } finally {
    deleteConversation(conversation.id);
  }
});
