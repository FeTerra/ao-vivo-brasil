# Ao Vivo Brasil

Painel público em português-BR migrado para Next.js, React e Tailwind CSS. O projeto preserva o catálogo demonstrativo, os módulos temáticos, o mapa das UFs e a consulta de resultados eleitorais do TSE.

## Executar localmente

Use Node.js 22.15 ou superior:

```sh
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Para gerar e iniciar a versão de produção:

```sh
npm run build
npm start
```

## Eleições 2026

- O painel fica em `#eleicoes/segundo-turno`; Brasil, UFs e Exterior são refletidos na URL.
- A rota `src/app/api/eleicoes/segundo-turno/route.ts` usa o serviço `src/services/election-api.mjs` para validar a abrangência; `server.mjs` consulta os arquivos oficiais, mantém cache e preserva a última resposta válida.
- Os códigos `6257` (federal) e `6259` (estadual) são usados como referência do primeiro turno. A relação de estados com disputa para governador é derivada dos arquivos do TSE.
- O painel separa resultados oficiais do primeiro turno da apuração do segundo turno. O mapa presidencial por UF identifica os percentuais demonstrativos como não oficiais.
- Quando o TSE publicar os códigos oficiais do segundo turno, configure `TSE_2026_SECOND_TURN_FEDERAL_CODE` e `TSE_2026_SECOND_TURN_STATE_CODE`. Durante a apuração, o painel consulta a cada 45 segundos, pausa com a aba oculta e respeita o cache do servidor.
- O recorte Exterior usa o arquivo oficial específico do primeiro turno; ele não substitui nem duplica o total nacional.

## Scripts

```sh
npm run dev
npm run build
npm start
npm run lint
npm test
```

## Fontes e conteúdo

- [Resultados oficiais do TSE](https://resultados.tse.jus.br/oficial/app/index.html)
- [Informações técnicas sobre a divulgação de resultados](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados)
- [Resolução do calendário eleitoral de 2026](https://www.tse.jus.br/legislacao/compilada/res/2026/resolucao-no-23-750-de-26-de-fevereiro-de-2026)
- Os indicadores econômicos e sociais permanecem vazios até a integração e validação das fontes oficiais. As pautas legislativas são fictícias e estão identificadas como demonstração.
- O mapa estadual é esquemático e não representa resultados eleitorais.

## Estrutura

- `src/app/`: páginas, componentes React, layout, rota do TSE e estilos globais.
- `src/data.js`: catálogo de indicadores, propostas demonstrativas e UFs.
- `src/state-map.js`: contornos simplificados das 27 UFs.
- `src/elections.js`: normalização, formatação, rotas e regras da eleição.
- `src/election-components.js`: componentes React para os blocos de resultados eleitorais, fontes e metodologia.
- `src/election-view.tsx`: composição React do painel de resultados eleitorais.
- `src/services/tse-results.js`: cliente para a rota do TSE.
- `src/services/election-api.mjs`: adaptador da rota da eleição.
- `server.mjs`: consulta e cache em memória dos arquivos públicos do TSE.
- `tests/elections.test.mjs`: testes das regras eleitorais.

O Tailwind CSS v4 está habilitado por `@import "tailwindcss"` em `src/app/globals.css`.
