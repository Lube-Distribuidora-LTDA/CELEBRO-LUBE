---
tipo: rotina
departamento: TI
status: planejado
frequencia: "a cada 15 minutos, o dia inteiro"
maquina: SRV-IA
tags: [guardiao, saude, vm, agendador, winthor]
---
# Guardião - Vigia da VM

**Quando:** de 15 em 15 minutos, o dia inteiro (tarefa `Guardiao - Vigia`, tempo máximo de 5 min, uma rodada por vez;
o próprio vigia se encerra em 225 s).
**Onde:** Agendador de Tarefas da **VM `SRV-IA`**, rodando de `C:\BI\GUARDIAO` (editado em
`P:\INTEGRAÇÃO BI\GUARDIAO`), com privilégios mais altos: tarefa criada com senha guardada só aparece para
administrador, e o vigia precisa ver as tarefas das cargas e conseguir dispará-las.
**Status: planejado — ainda não instalado** (2026-10-14). Falta o Júlio rodar `P:\INTEGRAÇÃO BI\GUARDIAO\INSTALAR
TUDO.bat` na `SRV-IA`, com conta administradora. Até lá a VM, o disco, o relógio, as 9 tarefas, o servidor de margem,
o aquecedor e as conferências com o WinThor ficam "sem dado" no [[GUARDIÃO DA LUBE]], e nenhuma nova tentativa é pedida.
**O que faz:** os olhos do Guardião dentro da rede — o que o banco não enxerga de lá. A parte da nuvem é a
[[Guardião - Verificação na nuvem]].

## Fluxo
1. **Gatilho** · Agendador da VM `SRV-IA`, tarefa `Guardiao - Vigia`, de 15 em 15 min, privilégios mais altos; o instalador testa senha guardada, depois S4U, depois interativo, e fica com o primeiro que dispara
   - **Atenção:** ainda não instalado (2026-10-14); o `ENV` do Guardião ainda não existe em `P:\INTEGRAÇÃO BI\GUARDIAO\1 - CONFIGURACAO` (o instalador oferece copiar o do REPOSICOES)
2. **Processa** · `executar.py` (com `pythonw`) chama o `guardiao_vm.py` 1.0.1, com trava contra rodada dupla e tempo máximo de 225 s
   - **Se falhar:** erro antes de o log existir vai para `falha_inicial.log`; o log é `C:\BI\GUARDIAO\guardiao.log`
3. **Grava** · batimento no banco (`saude.batida('vm:SRV-IA', …)`) com disco livre, uptime, relógio contra o banco e fuso
   - **Se falhar:** mais de 35 min sem batimento, o próprio banco acusa "o vigia da VM parou de responder"
4. **Lê** · Agendador (as 9 tarefas do catálogo: estado, último resultado, gatilhos), servidor de margem em `http://localhost:8080/` (olha de novo em 20 s antes de acusar), `aquecer_painel.log` do [[Reposições - Aquecer painel]] e disco C:
   - **Atenção:** sem administrador, tarefa com senha guardada some da lista: fica "sem dado" e só o próprio vigia vira atenção, pedindo para reinstalar com conta administradora
5. **Grava** · `saude.registrar(...)` com tarefas, servidor de margem e aquecedor; o banco abre e fecha os incidentes
6. **Processa** · pedidos de nova tentativa desta máquina (`saude.pedidos_pendentes`): confere o catálogo, a janela de correção, a idade (até 2 h) e se outra carga do mesmo schema está rodando ou vai começar; dispara a tarefa **uma vez** (`Start-ScheduledTask`, nome exato, sem curinga) e responde em `saude.atender_pedido` ("Disparei…" ou o motivo de não ter disparado)
7. **Confere** · cargas novas (`saude.conferencias_pendentes`): o destino tem as linhas que a carga gravou? E o [[WinThor]], agora, tem a mesma quantidade (`SELECT COUNT(*)` do próprio SQL da consulta, 60 s cada; leves até 40 min depois da carga, pesadas só das 01:00 às 06:30)? Grava em `saude.registrar_conferencia`
   - **Atenção:** rodando como administrador, só executa o `consultas_<sistema>.py` de pasta que qualquer usuário não consiga alterar; com a pasta aberta, a conferência daquele sistema fica sem comparar e o log diz por quê
8. **Avisa** · Supabase fora por mais de 30 min: Telegram direto da VM, e de novo quando voltar (só com `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no `ENV` do Guardião, opcional)

## Testado em 2026-10-14 (na `LOGISTICA-55`, modo `--teste`, nada gravado)
Sessão do Supabase somente leitura, `ENV` do REPOSICOES lido pelo programa. Rodada de 8,7 s, código 0: catálogo com os
alvos lidos, as 9 tarefas "sem dado" (sem administrador), nenhum pedido para a `SRV-IA`, 18 conferências pendentes.
Uma conferência leve de verdade: `comercial.dim_supervisor` com 28 na carga, 28 no destino e 28 no WinThor (0,1 s);
uma pelo caminho de produção, só no destino: `compras.sugestao_fornecedor`, 136 = 136. Relógio da máquina a −4,7 s do
banco, fuso −3. Pedido com `*` e com a própria tarefa do vigia recusados.

## Como saber se está de pé
Não pelo log: pelo banco. `select * from saude.batimento;` — a linha `vm:SRV-IA` tem de ter menos de 35 min. Para ver o
que ele faria sem gravar nada, em qualquer máquina: `P:\INTEGRAÇÃO BI\GUARDIAO\TESTAR SEM GRAVAR.bat`.

**Cuidado ao instalar:** só na `SRV-IA` (fora dela o instalador pede SIM). No fim ele roda o vigia uma vez e mostra
"roda como administrador: SIM/NAO"; com NAO, a conta da tarefa precisa ser administradora da VM (decisão do TI). Mexeu
em algo do `P:`? Rode o `INSTALAR TUDO.bat` de novo: a máquina não se atualiza sozinha.

Origem: [[2026-10-14 — Guardião, o robô que garante as rotinas]].
