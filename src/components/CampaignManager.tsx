"use client";

import { useEffect, useState } from "react";

interface Campaign {
  id: number;
  name: string;
  message: string;
  status: "draft" | "active" | "paused" | "done";
  total_recipients: number;
  pending_recipients: number;
  sent_recipients: number;
  failed_recipients: number;
  created_at: number;
}

export function CampaignManager() {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("Carrito abandonado");
  const [message, setMessage] = useState(
    [
      "Hola {nombre}, vimos que dejaste pendiente tu carrito {pedido}.",
      "Te apartamos {producto} por un total de {total}.",
      "Si quieres retomarlo, te puedo ayudar por aqui.",
    ].join("\n"),
  );
  const [durationHours, setDurationHours] = useState(72);
  const [minDelaySeconds, setMinDelaySeconds] = useState(300);
  const [maxDelaySeconds, setMaxDelaySeconds] = useState(900);
  const [csv, setCsv] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function fileLabel(file: File | null) {
    return file ? file.name : "Ningun archivo seleccionado";
  }

  async function loadCampaigns() {
    const res = await fetch("/api/campaigns", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { campaigns: Campaign[] };
    setCampaigns(json.campaigns);
  }

  useEffect(() => {
    if (!open) return;
    void loadCampaigns();
    const timer = setInterval(() => {
      void loadCampaigns();
    }, 5000);
    return () => clearInterval(timer);
  }, [open]);

  async function submitCampaign() {
    if (!csv || !image || !message.trim()) {
      setError("Sube CSV, imagen y escribe el mensaje.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    const form = new FormData();
    form.set("name", name);
    form.set("message", message);
    form.set("durationHours", String(durationHours));
    form.set("minDelaySeconds", String(minDelaySeconds));
    form.set("maxDelaySeconds", String(Math.max(minDelaySeconds, maxDelaySeconds)));
    form.set("startHour", "10");
    form.set("endHour", "18");
    form.set("csv", csv);
    form.set("image", image);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        imported?: number;
        error?: string;
      };

      if (!res.ok) {
        setError(json.error ?? "No se pudo crear la campana.");
        return;
      }

      setSuccess(`Campana creada con ${json.imported ?? 0} contactos.`);
      setCsv(null);
      setImage(null);
      setMessage("");
      await loadCampaigns();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
      >
        Carritos
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  Campanas de carrito abandonado
                </h2>
                <p className="text-xs text-stone-500">
                  CSV + imagen obligatoria, enviado poco a poco desde WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm font-semibold text-stone-500 hover:bg-stone-100"
              >
                Cerrar
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[360px_1fr]">
              <section className="border-b border-stone-200 p-5 md:border-b-0 md:border-r">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-stone-600">
                      Nombre
                    </span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-stone-600">
                      Mensaje personalizado
                    </span>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={5}
                      placeholder="Hola {nombre}, vimos que dejaste pendiente {producto}..."
                      className="w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                    <p className="mt-1 text-xs text-stone-500">
                      Variables: {"{nombre}"}, {"{pedido}"}, {"{producto}"},{" "}
                      {"{productos}"}, {"{total}"}, {"{ciudad}"}.
                    </p>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-stone-600">
                      Duracion total
                    </span>
                    <select
                      value={durationHours}
                      onChange={(event) => setDurationHours(Number(event.target.value))}
                      className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    >
                      <option value={5}>5 horas</option>
                      <option value={6}>6 horas</option>
                      <option value={10}>10 horas</option>
                      <option value={13}>13 horas</option>
                      <option value={24}>24 horas</option>
                      <option value={48}>2 dias</option>
                      <option value={72}>3 dias</option>
                      <option value={120}>5 dias</option>
                      <option value={240}>10 dias</option>
                      <option value={720}>30 dias</option>
                    </select>
                  </label>

                  <div>
                    <div className="mb-2 text-xs font-semibold text-stone-600">
                      Pausa entre mensajes
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold text-stone-500">
                          Minimo
                        </span>
                        <select
                          value={minDelaySeconds}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setMinDelaySeconds(next);
                            if (maxDelaySeconds < next) setMaxDelaySeconds(next);
                          }}
                          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        >
                          <option value={10}>10 segundos</option>
                          <option value={30}>30 segundos</option>
                          <option value={60}>1 minuto</option>
                          <option value={300}>5 minutos</option>
                          <option value={600}>10 minutos</option>
                          <option value={900}>15 minutos</option>
                          <option value={1800}>30 minutos</option>
                          <option value={3600}>1 hora</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold text-stone-500">
                          Maximo
                        </span>
                        <select
                          value={maxDelaySeconds}
                          onChange={(event) =>
                            setMaxDelaySeconds(
                              Math.max(minDelaySeconds, Number(event.target.value)),
                            )
                          }
                          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        >
                          <option value={30}>30 segundos</option>
                          <option value={60}>1 minuto</option>
                          <option value={300}>5 minutos</option>
                          <option value={600}>10 minutos</option>
                          <option value={900}>15 minutos</option>
                          <option value={1800}>30 minutos</option>
                          <option value={3600}>1 hora</option>
                          <option value={7200}>2 horas</option>
                        </select>
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      El sistema toma un tiempo aleatorio dentro de ese rango
                      antes de pasar al siguiente contacto.
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-stone-600">
                      CSV o Excel de Shopify
                    </span>
                    <div className="flex min-w-0 items-center gap-2 rounded-md border border-stone-300 bg-white p-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-stone-600">
                        {fileLabel(csv)}
                      </span>
                      <span className="shrink-0 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white">
                        Seleccionar
                      </span>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={(event) => setCsv(event.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-stone-600">
                      Imagen de la promocion
                    </span>
                    <div className="flex min-w-0 items-center gap-2 rounded-md border border-stone-300 bg-white p-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-stone-600">
                        {fileLabel(image)}
                      </span>
                      <span className="shrink-0 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white">
                        Seleccionar
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>

                  {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                      {success}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void submitCampaign();
                    }}
                    className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {busy ? "Creando..." : "Crear campana"}
                  </button>
                </div>
              </section>

              <section className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-stone-900">
                    Historial
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      void loadCampaigns();
                    }}
                    className="rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100"
                  >
                    Actualizar
                  </button>
                </div>

                <div className="overflow-hidden rounded-md border border-stone-200">
                  {campaigns.length === 0 ? (
                    <div className="p-6 text-center text-sm text-stone-500">
                      Aun no hay campanas.
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-200">
                      {campaigns.map((campaign) => (
                        <div key={campaign.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-stone-900">
                                {campaign.name}
                              </div>
                              <div className="mt-1 line-clamp-2 text-xs text-stone-500">
                                {campaign.message}
                              </div>
                            </div>
                            <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">
                              {campaign.status}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                            <div className="rounded-md bg-stone-50 p-2">
                              <div className="font-semibold text-stone-900">
                                {campaign.total_recipients}
                              </div>
                              <div className="text-stone-500">total</div>
                            </div>
                            <div className="rounded-md bg-amber-50 p-2">
                              <div className="font-semibold text-amber-800">
                                {campaign.pending_recipients}
                              </div>
                              <div className="text-amber-700">pend.</div>
                            </div>
                            <div className="rounded-md bg-emerald-50 p-2">
                              <div className="font-semibold text-emerald-800">
                                {campaign.sent_recipients}
                              </div>
                              <div className="text-emerald-700">env.</div>
                            </div>
                            <div className="rounded-md bg-red-50 p-2">
                              <div className="font-semibold text-red-800">
                                {campaign.failed_recipients}
                              </div>
                              <div className="text-red-700">fall.</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
