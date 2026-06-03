"use client";

import { useEffect, useMemo, useState } from "react";
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
type RutaZona = Zona | "Altamira" | "Altamira / Tampico";

type Ruta = {
  zona: RutaZona;
  nombre: string;
  color: string;
  puntos: [number, number][];
};

type MapaProps = {
  conteoUsuariosPorRuta?: Record<string, number>;
  onRutaSeleccionada?: (ruta: string | null) => void;
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
    zona: "Altamira",
    nombre: "Ruta 40 – Altamira Centro / Arboledas / Monte Alto",
    color: "#06b6d4",
    puntos: [
      [22.3920, -97.9380],
      [22.4035, -97.9290],
      [22.4150, -97.9215],
    ],
  },
  {
    zona: "Altamira",
    nombre: "Ruta 41 – Altamira Centro / Laguna Florida",
    color: "#22c55e",
    puntos: [
      [22.3925, -97.9385],
      [22.4015, -97.9460],
      [22.4100, -97.9550],
    ],
  },
  {
    zona: "Altamira",
    nombre: "Ruta 42 – Altamira Centro / Miramar / Pedrera",
    color: "#f97316",
    puntos: [
      [22.3920, -97.9380],
      [22.3810, -97.9270],
      [22.3710, -97.9150],
    ],
  },
  {
    zona: "Altamira / Tampico",
    nombre: "Ruta 43 – Monte Alto / Pedrera / Tampico",
    color: "#e11d48",
    puntos: [
      [22.4170, -97.9220],
      [22.4040, -97.9120],
      [22.3600, -97.8860],
    ],
  },
  {
    zona: "Altamira / Tampico",
    nombre: "Ruta 44 – Altamira Centro / Santa Elena / Tampico",
    color: "#6366f1",
    puntos: [
      [22.3920, -97.9380],
      [22.3730, -97.9180],
      [22.3360, -97.8890],
    ],
  },
  {
    zona: "Altamira",
    nombre: "Ruta 45 – Altamira Centro / Unidos Avanzamos",
    color: "#84cc16",
    puntos: [
      [22.3920, -97.9380],
      [22.4020, -97.9510],
      [22.4135, -97.9625],
    ],
  },
  {
    zona: "Altamira",
    nombre: "Ruta 46 – Altamira Centro / Los Prados / Monte Alto",
    color: "#0ea5e9",
    puntos: [
      [22.3920, -97.9380],
      [22.4050, -97.9330],
      [22.4180, -97.9240],
    ],
  },
  {
    zona: "Altamira",
    nombre: "Ruta 47 – Altamira Centro / Laguna de la Puerta",
    color: "#a855f7",
    puntos: [
      [22.3920, -97.9380],
      [22.3815, -97.9510],
      [22.3720, -97.9650],
    ],
  },
  {
    zona: "Altamira",
    nombre: "Ruta 48 – Altamira / Puerto Industrial",
    color: "#f43f5e",
    puntos: [
      [22.3920, -97.9380],
      [22.4300, -97.9000],
      [22.4600, -97.8750],
    ],
  },
  {
    zona: "Altamira",
    nombre: "Ruta 49 – Monte Alto / Puerto Industrial",
    color: "#14b8a6",
    puntos: [
      [22.4170, -97.9220],
      [22.4380, -97.9020],
      [22.4600, -97.8750],
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
  conteoUsuariosPorRuta = {},
  onRutaSeleccionada,
}: MapaProps) {
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

  const cambiarZona = (zona: Zona) => {
    setZonaSeleccionada(zona);
    setRutaSeleccionada("");
    onRutaSeleccionada?.(null);
    setPantallaPasajero("rutas");
  };

  const seleccionarRuta = (ruta: string) => {
    setRutaSeleccionada(ruta);
    onRutaSeleccionada?.(ruta);
    setPantallaPasajero("mapa");
  };

  const regresarARutas = () => {
    setRutaSeleccionada("");
    onRutaSeleccionada?.(null);
    setPantallaPasajero("rutas");
  };

  const regresarAZonas = () => {
    setRutaSeleccionada("");
    onRutaSeleccionada?.(null);
    setPantallaPasajero("zonas");
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
          }}
        >
          ← Regresar a zonas
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          zIndex: 99999,
          background: "rgba(15,23,42,.92)",
          color: "white",
          borderRadius: 18,
          padding: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>Rutas Tampico</div>

        <div style={{ fontSize: 13, opacity: 0.85 }}>
          👥 Usuarios en esta ruta: {usuariosRutaSeleccionada}
        </div>

        <div style={{ fontSize: 13, opacity: 0.85 }}>
          🚍 Autobuses en vivo: {busesFiltrados.length}
        </div>

        <button
          onClick={regresarARutas}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "10px 14px",
            borderRadius: 999,
            border: "none",
            background: "white",
            color: "#111827",
            fontWeight: 800,
          }}
        >
          Cambiar ruta
        </button>
      </div>

      <button
        type="button"
        onClick={obtenerMiUbicacion}
        style={{
          position: "absolute",
          right: 14,
          bottom: 24,
          zIndex: 99999,
          background: "#2563eb",
          color: "white",
          border: "none",
          padding: "12px 16px",
          borderRadius: 999,
          fontWeight: 800,
        }}
      >
        Mi ubicación
      </button>

      <MapContainer
        center={[22.2553, -97.8686]}
        zoom={12}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%" }}
      >
        <AjustarMapa ubicacion={ubicacion} />

        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {rutasDeZona
          .filter((ruta) => ruta.nombre === rutaSeleccionada)
          .map((ruta) => (
            <Polyline
              key={ruta.nombre}
              positions={ruta.puntos}
              pathOptions={{
                color: ruta.color,
                weight: 6,
                opacity: 0.9,
              }}
            />
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