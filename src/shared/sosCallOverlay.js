// Pantalla de "llamada SOS en curso" — alternativa a la de apagado/SOS
// (src/shared/emergencyOverlay.js), simula el resultado de completar el
// slider "Emergencia SOS": la llamada al 112 ya en marcha. Solo visual,
// sin lógica de llamada real. El director la cierra (mismo criterio que
// apagado/SOS: el actor tiene que seguir actuando la escena, no cerrarla
// él mismo tocando la pantalla).

export function showSosCallOverlay(el, { backgroundUrl } = {}) {
  const bgEl = el.querySelector(".sos-call-bg");
  if (bgEl) bgEl.style.backgroundImage = backgroundUrl ? `url("${backgroundUrl}")` : "none";
  el.classList.remove("hidden");
}

export function hideSosCallOverlay(el) {
  el.classList.add("hidden");
}
