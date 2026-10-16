---
tipo: conversa
data: 2026-09-29
projeto: "[[BI COMERCIAL]]"
departamento: Comercial
status: resumido
tags: [conversa, bi, comercial, exportacao, excel]
---
# 2026-09-29 — Exportação do painel comercial em Excel

## Resumo
O Júlio pediu que as planilhas exportadas do [[BI COMERCIAL]] saíssem **formatadas, com aparência de luxo,
filtros e cores**. O Claude trocou o CSV por um `.xlsx` de verdade, gerado no navegador por um gerador próprio
(`web/planilha.js`), sem biblioteca externa. Validado com o dado real e enviado ao Júlio como amostra.

## Decisões
- 2026-09-29 (Júlio): planilha que sai do painel é **`.xlsx` formatado**, não CSV.
- 2026-09-29 (Claude): o `.xlsx` é escrito à mão (um ZIP com alguns XML). As bibliotecas populares pesam de
  400 KB a 1 MB, viriam de um CDN a cada clique e quebrariam se a rede da empresa bloqueasse o domínio.
- 2026-09-29 (Claude): **número sai como número** — moeda `"R$" #,##0.00`, `0.00%`, `#,##0` e `dd/mm/yyyy`
  nativos — para quem recebe somar, ordenar e filtrar sem retrabalho. Percentual fica vazio na linha de total, de
  propósito: média de percentual sem peso mente.

## O que foi criado ou mudou
- `web/planilha.js` (novo): faixa de identidade da Lube em azul-marinho com o nome em dourado; os filtros
  aplicados escritos por extenso (período, filiais, supervisor, busca, limite de margem, data de geração,
  quantidade de linhas); cabeçalho congelado e filtro automático em todas as colunas; linhas alternadas, negativo
  em vermelho, largura pelo conteúdo, página em paisagem, linha de total.
- `web/app.js`: cada coluna declara o tipo e entrega o valor cru; `exportarPlanilha()` no lugar do
  `exportarCsv()`; botão "Exportar Excel" em toda tabela. `index.html` carrega o `planilha.js` antes do `app.js`.
- `README.md`: seção "A exportação". Tudo no commit `4d9d739` (deploy automático, READY).
- Conferido abrindo com `openpyxl` a planilha de setembro (130 vendedores): painel congelado em A11, filtro em
  A10:J140, moeda e percentual com o formato nativo.
- [[Como eu gosto dos BIs]]: seção "Exportação (2026-09-29)", que vale para os próximos BIs.
- [[BI COMERCIAL]]: a exportação registrada em "O que o painel tem".

## Incidente pequeno
- Dois servidores de teste ficaram na mesma porta (8732) e o teste caiu no servidor antigo. Os dois foram
  encerrados e o teste passou para a 8733.

## Pendências
- [x] Registrar a exportação `.xlsx` em [[BI COMERCIAL]] — 2026-10-09
