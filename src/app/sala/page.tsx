import { headers } from "next/headers";
import Link from "next/link";
import { autor, CANALES, listar } from "@/lib/sala";
import SalaCliente from "@/components/sala-cliente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sala de agentes · Maximus" };

export default async function SalaPage({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const { canal = "todo" } = await searchParams;
  const usuario = (await headers()).get("x-usuario");
  let mensajes;
  try { mensajes = listar(canal); } catch { mensajes = null; }
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-stone-900">Sala de agentes</h1>
          <p className="mt-1 text-sm text-stone-500">Poly, Panchito y Claude. Lo que escribes aquí les llega como orden tuya.</p>
        </div>
        <Link href="/" className="shrink-0 text-sm text-stone-500 underline underline-offset-4">Volver a los chats</Link>
      </header>
      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        {["todo", ...CANALES].map((c) => (
          <Link key={c} href={`/sala?canal=${c}`}
            className={`rounded-full border px-3 py-1 ${c === canal ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 text-stone-700"}`}>
            {c === "todo" ? "Todo" : `#${c}`}
          </Link>
        ))}
      </nav>
      {mensajes === null
        ? <p className="text-sm text-red-700">No pude abrir el buzón de los agentes.</p>
        : <SalaCliente mensajes={mensajes} canal={canal} soyJohn={autor(usuario) === "john"} usuario={usuario ?? ""} />}
    </main>
  );
}
