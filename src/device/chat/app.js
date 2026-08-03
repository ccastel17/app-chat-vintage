// Vista de un chat individual del dispositivo (actor)
import { supabase, DEVICES_PRESENCE_CHANNEL, notificationsChannelName } from "../../shared/supabaseClient.js";
import { applySkinVars, cacheSkin, loadCachedSkin } from "../../shared/skin.js";
import { isOutgoing } from "../../shared/conversation.js";
import { uploadChatImage } from "../../shared/uploadImage.js";
import { wireEmergencySliders, showEmergencyOverlay, hideEmergencyOverlay } from "../../shared/emergencyOverlay.js";
import { showAlarmOverlay, hideAlarmOverlay } from "../../shared/alarmOverlay.js";
import { showIncomingCall, hideIncomingCall, connectVideoCall } from "../../shared/callOverlay.js";
import { showHomeScreenOverlay, hideHomeScreenOverlay, wireHomeScreenSwipe } from "../../shared/homeScreenOverlay.js";

// Pintar con el último skin conocido antes de esperar el fetch real —
// para que el skeleton no arranque con los colores default del CSS
const cachedSkin = loadCachedSkin();
if (cachedSkin) applySkinVars(document.documentElement, cachedSkin);

// #chat-root usa --app-height (con 100dvh de fallback) en vez de depender
// solo de dvh — en iOS standalone, dvh combinado con
// apple-mobile-web-app-status-bar-style=black-translucent puede quedar
// mal calculado y no reaccionar bien a que se abra el teclado. Con
// visualViewport el alto siempre refleja el área realmente visible.
if (window.visualViewport) {
  const setAppHeight = () => {
    document.documentElement.style.setProperty("--app-height", `${window.visualViewport.height}px`);
  };
  setAppHeight();
  window.visualViewport.addEventListener("resize", setAppHeight);
}

// #chat-header es position:fixed (para que no se mueva si iOS scrollea la
// página al abrir el teclado) — #messages compensa el espacio con
// --header-height, medido en vivo por si cambia (skin, safe-area, etc.)
const chatHeaderEl = document.getElementById("chat-header");
if (window.ResizeObserver) {
  new ResizeObserver(() => {
    // offsetHeight (no contentRect): necesitamos el alto con padding
    // incluido, que es lo que #messages tiene que dejar libre arriba
    document.documentElement.style.setProperty("--header-height", `${chatHeaderEl.offsetHeight}px`);
  }).observe(chatHeaderEl);
}

const backLink = document.getElementById("back-link");
const messagesEl = document.getElementById("messages");
const contactNameEl = document.getElementById("contact-name");
const contactStatusEl = document.getElementById("contact-status");
const contactAvatarEl = document.getElementById("contact-avatar");
const imageViewerEl = document.getElementById("image-viewer");
const imageViewerImg = document.getElementById("image-viewer-img");
const notificationBannerEl = document.getElementById("notification-banner");
const notificationAvatarEl = document.getElementById("notification-avatar");
const notificationNameEl = document.getElementById("notification-name");
const notificationTextEl = document.getElementById("notification-text");
const emergencyOverlayEl = document.getElementById("emergency-overlay");
wireEmergencySliders(emergencyOverlayEl);
const alarmOverlayEl = document.getElementById("alarm-overlay");
const callOverlayEl = document.getElementById("incoming-call-overlay");
const callAvatarEl = document.getElementById("call-avatar");
const callerNameEl = document.getElementById("caller-name");
const callAcceptBtn = document.getElementById("call-accept-btn");
const callDeclineBtn = document.getElementById("call-decline-btn");
const messageInput = document.getElementById("device-message-input");
const sendBtn = document.getElementById("device-send-btn");
const imageInput = document.getElementById("device-image-input");

let typingTimeout = null;
let typingBubbleEl = null;
let idleStatus = contactStatusEl.textContent;
let activeSkinId = null;
let currentAvatarUrl = null;
let myTypingTimeout = null;

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function setAvatar(el, name, avatarUrl) {
  if (avatarUrl) {
    el.style.backgroundImage = `url("${avatarUrl}")`;
    el.textContent = "";
  } else {
    el.style.backgroundImage = "none";
    el.textContent = initials(name);
  }
}

async function loadActiveSkin() {
  const { data } = await supabase
    .from("app_settings")
    .select("active_skin_id, skins(*)")
    .eq("id", 1)
    .maybeSingle();
  if (data?.skins) {
    activeSkinId = data.active_skin_id;
    applySkinVars(document.documentElement, data.skins);
    cacheSkin(data.skins);
  }
}

function getIdsFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  // /device/:roomId/chat/:conversationId
  return { roomId: parts[1] || null, conversationId: parts[3] || null };
}

function ticksFor(status) {
  if (status === "visto") return '<span class="bubble-ticks seen">✓✓</span>';
  if (status === "entregado") return '<span class="bubble-ticks">✓✓</span>';
  return '<span class="bubble-ticks">✓</span>';
}

// Nota de voz simulada: sin audio real, solo la burbuja (onda estática +
// duración inventada por /control) — ver criterio del proyecto de no usar
// audio real en ningún overlay/feature
function formatVoiceDuration(seconds) {
  const s = Math.max(0, seconds || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function voiceWaveBars() {
  return Array.from({ length: 24 }, () => `<span class="voice-bar" style="height:${6 + Math.floor(Math.random() * 16)}px"></span>`).join("");
}

function renderMessage(conversation, myRoomId, message) {
  const outgoing = isOutgoing(conversation, message, myRoomId);
  const hasImage = Boolean(message.image_url);
  const hasVoice = Boolean(message.is_voice);
  const hasText = !hasVoice && Boolean(message.content);
  const bubble = document.createElement("div");
  bubble.className = `bubble ${outgoing ? "outgoing" : "incoming"} ${hasImage && !hasText ? "image-only" : ""}`.trim();
  bubble.dataset.id = message.id;
  bubble.innerHTML = `
    ${hasImage ? '<img class="bubble-image" alt="Foto" />' : ""}
    ${hasVoice ? `<div class="bubble-voice"><span class="voice-play">▶</span><span class="voice-wave">${voiceWaveBars()}</span><span class="voice-duration"></span></div>` : ""}
    ${hasText ? '<p class="bubble-text"></p>' : ""}
    <span class="bubble-meta">
      <span class="bubble-time"></span>
      ${outgoing ? ticksFor(message.status) : ""}
    </span>
  `;
  if (hasImage) bubble.querySelector(".bubble-image").src = message.image_url;
  if (hasVoice) bubble.querySelector(".voice-duration").textContent = formatVoiceDuration(message.voice_duration);
  if (hasText) bubble.querySelector(".bubble-text").textContent = message.content;
  bubble.querySelector(".bubble-time").textContent = new Date(message.created_at).toLocaleTimeString([], {
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
    // Por si el otro lado no manda el evento de "parar" explícito
    typingTimeout = setTimeout(() => showTyping(false), 6000);
  } else {
    contactStatusEl.textContent = idleStatus;
    contactStatusEl.classList.remove("typing");
    typingBubbleEl?.remove();
    typingBubbleEl = null;
  }
}

// Va por el canal de notificaciones (a nivel dispositivo), no por el
// thread de esta conversación puntual — así interrumpe sin importar si el
// actor está mirando este chat, otro, o la lista (ver notificationChannel
// más abajo). callAcceptBtn/callDeclineBtn no dependen de la conversación
// abierta, por eso se pueden cablear acá arriba sin esperar a initChat.
callDeclineBtn.addEventListener("click", () => hideIncomingCall(callOverlayEl));
callAcceptBtn.addEventListener("click", () => {
  if (callOverlayEl.dataset.isVideo === "true") {
    connectVideoCall(callOverlayEl);
    return;
  }
  callerNameEl.textContent = "Conectando...";
  setTimeout(() => hideIncomingCall(callOverlayEl), 1500);
});
document.getElementById("call-hangup-btn").addEventListener("click", () => hideIncomingCall(callOverlayEl));

const homeScreenOverlayEl = document.getElementById("home-screen-overlay");

messagesEl.addEventListener("click", (e) => {
  const img = e.target.closest(".bubble-image");
  if (!img) return;
  imageViewerImg.src = img.src;
  imageViewerEl.classList.remove("hidden");
});
imageViewerEl.addEventListener("click", () => imageViewerEl.classList.add("hidden"));

const { roomId, conversationId } = getIdsFromUrl();
backLink.href = roomId ? `/device/${roomId}` : "/";

if (!roomId || !conversationId) {
  messagesEl.innerHTML = '<p style="padding:16px;color:#7d8792;">Falta el room_id o el chat en la URL</p>';
  sendBtn.disabled = true;
  messageInput.disabled = true;
} else {
  loadActiveSkin();

  // Fondo persistido de la pantalla de inicio, para poder mostrarla acá
  // sin depender de que el director la haya activado en esta sesión (ver
  // dismissAlarm: al apagar/posponer la alarma, queda debajo el lock screen)
  let roomHomeScreenBgUrl = null;
  supabase
    .from("rooms")
    .select("home_screen_bg_url")
    .eq("room_id", roomId)
    .maybeSingle()
    .then(({ data }) => { roomHomeScreenBgUrl = data?.home_screen_bg_url || null; });

  // Caché en localStorage: pinta instantáneo con el último estado conocido
  // (nombre/foto/estado del contacto + últimos mensajes) mientras se espera
  // la respuesta real de Supabase — evita la pantalla en blanco al entrar
  // a un chat ya visitado antes.
  const CACHE_KEY = `chat:${conversationId}`;
  let cachedMessages = [];

  function loadCachedChat() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveCachedChat(conversation) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          conversation: {
            kind: conversation.kind,
            contact_name: conversation.contact_name,
            avatar_url: conversation.avatar_url,
            contact_status: conversation.contact_status,
          },
          messages: cachedMessages.slice(-30),
        })
      );
    } catch {}
  }

  const cached = loadCachedChat();
  if (cached) {
    contactNameEl.textContent = cached.conversation.contact_name;
    currentAvatarUrl = cached.conversation.avatar_url;
    setAvatar(contactAvatarEl, cached.conversation.contact_name, currentAvatarUrl);
    idleStatus = cached.conversation.contact_status;
    contactStatusEl.textContent = idleStatus;
    messagesEl.innerHTML = "";
    cachedMessages = cached.messages;
    cachedMessages.forEach((m) => renderMessage({ kind: cached.conversation.kind }, roomId, m));
  }

  supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle()
    .then(({ data: conversation, error }) => {
      if (error || !conversation) {
        console.error("Error cargando conversación:", error);
        messagesEl.innerHTML = '<p style="padding:16px;color:#7d8792;">No se encontró este chat</p>';
        sendBtn.disabled = true;
        messageInput.disabled = true;
        return;
      }
      initChat(conversation);
    });

  function applyContactInfo(conversation) {
    contactNameEl.textContent = conversation.contact_name;
    currentAvatarUrl = conversation.avatar_url;
    setAvatar(contactAvatarEl, conversation.contact_name, currentAvatarUrl);
    idleStatus = conversation.contact_status;
    if (!typingBubbleEl) contactStatusEl.textContent = idleStatus;
  }

  function initChat(conversation) {
    applyContactInfo(conversation);
    const threadId = conversation.thread_id;

    supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Error cargando historial:", error);
          return;
        }
        messagesEl.innerHTML = "";
        data.forEach((m) => renderMessage(conversation, roomId, m));
        cachedMessages = data;
        saveCachedChat(conversation);
      });

    const threadChannel = supabase
      .channel(`thread:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          showTyping(false);
          renderMessage(conversation, roomId, payload.new);
          cachedMessages.push(payload.new);
          saveCachedChat(conversation);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => updateMessageStatus(payload.new.id, payload.new.status)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          messagesEl.querySelector(`[data-id="${payload.old.id}"]`)?.remove();
          cachedMessages = cachedMessages.filter((m) => m.id !== payload.old.id);
          saveCachedChat(conversation);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
        (payload) => {
          Object.assign(conversation, payload.new);
          applyContactInfo(conversation);
          saveCachedChat(conversation);
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => showTyping(payload.isTyping))
      .subscribe();

    function broadcastMyTyping(isTyping) {
      if (conversation.kind !== "linked") return; // solo tiene sentido entre dos actores reales
      threadChannel.send({ type: "broadcast", event: "typing", payload: { isTyping } });
    }

    async function sendMessage() {
      const content = messageInput.value.trim();
      if (!content) return;
      messageInput.value = "";
      clearTimeout(myTypingTimeout);
      broadcastMyTyping(false);

      const { error } = await supabase.from("messages").insert({
        thread_id: threadId,
        sender_room_id: roomId,
        content,
        direction: conversation.kind === "simulated" ? "outgoing" : null,
      });
      if (error) console.error("Error enviando mensaje:", error);
    }

    async function sendImage(file) {
      let imageUrl;
      try {
        imageUrl = await uploadChatImage(supabase, threadId, file);
      } catch (error) {
        console.error("Error subiendo foto:", error);
        return;
      }
      const { error } = await supabase.from("messages").insert({
        thread_id: threadId,
        sender_room_id: roomId,
        content: "",
        image_url: imageUrl,
        direction: conversation.kind === "simulated" ? "outgoing" : null,
      });
      if (error) console.error("Error enviando foto:", error);
    }

    sendBtn.addEventListener("click", sendMessage);
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
    messageInput.addEventListener("input", () => {
      broadcastMyTyping(true);
      clearTimeout(myTypingTimeout);
      myTypingTimeout = setTimeout(() => broadcastMyTyping(false), 2000);
    });
    imageInput.addEventListener("change", () => {
      const file = imageInput.files[0];
      imageInput.value = "";
      if (file) sendImage(file);
    });
  }

  // Skin activo (colores/fuente): global, no depende del room
  supabase
    .channel("skin-changes")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings" }, loadActiveSkin)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "skins" }, (payload) => {
      if (payload.new.id === activeSkinId) {
        applySkinVars(document.documentElement, payload.new);
        cacheSkin(payload.new);
      }
    })
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

  // Banner de notificación simulada — solo tiene sentido si es de OTRA
  // conversación (la que ya estás mirando no necesita "avisarte")
  let notificationHideTimeout = null;
  let notificationTargetConversationId = null;

  notificationBannerEl.addEventListener("click", () => {
    if (notificationTargetConversationId) {
      window.location.href = `/device/${roomId}/chat/${notificationTargetConversationId}`;
    }
  });

  let lastAlarmTime = "";

  const notificationChannel = supabase
    .channel(notificationsChannelName(roomId))
    .on("broadcast", { event: "new_message" }, ({ payload }) => {
      if (payload.conversationId === conversationId) return;
      notificationTargetConversationId = payload.conversationId;
      if (payload.avatarUrl) {
        notificationAvatarEl.style.backgroundImage = `url("${payload.avatarUrl}")`;
        notificationAvatarEl.textContent = "";
      } else {
        notificationAvatarEl.style.backgroundImage = "none";
        notificationAvatarEl.textContent = initials(payload.contactName);
      }
      notificationNameEl.textContent = payload.contactName;
      notificationTextEl.textContent = payload.content;
      notificationBannerEl.classList.add("visible");
      clearTimeout(notificationHideTimeout);
      notificationHideTimeout = setTimeout(() => notificationBannerEl.classList.remove("visible"), 4500);
    })
    .on("broadcast", { event: "emergency_screen_show" }, () => showEmergencyOverlay(emergencyOverlayEl))
    .on("broadcast", { event: "emergency_screen_hide" }, () => hideEmergencyOverlay(emergencyOverlayEl))
    .on("broadcast", { event: "alarm_screen_show" }, ({ payload }) => {
      lastAlarmTime = payload.time || "";
      showAlarmOverlay(alarmOverlayEl, payload.time);
    })
    .on("broadcast", { event: "alarm_screen_hide" }, () => hideAlarmOverlay(alarmOverlayEl))
    .on("broadcast", { event: "incoming_call" }, ({ payload }) => showIncomingCall(callOverlayEl, callAvatarEl, callerNameEl, payload))
    .on("broadcast", { event: "end_call" }, () => hideIncomingCall(callOverlayEl))
    .on("broadcast", { event: "home_screen_show" }, ({ payload }) => showHomeScreenOverlay(homeScreenOverlayEl, payload))
    .on("broadcast", { event: "home_screen_hide" }, () => hideHomeScreenOverlay(homeScreenOverlayEl))
    .subscribe();

  // Ver device/app.js — mismo motivo: acá el actor sí puede cerrar la
  // alarma él mismo, y hay que reenviar el cierre para que /control se
  // entere si fue el actor (no el director) quien la cerró.
  function dismissAlarm() {
    hideAlarmOverlay(alarmOverlayEl);
    notificationChannel.send({ type: "broadcast", event: "alarm_screen_hide", payload: {} });
    // Ver device/app.js — al apagar/posponer, queda debajo la pantalla de
    // inicio en vez de volver directo a la app.
    const homeScreenPayload = { backgroundUrl: roomHomeScreenBgUrl, time: lastAlarmTime, date: "" };
    showHomeScreenOverlay(homeScreenOverlayEl, homeScreenPayload);
    notificationChannel.send({ type: "broadcast", event: "home_screen_show", payload: homeScreenPayload });
  }
  document.getElementById("alarm-stop-btn").addEventListener("click", dismissAlarm);
  document.getElementById("alarm-snooze-btn").addEventListener("click", dismissAlarm);

  wireHomeScreenSwipe(homeScreenOverlayEl, () => {
    hideHomeScreenOverlay(homeScreenOverlayEl);
    notificationChannel.send({ type: "broadcast", event: "home_screen_hide", payload: {} });
  });
}
