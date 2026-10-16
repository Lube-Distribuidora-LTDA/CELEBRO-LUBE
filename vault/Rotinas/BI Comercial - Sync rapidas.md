---
tipo: rotina
departamento: Comercial
status: ativo
frequencia: "06:45, 07:45, 08:45, 09:45, 12:45, 14:45, 15:45, 16:45"
tags: [bi, comercial, agendador]
---
# BI Comercial - Sync rapidas

**Quando:** 06:45, 07:45, 08:45, 09:45, 12:45, 14:45, 15:45 e 16:45 — dado pronto às **07:00, 08:00, 09:00, 10:00, 13:00, 15:00, 16:00 e 17:00**, os mesmos oito momentos do Power BI (pedido do Júlio em 2026-09-28).
**Onde:** Agendador de Tarefas do Windows da **VM `SRV-IA`**, rodando de `C:\BI\COMERCIAL`. **Só nela desde 2026-10-09** — de 2026-10-01 a 2026-10-09 a estação `LOGISTICA-55` também tinha esta tarefa (ver abaixo). Na VM desde 2026-09-28; até a reinstalação de 2026-10-01 (08:17) a tarefa disparava **4 horas atrasada**, das 10:45 às 20:45, porque o relógio da VM estava atrasado quando os gatilhos foram gravados (mesmo caso do [[BI Compras - Sync rapidas]]). Desde 2026-10-02 roda na hora certa.
**O que atualiza:** comissão por nota, devoluções, pedidos em aberto, a foto da margem mínima por filial (`margem_filial`, desde 2026-09-30, para a [[Abertura de margem]]) e as dimensões de RCA, supervisor, cliente e motivo do [[BI COMERCIAL]]. Desde 2026-10-07 o `dim_rca` traz também o e-mail e a situação do RCA, que o [[SAC]] usa. Em 2026-10-09 entrou no catálogo a `dim_nf_saida` (capa das NFs dos últimos 45 dias, também para o SAC) — na `SRV-IA` desde as 10:56 (o arquivo da rede copiado para a VM, como o instalador faria); primeira carga agendada às 12:45. Leva ~43 s (34 mil notas).

**Por que :45 e não :50.** A regra da casa é rodar 10 minutos antes, mas aqui são 15:
- o [[BI Compras - Sync rapidas]] roda aos **:50** (07:50, 11:50, 17:50, 23:50) e o [[BI Compras - Sync faturamento]] às 02:50 — dois ETLs pesados na mesma hora disputam o mesmo Oracle. Começando aos :45, o COMERCIAL (40 segundos) termina antes de o COMPRAS começar;
- de manhã o Oracle fica bem mais lento: no COMPRAS a mesma carga passou de 31s para 8min25s às 07:50. Os 15 minutos são a folga para isso.

O Power BI original levava de 8 a 9 minutos em cada uma dessas oito atualizações.

## Fluxo
1. **Gatilho** · Agendador do Windows na VM `SRV-IA`, 8× por dia: 06:45, 07:45, 08:45, 09:45, 12:45, 14:45, 15:45 e 16:45
   - Aos :45 para terminar antes do [[BI Compras - Sync rapidas]] (:50) e ter folga com o Oracle lento de manhã
2. **Processa** · `executar.py` chama o `sync_bi_comercial.py`, grupo "rapidas", rodando de `C:\BI\COMERCIAL`, sob a tranca de carga
   - Com outra carga do grupo em curso, a tranca avisa no log e sai com código 0, de propósito (desde 2026-10-08)
   - **Atenção:** carga avulsa rodada da `LOGISTICA-55` (cópia sem a tranca) pode atropelar a da VM
3. **Lê** · [[WinThor]] ([[Oracle]]): comissão por nota, devoluções, pedidos em aberto, margem mínima por filial, RCAs, clientes e NFs de 45 dias
4. **Grava** · [[Supabase]] DATA WAREHOUSE, schemas `comercial` e `core`; uma linha por consulta em `comercial.controle_carga`
   - **Se falhar:** cada consulta falha sozinha e fica no `controle_carga` (hora em `executado_em`); a carga seguinte recupera
5. **Processa** · atualiza as views do painel (`VIEWS_DO_PAINEL`) e chama `painel_dados()` para deixar o painel quente
   - **Atenção:** em dia de banco pesado (06/10, carga em dobro), o `REFRESH` das views e o aquecimento morreram por `statement timeout`
6. **Entrega** · dado pronto às 07, 08, 09, 10, 13, 15, 16 e 17 h no [[BI COMERCIAL]]; alimenta também a [[Abertura de margem]] e o [[SAC]]

## Duração medida (2026-09-28, primeira carga, 16:50)
**40 segundos** no total: `comissao_nf` 34,5s (205.519 linhas), `dim_cliente` 2,8s (61.956), `devolucao` 1,4s (12.816), o resto abaixo de 1s. Medida fora do pico — a de 06:50 ainda não foi medida sob a carga do Oracle pela manhã.

~~**Status: a carga já foi feita à mão em 2026-09-28, mas a tarefa ainda não está agendada.**~~ Agendada no mesmo dia (2026-09-28), pelo `instalar_e_agendar.ps1`. Armadilhas do agendamento em [[data-warehouse]].

Ao fim de cada carga o sync chama `painel_dados()` para deixar o painel quente (desde 2026-09-28, commit `1c0738e`).

## Uma carga por vez na empresa inteira (desde 2026-10-08)
De 2026-10-01 a 2026-10-09 **duas máquinas** rodavam esta tarefa no mesmo minuto e as duas cargas disputavam o mesmo lock: uma morria aos 120 s do `statement_timeout` (`while locking tuple in relation "dim_cliente"`). Nas 48 h até 09/10, 9 falhas na `comissao_nf` e 5 na `dim_cliente`, todas recuperadas na hora seguinte.

Desde 2026-10-08 a carga pega a **tranca** (`bi_comum.tranca_de_carga`, *advisory lock* do Postgres, uma por grupo): quem chega depois avisa no log e **sai com código 0** — de propósito, para o Agendador não reiniciar uma tarefa que está certa em não rodar. Em 2026-10-09 as tarefas da `LOGISTICA-55` foram apagadas. Detalhes em [[BI COMERCIAL]].

**Como conferir se rodou:** `comercial.controle_carga` (coluna da hora: `executado_em`, não `fim`). Uma linha por consulta por carga; duas no mesmo minuto = duas máquinas.
