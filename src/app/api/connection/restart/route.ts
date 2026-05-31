import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { setConnectionState } from "@/lib/db";

export async function POST(request: Request) {
  const dataDir = path.resolve(process.cwd(), "data");
  const body = (await request.json().catch(() => null)) as {
    resetSession?: boolean;
  } | null;
  const resetSession = body?.resetSession === true;

  setConnectionState({
    status: "connecting",
    qr_string: null,
    ...(resetSession ? { phone: null } : {}),
  });

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, ".restart"), "");
  if (resetSession) {
    fs.writeFileSync(path.join(dataDir, ".reset-session"), "");
  }

  return NextResponse.json({ ok: true, resetSession });
}
