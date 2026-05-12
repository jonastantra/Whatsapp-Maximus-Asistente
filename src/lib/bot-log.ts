import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const logPath = path.join(dataDir, "bot-events.log");

export function botLog(message: string, data?: unknown): void {
  fs.mkdirSync(dataDir, { recursive: true });

  const suffix = data === undefined ? "" : ` ${JSON.stringify(data)}`;
  const line = `[${new Date().toISOString()}] ${message}${suffix}\n`;

  fs.appendFileSync(logPath, line, "utf-8");
  console.log(message, data ?? "");
}
