---
tipo: rotina
departamento: TI
status: ativo
frequencia: "medição todo dia às 05:40 (06:40 se a primeira for pulada); limpeza aos domingos às 05:30"
maquina: "nuvem: Supabase DATA WAREHOUSE (pg_cron)"
tags: [guardiao, saude, pg_cron, supabase, espaco, disco]
---
# Guardião - Espaço do banco

**Quando:** medição todo dia às 05:40 (`saude-espaco-banco`, 08:40 UTC; repete às 06:40 se a primeira foi pulada) e
limpeza aos domingos às 05:30 (`saude-manutencao-semanal`, 08:30 UTC). **No ar desde 2026-10-20.**
**Onde:** [[Supabase]] DATA WAREHOUSE (`ivcnotrynogaljrvvyes`), funções `saude.medir_espaco()` e
`saude.manutencao_semanal()`; código em `Desktop\BI\12. GUARDIAO\db\10_espaco_banco.sql` (migração
`saude_v1_espaco_banco`).
**O que faz:** a limpeza semanal que o Júlio pediu ("pra deixar sempre com espaço sem interferir nos dados dos nossos
BI") e, todo dia, a medição do espaço do banco no [[GUARDIÃO DA LUBE]] (item **Espaço do banco (DATA WAREHOUSE)**).
**Não toca em nenhum schema de BI.**

## Fluxo
1. **Gatilho** · pg_cron no DATA WAREHOUSE: `saude-espaco-banco` às 05:40 e 06:40, `saude-manutencao-semanal` aos domingos às 05:30
2. **Confere** · antes de medir: se há uma transação de escrita aberta há mais de 1 min (carga regravando tabela), não mede
   - **Atenção:** a tabela nova de uma carga em andamento ainda não está no catálogo e daria um "sem dono" falso; uma medição boa por dia basta
3. **Lê** · `pg_database_size` (o banco no disco), a soma de tudo o que está no catálogo (tabelas, índices, views, toast), o WAL (`pg_ls_waldir`), o tamanho de cada schema e as 5 maiores tabelas
4. **Processa** · "sem dono" = o banco menos o catálogo: arquivos deixados no disco pelas quedas do banco no meio de uma carga
5. **Grava** · uma linha por dia em `saude.espaco_banco` (fica 180 dias)
6. **Processa** · limpeza do domingo: apaga só registro operacional velho — histórico do pg_cron com mais de 14 dias, respostas HTTP do pg_net com mais de 2 dias, medições com mais de 180 dias — e guarda o que apagou em `saude.manutencao_banco`
   - **Atenção:** esses registros somavam menos de 3 MB em 2026-10-20: a limpeza mantém o banco arrumado, mas **não** recupera o espaço das quedas
7. **Avisa** · item "Espaço do banco" no Guardião: **atenção** com mais de 1 GB sem dono em 2 medições seguidas (abre incidente e manda Telegram uma vez), com o que fazer; senão "ok" com o tamanho e o WAL
   - **Se falhar:** sem medição por 26 h o item fica "sem dado"
8. **Entrega** · `saude.painel()` (chip e painel Saúde do robô do [[Cérebro da Lube]])

## O que foi medido no primeiro dia (2026-10-20)
- Banco: **4,4 GB**. Dados de verdade (tudo o que está no catálogo): **1,2 GB** — a maior tabela é a
  `comercial.fato_margem_item` (732 MB, 3,35 milhões de linhas). WAL: 1,0 GB.
- **3,3 GB sem dono**: sobra das quedas do banco em 15/10 07:57, 16/10 15:06, 18/10 03:53 (no meio da carga da
  margem) e 19/10 09:57 ("database system was not properly shut down"). O usuário `postgres` do Supabase não é
  superusuário: **nenhum SQL apaga esses arquivos**. Saem na **atualização do projeto** no Supabase (Settings ›
  Infrastructure; o disco também volta para 1,2× o banco) ou por chamado ao suporte.
- Linhas mortas nas tabelas: zero (o autovacuum está em dia). Histórico do pg_cron: 2.602 linhas desde 14/10.

## Como provar que rodou
- `select medido_em, saude._gb(banco_bytes), saude._gb(sem_dono_bytes) from saude.espaco_banco order by 1 desc limit 7;`
- `select * from saude.manutencao_banco order by feita_em desc limit 4;`
- Medir na hora (ignora o "já medido hoje" e a carga em andamento): `select saude.medir_espaco(true);`

Origem: [[2026-10-20 — Limpeza semanal e o espaço do banco]].
