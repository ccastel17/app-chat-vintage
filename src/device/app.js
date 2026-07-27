// Lista de chats del dispositivo (home)
import { supabase, DEVICES_PRESENCE_CHANNEL } from "../shared/supabaseClient.js";
import { applySkinVars, cacheSkin, loadCachedSkin } from "../shared/skin.js";

const listEl = document.getElementById("chat-list");

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
      li.querySelector(".chat-preview").textContent = preview ? preview.content : "Sin mensajes todavía";
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
      .select("content, created_at")
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
      previews.set(conversation.id, { content: payload.new.content, created_at: payload.new.created_at });
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
}
