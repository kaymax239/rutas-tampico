type RequestPayload = {
  sku?: string;
  phone?: string;
  extra?: Record<string, string>;
};

function getConfig() {
  return {
    apiUrl: process.env.TAECEL_API_URL || "",
    key: process.env.TAECEL_KEY || "",
    nip: process.env.TAECEL_NIP || "",
  };
}

function buildUrl(apiUrl: string, endpoint: string) {
  return new URL(endpoint, apiUrl).toString();
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let data: unknown = text;

  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    data,
  };
}

export async function POST(request: Request) {
  const config = getConfig();

  console.info("[TAECEL RequestTXN] config", {
    hasApiUrl: Boolean(config.apiUrl),
    hasKey: Boolean(config.key),
    hasNip: Boolean(config.nip),
  });

  if (!config.apiUrl || !config.key || !config.nip) {
    return Response.json(
      {
        ok: false,
        error: "TAECEL_CONFIG_MISSING",
        message: "Faltan TAECEL_API_URL, TAECEL_KEY o TAECEL_NIP.",
      },
      { status: 500 }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as RequestPayload;
  const sku = String(payload.sku || "").trim();
  const phone = String(payload.phone || "").trim();

  if (!sku || !phone) {
    return Response.json(
      {
        ok: false,
        error: "TAECEL_REQUEST_INVALID",
        message: "SKU y teléfono son requeridos.",
      },
      { status: 400 }
    );
  }

  const body = new URLSearchParams({
    key: config.key,
    nip: config.nip,
    sku,
    producto: sku,
    telefono: phone,
    referencia: phone,
    ...(payload.extra || {}),
  });

  try {
    const endpoint = buildUrl(config.apiUrl, "RequestTXN");

    console.info("[TAECEL RequestTXN] request", {
      endpoint,
      method: "POST",
      sku,
      phoneLength: phone.length,
      includesCredentials: true,
      extraKeys: Object.keys(payload.extra || {}),
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });
    const parsed = await parseResponse(response);

    console.info("[TAECEL RequestTXN] response", {
      status: parsed.status,
      ok: parsed.ok,
      contentType: parsed.contentType,
    });

    return Response.json(parsed, { status: response.ok ? 200 : response.status });
  } catch (error) {
    console.error("[TAECEL RequestTXN] error", error);

    return Response.json(
      {
        ok: false,
        error: "TAECEL_REQUEST_ERROR",
        message: error instanceof Error ? error.message : "Error desconocido.",
      },
      { status: 500 }
    );
  }
}
