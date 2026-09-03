export type Zona = "Tampico / Madero" | "Zona Norte / Altamira";

export type Ruta = {
  zona: Zona;
  nombre: string;
  color: string;
  puntos: [number, number][];
};

export type EstadoGpsExterno = "En línea" | "Fuera de línea";

export type GpsExterno = {
  id: string;
  nombre: string;
  ruta: string;
  proveedor: string;
  categoria: string;
  estado: EstadoGpsExterno;
  lat: number;
  lng: number;
  urlRastreador: string;
};

export const rutas: Ruta[] = [
  { zona: "Tampico / Madero", nombre: "Candelario Garza", color: "#f59e0b", puntos: [[22.2553, -97.8686], [22.263, -97.857], [22.272, -97.846], [22.281, -97.836]] },
  { zona: "Tampico / Madero", nombre: "Serapio Venegas", color: "#a855f7", puntos: [[22.244, -97.862], [22.251, -97.851], [22.259, -97.839], [22.268, -97.828]] },
  { zona: "Tampico / Madero", nombre: "Haciendas", color: "#22c55e", puntos: [[22.2553, -97.8686], [22.2605, -97.8601], [22.266, -97.852], [22.273, -97.845]] },
  { zona: "Tampico / Madero", nombre: "Niños Héroes", color: "#3b82f6", puntos: [[22.243, -97.865], [22.2505, -97.858], [22.257, -97.849], [22.265, -97.841]] },
  { zona: "Tampico / Madero", nombre: "Circuito Norte", color: "#f97316", puntos: [[22.275, -97.895], [22.282, -97.881], [22.287, -97.865], [22.292, -97.849]] },
  { zona: "Tampico / Madero", nombre: "Tampico - Madero", color: "#a855f7", puntos: [[22.2553, -97.8686], [22.244, -97.849], [22.236, -97.836], [22.225, -97.821]] },
  { zona: "Tampico / Madero", nombre: "Borreguera", color: "#eab308", puntos: [[22.255, -97.868], [22.264, -97.878], [22.274, -97.888], [22.283, -97.899]] },
  { zona: "Tampico / Madero", nombre: "Tancol", color: "#06b6d4", puntos: [[22.255, -97.868], [22.27, -97.86], [22.285, -97.852], [22.302, -97.845]] },
  { zona: "Tampico / Madero", nombre: "Playa Norte", color: "#0ea5e9", puntos: [[22.2553, -97.8686], [22.248, -97.844], [22.24, -97.826], [22.233, -97.807], [22.229, -97.79]] },
  { zona: "Tampico / Madero", nombre: "Águila - Madero", color: "#84cc16", puntos: [[22.216, -97.858], [22.225, -97.847], [22.235, -97.833], [22.244, -97.82]] },
  { zona: "Tampico / Madero", nombre: "Madero - Borreguera", color: "#f43f5e", puntos: [[22.244, -97.82], [22.25, -97.842], [22.262, -97.866], [22.276, -97.889]] },
  { zona: "Tampico / Madero", nombre: "Tampico - Fovissste - Playa", color: "#6366f1", puntos: [[22.216, -97.858], [22.226, -97.846], [22.236, -97.828], [22.245, -97.805], [22.255, -97.785]] },
  { zona: "Tampico / Madero", nombre: "Germinal - Boulevard", color: "#ec4899", puntos: [[22.233, -97.86], [22.24, -97.846], [22.247, -97.831], [22.255, -97.816]] },
  { zona: "Tampico / Madero", nombre: "Bosque - Boulevard", color: "#10b981", puntos: [[22.246, -97.875], [22.252, -97.858], [22.26, -97.84], [22.269, -97.824]] },
  { zona: "Tampico / Madero", nombre: "Tampico - Valle", color: "#f59e0b", puntos: [[22.216, -97.858], [22.228, -97.866], [22.241, -97.875], [22.255, -97.884]] },
  { zona: "Tampico / Madero", nombre: "Tampico - Niños Héroes - Isleta", color: "#14b8a6", puntos: [[22.216, -97.858], [22.228, -97.862], [22.242, -97.865], [22.257, -97.849], [22.269, -97.836]] },
  { zona: "Tampico / Madero", nombre: "Madero - Ganadera - Niños Héroes", color: "#8b5cf6", puntos: [[22.244, -97.82], [22.252, -97.835], [22.26, -97.85], [22.268, -97.865], [22.276, -97.878]] },
  { zona: "Tampico / Madero", nombre: "Ruta 1 - Mirador / Aviación / Boulevard", color: "#ef4444", puntos: [[22.2445, -97.8565], [22.247, -97.853], [22.25, -97.843]] },
  { zona: "Tampico / Madero", nombre: "Ruta 7 - Tampico ↔ Playa Norte por Boulevard", color: "#3b82f6", puntos: [[22.249, -97.857], [22.2565, -97.8545], [22.2705, -97.8392]] },
  { zona: "Tampico / Madero", nombre: "Ruta 8 - Seguro Social ↔ Lomas de Infonavit", color: "#10b981", puntos: [[22.247, -97.859], [22.2525, -97.851], [22.258, -97.847]] },
  { zona: "Tampico / Madero", nombre: "Ruta 16 - Ej. Contadero / Germinal / Águila", color: "#f59e0b", puntos: [[22.2375, -97.835], [22.2455, -97.848], [22.25, -97.859]] },
  { zona: "Tampico / Madero", nombre: "Ruta 24 - Tampico Tancol / Col. del Bosque", color: "#8b5cf6", puntos: [[22.2435, -97.8532], [22.2603, -97.8325], [22.2678, -97.828]] },
  { zona: "Tampico / Madero", nombre: "Ruta 35 - Madero Ganadera / Niños Héroes", color: "#ec4899", puntos: [[22.268, -97.828], [22.26, -97.8375], [22.252, -97.853]] },
  { zona: "Tampico / Madero", nombre: "Ruta 38 - Circuito Norte", color: "#14b8a6", puntos: [[22.269, -97.844], [22.2735, -97.836], [22.268, -97.828]] },
  { zona: "Tampico / Madero", nombre: "Ruta 39 - Playa Sur / Refinería Tampico", color: "#db2777", puntos: [[22.2745, -97.843], [22.267, -97.833], [22.254, -97.85]] },
  { zona: "Zona Norte / Altamira", nombre: "Altamira - Tampico", color: "#ef4444", puntos: [[22.392, -97.92], [22.35, -97.9], [22.31, -97.88], [22.2553, -97.8686]] },
  { zona: "Zona Norte / Altamira", nombre: "Altamira - Nuevo Tampico", color: "#f97316", puntos: [[22.392, -97.92], [22.37, -97.9], [22.34, -97.885], [22.31, -97.875]] },
  { zona: "Zona Norte / Altamira", nombre: "Altamira - Borreguera", color: "#eab308", puntos: [[22.392, -97.92], [22.35, -97.9], [22.31, -97.885], [22.276, -97.889]] },
  { zona: "Zona Norte / Altamira", nombre: "Altamira - Centro", color: "#22c55e", puntos: [[22.392, -97.92], [22.385, -97.91], [22.376, -97.9], [22.365, -97.89]] },
  { zona: "Zona Norte / Altamira", nombre: "Altamira - Guadalupe Victoria", color: "#3b82f6", puntos: [[22.392, -97.92], [22.405, -97.91], [22.42, -97.9], [22.435, -97.89]] },
  { zona: "Zona Norte / Altamira", nombre: "Ruta 40 - Altamira Centro / Arboledas / Monte Alto", color: "#06b6d4", puntos: [[22.392, -97.938], [22.4035, -97.929], [22.415, -97.9215]] },
  { zona: "Zona Norte / Altamira", nombre: "Ruta 41 - Altamira Centro / Laguna Florida", color: "#22c55e", puntos: [[22.3925, -97.9385], [22.4015, -97.946], [22.41, -97.955]] },
  { zona: "Zona Norte / Altamira", nombre: "Ruta 42 - Altamira Centro / Miramar / Pedrera", color: "#f97316", puntos: [[22.392, -97.938], [22.381, -97.927], [22.371, -97.915]] },
  { zona: "Zona Norte / Altamira", nombre: "Ruta 43 - Monte Alto / Pedrera / Tampico", color: "#e11d48", puntos: [[22.417, -97.922], [22.404, -97.912], [22.36, -97.886]] },
  { zona: "Zona Norte / Altamira", nombre: "Ruta 44 - Altamira Centro / Santa Elena / Tampico", color: "#6366f1", puntos: [[22.392, -97.938], [22.373, -97.918], [22.336, -97.889]] },
  { zona: "Zona Norte / Altamira", nombre: "Ruta 45 - Altamira Centro / Unidos Avanzamos", color: "#84cc16", puntos: [[22.392, -97.938], [22.402, -97.951], [22.4135, -97.9625]] },
  { zona: "Zona Norte / Altamira", nombre: "Ruta 46 - Altamira Centro / Los Prados / Monte Alto", color: "#0ea5e9", puntos: [[22.392, -97.938], [22.405, -97.933], [22.418, -97.924]] },
  { zona: "Zona Norte / Altamira", nombre: "Ruta 47 - Altamira Centro / Laguna de la Puerta", color: "#a855f7", puntos: [[22.392, -97.938], [22.3815, -97.951], [22.372, -97.965]] },
  { zona: "Zona Norte / Altamira", nombre: "Ruta 48 - Altamira / Puerto Industrial", color: "#f43f5e", puntos: [[22.392, -97.938], [22.43, -97.9], [22.46, -97.875]] },
  { zona: "Zona Norte / Altamira", nombre: "Ruta 49 - Monte Alto / Puerto Industrial", color: "#14b8a6", puntos: [[22.417, -97.922], [22.438, -97.902], [22.46, -97.875]] },
  { zona: "Tampico / Madero", nombre: "Blanco Kinder", color: "#38bdf8", puntos: [[22.244, -97.842], [22.252, -97.832], [22.262, -97.822]] },
  { zona: "Tampico / Madero", nombre: "Puertas Coloradas", color: "#fb7185", puntos: [[22.2553, -97.8686], [22.244, -97.879], [22.232, -97.892]] },
  { zona: "Tampico / Madero", nombre: "Enrique Cárdenas / UAT", color: "#facc15", puntos: [[22.2553, -97.8686], [22.263, -97.858], [22.276, -97.849]] },
  { zona: "Tampico / Madero", nombre: "Madero Kehoe", color: "#c084fc", puntos: [[22.244, -97.82], [22.253, -97.811], [22.263, -97.802]] },
  { zona: "Tampico / Madero", nombre: "Águila Echeverría", color: "#2dd4bf", puntos: [[22.216, -97.858], [22.226, -97.849], [22.238, -97.841]] },
  { zona: "Tampico / Madero", nombre: "Tampico - Las Flores", color: "#f472b6", puntos: [[22.216, -97.858], [22.229, -97.85], [22.242, -97.84]] },
  { zona: "Zona Norte / Altamira", nombre: "Altamira Av. Monterrey", color: "#f97316", puntos: [[22.392, -97.938], [22.354, -97.91], [22.304, -97.872]] },
  { zona: "Zona Norte / Altamira", nombre: "Arboledas x Electricistas", color: "#65a30d", puntos: [[22.392, -97.938], [22.404, -97.929], [22.414, -97.936]] },
  { zona: "Tampico / Madero", nombre: "Combi Bellavista", color: "#0f766e", puntos: [[22.216, -97.858], [22.224, -97.866], [22.233, -97.875]] },
  { zona: "Zona Norte / Altamira", nombre: "Puente Las Piñas", color: "#2563eb", puntos: [[22.392, -97.938], [22.382, -97.952], [22.371, -97.967]] }
];

export const GPS_EXTERNOS: GpsExterno[] = [
  {
    id: "gps-bus-01",
    nombre: "GPS Bus 01",
    ruta: "Tampico - Altamira",
    proveedor: "Steren GPS-1100",
    categoria: "GPS Externos",
    estado: "En línea",
    lat: 22.364418,
    lng: -97.882343,
    urlRastreador: "https://www.gps.steren.com.mx/page/share.jsp?mapType=google&token=S1782665340456O774186ac37ac9416dae5f77dcb82d8c85d516a",
  },
];
