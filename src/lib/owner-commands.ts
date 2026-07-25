import type { WASocket, WAMessage } from "baileys";
import {
  enqueueOutbox,
  getConversationByAddress,
  getConversationById,
  getOrCreateConversation,
  insertMessage,
  setAiPaused,
  setMode,
  type Conversation,
} from "./db";
import { botLog } from "./bot-log";
import { isAuthorizedAddress } from "./whatsapp-identity";

const ownerPhone = process.env.OWNER_ALERT_PHONE?.replace(/\D/g, "") ?? "";

async function replyToOwner(
  conversation: Conversation,
  text: string,
): Promise<void> {
  const messageId = insertMessage(conversation.id, "assistant", text);
  enqueueOutbox(
    conversation.id,
    conversation.phone,
    text,
    messageId,
  );
}

export async function tryHandleOwnerCommand(
  _sock: WASocket,
  msg: WAMessage,
  text: string,
): Promise<boolean> {
  const ownerJid = msg.key.remoteJid;
  if (!ownerJid || !text.trim().startsWith("/")) return false;

  if (
    !isAuthorizedAddress(
      {
        remoteJid: ownerJid,
        remoteJidAlt: msg.key.remoteJidAlt,
      },
      ownerPhone,
    )
  ) {
    botLog("[bot] Comando ignorado: remitente no autorizado", {
      ownerJid,
      remoteJidAlt: msg.key.remoteJidAlt,
    });
    return false;
  }

  const ownerConversation =
    getConversationByAddress(ownerJid) ??
    (msg.key.remoteJidAlt
      ? getConversationByAddress(msg.key.remoteJidAlt)
      : null) ??
    getOrCreateConversation(ownerJid, msg.pushName, msg.key.remoteJidAlt);
  insertMessage(ownerConversation.id, "user", text);

  const trimmed = text.trim();
  const [commandRaw, idRaw, ...rest] = trimmed.split(/\s+/);
  const command = commandRaw.toLowerCase();

  if (command === "/pausar") {
    setAiPaused(true);
    await replyToOwner(ownerConversation, "IA pausada globalmente.");
    return true;
  }

  if (command === "/activar") {
    setAiPaused(false);
    await replyToOwner(ownerConversation, "IA activada globalmente.");
    return true;
  }

  const conversationId = Number(idRaw);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    await replyToOwner(
      ownerConversation,
      "Comando invalido. Usa /responder ID mensaje, /humano ID o /ia ID.",
    );
    return true;
  }

  const conversation = getConversationById(conversationId);
  if (!conversation) {
    await replyToOwner(ownerConversation, `No encontre conversacion ${conversationId}.`);
    return true;
  }

  if (command === "/humano") {
    setMode(conversationId, "HUMAN");
    await replyToOwner(ownerConversation, `Conversacion ${conversationId} en HUMAN.`);
    return true;
  }

  if (command === "/ia") {
    setMode(conversationId, "AI");
    await replyToOwner(ownerConversation, `Conversacion ${conversationId} en AI.`);
    return true;
  }

  if (command === "/responder") {
    const content = rest.join(" ").trim();
    if (!content) {
      await replyToOwner(
        ownerConversation,
        "Escribe el mensaje: /responder ID texto",
      );
      return true;
    }

    const messageId = insertMessage(conversationId, "human", content);
    enqueueOutbox(
      conversationId,
      conversation.phone,
      content,
      messageId,
    );
    setMode(conversationId, "HUMAN");
    await replyToOwner(
      ownerConversation,
      `Respuesta encolada para conversacion ${conversationId}.`,
    );
    return true;
  }

  await replyToOwner(
    ownerConversation,
    "Comando no reconocido. Usa /responder, /humano, /ia, /pausar o /activar.",
  );
  return true;
}
