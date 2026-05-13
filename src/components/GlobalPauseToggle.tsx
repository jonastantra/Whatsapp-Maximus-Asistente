"use client";

interface GlobalPauseToggleProps {
  aiPaused: boolean;
  disabled?: boolean;
  onChange: (paused: boolean) => Promise<void>;
}

export function GlobalPauseToggle({
  aiPaused,
  disabled,
  onChange,
}: GlobalPauseToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        void onChange(!aiPaused);
      }}
      className={
        aiPaused
          ? "rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-60"
          : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
      }
      title={
        aiPaused
          ? "La IA esta pausada para todos los chats"
          : "La IA responde en chats con modo AI"
      }
    >
      {aiPaused ? "IA pausada" : "IA activa"}
    </button>
  );
}
