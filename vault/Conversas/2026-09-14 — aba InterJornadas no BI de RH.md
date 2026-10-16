---
tipo: conversa
data: 2026-09-14
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, interjornada, ponto, supabase]
registrado_em: 2026-10-09
---
# 2026-09-14 — aba InterJornadas no BI de RH

## Resumo
O Júlio pôs a planilha de interjornada do PontoMais (equipe LLOG) em `planilhas referencias/` e pediu a aba **InterJornadas** no [[BI ABSENTEÍSMO RH]]: controlar as rotas com mais hora extra e o **descanso mínimo de 11h entre jornadas** de motoristas e ajudantes. Como a planilha não tem rota, a análise ficou por colaborador. No dia 15 o Júlio estranhou um descanso de 66h: não era bug, eram 2 dias de folga no meio, e a ficha passou a dizer isso.

## Decisões
- 2026-09-14 (Júlio): a planilha do PontoMais não tem rota, então a análise de interjornada × hora extra é **por colaborador** — é o que os dados permitem.
- 2026-09-14 (Claude): importação direto na tela com SheetJS, no mesmo padrão da aba Pagamento Hora Extra.
- 2026-09-15 (Júlio): manter o valor real do descanso (ex.: 66h) e só indicar quantos dias de folga/DSR há no meio. É folga de verdade, não violação, e não pode parecer erro.

## O que foi criado ou mudou
- Migração `create_interjornada_registros` no [[Supabase]] GESTÃO RH: tabela do registro diário de entrada e saída por colaborador, com RLS, políticas para `anon` e `authenticated`, Realtime e índices.
- `supabase_schema.sql` atualizado com a nova tabela e com as que já existiam no banco e faltavam no arquivo (`turnover_mensal`, `head_necessidade_funcao`, `pagamento_hora_extra`).
- `supabase-client.js`: busca de todos os registros e gravação que pode ser reimportada sem duplicar.
- `index.html`: item "InterJornadas" no menu; importação do relatório do PontoMais; cálculo do descanso entre a última saída de um dia e a primeira entrada do dia seguinte (violação abaixo de 11h); filtros; KPIs (violações, colaboradores em risco, pior intervalo, horas extras, conformidade); gráficos (evolução diária, conformidade, top 10 violações, top 10 horas extras); tabela ordenada por violações + horas extras; ficha do colaborador com o dia a dia; exportação para Excel.
- Validação contra a planilha real: **153 violações em 2.291 dias de registro de 78 colaboradores**.
- Commit `e40d65f` (2026-09-15) — tudo isso **mais a pasta `planilhas referencias/`** com 13 planilhas de RH (hora extra com CPF e salário, empregados, HEAD, turnover, ponto). O push foi feito pelo Júlio no terminal dele.
- Commit `2773f81` (2026-09-15) — quando há dias sem ponto (Folga, DSR, Abonado) entre a saída e a próxima entrada, a ficha mostra "inclui N dias de Folga" ao lado do descanso. 268 casos na base.

## Erros e incidentes
- O push do `e40d65f` foi **bloqueado duas vezes** pelo classificador do modo automático do Claude Code ("Data Exfiltration" e "Sensitive-Source Provenance"), porque levava planilhas com dados pessoais para o GitHub. O repositório era público na época.
- O `gh` (GitHub CLI) não está instalado na máquina.
- O descanso de 66h era a saída de quinta 18:00 e a entrada de domingo 12:00, com 2 dias de folga sem ponto no meio.

## Depois
Em 2026-10-05 a importação de setembro falhou porque veio o relatório errado — ver [[2026-10-05 — relatório errado do PontoMais e meses da importação de Hora Extra no BI de RH]]. Corte do ponto e filtro por período: [[2026-09-15 — corte do ponto, importação do PontoMais e gráficos do Turnover no BI de RH]].

## Pendências
- [ ] Tirar as planilhas com dados pessoais do repositório e decidir o que fazer com o histórico do Git — Júlio. Continua aberto em [[BI ABSENTEÍSMO RH]]
- [ ] Se um dia o PontoMais trouxer rota, refazer a análise por rota (o pedido original era "rotas com maior índice de horas extras")

Veja também [[BI ABSENTEÍSMO RH]] e [[Como trabalhar comigo]].
