"use client";

import { useEffect, useState } from "react";
import { materiasPorSemestre, materiasPorSemestreMN } from "./data/materias";
import {
  contenidosMaterias,
  contenidosMateriasMN,
} from "./data/contenidosMaterias";
import {
  distribuirFechas,
  etiquetaSemanaF32,
  EXAMENES,
  formatearRango,
} from "./data/calendario";
import {
  criteriosEvaluacion,
  generacionPorSemestre,
  textoPuntuacionesF32,
} from "./data/evaluacion";
import { distribuirPrograma } from "./data/distribucion";
import { esProgramaOficial, type ProgramaOficial } from "./data/tipos";
// V1 conservada como respaldo en ./data/presentaciones/algebra-u1.ts y ./lib/pptxOficial.ts.
// El botón usa la versión visual V2, resuelta bajo demanda desde el registro.
import { obtenerPresentacion } from "./data/presentaciones/registro";
import { generarPresentacionOficialV2 } from "./lib/pptxOficialV2";
import {
  construirPresentacionV2,
  TEMA_UNIDAD_COMPLETA,
} from "./lib/construirPresentacionV2";
import { temasDeUnidad } from "./data/presentaciones/temas";
import type { PresentacionV2 } from "./data/presentaciones/tiposV2";
import SeleccionSemanasAvance, {
  type SemanaAvanceSeleccionable,
} from "./components/SeleccionSemanasAvance";
import VistaPreviaAvance from "./components/VistaPreviaAvance";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

type SemanaMateria = {
  semana: string;
  tema: string;
};

type DatosMateria = {
  unidad?: string;
  objetivoGeneral?: string;
  objetivoEspecifico?: string;
  estrategia?: string;
  fuentes?: string;
  semanas?: SemanaMateria[];
};

type RangoSemanas = {
  inicio: number;
  fin: number;
};

type PasoAvance = "captura" | "seleccion" | "preview";

const limpiarTema = (tema: string) => tema.trim().replace(/\.$/, "");

// Convierte los subtemas oficiales del programa en "semanas" (un subtema por
// entrada) para alimentar los exámenes con preguntas basadas en el contenido
// REAL de la materia. Sin esto, un ProgramaOficial no expone `semanas` y el
// examen cae a una sola pregunta genérica.
const semanasDesdePrograma = (programa: ProgramaOficial): SemanaMateria[] => {
  const limpio = (s: string) =>
    limpiarTema(s.replace(/^\d+(?:\.\d+)*\.?\s*/, ""));

  return programa.unidades
    .flatMap((u) => u.subtemas)
    .map((subtema, index) => ({
      semana: `Semana ${index + 1}`,
      tema: limpio(subtema),
    }))
    .filter((s) => s.tema.trim().length > 0);
};

const construirSemanaAvance = (
  semana: { semana: string; tema: string },
  index: number,
): SemanaAvanceSeleccionable => {
  const lineasSemana = semana.semana
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);
  const lineasTema = semana.tema
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);
  const numero =
    Number(lineasSemana[0]?.match(/\d+/)?.[0]) || index + 1;
  const unidadTema = lineasTema[0] || `Semana ${numero}`;
  const subtemas = lineasTema.slice(1);

  return {
    id: `semana-${numero}`,
    numero,
    semana: lineasSemana[0] || `Semana ${numero}`,
    fechas: lineasSemana.slice(1).join("\n"),
    unidadTema,
    subtemas: subtemas.length ? subtemas : [unidadTema],
    temaCompleto: semana.tema,
  };
};

const nombreArchivoSeguro = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const contieneAlgunaPalabra = (texto: string, palabras: string[]) => {
  const textoNormalizado = texto.toLowerCase();

  return palabras.some((palabra) => textoNormalizado.includes(palabra));
};

const obtenerContextoDidactico = (materia: string, tema: string) => {
  const textoBase = `${materia} ${tema}`;

  if (
    contieneAlgunaPalabra(textoBase, [
      "naveg",
      "marít",
      "maritim",
      "náut",
      "naut",
      "buque",
      "maniobra",
      "cartograf",
      "meteorolog",
      "puerto",
      "portuar",
      "transporte",
      "guardia",
      "radar",
      "ecdis",
      "seguridad",
      "pmr",
    ])
  ) {
    return "el contexto de navegación, operaciones portuarias, seguridad marítima o vida a bordo";
  }

  if (
    contieneAlgunaPalabra(textoBase, [
      "álgebra",
      "algebra",
      "geometr",
      "física",
      "fisica",
      "dinámica",
      "dinamica",
      "química",
      "quimica",
      "electric",
      "electrotecnia",
    ])
  ) {
    return "la solución de problemas técnicos y académicos vinculados con la formación náutica";
  }

  if (
    contieneAlgunaPalabra(textoBase, [
      "inglés",
      "ingles",
      "expresión",
      "expresion",
      "comunicación",
      "comunicacion",
      "liderazgo",
      "derecho",
    ])
  ) {
    return "situaciones profesionales, comunicativas y colaborativas propias del entorno marítimo";
  }

  return "la formación académica y profesional del cadete";
};

const generarSecuenciaDidactica = (
  materia: string,
  semana: SemanaMateria,
  datosMateria?: DatosMateria,
  siguienteTema?: string,
) => {
  const tema = limpiarTema(semana.tema);
  const contexto = obtenerContextoDidactico(materia, tema);
  const objetivo =
    datosMateria?.objetivoEspecifico ||
    datosMateria?.objetivoGeneral ||
    `comprender y aplicar el tema de ${tema} en ${materia}`;
  const estrategia =
    datosMateria?.estrategia ||
    "aprendizaje guiado, práctica supervisada y trabajo colaborativo";
  const enlaceSiguiente = siguienteTema
    ? `Se vincula el aprendizaje con la siguiente sesión sobre ${limpiarTema(
        siguienteTema,
      )}.`
    : "Se integran los aprendizajes de la sesión como base para la evaluación o actividad integradora.";

  return [
    `Inicio: Pregunta detonadora: ¿cómo se relaciona ${tema} con ${contexto}? El docente recupera conocimientos previos mediante preguntas breves, ejemplos cercanos a la experiencia del cadete y una contextualización del tema dentro de ${materia}.`,
    `Desarrollo: Se realiza una explicación guiada de ${tema}, alineada con el propósito de ${objetivo}. Los cadetes desarrollan una actividad práctica basada en ${estrategia}, alternando trabajo individual y colaborativo para resolver ejercicios, analizar casos o elaborar productos aplicados a ${contexto}.`,
    `Cierre: Se socializan resultados y se brinda retroalimentación puntual sobre aciertos, áreas de mejora y criterios de desempeño. La evidencia de aprendizaje será una actividad, ejercicio, reporte breve o participación argumentada relacionada con ${tema}. Cada cadete formula una reflexión final sobre la utilidad del tema. ${enlaceSiguiente}`,
  ].join("\n\n");
};

const obtenerAnioPeriodo = (periodo: string) =>
  periodo.match(/\d{4}/)?.[0] || new Date().getFullYear().toString();

const obtenerSemanasAvance = (
  datosMateria: DatosMateria | undefined,
  semanasSeleccionadas?: SemanaMateria[],
) => {
  const semanasAvance = semanasSeleccionadas || datosMateria?.semanas || [];

  return Array.from({ length: 4 }, (_, index) => {
    const semana = semanasAvance[index];

    return {
      numero: semana?.semana?.split("\n")[0] || `Semana ${index + 1}`,
      tema: semana?.tema
        ? limpiarTema(semana.tema)
        : "Sin tema programado para este periodo reportado.",
      sesiones: semana?.tema ? "1" : "0",
    };
  });
};

const construirDatosAvanceProgramatico = ({
  materia,
  datosMateria,
  docente,
  grupo,
  semestre,
  periodoEscolar,
  periodoReportado,
  escuela,
  licenciatura,
  semanasSeleccionadas,
}: {
  materia: string;
  datosMateria?: DatosMateria;
  docente: string;
  grupo: string;
  semestre: string;
  periodoEscolar: string;
  periodoReportado: string;
  escuela: string;
  licenciatura: string;
  semanasSeleccionadas?: SemanaMateria[];
}) => {
  const semanasAvance = obtenerSemanasAvance(
    datosMateria,
    semanasSeleccionadas,
  );
  const temasSubtemasCubiertos = semanasAvance
    .filter((semana) => semana.sesiones !== "0")
    .map((semana) => `${semana.numero}: ${semana.tema}`)
    .join("\n");
  const objetivosCompetencias =
    datosMateria?.objetivoEspecifico ||
    datosMateria?.objetivoGeneral ||
    `Desarrollar competencias académicas y profesionales relacionadas con ${materia}.`;
  const estrategiasTecnicas =
    datosMateria?.estrategia ||
    "Exposición guiada, análisis de casos, ejercicios prácticos, trabajo individual y colaborativo.";
  const recursosDidacticos =
    "Presentación digital, equipo de cómputo, material didáctico, recursos digitales y referencias académicas.";
  const evidenciasAprendizaje =
    "Actividades de clase, ejercicios resueltos, participación, reporte breve y evidencias integradas en el portafolio académico.";
  const instrumentosEvaluacion =
    "Lista de cotejo, rúbrica de desempeño, participación guiada y evaluación formativa.";

  return {
    escuela,
    asignatura: materia,
    curso: materia,
    asignaturaCurso: materia,
    mes: periodoReportado,
    anio: obtenerAnioPeriodo(periodoEscolar),
    docente,
    licenciatura,
    semestre,
    grupo,
    periodoReportado,
    periodoEscolar,
    temasCubiertos:
      temasSubtemasCubiertos || "Sin temas registrados para este periodo.",
    temasSubtemasCubiertos:
      temasSubtemasCubiertos || "Sin temas registrados para este periodo.",
    objetivosCompetencias,
    estrategiasTecnicas,
    evidenciasAprendizaje,
    recursosDidacticos,
    instrumentosEvaluacion,
    actividadesSigaaSi: "X",
    actividadesSigaaNo: "",
    nombreFirmaDocente: docente || "Nombre y firma del docente",
    semana1: semanasAvance[0].numero,
    tema1: semanasAvance[0].tema,
    semana1Tema: semanasAvance[0].tema,
    sesiones1: semanasAvance[0].sesiones,
    semana1Sesiones: semanasAvance[0].sesiones,
    estrategia1: estrategiasTecnicas,
    evidencia1: evidenciasAprendizaje,
    recursos1: recursosDidacticos,
    instrumento1: instrumentosEvaluacion,
    semana2: semanasAvance[1].numero,
    tema2: semanasAvance[1].tema,
    semana2Tema: semanasAvance[1].tema,
    sesiones2: semanasAvance[1].sesiones,
    semana2Sesiones: semanasAvance[1].sesiones,
    estrategia2: estrategiasTecnicas,
    evidencia2: evidenciasAprendizaje,
    recursos2: recursosDidacticos,
    instrumento2: instrumentosEvaluacion,
    semana3: semanasAvance[2].numero,
    tema3: semanasAvance[2].tema,
    semana3Tema: semanasAvance[2].tema,
    sesiones3: semanasAvance[2].sesiones,
    semana3Sesiones: semanasAvance[2].sesiones,
    estrategia3: estrategiasTecnicas,
    evidencia3: evidenciasAprendizaje,
    recursos3: recursosDidacticos,
    instrumento3: instrumentosEvaluacion,
    semana4: semanasAvance[3].numero,
    tema4: semanasAvance[3].tema,
    semana4Tema: semanasAvance[3].tema,
    sesiones4: semanasAvance[3].sesiones,
    semana4Sesiones: semanasAvance[3].sesiones,
    estrategia4: estrategiasTecnicas,
    evidencia4: evidenciasAprendizaje,
    recursos4: recursosDidacticos,
    instrumento4: instrumentosEvaluacion,
    razonesNoCumplio: "",
    firmaDocente: docente || "Nombre y firma del docente",
  };
};

const construirPreguntasExamen = (materia: string, temas: SemanaMateria[]) => {
  const temasLimpios = temas.map((semana) => limpiarTema(semana.tema));
  const temasBase =
    temasLimpios.length > 0 ? temasLimpios : [`contenidos esenciales de ${materia}`];

  const opcionMultiple = temasBase
    .slice(0, 10)
    .map(
      (tema, index) =>
        `${index + 1}. ¿Cuál es la importancia de ${tema} dentro de ${materia}?\n` +
        `A) Permite aplicar el contenido en situaciones académicas o náuticas.\n` +
        `B) Sustituye todos los demás temas de la asignatura.\n` +
        `C) No tiene relación con la formación profesional.\n` +
        `D) Solo se utiliza para actividades administrativas.`,
    )
    .join("\n\n");

  const verdaderoFalso = temasBase
    .slice(0, 8)
    .map(
      (tema, index) =>
        `${index + 1}. ${tema} debe analizarse considerando conceptos, procedimientos y aplicaciones propias de ${materia}. (V/F)`,
    )
    .join("\n");

  const relacionarColumnas = [
    "Columna A",
    ...temasBase
      .slice(0, 6)
      .map((tema, index) => `${index + 1}. ${tema}`),
    "",
    "Columna B",
    ...temasBase
      .slice(0, 6)
      .map(
        (tema, index) =>
          `${String.fromCharCode(65 + index)}. Aplicación, concepto o procedimiento relacionado con ${tema}.`,
      ),
  ].join("\n");

  const preguntasAbiertas = temasBase
    .slice(0, 5)
    .map(
      (tema, index) =>
        `${index + 1}. Explica cómo se aplica ${tema} en el contexto académico o profesional de ${materia}.`,
    )
    .join("\n");

  return {
    opcionMultiple,
    verdaderoFalso,
    relacionarColumnas,
    preguntasAbiertas,
  };
};

const construirDatosExamen = ({
  tipo,
  materia,
  datosMateria,
  docente,
  grupo,
  semestre,
  fecha,
  periodoEscolar,
  rango,
}: {
  tipo: string;
  materia: string;
  datosMateria?: DatosMateria;
  docente: string;
  grupo: string;
  semestre: string;
  fecha: string;
  periodoEscolar: string;
  rango: RangoSemanas;
}) => {
  const semanas = datosMateria?.semanas?.slice(rango.inicio, rango.fin) || [];
  const temasTexto = semanas
    .map((semana, index) => {
      const numeroSemana = rango.inicio + index + 1;

      return `Semana ${numeroSemana}. ${limpiarTema(semana.tema)}`;
    })
    .join("\n");
  const temas = semanas.map((semana) => limpiarTema(semana.tema));
  const objetivo =
    datosMateria?.objetivoEspecifico ||
    datosMateria?.objetivoGeneral ||
    `Evaluar los aprendizajes de ${materia}.`;
  const preguntas = construirPreguntasExamen(materia, semanas);

  return {
    tipoExamen: tipo,
    examen: tipo,
    materia,
    asignatura: materia,
    asignaturaCurso: materia,
    curso: materia,
    semestre,
    docente,
    profesor: docente,
    grupo,
    fecha,
    fechaInicio: fecha,
    periodo: periodoEscolar,
    periodoEscolar,
    unidad: datosMateria?.unidad || "I",
    objetivo,
    objetivosCompetencias: objetivo,
    temas: temasTexto,
    temasMateria: temasTexto,
    temasEvaluar: temasTexto,
    opcionMultiple: preguntas.opcionMultiple,
    verdaderoFalso: preguntas.verdaderoFalso,
    relacionarColumnas: preguntas.relacionarColumnas,
    preguntasAbiertas: preguntas.preguntasAbiertas,
    tema1: temas[0] || "",
    tema2: temas[1] || "",
    tema3: temas[2] || "",
    tema4: temas[3] || "",
    tema5: temas[4] || "",
    tema6: temas[5] || "",
    tema7: temas[6] || "",
    tema8: temas[7] || "",
    tema9: temas[8] || "",
    tema10: temas[9] || "",
    tema11: temas[10] || "",
    tema12: temas[11] || "",
    tema13: temas[12] || "",
    tema14: temas[13] || "",
    tema15: temas[14] || "",
    tema16: temas[15] || "",
    tema17: temas[16] || "",
    tema18: temas[17] || "",
  };
};

export default function Home() {
  const [carrera, setCarrera] = useState<"PN" | "MN">("PN");
  const [materiaSeleccionada, setMateriaSeleccionada] = useState("");
  const [semestreSeleccionado, setSemestreSeleccionado] = useState("");
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(1);
  const [temaSeleccionado, setTemaSeleccionado] = useState(TEMA_UNIDAD_COMPLETA);

  const [docente, setDocente] = useState("");
  const [grupo, setGrupo] = useState("");
  const [cadetes, setCadetes] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [pasoAvance, setPasoAvance] = useState<PasoAvance>("captura");
  const [semanasAvanceSeleccionadas, setSemanasAvanceSeleccionadas] = useState<
    string[]
  >([]);
  const [generandoAvance, setGenerandoAvance] = useState(false);
  const [generandoPresOficial, setGenerandoPresOficial] = useState(false);
  const [mensajePresOficial, setMensajePresOficial] = useState<{
    tipo: "exito" | "error";
    texto: string;
  } | null>(null);
  const [generandoPlaneacion, setGenerandoPlaneacion] = useState(false);
  const [mensajePlaneacion, setMensajePlaneacion] = useState<{
    tipo: "exito" | "error";
    texto: string;
  } | null>(null);
  const [mensajeExamen, setMensajeExamen] = useState<{
    tipo: "exito" | "error";
    texto: string;
  } | null>(null);

  const periodo = "Julio-Diciembre 2026";
  const escuelaNautica =
    'Escuela Náutica Mercante de Tampico "Cap. de Altura Luis Gonzaga Priego González"';

  const horasPorSemana = "1";
  const horasTotales = "18";
  const horasTeoricas = "18";
  const horasIndependientes = "0";

  const menu = carrera === "MN" ? materiasPorSemestreMN : materiasPorSemestre;
  const fuenteContenidos =
    carrera === "MN" ? contenidosMateriasMN : contenidosMaterias;
  // Horas reales de la materia seleccionada (del programa oficial PDF).
  const horasMateria = fuenteContenidos[materiaSeleccionada]?.horas;

  // Unidades oficiales de la materia (del programa oficial). Fallback: una unidad.
  const programaMateria = fuenteContenidos[materiaSeleccionada];
  const unidadesMateria =
    esProgramaOficial(programaMateria) && programaMateria.unidades.length
      ? programaMateria.unidades.map((u) => ({ numero: u.numero, tema: u.tema }))
      : [{ numero: 1, tema: "Unidad 1" }];

  // Temas (subtemas oficiales) de la unidad elegida, para el segundo dropdown.
  const temasUnidad = temasDeUnidad(
    esProgramaOficial(programaMateria) ? programaMateria : undefined,
    unidadSeleccionada,
  );

  // El botón se muestra para toda materia con programa oficial.
  const materiaTienePrograma = esProgramaOficial(programaMateria);
  const puntuacionesAvance = textoPuntuacionesF32(
    "teorico-practica",
    generacionPorSemestre(semestreSeleccionado),
  );
  const semanasAvanceDisponibles: SemanaAvanceSeleccionable[] =
    esProgramaOficial(programaMateria)
      ? distribuirPrograma(programaMateria, puntuacionesAvance)
          .flatMap((bloque) => bloque.semanas)
          .map(construirSemanaAvance)
      : ((programaMateria as unknown as DatosMateria | undefined)?.semanas || [])
          .map((semana, index) => {
            const fecha = distribuirFechas(index + 1)[index];
            return construirSemanaAvance(
              {
                semana: fecha ? etiquetaSemanaF32(fecha) : semana.semana,
                tema: semana.tema,
              },
              index,
            );
          });
  const semanasAvancePreview = semanasAvanceDisponibles.filter((semana) =>
    semanasAvanceSeleccionadas.includes(semana.id),
  );
  const periodoAvanceSeleccionado =
    semanasAvancePreview.length > 0
      ? `Semanas ${semanasAvancePreview
          .map((semana) => semana.numero)
          .join(", ")} - ${periodo}`
      : periodo;

  // Al cambiar de materia o carrera, seleccionar la PRIMERA unidad disponible
  // (no siempre es la número 1: algunos programas empiezan en otra unidad) y
  // volver a "Unidad completa".
  useEffect(() => {
    setUnidadSeleccionada(unidadesMateria[0]?.numero ?? 1);
    setTemaSeleccionado(TEMA_UNIDAD_COMPLETA);
    setMensajePresOficial(null);
    setPasoAvance("captura");
    setSemanasAvanceSeleccionadas([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiaSeleccionada, carrera]);

  // Al cambiar de unidad, volver a "Unidad completa" (los temas cambian).
  useEffect(() => {
    setTemaSeleccionado(TEMA_UNIDAD_COMPLETA);
  }, [unidadSeleccionada]);

  // Presentación PREMIUM hand-authored para la unidad (o null). Tiene prioridad
  // solo cuando se pide la unidad completa.
  const presentacionPremium = obtenerPresentacion(
    carrera,
    materiaSeleccionada,
    unidadSeleccionada,
  );
  const licenciatura =
    carrera === "MN"
      ? "Licenciatura en Maquinista Naval"
      : "Licenciatura en Piloto Naval";

  // "I SEMESTRE" -> "I Semestre" para mostrar en la portada.
  const semestreBonito = semestreSeleccionado
    ? semestreSeleccionado.replace(/\s*SEMESTRE\s*$/i, "").trim() + " Semestre"
    : "";

  const seleccionarCarrera = (c: "PN" | "MN") => {
    setCarrera(c);
    setSemestreSeleccionado("");
    setMateriaSeleccionada("");
  };

  // Pide a la IA (servidor) el guion premium de la unidad/tema. Devuelve la
  // presentación o null si la IA falla o no está configurada (para caer al
  // generador determinista). Nunca lanza: registra el motivo y devuelve null.
  const generarPresentacionConIA = async (): Promise<{
    pres: PresentacionV2;
    cacheado: boolean;
  } | null> => {
    // Límite de espera: si Claude tarda demasiado (timeout / proveedor lento) se
    // aborta la solicitud y se cae al generador determinista, para que la demo
    // nunca se quede colgada esperando a la IA.
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), 120000);
    try {
      const res = await fetch("/api/presentacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrera,
          materia: materiaSeleccionada,
          unidadNumero: unidadSeleccionada,
          tema: temaSeleccionado,
          carreraDisplay: licenciatura,
          semestreDisplay: semestreBonito,
        }),
        signal: controlador.signal,
      });
      if (!res.ok) {
        const detalle = await res.json().catch(() => null);
        console.warn("IA no disponible, usando generador oficial:", detalle);
        return null;
      }
      const data = (await res.json()) as {
        presentacion?: PresentacionV2;
        cacheado?: boolean;
      };
      return data.presentacion
        ? { pres: data.presentacion, cacheado: !!data.cacheado }
        : null;
    } catch (e) {
      console.warn("Error consultando la IA, usando generador oficial:", e);
      return null;
    } finally {
      clearTimeout(limite);
    }
  };

  const generarPresentacionUnidad = async () => {
    // Resolución y construcción del PPTX SOLO al hacer clic (nada precargado).
    const unidadCompleta = temaSeleccionado === TEMA_UNIDAD_COMPLETA;

    setGenerandoPresOficial(true);
    setMensajePresOficial(null);
    try {
      // 1) Premium hand-authored: prioridad para la unidad completa.
      let pres: PresentacionV2 | null =
        unidadCompleta && presentacionPremium ? presentacionPremium : null;
      let fuente = pres ? "plantilla premium" : "";

      // 2) IA bajo demanda (servidor) desde el programa oficial.
      if (!pres && esProgramaOficial(programaMateria)) {
        const ia = await generarPresentacionConIA();
        if (ia) {
          pres = ia.pres;
          fuente = ia.cacheado ? "IA (en cache)" : "IA (Opus)";
        }
      }

      // 3) Fallback determinista desde el programa oficial.
      if (!pres && esProgramaOficial(programaMateria)) {
        pres = construirPresentacionV2({
          programa: programaMateria,
          carrera: licenciatura,
          semestre: semestreBonito,
          unidadNumero: unidadSeleccionada,
          tema: temaSeleccionado,
        });
        fuente = "generador oficial (sin IA)";
      }

      if (!pres) {
        setMensajePresOficial({
          tipo: "error",
          texto:
            "No se pudo preparar la presentación para esta materia/unidad. Verifica que la unidad tenga contenido en el programa oficial.",
        });
        return;
      }

      const archivo = await generarPresentacionOficialV2(pres, {
        docente,
        grupo,
        periodo,
        escuela: escuelaNautica,
      });
      // Mensaje amigable: nunca exponemos detalles técnicos. Si se cayó al
      // generador determinista, lo comunicamos como "generación estándar".
      const esIA = fuente.startsWith("IA");
      const esEstandar = fuente.includes("sin IA");
      setMensajePresOficial({
        tipo: "exito",
        texto: esEstandar
          ? `Se utilizó generación estándar. Presentación descargada: ${archivo}`
          : esIA
            ? `Presentación generada con IA y descargada: ${archivo}`
            : `Presentación generada y descargada: ${archivo}`,
      });
    } catch (error) {
      console.error("Error generando presentación oficial:", error);
      setMensajePresOficial({
        tipo: "error",
        texto:
          "No se pudo generar la presentación en este momento. Intenta de nuevo o cambia de materia.",
      });
    } finally {
      setGenerandoPresOficial(false);
    }
  };
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#c8a45d] focus:ring-2 focus:ring-[#c8a45d]/30";
  const readOnlyClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm";
  const labelClass =
    "mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#0b1f3a]";
  const semestres = Object.keys(menu);
  const materiasDelSemestre = semestreSeleccionado
    ? menu[semestreSeleccionado as keyof typeof menu] || []
    : [];

  const seleccionarSemestre = (semestre: string) => {
    setSemestreSeleccionado(semestre);
    setMateriaSeleccionada("");
  };

  const regresarASemestres = () => {
    setSemestreSeleccionado("");
    setMateriaSeleccionada("");
  };

  const regresarAMaterias = () => {
    setMateriaSeleccionada("");
  };

  const abrirSeleccionAvance = () => {
    setMensajePlaneacion(null);

    if (!materiaSeleccionada) {
      setMensajePlaneacion({
        tipo: "error",
        texto: "Selecciona una asignatura antes de generar el avance.",
      });
      return;
    }

    if (semanasAvanceDisponibles.length === 0) {
      setMensajePlaneacion({
        tipo: "error",
        texto: "No hay semanas disponibles para esta asignatura.",
      });
      return;
    }

    setPasoAvance("seleccion");
  };

  const alternarSemanaAvance = (id: string) => {
    setSemanasAvanceSeleccionadas((actuales) => {
      if (actuales.includes(id)) {
        return actuales.filter((semanaId) => semanaId !== id);
      }

      if (actuales.length >= 4) {
        return actuales;
      }

      return [...actuales, id];
    });
  };

  const continuarVistaPreviaAvance = () => {
    if (semanasAvanceSeleccionadas.length === 0) {
      setMensajePlaneacion({
        tipo: "error",
        texto: "Selecciona al menos una semana para el avance.",
      });
      return;
    }

    setMensajePlaneacion(null);
    setPasoAvance("preview");
  };

  const generarWord = async () => {
    setGenerandoPlaneacion(true);
    setMensajePlaneacion(null);
    try {
      if (!materiaSeleccionada) {
        throw new Error("Selecciona una asignatura antes de generar la planeación.");
      }

      const response = await fetch("/templates/F-32.docx");
      if (!response.ok) {
        throw new Error(
          `No se pudo cargar la plantilla F-32 (HTTP ${response.status}). Verifica que exista en public/templates/F-32.docx.`,
        );
      }
      const content = await response.arrayBuffer();

      const zip = new PizZip(content);

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      const datosMateria =
        fuenteContenidos[materiaSeleccionada] as unknown;

      const generacion = generacionPorSemestre(semestreSeleccionado);
      const puntuaciones = textoPuntuacionesF32("teorico-practica", generacion);
      const criterios = criteriosEvaluacion("teorico-practica", generacion);
      const porcentaje = (incluye: string) =>
        String(
          criterios.find((c) => c.nombre.includes(incluye))?.porcentaje ?? "",
        );

      type DatosRender = {
        asignatura: string;
        clave: string;
        claveAsignatura: string;
        claveAsignaturaCurso: string;
        horasTotales: string;
        horasTeoricas: string;
        horasPracticas: string;
        horasIndependientes: string;
        horasPorSemana: string;
        horasSemana: string;
        horasXSemana: string;
        objetivoGeneral: string;
        unidadBloques: unknown;
        fuentes: string;
      };

      let datosRender: DatosRender;

      if (esProgramaOficial(datosMateria)) {
        // FUENTE DE VERDAD: programa oficial PDF (1.er semestre PN).
        const p = datosMateria;
        datosRender = {
          asignatura: p.nombre,
          clave: p.clave,
          claveAsignatura: p.clave,
          claveAsignaturaCurso: p.clave,
          horasTotales: String(p.horas.total),
          horasTeoricas: String(p.horas.teoricas),
          horasPracticas: String(p.horas.practicas),
          horasIndependientes: String(p.horas.independientes),
          horasPorSemana: String(p.horas.porSemana),
          horasSemana: String(p.horas.porSemana),
          horasXSemana: String(p.horas.porSemana),
          objetivoGeneral: p.objetivoGeneral,
          unidadBloques: distribuirPrograma(p, puntuaciones),
          fuentes: p.bibliografia.length
            ? p.bibliografia.join("\n")
            : "Pendiente de revisión.",
        };
      } else {
        // Legacy: contenido genérico (semestres III, V y VII).
        const dm = datosMateria as DatosMateria | undefined;
        const fechasSemanas = distribuirFechas(dm?.semanas?.length || 0);
        const semanas = (dm?.semanas || []).map(
          (s: SemanaMateria, index, semanasMateria) => ({
            semana: fechasSemanas[index]
              ? etiquetaSemanaF32(fechasSemanas[index])
              : s.semana,
            tema: s.tema,
            secuencia: generarSecuenciaDidactica(
              materiaSeleccionada,
              s,
              dm,
              semanasMateria[index + 1]?.tema,
            ),
            recursos:
              "Computadora, presentación, material didáctico y recursos digitales.",
            producto: "Actividad, evidencia y participación.",
            evaluacion: puntuaciones,
          }),
        );
        datosRender = {
          asignatura: materiaSeleccionada,
          clave: materiaSeleccionada,
          claveAsignatura: materiaSeleccionada,
          claveAsignaturaCurso: materiaSeleccionada,
          horasTotales,
          horasTeoricas,
          horasPracticas: "0",
          horasIndependientes,
          horasPorSemana,
          horasSemana: horasPorSemana,
          horasXSemana: horasPorSemana,
          objetivoGeneral:
            dm?.objetivoEspecifico || "Objetivo general de la asignatura.",
          unidadBloques: [
            {
              unidad: dm?.unidad || "I",
              objetivoEspecifico:
                dm?.objetivoEspecifico || "Objetivo específico de la unidad.",
              estrategia:
                dm?.estrategia ||
                "Aprendizaje guiado, explicación docente y actividades colaborativas.",
              semanas,
            },
          ],
          fuentes: "Bibliografía y materiales de consulta.",
        };
      }

      doc.render({
        escuela: "Tampico",
        licenciatura,
        periodo,
        escuelaNautica,
        ...datosRender,
        docente,
        grupo,
        grupoAsignatura: grupo,
        cadetes,
        fechaInicio,
        nombreDocente: docente,
        numeroCadetes: cadetes,
        fecha: fechaInicio,

        // Plan de evaluación (hoja de fechas de exámenes del F-32)
        fechaParcial1: formatearRango(EXAMENES.parcial1),
        fechaParcial2: formatearRango(EXAMENES.parcial2),
        pctConocimiento: porcentaje("Conocimiento"),
        pctActividades: porcentaje("Actividades"),
        pctParticipacion: porcentaje("Participaciones"),
      });

      const blob = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const partesNombre = [semestreSeleccionado, materiaSeleccionada, grupo, periodo]
        .map((parte) => nombreArchivoSeguro(parte || ""))
        .filter(Boolean);
      const nombreArchivo = `F32_${partesNombre.join("_") || "planeacion"}.docx`;

      saveAs(blob, nombreArchivo);

      setMensajePlaneacion({
        tipo: "exito",
        texto: `Planeación generada y descargada: ${nombreArchivo}`,
      });
    } catch (error) {
      console.error("Error generando F-32:", error);
      const detalle =
        error instanceof Error ? error.message : "Error desconocido.";
      setMensajePlaneacion({
        tipo: "error",
        texto: `No se pudo generar la planeación F-32. ${detalle}`,
      });
    } finally {
      setGenerandoPlaneacion(false);
    }
  };

  const generarAvanceProgramatico = async (
    semanasElegidas: SemanaAvanceSeleccionable[],
  ) => {
    setGenerandoAvance(true);
    setMensajePlaneacion(null);
    try {
      if (!materiaSeleccionada) {
        throw new Error("Selecciona una asignatura antes de generar el avance.");
      }

      if (semanasElegidas.length === 0 || semanasElegidas.length > 4) {
        throw new Error("Selecciona de una a cuatro semanas para el avance.");
      }

      const response = await fetch("/templates/Avance-Programatico-F51.docx");
      if (!response.ok) {
        throw new Error(
          `No se pudo cargar la plantilla F-51 (HTTP ${response.status}).`,
        );
      }
      const content = await response.arrayBuffer();

      const zip = new PizZip(content);

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // Las materias con programa oficial (todas las actuales) no exponen
      // `semanas`; sin esto el avance saldría con "Sin tema programado". Derivamos
      // las semanas del temario oficial usando la misma distribución del F-32.
      const programa = fuenteContenidos[materiaSeleccionada];
      let datosMateria = programa as unknown as DatosMateria | undefined;
      if (esProgramaOficial(programa)) {
        datosMateria = {
          objetivoGeneral: programa.objetivoGeneral,
        };
      }
      const semanasSeleccionadas = semanasElegidas.map((semana) => ({
        semana: `Semana ${semana.numero}`,
        tema: [semana.unidadTema, ...semana.subtemas].join("\n"),
      }));

      doc.render(
        construirDatosAvanceProgramatico({
          materia: materiaSeleccionada,
          datosMateria,
          docente,
          grupo,
          semestre: semestreSeleccionado,
          periodoEscolar: periodo,
          periodoReportado: periodoAvanceSeleccionado,
          escuela: escuelaNautica,
          licenciatura,
          semanasSeleccionadas,
        }),
      );

      const blob = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      saveAs(
        blob,
        `F51_${nombreArchivoSeguro(materiaSeleccionada) || "avance"}_${nombreArchivoSeguro(
          periodoAvanceSeleccionado,
        )}.docx`,
      );

      setMensajePlaneacion({
        tipo: "exito",
        texto: `Avance Programatico F-51 generado y descargado (${periodoAvanceSeleccionado}).`,
      });
      setPasoAvance("captura");
    } catch (error) {
      console.error("Error generando F-51:", error);
      const detalle =
        error instanceof Error ? error.message : "Error desconocido.";
      setMensajePlaneacion({
        tipo: "error",
        texto: `No se pudo generar el Avance Programático F-51. ${detalle}`,
      });
    } finally {
      setGenerandoAvance(false);
    }
  };

  const generarExamen = async (
    tipo: string,
    templatePath: string,
    rango: RangoSemanas,
  ) => {
    setMensajeExamen(null);
    try {
      if (!materiaSeleccionada) {
        throw new Error("Selecciona una asignatura antes de generar el examen.");
      }

      let response = await fetch(templatePath);
      if (!response.ok) {
        throw new Error(
          `No se pudo cargar la plantilla (HTTP ${response.status}).`,
        );
      }
      let content = await response.arrayBuffer();
      let zip = new PizZip(content);
      const documentXml = zip.file("word/document.xml")?.asText() || "";

      // Red de seguridad: si la plantilla elegida no tiene placeholders (caso del
      // examen ordinario), usamos la de parcial (que sí los tiene) para que el
      // examen NUNCA se descargue en blanco. El alcance lo define el rango.
      if (!/\{[^{}]+\}/.test(documentXml)) {
        response = await fetch("/templates/examen-parcial.docx");
        if (!response.ok) {
          throw new Error(
            `No se pudo cargar la plantilla de examen (HTTP ${response.status}).`,
          );
        }
        content = await response.arrayBuffer();
        zip = new PizZip(content);
      }

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // Las materias con programa oficial no exponen `semanas`; derivamos los
      // subtemas reales para que las preguntas correspondan a la materia.
      const programa = fuenteContenidos[materiaSeleccionada];
      const datosMateria: DatosMateria | undefined = esProgramaOficial(programa)
        ? { semanas: semanasDesdePrograma(programa) }
        : (programa as unknown as DatosMateria | undefined);

      doc.render(
        construirDatosExamen({
          tipo,
          materia: materiaSeleccionada,
          datosMateria,
          docente,
          grupo,
          semestre: semestreSeleccionado,
          fecha: fechaInicio,
          periodoEscolar: periodo,
          rango,
        }),
      );

      const blob = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      saveAs(
        blob,
        `${nombreArchivoSeguro(tipo)}_${nombreArchivoSeguro(materiaSeleccionada) || "examen"}.docx`,
      );

      setMensajeExamen({
        tipo: "exito",
        texto: `${tipo} generado y descargado para ${materiaSeleccionada}.`,
      });
    } catch (error) {
      console.error(`Error generando ${tipo}:`, error);
      const detalle =
        error instanceof Error ? error.message : "Error desconocido.";
      setMensajeExamen({
        tipo: "error",
        texto: `No se pudo generar el ${tipo}. ${detalle}`,
      });
    }
  };

  return (
    <main className="min-h-screen bg-[#eef2f7] text-slate-900">
      <div className="flex min-h-screen flex-col xl:flex-row">
        <aside className="bg-[#071a33] text-white xl:w-88 xl:min-h-screen">
          <div className="sticky top-0 flex h-full flex-col gap-8 overflow-y-auto p-6">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-black/20">
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-[#c8a45d] bg-white/95 text-center text-[10px] font-black uppercase leading-tight text-[#071a33] shadow-lg">
                  Logo
                  <br />
                  UMPM
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d7bd7a]">
                    Sistema académico
                  </p>
                  <h1 className="mt-1 text-2xl font-black leading-tight">
                    Planeación F-32
                  </h1>
                </div>
              </div>

              <div className="space-y-2 border-t border-white/15 pt-5">
                <p className="text-sm font-bold text-white">
                  Universidad Marítima y Portuaria de México
                </p>
                <p className="text-sm text-slate-200">
                  Escuela Náutica Mercante de Tampico
                </p>
                <p className="text-xs leading-relaxed text-slate-300">
                  Cap. de Altura Luis Gonzaga Priego González
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex-1 p-4 sm:p-8">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-300/60">
            <header className="relative bg-[#071a33] px-6 py-8 text-white sm:px-10">
              <div className="absolute inset-x-0 top-0 h-2 bg-[#c8a45d]" />
              <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.32em] text-[#d7bd7a]">
                    Universidad Marítima y Portuaria de México
                  </p>
                  <h1 className="max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
                    Portada institucional de planeación académica
                  </h1>
                  <div className="mt-6 h-1 w-28 rounded-full bg-[#c8a45d]" />
                </div>

                <div className="grid grid-cols-2 gap-4 sm:w-72">
                  <div className="flex aspect-square items-center justify-center rounded-3xl border-2 border-[#c8a45d] bg-white text-center text-xs font-black uppercase tracking-[0.18em] text-[#071a33] shadow-xl">
                    Escudo
                    <br />
                    institucional
                  </div>
                  <div className="flex aspect-square items-center justify-center rounded-3xl border-2 border-white/40 bg-white/10 text-center text-xs font-black uppercase tracking-[0.18em] text-white shadow-xl">
                    Logo
                    <br />
                    escuela
                  </div>
                </div>
              </div>
            </header>

            <div className="border-b border-slate-200 bg-[#f8fafc] px-6 py-5 sm:px-10">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c8a45d]">
                    Institución
                  </p>
                  <p className="mt-2 font-bold text-[#071a33]">
                    Universidad Marítima y Portuaria de México
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c8a45d]">
                    Plantel
                  </p>
                  <p className="mt-2 font-bold text-[#071a33]">
                    Escuela Náutica Mercante de Tampico
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c8a45d]">
                    Nombre oficial
                  </p>
                  <p className="mt-2 font-bold text-[#071a33]">
                    Cap. de Altura Luis Gonzaga Priego González
                  </p>
                </div>
              </div>
            </div>

            {!semestreSeleccionado ? (
              <div className="px-6 py-10 sm:px-10">
                <div className="rounded-3xl border border-dashed border-[#c8a45d] bg-[#fffaf0] p-6 text-center sm:p-8">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#071a33] text-xs font-black uppercase tracking-[0.18em] text-[#d7bd7a]">
                    F-32
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
                    Paso 1
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-[#071a33] sm:text-3xl">
                    Selecciona un semestre
                  </h2>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                    Elige la carrera y el semestre para consultar únicamente sus
                    asignaturas y continuar con la captura de la planeación F-32.
                  </p>

                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {(
                      [
                        ["PN", "Piloto Naval"],
                        ["MN", "Maquinista Naval"],
                      ] as const
                    ).map(([valor, etiqueta]) => (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => seleccionarCarrera(valor)}
                        aria-pressed={carrera === valor}
                        className={`rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-[0.16em] shadow-sm transition ${
                          carrera === valor
                            ? "bg-[#071a33] text-white"
                            : "border border-[#071a33]/30 bg-white text-[#071a33] hover:border-[#071a33]"
                        }`}
                      >
                        {etiqueta}
                      </button>
                    ))}
                  </div>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {semestres.map((semestre) => (
                      <button
                        key={semestre}
                        type="button"
                        onClick={() => seleccionarSemestre(semestre)}
                        className="rounded-2xl border border-[#c8a45d]/40 bg-white px-5 py-6 text-lg font-black text-[#071a33] shadow-sm transition hover:-translate-y-0.5 hover:border-[#c8a45d] hover:bg-[#071a33] hover:text-white hover:shadow-xl"
                      >
                        {semestre.replace(" SEMESTRE", "")}
                        <span className="mt-2 block text-xs font-bold uppercase tracking-[0.2em] text-[#c8a45d]">
                          Semestre
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : !materiaSeleccionada ? (
              <div className="px-6 py-8 sm:px-10">
                <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
                      Paso 2
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-[#071a33]">
                      Materias de {semestreSeleccionado}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Selecciona una asignatura para abrir el formulario de
                      datos generales.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={regresarASemestres}
                    className="rounded-2xl border border-[#071a33] px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] transition hover:bg-[#071a33] hover:text-white"
                  >
                    Regresar a semestres
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {materiasDelSemestre.map((materia) => (
                    <button
                      key={materia}
                      type="button"
                      onClick={() => setMateriaSeleccionada(materia)}
                      className="rounded-2xl border border-slate-200 bg-white p-5 text-left text-sm font-bold text-[#071a33] shadow-sm transition hover:-translate-y-0.5 hover:border-[#c8a45d] hover:shadow-lg"
                    >
                      <span className="mb-3 block h-1 w-12 rounded-full bg-[#c8a45d]" />
                      {materia}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                      <div className="mb-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={regresarASemestres}
                          className="rounded-xl border border-[#071a33] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#071a33] transition hover:bg-[#071a33] hover:text-white"
                        >
                          Regresar a semestres
                        </button>
                        <button
                          type="button"
                          onClick={regresarAMaterias}
                          className="rounded-xl border border-[#c8a45d] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#071a33] transition hover:bg-[#c8a45d]"
                        >
                          Regresar a materias
                        </button>
                      </div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
                        Paso 3 · Formato F-32
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-[#071a33]">
                        Datos generales de la portada
                      </h2>
                    </div>
                    <div className="hidden rounded-2xl bg-[#071a33] px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.16em] text-white sm:block">
                      {semestreSeleccionado}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <label className="md:col-span-2">
                      <span className={labelClass}>Nombre del docente</span>
                      <input
                        className={inputClass}
                        placeholder="Nombre completo del docente"
                        value={docente}
                        onChange={(e) => setDocente(e.target.value)}
                      />
                    </label>

                    <label className="md:col-span-2">
                      <span className={labelClass}>Asignatura</span>
                      <input
                        className={readOnlyClass}
                        value={materiaSeleccionada}
                        readOnly
                      />
                    </label>

                    <label>
                      <span className={labelClass}>Grupo</span>
                      <input
                        className={inputClass}
                        placeholder="Ej. 101-A"
                        value={grupo}
                        onChange={(e) => setGrupo(e.target.value)}
                      />
                    </label>

                    <label>
                      <span className={labelClass}>Número de cadetes</span>
                      <input
                        className={inputClass}
                        placeholder="Ej. 28"
                        value={cadetes}
                        onChange={(e) => setCadetes(e.target.value)}
                      />
                    </label>

                    <label>
                      <span className={labelClass}>Periodo escolar</span>
                      <input
                        className={readOnlyClass}
                        value={periodo}
                        readOnly
                      />
                    </label>

                    <label>
                      <span className={labelClass}>Fecha de inicio</span>
                      <input
                        className={inputClass}
                        placeholder="Fecha de inicio"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                      />
                    </label>

                    <label className="md:col-span-2">
                      <span className={labelClass}>Escuela</span>
                      <input
                        className={readOnlyClass}
                        value={escuelaNautica}
                        readOnly
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
                      {materiaSeleccionada}
                    </h3>
                    <div className="mt-6 space-y-4 rounded-2xl border border-white/15 bg-white/10 p-5">
                      <div className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm">
                        <span className="text-slate-300">Docente</span>
                        <span className="font-bold text-right">
                          {docente || "Por definir"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm">
                        <span className="text-slate-300">Grupo</span>
                        <span className="font-bold">{grupo || "Por definir"}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm">
                        <span className="text-slate-300">Cadetes</span>
                        <span className="font-bold">
                          {cadetes || "Por definir"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-sm">
                        <span className="text-slate-300">Periodo</span>
                        <span className="font-bold">{periodo}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className={readOnlyClass}
                      value={`Horas/semana: ${horasMateria?.porSemana ?? horasPorSemana}`}
                      readOnly
                    />

                    <input
                      className={readOnlyClass}
                      value={`Horas totales: ${horasMateria?.total ?? horasTotales}`}
                      readOnly
                    />

                    <input
                      className={readOnlyClass}
                      value={`Horas teóricas: ${horasMateria?.teoricas ?? horasTeoricas}`}
                      readOnly
                    />

                    <input
                      className={readOnlyClass}
                      value={`Horas prácticas: ${horasMateria?.practicas ?? "0"}`}
                      readOnly
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={generarWord}
                      disabled={generandoPlaneacion}
                      className="rounded-2xl bg-[#c8a45d] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] shadow-lg shadow-[#c8a45d]/30 transition hover:bg-[#d7bd7a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {generandoPlaneacion
                        ? "Generando planeación..."
                        : "Generar planeación F-32"}
                    </button>

                    <button
                      type="button"
                      onClick={abrirSeleccionAvance}
                      className="rounded-2xl bg-[#071a33] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-slate-300/70 transition hover:bg-[#0b2a52]"
                    >
                      Generar Avance Programático F-51
                    </button>
                  </div>

                  {mensajePlaneacion && (
                    <div
                      role="alert"
                      className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
                        mensajePlaneacion.tipo === "exito"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-red-200 bg-red-50 text-red-800"
                      }`}
                    >
                      {mensajePlaneacion.texto}
                    </div>
                  )}

                  {pasoAvance === "seleccion" && (
                    <SeleccionSemanasAvance
                      semanas={semanasAvanceDisponibles}
                      seleccionadas={semanasAvanceSeleccionadas}
                      onToggleSemana={alternarSemanaAvance}
                      onContinuar={continuarVistaPreviaAvance}
                      onCancelar={() => setPasoAvance("captura")}
                    />
                  )}

                  {pasoAvance === "preview" && (
                    <VistaPreviaAvance
                      materia={materiaSeleccionada}
                      carrera={licenciatura}
                      semestre={semestreSeleccionado}
                      semanas={semanasAvancePreview}
                      generando={generandoAvance}
                      onVolver={() => setPasoAvance("seleccion")}
                      onGenerar={() =>
                        generarAvanceProgramatico(semanasAvancePreview)
                      }
                    />
                  )}

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
                      Exámenes
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Genera documentos de evaluación usando las plantillas
                      institucionales existentes.
                    </p>

                    <div className="mt-4 grid gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          generarExamen(
                            "Examen Parcial 1",
                            "/templates/examen-parcial.docx",
                            { inicio: 0, fin: 10 },
                          )
                        }
                        className="rounded-2xl border border-[#071a33] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] shadow-sm transition hover:bg-[#071a33] hover:text-white"
                      >
                        Generar Examen Parcial 1
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          generarExamen(
                            "Examen Parcial 2",
                            "/templates/examen-parcial.docx",
                            { inicio: 10, fin: 18 },
                          )
                        }
                        className="rounded-2xl border border-[#071a33] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] shadow-sm transition hover:bg-[#071a33] hover:text-white"
                      >
                        Generar Examen Parcial 2
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          generarExamen(
                            "Examen Ordinario",
                            "/templates/examen-ordinario.docx",
                            { inicio: 0, fin: 18 },
                          )
                        }
                        className="rounded-2xl border border-[#c8a45d] bg-[#fffaf0] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] shadow-sm transition hover:bg-[#c8a45d]"
                      >
                        Generar Examen Ordinario
                      </button>
                    </div>

                    {mensajeExamen && (
                      <div
                        role="alert"
                        className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                          mensajeExamen.tipo === "exito"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800"
                        }`}
                      >
                        {mensajeExamen.texto}
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
                      Presentaciones
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Genera una presentación profesional con IA (Claude Opus),
                      elaborada a partir del programa oficial de estudios. La
                      primera vez puede tardar hasta ~1 minuto.
                    </p>

                    {/* Paso 4 — Selector de unidad (unidades oficiales de la materia). */}
                    <label className="mt-4 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Unidad
                    </label>
                    <select
                      value={unidadSeleccionada}
                      onChange={(e) =>
                        setUnidadSeleccionada(Number(e.target.value))
                      }
                      className={`${inputClass} mt-2`}
                    >
                      {unidadesMateria.map((u) => (
                        <option key={u.numero} value={u.numero}>
                          {`Unidad ${u.numero} — ${u.tema}`}
                        </option>
                      ))}
                    </select>

                    {/* Paso 5 — Selector de tema (subtemas oficiales de la unidad). */}
                    <label className="mt-4 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Tema
                    </label>
                    <select
                      value={temaSeleccionado}
                      onChange={(e) => setTemaSeleccionado(e.target.value)}
                      className={`${inputClass} mt-2`}
                    >
                      <option value={TEMA_UNIDAD_COMPLETA}>
                        Unidad completa (todos los temas)
                      </option>
                      {temasUnidad.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>

                    {/* Paso 6 — Generar: visible para toda materia con programa oficial. */}
                    {materiaTienePrograma ? (
                      <>
                        <button
                          type="button"
                          onClick={generarPresentacionUnidad}
                          disabled={generandoPresOficial}
                          className="mt-4 w-full rounded-2xl bg-[#c8a45d] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] shadow-lg shadow-[#c8a45d]/30 transition hover:bg-[#d7bd7a] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {generandoPresOficial
                            ? "Generando presentación..."
                            : "Generar Presentación"}
                        </button>
                        {generandoPresOficial && (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                            Generando con IA… puede tardar hasta ~1 minuto. No
                            cierres la página.
                          </div>
                        )}
                        {mensajePresOficial && (
                          <div
                            role="alert"
                            className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                              mensajePresOficial.tipo === "exito"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-red-200 bg-red-50 text-red-800"
                            }`}
                          >
                            {mensajePresOficial.texto}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="mt-4 w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-4 text-center text-sm font-semibold text-slate-500">
                        Selecciona una materia con programa oficial
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
