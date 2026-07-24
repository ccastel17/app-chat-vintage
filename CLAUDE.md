# Proyecto: App Chat falsa para rodaje

## Qué es
PWA que simula una app de mensajería (tipo WhatsApp/iMessage), usada como prop
de utilería en un rodaje en Barcelona. No es una app de mensajería real: es una
puesta en escena controlada en vivo por el equipo de dirección.

Hay dos roles/interfaces:
- **Panel de Control** (lo usa el director/asistente de dirección)
- **Dispositivo** (lo usa el actor, en su propio móvil/tablet, en pantalla completa)

El director dispara mensajes, estados ("escribiendo...", "visto", llamada
entrante, etc.) desde el Panel de Control, y estos aparecen en tiempo real en
la pantalla del actor, como si fuera una conversación real.

## Objetivo del proyecto
Que el director pueda operar el setup de forma autónoma en el set, sin
necesidad de un técnico presente. Debe ser robusto, simple de usar bajo
presión de tiempo de rodaje, e instalable como app en los dispositivos.

## Stack técnico
- **Frontend**: HTML/CSS/JS vanilla (sin framework, salvo que se decida migrar
  explícitamente — si se migra, actualizar esta sección)
- **Backend / tiempo real**: Supabase (Realtime channels + tabla `messages` en
  Postgres)
- **Deploy**: Vercel
- **Pipeline de grabación** (separado de la app, no tocar sin avisar):
  Playwright (captura headless de la interfaz) + ffmpeg (composición) →
  genera salidas ProRes y WebM listas para compositing en post-producción

## Arquitectura de rutas
- `/control` → interfaz del director
  - Lista de dispositivos/actores conectados (por `room_id`)
  - Controles para enviar mensajes, simular "escribiendo...", marcar como
    "visto", disparar notificaciones, simular llamada entrante
- `/device/[roomId]` → interfaz del actor
  - Vista de chat en pantalla completa, recibe todo en tiempo real
  - Debe verse indistinguible de una app de mensajería real

## Modelo de datos (Supabase)
Tabla `messages` (única tabla; ver `supabase/schema.sql`):
- `id` (uuid, pk)
- `room_id` (text) — identifica la "conversación"/dispositivo
- `sender` (text) — quién envía (nombre del contacto simulado)
- `content` (text)
- `status` (text) — enviado | entregado | visto
- `direction` (text) — incoming | outgoing (si el mensaje lo "escribe" el
  contacto simulado o el actor; define el lado de la burbuja en `/device`)
- `created_at` (timestamp)

RLS habilitado con policies públicas de select/insert/update (no hay
autenticación de usuarios; el `room_id` actúa como código de acceso
informal). La `publishable key` de Supabase está pensada para exponerse en
el cliente, por eso vive directo en `src/shared/supabaseClient.js`.

No hay tabla de dispositivos/rooms: `/control` arma la lista dinámicamente
vía **Supabase Realtime Presence** (canal `presence:devices`) — cada
`/device/[roomId]` se anuncia al abrirse.

Por `room_id` hay un canal Realtime (`room:<roomId>`) que combina:
- `postgres_changes` (insert) sobre `messages` filtrado por ese room
- `broadcast` efímero para `typing`, `incoming_call` y `end_call` (no se
  persisten en la tabla)

## Reglas de estilo de código
- Sin frameworks pesados salvo que se indique explícitamente lo contrario
- Los componentes de UI deben imitar fielmente el lenguaje visual de apps de
  mensajería reales (burbujas, timestamps, avatares, indicador de
  "escribiendo...") — el realismo visual es crítico para el rodaje
- Priorizar estabilidad y simplicidad sobre features avanzadas
- Todo el código debe funcionar offline-tolerant en lo posible (el wifi del
  set puede ser inestable)

## No tocar sin avisar antes
- El pipeline de Playwright + ffmpeg ya funciona de forma independiente.
  Cualquier cambio al DOM/estructura de `/device/[roomId]` que pueda romper
  la captura debe explicarse y confirmarse antes de aplicarse.

## Convenciones de commits
- Commits pequeños y frecuentes
- Mensaje claro de qué fase/feature se tocó (ej: "feat(control): agregar
  botón de simular llamada entrante")

## Instalación en teléfonos (Android)
- Cada actor instala su propia room desde el navegador (Chrome → "Instalar
  app" / "Agregar a pantalla de inicio"), abriendo antes `/device/[roomId]`
  con el `roomId` que le corresponde.
- El manifest es dinámico (`api/manifest.js`, function de Vercel): cada
  room sirve un manifest con `start_url` propio, así el ícono instalado
  abre siempre esa conversación, sin que el actor tenga que navegar.
- `display: standalone` (no `fullscreen`): oculta la barra del navegador
  pero deja la barra de estado del sistema, igual que una app real.
- `/control` no se instala, se usa desde navegador normal (decisión del
  equipo — no tiene manifest ni ícono).

## Estado actual
- Repo en GitHub: `ccastel17/app-chat-vintage` (conectado a Vercel, deploy
  automático en cada push a `main`)
- Proyecto Supabase creado (`App Chat Vintage`, región Stockholm), schema
  aplicado
- `/device` y `/control` conectados a Supabase Realtime (mensajes,
  presencia, "escribiendo...", "visto", llamada entrante) — probado en
  local con `vercel dev` y funcionando
- Manifest dinámico por room + íconos placeholder generados
- Pendiente: UI realista de chat (fase 2), panel de control completo (fase
  3), integración Playwright/ffmpeg (fase 4), reemplazar íconos placeholder
  por diseño final, probar instalación real en Android
