"use client";

import { useMemo, useState } from "react";

type ApiState = {
  loading: boolean;
  error: string;
  data: unknown;
};

type CertLog = {
  at: string;
  action: string;
  request: unknown;
  response: unknown;
};

const PRUEBAS_TAECEL = [
  { carrier: "Telcel", phone: "5555555505", sku: "TEL010", amount: "10" },
  { carrier: "Telcel", phone: "5555555510", sku: "TEL050", amount: "50" },
  { carrier: "Telcel", phone: "5555555515", sku: "TEL100", amount: "100" },
  { carrier: "Telcel", phone: "5555555520", sku: "TEL150", amount: "150" },
  { carrier: "Telcel", phone: "5555555525", sku: "TEL200", amount: "200" },
  { carrier: "Movistar", phone: "5555555530", sku: "MOV010", amount: "10" },
  { carrier: "Movistar", phone: "5555555540", sku: "MOV050", amount: "50" },
  { carrier: "Movistar", phone: "5555555560", sku: "MOV100", amount: "100" },
  { carrier: "Movistar", phone: "5555555565", sku: "MOV120", amount: "120" },
  { carrier: "Movistar", phone: "5555555200", sku: "MOV150", amount: "150" },
  { carrier: "Otros", phone: "", sku: "SKY000", amount: "" },
  { carrier: "Otros", phone: "", sku: "TMX001", amount: "" },
  { carrier: "Otros", phone: "", sku: "CFE000", amount: "" },
  { carrier: "Otros", phone: "", sku: "MEG000", amount: "" },
  { carrier: "Otros", phone: "", sku: "DSH000", amount: "" },
  { carrier: "Otros", phone: "", sku: "MAX000", amount: "" },
];

function extraerProductos(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;

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
    if (Array.isArray(candidate)) return candidate as Array<Record<string, unknown>>;
  }

  if (root.data && typeof root.data === "object") {
    return extraerProductos(root.data);
  }

  return [];
}

function extraerRespuestaTaecel(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;

  const root = data as Record<string, unknown>;

  if ("success" in root || "message" in root) return root;

  if (root.data && typeof root.data === "object") {
    return extraerRespuestaTaecel(root.data);
  }

  return null;
}

function obtenerSku(producto: Record<string, unknown>) {
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

function obtenerNombre(producto: Record<string, unknown>) {
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

function extraerTransId(data: unknown) {
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

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        overflow: "auto",
        borderRadius: 14,
        background: "#020617",
        color: "#dbeafe",
        fontSize: 12,
        lineHeight: 1.5,
        margin: 0,
        padding: 14,
        whiteSpace: "pre-wrap",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

async function leerRespuesta(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      raw: text,
      parseError: "La respuesta no es JSON.",
    };
  }
}

export default function TaecelTestPage() {
  const [productsState, setProductsState] = useState<ApiState>({
    loading: false,
    error: "",
    data: null,
  });
  const [requestState, setRequestState] = useState<ApiState>({
    loading: false,
    error: "",
    data: null,
  });
  const [statusState, setStatusState] = useState<ApiState>({
    loading: false,
    error: "",
    data: null,
  });
  const [sku, setSku] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [transId, setTransId] = useState("");
  const [certLogs, setCertLogs] = useState<CertLog[]>([]);
  const productos = useMemo(
    () => extraerProductos(productsState.data),
    [productsState.data]
  );
  const respuestaProductos = useMemo(
    () => extraerRespuestaTaecel(productsState.data),
    [productsState.data]
  );
  const primerSku = productos[0] ? obtenerSku(productos[0]) : "";

  const registrarLog = (action: string, request: unknown, response: unknown) => {
    setCertLogs((logs) => [
      ...logs,
      {
        at: new Date().toISOString(),
        action,
        request,
        response,
      },
    ]);
  };

  const usarPrueba = (prueba: (typeof PRUEBAS_TAECEL)[number]) => {
    setSku(prueba.sku);
    setPhone(prueba.phone);
    setAmount(prueba.amount);
  };

  const exportarLogs = () => {
    const contenido = certLogs
      .map((log) => JSON.stringify(log, null, 2))
      .join("\n\n---\n\n");
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `taecel-certificacion-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const cargarProductos = async () => {
    setProductsState({ loading: true, error: "", data: null });

    try {
      const response = await fetch("/api/taecel/products", {
        method: "POST",
        cache: "no-store",
      });
      const data = await leerRespuesta(response);

      registrarLog("getProducts", { endpoint: "/api/taecel/products" }, data);
      setProductsState({
        loading: false,
        error: response.ok ? "" : "No se pudieron cargar productos.",
        data,
      });
    } catch (error) {
      setProductsState({
        loading: false,
        error: error instanceof Error ? error.message : "Error desconocido.",
        data: null,
      });
    }
  };

  const enviarRequest = async () => {
    setRequestState({ loading: true, error: "", data: null });

    try {
      const response = await fetch("/api/taecel/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku, phone, amount }),
      });
      const data = await response.json();
      const nextTransId = extraerTransId(data);

      if (nextTransId) setTransId(nextTransId);

      registrarLog(
        "RequestTXN",
        { endpoint: "/api/taecel/request", sku, phone, amount },
        data
      );
      setRequestState({
        loading: false,
        error: response.ok ? "" : "RequestTXN no fue exitoso.",
        data,
      });
    } catch (error) {
      setRequestState({
        loading: false,
        error: error instanceof Error ? error.message : "Error desconocido.",
        data: null,
      });
    }
  };

  const consultarStatus = async () => {
    setStatusState({ loading: true, error: "", data: null });

    try {
      const response = await fetch("/api/taecel/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transId }),
      });
      const data = await response.json();

      registrarLog(
        "StatusTXN",
        { endpoint: "/api/taecel/status", transId },
        data
      );
      setStatusState({
        loading: false,
        error: response.ok ? "" : "StatusTXN no fue exitoso.",
        data,
      });
    } catch (error) {
      setStatusState({
        loading: false,
        error: error instanceof Error ? error.message : "Error desconocido.",
        data: null,
      });
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
      <section
        style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, margin: "0 0 8px" }}>
            TAECEL Test
          </h1>
          <p style={{ color: "#cbd5e1", margin: 0 }}>
            Prueba segura de productos, RequestTXN y StatusTXN sin exponer KEY/NIP.
          </p>
        </div>

        <div
          style={{
            border: "1px solid rgba(148,163,184,.22)",
            borderRadius: 22,
            background: "rgba(15,23,42,.72)",
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Tabla de pruebas</h2>
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            }}
          >
            {PRUEBAS_TAECEL.map((prueba) => (
              <button
                key={`${prueba.carrier}-${prueba.sku}-${prueba.phone || "sin-ref"}`}
                type="button"
                onClick={() => usarPrueba(prueba)}
                style={{
                  border: "1px solid #334155",
                  borderRadius: 14,
                  background: "#020617",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  padding: 12,
                  textAlign: "left",
                }}
              >
                <strong>{prueba.carrier}</strong>
                <br />
                SKU: {prueba.sku}
                <br />
                {prueba.phone ? `Tel: ${prueba.phone}` : "Referencia manual"}
                {prueba.amount && (
                  <>
                    <br />${prueba.amount}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            border: "1px solid rgba(148,163,184,.22)",
            borderRadius: 22,
            background: "rgba(15,23,42,.72)",
            padding: 18,
          }}
        >
          <button
            type="button"
            onClick={cargarProductos}
            disabled={productsState.loading}
            style={{
              border: 0,
              borderRadius: 14,
              background: "#2563eb",
              color: "white",
              cursor: productsState.loading ? "not-allowed" : "pointer",
              fontWeight: 900,
              padding: "12px 14px",
            }}
          >
            {productsState.loading ? "Cargando..." : "Cargar productos"}
          </button>

          {productsState.data !== null && (
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                border: "1px solid rgba(56,189,248,.22)",
                borderRadius: 16,
                background: "rgba(8,47,73,.36)",
                padding: 12,
              }}
            >
              <div>
                <small style={{ color: "#93c5fd", fontWeight: 900 }}>
                  success
                </small>
                <div style={{ fontWeight: 900 }}>
                  {String(respuestaProductos?.success ?? "N/D")}
                </div>
              </div>
              <div>
                <small style={{ color: "#93c5fd", fontWeight: 900 }}>
                  message
                </small>
                <div style={{ fontWeight: 900 }}>
                  {String(respuestaProductos?.message ?? "Sin mensaje")}
                </div>
              </div>
              <div>
                <small style={{ color: "#93c5fd", fontWeight: 900 }}>
                  productos
                </small>
                <div style={{ fontWeight: 900 }}>{productos.length}</div>
              </div>
              <div>
                <small style={{ color: "#93c5fd", fontWeight: 900 }}>
                  primer SKU
                </small>
                <div style={{ fontWeight: 900 }}>{primerSku || "N/D"}</div>
              </div>
            </div>
          )}

          {productos.length > 0 && (
            <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
              Seleccionar SKU
              <select
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                style={{
                  border: "1px solid #334155",
                  borderRadius: 12,
                  background: "#020617",
                  color: "white",
                  padding: 12,
                }}
              >
                <option value="">Selecciona un producto</option>
                {productos.map((producto, index) => {
                  const productSku = obtenerSku(producto);

                  return (
                    <option key={`${productSku}-${index}`} value={productSku}>
                      {productSku} - {obtenerNombre(producto)}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Teléfono
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="10 dígitos"
              inputMode="tel"
              style={{
                border: "1px solid #334155",
                borderRadius: 12,
                background: "#020617",
                color: "white",
                padding: 12,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Monto
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Opcional para productos con monto fijo"
              inputMode="numeric"
              style={{
                border: "1px solid #334155",
                borderRadius: 12,
                background: "#020617",
                color: "white",
                padding: 12,
              }}
            />
          </label>

          <button
            type="button"
            onClick={enviarRequest}
            disabled={requestState.loading || !sku || !phone}
            style={{
              border: 0,
              borderRadius: 14,
              background: "#16a34a",
              color: "white",
              cursor:
                requestState.loading || !sku || !phone ? "not-allowed" : "pointer",
              fontWeight: 900,
              padding: "12px 14px",
              opacity: requestState.loading || !sku || !phone ? 0.62 : 1,
            }}
          >
            {requestState.loading ? "Enviando..." : "Enviar RequestTXN"}
          </button>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            TransID
            <input
              value={transId}
              onChange={(event) => setTransId(event.target.value)}
              placeholder="TransID"
              style={{
                border: "1px solid #334155",
                borderRadius: 12,
                background: "#020617",
                color: "white",
                padding: 12,
              }}
            />
          </label>

          <button
            type="button"
            onClick={consultarStatus}
            disabled={statusState.loading || !transId}
            style={{
              border: 0,
              borderRadius: 14,
              background: "#f59e0b",
              color: "#111827",
              cursor: statusState.loading || !transId ? "not-allowed" : "pointer",
              fontWeight: 900,
              padding: "12px 14px",
              opacity: statusState.loading || !transId ? 0.62 : 1,
            }}
          >
            {statusState.loading ? "Consultando..." : "Consultar StatusTXN"}
          </button>
        </div>

        <button
          type="button"
          onClick={exportarLogs}
          disabled={certLogs.length === 0}
          style={{
            border: 0,
            borderRadius: 14,
            background: "#38bdf8",
            color: "#082f49",
            cursor: certLogs.length === 0 ? "not-allowed" : "pointer",
            fontWeight: 900,
            padding: "12px 14px",
            opacity: certLogs.length === 0 ? 0.62 : 1,
          }}
        >
          Exportar logs de certificación
        </button>

        {productsState.error && <p style={{ color: "#fca5a5" }}>{productsState.error}</p>}
        {requestState.error && <p style={{ color: "#fca5a5" }}>{requestState.error}</p>}
        {statusState.error && <p style={{ color: "#fca5a5" }}>{statusState.error}</p>}

        <section style={{ display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Respuesta productos</h2>
          <JsonBlock value={productsState.data} />
          <h2 style={{ margin: 0 }}>Respuesta RequestTXN</h2>
          <JsonBlock value={requestState.data} />
          <h2 style={{ margin: 0 }}>Respuesta StatusTXN</h2>
          <JsonBlock value={statusState.data} />
        </section>
      </section>
    </main>
  );
}
