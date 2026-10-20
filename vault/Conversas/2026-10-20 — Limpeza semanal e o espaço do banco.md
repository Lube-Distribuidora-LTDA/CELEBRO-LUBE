---
tipo: conversa
data: 2026-10-20
projeto: "[[GUARDIÃO DA LUBE]]"
status: resumido
tags: [conversa, supabase, data-warehouse, espaco, disco, guardiao]
---
# 2026-10-20 — Limpeza semanal e o espaço do banco

## Resumo
O Júlio pediu uma limpeza semanal no banco "pra deixar sempre com espaço sem interferir nos dados dos nossos BI, por
que eu não posso ficar colocando mais armazenamento dessa maneira". A medição mostrou que o problema não é dado
sobrando: dos **4,4 GB** do DATA WAREHOUSE, só **1,2 GB** são dados; **3,3 GB** são arquivos sem dono deixados pelas
**quedas do banco** (4 na semana). Esse lixo não sai por SQL. Ficou no ar a [[Guardião - Espaço do banco]]: limpeza
semanal do que é registro operacional e medição diária do espaço no [[GUARDIÃO DA LUBE]], que avisa quando o lixo das
quedas passa de 1 GB.

## Pedido (palavras do Júlio)
"preciso fazer uma limpeza no banco 1 vez por semana, pra deixar sempre com espaço sem interferir nos dados dos nossos
BI, por que eu não posso ficar colocando mais armazenamento dessa maneira."

## O que foi medido
- Projeto DATA WAREHOUSE (`ivcnotrynogaljrvvyes`), plano **Pro**, máquina **Small** (~2 GB de memória: 512 MB de
  cache, 90 conexões), Postgres 17.6.
- `pg_database_size` = 4,53 GB; soma de tudo o que está no catálogo = 1,18 GB (tabelas 636 MB, índices 376 MB, toast
  163 MB). Por schema: comercial 786 MB (a `fato_margem_item` sozinha 732 MB, 3,35 milhões de linhas), trade 171 MB,
  compras 73 MB, inventario 57 MB, core 42 MB, fiscal 17 MB, reposicao 15 MB; o resto, menos de 2 MB cada. WAL 1,0 GB.
- Nenhuma carga em andamento na hora da medição; linhas mortas zero (autovacuum em dia). Registros operacionais
  (pg_cron, pg_net, Guardião) somam menos de 3 MB.
- **Quedas** nos logs do Supabase ("database system was interrupted … not properly shut down; automatic recovery in
  progress"): **15/10 07:57, 16/10 15:06, 18/10 03:53 e 19/10 09:57** (horário de Brasília). Antes da de 18/10, as
  consultas eram canceladas por tempo a cada 20 s durante a carga pesada da margem (03:45), e então o banco caiu.
  Quando o Postgres cai com uma carga regravando uma tabela (`TRUNCATE` + `INSERT` numa transação), o arquivo novo fica
  no disco e ninguém o apaga: 3,3 GB ≈ 4 a 5 cópias da tabela da margem.
- O banco às vezes recusava conexão nesta conversa ("connection timeout"): mais um sinal de máquina no limite.
- Supabase: o disco cresce sozinho a 90% (+50%) e **não diminui sozinho**; volta para 1,2× o banco na **atualização do
  projeto** (Settings › Infrastructure). O usuário `postgres` não é superusuário, então não dá para listar nem apagar os
  arquivos órfãos por SQL.

## Decisões
- 2026-10-20 (Claude): a limpeza semanal mexe **só em registro operacional** (histórico do pg_cron com mais de 14
  dias, respostas do pg_net com mais de 2 dias, medições com mais de 180 dias); nenhum schema de BI é tocado.
- 2026-10-20 (Claude): a medição é **diária** (barata) para o lixo novo de uma queda aparecer no dia seguinte; não mede
  com carga regravando tabela (daria "sem dono" falso); atenção só com 2 medições seguidas acima de 1 GB.
- 2026-10-20 (Claude): ser claro com o Júlio que a limpeza semanal **não** recupera os 3,3 GB: o que resolve é parar as
  quedas e fazer a atualização do projeto (ou o suporte apagar os órfãos).

## O que foi criado ou mudou
- [[Guardião - Espaço do banco]] (rotina nova) e o item `servico:banco-espaco` no [[GUARDIÃO DA LUBE]], já medindo:
  "Banco com 4,4 GB: 1,2 GB de dados e 3,3 GB sem dono no disco".
- Banco: migração `saude_v1_espaco_banco` (tabelas `saude.espaco_banco` e `saude.manutencao_banco` com RLS, funções
  `saude.medir_espaco()`, `saude.manutencao_semanal()` e `saude._gb()`, agendamentos `saude-espaco-banco` e
  `saude-manutencao-semanal`), testada antes em `BEGIN … ROLLBACK`. Commit `52a76a0` no repositório do Guardião
  (`Desktop\BI\12. GUARDIAO\db\10_espaco_banco.sql`, só local).
- [[Supabase]] e [[Registro de mudanças]]: o diagnóstico e a mudança.

## Texto pronto para o suporte do Supabase (se o Júlio escolher esse caminho)
> Project `ivcnotrynogaljrvvyes` (DATA WAREHOUSE, Pro plan). `pg_database_size('postgres')` is 4.5 GB but all
> relations in `pg_class` add up to 1.2 GB. The database crashed and ran automatic recovery on 2026-10-15 10:57 UTC,
> 2026-10-16 18:06 UTC, 2026-10-18 06:52 UTC and 2026-10-19 12:57 UTC, during data loads that rewrite large tables
> (TRUNCATE + INSERT in one transaction). We believe about 3.3 GB are orphaned relation files left by those crashes.
> Could you please remove the orphaned files (we cannot, the postgres role is not superuser) and right-size the disk?
> We would also like to understand why the instance is restarting (memory on the Small compute?).

## Pendências
- [ ] Decidir como parar as quedas: carregar a margem por partes (só os dias que mudam), subir a máquina para Medium
  (custa mais por mês) ou espaçar as cargas — Júlio (Claude sugere a primeira, que também deixa a carga mais rápida)
- [ ] Recuperar os 3,3 GB: atualização do projeto em Supabase › Settings › Infrastructure (alguns minutos fora do ar,
  num horário sem carga) ou mandar o texto acima ao suporte — Júlio
- [ ] Depois disso, conferir no item "Espaço do banco" que o "sem dono" caiu para perto de zero — Claude
