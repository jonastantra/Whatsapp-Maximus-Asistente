import path from "node:path";
import Database from "better-sqlite3";

/**
 * Metricas de atencion, en solo lectura.
 *
 * Abre su propia conexion para no interferir con la del bot. WAL permite
 * varios lectores al mismo tiempo, asi que esto no bloquea nada.
 *
 * No agrega columnas ni tablas: todo se deduce de lo que ya se guarda.
 * En messages.role: 'user' es el cliente, 'assistant' es el bot, 'human' eres tu.
 */

const dbPath = path.resolve(process.cwd(), "data", "messages.db");

function openDb() {
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const PRODUCTOS: Array<[string, RegExp]> = [
  ["maximus", /maximus|balsamo/],
  ["espuma", /espuma|foam/],
  ["liquido", /liquido|gotero|bote/],
  ["otro", /tonico|biotina|shampoo|champu|derma|jabon|aceite|cera|peine/],
];

const TEMAS: Array<[string, RegExp]> = [
  ["ubicacion y horario", /ubicacion|donde estan|direccion|horario|abren|cierran|sucursal|guelatao|neza|metro|plaza|como llego/],
  ["envio", /envio|envian|mandan|paqueteria|codigo postal|\bcp\b/],
  ["precio", /precio|cuanto cuesta|cuanto sale|cuanto es|costo|cuanto vale/],
  ["formas de pago", /transferencia|deposito|oxxo|tarjeta|efectivo|clabe|cuenta/],
  ["disponibilidad", /disponible|tienen|stock|existencia|apartar/],
  ["contra entrega", /contra entrega|al recibir|cuando llegue|pago al recibir/],
  ["desconfianza", /original|autentic|pirata|falso|estafa|clon|garantia|confian/],
  ["resultados y uso", /resultad|funciona|sirve|como se usa|como lo uso|aplic|cuanto tarda/],
  ["descuento", /descuento|promocion|rebaja|mas barato|oferta/],
  ["fotos o catalogo", /foto|imagen|catalogo|pagina|link|tienda en linea/],
];

const SENAL_PAGO =
  /comprobante|ya te transfer|ya deposit|ya hice la transfer|ya pague|ya lo pague|transferencia realizada|ya quedo el pago/;

export type ResumenMes = {
  mes: string;
  conversaciones: number;
  conHumano: number;
  pctHumano: number;
  sinRespuesta: number;
  conPago: number;
  pctPago: number;
};

export type Pendiente = {
  id: number;
  nombre: string | null;
  producto: string | null;
  horasEsperando: number;
};

export type Metricas = {
  generadoEn: string;
  totalMensajes: number;
  totalContactos: number;
  mesActual: ResumenMes | null;
  mesAnterior: ResumenMes | null;
  historico: ResumenMes[];
  productos: Array<{ producto: string; conversaciones: number; conPago: number }>;
  temas: Array<{ tema: string; conversaciones: number; pct: number }>;
  pendientes: Pendiente[];
  horasPico: Array<{ hora: number; mensajes: number }>;
};

type FilaConversacion = {
  id: number;
  nombre: string | null;
  msgsCliente: number;
  msgsBot: number;
  msgsHumano: number;
  primero: number;
  ultimo: number;
  ultimoRol: string;
};

export function leerMetricas(): Metricas {
  const db = openDb();
  try {
    const filas = db
      .prepare(
        `
        SELECT
          c.id                                                          AS id,
          c.name                                                        AS nombre,
          SUM(CASE WHEN m.role = 'user'      THEN 1 ELSE 0 END)         AS msgsCliente,
          SUM(CASE WHEN m.role = 'assistant' THEN 1 ELSE 0 END)         AS msgsBot,
          SUM(CASE WHEN m.role = 'human'     THEN 1 ELSE 0 END)         AS msgsHumano,
          MIN(m.created_at)                                             AS primero,
          MAX(m.created_at)                                             AS ultimo,
          (SELECT role FROM messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC, id DESC LIMIT 1)                  AS ultimoRol
        FROM conversations c
        JOIN messages m ON m.conversation_id = c.id
        GROUP BY c.id
        HAVING msgsCliente > 0
      `,
      )
      .all() as FilaConversacion[];

    // Texto del cliente por conversacion, para clasificar producto y temas.
    const textos = db
      .prepare(
        `SELECT conversation_id AS id, content FROM messages WHERE role = 'user'`,
      )
      .all() as Array<{ id: number; content: string }>;

    const porConversacion = new Map<number, string>();
    for (const fila of textos) {
      const previo = porConversacion.get(fila.id) ?? "";
      porConversacion.set(fila.id, `${previo} ${normalizar(fila.content)}`);
    }

    const producto = new Map<number, string>();
    const pago = new Set<number>();
    const temasPorConv = new Map<string, Set<number>>();

    for (const [id, texto] of porConversacion) {
      for (const [nombre, patron] of PRODUCTOS) {
        if (patron.test(texto)) {
          producto.set(id, nombre);
          break;
        }
      }
      if (SENAL_PAGO.test(texto)) pago.add(id);
      for (const [tema, patron] of TEMAS) {
        if (patron.test(texto)) {
          if (!temasPorConv.has(tema)) temasPorConv.set(tema, new Set());
          temasPorConv.get(tema)!.add(id);
        }
      }
    }

    // Resumen por mes, en hora de Ciudad de Mexico.
    const porMes = new Map<string, ResumenMes>();
    for (const fila of filas) {
      const mes = new Date(fila.primero * 1000)
        .toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })
        .slice(0, 7);
      if (!porMes.has(mes)) {
        porMes.set(mes, {
          mes,
          conversaciones: 0,
          conHumano: 0,
          pctHumano: 0,
          sinRespuesta: 0,
          conPago: 0,
          pctPago: 0,
        });
      }
      const acumulado = porMes.get(mes)!;
      acumulado.conversaciones += 1;
      if (fila.msgsHumano > 0) acumulado.conHumano += 1;
      if (fila.ultimoRol === "user") acumulado.sinRespuesta += 1;
      if (pago.has(fila.id)) acumulado.conPago += 1;
    }

    const historico = [...porMes.values()]
      .map((mes) => ({
        ...mes,
        pctHumano: redondear((100 * mes.conHumano) / mes.conversaciones),
        pctPago: redondear((100 * mes.conPago) / mes.conversaciones),
      }))
      .sort((a, b) => b.mes.localeCompare(a.mes));

    const mesHoy = new Date()
      .toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })
      .slice(0, 7);

    // Productos
    const productos = new Map<string, { conversaciones: number; conPago: number }>();
    for (const fila of filas) {
      const clave = producto.get(fila.id) ?? "sin clasificar";
      if (!productos.has(clave)) productos.set(clave, { conversaciones: 0, conPago: 0 });
      const entrada = productos.get(clave)!;
      entrada.conversaciones += 1;
      if (pago.has(fila.id)) entrada.conPago += 1;
    }

    // Chats esperando respuesta
    const ahora = Date.now() / 1000;
    const pendientes: Pendiente[] = filas
      .filter((fila) => fila.ultimoRol === "user")
      .map((fila) => ({
        id: fila.id,
        nombre: fila.nombre,
        producto: producto.get(fila.id) ?? null,
        horasEsperando: redondear((ahora - fila.ultimo) / 3600),
      }))
      .filter((fila) => fila.horasEsperando < 72)
      .sort((a, b) => b.horasEsperando - a.horasEsperando);

    const horasPico = db
      .prepare(
        `
        SELECT
          CAST(strftime('%H', created_at, 'unixepoch', '-6 hours') AS INTEGER) AS hora,
          COUNT(*) AS mensajes
        FROM messages
        WHERE role = 'user'
        GROUP BY hora
        ORDER BY hora
      `,
      )
      .all() as Array<{ hora: number; mensajes: number }>;

    const totalMensajes = (
      db.prepare(`SELECT COUNT(*) AS n FROM messages`).get() as { n: number }
    ).n;
    const totalContactos = (
      db.prepare(`SELECT COUNT(*) AS n FROM conversations`).get() as { n: number }
    ).n;

    return {
      generadoEn: new Date().toISOString(),
      totalMensajes,
      totalContactos,
      mesActual: historico.find((mes) => mes.mes === mesHoy) ?? null,
      mesAnterior: historico.find((mes) => mes.mes !== mesHoy) ?? null,
      historico: historico.slice(0, 12),
      productos: [...productos.entries()]
        .map(([producto, datos]) => ({ producto, ...datos }))
        .sort((a, b) => b.conversaciones - a.conversaciones),
      temas: [...temasPorConv.entries()]
        .map(([tema, conjunto]) => ({
          tema,
          conversaciones: conjunto.size,
          pct: redondear((100 * conjunto.size) / Math.max(filas.length, 1)),
        }))
        .sort((a, b) => b.conversaciones - a.conversaciones),
      pendientes,
      horasPico,
    };
  } finally {
    db.close();
  }
}

function redondear(valor: number): number {
  return Math.round(valor * 10) / 10;
}
