import { NextRequest, NextResponse } from "next/server";
import { getActivePromotion, setActivePromotion } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ promotion: getActivePromotion() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    content?: unknown;
    enabled?: unknown;
  };

  const content = typeof body.content === "string" ? body.content : "";
  const enabled = body.enabled === true;

  return NextResponse.json({
    ok: true,
    promotion: setActivePromotion(content, enabled),
  });
}
