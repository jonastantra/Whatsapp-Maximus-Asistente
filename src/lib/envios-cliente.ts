import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export interface DireccionEnvio { id: number; conversation_id: number; address: string; status: "detectada" | "confirmada"; source: string; created_at: number; }
export interface GuiaCliente { id: number; conversation_id: number; address: string; tracking: string; carrier: string; service: string; cost: number | null; created_at: number; pdf_path: string | null; }
export interface CasoPago { id: number; conversation_id: number; status: "confirmado" | "enviado"; confirmed_at: number; }

const dbPath = process.env.ENVIOS_DB_PATH || path.resolve(process.cwd(), "data/messages.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");
db.exec(`CREATE TABLE IF NOT EXISTS customer_shipping_addresses (
 id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, address TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('detectada','confirmada')), source TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()), UNIQUE(conversation_id,address)
);
CREATE INDEX IF NOT EXISTS idx_shipping_address_conversation ON customer_shipping_addresses(conversation_id,created_at DESC);
CREATE TABLE IF NOT EXISTS customer_shipments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, address TEXT NOT NULL,
 tracking TEXT NOT NULL UNIQUE, carrier TEXT NOT NULL, service TEXT NOT NULL, cost REAL,
 pdf_path TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_customer_shipments ON customer_shipments(conversation_id,created_at DESC);`);
db.exec(`CREATE TABLE IF NOT EXISTS customer_payment_cases (
 id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('confirmado','enviado')),
 confirmed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_confirmed_payment ON customer_payment_cases(conversation_id) WHERE status='confirmado';`);
db.exec(`CREATE TABLE IF NOT EXISTS accepted_payment_receipts (
 conversation_id INTEGER NOT NULL, message_id INTEGER NOT NULL UNIQUE,
 accepted_at INTEGER NOT NULL DEFAULT (unixepoch()), bank_verified INTEGER NOT NULL DEFAULT 0
);`);
db.exec(`CREATE TABLE IF NOT EXISTS shipment_notifications (
 tracking TEXT PRIMARY KEY, conversation_id INTEGER NOT NULL, message_id INTEGER NOT NULL UNIQUE,
 outbox_id INTEGER NOT NULL UNIQUE, created_at INTEGER NOT NULL DEFAULT (unixepoch())
);`);

// Captura el texto tal como lo mandó el cliente; no deduce campos ni afirma validez.
export function detectarDireccion(texto: string): string | null {
 const clean = texto.trim();
 if (clean.length < 20 || clean.length > 1200 || !/\b\d{5}\b/.test(clean)) return null;
 if (!/(?:\bcalle\b|\bav(?:enida)?\b|\bcol(?:onia)?\b|\bprivada\b|\bcalzada\b|\bfracc(?:ionamiento)?\b)/i.test(clean)) return null;
 return clean;
}
export function guardarDireccionDetectada(conversationId: number, texto: string): void {
 const direccion = detectarDireccion(texto);
 if (!direccion) return;
 const pago = db.prepare("SELECT id FROM customer_payment_cases WHERE conversation_id=? AND status='confirmado'").get(conversationId);
 if (!pago) return;
 db.prepare("INSERT OR IGNORE INTO customer_shipping_addresses(conversation_id,address,status,source) VALUES (?,?,'detectada','mensaje del cliente')").run(conversationId,direccion);
}
export function confirmarDireccion(conversationId: number, address: string): void {
 const clean=address.trim();
 if (clean.length < 10 || clean.length > 1200) throw new Error('Dirección inválida');
 db.transaction(() => {
  db.prepare("UPDATE customer_shipping_addresses SET status='detectada' WHERE conversation_id=? AND status='confirmada'").run(conversationId);
  db.prepare("INSERT INTO customer_shipping_addresses(conversation_id,address,status,source) VALUES (?,?,'confirmada','guardada en el panel') ON CONFLICT(conversation_id,address) DO UPDATE SET status='confirmada', source='guardada en el panel', created_at=unixepoch()").run(conversationId,clean);
 })();
}
export function confirmarPago(conversationId:number): void {
 db.prepare("INSERT OR IGNORE INTO customer_payment_cases(conversation_id,status) VALUES (?,'confirmado')").run(conversationId);
 const messages=db.prepare("SELECT content FROM messages WHERE conversation_id=? AND role='user' AND created_at>=unixepoch()-2592000 ORDER BY id DESC LIMIT 200").all(conversationId) as {content:string}[];
 for (const item of messages) guardarDireccionDetectada(conversationId,item.content);
}
export function aceptarComprobante(conversationId:number, messageId:number): void {
 const image=db.prepare("SELECT 1 FROM messages m JOIN message_images i ON i.message_id=m.id WHERE m.id=? AND m.conversation_id=? AND m.role='user'").get(messageId,conversationId);
 if (!image) throw new Error('No se encontró la imagen del cliente');
 db.prepare('INSERT OR IGNORE INTO accepted_payment_receipts(conversation_id,message_id) VALUES (?,?)').run(conversationId,messageId);
}
export function obtenerEnvios(conversationId: number): { addresses: DireccionEnvio[]; shipments: GuiaCliente[]; payment: CasoPago | null } {
 return {
  addresses: db.prepare("SELECT * FROM customer_shipping_addresses WHERE conversation_id=? ORDER BY CASE status WHEN 'confirmada' THEN 0 ELSE 1 END, created_at DESC,id DESC LIMIT 25").all(conversationId) as DireccionEnvio[],
  shipments: db.prepare("SELECT * FROM customer_shipments WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 50").all(conversationId) as GuiaCliente[],
  payment: (db.prepare("SELECT * FROM customer_payment_cases WHERE conversation_id=? AND status='confirmado' ORDER BY id DESC LIMIT 1").get(conversationId) as CasoPago|undefined) || null,
 };
}
export function registrarGuia(input: { conversationId:number; address:string; tracking:string; carrier:string; service:string; cost:number|null; pdfPath?:string|null; createdAt?:number; avisarCliente?:boolean }): void {
 if (!input.address.trim() || !/^[a-zA-Z0-9-]{6,80}$/.test(input.tracking)) throw new Error('Datos de guía inválidos');
 db.transaction(()=>{
  const existing=db.prepare("SELECT conversation_id FROM customer_shipments WHERE tracking=?").get(input.tracking) as {conversation_id:number}|undefined;
  if (existing && existing.conversation_id!==input.conversationId) throw new Error('La guía ya está asociada a otro cliente');
  if (existing) return;
  let destination: string | undefined;
  let alreadySent = false;
  if (input.avisarCliente) {
   const pago = db.prepare("SELECT id FROM customer_payment_cases WHERE conversation_id=? AND status='confirmado'").get(input.conversationId) || db.prepare("SELECT message_id FROM accepted_payment_receipts WHERE conversation_id=?").get(input.conversationId);
   const direccion = db.prepare("SELECT id FROM customer_shipping_addresses WHERE conversation_id=? AND address=? AND status='confirmada'").get(input.conversationId,input.address.trim());
   const cliente = db.prepare("SELECT phone FROM conversations WHERE id=?").get(input.conversationId) as {phone:string}|undefined;
   if (!pago || !direccion || !cliente || !/^[0-9]+@(s\.whatsapp\.net|lid)$/.test(cliente.phone)) throw new Error('Falta pago, dirección o chat confirmado');
   if (!input.pdfPath || !fs.existsSync(input.pdfPath)) throw new Error('Falta guía descargada y verificada');
   const pdf = fs.openSync(input.pdfPath,'r');
   try { const sig=Buffer.alloc(5); if (fs.readSync(pdf,sig,0,5,0)!==5 || sig.toString()!=='%PDF-') throw new Error('Guía no es un PDF válido'); } finally {fs.closeSync(pdf);}
   destination=cliente.phone;
   alreadySent=!!db.prepare("SELECT m.id FROM messages m LEFT JOIN outbox o ON o.message_id=m.id WHERE m.conversation_id=? AND m.role IN ('human','assistant') AND instr(m.content,?)>0 AND (o.id IS NULL OR o.status='sent') LIMIT 1").get(input.conversationId,input.tracking);
  }
  db.prepare("INSERT OR IGNORE INTO customer_shipments(conversation_id,address,tracking,carrier,service,cost,pdf_path,created_at) VALUES (?,?,?,?,?,?,?,?)").run(input.conversationId,input.address.trim(),input.tracking,input.carrier,input.service,input.cost,input.pdfPath || null,input.createdAt || Math.floor(Date.now()/1000));
  if (destination && !alreadySent) {
   const text=`Hola, ya está lista tu guía de ${input.carrier}. Tu número de rastreo es: ${input.tracking}. Gracias por tu compra.`;
   const m=db.prepare("INSERT INTO messages(conversation_id,role,content) VALUES (?,'human',?)").run(input.conversationId,text);
   const o=db.prepare("INSERT INTO outbox(conversation_id,phone,content,message_id,status,sent) VALUES (?,?,?,?,'pending',0)").run(input.conversationId,destination,text,m.lastInsertRowid);
   db.prepare("INSERT INTO shipment_notifications(tracking,conversation_id,message_id,outbox_id) VALUES (?,?,?,?)").run(input.tracking,input.conversationId,m.lastInsertRowid,o.lastInsertRowid);
   db.prepare("UPDATE conversations SET last_message_at=unixepoch() WHERE id=?").run(input.conversationId);
  }
  db.prepare("UPDATE customer_payment_cases SET status='enviado' WHERE conversation_id=? AND status='confirmado'").run(input.conversationId);
 })();
}
