// Pantalla de inicio (lock screen) simulada. Fondo + hora + fecha los
// define el director; el actor la cierra con un swipe hacia arriba real
// (como desbloquear un iPhone), no con un botón — por eso necesita trackear
// el gesto con Pointer Events, parecido a los sliders de la pantalla de
// apagado/SOS pero en vertical y de una sola dirección.

const DISMISS_DISTANCE = 90; // px que hay que arrastrar hacia arriba para que cierre
const DISMISS_VELOCITY = 0.6; // px/ms — un swipe rápido y corto también cierra

export function showHomeScreenOverlay(el, { backgroundUrl, time, date, missedCalls } = {}) {
  const bgEl = el.querySelector(".home-screen-bg");
  const timeEl = el.querySelector("#home-screen-time");
  const dateEl = el.querySelector("#home-screen-date");
  if (bgEl) bgEl.style.backgroundImage = backgroundUrl ? `url("${backgroundUrl}")` : "none";
  if (timeEl) timeEl.textContent = time || "";
  if (dateEl) dateEl.textContent = date || "";
  renderMissedCalls(el, missedCalls);
  el.classList.remove("hidden");
  resetDrag(el);
  // el banner de notificación (z-index 30) queda por debajo de esta pantalla
  // (z-index 60) — esta clase lo sube por encima mientras dure, para que
  // un mensaje de otro contacto igual se pueda avisar acá arriba
  document.body.classList.add("home-screen-active");
}

export function hideHomeScreenOverlay(el) {
  el.classList.add("hidden");
  resetDrag(el);
  document.body.classList.remove("home-screen-active");
}

// Stack de notificaciones de "llamada perdida" sobre la lock screen —
// mismo criterio visual que el resto de los overlays (sin sonido, puramente
// visual). No tiene tile propio en /control todavía: por ahora se dispara
// pasando `missedCalls` en el payload de `home_screen_show` (ver script de
// capturas), no hay UI de director para armarlo en vivo.
function renderMissedCalls(el, missedCalls) {
  const container = el.querySelector(".home-screen-notifications");
  if (!container) return;
  container.innerHTML = "";
  if (!missedCalls || missedCalls.length === 0) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");
  missedCalls.forEach(({ name, avatarUrl, time }) => {
    const card = document.createElement("div");
    card.className = "missed-call-card";
    card.innerHTML = `
      <span class="missed-call-avatar" style="${avatarUrl ? `background-image:url('${avatarUrl}')` : ""}">
        <svg class="missed-call-badge" viewBox="0 0 24 24" width="13" height="13" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="12" fill="#ff453a" />
          <path
            d="M7.3 6.4c.4-.4 1-.4 1.3 0l1.6 1.9c.3.4.3.9 0 1.3l-.8.9c.4 1 1.6 2.2 2.6 2.6l.9-.8c.4-.3.9-.3 1.3 0l1.9 1.6c.4.4.4 1 0 1.3l-1 1c-.5.5-1.3.7-2 .4-2-.7-4.4-3-5.1-5.1-.3-.7-.1-1.5.4-2l1-1Z"
            fill="#fff"
          />
        </svg>
      </span>
      <span class="missed-call-text">
        <span class="missed-call-name">${name || ""}</span>
        <span class="missed-call-sub">Llamada perdida</span>
      </span>
      <span class="missed-call-time">${time || ""}</span>
    `;
    container.appendChild(card);
  });
}

function resetDrag(el) {
  const dragLayer = el.querySelector(".home-screen-drag-layer");
  if (!dragLayer) return;
  dragLayer.style.transition = "none";
  dragLayer.style.transform = "translateY(0)";
  dragLayer.style.opacity = "1";
}

// onDismiss: callback cuando el swipe efectivamente cierra la pantalla —
// quien llama decide qué hacer (ocultar + avisar a /control, como con la
// alarma)
export function wireHomeScreenSwipe(el, onDismiss) {
  const dragLayer = el.querySelector(".home-screen-drag-layer");
  if (!dragLayer) return;

  let startY = 0;
  let startTime = 0;
  let dragging = false;

  dragLayer.addEventListener("pointerdown", (e) => {
    dragging = true;
    startY = e.clientY;
    startTime = performance.now();
    dragLayer.setPointerCapture(e.pointerId);
    dragLayer.style.transition = "none";
  });

  dragLayer.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dy = Math.min(0, e.clientY - startY); // solo hacia arriba
    dragLayer.style.transform = `translateY(${dy}px)`;
    dragLayer.style.opacity = String(Math.max(0.35, 1 + dy / 300));
  });

  function release(e) {
    if (!dragging) return;
    dragging = false;
    const dy = startY - (e.clientY ?? startY); // positivo = arrastró hacia arriba
    const dt = Math.max(1, performance.now() - startTime);
    const velocity = dy / dt;
    dragLayer.style.transition = "transform 0.2s ease, opacity 0.2s ease";

    if (dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      dragLayer.style.transform = "translateY(-100%)";
      dragLayer.style.opacity = "0";
      setTimeout(() => onDismiss?.(), 180);
    } else {
      dragLayer.style.transform = "translateY(0)";
      dragLayer.style.opacity = "1";
    }
  }
  dragLayer.addEventListener("pointerup", release);
  dragLayer.addEventListener("pointercancel", release);
}
