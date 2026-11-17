import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import path from "node:path";
import {
  deleteConversation,
  enqueueOutbox,
  getAllMessagesForExport,
  getMessages,
  getOrCreateConversation,
  getPendingOutbox,
  insertMessage,
  listExportableConversations,
  markOutboxFailed,
  markOutboxSending,
  retryOutboxForMessage,
  setConversationExportCategory,
  setMode,
  getConversationById,
  reactivateInactiveHumanChats,
  reactivateAllChats,
  setAiPaused,
  getBotSettings,
  registerUncaptionedImage,
  enqueueAiReplyIfCurrent,
} from "./db";

test("descarta una respuesta si llegó otro mensaje o intervino un humano", () => {
  const c=getOrCreateConversation(`carrera-${Date.now()}@lid`,"Prueba");
  try {
    setAiPaused(false);
    const old=insertMessage(c.id,'user','Primera pregunta');
    const current=insertMessage(c.id,'user','Segunda pregunta');
    assert.equal(enqueueAiReplyIfCurrent(c.id,old,c.phone,'Respuesta vieja'),false);
    assert.equal(enqueueAiReplyIfCurrent(c.id,current,c.phone,'Respuesta nueva'),true);
    assert.equal(enqueueAiReplyIfCurrent(c.id,current,c.phone,'Duplicado'),false);
    const next=insertMessage(c.id,'user','Otra pregunta');
    insertMessage(c.id,'human','Ya respondí');
    assert.equal(enqueueAiReplyIfCurrent(c.id,next,c.phone,'Tarde'),false);
    assert.equal(getPendingOutbox(100).filter(x=>x.conversation_id===c.id).length,1);
  } finally { deleteConversation(c.id); }
});

test("imagen sin texto se registra una sola vez y conserva el número alternativo", () => {
  const c = getOrCreateConversation(`imagen-${Date.now()}@lid`, "Prueba", "5215500000000@s.whatsapp.net");
  const event = `imagen-test-${Date.now()}`;
  try {
    setAiPaused(false);
    assert.equal(registerUncaptionedImage(c.id,c.phone,event,false,true),true);
    assert.equal(registerUncaptionedImage(c.id,c.phone,event,false,true),false);
    assert.deepEqual(getMessages(c.id).map(m=>m.role),["user","assistant"]);
    assert.ok(getConversationById(c.id)?.alternate_jid?.endsWith("@s.whatsapp.net"));
    assert.equal(getPendingOutbox(100).filter(x=>x.conversation_id===c.id).length,1);
  } finally { deleteConversation(c.id); }
});

test("imagen antigua o en modo humano no provoca respuesta", () => {
  const c = getOrCreateConversation(`imagen-humano-${Date.now()}@lid`, "Prueba");
  try {
    setMode(c.id,"HUMAN");
    registerUncaptionedImage(c.id,c.phone,`humano-${Date.now()}`,false,true);
    setMode(c.id,"AI");
    registerUncaptionedImage(c.id,c.phone,`antiguo-${Date.now()}`,false,false);
    assert.deepEqual(getMessages(c.id).map(m=>m.role),["user","user"]);
    assert.equal(getPendingOutbox(100).filter(x=>x.conversation_id===c.id).length,0);
  } finally { deleteConversation(c.id); }
});

test("envío interrumpido de resultado incierto no se reintenta automáticamente", () => {
  const c=getOrCreateConversation(`incierto-${Date.now()}@lid`,"Prueba");
  const db=new Database(path.join(process.cwd(),"data","messages.db"));
  try {
    const mid=insertMessage(c.id,"assistant","Prueba");
    const oid=enqueueOutbox(c.id,c.phone,"Prueba",mid);
    assert.equal(markOutboxSending(oid),true);
    db.prepare("UPDATE outbox SET next_attempt_at=unixepoch()-121 WHERE id=?").run(oid);
    assert.equal(getPendingOutbox(100).some(x=>x.id===oid),false);
    assert.equal(getMessages(c.id).find(m=>m.id===mid)?.delivery_status,"failed");
  } finally { db.close(); deleteConversation(c.id); }
});

test("reactiva IA solo después de tres horas de inactividad", () => {
  const c = getOrCreateConversation(`reactivar-${Date.now()}@lid`, "Prueba");
  try {
    setMode(c.id, "HUMAN");
    const now = Math.floor(Date.now() / 1000);
    reactivateInactiveHumanChats(now + 10799);
    assert.equal(getConversationById(c.id)?.mode, "HUMAN");
    reactivateInactiveHumanChats(now + 10801);
    assert.equal(getConversationById(c.id)?.mode, "AI");
  } finally { deleteConversation(c.id); }
});

test("activar todos reactiva chats y quita la pausa global sin enviar mensajes", () => {
  const c = getOrCreateConversation(`todos-${Date.now()}@lid`, "Prueba");
  try {
    setMode(c.id, "HUMAN");
    setAiPaused(true);
    assert.ok(reactivateAllChats() >= 1);
    assert.equal(getConversationById(c.id)?.mode, "AI");
    assert.equal(getBotSettings().ai_paused, 0);
    assert.equal(getMessages(c.id).length, 0);
  } finally { deleteConversation(c.id); }
});

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
