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
  { carrier: "Sky", phone: "871235412635", sku: "SKY000", amount: "95" },
  { carrier: "Telmex", phone: "6589745213", sku: "TMX001", amount: "100" },
  { carrier: "Cfe", phone: "125478965412365478965230126654", sku: "CFE000", amount: "260" },
  { carrier: "Megacable", phone: "9854123547", sku: "MEG000", amount: "131" },
  { carrier: "Dish", phone: "27458965324125", sku: "DSH000", amount: "103" },
  { carrier: "Maxcom", phone: "3456987", sku: "MAX000", amount: "177" },
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

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function campoLocal(obj: unknown, claves: string[]): string {
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

// La respuesta de /api/taecel/* viene envuelta: { ok, status, contentType, data }
// donde data es la respuesta TAECEL: { success, error, message, data: {...} | [] }.
function desenvolverTaecel(wrapper: unknown) {
  let payload: unknown = wrapper;

  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    payload = (payload as Record<string, unknown>).data;
  }

  const payloadRec =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;

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

function extraerStatusTaecel(wrapper: unknown) {
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
    campoLocal(detalle, ["Nota", "nota", "Mensaje", "message", "Descripcion", "descripcion"]);

  if (success === false && errorCode) {
    descripcion = `(${errorCode}) ${descripcion}`.trim();
  }

  const fecha = campoLocal(detalle, ["Fecha", "fecha", "Date", "Timestamp"]);

  return { folio, estatus, descripcion, fecha, success };
}

type ResultadoMatriz = {
  referencia: string;
  carrier: string;
  codigo: string;
  monto: string;
  fechaHora: string;
  transId: string;
  folio: string;
  estatus: string;
  descripcion: string;
};

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
  const [resultados, setResultados] = useState<ResultadoMatriz[]>([]);
  const [corriendoMatriz, setCorriendoMatriz] = useState(false);
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0 });
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

  const ejecutarMatriz = async () => {
    if (corriendoMatriz) return;

    const total = PRUEBAS_TAECEL.length;
    const confirmar = window.confirm(
      `Se ejecutarán los ${total} casos de la matriz contra el sandbox de TAECEL (RequestTXN + StatusTXN cada uno). ¿Continuar?`
    );

    if (!confirmar) return;

    setCorriendoMatriz(true);
    setResultados([]);
    setProgreso({ hecho: 0, total });

    const filas: ResultadoMatriz[] = [];

    for (let i = 0; i < total; i += 1) {
      const prueba = PRUEBAS_TAECEL[i];
      let transId = "";
      let folio = "";
      let estatus = "";
      let descripcion = "";
      let fechaHora = "";

      try {
        let reqPayloadMsg = "";

        // RequestTXN: hasta 2 intentos por si hubo un error transitorio.
        for (let intento = 0; intento < 2 && !transId; intento += 1) {
          if (intento > 0) await esperar(1500);

          const reqResponse = await fetch("/api/taecel/request", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sku: prueba.sku,
              phone: prueba.phone,
              amount: prueba.amount,
            }),
          });
          const reqData = await leerRespuesta(reqResponse);

          registrarLog(
            "RequestTXN",
            { sku: prueba.sku, phone: prueba.phone, amount: prueba.amount, intento },
            reqData
          );

          transId = extraerTransId(reqData);
          reqPayloadMsg = desenvolverTaecel(reqData).message || reqPayloadMsg;
        }

        if (transId) {
          // StatusTXN: hasta 3 consultas, esperando a que llegue el Folio.
          for (let intento = 0; intento < 3; intento += 1) {
            if (intento > 0) await esperar(1500);

            const statusResponse = await fetch("/api/taecel/status", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ transId }),
            });
            const statusData = await leerRespuesta(statusResponse);

            registrarLog("StatusTXN", { transId, intento }, statusData);

            const datos = extraerStatusTaecel(statusData);
            folio = datos.folio;
            estatus = datos.estatus;
            descripcion = datos.descripcion;
            fechaHora = datos.fecha || new Date().toLocaleString("es-MX");

            // Listo si ya hay folio o si TAECEL marcó una falla definitiva.
            if (folio || datos.success === false) break;
          }
        } else {
          estatus = "Error";
          descripcion = reqPayloadMsg || "Sin TransID: RequestTXN no fue exitoso.";
          fechaHora = new Date().toLocaleString("es-MX");
        }
      } catch (error) {
        estatus = "Error";
        descripcion = error instanceof Error ? error.message : "Error desconocido.";
        fechaHora = new Date().toLocaleString("es-MX");
      }

      filas.push({
        referencia: prueba.phone,
        carrier: prueba.carrier,
        codigo: prueba.sku,
        monto: prueba.amount,
        fechaHora,
        transId,
        folio,
        estatus,
        descripcion,
      });

      setResultados([...filas]);
      setProgreso({ hecho: i + 1, total });

      if (i < total - 1) await esperar(800);
    }

    setCorriendoMatriz(false);
  };

  const exportarMatriz = () => {
    const encabezados = [
      "REFERENCIA",
      "CARRIER",
      "CODIGO",
      "MONTO",
      "FECHA/HORA",
      "TRANS ID",
      "FOLIO",
      "ESTATUS",
      "DESCRIPCION",
    ];
    const lineas = [encabezados.join("\t")];

    resultados.forEach((fila) => {
      lineas.push(
        [
          fila.referencia,
          fila.carrier,
          fila.codigo,
          fila.monto,
          fila.fechaHora,
          fila.transId,
          fila.folio,
          fila.estatus,
          fila.descripcion,
        ]
          .map((valor) => String(valor).replace(/[\t\n\r]/g, " "))
          .join("\t")
      );
    });

    const blob = new Blob([lineas.join("\n")], {
      type: "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `taecel-matriz-resultados-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.tsv`;
    link.click();
    URL.revokeObjectURL(url);
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
            gap: 12,
            border: "1px solid rgba(34,197,94,.35)",
            borderRadius: 22,
            background: "rgba(8,47,73,.36)",
            padding: 18,
          }}
        >
          <h2 style={{ margin: 0 }}>Matriz de certificación ({PRUEBAS_TAECEL.length} casos)</h2>
          <p style={{ color: "#cbd5e1", margin: 0, fontSize: 14 }}>
            Corre los {PRUEBAS_TAECEL.length} casos en orden (RequestTXN + StatusTXN) y exporta los
            resultados con TransID/Folio para entregar a TAECEL.
          </p>

          <button
            type="button"
            onClick={ejecutarMatriz}
            disabled={corriendoMatriz}
            style={{
              border: 0,
              borderRadius: 14,
              background: corriendoMatriz ? "#64748b" : "#22c55e",
              color: "white",
              cursor: corriendoMatriz ? "not-allowed" : "pointer",
              fontWeight: 900,
              padding: "14px 16px",
              fontSize: 16,
            }}
          >
            {corriendoMatriz
              ? `Ejecutando ${progreso.hecho}/${progreso.total}...`
              : `▶ Ejecutar matriz completa (${PRUEBAS_TAECEL.length})`}
          </button>

          {progreso.total > 0 && (
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "#0b1220",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(progreso.hecho / progreso.total) * 100}%`,
                  background: "#22c55e",
                  transition: "width .25s",
                }}
              />
            </div>
          )}

          {resultados.length > 0 && (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#93c5fd" }}>
                      {["REFERENCIA", "CARRIER", "CODIGO", "MONTO", "TRANS ID", "FOLIO", "ESTATUS", "DESCRIPCION"].map(
                        (h) => (
                          <th key={h} style={{ padding: "6px 8px", borderBottom: "1px solid #334155" }}>
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((fila, index) => {
                      const exito = /exito|success|true|correct/i.test(fila.estatus);

                      return (
                        <tr key={`${fila.codigo}-${index}`} style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "6px 8px" }}>{fila.referencia}</td>
                          <td style={{ padding: "6px 8px" }}>{fila.carrier}</td>
                          <td style={{ padding: "6px 8px" }}>{fila.codigo}</td>
                          <td style={{ padding: "6px 8px" }}>{fila.monto}</td>
                          <td style={{ padding: "6px 8px" }}>{fila.transId || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{fila.folio || "—"}</td>
                          <td
                            style={{
                              padding: "6px 8px",
                              fontWeight: 800,
                              color: exito ? "#86efac" : "#fca5a5",
                            }}
                          >
                            {fila.estatus || "—"}
                          </td>
                          <td style={{ padding: "6px 8px", color: "#cbd5e1" }}>{fila.descripcion || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={exportarMatriz}
                style={{
                  border: 0,
                  borderRadius: 14,
                  background: "#38bdf8",
                  color: "#082f49",
                  cursor: "pointer",
                  fontWeight: 900,
                  padding: "12px 14px",
                }}
              >
                Exportar resultados (Excel/TSV)
              </button>
            </>
          )}
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
