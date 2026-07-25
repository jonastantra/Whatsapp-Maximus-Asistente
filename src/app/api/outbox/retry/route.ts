import { NextResponse } from "next/server";
import { retryOutboxForMessage } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    messageId?: unknown;
  } | null;
  const messageId = Number(body?.messageId);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return NextResponse.json({ error: "Mensaje inválido." }, { status: 400 });
  }
  if (!retryOutboxForMessage(messageId)) {
    return NextResponse.json(
      { error: "El mensaje no está en estado fallido." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
