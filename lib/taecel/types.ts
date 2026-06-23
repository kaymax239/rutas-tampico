/**
 * Tipos centralizados del flujo de recargas TAECEL.
 *
 * Módulo puro de tipos (sin lógica, sin imports). Lo consumen las rutas API,
 * los helpers de `parse.ts` y, más adelante, las pantallas de usuario y el
 * historial en Firestore.
 */

/* ------------------------------------------------------------------ *
 * Envoltorio de las rutas /api/taecel/*
 * ------------------------------------------------------------------ */

/**
 * Respuesta uniforme que devuelven los endpoints proxy (`products`,
 * `request`, `status`): siempre `{ ok, status, contentType, data }`,
 * donde `data` es la respuesta cruda de TAECEL (JSON o texto).
 */
export type TaecelEnvelope<T = unknown> = {
  ok: boolean;
  status: number;
  contentType: string;
  data: T;
};

/* ------------------------------------------------------------------ *
 * Respuestas crudas de TAECEL (forma variable)
 * ------------------------------------------------------------------ */

/**
 * Un producto TAECEL. Los nombres de campo varían según el endpoint
 * (SKU/sku/Codigo, Nombre/nombre/Producto, etc.), por eso se modela como
 * registro abierto y se accede vía los helpers de `parse.ts`.
 */
export type TaecelProduct = Record<string, unknown>;

/**
 * Cuerpo típico de una respuesta TAECEL: `{ success, error, message, data }`.
 * `data` puede ser un objeto (detalle de transacción) o un arreglo (productos).
 */
export type TaecelResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  data?: unknown;
};

/** Resultado de "desenvolver" el envoltorio + respuesta TAECEL. */
export type TaecelUnwrapped = {
  /** Respuesta TAECEL ya sin el envoltorio del proxy. */
  payload: unknown;
  /** Detalle interno (normalmente `payload.data` cuando es objeto). */
  detalle: unknown;
  /** Bandera `success` de TAECEL si vino como booleano. */
  success?: boolean;
  /** Mensaje de TAECEL si vino como string. */
  message: string;
};

/** Estado normalizado de una transacción (salida de StatusTXN). */
export type TaecelStatus = {
  folio: string;
  estatus: string;
  descripcion: string;
  fecha: string;
  success?: boolean;
};

/* ------------------------------------------------------------------ *
 * Payloads de entrada a las rutas API
 * ------------------------------------------------------------------ */

/** Cuerpo que el cliente envía a `/api/taecel/request` (RequestTXN). */
export type RequestTxnPayload = {
  sku: string;
  phone: string;
  amount?: string;
  extra?: Record<string, string>;
};

/** Cuerpo que el cliente envía a `/api/taecel/status` (StatusTXN). */
export type StatusTxnPayload = {
  transId: string;
  extra?: Record<string, string>;
};

/* ------------------------------------------------------------------ *
 * Historial de recargas (modelo de dominio)
 *
 * Estructura pensada para persistir en una fase posterior. Aún no se
 * escribe en Firestore; aquí solo se define la forma.
 * ------------------------------------------------------------------ */

/** Estado interno de un intento de recarga. */
export type RechargeStatus = "pending" | "success" | "error";

/**
 * Un intento de recarga (futuro: colección `recharge_attempts`).
 * `phone` se guarda normalizado a 10 dígitos; `phoneHash` es la clave
 * interna no reversible para control anti-abuso.
 */
export type RechargeAttempt = {
  id?: string;
  phone: string;
  phoneHash?: string;
  carrier?: string;
  sku: string;
  amount?: string;
  transId?: string;
  folio?: string;
  status: RechargeStatus;
  /** Texto de estatus crudo devuelto por TAECEL. */
  estatus?: string;
  descripcion?: string;
  error?: string;
  /** Epoch en milisegundos. */
  createdAt?: number;
};
