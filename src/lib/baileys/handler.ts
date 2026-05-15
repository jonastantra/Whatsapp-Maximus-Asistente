import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import {
  getBotSettings,
  getConversationById,
  getOrCreateConversation,
  getRecentHistory,
  hasRecentMessageWithContent,
  insertMessage,
  setMode,
} from "../db";
import { botLog } from "../bot-log";
import { generateReply } from "../openrouter";
import { getHumanHandoff, getOwnerAlertReason, notifyOwner } from "../alerts";

function extractText(msg: WAMessage): string | null {
  const message =
    msg.message?.ephemeralMessage?.message ??
    msg.message?.viewOnceMessage?.message ??
    msg.message?.viewOnceMessageV2?.message ??
    msg.message?.viewOnceMessageV2Extension?.message ??
    msg.message;

  return (
    message?.conversation?.trim() ||
    message?.extendedTextMessage?.text?.trim() ||
    message?.imageMessage?.caption?.trim() ||
    message?.videoMessage?.caption?.trim() ||
    null
  );
}

function extractPhone(remoteJid: string): string {
  return remoteJid;
}

function isPrivateChatJid(remoteJid: string): boolean {
  return (
    remoteJid.endsWith("@s.whatsapp.net") ||
    remoteJid.endsWith("@lid")
  );
}

export async function handleIncomingMessage(
  sock: WASocket,
  msg: WAMessage,
): Promise<void> {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) {
    botLog("[bot] Mensaje ignorado: remoteJid vacío", {
      id: msg.key.id,
      fromMe: msg.key.fromMe,
    });
    return;
  }
  if (remoteJid.endsWith("@g.us")) {
    botLog(`[bot] Mensaje ignorado: grupo ${remoteJid}`);
    return;
  }
  if (!isPrivateChatJid(remoteJid)) {
    botLog(`[bot] Mensaje ignorado: JID no soportado ${remoteJid}`, {
      id: msg.key.id,
      messageKeys: msg.message ? Object.keys(msg.message) : [],
    });
    return;
  }

  const text = extractText(msg);
  if (!text) {
    botLog(`[bot] Mensaje ignorado: sin texto de ${remoteJid}`, {
      id: msg.key.id,
      messageKeys: msg.message ? Object.keys(msg.message) : [],
    });
    return;
  }

  const phone = extractPhone(remoteJid);
  botLog(`[bot] ← Mensaje de ${phone}: "${text}"`);

  const conversation = getOrCreateConversation(phone, msg.pushName);

  if (msg.key.fromMe) {
    const alreadySaved = hasRecentMessageWithContent(
      conversation.id,
      ["human", "assistant"],
      text,
      180,
    );

    if (alreadySaved) {
      botLog(`[bot] Mensaje propio ya registrado para ${phone}.`);
      return;
    }

    insertMessage(conversation.id, "human", text);
    botLog(`[bot] Mensaje propio guardado como HUMANO para ${phone}: "${text}"`);
    return;
  }

  insertMessage(conversation.id, "user", text);

  const handoff = getHumanHandoff(text);
  if (handoff) {
    insertMessage(conversation.id, "assistant", handoff.reply);
    await sock.sendMessage(remoteJid, { text: handoff.reply });
    setMode(conversation.id, "HUMAN");
    void notifyOwner(sock, remoteJid, msg.pushName, text, handoff.reason);
    botLog(`[bot] Chat ${phone} derivado a HUMANO (${handoff.reason}).`);
    return;
  }

  const alertReason = getOwnerAlertReason(text);
  if (alertReason) {
    void notifyOwner(sock, remoteJid, msg.pushName, text, alertReason);
  }

  const settings = getBotSettings();
  if (settings.ai_paused === 1) {
    botLog(`[bot] IA pausada globalmente. No responde a ${phone}.`);
    return;
  }

  const fresh = getConversationById(conversation.id);
  if (!fresh || fresh.mode !== "AI") {
    botLog(`[bot] Chat ${phone} está en modo HUMANO. No responde IA.`);
    return;
  }

  const history = getRecentHistory(conversation.id, 20);
  const startedAt = Date.now();
  botLog(`[bot] llamando LLM con ${history.length} mensajes...`);

  const reply = await generateReply(history);
  botLog(`[bot] LLM respondió en ${Date.now() - startedAt}ms`);

  insertMessage(conversation.id, "assistant", reply);
  await sock.sendMessage(remoteJid, { text: reply });
  botLog(`[bot] → Enviado a ${phone}`);
}
