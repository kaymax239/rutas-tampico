type TaecelParsedResponse = {
  ok: boolean;
  status: number;
  contentType: string;
  data: unknown;
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

async function parseResponse(response: Response): Promise<TaecelParsedResponse> {
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

export async function POST() {
  const config = getConfig();

  console.info("[TAECEL products] config", {
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

  const body = new URLSearchParams({
    key: config.key,
    nip: config.nip,
  });

  try {
    const endpoint = buildUrl(config.apiUrl, "Products");

    console.info("[TAECEL products] request", {
      endpoint,
      method: "POST",
      includesCredentials: true,
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

    console.info("[TAECEL products] response", {
      status: parsed.status,
      ok: parsed.ok,
      contentType: parsed.contentType,
    });

    return Response.json(parsed, { status: response.ok ? 200 : response.status });
  } catch (error) {
    console.error("[TAECEL products] error", error);

    return Response.json(
      {
        ok: false,
        error: "TAECEL_PRODUCTS_ERROR",
        message: error instanceof Error ? error.message : "Error desconocido.",
      },
      { status: 500 }
    );
  }
}
