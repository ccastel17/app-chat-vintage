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

Cada dispositivo tiene una **lista de chats** (como el home de WhatsApp), no
una única conversación. Cada entrada de esa lista es:
- **simulada**: contacto inventado, el director escribe ambos lados desde
  `/control` (esto es lo descrito en el párrafo anterior)
- **linkeada**: apunta a otro dispositivo real (otro actor). Esos mensajes
  son reales entre los dos actores, en vivo, sin pasar por el director — el
  director solo puede verla desde `/control`, no escribir ahí

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
- `/control` → mensajería en vivo del director
  - Lista de dispositivos (rooms + Presence para saber quién está online
    ahora); botón "+ Nuevo dispositivo" para crear uno de antemano
  - Panel para renombrar el dispositivo activo (`rooms.label`, nombre
    interno — el resto de la identidad del contacto vive en `conversations`,
    ver más abajo)
  - Selector de conversación del dispositivo activo (pestañas 💬 simulada /
    🔗 linkeada). Al elegir una:
    - **simulada**: hilo + composer + controles (toggle incoming/outgoing,
      simular "escribiendo...", marcar como "visto", simular llamada)
    - **linkeada**: hilo de solo lectura (mensajes reales entre dos
      actores) — composer y controles de simular deshabilitados/ocultos,
      excepto "Simular llamada entrante" que sigue disponible
  - Modal "Apariencia" (🎨): editor de skins con preview en vivo tipo
    mini-teléfono
- `/control/contacts` → gestión de la lista de chats de cada dispositivo
  (separado de la mensajería en vivo a propósito, ver decisión de producto)
  - Por dispositivo: crear/editar/eliminar contactos simulados (nombre,
    estado, foto de avatar) y crear/deshacer links reales con otro actor
  - "🔗 + Linkear con otro actor" crea DOS conversaciones (una en la lista
    de cada dispositivo) que comparten `thread_id`
- `/device/[roomId]` → **lista de chats** del actor (home, como WhatsApp)
  - Cada fila: avatar, nombre de contacto, preview del último mensaje
  - Tocar una fila navega a `/device/[roomId]/chat/[conversationId]`
- `/device/[roomId]/chat/[conversationId]` → el chat individual
  - Vista de chat en pantalla completa, recibe todo en tiempo real
  - Composer propio: el actor escribe y envía sus mensajes — en threads
    linkeados esto es mensajería real (el otro actor lo recibe en vivo,
    incluido el "escribiendo..." mientras tipea, broadcast por input);
    en threads simulados queda como `direction: outgoing`, igual que
    cuando el director simula una respuesta del actor
  - Debe verse indistinguible de una app de mensajería real

## Modelo de datos (Supabase)
Ver `supabase/schema.sql` (schema completo) y `supabase/migrations/` (cambios
incrementales ya aplicados — no volver a correr `schema.sql` entero contra
una base existente, `create policy` no soporta `if not exists`).

Tabla `rooms` (identidad del dispositivo físico, no del contacto):
- `room_id` (text, pk) — el segmento de la URL `/device/[roomId]`
- `label` (text) — nombre interno, solo lo ve el director
- `created_at` (timestamp)

Tabla `conversations` (una fila = una entrada en la lista de chats de un
dispositivo):
- `id` (uuid, pk)
- `room_id` (text, fk → `rooms`) — de qué dispositivo es esta entrada
- `kind` — `simulated` | `linked`
- `contact_name`, `avatar_url`, `contact_status` — identidad del contacto
  que ve el actor (se pisa temporalmente `contact_status` por
  "escribiendo..." sin perder el valor guardado)
- `linked_room_id` (text, fk → `rooms`, solo si `kind='linked'`) — el otro
  dispositivo real
- `thread_id` (uuid) — agrupa los mensajes. En una conversación `linked`,
  **dos filas** (una por dispositivo) comparten el mismo `thread_id`, así
  ambos actores ven los mismos mensajes
- `created_at` (timestamp)

Avatar: se sube desde `/control/contacts` a Supabase Storage (bucket
público `avatars`); si no hay foto, `/device` muestra un círculo con la
inicial del nombre.

Tabla `messages` (agrupados por `thread_id`, no por dispositivo):
- `id` (uuid, pk)
- `thread_id` (uuid) — a qué conversación pertenece
- `sender_room_id` (text, nullable) — quién escribió de verdad. Solo se usa
  en threads `linked`: ahí "entrante/saliente" depende de quién lo mira
  (el mismo mensaje es saliente para quien lo escribió, entrante para el
  otro actor) y por eso no puede ser un valor fijo
- `content` (text)
- `status` (text) — enviado | entregado | visto
- `direction` (text, nullable) — incoming | outgoing. Solo se usa en
  threads `simulated`, donde el director lo define explícitamente
- `created_at` (timestamp)

`src/shared/conversation.js` (`isOutgoing(conversation, message, myRoomId)`)
centraliza esta lógica dual: si `conversation.kind === 'linked'` compara
`sender_room_id` contra quién mira; si no, usa `direction` tal cual. La usan
`/device/chat` (para renderizar el lado de la burbuja) y `/control` (para el
hilo de lectura, usando `conversation.room_id` como "quién mira").

Una room puede no tener ninguna conversación todavía (recién creada desde
`/control`, sin nombrar ni linkear) — `/device` muestra "Todavía no tenés
chats" y `/control` muestra un link a Contactos para agregar una.

Tabla `skins` (paletas/tipografías reutilizables entre rodajes):
- `id` (uuid, pk), `name` (unique)
- `mode` — light | dark (define ink/superficie/bordes derivados)
- `bg`, `bubble_incoming_bg`, `bubble_outgoing_bg`, `tick_color`,
  `tick_seen_color` — colores en hex
- `font_family` — system | rounded | mono
- `font_size` — sm | md | lg

Un solo skin está "activo" para todo el rodaje a la vez, vía
`app_settings` (fila única, `id=1`, `active_skin_id` → `skins.id`). No es
por dispositivo — es una decisión de producto (más simple de operar), ver
`src/shared/skin.js` si en algún momento se necesita por-room.

`src/shared/skin.js` traduce una fila de `skins` a tokens CSS concretos:
deriva superficie/bordes (mezclando `bg` con blanco o negro según `mode`)
y el color de texto de cada burbuja (contraste automático por luminancia),
así el formulario del editor no le pide esos campos al usuario. Lo usan
`/device` (aplica en `:root` vía `applySkinVars`) y `/control` (preview en
vivo del editor, aplicado a un contenedor scoped, no a `:root`).

3 skins base vienen cargados en el schema: "WhatsApp oscuro" (el look
original de la app, activo por default), "iMessage claro", "Vintage"
(mono, paleta sepia — le pega al nombre del proyecto). Nuevos rodajes que
reusen este repo arrancan con estos tres.

RLS habilitado en todas las tablas con policies públicas de
select/insert/update/delete (no hay autenticación de usuarios; el `room_id`
actúa como código de acceso informal). La `publishable key` de Supabase
está pensada para exponerse en el cliente, por eso vive directo en
`src/shared/supabaseClient.js`. Nota: `rooms` es la única tabla sin policy
de `delete` pública — borrar un dispositivo hoy requiere entrar al Table
Editor de Supabase a mano, no hay UI para eso.

La lista de dispositivos en `/control` y `/control/contacts` combina dos
fuentes: `rooms` (quién tiene nombre, aunque esté offline) + **Supabase
Realtime Presence** (canal `presence:devices`, quién está online ahora
mismo) — cada `/device/[roomId]` (la lista) se anuncia al abrirse.

Por `thread_id` hay un canal Realtime (`thread:<threadId>`) que combina:
- `postgres_changes` (insert/update) sobre `messages` filtrado por ese thread
- `postgres_changes` (update) sobre `conversations` filtrado por ese id —
  así `/device/chat` refleja un renombre en vivo sin recargar
- `broadcast` efímero para `typing`, `incoming_call` y `end_call` (no se
  persisten en la tabla). En threads `linked`, ambos dispositivos escuchan
  el mismo canal, así el "escribiendo..." de un actor real le llega al
  otro (se dispara solo, con el evento `input` del composer — no hace
  falta que el director lo simule)

`/device/[roomId]` (la lista) además escucha `postgres_changes` sobre
`conversations` filtrado por `room_id` (para agregar/quitar chats en vivo)
y sobre `messages` sin filtro, descartando en el cliente lo que no
pertenece a sus threads (evita reconstruir el filtro cada vez que cambia
la lista de conversaciones).

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
- Apariencia customizable (skins): tabla `skins` + `app_settings` (un
  skin activo global), editor con preview en vivo en `/control`, 3 skins
  base para reutilizar entre rodajes, avatar de contacto vía Storage
- Lista de chats + mensajería actor-a-actor real: cada dispositivo tiene
  varias conversaciones (`/device/[roomId]` es la lista, el chat se movió
  a `/device/[roomId]/chat/[conversationId]`). Panel separado
  `/control/contacts` para crear contactos simulados o linkear dos actores
  entre sí; en `/control` el director elige conversación además de
  dispositivo, con el hilo en solo lectura cuando es `linked`. Probado
  end-to-end con Playwright: migración de datos previos, mensajería real
  bidireccional entre dos actores linkeados (incluido "escribiendo..."
  organico), y el modo lectura del director
- Pendiente: integración Playwright/ffmpeg (fase 4), reemplazar íconos
  placeholder por diseño final, probar instalación real en Android, UI
  para borrar dispositivos (hoy requiere Table Editor de Supabase)
