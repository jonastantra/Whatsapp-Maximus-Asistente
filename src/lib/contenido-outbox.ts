import fs from "node:fs";

export function contenidoOutbox(item: {content:string; shipment_pdf_path?:string|null}) {
 if (!item.shipment_pdf_path) return {text:item.content};
 const document=fs.readFileSync(item.shipment_pdf_path);
 if (document.subarray(0,5).toString()!=="%PDF-") throw new Error("Guía PDF inválida");
 return {document, mimetype:"application/pdf", fileName:"guia-envio.pdf", caption:item.content};
}
