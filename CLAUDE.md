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
- `/control` → mensajería en vivo del director. Layout de 3 columnas:
  lista de dispositivos (izquierda, fija) — `#chat-col` (centro, flexible:
  hilo + composer) — `#actions-col` (derecha, fija, siempre visible: la
  botonera de acciones). Rediseño completo de esta pantalla, reemplazando
  la versión anterior (fila `#quick-actions` debajo del composer +
  acciones "Ver chat"/"Editar lista" por fila de la lista) — decisiones
  abajo
  - **Sin dispositivo elegido**: en vez de la lista + composer + botonera
    inertes (como quedaba antes, confuso — controles visibles pero sin
    ningún efecto), `#chat-col` muestra `#empty-state`: ilustración (SVG
    inline, teléfono + burbuja) + copy corto + 3 pasos numerados (elegir
    dispositivo → elegir conversación → operar en vivo). `#actions-col` y
    `#composer` quedan ocultos (`class="hidden"` por default en el HTML,
    sin esperar a que corra JS) hasta que se elige un dispositivo.
    `#room-messages` también se oculta en este estado — si no, competía
    por el alto disponible contra `#empty-state` (los dos son flex:1
    dentro de `#chat-col`) y dejaba un rectángulo vacío debajo de los 3
    pasos. El `<svg>` de la ilustración necesitó `width`/`height` fijados
    por CSS además de los atributos HTML — en Chromium, dentro de este
    contenedor flex en particular, el atributo `height="120"` solo no
    alcanzaba y el svg colapsaba a 0 de alto (el `width` sí se tomaba
    bien); no se identificó la causa exacta, pero fijarlo por CSS es
    robusto igual. Si se agrega otro SVG inline en `/control`, no asumir
    que los atributos `width`/`height` alcanzan — verificar en el
    navegador
  - **Lista de dispositivos** (`#devices`, dentro de `#device-list`):
    avatar (`rooms.avatar_url` o inicial sobre fondo de acento) + nombre
    por fila — antes mostraba nombre + dos links de acción ("💬 Ver chat"
    / "📝 Editar lista") apilados en cada fila, lo que obligaba a la
    sidebar fija de 240px a partir el layout en dos líneas por fila. Esos
    dos accesos se movieron a `#actions-col`, como "💬 Ir al chat" y "📝
    Editar contactos" (mismo destino que antes: `/device/[roomId]` y
    `/control/contacts?room=[roomId]`, ambos a pestaña nueva), pero ahora
    referidos siempre al dispositivo activo, no uno por fila — la fila
    solo selecciona, ya no hace de menú de accesos
  - **`#actions-col`**: grilla de 2 tiles por fila (ícono arriba, label
    abajo hasta 2 líneas), sin títulos de sección — antes tenía subgrupos
    con `<h4>` ("Estado del chat", "Herramientas", etc.) que ya no
    estaban, cada feature nueva sumaba su propio texto de header y comía
    alto. En su lugar, cada tile tiene un color de fondo desaturado según
    su familia (clases `.fam-blue/.fam-violet/.fam-amber/.fam-red/
    .fam-neutral` en `style.css`), que cumple el mismo rol de agrupar
    visualmente sin ocupar una línea de texto aparte:
    - `fam-blue` — estado del chat en vivo: "✍️ Simular 'escribiendo...'",
      "✓✓ Marcar como visto", "📞 Simular llamada entrante"
    - `fam-violet` — pantallas simuladas de pantalla completa: "🚨
      Pantalla de apagado/SOS", "⏰ Simular despertador" (ver detalle
      abajo), y **"🏠 Pantalla Inicio"** — todavía placeholder
      (`disabled`, `title="Todavía no implementado"`; agregado al boceto
      a pedido explícito, falta definir qué hace — no confundir con un
      bug)
    - `fam-amber` — "🔔 Notificar de otro contacto" (despliega
      `#quick-notify` debajo de la grilla, igual que antes)
    - `fam-red` — "🗑️ Vaciar chat" (única que se queda roja pase lo que
      pase — convención de acción destructiva, no depende de la familia
      de colores del resto)
    - `fam-neutral` — "💬 Ir al chat" / "📝 Editar contactos" (los ex
      accesos de la lista, ver arriba), al final de la grilla, después de
      las de interacción directa — son navegación, no acciones en vivo
    Sin barra de scroll visible (`scrollbar-width: none` +
    `::-webkit-scrollbar{display:none}`) si la grilla no entra entera —
    el scroll sigue andando con rueda/trackpad/drag táctil, solo se
    ocultó el track del navegador, mismo criterio que usan WhatsApp/
    iMessage (nunca muestran scrollbar)
  - **Tablet (`≤860px`)**: la lista de dispositivos deja de ser columna
    lateral y pasa a tira horizontal — pero además se fusiona con la
    topbar en una sola fila (antes eran dos filas apiladas: topbar arriba,
    tira de dispositivos abajo, que juntas comían bastante alto). Esa
    fila (`#mobile-topbar-row`, dentro de `#device-list`) trae: 🎬 (marca,
    solo ícono, sin el texto "Chat Vintage") + tira de avatares
    scrolleable (mismo `#devices`, reusa el HTML — en desktop
    `#mobile-topbar-row` es `display: contents`, así que ahí no aporta
    ningún estilo propio y los elementos `.mobile-only` quedan ocultos)
    + "➕ Nuevo dispositivo" (ícono solo, mismo botón que en desktop,
    reposicionado acá) + 🎨/👥/🏠 (Apariencia/Contactos/Home, ícono solo,
    duplicados de sus versiones desktop — `#open-skin-modal-btn` y
    `#open-skin-modal-btn-mobile` comparten el mismo handler en `app.js`).
    `#top-bar` (la versión desktop, con texto) se oculta entero en este
    breakpoint. `#chat-col` y `#actions-col` se quedan lado a lado (no se
    apilan) — a diferencia del diseño anterior, ahora no compiten por
    ancho con una sidebar de 240px fija, así que entran cómodas incluso en
    un iPad portrait; `#actions-col` baja de 300px a 240px (columna más
    angosta, tiles más chicos) porque a los 300px de desktop sobraba
    fondo vacío a la derecha de labels cortos como "Marcar como visto".
    Por debajo de los 600px (celular, no tablet) sí se apilan verticalmente
    — a ese ancho ya no entran las dos columnas lado a lado
  - **"🎨 Apariencia"** se movió de la sidebar (donde vivía junto a
    "👥 Contactos") a la topbar, al lado de "🏠 Ir a la home" — mismo
    estilo de botón (`.top-icon-btn`). "👥 Contactos" se quedó en la
    sidebar, arriba de la lista
  - Panel "Nombre del actor" (`rooms.label` + `rooms.avatar_url`) arriba
    de `#chat-col`: cómo identifica el director a ese dispositivo en los
    paneles — nunca lo ve el actor, no tiene relación con
    `conversations.contact_name` (eso es lo que el actor sí ve, por
    chat). Si no se completa, la UI cae al `room_id` crudo. La foto
    también sirve como default al crear un nuevo link con otro actor
    (cada lado la puede sobreescribir después desde `/control/contacts`,
    igual que el nombre). "🗑️ Eliminar dispositivo" (con confirmación, no
    se puede deshacer) borra el `room`, lo que cascadea sus
    `conversations` en ambos lados de cualquier link (FK `on delete
    cascade` en `room_id` y `linked_room_id`); los `messages` de esos
    threads no tienen FK a `conversations` así que se borran a mano
    antes, para no dejarlos huérfanos. Colapsado detrás de un ícono ⚙️
    junto al nombre del dispositivo — es edición de setup, no algo que
    se toque a cada rato en vivo, y ocupaba espacio de forma permanente.
    Colapsa de nuevo (por default) cada vez que se cambia de dispositivo
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
      que el composer del actor en threads `linked`; el tile "Simular
      'escribiendo...'" queda aparte para poder simular tipeo sin llegar
      a escribir nada (pausa dramática, etc.)
    - **linkeada**: hilo en vivo (mensajes reales entre dos actores) —
      toggle y controles de simular deshabilitados (no aplican: no hay
      "direction" que definir, ya está escribiendo/typing es orgánico),
      excepto "Simular llamada entrante" y borrar mensajes (ver abajo).
      El composer SÍ está habilitado, a modo de excepción: lo que se
      escriba se guarda con `sender_room_id` = el OTRO actor
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
    Vaciar chat" en `#actions-col` (borra todo el `thread_id` activo, con
    confirmación — no se puede deshacer). Disponible en conversaciones
    simuladas y linkeadas por igual. Se propaga en vivo a `/device/chat`
    (por eso `messages` tiene `replica identity full`: el filtro por
    `thread_id` de Realtime necesita el "old record" completo para
    decidir a quién le llega un evento de `delete`, que por default solo
    trae la primary key)
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
  - **"🚨 Pantalla de apagado/SOS"**: simula la pantalla que aparece al
    mantener presionado el botón de encendido de un iPhone ("deslizar
    para apagar" / "Ficha médica" / "Emergencia SOS") sobre lo que sea
    que el actor esté mirando en ese momento (lista o cualquier chat) —
    mismo canal de broadcast que las notificaciones
    (`notificationsChannelName`), a nivel dispositivo, no de
    conversación. Puramente visual: los tres sliders se pueden arrastrar
    (`src/shared/emergencyOverlay.js`, con Pointer Events) para que se
    vea real en cámara, pero ningún gesto dispara una acción real — al
    soltar, el thumb siempre vuelve a su posición inicial. El tile se
    convierte en "Cerrar pantalla" mientras está activa (mismo lugar en
    la grilla — el otro queda `hidden`); el director la cierra a mano, a
    propósito no hay forma de que el actor la cierre él mismo (tiene que
    actuar la escena, no interrumpirla tocando la pantalla)
  - **"⏰ Simular despertador"**: pantalla de alarma sonando (tipo lock
    screen de iOS — ícono + hora grande + "Posponer"/"Detener"), sobre lo
    que sea que el actor esté mirando, mismo canal y alcance que la de
    apagado/SOS (`src/shared/alarmOverlay.js`). Dos diferencias clave con
    esa, por decisión explícita al construirla:
    - **La hora la define el director**, no es la hora real del
      dispositivo — el tile abre `#alarm-panel` (colapsado por default,
      mismo patrón que "Notificar de otro contacto"), con un
      `<input type="time">` precargado con la hora actual como punto de
      partida cómodo, y "Activar alarma" dispara `alarm_screen_show` con
      esa hora en el payload
    - **El actor SÍ puede cerrarla él mismo**, tocando "Posponer" o
      "Detener" (las dos hacen exactamente lo mismo — cerrar, sin lógica
      de snooze real que la haga reaparecer sola; se decidió así para no
      restarle control al director sobre cuándo vuelve a sonar). Es lo
      opuesto a la de apagado/SOS a propósito: ahí el actor no puede
      cerrarla porque tiene que seguir actuando la escena sin
      interrumpirla; acá cerrarla ES la actuación (como con una alarma
      real). Como el cierre puede venir de cualquiera de los dos lados,
      `device/app.js` y `device/chat/app.js` reenvían el mismo evento
      `alarm_screen_hide` de vuelta por el canal cuando el actor la
      cierra, y `/control` lo escucha (agregado al armar
      `activeNotificationChannel` en `setActiveRoom`) para que el tile
      vuelva solo a su estado inicial si el actor cerró antes que el
      director — si no, el botón de `/control` quedaba mostrando "Cerrar
      alarma" para algo que ya no estaba en pantalla
    - **Al cerrarla (desde cualquiera de los dos lados) queda debajo la
      pantalla de inicio**, no la app que hubiera antes — como en un
      iPhone real, apagar la alarma no te devuelve directo a lo que
      estabas usando, primero pasás por el lock screen. `dismissAlarm()`
      en `device/app.js`/`device/chat/app.js` llama a
      `showHomeScreenOverlay` con la hora que mostraba la alarma
      (`lastAlarmTime`, capturado al recibir `alarm_screen_show`) y el
      fondo persistido de `rooms.home_screen_bg_url` (fetch propio al
      cargar la página, antes solo se leía desde `/control`); la fecha
      queda en blanco, no hay una fuente confiable para inventarla acá.
      Reenvía el mismo evento `home_screen_show` (no uno nuevo) por el
      canal para que `/control` se resincronice igual que con el cierre
      — el tile de "Pantalla Inicio" pasa solo a mostrar "Cerrar
      pantalla" aunque el director nunca la haya activado él
    Sin sonido — puramente visual, mismo criterio que el resto de los
    overlays del proyecto (se evaluó agregar audio real y se descartó:
    riesgo de que el navegador bloquee el autoplay sin gesto previo del
    usuario, y de que un sonido fuerte arruine una toma en vivo). Nueva
    en la jerarquía de z-index de `/device` y `/device/chat`:
    `#alarm-overlay` = 50, por encima incluso de la de apagado/SOS (40) —
    es el takeover más nuevo de la pila, agregado arriba de todos
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
    el mismo banner de notificación. El tile no aparece si el
    dispositivo no tiene más chats que el activo; colapsa de nuevo
    cada vez que se cambia de conversación
  - **"📹 Simular videollamada"**: tile aparte de "📞 Simular llamada
    entrante" (mismo timbre — avatar pulsante, nombre, aceptar/rechazar —
    pero es una acción separada, no un toggle sobre la misma, para que
    sea un solo click sin pasos intermedios). Ambas viajan por el mismo
    evento `incoming_call`/`end_call`, con `isVideo` en el payload para
    diferenciar del lado del actor (`src/shared/callOverlay.js`). Al
    aceptar una videollamada, el overlay NO se cierra como con la de
    audio — pasa a un estado "conectada" (mismo `#incoming-call-overlay`,
    sub-div `.call-connected` en vez de `.call-ringing`): pantalla verde
    chroma (`#00b140`, separa mejor de tonos de piel que el `#00ff00`
    puro) con 5 marcadores de tracking estáticos (4 esquinas + centro),
    pensada para compositar video real encima en post. El actor cuelga
    con el botón rojo (ícono de teléfono rotado 135°, mismo lenguaje
    visual que apps reales) — no hay botón de "cortar" del lado de
    `/control`, es fire-and-forget como la de audio
  - **"🏠 Pantalla Inicio"**: simula la lock screen de un iPhone —
    fondo + hora + fecha, con "🔦"/"📷" decorativos abajo (sin acción
    real) y la barrita de "home indicator". El director sube el fondo
    (persistido en `rooms.home_screen_bg_url`, como el avatar del actor
    — no hace falta resubirlo cada vez) y escribe hora y fecha como
    texto libre, sin formateador automático — así controla exactamente
    qué se ve, sin depender de que el formato calculado coincida con lo
    que pide la escena (mismo criterio que la hora de la alarma). El
    actor cierra la pantalla con un **swipe real hacia arriba**
    (`src/shared/homeScreenOverlay.js`, Pointer Events con umbral de
    distancia y de velocidad — un swipe corto pero rápido también
    cierra), a diferencia de la alarma que se cierra con un botón: acá
    se buscó imitar el gesto real de desbloqueo. Mismo patrón de
    resincronización que la alarma: si el actor cierra antes que el
    director, se reenvía `home_screen_hide` para que el panel de
    `/control` no quede mostrando "Cerrar pantalla" de algo que ya se
    cerró. `#home-screen-overlay` = z-index 60, el takeover más nuevo,
    arriba de todos (alarma quedó en 50). Dentro de `#home-screen-panel`,
    un link "❔ Cómo poner una hora falsa en el iPhone" abre
    `#home-screen-help-modal` (mismo texto que antes vivía en un Artifact
    externo, ahora adentro de la app — un link fuera de la herramienta no
    era robusto para operar en pleno rodaje sin conexión)
  - **"🎙️ nota de voz"** (botón aparte del de enviar, en el composer
    principal y en el de "Notificar de otro contacto"): sin audio real
    — mismo criterio que todos los overlays del proyecto. Inserta un
    mensaje con `content: ''`, `is_voice: true` y una duración inventada
    (`voice_duration`, 4–42s al azar) usando la misma `messagePayloadFor`
    de siempre (respeta simulada/linkeada e incoming/outgoing igual que
    un mensaje de texto). La burbuja en `/device/chat` se renderiza como
    nota de voz real (▶ + onda estática de barras con alto aleatorio +
    duración) en vez de texto; en `/control` se ve como "🎙️ Nota de voz
    · 0:12" en cursiva. El banner de notificación y el preview de la
    lista de chats en `/device` muestran "🎙️ Audio" en vez de contenido
    vacío cuando el mensaje es de voz
  - Modal "Apariencia" (🎨): editor de skins con preview en vivo tipo
    mini-teléfono
- `/control/contacts` → gestión de la lista de chats de cada dispositivo
  (separado de la mensajería en vivo a propósito, ver decisión de producto).
  Mismo diseño/estilos que `/control` en todo lo estructural — topbar con
  `.top-icon-btn` ("💬 Volver a mensajería" en vez de "🎨 Apariencia", que
  acá no aplica — esta pantalla no tiene modal de skins — + "🏠 Ir a la
  home"), lista de dispositivos avatar+nombre con punto de presencia
  (`DEVICES_PRESENCE_CHANNEL`, mismo canal que `/control`, cableado acá
  también — antes esta pantalla no trackeaba quién está online), y en
  tablet (`≤860px`) la misma fila unificada `#mobile-topbar-row` (marca +
  tira de dispositivos + íconos). "💬 Ver chat" ya no vive por fila del
  dispositivo (ese patrón se sacó de `/control` en el rediseño de la
  botonera) — pasó a un botón junto al nombre del dispositivo activo, en
  `#room-header` (mismo lugar conceptual que ocupaba en la lista antes,
  ahora atado al dispositivo seleccionado en vez de repetido por fila)
  - Por dispositivo: crear/editar/eliminar contactos simulados (nombre,
    estado, foto de avatar) y crear/deshacer links reales con otro actor
    (acá no hace falta "Editar lista" — seleccionar el dispositivo en
    esta misma pantalla ya es editar)
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
  - `#chat-header` es `position: fixed` (no un flex item más de
    `#chat-root`) para que no se mueva si iOS scrollea la página al
    abrir el teclado (comportamiento a nivel sistema, no evitable solo
    con `overflow: hidden`). `#messages` compensa el espacio con
    `padding-top: var(--header-height, 70px)`, medido en vivo por
    `app.js` con un `ResizeObserver` sobre el header (por si cambia:
    skin, tamaño de letra, safe-area). `z-index: 5` — por debajo de la
    llamada entrante (10) / visor de fotos (20) / banner de notificación
    (30) / pantalla de apagado-SOS (40) / pantalla de alarma (50) /
    pantalla de inicio (60), que son todos takeovers de pantalla completa
    y tienen que tapar el
    header, no al revés
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
- `home_screen_bg_url` (text, nullable) — fondo de la pantalla de inicio
  simulada (Storage, bucket `home-screens`, separado de `avatars`/
  `chat-images` por el mismo criterio de siempre: distinto ciclo de vida).
  Persistido para no resubirlo cada vez que el director la activa desde
  `/control` — ver `/control` en Arquitectura de rutas
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
- `is_voice` (boolean, default false), `voice_duration` (integer,
  segundos) — nota de voz simulada, sin audio real: `content` queda
  `''` y la burbuja se renderiza como mensaje de voz (ver `/control` en
  Arquitectura de rutas). `voice_duration` es una duración inventada al
  azar (4–42s) al momento de enviar, no una medición real
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
- `broadcast` efímero para `typing` (no se persiste en la tabla). En
  threads `linked`, ambos dispositivos escuchan el mismo canal, así el
  "escribiendo..." de un actor real le llega al otro (se dispara solo,
  con el evento `input` del composer — no hace falta que el director lo
  simule)

`/device/[roomId]` (la lista) además escucha `postgres_changes` sobre
`conversations` filtrado por `room_id` (para agregar/quitar chats en vivo)
y sobre `messages` sin filtro, descartando en el cliente lo que no
pertenece a sus threads (evita reconstruir el filtro cada vez que cambia
la lista de conversaciones).

`incoming_call`/`end_call` (broadcast) NO van por el canal del thread —
van por `notificationsChannelName(roomId)` (el mismo canal a nivel
dispositivo que usan el banner de notificación, la pantalla de apagado/
SOS, la de alarma y la de inicio), igual en `/device` y `/device/chat`
(`src/shared/callOverlay.js`). Así una llamada interrumpe sin importar si
el actor está en la lista, en el chat que está "llamando", o en cualquier
otro chat — como una llamada real. Por eso nombre/foto van siempre en el
payload (`callerName`, `avatarUrl`) y nunca se infieren de la conversación
que el actor tenga abierta en ese momento, que puede no tener nada que
ver con quién llama. `isVideo` en el mismo payload distingue la
videollamada (ver `/control` en Arquitectura de rutas). Antes vivía en el
canal del thread (solo mostraba la llamada si el actor ya estaba en esa
conversación puntual); se migró a pedido explícito para que funcione
"igual que con un chat abierto" desde cualquier pantalla.

`home_screen_show`/`home_screen_hide` (broadcast, mismo canal
`notificationsChannelName(roomId)`) siguen el mismo patrón de doble
sentido que `alarm_screen_show`/`alarm_screen_hide`: el director las
dispara desde `/control`, pero el actor también puede cerrarla (con el
swipe) y reenvía el `_hide` de vuelta para que `/control` se resincronice
— ver detalle completo en `/control` (Arquitectura de rutas).

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
- `#chat-root` (`/device/chat`) y `#list-root` (`/device`) reportaron en
  iPhone real un hueco abajo (con el fondo del `body` asomando, de un
  color distinto al del composer) — probablemente `100dvh` sin llegar a
  cubrir hasta el home indicator en PWA instalada standalone (bug
  histórico de WebKit). Se probó `height: -webkit-fill-available;` como
  tercer fallback y se revirtió por las dudas (ver abajo la causa real
  del teclado) sin confirmar si de verdad era la causa — sigue sin
  resolverse; si se retoma, probar primero en un iPhone real que el
  teclado abra bien antes de asumir que esa propiedad es segura
- El mismo hueco abajo (mismo bug, otro síntoma) apareció en los overlays
  de pantalla completa más nuevos: `#home-screen-overlay` (se veía un
  corte duro entre la foto de fondo y una franja de color plano abajo) y
  `.call-tracker-screen` de la videollamada (mismo corte, ahí más grave
  porque esa franja no es verde chroma y arruina el compositing en esa
  zona). Se probó sobre-escanear el relleno (`.home-screen-bg`/
  `.call-tracker-screen` con `bottom: -Npx` en vez de `inset: 0`, sin
  `overflow: hidden` en el contenedor) — **confirmado en iPhone real que
  no alcanza**: 80px y 300px de margen dieron el mismo corte, exactamente
  igual. Eso descarta que sea un cálculo de alto insuficiente (`dvh`/
  `--app-height` quedándose un poco corto) — es un recorte duro de iOS
  sobre contenido `position: fixed` en standalone, en un punto que no se
  puede calcular ni compensar agrandando el margen
  - **Pantalla de inicio**: como no se puede evitar el corte, se lo
    disimula — `.home-screen-vignette` (capa nueva, `inset: 0` SIN
    sobre-escaneo, para que los % del degradé mapeen contra la pantalla
    visible real y no contra el alto extra de `.home-screen-bg`) funde la
    foto a `#2a2722` (marrón oscuro, confirmado a ojo contra lo que
    realmente se filtra en un iPhone real — se probó primero con `#000`
    de estimación, no matcheaba) ya desde el 82% de la pantalla, sólido a
    partir del 96% — así, caiga donde caiga el corte real de iOS, la foto
    ya es ese mismo marrón ahí y la transición es invisible. Sigue el
    mismo criterio que la viñeta original (que oscurecía arriba para que
    se lea la hora), solo que ahora también resuelve el corte de abajo
  - **Videollamada**: acá no se puede fundir a un color sólido (arruina
    el chroma key). En cambio, se pintó de verde (`#00b140`) **cada capa
    del stack**, no solo `.call-tracker-screen` — también `.call-connected`
    y, con la clase `video-connected` que agrega `connectVideoCall()`
    (`src/shared/callOverlay.js`), el propio `#incoming-call-overlay`
    raíz. La idea: si no se puede saber qué borde exacto revela iOS al
    recortar el `position:fixed`, que sea cual sea la capa que asoma ahí,
    también sea verde. Confirmado en iPhone real que agrandar el
    sobre-escaneo de `.call-tracker-screen` (80px → 300px) no cambiaba
    nada — este enfoque de "todas las capas verdes" todavía no se
    confirmó en dispositivo real
  - **Pantalla de apagado/SOS** (`#emergency-overlay`): mismo tratamiento
    que la pantalla de inicio — `height: var(--app-height, 100dvh)` en
    vez de `inset: 0` (mejor esfuerzo de tamaño, no alcanza solo) +
    `::before` (no `::after`, para que pinte DEBAJO de los sliders en el
    mismo layer de stacking — `position:absolute` lo saca del flex-flow
    así que no descentra nada) con el mismo degradé a `#2a2722` desde el
    78%. Acá no hizo falta una capa nueva en el HTML como en la pantalla
    de inicio porque el fondo ya vive directo en `#emergency-overlay`
    (no hay imagen de por medio, es un radial-gradient), así que un
    pseudo-elemento alcanza. Todavía sin confirmar en dispositivo real
  - **Pantalla de alarma** (`#alarm-overlay`): mismo tratamiento que
    apagado/SOS — `height: var(--app-height, 100dvh)` + `::before` con
    el mismo degradé a `#2a2722` desde el 78%, detrás de `.alarm-info`/
    `.alarm-actions`. Fondo también es un color plano (`#030405`), sin
    imagen de por medio, mismo motivo por el que alcanza un
    pseudo-elemento sin capa nueva en el HTML. Todavía sin confirmar en
    dispositivo real
- "🔦"/"📷" de la pantalla de inicio pasaron de emoji a SVG inline plano
  (blanco, sin depender de la fuente de emoji del sistema) — el círculo
  de fondo (`.home-screen-icon-btn`) suma un `border: 1px solid` marrón
  oscuro fino, a pedido explícito de que se vea más "hecho", no como un
  ícono de sistema pegado ahí
- **El teclado no abría en iPhone al tocar el input de mensaje, pero
  solo estando instalada en la pantalla de inicio — en Safari andaba
  bien.** Causa real: `user-scalable=no` en el `<meta viewport>` de
  `/device` y `/device/chat`. Es un bug documentado de iOS: esa
  combinación con `display: standalone` bloquea el teclado; en una
  pestaña normal de Safari no se manifiesta. Se sacó `user-scalable=no`
  de ambos viewports. Como consecuencia, reaparece el zoom automático
  de iOS al enfocar un input con `font-size` menor a 16px (para eso
  estaba `user-scalable=no`, en realidad) — se compensó con
  `font-size: max(16px, var(--skin-font-size))` en
  `#device-message-input` (el skin por default usa 15px, justo debajo
  del umbral). Si se agrega otro `<input>` de texto en `/device` a
  futuro, aplicar el mismo mínimo de 16px. **Sacar `user-scalable=no` no
  alcanzó** — confirmado con el usuario que el teclado seguía sin abrir
  después de ese fix (con foco visible en el input, o sea que el toque
  sí llega y el DOM se enfoca bien; el bug es que iOS no levanta el
  teclado igual). Sospecha actual: la combinación
  `apple-mobile-web-app-status-bar-style=black-translucent` +
  `viewport-fit=cover` (contenido a pantalla completa real, por debajo
  del área del sistema) interactuando mal con `100dvh` específicamente
  en standalone. Se agregó `interactive-widget=resizes-content` al
  viewport y un alto dinámico atado a `window.visualViewport` (variable
  `--app-height`, actualizada en cada resize del viewport visual) en vez
  de depender solo de `dvh` — en `/device` y `/device/chat`. **Sin
  confirmar en dispositivo real todavía** — si tampoco funciona, el
  problema puede no tener solución vía CSS/HTML y haya que replantear el
  layout (por ejemplo, sacar `black-translucent` o `viewport-fit=cover`)
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
- Rediseño completo de `/control` (empty state ilustrado, layout de 3
  columnas con `#actions-col` fija a la derecha en vez de la fila
  `#quick-actions` de abajo, botonera como grilla de tiles con color por
  familia sin títulos de sección, lista de dispositivos avatar+nombre,
  "Apariencia" movida a la topbar, "Ver chat"/"Editar lista" renombradas
  a "Ir al chat"/"Editar contactos" y movidas a `#actions-col`, topbar +
  tira de dispositivos unificadas en una sola fila en tablet) — ver
  detalle completo en `/control` (Arquitectura de rutas). Iterado primero
  como mockup HTML standalone (fuera del repo) con el usuario antes de
  tocar el código real. Agregados como placeholders sin implementar
  "⏰ Simular despertador" y "🏠 Pantalla Inicio" (tiles deshabilitados,
  falta definir qué hacen). Probado con Playwright en desktop (1180px),
  tablet (820px) y celular (390px): empty state, selección de
  dispositivo, toggle de pantalla de apagado/SOS, apertura de "Notificar
  de otro contacto", scroll sin barra visible en `#actions-col`
- "⏰ Simular despertador" implementado (`src/shared/alarmOverlay.js`,
  imagen de referencia en `despertador/images.jpeg`): pantalla de alarma
  tipo lock screen de iOS, con la hora que define el director (no la
  hora real) y que el actor puede cerrar él mismo tocando "Posponer" o
  "Detener" — a propósito lo opuesto a la de apagado/SOS, ver detalle
  completo en `/control` (Arquitectura de rutas). Sin sonido, puramente
  visual. Probado end-to-end con Playwright: activar desde `/control`
  con una hora elegida, que aparezca en `/device` con esa hora, cerrarla
  desde el actor y confirmar que el panel del director se resincroniza
  solo (sin quedar mostrando "Cerrar alarma" para algo que ya no está en
  pantalla)
- Ajustes al panel de acciones de `/control`: los paneles colapsables
  ("Hora a mostrar" de la alarma, el de "Notificar de otro contacto")
  vivían sueltos al final de `#actions-col`, lejos de su propio tile —
  ahora están dentro de `#actions-grid`, pegados al tile que los abre
  (`grid-column: 1/-1` para que ocupen la fila entera ahí mismo). De
  paso se encontró y corrigió el mismo bug de siempre con `.hidden` sin
  regla propia (esta vez en `#alarm-activate-btn`/`#alarm-deactivate-btn`,
  que no son `.tile` y por eso no heredaban `.tile.hidden`)
- "Simular llamada entrante" migrado de canal por-thread a canal por-
  dispositivo (`notificationsChannelName`) — antes solo interrumpía si
  el actor ya estaba en esa conversación puntual; ahora funciona desde
  la lista o cualquier chat, igual que una llamada real. Ver detalle en
  "Modelo de datos" (el párrafo sobre `incoming_call`/`end_call`) y
  `src/shared/callOverlay.js` (nuevo, compartido entre `/device` y
  `/device/chat` — antes solo existía en `/device/chat`, la lista no
  tenía ni el overlay en el HTML). Probado con Playwright en los tres
  casos: actor en la lista, en el chat que coincide, y en otro chat
  distinto al que está "llamando" — en los tres se ve el nombre/foto
  correctos de quien llama, no de la conversación que el actor tenga
  abierta
- Tres features nuevas evaluadas y construidas juntas (mockup previo
  descartado esta vez — se fue directo a código real, a pedido): ver
  detalle completo de cada una en `/control` (Arquitectura de rutas)
  - **"📹 Simular videollamada"**: tile aparte de la de audio, mismo
    timbre; al aceptar pasa a pantalla verde chroma (`#00b140`) con 5
    marcadores de tracking estáticos en vez de cerrar el overlay —
    pensada para compositar video real en post. Probado con Playwright:
    timbre → aceptar → pantalla verde visible → colgar → overlay cerrado,
    sin errores de consola
  - **"🏠 Pantalla Inicio"**: lock screen simulada (fondo persistido +
    hora/fecha en texto libre), cerrada por el actor con swipe real
    (`src/shared/homeScreenOverlay.js`, con umbral de distancia/
    velocidad) — a diferencia de la alarma, que se cierra con botón.
    Mismo patrón de resincronización que la alarma si el actor la cierra
    antes que el director. Probado con Playwright: activar con hora/
    fecha elegidas → swipe simulado con mouse (down/move/up) → cierra →
    `/control` se resincroniza solo
  - **"🎙️ Nota de voz"**: sin audio real, burbuja con onda estática +
    duración inventada (4–42s al azar). Botón en el composer principal y
    en "Notificar de otro contacto". Probado que falla de forma
    controlada (sin romper la UI) contra la base sin migrar — falta
    correr `supabase/migrations/012_home_screen_and_voice.sql` (agrega
    `rooms.home_screen_bg_url`, `messages.is_voice`/`voice_duration`, y
    el bucket Storage `home-screens`) para probarla de punta a punta y
    para que el fondo de la pantalla de inicio se pueda subir y persistir
- `supabase/migrations/012_home_screen_and_voice.sql` corrida en
  Supabase — nota de voz y fondo persistido de la pantalla de inicio
  probados de punta a punta con datos reales, no solo la falla
  controlada de antes
- `/control/contacts` alineada al mismo diseño que `/control` (topbar,
  lista de dispositivos avatar+nombre con presencia, fila unificada en
  tablet) — ver detalle en `/control/contacts` (Arquitectura de rutas).
  Probado con Playwright en desktop y tablet, sin errores de consola
- Pendiente: integración Playwright/ffmpeg (fase 4), reemplazar íconos
  placeholder por diseño final, probar instalación real en Android
