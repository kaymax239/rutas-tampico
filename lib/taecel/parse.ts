/**
 * Helpers de parseo de respuestas TAECEL.
 *
 * Lógica extraída tal cual desde `app/taecel-test/page.tsx` (ya probada en
 * certificación) para centralizarla y reutilizarla en futuras pantallas sin
 * duplicarla. `taecel-test/page.tsx` NO se modifica en esta fase.
 *
 * Módulo puro: sin red, sin Firebase, sin React.
 */

import type {
  TaecelProduct,
  TaecelResponse,
  TaecelStatus,
  TaecelUnwrapped,
} from "./types";

/**
 * Extrae el arreglo de productos de una respuesta TAECEL con forma variable
 * (`data` / `products` / `Productos` / `productos` / `response`, o anidado).
 */
export function extraerProductos(data: unknown): TaecelProduct[] {
  if (Array.isArray(data)) return data as TaecelProduct[];

  if (!data || typeof data !== "object") return [];

  const root = data as Record<string, unknown>;
  const candidates = [
    root.data,
    root.products,
    root.Productos,
    root.productos,
    root.response,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as TaecelProduct[];
  }

  if (root.data && typeof root.data === "object") {
    return extraerProductos(root.data);
  }

  return [];
}

/**
 * Localiza el objeto de respuesta TAECEL (`{ success, message, ... }`),
 * descendiendo por `data` si viene anidado.
 */
export function extraerRespuestaTaecel(data: unknown): TaecelResponse | null {
  if (!data || typeof data !== "object") return null;

  const root = data as Record<string, unknown>;

  if ("success" in root || "message" in root) return root as TaecelResponse;

  if (root.data && typeof root.data === "object") {
    return extraerRespuestaTaecel(root.data);
  }

  return null;
}

/** Obtiene el SKU de un producto, tolerando múltiples nombres de campo. */
export function obtenerSku(producto: TaecelProduct): string {
  const value =
    producto.SKU ||
    producto.sku ||
    producto.Codigo ||
    producto.codigo ||
    producto.ProductCode ||
    producto.productCode ||
    producto.id;

  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

/** Obtiene el nombre legible de un producto; cae al SKU si no hay nombre. */
export function obtenerNombre(producto: TaecelProduct): string {
  const value =
    producto.Nombre ||
    producto.nombre ||
    producto.Producto ||
    producto.producto ||
    producto.Name ||
    producto.name ||
    obtenerSku(producto);

  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "Producto TAECEL";
}

/**
 * Busca el TransID en cualquier nivel de la respuesta (recorrido en
 * profundidad), tolerando TransID / transID / transId / TransactionID.
 */
export function extraerTransId(data: unknown): string {
  if (!data || typeof data !== "object") return "";

  const stack: unknown[] = [data];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || typeof current !== "object") continue;

    const record = current as Record<string, unknown>;
    const value =
      record.TransID ||
      record.transID ||
      record.transId ||
      record.TransactionID ||
      record.transactionId;

    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }

    Object.values(record).forEach((child) => {
      if (child && typeof child === "object") stack.push(child);
    });
  }

  return "";
}

/**
 * Lee un campo por nombre, sin distinguir mayúsculas/minúsculas, de un objeto
 * plano. Devuelve "" si no existe o no es string/number.
 */
export function campoLocal(obj: unknown, claves: string[]): string {
  if (!obj || typeof obj !== "object") return "";

  const objetivos = claves.map((c) => c.toLowerCase());
  const record = obj as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (objetivos.includes(key.toLowerCase())) {
      const value = record[key];

      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }
    }
  }

  return "";
}

/**
 * Quita el envoltorio del proxy `{ ok, status, contentType, data }` y deja la
 * respuesta TAECEL (`{ success, message, data }`), separando además el detalle
 * interno (`payload.data` cuando es objeto).
 */
export function desenvolverTaecel(wrapper: unknown): TaecelUnwrapped {
  let payload: unknown = wrapper;

  if (
    payload &&
    typeof payload === "object" &&
    "data" in (payload as Record<string, unknown>)
  ) {
    payload = (payload as Record<string, unknown>).data;
  }

  const payloadRec =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;

  let detalle: unknown = payload;

  if (
    payloadRec &&
    payloadRec.data &&
    typeof payloadRec.data === "object" &&
    !Array.isArray(payloadRec.data)
  ) {
    detalle = payloadRec.data;
  }

  const successRaw = payloadRec ? payloadRec.success : undefined;
  const messageRaw = payloadRec ? payloadRec.message : undefined;

  return {
    payload,
    detalle,
    success: typeof successRaw === "boolean" ? successRaw : undefined,
    message: typeof messageRaw === "string" ? messageRaw : "",
  };
}

/**
 * Normaliza la respuesta de StatusTXN a `{ folio, estatus, descripcion,
 * fecha, success }`, derivando el estatus de `success` cuando TAECEL no
 * manda un texto explícito.
 */
export function extraerStatusTaecel(wrapper: unknown): TaecelStatus {
  const { payload, detalle, success, message } = desenvolverTaecel(wrapper);
  const folio = campoLocal(detalle, ["Folio", "folio"]);
  const statusTxt = campoLocal(detalle, ["Status", "Estatus", "estatus"]);
  const errorCode = campoLocal(payload, ["error", "Error"]);

  let estatus = statusTxt;

  if (!estatus) {
    if (success === true) estatus = "Exitosa";
    else if (success === false) estatus = "Error";
  }

  let descripcion =
    message ||
    campoLocal(detalle, [
      "Nota",
      "nota",
      "Mensaje",
      "message",
      "Descripcion",
      "descripcion",
    ]);

  if (success === false && errorCode) {
    descripcion = `(${errorCode}) ${descripcion}`.trim();
  }

  const fecha = campoLocal(detalle, ["Fecha", "fecha", "Date", "Timestamp"]);

  return { folio, estatus, descripcion, fecha, success };
}
