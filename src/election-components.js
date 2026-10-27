import { Fragment, createElement as h, useState } from "react";
import {
  electionHashForCoverage,
  formatElectionInteger,
  formatElectionPercent,
  TSE_RESULTS_URL,
} from "./elections.js";

/** @typedef {{ id?: string, name?: string, party?: string, votes?: number | null, percent?: number | null, photoUrl?: string | null, status?: string }} ElectionCandidate */
/** @typedef {{ candidates?: ElectionCandidate[], sections?: { total?: number | null, counted?: number | null, percent?: number | null }, votes?: { valid?: number | null, blank?: number | null, null?: number | null }, electors?: { present?: number | null, absent?: number | null }, finalized?: boolean, available?: boolean, sourceUrl?: string, publishedDate?: string, publishedTime?: string }} ElectionTally */
/** @typedef {{ status?: string, hasRunoff?: boolean | null, error?: boolean, candidates?: ElectionCandidate[], summary?: ElectionTally, sourceUrl?: string, publication?: { date?: string, time?: string } }} GovernorReference */
/** @typedef {{ uf: string, name: string, governor?: GovernorReference }} ElectionStateReference */

function candidateInitials(candidate) {
  return String(candidate?.name || "TSE")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

/** @param {{ candidate?: ElectionCandidate, size?: string }} props */
export function CandidatePortrait({ candidate, size = "" }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const initials = candidateInitials(candidate);
  const photo = candidate?.photoUrl && !photoFailed
    ? h(Fragment, null,
      h("img", {
        className: "election-candidate-photo",
        src: candidate.photoUrl,
        alt: "Retrato oficial de " + (candidate.name || "candidatura"),
        loading: "lazy",
        decoding: "async",
        referrerPolicy: "no-referrer",
        onError: () => setPhotoFailed(true),
      }),
      h("span", { className: "election-candidate-photo-fallback", "aria-hidden": true, hidden: true }, initials),
    )
    : h("span", { className: "election-candidate-photo-fallback", "aria-hidden": true }, initials);

  return h("span", { className: "election-candidate-portrait " + size }, photo);
}

/** @param {{ definition?: string, unit?: string, period?: string, sourceUrl?: string, publishedAt?: string | null, frequency?: string, notes?: string }} props */
export function ElectionMetadata({
  definition,
  unit,
  period,
  sourceUrl = TSE_RESULTS_URL,
  publishedAt,
  frequency = "Durante a totalização, conforme atualização dos arquivos do TSE.",
  notes,
}) {
  const rows = [
    { label: "Definição", value: definition },
    { label: "Unidade", value: unit },
    { label: "Período", value: period },
    {
      label: "Fonte",
      value: h("a", { href: sourceUrl, target: "_blank", rel: "noopener noreferrer" },
        "Resultados oficiais do TSE ", h("span", { "aria-hidden": true }, "↗")),
    },
    { label: "Publicação do arquivo", value: publishedAt || "Ainda não disponível" },
    { label: "Frequência esperada", value: frequency },
    { label: "Notas metodológicas", value: notes, className: "election-metadata-wide" },
  ];

  return h("details", { className: "election-method" },
    h("summary", null, "Definição, fonte e método"),
    h("dl", { className: "election-metadata-list" }, rows.map((row) =>
      h("div", { className: row.className, key: row.label },
        h("dt", null, row.label), h("dd", null, row.value)))),
  );
}

/** @param {{ candidates?: ElectionCandidate[], title?: string, eyebrow?: string, context?: string, emptyMessage?: string, sourceUrl?: string, publishedAt?: string | null, frequency?: string, period?: string, resultLabel?: string }} props */
export function CandidatePair({
  candidates,
  title,
  eyebrow = "CANDIDATURAS",
  context,
  emptyMessage = "Os dados oficiais deste recorte ainda não estão disponíveis.",
  sourceUrl,
  publishedAt,
  frequency = "Durante a totalização, conforme atualização dos arquivos do TSE.",
  period,
  resultLabel = "Referência do primeiro turno",
} = {}) {
  const availableCandidates = (candidates || []).slice(0, 2);
  const pair = availableCandidates.length
    ? h("div", { className: "election-candidate-grid" }, [0, 1].map((index) => {
      const candidate = availableCandidates[index];
      return h("article", { className: "election-candidate-card", key: candidate?.id || candidate?.name || index },
        h("span", { className: "election-candidate-order" }, "Candidato " + (index + 1)),
        h("div", { className: "election-candidate-heading" },
          h(CandidatePortrait, { candidate }),
          h("div", null,
            h("h3", null, candidate?.name || "Aguardando dado oficial"),
            h("p", null, candidate?.party || "Partido não informado"))),
        h("div", { className: "election-candidate-total" },
          h("strong", null, candidate ? formatElectionInteger(candidate.votes) : "—"),
          h("span", null, "votos")),
        h("div", { className: "election-candidate-percent" },
          candidate ? formatElectionPercent(candidate.percent) : "—",
          " ", h("span", null, "dos votos válidos")),
        candidate?.status ? h("span", { className: "election-candidate-status" }, candidate.status) : null,
      );
    }))
    : h("div", { className: "election-empty-state" },
      h("strong", null, "Sem resultado disponível"), h("p", null, emptyMessage));

  return h("section", { className: "panel election-block" },
    h("div", { className: "panel-head" },
      h("div", null,
        h("div", { className: "section-kicker" }, eyebrow),
        h("h2", null, title)),
      h("span", { className: "quiet-badge" }, resultLabel)),
    context ? h("p", { className: "panel-intro" }, context) : null,
    pair,
    h(ElectionMetadata, {
      definition: "Votação nominal dos candidatos na abrangência indicada.",
      unit: "Votos e percentual dos votos válidos.",
      period: period || "Primeiro turno de 2026, usado apenas como referência.",
      sourceUrl: sourceUrl || TSE_RESULTS_URL,
      publishedAt,
      frequency,
      notes: "O percentual dos votos válidos exclui votos em branco e nulos. Os números desta seção são do primeiro turno e não representam a apuração do segundo turno.",
    }),
  );
}

/** @param {{ candidates?: ElectionCandidate[], title?: string, office?: string, sourceUrl?: string, publishedAt?: string | null, frequency?: string, period?: string, collapsed?: boolean }} props */
export function CandidateResultsTable({
  candidates,
  title = "Candidaturas e votação",
  office = "Presidência",
  sourceUrl = TSE_RESULTS_URL,
  publishedAt,
  frequency = "Arquivo final do primeiro turno; sem atualização periódica prevista.",
  period = "Primeiro turno de 2026.",
  collapsed = false,
} = {}) {
  const candidateList = candidates || [];
  const table = candidateList.length
    ? h("div", { className: "election-table-wrap" },
      h("table", { className: "election-results-table" },
        h("caption", { className: "visually-hidden" }, title + " · resultado oficial do primeiro turno"),
        h("thead", null, h("tr", null,
          h("th", { scope: "col" }, h("span", { className: "visually-hidden" }, "Foto")),
          h("th", { scope: "col" }, "Candidatura"),
          h("th", { scope: "col" }, "Votos"),
          h("th", { scope: "col" }, "Votos válidos"),
          h("th", { scope: "col" }, "Situação no TSE"))),
        h("tbody", null, candidateList.map((candidate, index) =>
          h("tr", { key: candidate.id || candidate.name || index },
            h("td", { className: "election-photo-cell" },
              h(CandidatePortrait, { candidate, size: "election-candidate-portrait-small" })),
            h("th", { scope: "row" },
              h("span", { className: "election-candidate-rank" }, (index + 1) + "º"),
              h("strong", null, candidate.name),
              h("small", null, candidate.party || "Partido não informado")),
            h("td", null, formatElectionInteger(candidate.votes)),
            h("td", null, formatElectionPercent(candidate.percent)),
            h("td", null, candidate.status || "—"))))))
    : h("div", { className: "election-empty-state" },
      h("strong", null, "Resultado ainda indisponível"),
      h("p", null, "O arquivo oficial deste recorte não está disponível."));

  const content = h("div", { className: "election-results-table-panel" },
    h("p", { className: "table-scroll-hint" }, "Em telas pequenas, deslize a tabela para ver todas as colunas."),
    table,
    h(ElectionMetadata, {
      definition: "Votação nominal de todas as candidaturas a " + office + " no primeiro turno, na ordem decrescente de votos.",
      unit: "Votos e percentual dos votos válidos.",
      period,
      sourceUrl,
      publishedAt,
      frequency,
      notes: "Os percentuais são os campos publicados pelo TSE. Votos brancos e nulos não compõem o denominador. As fotografias são os arquivos oficiais de candidaturas do TSE.",
    }));

  return collapsed
    ? h("details", { className: "panel election-block election-first-round-details" },
      h("summary", null, title, " ", h("span", null, candidateList.length + " candidaturas")), content)
    : h("section", { className: "panel election-block" },
      h("div", { className: "panel-head" },
        h("div", null,
          h("div", { className: "section-kicker" }, "RESULTADO COMPLETO · 1º TURNO"),
          h("h2", null, title)),
        h("span", { className: "quiet-badge" }, candidateList.length + " candidaturas")),
      content);
}

/** @param {{ result?: ElectionTally, title?: string, office?: string, sourceUrl?: string, publishedAt?: string | null, period?: string }} props */
export function FirstRoundResultsArchive({
  result,
  title = "Resultado completo do primeiro turno",
  office = "Presidência",
  sourceUrl = TSE_RESULTS_URL,
  publishedAt,
  period = "Primeiro turno de 2026.",
} = {}) {
  const candidates = result?.candidates ?? [];
  const frequency = "Arquivo final do primeiro turno; sem atualização periódica prevista.";
  return h("details", { className: "panel election-block election-first-round-details election-first-round-archive" },
    h("summary", null, title, " ", h("span", null, candidates.length + " candidaturas · totalizadores")),
    h(ElectionTotalizers, {
      result,
      title: "Totalizadores · " + office,
      subtitle: "Totais oficiais do primeiro turno para " + office + "; separados da apuração da segunda votação.",
      period,
      frequency,
      sourceUrl,
    }),
    h(CandidateResultsTable, {
      candidates,
      title: "Todas as candidaturas · " + office,
      office,
      sourceUrl,
      publishedAt,
      period,
      frequency,
      collapsed: false,
    }),
  );
}

function electionMapBand(value) {
  if (!Number.isFinite(value)) return "is-waiting";
  if (value >= 80) return "progress-80";
  if (value >= 60) return "progress-60";
  if (value >= 40) return "progress-40";
  if (value >= 20) return "progress-20";
  return "progress-0";
}

/** @param {{ features?: Array<{ uf: string, path: string, callout?: string, labelX: number, labelY: number }>, states?: Array<{ uf: string, name: string }>, liveStates?: Array<{ uf: string, president?: ElectionTally | null }>, coverage?: string, overallResult?: ElectionTally | null }} props */
export function ElectionMap({
  features,
  states,
  liveStates = [],
  coverage = "BR",
  overallResult = null,
} = {}) {
  const stateByUf = new Map((states || []).map((state) => [state.uf, state]));
  const liveByUf = new Map((liveStates || []).map((state) => [state.uf, state.president]));
  const hasOfficialRegionalData = [...liveByUf.values()].some((result) => result != null);
  const selectedResult = overallResult || (coverage !== "BR" ? liveByUf.get(coverage) : null);
  const rawPercent = selectedResult?.sections?.percent;
  const percent = rawPercent === null || rawPercent === undefined || rawPercent === "" ? null : Number(rawPercent);
  const showDemonstrativeZero = !selectedResult && (coverage !== "BR" || !hasOfficialRegionalData);
  const summaryPercent = Number.isFinite(percent)
    ? Math.min(100, Math.max(0, percent))
    : showDemonstrativeZero ? 0 : null;
  const sectionLabel = selectedResult
    ? formatElectionInteger(selectedResult.sections?.counted) + " de " + formatElectionInteger(selectedResult.sections?.total) + " seções totalizadas"
    : coverage === "BR" && hasOfficialRegionalData
      ? "Há arquivos estaduais; o total nacional ainda não está disponível"
      : "Pré-apuração · 0% demonstrativo, sem arquivo do 2º turno";
  const summaryLabel = coverage === "BR"
    ? "APURAÇÃO PRESIDENCIAL · BRASIL"
    : "APURAÇÃO PRESIDENCIAL · " + (stateByUf.get(coverage)?.name || coverage);
  const mapRegions = (features || []).map((feature) => {
    const state = stateByUf.get(feature.uf);
    if (!state) return null;
    const result = liveByUf.get(feature.uf);
    const rawStatePercent = result?.sections?.percent;
    const statePercent = rawStatePercent === null || rawStatePercent === undefined || rawStatePercent === "" ? null : Number(rawStatePercent);
    const band = electionMapBand(statePercent);
    const stateLabel = Number.isFinite(statePercent)
      ? state.name + " (" + state.uf + "): " + formatElectionPercent(statePercent) + " das seções apuradas no segundo turno."
      : state.name + " (" + state.uf + "): " + (hasOfficialRegionalData ? "aguardando arquivo do TSE" : "pré-apuração visual em 0%; não é um dado oficial") + ".";
    return h("a", {
      className: "election-map-link " + band + (coverage === feature.uf ? " is-selected" : ""),
      href: electionHashForCoverage(feature.uf),
      "aria-label": stateLabel,
      key: feature.uf,
    }, h("path", { className: "election-map-state-shape", d: feature.path, fillRule: "evenodd" }));
  });
  const callouts = (features || []).filter((feature) => feature.callout).map((feature) =>
    h("path", { className: "election-map-callout", d: feature.callout, key: feature.uf }));
  const labels = (features || []).map((feature) =>
    h("text", {
      className: "election-map-label" + (coverage === feature.uf ? " is-selected" : ""),
      x: feature.labelX,
      y: feature.labelY,
      textAnchor: "middle",
      key: feature.uf,
    }, feature.uf));
  const legend = hasOfficialRegionalData
    ? h("span", { className: "election-map-scale", "aria-label": "Faixas de percentual das seções apuradas" },
      h("span", null, h("i", { className: "progress-0" }), "0–19%"),
      h("span", null, h("i", { className: "progress-20" }), "20–39%"),
      h("span", null, h("i", { className: "progress-40" }), "40–59%"),
      h("span", null, h("i", { className: "progress-60" }), "60–79%"),
      h("span", null, h("i", { className: "progress-80" }), "80–100%"))
    : h(Fragment, null,
      h("span", { className: "election-map-legend-key", "aria-hidden": true }),
      h("span", null, "UF sem resultado publicado do 2º turno"));
  const progressText = selectedResult && summaryPercent !== null
    ? formatElectionPercent(summaryPercent) + " das seções apuradas"
    : selectedResult
      ? "Percentual de seções ainda não informado no arquivo oficial"
      : !showDemonstrativeZero
        ? "Total nacional aguardando arquivo oficial"
        : "0% · estado visual, não oficial";
  const intro = hasOfficialRegionalData
    ? "Tonalidades neutras representam o percentual de seções totalizadas, sem associação a candidaturas. Selecione uma UF para abrir o recorte."
    : "A apuração do segundo turno não começou. O 0% serve somente para visualizar o mapa antes da chegada dos arquivos oficiais; não representa uma medição do TSE.";
  const progressProps = summaryPercent === null
    ? { role: "img", "aria-label": progressText }
    : {
      role: "progressbar",
      "aria-label": "Percentual de seções presidenciais apuradas",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": summaryPercent,
      "aria-valuetext": progressText,
    };

  return h("section", { className: "panel election-block election-map-panel", "aria-labelledby": "election-map-title" },
    h("div", { className: "panel-head" },
      h("div", null,
        h("div", { className: "section-kicker" }, "ACOMPANHAMENTO TERRITORIAL"),
        h("h2", { id: "election-map-title" }, "Apuração presidencial por UF")),
      h("span", { className: "quiet-badge" }, hasOfficialRegionalData ? "Seções totalizadas" : "Pré-apuração · visual inicial")),
    h("p", { className: "panel-intro" }, intro),
    h("div", { className: "election-map-layout" },
      h("figure", { className: "election-map-figure" },
        h("svg", {
          className: "election-map-svg",
          viewBox: "0 0 760 680",
          role: "group",
          "aria-labelledby": "election-map-svg-title election-map-svg-description",
        },
        h("title", { id: "election-map-svg-title" }, "Mapa das 27 unidades da Federação com apuração presidencial do segundo turno"),
        h("desc", { id: "election-map-svg-description" }, "Cada unidade é um link para seu recorte estadual. Antes da publicação de resultados, o mapa mostra 0% apenas como estado visual demonstrativo. As cores, depois da apuração começar, indicam somente o percentual de seções totalizadas."),
        h("g", { className: "election-map-regions" }, mapRegions),
        h("g", { className: "election-map-callouts", "aria-hidden": true }, callouts),
        h("g", { className: "election-map-labels", "aria-hidden": true }, labels)),
        h("figcaption", null, legend)),
      h("aside", { className: "election-map-summary", "aria-label": "Resumo de apuração nesta abrangência" },
        h("span", { className: "section-kicker" }, summaryLabel),
        h("strong", null, summaryPercent === null ? "—" : formatElectionPercent(summaryPercent)),
        h("span", { className: "election-map-progress-label" }, progressText),
        h("div", { className: "election-map-progress", ...progressProps },
          h("span", { style: { width: (summaryPercent ?? 0) + "%" } })),
        h("small", null, sectionLabel),
        h("p", null, coverage === "BR"
          ? "O total nacional inclui o voto no exterior; o mapa separa as 27 UFs."
          : "Selecione outra UF no mapa ou no seletor para comparar recortes."))),
    h(ElectionMetadata, {
      definition: "Percentual de seções eleitorais totalizadas para presidente no segundo turno, por unidade da Federação.",
      unit: "Percentual de seções, de 0% a 100%.",
      period: "Segundo turno de 2026.",
      publishedAt: selectedResult?.publishedDate && selectedResult?.publishedTime
        ? selectedResult.publishedDate + " às " + selectedResult.publishedTime
        : null,
      notes: hasOfficialRegionalData
        ? "O percentual usa seções totalizadas sobre o total de seções informado pelo TSE. O exterior integra o total nacional presidencial, mas não corresponde a uma UF."
        : "O 0% exibido é um marcador demonstrativo da interface antes do primeiro arquivo oficial do segundo turno; nenhum total de votos ou seções foi inferido. O exterior integra o total nacional presidencial, mas não corresponde a uma UF.",
    }));
}

/** @param {{ referenceStates?: ElectionStateReference[] }} props */
export function GovernorFirstRoundResults({ referenceStates }) {
  const confirmed = (referenceStates || []).filter((state) =>
    state.governor?.status === "official" && state.governor.hasRunoff === true);
  if (!confirmed.length) return null;
  const cards = confirmed.map((state) => {
    const governor = state.governor;
    const summary = governor.summary;
    const publishedAt = summary?.publishedDate && summary?.publishedTime
      ? summary.publishedDate + " às " + summary.publishedTime
      : null;
    return h("article", { className: "election-governor-result", key: state.uf },
      h("div", { className: "election-governor-result-head" },
        h("div", null,
          h("span", { className: "section-kicker" }, "1º TURNO · GOVERNADOR"),
          h("h3", null, state.name, " ", h("span", null, "(" + state.uf + ")")),
          h("small", { className: "election-governor-source" },
            "Carimbo do arquivo: ", summary?.publishedDate || "data não informada",
            summary?.publishedTime ? " às " + summary.publishedTime : "", " · ",
            h("a", { href: governor.sourceUrl || TSE_RESULTS_URL, target: "_blank", rel: "noopener noreferrer" }, "fonte TSE ↗"))),
        h("a", { href: electionHashForCoverage(state.uf), "aria-label": "Abrir apuração em " + state.name },
          "Ver UF ", h("span", { "aria-hidden": true }, "→"))),
      h("ol", null, (governor.candidates || []).slice(0, 2).map((candidate, index) =>
        h("li", { key: candidate.id || candidate.name || index },
          h(CandidatePortrait, { candidate, size: "election-candidate-portrait-small" }),
          h("span", { className: "election-governor-candidate-name" },
            h("strong", null, candidate.name),
            h("small", null, candidate.party || "Partido não informado")),
          h("span", { className: "election-governor-candidate-vote" },
            h("strong", null, formatElectionInteger(candidate.votes)),
            h("small", null, formatElectionPercent(candidate.percent)))))),
      h(FirstRoundResultsArchive, {
        result: summary,
        title: "Resultado completo · " + state.name,
        office: "Governo de " + state.name,
        sourceUrl: governor.sourceUrl,
        publishedAt,
        period: "Primeiro turno de 2026 · " + state.name + ".",
      }));
  });

  return h("section", { className: "panel election-block election-governor-first-round" },
    h("div", { className: "panel-head" },
      h("div", null,
        h("div", { className: "section-kicker" }, "REFERÊNCIA OFICIAL · 1º TURNO"),
        h("h2", null, "Governos estaduais com segundo turno")),
      h("span", { className: "quiet-badge" }, confirmed.length + " UFs · derivadas do TSE")),
    h("p", { className: "panel-intro" }, "Votos e percentuais são da primeira votação e contextualizam as disputas estaduais. A classificação dos estados vem dos arquivos oficiais; nenhuma UF foi fixada no código."),
    h("div", { className: "election-governor-result-grid" }, cards),
    h(ElectionMetadata, {
      definition: "Dois primeiros candidatos nas UFs em que o TSE confirmou segundo turno para governador.",
      unit: "Votos e percentual dos votos válidos.",
      period: "Primeiro turno de 2026; resultados totalizados.",
      publishedAt: "Data e hora variam por arquivo estadual; cada cartão liga ao arquivo correspondente.",
      frequency: "Arquivo final do primeiro turno; sem atualização periódica prevista.",
      notes: "Esta lista inclui apenas disputas estaduais derivadas dos resultados oficiais. Votos válidos excluem brancos e nulos. Fotos são servidas pelos arquivos oficiais do TSE.",
    }));
}

/** @param {{ result?: ElectionTally | null, title?: string, subtitle?: string, period?: string, frequency?: string, sourceUrl?: string }} props */
export function ElectionTotalizers({
  result,
  title,
  subtitle,
  period = "Segundo turno de 2026",
  frequency = "Durante a totalização, conforme atualização dos arquivos do TSE.",
  sourceUrl,
} = {}) {
  const sections = result?.sections ?? {};
  const votes = result?.votes ?? {};
  const electors = result?.electors ?? {};
  const metrics = [
    { label: "Seções apuradas", value: result ? formatElectionPercent(sections.percent) : "—", detail: result ? formatElectionInteger(sections.counted) + " de " + formatElectionInteger(sections.total) + " seções" : "Aguardando totalização" },
    { label: "Votos válidos", value: result ? formatElectionInteger(votes.valid) : "—", detail: "Candidaturas válidas" },
    { label: "Votos em branco", value: result ? formatElectionInteger(votes.blank) : "—", detail: "Total oficial" },
    { label: "Votos nulos", value: result ? formatElectionInteger(votes.null) : "—", detail: "Inclui nulos técnicos, quando informados" },
    { label: "Comparecimento", value: result ? formatElectionInteger(electors.present) : "—", detail: "Eleitoras e eleitores presentes" },
    { label: "Abstenção", value: result ? formatElectionInteger(electors.absent) : "—", detail: "Eleitoras e eleitores ausentes" },
  ];

  return h("section", { className: "panel election-block" },
    h("div", { className: "panel-head" },
      h("div", null,
        h("div", { className: "section-kicker" }, "TOTALIZAÇÃO"),
        h("h2", null, title)),
      h("span", { className: "quiet-badge" }, result
        ? result.finalized ? "Totalização final" : "Em apuração"
        : "Sem resultado do 2º turno")),
    subtitle ? h("p", { className: "panel-intro" }, subtitle) : null,
    h("div", { className: "election-metric-grid" }, metrics.map((metric) =>
      h("article", { className: "election-metric", key: metric.label },
        h("span", null, metric.label), h("strong", null, metric.value), h("small", null, metric.detail)))),
    h(ElectionMetadata, {
      definition: "Totais oficiais do arquivo de resultado unificado para a abrangência selecionada.",
      unit: "Seções, votos e eleitoras ou eleitores.",
      period,
      sourceUrl: result?.sourceUrl || sourceUrl || TSE_RESULTS_URL,
      publishedAt: result?.publishedDate && result?.publishedTime
        ? result.publishedDate + " às " + result.publishedTime + " (horário informado no arquivo do TSE)"
        : null,
      frequency,
      notes: "Percentuais de candidatos usam votos válidos como denominador. Votos válidos excluem brancos e nulos. Valores não publicados permanecem vazios.",
    }));
}

/** @param {{ uf?: string, stateName?: string, sourceUrl?: string, publishedAt?: string | null }} [props] */
export function NoGovernorRunoffNotice({ uf, stateName, sourceUrl, publishedAt } = {}) {
  return h("section", { className: "panel election-block election-governor-unavailable" },
    h("div", { className: "section-kicker" }, "GOVERNO ESTADUAL · " + uf),
    h("h2", null, "Este estado não tem segundo turno para governador"),
    h("p", null, "O resultado oficial do primeiro turno indica maioria absoluta dos votos válidos. A página mantém o acompanhamento presidencial para " + (stateName || "esta unidade da Federação") + "."),
    h(ElectionMetadata, {
      definition: "A existência de segundo turno é derivada da votação oficial para governador no primeiro turno.",
      unit: "Percentual de votos válidos.",
      period: "Primeiro turno de 2026.",
      sourceUrl,
      publishedAt,
      frequency: "Arquivo final do primeiro turno; sem atualização periódica prevista.",
      notes: "Há segundo turno quando nenhuma candidatura obtém mais da metade dos votos válidos. Votos em branco e nulos ficam fora desse cálculo.",
    }));
}

/** @param {{ states?: Array<{ uf: string, name: string }>, liveStates?: Array<{ uf: string, president?: ElectionTally | null }> }} [props] */
export function ElectionStatesTable({ states, liveStates = [] } = {}) {
  const liveByUf = new Map((liveStates || []).map((state) => [state.uf, state.president]));
  const rows = (states || []).map((state) => {
    const result = liveByUf.get(state.uf);
    const candidates = result?.candidates || [];
    const leader = candidates[0];
    const next = candidates[1];
    const margin = leader && next && leader.percent !== null && next.percent !== null
      ? formatElectionPercent(leader.percent - next.percent).replace("%", "") + " p.p."
      : "—";
    return h("tr", { key: state.uf },
      h("th", { scope: "row" },
        h("a", { href: electionHashForCoverage(state.uf) }, state.uf,
          h("span", { className: "visually-hidden" }, " — " + state.name))),
      h("td", null, result ? formatElectionPercent(result.sections?.percent) : "—"),
      h("td", null, leader?.name || "—"),
      h("td", null, margin));
  });

  return h("section", { className: "panel election-block" },
    h("div", { className: "panel-head" },
      h("div", null,
        h("div", { className: "section-kicker" }, "RECORTE TERRITORIAL"),
        h("h2", null, "Presidente por unidade da Federação")),
      h("span", { className: "quiet-badge" }, "27 UFs")),
    h("p", { className: "panel-intro" }, "Cada linha abre a visão estadual. Os campos do segundo turno permanecem vazios até a publicação oficial dos resultados."),
    h("p", { className: "table-scroll-hint" }, "Em telas pequenas, deslize a tabela para ver todas as colunas."),
    h("div", { className: "election-table-wrap" },
      h("table", { className: "election-state-table" },
        h("caption", { className: "visually-hidden" }, "Apuração do segundo turno para presidente por unidade da Federação"),
        h("thead", null, h("tr", null,
          h("th", { scope: "col" }, "UF"),
          h("th", { scope: "col" }, "Seções apuradas"),
          h("th", { scope: "col" }, "Candidato à frente"),
          h("th", { scope: "col" }, "Margem (p.p.)"))),
        h("tbody", null, rows))),
    h(ElectionMetadata, {
      definition: "Apuração presidencial recortada pela unidade da Federação.",
      unit: "Percentual de seções, votos e pontos percentuais.",
      period: "Segundo turno de 2026; os valores serão preenchidos quando o TSE publicar esses arquivos.",
      notes: "A margem corresponde à diferença entre os percentuais dos dois candidatos mais votados no mesmo recorte, calculada sobre votos válidos. Nenhuma liderança é exibida antes de haver dados do segundo turno.",
    }));
}
