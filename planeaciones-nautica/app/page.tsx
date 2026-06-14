"use client";

import { useState } from "react";
import { materiasPorSemestre } from "./data/materias";
import { saveAs } from "file-saver";

export default function Home() {
  const [materiaSeleccionada, setMateriaSeleccionada] = useState("");
  const [semestreSeleccionado, setSemestreSeleccionado] =
    useState("I SEMESTRE");

  const [docente, setDocente] = useState("");
  const [grupo, setGrupo] = useState("");
  const [cadetes, setCadetes] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const periodo = "Julio-Diciembre 2026";
  const escuelaNautica =
    'Escuela Náutica Mercante de Tampico "Cap. de Altura Luis Gonzaga Priego González"';

  const horasPorSemana = "1";
  const horasTotales = "18";
  const horasTeoricas = "18";
  const horasIndependientes = "0";

  const menu = materiasPorSemestre;

  const generarWord = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/gemini-planeaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materia: materiaSeleccionada,
          semestre: semestreSeleccionado,
          docente,
          grupo,
          cadetes,
          fechaInicio,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Error generando la planeación.");
        return;
      }

      const blob = await response.blob();
      saveAs(blob, `F32_${materiaSeleccionada.replaceAll(" ", "-")}.docx`);
    } catch {
      setError("Error de red o del servidor. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-80 bg-white border-r border-slate-300 p-4 overflow-y-auto">
          <h1 className="text-xl font-bold mb-4 text-blue-900">
            Programas de Estudio
          </h1>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.keys(menu).map((semestre) => (
                <button
                  key={semestre}
                  onClick={() => {
                    setSemestreSeleccionado(semestre);
                    setMateriaSeleccionada("");
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                    semestreSeleccionado === semestre
                      ? "bg-blue-800 text-white"
                      : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                  }`}
                >
                  {semestre}
                </button>
              ))}
            </div>

            <div>
              <h2 className="font-bold text-sm text-slate-700 mb-2">
                {semestreSeleccionado}
              </h2>

              <div className="space-y-2">
                {menu[
                  semestreSeleccionado as keyof typeof menu
                ]?.map((materia) => (
                  <button
                    key={materia}
                    onClick={() => setMateriaSeleccionada(materia)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      materiaSeleccionada === materia
                        ? "bg-blue-800 text-white"
                        : "bg-blue-100 text-blue-900 hover:bg-blue-200"
                    }`}
                  >
                    {materia}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="flex-1 p-8">
          <div className="bg-white rounded-xl shadow p-6">
            <h1 className="text-2xl font-bold text-blue-900 mb-4">
              Planeación F-32
            </h1>

            {materiaSeleccionada ? (
              <>
                <p className="text-lg mb-4">
                  Materia seleccionada:
                  <span className="font-bold"> {materiaSeleccionada}</span>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <input
                    className="border rounded-lg p-2 md:col-span-2"
                    placeholder="Nombre del docente"
                    value={docente}
                    onChange={(e) => setDocente(e.target.value)}
                  />

                  <input
                    className="border rounded-lg p-2 md:col-span-2 bg-slate-100"
                    value={periodo}
                    readOnly
                  />

                  <input
                    className="border rounded-lg p-2 md:col-span-2 bg-slate-100"
                    value={escuelaNautica}
                    readOnly
                  />

                  <input
                    className="border rounded-lg p-2"
                    placeholder="Grupo"
                    value={grupo}
                    onChange={(e) => setGrupo(e.target.value)}
                  />

                  <input
                    className="border rounded-lg p-2"
                    placeholder="Número de cadetes"
                    value={cadetes}
                    onChange={(e) => setCadetes(e.target.value)}
                  />

                  <input
                    className="border rounded-lg p-2"
                    placeholder="Fecha de inicio"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />

                  <input
                    className="border rounded-lg p-2 bg-slate-100"
                    value={`Horas por semana: ${horasPorSemana}`}
                    readOnly
                  />

                  <input
                    className="border rounded-lg p-2 bg-slate-100"
                    value={`Horas totales: ${horasTotales}`}
                    readOnly
                  />

                  <input
                    className="border rounded-lg p-2 bg-slate-100"
                    value={`Horas teóricas: ${horasTeoricas}`}
                    readOnly
                  />

                  <input
                    className="border rounded-lg p-2 bg-slate-100"
                    value={`Horas independientes: ${horasIndependientes}`}
                    readOnly
                  />
                </div>

                {error && (
                  <p className="text-red-600 mb-4 text-sm">{error}</p>
                )}

                <button
                  onClick={generarWord}
                  disabled={loading}
                  className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Generando con IA..." : "Generar planeación"}
                </button>
              </>
            ) : (
              <p>Selecciona materia.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
