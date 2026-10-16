---
tipo: conversa
data: 2026-10-09
projeto: "[[BI COMPRAS]]"
departamento: Compras
status: resumido
tags: [conversa, bi, compras, painel, interatividade]
---
# 2026-10-09 — Clique no número abre a planilha filtrada no BI COMPRAS

## Resumo
O Júlio pediu para o [[BI COMPRAS]] funcionar como o [[REPOSIÇÕES E CHAMADOS]]: clicar em qualquer número leva à
planilha bruta com os filtros já aplicados, e passar o mouse nos gráficos mostra um pop-up. Foi feito nas 8 páginas do
`web/index.html`, seguindo o padrão do repositório `9. REPOSICOES` (analisado por um subagente). Testado com dados
simulados no computador e no celular: os 50 KPIs bateram com a planilha. Commit `485ef61`, publicado em produção às
10:03 (deploy `dpl_CBUs93hquLnZT8KoToyo3fV8vFkE`, READY).

## Decisões
- 2026-10-09 (Júlio): seguir o padrão do sistema de Reposição — busca fácil e dinâmica, e todo número leva à planilha
  bruta já filtrada.
- 2026-10-09 (Claude): o clique troca **só a dimensão clicada** e mantém os outros filtros, como no Reposições.
- 2026-10-09 (Claude): gráfico sem planilha por item fica só com o pop-up; a tabela da página 06 segue o "corte" escolhido.

## O que foi criado ou mudou (commit `485ef61`, `web/index.html`)
- Um "kit" por página: clicar em KPI, fatia ou legenda de rosca, coluna, barra de ranking, linha ou célula da matriz por
  comprador (página 01 Compras) ou linha de ranking (Performance e Métricas) troca só o filtro clicado, rola até a
  planilha e faz o cartão pulsar.
- Faixa **"Filtros na planilha"** acima da tabela, com ✕ para tirar cada filtro, e botão **"← Voltar"**, que devolve os
  filtros e a posição de antes do clique. "Limpar" passa a zerar o estado sem recriá-lo (`kit.limpar`). Trocar de aba
  pelo menu descarta o Voltar.
- Saltos entre páginas: o KPI Verba da página Compras abre Saldo verba; as células Verba e Saldo da matriz abrem Saldo
  verba e Saldo verba x avaria já com o comprador filtrado.
- As tabelas ganham linha de **Total** (colunas `soma:true`), que soma todas as linhas do filtro, e não só a página.
- Um único pop-up que segue o mouse em roscas, colunas e rankings: nome completo, valores, percentual e a dica de clique;
  a coluna sob o mouse fica destacada; em Métricas mostra venda, lucro, pedidos e margem do mês.
- Página 03 Estoque x venda: a planilha ganha uma coluna por semana, e a coluna do gráfico abre os produtos daquela semana.
- Página 07 Métricas: chips "Planilha" (mês a mês ou por dimensão), com título por visão; as barras de departamento,
  estado e seção abrem a planilha da própria dimensão.
- `abrir(id, semRolar)` e compensação da altura do cabeçalho fixo ao rolar até a planilha.

## Erros e incidentes
- O teste automático no navegador estourou o tempo de 45 s com o painel do navegador escondido (rodou 27 de cerca de 50
  cliques na primeira tentativa); depois foi completado.
- O texto central da rosca roubava o mouse do anel. Resolvido com `pointer-events:none` no `.donut-center`.

## Preferências do Júlio
Busca nos dados fácil e dinâmica para quem acessa; todo número clicável leva à planilha bruta já filtrada; pop-up ao
passar o mouse nos gráficos. Ver [[Como eu gosto dos BIs]].

## Pendências
- [ ] Júlio: conferir em produção (`painel-compras-rosy.vercel.app`) com o dado real — o Claude só testou com dados
  simulados. O deploy está no ar (conferido em 2026-10-09).
- Detalhes por página podem não estar todos aqui; o diff completo está no commit `485ef61`.
