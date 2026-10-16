---
tipo: conversa
data: 2026-09-17
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, graficos, competencia]
registrado_em: 2026-09-23
---
# 2026-09-17 — rótulos de dados e competência do ponto no BI de Absenteísmo RH

## Resumo
Pusemos rótulo de dados nos 24 gráficos do [[BI ABSENTEÍSMO RH]] e invertemos a regra da competência do ponto: o período passa a levar o nome do mês em que **fecha** (21/12 a 20/01 = Janeiro), desfazendo a decisão tomada na véspera. Tudo publicado na [[Vercel]] e conferido no ar. Ficou aberta uma contradição sobre como nomear os dois últimos períodos — ver Pendências.

## Decisões
- **2026-09-17: a competência leva o nome do mês em que o período FECHA.** 21/12 a 20/01 = Janeiro, 21/01 a 20/02 = Fevereiro. Isso reverte o commit `daa52b4` do dia 16, que nomeava pelo mês de abertura e criava uma competência "Dezembro" alimentada pelos dias 21 a 31 de dezembro — que não existe no fechamento real da folha. Conceito registrado em [[Corte do ponto]].
- **2026-09-17: todo filtro de mês mostra o período apurado junto do nome** — `Janeiro/2026 (21/12 a 20/01)` — para não haver dúvida sobre o que está sendo filtrado. Vale para Absenteísmo, Pagamento Hora Extra, InterJornadas e o seletor de importação de hora extra.
- **2026-09-17: no eixo dos gráficos fica só o nome do mês.** A parametrização (21 a 20) é interna: aparece no tooltip e no badge do card, não polui o eixo.
- **2026-09-17: o Turnover continua em mês de calendário.** Decisão do Júlio. Os números daquela aba são lançados à mão por mês, sem data de origem para reclassificar — rotular como período de ponto seria inventar.
- **2026-09-17: rótulo que não cabe não aparece.** Segmento empilhado baixo demais, fatia abaixo de 2–3%, zeros do Turnover e o gráfico diário de interjornada acima de 40 dias ficam só no tooltip. Números sempre em padrão brasileiro. Registrado em [[Como eu gosto dos BIs]].

## O que foi criado ou mudou
- [[BI ABSENTEÍSMO RH]]: nota de projeto criada.
- [[Corte do ponto]]: conceito criado — a regra da competência e onde ela vive.
- [[Como eu gosto dos BIs]]: nova seção sobre rótulos de dados e números.
- Commit `1e028ad` — rótulos nos 24 gráficos + competência pelo mês de fechamento. No ar em `rh-absentismo.vercel.app`, conferido no site publicado (não só local).
- Commit `98d25e7` — `supabase_schema.sql` e `migrations/2026-09-17_competencia_mes_de_fechamento.sql`. **A migração não foi aplicada no banco.**

## O que se descobriu olhando o banco
- A trigger `fn_enrich_ocorrencia` grava `ano/mes/mes_nome/mes_ano/ano_mes_sort` pelo **mês de calendário**. O painel recalcula a competência a cada carga, então a tela sempre esteve certa — mas as colunas gravadas e as views `vw_evolucao_mensal` / `vw_kpis_absenteismo` discordavam dela: **333 de 1.189 linhas**.
- **Falta um período inteiro de dados:** não existe nenhuma ocorrência entre 20/06 e 21/07. A última falta de junho é 19/06 e a próxima é 21/07. A janela 21/06 a 20/07 (competência Julho) nunca foi importada — é por isso que a lista pula de Junho direto para Agosto.

## Erros e incidentes
- O `apply_migration` da competência foi negado pelo classificador do modo automático do Claude Code (tratado como deploy de produção). O Claude não contornou o bloqueio e deixou a migração versionada para o Júlio.
- Tropeços de script no caminho (heredoc do Bash, trecho não encontrado num script Python de patch, escape de caminho do Windows no Python). Resolvidos editando o arquivo direto.

## Pendências
- [x] **Resolver a contradição da nomenclatura dos dois últimos períodos** — Júlio. Ele apontou que "Junho é julho e Agosto é julho", mas 21/07 a 20/08 = Julho só vale pela regra do mês de **abertura**, e por essa mesma regra 21/12 a 20/01 voltaria a ser Dezembro, que foi justamente o que ele mandou tirar. A pergunta feita a ele nesse dia ficou sem resposta. **Resolvido na prática em 2026-10-05:** ele pediu "Setembro (21/08 a 20/09)" na importação de Hora Extra, que é o mês de fechamento. Ver [[Corte do ponto]].
- [ ] **Importar o período 21/06 a 20/07** (competência Julho) — Júlio. Precisa do relatório do PontoMais; sem ele o buraco continua.
- [ ] **Aplicar a migração do banco** — está pronta em `migrations/2026-09-17_competencia_mes_de_fechamento.sql`, é só colar no SQL Editor do Supabase. O Claude Code foi bloqueado pelo classificador de permissões na hora de aplicar (classificado como deploy de produção). Rodar fora do horário de uso: a tabela está no Realtime e o backfill dispara 333 eventos para quem estiver com o painel aberto. Em 2026-10-09 ainda não aparecia na lista de migrações do Supabase.
- [ ] **Decidir sobre o repositório** — `Lube-Distribuidora-LTDA/Absente-smo-RH` era público nesse dia, contra o padrão registrado em [[Como eu gosto dos BIs]]. Desde ~2026-10-06 está **privado**, e o deploy pelo Git ficou `BLOCKED`; a decisão continua aberta em [[BI ABSENTEÍSMO RH]].

Veja também [[Corte do ponto]], [[BI ABSENTEÍSMO RH]], [[Como eu gosto dos BIs]] e [[Supabase]].
