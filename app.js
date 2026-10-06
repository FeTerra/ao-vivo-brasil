import { modules, indicators, updates, proposals, states } from "./data.js";

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
  return `<div class="state-explorer">
    <div class="state-map-card panel"><div class="panel-head"><div><div class="section-kicker">CARTOGRAMA ESQUEMÁTICO</div><h2>Selecione uma UF</h2></div><span class="quiet-badge">Sem escala de dados</span></div>
      <p class="panel-intro">Posições aproximadas apenas para demonstrar a seleção. Nenhum estado está classificado por resultado.</p>
      <div class="state-map" role="group" aria-label="Selecione uma unidade da Federação">${states.map((state) => `<button class="uf-tile ${selectedUf === state.uf ? "is-selected" : ""}" style="--col:${state.col};--row:${state.row}" data-uf="${state.uf}" aria-pressed="${selectedUf === state.uf}" aria-label="${escapeHtml(state.name)}, ${state.uf}">${state.uf}</button>`).join("")}</div>
      <div class="map-caption"><span class="map-key" aria-hidden="true"></span> Cartograma ilustrativo · 26 estados e Distrito Federal</div>
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
  const routeId = hash && hash !== "inicio" && hash !== "indicadores" && hash !== "transparencia" && hash !== "legislativo" ? hash : "inicio";
  routeId === "inicio" ? renderDashboard() : renderModule(routeId);
  if (hash === "legislativo") {
    window.setTimeout(() => byId("legislativo")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-indicator], [data-proposal], [data-open-module], [data-open-first-indicator], [data-uf]");
  if (!target) return;
  if (target.dataset.indicator) showIndicatorDetails(target.dataset.indicator);
  if (target.dataset.proposal) showProposalDetails(target.dataset.proposal);
  if (target.dataset.openModule) window.location.hash = target.dataset.openModule;
  if (target.hasAttribute("data-open-first-indicator")) showIndicatorDetails("ipca");
  if (target.dataset.uf) {
    selectedUf = target.dataset.uf;
    renderModule("estados");
    const firstTile = document.querySelector(`[data-uf="${selectedUf}"]`);
    firstTile?.focus({ preventScroll: true });
  }
});

byId("detail-dialog").addEventListener("click", (event) => {
  if (event.target === byId("detail-dialog")) byId("detail-dialog").close();
});
window.addEventListener("hashchange", route);

renderNavigation();
renderIndicators();
renderUpdates();
renderProposals();
renderTopics();
setupSearch();
route();
