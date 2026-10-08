import {
  electionHashForCoverage,
  formatElectionInteger,
  formatElectionPercent,
  TSE_RESULTS_URL,
} from "./elections.js";

const html = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

function candidateInitials(candidate) {
  return String(candidate?.name || "TSE").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR");
}

function renderCandidatePortrait(candidate, size = "") {
  const initials = html(candidateInitials(candidate));
  const portrait = candidate?.photoUrl
    ? `<img class="election-candidate-photo" src="${html(candidate.photoUrl)}" alt="Retrato oficial de ${html(candidate.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-election-photo><span class="election-candidate-photo-fallback" aria-hidden="true" hidden>${initials}</span>`
    : `<span class="election-candidate-photo-fallback" aria-hidden="true">${initials}</span>`;
  return `<span class="election-candidate-portrait ${html(size)}">${portrait}</span>`;
}

export function renderElectionMetadata({
  definition,
  unit,
  period,
  sourceUrl = TSE_RESULTS_URL,
  publishedAt,
  frequency = "Durante a totalização, conforme atualização dos arquivos do TSE.",
  notes,
}) {
  return `<details class="election-method">
    <summary>Definição, fonte e método</summary>
    <dl class="election-metadata-list">
      <div><dt>Definição</dt><dd>${html(definition)}</dd></div>
      <div><dt>Unidade</dt><dd>${html(unit)}</dd></div>
      <div><dt>Período</dt><dd>${html(period)}</dd></div>
      <div><dt>Fonte</dt><dd><a href="${html(sourceUrl)}" target="_blank" rel="noopener noreferrer">Resultados oficiais do TSE <span aria-hidden="true">↗</span></a></dd></div>
      <div><dt>Publicação do arquivo</dt><dd>${html(publishedAt || "Ainda não disponível")}</dd></div>
      <div><dt>Frequência esperada</dt><dd>${html(frequency)}</dd></div>
      <div class="election-metadata-wide"><dt>Notas metodológicas</dt><dd>${html(notes)}</dd></div>
    </dl>
  </details>`;
}

export function renderCandidatePair(candidates, {
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
    ? `<div class="election-candidate-grid">${[0, 1].map((index) => {
      const candidate = availableCandidates[index];
      return `<article class="election-candidate-card">
        <span class="election-candidate-order">Candidato ${index + 1}</span>
        <div class="election-candidate-heading">${renderCandidatePortrait(candidate)}<div><h3>${html(candidate?.name || "Aguardando dado oficial")}</h3><p>${html(candidate?.party || "Partido não informado")}</p></div></div>
        <div class="election-candidate-total"><strong>${candidate ? formatElectionInteger(candidate.votes) : "—"}</strong><span>votos</span></div>
        <div class="election-candidate-percent">${candidate ? formatElectionPercent(candidate.percent) : "—"} <span>dos votos válidos</span></div>
        ${candidate?.status ? `<span class="election-candidate-status">${html(candidate.status)}</span>` : ""}
      </article>`;
    }).join("")}</div>`
    : `<div class="election-empty-state"><strong>Sem resultado disponível</strong><p>${html(emptyMessage)}</p></div>`;

  return `<section class="panel election-block">
    <div class="panel-head"><div><div class="section-kicker">${html(eyebrow)}</div><h2>${html(title)}</h2></div><span class="quiet-badge">${html(resultLabel)}</span></div>
    ${context ? `<p class="panel-intro">${html(context)}</p>` : ""}
    ${pair}
    ${renderElectionMetadata({
      definition: "Votação nominal dos candidatos na abrangência indicada.",
      unit: "Votos e percentual dos votos válidos.",
      period: period || "Primeiro turno de 2026, usado apenas como referência.",
      sourceUrl: sourceUrl || TSE_RESULTS_URL,
      publishedAt,
      frequency,
      notes: "O percentual dos votos válidos exclui votos em branco e nulos. Os números desta seção são do primeiro turno e não representam a apuração do segundo turno.",
    })}
  </section>`;
}

export function renderCandidateResultsTable(candidates, {
  title = "Candidaturas e votação",
  office = "Presidência",
  sourceUrl = TSE_RESULTS_URL,
  publishedAt,
  frequency = "Arquivo final do primeiro turno; sem atualização periódica prevista.",
  period = "Primeiro turno de 2026.",
  collapsed = false,
} = {}) {
  const rows = (candidates || []).map((candidate, index) => `<tr>
    <td class="election-photo-cell">${renderCandidatePortrait(candidate, "election-candidate-portrait-small")}</td>
    <th scope="row"><span class="election-candidate-rank">${index + 1}º</span><strong>${html(candidate.name)}</strong><small>${html(candidate.party || "Partido não informado")}</small></th>
    <td>${formatElectionInteger(candidate.votes)}</td>
    <td>${formatElectionPercent(candidate.percent)}</td>
    <td>${html(candidate.status || "—")}</td>
  </tr>`).join("");
  const table = rows
    ? `<div class="election-table-wrap"><table class="election-results-table">
      <caption class="visually-hidden">${html(title)} · resultado oficial do primeiro turno</caption>
      <thead><tr><th scope="col"><span class="visually-hidden">Foto</span></th><th scope="col">Candidatura</th><th scope="col">Votos</th><th scope="col">Votos válidos</th><th scope="col">Situação no TSE</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`
    : `<div class="election-empty-state"><strong>Resultado ainda indisponível</strong><p>O arquivo oficial deste recorte não está disponível.</p></div>`;

  const content = `<div class="election-results-table-panel">${table}${renderElectionMetadata({
    definition: `Votação nominal de todas as candidaturas a ${office} no primeiro turno, na ordem decrescente de votos.`,
    unit: "Votos e percentual dos votos válidos.",
    period,
    sourceUrl,
    publishedAt,
    frequency,
    notes: "Os percentuais são os campos publicados pelo TSE. Votos brancos e nulos não compõem o denominador. As fotografias são os arquivos oficiais de candidaturas do TSE.",
  })}</div>`;
  return collapsed
    ? `<details class="panel election-block election-first-round-details"><summary>${html(title)} <span>${(candidates || []).length} candidaturas</span></summary>${content}</details>`
    : `<section class="panel election-block"><div class="panel-head"><div><div class="section-kicker">RESULTADO COMPLETO · 1º TURNO</div><h2>${html(title)}</h2></div><span class="quiet-badge">${(candidates || []).length} candidaturas</span></div>${content}</section>`;
}

export function renderFirstRoundResultsArchive(result, {
  title = "Resultado completo do primeiro turno",
  office = "Presidência",
  sourceUrl = TSE_RESULTS_URL,
  publishedAt,
  period = "Primeiro turno de 2026.",
} = {}) {
  const candidates = result?.candidates ?? [];
  const frequency = "Arquivo final do primeiro turno; sem atualização periódica prevista.";
  return `<details class="panel election-block election-first-round-details election-first-round-archive">
    <summary>${html(title)} <span>${candidates.length} candidaturas · totalizadores</span></summary>
    ${renderElectionTotalizers(result, { title: `Totalizadores · ${office}`, subtitle: `Totais oficiais do primeiro turno para ${office}; separados da apuração da segunda votação.`, period, frequency, sourceUrl })}
    ${renderCandidateResultsTable(candidates, { title: `Todas as candidaturas · ${office}`, office, sourceUrl, publishedAt, period, frequency, collapsed: false })}
  </details>`;
}

function electionMapBand(value) {
  if (!Number.isFinite(value)) return "is-waiting";
  if (value >= 80) return "progress-80";
  if (value >= 60) return "progress-60";
  if (value >= 40) return "progress-40";
  if (value >= 20) return "progress-20";
  return "progress-0";
}

export function renderElectionMap(features, states, liveStates = [], {
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
    ? `${formatElectionInteger(selectedResult.sections?.counted)} de ${formatElectionInteger(selectedResult.sections?.total)} seções totalizadas`
    : coverage === "BR" && hasOfficialRegionalData
      ? "Há arquivos estaduais; o total nacional ainda não está disponível"
      : "Pré-apuração · 0% demonstrativo, sem arquivo do 2º turno";
  const summaryLabel = coverage === "BR" ? "APURAÇÃO PRESIDENCIAL · BRASIL" : `APURAÇÃO PRESIDENCIAL · ${html(stateByUf.get(coverage)?.name || coverage)}`;
  const mapRegions = (features || []).map((feature) => {
    const state = stateByUf.get(feature.uf);
    if (!state) return "";
    const result = liveByUf.get(feature.uf);
    const rawStatePercent = result?.sections?.percent;
    const statePercent = rawStatePercent === null || rawStatePercent === undefined || rawStatePercent === "" ? null : Number(rawStatePercent);
    const band = electionMapBand(statePercent);
    const stateLabel = Number.isFinite(statePercent)
      ? `${state.name} (${state.uf}): ${formatElectionPercent(statePercent)} das seções apuradas no segundo turno.`
      : `${state.name} (${state.uf}): ${hasOfficialRegionalData ? "aguardando arquivo do TSE" : "pré-apuração visual em 0%; não é um dado oficial"}.`;
    return `<a class="election-map-link ${band} ${coverage === feature.uf ? "is-selected" : ""}" href="${electionHashForCoverage(feature.uf)}" aria-label="${html(stateLabel)}"><path class="election-map-state-shape" d="${feature.path}" fill-rule="evenodd"></path></a>`;
  }).join("");
  const callouts = (features || []).filter((feature) => feature.callout).map((feature) => `<path class="election-map-callout" d="${feature.callout}"></path>`).join("");
  const labels = (features || []).map((feature) => `<text class="election-map-label ${coverage === feature.uf ? "is-selected" : ""}" x="${feature.labelX}" y="${feature.labelY}" text-anchor="middle">${html(feature.uf)}</text>`).join("");
  const legend = hasOfficialRegionalData
    ? `<span class="election-map-scale" aria-label="Faixas de percentual das seções apuradas"><span><i class="progress-0"></i>0–19%</span><span><i class="progress-20"></i>20–39%</span><span><i class="progress-40"></i>40–59%</span><span><i class="progress-60"></i>60–79%</span><span><i class="progress-80"></i>80–100%</span></span>`
    : `<span class="election-map-legend-key" aria-hidden="true"></span><span>UF sem resultado publicado do 2º turno</span>`;
  const progressText = selectedResult && summaryPercent !== null
    ? `${formatElectionPercent(summaryPercent)} das seções apuradas`
    : selectedResult
      ? "Percentual de seções ainda não informado no arquivo oficial"
      : !showDemonstrativeZero
      ? "Total nacional aguardando arquivo oficial"
      : "0% · estado visual, não oficial";
  const intro = hasOfficialRegionalData
    ? "Tonalidades neutras representam o percentual de seções totalizadas, sem associação a candidaturas. Selecione uma UF para abrir o recorte."
    : "A apuração do segundo turno não começou. O 0% serve somente para visualizar o mapa antes da chegada dos arquivos oficiais; não representa uma medição do TSE.";

  return `<section class="panel election-block election-map-panel" aria-labelledby="election-map-title">
    <div class="panel-head"><div><div class="section-kicker">ACOMPANHAMENTO TERRITORIAL</div><h2 id="election-map-title">Apuração presidencial por UF</h2></div><span class="quiet-badge">${hasOfficialRegionalData ? "Seções totalizadas" : "Pré-apuração · visual inicial"}</span></div>
    <p class="panel-intro">${intro}</p>
    <div class="election-map-layout">
      <figure class="election-map-figure"><svg class="election-map-svg" viewBox="0 0 760 680" role="group" aria-labelledby="election-map-svg-title election-map-svg-description">
        <title id="election-map-svg-title">Mapa das 27 unidades da Federação com apuração presidencial do segundo turno</title>
        <desc id="election-map-svg-description">Cada unidade é um link para seu recorte estadual. Antes da publicação de resultados, o mapa mostra 0% apenas como estado visual demonstrativo. As cores, depois da apuração começar, indicam somente o percentual de seções totalizadas.</desc>
        <g class="election-map-regions">${mapRegions}</g><g class="election-map-callouts" aria-hidden="true">${callouts}</g><g class="election-map-labels" aria-hidden="true">${labels}</g>
      </svg><figcaption>${legend}</figcaption></figure>
      <aside class="election-map-summary" aria-label="Resumo de apuração nesta abrangência">
        <span class="section-kicker">${summaryLabel}</span><strong>${summaryPercent === null ? "—" : formatElectionPercent(summaryPercent)}</strong><span class="election-map-progress-label">${html(progressText)}</span>
        <div class="election-map-progress" ${summaryPercent === null ? `role="img" aria-label="${html(progressText)}"` : `role="progressbar" aria-label="Percentual de seções presidenciais apuradas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${summaryPercent}" aria-valuetext="${html(progressText)}"`}><span style="width:${summaryPercent ?? 0}%"></span></div>
        <small>${html(sectionLabel)}</small>
        <p>${coverage === "BR" ? "O total nacional inclui o voto no exterior; o mapa separa as 27 UFs." : "Selecione outra UF no mapa ou no seletor para comparar recortes."}</p>
      </aside>
    </div>
    ${renderElectionMetadata({
      definition: "Percentual de seções eleitorais totalizadas para presidente no segundo turno, por unidade da Federação.",
      unit: "Percentual de seções, de 0% a 100%.",
      period: "Segundo turno de 2026.",
      publishedAt: selectedResult?.publishedDate && selectedResult?.publishedTime ? `${selectedResult.publishedDate} às ${selectedResult.publishedTime}` : null,
      notes: hasOfficialRegionalData ? "O percentual usa seções totalizadas sobre o total de seções informado pelo TSE. O exterior integra o total nacional presidencial, mas não corresponde a uma UF." : "O 0% exibido é um marcador demonstrativo da interface antes do primeiro arquivo oficial do segundo turno; nenhum total de votos ou seções foi inferido. O exterior integra o total nacional presidencial, mas não corresponde a uma UF.",
    })}
  </section>`;
}

export function renderGovernorFirstRoundResults(referenceStates) {
  const confirmed = (referenceStates || []).filter((state) => state.governor?.status === "official" && state.governor.hasRunoff === true);
  if (!confirmed.length) return "";
  const cards = confirmed.map((state) => `<article class="election-governor-result">
    <div class="election-governor-result-head"><div><span class="section-kicker">1º TURNO · GOVERNADOR</span><h3>${html(state.name)} <span>(${html(state.uf)})</span></h3><small class="election-governor-source">Carimbo do arquivo: ${html(state.governor.summary?.publishedDate || "data não informada")}${state.governor.summary?.publishedTime ? ` às ${html(state.governor.summary.publishedTime)}` : ""} · <a href="${html(state.governor.sourceUrl || TSE_RESULTS_URL)}" target="_blank" rel="noopener noreferrer">fonte TSE ↗</a></small></div><a href="${electionHashForCoverage(state.uf)}" aria-label="Abrir apuração em ${html(state.name)}">Ver UF <span aria-hidden="true">→</span></a></div>
    <ol>${state.governor.candidates.slice(0, 2).map((candidate) => `<li>${renderCandidatePortrait(candidate, "election-candidate-portrait-small")}<span class="election-governor-candidate-name"><strong>${html(candidate.name)}</strong><small>${html(candidate.party || "Partido não informado")}</small></span><span class="election-governor-candidate-vote"><strong>${formatElectionInteger(candidate.votes)}</strong><small>${formatElectionPercent(candidate.percent)}</small></span></li>`).join("")}</ol>
    ${renderFirstRoundResultsArchive(state.governor.summary, { title: `Resultado completo · ${state.name}`, office: `Governo de ${state.name}`, sourceUrl: state.governor.sourceUrl, publishedAt: state.governor.summary?.publishedDate && state.governor.summary?.publishedTime ? `${state.governor.summary.publishedDate} às ${state.governor.summary.publishedTime}` : null, period: `Primeiro turno de 2026 · ${state.name}.` })}
  </article>`).join("");
  return `<section class="panel election-block election-governor-first-round"><div class="panel-head"><div><div class="section-kicker">REFERÊNCIA OFICIAL · 1º TURNO</div><h2>Governos estaduais com segundo turno</h2></div><span class="quiet-badge">${confirmed.length} UFs · derivadas do TSE</span></div><p class="panel-intro">Votos e percentuais são da primeira votação e contextualizam as disputas estaduais. A classificação dos estados vem dos arquivos oficiais; nenhuma UF foi fixada no código.</p><div class="election-governor-result-grid">${cards}</div>${renderElectionMetadata({ definition: "Dois primeiros candidatos nas UFs em que o TSE confirmou segundo turno para governador.", unit: "Votos e percentual dos votos válidos.", period: "Primeiro turno de 2026; resultados totalizados.", publishedAt: "Data e hora variam por arquivo estadual; cada cartão liga ao arquivo correspondente.", frequency: "Arquivo final do primeiro turno; sem atualização periódica prevista.", notes: "Esta lista inclui apenas disputas estaduais derivadas dos resultados oficiais. Votos válidos excluem brancos e nulos. Fotos são servidas pelos arquivos oficiais do TSE." })}</section>`;
}

export function renderElectionTotalizers(result, {
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
    { label: "Seções apuradas", value: result ? formatElectionPercent(sections.percent) : "—", detail: result ? `${formatElectionInteger(sections.counted)} de ${formatElectionInteger(sections.total)} seções` : "Aguardando totalização" },
    { label: "Votos válidos", value: result ? formatElectionInteger(votes.valid) : "—", detail: "Candidaturas válidas" },
    { label: "Votos em branco", value: result ? formatElectionInteger(votes.blank) : "—", detail: "Total oficial" },
    { label: "Votos nulos", value: result ? formatElectionInteger(votes.null) : "—", detail: "Inclui nulos técnicos, quando informados" },
    { label: "Comparecimento", value: result ? formatElectionInteger(electors.present) : "—", detail: "Eleitoras e eleitores presentes" },
    { label: "Abstenção", value: result ? formatElectionInteger(electors.absent) : "—", detail: "Eleitoras e eleitores ausentes" },
  ];

  return `<section class="panel election-block">
    <div class="panel-head"><div><div class="section-kicker">TOTALIZAÇÃO</div><h2>${html(title)}</h2></div><span class="quiet-badge">${result ? (result.finalized ? "Totalização final" : "Em apuração") : "Sem resultado do 2º turno"}</span></div>
    ${subtitle ? `<p class="panel-intro">${html(subtitle)}</p>` : ""}
    <div class="election-metric-grid">${metrics.map((metric) => `<article class="election-metric"><span>${html(metric.label)}</span><strong>${html(metric.value)}</strong><small>${html(metric.detail)}</small></article>`).join("")}</div>
    ${renderElectionMetadata({
      definition: "Totais oficiais do arquivo de resultado unificado para a abrangência selecionada.",
      unit: "Seções, votos e eleitoras ou eleitores.",
      period,
      sourceUrl: result?.sourceUrl || sourceUrl || TSE_RESULTS_URL,
      publishedAt: result?.publishedDate && result?.publishedTime ? `${result.publishedDate} às ${result.publishedTime} (horário informado no arquivo do TSE)` : null,
      frequency,
      notes: "Percentuais de candidatos usam votos válidos como denominador. Votos válidos excluem brancos e nulos. Valores não publicados permanecem vazios.",
    })}
  </section>`;
}

export function renderNoGovernorRunoffNotice({ uf, stateName, sourceUrl, publishedAt } = {}) {
  return `<section class="panel election-block election-governor-unavailable"><div class="section-kicker">GOVERNO ESTADUAL · ${html(uf)}</div><h2>Este estado não tem segundo turno para governador</h2><p>O resultado oficial do primeiro turno indica maioria absoluta dos votos válidos. A página mantém o acompanhamento presidencial para ${html(stateName || "esta unidade da Federação")}.</p>${renderElectionMetadata({ definition: "A existência de segundo turno é derivada da votação oficial para governador no primeiro turno.", unit: "Percentual de votos válidos.", period: "Primeiro turno de 2026.", sourceUrl, publishedAt, frequency: "Arquivo final do primeiro turno; sem atualização periódica prevista.", notes: "Há segundo turno quando nenhuma candidatura obtém mais da metade dos votos válidos. Votos em branco e nulos ficam fora desse cálculo." })}</section>`;
}

export function renderElectionStatesTable(states, liveStates = []) {
  const liveByUf = new Map((liveStates || []).map((state) => [state.uf, state.president]));
  const rows = states.map((state) => {
    const result = liveByUf.get(state.uf);
    const candidates = result?.candidates || [];
    const leader = candidates[0];
    const next = candidates[1];
    const margin = leader && next && leader.percent !== null && next.percent !== null
      ? `${formatElectionPercent(leader.percent - next.percent).replace("%", "")} p.p.`
      : "—";
    return `<tr>
      <th scope="row"><a href="${electionHashForCoverage(state.uf)}">${html(state.uf)}<span class="visually-hidden"> — ${html(state.name)}</span></a></th>
      <td>${result ? formatElectionPercent(result.sections.percent) : "—"}</td>
      <td>${html(leader?.name || "—")}</td>
      <td>${html(margin)}</td>
    </tr>`;
  }).join("");

  return `<section class="panel election-block">
    <div class="panel-head"><div><div class="section-kicker">RECORTE TERRITORIAL</div><h2>Presidente por unidade da Federação</h2></div><span class="quiet-badge">27 UFs</span></div>
    <p class="panel-intro">Cada linha abre a visão estadual. Os campos do segundo turno permanecem vazios até a publicação oficial dos resultados.</p>
    <div class="election-table-wrap"><table class="election-state-table">
      <caption class="visually-hidden">Apuração do segundo turno para presidente por unidade da Federação</caption>
      <thead><tr><th scope="col">UF</th><th scope="col">Seções apuradas</th><th scope="col">Candidato à frente</th><th scope="col">Margem (p.p.)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${renderElectionMetadata({
      definition: "Apuração presidencial recortada pela unidade da Federação.",
      unit: "Percentual de seções, votos e pontos percentuais.",
      period: "Segundo turno de 2026; os valores serão preenchidos quando o TSE publicar esses arquivos.",
      notes: "A margem corresponde à diferença entre os percentuais dos dois candidatos mais votados no mesmo recorte, calculada sobre votos válidos. Nenhuma liderança é exibida antes de haver dados do segundo turno.",
    })}
  </section>`;
}
