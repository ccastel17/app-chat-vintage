// Vista del dispositivo (actor)
// TODO en la primera sesión con Claude Code:
//  1. Instalar/importar el cliente de Supabase
//  2. Leer el room_id desde la URL (/device/[roomId])
//  3. Suscribirse al canal Realtime filtrado por room_id
//  4. Pintar mensajes entrantes en #messages con estilo de burbuja
//  5. Mostrar/ocultar #typing-indicator según eventos del panel de control

const messagesEl = document.getElementById("messages");
const typingEl = document.getElementById("typing-indicator");

function getRoomIdFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  // /device/:roomId
  return parts[1] || null;
}

function renderMessage({ sender, content, status, created_at }) {
  const bubble = document.createElement("div");
  bubble.className = "bubble incoming"; // o "outgoing" según el rol simulado
  bubble.innerHTML = `
    <p class="bubble-text"></p>
    <span class="bubble-meta"></span>
  `;
  bubble.querySelector(".bubble-text").textContent = content;
  bubble.querySelector(".bubble-meta").textContent = new Date(created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping(isTyping) {
  typingEl.classList.toggle("hidden", !isTyping);
}

const roomId = getRoomIdFromUrl();
console.log("Device room:", roomId);

// Placeholder — se reemplaza en la sesión de integración con Supabase
// renderMessage({ sender: "demo", content: "Mensaje de ejemplo", status: "visto", created_at: new Date() });
