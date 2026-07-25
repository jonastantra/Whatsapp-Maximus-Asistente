# Agente WhatsApp local con IA

Dashboard local en Next.js para conectar un número real de WhatsApp vía Baileys, guardar conversaciones en SQLite y responder con un LLM usando OpenRouter.

## Requisitos

- Node.js 20.9+ recomendado Node 22
- Una cuenta de OpenRouter
- WhatsApp en el teléfono que vas a vincular

## Configuración

1. Instala dependencias:

```bash
npm install
```

2. Copia `.env.example` a `.env.local` y completa tu API key:

```env
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Recomendación: usa `openai/gpt-4o-mini`. Los modelos `:free` de OpenRouter tienen límites muy estrictos y suelen fallar con error 429 en uso real.

## Uso local

En una terminal:

```bash
npm run start:bot
```

En otra terminal:

```bash
npm run dev
```

Abre `http://localhost:3000`. Si no hay sesión guardada, verás la pantalla para conectar el número con un QR grande. Baileys también imprime el QR en ASCII en la terminal como respaldo de debugging.

Cuando escanees el QR, la sesión se guarda en `./auth/`. En reinicios posteriores no se volverá a pedir QR mientras WhatsApp mantenga viva esa sesión.

## Modos por conversación

- `IA`: el bot responde automáticamente con el historial reciente y el prompt del sistema.
- `HUMAN`: el bot solo guarda mensajes entrantes. El dashboard habilita el input para responder manualmente.

Los mensajes manuales se guardan como `human`, se encolan en SQLite y el proceso bot los envía por WhatsApp cada 2 segundos.

## Promociones en vivo

En el dashboard usa el botón `Promocion` para editar una promoción activa sin subir cambios a GitHub ni redeployar.

La promoción se guarda en SQLite y el bot la lee en cada respuesta. Puedes activarla, desactivarla o cambiar el texto cuando quieras.

Ejemplo:

```text
Promo de hoy: remate de Minoxidil Kirkland 3 meses en $___, hasta agotar existencias. Si pregunta por Kirkland, ofrecer esta promo primero.
```

## Pagos y alertas

Configura en EasyPanel:

```env
OWNER_ALERT_PHONE=5215585747455
MANAGED_WHATSAPP_PHONE=52155XXXXXXXX
PAYMENT_INFO_TEXT=Bancomer: TITULAR..., CLABE..., tarjeta/cuenta... Banamex: TITULAR..., CLABE..., tarjeta/cuenta...
PAYMENT_EXTRA_INSTRUCTIONS=Bancomer es la cuenta principal. Pedir comprobante despues de pagar.
```

Cuando el cliente pida cuenta, depósito, transferencia, CLABE, tarjeta, comprobante o atención humana, el bot manda aviso al WhatsApp configurado.

`OWNER_ALERT_PHONE` también autoriza los comandos `/pausar`, `/activar`,
`/humano ID`, `/ia ID` y `/responder ID texto`. La autorización revisa tanto
el identificador LID como el número alternativo que entrega WhatsApp; por eso
un mensaje desde el teléfono personal autorizado hacia el número administrado
no se confunde con un mensaje propio ni se descarta. `MANAGED_WHATSAPP_PHONE` es una
comprobación diagnóstica: si por accidente se vincula otra cuenta, el bot lo
deja explícito en `data/bot-events.log`.

## Entrega fiable de mensajes

Todos los textos salientes del dashboard y de la IA pasan por una cola
persistente. El dashboard muestra:

- `Pendiente de confirmación` mientras Baileys procesa el mensaje.
- `Enviado` cuando WhatsApp devuelve un identificador de mensaje.
- `No confirmado` cuando falla después de reintentos o pasan 30 segundos sin
  respuesta.

Los errores normales se reintentan hasta tres veces con espera creciente. Un
timeout no se reintenta automáticamente porque el servidor podría haber
aceptado el mensaje aunque no haya contestado; así se evitan duplicados. En ese
caso usa `Reintentar` manualmente después de revisar el teléfono.

La integración usa `baileys` 7, que incluye el manejo actual de LID/PN y
mejoras de sesiones y reenvío. La sesión existente de `./auth` se conserva. Si
WhatsApp la invalida, usa `Reiniciar conexión`; restablece la sesión solo como
último recurso porque obliga a escanear un QR nuevo.

## Exportar contactos y conversaciones

El botón `Exportar` abre un selector privado:

1. Usa `Exportar todos los chats` para descargar en un solo CSV todos los
   mensajes y conversaciones retenidos por esta aplicación. Los chats marcados
   como `No exportar` se omiten incluso si se llama directamente a la API.
2. Usa `Exportar todos los números` para crear un CSV compatible con Google
   Contacts sin selección manual. Los números se normalizan y deduplican; el
   archivo aclara que el estado de la agenda del teléfono no está disponible.
3. Para una exportación parcial, busca y marca únicamente los chats que quieres
   incluir.
4. Opcionalmente clasifícalos como `Negocio`, `Personal`, `No exportar` o
   déjalos `Sin clasificar`. La clasificación solo ayuda a filtrar; nunca
   excluye automáticamente el teléfono personal ni otro chat.
5. Descarga:
   - `Contactos para Google`: CSV con columnas compatibles con Google
     Contacts.
   - `Exportar chats`: JSONL estructurado o CSV ligero, con filtro de fechas.

El nombre disponible es el nombre mostrado por WhatsApp (`pushName`), no una
prueba de que el contacto esté guardado en la agenda. El CSV lo dice
explícitamente y deja vacío el teléfono si WhatsApp solo expuso un LID, en vez
de inventar datos.

El resumen opcional de JSONL es determinista y local: cuenta mensajes, separa
roles, extrae términos frecuentes y agrega un extracto reciente. No llama a
OpenRouter ni envía conversaciones a ninguna IA. El archivo resultante sí se
puede entregar manualmente a otra herramienta bajo decisión del usuario.

La exportación total significa **todo lo almacenado en `data/messages.db`**.
No puede reconstruir conversaciones anteriores a la instalación, mensajes que
WhatsApp/Baileys nunca entregó al proceso, ni chats que ya fueron borrados de la
base local.

Para la exportación total de contactos, un registro que solo tenga LID y no
incluya un JID de número telefónico se omite: un LID no se convierte ni se
presenta como si fuera un teléfono. El panel informa cuántos registros
solo-LID fueron omitidos y cuántos números duplicados se unificaron.

## Personalizar el prompt

Edita `src/lib/system-prompt.ts`. Ese texto se manda como system prompt a OpenRouter para cada respuesta automática.

## Datos locales

- `./data/messages.db`: base SQLite con conversaciones, mensajes, estado de conexión y outbox.
- `./auth/`: sesión de WhatsApp Web de Baileys.

Ambas carpetas están ignoradas por git.

## Desconectar

El botón `Desconectar` del dashboard borra la sesión de `./auth/`, marca la conexión como desconectada y pide al bot reiniciar limpio. Después aparecerá un QR nuevo.

## Producción en EasyPanel/Railway sin Docker

Incluye:

- `Procfile`
- `nixpacks.toml`
- `.nvmrc`

`nixpacks.toml` define la instalación, `npm run build` y el arranque con
`npm run start:all`; no decide qué rama despliega el panel ni activa por sí
solo un webhook. En EasyPanel, la fuente del servicio debe apuntar a este
repositorio y a la rama `main`. Si `Auto Deploy` está habilitado, cada push
dispara el despliegue; si no, usa el botón `Deploy` o el webhook del servicio.
Tras desplegar, el modal debe mostrar `Exportaciones completas` y los botones
`Exportar todos los números` y `Exportar todos los chats`.

El exportador también aparece en la pantalla de QR/reconexión como
`Exportar datos guardados`; no depende de que WhatsApp esté conectado.

Configura volúmenes persistentes obligatorios:

- `/app/data`
- `/app/auth`

Sin esos volúmenes, cada redespliegue pierde conversaciones y obliga a escanear el QR de nuevo.

## Seguridad bloqueante antes de publicar

Este dashboard no tiene autenticación. Si lo expones a internet sin protección, cualquiera con la URL puede leer conversaciones y enviar mensajes como el dueño del número.

Antes de producción, agrega Basic Auth a nivel proxy de EasyPanel, Caddy, Nginx o usa Cloudflare Access.

## Problemas comunes

### El bot entra en loop con code 440

Verifica que se esté usando `Browsers.macOS("Desktop")`. Este proyecto ya lo hace. Luego borra dispositivos viejos en WhatsApp: Configuración, Dispositivos vinculados. Si persiste en VPS, cambia de IP o espera 24 horas.

### Error 429 en OpenRouter

El modelo gratuito saturó cuota. Cambia `OPENROUTER_MODEL` a `openai/gpt-4o-mini`.

### Un mensaje muestra “Esperando este mensaje” o no dispara una regla

1. Confirma en `data/bot-events.log` que el evento tenga `remoteJid` y
   `remoteJidAlt`. Para el teléfono personal autorizado, basta que cualquiera
   de los dos corresponda a `OWNER_ALERT_PHONE`.
2. Confirma que `fromMe` sea `false`. Dos cuentas distintas —teléfono personal
   y cuenta administrada— deben verse como remitente externo aunque ambas sean
   tuyas.
3. Revisa que el dashboard muestre `Enviado`. Si queda `No confirmado`, revisa
   el teléfono antes de pulsar `Reintentar`.
4. Si la cuenta usa coexistencia con WhatsApp Cloud API, prueba sin
   coexistencia: esa modalidad sigue siendo experimental en Baileys.

### Procesos zombies en Windows

Si `Ctrl+C` no mata hijos de `tsx`, revisa procesos con:

```powershell
tasklist | findstr node
```

Y mata el PID necesario:

```powershell
taskkill /PID 12345 /F
```

## Mejoras pendientes

- Soporte de imágenes salientes.
- Tools/function calling con OpenRouter.
- WebSocket o SSE para reemplazar polling.
- Autenticación integrada en Next.js.
