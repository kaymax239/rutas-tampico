"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
});

export default function Home() {
  const [modo, setModo] = useState<"inicio" | "chofer" | "pasajero">("inicio");
  const [pasajeroActivo, setPasajeroActivo] = useState(false);

  useEffect(() => {
    if (modo === "pasajero" && pasajeroActivo) {
      const boton = document.getElementById("activar-pasajero");
      if (boton) (boton as HTMLButtonElement).click();
    }
  }, [modo, pasajeroActivo]);

  const activarPasajero = () => {
    setPasajeroActivo((prev) => !prev);
  };

  const abrirWhatsAppViajeSeguro = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no permite compartir ubicación.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const linkMapa = `https://www.google.com/maps?q=${lat},${lng}`;
        const mensaje =
          `🚍 Estoy usando Rutas Tampico.\n\n` +
          `🛡️ Te comparto mi ubicación por seguridad durante mi viaje.\n\n` +
          `📍 Mi ubicación actual:\n${linkMapa}\n\n` +
          `Por favor mantente pendiente.`;
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(
          mensaje
        )}`;
        window.location.href = url;
      },
      () => {
        alert("No se pudo obtener tu ubicación. Activa el GPS y permite ubicación.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const llamarEmergencias = () => {
    window.location.href = "tel:911";
  };

  const obtenerMiUbicacion = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no permite ubicación.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        alert(`Latitud: ${pos.coords.latitude}, Longitud: ${pos.coords.longitude}`);
      },
      () => {
        alert("No se pudo obtener tu ubicación.");
      }
    );
  };

  if (modo === "inicio") {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            background: "#111827",
            padding: 30,
            borderRadius: 24,
            width: "100%",
            maxWidth: 420,
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,.45)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <h1 style={{ color: "white", fontSize: 30, fontWeight: 800 }}>
            🚍 Rutas Tampico
          </h1>

          <p style={{ color: "#cbd5e1", marginBottom: 16 }}>
            Transporte en vivo para Tampico, Madero y Altamira
          </p>

          <button
            onClick={() => setModo("chofer")}
            style={{
              width: "100%",
              background: "#22c55e",
              color: "white",
              border: "none",
              padding: 18,
              borderRadius: 16,
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🚌 Soy Chofer
          </button>

          <button
            onClick={() => {
              activarPasajero();
              setModo("pasajero");
            }}
            style={{
              width: "100%",
              background: "#2563eb",
              color: "white",
              border: "none",
              padding: 18,
              borderRadius: 16,
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            👤 Soy Pasajero
          </button>

          <button
            onClick={abrirWhatsAppViajeSeguro}
            style={{
              width: "100%",
              background: "#16a34a",
              color: "white",
              border: "none",
              padding: 12,
              borderRadius: 16,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🛡️ Viaje Seguro WhatsApp
          </button>

          <button
            onClick={obtenerMiUbicacion}
            style={{
              width: "100%",
              background: "#2563eb",
              color: "white",
              border: "none",
              padding: 12,
              borderRadius: 16,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            📍 Mi Ubicación
          </button>

          <button
            onClick={llamarEmergencias}
            style={{
              width: "100%",
              background: "#dc2626",
              color: "white",
              border: "none",
              padding: 12,
              borderRadius: 16,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🚨 Emergencia 911
          </button>
        </div>
      </main>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <Mapa />
      <button
        onClick={() => setModo("inicio")}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 9999,
          background: "#111827",
          color: "white",
          border: "none",
          borderRadius: 999,
          padding: "10px 16px",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(0,0,0,.35)",
        }}
      >
        ← Inicio
      </button>
    </div>
  );
}