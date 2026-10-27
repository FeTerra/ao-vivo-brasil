import tls from "node:tls";
import { states } from "./src/data.js";
import {
  deriveGovernorRunoff,
  electionPhase,
  normalizeTseResult,
} from "./src/elections.js";

if (tls.getCACertificates && tls.setDefaultCACertificates) {
  tls.setDefaultCACertificates([...tls.rootCertificates, ...tls.getCACertificates("system")]);
}

const tseRoot = "https://resultados.tse.jus.br/oficial/ele2026";
const firstRoundCodes = { federal: "6257", state: "6259" };
const fileCache = new Map();
const fileRequests = new Map();
const snapshotCache = new Map();
const snapshotRequests = new Map();
const referenceCacheMs = 6 * 60 * 60 * 1000;
const liveCacheMs = 45 * 1000;
const snapshotCacheMs = 45 * 1000;

function resultFileUrl(code, coverage, officeCode) {
  const place = coverage.toLowerCase();
  const formattedOffice = String(officeCode).padStart(4, "0");
  const formattedElection = String(code).padStart(6, "0");
  return `${tseRoot}/${code}/dados/${place}/${place}-c${formattedOffice}-e${formattedElection}-u.json`;
}

function validSecondRoundCode(value) {
  return /^\d{4,6}$/.test(String(value ?? "")) ? String(value) : null;
}

function secondRoundCodes() {
  return {
    federal: validSecondRoundCode(process.env.TSE_2026_SECOND_TURN_FEDERAL_CODE),
    state: validSecondRoundCode(process.env.TSE_2026_SECOND_TURN_STATE_CODE),
  };
}

async function fetchOfficialResult(url, { ttl = referenceCacheMs, force = false } = {}) {
  const cached = fileCache.get(url);
  if (!force && cached && Date.now() - cached.checkedAt < ttl) return cached;
  if (fileRequests.has(url)) return fileRequests.get(url);

  const request = (async () => {
    try {
      const headers = { Accept: "application/json" };
      if (cached?.etag) headers["If-None-Match"] = cached.etag;
      if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });

      if (response.status === 304 && cached) {
        const refreshed = { ...cached, checkedAt: Date.now(), stale: false, error: null };
        fileCache.set(url, refreshed);
        return refreshed;
      }
      if (!response.ok) throw new Error(`TSE respondeu ${response.status} para um arquivo oficial.`);

      const data = await response.json();
      if (!Array.isArray(data?.carg) || !data?.s || !data?.v) {
        throw new Error("O arquivo recebido não corresponde ao leiaute de resultados esperado pelo TSE.");
      }

      const record = {
        data,
        checkedAt: Date.now(),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        stale: false,
        error: null,
      };
      fileCache.set(url, record);
      return record;
    } catch (error) {
      if (cached) return { ...cached, stale: true, error: error.message };
      throw error;
    }
  })();

  fileRequests.set(url, request);
  try {
    return await request;
  } finally {
    fileRequests.delete(url);
  }
}

async function mapLimit(items, limit, callback) {
  const output = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        output[index] = await callback(items[index], index);
      } catch (error) {
        output[index] = { error: error.message };
      }
    }
  });
  await Promise.all(workers);
  return output;
}

function attachSource(summary, sourceUrl, record) {
  if (!summary) return null;
  return { ...summary, sourceUrl, stale: Boolean(record?.stale) };
}

async function loadFirstRoundPresident(coverage, force) {
  const url = resultFileUrl(firstRoundCodes.federal, coverage, "1");
  const record = await fetchOfficialResult(url, { force });
  if (String(record.data.t) !== "1") throw new Error("O arquivo do TSE não corresponde ao primeiro turno esperado.");
  return attachSource(normalizeTseResult(record.data, "1"), url, record);
}

async function loadFirstRoundGovernor(uf, force) {
  const url = resultFileUrl(firstRoundCodes.state, uf, "3");
  const record = await fetchOfficialResult(url, { force });
  if (String(record.data.t) !== "1") throw new Error(`O arquivo do TSE para ${uf} não corresponde ao primeiro turno.`);
  const runoff = deriveGovernorRunoff(record.data);
  return {
    ...runoff,
    sourceUrl: url,
    stale: Boolean(record.stale),
    publication: runoff.summary ? {
      date: runoff.summary.publishedDate,
      time: runoff.summary.publishedTime,
    } : null,
  };
}

async function loadFirstRoundReferences(coverage, force) {
  const selectedStates = coverage === "BR" ? states : coverage === "EX" ? [] : states.filter((state) => state.uf === coverage);
  const [presidentResult, governorResults] = await Promise.all([
    loadFirstRoundPresident(coverage === "BR" ? "br" : coverage === "EX" ? "zz" : coverage, force)
      .catch((error) => ({ error: error.message })),
    mapLimit(selectedStates, 6, async (state) => {
      try {
        return { ...state, governor: await loadFirstRoundGovernor(state.uf, force) };
      } catch (error) {
        return { ...state, governor: { status: "unavailable", hasRunoff: null, candidates: [], error: error.message } };
      }
    }),
  ]);

  const president = presidentResult;

  const unavailable = [president, ...governorResults.map((item) => item.governor)]
    .some((item) => item?.stale || item?.error);

  return {
    president,
    states: governorResults,
    status: unavailable ? "partial" : "official",
    sourceUrl: "https://resultados.tse.jus.br/oficial/app/index.html",
  };
}

async function loadSecondRoundSnapshot(coverage, governorReference, force) {
  const codes = secondRoundCodes();
  const configured = Boolean(codes.federal || codes.state);
  if (!configured || electionPhase(new Date()) === "before" || electionPhase(new Date()) === "voting") {
    return { configured, available: false, president: null, governor: null, states: [] };
  }

  if (coverage === "EX") {
    return {
      configured,
      available: false,
      president: null,
      governor: null,
      states: [],
      message: "O recorte específico do exterior depende do arquivo de abrangência correspondente publicado pelo TSE.",
    };
  }

  const selectedStates = coverage === "BR" ? states : states.filter((state) => state.uf === coverage);
  const presidentCoverage = coverage === "BR" ? "br" : coverage.toLowerCase();
  const presidentUrl = codes.federal ? resultFileUrl(codes.federal, presidentCoverage, "1") : null;
  const presidentResult = presidentUrl
    ? await fetchOfficialResult(presidentUrl, { ttl: liveCacheMs, force }).catch((error) => ({ error: error.message }))
    : null;

  const president = presidentResult?.data && String(presidentResult.data.t) === "2"
    ? attachSource(normalizeTseResult(presidentResult.data, "1"), presidentUrl, presidentResult)
    : null;
  const referenceByUf = new Map(governorReference.states.map((item) => [item.uf, item.governor]));

  const stateResults = await mapLimit(selectedStates, 6, async (state) => {
    let presidentState = null;
    let presidentError = null;
    if (codes.federal) {
      const statePresidentUrl = resultFileUrl(codes.federal, state.uf, "1");
      const record = await fetchOfficialResult(statePresidentUrl, { ttl: liveCacheMs, force }).catch((error) => ({ error: error.message }));
      presidentError = record.error ?? null;
      if (record.data && String(record.data.t) === "2") {
        presidentState = attachSource(normalizeTseResult(record.data, "1"), statePresidentUrl, record);
      }
    }

    let governor = null;
    let governorError = null;
    const firstRoundGovernor = referenceByUf.get(state.uf);
    if (codes.state && firstRoundGovernor?.hasRunoff === true) {
      const stateGovernorUrl = resultFileUrl(codes.state, state.uf, "3");
      const record = await fetchOfficialResult(stateGovernorUrl, { ttl: liveCacheMs, force }).catch((error) => ({ error: error.message }));
      governorError = record.error ?? null;
      if (record.data && String(record.data.t) === "2") {
        governor = attachSource(normalizeTseResult(record.data, "3"), stateGovernorUrl, record);
      }
    }
    return {
      uf: state.uf,
      name: state.name,
      president: presidentState,
      governor,
      hasGovernorRunoff: firstRoundGovernor?.hasRunoff ?? null,
      error: presidentError || governorError,
      stale: Boolean(presidentState?.stale || governor?.stale || presidentError || governorError),
    };
  });

  const governor = coverage === "BR" ? null : stateResults[0]?.governor ?? null;
  const governorRunoffs = stateResults.filter((state) => state.hasGovernorRunoff === true);
  const allGovernorRunoffsFinal = stateResults
    .filter((state) => state.hasGovernorRunoff === true)
    .every((state) => state.governor?.finalized === true);
  return {
    configured,
    available: Boolean(president || stateResults.some((item) => item.president || item.governor)),
    president,
    governor,
    states: stateResults,
    finalized: Boolean(president?.finalized && (coverage === "BR" ? allGovernorRunoffsFinal : !governorRunoffs.length || governor?.finalized)),
    checkedAt: new Date().toISOString(),
    error: presidentResult?.error ?? null,
    stale: Boolean(president?.stale || presidentResult?.error || stateResults.some((state) => state.stale)),
  };
}

async function buildSnapshot(coverage, force = false) {
  const references = await loadFirstRoundReferences(coverage, force);
  const live = await loadSecondRoundSnapshot(coverage, references, force);
  return {
    status: references.status,
    coverage,
    checkedAt: new Date().toISOString(),
    sourceUrl: references.sourceUrl,
    references,
    live,
    stale: references.status === "partial" || Boolean(live.stale || live.error),
    message: references.status === "partial"
      ? "Uma ou mais séries do TSE não responderam; valores mantêm a última resposta válida, quando disponível."
      : null,
  };
}

export async function getElectionSnapshot(coverage, force = false) {
  const cached = snapshotCache.get(coverage);
  if (!force && cached && Date.now() - cached.cachedAt < snapshotCacheMs) return cached.snapshot;
  if (snapshotRequests.has(coverage)) return snapshotRequests.get(coverage);

  const request = (async () => {
    try {
      const snapshot = await buildSnapshot(coverage, force);
      snapshotCache.set(coverage, { snapshot, cachedAt: Date.now() });
      return snapshot;
    } catch (error) {
      if (cached) {
        return {
          ...cached.snapshot,
          stale: true,
          status: "stale",
          message: "A fonte do TSE falhou. Exibindo a última resposta válida armazenada.",
          error: error.message,
        };
      }
      throw error;
    }
  })();

  snapshotRequests.set(coverage, request);
  try {
    return await request;
  } finally {
    snapshotRequests.delete(coverage);
  }
}
