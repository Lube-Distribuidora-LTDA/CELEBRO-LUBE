---
tipo: conversa
data: 2026-10-05
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, interjornada, hora-extra, pontomais, importacao]
registrado_em: 2026-10-09
---
# 2026-10-05 — relatório errado do PontoMais e meses da importação de Hora Extra no BI de RH

## Resumo
O Júlio importou a planilha de setembro (21/08 a 20/09) na aba InterJornadas do [[BI ABSENTEÍSMO RH]] e nada entrou. O arquivo era o **"Relatório de Horas Extras"** do PontoMais, que só lista os dias com hora extra. A InterJornadas exige o **"Relatório de Jornada"**, com todos os dias. O sistema já recusava de propósito; o que mudou foi o aviso, que agora diz qual relatório veio e por que não serve. O Júlio exportou o relatório certo e resolveu. Depois pediu Setembro no seletor de importação da Hora Extra, que só mostrava de Outubro em diante.

O assunto passou por duas conversas: começou numa sessão do [[GESTÃO TI]] (onde o Júlio depois disse que era de outra conversa e pediu para esquecer; o commit e a nota ficaram) e terminou na sessão do BI de RH.

## Decisões
- 2026-10-05 (Claude): **não aceitar o Relatório de Horas Extras na InterJornadas.** Com dias faltando, o descanso é medido por cima do buraco (salto de até 18 dias; 44% dos intervalos) e parece válido, num assunto trabalhista.
- 2026-10-05 (Claude): a folha de uma competência só existe depois que ela fecha, no dia 20. A importação de Hora Extra deve listar competências **fechadas**, não futuras.
- 2026-10-05 (Júlio): a importação de Hora Extra mostra **só Setembro a Dezembro** — lista curta, para não escolher o mês errado. Pedido do RH.
- O Júlio nomeou o período 21/08 a 20/09 como **Setembro**: regra do mês de fechamento, o que resolve na prática a dúvida aberta em [[Corte do ponto]].

## O que foi criado ou mudou
- Commit `6781f4a` — nova `identificarRelatorioPontoMais()` lê o título da planilha, e o aviso explica que só o Relatório de Jornada serve. Publicado.
- [[BI ABSENTEÍSMO RH]]: seção "InterJornadas: qual relatório do PontoMais exportar", com as medidas do dia (Jornada = 2.291 linhas, 78 pessoas; Horas Extras = 674 linhas, 66 pessoas, ~10 dias cada).
- Diagnóstico da segunda tentativa, sem mudança de código: 66 colaboradores e 664 linhas de dia, cobertura de 32% (contra 66 × 31). A base de interjornada ia de 21/12/2025 a 20/08/2026.
- Commit `e6534c4` — o seletor de competência da Hora Extra passou a listar as 12 últimas competências até a atual. O valor da opção virou a competência inteira (`2026-09`) e o ano, somente leitura, acompanha a escolha.
- Commit `5222ada` — a pedido do Júlio, só Setembro, Outubro, Novembro e Dezembro do ano corrente ("Setembro/2026 (21/08 a 20/09)" … "Dezembro/2026 (21/11 a 20/12)"), com nota no código sobre a virada do ano. Publicado como "versão 2026-10-05 (5222ada)".
- Depois, o Júlio importou o Relatório de Jornada certo. Em 2026-10-09 a tabela `interjornada_registros` tinha 17.098 linhas (eram 14.940).

## Erros e incidentes
- O Júlio exportou o relatório errado do PontoMais. Visto de fora, os relatórios têm a mesma cara, e o nome do arquivo não denuncia.
- Bug corrigido junto no `e6534c4`: o ano da importação de Hora Extra era fixo no ano atual e, em janeiro, gravaria a competência de dezembro no ano errado.

## Pendências
- [x] 2026-10-05 — Exportar o Relatório de Jornada de 21/08 a 20/09 e importar na InterJornadas — Júlio
- [ ] Conferir no banco a cobertura do período importado (cerca de 31 datas por colaborador, sem buracos) — Claude, quando o Júlio pedir
- [ ] Importação de equipe diferente da LLOG: o nome do arquivo precisa conter "equipe XXX"; sem isso tudo entra como LLOG, sem aviso — RH
- [ ] Na virada do ano, rever a faixa fixa Setembro a Dezembro: em janeiro/2027 ela mostraria Set–Dez/2027, que ainda não fecharam, e Dezembro/2026 sairia — Júlio avisar o Claude

Veja também [[BI ABSENTEÍSMO RH]] e [[Corte do ponto]].
