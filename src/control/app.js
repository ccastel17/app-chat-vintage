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

const newDeviceBtn = document.getElementById("new-device-btn");
const newDeviceForm = document.getElementById("new-device-form");
const newRoomIdInput = document.getElementById("new-room-id");
const cancelNewDeviceBtn = document.getElementById("cancel-new-device-btn");

const roomSettingsEl = document.getElementById("room-settings");
const editLabelInput = document.getElementById("edit-room-label");
const editContactNameInput = document.getElementById("edit-contact-name");
const editContactStatusInput = document.getElementById("edit-contact-status");
const saveRoomSettingsBtn = document.getElementById("save-room-settings-btn");

let activeRoomId = null;
let direction = "incoming"; // "incoming" = mensaje del contacto | "outgoing" = mensaje del actor
let activeRoomChannel = null;
let typingActive = false;

const rooms = new Map(); // room_id -> { room_id, label, contact_name, contact_status }
const onlineRoomIds = new Set();

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

function fillRoomSettings(roomId) {
  const room = rooms.get(roomId);
  editLabelInput.value = room?.label || roomId;
  editContactNameInput.value = room?.contact_name || "Contacto";
  editContactStatusInput.value = room?.contact_status || "en línea";
}

async function setActiveRoom(roomId) {
  activeRoomId = roomId;
  activeRoomLabel.textContent = rooms.get(roomId)?.label || roomId;
  roomSettingsEl.classList.remove("hidden");
  fillRoomSettings(roomId);
  renderDeviceList();

  roomMessagesEl.innerHTML = '<span class="empty">Cargando…</span>';

  activeRoomChannel?.unsubscribe();
  activeRoomChannel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
      (payload) => {
        if (roomId !== activeRoomId) return;
        roomMessagesEl.querySelector(".empty")?.remove();
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

function renderDeviceList() {
  const allRoomIds = new Set([...rooms.keys(), ...onlineRoomIds]);
  devicesEl.innerHTML = "";

  if (allRoomIds.size === 0) {
    devicesEl.innerHTML = '<li class="empty">Sin dispositivos todavía</li>';
    return;
  }

  [...allRoomIds]
    .sort((a, b) => a.localeCompare(b))
    .forEach((roomId) => {
      const room = rooms.get(roomId);
      const li = document.createElement("li");
      li.dataset.roomId = roomId;
      li.className = [
        roomId === activeRoomId ? "active" : "",
        onlineRoomIds.has(roomId) ? "online" : "",
      ].join(" ").trim();
      li.innerHTML = `
        <span class="online-dot"></span>
        <span>
          <span class="device-label"></span><br>
          <span class="device-sub"></span>
        </span>
      `;
      li.querySelector(".device-label").textContent = room?.label || roomId;
      li.querySelector(".device-sub").textContent = room ? room.contact_name : "sin nombrar";
      li.addEventListener("click", () => setActiveRoom(roomId));
      devicesEl.appendChild(li);
    });
}

const presenceChannel = supabase.channel(DEVICES_PRESENCE_CHANNEL, {
  config: { presence: { key: "control" } },
});
presenceChannel
  .on("presence", { event: "sync" }, () => {
    const state = presenceChannel.presenceState();
    onlineRoomIds.clear();
    Object.keys(state)
      .filter((key) => key !== "control")
      .forEach((roomId) => onlineRoomIds.add(roomId));
    renderDeviceList();
  })
  .subscribe();

async function loadRooms() {
  const { data, error } = await supabase.from("rooms").select("*").order("created_at");
  if (error) {
    console.error("Error cargando rooms:", error);
    return;
  }
  data.forEach((room) => rooms.set(room.room_id, room));
  renderDeviceList();
}
loadRooms();

supabase
  .channel("rooms-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, (payload) => {
    if (payload.eventType === "DELETE") {
      rooms.delete(payload.old.room_id);
    } else {
      rooms.set(payload.new.room_id, payload.new);
    }
    renderDeviceList();
    if (payload.new?.room_id === activeRoomId) {
      activeRoomLabel.textContent = payload.new.label;
      fillRoomSettings(activeRoomId);
    }
  })
  .subscribe();

newDeviceBtn.addEventListener("click", () => {
  newDeviceForm.classList.toggle("hidden");
  newRoomIdInput.value = "";
  newRoomIdInput.focus();
});

cancelNewDeviceBtn.addEventListener("click", () => {
  newDeviceForm.classList.add("hidden");
});

newDeviceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const roomId = newRoomIdInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!roomId) return;

  const { error } = await supabase.from("rooms").upsert({
    room_id: roomId,
    label: roomId,
    contact_name: "Contacto",
    contact_status: "en línea",
  });
  if (error) {
    console.error("Error creando dispositivo:", error);
    return;
  }
  newDeviceForm.classList.add("hidden");
  setActiveRoom(roomId);
});

saveRoomSettingsBtn.addEventListener("click", async () => {
  if (!activeRoomId) return;
  const { error } = await supabase.from("rooms").upsert({
    room_id: activeRoomId,
    label: editLabelInput.value.trim() || activeRoomId,
    contact_name: editContactNameInput.value.trim() || "Contacto",
    contact_status: editContactStatusInput.value.trim() || "en línea",
  });
  if (error) console.error("Error guardando nombre:", error);
});

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
    payload: { callerName: rooms.get(activeRoomId)?.contact_name || activeRoomLabel.textContent },
  });
});
