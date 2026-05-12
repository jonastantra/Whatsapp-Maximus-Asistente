"use client";

import { useEffect, useState } from "react";

interface QRScreenProps {
  status: string;
  qrPng: string | null;
}

export function QRScreen({ status, qrPng }: QRScreenProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [status, qrPng]);

  const statusCopy =
    status === "qr"
      ? "Esperando escaneo..."
      : status === "connecting"
        ? "Conectando..."
        : "Esperando al bot...";

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-stone-900">
          Conectar número
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Abre WhatsApp, entra a Dispositivos vinculados y escanea este QR.
        </p>

        <div className="mt-6 flex min-h-80 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 p-4">
          {qrPng ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrPng}
              alt="Código QR para conectar WhatsApp"
              className="h-80 w-80"
            />
          ) : (
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-stone-700" />
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-stone-700">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              status === "qr"
                ? "animate-pulse bg-amber-500"
                : status === "connecting"
                  ? "bg-blue-500"
                  : "bg-stone-400"
            }`}
          />
          {statusCopy}
        </div>

        {status === "disconnected" && !qrPng && elapsed > 10 ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No llegó el QR. Reinicia el proceso bot con npm run start:bot.
          </p>
        ) : null}
      </section>
    </main>
  );
}
