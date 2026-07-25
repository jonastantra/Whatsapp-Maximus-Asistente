"use client";

import { useMemo, useState } from "react";
import type {
  ConversationListItem,
  ExportCategory,
} from "@/lib/db";

interface ExportCenterProps {
  conversations: ConversationListItem[];
  onCategoryChange: (
    conversationId: number,
    category: ExportCategory,
  ) => Promise<void>;
}

const categoryLabels: Record<ExportCategory, string> = {
  unclassified: "Sin clasificar",
  business: "Negocio",
  personal: "Personal",
  excluded: "No exportar",
};

function filenameFromDisposition(
  disposition: string | null,
  fallback: string,
): string {
  return disposition?.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

export function ExportCenter({
  conversations,
  onCategoryChange,
}: ExportCenterProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExportCategory | "all">("all");
  const [format, setFormat] = useState<"jsonl" | "csv">("jsonl");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (category !== "all" && conversation.export_category !== category) {
        return false;
      }
      if (!normalized) return true;
      return `${conversation.name ?? ""} ${conversation.phone}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [category, conversations, query]);

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function download(kind: "contacts" | "conversations") {
    if (selected.size === 0) {
      setError("Selecciona al menos un chat. Nada se exporta automáticamente.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/exports/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationIds: [...selected],
          format,
          includeSummary,
          from: from || undefined,
          to: to || undefined,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error || "No se pudo crear la exportación.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromDisposition(
        res.headers.get("Content-Disposition"),
        kind === "contacts" ? "contactos.csv" : `conversaciones.${format}`,
      );
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
      >
        Exportar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-stone-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">
                  Exportación privada
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Solo se incluyen los chats que marques. Todo se genera localmente
                  y no se envía a ninguna IA.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-stone-500"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 border-b border-stone-200 p-4 md:grid-cols-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar nombre o número"
                className="rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ExportCategory | "all")
                }
                className="rounded-md border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="all">Todas las categorías</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {visible.map((conversation) => (
                <div
                  key={conversation.id}
                  className="grid grid-cols-[auto_1fr] gap-3 border-b border-stone-100 px-4 py-3 md:grid-cols-[auto_1fr_150px] md:items-center"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(conversation.id)}
                    disabled={conversation.export_category === "excluded"}
                    onChange={() => toggle(conversation.id)}
                    aria-label={`Seleccionar ${conversation.name || conversation.phone}`}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-stone-900">
                      {conversation.name || "Sin nombre"}
                    </div>
                    <div className="truncate text-xs text-stone-500">
                      {conversation.phone}
                    </div>
                  </div>
                  <select
                    value={conversation.export_category}
                    onChange={(event) => {
                      const nextCategory = event.target.value as ExportCategory;
                      if (nextCategory === "excluded") {
                        setSelected((current) => {
                          const next = new Set(current);
                          next.delete(conversation.id);
                          return next;
                        });
                      }
                      void onCategoryChange(
                        conversation.id,
                        nextCategory,
                      );
                    }}
                    className="col-start-2 rounded-md border border-stone-300 px-2 py-1.5 text-xs md:col-start-auto"
                  >
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-stone-200 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <select
                  value={format}
                  onChange={(event) =>
                    setFormat(event.target.value as "jsonl" | "csv")
                  }
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="jsonl">JSONL estructurado</option>
                  <option value="csv">CSV ligero</option>
                </select>
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  aria-label="Desde"
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  aria-label="Hasta"
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={includeSummary}
                    disabled={format === "csv"}
                    onChange={(event) => setIncludeSummary(event.target.checked)}
                  />
                  Resumen local
                </label>
              </div>
              {error && <p className="text-sm text-red-700">{error}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-stone-600">
                  {selected.size} chat(s) seleccionado(s)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void download("contacts")}
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50"
                  >
                    Contactos para Google
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void download("conversations")}
                    className="rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Exportar chats
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
