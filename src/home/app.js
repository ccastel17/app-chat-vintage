// Landing del proyecto
import { supabase } from "../shared/supabaseClient.js";

const actorsGrid = document.getElementById("actors-grid");

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

async function copyLink(url, btn) {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // fallback para navegadores/contextos sin permiso de clipboard
    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  const original = btn.textContent;
  btn.textContent = "¡Copiado!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("copied");
  }, 1500);
}

async function loadActors() {
  const { data, error } = await supabase.from("rooms").select("*").order("label");
  if (error) {
    console.error("Error cargando actores:", error);
    actorsGrid.innerHTML = '<p class="empty">No se pudo cargar la lista de actores.</p>';
    return;
  }
  if (data.length === 0) {
    actorsGrid.innerHTML =
      '<p class="empty">Todavía no hay actores creados — entrá al <a href="/control">Panel de Control</a> para crear el primero.</p>';
    return;
  }
  actorsGrid.innerHTML = "";
  data.forEach((room) => {
    const name = room.label || room.room_id;
    const url = `${location.origin}/device/${room.room_id}`;

    const card = document.createElement("div");
    card.className = "actor-card";
    card.innerHTML = `
      <span class="actor-avatar"></span>
      <span class="actor-name"></span>
      <span class="actor-url"></span>
      <div class="actor-actions">
        <button type="button" class="copy-link-btn">📋 Copiar link</button>
        <a class="open-link" target="_blank" rel="noopener">Abrir →</a>
      </div>
    `;
    const avatarEl = card.querySelector(".actor-avatar");
    if (room.avatar_url) {
      avatarEl.style.backgroundImage = `url("${room.avatar_url}")`;
    } else {
      avatarEl.textContent = initials(name);
    }
    card.querySelector(".actor-name").textContent = name;
    card.querySelector(".actor-url").textContent = `/device/${room.room_id}`;
    card.querySelector(".open-link").href = url;
    card.querySelector(".copy-link-btn").addEventListener("click", (e) => copyLink(url, e.currentTarget));
    actorsGrid.appendChild(card);
  });
}

loadActors();
