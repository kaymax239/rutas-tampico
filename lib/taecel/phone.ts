/**
 * Utilidades de teléfono para el flujo de recargas TAECEL.
 *
 * Módulo puro: sin red, sin Firebase, sin React. Reutilizable tanto en
 * el cliente (validación de formularios) como en el servidor (rutas API).
 *
 * Responsabilidades:
 *  - Normalizar un teléfono a 10 dígitos nacionales (México).
 *  - Validar que sea un teléfono mexicano de 10 dígitos.
 *  - Dejar preparada la estructura para el hash futuro (control anti-abuso).
 */

/** Longitud de un teléfono nacional mexicano. */
export const MX_PHONE_LENGTH = 10;

/** Resultado de validar/normalizar un teléfono. */
export type PhoneValidation = {
  /** true si el teléfono es válido tras normalizar. */
  ok: boolean;
  /** Teléfono normalizado a 10 dígitos, o "" si no es válido. */
  normalized: string;
  /** Código de motivo cuando ok = false (para UI/logs). */
  reason?: PhoneInvalidReason;
};

/** Motivos posibles por los que un teléfono se considera inválido. */
export type PhoneInvalidReason =
  | "EMPTY" // entrada vacía o sin dígitos
  | "TOO_SHORT" // menos de 10 dígitos tras normalizar
  | "TOO_LONG" // más de 10 dígitos y no se pudo reducir a nacional
  | "LEADING_ZERO" // empieza en 0 (no válido para lada mexicana)
  | "NOT_MEXICAN"; // no coincide con un patrón nacional reconocible

/**
 * Quita todo lo que no sea dígito (espacios, guiones, paréntesis, "+", etc.).
 */
export function stripNonDigits(input: string): string {
  if (typeof input !== "string") return "";
  return input.replace(/\D+/g, "");
}

/**
 * Normaliza un teléfono mexicano a 10 dígitos nacionales.
 *
 * Acepta y reduce los formatos más comunes:
 *  - "+52 833 123 4567"  -> "8331234567"  (lada país 52)
 *  - "521 833 123 4567"  -> "8331234567"  (52 + 1 de móvil, formato viejo)
 *  - "044 833 123 4567"  -> "8331234567"  (prefijo 044, formato viejo)
 *  - "045 833 123 4567"  -> "8331234567"  (prefijo 045, formato viejo)
 *  - "1 833 123 4567"    -> "8331234567"  (1 inicial de 11 dígitos)
 *  - "833 123 4567"      -> "8331234567"  (ya nacional)
 *
 * Si no logra reducirlo a 10 dígitos, devuelve los dígitos tal cual quedaron
 * (la validación posterior decidirá si es válido o no).
 */
export function normalizePhone(input: string): string {
  let digits = stripNonDigits(input);

  // 52 + 1 + 10 dígitos (móvil formato viejo): "521XXXXXXXXXX"
  if (digits.length === 13 && digits.startsWith("521")) {
    digits = digits.slice(3);
  }
  // 044 / 045 + 10 dígitos (larga distancia móvil, formato viejo)
  else if (
    digits.length === 13 &&
    (digits.startsWith("044") || digits.startsWith("045"))
  ) {
    digits = digits.slice(3);
  }
  // Lada país 52 + 10 dígitos: "52XXXXXXXXXX"
  else if (digits.length === 12 && digits.startsWith("52")) {
    digits = digits.slice(2);
  }
  // 1 inicial + 10 dígitos: "1XXXXXXXXXX"
  else if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Valida + normaliza, devolviendo el motivo cuando falla.
 * Esta es la función principal para formularios y rutas API.
 */
export function validateMxPhone(input: string): PhoneValidation {
  const raw = stripNonDigits(input);

  if (raw.length === 0) {
    return { ok: false, normalized: "", reason: "EMPTY" };
  }

  const normalized = normalizePhone(input);

  if (normalized.length < MX_PHONE_LENGTH) {
    return { ok: false, normalized: "", reason: "TOO_SHORT" };
  }

  if (normalized.length > MX_PHONE_LENGTH) {
    return { ok: false, normalized: "", reason: "TOO_LONG" };
  }

  // 10 dígitos exactos: validar que sea un patrón nacional plausible.
  if (normalized.startsWith("0")) {
    return { ok: false, normalized: "", reason: "LEADING_ZERO" };
  }

  if (!/^[1-9]\d{9}$/.test(normalized)) {
    return { ok: false, normalized: "", reason: "NOT_MEXICAN" };
  }

  return { ok: true, normalized };
}

/**
 * Atajo booleano: true si es un teléfono mexicano válido de 10 dígitos.
 */
export function isValidMxPhone(input: string): boolean {
  return validateMxPhone(input).ok;
}

/**
 * Enmascara un teléfono para mostrarlo/loguearlo sin exponerlo completo.
 * Ej.: "8331234567" -> "83****4567". Si no es válido, enmascara lo que haya.
 */
export function maskPhone(input: string): string {
  const digits = normalizePhone(input);
  if (digits.length < 4) return "*".repeat(digits.length);

  const visiblePrefix = digits.slice(0, 2);
  const visibleSuffix = digits.slice(-4);
  const hiddenCount = Math.max(0, digits.length - 6);

  return `${visiblePrefix}${"*".repeat(hiddenCount)}${visibleSuffix}`;
}

/* ------------------------------------------------------------------ *
 * Estructura preparada para el hash futuro (control interno anti-abuso).
 *
 * Aún NO se usa en producción; se deja la firma estable para que las
 * fases siguientes (historial / elegibilidad) la implementen con un
 * "pepper" del entorno, sin cambiar a quienes ya la consuman.
 * ------------------------------------------------------------------ */

/** Opciones para el hash de teléfono (control interno, no reversible). */
export type PhoneHashOptions = {
  /**
   * Sal/"pepper" del servidor para que el hash no sea adivinable por fuerza
   * bruta sobre un espacio de 10 dígitos. Se inyectará desde el entorno en
   * una fase posterior (nunca desde el cliente).
   */
  pepper?: string;
};

/**
 * Calcula un hash SHA-256 estable de un teléfono normalizado, pensado como
 * clave interna para detectar repeticiones SIN almacenar el número en claro.
 *
 * Usa Web Crypto (`crypto.subtle`), disponible en navegador y en los runtimes
 * de servidor de Next. Devuelve hex en minúsculas. Lanza si el teléfono no es
 * válido, para evitar hashear basura.
 *
 * Nota: la integración real (con pepper desde env) llega en una fase posterior;
 * aquí solo se deja la estructura funcional y estable.
 */
export async function hashPhone(
  input: string,
  options: PhoneHashOptions = {}
): Promise<string> {
  const { ok, normalized } = validateMxPhone(input);
  if (!ok) {
    throw new Error("hashPhone: teléfono inválido");
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("hashPhone: Web Crypto (crypto.subtle) no disponible");
  }

  const material = `${options.pepper ?? ""}:${normalized}`;
  const bytes = new TextEncoder().encode(material);
  const digest = await subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
