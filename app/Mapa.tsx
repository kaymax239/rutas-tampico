"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Un autobus en vivo se considera activo solo si su ultima actualizacion fue
// hace 2 minutos o menos. Asi un chofer que cierra la app sin que se borre su
// documento deja de contar como activo poco despues.
const BUS_ACTIVO_MAX_MINUTOS = 2;

type Bus = {
  id: string;
  nombre?: string;
  ruta?: string;
  lat: number;
  lng: number;
  // Rumbo opcional del autobus (0-360, 0 = norte). Solo se usa si el GPS del
  // chofer ya lo reporta; si no existe, queda en null y el icono no se rota.
  heading: number | null;
  fecha?: Timestamp;
  // Ultima actualizacion normalizada a milisegundos (a partir de fecha,
  // timestamp, updatedAt, etc.). Se usa para la ventana de "en vivo".
  actualizadoMs: number | null;
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

type GpsExterno = {
  id: string;
  nombre: string;
  ruta: string;
  proveedor: string;
  zona: Zona;
  tipo: TipoRuta;
  lat: number;
  lng: number;
  urlRastreador: string;
};

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

type CategoriaLugar =
  | "restaurant"
  | "fast_food"
  | "cafe"
  | "convenience"
  | "supermarket"
  | "shop"
  | "pharmacy"
  | "bar"
  | "pub";

type CategoriaBusquedaLugar = {
  categoria: CategoriaLugar;
  googleType: string;
  keyword?: string;
};

type LugarCercano = {
  id: string;
  nombre: string;
  categoria: CategoriaLugar;
  lat: number;
  lng: number;
  distanciaMetros: number;
  rating?: number;
  direccion?: string;
  googleMapsUri?: string;
  telefono?: string;
  websiteUri?: string;
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
const MAPA_PROFESIONAL = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution: "&copy; OpenStreetMap &copy; CARTO",
};
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const LUGARES_RADIO_M = 300;
const LUGARES_MAXIMOS = 10;
const LUGARES_INTERVALO_MS = 30_000;
const LUGARES_MOVIMIENTO_MINIMO_M = 80;
const CLICK_NEGOCIO_COOLDOWN_MS = 5_000;
const CATEGORIAS_LUGARES: CategoriaBusquedaLugar[] = [
  { categoria: "restaurant", googleType: "restaurant" },
  { categoria: "fast_food", googleType: "restaurant", keyword: "fast food" },
  { categoria: "cafe", googleType: "cafe" },
  { categoria: "convenience", googleType: "convenience_store" },
  { categoria: "supermarket", googleType: "supermarket" },
  { categoria: "shop", googleType: "store" },
  { categoria: "pharmacy", googleType: "pharmacy" },
  { categoria: "bar", googleType: "bar" },
  { categoria: "pub", googleType: "bar", keyword: "pub" },
];
const ETIQUETAS_LUGARES: Record<CategoriaLugar, string> = {
  restaurant: "Restaurante",
  fast_food: "Comida rápida",
  cafe: "Café",
  convenience: "Tienda",
  supermarket: "Supermercado",
  shop: "Comercio",
  pharmacy: "Farmacia",
  bar: "Bar",
  pub: "Pub",
};
// Umbral de proximidad para avisar "Tu autobús está llegando".
const PROXIMIDAD_BUS_LLEGANDO_M = 300;
const ES_DESARROLLO = process.env.NODE_ENV === "development";
const GOOGLE_MAPS_CALLBACK = "__rutasTampicoGoogleMapsReady";

type GooglePlacesRuntime = {
  PlacesService?: any;
  PlacesServiceStatus?: any;
  Place?: any;
  SearchNearbyRankPreference?: any;
  LatLng: any;
};

let googlePlacesLoader: Promise<GooglePlacesRuntime> | null = null;

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

function distanciaMetros(inicio: [number, number], fin: [number, number]) {
  return distanciaHaversineKm(inicio, fin) * 1000;
}

function formatearDistanciaBus(distancia: number) {
  if (distancia < 1000) return `Bus a ${Math.round(distancia)} m de ti`;

  return `Bus a ${(distancia / 1000).toFixed(2)} km de ti`;
}

// Velocidad promedio para estimar el ETA del bus (solo aproximado).
const VELOCIDAD_PROMEDIO_ETA_BUS_KMH = 25;

function formatearEtaBus(distanciaEnMetros: number) {
  // ETA aproximado basado solo en la distancia y una velocidad promedio;
  // no considera direccion, trafico ni posicion en tiempo real.
  const distanciaKm = distanciaEnMetros / 1000;
  const minutos = Math.max(
    1,
    Math.round((distanciaKm / VELOCIDAD_PROMEDIO_ETA_BUS_KMH) * 60)
  );

  return `${minutos} min`;
}

// Texto "hace X segundos/minutos" a partir del momento de la ultima
// actualizacion real del autobus. Si no hay dato, no se inventa nada.
function formatearHaceTiempo(actualizadoMs: number | null, ahoraMs: number) {
  if (!actualizadoMs) return "Sin actualización reciente";

  const segundos = Math.max(0, Math.round((ahoraMs - actualizadoMs) / 1000));

  if (segundos < 60) return `Última actualización hace ${segundos} s`;

  const minutos = Math.round(segundos / 60);

  return `Última actualización hace ${minutos} min`;
}

// Texto simple de distancia para el panel del pasajero: "Distancia: X m" o km.
function formatearDistanciaSimple(distancia: number) {
  if (distancia < 1000) return `Distancia: ${Math.round(distancia)} m`;

  return `Distancia: ${(distancia / 1000).toFixed(2)} km`;
}

function formatearDistanciaCorta(distancia: number | null) {
  if (distancia === null) return "Distancia no disponible";
  if (distancia < 1000) return `Bus a ${Math.round(distancia)} metros`;

  return `Bus a ${(distancia / 1000).toFixed(2)} km`;
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

// Normaliza el rumbo del autobus a 0-360. Devuelve null cuando el GPS del
// chofer no reporta direccion, para no inventar una orientacion.
function leerHeading(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const numero = Number(value);

  if (!Number.isFinite(numero)) return null;

  return ((numero % 360) + 360) % 360;
}

// El GPS del chofer puede llegar con la marca de tiempo en distintos campos
// (fecha, timestamp, updatedAt...) y formatos (Timestamp de Firestore, numero
// en ms o texto ISO). Se normaliza a milisegundos para no descartar como
// "inactivo" a un chofer que en realidad esta enviando GPS en vivo.
function obtenerMsActualizacion(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const fecha = (value as { toDate: () => Date }).toDate();
    const ms = fecha.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }

  return null;
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

function normalizarNombreRuta(nombre: string) {
  return nombre.trim().toLowerCase().replace(/\s+/g, " ");
}

function obtenerIconoLugar(categoria: CategoriaLugar) {
  if (categoria === "restaurant") return "🍽";
  if (categoria === "fast_food") return "🍔";
  if (categoria === "convenience") return "🏪";
  if (categoria === "supermarket") return "🛒";
  if (categoria === "shop") return "🛍";
  if (categoria === "pharmacy") return "✚";
  if (categoria === "cafe") return "☕";
  if (categoria === "bar" || categoria === "pub") return "●";

  return "•";
}

function crearDescripcionLugar(lugar: LugarCercano) {
  const etiqueta = ETIQUETAS_LUGARES[lugar.categoria].toLowerCase();
  const distancia = `${lugar.distanciaMetros} m`;
  const rating =
    typeof lugar.rating === "number"
      ? ` Tiene calificación de ${lugar.rating.toFixed(1)} estrellas en Google.`
      : "";

  return `${lugar.nombre} es un ${etiqueta} ubicado a ${distancia} de tu ubicación actual.${rating}`;
}

function crearLugarIcon(categoria: CategoriaLugar) {
  return new L.DivIcon({
    html: `
      <div class="rt-place-marker rt-place-marker--${categoria}" aria-hidden="true">
        <span>${obtenerIconoLugar(categoria)}</span>
      </div>
    `,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

async function confirmarGooglePlaces(
  win: typeof window & { google?: any; [GOOGLE_MAPS_CALLBACK]?: () => void }
): Promise<GooglePlacesRuntime> {
  console.log("window.google:", !!win.google);
  console.log("window.google.maps:", !!win.google?.maps);
  console.log("window.google.maps.places:", !!win.google?.maps?.places);

  if (!win.google) {
    console.error("FALLO: GOOGLE NO CARGO");
    throw new Error("Google no cargó");
  }

  if (!win.google.maps) {
    console.error("FALLO: GOOGLE MAPS NO CARGO");
    throw new Error("Google Maps no cargó");
  }

  let placesLibrary: any = null;

  if (!win.google.maps.places) {
    if (typeof win.google.maps.importLibrary === "function") {
      try {
        placesLibrary = await win.google.maps.importLibrary("places");
        console.log("importLibrary places result:", placesLibrary);
      } catch (error) {
        console.error("FALLO: PLACES NO CARGO", error);
        throw error;
      }
    }
  }

  const PlacesService =
    placesLibrary?.PlacesService || win.google?.maps?.places?.PlacesService;
  const PlacesServiceStatus =
    placesLibrary?.PlacesServiceStatus ||
    win.google?.maps?.places?.PlacesServiceStatus;
  const Place = placesLibrary?.Place || win.google?.maps?.places?.Place;
  const SearchNearbyRankPreference =
    placesLibrary?.SearchNearbyRankPreference ||
    win.google?.maps?.places?.SearchNearbyRankPreference;

  console.log("importLibrary places result:", placesLibrary);
  console.log(
    "PlacesService:",
    PlacesService || win.google?.maps?.places?.PlacesService
  );
  console.log("Place.searchNearby:", typeof Place?.searchNearby === "function");
  console.log("window.google:", !!win.google);
  console.log("window.google.maps:", !!win.google?.maps);
  console.log("window.google.maps.places:", !!win.google?.maps?.places);

  if (typeof Place?.searchNearby !== "function") {
    console.error("FALLO: Places API (New) no disponible", {
      importLibraryDisponible: typeof win.google.maps.importLibrary === "function",
      placesLibrary,
      windowPlaces: win.google?.maps?.places,
    });
    throw new Error("Places API (New) no disponible");
  }

  return {
    PlacesService,
    PlacesServiceStatus:
      PlacesServiceStatus || { OK: "OK", ZERO_RESULTS: "ZERO_RESULTS" },
    Place,
    SearchNearbyRankPreference,
    LatLng: win.google.maps.LatLng,
  };
}

function cargarGooglePlaces(apiKey: string): Promise<GooglePlacesRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Places solo está disponible en el cliente"));
  }

  const win = window as typeof window & {
    google?: any;
    [GOOGLE_MAPS_CALLBACK]?: () => void;
  };

  if (win.google?.maps) {
    return confirmarGooglePlaces(win);
  }

  if (googlePlacesLoader) {
    return googlePlacesLoader.then(() => confirmarGooglePlaces(win));
  }

  googlePlacesLoader = new Promise<GooglePlacesRuntime>((resolve, reject) => {
    const scriptExistente = document.getElementById("google-maps-places-sdk");
    const confirmarCarga = () => {
      confirmarGooglePlaces(win).then(resolve).catch(reject);
    };

    win[GOOGLE_MAPS_CALLBACK] = confirmarCarga;

    if (scriptExistente) {
      if (win.google?.maps) {
        confirmarCarga();
        return;
      }

      scriptExistente.addEventListener("load", confirmarCarga, { once: true });
      scriptExistente.addEventListener(
        "error",
        () => {
          console.error("FALLO: GOOGLE NO CARGO");
          reject(new Error("No se pudo cargar Google Places"));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-places-sdk";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly&loading=async&callback=${GOOGLE_MAPS_CALLBACK}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("FALLO: GOOGLE NO CARGO");
      reject(new Error("No se pudo cargar Google Places"));
    };
    document.head.appendChild(script);
  });

  return googlePlacesLoader;
}

function obtenerLatLngDePlace(place: any): [number, number] | null {
  const location = place.location || place.geometry?.location;
  const lat =
    typeof location?.lat === "function" ? location.lat() : location?.lat;
  const lng =
    typeof location?.lng === "function" ? location.lng() : location?.lng;

  return typeof lat === "number" && typeof lng === "number" ? [lat, lng] : null;
}

function obtenerNombreDePlace(place: any) {
  if (typeof place.displayName === "string") return place.displayName;
  if (typeof place.displayName?.text === "string") return place.displayName.text;
  if (typeof place.name === "string") return place.name;

  return "Lugar cercano";
}

function normalizarPlaceCercano(
  place: any,
  ubicacion: [number, number],
  categoria: CategoriaLugar
): LugarCercano | null {
  const latLng = obtenerLatLngDePlace(place);

  if (!latLng) {
    console.info("[Lugares cercanos] lugar descartado sin lat/lng", {
      categoria,
      nombre: obtenerNombreDePlace(place),
    });
    return null;
  }

  const [lat, lng] = latLng;
  const distancia = distanciaMetros(ubicacion, [lat, lng]);
  const nombre = obtenerNombreDePlace(place);

  console.info("[Lugares cercanos] lugar recibido", {
    categoria,
    nombre,
    lat,
    lng,
    distanciaMetros: Math.round(distancia),
  });

  if (distancia > LUGARES_RADIO_M) return null;

  return {
    id: String(place.id || place.place_id || `${categoria}-${lat}-${lng}`),
    nombre,
    categoria,
    lat,
    lng,
    distanciaMetros: Math.round(distancia),
    rating: typeof place.rating === "number" ? Number(place.rating) : undefined,
    direccion:
      typeof place.formattedAddress === "string"
        ? place.formattedAddress
        : undefined,
    googleMapsUri:
      typeof place.googleMapsURI === "string" ? place.googleMapsURI : undefined,
    telefono:
      typeof place.nationalPhoneNumber === "string"
        ? place.nationalPhoneNumber
        : undefined,
    websiteUri: typeof place.websiteURI === "string" ? place.websiteURI : undefined,
  };
}

function buscarCategoriaLugar(
  runtime: GooglePlacesRuntime,
  ubicacion: [number, number],
  busqueda: CategoriaBusquedaLugar
) {
  return buscarCategoriaLugarNuevaApi(runtime, ubicacion, busqueda);
}

async function buscarCategoriaLugarNuevaApi(
  runtime: GooglePlacesRuntime,
  ubicacion: [number, number],
  busqueda: CategoriaBusquedaLugar
) {
  const { categoria, googleType } = busqueda;

  try {
    const response = await runtime.Place.searchNearby({
      fields: [
        "id",
        "displayName",
        "location",
        "rating",
        "formattedAddress",
        "googleMapsURI",
        "nationalPhoneNumber",
        "websiteURI",
      ],
      includedPrimaryTypes: [googleType],
      locationRestriction: {
        center: { lat: ubicacion[0], lng: ubicacion[1] },
        radius: LUGARES_RADIO_M,
      },
      maxResultCount: LUGARES_MAXIMOS,
      rankPreference:
        runtime.SearchNearbyRankPreference?.DISTANCE ||
        runtime.SearchNearbyRankPreference?.POPULARITY,
    });
    const places = response?.places || [];

    console.info("[Lugares cercanos] respuesta API nueva", {
      categoria,
      googleType,
      recibidos: places.length,
      usuario: { lat: ubicacion[0], lng: ubicacion[1] },
      radioMetros: LUGARES_RADIO_M,
    });

    const lugares = places
      .map((place: any) => normalizarPlaceCercano(place, ubicacion, categoria))
      .filter(Boolean) as LugarCercano[];

    console.info("[Lugares cercanos] después del filtro", {
      categoria,
      quedan: lugares.length,
      radioMetros: LUGARES_RADIO_M,
    });

    return lugares;
  } catch (error) {
    console.error("[Lugares cercanos] error API nueva", {
      categoria,
      googleType,
      error,
    });

    return [];
  }
}

async function buscarLugaresGoogle(ubicacion: [number, number]) {
  const runtime = await cargarGooglePlaces(GOOGLE_MAPS_API_KEY);

  const win = window as typeof window & { google?: any };

  console.log("window.google:", !!win.google);
  console.log("window.google.maps:", !!win.google?.maps);
  console.log("window.google.maps.places:", !!win.google?.maps?.places);

  if (!win.google) {
    console.error("FALLO: GOOGLE NO CARGO");
    throw new Error("Google no cargó");
  }

  if (!win.google.maps) {
    console.error("FALLO: GOOGLE MAPS NO CARGO");
    throw new Error("Google Maps no cargó");
  }

  const resultados = await Promise.all(
    CATEGORIAS_LUGARES.map((busqueda) =>
      buscarCategoriaLugar(runtime, ubicacion, busqueda)
    )
  );
  const porId = new Map<string, LugarCercano>();

  resultados.flat().forEach((lugar) => {
    const existente = porId.get(lugar.id);

    if (!existente || lugar.distanciaMetros < existente.distanciaMetros) {
      porId.set(lugar.id, lugar);
    }
  });

  const lugaresUnicos = Array.from(porId.values())
    .sort((a, b) => a.distanciaMetros - b.distanciaMetros)
    .slice(0, LUGARES_MAXIMOS);

  console.info("[Lugares cercanos] resumen búsqueda", {
    usuario: { lat: ubicacion[0], lng: ubicacion[1] },
    radioMetros: LUGARES_RADIO_M,
    recibidosApi: resultados.flat().length,
    despuesFiltroDuplicados: lugaresUnicos.length,
    lugares: lugaresUnicos.map((lugar) => ({
      nombre: lugar.nombre,
      categoria: lugar.categoria,
      lat: lugar.lat,
      lng: lugar.lng,
      distanciaMetros: lugar.distanciaMetros,
    })),
  });

  return lugaresUnicos;
}

// Duracion (ms) de la interpolacion entre dos posiciones del autobus. Conviene
// que sea ~ el intervalo entre actualizaciones de Firestore para que el bus se
// mueva de forma continua sin "alcanzar" su destino antes del siguiente dato.
const ANIMACION_BUS_MS = 1200;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Interpola un angulo por el camino mas corto (350° -> 10° gira +20°, no -340°).
function lerpAngle(a: number, b: number, t: number) {
  const diff = ((b - a + 540) % 360) - 180;

  return a + diff * t;
}

// Rumbo (bearing) entre dos coordenadas, en grados (0 = norte).
function obtenerBearing(desde: [number, number], hacia: [number, number]) {
  const lat1 = (desde[0] * Math.PI) / 180;
  const lat2 = (hacia[0] * Math.PI) / 180;
  const dLon = ((hacia[1] - desde[1]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Construye el icono del autobus. El cuerpo (.rt-bus-marker__body) es el
// elemento que se rota; la rotacion en vivo la aplica AnimatedBus por JS, por
// eso el icono se mantiene estable (no se recrea en cada actualizacion).
function crearBusIcon(heading: number | null) {
  const estiloRotacion =
    heading === null ? "" : ` style="transform: rotate(${heading}deg);"`;

  return new L.DivIcon({
    html: `
    <div class="rt-bus-marker" aria-hidden="true">
      <span class="rt-bus-marker__pulse"></span>
      <div class="rt-bus-marker__body"${estiloRotacion}>
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
}

const busIcon = crearBusIcon(null);

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

const gpsExternoIcon = new L.DivIcon({
  html: `
    <div style="
      width:44px;
      height:44px;
      position:relative;
      display:grid;
      place-items:center;
      border:4px solid #ffffff;
      border-radius:16px;
      background:rgba(250,204,21,.22);
      box-shadow:0 18px 34px rgba(15,23,42,.52),0 0 0 5px rgba(250,204,21,.34),0 0 28px rgba(250,204,21,.72);
    " aria-hidden="true">
      <div style="
        position:relative;
        width:34px;
        height:25px;
        border:2px solid #713f12;
        border-radius:9px 9px 7px 7px;
        background:linear-gradient(180deg,#fde047,#facc15);
        box-shadow:inset 0 -4px 0 rgba(146,64,14,.18);
      ">
        <div style="position:absolute;left:5px;top:5px;width:8px;height:7px;border-radius:2px;background:#fffbeb;"></div>
        <div style="position:absolute;left:16px;top:5px;width:9px;height:7px;border-radius:2px;background:#fffbeb;"></div>
        <div style="position:absolute;right:4px;top:8px;width:4px;height:4px;border-radius:999px;background:#fef3c7;"></div>
        <div style="position:absolute;left:6px;bottom:5px;width:24px;height:3px;border-radius:999px;background:#92400e;"></div>
        <div style="position:absolute;left:5px;bottom:-6px;width:9px;height:9px;border:2px solid #f8fafc;border-radius:999px;background:#0f172a;"></div>
        <div style="position:absolute;right:5px;bottom:-6px;width:9px;height:9px;border:2px solid #f8fafc;border-radius:999px;background:#0f172a;"></div>
      </div>
    </div>
  `,
  className: "",
  iconSize: [44, 44],
  iconAnchor: [22, 36],
  popupAnchor: [0, -38],
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
    nombre: "Tampico - Altamira",
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
    nombre: "Ampliación Enrique Cárdenas",
    color: "#38bdf8",
    puntos: [
      [22.2553, -97.8686],
      [22.265, -97.861],
      [22.279, -97.852],
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

const GPS_EXTERNOS: GpsExterno[] = [
  {
    id: "gps-bus-01",
    nombre: "GPS Bus 01",
    ruta: "Tampico - Altamira",
    proveedor: "Steren GPS-1100",
    zona: "Zona Norte / Altamira",
    tipo: "micro-local",
    lat: 22.364418,
    lng: -97.882343,
    urlRastreador:
      "https://www.gps.steren.com.mx/page/share.jsp?mapType=google&token=S1782665340456O774186ac37ac9416dae5f77dcb82d8c85d516a",
  },
];

function GpsExternoMarker({ gps }: { gps: GpsExterno }) {
  return (
    <Marker
      position={[gps.lat, gps.lng]}
      icon={gpsExternoIcon}
      riseOnHover={true}
      zIndexOffset={3000}
    >
      <Tooltip direction="top" offset={[0, -38]} permanent opacity={1}>
        GPS Bus 01
      </Tooltip>
      <Popup>
        <b>{gps.nombre}</b>
        <br />
        Ruta: {gps.ruta}
        <br />
        Origen: GPS Steren
        <br />
        <button
          type="button"
          onClick={() =>
            window.open(gps.urlRastreador, "_blank", "noopener,noreferrer")
          }
          style={{
            marginTop: 8,
            border: "0",
            borderRadius: 999,
            background: "#facc15",
            color: "#422006",
            cursor: "pointer",
            fontWeight: 900,
            padding: "8px 12px",
          }}
        >
          Ver ubicación en tiempo real
        </button>
      </Popup>
    </Marker>
  );
}

// Autobus en vivo con movimiento suave: en lugar de "saltar" a cada posicion
// nueva de Firestore, interpola entre la posicion mostrada y la nueva con
// requestAnimationFrame (60 fps) usando setLatLng directo sobre el marcador de
// Leaflet (sin re-render de React). Ademas rota el cuerpo hacia donde avanza:
// usa el rumbo del GPS del chofer si existe, o lo calcula del propio movimiento.
function AnimatedBus({ bus, icon }: { bus: Bus; icon: L.DivIcon }) {
  const markerRef = useRef<L.Marker | null>(null);
  const rafRef = useRef<number | null>(null);
  // Estado realmente mostrado (no el destino). Persiste entre actualizaciones.
  const estadoRef = useRef({
    lat: bus.lat,
    lng: bus.lng,
    angle: bus.heading ?? 0,
  });

  useEffect(() => {
    const marker = markerRef.current;

    if (!marker) return;

    const desde = { ...estadoRef.current };
    const hacia = { lat: bus.lat, lng: bus.lng };
    // Si casi no se movio, no recalcula el angulo (evita girar al norte parado).
    const seMovio =
      Math.abs(hacia.lat - desde.lat) > 1e-7 ||
      Math.abs(hacia.lng - desde.lng) > 1e-7;
    const anguloDestino =
      bus.heading !== null
        ? bus.heading
        : seMovio
        ? obtenerBearing([desde.lat, desde.lng], [hacia.lat, hacia.lng])
        : desde.angle;

    const inicio = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const frame = (ahoraMs: number) => {
      const t = Math.min((ahoraMs - inicio) / ANIMACION_BUS_MS, 1);
      const e = 1 - (1 - t) * (1 - t); // easeOutQuad: arranca rapido, frena suave
      const lat = lerp(desde.lat, hacia.lat, e);
      const lng = lerp(desde.lng, hacia.lng, e);
      const angle = lerpAngle(desde.angle, anguloDestino, e);

      marker.setLatLng([lat, lng]);

      const cuerpo = marker
        .getElement()
        ?.querySelector<HTMLElement>(".rt-bus-marker__body");

      if (cuerpo) cuerpo.style.transform = `rotate(${angle}deg)`;

      estadoRef.current = { lat, lng, angle };

      if (t < 1) rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [bus.lat, bus.lng, bus.heading]);

  return (
    <Marker
      ref={markerRef}
      position={[estadoRef.current.lat, estadoRef.current.lng]}
      icon={icon}
      riseOnHover={true}
    >
      <Popup>
        <b>{bus.nombre}</b>
        <br />
        Ruta: {bus.ruta}
        <br />
        Ubicación reportada en vivo
        {bus.heading !== null && (
          <>
            <br />
            Rumbo: {Math.round(bus.heading)}°
          </>
        )}
      </Popup>
    </Marker>
  );
}

function ControlarVistaMapa({
  ubicacion,
  ruta,
  centrarRutaSolicitud,
  gpsDestino,
  centrarGpsSolicitud,
  centrarUsuarioYGpsSolicitud,
}: {
  ubicacion: [number, number] | null;
  ruta?: Ruta;
  centrarRutaSolicitud: number;
  gpsDestino?: GpsExterno;
  centrarGpsSolicitud: number;
  centrarUsuarioYGpsSolicitud: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (ubicacion) {
      map.flyTo(ubicacion, 15, { duration: 1 });
    }
  }, [ubicacion, map]);

  useEffect(() => {
    if (!ruta || ruta.puntos.length === 0 || centrarRutaSolicitud === 0) return;

    const bounds = L.latLngBounds(ruta.puntos);
    map.fitBounds(bounds, {
      animate: true,
      duration: 0.9,
      padding: [44, 44],
      maxZoom: 15,
    });
  }, [centrarRutaSolicitud, map, ruta]);

  useEffect(() => {
    if (!gpsDestino || centrarGpsSolicitud === 0) return;

    map.flyTo([gpsDestino.lat, gpsDestino.lng], 17, {
      animate: true,
      duration: 0.9,
    });
  }, [centrarGpsSolicitud, gpsDestino, map]);

  useEffect(() => {
    if (!ubicacion || !gpsDestino || centrarUsuarioYGpsSolicitud === 0) return;

    const bounds = L.latLngBounds([
      ubicacion,
      [gpsDestino.lat, gpsDestino.lng],
    ]);

    map.fitBounds(bounds, {
      animate: true,
      duration: 0.9,
      padding: [74, 74],
      maxZoom: 16,
    });
  }, [centrarUsuarioYGpsSolicitud, gpsDestino, map, ubicacion]);

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
  const [centrarRutaSolicitud, setCentrarRutaSolicitud] = useState(0);
  const [centrarGpsSolicitud, setCentrarGpsSolicitud] = useState(0);
  const [centrarUsuarioYGpsSolicitud, setCentrarUsuarioYGpsSolicitud] =
    useState(0);
  const [lugaresActivos, setLugaresActivos] = useState(false);
  const [lugaresCercanos, setLugaresCercanos] = useState<LugarCercano[]>([]);
  const [mensajeLugares, setMensajeLugares] = useState("");
  const [cargandoLugares, setCargandoLugares] = useState(false);
  const ultimaBusquedaLugares = useRef<{
    ubicacion: [number, number] | null;
    timestamp: number;
  }>({ ubicacion: null, timestamp: 0 });
  const clicksNegociosRef = useRef<Record<string, number>>({});
  const [negocioSeleccionado, setNegocioSeleccionado] =
    useState<LugarCercano | null>(null);
  const [conteoClicksNegocio, setConteoClicksNegocio] = useState<
    Record<string, number>
  >({});
  // Reloj que avanza cada segundo para refrescar "hace X segundos" del bus.
  const [ahora, setAhora] = useState(() => Date.now());
  const [esperandoRuta, setEsperandoRuta] = useState(false);
  const [enviandoEspera, setEnviandoEspera] = useState(false);
  const [reportandoPaso, setReportandoPaso] = useState(false);
  const [mensajeAccionRuta, setMensajeAccionRuta] = useState("");
  // Transmision de GPS en vivo del chofer hacia la coleccion "autobuses".
  const [transmitiendoGps, setTransmitiendoGps] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const sessionTransmisionRef = useRef<string | null>(null);

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000);

    return () => window.clearInterval(intervalo);
  }, []);

  // Si el chofer cierra la pestaña/app o el componente se desmonta mientras
  // transmite, se intenta detener el watch y borrar su documento de
  // "autobuses". Si la baja no alcanza a enviarse, la ventana de 2 minutos lo
  // marca inactivo de todos modos.
  useEffect(() => {
    const detenerEnSalida = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      const sessionId = sessionTransmisionRef.current;
      sessionTransmisionRef.current = null;

      if (sessionId) {
        void deleteDoc(doc(db, "autobuses", sessionId)).catch(() => undefined);
      }
    };

    window.addEventListener("beforeunload", detenerEnSalida);
    window.addEventListener("pagehide", detenerEnSalida);

    return () => {
      window.removeEventListener("beforeunload", detenerEnSalida);
      window.removeEventListener("pagehide", detenerEnSalida);
      detenerEnSalida();
    };
  }, []);

  // Si el chofer abandona la pantalla del mapa (vuelve a rutas/zonas) mientras
  // transmite, se detiene la transmision y se borra su autobus: ya no hay boton
  // visible para detenerlo y no debe seguir publicando una ruta que dejo.
  useEffect(() => {
    if (pantallaFlujo === "mapa" || !transmitiendoGps) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTransmitiendoGps(false);

    const sessionId = sessionTransmisionRef.current;
    sessionTransmisionRef.current = null;

    if (sessionId) {
      void deleteDoc(doc(db, "autobuses", sessionId)).catch(() => undefined);
    }
  }, [pantallaFlujo, transmitiendoGps]);

  // Al cambiar de ruta se reinicia el estado de las acciones del panel.
  useEffect(() => {
    setEsperandoRuta(false);
    setEnviandoEspera(false);
    setMensajeAccionRuta("");
  }, [rutaSeleccionada]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "autobuses"), (snapshot) => {
      const data: Bus[] = snapshot.docs
        .map((docSnap) => {
          const d = docSnap.data();

          // El chofer puede guardar el nombre de la ruta en distintos campos
          // (ruta, nombre, routeName, nombreRuta, routeId). Se leen todos para
          // no perder el camion al filtrar por la ruta seleccionada.
          const nombreRuta = String(
            d.nombre ||
              d.ruta ||
              d.routeName ||
              d.nombreRuta ||
              d.routeId ||
              "Autobús"
          );
          const rutaBus = String(
            d.ruta ||
              d.nombre ||
              d.routeName ||
              d.nombreRuta ||
              d.routeId ||
              "Sin ruta"
          );

          return {
            id: docSnap.id,
            nombre: nombreRuta,
            ruta: rutaBus,
            lat: Number(d.lat),
            lng: Number(d.lng),
            heading: leerHeading(d.heading ?? d.direction ?? d.rumbo),
            fecha: d.fecha,
            actualizadoMs: obtenerMsActualizacion(
              d.fecha ??
                d.timestamp ??
                d.updatedAt ??
                d.lastUpdate ??
                d.fechaActualizacion ??
                d.hora
            ),
          };
        })
        .filter((b) => {
          if (Number.isNaN(b.lat) || Number.isNaN(b.lng)) return false;

          // Si no hay marca de tiempo legible no se puede afirmar que el GPS
          // siga activo: se descarta para mantener "No hay autobus activo".
          if (b.actualizadoMs === null) return false;

          const minutos = (Date.now() - b.actualizadoMs) / 1000 / 60;

          // Un autobus con mas de 2 minutos sin actualizar se considera
          // inactivo (chofer que cerro la app sin que se borrara el doc).
          return minutos <= BUS_ACTIVO_MAX_MINUTOS;
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

  useEffect(() => {
    if (!lugaresActivos) {
      setLugaresCercanos([]);
      setMensajeLugares("");
      setCargandoLugares(false);
      setNegocioSeleccionado(null);
      ultimaBusquedaLugares.current = { ubicacion: null, timestamp: 0 };
      return;
    }

    console.log("GOOGLE_MAPS_API_KEY:", GOOGLE_MAPS_API_KEY);

    if (typeof window !== "undefined") {
      const win = window as typeof window & { google?: any };

      console.log("window.google:", !!win.google);
      console.log("window.google.maps:", !!win.google?.maps);
      console.log("window.google.maps.places:", !!win.google?.maps?.places);
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.error("FALLO: API KEY VACIA");
      setLugaresCercanos([]);
      setMensajeLugares("Lugares cercanos no disponibles.");
      return;
    }

    if (!ubicacion) {
      setLugaresCercanos([]);
      setMensajeLugares("Activa Mi ubicación para buscar lugares cercanos.");
      return;
    }

    const ultima = ultimaBusquedaLugares.current;
    const ahora = Date.now();
    const distanciaDesdeUltima = ultima.ubicacion
      ? distanciaMetros(ultima.ubicacion, ubicacion)
      : Number.POSITIVE_INFINITY;
    const puedeBuscarPorTiempo =
      !ultima.timestamp || ahora - ultima.timestamp >= LUGARES_INTERVALO_MS;
    const puedeBuscarPorDistancia =
      !ultima.ubicacion || distanciaDesdeUltima >= LUGARES_MOVIMIENTO_MINIMO_M;

    if (!puedeBuscarPorTiempo || !puedeBuscarPorDistancia) return;

    let cancelado = false;

    setCargandoLugares(true);
    setMensajeLugares("Buscando lugares cercanos...");

    buscarLugaresGoogle(ubicacion)
      .then((lugares) => {
        if (cancelado) return;

        ultimaBusquedaLugares.current = {
          ubicacion,
          timestamp: Date.now(),
        };
        setLugaresCercanos(lugares);
        setMensajeLugares(
          lugares.length > 0
            ? ""
            : "No encontramos lugares en 300 m. Activa ubicación precisa o prueba moverte unos metros."
        );
      })
      .catch((error) => {
        if (cancelado) return;

        console.error("FALLO: ERROR EN buscarLugaresGoogle", error);
        setLugaresCercanos([]);
        setMensajeLugares("Lugares cercanos no disponibles.");
      })
      .finally(() => {
        if (!cancelado) setCargandoLugares(false);
      });

    return () => {
      cancelado = true;
    };
  }, [lugaresActivos, ubicacion]);

  const rutasDeZona = useMemo(() => {
    return rutas.filter((ruta) => {
      if (ruta.zona !== zonaSeleccionada) return false;

      return tipoRutaSeleccionado
        ? obtenerTipoRuta(ruta) === tipoRutaSeleccionado
        : true;
    });
  }, [tipoRutaSeleccionado, zonaSeleccionada]);

  // Conjunto de rutas que tienen actividad real ahora mismo: un autobus en
  // vivo (coleccion "autobuses") o un GPS externo asignado a esa ruta.
  const rutasConActividad = useMemo(() => {
    const activas = new Set<string>();

    for (const ruta of rutas) {
      const objetivo = normalizarNombreRuta(ruta.nombre);
      const tieneBusEnVivo = buses.some(
        (b) =>
          normalizarNombreRuta(b.nombre || "").includes(objetivo) ||
          normalizarNombreRuta(b.ruta || "").includes(objetivo)
      );
      const tieneGpsExterno = GPS_EXTERNOS.some(
        (gps) =>
          gps.zona === ruta.zona &&
          normalizarNombreRuta(gps.ruta) === normalizarNombreRuta(ruta.nombre)
      );

      if (tieneBusEnVivo || tieneGpsExterno) {
        activas.add(ruta.nombre);
      }
    }

    return activas;
  }, [buses]);

  const busesFiltrados = useMemo(() => {
    if (!rutaSeleccionada) return [];

    const objetivo = normalizarNombreRuta(rutaSeleccionada);

    return buses.filter(
      (b) =>
        normalizarNombreRuta(b.nombre || "").includes(objetivo) ||
        normalizarNombreRuta(b.ruta || "").includes(objetivo)
    );
  }, [buses, rutaSeleccionada]);

  // Autobus en vivo mas cercano a la ubicacion del usuario en la ruta activa.
  // Solo usa datos reales: si no hay ubicacion, la distancia queda en null y no
  // se inventa ninguna posicion.
  const infoBusCercano = useMemo(() => {
    if (busesFiltrados.length === 0) return null;

    let mejor: {
      bus: Bus;
      distancia: number | null;
      actualizadoMs: number | null;
    } | null = null;

    for (const bus of busesFiltrados) {
      const distancia = ubicacion
        ? distanciaMetros(ubicacion, [bus.lat, bus.lng])
        : null;
      const actualizadoMs =
        bus.actualizadoMs ??
        (bus.fecha?.toDate ? bus.fecha.toDate().getTime() : null);

      if (!mejor) {
        mejor = { bus, distancia, actualizadoMs };
        continue;
      }

      if (
        distancia !== null &&
        (mejor.distancia === null || distancia < mejor.distancia)
      ) {
        mejor = { bus, distancia, actualizadoMs };
      }
    }

    return mejor;
  }, [busesFiltrados, ubicacion]);

  const gpsExternosFiltrados = useMemo(() => {
    if (!rutaSeleccionada) return [];

    return GPS_EXTERNOS.filter(
      (gps) =>
        gps.zona === zonaSeleccionada &&
        (!tipoRutaSeleccionado || gps.tipo === tipoRutaSeleccionado) &&
        normalizarNombreRuta(gps.ruta) ===
          normalizarNombreRuta(rutaSeleccionada)
    );
  }, [rutaSeleccionada, tipoRutaSeleccionado, zonaSeleccionada]);

  const gpsBus01Seleccionado = gpsExternosFiltrados.find(
    (gps) => gps.id === "gps-bus-01"
  );

  const usuariosRutaSeleccionada = rutaSeleccionada
    ? conteoUsuariosPorRuta[rutaSeleccionada] || 0
    : 0;
  const kilometrosUsuario = obtenerNumero(usuarioKm.kmTotales);
  const rutaMapaSeleccionada = rutasDeZona.find(
    (ruta) => ruta.nombre === rutaSeleccionada
  );
  const lugaresCercanosVisibles = useMemo(() => {
    if (!ubicacion) return [];

    return lugaresCercanos
      .map((lugar) => ({
        ...lugar,
        distanciaMetros: Math.round(
          distanciaMetros(ubicacion, [lugar.lat, lugar.lng])
        ),
      }))
      .filter((lugar) => lugar.distanciaMetros <= LUGARES_RADIO_M)
      .sort((a, b) => a.distanciaMetros - b.distanciaMetros)
      .slice(0, 3);
  }, [lugaresCercanos, ubicacion]);
  const lugaresMarcadoresVisibles = gpsBus01Seleccionado
    ? []
    : lugaresCercanosVisibles;
  const posicionGpsBus01: [number, number] | null = gpsBus01Seleccionado
    ? [gpsBus01Seleccionado.lat, gpsBus01Seleccionado.lng]
    : null;
  const distanciaGpsBus01Metros =
    ubicacion && posicionGpsBus01
      ? distanciaMetros(ubicacion, posicionGpsBus01)
      : null;
  const mostrarControlesGpsBusPasajero =
    modoUsuario === "pasajero" && Boolean(gpsBus01Seleccionado);
  // Hay actividad real en la ruta si existe un autobus en vivo o el GPS externo.
  const hayBusActivo =
    busesFiltrados.length > 0 || Boolean(gpsBus01Seleccionado);
  // Distancia real al autobus mas cercano (en vivo o GPS externo) cuando hay
  // ubicacion del usuario. Solo usa datos reales; null si no se puede calcular.
  const distanciaBusMasCercanaMetros = useMemo(() => {
    const distancias: number[] = [];

    if (infoBusCercano?.distancia !== null && infoBusCercano?.distancia !== undefined) {
      distancias.push(infoBusCercano.distancia);
    }

    if (distanciaGpsBus01Metros !== null) {
      distancias.push(distanciaGpsBus01Metros);
    }

    if (distancias.length === 0) return null;

    return Math.min(...distancias);
  }, [infoBusCercano, distanciaGpsBus01Metros]);
  // Alerta simple de proximidad: el bus mas cercano esta a menos de 300 m.
  const busLlegando =
    distanciaBusMasCercanaMetros !== null &&
    distanciaBusMasCercanaMetros < PROXIMIDAD_BUS_LLEGANDO_M;
  const esZonaNorteSeleccionada =
    zonaSeleccionada === "Zona Norte / Altamira";
  const clasePantallaRutas = esZonaNorteSeleccionada
    ? "rt-route-list-screen rt-route-list-screen--north"
    : "rt-route-list-screen rt-route-list-screen--tampico";

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

  // El chofer publica su ubicacion en vivo en "autobuses/{sessionId}". Cada
  // nueva posicion del GPS sobrescribe el documento (status "active"), para que
  // los pasajeros lo vean moverse. No toca usuariosEnLinea ni Viaje Seguro.
  const iniciarTransmisionGps = () => {
    if (transmitiendoGps) return;

    if (!rutaSeleccionada) {
      setMensajeAccionRuta("Selecciona una ruta antes de transmitir tu ubicación.");
      return;
    }

    if (!navigator.geolocation) {
      alert("Tu navegador no permite ubicación.");
      return;
    }

    const sessionId = userId || obtenerOCrearUserId();
    setUserId(sessionId);
    sessionTransmisionRef.current = sessionId;

    const rutaActual = rutaSeleccionada;
    const busRef = doc(db, "autobuses", sessionId);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setUbicacion([lat, lng]);

        void setDoc(
          busRef,
          {
            lat,
            lng,
            heading: leerHeading(pos.coords.heading),
            speed:
              typeof pos.coords.speed === "number" &&
              Number.isFinite(pos.coords.speed)
                ? pos.coords.speed
                : null,
            routeId: rutaActual,
            routeName: rutaActual,
            status: "active",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch((error) => {
          console.error("No se pudo publicar el GPS del chofer", error);
        });
      },
      () => {
        setMensajeAccionRuta(
          "No se pudo obtener tu ubicación para transmitir. Revisa los permisos de GPS."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    watchIdRef.current = watchId;
    setTransmitiendoGps(true);
    setMensajeAccionRuta("Estás transmitiendo tu ubicación en vivo.");
  };

  const detenerTransmisionGps = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTransmitiendoGps(false);

    const sessionId = sessionTransmisionRef.current;
    sessionTransmisionRef.current = null;

    if (sessionId) {
      try {
        await deleteDoc(doc(db, "autobuses", sessionId));
      } catch (error) {
        // Si no se logra borrar, la ventana de 2 minutos lo marca inactivo.
        console.error("No se pudo eliminar el autobús del chofer", error);
      }
    }

    setMensajeAccionRuta("Dejaste de transmitir tu ubicación.");
  };

  const verBusYMiUbicacion = () => {
    if (!gpsBus01Seleccionado) return;

    if (!navigator.geolocation) {
      alert("Tu navegador no permite ubicación.");
      setCentrarGpsSolicitud((valor) => valor + 1);
      return;
    }

    if (ubicacion) {
      setCentrarUsuarioYGpsSolicitud((valor) => valor + 1);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion([pos.coords.latitude, pos.coords.longitude]);
        setCentrarUsuarioYGpsSolicitud((valor) => valor + 1);
      },
      () => {
        alert("No se pudo obtener tu ubicación.");
        setCentrarGpsSolicitud((valor) => valor + 1);
      }
    );
  };

  const centrarRutaEnMapa = () => {
    if (!rutaMapaSeleccionada) return;

    setCentrarRutaSolicitud((valor) => valor + 1);
  };

  // "Estoy esperando esta ruta": al activarlo se registra el reporte en
  // Firestore (coleccion "sugerencias", permitida por las reglas actuales) con
  // routeId, routeName, ubicacion del usuario si existe, timestamp y
  // status: "waiting". Sin login y sin datos personales. Al desactivar solo se
  // limpia el estado local; no se borra nada en Firestore.
  const toggleEsperandoRuta = async () => {
    if (enviandoEspera) return;

    if (esperandoRuta) {
      setEsperandoRuta(false);
      setMensajeAccionRuta("Dejaste de esperar esta ruta.");
      return;
    }

    if (!rutaSeleccionada) {
      setMensajeAccionRuta("Selecciona una ruta antes de marcar que esperas.");
      return;
    }

    setEnviandoEspera(true);
    setMensajeAccionRuta("Registrando que esperas esta ruta...");

    try {
      await addDoc(collection(db, "sugerencias"), {
        tipo: "esperando_ruta",
        origen: "mapa_pasajero",
        routeId: rutaSeleccionada,
        routeName: rutaSeleccionada,
        ruta: rutaSeleccionada,
        zona: zonaSeleccionada,
        status: "waiting",
        userLocation: ubicacion
          ? { lat: ubicacion[0], lng: ubicacion[1] }
          : null,
        latUsuario: ubicacion?.[0] ?? null,
        lngUsuario: ubicacion?.[1] ?? null,
        timestamp: serverTimestamp(),
        fecha: serverTimestamp(),
      });

      setEsperandoRuta(true);
      setMensajeAccionRuta("Listo, marcaste que estás esperando esta ruta.");
    } catch (error) {
      console.error("No se pudo registrar la espera de ruta", error);
      setMensajeAccionRuta("No se pudo registrar tu espera. Intenta otra vez.");
    } finally {
      setEnviandoEspera(false);
    }
  };

  // "Reportar que ya pasó": se guarda en la coleccion "sugerencias" (permitida
  // por las reglas de Firestore actuales) con un tipo distintivo, para no crear
  // una coleccion nueva que quedaria bloqueada por reglas.
  const reportarQueYaPaso = async () => {
    if (reportandoPaso) return;

    if (!rutaSeleccionada) {
      setMensajeAccionRuta("Selecciona una ruta antes de reportar.");
      return;
    }

    setReportandoPaso(true);
    setMensajeAccionRuta("Enviando tu reporte...");

    try {
      await addDoc(collection(db, "sugerencias"), {
        tipo: "reporte_paso",
        origen: "mapa_pasajero",
        ruta: rutaSeleccionada,
        zona: zonaSeleccionada,
        comentario: "El usuario reporta que el autobús ya pasó.",
        latUsuario: ubicacion?.[0] ?? null,
        lngUsuario: ubicacion?.[1] ?? null,
        fecha: serverTimestamp(),
      });

      setMensajeAccionRuta("Gracias. Registramos que el bus ya pasó.");
    } catch (error) {
      console.error("No se pudo registrar el reporte de paso", error);
      setMensajeAccionRuta("No se pudo enviar el reporte. Intenta otra vez.");
    } finally {
      setReportandoPaso(false);
    }
  };

  const registrarClickNegocio = async (
    lugar: LugarCercano,
    origen: "tarjeta" | "marcador" | "popup"
  ) => {
    setNegocioSeleccionado(lugar);
    setConteoClicksNegocio((actual) => ({
      ...actual,
      [lugar.id]: (actual[lugar.id] || 0) + 1,
    }));

    const ahora = Date.now();
    const ultimoClick = clicksNegociosRef.current[lugar.id] || 0;

    if (ahora - ultimoClick < CLICK_NEGOCIO_COOLDOWN_MS) return;

    clicksNegociosRef.current[lugar.id] = ahora;

    try {
      const id = userId || obtenerOCrearUserId();
      setUserId(id);

      await addDoc(collection(db, "clicksNegocios"), {
        placeId: lugar.id,
        nombre: lugar.nombre,
        categoria: lugar.categoria,
        ruta: rutaSeleccionada || null,
        zona: zonaSeleccionada,
        distanciaMetros: lugar.distanciaMetros,
        rating: typeof lugar.rating === "number" ? lugar.rating : null,
        latNegocio: lugar.lat,
        lngNegocio: lugar.lng,
        latUsuario: ubicacion?.[0] ?? null,
        lngUsuario: ubicacion?.[1] ?? null,
        origen,
        userId: id,
        userAgent: navigator.userAgent.slice(0, 200),
        fecha: serverTimestamp(),
      });
    } catch (error) {
      console.error("No se pudo registrar el click del negocio", error);
    }
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
          className="rt-zone-button rt-zone-button--tampico"
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
          <span>📍 Tampico / Madero</span>
          <span aria-hidden="true">🚌</span>
        </button>

        <button
          onClick={() => cambiarZona("Zona Norte / Altamira")}
          className="rt-zone-button rt-zone-button--north"
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
          <span>🌴 Zona Norte</span>
          <span aria-hidden="true">🚙</span>
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
      <div className={clasePantallaRutas}>
        <div className="rt-route-list-hero">
          <span className="rt-route-list-hero__eyebrow">
            {esZonaNorteSeleccionada
              ? "Rutas Tampico MAFA"
              : obtenerEtiquetaTipoRuta(tipoRutaSeleccionado)}
          </span>
          <h1>{obtenerEtiquetaZona(zonaSeleccionada)}</h1>
          <p>
            {esZonaNorteSeleccionada
              ? "Selecciona tu ruta"
              : "Elige tu ruta con estilo cartoon."}
          </p>
        </div>

        <div className="rt-route-list-grid">
          {rutasDeZona.length === 0 && (
            <div className="rt-route-empty">
              No hay rutas en esta selección.
            </div>
          )}

          {rutasDeZona.map((ruta, index) => {
            const usuariosRuta = conteoUsuariosPorRuta[ruta.nombre] || 0;
            const enServicio = rutasConActividad.has(ruta.nombre);

            return (
              <button
                key={ruta.nombre}
                onClick={() => seleccionarRuta(ruta.nombre)}
                className={
                  esZonaNorteSeleccionada
                    ? "rt-route-card rt-route-card--north"
                    : "rt-route-card rt-route-card--tampico"
                }
                style={{ "--route-color": ruta.color } as CSSProperties}
              >
                <span className="rt-route-card__badge">
                  {esZonaNorteSeleccionada
                    ? `Ruta ${101 + index}`
                    : String(index + 1).padStart(2, "0")}
                </span>
                <span className="rt-route-card__content">
                  <span className="rt-route-card__name">{ruta.nombre}</span>
                  <span className="rt-route-card__meta">
                    <span
                      className={
                        enServicio
                          ? "rt-route-card__status rt-route-card__status--on"
                          : "rt-route-card__status rt-route-card__status--off"
                      }
                    >
                      {enServicio ? "● En servicio" : "○ Sin actividad"}
                    </span>
                    <span>📍 {obtenerEtiquetaZona(ruta.zona)}</span>
                    <span>{usuariosRuta} usuarios en esta ruta</span>
                  </span>
                  <span className="rt-route-card__cta" aria-hidden="true">
                    Ver ruta →
                  </span>
                </span>
                {esZonaNorteSeleccionada ? (
                  <span className="rt-route-card__scene" aria-hidden="true">
                    <span className="rt-route-card__palm">🌴</span>
                    <span className="rt-route-card__bus">🚙</span>
                  </span>
                ) : (
                  <>
                    <span className="rt-route-card__scene" aria-hidden="true">
                      <span className="rt-route-card__sun">☀️</span>
                      <span className="rt-route-card__bus">🚌</span>
                    </span>
                    <span className="rt-route-card__lights" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={regresarAZonas}
          className="rt-route-back"
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
          <span>Km: {kilometrosUsuario.toFixed(2)}</span>
        </div>

        {mostrarControlesGpsBusPasajero && (
          <button
            type="button"
            onClick={verBusYMiUbicacion}
            className="rt-mini-pill"
            style={{ marginTop: 8, background: "#facc15", color: "#422006" }}
          >
            Ver bus y mi ubicación
          </button>
        )}
      </div>

      <div className="rt-bottom-sheet">
        <div className="rt-bottom-sheet__header">
          <div>
            <span className="rt-bottom-sheet__label">Ruta activa</span>
            <strong>{rutaSeleccionada || "Ruta seleccionada"}</strong>
          </div>
          <span
            className={
              ubicacion ? "rt-gps-badge" : "rt-gps-badge rt-gps-badge--off"
            }
          >
            {ubicacion ? "GPS ACTIVO" : "GPS PENDIENTE"}
          </span>
        </div>

        <div className="rt-bottom-sheet__metrics">
          <span>
            <small>Camiones</small>
            <b>{busesFiltrados.length}</b>
          </span>
          <span>
            <small>Usuarios</small>
            <b>{usuariosRutaSeleccionada}</b>
          </span>
          <span>
            <small>Kilómetros</small>
            <b>{kilometrosUsuario.toFixed(2)}</b>
          </span>
          {mostrarControlesGpsBusPasajero && distanciaGpsBus01Metros !== null && (
            <span>
              <small>GPS Bus 01</small>
              <b>{formatearDistanciaBus(distanciaGpsBus01Metros)}</b>
            </span>
          )}
          {mostrarControlesGpsBusPasajero && distanciaGpsBus01Metros !== null && (
            <span>
              <small>ETA aprox</small>
              <b>{formatearEtaBus(distanciaGpsBus01Metros)}</b>
            </span>
          )}
        </div>

        {modoUsuario === "pasajero" && busLlegando && (
          <div className="rt-bus-arriving" role="status">
            <span className="rt-bus-arriving__icon" aria-hidden="true">🚌</span>
            <span>Tu autobús está llegando</span>
          </div>
        )}

        {modoUsuario === "pasajero" && (
          <div className="rt-bus-status">
            {hayBusActivo ? (
              infoBusCercano ? (
                <>
                  <div className="rt-bus-status__head">
                    <span className="rt-bus-status__dot" aria-hidden="true" />
                    <strong>Chofer activo</strong>
                    {busesFiltrados.length > 1 && (
                      <span className="rt-bus-status__count">
                        {busesFiltrados.length} en ruta · más cercano
                      </span>
                    )}
                  </div>
                  <div className="rt-bus-status__dist">
                    {formatearDistanciaCorta(infoBusCercano.distancia)}
                  </div>
                  {infoBusCercano.distancia !== null && (
                    <div className="rt-bus-status__eta">
                      🚌 Llega en {formatearEtaBus(infoBusCercano.distancia)} ·{" "}
                      {formatearDistanciaSimple(infoBusCercano.distancia)}
                    </div>
                  )}
                  <div className="rt-bus-status__time">
                    {formatearHaceTiempo(infoBusCercano.actualizadoMs, ahora)}
                  </div>
                  {infoBusCercano.distancia === null && (
                    <small className="rt-bus-status__hint">
                      Activa “Mi ubicación” para ver la distancia exacta.
                    </small>
                  )}
                </>
              ) : (
                <>
                  <div className="rt-bus-status__head">
                    <span className="rt-bus-status__dot" aria-hidden="true" />
                    <strong>Bus con GPS activo</strong>
                  </div>
                  <div className="rt-bus-status__time">
                    Ubicación por GPS de la ruta. Distancia y ETA arriba 👆
                  </div>
                  {distanciaGpsBus01Metros === null && (
                    <small className="rt-bus-status__hint">
                      Activa “Mi ubicación” para ver la distancia al bus.
                    </small>
                  )}
                </>
              )
            ) : (
              <div className="rt-bus-status__empty">
                No hay autobús activo en esta ruta por ahora.
              </div>
            )}
          </div>
        )}

        {modoUsuario === "pasajero" && (
          <div className="rt-route-actions">
            <button
              type="button"
              onClick={toggleEsperandoRuta}
              disabled={enviandoEspera}
              className={
                esperandoRuta
                  ? "rt-route-action rt-route-action--waiting rt-route-action--on"
                  : "rt-route-action rt-route-action--waiting"
              }
            >
              {enviandoEspera
                ? "Registrando..."
                : esperandoRuta
                ? "✓ Esperando esta ruta"
                : "Estoy esperando esta ruta"}
            </button>

            <button
              type="button"
              onClick={reportarQueYaPaso}
              disabled={reportandoPaso}
              className="rt-route-action rt-route-action--report"
            >
              {reportandoPaso ? "Enviando..." : "Reportar que ya pasó"}
            </button>
          </div>
        )}

        {modoUsuario === "pasajero" && mensajeAccionRuta && (
          <div className="rt-route-action-msg">{mensajeAccionRuta}</div>
        )}

        {modoUsuario === "chofer" && (
          <div className="rt-driver-actions">
            <button
              type="button"
              onClick={
                transmitiendoGps
                  ? detenerTransmisionGps
                  : iniciarTransmisionGps
              }
              disabled={!rutaSeleccionada && !transmitiendoGps}
              className={
                transmitiendoGps
                  ? "rt-route-action rt-route-action--broadcast rt-route-action--on"
                  : "rt-route-action rt-route-action--broadcast"
              }
            >
              {transmitiendoGps
                ? "⏹ Detener GPS en vivo"
                : "🟢 Iniciar GPS en vivo"}
            </button>
          </div>
        )}

        {modoUsuario === "chofer" && mensajeAccionRuta && (
          <div className="rt-route-action-msg">{mensajeAccionRuta}</div>
        )}

        <div className="rt-trip-actions">
          <button
            type="button"
            onClick={() => setMostrarDetalleKm((prev) => !prev)}
            className="rt-trip-button rt-trip-button--ghost"
          >
            Ver km
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

      <div
        className={
          modoUsuario === "pasajero"
            ? "rt-floating-controls"
            : "rt-floating-controls rt-floating-controls--compact"
        }
      >
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
          onClick={centrarRutaEnMapa}
          disabled={!rutaMapaSeleccionada}
          className="rt-fab rt-fab--dark"
          aria-label="Centrar ruta"
        >
          <span>Centrar ruta</span>
        </button>

        <button
          type="button"
          onClick={() => setLugaresActivos((activo) => !activo)}
          className={
            lugaresActivos
              ? "rt-fab rt-fab--places rt-fab--active"
              : "rt-fab rt-fab--places"
          }
          aria-label="Activar lugares cercanos"
        >
          <span>Lugares</span>
          {lugaresActivos && <small>{cargandoLugares ? "Buscando" : "Activo"}</small>}
        </button>

        <button
          type="button"
          onClick={obtenerMiUbicacion}
          className={
            ubicacion
              ? "rt-fab rt-fab--primary rt-fab--active"
              : "rt-fab rt-fab--primary"
          }
          aria-label="Ir a mi ubicación"
        >
          <span>Mi ubicación</span>
          {ubicacion && <small>GPS activo</small>}
        </button>
      </div>

      {lugaresActivos &&
        ES_DESARROLLO &&
        GOOGLE_MAPS_API_KEY &&
        ubicacion && (
          <div className="rt-nearby-debug">
            Negocios cercanos encontrados: {lugaresCercanosVisibles.length}
          </div>
        )}

      {lugaresActivos &&
        (lugaresCercanosVisibles.length > 0 || mensajeLugares) && (
        <div className="rt-nearby-card">
          {lugaresCercanosVisibles.length > 0 ? (
            <>
              <span className="rt-nearby-card__eyebrow">Cerca de ti</span>
              <div className="rt-nearby-card__list">
                {lugaresCercanosVisibles.map((lugar) => (
                  <div
                    key={lugar.id}
                    className="rt-nearby-card__item"
                    role="button"
                    tabIndex={0}
                    onClick={() => void registrarClickNegocio(lugar, "tarjeta")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void registrarClickNegocio(lugar, "tarjeta");
                      }
                    }}
                  >
                    <strong>
                      {lugar.nombre} – a {lugar.distanciaMetros} m
                    </strong>
                    <small>
                      {ETIQUETAS_LUGARES[lugar.categoria]}
                      {typeof lugar.rating === "number"
                        ? ` · ⭐ ${lugar.rating.toFixed(1)}`
                        : ""}
                      {" · Toca para ver detalles"}
                    </small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <span>{mensajeLugares}</span>
          )}
        </div>
      )}

      {negocioSeleccionado && (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: "calc(240px + env(safe-area-inset-bottom))",
            zIndex: 100000,
            border: "1px solid rgba(125, 211, 252, 0.32)",
            borderRadius: 24,
            background: "linear-gradient(135deg, rgba(15,23,42,.97), rgba(30,41,59,.94))",
            color: "white",
            boxShadow: "0 22px 58px rgba(0,0,0,.45)",
            padding: 16,
            maxWidth: 430,
            margin: "0 auto",
          }}
        >
          <button
            type="button"
            onClick={() => setNegocioSeleccionado(null)}
            aria-label="Cerrar detalle del negocio"
            style={{
              position: "absolute",
              top: 10,
              right: 12,
              width: 34,
              height: 34,
              border: "0",
              borderRadius: 999,
              background: "rgba(255,255,255,.12)",
              color: "white",
              fontSize: 24,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            ×
          </button>

          <span
            style={{
              color: "#5eead4",
              display: "block",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            {ETIQUETAS_LUGARES[negocioSeleccionado.categoria]}
          </span>
          <h2 style={{ fontSize: 22, margin: "6px 42px 8px 0", fontWeight: 1000 }}>
            {negocioSeleccionado.nombre}
          </h2>

          <p style={{ color: "#dbeafe", fontSize: 14, lineHeight: 1.4, margin: "0 0 12px" }}>
            {crearDescripcionLugar(negocioSeleccionado)}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 6,
              color: "#e0f2fe",
              fontSize: 13,
              fontWeight: 800,
              marginBottom: 10,
            }}
          >
            <span>📍 {negocioSeleccionado.distanciaMetros} m de ti</span>
            {typeof negocioSeleccionado.rating === "number" && (
              <span>⭐ {negocioSeleccionado.rating.toFixed(1)} en Google</span>
            )}
            <span>
              👆 {conteoClicksNegocio[negocioSeleccionado.id] || 0} clics en esta sesión
            </span>
          </div>

          {negocioSeleccionado.direccion && (
            <small
              style={{
                display: "block",
                color: "#cbd5e1",
                fontSize: 12,
                lineHeight: 1.35,
                marginBottom: 12,
              }}
            >
              {negocioSeleccionado.direccion}
            </small>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {negocioSeleccionado.googleMapsUri && (
              <a
                href={negocioSeleccionado.googleMapsUri}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  void registrarClickNegocio(negocioSeleccionado, "popup")
                }
                style={{
                  borderRadius: 999,
                  background: "#2563eb",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 900,
                  padding: "10px 14px",
                  textDecoration: "none",
                }}
              >
                Ver en Google Maps
              </a>
            )}

            <button
              type="button"
              onClick={() =>
                void registrarClickNegocio(negocioSeleccionado, "popup")
              }
              style={{
                border: "0",
                borderRadius: 999,
                background: "#16a34a",
                color: "white",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 900,
                padding: "10px 14px",
              }}
            >
              Contar clic
            </button>
          </div>
        </div>
      )}

      <MapContainer
        center={[22.2553, -97.8686]}
        zoom={13}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <ControlarVistaMapa
          ubicacion={ubicacion}
          ruta={rutaMapaSeleccionada}
          centrarRutaSolicitud={centrarRutaSolicitud}
          gpsDestino={gpsBus01Seleccionado}
          centrarGpsSolicitud={centrarGpsSolicitud}
          centrarUsuarioYGpsSolicitud={centrarUsuarioYGpsSolicitud}
        />

        <TileLayer
          attribution={MAPA_PROFESIONAL.attribution}
          url={MAPA_PROFESIONAL.url}
          subdomains="abcd"
          detectRetina={true}
          maxZoom={20}
        />

        {/* Solo se dibuja la ruta seleccionada para no saturar el mapa. */}
        {rutaMapaSeleccionada && rutaMapaSeleccionada.puntos.length > 1 && (
          <>
            <Polyline
              positions={rutaMapaSeleccionada.puntos}
              pathOptions={{
                color: "#0f172a",
                weight: 9,
                opacity: 0.45,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={rutaMapaSeleccionada.puntos}
              pathOptions={{
                color: rutaMapaSeleccionada.color,
                weight: 5,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        )}

        {ubicacion && (
          <Marker position={ubicacion} icon={miUbicacionIcon} zIndexOffset={800}>
            <Popup>Estás aquí</Popup>
          </Marker>
        )}

        {ubicacion && posicionGpsBus01 && (
          <Polyline
            positions={[ubicacion, posicionGpsBus01]}
            pathOptions={{
              color: "#facc15",
              weight: 3,
              opacity: 0.68,
              dashArray: "8 10",
            }}
          />
        )}

        {lugaresActivos &&
          lugaresMarcadoresVisibles.map((lugar) => (
            <Marker
              key={lugar.id}
              position={[lugar.lat, lugar.lng]}
              icon={crearLugarIcon(lugar.categoria)}
              zIndexOffset={50}
              eventHandlers={{
                click: () => void registrarClickNegocio(lugar, "marcador"),
              }}
            >
              <Popup>
                <b>{lugar.nombre}</b>
                <br />
                {ETIQUETAS_LUGARES[lugar.categoria]}
                <br />
                Distancia: {lugar.distanciaMetros} m
                {typeof lugar.rating === "number" && (
                  <>
                    <br />
                    Rating: {lugar.rating.toFixed(1)}
                  </>
                )}
                <br />
                <button
                  type="button"
                  onClick={() => void registrarClickNegocio(lugar, "popup")}
                  style={{
                    marginTop: 8,
                    border: "0",
                    borderRadius: 999,
                    background: "#2563eb",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                    padding: "7px 10px",
                  }}
                >
                  Ver detalle
                </button>
              </Popup>
            </Marker>
          ))}

        {/* key estable (id del bus) + icono memoizado a nivel modulo para que
            Leaflet no reemplace el DOM del marcador y la animacion no se corte. */}
        {busesFiltrados.map((bus) => (
          <AnimatedBus key={bus.id} bus={bus} icon={busIcon} />
        ))}

        {gpsExternosFiltrados.map((gps) => (
          <GpsExternoMarker key={gps.id} gps={gps} />
        ))}
      </MapContainer>
    </div>
  );
}
