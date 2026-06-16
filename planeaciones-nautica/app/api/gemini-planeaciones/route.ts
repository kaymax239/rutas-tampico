import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export const runtime = "nodejs";

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

function extractTextFromDocx(filePath: string): string {
  try {
    const zip = new PizZip(fs.readFileSync(filePath));
    const xml = zip.files["word/document.xml"]?.asText() ?? "";
    return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
  } catch {
    return "";
  }
}

function findHistoricalPlaneaciones(dir: string, max = 2): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  function scan(current: string) {
    if (results.length >= max) return;
    const items = fs.readdirSync(current, { withFileTypes: true });
    for (const item of items) {
      if (results.length >= max) break;
      const fullPath = path.join(current, item.name);
      if (item.isDirectory()) {
        scan(fullPath);
      } else if (
        item.isFile() &&
        item.name.toLowerCase().endsWith(".docx") &&
        !item.name.startsWith("~")
      ) {
        results.push(fullPath);
      }
    }
  }

  scan(dir);
  return results;
}

async function generarPlaneacionClaude(params: {
  materia: string;
  clave: string;
  semestre: string;
  pdfPath: string | null;
}): Promise<any> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
4. Imita el estilo y vocabulario de las planeaciones históricas de referencia proporcionadas.
5. La salida debe ser JSON válido, sin markdown, sin texto fuera del JSON.

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

  const content: Anthropic.MessageParam["content"] = [];

  // Contexto de estilo: planeaciones históricas
  const historicalDir = path.join(
    process.cwd(),
    "public",
    "templates",
    "biblioteca",
    "planeaciones-historicas"
  );
  const historicalFiles = findHistoricalPlaneaciones(historicalDir, 2);
  if (historicalFiles.length > 0) {
    const textos = historicalFiles
      .map((f) => extractTextFromDocx(f))
      .filter((t) => t.length > 100)
      .join("\n\n---\n\n");

    if (textos.length > 0) {
      content.push({
        type: "text",
        text: `PLANEACIONES HISTÓRICAS DE REFERENCIA (aprende el estilo, vocabulario y formato de Inicio/Desarrollo/Cierre):\n\n${textos}`,
      });
    }
  }

  // PDF del programa oficial
  if (params.pdfPath) {
    const pdfBase64 = fs.readFileSync(params.pdfPath).toString("base64");
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: pdfBase64,
      },
    } as any);
  }

  // Prompt principal
  content.push({ type: "text", text: prompt });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content }],
  });

  const block = response.content[0];
  if (block.type !== "text" || !block.text) {
    throw new Error("Claude no devolvió texto.");
  }

  const jsonMatch = block.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude no devolvió JSON válido.");
  return JSON.parse(jsonMatch[0]);
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

    const planeacion = await generarPlaneacionClaude({
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

    return new Response(new Uint8Array(buffer), {
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
