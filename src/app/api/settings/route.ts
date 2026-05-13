import { NextRequest, NextResponse } from "next/server";
import { getBotSettings, setAiPaused } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ settings: getBotSettings() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { aiPaused?: unknown };

  if (typeof body.aiPaused !== "boolean") {
    return NextResponse.json(
      { error: "aiPaused debe ser boolean" },
      { status: 400 },
    );
  }

  return NextResponse.json({ settings: setAiPaused(body.aiPaused) });
}
