"use client";

import { CampaignManager } from "./CampaignManager";
import { GlobalPauseToggle } from "./GlobalPauseToggle";
import { PromotionEditor } from "./PromotionEditor";
import { ExportCenter } from "./ExportCenter";
import type {
  ConversationListItem,
  ExportCategory,
} from "@/lib/db";

interface DashboardHeaderProps {
  phone: string | null;
  aiPaused: boolean;
  onAiPausedChange: (paused: boolean) => Promise<void>;
  onDisconnect: () => Promise<void>;
  conversations: ConversationListItem[];
  onCategoryChange: (
    conversationId: number,
    category: ExportCategory,
  ) => Promise<void>;
}

export function DashboardHeader({
  phone,
  aiPaused,
  onAiPausedChange,
  onDisconnect,
  conversations,
  onCategoryChange,
}: DashboardHeaderProps) {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-stone-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="shrink-0">
        <h1 className="text-base font-semibold text-stone-900">
          Agente WhatsApp
        </h1>
        <p className="text-xs text-stone-500">
          {phone ? `Conectado: ${phone}` : "Conectado"}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
        <GlobalPauseToggle
          aiPaused={aiPaused}
          onChange={onAiPausedChange}
        />
        <CampaignManager />
        <PromotionEditor />
        <ExportCenter
          conversations={conversations}
          onCategoryChange={onCategoryChange}
        />
        <button
          type="button"
          onClick={() => {
            void onDisconnect();
          }}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
        >
          Reiniciar conexion
        </button>
      </div>
    </header>
  );
}
