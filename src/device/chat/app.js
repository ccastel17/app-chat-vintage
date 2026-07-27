// Vista de un chat individual del dispositivo (actor)
import { supabase, DEVICES_PRESENCE_CHANNEL } from "../../shared/supabaseClient.js";
import { applySkinVars, cacheSkin, loadCachedSkin } from "../../shared/skin.js";
import { isOutgoing } from "../../shared/conversation.js";
import { uploadChatImage } from "../../shared/uploadImage.js";

// Pintar con el último skin conocido antes de esperar el fetch real —
// para que el skeleton no arranque con los colores default del CSS
const cachedSkin = loadCachedSkin();
if (cachedSkin) applySkinVars(document.documentElement, cachedSkin);

const backLink = document.getElementById("back-link");
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

function renderMessage(conversation, myRoomId, message) {
  const outgoing = isOutgoing(conversation, message, myRoomId);
  const hasImage = Boolean(message.image_url);
  const hasText = Boolean(message.content);
  const bubble = document.createElement("div");
  bubble.className = `bubble ${outgoing ? "outgoing" : "incoming"} ${hasImage && !hasText ? "image-only" : ""}`.trim();
  bubble.dataset.id = message.id;
  bubble.innerHTML = `
    ${hasImage ? '<img class="bubble-image" alt="Foto" />' : ""}
    ${hasText ? '<p class="bubble-text"></p>' : ""}
    <span class="bubble-meta">
      <span class="bubble-time"></span>
      ${outgoing ? ticksFor(message.status) : ""}
    </span>
  `;
  if (hasImage) bubble.querySelector(".bubble-image").src = message.image_url;
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

function showIncomingCall(callerName) {
  if (!callOverlayEl) return;
  const name = callerName || "Contacto";
  callerNameEl.textContent = name;
  setAvatar(callAvatarEl, name, currentAvatarUrl);
  callOverlayEl.classList.remove("hidden");
}

function hideIncomingCall() {
  callOverlayEl?.classList.add("hidden");
}

const { roomId, conversationId } = getIdsFromUrl();
backLink.href = roomId ? `/device/${roomId}` : "/";

if (!roomId || !conversationId) {
  messagesEl.innerHTML = '<p style="padding:16px;color:#7d8792;">Falta el room_id o el chat en la URL</p>';
  sendBtn.disabled = true;
  messageInput.disabled = true;
} else {
  loadActiveSkin();

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
      .on("broadcast", { event: "incoming_call" }, ({ payload }) => showIncomingCall(payload.callerName))
      .on("broadcast", { event: "end_call" }, () => hideIncomingCall())
      .subscribe();

    callDeclineBtn.addEventListener("click", hideIncomingCall);
    callAcceptBtn.addEventListener("click", () => {
      callerNameEl.textContent = "Conectando...";
      setTimeout(hideIncomingCall, 1500);
    });

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
}
