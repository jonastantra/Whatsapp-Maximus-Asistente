import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  createMarketingCampaign,
  listMarketingCampaigns,
} from "@/lib/db";

export const runtime = "nodejs";

type CsvRow = Record<string, string>;

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
  if (digits.length === 10) return `52${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
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
  recipients: Array<{ phone: string; name: string | null }>,
  durationDays: number,
  startHour: number,
  endHour: number,
): Array<{ phone: string; name: string | null; nextSendAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowSeconds = Math.max(1, endHour - startHour) * 60 * 60;
  const totalWindowSeconds = Math.max(1, durationDays) * windowSeconds;
  const step = Math.max(60, Math.floor(totalWindowSeconds / Math.max(1, recipients.length)));

  return recipients.map((recipient, index) => {
    const jitter = randomBetween(0, Math.min(step, 900));
    const candidate = now + index * step + jitter;
    return {
      ...recipient,
      nextSendAt: nextWindowTimestamp(candidate, startHour, endHour),
    };
  });
}

export async function GET() {
  return NextResponse.json({ campaigns: listMarketingCampaigns() });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const csvFile = form.get("csv");
  const imageFile = form.get("image");
  const name = String(form.get("name") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  const durationDays = Math.min(
    14,
    Math.max(1, Number(form.get("durationDays") ?? 3)),
  );
  const startHour = Math.min(22, Math.max(0, Number(form.get("startHour") ?? 10)));
  const endHour = Math.min(23, Math.max(startHour + 1, Number(form.get("endHour") ?? 18)));

  if (!(csvFile instanceof File)) {
    return NextResponse.json({ error: "Sube un CSV" }, { status: 400 });
  }

  if (!(imageFile instanceof File) || !imageFile.type.startsWith("image/")) {
    return NextResponse.json({ error: "Sube una imagen valida" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "Escribe el mensaje de la campana" }, { status: 400 });
  }

  const rows = await parseLeadFile(csvFile);
  const unique = new Map<string, { phone: string; name: string | null }>();

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

    unique.set(phone, {
      phone,
      name:
        pick(row, [
          "name",
          "nombre",
          "customer",
          "customer name",
          "first name",
          "shipping name",
        ]) || null,
    });
  }

  const recipients = [...unique.values()];
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
    minDelaySeconds: 300,
    maxDelaySeconds: 900,
    recipients: scheduleRecipients(recipients, durationDays, startHour, endHour),
  });

  return NextResponse.json({ ok: true, campaign, imported: recipients.length });
}
