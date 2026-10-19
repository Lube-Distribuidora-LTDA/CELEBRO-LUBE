/* Cérebro da Lube — js/rosto.js  (agente ROSTO, parte D do docs/OUVIDO-E-ROSTO.md §6)
   O portão do Jarvis: na primeira conversa do dia o núcleo do HUD se abre numa lente redonda com a câmera, confere o
   rosto do Júlio com prova de vida (piscar) e só então o Jarvis é liberado. Quem decide é o servidor (servidor/rosto.js):
   esta página manda só o descritor (128 números), nunca a imagem. Reserva: o Windows Hello (WebAuthn).

   Uso (js/jarvis.js, só no app local):
     const portao = criarPortao({ raiz, token, sons, falar, reduzido, hud, onEstado });
     const st = await portao.consultar();                 // EstadoRosto do servidor, ou null (servidor fora)
     if (st && !st.liberado) { const r = await portao.abrir(); if (!r.liberado) fechar(); }
     portao.recadastrar(); portao.apagarCadastro(); portao.cadastrarHello(); portao.travar(); portao.fechar(); portao.destruir()
   ?rosto=simular (só local): câmera desenhada num canvas, pontos e descritores de mentira (e o Windows Hello de mentira).
   Com ?debug: window.__rosto = { quadro(simulado), descritor(semente), estado(), … } para testar sem câmera.
   Privacidade: nenhum quadro é guardado nem sai do computador (o quadro do descritor é desenhado num canvas fora da tela,
   usado e apagado); a câmera desliga ao terminar, ao cancelar (Esc) e quando a janela sai da frente.
   Cores: só tokens do CSS (lidos uma vez com getComputedStyle, como o jarvis-hud.js); nada de cor literal fora da reserva.
   Movimento reduzido: sem giro, varredura, voo, malha acendendo nem glitch; as trocas viram fade de 200 ms. */

const TAU = Math.PI * 2, DEG = Math.PI / 180;
// reserva = tokens do CONTRATO.md §3 (o valor de verdade vem do CSS)
const RESERVA = {
  '--holo': '#45d4ff', '--ink': '#e8eeff', '--azul': '#2a41c8', '--vermelho': '#e5202c', '--alerta': '#ff6b74',
  '--muted': '#8a97c4', '--bg': '#050b1c', '--branco': '#ffffff', '--ok': '#34e89e', '--rever': '#ffb340',
  '--surface': '#0d1830', '--surface-2': '#132242', '--line': '#1f3463', '--line-forte': '#2c4a8a'
};

/* ---------- bibliotecas (versões fixas: OUVIDO-E-ROSTO.md §1.5; copiadas aqui, não importadas do maos.js) ---------- */
const URL_MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const URL_BUNDLE = `${URL_MP}/vision_bundle.mjs`;
const URL_WASM = `${URL_MP}/wasm`;
const URL_MODELO_ROSTO = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const URL_FACEAPI = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15';
const URL_FACEAPI_JS = `${URL_FACEAPI}/dist/face-api.esm.js`;
const URL_FACEAPI_MODELOS = `${URL_FACEAPI}/model/`;
const MODELOS_FACEAPI = ['ssd_mobilenetv1_model', 'face_landmark_68_model', 'face_recognition_model'];
const URL_WEBAUTHN = 'https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@14.0.0/+esm';
// tamanhos para a barra (o jsdelivr não manda content-length): bytes já descomprimidos
const TAMANHO = { wasm: 9.4e6, modelo: 3758596, ssd_mobilenetv1_model: 5.6e6, face_landmark_68_model: 0.36e6, face_recognition_model: 6443008, libs: 1.4e6 };

/* ---------- regras (§6.3–§6.5) ---------- */
const Q = { largMin: 0.28, angMax: 20, angMaxCadastro: 25, luzMin: 50, luzMax: 210, paradoMax: 0.03, paradoMs: 200 };
const PISCAR = { minAbs: 0.45, sobe: 0.30, desce: 0.15, durMin: 50, durMax: 600, baseIni: 10, baseN: 30, janelaMs: 8000 };
const CAPTURA = { quadros: 3, intervalo: 150, tentativas: 8, depoisPiscar: 300 };
const CADASTRO = { amostras: 8, intervalo: 600 };
// laços de pontos da malha do MediaPipe (índices do FaceLandmarker): olhos, boca, sobrancelhas, nariz e contorno
const LACO = {
  olhoD: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  olhoE: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
  boca: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  bocaDentro: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191],
  oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  sobD: [70, 63, 105, 66, 107],
  sobE: [300, 293, 334, 296, 336],
  nariz: [168, 6, 197, 195, 5, 4, 1]
};
// pontos do EAR (reserva do piscar sem blendshapes): [canto, cima, cima, canto, baixo, baixo]
const EAR_D = [33, 160, 158, 133, 153, 144], EAR_E = [362, 385, 387, 263, 373, 380];

/* ---------- textos (§8 e §9) ---------- */
const TXT = {
  'sem-camera': 'Não encontrei câmera neste computador.',
  negado: 'Você não liberou a câmera. Clique no cadeado da barra de endereço e permita a câmera.',
  'em-uso': 'A câmera está aberta em outro programa. Feche o outro programa e tente de novo.',
  'sem-suporte': 'Este navegador não abre a câmera aqui. Abra o Jarvis pelo atalho do app.',
  'sem-hello': 'O Windows Hello não está ligado neste computador. Crie um PIN em Configurações › Contas › Opções de entrada.',
  'sem-modelo': 'Não consegui carregar o reconhecimento do rosto. Confira a internet e tente de novo.',
  servidor: 'O app parou de responder. Recarregue a página (F5).',
  'hello-falhou': 'O Windows Hello não confirmou. Tente de novo.',
  'sem-pasta': 'Não consegui gravar o cadastro neste computador. Feche o app e abra de novo.',
  'sem-piscar': 'Não vi as piscadas. Tente de novo, de frente e com boa luz.',
  'sem-descritor': 'Não consegui ler o seu rosto. Tente de novo, de frente e com boa luz.',
  oculto: 'A câmera desligou porque a janela saiu da frente.',
  'camera-caiu': 'A câmera parou no meio. Confira o cabo e tente de novo.',
  quadros: 'Os quadros da câmera vieram estranhos. Tente de novo.',
  'prova-de-vida': 'Não consegui confirmar as piscadas. Tente de novo, piscando devagar.',
  'sem-cadastro': 'O cadastro do rosto sumiu deste computador. Feche e abra o Jarvis para cadastrar de novo.',
  trava: 'O Jarvis está travado. Faça o reconhecimento do rosto.'
};
const HTML_PRIVACIDADE = `<p>Vou guardar só números que descrevem o seu rosto, neste computador (<code>%LOCALAPPDATA%\\CerebroLube\\rosto</code>). Nenhuma foto é salva e nada sai daqui. A câmera desliga ao terminar.</p>
  <p>Isto é uma trava do Jarvis neste computador. Não substitui o login do Windows: quem entra na sua conta do Windows consegue apagar a trava, e um vídeo seu poderia enganar a prova de vida (o piscar).</p>`;
const NUMERO = { 2: 'duas', 3: 'três' };

/* ---------- utilidades ---------- */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const faixa = (t, a, b) => clamp01((t - a) / (b - a));
const eoc = (u) => 1 - (1 - u) ** 3;                    // easeOutCubic
const eic = (u) => u * u * u;                          // easeInCubic
const eio = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);   // easeInOutCubic
const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const amortecer = (a, b, taxa, dt) => a + (b - a) * (1 - Math.exp(-taxa * dt));
function ehLocal() {
  try { return /^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname); } catch { return false; }
}
function querySim() { try { return (ehLocal() || location.protocol === 'file:') && /[?&]rosto=simular\b/.test(location.search); } catch { return false; } }
function queryDebug() { try { return ehLocal() && /[?&]debug\b/.test(location.search); } catch { return false; } }
// teste local: window.__jvLento = 10 deixa as animações 10× mais lentas (o mesmo gancho do jarvis-hud.js)
const lento = () => { try { return (ehLocal() || location.protocol === 'file:') && typeof window.__jvLento === 'number' && window.__jvLento > 0 ? window.__jvLento : 1; } catch { return 1; } };
function erro(codigo, causa) { const e = new Error(codigo); e.codigo = codigo; if (causa) e.causa = causa; return e; }
const ehCancelado = (e) => !!e && e.codigo === 'cancelado';
const mediana = (v) => { const s = [...v].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
export function distancia(a, b) { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); }

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
const RGBA = new Map();
function rgba(c, a) {
  const al = a < 0 ? 0 : a > 1 ? 1000 : Math.round(a * 1000);
  const k = (((c[0] | 0) << 16) | ((c[1] | 0) << 8) | (c[2] | 0)) * 1001 + al;
  let v = RGBA.get(k);
  if (v === undefined) {
    if (RGBA.size > 4000) RGBA.clear();
    v = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al / 1000})`;
    RGBA.set(k, v);
  }
  return v;
}
function lerCores() {
  let cs = null;
  try { cs = getComputedStyle(document.documentElement); } catch { cs = null; }
  const tk = (n) => rgbDe(cs ? cs.getPropertyValue(n) : '', RESERVA[n]);
  return {
    holo: tk('--holo'), ink: tk('--ink'), azul: tk('--azul'), vermelho: tk('--vermelho'), alerta: tk('--alerta'),
    muted: tk('--muted'), bg: tk('--bg'), branco: tk('--branco'), ok: tk('--ok'), rever: tk('--rever'),
    surface: tk('--surface'), surface2: tk('--surface-2'), line: tk('--line'), lineForte: tk('--line-forte')
  };
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* =============================================================================
   Peças puras (exportadas para o teste no Node: nada de window/document aqui)
   ============================================================================= */

/* Direção da cabeça pela matriz 4×4 do FaceLandmarker, que vem POR COLUNA (§6.3): graus. */
export function angulosDaMatriz(m) {
  const y = Math.asin(limitar(-m[2], -1, 1)), p = Math.atan2(m[6], m[10]), r = Math.atan2(m[1], m[0]);
  return { yaw: y / DEG, pitch: p / DEG, roll: r / DEG };
}

/* Qualidade do quadro (§6.3): a 1ª regra que falha vira a dica da tela.
   v = { rostos, largura (fração da largura do vídeo), yaw, pitch, luz (cinza 0–255), movimento (fração da largura) } */
export function avaliarQuadro(v, { angMax = Q.angMax } = {}) {
  if (!v || !v.rostos) return { ok: false, regra: 'rosto', dica: 'Procurando seu rosto' };
  if (v.rostos > 1) return { ok: false, regra: 'pessoas', dica: 'Só uma pessoa na frente da câmera' };
  if (!(v.largura >= Q.largMin)) return { ok: false, regra: 'perto', dica: 'Chegue um pouco mais perto' };
  if (Math.abs(v.yaw || 0) > angMax || Math.abs(v.pitch || 0) > angMax) return { ok: false, regra: 'frente', dica: 'Olhe para a câmera' };
  if (Number.isFinite(v.luz) && v.luz < Q.luzMin) return { ok: false, regra: 'escuro', dica: 'Pouca luz aqui' };
  if (Number.isFinite(v.luz) && v.luz > Q.luzMax) return { ok: false, regra: 'claro', dica: 'Luz forte demais atrás de você' };
  if (Number.isFinite(v.movimento) && v.movimento > Q.paradoMax) return { ok: false, regra: 'parado', dica: 'Fique paradinho um instante' };
  return { ok: true, regra: null, dica: null };
}

/* Alinhamento para a leitura do HUD (0–100): de frente e no tamanho certo. Só tela, não decide nada. */
export function alinhamento(v) {
  if (!v || v.rostos !== 1) return 0;
  const ang = clamp01(1 - Math.max(Math.abs(v.yaw || 0), Math.abs(v.pitch || 0)) / 45);
  const tam = clamp01((v.largura || 0) / Q.largMin);
  return Math.round(100 * ang * (0.35 + 0.65 * tam));
}

/* Piscar (§6.4): base relativa, histerese e duração. modo 'blend' (eyeBlink médio: sobe ao fechar) ou 'ear'
   (abertura do olho em pixels: desce ao fechar). quadro(v, t, temRosto) → null | {tipo:'fechou'|'piscou'|'longa', ini, fim} */
export function criarPiscar({ modo = 'blend' } = {}) {
  const abertos = [];
  let base = null, fechado = false, tFechou = 0;
  const P = PISCAR, ear = modo === 'ear';
  const limFecha = () => (ear ? 0.6 * base : Math.max(P.minAbs, base + P.sobe));
  const limAbre = () => (ear ? 0.8 * base : base + P.desce);
  const estaFechado = (v) => (ear ? v <= limFecha() : v >= limFecha());
  const estaAberto = (v) => (ear ? v >= limAbre() : v <= limAbre());
  return {
    modo,
    quadro(v, t, temRosto = true) {
      // rosto sumiu (ou duas pessoas): a piscada em curso não vale
      if (!temRosto || !Number.isFinite(v)) { fechado = false; return null; }
      if (base === null) {
        abertos.push(v);
        if (abertos.length >= P.baseIni) base = mediana(abertos);
        return null;
      }
      if (!fechado) {
        if (estaFechado(v)) { fechado = true; tFechou = t; return { tipo: 'fechou', ini: t }; }
        if (estaAberto(v)) { abertos.push(v); if (abertos.length > P.baseN) abertos.shift(); base = mediana(abertos); }
        return null;
      }
      if (estaAberto(v)) {
        fechado = false;
        const dur = t - tFechou;
        return { tipo: dur >= P.durMin && dur <= P.durMax ? 'piscou' : 'longa', ini: tFechou, fim: t };
      }
      return null;
    },
    aberto(v) { return base !== null && !fechado && Number.isFinite(v) && estaAberto(v); },
    get base() { return base; },
    get fechado() { return fechado; },
    zerar() { abertos.length = 0; base = null; fechado = false; }
  };
}

/* A caixa do rosto (coordenadas normalizadas 0..1 do quadro do vídeo). */
export function caixaDosPontos(p) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i]; if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/* EAR em PIXELS (em coordenada normalizada a conta sai torta): média dos dois olhos. */
export function earDosPontos(p, vw, vh) {
  const d = (a, b) => Math.hypot((p[a].x - p[b].x) * vw, (p[a].y - p[b].y) * vh);
  const um = (i) => (d(i[1], i[5]) + d(i[2], i[4])) / (2 * (d(i[0], i[3]) || 1));
  return (um(EAR_D) + um(EAR_E)) / 2;
}

/* Do quadro do vídeo (x, y normalizados) para a lente de diâmetro D: object-fit cover e espelhado (como num espelho). */
export function mapaLente(vw, vh, D) {
  const s = Math.max(D / vw, D / vh), w = vw * s, h = vh * s, ox = (D - w) / 2, oy = (D - h) / 2;
  return (xn, yn) => [D - (ox + xn * w), oy + yn * h];
}

/* ---------- simulador (descritores de mentira e o rosto desenhado) ---------- */
function aleatorio(semente) {
  let s = (Math.abs(Math.floor(semente)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function gauss(r) { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
function normalizar(v, norma) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; for (let i = 0; i < v.length; i++) v[i] *= norma / s; return v; }
/* A "pessoa" do simulador: 128 números com norma 1,45 (a do face-api: §1.3), sempre os mesmos para a mesma semente. */
export function vetorPessoa(semente = 1) {
  const r = aleatorio(semente * 7919 + 13), v = new Array(128);
  for (let i = 0; i < 128; i++) v[i] = gauss(r);
  return normalizar(v, 1.45);
}
/* Uma leitura de mentira do rosto da pessoa: o vetor dela + ruído de tamanho `ruido`, de volta à norma 1,45. */
export function descritorSimulado(semente = 1, ruido = 0.14, sorteio = Math.random) {
  const base = vetorPessoa(semente), n = new Array(128);
  for (let i = 0; i < 128; i++) n[i] = gauss(sorteio);
  normalizar(n, ruido);
  const v = base.map((x, i) => x + n[i]);
  normalizar(v, 1.45);
  return v.map((x) => Math.round(x * 1e6) / 1e6);
}
/* Matriz 4×4 por coluna a partir dos ângulos (a inversa de angulosDaMatriz): R = Rz(roll)·Ry(yaw)·Rx(pitch). */
export function matrizSimulada(yaw = 0, pitch = 0, roll = 0) {
  const y = yaw * DEG, p = pitch * DEG, r = roll * DEG;
  const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p), cr = Math.cos(r), sr = Math.sin(r);
  const R00 = cr * cy, R01 = cr * sy * sp - sr * cp, R02 = cr * sy * cp + sr * sp;
  const R10 = sr * cy, R11 = sr * sy * sp + cr * cp, R12 = sr * sy * cp - cr * sp;
  const R20 = -sy, R21 = cy * sp, R22 = cy * cp;
  return [R00, R10, R20, 0, R01, R11, R21, 0, R02, R12, R22, 0, 0, 0, -86, 1];
}
// disposição dos 478 pontos no rosto do simulador, em unidades do meio-rosto (u horizontal, v vertical; v > 0 = para baixo)
const LAYOUT_SIM = (() => {
  const L = new Array(478).fill(null);
  const laco = (idx, cx, cy, rx, ryBaixo, ryCima, olho) => {
    const n = idx.length, meio = n / 2;
    idx.forEach((k, j) => {
      // do canto de fora (j = 0) por baixo até o outro canto (j = meio) e de volta por cima
      const baixo = j <= meio, f = baixo ? j / meio : (j - meio) / meio;
      const a = baixo ? Math.PI - f * Math.PI : -f * Math.PI;
      const dir = cx < 0 ? 1 : -1;   // o olho/canto da esquerda da imagem começa pela esquerda
      const ang = dir > 0 ? a : Math.PI - a;
      L[k] = { u: cx + Math.cos(ang) * rx, v: cy + Math.sin(ang) * (Math.sin(ang) > 0 ? ryBaixo : ryCima), olho, lado: Math.sin(ang) > 0 ? 1 : -1 };
    });
  };
  laco(LACO.olhoD, -0.40, -0.12, 0.17, 0.085, 0.085, 'D');
  laco(LACO.olhoE, 0.40, -0.12, 0.17, 0.085, 0.085, 'E');
  laco(LACO.boca, -1e-6, 0.42, 0.30, 0.10, 0.05, null);
  laco(LACO.bocaDentro, -1e-6, 0.42, 0.22, 0.04, 0.02, null);
  LACO.oval.forEach((k, j) => { const a = -Math.PI / 2 + (j / LACO.oval.length) * TAU; L[k] = { u: Math.cos(a), v: Math.sin(a), borda: true }; });
  LACO.sobD.forEach((k, j) => { const t = -1 + (2 * j) / (LACO.sobD.length - 1); L[k] = { u: -0.40 + t * 0.22, v: -0.30 - 0.05 * (1 - t * t) }; });
  LACO.sobE.forEach((k, j) => { const t = -1 + (2 * j) / (LACO.sobE.length - 1); L[k] = { u: 0.40 - t * 0.22, v: -0.30 - 0.05 * (1 - t * t) }; });
  LACO.nariz.forEach((k, j) => { L[k] = { u: 0, v: -0.08 + (j / (LACO.nariz.length - 1)) * 0.30 }; });
  // o resto: girassol dentro do rosto (dá a cara de malha)
  const resto = []; for (let i = 0; i < 478; i++) if (!L[i]) resto.push(i);
  resto.forEach((k, j) => { const r = 0.9 * Math.sqrt((j + 0.5) / resto.length), a = j * 2.399963; L[k] = { u: Math.cos(a) * r * 0.96, v: Math.sin(a) * r }; });
  return L;
})();
/* A geometria de uma pessoa do simulador no quadro 640×480 (px). */
function geoSim(s, i = 0) {
  const W = 640, H = 480, k = i ? 0.7 : 1;
  const fw = W * (s.largura || 0.42) * k;
  return { cx: W * (0.5 + (s.x || 0) + (i ? 0.33 : 0)), cy: H * (0.47 + (s.y || 0)), fw, fh: fw * 1.3, yaw: (s.yaw || 0) * DEG, pitch: (s.pitch || 0) * DEG, roll: (s.roll || 0) * DEG, piscar: clamp01(s.piscar || 0) };
}
function pontoSim(g, u, v, olho, lado) {
  if (olho) v = -0.12 + (v + 0.12) * (lado < 0 ? 1 - g.piscar : 1 - 0.8 * g.piscar);   // as pálpebras se fecham
  const prof = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  const x0 = u * (g.fw / 2) * Math.cos(g.yaw) + Math.sin(g.yaw) * prof * (g.fw / 2) * 0.6;
  const y0 = v * (g.fh / 2) * Math.cos(g.pitch) + Math.sin(g.pitch) * prof * (g.fh / 2) * 0.5;
  const cr = Math.cos(g.roll), sr = Math.sin(g.roll);
  return [g.cx + x0 * cr - y0 * sr, g.cy + x0 * sr + y0 * cr];
}
/* Os 478 pontos normalizados de uma pessoa do simulador (o mesmo formato do FaceLandmarker: {x, y, z}). */
export function pontosSimulados(s, i = 0, saida = null) {
  const g = geoSim(s, i), out = saida || Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }));
  for (let k = 0; k < 478; k++) { const l = LAYOUT_SIM[k], [x, y] = pontoSim(g, l.u, l.v, l.olho, l.lado); out[k].x = x / 640; out[k].y = y / 480; out[k].z = 0; }
  return out;
}

/* =============================================================================
   CSS (o portão põe o próprio: o index.html e o artifact não mudam)
   ============================================================================= */
let promessaCss = null;
function garantirCss() {
  if (promessaCss) return promessaCss;
  let href = 'css/rosto.css';
  try { href = new URL('../css/rosto.css', import.meta.url).href; } catch { /* relativo à página */ }
  if (document.querySelector('link[data-rosto-css]')) return (promessaCss = Promise.resolve());
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = href; l.dataset.rostoCss = '1';
  promessaCss = new Promise((ok) => { const tm = setTimeout(ok, 2500); l.onload = l.onerror = () => { clearTimeout(tm); ok(); }; });
  document.head.appendChild(l);
  return promessaCss;
}

/* =============================================================================
   Carga das bibliotecas (preguiçosa, em paralelo, com a porcentagem)
   ============================================================================= */
// o MediaPipe escreve no console a cada partida (W…/I… e "Created TensorFlow Lite XNNPACK delegate"): só essas linhas
// são caladas; erro de verdade passa
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
async function baixarComProgresso(url, aoAvancar, sinal, guardar = true) {
  const r = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache', signal: sinal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!r.body || typeof r.body.getReader !== 'function') { const b = new Uint8Array(await r.arrayBuffer()); aoAvancar(b.length); return guardar ? b : null; }
  const leitor = r.body.getReader(); const partes = []; let n = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    if (guardar) partes.push(value);
    n += value.length; aoAvancar(n);
  }
  if (!guardar) return null;
  const out = new Uint8Array(n); let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}
let promessaVision = null, promessaFaceApi = null;
const importarVision = () => (promessaVision ||= import(/* @vite-ignore */ URL_BUNDLE).catch((e) => { promessaVision = null; throw e; }));
const importarFaceApi = () => (promessaFaceApi ||= import(/* @vite-ignore */ URL_FACEAPI_JS).catch((e) => { promessaFaceApi = null; throw e; }));

/* MediaPipe FaceLandmarker (CPU: o GPU criou mas não achou rosto neste Edge, §1.3) + face-api só para o descritor.
   onProgresso(0..1). Devolve { detectar(video, ts), descritor(canvas), fechar() }. */
async function carregarReal(onProgresso, sinal) {
  silenciarMediaPipe();
  const bytes = { wasm: 0, modelo: 0, libs: 0 };
  for (const m of MODELOS_FACEAPI) bytes[m] = 0;
  const total = Object.keys(bytes).reduce((s, k) => s + TAMANHO[k], 0);
  let ultimo = -1;
  const avisar = () => {
    let s = 0; for (const k of Object.keys(bytes)) s += Math.min(bytes[k], TAMANHO[k]);
    const v = Math.min(0.99, Math.floor((s / total) * 100) / 100);
    if (v > ultimo) { ultimo = v; try { onProgresso(v); } catch { /* nada */ } }
  };
  const cancelado = () => sinal && sinal.aborted;
  avisar();
  let lm = null, fa = null;
  try {
    const [mp, faceapi] = await Promise.all([
      (async () => {
        const m = await importarVision(); bytes.libs += TAMANHO.libs * 0.1; avisar();
        const fs = await m.FilesetResolver.forVisionTasks(URL_WASM);
        // baixa o WASM só para a barra; a biblioteca pega o mesmo arquivo do cache logo depois
        try { await baixarComProgresso(fs.wasmBinaryPath, (n) => { bytes.wasm = n; avisar(); }, sinal, false); } catch (e) { if (cancelado()) throw e; }
        bytes.wasm = TAMANHO.wasm;
        const modelo = await baixarComProgresso(URL_MODELO_ROSTO, (n) => { bytes.modelo = n; avisar(); }, sinal);
        if (cancelado()) throw erro('cancelado');
        const l = await m.FaceLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetBuffer: modelo, delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 2,
          outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
          minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5
        });
        lm = l;
        return m;
      })(),
      (async () => {
        const f = await importarFaceApi(); bytes.libs += TAMANHO.libs * 0.9; avisar();
        let ok = false;
        try { ok = await f.tf.setBackend('webgl'); } catch { ok = false; }
        if (!ok) await f.tf.setBackend('cpu');
        await f.tf.ready();
        // os pesos com a barra (fetch com cache); o loadFromUri logo depois lê do cache do navegador (1 ano, imutável)
        await Promise.all(MODELOS_FACEAPI.map(async (nome) => {
          try {
            const r = await fetch(`${URL_FACEAPI_MODELOS}${nome}-weights_manifest.json`, { mode: 'cors', credentials: 'omit', cache: 'force-cache', signal: sinal });
            const man = await r.json();
            const caminhos = (Array.isArray(man) ? man : []).flatMap((g) => g.paths || []);
            let feito = 0;
            for (const c of caminhos) { await baixarComProgresso(URL_FACEAPI_MODELOS + c, (n) => { bytes[nome] = feito + n; avisar(); }, sinal, false); feito = bytes[nome]; }
          } catch (e) { if (cancelado()) throw e; }
          bytes[nome] = TAMANHO[nome]; avisar();
        }));
        await f.nets.ssdMobilenetv1.loadFromUri(URL_FACEAPI_MODELOS);
        await f.nets.faceLandmark68Net.loadFromUri(URL_FACEAPI_MODELOS);
        await f.nets.faceRecognitionNet.loadFromUri(URL_FACEAPI_MODELOS);
        fa = f;
        // aquecimento: compila os sombreadores do detector num quadro vazio (o 1º descritor de verdade sai mais rápido)
        try { const c = document.createElement('canvas'); c.width = 160; c.height = 120; await f.detectSingleFace(c, new f.SsdMobilenetv1Options({ minConfidence: 0.6 })); c.width = 0; } catch { /* sem aquecimento */ }
        return f;
      })()
    ]);
    if (cancelado()) throw erro('cancelado');
    try { onProgresso(1); } catch { /* nada */ }
    const opcoes = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 });
    return {
      real: true,
      detectar: (video, ts) => lm.detectForVideo(video, ts),
      async descritor(canvas) {
        const r = await faceapi.detectSingleFace(canvas, opcoes).withFaceLandmarks().withFaceDescriptor();
        return r && r.descriptor ? r.descriptor : null;
      },
      fechar() {
        try { lm && lm.close(); } catch { /* já fechado */ }
        for (const n of ['ssdMobilenetv1', 'faceLandmark68Net', 'faceRecognitionNet']) { try { faceapi.nets[n].dispose(); } catch { /* já liberado */ } }
        lm = null;
      },
      _mp: mp
    };
  } catch (e) {
    try { lm && lm.close(); } catch { /* nada */ }
    if (fa) for (const n of ['ssdMobilenetv1', 'faceLandmark68Net', 'faceRecognitionNet']) { try { fa.nets[n].dispose(); } catch { /* nada */ } }
    if (cancelado() || ehCancelado(e)) throw erro('cancelado', e);
    throw erro('sem-modelo', e);
  }
}

/* =============================================================================
   criarPortao
   ============================================================================= */
let contador = 0;
export function criarPortao(opts = {}) {
  const raiz = opts.raiz;
  if (!raiz) throw new Error('Portão sem raiz.');
  const token = opts.token || null;
  const base = opts.base || '';
  const sons = opts.sons && typeof opts.sons.tocar === 'function' ? opts.sons : { tocar() {} };
  const falar = typeof opts.falar === 'function' ? opts.falar : null;
  const reduzido = typeof opts.reduzido === 'function' ? opts.reduzido : () => !!opts.reduzido;
  const hud = opts.hud || null;
  const onEstado = typeof opts.onEstado === 'function' ? opts.onEstado : () => {};
  const nome = opts.nome || 'Júlio';
  const simulado = opts.simular != null ? !!opts.simular && (ehLocal() || location.protocol === 'file:') : querySim();
  const debug = queryDebug();
  const ID = `rs${++contador}`;
  let C = lerCores();

  /* ---------- estado ---------- */
  const S = {
    aberto: false, promessa: null, sessao: null, estado: null, el: null, foco: null,
    cam: { stream: null, ligada: false, rvfc: 0, raf: 0, tela: null, luzCv: null, ultimoTs: 0, nQuadro: 0, ultimoQuadro: 0, vigia: 0 },
    libs: null, carregando: null,
    vista: { rostos: 0, pontos: null, box: null, largura: 0, yaw: 0, pitch: 0, roll: 0, b: NaN, luz: NaN, movimento: NaN, vw: 640, vh: 480, qual: avaliarQuadro(null), qualCad: avaliarQuadro(null), aberto: false, evento: null },
    hist: [], piscar: null, des: null, janela: null, aoQuadro: null, falhaQuadro: null,
    fps: { n: 0, t0: 0, v: 0 }, dicaRegra: null, dicaDesde: 0, leituraEm: 0, idEm: 0, ultimo: null, ultimaDist: null
  };
  // animação
  const A = {
    k: 0, kDe: 0, kPara: 0, kT0: 0, kMs: 400, kCurva: eoc, ka: 0, kaDe: 0, kaPara: 0, kaT0: 0,
    aroT0: -1, giro: 0, giro2: 0, varre: 0, malhaT0: -1, olhosAte: 0,
    prog: 0, progAlvo: 0, progVis: false, segs: 0, segsTotal: 0,
    checkT0: -1, flashT0: -1, pulsoT0: -1, glitch: 0, encolherT0: -1, tom: 'holo', progRot: 'COMPARANDO',
    mira: null, hex: [], proxHex: 0, ultimo: 0, chaveK: '', chaveKa: ''
  };
  let el = null, g = null, W = 1, H = 1, dpr = 1, cx = 0, cy = 0, Rc = 150, Rhud = 200, hx = 0, hy = 0, raf = 0, rafParado = false;

  /* ---------- servidor ---------- */
  async function chamar(caminho, { metodo = 'GET', corpo, prazo = 15000 } = {}) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const tm = ctrl ? setTimeout(() => ctrl.abort(), prazo) : 0;
    try {
      const h = { accept: 'application/json' };
      if (token) h['x-cerebro-token'] = token;
      if (corpo !== undefined) h['content-type'] = 'application/json';
      const r = await fetch(base + caminho, { method: metodo, headers: h, body: corpo !== undefined ? JSON.stringify(corpo) : undefined, cache: 'no-store', credentials: 'same-origin', signal: ctrl ? ctrl.signal : undefined });
      let dados = null;
      try { dados = await r.json(); } catch { dados = null; }
      return { status: r.status, dados: dados && typeof dados === 'object' ? dados : {} };
    } catch { return { status: 0, dados: {} }; }
    finally { clearTimeout(tm); }
  }
  async function consultar() {
    const r = await chamar('/api/rosto/estado', { prazo: 6000 });
    if (r.status !== 200 || typeof r.dados.liberado !== 'boolean') return null;
    S.ultimo = r.dados;
    return r.dados;
  }

  /* ---------- sessão e cancelamento ---------- */
  function checar() { if (!S.sessao || S.sessao.signal.aborted) throw erro('cancelado'); }
  function dormir(ms) {
    return new Promise((ok, falha) => {
      const sinal = S.sessao && S.sessao.signal;
      if (!sinal || sinal.aborted) { falha(erro('cancelado')); return; }
      const tm = setTimeout(() => { sinal.removeEventListener('abort', ab); ok(); }, ms);
      const ab = () => { clearTimeout(tm); falha(erro('cancelado')); };
      sinal.addEventListener('abort', ab, { once: true });
    });
  }
  const dormirVisual = (ms) => dormir(reduzido() ? Math.min(ms, 260) : ms * lento());

  /* ---------- DOM ---------- */
  const CANTOS = '<span class="canto ce" aria-hidden="true"></span><span class="canto cd" aria-hidden="true"></span><span class="canto be" aria-hidden="true"></span><span class="canto bd" aria-hidden="true"></span>';
  const ICO_CHAVE = '<svg class="rs-chave" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="15" cy="24" r="8"/><circle cx="15" cy="24" r="2.6"/><path d="M23 24h19M35 24v6.5M41 24v4.5"/></svg>';
  function montar() {
    if (el) return;
    const p = document.createElement('div');
    p.className = 'rs-portao';
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true');
    p.setAttribute('aria-labelledby', `${ID}Tit`); p.setAttribute('aria-describedby', `${ID}Dica`);
    p.tabIndex = -1;
    p.innerHTML = `
      <canvas class="rs-fx" aria-hidden="true"></canvas>
      <div class="rs-lente" aria-hidden="true">
        <video class="rs-video" muted playsinline aria-hidden="true"></video>
        <canvas class="rs-parado"></canvas>
        <div class="rs-holo"></div>
        <div class="rs-carga"><b class="rs-carga-pct">0%</b><span>CARREGANDO</span></div>
        ${ICO_CHAVE}
      </div>
      <div class="rs-mira" aria-hidden="true">${CANTOS}</div>
      <div class="rs-leituras" aria-hidden="true">
        <p class="rs-l rs-l-e"><span><i>ROSTO</i> <b data-r="rostos">—</b></span><span><i>ALINHAMENTO</i> <b data-r="alinha">—</b></span></p>
        <p class="rs-l rs-l-d"><span><i data-r="rot2">PISCADAS</i> <b data-r="piscadas">—</b></span><span><i>CÂMERA</i> <b data-r="fps">—</b></span></p>
      </div>
      <div class="rs-painel">
        <p class="hud-rot rs-rot" id="${ID}Tit">Trava do Jarvis · reconhecimento facial</p>
        <p class="rs-status"><b class="rs-status-txt">ABRINDO A LENTE</b></p>
        <p class="rs-dica" id="${ID}Dica" aria-live="polite"></p>
        <div class="rs-bolinhas" aria-hidden="true"></div>
        <div class="rs-botoes"></div>
        <p class="rs-privacidade"><span class="rs-cam-ind"><i class="rs-pt" aria-hidden="true"></i>CÂMERA <b class="rs-cam-st">DESLIGADA</b></span><span class="rs-priv-txt">A câmera desliga ao terminar. Nenhuma foto é salva.</span></p>
      </div>
      <div class="rs-cartao" hidden>
        ${CANTOS}
        <p class="hud-rot rs-c-rot"></p>
        <h2 class="rs-c-tit" id="${ID}CTit"></h2>
        <div class="rs-c-txt"></div>
        <div class="rs-botoes rs-c-botoes"></div>
      </div>`;
    raiz.appendChild(p);
    const q = (s) => p.querySelector(s);
    el = {
      p, fx: q('.rs-fx'), lente: q('.rs-lente'), video: q('.rs-video'), parado: q('.rs-parado'), carga: q('.rs-carga-pct'),
      mira: [...p.querySelectorAll('.rs-mira .canto')], miraBox: q('.rs-mira'),
      status: q('.rs-status-txt'), dica: q('.rs-dica'), bolinhas: q('.rs-bolinhas'), botoes: q('.rs-painel .rs-botoes'),
      camSt: q('.rs-cam-st'), cartao: q('.rs-cartao'), cRot: q('.rs-c-rot'), cTit: q('.rs-c-tit'), cTxt: q('.rs-c-txt'), cBotoes: q('.rs-c-botoes'),
      r: Object.fromEntries([...p.querySelectorAll('[data-r]')].map((e) => [e.dataset.r, e]))
    };
    g = el.fx.getContext('2d');
    S.el = el;
  }
  function desmontar() {
    if (!el) return;
    try { el.video.srcObject = null; } catch { /* nada */ }
    el.p.remove();
    el = null; g = null; S.el = null;
  }

  function medir() {
    if (!el) return;
    const r = raiz.getBoundingClientRect();
    W = Math.max(1, r.width || innerWidth); H = Math.max(1, r.height || innerHeight);
    let c = null;
    try { c = hud && typeof hud.centro === 'function' ? hud.centro() : null; } catch { c = null; }
    Rhud = c && Number.isFinite(c.r) && c.r > 0 ? c.r : 0.3 * Math.min(W, H);
    hx = c && Number.isFinite(c.x) ? c.x : W / 2; hy = c && Number.isFinite(c.y) ? c.y : H * 0.44;
    cx = hx; cy = hy;
    // raio da lente (§6.7): min(0,62 R, 180 px); em tela estreita, min(36vw, 150 px)
    Rc = W <= 480 ? Math.min(0.36 * W, 150) : Math.min(0.62 * Rhud, 180);
    Rc = Math.max(84, Rc);
    // embaixo da lente cabem o status, a dica, as bolinhas, os botões e a frase da câmera (~200 px)
    const reserva = W <= 560 ? 214 : 196, topoMin = W <= 760 ? 80 : 74;
    const cyMax = H - reserva - 30 - Rc;
    if (cy > cyMax) cy = Math.max(topoMin + Rc, cyMax);
    if (cy + Rc + 30 + reserva > H) { Rc = Math.max(64, (H - reserva - 30 - topoMin) / 2); cy = topoMin + Rc; }
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    el.fx.width = Math.round(W * dpr); el.fx.height = Math.round(H * dpr);
    el.p.style.setProperty('--rs-cx', `${cx.toFixed(1)}px`);
    el.p.style.setProperty('--rs-cy', `${cy.toFixed(1)}px`);
    el.p.style.setProperty('--rs-lx', `${cx.toFixed(1)}px`);
    el.p.style.setProperty('--rs-ly', `${cy.toFixed(1)}px`);
    el.p.style.setProperty('--rs-rc', `${Rc.toFixed(1)}px`);
    el.p.classList.toggle('rs-estreito', W < 760);
  }
  function aoRedimensionar() { if (S.aberto) medir(); }

  /* ---------- estados e textos da tela ---------- */
  function definirEstado(nomeEstado) {
    if (S.estado === nomeEstado) return;
    S.estado = nomeEstado;
    if (el) el.p.dataset.rosto = nomeEstado || '';
    try { onEstado(nomeEstado, { camera: S.cam.ligada }); } catch { /* nada */ }
  }
  function status(txt) { if (el && el.status.textContent !== txt) el.status.textContent = txt; }
  function dica(txt) { if (el && el.dica.textContent !== (txt || '')) el.dica.textContent = txt || ''; }
  function tom(t) { A.tom = t; if (el) el.p.dataset.tom = t; }
  function leitura(k, v) { const e = el && el.r[k]; if (e && e.textContent !== v) e.textContent = v; }
  function bolinhas(n, cheias) {
    if (!el) return;
    const b = el.bolinhas;
    if (b.children.length !== n) b.innerHTML = '<i></i>'.repeat(n);
    [...b.children].forEach((e, i) => e.classList.toggle('cheia', i < cheias));
  }
  function camIndicador(on) {
    if (!el) return;
    el.p.classList.toggle('rs-com-cam', on);
    el.camSt.textContent = on ? 'LIGADA' : 'DESLIGADA';
    try { onEstado(S.estado, { camera: on }); } catch { /* nada */ }
  }
  function carga(p) {
    if (!el) return;
    const pct = `${Math.round(clamp01(p) * 100)}%`;
    el.carga.textContent = pct;
    if (S.estado === 'carregando') status(`CARREGANDO ${pct}`);
  }
  // botões (no painel ou no cartão): devolve o id do escolhido; Esc / fechar cancelam
  function escolher(lista, alvo = el && el.botoes) {
    const bts = lista.filter(Boolean);
    alvo.innerHTML = '';
    for (const b of bts) {
      const e = document.createElement('button');
      e.type = 'button'; e.className = `btn${b.principal ? ' principal' : ''}`; e.dataset.id = b.id; e.textContent = b.txt;
      alvo.appendChild(e);
    }
    const principal = alvo.querySelector('.principal') || alvo.querySelector('button');
    try { principal && principal.focus({ preventScroll: true }); } catch { /* nada */ }
    return new Promise((ok, falha) => {
      const sinal = S.sessao && S.sessao.signal;
      const limpar = () => { alvo.removeEventListener('click', clique); if (sinal) sinal.removeEventListener('abort', ab); alvo.innerHTML = ''; };
      const ab = () => { limpar(); falha(erro('cancelado')); };
      const clique = (ev) => { const b = ev.target.closest('button[data-id]'); if (!b || !alvo.contains(b)) return; limpar(); ok(b.dataset.id); };
      if (!sinal || sinal.aborted) { ab(); return; }
      alvo.addEventListener('click', clique);
      sinal.addEventListener('abort', ab, { once: true });
    });
  }
  function limparBotoes() { if (el) el.botoes.innerHTML = ''; }
  // cartão (explicação do cadastro, apagar, Windows Hello): os textos são fixos deste arquivo (nada de dado de fora)
  async function cartao({ estado: est, rot = '', tit = '', html = '', botoes = [], tom: t = '' }) {
    if (est) definirEstado(est);
    el.cRot.textContent = rot; el.cTit.textContent = tit; el.cTxt.innerHTML = html;
    el.cartao.dataset.tom = t; el.cartao.hidden = false;
    el.p.classList.add('rs-com-cartao');
    el.p.setAttribute('aria-labelledby', `${ID}CTit`);
    try { return await escolher(botoes, el.cBotoes); }
    finally {
      if (el) { el.cartao.hidden = true; el.p.classList.remove('rs-com-cartao'); el.p.setAttribute('aria-labelledby', `${ID}Tit`); }
    }
  }
  // a dica muda só quando a mesma regra se mantém por 250 ms (sem piscar de texto a cada quadro)
  function dicaDaRegra(q, fixa) {
    const regra = q.ok ? 'ok' : q.regra, t = agora();
    if (regra !== S.dicaRegra) { S.dicaRegra = regra; S.dicaDesde = t; }
    if (t - S.dicaDesde < 250 && el.dica.textContent) return;
    dica(q.ok ? fixa : q.dica);
  }
  function digitar(txt, ms = 25) {
    if (reduzido()) { status(txt); return Promise.resolve(); }
    return new Promise((ok) => {
      let i = 0;
      const passo = () => { if (!el) { ok(); return; } i++; status(txt.slice(0, i)); if (i >= txt.length) ok(); else setTimeout(passo, ms * lento()); };
      passo();
    });
  }
  function saudacao() {
    let h = 12;
    try { h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date())); } catch { h = new Date().getHours(); }
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }
  function dizer(frase) { if (falar) { try { falar(frase); } catch { /* sem voz */ } } }

  /* ---------- lente (abre, encolhe) ---------- */
  function abrirLente() {
    if (A.kPara === 1 && A.encolherT0 < 0) return;
    const t = agora();
    A.kDe = A.k || Math.min(1, (0.16 * Rhud) / Rc); A.kPara = 1; A.kT0 = t; A.kMs = 400; A.kCurva = eoc;
    A.kaDe = A.ka; A.kaPara = 1; A.kaT0 = t;
    A.aroT0 = t; A.encolherT0 = -1;
  }
  function encolherLente() {
    const t = agora();
    A.kDe = A.k; A.kPara = Math.min(1, (0.16 * Rhud) / Rc); A.kT0 = t; A.kMs = 400; A.kCurva = eic;
    A.kaDe = A.ka; A.kaPara = 0; A.kaT0 = t + (reduzido() ? 0 : 200 * lento());
    A.encolherT0 = t;
  }
  function atualizarLente(now, red) {
    const L = lento();
    if (red) {
      // movimento reduzido: a lente não cresce; só aparece e some (fade de 200 ms)
      A.k = 1;
      A.ka = lerp(A.kaDe, A.kaPara, faixa(now - A.kaT0, 0, 200));
    } else {
      A.k = lerp(A.kDe, A.kPara, A.kCurva(faixa((now - A.kT0) / L, 0, A.kMs)));
      A.ka = A.kaPara === 1 ? Math.max(A.ka, lerp(A.kaDe, 1, faixa((now - A.kT0) / L, 0, 120))) : lerp(A.kaDe, 0, faixa((now - A.kaT0) / L, 0, 200));
    }
    const kk = A.k.toFixed(3), ka = A.ka.toFixed(3);
    if (kk !== A.chaveK) { A.chaveK = kk; el.p.style.setProperty('--rs-k', kk); }
    if (ka !== A.chaveKa) { A.chaveKa = ka; el.p.style.setProperty('--rs-ka', ka); }
    // na saída a lente volta para o centro do HUD (pode ter subido para caber o painel embaixo)
    if (A.encolherT0 >= 0 && (cx !== hx || cy !== hy)) {
      const f = red ? 1 : eic(faixa((now - A.encolherT0) / L, 0, 400));
      el.p.style.setProperty('--rs-lx', `${lerp(cx, hx, f).toFixed(1)}px`);
      el.p.style.setProperty('--rs-ly', `${lerp(cy, hy, f).toFixed(1)}px`);
    }
  }
  function centroLente(now, red) {
    if (A.encolherT0 < 0) return [cx, cy];
    const f = red ? 1 : eic(faixa((now - A.encolherT0) / lento(), 0, 400));
    return [lerp(cx, hx, f), lerp(cy, hy, f)];
  }

  /* ---------- laço de desenho (rAF) ---------- */
  function ligarRaf() { if (!raf && el) { A.ultimo = agora(); raf = requestAnimationFrame(quadroFx); } }
  function desligarRaf() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function quadroFx() {
    raf = 0;
    if (!el) return;
    if (document.hidden) { rafParado = true; return; }   // volta no visibilitychange
    const now = agora(), dt = Math.min(0.05, Math.max(0, (now - A.ultimo) / 1000));
    A.ultimo = now;
    const red = reduzido();
    try {
      atualizarLente(now, red);
      desenhar(now, dt, red);
      atualizarMira(now, dt, red);
    } catch (e) { try { console.warn('[Rosto] falhou num quadro.', e && e.name); } catch { /* nada */ } }
    raf = requestAnimationFrame(quadroFx);
  }
  function corTom() { return A.tom === 'ok' ? C.ok : A.tom === 'vermelho' ? C.vermelho : A.tom === 'rever' ? C.rever : C.holo; }
  const comCamera = () => S.cam.ligada || (el && el.parado.classList.contains('rs-vis'));
  function desenhar(now, dt, red) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, el.fx.width, el.fx.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = lento(), cor = corTom(), est = S.estado;
    const [lx, ly] = centroLente(now, red);
    const rl = Rc * A.k, ka = A.ka;
    if (rl < 2 || ka < 0.005) return;
    if (!red) { A.giro += 30 * DEG * dt / L; A.giro2 -= 8 * DEG * dt / L; A.varre += 90 * DEG * dt / L; }
    // halo azul atrás da lente
    const gh = g.createRadialGradient(lx, ly, rl * 0.92, lx, ly, rl * 1.55);
    gh.addColorStop(0, rgba(C.azul, 0.26 * ka)); gh.addColorStop(1, rgba(C.azul, 0));
    g.fillStyle = gh; g.beginPath(); g.arc(lx, ly, rl * 1.55, 0, TAU); g.fill();
    // varredura (procurando): cone de 40° girando sobre o vídeo
    if (!red && (est === 'procurando' || est === 'camera') && S.cam.ligada && typeof g.createConicGradient === 'function') {
      const a0 = A.varre - Math.PI / 2;
      g.save(); g.beginPath(); g.arc(lx, ly, rl, 0, TAU); g.clip();
      const cg = g.createConicGradient(a0 - 40 * DEG, lx, ly);
      cg.addColorStop(0, rgba(C.holo, 0)); cg.addColorStop(39 / 360, rgba(C.holo, 0.18)); cg.addColorStop(40 / 360, rgba(C.holo, 0)); cg.addColorStop(1, rgba(C.holo, 0));
      g.fillStyle = cg; g.beginPath(); g.moveTo(lx, ly); g.arc(lx, ly, rl, a0 - 40 * DEG, a0); g.closePath(); g.fill();
      g.strokeStyle = rgba(C.holo, 0.5); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + Math.cos(a0) * rl, ly + Math.sin(a0) * rl); g.stroke();
      g.restore();
    }
    // a malha do rosto por cima do vídeo
    if (comCamera() && S.vista.pontos && A.k > 0.97 && A.encolherT0 < 0) desenharMalha(now, red, lx, ly, rl);
    // clarão do sucesso (80 ms)
    if (A.flashT0 >= 0) {
      const f = faixa((now - A.flashT0) / L, 0, 80);
      if (f < 1) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba(C.ink, 0.55 * (1 - f) * ka); g.beginPath(); g.arc(lx, ly, rl, 0, TAU); g.fill(); g.restore(); }
    }
    // 1 — o aro da lente (2 px), que se desenha 360° na abertura
    const aro = A.aroT0 < 0 ? 1 : red ? 1 : eoc(faixa((now - A.aroT0) / L, 0, 400));
    let aAro = 0.95;
    if (A.pulsoT0 >= 0) { const tp = (now - A.pulsoT0) / L; if (tp < 2000) aAro = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(TAU * tp / 1000)); }
    g.lineCap = 'butt';
    g.strokeStyle = rgba(cor, aAro * ka); g.lineWidth = 2;
    g.beginPath(); g.arc(lx, ly, rl, -Math.PI / 2, -Math.PI / 2 + TAU * aro); g.stroke();
    g.strokeStyle = rgba(cor, 0.22 * ka); g.lineWidth = 1;
    g.beginPath(); g.arc(lx, ly, rl - 6, 0, TAU); g.stroke();
    // 2 — tracejado girando (+30°/s)
    g.save();
    g.strokeStyle = rgba(cor, 0.5 * ka); g.lineWidth = 1.5; g.setLineDash([3, 7]); g.lineDashOffset = -A.giro * rl;
    g.beginPath(); g.arc(lx, ly, rl + 10, -Math.PI / 2, -Math.PI / 2 + TAU * aro); g.stroke();
    g.restore();
    // 3 — régua de marcas (−8°/s): 90 marcas, maiores a cada 30°
    g.strokeStyle = rgba(cor, 0.34 * ka); g.lineWidth = 1;
    g.beginPath();
    const rr = rl + 22;
    for (let i = 0; i < 90; i++) {
      if (i / 90 > aro) break;
      const a = A.giro2 + i * 4 * DEG, l = i % 15 === 0 ? 9 : i % 5 === 0 ? 5 : 2.5, ca = Math.cos(a), sa = Math.sin(a);
      g.moveTo(lx + ca * rr, ly + sa * rr); g.lineTo(lx + ca * (rr + l), ly + sa * (rr + l));
    }
    g.stroke();
    // 4 — cadastro: anel de 8 segmentos que enche
    if (A.segsTotal > 0 && (est === 'cadastro-coleta' || est === 'analisando')) {
      if (est === 'analisando') status(`${A.progRot} ${Math.round(clamp01(A.prog) * 100)}%`);
      const n = A.segsTotal, vao = 5 * DEG, arco = TAU / n - vao;
      g.lineWidth = 4;
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + i * (TAU / n) + vao / 2;
        g.strokeStyle = i < A.segs ? rgba(C.holo, 0.95 * ka) : rgba(C.holo, 0.14 * ka);
        g.beginPath(); g.arc(lx, ly, rl + 15, a0, a0 + arco); g.stroke();
      }
    }
    // 5 — analisando: arco de progresso em volta da lente
    A.prog = red ? A.progAlvo : amortecer(A.prog, A.progAlvo, 6, dt);
    if (A.progVis && A.segsTotal === 0) {
      const ap = -Math.PI / 2 + TAU * eio(clamp01(A.prog));
      g.strokeStyle = rgba(C.holo, 0.14 * ka); g.lineWidth = 4;
      g.beginPath(); g.arc(lx, ly, rl + 15, 0, TAU); g.stroke();
      g.strokeStyle = rgba(cor, 0.95 * ka);
      g.beginPath(); g.arc(lx, ly, rl + 15, -Math.PI / 2, ap); g.stroke();
      g.strokeStyle = rgba(C.ink, 0.9 * ka); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(lx + Math.cos(ap) * (rl + 8), ly + Math.sin(ap) * (rl + 8)); g.lineTo(lx + Math.cos(ap) * (rl + 22), ly + Math.sin(ap) * (rl + 22)); g.stroke();
      if (est === 'analisando') status(`${A.progRot} ${Math.round(clamp01(A.prog) * 100)}%`);
    }
    // hexágonos acesos em volta (analisando)
    if (!red && est === 'analisando' && now > A.proxHex) {
      A.proxHex = now + 160 * L;
      const a = Math.random() * TAU, d = rl + 34 + Math.random() * 40;
      A.hex.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, t0: now });
    }
    if (A.hex.length) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = A.hex.length - 1; i >= 0; i--) {
        const h = A.hex[i], e = (now - h.t0) / L;
        if (e > 900) { A.hex.splice(i, 1); continue; }
        const a = (e < 250 ? e / 250 : 1 - (e - 250) / 650) * 0.55 * ka;
        caminhoHex(g, lx + h.x, ly + h.y, 9);
        g.fillStyle = rgba(C.holo, a * 0.3); g.fill(); g.strokeStyle = rgba(C.holo, a); g.lineWidth = 1; g.stroke();
      }
      g.restore();
    }
    // pulso vermelho para fora (recusado): 2 ondas, 1 por segundo
    if (A.pulsoT0 >= 0 && !red) {
      const tp = (now - A.pulsoT0) / L;
      for (let k = 0; k < 2; k++) {
        const f = faixa(tp - k * 1000, 0, 1000);
        if (f <= 0 || f >= 1) continue;
        g.strokeStyle = rgba(C.vermelho, 0.6 * (1 - f) * ka); g.lineWidth = 2;
        g.beginPath(); g.arc(lx, ly, rl + 6 + 44 * eoc(f), 0, TAU); g.stroke();
      }
    }
    // ✓ desenhado (o traço corre em 250 ms)
    if (A.checkT0 >= 0) desenharCheck(now, red, lx, ly, rl, ka);
    // 2 quadros de glitch (fatias ±6 px) no último quadro parado
    if (A.glitch > 0 && !red) { fazerGlitch(lx, ly, rl); A.glitch--; }
    atualizarLeituras(now);
  }
  function caminhoHex(q, x, y, s) {
    q.beginPath();
    for (let k = 0; k < 6; k++) { const a = TAU * k / 6 + Math.PI / 6, px = x + Math.cos(a) * s, py = y + Math.sin(a) * s; if (k) q.lineTo(px, py); else q.moveTo(px, py); }
    q.closePath();
  }
  function desenharCheck(now, red, lx, ly, rl, ka) {
    const f = red ? 1 : eoc(faixa((now - A.checkT0) / lento(), 0, 250));
    const s = rl * 0.5, P = [[-0.42, 0.02], [-0.12, 0.32], [0.46, -0.3]].map(([x, y]) => [lx + x * s, ly + y * s]);
    const l1 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), l2 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]), ate = (l1 + l2) * f;
    g.save();
    g.fillStyle = rgba(C.bg, 0.45 * ka); g.beginPath(); g.arc(lx, ly, rl, 0, TAU); g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(4, rl * 0.06);
    g.shadowColor = rgba(C.ok, 0.9); g.shadowBlur = 16;
    g.strokeStyle = rgba(C.ok, ka);
    g.beginPath(); g.moveTo(P[0][0], P[0][1]);
    if (ate <= l1) g.lineTo(lerp(P[0][0], P[1][0], ate / l1), lerp(P[0][1], P[1][1], ate / l1));
    else { g.lineTo(P[1][0], P[1][1]); const u = (ate - l1) / l2; g.lineTo(lerp(P[1][0], P[2][0], u), lerp(P[1][1], P[2][1], u)); }
    g.stroke();
    g.restore();
  }
  function fazerGlitch(lx, ly, rl) {
    const c = el.parado;
    if (!c.width) return;
    const D = c.width, k = (2 * Rc) / D, x0 = lx - Rc, y0 = ly - Rc;
    g.save(); g.beginPath(); g.arc(lx, ly, rl, 0, TAU); g.clip();
    for (let i = 0; i < 6; i++) {
      const y = Math.floor(Math.random() * D), hh = Math.floor((6 + Math.random() * 22) * dpr), dx = Math.random() < 0.5 ? -6 : 6;
      g.drawImage(c, 0, y, D, hh, x0 + dx, y0 + y * k, D * k, hh * k);
    }
    g.restore();
  }
  function desenharMalha(now, red, lx, ly, rl) {
    const v = S.vista, p = v.pontos, D = 2 * Rc, mapa = mapaLente(v.vw, v.vh, D), ox = lx - Rc, oy = ly - Rc;
    const L = lento();
    g.save();
    g.beginPath(); g.arc(lx, ly, rl, 0, TAU); g.clip();
    // a malha acende de cima para baixo atrás de uma linha de luz (600 ms) e fica a 25%
    const tm = A.malhaT0 >= 0 ? (now - A.malhaT0) / L : 1e9;
    const rev = red ? 1 : eoc(faixa(tm, 0, 600));
    const b = v.box;
    const [, ya] = mapa(0, b.y0), [, yb] = mapa(0, b.y1);
    const ys = lerp(oy + ya - 12, oy + yb + 12, rev);
    const parado = !S.cam.ligada;
    const base = parado ? 0.16 : 0.25;
    const baldes = [[], [], [], []];   // 4 níveis de brilho (um fillStyle por nível)
    for (let i = 0; i < p.length; i++) {
      const [x, y] = mapa(p[i].x, p[i].y), X = ox + x, Y = oy + y;
      let a = base;
      if (rev < 1) { if (Y > ys) continue; a = base + (1 - base) * Math.exp(-(ys - Y) / 22); }
      baldes[a > 0.8 ? 3 : a > 0.55 ? 2 : a > 0.35 ? 1 : 0].push(X, Y);
    }
    const alfas = [base, 0.45, 0.7, 0.95];
    for (let k = 0; k < 4; k++) {
      const l = baldes[k]; if (!l.length) continue;
      g.fillStyle = rgba(C.holo, alfas[k]);
      g.beginPath();
      for (let i = 0; i < l.length; i += 2) g.rect(l[i] - 0.8, l[i + 1] - 0.8, 1.6, 1.6);
      g.fill();
    }
    // contorno, sobrancelhas e nariz fracos; olhos e boca em --holo-medio (os olhos piscam em --ink)
    const linha = (idx, fechar) => {
      g.beginPath();
      for (let j = 0; j < idx.length; j++) { const q = p[idx[j]]; if (!q) continue; const [x, y] = mapa(q.x, q.y); if (j) g.lineTo(ox + x, oy + y); else g.moveTo(ox + x, oy + y); }
      if (fechar) g.closePath();
      g.stroke();
    };
    if (rev >= 1) {
      g.lineWidth = 1;
      g.strokeStyle = rgba(C.holo, parado ? 0.12 : 0.18); linha(LACO.oval, true); linha(LACO.sobD, false); linha(LACO.sobE, false); linha(LACO.nariz, false);
      g.strokeStyle = rgba(C.holo, 0.36); linha(LACO.boca, true);
      const pisca = now < A.olhosAte;
      g.strokeStyle = pisca ? rgba(C.ink, 0.95) : rgba(C.holo, 0.36); g.lineWidth = pisca ? 1.6 : 1;
      linha(LACO.olhoD, true); linha(LACO.olhoE, true);
    } else {
      // a linha de luz que acende a malha
      const [xa] = mapa(b.x1, 0), [xb] = mapa(b.x0, 0), x0 = ox + Math.min(xa, xb) - 16, x1 = ox + Math.max(xa, xb) + 16;
      const lg2 = g.createLinearGradient(x0, 0, x1, 0);
      lg2.addColorStop(0, rgba(C.holo, 0)); lg2.addColorStop(0.5, rgba(C.ink, 0.9)); lg2.addColorStop(1, rgba(C.holo, 0));
      g.fillStyle = lg2; g.fillRect(x0, ys - 1, x1 - x0, 2);
    }
    g.restore();
  }
  // colchetes de canto: parados na borda da lente; voam até a caixa do rosto (mola ~300 ms) quando ele aparece
  function atualizarMira(now, dt, red) {
    const [lx, ly] = centroLente(now, red);
    let alvo;
    const v = S.vista;
    if (comCamera() && v.pontos && v.box && A.k > 0.97 && A.encolherT0 < 0) {
      const D = 2 * Rc, mapa = mapaLente(v.vw, v.vh, D), ox = lx - Rc, oy = ly - Rc;
      const [xa, ya] = mapa(v.box.x0, v.box.y0), [xb, yb] = mapa(v.box.x1, v.box.y1);
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), pad = 0.1 * (x1 - x0);
      alvo = [ox + x0 - pad, oy + ya - pad, ox + x1 + pad, oy + yb + pad];
    } else {
      const s = Rc * A.k * 0.74;
      alvo = [lx - s, ly - s, lx + s, ly + s];
    }
    if (!A.mira || red) A.mira = alvo.slice();
    else for (let i = 0; i < 4; i++) A.mira[i] = amortecer(A.mira[i], alvo[i], 14 / lento(), dt);
    const [x0, y0, x1, y1] = A.mira, t = 18;
    const pos = [[x0, y0], [x1 - t, y0], [x0, y1 - t], [x1 - t, y1 - t]];
    for (let i = 0; i < 4; i++) {
      const s = `translate(${pos[i][0].toFixed(1)}px, ${pos[i][1].toFixed(1)}px)`;
      if (el.mira[i].style.transform !== s) el.mira[i].style.transform = s;
    }
    const tm = A.tom === 'ok' ? 'ok' : A.tom === 'vermelho' ? 'vermelho' : S.estado === 'alinhando' && !v.qual.ok ? 'rever' : '';
    if (el.miraBox.dataset.tom !== tm) el.miraBox.dataset.tom = tm;
  }
  function atualizarLeituras(now) {
    if (now - S.leituraEm < 100) return;
    S.leituraEm = now;
    const v = S.vista, est = S.estado;
    leitura('rostos', S.cam.ligada ? String(v.rostos) : '—');
    leitura('alinha', S.cam.ligada && v.rostos === 1 ? `${alinhamento(v)}%` : '—');
    leitura('fps', S.cam.ligada ? `${Math.round(S.fps.v)} FPS` : 'DESLIGADA');
    if (est === 'cadastro-coleta') { leitura('rot2', 'AMOSTRAS'); leitura('piscadas', `${A.segs}/${A.segsTotal}`); }
    else if (est === 'analisando') {
      leitura('rot2', 'ID');
      // números rolando (enfeite: sorteados aqui, não são o descritor)
      if (now - S.idEm > 90) { S.idEm = now; leitura('piscadas', `0,${String(Math.floor(Math.random() * 90 + 10))} · 0,${String(Math.floor(Math.random() * 90 + 10))}`); }
    } else {
      leitura('rot2', 'PISCADAS');
      leitura('piscadas', S.janela ? `${S.janela.lista.length}/${S.janela.n}` : '—');
    }
  }

  /* ---------- câmera ---------- */
  function erroCamera(e) {
    const n = (e && e.name) || '';
    if (/NotFound|DevicesNotFound|Overconstrained|ConstraintNotSatisfied/i.test(n)) return erro('sem-camera', e);
    if (/NotReadable|TrackStart|Abort/i.test(n)) return erro('em-uso', e);
    if (/NotAllowed|PermissionDenied|Security/i.test(n)) return erro('negado', e);
    return erro('sem-camera', e);
  }
  async function temCamera() {
    if (sim && sim.fonte !== 'real') return sim.camera !== 'sem-camera';
    try {
      const md = navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function') return false;
      if (typeof md.enumerateDevices !== 'function') return true;
      const l = await md.enumerateDevices();
      return !Array.isArray(l) || l.some((d) => d.kind === 'videoinput');
    } catch { return true; }
  }
  async function abrirCameraReal() {
    const md = navigator.mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function') throw erro('sem-suporte');
    if (!(await temCamera())) throw erro('sem-camera');
    try {
      return await md.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false });
    } catch (e) { throw erroCamera(e); }
  }
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
    try { await Promise.race([video.play(), esperar(3000)]); } catch { /* o autoplay mudo costuma bastar */ }
  }
  async function ligarCamera() {
    checar();
    const stream = sim && sim.fonte !== 'real' ? await cameraSimulada() : await abrirCameraReal();
    if (!S.sessao || S.sessao.signal.aborted || !el) { pararStream(stream); throw erro('cancelado'); }
    S.cam.stream = stream;
    await prepararVideo(el.video, stream);
    if (!S.sessao || S.sessao.signal.aborted || !el) { desligarCamera(); throw erro('cancelado'); }
    S.cam.ligada = true;
    camIndicador(true);
    S.piscar = null; A.malhaT0 = -1; S.hist.length = 0;
    const tr = stream.getVideoTracks()[0];
    if (tr) tr.addEventListener('ended', () => { if (S.cam.stream === stream) aoCameraCaiu('camera-caiu'); });
  }
  function pararStream(stream) { try { for (const t of stream.getTracks()) t.stop(); } catch { /* nada */ } }
  function desligarCamera({ congelar = false } = {}) {
    if (congelar && S.cam.ligada && el && el.video.videoWidth) congelarQuadro();
    pararLaco();
    if (S.cam.stream) pararStream(S.cam.stream);
    S.cam.stream = null;
    if (el) { try { el.video.pause(); } catch { /* nada */ } el.video.srcObject = null; }
    const estava = S.cam.ligada;
    S.cam.ligada = false;
    if (estava) camIndicador(false);
  }
  function aoCameraCaiu(codigo) {
    desligarCamera();
    const f = S.falhaQuadro; S.falhaQuadro = null;
    if (f) f(erro(codigo));
  }
  // o último quadro fica parado na lente (só na tela; nada guardado) e perde a cor em 400 ms
  function congelarQuadro() {
    const v = el.video, c = el.parado, D = Math.max(2, Math.round(2 * Rc * dpr));
    c.width = D; c.height = D;
    const q = c.getContext('2d');
    const vw = v.videoWidth, vh = v.videoHeight, s = Math.max(D / vw, D / vh), w = vw * s, h = vh * s;
    q.save(); q.translate(D, 0); q.scale(-1, 1); q.drawImage(v, (D - w) / 2, (D - h) / 2, w, h); q.restore();
    c.classList.add('rs-vis');
    requestAnimationFrame(() => { if (el) c.classList.add('rs-cinza'); });
  }
  function limparParado() {
    if (!el) return;
    const c = el.parado;
    try { const q = c.getContext('2d'); q.clearRect(0, 0, c.width, c.height); } catch { /* nada */ }
    c.width = 0; c.height = 0;
    c.classList.remove('rs-vis', 'rs-cinza');
  }

  /* ---------- bibliotecas e câmera juntas ---------- */
  function carregarLibs() {
    if (S.libs) return Promise.resolve(S.libs);
    if (S.carregando) return S.carregando;
    const sinal = S.sessao && S.sessao.signal;
    const p = (sim && sim.fonte === 'desenho' ? carregarSimulado(carga) : carregarReal(carga, sinal))
      .then((l) => { if (!S.sessao || S.sessao.signal !== sinal || sinal.aborted) { try { l.fechar(); } catch { /* nada */ } throw erro('cancelado'); } S.libs = l; return l; })
      .finally(() => { if (S.carregando === p) S.carregando = null; });
    S.carregando = p;
    return p;
  }
  function fecharLibs() {
    const l = S.libs; S.libs = null;
    if (l) { try { l.fechar(); } catch { /* nada */ } }
  }
  async function prepararCamera() {
    checar();
    if (S.cam.ligada && S.libs) { iniciarLaco(); return; }
    abrirLente();
    tom('holo');
    definirEstado(S.libs ? 'camera' : 'carregando');
    if (S.libs) { status('ABRINDO A CÂMERA'); dica('Abrindo a câmera…'); } else { status('CARREGANDO 0%'); dica('Preparando o reconhecimento…'); carga(0); }
    // a câmera pode abrir antes das bibliotecas: o vídeo já aparece na lente
    const [rl, rc] = await Promise.allSettled([carregarLibs(), S.cam.ligada ? Promise.resolve() : ligarCamera().then(() => { if (S.estado === 'carregando') dica('A câmera já abriu. Terminando de carregar…'); })]);
    if (rc.status === 'rejected') { desligarCamera(); throw rc.reason; }
    if (rl.status === 'rejected') { desligarCamera(); throw rl.reason; }
    checar();
    iniciarLaco();
  }

  /* ---------- laço de detecção (um por quadro de vídeo) ---------- */
  function iniciarLaco() {
    if (!S.cam.ligada || !S.libs || S.cam.rvfc || S.cam.raf) return;
    S.fps = { n: 0, t0: agora(), v: 0 };
    S.cam.ultimoQuadro = agora(); S.cam.semRvfc = false;
    agendar();
    // vigia: se o requestVideoFrameCallback parar de chamar (alguns streams de canvas), cai para o rAF
    clearInterval(S.cam.vigia);
    S.cam.vigia = setInterval(() => {
      if (!S.cam.ligada || document.hidden) return;
      if (agora() - S.cam.ultimoQuadro > 900 && S.cam.rvfc) { try { el.video.cancelVideoFrameCallback(S.cam.rvfc); } catch { /* nada */ } S.cam.rvfc = 0; S.cam.semRvfc = true; agendar(); }
    }, 500);
  }
  function agendar() {
    if (!S.cam.ligada || !el) return;
    const v = el.video;
    if (!S.cam.semRvfc && typeof v.requestVideoFrameCallback === 'function') S.cam.rvfc = v.requestVideoFrameCallback(passoVideo);
    else S.cam.raf = requestAnimationFrame(passoVideo);
  }
  function pararLaco() {
    clearInterval(S.cam.vigia); S.cam.vigia = 0;
    try { if (S.cam.rvfc && el) el.video.cancelVideoFrameCallback(S.cam.rvfc); } catch { /* nada */ }
    if (S.cam.raf) cancelAnimationFrame(S.cam.raf);
    S.cam.rvfc = 0; S.cam.raf = 0;
  }
  function passoVideo() {
    const doRaf = !!S.cam.raf;
    S.cam.rvfc = 0; S.cam.raf = 0;
    if (!S.cam.ligada || !S.libs) return;
    if (doRaf && el.video.currentTime === S.cam.ultimoTempo) { agendar(); return; }
    S.cam.ultimoTempo = el.video.currentTime;
    S.cam.ultimoQuadro = agora();
    if (!document.hidden) { try { analisar(); } catch (e) { try { console.warn('[Rosto] a análise falhou num quadro.', e && e.name); } catch { /* nada */ } } }
    agendar();
  }
  function analisar() {
    const v = el.video;
    if (!v.videoWidth) return;
    let ts = agora();
    if (ts <= S.cam.ultimoTs) ts = S.cam.ultimoTs + 1;
    S.cam.ultimoTs = ts;
    const res = S.libs.detectar(v, ts);
    const lista = (res && res.faceLandmarks) || [];
    const q = S.vista;
    q.vw = v.videoWidth; q.vh = v.videoHeight; q.rostos = lista.length;
    let b = NaN;
    if (lista.length) {
      const p = lista[0];
      q.pontos = p;
      q.box = caixaDosPontos(p);
      q.largura = q.box.w;
      const m = res.facialTransformationMatrixes && res.facialTransformationMatrixes[0] && res.facialTransformationMatrixes[0].data;
      if (m && m.length >= 16) { const a = angulosDaMatriz(m); q.yaw = a.yaw; q.pitch = a.pitch; q.roll = a.roll; } else { q.yaw = 0; q.pitch = 0; q.roll = 0; }
      const cats = res.faceBlendshapes && res.faceBlendshapes[0] && res.faceBlendshapes[0].categories;
      let modo = 'ear';
      if (cats && cats.length) {
        let l = NaN, r = NaN;
        for (const c of cats) { if (c.categoryName === 'eyeBlinkLeft') l = c.score; else if (c.categoryName === 'eyeBlinkRight') r = c.score; }
        if (Number.isFinite(l) && Number.isFinite(r)) { b = (l + r) / 2; modo = 'blend'; }
      }
      if (modo === 'ear') b = earDosPontos(p, q.vw, q.vh);
      if (!S.piscar || S.piscar.modo !== modo) S.piscar = criarPiscar({ modo });
      if ((S.cam.nQuadro++ & 3) === 0) { const lz = medirLuz(v, q.box); if (Number.isFinite(lz)) q.luz = lz; }
      // movimento: quanto o centro do rosto andou em ~200 ms (em fração da largura do vídeo)
      const hy0 = q.box.cy * (q.vh / q.vw);
      S.hist.push({ t: ts, x: q.box.cx, y: hy0 });
      while (S.hist.length > 2 && ts - S.hist[1].t > Q.paradoMs) S.hist.shift();
      const h0 = S.hist[0];
      q.movimento = ts - h0.t >= Q.paradoMs * 0.6 ? Math.hypot(q.box.cx - h0.x, hy0 - h0.y) : NaN;
      if (A.malhaT0 < 0) A.malhaT0 = agora();
    } else {
      q.pontos = null; q.box = null; q.largura = 0; q.movimento = NaN;
      S.hist.length = 0;
      A.malhaT0 = -1;
    }
    q.b = b;
    q.qual = avaliarQuadro(q, { angMax: Q.angMax });
    q.qualCad = avaliarQuadro(q, { angMax: Q.angMaxCadastro });
    const ev = S.piscar ? S.piscar.quadro(b, ts, lista.length === 1) : null;
    q.evento = ev;
    q.aberto = lista.length === 1 && !!S.piscar && S.piscar.aberto(b);
    if (ev && ev.tipo === 'fechou') A.olhosAte = agora() + 220;
    if (S.janela && S.janela.ativa && ev && ev.tipo === 'piscou') registrarPiscada(ev);
    if (S.des) S.des.quadros++;
    // quadros por segundo da câmera (a leitura do HUD e a prova)
    S.fps.n++;
    const dtf = ts - S.fps.t0;
    if (dtf >= 1000) { S.fps.v = (S.fps.n * 1000) / dtf; S.fps.n = 0; S.fps.t0 = ts; }
    if (S.aoQuadro) S.aoQuadro(q);
  }
  function medirLuz(v, box) {
    try {
      const c = S.cam.luzCv || (S.cam.luzCv = document.createElement('canvas'));
      if (c.width !== 32) { c.width = 32; c.height = 32; }
      const q = c.getContext('2d', { willReadFrequently: true });
      const vw = v.videoWidth, vh = v.videoHeight;
      const sx = limitar(box.x0 * vw, 0, vw - 2), sy = limitar(box.y0 * vh, 0, vh - 2);
      const sw = limitar(box.w * vw, 2, vw - sx), sh = limitar(box.h * vh, 2, vh - sy);
      q.drawImage(v, sx, sy, sw, sh, 0, 0, 32, 32);
      const d = q.getImageData(0, 0, 32, 32).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      q.clearRect(0, 0, 32, 32);
      return s / 1024;
    } catch { return NaN; }
  }
  function registrarPiscada(ev) {
    const j = S.janela, d = j.des;
    j.lista.push({ ini: ev.ini - d.t0, fim: ev.fim - d.t0 });
    bolinhas(j.n, Math.min(j.n, j.lista.length));
    A.olhosAte = agora() + 180;
    sons.tocar('ferramenta');
  }
  // espera por quadros: fn(q, fim) roda a cada quadro analisado; a câmera cair ou a janela sair da frente rejeita
  function aguardarQuadros(fn, prazoMs = Infinity) {
    return new Promise((ok, falha) => {
      const sinal = S.sessao && S.sessao.signal;
      let tm = 0, feito = false;
      const fim = (v, e) => {
        if (feito) return;
        feito = true;
        if (S.aoQuadro === cb) S.aoQuadro = null;
        if (S.falhaQuadro === rej) S.falhaQuadro = null;
        clearTimeout(tm);
        if (sinal) sinal.removeEventListener('abort', ab);
        if (e) falha(e); else ok(v);
      };
      const ab = () => fim(null, erro('cancelado'));
      const rej = (e) => fim(null, e);
      const cb = (q) => { try { fn(q, (v) => fim(v)); } catch (e) { fim(null, e); } };
      if (!sinal || sinal.aborted) { ab(); return; }
      if (!S.cam.ligada) { fim(null, erro('camera-caiu')); return; }
      sinal.addEventListener('abort', ab, { once: true });
      if (Number.isFinite(prazoMs)) tm = setTimeout(() => fim(undefined), prazoMs);
      S.aoQuadro = cb; S.falhaQuadro = rej;
    });
  }

  /* ---------- passos da conferência ---------- */
  function mostrarQualidade(q, fixa) {
    if (!q.ok) {
      definirEstado(q.regra === 'rosto' ? 'procurando' : 'alinhando');
      status(q.regra === 'rosto' ? 'PROCURANDO ROSTO' : q.regra === 'frente' ? 'OLHE PARA A CÂMERA' : 'ROSTO DETECTADO');
    } else {
      definirEstado('alinhando');
      status('ROSTO DETECTADO');
    }
    dicaDaRegra(q, fixa);
  }
  // rosto bom (1 pessoa, perto, de frente, com luz e parado) por `estavelMs` seguidos
  function esperarQualidade(estavelMs = 400, cadastro = false) {
    let desde = 0;
    definirEstado('procurando'); status('PROCURANDO ROSTO'); dica('Procurando seu rosto');
    return aguardarQuadros((q, fim) => {
      const qq = cadastro ? q.qualCad : q.qual;
      mostrarQualidade(qq, 'Isso. Fique assim.');
      if (qq.ok) { if (!desde) desde = agora(); if (agora() - desde >= estavelMs) fim(true); } else desde = 0;
    });
  }
  async function novoDesafio() {
    const r = await chamar('/api/rosto/desafio', { metodo: 'POST', corpo: {} });
    checar();
    if (r.status === 200 && r.dados.id) {
      const n = Number(r.dados.piscadas) === 3 ? 3 : 2;
      const ex = typeof r.dados.expira_em === 'number' ? r.dados.expira_em : Date.parse(r.dados.expira_em);
      return { id: r.dados.id, n, t0: agora(), expira: Number.isFinite(ex) ? ex : Date.now() + 60000, quadros: 0, piscadas: [] };
    }
    if (r.status === 429) return { erro: 'bloqueado', ate: quando(r.dados) };
    if (r.status === 404) return { erro: 'sem-cadastro' };
    return { erro: 'servidor' };
  }
  function quando(d) {
    const v = d && (d.tentar_em || d.bloqueado_ate);
    const t = typeof v === 'number' ? v : Date.parse(v);
    return Number.isFinite(t) ? t : Date.now() + 10 * 60000;
  }
  async function pedirPiscadas(des) {
    definirEstado('piscar'); tom('holo');
    const n = des.n;
    status('PISQUE PARA CONFIRMAR'); dica(`Pisque ${NUMERO[n]} vezes`); bolinhas(n, 0);
    dizer(`Pisque ${NUMERO[n]} vezes.`);
    S.janela = { ativa: true, n, lista: [], des, ini: agora() };
    let tFim = 0;
    const ok = await aguardarQuadros((q, fim) => {
      const j = S.janela;
      if (j.lista.length >= n) { if (!tFim) tFim = agora(); if (agora() - tFim >= CAPTURA.depoisPiscar) fim(true); return; }
      if (agora() - j.ini > PISCAR.janelaMs) fim(false);
      if (q.rostos !== 1) dica(q.rostos ? 'Só uma pessoa na frente da câmera' : 'Procurando seu rosto');
      else if (el.dica.textContent !== `Pisque ${NUMERO[n]} vezes`) dica(`Pisque ${NUMERO[n]} vezes`);
    }, PISCAR.janelaMs + 2000);
    return !!ok;
  }
  async function pegarDescritor() {
    const v = el.video;
    if (!v || !v.videoWidth) return null;
    const c = S.cam.tela || (S.cam.tela = document.createElement('canvas'));
    c.width = v.videoWidth; c.height = v.videoHeight;
    const q = c.getContext('2d');
    q.drawImage(v, 0, 0, c.width, c.height);
    try {
      const d = await S.libs.descritor(c);
      return d && d.length === 128 ? Array.from(d, (x) => Math.round(x * 1e6) / 1e6) : null;
    } finally {
      // o quadro sai da memória logo depois de usado
      try { q.clearRect(0, 0, c.width, c.height); } catch { /* nada */ }
      c.width = 0; c.height = 0;
    }
  }
  function capturarDescritores(k = CAPTURA.quadros) {
    definirEstado('analisando'); A.progRot = 'COMPARANDO'; status('COMPARANDO 0%'); dica('Analisando…');
    A.progVis = true; A.prog = 0; A.progAlvo = 0.06;
    const out = [];
    let tentativas = 0, ultimo = -1e9, ocupado = false;
    return aguardarQuadros((q, fim) => {
      if (ocupado || !q.qual.ok || !q.aberto || agora() - ultimo < CAPTURA.intervalo) return;
      ocupado = true; tentativas++;
      pegarDescritor().then((d) => {
        ocupado = false; ultimo = agora();
        if (d) { out.push(d); A.progAlvo = 0.08 + (0.8 * out.length) / k; }
        if (out.length >= k) fim(out);
        else if (tentativas >= CAPTURA.tentativas) fim(null);
      }, () => { ocupado = false; ultimo = agora(); if (tentativas >= CAPTURA.tentativas) fim(null); });
    }, 20000).then((r) => r || null);
  }
  function provaDe(des) {
    const seg = Math.max(0.001, (agora() - des.t0) / 1000);
    return { piscadas: des.piscadas.map((p) => ({ ini: Math.round(p.ini), fim: Math.round(p.fim) })), quadros: des.quadros, fps: Math.round((des.quadros / seg) * 10) / 10 };
  }
  const zerar = (lista) => { if (Array.isArray(lista)) for (const d of lista) if (Array.isArray(d)) d.length = 0; };

  /* Uma tentativa com o rosto: câmera → desafio → rosto bom → piscar → 3 quadros → servidor.
     → { liberado, distancia } | { recusado, codigo, restantes, distancia } | { erro, ate? } */
  async function tentativaRosto() {
    tom('holo'); limparParado(); A.checkT0 = -1; A.pulsoT0 = -1; A.flashT0 = -1; A.progVis = false; A.segsTotal = 0; bolinhas(0, 0); limparBotoes();
    try { await prepararCamera(); } catch (e) { if (ehCancelado(e)) throw e; return { erro: e.codigo || 'sem-modelo' }; }
    let des = await novoDesafio();
    if (des.erro) { desligarCamera(); return des; }
    S.des = des;
    try {
      for (let volta = 0; ; volta++) {
        await esperarQualidade(400);
        if (await pedirPiscadas(des)) break;
        S.janela = null; bolinhas(0, 0);
        if (volta >= 1) { desligarCamera(); return { erro: 'sem-piscar' }; }
        dica('Não vi as piscadas. Vamos de novo.');
        await dormir(1200);
        // a mesma conferência vale por 60 s: perto de vencer, pede outra
        if (des.expira - Date.now() < 25000) { des = await novoDesafio(); if (des.erro) { desligarCamera(); return des; } S.des = des; }
        else { des.piscadas = []; }
      }
      const descritores = await capturarDescritores();
      des.piscadas = S.janela ? S.janela.lista.slice() : [];
      S.janela = null;
      if (!descritores) { desligarCamera(); return { erro: 'sem-descritor' }; }
      const prova = provaDe(des);
      desligarCamera({ congelar: true });
      A.progAlvo = 0.94;
      const r = await chamar('/api/rosto/conferir', { metodo: 'POST', corpo: { desafio: des.id, descritores, prova }, prazo: 20000 });
      zerar(descritores);
      checar();
      S.ultimaDist = Number.isFinite(r.dados.distancia) ? r.dados.distancia : null;
      if (r.status === 200 && r.dados.liberado) { A.progAlvo = 1; return { liberado: true, metodo: 'rosto', distancia: S.ultimaDist }; }
      if (r.status === 403) return { recusado: true, codigo: r.dados.erro || 'nao-confere', restantes: Number.isFinite(r.dados.tentativas_restantes) ? r.dados.tentativas_restantes : null, distancia: S.ultimaDist };
      if (r.status === 409 || r.status === 410) return { erro: 'desafio' };
      if (r.status === 429) return { erro: 'bloqueado', ate: quando(r.dados) };
      if (r.status === 400) return { erro: 'quadros' };
      return { erro: 'servidor' };
    } catch (e) {
      if (ehCancelado(e)) throw e;
      desligarCamera();
      return { erro: e.codigo || 'camera-caiu' };
    } finally {
      S.des = null; S.janela = null;
    }
  }

  /* ---------- animações de fim ---------- */
  async function animarConfirmado(metodo) {
    definirEstado('liberado');
    tom('ok'); limparBotoes(); bolinhas(0, 0); A.progVis = false;
    const t = agora();
    A.flashT0 = t; A.checkT0 = t; A.pulsoT0 = -1;
    sons.tocar('pronto');
    status(metodo === 'cadastro' ? `CADASTRO FEITO · ${nome.toUpperCase()}` : `IDENTIDADE CONFIRMADA · ${nome.toUpperCase()}`);
    const dbg = debug && Number.isFinite(S.ultimaDist) ? ` (distância ${S.ultimaDist.toLocaleString('pt-BR', { minimumFractionDigits: 3 })})` : '';
    dica(metodo === 'hello' ? 'Confirmado pelo Windows Hello.' : metodo === 'cadastro' ? 'Cadastro gravado neste computador.' : `Identidade confirmada.${dbg}`);
    S.confirmado = true;
    await dormirVisual(700);
  }
  async function animarLiberado(r) {
    if (!S.confirmado) await animarConfirmado(r.metodo);
    // a lente encolhe até o núcleo e o sistema é liberado
    el.p.classList.add('rs-encolhendo');
    encolherLente();
    dica('');
    await Promise.all([digitar('SISTEMA LIBERADO'), dormirVisual(450)]);
    await dormirVisual(250);
  }
  async function animarRecusado(r) {
    definirEstado('recusado');
    tom('vermelho');
    A.pulsoT0 = agora(); A.glitch = reduzido() ? 0 : 2; A.progVis = false;
    sons.tocar('interrompido');
    status('NÃO RECONHECI');
    const dbg = debug && Number.isFinite(r && r.distancia) ? ` (distância ${r.distancia.toLocaleString('pt-BR', { minimumFractionDigits: 3 })})` : '';
    return dbg;
  }

  /* ---------- Windows Hello ---------- */
  let promessaWA = null;
  function webauthn() {
    if (sim && sim.fonte !== 'real') return Promise.resolve(helloSimulado());
    if (!promessaWA) promessaWA = import(/* @vite-ignore */ URL_WEBAUTHN).catch((e) => { promessaWA = null; throw erro('sem-modelo', e); });
    return promessaWA;
  }
  async function helloDisponivel() {
    try { const wa = await webauthn(); return !!(await wa.platformAuthenticatorIsAvailable()); } catch { return false; }
  }
  // o rpID "localhost" só vale em http://localhost (em 127.0.0.1 o WebAuthn recusa): manda para localhost
  function precisaLocalhost() { try { return /^(127\.0\.0\.1|\[::1\])$/.test(location.hostname); } catch { return false; } }
  function irParaLocalhost() { try { const u = new URL(location.href); u.hostname = 'localhost'; location.replace(u.href); } catch { /* nada */ } }
  async function cerimoniaHello(tipo) {
    if (precisaLocalhost()) { irParaLocalhost(); throw erro('cancelado'); }
    let wa;
    try { wa = await webauthn(); } catch { return { erro: 'sem-modelo' }; }
    checar();
    let disp = false;
    try { disp = !!(await wa.platformAuthenticatorIsAvailable()); } catch { disp = false; }
    if (!disp) return { erro: 'sem-hello' };
    const op = await chamar('/api/rosto/hello/opcoes', { metodo: 'POST', corpo: { tipo } });
    checar();
    if (op.status === 404) return { erro: 'sem-hello-cadastro' };
    if (op.status !== 200) return { erro: op.dados.erro || 'servidor' };
    const optionsJSON = op.dados.optionsJSON || op.dados.opcoes || op.dados;
    let resposta;
    try {
      resposta = tipo === 'cadastro' ? await wa.startRegistration({ optionsJSON }) : await wa.startAuthentication({ optionsJSON });
    } catch (e) {
      const n = (e && (e.name || (e.cause && e.cause.name))) || '';
      const nc = (e && e.cause && e.cause.name) || '';
      // cancelado na janela do Windows: volta para os botões, sem erro vermelho
      if (/NotAllowed|Abort/.test(n) || /NotAllowed|Abort/.test(nc)) return { cancelado: true };
      return { erro: 'hello-falhou' };
    }
    checar();
    const r = await chamar(`/api/rosto/hello/${tipo === 'cadastro' ? 'cadastrar' : 'conferir'}`, { metodo: 'POST', corpo: { resposta } });
    checar();
    if (r.status === 200) return { ok: true, liberado: !!r.dados.liberado };
    if (r.status === 410) return { erro: 'hello-falhou' };
    return { erro: r.dados.erro === 'sem-pasta' ? 'sem-pasta' : 'hello-falhou' };
  }
  // entrada pelo Hello: → 'liberado' | 'rosto' | 'nao'
  async function sessaoHelloEntrada({ podeRosto }) {
    for (;;) {
      desligarCamera(); limparParado();
      abrirLente(); tom('holo'); A.checkT0 = -1; A.pulsoT0 = -1; A.progVis = false; bolinhas(0, 0);
      definirEstado('hello');
      status('WINDOWS HELLO'); dica('Confirme no Windows Hello');
      const r = await cerimoniaHello('entrada');
      if (r.ok) return 'liberado';
      let msg;
      if (r.cancelado) { tom('holo'); msg = 'Cancelado. Quando quiser, tente de novo.'; }
      else { tom('vermelho'); sons.tocar('interrompido'); msg = r.erro === 'sem-hello-cadastro' ? 'O Windows Hello ainda não foi cadastrado neste Jarvis.' : TXT[r.erro] || TXT['hello-falhou']; }
      status(r.cancelado ? 'WINDOWS HELLO' : 'NÃO CONFIRMOU');
      dica(msg);
      const pode = r.erro !== 'sem-hello' && r.erro !== 'sem-hello-cadastro';
      const id = await escolher([pode && { id: 'hello', txt: 'Usar o Windows Hello', principal: true }, podeRosto && { id: 'rosto', txt: 'Tentar com o rosto', principal: !pode }, { id: 'nao', txt: 'Agora não' }]);
      if (id !== 'hello') return id;
    }
  }

  /* ---------- fluxos ---------- */
  // conferência do dia: o rosto, com o Windows Hello de reserva
  async function sessaoConferir(st) {
    const helloCad = !!(st.hello && st.hello.cadastrado);
    let restantes = Number.isFinite(st.tentativas_restantes) ? st.tentativas_restantes : 3;
    let bloqueadoAte = st.bloqueado_ate ? quando({ bloqueado_ate: st.bloqueado_ate }) : 0;
    let auto = !(bloqueadoAte > Date.now()), desafioDeNovo = 0;
    for (;;) {
      let r = null;
      if (auto) {
        r = await tentativaRosto();
        if (r.liberado) return { liberado: true, metodo: 'rosto' };
        // a conferência venceu ou já foi usada: tenta de novo sozinho, uma vez
        if (r.erro === 'desafio' && desafioDeNovo++ < 1) continue;
        if (r.erro === 'bloqueado') { bloqueadoAte = r.ate; restantes = 0; }
        if (r.recusado && Number.isFinite(r.restantes)) restantes = r.restantes;
        else if (r.recusado) restantes = Math.max(0, restantes - 1);
      }
      auto = true;
      const bloqueado = restantes <= 0 || bloqueadoAte > Date.now();
      // o que dizer
      let msg;
      if (r && r.recusado) {
        const dbg = await animarRecusado(r);
        const falhas = Math.min(3, 3 - restantes);
        msg = r.codigo === 'prova-de-vida' ? TXT['prova-de-vida'] : r.codigo === 'quadros' ? TXT.quadros : `Não reconheci. Tente de novo (${falhas} de 3).`;
        if (restantes <= 0) msg = `Não reconheci (3 de 3). ${helloCad ? 'Use o Windows Hello.' : 'Tente de novo em 10 minutos.'}`;
        msg += dbg;
        dizer('Não reconheci.');
      } else {
        definirEstado('erro'); tom('vermelho'); status(bloqueado ? 'MUITAS TENTATIVAS' : 'NÃO DEU');
        const cod = r ? r.erro : 'bloqueado';
        if (cod === 'bloqueado' || bloqueado) {
          const hm = new Date(bloqueadoAte || Date.now() + 600000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          msg = helloCad ? 'Muitas tentativas com o rosto. Use o Windows Hello.' : `Muitas tentativas com o rosto. Tente de novo às ${hm}.`;
        } else if (cod === 'sem-camera' || cod === 'negado' || cod === 'em-uso') msg = `${TXT[cod]} ${helloCad ? 'Use o Windows Hello.' : 'O Windows Hello ainda não foi cadastrado.'}`;
        else msg = TXT[cod] || TXT.servidor;
      }
      dica(msg);
      const semCam = r && (r.erro === 'sem-camera' || r.erro === 'negado');
      const id = await escolher([
        !bloqueado && !semCam && { id: 'tentar', txt: 'Tentar de novo', principal: true },
        helloCad && { id: 'hello', txt: 'Usar o Windows Hello', principal: bloqueado || semCam },
        !bloqueado && semCam && { id: 'tentar', txt: 'Tentar de novo', principal: !helloCad },
        { id: 'nao', txt: 'Agora não' }
      ]);
      if (id === 'nao') return { liberado: false };
      if (id === 'hello') {
        const h = await sessaoHelloEntrada({ podeRosto: !bloqueado });
        if (h === 'liberado') return { liberado: true, metodo: 'hello' };
        if (h === 'nao') return { liberado: false };
        auto = true;
        continue;
      }
      // tentar de novo
      if (r && r.erro === 'servidor') { const s2 = await consultar(); if (s2 && s2.liberado) return { liberado: true, metodo: s2.metodo || 'rosto' }; }
    }
  }
  // só o Hello cadastrado (o primeiro uso foi sem câmera)
  async function sessaoHelloSo(st) {
    const h = await sessaoHelloEntrada({ podeRosto: false });
    void st;
    return h === 'liberado' ? { liberado: true, metodo: 'hello' } : { liberado: false };
  }
  // cadastro: a explicação, 8 amostras com o rosto um pouco virado, a conferência de prova e a oferta do Hello
  async function sessaoCadastro({ primeiro = true } = {}) {
    const temCam = await temCamera();
    checar();
    let intro = true;
    for (;;) {
      desligarCamera(); limparParado(); A.checkT0 = -1; A.pulsoT0 = -1; A.progVis = false; A.segsTotal = 0; tom('holo');
      if (intro) {
        const id = await cartao({
          estado: 'cadastro-intro', rot: primeiro ? 'Trava do Jarvis · cadastro' : 'Trava do Jarvis · cadastro novo',
          tit: primeiro ? 'Cadastrar o seu rosto' : 'Cadastrar o rosto de novo',
          html: `${HTML_PRIVACIDADE}${primeiro ? '' : '<p>O cadastro novo troca o antigo.</p>'}${temCam ? '' : `<p>${TXT['sem-camera']} Dá para cadastrar só o Windows Hello.</p>`}<p><b>Faça o cadastro você mesmo, sozinho na frente da câmera.</b></p>`,
          botoes: [temCam && { id: 'cadastrar', txt: 'Cadastrar meu rosto', principal: true }, !temCam && primeiro && { id: 'hello', txt: 'Cadastrar o Windows Hello', principal: true }, { id: 'nao', txt: 'Agora não' }]
        });
        if (id === 'nao') return { liberado: false };
        if (id === 'hello') {
          abrirLente(); definirEstado('cadastro-hello'); status('WINDOWS HELLO'); dica('Confirme no Windows Hello');
          const h = await cerimoniaHello('cadastro');
          if (h.ok) return { liberado: true, metodo: 'cadastro' };
          await cartao({ estado: 'cadastro-hello', rot: 'Windows Hello', tit: h.cancelado ? 'Cancelado' : 'Não deu', html: `<p>${h.cancelado ? 'Você cancelou na janela do Windows.' : TXT[h.erro] || TXT['hello-falhou']}</p>`, botoes: [{ id: 'ok', txt: 'Voltar', principal: true }] });
          continue;
        }
      }
      intro = true;
      // a coleta
      try { await prepararCamera(); } catch (e) {
        if (ehCancelado(e)) throw e;
        definirEstado('erro'); tom('vermelho'); status('NÃO DEU'); dica(TXT[e.codigo] || TXT['sem-modelo']);
        const id = await escolher([{ id: 'tentar', txt: 'Tentar de novo', principal: true }, { id: 'nao', txt: 'Agora não' }]);
        if (id === 'nao') return { liberado: false };
        intro = false; continue;
      }
      let ds = null, motivo = 'sem-descritor';
      try {
        await esperarQualidade(300, true);
        ds = await coletarCadastro();
      } catch (e) {
        if (ehCancelado(e)) throw e;
        ds = null; motivo = e.codigo || motivo;
      }
      if (!ds) {
        desligarCamera();
        definirEstado('erro'); tom('vermelho'); status('NÃO DEU'); dica(TXT[motivo] || TXT['sem-descritor']);
        const id = await escolher([{ id: 'tentar', txt: 'Tentar de novo', principal: true }, { id: 'nao', txt: 'Agora não' }]);
        if (id === 'nao') return { liberado: false };
        intro = false; continue;
      }
      definirEstado('analisando'); A.progRot = 'GRAVANDO'; status('GRAVANDO 0%'); dica('Gravando neste computador…');
      A.progVis = true; A.prog = 0; A.progAlvo = 0.95;
      const r = await chamar('/api/rosto/cadastro', { metodo: 'POST', corpo: { descritores: ds } });
      zerar(ds);
      checar();
      A.progVis = false; A.segsTotal = 0;
      if (r.status === 409) {
        // já existe um cadastro (feito em outra aba): confere com ele
        desligarCamera();
        const st = await consultar();
        return st ? sessaoConferir(st) : { liberado: false };
      }
      if (r.status !== 200) {
        desligarCamera();
        definirEstado('erro'); tom('vermelho'); status('NÃO DEU');
        dica(r.status === 400 ? 'Fique de frente, com boa luz, e tente de novo.' : TXT[r.dados.erro] || TXT.servidor);
        const id = await escolher([{ id: 'tentar', txt: 'Tentar de novo', principal: true }, { id: 'nao', txt: 'Agora não' }]);
        if (id === 'nao') return { liberado: false };
        intro = false; continue;
      }
      // a conferência de prova (o piscar), com a câmera ainda ligada
      status('CADASTRO GRAVADO'); dica('Agora um teste: pisque quando eu pedir.');
      await dormir(900);
      const p = await tentativaRosto();
      if (!p.liberado) {
        desligarCamera();
        if (p.recusado) await animarRecusado(p); else { definirEstado('erro'); tom('vermelho'); status('O TESTE NÃO CONFERIU'); }
        dica('O teste não conferiu. Refaça o cadastro com boa luz, de frente para a câmera.');
        const id = await escolher([{ id: 'refazer', txt: 'Refazer o cadastro', principal: true }, { id: 'seguir', txt: 'Seguir assim' }]);
        if (id === 'refazer') { primeiro = false; intro = false; continue; }
      } else await animarConfirmado('rosto');
      // a reserva: o Windows Hello
      const st = await consultar();
      if (!(st && st.hello && st.hello.cadastrado)) await ofertaHello();
      return { liberado: true, metodo: 'cadastro' };
    }
  }
  function coletarCadastro(total = CADASTRO.amostras) {
    definirEstado('cadastro-coleta'); tom('holo');
    status(`CADASTRO 0/${total}`); dica('Mexa a cabeça devagar, como quem diz sim e não');
    A.segsTotal = total; A.segs = 0;
    const out = [];
    let ultimo = -1e9, ocupado = false, falhas = 0;
    return aguardarQuadros((q, fim) => {
      const qq = q.qualCad;
      if (!qq.ok) dicaDaRegra(qq, ''); else if (el.dica.textContent !== 'Mexa a cabeça devagar, como quem diz sim e não') dicaDaRegra(qq, 'Mexa a cabeça devagar, como quem diz sim e não');
      if (ocupado || !qq.ok || !q.aberto || agora() - ultimo < CADASTRO.intervalo) return;
      ocupado = true;
      pegarDescritor().then((d) => {
        ocupado = false; ultimo = agora();
        if (d) { out.push(d); A.segs = out.length; status(`CADASTRO ${out.length}/${total}`); sons.tocar('ferramenta'); } else if (++falhas > 24) fim(null);
        if (out.length >= total) fim(out);
      }, () => { ocupado = false; ultimo = agora(); if (++falhas > 24) fim(null); });
    }, 120000).then((r) => r || null);
  }
  async function ofertaHello() {
    desligarCamera();
    const disp = await helloDisponivel();
    checar();
    if (!disp) {
      await cartao({ estado: 'cadastro-hello', rot: 'Reserva · Windows Hello', tit: 'Windows Hello desligado', html: `<p>${TXT['sem-hello']}</p><p>Sem ele, se o rosto falhar 3 vezes, o Jarvis espera 10 minutos para tentar de novo.</p>`, botoes: [{ id: 'ok', txt: 'Pular por agora', principal: true }] });
      return false;
    }
    for (;;) {
      const id = await cartao({ estado: 'cadastro-hello', rot: 'Reserva · Windows Hello', tit: 'Cadastrar o Windows Hello?', html: '<p>Se a câmera falhar ou o rosto não conferir, o Windows Hello (o PIN ou a digital do Windows) libera o Jarvis.</p>', botoes: [{ id: 'sim', txt: 'Cadastrar o Windows Hello', principal: true }, { id: 'pular', txt: 'Pular por agora' }] });
      if (id === 'pular') return false;
      definirEstado('hello'); status('WINDOWS HELLO'); dica('Confirme no Windows Hello');
      const r = await cerimoniaHello('cadastro');
      if (r.ok) { dica('Windows Hello cadastrado.'); sons.tocar('pronto'); await dormirVisual(600); return true; }
      if (r.cancelado) continue;
      const id2 = await cartao({ estado: 'cadastro-hello', rot: 'Reserva · Windows Hello', tit: 'Não deu', html: `<p>${TXT[r.erro] || TXT['hello-falhou']}</p>`, botoes: [{ id: 'tentar', txt: 'Tentar de novo', principal: true }, { id: 'pular', txt: 'Pular por agora' }] });
      if (id2 === 'pular') return false;
    }
  }
  async function telaErro(codigo) {
    abrirLente(); definirEstado('erro'); tom('vermelho'); status('NÃO DEU');
    dica(TXT[codigo] || TXT.servidor);
    await escolher([{ id: 'ok', txt: 'Fechar', principal: true }]);
    return { liberado: false };
  }

  /* ---------- abrir, fechar ---------- */
  function aoTecla(e) {
    if (!S.aberto) return;
    if (e.key === 'Escape') { e.preventDefault(); fechar(); }
  }
  function aoVisivel() {
    if (!S.aberto) return;
    if (document.hidden) {
      // a janela saiu da frente: a câmera fecha na hora (o passo atual termina com "oculto")
      if (S.cam.ligada) aoCameraCaiu('oculto');
    } else if (rafParado) { rafParado = false; ligarRaf(); }
  }
  function aoSair() { fechar(); }
  async function iniciar() {
    await garantirCss();
    montar();
    C = lerCores();
    S.sessao = new AbortController();
    S.aberto = true; S.confirmado = false; S.estado = null;
    S.foco = document.activeElement;
    Object.assign(A, { k: 0, kDe: 0, kPara: 0, ka: 0, kaDe: 0, kaPara: 0, aroT0: -1, malhaT0: -1, checkT0: -1, flashT0: -1, pulsoT0: -1, encolherT0: -1, glitch: 0, prog: 0, progAlvo: 0, progVis: false, segs: 0, segsTotal: 0, mira: null, hex: [], chaveK: '', chaveKa: '' });
    el.p.classList.remove('rs-saindo', 'rs-encolhendo', 'rs-com-cartao', 'rs-com-cam');
    tom('holo');
    raiz.classList.add('rs-travado');
    medir();
    window.addEventListener('keydown', aoTecla, true);
    window.addEventListener('resize', aoRedimensionar, { passive: true });
    document.addEventListener('visibilitychange', aoVisivel);
    window.addEventListener('pagehide', aoSair);
    ligarRaf();
    try { el.p.focus({ preventScroll: true }); } catch { /* nada */ }
  }
  async function encerrar() {
    desligarCamera();
    fecharLibs();
    S.des = null; S.janela = null; S.aoQuadro = null; S.falhaQuadro = null; S.piscar = null;
    S.vista.pontos = null; S.vista.box = null; S.hist.length = 0;
    if (S.cam.luzCv) { S.cam.luzCv.width = 0; S.cam.luzCv = null; }
    S.cam.tela = null;
    window.removeEventListener('keydown', aoTecla, true);
    window.removeEventListener('resize', aoRedimensionar);
    document.removeEventListener('visibilitychange', aoVisivel);
    window.removeEventListener('pagehide', aoSair);
    if (el) {
      el.p.classList.add('rs-saindo');
      await esperar(reduzido() ? 200 : 220);
      limparParado();
      desligarRaf();
      desmontar();
    }
    raiz.classList.remove('rs-travado');
    S.aberto = false; S.sessao = null; S.estado = null;
    try { onEstado('fechado', { camera: false }); } catch { /* nada */ }
    try { if (S.foco && S.foco.isConnected && typeof S.foco.focus === 'function') S.foco.focus({ preventScroll: true }); } catch { /* nada */ }
    S.foco = null;
  }
  // roda um fluxo com a tela montada; um por vez (o segundo pedido espera o primeiro terminar e devolve o padrão)
  function rodar(tipo, fluxo, padrao) {
    if (S.promessa) return S.promessa.tipo === tipo ? S.promessa : S.promessa.then(() => padrao, () => padrao);
    const p = (async () => {
      let r = padrao;
      try {
        await iniciar();
        r = await fluxo();
      } catch (e) {
        if (!ehCancelado(e)) { try { console.warn('[Rosto] o portão falhou.', e && (e.codigo || e.name)); } catch { /* nada */ } }
        r = padrao;
      } finally {
        await encerrar();
        S.promessa = null;
      }
      return r;
    })();
    p.tipo = tipo;
    S.promessa = p;
    return p;
  }

  function abrir() {
    return rodar('abrir', async () => {
      const st = await consultar();
      checar();
      if (!st) return telaErro('servidor');
      if (st.liberado) return { liberado: true, metodo: st.metodo || 'rosto' };
      const temRosto = !!(st.cadastro && st.cadastro.rosto), temHello = !!(st.hello && st.hello.cadastrado);
      let r;
      if (!temRosto && !temHello) {
        dizer(`${saudacao()}, ${nome}. Antes de começar, vamos cadastrar o seu rosto.`);
        r = await sessaoCadastro({ primeiro: true });
      } else if (temRosto) {
        dizer(`${saudacao()}, ${nome}. Antes de liberar, vou conferir seu rosto.`);
        abrirLente();
        r = await sessaoConferir(st);
      } else {
        dizer(`${saudacao()}, ${nome}. Antes de liberar, confirme no Windows Hello.`);
        r = await sessaoHelloSo(st);
      }
      if (r && r.liberado) await animarLiberado(r);
      return { liberado: !!(r && r.liberado), ...(r && r.liberado && r.metodo ? { metodo: r.metodo } : {}) };
    }, { liberado: false });
  }
  // pelos ajustes: cadastro novo (só liberado hoje)
  function recadastrar() {
    return rodar('recadastrar', async () => {
      const st = await consultar();
      checar();
      if (!st) { await telaErro('servidor'); return false; }
      if (!st.liberado) {
        abrirLente(); definirEstado('erro'); tom('rever'); status('TRAVADO'); dica('Faça o reconhecimento do dia antes de cadastrar de novo.');
        await escolher([{ id: 'ok', txt: 'Fechar', principal: true }]);
        return false;
      }
      const r = await sessaoCadastro({ primeiro: false });
      if (r.liberado) { await animarLiberado(r); return true; }
      return false;
    }, false);
  }
  // pelos ajustes: o Windows Hello depois (pulado no cadastro)
  function cadastrarHello() {
    return rodar('hello', async () => {
      const st = await consultar();
      checar();
      if (!st || !st.liberado) { await telaErro(st ? 'trava' : 'servidor'); return false; }
      return ofertaHello();
    }, false);
  }
  // pelos ajustes: "Apagar meu cadastro" (pergunta antes)
  function apagarCadastro() {
    return rodar('apagar', async () => {
      const id = await cartao({ estado: 'apagar', rot: 'Trava do Jarvis', tit: 'Apagar meu cadastro', tom: 'perigo', html: '<p>Apagar o cadastro do rosto e do Windows Hello deste computador? O Jarvis vai pedir um cadastro novo.</p>', botoes: [{ id: 'apagar', txt: 'Apagar', principal: true }, { id: 'nao', txt: 'Cancelar' }] });
      if (id !== 'apagar') return false;
      const r = await chamar('/api/rosto/apagar', { metodo: 'POST', corpo: { confirmar: true } });
      checar();
      const ok = r.status === 200;
      await cartao({ estado: 'apagar', rot: 'Trava do Jarvis', tit: ok ? 'Cadastro apagado' : 'Não apaguei', html: `<p>${ok ? 'O cadastro do rosto e do Windows Hello saiu deste computador. Na próxima vez o Jarvis pede um cadastro novo.' : r.status === 423 ? 'Faça o reconhecimento do dia antes de apagar.' : TXT.servidor}</p>`, botoes: [{ id: 'ok', txt: 'Fechar', principal: true }] });
      return ok;
    }, false);
  }
  async function travar() { const r = await chamar('/api/rosto/travar', { metodo: 'POST', corpo: {} }); return r.status === 200; }
  function fechar() {
    if (!S.aberto) return;
    if (S.sessao && !S.sessao.signal.aborted) S.sessao.abort();
    desligarCamera();
  }
  let destruido = false;
  function destruir() {
    if (destruido) return;
    destruido = true;
    fechar();
    if (!S.promessa) { desligarRaf(); desmontar(); raiz.classList.remove('rs-travado'); }
  }

  /* =============================================================================
     Simulador (?rosto=simular): a câmera é um canvas desenhado; os pontos e os descritores são de mentira
     ============================================================================= */
  const sim = simulado ? {
    rosto: true, n: 1, largura: 0.42, x: 0, y: 0, yaw: 0, pitch: 0, roll: 0, piscar: 0, olhoBase: 0.12, luz: 1,
    pessoa: 1, camera: 'ok', auto: true, fonte: 'desenho', foto: null, hello: { disponivel: false, resultado: 'ok' },
    agenda: [], janelaVista: null, t0Cam: 0
  } : null;
  function piscarSim(t) {
    let v = 0;
    for (let i = sim.agenda.length - 1; i >= 0; i--) {
      const f = t - sim.agenda[i];
      if (f > 400) { sim.agenda.splice(i, 1); continue; }
      if (f < 0) continue;
      v = Math.max(v, f < 40 ? f / 40 : f < 110 ? 1 : f < 150 ? 1 - (f - 110) / 40 : 0);
    }
    return v;
  }
  function autoSim(t) {
    const tc = t - sim.t0Cam;
    if (sim.auto) {
      // o rosto aparece 0,9 s depois de a câmera ligar e desliza até o centro
      if (tc < 900) { sim.rosto = false; sim.x = 0.14; }
      else { sim.rosto = true; sim.x = 0.14 * (1 - eoc(faixa(tc, 900, 1500))); }
      const est = S.estado;
      // no pedido de piscar, a pessoa pisca o número pedido
      if (est === 'piscar' && S.janela && sim.janelaVista !== S.janela) {
        sim.janelaVista = S.janela;
        for (let i = 0; i < S.janela.n; i++) sim.agenda.push(t + 700 + i * 650);
      }
      if (est === 'cadastro-coleta') { sim.yaw = 14 * Math.sin(t / 1100); sim.pitch = 9 * Math.sin(t / 1700 + 1); }
      else if (est !== 'alinhando' || !S.vista.qual || S.vista.qual.regra !== 'frente') { sim.yaw *= 0.9; sim.pitch *= 0.9; }
    }
    sim.piscar = Math.max(sim.piscarManual || 0, piscarSim(t));
  }
  function cameraSimulada() {
    if (sim.camera !== 'ok') return Promise.reject(erro(sim.camera));
    const c = document.createElement('canvas');
    c.width = 640; c.height = 480;
    if (typeof c.captureStream !== 'function') return Promise.reject(erro('sem-suporte'));
    const q = c.getContext('2d');
    const stream = c.captureStream(30);
    const tr = stream.getVideoTracks()[0];
    sim.t0Cam = agora(); sim.janelaVista = null;
    const tick = () => {
      if (!tr || tr.readyState === 'ended') { q.clearRect(0, 0, 640, 480); c.width = 0; return; }
      const t = agora();
      autoSim(t);
      if (sim.fonte === 'foto' && sim.foto) desenharFotoSim(q, t); else desenharCenaSim(q, t);
      requestAnimationFrame(tick);
    };
    tick();
    return Promise.resolve(stream);
  }
  function desenharFotoSim(q, t) {
    const f = sim.foto, W0 = 640, H0 = 480;
    const s = Math.max(W0 / f.width, H0 / f.height) * (1.02 + 0.01 * Math.sin(t / 900)), w = f.width * s, h = f.height * s;
    q.drawImage(f, (W0 - w) / 2 + 3 * Math.sin(t / 1300), (H0 - h) / 2, w, h);
  }
  function desenharCenaSim(q, t) {
    const W0 = 640, H0 = 480;
    const gf = q.createLinearGradient(0, 0, 0, H0);
    gf.addColorStop(0, rgba(C.surface2, 1)); gf.addColorStop(1, rgba(C.surface, 1));
    q.fillStyle = gf; q.fillRect(0, 0, W0, H0);
    // a parede do escritório: uma janela e uma prateleira
    q.fillStyle = rgba(C.lineForte, 0.5); q.fillRect(452, 46, 140, 180);
    q.fillStyle = rgba(C.muted, 0.18); q.fillRect(462, 56, 120, 160);
    q.fillStyle = rgba(C.line, 0.9); q.fillRect(40, 120, 150, 8);
    if (sim.rosto) for (let i = sim.n - 1; i >= 0; i--) desenharPessoaSim(q, i);
    if (sim.luz < 1) { q.fillStyle = rgba(C.bg, Math.min(0.96, (1 - sim.luz) * 1.1)); q.fillRect(0, 0, W0, H0); }
    else if (sim.luz > 1) { q.fillStyle = rgba(C.branco, Math.min(0.95, (sim.luz - 1) * 0.9)); q.fillRect(0, 0, W0, H0); }
    void t;
  }
  function desenharPessoaSim(q, i) {
    const g0 = geoSim(sim, i), pt = (u, v, olho, lado) => pontoSim(g0, u, v, olho, lado);
    const P = pontosSimulados(sim, i), px = (k) => [P[k].x * 640, P[k].y * 480];
    // ombros e pescoço
    q.fillStyle = rgba(C.azul, 0.8);
    q.beginPath(); q.ellipse(g0.cx, g0.cy + g0.fh * 0.98, g0.fw * 1.1, g0.fh * 0.48, 0, Math.PI, TAU); q.lineTo(g0.cx + g0.fw * 1.1, 480); q.lineTo(g0.cx - g0.fw * 1.1, 480); q.fill();
    q.fillStyle = rgba(C.muted, 0.85); q.fillRect(g0.cx - g0.fw * 0.17, g0.cy + g0.fh * 0.36, g0.fw * 0.34, g0.fh * 0.3);
    // cabeça pelo contorno da malha
    const gr = q.createRadialGradient(g0.cx - g0.fw * 0.12, g0.cy - g0.fh * 0.12, g0.fw * 0.05, g0.cx, g0.cy, g0.fw * 0.75);
    gr.addColorStop(0, rgba(C.ink, 0.95)); gr.addColorStop(0.5, rgba(C.muted, 1)); gr.addColorStop(1, rgba(C.lineForte, 1));
    q.fillStyle = gr;
    q.beginPath(); LACO.oval.forEach((k, j) => { const [x, y] = px(k); if (j) q.lineTo(x, y); else q.moveTo(x, y); }); q.closePath(); q.fill();
    // cabelo
    q.fillStyle = rgba(C.surface, 1);
    q.beginPath();
    const topo = LACO.oval.slice(27).concat(LACO.oval.slice(0, 10));
    topo.forEach((k, j) => { const [x, y] = px(k); if (j) q.lineTo(x, y); else q.moveTo(x, y - 6); });
    const [xa, ya] = pt(0.86, -0.42), [xb, yb] = pt(0, -0.62), [xc, yc] = pt(-0.86, -0.42);
    q.lineTo(xa, ya); q.quadraticCurveTo(xb, yb + 6, xc, yc); q.closePath(); q.fill();
    // sobrancelhas
    q.strokeStyle = rgba(C.surface, 1); q.lineWidth = Math.max(2, g0.fw * 0.03); q.lineCap = 'round';
    for (const idx of [LACO.sobD, LACO.sobE]) { q.beginPath(); idx.forEach((k, j) => { const [x, y] = px(k); if (j) q.lineTo(x, y); else q.moveTo(x, y); }); q.stroke(); }
    // olhos (a pálpebra fecha com o "piscar")
    for (const [idx, cu] of [[LACO.olhoD, -0.40], [LACO.olhoE, 0.40]]) {
      q.save();
      q.beginPath(); idx.forEach((k, j) => { const [x, y] = px(k); if (j) q.lineTo(x, y); else q.moveTo(x, y); }); q.closePath();
      q.fillStyle = rgba(C.ink, 1); q.fill();
      q.clip();
      const [ix, iy] = pt(cu, -0.12);
      q.fillStyle = rgba(C.azul, 1); q.beginPath(); q.arc(ix, iy, g0.fw * 0.045, 0, TAU); q.fill();
      q.fillStyle = rgba(C.bg, 1); q.beginPath(); q.arc(ix, iy, g0.fw * 0.022, 0, TAU); q.fill();
      q.restore();
      q.strokeStyle = rgba(C.bg, 0.7); q.lineWidth = 1.5;
      q.beginPath(); idx.forEach((k, j) => { const [x, y] = px(k); if (j) q.lineTo(x, y); else q.moveTo(x, y); }); q.closePath(); q.stroke();
    }
    // nariz
    q.strokeStyle = rgba(C.bg, 0.3); q.lineWidth = 2;
    q.beginPath(); LACO.nariz.forEach((k, j) => { const [x, y] = px(k); if (j) q.lineTo(x, y); else q.moveTo(x, y); }); q.stroke();
    // boca
    q.fillStyle = rgba(C.vermelho, 0.6);
    q.beginPath(); LACO.boca.forEach((k, j) => { const [x, y] = px(k); if (j) q.lineTo(x, y); else q.moveTo(x, y); }); q.closePath(); q.fill();
    q.fillStyle = rgba(C.bg, 0.75);
    q.beginPath(); LACO.bocaDentro.forEach((k, j) => { const [x, y] = px(k); if (j) q.lineTo(x, y); else q.moveTo(x, y); }); q.closePath(); q.fill();
  }
  function carregarSimulado(aoProgresso) {
    // a barra anda como se baixasse (0,9 s), para a tela de carregamento aparecer no teste
    return new Promise((ok, falha) => {
      const t0 = agora(), sinal = S.sessao && S.sessao.signal;
      const passo = () => {
        if (!sinal || sinal.aborted) { falha(erro('cancelado')); return; }
        const f = faixa(agora() - t0, 0, 900 * lento());
        aoProgresso(f);
        if (f >= 1) {
          if (sim.falharLibs) { falha(erro('sem-modelo')); return; }
          const saida = [Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 })), Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }))];
          ok({
            real: false,
            detectar() {
              const n = sim.rosto ? Math.max(0, Math.min(2, sim.n)) : 0, faces = [], bs = [], mt = [];
              for (let i = 0; i < n; i++) {
                faces.push(pontosSimulados(sim, i, saida[i]));
                const sc = sim.olhoBase + (0.92 - sim.olhoBase) * clamp01(sim.piscar);
                bs.push({ categories: [{ categoryName: 'eyeBlinkLeft', score: sc }, { categoryName: 'eyeBlinkRight', score: sc }] });
                mt.push({ data: matrizSimulada(sim.yaw, sim.pitch, sim.roll) });
              }
              return { faceLandmarks: faces, faceBlendshapes: bs, facialTransformationMatrixes: mt };
            },
            async descritor() {
              await esperar(140 + Math.random() * 80);
              if (sim.semDescritor) return null;
              return descritorSimulado(sim.pessoa, S.estado === 'cadastro-coleta' ? 0.2 : 0.14);
            },
            fechar() { /* nada para liberar */ }
          });
          return;
        }
        setTimeout(passo, 60);
      };
      passo();
    });
  }
  function helloSimulado() {
    const cerimonia = async () => {
      await esperar(900);
      if (sim.hello.resultado === 'cancelado') { const e = new Error('Cancelado na janela do Windows (simulado).'); e.name = 'NotAllowedError'; throw e; }
      if (sim.hello.resultado === 'falha') { const e = new Error('Falhou (simulado).'); e.name = 'UnknownError'; throw e; }
      return { id: 'sim-cred', rawId: 'sim-cred', type: 'public-key', authenticatorAttachment: 'platform', clientExtensionResults: {}, response: { clientDataJSON: 'c2ltdWxhZG8', attestationObject: 'c2ltdWxhZG8', authenticatorData: 'c2ltdWxhZG8', signature: 'c2ltdWxhZG8' } };
    };
    return { platformAuthenticatorIsAvailable: async () => !!sim.hello.disponivel, startRegistration: cerimonia, startAuthentication: cerimonia };
  }

  /* ---------- API ---------- */
  const api = {
    consultar, abrir, recadastrar, apagarCadastro, cadastrarHello, travar, fechar, destruir,
    aberto: () => S.aberto,
    get estado() { return S.estado; }
  };
  // teste local (localhost com ?debug): window.__rosto (no app normal nunca liga)
  if (debug) {
    const ganchos = {
      portao: api,
      // simulado: troca o que a "câmera" mostra ({rosto, n, largura, x, y, yaw, pitch, roll, piscar, olhoBase, luz, pessoa})
      quadro(o = {}) { if (!sim) return null; for (const k of Object.keys(o)) if (k in sim && k !== 'agenda') sim[k] = o[k]; if ('piscar' in o) sim.piscarManual = o.piscar; return { ...sim, agenda: undefined, foto: !!sim.foto }; },
      descritor: (semente = 1) => vetorPessoa(semente),
      auto(v = true) { if (sim) sim.auto = !!v; },
      camera(modo = 'ok') { if (sim) sim.camera = modo; },
      hello(o = {}) { if (sim) Object.assign(sim.hello, o); return sim && { ...sim.hello }; },
      piscar() { if (sim) sim.agenda.push(agora()); },
      falharLibs(v = true) { if (sim) sim.falharLibs = !!v; },
      semDescritor(v = true) { if (sim) sim.semDescritor = !!v; },
      async foto(url) {
        if (!sim) return false;
        const i = new Image(); i.crossOrigin = 'anonymous'; i.src = url; await i.decode();
        sim.foto = i; sim.fonte = 'foto'; return { largura: i.naturalWidth, altura: i.naturalHeight };
      },
      fonte(f) { if (sim) sim.fonte = f; },
      estado() {
        const v = S.vista;
        return {
          estado: S.estado, aberto: S.aberto, camera: S.cam.ligada, video: el ? !!el.video.srcObject : false, libs: S.libs ? (S.libs.real ? 'real' : 'simulado') : null,
          rostos: v.rostos, largura: +(v.largura || 0).toFixed(3), yaw: +(v.yaw || 0).toFixed(1), pitch: +(v.pitch || 0).toFixed(1), luz: Number.isFinite(v.luz) ? Math.round(v.luz) : null,
          movimento: Number.isFinite(v.movimento) ? +v.movimento.toFixed(4) : null, b: Number.isFinite(v.b) ? +v.b.toFixed(3) : null, base: S.piscar && S.piscar.base != null ? +S.piscar.base.toFixed(3) : null,
          qualidade: v.qual, piscadas: S.janela ? S.janela.lista.length : null, pedidas: S.janela ? S.janela.n : null, fps: Math.round(S.fps.v), status: el ? el.status.textContent : null, dica: el ? el.dica.textContent : null,
          botoes: el ? [...el.p.querySelectorAll('button[data-id]')].map((b) => b.textContent) : [], tom: A.tom, lente: +A.k.toFixed(3), distancia: S.ultimaDist,
          parado: el ? el.parado.width : 0, tela: S.cam.tela ? S.cam.tela.width : 0
        };
      },
      // a carga de verdade (MediaPipe + face-api) sem câmera: só tempos e o formato, nada de rosto
      async carregarReal() {
        const t0 = agora(); const sessao = new AbortController();
        const l = await carregarReal(() => {}, sessao.signal);
        const t1 = agora();
        const c = document.createElement('canvas'); c.width = 640; c.height = 480;
        const r = l.detectar(c, agora());
        const d = await l.descritor(c);
        l.fechar(); c.width = 0;
        return { ms: Math.round(t1 - t0), rostos_no_vazio: r.faceLandmarks.length, descritor_no_vazio: d ? d.length : null };
      },
      // roda a análise de verdade numa imagem de amostra da biblioteca (não é rosto de ninguém daqui): só números
      async analisarImagem(url) {
        const l = await carregarReal(() => {}, new AbortController().signal);
        const i = new Image(); i.crossOrigin = 'anonymous'; i.src = url; await i.decode();
        const c = document.createElement('canvas'); c.width = 640; c.height = Math.round(640 * i.naturalHeight / i.naturalWidth);
        c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
        const t = agora(), res = l.detectar(c, agora()), ms = agora() - t;
        const p = res.faceLandmarks[0];
        const out = { rostos: res.faceLandmarks.length, ms_malha: Math.round(ms) };
        if (p) {
          const bx = caixaDosPontos(p), m = res.facialTransformationMatrixes[0].data, a = angulosDaMatriz(m);
          const cats = res.faceBlendshapes[0].categories, bl = cats.filter((k) => /eyeBlink/.test(k.categoryName)).map((k) => +k.score.toFixed(2));
          Object.assign(out, { pontos: p.length, largura: +bx.w.toFixed(3), yaw: +a.yaw.toFixed(1), pitch: +a.pitch.toFixed(1), roll: +a.roll.toFixed(1), piscar: bl, ear: +earDosPontos(p, c.width, c.height).toFixed(3) });
        }
        const t2 = agora(), d = await l.descritor(c);
        out.ms_descritor = Math.round(agora() - t2);
        out.descritor = d ? { n: d.length, norma: +Math.sqrt(Array.from(d).reduce((s, x) => s + x * x, 0)).toFixed(3) } : null;
        l.fechar(); c.width = 0;
        return out;
      }
    };
    try { window.__rosto = ganchos; } catch { /* nada */ }
    api._teste = ganchos;
  }
  return api;
}
// o pedido chama de criarRosto; a especificação (§6.1), de criarPortao: os dois nomes valem
export { criarPortao as criarRosto };
