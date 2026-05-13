"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

interface PromotionResponse {
  promotion: {
    content: string;
    enabled: 0 | 1;
  };
}

interface PromptResponse {
  prompt: string;
  isDefault: boolean;
}

const defaultPromoText = `Promocion especial de remate de stock Kirkland liquido 5%.
Poco stock disponible, ultimas piezas. Caducidad: septiembre 2026.
Vigencia: solo hasta el 16 de mayo.
Precios:
- 1 mes: $199 MXN.
- 2 meses: $399 MXN.
- 3 meses: $499 MXN.
- 6 meses: $950 MXN.
- 2 cajas: $1,500 MXN.
Usala cuando pregunten por Kirkland, minoxidil liquido, promociones o remate.
Responde con urgencia real: es remate y hay poco stock.`;

export function PromotionEditor() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"prompt" | "promo">("prompt");
  const [prompt, setPrompt] = useState("");
  const [isDefaultPrompt, setIsDefaultPrompt] = useState(true);
  const [content, setContent] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    const [promotionRes, promptRes] = await Promise.all([
      fetch("/api/promotions", { cache: "no-store" }),
      fetch("/api/prompt", { cache: "no-store" }),
    ]);

    const promotionJson = (await promotionRes.json()) as PromotionResponse;
    const promptJson = (await promptRes.json()) as PromptResponse;

    setContent(promotionJson.promotion.content);
    setEnabled(promotionJson.promotion.enabled === 1);
    setPrompt(promptJson.prompt);
    setIsDefaultPrompt(promptJson.isDefault);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPrompt(true);
    setSaved("");

    try {
      const res = await fetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) return;
      const json = (await res.json()) as PromptResponse;
      setPrompt(json.prompt);
      setIsDefaultPrompt(json.isDefault);
      setSaved("Prompt guardado. Ya aplica en vivo.");
    } finally {
      setSavingPrompt(false);
    }
  }

  async function submitPromo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPromo(true);
    setSaved("");

    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, enabled }),
      });
      const json = (await res.json()) as PromotionResponse;
      setContent(json.promotion.content);
      setEnabled(json.promotion.enabled === 1);
      setSaved("Promocion guardada. Ya aplica en vivo.");
    } finally {
      setSavingPromo(false);
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
        Prompt y promo
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 max-h-[82vh] w-[min(94vw,760px)] overflow-y-auto rounded-lg border border-stone-200 bg-white p-4 text-left shadow-xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">
                Prompt y promocion en vivo
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Lo que guardes aqui se usa sin GitHub ni redeploy.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100"
            >
              Cerrar
            </button>
          </div>

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setTab("prompt")}
              className={
                tab === "prompt"
                  ? "rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white"
                  : "rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              }
            >
              Prompt
            </button>
            <button
              type="button"
              onClick={() => setTab("promo")}
              className={
                tab === "promo"
                  ? "rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white"
                  : "rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              }
            >
              Promocion
            </button>
          </div>

          {tab === "prompt" ? (
            <form onSubmit={submitPrompt} className="space-y-3">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {isDefaultPrompt
                  ? "Estas viendo el prompt base. Al guardarlo, quedara editable desde SQLite."
                  : "Estas usando un prompt personalizado guardado en vivo."}
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={18}
                className="w-full resize-y rounded-md border border-stone-300 px-3 py-2 font-mono text-xs outline-none focus:border-stone-600"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-stone-500">{saved}</span>
                <button
                  type="submit"
                  disabled={savingPrompt || !prompt.trim()}
                  className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:bg-stone-300"
                >
                  {savingPrompt ? "Guardando..." : "Guardar prompt"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitPromo} className="space-y-3">
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
                rows={13}
                placeholder={defaultPromoText}
                className="w-full resize-y rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600"
              />

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setContent(defaultPromoText);
                    setEnabled(true);
                  }}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                >
                  Usar promo Kirkland
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-500">{saved}</span>
                  <button
                    type="submit"
                    disabled={savingPromo}
                    className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:bg-stone-300"
                  >
                    {savingPromo ? "Guardando..." : "Guardar promo"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
