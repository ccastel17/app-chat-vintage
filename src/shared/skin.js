// Traduce una fila de la tabla `skins` a valores concretos de CSS.
// Usado por /device (aplica en :root) y /control (preview en vivo del editor).

export const FONT_STACKS = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", -apple-system, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

export const FONT_LABELS = {
  system: "Sistema",
  rounded: "Redondeada",
  mono: "Monoespaciada",
};

export const FONT_SIZES = { sm: "13px", md: "15px", lg: "17px" };
export const FONT_SIZE_LABELS = { sm: "Chica", md: "Mediana", lg: "Grande" };

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(n) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastText(bgHex) {
  try {
    return relativeLuminance(hexToRgb(bgHex)) > 0.5 ? "#12161c" : "#ffffff";
  } catch {
    return "#ffffff";
  }
}

function mix(hex, amount, towardsHex) {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(towardsHex);
  const m = (a, b) => a + (b - a) * amount;
  return `#${toHex(m(r1, r2))}${toHex(m(g1, g2))}${toHex(m(b1, b2))}`;
}

export function deriveSkinTokens(skin) {
  const isDark = skin.mode === "dark";
  const towards = isDark ? "#ffffff" : "#000000";
  return {
    bg: skin.bg,
    surface: mix(skin.bg, 0.08, towards),
    line: mix(skin.bg, 0.16, towards),
    ink: isDark ? "#e9edf1" : "#12161c",
    muted: isDark ? "#7d8792" : "#6b7280",
    accent: skin.bubble_outgoing_bg,
    bubbleIncomingBg: skin.bubble_incoming_bg,
    bubbleIncomingText: contrastText(skin.bubble_incoming_bg),
    bubbleOutgoingBg: skin.bubble_outgoing_bg,
    bubbleOutgoingText: contrastText(skin.bubble_outgoing_bg),
    tick: skin.tick_color,
    tickSeen: skin.tick_seen_color,
    fontFamily: FONT_STACKS[skin.font_family] || FONT_STACKS.system,
    fontSize: FONT_SIZES[skin.font_size] || FONT_SIZES.md,
  };
}

const SKIN_CACHE_KEY = "activeSkin";

// Para pintar con el skin correcto desde el primer frame (antes de que
// resuelva el fetch a Supabase) — usado por /device y /device/chat, que
// muestran un skeleton mientras cargan.
export function cacheSkin(skin) {
  try {
    localStorage.setItem(SKIN_CACHE_KEY, JSON.stringify(skin));
  } catch {}
}

export function loadCachedSkin() {
  try {
    const raw = localStorage.getItem(SKIN_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applySkinVars(target, skin) {
  const t = deriveSkinTokens(skin);
  target.style.setProperty("--skin-bg", t.bg);
  target.style.setProperty("--skin-surface", t.surface);
  target.style.setProperty("--skin-line", t.line);
  target.style.setProperty("--skin-ink", t.ink);
  target.style.setProperty("--skin-muted", t.muted);
  target.style.setProperty("--skin-accent", t.accent);
  target.style.setProperty("--skin-bubble-incoming-bg", t.bubbleIncomingBg);
  target.style.setProperty("--skin-bubble-incoming-text", t.bubbleIncomingText);
  target.style.setProperty("--skin-bubble-outgoing-bg", t.bubbleOutgoingBg);
  target.style.setProperty("--skin-bubble-outgoing-text", t.bubbleOutgoingText);
  target.style.setProperty("--skin-tick", t.tick);
  target.style.setProperty("--skin-tick-seen", t.tickSeen);
  target.style.setProperty("--skin-font-family", t.fontFamily);
  target.style.setProperty("--skin-font-size", t.fontSize);
}
