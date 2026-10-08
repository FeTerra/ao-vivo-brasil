import { modules, indicators, updates, proposals, states } from "./data.js";
import { stateMapFeatures } from "./state-map.js";
import {
  electionCoverageFromHash,
  electionHashForCoverage,
  electionPhase,
  formatBrasiliaDateTime,
  RUNOFF_DATE,
} from "./elections.js";
import {
  renderCandidatePair,
  renderElectionMetadata,
  renderNoGovernorRunoffNotice,
  renderElectionStatesTable,
  renderElectionTotalizers,
} from "./election-components.js";
import { loadElectionSnapshot } from "./services/tse-results.js";

const byId = (id) => document.getElementById(id);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const moduleFor = (id) => modules.find((item) => item.id === id);
const indicatorFor = (id) => indicators.find((item) => item.id === id);
const formatValue = (indicator) => indicator.value === null || indicator.value === undefined ? "—" : `${indicator.value} ${indicator.unit}`;
const sourcePortals = [
  { match: "IBGE", name: "IBGE", url: "https://www.ibge.gov.br/" },
  { match: "Banco Central", name: "Banco Central do Brasil", url: "https://www.bcb.gov.br/" },
  { match: "Tesouro Nacional", name: "Tesouro Nacional", url: "https://www.gov.br/tesouronacional/pt-br" },
  { match: "Receita Federal", name: "Receita Federal", url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/dados-abertos/arrecadacao" },
  { match: "Ministério da Saúde", name: "Ministério da Saúde", url: "https://www.gov.br/saude/pt-br" },
  { match: "INEP", name: "INEP", url: "https://www.gov.br/inep/pt-br" },
  { match: "Ministério da Justiça", name: "Ministério da Justiça e Segurança Pública", url: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica" },
  { match: "Ministério do Trabalho", name: "Ministério do Trabalho e Emprego", url: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho" },
];
let currentView = "inicio";
let selectedUf = null;
let selectedElectionCoverage = "BR";
let electionRequestController = null;
let electionRequestSequence = 0;
let electionPollTimer = null;
let electionClockTimer = null;
const electionSnapshots = new Map();

function requestStateMarkup(state, detail = "") {
  const statesByType = {
    loading: { icon: "◌", role: "status", title: "Carregando série", message: detail || "Consultando a fonte oficial…" },
    empty: { icon: "—", role: "status", title: "Série ainda não disponível", message: detail || "A integração da fonte oficial está pendente." },
    error: { icon: "!", role: "alert", title: "Não foi possível atualizar", message: detail || "A fonte não respondeu. A ficha preserva a última data conhecida, quando houver." },
  };
  const content = statesByType[state] ?? statesByType.empty;
  return `<div class="request-state request-state-${state}" role="${content.role}" aria-live="${state === "error" ? "assertive" : "polite"}"><span class="request-state-icon" aria-hidden="true">${content.icon}</span><strong>${escapeHtml(content.title)}</strong><span>${escapeHtml(content.message)}</span></div>`;
}

function updateSeriesState(state, detail = "") {
  byId("series-request-state").innerHTML = requestStateMarkup(state, detail);
}

function sourcePortalMarkup(indicator) {
  const portal = sourcePortals.find((item) => indicator.source.includes(item.match));
  if (!portal) return "";
  return `<a class="official-link" href="${portal.url}" target="_blank" rel="noopener noreferrer">Visitar portal do ${escapeHtml(portal.name)} <span aria-hidden="true">↗</span></a><small class="official-link-note">Portal institucional da fonte prevista; link da série específica pendente.</small>`;
}

function renderNavigation() {
  byId("main-nav").innerHTML = [
    `<a class="nav-item ${currentView === "inicio" ? "is-active" : ""}" href="#inicio" ${currentView === "inicio" ? 'aria-current="page"' : ""}><span class="nav-icon nav-overview" aria-hidden="true">⌂</span><span>Visão geral</span><span class="nav-arrow" aria-hidden="true">↗</span></a>`,
    ...modules.map((item) => `<a class="nav-item ${currentView === item.id ? "is-active" : ""}" href="#${item.id}" ${currentView === item.id ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.label)}</span><span class="nav-arrow" aria-hidden="true">↗</span></a>`),
    `<a class="nav-item nav-elections ${currentView === "eleicoes" ? "is-active" : ""}" href="#eleicoes/segundo-turno" ${currentView === "eleicoes" ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">◉</span><span>Eleições 2026</span><span class="nav-arrow" aria-hidden="true">↗</span></a>`,
    `<a class="nav-item nav-legislative" href="#legislativo"><span class="nav-icon" aria-hidden="true">≋</span><span>Pautas legislativas</span><span class="nav-arrow" aria-hidden="true">↗</span></a>`,
  ].join("");
}

function renderIndicatorCard(indicator, compact = false) {
  const module = moduleFor(indicator.module);
  return `<article class="indicator-card ${compact ? "indicator-card-compact" : ""}">
    <div class="indicator-top"><span class="indicator-category">${escapeHtml(module?.label ?? "Indicador")}</span><span class="indicator-pip" aria-hidden="true"></span></div>
    <div class="indicator-name">${escapeHtml(indicator.shortName)}</div>
    <div class="indicator-value" aria-label="Valor não disponível">${escapeHtml(formatValue(indicator))}</div>
    <div class="indicator-unit">${escapeHtml(indicator.unit)} <span aria-hidden="true">·</span> ${escapeHtml(indicator.period)}</div>
    <div class="indicator-source"><span class="source-mark" aria-hidden="true">↗</span>${escapeHtml(indicator.source)}</div>
    <button class="card-link" data-indicator="${escapeHtml(indicator.id)}" aria-label="Consultar ficha do indicador ${escapeHtml(indicator.shortName)}">Ver ficha do indicador <span aria-hidden="true">→</span></button>
  </article>`;
}

function renderIndicators() {
  const featured = ["ipca", "selic", "desocupacao", "arrecadacao"].map(indicatorFor).filter(Boolean);
  byId("indicator-grid").innerHTML = featured.map((indicator) => renderIndicatorCard(indicator)).join("");
}

function renderUpdates() {
  byId("update-list").innerHTML = updates.map((item, index) => `<li class="update-item"><span class="update-index">0${index + 1}</span><div><span class="update-type">${escapeHtml(item.type)}</span><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.detail)}</p></div><span class="update-bullet" aria-hidden="true"></span></li>`).join("");
}

function proposalMarkup(proposal) {
  return `<button class="proposal-card" data-proposal="${escapeHtml(proposal.id)}" aria-label="Ver exemplo fictício de proposta: ${escapeHtml(proposal.subject)}">
    <span class="proposal-house">${escapeHtml(proposal.house)}</span><span class="proposal-main"><strong>${escapeHtml(proposal.subject)}</strong><span>${escapeHtml(proposal.stage)}</span></span><span class="proposal-arrow" aria-hidden="true">↗</span>
    <span class="proposal-meta"><span class="proposal-code">${escapeHtml(proposal.code)}</span><span>Última movimentação: não informada</span></span>
  </button>`;
}

function renderProposals() {
  byId("proposal-list").innerHTML = proposals.map(proposalMarkup).join("");
}

function renderTopics() {
  byId("topic-list").innerHTML = modules.map((item) => `<a class="topic-link" href="#${escapeHtml(item.id)}"><span class="topic-icon" aria-hidden="true">${escapeHtml(item.icon)}</span><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.scope)}</small></span><span class="topic-arrow" aria-hidden="true">↗</span></a>`).join("");
}

function renderDashboard() {
  byId("dashboard-view").hidden = false;
  byId("module-view").hidden = true;
  currentView = "inicio";
  updateSeriesState("empty");
  renderNavigation();
}

function renderStateMap() {
  const selected = states.find((state) => state.uf === selectedUf);
  const stateByUf = new Map(states.map((state) => [state.uf, state]));
  return `<div class="state-explorer">
    <div class="state-map-card panel"><div class="panel-head"><div><div class="section-kicker">UNIDADES DA FEDERAÇÃO</div><h2>Selecione um estado</h2></div><span class="quiet-badge">Sem dados temáticos</span></div>
      <p class="panel-intro">Limites estaduais baseados na malha geográfica do IBGE. A seleção demonstra o recorte territorial e não representa resultados.</p>
      <div class="state-map">
        <svg class="state-map-svg" viewBox="0 0 760 680" role="group" aria-labelledby="state-map-title state-map-description">
          <title id="state-map-title">Mapa do Brasil por unidade da Federação</title>
          <desc id="state-map-description">Mapa esquemático com os limites das 27 unidades da Federação. Selecione uma área para consultar a disponibilidade de dados.</desc>
          <g class="state-map-regions">${stateMapFeatures.map((feature) => {
            const state = stateByUf.get(feature.uf);
            return `<g class="state-region ${selectedUf === feature.uf ? "is-selected" : ""}" data-uf="${feature.uf}" role="button" tabindex="0" aria-pressed="${selectedUf === feature.uf}" aria-label="${escapeHtml(state.name)}, ${feature.uf}"><path class="state-shape" d="${feature.path}" fill-rule="evenodd"></path></g>`;
          }).join("")}</g>
          <g class="state-map-callouts" aria-hidden="true">${stateMapFeatures.filter((feature) => feature.callout).map((feature) => `<path class="state-callout-line" d="${feature.callout}"></path>`).join("")}</g>
          <g class="state-map-labels" aria-hidden="true">${stateMapFeatures.map((feature) => `<text class="state-label ${selectedUf === feature.uf ? "is-selected" : ""}" x="${feature.labelX}" y="${feature.labelY}" text-anchor="middle">${feature.uf}</text>`).join("")}</g>
        </svg>
      </div>
      <div class="map-caption"><span class="map-key" aria-hidden="true"></span><span>27 UFs · seleção demonstrativa, sem valores</span><a href="https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html" target="_blank" rel="noopener noreferrer">Malha territorial do IBGE <span aria-hidden="true">↗</span></a></div>
    </div>
    <aside class="state-detail panel" aria-live="polite"><div class="section-kicker">RECORTE ESTADUAL</div><div class="state-detail-code">${selected ? escapeHtml(selected.uf) : "BR"}</div><h2>${selected ? escapeHtml(selected.name) : "Brasil"}</h2><p>${selected ? "A consulta estadual será exibida quando uma série oficial comparável estiver integrada." : "Selecione uma unidade da Federação para ver a disponibilidade do recorte."}</p><div class="state-empty"><span class="empty-dot" aria-hidden="true"></span><span>Sem indicadores estaduais integrados</span></div><div class="state-note">Comparações só serão exibidas com definições e períodos compatíveis.</div></aside>
  </div>`;
}

function renderPolicyModule() {
  return `<section class="module-extra panel"><div class="panel-head"><div><div class="section-kicker">TRAMITAÇÃO</div><h2>Exemplos de pauta</h2></div><span class="fiction-badge"><span aria-hidden="true">◇</span> Itens fictícios</span></div><p class="panel-intro">Conteúdo fictício para visualizar a estrutura de listagem e linha do tempo. Não representa proposições, pessoas ou registros oficiais reais.</p><div class="proposal-list proposal-list-module">${proposals.map(proposalMarkup).join("")}</div></section>`;
}

function renderModule(id) {
  const item = moduleFor(id);
  if (!item) return renderDashboard();
  currentView = id;
  byId("dashboard-view").hidden = true;
  const view = byId("module-view");
  view.hidden = false;
  const indicatorItems = item.indicators.map(indicatorFor).filter(Boolean);
  view.innerHTML = `<section class="module-hero"><a class="back-link" href="#inicio"><span aria-hidden="true">←</span> Visão geral</a><div class="module-hero-label"><span class="module-icon-large" aria-hidden="true">${escapeHtml(item.icon)}</span><span>MÓDULO TEMÁTICO</span></div><h1>${escapeHtml(item.label)}<span>.</span></h1><p>${escapeHtml(item.description)}</p><div class="module-meta"><span><strong>Dados:</strong> integrações pendentes</span><span><strong>Período:</strong> varia por indicador</span></div></section>
    <section class="section-block module-indicators"><div class="section-heading"><div><div class="section-kicker">CATÁLOGO DO MÓDULO</div><h2>Indicadores disponíveis</h2><p class="section-description">Valores não exibidos até a integração da fonte e validação do período.</p></div><span class="quiet-badge">${indicatorItems.length ? `${indicatorItems.length} fichas preparadas` : "Catálogo em preparação"}</span></div>${indicatorItems.length ? `<div class="indicator-grid">${indicatorItems.map((indicator) => renderIndicatorCard(indicator, true)).join("")}</div>` : `<div class="empty-catalog panel"><span class="empty-catalog-icon" aria-hidden="true">§</span><div><h3>Acompanhe o processo, passo a passo.</h3><p>As fichas legislativas vão apontar para a proposta, sua etapa, as movimentações oficiais e os documentos de origem.</p></div><span class="fiction-badge">Amostras abaixo são fictícias</span></div>`}</section>
    ${id === "politica" ? renderPolicyModule() : ""}
    ${id === "estados" ? renderStateMap() : ""}
    <section class="module-method"><div class="section-kicker">CRITÉRIO DE LEITURA</div><p>${id === "estados" ? "Uma comparação territorial só faz sentido quando período, unidade e definição são equivalentes." : "Cada ficha explica definição, unidade, período, fonte, publicação, frequência e limites metodológicos."}</p><a href="#transparencia">Ver princípios de transparência <span aria-hidden="true">→</span></a></section>`;
  renderNavigation();
  byId("conteudo").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function electionCoverageLabel(coverage) {
  if (coverage === "BR") return "Brasil";
  if (coverage === "EX") return "Exterior";
  return states.find((state) => state.uf === coverage)?.name ?? coverage;
}

function electionSelectorMarkup(coverage) {
  const stateOptions = [...states]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((state) => `<option value="${state.uf}" ${coverage === state.uf ? "selected" : ""}>${escapeHtml(state.name)} (${state.uf})</option>`)
    .join("");
  return `<label class="election-coverage-control" for="election-coverage"><span>Abrangência</span><select id="election-coverage" name="abrangencia" aria-label="Selecione a abrangência da apuração"><option value="BR" ${coverage === "BR" ? "selected" : ""}>Brasil</option>${stateOptions}<option value="EX" ${coverage === "EX" ? "selected" : ""}>Exterior · Presidente</option></select></label>`;
}

function electionCountdownMarkup() {
  return `<div class="election-countdown" id="election-countdown" aria-live="polite"><span class="section-kicker">SEGUNDO TURNO</span><strong>25 de outubro de 2026</strong><span>Votação das 8h às 17h · horário de Brasília</span><span class="election-countdown-remaining"></span></div>`;
}

function electionSkeletonMarkup() {
  return `<div class="election-skeleton" role="status" aria-live="polite"><span>Consultando arquivos oficiais do TSE…</span><div class="election-skeleton-row"><i></i><i></i></div><i class="election-skeleton-wide"></i></div>`;
}

function electionFailureMarkup(message) {
  return `<div class="election-source-error" role="alert"><span class="election-alert-symbol" aria-hidden="true">!</span><div><strong>Não foi possível atualizar os dados oficiais.</strong><p>${escapeHtml(message || "A conexão com a fonte do TSE falhou. Se houver uma resposta válida anterior, ela será preservada.")}</p><button class="button button-outline" type="button" data-election-retry>Tentar novamente</button></div></div>`;
}

function renderGovernorRunoffLinks(referenceStates) {
  const confirmed = (referenceStates || []).filter((item) => item.governor?.status === "official" && item.governor.hasRunoff === true);
  if (!confirmed.length) {
    return `<div class="election-empty-state"><strong>Recortes estaduais em validação</strong><p>As unidades com segundo turno para governador são calculadas a partir dos votos válidos publicados pelo TSE; não há uma lista fixa nesta página.</p></div>`;
  }
  return `<ul class="election-runoff-list">${confirmed.map((item) => `<li><a href="${electionHashForCoverage(item.uf)}"><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(item.uf)}</strong><span class="election-runoff-arrow" aria-hidden="true">→</span></a></li>`).join("")}</ul>`;
}

function renderElectionStatePage(snapshot, coverage) {
  const reference = snapshot.references ?? {};
  const live = snapshot.live ?? {};
  const stateReference = reference.states?.find((item) => item.uf === coverage);
  const governor = stateReference?.governor;
  const governorLive = live.governor;
  const presidentReference = reference.president;
  const presidentLive = live.president;
  const stateName = electionCoverageLabel(coverage);

  let governorPanel;
  if (governor?.status === "official" && governor.hasRunoff === false) {
    governorPanel = renderNoGovernorRunoffNotice({
      uf: coverage,
      stateName,
      sourceUrl: governor.sourceUrl,
      publishedAt: governor.publication ? `${governor.publication.date} às ${governor.publication.time}` : null,
    });
  } else if (governor?.status === "official" && governor.hasRunoff === true) {
    governorPanel = `${renderCandidatePair(governorLive?.candidates, { title: `Governador · ${coverage}`, eyebrow: "APURAÇÃO DO 2º TURNO", context: governorLive ? "Resultados oficiais da segunda votação nesta UF." : "A disputa para governador nesta UF foi identificada a partir do primeiro turno; o resultado do segundo turno ainda não foi publicado.", emptyMessage: "A apuração do segundo turno para governador ainda não começou ou o arquivo oficial desta UF ainda não está disponível.", sourceUrl: governorLive?.sourceUrl, publishedAt: governorLive?.publishedDate && governorLive?.publishedTime ? `${governorLive.publishedDate} às ${governorLive.publishedTime}` : null, period: "Segundo turno de 2026.", resultLabel: governorLive ? (governorLive.finalized ? "Totalização final" : "Em apuração") : "Aguardando votação" })}${renderElectionTotalizers(governorLive, { title: `Indicadores da apuração para governador · ${coverage}`, subtitle: "Totalizadores do segundo turno, separados da referência do primeiro turno." })}${renderCandidatePair(governor.candidates, { title: `Candidaturas ao governo de ${stateName}`, eyebrow: "GOVERNADOR · REFERÊNCIA DO 1º TURNO", context: "Candidaturas e números abaixo são do primeiro turno. A apuração desta segunda votação permanece em bloco separado.", sourceUrl: governor.sourceUrl, publishedAt: governor.publication ? `${governor.publication.date} às ${governor.publication.time}` : null, period: "Primeiro turno de 2026; referência oficial para a disputa estadual.", resultLabel: "Referência do 1º turno" })}`;
  } else {
    governorPanel = `<section class="panel election-block"><div class="section-kicker">GOVERNO ESTADUAL · ${escapeHtml(coverage)}</div><h2>Elegibilidade aguardando validação oficial</h2><p>Este estado não será classificado até que o resultado oficial do primeiro turno para governador esteja disponível e totalizado.</p><div class="election-empty-state"><strong>Sem conclusão para este recorte</strong><p>Uma falha ou ausência de arquivo não será interpretada como confirmação ou ausência de segundo turno.</p></div>${renderElectionMetadata({ definition: "Segundo turno estadual quando nenhuma candidatura ultrapassa 50% dos votos válidos no primeiro turno.", unit: "Votos válidos.", period: "Primeiro turno de 2026.", sourceUrl: governor?.sourceUrl, publishedAt: null, notes: "A situação estadual será derivada dos arquivos oficiais do TSE. Dados ausentes não são tratados como resultado negativo." })}</section>`;
  }

  return `<div class="election-live-grid">
    ${renderCandidatePair(presidentLive?.candidates, { title: `Presidente · ${stateName}`, eyebrow: "APURAÇÃO DO 2º TURNO", context: presidentLive ? `Resultados oficiais do segundo turno no recorte ${stateName}.` : "Os números abaixo da referência não são resultados do segundo turno.", emptyMessage: "A apuração presidencial do segundo turno ainda não começou ou o arquivo oficial deste recorte ainda não está disponível.", sourceUrl: presidentLive?.sourceUrl, publishedAt: presidentLive?.publishedDate && presidentLive?.publishedTime ? `${presidentLive.publishedDate} às ${presidentLive.publishedTime}` : null, period: "Segundo turno de 2026.", resultLabel: presidentLive ? (presidentLive.finalized ? "Totalização final" : "Em apuração") : "Aguardando votação" })}
    ${renderElectionTotalizers(presidentLive, { title: `Indicadores presidenciais · ${stateName}`, subtitle: "Os totalizadores permanecem vazios até a divulgação do segundo turno pelo TSE." })}
    ${renderCandidatePair(presidentReference?.candidates, { title: "Candidaturas presidenciais", eyebrow: "PRESIDENTE · REFERÊNCIA DO 1º TURNO", context: coverage === "EX" ? "Referência nacional do primeiro turno. No segundo turno, esta abrangência exibe apenas a disputa presidencial." : "Votação de primeiro turno para presidente neste recorte estadual.", sourceUrl: presidentReference?.sourceUrl, publishedAt: presidentReference?.publishedDate && presidentReference?.publishedTime ? `${presidentReference.publishedDate} às ${presidentReference.publishedTime}` : null, period: "Primeiro turno de 2026; referência oficial.", resultLabel: "Referência do 1º turno"})}
    ${coverage === "EX" ? `<section class="panel election-block"><div class="section-kicker">VOTO NO EXTERIOR</div><h2>Recorte presidencial</h2><p class="panel-intro">A abrangência Exterior está disponível para a disputa presidencial. Os campos específicos desse recorte serão preenchidos quando o arquivo correspondente do segundo turno estiver publicado e identificado na integração.</p>${renderElectionMetadata({ definition: "Votação presidencial por abrangência Exterior, conforme os arquivos de resultados do TSE.", unit: "Seções e votos.", period: "Segundo turno de 2026.", sourceUrl: presidentLive?.sourceUrl || presidentReference?.sourceUrl, publishedAt: null, notes: "O total nacional é apresentado separadamente; este recorte não deve ser somado novamente ao Brasil." })}</section>` : governorPanel}
  </div>`;
}

function renderElectionContent(snapshot, coverage) {
  if (!snapshot || snapshot.status === "error") return electionFailureMarkup(snapshot?.message || snapshot?.detail);

  const references = snapshot.references ?? {};
  const live = snapshot.live ?? {};
  const phase = electionPhase(new Date(), Boolean(live.finalized));
  const phaseLabels = {
    before: "Aguardando votação",
    voting: "Votação em andamento",
    counting: live.available ? "Em apuração" : "Aguardando totalização do TSE",
    final: "Apuração encerrada",
  };
  const staleNotice = snapshot.stale
    ? `<div class="election-stale-alert" role="alert"><strong>Dados desatualizados.</strong> ${escapeHtml(snapshot.message || "A última resposta válida foi preservada.")} <button class="inline-action" type="button" data-election-retry>Tentar novamente</button></div>`
    : "";
  const warning = `<div class="election-official-notice" role="status"><span aria-hidden="true">i</span><p><strong>Dados oficiais do TSE; podem mudar durante a apuração.</strong><br>Os valores de segundo turno ficam vazios até a publicação dos arquivos oficiais. Valores exibidos como referência estão identificados como primeiro turno.</p></div>`;
  const liveConfigurationNote = !live.configured
    ? `<div class="election-empty-state"><strong>Arquivos do segundo turno ainda não publicados</strong><p>O TSE disponibilizou os resultados do primeiro turno. O monitor começará a consultar os arquivos do segundo turno quando os códigos e arquivos oficiais dessa rodada forem publicados.</p></div>`
    : "";
  const referencePresident = references.president?.error ? [] : references.president?.candidates ?? [];
  const referencePresidentUrl = references.president?.sourceUrl;
  const publishedAt = references.president?.publishedDate && references.president?.publishedTime
    ? `${references.president.publishedDate} às ${references.president.publishedTime}`
    : null;
  const updatedLine = snapshot.checkedAt
    ? `Consulta ao TSE em ${formatBrasiliaDateTime(snapshot.checkedAt)}`
    : "Consulta à fonte ainda não confirmada";
  const retryHint = snapshot.status === "partial" ? `<p class="election-partial-hint">Alguns arquivos oficiais não responderam. As UFs sem arquivo disponível permanecem sem classificação.</p>` : "";

  let body;
  if (coverage === "BR") {
    body = `<div class="election-live-grid">
      ${renderCandidatePair(live.president?.candidates, { title: "Presidente · Brasil", eyebrow: "RESULTADO DO 2º TURNO", context: "Esta área mostra apenas os dados da segunda votação; nenhum resultado é estimado.", emptyMessage: "A apuração presidencial do segundo turno ainda não começou ou o arquivo oficial ainda não está disponível.", sourceUrl: live.president?.sourceUrl, publishedAt: live.president?.publishedDate && live.president?.publishedTime ? `${live.president.publishedDate} às ${live.president.publishedTime}` : null, period: "Segundo turno de 2026.", resultLabel: live.president ? (live.president.finalized ? "Totalização final" : "Em apuração") : "Aguardando votação" })}
      ${renderElectionTotalizers(live.president, { title: "Totalizadores nacionais", subtitle: "O total nacional da Presidência inclui a totalização das seções no exterior." })}
      ${renderCandidatePair(referencePresident, { title: "Candidaturas presidenciais habilitadas", eyebrow: "PRESIDENTE · REFERÊNCIA DO 1º TURNO", context: "Nomes, votos e percentuais abaixo correspondem ao primeiro turno e servem apenas como referência para a disputa." , sourceUrl: referencePresidentUrl, publishedAt, period: "Primeiro turno de 2026; referência oficial.", resultLabel: "Referência do 1º turno" })}
    </div>
    <section class="panel election-block"><div class="panel-head"><div><div class="section-kicker">GOVERNADORES</div><h2>Estados com segundo turno</h2></div><span class="quiet-badge">Derivado do 1º turno do TSE</span></div><p class="panel-intro">A relação é calculada por UF a partir da votação válida e só aparece quando o resultado oficial está totalizado.</p>${renderGovernorRunoffLinks(references.states)}${renderElectionMetadata({ definition: "Unidades em que nenhuma candidatura ao governo estadual obteve mais de 50% dos votos válidos no primeiro turno.", unit: "UFs com segundo turno para governador.", period: "Primeiro turno de 2026, totalização oficial.", sourceUrl: references.states?.find((state) => state.governor?.sourceUrl)?.governor?.sourceUrl, publishedAt: publishedAt, notes: "A lista não está codificada no site. Cada situação é derivada dos arquivos oficiais por UF; branco e nulo não integram os votos válidos." })}</section>
    ${renderElectionStatesTable(states, live.states)}
    ${liveConfigurationNote}`;
  } else {
    const selectedStateReference = references.states?.find((state) => state.uf === coverage)?.governor;
    const stateReferenceErrors = selectedStateReference?.error || references.president?.error;
    body = `${renderElectionStatePage(snapshot, coverage)}${liveConfigurationNote}${stateReferenceErrors ? `<p class="election-partial-hint">A integração não confirmou todos os arquivos desta abrangência; os dados ausentes continuam vazios.</p>` : ""}`;
  }

  return `<div class="election-content" data-phase="${phase}">
    <span id="election-data-announcement" class="visually-hidden" role="status" aria-live="polite"></span>
    ${staleNotice}${warning}${retryHint}
    <div class="election-status-line"><span class="election-status-pill">${escapeHtml(phaseLabels[phase])}</span><span id="election-updated-at">${escapeHtml(updatedLine)}</span></div>
    ${body}
    ${renderElectionMetadata({ definition: "Ciclo de acompanhamento da eleição presidencial e, quando houver, do segundo turno para governador.", unit: "Datas e horários em Brasília; votos, seções e percentuais conforme cada bloco.", period: "Segundo turno das Eleições 2026, em 25/10/2026.", sourceUrl: references.sourceUrl, publishedAt, frequency: live.configured ? "Consulta a cada 45 segundos durante a apuração, pausada quando a aba está oculta." : "Referência do primeiro turno consultada com cache; atualizações do segundo turno dependem da publicação de seus arquivos oficiais.", notes: "Votos válidos excluem brancos e nulos. A totalização presidencial nacional inclui o exterior; o recorte Exterior é apenas presidencial. Status de eleita ou eleito só é exibido quando vier do TSE." })}
  </div>`;
}

function refreshElectionCountdown() {
  const countdown = byId("election-countdown");
  if (!countdown) return;
  const start = new Date(`${RUNOFF_DATE}T08:00:00-03:00`);
  const difference = start.getTime() - Date.now();
  const phase = electionPhase(new Date());
  const label = phase === "before"
    ? `Faltam ${Math.max(0, Math.ceil(difference / 86400000))} dias para a votação`
    : phase === "voting" ? "Votação prevista até 17h · horário de Brasília" : "A votação terminou; a totalização segue o TSE";
  countdown.querySelector(".election-countdown-remaining").textContent = label;
}

function updateElectionPolling(snapshot) {
  window.clearInterval(electionPollTimer);
  if (currentView !== "eleicoes" || document.hidden || !snapshot?.live?.configured) return;
  const phase = electionPhase(new Date(), Boolean(snapshot.live.finalized));
  if (phase === "before" || phase === "voting" || phase === "final") return;
  electionPollTimer = window.setInterval(() => refreshElectionSnapshot(selectedElectionCoverage), 45000);
}

async function refreshElectionSnapshot(coverage = selectedElectionCoverage, refresh = false) {
  const container = byId("election-content");
  if (!container || currentView !== "eleicoes") return;
  const sequence = ++electionRequestSequence;
  electionRequestController?.abort();
  electionRequestController = new AbortController();
  let previous = electionSnapshots.get(coverage);
  if (!previous) {
    try {
      const stored = localStorage.getItem(`ao-vivo-brasil-election-${coverage}`);
      if (stored) {
        previous = JSON.parse(stored);
        electionSnapshots.set(coverage, previous);
      }
    } catch { /* armazenamento é opcional */ }
  }
  if (!previous) container.innerHTML = electionSkeletonMarkup();
  else container.innerHTML = renderElectionContent(previous, coverage);

  try {
    const snapshot = await loadElectionSnapshot(coverage, { signal: electionRequestController.signal, refresh });
    if (sequence !== electionRequestSequence || currentView !== "eleicoes" || selectedElectionCoverage !== coverage) return;
    const lastGood = snapshot.stale && previous?.references
      ? { ...previous, stale: true, status: "stale", message: snapshot.message || "A fonte falhou; a última resposta válida foi mantida.", lastCheckedAt: snapshot.checkedAt || null }
      : snapshot;
    electionSnapshots.set(coverage, lastGood);
    try { localStorage.setItem(`ao-vivo-brasil-election-${coverage}`, JSON.stringify(lastGood)); } catch { /* armazenamento é opcional */ }
    container.innerHTML = renderElectionContent(lastGood, coverage);
    const announcement = byId("election-data-announcement");
    if (announcement) announcement.textContent = lastGood.stale
      ? "Fonte do TSE indisponível. A última resposta válida foi mantida e marcada como desatualizada."
      : `Referências oficiais do primeiro turno atualizadas em ${formatBrasiliaDateTime(lastGood.checkedAt)}.`;
    updateElectionPolling(lastGood);
  } catch (error) {
    if (error.name === "AbortError" || sequence !== electionRequestSequence) return;
    if (!previous) {
      try {
        const stored = localStorage.getItem(`ao-vivo-brasil-election-${coverage}`);
        if (stored) electionSnapshots.set(coverage, JSON.parse(stored));
      } catch { /* armazenamento é opcional */ }
    }
    const lastKnown = electionSnapshots.get(coverage);
    if (lastKnown) {
      const stale = { ...lastKnown, stale: true, status: "stale", message: "A fonte falhou; a última resposta válida foi mantida." };
      container.innerHTML = renderElectionContent(stale, coverage);
      const announcement = byId("election-data-announcement");
      if (announcement) announcement.textContent = "A fonte do TSE falhou. A última resposta válida foi preservada como desatualizada.";
      updateElectionPolling(stale);
    } else container.innerHTML = electionFailureMarkup(error.message);
  }
}

function renderElectionPage(coverage) {
  window.clearInterval(electionPollTimer);
  selectedElectionCoverage = coverage;
  currentView = "eleicoes";
  byId("dashboard-view").hidden = true;
  const view = byId("module-view");
  view.hidden = false;
  const place = electionCoverageLabel(coverage);
  view.innerHTML = `<section class="election-page" aria-labelledby="election-page-title">
    <header class="module-hero election-hero"><a class="back-link" href="#inicio"><span aria-hidden="true">←</span> Visão geral</a><div class="module-hero-label"><span class="module-icon-large" aria-hidden="true">◉</span><span>ELEIÇÕES GERAIS · 2026</span></div><h1 id="election-page-title">Segundo turno<span>.</span></h1><p>Acompanhe a totalização oficial para presidente e, onde houver, governador. Sem projeções: cada número aponta para a fonte.</p><div class="module-meta"><span><strong>Votação:</strong> domingo, 25 de outubro · 8h às 17h</span><span><strong>Horário:</strong> Brasília em todo o país</span></div>
      ${electionCountdownMarkup()}
    </header>
    <section class="election-controls panel" aria-label="Filtros da apuração"><div><div class="section-kicker">CONSULTA TERRITORIAL</div><h2>${escapeHtml(place)}</h2><p>Brasil, unidades da Federação e Exterior para a eleição presidencial.</p></div>${electionSelectorMarkup(coverage)}</section>
    <div id="election-content">${electionSkeletonMarkup()}</div>
  </section>`;
  renderNavigation();
  byId("conteudo").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });

  byId("election-coverage").addEventListener("change", (event) => {
    window.location.hash = electionHashForCoverage(event.target.value);
  });
  window.clearInterval(electionClockTimer);
  refreshElectionCountdown();
  electionClockTimer = window.setInterval(refreshElectionCountdown, 60000);
  refreshElectionSnapshot(coverage);
}

function showIndicatorDetails(id) {
  const indicator = indicatorFor(id);
  if (!indicator) return;
  const dialog = byId("detail-dialog");
  byId("dialog-content").innerHTML = `<div class="dialog-eyebrow">FICHA DO INDICADOR <span class="quiet-badge">${escapeHtml(indicator.status)}</span></div><h2 id="dialog-title">${escapeHtml(indicator.name)}</h2><p class="dialog-subtitle">${escapeHtml(indicator.definition)}</p><div class="dialog-value"><span>Valor nesta versão</span><strong>—</strong><small>Sem dado integrado. Nenhum valor atual é estimado.</small></div><dl class="metadata-list">
    <div><dt>Unidade</dt><dd>${escapeHtml(indicator.unit)}</dd></div><div><dt>Período de referência</dt><dd>${escapeHtml(indicator.period)}</dd></div><div><dt>Fonte prevista</dt><dd>${escapeHtml(indicator.source)}${sourcePortalMarkup(indicator)}</dd></div><div><dt>Data de publicação</dt><dd>${indicator.publishedAt ? escapeHtml(indicator.publishedAt) : "Ainda não disponível"}</dd></div><div><dt>Frequência esperada</dt><dd>${escapeHtml(indicator.frequency)}</dd></div><div class="metadata-wide"><dt>Nota metodológica</dt><dd>${escapeHtml(indicator.methodology)}</dd></div></dl><p class="source-pending"><span class="status-dot status-dot-muted" aria-hidden="true"></span>O portal indicado pertence à fonte prevista; a série específica ainda não foi integrada.</p>`;
  dialog.showModal();
}

function showProposalDetails(id) {
  const proposal = proposals.find((item) => item.id === id);
  if (!proposal) return;
  const dialog = byId("detail-dialog");
  byId("dialog-content").innerHTML = `<div class="dialog-eyebrow">PAUTA LEGISLATIVA <span class="fiction-badge"><span aria-hidden="true">◇</span> Exemplo fictício</span></div><h2 id="dialog-title">${escapeHtml(proposal.subject)}</h2><p class="dialog-subtitle">${escapeHtml(proposal.party)}. Este item não possui correspondência em registros oficiais.</p><div class="proposal-detail-meta"><span><small>Casa</small><strong>${escapeHtml(proposal.house)}</strong></span><span><small>Identificação demonstrativa</small><strong>${escapeHtml(proposal.code)}</strong></span><span><small>Etapa</small><strong>${escapeHtml(proposal.stage)}</strong></span><span><small>Última movimentação</small><strong>Não informada</strong></span></div><div class="timeline-heading"><div class="section-kicker">LINHA DO TEMPO</div><span>Eventos ilustrativos · sem datas</span></div><ol class="timeline-list">${proposal.timeline.map((event, index) => `<li class="${index < 2 ? "timeline-complete" : ""}"><span class="timeline-point" aria-hidden="true"></span><strong>${escapeHtml(event)}</strong><small>Registro fictício · sem link oficial</small></li>`).join("")}</ol><p class="source-pending"><span class="status-dot status-dot-muted" aria-hidden="true"></span>Links de tramitação e texto integral só serão exibidos para uma proposta real integrada à fonte oficial.</p>`;
  dialog.showModal();
}

function setupSearch() {
  const input = byId("indicator-search");
  input.addEventListener("input", () => {
    const query = input.value.trim().toLocaleLowerCase("pt-BR");
    const cards = [...byId("indicator-grid").querySelectorAll(".indicator-card")];
    let visible = 0;
    cards.forEach((card) => {
      const match = card.textContent.toLocaleLowerCase("pt-BR").includes(query);
      card.hidden = !match;
      if (match) visible++;
    });
    byId("sr-status").textContent = query ? `${visible} indicadores encontrados.` : "Busca limpa.";
    let empty = byId("search-empty");
    if (!visible && query) {
      if (!empty) {
        empty = document.createElement("p");
        empty.id = "search-empty";
        empty.className = "search-empty";
        empty.textContent = "Nenhum indicador em foco corresponde à busca. Experimente o nome de um módulo.";
        byId("indicator-grid").after(empty);
      }
    } else empty?.remove();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
      event.preventDefault(); input.focus();
    }
  });
}

function route() {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  const electionCoverage = electionCoverageFromHash(`#${hash}`);
  if (electionCoverage) {
    renderElectionPage(electionCoverage);
    return;
  }

  window.clearInterval(electionPollTimer);
  window.clearInterval(electionClockTimer);
  electionRequestController?.abort();
  const routeId = hash && hash !== "inicio" && hash !== "indicadores" && hash !== "transparencia" && hash !== "legislativo" ? hash : "inicio";
  routeId === "inicio" ? renderDashboard() : renderModule(routeId);
  if (hash === "legislativo") {
    window.setTimeout(() => byId("legislativo")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
}

function setupThemeToggle() {
  const toggle = byId("theme-toggle");
  const icon = toggle.querySelector(".theme-toggle-icon");
  const label = toggle.querySelector(".theme-toggle-label");
  const status = byId("theme-status");

  function applyTheme(theme, announce = false) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", isDark ? "Ativar tema claro" : "Ativar modo noturno");
    icon.textContent = isDark ? "☀" : "☾";
    label.textContent = isDark ? "Tema claro" : "Tema escuro";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#10191f" : "#102b3f");
    if (announce) {
      try {
        localStorage.setItem("ao-vivo-brasil-theme", isDark ? "dark" : "light");
      } catch {
        // A página também pode ser aberta como arquivo local, onde o armazenamento pode estar bloqueado.
      }
    }
    if (announce) status.textContent = isDark ? "Modo noturno ativado." : "Tema claro ativado.";
  }

  applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  toggle.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-indicator], [data-proposal], [data-open-module], [data-open-first-indicator], [data-uf], [data-election-retry]");
  if (!target) return;
  if (target.dataset.indicator) showIndicatorDetails(target.dataset.indicator);
  if (target.dataset.proposal) showProposalDetails(target.dataset.proposal);
  if (target.dataset.openModule) window.location.hash = target.dataset.openModule;
  if (target.hasAttribute("data-open-first-indicator")) showIndicatorDetails("ipca");
  if (target.hasAttribute("data-election-retry")) refreshElectionSnapshot(selectedElectionCoverage, true);
  if (target.dataset.uf) {
    selectedUf = target.dataset.uf;
    renderModule("estados");
    const firstTile = document.querySelector(`[data-uf="${selectedUf}"]`);
    firstTile?.focus({ preventScroll: true });
  }
});

document.addEventListener("visibilitychange", () => {
  if (currentView !== "eleicoes") return;
  if (document.hidden) window.clearInterval(electionPollTimer);
  else refreshElectionSnapshot(selectedElectionCoverage);
});

document.addEventListener("keydown", (event) => {
  const region = event.target.closest?.(".state-region[role='button']");
  if (!region || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  region.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
});

byId("detail-dialog").addEventListener("click", (event) => {
  if (event.target === byId("detail-dialog")) byId("detail-dialog").close();
});
window.addEventListener("hashchange", route);

setupThemeToggle();
renderNavigation();
renderIndicators();
renderUpdates();
renderProposals();
renderTopics();
setupSearch();
route();
