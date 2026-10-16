---
tipo: projeto
status: ativo
inicio: 2026-10-02
tags: [projeto, video, vinheta, youtube, coffeeplaygames, animacao-3d]
---
# VINHETA CPG

Vinheta (intro) de **6,5 s** do canal de YouTube **CoffeePlayGames (CPG)**: animação 3D com a logo
e os personagens da arte do canal. Feita com o [[Claude]] em 2026-10-02
([[2026-10-02 — Vinheta do canal CoffeePlayGames]]), com o mesmo tipo de motor do
[[VÍDEO WORKSHOP LUBE]].

## O vídeo
- 1920×1080, 60 qps, H.264, 390 quadros, 6,50 s. Duas versões: **com som** (AAC 48 kHz, −14 LUFS,
  padrão do YouTube) e **sem som**.
- **Roteiro "Insira a moeda":** uma moeda $ cai pelo vapor da xícara e entra na fenda entre o C e o P
  (0,80 s). A logo dá boot como um console: o neon desenha o contorno, o controle acende botão por botão
  e o "café" enche as letras (power on em 1,80 s). Depois chegam os heróis, cada um com seu gesto:
  - Mario soca o bloco "?" e solta uma moeda;
  - Sonic chega em bola e pousa a luva no G;
  - Pac-Man come a pastilha de força e assusta os fantasmas;
  - Link desce num feixe de luz e Mega Man se teletransporta;
  - Drácula se materializa na névoa e Kratos irrompe do chão (3,80 s), o que dispara em dominó PS5,
    Xbox, PS, moedas de estrela e Umbrella.

  Às 4,55 s tudo trava na composição da arte original, agora em 3D. Fica parado e legível até 6,30 s
  e escurece até 6,50 s.
- **A logo é 3D de verdade:** foi reconstruída em peças nítidas (C com a alça, P, G, vapor, controle,
  letreiro), extrudada, com chanfro e brilho. A ponta do G, que a luva do Sonic cobria na arte, foi
  redesenhada.
- **Personagens:** recortes 2D da própria arte, limpos e ampliados 2x, num espaço 3D (espessura, luz
  de contorno, sombra, paralaxe). O bloco "?", as moedas, o Pac-Man, os fantasmas e os logos de
  console viraram objetos 3D.
- **Som:** sintetizado do zero (synthwave/arcade, 120 BPM, Ré menor → Ré maior no acorde final), sem
  música nem amostra de terceiros.

## Onde estão as coisas
- Vídeos: `Downloads\Vinheta CoffeePlayGames.mp4` (12,1 MB) e `Downloads\Vinheta CoffeePlayGames (sem som).mp4`
  (11,9 MB), de 2026-10-02 17:16.
- Projeto para refazer: foi entregue em `Área de Trabalho\VINHETA CPG\` (leia o `LEIA-ME.md` de lá). O
  roteiro com todos os tempos está no `STORYBOARD.md`, e a API do motor no `MOTOR.md`.
  **Em 2026-10-09 essa pasta não está mais lá**: na Área de Trabalho só ficaram `BI` e `LOGOS`, e ela não
  foi achada no C:, no `Z:\Marketing` nem na Lixeira. A última mudança na Área de Trabalho foi em
  2026-10-08 08:52. Diferente do vídeo do Workshop, **não sobrou cópia do projeto**: na pasta temporária
  da conversa só ficaram rascunhos e cópias dos dois MP4.
- **O código ainda está no histórico da conversa** do Claude Code:
  `C:\Users\gti.julio.alves\.claude\projects\C--Users-gti-julio-alves-OneDrive---Lube-CEREBRO-DA-LUBE\86d38ff5-77ac-4c21-b9f3-4e6267b37faf.jsonl`
  e a pasta `86d38ff5-77ac-4c21-b9f3-4e6267b37faf\` ao lado (329 MB, com os agentes dos dois workflows).
  Lá está o texto dos arquivos que o Claude escreveu: `STORYBOARD.md`, `MOTOR.md`, `LEIA-ME.md`,
  `tools/render.js`, `tools/som.py`, `tools/recortes.py`, `tools/logo.py`, `web/js/...` e as edições
  feitas depois. Os PNG gerados (recortes e peças da logo) não ficam no histórico; os scripts que os geram,
  sim. Os scripts dos workflows estão em `86d38ff5-77ac-4c21-b9f3-4e6267b37faf\workflows\scripts\`.
  Remontar o projeto a partir daí **não foi testado**. Por padrão o Claude Code apaga históricos parados há
  mais de 30 dias (não há `cleanupPeriodDays` configurado), e este foi mexido por último em 2026-10-05.
- Arte de origem: `Área de Trabalho\VINHETA CPG\src\arte_original.jpg` (1600×900, enviada na conversa).
  Com a pasta fora do lugar, a cópia que restou é a imagem da própria conversa, em
  `AppData\Local\Temp\claude\C--Users-gti-julio-alves-OneDrive---Lube-CEREBRO-DA-LUBE\86d38ff5-77ac-4c21-b9f3-4e6267b37faf\images\1.jpg`.

## Como refazer
No PowerShell, dentro da pasta do projeto, um comando por vez:
- `node tools/render.js video --out out/vinheta_cpg_video.mp4 --crf 14` grava o vídeo (~9 min).
- `python tools/entrega.py --downloads` junta o som, gera a versão sem som, confere e copia para
  Downloads (não sobrescreve).
- `node tools/render.js serve` abre a prévia em http://127.0.0.1:8766/, com barra para navegar.
- `python tools/som.py` refaz o som (~19 s). Depois basta rodar o `entrega.py` de novo, sem regravar o
  vídeo.
- Trocar um personagem por um PNG melhor: ver o §3.4 do `LEIA-ME.md`. O arquivo vai em
  `web/assets/sprites/<id>.png`, no mesmo enquadramento.

## Como foi feito
Em duas etapas, cada parte com revisão independente antes de seguir:
- **Etapa 1:** 3 roteiros e um juiz; logo reconstruída em 3D (passou na 1ª revisão); 19 recortes de
  personagens e ícones (reprovados na 1ª revisão com 11 problemas, aprovados na 2ª); motor WebGL2 3D novo
  (`web/js`, com `primitivas.js`). No motor, **1 unidade = 1 px**, câmera final em [0, 0, 2015,3] e fov 30°.
- **Etapa 2:** `STORYBOARD.md` (roteiro de 6,50 s = 390 quadros a 60 qps, com as medidas da logo e as
  deixas de som); coreografia em módulos (base, abertura, heróis, final); som; revisão em 3 lentes
  (roteiro, direção de arte, técnica quadro a quadro); correções; gravação do MP4.
- **Som** (`tools/som.py`): feito do zero com numpy/scipy, semente fixa, sem amostras; 48 kHz, estéreo,
  24 bits, 95 deixas (`audio/deixas.json`). Sai em `audio/vinheta.wav` a −14,02 LUFS e −1,91 dBTP.
- **Gravação:** o mesmo esquema do [[VÍDEO WORKSHOP LUBE]] (Chrome sem janela → quadros → ffmpeg).
- Desde 2026-10-16 o passo a passo dos vídeos da Lube está na skill [[video-motion]].

## Decisões
- 2026-10-02 (Claude): **não foram baixadas imagens da internet** (seria baixar arquivo com direitos de
  terceiros). Os personagens são recortes da própria arte do canal. Se aparecerem PNGs melhores (fundo
  transparente), é só trocar o arquivo e regravar.
- 2026-10-02 (Claude): dos três roteiros propostos, o juiz escolheu o 3, "Insira a Moeda: o Café que Liga
  o Jogo" (a história da marca: café + games; média 8,4 em beleza, marca, ritmo, viabilidade e
  restrições), com ideias enxertadas dos outros dois: "Ficha Inserida: Impacto de Arcade" (7,0) e
  "Mergulho no Universo CPG" (7,7). Até 2026-10-09 esta nota chamava os dois de "Impacto de arcade" e
  "Mergulho de câmera".
- 2026-10-02 (Claude): duração de **6,50 s**, com a logo parada e legível de 4,55 a 6,30 s. Atende o
  mínimo de 5 a 6 s pedido pelo Júlio.
- 2026-10-02 (Claude): Kratos e Drácula estão cortados pela borda da arte, então ficam presos às bordas da tela e
  o corte nunca aparece. Um teste automático confere isso nos 390 quadros (`node tools/render.js check`).
- 2026-10-02 (Claude): as duas moedas $ da arte tinham marca d'água de banco de imagens. Ela foi removida no
  recorte.
- 2026-10-02 (Claude): o som foi feito sem pedido, porque vinheta costuma ter. Por isso saíram as duas versões.

## Erros e incidentes
- 2026-10-02: a face do card sumia no motor porque o z dela saía ±1e-15 em ponto flutuante, e não 0 exato.
  A revisão 2 do motor ainda deixou isso; o Claude corrigiu com o teste `Math.abs(z) < 1e-6` em
  `web/js/primitivas.js`.
- 2026-10-02: a revisão em 3 lentes achou 30 pontos, 6 médios (flashes virando véu cinza, reflexo de
  lente cortando a logo, linhas da trava por cima dos personagens, moedas apagadas, ponta reta da capa do
  Drácula). Todos corrigidos; a 2ª revisão aprovou.
- 2026-10-02: **o Claude não ouviu o som**, só mediu (volume, pico e ataques). Por isso a pendência de
  ouvir é do Júlio.
- 2026-10-02: tropeços de ferramenta sem efeito no vídeo: leitura errada do resultado da etapa 1, edição
  recusada por arquivo não lido e acentos quebrados no console (resolvido com `PYTHONIOENCODING=utf-8`).

## Pendências
- [ ] Assistir com som (fone e celular) e dizer se o equilíbrio está bom — Júlio
- [ ] Opcional: corrigir 3 detalhes leves que ficaram (ver `LEIA-ME.md` §6):
  - a moeda escura de perfil logo antes da fenda (0,73–0,80 s);
  - os brilhos fracos no pouso das moedas $ (2,65 s e 2,85 s);
  - o Sonic aceso alguns quadros a mais na saída (6,37–6,47 s).
- [ ] Se tiver PNGs melhores dos personagens, mandar para trocar
- [ ] Atenção ao YouTube: personagens e logos de Nintendo, Sega, Sony, Microsoft, Capcom, Konami etc.
      são marcas de terceiros. A decisão de usar é do dono do canal.
- [ ] **Achar a pasta do projeto** (`VINHETA CPG`), que saiu da Área de Trabalho até 2026-10-09 — Júlio.
      Sem ela, nenhum dos comandos de "Como refazer" funciona. Se não aparecer, a saída é remontar o
      código a partir do histórico da conversa (ver "Onde estão as coisas") **antes de ele ser apagado**;
      senão, qualquer ajuste começa do zero.
- [x] Sugestão: com dois vídeos no mesmo esquema (este e o [[VÍDEO WORKSHOP LUBE]]), criar uma skill
      `video-motion` em `Skills/` com o passo a passo (recorte → motor → revisão → MP4) — feita em 2026-10-16:
      [[video-motion]], já com o [[VÍDEO LUBE ONLINE]] como terceiro caso e referência

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em
[[Registro de mudanças]]. Sem repositório Git: o histórico foi compilado em 2026-10-09 a partir das
sessões do Claude e dos arquivos na máquina.

- **2026-10-16** — pendência da skill fechada: [[video-motion]] criada com o passo a passo dos três vídeos e as lições
  desta vinheta (3 roteiros e um juiz, storyboard, recortes revisados antes de animar, versão com e sem som) (Claude,
  a pedido do Júlio) · [[2026-10-15 — Vídeo animado da proposta Lube Online]]
- **2026-10-09** — conferido que a pasta `Área de Trabalho\VINHETA CPG\` não existe mais e que não sobrou
  cópia do projeto; registrado que o código ainda está no histórico da conversa; nomes dos dois roteiros
  não escolhidos corrigidos
- **2026-10-02** — MP4 final entregue em duas versões (com e sem som) em `Downloads`; `LEIA-ME.md` com o
  passo a passo · [[2026-10-02 — Vinheta do canal CoffeePlayGames]]
- **2026-10-02** — revisão em 3 lentes (30 pontos, 6 médios) e correções; 2ª revisão aprovou · [[2026-10-02 — Vinheta do canal CoffeePlayGames]]
- **2026-10-02** — som sintetizado do zero (`tools/som.py`, 120 BPM, Ré menor → Ré maior) · [[2026-10-02 — Vinheta do canal CoffeePlayGames]]
- **2026-10-02** — `STORYBOARD.md` ("Insira a moeda", 6,50 s) e coreografia em módulos · [[2026-10-02 — Vinheta do canal CoffeePlayGames]]
- **2026-10-02** — motor WebGL2 3D novo, com a correção da face do card (`primitivas.js`) · [[2026-10-02 — Vinheta do canal CoffeePlayGames]]
- **2026-10-02** — logo CPG refeita em 3D (ponta do G redesenhada) e 19 recortes de personagens limpos e
  ampliados 2x · [[2026-10-02 — Vinheta do canal CoffeePlayGames]]
- **2026-10-02** — pasta do projeto criada em `Área de Trabalho\VINHETA CPG\` com a arte enviada em
  `src/arte_original.jpg` · [[2026-10-02 — Vinheta do canal CoffeePlayGames]]
