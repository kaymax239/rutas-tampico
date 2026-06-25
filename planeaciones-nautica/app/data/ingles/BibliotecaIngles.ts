export type NivelIngles = "3" | "4" | "5" | "6" | "7";

export type SemanaIngles = {
  semana: number;
  contenido: string;
  actividades: string[];
  recursos: string[];
  evidencias: string;
};

export type PlaneacionIngles = {
  asignatura: string;
  nivel: NivelIngles;
  grupo: string;
  tema: string;
  enfoque: string;
  objetivoGeneral: string;
  objetivosEspecificos: string[];
  competencias: {
    disciplinares: string[];
    genericas: {
      instrumentales: string[];
      interpersonales: string[];
      sistemicas: string[];
    };
  };
  evaluacion: { instrumento: string; porcentaje: number }[];
  bibliografia: string[];
  secuenciaSemanal: SemanaIngles[];
};

const competenciasGenericas = {
  instrumentales: [
    "Utiliza las tecnologias de la informacion y comunicacion con eficacia.",
    "Analiza y sintetiza informacion proveniente de distintas fuentes.",
    "Comunica ideas de forma oral y escrita en contextos academicos.",
  ],
  interpersonales: [
    "Colabora eficazmente en equipos de trabajo.",
    "Participa con respeto en actividades comunicativas.",
    "Asume responsabilidad en su proceso de aprendizaje.",
  ],
  sistemicas: [
    "Aplica conocimientos linguisticos en situaciones profesionales.",
    "Integra vocabulario tecnico en tareas comunicativas.",
    "Desarrolla autonomia para continuar aprendiendo ingles.",
  ],
};

const competenciasDisciplinares = [
  "Utilizar el idioma ingles para comunicarse de forma oral y escrita.",
  "Comprender textos y audios relacionados con situaciones maritimas.",
  "Expresar ideas, instrucciones y necesidades en contextos cotidianos y profesionales.",
  "Aplicar vocabulario tecnico basico en dialogos, reportes y actividades de clase.",
];

const bibliografiaBase = [
  "I Discover Student Book & Workbook. Evans, Dooley. Express Publishing, 2013.",
  "IMO Standard Marine Communication Phrases. International Maritime Organization.",
  "Material didactico y recursos digitales seleccionados por el docente.",
];

const temasPorNivel: Record<NivelIngles, string[]> = {
  "3": [
    "Module 1 Food & Drinks",
    "Vocabulary for meals, quantities and preparation processes",
    "Restaurant dialogues and polite requests",
    "Present simple and present continuous in daily routines",
    "Past events and short narratives",
    "Future arrangements and uncertain plans",
    "Reading and listening comprehension practice",
    "Integrated review and communicative project",
  ],
  "4": [
    "Module 2 Maritime routines",
    "Shipboard duties and responsibilities",
    "Safety instructions and emergency vocabulary",
    "Giving directions and describing locations",
    "Past routines and incident reports",
    "Comparatives for equipment and procedures",
    "Listening practice with maritime situations",
    "Integrated review and oral performance",
  ],
  "5": [
    "Module 3 Weather and navigation communication",
    "Weather vocabulary and forecasts",
    "Port arrival and departure communication",
    "Describing routes, positions and movement",
    "Modal verbs for obligation and recommendation",
    "Reading maritime notices and short reports",
    "Bridge-team communication practice",
    "Integrated review and written evidence",
  ],
  "6": [
    "Module 4 Engine room and technical communication",
    "Machinery vocabulary and maintenance actions",
    "Reporting faults and requesting assistance",
    "Sequencing procedures and safety checks",
    "Passive voice in technical descriptions",
    "Reading manuals and operational instructions",
    "Role play for technical incident reporting",
    "Integrated review and technical report",
  ],
  "7": [
    "Module 5 Professional maritime communication",
    "SMCP phrases for standard situations",
    "Emergency communication and distress messages",
    "Port state control and inspection vocabulary",
    "Presenting information in professional briefings",
    "Writing reports and operational summaries",
    "Listening practice with authentic maritime exchanges",
    "Integrated review and final communicative task",
  ],
};

export const nivelesInglesDisponibles = Object.keys(
  temasPorNivel,
) as NivelIngles[];

export function construirPlaneacionIngles({
  nivel,
  grupo,
  semanas,
}: {
  nivel: NivelIngles;
  grupo: string;
  semanas: number;
}): PlaneacionIngles {
  const temas = temasPorNivel[nivel];
  const totalSemanas = Math.max(1, Math.min(semanas || 18, 18));

  const secuenciaSemanal = Array.from({ length: totalSemanas }, (_, index) => {
    const tema = temas[index % temas.length];

    return {
      semana: index + 1,
      contenido: tema,
      actividades: [
        `Activacion de vocabulario y preguntas guia sobre ${tema}.`,
        "Practica oral y escrita mediante ejercicios individuales y colaborativos.",
        "Cierre con retroalimentacion, evidencia de aprendizaje y reflexion breve.",
      ],
      recursos: [
        "Libro de texto",
        "Workbook",
        "Presentacion digital",
        "Audio o video didactico",
      ],
      evidencias: "Ejercicios resueltos, participacion oral y producto de clase.",
    };
  });

  return {
    asignatura: `Ingles Maritimo ${nivel}`,
    nivel,
    grupo,
    tema: temas[0],
    enfoque:
      "Activacion de conocimientos previos, aprendizaje situado, juego de roles, practica guiada y aprendizaje colaborativo.",
    objetivoGeneral:
      "Comunicar ideas, obtener informacion y resolver situaciones academicas y maritimas mediante el uso oral y escrito del idioma ingles.",
    objetivosEspecificos: [
      "Adquirir vocabulario funcional y tecnico del nivel correspondiente.",
      "Aplicar estructuras gramaticales en interacciones orales y escritas.",
      "Comprender textos y audios breves relacionados con contextos maritimos.",
    ],
    competencias: {
      disciplinares: competenciasDisciplinares,
      genericas: competenciasGenericas,
    },
    evaluacion: [
      { instrumento: "Conocimiento", porcentaje: 40 },
      { instrumento: "Actividades y evidencias", porcentaje: 40 },
      { instrumento: "Participacion", porcentaje: 20 },
    ],
    bibliografia: bibliografiaBase,
    secuenciaSemanal,
  };
}
