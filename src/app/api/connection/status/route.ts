import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { getConnectionState } from "@/lib/db";

export async function GET() {
  const state = getConnectionState();
  const shouldShowQr =
    !!state.qr_string &&
    (state.status === "qr" || state.status === "connecting");

  if (shouldShowQr && state.qr_string) {
    const qrPng = await QRCode.toDataURL(state.qr_string, {
      width: 320,
      margin: 2,
    });

    return NextResponse.json({
      status: "qr",
      qrPng,
      phone: state.phone,
      updatedAt: state.updated_at,
    });
  }

  return NextResponse.json({
    status: state.status,
    qrPng: null,
    phone: state.phone,
    updatedAt: state.updated_at,
  });
}
