import OpenAI from "openai";
import type { Message } from "./db";
import { SYSTEM_PROMPT } from "./system-prompt";

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

const client = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function generateReply(history: Message[]): Promise<string> {
  if (!apiKey || apiKey === "sk-or-...") {
    return 'Déjame derivarte con un asesor humano.';
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((message) => ({
      role:
        message.role === "user"
          ? ("user" as const)
          : ("assistant" as const),
      content: message.content,
    })),
  ];

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.4,
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    "Déjame derivarte con un asesor humano."
  );
}
