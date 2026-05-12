"use client";

import type { MessageRole } from "@/lib/db";

interface MessageBubbleProps {
  role: MessageRole;
  content: string;
  createdAt: number;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

export function MessageBubble({ role, content, createdAt }: MessageBubbleProps) {
  const isUser = role === "user";
  const label =
    role === "user" ? "Cliente" : role === "assistant" ? "IA" : "Humano";
  const tone =
    role === "assistant"
      ? "bg-emerald-600 text-white"
      : role === "human"
        ? "bg-amber-500 text-white"
        : "border border-stone-200 bg-white text-stone-900";

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[78%] rounded-lg px-3 py-2 shadow-sm ${tone}`}>
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold opacity-75">
          <span>{label}</span>
          <span>{formatTime(createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-5">
          {content}
        </p>
      </div>
    </div>
  );
}
