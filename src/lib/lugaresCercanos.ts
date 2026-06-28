// Utilidades de lógica pura para calcular y filtrar lugares cercanos.
// Sin React, sin navigator, sin Firestore: solo recibe datos y devuelve datos.

// Un lugar de interés con coordenadas geográficas.
export type Lugar = {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  categoria?: string; // opcional, ej. "restaurante", "tienda"
};

// Un lugar con la distancia (en metros) ya calculada respecto al usuario.
export type LugarConDistancia = Lugar & { distanciaMetros: number };

// Radio de la Tierra en metros (usado por la fórmula de Haversine).
const RADIO_TIERRA_METROS = 6371000;

// Convierte grados a radianes.
function gradosARadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

// Calcula la distancia en METROS entre dos puntos (lat/lng en grados)
// usando la fórmula de Haversine.
export function distanciaHaversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = gradosARadianes(lat2 - lat1);
  const dLng = gradosARadianes(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(gradosARadianes(lat1)) *
      Math.cos(gradosARadianes(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return RADIO_TIERRA_METROS * c;
}

// Devuelve los lugares dentro de `radioMetros` del usuario, cada uno con su
// distancia (entera), ordenados de más cercano a más lejano.
export function lugaresCercanos(
  ubicacionUsuario: [number, number], // [lat, lng]
  lugares: Lugar[],
  radioMetros: number = 300
): LugarConDistancia[] {
  const [latUsuario, lngUsuario] = ubicacionUsuario;

  return lugares
    .map((lugar): LugarConDistancia => ({
      ...lugar,
      distanciaMetros: Math.round(
        distanciaHaversine(latUsuario, lngUsuario, lugar.lat, lugar.lng)
      ),
    }))
    .filter((lugar) => lugar.distanciaMetros <= radioMetros)
    .sort((a, b) => a.distanciaMetros - b.distanciaMetros);
}
