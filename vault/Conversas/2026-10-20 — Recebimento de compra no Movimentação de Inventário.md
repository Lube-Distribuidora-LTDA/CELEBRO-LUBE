---
tipo: conversa
data: 2026-10-20
projeto: "[[MOVIMENTAÇÃO DE INVENTÁRIO]]"
departamento: Logística
status: resumido
tags: [conversa, inventario, recebimento, wms, winthor, bi]
---
# 2026-10-20 — Recebimento de compra no Movimentação de Inventário

## Resumo
Sessão aberta pela conversa de origem do sistema ([[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]) para
investigar se o **recebimento de compra (rotina 1301)** entra no estoque bloqueado e, se sim, colocá-lo no painel. Confirmado
pela própria fonte e colocado no painel: o livro da 266 não registra esse bloqueio, mas **a linha da nota no PCMOV grava quanto
entrou bloqueado** (`PCMOV.QTBLOQUEADA`), e a foto diária do estoque do WinThor (`PCHISTEST`) fecha com isso.

## O que a investigação achou (só leitura no Oracle)
- **A ligação pelo WMS não serve de prova.** Filial 1, desde 28/03/2025: das 41,8 mi de unidades recebidas, só ~45% dos pares
  transação × produto têm liberação do WMS com a mesma transação e a mesma quantidade. De abr a ago/2025 o WMS **não liberava
  recebimento nenhum** (a liberação era manual na 266, motivo 53 "Conferido pelo recebimento" — 9.316 registros e 19,9 mi de un.
  na filial 1); desde set/2025, de 30% a 45% dos pares, mês a mês, seguem sem WMS pela transação. O WMS às vezes **libera uma carga com várias notas
  citando a transação de só uma** (ex.: a 1167170 liberou produtos que entraram pela 1167167, mesmo fornecedor e dia); o
  `NUMBONUS` vem vazio, não ajuda.
- **O próprio PCMOV diz:** `QTBLOQUEADA = QT` em 99,8% das linhas de recebimento da filial 1 e em 100% das filiais 7, 10, 11
  e 12. Exceções gravadas pela fonte: 59 linhas com `ESTOQUEDESBLOQUEADO = 'S'` (entraram livres, 55.530 un.), 7 em parte, e
  1 erro de digitação.
- **Prova contra o documento da fonte (`PCHISTEST`, foto diária do bloqueado):** produto × mês, set/2025–out/2026, somar o
  recebimento derruba o que o livro não explica de **35,6 mi para 4,5 mi de unidades** na filial 1 (filial 10: 467 mil → 0;
  7: 1,6 mi → 278 mil; 12: 1,7 mi → 260 mil). Só **0,4%** dos produto × mês da filial 1 fecham *sem* o recebimento. Dia a
  dia: em 20.077 janelas produto × dia, a variação do bloqueado é **exatamente** o `QTBLOQUEADA` do recebimento.
- **Cancelamento do recebimento:** o estorno tira do bloqueado só se a mercadoria ainda não tinha sido liberada — 81% das vezes
  na filial 1 (quase sempre quando o WMS ainda não tinha liberado), 44% na 12 — e nada no WinThor diz qual foi o caso.
- **Os 17 milhões de paletes explicados:** o "desbloqueio impossível" de 17.000.043 PALLETE CHEP em 04/07/2025 era a liberação
  de um **recebimento de 17 paletes lançado com 17.000.000 bloqueados** em 27/06/2025 (transação 918016, ER). A foto do estoque
  mostra o salto no bloqueado **e no estoque** (`QTESTGER` 521 → 17.000.521); o bloqueado voltou no desbloqueio de 04/07 e o
  estoque já estava certo em 01/08/2025 (556; hoje 263). O erro está na entrada; o que sobra é o registro da nota.
- **A hora do recebimento:** `PCNFENT.DTENT` + `HORALANC` + **`MINUTOLANC`** (o minuto existe e vem preenchido). A hora do PCMOV
  vem em lotes (08:12, 16:01…) e fecha pior com a foto do estoque.
- **Fora do escopo, para depois:** a devolução ao fornecedor (1302, `SD`) e a 1322 (`SR`) tiram do bloqueado pelo PCMOV sem
  passar pelo livro (filial 1: 143 mil e 520 mil un. desde 28/03/2025); e o WMS às vezes grava liberação que não mexe no saldo
  (o "antes" dele é o "depois" + a liberação, não o saldo verdadeiro).

## Decisões
- 2026-10-20 (Claude): a regra se confirma **pela linha da nota**, não pela liberação do WMS: o recebimento entra no painel
  com a quantidade `PCMOV.QTBLOQUEADA`. Tipos novos: **13 Recebimento de compra** (entra no bloqueado), **14 Recebimento
  cancelado** e **15 Recebimento sem bloqueio** (os dois neutros, à mostra, fora de "entrou" e "saiu").
- 2026-10-20 (Claude): hora do recebimento = hora de lançamento da nota (com minuto).
- 2026-10-20 (Claude): **tempo de armazenagem do recebimento** = da nota lançada à última liberação do WMS da mesma transação,
  só nas notas que o WMS liberou por inteiro (o limite fica escrito na tela).
- 2026-10-20 (Claude): o recebimento **não conta como "último bloqueio"** em Bloqueado hoje (entra e sai em horas; esconderia a
  idade do que ficou parado) — assim o "há mais de 90 dias" não muda.
- 2026-10-20 (Claude): o painel **continua sem saldo do período** (o livro ainda tem outras falhas, ver acima).
- 2026-10-20 (Claude): o menu "Rotina 266" virou **"Estoque bloqueado"** e a tela "Devoluções e WMS" virou **"Recebimento e
  devoluções"**.

## O que foi criado ou mudou
- [[MOVIMENTAÇÃO DE INVENTÁRIO]]: tabela `inventario.fato_recebimento` (55.571 linhas), migração **`inventario_07_recebimento`**
  (registrada no Supabase), view `vw_movimento` com o recebimento, `painel_dados()` lendo o recebimento; consulta `recebimento`
  no ETL; `etl/conferir_recebimento.py` (a prova, sem gravar); diagnóstico conta as linhas de recebimento por situação; tela
  **Recebimento e devoluções** com recebimento que entrou bloqueado, tempo de armazenagem, liberado pelo WMS, recebimento
  cancelado, entrou sem bloqueio, gráfico entradas × liberações e a tabela de notas de recebimento. Commit local **`cf65b78`**
  (sem push).
- `P:\INTEGRAÇÃO BI\INVENTARIO`: consulta, diagnóstico, LEIA-ME e o `conferir_recebimento.py` atualizados (eram iguais ao
  commit anterior).
- **Tela × banco, ao centavo** (filial 1, 2026, carga das 08:30): recebimento 22.046 linhas, 28.815.075,329 un.,
  **R$ 87.988.623,75**, 4.259 notas, 4.342 SKUs; cancelado R$ 12.087.343,37; sem bloqueio R$ 176.558,18; liberado pelo WMS
  R$ 75.330.666,51; tempo mediano de armazenagem **7,3 h** (1.876 notas medidas, 44% das notas). Nenhum erro no console nas 7
  telas.
- [[Inventário - Sync]]: passo novo `recebimento` (55 mil linhas).

## Pendências
- [ ] **Júlio / logística:** decidir se corrige no WinThor o registro do recebimento 918016 (17 paletes com 17.000.000
  bloqueados). O estoque já está certo desde ago/2025; o painel deixa a entrada e o desbloqueio de 04/07 fora das somas, com
  aviso.
- [ ] Ler a devolução ao fornecedor (1302) e a 1322 como saída do bloqueado (PCMOV `SD`/`SR` com `QTBLOQUEADA`).
- [ ] Saber com a Kaizen por que o WMS cita a transação de outra nota da mesma carga (o tempo de armazenagem hoje mede 44% das
  notas da filial 1).
- [ ] **Subir o `cf65b78` antes do próximo deploy na Vercel**: o `b9554f9` publicado quebra com o pacote novo (tipos 13 a 15).
- [ ] As pendências de variáveis da Vercel e agendamento do sistema continuam com o Júlio (ver a nota do projeto).
