# Ao Vivo Brasil

Painel público em português-BR, construído com HTML, CSS e JavaScript nativos. Não há dependências de terceiros.

## Executar localmente

Use Node.js 22.15 ou superior para servir a interface e o adaptador do TSE no mesmo endereço:

```powershell
node server.mjs
```

Abra [http://localhost:8000](http://localhost:8000). Encerre o servidor com `Ctrl+C`.

## Eleições 2026

- A página está em `#eleicoes/segundo-turno`; as abrangências Brasil, UFs e Exterior são refletidas na URL.
- `server.mjs` consulta os arquivos JSON públicos documentados pelo TSE, valida o turno e mantém cache e última resposta válida em memória.
- Os códigos `6257` (federal) e `6259` (estadual) são usados apenas para a referência oficial do primeiro turno. A relação de estados com disputa para governador é derivada dos arquivos do TSE; não está fixa no código.
- A página mostra o resultado presidencial completo do primeiro turno e, para cada disputa estadual habilitada, os dois candidatos mais votados nessa rodada. No detalhe de cada UF, ficam disponíveis os totalizadores e a lista completa de candidaturas da eleição para governador. Os retratos presidenciais usam o arquivo nacional do TSE em todos os recortes; fotos de governador usam o arquivo estadual. Se uma foto não estiver disponível, aparecem as iniciais.
- O mapa presidencial por UF é um componente de acompanhamento. Antes dos arquivos do segundo turno, o 0% é apenas demonstrativo da interface e fica identificado como não oficial; os votos e totalizadores da segunda rodada permanecem vazios.
- O TSE ainda não publicou a identificação/arquivos de apuração do segundo turno no leiaute consultado. Por isso, os resultados dessa rodada permanecem vazios e rotulados; os dados do primeiro turno aparecem em blocos separados como referência.
- Quando o TSE publicar os códigos oficiais do segundo turno, o servidor aceita `TSE_2026_SECOND_TURN_FEDERAL_CODE` e `TSE_2026_SECOND_TURN_STATE_CODE` no ambiente. A interface consulta a cada 45 segundos durante a apuração, pausa com a aba oculta e respeita o cache do servidor.
- Os resultados do primeiro turno no Exterior são lidos do arquivo específico oficial de abrangência `zz`, sem substituir esses números pelo total nacional. O arquivo específico do segundo turno para Exterior ainda depende de publicação pelo TSE; o total nacional presidencial é apresentado separadamente pelo arquivo nacional.
- A integração exige um servidor que execute Node.js. Hospedagem estática, como GitHub Pages, não executa o proxy `server.mjs`.

## Testes

```powershell
node --test tests/elections.test.mjs
```

## Conteúdo e fontes

- [Resultados oficiais do TSE](https://resultados.tse.jus.br/oficial/app/index.html)
- [Informações técnicas sobre a divulgação de resultados](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados)
- [Resolução do calendário eleitoral de 2026](https://www.tse.jus.br/legislacao/compilada/res/2026/resolucao-no-23-750-de-26-de-fevereiro-de-2026)
- Os indicadores econômicos e sociais seguem sem valores até a integração e validação de suas fontes. As pautas legislativas existentes são fictícias e identificadas como demonstração.
- O mapa estadual existente é esquemático e não representa resultados eleitorais.

## Estrutura

- `index.html`: estrutura semântica da aplicação.
- `styles.css`: identidade visual, responsividade e estados acessíveis.
- `src/data.js`: catálogo de indicadores, propostas demonstrativas e UFs.
- `src/state-map.js`: contornos simplificados das 27 UFs.
- `src/app.js`: navegação, home, módulos e interface eleitoral.
- `src/elections.js`: normalização, formatação, rotas e regras de estado da eleição.
- `src/election-components.js`: fichas, totalizadores, pares de candidaturas e tabela de UFs.
- `src/services/tse-results.js`: adaptador cliente para a API local.
- `server.mjs`: servidor local e proxy/cache para os arquivos públicos do TSE.
- `tests/elections.test.mjs`: testes nativos de Node.js para a página eleitoral.
