// Panel de control (director)
import { supabase, DEVICES_PRESENCE_CHANNEL } from "../shared/supabaseClient.js";

const devicesEl = document.getElementById("devices");
const activeRoomLabel = document.getElementById("active-room-label");
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

function setActiveRoom(roomId) {
  activeRoomId = roomId;
  activeRoomLabel.textContent = roomId;
  [...devicesEl.children].forEach((li) =>
    li.classList.toggle("active", li.dataset.roomId === roomId)
  );

  activeRoomChannel?.unsubscribe();
  activeRoomChannel = supabase.channel(`room:${roomId}`).subscribe();
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
