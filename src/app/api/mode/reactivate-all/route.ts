import { NextResponse } from "next/server";
import { reactivateAllChats } from "@/lib/db";

export async function POST() {
  return NextResponse.json({ reactivated: reactivateAllChats() });
}
