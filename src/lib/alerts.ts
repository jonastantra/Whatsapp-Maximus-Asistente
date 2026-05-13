import type { WASocket } from "@whiskeysockets/baileys";
import { botLog } from "./bot-log";

const ownerPhone = process.env.OWNER_ALERT_PHONE;

function toJid(phoneOrJid: string): string {
  if (phoneOrJid.includes("@")) return phoneOrJid;
  return `${phoneOrJid.replace(/\D/g, "")}@s.whatsapp.net`;
}

export function shouldAlertOwner(text: string): boolean {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  return [
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
    "asesor",
    "humano",
    "atencion",
    "quiero comprar",
    "me interesa",
    "lo quiero",
    "pedido",
  ].some((keyword) => normalized.includes(keyword));
}

export async function notifyOwner(
  sock: WASocket,
  customerJid: string,
  customerName: string | null | undefined,
  text: string,
): Promise<void> {
  if (!ownerPhone) return;

  const message = [
    "Atencion requerida en WhatsApp Maximus.",
    `Cliente: ${customerName || "Sin nombre"}`,
    `Chat: ${customerJid}`,
    `Mensaje: ${text}`,
    "",
    "Motivo: posible pago, pedido o atencion humana.",
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
