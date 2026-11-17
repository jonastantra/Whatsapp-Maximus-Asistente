// Para pedidos con envío, la IA no verifica por sí misma la tarifa ni la autorización de pago.
export function bloquearCobroNoVerificado(response: string, history: {role:string;content:string}[]): boolean {
  const shipping = /env[ií]o|enviar|mandar(?:lo|me)?|paqueter[ií]a|c[oó]digo postal|\bcp\b/i.test(history.slice(-20).map(m => m.content).join(' '));
  if (!shipping) return false;
  const payment = /\bclabe\b|\bbbva\b|\bcuenta bancaria\b|\bdatos (?:del |de )?pago\b|\btarjeta para\b/i.test(response);
  const amount = /\$\s*\d|\d[\d,.]*\s*(?:pesos|mxn)\b/i.test(response);
  const shippingOrTotal = /env[ií]o|paqueter[ií]a|\btotal\b/i.test(response);
  return payment || (amount && shippingOrTotal);
}

export function promocionVigente(content: string, enabled: boolean, fecha: string): boolean {
  const expiry = content.match(/\[vigente-hasta:(\d{4}-\d{2}-\d{2})\]/i)?.[1];
  return enabled && !!content.trim() && (!expiry || fecha <= expiry);
}

function importes(text: string): string[] {
  return [...text.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)|\b([\d,]+(?:\.\d{1,2})?)\s*(?:pesos|mxn)\b|(?:cuesta|precio|total)\s*(?:de|es|en|:)?\s*([\d,]+(?:\.\d{1,2})?)/gi)]
    .map(m => String(Number((m[1] || m[2] || m[3]).replace(/,/g, ""))));
}

export function precioNoRegistrado(response: string, fuentes: string[]): boolean {
  const allowed = new Set(fuentes.flatMap(importes));
  return importes(response).some(amount => !allowed.has(amount));
}
