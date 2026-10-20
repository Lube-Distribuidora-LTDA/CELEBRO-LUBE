---
tipo: rotina
departamento: TI
status: ativo
frequencia: "a cada 5 minutos (verificação no banco) e a cada 10 minutos (função guardiao), o dia inteiro"
maquina: "nuvem: Supabase DATA WAREHOUSE (pg_cron + Edge Function guardiao)"
tags: [guardiao, saude, pg_cron, supabase, telegram]
---
# Guardião - Verificação na nuvem

**Quando:** de 5 em 5 minutos (`saude-verificar`) e de 10 em 10 minutos (`saude-guardiao`), o dia inteiro; limpeza
diária às 01:20 (`saude-limpeza`). **No ar desde 2026-10-14.**
**Onde:** [[Supabase]] DATA WAREHOUSE (`ivcnotrynogaljrvvyes`): pg_cron chama `saude.verificar()` no próprio banco e,
pelo pg_net, a Edge Function `guardiao` (`/functions/v1/guardiao/rodar`, com o cabeçalho `x-guardiao` lido do Vault).
Não depende de máquina nenhuma da Lube.
**O que faz:** a parte do [[GUARDIÃO DA LUBE]] que roda fora da rede: julga as cargas pelo `controle_carga`, testa os
10 sites, lê o robô do [[GESTÃO TI]], abre e fecha incidentes, pede a nova tentativa à VM e manda o Telegram. A parte de
dentro da rede é o [[Guardião - Vigia da VM]].

## Fluxo
1. **Gatilho** · pg_cron no DATA WAREHOUSE: `saude-verificar` de 5 em 5 min (`select saude.verificar();`) e `saude-guardiao` de 10 em 10 min (`saude.chamar_guardiao()`: POST na função `guardiao/rodar` pelo pg_net, prazo de 30 s)
   - `saude-limpeza` às 01:20 (04:20 UTC): avisos, conferências, pedidos atendidos e incidentes fechados com mais de 90 dias
2. **Lê** · catálogo `saude.alvo` (39 itens em 2026-10-14) e, para cada rotina de carga, o `controle_carga` do schema (`compras`, `comercial`, `reposicao`) na janela do horário, com a mediana das 10 últimas cargas OK
   - **Atenção:** no COMERCIAL e no REPOSIÇÕES também a tranca de carga em `pg_locks` (presa = em andamento; solta com consulta faltando = parou no meio)
3. **Lê** · a função `guardiao` testa os 10 sites em `/.sentinela/saude` (8 s; guarda sem a lista da central ganha 2ª e 3ª pergunta) e lê a RPC `saude_robo` do [[GESTÃO TI]] com a chave publicável
4. **Confere** · cada item é julgado: carga no horário, todas as consultas OK, sem queda forte de linhas, conferência da VM, entrega (`painel_cache` do Reposições, agregados do Comercial), folha, Gestão TI, VM, disco, relógio e fila da margem
   - **Atenção:** carga só é julgada depois da tolerância do horário; na dúvida, "sem dado" com o motivo, nunca alarme
   - **Atenção:** desde 2026-10-20 julga também **a si mesmo** (item "Guardião · Verificação na nuvem"): função sem rodar há mais de 25 min = atenção, 45 min = falha; 3+ falhas do agendador na última hora = atenção (só fecha depois de 1 hora limpa); apagão contado na volta
5. **Grava** · `saude.verificacao` (estado e frase de cada item), `saude.incidente` (abre, piora, fecha) e, numa falha corrigível, **um** `saude.pedido_correcao` para a VM
   - **Se falhar:** erro ao avaliar um item vira "sem dado" com o motivo e os outros seguem; etapa do banco falhando devolve HTTP 500 no `/rodar` (aparece em `net._http_response`)
   - **Atenção:** a nova tentativa só é pedida com o vigia da VM respondendo; até ele ser instalado, nenhum pedido sai
6. **Avisa** · `saude.avisos_pendentes()`: abertura, piora e volta numa mensagem só no Telegram (sem som das 22:00 às 06:30) e o resumo diário às 07:40
   - **Atenção:** os segredos do Telegram ainda não foram cadastrados (2026-10-14): o aviso fica gravado em `saude.aviso` com "Telegram ainda não configurado" e só aparece no painel
7. **Entrega** · `saude.painel()`: painel do robô do [[Cérebro da Lube]] (versão 7, conector Supabase) e `GET guardiao/resumo` com a chave de leitura, para o arquivo baixado
   - **Atenção:** a chave de leitura ainda não está no Vault (2026-10-14): o `/resumo` responde 503

## Duração medida (2026-10-14)
`/rodar` em **~3,6 a 3,9 s** (10 sites em paralelo, Gestão TI, registrar, verificar, avisos). Rodadas reais desde
11:50 com HTTP 200; todas as execuções do pg_cron desde 13:25 saíram `succeeded`.

## Como provar que rodou
- `select jobname, status, start_time from cron.job_run_details order by start_time desc limit 10;`
- `select saude.painel()->>'verificado_em';` — mais de 20 min atrás é sinal de agendador parado (o painel mostra
  "verificação atrasada").
- `select status, resumo from saude.verificacao where alvo_id = 'servico:guardiao-nuvem';` — desde 2026-10-20 o
  próprio banco julga se a função e o agendador estão rodando e alarma. O Telegram, porém, ainda sai pela função: com
  ela parada, o aviso chega quando ela volta (ver Limitações em [[GUARDIÃO DA LUBE]]).
- **Em 2026-10-20 o agendador falhou a manhã inteira** ("job startup timeout", banco sobrecarregado; falha todo dia
  desde 15/10): [[2026-10-20 — Banco sobrecarregado e o Guardião que avisa quando para]].
- Teste completo sem mandar nada: `select saude.chamar_guardiao('simular');` e depois
  `select status_code, content from net._http_response where id = <número devolvido>;`.

Origem: [[2026-10-14 — Guardião, o robô que garante as rotinas]].
