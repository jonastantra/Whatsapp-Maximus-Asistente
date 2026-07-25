import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteConversation,
  enqueueOutbox,
  getMessages,
  getOrCreateConversation,
  getPendingOutbox,
  insertMessage,
  markOutboxFailed,
  markOutboxSending,
  retryOutboxForMessage,
} from "./db";

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
  } finally {
    deleteConversation(conversation.id);
  }
});
