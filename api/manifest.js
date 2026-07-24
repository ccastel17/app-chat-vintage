// Manifest dinámico por room: cada /device/[roomId] instala su propia PWA
// con start_url apuntando a esa room, para que el ícono en el home del
// teléfono abra siempre la conversación correcta sin navegación manual.
export default function handler(req, res) {
  const roomId = typeof req.query.room === "string" ? req.query.room : "";

  const manifest = {
    name: "Chat",
    short_name: "Chat",
    description: "App de mensajería",
    start_url: roomId ? `/device/${roomId}` : "/device/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0f14",
    theme_color: "#0b0f14",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  res.setHeader("Content-Type", "application/manifest+json");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(manifest);
}
