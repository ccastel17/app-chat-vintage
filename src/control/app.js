// Panel de control (director)
// TODO en la primera sesión con Claude Code:
//  1. Instalar/importar el cliente de Supabase
//  2. Cargar lista de rooms/dispositivos activos en #devices
//  3. Al seleccionar un dispositivo, guardar el room_id activo
//  4. #send-btn → insertar en la tabla `messages` con ese room_id
//  5. #typing-btn / #seen-btn / #call-btn → disparar eventos Realtime
//     (broadcast, no necesariamente insert en la tabla) para estados

const devicesEl = document.getElementById("devices");
const activeRoomLabel = document.getElementById("active-room-label");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const typingBtn = document.getElementById("typing-btn");
const seenBtn = document.getElementById("seen-btn");
const callBtn = document.getElementById("call-btn");

let activeRoomId = null;

function setActiveRoom(roomId, label) {
  activeRoomId = roomId;
  activeRoomLabel.textContent = label;
}

sendBtn.addEventListener("click", () => {
  if (!activeRoomId || !messageInput.value.trim()) return;
  console.log("Enviar a", activeRoomId, ":", messageInput.value);
  // TODO: insert en Supabase tabla `messages`
  messageInput.value = "";
});

typingBtn.addEventListener("click", () => {
  console.log("Simular escribiendo en", activeRoomId);
  // TODO: broadcast Realtime evento "typing"
});

seenBtn.addEventListener("click", () => {
  console.log("Marcar como visto en", activeRoomId);
  // TODO: update status en Supabase
});

callBtn.addEventListener("click", () => {
  console.log("Simular llamada entrante en", activeRoomId);
  // TODO: broadcast Realtime evento "incoming_call"
});

// Placeholder de ejemplo — reemplazar por lista real desde Supabase
// setActiveRoom("demo-room", "Actor 1");
