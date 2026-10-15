/* Cérebro da Lube — js/jarvis-hud.js  (agente INTERFACE)
   O HUD do modo Jarvis no estilo do filme, nas cores da Lube (JARVIS.md §3 e §7.2–7.6): núcleo com a logo, anéis
   segmentados girando em sentidos opostos, régua de graus, arcos de progresso, anel de onda que reage à voz, esfera em
   arame, malha de hexágonos, varredura, brilho em duas passadas, e a TRANSIÇÃO robô ↔ HUD (o mergulho no visor).

   Uso (js/jarvis.js):
     const hud = criarHud({ raiz, canvas, reduzido, robo, cena, onFase });
     await hud.entrar();             // 1,4 s; onFase('paineis') ~1050 ms e onFase('pronto') ~1300 ms
     hud.estado('ouvindo'|'pensando'|'falando'|'interrompido'|'confirmando'|'sem-conexao'|'repouso');
     hud.modelo('haiku'|'sonnet'); hud.nivel(bandas64, db) (microfone); hud.palavra(0..1) (cada palavra falada)
     hud.hexagono() (ferramenta); hud.centro() -> {x, y, r}; await hud.sair() (1,0 s); hud.destruir()
   Cores: só tokens do CSS (lidos uma vez com getComputedStyle, como o efeitos-maos.js); nada de cor literal fora da reserva.
   Movimento reduzido: sem giro nem voo; só opacidade e cor mudam; a onda vira uma barra de nível. */

const TAU = Math.PI * 2, DEG = Math.PI / 180;
// reserva = tokens do CONTRATO.md §3 (o valor de verdade vem do CSS)
const RESERVA = {
  '--holo': '#45d4ff', '--ink': '#e8eeff', '--azul': '#2a41c8', '--vermelho': '#e5202c', '--alerta': '#ff6b74',
  '--muted': '#8a97c4', '--bg': '#050b1c', '--branco': '#ffffff', '--logo-azul': '#16218A', '--logo-vermelho': '#F20D1F',
  '--ok': '#34e89e', '--rever': '#ffb340', '--novo': '#5fb2ff'
};
// caminhos da logo (CONTRATO.md §2; viewBox 40 20 790 575)
const LOGO_L = 'M165 30L400 30L295 435L740 435L705 580L230 580Q48 580 72 410Z';
const LOGO_R = 'M430 30L650 30Q822 34 795 188L748 410L335 410Z';

/* ---------- utilidades ---------- */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const faixa = (t, a, b) => clamp01((t - a) / (b - a));
const eoc = (u) => 1 - (1 - u) ** 3;                    // easeOutCubic
const eic = (u) => u * u * u;                          // easeInCubic
const eiq = (u) => u * u;                              // easeInQuad
const eoq = (u) => 1 - (1 - u) * (1 - u);              // easeOutQuad
const eio = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const eob = (u, k = 1.4) => { const c = k + 1; return 1 + c * (u - 1) ** 3 + k * (u - 1) ** 2; };   // easeOutBack
const agora = () => performance.now();
const amortecer = (a, b, taxa, dt) => a + (b - a) * (1 - Math.exp(-taxa * dt));
// teste local: window.__jvLento = 10 deixa a transição 10× mais lenta (para conferir quadro a quadro); fora do
// localhost/arquivo é sempre 1
const LOCAL = (() => { try { return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname); } catch { return false; } })();
const lento = () => (LOCAL && typeof window.__jvLento === 'number' && window.__jvLento > 0 ? window.__jvLento : 1);

function rgbDe(c, reserva) {
  const s = String(c || '').trim();
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)];
  m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(s);
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (m) return [+m[1], +m[2], +m[3]];
  return reserva ? rgbDe(reserva) : [69, 212, 255];
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a < 0 ? 0 : a > 1 ? 1 : +a.toFixed(3)})`;
function lerCores() {
  let cs = null;
  try { cs = getComputedStyle(document.documentElement); } catch { cs = null; }
  const tk = (n) => rgbDe(cs ? cs.getPropertyValue(n) : '', RESERVA[n]);
  return {
    holo: tk('--holo'), ink: tk('--ink'), azul: tk('--azul'), vermelho: tk('--vermelho'), alerta: tk('--alerta'),
    muted: tk('--muted'), bg: tk('--bg'), branco: tk('--branco'), logoAzul: tk('--logo-azul'), logoVermelho: tk('--logo-vermelho'),
    ok: tk('--ok'), rever: tk('--rever'), novo: tk('--novo')
  };
}
function novoCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

// velocidade e movimento de cada estado (JARVIS.md §7.4); a troca tem rampa de ~400 ms, menos o "interrompido"
const ESTADOS = {
  repouso: { vel: 0.5, estica: 0, varre: 0, regua: 0, respira: 0.2, verm: 0, cinza: 0, nucleo: 1, pulso: 0 },
  ouvindo: { vel: 1, estica: 0, varre: 0, regua: 0, respira: 0.5, verm: 0, cinza: 0, nucleo: 1, pulso: 0 },
  pensando: { vel: 2.5, estica: 1, varre: 1, regua: 1, respira: 0.2, verm: 0, cinza: 0, nucleo: 1, pulso: 2 },
  falando: { vel: 1.2, estica: 0, varre: 0, regua: 0, respira: 0.2, verm: 0, cinza: 0, nucleo: 1, pulso: 0 },
  interrompido: { vel: 0, estica: 0, varre: 0, regua: 0, respira: 0, verm: 0, cinza: 0, nucleo: 1, pulso: 0 },
  confirmando: { vel: 0.3, estica: 0, varre: 0, regua: 0, respira: 1, verm: 1, cinza: 0, nucleo: 0.3, pulso: 0 },
  'sem-conexao': { vel: 0, estica: 0, varre: 0, regua: 0, respira: 0, verm: 0, cinza: 1, nucleo: 0.4, pulso: 0 }
};

/* =============================================================================
   Sons do HUD (Web Audio, gerados em código; JARVIS.md §7.6). Pico ≈ −18 dBFS.
   ============================================================================= */
export function criarSons() {
  let ctx = null, ruido = null, mudo = false, saida = null;
  const PICO = 0.125;   // −18 dBFS
  function garantir() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        saida = ctx.createGain(); saida.gain.value = 1; saida.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    } catch { return null; }
  }
  function bufRuido() {
    if (ruido || !ctx) return ruido;
    const n = Math.round(ctx.sampleRate * 0.6), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let s = 1234567;
    for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    return (ruido = b);
  }
  function env(g, t0, ata, dur, pico) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(pico, t0 + ata);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  function tom(f0, f1, ini, dur, pico, tipo = 'sine') {
    const t0 = ctx.currentTime + ini, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    env(g, t0, Math.min(0.012, dur / 4), dur, pico);
    o.connect(g); g.connect(saida); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function chiado(f0, f1, ini, dur, pico) {
    const t0 = ctx.currentTime + ini, s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = bufRuido(); bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    env(g, t0, dur * 0.3, dur, pico);
    s.connect(bp); bp.connect(g); g.connect(saida); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  function grave(f, ini, dur, pico) {
    const t0 = ctx.currentTime + ini, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 420;
    env(g, t0, 0.004, dur, pico);
    o.connect(lp); lp.connect(g); g.connect(saida); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  const SONS = {
    abrir() { tom(220, 880, 0, 0.35, PICO * 0.8); chiado(800, 4000, 0, 0.35, PICO * 0.45); },
    pronto() { tom(1320, 1320, 0, 0.06, PICO * 0.7); tom(1760, 1760, 0.1, 0.06, PICO * 0.7); },
    ferramenta() { tom(2400, 2400, 0, 0.02, PICO * 0.5, 'square'); },
    interrompido() { grave(180, 0, 0.04, PICO); },
    confirmacao() { tom(660, 440, 0, 0.26, PICO * 0.8, 'triangle'); },
    sair() { tom(880, 220, 0, 0.35, PICO * 0.8); chiado(4000, 800, 0, 0.35, PICO * 0.45); }
  };
  return {
    tocar(nome) { if (mudo || !SONS[nome] || !garantir()) return; try { SONS[nome](); } catch { /* sem som */ } },
    mudo(v) { mudo = !!v; },
    contexto: () => garantir(),
    destruir() { try { ctx && ctx.close(); } catch { /* nada */ } ctx = null; ruido = null; }
  };
}

/* =============================================================================
   criarHud
   ============================================================================= */
export function criarHud(opts = {}) {
  const raiz = opts.raiz, cv = opts.canvas;
  if (!raiz || !cv) throw new Error('HUD sem raiz ou canvas.');
  const reduzido = typeof opts.reduzido === 'function' ? opts.reduzido : () => !!opts.reduzido;
  const robo = typeof opts.robo === 'function' ? opts.robo : () => opts.robo || null;
  const cena = typeof opts.cena === 'function' ? opts.cena : () => ({});
  const onFase = typeof opts.onFase === 'function' ? opts.onFase : () => {};
  const g = cv.getContext('2d');
  const cenaEl = raiz.querySelector('.jv-cena');
  const leiturasEl = raiz.querySelector('.jv-leituras');
  const veuEl = raiz.querySelector('.jv-veu'), fundoEl = raiz.querySelector('.jv-fundo'), graoEl = raiz.querySelector('.jv-grao');
  let C = lerCores();

  // Logo em Path2D (unidades do viewBox; centro ≈ (435, 307))
  let pLogoL = null, pLogoR = null;
  try { pLogoL = new Path2D(LOGO_L); pLogoR = new Path2D(LOGO_R); } catch { pLogoL = pLogoR = null; }

  /* ---------- medidas ---------- */
  let W = 1, H = 1, dpr = 1, R = 200, hx = 0, hy = 0, celular = false;
  let L = null, lg = null, G1 = null, g1 = null, G2 = null, g2 = null, LS = 0;   // camada dos anéis e as do brilho
  let cacheRegua = null, cacheHex = null, hexCentros = [], chaveCache = '';
  function medir() {
    const r = raiz.getBoundingClientRect();
    W = Math.max(1, r.width || innerWidth); H = Math.max(1, r.height || innerHeight);
    celular = W < 760;
    const baixa = !!opts.qualidadeBaixa?.();
    dpr = Math.min(window.devicePixelRatio || 1, baixa ? 1.25 : 1.75);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // geometria (§7.3): R = 0,30 × min(L, A); abaixo de 600 px, 0,40 × largura; centro a 46% da altura; os anéis (até
    // 0,92R) cabem entre os painéis laterais e entre a barra de cima e o pé
    if (celular) {
      R = Math.min(W < 600 ? 0.40 * W : 0.30 * Math.min(W, H), (H * 0.52) / 2.1);
      hx = W / 2; hy = Math.max(64 + 0.98 * R, Math.min(H * 0.3, H - 360 - 0.98 * R));
    } else {
      // painéis: Atividade à esquerda e Exibição à direita (as mesmas larguras do CSS, --jv-pe e --jv-pd)
      // o pé (legenda + caixa de texto) ocupa ~236 px: os anéis e as leituras dos cantos ficam acima dele
      const pe = W >= 1280 ? 300 : 250, pd = W >= 1280 ? 340 : 270, livre = W - pe - pd - 4 * 24, pePx = H < 720 ? 196 : 236;
      R = Math.max(110, Math.min(0.32 * Math.min(W, H), livre / 1.84, (H - 76 - pePx) / 1.9));
      hx = Math.max(W * 0.38, Math.min(W * 0.62, W / 2 + (pe - pd) / 2));
      hy = Math.max(76 + 0.95 * R, Math.min(H * 0.46, H - pePx - 0.95 * R));
    }
    raiz.style.setProperty('--jv-cx', `${hx.toFixed(1)}px`);
    raiz.style.setProperty('--jv-cy', `${hy.toFixed(1)}px`);
    raiz.style.setProperty('--jv-r', `${R.toFixed(1)}px`);
    // camada dos anéis: só o quadrado do HUD (até ~1,2R, com o anel de radar e as linhas do horizonte), não a tela
    // inteira; brilho em 1/4 e 1/8
    LS = Math.ceil(2 * 1.2 * R * dpr);
    if (!L || L.width !== LS) {
      L = novoCanvas(LS, LS); lg = L.getContext('2d');
      G1 = novoCanvas(LS / 4, LS / 4); g1 = G1.getContext('2d');
      G2 = novoCanvas(LS / 8, LS / 8); g2 = G2.getContext('2d');
    }
    const chave = `${Math.round(R)}x${dpr}`;
    if (chave !== chaveCache) { chaveCache = chave; montarCaches(); }
  }

  /* ---------- pré-desenhos (régua, malha de hexágonos, grão) ---------- */
  function montarCaches() {
    // régua de graus (camada 5): 180 marcas a cada 2°, maiores a cada 10° e a cada 30° (com o número)
    const rr = 0.46 * R, tam = Math.ceil(2 * (rr + 0.075 * R) * dpr);
    cacheRegua = novoCanvas(tam, tam);
    const q = cacheRegua.getContext('2d');
    q.setTransform(dpr, 0, 0, dpr, tam / 2, tam / 2);
    q.lineCap = 'butt';
    for (let i = 0; i < 180; i++) {
      const a = i * 2 * DEG - Math.PI / 2, m30 = i % 15 === 0, m10 = i % 5 === 0;
      const len = m30 ? 0.04 * R : m10 ? 0.024 * R : 0.012 * R;
      q.strokeStyle = rgba(C.holo, m30 ? 0.85 : m10 ? 0.55 : 0.36);
      q.lineWidth = m30 ? 1.4 : 1;
      q.beginPath(); q.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); q.lineTo(Math.cos(a) * (rr - len), Math.sin(a) * (rr - len)); q.stroke();
    }
    q.strokeStyle = rgba(C.holo, 0.22); q.lineWidth = 1; q.beginPath(); q.arc(0, 0, rr + 1.5, 0, TAU); q.stroke();
    q.fillStyle = rgba(C.holo, 0.72); q.textAlign = 'center'; q.textBaseline = 'middle';
    q.font = `600 ${Math.max(8, Math.round(R * 0.034))}px "JetBrains Mono", Consolas, monospace`;
    for (let i = 0; i < 12; i++) {
      const a = i * 30 * DEG - Math.PI / 2, rt = rr + 0.045 * R;
      q.save(); q.translate(Math.cos(a) * rt, Math.sin(a) * rt); q.rotate(a + Math.PI / 2);
      q.fillText(String(i * 30).padStart(3, '0'), 0, 0); q.restore();
    }
    // malha de hexágonos (camada 11): lado 18 px, recorte circular até 1,15R, mais forte perto da borda dos anéis
    const rh = 1.15 * R, th = Math.ceil(2 * rh * dpr);
    cacheHex = novoCanvas(th, th);
    const h = cacheHex.getContext('2d');
    h.setTransform(dpr, 0, 0, dpr, th / 2, th / 2);
    const lado = 18, wq = Math.sqrt(3) * lado, hq = 1.5 * lado;
    hexCentros = [];
    h.lineWidth = 0.75;
    for (let row = -Math.ceil(rh / hq) - 1; row <= Math.ceil(rh / hq) + 1; row++) {
      for (let col = -Math.ceil(rh / wq) - 1; col <= Math.ceil(rh / wq) + 1; col++) {
        const x = col * wq + (row & 1 ? wq / 2 : 0), y = row * hq, d = Math.hypot(x, y);
        if (d > rh - lado) continue;
        const f = clamp01(1 - Math.abs(d / R - 0.95) / 0.55) * clamp01((rh - d) / (lado * 3));
        if (f < 0.04) continue;
        h.strokeStyle = rgba(C.holo, 0.035 + 0.11 * f);
        caminhoHex(h, x, y, lado - 1.2); h.stroke();
        if (d > 0.62 * R) hexCentros.push({ x, y, f });
      }
    }
  }
  function caminhoHex(q, x, y, s) {
    q.beginPath();
    for (let k = 0; k < 6; k++) { const a = TAU * k / 6 + Math.PI / 6; const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s; if (k) q.lineTo(px, py); else q.moveTo(px, py); }
    q.closePath();
  }
  // grão (3%), linhas de varredura de 2 px (4%) e vinheta: desenhados uma vez, no CSS da .jv-grao
  (function grao() {
    if (!graoEl) return;
    try {
      const t = novoCanvas(140, 140), q = t.getContext('2d'), img = q.createImageData(140, 140);
      let s = 987654;
      for (let i = 0; i < img.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = (s / 2147483647) * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      q.putImageData(img, 0, 0);
      graoEl.style.setProperty('--jv-ruido', `url(${t.toDataURL('image/png')})`);
    } catch { /* sem grão */ }
  })();

  /* ---------- estado ---------- */
  let estadoNome = 'repouso', modeloNome = 'haiku';
  const P = { vel: 0, estica: 0, varre: 0, regua: 0, respira: 0.2, verm: 0, cinza: 0, nucleo: 1, pulso: 0, sonnet: 0 };
  const ang = { seg: 0, arcos: 0, colch: 0, esfera: 0, regua: 0, varre: 0, trac: 0, micro: 0, radar: 0, tempo: 0 };
  let congeladoAte = 0, flashBranco = 0, glitch = 0, ultimo = agora();
  let env = 0, nivelDb = -90, nivelGeral = 0;
  const bandas = new Float32Array(64), bandasAlvo = new Float32Array(64);
  let micVivo = false;
  const hexAcesos = [];
  let proxHex = 0;
  // linha do tempo da transição
  const T = { modo: 'fechado', t0: 0, resolver: null, origem: null, fases: new Set() };
  // quanto cada camada está desenhada (0..1) e a escala/opacidade dela; "aberto" = tudo em 1
  const V = { veu: 0, fundo: 0, ponto: 0, flash: 0, raias: 0, nucleo: 0, cx: 0, cy: 0, anelN: 0, onda: 0, seg: 0, regua: 0, arcos: 0, trac: 0, ext: 0, extEsc: 1, fundoCamadas: 0, colapso: [1, 1, 1, 1, 1, 1, 1], micro: 0, leituras: 0 };
  // profundidade: mouse com mola amortecida (o atraso do filme)
  const mola = { x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0 };
  function aoMover(e) { if (!W) return; mola.ax = clamp01(e.clientX / W) * 2 - 1; mola.ay = clamp01(e.clientY / H) * 2 - 1; }
  window.addEventListener('pointermove', aoMover, { passive: true });

  /* ---------- laço ---------- */
  let raf = 0, vivo = false, destruido = false;
  function ligar() { if (!raf && !destruido) { ultimo = agora(); raf = requestAnimationFrame(quadro); } }
  function desligar() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function quadro() {
    raf = 0;
    if (destruido) return;
    if (document.hidden) { vivo = true; return; }   // volta no visibilitychange
    const now = agora(), dt = Math.min(0.05, Math.max(0, (now - ultimo) / 1000));
    ultimo = now;
    try { passo(now, dt); } catch (err) { try { console.warn('[Jarvis] HUD falhou num quadro.', err); } catch { /* nada */ } }
    if (T.modo !== 'fechado') raf = requestAnimationFrame(quadro);
  }
  function aoVisivel() { if (!document.hidden && vivo && T.modo !== 'fechado') { vivo = false; ligar(); } }
  document.addEventListener('visibilitychange', aoVisivel);

  function passo(now, dt) {
    const red = reduzido();
    linhaDoTempo(now, red);
    // parâmetros do estado com rampa (~400 ms ease); o "interrompido" congela seco
    const alvo = ESTADOS[estadoNome] || ESTADOS.repouso;
    const congelado = now < congeladoAte;
    const taxa = 7.5;
    for (const k of ['estica', 'varre', 'regua', 'respira', 'verm', 'cinza', 'nucleo']) P[k] = amortecer(P[k], alvo[k], taxa, dt);
    const velAlvo = congelado ? 0 : alvo.vel * (estadoNome === 'pensando' && modeloNome === 'sonnet' ? 0.64 : 1);
    P.vel = congelado ? 0 : amortecer(P.vel, velAlvo, estadoNome === 'interrompido' ? 12 : taxa, dt);
    P.pulso = alvo.pulso;
    P.sonnet = amortecer(P.sonnet, modeloNome === 'sonnet' && estadoNome === 'pensando' ? 1 : 0, 4, dt);
    const v = red ? 0 : P.vel;
    ang.tempo += dt;
    ang.seg += 12 * DEG * v * dt;          // camada 4: +12°/s (horário)
    ang.arcos -= 20 * DEG * v * dt;        // camada 6: −20°/s (anti-horário)
    ang.colch += 6 * DEG * v * dt;         // camada 8: +6°/s
    ang.esfera += 8 * DEG * (red ? 0 : Math.max(0.35, P.vel)) * dt;   // camada 10: 8°/s
    ang.regua -= 4 * DEG * P.regua * (red ? 0 : 1) * dt;              // pensando: −4°/s
    ang.varre += 90 * DEG * (red ? 0 : 1) * dt;                        // varredura: 90°/s
    ang.trac += 30 * v * dt;                                           // camada 7: a fase anda +30 px/s
    ang.micro -= 2 * DEG * v * dt;
    ang.radar += 4 * DEG * v * dt;
    // voz: envelope das palavras decai em 180 ms; bandas do microfone suavizadas
    env = Math.max(0, env - dt / 0.18);
    for (let i = 0; i < 64; i++) bandas[i] = amortecer(bandas[i], micVivo ? bandasAlvo[i] : 0, 18, dt);
    // profundidade
    const k = 26, c = 2 * Math.sqrt(k) * 0.7;
    const ax = red ? 0 : mola.ax, ay = red ? 0 : mola.ay;
    mola.vx += (k * (ax - mola.x) - c * mola.vx) * dt; mola.x += mola.vx * dt;
    mola.vy += (k * (ay - mola.y) - c * mola.vy) * dt; mola.y += mola.vy * dt;
    if (cenaEl) cenaEl.style.transform = red ? '' : `perspective(1400px) rotateX(${(-mola.y * 4).toFixed(2)}deg) rotateY(${(mola.x * 4).toFixed(2)}deg)`;
    if (leiturasEl) leiturasEl.style.transform = red ? '' : `translate(${(mola.x * 14).toFixed(1)}px, ${(mola.y * 14).toFixed(1)}px)`;
    // hexágonos acesos ao acaso (3 a 5 na tela)
    if (!red && V.fundoCamadas > 0.5 && now > proxHex) { acenderHex(now); proxHex = now + 500 + Math.random() * 900; }
    for (let i = hexAcesos.length - 1; i >= 0; i--) if (now - hexAcesos[i].t0 > 1200) hexAcesos.splice(i, 1);
    flashBranco = Math.max(0, flashBranco - dt / 0.08);
    desenhar(now, red);
  }

  /* ---------- transição (JARVIS.md §7.5) ---------- */
  function fase(nome) { if (!T.fases.has(nome)) { T.fases.add(nome); try { onFase(nome); } catch { /* nada */ } } }
  function linhaDoTempo(now, red) {
    // teste local: window.__jvT = 480 congela a transição nesse instante (ms), para conferir quadro a quadro
    const t = LOCAL && typeof window.__jvT === 'number' ? window.__jvT : (now - T.t0) / lento(), rb = robo();
    if (T.modo === 'entrando') {
      if (red) {
        const f = faixa(t, 0, 200);
        Object.assign(V, { veu: 0, fundo: f, ponto: 0, flash: 0, raias: 0, nucleo: f, anelN: f, onda: f, seg: f, regua: f, arcos: f, trac: f, ext: f, extEsc: 1, fundoCamadas: f, micro: f, leituras: f });
        V.cx = hx; V.cy = hy;
        if (t >= 120) fase('paineis');
        if (t >= 200) { fase('pronto'); concluir('aberto'); }
        return;
      }
      // 0–350: a câmera avança até o visor; o véu sobe de 0 a 0,4
      const m = eic(faixa(t, 0, 350));
      V.veu = 0.4 * eoq(faixa(t, 0, 350));
      // 250–500: os olhos se fecham num ponto de luz
      const p = eiq(faixa(t, 250, 500));
      if (rb) { try { rb.mergulho(m); rb.olhosPonto(p); } catch { /* sem robô */ } }
      // origem = os olhos do robô (seguindo a cabeça até o clarão)
      if (t < 470 && rb) { const o = pontoVisor(rb); if (o) T.origem = o; }
      const o = T.origem || { x: hx, y: hy };
      V.ponto = faixa(t, 380, 470) * (1 - faixa(t, 470, 560));
      // 450–600: clarão; o fundo do HUD fecha atrás dele (o #palco some)
      V.flash = t >= 450 && t <= 640 ? faixa(t, 450, 640) : 0;
      V.fundo = eoq(faixa(t, 470, 590));
      // 550: o núcleo nasce (easeOutBack); 550–900: viaja dos olhos até o centro do HUD; a onda de choque sai dele
      V.nucleo = t < 550 ? 0 : eob(faixa(t, 550, 900), 1.4);
      V.raias = t < 540 ? 0 : faixa(t, 540, 880);
      const cm = eoc(faixa(t, 550, 920));
      V.cx = lerp(o.x, hx, cm); V.cy = lerp(o.y, hy, cm);
      // 600–1000: anéis de dentro para fora, um a cada 70 ms
      V.anelN = eoc(faixa(t, 600, 860));
      V.onda = eoc(faixa(t, 670, 930));
      V.seg = faixa(t, 740, 740 + 24 * 12);
      V.regua = eoc(faixa(t, 810, 1110));
      V.arcos = eoc(faixa(t, 880, 1180));
      V.trac = eoc(faixa(t, 950, 1210));
      V.ext = eoc(faixa(t, 1020, 1320)); V.extEsc = lerp(1.15, 1, V.ext);
      // 1050–1350: esfera, hexágonos e grão; leituras digitadas; painéis
      V.fundoCamadas = eoc(faixa(t, 1050, 1350));
      V.micro = eoc(faixa(t, 1120, 1400));
      V.leituras = faixa(t, 1050, 1300);
      if (t >= 1050) fase('paineis');
      if (t >= 1300) fase('pronto');
      if (t >= 1400) concluir('aberto');
    } else if (T.modo === 'saindo') {
      if (red) {
        const f = 1 - faixa(t, 0, 200);
        Object.assign(V, { veu: 0, fundo: f, ponto: 0, flash: 0, raias: 0, nucleo: f, anelN: f, onda: f, seg: f, regua: f, arcos: f, trac: f, ext: f, fundoCamadas: f, micro: f, leituras: f });
        if (rb) { try { rb.mergulho(0); rb.olhosPonto(0); } catch { /* nada */ } }
        if (t >= 200) concluir('fechado');
        return;
      }
      // 0–200: leituras somem; 200–700: anéis recolhem de fora para dentro (60 ms de defasagem)
      V.leituras = 1 - faixa(t, 0, 200);
      V.micro = 1 - eoc(faixa(t, 0, 220));
      V.fundoCamadas = 1 - eoc(faixa(t, 60, 420));
      const ordem = ['ext', 'trac', 'arcos', 'regua', 'seg', 'onda', 'anelN'];
      ordem.forEach((nome, i) => { const f = eoc(faixa(t, 200 + i * 60, 200 + i * 60 + 260)); V.colapso[i] = 1 - f; V[nome] = 1 - f; });
      V.extEsc = 1;
      // 700–850: o núcleo vira o ponto e volta para os olhos; 600–760: o fundo abre e o robô aparece
      const dest = rb ? pontoVisor(rb) : null;
      if (dest) T.origem = dest;
      const o = T.origem || { x: hx, y: hy };
      const cm = eic(faixa(t, 620, 850));
      V.cx = lerp(hx, o.x, cm); V.cy = lerp(hy, o.y, cm);
      V.nucleo = 1 - eic(faixa(t, 640, 850));
      V.ponto = faixa(t, 700, 800) * (1 - faixa(t, 840, 900));
      V.fundo = 1 - eoq(faixa(t, 600, 780));
      V.flash = 0; V.raias = 0;
      // 800–1000: o ponto se abre nos olhos (neutro, olhando para o Júlio) e a câmera recua; o véu desce
      V.veu = 0.4 * (1 - faixa(t, 800, 1000));
      if (rb) { try { rb.olhosPonto(1 - eoc(faixa(t, 820, 1000))); rb.mergulho(1 - eio(faixa(t, 800, 1000))); } catch { /* nada */ } }
      if (t >= 1000) concluir('fechado');
    } else if (T.modo === 'aberto') {
      Object.assign(V, { veu: 0, fundo: 1, ponto: 0, flash: 0, raias: 0, nucleo: 1, anelN: 1, onda: 1, seg: 1, regua: 1, arcos: 1, trac: 1, ext: 1, extEsc: 1, fundoCamadas: 1, micro: 1, leituras: 1 });
      V.cx = hx; V.cy = hy;
    }
    if (veuEl) veuEl.style.opacity = V.veu.toFixed(3);
    if (fundoEl) fundoEl.style.opacity = V.fundo.toFixed(3);
    if (graoEl) graoEl.style.opacity = (V.fundoCamadas * V.fundo).toFixed(3);
    if (leiturasEl) leiturasEl.style.opacity = V.leituras.toFixed(3);
  }
  function pontoVisor(rb) {
    try {
      const p = rb.visor();
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      // visor() vem em px do canvas do robô (= #app); a raiz do HUD cobre o #app inteiro
      return { x: p.x, y: p.y };
    } catch { return null; }
  }
  function concluir(modo) {
    const res = T.resolver;
    T.resolver = null;
    T.modo = modo;
    if (modo === 'aberto') { V.cx = hx; V.cy = hy; }
    if (modo === 'fechado') { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); desligar(); }
    if (res) res();
  }

  /* ---------- desenho ---------- */
  function corLinha() {
    let c = C.holo;
    if (P.sonnet > 0.001) c = mix(c, C.ink, 0.1 * P.sonnet);
    if (P.cinza > 0.001) c = mix(c, C.muted, P.cinza);
    return c;
  }
  function corAcao(base) { return P.verm > 0.001 ? mix(base, C.vermelho, P.verm) : base; }

  function desenhar(now, red) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    if (T.modo === 'fechado') return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = V.cx, cy = V.cy, t = ang.tempo;
    const cl = corLinha();
    const px = mola.x, py = mola.y;   // −1..1
    // plano de trás (±4 px): malha de hexágonos e esfera em arame
    if (V.fundoCamadas > 0.01) {
      const bx = cx + px * 4, by = cy + py * 4;
      if (cacheHex) {
        g.globalAlpha = V.fundoCamadas * (1 - 0.5 * P.cinza);
        const s = cacheHex.width / dpr;
        g.drawImage(cacheHex, bx - s / 2, by - s / 2, s, s);
        g.globalAlpha = 1;
        desenharHexAcesos(now, bx, by, cl);
      }
      desenharEsfera(bx, by, 0.70 * R, cl, V.fundoCamadas);
    }
    // halo difuso atrás do núcleo (--azul) e o "disco" do holograma: volume sutil por trás dos anéis
    if (V.nucleo > 0.01) {
      const hr = 0.62 * R, gr = g.createRadialGradient(cx, cy, 0, cx, cy, hr);
      gr.addColorStop(0, rgba(C.azul, 0.5 * V.nucleo * P.nucleo)); gr.addColorStop(0.55, rgba(C.azul, 0.14 * V.nucleo)); gr.addColorStop(1, rgba(C.azul, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, hr, 0, TAU); g.fill();
    }
    if (V.ext > 0.01) {
      const dr = 0.78 * R, al = Math.min(V.ext, V.fundo) * (1 - 0.5 * P.cinza);
      const gd = g.createRadialGradient(cx, cy, 0.2 * R, cx, cy, dr);
      gd.addColorStop(0, rgba(cl, 0)); gd.addColorStop(0.7, rgba(cl, 0.035 * al)); gd.addColorStop(0.96, rgba(cl, 0.075 * al)); gd.addColorStop(1, rgba(cl, 0));
      g.fillStyle = gd; g.beginPath(); g.arc(cx, cy, dr, 0, TAU); g.fill();
    }
    // plano do meio (±8 px): os anéis, numa camada própria para o brilho em duas passadas
    const mx = cx + px * 8, my = cy + py * 8;
    desenharAneis(now, red, cl);
    const s = LS / dpr;
    g.save();
    g.globalCompositeOperation = 'lighter';
    {   // brilho em duas passadas (vale também com movimento reduzido: é luz, não movimento)
      g1.setTransform(1, 0, 0, 1, 0, 0); g1.clearRect(0, 0, G1.width, G1.height); g1.drawImage(L, 0, 0, G1.width, G1.height);
      g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, G2.width, G2.height); g2.drawImage(G1, 0, 0, G2.width, G2.height);
      g.imageSmoothingEnabled = true;
      g.globalAlpha = 0.9; g.drawImage(G1, mx - s / 2, my - s / 2, s, s);
      g.globalAlpha = 0.75; g.drawImage(G2, mx - s / 2, my - s / 2, s, s);
    }
    g.globalAlpha = 1; g.drawImage(L, mx - s / 2, my - s / 2, s, s);
    // varredura (camada 9): cone de 40°, só pensando
    if (P.varre > 0.01 && V.regua > 0.5 && typeof g.createConicGradient === 'function') {
      const a0 = ang.varre - Math.PI / 2;
      // o cone fica atrás do traço que varre (sentido horário): forte na borda, some em 40°
      const cg = g.createConicGradient(a0 - 40 * DEG, mx, my);
      cg.addColorStop(0, rgba(cl, 0)); cg.addColorStop(39 / 360, rgba(cl, 0.24 * P.varre)); cg.addColorStop(40 / 360, rgba(cl, 0)); cg.addColorStop(1, rgba(cl, 0));
      g.fillStyle = cg; g.beginPath(); g.moveTo(mx, my); g.arc(mx, my, 0.8 * R, a0 - 40 * DEG, a0); g.closePath(); g.fill();
      // borda da varredura (traço fino)
      g.strokeStyle = rgba(cl, 0.55 * P.varre); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(mx + Math.cos(a0) * 0.16 * R, my + Math.sin(a0) * 0.16 * R); g.lineTo(mx + Math.cos(a0) * 0.8 * R, my + Math.sin(a0) * 0.8 * R); g.stroke();
    }
    g.restore();
    // núcleo e logo (plano do meio, junto dos anéis)
    desenharNucleo(mx, my, now, red);
    // clarão e ponto de luz da transição
    if (V.ponto > 0.01) {
      const o = T.origem || { x: cx, y: cy };
      const pr = 2 + 7 * V.ponto, gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, pr * 5);
      gr.addColorStop(0, rgba(C.branco, V.ponto)); gr.addColorStop(0.25, rgba(C.holo, 0.8 * V.ponto)); gr.addColorStop(1, rgba(C.holo, 0));
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, pr * 5, 0, TAU); g.fill(); g.restore();
    }
    if (V.flash > 0 && V.flash < 1) {
      const o = T.origem || { x: cx, y: cy }, f = V.flash, rf = 0.35 * R * eoq(f) + 4;
      // intensidade: sobe rápido (primeiro quarto) e apaga devagar
      const k = f < 0.22 ? f / 0.22 : 1 - (f - 0.22) / 0.78;
      g.save(); g.globalCompositeOperation = 'lighter';
      // bafo de luz na tela inteira, bem curto (o "clarão" do filme)
      g.fillStyle = rgba(C.holo, 0.1 * k); g.fillRect(0, 0, W, H);
      const gb = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, rf * 2.6);
      gb.addColorStop(0, rgba(C.holo, 0.5 * k)); gb.addColorStop(1, rgba(C.holo, 0));
      g.fillStyle = gb; g.beginPath(); g.arc(o.x, o.y, rf * 2.6, 0, TAU); g.fill();
      const gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, rf);
      gr.addColorStop(0, rgba(C.branco, k)); gr.addColorStop(0.3, rgba(C.ink, 0.95 * k)); gr.addColorStop(0.6, rgba(C.holo, 0.8 * k)); gr.addColorStop(1, rgba(C.holo, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, rf, 0, TAU); g.fill();
      // anel fino vermelho correndo para fora
      g.strokeStyle = rgba(C.vermelho, 0.4 * (1 - f)); g.lineWidth = 1.5;
      g.beginPath(); g.arc(o.x, o.y, 0.1 * R + 1.2 * R * eoc(f), 0, TAU); g.stroke();
      g.strokeStyle = rgba(C.holo, 0.5 * (1 - f)); g.lineWidth = 1;
      g.beginPath(); g.arc(o.x, o.y, 0.06 * R + 0.8 * R * eoc(f), 0, TAU); g.stroke();
      // raia horizontal (a linha de luz que abre o HUD)
      const lw = W * 0.6 * eoc(f), lh = 1.5;
      const lgx = g.createLinearGradient(o.x - lw, 0, o.x + lw, 0);
      lgx.addColorStop(0, rgba(C.holo, 0)); lgx.addColorStop(0.5, rgba(C.ink, 0.9 * (1 - f))); lgx.addColorStop(1, rgba(C.holo, 0));
      g.fillStyle = lgx; g.fillRect(o.x - lw, o.y - lh / 2, lw * 2, lh);
      g.restore();
    }
    // onda de choque do nascimento do núcleo: raias de luz correndo para fora (540–880 ms)
    if (V.raias > 0 && V.raias < 1) {
      const f = V.raias, e = eoc(f);
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const r0 of RAIAS) {
        const d = lerp(0.14 * R, 1.25 * R * r0.v, e), l = 0.1 * R * r0.v * (1 - f * 0.6), a = r0.a;
        g.strokeStyle = rgba(r0.forte ? C.ink : C.holo, (1 - f) * (r0.forte ? 0.9 : 0.6)); g.lineWidth = r0.forte ? 1.6 : 1;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); g.lineTo(cx + Math.cos(a) * (d + l), cy + Math.sin(a) * (d + l)); g.stroke();
      }
      g.restore();
    }
    if (flashBranco > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba(C.branco, 0.22 * flashBranco); g.fillRect(0, 0, W, H); g.restore(); }
    if (glitch > 0 && !red) { fazerGlitch(); glitch--; }
  }

  /* anéis (camadas 2–8 e as extras de micro-texto), na camada L com origem no centro dela */
  function desenharAneis(now, red, cl) {
    const q = lg, h = LS / 2;
    q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, LS, LS);
    q.setTransform(dpr, 0, 0, dpr, h, h);
    q.lineCap = 'butt';
    const t = ang.tempo;
    const ca = corAcao(cl);
    const esc = (i) => (T.modo === 'saindo' ? lerp(0.6, 1, V.colapso[i]) : 1);
    // 2 — anel do núcleo (0,22R): 2 px, desenha 360° em 260 ms na entrada; anel de marcas por dentro (0,19R)
    if (V.anelN > 0.001) {
      const r = 0.22 * R * esc(6);
      q.strokeStyle = rgba(cl, 0.9 * Math.min(1, V.anelN * 1.4)); q.lineWidth = 2.5;
      q.beginPath(); q.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * V.anelN); q.stroke();
      q.strokeStyle = rgba(cl, 0.35 * V.anelN); q.lineWidth = 1;
      const rt = 0.19 * R * esc(6);
      for (let i = 0; i < 60; i++) {
        const a = i * 6 * DEG - ang.micro * 3;
        const l = i % 5 === 0 ? 0.022 * R : 0.01 * R;
        q.beginPath(); q.moveTo(Math.cos(a) * rt, Math.sin(a) * rt); q.lineTo(Math.cos(a) * (rt - l), Math.sin(a) * (rt - l)); q.stroke();
      }
    }
    // 3 — onda da voz (0,30R ± 0,06R): polilinha fechada de 128 pontos
    if (V.onda > 0.001) desenharOnda(q, 0.30 * R * esc(5), cl, red);
    // 4 — anel segmentado (0,38R): 24 segmentos, vão de 3°, 1 a cada 6 mais grosso; +12°/s
    if (V.seg > 0.001) {
      const r = 0.38 * R * esc(4), acesos = T.modo === 'entrando' ? Math.floor(V.seg * 24 + 0.001) : 24;
      const alfaSeg = T.modo === 'saindo' ? V.seg : 1;
      q.strokeStyle = rgba(cl, 0.16 * alfaSeg); q.lineWidth = 1;
      q.beginPath(); q.arc(0, 0, r - 0.025 * R, 0, TAU); q.stroke();
      for (let i = 0; i < acesos; i++) {
        const a0 = ang.seg + i * 15 * DEG - Math.PI / 2, grosso = i % 6 === 0;
        q.strokeStyle = rgba(cl, (grosso ? 0.95 : 0.72) * alfaSeg); q.lineWidth = grosso ? 6 : 3;
        q.beginPath(); q.arc(0, 0, r, a0, a0 + 12 * DEG); q.stroke();
      }
    }
    // 5 — régua de graus (0,46R): pré-desenhada; entra varrendo (recorte em fatia) em 300 ms
    if (V.regua > 0.001 && cacheRegua) {
      const s = cacheRegua.width / dpr, e = esc(3);
      q.save();
      q.globalAlpha = T.modo === 'saindo' ? V.regua : 1;
      if (T.modo === 'entrando' && V.regua < 1) { q.beginPath(); q.moveTo(0, 0); q.arc(0, 0, s, -Math.PI / 2, -Math.PI / 2 + TAU * V.regua); q.closePath(); q.clip(); }
      q.rotate(ang.regua);
      q.drawImage(cacheRegua, -s * e / 2, -s * e / 2, s * e, s * e);
      q.restore();
    }
    // 6 — arcos de progresso (0,54R): 4 arcos de 20°, 35°, 50°, 70°; −20°/s; pensando: esticam e encolhem (20° ↔ 110°, 1,2 s)
    if (V.arcos > 0.001) {
      const r = 0.54 * R * esc(2), ARC = [20, 35, 50, 70], INI = [0, 82, 168, 250];
      q.strokeStyle = rgba(cl, 0.12 * V.arcos); q.lineWidth = 1;
      q.beginPath(); q.arc(0, 0, r, 0, TAU); q.stroke();
      q.strokeStyle = rgba(ca, 0.7 * (T.modo === 'saindo' ? V.arcos : 1)); q.lineWidth = 5;
      for (let i = 0; i < 4; i++) {
        const osc = 0.5 + 0.5 * Math.sin((t / 1.2) * TAU + i * 1.7);
        const len = lerp(ARC[i], lerp(20, 110, osc), P.estica) * DEG * V.arcos;
        const a0 = ang.arcos + INI[i] * DEG - Math.PI / 2;
        q.beginPath(); q.arc(0, 0, r, a0, a0 + len); q.stroke();
        // ponta de leitura: um tique fino depois de cada arco
        q.save(); q.lineWidth = 1; q.strokeStyle = rgba(cl, 0.5 * V.arcos);
        const ae = a0 + len + 3 * DEG;
        q.beginPath(); q.moveTo(Math.cos(ae) * (r - 6), Math.sin(ae) * (r - 6)); q.lineTo(Math.cos(ae) * (r + 6), Math.sin(ae) * (r + 6)); q.stroke();
        q.restore();
      }
    }
    // 7 — anel tracejado (0,62R): [2, 6], só a fase anda
    if (V.trac > 0.001) {
      const r = 0.62 * R * esc(1);
      q.save();
      q.strokeStyle = rgba(cl, 0.46 * V.trac); q.lineWidth = 1.5;
      q.setLineDash([2, 6]); q.lineDashOffset = -ang.trac;
      q.beginPath(); q.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * (T.modo === 'entrando' ? V.trac : 1)); q.stroke();
      q.restore();
    }
    // 8 — anel externo (0,74R): 1 px a 0,3 + 3 colchetes de 8° a cada 120°; respira (1,00–1,02)
    if (V.ext > 0.001) {
      const freq = estadoNome === 'ouvindo' ? 0.5 : estadoNome === 'confirmando' ? 1 : 0.2;
      const resp = red ? 1 : 1 + 0.01 * (1 + Math.sin(t * TAU * freq)) * Math.max(0.35, P.respira);
      const r = 0.74 * R * resp * V.extEsc * esc(0), al = T.modo === 'saindo' ? V.ext : V.ext;
      q.strokeStyle = rgba(ca, 0.3 * al + 0.25 * P.verm * (0.5 + 0.5 * Math.sin(t * TAU))); q.lineWidth = 1;
      q.beginPath(); q.arc(0, 0, r, 0, TAU); q.stroke();
      q.strokeStyle = rgba(ca, 0.95 * al); q.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const a0 = ang.colch + i * 120 * DEG - Math.PI / 2 - 4 * DEG;
        q.beginPath(); q.arc(0, 0, r + 3, a0, a0 + 8 * DEG); q.stroke();
        // triângulo marcador apontando para dentro
        const am = a0 + 4 * DEG, rr = r - 7;
        q.fillStyle = rgba(ca, 0.8 * al);
        q.beginPath(); q.moveTo(Math.cos(am) * rr, Math.sin(am) * rr);
        q.lineTo(Math.cos(am - 1.6 * DEG) * (rr - 7), Math.sin(am - 1.6 * DEG) * (rr - 7));
        q.lineTo(Math.cos(am + 1.6 * DEG) * (rr - 7), Math.sin(am + 1.6 * DEG) * (rr - 7)); q.closePath(); q.fill();
      }
      // marcas finas a cada 45° por fora (o "relógio" do anel externo)
      q.strokeStyle = rgba(cl, 0.4 * al); q.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const a = i * 45 * DEG; q.beginPath(); q.moveTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6)); q.lineTo(Math.cos(a) * (r + 13), Math.sin(a) * (r + 13)); q.stroke(); }
    }
    // extras: equalizador fino (0,82R), anel de micro-texto (0,90R) com o que o cérebro tem agora e o radar (1,0R)
    if (V.micro > 0.001) { desenharMicro(q, cl, red); desenharRadar(q, cl); }
  }

  function desenharRadar(q, cl) {
    const al = V.micro * (1 - 0.4 * P.cinza), r = R;
    // anel fino com marcas a cada 5° (maiores a cada 45°), girando devagar no sentido contrário ao do micro-texto
    q.strokeStyle = rgba(cl, 0.16 * al); q.lineWidth = 1;
    q.beginPath(); q.arc(0, 0, r, 0, TAU); q.stroke();
    q.beginPath();
    for (let i = 0; i < 72; i++) {
      const a = i * 5 * DEG + ang.radar, l = i % 9 === 0 ? 0.03 * R : 0.012 * R, ca = Math.cos(a), sa = Math.sin(a);
      q.moveTo(ca * r, sa * r); q.lineTo(ca * (r + l), sa * (r + l));
    }
    q.strokeStyle = rgba(cl, 0.34 * al); q.stroke();
    // dois arcos longos (100°), 2 px
    q.strokeStyle = rgba(cl, 0.6 * al); q.lineWidth = 2;
    for (const base of [0, Math.PI]) { const a0 = ang.radar + base + 20 * DEG; q.beginPath(); q.arc(0, 0, r - 0.018 * R, a0, a0 + 100 * DEG); q.stroke(); }
    // um ponto de luz correndo no anel
    const ao = -ang.radar * 2.5;
    q.fillStyle = rgba(C.ink, 0.9 * al); q.beginPath(); q.arc(Math.cos(ao) * r, Math.sin(ao) * r, 2.2, 0, TAU); q.fill();
    // horizonte: linhas curtas à esquerda e à direita, com 4 marcas cada
    q.strokeStyle = rgba(cl, 0.42 * al); q.lineWidth = 1;
    q.beginPath();
    for (const s of [-1, 1]) {
      q.moveTo(s * 1.05 * R, 0); q.lineTo(s * 1.19 * R, 0);
      for (let k = 0; k < 4; k++) { const x = s * (1.075 + k * 0.035) * R, h = k === 0 ? 5 : 2.5; q.moveTo(x, -h); q.lineTo(x, h); }
    }
    q.stroke();
  }

  function desenharOnda(q, r0, cl, red) {
    const N = 128, amp = 0.075 * R, al = T.modo === 'saindo' ? V.onda : 1;
    const t = ang.tempo;
    const deslocs = DESLOCS;
    for (let i = 0; i < N; i++) {
      const th = (i / N) * TAU;
      let d = 0;
      if (red) d = 0;
      else if (estadoNome === 'ouvindo' && micVivo) {
        // 64 bandas espelhadas em volta (a de baixo em cima, como no filme)
        const k = i < 64 ? i : 127 - i;
        d = bandas[k] * (0.85 + 0.15 * Math.sin(th * 7 + t * 4));
      } else if (estadoNome === 'falando') {
        d = env * (0.55 + 0.45 * Math.sin(th * 5 + t * 3.1) * Math.sin(th * 3 - t * 2.3)) + 0.04 * Math.sin(th * 9 + t * 6);
      } else if (estadoNome === 'pensando') {
        d = 0.14 * (0.5 + 0.5 * Math.sin(th * 4 + t * 1.6)) * (0.6 + 0.4 * Math.sin(th * 2 - t));
      } else if (estadoNome === 'ouvindo') {
        d = 0.05 * (0.5 + 0.5 * Math.sin(th * 6 + t * 2));
      }
      deslocs[i] = Math.max(0, Math.min(1, d)) * V.onda;
    }
    const sweep = T.modo === 'entrando' ? V.onda : 1;
    const ate = Math.max(2, Math.round(N * sweep));
    // faixa preenchida entre a onda de fora e a de dentro: a voz ganha corpo (só com o anel inteiro)
    if (ate >= N && !red) {
      q.beginPath();
      for (let i = 0; i <= N; i++) { const k = i % N, th = (k / N) * TAU - Math.PI / 2, r = r0 + deslocs[k] * amp; const x = Math.cos(th) * r, y = Math.sin(th) * r; if (i) q.lineTo(x, y); else q.moveTo(x, y); }
      for (let i = N; i >= 0; i--) { const k = i % N, th = (k / N) * TAU - Math.PI / 2, r = r0 - deslocs[k] * amp * 0.55; q.lineTo(Math.cos(th) * r, Math.sin(th) * r); }
      q.closePath();
      q.fillStyle = rgba(cl, 0.16 * al); q.fill();
    }
    // preenchimento sutil entre a onda de fora e a de dentro
    q.beginPath();
    for (let i = 0; i <= ate; i++) { const k = i % N, th = (k / N) * TAU - Math.PI / 2, r = r0 + deslocs[k] * amp; const x = Math.cos(th) * r, y = Math.sin(th) * r; if (i) q.lineTo(x, y); else q.moveTo(x, y); }
    if (ate >= N) q.closePath();
    q.strokeStyle = rgba(cl, 0.95 * al); q.lineWidth = 1.5; q.stroke();
    q.beginPath();
    for (let i = 0; i <= ate; i++) { const k = i % N, th = (k / N) * TAU - Math.PI / 2, r = r0 - deslocs[k] * amp * 0.55; const x = Math.cos(th) * r, y = Math.sin(th) * r; if (i) q.lineTo(x, y); else q.moveTo(x, y); }
    if (ate >= N) q.closePath();
    q.strokeStyle = rgba(cl, 0.42 * al); q.lineWidth = 1; q.stroke();
    // 96 barras radiais por dentro da onda: dão corpo ao anel da voz (crescem com o mesmo sinal)
    q.beginPath();
    const nb = Math.round(96 * sweep);
    for (let i = 0; i < nb; i++) {
      const k = Math.floor((i * N) / 96), th = (i / 96) * TAU - Math.PI / 2, ct = Math.cos(th), st = Math.sin(th);
      const r1 = r0 - 0.03 * R, r2 = r1 - (0.008 * R + deslocs[k] * 0.05 * R);
      q.moveTo(ct * r1, st * r1); q.lineTo(ct * r2, st * r2);
    }
    q.strokeStyle = rgba(cl, 0.32 * al); q.lineWidth = 1; q.stroke();
    // movimento reduzido: a onda vira uma barra de nível
    if (red) {
      const n = estadoNome === 'ouvindo' && micVivo ? nivelGeral : estadoNome === 'falando' ? env : 0;
      q.fillStyle = rgba(cl, 0.85); q.fillRect(-0.08 * R, r0 + 0.02 * R, 0.16 * R * n, 3);
      q.strokeStyle = rgba(cl, 0.35); q.lineWidth = 1; q.strokeRect(-0.08 * R, r0 + 0.02 * R, 0.16 * R, 3);
    }
  }
  const DESLOCS = new Float32Array(128);
  // raias da onda de choque (ângulos e velocidades fixos, sorteio determinístico)
  const RAIAS = (() => { let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); return Array.from({ length: 34 }, (_, i) => ({ a: (i / 34) * TAU + r() * 0.16, v: 0.65 + r() * 0.55, forte: r() < 0.3 })); })();
  let cenaEm = -1e9, cenaCache = {};   // o que o cérebro tem agora (contagens e saúde), lido no máximo 1 vez por segundo

  function desenharMicro(q, cl, red) {
    const al = V.micro * (1 - 0.4 * P.cinza);
    // equalizador fino: 90 barras radiais; reage ao microfone (ouvindo) e à voz (falando)
    const re = 0.82 * R, n = 90, t = ang.tempo;
    const nivel = estadoNome === 'ouvindo' && micVivo ? nivelGeral : estadoNome === 'falando' ? env * 0.8 : estadoNome === 'pensando' ? 0.25 : 0.06;
    q.strokeStyle = rgba(cl, 0.32 * al); q.lineWidth = 1.2;
    q.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2 + ang.micro;
      const ruido = 0.5 + 0.5 * Math.sin(i * 1.7 + t * 5) * Math.sin(i * 0.43 - t * 2.2);
      const l = 0.008 * R + 0.045 * R * (red ? 0 : nivel * ruido);
      q.moveTo(Math.cos(a) * re, Math.sin(a) * re); q.lineTo(Math.cos(a) * (re + l), Math.sin(a) * (re + l));
    }
    q.stroke();
    // anel de micro-texto: contagens do cérebro e a saúde (dado de verdade, não enfeite)
    const rm = 0.9 * R;
    q.strokeStyle = rgba(cl, 0.14 * al); q.lineWidth = 1;
    q.beginPath(); q.arc(0, 0, rm, 0, TAU); q.stroke();
    const t0 = agora();
    if (t0 - cenaEm > 1000) { cenaEm = t0; try { cenaCache = cena() || {}; } catch { cenaCache = {}; } }
    const c = cenaCache;
    const rotulos = [c.memorias != null ? `MEMÓRIAS ${c.memorias}` : 'MEMÓRIAS', c.rotinas != null ? `ROTINAS ${c.rotinas}` : 'ROTINAS',
      c.apps != null ? `APLICAÇÕES ${c.apps}` : 'APLICAÇÕES', c.saude ? `SAÚDE ${c.saude}` : `CONEXÕES ${c.conexoes ?? ''}`.trim()];
    q.fillStyle = rgba(cl, 0.62 * al);
    q.font = `600 ${Math.max(8, Math.round(R * 0.03))}px "JetBrains Mono", Consolas, monospace`;
    q.textAlign = 'center'; q.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const a = (45 + i * 90) * DEG - Math.PI / 2;
      const txt = rotulos[i].toUpperCase();
      // texto seguindo a curva (letra por letra), legível nos dois lados
      const baixo = Math.sin(a) > 0.2;
      q.save();
      const passo = (R * 0.03 * 0.78) / rm;   // ângulo por letra
      let a0 = a - (txt.length - 1) * passo / 2 * (baixo ? -1 : 1);
      for (const ch of txt) {
        q.save(); q.translate(Math.cos(a0) * rm, Math.sin(a0) * rm); q.rotate(a0 + (baixo ? -Math.PI / 2 : Math.PI / 2)); q.fillText(ch, 0, 0); q.restore();
        a0 += passo * (baixo ? -1 : 1);
      }
      q.restore();
      // vão no anel atrás do texto (o traço não passa por cima das letras): marcas nas pontas
      const meia = (txt.length * passo) / 2 + 2 * DEG;
      q.strokeStyle = rgba(cl, 0.55 * al); q.lineWidth = 1;
      for (const s of [-1, 1]) { const ap = a + s * meia; q.beginPath(); q.moveTo(Math.cos(ap) * (rm - 4), Math.sin(ap) * (rm - 4)); q.lineTo(Math.cos(ap) * (rm + 4), Math.sin(ap) * (rm + 4)); q.stroke(); }
    }
  }

  function desenharEsfera(cx, cy, r, cl, al) {
    // 12 meridianos (6 círculos máximos, a cada 30°) × 7 paralelos, girando no eixo vertical e inclinada 18° para quem
    // olha; a metade de trás mais fraca que a da frente (profundidade sem 3D de verdade)
    const inc = 18 * DEG, ci = Math.cos(inc), si = Math.sin(inc), giro = ang.esfera;
    g.lineWidth = 0.75;
    for (const frente of [false, true]) {
      g.strokeStyle = rgba(cl, (frente ? 0.22 : 0.07) * al);
      g.beginPath();
      const ponto = (x0, y0, z0, ant) => {
        const y = y0 * ci - z0 * si, z = y0 * si + z0 * ci, vis = (z > 0) === frente;
        const X = cx + x0 * r, Y = cy - y * r;
        if (vis && ant) g.lineTo(X, Y); else g.moveTo(X, Y);
        return vis;
      };
      for (let m = 0; m < 6; m++) {
        const lon = (m / 6) * Math.PI + giro, sl = Math.sin(lon), cl2 = Math.cos(lon);
        let ant = false;
        for (let k = 0; k <= 72; k++) { const a = (k / 72) * TAU, ca = Math.cos(a); ant = ponto(ca * sl, Math.sin(a), ca * cl2, ant); }
      }
      for (let p = 1; p <= 7; p++) {
        const lat = -Math.PI / 2 + (p / 8) * Math.PI, cla = Math.cos(lat), sla = Math.sin(lat);
        let ant = false;
        for (let k = 0; k <= 56; k++) { const lon = (k / 56) * TAU + giro; ant = ponto(cla * Math.sin(lon), sla, cla * Math.cos(lon), ant); }
      }
      g.stroke();
    }
  }

  function acenderHex(now) {
    if (!hexCentros.length) return;
    const vivos = hexAcesos.filter((h) => now - h.t0 < 1200).length;
    if (vivos >= 5) return;
    const n = vivos < 3 ? 2 : 1;
    for (let i = 0; i < n; i++) { const h = hexCentros[Math.floor(Math.random() * hexCentros.length)]; hexAcesos.push({ x: h.x, y: h.y, t0: now, forte: false }); }
  }
  function desenharHexAcesos(now, cx, cy, cl) {
    if (!hexAcesos.length) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const h of hexAcesos) {
      const e = now - h.t0, a = e < 300 ? e / 300 : Math.max(0, 1 - (e - 300) / 900);
      const k = (h.forte ? 0.55 : 0.32) * a * V.fundoCamadas;
      if (k <= 0.005) continue;
      caminhoHex(g, cx + h.x, cy + h.y, 16.5);
      g.fillStyle = rgba(cl, k * 0.35); g.fill();
      g.strokeStyle = rgba(cl, k); g.lineWidth = 1; g.stroke();
    }
    g.restore();
  }

  function desenharNucleo(cx, cy, now, red) {
    if (V.nucleo <= 0.001) return;
    const t = ang.tempo;
    let esc = red ? 1 : 1 + 0.03 * Math.sin(t * TAU * 0.25);   // respira 0,97–1,03 a 0,25 Hz
    if (!red && estadoNome === 'pensando') esc *= 1 + (modeloNome === 'sonnet' ? 0.05 : 0.025) * Math.sin(t * TAU * (modeloNome === 'sonnet' ? 1 : 2));
    if (!red && estadoNome === 'falando') esc *= 1 + 0.08 * env;
    esc *= V.nucleo;
    const r = 0.16 * R * esc, brilho = P.nucleo * (1 - 0.35 * P.cinza);
    const tint = P.verm > 0.01 ? mix(C.holo, C.vermelho, 0.4 * P.verm) : C.holo;
    g.save();
    g.globalCompositeOperation = 'lighter';
    // núcleo como um anel de luz: miolo azul profundo (a logo aparece), aro branco-ciano quente e o brilho para fora
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.55);
    gr.addColorStop(0, rgba(C.azul, 0.55 * brilho));
    gr.addColorStop(0.4, rgba(tint, 0.32 * brilho));
    gr.addColorStop(0.58, rgba(C.ink, 0.95 * brilho));
    gr.addColorStop(0.66, rgba(tint, 0.85 * brilho));
    gr.addColorStop(0.8, rgba(tint, 0.22 * brilho));
    gr.addColorStop(1, rgba(tint, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * 1.55, 0, TAU); g.fill();
    // 12 lâminas finas girando dentro do aro (o "motor" do núcleo); param no movimento reduzido
    g.strokeStyle = rgba(C.ink, 0.42 * brilho); g.lineWidth = 1.4;
    const giro = red ? 0 : t * (estadoNome === 'pensando' ? 2.6 : 0.7);
    g.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = giro + (i / 12) * TAU;
      g.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
      g.lineTo(cx + Math.cos(a + 0.18) * r * 0.86, cy + Math.sin(a + 0.18) * r * 0.86);
    }
    g.stroke();
    // reflexo em cruz (lente), comprido e discreto
    if (!red) {
      const l = r * 3.2;
      const lx = g.createLinearGradient(cx - l, 0, cx + l, 0);
      lx.addColorStop(0, rgba(tint, 0)); lx.addColorStop(0.5, rgba(C.ink, 0.32 * brilho)); lx.addColorStop(1, rgba(tint, 0));
      g.fillStyle = lx; g.fillRect(cx - l, cy - 0.75, l * 2, 1.5);
      const ly = g.createLinearGradient(0, cy - l * 0.5, 0, cy + l * 0.5);
      ly.addColorStop(0, rgba(tint, 0)); ly.addColorStop(0.5, rgba(C.ink, 0.2 * brilho)); ly.addColorStop(1, rgba(tint, 0));
      g.fillStyle = ly; g.fillRect(cx - 0.6, cy - l * 0.5, 1.2, l);
    }
    g.restore();
    // a logo da Lube no lugar do núcleo (contorno branco, L azul, R vermelho)
    if (pLogoL && pLogoR) {
      const alt = 0.15 * R * esc, k = alt / 575;
      g.save();
      g.translate(cx, cy); g.scale(k, k); g.translate(-435, -307);
      g.globalAlpha = Math.min(1, V.nucleo) * (0.55 + 0.45 * P.nucleo);
      g.lineJoin = 'round'; g.lineWidth = 34; g.strokeStyle = rgba(C.branco, 1);
      g.shadowColor = rgba(C.holo, 0.95); g.shadowBlur = 14 * dpr;   // o desfoque da sombra não segue a escala
      g.stroke(pLogoL); g.stroke(pLogoR);
      g.shadowBlur = 0;
      g.fillStyle = rgba(C.logoAzul, 1); g.fill(pLogoL);
      g.fillStyle = rgba(C.logoVermelho, 1); g.fill(pLogoR);
      g.restore();
    }
  }

  // 2 quadros de "glitch": fatias deslocadas ±6 px (interrupção)
  let tmp = null;
  function fazerGlitch() {
    try {
      if (!tmp || tmp.width !== cv.width || tmp.height !== cv.height) tmp = novoCanvas(cv.width, cv.height);
      const tq = tmp.getContext('2d');
      tq.clearRect(0, 0, tmp.width, tmp.height); tq.drawImage(cv, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      const fatias = 7;
      for (let i = 0; i < fatias; i++) {
        const y = Math.floor(Math.random() * cv.height), hh = Math.floor((8 + Math.random() * 30) * dpr), dx = (Math.random() < 0.5 ? -6 : 6) * dpr;
        g.clearRect(0, y, cv.width, hh);
        g.drawImage(tmp, 0, y, cv.width, hh, dx, y, cv.width, hh);
      }
    } catch { /* sem glitch */ }
  }

  /* ---------- API ---------- */
  function entrar() {
    C = lerCores();
    medir();
    T.fases.clear();
    T.modo = 'entrando'; T.t0 = agora();
    T.origem = pontoVisor(robo() || {}) || { x: hx, y: hy };
    V.cx = T.origem.x; V.cy = T.origem.y;
    Object.assign(V, { veu: 0, fundo: 0, ponto: 0, flash: 0, raias: 0, nucleo: 0, anelN: 0, onda: 0, seg: 0, regua: 0, arcos: 0, trac: 0, ext: 0, extEsc: 1.15, fundoCamadas: 0, micro: 0, leituras: 0 });
    V.colapso = [1, 1, 1, 1, 1, 1, 1];
    P.vel = 0.3;
    ligar();
    return new Promise((res) => { T.resolver = res; });
  }
  function sair() {
    if (T.modo === 'fechado') return Promise.resolve();
    // se ainda estava entrando, a saída começa do ponto atual (sem pular)
    if (T.resolver) { const r = T.resolver; T.resolver = null; r(); }
    T.fases.clear();
    T.modo = 'saindo'; T.t0 = agora();
    V.colapso = [1, 1, 1, 1, 1, 1, 1];
    ligar();
    return new Promise((res) => { T.resolver = res; });
  }
  function estado(nome) {
    if (!ESTADOS[nome]) nome = 'repouso';
    const antes = estadoNome;
    estadoNome = nome;
    if (nome === 'interrompido' && antes !== 'interrompido') {
      congeladoAte = agora() + 120; flashBranco = 1; glitch = 2; env = 0;
      bandas.fill(0);
    }
  }
  function modelo(nome) { modeloNome = nome === 'sonnet' ? 'sonnet' : 'haiku'; }
  function nivel(b, db) {
    if (!b) { micVivo = false; nivelGeral = 0; nivelDb = -90; return; }
    micVivo = true;
    let s = 0;
    for (let i = 0; i < 64; i++) { const v = clamp01(b[i] || 0); bandasAlvo[i] = v; s += v; }
    nivelGeral = clamp01((s / 64) * 2.2);
    nivelDb = Number.isFinite(db) ? db : -90;
  }
  function palavra(forca = 0.8) { env = Math.max(env, clamp01(forca)); }
  function hexagono() {
    const now = agora();
    for (let i = 0; i < 2; i++) { const h = hexCentros[Math.floor(Math.random() * hexCentros.length)]; if (h) hexAcesos.push({ x: h.x, y: h.y, t0: now, forte: true }); }
  }
  function centro() { return { x: T.modo === 'aberto' ? hx : V.cx, y: T.modo === 'aberto' ? hy : V.cy, r: R }; }
  function redimensionar() { if (T.modo === 'fechado') return; medir(); if (T.modo === 'aberto') { V.cx = hx; V.cy = hy; } }
  function destruir() {
    destruido = true; desligar();
    window.removeEventListener('pointermove', aoMover);
    document.removeEventListener('visibilitychange', aoVisivel);
    if (T.resolver) { const r = T.resolver; T.resolver = null; r(); }
  }
  // fontes chegando depois: refaz a régua com a JetBrains Mono
  try { if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (!destruido) { chaveCache = ''; if (T.modo !== 'fechado') medir(); } }).catch(() => {}); } catch { /* nada */ }

  return { entrar, sair, estado, modelo, nivel, palavra, hexagono, centro, redimensionar, destruir, get modo() { return T.modo; }, get nivelDb() { return nivelDb; } };
}
