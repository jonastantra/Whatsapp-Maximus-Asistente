import type { WASocket, WAMessage } from "baileys";
import {
  enqueueOutbox,
  enqueueAiReplyIfCurrent,
  getBotSettings,
  getActivePromotion,
  searchRelevantCatalog,
  getConversationById,
  getOrCreateConversation,
  getRecentHistory,
  hasRecentMessageWithContent,
  insertMessage,
  insertInboundTextOnce,
  registerUncaptionedImage,
  imageMessageIdForEvent,
  setMode,
} from "../db";
import { botLog } from "../bot-log";
import { generateReply } from "../openrouter";
import { replyWithRecovery, subscriptionFallback } from "../respaldo-suscripcion";
import { getHumanHandoff, getOwnerAlertReason, notifyOwner } from "../alerts";
import { tryHandleOwnerCommand } from "../owner-commands";
import { bloquearCobroNoVerificado, precioNoRegistrado, promocionVigente } from "../seguridad-respuesta";
import { textoEstadoCitado } from "../contexto-estado";
import { consultaHorario, respuestaHorario } from "../horario-sucursal";
import { guardarImagenWhatsApp } from "../imagenes-whatsapp";
import {
  alternateJid,
} from "../whatsapp-identity";

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

function containsImage(msg: WAMessage): boolean {
  const inner = msg.message?.ephemeralMessage?.message ?? msg.message?.viewOnceMessage?.message ?? msg.message?.viewOnceMessageV2?.message ?? msg.message?.viewOnceMessageV2Extension?.message ?? msg.message;
  return !!inner?.imageMessage;
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
    const inner = msg.message?.ephemeralMessage?.message ?? msg.message?.viewOnceMessage?.message ?? msg.message?.viewOnceMessageV2?.message ?? msg.message?.viewOnceMessageV2Extension?.message ?? msg.message;
    if (inner?.imageMessage && msg.key.id) {
      const conversation = getOrCreateConversation(remoteJid, msg.key.fromMe ? undefined : msg.pushName, alternateJid({ remoteJid, remoteJidAlt: msg.key.remoteJidAlt }));
      const timestamp = Number(msg.messageTimestamp ?? 0);
      const age = Math.floor(Date.now() / 1000) - timestamp;
      const fresh = Number.isFinite(timestamp) && timestamp > 0 && age >= -120 && age <= 900;
      const shouldAlert = !msg.key.fromMe && fresh && conversation.mode === "AI" && getBotSettings().ai_paused !== 1;
      const inserted = registerUncaptionedImage(conversation.id, remoteJid, msg.key.id, !!msg.key.fromMe, fresh);
      const savedMessageId = inserted ? imageMessageIdForEvent(msg.key.id) : null;
      if (fresh && savedMessageId) void guardarImagenWhatsApp(savedMessageId, msg).catch(() => botLog("[bot] No se pudo guardar imagen; el mensaje se conserva."));
      if (inserted && shouldAlert) void notifyOwner(sock, remoteJid, msg.pushName, "El cliente envió una imagen; revísala en el panel.", "imagen", conversation.id);
      botLog("[bot] Imagen sin texto registrada; respuesta sujeta a modo y vigencia.");
      return;
    }
    botLog(`[bot] Mensaje ignorado: sin texto de ${remoteJid}`, {
      id: msg.key.id,
      messageKeys: msg.message ? Object.keys(msg.message) : [],
    });
    return;
  }

  const otherJid = alternateJid({
    remoteJid,
    remoteJidAlt: msg.key.remoteJidAlt,
  });
  const phone = extractPhone(remoteJid);
  botLog(`[bot] ← Mensaje de ${phone}: "${text}"`, {
    remoteJid,
    remoteJidAlt: msg.key.remoteJidAlt,
    fromMe: msg.key.fromMe,
  });

  if (await tryHandleOwnerCommand(sock, msg, text)) {
    return;
  }

  // En mensajes propios pushName es el nombre de la cuenta («Maximus Inc»); no debe pisar el nombre del cliente.
  const conversation = getOrCreateConversation(phone, msg.key.fromMe ? undefined : msg.pushName, otherJid);

  if (msg.key.fromMe) {
    const alreadySaved = hasRecentMessageWithContent(
      conversation.id,
      ["human", "assistant"],
      text,
      180,
    );

    if (alreadySaved) {
      if (hasRecentMessageWithContent(conversation.id, ["human"], text, 180)) {
        setMode(conversation.id, "HUMAN");
      }
      botLog(`[bot] Mensaje propio ya registrado para ${phone}.`);
      return;
    }

    const humanMessageId = insertMessage(conversation.id, "human", text);
    if (containsImage(msg)) void guardarImagenWhatsApp(humanMessageId,msg).catch(() => botLog("[bot] No se pudo guardar imagen enviada."));
    setMode(conversation.id, "HUMAN");
    botLog(`[bot] Mensaje propio guardado como HUMANO para ${phone}: "${text}"`);
    return;
  }

  const estado = textoEstadoCitado(msg);
  const textWithContext = estado
    ? estado.texto
      ? `[El cliente respondió a un estado de WhatsApp (${estado.tipo}). Texto del estado citado, como referencia no verificada: ${JSON.stringify(estado.texto)}]\nMensaje del cliente: ${text}`
      : `[El cliente respondió a un estado de WhatsApp (${estado.tipo} sin texto).]\nMensaje del cliente: ${text}`
    : text;
  if (estado) botLog(`[bot] Respuesta a estado (${estado.tipo}) de ${phone}.`);
  const inboundMessageId = insertInboundTextOnce(conversation.id, msg.key.id, textWithContext);
  if (inboundMessageId === null) {
    botLog(`[bot] Mensaje repetido de ${phone}; ya estaba guardado, no se contesta otra vez.`);
    return;
  }
  if (containsImage(msg)) void guardarImagenWhatsApp(inboundMessageId,msg).catch(() => botLog("[bot] No se pudo guardar imagen recibida."));

  const currentSettings = getBotSettings();
  const currentConversation = getConversationById(conversation.id);
  if (currentSettings.ai_paused === 1 || !currentConversation || currentConversation.mode !== "AI") {
    botLog(`[bot] IA pausada o chat en modo HUMANO; no responder automáticamente.`);
    return;
  }

  if (containsImage(msg)) {
    const safe = "Gracias, recibimos tu imagen. Un asesor la revisará y te ayudará por aquí.";
    if (enqueueAiReplyIfCurrent(conversation.id,inboundMessageId,remoteJid,safe)) {
      setMode(conversation.id,"HUMAN");
      void notifyOwner(sock,remoteJid,msg.pushName,"El cliente envió una imagen con este mensaje: " + text,"imagen",conversation.id);
    }
    return;
  }

  const handoff = getHumanHandoff(text);
  if (consultaHorario(text) && !["salud", "postventa", "pago"].includes(handoff?.reason ?? "")) {
    enqueueAiReplyIfCurrent(conversation.id,inboundMessageId,remoteJid,respuestaHorario());
    return;
  }

  if (handoff) {
    const messageId = insertMessage(
      conversation.id,
      "assistant",
      handoff.reply,
    );
    enqueueOutbox(
      conversation.id,
      remoteJid,
      handoff.reply,
      messageId,
    );
    setMode(conversation.id, "HUMAN");
    void notifyOwner(
      sock,
      remoteJid,
      msg.pushName,
      text,
      handoff.reason,
      conversation.id,
    );
    botLog(`[bot] Chat ${phone} derivado a HUMANO (${handoff.reason}).`);
    return;
  }

  const alertReason = getOwnerAlertReason(text);
  if (alertReason) {
    void notifyOwner(
      sock,
      remoteJid,
      msg.pushName,
      text,
      alertReason,
      conversation.id,
    );
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

  const response=await replyWithRecovery(()=>generateReply(history,fresh),()=>subscriptionFallback(history));
  botLog(response.usedFallback ? "[bot] Se utilizó respaldo de suscripción sin herramientas." : `[bot] LLM respondió en ${Date.now() - startedAt}ms`);
  const recentQuestions = history.filter(m=>m.role === "user").slice(-3).map(m=>m.content).join(" ");
  const prices = searchRelevantCatalog(recentQuestions, 8).map(item=>item.price);
  const promotion = getActivePromotion();
  const today = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  if (promocionVigente(promotion.content, !!promotion.enabled, today)) prices.push(promotion.content);
  const badPrice = precioNoRegistrado(response.text, prices);
  if (badPrice || bloquearCobroNoVerificado(response.text, history)) {
    const safe = "Para darte el precio y total correctos, un asesor necesita confirmarlos antes del pago.";
    if (enqueueAiReplyIfCurrent(conversation.id,inboundMessageId,remoteJid,safe)) {
      setMode(conversation.id, "HUMAN");
      void notifyOwner(sock,remoteJid,msg.pushName,text,"pedido",conversation.id);
      botLog(badPrice ? "[bot] La IA mencionó un precio fuera del catálogo: derivado a humano." : "[bot] Cobro de envío no verificado: derivado a humano.", { respuestaBloqueada: response.text.slice(0, 300) });
    }
    return;
  }
  if(enqueueAiReplyIfCurrent(conversation.id,inboundMessageId,remoteJid,response.text)) {
    botLog(`[bot] → Respuesta encolada para ${phone}`);
  } else {
    botLog("[bot] Respuesta descartada: el chat cambió o se pausó durante la consulta.");
  }
}
