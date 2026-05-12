import "./env-loader";
import fs from "node:fs";
import path from "node:path";
import { getConnectionState, setConnectionState } from "../src/lib/db";
import { startBaileys, type BaileysHandle } from "../src/lib/baileys/client";

const dataDir = path.resolve(process.cwd(), "data");
const authDir = path.resolve(process.cwd(), "auth");
const restartFlag = path.join(dataDir, ".restart");
const resetSessionFlag = path.join(dataDir, ".reset-session");

fs.mkdirSync(dataDir, { recursive: true });

let handle: BaileysHandle | null = null;
let restarting = false;

async function start(): Promise<void> {
  console.log("[bot] Iniciando cliente Baileys...");
  setConnectionState({ status: "connecting" });
  handle = await startBaileys();
}

async function restartClean(): Promise<void> {
  if (restarting) return;
  restarting = true;

  try {
    const shouldResetSession = fs.existsSync(resetSessionFlag);

    if (fs.existsSync(restartFlag)) {
      fs.unlinkSync(restartFlag);
    }

    if (shouldResetSession) {
      fs.unlinkSync(resetSessionFlag);
    }

    console.log(
      shouldResetSession
        ? "[bot] Reset de sesión solicitado desde dashboard."
        : "[bot] Reinicio suave solicitado desde dashboard.",
    );

    if (handle) {
      await handle.shutdown({ logout: shouldResetSession });
      handle = null;
    }

    if (shouldResetSession) {
      fs.rmSync(authDir, { recursive: true, force: true });
      setConnectionState({
        status: "disconnected",
        qr_string: null,
        phone: null,
      });
    } else {
      setConnectionState({ status: "connecting" });
    }

    await start();
  } catch (err) {
    console.error("[bot] Error reiniciando:", err);
  } finally {
    restarting = false;
  }
}

process.on("SIGINT", async () => {
  console.log("[bot] Cerrando por SIGINT...");
  if (handle) await handle.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[bot] Cerrando por SIGTERM...");
  if (handle) await handle.shutdown();
  process.exit(0);
});

setInterval(() => {
  if (fs.existsSync(restartFlag) || fs.existsSync(resetSessionFlag)) {
    void restartClean();
  }
}, 1000);

setInterval(() => {
  if (restarting || handle) return;

  const state = getConnectionState();
  if (state.status === "disconnected") {
    console.log("[bot] Watchdog: estado disconnected sin handle, reintentando.");
    void start().catch((err) => {
      console.error("[bot] Watchdog falló:", err);
    });
  }
}, 10000);

void start().catch((err) => {
  console.error("[bot] Error fatal:", err);
  process.exit(1);
});
