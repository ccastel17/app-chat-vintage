# App Chat Rodaje — Punto de partida

Este es el scaffolding inicial para empezar el proyecto con Claude Code.

## Estructura

```
app-chat-rodaje/
├── CLAUDE.md              ← contexto persistente para Claude Code (¡no borrar!)
├── public/
│   ├── manifest.json      ← hace la app instalable (PWA)
│   ├── sw.js               ← service worker mínimo
│   └── icons/              ← faltan los iconos reales (192px y 512px, normal y maskable)
├── src/
│   ├── device/              ← vista del actor (/device/[roomId])
│   │   ├── index.html
│   │   ├── app.js           ← stub, falta conectar Supabase Realtime
│   │   └── style.css
│   └── control/              ← vista del director (/control)
│       ├── index.html
│       ├── app.js           ← stub, falta conectar Supabase
│       └── style.css
```

## Cómo empezar con Claude Code

1. Copia esta carpeta completa a tu repo/proyecto local.
2. Abre Claude Code en la raíz del proyecto (el `CLAUDE.md` se lee automático).
3. Genera los iconos reales (192px y 512px, versión normal y "maskable")
   y colócalos en `public/icons/` — o pide directamente a Claude Code que
   genere placeholders con Canvas/SVG mientras tanto.
4. Primer prompt sugerido:

   > "Lee CLAUDE.md. Conecta un proyecto de Supabase: crea la tabla `messages`
   > según el modelo de datos descrito, y conecta /src/device/app.js y
   > /src/control/app.js a Supabase Realtime para que los mensajes fluyan
   > en vivo entre ambas vistas."

5. Luego sigue con las fases descritas en la conversación:
   UI de chat realista → panel de control completo → integración con
   Playwright/ffmpeg.

## Nota sobre iOS

Safari no soporta bien service workers de la misma forma que Chrome/Android
para el prompt de instalación. Los meta tags `apple-mobile-web-app-capable`
ya están en `src/device/index.html`, pero en iOS el usuario debe instalar
manualmente vía "Compartir → Agregar a pantalla de inicio". Si los actores
usan iPhone, avisa a Claude Code para que valide ese flujo específicamente.

## Variables de entorno pendientes

Vas a necesitar (para cuando conectes Supabase):
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
```
No las subas al repo — usa `.env.local` + `.gitignore`, o las variables de
entorno de Vercel directamente.
