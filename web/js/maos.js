/* =====================================================================================================
   js/maos.js — Modo Mãos (MOTOR): câmera, MediaPipe, filtro, máquina de gestos, mouse sintético, simulador
   Especificação: MAOS.md §1 e §3. ES module sem build. Nada daqui roda na abertura da página: o app importa este
   arquivo só quando a pessoa liga o modo, e o MediaPipe só é baixado dentro de iniciarMaos().

   API (MAOS.md §3)
     iniciarMaos(opts) -> Promise<Maos>        lança Error com .codigo (ver MENSAGENS)
       opts = { video, simular, onQuadro(q), onGesto(nome, dados), onEstado(estado, detalhe), onProgresso(fase, pct),
                sinal (AbortSignal, opcional: cancela o carregamento, .codigo 'cancelado'),
                sensibilidade, cliquePorEspera, maoPrincipal (opcionais: o mesmo que configurar) }
     Maos = { pausar(bool), parar(), configurar({sensibilidade, cliquePorEspera, maoPrincipal}), estado(),
              extras: simulado, delegate ('GPU'|'CPU'|null), info(), simulador (só com simular) }

   Estados (onEstado):  'carregando' {fase:'camera'|'modelo'|'simulador'} · 'pronto' {simulado, delegate} (ligado,
     sem mão) · 'rastreando' {lado} (mão principal na tela) · 'pausado' · 'erro' {codigo, mensagem} · 'parado'
   Fases (onProgresso): 'camera' 0→1 ("Abrindo a câmera…") · 'modelo' 0→1 (biblioteca + WASM + modelo de 8 MB, com a
     porcentagem real do download) · 'mao' 0 ("Mostre a mão aberta para a câmera")
   Gestos (onGesto): clique {x,y,alvo,porEspera?} · cliqueCancelado {x,y} (pinça segurada demais, sem arrastar) ·
     arrasteInicio {x,y,alvo,modo:'rolar'|'ponteiro'|'faixa'|null} · arraste {dx,dy,x,y} · arrasteFim {x,y} ·
     espera {x,y,progresso,tipo?} (tipo 'fechar' = a mão aberta parada contando para fechar) · fechar {x,y} ·
     deslizar {direcao,vel,dx,dy,x,y} · agarrarInicio/agarrar/agarrarFim {x,y} · joinha {x,y} · vitoria {x,y} ·
     entrou {x,y,lado} · saiu {x,y} (todos com t = performance.now() do quadro). "mover" é o próprio onQuadro.
   q (onQuadro, a cada quadro detectado, ≤ ~30/s): { t, qps, simulado, principal, maos:[{ id (trilha), lado (votado),
     principal, pontos[21]{x,y,z} (px de tela, espelhado), pontosVideo[21]{x,y} (0..1, espelhado), cursor{x,y},
     vel{x,y} (px/s), escala (px), gesto (rótulo estável do MediaPipe), rotulo (em português, p/ o cartão), pinca 0..1,
     pincando, arrastando, agarrando, fora (a mão saiu da zona ativa: o cursor fica na borda e nada dispara) }] }

   Cursor: o ponto médio polegar-indicador com a mão aberta; quando a pinça começa a fechar (razão < pincaAbre), passa a
   seguir a palma (0, 5, 9, 13, 17) com o deslocamento do último quadro aberto, porque o ponto médio anda quando os
   dedos se juntam e se separam (clique que vira arraste, âncora fora do alvo, pulo no fim da rolagem).

   Simulador (opts.simular, só em localhost/arquivo): mão de mentira pelo mouse real; segurar P = pinça, A = mão
   aberta, F = punho, J = joinha, V = vitória; setas = deslizar; o mouse saindo da janela = mão some. Gera os mesmos
   21 pontos no formato do MediaPipe e passa pelo mesmo núcleo, máquina e mouse sintético. Maos.simulador expõe
   { mover(x,y), pose(nome|null), deslizar(dir), sumir(), aparecer() } para teste automatizado.

   Mouse sintético: pointermove/mousemove no elemento debaixo do cursor (borbulha até window, onde o robô, o app e a
   dica escutam), over/out/enter/leave nas trocas, classe .mao-hover no clicável mais próximo, clique completo
   (pointerdown → mousedown → pointerup → mouseup → click, com coordenadas, também nos canvas), arraste que rola a área
   rolável debaixo da pinça ou faz pointerdown/move/up (pan dos anéis, alça da folha). Os eventos levam
   e.daMao = true. Nada é disparado sem mão principal.

   Desempenho: o GPU é medido no carregamento; se for WebGL por software (lento), fica a CPU. O reconhecimento roda a
   ≤ ~30/s e usa no máximo ~50% da linha principal (máquina fraca: menos quadros, a cena 3D não trava). O log interno do
   WASM do MediaPipe (linhas "I…"/"W…") é calado no console; o resto passa.
   ===================================================================================================== */

export const URL_BUNDLE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
export const URL_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
export const URL_MODELO = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const TAMANHO_MODELO = 8_400_000;      // aproximado, só para a barra quando o servidor não manda o tamanho
const TAMANHO_WASM = 9_400_000;

export const MENSAGENS = Object.freeze({
  'artifact': 'Os gestos usam a câmera, e o claude.ai não libera a câmera para páginas publicadas. Abra o arquivo baixado (Cerebro da Lube.html) no Chrome ou no Edge.',
  'negado': 'Você não liberou a câmera. Clique no cadeado da barra de endereço e permita a câmera.',
  'em-uso': 'A câmera está sendo usada por outro programa (Teams, Zoom…). Feche e tente de novo.',
  'sem-camera': 'Não encontrei nenhuma câmera neste computador. Conecte uma webcam e tente de novo.',
  'sem-modelo': 'Não consegui baixar o reconhecimento de mãos. Confira a internet.',
  'sem-gpu': 'Este computador não conseguiu rodar o reconhecimento de mãos. Atualize o Chrome ou o Edge e tente de novo.',
  'sem-suporte': 'Este navegador não liga a câmera nesta página. Abra o arquivo baixado no Chrome ou no Edge.',
  'cancelado': 'A câmera não foi ligada.',
});
const MSG_CAMERA_CAIU = 'A câmera foi desligada ou desconectada. Conecte de novo e tente outra vez.';

/* Zona ativa do vídeo (já espelhado) que vira a tela inteira: ~39 × 22 cm de mão a um braço da câmera, o mesmo
   ganho nos dois eixos (vídeo 4:3, tela 16:9), e o pulso ainda dentro do quadro com o cursor no pé da tela. Ela anda
   ZONA_LADO para o lado do ombro da mão que comanda (direita: para a direita no vídeo espelhado) e só troca quando
   a mão entra (ou outra mão assume), para o cursor não pular. */
export const ZONA = Object.freeze({ x0: 0.22, x1: 0.78, y0: 0.24, y1: 0.66 });
export const ZONA_LADO = 0.07;

/* Todos os tempos e limiares (MAOS.md §3). Tempos em ms; o que é distância ou velocidade vai em "escala" (o palmo
   da mão na tela, pulso → base do dedo médio, ~10 cm de mão): assim o teste vale igual em qualquer tamanho de tela. */
export const LIMIARES = Object.freeze({
  // pinça: distância 4↔8 / palmo, com histerese. Fecha < 0,25 (encostado: < 0,22 já fecha num quadro só), abre
  // > 0,48 (> 0,6 abre num quadro). Só fecha se a razão passou de pincaAbre há ≤ 800 ms: é um movimento, não pose.
  pincaFecha: 0.25, pincaFechaJa: 0.22, pincaAbre: 0.48, pincaAbreJa: 0.6, pincaQuadros: 2, pincaAbertaMs: 800,
  pincaAncoraMs: 250, pincaSolta: 0.08,                         // âncora = último quadro aberto; soltando = mín + 0,08
  indicadorDobrado: 0.95,                                      // ponta do indicador perto do pulso = punho, não pinça
  rotuloScore: 0.5, rotuloQuadros: 2,                           // rótulo do MediaPipe só vale depois de 2 quadros
  cliqueMaxMs: 1200, cliqueMinPx: 28, cliqueEscala: 0.12,       // arraste só depois de max(28 px, 0,12 palmo)
  esperaMs: 1200, esperaPx: 12,
  // fechar: arma com a mão fechada pela geometria por 350 ms e dispara com a palma aberta parada 700 ms (parada =
  // sem derivar 0,25 palmo e sem pico acima de 1,5 palmo/s); o anel do cursor enche a partir de 30%
  fecharMs: 700, fecharArmeMs: 350, fecharDeriva: 0.25, fecharVelEscala: 1.5, fecharAvisoFrac: 0.3,
  // deslizar: palma aberta de verdade (Open_Palm estável há 100 ms), > 8 palmos/s, ≥ 1,2 palmo, em linha
  deslizarVelEscala: 8, deslizarMinMs: 120, deslizarMaxMs: 400, deslizarMinEscala: 1.2, deslizarPalmaMs: 100,
  deslizarLinear: 0.75, deslizarEixo: 1.5, deslizarAberta: 0.6, deslizarRetornoMs: 1000, deslizarEntradaMs: 400,
  agarrarMs: 300, agarrarSoltaMs: 200,
  joinhaMs: 500, vitoriaMs: 800, seguraDeriva: 0.25,
  travaMs: 600,                                                 // entre repetições do mesmo gesto
  entrouQuadros: 2, perdaMs: 400, saiuMs: 700, trilhaMs: 450,   // trilha vive mais que a perda: a mesma mão volta
  ladoQuadros: 6, ladoScore: 0.8,                               // o lado só troca depois de 6 quadros firmes
  assumirPalmo: 0.09, assumirFrac: 0.6, assumirMemoriaMs: 10000, // mão nova só comanda se for grande (perto)
  foraMargem: 0.04, foraVolta: 0.02,                            // cursor além de 4% da tela = fora da zona
});

const PADRAO = Object.freeze({ sensibilidade: 0.5, cliquePorEspera: false, maoPrincipal: 'qualquer' });
const ROTULO_PT = { None: 'Mão', Closed_Fist: 'Punho', Open_Palm: 'Mão aberta', Pointing_Up: 'Apontando', Thumb_Down: 'Polegar para baixo', Thumb_Up: 'Joinha', Victory: 'Vitória', ILoveYou: 'Eu te amo' };
/* O MediaPipe classifica a mão supondo imagem de selfie espelhada; o vídeo cru da webcam não é espelhado, então o
   "Left" dele é a mão direita da pessoa. */
const LADO_CRU = { Left: 'Direita', Right: 'Esquerda' };

/* ------------------------------------------- utilidades ------------------------------------------- */
const temJanela = typeof window !== 'undefined' && typeof document !== 'undefined';
const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function chamar(fn, ...args) {
  if (typeof fn !== 'function') return undefined;
  try { return fn(...args); } catch (e) { console.error('[maos]', e); return undefined; }
}
function erro(codigo, causa) {
  const e = new Error(MENSAGENS[codigo] || codigo);
  e.codigo = codigo;
  if (causa) e.causa = causa;
  return e;
}
export function ehLocal() {
  if (!temJanela) return false;
  try {
    if (location.protocol === 'file:') return true;
    return /^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/i.test(location.hostname);
  } catch { return false; }
}
const ehRemotoHttps = () => { try { return temJanela && location.protocol === 'https:' && !ehLocal(); } catch { return false; } };
function sensibilidadeNum(s) {
  if (s === null || s === undefined || s === '') return PADRAO.sensibilidade;
  if (s === 'baixa') return 0.2;
  if (s === 'media' || s === 'média') return 0.5;
  if (s === 'alta') return 0.8;
  const n = Number(s);
  return Number.isFinite(n) ? limitar(n, 0, 1) : PADRAO.sensibilidade;
}
/* sensibilidade 0..1 → parâmetros do One Euro (0,5 → min cutoff 1,2 e beta 0,02, os da especificação) */
export function parametrosFiltro(sens) {
  const s = sensibilidadeNum(sens);
  return { minCutoff: 0.6 + 1.2 * s, beta: 0.008 + 0.024 * s, dCutoff: 1 };
}

/* ------------------------------------------- filtro One Euro ------------------------------------------- */
/* Casiez, Roussel e Vogel (2012): passa-baixa cujo corte sobe com a velocidade. Parado: suaviza o tremor;
   rápido: quase sem atraso. t em segundos. */
export class FiltroOneEuro {
  constructor({ minCutoff = 1.2, beta = 0.02, dCutoff = 1 } = {}) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.reiniciar();
  }
  static alfa(corte, dt) { const tau = 1 / (2 * Math.PI * corte); return 1 / (1 + tau / dt); }
  reiniciar() { this.x = null; this.dx = 0; this.t = null; }
  filtrar(valor, t) {
    if (this.x === null || this.t === null) { this.x = valor; this.t = t; this.dx = 0; return valor; }
    const dt = t - this.t;
    if (!(dt > 0)) return this.x;
    this.t = t;
    const ad = FiltroOneEuro.alfa(this.dCutoff, dt);
    this.dx = ad * ((valor - this.x) / dt) + (1 - ad) * this.dx;
    const a = FiltroOneEuro.alfa(this.minCutoff + this.beta * Math.abs(this.dx), dt);
    this.x = a * valor + (1 - a) * this.x;
    return this.x;
  }
}
/* Versão 2D: o corte depende do módulo da velocidade (igual nos dois eixos, o cursor não "entorta"). */
export class FiltroOneEuro2D {
  constructor(params = {}) { this.configurar(params); this.reiniciar(); }
  configurar({ minCutoff = 1.2, beta = 0.02, dCutoff = 1 } = {}) { this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff; }
  reiniciar() { this.x = null; this.y = null; this.dx = 0; this.dy = 0; this.t = null; }
  filtrar(x, y, t) {
    if (this.x === null || this.t === null) { this.x = x; this.y = y; this.t = t; this.dx = this.dy = 0; return { x, y }; }
    const dt = t - this.t;
    if (!(dt > 0)) return { x: this.x, y: this.y };
    this.t = t;
    const ad = FiltroOneEuro.alfa(this.dCutoff, dt);
    this.dx = ad * ((x - this.x) / dt) + (1 - ad) * this.dx;
    this.dy = ad * ((y - this.y) / dt) + (1 - ad) * this.dy;
    const a = FiltroOneEuro.alfa(this.minCutoff + this.beta * Math.hypot(this.dx, this.dy), dt);
    this.x = a * x + (1 - a) * this.x;
    this.y = a * y + (1 - a) * this.y;
    return { x: this.x, y: this.y };
  }
}

/* ------------------------------------------- geometria da mão ------------------------------------------- */
/* Converte o resultado do GestureRecognizer (ou do simulador, que tem o mesmo formato) na entrada do núcleo. */
export function entradaDoMediaPipe(res, video) {
  const maos = [];
  const lm = (res && res.landmarks) || [];
  const lados = (res && (res.handedness || res.handednesses)) || [];
  const gestos = (res && res.gestures) || [];
  for (let i = 0; i < lm.length; i++) {
    const pts = lm[i];
    if (!pts || pts.length < 21) continue;
    const ld = (lados[i] && lados[i][0]) || null;
    const gs = (gestos[i] && gestos[i][0]) || null;
    maos.push({
      pontos: pts,
      lado: LADO_CRU[ld && (ld.categoryName || ld.displayName)] || 'Direita',
      ladoScore: ld ? ld.score : 0,
      gesto: (gs && gs.categoryName) || 'None',
      gestoScore: gs ? gs.score : 0,
    });
  }
  return { maos, video: { largura: (video && video.largura) || 640, altura: (video && video.altura) || 480 } };
}

/* Medidas de uma mão no espaço do vídeo (não dependem da zona): pontos espelhados, pinça, dedos esticados, palmo. */
const IDS_PALMA = [0, 5, 9, 13, 17];
const mediaDe = (ids, arr) => { let x = 0, y = 0; for (const i of ids) { x += arr[i].x; y += arr[i].y; } return { x: x / ids.length, y: y / ids.length }; };
export function medirMao(m, vw = 640, vh = 480) {
  const P = m.pontos;
  const pontosVideo = new Array(21);
  for (let i = 0; i < 21; i++) pontosVideo[i] = { x: 1 - P[i].x, y: P[i].y };
  // distâncias em 3D no espaço do vídeo com o aspecto corrigido (z do MediaPipe tem a escala do x)
  const d3 = (a, b) => Math.hypot((P[a].x - P[b].x) * vw, (P[a].y - P[b].y) * vh, ((P[a].z || 0) - (P[b].z || 0)) * vw);
  const palmo = Math.max(d3(0, 9), 1e-6);
  const razao = d3(4, 8) / palmo;
  let esticados = 0;
  for (const [pip, tip] of [[6, 8], [10, 12], [14, 16], [18, 20]]) if (d3(0, tip) > d3(0, pip) * 1.12) esticados++;
  const score = Number.isFinite(m.gestoScore) ? m.gestoScore : 1;
  return {
    bruto: P,
    lado: m.lado || 'Direita',
    ladoScore: Number.isFinite(m.ladoScore) ? m.ladoScore : 1,
    gesto: m.gesto || 'None',
    gestoScore: score,
    pontosVideo,
    palmaN: mediaDe(IDS_PALMA, pontosVideo),
    palmoN: palmo / Math.max(1, vh),          // palmo em frações da altura do vídeo (~0,17 a um braço da câmera)
    razao,
    pinca: limitar((0.8 - razao) / 0.55, 0, 1),
    indicadorDobrado: d3(0, 8) / palmo < LIMIARES.indicadorDobrado,
    aberta: esticados >= 4,
  };
}
/* Leva a mão medida para a tela pela zona ativa: pontos, ponto médio polegar-indicador, palma e palmo em px. */
export function projetarMao(d, zona, W, H) {
  const P = d.bruto;
  const lx = zona.x1 - zona.x0, ly = zona.y1 - zona.y0;
  const pontos = new Array(21);
  for (let i = 0; i < 21; i++) {
    const p = P[i];
    pontos[i] = { x: (1 - p.x - zona.x0) / lx * W, y: (p.y - zona.y0) / ly * H, z: (p.z || 0) * W / lx };
  }
  d.pontos = pontos;
  d.cursorBruto = { x: (pontos[4].x + pontos[8].x) / 2, y: (pontos[4].y + pontos[8].y) / 2 };
  d.palma = mediaDe(IDS_PALMA, pontos);
  d.escala = Math.hypot(pontos[0].x - pontos[9].x, pontos[0].y - pontos[9].y);
  return d;
}
/* As duas juntas (para testes e para quem só quer as medidas). ctx = {W, H, zona, vw, vh}. */
export function analisarMao(m, ctx) {
  return projetarMao(medirMao(m, ctx.vw, ctx.vh), ctx.zona, ctx.W, ctx.H);
}

/* ------------------------------------------- máquina de gestos ------------------------------------------- */
/* Pura (sem DOM): recebe a mão principal já medida e filtrada, quadro a quadro, e devolve os eventos.
   f = { cursor{x,y}, ancora{x,y}|null (palma + deslocamento, sem filtro: onde a pinça mira), palma{x,y},
         velPalma{x,y}, escala (palmo em px, suavizado), razao, indicadorDobrado, aberta, gesto, gestoScore, lado,
         clicavel, fora, W, H }
   ou null quando não há mão principal neste quadro. */
export class MaquinaGestos {
  constructor(cfg = {}, limiares = LIMIARES) {
    this.L = limiares;
    this.cfg = { ...PADRAO };
    this.configurar(cfg);
    this.trava = {};
    this.ultDesliza = { dir: null, t: -1e9 };
    this.presente = false;
    this.quadrosVista = 0;
    this.tPerdida = null;
    this.tVista = null;
    this.finalizado = false;
    this.tEntrou = -1e9;
    this.cursor = null;
    this.H = 0;
    this._zerarRotulo(0);
    this._zerarAcoes();
    this._zerarPoses();
  }
  configurar(cfg = {}) {
    if ('sensibilidade' in cfg) this.cfg.sensibilidade = sensibilidadeNum(cfg.sensibilidade);
    if ('cliquePorEspera' in cfg) this.cfg.cliquePorEspera = !!cfg.cliquePorEspera;
    if ('maoPrincipal' in cfg && /^(qualquer|direita|esquerda)$/.test(cfg.maoPrincipal)) this.cfg.maoPrincipal = cfg.maoPrincipal;
    return { ...this.cfg };
  }
  _zerarRotulo(t) { this.rot = { atual: 'None', tDesde: t, cand: null, nCand: 0, tCand: t }; }
  _zerarAcoes() {
    this.pz = { fechada: false, abaixoN: 0, acimaN: 0, tAbaixo: 0, ancoraAbaixo: null, tFechou: 0, tAcima: 0, ancora: null, arrastando: false, bloqueada: false, ultArraste: null, tUltAberta: -1e9, ultAberto: null, razaoMin: 1 };
    this.ag = { ativo: false, tSolta: null };
    this.esp = { ref: null, t0: 0, ativa: false, travadaRef: null };
    this.dz = { ativo: false, t0: 0, p0: null, pUlt: null, caminho: 0, n: 0, nAberta: 0, tUltRapido: 0, pUltRapido: null, invalido: false, pAnt: null, tAnt: 0, esc: 0 };
  }
  _zerarPoses() {
    this.fe = { armado: false, tNaoPalma: null, tRapido: -1e9, ref: null, avisando: false };
    this.seg = { joinha: false, vitoria: false, ref: null, t0: 0, pose: null };
  }
  _pos() { return this.cursor ? { x: this.cursor.x, y: this.cursor.y } : { x: 0, y: 0 }; }
  _emitir(ev, nome, dados, t) {
    if (t - (this.trava[nome] ?? -1e9) < this.L.travaMs) return false;
    this.trava[nome] = t;
    ev.push([nome, dados]);
    return true;
  }
  /* Termina o que é contínuo (arraste, punho, espera, contagem do fechar) sem disparar clique. */
  _finalizar(ev) {
    const p = this._pos();
    if (this.pz.arrastando) ev.push(['arrasteFim', p]);
    if (this.ag.ativo) ev.push(['agarrarFim', p]);
    if (this.esp.ativa) ev.push(['espera', { x: p.x, y: p.y, progresso: 0 }]);
    if (this.fe.avisando) { this.fe.avisando = false; ev.push(['espera', { x: p.x, y: p.y, progresso: 0, tipo: 'fechar' }]); }
    const fechada = this.pz.fechada;
    this._zerarAcoes();
    this.pz.bloqueada = fechada;
  }
  /* A mão que comanda mudou (outra mão, ou a de antes voltou como trilha nova): fecha o que estava aberto. */
  trocouMao(t) {
    const ev = [];
    if (!this.presente) return this._saida(ev, t);
    this._finalizar(ev);
    this.pz.bloqueada = true;
    this._zerarRotulo(t);
    this._zerarPoses();
    return this._saida(ev, t);
  }
  /* Desligar/pausar: termina tudo e avisa que a mão saiu. */
  reiniciar(t) {
    const ev = [];
    if (this.presente) { this._finalizar(ev); ev.push(['saiu', this._pos()]); }
    this.presente = false; this.quadrosVista = 0; this.tPerdida = null; this.finalizado = false;
    this._zerarRotulo(t); this._zerarAcoes(); this._zerarPoses();
    return this._saida(ev, t);
  }
  passo(f, t) {
    const ev = [], L = this.L;
    if (!f) {
      if (this.quadrosVista > 0 || this.presente) {
        this.quadrosVista = 0;
        // o tempo de sumiço conta do último quadro em que a mão foi vista. Um deslize em curso é cancelado, não
        // avaliado: a mão que baixa para descansar (rápida, reta e ainda "aberta") não vira "deslizar para baixo"
        if (this.tPerdida === null) { this.tPerdida = this.tVista ?? t; if (this.presente) this.dz.ativo = false; }
        if (this.presente && !this.finalizado && t - this.tPerdida >= L.perdaMs - 0.5) { this._finalizar(ev); this.finalizado = true; }
        if (this.presente && t - this.tPerdida >= L.saiuMs - 0.5) {
          this.presente = false;
          ev.push(['saiu', this._pos()]);
          this.finalizado = false;
          this._zerarRotulo(t); this._zerarAcoes(); this._zerarPoses();
        }
      }
      return this._saida(ev, t);
    }
    this.tPerdida = null;
    this.tVista = t;
    this.quadrosVista++;
    this.cursor = { x: f.cursor.x, y: f.cursor.y };
    if (f.H > 0) this.H = f.H;
    this._rotulo(f, t);
    if (!this.presente) {
      if (this.quadrosVista < L.entrouQuadros) return this._saida(ev, t);
      this.presente = true; this.tEntrou = t; this.finalizado = false;
      this._zerarAcoes(); this._zerarPoses();
      this.pz.bloqueada = f.razao < L.pincaAbre;          // entrou já pinçando: só vale depois de abrir
      this.dz.pAnt = { x: f.palma.x, y: f.palma.y }; this.dz.tAnt = t;
      ev.push(['entrou', { x: f.cursor.x, y: f.cursor.y, lado: f.lado || 'Direita' }]);
      return this._saida(ev, t);
    }
    if (this.finalizado) { this.finalizado = false; this.pz.bloqueada = f.razao < L.pincaAbre; }
    this._pinca(f, t, ev);
    this._agarrar(f, t, ev);
    this._desliza(f, t, ev);
    this._fechar(f, t, ev);
    this._segurar(f, t, ev);
    this._espera(f, t, ev);
    return this._saida(ev, t);
  }
  _rotulo(f, t) {
    const L = this.L, r = this.rot;
    const sc = Number.isFinite(f.gestoScore) ? f.gestoScore : 1;
    const g = f.gesto && sc >= L.rotuloScore ? f.gesto : 'None';
    if (g === r.atual) { r.cand = null; r.nCand = 0; return; }
    if (g === r.cand) r.nCand++;
    else { r.cand = g; r.nCand = 1; r.tCand = t; }
    if (r.nCand >= L.rotuloQuadros) {
      r.atual = g; r.tDesde = r.tCand; r.cand = null; r.nCand = 0;
      this.seg.joinha = false; this.seg.vitoria = false;
    }
  }
  _pinca(f, t, ev) {
    const L = this.L, pz = this.pz, r = f.razao;
    // a geometria decide (o classificador não tem classe de pinça e às vezes chama a pinça de punho)
    const permitido = !f.indicadorDobrado && !this.ag.ativo;
    if (r >= L.pincaAbre) { pz.tUltAberta = t; pz.ultAberto = { x: f.cursor.x, y: f.cursor.y, t }; }
    if (pz.bloqueada) {
      if (r > L.pincaAbre) pz.bloqueada = false;
      pz.abaixoN = 0;
      return;
    }
    if (!pz.fechada) {
      // só fecha vindo de uma mão aberta há pouco (a pinça é um movimento); fora da zona, não fecha
      const pode = permitido && !f.fora && r < L.pincaFecha && (pz.abaixoN > 0 || t - pz.tUltAberta <= L.pincaAbertaMs);
      if (!pode) { pz.abaixoN = 0; return; }
      if (pz.abaixoN === 0) { pz.tAbaixo = t; pz.ancoraAbaixo = f.ancora ? { x: f.ancora.x, y: f.ancora.y } : { x: f.cursor.x, y: f.cursor.y }; }
      pz.abaixoN++;
      if (r >= L.pincaFechaJa && pz.abaixoN < L.pincaQuadros) return;   // encostado (< 0,22) fecha num quadro só
      // a âncora é onde a mão mirava antes de os dedos se juntarem: a palma com o deslocamento do quadro mais aberto
      // (o núcleo manda) ou, sem ele, o cursor do último quadro aberto
      const ua = pz.ultAberto;
      pz.ancora = f.ancora ? pz.ancoraAbaixo : ua && pz.tAbaixo - ua.t <= L.pincaAncoraMs ? { x: ua.x, y: ua.y } : pz.ancoraAbaixo;
      pz.fechada = true; pz.tFechou = pz.tAbaixo;
      pz.arrastando = false; pz.acimaN = 0; pz.abaixoN = 0; pz.razaoMin = r;
      if (this.esp.ativa) { this.esp.ativa = false; ev.push(['espera', { x: f.cursor.x, y: f.cursor.y, progresso: 0 }]); }
      this.esp.ref = null;
      return;
    }
    if (!permitido) {                                         // virou punho com a pinça fechada: cancela, sem clique
      if (pz.arrastando) ev.push(['arrasteFim', { x: f.cursor.x, y: f.cursor.y }]);
      pz.fechada = false; pz.arrastando = false; pz.acimaN = pz.abaixoN = 0; pz.bloqueada = true;
      return;
    }
    if (r < pz.razaoMin) pz.razaoMin = r;
    if (r > L.pincaAbre) {
      if (pz.acimaN === 0) pz.tAcima = t;
      pz.acimaN++;
      if (r <= L.pincaAbreJa && pz.acimaN < L.pincaQuadros) return;   // bem aberta (> 0,6) solta num quadro só
      pz.fechada = false; pz.acimaN = pz.abaixoN = 0;
      // soltar a pinça desarma o "fechar": a mão que relaxa aberta para ler não fecha o que acabou de abrir
      this.fe.armado = false; this.fe.tNaoPalma = null;
      const p = { x: pz.ancora.x, y: pz.ancora.y };
      if (pz.arrastando) { pz.arrastando = false; ev.push(['arrasteFim', { x: f.cursor.x, y: f.cursor.y }]); }
      else if (pz.tAcima - pz.tFechou <= L.cliqueMaxMs) this._emitir(ev, 'clique', p, t);
      else ev.push(['cliqueCancelado', p]);                    // segurou demais sem arrastar: avisa, sem clicar
      return;
    }
    pz.acimaN = 0;
    // os dedos já começaram a abrir: daqui até soltar não começa arraste nem rola (o ponto médio anda na soltura)
    const soltando = r > pz.razaoMin + L.pincaSolta;
    const limite = Math.max(L.cliqueMinPx, L.cliqueEscala * (f.escala || 0));
    if (!pz.arrastando && !soltando && dist(f.cursor, pz.ancora) > limite) {
      pz.arrastando = true;
      pz.ultArraste = { x: pz.ancora.x, y: pz.ancora.y };
      ev.push(['arrasteInicio', { x: pz.ancora.x, y: pz.ancora.y }]);
    }
    if (pz.arrastando) {
      const dx = f.cursor.x - pz.ultArraste.x, dy = f.cursor.y - pz.ultArraste.y;
      if (!soltando && (dx || dy)) ev.push(['arraste', { dx, dy, x: f.cursor.x, y: f.cursor.y }]);
      pz.ultArraste = { x: f.cursor.x, y: f.cursor.y };
    }
  }
  _agarrar(f, t, ev) {
    const L = this.L, ag = this.ag;
    const rotulo = this.rot.atual === 'Closed_Fist';
    const p = { x: f.cursor.x, y: f.cursor.y };
    if (!ag.ativo) {
      // punho de verdade: o rótulo e a ponta do indicador perto do pulso (na pinça ela fica a 1,1–1,45 palmo)
      if (rotulo && f.indicadorDobrado && t - this.rot.tDesde >= L.agarrarMs && !this.pz.fechada) {
        ag.ativo = true; ag.tSolta = null;
        if (this.esp.ativa) { this.esp.ativa = false; ev.push(['espera', { x: p.x, y: p.y, progresso: 0 }]); }
        ev.push(['agarrarInicio', p]);
      }
      return;
    }
    if (rotulo) ag.tSolta = null;
    else if (ag.tSolta === null) ag.tSolta = t;
    if (ag.tSolta !== null && t - ag.tSolta >= L.agarrarSoltaMs) { ag.ativo = false; ag.tSolta = null; ev.push(['agarrarFim', p]); }
    else ev.push(['agarrar', p]);
  }
  _desliza(f, t, ev) {
    const L = this.L, dz = this.dz, p = f.palma;
    if (!dz.pAnt) { dz.pAnt = { x: p.x, y: p.y }; dz.tAnt = t; return; }
    const dt = (t - dz.tAnt) / 1000;
    const v = dt > 0 ? Math.hypot(p.x - dz.pAnt.x, p.y - dz.pAnt.y) / dt : 0;
    const esc = f.escala > 0 ? f.escala : 300;
    const vMin = L.deslizarVelEscala * esc;
    // palma aberta de verdade: a mão de cursor (razão 0,4–0,7, pronta para pinçar) não desliza
    const aberta = this.rot.atual === 'Open_Palm' || (f.aberta && f.razao > 0.8);
    const livre = !this.pz.fechada && !this.ag.ativo;
    if (!dz.ativo) {
      // só começa com Open_Palm estável há 100 ms e não logo depois de a mão entrar (ela sobe aberta, como o cartão pede)
      const pode = livre && t - this.tEntrou >= L.deslizarEntradaMs && this.rot.atual === 'Open_Palm' && t - this.rot.tDesde >= L.deslizarPalmaMs;
      if (v > vMin && pode) {
        dz.ativo = true; dz.invalido = false; dz.esc = esc;
        dz.t0 = dz.tAnt; dz.p0 = { x: dz.pAnt.x, y: dz.pAnt.y };
        dz.caminho = Math.hypot(p.x - dz.pAnt.x, p.y - dz.pAnt.y);
        dz.pUlt = { x: p.x, y: p.y }; dz.n = 1; dz.nAberta = aberta ? 1 : 0;
        dz.tUltRapido = t; dz.pUltRapido = { x: p.x, y: p.y };
      }
    } else if (v > L.deslizarVelEscala * dz.esc * 0.5) {
      if (!livre) dz.invalido = true;
      dz.caminho += Math.hypot(p.x - dz.pUlt.x, p.y - dz.pUlt.y);
      dz.pUlt = { x: p.x, y: p.y }; dz.n++; if (aberta) dz.nAberta++;
      dz.tUltRapido = t; dz.pUltRapido = { x: p.x, y: p.y };
    } else this._fecharDesliza(ev, t);
    dz.pAnt = { x: p.x, y: p.y }; dz.tAnt = t;
  }
  _fecharDesliza(ev, t) {
    const L = this.L, dz = this.dz;
    if (!dz.ativo) return;
    dz.ativo = false;
    if (dz.invalido) return;
    const d = dz.tUltRapido - dz.t0;
    const Dx = dz.pUltRapido.x - dz.p0.x, Dy = dz.pUltRapido.y - dz.p0.y, D = Math.hypot(Dx, Dy);
    if (d < L.deslizarMinMs || d > L.deslizarMaxMs) return;
    if (D < L.deslizarMinEscala * dz.esc || D / Math.max(dz.caminho, 1) < L.deslizarLinear) return;
    if (dz.nAberta / Math.max(dz.n, 1) < L.deslizarAberta) return;
    if (this.H > 0 && (dz.pUltRapido.y > this.H || dz.pUltRapido.y < 0)) return;   // a palma saiu da tela: era a mão baixando
    const ax = Math.abs(Dx), ay = Math.abs(Dy);
    let dir = null;
    if (ax >= ay * L.deslizarEixo) dir = Dx > 0 ? 'direita' : 'esquerda';
    else if (ay >= ax * L.deslizarEixo) dir = Dy > 0 ? 'baixo' : 'cima';
    if (!dir) return;
    const oposto = { direita: 'esquerda', esquerda: 'direita', cima: 'baixo', baixo: 'cima' }[dir];
    if (this.ultDesliza.dir === oposto && t - this.ultDesliza.t < L.deslizarRetornoMs) return;   // a volta do braço
    if (this._emitir(ev, 'deslizar', { direcao: dir, vel: Math.round(D / d * 1000), dx: Dx, dy: Dy, x: dz.pUltRapido.x, y: dz.pUltRapido.y }, t)) {
      this.ultDesliza = { dir, t };
      this.fe.armado = false;                                  // a mão que deslizou aberta não fecha nada ao parar
    }
  }
  /* "Fechar": arma com a mão fechada pela geometria (350 ms sem os 4 dedos esticados) e dispara com a palma aberta
     parada por 700 ms. Parada = a palma não derivou 0,25 palmo desde o começo da contagem (o tremor não se acumula)
     e não passou de 1,5 palmo/s. A partir de 30% a contagem vai para o anel do cursor ('espera' tipo 'fechar'). */
  _fechar(f, t, ev) {
    const L = this.L, fe = this.fe, rot = this.rot;
    if (rot.atual !== 'Open_Palm') {
      fe.ref = null;
      this._avisoFechar(ev, f, 0);
      // um "None" com os 4 dedos esticados é a mão aberta ainda sem rótulo: não arma
      if (f.aberta) { fe.tNaoPalma = null; return; }
      if (fe.tNaoPalma === null) fe.tNaoPalma = t;
      if (!fe.armado && t - fe.tNaoPalma >= L.fecharArmeMs) fe.armado = true;
      return;
    }
    fe.tNaoPalma = null;
    const esc = f.escala > 0 ? f.escala : 300;
    if (!fe.ref) fe.ref = { x: f.palma.x, y: f.palma.y };
    else if (dist(f.palma, fe.ref) > L.fecharDeriva * esc) { fe.ref = { x: f.palma.x, y: f.palma.y }; fe.tRapido = t; }
    if (f.fora || Math.hypot(f.velPalma.x, f.velPalma.y) > L.fecharVelEscala * esc) { fe.ref = { x: f.palma.x, y: f.palma.y }; fe.tRapido = t; }
    if (!fe.armado || this.pz.fechada || this.ag.ativo || this.dz.ativo) { this._avisoFechar(ev, f, 0); return; }
    const prog = (t - Math.max(rot.tDesde, fe.tRapido)) / L.fecharMs;
    if (prog >= 1) {
      fe.armado = false;
      this._avisoFechar(ev, f, 0);
      this._emitir(ev, 'fechar', { x: f.cursor.x, y: f.cursor.y }, t);
      return;
    }
    const a = L.fecharAvisoFrac;
    this._avisoFechar(ev, f, prog >= a ? (prog - a) / (1 - a) : 0);
  }
  _avisoFechar(ev, f, p) {
    const fe = this.fe;
    if (p > 0) { fe.avisando = true; ev.push(['espera', { x: f.cursor.x, y: f.cursor.y, progresso: Math.min(1, p), tipo: 'fechar' }]); }
    else if (fe.avisando) { fe.avisando = false; ev.push(['espera', { x: f.cursor.x, y: f.cursor.y, progresso: 0, tipo: 'fechar' }]); }
  }
  /* Joinha e vitória: a pose segurada sem a mão andar (o mesmo teste de deriva do fechar) e dentro da zona. */
  _segurar(f, t, ev) {
    const L = this.L, rot = this.rot, sg = this.seg;
    const pose = rot.atual === 'Thumb_Up' ? 'joinha' : rot.atual === 'Victory' ? 'vitoria' : null;
    if (!pose || this.pz.fechada || this.ag.ativo) { sg.ref = null; sg.pose = null; return; }
    const esc = f.escala > 0 ? f.escala : 300;
    if (!sg.ref || sg.pose !== pose) { sg.ref = { x: f.palma.x, y: f.palma.y }; sg.t0 = rot.tDesde; sg.pose = pose; }
    else if (dist(f.palma, sg.ref) > L.seguraDeriva * esc) { sg.ref = { x: f.palma.x, y: f.palma.y }; sg.t0 = t; }
    if (f.fora) sg.t0 = t;
    if (!sg[pose] && t - sg.t0 >= (pose === 'joinha' ? L.joinhaMs : L.vitoriaMs)) {
      sg[pose] = true;
      this._emitir(ev, pose, { x: f.cursor.x, y: f.cursor.y }, t);
    }
  }
  _espera(f, t, ev) {
    const L = this.L, es = this.esp;
    const cancelar = () => { if (es.ativa) { es.ativa = false; ev.push(['espera', { x: f.cursor.x, y: f.cursor.y, progresso: 0 }]); } es.ref = null; };
    if (!this.cfg.cliquePorEspera) { cancelar(); es.travadaRef = null; return; }
    if (es.travadaRef && dist(f.cursor, es.travadaRef) > L.esperaPx * 2) es.travadaRef = null;
    const ok = !!f.clicavel && !f.fora && !this.pz.fechada && !this.ag.ativo && !this.dz.ativo && this.rot.atual !== 'Open_Palm';
    if (!ok || es.travadaRef) { cancelar(); return; }
    if (!es.ref || dist(f.cursor, es.ref) > L.esperaPx) { cancelar(); es.ref = { x: f.cursor.x, y: f.cursor.y }; es.t0 = t; return; }
    const prog = Math.min(1, (t - es.t0) / L.esperaMs);
    if (prog >= 0.12 || es.ativa) { es.ativa = true; ev.push(['espera', { x: es.ref.x, y: es.ref.y, progresso: prog }]); }
    if (prog >= 1) {
      es.ativa = false; es.travadaRef = { x: es.ref.x, y: es.ref.y }; es.ref = null;
      this._emitir(ev, 'clique', { x: es.travadaRef.x, y: es.travadaRef.y, porEspera: true }, t);
    }
  }
  _saida(ev, t) {
    const pz = this.pz;
    const cursor = this.cursor ? (pz.fechada && !pz.arrastando && pz.ancora ? { x: pz.ancora.x, y: pz.ancora.y } : { x: this.cursor.x, y: this.cursor.y }) : null;
    return {
      eventos: ev.map(([nome, dados]) => ({ nome, dados: { ...dados, t } })),
      presente: this.presente,
      cursor,
      pincando: pz.fechada,
      arrastando: pz.arrastando,
      agarrando: this.ag.ativo,
      gesto: this.rot.atual,
    };
  }
}

/* ------------------------------------------- núcleo ------------------------------------------- */
/* Puro (sem DOM): várias mãos → trilhas estáveis (com o lado votado), cursor filtrado, escolha da principal,
   máquina de gestos. passo(entrada, t) -> { q, eventos }. opts.ehClicavel() diz se há clicável sob o cursor. */
export class NucleoMaos {
  constructor(opts = {}) {
    this.largura = opts.largura || 1280;
    this.altura = opts.altura || 720;
    this.zona = { ...ZONA, ...(opts.zona || {}) };
    this.zonaLado = Number.isFinite(opts.zonaLado) ? opts.zonaLado : ZONA_LADO;
    this.ehClicavel = opts.ehClicavel || null;
    this.L = opts.limiares || LIMIARES;
    this.maquina = new MaquinaGestos(opts, this.L);
    this.cfg = this.maquina.cfg;
    this.trilhas = new Map();
    this.proxId = 1;
    this.principal = null;
    this.ultPalmo = { v: 0, t: -1e9 };
  }
  redimensionar(w, h) { if (w > 0) this.largura = w; if (h > 0) this.altura = h; }
  configurar(cfg = {}) {
    const c = this.maquina.configurar(cfg);
    const pf = parametrosFiltro(c.sensibilidade);
    for (const tr of this.trilhas.values()) tr.filtro.configurar(pf);
    return c;
  }
  reiniciar(t = agora()) {
    this.trilhas.clear();
    this.principal = null;
    return this.maquina.reiniciar(t).eventos;
  }
  /* A zona de uma mão: a central, puxada para o lado do ombro dela. */
  zonaDoLado(lado) {
    const dx = lado === 'Direita' ? this.zonaLado : lado === 'Esquerda' ? -this.zonaLado : 0;
    const z = this.zona;
    return { x0: z.x0 + dx, x1: z.x1 + dx, y0: z.y0, y1: z.y1 };
  }
  _novaTrilha(d, t) {
    const tr = {
      id: this.proxId++, lado: d.lado, ladoN: 0, zona: this.zonaDoLado(d.lado),
      filtro: new FiltroOneEuro2D(parametrosFiltro(this.cfg.sensibilidade)), cursor: null, vel: { x: 0, y: 0 },
      palma: null, velPalma: { x: 0, y: 0 }, palmaN: d.palmaN, escala: 0, off: null, offs: [], fora: false,
      t, tVista: t, pzFechada: false, pzN: 0,
    };
    this.trilhas.set(tr.id, tr);
    return tr;
  }
  _associar(dets, t) {
    const livres = new Set(this.trilhas.values());
    const pares = [];
    for (const d of dets) for (const tr of livres) pares.push({ d, tr, c: Math.hypot(d.palmaN.x - tr.palmaN.x, d.palmaN.y - tr.palmaN.y) + (d.lado === tr.lado ? 0 : 0.08) });
    pares.sort((a, b) => a.c - b.c);
    const usados = new Set();
    for (const p of pares) {
      if (p.c > 0.35 || usados.has(p.d) || !livres.has(p.tr)) continue;
      p.d.trilha = p.tr; usados.add(p.d); livres.delete(p.tr);
    }
    for (const d of dets) if (!d.trilha) d.trilha = this._novaTrilha(d, t);
    for (const tr of this.trilhas.values()) if (t - tr.tVista > this.L.trilhaMs && !dets.some((d) => d.trilha === tr)) this.trilhas.delete(tr.id);
  }
  /* O MediaPipe alterna Left/Right com a mão de lado ou em punho: o lado da trilha só troca depois de 6 quadros
     seguidos do outro lado com certeza ≥ 0,8. */
  _votarLado(tr, d) {
    if (d.lado === tr.lado) { tr.ladoN = 0; return; }
    tr.ladoN = d.ladoScore >= this.L.ladoScore ? tr.ladoN + 1 : 0;
    if (tr.ladoN >= this.L.ladoQuadros) { tr.lado = d.lado; tr.ladoN = 0; }
  }
  _escolher(dets, t) {
    const L = this.L, modo = this.cfg.maoPrincipal;
    const vale = (lado) => modo === 'qualquer' || (modo === 'direita' ? lado === 'Direita' : lado === 'Esquerda');
    const atual = this.principal;
    if (atual) {
      const d = dets.find((x) => x.trilha === atual);
      if (d && vale(atual.lado)) return d;
      if (!d && this.trilhas.has(atual.id) && vale(atual.lado)) return null;   // sumiu há pouco: espera voltar
    }
    // para assumir o comando: a mão perto da câmera (palmo ≥ 9% da altura do vídeo, a menos de ~1,1 m) e não muito
    // menor que a última que comandou (a mão pequena de quem passa atrás não pega o cursor)
    const ref = t - this.ultPalmo.t < L.assumirMemoriaMs ? this.ultPalmo.v : 0;
    let melhor = null;
    for (const d of dets) {
      if (!vale(d.trilha.lado) || d.palmoN < L.assumirPalmo || (ref > 0 && d.palmoN < ref * L.assumirFrac)) continue;
      if (!melhor || d.palmoN > melhor.palmoN) melhor = d;
    }
    return melhor;
  }
  /* Deslocamento ponto médio − palma (em palmos) do quadro mais aberto dos últimos 250 ms: é para onde a mão mirava
     antes de os dedos começarem a se juntar. */
  _deslocamento(tr, t) {
    let melhor = null;
    for (const o of tr.offs) if (t - o.t <= this.L.pincaAncoraMs && (!melhor || o.r > melhor.r)) melhor = o;
    return melhor || tr.offs[tr.offs.length - 1] || null;
  }
  passo(entrada, t) {
    const W = this.largura, H = this.altura, L = this.L;
    const vw = (entrada && entrada.video && entrada.video.largura) || 640, vh = (entrada && entrada.video && entrada.video.altura) || 480;
    const dets = ((entrada && entrada.maos) || []).map((m) => medirMao(m, vw, vh));
    this._associar(dets, t);
    const comandando = this.maquina.presente ? this.principal : null;
    for (const d of dets) {
      const tr = d.trilha;
      this._votarLado(tr, d);
      // a zona só muda antes de a mão comandar (até o "entrou") ou quando outra mão assume: o cursor não pula
      if (tr !== comandando) tr.zona = this.zonaDoLado(tr.lado);
      projetarMao(d, tr.zona, W, H);
      const dt = tr.cursor ? (t - tr.t) / 1000 : 0;
      tr.escala = tr.escala > 0 ? tr.escala * 0.7 + d.escala * 0.3 : d.escala;
      // aberta: o ponto médio polegar-indicador. Pinça fechando: a palma (que não se mexe quando os dedos fecham e
      // abrem) com o deslocamento do quadro mais aberto. O deslocamento vai em palmos: vale de perto ou de longe.
      let alvo = d.cursorBruto;
      if (d.razao >= L.pincaAbre) {
        tr.off = null;
        if (tr.escala > 0) {
          tr.offs.push({ t, r: d.razao, x: (d.cursorBruto.x - d.palma.x) / tr.escala, y: (d.cursorBruto.y - d.palma.y) / tr.escala });
          if (tr.offs.length > 10) tr.offs.shift();
        }
      } else {
        if (!tr.off) tr.off = this._deslocamento(tr, t);
        if (tr.off) alvo = { x: d.palma.x + tr.off.x * tr.escala, y: d.palma.y + tr.off.y * tr.escala };
      }
      d.ancora = tr.off ? { x: limitar(alvo.x, 0, Math.max(0, W - 1)), y: limitar(alvo.y, 0, Math.max(0, H - 1)) } : null;
      // fora da zona ativa (com folga para não piscar na borda): o cursor fica na borda e nada dispara
      const mg = tr.fora ? L.foraVolta : L.foraMargem;
      tr.fora = alvo.x < -mg * W || alvo.x > (1 + mg) * W || alvo.y < -mg * H || alvo.y > (1 + mg) * H;
      const c = tr.filtro.filtrar(alvo.x, alvo.y, t / 1000);
      const cur = { x: limitar(c.x, 0, Math.max(0, W - 1)), y: limitar(c.y, 0, Math.max(0, H - 1)) };
      if (tr.cursor && dt > 0) {
        tr.vel = { x: tr.vel.x * 0.5 + ((cur.x - tr.cursor.x) / dt) * 0.5, y: tr.vel.y * 0.5 + ((cur.y - tr.cursor.y) / dt) * 0.5 };
        tr.velPalma = { x: tr.velPalma.x * 0.5 + ((d.palma.x - tr.palma.x) / dt) * 0.5, y: tr.velPalma.y * 0.5 + ((d.palma.y - tr.palma.y) / dt) * 0.5 };
      }
      tr.cursor = cur; tr.palma = d.palma; tr.palmaN = d.palmaN; tr.t = t; tr.tVista = t;
      // histerese simples da pinça para as mãos que não comandam (só para o efeito)
      if (!tr.pzFechada) { tr.pzN = d.razao < L.pincaFecha && !d.indicadorDobrado ? tr.pzN + 1 : 0; if (tr.pzN >= L.pincaQuadros) { tr.pzFechada = true; tr.pzN = 0; } }
      else { tr.pzN = d.razao > L.pincaAbre || d.indicadorDobrado ? tr.pzN + 1 : 0; if (tr.pzN >= L.pincaQuadros) { tr.pzFechada = false; tr.pzN = 0; } }
    }
    const eventos = [];
    const d = this._escolher(dets, t);
    if (d) {
      if (this.principal && this.principal !== d.trilha) eventos.push(...this.maquina.trocouMao(t).eventos);
      this.principal = d.trilha;
      this.ultPalmo = { v: d.palmoN, t };
    } else if (this.principal && !this.trilhas.has(this.principal.id)) this.principal = null;
    const tr = d && d.trilha;
    const f = d ? {
      cursor: tr.cursor, ancora: d.ancora, palma: d.palma, velPalma: tr.velPalma, escala: tr.escala, razao: d.razao,
      indicadorDobrado: d.indicadorDobrado, aberta: d.aberta, gesto: d.gesto, gestoScore: d.gestoScore, lado: tr.lado,
      fora: tr.fora, W, H,
      clicavel: typeof this.ehClicavel === 'function' ? !!chamar(this.ehClicavel, tr.cursor.x, tr.cursor.y) : false,
    } : null;
    const r = this.maquina.passo(f, t);
    eventos.push(...r.eventos);
    let principal = -1;
    const maos = dets.map((x, i) => {
      const comanda = !!d && x === d && r.presente;
      if (comanda) principal = i;
      const tri = x.trilha;
      const pincando = comanda ? r.pincando : tri.pzFechada;
      const arrastando = comanda && r.arrastando, agarrando = comanda && r.agarrando;
      const gesto = comanda ? r.gesto : x.gesto;
      return {
        id: tri.id, lado: tri.lado, principal: comanda,
        pontos: x.pontos, pontosVideo: x.pontosVideo,
        cursor: comanda && r.cursor ? r.cursor : { x: tri.cursor.x, y: tri.cursor.y },
        vel: { x: tri.vel.x, y: tri.vel.y },
        escala: x.escala, gesto,
        rotulo: arrastando ? 'Arrastando' : pincando ? 'Pinça' : agarrando ? 'Segurando' : (ROTULO_PT[gesto] || 'Mão'),
        pinca: x.pinca, pincando, arrastando, agarrando, fora: tri.fora,
      };
    });
    return { q: { t, maos, principal }, eventos };
  }
}

/* ------------------------------------------- mão de mentira (pura) ------------------------------------------- */
/* Poses em unidades do palmo (pulso → base do dedo médio = 1), como a pessoa vê (espelhado), y para baixo,
   mão direita com a palma para a câmera (polegar à esquerda). */
const BASE_MAO = { 0: [0, 0, 0], 1: [-0.25, -0.22, -0.02], 2: [-0.47, -0.43, -0.04], 5: [-0.30, -0.95, 0], 9: [0, -1, 0], 13: [0.27, -0.95, 0], 17: [0.50, -0.83, 0] };
const COMPRIMENTO = { 5: [0.42, 0.25, 0.21], 9: [0.47, 0.29, 0.23], 13: [0.43, 0.27, 0.22], 17: [0.33, 0.21, 0.19] };
function dedoEsticado(mcp, ang, lens) {
  const r = ang * Math.PI / 180, dx = Math.sin(r), dy = -Math.cos(r);
  let p = mcp; const out = [];
  for (const l of lens) { p = [p[0] + dx * l, p[1] + dy * l, p[2] - 0.02]; out.push(p); }
  return out;
}
const dedoDobrado = (m) => [[m[0] + 0.01, m[1] - 0.30, -0.15], [m[0] + 0.02, m[1] - 0.12, -0.32], [m[0] + 0.02, m[1] + 0.30, -0.28]];
function dedoMeio(m, ang, lens) {
  const [pip] = dedoEsticado(m, ang, [lens[0] * 0.95]);
  return [[pip[0], pip[1], -0.08], [pip[0] + 0.01, pip[1] + 0.05, -0.25], [pip[0] + 0.02, pip[1] + 0.2, -0.32]];
}
function montarPose(polegar, dedos) {
  const p = new Array(21);
  for (const k in BASE_MAO) p[k] = BASE_MAO[k].slice();
  p[3] = polegar[0]; p[4] = polegar[1];
  for (const mcp of [5, 9, 13, 17]) {
    const spec = dedos[mcp];
    const pts = Array.isArray(spec[0]) ? spec : spec[0] === 'esticado' ? dedoEsticado(BASE_MAO[mcp], spec[1], COMPRIMENTO[mcp]) : spec[0] === 'meio' ? dedoMeio(BASE_MAO[mcp], spec[1], COMPRIMENTO[mcp]) : dedoDobrado(BASE_MAO[mcp]);
    p[mcp + 1] = pts[0]; p[mcp + 2] = pts[1]; p[mcp + 3] = pts[2];
  }
  return p;
}
export const POSES = Object.freeze({
  normal: montarPose([[-0.68, -0.62, -0.06], [-0.85, -0.78, -0.08]], { 5: ['esticado', -8], 9: ['meio', 0], 13: ['meio', 8], 17: ['meio', 16] }),
  // pinça como a de verdade: o indicador desce até o polegar e os dois se encontram em ≈ (−0,68; −1,15), ~0,16 palmo
  // do ponto médio da pose normal (o ponto médio anda quando os dedos se juntam; a palma não)
  pinca: montarPose([[-0.62, -0.74, -0.07], [-0.70, -1.12, -0.10]], { 5: [[-0.40, -1.32, -0.05], [-0.57, -1.38, -0.09], [-0.665, -1.18, -0.11]], 9: ['meio', 0], 13: ['meio', 8], 17: ['meio', 16] }),
  aberta: montarPose([[-0.72, -0.55, -0.04], [-0.95, -0.62, -0.05]], { 5: ['esticado', -14], 9: ['esticado', -3], 13: ['esticado', 8], 17: ['esticado', 20] }),
  punho: montarPose([[-0.40, -0.62, -0.20], [-0.12, -0.66, -0.30]], { 5: ['dobrado'], 9: ['dobrado'], 13: ['dobrado'], 17: ['dobrado'] }),
  joinha: montarPose([[-0.55, -0.85, -0.05], [-0.60, -1.22, -0.08]], { 5: ['dobrado'], 9: ['dobrado'], 13: ['dobrado'], 17: ['dobrado'] }),
  vitoria: montarPose([[-0.20, -0.60, -0.20], [0.08, -0.68, -0.28]], { 5: ['esticado', -13], 9: ['esticado', 9], 13: ['dobrado'], 17: ['dobrado'] }),
});
export const GESTO_DA_POSE = Object.freeze({ normal: 'None', pinca: 'None', aberta: 'Open_Palm', punho: 'Closed_Fist', joinha: 'Thumb_Up', vitoria: 'Victory' });

function misturarPose(a, b, k) {
  const out = new Array(21);
  for (let i = 0; i < 21; i++) out[i] = [a[i][0] + (b[i][0] - a[i][0]) * k, a[i][1] + (b[i][1] - a[i][1]) * k, a[i][2] + (b[i][2] - a[i][2]) * k];
  return out;
}
/* Ponto de referência da mão de mentira: o ponto médio polegar-indicador da pose normal. A mão é posicionada pela
   palma (os pontos 0, 5, 9, 13 e 17 são os mesmos em todas as poses), então nas outras poses o ponto médio sai do
   lugar como numa mão de verdade (na pinça, ~0,16 palmo). */
const REF_SIM = Object.freeze([(POSES.normal[4][0] + POSES.normal[8][0]) / 2, (POSES.normal[4][1] + POSES.normal[8][1]) / 2]);
/* Uma mão no formato do MediaPipe (vídeo cru, sem espelhar), com a palma no lugar em que a pose normal põe o ponto
   médio polegar-indicador no ponto de tela (x, y). pose = nome de POSES ou array de 21 [x,y,z]; de/mistura =
   transição entre poses. */
export function maoSimulada({ x, y, pose = 'normal', de = null, mistura = 1, gesto = null, largura = 1280, altura = 720, zona = ZONA, ruido = 0, lado = 'Direita', video = { largura: 640, altura: 480 }, palmo = 0.17 } = {}) {
  const alvoP = typeof pose === 'string' ? POSES[pose] || POSES.normal : pose;
  const deP = de ? (typeof de === 'string' ? POSES[de] || POSES.normal : de) : null;
  const pts = deP && mistura < 1 ? misturarPose(deP, alvoP, mistura) : alvoP;
  const kx = palmo * (video.altura / video.largura);
  const [mx, my] = REF_SIM;
  const xm = zona.x0 + (x / largura) * (zona.x1 - zona.x0);
  const ym = zona.y0 + (y / altura) * (zona.y1 - zona.y0);
  const sorteio = () => (ruido ? (Math.random() + Math.random() + Math.random() - 1.5) * ruido : 0);
  const landmarks = pts.map((p) => ({ x: 1 - (xm + (p[0] - mx) * kx) + sorteio(), y: ym + (p[1] - my) * palmo + sorteio(), z: p[2] * kx }));
  const nomeG = gesto || (typeof pose === 'string' ? GESTO_DA_POSE[pose] || 'None' : 'None');
  return { landmarks, handedness: { categoryName: lado === 'Esquerda' ? 'Right' : 'Left', displayName: lado === 'Esquerda' ? 'Right' : 'Left', score: 0.97, index: lado === 'Esquerda' ? 1 : 0 }, gesture: { categoryName: nomeG, displayName: '', score: 0.88, index: -1 }, pontosPose: pts };
}
/* Junta mãos simuladas num resultado igual ao do GestureRecognizer. */
export function resultadoSimulado(maos = []) {
  return { landmarks: maos.map((m) => m.landmarks), worldLandmarks: [], handedness: maos.map((m) => [m.handedness]), gestures: maos.map((m) => [m.gesture]) };
}

/* ------------------------------------------- MediaPipe ------------------------------------------- */
/* O WASM do MediaPipe escreve o log interno dele no console (linhas "I1013 …", "W1013 …", "Graph successfully started
   running." e até um console.error "INFO: Created TensorFlow Lite XNNPACK delegate"). Só essas linhas são caladas;
   erro de verdade (E…) e qualquer outra mensagem passam. Instalado uma vez, quando o modo é ligado de verdade. */
const RUIDO_MP = [/^[IW]\d{4} \d\d:\d\d:\d\d\.\d+\s+\d+ [\w.-]+:\d+\]/, /^INFO: Created TensorFlow Lite XNNPACK delegate/, /^Graph (successfully started running|finished closing successfully)\.?$/];
let consoleFiltrado = false;
function silenciarMediaPipe() {
  if (consoleFiltrado || typeof console === 'undefined') return;
  consoleFiltrado = true;
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) {
    const orig = console[k];
    if (typeof orig !== 'function') continue;
    console[k] = function (...a) {
      if (a.length === 1 && typeof a[0] === 'string' && RUIDO_MP.some((r) => r.test(a[0]))) return undefined;
      return orig.apply(this, a);
    };
  }
}
let promessaVision = null;
function importarVision() {
  if (!promessaVision) promessaVision = import(/* @vite-ignore */ URL_BUNDLE).catch((e) => { promessaVision = null; throw e; });
  return promessaVision;
}
/* guardar = false: só conta os bytes (o WASM é baixado aqui só para a barra; a biblioteca o pega do cache depois). */
async function baixarComProgresso(url, aoAvancar, sinal, guardar = true) {
  const r = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache', signal: sinal });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body || typeof r.body.getReader !== 'function') { const b = new Uint8Array(await r.arrayBuffer()); aoAvancar(b.length, b.length); return guardar ? b : null; }
  const leitor = r.body.getReader(); const partes = []; let n = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    if (guardar) partes.push(value);
    n += value.length;
    aoAvancar(n, total);
  }
  if (!guardar) { aoAvancar(n, n); return null; }
  const out = new Uint8Array(n); let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  aoAvancar(n, n);
  return out;
}
/* Roda uma vez num canvas vazio: confirma que o delegate funciona de verdade (o GPU às vezes cria e falha no 1º uso). */
export function aquecerReconhecedor(rec, ts) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 120;
  const g = c.getContext('2d'); if (g) { g.fillStyle = '#000'; g.fillRect(0, 0, 160, 120); }
  return rec.recognizeForVideo(c, ts);
}
/* Mede quanto custa um quadro 640×480 (mediana de 4, depois do aquecimento). */
function medirCusto(rec, ts) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const g = c.getContext('2d');
  const tempos = [];
  for (let i = 0; i < 4; i++) {
    if (g) { g.fillStyle = i % 2 ? '#203050' : '#304868'; g.fillRect(0, 0, 640, 480); }
    ts += 34;
    const a = agora(); rec.recognizeForVideo(c, ts); tempos.push(agora() - a);
  }
  tempos.sort((a, b) => a - b);
  return { custo: (tempos[1] + tempos[2]) / 2, ts };
}
/* Carrega biblioteca + WASM + modelo (com a porcentagem do download) e cria o GestureRecognizer. Tenta o GPU; se ele
   falhar ou for lento (WebGL por software, como o SwiftShader: ~270 ms por quadro contra ~50 ms na CPU), testa a CPU
   e fica com o mais rápido. onProgresso('modelo', 0..1). Devolve { reconhecedor, delegate, ultimoTs, aquecimento, custoMs }. */
export async function carregarReconhecedor({ onProgresso, sinal, delegate = 'GPU' } = {}) {
  silenciarMediaPipe();
  // progresso só sobe, em passos de 1% (o content-length do jsdelivr é o tamanho comprimido: a conta passa de 100%)
  let ultimoPct = -1;
  const avisar = (p) => { const v = Math.round(limitar(p, 0, 1) * 100) / 100; if (v > ultimoPct) { ultimoPct = v; chamar(onProgresso, 'modelo', v); } };
  const cancelado = () => sinal && sinal.aborted;
  avisar(0);
  const bytes = { wasm: 0, wasmT: TAMANHO_WASM, modelo: 0, modeloT: TAMANHO_MODELO };
  let pBiblio = 0;
  const fracao = (n, t) => Math.min(1, n / Math.max(1, t));
  const atualizar = () => avisar(0.04 * pBiblio + 0.45 * fracao(bytes.wasm, bytes.wasmT) + 0.45 * fracao(bytes.modelo, bytes.modeloT));
  let mod, fileset, modelo;
  try {
    [[mod, fileset], modelo] = await Promise.all([
      (async () => {
        const m = await importarVision(); pBiblio = 1; atualizar();
        const fs = await m.FilesetResolver.forVisionTasks(URL_WASM);
        // baixa o WASM com progresso; a biblioteca pega o mesmo arquivo do cache do navegador logo depois
        try { await baixarComProgresso(fs.wasmBinaryPath, (n, t) => { bytes.wasm = n; if (t) bytes.wasmT = t; atualizar(); }, sinal, false); } catch (e) { if (cancelado()) throw e; }
        return [m, fs];
      })(),
      baixarComProgresso(URL_MODELO, (n, t) => { bytes.modelo = n; if (t) bytes.modeloT = t; atualizar(); }, sinal),
    ]);
  } catch (e) {
    if (cancelado()) throw erro('cancelado', e);
    throw erro(ehRemotoHttps() ? 'artifact' : 'sem-modelo', e);
  }
  if (cancelado()) throw erro('cancelado');
  const GR = mod.GestureRecognizer;
  const opcoes = (d) => ({
    baseOptions: { modelAssetBuffer: modelo.slice(), delegate: d },
    runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.55, minTrackingConfidence: 0.5,
  });
  let melhor = null, ultimo = null, ts = agora();
  for (const d of delegate === 'CPU' ? ['CPU'] : ['GPU', 'CPU']) {
    let rec = null;
    try {
      rec = await GR.createFromOptions(fileset, opcoes(d));
      ts = Math.max(agora(), ts + 1);
      const aquecimento = aquecerReconhecedor(rec, ts);
      const m = medirCusto(rec, ts); ts = m.ts;
      if (!melhor || m.custo < melhor.custo) {
        if (melhor) { try { melhor.rec.close(); } catch { /* ok */ } }
        melhor = { rec, d, custo: m.custo, aquecimento };
      } else rec.close();
      if (melhor.custo <= 30) break;                        // GPU de verdade: nem precisa testar a CPU
    } catch (e) {
      ultimo = e;
      try { rec && rec.close(); } catch { /* já fechado */ }
    }
    if (cancelado()) break;
  }
  if (cancelado()) { try { melhor && melhor.rec.close(); } catch { /* ok */ } throw erro('cancelado'); }
  // o download deu certo e nem o GPU nem a CPU rodaram o reconhecedor: não é a internet
  if (!melhor) throw erro('sem-gpu', ultimo);
  avisar(1);
  return { reconhecedor: melhor.rec, delegate: melhor.d, ultimoTs: ts, aquecimento: melhor.aquecimento, custoMs: Math.round(melhor.custo * 10) / 10 };
}

/* O reconhecedor fica guardado entre um ligar e outro: criar de novo seria mais um WASM, mais GPU, outra medição e
   alguns segundos de "Carregando". Só é fechado quando a página sai (pagehide) ou quando falha. ts = o relógio do
   modo VIDEO, que só anda para a frente. */
let recCache = null;   // { rec, delegate, custoMs, ts }
let saidaLigada = false;
function guardarReconhecedor(r) {
  if (recCache && recCache.rec !== r.reconhecedor) { try { r.reconhecedor.close(); } catch { /* ok */ } return recCache; }
  recCache = { rec: r.reconhecedor, delegate: r.delegate, custoMs: r.custoMs, ts: r.ultimoTs };
  if (!saidaLigada && temJanela) { saidaLigada = true; window.addEventListener('pagehide', () => descartarReconhecedor()); }
  return recCache;
}
function descartarReconhecedor(rec) {
  if (!recCache || (rec && recCache.rec !== rec)) return;
  const c = recCache; recCache = null;
  try { c.rec.close(); } catch { /* ok */ }
}

/* ------------------------------------------- câmera ------------------------------------------- */
function verificarAmbiente() {
  if (!temJanela) return erro('sem-suporte');
  try { if (window.claude && typeof window.claude.use === 'function' && !ehLocal()) return erro('artifact'); } catch { /* sem acesso */ }
  const md = navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== 'function') return erro(ehRemotoHttps() ? 'artifact' : 'sem-suporte');
  if (typeof WebAssembly !== 'object') return erro('sem-suporte');
  return null;
}
function erroCamera(e) {
  const n = (e && e.name) || '';
  if (/NotFound|DevicesNotFound|Overconstrained|ConstraintNotSatisfied/i.test(n)) return erro('sem-camera', e);
  if (/NotReadable|TrackStart|Abort/i.test(n)) return erro('em-uso', e);
  if (/NotAllowed|PermissionDenied|Security/i.test(n)) return erro(ehRemotoHttps() ? 'artifact' : 'negado', e);
  return erro(ehRemotoHttps() ? 'artifact' : 'sem-camera', e);
}
async function abrirCamera(sinal) {
  const md = navigator.mediaDevices;
  // Antes da permissão o Chrome/Edge já listam um "videoinput" (sem nome) se existir câmera: sem nenhum, nem pede
  // permissão. Em https de fora (artifact), a política do frame esconde a câmera: aí a explicação é a do artifact.
  try {
    if (typeof md.enumerateDevices === 'function') {
      const lista = await md.enumerateDevices();
      if (Array.isArray(lista) && !lista.some((d) => d.kind === 'videoinput')) throw erro(ehRemotoHttps() ? 'artifact' : 'sem-camera');
    }
  } catch (e) { if (e && e.codigo) throw e; }
  let stream;
  try {
    stream = await md.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false });
  } catch (e) { throw erroCamera(e); }
  if (sinal && sinal.aborted) { pararStream(stream); throw erro('cancelado'); }
  return stream;
}
function pararStream(stream) { try { for (const tr of stream.getTracks()) tr.stop(); } catch { /* nada */ } }
async function prepararVideo(video, stream) {
  video.muted = true; video.playsInline = true; video.autoplay = true;
  video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
  video.srcObject = stream;
  if (!(video.videoWidth > 0)) {
    await new Promise((ok) => {
      const fim = () => { video.removeEventListener('loadedmetadata', fim); clearTimeout(tm); ok(); };
      const tm = setTimeout(fim, 4000);
      video.addEventListener('loadedmetadata', fim);
    });
  }
  try { await Promise.race([video.play(), new Promise((ok) => setTimeout(ok, 3000))]); } catch { /* o autoplay mudo costuma bastar */ }
}

/* ------------------------------------------- mouse sintético (DOM) ------------------------------------------- */
export const SELETOR_CLICAVEL = 'button, a, [role=tab], [role=option], .depto, .rotina, .rec, .carta, .wl, input, label, [tabindex]';
const SELETOR_DIRETO = 'button, a, [role=tab], [role=option], .depto, .rotina, .rec, .carta, .wl, input, label';
const PAPEL_CONTEINER = /^(region|tabpanel|tablist|listbox|group|dialog|document|application|main|navigation|complementary|img)$/;
const SELETOR_CAMPO = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=reset]):not([type=file]):not([type=color]), textarea, select, [contenteditable=""], [contenteditable=true]';
const RAIO_IMA = 10, FATOR_ROLAGEM = 1.5, ID_PONTEIRO = 31;
const ORCAMENTO_DETECCAO = 0.5;   // fração do tempo da linha principal que o reconhecimento pode usar
const FOLGA_DETECCAO = 6;         // ms: o requestVideoFrameCallback oscila; sem folga, um custo de 12–16 ms pularia quadro

function ehClicavelEl(e) {
  if (!e || e.nodeType !== 1 || !e.matches(SELETOR_CLICAVEL)) return false;
  if (e.matches(':disabled') || e.getAttribute('aria-disabled') === 'true' || e.type === 'hidden') return false;
  if (e.matches(SELETOR_DIRETO)) return true;
  // só pelo [tabindex]: fica de fora o que não recebe foco e as regiões (o corpo do leitor é tabindex=0)
  if (e.tabIndex < 0 || e.tagName === 'CANVAS' || e.classList.contains('leitor-corpo')) return false;
  return !PAPEL_CONTEINER.test(e.getAttribute('role') || '');
}
function clicavelDe(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    if (e === document.body || e === document.documentElement) return null;
    if (ehClicavelEl(e)) return e;
  }
  return null;
}
function rolavelDe(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    if (e === document.body || e === document.documentElement) break;
    let cs; try { cs = getComputedStyle(e); } catch { continue; }
    const oy = /(auto|scroll|overlay)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1;
    const ox = /(auto|scroll|overlay)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1;
    if (oy || ox) return e;
  }
  const se = document.scrollingElement;
  return se && (se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1) ? se : null;
}
function criarRolador() {
  let el = null, arrastando = false, inercia = false, raf = 0, tUlt = 0;
  let px = 0, py = 0, vx = 0, vy = 0, restoX = 0, restoY = 0, hist = [];
  function aplicar(dx, dy) {
    restoX += dx; restoY += dy;
    const ix = Math.trunc(restoX), iy = Math.trunc(restoY);
    if (!ix && !iy) return;
    restoX -= ix; restoY -= iy;
    try { el.scrollBy({ left: ix, top: iy, behavior: 'instant' }); } catch { el.scrollLeft += ix; el.scrollTop += iy; }
  }
  function tick(now) {
    raf = 0;
    if (!el || !el.isConnected) { el = null; arrastando = inercia = false; return; }
    const dt = tUlt ? Math.min(0.05, (now - tUlt) / 1000) : 1 / 60; tUlt = now;
    let continuar = false;
    if (Math.abs(px) > 0.5 || Math.abs(py) > 0.5) { const sx = px * 0.4, sy = py * 0.4; px -= sx; py -= sy; aplicar(sx, sy); continuar = true; }
    else if (px || py) { aplicar(px, py); px = py = 0; }
    if (inercia) {
      aplicar(vx * dt, vy * dt);
      const k = Math.exp(-dt / 0.3); vx *= k; vy *= k;
      if (Math.hypot(vx, vy) < 25) inercia = false; else continuar = true;
    }
    if (continuar) raf = requestAnimationFrame(tick); else tUlt = 0;
  }
  const ligar = () => { if (!raf) raf = requestAnimationFrame(tick); };
  return {
    arrastando: () => arrastando,
    iniciar(alvo) { el = alvo; arrastando = true; inercia = false; px = py = vx = vy = restoX = restoY = 0; hist = []; },
    empurrar(dx, dy, t) {
      if (!arrastando) return;
      px += dx; py += dy;
      hist.push({ t, dx, dy });
      while (hist.length && t - hist[0].t > 360) hist.shift();
      ligar();
    },
    /* A inércia vem do movimento de antes da soltura: as amostras dos últimos 70 ms (os dedos abrindo) ficam de fora,
       e só vale com ≥ 3 amostras cobrindo ≥ 80 ms. Mão parada antes de soltar = o texto para onde está. */
    soltar(t, comInercia) {
      if (!arrastando) return;
      arrastando = false;
      if (!comInercia) return;
      const fim = t - 70;
      const am = hist.filter((h) => h.t <= fim && h.t >= fim - 220);
      if (am.length < 3) return;
      const dur = (am[am.length - 1].t - am[0].t) / 1000;
      if (dur < 0.08) return;
      let sx = 0, sy = 0; for (let i = 1; i < am.length; i++) { sx += am[i].dx; sy += am[i].dy; }
      vx = sx / dur; vy = sy / dur;
      const v = Math.hypot(vx, vy);
      if (v > 220) { const m = Math.min(1, 4000 / v); vx *= m; vy *= m; inercia = true; ligar(); }
    },
    parar() { el = null; arrastando = inercia = false; px = py = 0; if (raf) cancelAnimationFrame(raf); raf = 0; tUlt = 0; },
  };
}
export function criarMouseSintetico() {
  const doc = document, win = window;
  let alvo = null, hover = null, captura = null, pressionado = false, x = -1, y = -1;
  const rolador = criarRolador();
  const reduz = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  function despachar(tipo, el, px, py, extra = {}) {
    if (!el) return true;
    const limite = /(enter|leave)$/.test(tipo);
    const ponteiro = tipo.startsWith('pointer');
    const botoes = extra.buttons ?? (pressionado ? 1 : 0);
    const init = {
      bubbles: !limite, cancelable: !limite, composed: true, view: win,
      clientX: px, clientY: py, screenX: px + (win.screenX || 0), screenY: py + (win.screenY || 0),
      button: extra.button ?? (ponteiro ? -1 : 0), buttons: botoes,
      relatedTarget: extra.relatedTarget ?? null, detail: extra.detail ?? 0,
      pointerId: ID_PONTEIRO, pointerType: 'mouse', isPrimary: true, width: 1, height: 1, pressure: botoes ? 0.5 : 0,
    };
    let ev;
    try { ev = ponteiro && typeof PointerEvent === 'function' ? new PointerEvent(tipo, init) : new MouseEvent(tipo, init); } catch { return true; }
    try { Object.defineProperty(ev, 'daMao', { value: true }); } catch { /* ok */ }
    try { return el.dispatchEvent(ev); } catch (e) { console.error('[maos]', e); return true; }
  }
  const cadeia = (el) => { const c = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) c.push(e); return c; };
  function trocar(de, para, px, py) {
    if (de === para) return;
    const cDe = de && de.isConnected ? cadeia(de) : [], cPara = para ? cadeia(para) : [];
    const sDe = new Set(cDe), sPara = new Set(cPara);
    if (cDe.length) {
      despachar('pointerout', de, px, py, { relatedTarget: para });
      for (const e of cDe) if (!sPara.has(e)) despachar('pointerleave', e, px, py, { relatedTarget: para });
    }
    if (para) {
      despachar('pointerover', para, px, py, { relatedTarget: de });
      for (let i = cPara.length - 1; i >= 0; i--) if (!sDe.has(cPara[i])) despachar('pointerenter', cPara[i], px, py, { relatedTarget: de });
    }
    if (cDe.length) {
      despachar('mouseout', de, px, py, { relatedTarget: para });
      for (const e of cDe) if (!sPara.has(e)) despachar('mouseleave', e, px, py, { relatedTarget: para });
    }
    if (para) {
      despachar('mouseover', para, px, py, { relatedTarget: de });
      for (let i = cPara.length - 1; i >= 0; i--) if (!sDe.has(cPara[i])) despachar('mouseenter', cPara[i], px, py, { relatedTarget: de });
    }
  }
  const elementoEm = (px, py) => { try { return doc.elementFromPoint(px, py); } catch { return null; } };
  const distRet = (px, py, r) => Math.hypot(Math.max(r.left - px, 0, px - r.right), Math.max(r.top - py, 0, py - r.bottom));
  /* ímã: sem clicável bem debaixo do cursor, pega um a até 10 px (botão pequeno com a mão tremendo) */
  function ima(px, py) {
    let melhor = null, md = Infinity;
    for (const [ox, oy] of [[RAIO_IMA, 0], [-RAIO_IMA, 0], [0, RAIO_IMA], [0, -RAIO_IMA]]) {
      const c = clicavelDe(elementoEm(px + ox, py + oy));
      if (!c || c === melhor) continue;
      const d = distRet(px, py, c.getBoundingClientRect());
      if (d < md) { md = d; melhor = c; }
    }
    return md <= RAIO_IMA ? melhor : null;
  }
  function marcar(c) {
    if (c === hover) return;
    if (hover) hover.classList.remove('mao-hover');
    if (c) c.classList.add('mao-hover');
    hover = c;
  }
  function sincronizar(px, py) { const el = elementoEm(px, py); if (el !== alvo) { trocar(alvo, el, px, py); alvo = el; } return el; }
  /* <input type=range>: o mouse sintético não move o controle nativo (evento não confiável não roda a ação padrão).
     A pinça põe o valor pela posição x e dispara 'input' (e 'change' ao soltar), como o arraste do mouse. */
  let faixa = null;
  const faixaDe = (el) => (el && el.closest ? el.closest('input[type=range]') : null);
  function moverFaixa(inp, px) {
    if (!inp || inp.disabled || !inp.isConnected) return false;
    const r = inp.getBoundingClientRect();
    if (!(r.width > 0)) return false;
    const min = inp.min === '' ? 0 : Number(inp.min), max = inp.max === '' ? 100 : Number(inp.max);
    const passo = inp.step === 'any' ? 0 : inp.step === '' ? 1 : Number(inp.step);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return false;
    let v = min + limitar((px - r.left) / r.width, 0, 1) * (max - min);
    if (passo > 0) v = min + Math.round((v - min) / passo) * passo;
    const s = String(Math.round(limitar(v, min, max) * 1e6) / 1e6);
    if (inp.value !== s) { inp.value = s; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    return true;
  }
  const api = {
    temClicavel: () => !!hover && hover.isConnected,
    hover: () => hover,
    /* fora = a mão saiu da zona ativa: o cursor fica na borda, segue mexendo o robô, mas não acende nada */
    mover(px, py, fora = false) {
      const mudou = Math.abs(px - x) >= 0.5 || Math.abs(py - y) >= 0.5;
      x = px; y = py;
      if (captura || faixa) {
        const c = captura || faixa;
        if (mudou) { despachar('pointermove', c, px, py, { buttons: 1 }); despachar('mousemove', c, px, py, { buttons: 1 }); }
        return;
      }
      const el = sincronizar(px, py);
      if (mudou) { const t = el || win; despachar('pointermove', t, px, py); despachar('mousemove', t, px, py); }
      marcar(el && !fora ? clicavelDe(el) || ima(px, py) : null);
    },
    clique(px, py) {
      let el = elementoEm(px, py), c = el && clicavelDe(el), cx = px, cy = py;
      if (!c && el) {
        const m = ima(px, py);
        if (m) { const r = m.getBoundingClientRect(); c = el = m; cx = limitar(px, r.left + 1, r.right - 1); cy = limitar(py, r.top + 1, r.bottom - 1); }
      }
      if (!el) return null;
      if (el !== alvo) { trocar(alvo, el, cx, cy); alvo = el; }
      const fx = faixaDe(el);
      pressionado = true;
      despachar('pointerdown', el, cx, cy, { button: 0, buttons: 1 });
      despachar('mousedown', el, cx, cy, { button: 0, buttons: 1, detail: 1 });
      const mudouFaixa = !!fx && moverFaixa(fx, cx);
      pressionado = false;
      despachar('pointerup', el, cx, cy, { button: 0, buttons: 0 });
      despachar('mouseup', el, cx, cy, { button: 0, buttons: 0, detail: 1 });
      despachar('click', el, cx, cy, { button: 0, buttons: 0, detail: 1 });
      if (mudouFaixa) fx.dispatchEvent(new Event('change', { bubbles: true }));
      if (c && c.isConnected && c.matches(SELETOR_CAMPO)) { try { c.focus({ preventScroll: true }); } catch { /* ok */ } }
      return c || el;
    },
    arrasteInicio(px, py, atual) {
      const el = elementoEm(px, py);
      if (!el) return { modo: null, alvo: null };
      const fx = faixaDe(el);
      if (fx && !fx.disabled) {                       // antes da rolagem: a faixa mora no menu, que rola
        if (el !== alvo) { trocar(alvo, el, px, py); alvo = el; }
        faixa = fx; pressionado = true;
        despachar('pointerdown', fx, px, py, { button: 0, buttons: 1 });
        despachar('mousedown', fx, px, py, { button: 0, buttons: 1, detail: 1 });
        moverFaixa(fx, atual ? atual.x : px);
        return { modo: 'faixa', alvo: fx };
      }
      const rol = el.tagName === 'CANVAS' ? null : rolavelDe(el);
      if (rol) { rolador.iniciar(rol); return { modo: 'rolar', alvo: rol }; }
      if (el !== alvo) { trocar(alvo, el, px, py); alvo = el; }
      captura = el; pressionado = true;
      despachar('pointerdown', el, px, py, { button: 0, buttons: 1 });
      despachar('mousedown', el, px, py, { button: 0, buttons: 1, detail: 1 });
      if (atual) { despachar('pointermove', el, atual.x, atual.y, { buttons: 1 }); despachar('mousemove', el, atual.x, atual.y, { buttons: 1 }); x = atual.x; y = atual.y; }
      return { modo: 'ponteiro', alvo: el };
    },
    arraste(px, py, dx, dy, t) {
      if (faixa) { moverFaixa(faixa, px); return; }
      if (rolador.arrastando()) rolador.empurrar(-dx * FATOR_ROLAGEM, -dy * FATOR_ROLAGEM, t);
    },
    arrasteFim(px, py, t) {
      if (faixa) {
        const fx = faixa; faixa = null; pressionado = false;
        despachar('pointerup', fx, px, py, { button: 0, buttons: 0 });
        despachar('mouseup', fx, px, py, { button: 0, buttons: 0, detail: 1 });
        if (fx.isConnected) fx.dispatchEvent(new Event('change', { bubbles: true }));
        sincronizar(px, py);
      }
      if (captura) {
        const el = captura; captura = null; pressionado = false;
        despachar('pointerup', el, px, py, { button: 0, buttons: 0 });
        despachar('mouseup', el, px, py, { button: 0, buttons: 0, detail: 1 });
        sincronizar(px, py);
      }
      if (rolador.arrastando()) rolador.soltar(t, !reduz());
    },
    sair() {
      if (captura || faixa) api.arrasteFim(x, y, agora());
      if (rolador.arrastando()) rolador.soltar(agora(), false);
      if (alvo) { trocar(alvo, null, x, y); alvo = null; }
      try { doc.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false, clientX: x, clientY: y, pointerId: ID_PONTEIRO, pointerType: 'mouse', isPrimary: true })); } catch { /* ok */ }
      marcar(null);
    },
    destruir() { api.sair(); rolador.parar(); },
  };
  return api;
}

/* ------------------------------------------- simulador (DOM) ------------------------------------------- */
const TECLA_POSE = { p: 'pinca', a: 'aberta', f: 'punho', j: 'joinha', v: 'vitoria' };
const SETA = { ArrowLeft: 'esquerda', ArrowRight: 'direita', ArrowUp: 'cima', ArrowDown: 'baixo' };
const campoTexto = (a) => !!a && (a.tagName === 'TEXTAREA' || a.isContentEditable || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && /^(text|search|email|url|tel|password|number)$/i.test(a.type || 'text')));
/* zona: a zona da mão direita do núcleo (objeto ou função, para seguir a zona de verdade). O ruído (~1 px de vídeo)
   é o tremor de uma webcam de verdade: a máquina de gestos é testada com ele. */
const RUIDO_SIM = 0.0028;
function criarSimulador({ aoResultado, tamanho, zona }) {
  const win = window, doc = document;
  const zonaAgora = () => (typeof zona === 'function' ? zona() : zona) || ZONA;
  let alvo = null, presente = false, ausenteForcado = false, poseForcada = null, teclas = [];
  let poseAlvo = 'normal', poseDe = POSES.normal, tPose = -1e9, gestoDe = 'None';
  let desliza = null, raf = 0, ultimo = 0, pausado = false, destruido = false, ultimaPose = POSES.normal;
  const DUR_POSE = 110;
  // deslize: a mão abre parada (como a pessoa faz antes de deslizar), corre em linha e volta devagar ao mouse
  const D_PREPARA = 170, D_CORRE = 200, D_SEGURA = 120, D_VOLTA = 1100;
  function poseQuerida() {
    if (poseForcada) return poseForcada;
    return teclas.length ? TECLA_POSE[teclas[teclas.length - 1]] : 'normal';
  }
  function trocarPose(nova, t) {
    if (nova === poseAlvo) return;
    poseDe = ultimaPose; gestoDe = GESTO_DA_POSE[poseAlvo] || 'None';
    poseAlvo = nova; tPose = t;
  }
  function iniciarDesliza(dir, t) {
    const { W, H } = tamanho();
    const h = Math.max(0.42 * W, 0.6 * H), v = 0.6 * H;   // ≥ 1,2 palmo e > 8 palmos/s com a mão a um braço
    const D = { esquerda: [-h, 0], direita: [h, 0], cima: [0, -v], baixo: [0, v] }[dir];
    if (!D) return;
    desliza = { dx: D[0], dy: D[1], t0: t };
  }
  const suave = (k) => k * k * (3 - 2 * k);
  function quadro(t) {
    if (!presente || ausenteForcado || !alvo) { aoResultado(resultadoSimulado([]), t); return; }
    const { W, H } = tamanho();
    let ox = 0, oy = 0, pose = poseQuerida();
    let instantanea = false;
    if (desliza) {
      const e = t - desliza.t0, e1 = D_PREPARA, e2 = e1 + D_CORRE, e3 = e2 + D_SEGURA, e4 = e3 + D_VOLTA;
      if (e < e1) { pose = 'aberta'; instantanea = true; }
      else if (e < e2) { const k = suave((e - e1) / D_CORRE); ox = desliza.dx * k; oy = desliza.dy * k; pose = 'aberta'; instantanea = true; }
      else if (e < e3) { ox = desliza.dx; oy = desliza.dy; pose = 'aberta'; }
      else if (e < e4) { const k = 1 - suave((e - e3) / D_VOLTA); ox = desliza.dx * k; oy = desliza.dy * k; if (pose === 'aberta') pose = 'normal'; }
      else desliza = null;
    }
    trocarPose(pose, t);
    if (instantanea) tPose = Math.min(tPose, t - DUR_POSE);   // a mão já sai aberta no deslize
    const k = Math.min(1, Math.max(0, (t - tPose) / DUR_POSE));
    const m = maoSimulada({ x: alvo.x + ox, y: alvo.y + oy, pose: poseAlvo, de: poseDe, mistura: suave(k), largura: W, altura: H, zona: zonaAgora(), ruido: RUIDO_SIM });
    ultimaPose = m.pontosPose;
    if (k < 0.6) m.gesture.categoryName = gestoDe;
    aoResultado(resultadoSimulado([m]), t);
  }
  function laco(now) {
    raf = 0;
    if (destruido || pausado) return;
    raf = requestAnimationFrame(laco);
    if (now - ultimo < 32) return;
    ultimo = now;
    quadro(agora());
  }
  const ligar = () => { if (!raf && !destruido && !pausado) raf = requestAnimationFrame(laco); };
  const aoMover = (e) => { if (!e.isTrusted) return; alvo = { x: e.clientX, y: e.clientY }; presente = true; };
  const aoSairJanela = (e) => { if (e.isTrusted && !e.relatedTarget) presente = false; };
  const ignorar = (e) => e.ctrlKey || e.metaKey || e.altKey || campoTexto(doc.activeElement);
  // Um toque rápido na tecla (ou a tecla de um teste automatizado, que desce e sobe no mesmo instante) vale como a
  // pose segurada por TOQUE_MIN ms: sem isso a pose some antes de o laço (a cada ~33 ms) vê-la, e P não clicaria.
  const TOQUE_MIN = 220;
  const baixa = {}, ate = {}, tSolta = {};
  const tirarTecla = (k) => { teclas = teclas.filter((x) => x !== k); };
  function soltarDepois(k) {
    clearTimeout(tSolta[k]);
    const falta = (ate[k] || 0) - agora();
    if (falta > 0) { tSolta[k] = setTimeout(() => { if (!baixa[k]) soltarDepois(k); }, falta); return; }
    tSolta[k] = 0;
    tirarTecla(k);
  }
  const aoTecla = (e) => {
    if (ignorar(e)) return;
    const k = (e.key || '').toLowerCase();
    if (TECLA_POSE[k]) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat || !baixa[k]) {
        baixa[k] = true; ate[k] = Math.max(ate[k] || 0, agora() + TOQUE_MIN); clearTimeout(tSolta[k]);
        if (teclas[teclas.length - 1] !== k) { tirarTecla(k); teclas.push(k); }
      }
      return;
    }
    if (SETA[e.key]) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) iniciarDesliza(SETA[e.key], agora()); }
  };
  const aoSoltarTecla = (e) => {
    const k = (e.key || '').toLowerCase();
    if (TECLA_POSE[k]) { baixa[k] = false; soltarDepois(k); if (!ignorar(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }
    else if (SETA[e.key] && !ignorar(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  const aoPerderFoco = () => { teclas = []; for (const k in tSolta) { clearTimeout(tSolta[k]); tSolta[k] = 0; baixa[k] = false; ate[k] = 0; } };
  win.addEventListener('pointermove', aoMover, { capture: true, passive: true });
  doc.addEventListener('pointerout', aoSairJanela, { capture: true, passive: true });
  win.addEventListener('keydown', aoTecla, true);
  win.addEventListener('keyup', aoSoltarTecla, true);
  win.addEventListener('blur', aoPerderFoco);
  ligar();
  return {
    pausar(v) { pausado = !!v; if (pausado) { if (raf) cancelAnimationFrame(raf); raf = 0; } else ligar(); },
    destruir() {
      destruido = true; if (raf) cancelAnimationFrame(raf); raf = 0;
      for (const k in tSolta) clearTimeout(tSolta[k]);
      win.removeEventListener('pointermove', aoMover, { capture: true });
      doc.removeEventListener('pointerout', aoSairJanela, { capture: true });
      win.removeEventListener('keydown', aoTecla, true);
      win.removeEventListener('keyup', aoSoltarTecla, true);
      win.removeEventListener('blur', aoPerderFoco);
    },
    api: {
      mover(px, py) { alvo = { x: +px, y: +py }; presente = true; },
      pose(nome) { poseForcada = nome && POSES[nome] ? nome : null; },
      deslizar(dir) { iniciarDesliza(dir, agora()); },
      sumir() { ausenteForcado = true; },
      aparecer() { ausenteForcado = false; },
    },
  };
}

/* ------------------------------------------- iniciarMaos ------------------------------------------- */
let instanciaAtiva = null, geracao = 0;

export async function iniciarMaos(opts = {}) {
  if (!temJanela) throw erro('sem-suporte');
  const simular = !!opts.simular && ehLocal();
  if (instanciaAtiva) { try { instanciaAtiva.parar(); } catch { /* já parada */ } }
  const minha = ++geracao;   // um segundo iniciarMaos (clique duplo) cancela o carregamento deste: nunca duas câmeras
  const cb = { quadro: opts.onQuadro, gesto: opts.onGesto, estado: opts.onEstado, progresso: opts.onProgresso };
  let estadoAtual = 'carregando';
  const mudarEstado = (e, d = null) => { estadoAtual = e; chamar(cb.estado, e, d); };
  const falhar = (e) => { if (e.codigo !== 'cancelado') mudarEstado('erro', { codigo: e.codigo, mensagem: e.message }); throw e; };
  const cancelado = () => minha !== geracao || !!(opts.sinal && opts.sinal.aborted);

  let stream = null, video = null, rec = null, delegate = null, ultimoTs = 0, custoMs = 10;
  if (!simular) {
    const problema = verificarAmbiente();
    if (problema) falhar(problema);
    mudarEstado('carregando', { fase: 'camera' });
    chamar(cb.progresso, 'camera', 0);
    importarVision().catch(() => { /* o erro aparece no carregamento */ });   // adianta a biblioteca enquanto a permissão é pedida
    try { stream = await abrirCamera(opts.sinal); } catch (e) { falhar(e && e.codigo ? e : erro('sem-camera', e)); }
    if (cancelado()) { pararStream(stream); falhar(erro('cancelado')); }
    // a webcam pode ser desconectada (ou tomada por outro programa) enquanto o modelo carrega: o 'ended' é ouvido
    // desde já, para o motor não ligar com a trilha morta (vídeo parado e "Mostre a mão" para sempre)
    const trilhas = stream.getVideoTracks();
    let trilhaCaiu = false;
    const marcarQueda = () => { trilhaCaiu = true; };
    for (const tr of trilhas) tr.addEventListener('ended', marcarQueda);
    const caiu = () => trilhaCaiu || trilhas.some((tr) => tr.readyState === 'ended');
    // o <video> pode já ser de um iniciarMaos mais novo: só solta a imagem se ela ainda for deste
    const largar = () => {
      for (const tr of trilhas) tr.removeEventListener('ended', marcarQueda);
      pararStream(stream);
      if (video && video.srcObject === stream) video.srcObject = null;
    };
    const erroQueda = () => { const e = erro('sem-camera'); e.message = MSG_CAMERA_CAIU; return e; };
    video = opts.video || document.createElement('video');
    await prepararVideo(video, stream);
    if (cancelado()) { largar(); falhar(erro('cancelado')); }
    if (caiu()) { largar(); falhar(erroQueda()); }
    chamar(cb.progresso, 'camera', 1);
    mudarEstado('carregando', { fase: 'modelo' });
    try {
      // o reconhecedor de um ligar anterior é reaproveitado (sem baixar, compilar nem medir de novo)
      let r = recCache;
      if (r) chamar(cb.progresso, 'modelo', 1);
      else r = guardarReconhecedor(await carregarReconhecedor({ onProgresso: cb.progresso, sinal: opts.sinal }));
      rec = r.rec; delegate = r.delegate; ultimoTs = r.ts; custoMs = r.custoMs || custoMs;
    } catch (e) {
      largar();
      falhar(e && e.codigo ? e : erro('sem-modelo', e));
    }
    // cancelado depois de carregar: o reconhecedor fica guardado para o próximo ligar
    if (cancelado()) { largar(); falhar(erro('cancelado')); }
    if (caiu()) { largar(); falhar(erroQueda()); }
    for (const tr of trilhas) tr.removeEventListener('ended', marcarQueda);
  } else mudarEstado('carregando', { fase: 'simulador' });

  const mouse = criarMouseSintetico();
  const nucleo = new NucleoMaos({
    largura: window.innerWidth, altura: window.innerHeight,
    sensibilidade: opts.sensibilidade, cliquePorEspera: opts.cliquePorEspera, maoPrincipal: opts.maoPrincipal,
    ehClicavel: () => mouse.temClicavel(),
  });
  let parado = false, encerrando = false, pausadoUsuario = false, pausadoAba = document.hidden, qps = 0, tUltProc = 0, errosSeguidos = 0, recuperando = false;
  let simulador = null;

  function aplicarEventos(eventos, t, p) {
    for (const ev of eventos) {
      const d = ev.dados;
      switch (ev.nome) {
        case 'clique': d.alvo = mouse.clique(d.x, d.y); break;
        case 'arrasteInicio': Object.assign(d, mouse.arrasteInicio(d.x, d.y, p && p.cursor)); break;
        case 'arraste': mouse.arraste(d.x, d.y, d.dx, d.dy, t); break;
        case 'arrasteFim': mouse.arrasteFim(d.x, d.y, t); break;
        case 'entrou': mudarEstado('rastreando', { lado: d.lado }); break;
        case 'saiu': mouse.sair(); if (!parado && !encerrando && !pausadoUsuario && !pausadoAba) mudarEstado('pronto', { simulado: simular, delegate }); break;
        default: break;
      }
      chamar(cb.gesto, ev.nome, d);
    }
  }
  function processar(res, t, vid) {
    if (parado || pausadoUsuario || pausadoAba) return;
    let saida;
    try { saida = nucleo.passo(entradaDoMediaPipe(res, vid), t); } catch (e) { console.error('[maos]', e); return; }
    const { q, eventos } = saida;
    const dt = t - tUltProc; tUltProc = t;
    if (dt > 0 && dt < 1000) qps = qps ? qps * 0.9 + (1000 / dt) * 0.1 : 1000 / dt;
    q.qps = Math.round(qps); q.simulado = simular;
    const p = q.principal >= 0 ? q.maos[q.principal] : null;
    if (p) mouse.mover(p.cursor.x, p.cursor.y, !!p.fora);
    chamar(cb.quadro, q);
    aplicarEventos(eventos, t, p);
  }
  function soltarMao() { aplicarEventos(nucleo.reiniciar(agora()), agora(), null); mouse.sair(); }

  /* laço da câmera: um quadro do vídeo = uma detecção (≤ ~30 por segundo) */
  let idVideo = 0, idRaf = 0, tUltQuadro = agora(), tUltDet = 0, ultCT = -1, vigia = 0;
  let usarRVFC = !!video && typeof video.requestVideoFrameCallback === 'function';
  const ativo = () => !parado && !pausadoUsuario && !pausadoAba && !recuperando;
  function detectar() {
    const t = agora();
    // ≤ ~30 por segundo, e o reconhecimento usa no máximo ~50% da linha principal (máquina fraca: menos quadros, a
    // cena não trava); a folga evita que a oscilação do relógio do vídeo faça um custo médio pular um quadro em dois
    const intervalo = Math.max(28, custoMs / ORCAMENTO_DETECCAO);
    if (t - tUltDet < intervalo - FOLGA_DETECCAO || !video || video.readyState < 2 || !video.videoWidth) return;
    if (!usarRVFC) { if (video.currentTime === ultCT) return; ultCT = video.currentTime; }
    tUltDet = t;
    ultimoTs = Math.max(t, ultimoTs + 1);
    if (recCache && recCache.rec === rec) recCache.ts = ultimoTs;
    let res;
    try { const a = agora(); res = rec.recognizeForVideo(video, ultimoTs); custoMs = custoMs * 0.9 + (agora() - a) * 0.1; errosSeguidos = 0; }
    catch (e) { if (++errosSeguidos === 3) recuperar(e); return; }
    processar(res, t, { largura: video.videoWidth, altura: video.videoHeight });
  }
  function aoQuadro() { idVideo = 0; idRaf = 0; tUltQuadro = agora(); if (!ativo()) return; detectar(); ligarLaco(); }
  function ligarLaco() {
    if (!ativo() || idVideo || idRaf || simular) return;
    if (usarRVFC) idVideo = video.requestVideoFrameCallback(aoQuadro);
    else idRaf = requestAnimationFrame(aoQuadro);
  }
  function pararLaco() {
    if (idVideo) { try { video.cancelVideoFrameCallback(idVideo); } catch { /* ok */ } idVideo = 0; }
    if (idRaf) { cancelAnimationFrame(idRaf); idRaf = 0; }
  }
  /* 3 erros seguidos no reconhecimento: o GPU caiu (contexto perdido, driver). Troca para a CPU; na CPU, desiste.
     O reconhecedor quebrado sai do cache. */
  async function recuperar(e) {
    if (delegate !== 'GPU') {
      console.error('[maos]', e);
      descartarReconhecedor(rec); rec = null;
      mudarEstado('erro', { codigo: 'sem-gpu', mensagem: MENSAGENS['sem-gpu'] }); parar(); return;
    }
    recuperando = true; pararLaco();
    if (recCache && recCache.rec === rec) descartarReconhecedor(rec);
    else { try { rec.close(); } catch { /* ok */ } }
    rec = null;
    try {
      const r = guardarReconhecedor(await carregarReconhecedor({ delegate: 'CPU' }));
      if (parado) return;                       // fica guardado para o próximo ligar
      rec = r.rec; delegate = r.delegate; ultimoTs = Math.max(ultimoTs, r.ts); custoMs = r.custoMs || custoMs; errosSeguidos = 0;
      recuperando = false; tUltQuadro = agora(); ligarLaco();
    } catch (err) {
      recuperando = false; console.error('[maos]', err);
      const c = err && err.codigo === 'sem-modelo' ? 'sem-modelo' : 'sem-gpu';
      mudarEstado('erro', { codigo: c, mensagem: MENSAGENS[c] }); parar();
    }
  }
  function retomar() {
    tUltQuadro = agora();
    if (simulador) simulador.pausar(false); else ligarLaco();
  }
  function suspender() {
    pararLaco();
    if (simulador) simulador.pausar(true);
    soltarMao();
  }

  const aoVisibilidade = () => {
    const oculto = document.hidden;
    if (oculto === pausadoAba || parado) return;
    if (oculto) { pausadoAba = true; suspender(); mudarEstado('pausado', { motivo: 'aba' }); }
    else { pausadoAba = false; if (!pausadoUsuario) { mudarEstado('pronto', { simulado: simular, delegate }); retomar(); } }
  };
  const aoRedimensionar = () => nucleo.redimensionar(window.innerWidth, window.innerHeight);
  const aoTrilhaAcabar = () => {
    if (parado) return;
    mudarEstado('erro', { codigo: 'sem-camera', mensagem: MSG_CAMERA_CAIU });
    parar();
  };
  document.addEventListener('visibilitychange', aoVisibilidade);
  window.addEventListener('resize', aoRedimensionar, { passive: true });
  // daqui até o return não há await: a queda da trilha durante o carregamento já foi conferida acima
  if (stream) for (const tr of stream.getVideoTracks()) tr.addEventListener('ended', aoTrilhaAcabar);

  function parar() {
    if (parado) return;
    encerrando = true;
    try { soltarMao(); } catch (e) { console.error('[maos]', e); }
    parado = true;
    pararLaco();
    clearInterval(vigia);
    if (simulador) simulador.destruir();
    mouse.destruir();
    document.removeEventListener('visibilitychange', aoVisibilidade);
    window.removeEventListener('resize', aoRedimensionar);
    if (stream) { for (const tr of stream.getVideoTracks()) tr.removeEventListener('ended', aoTrilhaAcabar); pararStream(stream); }
    if (video && stream && video.srcObject === stream) { try { video.pause(); } catch { /* ok */ } video.srcObject = null; }
    // o reconhecedor do cache fica vivo para o próximo ligar (só a câmera e o laço param); um avulso é fechado
    if (rec && !(recCache && recCache.rec === rec)) { try { rec.close(); } catch { /* ok */ } }
    if (recCache && recCache.rec === rec) recCache.ts = Math.max(recCache.ts, ultimoTs);
    rec = null; stream = null;
    if (instanciaAtiva === maos) instanciaAtiva = null;
    mudarEstado('parado');
  }

  const maos = {
    simulado: simular,
    get delegate() { return delegate; },
    pausar(v) {
      if (parado) return;
      v = !!v;
      if (v === pausadoUsuario) return;
      if (v) { pausadoUsuario = true; suspender(); mudarEstado('pausado', { motivo: 'pessoa' }); }
      else { pausadoUsuario = false; if (!pausadoAba) { mudarEstado('pronto', { simulado: simular, delegate }); retomar(); } }
    },
    parar,
    configurar(cfg = {}) { return nucleo.configurar(cfg); },
    estado: () => estadoAtual,
    info: () => ({ estado: estadoAtual, simulado: simular, delegate, qps: Math.round(qps), custoMs: Math.round(custoMs * 10) / 10, laco: simular ? 'simulador' : usarRVFC ? 'video' : 'raf', config: { ...nucleo.cfg } }),
    simulador: null,
  };
  instanciaAtiva = maos;

  if (simular) {
    simulador = criarSimulador({
      aoResultado: (res, t) => processar(res, t, { largura: 640, altura: 480 }),
      tamanho: () => ({ W: window.innerWidth, H: window.innerHeight }),
      zona: () => nucleo.zonaDoLado('Direita'),   // a mão de mentira é uma direita: a mesma zona que o núcleo usa
    });
    if (pausadoAba) simulador.pausar(true);
    maos.simulador = simulador.api;
  } else {
    // vigia: se o requestVideoFrameCallback não chegar (vídeo fora da tela em alguns navegadores), cai para rAF
    vigia = setInterval(() => {
      if (ativo() && usarRVFC && agora() - tUltQuadro > 700) { pararLaco(); usarRVFC = false; tUltQuadro = agora(); ligarLaco(); }
    }, 500);
    ligarLaco();
  }
  mudarEstado(pausadoAba ? 'pausado' : 'pronto', { simulado: simular, delegate });
  chamar(cb.progresso, 'mao', 0);
  return maos;
}
