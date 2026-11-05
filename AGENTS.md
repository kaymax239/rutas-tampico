<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This repo holds **two independent Next.js 16 apps** (npm, not a workspace — each has its own `node_modules`/`package-lock.json`):

- **`/` (`rutas-tampico`)** — primary product: a live bus-route app for Tampico (Chofer/Pasajero modes, Leaflet map, route suggestions). Uses **Firebase Firestore** for live presence/suggestions; the config is hardcoded in `app/firebase.ts`, so **no env vars/secrets are needed**, but live features require outbound internet. `next.config.js` sets `output: "export"` (static export to `out/`, used by the Capacitor Android wrapper in `android/`).
- **`planeaciones-nautica/`** — secondary product: a client-side Word-doc (`.docx`) generator (`docxtemplater`); no backend/DB.

Notes for running (standard scripts live in each `package.json`: `dev`/`build`/`start`/`lint`):
- Both apps default to **port 3000** — run one at a time or use `npm run dev -- -p <port>`.
- Running `planeaciones-nautica` while the root lockfile is present prints a harmless "multiple lockfiles / inferred workspace root" warning.
- **No test scripts exist** in either package.
- `npm run lint` in the root currently reports 2 **pre-existing** `react-hooks/set-state-in-effect` errors in `app/Mapa.tsx` (unrelated to environment setup); the nested app lints clean.
