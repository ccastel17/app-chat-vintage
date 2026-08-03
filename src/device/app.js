// Lista de chats del dispositivo (home)
import { supabase, DEVICES_PRESENCE_CHANNEL, notificationsChannelName } from "../shared/supabaseClient.js";
import { applySkinVars, cacheSkin, loadCachedSkin } from "../shared/skin.js";
import { wireEmergencySliders, showEmergencyOverlay, hideEmergencyOverlay } from "../shared/emergencyOverlay.js";
import { showAlarmOverlay, hideAlarmOverlay } from "../shared/alarmOverlay.js";
import { showIncomingCall, hideIncomingCall, connectVideoCall } from "../shared/callOverlay.js";
import { showHomeScreenOverlay, hideHomeScreenOverlay, wireHomeScreenSwipe } from "../shared/homeScreenOverlay.js";

const listEl = document.getElementById("chat-list");
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

callDeclineBtn.addEventListener("click", () => hideIncomingCall(callOverlayEl));
callAcceptBtn.addEventListener("click", () => {
  // Video: en vez de cerrar, pasa a la pantalla verde con trackers —
  // el actor cuelga desde ahí (o el director la corta desde /control)
  if (callOverlayEl.dataset.isVideo === "true") {
    connectVideoCall(callOverlayEl);
    return;
  }
  callerNameEl.textContent = "Conectando...";
  setTimeout(() => hideIncomingCall(callOverlayEl), 1500);
});
document.getElementById("call-hangup-btn").addEventListener("click", () => hideIncomingCall(callOverlayEl));

const homeScreenOverlayEl = document.getElementById("home-screen-overlay");

// #list-root usa --app-height (con 100dvh de fallback) — ver detalle en
// device/chat/app.js
if (window.visualViewport) {
  const setAppHeight = () => {
    document.documentElement.style.setProperty("--app-height", `${window.visualViewport.height}px`);
  };
  setAppHeight();
  window.visualViewport.addEventListener("resize", setAppHeight);
}

// Pintar con el último skin conocido antes de esperar el fetch real —
// para que el skeleton no arranque con los colores default del CSS
const cachedSkin = loadCachedSkin();
if (cachedSkin) applySkinVars(document.documentElement, cachedSkin);

function getRoomIdFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[1] || null;
}

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

async function loadActiveSkin() {
  const { data } = await supabase
    .from("app_settings")
    .select("active_skin_id, skins(*)")
    .eq("id", 1)
    .maybeSingle();
  if (data?.skins) {
    applySkinVars(document.documentElement, data.skins);
    cacheSkin(data.skins);
  }
}

const roomId = getRoomIdFromUrl();

if (!roomId) {
  listEl.innerHTML = '<li class="empty">Falta el room_id en la URL (/device/roomId)</li>';
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

  const conversations = new Map(); // id -> conversation row
  const previews = new Map(); // id -> { content, created_at }

  // Caché en localStorage: pinta instantáneo con el último estado conocido
  // mientras se espera la respuesta real de Supabase (evita la pantalla en
  // blanco al ir y volver entre la lista y un chat).
  const CACHE_KEY = `chatlist:${roomId}`;

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveCache() {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          conversations: [...conversations.values()],
          previews: Object.fromEntries(previews),
        })
      );
    } catch {}
  }

  function renderList() {
    const items = [...conversations.values()].sort((a, b) => {
      const ta = previews.get(a.id)?.created_at || a.created_at;
      const tb = previews.get(b.id)?.created_at || b.created_at;
      return new Date(tb) - new Date(ta);
    });

    listEl.innerHTML = "";
    if (items.length === 0) {
      listEl.innerHTML = '<li class="empty">Todavía no tenés chats</li>';
      return;
    }

    items.forEach((conversation) => {
      const preview = previews.get(conversation.id);
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="/device/${roomId}/chat/${conversation.id}">
          <span class="chat-avatar"></span>
          <span class="chat-info">
            <span class="chat-name"></span>
            <span class="chat-preview"></span>
          </span>
          <span class="chat-time"></span>
        </a>
      `;
      const avatarEl = li.querySelector(".chat-avatar");
      if (conversation.avatar_url) {
        avatarEl.style.backgroundImage = `url("${conversation.avatar_url}")`;
      } else {
        avatarEl.textContent = initials(conversation.contact_name);
      }
      li.querySelector(".chat-name").textContent = conversation.contact_name;
      li.querySelector(".chat-preview").textContent = preview
        ? preview.is_voice ? "🎙️ Audio" : preview.content
        : "Sin mensajes todavía";
      if (preview) {
        li.querySelector(".chat-time").textContent = new Date(preview.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      listEl.appendChild(li);
    });
  }

  async function loadPreview(conversation) {
    const { data } = await supabase
      .from("messages")
      .select("content, created_at, is_voice")
      .eq("thread_id", conversation.thread_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) previews.set(conversation.id, data);
  }

  async function loadConversations() {
    const { data, error } = await supabase.from("conversations").select("*").eq("room_id", roomId);
    if (error) {
      console.error("Error cargando chats:", error);
      return;
    }
    conversations.clear();
    previews.clear();
    data.forEach((c) => conversations.set(c.id, c));
    await Promise.all(data.map(loadPreview));
    renderList();
    saveCache();
  }

  const cached = loadCache();
  if (cached) {
    cached.conversations.forEach((c) => conversations.set(c.id, c));
    Object.entries(cached.previews).forEach(([id, p]) => previews.set(id, p));
    renderList();
  }
  loadConversations();

  supabase
    .channel(`conversations:${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations", filter: `room_id=eq.${roomId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          conversations.delete(payload.old.id);
        } else {
          conversations.set(payload.new.id, payload.new);
        }
        renderList();
        saveCache();
      }
    )
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      const conversation = [...conversations.values()].find((c) => c.thread_id === payload.new.thread_id);
      if (!conversation) return;
      previews.set(conversation.id, {
        content: payload.new.content,
        created_at: payload.new.created_at,
        is_voice: payload.new.is_voice,
      });
      renderList();
      saveCache();
    })
    .subscribe();

  // Skin activo: global, no depende del room
  supabase
    .channel("skin-changes")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings" }, loadActiveSkin)
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

  // Banner de notificación simulada (el director la dispara al mandar un
  // mensaje entrante) — funciona para cualquier chat, no solo el que se
  // esté por abrir, por eso escucha acá y no en /device/chat únicamente
  let notificationHideTimeout = null;
  let notificationTargetConversationId = null;

  function showNotificationBanner({ conversationId, contactName, avatarUrl, content }) {
    notificationTargetConversationId = conversationId;
    if (avatarUrl) {
      notificationAvatarEl.style.backgroundImage = `url("${avatarUrl}")`;
      notificationAvatarEl.textContent = "";
    } else {
      notificationAvatarEl.style.backgroundImage = "none";
      notificationAvatarEl.textContent = initials(contactName);
    }
    notificationNameEl.textContent = contactName;
    notificationTextEl.textContent = content;
    notificationBannerEl.classList.add("visible");
    clearTimeout(notificationHideTimeout);
    notificationHideTimeout = setTimeout(() => notificationBannerEl.classList.remove("visible"), 4500);
  }

  notificationBannerEl.addEventListener("click", () => {
    if (notificationTargetConversationId) {
      window.location.href = `/device/${roomId}/chat/${notificationTargetConversationId}`;
    }
  });

  let lastAlarmTime = "";

  const notificationChannel = supabase
    .channel(notificationsChannelName(roomId))
    .on("broadcast", { event: "new_message" }, ({ payload }) => showNotificationBanner(payload))
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

  // A diferencia de la pantalla de apagado/SOS, acá el actor SÍ puede
  // cerrar la alarma tocando "Detener" o "Posponer" (las dos hacen lo
  // mismo) — es parte de la actuación, como una alarma real. Se reenvía
  // el mismo evento de cierre para que /control salga de "activa" y no
  // quede desincronizado si el actor la cerró antes de que lo haga el
  // director.
  function dismissAlarm() {
    hideAlarmOverlay(alarmOverlayEl);
    notificationChannel.send({ type: "broadcast", event: "alarm_screen_hide", payload: {} });
    // Como en un iPhone real: al apagar/posponer, no vuelve directo a la
    // app — queda debajo la pantalla de inicio. Hora = la de la alarma
    // recién sonando; fecha en blanco (no hay una fuente confiable acá).
    // Se reenvía como home_screen_show (mismo evento que usa /control al
    // activarla) para que el panel del director se resincronice también.
    const homeScreenPayload = { backgroundUrl: roomHomeScreenBgUrl, time: lastAlarmTime, date: "" };
    showHomeScreenOverlay(homeScreenOverlayEl, homeScreenPayload);
    notificationChannel.send({ type: "broadcast", event: "home_screen_show", payload: homeScreenPayload });
  }
  document.getElementById("alarm-stop-btn").addEventListener("click", dismissAlarm);
  document.getElementById("alarm-snooze-btn").addEventListener("click", dismissAlarm);

  // Misma razón que la alarma: el actor cierra con el swipe, y hay que
  // avisarle a /control (si no, el panel del director queda mostrando
  // "Cerrar pantalla" para algo que el actor ya cerró)
  wireHomeScreenSwipe(homeScreenOverlayEl, () => {
    hideHomeScreenOverlay(homeScreenOverlayEl);
    notificationChannel.send({ type: "broadcast", event: "home_screen_hide", payload: {} });
  });
}
