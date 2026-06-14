"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

type Bus = {
  id: string;
  nombre?: string;
  ruta?: string;
  lat: number;
  lng: number;
  fecha?: Timestamp;
};

type Zona = "Tampico / Madero" | "Zona Norte / Altamira";

type Ruta = {
  zona: Zona;
  nombre: string;
  color: string;
  puntos: [number, number][];
};

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

type MetodoCalculo = "ruta" | "haversine";

type ViajeActivo = {
  ruta: string;
  horaInicio: string;
  latInicio: number;
  lngInicio: number;
};

type UsuarioKm = {
  kmTotales: number;
  viajesTotales: number;
  nivel: string;
  ultimoViaje: string | null;
};

const USER_ID_STORAGE_KEY = "rutasKaymax.userId";
const VIAJE_ACTIVO_STORAGE_KEY = "rutasKaymax.viajeActivo";
const EARTH_RADIUS_KM = 6371;
const USUARIO_KM_INICIAL: UsuarioKm = {
  kmTotales: 0,
  viajesTotales: 0,
  nivel: "Nuevo pasajero",
  ultimoViaje: null,
};
const MAPAS_DISPONIBLES: Record<
  EstiloMapa,
  { label: string; url: string; attribution: string; premium?: boolean }
> = {
  navegacion: {
    label: "Navegación",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  normal: {
    label: "Mapa normal",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  nocturno: {
    label: "Mapa nocturno",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    premium: true,
  },
  barrio: {
    label: "Mapa barrio",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, Tiles style by HOT",
  },
};

function crearUserId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function obtenerOCrearUserId() {
  const existente = localStorage.getItem(USER_ID_STORAGE_KEY);

  if (existente) return existente;

  const nuevoUserId = crearUserId();
  localStorage.setItem(USER_ID_STORAGE_KEY, nuevoUserId);

  return nuevoUserId;
}

function leerViajeActivo(): ViajeActivo | null {
  const guardado = localStorage.getItem(VIAJE_ACTIVO_STORAGE_KEY);

  if (!guardado) return null;

  try {
    const parsed = JSON.parse(guardado) as Partial<ViajeActivo>;

    if (
      typeof parsed.ruta === "string" &&
      typeof parsed.horaInicio === "string" &&
      typeof parsed.latInicio === "number" &&
      typeof parsed.lngInicio === "number"
    ) {
      return {
        ruta: parsed.ruta,
        horaInicio: parsed.horaInicio,
        latInicio: parsed.latInicio,
        lngInicio: parsed.lngInicio,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function guardarViajeActivo(viaje: ViajeActivo) {
  localStorage.setItem(VIAJE_ACTIVO_STORAGE_KEY, JSON.stringify(viaje));
}

function limpiarViajeActivo() {
  localStorage.removeItem(VIAJE_ACTIVO_STORAGE_KEY);
}

function obtenerNivel(kmTotales: number) {
  if (kmTotales >= 1000) return "Leyenda del micro";
  if (kmTotales >= 500) return "Explorador Tampico";
  if (kmTotales >= 100) return "Pasajero frecuente";

  return "Nuevo pasajero";
}

function redondearKm(km: number) {
  return Math.round(km * 100) / 100;
}

function distanciaHaversineKm(
  inicio: [number, number],
  fin: [number, number]
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const [lat1, lng1] = inicio;
  const [lat2, lng2] = fin;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

function calcularDistanciaRutaKm(puntos: [number, number][]) {
  if (puntos.length < 2) return 0;

  return puntos.reduce((total, punto, index) => {
    if (index === 0) return total;

    return total + distanciaHaversineKm(puntos[index - 1], punto);
  }, 0);
}

function calcularKilometrajeViaje(
  ruta: string,
  inicio: [number, number],
  fin: [number, number]
): { kmCalculados: number; metodoCalculo: MetodoCalculo } {
  const rutaRegistrada = rutas.find((item) => item.nombre === ruta);
  const kmRuta = rutaRegistrada ? calcularDistanciaRutaKm(rutaRegistrada.puntos) : 0;

  if (kmRuta > 0) {
    return {
      kmCalculados: redondearKm(kmRuta),
      metodoCalculo: "ruta",
    };
  }

  return {
    kmCalculados: redondearKm(distanciaHaversineKm(inicio, fin)),
    metodoCalculo: "haversine",
  };
}

function obtenerPosicionActual() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalizacion no disponible"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

function obtenerNumero(value: unknown) {
  const numero = Number(value);

  return Number.isFinite(numero) ? numero : 0;
}

function normalizarUltimoViaje(value: unknown) {
  if (typeof value === "string" && value) return value;

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }

  return null;
}

function formatearUltimoViaje(value: string | null) {
  if (!value) return "Sin viajes";

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) return "Sin viajes";

  return fecha.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function obtenerEtiquetaZona(zona: Zona) {
  return zona === "Zona Norte / Altamira" ? "Zona Norte" : zona;
}

function obtenerEtiquetaTipoRuta(tipo: TipoRuta | null) {
  if (tipo === "urbano") return "Rutas urbano";
  if (tipo === "micro-local") return "Rutas micro/local";

  return "Todas las rutas";
}

function obtenerTipoRuta(ruta: Ruta): TipoRuta {
  return /^ruta\s+\d+/i.test(ruta.nombre) ? "urbano" : "micro-local";
}

const busIcon = new L.DivIcon({
  html: `
    <div class="rt-bus-marker" aria-hidden="true">
      <span class="rt-bus-marker__pulse"></span>
      <div class="rt-bus-marker__body">
        <svg viewBox="0 0 48 48" role="img" focusable="false">
          <path d="M12 9h24c4 0 7 3 7 7v15c0 3-2 6-5 7l-1 3a3 3 0 0 1-3 2h-1a3 3 0 0 1-3-3v-1H18v1a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-2l-1-3c-3-1-5-4-5-7V16c0-4 3-7 7-7Z" fill="currentColor"/>
          <path d="M11 17c0-2 1-3 3-3h20c2 0 3 1 3 3v8H11v-8Z" fill="white" opacity=".92"/>
          <path d="M14 29h20" stroke="white" stroke-width="3" stroke-linecap="round" opacity=".78"/>
          <circle cx="15" cy="34" r="3" fill="#0f172a"/>
          <circle cx="33" cy="34" r="3" fill="#0f172a"/>
          <path d="M17 14h14" stroke="#0f172a" stroke-width="2" stroke-linecap="round" opacity=".35"/>
        </svg>
      </div>
    </div>
  `,
  className: "",
  iconSize: [56, 56],
  iconAnchor: [28, 31],
  popupAnchor: [0, -26],
});

const miUbicacionIcon = new L.DivIcon({
  html: `
    <div class="rt-location-marker" aria-hidden="true">
      <span></span>
    </div>
  `,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const rutas: Ruta[] = [
  {
    zona: "Tampico / Madero",
    nombre: "Candelario Garza",
    color: "#f59e0b",
    puntos: [
      [22.2553, -97.8686],
      [22.263, -97.857],
      [22.272, -97.846],
      [22.281, -97.836],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Serapio Venegas",
    color: "#a855f7",
    puntos: [
      [22.244, -97.862],
      [22.251, -97.851],
      [22.259, -97.839],
      [22.268, -97.828],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Haciendas",
    color: "#22c55e",
    puntos: [
      [22.2553, -97.8686],
      [22.2605, -97.8601],
      [22.266, -97.852],
      [22.273, -97.845],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Niños Héroes",
    color: "#3b82f6",
    puntos: [
      [22.243, -97.865],
      [22.2505, -97.858],
      [22.257, -97.849],
      [22.265, -97.841],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Circuito Norte",
    color: "#f97316",
    puntos: [
      [22.275, -97.895],
      [22.282, -97.881],
      [22.287, -97.865],
      [22.292, -97.849],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Tampico - Madero",
    color: "#a855f7",
    puntos: [
      [22.2553, -97.8686],
      [22.244, -97.849],
      [22.236, -97.836],
      [22.225, -97.821],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Borreguera",
    color: "#eab308",
    puntos: [
      [22.255, -97.868],
      [22.264, -97.878],
      [22.274, -97.888],
      [22.283, -97.899],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Tancol",
    color: "#06b6d4",
    puntos: [
      [22.255, -97.868],
      [22.27, -97.86],
      [22.285, -97.852],
      [22.302, -97.845],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Playa Norte",
    color: "#0ea5e9",
    puntos: [
      [22.2553, -97.8686],
      [22.248, -97.844],
      [22.24, -97.826],
      [22.233, -97.807],
      [22.229, -97.79],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Águila - Madero",
    color: "#84cc16",
    puntos: [
      [22.216, -97.858],
      [22.225, -97.847],
      [22.235, -97.833],
      [22.244, -97.82],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Madero - Borreguera",
    color: "#f43f5e",
    puntos: [
      [22.244, -97.82],
      [22.25, -97.842],
      [22.262, -97.866],
      [22.276, -97.889],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Tampico - Fovissste - Playa",
    color: "#6366f1",
    puntos: [
      [22.216, -97.858],
      [22.226, -97.846],
      [22.236, -97.828],
      [22.245, -97.805],
      [22.255, -97.785],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Germinal - Boulevard",
    color: "#ec4899",
    puntos: [
      [22.233, -97.86],
      [22.24, -97.846],
      [22.247, -97.831],
      [22.255, -97.816],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Bosque - Boulevard",
    color: "#10b981",
    puntos: [
      [22.246, -97.875],
      [22.252, -97.858],
      [22.26, -97.84],
      [22.269, -97.824],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Tampico - Valle",
    color: "#f59e0b",
    puntos: [
      [22.216, -97.858],
      [22.228, -97.866],
      [22.241, -97.875],
      [22.255, -97.884],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Tampico - Niños Héroes - Isleta",
    color: "#14b8a6",
    puntos: [
      [22.216, -97.858],
      [22.228, -97.862],
      [22.242, -97.865],
      [22.257, -97.849],
      [22.269, -97.836],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Madero - Ganadera - Niños Héroes",
    color: "#8b5cf6",
    puntos: [
      [22.244, -97.82],
      [22.252, -97.835],
      [22.26, -97.85],
      [22.268, -97.865],
      [22.276, -97.878],
    ],
  },
  // Rutas solicitadas para publicar en Vercel: 1, 7, 8, 16, 24, 35, 38 y 39.
  {
    zona: "Tampico / Madero",
    nombre: "Ruta 1 - Mirador / Aviación / Boulevard",
    color: "#ef4444",
    puntos: [
      [22.2445, -97.8565],
      [22.247, -97.853],
      [22.25, -97.843],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Ruta 7 - Tampico ↔ Playa Norte por Boulevard",
    color: "#3b82f6",
    puntos: [
      [22.249, -97.857],
      [22.2565, -97.8545],
      [22.2705, -97.8392],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Ruta 8 - Seguro Social ↔ Lomas de Infonavit",
    color: "#10b981",
    puntos: [
      [22.247, -97.859],
      [22.2525, -97.851],
      [22.258, -97.847],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Ruta 16 - Ej. Contadero / Germinal / Águila",
    color: "#f59e0b",
    puntos: [
      [22.2375, -97.835],
      [22.2455, -97.848],
      [22.25, -97.859],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Ruta 24 - Tampico Tancol / Col. del Bosque",
    color: "#8b5cf6",
    puntos: [
      [22.2435, -97.8532],
      [22.2603, -97.8325],
      [22.2678, -97.828],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Ruta 35 - Madero Ganadera / Niños Héroes",
    color: "#ec4899",
    puntos: [
      [22.268, -97.828],
      [22.26, -97.8375],
      [22.252, -97.853],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Ruta 38 - Circuito Norte",
    color: "#14b8a6",
    puntos: [
      [22.269, -97.844],
      [22.2735, -97.836],
      [22.268, -97.828],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Ruta 39 - Playa Sur / Refinería Tampico",
    color: "#db2777",
    puntos: [
      [22.2745, -97.843],
      [22.267, -97.833],
      [22.254, -97.85],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Altamira - Tampico",
    color: "#ef4444",
    puntos: [
      [22.392, -97.92],
      [22.35, -97.9],
      [22.31, -97.88],
      [22.2553, -97.8686],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Altamira - Nuevo Tampico",
    color: "#f97316",
    puntos: [
      [22.392, -97.92],
      [22.37, -97.9],
      [22.34, -97.885],
      [22.31, -97.875],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Altamira - Borreguera",
    color: "#eab308",
    puntos: [
      [22.392, -97.92],
      [22.35, -97.9],
      [22.31, -97.885],
      [22.276, -97.889],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Altamira - Centro",
    color: "#22c55e",
    puntos: [
      [22.392, -97.92],
      [22.385, -97.91],
      [22.376, -97.9],
      [22.365, -97.89],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Altamira - Guadalupe Victoria",
    color: "#3b82f6",
    puntos: [
      [22.392, -97.92],
      [22.405, -97.91],
      [22.42, -97.9],
      [22.435, -97.89],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta 40 - Altamira Centro / Arboledas / Monte Alto",
    color: "#06b6d4",
    puntos: [
      [22.392, -97.938],
      [22.4035, -97.929],
      [22.415, -97.9215],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta 41 - Altamira Centro / Laguna Florida",
    color: "#22c55e",
    puntos: [
      [22.3925, -97.9385],
      [22.4015, -97.946],
      [22.41, -97.955],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta 42 - Altamira Centro / Miramar / Pedrera",
    color: "#f97316",
    puntos: [
      [22.392, -97.938],
      [22.381, -97.927],
      [22.371, -97.915],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta 43 - Monte Alto / Pedrera / Tampico",
    color: "#e11d48",
    puntos: [
      [22.417, -97.922],
      [22.404, -97.912],
      [22.36, -97.886],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta 44 - Altamira Centro / Santa Elena / Tampico",
    color: "#6366f1",
    puntos: [
      [22.392, -97.938],
      [22.373, -97.918],
      [22.336, -97.889],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta 45 - Altamira Centro / Unidos Avanzamos",
    color: "#84cc16",
    puntos: [
      [22.392, -97.938],
      [22.402, -97.951],
      [22.4135, -97.9625],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta 46 - Altamira Centro / Los Prados / Monte Alto",
    color: "#0ea5e9",
    puntos: [
      [22.392, -97.938],
      [22.405, -97.933],
      [22.418, -97.924],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta 47 - Altamira Centro / Laguna de la Puerta",
    color: "#a855f7",
    puntos: [
      [22.392, -97.938],
      [22.3815, -97.951],
      [22.372, -97.965],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta 48 - Altamira / Puerto Industrial",
    color: "#f43f5e",
    puntos: [
      [22.392, -97.938],
      [22.43, -97.9],
      [22.46, -97.875],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta 49 - Monte Alto / Puerto Industrial",
    color: "#14b8a6",
    puntos: [
      [22.417, -97.922],
      [22.438, -97.902],
      [22.46, -97.875],
    ],
  },
  // Rutas sugeridas por usuarios en Firebase, agregadas sin quitar las existentes.
  {
    zona: "Tampico / Madero",
    nombre: "Blanco Kinder",
    color: "#38bdf8",
    puntos: [
      [22.244, -97.842],
      [22.252, -97.832],
      [22.262, -97.822],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Puertas Coloradas",
    color: "#fb7185",
    puntos: [
      [22.2553, -97.8686],
      [22.244, -97.879],
      [22.232, -97.892],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Enrique Cárdenas / UAT",
    color: "#facc15",
    puntos: [
      [22.2553, -97.8686],
      [22.263, -97.858],
      [22.276, -97.849],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Madero Kehoe",
    color: "#c084fc",
    puntos: [
      [22.244, -97.82],
      [22.253, -97.811],
      [22.263, -97.802],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Águila Echeverría",
    color: "#2dd4bf",
    puntos: [
      [22.216, -97.858],
      [22.226, -97.849],
      [22.238, -97.841],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Tampico - Las Flores",
    color: "#f472b6",
    puntos: [
      [22.216, -97.858],
      [22.229, -97.85],
      [22.242, -97.84],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Altamira Av. Monterrey",
    color: "#f97316",
    puntos: [
      [22.392, -97.938],
      [22.354, -97.91],
      [22.304, -97.872],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Arboledas x Electricistas",
    color: "#65a30d",
    puntos: [
      [22.392, -97.938],
      [22.404, -97.929],
      [22.414, -97.936],
    ],
  },
  {
    zona: "Tampico / Madero",
    nombre: "Combi Bellavista",
    color: "#0f766e",
    puntos: [
      [22.216, -97.858],
      [22.224, -97.866],
      [22.233, -97.875],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Puente Las Piñas",
    color: "#2563eb",
    puntos: [
      [22.392, -97.938],
      [22.382, -97.952],
      [22.371, -97.967],
    ],
  },
];

function BusAnimado({ bus }: { bus: Bus }) {
  const posicion: [number, number] = [bus.lat, bus.lng];

  return (
    <Marker
      position={posicion}
      icon={busIcon}
      riseOnHover={true}
    >
      <Popup>
        <b>{bus.nombre}</b>
        <br />
        Ruta: {bus.ruta}
        <br />
        Ubicación reportada en vivo
      </Popup>
    </Marker>
  );
}

function AjustarMapa({ ubicacion }: { ubicacion: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (ubicacion) {
      map.flyTo(ubicacion, 15, { duration: 1 });
    }
  }, [ubicacion, map]);

  return null;
}

export default function Mapa({
  modoUsuario = "pasajero",
  conteoUsuariosPorRuta = {},
  onRutaSeleccionada,
  onRegresarInicio,
}: MapaProps) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [ubicacion, setUbicacion] = useState<[number, number] | null>(null);
  const [zonaSeleccionada, setZonaSeleccionada] =
    useState<Zona>("Tampico / Madero");
  const [tipoRutaSeleccionado, setTipoRutaSeleccionado] =
    useState<TipoRuta | null>(null);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<string>("");
  const [pantallaFlujo, setPantallaFlujo] = useState<PantallaFlujo>(
    modoUsuario === "chofer" ? "tipos" : "zonas"
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [viajeActivo, setViajeActivo] = useState<ViajeActivo | null>(null);
  const [usuarioKm, setUsuarioKm] = useState<UsuarioKm>(USUARIO_KM_INICIAL);
  const [procesandoViaje, setProcesandoViaje] = useState(false);
  const [mostrarDetalleKm, setMostrarDetalleKm] = useState(false);
  const [mostrarOpcionesMapa, setMostrarOpcionesMapa] = useState(false);
  const [estiloMapa, setEstiloMapa] = useState<EstiloMapa>("navegacion");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "autobuses"), (snapshot) => {
      const data: Bus[] = snapshot.docs
        .map((docSnap) => {
          const d = docSnap.data();

          return {
            id: docSnap.id,
            nombre: String(d.nombre || d.ruta || "Autobús"),
            ruta: String(d.ruta || d.nombre || "Sin ruta"),
            lat: Number(d.lat),
            lng: Number(d.lng),
            fecha: d.fecha,
          };
        })
        .filter((b) => {
          if (Number.isNaN(b.lat) || Number.isNaN(b.lng)) return false;

          if (!b.fecha?.toDate) return false;

          const minutos =
            (Date.now() - b.fecha.toDate().getTime()) / 1000 / 60;

          return minutos <= 30;
        });

      setBuses(data);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const id = obtenerOCrearUserId();
    setUserId(id);
    setViajeActivo(leerViajeActivo());
  }, []);

  useEffect(() => {
    if (!userId) return;

    const usuarioRef = doc(db, "usuariosKm", userId);
    const unsub = onSnapshot(usuarioRef, (snapshot) => {
      if (!snapshot.exists()) {
        setUsuarioKm(USUARIO_KM_INICIAL);
        return;
      }

      const data = snapshot.data();
      const kmTotales = obtenerNumero(data.kmTotales);
      const viajesTotales = obtenerNumero(data.viajesTotales);
      const nivel =
        typeof data.nivel === "string" && data.nivel
          ? data.nivel
          : obtenerNivel(kmTotales);

      setUsuarioKm({
        kmTotales,
        viajesTotales,
        nivel,
        ultimoViaje: normalizarUltimoViaje(data.ultimoViaje),
      });
    });

    return () => unsub();
  }, [userId]);

  const rutasDeZona = useMemo(() => {
    return rutas.filter((ruta) => {
      if (ruta.zona !== zonaSeleccionada) return false;

      return tipoRutaSeleccionado
        ? obtenerTipoRuta(ruta) === tipoRutaSeleccionado
        : true;
    });
  }, [tipoRutaSeleccionado, zonaSeleccionada]);

  const busesFiltrados = useMemo(() => {
    if (!rutaSeleccionada) return [];

    return buses.filter(
      (b) =>
        b.nombre?.toLowerCase().includes(rutaSeleccionada.toLowerCase()) ||
        b.ruta?.toLowerCase().includes(rutaSeleccionada.toLowerCase())
    );
  }, [buses, rutaSeleccionada]);

  const usuariosRutaSeleccionada = rutaSeleccionada
    ? conteoUsuariosPorRuta[rutaSeleccionada] || 0
    : 0;
  const mapaActual = MAPAS_DISPONIBLES[estiloMapa];
  const kilometrosUsuario = obtenerNumero(usuarioKm.kmTotales);
  const nocturnoDesbloqueado = kilometrosUsuario >= 100;
  const rutaMapaSeleccionada = rutasDeZona.find(
    (ruta) => ruta.nombre === rutaSeleccionada
  );

  useEffect(() => {
    if (estiloMapa === "nocturno" && !nocturnoDesbloqueado) {
      setEstiloMapa("navegacion");
    }
  }, [estiloMapa, nocturnoDesbloqueado]);

  const seleccionarTipoRuta = (tipo: TipoRuta) => {
    setTipoRutaSeleccionado(tipo);
    setRutaSeleccionada("");
    onRutaSeleccionada?.(null);
    setPantallaFlujo("zonas");
  };

  const regresarATiposRuta = () => {
    setTipoRutaSeleccionado(null);
    setRutaSeleccionada("");
    onRutaSeleccionada?.(null);
    setPantallaFlujo("tipos");
  };

  const cambiarZona = (zona: Zona) => {
    setZonaSeleccionada(zona);
    setRutaSeleccionada("");
    onRutaSeleccionada?.(null);
    setPantallaFlujo("rutas");
  };

  const seleccionarRuta = (ruta: string) => {
    setRutaSeleccionada(ruta);
    onRutaSeleccionada?.(ruta);
    setPantallaFlujo("mapa");
  };

  const regresarARutas = () => {
    setRutaSeleccionada("");
    onRutaSeleccionada?.(null);
    setPantallaFlujo("rutas");
  };

  const regresarAZonas = () => {
    setRutaSeleccionada("");
    onRutaSeleccionada?.(null);
    setPantallaFlujo("zonas");
  };

  const obtenerMiUbicacion = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no permite ubicación.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        alert("No se pudo obtener tu ubicación.");
      }
    );
  };

  const iniciarViaje = async () => {
    if (procesandoViaje) return;

    const viajeGuardado = leerViajeActivo();

    if (viajeActivo || viajeGuardado) {
      setViajeActivo(viajeGuardado || viajeActivo);
      alert("Ya tienes un viaje activo. Finalízalo antes de iniciar otro.");
      return;
    }

    if (!rutaSeleccionada) {
      alert("Selecciona una ruta antes de iniciar el viaje.");
      return;
    }

    setProcesandoViaje(true);

    try {
      const pos = await obtenerPosicionActual();
      const viaje: ViajeActivo = {
        ruta: rutaSeleccionada,
        horaInicio: new Date().toISOString(),
        latInicio: pos.coords.latitude,
        lngInicio: pos.coords.longitude,
      };

      guardarViajeActivo(viaje);
      setViajeActivo(viaje);
      setUbicacion([pos.coords.latitude, pos.coords.longitude]);
      alert("Viaje iniciado");
    } catch {
      alert("No se pudo obtener tu ubicación. Activa el GPS y permite ubicación.");
    } finally {
      setProcesandoViaje(false);
    }
  };

  const finalizarViaje = async () => {
    if (procesandoViaje) return;

    const id = userId || obtenerOCrearUserId();
    const viaje = viajeActivo || leerViajeActivo();

    if (!viaje) {
      alert("No tienes un viaje activo para finalizar.");
      return;
    }

    setUserId(id);
    setProcesandoViaje(true);

    try {
      const pos = await obtenerPosicionActual();
      const latFin = pos.coords.latitude;
      const lngFin = pos.coords.longitude;
      const fechaFin = new Date().toISOString();
      const { kmCalculados, metodoCalculo } = calcularKilometrajeViaje(
        viaje.ruta,
        [viaje.latInicio, viaje.lngInicio],
        [latFin, lngFin]
      );
      const viajeRef = doc(collection(db, "viajesUsuarios"));
      const usuarioRef = doc(db, "usuariosKm", id);

      await runTransaction(db, async (transaction) => {
        const usuarioSnapshot = await transaction.get(usuarioRef);
        const data = usuarioSnapshot.exists() ? usuarioSnapshot.data() : {};
        const kmTotalesAnteriores = obtenerNumero(data.kmTotales);
        const viajesTotalesAnteriores = obtenerNumero(data.viajesTotales);
        const kmTotales = redondearKm(kmTotalesAnteriores + kmCalculados);
        const viajesTotales = viajesTotalesAnteriores + 1;

        transaction.set(viajeRef, {
          userId: id,
          ruta: viaje.ruta,
          fechaInicio: viaje.horaInicio,
          fechaFin,
          latInicio: viaje.latInicio,
          lngInicio: viaje.lngInicio,
          latFin,
          lngFin,
          kmCalculados,
          metodoCalculo,
          fechaCreacion: serverTimestamp(),
        });

        transaction.set(
          usuarioRef,
          {
            userId: id,
            kmTotales,
            viajesTotales,
            nivel: obtenerNivel(kmTotales),
            ultimoViaje: fechaFin,
            fechaActualizacion: serverTimestamp(),
          },
          { merge: true }
        );
      });

      limpiarViajeActivo();
      setViajeActivo(null);
      setUbicacion([latFin, lngFin]);
      alert(`Viaje finalizado. Sumaste ${kmCalculados.toFixed(2)} km.`);
    } catch {
      alert("No se pudo finalizar el viaje. Intenta otra vez.");
    } finally {
      setProcesandoViaje(false);
    }
  };

  if (pantallaFlujo === "tipos") {
    return (
      <div
        style={{
          height: "100vh",
          background: "#0f172a",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 24,
          gap: 18,
        }}
      >
        <h1
          style={{
            color: "white",
            textAlign: "center",
            fontSize: 28,
            fontWeight: 800,
            margin: 0,
          }}
        >
          Soy Chofer
        </h1>

        <p style={{ color: "#cbd5e1", textAlign: "center", margin: 0 }}>
          Selecciona el tipo de rutas que quieres ver.
        </p>

        <button
          onClick={() => seleccionarTipoRuta("urbano")}
          style={{
            padding: 22,
            borderRadius: 20,
            border: "none",
            background: "#22c55e",
            color: "white",
            fontSize: 22,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Rutas urbano
        </button>

        <button
          onClick={() => seleccionarTipoRuta("micro-local")}
          style={{
            padding: 22,
            borderRadius: 20,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontSize: 22,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Rutas micro/local
        </button>

        <button
          onClick={onRegresarInicio}
          style={{
            padding: 14,
            borderRadius: 999,
            border: "none",
            background: "white",
            color: "#111827",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ← Regresar
        </button>
      </div>
    );
  }

  if (pantallaFlujo === "zonas") {
    return (
      <div
        style={{
          height: "100vh",
          background: "#0f172a",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 24,
          gap: 18,
        }}
      >
        <h1
          style={{
            color: "white",
            textAlign: "center",
            fontSize: 28,
            fontWeight: 800,
            margin: 0,
          }}
        >
          Selecciona tu zona
        </h1>

        <p style={{ color: "#cbd5e1", textAlign: "center", margin: 0 }}>
          {obtenerEtiquetaTipoRuta(tipoRutaSeleccionado)}
        </p>

        <button
          onClick={() => cambiarZona("Tampico / Madero")}
          style={{
            padding: 22,
            borderRadius: 20,
            border: "none",
            background: "#22c55e",
            color: "white",
            fontSize: 22,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          📍 Tampico / Madero
        </button>

        <button
          onClick={() => cambiarZona("Zona Norte / Altamira")}
          style={{
            padding: 22,
            borderRadius: 20,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontSize: 22,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          📍 Zona Norte
        </button>

        <button
          onClick={
            modoUsuario === "chofer" ? regresarATiposRuta : onRegresarInicio
          }
          style={{
            padding: 14,
            borderRadius: 999,
            border: "none",
            background: "white",
            color: "#111827",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ← Regresar
        </button>
      </div>
    );
  }

  if (pantallaFlujo === "rutas") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          padding: 24,
          color: "white",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          {obtenerEtiquetaTipoRuta(tipoRutaSeleccionado)}
        </h1>

        <p style={{ color: "#cbd5e1", marginBottom: 20 }}>
          Zona: {obtenerEtiquetaZona(zonaSeleccionada)}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rutasDeZona.length === 0 && (
            <div
              style={{
                border: "1px solid rgba(148,163,184,.35)",
                borderRadius: 18,
                color: "#cbd5e1",
                padding: 18,
              }}
            >
              No hay rutas en esta selección.
            </div>
          )}

          {rutasDeZona.map((ruta) => {
            const usuariosRuta = conteoUsuariosPorRuta[ruta.nombre] || 0;

            return (
              <button
                key={ruta.nombre}
                onClick={() => seleccionarRuta(ruta.nombre)}
                style={{
                  padding: 18,
                  borderRadius: 18,
                  border: "none",
                  background: ruta.color,
                  color: "white",
                  fontSize: 18,
                  fontWeight: 800,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "block" }}>🚍 {ruta.nombre}</span>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    marginTop: 6,
                    opacity: 0.9,
                  }}
                >
                  👥 {usuariosRuta} usuarios en esta ruta
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={regresarAZonas}
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 999,
            border: "none",
            background: "white",
            color: "#111827",
            fontWeight: 800,
            width: "100%",
            cursor: "pointer",
          }}
        >
          ← Regresar
        </button>
      </div>
    );
  }

  return (
    <div className="rt-map-shell">
      <div className="rt-map-panel">
        <div className="rt-map-panel__main">
          <div
            className="rt-route-color"
            style={{ background: rutaMapaSeleccionada?.color || "#38bdf8" }}
          />

          <div className="rt-route-copy">
            <span className="rt-route-kicker">Modo navegación</span>
            <strong>{rutaSeleccionada || "Ruta seleccionada"}</strong>
          </div>

          <button
            type="button"
            onClick={regresarARutas}
            className="rt-mini-pill"
          >
            Cambiar ruta
          </button>
        </div>

        <div className="rt-map-panel__stats">
          <span>Zona: {obtenerEtiquetaZona(zonaSeleccionada)}</span>
          <span>Usuarios: {usuariosRutaSeleccionada}</span>
          <span>Camiones: {busesFiltrados.length}</span>
        </div>

        <div className="rt-trip-actions">
          <button
            type="button"
            onClick={() => setMostrarDetalleKm((prev) => !prev)}
            className="rt-trip-button rt-trip-button--ghost"
          >
            {kilometrosUsuario.toFixed(2)} km
          </button>

          <button
            type="button"
            onClick={iniciarViaje}
            disabled={procesandoViaje || Boolean(viajeActivo)}
            className="rt-trip-button rt-trip-button--start"
          >
            Iniciar
          </button>

          <button
            type="button"
            onClick={finalizarViaje}
            disabled={procesandoViaje || !viajeActivo}
            className="rt-trip-button rt-trip-button--end"
          >
            Finalizar
          </button>
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
                <button
                  key={mapa}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => {
                    if (bloqueado) return;
                    setEstiloMapa(mapa);
                    setMostrarOpcionesMapa(false);
                  }}
                  className={
                    estiloMapa === mapa
                      ? "rt-map-style-option rt-map-style-option--active"
                      : "rt-map-style-option"
                  }
                >
                  <span>{opcion.label}</span>
                  {bloqueado && <small>Bloqueado · 100 km</small>}
                </button>
              );
            })}
            {!nocturnoDesbloqueado && (
              <p>
                Nocturno se desbloquea al llegar a 100 km. Km actuales:{" "}
                {kilometrosUsuario.toFixed(2)}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onRegresarInicio}
          disabled={!onRegresarInicio}
          className="rt-fab"
          aria-label="Volver al inicio"
        >
          <span>Inicio</span>
        </button>

        <button
          type="button"
          onClick={() => setMostrarOpcionesMapa((prev) => !prev)}
          className="rt-fab rt-fab--dark"
          aria-label="Cambiar mapa"
        >
          <span>Mapa</span>
        </button>

        <button
          type="button"
          onClick={obtenerMiUbicacion}
          className="rt-fab rt-fab--primary"
          aria-label="Ir a mi ubicación"
        >
          <span>GPS</span>
        </button>
      </div>

      <MapContainer
        center={[22.2553, -97.8686]}
        zoom={13}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <AjustarMapa ubicacion={ubicacion} />

        <TileLayer
          key={estiloMapa}
          attribution={mapaActual.attribution}
          url={mapaActual.url}
        />

        {rutasDeZona
          .filter((ruta) => ruta.nombre === rutaSeleccionada)
          .map((ruta) => (
            <Fragment key={ruta.nombre}>
              <Polyline
                positions={ruta.puntos}
                pathOptions={{
                  color: estiloMapa === "nocturno" ? "#020617" : "#ffffff",
                  weight: 13,
                  opacity: estiloMapa === "nocturno" ? 0.8 : 0.92,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              <Polyline
                positions={ruta.puntos}
                pathOptions={{
                  color: ruta.color,
                  weight: 7,
                  opacity: 1,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </Fragment>
          ))}

        {ubicacion && (
          <Marker position={ubicacion} icon={miUbicacionIcon}>
            <Popup>Estás aquí</Popup>
          </Marker>
        )}

        {busesFiltrados.map((bus) => (
          <BusAnimado key={bus.id} bus={bus} />
        ))}
      </MapContainer>
    </div>
  );
}