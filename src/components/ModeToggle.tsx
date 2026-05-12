"use client";

import type { ConversationMode } from "@/lib/db";

interface ModeToggleProps {
  mode: ConversationMode;
  disabled?: boolean;
  onChange: (mode: ConversationMode) => void;
}

export function ModeToggle({ mode, disabled, onChange }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-md border border-stone-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("AI")}
        className={`rounded px-3 py-1.5 text-sm font-semibold transition ${
          mode === "AI"
            ? "bg-emerald-600 text-white"
            : "text-stone-600 hover:bg-stone-100"
        }`}
      >
        IA
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("HUMAN")}
        className={`rounded px-3 py-1.5 text-sm font-semibold transition ${
          mode === "HUMAN"
            ? "bg-amber-500 text-white"
            : "text-stone-600 hover:bg-stone-100"
        }`}
      >
        Humano
      </button>
    </div>
  );
}
