import assert from "node:assert/strict";
import test from "node:test";
import { imageMime, guardarImagenWhatsApp } from "./imagenes-whatsapp";
import { encryptedStream, type WAMessage } from "baileys";
import { createServer } from "node:http";
import { readFile, unlink } from "node:fs/promises";
import { deleteConversation, getOrCreateConversation, getMessages, getMessageImage, imageMessageIdForEvent, insertMessage, registerUncaptionedImage, saveMessageImage } from "./db";

test("guarda una imagen recibida en la base, la enlaza al chat y elimina el adjunto con el chat", () => {
  const c = getOrCreateConversation(`${Date.now()}@lid`,"Prueba");
  const event = `foto-${Date.now()}`;
  const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
  try {
    assert.equal(registerUncaptionedImage(c.id,c.phone,event,false,false),true);
    assert.equal(registerUncaptionedImage(c.id,c.phone,event,false,false),false);
    const id = imageMessageIdForEvent(event);
    assert.ok(id);
    assert.equal(imageMime(png),"image/png");
    assert.equal(imageMime(Buffer.from("no es imagen")),null);
    saveMessageImage(id,"image/png",png);
    assert.equal(getMessages(c.id)[0].has_image,1);
    assert.deepEqual(getMessageImage(id)?.data,png);
    deleteConversation(c.id);
    assert.equal(getMessageImage(id),null);
  } finally { deleteConversation(c.id); }
});

test("descarga y descifra imagen simulada de WhatsApp y la guarda asociada al mensaje", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWkAAAAAASUVORK5CYII=", "base64");
  const encrypted = await encryptedStream(png,"image");
  const ciphertext = await readFile(encrypted.encFilePath);
  const server = createServer((_req,res) => {res.writeHead(200);res.end(ciphertext);});
  await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
  const port = (server.address() as {port:number}).port;
  const c = getOrCreateConversation(`${Date.now()}@lid`,"Prueba de descarga");
  const id = insertMessage(c.id,"user","imagen de prueba");
  try {
    const msg = {message:{imageMessage:{url:`http://127.0.0.1:${port}/foto`,mediaKey:encrypted.mediaKey,fileLength:png.length}}} as unknown as WAMessage;
    await guardarImagenWhatsApp(id,msg);
    assert.deepEqual(getMessageImage(id)?.data,png);
  } finally {
    deleteConversation(c.id);
    await new Promise<void>(r=>server.close(()=>r()));
    await unlink(encrypted.encFilePath);
  }
});
