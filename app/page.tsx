"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useOnlineUsers, useUserPresence } from "./useUserPresence";

const Mapa = dynamic(() => import("./Mapa"), { ssr: false });

type ClimaTampico = { temperatura: number; sensacion: number; codigo: number };

function descripcion(codigo: number) {
  if (codigo === 0) return "Cielo despejado";
  if ([1, 2, 3].includes(codigo)) return "Parcialmente nublado";
  if ([45, 48].includes(codigo)) return "Neblina";
  if ([51, 53, 55, 56, 57].includes(codigo)) return "Llovizna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(codigo)) return "Lluvia";
  if ([95, 96, 99].includes(codigo)) return "Tormenta";
  return "Clima disponible";
}

function icono(codigo: number) {
  if (codigo === 0) return "☀️";
  if ([1, 2, 3].includes(codigo)) return "⛅";
  if ([45, 48].includes(codigo)) return "🌫️";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(codigo)) return "🌧️";
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
  const [mostrarClima, setMostrarClima] = useState(false);
  const [cargandoClima, setCargandoClima] = useState(false);
  const [clima, setClima] = useState<ClimaTampico | null>(null);
  const [errorClima, setErrorClima] = useState("");
  const usuariosEnLinea = useOnlineUsers();

  useUserPresence(modo === "inicio" ? null : rutaActiva);

  const cambiarRutaActiva = useCallback((ruta: string | null) => setRutaActiva(ruta), []);
  const volverInicio = () => { setRutaActiva(null); setModo("inicio"); };

  const cargarClima = async () => {
    setMostrarClima(true);
    setErrorClima("");
    if (clima) return;
    setCargandoClima(true);
    try {
      const respuesta = await fetch("https://api.open-meteo.com/v1/forecast?latitude=22.2553&longitude=-97.8686&current=temperature_2m,apparent_temperature,weather_code&timezone=America%2FMonterrey");
      if (!respuesta.ok) throw new Error("clima");
      const data = await respuesta.json();
      setClima({
        temperatura: Math.round(Number(data.current.temperature_2m)),
        sensacion: Math.round(Number(data.current.apparent_temperature)),
        codigo: Number(data.current.weather_code),
      });
    } catch {
      setErrorClima("No se pudo cargar el clima en este momento.");
    } finally {
      setCargandoClima(false);
    }
  };

  const llamarEmergencias = () => { window.location.href = "tel:" + "911"; };

  const enviarSugerencia = async () => {
    const ruta = rutaSugerida.trim();
    if (!ruta) return;
    setEnviandoSugerencia(true);
    try {
      await addDoc(collection(db, "sugerencias"), { ruta, zona: zonaSugerida.trim(), comentario: comentarioSugerido.trim(), fecha: serverTimestamp() });
      setRutaSugerida(""); setZonaSugerida(""); setComentarioSugerido(""); setMostrarSugerencia(false);
    } finally { setEnviandoSugerencia(false); }
  };

  if (modo === "inicio") {
    return (
      <main style={{ minHeight: "100vh", background: "#0f172a", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <div style={{ background: "#111827", padding: 30, borderRadius: 24, width: "100%", maxWidth: 420, textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,.45)", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ color: "white", fontSize: 30, fontWeight: 800 }}>🚍 Rutas Kaymax</h1>
          <p style={{ color: "#cbd5e1", marginBottom: 16 }}>Transporte en vivo para Tampico, Madero y Altamira</p>
          <div style={{ background: "rgba(34,197,94,.14)", border: "1px solid rgba(34,197,94,.45)", color: "#bbf7d0", borderRadius: 16, padding: "12px 14px", fontWeight: 800, marginBottom: 4 }}>👥 Usuarios en línea: {usuariosEnLinea.loading ? "..." : usuariosEnLinea.total}</div>
          <button onClick={() => setModo("chofer")} style={{ ...boton, background: "#22c55e", color: "white", padding: 18, fontSize: 18 }}>🚌 Soy Chofer</button>
          <button onClick={() => setModo("pasajero")} style={{ ...boton, background: "#2563eb", color: "white", padding: 18, fontSize: 18 }}>👤 Soy Pasajero</button>
          <button onClick={() => setModo("pasajero")} style={{ ...boton, background: "#16a34a", color: "white", padding: 14, fontSize: 16 }}>🛡️ Pasajero Seguro</button>
          <button onClick={llamarEmergencias} style={{ ...boton, background: "#dc2626", color: "white", padding: 14, fontSize: 16 }}>🚨 911</button>
          <button onClick={() => setMostrarSugerencia((prev) => !prev)} style={{ ...boton, background: "#f59e0b", color: "#111827", padding: 14, fontSize: 16 }}>💡 Sugerir ruta / comentarios</button>
          {mostrarSugerencia && <div style={{ background: "rgba(15,23,42,.95)", border: "1px solid rgba(148,163,184,.35)", borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}><input value={rutaSugerida} onChange={(e) => setRutaSugerida(e.target.value)} placeholder="Ruta sugerida" style={campo} /><input value={zonaSugerida} onChange={(e) => setZonaSugerida(e.target.value)} placeholder="Zona" style={campo} /><textarea value={comentarioSugerido} onChange={(e) => setComentarioSugerido(e.target.value)} placeholder="Comentario" rows={3} style={{ ...campo, resize: "vertical" }} /><button onClick={enviarSugerencia} disabled={enviandoSugerencia} style={{ ...boton, background: enviandoSugerencia ? "#64748b" : "#22c55e", color: "white", padding: 12 }}>{enviandoSugerencia ? "Enviando..." : "Enviar sugerencia"}</button></div>}
        </div>
        <aside style={{ position: "fixed", right: 14, bottom: 14, width: "min(245px, calc(100vw - 28px))", background: "white", color: "#0f172a", borderRadius: 18, overflow: "hidden", boxShadow: "0 22px 55px rgba(2,6,23,.32)", zIndex: 20, textAlign: "left" }}>
          <button onClick={cargarClima} style={{ width: "100%", border: "none", background: "linear-gradient(135deg, #dbeafe, #e0f2fe)", padding: 12, color: "#0f172a", cursor: "pointer", textAlign: "left" }}><strong style={{ display: "block", fontSize: 14 }}>🌤️ Tampico al Minuto</strong><span style={{ fontSize: 11, fontWeight: 800, color: "#0369a1" }}>Ventana patrocinada gratis · toca para ver clima</span></button>
          {mostrarClima && <div style={{ padding: 12 }}>{cargandoClima && <b>Cargando clima...</b>}{errorClima && <b style={{ color: "#b91c1c" }}>{errorClima}</b>}{clima && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 30, fontWeight: 900 }}>{icono(clima.codigo)} {clima.temperatura}°C</div><div style={{ fontSize: 12, fontWeight: 800, color: "#0369a1" }}>{descripcion(clima.codigo)} · Sensación {clima.sensacion}°C</div></div>}<button onClick={() => setModo("pasajero")} style={{ ...boton, background: "#2563eb", color: "white", padding: 10 }}>Seguir en Rutas Tampico</button></div>}
        </aside>
      </main>
    );
  }

  return <div style={{ position: "relative", width: "100%", height: "100vh" }}><Mapa modoUsuario={modo === "chofer" ? "chofer" : "pasajero"} conteoUsuariosPorRuta={usuariosEnLinea.byRoute} onRutaSeleccionada={cambiarRutaActiva} onRegresarInicio={volverInicio} /></div>;
}

const boton = { width: "100%", border: "none", borderRadius: 16, fontWeight: 800, cursor: "pointer" } as const;
const campo = { width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 12, border: "1px solid #334155", background: "#020617", color: "white" } as const;
