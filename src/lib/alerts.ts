import type { WASocket } from "@whiskeysockets/baileys";
import { botLog } from "./bot-log";

const ownerPhone = process.env.OWNER_ALERT_PHONE;

export type OwnerAlertReason =
  | "pago"
  | "visita"
  | "atencion"
  | "pedido"
  | "salud"
  | "postventa"
  | "mayoreo";

export interface HumanHandoff {
  reason: OwnerAlertReason;
  reply: string;
}

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

export function getHumanHandoff(text: string): HumanHandoff | null {
  const normalized = text ? normalizeText(text) : "";

  const healthKeywords = [
    "irritacion fuerte",
    "me irrito",
    "me arde",
    "alergia",
    "reaccion",
    "mareo",
    "mareos",
    "dolor",
    "palpitaciones",
    "efecto secundario",
    "efectos secundarios",
    "me salio roncha",
    "ronchas",
    "se me hincho",
  ];

  if (includesAny(normalized, healthKeywords)) {
    return {
      reason: "salud",
      reply:
        "Por seguridad, eso prefiero pasarlo con un asesor humano para orientarte mejor. Si hay molestia fuerte, suspende el uso y consulta a un profesional de salud.",
    };
  }

  const postSaleKeywords = [
    "devolucion",
    "devolver",
    "cambio",
    "garantia",
    "reembolso",
    "no llego",
    "no me llego",
    "paquete perdido",
    "reclamo",
    "queja",
    "molesto",
    "enojado",
    "factura",
    "facturacion",
  ];

  if (includesAny(normalized, postSaleKeywords)) {
    return {
      reason: "postventa",
      reply:
        "Claro, para revisarlo bien te paso con un asesor humano. En un momento te apoyan con el seguimiento.",
    };
  }

  const wholesaleKeywords = [
    "mayoreo",
    "distribuidor",
    "revender",
    "revendedor",
    "precio de mayoreo",
    "cuantas piezas",
    "muchas piezas",
  ];

  if (includesAny(normalized, wholesaleKeywords)) {
    return {
      reason: "mayoreo",
      reply:
        "Claro, para mayoreo conviene que te atienda un asesor humano y te confirme precio por volumen. En un momento te apoyan.",
    };
  }

  const paymentHandoffKeywords = [
    "ya pague",
    "ya deposite",
    "ya transferi",
    "mande comprobante",
    "mando comprobante",
    "envio comprobante",
    "te mando comprobante",
    "te envio comprobante",
    "voy a pagar",
    "voy a depositar",
    "voy a transferir",
    "hare deposito",
    "hago deposito",
    "hare transferencia",
    "hago transferencia",
  ];

  if (includesAny(normalized, paymentHandoffKeywords)) {
    return {
      reason: "pago",
      reply:
        "Perfecto. Para confirmar tu pago y darle seguimiento, te paso con un asesor humano. Si ya tienes comprobante, mandalo por aqui.",
    };
  }

  const pickupReason = getOwnerAlertReason(text);
  if (pickupReason === "visita") {
    return {
      reason: "visita",
      reply:
        "Va, para coordinar bien la entrega y no hacerte dar vuelta, te paso con un asesor humano. En un momento te confirman.",
    };
  }

  if (pickupReason === "atencion") {
    return {
      reason: "atencion",
      reply:
        "Claro, te paso con un asesor humano para que te apoye mejor. En un momento te atienden.",
    };
  }

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
          : reason === "salud"
            ? "tema de salud, irritacion o posible efecto secundario"
            : reason === "postventa"
              ? "postventa, factura, garantia, cambio, reclamo o seguimiento"
              : reason === "mayoreo"
                ? "consulta de mayoreo o volumen"
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
