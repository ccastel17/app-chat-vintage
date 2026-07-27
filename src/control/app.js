// Panel de control (director)
import { supabase, DEVICES_PRESENCE_CHANNEL } from "../shared/supabaseClient.js";
import { applySkinVars } from "../shared/skin.js";
import { isOutgoing } from "../shared/conversation.js";
import { uploadChatImage } from "../shared/uploadImage.js";

const devicesEl = document.getElementById("devices");
const activeRoomLabel = document.getElementById("active-room-label");
const speakerControlEl = document.getElementById("speaker-control");
const conversationSelect = document.getElementById("conversation-select");
const linkedHintEl = document.getElementById("linked-hint");
const roomMessagesEl = document.getElementById("room-messages");
const composerEl = document.getElementById("composer");
const quickActionsEl = document.getElementById("quick-actions");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const imageInput = document.getElementById("image-input");
const attachBtn = document.getElementById("attach-btn");
const directionBtn = document.getElementById("direction-btn");
const typingBtn = document.getElementById("typing-btn");
const seenBtn = document.getElementById("seen-btn");
const callBtn = document.getElementById("call-btn");
const clearChatBtn = document.getElementById("clear-chat-btn");

const newDeviceBtn = document.getElementById("new-device-btn");
const newDeviceForm = document.getElementById("new-device-form");
const newRoomIdInput = document.getElementById("new-room-id");
const cancelNewDeviceBtn = document.getElementById("cancel-new-device-btn");

const roomSettingsEl = document.getElementById("room-settings");
const editRoomAvatarEl = document.getElementById("edit-room-avatar");
const editRoomAvatarFile = document.getElementById("edit-room-avatar-file");
const editLabelInput = document.getElementById("edit-room-label");
const saveRoomSettingsBtn = document.getElementById("save-room-settings-btn");

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
let activeConversationId = null;
let direction = "incoming"; // "incoming" = mensaje del contacto | "outgoing" = mensaje del actor
let activeThreadChannel = null;
let typingActive = false;

const rooms = new Map(); // room_id -> { room_id, label }
const onlineRoomIds = new Set();
const conversations = new Map(); // id -> conversation row (solo las del room activo)

function activeConversation() {
  return conversations.get(activeConversationId) || null;
}

async function deleteMessage(id) {
  roomMessagesEl.querySelector(`[data-id="${id}"]`)?.remove();
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) console.error("Error borrando mensaje:", error);
}

function renderMessage(conversation, { id, content, image_url, direction, sender_room_id, created_at }) {
  const outgoing = isOutgoing(conversation, { direction, sender_room_id }, conversation.room_id);
  const msg = document.createElement("div");
  msg.className = `msg ${outgoing ? "outgoing" : "incoming"}`;
  msg.dataset.id = id;
  msg.innerHTML = `
    ${image_url ? '<img class="msg-image" alt="Foto" />' : ""}
    ${content ? '<span class="msg-text"></span>' : ""}
    <span class="msg-meta"></span>
    <button type="button" class="msg-delete-btn" title="Eliminar mensaje">✕</button>
  `;
  if (image_url) msg.querySelector(".msg-image").src = image_url;
  if (content) msg.querySelector(".msg-text").textContent = content;
  msg.querySelector(".msg-meta").textContent = new Date(created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  msg.querySelector(".msg-delete-btn").addEventListener("click", () => deleteMessage(id));
  roomMessagesEl.appendChild(msg);
  roomMessagesEl.scrollTop = roomMessagesEl.scrollHeight;
}

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function fillRoomSettings(roomId) {
  const room = rooms.get(roomId);
  editLabelInput.value = room?.label || roomId;
  if (room?.avatar_url) {
    editRoomAvatarEl.style.backgroundImage = `url("${room.avatar_url}")`;
    editRoomAvatarEl.textContent = "";
  } else {
    editRoomAvatarEl.style.backgroundImage = "none";
    editRoomAvatarEl.textContent = initials(room?.label || roomId);
  }
}

editRoomAvatarFile.addEventListener("change", async () => {
  const file = editRoomAvatarFile.files[0];
  if (!file || !activeRoomId) return;
  const ext = file.name.split(".").pop();
  const path = `room-${activeRoomId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (uploadError) {
    console.error("Error subiendo avatar:", uploadError);
    return;
  }
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase.from("rooms").upsert({
    room_id: activeRoomId,
    label: editLabelInput.value.trim() || activeRoomId,
    avatar_url: publicUrl,
  });
  if (error) console.error("Error guardando avatar:", error);
  editRoomAvatarFile.value = "";
});

function updateDirectionBtn() {
  directionBtn.textContent =
    direction === "incoming" ? "📥 Mensaje del contacto" : "📤 Mensaje del actor";
}

function applyConversationModeUI(conversation) {
  const isLinked = conversation?.kind === "linked";
  composerEl.classList.toggle("hidden", !conversation || isLinked);
  directionBtn.classList.toggle("hidden", !conversation || isLinked);
  linkedHintEl.classList.toggle("hidden", !isLinked);
  typingBtn.disabled = !conversation || isLinked;
  seenBtn.disabled = !conversation || isLinked;
  callBtn.disabled = !conversation;
  clearChatBtn.disabled = !conversation;
}

function renderConversationSelect() {
  const items = [...conversations.values()];
  if (items.length === 0) {
    speakerControlEl.classList.add("hidden");
    return;
  }
  speakerControlEl.classList.remove("hidden");
  conversationSelect.innerHTML = "";
  items.forEach((conversation) => {
    const opt = document.createElement("option");
    opt.value = conversation.id;
    opt.textContent = `${conversation.kind === "linked" ? "🔗" : "💬"} ${conversation.contact_name}`;
    conversationSelect.appendChild(opt);
  });
  if (activeConversationId) conversationSelect.value = activeConversationId;
}

conversationSelect.addEventListener("change", () => setActiveConversation(conversationSelect.value));

async function setActiveConversation(conversationId) {
  activeConversationId = conversationId;
  renderConversationSelect();
  const conversation = activeConversation();
  applyConversationModeUI(conversation);

  activeThreadChannel?.unsubscribe();
  roomMessagesEl.innerHTML = "";

  if (!conversation) {
    roomMessagesEl.innerHTML =
      '<span class="empty">Este dispositivo no tiene conversaciones — andá a <a href="/control/contacts">Contactos</a> para agregar una.</span>';
    return;
  }

  roomMessagesEl.innerHTML = '<span class="empty">Cargando…</span>';
  const threadId = conversation.thread_id;

  activeThreadChannel = supabase
    .channel(`thread:${threadId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
      (payload) => {
        if (conversationId !== activeConversationId) return;
        roomMessagesEl.querySelector(".empty")?.remove();
        renderMessage(conversation, payload.new);
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
      (payload) => {
        if (conversationId !== activeConversationId) return;
        roomMessagesEl.querySelector(`[data-id="${payload.old.id}"]`)?.remove();
        if (!roomMessagesEl.querySelector(".msg")) {
          roomMessagesEl.innerHTML = '<span class="empty">Sin mensajes todavía</span>';
        }
      }
    )
    .subscribe();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (conversationId !== activeConversationId) return;
  roomMessagesEl.innerHTML = "";
  if (error) {
    console.error("Error cargando historial:", error);
    return;
  }
  if (data.length === 0) {
    roomMessagesEl.innerHTML = '<span class="empty">Sin mensajes todavía</span>';
    return;
  }
  data.forEach((m) => renderMessage(conversation, m));
}

async function loadConversationsForRoom(roomId) {
  const { data, error } = await supabase.from("conversations").select("*").eq("room_id", roomId);
  conversations.clear();
  if (error) {
    console.error("Error cargando conversaciones:", error);
  } else {
    data.forEach((c) => conversations.set(c.id, c));
  }
  renderConversationSelect();
  const first = [...conversations.keys()][0] || null;
  await setActiveConversation(first);
}

let conversationsChannel = null;

async function setActiveRoom(roomId) {
  activeRoomId = roomId;
  activeConversationId = null;
  activeRoomLabel.textContent = rooms.get(roomId)?.label || roomId;
  roomSettingsEl.classList.remove("hidden");
  fillRoomSettings(roomId);
  renderDeviceList();

  await loadConversationsForRoom(roomId);

  conversationsChannel?.unsubscribe();
  conversationsChannel = supabase
    .channel(`conversations-of:${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations", filter: `room_id=eq.${roomId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          conversations.delete(payload.old.id);
        } else {
          conversations.set(payload.new.id, payload.new);
        }
        renderConversationSelect();
        if (!activeConversationId) {
          setActiveConversation([...conversations.keys()][0] || null);
        }
      }
    )
    .subscribe();
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
      const li = document.createElement("li");
      li.dataset.roomId = roomId;
      li.className = [
        roomId === activeRoomId ? "active" : "",
        onlineRoomIds.has(roomId) ? "online" : "",
      ].join(" ").trim();
      li.innerHTML = `
        <span class="device-row-top">
          <span class="online-dot"></span>
          <span class="device-label"></span>
        </span>
        <span class="device-row-actions">
          <a class="device-action-link view-chat-link" target="_blank" rel="noopener" title="Ver chat">
            <span class="action-icon">💬</span><span class="action-label">Ver chat</span>
          </a>
          <a class="device-action-link edit-list-link" target="_blank" rel="noopener" title="Editar lista">
            <span class="action-icon">📝</span><span class="action-label">Editar lista</span>
          </a>
        </span>
      `;
      li.querySelector(".device-label").textContent = rooms.get(roomId)?.label || roomId;
      const viewChatLink = li.querySelector(".view-chat-link");
      viewChatLink.href = `/device/${roomId}`;
      viewChatLink.addEventListener("click", (e) => e.stopPropagation());
      const editListLink = li.querySelector(".edit-list-link");
      editListLink.href = `/control/contacts?room=${encodeURIComponent(roomId)}`;
      editListLink.addEventListener("click", (e) => e.stopPropagation());
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

  const { error } = await supabase.from("rooms").upsert({ room_id: roomId, label: roomId });
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
  const conversation = activeConversation();
  if (!conversation || conversation.kind === "linked" || !content) return;

  const { error } = await supabase.from("messages").insert({
    thread_id: conversation.thread_id,
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

imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];
  imageInput.value = "";
  const conversation = activeConversation();
  if (!file || !conversation || conversation.kind === "linked") return;

  let imageUrl;
  try {
    imageUrl = await uploadChatImage(supabase, conversation.thread_id, file);
  } catch (error) {
    console.error("Error subiendo foto:", error);
    return;
  }
  const { error } = await supabase.from("messages").insert({
    thread_id: conversation.thread_id,
    content: "",
    image_url: imageUrl,
    direction,
  });
  if (error) console.error("Error enviando foto:", error);
});

function setTypingBroadcast(isTyping) {
  if (!activeConversation() || activeConversation().kind === "linked") return;
  typingActive = isTyping;
  typingBtn.classList.toggle("active", isTyping);
  activeThreadChannel?.send({
    type: "broadcast",
    event: "typing",
    payload: { isTyping },
  });
}

typingBtn.addEventListener("click", () => setTypingBroadcast(!typingActive));

seenBtn.addEventListener("click", async () => {
  const conversation = activeConversation();
  if (!conversation || conversation.kind === "linked") return;
  const { error } = await supabase
    .from("messages")
    .update({ status: "visto" })
    .eq("thread_id", conversation.thread_id)
    .eq("direction", "outgoing");
  if (error) console.error("Error marcando como visto:", error);
});

clearChatBtn.addEventListener("click", async () => {
  const conversation = activeConversation();
  if (!conversation) return;
  if (!confirm(`¿Vaciar todos los mensajes de "${conversation.contact_name}"? No se puede deshacer.`)) return;

  roomMessagesEl.innerHTML = '<span class="empty">Sin mensajes todavía</span>';
  const { error } = await supabase.from("messages").delete().eq("thread_id", conversation.thread_id);
  if (error) console.error("Error vaciando el chat:", error);
});

callBtn.addEventListener("click", () => {
  const conversation = activeConversation();
  if (!conversation) return;
  activeThreadChannel?.send({
    type: "broadcast",
    event: "incoming_call",
    payload: { callerName: conversation.contact_name },
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
