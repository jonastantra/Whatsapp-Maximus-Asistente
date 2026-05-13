import { NextRequest, NextResponse } from "next/server";
import { getBotSettings, setCustomPrompt } from "@/lib/db";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";

export async function GET() {
  const settings = getBotSettings();
  const customPrompt = settings.custom_prompt?.trim() ?? "";

  return NextResponse.json({
    prompt: customPrompt || SYSTEM_PROMPT,
    isDefault: !customPrompt,
    updatedAt: settings.updated_at,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { prompt?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt : "";

  if (!prompt.trim()) {
    return NextResponse.json(
      { error: "El prompt no puede estar vacio" },
      { status: 400 },
    );
  }

  const settings = setCustomPrompt(prompt);

  return NextResponse.json({
    ok: true,
    prompt: settings.custom_prompt?.trim() || SYSTEM_PROMPT,
    isDefault: false,
    updatedAt: settings.updated_at,
  });
}
