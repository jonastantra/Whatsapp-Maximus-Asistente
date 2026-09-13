import Link from "next/link";
import { leerMetricas } from "@/lib/metricas";

export const dynamic = "force-dynamic";

export default function MetricasPage() {
  let datos;
  try {
    datos = leerMetricas();
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-lg font-semibold">Metricas</h1>
        <p className="mt-2 text-sm text-stone-600">
          Todavia no hay base de datos en <code>data/messages.db</code>. En cuanto el bot
          reciba el primer mensaje, esta pantalla se llena sola.
        </p>
      </main>
    );
  }

  const { mesActual, mesAnterior } = datos;
  const esperando = datos.pendientes.filter((chat) => chat.horasEsperando >= 1);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 tabular-nums">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-stone-900">Como va la atencion</h1>
          <p className="mt-1 text-sm text-stone-500">
            {datos.totalMensajes.toLocaleString("es-MX")} mensajes guardados{" "}
            &middot; {datos.totalContactos.toLocaleString("es-MX")} contactos
          </p>
        </div>
        <Link href="/" className="text-sm text-stone-500 underline underline-offset-4">
          Volver a los chats
        </Link>
      </header>

      {/* Lo unico que pide accion ahora mismo */}
      <section
        className={`mb-8 rounded-lg border p-5 ${
          esperando.length > 0
            ? "border-red-300 bg-red-50"
            : "border-stone-200 bg-white"
        }`}
      >
        <div
          className={`text-4xl font-semibold ${
            esperando.length > 0 ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {esperando.length}
        </div>
        <p className="mt-1 text-sm text-stone-700">
          {esperando.length === 0
            ? "Nadie esta esperando respuesta. Vas al dia."
            : "clientes escribieron y nadie les ha contestado"}
        </p>
        {esperando.length > 0 && (
          <ul className="mt-4 divide-y divide-red-200 text-sm">
            {esperando.slice(0, 10).map((chat) => (
              <li key={chat.id} className="flex justify-between gap-3 py-2">
                <span className="truncate text-stone-800">
                  {chat.nombre ?? `Chat #${chat.id}`}
                  {chat.producto ? (
                    <span className="text-stone-500"> &middot; {chat.producto}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-stone-500">{chat.horasEsperando} h</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="mb-3 text-sm font-semibold text-stone-900">Este mes</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato
          valor={mesActual?.conversaciones ?? 0}
          etiqueta="conversaciones"
          previo={mesAnterior?.conversaciones}
        />
        <Dato
          valor={`${mesActual?.pctHumano ?? 0}%`}
          etiqueta="te tuviste que meter"
          previo={mesAnterior ? `${mesAnterior.pctHumano}%` : undefined}
          menosEsMejor
        />
        <Dato
          valor={mesActual?.sinRespuesta ?? 0}
          etiqueta="sin respuesta"
          previo={mesAnterior?.sinRespuesta}
          menosEsMejor
        />
        <Dato
          valor={`${mesActual?.pctPago ?? 0}%`}
          etiqueta="llegaron a pago"
          previo={mesAnterior ? `${mesAnterior.pctPago}%` : undefined}
        />
      </div>

      <h2 className="mb-1 text-sm font-semibold text-stone-900">Que te preguntan</h2>
      <p className="mb-3 text-xs text-stone-500">
        Porcentaje de conversaciones donde sale el tema. Lo de arriba es lo que mas
        conviene que el bot conteste solo.
      </p>
      <Tabla
        columnas={["Tema", "Chats", "%"]}
        filas={datos.temas.map((tema) => [
          tema.tema,
          String(tema.conversaciones),
          `${tema.pct}%`,
        ])}
      />

      <h2 className="mb-3 mt-8 text-sm font-semibold text-stone-900">
        Que producto piden
      </h2>
      <Tabla
        columnas={["Producto", "Chats", "Llegaron a pago"]}
        filas={datos.productos.map((producto) => [
          producto.producto,
          String(producto.conversaciones),
          String(producto.conPago),
        ])}
      />

      <h2 className="mb-3 mt-8 text-sm font-semibold text-stone-900">Mes a mes</h2>
      <Tabla
        columnas={["Mes", "Chats", "Con humano", "Sin respuesta", "Pagaron"]}
        filas={datos.historico.map((mes) => [
          mes.mes,
          String(mes.conversaciones),
          `${mes.pctHumano}%`,
          String(mes.sinRespuesta),
          `${mes.pctPago}%`,
        ])}
      />

      <p className="mt-10 text-xs text-stone-400">
        Todo se calcula de los mensajes ya guardados. Las senales de pago y de producto
        se detectan por texto, asi que son aproximadas.
      </p>
    </main>
  );
}

function Dato({
  valor,
  etiqueta,
  previo,
  menosEsMejor = false,
}: {
  valor: string | number;
  etiqueta: string;
  previo?: string | number;
  menosEsMejor?: boolean;
}) {
  const aNumero = (dato: unknown) => Number(String(dato).replace("%", ""));
  let color = "text-stone-400";
  if (previo !== undefined && aNumero(valor) !== aNumero(previo)) {
    const subio = aNumero(valor) > aNumero(previo);
    color = (menosEsMejor ? !subio : subio) ? "text-emerald-700" : "text-red-700";
  }
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="text-2xl font-semibold text-stone-900">{valor}</div>
      <div className="mt-0.5 text-xs text-stone-500">{etiqueta}</div>
      {previo !== undefined && (
        <div className={`mt-1 text-xs ${color}`}>mes pasado: {previo}</div>
      )}
    </div>
  );
}

function Tabla({ columnas, filas }: { columnas: string[]; filas: string[][] }) {
  if (filas.length === 0) {
    return <p className="text-sm text-stone-500">Todavia no hay datos.</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {columnas.map((columna, indice) => (
            <th
              key={columna}
              className={`border-b border-stone-200 py-2 font-medium text-stone-500 ${
                indice === 0 ? "text-left" : "text-right"
              }`}
            >
              {columna}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, indiceFila) => (
          <tr key={indiceFila}>
            {fila.map((celda, indiceCelda) => (
              <td
                key={indiceCelda}
                className={`border-b border-stone-100 py-2 text-stone-800 ${
                  indiceCelda === 0 ? "text-left" : "text-right"
                }`}
              >
                {celda}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
