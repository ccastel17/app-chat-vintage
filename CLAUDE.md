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
la pantalla del actor, como si fuera una conversación real. El actor también
puede escribir y enviar sus propios mensajes desde `/device` (tiene su
propio composer), y esos mensajes se ven en vivo en el hilo del Panel de
Control — la conversación fluye en ambos sentidos, no solo desde el director.

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
  - Lista de dispositivos (rooms nombradas + Presence para saber quién está
    online ahora); botón "+ Nuevo dispositivo" para crear una room de
    antemano, antes de que el actor abra el link
  - Panel para nombrar/renombrar la room activa: nombre interno (para el
    director) y nombre de contacto (lo que ve el actor) — funciona igual
    para nombrar de antemano que para renombrar una que ya está conectada
  - Hilo de mensajes de la room activa (historial + tiempo real) — visibilidad
    completa de la conversación, incluido lo que escribe el actor
  - Controles para enviar mensajes (toggle incoming/outgoing), simular
    "escribiendo...", marcar como "visto", simular llamada entrante
- `/device/[roomId]` → interfaz del actor
  - Vista de chat en pantalla completa, recibe todo en tiempo real
  - Composer propio: el actor escribe y envía sus mensajes (quedan como
    `direction: outgoing`, mismo valor que usa el director al simular una
    respuesta del actor — visualmente son indistinguibles)
  - Debe verse indistinguible de una app de mensajería real

## Modelo de datos (Supabase)
Ver `supabase/schema.sql` (schema completo) y `supabase/migrations/` (cambios
incrementales ya aplicados — no volver a correr `schema.sql` entero contra
una base existente, `create policy` no soporta `if not exists`).

Tabla `messages`:
- `id` (uuid, pk)
- `room_id` (text) — identifica la "conversación"/dispositivo
- `sender` (text) — quién envía (nombre del contacto simulado)
- `content` (text)
- `status` (text) — enviado | entregado | visto
- `direction` (text) — incoming | outgoing (si el mensaje lo "escribe" el
  contacto simulado o el actor; define el lado de la burbuja en `/device`)
- `created_at` (timestamp)

Tabla `rooms` (nombre de cada dispositivo/conversación):
- `room_id` (text, pk) — el mismo valor que `messages.room_id` y el
  segmento de la URL `/device/[roomId]`
- `label` (text) — nombre interno, solo lo ve el director en `/control`
- `contact_name` (text) — nombre del contacto simulado, lo ve el actor en
  el header de `/device`
- `contact_status` (text) — texto de estado bajo el nombre (ej. "en línea",
  "últ. vez hoy a las 14:32"); se pisa temporalmente por "escribiendo..."
  cuando corresponde, sin perder el valor guardado
- `created_at` (timestamp)

Una room puede existir sin haber sido nombrada nunca (el actor abrió el
link directo) — en ese caso `/device` cae a los defaults ("Contacto"/"en
línea") y `/control` la lista igual como "sin nombrar" (vía Presence).

RLS habilitado en ambas tablas con policies públicas de select/insert/update
(no hay autenticación de usuarios; el `room_id` actúa como código de acceso
informal). La `publishable key` de Supabase está pensada para exponerse en
el cliente, por eso vive directo en `src/shared/supabaseClient.js`.

La lista de dispositivos en `/control` combina dos fuentes: `rooms` (quién
tiene nombre, aunque esté offline) + **Supabase Realtime Presence** (canal
`presence:devices`, quién está online ahora mismo) — cada `/device/[roomId]`
se anuncia al abrirse.

Por `room_id` hay un canal Realtime (`room:<roomId>`) que combina:
- `postgres_changes` (insert/update) sobre `messages` filtrado por ese room
- `postgres_changes` (update) sobre `rooms` filtrado por ese room — así
  `/device` refleja un renombre en vivo sin recargar
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
- El actor puede escribir y enviar mensajes desde `/device` (composer
  propio); `/control` tiene hilo de mensajes en vivo para ver toda la
  conversación en ambos sentidos
- Manifest dinámico por room + íconos placeholder generados
- UI realista de `/device` (fase 2): avatar con inicial, header que
  cambia a "escribiendo..." en vivo, burbujas con cola y animación de
  entrada, checks de estado (✓/✓✓/✓✓ visto), burbuja de "escribiendo..."
  con puntitos animados, pantalla de llamada entrante con avatar
  pulsante y botones aceptar/rechazar
- Panel de control completo (fase 3): tabla `rooms` para nombrar
  dispositivos (nombre interno + nombre de contacto + estado), crear
  dispositivos de antemano desde `/control`, renombrado en vivo reflejado
  en `/device` sin recargar
- Pendiente: integración Playwright/ffmpeg (fase 4), reemplazar íconos
  placeholder por diseño final, probar instalación real en Android
