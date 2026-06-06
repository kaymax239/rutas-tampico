<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This repository contains **two independent Next.js 16 apps** (each has its own `package.json` and `package-lock.json`). Use **npm** in both directories.

| App | Directory | Default dev URL |
|-----|-----------|-----------------|
| Rutas Kaymax (transit map) | `/workspace` | http://localhost:3000 |
| Planeaciones Náutica (F-32 doc generator) | `/workspace/planeaciones-nautica` | http://localhost:3001 (use `-p 3001` to avoid port clash) |

### Common commands

See each app's `package.json` scripts. Typical workflow:

- **Root:** `npm run dev`, `npm run build`, `npm run lint`
- **Planeaciones:** `cd planeaciones-nautica && npm run dev -- -p 3001` (and same `build` / `lint` there)

### Rutas Kaymax notes

- Static export (`output: "export"` in `next.config.js`); production output is `out/`.
- **Firebase Firestore** is required at runtime for live bus positions, online user counts, and suggestions. Config is hardcoded in `app/firebase.ts` (project `rutas-de-autobuses`). No emulator is configured.
- Map tiles load from CARTO/OpenStreetMap CDNs (network required).
- `npm run lint` currently reports 2 pre-existing `react-hooks/set-state-in-effect` errors in `app/Mapa.tsx`; builds still succeed.

### Planeaciones Náutica notes

- Fully client-side; curriculum data lives under `app/data/`.
- `public/templates/F-32.docx` is **not in the repo** — Word export fails without that template file.
- When both apps run in dev, Next.js may warn about multiple lockfiles; set `turbopack.root` in `planeaciones-nautica/next.config.ts` if you need to silence it.

### Android / Capacitor (optional)

Native builds: `npm run build` → `npx cap sync` → Gradle in `android/`. Not needed for web development.
