import { confirmarPago, confirmarDireccion, obtenerEnvios, registrarGuia, aceptarComprobante } from "../src/lib/envios-cliente";
import Database from "better-sqlite3";
import path from "node:path";
const [action,idText,...args]=process.argv.slice(2);
const db=new Database(path.resolve(process.cwd(),"data/messages.db"),{readonly:true});
const id=Number(idText);
if(action==="revisar") {
 const rows=db.prepare("SELECT conversation_id FROM customer_payment_cases WHERE status='confirmado'").all() as {conversation_id:number}[];
 for(const row of rows) confirmarPago(row.conversation_id);
 console.log(`Revisados ${rows.length} pagos confirmados.`);
} else if(action==="pendientes") {
 const rows=db.prepare(`SELECT p.conversation_id, c.name, c.phone, p.confirmed_at FROM customer_payment_cases p JOIN conversations c ON c.id=p.conversation_id WHERE p.status='confirmado' ORDER BY p.confirmed_at`).all() as {conversation_id:number}[];
 console.log(JSON.stringify(rows.map(row=>({...row,...obtenerEnvios(row.conversation_id)})),null,2));
} else {
 if (!Number.isSafeInteger(id)||id<=0||!db.prepare("select 1 from conversations where id=?").get(id)) throw new Error("Conversación no encontrada");
 if(action==="ver") console.log(JSON.stringify(obtenerEnvios(id),null,2));
 else if(action==="aceptar-comprobante") { aceptarComprobante(id,Number(args[0]));console.log("Comprobante aceptado; depósito no verificado bancariamente"); }
 else if(action==="confirmar-pago") { confirmarPago(id);console.log(JSON.stringify(obtenerEnvios(id),null,2)); }
 else if(action==="direccion") { if(!obtenerEnvios(id).payment && !db.prepare('SELECT 1 FROM accepted_payment_receipts WHERE conversation_id=?').get(id)) throw new Error("Falta pago o comprobante aceptado");confirmarDireccion(id,args.join(" "));console.log("Dirección guardada"); }
 else if(action==="registrar-guia") {
  const [tracking,carrier,service,costText,pdfPath]=args;
  const existing=obtenerEnvios(id);const address=existing.addresses.find(a=>a.status==="confirmada")?.address;
  if((!existing.payment && !db.prepare('SELECT 1 FROM accepted_payment_receipts WHERE conversation_id=?').get(id)) || !address) throw new Error("Falta pago o comprobante y dirección confirmada");
  const cost=Number(costText); if(!tracking||!carrier||!service||!Number.isFinite(cost)||cost<0) throw new Error("Datos de guía inválidos");
  registrarGuia({conversationId:id,address,tracking,carrier,service,cost,pdfPath,avisarCliente:true});console.log("Guía guardada; aviso al cliente encolado si aún no se había enviado.");
 } else throw new Error("Acción no reconocida");
}
