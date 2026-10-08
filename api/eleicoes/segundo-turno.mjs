import { getElectionSnapshot } from "../../server.mjs";
import { normalizeElectionCoverage } from "../../src/elections.js";

const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return new Response(null, {
        status: 405,
        headers: { ...responseHeaders, Allow: "GET" },
      });
    }

    const requestUrl = new URL(request.url);
    const coverage = normalizeElectionCoverage(requestUrl.searchParams.get("abrangencia") || "BR");
    if (!coverage) {
      return Response.json(
        { message: "Abrangência inválida. Informe Brasil, Exterior ou uma UF." },
        { status: 400, headers: responseHeaders },
      );
    }

    try {
      const snapshot = await getElectionSnapshot(coverage, requestUrl.searchParams.get("atualizar") === "1");
      return Response.json(snapshot, { headers: responseHeaders });
    } catch (error) {
      return Response.json({
        status: "error",
        message: "Não foi possível consultar os arquivos oficiais do TSE. Tente novamente.",
        detail: error.message,
        checkedAt: new Date().toISOString(),
      }, { status: 502, headers: responseHeaders });
    }
  },
};
