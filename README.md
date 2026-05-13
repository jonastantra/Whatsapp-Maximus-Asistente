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
PAYMENT_INFO_TEXT=Bancomer: TITULAR..., CLABE..., tarjeta/cuenta... Banamex: TITULAR..., CLABE..., tarjeta/cuenta...
PAYMENT_EXTRA_INSTRUCTIONS=Bancomer es la cuenta principal. Pedir comprobante despues de pagar.
```

Cuando el cliente pida cuenta, depósito, transferencia, CLABE, tarjeta, comprobante o atención humana, el bot manda aviso al WhatsApp configurado.

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
- Auto cambio a `HUMAN` cuando el bot derive a asesor humano.
- WebSocket o SSE para reemplazar polling.
- Autenticación integrada en Next.js.
