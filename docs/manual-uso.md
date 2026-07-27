# Manual de uso — App Chat Rodaje

App: **https://app-chat-vintage.vercel.app**

## 1. Antes del rodaje: crear los dispositivos

**Vos (director), desde `/control`:**

1. Abrí `https://app-chat-vintage.vercel.app/control`
2. Clic en **"+ Nuevo dispositivo"**, poné un código simple sin espacios
   (ej. `actor1`) → Crear
3. Repetí por cada actor/teléfono, cada uno con su propio código
4. El link para cada actor es `https://app-chat-vintage.vercel.app/device/actor1`
   (con el código que usaste)

Opcional: seleccionando un dispositivo en `/control` podés ponerle un
**nombre interno** (solo lo ves vos, ej. "Actor 1 - Ana") — no afecta lo
que ve el actor, eso se arma en el paso 2.

## 2. Armar la lista de chats de cada actor

Cada teléfono ya no tiene una sola conversación: tiene una **lista de
chats**, como el home de WhatsApp. Se arma desde **`/control/contacts`**
(link "👥 Contactos" en `/control`) — panel separado de la mensajería en
vivo.

1. Elegí el dispositivo en la lista de la izquierda
2. **💬 + Contacto simulado**: crea un chat falso — completá nombre, foto
   y estado. Vos vas a escribir ambos lados de esta conversación durante
   el rodaje (ver sección 4)
3. **🔗 + Linkear con otro actor**: elegís otro dispositivo ya creado, y
   se arma un chat real entre los dos — lo que escriba un actor le llega
   de verdad al otro, en vivo, **sin que vos intervengas**
4. Repetí para armar toda la lista de contactos que necesite cada actor

Podés volver a este panel en cualquier momento del rodaje para agregar,
renombrar, eliminar o desvincular chats — los cambios se ven en el
teléfono al instante, sin reinstalar.

## 3. Instalar en el Android del actor

1. El actor abre su link (`/device/actor1`) en **Chrome**
2. Toca el menú (⋮, arriba a la derecha) → **"Instalar app"**
   (o "Agregar a pantalla de inicio")
3. Abre la app desde el ícono que quedó en su pantalla de inicio — arranca
   en la lista de chats, a pantalla completa, sin barra del navegador

## 4. Durante el rodaje (vos, desde `/control`)

1. Elegí el dispositivo en la lista de la izquierda (punto verde = está
   online)
2. Elegí la conversación con las pestañas de arriba (💬 simulada / 🔗
   linkeada)
3. **Si es simulada**, tenés el control total:
   - Toggle arriba del cuadro de texto: 📥 **Mensaje del contacto**
     (aparece a la izquierda en el teléfono) / 📤 **Mensaje del actor**
     (aparece a la derecha)
   - Escribí y **Enviar** — aparece al instante
   - **Simular "escribiendo..."**, **Marcar como visto**, **Simular
     llamada entrante**
4. **Si es linkeada**, ves el hilo en vivo pero de solo lectura — esa
   conversación es real entre los dos actores, no podés escribir ahí.
   Solo queda disponible **Simular llamada entrante**, por si querés
   interrumpir la escena con eso
5. Todo lo que el actor escribe desde su teléfono (en cualquiera de los
   dos tipos de chat) aparece acá en vivo

## 5. Qué puede hacer el actor por su cuenta

- Ver su lista de chats y entrar al que corresponda a la escena
- Escribir y mandar mensajes desde su propio teclado en cualquier chat
  (aparecen del lado derecho)
- En un chat **linkeado**, si escribe, el otro actor ve "escribiendo..."
  en vivo — no hace falta que vos lo simules
- Si le llega una llamada simulada: **botón verde** contesta (dice
  "Conectando..." y se cierra sola), **botón rojo** o tocar afuera la
  rechaza

## 6. Personalizar la apariencia (opcional)

Desde `/control` → **"🎨 Apariencia"** (arriba de la lista de dispositivos):

- Elegí uno de los 3 skins base (**WhatsApp oscuro**, **iMessage claro**,
  **Vintage**) en el desplegable, o tocá **"+ Nuevo skin"** para armar el
  tuyo: color de fondo, color de las burbujas, color de los tildes de
  visto/no visto, tipo y tamaño de letra — la vista previa a la derecha
  se actualiza al toque
- **Guardar cambios** lo guarda para usarlo después; **Activar para el
  rodaje** lo pone en vivo en todos los teléfonos al instante (no hace
  falta reinstalar ni recargar)
- Los skins quedan guardados para el próximo rodaje que uses con esta
  misma app

La foto de avatar de cada contacto se sube desde `/control/contacts`,
seleccionando el chat correspondiente — reemplaza el círculo con inicial
en el teléfono del actor.

## 7. Problemas comunes

- **No aparece en la lista de `/control`**: el actor no tiene la app
  abierta, o se cortó el wifi — pedile que la vuelva a abrir
- **El mensaje no llega**: revisá que en `/control` esté seleccionado el
  dispositivo **y** la conversación correctos (se resaltan en azul)
- **Un chat linkeado no deja escribir desde `/control`**: es esperado —
  esas conversaciones son reales entre los dos actores, el director solo
  puede verlas
- **Instaló mal / quiere reinstalar**: borrar el ícono de la pantalla de
  inicio y repetir el paso 3
- **Nombre o foto de un contacto mal cargados**: se corrigen en cualquier
  momento desde `/control/contacts`, incluso con la app ya abierta — se
  actualiza solo, no hace falta reinstalar
