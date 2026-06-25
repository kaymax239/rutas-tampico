"use client";

import { useState } from "react";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import { distribuirFechas, formatearRango } from "../data/calendario";
import type { PlaneacionIngles } from "../data/ingles/BibliotecaIngles";

type Mensaje = { tipo: "exito" | "error"; texto: string };
type PasoAvanceIngles = "captura" | "semanas" | "preview";
type SemanaInglesUi = { numero: number; tema: string; etiqueta: string };

const niveles = ["3", "4", "5", "6", "7"];
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#c8a45d] focus:ring-2 focus:ring-[#c8a45d]/30";
const labelClass =
  "mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#0b1f3a]";
const errorGenerico =
  "No se pudo generar la planeacion en este momento. Intentalo de nuevo.";

const limpiar = (valor: unknown) =>
  typeof valor === "string" ? valor.trim() : "";

const nombreArchivoSeguro = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const escaparXml = (valor: string) =>
  valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const textoErrorIngles = (error?: string) => {
  if (
    error === "sin_corpus" ||
    error === "sin_historicas_nivel" ||
    error === "sin_api_key"
  ) {
    return "La biblioteca academica de este nivel aun no esta disponible.";
  }

  return errorGenerico;
};

const construirDatosF32Ingles = (
  planeacion: PlaneacionIngles,
  datos: {
    nivel: string;
    grupo: string;
    semanas: string;
    horasPorSemana: string;
  },
) => {
  const horasPorSemana = Number(datos.horasPorSemana) || 0;
  const semanas = Number(datos.semanas) || planeacion.secuenciaSemanal.length;
  const horasTotales = horasPorSemana && semanas ? horasPorSemana * semanas : "";
  const evaluacionTexto = planeacion.evaluacion
    .map((item) => `${item.instrumento} ${item.porcentaje}%`)
    .join("; ");

  return {
    escuela: "Tampico",
    licenciatura: "Ingles",
    periodo: "Julio-Diciembre 2026",
    escuelaNautica:
      'Escuela Nautica Mercante de Tampico "Cap. de Altura Luis Gonzaga Priego Gonzalez"',
    asignatura: planeacion.asignatura,
    clave: `INGLES-N${datos.nivel}`,
    claveAsignatura: `INGLES-N${datos.nivel}`,
    claveAsignaturaCurso: `INGLES-N${datos.nivel}`,
    horasTotales: String(horasTotales),
    horasTeoricas: String(horasTotales),
    horasPracticas: "0",
    horasIndependientes: "0",
    horasPorSemana: String(horasPorSemana || ""),
    horasSemana: String(horasPorSemana || ""),
    horasXSemana: String(horasPorSemana || ""),
    objetivoGeneral: planeacion.objetivoGeneral,
    fuentes: planeacion.bibliografia.join("\n"),
    unidadBloques: [
      {
        unidad: "I",
        objetivoEspecifico: planeacion.objetivoGeneral,
        estrategia: planeacion.enfoque,
        semanas: planeacion.secuenciaSemanal.map((semana) => ({
          semana: `Semana ${semana.semana}`,
          tema: semana.contenido,
          secuencia: semana.actividades.map((actividad) => `- ${actividad}`).join("\n"),
          recursos: semana.recursos.join(", "),
          producto: semana.evidencias,
          evaluacion: evaluacionTexto,
        })),
      },
    ],
    docente: "",
    nombreDocente: "",
    grupo: datos.grupo,
    grupoAsignatura: datos.grupo,
    cadetes: "",
    numeroCadetes: "",
    fechaInicio: "",
    fecha: "",
    fechaParcial1: "",
    fechaParcial2: "",
    pctConocimiento: "40",
    pctActividades: "40",
    pctParticipacion: "20",
  };
};

const reemplazarCompetenciasDisciplinares = (
  zip: PizZip,
  competencias: string[],
) => {
  const ruta = "word/document.xml";
  const archivo = zip.file(ruta);
  if (!archivo) return;

  const xml = archivo.asText();
  const patron = /<w:t[^>]*>Estas competencias las integrar[^<]*<\/w:t>/;
  if (!patron.test(xml)) return;

  const reemplazo = competencias.length
    ? competencias
        .map((competencia) => `<w:t xml:space="preserve">${escaparXml(competencia)}</w:t>`)
        .join("<w:br/>")
    : "<w:t></w:t>";

  zip.file(ruta, xml.replace(patron, reemplazo));
};

const construirSemanasUi = (planeacion: PlaneacionIngles): SemanaInglesUi[] => {
  const fechas = distribuirFechas(planeacion.secuenciaSemanal.length);

  return planeacion.secuenciaSemanal.map((semana, index) => ({
    numero: semana.semana,
    tema: semana.contenido,
    etiqueta: fechas[index]
      ? `Semana ${semana.semana}\n${fechas[index].etiqueta}`
      : `Semana ${semana.semana}`,
  }));
};

const construirDatosAvanceIngles = ({
  semanas,
  planeacion,
  nivel,
  grupo,
}: {
  semanas: SemanaInglesUi[];
  planeacion: PlaneacionIngles;
  nivel: string;
  grupo: string;
}) => {
  const seleccionadas = semanas.slice(0, 4);
  const fechas = distribuirFechas(planeacion.secuenciaSemanal.length);
  const rangos = seleccionadas
    .map((semana) => fechas[semana.numero - 1])
    .filter(Boolean);
  const periodoReportado =
    rangos.length > 0
      ? formatearRango({ ini: rangos[0].ini, fin: rangos[rangos.length - 1].fin })
      : `Semanas ${seleccionadas.map((semana) => semana.numero).join(", ")}`;

  const valorSemana = (index: number) => {
    const semana = seleccionadas[index];
    return {
      numero: semana ? `Semana ${semana.numero}` : `Semana ${index + 1}`,
      tema: semana?.tema || "",
      sesiones: semana ? "1" : "",
    };
  };
  const filas = [valorSemana(0), valorSemana(1), valorSemana(2), valorSemana(3)];

  return {
    escuela: "Escuela Nautica Mercante de Tampico",
    asignatura: planeacion.asignatura,
    curso: planeacion.asignatura,
    asignaturaCurso: planeacion.asignatura,
    mes: periodoReportado,
    anio: "2026",
    docente: "",
    licenciatura: "Ingles",
    semestre: `Nivel ${nivel}`,
    grupo,
    periodoReportado,
    periodoEscolar: "Julio-Diciembre 2026",
    temasCubiertos: seleccionadas
      .map((semana) => `Semana ${semana.numero}: ${semana.tema}`)
      .join("\n"),
    temasSubtemasCubiertos: seleccionadas
      .map((semana) => `Semana ${semana.numero}: ${semana.tema}`)
      .join("\n"),
    objetivosCompetencias: planeacion.objetivoGeneral,
    estrategiasTecnicas: planeacion.enfoque,
    evidenciasAprendizaje:
      "Actividades de clase, ejercicios resueltos, participacion oral y producto de clase.",
    recursosDidacticos:
      "Libro de texto, workbook, presentacion digital, audio o video didactico.",
    instrumentosEvaluacion:
      "Lista de cotejo, rubrica de desempeno, participacion guiada y evaluacion formativa.",
    actividadesSigaaSi: "X",
    actividadesSigaaNo: "",
    nombreFirmaDocente: "Nombre y firma del docente",
    razonesNoCumplio: "",
    firmaDocente: "Nombre y firma del docente",
    semana1: filas[0].numero,
    tema1: filas[0].tema,
    semana1Tema: filas[0].tema,
    sesiones1: filas[0].sesiones,
    semana1Sesiones: filas[0].sesiones,
    semana2: filas[1].numero,
    tema2: filas[1].tema,
    semana2Tema: filas[1].tema,
    sesiones2: filas[1].sesiones,
    semana2Sesiones: filas[1].sesiones,
    semana3: filas[2].numero,
    tema3: filas[2].tema,
    semana3Tema: filas[2].tema,
    sesiones3: filas[2].sesiones,
    semana3Sesiones: filas[2].sesiones,
    semana4: filas[3].numero,
    tema4: filas[3].tema,
    semana4Tema: filas[3].tema,
    sesiones4: filas[3].sesiones,
    semana4Sesiones: filas[3].sesiones,
  };
};

export default function PlaneacionIngles({
  onVolver,
}: {
  onVolver: () => void;
}) {
  const [nivel, setNivel] = useState("");
  const [grupo, setGrupo] = useState("");
  const [semanas, setSemanas] = useState("");
  const [horasPorSemana, setHorasPorSemana] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [generandoPlaneacion, setGenerandoPlaneacion] = useState(false);
  const [preparandoAvance, setPreparandoAvance] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [pasoAvance, setPasoAvance] = useState<PasoAvanceIngles>("captura");
  const [semanasDisponibles, setSemanasDisponibles] = useState<SemanaInglesUi[]>(
    [],
  );
  const [semanasSeleccionadas, setSemanasSeleccionadas] = useState<number[]>([]);
  const [planeacionAvance, setPlaneacionAvance] =
    useState<PlaneacionIngles | null>(null);

  const solicitarPlaneacion = async () => {
    const response = await fetch("/api/planeacion-ingles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nivel,
        grupo,
        semanas,
        horasPorSemana,
        observaciones,
      }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.planeacion) {
      throw new Error(textoErrorIngles(data?.error));
    }

    return data.planeacion as PlaneacionIngles;
  };

  const prepararAvance = async () => {
    if (!nivel) return;
    setPreparandoAvance(true);
    setMensaje(null);
    try {
      const planeacion = await solicitarPlaneacion();
      setPlaneacionAvance(planeacion);
      setSemanasDisponibles(construirSemanasUi(planeacion));
      setSemanasSeleccionadas([]);
      setPasoAvance("semanas");
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: error instanceof Error ? error.message : errorGenerico,
      });
    } finally {
      setPreparandoAvance(false);
    }
  };

  const generarPlaneacionWord = async () => {
    if (!nivel) return;
    setGenerandoPlaneacion(true);
    setMensaje(null);
    try {
      const planeacion = await solicitarPlaneacion();
      const response = await fetch("/templates/F-32.docx");
      if (!response.ok) throw new Error(errorGenerico);

      const zip = new PizZip(await response.arrayBuffer());
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
      doc.render(
        construirDatosF32Ingles(planeacion, {
          nivel,
          grupo,
          semanas,
          horasPorSemana,
        }),
      );
      reemplazarCompetenciasDisciplinares(
        doc.getZip(),
        planeacion.competencias.disciplinares,
      );

      const blob = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const nombre = `F32_INGLES_NIVEL${nombreArchivoSeguro(nivel)}.docx`;
      saveAs(blob, nombre);
      setMensaje({
        tipo: "exito",
        texto: `Planeacion generada y descargada: ${nombre}`,
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: error instanceof Error ? error.message : errorGenerico,
      });
    } finally {
      setGenerandoPlaneacion(false);
    }
  };

  const generarAvanceWord = async () => {
    if (!planeacionAvance || semanasSeleccionadas.length === 0) return;
    setMensaje(null);
    try {
      const response = await fetch("/templates/Avance-Programatico-F51.docx");
      if (!response.ok) throw new Error(errorGenerico);

      const zip = new PizZip(await response.arrayBuffer());
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
      const semanasElegidas = semanasDisponibles
        .filter((semana) => semanasSeleccionadas.includes(semana.numero))
        .sort((a, b) => a.numero - b.numero);
      doc.render(
        construirDatosAvanceIngles({
          semanas: semanasElegidas,
          planeacion: planeacionAvance,
          nivel,
          grupo,
        }),
      );

      const blob = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const nombre = `F51_INGLES_NIVEL${nombreArchivoSeguro(nivel)}.docx`;
      saveAs(blob, nombre);
      setPasoAvance("captura");
      setMensaje({
        tipo: "exito",
        texto: `Avance Programatico generado y descargado: ${nombre}`,
      });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: error instanceof Error ? error.message : errorGenerico,
      });
    }
  };

  const alternarSemana = (numero: number) => {
    setSemanasSeleccionadas((actuales) => {
      if (actuales.includes(numero)) {
        return actuales.filter((semana) => semana !== numero);
      }
      if (actuales.length >= 4) {
        return actuales;
      }
      return [...actuales, numero];
    });
  };

  const reiniciarNivel = () => {
    setNivel("");
    setMensaje(null);
    setPasoAvance("captura");
    setSemanasSeleccionadas([]);
    setSemanasDisponibles([]);
    setPlaneacionAvance(null);
  };

  if (!nivel) {
    return (
      <div className="px-6 py-10 sm:px-10">
        <div className="rounded-3xl border border-dashed border-[#c8a45d] bg-[#fffaf0] p-6 text-center sm:p-8">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#071a33] text-xs font-black uppercase tracking-[0.18em] text-[#d7bd7a]">
            ING
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
            Ingles
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#071a33] sm:text-3xl">
            Selecciona un nivel
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {niveles.map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setNivel(valor)}
                className="rounded-2xl border border-[#c8a45d]/40 bg-white px-5 py-6 text-lg font-black text-[#071a33] shadow-sm transition hover:-translate-y-0.5 hover:border-[#c8a45d] hover:bg-[#071a33] hover:text-white hover:shadow-xl"
              >
                Nivel {valor}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onVolver}
            className="mt-6 rounded-2xl border border-[#071a33] px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] transition hover:bg-[#071a33] hover:text-white"
          >
            Regresar al inicio
          </button>
        </div>
      </div>
    );
  }

  if (pasoAvance === "semanas" || pasoAvance === "preview") {
    const semanasElegidas = semanasDisponibles
      .filter((semana) => semanasSeleccionadas.includes(semana.numero))
      .sort((a, b) => a.numero - b.numero);

    return (
      <div className="px-6 py-8 sm:px-10">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
              Avance Programatico Ingles
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#071a33]">
              {pasoAvance === "semanas"
                ? "Seleccionar semanas del avance"
                : "Vista previa del avance"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setPasoAvance("captura")}
            className="rounded-2xl border border-[#071a33] px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] transition hover:bg-[#071a33] hover:text-white"
          >
            Cancelar
          </button>
        </div>

        {pasoAvance === "semanas" ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-[#071a33]">
                Semanas seleccionadas
              </p>
              <span className="rounded-full bg-[#071a33] px-3 py-1 text-xs font-black text-white">
                {semanasSeleccionadas.length}/4
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {semanasDisponibles.map((semana) => {
                const activa = semanasSeleccionadas.includes(semana.numero);
                const bloqueada = !activa && semanasSeleccionadas.length >= 4;

                return (
                  <button
                    key={semana.numero}
                    type="button"
                    onClick={() => alternarSemana(semana.numero)}
                    disabled={bloqueada}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      activa
                        ? "border-[#c8a45d] bg-[#071a33] text-white"
                        : "border-slate-200 bg-white text-[#071a33] hover:border-[#c8a45d]"
                    }`}
                  >
                    <span
                      className={`text-xs font-bold uppercase tracking-[0.16em] ${
                        activa ? "text-[#d7bd7a]" : "text-[#c8a45d]"
                      }`}
                    >
                      {activa ? "Seleccionada" : "Semana"}
                    </span>
                    <span className="mt-1 block whitespace-pre-line text-sm font-black">
                      {semana.etiqueta}
                    </span>
                    <span
                      className={`mt-2 block text-xs ${
                        activa ? "text-slate-200" : "text-slate-500"
                      }`}
                    >
                      {semana.tema}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPasoAvance("preview")}
              disabled={semanasSeleccionadas.length === 0}
              className="mt-6 rounded-2xl bg-[#c8a45d] px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] shadow-sm transition hover:bg-[#d7bd7a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continuar a vista previa
            </button>
          </>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
                Temas y semanas del avance
              </p>
              <ol className="mt-4 space-y-3">
                {semanasElegidas.map((semana) => (
                  <li
                    key={semana.numero}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-black text-[#071a33]">
                      Semana {semana.numero}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{semana.tema}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-3xl bg-[#071a33] p-6 text-white shadow-xl shadow-slate-300/60">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d7bd7a]">
                  Datos del avance
                </p>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <span className="text-slate-300">Asignatura</span>
                    <span className="text-right font-bold">
                      {planeacionAvance?.asignatura || `Ingles Nivel ${nivel}`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <span className="text-slate-300">Nivel</span>
                    <span className="font-bold">Nivel {nivel}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">Grupo</span>
                    <span className="font-bold">{grupo || "Por definir"}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setPasoAvance("semanas")}
                  className="rounded-2xl border border-[#071a33] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] transition hover:bg-[#071a33] hover:text-white"
                >
                  Regresar a semanas
                </button>
                <button
                  type="button"
                  onClick={generarAvanceWord}
                  className="rounded-2xl bg-[#c8a45d] px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] shadow-lg shadow-[#c8a45d]/30 transition hover:bg-[#d7bd7a]"
                >
                  Generar avance en Word
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-10">
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reiniciarNivel}
              className="rounded-xl border border-[#071a33] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#071a33] transition hover:bg-[#071a33] hover:text-white"
            >
              Regresar a niveles
            </button>
            <button
              type="button"
              onClick={onVolver}
              className="rounded-xl border border-[#c8a45d] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#071a33] transition hover:bg-[#c8a45d]"
            >
              Regresar al inicio
            </button>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
            Ingles
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#071a33]">
            Planeacion de Ingles - Nivel {nivel}
          </h2>
        </div>
        <div className="hidden rounded-2xl bg-[#071a33] px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.16em] text-white sm:block">
          Nivel {nivel}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
            Datos de la planeacion
          </p>
          <h3 className="mt-2 text-xl font-black text-[#071a33]">
            Captura los datos del grupo
          </h3>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <label>
              <span className={labelClass}>Nivel</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
                value={`Nivel ${nivel}`}
                readOnly
              />
            </label>
            <label>
              <span className={labelClass}>Grupo</span>
              <input
                className={inputClass}
                placeholder="Ej. 301-A"
                value={grupo}
                onChange={(event) => setGrupo(event.target.value)}
              />
            </label>
            <label>
              <span className={labelClass}>Semanas</span>
              <input
                className={inputClass}
                type="number"
                min={1}
                placeholder="Ej. 18"
                value={semanas}
                onChange={(event) => setSemanas(event.target.value)}
              />
            </label>
            <label>
              <span className={labelClass}>Horas por semana</span>
              <input
                className={inputClass}
                type="number"
                min={1}
                placeholder="Ej. 3"
                value={horasPorSemana}
                onChange={(event) => setHorasPorSemana(event.target.value)}
              />
            </label>
            <label className="md:col-span-2">
              <span className={labelClass}>Observaciones (opcional)</span>
              <textarea
                className={`${inputClass} min-h-20 resize-y`}
                placeholder="Indicaciones adicionales para la planeacion..."
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-3xl bg-[#071a33] p-6 text-white shadow-xl shadow-slate-300/60">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d7bd7a]">
              Vista institucional
            </p>
            <h3 className="mt-3 text-2xl font-black leading-tight">
              Ingles - Nivel {nivel}
            </h3>
            <div className="mt-6 space-y-4 rounded-2xl border border-white/15 bg-white/10 p-5">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm">
                <span className="text-slate-300">Grupo</span>
                <span className="font-bold">{grupo || "Por definir"}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm">
                <span className="text-slate-300">Semanas</span>
                <span className="font-bold">{semanas || "Por definir"}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-300">Horas por semana</span>
                <span className="font-bold">
                  {horasPorSemana || "Por definir"}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-300">
              La biblioteca academica de Ingles se utiliza automaticamente para
              generar la planeacion del nivel seleccionado.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={generarPlaneacionWord}
              disabled={generandoPlaneacion || preparandoAvance}
              className="rounded-2xl bg-[#c8a45d] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] shadow-lg shadow-[#c8a45d]/30 transition hover:bg-[#d7bd7a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generandoPlaneacion
                ? "Generando planeacion..."
                : "Generar planeacion en Word"}
            </button>
            <button
              type="button"
              onClick={prepararAvance}
              disabled={generandoPlaneacion || preparandoAvance}
              className="rounded-2xl bg-[#071a33] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-slate-300/70 transition hover:bg-[#0b2a52] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {preparandoAvance
                ? "Preparando avance..."
                : "Generar Avance Programatico"}
            </button>
          </div>

          {(generandoPlaneacion || preparandoAvance) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {generandoPlaneacion ? "Generando la planeacion" : "Preparando el avance"}...
              puede tardar hasta ~1 minuto. No cierres la pagina.
            </div>
          )}

          {mensaje && (
            <div
              role="alert"
              className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
                mensaje.tipo === "exito"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {mensaje.texto}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
