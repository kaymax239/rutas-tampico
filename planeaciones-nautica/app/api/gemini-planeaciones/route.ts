import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-2.0-flash";

const PERIODO = "Julio-Diciembre 2026";
const ESCUELA_NAUTICA =
  'Escuela Náutica Mercante de Tampico "Cap. de Altura Luis Gonzaga Priego González"';

const CLAVE_POR_MATERIA: Record<string, string> = {
  // I SEMESTRE
  "Transporte Marítimo I": "TMO101",
  "Álgebra I": "ALG103",
  "Física I": "FIS104",
  "Dibujo de Ingeniería": "DII105",
  "Electricidad I": "ELE106",
  "PMR I": "PMR107",
  "Expresión Oral y Escrita": "C0011",
  "Estrategias de Aprendizaje": "C0099",
  "Educación Física I": "C0100",
  // III SEMESTRE
  "Navegación I": "NAV316",
  "Hidrografía": "HID318",
  "Cartografía": "CAR319",
  "Geometría Analítica": "GEA320",
  "Dinámica": "DIN321",
  "PMR III": "PMR322",
  "Meteorología II": "C0038",
  "Técnicas Avanzadas": "C0038",
  "Redacción Avanzada": "C0011",
  "Educación Física III": "C0101",
  // V SEMESTRE
  "Navegación III": "NAV530",
  "Electrotecnia": "MET532",
  "Maniobras I": "MAN533",
  "Química": "QUH534",
  "Comunicación Visual": "COV535",
  "PMR V": "PMR536",
  "Liderazgo": "C0104",
  "Ética Profesional": "C0104",
  "Mecánica de Fluidos": "MET532",
  "Motores I": "MET532",
  "Máquinas Marinas Auxiliares": "MAN533",
  "Taller IV": "C0104",
  "Educación Física V": "C0105",
  // VII SEMESTRE
  "Navegación V": "NAV745",
  "Simulador de Navegación": "SMV747",
  "Carga y Estiba I": "CYE748",
  "TEB II": "TEB749",
  "OMI": "OMI750",
  "Familiarización con Buques Tanque": "SEM751",
  "FBTR": "SEM751",
  "PMR VII": "PMR752",
  "Laboratorio de Máquinas": "C0129",
  "Automática": "C0129",
  "Refrigeración II": "C0129",
  "Contenedores Multimodal": "C0129",
  "Educación Física VII": "C0131",
};

function findFileByClave(dir: string, clave: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      const found = findFileByClave(fullPath, clave);
      if (found) return found;
    }
    if (
      item.isFile() &&
      item.name.toLowerCase().endsWith(".pdf") &&
      item.name.toUpperCase().includes(clave.toUpperCase())
    ) {
      return fullPath;
    }
  }
  return null;
}

async function generarPlaneacionGemini(params: {
  materia: string;
  clave: string;
  semestre: string;
  pdfPath: string | null;
}): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en .env.local");

  const prompt = `
Eres especialista en planeación didáctica de la Universidad Marítima y Portuaria de México.

Genera una planeación F-32 completa para la Licenciatura en Piloto Naval.

Materia: ${params.materia}
Clave: ${params.clave}
Semestre: ${params.semestre}
Periodo: ${PERIODO}

REGLAS OBLIGATORIAS:
1. Los temas deben basarse en el programa oficial adjunto (si está disponible) o en el contenido estándar de la materia para una escuela náutica mexicana.
2. Distribuye los contenidos en exactamente 18 semanas.
3. Cada semana debe incluir: tema, secuencia didáctica (Inicio / Desarrollo / Cierre), recursos, producto y evaluación.
4. La salida debe ser JSON válido, sin markdown, sin texto fuera del JSON.

ESTRUCTURA JSON EXACTA:
{
  "asignatura": "",
  "clave": "",
  "horasTotales": "18",
  "horasTeoricas": "18",
  "horasPracticas": "0",
  "horasIndependientes": "0",
  "horasSemana": "1",
  "creditos": "1",
  "objetivoGeneral": "",
  "fuentes": "",
  "unidadBloques": [
    {
      "unidad": "I",
      "objetivoEspecifico": "",
      "estrategia": "",
      "semanas": [
        {
          "semana": "Semana 1",
          "tema": "",
          "secuencia": "Inicio: ... Desarrollo: ... Cierre: ...",
          "recursos": "",
          "producto": "",
          "evaluacion": ""
        }
      ]
    }
  ],
  "planEvaluacion": {
    "primerParcial": { "practicasActividades": "40%", "participacionTics": "20%", "conocimiento": "40%" },
    "segundoParcial": { "practicasActividades": "40%", "participacionTics": "20%", "conocimiento": "40%" }
  },
  "observaciones": "",
  "retroalimentacion": ""
}
`;

  const parts: any[] = [{ text: prompt }];

  if (params.pdfPath) {
    const pdfBase64 = fs.readFileSync(params.pdfPath).toString("base64");
    parts.push({ inline_data: { mime_type: "application/pdf", data: pdfBase64 } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini no devolvió texto.");

  return JSON.parse(text);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { materia, semestre, docente, grupo, cadetes, fechaInicio } = body;

    if (!materia) {
      return NextResponse.json(
        { ok: false, error: "Falta el campo materia." },
        { status: 400 }
      );
    }

    const clave = CLAVE_POR_MATERIA[materia] ?? materia;
    const root = process.cwd();

    const programasDir = path.join(
      root,
      "public",
      "templates",
      "biblioteca",
      "piloto-naval",
      "programas"
    );

    const pdfPath = findFileByClave(programasDir, clave);

    const planeacion = await generarPlaneacionGemini({
      materia,
      clave,
      semestre: semestre ?? "I SEMESTRE",
      pdfPath,
    });

    const templatePath = path.join(root, "public", "templates", "F-32.docx");
    const templateContent = fs.readFileSync(templatePath);
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const semanas = (planeacion.unidadBloques?.[0]?.semanas ?? []).map((s: any) => ({
      semana: s.semana,
      tema: s.tema,
      secuencia: s.secuencia,
      recursos: s.recursos,
      producto: s.producto,
      evaluacion: s.evaluacion,
    }));

    doc.render({
      asignatura: planeacion.asignatura || materia,
      escuela: "Tampico",
      periodo: PERIODO,
      escuelaNautica: ESCUELA_NAUTICA,
      horasPorSemana: planeacion.horasSemana || "1",
      horasTotales: planeacion.horasTotales || "18",
      horasTeoricas: planeacion.horasTeoricas || "18",
      horasIndependientes: planeacion.horasIndependientes || "0",
      claveAsignatura: clave,
      horasPracticas: planeacion.horasPracticas || "0",
      clave,
      claveAsignaturaCurso: clave,
      horasSemana: planeacion.horasSemana || "1",
      horasXSemana: planeacion.horasSemana || "1",
      objetivoGeneral: planeacion.objetivoGeneral || "",
      unidadBloques: [
        {
          unidad: planeacion.unidadBloques?.[0]?.unidad || "I",
          objetivoEspecifico: planeacion.unidadBloques?.[0]?.objetivoEspecifico || "",
          estrategia: planeacion.unidadBloques?.[0]?.estrategia || "",
          semanas,
        },
      ],
      docente: docente || "",
      grupo: grupo || "",
      grupoAsignatura: grupo || "",
      cadetes: cadetes || "",
      fechaInicio: fechaInicio || "",
      nombreDocente: docente || "",
      numeroCadetes: cadetes || "",
      fecha: fechaInicio || "",
      fuentes: planeacion.fuentes || "Bibliografía y materiales de consulta.",
    });

    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    const fileName = `F32_${materia.replaceAll(" ", "-")}.docx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
