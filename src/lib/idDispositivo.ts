// Utilidad para un ID anónimo y aleatorio por dispositivo, persistido en
// localStorage. Sirve para deduplicar impresiones de anuncios (1 por usuario
// por día). No contiene datos personales ni requiere login.

// Clave bajo la cual se guarda el ID en localStorage.
const CLAVE_ID = "rt_device_id";

// ID en memoria como respaldo cuando localStorage no está disponible
// (modo privado, almacenamiento bloqueado, etc.). Mantiene estabilidad
// durante la sesión aunque no se pueda persistir.
let idEnMemoria: string | null = null;

// Genera un identificador aleatorio. Usa crypto.randomUUID cuando existe; si no,
// cae a un random simple (suficiente para deduplicar; no es para seguridad).
function generarId(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // Si crypto falla por algún motivo, se usa el fallback de abajo.
  }

  return `rt-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

// Devuelve el ID anónimo del dispositivo, creándolo y persistiéndolo si no existe.
export function obtenerIdDispositivo(): string {
  // En SSR/build no hay navegador: no se toca localStorage. Valor neutro.
  if (typeof window === "undefined") return "";

  try {
    const guardado = window.localStorage.getItem(CLAVE_ID);
    if (guardado) return guardado;

    const nuevo = generarId();
    window.localStorage.setItem(CLAVE_ID, nuevo);
    return nuevo;
  } catch {
    // localStorage falló (modo privado / bloqueado): se usa un ID en memoria,
    // estable durante la sesión, sin romper la app.
    if (!idEnMemoria) idEnMemoria = generarId();
    return idEnMemoria;
  }
}
