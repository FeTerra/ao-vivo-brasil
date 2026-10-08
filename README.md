# Ao Vivo Brasil

Primeira versão responsiva de um painel público sobre indicadores e atividade legislativa no Brasil. A aplicação usa HTML, CSS e JavaScript nativos e não precisa instalar dependências.

## Executar localmente

Como a interface usa módulos JavaScript, abra a pasta por um servidor HTTP local. Com Python instalado, no PowerShell, execute na raiz do projeto:

```powershell
py -m http.server 8000
```

Depois, acesse [http://localhost:8000](http://localhost:8000). Encerre o servidor com `Ctrl+C`.

## Conteúdo e fontes

- Os indicadores estão modelados em `src/data.js`, com `value: null` enquanto não houver uma integração validada.
- As fichas exibem definição, unidade, período, fonte prevista, data de publicação, frequência esperada e observações metodológicas.
- Os itens legislativos são fictícios, identificados como demonstração e sem links para registros oficiais.
- O mapa de UFs usa geometria simplificada da API de Malhas do IBGE, embutida localmente; a visualização não codifica indicadores.
- Nenhuma API foi conectada; fontes indicadas são órgãos previstos e não representam uma coleta nesta versão.
- O componente de séries contempla estados de carregamento, ausência de dados e erro para futuras integrações.
- As fichas direcionam ao portal institucional da fonte prevista e indicam que o link da série específica ainda depende da integração.
- O componente de séries contempla estados de carregamento, ausência de dados e erro para futuras integrações.

## Estrutura

- `index.html`: marcação da página e estrutura semântica.
- `styles.css`: identidade visual, responsividade e estados acessíveis.
- `src/data.js`: catálogo tipado por objetos para futuras integrações oficiais.
- `src/state-map.js`: contornos simplificados das 27 UFs, com atribuição à API de Malhas do IBGE.
- `src/app.js`: navegação, busca, fichas, pautas demonstrativas e recorte por UF.
