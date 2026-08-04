// Pantalla de "mantener presionado el botón de encendido" (apagar / Ficha
// médica / SOS). Los sliders de apagar y Ficha médica son puramente
// visuales — el thumb se puede arrastrar para que se vea real en cámara,
// pero no disparan ninguna acción real; al soltar, siempre vuelven a su
// posición inicial. El de "Emergencia SOS" es la única excepción: si el
// actor lo completa de verdad, dispara onSosComplete (quien llama decide
// qué hacer — pasar a la pantalla de llamada SOS en curso, ver app.js).
// Usado por /device y /device/chat, cada uno con su propio overlay en el
// DOM (mismos ids/clases).

const SOS_COMPLETE_THRESHOLD = 0.82; // % del recorrido para contar como "completado"

export function wireEmergencySliders(root, { onSosComplete } = {}) {
  root.querySelectorAll(".emergency-slider").forEach((slider) => {
    const thumb = slider.querySelector(".slider-thumb");
    const isSos = slider.classList.contains("sos");
    let dragging = false;
    let startX = 0;
    let maxX = 0;
    let lastX = 0;

    thumb.addEventListener("pointerdown", (e) => {
      dragging = true;
      thumb.setPointerCapture(e.pointerId);
      startX = e.clientX - thumb.getBoundingClientRect().left;
      maxX = slider.clientWidth - thumb.offsetWidth - 10;
      thumb.style.transition = "none";
    });

    thumb.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const x = Math.max(0, Math.min(maxX, e.clientX - slider.getBoundingClientRect().left - startX));
      lastX = x;
      thumb.style.transform = `translateX(${x}px)`;
    });

    function release() {
      if (!dragging) return;
      dragging = false;
      const completedSos = isSos && onSosComplete && maxX > 0 && lastX / maxX >= SOS_COMPLETE_THRESHOLD;
      thumb.style.transition = "transform 0.25s ease";
      thumb.style.transform = "translateX(0)";
      if (completedSos) onSosComplete();
    }
    thumb.addEventListener("pointerup", release);
    thumb.addEventListener("pointercancel", release);
  });
}

export function showEmergencyOverlay(el) {
  el.classList.remove("hidden");
}

export function hideEmergencyOverlay(el) {
  el.classList.add("hidden");
  el.querySelectorAll(".slider-thumb").forEach((thumb) => {
    thumb.style.transition = "none";
    thumb.style.transform = "translateX(0)";
  });
}
