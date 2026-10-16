---
tipo: rotina
departamento: Compras
status: ativo
frequencia: "02:50"
maquina: VM SRV-IA (192.168.12.30)
tags: [bi, compras, agendador]
---
# BI Compras - Sync faturamento

**Quando:** todo dia às 02:50 (dado pronto às 03:00). Gatilho recriado em **2026-10-09**.
**Onde:** Agendador de Tarefas do Windows na **VM SRV-IA (192.168.12.30)**, rodando de `C:\BI\COMPRAS` da VM, desde
2026-09-28. Na LOGISTICA-55, onde rodava antes, a tarefa está só **desativada** (plano B).
**Modo:** senha guardada — roda com a máquina ligada mesmo sem ninguém logado.
**Comando:** `pythonw.exe "C:\BI\COMPRAS\executar.py" --grupo pesadas`.

Carrega o faturamento do [[BI COMPRAS]] e atualiza as nove views materializadas do painel (`compras.mv_fat_*`), no
mesmo `pos_carga`.

## Fluxo
1. **Gatilho** · Agendador do Windows na VM `SRV-IA`, todo dia às 02:50, com senha guardada (roda sem ninguém logado)
2. **Processa** · `executar.py --grupo pesadas` chama o `sync_bi_compras.py` em `C:\BI\COMPRAS`: só a consulta `faturamento` ([[data-warehouse]])
3. **Lê** · [[Oracle]] do [[WinThor]]: faturamento desde 1º de janeiro do ano corrente, em lotes (`streaming`)
   - **Atenção:** na 1ª carga de janeiro o ano anterior sai sozinho; mais histórico só pelo gancho `FATURAMENTO_DATA_INICIAL` no `ENV`
4. **Grava** · [[Supabase]] DATA WAREHOUSE: `compras.fato_faturamento` recarregada inteira (TRUNCATE + INSERT), ~259 mil linhas em 2026-10-09
5. **Processa** · no mesmo `pos_carga`, refresh das nove views materializadas `compras.mv_fat_*`
   - **Atenção:** refresh pesado: às 06:52 de 2026-10-01 (tarefa 4 h atrasada) saturou o banco em plena manhã
6. **Confere** · o resultado vai para `compras.controle_carga`, de onde sai a "Última carga" do painel
   - **Se falhar:** ver o `falha_inicial.log` e o log do Agendador; conferir no `controle_carga` se rodou mesmo às 02:50
7. **Entrega** · páginas 06 Performance compras e 07 Métricas do [[BI COMPRAS]], com o dado pronto às 03:00

## Só o ano corrente (desde 2026-10-01)
A consulta lê do [[Oracle]] a partir de **1º de janeiro do ano corrente**, e a tabela é recarregada inteira (TRUNCATE +
INSERT). Na primeira carga de janeiro o ano anterior sai sozinho, sem rotina de expurgo. Para um levantamento pontual
com mais histórico, há o gancho `FATURAMENTO_DATA_INICIAL` no `ENV`. Efeito: 1.632.611 → 251.362 linhas em 2026-10-01
(387 MB → 61 MB); cerca de 259 mil em 2026-10-09. Ver [[2026-10-01 — Faturamento só do ano corrente e o gráfico mensal]].

## Horário errado de 2026-09-28 a 2026-10-09
A tarefa criada na VM em 2026-09-28 disparava **4 horas depois**, por volta das **06:50**, porque o relógio da VM estava
atrasado quando o gatilho foi gravado. Recriada em 2026-10-09 com o `instalar_e_agendar.ps1`
([[2026-10-08 — Cargas do BI COMPRAS 4 horas fora do horário]]). Pelos horários, foi esta carga, às 06:52 de
2026-10-01, que fez o refresh das nove views e saturou o DATA WAREHOUSE em plena manhã
([[2026-10-01 — Banco travado e o total dos Afastados INSS]]). De madrugada o refresh pesado não pega o banco no
horário de uso dos painéis.

## Duração medida (2026-09-23, na LOGISTICA-55, ainda com o histórico desde 2021)
02:50 → 02:55 (**315 segundos**), 1.622.488 linhas. Roda em lotes (`streaming`), por causa do volume. Com o ano
corrente e na VM, a duração ainda não foi medida.

Veja [[data-warehouse]] e [[2026-09-23 — agendamento do BI COMPRAS, acesso ao painel e skill data-warehouse]].
