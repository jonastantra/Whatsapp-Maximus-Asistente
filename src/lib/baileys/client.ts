import fs from "node:fs";
import path from "node:path";
import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import {
  getConnectionState,
  getPendingOutbox,
  markOutboxSent,
  setConnectionState,
} from "../db";
import { botLog } from "../bot-log";
import { handleIncomingMessage } from "./handler";

export interface BaileysHandle {
  sock: WASocket;
  shutdown: (options?: { logout?: boolean }) => Promise<void>;
}

const authDir = path.resolve(process.cwd(), "auth");
const logger = pino({ level: "silent" });

let handle: BaileysHandle | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let outboxTimer: NodeJS.Timeout | null = null;
let loggedOutReconnectAttempts = 0;
const seenMessageIds = new Set<string>();
const maxLoggedOutReconnectAttempts = 3;

type ReconnectOptions = {
  clearAuth?: boolean;
  delayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function phoneFromUserId(userId?: string | null): string | null {
  if (!userId) return null;
  return userId.split(":")[0]?.split("@")[0] ?? null;
}

function jidFromPhone(phone: string): string {
  if (phone.includes("@")) return phone;
  return `${phone}@s.whatsapp.net`;
}

async function processOutbox(sock: WASocket): Promise<void> {
  const pending = getPendingOutbox(20);

  for (const item of pending) {
    try {
      await sock.sendMessage(jidFromPhone(item.phone), { text: item.content });
      markOutboxSent(item.id);
      botLog(`[bot] → Mensaje humano enviado a ${item.phone}`);
    } catch (err) {
      botLog(`[bot] No se pudo enviar outbox ${item.id}`, {
        error: String(err),
      });
    }
  }
}

async function fetchVersion(): Promise<[number, number, number] | undefined> {
  try {
    const fetched = await fetchLatestBaileysVersion();
    botLog(`[bot] Baileys WA version ${fetched.version.join(".")}`);
    return fetched.version;
  } catch (err) {
    botLog("[bot] No se pudo obtener última versión", { error: String(err) });
    return undefined;
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearOutboxTimer(): void {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }
}

function clearAuthSession(): void {
  fs.rmSync(authDir, { recursive: true, force: true });
}

async function cleanupSocket(): Promise<void> {
  if (!handle) return;

  try {
    handle.sock.end(undefined);
  } catch {
    // Cierre defensivo: Baileys puede estar ya cerrado.
  }

  clearOutboxTimer();
  handle = null;
  await sleep(100);
}

function scheduleReconnect(code?: number, options: ReconnectOptions = {}): void {
  if (reconnectTimer) return;

  const delay = options.delayMs ?? (code === 440 ? 15000 : 5000);
  botLog(`[bot] Reconectando en ${delay / 1000}s (code=${code ?? "n/a"})`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void (async () => {
      try {
        await cleanupSocket();

        if (options.clearAuth) {
          clearAuthSession();
        }

        setConnectionState({
          status: "connecting",
          qr_string: null,
          ...(options.clearAuth ? { phone: null } : {}),
        });
        await startBaileys();
      } catch (err) {
        botLog("[bot] Falló el reconector", { error: String(err) });
        scheduleReconnect(code, options);
      }
    })();
  }, delay);
}

export async function startBaileys(): Promise<BaileysHandle> {
  clearReconnectTimer();
  clearOutboxTimer();
  await cleanupSocket();

  fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const version = await fetchVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.macOS("Desktop"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  handle = {
    sock,
    shutdown: async (options = {}) => {
      clearReconnectTimer();
      clearOutboxTimer();

      if (options.logout) {
        try {
          await sock.logout();
        } catch {
          // Puede fallar si el socket ya no está autenticado.
        }
      }

      try {
        sock.end(undefined);
      } catch {
        // Cierre defensivo.
      }

      handle = null;
    },
  };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    botLog(`[bot] messages.upsert type=${type} count=${messages.length}`, {
      messages: messages.map((msg) => ({
        id: msg.key.id,
        remoteJid: msg.key.remoteJid,
        fromMe: msg.key.fromMe,
        messageKeys: msg.message ? Object.keys(msg.message) : [],
      })),
    });
    if (type !== "notify" && type !== "append") return;

    for (const msg of messages) {
      const messageId = msg.key.id;
      if (messageId) {
        if (seenMessageIds.has(messageId)) continue;
        seenMessageIds.add(messageId);

        if (seenMessageIds.size > 500) {
          const first = seenMessageIds.values().next().value;
          if (first) seenMessageIds.delete(first);
        }
      }

      void handleIncomingMessage(sock, msg).catch((err) => {
        botLog("[bot] Error manejando mensaje", { error: String(err) });
      });
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      setConnectionState({ status: "qr", qr_string: qr, phone: null });
      botLog("[bot] QR recibido. Escanéalo desde el dashboard.");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "connecting") {
      const current = getConnectionState();
      if (current.status === "disconnected") {
        setConnectionState({ status: "connecting" });
      }
    }

    if (connection === "open") {
      loggedOutReconnectAttempts = 0;
      const phone = phoneFromUserId(sock.user?.id);
      setConnectionState({
        status: "connected",
        qr_string: null,
        phone,
      });
      botLog(`[bot] Conectado${phone ? ` como ${phone}` : ""}`);

      clearOutboxTimer();
      outboxTimer = setInterval(() => {
        void processOutbox(sock);
      }, 2000);
    }

    if (connection === "close") {
      clearOutboxTimer();
      const code = Number(
        (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
          ?.statusCode,
      );

      botLog(`[bot] Conexión cerrada. code=${code || "n/a"}`);

      if (code === DisconnectReason.loggedOut) {
        loggedOutReconnectAttempts += 1;

        if (loggedOutReconnectAttempts <= maxLoggedOutReconnectAttempts) {
          setConnectionState({ status: "connecting", qr_string: null });
          botLog(
            `[bot] WhatsApp devolvio loggedOut. Intento suave ${loggedOutReconnectAttempts}/${maxLoggedOutReconnectAttempts} sin borrar sesion.`,
          );
          scheduleReconnect(code, { delayMs: 10000 });
          return;
        }

        setConnectionState({ status: "connecting", qr_string: null, phone: null });
        botLog(
          "[bot] Sesión invalidada por WhatsApp. Se limpiará auth y se generará QR nuevo.",
        );
        scheduleReconnect(code, { clearAuth: true, delayMs: 3000 });
        return;
      }

      scheduleReconnect(code);
    }
  });

  return handle;
}
