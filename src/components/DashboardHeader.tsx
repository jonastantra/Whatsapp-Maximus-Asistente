"use client";

interface DashboardHeaderProps {
  phone: string | null;
  onDisconnect: () => Promise<void>;
}

export function DashboardHeader({ phone, onDisconnect }: DashboardHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4">
      <div>
        <h1 className="text-base font-semibold text-stone-900">
          Agente WhatsApp
        </h1>
        <p className="text-xs text-stone-500">
          {phone ? `Conectado: ${phone}` : "Conectado"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          void onDisconnect();
        }}
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
      >
        Desconectar
      </button>
    </header>
  );
}
