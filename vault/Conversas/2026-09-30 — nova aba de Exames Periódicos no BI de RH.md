---
tipo: conversa
data: 2026-09-30
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, exames, aso, saude-ocupacional]
---
# 2026-09-30 — nova aba de Exames Periódicos no BI de RH

## Resumo
Criada a aba **Exames Periódicos** no [[BI ABSENTEÍSMO RH]], a partir do arquivo "Controle periodicos.xls" (aba `Controle`, 199 colaboradores). Controla o vencimento do ASO por colaborador, com KPIs, quatro gráficos, tabela e importação de planilha. No ar, sem a tabela do Supabase ainda.

## Decisões
- **2026-09-30: a validade do ASO é recalculada no painel, nunca lida da planilha.** A coluna STATUS do arquivo ("Vencido" / "N. Vencido") é o retrato do dia em que o RH salvou e envelhece sozinha. O painel compara `PROXIMO ASO` com a data de hoje a cada carga. Mesmo princípio de [[Corte do ponto]]: dado derivado se calcula, não se congela.
- **2026-09-30: afastado INSS e desligado ficam fora da conta de conformidade.** Não há exame a cobrar deles; entrariam como falso vencido. Esses dois casos continuam vindo da planilha, porque a data sozinha não os identifica.
- **2026-09-30: faixas de alerta em 30 e 90 dias.** Vencido · Vence em 30 dias · Vence em 90 dias · Em dia · Sem registro · Afastado INSS · Desligado.

## O que foi feito
Commit `e60b621`, publicado na [[Vercel]].

- Aba nova no menu lateral, seguindo o padrão visual das demais.
- Gráficos: situação dos exames, **agenda de vencimentos dos próximos 12 meses** (é o que serve para programar as consultas), pendências por departamento e tipo do último exame.
- Tabela ordenada do mais vencido para o menos urgente, com dias de atraso/prazo.
- Importação de planilha e exportação para Excel.
- `migrations/2026-09-30_exames_periodicos.sql` criado — **a tabela ainda não existe no Supabase**. Até rodar, o painel usa a base do repositório e o que for importado fica só no navegador, com aviso na tela.

### Retrato da base em 30/09/2026
199 colaboradores · **26 vencidos** · 1 vence em 30 dias · 8 em 90 dias · 153 em dia · 1 sem exame · 9 afastados INSS · 1 desligada. Conformidade 85,7%. Maior atraso: 539 dias. Concentração em ENTREGA (14 vencidos).

## O que a planilha exigiu de tratamento
- **TIPO é digitado à mão:** `ADMISSSIONAL`, `ADMISSINAL`, `MUDAANÇA FUNÇÃO`, `MUDANÇA DE FUNÇÃO`. Sem normalizar, cada erro de digitação virava uma fatia no gráfico. `normalizeTipoExame()` agrupa as variantes.
- A função passa por `normalizeFuncao()`, como no resto do painel.
- Datas vazias vinham como 1900/1901 (serial zero do Excel) e viravam "vencido há 45 mil dias" — tratadas como **sem registro**.

## Conferência
A leitura do `.xls` pelo painel (SheetJS) foi comparada com um leitor independente (xlrd/Python): 199 registros, **zero divergência** nos 9 campos.

## Achado paralelo
O toggle de tema só re-renderizava os gráficos de Absenteísmo, Turnover e HEAD. Hora Extra e InterJornadas trocavam de tema com o eixo ilegível até alguém mexer num filtro. Corrigido no mesmo commit.

Também no mesmo commit: o gráfico de pendências por departamento é uma pilha horizontal, e o rótulo de barra simples jogava o número de cada parte em cima da parte vizinha. Ganhou um rótulo próprio (`dlEmpilhadoHorizontal`). A primeira versão, com esse erro e roscas apertadas, foi corrigida antes do commit.

## Depois
- Na mesma tarde, a lentidão entre abas e os rótulos das roscas e dos badges desta aba — ver [[2026-09-30 — lentidão entre abas e rótulos das roscas no BI de RH]].
- Em 2026-10-01: atalhos ilegíveis no modo claro e o filtro **Mês de Vencimento** — ver [[2026-10-01 — filtro de Empresa, importação de empregados e HEAD do cadastro no BI de RH]].

## Pendências
- [ ] **Rodar `migrations/2026-09-30_exames_periodicos.sql`** no Supabase, para o controle sair do navegador e virar base compartilhada — Júlio. Em 2026-10-09 a tabela ainda não existia
- [ ] Decidir o que fazer com os **26 vencidos** e com a colaboradora sem nenhum exame registrado
- [ ] Seguem abertas as de [[2026-09-17 — rótulos de dados e competência do ponto no BI de Absenteísmo RH]], inclusive a migração da competência

Veja também [[BI ABSENTEÍSMO RH]], [[Corte do ponto]] e [[Como eu gosto dos BIs]].
