"use client";

import { FormEvent, useEffect, useState } from "react";

interface PromotionResponse {
  promotion: {
    content: string;
    enabled: 0 | 1;
  };
}

export function PromotionEditor() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/promotions", { cache: "no-store" });
      const json = (await res.json()) as PromotionResponse;
      setContent(json.promotion.content);
      setEnabled(json.promotion.enabled === 1);
    })();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, enabled }),
      });
      const json = (await res.json()) as PromotionResponse;
      setContent(json.promotion.content);
      setEnabled(json.promotion.enabled === 1);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={
          enabled
            ? "rounded-md border border-emerald-300 bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-200"
            : "rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
        }
      >
        {enabled ? "Promo activa" : "Promocion"}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(92vw,460px)] rounded-lg border border-stone-200 bg-white p-4 text-left shadow-xl">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-stone-900">
              Promocion activa
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Se usa en vivo en las respuestas del bot, sin GitHub ni redeploy.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                className="h-4 w-4"
              />
              Activar promocion
            </label>

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={7}
              placeholder="Ejemplo: Promo de hoy: remate de Minoxidil Kirkland 3 meses en $___, hasta agotar existencias. Si pregunta por Kirkland, ofrecer esta promo primero."
              className="w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600"
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-stone-500">
                {saved ? "Guardado. Ya aplica en vivo." : " "}
              </span>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:bg-stone-300"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
