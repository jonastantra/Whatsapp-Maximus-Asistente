import Database from "better-sqlite3";

// Sala de agentes: usa el mismo buzón que Poly y Panchito (tabla «mensajes»),
// con columnas extra (canal, estado). Lo que John manda desde aquí queda como de='john'.
const RUTA = process.env.SALA_DB ?? "/home/jon/.openclaw/workspace/data/muse-bridge/mensajes.sqlite3";
const USUARIOS_JOHN = (process.env.SALA_USUARIOS_JOHN ?? "maximus")
  .split(",").map((s) => s.trim()).filter(Boolean);

export const CANALES = ["general", "decisiones-john", "precios", "anuncios", "tienda", "whatsapp-correo", "ideas"] as const;
export const DESTINOS = ["todos", "poly", "panchito", "claude"] as const;
const AGENTES = ["poly", "panchito", "claude"];

export interface MensajeSala {
  id: number; de: string; para: string; texto: string; ts: string;
  canal: string; estado: string | null; aprobado_por: string | null; aprobado_ts: string | null;
}

let db: Database.Database | null = null;
function abrir(): Database.Database {
  if (db) return db;
  const d = new Database(RUTA);
  d.pragma("busy_timeout = 5000");
  const cols = (d.prepare("pragma table_info(mensajes)").all() as { name: string }[]).map((c) => c.name);
  const agregar = (n: string, def: string) => { if (!cols.includes(n)) d.exec(`alter table mensajes add column ${n} ${def}`); };
  agregar("canal", "TEXT NOT NULL DEFAULT 'general'");
  agregar("estado", "TEXT");
  agregar("aprobado_por", "TEXT");
  agregar("aprobado_ts", "TEXT");
  db = d;
  return d;
}

export function autor(usuario: string | null): string | null {
  if (!usuario) return null;
  return USUARIOS_JOHN.includes(usuario) ? "john" : usuario;
}

export function listar(canal?: string, limite = 150): MensajeSala[] {
  const d = abrir();
  const sql = "select id,de,para,texto,ts,canal,estado,aprobado_por,aprobado_ts from mensajes"
    + (canal && canal !== "todo" ? " where canal=?" : "") + " order by id desc limit ?";
  const filas = (canal && canal !== "todo" ? d.prepare(sql).all(canal, limite) : d.prepare(sql).all(limite)) as MensajeSala[];
  return filas.reverse();
}

export function enviar(usuario: string, canal: string, para: string, texto: string): number[] {
  const quien = autor(usuario);
  if (!quien) throw new Error("Sin usuario");
  if (!(CANALES as readonly string[]).includes(canal)) throw new Error("Canal no válido");
  if (!(DESTINOS as readonly string[]).includes(para)) throw new Error("Destino no válido");
  if (canal === "decisiones-john" && quien !== "john") throw new Error("Solo John escribe en #decisiones-john");
  const limpio = texto.trim().slice(0, 6000);
  if (!limpio) throw new Error("Mensaje vacío");
  const firma = quien === "john"
    ? `[SALA #${canal} · John desde su panel con contraseña] `
    : `[SALA #${canal} · ${quien}] `;
  const destinos = para === "todos" ? AGENTES : [para];
  const d = abrir();
  const ins = d.prepare("insert into mensajes(de,para,texto,canal) values (?,?,?,?)");
  const ids: number[] = [];
  d.transaction(() => { for (const p of destinos) ids.push(Number(ins.run(quien, p, firma + limpio, canal).lastInsertRowid)); })();
  return ids;
}

export function decidir(usuario: string, id: number, estado: "aprobada" | "rechazada", nota = ""): void {
  if (autor(usuario) !== "john") throw new Error("Solo John aprueba o rechaza");
  const d = abrir();
  const m = d.prepare("select id,de,texto,canal from mensajes where id=?").get(id) as MensajeSala | undefined;
  if (!m) throw new Error("No existe ese mensaje");
  if (m.de === "john") throw new Error("Ese mensaje es tuyo");
  d.transaction(() => {
    d.prepare("update mensajes set estado=?, aprobado_por='john', aprobado_ts=datetime('now') where id=?").run(estado, id);
    const verbo = estado === "aprobada" ? "APROBADO" : "RECHAZADO";
    const texto = `[SALA #${m.canal} · John desde su panel con contraseña] ${verbo} tu mensaje #${id}.`
      + (nota.trim() ? ` Nota de John: ${nota.trim().slice(0, 1000)}` : "")
      + ` Resumen de lo que propusiste: «${m.texto.slice(0, 300)}»`;
    d.prepare("insert into mensajes(de,para,texto,canal,estado) values ('john',?,?,?,?)").run(m.de, texto, m.canal, estado);
  })();
}
