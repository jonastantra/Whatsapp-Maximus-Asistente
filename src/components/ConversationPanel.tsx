"use client";

import { FormEvent, UIEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ConversationListItem, ConversationMode, Message } from "@/lib/db";
import { MessageBubble } from "./MessageBubble";
import { ModeToggle } from "./ModeToggle";

interface ConversationPanelProps {
  conversation: ConversationListItem | null;
  messages: Message[];
  loading: boolean;
  aiPaused: boolean;
  onModeChange: (mode: ConversationMode) => Promise<void>;
  onSendHuman: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onContextChange: (enabled: boolean, notes: string) => Promise<void>;
}

export function ConversationPanel({
  conversation,
  messages,
  loading,
  aiPaused,
  onModeChange,
  onSendHuman,
  onDelete,
  onContextChange,
}: ConversationPanelProps) {
  const [draft, setDraft] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [contextNotes, setContextNotes] = useState("");
  const [contextEnabled, setContextEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const lastConversationIdRef = useRef<number | null>(null);

  const canSend = conversation?.mode === "HUMAN" || aiPaused;
  const title = useMemo(() => {
    if (!conversation) return "Selecciona una conversación";
    return conversation.name || conversation.phone;
  }, [conversation]);

  useEffect(() => {
    const conversationChanged = lastConversationIdRef.current !== conversation?.id;
    lastConversationIdRef.current = conversation?.id ?? null;

    if (conversationChanged) {
      shouldStickToBottomRef.current = true;
      setContextNotes(conversation?.context_notes ?? "");
      setContextEnabled(conversation?.context_enabled === 1);
    }

    if (shouldStickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [
    conversation?.context_enabled,
    conversation?.context_notes,
    conversation?.id,
    messages,
  ]);

  async function saveContext(enabled = contextEnabled) {
    if (!conversation) return;
    setBusy(true);
    try {
      await onContextChange(enabled, contextNotes);
      setContextEnabled(enabled);
    } finally {
      setBusy(false);
    }
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 120;
  }

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
          {aiPaused ? (
            <p className="mt-1 text-xs font-medium text-amber-700">
              IA pausada globalmente. Puedes responder manualmente.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setContextOpen((current) => !current)}
            className={
              conversation.context_enabled === 1
                ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                : "rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
            }
          >
            Contexto IA
          </button>
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

      {contextOpen && (
        <div className="border-b border-stone-200 bg-white px-4 py-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <input
                  id="chat-context-enabled"
                  type="checkbox"
                  checked={contextEnabled}
                  onChange={(event) => setContextEnabled(event.target.checked)}
                  className="h-4 w-4"
                />
                <label
                  htmlFor="chat-context-enabled"
                  className="text-sm font-semibold text-stone-800"
                >
                  Activar contexto solo para este chat
                </label>
              </div>
              <textarea
                value={contextNotes}
                onChange={(event) => setContextNotes(event.target.value)}
                rows={3}
                placeholder="Ej. Este cliente pregunta por promo de tienda fisica. Ofrecer recogida en Guelatao o Neza y mantener tono directo."
                className="w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
              <p className="mt-1 text-xs text-stone-500">
                La IA usara esta nota solo cuando responda en esta conversacion.
              </p>
            </div>
            <div className="flex gap-2 md:flex-col">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void saveContext(contextEnabled);
                }}
                className="rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:bg-stone-300"
              >
                Guardar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setContextEnabled(false);
                  void saveContext(false);
                }}
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
              >
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
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
        <div ref={bottomRef} />
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
