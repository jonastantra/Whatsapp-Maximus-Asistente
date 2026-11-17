import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

test("encola una guía confirmada solo una vez en el chat correcto",async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"guia-aviso-test-"));
 process.env.ENVIOS_DB_PATH=path.join(dir,"test.sqlite");
 const db=new Database(process.env.ENVIOS_DB_PATH);
 db.exec(`CREATE TABLE conversations(id INTEGER PRIMARY KEY,phone TEXT,last_message_at INTEGER);
 CREATE TABLE messages(id INTEGER PRIMARY KEY,conversation_id INTEGER,role TEXT,content TEXT,created_at INTEGER DEFAULT (unixepoch()));
 CREATE TABLE outbox(id INTEGER PRIMARY KEY,conversation_id INTEGER,phone TEXT,content TEXT,message_id INTEGER,status TEXT,sent INTEGER);
 INSERT INTO conversations(id,phone) VALUES (1,'5215500000000@s.whatsapp.net'),(2,'5215599999999@s.whatsapp.net');`);
 const mod=await import("./envios-cliente");
 const pdf=path.join(dir,"guia.pdf");fs.writeFileSync(pdf,"%PDF-1.4\nprueba");
 const address="Avenida de prueba 123, colonia Centro, CP 12345";
 mod.confirmarPago(1);mod.confirmarDireccion(1,address);
 const input={conversationId:1,address,tracking:"123456789012",carrier:"FedEx",service:"Express Saver",cost:100,pdfPath:pdf,avisarCliente:true};
 mod.registrarGuia(input);mod.registrarGuia(input);
 const rows=db.prepare("select * from outbox").all() as {phone:string;content:string}[];
 assert.equal(rows.length,1);assert.equal(rows[0].phone,"5215500000000@s.whatsapp.net");assert.match(rows[0].content,/123456789012/);
 assert.throws(()=>mod.registrarGuia({...input,conversationId:2,tracking:"123456789013"}),/Falta pago/);
 assert.equal(db.prepare("select count(*) n from outbox").get() && (db.prepare("select count(*) n from outbox").get() as {n:number}).n,1);
 db.close();
});
