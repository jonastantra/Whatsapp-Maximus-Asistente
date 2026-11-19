# Changelog — Agente WhatsApp Maximus

Registro de cambios para que cualquier persona o IA sepa qué se hizo, cuándo y por qué.
Lo más nuevo va arriba. Formato: fecha · quién · qué cambió.


## 2026-11-19 · Sala de agentes (Claude Code)
- Página nueva /sala: John ve y escribe en vivo con Poly, Panchito y Claude (se actualiza cada 10 s), con canales (#decisiones-john, #precios, #anuncios, #tienda, #whatsapp-correo, #ideas).
- Usa el mismo buzón que la puerta de agentes (mensajes.sqlite3), al que se le agregaron las columnas canal, estado, aprobado_por y aprobado_ts. Lo que manda John queda como de=john.
- Botones Aprobar y Rechazar en los mensajes de los agentes: solo el usuario del panel de John (SALA_USUARIOS_JOHN, por defecto «maximus»). El usuario «jefa» puede escribir, pero no aprobar ni usar #decisiones-john.
- Caddy pasa X-Usuario al panel. Respaldos: Caddyfile.antes-sala, mensajes.antes-sala-20261119.sqlite3, .next-resguardo-20261119.

## 2026-11-17 · Claude
- **Código de cliente** `AAMMDD.ID` (ej. `260606.3179`): día del primer mensaje + número de chat. Se guarda en `conversations.codigo`, se llena solo con un trigger al crear cada chat y se rellenó en los 489 existentes. Se ve en la lista, en el título del chat y en el buscador; también en `maximus cliente`.
- Si el nombre guardado es el de la propia cuenta («Maximus Inc…»), el panel muestra el número del cliente en lugar de ese nombre.
- **Buscador** arriba de las conversaciones: nombre, teléfono, código o cualquier palabra del historial (`GET /api/conversations?q=`).
- Panel publicado en `https://whatsapp.johnbarbas.com` (túnel Cloudflare → Caddy con usuario y contraseña). Página `/cambiar-clave` para cambiar la contraseña desde el navegador (fuera de este repo, en el servidor).

## 2026-11-16 · Claude
- **Mensajes perdidos**: WhatsApp a veces manda primero un aviso vacío (mensaje aún cifrado) y luego el texto real con el mismo id. Ya no se marca como visto el vacío, así el texto real sí se guarda y se contesta.
- Anti-duplicados de texto en base de datos (`inbound_text_events`, 30 días), sobrevive reinicios.
- El nombre del cliente ya no se pisa con «Maximus Inc» en mensajes propios.
- Respuestas a **estados** de WhatsApp se reconocen aunque el estado no tenga texto (imagen o video).
- Registro de la respuesta bloqueada cuando la IA menciona un precio fuera del catálogo.

## 2026-11-10 al 2026-11-15 · varias IAs
- Envíos y guías por cliente (`envios-cliente`), imágenes por WhatsApp, horario de sucursal, seguridad de respuestas (no cobrar sin verificar, precios del catálogo), respaldo de suscripción y pruebas.
