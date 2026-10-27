"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { indicators, modules, proposals, states } from "../data.js";
import { stateMapFeatures } from "../state-map.js";
import {
  electionCoverageFromHash,
  electionHashForCoverage,
  electionPhase,
  formatBrasiliaDateTime,
  RUNOFF_DATE,
} from "../elections.js";
import { loadElectionSnapshot } from "../services/tse-results.js";
import {
  ElectionFailure,
  ElectionLoadingSkeleton,
  ElectionResults,
  electionCoverageLabel,
  type ElectionSnapshot,
} from "../election-view";

type Indicator = {
  id: string;
  name: string;
  shortName: string;
  value: string | number | null;
  unit: string;
  module: string;
  definition: string;
  period: string;
  source: string;
  publishedAt: string | null;
  frequency: string;
  methodology: string;
  status: string;
};

type ModuleItem = {
  id: string;
  label: string;
  icon: string;
  description: string;
  scope: string;
  indicators: string[];
};

type Proposal = {
  id: string;
  house: string;
  subject: string;
  stage: string;
  code: string;
  party: string;
  timeline: string[];
};

type Route = { view: string; coverage: string | null };
type Detail = { kind: "indicator" | "proposal"; id: string } | null;
const moduleItems = modules as ModuleItem[];
const indicatorItems = indicators as Indicator[];
const proposalItems = proposals as Proposal[];
const stateItems = states as { uf: string; name: string }[];
const featuredIds = ["ipca", "selic", "desocupacao", "arrecadacao"];
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

function ModuleIcon({ id }: { id: string }) {
  const iconPaths: Record<string, ReactNode> = {
    inicio: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    economia: <><path d="M3 18h18" /><path d="m5 15 4-5 4 3 6-8" /><path d="M17 5h2v2" /></>,
    politica: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 12h7M9 16h7" /></>,
    emprego: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    saude: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
    educacao: <><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v17H5.5A2.5 2.5 0 0 0 3 22z" /><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v17h6.5A2.5 2.5 0 0 1 21 22z" /></>,
    seguranca: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    impostos: <><circle cx="12" cy="12" r="9" /><path d="m8 16 8-8M9 8h.01M15 16h.01" /></>,
    estados: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
    eleicoes: <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M8 8h8M8 12h8M8 16h4M8 2v4M16 2v4" /></>,
  };

  return <svg className="module-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{iconPaths[id] ?? iconPaths.inicio}</svg>;
}

function moduleFor(id: string) {
  return moduleItems.find((item) => item.id === id);
}

function indicatorFor(id: string) {
  return indicatorItems.find((item) => item.id === id);
}

function moduleHref(id: string) {
  return `#${id}`;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function useHashRoute() {
  const [route, setRoute] = useState<Route>({ view: "inicio", coverage: null });

  useEffect(() => {
    const syncRoute = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const coverage = electionCoverageFromHash(`#${hash}`);
      if (coverage) {
        setRoute({ view: "eleicoes", coverage });
        return;
      }
      const view = moduleFor(hash) ? hash : "inicio";
      setRoute({ view, coverage: null });
    };

    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  return route;
}

function IndicatorCard({
  indicator,
  compact = false,
  onOpen,
}: {
  indicator: Indicator;
  compact?: boolean;
  onOpen: (id: string) => void;
}) {
  const parentModule = moduleFor(indicator.module);
  const value = indicator.value === null ? "—" : `${indicator.value} ${indicator.unit}`;

  return (
    <article className={`indicator-card${compact ? " indicator-card-compact" : ""}`}>
      <div className="indicator-top">
        <span className="indicator-category">{parentModule?.label ?? "Indicador"}</span>
        <span className="indicator-pip" aria-hidden="true" />
      </div>
      <div className="indicator-name">{indicator.shortName}</div>
      <div className="indicator-value" aria-label={indicator.value === null ? "Valor não disponível" : undefined}>{value}</div>
      <div className="indicator-unit">{indicator.unit} <span aria-hidden="true">·</span> {indicator.period}</div>
      <div className="indicator-source"><span className="source-mark" aria-hidden="true">↗</span>{indicator.source}</div>
      <button className="card-link" type="button" onClick={() => onOpen(indicator.id)} aria-label={`Consultar ficha do indicador ${indicator.shortName}`}>
        Ver ficha do indicador <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function ProposalCard({ proposal, onOpen }: { proposal: Proposal; onOpen: (id: string) => void }) {
  return (
    <button className="proposal-card" type="button" onClick={() => onOpen(proposal.id)} aria-label={`Ver exemplo fictício de proposta: ${proposal.subject}`}>
      <span className="proposal-house">{proposal.house}</span>
      <span className="proposal-main"><strong>{proposal.subject}</strong><span>{proposal.stage}</span></span>
      <span className="proposal-arrow" aria-hidden="true">↗</span>
      <span className="proposal-meta"><span className="proposal-code">{proposal.code}</span><span>Última movimentação: não informada</span></span>
    </button>
  );
}

function HomeView({
  onOpenIndicator,
}: {
  onOpenIndicator: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const featured = featuredIds.map(indicatorFor).filter((item): item is Indicator => Boolean(item));
  const normalizedQuery = normalizeSearchText(query.trim());
  const visibleIndicators = normalizedQuery
    ? indicatorItems.filter((indicator) => {
      const searchable = normalizeSearchText([
        indicator.name,
        indicator.shortName,
        indicator.unit,
        indicator.source,
        moduleFor(indicator.module)?.label ?? "",
      ].join(" "));
      return searchable.includes(normalizedQuery);
    })
    : featured;
  const visibleModules = normalizedQuery
    ? moduleItems.filter((item) => normalizeSearchText([item.label, item.scope, item.description].join(" ")).includes(normalizedQuery))
    : [];

  useEffect(() => {
    const focusSearch = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <section id="dashboard-view" aria-labelledby="page-title">
      <div className="hero">
        <div className="hero-content">
          <div className="eyebrow"><span className="eyebrow-line" />OBSERVATÓRIO PÚBLICO · BRASIL</div>
          <h1 id="page-title">O Brasil,<br /><span>com contexto.</span></h1>
          <p>Indicadores, território e decisões públicas em uma leitura clara e verificável.</p>
          <div className="hero-actions">
            <a className="button button-light" href="#indicadores">Explorar indicadores <span aria-hidden="true">↓</span></a>
            <span className="hero-caption">Informação pública começa com uma boa fonte.</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="country-token"><span className="token-pulse" /><span>BR</span></div>
          <div className="art-caption"><span className="art-caption-line" /><span>um país<br />em perspectiva</span></div>
          <div className="art-coordinate">15°46′ S&nbsp; 47°55′ O</div>
        </div>
        <div className="hero-meta" aria-label="Situação dos dados">
          <div><span className="meta-label">Período de referência</span><strong>Varia por indicador</strong></div>
          <div><span className="meta-label">Atualização dos dados</span><strong><span className="status-dot status-dot-muted" />Integrações pendentes</strong></div>
          <div className="hero-demo-label"><span aria-hidden="true">✳</span> Sem dados atuais conectados</div>
        </div>
      </div>

      <a className="election-promo" href="#eleicoes/segundo-turno" aria-label="Acompanhe o segundo turno das Eleições 2026 no Ao Vivo Brasil">
        <span className="election-promo-mark" aria-hidden="true">26</span>
        <span className="election-promo-copy"><span className="section-kicker">ELEIÇÕES 2026 · 2º TURNO</span><strong>Acompanhe a apuração no Ao Vivo Brasil</strong><span>Resultados do TSE por Brasil e estado, com fontes e metodologia.</span></span>
        <span className="election-promo-action"><span>25 out · 2026</span><strong>Ver painel <span aria-hidden="true">→</span></strong></span>
      </a>

      <section className="section-block" id="indicadores" aria-labelledby="indicators-title">
        <div className="section-heading">
          <div><div className="section-kicker">ACOMPANHE</div><h2 id="indicators-title">{normalizedQuery ? "Resultados da busca" : "Indicadores em foco"}</h2><p className="section-description">{normalizedQuery ? "Busca em todo o catálogo de indicadores e nos módulos temáticos." : "Os valores permanecem vazios enquanto as fontes oficiais não estiverem integradas."}</p></div>
          <label className="search-wrap" htmlFor="indicator-search">
            <span aria-hidden="true" className="search-icon" /><span className="visually-hidden">Buscar indicador ou módulo</span>
            <input ref={inputRef} id="indicator-search" type="search" placeholder="Buscar indicador ou módulo" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
            <kbd>/</kbd>
          </label>
        </div>
        <div className="indicator-grid">
          {visibleIndicators.map((indicator) => <IndicatorCard key={indicator.id} indicator={indicator} onOpen={onOpenIndicator} />)}
        </div>
        {visibleModules.length > 0 && <div className="search-module-results" aria-label="Módulos relacionados">
          <span className="search-module-label">Módulos relacionados</span>
          <div className="search-module-links">{visibleModules.map((item) => <a className="search-module-link" href={moduleHref(item.id)} key={item.id}><span><ModuleIcon id={item.id} /></span>{item.label}<span aria-hidden="true">↗</span></a>)}</div>
        </div>}
        {!visibleIndicators.length && !visibleModules.length && normalizedQuery && <p className="search-empty">Nenhum indicador ou módulo corresponde à busca. Tente outro termo.</p>}
        <span className="sr-status" role="status" aria-live="polite">{normalizedQuery ? `${visibleIndicators.length} ${visibleIndicators.length === 1 ? "indicador" : "indicadores"} e ${visibleModules.length} ${visibleModules.length === 1 ? "módulo" : "módulos"} encontrados.` : "Busca limpa."}</span>
      </section>

      <section className="section-block home-data-panel panel" aria-labelledby="home-data-title">
        <div>
          <div className="section-kicker">TRANSPARÊNCIA DOS DADOS</div>
          <h2 id="home-data-title">As integrações oficiais ainda estão pendentes.</h2>
          <p>Os indicadores mostram a fonte prevista e só receberão valores quando a série e o período forem confirmados.</p>
        </div>
        <a className="inline-action" href="#transparencia">Conheça os critérios <span aria-hidden="true">→</span></a>
      </section>

    </section>
  );
}

function StateExplorer() {
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const selected = stateItems.find((state) => state.uf === selectedUf);
  const stateByUf = new Map(stateItems.map((state) => [state.uf, state]));
  const selectState = (uf: string | null) => setSelectedUf(uf);

  const handleStateKey = (event: KeyboardEvent<SVGGElement>, uf: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectState(uf);
  };

  return (
    <div className="state-explorer">
      <div className="state-map-card panel">
        <div className="panel-head"><div><div className="section-kicker">UNIDADES DA FEDERAÇÃO</div><h2>Selecione um estado</h2></div><span className="quiet-badge">Sem dados temáticos</span></div>
        <p className="panel-intro">Limites estaduais baseados na malha geográfica do IBGE. A seleção demonstra o recorte territorial e não representa resultados.</p>
        <label className="state-select-control" htmlFor="state-map-select"><span>Ou escolha pela lista</span><select id="state-map-select" value={selectedUf ?? ""} onChange={(event) => selectState(event.target.value || null)}><option value="">Brasil · selecione uma UF</option>{[...stateItems].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((state) => <option value={state.uf} key={state.uf}>{state.name} ({state.uf})</option>)}</select></label>
        <div className="state-map">
          <svg className="state-map-svg" viewBox="0 0 760 680" role="group" aria-labelledby="state-map-title state-map-description">
            <title id="state-map-title">Mapa do Brasil por unidade da Federação</title>
            <desc id="state-map-description">Mapa esquemático com os limites das 27 unidades da Federação. Selecione uma área para consultar a disponibilidade de dados.</desc>
            <g className="state-map-regions">{stateMapFeatures.map((feature) => {
              const state = stateByUf.get(feature.uf);
              if (!state) return null;
              const isSelected = selectedUf === feature.uf;
              return <g className={`state-region${isSelected ? " is-selected" : ""}`} data-uf={feature.uf} key={feature.uf} role="button" tabIndex={0} aria-pressed={isSelected} aria-label={`${state.name}, ${feature.uf}`} onClick={() => selectState(feature.uf)} onKeyDown={(event) => handleStateKey(event, feature.uf)}><path className="state-shape" d={feature.path} fillRule="evenodd" /></g>;
            })}</g>
            <g className="state-map-callouts" aria-hidden="true">{stateMapFeatures.filter((feature) => feature.callout).map((feature) => <path className="state-callout-line" d={feature.callout} key={`callout-${feature.uf}`} />)}</g>
            <g className="state-map-labels" aria-hidden="true">{stateMapFeatures.map((feature) => <text className={`state-label${selectedUf === feature.uf ? " is-selected" : ""}`} x={feature.labelX} y={feature.labelY} textAnchor="middle" key={`label-${feature.uf}`}>{feature.uf}</text>)}</g>
          </svg>
        </div>
        <div className="map-caption"><span className="map-key" aria-hidden="true" /><span>27 UFs · seleção demonstrativa, sem valores</span><a href="https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html" target="_blank" rel="noopener noreferrer">Malha territorial do IBGE <span aria-hidden="true">↗</span></a></div>
      </div>
      <aside className="state-detail panel" aria-live="polite"><div className="section-kicker">RECORTE ESTADUAL</div><div className="state-detail-code">{selected ? selected.uf : "BR"}</div><h2>{selected ? selected.name : "Brasil"}</h2><p>{selected ? "A consulta estadual será exibida quando uma série oficial comparável estiver integrada." : "Selecione uma unidade da Federação para ver a disponibilidade do recorte."}</p><div className="state-empty"><span className="empty-dot" aria-hidden="true" /><span>Sem indicadores estaduais integrados</span></div><div className="state-note">Comparações só serão exibidas com definições e períodos compatíveis.</div></aside>
    </div>
  );
}

function ModuleView({ item, onOpenIndicator, onOpenProposal }: { item: ModuleItem; onOpenIndicator: (id: string) => void; onOpenProposal: (id: string) => void }) {
  const items = item.indicators.map(indicatorFor).filter((indicator): indicator is Indicator => Boolean(indicator));

  return (
    <section id="module-view" aria-labelledby="module-title">
      <section className="module-hero">
        <a className="back-link" href="#inicio"><span aria-hidden="true">←</span> Visão geral</a>
        <div className="module-hero-label"><span className="module-icon-large"><ModuleIcon id={item.id} /></span><span>MÓDULO TEMÁTICO</span></div>
        <h1 id="module-title">{item.label}<span>.</span></h1><p>{item.description}</p>
        <div className="module-meta"><span><strong>Dados:</strong> integrações pendentes</span><span><strong>Período:</strong> varia por indicador</span></div>
      </section>
      <section className="section-block module-indicators">
        <div className="section-heading"><div><div className="section-kicker">CATÁLOGO DO MÓDULO</div><h2>Indicadores disponíveis</h2><p className="section-description">Valores não exibidos até a integração da fonte e validação do período.</p></div><span className="quiet-badge">{items.length ? `${items.length} fichas preparadas` : "Catálogo em preparação"}</span></div>
        {items.length ? <div className="indicator-grid">{items.map((indicator) => <IndicatorCard key={indicator.id} indicator={indicator} compact onOpen={onOpenIndicator} />)}</div> : <div className="empty-catalog panel"><span className="empty-catalog-icon" aria-hidden="true">§</span><div><h3>Acompanhe o processo, passo a passo.</h3><p>As fichas legislativas vão apontar para a proposta, sua etapa, as movimentações oficiais e os documentos de origem.</p></div><span className="fiction-badge">Amostras abaixo são fictícias</span></div>}
      </section>
      {item.id === "politica" && <section className="module-extra panel"><div className="panel-head"><div><div className="section-kicker">TRAMITAÇÃO</div><h2>Exemplos de pauta</h2></div><span className="fiction-badge"><span aria-hidden="true">◇</span> Itens fictícios</span></div><p className="panel-intro">Conteúdo fictício para visualizar a estrutura de listagem e linha do tempo. Não representa proposições, pessoas ou registros oficiais reais.</p><div className="proposal-list proposal-list-module">{proposalItems.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} onOpen={onOpenProposal} />)}</div></section>}
      {item.id === "estados" && <StateExplorer />}
      <section className="module-method"><div className="section-kicker">CRITÉRIO DE LEITURA</div><p>{item.id === "estados" ? "Uma comparação territorial só faz sentido quando período, unidade e definição são equivalentes." : "Cada ficha explica definição, unidade, período, fonte, publicação, frequência e limites metodológicos."}</p><a href="#transparencia">Ver princípios de transparência <span aria-hidden="true">→</span></a></section>
    </section>
  );
}

function DetailDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const indicator = detail?.kind === "indicator" ? indicatorFor(detail.id) : undefined;
  const proposal = detail?.kind === "proposal" ? proposalItems.find((item) => item.id === detail.id) : undefined;
  const portal = indicator ? sourcePortals.find((item) => indicator.source.includes(item.match)) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (detail && dialog && !dialog.open) dialog.showModal();
    if (!detail && dialog?.open) dialog.close();
  }, [detail]);

  return (
    <dialog className="detail-dialog" ref={dialogRef} aria-labelledby="dialog-title" onClose={onClose} onClick={(event: MouseEvent<HTMLDialogElement>) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <form method="dialog"><button className="dialog-close" aria-label="Fechar detalhes">×</button></form>
      <div className="dialog-content">
        {indicator && <>
          <div className="dialog-eyebrow">FICHA DO INDICADOR <span className="quiet-badge">{indicator.status}</span></div>
          <h2 id="dialog-title">{indicator.name}</h2><p className="dialog-subtitle">{indicator.definition}</p>
          <div className="dialog-value"><span>Valor nesta versão</span><strong>—</strong><small>Sem dado integrado. Nenhum valor atual é estimado.</small></div>
          <dl className="metadata-list">
            <div><dt>Unidade</dt><dd>{indicator.unit}</dd></div><div><dt>Período de referência</dt><dd>{indicator.period}</dd></div>
            <div><dt>Fonte prevista</dt><dd>{indicator.source}{portal && <><a className="official-link" href={portal.url} target="_blank" rel="noopener noreferrer">Visitar portal do {portal.name} <span aria-hidden="true">↗</span></a><small className="official-link-note">Portal institucional da fonte prevista; link da série específica pendente.</small></>}</dd></div>
            <div><dt>Data de publicação</dt><dd>{indicator.publishedAt ?? "Ainda não disponível"}</dd></div><div><dt>Frequência esperada</dt><dd>{indicator.frequency}</dd></div>
            <div className="metadata-wide"><dt>Nota metodológica</dt><dd>{indicator.methodology}</dd></div>
          </dl>
          <p className="source-pending"><span className="status-dot status-dot-muted" aria-hidden="true" />O portal indicado pertence à fonte prevista; a série específica ainda não foi integrada.</p>
        </>}
        {proposal && <>
          <div className="dialog-eyebrow">PAUTA LEGISLATIVA <span className="fiction-badge"><span aria-hidden="true">◇</span> Exemplo fictício</span></div>
          <h2 id="dialog-title">{proposal.subject}</h2><p className="dialog-subtitle">{proposal.party}. Este item não possui correspondência em registros oficiais.</p>
          <div className="proposal-detail-meta"><span><small>Casa</small><strong>{proposal.house}</strong></span><span><small>Identificação demonstrativa</small><strong>{proposal.code}</strong></span><span><small>Etapa</small><strong>{proposal.stage}</strong></span><span><small>Última movimentação</small><strong>Não informada</strong></span></div>
          <div className="timeline-heading"><div className="section-kicker">LINHA DO TEMPO</div><span>Eventos ilustrativos · sem datas</span></div>
          <ol className="timeline-list">{proposal.timeline.map((item, index) => <li className={index < 2 ? "timeline-complete" : ""} key={`${proposal.id}-${item}`}><span className="timeline-point" aria-hidden="true" /><strong>{item}</strong><small>Registro fictício · sem link oficial</small></li>)}</ol>
          <p className="source-pending"><span className="status-dot status-dot-muted" aria-hidden="true" />Links de tramitação e texto integral só serão exibidos para uma proposta real integrada à fonte oficial.</p>
        </>}
      </div>
    </dialog>
  );
}

function ElectionPage({ coverage }: { coverage: string }) {
  const [snapshot, setSnapshot] = useState<ElectionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const snapshotCache = useRef(new Map<string, ElectionSnapshot>());
  const forceRefresh = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const requestRefresh = useCallback((force = false) => {
    forceRefresh.current = force;
    setRefreshSequence((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    const refresh = forceRefresh.current;
    forceRefresh.current = false;
    let previous: ElectionSnapshot | undefined = snapshotCache.current.get(coverage);

    if (!previous) {
      try {
        const stored = localStorage.getItem(`ao-vivo-brasil-election-${coverage}`);
        if (stored) {
          const cached = JSON.parse(stored) as ElectionSnapshot;
          previous = cached;
          snapshotCache.current.set(coverage, cached);
        }
      } catch {
        // O cache do navegador é opcional.
      }
    }

    setSnapshot(previous ?? null);
    setError("");
    setLoading(!previous);

    loadElectionSnapshot(coverage, { signal: controller.signal, refresh })
      .then((result) => {
        if (controller.signal.aborted) return;
        const next = result.stale && previous?.references
          ? { ...previous, stale: true, status: "stale", message: result.message || "A fonte falhou; a última resposta válida foi mantida.", lastCheckedAt: result.checkedAt || null }
          : result;
        snapshotCache.current.set(coverage, next);
        try {
          localStorage.setItem(`ao-vivo-brasil-election-${coverage}`, JSON.stringify(next));
        } catch {
          // O painel continua disponível sem persistência local.
        }
        setSnapshot(next);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        const message = requestError instanceof Error ? requestError.message : "A conexão com a fonte do TSE falhou.";
        if (previous) {
          const stale = { ...previous, stale: true, status: "stale", message: "A fonte falhou; a última resposta válida foi mantida." };
          snapshotCache.current.set(coverage, stale);
          setSnapshot(stale);
        } else {
          setError(message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [coverage, refreshSequence]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!snapshot?.live?.configured) return;
    const timer = window.setInterval(() => {
      const phase = electionPhase(new Date(), Boolean(snapshot.live?.finalized));
      if (!document.hidden && phase === "counting") requestRefresh(false);
    }, 45000);
    return () => window.clearInterval(timer);
  }, [snapshot, requestRefresh]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) requestRefresh(false);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [requestRefresh]);

  const start = new Date(`${RUNOFF_DATE}T08:00:00-03:00`);
  const phase = electionPhase(now);
  const remaining = phase === "before"
    ? `Faltam ${Math.max(0, Math.ceil((start.getTime() - now.getTime()) / 86400000))} dias para a votação`
    : phase === "voting" ? "Votação prevista até 17h · horário de Brasília" : "A votação terminou; a totalização segue o TSE";
  const place = electionCoverageLabel(coverage);

  return (
    <section className="election-page" aria-labelledby="election-page-title">
      <header className="module-hero election-hero">
        <a className="back-link" href="#inicio"><span aria-hidden="true">←</span> Visão geral</a>
        <div className="module-hero-label"><span className="module-icon-large" aria-hidden="true">◉</span><span>ELEIÇÕES GERAIS · 2026</span></div>
        <h1 id="election-page-title">Segundo turno<span>.</span></h1>
        <p>Acompanhe a totalização oficial para presidente e, onde houver, governador. Sem projeções: cada número aponta para a fonte.</p>
        <div className="module-meta"><span><strong>Votação:</strong> domingo, 25 de outubro · 8h às 17h</span><span><strong>Horário:</strong> Brasília em todo o país</span></div>
        <div className="election-countdown" aria-live="polite"><span className="section-kicker">SEGUNDO TURNO</span><strong>25 de outubro de 2026</strong><span>Votação das 8h às 17h · horário de Brasília</span><span className="election-countdown-remaining">{remaining}</span></div>
      </header>
      <section className="election-controls panel" aria-label="Filtros da apuração">
        <div><div className="section-kicker">CONSULTA TERRITORIAL</div><h2>{place}</h2><p>Brasil, unidades da Federação e Exterior para a eleição presidencial.</p></div>
        <label className="election-coverage-control" htmlFor="election-coverage"><span>Abrangência</span><select id="election-coverage" name="abrangencia" aria-label="Selecione a abrangência da apuração" value={coverage} onChange={(event) => { window.location.hash = electionHashForCoverage(event.target.value); }}><option value="BR">Brasil</option>{[...stateItems].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((state) => <option value={state.uf} key={state.uf}>{state.name} ({state.uf})</option>)}<option value="EX">Exterior · Presidente</option></select></label>
      </section>
      <div id="election-content" aria-busy={loading}>
        {snapshot
          ? <ElectionResults snapshot={snapshot} coverage={coverage} onRetry={() => requestRefresh(true)} />
          : error
            ? <ElectionFailure message={error} onRetry={() => requestRefresh(true)} />
            : <ElectionLoadingSkeleton />}
      </div>
      {snapshot?.checkedAt && <span className="visually-hidden" role="status" aria-live="polite">Consulta ao TSE em {formatBrasiliaDateTime(snapshot.checkedAt)}</span>}
    </section>
  );
}

function Sidebar({ currentView }: { currentView: string }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const currentLabel = currentView === "inicio"
    ? "Visão geral"
    : currentView === "eleicoes"
      ? "Eleições 2026"
      : moduleFor(currentView)?.label ?? "Navegação";

  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <div className="sidebar-heading">Explore o Brasil</div>
      <button id="mobile-nav-toggle" className="mobile-nav-toggle" type="button" aria-expanded={mobileNavOpen} aria-controls="main-navigation" onClick={() => setMobileNavOpen((open) => !open)}>
        <span className="mobile-nav-toggle-icon" aria-hidden="true"><span /><span /><span /></span>
        <span className="mobile-nav-current">{currentLabel}</span>
        <span className="mobile-nav-toggle-label">{mobileNavOpen ? "Fechar" : "Menu"}</span>
      </button>
      <nav id="main-navigation" className={`main-nav${mobileNavOpen ? " is-open" : ""}`} aria-label="Módulos temáticos" onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        setMobileNavOpen(false);
        document.getElementById("mobile-nav-toggle")?.focus();
      }}>
        <a className={`nav-item${currentView === "inicio" ? " is-active" : ""}`} href="#inicio" aria-current={currentView === "inicio" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><span className="nav-icon"><ModuleIcon id="inicio" /></span><span>Visão geral</span><span className="nav-arrow" aria-hidden="true">↗</span></a>
        {moduleItems.map((item) => <a className={`nav-item${currentView === item.id ? " is-active" : ""}`} href={moduleHref(item.id)} aria-current={currentView === item.id ? "page" : undefined} key={item.id} onClick={() => setMobileNavOpen(false)}><span className="nav-icon"><ModuleIcon id={item.id} /></span><span>{item.label}</span><span className="nav-arrow" aria-hidden="true">↗</span></a>)}
        <a className={`nav-item nav-elections${currentView === "eleicoes" ? " is-active" : ""}`} href="#eleicoes/segundo-turno" aria-current={currentView === "eleicoes" ? "page" : undefined} onClick={() => setMobileNavOpen(false)}><span className="nav-icon"><ModuleIcon id="eleicoes" /></span><span>Eleições 2026</span><span className="nav-arrow" aria-hidden="true">↗</span></a>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-note-icon" aria-hidden="true">i</div><p><strong>Transparência primeiro</strong><br />Todo indicador deve mostrar de onde veio e quando foi publicado.</p><a href="#transparencia" className="sidebar-link">Conheça os critérios <span aria-hidden="true">→</span></a></div>
    </aside>
  );
}

function SiteFooter() {
  return <footer className="site-footer" id="transparencia"><div className="site-footer-inner"><div className="footer-brand"><span className="brand-mark brand-mark-small" aria-hidden="true"><span /></span><strong>Ao Vivo Brasil</strong></div><p>Dados públicos merecem contexto, método e caminho de volta à fonte.</p><div className="footer-links"><a href="#transparencia">Critérios editoriais</a><span aria-hidden="true">·</span><a href="#indicadores">Fichas de indicadores</a><span aria-hidden="true">·</span><span>Protótipo demonstrativo</span></div></div></footer>;
}

export default function DashboardApp() {
  const route = useHashRoute();
  const [detail, setDetail] = useState<Detail>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const contentRef = useRef<HTMLElement>(null);
  const currentView = route.view;

  useEffect(() => {
    let selectedTheme: "light" | "dark";
    try {
      const savedTheme = localStorage.getItem("ao-vivo-brasil-theme");
      selectedTheme = savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      selectedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.dataset.theme = selectedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", selectedTheme === "dark" ? "#10191f" : "#102b3f");
    window.setTimeout(() => setTheme(selectedTheme), 0);
  }, []);

  useEffect(() => {
    contentRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [route.view, route.coverage]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", nextTheme === "dark" ? "#10191f" : "#102b3f");
    try {
      localStorage.setItem("ao-vivo-brasil-theme", nextTheme);
    } catch {
      // A interface permanece utilizável quando o armazenamento está bloqueado.
    }
    setTheme(nextTheme);
  };

  const openIndicator = (id: string) => setDetail({ kind: "indicator", id });
  const openProposal = (id: string) => setDetail({ kind: "proposal", id });
  const activeModule = moduleFor(route.view);

  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Ao Vivo Brasil, página inicial"><span className="brand-mark" aria-hidden="true"><span /></span><span className="brand-copy"><strong>ao vivo <b>brasil</b></strong><small>dados públicos, com contexto</small></span></a>
        <div className="topbar-right">
          <button className="theme-toggle" type="button" aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar modo noturno"} aria-pressed={theme === "dark"} onClick={toggleTheme}><span className="theme-toggle-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span className="theme-toggle-label">Tema {theme === "dark" ? "claro" : "escuro"}</span></button>
          <span className="integrity-pill"><span className="status-dot" aria-hidden="true" />Versão demonstrativa</span>
          <a className="text-link methodology-link" href="#transparencia">Como lemos os dados <span aria-hidden="true">↗</span></a>
        </div>
      </header>
      <div className="shell" id="inicio">
        <Sidebar currentView={currentView} />
        <main id="conteudo" ref={contentRef} tabIndex={-1}>
          <div className="main-content">
            {currentView === "inicio" && <HomeView onOpenIndicator={openIndicator} />}
            {activeModule && <ModuleView item={activeModule} onOpenIndicator={openIndicator} onOpenProposal={openProposal} />}
            {currentView === "eleicoes" && route.coverage && <ElectionPage key={route.coverage} coverage={route.coverage} />}
          </div>
          <SiteFooter />
        </main>
      </div>
      <DetailDialog detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
