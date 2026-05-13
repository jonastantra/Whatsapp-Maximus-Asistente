"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ConnectionStatus,
  ConversationListItem,
  ConversationMode,
  Message,
} from "@/lib/db";
import { ConversationList } from "./ConversationList";
import { ConversationPanel } from "./ConversationPanel";
import { DashboardHeader } from "./DashboardHeader";
import { QRScreen } from "./QRScreen";

interface ConnectionResponse {
  status: ConnectionStatus;
  qrPng: string | null;
  phone: string | null;
  updatedAt: number;
}

interface SettingsResponse {
  settings: {
    ai_paused: 0 | 1;
    updated_at: number;
  };
}

export function ConnectionGate() {
  const [connection, setConnection] = useState<ConnectionResponse>({
    status: "disconnected",
    qrPng: null,
    phone: null,
    updatedAt: 0,
  });
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    [],
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [aiPaused, setAiPaused] = useState(false);
  const selectedIdRef = useRef<number | null>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === selectedId) ??
      null,
    [conversations, selectedId],
  );

  const refresh = useCallback(async () => {
    const statusRes = await fetch("/api/connection/status", {
      cache: "no-store",
    });
    const nextConnection = (await statusRes.json()) as ConnectionResponse;
    setConnection(nextConnection);

    const settingsRes = await fetch("/api/settings", {
      cache: "no-store",
    });
    const settingsJson = (await settingsRes.json()) as SettingsResponse;
    setAiPaused(settingsJson.settings.ai_paused === 1);

    if (nextConnection.status !== "connected") {
      setConversations([]);
      setSelectedId(null);
      setMessages([]);
      return;
    }

    const conversationsRes = await fetch("/api/conversations", {
      cache: "no-store",
    });
    const conversationsJson = (await conversationsRes.json()) as {
      conversations: ConversationListItem[];
    };
    setConversations(conversationsJson.conversations);

    setSelectedId((current) => {
      if (
        current &&
        conversationsJson.conversations.some((item) => item.id === current)
      ) {
        return current;
      }

      return conversationsJson.conversations[0]?.id ?? null;
    });
  }, []);

  const loadMessages = useCallback(async (conversationId: number) => {
    const isInitialLoad =
      messagesRef.current.length === 0 || selectedIdRef.current !== conversationId;
    if (isInitialLoad) setLoadingMessages(true);

    try {
      const res = await fetch(`/api/messages/${conversationId}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { messages: Message[] };
      const current = messagesRef.current;
      const currentLast = current.at(-1)?.id ?? null;
      const nextLast = json.messages.at(-1)?.id ?? null;

      if (current.length !== json.messages.length || currentLast !== nextLast) {
        setMessages(json.messages);
      }
    } finally {
      if (isInitialLoad) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 2000);

    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId || connection.status !== "connected") return;

    void loadMessages(selectedId);
    const timer = setInterval(() => {
      void loadMessages(selectedId);
    }, 2000);

    return () => clearInterval(timer);
  }, [connection.status, loadMessages, selectedId]);

  async function changeMode(mode: ConversationMode) {
    if (!selectedId) return;

    const res = await fetch(`/api/mode/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });

    if (!res.ok) return;
    await refresh();
  }

  async function sendHuman(content: string) {
    if (!selectedId) return;

    const res = await fetch(`/api/messages/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) return;
    await loadMessages(selectedId);
    await refresh();
  }

  async function deleteSelected() {
    if (!selectedId) return;

    const res = await fetch(`/api/conversations/${selectedId}`, {
      method: "DELETE",
    });

    if (!res.ok) return;
    setSelectedId(null);
    setMessages([]);
    await refresh();
  }

  async function restartConnection() {
    await fetch("/api/connection/restart", { method: "POST" });
    await refresh();
  }

  async function changeAiPaused(paused: boolean) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiPaused: paused }),
    });

    if (!res.ok) return;
    const json = (await res.json()) as SettingsResponse;
    setAiPaused(json.settings.ai_paused === 1);
  }

  if (connection.status !== "connected") {
    return (
      <QRScreen
        status={connection.status}
        qrPng={connection.qrPng}
        onRetry={restartConnection}
      />
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-stone-100">
      <DashboardHeader
        phone={connection.phone}
        aiPaused={aiPaused}
        onAiPausedChange={changeAiPaused}
        onDisconnect={restartConnection}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ConversationPanel
          conversation={selectedConversation}
          messages={messages}
          loading={loadingMessages}
          aiPaused={aiPaused}
          onModeChange={changeMode}
          onSendHuman={sendHuman}
          onDelete={deleteSelected}
        />
      </div>
    </main>
  );
}
