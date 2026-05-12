import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "El reset destructivo de sesión está deshabilitado para proteger producción. Usa /api/connection/restart para reconectar sin cerrar WhatsApp.",
    },
    { status: 409 },
  );
}
