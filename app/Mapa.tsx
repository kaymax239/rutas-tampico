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
  onSnapshot,
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

const busIcon = new L.DivIcon({
  html: `
    <div style="
      display:flex;
      align-items:center;
      justify-content:center;
      width:42px;
      height:42px;
      background:white;
      border-radius:14px;
      box-shadow:0 8px 22px rgba(0,0,0,.35);
      border:3px solid #22c55e;
      font-size:24px;
      transform: rotate(-8deg);
    ">
      🚌
    </div>
  `,
  className: "",
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -18],
});

const miUbicacionIcon = new L.DivIcon({
  html: `
    <div style="
      width:18px;
      height:18px;
      background:#2563eb;
      border:3px solid white;
      border-radius:999px;
      box-shadow:0 0 12px rgba(37,99,235,.8);
    "></div>
  `,
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
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
    nombre: "Ruta Altamira UAT",
    color: "#06b6d4",
    puntos: [
      [22.392, -97.92],
      [22.372, -97.905],
      [22.345, -97.89],
      [22.318, -97.878],
      [22.292, -97.866],
      [22.268, -97.858],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta Pedrera UAT",
    color: "#f59e0b",
    puntos: [
      [22.43, -97.935],
      [22.408, -97.922],
      [22.382, -97.906],
      [22.35, -97.892],
      [22.318, -97.878],
      [22.268, -97.858],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta Azteca UAT",
    color: "#8b5cf6",
    puntos: [
      [22.405, -97.91],
      [22.388, -97.898],
      [22.362, -97.886],
      [22.335, -97.876],
      [22.302, -97.866],
      [22.268, -97.858],
    ],
  },
  {
    zona: "Zona Norte / Altamira",
    nombre: "Ruta Blanco Kinder",
    color: "#ec4899",
    puntos: [
      [22.418, -97.918],
      [22.397, -97.904],
      [22.372, -97.892],
      [22.342, -97.881],
      [22.31, -97.872],
      [22.276, -97.864],
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

function AjustarMapa({
  ubicacion,
  rutasVisibles,
}: {
  ubicacion: [number, number] | null;
  rutasVisibles: Ruta[];
}) {
  const map = useMap();

  useEffect(() => {
    if (ubicacion) {
      map.flyTo(ubicacion, 15, { duration: 1 });
      return;
    }

    const puntos = rutasVisibles.flatMap((ruta) => ruta.puntos);

    if (puntos.length > 0) {
      map.fitBounds(L.latLngBounds(puntos), {
        paddingTopLeft: [24, 180],
        paddingBottomRight: [24, 120],
      });
    }
  }, [ubicacion, map, rutasVisibles]);

  return null;
}

export default function Mapa() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [ubicacion, setUbicacion] = useState<[number, number] | null>(null);
  const [zonaSeleccionada, setZonaSeleccionada] =
    useState<Zona>("Tampico / Madero");
  const [rutaSeleccionada, setRutaSeleccionada] = useState<string>("");
  const [pantallaPasajero, setPantallaPasajero] =
    useState<"zonas" | "rutas" | "mapa">("zonas");

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

  const rutasDeZona = useMemo(() => {
    return rutas.filter((ruta) => ruta.zona === zonaSeleccionada);
  }, [zonaSeleccionada]);

  const rutasVisibles = rutas;

  const busesFiltrados = useMemo(() => {
    if (!rutaSeleccionada) return [];

    return buses.filter(
      (b) =>
        b.nombre?.toLowerCase().includes(rutaSeleccionada.toLowerCase()) ||
        b.ruta?.toLowerCase().includes(rutaSeleccionada.toLowerCase())
    );
  }, [buses, rutaSeleccionada]);

  const rutaActiva = useMemo(() => {
    return rutasVisibles.find((ruta) => ruta.nombre === rutaSeleccionada) ?? null;
  }, [rutasVisibles, rutaSeleccionada]);

  const cambiarZona = (zona: Zona) => {
    setZonaSeleccionada(zona);
    setRutaSeleccionada("");
    setPantallaPasajero("rutas");
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

  if (pantallaPasajero === "zonas") {
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
        <h1 style={{ color: "white", textAlign: "center", fontSize: 28, fontWeight: 800 }}>
          Selecciona tu zona
        </h1>

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
          }}
        >
          📍 Zona Norte / Altamira
        </button>
      </div>
    );
  }

  if (pantallaPasajero === "rutas") {
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
          Selecciona tu ruta
        </h1>

        <p style={{ color: "#cbd5e1", marginBottom: 20 }}>
          Zona: {zonaSeleccionada}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rutasDeZona.map((ruta) => (
            <button
              key={ruta.nombre}
              onClick={() => {
                setRutaSeleccionada(ruta.nombre);
                setPantallaPasajero("mapa");
              }}
              style={{
                padding: 18,
                borderRadius: 18,
                border: "none",
                background: ruta.color,
                color: "white",
                fontSize: 18,
                fontWeight: 800,
                textAlign: "left",
              }}
            >
              🚍 {ruta.nombre}
            </button>
          ))}
        </div>

        <button
          onClick={() => setPantallaPasajero("zonas")}
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 999,
            border: "none",
            background: "white",
            color: "#111827",
            fontWeight: 800,
            width: "100%",
          }}
        >
          ← Regresar a zonas
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        background: "#020617",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 500,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(2,6,23,.58) 0%, rgba(2,6,23,.04) 32%, rgba(2,6,23,.72) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          right: 14,
          zIndex: 99999,
          background:
            "linear-gradient(135deg, rgba(2,6,23,.94), rgba(15,23,42,.88))",
          color: "white",
          border: "1px solid rgba(255,255,255,.18)",
          borderRadius: 26,
          padding: 16,
          boxShadow: "0 22px 65px rgba(0,0,0,.48)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(34,197,94,.14)",
                border: "1px solid rgba(74,222,128,.28)",
                color: "#bbf7d0",
                padding: "5px 9px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.6,
                marginBottom: 9,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: "#22c55e",
                  boxShadow: "0 0 14px #22c55e",
                }}
              />
              EN VIVO
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: rutaActiva?.color ?? "#38bdf8",
                  boxShadow: `0 0 24px ${rutaActiva?.color ?? "#38bdf8"}`,
                  flex: "0 0 auto",
                }}
              />
              <div
                style={{
                  fontSize: 18,
                  lineHeight: 1.15,
                  fontWeight: 950,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {rutaActiva?.nombre ?? "Rutas Tampico"}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,.1)",
              border: "1px solid rgba(255,255,255,.14)",
              borderRadius: 18,
              padding: "9px 11px",
              textAlign: "center",
              flex: "0 0 auto",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 950 }}>
              {busesFiltrados.length}
            </div>
            <div style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 800 }}>
              BUSES
            </div>
          </div>
        </div>

        <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 10 }}>
          Todas las zonas · {rutasVisibles.length} rutas visibles con color real
        </div>

        <button
          onClick={() => setPantallaPasajero("rutas")}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.18)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,.98), rgba(226,232,240,.94))",
            color: "#0f172a",
            fontWeight: 900,
            boxShadow: "0 12px 28px rgba(2,6,23,.32)",
          }}
        >
          Cambiar ruta
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 18,
          zIndex: 99999,
          display: "flex",
          gap: 10,
          overflowX: "auto",
          padding: "12px 2px",
        }}
      >
        {rutasVisibles.map((ruta) => {
          const esRutaActiva = ruta.nombre === rutaSeleccionada;

          return (
            <button
              key={ruta.nombre}
              onClick={() => {
                setZonaSeleccionada(ruta.zona);
                setRutaSeleccionada(ruta.nombre);
              }}
              style={{
                border: esRutaActiva
                  ? "1px solid rgba(255,255,255,.82)"
                  : "1px solid rgba(255,255,255,.2)",
                background: esRutaActiva
                  ? `linear-gradient(135deg, ${ruta.color}, rgba(15,23,42,.92))`
                  : "rgba(15,23,42,.82)",
                color: "white",
                borderRadius: 999,
                padding: "10px 14px",
                fontSize: 12,
                fontWeight: 900,
                whiteSpace: "nowrap",
                boxShadow: esRutaActiva
                  ? `0 0 28px ${ruta.color}`
                  : "0 10px 24px rgba(0,0,0,.28)",
                backdropFilter: "blur(14px)",
                cursor: "pointer",
              }}
            >
              <span style={{ color: esRutaActiva ? "white" : ruta.color }}>
                ●
              </span>{" "}
              {ruta.nombre}
            </button>
          );
        })}
      </div>

      <MapContainer
        center={[22.2553, -97.8686]}
        zoom={12}
        zoomControl={false}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%", background: "#020617" }}
      >
        <AjustarMapa ubicacion={ubicacion} rutasVisibles={rutasVisibles} />

        <TileLayer
          attribution='&copy; OpenStreetMap &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {rutasVisibles.map((ruta) => {
          const esRutaActiva = ruta.nombre === rutaSeleccionada;

          return (
            <Fragment key={ruta.nombre}>
              <Polyline
                positions={ruta.puntos}
                pathOptions={{
                  color: "#000000",
                  weight: esRutaActiva ? 20 : 14,
                  opacity: esRutaActiva ? 0.34 : 0.22,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />

              <Polyline
                positions={ruta.puntos}
                pathOptions={{
                  color: ruta.color,
                  weight: esRutaActiva ? 16 : 10,
                  opacity: esRutaActiva ? 0.28 : 0.16,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />

              <Polyline
                positions={ruta.puntos}
                pathOptions={{
                  color: ruta.color,
                  weight: esRutaActiva ? 7 : 4,
                  opacity: esRutaActiva ? 1 : 0.78,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              >
                <Popup>
                  <b>{ruta.nombre}</b>
                  <br />
                  Zona: {ruta.zona}
                </Popup>
              </Polyline>
            </Fragment>
          );
        })}

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