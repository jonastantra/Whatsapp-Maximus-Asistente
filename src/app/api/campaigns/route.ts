import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  createMarketingCampaign,
  listMarketingCampaigns,
  setMarketingCampaignStatus,
} from "@/lib/db";

export const runtime = "nodejs";

type CsvRow = Record<string, string>;

interface LeadDraft {
  phone: string;
  name: string | null;
  checkoutName: string;
  total: string;
  currency: string;
  city: string;
  createdAt: string;
  checkoutUrl: string;
  products: string[];
}

const uploadDir = path.resolve(process.cwd(), "data", "campaign-assets");

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase(),
  );

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    );
  });
}

async function parseLeadFile(file: File): Promise<CsvRow[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), {
      type: "buffer",
    });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) return [];

    return XLSX.utils
      .sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" })
      .map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key.trim().toLowerCase(),
            String(value ?? "").trim(),
          ]),
        ),
      );
  }

  return parseCsv(await file.text());
}

function pick(row: CsvRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key.toLowerCase()];
    if (value?.trim()) return value.trim();
  }

  return "";
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `521${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || "hola";
}

function money(total: string, currency: string): string {
  const parsed = Number(total);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return `$${parsed.toLocaleString("es-MX")} ${currency || "MXN"}`.trim();
}

function shortProductName(product: string): string {
  return (
    product
      .split("|")[0]
      ?.trim()
      .replace(/\s+/g, " ")
      .slice(0, 90) || "tu producto"
  );
}

function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(value)) return `https://${value}`;
  return "";
}

function defaultCampaignMessage(): string {
  return [
    "Hola {nombre}, vimos que dejaste pendiente tu carrito {pedido}.",
    "Te apartamos {producto} por un total de {total}.",
    "Si quieres retomarlo, te puedo ayudar por aqui.",
  ].join("\n");
}

function renderRecipientMessage(template: string, lead: LeadDraft): string {
  const products = lead.products.map(shortProductName);
  const productText =
    products.length > 1
      ? `${products[0]} y ${products.length - 1} producto(s) mas`
      : products[0] || "tu producto";
  const variables: Record<string, string> = {
    nombre: firstName(lead.name),
    nombre_completo: lead.name ?? "",
    pedido: lead.checkoutName,
    producto: productText,
    productos: products.join(", "),
    total: money(lead.total, lead.currency),
    ciudad: lead.city,
    fecha: lead.createdAt,
    link: lead.checkoutUrl,
    checkout_url: lead.checkoutUrl,
  };

  return template.replace(/\{([a-z_]+)\}/gi, (match, key) => {
    return variables[key.toLowerCase()] || match;
  });
}

function buildLeads(rows: CsvRow[]): LeadDraft[] {
  const byPhone = new Map<string, LeadDraft>();

  for (const row of rows) {
    const phone = normalizePhone(
      pick(row, [
        "phone",
        "telefono",
        "teléfono",
        "mobile",
        "shipping phone",
        "billing phone",
        "customer phone",
        "numero",
        "número",
      ]),
    );
    if (!phone) continue;

    const name =
      pick(row, [
        "shipping name",
        "billing name",
        "name",
        "nombre",
        "customer",
        "customer name",
        "first name",
      ]) || null;
    const product = pick(row, ["lineitem name", "product", "producto"]);
    const existing = byPhone.get(phone);

    if (existing) {
      if (product && !existing.products.includes(product)) {
        existing.products.push(product);
      }
      continue;
    }

    byPhone.set(phone, {
      phone,
      name,
      checkoutName: pick(row, ["name", "checkout name", "order name", "id"]),
      total: pick(row, ["total", "subtotal"]),
      currency: pick(row, ["currency"]) || "MXN",
      city: pick(row, ["shipping city", "billing city", "city", "ciudad"]),
      createdAt: pick(row, ["created at", "created_at", "fecha"]),
      checkoutUrl: normalizeUrl(
        pick(row, [
          "abandoned checkout url",
          "checkout url",
          "checkout_url",
          "recovery url",
          "recovery_url",
          "cart url",
          "cart_url",
          "url",
          "link",
          "enlace",
        ]),
      ),
      products: product ? [product] : [],
    });
  }

  return [...byPhone.values()];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nextWindowTimestamp(
  startAt: number,
  startHour: number,
  endHour: number,
): number {
  const date = new Date(startAt * 1000);
  const hour = date.getHours();

  if (hour < startHour) {
    date.setHours(startHour, randomBetween(0, 45), 0, 0);
    return Math.floor(date.getTime() / 1000);
  }

  if (hour >= endHour) {
    date.setDate(date.getDate() + 1);
    date.setHours(startHour, randomBetween(0, 45), 0, 0);
    return Math.floor(date.getTime() / 1000);
  }

  return startAt;
}

function scheduleRecipients(
  recipients: Array<{
    phone: string;
    name: string | null;
    personalizedMessage: string;
  }>,
  durationHours: number,
  startHour: number,
  endHour: number,
  minDelaySeconds: number,
  maxDelaySeconds: number,
): Array<{
  phone: string;
  name: string | null;
  personalizedMessage: string;
  nextSendAt: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const windowSeconds = Math.max(1, endHour - startHour) * 60 * 60;
  const campaignSeconds = Math.max(1, durationHours) * 60 * 60;
  const activeDays = Math.max(1, Math.ceil(campaignSeconds / windowSeconds));
  const totalWindowSeconds = activeDays * windowSeconds;
  const durationStep = Math.max(
    minDelaySeconds,
    Math.floor(totalWindowSeconds / Math.max(1, recipients.length)),
  );

  let cursor = now;

  return recipients.map((recipient, index) => {
    if (index > 0) {
      const configuredDelay = randomBetween(minDelaySeconds, maxDelaySeconds);
      cursor += Math.min(configuredDelay, durationStep);
    }

    return {
      ...recipient,
      nextSendAt: nextWindowTimestamp(cursor, startHour, endHour),
    };
  });
}

export async function GET() {
  return NextResponse.json({ campaigns: listMarketingCampaigns() });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as {
    id?: unknown;
    status?: unknown;
  };
  const id = Number(body.id);
  const status = body.status;

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id invalido" }, { status: 400 });
  }

  if (status !== "active" && status !== "paused") {
    return NextResponse.json(
      { error: "status debe ser active o paused" },
      { status: 400 },
    );
  }

  const campaign = setMarketingCampaignStatus(id, status);
  if (!campaign) {
    return NextResponse.json({ error: "Campana no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, campaign });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const csvFile = form.get("csv");
  const imageFile = form.get("image");
  const name = String(form.get("name") ?? "").trim();
  const message =
    String(form.get("message") ?? "").trim() || defaultCampaignMessage();
  const durationHours = Math.min(
    720,
    Math.max(1, Number(form.get("durationHours") ?? 72)),
  );
  const minDelaySeconds = Math.min(
    86400,
    Math.max(5, Number(form.get("minDelaySeconds") ?? 300)),
  );
  const maxDelaySeconds = Math.min(
    86400,
    Math.max(minDelaySeconds, Number(form.get("maxDelaySeconds") ?? 900)),
  );
  const startHour = Math.min(22, Math.max(0, Number(form.get("startHour") ?? 10)));
  const endHour = Math.min(23, Math.max(startHour + 1, Number(form.get("endHour") ?? 18)));

  if (!(csvFile instanceof File)) {
    return NextResponse.json({ error: "Sube un CSV" }, { status: 400 });
  }

  if (!(imageFile instanceof File) || !imageFile.type.startsWith("image/")) {
    return NextResponse.json({ error: "Sube una imagen valida" }, { status: 400 });
  }

  const rows = await parseLeadFile(csvFile);
  const recipients = buildLeads(rows).map((lead) => ({
    phone: lead.phone,
    name: lead.name,
    personalizedMessage: renderRecipientMessage(message, lead),
  }));
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No encontre telefonos validos en el CSV" },
      { status: 400 },
    );
  }

  fs.mkdirSync(uploadDir, { recursive: true });
  const extension = path.extname(imageFile.name) || ".jpg";
  const imageName = `campaign-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}${extension}`;
  const imagePath = path.join(uploadDir, imageName);
  const bytes = Buffer.from(await imageFile.arrayBuffer());
  fs.writeFileSync(imagePath, bytes);

  const campaign = createMarketingCampaign({
    name: name || `Carrito abandonado ${new Date().toLocaleDateString("es-MX")}`,
    message,
    imagePath,
    imageMime: imageFile.type,
    windowStartHour: startHour,
    windowEndHour: endHour,
    minDelaySeconds,
    maxDelaySeconds,
    recipients: scheduleRecipients(
      recipients,
      durationHours,
      startHour,
      endHour,
      minDelaySeconds,
      maxDelaySeconds,
    ),
  });

  return NextResponse.json({ ok: true, campaign, imported: recipients.length });
}
