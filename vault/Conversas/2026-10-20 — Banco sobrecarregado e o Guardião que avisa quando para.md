---
tipo: conversa
data: 2026-10-20
projeto: "[[GUARDIÃO DA LUBE]]"
departamento: TI
status: resumido
tags: [conversa, guardiao, supabase, data-warehouse, pg_cron, pg_stat_statements, incidente]
---
# 2026-10-20 — Banco sobrecarregado e o Guardião que avisa quando para

## Resumo
Sessão aberta pela conversa do Inventário no Guardião (ver [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]),
que viu o pg_cron do [[GUARDIÃO DA LUBE]] falhar a manhã inteira. **Causa achada:** o `pg_stat_statements` do banco
DATA WAREHOUSE incha com os lotes de gravação dos ETLs, a consulta de métricas do próprio Supabase passa a levar 14–16 s
a cada minuto e o banco (Small, 2 GB) satura e cai — **cinco quedas em seis dias**, a última hoje às 11:22–11:30. E o
Guardião ganhou o item **"Guardião · Verificação na nuvem"**, que alarma quando ele próprio para de conferir.
Horários em Brasília (os logs do Supabase vêm em UTC).

## O que estava acontecendo (provado)
- **03:52–03:53 de 19/10 e de 20/10**, 7–8 min depois de a carga da margem do [[BI COMERCIAL]] começar (03:45, 3,4 mi de
  linhas), a consulta `with normalized_pg_stat_statements as (...)` passa a levar 14–16 s, **duas por minuto**. Quem a roda
  é o **`postgres_exporter` do próprio Supabase** (usuário `supabase_admin`), o coletor de métricas, a cada ~1 min, com ou
  sem painel aberto. Não é ferramenta da Lube.
- Ela lê o `pg_stat_statements` inteiro. Os ETLs gravam com `execute_values` em lotes de 2.000 ou 5.000 linhas
  (`bi_comum.py` de COMPRAS, COMERCIAL, REPOSICOES, TRADE, INVENTARIO e FISCAL; e o `gravar_trade.py`). Como o tipo dos
  valores muda de lote para lote (inteiro, decimal ou vazio), **quase todo lote vira uma entrada nova**, com 80 a 300 KB de
  texto. Medido depois do reinício de hoje: 11:35 → 130 entradas e 4,9 MB; 11:52 → 254 entradas e 8,9 MB, 56 delas
  gigantes e com 1 chamada só (o `reposicao.fato_chamado` sozinho: 14 entradas de 183 KB, uma por lote). A margem (~690
  lotes de 19 colunas) põe, pela conta, **algumas centenas de MB** de texto em 15 min — é o que vira a chave às 03:52.
- **08:00:** o expediente soma as cargas (Comercial 08:45, Inventário 09:05, Trade 09:25, Reposições 09:35…), as
  contagens do vigia do Guardião (14–31 s cada com o banco lento) e as análises à mão feitas hoje pelo MCP (Fiscal,
  Inventário). Tudo passa a dar `statement timeout` — **149 dos ~190 de hoje são da própria consulta de métricas** — e o
  pg_cron não consegue abrir conexão (`job startup timeout`). Cargas lentas: Inventário 18 min (31 s com o banco folgado),
  Comercial rápidas 17 min 44 s, `inventario.painel_dados()` 140–155 s.
- **O banco cai sem desligar direito** ("database system was not properly shut down; automatic recovery"): 15/10 07:57,
  16/10 15:06, 18/10 03:53 (no meio da margem), 19/10 09:57 (voltou 10:02) e **hoje 11:22 (voltou 11:30)**. Cada queda
  zera o `pg_stat_statements` e o ciclo recomeça; e deixa arquivo sem dono no disco (os 3,3 GB achados em
  [[2026-10-20 — Limpeza semanal e o espaço do banco]]).
- O agendador do Guardião falha **todo dia desde 15/10**: 17, 103, 26, 12, 2 e 35 falhas (14/10: zero).
- Depois do reinício: 10 conexões, nenhuma sessão ociosa presa, pooler normal. **Não há cliente descontrolado.**
- É a hipótese que ficou anotada em 2026-10-07 no [[Supabase]], agora provada.

## O que o Claude fez
- **Banco, só leitura:** logs do Postgres e do pooler de 15/10 a 20/10, `pg_stat_activity`, `pg_settings`,
  `pg_stat_statements`, `cron.job_run_details`, `net._http_response`. Nenhuma sessão morta, nenhuma configuração mudada.
- **Guardião:** migração **`saude_v1_guardiao_parado`** (`Desktop\BI\12. GUARDIAO\db\11_guardiao_parado.sql`; README
  atualizado; **sem commit**, a sessão que pediu não pediu commit):
  - item novo **`servico:guardiao-nuvem`** ("Guardião · Verificação na nuvem"), julgado pelo próprio banco a cada
    `saude.verificar()`: função `guardiao` mais de **25 min** sem rodar (o registro mais novo dos sites) = atenção,
    mais de **45 min** = falha; **3 ou mais falhas do agendador na última hora** = atenção, com o motivo ("job startup
    timeout: sinal de banco sobrecarregado"); em alarme, **só fecha depois de 1 hora sem falha**; e o **apagão** (nada
    avaliou o item por mais de 25 min) é contado na primeira avaliação depois;
  - a `saude.verificar()` ganhou o ramo e a `saude.registrar()` passou a recusar o item, **por âncora na definição que
    está no banco**; conferido depois: sem a linha nova, as duas têm o mesmo md5 de antes;
  - testada em transação desfeita (9 cenários: agora de verdade, 30 e 50 min sem rodada, saudável, apagão, volta com a
    história, alarme segurado, `verificar()` inteira sem erro, `registrar()` recusando);
  - **reavaliação de 14/10 a 20/10** pelo histórico do pg_cron: 5 episódios, todos de banco degradado de verdade (15/10
    07:20–09:00, 16/10 08:00–16:05, 17/10 15:55–18:05, 17/10 23:30–18/10 04:45, 20/10 08:50–11:45); **nenhum** em 14/10
    nem em 19/10. Sem a regra de fechar só depois de 1 hora limpa, a madrugada de 17→18/10 abriria e fecharia 3 vezes.
- O aviso sai no Telegram na primeira rodada completa da função (quem manda é ela). Se o incidente abrir e fechar antes,
  sai "teve um problema às HH:MM e já voltou", com a história no texto.
- **Provado de verdade:** às 11:55 a primeira avaliação abriu o incidente 59 (atenção) e às **12:00:05 o Telegram
  recebeu**: "🟠 Guardião · Verificação na nuvem — O agendador do banco falhou 5 de 16 rodadas na última hora (job startup
  timeout): sinal de banco sobrecarregado (não abre conexão a tempo). A função guardiao ainda rodou às 12:00; se o
  agendador parar de vez, o Guardião fica cego." Era o primeiro aviso desde as 07:40: a manhã inteira passou sem nenhum.
  O "✅ Voltou" deve sair por volta das 12:30, depois de 1 hora sem falha (a última foi às 11:25) — **não conferido** nesta
  conversa.

## Decisões
- 2026-10-20 (Claude): limites 25/45 min e 3 falhas por hora, com fechamento só depois de 1 hora limpa — escolhidos pela
  reavaliação, para não piscar (regra da casa: alarme falso é pior que nenhum alarme). Ficam em `saude.alvo.config` e
  mudam sem migração.
- 2026-10-20 (Claude): **não** se mexeu em nada do banco (reset, plano, horários) sem o Júlio: tudo abaixo é proposta.

## Proposta para o Júlio decidir
1. **Já, no banco (reversível):** um job do pg_cron que zera o `pg_stat_statements` de hora em hora, aos :15
   (`select extensions.pg_stat_statements_reset();` — o usuário `postgres` pode, conferido). A consulta de métricas
   volta a levar milissegundos. Custo: a tela *Query Performance* do Supabase só mostra a última hora. Desfazer =
   tirar o job.
2. **A raiz, nos ETLs:** trocar o `execute_values` por `COPY` no `carregar` e no `carregar_em_lotes` dos `bi_comum.py`
   (seis cópias) e no `gravar_trade.py`. O texto do `COPY` é sempre o mesmo (uma entrada por tabela) e ele grava várias
   vezes mais rápido. Dimensão com upsert: `COPY` numa tabela temporária e `INSERT … ON CONFLICT`. Uma sessão por
   sistema, começando pelo COMERCIAL (a margem), com carga de teste e reinstalação na `SRV-IA`. Com isso feito, o item 1
   pode sair.
3. **Não subir o compute agora** (Small → Medium só adia a queda; o texto continua crescendo). Rever no *Reports →
   Database* depois de 1 e 2.
4. Menores: o vigia contar o destino só quando há carga nova (as contagens custaram 14–31 s cada hoje); evitar análise
   pesada à mão no horário das cargas; o pacote do Inventário (31 s folgado, 155 s com o banco lento, 8 vezes por dia).

## Pendências
- [ ] Decidir o item 1 (reset de hora em hora) — Júlio
- [ ] Decidir e agendar o item 2 (COPY nos ETLs), uma sessão por sistema — Júlio
- [ ] Pôr `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no ENV do vigia da VM (`P:\INTEGRAÇÃO BI\GUARDIAO\1 - CONFIGURACAO`)
  e reinstalar: hoje o vigia está **sem Telegram** (`telegram_direto: false`) e nem o aviso de "Supabase fora" dele
  sairia. Com isso, decidir se o vigia também avisa quando a função `guardiao` parar (o único aviso que não depende do
  banco) — Júlio
- [ ] Commit local do `db/11_guardiao_parado.sql` e do README no `12. GUARDIAO` — Júlio pede, Claude faz
- [ ] Os 3,3 GB sem dono no disco — já anotado em [[2026-10-20 — Limpeza semanal e o espaço do banco]]
