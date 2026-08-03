// Panel de control (director)
import { supabase, DEVICES_PRESENCE_CHANNEL, notificationsChannelName } from "../shared/supabaseClient.js";
import { applySkinVars } from "../shared/skin.js";
import { isOutgoing } from "../shared/conversation.js";
import { uploadChatImage, uploadHomeScreenBackground } from "../shared/uploadImage.js";

const devicesEl = document.getElementById("devices");
const activeRoomLabel = document.getElementById("active-room-label");
const speakerControlEl = document.getElementById("speaker-control");
const conversationSelect = document.getElementById("conversation-select");
const linkedHintEl = document.getElementById("linked-hint");
const roomMessagesEl = document.getElementById("room-messages");
const composerEl = document.getElementById("composer");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const imageInput = document.getElementById("image-input");
const attachBtn = document.getElementById("attach-btn");
const composerModeTextBtn = document.getElementById("composer-mode-text");
const composerModeVoiceBtn = document.getElementById("composer-mode-voice");
const quickNotifyModeTextBtn = document.getElementById("quick-notify-mode-text");
const quickNotifyModeVoiceBtn = document.getElementById("quick-notify-mode-voice");
const directionBtn = document.getElementById("direction-btn");
const linkedHintOtherNameEl = document.getElementById("linked-hint-other-name");
const notifyHintEl = document.getElementById("notify-hint");
const typingBtn = document.getElementById("typing-btn");
const seenBtn = document.getElementById("seen-btn");
const callBtn = document.getElementById("call-btn");
const videoCallBtn = document.getElementById("video-call-btn");
const clearChatBtn = document.getElementById("clear-chat-btn");
const quickNotifyEl = document.getElementById("quick-notify");
const quickNotifyToggleBtn = document.getElementById("quick-notify-toggle-btn");
const quickNotifySelect = document.getElementById("quick-notify-select");
const quickNotifyInput = document.getElementById("quick-notify-input");
const quickNotifySendBtn = document.getElementById("quick-notify-send-btn");

const newDeviceBtn = document.getElementById("new-device-btn");
const newDeviceForm = document.getElementById("new-device-form");
const newRoomIdInput = document.getElementById("new-room-id");
const cancelNewDeviceBtn = document.getElementById("cancel-new-device-btn");

const toggleRoomSettingsBtn = document.getElementById("toggle-room-settings-btn");
const roomSettingsEl = document.getElementById("room-settings");
const editRoomAvatarEl = document.getElementById("edit-room-avatar");
const editRoomAvatarFile = document.getElementById("edit-room-avatar-file");
const editLabelInput = document.getElementById("edit-room-label");
const saveRoomSettingsBtn = document.getElementById("save-room-settings-btn");
const deleteRoomBtn = document.getElementById("delete-room-btn");
const showEmergencyBtn = document.getElementById("show-emergency-btn");
const hideEmergencyBtn = document.getElementById("hide-emergency-btn");
const alarmBtn = document.getElementById("alarm-btn");
const alarmPanelEl = document.getElementById("alarm-panel");
const alarmTimeInput = document.getElementById("alarm-time-input");
const alarmActivateBtn = document.getElementById("alarm-activate-btn");
const alarmDeactivateBtn = document.getElementById("alarm-deactivate-btn");
const homeScreenBtn = document.getElementById("home-screen-btn");
const homeScreenPanelEl = document.getElementById("home-screen-panel");
const homeScreenBgPreviewEl = document.getElementById("home-screen-bg-preview");
const homeScreenBgFile = document.getElementById("home-screen-bg-file");
const homeScreenTimeInput = document.getElementById("home-screen-time-input");
const homeScreenDateInput = document.getElementById("home-screen-date-input");
const homeScreenActivateBtn = document.getElementById("home-screen-activate-btn");
const homeScreenDeactivateBtn = document.getElementById("home-screen-deactivate-btn");
const homeScreenHelpBtn = document.getElementById("home-screen-help-btn");
const homeScreenHelpModalEl = document.getElementById("home-screen-help-modal");
const closeHomeScreenHelpBtn = document.getElementById("close-home-screen-help-btn");

const emptyStateEl = document.getElementById("empty-state");
const actionsColEl = document.getElementById("actions-col");
const viewChatActionEl = document.getElementById("view-chat-action");
const editContactsActionEl = document.getElementById("edit-contacts-action");

const openSkinModalBtn = document.getElementById("open-skin-modal-btn");
const openSkinModalBtnMobile = document.getElementById("open-skin-modal-btn-mobile");
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
let activeNotificationChannel = null;
let typingActive = false;
let emergencyScreenVisible = false;
let alarmPanelExpanded = false;
let alarmScreenVisible = false;
let homeScreenPanelExpanded = false;
let homeScreenVisible = false;

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

function formatVoiceDuration(seconds) {
  const s = Math.max(0, seconds || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function renderMessage(conversation, { id, content, image_url, direction, sender_room_id, injected_by_director, is_voice, voice_duration, created_at }) {
  const outgoing = isOutgoing(conversation, { direction, sender_room_id }, conversation.room_id);
  const msg = document.createElement("div");
  msg.className = `msg ${outgoing ? "outgoing" : "incoming"} ${injected_by_director ? "injected" : ""}`.trim();
  msg.dataset.id = id;
  msg.innerHTML = `
    ${image_url ? '<img class="msg-image" alt="Foto" />' : ""}
    ${is_voice || content ? '<span class="msg-text"></span>' : ""}
    <span class="msg-meta"></span>
    <button type="button" class="msg-delete-btn" title="Eliminar mensaje">✕</button>
  `;
  if (image_url) msg.querySelector(".msg-image").src = image_url;
  if (is_voice) {
    msg.querySelector(".msg-text").textContent = `🎙️ Nota de voz · ${formatVoiceDuration(voice_duration)}`;
    msg.classList.add("msg-voice");
  } else if (content) {
    msg.querySelector(".msg-text").textContent = content;
  }
  const time = new Date(created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  msg.querySelector(".msg-meta").textContent = injected_by_director ? `🎬 ${time}` : time;
  if (injected_by_director) msg.title = "Escrito por el director en nombre del actor";
  msg.querySelector(".msg-delete-btn").addEventListener("click", () => deleteMessage(id));
  roomMessagesEl.appendChild(msg);
  roomMessagesEl.scrollTop = roomMessagesEl.scrollHeight;
}

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

// Empty state (sin dispositivo elegido) vs. columna de acciones + composer.
// El nivel de detalle más fino (conversación elegida o no, linked o no)
// lo sigue resolviendo applyConversationModeUI, que corre después de esto
// en el mismo flujo de setActiveRoom.
function updateEmptyState(hasRoom) {
  emptyStateEl.classList.toggle("hidden", hasRoom);
  actionsColEl.classList.toggle("hidden", !hasRoom);
  roomMessagesEl.classList.toggle("hidden", !hasRoom);
  if (!hasRoom) composerEl.classList.add("hidden");
}

// Colapsado por default al cambiar de dispositivo — es edición de setup
// (nombre/foto/borrar), no algo que se toque a cada rato en vivo
function collapseRoomSettings() {
  roomSettingsEl.classList.add("hidden");
  toggleRoomSettingsBtn.classList.remove("active");
}

toggleRoomSettingsBtn.addEventListener("click", () => {
  const expanded = roomSettingsEl.classList.toggle("hidden") === false;
  toggleRoomSettingsBtn.classList.toggle("active", expanded);
});

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

// El fondo de la pantalla de inicio se persiste en rooms.home_screen_bg_url
// (como el avatar) para no tener que resubirlo cada vez que se activa
function fillHomeScreenPanel(roomId) {
  const room = rooms.get(roomId);
  homeScreenBgPreviewEl.style.backgroundImage = room?.home_screen_bg_url
    ? `url("${room.home_screen_bg_url}")`
    : "none";
}

homeScreenBgFile.addEventListener("change", async () => {
  const file = homeScreenBgFile.files[0];
  if (!file || !activeRoomId) return;
  let publicUrl;
  try {
    publicUrl = await uploadHomeScreenBackground(supabase, activeRoomId, file);
  } catch (error) {
    console.error("Error subiendo fondo de pantalla de inicio:", error);
    return;
  }
  // label va sí o sí en el upsert aunque no cambie: Postgres valida las
  // columnas NOT NULL del INSERT antes de resolver el ON CONFLICT, así
  // que omitirla revienta incluso en una fila que ya existe (mismo caso
  // que editRoomAvatarFile más arriba)
  const room = rooms.get(activeRoomId);
  const { error } = await supabase
    .from("rooms")
    .upsert({ room_id: activeRoomId, label: room?.label || activeRoomId, home_screen_bg_url: publicUrl });
  if (error) {
    console.error("Error guardando fondo de pantalla de inicio:", error);
    return;
  }
  if (room) room.home_screen_bg_url = publicUrl;
  homeScreenBgPreviewEl.style.backgroundImage = `url("${publicUrl}")`;
  homeScreenBgFile.value = "";
});

function updateDirectionBtn() {
  directionBtn.textContent =
    direction === "incoming" ? "📥 Mensaje del contacto" : "📤 Mensaje del actor";
  updateNotifyHint(activeConversation());
}

// El aviso de notificación (para simuladas) es independiente del de
// linked-hint (que ya avisa siempre, sea cual sea el mensaje) — solo se
// muestra cuando ESTE envío en particular va a notificar de verdad, para
// que el director sepa en el momento si lo que está por mandar dispara
// el banner en la pantalla del actor o no.
function updateNotifyHint(conversation) {
  const isLinked = conversation?.kind === "linked";
  const show = Boolean(conversation) && !isLinked && isIncomingToActor(conversation);
  notifyHintEl.classList.toggle("hidden", !show);
}

function applyConversationModeUI(conversation) {
  const isLinked = conversation?.kind === "linked";
  composerEl.classList.toggle("hidden", !conversation);
  directionBtn.classList.toggle("hidden", !conversation || isLinked);
  linkedHintEl.classList.toggle("hidden", !isLinked);
  typingBtn.disabled = !conversation || isLinked;
  seenBtn.disabled = !conversation || isLinked;
  callBtn.disabled = !conversation;
  clearChatBtn.disabled = !conversation;
  if (isLinked) {
    linkedHintOtherNameEl.textContent = `como ${rooms.get(conversation.linked_room_id)?.label || conversation.linked_room_id}`;
  }
  updateNotifyHint(conversation);
}

function renderConversationSelect() {
  const items = [...conversations.values()];
  if (items.length === 0) {
    speakerControlEl.classList.add("hidden");
    renderQuickNotifySelect();
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
  renderQuickNotifySelect();
}

// Para notificar "de otro contacto" sin abandonar la conversación activa:
// cualquier otro chat de este mismo dispositivo, simulado o linkeado
// (excluye el que ya está seleccionado arriba, no tiene sentido notificar
// de la misma conversación que ya estás mirando)
// Colapsado por default — el botón de #quick-actions lo abre/cierra, para
// no ocupar una fila fija todo el tiempo cuando no se está usando
let quickNotifyExpanded = false;

function updateQuickNotifyVisibility(hasOthers) {
  quickNotifyToggleBtn.classList.toggle("hidden", !hasOthers);
  quickNotifyToggleBtn.classList.toggle("active", hasOthers && quickNotifyExpanded);
  quickNotifyEl.classList.toggle("hidden", !(hasOthers && quickNotifyExpanded));
}

function renderQuickNotifySelect() {
  const others = [...conversations.values()].filter((c) => c.id !== activeConversationId);
  const previousValue = quickNotifySelect.value;
  quickNotifySelect.innerHTML = "";
  others.forEach((conversation) => {
    const opt = document.createElement("option");
    opt.value = conversation.id;
    opt.textContent = `${conversation.kind === "linked" ? "🔗" : "💬"} ${conversation.contact_name}`;
    quickNotifySelect.appendChild(opt);
  });
  if (others.some((c) => c.id === previousValue)) quickNotifySelect.value = previousValue;
  updateQuickNotifyVisibility(others.length > 0);
}

quickNotifyToggleBtn.addEventListener("click", () => {
  quickNotifyExpanded = !quickNotifyExpanded;
  const hasOthers = [...conversations.values()].some((c) => c.id !== activeConversationId);
  updateQuickNotifyVisibility(hasOthers);
});

conversationSelect.addEventListener("change", () => setActiveConversation(conversationSelect.value));

async function setActiveConversation(conversationId) {
  activeConversationId = conversationId;
  quickNotifyExpanded = false;
  setComposerMode("text");
  setQuickNotifyMode("text");
  clearTimeout(composerTypingTimeout);
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
  toggleRoomSettingsBtn.classList.remove("hidden");
  collapseRoomSettings();
  fillRoomSettings(roomId);
  updateEmptyState(true);
  viewChatActionEl.href = `/device/${roomId}`;
  editContactsActionEl.href = `/control/contacts?room=${encodeURIComponent(roomId)}`;
  emergencyScreenVisible = false;
  updateEmergencyButtons();
  alarmPanelExpanded = false;
  alarmScreenVisible = false;
  updateAlarmPanel();
  homeScreenPanelExpanded = false;
  homeScreenVisible = false;
  fillHomeScreenPanel(roomId);
  updateHomeScreenPanel();
  renderDeviceList();

  await loadConversationsForRoom(roomId);

  activeNotificationChannel?.unsubscribe();
  activeNotificationChannel = supabase
    .channel(notificationsChannelName(roomId))
    // El actor puede cerrar la alarma él mismo (a diferencia de la de
    // apagado/SOS) — si lo hace antes de que el director la cierre acá,
    // este evento nos avisa para que el tile vuelva a su estado inicial
    .on("broadcast", { event: "alarm_screen_hide" }, () => {
      alarmScreenVisible = false;
      updateAlarmPanel();
    })
    // Misma razón: el actor cierra la pantalla de inicio con un swipe
    .on("broadcast", { event: "home_screen_hide" }, () => {
      homeScreenVisible = false;
      updateHomeScreenPanel();
    })
    // El actor también puede REVELAR la pantalla de inicio por su cuenta
    // (al apagar/posponer la alarma, ver device/app.js dismissAlarm) sin
    // que el director la haya activado — este evento sincroniza el tile
    // para que muestre "Cerrar pantalla" y no quede desfasado
    .on("broadcast", { event: "home_screen_show" }, ({ payload }) => {
      homeScreenVisible = true;
      if (payload?.time) homeScreenTimeInput.value = payload.time;
      if (payload?.date) homeScreenDateInput.value = payload.date;
      updateHomeScreenPanel();
    })
    .subscribe();

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
      const room = rooms.get(roomId);
      const li = document.createElement("li");
      li.dataset.roomId = roomId;
      li.className = [
        roomId === activeRoomId ? "active" : "",
        onlineRoomIds.has(roomId) ? "online" : "",
      ].join(" ").trim();
      li.innerHTML = `
        <span class="device-avatar-wrap">
          <span class="device-avatar"></span>
          <span class="device-presence"></span>
        </span>
        <span class="device-label"></span>
      `;
      const avatarEl = li.querySelector(".device-avatar");
      if (room?.avatar_url) {
        avatarEl.style.backgroundImage = `url("${room.avatar_url}")`;
        avatarEl.textContent = "";
      } else {
        avatarEl.style.backgroundImage = "none";
        avatarEl.textContent = initials(room?.label || roomId);
      }
      li.querySelector(".device-label").textContent = room?.label || roomId;
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

deleteRoomBtn.addEventListener("click", async () => {
  if (!activeRoomId) return;
  const label = rooms.get(activeRoomId)?.label || activeRoomId;
  if (
    !confirm(
      `¿Eliminar el dispositivo "${label}"? Se borran también sus chats y mensajes (incluidos los del actor con el que esté linkeado). No se puede deshacer.`
    )
  )
    return;

  const roomId = activeRoomId;

  // Los chats se cascadean solos al borrar el room (FK en room_id y
  // linked_room_id), pero los mensajes no tienen FK a conversations — hay
  // que borrarlos a mano para no dejarlos huérfanos.
  const { data: relatedConversations, error: fetchError } = await supabase
    .from("conversations")
    .select("thread_id")
    .or(`room_id.eq.${roomId},linked_room_id.eq.${roomId}`);
  if (fetchError) {
    console.error("Error buscando conversaciones del dispositivo:", fetchError);
    return;
  }
  const threadIds = [...new Set(relatedConversations.map((c) => c.thread_id))];
  if (threadIds.length > 0) {
    const { error: msgError } = await supabase.from("messages").delete().in("thread_id", threadIds);
    if (msgError) console.error("Error borrando mensajes del dispositivo:", msgError);
  }

  const { error } = await supabase.from("rooms").delete().eq("room_id", roomId);
  if (error) {
    console.error("Error eliminando dispositivo:", error);
    return;
  }

  rooms.delete(roomId);
  activeThreadChannel?.unsubscribe();
  activeNotificationChannel?.unsubscribe();
  conversationsChannel?.unsubscribe();
  activeRoomId = null;
  activeConversationId = null;
  conversations.clear();
  activeRoomLabel.textContent = "Selecciona un dispositivo";
  toggleRoomSettingsBtn.classList.add("hidden");
  collapseRoomSettings();
  updateEmptyState(false);
  emergencyScreenVisible = false;
  updateEmergencyButtons();
  alarmPanelExpanded = false;
  alarmScreenVisible = false;
  updateAlarmPanel();
  homeScreenPanelExpanded = false;
  homeScreenVisible = false;
  updateHomeScreenPanel();
  speakerControlEl.classList.add("hidden");
  quickNotifyToggleBtn.classList.add("hidden");
  quickNotifyEl.classList.add("hidden");
  roomMessagesEl.innerHTML = "";
  renderDeviceList();
});

directionBtn.addEventListener("click", () => {
  direction = direction === "incoming" ? "outgoing" : "incoming";
  updateDirectionBtn();
});
updateDirectionBtn();

// En simuladas el director define incoming/outgoing con el toggle; en
// linkeadas no hay "dirección" — el mensaje se guarda como si lo hubiera
// escrito el OTRO actor (linked_room_id), nunca el dueño de esta lista
// (si ese estuviera disponible no haría falta inyectar nada). Se marca
// con injected_by_director para poder distinguirlo solo en /control.
function messagePayloadFor(conversation, extra) {
  const payload = { thread_id: conversation.thread_id, ...extra };
  if (conversation.kind === "linked") {
    payload.sender_room_id = conversation.linked_room_id;
    payload.injected_by_director = true;
  } else {
    payload.direction = direction;
  }
  return payload;
}

// Un mensaje "llega" al actor (y amerita el banner de notificación) si es
// simulado con direction "incoming", o si es una linkeada inyectada (que
// siempre es "del otro actor", nunca del dueño de esta lista)
function isIncomingToActor(conversation) {
  return conversation.kind === "linked" || direction === "incoming";
}

function broadcastNewMessageNotification(conversation, { content, image_url, is_voice }) {
  activeNotificationChannel?.send({
    type: "broadcast",
    event: "new_message",
    payload: {
      conversationId: conversation.id,
      contactName: conversation.contact_name,
      avatarUrl: conversation.avatar_url,
      content: is_voice ? "🎙️ Audio" : content || (image_url ? "📷 Foto" : ""),
    },
  });
}

// Nota de voz simulada: sin audio real (ver criterio del proyecto para
// todos los overlays — puramente visual), content queda vacío y se
// distingue con is_voice + una duración inventada, así la burbuja se ve
// como un mensaje de voz real en /device/chat
function randomVoiceDuration() {
  return Math.floor(Math.random() * 39) + 4; // 4–42s, un rango creíble
}

async function sendVoiceNote() {
  const conversation = activeConversation();
  if (!conversation) return;
  const { error } = await supabase
    .from("messages")
    .insert(messagePayloadFor(conversation, { content: "", is_voice: true, voice_duration: randomVoiceDuration() }));
  if (error) {
    console.error("Error enviando nota de voz:", error);
    return;
  }
  setTypingBroadcast(false);
  if (isIncomingToActor(conversation)) broadcastNewMessageNotification(conversation, { is_voice: true });
}

// Toggle texto/voz del composer principal — ver .composer-mode-toggle en
// style.css para el motivo. sendBtn.click() se resuelve según el modo.
let composerMode = "text";
function setComposerMode(mode) {
  composerMode = mode;
  composerEl.classList.toggle("mode-voice", mode === "voice");
  composerModeTextBtn.classList.toggle("active", mode === "text");
  composerModeVoiceBtn.classList.toggle("active", mode === "voice");
  sendBtn.textContent = mode === "voice" ? "Enviar nota de voz" : "Enviar";
}
composerModeTextBtn.addEventListener("click", () => setComposerMode("text"));
composerModeVoiceBtn.addEventListener("click", () => setComposerMode("voice"));

// Notificación "de otro contacto" del mismo dispositivo: independiente de
// la conversación activa (no la toca, no la muestra) — siempre entrante,
// da igual el toggle del composer principal, porque acá el único caso de
// uso es "le llega algo de otro lado". Queda guardada en esa otra
// conversación, así que si el director la abre después el mensaje ya está.
async function sendQuickNotification() {
  const content = quickNotifyInput.value.trim();
  const target = conversations.get(quickNotifySelect.value);
  if (!content || !target) return;

  const payload = { thread_id: target.thread_id, content };
  if (target.kind === "linked") {
    payload.sender_room_id = target.linked_room_id;
    payload.injected_by_director = true;
  } else {
    payload.direction = "incoming";
  }

  const { error } = await supabase.from("messages").insert(payload);
  if (error) {
    console.error("Error enviando notificación de otro contacto:", error);
    return;
  }
  quickNotifyInput.value = "";
  broadcastNewMessageNotification(target, { content });
}

// Mismo toggle texto/voz que el composer principal — ver setComposerMode
let quickNotifyMode = "text";
function setQuickNotifyMode(mode) {
  quickNotifyMode = mode;
  quickNotifyEl.classList.toggle("mode-voice", mode === "voice");
  quickNotifyModeTextBtn.classList.toggle("active", mode === "text");
  quickNotifyModeVoiceBtn.classList.toggle("active", mode === "voice");
  quickNotifySendBtn.textContent = mode === "voice" ? "Enviar nota de voz" : "Enviar";
}
quickNotifyModeTextBtn.addEventListener("click", () => setQuickNotifyMode("text"));
quickNotifyModeVoiceBtn.addEventListener("click", () => setQuickNotifyMode("voice"));

quickNotifySendBtn.addEventListener("click", () => {
  if (quickNotifyMode === "voice") sendQuickVoiceNotification();
  else sendQuickNotification();
});
quickNotifyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendQuickNotification();
});

async function sendQuickVoiceNotification() {
  const target = conversations.get(quickNotifySelect.value);
  if (!target) return;

  const payload = { thread_id: target.thread_id, content: "", is_voice: true, voice_duration: randomVoiceDuration() };
  if (target.kind === "linked") {
    payload.sender_room_id = target.linked_room_id;
    payload.injected_by_director = true;
  } else {
    payload.direction = "incoming";
  }

  const { error } = await supabase.from("messages").insert(payload);
  if (error) {
    console.error("Error enviando nota de voz de otro contacto:", error);
    return;
  }
  broadcastNewMessageNotification(target, { is_voice: true });
}

// Pantalla de apagado/SOS: a nivel dispositivo (no de conversación), se ve
// sin importar qué esté mirando el actor — mismo canal que las
// notificaciones, solo visual, el director la cierra remotamente
function updateEmergencyButtons() {
  showEmergencyBtn.classList.toggle("hidden", emergencyScreenVisible);
  hideEmergencyBtn.classList.toggle("hidden", !emergencyScreenVisible);
}

showEmergencyBtn.addEventListener("click", () => {
  activeNotificationChannel?.send({ type: "broadcast", event: "emergency_screen_show", payload: {} });
  emergencyScreenVisible = true;
  updateEmergencyButtons();
});

hideEmergencyBtn.addEventListener("click", () => {
  activeNotificationChannel?.send({ type: "broadcast", event: "emergency_screen_hide", payload: {} });
  emergencyScreenVisible = false;
  updateEmergencyButtons();
});

// Pantalla de alarma: a diferencia de la de apagado/SOS, el actor SÍ
// puede cerrarla él mismo tocando "Detener"/"Posponer" (ver device/app.js
// y device/chat/app.js) — por eso el panel también escucha el evento de
// cierre en vez de asumir que solo el director lo dispara (ver el
// listener agregado en setActiveRoom). El tile "⏰ Simular despertador"
// abre/cierra este panel; adentro, el director elige la hora y confirma.
function updateAlarmPanel() {
  alarmPanelEl.classList.toggle("hidden", !alarmPanelExpanded);
  alarmBtn.classList.toggle("active", alarmPanelExpanded || alarmScreenVisible);
  alarmActivateBtn.classList.toggle("hidden", alarmScreenVisible);
  alarmDeactivateBtn.classList.toggle("hidden", !alarmScreenVisible);
}

alarmBtn.addEventListener("click", () => {
  alarmPanelExpanded = !alarmPanelExpanded;
  if (alarmPanelExpanded && !alarmTimeInput.value) {
    // Precarga la hora actual como punto de partida cómodo — el
    // director la puede cambiar antes de activar
    const now = new Date();
    alarmTimeInput.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
  updateAlarmPanel();
});

alarmActivateBtn.addEventListener("click", () => {
  const time = alarmTimeInput.value || "07:30";
  activeNotificationChannel?.send({ type: "broadcast", event: "alarm_screen_show", payload: { time } });
  alarmScreenVisible = true;
  updateAlarmPanel();
});

alarmDeactivateBtn.addEventListener("click", () => {
  activeNotificationChannel?.send({ type: "broadcast", event: "alarm_screen_hide", payload: {} });
  alarmScreenVisible = false;
  updateAlarmPanel();
});

// Pantalla de inicio simulada: mismo patrón que la alarma (panel
// colapsable, hora en texto libre) pero suma el fondo (persistido en
// rooms, ver fillHomeScreenPanel/homeScreenBgFile más arriba) y una fecha
// también en texto libre — no hay formateador automático a propósito,
// así el director controla exactamente qué se ve, sin depender de que el
// formato de fecha calculado coincida con lo que pide la escena
function updateHomeScreenPanel() {
  homeScreenPanelEl.classList.toggle("hidden", !homeScreenPanelExpanded);
  homeScreenBtn.classList.toggle("active", homeScreenPanelExpanded || homeScreenVisible);
  homeScreenActivateBtn.classList.toggle("hidden", homeScreenVisible);
  homeScreenDeactivateBtn.classList.toggle("hidden", !homeScreenVisible);
}

function defaultHomeScreenDate() {
  const formatted = new Date().toLocaleDateString("es-ES", { weekday: "short", month: "short", day: "numeric" });
  return formatted.replace(",", "").replace(/^\p{L}/u, (c) => c.toUpperCase());
}

homeScreenBtn.addEventListener("click", () => {
  homeScreenPanelExpanded = !homeScreenPanelExpanded;
  if (homeScreenPanelExpanded) {
    if (!homeScreenTimeInput.value) {
      const now = new Date();
      homeScreenTimeInput.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    }
    if (!homeScreenDateInput.value) homeScreenDateInput.value = defaultHomeScreenDate();
  }
  updateHomeScreenPanel();
});

homeScreenActivateBtn.addEventListener("click", () => {
  const room = activeRoomId ? rooms.get(activeRoomId) : null;
  activeNotificationChannel?.send({
    type: "broadcast",
    event: "home_screen_show",
    payload: {
      backgroundUrl: room?.home_screen_bg_url || null,
      time: homeScreenTimeInput.value || "",
      date: homeScreenDateInput.value || "",
    },
  });
  homeScreenVisible = true;
  updateHomeScreenPanel();
});

homeScreenDeactivateBtn.addEventListener("click", () => {
  activeNotificationChannel?.send({ type: "broadcast", event: "home_screen_hide", payload: {} });
  homeScreenVisible = false;
  updateHomeScreenPanel();
});

sendBtn.addEventListener("click", async () => {
  if (composerMode === "voice") {
    sendVoiceNote();
    return;
  }
  const content = messageInput.value.trim();
  const conversation = activeConversation();
  if (!conversation || !content) return;

  const { error } = await supabase.from("messages").insert(messagePayloadFor(conversation, { content }));
  if (error) {
    console.error("Error enviando mensaje:", error);
    return;
  }
  messageInput.value = "";
  setTypingBroadcast(false);
  if (isIncomingToActor(conversation)) broadcastNewMessageNotification(conversation, { content });
});

// Mismo comportamiento que el composer del actor: mientras el director
// tipea en nombre del contacto, dispara "escribiendo..." solo, sin
// necesidad de tocar el botón manual — que sigue disponible para simular
// tipeo sin llegar a escribir nada (pausa dramática, etc.)
let composerTypingTimeout = null;
messageInput.addEventListener("input", () => {
  const conversation = activeConversation();
  if (!conversation || conversation.kind === "linked") return;
  setTypingBroadcast(true);
  clearTimeout(composerTypingTimeout);
  composerTypingTimeout = setTimeout(() => setTypingBroadcast(false), 2000);
});

imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];
  imageInput.value = "";
  const conversation = activeConversation();
  if (!file || !conversation) return;

  let imageUrl;
  try {
    imageUrl = await uploadChatImage(supabase, conversation.thread_id, file);
  } catch (error) {
    console.error("Error subiendo foto:", error);
    return;
  }
  const { error } = await supabase
    .from("messages")
    .insert(messagePayloadFor(conversation, { content: "", image_url: imageUrl }));
  if (error) {
    console.error("Error enviando foto:", error);
    return;
  }
  if (isIncomingToActor(conversation)) broadcastNewMessageNotification(conversation, { image_url: imageUrl });
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

// Va por el canal del dispositivo (no del thread) para que interrumpa
// sin importar qué esté mirando el actor — la lista, este chat, o
// cualquier otro — igual que una llamada real. El nombre y la foto van
// en el payload (no se infieren del lado del actor) porque puede estar
// mirando una conversación distinta a la que está "llamando".
callBtn.addEventListener("click", () => {
  const conversation = activeConversation();
  if (!conversation) return;
  activeNotificationChannel?.send({
    type: "broadcast",
    event: "incoming_call",
    payload: { callerName: conversation.contact_name, avatarUrl: conversation.avatar_url },
  });
});

// Videollamada: mismo timbre que la de audio, pero al aceptar el actor
// pasa a una pantalla verde con marcadores de tracking en vez de cerrar
// el overlay — pensada para compositar video real encima en post. Fire-
// and-forget como la de audio: no hay botón de "cortar" acá en /control,
// el actor cuelga desde su propia pantalla (ver src/shared/callOverlay.js)
videoCallBtn.addEventListener("click", () => {
  const conversation = activeConversation();
  if (!conversation) return;
  activeNotificationChannel?.send({
    type: "broadcast",
    event: "incoming_call",
    payload: { callerName: conversation.contact_name, avatarUrl: conversation.avatar_url, isVideo: true },
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

async function openSkinModal() {
  skinModalEl.classList.remove("hidden");
  await loadSkins();
  await loadActiveSkinId();
  selectSkinForEditing(activeSkinId || [...skins.keys()][0]);
}

openSkinModalBtn.addEventListener("click", openSkinModal);
openSkinModalBtnMobile.addEventListener("click", openSkinModal);

closeSkinModalBtn.addEventListener("click", () => skinModalEl.classList.add("hidden"));

// Manual de "hora falsa en el iPhone" — antes un link a un Artifact
// externo, ahora el mismo texto en un modal acá adentro
homeScreenHelpBtn.addEventListener("click", () => homeScreenHelpModalEl.classList.remove("hidden"));
closeHomeScreenHelpBtn.addEventListener("click", () => homeScreenHelpModalEl.classList.add("hidden"));
homeScreenHelpModalEl.addEventListener("click", (e) => {
  if (e.target === homeScreenHelpModalEl) homeScreenHelpModalEl.classList.add("hidden");
});

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
