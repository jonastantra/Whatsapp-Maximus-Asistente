import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const DB = "/home/jon/.openclaw/workspace/data/envios/cotizaciones.sqlite3";
const execFileAsync = promisify(execFile);
const consultas = new Map<string, Promise<void>>();

export function codigoPostalExplicito(text: string): string | null {
  const normal = text.trim();
  const match = normal.match(/(?:c[oó]digo\s*postal|\bc\.?\s*p\.?)(?:\s*(?:es|:|#|-))?\s*(\d{5})(?!\d)/i)
    ?? normal.match(/^(\d{5})[.!]?$/);
  return match?.[1] ?? null;
}

export async function obtenerReferenciaEnvio(text: string): Promise<string | null> {
  const cp = codigoPostalExplicito(text);
  if (!cp) return null;
  const guardada = referenciaEnvio(text);
  if (guardada) return guardada;
  let tarea = consultas.get(cp);
  if (!tarea) {
    tarea = execFileAsync("/usr/bin/python3", ["/home/jon/.openclaw/workspace/scripts/cotizaciones_envio_local.py", cp, "--consultar"], { timeout: 45000, maxBuffer: 65536 })
      .then(() => undefined).catch(() => undefined).finally(() => consultas.delete(cp));
    consultas.set(cp, tarea);
  }
  await tarea;
  return referenciaEnvio(text);
}

export function referenciaEnvio(text: string): string | null {
  const cp = codigoPostalExplicito(text);
  if (!cp || !existsSync(DB)) return null;
  try {
    const db = new Database(DB, { readonly: true, fileMustExist: true });
    try {
      const row = db.prepare(`SELECT total, paqueteria, servicio, observado_utc, zona_destino, recargo_extendido
        FROM observaciones WHERE origen = ? AND destino = ? AND total > 0
          AND datetime(observado_utc) >= datetime('now', '-24 hours')
          AND observado_utc = (SELECT max(observado_utc) FROM observaciones WHERE origen = ? AND destino = ?)
        ORDER BY total ASC LIMIT 1`).get("57840", cp, "57840", cp) as
        { total: number; paqueteria: string; servicio: string; observado_utc: string; zona_destino: number | null; recargo_extendido: number | null } | undefined;
      if (!row) return null;
      return `Referencia interna de otro proveedor para CP ${cp}: ${row.paqueteria}, ${row.servicio}, $${row.total.toFixed(2)} MXN; consultada ${row.observado_utc}. Zona extendida reportada: ${row.zona_destino === 1 || (row.recargo_extendido ?? 0) > 0 ? "sí" : row.zona_destino === 0 ? "no reportada" : "desconocida"}. No es tarifa de Skydropx ni un precio definitivo. No prometas ese costo ni pidas depósito antes de que un asesor confirme el envío y total.`;
    } finally { db.close(); }
  } catch { return null; }
}
