import type { WASocket } from "@whiskeysockets/baileys";
import { botLog } from "./bot-log";

const ownerPhone = process.env.OWNER_ALERT_PHONE;

type OwnerAlertReason = "pago" | "visita" | "atencion" | "pedido";

function toJid(phoneOrJid: string): string {
  if (phoneOrJid.includes("@")) return phoneOrJid;
  return `${phoneOrJid.replace(/\D/g, "")}@s.whatsapp.net`;
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function getOwnerAlertReason(text: string): OwnerAlertReason | null {
  const normalized = text
    ? normalizeText(text)
    : "";

  const paymentKeywords = [
    "pago",
    "pagar",
    "deposito",
    "depositar",
    "transferencia",
    "transferir",
    "cuenta",
    "clabe",
    "tarjeta",
    "link de pago",
    "enlace de pago",
    "comprobante",
    "ya pague",
    "ya transferi",
    "voy a transferir",
    "voy a depositar",
  ];

  if (includesAny(normalized, paymentKeywords)) return "pago";

  const pickupDirectPhrases = [
    "voy a pasar",
    "voy a ir",
    "voy para alla",
    "voy en camino",
    "ya voy",
    "paso hoy",
    "paso en",
    "paso al rato",
    "paso mas tarde",
    "paso por",
    "pasare",
    "puedo pasar",
    "puedo ir",
    "a que hora paso",
    "a que hora puedo pasar",
    "lo recojo",
    "lo paso a recoger",
    "paso a recoger",
    "me doy una vuelta",
    "me lanzo",
    "llego en",
    "ahi voy",
    "nos vemos",
    "apartame",
    "apartamelo",
    "reservame",
    "guardame",
  ];

  const pickupIntentKeywords = [
    "pasar",
    "paso",
    "voy",
    "ir",
    "recojo",
    "recoger",
    "apartar",
    "apartame",
    "reservar",
    "guardame",
    "llego",
  ];

  const pickupLocationKeywords = [
    "neza",
    "nesa",
    "guelatao",
    "guetado",
    "gatado",
    "qegatado",
    "plaza guelatao",
    "metro guelatao",
    "metro de guelatao",
    "oriente 10",
    "local 76",
    "taquillas",
    "santa martha",
    "santa marta",
    "metro santa martha",
    "metro santa marta",
    "la palma",
    "chabacano",
  ];

  if (
    includesAny(normalized, pickupDirectPhrases) ||
    (includesAny(normalized, pickupIntentKeywords) &&
      includesAny(normalized, pickupLocationKeywords))
  ) {
    return "visita";
  }

  const attentionKeywords = [
    "asesor",
    "humano",
    "atencion",
  ];

  if (includesAny(normalized, attentionKeywords)) return "atencion";

  const orderKeywords = [
    "quiero comprar",
    "me interesa",
    "lo quiero",
    "pedido",
  ];

  if (includesAny(normalized, orderKeywords)) return "pedido";

  return null;
}

export function shouldAlertOwner(text: string): boolean {
  return getOwnerAlertReason(text) !== null;
}

export async function notifyOwner(
  sock: WASocket,
  customerJid: string,
  customerName: string | null | undefined,
  text: string,
  reason: OwnerAlertReason | null = null,
): Promise<void> {
  if (!ownerPhone) return;

  const reasonText =
    reason === "pago"
      ? "posible pago, deposito, transferencia o comprobante"
      : reason === "visita"
        ? "cliente posiblemente va a pasar o recoger en sucursal/punto de entrega"
        : reason === "pedido"
          ? "posible pedido o compra"
          : reason === "atencion"
            ? "solicita atencion humana"
            : "posible pago, pedido o atencion humana";

  const message = [
    "Atencion requerida en WhatsApp Maximus.",
    `Cliente: ${customerName || "Sin nombre"}`,
    `Chat: ${customerJid}`,
    `Mensaje: ${text}`,
    "",
    `Motivo: ${reasonText}.`,
  ].join("\n");

  try {
    await sock.sendMessage(toJid(ownerPhone), { text: message });
    botLog("[bot] Aviso enviado al owner", { ownerPhone, customerJid });
  } catch (err) {
    botLog("[bot] No se pudo avisar al owner", {
      error: String(err),
      ownerPhone,
      customerJid,
    });
  }
}
