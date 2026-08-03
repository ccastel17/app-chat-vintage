// Pantalla de alarma simulada (tipo "despertador sonando" de iOS). A
// diferencia de la pantalla de apagado/SOS, acá el actor SÍ puede cerrarla
// tocando "Detener" o "Posponer" — es parte de la actuación, como una
// alarma real. Quien la dispara (el director) define la hora que se
// muestra; el reenvío del evento de cierre hacia /control lo maneja cada
// app.js, no este módulo (que solo toca el DOM local).

export function showAlarmOverlay(el, time) {
  const timeEl = el.querySelector("#alarm-time");
  if (timeEl) timeEl.textContent = time || "";
  el.classList.remove("hidden");
}

export function hideAlarmOverlay(el) {
  el.classList.add("hidden");
}
