// "Ver galería completa" desde la home — todos los actores existentes,
// cada uno con el mismo set de 7 pantallas genéricas que usa
// /gallery/[roomId] (mismo manifest SCREENS, ver src/gallery/app.js) y,
// si tiene, sus capturas narrativas del "pedido de rodaje"
// (RODAJE_SCREENS_BY_ROOM, ver /screens/rodaje/*.png) en una sub-sección
// aparte. Actores sin capturas generadas todavía caen en el placeholder
// normal "Sin captura todavía" por thumbnail, no rompen el layout.
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

// Curado a mano por actor — no todos tienen capturas narrativas
const RODAJE_SCREENS_BY_ROOM = {
  genis: [
    { file: "01-genis-interfaz-camara.png", label: "Interfaz de cámara" },
    { file: "03-genis-videollamada-croma.png", label: "Videollamada conectada" },
    { file: "05-genis-despertador.png", label: "Despertador sonando" },
    { file: "06-genis-pantalla-inicio-llamadas-perdidas.png", label: "Pantalla de inicio + llamadas perdidas" },
    { file: "07-genis-llamada-emergencia.png", label: "Llamada de emergencia" },
    { file: "08-genis-nota-audio-paco.png", label: "Nota de audio reproduciéndose" },
  ],
  paco: [
    { file: "02-paco-notificacion-pantalla-inicio.png", label: "Notificación en pantalla de inicio" },
    { file: "04-paco-videollamada-ipad.png", label: "Videollamada (iPad)" },
    { file: "09-paco-interfaz-camara.png", label: "Interfaz de cámara" },
    { file: "10-paco-videollamada-xusa.png", label: "Videollamada con Xusa" },
  ],
};

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

const groupsEl = document.getElementById("gallery-groups");

function thumbCard(imgUrl, screen) {
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
    card.querySelector(".thumb-frame").innerHTML = '<span class="thumb-missing">Sin captura todavía</span>';
    card.removeAttribute("href");
  });
  return card;
}

async function init() {
  const { data: rooms, error } = await supabase.from("rooms").select("*").order("label");
  if (error) {
    groupsEl.innerHTML = '<p class="empty">No se pudo cargar la lista de actores.</p>';
    return;
  }
  if (!rooms || rooms.length === 0) {
    groupsEl.innerHTML = '<p class="empty">Todavía no hay actores creados.</p>';
    return;
  }

  groupsEl.innerHTML = "";
  rooms.forEach((room) => {
    const name = room.label || room.room_id;
    const rodajeScreens = RODAJE_SCREENS_BY_ROOM[room.room_id];

    const section = document.createElement("section");
    section.className = "actor-group";
    section.innerHTML = `
      <div class="actor-group-header">
        <span class="actor-avatar actor-group-avatar"></span>
        <h2>${name}</h2>
      </div>
      <div class="thumbs-grid"></div>
    `;
    const avatarEl = section.querySelector(".actor-group-avatar");
    if (room.avatar_url) {
      avatarEl.style.backgroundImage = `url("${room.avatar_url}")`;
    } else {
      avatarEl.textContent = initials(name);
    }
    const grid = section.querySelector(".thumbs-grid");
    SCREENS.forEach((screen) => grid.appendChild(thumbCard(`/screens/${room.room_id}/${screen.file}`, screen)));

    if (rodajeScreens && rodajeScreens.length > 0) {
      const subHeading = document.createElement("h3");
      subHeading.className = "actor-group-subheading";
      subHeading.textContent = "Capturas del rodaje";
      section.appendChild(subHeading);

      const rodajeGrid = document.createElement("div");
      rodajeGrid.className = "thumbs-grid";
      rodajeScreens.forEach((screen) => rodajeGrid.appendChild(thumbCard(`/screens/rodaje/${screen.file}`, screen)));
      section.appendChild(rodajeGrid);
    }

    groupsEl.appendChild(section);
  });
}

init();
