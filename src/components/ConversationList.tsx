"use client";

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

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: ConversationListProps) {
  return (
    <aside className="flex min-h-0 w-full flex-col border-r border-stone-200 bg-white md:w-80">
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-stone-900">
          Conversaciones
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-sm text-stone-500">
            Todavía no hay mensajes.
          </div>
        ) : (
          conversations.map((conversation) => (
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
                  {conversation.name || conversation.phone}
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
