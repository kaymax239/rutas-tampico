"use client";

import { useMemo, useState } from "react";
import {
  isValidMxPhone,
  maskPhone,
  validateMxPhone,
  type PhoneInvalidReason,
} from "@/lib/taecel/phone";
import {
  extraerProductos,
  extraerRespuestaTaecel,
  extraerStatusTaecel,
  extraerTransId,
  obtenerNombre,
  obtenerSku,
} from "@/lib/taecel/parse";

/**
 * Pantalla mínima de recargas para usuario final.
 *
 * AISLADA en /recargas: no toca el mapa, la ubicación, los roles ni Firebase.
 * Reutiliza lib/taecel (validación + parseo) y los endpoints proxy existentes.
 * El historial vive SOLO en memoria del navegador (se pierde al recargar).
 */

type Resultado = {
  estatus: string;
  folio: string;
  descripcion: string;
  fecha: string;
  ok: boolean;
};

type HistorialItem = {
  id: string;
  telefono: string; // enmascarado para mostrar
  producto: string;
  sku: string;
  monto: string;
  transId: string;
  folio: string;
  estatus: string;
  descripcion: string;
  fecha: string;
  ok: boolean;
};

const MENSAJE_TELEFONO: Record<PhoneInvalidReason, string> = {
  EMPTY: "Escribe un teléfono.",
  TOO_SHORT: "Faltan dígitos: deben ser 10.",
  TOO_LONG: "Sobran dígitos: deben ser 10.",
  LEADING_ZERO: "Un teléfono mexicano no empieza con 0.",
  NOT_MEXICAN: "No parece un teléfono mexicano válido.",
};

async function leerRespuesta(response: Response): Promise<unknown> {
  const text = await response.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text, parseError: "La respuesta no es JSON." };
  }
}

export default function RecargasPage() {
  const [productsData, setProductsData] = useState<unknown>(null);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [errorProductos, setErrorProductos] = useState("");

  const [sku, setSku] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  const [procesando, setProcesando] = useState(false);
  const [transId, setTransId] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [errorRecarga, setErrorRecarga] = useState("");

  const [historial, setHistorial] = useState<HistorialItem[]>([]);

  const productos = useMemo(
    () => extraerProductos(productsData),
    [productsData]
  );
  const respuestaProductos = useMemo(
    () => extraerRespuestaTaecel(productsData),
    [productsData]
  );

  const validacionTelefono = useMemo(() => validateMxPhone(phone), [phone]);
  const telefonoValido = isValidMxPhone(phone);
  const puedeRecargar = Boolean(sku) && telefonoValido && !procesando;

  const productoSeleccionado = useMemo(
    () => productos.find((p) => obtenerSku(p) === sku),
    [productos, sku]
  );

  const cargarProductos = async () => {
    setCargandoProductos(true);
    setErrorProductos("");

    try {
      const response = await fetch("/api/taecel/products", {
        method: "POST",
        cache: "no-store",
      });
      const data = await leerRespuesta(response);

      setProductsData(data);
      if (!response.ok) setErrorProductos("No se pudieron cargar los productos.");
    } catch (error) {
      setErrorProductos(
        error instanceof Error ? error.message : "Error desconocido."
      );
    } finally {
      setCargandoProductos(false);
    }
  };

  const recargar = async () => {
    if (!puedeRecargar) return;

    setProcesando(true);
    setResultado(null);
    setErrorRecarga("");

    const telefonoNormalizado = validacionTelefono.normalized;
    const nombreProducto = productoSeleccionado
      ? obtenerNombre(productoSeleccionado)
      : sku;

    let nuevoTransId = "";
    let datos: Resultado = {
      estatus: "Error",
      folio: "",
      descripcion: "",
      fecha: new Date().toLocaleString("es-MX"),
      ok: false,
    };

    try {
      // 1) RequestTXN: inicia la transacción.
      const reqResponse = await fetch("/api/taecel/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku,
          phone: telefonoNormalizado,
          amount: amount.trim() || undefined,
        }),
      });
      const reqData = await leerRespuesta(reqResponse);

      nuevoTransId = extraerTransId(reqData);
      setTransId(nuevoTransId);

      if (!nuevoTransId) {
        const r = extraerStatusTaecel(reqData);
        datos = {
          estatus: r.estatus || "Error",
          folio: r.folio,
          descripcion:
            r.descripcion || "RequestTXN no devolvió TransID.",
          fecha: r.fecha || new Date().toLocaleString("es-MX"),
          ok: false,
        };
      } else {
        // 2) StatusTXN: consulta el resultado de la transacción.
        const statusResponse = await fetch("/api/taecel/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transId: nuevoTransId }),
        });
        const statusData = await leerRespuesta(statusResponse);
        const r = extraerStatusTaecel(statusData);

        datos = {
          estatus: r.estatus || (r.success ? "Exitosa" : "Pendiente"),
          folio: r.folio,
          descripcion: r.descripcion,
          fecha: r.fecha || new Date().toLocaleString("es-MX"),
          ok: r.success === true || Boolean(r.folio),
        };
      }
    } catch (error) {
      datos = {
        estatus: "Error",
        folio: "",
        descripcion:
          error instanceof Error ? error.message : "Error desconocido.",
        fecha: new Date().toLocaleString("es-MX"),
        ok: false,
      };
      setErrorRecarga(datos.descripcion);
    }

    setResultado(datos);
    setHistorial((prev) => [
      {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        telefono: maskPhone(telefonoNormalizado),
        producto: nombreProducto,
        sku,
        monto: amount.trim(),
        transId: nuevoTransId,
        folio: datos.folio,
        estatus: datos.estatus,
        descripcion: datos.descripcion,
        fecha: datos.fecha,
        ok: datos.ok,
      },
      ...prev,
    ]);

    setProcesando(false);
  };

  const consultarStatusManual = async () => {
    if (!transId) return;

    setErrorRecarga("");
    try {
      const response = await fetch("/api/taecel/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transId }),
      });
      const data = await leerRespuesta(response);
      const r = extraerStatusTaecel(data);

      setResultado({
        estatus: r.estatus || (r.success ? "Exitosa" : "Pendiente"),
        folio: r.folio,
        descripcion: r.descripcion,
        fecha: r.fecha || new Date().toLocaleString("es-MX"),
        ok: r.success === true || Boolean(r.folio),
      });
    } catch (error) {
      setErrorRecarga(
        error instanceof Error ? error.message : "Error desconocido."
      );
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f8fafc",
        padding: 24,
      }}
    >
      <section style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 18 }}>
        <header>
          <h1 style={{ fontSize: 30, margin: "0 0 6px" }}>Recargas</h1>
          <p style={{ color: "#cbd5e1", margin: 0 }}>
            Pantalla de prueba aislada. No afecta el mapa ni el resto de la app.
            El historial es temporal (solo en este navegador).
          </p>
        </header>

        {/* Paso 1: productos */}
        <div style={tarjeta}>
          <button
            type="button"
            onClick={cargarProductos}
            disabled={cargandoProductos}
            style={boton("#2563eb", cargandoProductos)}
          >
            {cargandoProductos ? "Cargando..." : "1) Cargar productos"}
          </button>

          {respuestaProductos && (
            <p style={{ color: "#93c5fd", margin: "8px 0 0", fontSize: 13 }}>
              {productos.length} producto(s){" "}
              {respuestaProductos.message ? `· ${respuestaProductos.message}` : ""}
            </p>
          )}
          {errorProductos && <p style={textoError}>{errorProductos}</p>}

          {productos.length > 0 && (
            <label style={campo}>
              2) Producto / SKU
              <select
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                style={input}
              >
                <option value="">Selecciona un producto</option>
                {productos.map((producto, index) => {
                  const productSku = obtenerSku(producto);
                  return (
                    <option key={`${productSku}-${index}`} value={productSku}>
                      {productSku} — {obtenerNombre(producto)}
                    </option>
                  );
                })}
              </select>
            </label>
          )}
        </div>

        {/* Paso 2: teléfono + monto */}
        <div style={tarjeta}>
          <label style={campo}>
            3) Teléfono (10 dígitos)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej. 833 123 4567"
              inputMode="tel"
              style={{
                ...input,
                borderColor:
                  phone && !telefonoValido ? "#ef4444" : "#334155",
              }}
            />
          </label>
          {phone && !telefonoValido && validacionTelefono.reason && (
            <p style={textoError}>{MENSAJE_TELEFONO[validacionTelefono.reason]}</p>
          )}
          {telefonoValido && (
            <p style={{ color: "#86efac", margin: 0, fontSize: 13 }}>
              ✓ Válido: {validacionTelefono.normalized}
            </p>
          )}

          <label style={campo}>
            Monto (opcional)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Solo si el producto no tiene monto fijo"
              inputMode="numeric"
              style={input}
            />
          </label>

          <button
            type="button"
            onClick={recargar}
            disabled={!puedeRecargar}
            style={boton("#16a34a", !puedeRecargar)}
          >
            {procesando ? "Procesando..." : "4) Recargar"}
          </button>
        </div>

        {/* Resultado */}
        {(resultado || errorRecarga) && (
          <div
            style={{
              ...tarjeta,
              borderColor: resultado?.ok
                ? "rgba(34,197,94,.5)"
                : "rgba(239,68,68,.5)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Resultado</h2>
            {resultado && (
              <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
                <div>
                  <strong>Estatus:</strong>{" "}
                  <span style={{ color: resultado.ok ? "#86efac" : "#fca5a5" }}>
                    {resultado.estatus}
                  </span>
                </div>
                <div>
                  <strong>Folio:</strong> {resultado.folio || "—"}
                </div>
                <div>
                  <strong>TransID:</strong> {transId || "—"}
                </div>
                <div>
                  <strong>Detalle:</strong> {resultado.descripcion || "—"}
                </div>
                <div>
                  <strong>Fecha:</strong> {resultado.fecha}
                </div>
              </div>
            )}
            {errorRecarga && <p style={textoError}>{errorRecarga}</p>}

            {transId && (
              <button
                type="button"
                onClick={consultarStatusManual}
                style={{ ...boton("#f59e0b", false), marginTop: 10 }}
              >
                Volver a consultar StatusTXN
              </button>
            )}
          </div>
        )}

        {/* Historial temporal */}
        <div style={tarjeta}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>
            Historial (temporal · {historial.length})
          </h2>
          {historial.length === 0 ? (
            <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>
              Aún no hay recargas en esta sesión.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#93c5fd" }}>
                    {["TELÉFONO", "PRODUCTO", "MONTO", "TRANS ID", "FOLIO", "ESTATUS", "FECHA"].map(
                      (h) => (
                        <th key={h} style={{ padding: "6px 8px", borderBottom: "1px solid #334155" }}>
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={celda}>{item.telefono}</td>
                      <td style={celda}>{item.producto}</td>
                      <td style={celda}>{item.monto || "—"}</td>
                      <td style={celda}>{item.transId || "—"}</td>
                      <td style={celda}>{item.folio || "—"}</td>
                      <td
                        style={{
                          ...celda,
                          fontWeight: 800,
                          color: item.ok ? "#86efac" : "#fca5a5",
                        }}
                      >
                        {item.estatus || "—"}
                      </td>
                      <td style={celda}>{item.fecha}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const tarjeta: React.CSSProperties = {
  border: "1px solid rgba(148,163,184,.22)",
  borderRadius: 18,
  background: "rgba(15,23,42,.72)",
  padding: 18,
  display: "grid",
  gap: 10,
};

const campo: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 700,
};

const input: React.CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 12,
  background: "#020617",
  color: "white",
  padding: 12,
  fontWeight: 500,
};

const celda: React.CSSProperties = { padding: "6px 8px", color: "#e2e8f0" };

const textoError: React.CSSProperties = {
  color: "#fca5a5",
  margin: 0,
  fontSize: 13,
};

function boton(color: string, deshabilitado: boolean): React.CSSProperties {
  return {
    border: 0,
    borderRadius: 12,
    background: deshabilitado ? "#475569" : color,
    color: "white",
    cursor: deshabilitado ? "not-allowed" : "pointer",
    fontWeight: 900,
    padding: "12px 14px",
    opacity: deshabilitado ? 0.7 : 1,
  };
}
