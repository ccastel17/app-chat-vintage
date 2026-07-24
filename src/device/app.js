// Vista del dispositivo (actor)
import { supabase, DEVICES_PRESENCE_CHANNEL } from "../shared/supabaseClient.js";

const messagesEl = document.getElementById("messages");
const contactNameEl = document.getElementById("contact-name");
const contactStatusEl = document.getElementById("contact-status");
const contactAvatarEl = document.getElementById("contact-avatar");
const callOverlayEl = document.getElementById("incoming-call-overlay");
const callAvatarEl = document.getElementById("call-avatar");
const callerNameEl = document.getElementById("caller-name");
const callAcceptBtn = document.getElementById("call-accept-btn");
const callDeclineBtn = document.getElementById("call-decline-btn");
const messageInput = document.getElementById("device-message-input");
const sendBtn = document.getElementById("device-send-btn");

let typingTimeout = null;
let typingBubbleEl = null;
let idleStatus = contactStatusEl.textContent;

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

contactAvatarEl.textContent = initials(contactNameEl.textContent);

function applyRoomInfo(room) {
  if (!room) return;
  contactNameEl.textContent = room.contact_name;
  contactAvatarEl.textContent = initials(room.contact_name);
  idleStatus = room.contact_status;
  if (!typingBubbleEl) {
    contactStatusEl.textContent = idleStatus;
  }
}

function getRoomIdFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  // /device/:roomId
  return parts[1] || null;
}

function ticksFor(status) {
  if (status === "visto") return '<span class="bubble-ticks seen">✓✓</span>';
  if (status === "entregado") return '<span class="bubble-ticks">✓✓</span>';
  return '<span class="bubble-ticks">✓</span>';
}

function renderMessage({ id, content, status, direction, created_at }) {
  const isOutgoing = direction === "outgoing";
  const bubble = document.createElement("div");
  bubble.className = `bubble ${isOutgoing ? "outgoing" : "incoming"}`;
  bubble.dataset.id = id;
  bubble.innerHTML = `
    <p class="bubble-text"></p>
    <span class="bubble-meta">
      <span class="bubble-time"></span>
      ${isOutgoing ? ticksFor(status) : ""}
    </span>
  `;
  bubble.querySelector(".bubble-text").textContent = content;
  bubble.querySelector(".bubble-time").textContent = new Date(created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateMessageStatus(id, status) {
  const bubble = messagesEl.querySelector(`[data-id="${id}"]`);
  const ticksEl = bubble?.querySelector(".bubble-ticks");
  if (!ticksEl) return;
  ticksEl.outerHTML = ticksFor(status);
}

function showTyping(isTyping) {
  clearTimeout(typingTimeout);
  if (isTyping) {
    contactStatusEl.textContent = "escribiendo...";
    contactStatusEl.classList.add("typing");
    if (!typingBubbleEl) {
      typingBubbleEl = document.createElement("div");
      typingBubbleEl.className = "bubble incoming typing";
      typingBubbleEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
      messagesEl.appendChild(typingBubbleEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    // Por si el panel de control no manda el evento de "parar" explícito
    typingTimeout = setTimeout(() => showTyping(false), 6000);
  } else {
    contactStatusEl.textContent = idleStatus;
    contactStatusEl.classList.remove("typing");
    typingBubbleEl?.remove();
    typingBubbleEl = null;
  }
}

function showIncomingCall(callerName) {
  if (!callOverlayEl) return;
  const name = callerName || "Contacto";
  callerNameEl.textContent = name;
  callAvatarEl.textContent = initials(name);
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
  // Nombre del contacto simulado, definido desde /control
  supabase
    .from("rooms")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle()
    .then(({ data }) => applyRoomInfo(data));

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
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
      (payload) => updateMessageStatus(payload.new.id, payload.new.status)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "rooms", filter: `room_id=eq.${roomId}` },
      (payload) => applyRoomInfo(payload.new)
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

  callDeclineBtn.addEventListener("click", hideIncomingCall);
  callAcceptBtn.addEventListener("click", () => {
    callerNameEl.textContent = "Conectando...";
    setTimeout(hideIncomingCall, 1500);
  });

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
