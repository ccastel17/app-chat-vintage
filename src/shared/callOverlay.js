// Pantalla de llamada entrante simulada (audio o video). Va por el canal
// de notificaciones (a nivel dispositivo, no de thread) para que
// interrumpa sin importar qué esté mirando el actor en ese momento — la
// lista, el chat que está llamando, o cualquier otro chat — igual que en
// un teléfono real. Por eso el nombre/foto vienen siempre del payload
// (quién llama), nunca de la conversación que el actor tenga abierta en
// ese momento.
//
// El overlay tiene dos estados internos, sub-divs dentro del mismo
// #incoming-call-overlay: .call-ringing (avatar + nombre + aceptar/
// rechazar, lo de siempre) y .call-connected (pantalla verde chroma con
// marcadores de tracking — solo para videollamada, se muestra al aceptar
// en vez de cerrar el overlay). isVideo viaja en el payload y se guarda
// en el propio elemento (dataset) para que el botón de aceptar sepa qué
// hacer sin tener que pasarse el payload de un lado a otro.

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

export function showIncomingCall(el, avatarEl, nameEl, { callerName, avatarUrl, isVideo } = {}) {
  const name = callerName || "Contacto";
  nameEl.textContent = name;
  if (avatarUrl) {
    avatarEl.style.backgroundImage = `url("${avatarUrl}")`;
    avatarEl.textContent = "";
  } else {
    avatarEl.style.backgroundImage = "none";
    avatarEl.textContent = initials(name);
  }
  el.dataset.isVideo = isVideo ? "true" : "false";
  const kindEl = el.querySelector("#call-kind");
  if (kindEl) kindEl.textContent = isVideo ? "Videollamada" : "Llamada de audio";
  el.querySelector(".call-ringing")?.classList.remove("hidden");
  el.querySelector(".call-connected")?.classList.add("hidden");
  el.classList.remove("hidden", "video-connected");
}

export function hideIncomingCall(el) {
  el.classList.add("hidden");
  el.classList.remove("video-connected");
  // vuelve al estado "sonando" por default, para la próxima vez
  el.querySelector(".call-ringing")?.classList.remove("hidden");
  el.querySelector(".call-connected")?.classList.add("hidden");
}

// Se llama al aceptar una videollamada — no cierra el overlay, lo pasa a
// la pantalla verde con trackers en vez del timbre. "video-connected" en
// el overlay raíz pinta TODAS las capas ancestro de verde (no solo
// .call-tracker-screen) — si iOS recorta el contenido position:fixed en
// un borde que no podemos calcular (confirmado: agrandar el hijo no
// alcanza), que ese borde muestre verde en vez de negro/otro color es más
// robusto que perseguir cuál capa exacta es la que se ve
export function connectVideoCall(el) {
  el.classList.add("video-connected");
  el.querySelector(".call-ringing")?.classList.add("hidden");
  el.querySelector(".call-connected")?.classList.remove("hidden");
}
