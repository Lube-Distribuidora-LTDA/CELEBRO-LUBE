---
tipo: conversa
data: 2026-08-31
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, turnover, head, supabase]
registrado_em: 2026-10-09
---
# 2026-08-31 — menu lateral, Turnover, Empregados e Painel HEAD no BI de RH

## Resumo
O [[BI ABSENTEÍSMO RH]] deixou de ser só o painel de absenteísmo. Ganhou **menu lateral** e três abas novas: **Turnover** (entrada e saída de funcionários, a partir das planilhas de 2025 e 2026), **Listagem de Empregados** e **Painel HEAD** (quantas pessoas há por função e onde contratar ou reduzir). Tudo carregado no [[Supabase]] e publicado na [[Vercel]].

## Decisões
- 2026-08-31 (Júlio): limpar 2025 e deixar só 2026 no Turnover. Nas abas por empresa da planilha de 2025 os números eram iguais em todas — um modelo copiado que nunca foi preenchido.
- 2026-08-31 (Júlio): em 2026 o RH escolhe o setor, lança o mês à mão e o painel inteiro recalcula.
- 2026-08-31 (Júlio): detalhamento do Turnover agrupado por localização, com os meses aninhados.
- 2026-08-31 (Claude): o pico de **450% da LUBE RJ em março está certo** — base pequena: 1 colaborador em fevereiro e 9 entradas em março, ((9 + 0) / 2) / 1.
- 2026-08-31 (Júlio): a edição do HEAD é **por local** (empresa • departamento, ex.: "LUBE DISTRIBUIDORA LTDA • AFASTADOS INSS"); clicando em Editar aparecem todas as funções daquele local.

## O que foi criado ou mudou
**Menu lateral, Turnover e Listagem** (commits `23218f5`, `4a94f6f`)
- Menu lateral esquerdo com Absenteísmo, Turnover e Listagem de Empregados, com botão para celular.
- Migração `add_turnover_and_extend_colaboradores`: tabela `turnover_mensal`; `colaboradores` ganha empresa, setor, função, admissão e último exame.
- Carga de 88 registros de turnover (planilhas "Turnover Lube -2025" e "Turnover Lube - 2026") e de 203 colaboradores da listagem de empregados. Depois, **DELETE dos registros de 2025** — ficaram os 40 de 2026 — e o seletor de ano só com 2026.
- Turnover: fórmula ((Entradas + Saídas) / 2) ÷ colaboradores do mês anterior, com "—" em vez do #DIV/0! da planilha; KPIs (turnover médio, entradas, saídas, headcount atual, setor crítico); 4 gráficos; filtros de ano e setor; modal "Lançar Movimentação" por setor e mês; exportação para Excel no padrão do sistema.
- Tabela "Movimentações Detalhadas" agrupada por setor, com totais e os meses do mais recente para o mais antigo.
- Listagem: busca por nome, função e empresa, filtros, paginação, "Adicionar Colaborador" e exportação para Excel.
- Dois bugs antigos de HTML corrigidos (paginação do absenteísmo sem fechar e um parágrafo duplicado com `</div>` sobrando): com o menu lateral, eles faziam o painel de Absenteísmo vazar para fora do conteúdo.
- A cópia `Dashboard Absenteísmo.html` passou a ser atualizada por cópia integral do `index.html`.

**Painel HEAD** (commits `a4157da`, `731770b`)
- Migração `add_head_necessidade_funcao`: tabela das metas por empresa, departamento e função.
- Carga das 69 funções da planilha do RH, conferida contra o resumo da própria planilha: **17 vagas a contratar e 12 reduções**.
- KPIs (head atual 203 × programado 208, vagas, reduções, funções adequadas, departamento crítico), 4 gráficos, tabela agrupada por empresa e departamento, filtros e exportação.
- Botão **Editar** por grupo: ajusta Head Atual e Head Programado de cada função e recalcula Necessidade, Situação (Abaixo/Acima/Adequado), Ação (Contratar/Avaliar Redução/Manter), Vagas e Reduções sem recarregar.
- Em 2026-10-01 o Head Atual deixou de ser o número gravado e passou a ser contado do cadastro — ver [[2026-10-01 — filtro de Empresa, importação de empregados e HEAD do cadastro no BI de RH]].

## Erros e incidentes
- As fórmulas da planilha de turnover davam #DIV/0! nos meses futuros vazios, e o erro se espalhava.
- O campo Último Exame da planilha de empregados veio todo vazio.
- O teste de edição do HEAD alterou uma função no banco (reduções de 12 para 11); o valor original foi restaurado.

## Pendências
- [x] 2026-08-31 — Explicar o 450% da LUBE RJ (acima). Em 2026-09-15 o Claude voltou a oferecer investigar a base, sem resposta do Júlio.

Veja também [[BI ABSENTEÍSMO RH]] e [[Como eu gosto dos BIs]].
