---
tipo: rotina
departamento: Logística
status: ativo
frequencia: "07:35, 09:35, 11:35, 13:35, 15:35, 17:35, 22:35"
tags: [bi, reposicao, agendador]
---
# Reposições - Sync

**Quando:** 07:35, 09:35, 11:35, 13:35, 15:35, 17:35 e 22:35.
**Onde:** Agendador de Tarefas do Windows, na máquina do ETL, rodando de `C:\BI\REPOSICOES` (tarefa `Reposicoes - Sync`).
**O que atualiza:** as três tabelas do [[REPOSIÇÕES E CHAMADOS]] — itens dos pedidos de reposição (rotina 8352), chamados e produtos reclamados (rotina 8353) — e deixa pronto o JSON que o painel lê (`reposicao.painel_cache`).

**Por que :35.** O [[BI Comercial - Sync rapidas]] roda aos :45 e o [[BI Compras - Sync rapidas]] aos :50; dois ETLs na mesma hora disputam o mesmo Oracle. Esta é a menor das três cargas e entra antes das outras.

## Fluxo
1. **Gatilho** · Agendador do Windows na máquina do ETL (tarefa `Reposicoes - Sync`), às 07:35, 09:35, 11:35, 13:35, 15:35, 17:35 e 22:35
   - Conferido em 2026-10-19: a tarefa roda na **`SRV-IA`** (a pasta `C:\BI\REPOSICOES` está lá) e **cumpriu todos os horários** de 2026-10-09 15:35 a 2026-10-18 22:35 — ver "Conferência" abaixo
   - **Atenção:** fora do horário, `ATUALIZAR AGORA.bat` roda uma carga na hora, sem mexer em tarefa; só testado na `LOGISTICA-55`, na `SRV-IA` a confirmar
2. **Processa** · `executar.py` (com `pythonw`, em `C:\BI\REPOSICOES`) chama o `sync_reposicao.py` ([[data-warehouse]])
   - **Se falhar:** erro antes de o log existir vai para `falha_inicial.log`
   - **Atenção:** a tranca do `bi_comum.py` deixa uma carga por vez; se já houver outra rodando, esta rodada é pulada
3. **Lê** · [[WinThor]] (Oracle, acesso de leitura): 3 consultas, rotinas 8352 (pedidos de reposição) e 8353 (chamados e produtos reclamados)
4. **Grava** · [[Supabase]] DATA WAREHOUSE, schema `reposicao`: `TRUNCATE` + `INSERT` nas 3 tabelas, numa transação; registra em `controle_carga`
   - **Se falhar:** a carga seguinte conserta (full refresh); se entrou, quem responde é `reposicao.controle_carga`, não o log
   - **Atenção:** ~8 s com o banco saudável; com o Supabase saturado levou 4 min (o problema é o banco, não o Oracle)
5. **Processa** · no fim, `atualizar_painel_cache()` monta o JSON do painel (~6 s) e o guarda em `reposicao.painel_cache`
6. **Entrega** · painel do [[REPOSIÇÕES E CHAMADOS]]: a API lê o `painel_cache`, e o [[Reposições - Aquecer painel]] mantém o CDN renovado
   - **Atenção:** "Atualizar" usa a cópia do CDN; Shift+clique em Atualizar busca o dado novo no banco na hora

## Duração medida (2026-10-06, 15:19 e 15:39) — banco saudável
**Cerca de 8 segundos** no total: `reposicao_item` 1,1–1,5 s (5.609 linhas), `chamado` 2–3,4 s (27 mil), `chamado_item` 1,8–2,1 s (32 mil). Medida à tarde, com o Oracle em carga normal; a de 07:35 ainda não foi medida.

No fim de cada carga ela também **monta o JSON do painel e o guarda em `reposicao.painel_cache`** (`atualizar_painel_cache()`, ~6 s) — é de lá que a API lê.

É full refresh (`TRUNCATE` + `INSERT` por tabela, numa transação): se uma carga falhar, a seguinte conserta, sem estado intermediário. **A carga entrou?** Responde `reposicao.controle_carga`, não o log.

**Status: agendada em 2026-10-09 (~14:07) pelo Júlio**, com o duplo clique em `P:\INTEGRAÇÃO BI\REPOSICOES\INSTALAR TUDO.bat`. O instalador testou a tarefa-cobaia (modo **senha guardada**, funcionou), criou `Reposicoes - Sync` e `Reposicoes - Aquecer painel` (conta `LUBE\gti.julio.alves`, roda com o usuário deslogado, pasta `C:\BI\REPOSICOES`) e disparou uma carga de verdade: **14:08, `OK` nas três consultas, ~9 s** (5.629 itens, 27.589 chamados, 32.191 itens de chamado, dado até 08/10, 4.492 pedidos), **conferida em `reposicao.controle_carga`** e no `painel_cache` (14:08:34). Não foi na `LOGISTICA-55` (lá não há tarefa nem pasta): foi na **`SRV-IA`** (confirmado em 2026-10-19). **Provado pelo relógio** — ver "Conferência" abaixo. Armadilhas do agendamento em [[data-warehouse]].
Antes do agendamento, as cargas foram à mão: 2026-10-06, 07/10 14:03 e 09/10 13:33 e 13:40.

**Como o instalador agenda.** Copia tudo para `C:\BI\REPOSICOES`, testa o Agendador com uma tarefa-cobaia (`Reposicoes - teste de agendamento`, apagada no fim), cria esta tarefa com um gatilho diário por horário e dispara uma carga na hora para conferir. A tarefa roda `executar.py` com o `pythonw` (sem janela); erro antes do log existir vai para `falha_inicial.log`. Se o modo de logon que funcionar for o **interativo**, a carga das 22:35 só roda com o Windows logado (detalhe em [[Reposições - Aquecer painel]]).
**Cuidado ao instalar:** numa máquina só — de preferência a VM `SRV-IA`, onde já roda o [[BI COMERCIAL]]. Desde **2026-10-09** o `bi_comum.py` daqui é o de 08/10 do COMERCIAL, **com a tranca** que impede duas cargas ao mesmo tempo (o COMERCIAL a ganhou depois de uma semana de cargas atropeladas entre duas máquinas): a segunda carga avisa "Já existe uma carga … Esta rodada vai ser pulada" e sai sem mexer nas tabelas. Testado com duas cargas disparadas com 12 s de diferença — no banco entrou uma só. O instalador ainda não avisa se a máquina não é a `SRV-IA`.

## Conferência do agendado, de 2026-10-09 a 2026-10-18 (feita em 2026-10-19, sem usar nada de 19/10)
Pedido do Júlio: saber se o script roda como deveria, já que ele atualizou à mão no dia 19. Fonte: `reposicao.controle_carga` e o `sync_reposicao.log` da `SRV-IA` (lido pelo compartilhamento, só até 18/10).
- **Horários:** **66 de 66** cargas pelo relógio (3 em 09/10 a partir das 15:35 e 7 por dia de 10/10 a 18/10), sempre às :35 (algumas às :36 ou :37). Nenhum horário perdido; a única rodada fora do horário foi a do instalador (14:08 de 09/10).
- **Resultado:** as 3 consultas deram `OK` em todas as rodadas; **nenhum aviso ou erro** no log, **nenhuma rodada pulada pela tranca**, sem `falha_inicial.log`.
- **Duração:** normalmente 1 a 3 s; houve rodadas lentas de 12 s a **2 min** (134 s em 09/10; 122, 116 e 122 s em 10/10; até 82 s em 16/10) — é o Supabase, não o Oracle, e **não derrubou nenhuma carga**.
- **Dado chegando:** os pedidos no banco subiram de 4.492 (até 08/10) para 4.533 (até 16/10), e o "dado até" avançou todo dia útil. De 09 a 13/10 ficou em 08/10 porque **não há pedido de 09/10 nem de 10 a 12/10** (sexta sem reposição, fim de semana e feriado de 12/10); em 13/10 entraram 21 pedidos de uma vez. **O pedido entra quando é faturado**, então os dois últimos dias do painel costumam estar incompletos (os pedidos de 13/10 chegaram aos poucos nos dias seguintes).
- **O que NÃO está bem:** o [[Reposições - Aquecer painel]] — roda de 5 em 5 min, mas **toda chamada falha** com `CERTIFICATE_VERIFY_FAILED`.

## Atualizar agora, sem esperar o horário (2026-10-09)
Duplo clique em **`ATUALIZAR AGORA.bat`** (`P:\INTEGRAÇÃO BI\REPOSICOES`), na `SRV-IA`: copia o ETL mais novo, roda **uma** carga e chama o painel; mostra no fim "PAINEL ATUALIZADO: reposições até DD/MM/AAAA". Não cria nem muda tarefa. Fora da `SRV-IA` pede para digitar `SIM`. Depois da carga o painel mostra o dado novo em até 5 min (Shift+clique em Atualizar mostra na hora). Detalhe em [[REPOSIÇÕES E CHAMADOS]].
**Duração medida em 2026-10-09 (LOGISTICA-55):** 13:33, **4 min** (`reposicao_item` 134 s, `chamado` 19 s, `chamado_item` 82 s, cache 5 s); 13:40, **30 s**. A diferença é o Supabase, não o Oracle (que devolve em ~0,2 s). Origem: [[2026-10-09 — Comparação com o período anterior e o script de atualização da VM]].

**Com o banco saturado (2026-10-07, 14:03):** a mesma carga levou **4 minutos** (55 s, 74 s e 95 s por consulta; o Oracle respondeu na hora). Se uma carga demorar muito mais que 10 s, o problema está no Supabase, não aqui — ver [[Supabase]].
