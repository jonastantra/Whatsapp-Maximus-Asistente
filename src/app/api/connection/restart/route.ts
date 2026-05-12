import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { setConnectionState } from "@/lib/db";

export async function POST() {
  const dataDir = path.resolve(process.cwd(), "data");

  setConnectionState({ status: "connecting" });

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, ".restart"), "");

  return NextResponse.json({ ok: true });
}
