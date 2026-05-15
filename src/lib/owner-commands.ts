import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import {
  getConversationById,
  insertMessage,
  setAiPaused,
  setMode,
} from "./db";
import { botLog } from "./bot-log";

const ownerPhone = process.env.OWNER_ALERT_PHONE?.replace(/\D/g, "") ?? "";

function toJid(phoneOrJid: string): string {
  if (phoneOrJid.includes("@")) return phoneOrJid;
  return `${phoneOrJid.replace(/\D/g, "")}@s.whatsapp.net`;
}

function jidToDigits(jid: string): string {
  return jid.split("@")[0]?.split(":")[0]?.replace(/\D/g, "") ?? "";
}

function isOwnerJid(jid: string): boolean {
  if (!ownerPhone) return false;
  const digits = jidToDigits(jid);
  return digits === ownerPhone || digits.endsWith(ownerPhone.slice(-10));
}

async function replyToOwner(
  sock: WASocket,
  ownerJid: string,
  text: string,
): Promise<void> {
  await sock.sendMessage(ownerJid, { text });
}

export async function tryHandleOwnerCommand(
  sock: WASocket,
  msg: WAMessage,
  text: string,
): Promise<boolean> {
  const ownerJid = msg.key.remoteJid;
  if (!ownerJid || !text.trim().startsWith("/")) return false;

  if (!isOwnerJid(ownerJid)) {
    botLog("[bot] Comando ignorado: remitente no autorizado", { ownerJid });
    return false;
  }

  const trimmed = text.trim();
  const [commandRaw, idRaw, ...rest] = trimmed.split(/\s+/);
  const command = commandRaw.toLowerCase();

  if (command === "/pausar") {
    setAiPaused(true);
    await replyToOwner(sock, ownerJid, "IA pausada globalmente.");
    return true;
  }

  if (command === "/activar") {
    setAiPaused(false);
    await replyToOwner(sock, ownerJid, "IA activada globalmente.");
    return true;
  }

  const conversationId = Number(idRaw);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    await replyToOwner(
      sock,
      ownerJid,
      "Comando invalido. Usa /responder ID mensaje, /humano ID o /ia ID.",
    );
    return true;
  }

  const conversation = getConversationById(conversationId);
  if (!conversation) {
    await replyToOwner(sock, ownerJid, `No encontre conversacion ${conversationId}.`);
    return true;
  }

  if (command === "/humano") {
    setMode(conversationId, "HUMAN");
    await replyToOwner(sock, ownerJid, `Conversacion ${conversationId} en HUMAN.`);
    return true;
  }

  if (command === "/ia") {
    setMode(conversationId, "AI");
    await replyToOwner(sock, ownerJid, `Conversacion ${conversationId} en AI.`);
    return true;
  }

  if (command === "/responder") {
    const content = rest.join(" ").trim();
    if (!content) {
      await replyToOwner(sock, ownerJid, "Escribe el mensaje: /responder ID texto");
      return true;
    }

    await sock.sendMessage(toJid(conversation.phone), { text: content });
    insertMessage(conversationId, "human", content);
    setMode(conversationId, "HUMAN");
    await replyToOwner(sock, ownerJid, `Enviado a conversacion ${conversationId}.`);
    return true;
  }

  await replyToOwner(
    sock,
    ownerJid,
    "Comando no reconocido. Usa /responder, /humano, /ia, /pausar o /activar.",
  );
  return true;
}
