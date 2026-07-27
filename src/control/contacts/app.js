// Panel de gestión de contactos/conversaciones por dispositivo
import { supabase } from "../../shared/supabaseClient.js";

const devicesEl = document.getElementById("devices");
const activeRoomLabel = document.getElementById("active-room-label");
const conversationListEl = document.getElementById("conversation-list");
const addActionsEl = document.getElementById("add-actions");
const addSimulatedBtn = document.getElementById("add-simulated-btn");
const linkActorBtn = document.getElementById("link-actor-btn");
const conversationCardTpl = document.getElementById("conversation-card-template");
const linkedCardTpl = document.getElementById("linked-card-template");
const linkModalEl = document.getElementById("link-modal");
const linkCandidatesEl = document.getElementById("link-candidates");
const closeLinkModalBtn = document.getElementById("close-link-modal-btn");

const rooms = new Map(); // room_id -> { room_id, label }
let activeRoomId = null;
const conversations = new Map(); // id -> conversation row del room activo
let conversationsChannel = null;

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function renderDeviceList() {
  devicesEl.innerHTML = "";
  if (rooms.size === 0) {
    devicesEl.innerHTML = '<li class="empty">Sin dispositivos todavía</li>';
    return;
  }
  [...rooms.values()]
    .sort((a, b) => (a.label || a.room_id).localeCompare(b.label || b.room_id))
    .forEach((room) => {
      const li = document.createElement("li");
      li.className = room.room_id === activeRoomId ? "active" : "";
      li.innerHTML = `
        <span class="device-row-top">
          <span class="device-label"></span>
        </span>
        <span class="device-row-actions">
          <a class="device-action-link view-chat-link" target="_blank" rel="noopener" title="Ver chat">
            <span class="action-icon">💬</span><span class="action-label">Ver chat</span>
          </a>
        </span>
      `;
      li.querySelector(".device-label").textContent = room.label || room.room_id;
      const viewChatLink = li.querySelector(".view-chat-link");
      viewChatLink.href = `/device/${room.room_id}`;
      viewChatLink.addEventListener("click", (e) => e.stopPropagation());
      li.addEventListener("click", () => selectRoom(room.room_id));
      devicesEl.appendChild(li);
    });
}

async function loadRooms() {
  const { data, error } = await supabase.from("rooms").select("*").order("label");
  if (error) {
    console.error("Error cargando dispositivos:", error);
    return;
  }
  rooms.clear();
  data.forEach((r) => rooms.set(r.room_id, r));
  renderDeviceList();

  // Si se llega desde "Editar lista" en /control (?room=roomId), seleccionar
  // ese dispositivo directo en vez de arrancar en "Selecciona un dispositivo"
  const preselect = new URLSearchParams(window.location.search).get("room");
  if (preselect && rooms.has(preselect)) selectRoom(preselect);
}

// Cablea avatar/nombre/estado editables — comunes a tarjetas simuladas y
// linkeadas (en una linkeada esto es solo la identidad que ve ESTE actor,
// independiente del nombre interno del otro dispositivo).
function wireEditableFields(node, conversation) {
  const avatarEl = node.querySelector(".card-avatar");
  const fileInput = node.querySelector(".avatar-file-input");
  const nameInput = node.querySelector(".contact-name-input");
  const statusInput = node.querySelector(".contact-status-input");
  const saveBtn = node.querySelector(".save-conversation-btn");

  function paintAvatar() {
    if (conversation.avatar_url) {
      avatarEl.style.backgroundImage = `url("${conversation.avatar_url}")`;
      avatarEl.textContent = "";
    } else {
      avatarEl.style.backgroundImage = "none";
      avatarEl.textContent = initials(conversation.contact_name);
    }
  }
  paintAvatar();
  nameInput.value = conversation.contact_name;
  statusInput.value = conversation.contact_status;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `${conversation.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) {
      console.error("Error subiendo avatar:", uploadError);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    conversation.avatar_url = publicUrl;
    paintAvatar();
    const { error } = await supabase.from("conversations").update({ avatar_url: publicUrl }).eq("id", conversation.id);
    if (error) console.error("Error guardando avatar:", error);
    fileInput.value = "";
  });

  saveBtn.addEventListener("click", async () => {
    const contact_name = nameInput.value.trim() || "Contacto";
    const contact_status = statusInput.value.trim() || "en línea";
    const { error } = await supabase
      .from("conversations")
      .update({ contact_name, contact_status })
      .eq("id", conversation.id);
    if (error) {
      console.error("Error guardando contacto:", error);
      return;
    }
    conversation.contact_name = contact_name;
    conversation.contact_status = contact_status;
    paintAvatar();
  });
}

function renderSimulatedCard(conversation) {
  const node = conversationCardTpl.content.cloneNode(true);
  const card = node.querySelector(".conversation-card");
  const deleteBtn = node.querySelector(".delete-conversation-btn");

  wireEditableFields(node, conversation);

  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar el contacto "${conversation.contact_name}"? Se borran también sus mensajes.`)) return;
    await supabase.from("messages").delete().eq("thread_id", conversation.thread_id);
    const { error } = await supabase.from("conversations").delete().eq("id", conversation.id);
    if (error) console.error("Error eliminando contacto:", error);
    else await selectRoom(activeRoomId);
  });

  card.dataset.id = conversation.id;
  return node;
}

function renderLinkedCard(conversation) {
  const node = linkedCardTpl.content.cloneNode(true);
  const card = node.querySelector(".conversation-card");
  const deleteBtn = node.querySelector(".delete-conversation-btn");
  const otherRoom = rooms.get(conversation.linked_room_id);
  node.querySelector(".linked-with-text").textContent =
    `Linkeado con: ${otherRoom?.label || conversation.linked_room_id}`;

  wireEditableFields(node, conversation);

  deleteBtn.addEventListener("click", async () => {
    if (!confirm("¿Desvincular esta conversación? Los mensajes se borran para los dos actores.")) return;
    await supabase.from("messages").delete().eq("thread_id", conversation.thread_id);
    const { error } = await supabase.from("conversations").delete().eq("thread_id", conversation.thread_id);
    if (error) console.error("Error desvinculando:", error);
    else await selectRoom(activeRoomId);
  });

  card.dataset.id = conversation.id;
  return node;
}

function renderConversationList() {
  conversationListEl.innerHTML = "";
  if (conversations.size === 0) {
    conversationListEl.innerHTML = '<p class="empty">Este dispositivo todavía no tiene chats en su lista.</p>';
    return;
  }
  [...conversations.values()].forEach((conversation) => {
    conversationListEl.appendChild(
      conversation.kind === "linked" ? renderLinkedCard(conversation) : renderSimulatedCard(conversation)
    );
  });
}

async function selectRoom(roomId) {
  activeRoomId = roomId;
  activeRoomLabel.textContent = rooms.get(roomId)?.label || roomId;
  addActionsEl.classList.remove("hidden");
  renderDeviceList();

  const { data, error } = await supabase.from("conversations").select("*").eq("room_id", roomId);
  conversations.clear();
  if (error) {
    console.error("Error cargando conversaciones:", error);
  } else {
    data.forEach((c) => conversations.set(c.id, c));
  }
  renderConversationList();

  conversationsChannel?.unsubscribe();
  conversationsChannel = supabase
    .channel(`contacts-of:${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations", filter: `room_id=eq.${roomId}` },
      () => selectRoom(roomId)
    )
    .subscribe();
}

addSimulatedBtn.addEventListener("click", async () => {
  if (!activeRoomId) return;
  const { error } = await supabase.from("conversations").insert({
    room_id: activeRoomId,
    kind: "simulated",
    contact_name: "Nuevo contacto",
    contact_status: "en línea",
  });
  if (error) console.error("Error creando contacto:", error);
  else await selectRoom(activeRoomId);
});

linkActorBtn.addEventListener("click", () => {
  const candidates = [...rooms.values()].filter((r) => r.room_id !== activeRoomId);
  linkCandidatesEl.innerHTML = "";
  if (candidates.length === 0) {
    linkCandidatesEl.innerHTML = '<li class="empty">No hay otro dispositivo creado todavía.</li>';
  }
  candidates.forEach((room) => {
    const li = document.createElement("li");
    li.textContent = room.label || room.room_id;
    li.addEventListener("click", () => linkWith(room.room_id));
    linkCandidatesEl.appendChild(li);
  });
  linkModalEl.classList.remove("hidden");
});

closeLinkModalBtn.addEventListener("click", () => linkModalEl.classList.add("hidden"));

async function linkWith(otherRoomId) {
  const threadId = crypto.randomUUID();
  const me = rooms.get(activeRoomId);
  const other = rooms.get(otherRoomId);
  const myLabel = me?.label || activeRoomId;
  const otherLabel = other?.label || otherRoomId;

  const { error } = await supabase.from("conversations").insert([
    {
      room_id: activeRoomId,
      kind: "linked",
      contact_name: otherLabel,
      avatar_url: other?.avatar_url || null,
      linked_room_id: otherRoomId,
      thread_id: threadId,
    },
    {
      room_id: otherRoomId,
      kind: "linked",
      contact_name: myLabel,
      avatar_url: me?.avatar_url || null,
      linked_room_id: activeRoomId,
      thread_id: threadId,
    },
  ]);
  if (error) {
    console.error("Error linkeando:", error);
    return;
  }
  linkModalEl.classList.add("hidden");
  await selectRoom(activeRoomId);
}

loadRooms();
