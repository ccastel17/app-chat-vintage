// Panel de control (director)
import { supabase, DEVICES_PRESENCE_CHANNEL } from "../shared/supabaseClient.js";
import { applySkinVars } from "../shared/skin.js";

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
const editAvatarPreview = document.getElementById("edit-avatar-preview");
const editAvatarFile = document.getElementById("edit-avatar-file");

const openSkinModalBtn = document.getElementById("open-skin-modal-btn");
const closeSkinModalBtn = document.getElementById("close-skin-modal-btn");
const skinModalEl = document.getElementById("skin-modal");
const activeSkinHintEl = document.getElementById("active-skin-hint");
const skinSelect = document.getElementById("skin-select");
const newSkinBtn = document.getElementById("new-skin-btn");
const skinNameInput = document.getElementById("skin-name");
const skinModeInput = document.getElementById("skin-mode");
const skinBgInput = document.getElementById("skin-bg");
const skinBubbleInInput = document.getElementById("skin-bubble-in");
const skinBubbleOutInput = document.getElementById("skin-bubble-out");
const skinTickInput = document.getElementById("skin-tick");
const skinTickSeenInput = document.getElementById("skin-tick-seen");
const skinFontFamilyInput = document.getElementById("skin-font-family");
const skinFontSizeInput = document.getElementById("skin-font-size");
const saveSkinBtn = document.getElementById("save-skin-btn");
const activateSkinBtn = document.getElementById("activate-skin-btn");
const deleteSkinBtn = document.getElementById("delete-skin-btn");
const skinPreviewPhone = document.getElementById("skin-preview-phone");

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
  if (room?.avatar_url) {
    editAvatarPreview.style.backgroundImage = `url("${room.avatar_url}")`;
    editAvatarPreview.textContent = "";
  } else {
    editAvatarPreview.style.backgroundImage = "none";
    editAvatarPreview.textContent = (room?.contact_name || "?").trim().charAt(0).toUpperCase();
  }
}

editAvatarFile.addEventListener("change", async () => {
  const file = editAvatarFile.files[0];
  if (!file || !activeRoomId) return;
  const ext = file.name.split(".").pop();
  const path = `${activeRoomId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (uploadError) {
    console.error("Error subiendo avatar:", uploadError);
    return;
  }
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

  // Se incluyen los otros campos (con sus fallbacks ya cargados en el form)
  // porque si la room todavía no existía en la tabla, el upsert hace un
  // INSERT real y label/contact_name/contact_status son NOT NULL.
  const { error } = await supabase.from("rooms").upsert({
    room_id: activeRoomId,
    label: editLabelInput.value.trim() || activeRoomId,
    contact_name: editContactNameInput.value.trim() || "Contacto",
    contact_status: editContactStatusInput.value.trim() || "en línea",
    avatar_url: publicUrl,
  });
  if (error) console.error("Error guardando avatar:", error);
  editAvatarFile.value = "";
});

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

// ---------- Apariencia (skins) ----------

const skins = new Map(); // id -> skin row
let activeSkinId = null;
let editingSkinId = null; // null = borrador de skin nuevo, todavía no guardado

function skinFromForm() {
  return {
    name: skinNameInput.value.trim() || "Sin nombre",
    mode: skinModeInput.value,
    bg: skinBgInput.value,
    bubble_incoming_bg: skinBubbleInInput.value,
    bubble_outgoing_bg: skinBubbleOutInput.value,
    tick_color: skinTickInput.value,
    tick_seen_color: skinTickSeenInput.value,
    font_family: skinFontFamilyInput.value,
    font_size: skinFontSizeInput.value,
  };
}

function fillSkinForm(skin) {
  skinNameInput.value = skin.name;
  skinModeInput.value = skin.mode;
  skinBgInput.value = skin.bg;
  skinBubbleInInput.value = skin.bubble_incoming_bg;
  skinBubbleOutInput.value = skin.bubble_outgoing_bg;
  skinTickInput.value = skin.tick_color;
  skinTickSeenInput.value = skin.tick_seen_color;
  skinFontFamilyInput.value = skin.font_family;
  skinFontSizeInput.value = skin.font_size;
  updatePreview();
}

function updatePreview() {
  applySkinVars(skinPreviewPhone, skinFromForm());
}

function renderSkinSelect() {
  skinSelect.innerHTML = "";
  [...skins.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((skin) => {
      const opt = document.createElement("option");
      opt.value = skin.id;
      opt.textContent = skin.name + (skin.id === activeSkinId ? " (activo)" : "");
      skinSelect.appendChild(opt);
    });
  if (editingSkinId) skinSelect.value = editingSkinId;
}

function updateActiveHint() {
  const active = skins.get(activeSkinId);
  activeSkinHintEl.textContent = active ? `Activo para el rodaje: ${active.name}` : "";
}

async function loadSkins() {
  const { data, error } = await supabase.from("skins").select("*").order("name");
  if (error) {
    console.error("Error cargando skins:", error);
    return;
  }
  skins.clear();
  data.forEach((skin) => skins.set(skin.id, skin));
  renderSkinSelect();
  updateActiveHint();
}

async function loadActiveSkinId() {
  const { data } = await supabase.from("app_settings").select("active_skin_id").eq("id", 1).maybeSingle();
  activeSkinId = data?.active_skin_id || null;
  renderSkinSelect();
  updateActiveHint();
}

function selectSkinForEditing(skinId) {
  editingSkinId = skinId;
  const skin = skins.get(skinId);
  if (skin) fillSkinForm(skin);
  deleteSkinBtn.disabled = skinId === activeSkinId;
}

openSkinModalBtn.addEventListener("click", async () => {
  skinModalEl.classList.remove("hidden");
  await loadSkins();
  await loadActiveSkinId();
  selectSkinForEditing(activeSkinId || [...skins.keys()][0]);
});

closeSkinModalBtn.addEventListener("click", () => skinModalEl.classList.add("hidden"));

skinSelect.addEventListener("change", () => selectSkinForEditing(skinSelect.value));

[skinNameInput, skinModeInput, skinBgInput, skinBubbleInInput, skinBubbleOutInput, skinTickInput, skinTickSeenInput, skinFontFamilyInput, skinFontSizeInput]
  .forEach((input) => input.addEventListener("input", updatePreview));

newSkinBtn.addEventListener("click", () => {
  editingSkinId = null;
  fillSkinForm({
    name: "Nuevo skin",
    mode: "dark",
    bg: "#0b0f14",
    bubble_incoming_bg: "#1f242b",
    bubble_outgoing_bg: "#2f6fed",
    tick_color: "#9aa4af",
    tick_seen_color: "#7cd0ff",
    font_family: "system",
    font_size: "md",
  });
  deleteSkinBtn.disabled = true;
  skinNameInput.focus();
});

async function saveSkin() {
  const values = skinFromForm();
  const { data, error } = await supabase
    .from("skins")
    .upsert(editingSkinId ? { id: editingSkinId, ...values } : values)
    .select()
    .single();
  if (error) {
    if (error.message?.includes("duplicate") || error.code === "23505") {
      alert("Ya existe un skin con ese nombre — elegí otro.");
    } else {
      console.error("Error guardando skin:", error);
    }
    return null;
  }
  editingSkinId = data.id;
  await loadSkins();
  selectSkinForEditing(editingSkinId);
  return data.id;
}

saveSkinBtn.addEventListener("click", saveSkin);

activateSkinBtn.addEventListener("click", async () => {
  const skinId = editingSkinId || (await saveSkin());
  if (!skinId) return;
  const { error } = await supabase.from("app_settings").upsert({ id: 1, active_skin_id: skinId });
  if (error) {
    console.error("Error activando skin:", error);
    return;
  }
  await loadActiveSkinId();
});

deleteSkinBtn.addEventListener("click", async () => {
  if (!editingSkinId) return;
  if (!confirm(`¿Eliminar el skin "${skins.get(editingSkinId)?.name}"?`)) return;
  const { error } = await supabase.from("skins").delete().eq("id", editingSkinId);
  if (error) {
    if (error.message?.includes("foreign key")) {
      alert("Ese skin está activo — activá otro antes de borrarlo.");
    } else {
      console.error("Error borrando skin:", error);
    }
    return;
  }
  await loadSkins();
  selectSkinForEditing(activeSkinId || [...skins.keys()][0]);
});
