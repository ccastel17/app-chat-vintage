// Galería simple de pantallas simuladas por actor — enlazada desde la
// home ("👀 Ver pantallas" en cada tarjeta de actor). Las imágenes son
// capturas estáticas (ver /public/screens/<roomId>/), no se generan en
// vivo — si se sube un actor nuevo o se le regeneran las capturas, hay
// que copiar los .png a esa carpeta a mano.
import { supabase } from "../shared/supabaseClient.js";

const SCREENS = [
  { file: "01-llamada-entrante.png", label: "Llamada entrante" },
  { file: "02-videollamada-timbre.png", label: "Videollamada (timbre)" },
  { file: "03-videollamada-conectada.png", label: "Videollamada (conectada)" },
  { file: "04-apagado-sos.png", label: "Apagado / SOS" },
  { file: "05-llamada-sos-activa.png", label: "Llamada SOS activa" },
  { file: "06-despertador.png", label: "Despertador" },
  { file: "07-pantalla-inicio.png", label: "Pantalla de inicio" },
];

function getRoomIdFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[1] || null;
}

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

const avatarEl = document.getElementById("actor-avatar");
const nameEl = document.getElementById("actor-name");
const gridEl = document.getElementById("thumbs-grid");

function renderGrid(roomId) {
  gridEl.innerHTML = "";
  SCREENS.forEach((screen) => {
    const imgUrl = `/screens/${roomId}/${screen.file}`;
    const card = document.createElement("a");
    card.className = "thumb-card";
    card.href = imgUrl;
    card.target = "_blank";
    card.rel = "noopener";
    card.innerHTML = `
      <span class="thumb-frame">
        <img src="${imgUrl}" alt="${screen.label}" loading="lazy" />
      </span>
      <span class="thumb-label">${screen.label}</span>
    `;
    const img = card.querySelector("img");
    img.addEventListener("error", () => {
      const frame = card.querySelector(".thumb-frame");
      frame.innerHTML = '<span class="thumb-missing">Sin captura todavía</span>';
      card.removeAttribute("href");
    });
    gridEl.appendChild(card);
  });
}

async function init() {
  const roomId = getRoomIdFromUrl();
  if (!roomId) {
    nameEl.textContent = "Falta el actor en la URL";
    return;
  }

  renderGrid(roomId);

  const { data: room } = await supabase.from("rooms").select("*").eq("room_id", roomId).maybeSingle();
  const name = room?.label || roomId;
  nameEl.textContent = name;
  if (room?.avatar_url) {
    avatarEl.style.backgroundImage = `url("${room.avatar_url}")`;
  } else {
    avatarEl.textContent = initials(name);
  }
}

init();
