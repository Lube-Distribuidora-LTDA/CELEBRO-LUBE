---
tipo: rotina
departamento: Comercial
status: ativo
frequencia: "03:45"
tags: [bi, comercial, agendador]
---
# BI Comercial - Sync margem

**Quando:** 03:45 (dado pronto às 04:00).
**Onde:** Agendador de Tarefas do Windows da **VM `SRV-IA`**, rodando de `C:\BI\COMERCIAL` (só nela desde 2026-10-09).
**O que atualiza:** a margem por item do [[BI COMERCIAL]] — `comercial.fato_margem_item`, cerca de **3,3 milhões de linhas** desde 2023, carregadas em lotes de 50 mil.

Roda de madrugada e uma vez só por dia: margem de nota já faturada não muda de hora em hora, e a varredura é pesada demais para o horário comercial. Fica depois do [[BI Compras - Sync faturamento]] (02:50, ~5 minutos) para não dividir o Oracle com ele.

Ao terminar, o sync atualiza as views materializadas do painel na mesma execução — sem isso a série mensal fica desatualizada em silêncio.

## Fluxo
1. **Gatilho** · Agendador do Windows na VM `SRV-IA`, às 03:45, uma vez por dia, rodando de `C:\BI\COMERCIAL`
   - Depois do [[BI Compras - Sync faturamento]] (02:50, ~5 min), para não dividir o [[Oracle]] com ele
2. **Processa** · `executar.py` chama o `sync_bi_comercial.py` (a `margem_item` é do grupo "pesadas"), sob a tranca de carga ([[data-warehouse]])
3. **Lê** · [[WinThor]] ([[Oracle]]): margem de cada item de nota desde 2023 (~3,3 mi de linhas) e as dimensões de RCA, supervisor, cliente e motivo
4. **Grava** · [[Supabase]] DATA WAREHOUSE: `comercial.fato_margem_item`, em lotes de 50 mil, numa carga transacional
   - As dimensões rodam nos dois grupos: `core.dim_rca`, `dim_supervisor` e `dim_cliente` por upsert, mais a de motivo de devolução
   - **Se falhar:** o rollback guarda a véspera: o painel fica um dia atrasado, nunca vazio; ver `comercial.controle_carga`
   - **Atenção:** 6 min 18 s em 2026-09-28, a carga mais apertada do dia; se a base crescer, antecipar para 03:30
5. **Processa** · atualiza as views do painel (`VIEWS_DO_PAINEL`, entre elas a `mv_margem_mes`, ~8 s) e aquece o painel
   - **Atenção:** a `mv_margem_dia`, de onde o painel lê resumo e ranking desde 2026-09-29, ficou fora da lista e não é atualizada
6. **Entrega** · página Margem por item do [[BI COMERCIAL]], com o dado pronto às 04:00

## Duração medida (2026-09-28, primeira carga)
**6 minutos e 18 segundos** para 3.288.133 linhas (377,6s de carga), mais 8s para recalcular a `mv_margem_mes`. A folga de 10 minutos até as 04:00 dá conta, mas é a carga mais apertada do dia — se a base crescer, antecipar para 03:30.

~~**Status: a carga já foi feita à mão em 2026-09-28, mas a tarefa ainda não está agendada.**~~ Agendada no mesmo dia (2026-09-28).

Desde 2026-09-29 o painel lê o resumo e o ranking da margem da `mv_margem_dia` (dia × filial × RCA), e não mais da `fato_margem_item` de 594 MB. **Atenção (achado de 2026-10-09):** esta carga recalcula a `mv_margem_mes`, mas **não** a `mv_margem_dia` — ela ficou fora da lista `VIEWS_DO_PAINEL`. Ver [[BI COMERCIAL]].

## Os primeiros dias (2026-09-29 a 2026-10-02)
A tarefa está na VM desde 2026-09-28, mas até a reinstalação de 2026-10-01 disparava **4 horas atrasada**, por volta
das **07:45**, em pleno expediente (relógio da VM atrasado quando o gatilho foi gravado). No log da VM, as cargas de
29/09, 30/09, 01/10 e 02/10 **param no meio da gravação** (de 1,0 a 3,25 milhões de linhas), sem erro e sem resumo.
A primeira carga completa depois da manual de 2026-09-28 foi a de **2026-10-03**. A carga é transacional, então a
tabela ficou com o dado de 28/09 nesse meio-tempo. Visto nos logs em 2026-10-09; falta conferir no `controle_carga`.

## As noites que falharam (2026-10-02 a 2026-10-09)
Com a tarefa em **duas máquinas** (`SRV-IA` e `LOGISTICA-55`), as duas cargas disputavam o mesmo lock. A `margem_item` falhou na primeira tentativa **todas as noites desde 02/10** e **não carregou em 02/10 nem em 05/10**. A carga é transacional: o rollback guardou a véspera e o painel nunca ficou vazio, só um dia atrasado. Corrigido com a tranca de carga (2026-10-08) e as tarefas apagadas da estação (2026-10-09). Detalhes em [[BI COMERCIAL]].
