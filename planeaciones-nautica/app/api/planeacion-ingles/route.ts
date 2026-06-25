import { NextResponse } from "next/server";
import {
  construirPlaneacionIngles,
  nivelesInglesDisponibles,
  type NivelIngles,
} from "../../data/ingles/BibliotecaIngles";

const esNivelIngles = (nivel: string): nivel is NivelIngles =>
  (nivelesInglesDisponibles as string[]).includes(nivel);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const nivel = String(body?.nivel || "").trim();

  if (!esNivelIngles(nivel)) {
    return NextResponse.json(
      {
        error: "sin_historicas_nivel",
        mensaje: `No hay planeaciones historicas del nivel "${nivel}". Niveles disponibles: ${nivelesInglesDisponibles.join(", ")}.`,
        nivelesDisponibles: nivelesInglesDisponibles,
      },
      { status: 404 },
    );
  }

  const semanas = Number(body?.semanas) || 18;

  return NextResponse.json({
    planeacion: construirPlaneacionIngles({
      nivel,
      grupo: String(body?.grupo || ""),
      semanas,
    }),
  });
}
