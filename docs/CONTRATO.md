# Cérebro da Lube — robô (contrato de construção)

Página única publicada como Artifact do claude.ai (substitui o "painel em anéis" em
https://claude.ai/artifact/Tnrde74sov8LPGmgj8yjT4). O painel antigo completo está em
`../painel-antigo.html` (1083 linhas): **é a fonte de toda a lógica de dados e de todas as funções que
precisam continuar existindo**. A imagem de referência do robô está em `../robo-referencia.webp`.

Pedido do Júlio (dono, TI da Lube Distribuidora), 2026-10-09:
> "estou achando esse meu cérebro muito simples, quero criar algo diferenciado. Estava pensando em algo de
> uma cabeça de um robô com as cores da Lube, e quando eu vejo algumas informações ele tem uma animação que ele
> puxa ela da mente e abre de uma forma de leitura muito legal, enquanto eu mexo o mouse ele também reage e
> quando eu recarrego o cérebro também, então assim, algo bem diferente mesmo, um desafio legal.
> A imagem do robô pode ser mais ou menos assim que eu anexei."

Público: o próprio Júlio e quem ele mostrar (a empresa). **Tem que abrir na hora e impressionar**, sem travar.
Idioma de toda a interface: português do Brasil, frases curtas e diretas.

---------------------------------------------------------------------------------------------------
## 1. Arquivos (todos nesta pasta; publicados juntos)

| Arquivo | Dono (agente) | O que é |
|---|---|---|
| `index.html` | UI | Conteúdo da página (SEM `<!doctype>`, `<html>`, `<head>`, `<body>`: o Artifact embrulha). Começa com `<title>Cérebro da Lube</title>`, `<link>` das fontes, `<link rel="stylesheet" href="css/estilo.css">`, o importmap, a marcação do §4 e `<script type="module" src="js/app.js"></script>` no fim. |
| `css/estilo.css` | UI | Todo o CSS (tokens do §3). |
| `js/dados.js` | DADOS | Camada de dados (vault, grafo, markdown, busca, armazenamento, ao vivo, exemplo). Sem DOM, exceto `lerPasta` que recebe um FileList. |
| `js/robo.js` | ROBÔ | Cena Three.js: cabeça do robô, cúpula com os neurônios, animações, mouse. |
| `js/holo.js` | UI | Componentes de tela (leitor holográfico, leque de memórias, trilho de departamentos, recentes, resultados de busca, dica, aviso, painel de resposta, contador). |
| `js/aneis.js` | ANÉIS | O mapa em anéis antigo (canvas 2D) como visão alternativa e como reserva se o WebGL falhar. |
| `js/app.js` | APP | Orquestra tudo: carrega dados, liga robô + UI + anéis + "Pergunte ao cérebro". |

Não publicar: `CONTRATO.md`, `api/vault` (cópia das notas reais SÓ para teste local), qualquer outro arquivo.

### Bibliotecas (CSP do Artifact: scripts só de cdn.jsdelivr.net/npm, cdnjs, unpkg; nada de fetch externo)
Importmap no `index.html`, versão exata:
```html
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
```
Fontes (único host de CSS permitido é fonts.googleapis.com):
`https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Sans:wght@500;600;700&family=JetBrains+Mono:wght@500;600;800&display=swap`
Sem nenhum outro recurso externo: imagens, texturas e sons são gerados em código (canvas) ou data: URI.
`fetch` só para caminhos relativos e `/api/vault` (modo ao vivo local).

### Restrições do frame do Artifact
- `alert/confirm/prompt` não funcionam; `window.print` não funciona; download por `<a download>` não funciona.
- `obsidian://` (esquema próprio) pode não funcionar: manter o botão, com o aviso já existente e o "Copiar caminho".
- `navigator.clipboard.writeText` só dentro do clique, com fallback (já existe no antigo).
- `localStorage`/IndexedDB podem falhar: tudo em try/catch. **Manter as chaves antigas**: IndexedDB `cerebro-lube`, store `kv`, chave `vault` (assim o Júlio não perde o vault guardado).
- Pergunte ao cérebro: `window.claude.use('sample')` (capability `sample` já declarada no artifact). Pode resolver `null`: esconder a barra. Tipos oficiais: `C:\Users\GTIJUL~1.ALV\AppData\Local\Temp\claude\bundled-skills\2.1.293\75a4543a53c3f53d1675928a42680d66\artifact-capabilities\0.2.54\sample.d.ts` e `claude.d.ts`.
- Funcionar em 400 px de largura sem rolagem horizontal; respeitar `prefers-reduced-motion`.

---------------------------------------------------------------------------------------------------
## 2. Conceito visual e de movimento

**Cena:** laboratório escuro azul-marinho da Lube. No centro, a **cabeça do robô** da imagem de referência,
em 3D (Three.js), olhando para quem usa.

**Robô (fiel à referência, em 3D procedural):**
- Capacete **branco brilhante** (MeshPhysicalMaterial, clearcoat), levemente achatado, com **faixas
  vermelhas** nas laterais (como na imagem) e **orelhas** redondas cinza-escuro com **anel azul-ciano
  luminoso** e um arco vermelho em volta.
- **Visor** preto-azulado brilhante e curvo, ocupando o rosto. Os **olhos e a boca são desenhados num canvas**
  usado como textura emissiva do visor (ciano `#45D4FF` com brilho), o que permite trocar expressão a qualquer
  momento.
- **Logo da Lube em relevo na testa** (ExtrudeGeometry com os caminhos abaixo, azul `#16218A` e vermelho
  `#F20D1F` sobre placa/contorno branco). Clicar na logo abre o **CLAUDE.md** ("mapa central").
- **A mente:** a parte de cima/de trás do crânio é uma **cúpula de vidro** (transmission/transparência) e dentro
  dela fica o **vault vivo**: cada nota de memória é um **neurônio** (ponto luminoso, cor do departamento),
  agrupado em "lobos" por departamento; os `[[links]]` são **sinapses** (linhas finas) com **pulsos** de luz
  correndo de vez em quando. Skills = estrelas azuis mais fortes no núcleo; CLAUDE.md = a logo.
- **Rotinas** = um anel de contas vermelhas girando em volta da cabeça (como um halo inclinado).
  **Aplicações** = pequenos satélites hexagonais em órbita mais externa, com a sigla (WT, SB, VC...).
- Pescoço escuro e um começo de ombros brancos com a logo pode aparecer embaixo (opcional, se ficar bonito).

Caminhos da logo (viewBox 40 20 790 575; y para baixo — inverter para o Three.js):
- L (azul `#16218A`): `M165 30 L400 30 L295 435 L740 435 L705 580 L230 580 Q48 580 72 410 Z`
- R (vermelho `#F20D1F`): `M430 30 L650 30 Q822 34 795 188 L748 410 L335 410 Z`
- contorno branco de ~22 unidades em volta das duas peças.

**Expressões do visor** (nomes exatos): `neutro` (olhos em cápsula, sorriso leve), `feliz` (^ ^ e sorriso
largo, como a imagem), `piscar` (fecha e abre), `surpreso` (olhos redondos grandes, boca em O), `pensando`
(olhos para cima e três pontinhos girando), `lendo` (olhos semicerrados olhando para o painel aberto),
`procurando` (barra de varredura horizontal no visor), `alerta` (tom vermelho, olhos em traço — nota não
encontrada/erro), `dormindo` (visor apagado, só um traço fraco), `boot` (texto "LUBE OS" + barra de
progresso no visor). Os olhos se deslocam com o **olhar** (gaze) para onde o robô está olhando.

**Reações ao mouse (e ao toque):**
- Cabeça gira para o cursor (yaw até ±28°, pitch até ±16°) com mola amortecida; os olhos vão um pouco além.
- Parado por ~5 s: olha em volta devagar, pisca a cada 3–6 s aleatórios.
- Cursor sobre um neurônio: o robô **olha para ele**, o neurônio cresce e aparece a dica com nome e
  departamento.
- Clique na cabeça (fora da logo e dos neurônios): `feliz` + pequeno pulo + faíscas.
- Movimento muito rápido do mouse: `surpreso` por um instante.

**Ligar e recarregar ("boot"):**
1. Visor apagado; luz de contorno azul desenhando a silhueta.
2. Visor liga: linha de varredura, "LUBE OS" e barra de progresso (`boot`); anéis das orelhas acendem.
3. Olhos abrem com uma piscada e olham para quem usa (`feliz` rápido → `neutro`).
4. Os neurônios acendem em ondas, do centro para fora, enquanto o contador da marca sobe até o total
   ("**112** memórias · **2** skills · **15** rotinas · **8** aplicações · **N** conexões").
5. Rotinas e aplicações entram em órbita.
Em recarga (vault lido de novo) com notas novas ou alteradas: elas **piscam** com anel de pulso e o robô faz
`surpreso` → `feliz`; aviso "Cérebro atualizado: 3 notas novas ou alteradas."
Reduced motion: estado final direto, com fade curto.

**Ler uma nota ("puxar da mente"):**
1. Robô faz `procurando`, o neurônio acende forte, as sinapses dele brilham.
2. O neurônio **sai pela cúpula** como uma esfera de luz e voa até onde o leitor vai abrir (com rastro).
3. Chegando, a esfera **se abre no painel holográfico**: cantos-colchete crescem do centro, linha de
   varredura passa, o **título é digitado**, os blocos do texto entram em cascata (até ~40 blocos; o resto já
   aparece pronto).
4. Enquanto o painel está aberto, um **feixe** liga a testa do robô à borda do painel, pulsando; o robô fica em
   `lendo` olhando para o painel; a cabeça se desloca para a esquerda para dar espaço (desktop).
5. Link `[[...]]` no texto ou uma conexão do rodapé: o painel faz "troca" (glitch rápido) e o robô puxa a
   próxima nota (o feixe muda de neurônio).
6. Fechar (X, Esc): o painel se dobra numa esfera que volta para a cúpula; o neurônio apaga devagar.
Reduced motion: painel abre com fade, sem voo nem digitação.

**Departamentos ("leque de memórias"):** um trilho de departamentos (lado esquerdo no desktop, faixa rolável
embaixo no celular) com bolinha da cor e quantidade. Clicar: os neurônios daquele departamento acendem e saem
da cúpula como um **leque de cartões holográficos** em arco em volta do robô (título, data relativa, nº de
conexões), em cascata a partir do ponto da cúpula. Clicar num cartão = ler a nota (passo acima, saindo do
cartão em vez do neurônio). Clicar no departamento de novo ou em vazio recolhe o leque.

**Pergunte ao cérebro (Claude):** barra embaixo. Ao enviar: robô `pensando`; cada `buscar_notas` faz
`procurando` e acende os neurônios encontrados; cada `ler_nota` faz uma faísca do neurônio para o visor. A
resposta aparece num painel holográfico acima da barra, com as notas citadas clicáveis ("puxar").

---------------------------------------------------------------------------------------------------
## 3. Tokens (padrão da casa: "cara do Gestão TI", tema escuro único, por escolha)

Tema **escuro único** (o Júlio prefere escuro): `:root` com `color-scheme: dark` e TODAS as cores em tokens;
sem bloco de tema claro e sem botão de tema. `body` com `background: var(--bg)` explícito.
```
--bg:#050b1c  --surface:#0d1830  --surface-2:#132242  --line:#1f3463
--ink:#e8eeff --muted:#8a97c4
--azul:#2a41c8 (azul da marca)   --vermelho:#e5202c (vermelho da marca; botão principal é vermelho, nunca preto)
--holo:#45d4ff (ciano dos olhos e dos hologramas)   --holo-fraco:rgba(69,212,255,.14)
--logo-azul:#16218A  --logo-vermelho:#F20D1F
estado: --ok:#34e89e  --rever:#ffb340  --alerta:#ff6b74  --novo:#5fb2ff
--display:"Archivo", "Arial Black", system-ui, sans-serif   (700/800 títulos)
--body:"IBM Plex Sans", system-ui, "Segoe UI", sans-serif     (500 é o peso base, nunca 400)
--mono:"JetBrains Mono", ui-monospace, Consolas, monospace    (600/800 em todo número, contador, código, rótulo HUD)
```
Paleta dos departamentos (neurônios e bolinhas), na ordem dos departamentos:
`['#3DA9FF','#FF4D63','#8E7CFF','#35E3FF','#F1F5FF','#5B7BFF','#FF94A8','#2DD4BF','#B9C7FF','#FFC24D','#7FD8FF','#C98BFF']`
Skill `#3DA9FF`, rotina `#FF2D46`, aplicação `#9EB2FF`.
Regras da casa: nada de "vidro" brilhante em gráfico (o vidro da cúpula e o holograma são a cena, ok);
cor sempre de token, nunca literal fixo no JS de UI (no Three.js as cores vêm de constantes no topo do robo.js
copiadas destes tokens); foco de teclado visível; número em JetBrains Mono com `tabular-nums`.

---------------------------------------------------------------------------------------------------
## 4. Marcação (index.html) — ids exatos

```
<div class="app" id="app">
  <canvas id="palco" aria-label="Cabeça do robô do Cérebro da Lube: as notas do vault são os neurônios dentro da cúpula" role="img"></canvas>
  <canvas id="aneis" hidden aria-label="Mapa em anéis do Cérebro da Lube" role="img"></canvas>
  <header class="marca"> logo SVG (dois paths do §2) + <h1>Cérebro <span>da Lube</span></h1> + <p id="stats">Ligando…</p> </header>
  <div class="topo">
     <div class="busca"><input id="q" type="search" placeholder="Buscar nota  ( / )" aria-label="Buscar nota no cérebro" autocomplete="off"><div id="resultados" role="listbox" hidden></div></div>
     <button id="recarregar" class="btn principal">Recarregar cérebro</button>   (abre a escolha da pasta)
     <button id="menuBtn" class="btn" aria-expanded="false" aria-controls="menu">Menu</button>
  </div>
  <div id="menu" class="menu" hidden>
     seção "Vault do Obsidian": <button id="loadBtn">Abrir pasta do vault</button> <button id="demoBtn">Ver exemplo</button> <p id="vaultHint"></p>
       <input type="file" id="pasta" webkitdirectory directory multiple class="sr" tabindex="-1" aria-hidden="true">
     seção "Visão": <button id="visaoRobo" aria-pressed="true">Robô</button> <button id="visaoAneis" aria-pressed="false">Mapa em anéis</button>
     seção "Exibição": <label><input type="checkbox" id="sinapses" checked> Mostrar sinapses</label>
                       <label><input type="checkbox" id="qualidade" checked> Efeitos de brilho</label>
  </div>
  <nav id="trilho" class="trilho" aria-label="Departamentos da memória"></nav>   (botões de departamento)
  <section id="recentes" class="recentes" aria-label="Memórias mais recentes"></section>   (5 últimas notas por data)
  <div id="leque" class="leque" aria-live="polite"></div>         (cartões do leque, posicionados por JS)
  <aside id="leitor" class="leitor" aria-label="Leitor de nota" hidden>
     <div class="leitor-moldura"> cantos .canto (4)
       <header> <div class="selos" id="lSelos"></div> <h2 id="lTitulo"></h2> <code id="lCaminho"></code>
                <div class="acoes"><button id="lObsidian">Abrir no Obsidian</button><button id="lCopiar">Copiar caminho</button><button id="lFechar" aria-label="Fechar leitor">×</button></div> </header>
       <div class="leitor-corpo" id="lCorpo"> <div class="fm" id="lFm"></div> <div class="md" id="lTexto"></div> <div id="lConexoes"></div> </div>
     </div>
  </aside>
  <svg id="feixe" class="feixe" aria-hidden="true"></svg>        (feixe da testa até o leitor, desenhado por holo.js com pontos dados pelo robô)
  <div id="pergunta" class="pergunta" hidden> <div id="resposta" class="resposta" hidden aria-live="polite"></div>
     <form id="perguntaForm"><input id="perguntaInput" placeholder="Pergunte ao cérebro da Lube…" aria-label="Pergunta para o Claude sobre o cérebro" autocomplete="off"><button id="perguntaBtn" class="btn principal" type="submit">Perguntar</button></form> </div>
  <div id="dica" class="dica" hidden></div>
  <div id="aviso" class="aviso" role="status" hidden></div>
  <div id="legenda" class="legenda" aria-hidden="true"> logo=CLAUDE.md · Neurônio=Memória · Estrela=Skill · Anel vermelho=Rotinas · Satélite=Aplicações </div>
  <div id="semWebgl" class="sem-webgl" hidden>Seu navegador não liga o 3D. Mostrando o mapa em anéis.</div>
</div>
```
Use `el.hidden` para mostrar/esconder (o esqueleto do Artifact tem `[hidden]{display:none!important}`;
repita essa regra no estilo.css para o teste local).

---------------------------------------------------------------------------------------------------
## 5. APIs (nomes exatos; ES modules)

### js/dados.js (DADOS) — porte fiel do antigo, mesmas regras
```
export const KIND_LABEL   // {core:'Mapa central', skill:'Skill', memory:'Memória', routine:'Rotina', app:'Aplicação', dept:'Departamento'}
export const PALETA       // as 12 cores do §3
export const COR_TIPO     // {core:'#F20D1F', skill:'#3DA9FF', routine:'#FF2D46', app:'#9EB2FF'}
export function corDe(n)  // cor do nó: tipo ou PALETA[n.ci % 12]
export function norm(s), esc(s), relTime(ms), kb(n), hash(s), rng(seed), initials(name)
export function parseFM(text) -> {fm, body}
export function renderMD(text) -> string HTML (igual ao antigo: [[wikilink]] vira <a href="#" class="wl" data-wl="alvo">)
export function blocosMD(text) -> string[]   // mesmo HTML, mas um item por bloco de nível superior (para a cascata)
export function buildGraph(files, vaultName) -> G   // G = {nodes, depts, core, vaultName, linkCount}; nós com id, kind, name, path, text, size, mtime, fm, tags, dept, ci, links:Set, back:Set, _hay; skills com files/skillFolder; depts = [{name, ci, list, hub}]
export function contar(G) -> {memorias, skills, rotinas, apps, conexoes}
export function buscar(G, q, limit=8) -> nós   // = searchNodes antigo
export function trecho(n, q) -> string         // = snippet antigo
export function seguirLink(G, alvo) -> nó|null // = lógica do followWiki antigo (por caminho, nome, pasta da skill, sufixo)
export function obsidianUrl(G, n) -> string
export function vaultExemplo() -> {vaultName, files}   // = demoVault antigo (dados fictícios marcados como exemplo)
export async function idbGet(k), idbSet(k, v) -> bool, idbDel(k)   // banco 'cerebro-lube', store 'kv'
export async function lerPasta(fileList, onProgresso(lidas, total)) -> {vaultName, files, loadedAt} | lança Error('sem-md')
export async function buscarVaultLocal() -> data|null   // GET /api/vault com timeout 4 s (só em localhost)
export function ouvirMudancas(onMudou, onEstado('ao vivo'|'reconectando'))   // EventSource('/api/events') com debounce 350 ms
export function mudancas(Gantes, Gdepois) -> Set<path>   // caminhos novos ou com mtime diferente
```

### js/robo.js (ROBÔ)
```
export async function criarRobo(canvas, opts) -> Robo     // lança Error se não houver WebGL
  opts = { reduzido:boolean, qualidade:'alta'|'baixa', onHover(no|null, {x,y}), onClique(no), onCabeca(), onLogo() }
Robo = {
  setGrafo(G)                       // monta neurônios (memory), estrelas (skill), contas (routine), satélites (app); posições estáveis por hash(path)
  boot({recarga:false, frescos:Set<id>}) -> Promise   // sequência do §2; resolve no fim; aceita ser chamado de novo
  expressao(nome, ms?)              // nomes do §2; com ms volta para a expressão base depois
  base(nome)                        // expressão de repouso ('neutro' padrão; 'lendo' enquanto leitor aberto)
  olharPara({x,y}|null)             // força o olhar para um ponto da tela (ex.: painel); null = volta a seguir o mouse
  destacar(ids:Set<id>|null)        // acende esses, esmaece os outros; null limpa
  faisca(id)                        // faísca do neurônio até o visor (ler_nota do Claude)
  pulsoNovo(ids:Set<id>)            // anel de pulso nos novos/alterados por ~20 s
  async puxar(id, alvo:{x,y})       // anima a esfera saindo da cúpula até o ponto de tela 'alvo'; resolve ao chegar
  async devolver(id, origem:{x,y})  // esfera volta do ponto de tela até o neurônio
  projetar(id) -> {x,y,visivel}     // posição de tela do nó (px CSS, relativo ao canvas); para leque, dica e feixe
  testa() -> {x,y}                  // posição de tela da logo/testa (início do feixe)
  cupula() -> {x,y}                 // centro de tela da cúpula (origem do leque)
  deslocar(fracaoX)                 // -0.18 = robô vai para a esquerda (leitor aberto); 0 = centro; anima suave
  sinapses(bool), qualidade('alta'|'baixa'), pausar(bool), redimensionar()
  destruir()
}
```
Detalhes obrigatórios: renderer com `alpha:false` e fundo da cena = `--bg` com névoa leve; pixelRatio ≤ 1.75
(≤ 1.25 em `qualidade:'baixa'`); bloom (UnrealBloomPass) só em `alta`, em resolução reduzida; medir o tempo de
quadro nos primeiros 3 s e cair sozinho para `baixa` se a média passar de 24 ms (avisar via
`opts.onQualidade?.('baixa')`); `pausar(true)` quando a aba fica oculta; hover por raycast com limiar
generoso (os neurônios são pequenos); fundo com trilhas de circuito sutis (CanvasTexture), não chamativo.

### js/holo.js (UI)
```
export function iniciarUI(opts) -> UI
  opts = { onAbrir(no), onFechar(), onDepto(d|null), onBuscaEscolher(no), onLink(alvo:string), onObsidian(no), onCopiar(no) }
UI = {
  stats(contagem, {vaultName, aoVivo, exemplo, animar:bool})   // contador sobe até o valor (mono, tabular-nums)
  trilho(depts, ativo|null), recentes(nos)
  async abrirLeitor(no, G, {origem:{x,y}, troca:bool}) // monta selos (tipo, dept, tags), título digitado, fm, blocos em cascata (blocosMD), conexões (cita / citada por) como botões que chamam onAbrir; resolve quando a moldura terminou de abrir
  async fecharLeitor() -> {x,y}     // dobra o painel e devolve o ponto de tela para onde a esfera deve voltar (centro do painel)
  leitorAberto() -> bool, retanguloLeitor() -> DOMRect
  feixe(de:{x,y}|null, ate:{x,y}|null)                 // desenha/atualiza o feixe SVG (chamado a cada quadro pelo app enquanto aberto); null esconde
  leque(nos, origem:{x,y}, posicoes:[{x,y}])           // cartões em arco com cascata a partir da origem; [] recolhe
  resultados(nos, q), dica(no|null, {x,y}), aviso(texto, ms=3200)
  resposta: { abrir(pergunta), texto(md), status(t), usadas(nos), fechar() }   // painel do Claude; links [[...]] chamam onLink
  menu(aberto?), visao('robo'|'aneis')
}
```
Teclado: `/` foca a busca; setas + Enter nos resultados; Esc fecha (leitor → menu → leque → resposta);
cliques em `a.wl` em qualquer lugar chamam `onLink(data-wl)`.

### js/aneis.js (ANÉIS) — porte do desenho em anéis antigo (canvas 2D), só tema escuro
```
export function criarAneis(canvas, opts) -> Aneis   // opts = { onSelecionar(no|null), onHover(no|null,{x,y}), reduzido }
Aneis = { setGrafo(G), destacar(ids|null), selecionar(no|null), centralizar(), ativar(bool), redimensionar(), destruir() }
```
Mesmo visual do antigo (anéis, varredura, logo no centro, pan/zoom/pinça, duplo clique aproxima), cores do §3.

### js/app.js (APP)
Ordem de carga: (1) iniciarUI; (2) tentar criarRobo (se falhar ou o import do three falhar: mostrar
`#semWebgl`, visão anéis); (3) dados: localhost → buscarVaultLocal (+ ouvirMudancas); senão idbGet('vault');
senão vaultExemplo (marcado "Exemplo" nas stats e no menu); (4) setGrafo em robô e anéis; boot; stats animado;
trilho; recentes. Botão `#recarregar` e `#loadBtn` → `#pasta.click()`; ao ler: idbSet, setGrafo, boot com
`recarga:true` e `frescos` = mudancas(). `#demoBtn`: idbDel e exemplo.
Abrir nota: `ui.abrirLeitor` + `robo.puxar` coordenados (esfera chega → painel abre); `robo.base('lendo')`,
`robo.deslocar(-0.18)` no desktop (largura ≥ 900), feixe por quadro de `robo.testa()` até a borda esquerda do
painel; fechar faz o inverso. CLAUDE.md (onLogo) abre o nó core. Departamento → leque com posições em arco
calculadas em volta de `robo.cupula()` (cabendo na tela; no celular, em grade embaixo). Busca escolhida →
abrir. Link sem nota → `robo.expressao('alerta', 1200)` + aviso "A nota "X" ainda não existe no vault.".
Pergunte ao cérebro: porte do antigo (RULES, TOOLS buscar_notas/ler_nota, ERR, turns, AbortController),
ligado às reações do robô (§2). `hidden`/visível conforme `claude.use('sample')`.
Esc, foco e estado sempre consistentes; nada quebra se o robô não existir (anéis assumem).

---------------------------------------------------------------------------------------------------
## 6. Critérios de pronto
- Abre em menos de 1 s até o primeiro quadro (sem esperar fontes); boot completo em ~3 s; 60 qps num
  notebook comum com 112 notas; cai para "baixa" sozinho se precisar.
- Zero erro no console; nada externo além do jsdelivr (three) e Google Fonts.
- Todas as funções do antigo continuam: vault guardado no navegador, abrir pasta, exemplo, ao vivo local,
  busca, leitor com frontmatter/markdown/tabelas/links, conexões, Obsidian, copiar caminho, departamentos,
  pergunte ao cérebro com as duas ferramentas, notas novas piscando.
- 400 px de largura: nada corta, nada rola de lado; leitor vira folha de baixo para cima (85% da altura).
- `prefers-reduced-motion`: sem voo, sem digitação, sem giro automático; tudo continua usável.
