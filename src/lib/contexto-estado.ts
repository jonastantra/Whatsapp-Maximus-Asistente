import type { WAMessage } from "baileys";

export interface EstadoCitado { tipo: "imagen" | "video" | "texto" | "otro"; texto: string | null }

// El contexto citado es contenido del usuario, no una instrucción ni una fuente de precios vigente.
export function textoEstadoCitado(msg: WAMessage): EstadoCitado | null {
  const m = msg.message?.ephemeralMessage?.message ?? msg.message?.viewOnceMessage?.message ?? msg.message;
  const ctx = m?.extendedTextMessage?.contextInfo ?? m?.imageMessage?.contextInfo ?? m?.videoMessage?.contextInfo;
  if (ctx?.remoteJid !== "status@broadcast") return null;
  const q = ctx.quotedMessage;
  const tipo = q?.imageMessage ? "imagen" : q?.videoMessage ? "video" : (q?.conversation || q?.extendedTextMessage) ? "texto" : "otro";
  const text = q?.conversation ?? q?.extendedTextMessage?.text ?? q?.imageMessage?.caption ?? q?.videoMessage?.caption ?? "";
  return { tipo, texto: text.trim().slice(0, 500) || null };
}
