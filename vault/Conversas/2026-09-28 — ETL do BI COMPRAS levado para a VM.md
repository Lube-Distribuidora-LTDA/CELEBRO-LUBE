---
tipo: conversa
data: 2026-09-28
projeto: "[[BI COMPRAS]]"
departamento: Compras
status: resumido
tags: [conversa, bi, compras, agendador, vm, etl]
---
# 2026-09-28 — ETL do BI COMPRAS levado para a VM

## Resumo
O Júlio pediu para agendar o ETL do [[BI COMPRAS]] na máquina virtual e desligá-lo na máquina dele. Na VM **SRV-IA
(192.168.12.30)** foram instalados o Python 3.12.7 e as bibliotecas, e o `instalar_e_agendar.ps1` criou as duas tarefas
com senha guardada. A carga de teste travou mais de 5 minutos gravando no [[Supabase]]: a conexão morria em silêncio e o
ETL não tinha timeout. Com timeout e keepalive na conexão, a carga completa passou (12 de 12). Na LOGISTICA-55 as duas
tarefas ficaram **desativadas**.

## Decisões
- 2026-09-28 (Júlio): o ETL do COMPRAS roda **na VM**, e não mais na LOGISTICA-55.
- 2026-09-28 (Claude): **desativar** as tarefas na LOGISTICA-55 em vez de apagar. Se a VM falhar, basta `Enable-ScheduledTask`.
- 2026-09-28 (Claude): as partes com UAC e senha do Windows ficam com o Júlio; o Claude não digita senha.

## O que foi criado ou mudou
- VM: Python 3.12.7 pelo instalador oficial em modo silencioso (não há `winget` na VM); `pip install -r requirements.txt`;
  `instalar_e_agendar.ps1` rodado de `\\192.168.0.5\winthor-adm\INTEGRAÇÃO BI\COMPRAS`; ETL copiado para `C:\BI\COMPRAS` da VM.
- VM: tarefas [[BI Compras - Sync rapidas]] e [[BI Compras - Sync faturamento]] criadas com senha guardada.
- LOGISTICA-55: as duas tarefas com `Disable-ScheduledTask` (status Disabled; continuam cadastradas).
- Commit `db22475`: `etl/bi_comum.py` — `conectar_supabase()` com `connect_timeout` de 20 s, keepalive (percebe conexão
  morta em 30 a 40 s) e `statement_timeout` de 120 s.
- `bi_comum.py` copiado para o P:, para o `C:\BI\COMPRAS` da LOGISTICA-55 e para o `C:\BI\COMPRAS` da VM.
- Carga completa na VM: 12 de 12 consultas OK; `ruptura_cobertura` com 7.214 linhas em 8 s (antes ficava travada).

## Erros e incidentes
- 2026-09-28: a última carga na LOGISTICA-55 (07:50) falhou por timeout no pool de conexão do Supabase.
- 2026-09-28: a carga de teste na VM ficou pendurada mais de 5 minutos gravando `ruptura_cobertura`, com a conexão morta e
  sem timeout. Rede e DNS da VM estavam OK (Oracle `192.168.0.5:1521` e pooler `aws-0-sa-east-1.pooler.supabase.com:5432`).
- `winget` não é reconhecido na VM, e o PATH só atualiza numa janela nova do PowerShell.
- A janela de administrador não enxerga a pasta de rede (`Copy-Item` só na janela normal), e encerrar o `pythonw` da
  tarefa exige administrador.
- Sessão sem administrador não lista no Agendador as tarefas criadas com senha guardada.
- **Descoberto só em 2026-10-08:** as tarefas criadas neste dia ficaram **4 horas atrasadas**, porque o relógio da VM
  estava atrasado na hora da criação. Ver [[2026-10-08 — Cargas do BI COMPRAS 4 horas fora do horário]].

## Preferência do Júlio
Prefere comandos rápidos de terminal (ex.: instalar o Python pelo PowerShell).

## Pendências
- [ ] Depois de alguns dias estáveis na VM, apagar de vez as tarefas da LOGISTICA-55 (`Unregister-ScheduledTask`) — Júlio.
- [x] 2026-10-09: notas de rotina e [[BI COMPRAS]] atualizadas para a VM SRV-IA.
