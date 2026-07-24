// Panel de control (director)
import { supabase, DEVICES_PRESENCE_CHANNEL } from "../shared/supabaseClient.js";

const devicesEl = document.getElementById("devices");
const activeRoomLabel = document.getElementById("active-room-label");
const roomMessagesEl = document.getElementById("room-messages");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const directionBtn = document.getElementById("direction-btn");
const typingBtn = document.getElementById("typing-btn");
const seenBtn = document.getElementById("seen-btn");
const callBtn = document.getElementById("call-btn");

let activeRoomId = null;
let direction = "incoming"; // "incoming" = mensaje del contacto | "outgoing" = mensaje del actor
let activeRoomChannel = null;
let typingActive = false;

function updateDirectionBtn() {
  directionBtn.textContent =
    direction === "incoming" ? "📥 Mensaje del contacto" : "📤 Mensaje del actor";
}

function renderMessage({ content, direction, created_at }) {
  const msg = document.createElement("div");
  msg.className = `msg ${direction === "outgoing" ? "outgoing" : "incoming"}`;
  msg.innerHTML = `<span class="msg-text"></span><span class="msg-meta"></span>`;
  msg.querySelector(".msg-text").textContent = content;
  msg.querySelector(".msg-meta").textContent = new Date(created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  roomMessagesEl.appendChild(msg);
  roomMessagesEl.scrollTop = roomMessagesEl.scrollHeight;
}

async function setActiveRoom(roomId) {
  activeRoomId = roomId;
  activeRoomLabel.textContent = roomId;
  [...devicesEl.children].forEach((li) =>
    li.classList.toggle("active", li.dataset.roomId === roomId)
  );

  roomMessagesEl.innerHTML = '<span class="empty">Cargando…</span>';

  activeRoomChannel?.unsubscribe();
  activeRoomChannel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
      (payload) => {
        if (roomId !== activeRoomId) return;
        renderMessage(payload.new);
      }
    )
    .subscribe();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (roomId !== activeRoomId) return; // el director cambió de room mientras cargaba
  roomMessagesEl.innerHTML = "";
  if (error) {
    console.error("Error cargando historial:", error);
    return;
  }
  if (data.length === 0) {
    roomMessagesEl.innerHTML = '<span class="empty">Sin mensajes todavía</span>';
    return;
  }
  data.forEach(renderMessage);
}

function renderDeviceList(roomIds) {
  devicesEl.innerHTML = "";
  roomIds.forEach((roomId) => {
    const li = document.createElement("li");
    li.textContent = roomId;
    li.dataset.roomId = roomId;
    li.className = roomId === activeRoomId ? "active" : "";
    li.addEventListener("click", () => setActiveRoom(roomId));
    devicesEl.appendChild(li);
  });
  if (roomIds.length === 0) {
    devicesEl.innerHTML = '<li class="empty">Sin dispositivos conectados</li>';
  }
}

const presenceChannel = supabase.channel(DEVICES_PRESENCE_CHANNEL, {
  config: { presence: { key: "control" } },
});
presenceChannel
  .on("presence", { event: "sync" }, () => {
    const state = presenceChannel.presenceState();
    const roomIds = Object.keys(state).filter((key) => key !== "control");
    renderDeviceList(roomIds);
  })
  .subscribe();

directionBtn.addEventListener("click", () => {
  direction = direction === "incoming" ? "outgoing" : "incoming";
  updateDirectionBtn();
});
updateDirectionBtn();

sendBtn.addEventListener("click", async () => {
  const content = messageInput.value.trim();
  if (!activeRoomId || !content) return;

  const { error } = await supabase.from("messages").insert({
    room_id: activeRoomId,
    sender: direction === "incoming" ? "contacto" : "actor",
    content,
    direction,
  });
  if (error) {
    console.error("Error enviando mensaje:", error);
    return;
  }
  messageInput.value = "";
  setTypingBroadcast(false);
});

function setTypingBroadcast(isTyping) {
  if (!activeRoomId) return;
  typingActive = isTyping;
  typingBtn.classList.toggle("active", isTyping);
  activeRoomChannel?.send({
    type: "broadcast",
    event: "typing",
    payload: { isTyping },
  });
}

typingBtn.addEventListener("click", () => setTypingBroadcast(!typingActive));

seenBtn.addEventListener("click", async () => {
  if (!activeRoomId) return;
  const { error } = await supabase
    .from("messages")
    .update({ status: "visto" })
    .eq("room_id", activeRoomId)
    .eq("direction", "outgoing");
  if (error) console.error("Error marcando como visto:", error);
});

callBtn.addEventListener("click", () => {
  if (!activeRoomId) return;
  activeRoomChannel?.send({
    type: "broadcast",
    event: "incoming_call",
    payload: { callerName: activeRoomLabel.textContent },
  });
});
