"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useOnlineUsers, useUserPresence } from "./useUserPresence";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
});

const TAM_PROMO_STORAGE_KEY = "rutasKaymax.tampicoAlMinutoPromoClosedAt";
const TAM_PROMO_HIDE_MS = 24 * 60 * 60 * 1000;
const TAM_FACEBOOK_URL = "https://www.facebook.com/TampicoAlMinuto";
const TAMPICO_WEATHER_URL =
  "https://www.google.com/search?q=clima+Tampico+hoy";
const MAX_PROMO_STORAGE_KEY = "rutasKaymax.maxCleanersPromoClosedAt";
const MAX_CLEANERS_PHONE = "8331063633";

type ClimaTampico = {
  temperatura: number;
  sensacion: number;
  humedad: number;
  viento: number;
  descripcion: string;
};

function describirClima(codigo: number) {
  if (codigo === 0) return "Despejado";
  if ([1, 2, 3].includes(codigo)) return "Parcialmente nublado";
  if ([45, 48].includes(codigo)) return "Neblina";
  if ([51, 53, 55, 56, 57].includes(codigo)) return "Llovizna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(codigo)) return "Lluvia";
  if ([95, 96, 99].includes(codigo)) return "Tormenta";

  return "Clima variable";
}

export default function Home() {
  const [modo, setModo] = useState<"inicio" | "chofer" | "pasajero">("inicio");
  const [rutaActiva, setRutaActiva] = useState<string | null>(null);
  const [mostrarSugerencia, setMostrarSugerencia] = useState(false);
  const [rutaSugerida, setRutaSugerida] = useState("");
  const [zonaSugerida, setZonaSugerida] = useState("");
  const [comentarioSugerido, setComentarioSugerido] = useState("");
  const [enviandoSugerencia, setEnviandoSugerencia] = useState(false);
  const [mostrarPromoTam, setMostrarPromoTam] = useState(false);
  const [mostrarPromoMax, setMostrarPromoMax] = useState(false);
  const [climaTampico, setClimaTampico] = useState<ClimaTampico | null>(null);
  const [cargandoClimaTam, setCargandoClimaTam] = useState(false);
  const [mostrarClimaTam, setMostrarClimaTam] = useState(false);
  const [clicksTamSesion, setClicksTamSesion] = useState(0);
  const usuariosEnLinea = useOnlineUsers();

  useUserPresence(modo === "inicio" ? null : rutaActiva);

  useEffect(() => {
    const cerradoTamEn = Number(localStorage.getItem(TAM_PROMO_STORAGE_KEY));
    const cerradoMaxEn = Number(localStorage.getItem(MAX_PROMO_STORAGE_KEY));
    const ocultarPromoTam =
      Number.isFinite(cerradoTamEn) &&
      Date.now() - cerradoTamEn < TAM_PROMO_HIDE_MS;
    const ocultarPromoMax =
      Number.isFinite(cerradoMaxEn) &&
      Date.now() - cerradoMaxEn < TAM_PROMO_HIDE_MS;

    setMostrarPromoTam(!ocultarPromoTam);
    setMostrarPromoMax(!ocultarPromoMax);
  }, []);

  const cambiarRutaActiva = useCallback((ruta: string | null) => {
    setRutaActiva(ruta);
  }, []);

  const volverInicio = () => {
    setRutaActiva(null);
    setModo("inicio");
  };

  const registrarClickAnuncio = async (anuncio: string, accion: string) => {
    try {
      await addDoc(collection(db, "clicksAnuncios"), {
        anuncio,
        accion,
        pagina: "inicio",
        fecha: serverTimestamp(),
        userAgent: navigator.userAgent.slice(0, 200),
      });
    } catch (error) {
      console.error("No se pudo registrar click del anuncio", error);
    }
  };

  const cargarClimaTampico = async () => {
    setCargandoClimaTam(true);

    try {
      const response = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=22.2553&longitude=-97.8686&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=America%2FMexico_City",
        { cache: "no-store" }
      );
      const data = await response.json();
      const current = data?.current || {};

      setClimaTampico({
        temperatura: Math.round(Number(current.temperature_2m) || 0),
        sensacion: Math.round(Number(current.apparent_temperature) || 0),
        humedad: Math.round(Number(current.relative_humidity_2m) || 0),
        viento: Math.round(Number(current.wind_speed_10m) || 0),
        descripcion: describirClima(Number(current.weather_code) || 0),
      });
    } catch (error) {
      console.error("No se pudo cargar clima de Tampico", error);
      setClimaTampico(null);
    } finally {
      setCargandoClimaTam(false);
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

  const cerrarPromoTam = () => {
    localStorage.setItem(TAM_PROMO_STORAGE_KEY, String(Date.now()));
    setMostrarPromoTam(false);
  };

  const verClimaTampicoAlMinuto = async () => {
    setClicksTamSesion((valor) => valor + 1);
    setMostrarClimaTam(true);
    void registrarClickAnuncio("Tampico al Minuto", "ver_clima");

    if (!climaTampico) {
      await cargarClimaTampico();
    }
  };

  const seguirTampicoAlMinuto = () => {
    setClicksTamSesion((valor) => valor + 1);
    void registrarClickAnuncio("Tampico al Minuto", "seguir_facebook");
    window.open(TAM_FACEBOOK_URL, "_blank", "noopener,noreferrer");
  };

  const verClimaEnGoogle = () => {
    setClicksTamSesion((valor) => valor + 1);
    void registrarClickAnuncio("Tampico al Minuto", "ver_google_clima");
    window.open(TAMPICO_WEATHER_URL, "_blank", "noopener,noreferrer");
  };

  const cerrarPromoMax = () => {
    localStorage.setItem(MAX_PROMO_STORAGE_KEY, String(Date.now()));
    setMostrarPromoMax(false);
  };

  const llamarMaxCleaners = () => {
    void registrarClickAnuncio("MAX CLEANERS", "llamar");
    window.location.href = `tel:${MAX_CLEANERS_PHONE}`;
  };

  const mostrarInfoMaxCleaners = () => {
    void registrarClickAnuncio("MAX CLEANERS", "mas_informacion");
    alert(
      "MAX CLEANERS\nLavandería y Planchaduría\nTel. 833-106-36-33"
    );
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="3" width="16" height="14" rx="2" />
                <path d="M4 11h16" />
                <path d="M8 17v2" />
                <path d="M16 17v2" />
                <circle cx="8" cy="14" r="1" />
                <circle cx="16" cy="14" r="1" />
              </svg>
              Rutas Kaymax
            </span>
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Usuarios en línea:{" "}
              {usuariosEnLinea.loading ? "..." : usuariosEnLinea.total}
            </span>
          </div>

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
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="3" width="16" height="14" rx="2" />
                <path d="M4 11h16" />
                <path d="M8 17v2" />
                <path d="M16 17v2" />
                <circle cx="8" cy="14" r="1" />
                <circle cx="16" cy="14" r="1" />
              </svg>
              Soy Chofer
            </span>
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
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Soy Pasajero
            </span>
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
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Pasajero Seguro
            </span>
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
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.3 3.2 1.7 18a2 2 0 0 0 1.7 3h17.2a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              911
            </span>
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
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1v.2h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
              </svg>
              Sugerir ruta / comentarios
            </span>
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

        {mostrarPromoTam && (
          <aside
            aria-label="Promoción Tampico al Minuto"
            style={{
              position: "fixed",
              right: 14,
              bottom: mostrarPromoMax ? 258 : 14,
              zIndex: 50,
              width: "min(224px, calc(100vw - 24px))",
              overflow: "hidden",
              border: "1px solid rgba(14,165,233,.18)",
              borderRadius: 18,
              background: "white",
              color: "#0f172a",
              boxShadow:
                "0 22px 55px rgba(2,6,23,.32), 0 0 0 1px rgba(255,255,255,.75)",
            }}
          >
            <div
              style={{
                minHeight: 50,
                background:
                  "linear-gradient(135deg, #dbeafe 0%, #bae6fd 48%, #e0f2fe 100%)",
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 12px",
                position: "relative",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 11,
                  background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
                  color: "white",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "-.04em",
                  boxShadow: "0 10px 24px rgba(37,99,235,.25)",
                }}
              >
                TaM
              </div>

              <div style={{ minWidth: 0 }}>
                <strong
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 900,
                    letterSpacing: "-.03em",
                  }}
                >
                  Tampico al Minuto
                </strong>
                <span style={{ color: "#0369a1", fontSize: 10, fontWeight: 800 }}>
                  Información local · patrocinado
                </span>
              </div>

              <button
                type="button"
                onClick={cerrarPromoTam}
                aria-label="Cerrar promoción"
                style={{
                  position: "absolute",
                  top: 7,
                  right: 7,
                  width: 22,
                  height: 22,
                  border: "none",
                  borderRadius: 999,
                  background: "rgba(255,255,255,.82)",
                  color: "#0f172a",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 900,
                  lineHeight: "22px",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 11 }}>
              <p
                style={{
                  color: "#334155",
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  margin: "0 0 10px",
                }}
              >
                Noticias, tráfico, eventos y clima de hoy en la zona sur.
              </p>

              <button
                type="button"
                onClick={verClimaTampicoAlMinuto}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 13,
                  background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 950,
                  padding: "10px 9px",
                  boxShadow: "0 12px 24px rgba(37,99,235,.22)",
                  marginBottom: 8,
                }}
              >
                🌤️ Ver clima de hoy
              </button>

              {mostrarClimaTam && (
                <div
                  style={{
                    border: "1px solid #bae6fd",
                    borderRadius: 14,
                    background: "#f0f9ff",
                    color: "#0f172a",
                    padding: 10,
                    marginBottom: 9,
                    textAlign: "left",
                  }}
                >
                  <strong style={{ display: "block", fontSize: 13 }}>
                    Tampico hoy
                  </strong>
                  {cargandoClimaTam ? (
                    <small style={{ color: "#0369a1", fontWeight: 800 }}>
                      Cargando clima...
                    </small>
                  ) : climaTampico ? (
                    <>
                      <div style={{ fontSize: 24, fontWeight: 1000 }}>
                        {climaTampico.temperatura}°C
                      </div>
                      <small style={{ color: "#0369a1", fontWeight: 850 }}>
                        {climaTampico.descripcion} · sensación {climaTampico.sensacion}°C
                        <br />
                        Humedad {climaTampico.humedad}% · viento {climaTampico.viento} km/h
                        <br />
                        Clics anuncio: {clicksTamSesion}
                      </small>
                    </>
                  ) : (
                    <small style={{ color: "#b91c1c", fontWeight: 800 }}>
                      No se pudo cargar el clima.
                    </small>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 7 }}>
                <button
                  type="button"
                  onClick={seguirTampicoAlMinuto}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: 11,
                    background: "#2563eb",
                    color: "white",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 900,
                    padding: "8px 9px",
                    boxShadow: "0 12px 24px rgba(37,99,235,.22)",
                  }}
                >
                  Seguir
                </button>

                <button
                  type="button"
                  onClick={verClimaEnGoogle}
                  style={{
                    flex: 1,
                    border: "1px solid #e2e8f0",
                    borderRadius: 11,
                    background: "#f8fafc",
                    color: "#334155",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 900,
                    padding: "8px 9px",
                  }}
                >
                  Google
                </button>
              </div>
            </div>
          </aside>
        )}

        {mostrarPromoMax && (
          <aside
            aria-label="Promoción MAX CLEANERS"
            style={{
              position: "fixed",
              right: 14,
              bottom: 14,
              zIndex: 51,
              width: "min(224px, calc(100vw - 24px))",
              overflow: "hidden",
              border: "1px solid rgba(37,99,235,.18)",
              borderRadius: 18,
              background: "white",
              color: "#0f172a",
              boxShadow:
                "0 22px 55px rgba(2,6,23,.32), 0 0 0 1px rgba(255,255,255,.75)",
            }}
          >
            <div
              style={{
                minHeight: 54,
                background:
                  "linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #38bdf8 100%)",
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 12px",
                position: "relative",
                color: "white",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: "rgba(255,255,255,.96)",
                  color: "#1d4ed8",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 7.5,
                  fontWeight: 950,
                  lineHeight: 1,
                  textAlign: "center",
                  letterSpacing: "-.04em",
                  boxShadow: "0 12px 24px rgba(15,23,42,.22)",
                }}
              >
                MAX
                <br />
                CLEANERS
              </div>

              <div style={{ minWidth: 0, paddingRight: 22 }}>
                <strong
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 950,
                    letterSpacing: "-.03em",
                  }}
                >
                  🧺 MAX CLEANERS
                </strong>
                <span style={{ color: "#dbeafe", fontSize: 10, fontWeight: 850 }}>
                  Lavandería y Planchaduría
                </span>
              </div>

              <button
                type="button"
                onClick={cerrarPromoMax}
                aria-label="Cerrar promoción MAX CLEANERS"
                style={{
                  position: "absolute",
                  top: 7,
                  right: 7,
                  width: 22,
                  height: 22,
                  border: "none",
                  borderRadius: 999,
                  background: "rgba(255,255,255,.9)",
                  color: "#1e3a8a",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 900,
                  lineHeight: "22px",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 11 }}>
              <p
                style={{
                  color: "#334155",
                  fontSize: 12,
                  fontWeight: 750,
                  lineHeight: 1.3,
                  margin: "0 0 10px",
                }}
              >
                Servicio profesional de lavado, secado y planchado. Atención
                rápida, excelente calidad y precios accesibles.
              </p>

              <div style={{ display: "flex", gap: 7 }}>
                <button
                  type="button"
                  onClick={llamarMaxCleaners}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: 11,
                    background: "#2563eb",
                    color: "white",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 900,
                    padding: "8px 9px",
                    boxShadow: "0 12px 24px rgba(37,99,235,.22)",
                  }}
                >
                  📞 Llamar ahora
                </button>

                <button
                  type="button"
                  onClick={mostrarInfoMaxCleaners}
                  style={{
                    flex: 1,
                    border: "1px solid #dbeafe",
                    borderRadius: 11,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 900,
                    padding: "8px 9px",
                  }}
                >
                  Más información
                </button>
              </div>
            </div>
          </aside>
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
