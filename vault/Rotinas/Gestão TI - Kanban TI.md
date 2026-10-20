---
tipo: rotina
departamento: TI
status: ativo
inicio: 2026-10-07
tags: [rotina, ti, kanban]
---
# Gestão TI - Kanban TI

Quadro dos **problemas internos da TI** dentro do [[GESTÃO TI]], em Infraestrutura › Kanban TI. É onde o setor organiza o que precisa resolver.

Feito em 2026-10-07 (commit `11297c7`) e **no ar desde 2026-10-08 08:14** (commit vazio `9a866cc`, porque o deploy do primeiro ficou `BLOCKED`). As rotas são `/kanban`, `/api/kanban` e `/api/kanban/[id]`.

## Fluxo
1. **Gatilho** · um problema interno da TI a resolver; pedido de usuário não entra aqui, vai para Atendimento › Chamados
2. **Pessoa** · a TI cria o cartão em Infraestrutura › Kanban TI do [[GESTÃO TI]]: problema (obrigatório), detalhes e responsável
3. **Pessoa** · arrasta o cartão entre Projetos, Novo, Em andamento, Aguardando retorno, Anotações e Feito; ele entra no fim da coluna de destino
4. **Grava** · criar, editar e arrastar gravam em `kanban_cartoes` pelas rotas `/api/kanban` e `/api/kanban/[id]`; o navegador nunca fala com o [[Supabase]]
   - Colunas são dados em `kanban_colunas`: renomear, trocar a cor ou acrescentar é um registro, não uma migração
   - O id do cartão viaja no `dataTransfer`, não no estado do React (foi o que fez o primeiro teste não gravar)
5. **Entrega** · no dashboard, uma faixa com a contagem de cada coluna que leva ao quadro; some quando não há cartão

## Não é o quadro de chamados
Essa separação é a razão de ele existir:

| | Chamados | Kanban TI |
|---|---|---|
| Quem abre | o usuário, pelo portal de chamados (desde 2026-10-07 só com login do Painel Lube) | a própria TI |
| O que é | pedido de atendimento | problema interno a resolver |
| Onde fica | Atendimento › Chamados | Infraestrutura › Kanban TI |

Os dois não se conversam. Decisão do Júlio em 2026-10-07, ao pedir o quadro.

## Colunas
**Projetos · Novo · Em andamento · Aguardando retorno · Anotações · Feito**

Em 2026-10-20 as colunas passaram a espelhar o quadro que a TI já mantinha no **KanbanFlow** ("Demandas da TI"), em vez dos nomes do primeiro desenho (Em análise · Tranquilo resolver · Crítico · Resolvido). As colunas foram **renomeadas, não recriadas** — recriar exigiria mover ou apagar os cartões que já existiam.

São **dados, não enum**: renomear uma coluna, trocar a cor ou acrescentar outra é um registro em `kanban_colunas`, não uma migração. A cor é guardada pelo nome (`azul`, `verde`, `vermelho`, `ambar`, `cinza`) e a tela traduz para a paleta, para o tema escuro continuar valendo.

## O cartão
Problema (obrigatório), detalhes e responsável (opcionais). Clicar abre para editar; arrastar move entre colunas e grava na hora. O cartão entra sempre no fim da coluna de destino.

## No dashboard
Uma faixa com a contagem de cada coluna, que leva ao quadro. **Some quando não há nenhum cartão** — faixa que só mostra zeros ocupa espaço sem dizer nada.

## Detalhes técnicos que custaram caro
- **Arrastar não carrega o id no estado do React.** Entre o `dragstart` e o `drop` pode não ter havido render, e o estado chegaria vazio no destino — foi o que fez o primeiro teste não gravar nada. O id viaja no `dataTransfer`, que é o mecanismo do próprio navegador. Sem biblioteca de arrastar; é o recurso nativo.
- **O quadro nasceu em laço infinito**, 465 chamadas à API em segundos, porque o `useAviso` recriava suas funções a cada render e isso realimentava o efeito de carga. Estabilizado no próprio hook, o que vale para as 11 telas que o usam.

## Tabelas
`kanban_colunas` e `kanban_cartoes` — arquivo `20261007200000_14_kanban_ti.sql` no repositório, migração `kanban_ti` no banco (aplicada em 2026-10-07 às 17:40 de Brasília, 20:40 UTC; o "14" é a numeração do repositório, não a do banco). Mesmo fechamento das demais: RLS ligado, privilégios de `anon` e `authenticated` revogados, e tudo passando pelas rotas `/api` com a `service_role` — o navegador nunca fala com o [[Supabase]] direto.

Veja também [[GESTÃO TI]] e [[2026-10-07 — Kanban TI e o mês que nunca abria]].
