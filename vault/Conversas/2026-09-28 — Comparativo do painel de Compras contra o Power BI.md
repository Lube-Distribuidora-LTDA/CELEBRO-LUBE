---
tipo: conversa
data: 2026-09-28
projeto: "[[BI COMPRAS]]"
departamento: Compras
status: resumido
tags: [conversa, bi, compras, power-bi, validacao]
---
# 2026-09-28 — Comparativo do painel de Compras contra o Power BI

## Resumo
Assunto de 28 a 30/09. O Júlio mandou o documento `Comparativo-Painel-Compras-vs-PowerBI.md` (na pasta Downloads) para
investigar as divergências entre o [[BI COMPRAS]] e o Power BI antigo. Uma consulta direta ao [[Oracle]], só de leitura,
mostrou que a diferença na venda de 9 semanas vem do **escopo de filial**: o filtro 1/10/7 deixa de fora as filiais 11 e
12, e a 10 não teve venda. As hipóteses de devolução e de cancelamento caíram. O Júlio mandou **manter o BI como está e
corrigir só o que for texto**; o que mexe em número espera a confirmação dos responsáveis.

## Decisões
- 2026-09-28 (Júlio): manter o BI do jeito que está e corrigir só texto. Tudo que mexer em número espera a confirmação
  dos responsáveis da área.
- 2026-09-28 (Claude): o painel reproduz fielmente o SQL documentado da Consulta6. A hipótese é que o número do Power BI
  venha de uma medida DAX que passa pela relação muitos-para-muitos com a Consulta4 — não dá para confirmar sem abrir o
  Power BI. Ver [[BI COMPRAS — documentação técnica]].

## O que foi criado ou mudou
- 2026-09-28: investigação no Oracle, só leitura, com um script fora do repositório usando o `ENV` de `C:\BI\COMPRAS`.
  Venda de 9 semanas: **painel 5.288.356** contra **6.166.650 no Power BI**; sem filtro de filial dá 6.055.516; filial
  12 = 578.997, filial 11 = 188.121, filial 10 = 0.
- 2026-09-28, commit `f9611c9` (`web/index.html`, só texto, nenhum cálculo):
  - a nota de avaria da página 02 passa a dizer "Todas as filiais, só dos fornecedores com verba" (por isso o total não
    bate com a avaria da página 01);
  - o rodapé e a nota de Atualização deixam de falar em "fotografia" e passam a dizer que o dado é ao vivo do DATA
    WAREHOUSE, alimentado a partir do Oracle/WinThor, com cache de 10 min e o botão Atualizar;
  - fica escrito que o painel usa **uma só definição de ruptura** (a segunda, em DAX, não foi trazida);
  - fica escrito que "Valor sugerido" e "Valor por produto" são **duas consultas**, cada uma com as próprias filiais
    (KPI "Filiais 1, 2, 7 e 8").
- 2026-09-30: conferido que a produção (`dpl_2fCp9bCEEBU38K29NMtHic4sDwcn`) era o commit `f9611c9`; `controle_carga`
  com tudo OK.

## Erros e incidentes
- As duas hipóteses do documento (devolução `CODOPER = 'ED'` e `DTCANCEL`) não se confirmaram no SQL real.

## Preferência do Júlio
Mudança que mexe em número só depois de confirmar com os responsáveis da área.

## Pendências (aguardando os responsáveis — Júlio leva)
- [ ] Item 5.4: incluir as filiais 11 e 12 na venda de 9 semanas?
- [ ] Item 5.5: verba a vencer com diferença de −12,4%.
- [ ] Item 7.4: padronizar o conjunto de filiais entre as páginas.
- [ ] Item 7.3: unificar as três avarias numa fonte só.
- [x] Item 7.7 (proteção de acesso): sem mudança naquela conversa; resolvido em 2026-10-06 pela [[SENTINELA LUBE]].
