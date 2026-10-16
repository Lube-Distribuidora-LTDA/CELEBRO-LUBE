---
tipo: projeto
status: ativo
inicio: 2026-10-01
tags: [projeto, video, workshop, fornecedores, evento]
---
# VÍDEO WORKSHOP LUBE

Vídeo para o telão do evento **Workshop Lube Distribuidora**: as logos dos 23 fornecedores aparecem
uma por vez, com animação de entrada e transição. Feito com o [[Claude]] em 2026-10-01
([[2026-10-01 — Vídeo das logos do Workshop Lube]]).

## O vídeo
- 1920×1080, 60 quadros/s, H.264 (MP4), **1 min 57 s** (7.033 quadros), 68,3 MB, sem áudio.
- Tempos: abertura de **6,0 s** e **4,4 s por logo**.
- **Abertura:** fundo azul-meia-noite da Lube com ouro, selo da Lube, "WORKSHOP" em dourado e
  "Fornecedores parceiros".
- **23 logos**, na ordem dos arquivos 1 a 23 do zip, todas sobre o **mesmo mármore branco**
  (Carrara com veios verde-sálvia e fios de ouro). Cada logo tem sua animação de entrada (foco,
  varredura, giro em perspectiva ou subida) e sai por uma transição de luz (faixa de luz, seda,
  anel de ouro ou clarão). O selo da Lube fica fixo no canto superior direito.
- **Encerramento:** mosaico das 23 logos em placas de porcelana com filete dourado, selo da Lube e
  "Workshop Lube Distribuidora", fade para o preto.

## Onde estão as coisas
- Vídeo: `Downloads\Workshop Lube - Fornecedores.mp4`. Há duas cópias iguais na rede, em
  `Z:\Marketing\Vídeos Fornecedores\` (`Workshop Lube - Fornecedores.mp4` e `(1).mp4`, de 2026-10-01 17:21).
- Projeto para refazer: foi entregue em `Área de Trabalho\WORKSHOP LUBE\` (118,5 MB, com `LEIA-ME.md`).
  **Em 2026-10-09 essa pasta não está mais lá**: na Área de Trabalho só ficaram `BI` e `LOGOS`, e ela não
  foi achada no C:, no `Z:\Marketing` nem na Lixeira. A última mudança na Área de Trabalho foi em
  2026-10-08 08:52. A cópia de trabalho da conversa ainda existe (1,2 GB, sem o `LEIA-ME.md`) na pasta
  temporária do Claude:
  `AppData\Local\Temp\claude\C--Users-gti-julio-alves-OneDrive---Lube-CEREBRO-DA-LUBE\1830ee88-3e1f-4331-9cb4-37e0189e7283\scratchpad\proj`.
  O Windows pode limpar essa pasta a qualquer momento.
- Logos de origem: `Downloads\logos workshop lube.zip` (cartões brancos 3402×1512 com o selo da Lube
  no canto e a faixa quadriculada; o vídeo usa só a logo do fornecedor, recortada).
- Logo oficial da Lube usada: `Downloads\LOGO LUBE.png`.
- Outros arquivos de evento na máquina e na rede, **sem conversa registrada no Claude Code desta máquina**
  (origem a confirmar com o Júlio):
  - `Downloads\Banner_Workshop_Lube_310x100cm` (jpg, pdf e tiff) e `Downloads\Faixa_Workshop_310x100cm.pdf`,
    de 2026-09-24;
  - em `Z:\Marketing\1º WORKSHOPE LUBE\`: a pasta `Claude outputs` (`fotos_em_duvida.jpg` de 2026-10-06 e
    `Montagem_Fornecedores_Workshop_Lube.jpg` de 2026-10-07) e a pasta `Melhores fotos` (95 arquivos,
    2026-10-06);
  - `Z:\Marketing\Reels Evento Lube\` (2026-10-08): motor de vídeo em JavaScript, ffmpeg e node portáteis
    em `_ferramentas`, trilha em `assets\trilha.mp3` e o `Reels_Evento_Lube.mp4` (415 MB).

## Como refazer
No PowerShell, dentro da pasta do projeto, um comando por vez:
- `node tools/render.js video --out out/workshop-lube-fornecedores.mp4` grava o vídeo inteiro em
  **~12 a 14 min** (7.033 quadros a ~0,1 s cada; as duas gravações de 2026-10-01 levaram isso). Até
  2026-10-09 esta nota dizia ~30 min. Com `--from` e `--to` (segundos) grava só um trecho.
- `node tools/render.js serve` abre a prévia em http://127.0.0.1:8765, com barra para navegar.
- `node tools/render.js still --scene 7 --local 1.5,2.5 --sheet` tira quadros de uma cena e junta numa
  prancha (`--cols` e `--cw` montam a grade). Saem em `qa/stills`.
- `python tools/frames.py out/workshop-lube-fornecedores.mp4 NOME t1 t2 t3 t4` tira quadros do MP4 gravado
  para conferir (saem em `qa/video`).
- Trocar a entrada ou a transição de uma logo: tabela `LOGOS` em `web/js/themes/marmore.js`.
- Trocar ou incluir logo: o cartão novo vai em `logos_src/N.png`, a linha dele no `LOGOS` do
  `extract.py`, e depois `python extract.py N`.

## Como foi feito
- **Recorte** (`extract.py`): tira o fundo branco, o selo da Lube do canto e a faixa quadriculada de cada
  cartão, com regras por logo. Casos especiais: Tekbond (faixa azul com TEK branco e BOND preto; o filete
  branco do canto sai só nos pedaços pequenos), Fardin (pontinhos removidos, mantendo a lacuna entre "a" e
  "r"), Beira-Alta (miolos dos "D" de DESDE transparentes, braços dos "E" reforçados). Backups de cada
  rodada em `qa/extract_v1.py.bak` e `qa/extract_v2.py.bak`.
- **Motor** em WebGL (`web/js/engine.js`, com os shaders em `glsl-lib.js`): camadas de fundo, brilho,
  logo com sombra, halo, relevo, reflexo de lente e partículas; 6 entradas e 8 transições. No mármore
  ficaram só 4 transições (faixa de luz, seda, anel de ouro e clarão).
- **Diretor** (`web/js/main.js`): linha do tempo e coreografia. **Tema único** `web/js/themes/marmore.js`,
  com a tabela `LOGOS`. Os temas coloridos (01, 02, 03, 06, 08 e 12) ficaram em `themes/_arquivo/`.
  O `THEME_GUIDE.md` (raiz do projeto, também na cópia de trabalho) explica como o projeto funciona: as
  peças, o mármore único e as entradas `focus`, `wipe`, `wipe0`, `rise` e `flip`. Foi reescrito quando o
  fundo virou o mesmo mármore em todas.
- **Gravação** (`tools/render.js`): Chrome sem janela renderiza quadro a quadro e o ffmpeg monta o MP4
  (H.264, crf 16, cor bt709 para bater com os quadros). Se a GPU derrubar o WebGL, aparece o erro
  `CONTEXTO_PERDIDO` e ele tenta de novo.
- Fontes do Google Fonts: Cinzel, Cormorant Garamond e Montserrat (`web/assets/fonts/`).
- Instalados na máquina pelo pip: `imageio-ffmpeg` (o ffmpeg) e `scipy` (usado no recorte).
- Desde 2026-10-16 o passo a passo dos vídeos da Lube (este, a [[VINHETA CPG]] e o [[VÍDEO LUBE ONLINE]]) está na
  skill [[video-motion]].

## Decisões
- 2026-10-01 (Claude): "Notion" no pedido foi lido como *motion* (animação). O Notion não faz vídeo.
- 2026-10-01 (Júlio): começou com um tema de luxo diferente para cada logo. No meio do caminho o Júlio
  pediu fundo branco em todas, depois confirmou: **o mesmo mármore em todas**. Abertura e
  encerramento ficaram como estavam. Os fundos coloridos foram arquivados no projeto
  (`web/js/themes/_arquivo/`), não apagados.
- 2026-10-01 (Claude): o trabalho dos 21 fundos coloridos foi parado na hora, para não gastar esforço na
  direção errada.
- 2026-10-01 (Claude): o mármore é contínuo entre as cenas: só a logo troca, e quem leva a logo embora é a
  própria transição de luz.
- 2026-10-01 (Claude): logos na ordem dos arquivos 1 a 23 do zip; selo da Lube fixo no canto superior
  direito, como nos cartões.
- 2026-10-01 (Claude): sem música (não foi pedida). Se precisar, dá para pôr uma trilha depois sem
  renderizar o vídeo de novo.
- 2026-10-01 (Claude): o respiro entre o selo e o "WORKSHOP" na abertura não foi mexido, porque o Júlio
  pediu para manter a abertura como estava.
- 2026-10-01 (Claude): recorte das logos com regras por logo. O miolo das letras fica transparente; o branco
  que faz parte da marca fica branco (Mili, Start, Bombril, BIO da Utilar). A Meshiah Vale entra como
  adesivo branco inteiro. O selo da Lube do cartão sai pela forma exata dele, não por retângulo (o
  retângulo cortava o canto da Mili e o da Tekbond).

## Erros e incidentes
- 2026-10-01: o primeiro teste de gravação travava por um erro de sintaxe no JavaScript (sinal de menos
  antes de potência). A prévia no navegador mostrou o erro e ele foi corrigido.
- 2026-10-01: com vários Chromes ao mesmo tempo, a GPU derrubava o WebGL (shader "não compila", sem
  mensagem). O `render.js` passou a detectar isso e tentar de novo.
- 2026-10-01: ao tirar o filete branco da Tekbond, as letras brancas que encostam no topo da faixa saíram
  junto. Corrigido para remover só os pedaços pequenos.
- 2026-10-01: a revisão achou **39 + 16 = 55 defeitos** em duas rodadas (6 revisores nas cenas, 4 nos
  quadros do MP4). Todos foram corrigidos e conferidos no MP4 final. Detalhes em
  [[2026-10-01 — Vídeo das logos do Workshop Lube]].
- 2026-10-01: tropeços de ferramenta sem efeito no vídeo: acentos quebrados no Python do Windows
  (resolvido com `PYTHONIOENCODING=utf-8`), patches que quebraram por aspas e foram refeitos. O código 1
  do `robocopy` na cópia para a Área de Trabalho quer dizer "copiado com sucesso", não erro.

## Pendências
- [ ] Assistir o vídeo inteiro no telão ou projetor do evento antes do dia — Júlio
- [ ] Se quiser trilha sonora, escolher a música (com licença de uso) — Júlio
- [ ] A FortLED veio em baixa resolução no zip; se o fornecedor mandar a logo em vetor ou PNG
      grande, refazer só ela
- [ ] Respiro entre o selo e o "WORKSHOP" na abertura: ficou como estava; ajustar só se o Júlio quiser
- [ ] **Achar a pasta do projeto** (`WORKSHOP LUBE`), que saiu da Área de Trabalho até 2026-10-09, ou
      copiar a cópia de trabalho da pasta temporária para um lugar seguro antes que o Windows a limpe —
      Júlio. Sem ela, não dá para refazer nem ajustar o vídeo.
- [x] Corrigir nesta nota o tempo de gravação (dizia ~30 min; o real é ~12 a 14 min) — feito em 2026-10-09
- [x] Criar a skill `video-motion` com o passo a passo dos vídeos (sugerida na [[VINHETA CPG]]) — feita em
      2026-10-16: [[video-motion]]

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em
[[Registro de mudanças]]. Sem repositório Git: o histórico foi compilado em 2026-10-09 a partir das
sessões do Claude e dos arquivos na máquina.

- **2026-10-16** — skill [[video-motion]] criada com o passo a passo dos três vídeos e as lições deste (recorte com
  regra por logo, um fundo só, duas rodadas de revisão, GPU derrubando o WebGL) (Claude, a pedido do Júlio) ·
  [[2026-10-15 — Vídeo animado da proposta Lube Online]]
- **2026-10-09** — conferido que a pasta `Área de Trabalho\WORKSHOP LUBE\` não existe mais; a nota passou
  a dizer onde ainda há cópia; tempo de gravação corrigido para ~12 a 14 min; registrados o
  `THEME_GUIDE.md` e os outros arquivos de evento sem conversa registrada (banner, faixa, fotos, reels)
- **2026-10-01** — vídeo final entregue em `Downloads\Workshop Lube - Fornecedores.mp4` (1 min 57 s, 68,3 MB)
  e projeto copiado para `Área de Trabalho\WORKSHOP LUBE\`; cópias do MP4 em `Z:\Marketing\Vídeos Fornecedores\`
  · [[2026-10-01 — Vídeo das logos do Workshop Lube]]
- **2026-10-01** — 2ª rodada: 4 revisores nos quadros do MP4 acharam 16 detalhes; Beira-Alta, Meshiah,
  São Gabriel, Fardin e Xamego refeitas; vídeo regravado · [[2026-10-01 — Vídeo das logos do Workshop Lube]]
- **2026-10-01** — 1ª rodada: 6 revisores nas cenas acharam 39 problemas (recorte, borda da varredura,
  sombra antes da logo); corrigidos e 1ª gravação do MP4 · [[2026-10-01 — Vídeo das logos do Workshop Lube]]
- **2026-10-01** — fundo trocado para o mesmo mármore branco em todas as logos (Júlio); fundos coloridos
  arquivados em `themes/_arquivo/`; tema único `marmore.js` · [[2026-10-01 — Vídeo das logos do Workshop Lube]]
- **2026-10-01** — criados o recorte das 23 logos (`extract.py`), o motor WebGL, o diretor e o gravador
  (`render.js`); abertura e encerramento · [[2026-10-01 — Vídeo das logos do Workshop Lube]]
