---
tipo: conversa
data: 2026-08-31
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, visual, modo-claro]
registrado_em: 2026-10-09
---
# 2026-08-31 — logo, modo claro e título da aba no BI de RH

## Resumo
No [[BI ABSENTEÍSMO RH]], entre 2026-08-31 e 2026-09-01: a logo e os favicons quebrados foram consertados, a logo ficou só no menu lateral e o **modo claro foi feito de verdade** — o botão sol/lua só trocava o ícone, e a tela continuava escura. Foram duas rodadas de contraste; a primeira estragou badges que estavam bons. A aba do navegador virou "GESTÃO RH | Lube Distribuidora".

## Decisões
- 2026-09-01 (Júlio): fazer o modo claro "completo e caprichado" — opção escolhida quando o Claude avisou que ele não existia.
- 2026-09-01 (Júlio): logo só no menu lateral esquerdo; no cabeçalho do painel, só o nome do que se está vendo.
- 2026-09-01 (Júlio): as cores precisam ficar bem visíveis nos dois modos, e **ao corrigir uma coisa não pode estragar o que já estava bom** ("você mexeu neles enquanto acertava os outros").

## O que foi criado ou mudou
- Commit `a4157da` (2026-08-31) — caminhos da logo e dos favicons apontados para a pasta `imagens/`. Os arquivos tinham sido movidos e davam 404.
- Commit `99bb5a1` (2026-09-01) — logo fora do cabeçalho. Modo claro com um bloco de CSS em `html:not(.dark)`: fundo, cards, menu, cabeçalho, painel do assistente, superfícies recuadas, textos, bordas, botões e badges. O modo escuro não foi alterado. O botão de tema passou a redesenhar os gráficos da aba aberta.
- Commit `775a096` — cores de destaque (ciano, verde, vermelho, roxo, âmbar, azul) escurecidas para o fundo claro; botões de fundo sólido mantêm texto branco (o "Ficha 360°" estava invisível); faixas de cabeçalho de grupo do Turnover e do HEAD com tingimento visível.
- Commit `df14be7` — badges de fundo `-950` semitransparente (HEAD ADEQUADO, ACIMA/ABAIXO DO HEAD, Editar, PRO RH, ícones dos KPIs) viram chips de fundo sólido e mantêm o texto claro.
- Commit `136fb69` — título da aba do navegador "GESTÃO RH | Lube Distribuidora".

## Erros e incidentes
- O painel tinha sido feito só com cores escuras fixas; o botão sol/lua alternava a classe e o ícone, e nada mais.
- No modo claro, "Head Atual/Programado", as porcentagens do Turnover e o botão "Ficha 360°" ficaram ilegíveis: a regra geral de `.text-white` escurecia texto de botão escuro.
- O `775a096` escureceu o texto de destaque de forma geral e quebrou os badges (texto escuro sobre fundo escuro). O Júlio reclamou e o `df14be7` corrigiu.

## Depois
A regra do chip cobre as opacidades /60 e /80. Em 2026-10-01 os atalhos da aba Exames, feitos com /70, ficaram ilegíveis no modo claro — ver [[2026-10-01 — filtro de Empresa, importação de empregados e HEAD do cadastro no BI de RH]].

## Pendências
Nenhuma.

Veja também [[BI ABSENTEÍSMO RH]] e [[Como eu gosto dos BIs]].
