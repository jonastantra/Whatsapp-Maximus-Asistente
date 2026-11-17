// Nombre que se muestra en el panel: «261117.3179 · Guillermo».
// Si el nombre guardado es el de la propia cuenta («Maximus…») se muestra el número para no confundir.
export function nombreCliente(c: { codigo?: string | null; name: string | null; phone: string; alternate_jid?: string | null }): string {
  const nombre = c.name && !/^\s*maximus/i.test(c.name) ? c.name : numeroCliente(c) ?? "Sin nombre";
  return c.codigo ? `${c.codigo} · ${nombre}` : nombre;
}

export function numeroCliente(c: { phone: string; alternate_jid?: string | null }): string | null {
  for (const j of [c.phone, c.alternate_jid ?? ""]) {
    if (j.endsWith("@s.whatsapp.net")) {
      const n = j.split("@")[0];
      return n.startsWith("521") && n.length === 13 ? n.slice(3) : n;
    }
  }
  return null;
}
