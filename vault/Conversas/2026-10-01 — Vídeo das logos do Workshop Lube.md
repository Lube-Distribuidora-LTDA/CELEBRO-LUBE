---
tipo: conversa
data: 2026-10-01
projeto: "[[VÍDEO WORKSHOP LUBE]]"
status: resumido
tags: [conversa, video, workshop, fornecedores, evento]
---
# 2026-10-01 — Vídeo das logos do Workshop Lube

## Resumo
O Júlio pediu um vídeo para o evento "Workshop Lube Distribuidora", com as logos dos fornecedores
(zip com 23 cartões) aparecendo uma por vez, com tema de luxo e transições profissionais. O Claude
recortou as 23 logos dos cartões, montou um motor de animação em WebGL que grava MP4 quadro a quadro
pelo Chrome sem janela, e fez abertura, 23 cenas e encerramento. Detalhes e como refazer em
[[VÍDEO WORKSHOP LUBE]].

Um minuto antes (14:29), o mesmo pedido tinha saído com outro zip (`Design sem nome.zip`). Aquela conversa
parou ali; todo o trabalho foi feito nesta, das 14:30 às 17:18, com `logos workshop lube.zip`.

## Decisões
- 2026-10-01 (Claude): "Notion" no pedido foi entendido como *motion* (animação).
- 2026-10-01 (Júlio): o primeiro rumo era um tema de luxo diferente por logo (esmeralda, safira, mármore…).
  Com o trabalho andando, o Júlio pediu fundo branco. O Claude apontou que isso contradizia o pedido
  de um tema por logo e perguntou; resposta: **o mesmo mármore branco em todas**, abertura e
  encerramento como estavam. O Claude tinha recomendado o mármore com veios na cor de cada marca; o
  Júlio preferiu o mármore idêntico atrás das 23 logos.
- 2026-10-01 (Claude): o workflow que fazia os 21 fundos coloridos foi parado assim que o Júlio pediu o
  branco. Os temas coloridos já feitos foram arquivados em `web/js/themes/_arquivo/`, não apagados.
- 2026-10-01 (Claude): a transição de luz é que leva a logo antiga embora, sobre o mármore que não muda.
  Ficaram só as transições que funcionam no branco: faixa de luz, seda, anel de ouro e clarão.
- 2026-10-01 (Claude): o selo da Lube do cartão sai pela forma exata dele, não por retângulo (o retângulo
  cortava os cantos da Mili e da Tekbond).
- 2026-10-01 (Claude): na nota do projeto, tirou duas afirmações que eram suposição (o departamento e
  "evento costuma ter som próprio"). Suposição não entra como fato.

## O que foi criado ou mudou
- [[VÍDEO WORKSHOP LUBE]]: nota nova do projeto.
- `Downloads\Workshop Lube - Fornecedores.mp4`: o vídeo.
- `Área de Trabalho\WORKSHOP LUBE\`: projeto completo para refazer ou ajustar (copiado com `robocopy`,
  118,5 MB, e testado gravando um quadro a partir da cópia). **Em 2026-10-09 essa pasta já não estava
  na Área de Trabalho**; onde ainda há cópia está em [[VÍDEO WORKSHOP LUBE]].
- Na máquina: `pip` instalou `imageio-ffmpeg` e `scipy`. Os Chromes sem janela e o servidor de prévia
  foram fechados no fim.
- Três workflows em segundo plano: `workshop-lube-temas` (21 autores para os fundos coloridos, run
  `wf_9f914c38-f0f`, **parado** quando o Júlio pediu o branco), `workshop-lube-revisao-marmore` (6
  revisores, run `wf_69c4e38a-0a6`) e `workshop-lube-conferencia-mp4` (4 revisores, run `wf_3dfae278-397`).
  Os dois de revisão só fizeram relatório; as correções foram do Claude.

## Erros e incidentes
- O primeiro teste de gravação travava por um erro de sintaxe no JavaScript; a prévia no navegador
  mostrou o erro.
- Com vários Chromes ao mesmo tempo a GPU derrubava o WebGL; o gravador passou a detectar e tentar de novo.
- Ao tirar o filete branco da Tekbond, as letras brancas do topo da faixa saíram junto; corrigido.
- Tropeços de ferramenta (acentos no Python do Windows, patches quebrados por aspas, uma troca de texto
  que não casou no `engine.js` e foi reaplicada) foram resolvidos na hora, sem efeito no vídeo.
- A nota do projeto saiu dizendo que a gravação leva ~30 min; as duas gravações reais levaram ~12 a 14
  min. Corrigido em 2026-10-09.

## Como foi conferido
- Seis revisores independentes olharam as 25 cenas em resolução cheia e apontaram 39 problemas
  (miolo branco nos "D" da Beira-Alta, BIO transparente na Utilar, canto da Mili cortado, borda
  dourada estourando em neon, sombra chegando antes da logo, entre outros). Todos foram corrigidos e
  conferidos de novo em quadros renderizados.
- Depois de gravado, quatro revisores conferiram quadros tirados do próprio MP4. Acharam mais 16
  detalhes (braços finos dos "E" de DESDE apagados, manchas na moldura dourada da Beira-Alta, borda
  da varredura cor de lama sobre placa azul-marinho, íris nascendo como borrão, entre outros). Foram
  corrigidos e o vídeo foi gravado de novo.
- Ficou de fora, de propósito: o respiro entre o selo e o "WORKSHOP" na abertura (o Júlio pediu
  para manter a abertura como estava) e a nitidez da FortLED (o arquivo de origem já é borrado).
- A cor do MP4 foi comparada com o quadro original: diferença média de ~1,5 tom em 255. Os 7.033
  quadros decodificam sem erro.

## Pendências
- [ ] Assistir no telão/projetor do evento antes do dia — Júlio
- [ ] Trilha sonora, se quiser (o vídeo saiu sem áudio) — Júlio
- [ ] FortLED em resolução maior, se o fornecedor mandar
- [ ] Respiro entre o selo e o "WORKSHOP" na abertura, só se o Júlio quiser
- [ ] Achar a pasta do projeto, que saiu da Área de Trabalho (ver [[VÍDEO WORKSHOP LUBE]]) — Júlio
- [x] Corrigir o tempo de gravação na nota do projeto — feito em 2026-10-09
