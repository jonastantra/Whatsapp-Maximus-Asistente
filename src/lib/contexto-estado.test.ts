import assert from "node:assert/strict";
import test from "node:test";
import type { WAMessage } from "baileys";
import { textoEstadoCitado } from "./contexto-estado";

test("reconoce respuestas a estados, con y sin texto, sin inventar contenido", () => {
  const msg = (quotedMessage: object, remoteJid = "status@broadcast") => ({message:{extendedTextMessage:{text:"precio",contextInfo:{remoteJid,quotedMessage}}}} as unknown as WAMessage);
  assert.deepEqual(textoEstadoCitado(msg({imageMessage:{caption:"Kit de barba"}})),{tipo:"imagen",texto:"Kit de barba"});
  assert.deepEqual(textoEstadoCitado(msg({imageMessage:{}})),{tipo:"imagen",texto:null});
  assert.deepEqual(textoEstadoCitado(msg({videoMessage:{}})),{tipo:"video",texto:null});
  assert.equal(textoEstadoCitado(msg({conversation:"Otro chat"},"123@s.whatsapp.net")),null);
});
