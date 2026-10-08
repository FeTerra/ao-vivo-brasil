import { states } from "./data.js";

export const ELECTIONS_BASE_HASH = "eleicoes/segundo-turno";
export const RUNOFF_DATE = "2026-10-25";
export const RUNOFF_START_HOUR_BRT = 8;
export const VOTING_END_HOUR_BRT = 17;
export const TSE_RESULTS_URL = "https://resultados.tse.jus.br/oficial/app/index.html";
export const TSE_TECHNICAL_INFO_URL = "https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados";

const validUfs = new Set(states.map(({ uf }) => uf));

export function normalizeElectionCoverage(value) {
  if (value === "BR" || value === "EX") return value;
  const uf = String(value ?? "").trim().toUpperCase();
  return validUfs.has(uf) ? uf : null;
}

export function electionHashForCoverage(coverage = "BR") {
  const normalized = normalizeElectionCoverage(coverage) ?? "BR";
  if (normalized === "BR") return `#${ELECTIONS_BASE_HASH}`;
  if (normalized === "EX") return `#${ELECTIONS_BASE_HASH}/exterior`;
  return `#${ELECTIONS_BASE_HASH}/${normalized}`;
}

export function electionCoverageFromHash(hash = "") {
  const parts = String(hash).replace(/^#/, "").split("/");
  if (parts[0] !== "eleicoes" || parts[1] !== "segundo-turno") return null;
  if (parts.length < 3 || !parts[2]) return "BR";
  if (parts[2].toLocaleLowerCase("pt-BR") === "exterior") return "EX";
  return normalizeElectionCoverage(parts[2]);
}

export function parseTseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(?:\.\d{3})+$/.test(text) ? text.replace(/\./g, "") : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function formatElectionInteger(value) {
  const number = typeof value === "number" ? value : parseTseNumber(value);
  if (number === null || !Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(number);
}

export function formatElectionPercent(value) {
  const number = typeof value === "number" ? value : parseTseNumber(value);
  if (number === null || !Number.isFinite(number)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(number)}%`;
}

export function tseCandidatePhotoUrl(electionCode, coverage, sequence) {
  const election = String(electionCode ?? "");
  const scope = String(coverage ?? "").trim().toLowerCase();
  const candidate = String(sequence ?? "");
  if (!/^\d{4,6}$/.test(election) || !/^(br|zz|[a-z]{2})$/.test(scope) || !/^\d+$/.test(candidate)) return null;
  return `https://resultados.tse.jus.br/oficial/ele2026/${election}/fotos/${scope}/${candidate}.jpeg`;
}

export function getTseCandidates(result, officeCode) {
  const office = result?.carg?.find((item) => String(item.cd) === String(officeCode));
  if (!office) return [];
  const photoCoverage = String(officeCode) === "1" ? "br" : result.cdabr;
  const candidates = [];

  for (const group of office.agr ?? []) {
    for (const party of group.par ?? []) {
      for (const candidate of party.cand ?? []) {
        candidates.push({
          id: candidate.sqcand ?? candidate.n,
          number: candidate.n ?? null,
          name: candidate.nmu || candidate.nm || "Nome não informado pelo TSE",
          party: party.sg || party.nm || "",
          votes: parseTseNumber(candidate.vap),
          percent: parseTseNumber(candidate.pvapn ?? candidate.pvap),
          photoUrl: tseCandidatePhotoUrl(result.ele, photoCoverage || (String(officeCode) === "1" ? "br" : null), candidate.sqcand),
          status: candidate.st ?? "",
          voteDestination: candidate.dvt ?? "",
          officialOrder: parseTseNumber(candidate.seq),
        });
      }
    }
  }

  return candidates;
}

export function normalizeTseResult(result, officeCode) {
  if (!result || !Array.isArray(result.carg)) return null;

  const sections = result.s ?? {};
  const electors = result.e ?? {};
  const votes = result.v ?? {};
  const validVotes = parseTseNumber(votes.vv);
  const nullVoteParts = [parseTseNumber(votes.vn), parseTseNumber(votes.vnt)].filter(Number.isFinite);
  const candidates = getTseCandidates(result, officeCode);

  return {
    electionCode: result.ele ?? null,
    round: parseTseNumber(result.t),
    coverage: result.cdabr ?? null,
    finalized: result.and === "f",
    publishedDate: result.dt ?? null,
    publishedTime: result.ht ?? null,
    sections: {
      total: parseTseNumber(sections.ts),
      counted: parseTseNumber(sections.st),
      percent: parseTseNumber(sections.pstn ?? sections.pst),
    },
    electors: {
      total: parseTseNumber(electors.te),
      present: parseTseNumber(electors.c),
      absent: parseTseNumber(electors.a),
    },
    votes: {
      total: parseTseNumber(votes.tv),
      valid: parseTseNumber(votes.vvc) ?? validVotes,
      validWithoutSubjudice: validVotes,
      blank: parseTseNumber(votes.vb),
      null: nullVoteParts.length ? nullVoteParts.reduce((total, part) => total + part, 0) : null,
      annulledSubjudice: parseTseNumber(votes.vansj),
    },
    candidates: candidates.sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1)),
    sourceUrl: null,
  };
}

export function deriveGovernorRunoff(result) {
  const summary = normalizeTseResult(result, "3");
  if (!summary || !summary.finalized || !summary.votes.valid) {
    return { status: "unavailable", hasRunoff: null, candidates: [], summary };
  }

  const validCandidates = summary.candidates.filter((candidate) =>
    candidate.voteDestination.toLocaleLowerCase("pt-BR") === "válido" || candidate.status === "2º turno",
  );
  const ranked = validCandidates.length ? validCandidates : summary.candidates;
  const leader = ranked[0];
  if (!leader || leader.votes === null) {
    return { status: "unavailable", hasRunoff: null, candidates: [], summary };
  }

  const qualified = summary.candidates.filter((candidate) => candidate.status.toLocaleLowerCase("pt-BR") === "2º turno");
  const officialWinner = summary.candidates.some((candidate) => {
    const status = candidate.status.toLocaleLowerCase("pt-BR");
    return /^(eleito|eleita)$/.test(status);
  });
  const hasRunoff = qualified.length > 0
    ? true
    : officialWinner
      ? false
      : leader.percent === null
        ? leader.votes * 2 <= summary.votes.valid
        : leader.percent <= 50;
  return {
    status: "official",
    hasRunoff,
    candidates: hasRunoff ? (qualified.length ? qualified : ranked.slice(0, 2)) : [],
    summary,
  };
}

export function electionPhase(now = new Date(), officialFinalized = false) {
  if (officialFinalized) return "final";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const today = `${values.year}-${values.month}-${values.day}`;

  if (today < RUNOFF_DATE || (today === RUNOFF_DATE && Number(values.hour) < RUNOFF_START_HOUR_BRT)) return "before";
  if (today === RUNOFF_DATE && Number(values.hour) < VOTING_END_HOUR_BRT) return "voting";
  return "counting";
}

export function preserveLastElectionSnapshot(previousSnapshot, errorMessage = "A fonte do TSE não respondeu.") {
  if (!previousSnapshot) return { status: "error", errorMessage, stale: false };
  return { ...previousSnapshot, status: "stale", stale: true, errorMessage };
}

export function formatBrasiliaDateTime(value) {
  if (!value) return "Ainda não disponível";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Ainda não disponível";
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${formatted} (horário de Brasília)`;
}
