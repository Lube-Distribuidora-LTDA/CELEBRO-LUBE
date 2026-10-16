---
tipo: conversa
data: 2026-09-28
projeto: "[[BI COMERCIAL]]"
departamento: Comercial
status: resumido
tags: [conversa, bi, comercial, painel, visual, incidente, supabase]
---
# 2026-09-28 — Painel comercial repaginado e o banco que parou

Continuação, na mesma noite, de [[2026-09-28 — BI COMERCIAL do Power BI ao DATA WAREHOUSE]]; terminou em
2026-09-29.

## Resumo
Com o [[BI COMERCIAL]] no ar, o Júlio pediu para **tirar das telas toda explicação sobre o Power BI**, melhorar a
navegação das tabelas grandes, destacar e centralizar os totais e deixar o painel **menos azul, mais luxuoso e com
animação**. O Claude refez o `index.html` e o `app.js`. No meio, o banco DATA WAREHOUSE parou de responder; as
migrações que tiram a tabela de 594 MB do caminho do painel só entraram em 2026-09-29, quando ele voltou. No dia
seguinte vieram três correções de tela pedidas pelo Júlio.

## Decisões
- 2026-09-28 (Júlio): **nenhuma tela fala de como era no Power BI.**
- 2026-09-28 (Claude): a história da migração vive no README e em [[BI COMERCIAL — documentação técnica]], não
  na tela de uso diário. O bloco "Conferência da comissão" virou "Como o total muda conforme o grão".
- 2026-09-28 (Claude): ouro (`#e9c877`) como acento; paleta de dados validada contra o fundo azul-marinho
  (azul venda `#5f7ef5`, ouro comissão `#b8892a`, violeta devolução `#8a6ce8`, verde margem `#1a9468`, as
  variáveis `--viz-1` a `--viz-4` do `index.html`); verde/âmbar/vermelho só para estado. Validada pela skill de
  visualização (faixa de luminosidade, croma, separação para daltonismo e contraste).
- 2026-09-28 (Claude): **animações finitas**, que assentam. Fundo animado sem parar repintava a tela o tempo
  todo, pesava em máquina modesta e travava até a captura de tela.
- 2026-09-28 (Claude): gráfico nunca com dois eixos — dinheiro e percentual em dois desenhos empilhados; a rosca
  de duas fatias virou barra de proporção.
- 2026-09-28 (Claude): o painel lê a margem da `mv_margem_dia` (grão de **dia**, para responder qualquer
  intervalo de datas) e não da `fato_margem_item`.
- 2026-09-28 (Claude): **não pausar o projeto pelo MCP** (tiraria o banco do ar); pedir ao Júlio o *Restart
  project* no Supabase.

## O que foi criado ou mudou
- **Painel (commit `61b8df3`, 2026-09-28 18:22):** duas primeiras colunas fixas, cabeçalho fixo com rolagem
  própria, botão "Colunas essenciais / Todas as colunas" (a comissão abre com 9 de 15), #1 a #3 em ouro, barra
  proporcional atrás da coluna principal, paginação completa com 25/50/100/tudo; totais numa faixa centralizada
  acima da tabela; número-herói com degradê em cada página; números que sobem contando.
- **Banco (commit `a67b3fd`, 18:33; aplicado em 2026-09-29):** `web/db/03-margem-agregada.sql` (`mv_margem_dia`
  e o índice `ix_margem_piores`) e `web/db/04-painel-dados-v2.sql` (resumo e ranking leem da view; só a lista dos
  piores itens toca a tabela grande). Aplicados por script com `statement_timeout = '45min'`,
  `lock_timeout = '3min'` e `ANALYZE` no fim: a `painel_dados` caiu de 2,4 s (quente) e mais de 60 s (frio) para
  **0,2 s**.
- **Correções de 2026-09-29 (commit `d882156`), relatadas pelo Júlio:**
  - filtro de filial: estando em "Todas", clicar em "Filial 1" acendia as outras três (o código tirava a clicada do
    conjunto cheio). Agora, a partir de "Todas", o clique seleciona só aquela; depois cada clique soma ou tira, e
    esvaziar volta para "Todas". Vale também para a posição dos pedidos;
  - KPIs desalinhados (dinheiro em 19,5 px, percentual em 26 px, rótulo de duas linhas empurrando o número):
    grade de três faixas e um tamanho de número só (23 px), 2 × 2 fixo ao lado do número-herói;
  - gráfico de margem de 112 para 185 px; a linha dos 20% tracejada e mais grossa, com o rótulo numa plaqueta à
    esquerda; os rótulos dos pontos desviam para baixo quando caem perto da linha.
- [[BI COMERCIAL]]: seções do incidente e "Resolvido em 2026-09-29".

## O incidente (2026-09-28 ~17:45 até 2026-09-29)
O DATA WAREHOUSE parou de responder depois da carga de 594 MB e das leituras cheias dos testes: autenticação
estourando 15 s, `autovacuum worker took too long to start` e, no pooler, `DbHandler: Connection failed
{:error, :timeout}`. Os scripts de reaplicação falharam 61 vezes e depois mais 30. Em 2026-09-29 o banco voltou.

**Dois diagnósticos errados do Claude, corrigidos depois:** (1) disse que o banco recusava conexão, mas a
migração entrava e morria por `statement timeout` (a DDL da view sobre 3,3 milhões de linhas); (2) concluiu que
o Postgres tinha caído porque o log parou, quando o silêncio era atraso de ingestão — a prova real foi o log do
pooler. Detalhes em [[BI COMERCIAL]] (seção do incidente). Os outros incidentes do mesmo banco estão em
[[Supabase]].

## Pendências
- [x] Aplicar `03-margem-agregada.sql` e `04-painel-dados-v2.sql` — 2026-09-29
- [ ] **Achado de 2026-10-09:** a `mv_margem_dia` nunca entrou na lista de views que o ETL atualiza — ver
  [[BI COMERCIAL]]. Conferir no banco e corrigir.
