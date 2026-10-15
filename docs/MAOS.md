# Modo Mãos — controlar o Cérebro com gestos pela câmera (especificação, 2026-10-13)

Pedido do Júlio:
> "agora gostaria de uma mudança ousada, gostaria de fazer o sistema captar meus movimentos através da câmera e
> utilizar como uma espécie de mouse, que eu posso selecionar e abrir, umas animações [de partículas] com base na
> movimentação com as mãos, vamos inovar?"

Vale tudo do `CONTRATO.md` e do `ROTINAS.md` (tokens, fontes, ids, regras, reduced motion, 400 px, português claro).

## 0. Onde funciona (restrição real, não opção)
- **claude.ai (artifact publicado): não tem câmera.** A conta do Júlio não tem capability de câmera e o CSP do
  artifact bloqueia o fetch do WASM e do modelo. Lá o botão "Mãos" abre um cartão explicando: "Os gestos usam a
  câmera, e o claude.ai não libera a câmera para páginas publicadas. Abra o arquivo baixado (Cerebro da Lube.html)
  no Chrome ou no Edge." Detectar artifact por `window.claude && typeof window.claude.use === 'function'` (ou
  qualquer `https:` que não seja localhost: tentar e, se recusar, explicar).
- **Arquivo baixado (`file://`) e `http://localhost`:** funciona no Chrome/Edge. A câmera pede permissão do
  navegador. **A imagem nunca sai do computador** (o reconhecimento roda no navegador) — dizer isso na tela.

## 1. Bibliotecas e arquivos (versões exatas)
- `import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs')` — **import dinâmico**,
  só quando a pessoa liga o modo (não carregar nada disso na abertura).
- WASM: `FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm')`.
- Modelo: `GestureRecognizer` com
  `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`
  (8,4 MB, CORS liberado; o navegador guarda em cache). `runningMode:'VIDEO'`, `numHands:2`, `delegate:'GPU'` com
  queda para `'CPU'` se falhar. Ele devolve os 21 pontos de cada mão + o gesto (None, Closed_Fist, Open_Palm,
  Pointing_Up, Thumb_Down, Thumb_Up, Victory, ILoveYou) + qual mão.
- Câmera: `getUserMedia({video:{facingMode:'user', width:{ideal:640}, height:{ideal:480}}, audio:false})`.
  Detectar a cada quadro do vídeo (`requestVideoFrameCallback`, com queda para rAF), no máx. ~30 por segundo;
  pausar com a aba oculta; desligar a câmera (parar as tracks) ao sair do modo.

## 2. Arquivos novos e quem faz
| Arquivo | Dono | O que é |
|---|---|---|
| `js/maos.js` | MOTOR | câmera, MediaPipe, filtros, máquina de gestos, mouse sintético, simulador |
| `js/efeitos-maos.js` | EFEITOS | camada de partículas e cursor, cartão da câmera com o esqueleto, ajuda dos gestos, cartão de ligar |
| `js/app.js`, `index.html`, `css/estilo.css`, `js/robo.js` | INTEGRAÇÃO | botão, ligações, reações do robô, campo da mão nos neurônios |

`app.js` importa `./maos.js` e `./efeitos-maos.js` **só quando o modo é ligado** (import dinâmico), como já faz
com o robô. Nenhum outro arquivo pode quebrar se eles falharem.

## 3. API

### js/maos.js (MOTOR)
```
export async function iniciarMaos(opts) -> Maos     // lança Error com .codigo: 'sem-camera'|'negado'|'em-uso'|'sem-modelo'|'artifact'|'sem-suporte'
  opts = { video:HTMLVideoElement, simular:boolean, onQuadro(q), onGesto(nome, dados), onEstado(estado, detalhe), onProgresso(fase, pct) }
Maos = { pausar(bool), parar(), configurar({sensibilidade, cliquePorEspera:boolean, maoPrincipal:'qualquer'|'direita'|'esquerda'}), estado() }
```
- `q` (a cada quadro): `{ t, maos:[{ lado:'Direita'|'Esquerda', pontos:[{x,y,z}] (21, já em px de TELA, espelhado),
  pontosVideo:[{x,y}] (0..1, espelhado, para o cartão da câmera), cursor:{x,y}, vel:{x,y} (px/s), escala (px),
  gesto, pinca:0..1, pincando:boolean }], principal: índice da mão que comanda o cursor ou -1 }`.
- **Cursor:** ponto médio entre a ponta do polegar (4) e a do indicador (8) (fica parado quando a pinça fecha),
  filtrado com **One Euro** (min cutoff ~1.2, beta ~0.02, ajustável pela sensibilidade). Mapear a **zona ativa**
  central do vídeo (≈ 15%–85% na horizontal, 15%–80% na vertical) para a tela inteira, espelhado, para não precisar
  esticar o braço até a borda.
- **Pinça:** distância 4↔8 dividida pela escala da mão (0↔9). Fecha < 0.33, abre > 0.48 (histerese), com no mínimo
  2 quadros seguidos para confirmar. `pinca` contínuo 0..1 para o efeito.
- **Gestos emitidos** (`onGesto(nome, dados)`), com tempo mínimo e "trava" de 600 ms entre repetições:
  - `mover` — implícito pelo `onQuadro`.
  - `clique` — pinça fecha e abre em < 450 ms sem arrastar mais de ~18 px → `{x,y,alvo}`.
  - `arrasteInicio` / `arraste` (`{dx,dy}`) / `arrasteFim` — pinça segurada e mão andando.
  - `espera` (`{x,y,progresso 0..1}`) e `clique` por espera — só se `cliquePorEspera` (desligado por padrão):
    cursor parado ±12 px por 1,2 s sobre algo clicável.
  - `fechar` — Open_Palm segurada 0,7 s.
  - `deslizar` (`{direcao:'esquerda'|'direita'|'cima'|'baixo'}`) — mão aberta com velocidade > ~1500 px/s em
    linha, por 120–400 ms.
  - `agarrarInicio` / `agarrar` (`{x,y}`) / `agarrarFim` — Closed_Fist.
  - `joinha` — Thumb_Up segurado 0,5 s. `vitoria` — Victory segurado 0,8 s.
  - `entrou` / `saiu` — mão apareceu / sumiu por > 700 ms.
- **Mouse sintético** (o motor faz, para tudo o que já existe funcionar sem mudar):
  - a cada quadro, `pointermove` + `mousemove` (bubbles, `clientX/clientY`, `pointerType:'mouse'`, `isPrimary`)
    no `document.elementFromPoint(cursor)` E em `window` (o robô e a dica escutam isso); classe `.mao-hover` no
    elemento clicável mais próximo debaixo do cursor (`button, a, [role=tab], [role=option], .depto, .rotina,
    .rec, .carta, .wl, input, label, [tabindex]`), tirando do anterior;
  - `clique`: `pointerdown` → `mousedown` → `pointerup` → `mouseup` → `click` no alvo (no canvas do robô/anéis
    também, com as coordenadas, para o raycast funcionar);
  - `arraste` sobre área rolável (leitor, funil, listas, resultados): `scrollBy` suave; sobre o canvas dos anéis:
    `pointerdown` + `pointermove` + `pointerup` (o pan que já existe);
  - nunca disparar nada enquanto não há mão principal.
- **Simulador** (`simular:true`, ligado por `?maos=simular` só em localhost/file): não abre câmera nem MediaPipe;
  gera os 21 pontos de uma mão de mentira a partir do mouse real: mover o mouse = mão; segurar **P** = pinça;
  **A** = mão aberta; **F** = punho; **J** = joinha; **V** = vitória; setas = deslizar; mesma máquina de gestos e
  mesmos eventos. É o que permite testar tudo no navegador do app, que não tem câmera.

### js/efeitos-maos.js (EFEITOS)
```
export function criarEfeitos(opts) -> Efeitos   // opts = { reduzido, cores:{holo, azul, vermelho, ok, rever} lidas dos tokens CSS }
Efeitos = { quadro(q), gesto(nome, dados), estado(estado, detalhe), progresso(fase, pct), mostrarVideo(bool), ajuda(bool), destruir() }
```
- **Camada de partículas** (`<canvas id="maosFx">` em tela cheia, `pointer-events:none`, acima da cena e abaixo
  dos painéis? — **acima de tudo**, porque o cursor precisa aparecer sobre o leitor): rastros saindo das 5 pontas
  dos dedos proporcionais à velocidade (ciano/azul da Lube; polegar e indicador ficam vermelhos quando a pinça fecha),
  brilho aditivo, vida curta, pool fixo de partículas (sem alocar por quadro), limite de ~1500.
- **Cursor holográfico:** anel ciano com mira, que se fecha conforme `pinca`; ponto vermelho no centro quando
  pinçando; anel de progresso no `espera`; some com fade em `saiu`.
- **Animações por gesto:** `clique` = estouro de anel + faíscas; `fechar` = onda de choque que expande a partir da
  palma; `deslizar` = rajada de traços na direção; `joinha` = confete com as cores da Lube (azul, vermelho, branco);
  `vitoria` = dois arcos girando; `agarrar` = partículas sendo puxadas para o punho (como um ímã).
- **Cartão da câmera** (`#maosCam`, canto inferior direito no desktop, 240×180; no celular, pequeno no canto de
  cima): vídeo espelhado escurecido, **esqueleto holográfico** desenhado por cima (ligações da mão, pontas maiores),
  rótulo do gesto atual ("Pinça", "Mão aberta"…), qual mão, quadros por segundo, e botões: **Esconder vídeo**,
  **Ajuda**, **Desligar**. Linha fixa: "A imagem fica só neste computador."
- **Ajuda dos gestos** (`#maosAjuda`): cartão com 7 gestos, cada um com um ícone SVG desenhado em código e uma frase:
  Mover a mão → mexe o cursor · Pinça (polegar + indicador) → abre o que está embaixo · Pinça segurada e arrastar →
  rola o texto / arrasta o mapa · Mão aberta parada → fecha (como Esc) · Mão aberta deslizando para o lado → troca
  de aba / próxima rotina · Punho fechado → segura a cabeça do robô · Joinha → o robô comemora. Aparece sozinho na
  primeira vez (lembrar no localStorage com try/catch).
- **Cartão de ligar** (`#maosLigar`): explica em 2 frases, mostra "A imagem fica só neste computador", botão
  principal vermelho **Ligar câmera**, e o progresso do carregamento ("Abrindo a câmera…", "Carregando o
  reconhecimento de mãos (8 MB, só na primeira vez)…", "Mostre a mão aberta para a câmera"). Erros com frase clara
  por código (negado: "Você não liberou a câmera. Clique no cadeado da barra de endereço e permita a câmera.";
  em-uso: "A câmera está sendo usada por outro programa (Teams, Zoom…). Feche e tente de novo."; sem-camera;
  sem-modelo: "Não consegui baixar o reconhecimento de mãos. Confira a internet."; artifact: o texto do §0).

### Integração (app.js, index.html, css, robo.js)
- **Botão "Mãos"** na barra de cima (ícone de mão em SVG), `aria-pressed`, entre "Recarregar cérebro" e "Menu".
  Ligar abre `#maosLigar`; ligado, o botão fica aceso (ciano) e mostra um pontinho pulsando.
- **Reações do robô:** `entrou` → `surpreso` e depois `feliz` (como se dissesse oi); o robô **olha para o cursor da
  mão** (já vem do pointermove sintético); `agarrar` → a cabeça segue a mão com o dobro da amplitude enquanto o punho
  estiver fechado (`robo.agarrar({x,y}|null)` novo); `joinha` → `feliz` + pulo; `vitoria` → `feliz` + alterna
  Robô/Mapa em anéis; `fechar` → mesma ordem do Esc (leitor → funil → menu → leque → resposta) e o robô pisca;
  `deslizar` esquerda/direita → troca a aba do trilho; com o funil aberto, rotina anterior/próxima; com o leitor
  aberto, cima/baixo rola o texto; `saiu` → o robô volta a olhar em volta.
- **Campo da mão nos neurônios:** `robo.campoMao({x,y,raio,forca}|null)` novo: com o cursor sobre a cúpula, os
  neurônios perto dele brilham e se afastam suavemente (uniforms no shader dos pontos, sem alocar por quadro);
  durante a pinça puxam para o cursor.
- **Classe `.mao-hover`** no CSS com o mesmo visual do `:hover` de cada componente (botões, departamentos, rotinas,
  recentes, cartas, links, abas).
- Desligar (botão, ou aba oculta por > 2 min): para a câmera, apaga as camadas, devolve o mouse normal.
- O modo nunca liga sozinho ao abrir a página (privacidade); só a preferência "ajuda já vista" e
  "esconder vídeo" ficam guardadas.

## 4. Critérios
- Com o simulador, no navegador do app: cursor segue, hover acende, pinça abre nota/rotina/departamento/aba/cartão,
  arraste rola o leitor e o funil, mão aberta fecha na ordem certa, deslizar troca aba e rotina, punho segura a
  cabeça, joinha comemora, partículas bonitas e leves, robô reage. Console limpo.
- Com o MediaPipe de verdade (sem câmera no navegador do app): o import do vision_bundle e o carregamento do
  modelo funcionam (testar criando o GestureRecognizer e chamando `recognizeForVideo` num canvas vazio) e o erro
  "sem câmera" aparece com a frase certa.
- No artifact: o botão mostra o cartão do §0 e nada quebra.
- Nada é carregado do MediaPipe enquanto o modo está desligado; desligar para a câmera de verdade.
- 60 qps com o modo ligado num notebook comum (o reconhecimento roda a ≤30 por segundo); reduced motion: só o
  cursor, sem rastros nem confete.
