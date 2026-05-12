import "./env-loader";
import fs from "node:fs";
import path from "node:path";
import { setConnectionState } from "../src/lib/db";
import { startBaileys, type BaileysHandle } from "../src/lib/baileys/client";

const dataDir = path.resolve(process.cwd(), "data");
const authDir = path.resolve(process.cwd(), "auth");
const restartFlag = path.join(dataDir, ".restart");

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
    if (fs.existsSync(restartFlag)) {
      fs.unlinkSync(restartFlag);
    }

    console.log("[bot] Reinicio manual solicitado desde dashboard.");

    if (handle) {
      await handle.shutdown();
      handle = null;
    }

    fs.rmSync(authDir, { recursive: true, force: true });
    setConnectionState({
      status: "disconnected",
      qr_string: null,
      phone: null,
    });

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
  if (fs.existsSync(restartFlag)) {
    void restartClean();
  }
}, 1000);

void start().catch((err) => {
  console.error("[bot] Error fatal:", err);
  process.exit(1);
});
