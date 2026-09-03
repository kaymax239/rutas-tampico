"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  collection, doc, onSnapshot, query, where, runTransaction,
  serverTimestamp, setDoc, type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { GPS_EXTERNOS, rutas, type GpsExterno, type Ruta, type Zona } from "./mapRutas";

type Bus = { id: string; nombre?: string; ruta?: string; lat: number; lng: number; fecha?: Timestamp };
type ModoUsuario = "chofer" | "pasajero";
type TipoRuta = "urbano" | "micro-local";
type PantallaFlujo = "tipos" | "zonas" | "rutas" | "mapa";
type EstiloMapa = "navegacion" | "normal" | "nocturno" | "barrio";
type MapaProps = {
  modoUsuario?: ModoUsuario;
  conteoUsuariosPorRuta?: Record<string, number>;
  onRutaSeleccionada?: (ruta: string | null) => void;
  onRegresarInicio?: () => void;
};
type ViajeActivo = { ruta: string; horaInicio: string; latInicio: number; lngInicio: number };
type UsuarioKm = { kmTotales: number; viajesTotales: number; nivel: string; ultimoViaje: string | null };

const USER_ID_STORAGE_KEY = "rutasKaymax.userId";
const VIAJE_ACTIVO_STORAGE_KEY = "rutasKaymax.viajeActivo";
const EARTH_RADIUS_KM = 6371;
const GPS_WRITE_MS = 12000;
const GPS_WRITE_METROS = 35;
const BUS_STALE_MS = 45000;
const USUARIO_KM_INICIAL: UsuarioKm = { kmTotales: 0, viajesTotales: 0, nivel: "Nuevo pasajero", ultimoViaje: null };
const MAPAS_DISPONIBLES: Record<EstiloMapa, { label: string; url: string; attribution: string; premium?: boolean }> = {
  navegacion: { label: "Navegación", url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", attribution: "&copy; OpenStreetMap &copy; CARTO" },
  normal: { label: "Mapa normal", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attribution: "&copy; OpenStreetMap &copy; CARTO" },
  nocturno: { label: "Mapa nocturno", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: "&copy; OpenStreetMap &copy; CARTO", premium: true },
  barrio: { label: "Mapa barrio", url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", attribution: "&copy; OpenStreetMap contributors, Tiles style by HOT" },
};

function crearUserId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function obtenerOCrearUserId() {
  const existente = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (existente) return existente;
  const id = crearUserId();
  localStorage.setItem(USER_ID_STORAGE_KEY, id);
  return id;
}
function leerViajeActivo(): ViajeActivo | null {
  const guardado = localStorage.getItem(VIAJE_ACTIVO_STORAGE_KEY);
  if (!guardado) return null;
  try {
    const parsed = JSON.parse(guardado) as Partial<ViajeActivo>;
    if (typeof parsed.ruta === "string" && typeof parsed.horaInicio === "string" && typeof parsed.latInicio === "number" && typeof parsed.lngInicio === "number") {
      return { ruta: parsed.ruta, horaInicio: parsed.horaInicio, latInicio: parsed.latInicio, lngInicio: parsed.lngInicio };
    }
  } catch { return null; }
  return null;
}
function guardarViajeActivo(viaje: ViajeActivo) { localStorage.setItem(VIAJE_ACTIVO_STORAGE_KEY, JSON.stringify(viaje)); }
function limpiarViajeActivo() { localStorage.removeItem(VIAJE_ACTIVO_STORAGE_KEY); }
function obtenerNivel(km: number) {
  if (km >= 1000) return "Leyenda del micro";
  if (km >= 500) return "Explorador Tampico";
  if (km >= 100) return "Pasajero frecuente";
  return "Nuevo pasajero";
}
function redondearKm(km: number) { return Math.round(km * 100) / 100; }
function distanciaHaversineKm(a: [number, number], b: [number, number]) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function calcularDistanciaRutaKm(puntos: [number, number][]) {
  return puntos.reduce((t, p, i) => (i === 0 ? t : t + distanciaHaversineKm(puntos[i - 1], p)), 0);
}
function calcularKilometrajeViaje(ruta: string, inicio: [number, number], fin: [number, number]) {
  const reg = rutas.find((item) => item.nombre === ruta);
  const kmRuta = reg ? calcularDistanciaRutaKm(reg.puntos) : 0;
  if (kmRuta > 0) return { kmCalculados: redondearKm(kmRuta), metodoCalculo: "ruta" as const };
  return { kmCalculados: redondearKm(distanciaHaversineKm(inicio, fin)), metodoCalculo: "haversine" as const };
}
function obtenerPosicionActual() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Geolocalizacion no disponible")); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  });
}
function obtenerNumero(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function normalizarUltimoViaje(value: unknown) {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}
function formatearUltimoViaje(value: string | null) {
  if (!value) return "Sin viajes";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return "Sin viajes";
  return fecha.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}
function obtenerEtiquetaZona(zona: Zona) { return zona === "Zona Norte / Altamira" ? "Zona Norte" : zona; }
function obtenerEtiquetaTipoRuta(tipo: TipoRuta | null) {
  if (tipo === "urbano") return "Rutas urbano";
  if (tipo === "micro-local") return "Rutas micro/local";
  return "Todas las rutas";
}
function obtenerTipoRuta(ruta: Ruta): TipoRuta { return /^ruta\s+\d+/i.test(ruta.nombre) ? "urbano" : "micro-local"; }
function normalizarNombreRuta(nombre: string) {
  return nombre.toLowerCase().split("-").map((p) => p.trim()).filter(Boolean).sort().join(" - ");
}

const busIcon = new L.DivIcon({ html: `<div class="rt-bus-marker" aria-hidden="true"><span class="rt-bus-marker__pulse"></span><div class="rt-bus-marker__body">🚌</div></div>`, className: "", iconSize: [44, 44], iconAnchor: [22, 24], popupAnchor: [0, -20] });
const miUbicacionIcon = new L.DivIcon({ html: `<div class="rt-location-marker" aria-hidden="true"><span></span></div>`, className: "", iconSize: [28, 28], iconAnchor: [14, 14] });
const gpsExternoIcon = new L.DivIcon({ html: `<div class="rt-gps-marker" aria-hidden="true"><div class="rt-gps-marker__body">📡</div></div>`, className: "", iconSize: [40, 40], iconAnchor: [20, 24], popupAnchor: [0, -20] });

function GpsExternoMarker({ gps }: { gps: GpsExterno }) {
  return (
    <Marker position={[gps.lat, gps.lng]} icon={gpsExternoIcon} riseOnHover>
      <Popup>
        <b>{gps.nombre}</b><br />Ruta: {gps.ruta}<br />Origen: GPS Steren<br />
        <button type="button" onClick={() => window.open(gps.urlRastreador, "_blank", "noopener,noreferrer")}>Ver ubicación en tiempo real</button>
      </Popup>
    </Marker>
  );
}
function BusAnimado({ bus }: { bus: Bus }) {
  return (
    <Marker position={[bus.lat, bus.lng]} icon={busIcon} riseOnHover>
      <Popup><b>{bus.nombre}</b><br />Ruta: {bus.ruta}<br />Ubicación reportada en vivo</Popup>
    </Marker>
  );
}
function AjustarMapa({ ubicacion, recargarCentro }: { ubicacion: [number, number] | null; recargarCentro: number }) {
  const map = useMap();
  const yaCentrado = useRef(false);
  const ultimo = useRef(0);
  useEffect(() => {
    if (!ubicacion) return;
    if (yaCentrado.current && recargarCentro === ultimo.current) return;
    map.flyTo(ubicacion, 15, { duration: 0.7 });
    yaCentrado.current = true;
    ultimo.current = recargarCentro;
  }, [ubicacion, map, recargarCentro]);
  return null;
}

const btnBig = { padding: 22, borderRadius: 20, border: "none", color: "white", fontSize: 22, fontWeight: 800, cursor: "pointer" };
const btnBack = { padding: 14, borderRadius: 999, border: "none", background: "white", color: "#111827", fontWeight: 800, cursor: "pointer" };

export default function Mapa({ modoUsuario = "pasajero", conteoUsuariosPorRuta = {}, onRutaSeleccionada, onRegresarInicio }: MapaProps) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [ubicacion, setUbicacion] = useState<[number, number] | null>(null);
  const [zonaSeleccionada, setZonaSeleccionada] = useState<Zona>("Tampico / Madero");
  const [tipoRutaSeleccionado, setTipoRutaSeleccionado] = useState<TipoRuta | null>(null);
  const [rutaSeleccionada, setRutaSeleccionada] = useState("");
  const [pantallaFlujo, setPantallaFlujo] = useState<PantallaFlujo>(modoUsuario === "chofer" ? "tipos" : "zonas");
  const [userId, setUserId] = useState<string | null>(null);
  const [viajeActivo, setViajeActivo] = useState<ViajeActivo | null>(null);
  const [usuarioKm, setUsuarioKm] = useState<UsuarioKm>(USUARIO_KM_INICIAL);
  const [procesandoViaje, setProcesandoViaje] = useState(false);
  const [mostrarDetalleKm, setMostrarDetalleKm] = useState(false);
  const [mostrarOpcionesMapa, setMostrarOpcionesMapa] = useState(false);
  const [estiloMapa, setEstiloMapa] = useState<EstiloMapa>("navegacion");
  const [rastreandoGPS, setRastreandoGPS] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastWriteRef = useRef({ t: 0, lat: 0, lng: 0 });
  const [recargarCentro, setRecargarCentro] = useState(0);

  useEffect(() => () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); }, []);

  useEffect(() => {
    if (!rutaSeleccionada) { setBuses([]); return; }
    const unsub = onSnapshot(query(collection(db, "autobuses"), where("ruta", "==", rutaSeleccionada)), (snapshot) => {
      const ahora = Date.now();
      setBuses(snapshot.docs.map((d) => {
        const x = d.data();
        return { id: d.id, nombre: String(x.nombre || x.ruta || "Autobús"), ruta: String(x.ruta || x.nombre || "Sin ruta"), lat: Number(x.lat), lng: Number(x.lng), fecha: x.fecha };
      }).filter((b) => !Number.isNaN(b.lat) && !Number.isNaN(b.lng) && b.fecha?.toDate && ahora - b.fecha.toDate().getTime() <= BUS_STALE_MS));
    });
    return () => unsub();
  }, [rutaSeleccionada]);

  useEffect(() => { const id = obtenerOCrearUserId(); setUserId(id); setViajeActivo(leerViajeActivo()); }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "usuariosKm", userId), (snapshot) => {
      if (!snapshot.exists()) { setUsuarioKm(USUARIO_KM_INICIAL); return; }
      const data = snapshot.data();
      const kmTotales = obtenerNumero(data.kmTotales);
      setUsuarioKm({ kmTotales, viajesTotales: obtenerNumero(data.viajesTotales), nivel: typeof data.nivel === "string" && data.nivel ? data.nivel : obtenerNivel(kmTotales), ultimoViaje: normalizarUltimoViaje(data.ultimoViaje) });
    });
    return () => unsub();
  }, [userId]);

  const rutasDeZona = useMemo(() => rutas.filter((r) => r.zona === zonaSeleccionada && (!tipoRutaSeleccionado || obtenerTipoRuta(r) === tipoRutaSeleccionado)), [tipoRutaSeleccionado, zonaSeleccionada]);
  const busesFiltrados = useMemo(() => {
    if (!rutaSeleccionada) return [];
    const objetivo = normalizarNombreRuta(rutaSeleccionada);
    return buses.filter((b) => normalizarNombreRuta(String(b.ruta || b.nombre || "")) === objetivo);
  }, [buses, rutaSeleccionada]);

  const mapaActual = MAPAS_DISPONIBLES[estiloMapa];
  const kilometrosUsuario = obtenerNumero(usuarioKm.kmTotales);
  const nocturnoDesbloqueado = kilometrosUsuario >= 100;
  const rutaMapaSeleccionada = rutasDeZona.find((r) => r.nombre === rutaSeleccionada);
  const usuariosRutaSeleccionada = rutaSeleccionada ? conteoUsuariosPorRuta[rutaSeleccionada] || 0 : 0;

  useEffect(() => { if (estiloMapa === "nocturno" && !nocturnoDesbloqueado) setEstiloMapa("navegacion"); }, [estiloMapa, nocturnoDesbloqueado]);

  const seleccionarTipoRuta = (tipo: TipoRuta) => { setTipoRutaSeleccionado(tipo); setRutaSeleccionada(""); onRutaSeleccionada?.(null); setPantallaFlujo("zonas"); };
  const cambiarZona = (zona: Zona) => { setZonaSeleccionada(zona); setRutaSeleccionada(""); onRutaSeleccionada?.(null); setPantallaFlujo("rutas"); };
  const seleccionarRuta = (ruta: string) => { setRutaSeleccionada(ruta); onRutaSeleccionada?.(ruta); setPantallaFlujo("mapa"); };

  const obtenerMiUbicacion = () => {
    if (!navigator.geolocation) { alert("Tu navegador no soporta GPS. Usa Chrome o Safari actualizado."); return; }
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; setRastreandoGPS(false); return; }
    const choferIdActual = modoUsuario === "chofer" ? (userId || obtenerOCrearUserId()) : null;
    watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
      const lat = pos.coords.latitude; const lng = pos.coords.longitude;
      setUbicacion([lat, lng]);
      if (modoUsuario === "chofer" && choferIdActual) {
        const last = lastWriteRef.current;
        const metros = distanciaHaversineKm([last.lat, last.lng], [lat, lng]) * 1000;
        const debe = last.t === 0 || Date.now() - last.t >= GPS_WRITE_MS || metros >= GPS_WRITE_METROS;
        if (!debe) return;
        lastWriteRef.current = { t: Date.now(), lat, lng };
        void setDoc(doc(db, "autobuses", choferIdActual), { nombre: rutaSeleccionada || "Chofer", ruta: rutaSeleccionada || "Sin ruta", lat, lng, fecha: serverTimestamp() }, { merge: true }).catch(() => undefined);
      }
    }, (error) => {
      alert(error.code === 1
        ? "No se pudo activar la ubicación. Revisa permisos de GPS.\n\nEn tu celular: Configuración → Apps → Navegador → Permisos → Ubicación → Permitir."
        : "No se pudo activar la ubicación. Revisa permisos de GPS.");
      watchIdRef.current = null; setRastreandoGPS(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    setRastreandoGPS(true);
    setRecargarCentro((n) => n + 1);
  };

  const iniciarViaje = async () => {
    if (procesandoViaje) return;
    const viajeGuardado = leerViajeActivo();
    if (viajeActivo || viajeGuardado) { setViajeActivo(viajeGuardado || viajeActivo); alert("Ya tienes un viaje activo. Finalízalo antes de iniciar otro."); return; }
    if (!rutaSeleccionada) { alert("Selecciona una ruta antes de iniciar el viaje."); return; }
    setProcesandoViaje(true);
    try {
      const pos = await obtenerPosicionActual();
      const viaje = { ruta: rutaSeleccionada, horaInicio: new Date().toISOString(), latInicio: pos.coords.latitude, lngInicio: pos.coords.longitude };
      guardarViajeActivo(viaje); setViajeActivo(viaje); setUbicacion([pos.coords.latitude, pos.coords.longitude]); alert("Viaje iniciado");
    } catch { alert("No se pudo obtener tu ubicación. Activa el GPS y permite ubicación."); }
    finally { setProcesandoViaje(false); }
  };

  const finalizarViaje = async () => {
    if (procesandoViaje) return;
    const id = userId || obtenerOCrearUserId();
    const viaje = viajeActivo || leerViajeActivo();
    if (!viaje) { alert("No tienes un viaje activo para finalizar."); return; }
    setUserId(id); setProcesandoViaje(true);
    try {
      const pos = await obtenerPosicionActual();
      const latFin = pos.coords.latitude; const lngFin = pos.coords.longitude;
      const fechaFin = new Date().toISOString();
      const { kmCalculados, metodoCalculo } = calcularKilometrajeViaje(viaje.ruta, [viaje.latInicio, viaje.lngInicio], [latFin, lngFin]);
      const viajeRef = doc(collection(db, "viajesUsuarios"));
      const usuarioRef = doc(db, "usuariosKm", id);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(usuarioRef);
        const data = snap.exists() ? snap.data() : {};
        const kmTotales = redondearKm(obtenerNumero(data.kmTotales) + kmCalculados);
        const viajesTotales = obtenerNumero(data.viajesTotales) + 1;
        transaction.set(viajeRef, { userId: id, ruta: viaje.ruta, fechaInicio: viaje.horaInicio, fechaFin, latInicio: viaje.latInicio, lngInicio: viaje.lngInicio, latFin, lngFin, kmCalculados, metodoCalculo, fechaCreacion: serverTimestamp() });
        transaction.set(usuarioRef, { userId: id, kmTotales, viajesTotales, nivel: obtenerNivel(kmTotales), ultimoViaje: fechaFin, fechaActualizacion: serverTimestamp() }, { merge: true });
      });
      limpiarViajeActivo(); setViajeActivo(null); setUbicacion([latFin, lngFin]); alert(`Viaje finalizado. Sumaste ${kmCalculados.toFixed(2)} km.`);
    } catch { alert("No se pudo finalizar el viaje. Intenta otra vez."); }
    finally { setProcesandoViaje(false); }
  };

  if (pantallaFlujo === "tipos") {
    return (
      <div style={{ height: "100vh", background: "#0f172a", display: "flex", flexDirection: "column", justifyContent: "center", padding: 24, gap: 18 }}>
        <h1 style={{ color: "white", textAlign: "center", fontSize: 28, fontWeight: 800, margin: 0 }}>Soy Chofer</h1>
        <p style={{ color: "#cbd5e1", textAlign: "center", margin: 0 }}>Selecciona el tipo de rutas que quieres ver.</p>
        <button onClick={() => seleccionarTipoRuta("urbano")} style={{ ...btnBig, background: "#22c55e" }}>Rutas urbano</button>
        <button onClick={() => seleccionarTipoRuta("micro-local")} style={{ ...btnBig, background: "#2563eb" }}>Rutas micro/local</button>
        <button onClick={onRegresarInicio} style={btnBack}>← Regresar</button>
      </div>
    );
  }
  if (pantallaFlujo === "zonas") {
    return (
      <div style={{ height: "100vh", background: "#0f172a", display: "flex", flexDirection: "column", justifyContent: "center", padding: 24, gap: 18 }}>
        <h1 style={{ color: "white", textAlign: "center", fontSize: 28, fontWeight: 800, margin: 0 }}>Selecciona tu zona</h1>
        <p style={{ color: "#cbd5e1", textAlign: "center", margin: 0 }}>{obtenerEtiquetaTipoRuta(tipoRutaSeleccionado)}</p>
        <button onClick={() => cambiarZona("Tampico / Madero")} style={{ ...btnBig, background: "#22c55e" }}>📍 Tampico / Madero</button>
        <button onClick={() => cambiarZona("Zona Norte / Altamira")} style={{ ...btnBig, background: "#2563eb" }}>📍 Zona Norte</button>
        <button onClick={modoUsuario === "chofer" ? () => { setTipoRutaSeleccionado(null); setRutaSeleccionada(""); onRutaSeleccionada?.(null); setPantallaFlujo("tipos"); } : onRegresarInicio} style={btnBack}>← Regresar</button>
      </div>
    );
  }
  if (pantallaFlujo === "rutas") {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", padding: 24, color: "white" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{obtenerEtiquetaTipoRuta(tipoRutaSeleccionado)}</h1>
        <p style={{ color: "#cbd5e1", marginBottom: 20 }}>Zona: {obtenerEtiquetaZona(zonaSeleccionada)}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rutasDeZona.length === 0 && <div style={{ border: "1px solid rgba(148,163,184,.35)", borderRadius: 18, color: "#cbd5e1", padding: 18 }}>No hay rutas en esta selección.</div>}
          {rutasDeZona.map((ruta) => (
            <button key={ruta.nombre} onClick={() => seleccionarRuta(ruta.nombre)} style={{ padding: 18, borderRadius: 18, border: "none", background: ruta.color, color: "white", fontSize: 18, fontWeight: 800, textAlign: "left", cursor: "pointer" }}>
              <span style={{ display: "block" }}>🚍 {ruta.nombre}</span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, marginTop: 6, opacity: 0.9 }}>👥 {conteoUsuariosPorRuta[ruta.nombre] || 0} usuarios en esta ruta</span>
            </button>
          ))}
        </div>
        <button onClick={() => { setRutaSeleccionada(""); onRutaSeleccionada?.(null); setPantallaFlujo("zonas"); }} style={{ ...btnBack, marginTop: 20, width: "100%" }}>← Regresar</button>
      </div>
    );
  }

  return (
    <div className="rt-map-shell">
      <div className="rt-map-panel">
        <div className="rt-map-panel__main">
          <div className="rt-route-color" style={{ background: rutaMapaSeleccionada?.color || "#38bdf8" }} />
          <div className="rt-route-copy"><span className="rt-route-kicker">Modo navegación</span><strong>{rutaSeleccionada || "Ruta seleccionada"}</strong></div>
          <button type="button" onClick={() => { setRutaSeleccionada(""); onRutaSeleccionada?.(null); setPantallaFlujo("rutas"); }} className="rt-mini-pill">Cambiar ruta</button>
        </div>
        <div className="rt-map-panel__stats">
          <span>Zona: {obtenerEtiquetaZona(zonaSeleccionada)}</span>
          <span>Usuarios: {usuariosRutaSeleccionada}</span>
          <span>Camiones: {busesFiltrados.length}</span>
        </div>
        <div className="rt-trip-actions">
          <button type="button" onClick={() => setMostrarDetalleKm((p) => !p)} className="rt-trip-button rt-trip-button--ghost">{kilometrosUsuario.toFixed(2)} km</button>
          <button type="button" onClick={iniciarViaje} disabled={procesandoViaje || Boolean(viajeActivo)} className="rt-trip-button rt-trip-button--start">Iniciar</button>
          <button type="button" onClick={finalizarViaje} disabled={procesandoViaje || !viajeActivo} className="rt-trip-button rt-trip-button--end">Finalizar</button>
        </div>
        {mostrarDetalleKm && (
          <div className="rt-km-detail">
            <div>Km totales: {kilometrosUsuario.toFixed(2)}</div>
            <div>Viajes totales: {usuarioKm.viajesTotales}</div>
            <div>Nivel: {usuarioKm.nivel}</div>
            <div>Último viaje: {formatearUltimoViaje(usuarioKm.ultimoViaje)}</div>
            {viajeActivo && <div>Viaje activo: {viajeActivo.ruta}</div>}
          </div>
        )}
      </div>
      <div className="rt-floating-controls">
        {mostrarOpcionesMapa && (
          <div className="rt-map-style-menu">
            <div className="rt-map-style-menu__title">Estilo de mapa</div>
            {(Object.keys(MAPAS_DISPONIBLES) as EstiloMapa[]).map((mapa) => {
              const opcion = MAPAS_DISPONIBLES[mapa];
              const bloqueado = Boolean(opcion.premium && !nocturnoDesbloqueado);
              return (
                <button key={mapa} type="button" disabled={bloqueado} onClick={() => { if (bloqueado) return; setEstiloMapa(mapa); setMostrarOpcionesMapa(false); }} className={estiloMapa === mapa ? "rt-map-style-option rt-map-style-option--active" : "rt-map-style-option"}>
                  <span>{opcion.label}</span>{bloqueado && <small>Bloqueado · 100 km</small>}
                </button>
              );
            })}
            {!nocturnoDesbloqueado && <p>Nocturno se desbloquea al llegar a 100 km. Km actuales: {kilometrosUsuario.toFixed(2)}</p>}
          </div>
        )}
        <button type="button" onClick={onRegresarInicio} disabled={!onRegresarInicio} className="rt-fab" aria-label="Volver al inicio"><span>Inicio</span></button>
        <button type="button" onClick={() => setMostrarOpcionesMapa((p) => !p)} className="rt-fab rt-fab--dark" aria-label="Cambiar mapa"><span>Mapa</span></button>
        <button type="button" onClick={obtenerMiUbicacion} className={rastreandoGPS ? "rt-fab rt-fab--primary rt-fab--active" : "rt-fab rt-fab--primary"} aria-label={rastreandoGPS ? "Detener GPS" : "Activar GPS"}><span>{rastreandoGPS ? "GPS ●" : "GPS"}</span></button>
      </div>
      <MapContainer center={[22.2553, -97.8686]} zoom={13} scrollWheelZoom zoomControl={false} style={{ width: "100%", height: "100%" }}>
        <AjustarMapa ubicacion={ubicacion} recargarCentro={recargarCentro} />
        <TileLayer key={estiloMapa} attribution={mapaActual.attribution} url={mapaActual.url} />
        {rutasDeZona.filter((r) => r.nombre === rutaSeleccionada).map((ruta) => (
          <Fragment key={ruta.nombre}>
            <Polyline positions={ruta.puntos} pathOptions={{ color: estiloMapa === "nocturno" ? "#020617" : "#ffffff", weight: 13, opacity: estiloMapa === "nocturno" ? 0.8 : 0.92, lineCap: "round", lineJoin: "round" }} />
            <Polyline positions={ruta.puntos} pathOptions={{ color: ruta.color, weight: 7, opacity: 1, lineCap: "round", lineJoin: "round" }} />
          </Fragment>
        ))}
        {ubicacion && <Marker position={ubicacion} icon={miUbicacionIcon}><Popup>Estás aquí</Popup></Marker>}
        {busesFiltrados.map((bus) => <BusAnimado key={bus.id} bus={bus} />)}
        {rutaSeleccionada && GPS_EXTERNOS.filter((gps) => normalizarNombreRuta(gps.ruta) === normalizarNombreRuta(rutaSeleccionada)).map((gps) => <GpsExternoMarker key={gps.id} gps={gps} />)}
      </MapContainer>
    </div>
  );
}
