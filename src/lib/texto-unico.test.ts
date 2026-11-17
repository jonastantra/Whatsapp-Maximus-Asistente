import assert from "node:assert/strict";
import test from "node:test";
import { getOrCreateConversation, insertInboundTextOnce } from "./db";

test("un mismo mensaje de WhatsApp se guarda una sola vez aunque llegue repetido", () => {
  const c = getOrCreateConversation("prueba-unico@lid", "Cliente");
  assert.ok(insertInboundTextOnce(c.id, "ID-REPETIDO-1", "hola") !== null);
  assert.equal(insertInboundTextOnce(c.id, "ID-REPETIDO-1", "hola"), null);
  assert.ok(insertInboundTextOnce(c.id, "ID-OTRO-2", "hola") !== null);
});

test("un mensaje propio no cambia el nombre del cliente", () => {
  const c = getOrCreateConversation("prueba-nombre@lid", "Rene Parra");
  const despues = getOrCreateConversation("prueba-nombre@lid", undefined);
  assert.equal(despues.name, "Rene Parra");
  assert.equal(c.id, despues.id);
});
