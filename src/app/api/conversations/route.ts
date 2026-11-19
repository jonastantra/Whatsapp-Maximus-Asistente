import { NextRequest, NextResponse } from "next/server";
import { listConversations, searchConversationIds } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (q !== null) return NextResponse.json({ ids: searchConversationIds(q) }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ conversations: listConversations() });
}
