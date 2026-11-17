"use client";

import { useEffect, useState } from "react";
import { nombreCliente } from "@/lib/nombre-cliente";
import type { ConversationListItem } from "@/lib/db";

interface ConversationListProps {
  conversations: ConversationListItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function relativeTime(timestamp: number | null): string {
  if (!timestamp) return "sin mensajes";

  const diff = Math.max(0, Date.now() - timestamp * 1000);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

// El panel guarda a veces un código (@lid); el número real viene en alternate_jid.
function numeroVisible(c: ConversationListItem): string | null {
  for (const j of [c.phone, c.alternate_jid ?? ""]) {
    if (j.endsWith("@s.whatsapp.net")) {
      const n = j.split("@")[0];
      return n.startsWith("521") && n.length === 13 ? n.slice(3) : n;
    }
  }
  return null;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: ConversationListProps) {
  const [pendingOnly, setPendingOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [serverIds, setServerIds] = useState<number[] | null>(null);
  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  useEffect(() => {
    if (q.length < 2) { setServerIds(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/conversations?q=${encodeURIComponent(q)}`, { signal: ctrl.signal, cache: "no-store" })
        .then((r) => r.json()).then((d: { ids?: number[] }) => setServerIds(d.ids ?? [])).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);
  const pending = conversations.filter((c) => c.last_message_role === "user");
  const base = pendingOnly ? pending : conversations;
  const matchesLocal = (c: ConversationListItem) =>
    (c.name ?? "").toLowerCase().includes(q) ||
    (c.codigo ?? "").includes(q) ||
    (c.last_message_preview ?? "").toLowerCase().includes(q) ||
    (qDigits.length >= 4 && (`${c.phone} ${c.alternate_jid ?? ""}`).includes(qDigits)) ||
    c.phone.toLowerCase().includes(q);
  const displayed = q.length < 2 ? base : base.filter((c) => matchesLocal(c) || (serverIds ?? []).includes(c.id));
  return (
    <aside className="flex min-h-0 w-full flex-col border-r border-stone-200 bg-white md:w-80">
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-stone-900">
          Conversaciones
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar nombre, teléfono o palabra…"
          aria-label="Buscar conversaciones"
          className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
        />
        <button type="button" onClick={() => setPendingOnly(!pendingOnly)} className="mt-2 rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100">
          {pendingOnly ? "Ver todos" : `Pendientes (${pending.length})`}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {displayed.length === 0 ? (
          <div className="px-4 py-8 text-sm text-stone-500">
            {q.length >= 2 ? `No encontré «${query.trim()}».` : pendingOnly ? "No hay conversaciones pendientes." : "Todavía no hay mensajes."}
          </div>
        ) : (
          displayed.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={`block w-full border-b border-stone-100 px-4 py-3 text-left transition ${
                selectedId === conversation.id
                  ? "bg-stone-100"
                  : "bg-white hover:bg-stone-50"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-stone-900">
                  {nombreCliente(conversation)}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    conversation.mode === "AI"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {conversation.mode === "AI" ? "IA" : "HUMAN"}
                </span>
              </div>
              <div className="mb-1 text-xs text-stone-500">
                {relativeTime(conversation.last_message_at)}
                {numeroVisible(conversation) ? ` · ${numeroVisible(conversation)}` : ""}
                {conversation.last_message_role === "user" ? " · Espera respuesta" : ""}
              </div>
              <p className="truncate text-sm text-stone-600">
                {conversation.last_message_preview || conversation.phone}
              </p>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
