// Ajusta los waypoints de cada ruta a calles reales con OSRM (perfil driving).
// Uso: node scripts/snap-routes.mjs   (OSRM_URL opcional; caché en scripts/cache/)
// Entrada: scripts/rutas-fuente.json  Salida: app/data/rutas.json, public/rutas.geojson, scripts/snap-report.md
import fs from "node:fs";
import crypto from "node:crypto";
const OSRM = process.env.OSRM_URL || "https://router.project-osrm.org";
const fuente = JSON.parse(fs.readFileSync("scripts/rutas-fuente.json", "utf8"));
fs.mkdirSync("scripts/cache", { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hav = (a, b) => { const R = 6371, t = (x) => (x * Math.PI) / 180; const dLa = t(b[0] - a[0]), dLo = t(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(t(a[0])) * Math.cos(t(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const largo = (p) => p.reduce((s, x, i) => (i ? s + hav(p[i - 1], x) : 0), 0);
const features = [], filas = [];
for (const r of fuente) {
  const coords = r.puntos.map(([la, lo]) => `${lo},${la}`).join(";");
  const url = `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const f = `scripts/cache/${crypto.createHash("sha1").update(url).digest("hex").slice(0, 16)}.json`;
  let data;
  if (fs.existsSync(f)) data = JSON.parse(fs.readFileSync(f, "utf8"));
  else {
    for (let i = 0; i < 3 && !data; i++) {
      try { const res = await fetch(url, { headers: { "User-Agent": "rutas-tampico-snap/1.0" } });
        if (res.ok) data = await res.json(); else await sleep(3000); } catch { await sleep(3000); }
    }
    if (data) fs.writeFileSync(f, JSON.stringify(data));
    await sleep(1100);
  }
  const recto = largo(r.puntos);
  let geom = r.puntos.map(([la, lo]) => [lo, la]), km = recto, estado = "sin-osrm", ratio = 1;
  if (data?.code === "Ok") {
    geom = data.routes[0].geometry.coordinates.map(([lo, la]) => [+lo.toFixed(6), +la.toFixed(6)]);
    km = data.routes[0].distance / 1000; ratio = km / recto;
    const maxSnap = Math.max(...data.waypoints.map((w) => w.distance));
    estado = ratio > 2.5 ? "revisar-desvio" : maxSnap > 300 ? "revisar-snap-lejano" : "ok";
    filas.push({ n: r.nombre, recto, km, ratio, maxSnap, estado });
  } else filas.push({ n: r.nombre, recto, km, ratio, maxSnap: 0, estado });
  features.push({ type: "Feature", properties: { nombre: r.nombre, zona: r.zona, color: r.color, waypoints: r.puntos,
    kmTrazo: +km.toFixed(2), kmRecto: +recto.toFixed(2), ratio: +ratio.toFixed(2), estado }, geometry: { type: "LineString", coordinates: geom } });
  console.log(estado.padEnd(20), ratio.toFixed(2), r.nombre);
}
const fc = { type: "FeatureCollection", features };
fs.writeFileSync("app/data/rutas.json", JSON.stringify(fc));
fs.writeFileSync("public/rutas.geojson", JSON.stringify(fc));
const md = ["# Reporte de ajuste a calles (OSRM)", "", "Criterio: `revisar-desvio` si km trazo > 2.5× km línea recta; `revisar-snap-lejano` si algún waypoint quedó a >300 m de una calle.", "",
  "| Ruta | km recto | km trazo | ratio | snap máx (m) | estado |", "|---|---|---|---|---|---|",
  ...filas.map((x) => `| ${x.n} | ${x.recto.toFixed(2)} | ${x.km.toFixed(2)} | ${x.ratio.toFixed(2)} | ${Math.round(x.maxSnap)} | ${x.estado} |`)];
fs.writeFileSync("scripts/snap-report.md", md.join("\n") + "\n");
