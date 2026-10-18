import rutasGeo from "./data/rutas.json";

export type Zona = "Tampico / Madero" | "Zona Norte / Altamira";

export type Ruta = {
  zona: Zona;
  nombre: string;
  color: string;
  puntos: [number, number][];
  waypoints?: [number, number][];
  estadoTrazo?: string;
};

export type EstadoGpsExterno = "En línea" | "Fuera de línea";

export type GpsExterno = {
  id: string;
  nombre: string;
  ruta: string;
  proveedor: string;
  categoria: string;
  estado: EstadoGpsExterno;
  lat: number;
  lng: number;
  urlRastreador: string;
};

// Datos de rutas: app/data/rutas.json (GeoJSON, también en public/rutas.geojson).
// Se regenera con `node scripts/snap-routes.mjs` (trazos ajustados a calles con OSRM).
type RutaFeature = {
  properties: { nombre: string; zona: Zona; color: string; waypoints: [number, number][]; estado: string };
  geometry: { coordinates: [number, number][] };
};

export const rutas: Ruta[] = (rutasGeo as unknown as { features: RutaFeature[] }).features.map((f) => ({
  zona: f.properties.zona,
  nombre: f.properties.nombre,
  color: f.properties.color,
  // GeoJSON es [lng, lat]; Leaflet usa [lat, lng]
  puntos: f.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
  waypoints: f.properties.waypoints,
  estadoTrazo: f.properties.estado,
}));

export const GPS_EXTERNOS: GpsExterno[] = [
  {
    id: "gps-bus-01",
    nombre: "GPS Bus 01",
    ruta: "Tampico - Altamira",
    proveedor: "Steren GPS-1100",
    categoria: "GPS Externos",
    estado: "En línea",
    lat: 22.364418,
    lng: -97.882343,
    urlRastreador: "https://www.gps.steren.com.mx/page/share.jsp?mapType=google&token=S1782665340456O774186ac37ac9416dae5f77dcb82d8c85d516a",
  },
];
