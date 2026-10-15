/* =============================================================================
   Cérebro da Lube — js/robo.js  (agente ROBÔ)
   Cabeça do robô em Three.js 0.160.0: capacete branco, visor com expressões
   desenhadas em canvas, logo da Lube em relevo, orelhas com anel luminoso,
   cúpula de vidro com os neurônios (as notas do vault), anel de rotinas,
   satélites de aplicações, boot ("ligar") e o "puxar da mente".
   API: criarRobo(canvas, opts) -> Robo   (ver CONTRATO.md §5)
   ============================================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ---------- Cores (copiadas dos tokens do §3; os derivados dizem de qual token saem) ---------- */
const COR = {
  // tokens
  bg: '#050b1c', surface: '#0d1830', line: '#1f3463', ink: '#e8eeff',
  holo: '#45d4ff', azul: '#2a41c8', vermelho: '#e5202c',
  logoAzul: '#16218A', logoVermelho: '#F20D1F',
  skill: '#3DA9FF', rotina: '#FF2D46', app: '#9EB2FF', core: '#F20D1F',
  alerta: '#ff6b74', novo: '#5fb2ff', rever: '#ffb340',   // --rever: tom âmbar da cúpula (saúde em atenção)
  // neutros de luz (branco puro e preto puro: camadas de brilho, máscaras, texturas em tons de cinza)
  luz: '#ffffff', preto: '#000000',
  // robô
  branco: '#f2f5fb',        // capacete e corpo: --ink clareado (branco envernizado da referência)
  metal: '#161e33',         // pescoço, aro, hastes: --surface com brilho metálico
  escuro: '#070c18',        // miolo das orelhas, anéis do pescoço: --bg escurecido
  visor: '#02050d',         // tela do visor: --bg quase preto
  ranhura: '#0d1426',       // ranhuras e vedação: --surface
  anelOrelha: '#06131f',    // base do anel luminoso da orelha (a luz vem do emissivo --holo)
  chaoCupula: '#040915',    // disco no fundo da cúpula: --bg escurecido
  contorno: '#3f8cff',      // luz de contorno do boot: entre --azul e --holo
  vidroBorda: '#3fb4ff',    // borda fresnel do vidro: --holo mais azul
  vidroReflexo: '#dff4ff',  // reflexo de janela no vidro: --holo bem claro
  flashVisor: '#bff0ff',    // flash da faísca no visor: --holo bem claro
  satCorpo: '#141d36',      // corpo dos satélites: --surface metálico
  satFace: '#0b1530',       // face hexagonal da sigla: --surface escurecido
  painelSolar: '#0d1f55', painelSolarFundo: '#0a1a4a', painelSolarLinha: '#4f86ff',   // painéis dos satélites: --azul
  // luzes e ambiente
  luzCeu: '#9cc0ff', luzChao: '#081028', luzContraE: '#3b6cff', luzContraD: '#45d4ff',   // --azul / --holo
  reflexoAzul: '#2a5cff', reflexoChao: '#1a3aa8',                                         // painéis do PMREM: --azul
  // fundo do laboratório (texturas em canvas)
  fundo1: '#10275e', fundo2: '#0b1b45', fundo3: '#07112a',   // degradê de --azul escurecido até --bg
  aura: '#1f55ff',          // brilho atrás da cabeça: --azul
  trilha: '#4a8cff', trilhaPad: '#6eb4ff', trilhaLuz: '#8cc8ff',   // trilhas de circuito: --azul clareado
  ledVermelho: '#ff3c50', ledAzul: '#5ac8ff',                    // LEDs: --vermelho / --holo
  painelUi: '#5096ff', painelUiFundo: '#285ac8',                 // cartões de UI desfocados: --azul
  discoPonto: '#78e6ff', discoCentro: '#a0ebff',                 // disco de circuito da cúpula: --holo clareado
  poeira: '#6fb6ff',        // poeira no ar: --novo
  pontoVisor: '#306ec8', linhaVisor: '#285aaa',                  // padrão de pontos e linhas do visor: --azul
};
/** 'rgba(r,g,b,a)' de uma cor hexadecimal do COR (texturas em canvas). */
function rgba(hex, a) { const v = parseInt(hex.slice(1), 16); return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${a})`; }
const PALETA = ['#3DA9FF', '#FF4D63', '#8E7CFF', '#35E3FF', '#F1F5FF', '#5B7BFF', '#FF94A8', '#2DD4BF', '#B9C7FF', '#FFC24D', '#7FD8FF', '#C98BFF'];
const EXPRESSOES = ['neutro', 'feliz', 'piscar', 'surpreso', 'pensando', 'lendo', 'procurando', 'alerta', 'preocupado', 'dormindo', 'boot'];

/* ---------- Geometria da cabeça (unidades: raio do capacete = 1) ---------- */
const DEG = Math.PI / 180;
const ESC = new THREE.Vector3(1.13, 1.0, 1.03);   // capacete levemente achatado (mais largo que alto)
const CORTE = 0.42;                               // plano da cúpula a 0,42 do centro
const INCL = 14 * DEG;                            // cúpula inclinada para trás
const TETA_C = Math.acos(CORTE);
const RAIO_CORTE = Math.sqrt(1 - CORTE * CORTE);  // raio do círculo de corte (0,866)
const DOMO_ALT = 1.36;                            // topo da cúpula ao longo do eixo
const DOMO_C = (DOMO_ALT * DOMO_ALT - 1) / (2 * (DOMO_ALT - CORTE)); // centro da esfera da cúpula
const DOMO_R = DOMO_ALT - DOMO_C;                 // raio da esfera da cúpula
const DOMO_TETA = Math.acos((CORTE - DOMO_C) / DOMO_R);
const VIS = { a: 52 * DEG, b0: 13 * DEG, b1: -50 * DEG, n: 4.2 }; // visor: meia-largura, topo, base, "squircle"
VIS.bm = (VIS.b0 + VIS.b1) / 2; VIS.bh = (VIS.b0 - VIS.b1) / 2;
const ASPECTO_VISOR = (2 * VIS.a * Math.cos(VIS.bm) * ESC.x) / (2 * VIS.bh);
const LOGO_ALT = 0.31, LOGO_BETA = 26 * DEG;
const PIVO_Y = -0.92;                             // pescoço: ponto de giro da cabeça
const R_HALO = 1.95, R_SAT = 2.45;
const YAW_MAX = 28 * DEG, PITCH_MAX = 16 * DEG;

/* ---------- Utilidades ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const amortecer = (atual, alvo, taxa, dt) => lerp(atual, alvo, 1 - Math.exp(-taxa * dt));
const entraSai = e => e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
const sai = e => 1 - Math.pow(1 - e, 3);
const saiVolta = e => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(e - 1, 3) + c1 * Math.pow(e - 1, 2); };
const agora = () => performance.now();
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SIGLAS = { winthor: 'WT', supabase: 'SB', vercel: 'VC', oracle: 'OR', obsidian: 'OB', claude: 'CL', locaweb: 'LW', github: 'GH', python: 'PY', 'power bi': 'PB', powerbi: 'PB', telegram: 'TG', outlook: 'OL', excel: 'XL', clickup: 'CU', slack: 'SL', canva: 'CV', figma: 'FG', cloudflare: 'CF', gmail: 'GM', whatsapp: 'WA' };
function sigla(nome) {
  const k = norm(nome).trim(); if (SIGLAS[k]) return SIGLAS[k];
  const limpo = String(nome || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
  const caps = limpo.match(/\p{Lu}/gu) || [];
  if (!/\s/.test(limpo) && caps.length >= 2) return (caps[0] + caps[1]).toUpperCase();
  const w = limpo.split(/\s+/).filter(x => x && !/^(de|da|do|das|dos|e|a|o|em|para)$/i.test(x));
  if (!w.length) return '?';
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}
function corHex(hex) { return new THREE.Color(hex); }
function rgbDe(hex) { const v = parseInt(hex.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
function dirEsfera(alfa, beta, alvo = new THREE.Vector3()) { return alvo.set(Math.sin(alfa) * Math.cos(beta), Math.sin(beta), Math.cos(alfa) * Math.cos(beta)); }
function corDoNo(n) {
  if (!n) return COR.ink;
  if (n.kind === 'core') return COR.core; if (n.kind === 'skill') return COR.skill;
  if (n.kind === 'routine') return COR.rotina; if (n.kind === 'app') return COR.app;
  return PALETA[(n.ci || 0) % PALETA.length];
}
function novoCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texCanvas(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
function retArred(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ---------- Texturas geradas em código ---------- */
function texBrilho(tam = 256) {
  const c = novoCanvas(tam, tam), g = c.getContext('2d');
  const grd = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  grd.addColorStop(0, rgba(COR.luz, 1)); grd.addColorStop(0.18, rgba(COR.luz, 0.75));
  grd.addColorStop(0.45, rgba(COR.luz, 0.18)); grd.addColorStop(1, rgba(COR.luz, 0));
  g.fillStyle = grd; g.fillRect(0, 0, tam, tam);
  return texCanvas(c);
}
function texNevoa(tam = 256) {
  const c = novoCanvas(tam, tam), g = c.getContext('2d');
  const grd = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  grd.addColorStop(0, rgba(COR.luz, 0.9)); grd.addColorStop(0.35, rgba(COR.luz, 0.35)); grd.addColorStop(1, rgba(COR.luz, 0));
  g.fillStyle = grd; g.fillRect(0, 0, tam, tam);
  return texCanvas(c);
}
/* Fundo: laboratório azul-marinho com trilhas de circuito sutis */
function texCircuitos(W = 2048, H = 1024) {
  const c = novoCanvas(W, H), g = c.getContext('2d');
  const r = rng(20261009);
  const grd = g.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, W * 0.62);
  grd.addColorStop(0, COR.fundo1); grd.addColorStop(0.22, COR.fundo2); grd.addColorStop(0.55, COR.fundo3); grd.addColorStop(1, COR.bg);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const passo = 32, dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  g.lineCap = 'round'; g.lineJoin = 'round';
  const pads = [];
  for (let k = 0; k < 230; k++) {
    let x = Math.round(r() * W / passo) * passo, y = Math.round(r() * H / passo) * passo;
    const dx0 = (x - W / 2) / (W / 2), dy0 = (y - H * 0.46) / (H / 2);
    const dc = Math.hypot(dx0 * 1.1, dy0 * 1.5);
    if (dc < 0.34 && r() < 0.8) continue;                // pouco circuito atrás da cabeça
    let d = Math.floor(r() * 4) * 2;
    const a = clamp(0.05 + 0.20 * Math.min(1, dc) * (dc > 1.05 ? 0.5 : 1), 0, 0.26);
    g.strokeStyle = rgba(COR.trilha, a); g.lineWidth = r() < 0.2 ? 3 : 2;
    g.beginPath(); g.moveTo(x, y);
    const n = 3 + Math.floor(r() * 8);
    for (let s = 0; s < n; s++) {
      const len = passo * (1 + Math.floor(r() * 4));
      if (r() < 0.35) d = (d + (r() < 0.5 ? 1 : 7)) % 8;
      x += dirs[d][0] * len; y += dirs[d][1] * len; g.lineTo(x, y);
    }
    g.stroke();
    pads.push([x, y, a]);
  }
  for (const [x, y, a] of pads) {
    g.strokeStyle = rgba(COR.trilhaPad, a * 1.6); g.lineWidth = 2; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.stroke();
    g.fillStyle = rgba(COR.trilhaLuz, a * 1.8); g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
  }
  // LEDs (poucos, como na referência)
  for (let k = 0; k < 26; k++) {
    const x = r() * W, y = r() * H; if (Math.hypot((x - W / 2) / W, (y - H / 2) / H) < 0.2) continue;
    const red = r() < 0.4, rad = 10 + r() * 12;
    const gg = g.createRadialGradient(x, y, 0, x, y, rad);
    gg.addColorStop(0, red ? rgba(COR.ledVermelho, 0.55) : rgba(COR.ledAzul, 0.5)); gg.addColorStop(1, rgba(COR.preto, 0));
    g.fillStyle = gg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // painéis (cartões de UI desfocados, bem sutis)
  for (let k = 0; k < 10; k++) {
    const w = 120 + r() * 160, h = 90 + r() * 120, x = r() < 0.5 ? r() * W * 0.26 : W * 0.74 + r() * W * 0.22, y = H * 0.12 + r() * H * 0.7;
    g.strokeStyle = rgba(COR.painelUi, 0.10); g.lineWidth = 2; retArred(g, x, y, w, h, 14); g.stroke();
    g.fillStyle = rgba(COR.painelUiFundo, 0.035); g.fill();
  }
  // vinheta
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, rgba(COR.bg, 0)); vg.addColorStop(1, rgba(COR.bg, 0.92));
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const t = texCanvas(c); t.anisotropy = 4; return t;
}
/* Anéis de HUD atrás da cabeça */
function texAnelHud(tam, tipo) {
  const c = novoCanvas(tam, tam), g = c.getContext('2d'), m = tam / 2;
  g.translate(m, m); g.strokeStyle = COR.luz; g.fillStyle = COR.luz; g.lineCap = 'butt';
  if (tipo === 0) {
    g.globalAlpha = 0.9; g.lineWidth = tam * 0.012;
    const n = 72; for (let i = 0; i < n; i++) { if (i % 9 === 8) continue; const a0 = i / n * Math.PI * 2, a1 = a0 + Math.PI * 2 / n * 0.55; g.beginPath(); g.arc(0, 0, m * 0.93, a0, a1); g.stroke(); }
    g.globalAlpha = 0.35; g.lineWidth = tam * 0.003; g.beginPath(); g.arc(0, 0, m * 0.86, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.8; g.lineWidth = tam * 0.02;
    for (const [a, l] of [[-0.95, 0.5], [2.05, 0.42], [0.55, 0.18], [3.9, 0.22]]) { g.beginPath(); g.arc(0, 0, m * 0.80, a, a + l); g.stroke(); }
  } else {
    g.globalAlpha = 0.7; g.lineWidth = tam * 0.004;
    for (let i = 0; i < 180; i++) { const a = i / 180 * Math.PI * 2, l = i % 15 === 0 ? 0.06 : 0.025; g.beginPath(); g.moveTo(Math.cos(a) * m * 0.97, Math.sin(a) * m * 0.97); g.lineTo(Math.cos(a) * m * (0.97 - l), Math.sin(a) * m * (0.97 - l)); g.stroke(); }
    g.globalAlpha = 0.5; g.lineWidth = tam * 0.006;
    for (const [a, l] of [[0.2, 1.1], [3.4, 0.9]]) { g.beginPath(); g.arc(0, 0, m * 0.9, a, a + l); g.stroke(); }
  }
  return texCanvas(c);
}
/* Disco de circuito no "chão" da cúpula */
function texDisco(tam = 512) {
  const c = novoCanvas(tam, tam), g = c.getContext('2d'), m = tam / 2;
  g.fillStyle = COR.preto; g.fillRect(0, 0, tam, tam); g.translate(m, m);
  const r = rng(77);
  g.lineCap = 'round';
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2 + r() * 0.03, r0 = m * (0.16 + r() * 0.1), r1 = m * (0.55 + r() * 0.38);
    g.strokeStyle = rgba(COR.holo, 0.18 + r() * 0.28); g.lineWidth = 1.5 + r() * 1.5;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    const am = a + (r() - 0.5) * 0.18, rm = lerp(r0, r1, 0.5);
    g.lineTo(Math.cos(a) * rm, Math.sin(a) * rm); g.lineTo(Math.cos(am) * r1, Math.sin(am) * r1); g.stroke();
    g.fillStyle = rgba(COR.discoPonto, 0.7); g.beginPath(); g.arc(Math.cos(am) * r1, Math.sin(am) * r1, 2.6, 0, Math.PI * 2); g.fill();
  }
  for (const [rr, a, w] of [[0.97, 0.55, 3], [0.74, 0.3, 2], [0.5, 0.35, 2], [0.24, 0.6, 3]]) {
    g.strokeStyle = rgba(COR.holo, a); g.lineWidth = w; g.setLineDash([10, 7]); g.beginPath(); g.arc(0, 0, m * rr, 0, Math.PI * 2); g.stroke();
  }
  g.setLineDash([]);
  const gc = g.createRadialGradient(0, 0, 0, 0, 0, m * 0.3);
  gc.addColorStop(0, rgba(COR.discoCentro, 0.9)); gc.addColorStop(0.4, rgba(COR.holo, 0.35)); gc.addColorStop(1, rgba(COR.holo, 0));
  g.fillStyle = gc; g.beginPath(); g.arc(0, 0, m * 0.3, 0, Math.PI * 2); g.fill();
  return texCanvas(c);
}
/* Reflexo "de janela" no vidro da cúpula: duas faixas suaves */
function texReflexoVidro(W = 256, H = 128) {
  const c = novoCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / (W - 1), v = y / (H - 1);
    const ax = Math.pow(Math.sin(Math.PI * u), 1.6);
    const b1 = Math.exp(-Math.pow((v - 0.36) / 0.13, 2)), b2 = 0.55 * Math.exp(-Math.pow((v - 0.72) / 0.05, 2));
    const a = clamp(ax * (b1 + b2)) * 255, i = (y * W + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a;
  }
  g.putImageData(img, 0, 0); return texCanvas(c);
}
function texSigla(txt) {
  const c = novoCanvas(256, 256), g = c.getContext('2d');
  g.translate(128, 128);
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(Math.cos(a) * 120, Math.sin(a) * 120); } g.closePath();
  g.fillStyle = COR.satFace; g.fill(); g.lineWidth = 9; g.strokeStyle = COR.app; g.stroke();
  g.fillStyle = COR.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 ${txt.length > 2 ? 70 : 92}px "JetBrains Mono", Consolas, ui-monospace, monospace`;
  g.fillText(txt, 0, 6);
  const t = texCanvas(c); t.anisotropy = 4; return t;
}
function texPainelSolar() {
  const c = novoCanvas(128, 48), g = c.getContext('2d');
  g.fillStyle = COR.painelSolarFundo; g.fillRect(0, 0, 128, 48);
  g.strokeStyle = COR.painelSolarLinha; g.lineWidth = 2;
  for (let x = 0; x <= 128; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 48); g.stroke(); }
  for (let y = 0; y <= 48; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  return texCanvas(c);
}

/* ---------- Geometrias auxiliares ---------- */
// Mapeia o quadrado [-1,1]² no "squircle" |x|^n + |y|^n = 1 (bordas exatas, interior proporcional)
function quadParaSquircle(sx, sy, n) {
  const m = Math.max(Math.abs(sx), Math.abs(sy)); if (m < 1e-6) return [0, 0];
  const qx = sx / m, qy = sy / m;
  const k = Math.pow(Math.pow(Math.abs(qx), n) + Math.pow(Math.abs(qy), n), -1 / n);
  return [qx * k * m, qy * k * m];
}
function geoVisor(segU = 80, segV = 48, raio = 1.012) {
  const pos = [], uv = [], idx = [], d = new THREE.Vector3();
  for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) {
    const [px, py] = quadParaSquircle(i / segU * 2 - 1, j / segV * 2 - 1, VIS.n);
    dirEsfera(px * VIS.a, VIS.bm + py * VIS.bh, d);
    const r = raio + 0.010 * (1 - Math.min(1, (px * px + py * py) * 0.55));
    pos.push(d.x * r, d.y * r, d.z * r); uv.push((px + 1) / 2, (py + 1) / 2);
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * (segU + 1) + i, b = a + 1, c2 = a + segU + 2, d2 = a + segU + 1;
    idx.push(a, b, d2, b, c2, d2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function curvaVisor(escala = 1, raio = 1.016) {
  const pts = [], n = VIS.n;
  for (let k = 0; k < 240; k++) {
    const th = k / 240 * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * escala, y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * escala;
    pts.push(dirEsfera(x * VIS.a, VIS.bm + y * VIS.bh).multiplyScalar(raio));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}
/* Faixa em relevo sobre a esfera unitária: fnDir(t) devolve a direção no ponto t∈[0,1] */
function geoFaixa(fnDir, largura, raio, alt = 0.008, seg = 96, fechada = false) {
  const pos = [], idx = [];
  const d = new THREE.Vector3(), d1 = new THREE.Vector3(), d2 = new THREE.Vector3(), tg = new THREE.Vector3(), lado = new THREE.Vector3();
  const linhas = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg; fnDir(t, d); d.normalize();
    fnDir(Math.min(1, t + 0.002), d1); fnDir(Math.max(0, t - 0.002), d2);
    if (fechada) { fnDir((t + 0.002) % 1, d1); fnDir((t - 0.002 + 1) % 1, d2); }
    tg.subVectors(d1, d2).normalize(); lado.crossVectors(d, tg).normalize();
    let w = largura / 2;
    if (!fechada) { const ponta = Math.min(t, 1 - t) / 0.06; if (ponta < 1) w *= Math.sqrt(Math.max(0.05, ponta)); }
    const e = d.clone().addScaledVector(lado, w).normalize(), f = d.clone().addScaledVector(lado, -w).normalize();
    linhas.push([e.clone().multiplyScalar(raio + alt), f.clone().multiplyScalar(raio + alt), e.multiplyScalar(raio - 0.004), f.multiplyScalar(raio - 0.004)]);
  }
  for (const L of linhas) for (const p of L) pos.push(p.x, p.y, p.z);
  const N = linhas.length;
  for (let i = 0; i < N - 1; i++) {
    const a = i * 4, b = (i + 1) * 4;
    idx.push(a, b, a + 1, a + 1, b, b + 1);         // topo
    idx.push(a + 2, b + 2, a, a, b + 2, b);         // lado e
    idx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); // lado f
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const gn = g.toNonIndexed(); gn.computeVertexNormals(); g.dispose(); return gn;
}
/* Subdivisão por ponto médio (geometria não indexada) — para dobrar a logo sobre a testa */
function subdividir(geo, niveis) {
  const base = geo.index ? geo.toNonIndexed() : geo;
  let p = base.attributes.position.array;
  for (let l = 0; l < niveis; l++) {
    const n = p.length / 9, out = new Float32Array(n * 36); let o = 0;
    for (let t = 0; t < n; t++) {
      const i = t * 9;
      const ax = p[i], ay = p[i + 1], az = p[i + 2], bx = p[i + 3], by = p[i + 4], bz = p[i + 5], cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];
      const abx = (ax + bx) / 2, aby = (ay + by) / 2, abz = (az + bz) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, bcz = (bz + cz) / 2, cax = (cx + ax) / 2, cay = (cy + ay) / 2, caz = (cz + az) / 2;
      const tri = [ax, ay, az, abx, aby, abz, cax, cay, caz, abx, aby, abz, bx, by, bz, bcx, bcy, bcz, cax, cay, caz, bcx, bcy, bcz, cx, cy, cz, abx, aby, abz, bcx, bcy, bcz, cax, cay, caz];
      for (let k = 0; k < 36; k++) out[o++] = tri[k];
    }
    p = out;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  if (base !== geo) base.dispose();
  return g;
}
function dobrarNaTesta(geo, raioBase) {
  const p = geo.attributes.position.array, d = new THREE.Vector3();
  // tampas (frente/fundo): os 3 vértices têm o mesmo z antes de dobrar → normal radial (suave)
  const tampa = new Int8Array(p.length / 9);
  let zMax = -Infinity; for (let i = 2; i < p.length; i += 3) zMax = Math.max(zMax, p[i]);
  for (let t = 0; t < tampa.length; t++) { const z0 = p[t * 9 + 2], z1 = p[t * 9 + 5], z2 = p[t * 9 + 8]; if (Math.abs(z0 - z1) < 1e-7 && Math.abs(z0 - z2) < 1e-7) tampa[t] = Math.abs(z0 - zMax) < 1e-6 ? 1 : -1; }
  for (let i = 0; i < p.length; i += 3) {
    const X = p[i], Y = p[i + 1], Z = p[i + 2];
    const beta = LOGO_BETA + Y;
    const alfa = Math.asin(clamp(X / (ESC.x * Math.cos(beta)), -0.95, 0.95));
    dirEsfera(alfa, beta, d); const r = raioBase + Z;
    p[i] = d.x * r; p[i + 1] = d.y * r; p[i + 2] = d.z * r;
  }
  geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
  const nr = geo.attributes.normal.array;
  for (let t = 0; t < tampa.length; t++) {
    if (!tampa[t]) continue;
    for (let k = 0; k < 3; k++) { const i = t * 9 + k * 3; d.set(p[i], p[i + 1], p[i + 2]).normalize().multiplyScalar(tampa[t]); nr[i] = d.x; nr[i + 1] = d.y; nr[i + 2] = d.z; }
  }
  geo.attributes.normal.needsUpdate = true; geo.computeBoundingSphere();
  return geo;
}
/* Caminhos da logo (viewBox 40 20 790 575), y invertido e centralizados */
function poligonosLogo() {
  const k = LOGO_ALT / 575, ox = 435, oy = 307.5;
  const P = (x, y) => [(x - ox) * k, -(y - oy) * k];
  const quad = (a, c, b, n = 16) => { const out = []; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } return out; };
  const L = [[165, 30], [400, 30], [295, 435], [740, 435], [705, 580], [230, 580], ...quad([230, 580], [48, 580], [72, 410])].map(([x, y]) => P(x, y));
  const R = [[430, 30], [650, 30], ...quad([650, 30], [822, 34], [795, 188]), [748, 410], [335, 410]].map(([x, y]) => P(x, y));
  return { L, R, k };
}
function deslocarPoligono(pts, dist) {
  let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1; const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    const e1 = [p1[0] - p0[0], p1[1] - p0[1]], e2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    const n1 = [s * e1[1] / l1, -s * e1[0] / l1], n2 = [s * e2[1] / l2, -s * e2[0] / l2];
    let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const cosv = Math.max(0.35, mx * n1[0] + my * n1[1]);
    out.push([p1[0] + mx * dist / cosv, p1[1] + my * dist / cosv]);
  }
  return out;
}
function formaDe(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }

/* ---------- Shaders ---------- */
const VERT_NEURONIO = /* glsl */`
  attribute float aTam; attribute float aAlfa; attribute float aAtraso; attribute float aFase; attribute float aNovo; attribute float aHi; attribute float aForma;
  uniform float uTempo; uniform float uBoot; uniform float uEscala; uniform float uDeriva; uniform float uReduz;
  // campo da mão (modo Mãos): cursor em px do buffer (y para cima), raio e deslocamento máximo em px, força
  // > 0 afasta (cursor), < 0 puxa para o cursor (pinça), 0 desliga; uTela = tamanho do buffer em px
  uniform vec2 uMao; uniform float uMaoRaio; uniform float uMaoForca; uniform float uMaoDesloc; uniform vec2 uTela;
  varying vec3 vCor; varying float vAlfa; varying float vHi; varying float vForma;
  void main(){
    vec3 p = position + uDeriva * 0.008 * vec3(sin(uTempo*0.8 + aFase), cos(uTempo*0.95 + aFase*1.7), sin(uTempo*0.7 + aFase*2.3));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float campo = 0.0;
    if (uMaoForca != 0.0) {
      vec4 cl = projectionMatrix * mv;
      vec2 dd = (cl.xy / cl.w * 0.5 + 0.5) * uTela - uMao;
      float d = length(dd);
      float k = uMaoForca * exp(-(d * d) / max(1.0, uMaoRaio * uMaoRaio));
      vec2 dir = d > 0.5 ? dd / d : vec2(0.0);
      // afastar: até uMaoDesloc px; puxar: nunca passa do cursor (no máximo 85% da distância)
      float mag = k > 0.0 ? k * uMaoDesloc : max(k * uMaoDesloc, -d * 0.85);
      // o neurônio em foco (hover, nota aberta: aHi ≥ ~1) não foge: fica debaixo do cursor para a pinça abrir
      mag *= 1.0 - smoothstep(0.85, 1.0, aHi);
      mv.xy += dir * mag * (1.0 - uReduz) * (-mv.z) / uEscala;   // px de tela → unidades na profundidade do ponto
      campo = abs(k);
    }
    float liga = smoothstep(aAtraso, aAtraso + 0.10, uBoot);
    float flash = liga * (1.0 - smoothstep(aAtraso + 0.10, aAtraso + 0.42, uBoot));
    float pisca = aNovo * mix(0.5 + 0.5 * sin(uTempo * 6.5 + aFase), 0.6, uReduz);   // movimento reduzido: aceso fixo, sem piscar
    float s = aTam * (1.0 + 0.55 * aHi + 0.7 * flash + 0.7 * pisca + 0.6 * campo);
    gl_PointSize = clamp(s * uEscala / -mv.z, 1.5, 128.0);
    gl_Position = projectionMatrix * mv;
    // perto da mão o neurônio esmaecido (destaque) volta a aparecer; o escondido pelo filtro (alfa 0) continua apagado
    float alfa = aAlfa > 0.02 ? max(aAlfa, campo * 0.85) : aAlfa;
    vCor = color; vAlfa = alfa * liga; vHi = aHi + 0.8 * flash + pisca + 0.9 * campo; vForma = aForma;
  }`;
const FRAG_NEURONIO = /* glsl */`
  uniform float uBrilho; varying vec3 vCor; varying float vAlfa; varying float vHi; varying float vForma;
  void main(){
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = length(c);
    if (d > 1.0) discard;
    float halo = pow(1.0 - d, 3.4) * 0.8;
    float nucleo = smoothstep(0.24, 0.05, d);
    float estrela = 0.0;
    if (vForma > 0.5) {
      float ax = abs(c.x), ay = abs(c.y);
      estrela = max(smoothstep(0.10, 0.0, ay) * (1.0 - ax), smoothstep(0.10, 0.0, ax) * (1.0 - ay));
      estrela += 0.5 * max(smoothstep(0.07, 0.0, abs(c.x - c.y)) , smoothstep(0.07, 0.0, abs(c.x + c.y))) * (1.0 - d * 1.4);
    }
    vec3 col = vCor * (halo * 0.9 + nucleo * 1.35 + estrela * 1.8) + vec3(1.0) * (nucleo * (0.1 + 0.8 * vHi) + estrela * 0.9);
    col *= vAlfa * (1.0 + 0.45 * vHi) * uBrilho;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const VERT_LINHA = /* glsl */`
  attribute float aAlfa; varying vec3 vCor; varying float vAlfa;
  void main(){ vCor = color; vAlfa = aAlfa; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG_LINHA = /* glsl */`
  uniform float uRevela; uniform float uOpac; varying vec3 vCor; varying float vAlfa;
  void main(){ gl_FragColor = vec4(vCor * vAlfa * uRevela * uOpac, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const VERT_PONTO = /* glsl */`
  attribute float aTam; attribute float aAlfa; uniform float uEscala; varying float vAlfa; varying vec3 vCor;
  void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aTam * uEscala / -mv.z, 1.0, 160.0); gl_Position = projectionMatrix * mv; vAlfa = aAlfa; vCor = color; }`;
const FRAG_PONTO = /* glsl */`
  varying float vAlfa; varying vec3 vCor;
  void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float d = length(c); if (d > 1.0) discard;
    float a = pow(1.0 - d, 2.2) + smoothstep(0.3, 0.0, d) * 0.9;
    gl_FragColor = vec4((vCor + vec3(smoothstep(0.35, 0.0, d))) * a * vAlfa, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const VERT_ANEL = /* glsl */`
  attribute float aIni; attribute vec3 color; uniform float uTempo; uniform float uEscala; uniform float uReduz; varying float vVida; varying float vFase; varying vec3 vCor;
  void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float idade = uTempo - aIni;
    vVida = (1.0 - clamp(idade / 20.0, 0.0, 1.0)) * step(0.0, idade); vFase = mix(fract(idade / 1.5), 0.35, uReduz); vCor = color;
    gl_PointSize = clamp(0.42 * uEscala / -mv.z, 2.0, 160.0); gl_Position = projectionMatrix * mv; }`;
const FRAG_ANEL = /* glsl */`
  varying float vVida; varying float vFase; varying vec3 vCor;
  void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float d = length(c); if (d > 1.0) discard;
    float r = 0.12 + vFase * 0.86; float anel = smoothstep(0.07, 0.0, abs(d - r)) * (1.0 - vFase);
    gl_FragColor = vec4((vCor * 1.6 + 0.4) * anel * vVida, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const VERT_FRESNEL = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying vec3 vPv;
  void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vPv = mv.xyz; vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FRAG_CONTORNO = /* glsl */`
  uniform vec3 uCor; uniform float uInt; uniform float uVarre; uniform vec3 uCentro;
  varying vec3 vN; varying vec3 vV; varying vec3 vPv;
  void main(){
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float aro = pow(f, 3.2);                       // luz só na borda da silhueta
    vec2 q = vPv.xy - uCentro.xy;
    float ang = fract(atan(q.x, q.y) / 6.2831853 + 1.0);   // 0 no topo, sentido horário
    float rev = 1.0 - smoothstep(uVarre - 0.02, uVarre, ang);
    float ponta = smoothstep(0.05, 0.0, abs(ang - uVarre)) * step(uVarre, 0.999) * step(0.001, uVarre);
    float a = aro * (rev * uInt + ponta * 3.0);
    gl_FragColor = vec4(uCor * a, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const FRAG_BORDA_VIDRO = /* glsl */`
  uniform vec3 uCor; uniform float uInt; uniform float uPot;
  varying vec3 vN; varying vec3 vV; varying vec3 vPv;
  void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPot); gl_FragColor = vec4(uCor * f * uInt, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/* O canvas do rosto sobe como textura linear (rápido); estes ajustes decodificam sRGB no shader */
function decodificarSRGB(mat) {
  mat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
      vec4 sampledDiffuseColor = texture2D( map, vMapUv );
      sampledDiffuseColor.rgb = pow( sampledDiffuseColor.rgb, vec3( 2.2 ) );
      diffuseColor *= sampledDiffuseColor;
    #endif`);
  };
  mat.customProgramCacheKey = () => 'srgb-mapa';
  return mat;
}

/* =============================================================================
   Rosto (canvas usado como textura emissiva do visor)
   ============================================================================= */
const ROSTO_PADRAO = { capsula: 1, feliz: 0, redondo: 0, traco: 0, olhoH: 1, esc: 1, sorriso: 0.34, bocaL: 0.95, bocaO: 0, boca: 1, verm: 0, brilho: 1, varre: 0, pontos: 0, boot: 0, semi: 0, olhos: 1 };
const ROSTO_ALVOS = {
  neutro: {},
  feliz: { capsula: 0, feliz: 1, sorriso: 1, bocaL: 1.2 },
  surpreso: { capsula: 0, redondo: 1, esc: 1.08, sorriso: 0, bocaO: 1, bocaL: 0.8 },
  pensando: { olhoH: 0.82, sorriso: 0.06, bocaL: 0.55, pontos: 1 },
  lendo: { semi: 0.46, sorriso: 0.2, bocaL: 0.72 },
  procurando: { olhoH: 0.72, esc: 0.94, sorriso: 0.12, bocaL: 0.62, varre: 1 },
  alerta: { capsula: 0, traco: 1, verm: 1, sorriso: -0.42, bocaL: 0.62 },
  // saúde em atenção (Guardião): olhos um pouco fechados e boca levemente para baixo, sem o vermelho do alerta
  preocupado: { olhoH: 0.8, esc: 0.95, sorriso: -0.2, bocaL: 0.58 },
  dormindo: { capsula: 0, traco: 1, brilho: 0.3, boca: 0, sorriso: 0 },
  boot: { olhos: 0, boca: 0, boot: 1, brilho: 1, capsula: 0 },
  apagado: { olhos: 0, boca: 0, brilho: 0, capsula: 0 },
};
function criarRosto(largura, reduzidoFn = () => false) {
  const CW = largura, CH = Math.round(CW / ASPECTO_VISOR);
  const cv = novoCanvas(CW, CH), g = cv.getContext('2d');
  // textura "linear" de propósito: enviar canvas para textura sRGB força um caminho lento (~12 ms/quadro);
  // a conversão sRGB→linear é feita no shader do visor (decodificarSRGB)
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.anisotropy = 4;
  // padrão de pontos + linhas de varredura (fixo)
  const padrao = novoCanvas(CW, CH), gp = padrao.getContext('2d');
  const passo = Math.max(8, Math.round(CW / 92));
  for (let y = passo / 2; y < CH; y += passo) for (let x = passo / 2; x < CW; x += passo) {
    const dx = (x / CW - 0.5) * 2, dy = (y / CH - 0.45) * 2, v = Math.max(0, 1 - Math.hypot(dx * 0.8, dy));
    gp.fillStyle = rgba(COR.pontoVisor, 0.10 + 0.32 * v); gp.beginPath(); gp.arc(x, y, passo * 0.13, 0, Math.PI * 2); gp.fill();
  }
  gp.fillStyle = rgba(COR.linhaVisor, 0.10); for (let y = 0; y < CH; y += 4) gp.fillRect(0, y, CW, 1);
  // ponto: modo Jarvis (JARVIS.md §7.5) — 0 = rosto normal; 0→0,5 os olhos achatam; 0,5→1 viram um ponto de luz no meio
  const P = { ...ROSTO_PADRAO, ...ROSTO_ALVOS.apagado, abre: 1, prog: 0, scanOn: 1, flash: 0, gx: 0, gy: 0, ponto: 0 };
  let T = { ...ROSTO_PADRAO, ...ROSTO_ALVOS.apagado };
  let nome = 'apagado', pisca = -1, abrindo = -1, textoBoot = 'carregando memórias', forcar = true;
  const HOLO = rgbDe(COR.holo), VERM = rgbDe(COR.alerta);   // alerta do visor = mesmo tom do aviso de alerta do HUD
  const EX = 0.255 * CW, EY = 0.50 * CH, MY = 0.745 * CH;
  let glow = CW * 0.028;
  function alvo(n) { nome = n; T = { ...ROSTO_PADRAO, ...(ROSTO_ALVOS[n] || {}) }; }
  function piscar() { if (pisca < 0 && abrindo < 0) pisca = 0; }
  // olhos que acabam de ligar: começam fechados e abrem com easing (passo 3 do boot)
  function abrirOlhos() { abrindo = 0; pisca = -1; }
  // estado desenhado por último (comparação numérica, sem montar string a cada quadro)
  const CHAVES = Object.keys(P), ultimo = new Float32Array(CHAVES.length).fill(NaN);
  function mudouDesde() { let m = false; for (let i = 0; i < CHAVES.length; i++) { const v = Math.round(P[CHAVES[i]] * 400); if (v !== ultimo[i]) { ultimo[i] = v; m = true; } } return m; }
  function atualizar(dt, t, gaze) {
    const red = reduzidoFn();
    if (red) t = 0;                              // movimento reduzido: varredura e pontinhos parados
    const k = 1 - Math.exp(-dt * 11), kb = 1 - Math.exp(-dt * 6);
    for (const c in T) P[c] = lerp(P[c], T[c], c === 'brilho' ? kb : k);
    if (abrindo >= 0) { abrindo += dt / 0.24; if (abrindo >= 1) abrindo = -1; }
    if (pisca >= 0) { pisca += dt / 0.17; if (pisca >= 1) pisca = -1; }
    const abreMul = abrindo >= 0 ? 0.06 + 0.94 * sai(abrindo) : pisca >= 0 ? 1 - 0.94 * Math.sin(Math.PI * pisca) : 1;
    let gx = gaze.x, gy = gaze.y;
    if (P.varre > 0.05) { gx = lerp(gx, Math.sin(t * 2.3) * 0.85, P.varre); }
    if (P.pontos > 0.05) { gy = lerp(gy, -0.85, P.pontos); gx = lerp(gx, 0.35 + Math.sin(t * 0.9) * 0.15, P.pontos * 0.8); }
    P.gx = amortecer(P.gx, gx, 16, dt); P.gy = amortecer(P.gy, gy, 16, dt);
    P.abre = abreMul;
    P.flash = Math.max(0, P.flash - dt * 2.6);
    const anim = (!red && (P.varre > 0.01 || P.pontos > 0.01)) || P.boot > 0.01 || P.scanOn < 0.999 || P.flash > 0.001;
    const mudou = mudouDesde();
    if (!anim && !mudou && !forcar) return false;
    forcar = anim;                               // um quadro a mais depois da animação, para assentar
    desenhar(t); tex.needsUpdate = true; return true;
  }
  function cor(a = 1) { const m = P.verm; return `rgba(${Math.round(lerp(HOLO[0], VERM[0], m))},${Math.round(lerp(HOLO[1], VERM[1], m))},${Math.round(lerp(HOLO[2], VERM[2], m))},${a})`; }
  function desenhar(t) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.shadowBlur = 0;
    g.fillStyle = COR.preto; g.fillRect(0, 0, CW, CH);
    const br = P.brilho; if (br < 0.004) return;
    g.globalAlpha = Math.min(1, 0.45 * br); g.drawImage(padrao, 0, 0);
    if (P.verm > 0.01) { g.globalAlpha = 0.14 * P.verm * br; g.fillStyle = COR.alerta; g.fillRect(0, 0, CW, CH); }
    const c = cor(); g.fillStyle = c; g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = glow;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // os olhos vão um pouco além da cabeça; com a cabeça já virada, mais do que isso empurra o olho do lado
    // de fora para a borda curva do visor e ele quase some (parecia piscar um olho só)
    const gx = P.gx * 0.05 * CW, gy = P.gy * (P.gy < 0 ? 0.11 : 0.06) * CH;
    if (P.ponto > 0.001) { olhosPonto(gx, gy, br); g.globalAlpha = 1; g.shadowBlur = 0; return; }
    if (P.olhos > 0.01) for (const lado of [-1, 1]) olho(lado, CW / 2 + lado * EX + gx, EY + gy, br * P.olhos);
    if (P.boca > 0.01) boca(CW / 2 + gx * 0.5, MY + gy * 0.45, br * P.boca);
    if (P.pontos > 0.01) {
      const cx = CW / 2 + EX + 0.1 * CW + gx * 0.3, cy = CH * 0.15;
      for (let k = 0; k < 3; k++) {
        const a = t * 3.4 + k * Math.PI * 2 / 3, s = 0.5 + 0.5 * Math.sin(a);
        g.globalAlpha = br * P.pontos * (0.45 + 0.55 * s);
        g.beginPath(); g.arc(cx + Math.cos(a) * 0.034 * CW, cy + Math.sin(a) * 0.034 * CW * 0.7, 0.011 * CW * (0.75 + 0.4 * s), 0, Math.PI * 2); g.fill();
      }
    }
    if (P.varre > 0.01) {
      const y = CH * (0.5 + 0.38 * Math.sin(t * 2.6)), h = 0.07 * CH;
      g.shadowBlur = 0;
      const grd = g.createLinearGradient(0, y - h, 0, y + h); grd.addColorStop(0, cor(0)); grd.addColorStop(0.5, cor(0.5)); grd.addColorStop(1, cor(0));
      g.globalAlpha = br * P.varre; g.fillStyle = grd; g.fillRect(0, y - h, CW, h * 2);
      g.fillStyle = cor(0.95); g.shadowBlur = glow; g.fillRect(CW * 0.04, y - 2.5, CW * 0.92, 5);
    }
    if (P.boot > 0.01) {
      g.globalAlpha = br * P.boot; g.fillStyle = cor(); g.shadowBlur = glow * 1.2; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `800 ${Math.round(0.118 * CW)}px "JetBrains Mono", Consolas, ui-monospace, monospace`;
      try { g.letterSpacing = `${Math.round(0.012 * CW)}px`; } catch (e) { /* sem letterSpacing */ }
      g.fillText('LUBE OS', CW / 2, CH * 0.40);
      try { g.letterSpacing = '0px'; } catch (e) { /* idem */ }
      const bw = 0.46 * CW, bh = 0.052 * CH, bx = CW / 2 - bw / 2, by = CH * 0.585;
      g.lineWidth = Math.max(2, CW * 0.004); g.shadowBlur = glow * 0.6; retArred(g, bx, by, bw, bh, bh / 2); g.stroke();
      if (P.prog > 0.01) { retArred(g, bx + bh * 0.22, by + bh * 0.22, Math.max(bh * 0.56, (bw - bh * 0.44) * P.prog), bh * 0.56, bh * 0.28); g.fill(); }
      g.shadowBlur = 0; g.globalAlpha = br * P.boot * 0.8; g.font = `600 ${Math.round(0.034 * CW)}px "JetBrains Mono", Consolas, monospace`;
      g.fillText(`${textoBoot} ${String(Math.round(P.prog * 100)).padStart(3, ' ')}%`, CW / 2, CH * 0.71);
    }
    if (P.scanOn < 0.999) {
      const y = CH * P.scanOn; g.globalAlpha = 1; g.shadowBlur = 0; g.fillStyle = COR.preto; g.fillRect(0, y, CW, CH - y);
      g.fillStyle = cor(1); g.shadowBlur = glow * 1.5; g.fillRect(0, y - 3, CW, 6);
    }
    if (P.flash > 0.001) { g.globalAlpha = 0.3 * P.flash; g.shadowBlur = 0; g.fillStyle = COR.flashVisor; g.fillRect(0, 0, CW, CH); }
    g.globalAlpha = 1; g.shadowBlur = 0;
  }
  // Modo Jarvis: os dois olhos achatam numa linha (ponto 0→0,5), correm para o meio e viram um ponto de luz (0,5→1).
  // A boca e o resto do rosto somem na primeira metade. Na volta (1→0) o ponto se abre de novo nos olhos.
  function olhosPonto(gx, gy, br) {
    const f1 = clamp(P.ponto / 0.5), f2 = clamp((P.ponto - 0.5) / 0.5), e2 = sai(f2);
    if (P.boca > 0.01 && f1 < 1) boca(CW / 2 + gx * 0.5, MY + gy * 0.45, br * P.boca * (1 - f1));
    const fim = 0.03 * CW;
    for (const lado of [-1, 1]) {
      const x = lerp(CW / 2 + lado * EX + gx, CW / 2, e2), y = lerp(EY + gy, EY, e2);
      const w = lerp(0.11 * CW * P.esc, fim, e2);
      const h = Math.min(w, lerp(0.36 * CH * P.esc * P.olhoH * P.abre, fim, sai(f1)));
      g.globalAlpha = br; g.shadowBlur = glow * (1 + 2.5 * f2);
      retArred(g, x - w / 2, y - h / 2, w, h, Math.min(w, h) / 2); g.fill();
    }
    if (f2 > 0.01) {
      g.globalAlpha = f2; g.fillStyle = COR.flashVisor; g.shadowColor = COR.flashVisor; g.shadowBlur = glow * 4;
      g.beginPath(); g.arc(CW / 2, EY, fim * (0.42 + 0.3 * f2), 0, Math.PI * 2); g.fill();
    }
  }
  function olho(lado, x, y, a) {
    const abre = P.abre;
    if (P.capsula > 0.01) {
      g.globalAlpha = a * P.capsula;
      const w = 0.11 * CW * P.esc, hM = 0.36 * CH * P.esc * P.olhoH, h = Math.max(w * 0.34, hM * abre);
      g.save();
      if (P.semi > 0.01) { const corte = y - h / 2 + h * P.semi; g.beginPath(); g.moveTo(x - w, corte + lado * w * 0.12); g.lineTo(x + w, corte - lado * w * 0.12); g.lineTo(x + w, CH); g.lineTo(x - w, CH); g.closePath(); g.clip(); }
      retArred(g, x - w / 2, y - h / 2, w, h, w / 2); g.fill();
      g.restore(); g.shadowBlur = glow;
    }
    if (P.feliz > 0.01) {
      g.globalAlpha = a * P.feliz; const r = 0.098 * CW * P.esc; g.lineWidth = 0.042 * CW;
      g.save(); g.translate(x, y + r * 0.42); g.scale(1, Math.max(0.12, abre)); g.beginPath(); g.arc(0, 0, r, Math.PI * 1.06, Math.PI * 1.94); g.restore(); g.stroke();
    }
    if (P.redondo > 0.01) {
      g.globalAlpha = a * P.redondo; const r = 0.092 * CW * P.esc;
      g.save(); g.translate(x, y); g.scale(1, Math.max(0.1, abre)); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.shadowBlur = 0; g.globalAlpha = P.redondo;
      g.beginPath(); g.arc(r * 0.34, -r * 0.36, r * 0.24, 0, Math.PI * 2); g.fill();
      g.restore(); g.shadowBlur = glow;
    }
    if (P.traco > 0.01) {
      g.globalAlpha = a * P.traco; const L = 0.14 * CW * P.esc; g.lineWidth = 0.036 * CW;
      g.save(); g.translate(x, y); g.rotate(lado * 0.2 * P.verm); g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.restore(); g.stroke();
    }
  }
  function boca(x, y, a) {
    const mw = 0.16 * CW * P.bocaL;
    g.globalAlpha = a * (1 - P.bocaO); g.lineWidth = 0.03 * CW;
    g.beginPath(); g.moveTo(x - mw / 2, y); g.quadraticCurveTo(x, y + P.sorriso * 0.16 * CH, x + mw / 2, y); g.stroke();
    if (P.bocaO > 0.01) { g.globalAlpha = a * P.bocaO; g.lineWidth = 0.022 * CW; g.beginPath(); g.ellipse(x, y + 0.01 * CH, 0.03 * CW, 0.058 * CH, 0, 0, Math.PI * 2); g.stroke(); }
  }
  return {
    tex, P, alvo, piscar, abrirOlhos, atualizar,
    get nome() { return nome; },
    texto(t) { textoBoot = t; },
    brilhoGlow(v) { glow = CW * v; },
    ponto(v) { P.ponto = clamp(Number(v) || 0); },   // modo Jarvis: olhos → ponto de luz

    dispose() { tex.dispose(); },
  };
}

/* =============================================================================
   criarRobo
   ============================================================================= */
export async function criarRobo(canvas, opts = {}) {
  if (!canvas) throw new Error('Canvas do robô não encontrado.');
  let reduzido = !!(opts.reduzido ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches));
  let qual = opts.qualidade === 'baixa' ? 'baixa' : 'alta';

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    throw new Error('Sem WebGL: ' + (e && e.message ? e.message : e));
  }
  if (!renderer.getContext()) throw new Error('Sem WebGL.');
  renderer.setClearColor(COR.bg, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const descartaveis = [];   // tudo que precisa de dispose()
  const guarda = o => { descartaveis.push(o); return o; };
  const brilhantes = new Set();
  const brilha = (o, mat) => { o.userData.brilho = true; if (mat) o.userData.brilhoMat = mat; brilhantes.add(o); return o; };  // vai para a camada de brilho
  const matPreto = guarda(new THREE.MeshBasicMaterial({ color: COR.preto, fog: false }));

  const scene = new THREE.Scene();
  scene.background = corHex(COR.bg);
  scene.fog = new THREE.FogExp2(COR.bg, 0.02);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

  /* ---- Ambiente: RoomEnvironment + PMREM, com painéis azuis para o reflexo da marca ----
     Função própria: depois de uma perda de contexto WebGL o conteúdo do PMREM some e é gerado de novo. */
  let rtAmbiente = null;
  function montarAmbiente() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const sala = new RoomEnvironment(renderer);
    sala.rotation.set(0.5, 0.75, 0);               // tira as caixas de luz do eixo da câmera (sem ponto de brilho no meio do visor)
    const painel = (cor, mult, pos, tam) => { const m = new THREE.Mesh(new THREE.BoxGeometry(...tam), new THREE.MeshBasicMaterial({ color: corHex(cor).multiplyScalar(mult) })); m.position.set(...pos); sala.add(m); };
    // as caixas de luz da sala geram reflexos muito fortes no verniz (estouram o bloom): suaviza
    sala.traverse(o => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) { const c = o.material.color; if (Math.max(c.r, c.g, c.b) > 1) c.multiplyScalar(0.28); } });
    painel(COR.reflexoAzul, 1.6, [-14, 2, -10], [1, 14, 16]);   // azul da marca nas bordas (atrás, fora do visor)
    painel(COR.reflexoChao, 1.2, [0, -14, 0], [26, 1, 26]);
    const rt = pmrem.fromScene(sala, 0.035);
    if (rtAmbiente) rtAmbiente.dispose();
    rtAmbiente = rt; scene.environment = rt.texture;
    sala.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pmrem.dispose();
  }
  montarAmbiente();

  /* ---- Luzes ---- */
  const luzes = [];
  const addLuz = (l, base) => { l.userData.base = base; l.intensity = base; luzes.push(l); scene.add(l); return l; };
  addLuz(new THREE.HemisphereLight(COR.luzCeu, COR.luzChao, 1), 0.9);
  const chave = addLuz(new THREE.DirectionalLight(COR.luz, 1), 2.1); chave.position.set(-3.5, 4.5, 6.5);
  const contraE = addLuz(new THREE.DirectionalLight(COR.luzContraE, 1), 3.4); contraE.position.set(-6, 2.5, -5);
  const contraD = addLuz(new THREE.DirectionalLight(COR.luzContraD, 1), 2.6); contraD.position.set(6.5, 1.2, -4.5);

  /* ---- Materiais ---- */
  const mats = [];
  const M = (m, env = 1) => { m.userData.env = env; mats.push(m); return guarda(m); };
  const matBranco = M(new THREE.MeshPhysicalMaterial({ color: COR.branco, roughness: 0.30, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1 }), 1.25);
  // corpo (ombros e contorno da logo do peito): o mesmo branco envernizado do capacete, um pouco menos polido
  const matCorpo = M(new THREE.MeshPhysicalMaterial({ color: COR.branco, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1 }), 1.15);
  const matMetal = M(new THREE.MeshPhysicalMaterial({ color: COR.metal, roughness: 0.32, metalness: 0.75, clearcoat: 0.6, clearcoatRoughness: 0.2 }), 1.1);
  const matEscuro = M(new THREE.MeshPhysicalMaterial({ color: COR.escuro, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }), 1.2);
  const matVerm = M(new THREE.MeshPhysicalMaterial({ color: COR.vermelho, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, emissive: COR.vermelho, emissiveIntensity: 0.12 }), 0.9);
  const matRanhura = M(new THREE.MeshStandardMaterial({ color: COR.ranhura, roughness: 0.6, metalness: 0.3 }), 0.4);
  const matAnelOrelha = guarda(new THREE.MeshStandardMaterial({ color: COR.anelOrelha, emissive: COR.holo, emissiveIntensity: 0, roughness: 0.4 }));
  const matLuzLinha = guarda(new THREE.MeshBasicMaterial({ color: corHex(COR.holo).multiplyScalar(2.2) }));
  const matLogoAzul = M(new THREE.MeshPhysicalMaterial({ color: COR.logoAzul, roughness: 0.3, metalness: 0.0, clearcoat: 0.7, clearcoatRoughness: 0.08, emissive: COR.logoAzul, emissiveIntensity: 0.05 }), 0.55);
  const matLogoVerm = M(new THREE.MeshPhysicalMaterial({ color: COR.logoVermelho, roughness: 0.3, metalness: 0.0, clearcoat: 0.7, clearcoatRoughness: 0.08, emissive: COR.logoVermelho, emissiveIntensity: 0.16 }), 0.55);

  /* ---- Rosto ---- */
  const rosto = criarRosto(qual === 'baixa' ? 768 : 1024, () => reduzido);
  // a tela do visor é escura e brilhante; o rosto (olhos e boca) entra pela camada de brilho, por cima
  const matVisor = M(new THREE.MeshPhysicalMaterial({ color: COR.visor, roughness: 0.28, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.09 }), 1.25);

  /* ---- Hierarquia ---- */
  const rig = new THREE.Group(); scene.add(rig);              // move (deslocar, pulo)
  const pivo = new THREE.Group(); pivo.position.y = PIVO_Y; pivo.rotation.order = 'YXZ'; rig.add(pivo);
  const cabeca = new THREE.Group(); cabeca.position.y = -PIVO_Y; pivo.add(cabeca);
  const casco = new THREE.Group(); casco.scale.copy(ESC); cabeca.add(casco);
  const domo = new THREE.Group(); domo.rotation.x = -INCL; domo.position.set(0, CORTE * Math.cos(INCL), -CORTE * Math.sin(INCL)); casco.add(domo);
  const orbitas = new THREE.Group(); orbitas.rotation.order = 'YXZ'; rig.add(orbitas);
  const fundoRig = new THREE.Group(); fundoRig.position.z = -1.9; rig.add(fundoRig);
  const malhasCabeca = [];

  /* Capacete com abertura no topo (cúpula) */
  const geoCasco = guarda(new THREE.SphereGeometry(1, 96, 72, 0, Math.PI * 2, TETA_C, Math.PI - TETA_C)); geoCasco.rotateX(-INCL);
  const meshCasco = new THREE.Mesh(geoCasco, matBranco); casco.add(meshCasco); malhasCabeca.push(meshCasco);

  /* Visor */
  const matVisorBrilho = guarda(decodificarSRGB(new THREE.MeshBasicMaterial({ map: rosto.tex, color: new THREE.Color(1.0, 1.0, 1.0), fog: false })));
  const meshVisor = brilha(new THREE.Mesh(guarda(geoVisor()), matVisor), matVisorBrilho); casco.add(meshVisor); malhasCabeca.push(meshVisor);
  const moldura = new THREE.Mesh(guarda(new THREE.TubeGeometry(curvaVisor(1.0, 1.016), 320, 0.034, 12, true)), matBranco); casco.add(moldura);
  const vedacao = new THREE.Mesh(guarda(new THREE.TubeGeometry(curvaVisor(0.975, 1.02), 320, 0.012, 8, true)), matRanhura); casco.add(vedacao);
  const ranhuraVisor = new THREE.Mesh(guarda(new THREE.TubeGeometry(curvaVisor(1.075, 1.0), 320, 0.012, 8, true)), matRanhura); casco.add(ranhuraVisor);

  /* Faixas vermelhas e ranhuras em volta das orelhas (sobre a superfície do capacete) */
  // orelhas levemente viradas para a frente (o anel ciano aparece de frente, como na referência)
  const eixoOrelha = (lado) => new THREE.Vector3(lado * Math.cos(11 * DEG), -0.05, Math.sin(11 * DEG)).normalize();
  for (const lado of [-1, 1]) {
    const ax = eixoOrelha(lado), u = new THREE.Vector3(0, 0, 1), v = new THREE.Vector3(0, 1, 0);
    u.addScaledVector(ax, -u.dot(ax)).normalize(); v.addScaledVector(ax, -v.dot(ax)).normalize();
    const arco = (delta, psi0, psi1) => (t, out) => { const psi = lerp(psi0, psi1, t); return out.copy(ax).multiplyScalar(Math.cos(delta)).addScaledVector(u, Math.cos(psi) * Math.sin(delta)).addScaledVector(v, Math.sin(psi) * Math.sin(delta)); };
    // faixa lateral vermelha: arco largo pela frente e topo da orelha (sobe até perto do aro) + filete fino
    casco.add(new THREE.Mesh(guarda(geoFaixa(arco(0.405, -0.75, 2.05), 0.08, 1.0, 0.009, 110)), matVerm));
    casco.add(new THREE.Mesh(guarda(geoFaixa(arco(0.475, -0.35, 1.7), 0.022, 1.0, 0.007, 90)), matVerm));
    // ranhura (volta completa) que separa o painel da orelha
    const volta = (t, out) => { const psi = t * Math.PI * 2; return out.copy(ax).multiplyScalar(Math.cos(0.53)).addScaledVector(u, Math.cos(psi) * Math.sin(0.53)).addScaledVector(v, Math.sin(psi) * Math.sin(0.53)); };
    casco.add(new THREE.Mesh(guarda(geoFaixa(volta, 0.014, 1.0, 0.002, 160, true)), matRanhura));
  }

  /* Orelhas (fora do grupo escalado) */
  const basesOrelha = [];
  for (const lado of [-1, 1]) {
    const o = new THREE.Group();
    const ax = eixoOrelha(lado);
    o.position.set(ax.x * ESC.x * 0.975, ax.y * ESC.y * 0.975, ax.z * ESC.z * 0.975);
    const normal = new THREE.Vector3(ax.x / ESC.x, ax.y / ESC.y, ax.z / ESC.z).normalize();   // normal do elipsoide
    o.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), normal);
    const cil = (r1, r2, h, x, mat, seg = 64) => { const gg = guarda(new THREE.CylinderGeometry(r1, r2, h, seg)); gg.rotateZ(-Math.PI / 2); const m = new THREE.Mesh(gg, mat); m.position.x = x; o.add(m); return m; };
    const tor = (r, t, x, mat) => { const gg = guarda(new THREE.TorusGeometry(r, t, 20, 96)); gg.rotateY(Math.PI / 2); const m = new THREE.Mesh(gg, mat); m.position.x = x; o.add(m); return m; };
    const baseO = cil(0.30, 0.335, 0.18, 0.0, matBranco); malhasCabeca.push(baseO); basesOrelha.push(baseO);
    malhasCabeca.push(tor(0.285, 0.036, 0.088, matBranco));
    cil(0.272, 0.272, 0.03, 0.092, matMetal);
    brilha(tor(0.19, 0.026, 0.108, matAnelOrelha));
    brilha(tor(0.306, 0.0105, 0.07, matAnelOrelha));   // filete ciano na borda (visível de frente)
    cil(0.155, 0.165, 0.04, 0.11, matEscuro);
    cil(0.07, 0.085, 0.05, 0.13, matMetal, 32);
    cabeca.add(o);
  }

  /* Logo da Lube em relevo na testa (L azul + R vermelho sobre contorno branco) */
  const logo = new THREE.Group(); casco.add(logo);
  {
    const { L, R, k } = poligonosLogo();
    const ext = (pts, depth, bev) => guarda(new THREE.ExtrudeGeometry(formaDe(pts), { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.7, bevelSegments: 2, curveSegments: 4 }));
    const fazer = (pts, depth, bev, raio, mat) => { const g0 = ext(pts, depth, bev); const g1 = guarda(dobrarNaTesta(subdividir(g0, 2), raio)); const m = new THREE.Mesh(g1, mat); logo.add(m); return m; };
    const dOut = 22 * k;
    fazer(deslocarPoligono(L, dOut), 0.012, 0.003, 0.993, matBranco);
    fazer(deslocarPoligono(R, dOut), 0.012, 0.003, 0.993, matBranco);
    fazer(L, 0.020, 0.006, 1.010, matLogoAzul);
    fazer(R, 0.020, 0.006, 1.010, matLogoVerm);
  }
  const ancoraLogo = new THREE.Object3D(); ancoraLogo.position.copy(dirEsfera(0, LOGO_BETA).multiplyScalar(1.03)); casco.add(ancoraLogo);
  const ancoraLogoX = new THREE.Object3D(); ancoraLogoX.position.copy(dirEsfera(Math.asin(LOGO_ALT * 0.72 / ESC.x / Math.cos(LOGO_BETA)), LOGO_BETA).multiplyScalar(1.03)); casco.add(ancoraLogoX);
  const ancoraLogoY = new THREE.Object3D(); ancoraLogoY.position.copy(dirEsfera(0, LOGO_BETA + LOGO_ALT * 0.55).multiplyScalar(1.03)); casco.add(ancoraLogoY);
  const ancoraVisor = new THREE.Object3D(); ancoraVisor.position.copy(dirEsfera(0, -22 * DEG).multiplyScalar(1.02)); casco.add(ancoraVisor);
  // meio da linha dos olhos no visor (v = 0,5 da textura do rosto = VIS.bm): ponto de luz da transição do modo Jarvis
  const ancoraOlhos = new THREE.Object3D(); ancoraOlhos.position.copy(dirEsfera(0, VIS.bm).multiplyScalar(1.022)); casco.add(ancoraOlhos);

  /* Cúpula de vidro, aro, chão de circuito */
  const geoDomo = guarda(new THREE.SphereGeometry(DOMO_R, 96, 48, 0, Math.PI * 2, 0, DOMO_TETA));
  const matVidroReflexo = guarda(new THREE.MeshStandardMaterial({ color: COR.preto, roughness: 0.04, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 1 }));
  matVidroReflexo.userData.env = 0.32; mats.push(matVidroReflexo);
  const vidro = new THREE.Mesh(geoDomo, matVidroReflexo); vidro.position.y = DOMO_C - CORTE; vidro.renderOrder = 10; domo.add(vidro); malhasCabeca.push(vidro);
  const matBordaVidro = guarda(new THREE.ShaderMaterial({ uniforms: { uCor: { value: corHex(COR.vidroBorda) }, uInt: { value: 0.3 }, uPot: { value: 3.4 } }, vertexShader: VERT_FRESNEL, fragmentShader: FRAG_BORDA_VIDRO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const bordaVidro = new THREE.Mesh(geoDomo, matBordaVidro); bordaVidro.position.y = DOMO_C - CORTE; bordaVidro.renderOrder = 11; domo.add(bordaVidro);
  const matBordaVidroTras = guarda(matBordaVidro.clone()); matBordaVidroTras.side = THREE.BackSide; matBordaVidroTras.uniforms.uInt.value = 0.06;
  const bordaVidroTras = new THREE.Mesh(geoDomo, matBordaVidroTras); bordaVidroTras.position.y = DOMO_C - CORTE; bordaVidroTras.renderOrder = 9; domo.add(bordaVidroTras);
  const matReflexo = guarda(new THREE.MeshBasicMaterial({ map: guarda(texReflexoVidro()), color: COR.vidroReflexo, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const reflexo = new THREE.Mesh(guarda(new THREE.SphereGeometry(DOMO_R * 1.004, 48, 24, 0.35, 1.25, 0.32, 0.62)), matReflexo);
  reflexo.position.y = DOMO_C - CORTE; reflexo.renderOrder = 12; domo.add(reflexo);
  const aro = new THREE.Mesh(guarda(new THREE.TorusGeometry(RAIO_CORTE, 0.046, 24, 160).rotateX(Math.PI / 2)), matMetal); domo.add(aro);
  const aroLuz = new THREE.Mesh(guarda(new THREE.TorusGeometry(RAIO_CORTE - 0.012, 0.0085, 8, 200).rotateX(Math.PI / 2)), matLuzLinha); aroLuz.position.y = 0.042; domo.add(brilha(aroLuz));
  const texDiscoC = guarda(texDisco(512));
  const matChao = M(new THREE.MeshStandardMaterial({ color: COR.chaoCupula, roughness: 0.5, metalness: 0.25 }), 0.35);
  const matChaoBrilho = guarda(new THREE.MeshBasicMaterial({ map: texDiscoC, color: new THREE.Color(0.75, 0.75, 0.75), fog: false }));
  const chao = new THREE.Mesh(guarda(new THREE.CircleGeometry(RAIO_CORTE - 0.01, 96).rotateX(-Math.PI / 2)), matChao); chao.position.y = 0.004; domo.add(brilha(chao, matChaoBrilho));
  const matOnda = guarda(new THREE.MeshBasicMaterial({ color: corHex(COR.holo).multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const onda = new THREE.Mesh(guarda(new THREE.RingGeometry(0.95, 1.0, 128).rotateX(-Math.PI / 2)), matOnda); onda.position.y = 0.02; onda.visible = false; domo.add(brilha(onda));

  /* Contorno: luz azul na borda do capacete, da cúpula e das orelhas (desenha a silhueta no boot) */
  const matContorno = guarda(new THREE.ShaderMaterial({ uniforms: { uCor: { value: corHex(COR.contorno) }, uInt: { value: 0 }, uVarre: { value: 0 }, uCentro: { value: new THREE.Vector3() } }, vertexShader: VERT_FRESNEL, fragmentShader: FRAG_CONTORNO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const sobrepor = (malha, pai, esc = 1.006) => { const m = brilha(new THREE.Mesh(malha.geometry, matContorno)); m.position.copy(malha.position); m.rotation.copy(malha.rotation); m.scale.copy(malha.scale).multiplyScalar(esc); m.renderOrder = 13; pai.add(m); return m; };
  sobrepor(meshCasco, casco); sobrepor(vidro, domo, 1.004);
  for (const b of basesOrelha) sobrepor(b, b.parent, 1.012);

  /* Pescoço e ombros */
  const corpo = new THREE.Group(); rig.add(corpo);
  {
    const pesc = new THREE.Mesh(guarda(new THREE.CylinderGeometry(0.30, 0.36, 0.72, 48)), matMetal); pesc.position.y = -1.06; corpo.add(pesc);
    for (const [y, r] of [[-0.98, 0.315], [-1.12, 0.33]]) { const t = new THREE.Mesh(guarda(new THREE.TorusGeometry(r, 0.02, 12, 64).rotateX(Math.PI / 2)), matEscuro); t.position.y = y; corpo.add(t); }
    const tl = new THREE.Mesh(guarda(new THREE.TorusGeometry(0.345, 0.008, 8, 96).rotateX(Math.PI / 2)), matLuzLinha); tl.position.y = -1.22; corpo.add(brilha(tl));
    const colar = new THREE.Mesh(guarda(new THREE.TorusGeometry(0.43, 0.075, 20, 96).rotateX(Math.PI / 2)), matMetal); colar.position.y = -1.36; corpo.add(colar);
    const perfil = [[0.36, -1.30], [0.52, -1.36], [0.80, -1.47], [1.10, -1.60], [1.34, -1.82], [1.47, -2.15], [1.53, -2.7], [1.56, -3.6], [1.57, -7.5]].map(([r, y]) => new THREE.Vector2(r, y));
    const ombros = new THREE.Mesh(guarda(new THREE.LatheGeometry(perfil, 96)), matCorpo); ombros.scale.z = 0.62; corpo.add(ombros);
    // logo no peito, como na referência
    const peito = new THREE.Group(); peito.position.set(0, -2.06, 0.905); peito.rotation.x = -0.16; peito.scale.setScalar(1.15); corpo.add(peito);
    const { L, R, k } = poligonosLogo(); const dOut = 22 * k;
    const fazer = (pts, depth, bev, z0, mat) => {
      const g0 = guarda(new THREE.ExtrudeGeometry(formaDe(pts), { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.7, bevelSegments: 2, curveSegments: 4 }));
      const g1 = guarda(subdividir(g0, 2)); const p = g1.attributes.position.array, Rc = 2.3;
      for (let i = 0; i < p.length; i += 3) p[i + 2] += z0 - p[i] * p[i] / (2 * Rc);
      g1.computeVertexNormals(); peito.add(new THREE.Mesh(g1, mat));
    };
    fazer(deslocarPoligono(L, dOut), 0.01, 0.003, -0.01, matCorpo); fazer(deslocarPoligono(R, dOut), 0.01, 0.003, -0.01, matCorpo);
    fazer(L, 0.016, 0.005, 0.004, matLogoAzul); fazer(R, 0.016, 0.005, 0.004, matLogoVerm);
    // faixas vermelhas nos ombros
    for (const lado of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; const a = lado * lerp(0.9, 1.2, t); const r = lerp(0.86, 1.38, t), y = lerp(-1.49, -1.84, t); pts.push(new THREE.Vector3(Math.sin(a) * (r + 0.02), y + 0.012, Math.cos(a) * (r + 0.02) * 0.62)); }
      const f = new THREE.Mesh(guarda(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.035, 8, false)), matVerm); corpo.add(f);
    }
  }

  /* Fundo: circuito, brilho e anéis de HUD */
  const texFundo = guarda(texCircuitos());
  const matFundo = guarda(new THREE.MeshBasicMaterial({ map: texFundo, fog: false, toneMapped: false }));
  const fundo = new THREE.Mesh(guarda(new THREE.PlaneGeometry(1, 1)), matFundo); fundo.position.z = -12; fundo.renderOrder = -10; scene.add(fundo);
  const texBrilhoC = guarda(texBrilho()), texNevoaC = guarda(texNevoa());
  const auraFundo = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texNevoaC, color: corHex(COR.aura).multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  auraFundo.scale.set(5.4, 5.4, 1); auraFundo.position.set(0, 0.2, -0.6); fundoRig.add(auraFundo);
  const aneisHud = [];
  // só a coroa do anel vira geometria (menos sobreposição de transparência)
  for (const [tipo, esc, op, vel, ri] of [[0, 5.3, 0.30, 0.035, 0.74], [1, 6.1, 0.22, -0.02, 0.84]]) {
    const m = new THREE.Mesh(guarda(new THREE.RingGeometry(esc / 2 * ri, esc / 2, 160, 1)), guarda(new THREE.MeshBasicMaterial({ map: guarda(texAnelHud(1024, tipo)), color: corHex(COR.holo), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    m.position.y = 0.2; m.userData = { op, vel }; fundoRig.add(m); aneisHud.push(m);
  }
  /* Poeira no ar */
  const poeira = (() => {
    const N = 240, r = rng(4242), pos = new Float32Array(N * 3), tam = new Float32Array(N), alf = new Float32Array(N), cor = new Float32Array(N * 3);
    const c = corHex(COR.poeira);
    for (let i = 0; i < N; i++) { pos[i * 3] = (r() - 0.5) * 22; pos[i * 3 + 1] = (r() - 0.5) * 12; pos[i * 3 + 2] = -9 + r() * 10; tam[i] = 0.02 + r() * 0.05; alf[i] = 0.12 + r() * 0.3; cor[i * 3] = c.r; cor[i * 3 + 1] = c.g; cor[i * 3 + 2] = c.b; }
    const g = guarda(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aTam', new THREE.BufferAttribute(tam, 1)); g.setAttribute('aAlfa', new THREE.BufferAttribute(alf, 1)); g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    const m = guarda(new THREE.ShaderMaterial({ uniforms: { uEscala: { value: 600 } }, vertexShader: VERT_PONTO, fragmentShader: FRAG_PONTO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }));
    const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return p;
  })();

  /* Órbitas: halo de rotinas e satélites de aplicações */
  const halo = new THREE.Group(); halo.rotation.set(0.52, 0, -0.1); orbitas.add(halo);
  const haloGiro = new THREE.Group(); halo.add(haloGiro);
  const matHaloLinha = guarda(new THREE.MeshBasicMaterial({ color: corHex(COR.rotina).multiplyScalar(1.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  const haloLinha = new THREE.Mesh(guarda(new THREE.TorusGeometry(R_HALO, 0.0055, 6, 360).rotateX(Math.PI / 2)), matHaloLinha); halo.add(brilha(haloLinha));
  const matHaloGlow = guarda(new THREE.MeshBasicMaterial({ color: corHex(COR.rotina), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }));
  const haloGlow = new THREE.Mesh(guarda(new THREE.TorusGeometry(R_HALO, 0.035, 8, 240).rotateX(Math.PI / 2)), matHaloGlow); halo.add(haloGlow);
  const sat = new THREE.Group(); sat.rotation.set(-0.56, 0, 0.22); orbitas.add(sat);   // inclinação moderada: a órbita não sobe até o topo da tela (marca, busca)
  const geoConta = guarda(new THREE.SphereGeometry(0.058, 20, 14));
  const matConta = guarda(new THREE.MeshBasicMaterial({ color: COR.luz }));
  const geoHex = guarda(new THREE.CylinderGeometry(0.15, 0.15, 0.075, 6, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 6));
  const geoHexBorda = guarda(new THREE.EdgesGeometry(geoHex));
  const geoHexFace = guarda(new THREE.CircleGeometry(0.128, 6).rotateZ(Math.PI / 6));
  const geoPainel = guarda(new THREE.BoxGeometry(0.17, 0.06, 0.008));
  const geoHaste = guarda(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 6).rotateZ(Math.PI / 2));
  const texPainel = guarda(texPainelSolar());
  const matPainel = M(new THREE.MeshStandardMaterial({ color: COR.painelSolar, metalness: 0.5, roughness: 0.3, emissive: COR.luz, emissiveMap: texPainel, emissiveIntensity: 0.55 }), 1);

  /* ---- Estado do grafo ---- */
  let G = null;
  let neur = null;     // { pontos, geo, ids[], idx Map(id->i), pos Float32Array, cor, alfaAtual..., nos[] }
  let arestas = null;  // { linhas, geo, lista[{a,b,A,B,C,alfa,alvo}], seg }
  let pulsos = null;   // { pontos, geo, lista[] }
  let aneisNovos = null;
  let contas = null;   // { mesh, nos[], ang[] }
  let satelites = [];  // [{ grupo, no, ang, mats[] }]
  let nevoas = [];
  const lobos = new Map(); // dept ci -> Vector3 (local do domo)
  const noPorId = new Map();
  const novosIni = new Map(); // id -> tempo (s) de início do pulso
  const matNeur = guarda(new THREE.ShaderMaterial({ uniforms: { uTempo: { value: 0 }, uBoot: { value: 0 }, uEscala: { value: 600 }, uDeriva: { value: reduzido ? 0 : 1 }, uBrilho: { value: 1 }, uReduz: { value: reduzido ? 1 : 0 },
    uMao: { value: new THREE.Vector2() }, uMaoRaio: { value: 100 }, uMaoForca: { value: 0 }, uMaoDesloc: { value: 0 }, uTela: { value: new THREE.Vector2(1, 1) } }, vertexShader: VERT_NEURONIO, fragmentShader: FRAG_NEURONIO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }));
  const matLinhas = guarda(new THREE.ShaderMaterial({ uniforms: { uRevela: { value: 0 }, uOpac: { value: 1 } }, vertexShader: VERT_LINHA, fragmentShader: FRAG_LINHA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }));
  const matPulsos = guarda(new THREE.ShaderMaterial({ uniforms: { uEscala: { value: 600 } }, vertexShader: VERT_PONTO, fragmentShader: FRAG_PONTO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }));
  const matAneis = guarda(new THREE.ShaderMaterial({ uniforms: { uTempo: { value: 0 }, uEscala: { value: 600 }, uReduz: { value: reduzido ? 1 : 0 } }, vertexShader: VERT_ANEL, fragmentShader: FRAG_ANEL, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));

  /* ---- Estado geral ---- */
  const S = {
    luz: 0.12, varre: 0, contornoInt: 0.0, orelhas: 0, boot: 0, revela: 0, orb: 0, emBoot: false,
    yaw: 0, pitch: 0, vyaw: 0, vpitch: 0, roll: 0, pulo: 0, vpulo: 0,
    desl: 0, deslAlvo: 0, esc: 1, escFixa: null, gaze: { x: 0, y: 0 },
    destaque: null, puxados: new Map(), hover: null, forcado: null, apontado: null,
    sinapses: true, pausado: false, oculto: document.hidden, destruido: false,
    tempo: 0, proxPisca: agora() + 2500, logoHover: 0, surpresoAte: 0,
    preBoot: true, fimBoot: agora(), ocultos: new Set(),
  };
  let baseNome = 'neutro', temp = null; // temp = { nome, ate }
  const mouse = { x: 0, y: 0, ativo: false, ultimo: -1e9, vel: 0, ts: 0 };
  // modo Mãos: punho fechado segurando a cabeça, e o campo da mão sobre os neurônios (alvo → valor suavizado)
  const agarre = { ativo: false, x: 0, y: 0 };
  const maoCampo = { ativo: false, ax: 0, ay: 0, araio: 110, aforca: 0, x: 0, y: 0, raio: 110, forca: 0 };
  let W = 1, H = 1, dist = 9, visH = 4, visW = 6, alvoY = 0, aperto = 0;
  // modo Jarvis (JARVIS.md §7.5): a câmera avança até ~35% do caminho para os olhos e mira neles (0 = enquadramento normal)
  const camBase = new THREE.Vector3(), camOlha = new THREE.Vector3(), _vMerg = new THREE.Vector3(), _vMira = new THREE.Vector3();
  let mergulhoAlvo = 0, mergulhoAplicado = -1;

  /* ---- Pós-processamento ---- */
  /* Camada de brilho: tudo o que emite luz (olhos, neurônios, sinapses, pulsos, anéis, contas, esferas
     de luz, contorno) é desenhado SÓ numa camada HDR (HalfFloat), com o resto da cena em preto para
     ocultar o que está atrás. Em 'alta' essa camada ganha o borrão do UnrealBloomPass. A cena principal
     vai direto para a tela (MSAA do canvas) e um quadro final aplica o tom (ACES) na camada e a soma por
     cima, com uma vinheta leve. Assim o acúmulo dos brilhos fica em HDR e não estoura para branco. */
  let rtBrilho = null, bloom = null;
  function montarBrilho() {
    if (rtBrilho) return;
    rtBrilho = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.25, 0.0);
    matFinal.uniforms.tBrilho.value = rtBrilho.texture;
  }
  const texPreta = guarda(new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)); texPreta.needsUpdate = true;
  const matFinal = guarda(new THREE.ShaderMaterial({
    uniforms: { tBrilho: { value: texPreta }, uForca: { value: 1 }, uLiga: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    // soma o brilho (já com tom) e escurece de leve a base e os cantos: o olhar vai para a cabeça
    fragmentShader: `uniform sampler2D tBrilho; uniform float uForca; uniform float uLiga; varying vec2 vUv;
      void main(){
        vec3 b = texture2D(tBrilho, vUv).rgb * uForca * uLiga;
        vec2 q = vUv - vec2(0.5, 0.56);
        float vin = 1.0 - 0.38 * smoothstep(0.32, 0.95, length(q * vec2(1.0, 1.25))) - 0.30 * smoothstep(0.30, 0.0, vUv.y);
        gl_FragColor = vec4(b, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.a = vin;
      }`,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor,
    depthTest: false, depthWrite: false, transparent: true,
  }));
  const cenaFinal = new THREE.Scene(), camFinal = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadFinal = new THREE.Mesh(guarda(new THREE.PlaneGeometry(2, 2)), matFinal); quadFinal.frustumCulled = false; cenaFinal.add(quadFinal);
  // trocas temporárias da camada de brilho, em trincas planas (objeto, tipo, valor): nada é alocado por quadro
  const guardados = [];
  const _corClear = new THREE.Color();
  function trocarParaBrilho(o) {
    if (!o.visible || o === scene) return;
    const u = o.userData;
    if (u.brilho) { if (u.brilhoMat) { guardados.push(o, 1, o.material); o.material = u.brilhoMat; } return; }
    if (o.isMesh && !o.isInstancedMesh && o.material && !o.material.transparent) { guardados.push(o, 1, o.material); o.material = matPreto; }
    else if (o.isMesh || o.isPoints || o.isLine || o.isSprite || o.isInstancedMesh) { guardados.push(o, 0, true); o.visible = false; }
  }
  function renderBrilho() {
    if (!rtBrilho) return;
    const fundoCena = scene.background, nevoa = scene.fog;
    const cc = renderer.getClearColor(_corClear), ca = renderer.getClearAlpha();
    guardados.length = 0;
    try {
      scene.background = null; scene.fog = null;
      scene.traverse(trocarParaBrilho);
      renderer.setRenderTarget(rtBrilho); renderer.setClearColor(COR.preto, 1); renderer.clear();
      renderer.render(scene, camera);
    } finally {
      renderer.setClearColor(cc, ca);
      for (let i = 0; i < guardados.length; i += 3) { const o = guardados[i]; if (guardados[i + 1] === 1) o.material = guardados[i + 2]; else o.visible = guardados[i + 2]; }
      guardados.length = 0;
      scene.background = fundoCena; scene.fog = nevoa;
      renderer.setRenderTarget(null);
    }
    if (qual === 'alta' && bloom.strength > 0) { bloom.render(renderer, null, rtBrilho, 0, false); renderer.setRenderTarget(null); }
  }
  // cena principal: o que brilha (sem material próprio de brilho) não entra aqui
  const ocultos = [];
  function renderPrincipal() {
    ocultos.length = 0;
    for (const o of brilhantes) { if (!o.parent) { brilhantes.delete(o); continue; } if (o.visible && !o.userData.brilhoMat) { o.visible = false; ocultos.push(o); } }
    try { renderer.setRenderTarget(null); renderer.autoClear = true; renderer.render(scene, camera); }
    finally { for (const o of ocultos) o.visible = true; }
  }

  function pixelRatio() { return Math.min(window.devicePixelRatio || 1, qual === 'alta' ? 1.75 : 1.25); }

  /* ---- Enquadramento ---- */
  let tamAnterior = '';
  function redimensionar() {
    const cw = canvas.clientWidth || window.innerWidth, ch = canvas.clientHeight || window.innerHeight;
    if (!(cw > 2 && ch > 2)) return;                 // aba/quadro oculto: mantém o tamanho que já tinha
    const chave = `${cw}x${ch}x${pixelRatio()}x${qual}`;
    if (chave === tamAnterior) return;
    tamAnterior = chave;
    W = cw; H = ch;
    const pr = pixelRatio();
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
    const aspect = W / H; camera.aspect = aspect;
    const tanH = Math.tan(camera.fov * DEG / 2);
    aperto = clamp((1.05 - aspect) / 0.55);              // 0 desktop … 1 celular em pé
    const altNec = lerp(4.7, 3.7, aperto), largNec = lerp(5.6, 3.15, aperto);   // celular: orelhas com folga das bordas
    dist = Math.max(altNec / (2 * tanH), largNec / (2 * tanH * aspect));
    visH = 2 * dist * tanH; visW = visH * aspect;
    alvoY = -visH * lerp(0.075, 0.115, aperto);   // celular: cúpula abaixo do contador
    const elev = 9 * DEG;
    camera.position.set(0, alvoY + dist * Math.sin(elev), dist * Math.cos(elev));
    camera.lookAt(0, alvoY, 0); camera.updateProjectionMatrix();
    camBase.copy(camera.position); camOlha.set(0, alvoY, 0); mergulhoAplicado = -1;   // mergulho do modo Jarvis parte daqui
    halo.scale.set(lerp(1, 0.86, aperto), 1, lerp(1, 0.9, aperto));
    sat.scale.set(lerp(1, 0.6, aperto), lerp(1, 1.1, aperto), lerp(1, 0.8, aperto));
    // fundo cobre a tela inteira na profundidade dele
    const dF = dist + 12; const hF = 2 * dF * tanH * 1.12; fundo.scale.set(Math.max(hF * aspect, hF * 2) * 1.02, hF, 1);
    fundo.position.y = alvoY;
    const esc = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * tanH);
    for (const m of [matNeur, matPulsos, matAneis, poeira.material, matTrilha]) m.uniforms.uEscala.value = esc;
    // A camada de brilho fica SEMPRE na resolução do canvas: o rosto do visor só existe nela (a 60% ele
    // borrava) e o gl_PointSize (uEscala) é calculado para a resolução cheia. A economia de 'baixa' vem
    // de desligar o bloom e do pixelRatio ≤ 1,25.
    montarBrilho(); rtBrilho.setSize(Math.max(2, Math.round(W * pr)), Math.max(2, Math.round(H * pr))); bloom.setSize(Math.max(2, Math.round(W * pr * 0.5)), Math.max(2, Math.round(H * pr * 0.5)));
    matNeur.uniforms.uTela.value.set(Math.max(2, Math.round(W * pr)), Math.max(2, Math.round(H * pr)));   // os neurônios só são desenhados na camada de brilho
    rosto.brilhoGlow(qual === 'alta' ? 0.014 : 0.03);
  }

  /* ---- Neurônios, sinapses, rotinas, aplicações ---- */
  function limparGrafo() {
    for (const o of [neur && neur.pontos, arestas && arestas.linhas, pulsos && pulsos.pontos, aneisNovos]) {
      if (!o) continue; brilhantes.delete(o); o.parent && o.parent.remove(o); o.geometry.dispose();
    }
    // contas: a geometria (geoConta) é compartilhada entre grafos; o InstancedMesh solta só os próprios buffers
    if (contas) { brilhantes.delete(contas.mesh); contas.mesh.parent && contas.mesh.parent.remove(contas.mesh); contas.mesh.dispose(); }
    // satélites: a borda (LineSegments) está em `brilhantes` e continua com o grupo como pai: sai à mão
    for (const s of satelites) { s.grupo.traverse(o => brilhantes.delete(o)); s.grupo.parent && s.grupo.parent.remove(s.grupo); s.mats.forEach(m => m.dispose()); s.tex.dispose(); }
    for (const n of nevoas) { n.parent && n.parent.remove(n); n.material.dispose(); }
    neur = arestas = pulsos = aneisNovos = contas = null; satelites = []; nevoas = []; lobos.clear(); noPorId.clear();
  }
  const R_MAX = 0.79, Y_MIN = 0.075;
  function restringir(p, r) {
    const l = p.length(); if (l > R_MAX) p.multiplyScalar(R_MAX / l * (0.9 + 0.1 * r()));
    if (p.y < Y_MIN) p.y = Y_MIN + 0.06 * r();
    const h = Math.hypot(p.x, p.z), lim = Math.sqrt(Math.max(0, R_MAX * R_MAX - p.y * p.y)); if (h > lim) { p.x *= lim / h; p.z *= lim / h; }
    if (p.length() < 0.2 && p.y < 0.32) { p.y += 0.12; }
    return p;
  }
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  function setGrafo(novoG) {
    // ids são índices do grafo: os de um grafo anterior não valem mais (a nota aberta é mantida pelo caminho)
    const abertos = [...S.puxados].filter(([, p]) => p.ate === Infinity).map(([id]) => noPorId.get(id)).filter(Boolean).map(n => n.path || n.name);
    limparGrafo(); novosIni.clear(); S.puxados.clear(); S.destaque = null; S.hover = null; S.apontado = null;
    G = novoG || null; if (!G || !G.nodes) return;
    for (const n of G.nodes) if (abertos.includes(n.path || n.name)) S.puxados.set(n.id, { ate: Infinity });
    for (const n of G.nodes) noPorId.set(n.id, n);
    const memorias = G.nodes.filter(n => n.kind === 'memory');
    const skills = G.nodes.filter(n => n.kind === 'skill');
    const depts = G.depts || [];
    // Lobos: setores por departamento (largura ∝ 1,6 + √n), centros alternando altura
    const pesos = depts.map(d => 1.6 + Math.sqrt(d.list.length)); const tot = pesos.reduce((a, b) => a + b, 0) || 1;
    let a0 = -Math.PI * 0.62;
    depts.forEach((d, i) => {
      const sw = pesos[i] / tot * Math.PI * 2, ac = a0 + sw / 2; a0 += sw;
      const el = (i % 3 === 0 ? 50 : i % 3 === 1 ? 18 : 34) * DEG, rc = d.list.length > 20 ? 0.36 : 0.52;
      lobos.set(d.ci, new THREE.Vector3(Math.sin(ac) * Math.cos(el) * rc, Math.sin(el) * rc + 0.1, Math.cos(ac) * Math.cos(el) * rc));
    });
    const lista = [...skills, ...memorias];
    const N = lista.length;
    const pos = new Float32Array(N * 3), cor = new Float32Array(N * 3), tam = new Float32Array(N), alfa = new Float32Array(N).fill(1), atraso = new Float32Array(N), fase = new Float32Array(N), novo = new Float32Array(N), hi = new Float32Array(N), forma = new Float32Array(N);
    const idx = new Map(), vpos = [];
    const p = new THREE.Vector3();
    skills.sort((a, b) => a.name.localeCompare(b.name));
    lista.forEach((n, i) => {
      const r = rng(hash(n.path || n.name || String(n.id)));
      if (n.kind === 'skill') {
        const k = skills.indexOf(n), a = k / Math.max(1, skills.length) * Math.PI * 2 + 0.6;
        p.set(Math.sin(a) * 0.1, 0.22 + 0.05 * (k % 2), Math.cos(a) * 0.1);
        forma[i] = 1; tam[i] = 0.2;
      } else {
        const c = lobos.get(n.ci) || new THREE.Vector3(0, 0.35, 0);
        const cnt = (depts[n.ci] && depts[n.ci].list.length) || 1;
        const sg = 0.06 + 0.024 * Math.sqrt(cnt);
        p.set(c.x + gauss(r) * sg, c.y + gauss(r) * sg * 0.95, c.z + gauss(r) * sg);
        restringir(p, r);
        const deg = (n.links ? n.links.size : 0) + (n.back ? n.back.size : 0);
        tam[i] = 0.082 + Math.min(0.08, deg * 0.005 + Math.log10(1 + (n.size || 0) / 1024) * 0.016);
      }
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; vpos.push(p.clone());
      const cc = corHex(corDoNo(n)); cor[i * 3] = cc.r; cor[i * 3 + 1] = cc.g; cor[i * 3 + 2] = cc.b;
      atraso[i] = n.kind === 'skill' ? 0.0 : 0.06 + 0.78 * clamp(p.length() / R_MAX);
      fase[i] = r() * 6.283; idx.set(n.id, i);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    geo.setAttribute('aTam', new THREE.BufferAttribute(tam, 1)); geo.setAttribute('aAlfa', new THREE.BufferAttribute(alfa, 1));
    geo.setAttribute('aAtraso', new THREE.BufferAttribute(atraso, 1)); geo.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
    geo.setAttribute('aNovo', new THREE.BufferAttribute(novo, 1)); geo.setAttribute('aHi', new THREE.BufferAttribute(hi, 1)); geo.setAttribute('aForma', new THREE.BufferAttribute(forma, 1));
    const pontos = new THREE.Points(geo, matNeur); pontos.frustumCulled = false; pontos.renderOrder = 6; domo.add(brilha(pontos));
    neur = { pontos, geo, lista, idx, vpos, alfaAtual: new Float32Array(N).fill(1), hiAtual: new Float32Array(N) };

    // Névoas coloridas por lobo
    for (const d of depts) {
      const c = lobos.get(d.ci); if (!c) continue;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texNevoaC, color: corHex(PALETA[d.ci % PALETA.length]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      const s = 0.30 + 0.07 * Math.sqrt(d.list.length); sp.scale.set(s, s, 1); sp.position.copy(c); sp.userData.op = 0.10 + Math.min(0.08, d.list.length * 0.002); sp.userData.dept = d.name; sp.renderOrder = 5;
      domo.add(sp); nevoas.push(sp);
    }

    // Sinapses (curvas finas entre notas ligadas)
    const SEG = 10, pares = new Set(), arr = [];
    for (const n of lista) {
      if (!n.links) continue;
      for (const t of n.links) {
        const ia = idx.get(n.id), ib = idx.get(t); if (ia == null || ib == null || ia === ib) continue;
        const k = ia < ib ? ia + ':' + ib : ib + ':' + ia; if (pares.has(k)) continue; pares.add(k);
        const A = vpos[ia], B = vpos[ib], mid = A.clone().add(B).multiplyScalar(0.5);
        const C = mid.clone().lerp(new THREE.Vector3(0, 0.42, 0), 0.38);
        arr.push({ ia, ib, A, B, C, alfa: 0.04, alvo: 0.04 });
      }
    }
    const NA = arr.length;
    const lp = new Float32Array(NA * SEG * 2 * 3), lc = new Float32Array(NA * SEG * 2 * 3), la = new Float32Array(NA * SEG * 2);
    const bez = (e, s, out) => { const u = 1 - s; return out.set(u * u * e.A.x + 2 * u * s * e.C.x + s * s * e.B.x, u * u * e.A.y + 2 * u * s * e.C.y + s * s * e.B.y, u * u * e.A.z + 2 * u * s * e.C.z + s * s * e.B.z); };
    const q0 = new THREE.Vector3(), q1 = new THREE.Vector3();
    arr.forEach((e, k) => {
      const ca = [cor[e.ia * 3], cor[e.ia * 3 + 1], cor[e.ia * 3 + 2]], cb = [cor[e.ib * 3], cor[e.ib * 3 + 1], cor[e.ib * 3 + 2]];
      for (let s = 0; s < SEG; s++) {
        bez(e, s / SEG, q0); bez(e, (s + 1) / SEG, q1);
        const o = (k * SEG + s) * 2;
        lp.set([q0.x, q0.y, q0.z, q1.x, q1.y, q1.z], o * 3);
        const t0 = s / SEG, t1 = (s + 1) / SEG;
        lc.set([lerp(ca[0], cb[0], t0), lerp(ca[1], cb[1], t0), lerp(ca[2], cb[2], t0), lerp(ca[0], cb[0], t1), lerp(ca[1], cb[1], t1), lerp(ca[2], cb[2], t1)], o * 3);
        la[o] = la[o + 1] = 0.04;
      }
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lc, 3)); lg.setAttribute('aAlfa', new THREE.BufferAttribute(la, 1));
    const linhas = new THREE.LineSegments(lg, matLinhas); linhas.frustumCulled = false; linhas.renderOrder = 4; linhas.visible = S.sinapses; domo.add(brilha(linhas));
    arestas = { linhas, geo: lg, lista: arr, SEG, bez };

    // Pulsos correndo pelas sinapses
    const NP = Math.min(44, Math.max(8, Math.round(NA * 0.12)));
    const pp = new Float32Array(NP * 3), pc = new Float32Array(NP * 3), pt = new Float32Array(NP).fill(0.06), pa = new Float32Array(NP);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3)); pg.setAttribute('aTam', new THREE.BufferAttribute(pt, 1)); pg.setAttribute('aAlfa', new THREE.BufferAttribute(pa, 1));
    const ppts = new THREE.Points(pg, matPulsos); ppts.frustumCulled = false; ppts.renderOrder = 7; ppts.visible = S.sinapses && NA > 0; domo.add(brilha(ppts));
    const rp = rng(99);
    pulsos = { pontos: ppts, geo: pg, lista: Array.from({ length: NP }, () => ({ e: -1, t: 0, dur: 1, espera: rp() * 3 })), r: rp };

    // Anel de rotinas (contas vermelhas)
    const rotinas = G.nodes.filter(n => n.kind === 'routine').sort((a, b) => a.name.localeCompare(b.name));
    if (rotinas.length) {
      const mesh = new THREE.InstancedMesh(geoConta, matConta, rotinas.length);
      const cc = corHex(COR.rotina).multiplyScalar(2.4);
      rotinas.forEach((n, i) => mesh.setColorAt(i, cc));
      mesh.instanceColor.needsUpdate = true; mesh.frustumCulled = false; haloGiro.add(brilha(mesh));
      contas = { mesh, nos: rotinas, ang: rotinas.map((n, i) => i / rotinas.length * Math.PI * 2), brilho: rotinas.map(() => 1), alvo: rotinas.map(() => 1), esc: rotinas.map(() => 1) };
      const m4 = new THREE.Matrix4();
      contas.ang.forEach((a, i) => { m4.makeTranslation(Math.cos(a) * R_HALO, 0, Math.sin(a) * R_HALO); mesh.setMatrixAt(i, m4); });
      mesh.instanceMatrix.needsUpdate = true;
    }
    haloLinha.visible = haloGlow.visible = rotinas.length > 0;

    // Satélites de aplicações
    const apps = G.nodes.filter(n => n.kind === 'app').sort((a, b) => a.name.localeCompare(b.name));
    apps.forEach((n, i) => {
      const grupo = new THREE.Group();
      const tex = texSigla(sigla(n.name));
      const mCorpo = new THREE.MeshPhysicalMaterial({ color: COR.satCorpo, metalness: 0.7, roughness: 0.3, clearcoat: 0.8, transparent: true, opacity: 1 });
      const mBorda = new THREE.LineBasicMaterial({ color: corHex(COR.app).multiplyScalar(1.8), transparent: true, opacity: 1 });
      const mFace = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1 });
      const corpoHex = new THREE.Mesh(geoHex, mCorpo); grupo.add(corpoHex);
      const borda = brilha(new THREE.LineSegments(geoHexBorda, mBorda)); grupo.add(borda);
      const face = new THREE.Mesh(geoHexFace, mFace); face.position.z = 0.039; grupo.add(face);
      for (const lado of [-1, 1]) {
        const pn = new THREE.Mesh(geoPainel, matPainel); pn.position.x = lado * 0.29; grupo.add(pn);
        const h = new THREE.Mesh(geoHaste, matMetal); h.position.x = lado * 0.17; grupo.add(h);
      }
      grupo.scale.setScalar(0.92);
      sat.add(grupo);
      satelites.push({ grupo, no: n, ang: -Math.PI / 2 + i / apps.length * Math.PI * 2, mats: [mCorpo, mBorda, mFace], tex, brilho: 1, alvo: 1, esc: 1 });
    });
    // fontes ainda carregando: refaz as siglas com a JetBrains Mono quando chegarem (já carregadas: nada a refazer)
    if (document.fonts && document.fonts.ready && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (S.destruido) return; for (const s of satelites) { const t = texSigla(sigla(s.no.name)); s.mats[2].map = t; s.mats[2].needsUpdate = true; s.tex.dispose(); s.tex = t; } }).catch(() => {});

    // reaplica destaque/novos existentes
    if (S.destaque) destacar(S.destaque);
    aplicarNovos();
  }

  /* ---- Posições (mundo e tela) ---- */
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _cor = new THREE.Color(), _vOlhar = new THREE.Vector3(), _vPulso = new THREE.Vector3();
  const hiIds = new Set(), pref = [];   // reaproveitados a cada quadro
  const C_HOLO = corHex(COR.holo), C_ROTINA = corHex(COR.rotina), C_APP = corHex(COR.app);
  function mundoDe(id, out = new THREE.Vector3()) {
    const n = noPorId.get(id); if (!n) return null;
    if (n.kind === 'core') return ancoraLogo.getWorldPosition(out);
    if (n.kind === 'dept') { const c = lobos.get(n.ci); return c ? domo.localToWorld(out.copy(c)) : null; }
    if (n.kind === 'routine' && contas) { const i = contas.nos.indexOf(n); if (i < 0) return null; const a = contas.ang[i]; return haloGiro.localToWorld(out.set(Math.cos(a) * R_HALO, 0, Math.sin(a) * R_HALO)); }
    if (n.kind === 'app') { const s = satelites.find(x => x.no === n); return s ? s.grupo.getWorldPosition(out) : null; }
    if (neur) { const i = neur.idx.get(id); if (i != null) return domo.localToWorld(out.copy(neur.vpos[i])); }
    return null;
  }
  function telaDe(p) { _v.copy(p).project(camera); return { x: (_v.x + 1) / 2 * W, y: (1 - _v.y) / 2 * H, z: _v.z }; }
  function centroCabeca(out = new THREE.Vector3()) { return cabeca.localToWorld(out.set(0, 0.1, 0)); }
  function raioCabecaTela() { const c = telaDe(centroCabeca(_w)); const b = telaDe(_w.set(_w.x + 1.15, _w.y, _w.z)); return { c, r: Math.abs(b.x - c.x) }; }
  function ocultoPelaCabeca(p) {
    const cc = centroCabeca(new THREE.Vector3());
    const dCam = camera.position.distanceTo(p), dCab = camera.position.distanceTo(cc);
    if (dCam < dCab) return false;
    const { c, r } = raioCabecaTela(); const t = telaDe(p);
    return Math.hypot(t.x - c.x, (t.y - c.y) * 0.95) < r * 0.98;
  }
  function projetar(id) {
    const p = mundoDe(id, new THREE.Vector3()); if (!p) return { x: W / 2, y: H / 2, visivel: false };
    const t = telaDe(p);
    let visivel = t.z > -1 && t.z < 1 && t.x >= 0 && t.x <= W && t.y >= 0 && t.y <= H;
    const n = noPorId.get(id);
    if (visivel && n && (n.kind === 'routine' || n.kind === 'app')) visivel = !ocultoPelaCabeca(p) && S.orb > 0.5;
    if (visivel && n && (n.kind === 'memory' || n.kind === 'skill')) visivel = S.boot > 0.3;
    return { x: t.x, y: t.y, visivel };
  }
  // final = true: mede o robô em repouso — onde ele vai estar quando o deslocar() em curso terminar, com a
  // cabeça olhando para a frente (o leque usa isso para não se encaixar num robô que ainda está voltando
  // para o centro ou virado para o mouse).
  function naPosicaoFinal(final, fn) {
    if (!final) return fn();
    const px = rig.position.x, py = rig.position.y, sc = rig.scale.x, rx = pivo.rotation.x, ry = pivo.rotation.y, rz = pivo.rotation.z;
    rig.position.x = S.deslAlvo * visW; rig.position.y = 0; rig.scale.setScalar(escalaAlvo());
    pivo.rotation.set(0, 0, 0); rig.updateMatrixWorld(true);
    try { return fn(); } finally { rig.position.set(px, py, rig.position.z); rig.scale.setScalar(sc); pivo.rotation.set(rx, ry, rz); rig.updateMatrixWorld(true); }
  }
  function testa(final) { return naPosicaoFinal(final, () => { const t = telaDe(ancoraLogo.getWorldPosition(_w)); return { x: t.x, y: t.y }; }); }
  function cupula(final) { return naPosicaoFinal(final, () => { const t = telaDe(domo.localToWorld(_w.set(0, 0.42, 0))); return { x: t.x, y: t.y }; }); }
  // extra: círculo de tela da cabeça (capacete + orelhas), para o leque não cobrir o rosto
  // r = raio na tela com a escala atual (ou a final); r1 = raio com o robô em tamanho cheio.
  function cabecaTela(final) { return naPosicaoFinal(final, () => { const { c, r } = raioCabecaTela(); const e = final ? escalaAlvo() : S.esc; return { x: c.x, y: c.y, r: r * e, r1: r, escala: e }; }); }
  function mundoDeTela(x, y, d) {
    const v = new THREE.Vector3(x / W * 2 - 1, -(y / H) * 2 + 1, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    return camera.position.clone().addScaledVector(dir, d);
  }

  /* ---- Escolha por proximidade na tela (limiar generoso) ---- */
  function escolher(x, y, toque = false) {
    if (!G) return null;
    let melhor = null, md = Infinity;
    const lim = toque ? 26 : 16;
    if (neur && S.boot > 0.3) {
      domo.updateWorldMatrix(true, false);
      for (let i = 0; i < neur.lista.length; i++) {
        if (neur.alfaAtual[i] < 0.3) continue;
        const t = telaDe(domo.localToWorld(_w.copy(neur.vpos[i])));
        const d = Math.hypot(t.x - x, t.y - y), raio = lim + (neur.lista[i].kind === 'skill' ? 6 : 0);
        if (d < raio && d < md) { md = d; melhor = neur.lista[i]; }
      }
    }
    if (S.orb > 0.6) {
      const extra = [];
      if (contas) contas.nos.forEach(n => extra.push([n, lim + 2]));
      satelites.forEach(s => extra.push([s.no, lim + 12]));
      for (const [n, raio] of extra) {
        const p = mundoDe(n.id, new THREE.Vector3()); if (!p || ocultoPelaCabeca(p)) continue;
        const t = telaDe(p); const d = Math.hypot(t.x - x, t.y - y);
        if (d < raio && d < md) { md = d; melhor = n; }
      }
    }
    return melhor;
  }
  function sobreLogo(x, y) {
    const c = telaDe(ancoraLogo.getWorldPosition(_w)); const ex = telaDe(ancoraLogoX.getWorldPosition(_w)); const ey = telaDe(ancoraLogoY.getWorldPosition(_w));
    const rx = Math.max(8, Math.hypot(ex.x - c.x, ex.y - c.y)), ry = Math.max(6, Math.hypot(ey.x - c.x, ey.y - c.y));
    const dx = (x - c.x) / rx, dy = (y - c.y) / ry; return dx * dx + dy * dy < 1;
  }
  const ray = new THREE.Raycaster();
  function acertoCabeca(x, y) {
    ray.setFromCamera(new THREE.Vector2(x / W * 2 - 1, -(y / H) * 2 + 1), camera);
    const h = ray.intersectObjects(malhasCabeca, false); return h.length ? h[0] : null;
  }

  /* ---- Expressões ---- */
  function expressaoAtual() { return temp && agora() < temp.ate ? temp.nome : baseNome; }
  function aplicarExpressao() { const n = expressaoAtual(); if (rosto.nome !== n) rosto.alvo(n); }
  // Durante os passos 1–2 do boot o visor está apagado ou mostrando "LUBE OS": pedidos de fora não trocam
  // o rosto (o boot decide); a base pedida é guardada e vale quando os olhos abrirem.
  const visorTravado = () => (S.emBoot || S.preBoot) && !!temp && (temp.nome === 'apagado' || temp.nome === 'boot');
  function expressao(nome, ms) {
    if (nome === 'piscar') { if (!visorTravado()) rosto.piscar(); return; }
    if (!ROSTO_ALVOS[nome] || visorTravado()) return;
    if (nome === baseNome && !ms) { temp = null; aplicarExpressao(); return; }
    temp = { nome, ate: ms > 0 ? agora() + ms : Infinity };
    aplicarExpressao();
  }
  function base(nome) {
    if (!ROSTO_ALVOS[nome] || nome === 'boot' || nome === 'apagado') nome = 'neutro';
    baseNome = nome;
    if (visorTravado()) return;
    if (temp && temp.ate === Infinity) temp = null; aplicarExpressao();
  }

  /* ---- Destaques ---- */
  function realce(n, max) { const g = (n.links ? n.links.size : 0) + (n.back ? n.back.size : 0); return Math.max(0.12, Math.min(max, max * 14 / Math.max(14, g))); }
  function destacar(ids) {
    S.destaque = ids && ids.size ? new Set(ids) : null;
    if (contas) contas.nos.forEach((n, i) => { contas.alvo[i] = !S.destaque || S.destaque.has(n.id) ? 1 : 0.25; });
    satelites.forEach(s => { s.alvo = !S.destaque || S.destaque.has(s.no.id) ? 1 : 0.3; });
  }
  function aplicarNovos() {
    if (!neur) return;
    const ids = [...novosIni.keys()].filter(id => neur.idx.has(id) && S.tempo - novosIni.get(id) < 20);
    if (aneisNovos) { brilhantes.delete(aneisNovos); aneisNovos.parent && aneisNovos.parent.remove(aneisNovos); aneisNovos.geometry.dispose(); aneisNovos = null; }
    if (!ids.length) return;
    const pos = new Float32Array(ids.length * 3), ini = new Float32Array(ids.length), cor = new Float32Array(ids.length * 3);
    const cn = corHex(COR.novo);
    ids.forEach((id, k) => { const v = neur.vpos[neur.idx.get(id)]; pos.set([v.x, v.y, v.z], k * 3); ini[k] = novosIni.get(id) + k * 0.12; cor.set([cn.r, cn.g, cn.b], k * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aIni', new THREE.BufferAttribute(ini, 1)); g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    aneisNovos = new THREE.Points(g, matAneis); aneisNovos.frustumCulled = false; aneisNovos.renderOrder = 8; domo.add(brilha(aneisNovos));
  }
  function pulsoNovo(ids) {
    if (!ids) return;
    for (const id of ids) novosIni.set(id, S.tempo);
    aplicarNovos();
  }

  /* ---- Voos (esfera de luz com rastro) ---- */
  const matTrilha = guarda(new THREE.ShaderMaterial({ uniforms: { uEscala: { value: 600 } }, vertexShader: VERT_PONTO, fragmentShader: FRAG_PONTO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }));
  const voos = new Set();
  function criarVoo({ de, ate, ms, cor, tam0, tam1, sobe = 0.9, aoChegar }) {
    const N = 34;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilhoC, color: corHex(cor).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    sp.renderOrder = 30; scene.add(brilha(sp));
    const nucleo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilhoC, color: new THREE.Color(3, 3, 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    nucleo.renderOrder = 31; scene.add(brilha(nucleo));
    const pos = new Float32Array(N * 3), tam = new Float32Array(N), alf = new Float32Array(N), cc = new Float32Array(N * 3);
    const c = corHex(cor); for (let i = 0; i < N; i++) { cc[i * 3] = lerp(c.r, 1, 0.3); cc[i * 3 + 1] = lerp(c.g, 1, 0.3); cc[i * 3 + 2] = lerp(c.b, 1, 0.3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aTam', new THREE.BufferAttribute(tam, 1)); g.setAttribute('aAlfa', new THREE.BufferAttribute(alf, 1)); g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    const trilha = new THREE.Points(g, matTrilha); trilha.frustumCulled = false; trilha.renderOrder = 29; scene.add(brilha(trilha));
    return new Promise(res => {
      const v = { sp, nucleo, trilha, g, de, ate, ms, t0: agora(), N, tam0, tam1, sobe, fim: -1, res, aoChegar };
      voos.add(v);
      atualizarVoos(agora());                       // já nasce no ponto de partida (sem piscar na origem)
      v.seguro = setTimeout(() => { if (v.fim < 0) { v.fim = agora(); v.aoChegar && v.aoChegar(); res(); } }, ms + 1500);
    });
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3(), _up = new THREE.Vector3(), _pVoo = new THREE.Vector3(), _qDomo = new THREE.Quaternion();
  const curvaVoo = (kk, out) => { const u = 1 - kk; return out.copy(_a).multiplyScalar(u * u * u).addScaledVector(_c1, 3 * u * u * kk).addScaledVector(_c2, 3 * u * kk * kk).addScaledVector(_b, kk * kk * kk); };
  function atualizarVoos(now) {
    if (voos.size) _up.set(0, 1, 0).applyQuaternion(domo.getWorldQuaternion(_qDomo));
    for (const v of voos) {
      const e = clamp((now - v.t0) / v.ms);
      const k = entraSai(e);
      v.de(_a); v.ate(_b);
      _c1.copy(_a).addScaledVector(_up, v.sobe);
      _c2.copy(_b).lerp(_c1, 0.35);
      const curva = curvaVoo;
      const p = curva(k, _pVoo);
      let s = lerp(v.tam0, v.tam1, k), op = 1, kCauda = k;
      if (v.fim >= 0) { const f = clamp((now - v.fim) / 240); s *= 1 + f * 1.8; op = 1 - f; p.copy(_b); kCauda = 1; if (f >= 1) { removerVoo(v); continue; } }
      v.sp.position.copy(p); v.sp.scale.setScalar(s * 2.4); v.sp.material.opacity = op;
      v.nucleo.position.copy(p); v.nucleo.scale.setScalar(s * 0.7); v.nucleo.material.opacity = op;
      // rastro contínuo: amostras da própria curva logo atrás da esfera
      const pa = v.g.attributes.position.array, ta = v.g.attributes.aTam.array, aa = v.g.attributes.aAlfa.array, q = _w;
      const passo = 0.22 / v.N;
      for (let i = 0; i < v.N; i++) {
        const kk = kCauda - i * passo; curva(Math.max(0, kk), q);
        pa[i * 3] = q.x; pa[i * 3 + 1] = q.y; pa[i * 3 + 2] = q.z;
        const f = 1 - i / v.N; ta[i] = lerp(v.tam0, v.tam1, Math.max(0, kk)) * 1.25 * f + 0.01; aa[i] = kk > 0 ? 0.5 * f * f * op : 0;
      }
      v.g.attributes.position.needsUpdate = v.g.attributes.aTam.needsUpdate = v.g.attributes.aAlfa.needsUpdate = true;
      if (e >= 1 && v.fim < 0) { v.fim = now; clearTimeout(v.seguro); v.aoChegar && v.aoChegar(); v.res(); }
    }
  }
  function removerVoo(v) { voos.delete(v); for (const o of [v.sp, v.nucleo, v.trilha]) { scene.remove(o); o.material !== matTrilha && o.material.dispose(); } v.g.dispose(); clearTimeout(v.seguro); }

  async function puxar(id, alvo) {
    const n = noPorId.get(id); if (!n) return;
    S.puxados.set(id, { ate: Infinity });
    if (reduzido || !alvo) return;
    expressao('procurando', 900);
    await esperar(260);
    const d = dist * 0.6;
    const pAlvo = () => mundoDeTela(alvo.x, alvo.y, d);
    await criarVoo({ de: out => mundoDe(id, out) || out.copy(centroCabeca(out)), ate: out => out.copy(pAlvo()), ms: 760, cor: corDoNo(n), tam0: 0.07, tam1: 0.24, sobe: n.kind === 'memory' || n.kind === 'skill' ? 0.95 : 0.4 });
  }
  async function devolver(id, origem) {
    const n = noPorId.get(id);
    const solta = () => { const p = S.puxados.get(id); if (p) p.ate = agora(); };
    if (!n || reduzido || !origem) { solta(); return; }
    const d = dist * 0.6, pOrig = mundoDeTela(origem.x, origem.y, d);
    // sobe positivo: a esfera faz um arco por cima e cai na cúpula pelo vidro (com sobe negativo ela mergulhava e cruzava o rosto)
    await criarVoo({ de: out => out.copy(pOrig), ate: out => mundoDe(id, out) || out.copy(centroCabeca(out)), ms: 700, cor: corDoNo(n), tam0: 0.22, tam1: 0.06, sobe: 0.7 });
    solta();
  }
  function faisca(id) {
    const n = noPorId.get(id); if (!n || reduzido) { rosto.P.flash = 0.6; return; }
    criarVoo({ de: out => mundoDe(id, out) || out.copy(centroCabeca(out)), ate: out => ancoraVisor.getWorldPosition(out), ms: 480, cor: corDoNo(n), tam0: 0.05, tam1: 0.08, sobe: 0.35, aoChegar: () => { rosto.P.flash = 1; } });
  }

  /* ---- Faíscas do clique na cabeça ---- */
  const faiscas = (() => {
    const N = 64, pos = new Float32Array(N * 3), tam = new Float32Array(N), alf = new Float32Array(N), cor = new Float32Array(N * 3);
    const g = guarda(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aTam', new THREE.BufferAttribute(tam, 1)); g.setAttribute('aAlfa', new THREE.BufferAttribute(alf, 1)); g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    const p = new THREE.Points(g, matTrilha); p.frustumCulled = false; p.renderOrder = 28; scene.add(brilha(p));
    return { p, g, N, vel: Array.from({ length: N }, () => new THREE.Vector3()), vida: new Float32Array(N), ativo: false };
  })();
  function soltarFaiscas(ponto, normal) {
    const r = Math.random, cores = [COR.holo, COR.luz, COR.rotina, COR.skill].map(corHex);
    const pa = faiscas.g.attributes.position.array, ca = faiscas.g.attributes.color.array;
    for (let i = 0; i < faiscas.N; i++) {
      pa[i * 3] = ponto.x; pa[i * 3 + 1] = ponto.y; pa[i * 3 + 2] = ponto.z;
      faiscas.vel[i].set(r() - 0.5, r() - 0.3, r() - 0.5).normalize().multiplyScalar(0.8 + r() * 1.6).addScaledVector(normal, 1.2 + r());
      faiscas.vida[i] = 0.5 + r() * 0.5; const c = cores[i % cores.length]; ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b;
    }
    faiscas.g.attributes.color.needsUpdate = true; faiscas.ativo = true;
  }
  function atualizarFaiscas(dt) {
    if (!faiscas.ativo) return;
    const pa = faiscas.g.attributes.position.array, ta = faiscas.g.attributes.aTam.array, aa = faiscas.g.attributes.aAlfa.array; let vivos = 0;
    for (let i = 0; i < faiscas.N; i++) {
      if (faiscas.vida[i] <= 0) { aa[i] = 0; continue; } vivos++;
      faiscas.vida[i] -= dt; faiscas.vel[i].y -= dt * 3.2; faiscas.vel[i].multiplyScalar(1 - dt * 1.5);
      pa[i * 3] += faiscas.vel[i].x * dt; pa[i * 3 + 1] += faiscas.vel[i].y * dt; pa[i * 3 + 2] += faiscas.vel[i].z * dt;
      const v = clamp(faiscas.vida[i] / 0.6); ta[i] = 0.055 * v + 0.01; aa[i] = v;
    }
    faiscas.g.attributes.position.needsUpdate = faiscas.g.attributes.aTam.needsUpdate = faiscas.g.attributes.aAlfa.needsUpdate = true;
    if (!vivos) faiscas.ativo = false;
  }

  /* ---- Animações (tweens) ---- */
  const tweens = new Set();
  function animar(ms, fn, ease = entraSai) {
    return new Promise(res => {
      const tw = { t0: agora(), ms, fn, ease, res };
      tw.seguro = setTimeout(() => { if (tweens.has(tw)) { tweens.delete(tw); fn(1); res(); } }, ms + 1500);
      tweens.add(tw);
    });
  }
  const esperar = ms => animar(ms, () => {}, e => e);
  function atualizarTweens(now) {
    for (const tw of tweens) {
      const e = clamp((now - tw.t0) / tw.ms); tw.fn(tw.ease(e));
      if (e >= 1) { tweens.delete(tw); clearTimeout(tw.seguro); tw.res(); }
    }
  }

  /* ---- Boot ---- */
  let bootTok = 0;
  function estadoFinal() {
    S.luz = 1; S.varre = 1; S.contornoInt = 0.32; S.orelhas = 1; S.boot = 1.2; S.revela = 1; S.orb = 1; rosto.P.scanOn = 1; rosto.P.prog = 1;
  }
  async function boot({ recarga = false, frescos = null } = {}) {
    const tok = ++bootTok; const vivo = () => tok === bootTok && !S.destruido;
    S.emBoot = true; S.preBoot = false;
    try {
      if (reduzido) {
        const luz0 = recarga ? 1 : 0;
        S.varre = 1; S.contornoInt = 0.32; S.orelhas = 1; S.boot = 1.2; S.revela = 1; S.orb = 1; rosto.P.scanOn = 1;
        temp = null; aplicarExpressao();
        await animar(320, e => { S.luz = lerp(luz0, 1, e); });
        if (frescos && frescos.size) pulsoNovo(frescos);
        return;
      }
      if (!recarga) {
        S.luz = 0.03; S.varre = 0; S.contornoInt = 1.6; S.orelhas = 0; S.boot = 0; S.revela = 0; S.orb = 0;
        temp = { nome: 'apagado', ate: Infinity }; aplicarExpressao(); rosto.P.brilho = 0;
        await animar(760, e => { S.varre = e; S.luz = 0.03 + 0.12 * e; }, e => e);
        if (!vivo()) return;
        rosto.texto('carregando memórias'); temp = { nome: 'boot', ate: Infinity }; aplicarExpressao(); rosto.P.brilho = 1; rosto.P.scanOn = 0; rosto.P.prog = 0;
        await animar(880, e => { rosto.P.scanOn = Math.min(1, e * 2.4); rosto.P.prog = sai(clamp((e - 0.2) / 0.8)); S.orelhas = e; S.luz = 0.15 + 0.85 * sai(e); S.contornoInt = lerp(1.6, 0.32, e); }, e => e);
        if (!vivo()) return;
        // olhos abrem: começam fechados e abrem com easing enquanto o "LUBE OS" se apaga (P.boot cai pelo lerp)
        temp = null; aplicarExpressao(); rosto.P.capsula = 1; rosto.P.olhos = 1;
        rosto.abrirOlhos();
        dispararOnda();
        const p4 = animar(1050, e => { S.boot = e * 1.2; S.revela = e; }, e => e);
        await esperar(220); if (!vivo()) return;
        expressao('feliz', 760);
        await esperar(380); if (!vivo()) return;
        const p5 = animar(820, e => { S.orb = e; }, sai);
        await Promise.all([p4, p5]);
      } else {
        rosto.texto('recarregando'); temp = { nome: 'boot', ate: Infinity }; aplicarExpressao(); rosto.P.prog = 0;
        const b0 = S.boot;
        await animar(420, e => { S.boot = lerp(b0, 0, e); S.revela = 1 - e; rosto.P.prog = e; S.contornoInt = 0.32 + 0.9 * Math.sin(Math.PI * e); });
        if (!vivo()) return;
        temp = null; aplicarExpressao(); rosto.abrirOlhos(); dispararOnda();
        await animar(950, e => { S.boot = e * 1.2; S.revela = e; }, e => e);
        if (!vivo()) return;
        if (frescos && frescos.size) { pulsoNovo(frescos); expressao('surpreso', 640); await esperar(640); if (!vivo()) return; expressao('feliz', 1300); }
        else expressao('feliz', 900);
      }
    } finally {
      if (tok === bootTok) { S.emBoot = false; S.fimBoot = agora(); if (S.orb < 1 || S.boot < 1) estadoFinal(); if (temp && (temp.nome === 'boot' || temp.nome === 'apagado')) { temp = null; aplicarExpressao(); } }
    }
  }
  let ondaT0 = -1, ondaClarao = false;
  function dispararOnda() { if (!reduzido) { ondaT0 = agora(); ondaClarao = false; matOnda.color.copy(C_ONDA); } }

  /* ---- Entrada: mouse e toque ---- */
  let toqueIni = null;
  const ultimoNoCanvas = { x: 0, y: 0, t: -1e9 };
  function posRel(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function aoMover(e) {
    const p = posRel(e); const t = e.timeStamp || agora();
    const dtm = t - mouse.ts;
    if (mouse.ativo && dtm > 0 && dtm < 120) { const v = Math.hypot(p.x - mouse.x, p.y - mouse.y) / dtm; mouse.vel = mouse.vel * 0.55 + v * 0.45; } else mouse.vel *= 0.5;
    mouse.ts = t; mouse.x = p.x; mouse.y = p.y; mouse.ativo = true; mouse.ultimo = agora();
    if (mouse.vel > 4.2 && !S.emBoot && agora() > S.surpresoAte && expressaoAtual() === baseNome && !reduzido) { expressao('surpreso', 620); S.surpresoAte = agora() + 3200; }
    const noCanvas = e.target === canvas;
    // modo Mãos: o mouse sintético manda o mesmo movimento para o elemento debaixo do cursor e também para a
    // window; a cópia da window (mesmo ponto, antes ou depois) não pode apagar o hover que a do canvas achou
    const raiz = e.target === window || e.target === document || e.target === document.documentElement;
    const mesmoPonto = () => Math.abs(p.x - ultimoNoCanvas.x) < 1 && Math.abs(p.y - ultimoNoCanvas.y) < 1;
    if (noCanvas) { ultimoNoCanvas.x = p.x; ultimoNoCanvas.y = p.y; ultimoNoCanvas.t = agora(); }
    else if (raiz && e.pointerType !== 'touch') {
      const t0 = agora();
      if (t0 - ultimoNoCanvas.t < 60 && mesmoPonto()) return;
      // a do canvas ainda pode vir no mesmo despacho: decide depois dele
      queueMicrotask(() => { if (ultimoNoCanvas.t >= t0 && mesmoPonto()) return; if (S.hover) definirHover(null, p); canvas.style.cursor = ''; });
      return;
    }
    if (!noCanvas || e.pointerType === 'touch') { if (S.hover) definirHover(null, p); canvas.style.cursor = ''; return; }
    const n = manterHover(p.x, p.y) || escolher(p.x, p.y);
    definirHover(n, p);
    const logo = !n && sobreLogo(p.x, p.y); S.logoHoverAlvo = logo ? 1 : 0;
    canvas.style.cursor = n || logo ? 'pointer' : '';
  }
  // Histerese: ao entrar no hover a cabeça vira para o item e ele desliza alguns px sob o cursor;
  // enquanto ele continuar perto (1,7 × o limiar), fica o mesmo (sem a dica piscar e a cabeça ir e vir).
  const _vHover = new THREE.Vector3();
  function manterHover(x, y) {
    const h = S.hover; if (!h) return null;
    if ((h.kind === 'memory' || h.kind === 'skill') && neur) { const i = neur.idx.get(h.id); if (i == null || neur.alfaAtual[i] < 0.3) return null; }
    const pw = mundoDe(h.id, _vHover); if (!pw) return null;
    if ((h.kind === 'routine' || h.kind === 'app') && ocultoPelaCabeca(pw)) return null;
    const t = telaDe(pw);
    return Math.hypot(t.x - x, t.y - y) < 16 * 1.7 ? h : null;
  }
  function definirHover(n, p) {
    const mudou = n !== S.hover; S.hover = n;
    if (mudou || n) opts.onHover && opts.onHover(n || null, { x: p.x, y: p.y });
  }
  function aoSair() { if (S.hover) definirHover(null, { x: mouse.x, y: mouse.y }); S.logoHoverAlvo = 0; canvas.style.cursor = ''; }
  function aoDescer(e) {
    if (e.button != null && e.button !== 0) return;
    const p = posRel(e); toqueIni = { x: p.x, y: p.y, t: agora(), tipo: e.pointerType };
    if (e.pointerType === 'touch') { mouse.x = p.x; mouse.y = p.y; mouse.ativo = true; mouse.ultimo = agora(); }
  }
  function aoSubir(e) {
    if (!toqueIni) return; const p = posRel(e); const ini = toqueIni; toqueIni = null;
    if (Math.hypot(p.x - ini.x, p.y - ini.y) > 9 || agora() - ini.t > 700) return;
    clique(p.x, p.y, ini.tipo === 'touch');
  }
  function clique(x, y, toque) {
    if (!G && !malhasCabeca.length) return;
    const n = escolher(x, y, toque);
    if (n) { opts.onClique && opts.onClique(n); return; }
    if (sobreLogo(x, y)) { S.logoPulso = 1; opts.onLogo && opts.onLogo(); return; }
    const h = acertoCabeca(x, y);
    if (h) {
      if (!S.emBoot) expressao('feliz', 1200);
      if (!reduzido) { S.vpulo += 2.6; const nrm = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0); soltarFaiscas(h.point, nrm); }
      opts.onCabeca && opts.onCabeca();
    } else if (opts.onClique) opts.onClique(null);   // clique no vazio (o app recolhe o leque)
  }
  window.addEventListener('pointermove', aoMover, { passive: true });
  const aoTocarFora = e => { if (e.target !== canvas && e.pointerType === 'touch') { const p = posRel(e); mouse.x = p.x; mouse.y = p.y; mouse.ativo = true; mouse.ultimo = agora(); } };
  window.addEventListener('pointerdown', aoTocarFora, { passive: true });
  canvas.addEventListener('pointerdown', aoDescer);
  canvas.addEventListener('pointerup', aoSubir);
  canvas.addEventListener('pointerleave', aoSair);
  document.addEventListener('pointerleave', aoSair);
  const aoVisibilidade = () => { S.oculto = document.hidden; ajustarLaco(); };
  document.addEventListener('visibilitychange', aoVisibilidade);
  const aoPerder = e => { e.preventDefault(); S.perdido = true; ajustarLaco(); try { opts.onPerdido && opts.onPerdido(); } catch (err) { /* o app segue */ } };
  const aoRestaurar = () => {
    S.perdido = false;
    try { montarAmbiente(); } catch (err) { /* sem reflexos, mas o robô volta */ }
    tamAnterior = ''; redimensionar(); ajustarLaco();
    try { opts.onRestaurado && opts.onRestaurado(); } catch (err) { /* o app segue */ }
  };
  canvas.addEventListener('webglcontextlost', aoPerder);
  canvas.addEventListener('webglcontextrestored', aoRestaurar);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => redimensionar()) : null;
  if (ro) ro.observe(canvas); else window.addEventListener('resize', redimensionar);

  /* ---- Laço ---- */
  let raf = 0, ultimo = agora(), medicao = { ini: -1, soma: 0, n: 0, feito: false };
  const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  function ajustarLaco() {
    const rodar = !S.pausado && !S.oculto && !S.destruido && !S.perdido;
    if (rodar && !raf) { ultimo = agora(); raf = requestAnimationFrame(quadro); }
    if (!rodar && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  function quadro() {
    raf = requestAnimationFrame(quadro);
    passo(agora());
  }
  function passo(now) {
    const dtReal = (now - ultimo) / 1000; ultimo = now;
    const dt = Math.min(0.05, Math.max(0, dtReal));
    // medição de desempenho nos primeiros 3 s (ignora a compilação e quadros "parados")
    if (!medicao.feito && qual === 'alta') {
      if (medicao.ini < 0) medicao.ini = now + 400;
      else if (now > medicao.ini && dtReal < 0.25) {
        medicao.soma += dtReal * 1000; medicao.n++;
        if (now - medicao.ini > 3000 && medicao.n >= 30) { medicao.feito = true; if (medicao.soma / medicao.n > 24) { qualidade('baixa'); opts.onQualidade && opts.onQualidade('baixa'); } }
      }
    }
    S.tempo += dt;
    atualizar(dt, now);
    renderBrilho();
    renderPrincipal();
    renderer.autoClear = false; renderer.render(cenaFinal, camFinal); renderer.autoClear = true;
  }

  function atualizar(dt, now) {
    const t = S.tempo;
    atualizarTweens(now);
    if (temp && now >= temp.ate) { temp = null; }
    aplicarExpressao();

    /* --- Para onde olhar --- */
    const cc = telaDe(centroCabeca(_w));
    let alvo = null, ocioso = false, fatorCabeca = 1;
    // apontado (de fora: item da lista de rotinas, conta que vai sair do halo) vence o olhar forçado do painel
    const apont = S.apontado != null ? noPorId.get(S.apontado) : null;
    // punho fechado (modo Mãos) vence tudo: a cabeça segue a mão com o dobro da amplitude
    if (agarre.ativo) { alvo = agarre; fatorCabeca = 2; }
    else if (apont) { const p = mundoDe(apont.id, _vOlhar); if (p) alvo = telaDe(p); if (apont.kind === 'memory' || apont.kind === 'skill') fatorCabeca = 0.45; }
    else if (S.forcado) alvo = S.forcado;
    else if (S.hover) { const p = mundoDe(S.hover.id, _vOlhar); if (p) alvo = telaDe(p); if (S.hover.kind === 'memory' || S.hover.kind === 'skill') fatorCabeca = 0.45; }
    else if (mouse.ativo && now - mouse.ultimo < 5000) alvo = mouse;
    // sem mouse (ou parado): olha para quem usa (centro da câmera) e só começa a olhar em volta depois de
    // ~5 s sem nada acontecer, contados do fim do boot ou do último movimento
    else if (!S.emBoot && now - Math.max(S.fimBoot, mouse.ativo ? mouse.ultimo : -1e9) >= 5000) ocioso = true;
    let yawT = 0, pitchT = 0, gx = 0, gy = 0;
    const dormindo = baseNome === 'dormindo' && expressaoAtual() === 'dormindo';
    if (alvo) {
      const dx = (alvo.x - cc.x) / (W * 0.5), dy = (alvo.y - cc.y) / (H * 0.5);
      yawT = clamp(dx * 1.15, -1, 1) * YAW_MAX * fatorCabeca; pitchT = clamp(dy * 1.25, -1, 1) * PITCH_MAX * fatorCabeca;
      gx = clamp(dx * 1.7, -1, 1); gy = clamp(dy * 1.9, -1, 1);
    } else if (dormindo) {
      pitchT = PITCH_MAX * 0.45; gy = 0.4;          // dormindo: cabeça um pouco baixa, parada
    } else if (ocioso && !reduzido) {
      yawT = YAW_MAX * (0.42 * Math.sin(t * 0.31) + 0.14 * Math.sin(t * 0.83 + 1.3));
      pitchT = PITCH_MAX * (0.32 * Math.sin(t * 0.23 + 0.7) - 0.1);
      gx = clamp(yawT / YAW_MAX * 1.5 + 0.25 * Math.sin(t * 0.6), -1, 1); gy = clamp(pitchT / PITCH_MAX * 1.4, -1, 1);
    }
    // boot: até os olhos abrirem e o "feliz" do passo 3 passar, o robô fica de frente para quem usa
    if (S.emBoot && (S.boot < 0.05 || S.orb < 0.05)) { yawT *= 0.2; pitchT = pitchT * 0.2 + (S.boot < 0.05 ? 0.06 : 0); gx *= 0.2; gy *= 0.2; }
    S.gaze.x = gx; S.gaze.y = gy;
    // mola amortecida
    const K = reduzido ? 60 : 34, C = 2 * Math.sqrt(K) * (reduzido ? 1 : 0.62);
    S.vyaw += (K * (yawT - S.yaw) - C * S.vyaw) * dt; S.yaw += S.vyaw * dt;
    S.vpitch += (K * (pitchT - S.pitch) - C * S.vpitch) * dt; S.pitch += S.vpitch * dt;
    S.roll = amortecer(S.roll, clamp(-S.vyaw * 0.05, -0.08, 0.08), 6, dt);
    const resp = reduzido ? 0 : Math.sin(t * 1.6) * 0.012;
    pivo.rotation.set(S.pitch, S.yaw, S.roll);
    orbitas.rotation.set(S.pitch * 0.3, S.yaw * 0.32, 0);
    corpo.rotation.y = S.yaw * 0.12;
    // pulo
    S.vpulo += (-90 * S.pulo - 9 * S.vpulo) * dt; S.pulo += S.vpulo * dt;
    // deslocar
    S.desl = reduzido ? S.deslAlvo : amortecer(S.desl, S.deslAlvo, 4.2, dt);
    rig.position.set(S.desl * visW, resp + S.pulo * 0.55, 0);   // pulo do clique na cabeça: ~14 px no pico
    // deslocado (leitor aberto): o robô também encolhe para caber entre o trilho e o painel
    const escAlvo = escalaAlvo();
    S.esc = reduzido ? escAlvo : amortecer(S.esc, escAlvo, 4.2, dt);
    rig.scale.setScalar(S.esc);
    if (Math.abs(S.vpulo) > 1e-3) rig.scale.y = S.esc * (1 + clamp(S.vpulo * 0.014, -0.05, 0.05));   // estica subindo, achata caindo

    /* --- Piscadas --- */
    const ex = expressaoAtual();
    if (now > S.proxPisca) { if (['neutro', 'lendo', 'procurando', 'pensando', 'feliz'].includes(ex) && !S.emBoot) rosto.piscar(); S.proxPisca = now + 3000 + Math.random() * 3000; }
    rosto.atualizar(dt, t, S.gaze);

    /* --- Luz geral (boot) --- */
    for (const l of luzes) l.intensity = l.userData.base * S.luz;
    for (const m of mats) m.envMapIntensity = m.userData.env * S.luz * S.luz;
    matFundo.color.setScalar(lerp(0.3, 1, S.luz));
    const fx = qual === 'alta' ? 1 : 0; matReflexo.opacity = 0.32 * S.luz;
    matAnelOrelha.emissiveIntensity = 3 * S.orelhas * (reduzido ? 1 : 0.85 + 0.15 * Math.sin(t * 2.2));
    S.logoHover = amortecer(S.logoHover, S.logoHoverAlvo || 0, 10, dt); S.logoPulso = Math.max(0, (S.logoPulso || 0) - dt * 2);
    matLogoVerm.emissiveIntensity = 0.16 + 0.5 * S.logoHover + 1.2 * S.logoPulso; matLogoAzul.emissiveIntensity = 0.05 + 0.9 * S.logoHover + 1.6 * S.logoPulso;
    matLuzLinha.color.copy(C_HOLO).multiplyScalar(2.2 * lerp(0.1, 1, S.orelhas));
    // contorno
    matContorno.uniforms.uVarre.value = S.varre;
    matContorno.uniforms.uInt.value = S.contornoInt * (reduzido ? 1 : 0.85 + 0.15 * Math.sin(t * 1.3));
    matContorno.uniforms.uCentro.value.copy(cabeca.localToWorld(_w.set(0, 0.15, 0))).applyMatrix4(camera.matrixWorldInverse);
    // fundo
    for (const a of aneisHud) { a.rotation.z += dt * a.userData.vel * (reduzido ? 0 : 1); a.material.opacity = a.userData.op * S.luz; }
    auraFundo.material.opacity = 0.55 * lerp(0.3, 1, S.luz);
    fundo.position.x = -S.yaw * 0.6 + rig.position.x * 0.15;
    if (!reduzido) { const pa = poeira.geometry.attributes.position.array; for (let i = 1; i < pa.length; i += 3) { pa[i] += dt * 0.05; if (pa[i] > 6) pa[i] = -6; } poeira.geometry.attributes.position.needsUpdate = true; }
    atualizarTom(dt, t);   // saúde: cor da cúpula e clarão

    /* --- Cúpula: neurônios, sinapses, pulsos --- */
    matNeur.uniforms.uTempo.value = t; matNeur.uniforms.uBrilho.value = lerp(1.25, 1.0, fx); matNeur.uniforms.uBoot.value = S.boot; matAneis.uniforms.uTempo.value = t;
    // campo da mão: posição, raio e força suavizados (sem alocar: só números e o Vector2 do uniform)
    if (maoCampo.ativo || maoCampo.forca !== 0) {
      maoCampo.forca = amortecer(maoCampo.forca, maoCampo.aforca, 6, dt);
      if (!maoCampo.ativo && Math.abs(maoCampo.forca) < 0.004) maoCampo.forca = 0;
      maoCampo.x = amortecer(maoCampo.x, maoCampo.ax, 16, dt); maoCampo.y = amortecer(maoCampo.y, maoCampo.ay, 16, dt);
      maoCampo.raio = amortecer(maoCampo.raio, maoCampo.araio, 8, dt);
      const pr = renderer.getPixelRatio(), u = matNeur.uniforms;
      u.uMao.value.set(maoCampo.x * pr, (H - maoCampo.y) * pr);
      u.uMaoRaio.value = maoCampo.raio * pr; u.uMaoDesloc.value = maoCampo.raio * 0.3 * pr; u.uMaoForca.value = maoCampo.forca;
    } else if (matNeur.uniforms.uMaoForca.value !== 0) matNeur.uniforms.uMaoForca.value = 0;
    matLinhas.uniforms.uRevela.value = S.revela;
    for (const nv of nevoas) nv.material.opacity = S.ocultos.has(nv.userData.dept) ? 0 : nv.userData.op * clamp(S.boot) * (S.destaque ? 0.5 : 1);
    if (ondaT0 > 0) { const e = (now - ondaT0) / 1100; if (e >= 1) { onda.visible = false; ondaT0 = -1; if (ondaClarao) { ondaClarao = false; matOnda.color.copy(C_ONDA); } } else { onda.visible = true; const s = lerp(0.05, RAIO_CORTE * 0.95, sai(e)); onda.scale.set(s, 1, s); matOnda.opacity = (1 - e) * 0.9; } }
    if (neur) {
      const N = neur.lista.length, aA = neur.geo.attributes.aAlfa, aH = neur.geo.attributes.aHi, aN = neur.geo.attributes.aNovo;
      let mudou = false;
      for (const [id, p] of S.puxados) if (p.ate !== Infinity && now - p.ate > 1800) S.puxados.delete(id);
      for (let i = 0; i < N; i++) {
        const n = neur.lista[i];
        let alfaT = 1, hiT = 0, taxa = 8;
        if (S.destaque) { const em = S.destaque.has(n.id); alfaT = em ? 1 : 0.16; hiT = em ? 0.75 : 0; }
        const pux = S.puxados.get(n.id);
        if (pux) { if (pux.ate === Infinity) { hiT = 1.25; alfaT = 1; } else taxa = 1.6; }
        if ((S.hover && S.hover.id === n.id) || S.apontado === n.id) hiT = Math.max(hiT, 1.0);
        // departamento escondido no filtro do menu: apaga (a nota aberta no leitor continua acesa)
        if (S.ocultos.size && n.kind === 'memory' && S.ocultos.has(n.dept) && !(pux && pux.ate === Infinity)) { alfaT = 0; hiT = 0; }
        const a0 = neur.alfaAtual[i], h0 = neur.hiAtual[i];
        const a1 = amortecer(a0, alfaT, taxa, dt), h1 = amortecer(h0, hiT, taxa, dt);
        if (Math.abs(a1 - a0) > 1e-4 || Math.abs(h1 - h0) > 1e-4) { neur.alfaAtual[i] = a1; neur.hiAtual[i] = h1; aA.array[i] = a1; aH.array[i] = h1; mudou = true; }
        const ini = novosIni.get(n.id); const nv = ini != null ? clamp(1 - (t - ini) / 20) : 0;
        if (Math.abs(aN.array[i] - nv) > 1e-3) { aN.array[i] = nv; aN.needsUpdate = true; }
      }
      if (mudou) { aA.needsUpdate = true; aH.needsUpdate = true; }
      for (const [id, ini] of novosIni) if (t - ini > 21) novosIni.delete(id);
    }
    if (arestas && arestas.lista.length && arestas.linhas.visible) {
      const la = arestas.geo.attributes.aAlfa; let mudou = false;
      hiIds.clear(); for (const [id, p] of S.puxados) if (p.ate === Infinity) hiIds.add(id);
      const oculta = n => S.ocultos.size > 0 && n.kind === 'memory' && S.ocultos.has(n.dept) && !hiIds.has(n.id);
      for (let k = 0; k < arestas.lista.length; k++) {
        const e = arestas.lista[k], na = neur.lista[e.ia], nb = neur.lista[e.ib];
        let alvoA = 0.04;
        if (S.destaque) alvoA = (S.destaque.has(na.id) || S.destaque.has(nb.id)) ? 0.32 : 0.015;
        // muitas conexões somam luz demais: o realce cai com o número de ligações da nota
        if (S.hover && (S.hover.id === na.id || S.hover.id === nb.id)) alvoA = realce(S.hover, 0.55);
        if (hiIds.has(na.id) || hiIds.has(nb.id)) alvoA = Math.max(alvoA, realce(hiIds.has(na.id) ? na : nb, 0.8));
        e.oculta = oculta(na) || oculta(nb);
        if (e.oculta) alvoA = 0;
        const a1 = amortecer(e.alfa, alvoA, 7, dt);
        if (Math.abs(a1 - e.alfa) > 1e-4) { e.alfa = a1; const o = k * arestas.SEG * 2; for (let s = 0; s < arestas.SEG * 2; s++) la.array[o + s] = a1; mudou = true; }
      }
      if (mudou) la.needsUpdate = true;
      // pulsos
      if (pulsos && pulsos.pontos.visible) {
        const pa = pulsos.geo.attributes.position.array, pc = pulsos.geo.attributes.color.array, pal = pulsos.geo.attributes.aAlfa.array;
        pref.length = 0; for (const id of hiIds) pref.push(id); if (S.destaque) for (const id of S.destaque) pref.push(id);
        const q = _vPulso;
        pulsos.lista.forEach((pl, i) => {
          if (reduzido) { pal[i] = 0; return; }
          if (pl.e < 0) {
            pl.espera -= dt; pal[i] = 0;
            if (pl.espera <= 0 && S.revela > 0.5) {
              let cand = -1;
              if (pref.length && pulsos.r() < 0.5) { const alvoId = pref[Math.floor(pulsos.r() * pref.length)]; const ii = neur.idx.get(alvoId); const lst = []; arestas.lista.forEach((e, k) => { if (e.ia === ii || e.ib === ii) lst.push(k); }); if (lst.length) cand = lst[Math.floor(pulsos.r() * lst.length)]; }
              if (cand < 0) cand = Math.floor(pulsos.r() * arestas.lista.length);
              if (arestas.lista[cand].oculta) { pl.espera = 0.2; return; }
              pl.e = cand; pl.t = 0; pl.dur = 0.7 + pulsos.r() * 0.9; pl.inv = pulsos.r() < 0.5;
              const e = arestas.lista[cand], ia = pl.inv ? e.ib : e.ia; const c = neur.geo.attributes.color.array;
              pc[i * 3] = lerp(c[ia * 3], 1, 0.45); pc[i * 3 + 1] = lerp(c[ia * 3 + 1], 1, 0.45); pc[i * 3 + 2] = lerp(c[ia * 3 + 2], 1, 0.45);
            }
            return;
          }
          pl.t += dt / pl.dur;
          if (pl.t >= 1) { pl.e = -1; pl.espera = 0.3 + pulsos.r() * (S.destaque || hiIds.size ? 0.6 : 3.2); pal[i] = 0; return; }
          const e = arestas.lista[pl.e]; if (e.oculta) { pl.e = -1; pl.espera = 0.3; pal[i] = 0; return; }
          arestas.bez(e, pl.inv ? 1 - pl.t : pl.t, q);
          pa[i * 3] = q.x; pa[i * 3 + 1] = q.y; pa[i * 3 + 2] = q.z;
          pal[i] = Math.sin(Math.PI * pl.t) * (0.6 + 0.6 * e.alfa) * S.revela;
        });
        pulsos.geo.attributes.position.needsUpdate = pulsos.geo.attributes.color.needsUpdate = pulsos.geo.attributes.aAlfa.needsUpdate = true;
      }
    }

    /* --- Órbitas --- */
    const orbE = clamp(S.orb);
    halo.visible = orbE > 0.001; sat.visible = orbE > 0.001;
    if (halo.visible) {
      // cursor sobre uma conta (ou a conta apontada pela lista de rotinas): o anel para (a dica e o olhar não perdem o item)
      const paraHalo = reduzido || (S.hover && S.hover.kind === 'routine') || (apont && apont.kind === 'routine');
      haloGiro.rotation.y += dt * (paraHalo ? 0 : 0.16 + (1 - orbE) * 3.5);
      const s = lerp(0.55, 1, saiVolta(orbE)); haloGiro.scale.setScalar(s); haloLinha.scale.setScalar(s); haloGlow.scale.setScalar(s);
      matHaloLinha.opacity = 0.55 * orbE; matHaloGlow.opacity = 0.07 * orbE;
      if (contas) {
        let mudou = false;
        contas.nos.forEach((n, i) => {
          const foco = (S.hover && S.hover.id === n.id) || S.apontado === n.id, puxada = S.puxados.get(n.id)?.ate === Infinity;
          let alvoB = contas.alvo[i] * orbE; if (foco) alvoB = 1.8; if (puxada) alvoB = 2;
          const b = amortecer(contas.brilho[i], alvoB, 8, dt); if (Math.abs(b - contas.brilho[i]) > 1e-3) { contas.brilho[i] = b; contas.mesh.setColorAt(i, _cor.copy(C_ROTINA).multiplyScalar(1.7 * b)); mudou = true; }
          // a conta da rotina aberta no funil fica um pouco maior (acesa) enquanto o painel está aberto
          contas.esc[i] = amortecer(contas.esc[i], foco ? 1.6 : puxada ? 1.3 : 1, 12, dt); const sc = contas.esc[i];
          m4.makeScale(sc, sc, sc).setPosition(Math.cos(contas.ang[i]) * R_HALO, 0, Math.sin(contas.ang[i]) * R_HALO); contas.mesh.setMatrixAt(i, m4);
        });
        contas.mesh.instanceMatrix.needsUpdate = true; if (mudou) contas.mesh.instanceColor.needsUpdate = true;
      }
    }
    if (sat.visible) {
      sat.updateWorldMatrix(true, false); sat.getWorldQuaternion(tmpQ).invert(); tmpQ2.copy(camera.quaternion);
      const rr = R_SAT * lerp(2.4, 1, saiVolta(orbE));
      const paraSat = reduzido || (S.hover && S.hover.kind === 'app');   // cursor sobre um satélite: a órbita para
      const ts = reduzido ? 0 : t;                                        // movimento reduzido: sem balanço nem flutuação
      satelites.forEach((s, i) => {
        s.ang += dt * (paraSat ? 0 : 0.065 + (1 - orbE) * 1.2);
        s.grupo.position.set(Math.cos(s.ang) * rr, Math.sin(ts * 0.7 + i) * 0.04, Math.sin(s.ang) * rr);
        s.grupo.quaternion.copy(tmpQ).multiply(tmpQ2);
        s.grupo.rotateZ(Math.sin(ts * 0.5 + i * 1.7) * 0.12);
        let alvoB = s.alvo; if (S.hover === s.no || S.apontado === s.no.id) alvoB = 1.4; if (S.puxados.get(s.no.id)?.ate === Infinity) alvoB = 1.6;
        s.brilho = amortecer(s.brilho, alvoB, 8, dt);
        const op = clamp(orbE * Math.min(1, s.brilho));
        s.mats.forEach(m => { m.opacity = op; });
        s.mats[1].color.copy(C_APP).multiplyScalar(0.9 * Math.max(0.3, s.brilho));
        s.esc = amortecer(s.esc, S.hover === s.no ? 1.18 : 1, 12, dt);
        s.grupo.scale.setScalar(0.92 * s.esc);
      });
    }
    atualizarVoos(now);
    atualizarFaiscas(dt);
    aplicarMergulho();
  }
  // câmera do modo Jarvis: segue os olhos (a cabeça e o rig andam) enquanto mergulhoAlvo > 0; no 0 volta exata
  function aplicarMergulho() {
    const f = mergulhoAlvo;
    if (f <= 0 && mergulhoAplicado === 0) return;
    if (f <= 0) { camera.position.copy(camBase); camera.lookAt(camOlha); mergulhoAplicado = 0; return; }
    rig.updateMatrixWorld(true);
    ancoraOlhos.getWorldPosition(_vMerg);
    camera.position.copy(camBase).lerp(_vMerg, 0.35 * f);
    camera.lookAt(_vMira.copy(camOlha).lerp(_vMerg, Math.min(1, f * 1.15)));
    mergulhoAplicado = f;
  }

  /* ---- Qualidade, pausa, sinapses ---- */
  function qualidade(q) {
    q = q === 'baixa' ? 'baixa' : 'alta'; if (q === qual) return; qual = q; medicao.feito = true; redimensionar();
  }
  function sinapses(v) { S.sinapses = !!v; if (arestas) arestas.linhas.visible = S.sinapses; if (pulsos) pulsos.pontos.visible = S.sinapses && arestas && arestas.lista.length > 0; }
  function pausar(v) { S.pausado = !!v; ajustarLaco(); }
  function olharPara(p) { S.forcado = p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null; }
  // extra: aponta um nó de fora (item da lista de rotinas em foco, conta saindo do halo): o robô olha para ele,
  // o item acende e cresce como no hover e, se for uma conta, o anel para. null solta.
  function apontar(id) { S.apontado = id != null && noPorId.has(id) ? id : null; }
  // deslocar(fracaoX, escala?): escala opcional (0,4–1) para o robô caber no espaço livre; sem ela, encolhe 14% em ±0,18.
  function deslocar(f, esc) { S.deslAlvo = clamp(Number(f) || 0, -0.45, 0.45); S.escFixa = Number.isFinite(esc) && esc > 0 ? clamp(esc, 0.4, 1) : null; }
  function escalaAlvo() { return S.escFixa != null && S.deslAlvo !== 0 ? S.escFixa : 1 - 0.14 * clamp(Math.abs(S.deslAlvo) / 0.18); }
  // extra: a pessoa ligou/desligou "reduzir movimento" com a página aberta
  function reduzir(v) {
    reduzido = !!v;
    matNeur.uniforms.uDeriva.value = reduzido ? 0 : 1;
    matNeur.uniforms.uReduz.value = matAneis.uniforms.uReduz.value = reduzido ? 1 : 0;
  }
  /* ---- Modo Mãos (MAOS.md §3, Integração) ---- */
  const finito = p => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  // agarrar({x,y}|null): punho fechado; a cabeça segue esse ponto de tela (px do canvas) com o dobro da
  // amplitude até receber null
  function agarrar(p) {
    if (finito(p)) { agarre.ativo = true; agarre.x = p.x; agarre.y = p.y; } else agarre.ativo = false;
  }
  // campoMao({x,y,raio,forca}|null): cursor da mão sobre a cúpula (px do canvas). forca > 0 afasta e acende os
  // neurônios perto dele; forca < 0 (pinça) puxa para o cursor; null desliga devagar. raio em px (20–600).
  function campoMao(c) {
    if (!finito(c)) { maoCampo.ativo = false; maoCampo.aforca = 0; return; }
    const raio = clamp(Number(c.raio) || 110, 20, 600), forca = clamp(Number.isFinite(Number(c.forca)) ? Number(c.forca) : 1, -1.5, 1.5);
    if (!maoCampo.ativo && maoCampo.forca === 0) { maoCampo.x = c.x; maoCampo.y = c.y; maoCampo.raio = raio; }   // nasce onde a mão está (não desliza do lugar antigo)
    maoCampo.ativo = true; maoCampo.ax = c.x; maoCampo.ay = c.y; maoCampo.araio = raio; maoCampo.aforca = forca;
  }
  // pular(): pulinho de comemoração (joinha) com faíscas saindo do topo da cúpula
  function pular() {
    if (reduzido) return;
    S.vpulo += 2.6;
    domo.updateWorldMatrix(true, false);
    const topo = domo.localToWorld(new THREE.Vector3(0, DOMO_ALT - CORTE, 0));
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(domo.getWorldQuaternion(new THREE.Quaternion()));
    soltarFaiscas(topo, normal);
  }
  // olharEmVolta(): a mão saiu da câmera; esquece o último ponteiro (e o hover dele) e volta a olhar em volta
  function olharEmVolta() { aoSair(); mouse.ativo = false; mouse.vel = 0; agarre.ativo = false; }

  /* ---- Modo Jarvis (JARVIS.md §7.5): a câmera mergulha no visor e os olhos viram um ponto de luz ---- */
  // visor() -> {x,y}: ponto de tela (px do canvas) do meio dos olhos, de onde o HUD nasce e para onde ele volta
  function visor() { rig.updateMatrixWorld(true); camera.updateMatrixWorld(); const t = telaDe(ancoraOlhos.getWorldPosition(_w)); return { x: t.x, y: t.y }; }
  // mergulho(0..1): 0 = enquadramento de sempre; 1 = câmera ~35% mais perto, mirando os olhos. Quem anima é o HUD.
  // Com o robô pausado o quadro é desenhado na hora (a transição continua visível).
  function mergulho(f) { mergulhoAlvo = clamp(Number(f) || 0); if (S.pausado && !S.destruido && !S.perdido) passo(agora()); }
  // olhosPonto(0..1): 0 = rosto normal; 0,5 = olhos achatados numa linha; 1 = um ponto de luz no meio do visor
  function olhosPonto(f) { rosto.ponto(f); }

  /* ---- Saúde dos sistemas (GUARDIAO.md §7): a cúpula ganha a cor do estado ---- */
  // saude('ok'|'atencao'|'falha'|'sem_dado'|null): atenção = leve tom âmbar na borda do vidro e no chão da cúpula;
  // falha = tom vermelho, um pouco mais forte. ok e sem dado: volta ao ciano de sempre (sem dado não assusta).
  // clarao('falha'|'atencao'): clarão na cúpula (incidente novo com a página aberta). Reduzir movimento: só um fade curto.
  const C_VIDRO = corHex(COR.vidroBorda), C_TOM_ATENCAO = corHex(COR.rever), C_TOM_FALHA = corHex(COR.alerta), C_ONDA = matOnda.color.clone();
  const C_CHAO = matChaoBrilho.color.clone();
  const tom = { alvo: 0, v: 0, cor: C_VIDRO.clone(), corAlvo: C_VIDRO.clone(), clarao: 0, corClarao: C_TOM_FALHA.clone() };
  const _corTom = new THREE.Color();
  function saudeRobo(estado) {
    if (estado === 'falha') { tom.corAlvo.copy(C_TOM_FALHA); tom.alvo = 1; }
    else if (estado === 'atencao') { tom.corAlvo.copy(C_TOM_ATENCAO); tom.alvo = 0.62; }
    else tom.alvo = 0;
    if (reduzido && tom.alvo > 0) tom.cor.copy(tom.corAlvo);
  }
  function clarao(estado) {
    tom.corClarao.copy(estado === 'atencao' ? C_TOM_ATENCAO : C_TOM_FALHA);
    tom.clarao = reduzido ? 0.55 : 1;
    if (!reduzido) { ondaT0 = agora(); ondaClarao = true; matOnda.color.copy(tom.corClarao).multiplyScalar(2.4); }
  }
  function atualizarTom(dt, t) {
    if (tom.alvo === 0 && tom.v < 0.002 && tom.clarao <= 0) { if (tom.v !== 0) { tom.v = 0; aplicarTom(0); } return; }
    if (tom.alvo > 0) tom.cor.lerp(tom.corAlvo, reduzido ? 1 : 1 - Math.exp(-3 * dt));
    tom.v = reduzido ? tom.alvo : amortecer(tom.v, tom.alvo, 1.4, dt);
    tom.clarao = Math.max(0, tom.clarao - dt * (reduzido ? 2.2 : 0.9));
    aplicarTom(reduzido ? 1 : 0.86 + 0.14 * Math.sin(t * 2.3));
  }
  function aplicarTom(pulso) {
    const c2 = tom.clarao * tom.clarao;
    const u = matBordaVidro.uniforms, ut = matBordaVidroTras.uniforms;
    u.uCor.value.copy(C_VIDRO).lerp(tom.cor, Math.min(1, tom.v * 0.9));
    if (tom.clarao > 0) u.uCor.value.lerp(tom.corClarao, Math.min(1, tom.clarao * 1.2));
    u.uInt.value = 0.3 + 0.45 * tom.v * pulso + 1.5 * c2;
    ut.uCor.value.copy(u.uCor.value);
    ut.uInt.value = 0.06 + 0.08 * tom.v * pulso + 0.45 * c2;
    matChaoBrilho.color.copy(C_CHAO).lerp(_corTom.copy(tom.cor).multiplyScalar(0.95), tom.v * 0.62);
    if (tom.clarao > 0) matChaoBrilho.color.lerp(_corTom.copy(tom.corClarao).multiplyScalar(1.6), Math.min(1, c2 * 0.8));
  }

  // extra: departamentos escondidos pelo filtro do menu (Set de nomes); os neurônios deles se apagam
  function ocultar(nomes) { S.ocultos = new Set(nomes || []); if (S.hover && S.hover.kind === 'memory' && S.ocultos.has(S.hover.dept)) definirHover(null, { x: mouse.x, y: mouse.y }); }

  function destruir() {
    if (S.destruido) return; S.destruido = true; bootTok++;
    ajustarLaco();
    window.removeEventListener('pointermove', aoMover); window.removeEventListener('pointerdown', aoTocarFora);
    canvas.removeEventListener('pointerdown', aoDescer); canvas.removeEventListener('pointerup', aoSubir); canvas.removeEventListener('pointerleave', aoSair);
    document.removeEventListener('pointerleave', aoSair); document.removeEventListener('visibilitychange', aoVisibilidade);
    canvas.removeEventListener('webglcontextlost', aoPerder); canvas.removeEventListener('webglcontextrestored', aoRestaurar);
    if (ro) ro.disconnect(); else window.removeEventListener('resize', redimensionar);
    for (const tw of tweens) { clearTimeout(tw.seguro); tw.res(); } tweens.clear();
    for (const v of [...voos]) { v.res(); removerVoo(v); }
    limparGrafo();
    rosto.dispose();
    for (const o of descartaveis) { try { o.dispose(); } catch (e) { /* já liberado */ } }
    scene.traverse(o => { if (o.material && o.material.map && o.material.map.dispose) o.material.map.dispose(); });
    if (rtBrilho) { rtBrilho.dispose(); bloom.dispose(); }
    if (rtAmbiente) rtAmbiente.dispose();
    renderer.dispose();
    canvas.style.cursor = '';
  }

  /* ---- Início ---- */
  temp = { nome: 'apagado', ate: Infinity }; rosto.alvo('apagado');
  S.contornoInt = 0.7; S.varre = 0.0;
  redimensionar();
  scene.updateMatrixWorld(true);
  try { renderer.compile(scene, camera); } catch (e) { /* compila sob demanda */ }
  ajustarLaco();
  // pré-boot: escuro, com os mesmos valores do início do passo 1 (o contorno só é desenhado pelo boot)
  S.varre = 0; S.contornoInt = 1.6; S.luz = 0.03;

  return {
    setGrafo, boot, expressao, base, olharPara, destacar, faisca, pulsoNovo, puxar, devolver,
    projetar, testa, cupula, deslocar, sinapses, qualidade, pausar, redimensionar, destruir,
    cabeca: cabecaTela, reduzir, ocultar, apontar,
    agarrar, campoMao, pular, olharEmVolta,   // modo Mãos (MAOS.md §3)
    saude: saudeRobo, clarao,                  // saúde dos sistemas (GUARDIAO.md §7)
    visor, mergulho, olhosPonto,               // modo Jarvis (JARVIS.md §7.5)
    get expressoes() { return EXPRESSOES.slice(); },
  };
}
