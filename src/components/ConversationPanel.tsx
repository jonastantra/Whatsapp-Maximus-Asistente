"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ConversationListItem, ConversationMode, Message } from "@/lib/db";
import { MessageBubble } from "./MessageBubble";
import { ModeToggle } from "./ModeToggle";

interface ConversationPanelProps {
  conversation: ConversationListItem | null;
  messages: Message[];
  loading: boolean;
  onModeChange: (mode: ConversationMode) => Promise<void>;
  onSendHuman: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ConversationPanel({
  conversation,
  messages,
  loading,
  onModeChange,
  onSendHuman,
  onDelete,
}: ConversationPanelProps) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const canSend = conversation?.mode === "HUMAN";
  const title = useMemo(() => {
    if (!conversation) return "Selecciona una conversación";
    return conversation.name || conversation.phone;
  }, [conversation]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !canSend) return;

    setBusy(true);
    try {
      await onSendHuman(content);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!conversation) return;
    const ok = window.confirm(
      `¿Borrar la conversación con ${conversation.name || conversation.phone}?`,
    );
    if (ok) await onDelete();
  }

  if (!conversation) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center bg-stone-50 p-8">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
          <p className="mt-2 text-sm text-stone-500">
            Los chats entrantes aparecerán en la lista de la izquierda.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-stone-50">
      <div className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-stone-900">
            {title}
          </h2>
          <p className="text-sm text-stone-500">{conversation.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle
            mode={conversation.mode}
            disabled={busy}
            onChange={(mode) => {
              void onModeChange(mode);
            }}
          />
          <button
            type="button"
            onClick={() => {
              void confirmDelete();
            }}
            className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Borrar
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-stone-500">Cargando mensajes...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-stone-500">Sin mensajes todavía.</p>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              createdAt={message.created_at}
            />
          ))
        )}
      </div>

      <form onSubmit={submit} className="border-t border-stone-200 bg-white p-3">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!canSend || busy}
            placeholder={
              canSend
                ? "Escribe una respuesta..."
                : "El bot responde automáticamente"
            }
            className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 disabled:bg-stone-100 disabled:text-stone-500"
          />
          <button
            type="submit"
            disabled={!canSend || busy || !draft.trim()}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:bg-stone-300"
          >
            Enviar
          </button>
        </div>
      </form>
    </section>
  );
}
