import {
  electionHashForCoverage,
  formatElectionInteger,
  formatElectionPercent,
  TSE_RESULTS_URL,
} from "./elections.js";

const html = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

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
  period,
  resultLabel = "Referência do primeiro turno",
} = {}) {
  const availableCandidates = (candidates || []).slice(0, 2);
  const pair = availableCandidates.length
    ? `<div class="election-candidate-grid">${[0, 1].map((index) => {
      const candidate = availableCandidates[index];
      return `<article class="election-candidate-card">
        <span class="election-candidate-order">Candidato ${index + 1}</span>
        <h3>${html(candidate?.name || "Aguardando dado oficial")}</h3>
        <p>${html(candidate?.party || "Partido não informado")}</p>
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
      notes: "O percentual dos votos válidos exclui votos em branco e nulos. Os números desta seção são do primeiro turno e não representam a apuração do segundo turno.",
    })}
  </section>`;
}

export function renderElectionTotalizers(result, {
  title,
  subtitle,
  period = "Segundo turno de 2026",
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
      sourceUrl: result?.sourceUrl || TSE_RESULTS_URL,
      publishedAt: result?.publishedDate && result?.publishedTime ? `${result.publishedDate} às ${result.publishedTime} (horário informado no arquivo do TSE)` : null,
      notes: "Percentuais de candidatos usam votos válidos como denominador. Votos válidos excluem brancos e nulos. Valores não publicados permanecem vazios.",
    })}
  </section>`;
}

export function renderNoGovernorRunoffNotice({ uf, stateName, sourceUrl, publishedAt } = {}) {
  return `<section class="panel election-block election-governor-unavailable"><div class="section-kicker">GOVERNO ESTADUAL · ${html(uf)}</div><h2>Este estado não tem segundo turno para governador</h2><p>O resultado oficial do primeiro turno indica maioria absoluta dos votos válidos. A página mantém o acompanhamento presidencial para ${html(stateName || "esta unidade da Federação")}.</p>${renderElectionMetadata({ definition: "A existência de segundo turno é derivada da votação oficial para governador no primeiro turno.", unit: "Percentual de votos válidos.", period: "Primeiro turno de 2026.", sourceUrl, publishedAt, notes: "Há segundo turno quando nenhuma candidatura obtém mais da metade dos votos válidos. Votos em branco e nulos ficam fora desse cálculo." })}</section>`;
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
