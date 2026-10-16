---
tipo: conversa
data: 2026-09-24
projeto: "[[BI COMPRAS]]"
departamento: Compras
status: resumido
tags: [conversa, bi, compras, comprador, etl]
---
# 2026-09-24 — Compradores que saíram da Lube

## Resumo
Assunto que foi de 24/09 a 01/10. O Júlio pediu para tirar do [[BI COMPRAS]] seis compradores que já não são da Lube
(matrículas **621, 278, 376, 375, 277 e 178**). Eles saíram do painel e do ETL, **sem apagar dado**. Em 30/09 o Júlio
viu muitos fornecedores com "—" e pediu para voltar com eles. Em 01/10 o Claude corrigiu o número que tinha passado: o
impacto real é de **0,8%**, e o Júlio mandou tirar de novo. Também ficou explicado que **CONSUMO (código 86) não é uma
pessoa**.

## Decisões
- 2026-09-24 (Júlio): um dos nomes pedidos, parecido com outros do cadastro, é a matrícula **376** — confirmado por pergunta.
- 2026-09-24 (Claude): tirar em **duas camadas**: no painel (`COMPRADORES_EXCLUIDOS` no `web/index.html`, efeito
  imediato) e no ETL (`NOT IN` na `SQL_DIM_COMPRADOR`, para não voltarem). Só o **nome** do comprador some; produto,
  fornecedor, estoque, avaria e faturamento continuam, com "—" no lugar do nome. Apagar quebraria a referência dos
  fornecedores ainda ligados a esses códigos.
- 2026-09-30 (Júlio): **pôr os 6 de volta** — muitos fornecedores apareciam sem comprador.
- 2026-09-30 (Claude): **CONSUMO (86)** continua separado no painel. É uma categoria interna do [[WinThor]], com 76
  fornecedores e 90 produtos de uso interno, manutenção e merchandising, e não uma pessoa.
- 2026-10-01 (Júlio): **tirar de novo**. O impacto real é de 58 produtos de 7.231 e 20 fornecedores com produto ativo;
  R$ 0,88 mi de R$ 108,9 mi de venda no ano (0,8%).

## O que foi criado ou mudou
- 2026-09-24, commit `137aadc`: filtro no painel e `NOT IN` no ETL.
- 2026-09-28: `consultas_compras.py` copiado para `P:\INTEGRAÇÃO BI\COMPRAS` e para `C:\BI\COMPRAS` (não tinha ido para
  a rede em 24/09). Depois da cópia, a carga na VM trouxe `dim_comprador` com 6 linhas.
- 2026-09-30, commit `cb2767b`: volta dos 6 nos dois lugares. Arquivo copiado para o P: e para `C:\BI\COMPRAS`; o Júlio
  copiou na VM e rodou "BI Compras - Sync rapidas"; os 12 compradores voltaram a ser atualizados às 09:31.
- 2026-10-01, commit `1d84a3f`: remoção refeita no ETL e no painel, com o impacto real escrito no comentário do código.
  P: remapeado e arquivo copiado para o P: e para a VM; na carga das 12:17 o `dim_comprador` voltou com 6 linhas.
- `core.dim_comprador` **nunca perdeu linhas**: a carga é upsert, então os 6 só deixaram de ser atualizados.

## Erros e incidentes
- 2026-09-24 e 2026-09-30 (Claude): informou "1.009 de 1.765 fornecedores (57%)" no nome dos que saíram. O número estava
  certo, mas era enganoso: 989 eram cadastro antigo, cujos produtos já foram excluídos do WinThor. Corrigido em
  2026-10-01 para 20 fornecedores com produto ativo e 58 produtos.
- 2026-09-24: a mudança do ETL foi só para o GitHub, e não para a pasta de rede. Por isso a VM ainda trouxe 12
  compradores em 28/09. **Lição:** mudança de ETL só vale depois de copiada para o P: **e** para o `C:\BI\COMPRAS` da
  máquina que roda.
- 2026-10-01: a VM rodou com o arquivo antigo porque o P: tinha caído na LOGISTICA-55; o banco mostrou os 6 ainda
  atualizados às 12:01.

## Preferência do Júlio
Filtros e coluna "Comprador" só com quem ainda está na Lube.

## Pendências
- [ ] Reatribuir no WinThor os 20 fornecedores e 58 produtos que ainda estão no nome dos compradores que saíram (no
  painel aparecem com "—") — Júlio, com a área de Compras.
- A view `compras.mv_fat_comprador` ainda guarda os códigos antigos que tiveram venda no ano. É esperado: quem esconde o
  nome é o painel.
