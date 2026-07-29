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
- `/` → landing del proyecto (`src/home/`): copy de qué es, botón grande a
  `/control`, grilla de accesos por actor ya creado con botón **"Copiar
  link"** (clipboard, para pasarle la URL real de instalación al actor
  por WhatsApp/lo que sea) y "Abrir →" (para que el director lo pruebe),
  y un resumen de "cómo funciona". Pensada para compartir con quien va a
  probar el producto
- `/control` → mensajería en vivo del director
  - Lista de dispositivos (rooms + Presence para saber quién está online
    ahora); botón "+ Nuevo dispositivo" para crear uno de antemano; por
    dispositivo, dos acciones rápidas a una pestaña nueva — "💬 Ver chat"
    (`/device/[roomId]`, la pantalla real que ve el actor, de solo vista)
    y "📝 Editar lista" (`/control/contacts?room=[roomId]`, salta directo
    a ese dispositivo ya seleccionado ahí). En desktop, nombre arriba y
    acciones (con label) abajo — los 240px fijos de la sidebar no
    alcanzan para nombre + dos botones con texto en un solo renglón; en
    mobile/tablet (`≤860px`) todo en una fila compacta, solo ícono sin
    label, porque ahí la lista es una tira horizontal scrolleable (ver
    Responsive más abajo)
  - Panel "Nombre del actor" (`rooms.label` + `rooms.avatar_url`) arriba de
    todo: cómo identifica el director a ese dispositivo en los paneles —
    nunca lo ve el actor, no tiene relación con `conversations.contact_name`
    (eso es lo que el actor sí ve, por chat). Si no se completa, la UI cae
    al `room_id` crudo. La foto también sirve como default al crear un
    nuevo link con otro actor (cada lado la puede sobreescribir después
    desde `/control/contacts`, igual que el nombre). "🗑️ Eliminar
    dispositivo" (con confirmación, no se puede deshacer) borra el
    `room`, lo que cascadea sus `conversations` en ambos lados de
    cualquier link (FK `on delete cascade` en `room_id` y
    `linked_room_id`); los `messages` de esos threads no tienen FK a
    `conversations` así que se borran a mano antes, para no dejarlos
    huérfanos. Colapsado detrás de un ícono ⚙️ junto al nombre del
    dispositivo — es edición de setup, no algo que se toque a cada rato
    en vivo, y ocupaba espacio de forma permanente. Colapsa de nuevo
    (por default) cada vez que se cambia de dispositivo
  - Selector de conversación del dispositivo activo (desplegable "Hablando
    en nombre de", 💬 simulada / 🔗 linkeada — antes eran pestañas, se
    cambió a desplegable porque no dejaba claro con qué contacto se estaba
    hablando), agrupado visualmente junto al toggle incoming/outgoing en
    `#speaker-control` (antes el toggle quedaba suelto al lado del
    composer, sin relación visual clara con el selector). Al elegir una:
    - **simulada**: hilo + composer + controles (toggle incoming/outgoing,
      simular "escribiendo...", marcar como "visto", simular llamada). El
      propio composer también dispara "escribiendo..." solo mientras el
      director tipea (debounce de 2s de inactividad, o al enviar) — igual
      que el composer del actor en threads `linked`; el botón "Simular
      'escribiendo...'" queda aparte para poder simular tipeo sin llegar
      a escribir nada (pausa dramática, etc.)
    - **linkeada**: hilo en vivo (mensajes reales entre dos actores) —
      toggle y controles de simular deshabilitados/ocultos (no aplican:
      no hay "direction" que definir, ya está escribiendo/typing es
      orgánico), excepto "Simular llamada entrante" y borrar mensajes
      (ver abajo). El composer SÍ está habilitado, a modo de excepción:
      lo que se escriba se guarda con `sender_room_id` = el OTRO actor
      (`linked_room_id`, nunca el dueño de la lista que se está mirando
      — si ese estuviera disponible no haría falta inyectar nada) y
      `injected_by_director = true`. Para los dos actores es
      indistinguible de un mensaje real (ni siquiera el propio actor
      "suplantado" lo nota en su dispositivo); en `/control` se ve
      marcado con 🎬 y un borde punteado, solo ahí, para que el
      director pueda diferenciar después qué fue orgánico. Pensado para
      cuando un actor se queda sin batería/señal a mitad de escena y no
      hay margen para frenar la toma
  - Borrado de mensajes: ✕ por burbuja en el hilo (individual) y "🗑️
    Vaciar chat" arriba de los controles (borra todo el `thread_id`
    activo, con confirmación — no se puede deshacer). Disponible en
    conversaciones simuladas y linkeadas por igual. Se propaga en vivo a
    `/device/chat` (por eso `messages` tiene `replica identity full`: el
    filtro por `thread_id` de Realtime necesita el "old record" completo
    para decidir a quién le llega un evento de `delete`, que por default
    solo trae la primary key)
  - Responsive: en pantallas angostas (`≤860px`) la lista de dispositivos
    pasa de columna lateral a tira horizontal scrolleable arriba, para
    poder operar el panel desde el celular o una tablet además de una
    notebook
  - Banner de notificación simulada: cada mensaje que "llega" al actor
    (simulado con dirección entrante, o inyectado en una linkeada — ver
    arriba) dispara automáticamente, sin botón aparte, un banner estilo
    notificación nativa en la pantalla del actor (avatar + nombre +
    preview, desliza desde arriba, se oculta solo a los ~4.5s, tap
    navega al chat). Oculto se esconde con `translateY(-100vh)`, no un
    `%` relativo a su propio alto — en un iPhone con notch/Dynamic
    Island, `env(safe-area-inset-top)` ya empuja el banner varias
    decenas de px hacia abajo antes de aplicar el transform, y un `%`
    no alcanza a compensar eso (quedaba un pedacito asomado arriba,
    solo visible en un dispositivo real, no en desktop/simulador sin
    notch). Se ve en `/device` (la lista) y en `/device/chat`
    de **cualquier otra** conversación que tenga abierta — si ya está
    mirando esa misma conversación no se muestra (no tiene sentido
    avisarle de algo que ya está viendo en vivo). Implementado con un
    canal Realtime de broadcast por dispositivo (no por thread, porque
    la notificación puede ser de un chat distinto al que el actor tiene
    abierto en ese momento) — `notificationsChannelName(roomId)` en
    `src/shared/supabaseClient.js`. No se evaluó Web Push real
    (funcionaría con el teléfono bloqueado) porque necesita backend
    propio (VAPID keys, guardar suscripción por dispositivo) y iOS
    Safari tiene soporte inestable incluso en PWA instalada — mucha
    superficie de falla para un rodaje en vivo. Al ser automático (sin
    botón propio) no era obvio para el director cuándo un envío iba a
    notificar — se agregó `#notify-hint`, un aviso junto al composer
    que aparece solo cuando el mensaje que está por mandar realmente
    va a disparar el banner (simulada + "📥 Mensaje del contacto"; en
    linkeada ya lo aclara `#linked-hint`, que siempre notifica)
  - `#quick-actions` agrupa, además de "escribiendo..."/"visto"/llamada/
    vaciar chat, dos herramientas más avanzadas como botones compactos
    (no cajas propias, para no comerse espacio vertical del hilo):
    - **"🚨 Pantalla de apagado/SOS"**: simula la pantalla que aparece al
      mantener presionado el botón de encendido de un iPhone ("deslizar
      para apagar" / "Ficha médica" / "Emergencia SOS") sobre lo que sea
      que el actor esté mirando en ese momento (lista o cualquier chat)
      — mismo canal de broadcast que las notificaciones
      (`notificationsChannelName`), a nivel dispositivo, no de
      conversación. Puramente visual: los tres sliders se pueden
      arrastrar (`src/shared/emergencyOverlay.js`, con Pointer Events)
      para que se vea real en cámara, pero ningún gesto dispara una
      acción real — al soltar, el thumb siempre vuelve a su posición
      inicial. El botón se convierte en "Cerrar pantalla" mientras está
      activa; el director la cierra a mano, a propósito no hay forma de
      que el actor la cierre él mismo (tiene que actuar la escena, no
      interrumpirla tocando la pantalla)
    - **"🔔 Notificar de otro contacto"**: despliega (colapsado por
      default, un click lo abre/cierra) un desplegable + input para
      notificar al actor de un chat DISTINTO al que el director tiene
      activo arriba, sin abandonar la vista actual (ej. mirando
      Paco↔Genis y querés que a Paco le llegue algo de "Jefe" sin
      cambiar de hilo). Desplegable con el resto de las conversaciones
      de ese mismo dispositivo (simuladas y linkeadas, excluida la
      activa). Siempre entrante — usa la misma lógica que la
      conversación activa (linkeada → `sender_room_id` del otro actor +
      `injected_by_director`; simulada → `direction: incoming`) pero
      ignora el toggle del composer principal, porque acá el único caso
      de uso es "le llega algo de otro lado". El mensaje queda guardado
      en esa otra conversación (no en la que se está mirando) y dispara
      el mismo banner de notificación. El botón no aparece si el
      dispositivo no tiene más chats que el activo; colapsa de nuevo
      cada vez que se cambia de conversación
  - Modal "Apariencia" (🎨): editor de skins con preview en vivo tipo
    mini-teléfono
- `/control/contacts` → gestión de la lista de chats de cada dispositivo
  (separado de la mensajería en vivo a propósito, ver decisión de producto)
  - Por dispositivo: crear/editar/eliminar contactos simulados (nombre,
    estado, foto de avatar) y crear/deshacer links reales con otro actor;
    "💬 Ver chat" por dispositivo, mismo estilo que en `/control` (acá no
    hace falta "Editar lista" — seleccionar el dispositivo en esta misma
    pantalla ya es editar)
  - En una conversación linkeada, nombre/foto/estado también son editables
    — son la identidad que ve ESE actor del otro, independiente por lado
    (renombrar del lado de A no toca lo que ve B) y del `room_id` del otro
    dispositivo (que solo se usa como valor inicial al crear el link)
  - "🔗 + Linkear con otro actor" crea DOS conversaciones (una en la lista
    de cada dispositivo) que comparten `thread_id`
  - Responsive, mismo criterio que `/control`
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
  - `/device/[roomId]` y `/device/[roomId]/chat/[conversationId]` son
    documentos HTML separados (no una SPA) — cada navegación entre
    lista↔chat recarga todo desde cero y reabre los canales Realtime, lo
    que genera un delay perceptible. Paliado con: (1) caché en
    `localStorage` (`chatlist:<roomId>` y `chat:<conversationId>`) que
    pinta instantáneo el último estado conocido apenas carga la página,
    mientras en paralelo se reconcilia con el fetch real — clave porque
    el actor entra y sale de los mismos chats varias veces por escena;
    (2) skeleton (placeholders grises con pulso) para la primera vez que
    se abre un chat, cuando todavía no hay nada en caché — el color del
    skeleton usa `--skin-line` (token del skin activo), y ese valor
    también se cachea (`src/shared/skin.js` → `cacheSkin`/
    `loadCachedSkin`, clave `activeSkin`) para que el skeleton pinte con
    el skin correcto desde el primer frame en vez del color default
    hardcodeado del CSS. **Se intentó**
    además una transición lateral con `@view-transition` nativo
    (cross-document) para disimular el delay restante, pero se descartó:
    incluso en el repro más mínimo posible (sin animaciones custom) el
    navegador tira "Transition was skipped" y deja de responder al click
    de volver — no se pudo verificar que fuera confiable, y un botón
    "volver" que se cuelga en pleno rodaje es peor que el delay
    original. No reintentar sin resolver antes ese problema

## Modelo de datos (Supabase)
Ver `supabase/schema.sql` (schema completo) y `supabase/migrations/` (cambios
incrementales ya aplicados — no volver a correr `schema.sql` entero contra
una base existente, `create policy` no soporta `if not exists`).

Tabla `rooms` (identidad del dispositivo físico, no del contacto):
- `room_id` (text, pk) — el segmento de la URL `/device/[roomId]`; **no
  se puede editar después de creado** (rompería la PWA ya instalada en
  el teléfono del actor, que tiene esta URL en su manifest/start_url)
- `label` (text, NOT NULL) — "Nombre del actor": cómo lo identifica el
  director en los paneles (ej. "Ana"). Se inserta igual a `room_id` al
  crear el dispositivo y se puede renombrar libremente después — a
  diferencia de `room_id`, esto no rompe nada porque no es parte de
  ninguna URL. Toda la UI del director muestra `label || room_id`
- `avatar_url` (text, nullable) — foto del actor como persona (no
  confundir con `conversations.avatar_url`, que es la foto de un
  contacto puntual). Se usa como default al linkear con otro actor
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
- `content` (text) — puede ir vacío (`''`) si el mensaje es solo una foto
- `image_url` (text, nullable) — foto adjunta al mensaje, subida a Storage
  (bucket público `chat-images`, separado de `avatars` porque son
  adjuntos de un mensaje puntual, no fotos de perfil). Un mensaje puede
  tener texto, foto, o ambos
- `status` (text) — enviado | entregado | visto
- `direction` (text, nullable) — incoming | outgoing. Solo se usa en
  threads `simulated`, donde el director lo define explícitamente
- `injected_by_director` (boolean, default false) — true cuando el
  director escribió este mensaje en nombre de un actor en un thread
  `linked` (excepción — ver `/control` en Arquitectura de rutas). Nunca
  se muestra en `/device`, solo en `/control`
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
`src/shared/supabaseClient.js`.

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
- En `/device` y `/device/chat`, cualquier `padding`/`top` que use
  `env(safe-area-inset-*, fallback)` tiene que envolverlo en
  `max(env(safe-area-inset-*, 0px), fallback)`. El `fallback` de `env()`
  solo se usa cuando la variable no está definida — pero en dispositivos
  reales (Android normal, iPhone sin notch) suele estar definida en
  `0px`, un valor real, así que el fallback nunca entra en juego y el
  elemento queda pegado al borde. Ya pasó varias veces (header de
  `/device/chat`, banner de notificación, visor de fotos, header de
  `/device`) — si se agrega un elemento nuevo pegado a un borde de
  pantalla, usar `max()` desde el principio
- `#chat-root` (`/device/chat`) y `#list-root` (`/device`) fijan su alto
  con `height: 100vh; height: 100dvh;` y además
  `height: -webkit-fill-available;` como tercer fallback — en iOS
  Safari/PWA instalada standalone, `100dvh` a veces no llega a cubrir
  hasta el home indicator (bug histórico de WebKit) y deja un hueco
  abajo con el fondo del `body` asomando, de un color distinto al del
  composer. No se pudo probar en un iPhone real al aplicar el fix — si
  vuelve a aparecer el hueco, confirmarlo con el reporter en el
  dispositivo antes de asumir que ya quedó resuelto
- `#device-composer` tenía `padding-top: 8px` pero `padding-bottom:
  max(env(safe-area-inset-bottom, 0px), 18px)` — asimétrico a propósito
  (pensado para el home indicator), pero se veía raro en dispositivos
  sin ese inset real. Bajado el fallback a `8px` para que sea simétrico
  por default; en un iPhone con home indicator real, `env()` (~34px)
  sigue ganando por el `max()`, así que no se pierde la protección
  donde de verdad hace falta

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
- Panel de control completo (fase 3): tabla `rooms`, crear dispositivos
  de antemano desde `/control` (esta fase originalmente incluía nombrar
  el contacto en `rooms` directamente; se reemplazó por `conversations`
  al agregar la lista de chats, ver más abajo)
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
- Selector de conversación en `/control` cambiado de pestañas a
  desplegable ("Hablando en nombre de") para no confundir con qué contacto
  se está hablando; acciones rápidas por dispositivo en `/control`
  ("💬 Ver chat" + "📝 Editar lista", antes un único ícono 👁 ambiguo) y
  `/control/contacts` ("💬 Ver chat")
- Landing en `/` (`src/home/`) para compartir con quien prueba el
  producto: copy, CTA a `/control`, grilla de accesos a cada actor con
  botón "Copiar link" (URL real de instalación) y "Abrir →", y "cómo
  funciona" resumido
- "Nombre del actor" (`rooms.label`): se había sacado del todo por
  parecer redundante, pero sin él no había forma de identificar un
  dispositivo con algo más memorable que el `room_id` crudo — se repuso
  arriba de todo en `/control`, con aclaración de que es solo para el
  director. Usado con fallback a `room_id` en `/control`,
  `/control/contacts` y la landing
- Barra superior ("🎬 Chat Vintage" + botón a la home) en `/control` y
  `/control/contacts`, para volver a la landing sin escribir la URL a
  mano — a propósito no está en `/device`, tiene que verse indistinguible
  de una app de mensajería real
- Fotos en los chats (`messages.image_url`, bucket Storage `chat-images`,
  helper compartido `src/shared/uploadImage.js`): botón de adjuntar en
  ambos composers. En `/device/chat` el actor sube su propia foto (real
  en threads `linked`, o queda `direction: outgoing` en `simulated`,
  igual que el texto); en `/control` el director sube una foto "en
  nombre de" el contacto simulado (deshabilitado en conversaciones
  `linked`, de solo lectura). Un mensaje puede tener foto sin texto,
  texto sin foto, o ambos. Probado end-to-end con Playwright en los tres
  sentidos: director→actor, actor→director, y actor↔actor real
  - En `/device/chat`, la miniatura tiene `max-height` (antes no, y una
    foto alta se veía enorme dentro de la burbuja) y al tocarla abre un
    visor fullscreen (`#image-viewer`, tap para cerrar). El badge de
    hora superpuesto en burbujas solo-foto tiene `pointer-events: none`
    para que el click siempre llegue a la imagen y no al badge, incluso
    si la foto es muy chica
- Borrado de mensajes desde `/control` (individual y "Vaciar chat" por
  thread), propagado en vivo a `/device/chat`; y `/control` +
  `/control/contacts` responsive para poder operarse desde celular o
  tablet, no solo notebook
- Caché en `localStorage` + skeleton en `/device` y `/device/chat` para
  disimular el delay de navegar entre lista y chat (ver detalle arriba).
  Se descartó agregar además una transición `@view-transition` nativa:
  no confiable, dejaba el botón de volver sin responder
- Reemplazo de acciones por dispositivo en `/control`/`/control/contacts`
  por "Ver chat"/"Editar lista" con label+ícono (antes un solo 👁
  ambiguo); en desktop nombre arriba y acciones abajo para que el
  nombre no quede tapado en los 240px fijos de la sidebar
- El director puede escribir excepcionalmente en una conversación
  linkeada, en nombre del otro actor (`messages.injected_by_director`)
  — ver detalle en `/control` (Arquitectura de rutas). Un solo selector
  (el mismo "Hablando en nombre de" de siempre); se descartó un segundo
  selector para elegir "en nombre de quién" porque solo tiene sentido
  una opción (el otro actor, nunca el dueño de la lista activa)
- "🗑️ Eliminar dispositivo" en `/control` (panel "Nombre del actor") —
  ya no hace falta entrar al Table Editor de Supabase a mano. Borra el
  room, cascadea sus conversaciones (ambos lados si estaba linkeado) y
  limpia los mensajes de esos threads a mano (sin FK a conversations).
  Probado con Playwright: dispositivo suelto y par linkeado
- Banner de notificación simulada en `/device` y `/device/chat`,
  disparado automáticamente cuando el director manda un mensaje
  entrante (o inyecta uno en una linkeada) — ver detalle en `/control`
  (Arquitectura de rutas). Se decidió NO usar Web Push real por la
  complejidad de backend + soporte inestable de iOS Safari, a favor de
  un banner in-app vía broadcast (mismo patrón que "escribiendo..." y
  la llamada entrante). Probado con Playwright: aparece en la lista y
  en un chat distinto al que se está mirando, no aparece si es el
  mismo chat, y tap navega a la conversación correcta
- Aviso `#notify-hint` junto al composer para que quede claro cuándo un
  envío va a disparar la notificación (no era obvio al ser automático)
- "🔔 Notificación de otro contacto" en `/control`: notificar al actor
  de un chat distinto al activo sin cambiar de vista — ver detalle en
  `/control` (Arquitectura de rutas). Probado con Playwright: excluye
  la conversación activa del desplegable, no toca lo que el director
  está mirando, funciona con destino simulado y linkeado, y el mensaje
  queda guardado en la conversación correspondiente
- "🚨 Mostrar pantalla de apagado/SOS" en `/control`: simula la pantalla
  de mantener presionado el botón de encendido de un iPhone, sobre
  cualquier pantalla del actor — ver detalle en `/control` (Arquitectura
  de rutas). Puramente visual (sliders arrastrables que no disparan
  ninguna acción real, `src/shared/emergencyOverlay.js`), el director la
  cierra a mano. Probado con Playwright: aparece en la lista y en un
  chat abierto sin importar cuál, el drag mueve el thumb y vuelve a su
  lugar al soltar, y se cierra remotamente en ambas pantallas
- Layout de `/control` compactado: entre el panel "Nombre del actor",
  "Pantalla de apagado/SOS" y "Notificar de otro contacto", cada feature
  nueva había sumado su propia caja con borde/padding y casi no quedaba
  alto para el hilo de mensajes. Se colapsó "Nombre del actor" detrás de
  un ícono ⚙️, se movieron los botones de apagado/SOS y notificar-otro-
  contacto a la fila compacta de `#quick-actions` (colapsado por
  default), y los avisos de texto (`#linked-hint`, `#notify-hint`)
  pasaron de párrafo-con-caja a una línea sin fondo — ver detalle en
  `/control` (Arquitectura de rutas)
- Bug de `env(safe-area-inset-*)` sin `max()` (ver Reglas de estilo de
  código) encontrado en Android en el header de `/device` ("Chats" se
  veía sin padding-top) — de paso se revisó y corrigió el mismo patrón
  en el banner de notificación (su `top`, en ambas páginas) y el visor
  de fotos de `/device/chat`, que tenían el mismo problema latente
  aunque todavía no se hubiera reportado
- El composer de `/control` no disparaba "escribiendo..." mientras el
  director tipeaba (solo el botón manual lo hacía) — a diferencia del
  composer del actor en threads `linked`, que sí lo hace solo. Agregado
  con la misma lógica (debounce 2s), ver detalle en `/control`
  (Arquitectura de rutas)
- Pendiente: integración Playwright/ffmpeg (fase 4), reemplazar íconos
  placeholder por diseño final, probar instalación real en Android
