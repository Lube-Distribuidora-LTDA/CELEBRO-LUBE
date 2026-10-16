---
tipo: conversa
data: 2026-09-09
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, hora-extra, supabase]
registrado_em: 2026-10-09
---
# 2026-09-09 — Pagamento Hora Extra no BI de RH

## Resumo
Nova aba **Pagamento Hora Extra** no [[BI ABSENTEÍSMO RH]], com os 8 meses das planilhas de referência (01 a 08/2026), gráficos, KPIs, muitos filtros e importação com escolha do mês antes. As colunas "(Qtde): Hora Extra 50%/100%" vinham sem formato de hora: o número é o **total em minutos**. Depois vieram três ajustes: centavos exatos, tabela por colaborador com ficha e importação só no ano atual.

## Decisões
- 2026-09-09 (Júlio): valores pagos aparecem **reais, com centavos**, nunca arredondados (R$ 10,87 é R$ 10,87).
- 2026-09-09 (Júlio): antes de importar, escolher o mês, para cada planilha entrar no mês certo.
- 2026-09-09 (Claude): reimportar um mês **substitui** os lançamentos daquele mês (apaga e grava), sem duplicar.
- 2026-09-09 (Júlio): a tabela detalhada fica consolidada por colaborador, com ficha mensal.
- 2026-09-09 (Júlio): só se importa no ano atual, do mês corrente em diante. **Mudou em 2026-10-05** — ver [[2026-10-05 — relatório errado do PontoMais e meses da importação de Hora Extra no BI de RH]].

## O que foi criado ou mudou
- Migração `create_pagamento_hora_extra` no [[Supabase]]: tabela com competência, empresa, colaborador, departamento, admissão, CPF, sexo, função, salário base, percentual, valor pago e quantidade.
- Carga dos 8 meses em 5 lotes: **464 lançamentos, 92 colaboradores, R$ 108.579,18** no período; totais por mês conferidos com o leitor.
- Regra de leitura: a coluna de quantidade traz minutos e é convertida para horas. Confirmado batendo salário-hora × horas contra o valor pago de cada um.
- Commit `03baf9a` — aba no menu lateral: KPIs (pago 50%, pago 100%, total, horas, colaboradores, custo médio), gráficos (evolução mensal 50% × 100%, rosca de distribuição, top 10 colaboradores, ranking por função), filtros de mês/ano, departamento, função, percentual e busca por nome. Importação liberada só depois de escolher mês e ano (testado reimportando janeiro). Cores do modo claro para os fundos novos.
- Commit `505b292` — moeda com 2 casas fixas nos KPIs e na tabela. Antes arredondava para reais inteiros.
- Commit `bd95eea` — tabela "Lançamentos Detalhados por Mês" com uma linha por colaborador (meses, horas, valor, do maior para o menor) e botão "Ver Ficha" com o histórico mês a mês, média mensal, empresa, admissão e salário base mais recente. A ficha ignora os filtros da tela.
- Commit `ed6f890` — importação travada no ano atual, com meses do corrente até dezembro, gerados pela data do dia.

## Erros e incidentes
- O Python não está instalado na máquina (só o atalho da Microsoft Store). As planilhas foram lidas com Node e a biblioteca `xlsx` numa pasta temporária.

## Pendências
- [ ] Conferir as políticas de acesso da tabela `pagamento_hora_extra`: ela guarda CPF e salário, e o painel lê do navegador com a chave pública — Júlio/Claude. Continua aberto em [[BI ABSENTEÍSMO RH]]
- [x] 2026-10-05 — Avaliar se travar a importação do mês corrente em diante impede lançar a folha que fecha depois da virada do mês: impedia, e o seletor foi trocado

Veja também [[BI ABSENTEÍSMO RH]] e [[Corte do ponto]].
