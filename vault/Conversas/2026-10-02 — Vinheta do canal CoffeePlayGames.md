---
tipo: conversa
data: 2026-10-02
projeto: "[[VINHETA CPG]]"
status: resumido
tags: [conversa, video, vinheta, youtube, coffeeplaygames]
---
# 2026-10-02 — Vinheta do canal CoffeePlayGames

## Resumo
Júlio mandou a arte do canal CoffeePlayGames e pediu uma vinheta 3D rápida, de 5 a 6 s no mínimo, com os
personagens e a logo. Também pediu que, se possível, as imagens fossem buscadas ou melhoradas. O
Claude reconstruiu a logo em 3D, recortou e limpou os 19 personagens e ícones da própria arte, montou
um motor WebGL2 3D e gravou uma vinheta de 6,5 s com som sintetizado. Detalhes e comandos em
[[VINHETA CPG]].

## Decisões
- 2026-10-02 (Claude): as imagens não foram baixadas da internet (é download de arquivo com direitos de
  terceiros). O Claude usou os recortes da arte enviada, limpos e ampliados 2x. A troca por PNGs melhores
  ficou documentada.
- 2026-10-02 (Claude): o motor do [[VÍDEO WORKSHOP LUBE]] (Chrome sem janela → quadros → ffmpeg) foi reaproveitado
  na gravação. O motor 3D é novo, com logo extrudada, malhas, partículas, desfoque de movimento e bloom.
- 2026-10-02 (Claude): três roteiros concorreram e um juiz escolheu "Insira a moeda", com enxertos dos outros
  dois. O roteiro final está no `STORYBOARD.md` do projeto.
- 2026-10-02 (Claude): duração de 6,50 s. A logo fica legível e parada de 4,55 a 6,30 s.
- 2026-10-02 (Claude): o som saiu sem pedido, então foram entregues as versões com e sem som.

## O que foi criado ou mudou
- [[VINHETA CPG]]: nota nova do projeto.
- `Downloads\Vinheta CoffeePlayGames.mp4` e `Downloads\Vinheta CoffeePlayGames (sem som).mp4`.
- `Área de Trabalho\VINHETA CPG\`: projeto completo para refazer (`LEIA-ME.md`, `STORYBOARD.md`,
  `MOTOR.md`). **Em 2026-10-09 essa pasta já não estava na Área de Trabalho** e não sobrou cópia do
  projeto (ver [[VINHETA CPG]]).
- [[CLAUDE.md]]: linha da vinheta na seção "O que já sabemos".
- O trabalho rodou em dois workflows em segundo plano (`vinheta-cpg-etapa1`, run `wf_87a845f1-1e3`, e
  `vinheta-cpg-etapa2`, run `wf_71e67b54-542`). Os scripts deles ficaram no histórico da conversa (ver
  [[VINHETA CPG]], "Onde estão as coisas").

## Erros e incidentes
- A face do card sumia no motor (o z dela saía ±1e-15, e não 0 exato). O Claude corrigiu em
  `web/js/primitivas.js`.
- O Claude não ouviu o som, só mediu volume, pico e ataques.
- Tropeços de ferramenta (leitura errada do resultado da etapa 1, edição recusada por arquivo não lido,
  acentos quebrados no console) foram resolvidos na hora, sem efeito no vídeo.
- Às 12:03 aparece no histórico uma imagem de 1606×2274. Não foi mensagem nova do Júlio: era o Claude
  olhando uma prancha de conferência do próprio projeto.

## Como foi conferido
- A logo e os recortes passaram por revisores independentes, que olharam pranchas sobre fundos de
  contraste. Os recortes foram reprovados na 1ª rodada e corrigidos:
  - franja e marca d'água nas moedas $;
  - cor do sapato do Sonic;
  - pedaços de fundo no PS5.
- O motor foi revisado duas vezes: a 1ª revisão achou 13 problemas, e depois da 2ª ficou um defeito de
  uma linha (a face do card sumia), que o Claude corrigiu.
- A vinheta passou por três revisores: roteiro, direção de arte e técnica quadro a quadro. Eles acharam
  30 pontos, 6 médios:
  - flashes virando véu cinza;
  - reflexo de lente cortando a logo;
  - linhas da trava por cima dos personagens;
  - moedas $ e de estrela apagadas;
  - ponta reta da capa do Drácula.

  Tudo foi corrigido, e a 2ª revisão aprovou.
- MP4 final:
  - 390 quadros e 6,50 s, decodificando sem erro;
  - som a −14,1 LUFS e −1,35 dBTP, começando no quadro 0;
  - quadros do MP4 iguais aos renderizados (diferença ≤ 1,6 tom em 255).

  Um conferente independente aprovou, e o Claude olhou os quadros do MP4 final.

## Pendências
- [ ] Ouvir a versão com som em fone e celular — Júlio
- [ ] 3 detalhes leves que ficaram (moeda escura de perfil em 0,73–0,80 s, brilhos fracos nos pousos das
      moedas $, Sonic aceso alguns quadros a mais na saída), se quiser refinar
- [x] Sugestão: com dois vídeos feitos no mesmo esquema ([[VÍDEO WORKSHOP LUBE]] e [[VINHETA CPG]]), vale
      criar uma skill `video-motion` em `Skills/` com o passo a passo (recorte → motor → revisão → MP4) — feita em
      2026-10-16: [[video-motion]]
- [ ] Se tiver PNGs melhores dos personagens (fundo transparente), mandar para trocar e regravar (~9 min
      de gravação) — Júlio
- [ ] Achar a pasta do projeto, que saiu da Área de Trabalho (ver [[VINHETA CPG]]) — Júlio
