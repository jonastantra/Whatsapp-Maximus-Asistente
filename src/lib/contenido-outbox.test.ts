import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {contenidoOutbox} from "./contenido-outbox";

test("un aviso de guía adjunta el PDF y no degrada a texto cuando falta o es inválido",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"guia-outbox-"));
 try {
  const pdf=path.join(dir,"guia.pdf");
  fs.writeFileSync(pdf,"%PDF-1.4\nprueba");
  const result=contenidoOutbox({content:"Rastreo 123",shipment_pdf_path:pdf});
  assert.equal(result.mimetype,"application/pdf");
  assert.equal(result.caption,"Rastreo 123");
  fs.writeFileSync(pdf,"error");
  assert.throws(()=>contenidoOutbox({content:"Rastreo",shipment_pdf_path:pdf}),/PDF inválida/);
  assert.throws(()=>contenidoOutbox({content:"Rastreo",shipment_pdf_path:path.join(dir,"ausente.pdf")}));
  assert.deepEqual(contenidoOutbox({content:"Hola"}),{text:"Hola"});
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
