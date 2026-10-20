---
tipo: conversa
data: 2026-10-20
projeto: BI ABSENTEÍSMO RH
tags: [conversa, rh, bi, design, filtros]
---
# 2026-10-20 — BI de RH com a cara dos sistemas atuais

## Resumo
O Júlio pediu: "atualize o design e filtros do sistema para o design dos sistemas atuais que estamos fazendo. Utilize o cérebro pra isso". O [[BI ABSENTEÍSMO RH]] (GESTÃO RH) ainda tinha a cara de setembro: ciano neon, Plus Jakarta Sans, degradê "3D" nos gráficos e filtros em grade de selects. Passou a ter a cara do [[GESTÃO COMERCIAL TRADE]], do [[MOVIMENTAÇÃO DE INVENTÁRIO]] e do [[GESTÃO FISCAL]].

## De onde veio o desenho
- [[Como eu gosto dos BIs]] (estilo visual, painel de luxo, filtro de chips, gráficos e números) e [[Identidade visual da Lube]].
- O código do Inventário (`16. INVENTARIO/web/css/base.css` e `js/filtros.js`): tokens, menu, topo, faixa de filtros, popover e pílulas vieram de lá. As fontes também.

## O que foi feito
- Tokens dos dois temas + componentes em `css/tema-lube.css`; as 184 classes de cor do Tailwind que o painel usa reapontadas para os tokens por `css/tema-utilitarios.css`, **gerado** por `tools/gerar_tema_utilitarios.py`. Foi a forma de mudar 10 mil linhas (e o HTML montado pelo JS) sem reescrever a marcação.
- Menu agrupado, topo com olho em ouro, botão principal vermelho.
- Plugin `temaGraficos`: cores dos 28 gráficos trocadas por token na hora em que o gráfico nasce; cor sólida; paleta de dado nas séries que são categoria.
- Faixa de filtros igual à dos outros painéis em todas as telas, com pílulas, "Limpar filtros" e período rápido; Empregados com múltipla escolha.
- Número do cartão medido (encolhe até caber); horas e contador no padrão brasileiro; explicações da tela viraram dica.

## Erros achados no caminho (do Claude, corrigidos antes de subir)
- As ações do Absenteísmo apareciam em todas as telas: a regra de layout do topo vencia o `hidden`.
- Cinza do Tailwind (`#94a3b8`) classificado como azul nos gráficos: troquei saturação por croma.
- Legenda da rosca escura no tema escuro: o gerador de legenda não dava `fontColor`.
- Cores do Turnover não trocavam: vinham em hex de 8 dígitos.
- "Limpar filtros" aceso depois de um reset: a faixa se atualizava antes de a busca ser apagada.

## Conferência
Na máquina, com os dados reais, os mesmos números de antes: Absenteísmo 1.282, ENTREGA 451, Segundas 434, Injustificado 387, dois meses 591 (= conferência por fora), último mês 93 = 93, 3 meses 327 = 327; InterJornadas 2 períodos + 3 pessoas = 186 = 186; Hora Extra 508 + 13 = 521; Empregados 86 = 86; Exames 26 vencidos e 14 a vencer. Tema claro e escuro, celular (375 px) sem rolagem lateral. Publicado: commit `4d8406c`, deploy `READY`; CSS e fontes respondem 200, a página segue atrás do login.

## Pendências
- [ ] Conferir logado (rodapé `4d8406c`) — Júlio
- [ ] Turnover com múltipla escolha pede refazer o gráfico — decisão do Júlio
- [ ] Dados de pessoa no repositório público (segue aberto, ver [[BI ABSENTEÍSMO RH]])

## Links
[[BI ABSENTEÍSMO RH]] · [[Como eu gosto dos BIs]] · [[Identidade visual da Lube]] · [[MOVIMENTAÇÃO DE INVENTÁRIO]] · [[GESTÃO COMERCIAL TRADE]] · [[GESTÃO FISCAL]]
