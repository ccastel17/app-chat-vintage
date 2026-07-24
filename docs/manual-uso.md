# Manual de uso — App Chat Rodaje

App: **https://app-chat-vintage.vercel.app**

## 1. Antes del rodaje (una vez por actor/escena)

**Vos (director), desde una laptop/tablet:**

1. Abrí `https://app-chat-vintage.vercel.app/control`
2. Clic en **"+ Nuevo dispositivo"**, poné un código simple sin espacios
   (ej. `actor1`) → Crear
3. Seleccionalo en la lista y completá:
   - **Nombre interno**: cómo lo identificás vos (ej. "Actor 1 - Ana")
   - **Nombre del contacto**: lo que va a ver el actor en su pantalla
     (ej. "Mamá", "Jefe", "Desconocido")
   - **Estado**: texto bajo el nombre (ej. "en línea")
   - Guardar
4. El link para ese actor es `https://app-chat-vintage.vercel.app/device/actor1`
   (con el código que usaste)

**El actor, en su Android:**

1. Abre ese link en **Chrome**
2. Toca el menú (⋮, arriba a la derecha) → **"Instalar app"**
   (o "Agregar a pantalla de inicio")
3. Abre la app desde el ícono que quedó en su pantalla de inicio — se ve a
   pantalla completa, sin barra del navegador

Repetir por cada actor/teléfono, cada uno con su propio código.

## 2. Durante el rodaje (vos, desde `/control`)

1. Elegí el dispositivo en la lista de la izquierda (punto verde = está
   online)
2. Elegí quién "habla" con el toggle de arriba del cuadro de texto:
   - 📥 **Mensaje del contacto** → aparece del lado izquierdo en la
     pantalla del actor
   - 📤 **Mensaje del actor** → aparece del lado derecho (como si el actor
     lo hubiera escrito)
3. Escribí y **Enviar** — aparece al instante en el teléfono
4. Botones rápidos:
   - **Simular "escribiendo..."** → muestra los puntitos animados, tocá
     de nuevo para apagarlo
   - **Marcar como visto** → pone el check azul en los mensajes del actor
   - **Simular llamada entrante** → pantalla de llamada a pantalla
     completa en el teléfono del actor
5. Todo lo que el actor escribe desde su teléfono aparece también acá, en
   el cuadro de mensajes, en vivo

## 3. Qué puede hacer el actor por su cuenta

- Escribir y mandar mensajes desde su propio teclado (aparecen del lado
  derecho, igual que si vos hubieras tocado "Mensaje del actor")
- Si le llega una llamada simulada: **botón verde** contesta (dice
  "Conectando..." y se cierra solo), **botón rojo** o tocar afuera la
  rechaza

## 4. Personalizar la apariencia (opcional)

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

La foto de avatar del contacto se sube desde el panel de nombre del
dispositivo (donde ponés el nombre interno/de contacto), botón **"Foto
de avatar"** — reemplaza el círculo con inicial en el teléfono del actor.

## 5. Problemas comunes

- **No aparece en la lista de `/control`**: el actor no tiene la app
  abierta, o se cortó el wifi — pedile que la vuelva a abrir
- **El mensaje no llega**: revisar que en `/control` esté seleccionado el
  dispositivo correcto (se resalta en azul)
- **Instaló mal / quiere reinstalar**: borrar el ícono de la pantalla de
  inicio y repetir el paso 1 de instalación
- **Nombre de contacto mal escrito**: se corrige en cualquier momento
  desde `/control`, incluso con el actor ya con la app abierta — se
  actualiza solo, no hace falta reinstalar
