import { states } from "./data.js";
import { stateMapFeatures } from "./state-map.js";
import { electionPhase, formatBrasiliaDateTime } from "./elections.js";
import {
  CandidatePair,
  CandidateResultsTable,
  ElectionMap,
  ElectionMetadata,
  ElectionStatesTable,
  ElectionTotalizers,
  FirstRoundResultsArchive,
  GovernorFirstRoundResults,
  NoGovernorRunoffNotice,
} from "./election-components.js";

type Candidate = {
  id?: string;
  name: string;
  party?: string;
  votes?: number | null;
  percent?: number | null;
  photoUrl?: string | null;
  status?: string;
};

type ElectionTally = {
  candidates?: Candidate[];
  sections?: { total?: number | null; counted?: number | null; percent?: number | null };
  votes?: { valid?: number | null; blank?: number | null; null?: number | null };
  electors?: { present?: number | null; absent?: number | null };
  finalized?: boolean;
  available?: boolean;
  sourceUrl?: string;
  publishedDate?: string;
  publishedTime?: string;
  error?: boolean;
};

type GovernorReference = {
  status?: string;
  hasRunoff?: boolean | null;
  error?: boolean;
  candidates?: Candidate[];
  summary?: ElectionTally;
  sourceUrl?: string;
  publication?: { date?: string; time?: string };
};

type StateReference = {
  uf: string;
  name: string;
  governor?: GovernorReference;
};

export type ElectionSnapshot = {
  status?: string;
  message?: string;
  detail?: string;
  errorMessage?: string;
  stale?: boolean;
  checkedAt?: string;
  references?: {
    sourceUrl?: string;
    president?: ElectionTally;
    states?: StateReference[];
  };
  live?: {
    configured?: boolean;
    available?: boolean;
    finalized?: boolean;
    president?: ElectionTally;
    governor?: ElectionTally;
    states?: Array<{ uf: string; president?: ElectionTally }>;
  };
};

type CoverageState = { uf: string; name: string };

export function electionCoverageLabel(coverage: string) {
  if (coverage === "BR") return "Brasil";
  if (coverage === "EX") return "Exterior";
  return (states as CoverageState[]).find((state) => state.uf === coverage)?.name ?? coverage;
}

export function ElectionFailure({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="election-source-error" role="alert">
      <span className="election-alert-symbol" aria-hidden="true">!</span>
      <div>
        <strong>Não foi possível atualizar os dados oficiais.</strong>
        <p>{message || "A conexão com a fonte do TSE falhou. Se houver uma resposta válida anterior, ela será preservada."}</p>
        <button className="button button-outline" type="button" onClick={onRetry}>Tentar novamente</button>
      </div>
    </div>
  );
}

export function ElectionLoadingSkeleton() {
  return (
    <div className="election-skeleton" role="status" aria-live="polite">
      <span>Consultando arquivos oficiais do TSE…</span>
      <div className="election-skeleton-row"><i /><i /></div>
      <i className="election-skeleton-wide" />
    </div>
  );
}

function ElectionStatePage({ snapshot, coverage }: { snapshot: ElectionSnapshot; coverage: string }) {
  const reference = snapshot.references ?? {};
  const live = snapshot.live ?? {};
  const stateReference = reference.states?.find((item) => item.uf === coverage);
  const governor = stateReference?.governor;
  const governorLive = live.governor;
  const presidentReference = reference.president;
  const presidentLive = live.president;
  const stateName = electionCoverageLabel(coverage);
  const governorPublishedAt = governor?.publication?.date
    ? governor.publication.date + (governor.publication.time ? " às " + governor.publication.time : "")
    : null;
  const governorLivePublishedAt = governorLive?.publishedDate && governorLive.publishedTime
    ? governorLive.publishedDate + " às " + governorLive.publishedTime
    : null;
  const presidentLivePublishedAt = presidentLive?.publishedDate && presidentLive.publishedTime
    ? presidentLive.publishedDate + " às " + presidentLive.publishedTime
    : null;
  const presidentReferencePublishedAt = presidentReference?.publishedDate && presidentReference.publishedTime
    ? presidentReference.publishedDate + " às " + presidentReference.publishedTime
    : null;

  const governorFirstRoundDetails = governor?.summary?.candidates?.length
    ? <FirstRoundResultsArchive
      result={governor.summary}
      title={"Resultado completo · " + stateName}
      office={"Governo de " + stateName}
      sourceUrl={governor.sourceUrl}
      publishedAt={governorPublishedAt}
      period={"Primeiro turno de 2026 · " + stateName + "."}
    />
    : null;

  let governorPanel;
  if (governor?.status === "official" && governor.hasRunoff === false) {
    governorPanel = (
      <>
        <NoGovernorRunoffNotice
          uf={coverage}
          stateName={stateName}
          sourceUrl={governor.sourceUrl}
          publishedAt={governorPublishedAt}
        />
        <CandidatePair
          candidates={governor.summary?.candidates}
          title={"Votação para governador · " + coverage}
          eyebrow="RESULTADO OFICIAL · 1º TURNO"
          context="Resultado final da primeira votação; este estado não terá disputa para governador no segundo turno."
          sourceUrl={governor.sourceUrl}
          publishedAt={governorPublishedAt}
          period="Primeiro turno de 2026; resultado oficial."
          frequency="Arquivo final do primeiro turno; sem atualização periódica prevista."
          resultLabel="Resultado do 1º turno"
        />
        {governorFirstRoundDetails}
      </>
    );
  } else if (governor?.status === "official" && governor.hasRunoff === true) {
    governorPanel = (
      <>
        <CandidatePair
          candidates={governorLive?.candidates}
          title={"Governador · " + coverage}
          eyebrow="APURAÇÃO DO 2º TURNO"
          context={governorLive ? "Resultados oficiais da segunda votação nesta UF." : "A disputa para governador nesta UF foi identificada a partir do primeiro turno; o resultado do segundo turno ainda não foi publicado."}
          emptyMessage="A apuração do segundo turno para governador ainda não começou ou o arquivo oficial desta UF ainda não está disponível."
          sourceUrl={governorLive?.sourceUrl}
          publishedAt={governorLivePublishedAt}
          period="Segundo turno de 2026."
          resultLabel={governorLive ? (governorLive.finalized ? "Totalização final" : "Em apuração") : "Aguardando votação"}
        />
        <ElectionTotalizers
          result={governorLive}
          title={"Indicadores da apuração para governador · " + coverage}
          subtitle="Totalizadores do segundo turno, separados da referência do primeiro turno."
        />
        <CandidatePair
          candidates={governor.candidates}
          title={"Candidaturas ao governo de " + stateName}
          eyebrow="GOVERNADOR · REFERÊNCIA DO 1º TURNO"
          context="Candidaturas e números abaixo são do primeiro turno. A apuração desta segunda votação permanece em bloco separado."
          sourceUrl={governor.sourceUrl}
          publishedAt={governorPublishedAt}
          period="Primeiro turno de 2026; referência oficial para a disputa estadual."
          frequency="Arquivo final do primeiro turno; sem atualização periódica prevista."
          resultLabel="Referência do 1º turno"
        />
        {governorFirstRoundDetails}
      </>
    );
  } else {
    governorPanel = (
      <section className="panel election-block">
        <div className="section-kicker">GOVERNO ESTADUAL · {coverage}</div>
        <h2>Elegibilidade aguardando validação oficial</h2>
        <p>Este estado não será classificado até que o resultado oficial do primeiro turno para governador esteja disponível e totalizado.</p>
        <div className="election-empty-state">
          <strong>Sem conclusão para este recorte</strong>
          <p>Uma falha ou ausência de arquivo não será interpretada como confirmação ou ausência de segundo turno.</p>
        </div>
        <ElectionMetadata
          definition="Segundo turno estadual quando nenhuma candidatura ultrapassa 50% dos votos válidos no primeiro turno."
          unit="Votos válidos."
          period="Primeiro turno de 2026."
          sourceUrl={governor?.sourceUrl}
          publishedAt={null}
          notes="A situação estadual será derivada dos arquivos oficiais do TSE. Dados ausentes não são tratados como resultado negativo."
        />
      </section>
    );
  }

  return (
    <>
      <div className="election-live-grid">
        <CandidatePair
          candidates={presidentLive?.candidates}
          title={"Presidente · " + stateName}
          eyebrow="APURAÇÃO DO 2º TURNO"
          context={presidentLive ? "Resultados oficiais do segundo turno no recorte " + stateName + "." : "Os números abaixo da referência não são resultados do segundo turno."}
          emptyMessage="A apuração presidencial do segundo turno ainda não começou ou o arquivo oficial deste recorte ainda não está disponível."
          sourceUrl={presidentLive?.sourceUrl}
          publishedAt={presidentLivePublishedAt}
          period="Segundo turno de 2026."
          resultLabel={presidentLive ? (presidentLive.finalized ? "Totalização final" : "Em apuração") : "Aguardando votação"}
        />
        <ElectionTotalizers
          result={presidentLive}
          title={"Indicadores presidenciais · " + stateName}
          subtitle="Os totalizadores permanecem vazios até a divulgação do segundo turno pelo TSE."
        />
        {coverage === "EX" ? (
          <section className="panel election-block">
            <div className="section-kicker">VOTO NO EXTERIOR</div>
            <h2>Recorte presidencial</h2>
            <p className="panel-intro">A abrangência Exterior está disponível para a disputa presidencial. Os campos específicos desse recorte serão preenchidos quando o arquivo correspondente do segundo turno estiver publicado e identificado na integração.</p>
            <ElectionMetadata
              definition="Votação presidencial por abrangência Exterior, conforme os arquivos de resultados do TSE."
              unit="Seções e votos."
              period="Segundo turno de 2026."
              sourceUrl={presidentLive?.sourceUrl || presidentReference?.sourceUrl}
              publishedAt={null}
              notes="O total nacional é apresentado separadamente; este recorte não deve ser somado novamente ao Brasil."
            />
          </section>
        ) : governorPanel}
      </div>
      <details className="election-history-details">
        <summary><span>Resultado oficial do primeiro turno</span><small>Referência histórica · {stateName}</small></summary>
        <section className="election-first-round-section">
          <div className="panel-head">
            <div>
              <div className="section-kicker">DADOS OFICIAIS · REFERÊNCIA</div>
              <h2>Primeiro turno · {stateName}</h2>
            </div>
            <span className="quiet-badge">Dados separados do 2º turno</span>
          </div>
          <CandidatePair
            candidates={presidentReference?.error ? [] : presidentReference?.candidates}
            title={"Presidente · " + stateName}
            eyebrow="RESULTADO OFICIAL · 1º TURNO"
            context={coverage === "EX" ? "Resultado oficial do primeiro turno no Exterior, consultado no arquivo próprio do TSE; não corresponde ao total nacional." : "Votos e percentuais oficiais da primeira votação nesta abrangência."}
            emptyMessage={coverage === "EX" ? "O arquivo específico da votação no Exterior não está disponível no momento. Os números nacionais não são usados como substitutos." : undefined}
            sourceUrl={presidentReference?.sourceUrl}
            publishedAt={presidentReferencePublishedAt}
            period={coverage === "EX" ? "Primeiro turno de 2026; abrangência Exterior, conforme arquivo do TSE." : "Primeiro turno de 2026; resultado oficial."}
            frequency="Arquivo final do primeiro turno; sem atualização periódica prevista."
            resultLabel="Resultado do 1º turno"
          />
          <ElectionTotalizers
            result={presidentReference?.error ? null : presidentReference}
            title={"Totalizadores presidenciais · " + stateName}
            subtitle="Votação totalizada no primeiro turno; referência histórica para a próxima votação."
            period="Primeiro turno de 2026"
            frequency="Arquivo final do primeiro turno; sem atualização periódica prevista."
          />
          <CandidateResultsTable
            candidates={presidentReference?.error ? [] : presidentReference?.candidates}
            title={"Candidaturas presidenciais · " + stateName}
            sourceUrl={presidentReference?.sourceUrl}
            publishedAt={presidentReferencePublishedAt}
            period={"Primeiro turno de 2026 · " + stateName + "."}
            collapsed
          />
        </section>
      </details>
    </>
  );
}

export function ElectionResults({
  snapshot,
  coverage,
  onRetry,
}: {
  snapshot: ElectionSnapshot;
  coverage: string;
  onRetry: () => void;
}) {
  if (!snapshot || snapshot.status === "error") {
    return <ElectionFailure message={snapshot?.message || snapshot?.detail || snapshot?.errorMessage} onRetry={onRetry} />;
  }

  const references = snapshot.references ?? {};
  const live = snapshot.live ?? {};
  const phase = electionPhase(new Date(), Boolean(live.finalized));
  const phaseLabels: Record<string, string> = {
    before: "Aguardando votação",
    voting: "Votação em andamento",
    counting: live.available ? "Em apuração" : "Aguardando totalização do TSE",
    final: "Apuração encerrada",
  };
  const publishedAt = references.president?.publishedDate && references.president.publishedTime
    ? references.president.publishedDate + " às " + references.president.publishedTime
    : null;
  const updatedLine = snapshot.checkedAt
    ? "Consulta ao TSE em " + formatBrasiliaDateTime(snapshot.checkedAt)
    : "Consulta à fonte ainda não confirmada";
  const referencePresident = references.president?.error ? [] : references.president?.candidates ?? [];
  const liveConfigurationNote = !live.configured ? (
    <div className="election-empty-state">
      <strong>Arquivos do segundo turno ainda não publicados</strong>
      <p>O TSE disponibilizou os resultados do primeiro turno. O monitor começará a consultar os arquivos do segundo turno quando os códigos e arquivos oficiais dessa rodada forem publicados.</p>
    </div>
  ) : null;
  const retryHint = snapshot.status === "partial" ? (
    <p className="election-partial-hint">Alguns arquivos oficiais não responderam. As UFs sem arquivo disponível permanecem sem classificação.</p>
  ) : null;

  let body;
  if (coverage === "BR") {
    body = (
      <>
        <ElectionMap features={stateMapFeatures} states={states} liveStates={live.states} coverage={coverage} overallResult={live.president} />
        <div className="election-live-grid">
          <CandidatePair
            candidates={live.president?.candidates}
            title="Presidente · Brasil"
            eyebrow="RESULTADO DO 2º TURNO"
            context="Esta área mostra apenas os dados da segunda votação; nenhum resultado é estimado."
            emptyMessage="A apuração presidencial do segundo turno ainda não começou ou o arquivo oficial ainda não está disponível."
            sourceUrl={live.president?.sourceUrl}
            publishedAt={live.president?.publishedDate && live.president?.publishedTime ? live.president.publishedDate + " às " + live.president.publishedTime : null}
            period="Segundo turno de 2026."
            resultLabel={live.president ? (live.president.finalized ? "Totalização final" : "Em apuração") : "Aguardando votação"}
          />
          <ElectionTotalizers
            result={live.president}
            title="Totalizadores nacionais"
            subtitle="O total nacional da Presidência inclui a totalização das seções no exterior."
          />
        </div>
        <details className="election-history-details">
          <summary><span>Consultar resultados oficiais do primeiro turno</span><small>Presidência e governos estaduais · 04/10/2026</small></summary>
          <section className="election-first-round-section">
            <div className="panel-head">
              <div>
                <div className="section-kicker">DADOS OFICIAIS · REFERÊNCIA</div>
                <h2>Primeiro turno · Presidência</h2>
              </div>
              <span className="quiet-badge">Votação em 04/10/2026</span>
            </div>
            <p className="panel-intro">Resultado oficial da primeira votação, separado da apuração do segundo turno. Os dois candidatos mais votados aparecem em destaque; a lista completa reúne as 12 candidaturas e os retratos oficiais do TSE.</p>
            <div className="election-live-grid election-first-round-grid">
              <CandidatePair
                candidates={referencePresident}
                title="Candidaturas mais votadas"
                eyebrow="RESULTADO DO 1º TURNO"
                context="Ordem decrescente de votos válidos, conforme a totalização do TSE."
                sourceUrl={references.president?.sourceUrl}
                publishedAt={publishedAt}
                period="Primeiro turno de 2026; totalização oficial."
                frequency="Arquivo final do primeiro turno; sem atualização periódica prevista."
                resultLabel="Finalizado pelo TSE"
              />
              <ElectionTotalizers
                result={references.president?.error ? null : references.president}
                title="Totalizadores nacionais"
                subtitle="Votação do primeiro turno para presidente; o total nacional inclui o Exterior."
                period="Primeiro turno de 2026"
                frequency="Arquivo final do primeiro turno; sem atualização periódica prevista."
              />
            </div>
            <CandidateResultsTable
              candidates={referencePresident}
              title="Resultado completo das candidaturas presidenciais"
              sourceUrl={references.president?.sourceUrl}
              publishedAt={publishedAt}
              period="Primeiro turno de 2026; Brasil, incluindo Exterior."
              collapsed
            />
          </section>
          <GovernorFirstRoundResults referenceStates={references.states} />
        </details>
        <details className="election-history-details election-uf-table-details">
          <summary><span>Consultar apuração por estado</span><small>Tabela completa · 27 UFs</small></summary>
          <ElectionStatesTable states={states} liveStates={live.states} />
        </details>
        {liveConfigurationNote}
      </>
    );
  } else {
    const selectedStateReference = references.states?.find((state) => state.uf === coverage)?.governor;
    const stateReferenceErrors = selectedStateReference?.error || references.president?.error;
    body = (
      <>
        <ElectionStatePage snapshot={snapshot} coverage={coverage} />
        {liveConfigurationNote}
        {stateReferenceErrors ? <p className="election-partial-hint">A integração não confirmou todos os arquivos desta abrangência; os dados ausentes continuam vazios.</p> : null}
      </>
    );
  }

  return (
    <div className="election-content" data-phase={phase}>
      <span id="election-data-announcement" className="visually-hidden" role="status" aria-live="polite" />
      {snapshot.stale ? (
        <div className="election-stale-alert" role="alert">
          <strong>Dados desatualizados.</strong> {snapshot.message || "A última resposta válida foi preservada."}{" "}
          <button className="inline-action" type="button" onClick={onRetry}>Tentar novamente</button>
        </div>
      ) : null}
      <div className="election-official-notice" role="status">
        <span aria-hidden="true">i</span>
        <p><strong>Dados oficiais do TSE; podem mudar durante a apuração.</strong><br />Os valores de segundo turno ficam vazios até a publicação dos arquivos oficiais. Valores exibidos como referência estão identificados como primeiro turno.</p>
      </div>
      {retryHint}
      <div className="election-status-line">
        <span className="election-status-pill">{phaseLabels[phase]}</span>
        <span id="election-updated-at">{updatedLine}</span>
      </div>
      {body}
      <ElectionMetadata
        definition="Ciclo de acompanhamento da eleição presidencial e, quando houver, do segundo turno para governador."
        unit="Datas e horários em Brasília; votos, seções e percentuais conforme cada bloco."
        period="Segundo turno das Eleições 2026, em 25/10/2026."
        sourceUrl={references.sourceUrl}
        publishedAt={publishedAt}
        frequency={live.configured
          ? "Consulta a cada 45 segundos durante a apuração, pausada quando a aba está oculta."
          : "Referência do primeiro turno consultada com cache; atualizações do segundo turno dependem da publicação de seus arquivos oficiais."}
        notes="Votos válidos excluem brancos e nulos. A totalização presidencial nacional inclui o exterior; o recorte Exterior é apenas presidencial. Status de eleita ou eleito só é exibido quando vier do TSE."
      />
    </div>
  );
}
