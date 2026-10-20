---
tipo: projeto
departamento: TI
status: ativo
inicio: 2026-10-14
tags: [projeto, guardiao, saude, monitoramento, supabase, telegram, pg_cron]
---
# GUARDIÃO DA LUBE

O robô que **garante as rotinas e a saúde dos sistemas**: confere sozinho se cada carga rodou no horário e subiu o
que devia, se os sites estão no ar e se a VM `SRV-IA` está viva; quando algo falha, abre um incidente com a frase do
fato, pede **uma** nova tentativa à VM e avisa no Telegram. Mora quase todo no banco (schema `saude` do DATA
WAREHOUSE) e aparece no painel do robô do [[Cérebro da Lube]]. Criado em 2026-10-14 —
[[2026-10-14 — Guardião, o robô que garante as rotinas]].

Pedido do Júlio (2026-10-14): "preciso que esse robô garanta meus processos… validar todas as rotinas se rodaram e
se subiram as informações corretamente… garanta a saúde do sistema… quem vai garantir é ele."

- **Código:** `Desktop\BI\12. GUARDIAO` (git local, **sem remoto**; commits `62e6d0c`, `d67d9cc`, `0bb8a2a`). A pasta
  nasceu como `11. GUARDIAO` e foi renomeada no mesmo dia: o 11 ficou com o TRADE ([[GESTÃO COMERCIAL TRADE]]).
  Especificação em `ESPECIFICACAO.md` e roteiro em `README.md`, na própria pasta.
- **Vigia da VM:** editado em `P:\INTEGRAÇÃO BI\GUARDIAO`, roda em `C:\BI\GUARDIAO` na `SRV-IA` — **ainda não
  instalado** (2026-10-14). Rotina: [[Guardião - Vigia da VM]].
- **Verificação na nuvem:** pg_cron + função `guardiao` no DATA WAREHOUSE, **no ar desde 2026-10-14**. Rotina:
  [[Guardião - Verificação na nuvem]].
- **Banco:** [[Supabase]] DATA WAREHOUSE (`ivcnotrynogaljrvvyes`), schema `saude`; e uma RPC no GESTAO TI
  (`mpupmrzcbygwpblrewrb`).

## Decisões do Júlio (2026-10-14)
- **Alerta por Telegram**, no mesmo bot do resumo do [[GESTÃO TI]] ([[Gestão TI - Resumo diário no Telegram]]).
- **Tentar de novo 1 vez e avisar** quando uma carga falha.
- **Vigia na VM `SRV-IA`**, para ver o Agendador e conferir as cargas com o [[WinThor]].
- **Saúde também no arquivo baixado** do cérebro, com uma chave de leitura.

## Regras da casa que mandam aqui
- **Alarme falso é pior que nenhum alarme**: na dúvida, "sem dado" com o motivo escrito, nunca vermelho.
- **Nada some em silêncio**: carga que não rodou, que parou no meio ou que deu ERRO vira falha, com horário e números.
- **Prove, não afirme**: "tentei de novo e deu certo" só com a prova de que a VM disparou e a carga veio depois.
- **Nenhum segredo** em código, nota ou log: o segredo do agendador (`guardiao_cron`) nasceu no Vault sem ninguém ver;
  os do Telegram e a chave de leitura quem cadastra é o Júlio.

## As peças
| Peça | Onde | O que faz |
|---|---|---|
| Schema `saude` | DATA WAREHOUSE | catálogo do que vigiar (`alvo`), estado atual (`verificacao`), `incidente`, `batimento`, `conferencia`, `pedido_correcao`, `aviso`. Todas com RLS ligado e **nenhuma política**; funções `security definer`, só `service_role` executa |
| `saude.verificar()` | DATA WAREHOUSE | julga no banco tudo o que depende só do banco e grava estado e incidentes |
| pg_cron + pg_net | DATA WAREHOUSE | `saude-verificar` de 5 em 5 min, `saude-guardiao` de 10 em 10 min (chama a função), `saude-limpeza` às 01:20 (90 dias) |
| Função `guardiao` | Edge Function do DATA WAREHOUSE, `verify_jwt = false`, autenticação própria | testa os 10 sites, lê o robô do Gestão TI, manda o Telegram e serve o `/resumo` ao arquivo baixado. Versão 3 publicada, código `guardiao/1.0.2` |
| RPC `public.saude_robo()` | GESTAO TI | devolve só tipo, horários, sucesso e contagens das execuções do robô (48 h), **sem o texto de erro**; a única exceção ao "anon revogado" do [[GESTÃO TI]] |
| Vigia da VM (`guardiao_vm.py` 1.0.1) | VM `SRV-IA`, tarefa `Guardiao - Vigia` | batimento, tarefas do Agendador, servidor de margem, disco, relógio, aquecedor, conferência com o WinThor e a nova tentativa |
| Painel | artifact do [[Cérebro da Lube]] (versão 7) e arquivo baixado | chip de saúde, painel Saúde, bolinha das rotinas, selo por etapa no funil, robô reagindo, `ver_saude` no "Pergunte ao cérebro" |

## O que vigia (39 itens em 2026-10-14; 42 em 2026-10-19, com o Trade; 45 em 2026-10-20, com o Inventário; 46 com o espaço do banco; **47 desde 2026-10-20 11:52**, com o próprio Guardião)
**Espaço do banco (desde 2026-10-20):** `servico:banco-espaco`, medido todo dia às 05:40 pela [[Guardião - Espaço do banco]]
(atenção com mais de 1 GB sem dono no disco em 2 medições seguidas). Junto, a limpeza semanal do registro operacional.
**Rotinas (14):** as 13 de `Rotinas/` (com o [[Trade - Sync]], desde 2026-10-19, e o [[Inventário - Sync]], desde 2026-10-20) e a ponte do [[PAINEL ICMS]].

| Rotina | Horários | Tolerância / duração máx. | Janela da nova tentativa |
|---|---|---|---|
| [[BI Compras - Sync rapidas]] | 07:50, 11:50, 17:50, 23:50 | 15 / 20 min | o dia todo |
| [[BI Compras - Sync faturamento]] | 02:50 | 15 / 25 min | 00:00–07:20 (pesada) |
| [[BI Comercial - Sync rapidas]] | 06:45, 07:45, 08:45, 09:45, 12:45, 14:45, 15:45, 16:45 | 20 / 25 min | o dia todo |
| [[BI Comercial - Sync margem]] | 03:45 | 30 / 40 min | 00:00–06:00 (pesada; o Comercial rápidas, que grava as mesmas `core.dim_*`, começa 06:45) |
| [[Reposições - Sync]] | 07:35, 09:35, 11:35, 13:35, 15:35, 17:35, 22:35 | 10 / 15 min | o dia todo, mas **adiada** enquanto a máquina estiver "a confirmar" |
| [[Trade - Sync]] (desde 2026-10-19) | 06:25, 09:25, 12:25, 15:25, 18:25 | 10 / 15 min | o dia todo |
| [[Inventário - Sync]] (desde 2026-10-20) | 07:05, 09:05, 11:05, 13:05, 15:05, 17:05, 19:05, 22:05 | 10 / 25 min (31 s com o banco folgado, 17 min com ele lento) | o dia todo |

Horários e tarefas saíram das notas de `Rotinas/` e do `instalar_e_agendar.ps1` de cada sistema; as consultas de cada
grupo, do `controle_carga` real de 07/10 a 14/10; as tolerâncias, do fim mais demorado medido, com folga de ~2×. Nada
chutado: o que não se sabe fica "a confirmar".

- **Cargas:** pelo `controle_carga` do schema (`compras`, `comercial`, `reposicao`; `trade` desde 2026-10-19 e `inventario` desde 2026-10-20): toda consulta com `OK` na janela
  do horário, sem atraso, sem passar do limite, sem queda forte de linhas. No COMERCIAL e no REPOSIÇÕES também pela
  **tranca de carga** (`pg_locks`, a mesma chave do `bi_comum.py`): tranca presa = "em andamento"; consulta faltando com a
  tranca solta = "parou no meio".
- **Entrega:** no REPOSIÇÕES, o `painel_cache` refeito depois da carga; no COMERCIAL, as views que o painel lê
  (`mv_margem_dia` e `mv_margem_mes` contra a `fato_margem_item`; `mv_comissao_*` e `mv_devolucao_rca_mes` contra os
  fatos), 15 min depois da carga. View atrás = atenção, "o painel mostra dado velho".
- **Folha** ([[Validação mensal da folha]]): competência anterior importada nas 5 empresas até o dia 15; rotina de
  pessoa, nunca vira falha.
- **Gestão TI** ([[Gestão TI - Leitura de e-mail e cobrança]]): leitura aceita até 10:00 e cobrança até 11:00; e-mail
  que ficou para a próxima leitura ou cobrança que falhou no envio = atenção. O resumo do Telegram do Gestão TI fica
  "sem dado" (o robô não registra o envio); o [[Gestão TI - Kanban TI]] e a ponte do ICMS ficam "desligado", com o fato
  escrito.
- **Servidor de margem** ([[BI Comercial - Servidor de margem]]): `http://localhost:8080/` na `SRV-IA` (200, 302 ou 401
  = no ar), olhando de novo em 20 s antes de acusar. **Fila da [[Abertura de margem]]:** pedido pendente há mais de
  10 min, executando há mais de 20 min ou com erro em 24 h = atenção.
- **Aquecedor** ([[Reposições - Aquecer painel]]): pelo `aquecer_painel.log` (a regra da especificação, pelo
  `painel_cache`, daria alarme falso o dia todo: ele só muda com a carga). Sem chamada há mais de 20 min = atenção,
  60 min = falha; três erros seguidos = falha.

**Sites (10):** `GET /.sentinela/saude` de 10 em 10 min em painel-lube-distribuidora, painel-compras-rosy,
gestao-comercial-web-three, gestao-finaceiro, rh-absentismo, gestao-de-saidas-de-veiculos, painel-icms,
gestao-ti-ruddy e sac-lube (`.vercel.app`); o reposicoes-web não tem guarda e vale 200 na página. Guarda com a lista
da central = ok; sem a lista, 3xx ou 4xx = atenção; 5xx, tempo esgotado, erro de rede ou `DEPLOYMENT_*` da Vercel =
falha. Essa rota da [[SENTINELA LUBE]] não registra evento.

**VM `SRV-IA` (3):** batimento do vigia (mais de 35 min sem = falha; nenhum ainda = "sem dado", sem alarme), disco C:
(menos de 10% livre = atenção, menos de 3% = falha) e relógio (diferença de 300 s ou mais para o banco, ou fuso
diferente de UTC−3 = atenção: foi o que fez o COMPRAS rodar 4 h atrasado em 2026-09-28).

**O próprio Guardião (1, desde 2026-10-20):** `servico:guardiao-nuvem`, "Guardião · Verificação na nuvem", julgado pelo
banco a cada `saude.verificar()` (`saude._avaliar_guardiao`, migração `saude_v1_guardiao_parado`). Sem ele, função
parada só deixava os sites "sem dado" — que não alarma — e nenhum aviso saía. Regras:
- função `guardiao` sem rodar (o registro mais novo dos sites) há mais de **25 min** = atenção; mais de **45 min** = falha;
- **3 ou mais falhas** dos jobs `saude-verificar`/`saude-guardiao` na última hora = atenção, com o motivo ("job startup
  timeout" = banco sobrecarregado, não abre conexão a tempo); em alarme, **só fecha depois de 1 hora sem falha**;
- **apagão:** se nada avaliou o item por mais de 25 min (nem o agendador nem a função rodaram), a primeira avaliação
  depois conta o buraco ("ficou parado de HH:MM a HH:MM sem ninguém ver");
- na volta, o texto conta a história ("ficou sem rodar de 10:30 a 11:38; o agendador falhou 31 vezes"). O aviso sai na
  primeira rodada completa da função; se o incidente abrir e fechar antes, sai "teve um problema às HH:MM e já voltou".
- Limites em `saude.alvo.config` (`atencao_min`, `falha_min`, `falhas_cron`, `janela_min`): mudam sem migração. Ninguém
  de fora grava o item (a `registrar()` recusa).

**Tarefas do Agendador (9):** `BI Compras - Sync rapidas`, `BI Compras - Sync faturamento`, `BI Comercial - Sync
rapidas`, `BI Comercial - Sync margem`, `BI Comercial - Servidor de margem`, `BI Comercial - Agente de margem`,
`Reposicoes - Sync`, `Reposicoes - Aquecer painel` e a própria `Guardiao - Vigia`. Desativada = atenção; último
resultado com erro = falha; horários gravados diferentes dos combinados = atenção.

**Conferência com o WinThor (3, uma por sistema: compras, comercial, reposicao):** (a) **integridade** — o destino tem
as linhas que a carga disse ter gravado (cargas completas; dimensão com upsert só precisa ter pelo menos isso); (b)
**origem** — `SELECT COUNT(*)` do próprio SQL da consulta no Oracle, com 60 s de limite: leves a qualquer hora até
40 min depois da carga, pesadas só das 01:00 às 06:30. Diferença de até 1% (ou 20 linhas) = ok, até 5% = atenção,
acima = falha. A `margem_item` (3,3 mi de linhas) fica fora da contagem no Oracle: passaria de 60 s.

## Regras contra alarme falso
- **Etapa que termina em `AVISO`** (migração `saude_v1_trade`, 2026-10-19): é um plano B (o Trade usa quando a pasta de fotos ou a planilha estão fora do ar e segue com a cópia do banco). O dado vale, mas a rotina vira **atenção** com o motivo escrito, em vez de ser lida como ERRO (falha) ou de passar calada. Só conta o AVISO que veio depois do último `OK` da janela. Compras, Comercial e Reposições nunca gravaram AVISO: nada mudou para eles (reavaliação de 10 dias idêntica antes e depois).
- Etapa que conta fotos novas por carga (`miniaturas` do Trade) é **volátil**: 0 é o normal.
- Carga só é julgada depois da tolerância do horário; "parou no meio" só com a tranca solta (prova) ou depois do dobro
  do limite de duração.
- Queda: menos de 40% da mediana das 10 últimas cargas OK (`variacao_queda` 0,6); subida só acima de 3×. O "ATENCAO: o
  Power BI tinha X linhas" das mensagens antigas é ignorado. Status do `controle_carga` comparado sem caixa.
- Dimensão carregada por duas rotinas (`dim_produto` no Compras rápidas e no faturamento; `dim_rca` e cia. no
  Comercial rápidas e na margem) só conta junto com as consultas principais da própria carga.
- Pedidos em aberto com 0 linhas (fim de semana) e faturamento com 0 linhas de 1º a 7 de janeiro (virada do ano) viram
  nota, não alarme.
- ERRO depois de um OK na mesma janela = atenção (o rollback da nova tentativa guarda a carga boa).
- Cada rotina só é julgada desde quando o horário atual vale (`vigente_desde`, 09/10): o atraso de 4 h do COMPRAS e a
  carga em dobro do COMERCIAL (07/10 a 09/10) foram reais, mas de antes.
- Site e servidor de margem só abrem incidente na **2ª checagem ruim seguida**; guarda sem a lista ganha uma 2ª e uma
  3ª pergunta (às 12:00 de 14/10 os 9 sites com guarda vieram sem a lista na 1ª pergunta, partida a frio; sem isso
  seriam 9 alarmes falsos a cada rodada).
- Tarefa que se repete o dia inteiro só vira falha com erro em duas rodadas seguidas; tarefa invisível (vigia sem
  administrador) e máquina "a confirmar" = "sem dado".
- Um incidente aberto por item; atenção que piora para falha é avisada como "Piorou". Conferência não abre incidente
  próprio (entra na rotina), tarefa de rotina com incidente aberto não abre outro, e tarefa de carga com código 1 não
  abre um segundo incidente (o `controle_carga` já mostra o erro).
- **Prova:** `saude.reavaliar` dos últimos 14 dias (só leitura) acha só os 3 problemas reais do item "Achados"; nenhum
  alarme nas cargas normais. Simulações de falha só dentro de transação desfeita (nada gravado em produção).

## Correção automática (tentar 1 vez e avisar)
- Incidente de **falha** em rotina com tarefa no catálogo, marcada corrigível e dentro da janela → **um**
  `pedido_correcao` para a máquina. O vigia dispara a tarefa (`Start-ScheduledTask`) na rodada seguinte e responde.
  Nunca mais de um pedido por incidente; pedido não atendido em 2 h expira; se a carga volta antes, o pedido fica
  "Dispensado: voltou antes da nova tentativa".
- Pesadas só de madrugada (faturamento até 07:20, margem até 06:00), para não pesar no Oracle no expediente.
- Motivo **passageiro** (tranca presa, vigia fora, máquina a confirmar) adia e decide de novo na verificação seguinte;
  motivo **definitivo** (sem tarefa, não corrigível, fora da janela) fica escrito no incidente.
- "Rodou de novo (correção automática…)" e "Tentei de novo às HH:MM e deu certo" **só** quando a VM respondeu
  "Disparei…" e a carga começou depois do disparo.
- Segurança (o vigia roda como administrador): um gatilho no banco só aceita pedido de tarefa do catálogo, corrigível,
  da mesma máquina e sem curinga; o vigia compara o nome exato, exige uma única tarefa que rode algo de `C:\BI` e não
  dispara se outra carga do mesmo schema estiver rodando ou começar antes de esta terminar.
- **Até o vigia rodar na `SRV-IA`, nenhum pedido sai** (o incidente diz "o vigia da VM ainda não foi instalado").

## Avisos (Telegram)
- Abertura, piora e volta de incidente: **uma mensagem só** por rodada (falhas, depois atenções, depois voltas), no
  estilo do resumo do Gestão TI: cabeçalho "Guardião da Lube · dia · hora", "🔴 Sistema · Nome — o fato", "🟠" para
  atenção, "✅ Voltou: …".
- **Silencioso das 22:00 às 06:30** (chega sem tocar). **Resumo diário às 07:40**, uma vez por dia: "Bom dia. Noite: X
  de Y cargas OK (…). Agora: X de Y em dia."
- Sem os segredos do Telegram, o aviso é gravado em `saude.aviso` com "Telegram ainda não configurado" e só aparece no
  painel (é a situação de 2026-10-14; o resumo diário do dia já foi consumido assim às 11:50).
- O vigia da VM avisa direto se a VM ficar mais de 30 min sem falar com o Supabase (só com o Telegram no ENV dele,
  opcional).

## O painel
- **Artifact versão 7** (https://claude.ai/artifact/Tnrde74sov8LPGmgj8yjT4), que agora declara o **conector
  Supabase** e só roda a consulta fixa `select saude.painel()`. O conector de quem vê precisa se chamar "Supabase"; na
  primeira leitura o claude.ai pede o consentimento.
- **Arquivo baixado:** `GET …/functions/v1/guardiao/resumo` com o cabeçalho `x-chave-leitura`. A chave fica só na aba;
  vai para o navegador só com "Lembrar neste computador". Sem a chave no Vault o `/resumo` responde 503 ("o Júlio ainda
  não cadastrou a chave"); chave errada, 401.
- Chip "Tudo em dia / N atenções / N falhas / Sem dados" com "verificado há X min"; painel Saúde com incidentes abertos,
  Rotinas, Sistemas no ar, VM SRV-IA, Conferência com o WinThor e Últimos incidentes; bolinha e "última: …" na aba
  Rotinas; selo por etapa no funil; o robô fica âmbar ou vermelho e reage a incidente novo e à volta. "Está tudo
  rodando?" no Pergunte ao cérebro usa a ferramenta `ver_saude`.

## Como conferir o estado
- `select saude.painel();` no SQL Editor do DATA WAREHOUSE (é o que o painel lê) — ou o chip do painel do robô.
- `select saude.reavaliar(now() - interval '7 days', now());` — reavalia as cargas sem gravar nada (até 15 dias).
- `select saude.chamar_guardiao('simular');` — roda a função inteira sem mandar Telegram; o resultado sai em
  `select status_code, content from net._http_response where id = <número devolvido>;`.
- `select * from saude.batimento;` — o vigia da VM está de pé? (linha `vm:SRV-IA`).
- `select status, resumo, detalhe from saude.verificacao where alvo_id = 'servico:guardiao-nuvem';` — o próprio Guardião
  está conferindo? (última rodada da função, falhas do agendador na última hora, episódio em curso).
- `select jobname, schedule, active from cron.job where jobname like 'saude-%';` e `cron.job_run_details` — o
  agendador está rodando?
- Na VM: `P:\INTEGRAÇÃO BI\GUARDIAO\TESTAR SEM GRAVAR.bat` mostra o que o vigia faria, sem gravar nada.

## Estado em 2026-10-14 (conferido às 14:05 e de novo às 14:10)
**39 itens: 17 em dia, 1 atenção, 0 falha, 19 sem dado, 2 desligados.**
- **Atenção:** BI Comercial · Sync margem — "Rodou às 03:45, 6 de 6 consultas OK, 3.426.968 linhas (19 min 55 s), mas
  a mv_margem_dia (página Margem por item) parou em 10/10, e a fato_margem_item já tem 14/10: o painel mostra dado
  velho." Incidente aberto às 13:40, aviso gravado com "Telegram ainda não configurado".
- **Em dia:** Compras rápidas, Faturamento, Comercial rápidas, Reposições, folha de set/2026 nas 5 empresas, Gestão TI
  (leitura às 08:29, cobrança às 09:27), os 10 sites e a fila da Abertura de margem (vazia).
- **Sem dado:** tudo o que depende do vigia da VM (VM, disco, relógio, as 9 tarefas, servidor de margem, aquecedor e as
  3 conferências) e o resumo do Telegram do Gestão TI.
- **Desligados:** Kanban TI e a ponte do Painel ICMS.
- pg_cron `saude-verificar`, `saude-guardiao` e `saude-limpeza` ativos; a função responde HTTP 200 (~3,6 s por
  rodada).

## Achados reais do primeiro dia
1. **Faturamento de 2026-10-11 falhou e ninguém soube.** `faturamento` deu ERRO às 03:05:41 (`QueryCanceled:
   canceling statement due to statement timeout`, depois de 906,8 s), 3 de 4 consultas OK. Voltou sozinho na carga de
   12/10 às 02:51 (259.730 linhas). O Guardião teria acusado às 03:08–03:10. Ver [[BI COMPRAS]].
2. **A `mv_margem_dia` parou em 10/10** enquanto a `fato_margem_item` já tem 14/10: a página *Margem por item* do
   [[BI COMERCIAL]] mostra dado velho. A correção (pôr a view na `VIEWS_DO_PAINEL`) está no commit `ad7eefb`
   (2026-10-13, `Desktop\BI\8. COMERCIAL`), mas **não chegou ao `P:` nem à `SRV-IA`**: o `sync_bi_comercial.py` da rede
   ainda tem só as quatro views antigas (conferido em 2026-10-14).
3. **A `margem_item` morreu sem registrar em 11/10 e 13/10**: nenhuma linha no `comercial.controle_carga`, nem OK nem
   ERRO — e o sync sempre grava uma das duas, a não ser que o processo morra. O limite de tempo da tarefa é de 3 h,
   então não é isso. A carga da margem também passou de ~6 min (2026-09-28) para **17 a 20 min** (14/10: terminou às
   04:04:57, 19 min 55 s). Causa a investigar no `sync_bi_comercial.log` da VM.
4. **Guarda fria da Sentinela:** depois de uns minutos parada, a guarda responde a primeira pergunta sem a lista da
   central (espera de 700 ms) — então a primeira visita não passa pela lista de bloqueio. Não é falha do Guardião;
   vale o dono da [[SENTINELA LUBE]] olhar. Às 14:00 o RH deu atenção porque as duas perguntas caíram em instâncias
   frias; daí a 3ª pergunta (função 1.0.2).
5. **Pastas abertas:** na `LOGISTICA-55` (onde o vigia foi testado), `C:\BI` e `C:\BI\COMERCIAL` podem ser alteradas por
   qualquer usuário. Rodando como administrador, o vigia não executa o catálogo de SQL de pasta assim (quem editasse
   rodaria código como administrador). O instalador avisa o mesmo na `SRV-IA`.

## O que fica com o Júlio
1. ~~**Telegram**~~ — **feito em 2026-10-14**: o Júlio cadastrou `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` em Supabase ›
   DATA WAREHOUSE › Edge Functions › Secrets (os mesmos do Gestão TI na Vercel); teste `select saude.testar_telegram();`
   às 17:27 voltou 200 com "Guardião da Lube ligado ✅". O **chat ID** é o número da conversa que recebe (hoje, a
   conversa particular do Júlio com o bot; um grupo teria um número negativo começando com `-100`).
2. **Chave de leitura** (arquivo baixado): no SQL Editor do DATA WAREHOUSE, gerar no próprio banco com
   `select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'guardiao_chave_leitura');`, ler uma
   vez em `vault.decrypted_secrets` e digitar no cartão "Chave de leitura do Guardião" do arquivo. "Lembrar neste
   computador" só num computador seu. Chave com menos de 32 caracteres não vale.
3. **VM:** na `SRV-IA`, rodar `P:\INTEGRAÇÃO BI\GUARDIAO\INSTALAR TUDO.bat` com conta administradora. O `ENV` do
   Guardião ainda não existe em `1 - CONFIGURACAO` (o instalador oferece copiar o do REPOSICOES). No fim, conferir "roda
   como administrador: SIM" e o primeiro batimento em `saude.batimento`. Se o instalador avisar pastas de `C:\BI`
   abertas, o TI decide se trava (comando no `LEIA-ME.txt`).
4. **Margem por item:** levar o commit `ad7eefb` do COMERCIAL para
   `P:\INTEGRAÇÃO BI\COMERCIAL\2 - SISTEMA COMERCIAL\sync_bi_comercial.py` e rodar o `INSTALAR TUDO.bat` do COMERCIAL na
   `SRV-IA`. O alarme fecha sozinho quando a `mv_margem_dia` alcançar a `fato_margem_item` (na margem das 03:45).
5. **Conferir** em DATA WAREHOUSE › Settings › API › Exposed schemas que `net` não está exposto (o cabeçalho do
   agendador passa pela fila do pg_net). Não revogar o PUBLIC do schema `net` sem testar.

## Limitações (2026-10-14)
- **Quem vigia o Guardião?** _Desde 2026-10-20 o próprio banco vigia_ (item "Verificação na nuvem", acima): função
  parada ou agendador falhando viram atenção ou falha no painel na hora. **Mas o Telegram continua saindo pela própria
  função:** com ela parada, o aviso só chega quando ela volta (com a história). O único aviso que não depende do banco
  é o do vigia da VM, e ele está **sem Telegram no ENV** (`telegram_direto: false`, conferido em 2026-10-20): hoje nem o
  "Supabase fora" dele avisaria. Sugestão (Claude): pôr o Telegram no ENV do vigia e ensiná-lo a avisar quando a função
  ficar mais de 30 min sem rodar, pelo mesmo caminho do "Supabase fora".
- **Ainda sem vigia:** as importações do [[BI ABSENTEÍSMO RH]] (PontoMais) e da [[GESTÃO DE SAÍDA DE VEÍCULOS]]
  (Getrak), que ficam em Supabase próprios; a ponte do [[PAINEL ICMS]] (aparece como desligada). O [[Trade - Sync]] entrou
  no catálogo em 2026-10-19 (as cargas vigiadas são as dos schemas `compras`, `comercial`, `reposicao` e `trade`; a
  lista de schemas é fixa de propósito, porque nome de schema entra em SQL dinâmico).
- **Reposições:** máquina "a confirmar" no catálogo; a nova tentativa fica adiada até o vigia achar a tarefa na
  `SRV-IA`.
- **COMPRAS sem tranca de carga:** o Guardião julga só pelo tempo, e uma nova tentativa não tem a proteção contra carga
  em dobro (risco baixo: o vigia não dispara tarefa que já está rodando).
- Não há tranca contra duas rodadas do `/rodar` no mesmo segundo (manual e do cron): um aviso pode sair duplicado.
- O "Telegram configurado" do painel é deduzido do último aviso; acerta sozinho na primeira mensagem de verdade.
- A reavaliação só valida as regras de banco; o que só existe no presente (tranca, `painel_cache`, agregados, sites,
  VM) foi testado em simulação desfeita.
- Nas primeiras rodadas o vigia fará até 18 contagens no destino (inclusive a `fato_margem_item`, 3,3 mi de linhas) e
  as contagens leves no WinThor no expediente (até ~150 s de Oracle por rodada): olhar o `guardiao.log` da primeira
  manhã.
- Os testes em transação desfeita consumiram números de id do `controle_carga` do COMPRAS e do COMERCIAL (lacunas na
  sequência); nenhuma linha ficou gravada.

## Pendências
- [x] Telegram: cadastrar os dois segredos e testar — Júlio, 2026-10-14 (teste das 17:27 chegou). O alerta da margem
  aberto às 13:40, antes do Telegram, **não** é reenviado; o próximo incidente e o resumo das 07:40 de amanhã chegam.
- [ ] Chave de leitura no Vault e no arquivo baixado — Júlio
- [x] Instalar o vigia na `SRV-IA` e conferir o primeiro batimento — Júlio, 2026-10-14 17:33 (batimento da `SRV-IA`
  conferido: relógio a 5 s do banco, disco 92% livre, ligada há 14 dias; 16 conferências de integridade, todas batendo)
- [x] Apagar a tarefa `Guardiao - Vigia` e a pasta `C:\BI\GUARDIAO` da **LOGISTICA-55**, instaladas por engano às
  17:31 — feito. A tarefa o Júlio apagou em 2026-10-14; às 17:39 foi para a Lixeira, por engano, a pasta do **código**
  (`Desktop\BI\12. GUARDIAO`) em vez da `C:\BI\GUARDIAO`. Em 2026-10-15 o Claude, com o ok do Júlio, **restaurou** a do
  código da Lixeira (histórico do Git intacto, até o `a291044`) e mandou a `C:\BI\GUARDIAO` (que tinha a cópia do `ENV`)
  para a Lixeira — o Júlio esvazia quando quiser.
- [ ] Travar as permissões de `C:\BI` na `SRV-IA` (comando no `LEIA-ME.txt`) — sem isso, a **comparação com o
  WinThor** não roda (o vigia, como administrador, não executa `consultas_*.py` de pasta que qualquer usuário altera);
  a integridade (destino = carga) roda normalmente — o TI decide
- [ ] Aquecedor do Reposições falhando na `SRV-IA` com `CERTIFICATE_VERIFY_FAILED` (achado do vigia em 2026-10-14) —
  ver [[REPOSIÇÕES E CHAMADOS]]
- [ ] Levar o `ad7eefb` do COMERCIAL para o `P:` e reinstalar na `SRV-IA` — Júlio
- [ ] Conferir que `net` não está nos Exposed schemas — Júlio
- [ ] Investigar no `sync_bi_comercial.log` da VM por que a `margem_item` morreu em 11/10 e 13/10 — Claude, quando o
  Júlio pedir
- [ ] Conferir no claude.ai o chip, o painel Saúde e a pergunta "está tudo rodando?" na versão 7 (daqui não dá para
  testar: localhost não tem o conector) — Júlio e Claude
- [ ] Confirmar que o `Cerebro da Lube.html` baixado foi regerado com a saúde (`empacotar.py`; o `saude.js` entra
  sozinho) — Claude
- [x] Pôr o [[Trade - Sync]] no catálogo — feito em 2026-10-19, pedido do Júlio (migração `saude_v1_trade`)
- [x] Pôr o [[Inventário - Sync]] no catálogo — feito em 2026-10-20, pedido do Júlio (migração `saude_v1_inventario`)
- [x] **Banco sobrecarregado deixa o Guardião cego** (achado em 2026-10-20 11:25) — causa achada e alarme feito em
  2026-10-20 (Claude): o `pg_stat_statements` incha com os lotes do `execute_values` dos ETLs, a consulta de métricas do
  próprio Supabase passa a levar 14–16 s a cada minuto depois da margem das 03:45, e às 08:00 o banco satura e acaba
  caindo (15, 16, 18, 19 e 20/10). Detalhe e proposta em [[2026-10-20 — Banco sobrecarregado e o Guardião que avisa quando para]]
  e no [[Supabase]]. Alarme: item "Verificação na nuvem" (migração `saude_v1_guardiao_parado`).
- [ ] **Decidir a correção do banco** (proposta de 2026-10-20): zerar o `pg_stat_statements` de hora em hora pelo pg_cron
  (reversível) e trocar o `execute_values` por `COPY` nos ETLs (a raiz, uma sessão por sistema) — Júlio
- [ ] Pôr `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no ENV do vigia (`P:\INTEGRAÇÃO BI\GUARDIAO\1 - CONFIGURACAO`) e
  reinstalar: sem eles nem o "Supabase fora" do vigia avisa — Júlio
- [ ] Decidir: o vigia da VM vigiar o próprio Guardião (avisar quando a função ficar mais de 30 min sem rodar; é o único
  aviso que não depende do banco; precisa do Telegram no ENV dele) — Júlio
- [ ] Commit local do `db/11_guardiao_parado.sql` e do README (a sessão de 2026-10-20 não commitou) — Júlio pede, Claude faz
- [ ] Remoto no GitHub para `Desktop\BI\12. GUARDIAO` (hoje só git local) — Júlio decide

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-20 (11:52)** — **O Guardião avisa quando ele próprio para** (pedido da conversa do Inventário; Claude fez): migração **`saude_v1_guardiao_parado`** (`db/11_guardiao_parado.sql`, README; **sem commit**): função nova `saude._avaliar_guardiao` e item **`servico:guardiao-nuvem`** ("Guardião · Verificação na nuvem") → **47 alvos**; a `saude.verificar()` ganhou o ramo `fonte = 'guardiao'` e a `saude.registrar()` passou a recusar o item, **por âncora na definição do banco** (conferido: sem a linha nova, as duas têm o mesmo md5 de antes). Testada em transação desfeita (9 cenários) e reavaliada de 14/10 a 20/10 pelo pg_cron: 5 episódios, todos de banco degradado de verdade, nenhum em 14/10 e 19/10. Primeira avaliação real às 11:55: **atenção**, "o agendador do banco falhou 7 de 15 rodadas na última hora (job startup timeout)" (incidente 59); **Telegram entregue às 12:00:05** ("🟠 Guardião · Verificação na nuvem — … 5 de 16 rodadas …"), o primeiro aviso desde as 07:40. Na mesma conversa, a causa da sobrecarga (o `pg_stat_statements` inchado pelos lotes dos ETLs) e a proposta ao Júlio · [[2026-10-20 — Banco sobrecarregado e o Guardião que avisa quando para]]
- **2026-10-20 (10:27)** — **Inventário no catálogo** (Júlio pediu "pode ligar o Inventário no Guardião: rotina, tarefa e site", Claude fez): migração **`saude_v1_inventario`** (`db/09_inventario.sql`, commit local no `12. GUARDIAO`): as três funções que leem o `controle_carga` por schema aceitam `inventario` — **desta vez trocando só a lista na definição que está no banco** (`pg_get_functiondef`), para não repetir o que o 08 fez; provado: sem o `inventario`, as três ficam com o mesmo md5 de antes. Catálogo novo: `rotina:inventario-sync` (8 horários, 10 consultas, tolerância 10 min, limite 25 min, tranca `carga:inventario:carga`, vigente desde 20/10 10:25), `tarefa:Inventario - Sync` e `site:movimentacao-inventario` → **45 alvos**. Testado: a carga das 10:03 avaliada como `ok` (10 de 10, 17 min), horário sem carga como `falha`; as outras 6 rotinas de carga seguem `ok`. Rodada das 10:30: tarefa vista pelo vigia na `SRV-IA` ("última execução hoje 10:03, sem erro; próxima 11:05"), site `ok` (53 ms), rotina `sem_dado` até a carga das 11:05 · [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]

- **2026-10-20** — **Limpeza na sexta e a conferência semanal do Claude** (Júlio: "toda sexta você tenha uma rotina de limpeza do banco, verificar se tem lixo e limpar, caso precisarmos de espaço com o ambiente limpo, a gente troca a máquina do banco"): migração `saude_v1_limpeza_na_sexta` (a `saude-manutencao-semanal` passa de domingo para **sexta 05:30**; commit `275e1ef`) e tarefa agendada do Claude `limpeza-semanal-banco`, **toda sexta às 08:11** (confere a limpeza, mede, procura quedas e tabela inchada, VACUUM simples só onde precisa, anota a semana em [[Guardião - Espaço do banco]] e recomenda: "tudo limpo", "lixo que só o Supabase limpa" ou, só com o ambiente limpo sem espaço, "trocar a máquina") · [[2026-10-20 — Limpeza semanal e o espaço do banco]]
- **2026-10-20** — **Espaço do banco** (Júlio pediu a limpeza semanal; Claude fez): migração **`saude_v1_espaco_banco`** (`db/10_espaco_banco.sql`, commit `52a76a0`): item novo `servico:banco-espaco` (alimentado pela medição diária `saude.medir_espaco()` às 05:40, vale 26 h, atenção com mais de 1 GB sem dono em 2 medições seguidas; não mede com carga regravando tabela, para não dar alarme falso) e a limpeza `saude.manutencao_semanal()` aos domingos às 05:30 (só registro operacional: pg_cron com mais de 14 dias, pg_net com mais de 2 dias, medições com mais de 180 dias). Só cria funções e tabelas novas, nenhuma função existente foi recriada. Testada em `BEGIN … ROLLBACK`; primeira medição real: **4,4 GB no banco, 1,2 GB de dados, 3,3 GB sem dono** (sobra das quedas de 15, 16, 18 e 19/10) → atenção · [[Guardião - Espaço do banco]] · [[2026-10-20 — Limpeza semanal e o espaço do banco]]
- **2026-10-19** — **"Sem tranca" deixa de ser prova de que a carga morreu** (Júlio pediu, Claude fez): migração **`guardiao_silencio_antes_de_falha`**. A `_avaliar_carga` tratava `v_tranca is false` + consulta faltando como falha imediata ("a carga terminou sem registrar"); mas o *advisory lock* morre junto com a sessão do Postgres, e com o banco instável uma conexão reaberta no meio faz a tranca sumir com o processo vivo. Agora, se alguma consulta entrou há menos que a duração máxima da rotina, o veredito é **"em andamento"**; só o silêncio prolongado vira falha. Deu alarme falso em 19/10 às 07:45, com as 9 consultas rodadas e registradas. A troca foi por **âncora dentro do banco** (se o trecho não fosse o esperado, a migração falhava e nada mudava) e conferida depois nas três rotinas (Compras, Comercial rápidas e margem) · [[2026-10-19 — Painel comercial no cache e o Guardião sem alarme falso]]
- **2026-10-19** — **Trade no catálogo** (Júlio pediu, Claude fez): migração **`saude_v1_trade`** (`db/08_trade.sql`): as três funções que leem o `controle_carga` por schema aceitam `trade`, e a `_avaliar_carga` passa a tratar **AVISO** como atenção com o motivo; catálogo novo: `rotina:trade-sync`, `tarefa:Trade - Sync` e `site:gestao-comercial-trade` → **42 alvos**. Testado em transação desfeita: reavaliação de 10 dias **idêntica** para Compras, Comercial e Reposições, e o Trade teria acusado as duas falhas de 16/10 (`publicar` com ERRO às 09:32 e carga das 12:25 que não rodou). Função `guardiao` e vigia da VM **sem mudança** (a lista de sites e de tarefas sai do catálogo) · [[Trade - Sync]]
- **2026-10-19** — **Correção reaplicada** (erro do Claude, já corrigido): a `saude_v1_trade`, aplicada 38 s depois da `guardiao_silencio_antes_de_falha` (outra conversa, 10:20:01), recriou a `_avaliar_carga` a partir do arquivo 06 e **desfez** a correção "sem tranca não prova que a carga morreu" por ~10 min. Reaplicada pela migração `guardiao_silencio_antes_de_falha_reaplicada` (o mesmo bloco, por âncora) e conferida na função do banco (correção + Trade + AVISO); o `db/08_trade.sql` (commit `6b06e6c`) agora a inclui. **Lição:** migração que recria função inteira precisa partir do texto que está no banco (`pg_get_functiondef`), não do arquivo do repositório, ou ser um remendo por âncora como a da outra conversa.
- **2026-10-14** — **Vigia instalado na `SRV-IA`** (Júlio, 17:33): primeira rodada com 12 ok e 1 falha real (aquecedor do Reposições com erro de certificado), 16 conferências de integridade batendo; comparação com o WinThor parada até travar as permissões de `C:\BI`. Antes, às 17:31, instalado **por engano na LOGISTICA-55** (o instalador avisou; o Júlio confirmou e depois corrigiu): o banco recusou o batimento, mas aceitou a checagem da própria tarefa → **migração `saude_v1_maquina_fora_do_catalogo`** (`db/07`, commit `a291044`, Claude): checagem com máquina fora do catálogo é recusada e a errada voltou a "sem dado" · [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-14** — **Telegram ligado**: segredos cadastrados pelo Júlio; teste do Claude (`saude.testar_telegram()`) às 17:27 entregue ("Guardião da Lube ligado ✅"); o painel passa a mostrar o Telegram configurado · [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-14** — Pasta do código renomeada de `Desktop\BI\11. GUARDIAO` para `12. GUARDIAO` (o 11 ficou com o TRADE)
  (Claude; commit `0bb8a2a`, git local sem remoto) · [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-14** — Painel do robô com a saúde: chip, painel Saúde, aba Rotinas, selo no funil, robô reagindo e
  `ver_saude`; **versão 7** do artifact `Tnrde74sov8LPGmgj8yjT4`, declarando o conector Supabase só com
  `select saude.painel()` (Claude) · [[Cérebro da Lube]]
- **2026-10-14** — Correção final (revisão de alarmes e segurança): migração `saude_v1_correcao_final` (entrega do
  Comercial pelos agregados, virada do ano, pedidos em aberto zerados, volta sem pedido, correção só com prova, motivos
  passageiros, relógio da VM, gatilho do pedido de correção, chave com 32+ caracteres, fila da Abertura de margem,
  e-mails cortados do Gestão TI); 3 alvos novos (relógio, fila da margem, ponte do ICMS) → 39; função `guardiao`
  **versão 3, código 1.0.2** (3ª pergunta à guarda fria); vigia 1.0.1 copiado para o `P:` (Claude; commit `d67d9cc`) ·
  [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-14** — Integração: migrações `saude_v1_correcao_com_prova` ("deu certo" só com o disparo provado) e
  `saude_v1_consultas_compartilhadas` (dimensão de duas rotinas não mistura as cargas); README e `.gitignore`
  (Claude; commit `62e6d0c`) · [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-14** — Função `guardiao` publicada no DATA WAREHOUSE (versão 1, `verify_jwt = false`) e migração
  `saude_v1_acao_sites` (a lista dos sites sai do catálogo); primeiras rodadas reais do pg_cron com HTTP 200 (Claude) ·
  [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-14** — Vigia da VM escrito (`guardiao_vm.py`, instalador da tarefa `Guardiao - Vigia`, `TESTAR SEM
  GRAVAR.bat`) e testado em `--teste` na `LOGISTICA-55`, sem gravar nada; pasta `P:\INTEGRAÇÃO BI\GUARDIAO` criada, sem
  `ENV`; **não instalado na `SRV-IA`** (Claude) · [[Guardião - Vigia da VM]]
- **2026-10-14** — Banco: extensões `pg_cron` e `pg_net`, schema `saude` (migrações `saude_v1`, `saude_v1_catalogo` com
  36 alvos, `saude_v1_ajuste_textos`, `saude_v1_ajuste_sem_dado`), segredo `guardiao_cron` gerado no Vault sem ninguém
  ver, tarefas `saude-verificar`, `saude-guardiao` e `saude-limpeza`; no GESTAO TI, migração `saude_robo` (Claude) ·
  [[Guardião - Verificação na nuvem]]
- **2026-10-14** — Sistema pedido pelo Júlio, com as decisões: Telegram no bot do Gestão TI, tentar de novo 1 vez e
  avisar, vigia na `SRV-IA`, saúde também no arquivo baixado (Júlio) · [[2026-10-14 — Guardião, o robô que garante as rotinas]]

Veja também [[Mapa de sistemas]], [[data-warehouse]], [[Supabase]] e [[SENTINELA LUBE]].
