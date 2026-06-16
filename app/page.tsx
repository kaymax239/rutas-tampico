"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useOnlineUsers, useUserPresence } from "./useUserPresence";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
});

type ClimaTampico = {
  temperatura: number;
  sensacion: number;
  codigo: number;
};

function obtenerDescripcionClima(codigo: number) {
  if (codigo === 0) return "Cielo despejado";
  if ([1, 2, 3].includes(codigo)) return "Parcialmente nublado";
  if ([45, 48].includes(codigo)) return "Neblina";
  if ([51, 53, 55, 56, 57].includes(codigo)) return "Llovizna";
  if ([61, 63, 65, 66, 67].includes(codigo)) return "Lluvia";
  if ([71, 73, 75, 77].includes(codigo)) return "Nieve";
  if ([80, 81, 82].includes(codigo)) return "Chubascos";
  if ([95, 96, 99].includes(codigo)) return "Tormenta";

  return "Clima disponible";
}

function obtenerIconoClima(codigo: number) {
  if (codigo === 0) return "☀️";
  if ([1, 2, 3].includes(codigo)) return "⛅";
  if ([45, 48].includes(codigo)) return "🌫️";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(codigo)) {
    return "🌧️";
  }
  if ([95, 96, 99].includes(codigo)) return "⛈️";

  return "🌤️";
}

export default function Home() {
  const [modo, setModo] = useState<"inicio" | "chofer" | "pasajero">("inicio");
  const [rutaActiva, setRutaActiva] = useState<string | null>(null);
  const [mostrarSugerencia, setMostrarSugerencia] = useState(false);
  const [rutaSugerida, setRutaSugerida] = useState("");
  const [zonaSugerida, setZonaSugerida] = useState("");
  const [comentarioSugerido, setComentarioSugerido] = useState("");
  const [enviandoSugerencia, setEnviandoSugerencia] = useState(false);
  const [mostrarClimaPatrocinado, setMostrarClimaPatrocinado] = useState(false);
  const [cargandoClima, setCargandoClima] = useState(false);
  const [climaTampico, setClimaTampico] = useState<ClimaTampico | null>(null);
  const [errorClima, setErrorClima] = useState("");
  const usuariosEnLinea = useOnlineUsers();

  useUserPresence(modo === "inicio" ? null : rutaActiva);

  const cambiarRutaActiva = useCallback((ruta: string | null) => {
    setRutaActiva(ruta);
  }, []);

  const volverInicio = () => {
    setRutaActiva(null);
    setModo("inicio");
  };

  const abrirClimaPatrocinado = async () => {
    setMostrarClimaPatrocinado(true);
    setErrorClima("");

    if (climaTampico) return;

    setCargandoClima(true);

    try {
      const respuesta = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=22.2553&longitude=-97.8686&current=temperature_2m,apparent_temperature,weather_code&timezone=America%2FMonterrey"
      );

      if (!respuesta.ok) throw new Error("No se pudo obtener el clima");

      const data = await respuesta.json();
      const current = data.current;

      setClimaTampico({
        temperatura: Math.round(Number(current.temperature_2m)),
        sensacion: Math.round(Number(current.apparent_temperature)),
        codigo: Number(current.weather_code),
      });
    } catch {
      setErrorClima("No se pudo cargar el clima en este momento.");
    } finally {
      setCargandoClima(false);
    }
  };

  const abrirWhatsAppPasajeroSeguro = () => {
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
          `Estoy usando Rutas Tampico.\n\n` +
          `Te comparto mi ubicación como pasajero seguro durante mi viaje.\n\n` +
          `Mi ubicación actual:\n${linkMapa}\n\n` +
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

  const enviarSugerencia = async () => {
    const ruta = rutaSugerida.trim();

    if (!ruta) {
      alert("Escribe el nombre de la ruta que quieres sugerir.");
      return;
    }

    setEnviandoSugerencia(true);

    try {
      await addDoc(collection(db, "sugerencias"), {
        ruta,
        zona: zonaSugerida.trim(),
        comentario: comentarioSugerido.trim(),
        fecha: serverTimestamp(),
      });

      setRutaSugerida("");
      setZonaSugerida("");
      setComentarioSugerido("");
      setMostrarSugerencia(false);
      alert("Gracias. Tu sugerencia fue enviada.");
    } catch {
      alert("No se pudo enviar la sugerencia. Intenta otra vez.");
    } finally {
      setEnviandoSugerencia(false);
    }
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
            🚍 Rutas Kaymax
          </h1>

          <p style={{ color: "#cbd5e1", marginBottom: 16 }}>
            Transporte en vivo para Tampico, Madero y Altamira
          </p>

          <div
            style={{
              background: "rgba(34,197,94,.14)",
              border: "1px solid rgba(34,197,94,.45)",
              color: "#bbf7d0",
              borderRadius: 16,
              padding: "12px 14px",
              fontWeight: 800,
              marginBottom: 4,
            }}
          >
            👥 Usuarios en línea:{" "}
            {usuariosEnLinea.loading ? "..." : usuariosEnLinea.total}
          </div>

          <button
            onClick={abrirClimaPatrocinado}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
              color: "white",
              border: "1px solid rgba(191,219,254,.45)",
              padding: 16,
              borderRadius: 18,
              fontSize: 17,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 12px 28px rgba(37,99,235,.28)",
            }}
          >
            🌤️ Tampico al minuto
            <span
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                marginTop: 4,
                opacity: 0.9,
              }}
            >
              Ventana patrocinada gratis
            </span>
          </button>

          <button
            onClick={abrirClimaPatrocinado}
            style={{
              width: "100%",
              background: "rgba(15,23,42,.96)",
              color: "#e0f2fe",
              border: "1px solid rgba(56,189,248,.45)",
              padding: 14,
              borderRadius: 18,
              fontSize: 16,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            👀 ¿Quieres seguirlo?
            <span
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                marginTop: 4,
                color: "#93c5fd",
              }}
            >
              Abre el clima antes de viajar
            </span>
          </button>

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
            onClick={() => setModo("pasajero")}
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
            onClick={abrirWhatsAppPasajeroSeguro}
            style={{
              width: "100%",
              background: "#16a34a",
              color: "white",
              border: "none",
              padding: 14,
              borderRadius: 16,
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🛡️ Pasajero Seguro
          </button>

          <button
            onClick={llamarEmergencias}
            style={{
              width: "100%",
              background: "#dc2626",
              color: "white",
              border: "none",
              padding: 14,
              borderRadius: 16,
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🚨 911
          </button>

          <button
            onClick={() => setMostrarSugerencia((prev) => !prev)}
            style={{
              width: "100%",
              background: "#f59e0b",
              color: "#111827",
              border: "none",
              padding: 14,
              borderRadius: 16,
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            💡 Sugerir ruta / comentarios
          </button>

          {mostrarSugerencia && (
            <div
              style={{
                background: "rgba(15,23,42,.95)",
                border: "1px solid rgba(148,163,184,.35)",
                borderRadius: 18,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                textAlign: "left",
              }}
            >
              <label style={{ color: "#e5e7eb", fontWeight: 800 }}>
                Ruta sugerida
                <input
                  value={rutaSugerida}
                  onChange={(event) => setRutaSugerida(event.target.value)}
                  placeholder="Ej. Blanco Kinder"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #334155",
                    background: "#020617",
                    color: "white",
                  }}
                />
              </label>

              <label style={{ color: "#e5e7eb", fontWeight: 800 }}>
                Zona
                <input
                  value={zonaSugerida}
                  onChange={(event) => setZonaSugerida(event.target.value)}
                  placeholder="Ej. Tampico, Madero o Altamira"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #334155",
                    background: "#020617",
                    color: "white",
                  }}
                />
              </label>

              <label style={{ color: "#e5e7eb", fontWeight: 800 }}>
                Comentario
                <textarea
                  value={comentarioSugerido}
                  onChange={(event) => setComentarioSugerido(event.target.value)}
                  placeholder="Opcional: por dónde pasa o por qué hace falta"
                  rows={3}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #334155",
                    background: "#020617",
                    color: "white",
                    resize: "vertical",
                  }}
                />
              </label>

              <button
                onClick={enviarSugerencia}
                disabled={enviandoSugerencia}
                style={{
                  width: "100%",
                  background: enviandoSugerencia ? "#64748b" : "#22c55e",
                  color: "white",
                  border: "none",
                  padding: 12,
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: enviandoSugerencia ? "not-allowed" : "pointer",
                }}
              >
                {enviandoSugerencia ? "Enviando..." : "Enviar sugerencia"}
              </button>
            </div>
          )}
        </div>

        {mostrarClimaPatrocinado && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(2,6,23,.78)",
              backdropFilter: "blur(8px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
              zIndex: 50,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 380,
                borderRadius: 28,
                background: "linear-gradient(180deg, #111827, #020617)",
                border: "1px solid rgba(125,211,252,.35)",
                color: "white",
                padding: 24,
                boxShadow: "0 24px 70px rgba(0,0,0,.55)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 44, marginBottom: 8 }}>
                {climaTampico ? obtenerIconoClima(climaTampico.codigo) : "🌤️"}
              </div>

              <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 6px" }}>
                Tampico al minuto
              </h2>

              <p style={{ color: "#93c5fd", margin: "0 0 18px", fontWeight: 800 }}>
                Patrocinado gratis por Rutas Kaymax
              </p>

              {cargandoClima && (
                <p style={{ color: "#cbd5e1", fontWeight: 800 }}>Cargando clima...</p>
              )}

              {errorClima && (
                <p style={{ color: "#fecaca", fontWeight: 800 }}>{errorClima}</p>
              )}

              {climaTampico && (
                <div
                  style={{
                    background: "rgba(15,23,42,.86)",
                    border: "1px solid rgba(148,163,184,.28)",
                    borderRadius: 22,
                    padding: 18,
                    marginBottom: 18,
                  }}
                >
                  <div style={{ fontSize: 52, fontWeight: 900 }}>
                    {climaTampico.temperatura}°C
                  </div>
                  <div style={{ color: "#bae6fd", fontWeight: 900, marginTop: 4 }}>
                    {obtenerDescripcionClima(climaTampico.codigo)}
                  </div>
                  <div style={{ color: "#cbd5e1", fontWeight: 800, marginTop: 8 }}>
                    Sensación: {climaTampico.sensacion}°C
                  </div>
                </div>
              )}

              <p style={{ color: "#e5e7eb", fontWeight: 800, marginBottom: 16 }}>
                ¿Quieres seguirlo y abrir Rutas Tampico?
              </p>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setMostrarClimaPatrocinado(false)}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid rgba(148,163,184,.35)",
                    background: "transparent",
                    color: "#cbd5e1",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Cerrar
                </button>

                <button
                  onClick={() => {
                    setMostrarClimaPatrocinado(false);
                    setModo("pasajero");
                  }}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 16,
                    border: "none",
                    background: "#2563eb",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Seguir
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <Mapa
        modoUsuario={modo === "chofer" ? "chofer" : "pasajero"}
        conteoUsuariosPorRuta={usuariosEnLinea.byRoute}
        onRutaSeleccionada={cambiarRutaActiva}
        onRegresarInicio={volverInicio}
      />
    </div>
  );
}
