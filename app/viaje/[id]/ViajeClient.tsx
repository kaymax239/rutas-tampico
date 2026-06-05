"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

type Viaje = {
  id: string;
  nombre?: string;
  lat: number;
  lng: number;
};

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

export default function ViajeClient() {
  const params = useParams();
  const id = params?.id as string;

  const [viaje, setViaje] = useState<Viaje | null>(null);

  useEffect(() => {
    if (!id) return;

    const viajeRef = doc(db, "autobuses", id);

    const unsub = onSnapshot(viajeRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<Omit<Viaje, "id">>;

        setViaje({
          id: snap.id,
          nombre: data.nombre,
          lat: Number(data.lat),
          lng: Number(data.lng),
        });
      }
    });

    return () => unsub();
  }, [id]);

  if (!viaje) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "20px",
        }}
      >
        Cargando viaje...
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
      }}
    >
      <div
        style={{
          padding: 15,
          textAlign: "center",
          fontSize: 24,
          fontWeight: "bold",
        }}
      >
        {viaje.nombre || "Ruta en vivo"}
      </div>

      <div style={{ height: "85vh", width: "100%" }}>
        <MapContainer
          center={[viaje.lat, viaje.lng]}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Marker position={[viaje.lat, viaje.lng]}>
            <Popup>
              {viaje.nombre}
              <br />
              Bus en vivo
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </main>
  );
}
