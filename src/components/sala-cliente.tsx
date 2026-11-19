"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MensajeSala } from "@/lib/sala";

const COLOR: Record<string, string> = {
  john: "bg-stone-900 text-white", poly: "bg-sky-50 text-stone-900", panchito: "bg-amber-50 text-stone-900", claude: "bg-orange-50 text-stone-900",
};

export default function SalaCliente({ mensajes, canal, soyJohn, usuario }: { mensajes: MensajeSala[]; canal: string; soyJohn: boolean; usuario: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [para, setPara] = useState("todos");
  const [canalEnvio, setCanalEnvio] = useState(canal === "todo" ? "general" : canal);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setInterval(() => router.refresh(), 10000); return () => clearInterval(t); }, [router]);
  useEffect(() => { fin.current?.scrollIntoView(); }, [mensajes.length]);

  async function mandar(e: React.FormEvent) {
    e.preventDefault(); setError(""); setEnviando(true);
    const r = await fetch("/api/sala", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ canal: canalEnvio, para, texto }) });
    const j = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) { setError(j.error ?? "No se pudo enviar"); return; }
    setTexto(""); router.refresh();
  }
  async function decidir(id: number, estado: "aprobada" | "rechazada") {
    const nota = estado === "rechazada" ? (prompt("¿Por qué lo rechazas? (opcional)") ?? "") : "";
    const r = await fetch("/api/sala/estado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, estado, nota }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error ?? "No se pudo"); return; }
    router.refresh();
  }

  return (
    <>
      <ul className="space-y-2">
        {mensajes.map((m) => (
          <li key={m.id} className={`rounded-lg border border-stone-200 px-3 py-2 text-[15px] leading-snug ${COLOR[m.de] ?? "bg-white"}`}>
            <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs opacity-70">
              <strong className="text-sm">{m.de === "john" ? "Tú (John)" : m.de}</strong>
              <span>→ {m.para}</span><span>#{m.canal}</span><span>#{m.id}</span>
              <span>{new Date(m.ts.replace(" ", "T") + "Z").toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "short", timeStyle: "short" })}</span>
              {m.estado && <span className={`rounded px-1.5 font-semibold ${m.estado === "aprobada" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{m.estado}</span>}
            </div>
            <p className="whitespace-pre-wrap break-words">{m.texto}</p>
            {soyJohn && m.de !== "john" && !m.estado && (
              <div className="mt-2 flex gap-2">
                <button onClick={() => decidir(m.id, "aprobada")} className="rounded bg-green-700 px-3 py-1.5 text-sm font-semibold text-white">Aprobar</button>
                <button onClick={() => decidir(m.id, "rechazada")} className="rounded border border-stone-400 px-3 py-1.5 text-sm">Rechazar</button>
              </div>
            )}
          </li>
        ))}
        {mensajes.length === 0 && <li className="text-sm text-stone-500">Todavía no hay mensajes en este canal.</li>}
      </ul>
      <div ref={fin} />
      <form onSubmit={mandar} className="sticky bottom-0 mt-4 space-y-2 border-t border-stone-200 bg-white py-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <label>Canal{" "}
            <select value={canalEnvio} onChange={(e) => setCanalEnvio(e.target.value)} className="rounded border border-stone-300 px-2 py-1">
              {["general", "decisiones-john", "precios", "anuncios", "tienda", "whatsapp-correo", "ideas"].map((c) =>
                <option key={c} value={c} disabled={c === "decisiones-john" && !soyJohn}>#{c}</option>)}
            </select>
          </label>
          <label>Para{" "}
            <select value={para} onChange={(e) => setPara(e.target.value)} className="rounded border border-stone-300 px-2 py-1">
              <option value="todos">Todos</option><option value="poly">Poly</option><option value="panchito">Panchito</option><option value="claude">Claude</option>
            </select>
          </label>
          <span className="self-center text-xs text-stone-500">Entraste como {soyJohn ? "John" : usuario}</span>
        </div>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Escribe a los agentes…"
          className="w-full rounded border border-stone-300 px-3 py-2 text-base" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button disabled={enviando || !texto.trim()} className="w-full rounded bg-stone-900 py-2.5 font-semibold text-white disabled:opacity-40">
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </form>
    </>
  );
}
