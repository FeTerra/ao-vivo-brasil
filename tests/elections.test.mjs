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
  tseCandidatePhotoUrl,
} from "../src/elections.js";
import { renderCandidateResultsTable, renderElectionMap, renderFirstRoundResultsArchive, renderNoGovernorRunoffNotice } from "../src/election-components.js";
import { states } from "../src/data.js";
import { stateMapFeatures } from "../src/state-map.js";

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

test("fotos dos candidatos usam o identificador e o caminho oficial do TSE", () => {
  assert.equal(
    tseCandidatePhotoUrl("6257", "BR", "280002551544"),
    "https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002551544.jpeg",
  );
  assert.equal(tseCandidatePhotoUrl("6257", "??", "280002551544"), null);
  assert.equal(tseCandidatePhotoUrl("6257", "br", "../../foto"), null);
});

test("resultado completo mantém fotos, votação, situação e fonte identificadas", () => {
  const table = renderCandidateResultsTable([
    { name: "Candidatura A", party: "PA", votes: 1234, percent: 60.2, status: "2º turno", photoUrl: "https://resultados.tse.jus.br/fotos/a.jpeg" },
    { name: "Candidatura B", party: "PB", votes: 800, percent: 39.8, status: "Não eleito" },
  ], { sourceUrl: "https://resultados.tse.jus.br/oficial/app/index.html", collapsed: false });
  assert.match(table, /Retrato oficial de Candidatura A/);
  assert.match(table, /1\.234/);
  assert.match(table, /60,2%/);
  assert.match(table, /2º turno/);
  assert.match(table, /TSE/);
});

test("arquivo de governador deixa os totalizadores e a lista completa do primeiro turno acessíveis", () => {
  const archive = renderFirstRoundResultsArchive({
    finalized: true,
    sections: { percent: 100, counted: 200, total: 200 },
    votes: { valid: 1000, blank: 10, null: 20 },
    electors: { present: 1030, absent: 70 },
    candidates: [{ name: "Candidatura estadual", party: "PE", votes: 1000, percent: 100, status: "Eleito" }],
  }, { title: "Resultado do Acre", office: "Governo do Acre" });
  assert.match(archive, /Resultado do Acre/);
  assert.match(archive, /1.030/);
  assert.match(archive, /Candidatura estadual/);
  assert.match(archive, /Arquivo final do primeiro turno/);
});

test("mapa pré-apuração reúne as 27 UFs e identifica o zero como demonstrativo", () => {
  const map = renderElectionMap(stateMapFeatures, states, [], { coverage: "BR" });
  assert.equal((map.match(/class="election-map-link/g) || []).length, 27);
  assert.match(map, /0% demonstrativo/);
  assert.match(map, /não representa uma medição do TSE/);
  assert.match(map, /aria-valuenow="0"/);
  assert.match(map, /exterior/i);
});

test("mapa não inventa percentual nacional quando só existem arquivos estaduais", () => {
  const map = renderElectionMap(stateMapFeatures, states, [{
    uf: "AC",
    president: { sections: { percent: 41.2, counted: 100, total: 243 } },
  }], { coverage: "BR", overallResult: null });
  assert.match(map, /Total nacional aguardando arquivo oficial/);
  assert.match(map, /Acre \(AC\): 41,2% das seções apuradas/);
  assert.doesNotMatch(map, /aria-valuenow="0"/);
});
