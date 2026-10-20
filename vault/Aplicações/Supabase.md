---
tipo: app
departamento: TI
status: em uso
tags: [aplicacao, banco]
---
# Supabase

Hospeda o banco de cada sistema da Lube: um projeto por finalidade, nunca misturados. Identificadores de projeto não são segredo (ver [[Como trabalhar comigo]]); senhas e chaves, nunca entram aqui.

| Projeto | Ref | Região | Para que serve |
|---|---|---|---|
| DATA WAREHOUSE | `ivcnotrynogaljrvvyes` | sa-east-1 | Pipeline de BI: [[Mapa de sistemas]], [[data-warehouse]]. Schemas: `compras`, `core`, `stg_compras`, `financeiro` desde 2026-09-24 ([[GESTÃO FINANCEIRO — documentação técnica]]) `comercial` desde 2026-09-28 ([[BI COMERCIAL]]) `reposicao` desde 2026-10-06 ([[REPOSIÇÕES E CHAMADOS]]) e `trade` desde 2026-10-14 ([[GESTÃO COMERCIAL TRADE]]; ~37 MB, guarda o pacote do painel em `bytea`) e `inventario` desde 2026-10-19 ([[MOVIMENTAÇÃO DE INVENTÁRIO]]; ~51 MB, pacote do painel em gzip no `painel_cache`; lê `trade.produto_miniatura` só para as fotos) e `fiscal` desde 2026-10-20 ([[GESTÃO FISCAL]]; ~17 MB, tributação e preço por região da 201, pacote em gzip no `painel_cache`; também lê `trade.produto_miniatura` só para as fotos). Também `saude` desde 2026-10-14 ([[GUARDIÃO DA LUBE]]: catálogo do que vigiar, estado, incidentes, conferências, pedidos de correção e avisos; RLS sem política, só `service_role`), as extensões `pg_cron` e `pg_net` e a Edge Function `guardiao` |
| PAINEL LUBE DISTRIBUIDORA (antes chamado aqui de "painel-lube-acesso") | `wkkdcsqwlxjxorutrbnx` | sa-east-1 | Login e controle de acesso do [[PAINEL LUBE DISTRIBUIDORA]]; desde 2026-10-06 também o schema `sentinela` e a Edge Function `sentinela` da [[SENTINELA LUBE]] (segredo `ANTHROPIC_API_KEY` vai em Edge Functions › Secrets deste projeto) |
| PAINEL ICMS (o vault o chamava de "painel-icms-lube") | `ylzjamsiknkcgyzgehnl` | sa-east-1 | [[PAINEL ICMS]]: tabelas `periodos`, `pedidos_atualizacao` (fila do botão Atualizar) e `usuarios_permitidos`, bucket `planilhas`; sem Edge Functions. **Políticas TEMP aceitam o anônimo** (de 2026-09-03, porque o login próprio do site está desligado desde 2026-08-28) |
| GESTÃO RH (nasceu em 2026-08-24 como "RH Absenteísmo") | `jhznrwmwszpfogvbjnjx` | us-west-2 | [[BI ABSENTEÍSMO RH]]: absenteísmo, turnover, colaboradores, quadro (HEAD), hora extra, interjornadas e empresa do colaborador (`colaborador_empresa`); `exames_periodicos` ainda não existe. **Aceita leitura e gravação anônimas com a chave pública** (pendência da [[SENTINELA LUBE]]); `pagamento_hora_extra` guarda dado sensível (CPF e salário). De 2026-08-21 a 2026-08-24 o BI apontava para `issujcvninltzvxdfhqd`, que não aparece na organização em 2026-10-09 |
| GESTÃO DE SAIDA DE VEICULO | `ubfxhnricinclxkbvkzw` | us-west-2 | [[GESTÃO DE SAÍDA DE VEÍCULOS]]: tabelas `public.veiculos` e `public.deslocamentos`. O navegador lê e insere direto com a chave pública (RLS: SELECT e INSERT para anon; UPDATE e DELETE bloqueados) — pendência |
| GESTAO TI | `mpupmrzcbygwpblrewrb` | sa-east-1 | [[GESTÃO TI]] — contratos, notas, boletos e chamados da TI. Desde 2026-10-14 tem a RPC `public.saude_robo()`, executável por `anon`: só tipo, horários, sucesso e contagens do robô em 48 h, sem texto de erro, para o [[GUARDIÃO DA LUBE]] ler com a chave publicável |

- **Organização:** "Lube Distribuidora LTDA" (`ixtkrqqifwnjjyxckhln`), com os seis projetos acima (conferido em
  2026-10-09). Quatro em sa-east-1 (São Paulo); RH e Saída de Veículos em us-west-2 (Oregon).
- **Projeto novo custa US$ 10/mês.** Perguntado em 2026-09-15, na criação do Gestão TI, o Júlio **preferiu pagar um
  projeto dedicado** a pôr o sistema como mais um schema num banco existente ([[2026-09-15 — Memória do Claude Code e a variável do Windows]]). Pergunte antes de criar.

Cada sistema com login próprio guarda sua própria regra de acesso no banco dele — por isso o [[PAINEL LUBE DISTRIBUIDORA]] ganhou um projeto dedicado em vez de reaproveitar um existente. O [[GESTÃO TI]] também: como ele guarda documento fiscal e custo, misturar com outro banco arriscaria escrever no lugar errado.

## Cuidado com a variável de ambiente do Windows
A máquina do Júlio tem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente do usuário, apontando para o **painel-icms-lube**. Variável do sistema operacional vence o `.env.local`, então um projeto rodando localmente pode escrever no banco de outro sistema sem avisar. O [[GESTÃO TI]] confere o `ref` do JWT contra a URL antes de abrir conexão; vale copiar essa checagem nos demais.

São as variáveis que a ponte `sync_supabase.py` do [[PAINEL ICMS]] usa nesta máquina (a `SUPABASE_SERVICE_ROLE_KEY`
dá acesso total ao banco) — por isso **não foram removidas** (situação de 2026-10-09). Voltou a acontecer em
2026-10-05, no teste local do resumo do Telegram do [[GESTÃO TI]]. **Pendente — Júlio:** tirar ou renomear as duas
do ambiente do usuário do Windows, com cuidado com a ponte
([[2026-09-15 — Memória do Claude Code e a variável do Windows]]).

## Migração aplicada no banco vai também para o repositório
No [[GESTÃO TI]], as migrações `11_excluir_fornecedor_em_cascata` a `14_custos_incluem_notas_avulsas` (2026-09-15
e 16) nunca chegaram a `supabase/migrations/`, e a numeração dos arquivos ficou diferente da do banco (o arquivo 12
do repositório é a `competencia_nula_vira_mes_corrente` do banco). Resultado: **o banco não se recria pelo
repositório**. Tabela de correspondência na nota do sistema. Regra: toda migração aplicada pelo MCP sai junto como
arquivo, com o mesmo nome.

## Armadilha: safeupdate na API (2026-10-07)
Função chamada pela API do Supabase (PostgREST/RPC) roda com o `safeupdate`: `DELETE` ou `UPDATE` sem `WHERE` dá
erro **21000** ("DELETE requires a WHERE clause"). Foi por isso que a lista Tor da [[SENTINELA LUBE]] nunca
carregou. Para apagar tudo de propósito, escreva `delete from tabela where true`.

## Edge Functions (conferido em 2026-10-09)
Só o projeto PAINEL LUBE DISTRIBUIDORA tem: `admin-users` (verify_jwt ligado) e `sentinela` (versão 4,
verify_jwt desligado). Ao publicar a `sentinela` pelo MCP, passe `import_map_path: "deno.json"` — sem isso o deploy
é recusado. Os outros cinco projetos não têm nenhuma.

**Desde 2026-10-14 o DATA WAREHOUSE também tem uma:** `guardiao`, do [[GUARDIÃO DA LUBE]] (versão 3, código
`guardiao/1.0.2`, `verify_jwt` desligado, `import_map_path: "deno.json"`). Autentica sozinha: o cabeçalho
`x-guardiao` (segredo `guardiao_cron` do Vault, que o pg_cron manda) para `POST /rodar` e `/teste-telegram`, e o
`x-chave-leitura` (segredo `guardiao_chave_leitura`, ainda não criado) para `GET /resumo`. Segredos do Telegram em
Edge Functions › Secrets do DATA WAREHOUSE: `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` (ainda não cadastrados). O
`supabase/config.toml` do repositório fixa `verify_jwt = false`: com o JWT ligado, o pg_cron levaria 401.

## pg_cron e pg_net no DATA WAREHOUSE (desde 2026-10-14)
Ligados para o [[GUARDIÃO DA LUBE]]: `saude-verificar` (`*/5`, `select saude.verificar();`), `saude-guardiao` (`*/10`,
chama a função `guardiao` pelo `net.http_post`, 30 s) e `saude-limpeza` (`20 4 * * *` UTC = 01:20 em Brasília, 90
dias). O horário do pg_cron é **UTC**. O cabeçalho do agendador passa pela fila do pg_net, aberta a PUBLIC: conferir
em Settings › API › Exposed schemas que `net` não está exposto e não revogar o PUBLIC do schema `net` sem testar.
Para chamar a função sem ler segredo nenhum: `select saude.chamar_guardiao('simular');` e ler o resultado em
`net._http_response`. Nunca escrever SQL que leia `vault.decrypted_secrets` à toa: o valor fica no histórico do SQL
Editor (a única exceção combinada é ler a chave de leitura uma vez, ao criá-la).

## Incidente 2026-09-28, ~17:45, até 2026-09-29 — banco sem resposta depois da carga do [[BI COMERCIAL]]
- **Sintoma:** depois da primeira carga da `comercial.fato_margem_item` (3,3 milhões de linhas, 594 MB) e das
  leituras cheias dela pela `painel_dados` nos testes do painel: autenticação estourando 15 s,
  `autovacuum worker took too long to start` e, no pooler, `DbHandler: Connection failed {:error, :timeout}`. O MCP
  também caiu.
- **Duas leituras erradas, para não repetir:** a migração entrava e morria por `statement timeout` (não era recusa
  de conexão); e log do Postgres parado pode ser só atraso de ingestão — a prova da queda foi o log do pooler.
- **Saída:** o Claude não pausou o projeto pelo MCP (tiraria o banco do ar) e pediu ao Júlio o *Restart project*.
  Em 2026-09-29 o banco voltou; a `painel_dados` deixou de varrer a tabela grande (`mv_margem_dia`) e caiu para
  0,2 s. DDL de view materializada grande precisa de `SET statement_timeout` antes (ali, `'45min'`). Detalhes em
  [[BI COMERCIAL]].

## Incidente 2026-10-01 — banco DATA WAREHOUSE sem responder
- **Sintoma:** painel da [[SISTEMA FINANCEIRO|Validação de Folha]] com `HTTP 500` em `/api/dados` e `/api/departamentos`;
  erro devolvido pela API: `Failed to connect to database: {:error, :timeout}`. O MCP do Supabase
  também não conectou (`Connection terminated due to connection timeout`). Projeto `ACTIVE_HEALTHY`
  no painel do Supabase, plano Pro, cinco variáveis na Vercel presentes — **não era código nem
  configuração**.
- **Log do pooler (Supavisor):** `DbHandler: Connection failed {:error, :timeout}` direto para o IP do
  Postgres, porta 5432 — o pooler não chegava no banco.
- **Log do Postgres:** às 06:52 (BRT) o ETL do [[BI COMPRAS]] fez `REFRESH MATERIALIZED VIEW` das
  nove views `compras.mv_*`; a partir daí, consultas internas do próprio Supabase passaram a levar
  13–19 segundos, checkpoints gravando 85% dos buffers (700 MB), e `canceling statement due to
  statement timeout` em série. Quadro de **instância saturada** (CPU/IO), não de queda.
- **Diagnóstico:** nada nesta máquina estava rodando contra o banco. Carga pesada do COMPRAS em
  instância pequena demais.
- **Saída:** reiniciar o projeto pelo dashboard do Supabase (**Settings → General → Restart project**; há também
  o *Fast database reboot*. Até 2026-10-09 esta nota dizia "Settings → Infrastructure", errado) — o MCP não tem
  essa ação — e olhar *Reports → Database* (CPU e Disk IO) para decidir se o compute
  precisa subir. Considerar mover os refreshes pesados do COMPRAS para a madrugada (o agendador já
  prevê 02:50 para "pesadas"; hoje rodou às 06:52).
- **Explicado em 2026-10-08** (inferência pelos horários do `controle_carga`): as tarefas do [[BI COMPRAS]] na VM
  SRV-IA rodavam **4 horas atrasadas** desde 2026-09-28 (relógio da VM atrasado quando foram gravadas). O
  faturamento das 02:50, com o refresh das nove views, disparava por volta das 06:50. Tarefas recriadas pelo Júlio
  em 2026-10-09: o faturamento volta às 02:50 a partir da madrugada de 2026-10-10. Ver
  [[2026-10-08 — Cargas do BI COMPRAS 4 horas fora do horário]].
- **Na mesma manhã:** a carga da margem do [[BI COMERCIAL]] (3,3 milhões de linhas) rodou às 07:45 na VM, também 4
  horas fora do horário; se pesou na saturação não está provado. Às 08:17 o banco ficou ~15 min sem responder e o
  servidor da [[Abertura de margem]], que não subia sem banco, ficou a manhã fora. O código foi corrigido no mesmo
  dia, mas a versão nova só chegou à VM em 2026-10-09.

## Incidente 2026-10-07 — pool do pooler esgotado; o banco reiniciou às 14:14
- **Sintoma (visto no [[REPOSIÇÕES E CHAMADOS]]):** primeira chamada do painel publicado deu **504 depois de 60 s**,
  a segunda levou 13 s; uma conexão nova daqui levou **34,7 s**; a carga do REPOSIÇÕES, que ontem levou 7 s,
  levou **4 minutos** (55 s, 74 s e 95 s por consulta, com o Oracle respondendo na hora). Às 14:13 um teste de
  conexão falhou com `ECHECKOUTTIMEOUT: unable to check out connection from the pool after 15000ms in Session mode`;
  o conector de administração do Supabase também deu `connection timeout`.
- **Logs:** a consulta de monitoramento do próprio Supabase (`postgres_exporter`, lê `pg_stat_statements`) já levava
  **~15 s às 07:30** e, a partir das 08:00, **estourava o tempo ~50 vezes por hora** (antes: 1 por hora). O
  Supavisor registrou `Pool checkout took over 1s (5267ms)`. O tráfego do pooler ficou estável (~230 → ~320
  autenticações por hora): **não foi um cliente descontrolado**, foi o pool limitado do *session pooler* ficando
  ocupado enquanto o banco andava devagar. A "gravação de checkpoint de 266 s" que aparece nos logs e parece
  alarmante é normal (o Postgres espalha o checkpoint por 90% dos 5 minutos).
- **Teste de ociosidade (conexão nova depois de N minutos sem tocar no pooler, 13:56–14:28):** 0 s → 0,21 s; 2 min → 0,15 s; 5 min → 0,15 s; 10 min → **falhou** (`ECHECKOUTTIMEOUT`, pool esgotado, a 56 s do reinício); depois do reinício, 15 min → 0,20 s. **Ficar parado não esfria o pooler**; a lentidão era saturação.
- **O banco reiniciou às 14:14:09 (BRT)** — não foi por mim (o MCP não tem essa ação) — e tudo voltou ao normal:
  conexão nova em 0,2 s. O `pg_stat_statements` ficou com 27 entradas (zerado pelo reinício).
- **Hipótese NÃO comprovada:** os ETLs usam `execute_values` com páginas de 2.000 a 50.000 linhas; o último lote
  de cada carga tem um tamanho diferente, e cada tamanho vira uma consulta nova, com texto de centenas de KB, em
  `pg_stat_statements`. A consulta do exporter faz `regexp_replace` em até 10.000 caracteres de cada entrada — com
  milhares de entradas gigantes ela passa a custar ~15 s por minuto e sufoca uma instância pequena. **Como
  conferir** nos próximos dias: `select count(*), pg_size_pretty(sum(length(query))::bigint) from
  extensions.pg_stat_statements;` e, nos logs, o `duration:` das consultas `normalized_pg_stat_statements`. Se
  crescer: trocar `execute_values` por `COPY FROM STDIN` nos ETLs (o texto do `COPY` é sempre o mesmo).
- **Mesmo quadro de 01/10** (acima). Segue valendo: olhar *Reports → Database* (CPU e Disk IO) e decidir se o
  compute precisa subir. A carga pesada do COMPRAS (faturamento + refresh das nove `compras.mv_*`) rodava por
  volta das 06:50 por causa do atraso das tarefas da VM, e a partir de 2026-10-10 roda às 02:50; às 07:50 roda só a
  carga rápida. _Até 2026-10-09 esta nota dizia "carga pesada às 07:50", errado._
- **Contexto descoberto em 2026-10-08:** de 2026-10-01 a 2026-10-09 as cargas do [[BI COMERCIAL]] rodavam em **duas
  máquinas** ao mesmo tempo (VM SRV-IA e LOGISTICA-55), com cargas presas em lock até os 120 s do
  `statement_timeout`. Isso dobrava o peso delas no banco no dia deste incidente. Corrigido com a tranca de carga
  (2026-10-08) e uma máquina só (2026-10-09) — ver
  [[2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga]].
- **O que isso ensinou:** painel que abre lendo o banco na hora do clique herda toda crise do banco. O
  [[REPOSIÇÕES E CHAMADOS]] passou a abrir pelo CDN (a resposta fica pronta no banco e na Vercel) e **respondeu em
  0,18 s com o banco travado**. Os outros painéis (COMPRAS, COMERCIAL, FINANCEIRO) ainda leem o banco a cada
  abertura a frio — vale copiar o desenho.

## Reinícios do DATA WAREHOUSE em sequência (2026-10-07 a 2026-10-09)
O Postgres reiniciou **três vezes em três dias**: 2026-10-07 14:14 (incidente acima), **2026-10-08 ~17:00** (visto
na conversa do Reposições, sem causa anotada) e **2026-10-09 13:45:27** (`pg_postmaster_start_time()`, conferido por
conexão direta). O último caiu ~5 min depois de duas cargas de teste do [[REPOSIÇÕES E CHAMADOS]] (13:33 e 13:40,
~65 mil linhas cada); o conector de administração deu `connection timeout` no intervalo. **Causa não provada:** não
há prova de que as cargas derrubaram o banco, e o Claude não tem como reiniciá-lo. Na carga de 13:33 só o
`reposicao_item` levou 134 s para 5,6 mil linhas, contra 14 s na de 13:40 — o banco estava lento antes do reinício.
Decidir (Júlio): *Reports → Database* (CPU, memória, Disk IO) e o tamanho do compute; conferir a hipótese do
`pg_stat_statements` acima. Origem: [[2026-10-09 — Comparação com o período anterior e o script de atualização da VM]].

## Espaço do DATA WAREHOUSE e os arquivos sem dono (2026-10-20)
- **Medido:** o banco ocupa **4,4 GB**, mas tudo o que está no catálogo (tabelas, índices, views, toast) soma
  **1,2 GB**. Os outros **3,3 GB são arquivos sem dono**: sobra das **quedas do banco no meio de cargas** (15/10 07:57,
  16/10 15:06, 18/10 03:53 na carga da margem, 19/10 09:57; nos logs, "database system was not properly shut down;
  automatic recovery in progress"). Quando o Postgres cai com uma carga regravando tabela (`TRUNCATE` + `INSERT`), o
  arquivo novo fica no disco. Os reinícios de 07/10 a 09/10 (acima) são o mesmo quadro.
- **Não sai por SQL:** o usuário `postgres` não é superusuário; não lista nem apaga os arquivos. Saem na **atualização do
  projeto** (Settings › Infrastructure, alguns minutos fora do ar; o disco volta para 1,2× o banco) ou pelo suporte.
- **Disco no plano Pro:** cresce sozinho a 90% (+50%) e não diminui sozinho; só a atualização do projeto ajusta.
- **Máquina:** Small (~2 GB: `shared_buffers` 512 MB, 90 conexões). A maior tabela, `comercial.fato_margem_item`
  (732 MB, 3,35 milhões de linhas), é regravada inteira toda madrugada às 03:45.
- **Vigia:** desde 2026-10-20 o [[GUARDIÃO DA LUBE]] mede o espaço todo dia e avisa com mais de 1 GB sem dono
  ([[Guardião - Espaço do banco]]); a limpeza semanal apaga só registro operacional velho. Diagnóstico completo e
  texto pronto para o suporte em [[2026-10-20 — Limpeza semanal e o espaço do banco]].

## Registro de mudanças
_Compilado em 2026-10-09 a partir do Git, da API do Supabase e das sessões._
- **2026-10-20** — DATA WAREHOUSE: migração `saude_v1_espaco_banco` (tabelas `saude.espaco_banco` e
  `saude.manutencao_banco`, funções `saude.medir_espaco()` e `saude.manutencao_semanal()`, tarefas do pg_cron
  `saude-espaco-banco` às 05:40/06:40 e `saude-manutencao-semanal` às sextas às 05:30 — no domingo até a migração
  `saude_v1_limpeza_na_sexta`, no mesmo dia); achados os 3,3 GB sem dono das
  quedas (Claude, a pedido do Júlio) · [[2026-10-20 — Limpeza semanal e o espaço do banco]]
- **2026-10-14** — DATA WAREHOUSE: extensões `pg_cron` e `pg_net`, schema `saude` (8 migrações `saude_v1*`), segredo
  `guardiao_cron` no Vault, 3 tarefas do pg_cron e a Edge Function `guardiao`, a primeira do projeto. GESTAO TI:
  migração `saude_robo` (RPC liberada a `anon`, só contagens) (Claude) · [[GUARDIÃO DA LUBE]] ·
  [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-09** — Terceiro reinício do banco em três dias (13:45:27), depois de duas cargas de teste do REPOSIÇÕES;
  causa não provada.
- **2026-10-09** — Nomes atuais dos projetos (PAINEL ICMS, GESTÃO RH, GESTAO TI), links e o que cada banco guarda;
  organização e custo; Edge Functions; incidente de 2026-09-28; causa do horário do COMPRAS; caminho certo do
  *Restart project*; safeupdate; migrações fora do repositório no Gestão TI; a variável do Windows voltou em
  2026-10-05.
- **2026-10-07** — Incidente do pool do pooler esgotado; o banco reiniciou às 14:14.
- **2026-10-06** — Schema `reposicao` no DATA WAREHOUSE; schema e Edge Function `sentinela` no PAINEL LUBE.
- **2026-10-01** — Incidente do DATA WAREHOUSE saturado.
- **2026-09-28** — Schema `comercial`; banco sem resposta até 2026-09-29.
- **2026-09-24** — Schema `financeiro`.
- **2026-09-18** — Projeto DATA WAREHOUSE criado.
- **2026-09-15** — Projeto GESTAO TI criado; achada a variável do Windows.
- **2026-09-14** — Projeto PAINEL LUBE DISTRIBUIDORA criado.
- **2026-09-10** — Projeto GESTÃO DE SAIDA DE VEICULO criado.
- **2026-08-28** — Projeto PAINEL ICMS criado.
- **2026-08-24** — Projeto GESTÃO RH criado (como "RH Absenteísmo").

