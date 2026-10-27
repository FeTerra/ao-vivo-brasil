import { getElectionSnapshot } from "../../server.mjs";
import { normalizeElectionCoverage } from "../elections.js";

const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

const electionApi = {
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
        detail: error instanceof Error ? error.message : "Erro inesperado ao consultar o TSE.",
        checkedAt: new Date().toISOString(),
      }, { status: 502, headers: responseHeaders });
    }
  },
};

export default electionApi;
