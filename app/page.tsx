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
          background:
            "radial-gradient(circle at top left, rgba(37,99,235,.32), transparent 34%), radial-gradient(circle at bottom right, rgba(34,197,94,.22), transparent 36%), #020617",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: 20,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(145deg, rgba(15,23,42,.96), rgba(30,41,59,.9))",
            border: "1px solid rgba(255,255,255,.12)",
            padding: 22,
            borderRadius: 28,
            width: "100%",
            maxWidth: 460,
            marginTop: 18,
            marginBottom: 18,
            boxShadow: "0 24px 70px rgba(0,0,0,.5)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            backdropFilter: "blur(18px)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(37,99,235,.18)",
                border: "1px solid rgba(147,197,253,.28)",
                color: "#bfdbfe",
                padding: "8px 12px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              Transporte urbano en vivo
            </div>

            <h1
              style={{
                color: "white",
                fontSize: 34,
                lineHeight: 1.05,
                fontWeight: 900,
                margin: 0,
              }}
            >
              🚍 Rutas Tampico
            </h1>

            <p style={{ color: "#cbd5e1", margin: "12px 0 2px" }}>
              Elige una acción antes de entrar al mapa
            </p>
          </div>

          <button
            onClick={() => {
              setPasajeroActivo(true);
              setModo("pasajero");
            }}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #2563eb, #06b6d4)",
              color: "white",
              border: "1px solid rgba(255,255,255,.18)",
              padding: "18px 20px",
              borderRadius: 22,
              fontSize: 20,
              fontWeight: 900,
              cursor: "pointer",
              textAlign: "left",
              boxShadow: "0 16px 32px rgba(37,99,235,.34)",
            }}
          >
            👤 Soy Pasajero
          </button>

          <button
            onClick={abrirWhatsAppViajeSeguro}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #16a34a, #22c55e)",
              color: "white",
              border: "1px solid rgba(255,255,255,.18)",
              padding: "16px 18px",
              borderRadius: 20,
              fontSize: 17,
              fontWeight: 900,
              cursor: "pointer",
              textAlign: "left",
              boxShadow: "0 14px 30px rgba(22,163,74,.28)",
            }}
          >
            🛡️ Viaje Seguro
          </button>

          <button
            onClick={obtenerMiUbicacion}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #0f172a, #2563eb)",
              color: "white",
              border: "1px solid rgba(147,197,253,.24)",
              padding: "16px 18px",
              borderRadius: 20,
              fontSize: 17,
              fontWeight: 900,
              cursor: "pointer",
              textAlign: "left",
              boxShadow: "0 14px 30px rgba(37,99,235,.24)",
            }}
          >
            📍 Mi Ubicación
          </button>

          <button
            onClick={llamarEmergencias}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #991b1b, #ef4444)",
              color: "white",
              border: "1px solid rgba(255,255,255,.18)",
              padding: "16px 18px",
              borderRadius: 20,
              fontSize: 17,
              fontWeight: 900,
              cursor: "pointer",
              textAlign: "left",
              boxShadow: "0 14px 30px rgba(220,38,38,.3)",
            }}
          >
            🚨 911
          </button>

          <button
            onClick={() => setModo("chofer")}
            style={{
              width: "100%",
              background: "rgba(255,255,255,.08)",
              color: "white",
              border: "1px solid rgba(255,255,255,.14)",
              padding: 15,
              borderRadius: 18,
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            🚌 Soy Chofer
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