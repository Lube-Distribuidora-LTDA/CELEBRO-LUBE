---
tipo: conversa
data: 2026-10-08
projeto: "[[BI COMPRAS]]"
departamento: Compras
status: resumido
tags: [conversa, bi, compras, agendador, vm, incidente]
---
# 2026-10-08 — Cargas do BI COMPRAS 4 horas fora do horário

## Resumo
Assunto de 08 e 09/10. O Júlio perguntou se o script do [[BI COMPRAS]] estava abastecendo o banco nos horários certos.
Nos 8 dias anteriores não houve falha e houve 4 cargas por dia, mas **todas 4 horas depois do planejado**: rápidas às
11:50, 15:50, 21:50 e 03:50, e faturamento por volta das 06:50. O fuso da VM já estava certo (Brasília). Os gatilhos
tinham sido gravados em 2026-09-28 com o relógio da VM atrasado, e corrigir o fuso depois não os move. Em 2026-10-09 o
Júlio rodou de novo o `instalar_e_agendar.ps1` na VM e os horários voltaram ao planejado.

## Decisões
- 2026-10-09 (Claude): **recriar as tarefas** em vez de só corrigir o fuso. Gatilho já gravado não muda quando o fuso muda.

## O que foi criado ou mudou
- 2026-10-08: conferido no `compras.controle_carga`: 8 dias, zero falhas, 4 cargas por dia, faturamento por volta das
  06:51 — mas fora dos horários planejados.
- 2026-10-09: VM SRV-IA com fuso Brasília (UTC−03:00) e relógio certo. O Júlio rodou o `instalar_e_agendar.ps1` a partir
  de `\\192.168.0.5\winthor-adm\INTEGRAÇÃO BI\COMPRAS`. Gatilhos novos: [[BI Compras - Sync rapidas]] às 07:50, 11:50,
  17:50 e 23:50; [[BI Compras - Sync faturamento]] às 02:50.
- 2026-10-09: carga de teste às 08:38 (hora real), com as 12 consultas OK, registrada no banco.
- 2026-10-09, commit `2a29b0b` (`web/index.html`): o "Próxima" volta a 00/08/12/18 (`HORAS`). No ar às 08:39
  (deploy `dpl_AQhmG2ctZTByFKVNg3WWBQ6JJSDy`, READY), substituído às 10:03 pelo `485ef61`.

## Erros e incidentes
- Desde 2026-09-28 as tarefas rodavam 4 horas depois do planejado. O painel das 08:00 mostrava o estoque das 03:50.
- **Isso explica o incidente de 2026-10-01** ([[2026-10-01 — Banco travado e o total dos Afastados INSS]]): o `REFRESH`
  das nove `compras.mv_*` às 06:52, que saturou o DATA WAREHOUSE, era a tarefa de faturamento da VM disparando às 06:50
  em vez de 02:50. É inferência pelos horários do `controle_carga`, não foi discutido na sessão.
- 2026-10-05 e 2026-10-08 (Claude): disse que o desvio não era uniforme (comparou os horários na ordem errada). Em
  2026-10-09 disse que a causa era o fuso errado, o que também não se confirmou. As duas afirmações foram corrigidas
  abertamente: a causa provável é o relógio atrasado da VM na hora em que as tarefas foram criadas (log da VM 07:46
  contra 11:47 no banco).

## Preferência do Júlio
Quer saber se o script abastece o banco nos horários certos, e dado da manhã fresco quando chega ao escritório.

## Pendências
- [ ] Conferir no banco, em 2026-10-10, se houve carga às 07:50 (prova final) — Júlio avisa, Claude confere.
- Até o faturamento rodar às 02:50 de 2026-10-10, a "Última carga" mostra 06:51. É esperado.
- [ ] Se o aquecimento do painel voltar, alinhar aos horários novos. Os crons de 2026-10-05 foram calculados para os
  horários deslocados e já saíram do `vercel.json` em 2026-10-06.
- [x] 2026-10-09: notas de rotina e [[BI COMPRAS]] atualizadas (VM SRV-IA, horários recriados).
