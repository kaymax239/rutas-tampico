type StatusPayload = {
  transId?: string;
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

  console.info("[TAECEL StatusTXN] config", {
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

  const payload = (await request.json().catch(() => ({}))) as StatusPayload;
  const transId = String(payload.transId || "").trim();

  if (!transId) {
    return Response.json(
      {
        ok: false,
        error: "TAECEL_STATUS_INVALID",
        message: "TransID es requerido.",
      },
      { status: 400 }
    );
  }

  const body = new URLSearchParams({
    key: config.key,
    nip: config.nip,
    transID: transId,
    ...(payload.extra || {}),
  });

  try {
    const endpoint = buildUrl(config.apiUrl, "StatusTXN");

    console.info("[TAECEL StatusTXN] request", {
      endpoint,
      method: "POST",
      transId,
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

    console.info("[TAECEL StatusTXN] response", {
      status: parsed.status,
      ok: parsed.ok,
      contentType: parsed.contentType,
    });

    return Response.json(parsed, { status: response.ok ? 200 : response.status });
  } catch (error) {
    console.error("[TAECEL StatusTXN] error", error);

    return Response.json(
      {
        ok: false,
        error: "TAECEL_STATUS_ERROR",
        message: error instanceof Error ? error.message : "Error desconocido.",
      },
      { status: 500 }
    );
  }
}
