import OpenAI from "openai";
import {
  getActivePromotion,
  getBotSettings,
  searchRelevantCatalog,
  type CatalogItem,
  type Message,
} from "./db";
import { SYSTEM_PROMPT } from "./system-prompt";

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

const client = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

function latestUserText(history: Message[]): string {
  return [...history].reverse().find((message) => message.role === "user")
    ?.content ?? "";
}

function formatCatalogItems(items: CatalogItem[]): string {
  return items
    .map((item) => {
      const details = [
        `- ${item.name}: ${item.price}`,
        item.active === 0 ? "confirmar disponibilidad" : "",
        item.notes ? item.notes : "",
      ].filter(Boolean);
      return details.join(" | ");
    })
    .join("\n");
}

function buildSystemPrompt(history: Message[]): string {
  const settings = getBotSettings();
  const businessPrompt = settings.custom_prompt?.trim() || SYSTEM_PROMPT;
  const userText = latestUserText(history);
  const sections = [
    [
      "INSTRUCCION CRITICA DE IDIOMA:",
      "Responde SIEMPRE en español natural de México.",
      "No uses chino, inglés ni mezcla de idiomas.",
      "No incluyas caracteres chinos, símbolos raros ni texto en otro alfabeto.",
      "Si el modelo piensa en otro idioma, traduce internamente y entrega solo español claro.",
    ].join("\n"),
    businessPrompt,
  ];

  const relevantCatalog = searchRelevantCatalog(userText, 8);
  if (relevantCatalog.length > 0) {
    sections.push(
      [
        "PRECIOS RELEVANTES DEL CATALOGO:",
        formatCatalogItems(relevantCatalog),
        "Reglas de precios:",
        "- Usa estos precios cuando el cliente pregunte por costo, precio, paquete o disponibilidad.",
        "- No menciones productos que no sean relevantes para la pregunta.",
        "- Si un producto dice confirmar disponibilidad, dilo con naturalidad antes de cerrar venta.",
      ].join("\n"),
    );
  }

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
    { role: "system", content: buildSystemPrompt(history) },
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
