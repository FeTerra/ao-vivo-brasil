import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveGovernorRunoff,
  electionCoverageFromHash,
  electionHashForCoverage,
  formatElectionInteger,
  formatElectionPercent,
  normalizeTseResult,
  parseTseNumber,
  preserveLastElectionSnapshot,
} from "../src/elections.js";
import { renderNoGovernorRunoffNotice } from "../src/election-components.js";

function firstRoundGovernorResult(votes) {
  const validVotes = votes.reduce((total, item) => total + item.votes, 0);
  return {
    ele: "6259",
    t: "1",
    and: "f",
    v: { vv: String(validVotes) },
    carg: [{
      cd: "3",
      agr: votes.map((item, index) => ({
        par: [{
          sg: `P${index + 1}`,
          cand: [{
            n: String(index + 1),
            nmu: `Candidatura ${index + 1}`,
            vap: String(item.votes),
            pvapn: String((item.votes / validVotes) * 100),
            dvt: "Válido",
            st: item.status || "Não eleito",
          }],
        }],
      })),
    }],
  };
}

test("o seletor converte abrangência para uma URL compartilhável e volta para Brasil", () => {
  assert.equal(electionHashForCoverage("AC"), "#eleicoes/segundo-turno/AC");
  assert.equal(electionCoverageFromHash("#eleicoes/segundo-turno/AC"), "AC");
  assert.equal(electionCoverageFromHash("#eleicoes/segundo-turno/exterior"), "EX");
  assert.equal(electionHashForCoverage("BR"), "#eleicoes/segundo-turno");
  assert.equal(electionCoverageFromHash("#eleicoes/segundo-turno"), "BR");
  assert.equal(electionCoverageFromHash("#eleicoes/segundo-turno/XX"), null);
});

test("a maioria absoluta no primeiro turno dispensa segundo turno de governador", () => {
  const result = deriveGovernorRunoff(firstRoundGovernorResult([
    { votes: 501, status: "Eleito" },
    { votes: 300 },
    { votes: 199 },
  ]));
  assert.equal(result.status, "official");
  assert.equal(result.hasRunoff, false);
  assert.deepEqual(result.candidates, []);
  const notice = renderNoGovernorRunoffNotice({ uf: "AL", stateName: "Alagoas" });
  assert.match(notice, /Este estado não tem segundo turno para governador/);
  assert.match(notice, /Alagoas/);
});

test("sem mais de 50% dos votos válidos, os dois mais votados seguem ao segundo turno", () => {
  const result = deriveGovernorRunoff(firstRoundGovernorResult([
    { votes: 500, status: "2º turno" },
    { votes: 350, status: "2º turno" },
    { votes: 150 },
  ]));
  assert.equal(result.hasRunoff, true);
  assert.deepEqual(result.candidates.map((candidate) => candidate.votes), [500, 350]);
});

test("falha da fonte conserva a última resposta válida e a marca como desatualizada", () => {
  const lastGood = { status: "official", references: { president: { candidates: [] } } };
  const stale = preserveLastElectionSnapshot(lastGood, "TSE indisponível");
  assert.equal(stale.status, "stale");
  assert.equal(stale.stale, true);
  assert.equal(stale.errorMessage, "TSE indisponível");
  assert.equal(stale.references, lastGood.references);
  assert.equal(preserveLastElectionSnapshot(null).status, "error");
});

test("números do TSE são formatados em pt-BR sem perder casas decimais", () => {
  assert.equal(parseTseNumber("47.027772356"), 47.027772356);
  assert.equal(parseTseNumber("1.234.567"), 1234567);
  assert.equal(parseTseNumber("47,1"), 47.1);
  assert.equal(formatElectionInteger("125275835"), "125.275.835");
  assert.equal(formatElectionPercent("47.027772356"), "47,0%");
  assert.equal(formatElectionPercent(null), "—");
  const incomplete = normalizeTseResult({ carg: [], s: {}, e: {}, v: {} }, "1");
  assert.equal(incomplete.votes.null, null);
});
