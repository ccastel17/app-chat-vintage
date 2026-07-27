// Landing del proyecto
import { supabase } from "../shared/supabaseClient.js";

const actorsGrid = document.getElementById("actors-grid");

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

async function loadActors() {
  const { data, error } = await supabase.from("rooms").select("*").order("room_id");
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
    const a = document.createElement("a");
    a.className = "actor-card";
    a.href = `/device/${room.room_id}`;
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = `
      <span class="actor-avatar"></span>
      <span class="actor-name"></span>
      <span class="actor-open">Abrir chats →</span>
    `;
    a.querySelector(".actor-avatar").textContent = initials(room.room_id);
    a.querySelector(".actor-name").textContent = room.room_id;
    actorsGrid.appendChild(a);
  });
}

loadActors();
