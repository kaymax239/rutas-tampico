export type TipoRecomendacion =
  | "restaurante"
  | "tacos"
  | "tienda"
  | "cafe"
  | "conveniencia";

export type RecomendacionCircuitoNorte = {
  id: string;
  nombre: string;
  tipo: TipoRecomendacion;
  lat: number;
  lng: number;
  precio: "%" | "%%" | "%%%" | "%%%%" | "%%%%%";
  calidad: "😋" | "😋😋" | "😋😋😋" | "😋😋😋😋" | "😋😋😋😋😋";
};

export const recomendacionesCircuitoNorte: RecomendacionCircuitoNorte[] = [
  {
    id: "oxxo-circuito-norte",
    nombre: "OXXO Circuito Norte",
    tipo: "conveniencia",
    lat: 22.27535,
    lng: -97.89455,
    precio: "%%",
    calidad: "😋😋😋",
  },
  {
    id: "restaurante-circuito-norte",
    nombre: "Restaurante Circuito Norte",
    tipo: "restaurante",
    lat: 22.28216,
    lng: -97.88118,
    precio: "%%%",
    calidad: "😋😋😋😋",
  },
  {
    id: "tacos-el-chino",
    nombre: "Tacos El Chino",
    tipo: "tacos",
    lat: 22.2867,
    lng: -97.86545,
    precio: "%",
    calidad: "😋😋😋",
  },
  {
    id: "tienda-la-esquina",
    nombre: "Tienda La Esquina",
    tipo: "tienda",
    lat: 22.29172,
    lng: -97.84932,
    precio: "%%",
    calidad: "😋😋😋",
  },
  {
    id: "cafe-ruta-norte",
    nombre: "Cafe Ruta Norte",
    tipo: "cafe",
    lat: 22.28178,
    lng: -97.88055,
    precio: "%%%",
    calidad: "😋😋😋😋",
  },
];
