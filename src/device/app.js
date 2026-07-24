// Vista del dispositivo (actor)
import { supabase, DEVICES_PRESENCE_CHANNEL } from "../shared/supabaseClient.js";

const messagesEl = document.getElementById("messages");
const typingEl = document.getElementById("typing-indicator");
const callOverlayEl = document.getElementById("incoming-call-overlay");
const callerNameEl = document.getElementById("caller-name");
const messageInput = document.getElementById("device-message-input");
const sendBtn = document.getElementById("device-send-btn");

let typingTimeout = null;

function getRoomIdFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  // /device/:roomId
  return parts[1] || null;
}

function renderMessage({ sender, content, status, direction, created_at }) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${direction === "outgoing" ? "outgoing" : "incoming"}`;
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
  clearTimeout(typingTimeout);
  if (isTyping) {
    // Por si el panel de control no manda el evento de "parar" explícito
    typingTimeout = setTimeout(() => typingEl.classList.add("hidden"), 6000);
  }
}

function showIncomingCall(callerName) {
  if (!callOverlayEl) return;
  callerNameEl.textContent = callerName || "Contacto";
  callOverlayEl.classList.remove("hidden");
}

function hideIncomingCall() {
  callOverlayEl?.classList.add("hidden");
}

const roomId = getRoomIdFromUrl();

if (!roomId) {
  messagesEl.innerHTML = '<p style="padding:16px;color:#7d8792;">Falta el room_id en la URL (/device/roomId)</p>';
  sendBtn.disabled = true;
  messageInput.disabled = true;
} else {
  // Historial existente
  supabase
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .then(({ data, error }) => {
      if (error) {
        console.error("Error cargando historial:", error);
        return;
      }
      data.forEach(renderMessage);
    });

  const roomChannel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
      (payload) => {
        showTyping(false);
        renderMessage(payload.new);
      }
    )
    .on("broadcast", { event: "typing" }, ({ payload }) => showTyping(payload.isTyping))
    .on("broadcast", { event: "incoming_call" }, ({ payload }) => showIncomingCall(payload.callerName))
    .on("broadcast", { event: "end_call" }, () => hideIncomingCall())
    .subscribe();

  // Presencia: anunciarse como dispositivo activo para que /control lo liste
  const presenceChannel = supabase.channel(DEVICES_PRESENCE_CHANNEL, {
    config: { presence: { key: roomId } },
  });
  presenceChannel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      presenceChannel.track({ room_id: roomId, online_at: new Date().toISOString() });
    }
  });

  callOverlayEl?.addEventListener("click", hideIncomingCall);

  async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;
    messageInput.value = "";
    const { error } = await supabase.from("messages").insert({
      room_id: roomId,
      sender: "actor",
      content,
      direction: "outgoing",
    });
    if (error) console.error("Error enviando mensaje:", error);
  }

  sendBtn.addEventListener("click", sendMessage);
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}
