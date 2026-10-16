---
tipo: rotina
departamento: Compras
status: ativo
frequencia: "07:50, 11:50, 17:50, 23:50"
maquina: VM SRV-IA (192.168.12.30)
tags: [bi, compras, agendador]
---
# BI Compras - Sync rapidas

**Quando:** 07:50, 11:50, 17:50 e 23:50 (dado pronto 10 minutos depois). Gatilhos recriados em **2026-10-09**.
**Onde:** Agendador de Tarefas do Windows na **VM SRV-IA (192.168.12.30)**, rodando de `C:\BI\COMPRAS` da VM, desde
2026-09-28. Até 2026-09-28 rodava na LOGISTICA-55, onde a tarefa continua cadastrada, mas **desativada** (plano B:
`Enable-ScheduledTask`; antes, copiar de novo o ETL, porque a cópia local de lá está velha).
**Modo:** senha guardada — roda com a máquina ligada mesmo sem ninguém logado. Bloquear a tela não atrapalha; **suspender, sim**.
**Comando:** `pythonw.exe "C:\BI\COMPRAS\executar.py" --grupo rapidas` (o `executar.py` chama o `sync_bi_compras.py`).

Atualiza as tabelas rápidas do [[BI COMPRAS]] a partir do [[WinThor]]: 12 consultas (as 3 dimensões do `core` e 9
fatos), cerca de 59 mil linhas.

## Fluxo
1. **Gatilho** · Agendador do Windows na VM `SRV-IA`, às 07:50, 11:50, 17:50 e 23:50, com senha guardada
   - **Atenção:** bloquear a tela não atrapalha; a VM suspensa, sim
   - **Atenção:** gatilhos recriados em 2026-10-09; a carga das 07:50 ainda não foi conferida no `compras.controle_carga`
2. **Processa** · `executar.py --grupo rapidas` chama o `sync_bi_compras.py`, rodando de `C:\BI\COMPRAS` ([[data-warehouse]])
   - **Atenção:** mudança só no Git não chega à VM: editar no `P:` e rodar de novo o `instalar_e_agendar.ps1`
3. **Lê** · [[WinThor]] ([[Oracle]], só leitura): 12 consultas, as 3 dimensões do `core` e 9 fatos, ~59 mil linhas
   - **Atenção:** a das 07:50 levou 8 min 25 s (2026-09-23, na LOGISTICA-55), com menos de 1 min de folga; na VM, a confirmar
4. **Grava** · [[Supabase]] DATA WAREHOUSE: fatos do schema `compras` (TRUNCATE + INSERT) e dimensões do `core` (upsert)
5. **Confere** · cada consulta registra o resultado em `compras.controle_carga`; se uma falhar, as outras seguem
   - **Se falhar:** ver o `falha_inicial.log` (erro antes do log) e o log do Agendador do Windows
   - **Atenção:** conferir também o horário: de 2026-09-28 a 2026-10-09 rodou 4 h atrasada, sem falha registrada
6. **Entrega** · painel do [[BI COMPRAS]] (`compras.painel_dados()` pela [[Vercel]]), dado pronto às 08:00, 12:00, 18:00 e 00:00

## Como mudar o código que roda
Editar em `P:\INTEGRAÇÃO BI\COMPRAS` e rodar de novo o `instalar_e_agendar.ps1` na VM (ou copiar o arquivo para o
`C:\BI\COMPRAS` da VM). Só o GitHub não basta: em 2026-09-24 a mudança dos compradores foi só para o Git e a VM seguiu
com o código velho ([[2026-09-24 — Compradores que saíram da Lube]]).

## Horário errado de 2026-09-28 a 2026-10-09
As tarefas criadas na VM em 2026-09-28 dispararam **4 horas depois** do planejado (11:50, 15:50, 21:50 e 03:50), porque
o relógio da VM estava atrasado quando os gatilhos foram gravados. O fuso já estava certo, e corrigir o fuso não move
gatilho gravado: foi preciso **recriar as tarefas** (2026-10-09). Nesse período o painel das 08:00 mostrava o estoque
das 03:50. Carga de teste depois da recriação: 2026-10-09 às 08:38, 12 de 12 OK. Ver
[[2026-10-08 — Cargas do BI COMPRAS 4 horas fora do horário]].

## Duração medida (2026-09-23, na LOGISTICA-55)
- 23:50 → **31 segundos**
- 07:50 → **8 minutos e 25 segundos**, terminando às 07:59:06

A da manhã é dezesseis vezes mais lenta por causa da carga no Oracle no começo do expediente, e sobrou menos de um minuto de folga. **Pendente:** antecipar para 07:30. As de 11:50 e 17:50 ainda não foram medidas sob carga real.

Na VM (2026-09-28): carga completa com 12 de 12 OK, `ruptura_cobertura` com 7.214 linhas em 8 s. A das 07:50 na VM
ainda não foi medida — até 2026-10-09 ela rodava às 11:50. **Conferir em 2026-10-10.**

Armadilhas de agendamento em [[data-warehouse]]. Histórico da depuração em [[2026-09-23 — agendamento do BI COMPRAS, acesso ao painel e skill data-warehouse]]. Ida para a VM em [[2026-09-28 — ETL do BI COMPRAS levado para a VM]].
