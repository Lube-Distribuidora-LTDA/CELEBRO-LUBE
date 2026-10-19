# Ouvido e rosto do Jarvis — Chrome que ouve, câmera que libera (especificação, 2026-10-19)

Pedido do Júlio (2026-10-19):
> "o Jarvis não está me respondendo. Aparece como se eu estivesse falando mesmo, mas ele não me responde. Não aparece
> nem o que eu estou falando na caixinha de texto. [...] Quando eu falar com ele, a primeira conversa do dia, ele abre a
> câmera, faz um reconhecimento do meu rosto e animação, e aí ele libera o sistema de Jarvis" — "mostrando aqui a
> câmera, do formato bonitinho, mostrando meu rosto".

O problema (provado pelo Claude principal em 2026-10-19): o reconhecimento de voz do **Edge 155.0.4283.62** (atualizou
em 18/10) devolve resultado **vazio** (`""` a cada 3 s), em português e em inglês, com `start()` ou `start(track)`. O
mesmo áudio no **Chrome 155** com `processLocally = true` (no computador, sem internet) sai perfeito, com parciais.

Decisões:
- **Júlio:** "Edge fala, Chrome ouve". O Jarvis continua no Edge, com a voz Antônio Online (Natural). Um **Chrome
  escondido**, ligado pelo próprio app, reconhece a fala em pt-BR **no computador** e manda o texto ao Edge pelo servidor.
- **Claude principal (rosto):** cadastro do rosto uma vez (várias amostras); na primeira abertura do Jarvis de cada dia
  (fuso `America/Sao_Paulo`) confere se é o Júlio, com prova de vida (piscar). **Quem decide é o servidor**: a página manda
  só o descritor; o servidor compara com o cadastro e guarda "liberado hoje". Enquanto não libera, as rotas que agem
  respondem **423**. Reserva: **Windows Hello** (WebAuthn, autenticador da plataforma, rpID `localhost`) quando o rosto
  falha 3 vezes, a câmera não existe ou é negada; o Hello é cadastrado junto com o rosto. Dado biométrico só em
  `%LOCALAPPDATA%\CerebroLube\rosto\`; nenhum quadro de vídeo é salvo nem sai do computador; a câmera desliga ao
  terminar; botão **"Apagar meu cadastro"**. Ser honesto na tela e no README: é uma trava do Jarvis neste computador, não
  substitui o login do Windows, e um vídeo do Júlio poderia enganar a prova de vida.

Vale tudo de `JARVIS.md`, `CONTRATO.md` e `MAOS.md` (tokens, português claro, reduced motion, 400 px, nada de segredo em
código, nota ou log). Marcas: **[medido]** = conferido nesta máquina hoje (i5-10400, 12 threads, 7,8 GB, Windows 11,
Chrome 155.0.8059.80, Edge 155.0.4283.62, Node 24.19.0); **[fonte]** = código ou documentação publicada; **[desenho]** =
decisão nossa; **[conferir]** = só dá para saber no uso de verdade com o Júlio.

---------------------------------------------------------------------------------------------------
## 1. O que foi provado nesta máquina

Sondas descartáveis em `scratchpad\edge-probe\` (lista no §11). Todo navegador abriu com perfil temporário (apagado no
fim) e foi fechado; o Edge e o Chrome do Júlio não foram tocados. O microfone real foi aberto **duas vezes, por 0,2 s
cada**, só para ler o estado da trilha (nada gravado, medido nem transcrito). A câmera não foi aberta.

### 1.1 Chrome escondido falando com o Node por pipe [medido]
| O quê | Resultado |
|---|---|
| Achar o Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` (155.0.8059.80), também no registro `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe` (padrão) e no `WOW6432Node`. Não existem aqui: `Program Files (x86)`, `%LOCALAPPDATA%\Google\Chrome\Application`, Beta, Canary. |
| `--remote-debugging-pipe` | funciona: `spawn(chrome, args, {stdio: ['ignore','ignore','pipe','pipe','pipe'], windowsHide: true})`; o Node **escreve no fd 3** e **lê no fd 4**; cada mensagem é um JSON terminado em `\0` (igual ao Puppeteer). `Browser.getVersion` responde em **0,4–1,2 s** depois do spawn. |
| Domínios usados | `Browser.getVersion`, `Browser.grantPermissions`, `Browser.close`, `Target.getTargets` (a aba `about:blank` já existe), `Target.attachToTarget {flatten: true}` (o `sessionId` vai em cada comando da aba), `Page.enable`, `Page.navigate` + `Page.loadEventFired` (~0,2 s), `Runtime.enable`, `Runtime.evaluate {awaitPromise, returnByValue, userGesture}`, `Runtime.addBinding` + `Runtime.bindingCalled`. O binding criado **antes** do `Page.navigate` continua valendo na página carregada. |
| `--headless=new` | `document.visibilityState = 'visible'`, `AudioContext` `running` a 48 kHz (com `--autoplay-policy=no-user-gesture-required`), dispositivos listados. Sem janela e sem botão na barra de tarefas. **Escolhido.** |
| Janela fora da tela (`--window-position=-32000,-32000`) | também reconhece, mas aparece na barra de tarefas e precisa de `--disable-backgrounding-occluded-windows` e cia. (sem eles, o Edge fora da tela travou a página: ver §1.3). Fica de reserva. |
| Microfone real no headless | `getUserMedia({audio: {echoCancellation, noiseSuppression, autoGainControl}})` → trilha **`live`**, `sampleRate 48000`, `channelCount 1`, os três ajustes `true`, `latency 0.01`, aberta e fechada em **0,2 s**. Funciona com `--use-fake-ui-for-media-stream` **e** sem ele, com `Browser.grantPermissions {origin, permissions: ['audioCapture']}` (sem a permissão, `permissions.query` diz `prompt`). **Escolhido o `grantPermissions`** (vale só para a nossa origem). |
| O Node morre | fechar o pipe → o Chrome sai em **0,33 s** (stderr: "Connection terminated while reading from pipe"); `taskkill /F` no Node → **0 processos** do Chrome 2,5 s depois. Nada de microfone aberto sem dono. |
| Duas partidas no mesmo perfil | a segunda sai com **código 21** e não responde no pipe (o perfil já tem dono). O perfil tem um `lockfile` na raiz enquanto o Chrome roda; some no `Browser.close` e também depois de `taskkill /PID <pid> /T /F` (que mata a árvore inteira: 0 processos). |
| Recursos | parado: 8–10 processos, **~200–260 MB** privados; ouvindo: até ~315 MB. CPU: **0,4%** de um núcleo parado, **8,6%** ouvindo silêncio, **42%** ouvindo fala contínua. |
| `--disable-background-networking` | não atrapalha a instalação do pacote nem o reconhecimento (o Chrome ainda tenta o GCM e dá erro no stderr: inofensivo). |
| O **Edge** por pipe | **não dá**: o `msedge.exe` aberto pelo Node sai com 0 na hora e o navegador continua em outro processo (ele se relança e perde o pipe). Pela porta (`--remote-debugging-port`) funciona, mas o Edge **fica vivo** quando o Node morre (sobraram 8 processos órfãos na sonda). Só serviu para testar o rosto (§1.3); o ouvido é o Chrome por pipe. |

### 1.2 Reconhecimento no computador (`processLocally`) [medido]
Teste válido = a página toca `fala.wav` (voz Maria do Windows, pt-BR, 8,3 s: "Jarvis, está tudo rodando hoje?" e "Quais
e-mails chegaram na caixa do TI?") pela WebAudio (`MediaStreamDestination`) e entrega a trilha a `rec.start(trilha)`.
| O quê | Resultado |
|---|---|
| Antes de instalar | `SpeechRecognition.available({langs: ['pt-BR'], processLocally: true})` = `'downloadable'` (nuvem: `'available'`). |
| `install()` sem gesto | `NotAllowedError: Requires handling a user gesture when availability is "downloadable"` (com `--use-fake-ui-for-media-stream` passa sem gesto: não contar com isso). Com `Runtime.evaluate {userGesture: true}` funciona. |
| **Só pt-BR não basta** | `install({langs: ['pt-BR']})` → `true` em 6–11 s, 103 MB (pastas `SODA` e `SODALanguagePacks` no perfil), `available` = `'available'`... e **toda sessão termina em `aborted` em 0,2–0,45 s**, com o stderr "Unable to find SODA files on the device". Igual no headless e com janela, mesmo 30 s depois. **Instalando também `en-US` resolve na hora** (até depois). Era esse o `aborted` do "microfone falso" do diagnóstico da manhã. |
| `install({langs: ['pt-BR', 'en-US'], processLocally: true})` | **17–30 s**, **296 MB** no perfil. Depois: transcrição perfeita, `confidence 1`: "Jarvis está tudo rodando hoje" e "quais e-mails chegaram na caixa do ti". |
| Tempos | `onstart` 0,03–0,6 s depois do `start()`; **1º parcial ~1,1 s** depois de a fala começar; parciais a cada ~100–250 ms; final ~0,6 s depois do fim da frase (o final vem com um espaço na frente). |
| Silêncio | sessão contínua: **142 s de silêncio sem `end` nem erro** (só terminou com o nosso `abort`). Não precisa reiniciar por silêncio; o reinício no `onend` continua por garantia. |
| Reiniciar sem gesto | `start()` de novo dentro do `onend`, sem ativação do usuário: **funciona** (`onstart` em 20–30 ms). Não contínua (`continuous = false`): termina a cada final e volta igual. |
| Trilha parada no meio | `track.stop()` com a sessão ligada: **nenhum evento** (fica muda até o `abort`). Tem que vigiar o `ended` da trilha. |
| Trilha do `getUserMedia` | com o pacote completo, `rec.start(trilhaDoGetUserMedia)` reconhece (provado com o dispositivo falso do Chrome, que toca o mesmo `fala.wav`), e passando pela WebAudio (`MediaStreamSource → MediaStreamDestination`) também. Com o microfone **real** não foi testado (não transcrever o Júlio sem ele): [conferir]. |
| Erros vistos | `aborted` (pacote incompleto, ou o nosso `abort`); `language-not-supported` (`es-ES` sem pacote); `pt-PT` sem pacote → `aborted`. |
| Frases de reforço | `SpeechRecognitionPhrase` existe e `rec.phrases = [new SpeechRecognitionPhrase('Jarvis', 3), …]` é aceito no offline pt-BR (sem erro). A melhora não deu para medir (o áudio já saía certo), mas uma das voltas trouxe "charves" no lugar de "Jarvis": vale usar. |

### 1.3 Rosto: as bibliotecas lado a lado [medido]
Edge 155 com perfil temporário (porta de depuração, janela fora da tela **com** `--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding --disable-background-timer-throttling`; sem esses, o `warmup` do Human não terminou: a
página escondida não anda). Sem câmera: imagens de amostra dos próprios pacotes, só números agregados.

| | **@vladmandic/face-api 1.7.15** | **@vladmandic/human 3.3.6** | **@mediapipe/tasks-vision 0.10.14 · FaceLandmarker** |
|---|---|---|---|
| Publicado / licença | 2025-02-05 · MIT | 2025-08-26 · MIT | (já usado no Modo Mãos) · Apache-2.0 |
| Carrega do jsdelivr | sim, tfjs 4.22.0 embutido, backend WebGL2 | sim, tfjs 4.22.0, WebGL2; **`@vladmandic/human-models@3.0.4` não**: o jsdelivr recusa (403, pacote > 150 MB) — os modelos vêm de `human@3.3.6/models/` | sim; modelo no `storage.googleapis.com` |
| Descritor | **128 números**, norma 1,39–1,51, valores −0,43 a 0,45 | 1024 números (faceres) | não tem (não identifica pessoa) |
| Pessoas diferentes (22 rostos, 231 pares) | distância euclidiana mín. **0,47**, p05 0,57, mediana 0,71 | semelhança máx. **0,76**, p95 0,54; ≥ 0,5: **32/231** (14%) | — |
| A mesma foto variada (espelhada, 70%, mais escura) | mediana 0,14, máx. **0,40** | mín. **0,67**, mediana 0,92 | — |
| Separação | **tem folga** (0,40 contra 0,47) | **se sobrepõe** (0,67 contra 0,76) | — |
| Pontos do rosto | 68 | 478 (malha + íris) | **478** + **52 blendshapes** (`eyeBlinkLeft/Right`) + matriz 4×4 da cabeça |
| Tempo por quadro 640 px | detector leve + 68 pontos **52 ms**; detector SSD + 68 pontos + descritor **185 ms** | só malha **230 ms**; tudo 259 ms (warmup 6,9 s) | **CPU 26–30 ms**; GPU 21 ms mas **0 rostos** (VIDEO e IMAGE) neste Edge |
| Tamanho | biblioteca 1,3 MB (329 KB transferidos); modelos: SSD 5,4 MB, 68 pontos 0,35 MB (0,29 transferidos), reconhecimento 6,3 MB (3,9 transferidos) | biblioteca 2 MB (436 KB transferidos); 6 modelos ~12,8 MB (~11 transferidos) | bundle 40 KB; WASM ~9,4 MB (o mesmo do Modo Mãos); modelo 3,76 MB |

O "Human" também foi medido com a base de amostra do próprio demo (`faces.json`, 40 descritores, 36 pessoas): mesma
pessoa mediana 0,32; pessoas diferentes p95 0,45 e máx. 0,90. Os números do Human confirmam: o descritor dele não
serve para trava.

**Escolha [desenho]:** **MediaPipe FaceLandmarker** no laço ao vivo (rosto, malha de 478 pontos para a animação,
piscar pelos blendshapes, direção da cabeça) **+ face-api** só para o **descritor de 128 números**, em 3 quadros
escolhidos. Os dois têm licença livre, versão fixa no jsdelivr e rodam aqui. O Human fica de fora.

### 1.4 Windows Hello [medido]
- Edge 155: `PublicKeyCredential` existe; `isUserVerifyingPlatformAuthenticatorAvailable()` = **`false`**;
  `getClientCapabilities()` traz `userVerifyingPlatformAuthenticator: false`, `passkeyPlatformAuthenticator: true`,
  `hybridTransport: true`; o Edge já tem `PublicKeyCredential.parseCreationOptionsFromJSON`,
  `parseRequestOptionsFromJSON` e `toJSON`.
- `dsregcmd /status`: `DomainJoined: YES`, **`NgcSet: NO`** — **o Júlio não tem PIN do Windows Hello nesta conta.** Sem
  ele não há autenticador da plataforma, e a reserva não funciona até ele criar o PIN em **Configurações › Contas ›
  Opções de entrada › PIN (Windows Hello)**. Não há política `PassportForWork` no registro (o domínio não parece
  proibir) [conferir].
- `@simplewebauthn/server` **14.0.3** (npm, 2026-09-25, MIT, Node ≥ 20, 10 dependências `@peculiar/*`,
  `@hexagon/base64`, `@levischuck/tiny-cbor`, `reflect-metadata`) e `@simplewebauthn/browser` **14.0.0** (2026-09-02,
  MIT; `https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@14.0.0/+esm` responde 200, 13,6 KB, 4 KB transferidos; expõe
  `startRegistration`, `startAuthentication`, `platformAuthenticatorIsAvailable`, `browserSupportsWebAuthn`). Mesma
  versão maior nos dois lados. Cerimônia real não foi feita (precisa do Júlio).

### 1.5 URLs conferidas (todas 200, `Access-Control-Allow-Origin: *`) [medido]
| URL | Transferido | Cache |
|---|---|---|
| `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs` | 40 KB | 1 ano, imutável |
| `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm` (pasta; o Modo Mãos já usa) | ~9,4 MB | 1 ano |
| `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task` | 3,76 MB | 1 h (arquivo de 2023-05-03; buscar com `cache: 'force-cache'`, como o `maos.js`) |
| `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.esm.js` | 329 KB (1,3 MB) | 1 ano |
| `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/` + `ssd_mobilenetv1_model-weights_manifest.json`/`ssd_mobilenetv1_model.bin`, `face_landmark_68_model-…`, `face_recognition_model-…` | arquivos de 5,4 + 0,35 + 6,3 MB | 1 ano, imutável |
| `https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@14.0.0/+esm` | 4 KB (13,6 KB) | 1 ano, imutável |

Primeira vez: até ~25 MB no Edge do Júlio (o WASM já pode estar em cache pelo Modo Mãos). Depois, do cache.

---------------------------------------------------------------------------------------------------
## 2. Arquitetura

```
 Edge (janela de app, http://localhost:8790)      Node (servidor.js, 127.0.0.1:8790)           Chrome escondido (headless)
 ┌──────────────────────────────────┐  POST /api/ouvido/*  ┌──────────────────────────────┐ pipe fd3/fd4 ┌──────────────────────────────┐
 │ jarvis.js                        │ ───────────────────▶ │ ouvido.js (A)  CDP por pipe   │ ───────────▶ │ ouvido.html (A)              │
 │  ├ ouvido-remoto.js (B)          │ ◀─ SSE /api/ouvido/  │  ligar = 423 se travado       │ ◀─ binding ─ │  getUserMedia (o microfone)  │
 │  │   texto + nível do microfone  │      eventos         │                              │              │  SpeechRecognition offline   │
 │  ├ rosto.js (D) câmera, MediaPipe│ ── POST /api/rosto/* │ rosto.js (C)  decide, guarda  │              │  pt-BR + en-US (~296 MB)     │
 │  │   + face-api → descritor      │ ───────────────────▶ │  "liberado hoje", WebAuthn    │              │  perfil: %LOCALAPPDATA%\     │
 │  └ voz: speechSynthesis (Antônio)│                      │ cerebro.js: turno = 423 se    │              │   CerebroLube\ouvido-chrome  │
 └──────────────────────────────────┘                      │  travado                      │              └──────────────────────────────┘
                                                           │ dados: %LOCALAPPDATA%\        │
                                                           │   CerebroLube\rosto\          │
                                                           └──────────────────────────────┘
```

- **Um microfone só:** quem abre o microfone é o Chrome escondido. O Edge **não** abre mais o microfone: a onda do HUD e o
  medidor vêm do Chrome pelo SSE (evento `nivel`, 20 por segundo). O Windows mostra "Google Chrome está usando o
  microfone" na bandeja: dizer isso na tela de ligar o microfone.
- **Eco:** o cancelador de eco do Chrome não ouve a voz do Jarvis (quem toca é o Edge). O filtro de eco por texto do
  `jarvis.js` continua sendo a defesa; o fone de ouvido continua recomendado.
- **Sem internet:** o ouvido funciona (depois da primeira instalação). A voz Antônio Online e o Claude não.
- **O link do claude.ai não muda:** sem servidor, sem câmera, sem trava. `ouvido-remoto.js` e `rosto.js` só carregam em
  `localhost` com a meta `cerebro-token`. `web/ouvido.html` e `web/css/rosto.css` **não** vão para o artifact
  (CONTRATO §1: "Não publicar qualquer outro arquivo").

### 2.1 Pastas de dados (fora do repositório e do OneDrive)
| Pasta | O que guarda | Quem |
|---|---|---|
| `%LOCALAPPDATA%\CerebroLube\ouvido-chrome\` | o perfil do Chrome escondido, com o pacote de voz (~296 MB, baixado uma vez) | A |
| `%LOCALAPPDATA%\CerebroLube\rosto\cadastro.json` | as amostras do rosto (descritores de 128 números) — **dado biométrico** | C |
| `%LOCALAPPDATA%\CerebroLube\rosto\hello.json` | a credencial do Windows Hello (id, chave **pública**, contador) | C |
| `%LOCALAPPDATA%\CerebroLube\rosto\estado.json` | `{dia, metodo, em}` do "liberado hoje" e o contador de falhas | C |

`%LOCALAPPDATA%` vem de `process.env.LOCALAPPDATA` (reserva: `os.homedir()\AppData\Local`). Nada disso vai para log,
vault, OneDrive ou Git. Teste usa pasta temporária (`os.tmpdir()`), nunca as de verdade.

---------------------------------------------------------------------------------------------------
## 3. Parte A — `servidor/ouvido.js` + `web/ouvido.html` (+ `servidor/teste/testar-ouvido.js`)

### 3.1 `servidor/ouvido.js` (ES module, sem dependência nova)
```js
export const PERFIL_PADRAO;   // <LOCALAPPDATA>\CerebroLube\ouvido-chrome
export function acharChrome(): string | null;
export class ErroOuvido extends Error { codigo; status }   // status HTTP para a rota
export function criarOuvidoChrome({
  urlPagina = 'http://localhost:8790/ouvido.html',
  origem = 'http://localhost:8790',            // para o Browser.grantPermissions
  perfil = PERFIL_PADRAO,
  chrome = acharChrome(),
  podeLigar = () => true,                      // a integração passa () => rosto.liberado()
  idiomas = ['pt-BR', 'en-US'],                // en-US é obrigatório (§1.2)
  frases = FRASES_PADRAO,                      // [['Jarvis', 3], ['Lube', 2], …]
  ociosoMs = 10 * 60_000,                      // fecha o Chrome depois de 10 min sem uso
  permitirTeste = false,                       // só o testar-ouvido.js liga: aceita {teste:{arquivo}} no ligar
  log = () => {},
}) → {
  preparar(): Promise<EstadoOuvido>,          // abre o Chrome, carrega a página, instala o pacote se faltar; NÃO abre o microfone
  ligar({ aba, lang = 'pt-BR', teste }): Promise<{ ok: true, ger }>,   // lança ErroOuvido
  pausar({ aba }): Promise<{ ok: true, ignorado?: true }>,
  estado(): EstadoOuvido,
  tratar(ctx): Promise<boolean>,              // rotas /api/ouvido/* (§3.3); true se a rota era dele
  desligar(): Promise<void>,                  // fecha o Chrome (Browser.close; se não sair em 3 s, taskkill /T /F)
}
// EstadoOuvido = { ok: true, estado, pacote, ger, dono, erro? }
//   estado: 'desligado'|'abrindo'|'instalando'|'pronto'|'iniciando'|'ouvindo'|'sem-chrome'|'caiu'
//   pacote: 'available'|'downloadable'|'downloading'|'unavailable'|null   (o pior entre pt-BR e en-US)
//   dono: id da aba que ligou, ou null
// ctx = { req, res, url, metodo, lerCorpoJson, json, erro }   (as funções do servidor.js, passadas pela integração)
```

**Achar o Chrome (`acharChrome`), nesta ordem, o primeiro que existir:** valor padrão de
`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe` e de `HKCU\…\App Paths\chrome.exe`
(`reg query "<chave>" /ve` por `execFile`, sem shell); `%ProgramFiles%\Google\Chrome\Application\chrome.exe`;
`%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe`; `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`.
Guardar o resultado; refazer se o arquivo sumir (o Chrome atualizou ou foi desinstalado). Nada achado = `sem-chrome`.

**Partida (`preparar`)** [medido em §1.1]:
1. Se `<perfil>\lockfile` existe, há um Chrome velho com o perfil: matar pela linha de comando e esperar 1 s —
   `execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*CerebroLube\\ouvido-chrome*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"])`
   (só `chrome.exe` e só o nosso perfil: o Chrome do Júlio nunca é tocado).
2. `spawn(chrome, FLAGS, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], windowsHide: true })`, com
   ```
   --headless=new  --remote-debugging-pipe  --user-data-dir=<perfil>
   --no-first-run  --no-default-browser-check  --disable-sync  --disable-extensions  --disable-default-apps
   --disable-background-networking  --autoplay-policy=no-user-gesture-required  about:blank
   ```
   Nunca `--use-fake-ui-for-media-stream` (libera tudo para qualquer origem). stderr: guardar só as últimas 20 linhas em
   memória, para o log de queda (são ruído do Chrome: GCM, atualizador).
3. Saiu com **código 21** antes de responder → passo 1 e tentar **uma** vez mais.
4. `Browser.getVersion` (prazo 10 s) → `Browser.grantPermissions {origin, permissions: ['audioCapture']}` (a cada
   partida: não fica gravada) → `Target.getTargets` (aba `page`; se não houver, `Target.createTarget {url: 'about:blank'}`)
   → `Target.attachToTarget {targetId, flatten: true}` → `Page.enable`, `Runtime.enable`,
   `Runtime.addBinding {name: 'cerebroOuvido'}` → `Page.navigate {url: urlPagina}` e esperar `Page.loadEventFired` (10 s).
5. `Runtime.evaluate('ouvido.disponivel()')` → `{ 'pt-BR': '…', 'en-US': '…' }`. Algum diferente de `'available'` →
   estado `instalando` (avisar no SSE) → `Runtime.evaluate('ouvido.instalar(["pt-BR","en-US"])', {userGesture: true,
   awaitPromise: true, timeout: 120000})` → conferir de novo → `pronto`, ou erro `pacote-falhou`. A cada `preparar`
   confere de novo (o Chrome pode apagar o pacote sem uso; se apagar, reinstala sozinho).

**Transporte CDP:** `ler.setEncoding('utf8')` (para não partir caractere ao meio), acumular e cortar no `\0`; `id`
crescente; mapa de pendentes com prazo por comando (10 s; `instalar` 120 s; `ligar` 15 s); erro de comando rejeita com a
`message` do CDP (só para o log, nunca para a tela). Eventos: `Runtime.bindingCalled` com `name === 'cerebroOuvido'`
(§3.2); `Inspector.targetCrashed` / `Target.targetCrashed` → recarregar a página (`Page.reload`) e religar se havia
dono; `Target.detachedFromTarget` → anexar de novo; `exit` do processo → estado `caiu`, rejeitar os pendentes, e, se
havia dono, partir de novo com recuo 1 s → 5 s → 30 s; 3 quedas em 5 min = para e manda `erro {codigo: 'caiu'}`.

**Ligar e pausar:**
- `ligar({aba})`: `podeLigar()` falso → `ErroOuvido('trava', 423)`; sem Chrome → `('sem-chrome', 503)`; senão
  `await preparar()` (pode levar o tempo da instalação: o SSE mostra `instalando`), `ger++`, `dono = aba`,
  `Runtime.evaluate('ouvido.ligar(<json>)', {userGesture: true})` com `{lang, ger, frases}` (e `teste` só se
  `permitirTeste`). A página responde `{ok: true}` ou `{ok: false, codigo}` → `ErroOuvido(codigo, 409)`.
- Outra aba ligou depois: a nova vira a dona (a última vence); a velha recebe `estado {estado: 'parado', motivo: 'outra-aba'}`.
- `pausar({aba})`: se `aba` não é a dona, `{ok: true, ignorado: true}`; senão `ouvido.pausar()` na página e `dono = null`.
- **O SSE da dona caiu** (aba fechada, F5, Edge travou) → pausar depois de 2 s se ela não voltar. É a garantia de que o
  microfone fecha quando a página some.
- Sem dono e sem SSE por `ociosoMs` → `desligar()` (libera ~250 MB). `desligar()` também no `SIGINT`/`SIGTERM` do
  servidor (a integração chama).

**Eventos da página → SSE da dona.** Conferir o formato (objeto, `tipo` conhecido, textos ≤ 2.000 caracteres) e
descartar `ger` velho. **Nunca logar texto falado**: o log só leva estado e código de erro.

### 3.2 `web/ouvido.html` (a página do Chrome escondido)
- HTML mínimo, um `<script>` inline, **nenhum recurso de fora**. `<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:">`.
- Fala com o Node só pelo binding: `const enviar = (ev) => { try { window.cerebroOuvido(JSON.stringify(ev)); } catch {} };`
  (sem o binding — aberta à mão no navegador — não faz nada).
- `window.ouvido = { disponivel(), instalar(langs), ligar(opcoes), pausar(), estado() }`:
  - `disponivel()` → `{ 'pt-BR': await SR.available({langs: ['pt-BR'], processLocally: true}), 'en-US': … }`.
  - `instalar(langs)` → `await SR.install({langs, processLocally: true})` → `{ok: true}` ou `{ok: false, codigo: 'pacote-falhou'}`.
  - `ligar({lang, ger, frases, teste})`:
    1. `getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}})` — erros:
       `NotAllowedError`/`SecurityError` → `negado` (no Windows: "aplicativos da área de trabalho" sem acesso ao
       microfone); `NotFoundError`/`OverconstrainedError` → `sem-microfone`; `NotReadableError` → `em-uso`.
       Com `teste.arquivo` (e `location.search` com `teste=1`): no lugar do microfone, `fetch` do arquivo da mesma origem →
       `decodeAudioData` → `BufferSource` → `MediaStreamDestination` (como a sonda).
    2. `AudioContext` + `AnalyserNode` (`fftSize 512`, `smoothingTimeConstant .6`) na trilha: 64 bandas de 80 Hz a ~6 kHz e o
       volume em dB — **a mesma conta do `nivel()` do `criarOuvido` do `jarvis.js`** — enviados como
       `{tipo: 'nivel', b: <base64 de 64 bytes 0–255>, db, ger}` a cada 50 ms enquanto ouve.
    3. `new SpeechRecognition()` (sem prefixo no Chrome 155): `lang`, `continuous = true`, `interimResults = true`,
       `maxAlternatives = 1`, `processLocally = true`, `phrases = frases.map(([t, b]) => new SpeechRecognitionPhrase(t, b))`
       (em `try`: se o Chrome recusar, segue sem). `rec.start(trilha)`.
    4. `onresult` → a **mesma agregação** do `criarOuvido`: de `e.resultIndex` ao fim, finais em `final`, parciais em
       `parcial` → `{tipo: 'resultado', final, parcial, ger}` (o Edge apara os espaços).
    5. `onstart` → `{tipo: 'estado', estado: 'ouvindo', ger}`; `onspeechstart`/`onspeechend` → `{tipo: 'fala', fase: 'inicio'|'fim', ger}`.
    6. `onerror`: `no-speech`, `aborted` → reinicia calado; `audio-capture` → reabrir o microfone; `not-allowed` →
       `negado` e para; `language-not-supported` → `pacote-falhou` (o Node reinstala no próximo `preparar`); outro →
       `{tipo: 'erro', codigo, ger}`.
    7. `onend` com o ouvido ligado → `start()` de novo em 150 ms, **num objeto novo**; recuo 0,5 → 1 → 2 → 4 s só se as
       sessões morrem em menos de 1 s em sequência (zera com resultado). Duas mortes rápidas seguidas com `aborted` →
       trocar a trilha pela versão WebAudio (`MediaStreamSource → MediaStreamDestination`, também provada); se ainda
       morrer, `start()` sem trilha (não provado: último recurso).
    8. Vigias: `track.onended` e `navigator.mediaDevices.ondevicechange` → reabrir o microfone (até 3 vezes, 1 s entre
       elas) e mandar `{tipo: 'erro', codigo: 'audio-capture'}` se não voltar; nível acima de −38 dBFS por ≥ 1,5 s
       somados em 6 s sem nenhum `onresult` → `abort()` e começar de novo (no máximo uma vez a cada 20 s).
  - `pausar()` → ouvido desligado, `rec.abort()`, parar as trilhas, fechar o `AudioContext` →
    `{tipo: 'estado', estado: 'parado', ger}`.

### 3.3 Rotas (todas com `x-cerebro-token`, JSON, mesmas travas de Host/Origin do servidor)
| Rota | Entrada | Saída | Códigos |
|---|---|---|---|
| `POST /api/ouvido/preparar` | `{}` | `EstadoOuvido` | 200; 503 `sem-chrome` |
| `POST /api/ouvido/ligar` | `{aba, lang?: 'pt-BR'}` | `{ok: true, ger}` | 200; **423 `trava`**; 503 `sem-chrome`; 409 `<codigo da página>` (`negado`, `sem-microfone`, `em-uso`, `pacote-falhou`); 504 `prazo` |
| `POST /api/ouvido/pausar` | `{aba}` | `{ok: true, ignorado?: true}` | 200 |
| `GET /api/ouvido/estado` | — | `EstadoOuvido` | 200 |
| `GET /api/ouvido/eventos?aba=<id>` | — | SSE (abaixo) | 200; 400 sem `aba` |

`aba`: 4–40 caracteres `[A-Za-z0-9_-]` (o `ABA` do `jarvis.js` já é assim). Erro no corpo igual ao resto do servidor:
`{erro: '<codigo>', mensagem: '<português>'}`.

Eventos do SSE (`event:` / `data:` JSON, `: ping` a cada 15 s):
| Evento | Dados |
|---|---|
| `estado` | `{estado: 'abrindo'\|'instalando'\|'pronto'\|'iniciando'\|'ouvindo'\|'parado'\|'caiu', ger, motivo?}` |
| `resultado` | `{final, parcial, ger}` |
| `nivel` | `{b, db, ger}` — `b` = 64 bytes em base64, 20 por segundo |
| `fala` | `{fase: 'inicio'\|'fim', ger}` |
| `erro` | `{codigo, mensagem, ger}` |

### 3.4 Teste (`servidor/teste/testar-ouvido.js`; nunca abre o microfone de verdade)
1. `acharChrome()` acha o executável (sem Chrome: avisa e sai com 0).
2. Gera `fala.wav` em `os.tmpdir()` com a voz do Windows (`powershell`, `Add-Type -AssemblyName System.Speech`,
   `SpeechSynthesizer` com a voz pt-BR, `SetOutputToWaveFile`), "Jarvis, está tudo rodando hoje?". Sem voz pt-BR: pula.
   **Áudio nenhum vai para o repositório.**
3. Servidor HTTP próprio do teste em `127.0.0.1:<porta livre>` servindo `web/ouvido.html` e o `.wav`.
4. `criarOuvidoChrome({urlPagina: 'http://localhost:<porta>/ouvido.html?teste=1', origem, perfil: <perfil de teste>,
   permitirTeste: true})`. Perfil de teste: `%LOCALAPPDATA%\CerebroLube\ouvido-chrome-teste` (fica, para não baixar
   296 MB toda vez; `OUVIDO_PERFIL_LIMPO=1` apaga antes).
5. Confere: `preparar()` → `pacote: 'available'`; `ligar({aba: 't', teste: {arquivo: '/fala.wav'}})` → um `resultado` com
   `final` contendo "rodando" em ≤ 15 s; nenhum `resultado` com `ger` velho depois de `pausar`; `podeLigar: () => false` →
   423; segunda partida no mesmo perfil (código 21) tratada; depois de `desligar()`, 0 `chrome.exe` com o perfil de teste;
   o `log` recebido não contém o texto falado.

---------------------------------------------------------------------------------------------------
## 4. Parte B — `web/js/ouvido-remoto.js` (+ `servidor/teste/testar-ouvido-remoto.js`)

O ouvido do Edge que, por fora, é **igual ao `criarOuvido` do `jarvis.js`**: a integração troca um pelo outro sem mexer no
resto.
```js
export function criarOuvidoRemoto(h, sons, { token, aba, base = '' } = {}) → O
// h = { parcial(texto), final(texto), estado('ouvindo'|'parado'), erro(codigo), aviso?(codigo, dados) }
// O = { suportado, ativo, ouvindo, remoto: true,
//       ligar(): Promise<void>  (lança Error com .codigo), pausar(): void,
//       nivel(): { bandas: Float32Array(64), db } | null, destruir(): void,
//       preparar(): Promise<EstadoOuvido|null>, estadoRemoto(): string }
export function analisarSse(bloco): { evento, dados } | null   // para o teste
```
- Importável no Node (nada de `window`/`document` no topo do módulo): o teste roda sem navegador.
- **SSE com cabeçalho:** `EventSource` não manda `x-cerebro-token`, então `fetch(base + '/api/ouvido/eventos?aba=…',
  {headers: {'x-cerebro-token': token, accept: 'text/event-stream'}, cache: 'no-store', signal})` e leitura do `body`
  (o mesmo parser de blocos do `criarCerebroLocal`, copiado aqui, não importado). Reconectar com recuo 0,5 → 1 → 2 → 5 s
  enquanto `ativo`; 401 → `h.erro('reiniciado')` e para.
- `ligar()`: abre o SSE **antes** (nenhum evento se perde), depois `POST /api/ouvido/ligar {aba}` (prazo 150 s: a
  primeira vez instala o pacote). 423 → `throw {codigo: 'trava'}`; 503 → `sem-chrome` (e `suportado = false`); 409 → o
  `codigo` da resposta; rede → `erro`. Enquanto o SSE diz `instalando`: `h.aviso('instalando')`.
- `pausar()`: `ativo = false`, `POST /api/ouvido/pausar {aba}` com `keepalive: true` (vale no `pagehide`), fecha o SSE.
- Eventos: `resultado` → `if (final.trim()) h.final(final.trim()); h.parcial(parcial.trim())` (igual ao `onresult`
  atual); `estado` → `ouvindo`/`parado` em `O.ouvindo` e `h.estado(...)`; `caiu` → `h.erro('caiu')`; `erro` →
  `h.erro(codigo)`; `nivel` → decodificar o base64 em `Float32Array(64)` (÷ 255) e guardar; `nivel()` devolve o último
  (o mesmo objeto, sem alocar; `null` se passou de 300 ms sem nível). `ger` diferente do último `ligar` = descartar.
- `sons` fica na assinatura por compatibilidade (o remoto não precisa: não abre microfone no Edge).
- Teste: servidor HTTP falso no Node que imita as rotas e o SSE (resultado, nível, estado, erro, 423, 401, queda e volta
  do SSE); confere a ordem `final` → `parcial`, o descarte de `ger` velho, o `nivel()`, o `keepalive` e que o `pausar`
  chega.

---------------------------------------------------------------------------------------------------
## 5. Parte C — `servidor/rosto.js` (+ `servidor/teste/testar-rosto.js`; dependência `@simplewebauthn/server@14.0.3`)

C é a única parte que mexe em `servidor/package.json` e `package-lock.json` (`npm install @simplewebauthn/server@14.0.3
--save-exact`). Pode importar `FUSO` do `util.js` (só leitura).

### 5.1 Exportações
```js
export const PASTA_PADRAO;                     // <LOCALAPPDATA>\CerebroLube\rosto
export const DIMENSAO = 128, LIMIAR = 0.45, MIN_AMOSTRAS = 5, MAX_AMOSTRAS = 12, FALHAS_ATE_HELLO = 3;
export function distancia(a, b): number;       // euclidiana
export function conferirDescritores(consultas, amostras, limiar = LIMIAR): { confere, distancia, distancias };
export function avaliarCadastro(descritores): { ok, amostras, dispersao: { max, mediana }, motivo? };
export function diaSP(data = new Date()): string;   // 'AAAA-MM-DD' em America/Sao_Paulo
export function criarRosto({
  pasta = PASTA_PADRAO, rpID = 'localhost', origem = 'http://localhost:8790', rpNome = 'Cérebro da Lube',
  usuario = { nome: 'julio', exibicao: 'Júlio' },
  agora = () => new Date(), webauthn /* padrão: import('@simplewebauthn/server'); o teste injeta um falso */,
  travaAberta = false,                         // SÓ teste/preview: libera tudo e avisa no log
  log = () => {},
}) → {
  liberado(): boolean,
  estado(): EstadoRosto,
  exigirLiberado(res, erro): boolean,          // false = já respondeu 423
  tratar(ctx): Promise<boolean>,               // rotas /api/rosto/* (§5.4)
}
// EstadoRosto = { ok: true, liberado, dia, metodo?: 'rosto'|'hello'|'cadastro', em?,
//                 cadastro: { rosto: bool, amostras, criado_em? }, hello: { cadastrado: bool },
//                 tentativas_restantes, bloqueado_ate? }
```

### 5.2 A conta (o navegador manda; o servidor decide) [fonte: `faceapi.euclideanDistance`; limiar: §1.3]
```
distancia(a, b) = sqrt( Σ_{i=0..127} (a[i] − b[i])² )               // igual ao faceapi.euclideanDistance
melhor(q)       = min_k distancia(q, amostra_k)                     // a amostra do cadastro mais parecida
decisão         = mediana( melhor(q1), melhor(q2), melhor(q3) ) ≤ LIMIAR   →   confere
```
- **LIMIAR = 0,45.** Na amostra (§1.3): nenhum par de pessoas diferentes abaixo de 0,45 (0/231; 2/231 abaixo de 0,50;
  18/231 abaixo do 0,6 "clássico" do dlib, que é frouxo demais para uma trava); a mesma foto variada chegou a 0,40.
  Fotos diferentes da mesma pessoa costumam ficar entre 0,3 e 0,5: por isso várias amostras no cadastro (o mínimo entre
  elas) e a mediana de 3 quadros. [conferir] no PC do Júlio: a tela de teste (`?debug`) mostra a distância.
- **Validação da entrada** (400 se falhar): 3 a 5 consultas; cada uma com exatamente 128 números finitos, `|x| ≤ 1` e
  norma entre 1,0 e 2,0 (medido 1,39–1,51).
- **Os 3 quadros são de verdade** (403 `quadros`): entre eles, distância mínima ≥ 0,002 (o mesmo vetor três vezes =
  repetição) e máxima ≤ 0,40 (três pessoas diferentes não).
- **Prova de vida** (403 `prova-de-vida`; é fraca, a de verdade roda no navegador): `prova = {piscadas: [{ini, fim}],
  quadros, fps}` em ms desde que a página recebeu o desafio; aceitar se o número de piscadas é `n` ou `n + 1` (`n` do
  desafio), cada uma dura 50–600 ms, todas dentro dos 60 s do desafio, `fps ≥ 8`.

### 5.3 Cadastro, "liberado hoje" e travas
- **Cadastro** (`POST /api/rosto/cadastro {descritores}`): 5 a 12 descritores (mesma validação). `avaliarCadastro`: para
  cada amostra, a mediana da distância às outras; sai a que passar de 0,40; precisa sobrar ≥ 5 (senão 400 `amostras`:
  "Fique de frente, com boa luz, e tente de novo."). Grava
  `{versao: 1, modelo: 'face-api@1.7.15/face_recognition_model', dimensao: 128, limiar: 0.45, criado_em, amostras,
  dispersao}` e já deixa **liberado hoje** (`metodo: 'cadastro'`).
  Permitido se **ainda não há cadastro** (o primeiro é de confiança: dizer "faça você mesmo, sozinho na frente da
  câmera") **ou** se já está liberado hoje (recadastrar). Senão 409 `cadastro-existe`.
- **Hello:** cadastrar é permitido nas mesmas condições (sem nenhum cadastro, ou liberado hoje). Primeiro uso **sem
  câmera**: o Hello sozinho é o cadastro de confiança e libera o dia (`metodo: 'cadastro'`). Sem rosto e sem Hello
  cadastrados, toda rota que age dá 423 e o portão abre no cadastro.
- **Liberado hoje** = `estado.dia === diaSP(agora())`. Vale até a meia-noite de Brasília; a próxima ação depois disso
  recebe 423 e a interface pede o rosto de novo. Fica em `estado.json` (reiniciar o app no mesmo dia não pede de novo).
- **Falhas:** cada `conferir` que não confere soma 1 (fica no `estado.json`). Na 3ª: o rosto fica bloqueado por 10 min
  (429 `muitas-tentativas`, `tentar_em`); o Hello continua liberado. Acerto (rosto ou Hello) zera.
- **Desafio:** `POST /api/rosto/desafio` → `{id: <16 bytes base64url>, piscadas: crypto.randomInt(2, 4), expira_em}`
  (60 s). Um por vez (o novo troca o velho); vale **uma** conferência.
- **Apagar** (`POST /api/rosto/apagar {confirmar: true}`): só liberado hoje. Apaga `cadastro.json` e `hello.json`, desfaz
  o liberado. O próximo Jarvis pede cadastro novo.
- **Travar agora** (`POST /api/rosto/travar`): desfaz o liberado de hoje.
- `exigirLiberado(res, erro)` → se travado, `erro(res, 423, 'O Jarvis está travado. Faça o reconhecimento do rosto.',
  'trava')` e devolve `false`.
- Arquivos gravados com segurança (`.tmp` + `rename`); pasta criada com `recursive: true`; pasta inacessível → 503
  `sem-pasta`. **Log sem descritor, sem distância:** só "rosto: liberado (rosto)", "rosto: não conferiu (2 de 3)",
  "rosto: cadastro novo (8 amostras)".

### 5.4 Rotas (todas com token, JSON, Host/Origin como o resto)
| Rota | Entrada | Saída | Códigos |
|---|---|---|---|
| `GET /api/rosto/estado` | — | `EstadoRosto` | 200 |
| `POST /api/rosto/desafio` | `{}` | `{id, piscadas, expira_em}` | 200; 404 `sem-cadastro`; 429 `muitas-tentativas` |
| `POST /api/rosto/conferir` | `{desafio, descritores: [[128]×3..5], prova}` | `{ok: true, liberado: true, metodo: 'rosto', distancia}` | 200; 400; 403 `nao-confere` / `quadros` / `prova-de-vida` (com `tentativas_restantes`, `distancia`); 409 `desafio-usado`; 410 `desafio-expirou`; 429 |
| `POST /api/rosto/cadastro` | `{descritores: [[128]×5..12]}` | `{ok: true, amostras, dispersao}` | 200; 400 `amostras`; 409 `cadastro-existe` |
| `POST /api/rosto/apagar` | `{confirmar: true}` | `{ok: true}` | 200; 423 |
| `POST /api/rosto/travar` | `{}` | `{ok: true}` | 200 |
| `POST /api/rosto/hello/opcoes` | `{tipo: 'cadastro'\|'entrada'}` | o `optionsJSON` do SimpleWebAuthn | 200; 404 `sem-hello` (entrada); 409 (cadastro com Hello já feito e travado) |
| `POST /api/rosto/hello/cadastrar` | `{resposta}` | `{ok: true}` | 200; 400 `hello-falhou`; 410 `desafio-expirou` |
| `POST /api/rosto/hello/conferir` | `{resposta}` | `{ok: true, liberado: true, metodo: 'hello'}` | 200; 403 `hello-falhou`; 410 |

`distancia` na resposta é número (3 casas), não é o descritor; a interface só mostra com `?debug`.

### 5.5 Windows Hello (WebAuthn) com `@simplewebauthn/server` 14.0.3 [fonte: os `.d.ts` do pacote]
- Cadastro: `generateRegistrationOptions({ rpName: 'Cérebro da Lube', rpID: 'localhost', userName: 'julio',
  userDisplayName: 'Júlio', userID: <16 bytes aleatórios, guardados no hello.json>, attestationType: 'none', timeout: 60000,
  authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'discouraged', userVerification: 'required' },
  excludeCredentials: <a credencial atual, se houver>, supportedAlgorithmIDs: [-8, -7, -257] })` → guardar o
  `challenge` (5 min) → depois `verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin:
  'http://localhost:8790', expectedRPID: 'localhost', requireUserVerification: true, supportedAlgorithmIDs: [-8, -7, -257] })`
  → `verified` → gravar `registrationInfo.credential` = `{id, publicKey (Uint8Array → base64url), counter, transports}`.
  (A lista de algoritmos é explícita: o padrão da v14 inclui ML-DSA-44 quando o Node suporta.)
- Entrada: `generateAuthenticationOptions({ rpID: 'localhost', allowCredentials: [{id, transports}], userVerification:
  'required', timeout: 60000 })` → `verifyAuthenticationResponse({ response, expectedChallenge, expectedOrigin,
  expectedRPID: 'localhost', credential: {id, publicKey: <Uint8Array>, counter, transports}, requireUserVerification: true })`
  → `verified` → atualizar `counter` com `authenticationInfo.newCounter` → liberado (`metodo: 'hello'`).
- O rpID `localhost` só vale na origem `http://localhost:8790` (em `127.0.0.1` o WebAuthn recusa): a página do portão
  manda para `localhost` se estiver em `127.0.0.1`.

### 5.6 Teste (`servidor/teste/testar-rosto.js`, pasta temporária, descritores sintéticos)
"Pessoa" = vetor aleatório de 128 números com norma 1,45; amostras = pessoa + ruído pequeno (distância 0,15–0,30);
"parecida" = distância 0,50; "outra" = outro vetor aleatório. Conferir: `distancia` (zero, simetria, igual a uma conta
feita à mão); aceita a pessoa, recusa a parecida e a outra; recusa 3 vetores idênticos e 3 pessoas diferentes; regras da
prova (n e n + 1 passam, n − 1 e n + 2 não, piscada de 30 ms e de 900 ms não); desafio expira (`agora` injetado) e vale
uma vez; 3 falhas → 429, e o Hello falso ainda libera; virar o dia em Brasília (`agora` = 23:59:59 → 00:00:01 SP) trava;
o primeiro cadastro passa, o segundo travado dá 409; `apagar` só liberado; `estado.json` sobrevive a um `criarRosto` novo
na mesma pasta; `exigirLiberado` responde 423; nenhum arquivo fora da pasta temporária; o `log` não tem número de
descritor.

---------------------------------------------------------------------------------------------------
## 6. Parte D — `web/js/rosto.js` + `web/css/rosto.css`

### 6.1 Exportações
```js
export function criarPortao({
  raiz,              // o #jarvis (o portão monta dentro dele, por cima do HUD)
  token,
  sons,              // criarSons() do HUD: tocar('pronto') etc.
  falar,             // (frase) => void — a voz do Jarvis (falarLocal); opcional
  reduzido = () => false,
  hud,               // opcional: { centro() -> {x, y, r} } para alinhar o círculo ao núcleo
  onEstado,          // opcional: (nome) => void — o jarvis.js mostra a leitura ESTADO no HUD
}) → {
  consultar(): Promise<EstadoRosto | null>,    // GET /api/rosto/estado (null = servidor fora)
  abrir(): Promise<{ liberado: boolean, metodo?: 'rosto'|'hello'|'cadastro' }>,   // cadastro ou conferência, o que faltar
  recadastrar(): Promise<boolean>,             // pelos ajustes (só liberado)
  apagarCadastro(): Promise<boolean>,          // pergunta antes
  fechar(): void,                              // cancela: câmera desligada, abrir() resolve {liberado: false}
  destruir(): void,
}
```
- Na primeira chamada, põe `<link rel="stylesheet" href="css/rosto.css">` no `<head>` (não precisa mexer no `index.html`
  nem no artifact).
- Só em `localhost` (o portão manda de `127.0.0.1` para `localhost`, por causa do WebAuthn).
- `?debug` em localhost: `window.__rosto = { quadro(simulado), descritor(semente), estado() }` para testar sem câmera
  (o simulador troca câmera, MediaPipe e face-api por quadros falsos: `{rosto, largura, yaw, pitch, piscar, luz}`).

### 6.2 Bibliotecas e câmera
- Em paralelo, assim que o portão abre: `import('…/tasks-vision@0.10.14/vision_bundle.mjs')`,
  `FilesetResolver.forVisionTasks('…/tasks-vision@0.10.14/wasm')`, modelo `face_landmarker.task` baixado com
  `fetch(…, {cache: 'force-cache'})` e passado em `modelAssetBuffer` (como o `maos.js`, com barra de progresso);
  `import('…/face-api@1.7.15/dist/face-api.esm.js')`, `faceapi.tf.setBackend('webgl')` (queda para `'cpu'`),
  `faceapi.nets.ssdMobilenetv1`, `.faceLandmark68Net` e `.faceRecognitionNet` `.loadFromUri('…/face-api@1.7.15/model/')`;
  `import('…/@simplewebauthn/browser@14.0.0/+esm')` só quando for usar o Hello. URLs exatas no §1.5. Constantes copiadas
  aqui (não importar do `maos.js`).
- `FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetBuffer, delegate: 'CPU' }, runningMode: 'VIDEO',
  numFaces: 2, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true, minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5 })`. **CPU**: o GPU criou mas não achou rosto neste Edge
  (§1.3). `numFaces: 2` só para saber se tem mais alguém.
- Câmera: `getUserMedia({video: {facingMode: 'user', width: {ideal: 640}, height: {ideal: 480}, frameRate: {ideal: 30}},
  audio: false})`, erros como o `erroCamera` do `maos.js` (`sem-camera`, `em-uso`, `negado`). Sem câmera ou negada → vai
  direto para o Hello. Laço com `requestVideoFrameCallback` (queda para rAF), `detectForVideo(video, ts)` a cada quadro
  (~26 ms), pausado com a aba escondida.
- **Nenhum quadro é guardado:** o vídeo só aparece no `<video>`; o quadro do descritor é desenhado num canvas fora da tela,
  usado e apagado (`clearRect` e `width = 0`). Ao terminar (liberou, desistiu, deu erro, aba fechou): `track.stop()` em
  todas as trilhas, `video.srcObject = null`, `faceLandmarker.close()` e `dispose()` das redes do face-api.

### 6.3 Qualidade do quadro (a cada quadro, nesta ordem; a 1ª que falha vira a dica da tela)
| Regra | Dica |
|---|---|
| exatamente 1 rosto | 0: "Procurando seu rosto" · 2+: "Só uma pessoa na frente da câmera" |
| largura do rosto ≥ 28% da largura do vídeo (~180 px em 640) | "Chegue um pouco mais perto" |
| de frente: \|yaw\| ≤ 20° e \|pitch\| ≤ 20°, da matriz 4×4 `facialTransformationMatrixes[0].data`, que vem **por coluna** [medido: a translação está em `m[12..14]`, z ≈ −86]: `yaw = asin(−m[2])`, `pitch = atan2(m[6], m[10])`, `roll = atan2(m[1], m[0])`, em graus; o sinal não importa aqui | "Olhe para a câmera" |
| luz: média de cinza do rosto (canvas 32×32) entre 50 e 210 | "Pouca luz aqui" / "Luz forte demais atrás de você" |
| parado: centro do rosto andou < 3% da largura em 200 ms | "Fique paradinho um instante" |

### 6.4 Piscar (a prova de vida)
- Por quadro: `b = (eyeBlinkLeft + eyeBlinkRight) / 2` (blendshapes, pelo `categoryName`). `base` = mediana de `b` nos
  últimos 30 quadros de olho aberto (começa com os 10 primeiros).
- **Fechado** quando `b ≥ max(0,45, base + 0,30)`; **aberto de novo** quando `b ≤ base + 0,15` (histerese).
- **Uma piscada** = aberto → fechado → aberto, com o tempo fechado entre **50 e 600 ms** e o rosto presente o tempo todo.
  Absoluto não serve: na imagem de amostra o olho aberto deu `eyeBlink` 0,50–0,53 (pessoa sorrindo) [medido].
- Reserva sem blendshapes: EAR em **pixels** (x × largura, y × altura — em coordenada normalizada a conta sai torta),
  `EAR = (|p2 − p6| + |p3 − p5|) / (2 |p1 − p4|)`, olho esquerdo `[33, 160, 158, 133, 153, 144]`, direito
  `[362, 385, 387, 263, 373, 380]`; fechado com `EAR ≤ 0,6 × base`, aberto com `EAR ≥ 0,8 × base`.
- Desafio: "Pisque **duas** vezes" ou "**três**" (o `piscadas` do servidor). Janela de 8 s depois do pedido; passa com
  `n` ou `n + 1` (uma piscada natural de brinde). Mandar ao servidor `{piscadas: [{ini, fim}], quadros, fps}`.

### 6.5 Conferência e cadastro
- **Conferir:** `POST /api/rosto/desafio` → qualidade ok → pedir as piscadas → 300 ms depois da última, pegar **3
  quadros** com olho aberto e qualidade ok, ≥ 150 ms entre eles → para cada um,
  `faceapi.detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({minConfidence: 0.6})).withFaceLandmarks().withFaceDescriptor()`
  (~185 ms) → `Array.from(descriptor, (x) => Math.round(x * 1e6) / 1e6)`; sem rosto no face-api, tenta o próximo quadro
  (até 8). **Desliga a câmera** → `POST /api/rosto/conferir`. Não conferiu: "Não reconheci. Tente de novo (1 de 3)." Na
  3ª, ou com 429: o botão principal vira **"Usar o Windows Hello"**.
- **Cadastrar** (primeira vez, ou pelos ajustes): cartão de explicação (§8) → "Cadastrar meu rosto" → câmera → "Mexa a
  cabeça devagar, como quem diz sim e não" → 8 descritores com qualidade ok (aqui \|yaw\| ≤ 25°), ≥ 600 ms entre eles,
  um anel de 8 segmentos enche → `POST /api/rosto/cadastro` → depois uma conferência de prova (piscar) → oferta do Hello.
- **Hello:** `platformAuthenticatorIsAvailable()`; se `false`: "O Windows Hello não está ligado neste computador. Crie
  um PIN em Configurações › Contas › Opções de entrada." e "Pular por agora". Se `true`: `POST /api/rosto/hello/opcoes
  {tipo}` → `startRegistration({optionsJSON})` ou `startAuthentication({optionsJSON})` → `…/hello/cadastrar` ou
  `…/hello/conferir {resposta}`. Cancelado na janela do Windows (`NotAllowedError`) = volta para os botões, sem erro
  vermelho.

### 6.6 Estados (atributo `data-rosto` na raiz `.rs-portao`)
`carregando` (bibliotecas, com %) · `camera` (abrindo) · `procurando` · `alinhando` (com a dica do §6.3) · `piscar`
(com as bolinhas) · `analisando` · `liberado` · `recusado` · `hello` · `cadastro-intro` · `cadastro-coleta` ·
`cadastro-hello` · `erro` (sem câmera e sem Hello / bibliotecas não carregaram / app fora: "Recarregue a página (F5)").
`onEstado(nome)` a cada troca; leitura do HUD: `ESTADO RECONHECIMENTO`, `CÂMERA LIGADA` com ponto vermelho.

### 6.7 Roteiro da animação [desenho]
Entra depois do "pronto" da transição do HUD (`JARVIS.md` §7.5), no lugar do microfone e da saudação. Tokens do
`estilo.css` (`--holo`, `--holo-medio`, `--holo-fraco`, `--holo-tenue`, `--ink`, `--vermelho`, `--ok`, `--alerta`,
`--bg`, `--veu`, `--mono`); cores do canvas lidas uma vez com `getComputedStyle` (como o `jarvis-hud.js`). Raio do
círculo `Rc = min(0,62 × R do HUD, 180 px)`; em 400 px, `min(36vw, 150px)`.

| t (ms) | O que acontece | Curva |
|---|---|---|
| 0 | HUD em `repouso` × 0,3; leitura `TRAVA · RECONHECIMENTO FACIAL`; voz: "Bom dia, Júlio. Antes de liberar, vou conferir seu rosto." | — |
| 0–400 | o núcleo se abre numa **lente**: disco `--bg` cresce de 0,16R até `Rc`, com anel de 2 px `--holo` desenhando 360° | easeOutCubic |
| 400–… | "Abrindo a câmera…": anel tracejado girando +30°/s; ao chegar o vídeo, ele entra por dentro da lente (opacidade 0 → 1, 300 ms), **espelhado**, recortado em círculo (`clip-path: circle(50%)`), com véu `--holo` a 10% (`mix-blend-mode: screen`) e linhas de varredura de 2 px a 5% | easeOutQuad |
| `procurando` | varredura: cone de 40° `--holo` .18 → 0 girando 90°/s sobre o vídeo; 4 colchetes de canto (os `.canto`) parados na borda da lente | linear |
| rosto achado | colchetes voam até a caixa do rosto (mola, 300 ms); **a malha de 478 pontos acende de cima para baixo** atrás de uma linha de luz horizontal (600 ms), depois fica a 25%; olhos e boca em `--holo-medio`; leituras rolam: `ROSTO 1 · ALINHAMENTO 92%` | easeOutCubic |
| `alinhando` | a dica aparece embaixo da lente (fade 200 ms); colchetes em `--rever` enquanto a regra falha | — |
| `piscar` | "Pisque duas vezes" + **2 ou 3 bolinhas** vazias; cada piscada: o contorno dos olhos pisca em `--ink` e a bolinha enche com um pulo (1 → 1,3 → 1, 180 ms) e o som "ferramenta" | easeOutBack |
| `analisando` | arco de progresso em volta da lente enche 0 → 100% com os 3 quadros; hexágonos acendem; números `ID 0,31…` rolam; a câmera desliga no fim e o último quadro fica parado, dessaturando para 30% em 400 ms (só na tela, nada guardado) | easeInOutCubic |
| `liberado` | clarão `--ink` de 80 ms; anel vira `--ok` por 600 ms com um ✓ desenhado (traço corre em 250 ms); "Identidade confirmada"; som "pronto"; a lente encolhe até o núcleo (400 ms) e `SISTEMA LIBERADO` é digitado (25 ms por letra); o HUD acelera para ×1; depois o microfone liga e o Jarvis saúda como hoje | easeInCubic |
| `recusado` | anel `--vermelho` pulsa 2× (1 Hz); 2 quadros de glitch (fatias ±6 px); "Não reconheci. Tente de novo (1 de 3)."; botões **Tentar de novo** / **Usar o Windows Hello** | — |
| `hello` | lente com ícone de chave em `--holo`, "Confirme no Windows Hello"; a janela do Windows aparece por cima | — |

- **Movimento reduzido:** sem varredura, sem voo, sem malha acendendo, sem glitch; a malha aparece parada a 25%; trocas
  por fade de 200 ms.
- **Sons:** os do HUD (`criarSons`); nada de som com o Júlio falando (o microfone ainda está desligado aqui: sem risco de eco).
- **Acessibilidade:** `.rs-portao` com `role="dialog"`, `aria-labelledby`; o texto da dica num `aria-live="polite"`;
  botões de verdade, foco no principal; **Esc** = "Agora não" (fecha o Jarvis, nada liberado); o vídeo com
  `aria-hidden="true"`.
- **Sempre visível embaixo da lente:** ponto vermelho `CÂMERA` enquanto ela está ligada e a frase "A câmera desliga ao
  terminar. Nenhuma foto é salva."

### 6.8 `web/css/rosto.css`
Prefixo `.rs-` em tudo, dentro de `#jarvis`; só tokens (nenhuma cor literal); `.rs-portao { position: absolute; inset:
0; display: grid; place-items: center }`, por cima do canvas do HUD e por baixo do `.jv-confirma`; `.rs-lente` (círculo
com `<video>` e `<canvas>` sobrepostos), `.rs-dica`, `.rs-bolinhas`, `.rs-botoes`, `.rs-cartao` (explicação e
confirmação de apagar), `.rs-privacidade`; `@media (prefers-reduced-motion: reduce)`; até 400 px de largura sem rolagem
lateral (gutter de 16 px).

---------------------------------------------------------------------------------------------------
## 7. Contrato entre as partes e o que a integração liga

| Parte | Arquivos (só ela mexe) | Expõe | Usa de outra parte |
|---|---|---|---|
| A | `servidor/ouvido.js`, `web/ouvido.html`, `servidor/teste/testar-ouvido.js` | `criarOuvidoChrome`, `acharChrome`, `PERFIL_PADRAO`, `ErroOuvido`; rotas `/api/ouvido/*`; SSE §3.3 | `podeLigar` (C, por injeção) |
| B | `web/js/ouvido-remoto.js`, `servidor/teste/testar-ouvido-remoto.js` | `criarOuvidoRemoto` (mesma cara do `criarOuvido`), `analisarSse` | as rotas e o SSE de A |
| C | `servidor/rosto.js`, `servidor/teste/testar-rosto.js`, `servidor/package.json` + `package-lock.json` (só a dependência) | `criarRosto`, `distancia`, `conferirDescritores`, `avaliarCadastro`, `diaSP`, constantes; rotas `/api/rosto/*`; 423 | `util.js` (só leitura) |
| D | `web/js/rosto.js`, `web/css/rosto.css` | `criarPortao` | as rotas de C |

O contexto das rotas é o mesmo nas duas partes do servidor: `ctx = { req, res, url, metodo, lerCorpoJson, json, erro }`
(as funções que já existem no `servidor.js`). O token, o Host e a Origin já foram conferidos pelo `servidor.js` antes.

**A integração (depois das quatro partes) faz:**
- `servidor/servidor.js`: criar `rosto = criarRosto({travaAberta: argv.includes('--trava-aberta'), pasta: <--rosto-pasta=…>})`
  e `ouvido = criarOuvidoChrome({podeLigar: () => rosto.liberado(), perfil: <--ouvido-perfil=…>, log})`; depois do token:
  `/api/rosto/` → `rosto.tratar(ctx)`, `/api/ouvido/` → `ouvido.tratar(ctx)`; `rosto.exigirLiberado(res, erro)` antes do
  `turno` e do `acao` com `decisao: 'confirmar'` (o `recusar` passa travado); `estado()` ganha `trava: rosto.estado()` e
  `ouvido: ouvido.estado()`; `desligar()` chama `ouvido.desligar()`; com `--trava-aberta`, log em destaque "TRAVA DO
  ROSTO DESLIGADA (só teste)".
- `web/js/jarvis.js`: no app local (`ehLocal() && tokenLocal()` e fora do `?jarvis=simular`), `criarOuvidoRemoto` no lugar
  do `criarOuvido` (o do Edge fica para o resto); no `abrir()`, `POST /api/ouvido/preparar` em paralelo e, depois de
  `hud.entrar()` e antes de `ligarMic()`/`saudar()`: `portao.consultar()` → se não liberado, `await portao.abrir()`; não
  liberou → `fechar()`. 423 no meio da conversa (virou o dia) → `portao.abrir()` e refazer a fala. Novos textos no
  `ERRO_MIC` (§9). Aviso do microfone atualizado (§8). Nos ajustes: **"Apagar meu cadastro"** e **"Travar agora"**.
  `api._teste` ganha o portão no `?debug`.
- `web/index.html`, `web/css/estilo.css`: nada (o `rosto.js` põe o próprio CSS). Se precisar, só um `.jarvis[data-trava]`.
- `servidor/package.json`: scripts `teste:ouvido`, `teste:ouvido-remoto`, `teste:rosto` e no `teste`.
- `README.md`: "O ouvido (Chrome escondido)", "A trava do rosto", as pastas do §2.1, privacidade e o §8.
- `docs/JARVIS.md`: um §10 curto apontando para este arquivo.
- `.claude/launch.json` do vault: a entrada `jarvis` ganha `--trava-aberta` (o preview não tem câmera).

---------------------------------------------------------------------------------------------------
## 8. O que dizer na tela e no README (honesto, frases curtas)

**Aviso do microfone (troca o atual do Edge):**
> O reconhecimento de voz agora roda neste computador, no Google Chrome, sem internet. A primeira vez ele baixa um
> pacote de voz (cerca de 300 MB). O Windows vai mostrar que o Chrome está usando o microfone. A voz do Jarvis (Edge)
> manda o texto para a Microsoft virar áudio, e o que você fala vai para a API do Claude virar resposta.

**Cadastro do rosto:**
> Vou guardar só números que descrevem o seu rosto, neste computador (`%LOCALAPPDATA%\CerebroLube\rosto`). Nenhuma
> foto é salva e nada sai daqui. A câmera desliga ao terminar.
> Isto é uma trava do Jarvis neste computador. Não substitui o login do Windows: quem entra na sua conta do Windows
> consegue apagar a trava, e um vídeo seu poderia enganar a prova de vida (o piscar).
> Faça o cadastro você mesmo, sozinho na frente da câmera.

**Apagar:** "Apagar o cadastro do rosto e do Windows Hello deste computador? O Jarvis vai pedir um cadastro novo."

**Se tudo falhar** (sem câmera, sem Hello, rosto não confere): no README — fechar o app e apagar a pasta
`%LOCALAPPDATA%\CerebroLube\rosto`; o Jarvis pede cadastro novo. (É por isso que a trava não é segurança contra quem
já tem a sessão do Windows.)

---------------------------------------------------------------------------------------------------
## 9. Textos de erro (para o `ERRO_MIC` e o portão)
| Código | Texto |
|---|---|
| `sem-chrome` | Não achei o Google Chrome neste computador. Ele é o ouvido do Jarvis: instale o Chrome e abra de novo. Enquanto isso, digite. |
| `instalando` (aviso) | Baixando o pacote de voz em português, só desta vez (cerca de 300 MB)… |
| `pacote-falhou` | Não consegui baixar o pacote de voz. Confira a internet e tente de novo. Enquanto isso, digite. |
| `negado` | O Windows bloqueou o microfone para o Chrome. Abra Configurações › Privacidade › Microfone e permita os aplicativos da área de trabalho. |
| `caiu` | O ouvido do Jarvis parou. Feche e abra o Jarvis de novo. |
| `trava` | O Jarvis está travado. Faça o reconhecimento do rosto. |
| `sem-camera` (portão) | Não encontrei câmera. Use o Windows Hello. |
| `negado` (câmera) | Você não liberou a câmera. Clique no cadeado da barra de endereço, ou use o Windows Hello. |
| `sem-hello` | O Windows Hello não está ligado neste computador. Crie um PIN em Configurações › Contas › Opções de entrada. |

`sem-microfone`, `em-uso`, `audio-capture` e `reiniciado` continuam com os textos de hoje.

---------------------------------------------------------------------------------------------------
## 10. Conferir no PC do Júlio [conferir]
1. **Falar de verdade:** o ouvido do Chrome com o microfone real (`start(trilhaDoGetUserMedia)`) — o texto aparece na
   legenda e o Jarvis responde. É o primeiro teste.
2. Tempo da fala até a primeira palavra do Jarvis (meta ≤ 1,5 s, `JARVIS.md` §6) com o ouvido novo (o parcial leva ~1,1 s).
3. Eco com alto-falante: o Chrome não cancela a voz do Edge; contar interrupções falsas em 2 minutos (meta: zero).
4. **Criar o PIN do Windows Hello** (hoje `NgcSet: NO`) e fazer as duas cerimônias (cadastro e entrada).
5. Distância do rosto dele para ele mesmo em dias e luzes diferentes (meta: mediana ≤ 0,35, longe do 0,45).
6. Piscar com óculos, com pouca luz e com a webcam do PC (o `eyeBlink` absoluto engana: usar a base).
7. Se o domínio da Lube bloqueia o Windows Hello, a reserva não existe: decidir com o Júlio (chave de segurança USB,
   que o mesmo WebAuthn aceita, ou ficar só com o rosto).

## 11. Arquivos da sonda (descartáveis, fora do repositório)
`C:\Users\GTIJUL~1.ALV\AppData\Local\Temp\claude\C--Users-gti-julio-alves-OneDrive---Lube-CEREBRO-DA-LUBE\039b4773-f12f-401f-9e60-debd67483968\scratchpad\`
- `edge-probe\pipe.mjs` + `ouvido-teste.html` — Chrome por pipe: microfone, instalação, reconhecimento, silêncio,
  reinício, trilha parada, erros, CPU, fechar o pipe (`node pipe.mjs headless instalar,reco` com `LANGS=pt-BR,en-US
  SEM_FAKE_UI=1`).
- `edge-probe\dono.mjs` (Node morto à força; código 21) e `trava-perfil.mjs` (`lockfile`, `taskkill /T`).
- `edge-probe\edge-pipe-min.mjs` (o Edge não aceita pipe), `porta-pagina.mjs` (driver pela porta), `rosto-teste.html`
  (Human), `rosto-comparar.html` (face-api × Human × MediaPipe), `hello-teste.html` (WebAuthn sem cerimônia).
- `edge-probe\calibrar.mjs` + `baixados-human\faces.json` (base de amostra do Human).
- `edge-probe\fala.wav`, `fala-en.wav` (voz do Windows) — não vão para o repositório.
