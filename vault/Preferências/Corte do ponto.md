---
tipo: conceito
departamento: RH
status: ativo
tags: [conceito, rh, ponto, competencia]
---
# Corte do ponto

Na Lube a folha de ponto **não fecha no fim do mês de calendário**. O período de apuração vai do **dia 21 de um mês ao dia 20 do mês seguinte**.

## A regra de nomenclatura
**A competência leva o nome do mês em que o período FECHA.**

| Período real | Competência |
|---|---|
| 21/12 a 20/01 | **Janeiro** |
| 21/01 a 20/02 | **Fevereiro** |
| 21/07 a 20/08 | **Agosto** |

Consequência prática: **não existe competência alimentada pelos dias 21 a 31 do próprio mês.** Uma falta do dia 22/12 pertence a Janeiro, não a Dezembro.

> **Resolvido na prática em 2026-10-05.** Em 2026-09-17 o Júlio apontou que 21/07 a 20/08 seria "Julho" — regra do mês de **abertura**, que contradiz a de fechamento definida por ele mesmo (21/12 a 20/01 = Janeiro). A pergunta ficou sem resposta, mas em 2026-10-05 ele pediu **"Setembro (21/08 a 20/09)"** na importação de Hora Extra: mês de fechamento. Vale a tabela acima. Se ele voltar a falar em mês de abertura, apontar a contradição de novo antes de mexer.

## Como a regra mudou no painel
- **2026-09-15** — primeira versão parametrizada (commit `729186c`): nomeava pelo mês de **fechamento**.
- **2026-09-16** — o Júlio reclamou que o painel mostrava agosto em vez de julho, e a regra foi invertida para o mês de **abertura** (commit `daa52b4`). Isso criou uma competência "Dezembro" alimentada pelos dias 21 a 31 de dezembro.
- **2026-09-17** — de volta ao mês de **fechamento**, sem "Dezembro" (commit `1e028ad`), e todo filtro de mês passou a mostrar o período.
- **2026-10-05** — a importação de Hora Extra passou a listar só Setembro a Dezembro, cada um com o período ("Setembro/2026 (21/08 a 20/09)"), confirmando o fechamento.

## Como aparece nos painéis
- **Filtros de mês:** nome + período, `Janeiro/2026 (21/12 a 20/01)`, para não haver dúvida do que está sendo filtrado.
- **Eixo dos gráficos:** só o nome do mês. A parametrização é interna — vai no tooltip e no badge do card.
- **O dia de corte é parametrizável** (2 a 28, padrão 21), guardado no navegador. Mudar ali recalcula Absenteísmo, Hora Extra e InterJornadas na hora.

## Onde isso vive
No [[BI ABSENTEÍSMO RH]] a competência é recalculada **no navegador** a cada carga, a partir da data real da ocorrência — é o painel que manda. O banco também grava essas colunas por trigger, e elas seguem o mês de calendário: em 2026-09-17 discordavam da tela em 333 de 1.189 linhas. A migração que alinha o banco (`migrations/2026-09-17_competencia_mes_de_fechamento.sql`) existe no repositório e ainda não foi aplicada — em 2026-10-09 ela não aparecia na lista de migrações do Supabase.

Na **Hora Extra** a importação continua sendo por competência escolhida na tela; só o rótulo segue o corte. Na **InterJornadas** e no **Absenteísmo** a competência sai da data de cada registro.

**Vale para:** Absenteísmo, Pagamento Hora Extra e InterJornadas.
**Não vale para:** Turnover, que continua em mês de calendário porque os números são digitados à mão.

## O que nunca muda
A data real da ocorrência (`data_iso`), o dia da semana e o dia do mês continuam sendo a data de verdade da ausência. Só o agrupamento por competência muda — o gráfico de padrão semanal depende disso.

Veja também [[BI ABSENTEÍSMO RH]], [[2026-09-15 — corte do ponto, importação do PontoMais e gráficos do Turnover no BI de RH]], [[2026-09-17 — rótulos de dados e competência do ponto no BI de Absenteísmo RH]] e [[2026-10-05 — relatório errado do PontoMais e meses da importação de Hora Extra no BI de RH]].
