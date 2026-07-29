// Pantalla de "mantener presionado el botón de encendido" (apagar / Ficha
// médica / SOS). Es puramente visual — el thumb se puede arrastrar para que
// se vea real en cámara, pero ningún slider dispara una acción real; al
// soltar, siempre vuelve a su posición inicial. Usado por /device y
// /device/chat, cada uno con su propio overlay en el DOM (mismos ids/clases).

export function wireEmergencySliders(root) {
  root.querySelectorAll(".emergency-slider").forEach((slider) => {
    const thumb = slider.querySelector(".slider-thumb");
    let dragging = false;
    let startX = 0;
    let maxX = 0;

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
      thumb.style.transform = `translateX(${x}px)`;
    });

    function release() {
      if (!dragging) return;
      dragging = false;
      thumb.style.transition = "transform 0.25s ease";
      thumb.style.transform = "translateX(0)";
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
