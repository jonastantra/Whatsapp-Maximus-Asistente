# Diagnostico de atencion — septiembre 2026

Analisis de 6,414 mensajes guardados entre el 12 de mayo y el 12 de septiembre de 2026.
285 conversaciones con cliente real, 148 contactos.

---

## Hallazgo principal: cinco fuentes de precios compitiendo

El bot no inventa precios. Lee cinco fuentes distintas que se contradicen entre si, y en cada respuesta el modelo escoge una. Por eso aparecieron **20 precios diferentes** en las conversaciones.

Las cinco, en el orden en que `buildSystemPrompt()` las arma (`src/lib/openrouter.ts`):

| # | Fuente | Donde vive | Que dice |
|---|---|---|---|
| 1 | `bot_settings.custom_prompt` | Base de datos, editable desde `/api/prompt` | Kirkland liquido 6m $1,100 / 3m $600 · espuma 6m $2,100 / 3m $1,400 |
| 2 | `SYSTEM_PROMPT` | `src/lib/system-prompt.ts` | Balsamo $650 · Kirkland liquido 3m "$600 a $700" · **autoriza pago contra entrega** |
| 3 | `catalog_items` | Tabla sembrada desde `src/lib/catalog-seed.ts` | Balsamo 20% $489 · Balsamo 12% $450 · Tonico $470 · Kit 7% $380 · Kirkland foam 6m $2,200 |
| 4 | `active_promotion` | Sembrada en `src/lib/db.ts` con `enabled = 1` | Kirkland liquido 1m $199 · 2m $399 · 3m $499 · 6m $950 · 2 cajas $1,500 |
| 5 | `conversations.context_notes` | Por chat, desde el dashboard | Variable |

La fuente 2 solo actua si la 1 esta vacia, asi que no compite siempre. Las otras cuatro se inyectan **juntas, en el mismo system prompt**, en cada llamada.

### Por que gana la equivocada

`openrouter.ts` le dice al modelo, sobre la promocion, que tiene prioridad sobre precios o paquetes anteriores si aplica al producto preguntado.

O sea que la fuente 4 le gana por instruccion explicita a la 1 y a la 3. Y la fuente 4 es una promocion de remate que:

- dice **"Vigencia: solo hasta el 16 de mayo"** — vencio hace cuatro meses
- dice **"Caducidad: septiembre 2026"** — el producto caduca este mes
- se siembra con `enabled = 1`, o sea encendida por defecto
- pone el Kirkland liquido de 3 meses en **$499**, cuando el prompt dice **$600**

Eso explica los precios de $199, $399, $499, $950 y $1,500 que aparecen en las conversaciones. No eran alucinaciones del modelo: era la promocion vencida haciendo su trabajo.

### Resultado medible

Un cliente lo dijo textual en el chat: que revisaran el contestador porque los precios no son.

---

## Segundo hallazgo: el catalogo tiene precios invertidos

En `catalog-seed.ts`, tal como esta sembrado:

| Producto | Precio | Problema |
|---|---|---|
| 3 Balsamos 20% | $1,950 | |
| 6 Balsamos 20% | $1,850 | **El doble de producto sale mas barato** |
| 2 Shampoos 5 en 1 | $480 | |
| 3 Shampoos 5 en 1 | $479 | **Igual: 3 piezas cuestan menos que 2** |

El bot ha estado cotizando esto tal cual. Un cliente que pida 6 balsamos paga menos que uno que pida 3.

Ademas, el item "Balsamo Maximus 20%" trae una nota en el propio codigo diciendo que en Shopify el precio aparece invertido y que se use $489 como precio de venta. O sea que el desajuste ya se conocia y se parcho en el catalogo en vez de arreglarse en el origen.

---

## Tercer hallazgo: falta el producto mas pedido

**El Kirkland liquido no esta en `catalog_items`.** Solo esta la espuma (foam 1, 3 y 6 meses) y un combo de 3 Kirkland con shampoo.

El liquido es el **25.6%** de las conversaciones, contra 12.6% de la espuma. Se pide dos a uno. Cuando alguien pregunta por liquido, `searchRelevantCatalog()` no encuentra nada y el modelo se apoya en la promocion vencida.

---

## Que te piden, por volumen

| Tema | % de conversaciones |
|---|---|
| Ubicacion, horario y como llegar | 35.8% |
| Envio | 26.7% |
| Precio | 22.1% |
| Formas de pago | 16.1% |
| Disponibilidad o apartar | 14.4% |
| Resultados y uso | 11.2% |
| Fotos o catalogo | 8.1% |
| Descuento | 7.7% |
| Desconfianza y originalidad | 6.0% |

La logistica pesa mas que el precio. El cliente pregunta donde estas y si mandas a su estado antes de preguntar cuanto cuesta.

**Producto:** liquido 25.6% · Maximus 16.8% · espuma 12.6% · tonico 6.0% · biotina 5.3%

**Uso:** barba 18.2% · cabello 11.2%

---

## Estado del embudo

| Metrica | Valor |
|---|---|
| Conversaciones que llegaron a senal de pago | 17.2% |
| Conversaciones donde tuvo que entrar un humano | 66.7% |
| Conversaciones que mueren sin respuesta | 11.9% |
| Clientes que reescribieron solos tras mas de 1 h sin respuesta | 61 |
| Conversaciones sin ninguna respuesta del bot | 28 |
| Mediana de respuesta del bot | 4 segundos |
| Mediana de respuesta humana | 96 segundos (percentil 75: 23 minutos) |

Motivos por los que entra el humano, cuando se pudo identificar: ubicacion 26, envio 12, precio 8, dudas del producto 7, pago 5.

Volumen mensual de conversaciones nuevas: mayo 86 · junio 109 · julio 64 · agosto 53 · septiembre 28 (mes en curso).

---

## Otros problemas detectados

- **31 mensajes con caracteres chinos** enviados a clientes, pese a que `openrouter.ts` ya trae una instruccion anti-idioma al inicio del prompt. Es limitacion de `gpt-4o-mini` con `temperature: 0.4`.
- **Pago contra entrega ofrecido 8 veces.** No fue error del modelo: `system-prompt.ts` lo autoriza explicitamente. El prompt guardado en la base lo prohibe. Las dos instrucciones conviven.
- **Envio FedEx $140 cotizado en 49 conversaciones** sin que exista en ninguna fuente de precios.
- **13 conversaciones con foto o audio** que el bot no puede leer. Un cliente lo reclamo.
- **Dias invalidos:** lunes mencionado como disponible en 11 conversaciones, domingo en 6.
- **Neza descrito con horario libre o amplio** en 20 conversaciones, contra la politica de solo cita.

---

## Orden de arreglo propuesto

1. **Apagar o reescribir la promocion sembrada.** Esta vencida desde mayo y le gana en prioridad a todo lo demas. Es el cambio de una linea con mayor impacto de todo el sistema.
2. **Dejar una sola fuente de precios.** El catalogo manda; el prompt deja de repetir precios. Hoy estan en tres lugares.
3. **Arreglar los paquetes invertidos** y dar de alta el Kirkland liquido.
4. **Quitar la autorizacion de contra entrega** de `system-prompt.ts`.
5. **Filtro de salida (guardrail)** que valide la respuesta contra el catalogo antes de enviarla.
6. **Autorespuesta fuera de horario y seguimiento a las 2 horas**, para las 34 conversaciones que mueren calladas.
7. **Cambiar de modelo**, por los caracteres chinos.

Los puntos 1 a 4 son configuracion y datos, no requieren codigo nuevo. El 5 y el 6 si.

---

## Como medir si mejoro

En dos o tres semanas, revisar `/metricas` y comparar:

| Metrica | Hoy | Meta |
|---|---|---|
| Conversaciones con intervencion humana | 66.7% | menos de 40% |
| Chats que mueren sin respuesta | 11.9% | menos de 3% |
| Precios distintos dichos por el bot | 20 | los del catalogo |
| Conversaciones con senal de pago | 17.2% | arriba de 25% |
