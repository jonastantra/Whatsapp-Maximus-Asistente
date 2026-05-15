import { NextRequest, NextResponse } from "next/server";
import { listCatalogItems, replaceCatalogItems } from "@/lib/db";

function parseCatalogText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [name = "", price = "", notes = "", activeText = "activo"] = line
        .split("|")
        .map((part) => part.trim());

      return {
        name,
        price,
        notes,
        active: !["inactivo", "inactive", "no", "0"].includes(
          activeText.toLowerCase(),
        ),
      };
    })
    .filter((item) => item.name && item.price);
}

export async function GET() {
  return NextResponse.json({ items: listCatalogItems() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text : "";
  const items = parseCatalogText(text);

  if (items.length === 0) {
    return NextResponse.json(
      { error: "Agrega al menos un producto con formato Producto | Precio" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, items: replaceCatalogItems(items) });
}
