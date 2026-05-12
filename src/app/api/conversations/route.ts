import { NextResponse } from "next/server";
import { listConversations } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ conversations: listConversations() });
}
