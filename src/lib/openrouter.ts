import OpenAI from "openai";
import { getActivePromotion, type Message } from "./db";
import { SYSTEM_PROMPT } from "./system-prompt";

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

const client = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

function buildSystemPrompt(): string {
  const sections = [
    [
      "INSTRUCCION CRITICA DE IDIOMA:",
      "Responde SIEMPRE en español natural de México.",
      "No uses chino, inglés ni mezcla de idiomas.",
      "No incluyas caracteres chinos, símbolos raros ni texto en otro alfabeto.",
      "Si el modelo piensa en otro idioma, traduce internamente y entrega solo español claro.",
    ].join("\n"),
    SYSTEM_PROMPT,
  ];

  if (process.env.PAYMENT_INFO_TEXT) {
    sections.push(
      [
        "Informacion de pago configurada:",
        process.env.PAYMENT_INFO_TEXT,
        "Reglas de pago:",
        "- Cuando el cliente pida cuenta, transferencia, deposito, CLABE, tarjeta o link de pago, comparte esta informacion de pago de forma clara.",
        "- Indica que envie su comprobante por WhatsApp despues de pagar.",
        "- Si el cliente confirma que va a pagar o ya pago, responde que un asesor dara seguimiento.",
      ].join("\n"),
    );
  }

  if (process.env.PAYMENT_EXTRA_INSTRUCTIONS) {
    sections.push(process.env.PAYMENT_EXTRA_INSTRUCTIONS);
  }

  const promotion = getActivePromotion();
  if (promotion.enabled && promotion.content.trim()) {
    sections.push(
      [
        "PROMOCION ACTIVA EN VIVO:",
        promotion.content.trim(),
        "Reglas de promocion:",
        "- Esta promocion tiene prioridad sobre precios o paquetes anteriores si aplica al producto preguntado.",
        "- Usala de forma natural para cerrar ventas.",
        "- Si el cliente pregunta por promociones, menciona esta primero.",
        "- Si la promocion no aplica al producto que pregunta, no la fuerces.",
      ].join("\n"),
    );
  }

  return sections.join("\n\n");
}

export async function generateReply(history: Message[]): Promise<string> {
  if (!apiKey || apiKey === "sk-or-...") {
    return 'Déjame derivarte con un asesor humano.';
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt() },
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
