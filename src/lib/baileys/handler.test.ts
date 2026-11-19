import assert from "node:assert/strict";
import test from "node:test";
import type { WASocket, WAMessage } from "baileys";
import { handleIncomingMessage } from "./handler";
import { deleteConversation, getConversationByAddress, getMessages, getPendingOutbox, setAiPaused, setMode, getOrCreateConversation } from "../db";

test("imagen sin texto entrante conserva teléfono y se responde una sola vez", async () => {
  const id = String(Date.now());
  const jid = `${id}@lid`;
  const event = { key: { id:`event-${id}`,remoteJid:jid,remoteJidAlt:"5215500000000@s.whatsapp.net",fromMe:false }, message: { imageMessage:{} }, messageTimestamp:Math.floor(Date.now()/1000), pushName:"Prueba" } as unknown as WAMessage;
  setAiPaused(false);
  try {
    await handleIncomingMessage({} as WASocket,event);
    await handleIncomingMessage({} as WASocket,event);
    const c=getConversationByAddress(jid);
    assert.ok(c);
    assert.equal(c.alternate_jid,"5215500000000@s.whatsapp.net");
    assert.deepEqual(getMessages(c.id).map(m=>m.role),["user","assistant"]);
    assert.equal(getMessages(c.id)[1].content,"Gracias, recibimos tu imagen. Un asesor la revisará y te ayudará por aquí.");
    assert.equal(getConversationByAddress(jid)?.mode,"HUMAN");
    assert.equal(getPendingOutbox(100).filter(m=>m.conversation_id===c.id).length,1);
  } finally {
    const c=getConversationByAddress(jid); if(c) deleteConversation(c.id);
  }
});

test("imagen con descripción se deriva a una persona sin inventar su contenido", async () => {
  const id=String(Date.now()); const jid=`${id}@lid`;
  const event={key:{id:`caption-${id}`,remoteJid:jid,fromMe:false},message:{imageMessage:{caption:"Te mando comprobante"}},messageTimestamp:Math.floor(Date.now()/1000)} as unknown as WAMessage;
  setAiPaused(false);
  try {
    await handleIncomingMessage({} as WASocket,event);
    const c=getConversationByAddress(jid); assert.ok(c);
    assert.equal(c.mode,"HUMAN");
    assert.deepEqual(getMessages(c.id).map(m=>m.role),["user","assistant"]);
    assert.match(getMessages(c.id)[1].content,/asesor la revisará/);
  } finally {const c=getConversationByAddress(jid);if(c)deleteConversation(c.id);}
});

test("una intervención humana detiene al asistente y evita respuestas automáticas incluso ante una queja", async () => {
  const jid = `${Date.now()}@lid`;
  const c = getOrCreateConversation(jid, "Prueba");
  setAiPaused(false);
  setMode(c.id, "AI");
  try {
    await handleIncomingMessage({} as WASocket, { key: {id:"human-test", remoteJid:jid, fromMe:true}, message:{conversation:"Yo te atiendo"} } as unknown as WAMessage);
    assert.equal(getConversationByAddress(jid)?.mode, "HUMAN");
    await handleIncomingMessage({} as WASocket, { key: {id:"user-test",remoteJid:jid,fromMe:false},message:{conversation:"Tengo una queja, mi paquete no llegó"} } as unknown as WAMessage);
    assert.deepEqual(getMessages(c.id).map(m=>m.role), ["human", "user"]);
    assert.equal(getPendingOutbox(100).filter(m=>m.conversation_id===c.id).length,0);
  } finally { deleteConversation(c.id); }
});
