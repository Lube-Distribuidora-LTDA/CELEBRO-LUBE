// js/aneis.js — Mapa em anéis do Cérebro da Lube (canvas 2D).
// Visão alternativa ao robô e reserva quando o WebGL falha. Porte fiel do painel antigo:
// layout em anéis, varredura, réguas, hubs de departamento, skills, rotinas, aplicações, logo no centro,
// seleção e conexões, notas novas piscando, pan/zoom/pinça/roda, duplo clique aproxima, hit test e
// tween de câmera. Só tema escuro: as cores vêm dos tokens do CSS (§3), com reserva idêntica aqui.
// Não mexe em nenhum elemento fora do canvas recebido: dica e seleção saem pelos callbacks.
import { corDe, COR_TIPO, rng, hash, initials } from './dados.js';

/* ---------- Tokens (reserva = §3 do contrato; o valor real é lido do CSS) ---------- */
const TOKENS_RESERVA = {
  '--bg':'#050b1c', '--surface':'#0d1830', '--surface-2':'#132242', '--line':'#1f3463',
  '--ink':'#e8eeff', '--muted':'#8a97c4', '--azul':'#2a41c8', '--vermelho':'#e5202c',
  '--holo':'#45d4ff', '--logo-azul':'#16218A', '--logo-vermelho':'#F20D1F', '--novo':'#5fb2ff',
  '--display':'"Archivo", "Arial Black", system-ui, sans-serif',
  '--body':'"IBM Plex Sans", system-ui, "Segoe UI", sans-serif',
  '--mono':'"JetBrains Mono", ui-monospace, Consolas, monospace'
};
const TIPO_RESERVA = { core:'#F20D1F', skill:'#3DA9FF', routine:'#FF2D46', app:'#9EB2FF' };
const BRANCO_LOGO = '#FFFFFF'; // contorno branco da logo da Lube (§2)

/* ---------- Geometria do mapa (unidades de mundo, iguais ao antigo) ---------- */
const R = { core:44, skill:128, hub:166, memIn:196, memOut:336, disc:350, rout:410, app:468 };
const TAU = Math.PI * 2;
const DUR_REVELAR = 1300, DUR_ONDA = 1500, DUR_FRESCO = 25000;

/* ---------- Cores ---------- */
const _rgb = new Map();
function rgbDe(c){
  c = String(c || '').trim();
  let v = _rgb.get(c); if (v) return v;
  let r = 0, g = 0, b = 0, m;
  if (c[0] === '#'){
    let h = c.slice(1); if (h.length === 3 || h.length === 4) h = h.split('').map(x => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16); if (!Number.isNaN(n)){ r = n >> 16 & 255; g = n >> 8 & 255; b = n & 255; }
  } else if ((m = c.match(/rgba?\(([^)]+)\)/i))){
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); r = p[0] || 0; g = p[1] || 0; b = p[2] || 0;
  }
  v = [r, g, b]; _rgb.set(c, v); return v;
}
function alpha(c, a){ const [r, g, b] = rgbDe(c); return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`; }

function prefereMenosMovimento(){ try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

/**
 * Cria o mapa em anéis no canvas recebido.
 * @param {HTMLCanvasElement} canvas  o #aneis
 * @param {{onSelecionar?:(no:object|null)=>void, onHover?:(no:object|null, p:{x:number,y:number})=>void, reduzido?:boolean}} opts
 * @returns {{setGrafo:Function, destacar:Function, selecionar:Function, centralizar:Function, ativar:Function, redimensionar:Function, destruir:Function}}
 */
export function criarAneis(canvas, opts = {}){
  if (!canvas || typeof canvas.getContext !== 'function') throw new Error('Canvas do mapa em anéis não encontrado.');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
  let reduzido = opts.reduzido ?? prefereMenosMovimento();

  const S = {
    G:null, sel:null, hover:null, ativo:false,
    destaque:new Set(),        // ids acesos (Claude buscando/lendo, departamento escolhido)
    frescos:new Map(),         // id -> instante (notas novas ou alteradas)
    mostrarTodas:false,        // todas as conexões (sinapses)
    brilho:true,               // sombras/brilhos (qualidade alta)
    spin:reduzido ? 0 : .15, giro:.15, rot:0,   // giro = valor do controle "Giro da memória"; spin = o que vale agora
    nomes:false,               // "Mostrar nomes das notas"
    ocultos:new Set(),         // departamentos escondidos pelo filtro do menu
    cam:{ x:0, y:0, k:1 }, tween:null,
    reveal:1, revelando:false, t0:0,
    onda:null,                 // instante da onda de recarga
    desvio:0                   // fração da largura para deslocar o foco (leitor aberto)
  };
  let L = [];                  // layout por id: {r, a, rad}
  let T = {};                  // tokens lidos
  let grade = null;            // padrão dos pontinhos do fundo
  let W = 0, H = 0, DPR = 1;
  let dirty = true, raf = 0, ultimo = 0, destruido = false;

  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  canvas.style.webkitUserSelect = 'none';
  canvas.style.cursor = 'grab';

  /* ---------- Tokens ---------- */
  function lerTokens(){
    let cs = null; try { cs = getComputedStyle(canvas); } catch (e) {}
    const g = k => { let v = ''; try { v = cs ? cs.getPropertyValue(k).trim() : ''; } catch (e) {} return v || TOKENS_RESERVA[k]; };
    const tipo = k => (COR_TIPO && COR_TIPO[k]) || TIPO_RESERVA[k];
    T = {
      bg:g('--bg'), surface:g('--surface'), surface2:g('--surface-2'), line:g('--line'), ink:g('--ink'), muted:g('--muted'),
      azul:g('--azul'), vermelho:g('--vermelho'), holo:g('--holo'), logoAzul:g('--logo-azul'), logoVermelho:g('--logo-vermelho'),
      novo:g('--novo'), fDisplay:g('--display'), fCorpo:g('--body'), fMono:g('--mono'),
      skill:tipo('skill'), routine:tipo('routine'), app:tipo('app'), core:tipo('core')
    };
    criarGrade(); dirty = true;
  }
  function criarGrade(){
    grade = null;
    try {
      const passo = Math.max(8, Math.round(26 * DPR));
      const t = document.createElement('canvas'); t.width = t.height = passo;
      const g = t.getContext('2d'); if (!g) return;
      g.fillStyle = alpha(T.muted, .1); g.beginPath(); g.arc(passo / 2, passo / 2, Math.max(.6, DPR), 0, TAU); g.fill();
      grade = ctx.createPattern(t, 'repeat');
    } catch (e) { grade = null; }
  }
  const cor = n => (n && corDe(n)) || T.muted;
  const fonte = (peso, px, fam) => `${peso} ${Math.max(1, px).toFixed(1)}px ${fam}`;
  const espacar = px => { try { ctx.letterSpacing = `${px}px`; } catch (e) {} };

  /* ---------- Layout em anéis ---------- */
  function montarLayout(G){
    L = new Array(G.nodes.length);
    const ordenados = k => G.nodes.filter(n => n.kind === k).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    const skills = ordenados('skill');
    skills.forEach((n, i) => { L[n.id] = { r:R.skill, a:-Math.PI / 2 + (i + .5) * TAU / Math.max(1, skills.length), rad:0 }; });
    const routs = ordenados('routine');
    routs.forEach((n, i) => { L[n.id] = { r:R.rout, a:-Math.PI / 2 + (i + .5) * TAU / Math.max(1, routs.length), rad:0 }; });
    const apps = ordenados('app');
    apps.forEach((n, i) => { L[n.id] = { r:R.app, a:-Math.PI / 2 + i * TAU / Math.max(1, apps.length), rad:0 }; });
    if (G.core) L[G.core.id] = { r:0, a:0, rad:0 };
    // Memória: um setor por departamento, notas em arcos de pontos (departamentos escondidos saem do mapa
    // e os visíveis ocupam a volta toda, como no antigo)
    const vis = (G.depts || []).filter(d => !S.ocultos.has(d.name));
    for (const d of G.depts || []){
      if (!S.ocultos.has(d.name)) continue;
      if (d.hub) L[d.hub.id] = { r:null, a:0, rad:0 };
      for (const n of d.list) L[n.id] = { r:null, a:0, rad:0 };
    }
    const minShare = 6, gap = vis.length > 1 ? 0.07 : 0;
    const total = vis.reduce((a, d) => a + Math.max(minShare, d.list.length), 0) || 1;
    const span = TAU - gap * vis.length;
    let a0 = -Math.PI / 2 - 0.35;
    for (const d of vis){
      const sweep = span * Math.max(minShare, d.list.length) / total;
      const d0 = a0, d1 = a0 + sweep;
      if (d.hub) L[d.hub.id] = { r:R.hub, a:a0 + sweep / 2, rad:0 };
      const list = d.list.slice().sort((x, y) => (y.links.size + y.back.size) - (x.links.size + x.back.size) || ((y.mtime || 0) - (x.mtime || 0)));
      const rowsN = Math.floor((R.memOut - R.memIn) / 11) + 1;
      let spacing = 8.5;
      const capOf = sp => { let c = 0; for (let k = 0; k < rowsN; k++) c += Math.max(1, Math.floor(sweep * (R.memIn + k * 11) / sp)); return c; };
      let cap = capOf(spacing);
      while (cap < list.length && spacing > 2.4){ spacing *= Math.max(.8, Math.sqrt(cap / list.length) * .98); cap = capOf(spacing); }
      const rr = rng(hash(d.name));
      const rowCap = kk => Math.max(1, Math.floor(sweep * (R.memIn + kk * 11) / spacing));
      let k = 0, j = 0, startJ = rr() * 0.25;
      for (const n of list){
        if (j >= rowCap(k)){ k++; j = 0; startJ = rr() * 0.25; if (k >= rowsN) k = rowsN - 1; }
        const r = R.memIn + k * 11; const step = spacing / r;
        let a = d0 + startJ * step + j * step;
        if (a > d1) a = d0 + (a - d0) % sweep;
        L[n.id] = { r:r + (rr() - .5) * 2.2, a, rad:0 };
        j++;
      }
      a0 += sweep + gap;
    }
    for (const n of G.nodes){
      const p = L[n.id]; if (!p) continue;
      const deg = n.links.size + n.back.size;
      p.rad = n.kind === 'memory' ? 1.4 + Math.min(2.6, Math.log10(10 + (n.size || 0)) * .45 + Math.min(1.2, deg * .12)) : 0;
    }
  }

  /* ---------- Câmera ---------- */
  const girando = n => n.kind === 'memory' || n.kind === 'dept';
  function mundo(n, rv = S.reveal){
    if (!n) return null; const p = L[n.id]; if (!p || p.r == null) return null;
    const a = p.a + (girando(n) ? S.rot : 0);
    return { x:Math.cos(a) * p.r * rv, y:Math.sin(a) * p.r * rv };
  }
  const tela = p => ({ x:(p.x - S.cam.x) * S.cam.k + W / 2, y:(p.y - S.cam.y) * S.cam.k + H / 2 });
  const paraMundo = (sx, sy) => ({ x:(sx - W / 2) / S.cam.k + S.cam.x, y:(sy - H / 2) / S.cam.k + S.cam.y });
  function fitK(){ if (!W || !H) return 1; return Math.min(W, H) / (2 * 505) * (W < 760 ? 1.02 : 0.96); }
  const clampK = k => Math.max(fitK() * .5, Math.min(fitK() * 12, k));
  function irPara(alvo, d){
    if (reduzido || !S.ativo){ S.cam = alvo; S.tween = null; }
    else S.tween = { from:{ ...S.cam }, to:alvo, t0:performance.now(), d };
    dirty = true;
  }
  function enquadrar(anim = true){
    const k = fitK();
    const alvo = { x:(W < 760 ? 0 : -40 / k) - S.desvio * W / k, y:W < 760 ? 20 / k : 0, k };
    if (anim) irPara(alvo, 650); else { S.cam = alvo; S.tween = null; dirty = true; }
  }
  function voarPara(n){
    const p = n.kind === 'core' ? { x:0, y:0 } : mundo(n, 1); if (!p) return;
    const fk = fitK(); const k = n.kind === 'memory' ? fk * 3.2 : n.kind === 'core' ? fk * 2 : fk * 2.4;
    irPara({ x:p.x - S.desvio * W / k, y:p.y, k }, 750);
  }
  function aproximar(n, p){
    if (n){ voarPara(n); return; }
    const w = paraMundo(p.x, p.y); const k = clampK(S.cam.k * 2);
    irPara({ x:w.x - (p.x - W / 2) / k, y:w.y - (p.y - H / 2) / k, k }, 600);
  }

  function medir(){
    let w = canvas.clientWidth, h = canvas.clientHeight;
    if ((!w || !h) && !canvas.hidden){ try { const r = canvas.getBoundingClientRect(); w = r.width; h = r.height; } catch (e) {} }
    const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    const mudouDpr = dpr !== DPR;
    W = Math.max(0, Math.round(w || 0)); H = Math.max(0, Math.round(h || 0)); DPR = dpr;
    const cw = Math.max(1, Math.round(W * DPR)), ch = Math.max(1, Math.round(H * DPR));
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    if (mudouDpr || !grade) criarGrade();
    dirty = true;
  }

  /* ---------- Desenho ---------- */
  function vizinhos(n){
    if (!n) return null;
    if (n.kind === 'dept'){ const d = S.G.depts[n.ci]; return new Set(d ? d.list.map(x => x.id) : []); }
    return new Set([...n.links, ...n.back]);
  }
  function hex(x, y, r){ ctx.beginPath(); for (let i = 0; i < 6; i++){ const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); }
  function estrela(x, y, r){ ctx.beginPath(); for (let i = 0; i < 8; i++){ const rr = i % 2 ? r * .32 : r; const a = -Math.PI / 2 + i * Math.PI / 4; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
  function rotuloAnel(texto, r, c, size){
    const p = tela({ x:0, y:-r * S.reveal });
    ctx.save(); ctx.font = fonte(600, size, T.fMono); ctx.fillStyle = c; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    espacar(size * .18); ctx.fillText(texto, p.x, p.y + 20 * Math.min(1.4, S.cam.k)); ctx.restore();
  }
  function rotuloFora(n, p, rr, c){
    const a = (L[n.id] || { a:0 }).a; const dx = Math.cos(a), dy = Math.sin(a);
    ctx.font = fonte(500, Math.max(10, Math.min(12.5, 10 * S.cam.k)), T.fCorpo); ctx.fillStyle = c;
    ctx.textAlign = Math.abs(dx) < .3 ? 'center' : dx > 0 ? 'left' : 'right'; ctx.textBaseline = Math.abs(dy) < .3 ? 'middle' : dy > 0 ? 'top' : 'bottom';
    ctx.fillText(n.name, p.x + dx * (rr + 7), p.y + dy * (rr + 7));
  }
  function logoLube(cx, cy, size){
    // Coordenadas da logo (caixa 40..830 x 20..595), centralizadas e escaladas para 'size'
    const sc = size / 790, ox = 435, oy = 307;
    const P = (x, y) => [cx + (x - ox) * sc, cy + (y - oy) * sc];
    const pL = () => { ctx.beginPath(); ctx.moveTo(...P(165, 30)); ctx.lineTo(...P(400, 30)); ctx.lineTo(...P(295, 435)); ctx.lineTo(...P(740, 435)); ctx.lineTo(...P(705, 580)); ctx.lineTo(...P(230, 580)); ctx.quadraticCurveTo(...P(48, 580), ...P(72, 410)); ctx.closePath(); };
    const pR = () => { ctx.beginPath(); ctx.moveTo(...P(430, 30)); ctx.lineTo(...P(650, 30)); ctx.quadraticCurveTo(...P(822, 34), ...P(795, 188)); ctx.lineTo(...P(748, 410)); ctx.lineTo(...P(335, 410)); ctx.closePath(); };
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = BRANCO_LOGO; ctx.lineWidth = Math.max(1.5, 34 * sc);
    pL(); ctx.stroke(); pR(); ctx.stroke();
    pL(); ctx.fillStyle = T.logoAzul; ctx.fill();
    pR(); ctx.fillStyle = T.logoVermelho; ctx.fill();
    ctx.restore();
  }
  function raioOnda(now){
    if (S.onda == null) return null;
    const e = (now - S.onda) / DUR_ONDA; if (e >= 1 || e < 0) return null;
    return { r:(1 - Math.pow(1 - e, 2)) * R.app * 1.08, e };
  }

  function desenhar(now){
    const c = ctx;
    // Fundo: cor da página, pontinhos de grade e um brilho suave (o "body" do antigo)
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = T.bg; c.fillRect(0, 0, canvas.width, canvas.height);
    if (grade){ c.fillStyle = grade; c.fillRect(0, 0, canvas.width, canvas.height); }
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!W || !H) return;
    const gb = c.createRadialGradient(W * .55, H * .5, 0, W * .55, H * .5, Math.max(W, H) * .62);
    gb.addColorStop(0, alpha(T.azul, .12)); gb.addColorStop(1, alpha(T.azul, 0));
    c.fillStyle = gb; c.fillRect(0, 0, W, H);

    const G = S.G; if (!G) return;
    const k = S.cam.k, rv = S.reveal, c0 = tela({ x:0, y:0 });
    const sel = S.sel, nb = vizinhos(sel), foco = sel ? (n => n === sel || nb.has(n.id)) : (() => true);
    const temDestaque = S.destaque.size > 0;
    const brilho = S.brilho, pulso = now / 1000;
    const onda = reduzido ? null : raioOnda(now);

    // Brilho e disco da memória
    const rG = R.app * 1.25 * k * rv;
    const g = c.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, Math.max(.1, rG));
    g.addColorStop(0, alpha(T.holo, .09)); g.addColorStop(.55, alpha(T.holo, .035)); g.addColorStop(1, alpha(T.holo, 0));
    c.fillStyle = g; c.beginPath(); c.arc(c0.x, c0.y, rG, 0, TAU); c.fill();
    c.fillStyle = alpha(T.holo, .045); c.beginPath(); c.arc(c0.x, c0.y, R.disc * k * rv, 0, TAU); c.fill();

    // Varredura (efeito de IA)
    if (!reduzido && c.createConicGradient){
      const sw = c.createConicGradient(now / 4200 % TAU, c0.x, c0.y);
      sw.addColorStop(0, alpha(T.holo, .16)); sw.addColorStop(.07, alpha(T.holo, 0)); sw.addColorStop(1, alpha(T.holo, 0));
      c.fillStyle = sw; c.beginPath(); c.arc(c0.x, c0.y, R.disc * k * rv, 0, TAU); c.fill();
    }
    // Marcas de régua no anel da memória
    c.strokeStyle = alpha(T.holo, .22); c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 120; i++){
      const a = i * Math.PI / 60, r1 = R.disc * k * rv, r2 = r1 + (i % 10 ? 4 : 10) * Math.min(1.5, k);
      c.moveTo(c0.x + Math.cos(a) * r1, c0.y + Math.sin(a) * r1); c.lineTo(c0.x + Math.cos(a) * r2, c0.y + Math.sin(a) * r2);
    }
    c.stroke();

    // Anéis
    c.lineWidth = 1.2;
    c.strokeStyle = alpha(T.app, .45); c.beginPath(); c.arc(c0.x, c0.y, R.app * k * rv, 0, TAU); c.stroke();
    c.strokeStyle = alpha(T.routine, .7); c.beginPath(); c.arc(c0.x, c0.y, R.rout * k * rv, 0, TAU); c.stroke();
    c.save(); c.setLineDash([1.5, 4]); c.strokeStyle = alpha(T.skill, .8); c.lineWidth = 2;
    if (brilho){ c.shadowColor = T.skill; c.shadowBlur = 10; }
    c.beginPath(); c.arc(c0.x, c0.y, R.skill * k * rv, 0, TAU); c.stroke(); c.restore();
    c.strokeStyle = alpha(T.skill, .25); c.lineWidth = 1; c.beginPath(); c.arc(c0.x, c0.y, (R.skill - 12) * k * rv, 0, TAU); c.stroke();

    // Onda de recarga: um anel que sai do centro e acende o que encontra
    if (onda){
      c.save(); c.strokeStyle = alpha(T.holo, (1 - onda.e) * .75); c.lineWidth = 2;
      if (brilho){ c.shadowColor = T.holo; c.shadowBlur = 14; }
      c.beginPath(); c.arc(c0.x, c0.y, onda.r * k, 0, TAU); c.stroke(); c.restore();
    }
    const reforco = n => { if (!onda) return 0; const p = L[n.id]; if (!p) return 0; return Math.max(0, 1 - Math.abs(p.r * rv - onda.r) / 24) * (1 - onda.e * .5); };

    // Raios até as aplicações
    c.strokeStyle = alpha(T.app, .1); c.lineWidth = 1; c.beginPath();
    for (const n of G.nodes) if (n.kind === 'app'){ const w = mundo(n); if (!w) continue; const p = tela(w); c.moveTo(c0.x, c0.y); c.lineTo(p.x, p.y); }
    c.stroke();

    // Todas as conexões (sinapses), quando ligado
    if (S.mostrarTodas && !sel){
      c.lineWidth = .6;
      for (const n of G.nodes){
        const w = n.kind === 'core' ? { x:0, y:0 } : mundo(n); if (!w) continue; const p = tela(w);
        c.strokeStyle = alpha(cor(n), .12); c.beginPath();
        for (const id of n.links){
          const m = G.nodes[id]; if (!m) continue; const wm = m.kind === 'core' ? { x:0, y:0 } : mundo(m); if (!wm) continue; const q = tela(wm);
          c.moveTo(p.x, p.y); c.quadraticCurveTo((p.x + q.x) / 2 * .6 + c0.x * .4, (p.y + q.y) / 2 * .6 + c0.y * .4, q.x, q.y);
        }
        c.stroke();
      }
    }

    // Conexões da seleção
    const wSel = sel ? (sel.kind === 'core' ? { x:0, y:0 } : mundo(sel)) : null;
    if (sel && wSel){
      const p = tela(wSel);
      c.save(); c.lineWidth = 1.4; if (brilho) c.shadowBlur = 8;
      for (const id of nb){
        const m = G.nodes[id]; if (!m) continue; const wm = m.kind === 'core' ? { x:0, y:0 } : mundo(m); if (!wm) continue; const q = tela(wm);
        const col = cor(sel.kind === 'dept' ? m : sel); c.strokeStyle = alpha(col, sel.kind === 'dept' ? .35 : .85); c.shadowColor = col;
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(mx * .7 + c0.x * .3, my * .7 + c0.y * .3, q.x, q.y); c.stroke();
      }
      c.restore();
    }

    // Memória: pontos
    const nomesAuto = S.nomes ? k > 1.6 : k > 2.2;
    for (const n of G.nodes){
      if (n.kind !== 'memory') continue;
      const w = mundo(n); if (!w) continue; const p = tela(w);
      if (p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) continue;
      const col = cor(n), f = foco(n), t = S.destaque.has(n.id), bo = reforco(n);
      const rad = Math.max(1, L[n.id].rad * k * (n === S.hover ? 1.7 : 1) * (1 + bo * .7));
      const a = Math.min(1, (sel ? (f ? 1 : .12) : (temDestaque ? (t ? 1 : .35) : .78)) + bo * .5);
      if ((f && sel) || t || bo > .1){ c.fillStyle = alpha(col, .18 * Math.max(a, bo)); c.beginPath(); c.arc(p.x, p.y, rad * 2.8, 0, TAU); c.fill(); }
      c.fillStyle = alpha(col, a); c.beginPath(); c.arc(p.x, p.y, rad, 0, TAU); c.fill();
      if (n === sel){ c.strokeStyle = alpha(T.holo, .9); c.lineWidth = 1.4; c.beginPath(); c.arc(p.x, p.y, rad + 4, 0, TAU); c.stroke(); }
      if (t && !reduzido){ const ph = (pulso * 1.2 + n.id * .13) % 1; c.strokeStyle = alpha(col, (1 - ph) * .9); c.lineWidth = 1.2; c.beginPath(); c.arc(p.x, p.y, rad + ph * 14, 0, TAU); c.stroke(); }
      if (nomesAuto || (sel && f && k > 1.1 && n !== sel) || n === sel){
        c.font = fonte(500, n === sel ? 12 : 10.5, T.fCorpo); c.fillStyle = alpha(T.ink, n === sel ? 1 : .75); c.textAlign = 'left'; c.textBaseline = 'middle';
        const nm = String(n.name || '');
        c.fillText(nm.length > 38 ? nm.slice(0, 37) + '…' : nm, p.x + rad + 4, p.y);
      }
    }

    // Notas novas ou alteradas
    if (S.frescos.size){
      for (const [id, t0] of S.frescos){
        const n = G.nodes[id]; const age = (now - t0) / 1000;
        if (!n || age > DUR_FRESCO / 1000){ S.frescos.delete(id); continue; }
        const w0 = n.kind === 'core' ? { x:0, y:0 } : mundo(n); if (!w0) continue; const p = tela(w0); const col = cor(n);
        const ph = reduzido ? .3 : (Math.max(0, age) * .8) % 1; const fade = Math.max(0, Math.min(1, (DUR_FRESCO / 1000 - age) / 5));
        c.strokeStyle = alpha(T.novo, (1 - ph) * fade); c.lineWidth = 1.6; c.beginPath(); c.arc(p.x, p.y, 6 + ph * 22, 0, TAU); c.stroke();
        c.fillStyle = alpha(col, fade); c.beginPath(); c.arc(p.x, p.y, 3.2, 0, TAU); c.fill();
      }
    }

    // Hubs de departamento
    for (const d of G.depts || []){
      const n = d.hub; if (!n) continue; const w = mundo(n); if (!w) continue;
      const p = tela(w); const col = cor(n); const f = foco(n) || (sel && sel.kind !== 'dept' && sel.dept === n.name);
      const a = sel && !f ? .3 : 1; const rr = 7 * Math.max(.8, Math.min(1.6, k)) * (n === S.hover ? 1.2 : 1);
      c.fillStyle = alpha(col, .18 * a); c.beginPath(); c.arc(p.x, p.y, rr * 1.9, 0, TAU); c.fill();
      c.fillStyle = alpha(col, a); c.beginPath(); c.arc(p.x, p.y, rr, 0, TAU); c.fill();
      if (n === sel){ c.strokeStyle = alpha(T.holo, .9); c.lineWidth = 1.4; c.beginPath(); c.arc(p.x, p.y, rr * 1.9 + 2, 0, TAU); c.stroke(); }
      c.fillStyle = alpha(T.bg, a); c.font = fonte(800, rr * 1.05, T.fDisplay); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText((String(n.name || '?')[0] || '?').toUpperCase(), p.x, p.y + .5);
      c.font = fonte(700, Math.max(9, Math.min(12, 9.5 * k)), T.fDisplay); espacar(1.2);
      c.fillStyle = alpha(T.ink, .82 * a); c.fillText(String(n.name || '').toUpperCase(), p.x, p.y + rr * 2.3 + 4); espacar(0);
    }

    // Skills
    for (const n of G.nodes){
      if (n.kind !== 'skill') continue; const w = mundo(n); if (!w) continue;
      const p = tela(w); const f = foco(n); const a = sel && !f ? .25 : 1; const t = S.destaque.has(n.id);
      const rr = Math.max(5, 6.5 * k) * (n === S.hover || n === sel ? 1.35 : 1) * (1 + reforco(n) * .5);
      c.save(); c.fillStyle = alpha(T.skill, a); if (brilho){ c.shadowColor = T.skill; c.shadowBlur = 12; } estrela(p.x, p.y, rr); c.fill(); c.restore();
      if (t && !reduzido){ const ph = (pulso * 1.2) % 1; c.strokeStyle = alpha(T.skill, 1 - ph); c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, rr + ph * 16, 0, TAU); c.stroke(); }
      if (S.nomes || nomesAuto || n === S.hover || n === sel || k > 1.5 || (sel && f)){
        c.font = fonte(500, Math.max(10, Math.min(12.5, 10 * k)), T.fCorpo); c.fillStyle = alpha(T.ink, .9 * a); c.textAlign = 'center'; c.textBaseline = 'top';
        c.fillText(n.name, p.x, p.y + rr + 4);
      }
    }

    // Rotinas
    for (const n of G.nodes){
      if (n.kind !== 'routine') continue; const w = mundo(n); if (!w) continue;
      const p = tela(w); const f = foco(n); const a = sel && !f ? .3 : 1;
      const rr = Math.max(4.5, 6 * k) * (n === S.hover || n === sel ? 1.3 : 1) * (1 + reforco(n) * .5);
      c.fillStyle = T.bg; c.beginPath(); c.arc(p.x, p.y, rr, 0, TAU); c.fill();
      c.strokeStyle = alpha(T.routine, a); c.lineWidth = 1.5; c.stroke();
      c.fillStyle = alpha(T.routine, a); c.beginPath(); c.arc(p.x, p.y, rr * .38, 0, TAU); c.fill();
      if (S.nomes || nomesAuto || n === S.hover || n === sel || k > 1.4 || (sel && f)) rotuloFora(n, p, rr, alpha(T.ink, .85 * a));
    }

    // Aplicações
    for (const n of G.nodes){
      if (n.kind !== 'app') continue; const w = mundo(n); if (!w) continue;
      const p = tela(w); const f = foco(n); const a = sel && !f ? .3 : 1;
      const rr = Math.max(9, 12.5 * k) * (n === S.hover || n === sel ? 1.2 : 1) * (1 + reforco(n) * .4);
      c.fillStyle = T.surface; hex(p.x, p.y, rr); c.fill();
      c.strokeStyle = alpha(T.app, .9 * a); c.lineWidth = 1.3; c.stroke();
      c.fillStyle = alpha(T.ink, .95 * a); c.font = fonte(800, rr * .62, T.fDisplay); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(initials(n.name), p.x, p.y + .5);
      if (S.nomes || nomesAuto || n === S.hover || n === sel || k > 1.15 || (sel && f)) rotuloFora(n, p, rr + 2, alpha(T.ink, .8 * a));
    }

    // Núcleo: logo da Lube desenhada (CLAUDE.md)
    if (G.core){
      const n = G.core; const p = c0; const rr = R.core * k * Math.max(.4, rv) * (n === S.hover ? 1.06 : 1);
      const gg = c.createRadialGradient(p.x, p.y, rr * .5, p.x, p.y, rr * 2.6);
      gg.addColorStop(0, alpha(T.holo, .40)); gg.addColorStop(1, alpha(T.holo, 0));
      c.fillStyle = gg; c.beginPath(); c.arc(p.x, p.y, rr * 2.6, 0, TAU); c.fill();
      // arcos de HUD
      const t = reduzido ? 0 : now / 1000;
      c.save(); c.lineCap = 'round';
      c.strokeStyle = alpha(T.holo, .9); c.lineWidth = Math.max(1.5, 2 * k); if (brilho){ c.shadowColor = T.holo; c.shadowBlur = 12; }
      for (let i = 0; i < 3; i++){ const a0 = t * .6 + i * 2.094; c.beginPath(); c.arc(p.x, p.y, rr * 1.12, a0, a0 + 1.3); c.stroke(); }
      c.shadowBlur = 0; c.strokeStyle = alpha(T.vermelho, .85); c.lineWidth = Math.max(1, 1.3 * k);
      for (let i = 0; i < 2; i++){ const a0 = -t * .9 + i * Math.PI; c.beginPath(); c.arc(p.x, p.y, rr * 1.3, a0, a0 + .7); c.stroke(); }
      c.setLineDash([2, 5]); c.strokeStyle = alpha(T.holo, .35); c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, rr * 1.48, 0, TAU); c.stroke();
      c.restore();
      if (n === sel){ c.strokeStyle = alpha(T.holo, .9); c.lineWidth = 1.6; c.beginPath(); c.arc(p.x, p.y, rr * 1.62, 0, TAU); c.stroke(); }
      // disco
      c.fillStyle = T.surface; c.beginPath(); c.arc(p.x, p.y, rr * .95, 0, TAU); c.fill();
      c.strokeStyle = alpha(T.holo, .8); c.lineWidth = Math.max(1.2, 1.6 * k); c.stroke();
      logoLube(p.x + rr * .02, p.y, rr * 1.32);
      c.font = fonte(800, Math.max(9, Math.min(12.5, 10.5 * k)), T.fDisplay); c.fillStyle = alpha(T.ink, .85); c.textAlign = 'center'; c.textBaseline = 'top';
      espacar(1.5); c.fillText('CLAUDE.MD', p.x, p.y + rr * 1.55 + 6); espacar(0);
    }

    // Rótulos dos anéis
    const ls = Math.max(9, Math.min(15, 11.5 * k));
    rotuloAnel('APLICAÇÕES', R.app, alpha(T.app, .95), ls);
    rotuloAnel('ROTINAS', R.rout, T.routine, ls);
    rotuloAnel('MEMÓRIA', R.disc, alpha(T.ink, .75), ls);
    rotuloAnel('SKILLS', R.skill - 8, T.skill, ls * 1.15);
  }

  /* ---------- Laço ---------- */
  function quadro(now){
    raf = 0;
    if (destruido || !S.ativo) return;
    raf = requestAnimationFrame(quadro);
    const dt = Math.min(.05, Math.max(0, (now - ultimo) / 1000)); ultimo = now;
    let anim = false;
    if (S.revelando){
      // o "now" do rAF é o início do quadro e pode vir antes do performance.now() do revelar(): sem o max(0), e < 0
      // dava reveal negativo e o arc() com raio negativo lançava IndexSizeError
      const e = Math.max(0, Math.min(1, (now - S.t0) / DUR_REVELAR)); S.reveal = 1 - Math.pow(1 - e, 3);
      if (e >= 1){ S.revelando = false; S.reveal = 1; }
      anim = true;
    }
    if (S.spin > 0 && !S.sel){ S.rot += dt * S.spin * .06; anim = true; }
    if (S.tween){
      const tw = S.tween; const e = Math.max(0, Math.min(1, (now - tw.t0) / tw.d)); const q = e < .5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
      const lk = Math.log(tw.from.k) + (Math.log(tw.to.k) - Math.log(tw.from.k)) * q;
      S.cam = { x:tw.from.x + (tw.to.x - tw.from.x) * q, y:tw.from.y + (tw.to.y - tw.from.y) * q, k:Math.exp(lk) };
      if (e >= 1) S.tween = null;
      anim = true;
    }
    if (S.onda != null && now - S.onda > DUR_ONDA) S.onda = null;
    if (!reduzido || S.frescos.size || S.onda != null) anim = true;
    if (anim || dirty){ desenhar(now); dirty = false; }
  }
  function ligarLaco(){ if (!raf && S.ativo && !destruido){ ultimo = performance.now(); raf = requestAnimationFrame(quadro); } }
  function revelar(){
    if (reduzido){ S.reveal = 1; S.revelando = false; return; }
    S.reveal = 0; S.revelando = true; S.t0 = performance.now(); dirty = true;
  }

  /* ---------- Hit test ---------- */
  function acertar(sx, sy, toque){
    const G = S.G; if (!G) return null; let best = null, bd = Infinity; const k = S.cam.k; const f = toque ? 1.8 : 1;
    for (const n of G.nodes){
      const w = n.kind === 'core' ? { x:0, y:0 } : mundo(n); if (!w) continue; const p = tela(w);
      const d = Math.hypot(p.x - sx, p.y - sy);
      const r = n.kind === 'core' ? Math.max(14 * f, R.core * k * .8)
        : n.kind === 'app' ? Math.max(11 * f, 12.5 * k)
        : n.kind === 'dept' ? Math.max(9 * f, 8 * k)
        : n.kind === 'memory' ? Math.max(5 * f, (L[n.id] ? L[n.id].rad : 2) * k + 3)
        : Math.max(8 * f, 7 * k);
      if (d < r && d < bd){ bd = d; best = n; }
    }
    return best;
  }

  /* ---------- Interação: clique, arrasto, pinça, roda, duplo clique ---------- */
  const ponteiros = new Map(); let arrasto = null, pinca = null, ultimoToque = null, tipoUlt = 'mouse';
  function pos(e){ const r = canvas.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; }
  function cursor(){ canvas.style.cursor = arrasto && arrasto.moveu ? 'grabbing' : S.hover ? 'pointer' : 'grab'; }
  function avisarHover(n, p){ try { opts.onHover?.(n, p); } catch (e) { console.error(e); } }
  function largarHover(p){ if (S.hover){ S.hover = null; dirty = true; avisarHover(null, p || { x:0, y:0 }); } cursor(); }
  let ultimoClique = 0;
  function escolher(n){
    // O duplo clique dispara dois cliques: o segundo no mesmo nó não avisa de novo
    const agora = performance.now(); const repetido = !!n && n === S.sel && agora - ultimoClique < 450; ultimoClique = agora;
    S.sel = n || null; dirty = true;
    if (repetido) return;
    try { opts.onSelecionar?.(S.sel); } catch (e) { console.error(e); }
  }

  function aoBaixar(e){
    if (!S.ativo || !S.G) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    ponteiros.set(e.pointerId, { x:e.clientX, y:e.clientY }); tipoUlt = e.pointerType || 'mouse';
    if (ponteiros.size === 1) arrasto = { x:e.clientX, y:e.clientY, cx:S.cam.x, cy:S.cam.y, moveu:false };
    if (ponteiros.size === 2){ const [a, b] = [...ponteiros.values()]; pinca = { d:Math.hypot(a.x - b.x, a.y - b.y) || 1, k:S.cam.k }; arrasto = null; }
    S.tween = null;
  }
  function aoMover(e){
    if (!S.ativo || !S.G) return;
    const p = pos(e);
    if (ponteiros.has(e.pointerId)) ponteiros.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (pinca && ponteiros.size === 2){
      const [a, b] = [...ponteiros.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = canvas.getBoundingClientRect(); const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      const antes = paraMundo(mx, my); S.cam.k = clampK(pinca.k * d / pinca.d); const depois = paraMundo(mx, my);
      S.cam.x += antes.x - depois.x; S.cam.y += antes.y - depois.y; dirty = true; largarHover(p); return;
    }
    if (arrasto){
      const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
      if (Math.hypot(dx, dy) > (tipoUlt === 'touch' ? 8 : 4)) arrasto.moveu = true;
      if (arrasto.moveu){ S.cam.x = arrasto.cx - dx / S.cam.k; S.cam.y = arrasto.cy - dy / S.cam.k; dirty = true; largarHover(p); cursor(); return; }
    }
    if (e.pointerType === 'touch') return;
    const n = acertar(p.x, p.y, false);
    if (n !== S.hover){ const tinha = !!S.hover; S.hover = n; dirty = true; cursor(); if (!n && tinha) avisarHover(null, p); }
    if (n) avisarHover(n, p);
  }
  function aoSoltar(e){
    if (!ponteiros.has(e.pointerId)) return;
    ponteiros.delete(e.pointerId);
    if (ponteiros.size < 2) pinca = null;
    const a = arrasto; arrasto = null; cursor();
    if (!a || a.moveu || !S.ativo || !S.G) return;
    const p = pos(e); const toque = e.pointerType === 'touch'; const n = acertar(p.x, p.y, toque);
    if (toque){
      const agora = performance.now();
      if (ultimoToque && agora - ultimoToque.t < 320 && Math.hypot(p.x - ultimoToque.x, p.y - ultimoToque.y) < 28){ ultimoToque = null; aproximar(n, p); return; }
      ultimoToque = { t:agora, x:p.x, y:p.y };
    }
    escolher(n);
  }
  function aoCancelar(e){ ponteiros.delete(e.pointerId); if (ponteiros.size < 2) pinca = null; arrasto = null; cursor(); }
  function aoSair(e){ if (ponteiros.size) return; largarHover(e ? pos(e) : null); }
  function aoDuplo(e){
    if (!S.ativo || !S.G || tipoUlt === 'touch') return;
    e.preventDefault(); const p = pos(e); aproximar(acertar(p.x, p.y, false), p);
  }
  function aoRolar(e){
    if (!S.ativo || !S.G) return;
    e.preventDefault(); const p = pos(e);
    const fator = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 240 : 1;
    const antes = paraMundo(p.x, p.y); S.cam.k = clampK(S.cam.k * Math.exp(-e.deltaY * fator * .0015)); const depois = paraMundo(p.x, p.y);
    S.cam.x += antes.x - depois.x; S.cam.y += antes.y - depois.y; S.tween = null; dirty = true;
  }

  canvas.addEventListener('pointerdown', aoBaixar);
  canvas.addEventListener('pointermove', aoMover);
  canvas.addEventListener('pointerup', aoSoltar);
  canvas.addEventListener('pointercancel', aoCancelar);
  canvas.addEventListener('pointerleave', aoSair);
  canvas.addEventListener('dblclick', aoDuplo);
  canvas.addEventListener('wheel', aoRolar, { passive:false });

  // Tamanho e visibilidade do próprio canvas
  let ro = null, mo = null;
  try {
    if (typeof ResizeObserver === 'function'){ ro = new ResizeObserver(() => { if (!S.ativo) return; medir(); if (!S.sel) enquadrar(false); }); ro.observe(canvas); }
  } catch (e) { ro = null; }
  try {
    if (typeof MutationObserver === 'function'){ mo = new MutationObserver(() => { if (canvas.hidden === S.ativo) api.ativar(!canvas.hidden); }); mo.observe(canvas, { attributes:true, attributeFilter:['hidden'] }); }
  } catch (e) { mo = null; }
  try { document.fonts?.ready?.then(() => { dirty = true; }); } catch (e) {}

  /* ---------- Utilidades da API ---------- */
  function chave(n){ if (!n) return null; if (n.kind === 'core') return 'core'; if (n.kind === 'dept') return 'dept:' + n.name; return n.path ? 'p:' + n.path : null; }
  function porChave(G, ch){
    if (!G || !ch) return null;
    if (ch === 'core') return G.core || null;
    if (ch.startsWith('dept:')){ const d = (G.depts || []).find(x => x.name === ch.slice(5)); return d ? d.hub : null; }
    const p = ch.slice(2); return G.nodes.find(x => x.path === p && x.kind !== 'dept') || null;
  }
  // Aceita nó, id numérico ou caminho; devolve o nó do grafo atual
  function resolver(x){
    const G = S.G; if (!G || x == null) return null;
    if (typeof x === 'number') return G.nodes[x] || null;
    if (typeof x === 'string') return G.nodes.find(n => n.path === x && n.kind !== 'dept') || null;
    if (typeof x === 'object'){ if (G.nodes[x.id] === x) return x; return porChave(G, chave(x)); }
    return null;
  }
  function idsDe(lista){
    const out = new Set(); if (!lista) return out;
    for (const x of lista){ const n = resolver(x); if (n) out.add(n.id); }
    return out;
  }

  /* ---------- API ---------- */
  const api = {
    /** Recebe o grafo (buildGraph). Na mesma vault: mantém câmera e seleção, faz a onda e pisca as notas novas.
     *  extra.frescos (opcional): Set de caminhos ou ids que devem piscar (ex.: mudancas(Gantes, G)). */
    setGrafo(G, extra = {}){
      const ant = S.G, chSel = chave(S.sel);
      const frescosAnt = ant ? [...S.frescos].map(([id, t]) => [chave(ant.nodes[id]), t]) : [];
      S.G = G || null; S.hover = null; S.destaque = new Set(); S.frescos = new Map(); S.tween = null;
      if (!S.G){ S.sel = null; L = []; dirty = true; return; }
      montarLayout(S.G);
      const agora = performance.now();
      const mesmo = !!ant && ant !== G && ant.vaultName === G.vaultName;
      for (const [ch, t] of frescosAnt){ const n = porChave(G, ch); if (n) S.frescos.set(n.id, t); }
      // Notas novas ou alteradas piscam (como o modo ao vivo antigo). Se quase tudo mudou (outro vault,
      // primeira leitura depois do exemplo), não pisca nada: vira um "ligar" normal.
      let mudou = null;
      if (extra && extra.frescos) mudou = [...idsDe(extra.frescos)];
      else if (mesmo){
        const prevM = new Map(); for (const n of ant.nodes) if (n.path && n.kind !== 'dept') prevM.set(n.path, n.mtime);
        mudou = G.nodes.filter(n => n.path && !n.virtual && n.kind !== 'dept' && (!prevM.has(n.path) || prevM.get(n.path) !== n.mtime)).map(n => n.id);
      }
      let marcados = 0;
      if (mudou && mudou.length && mudou.length <= Math.max(3, G.nodes.length * .5)){ for (const id of mudou) S.frescos.set(id, agora); marcados = mudou.length; }
      if (ant === G){ dirty = true; return; }
      if (mesmo){
        S.sel = porChave(G, chSel);
        if (!reduzido) S.onda = agora;
      } else {
        S.sel = null; S.rot = 0;
        medir(); enquadrar(false);
        if (S.ativo) revelar(); else { S.reveal = 1; S.revelando = false; }
      }
      if (marcados && !reduzido && S.onda == null) S.onda = agora;
      dirty = true; ligarLaco();
    },

    /** Acende esses ids (Set, array, nós ou caminhos) e esmaece os outros; null limpa. */
    destacar(ids){ S.destaque = ids ? idsDe(ids) : new Set(); dirty = true; },

    /** Seleciona sem chamar onSelecionar. Com nó, a câmera voa até ele (op.voar = false evita). */
    selecionar(no, op = {}){
      const n = resolver(no); S.sel = n; dirty = true;
      if (n && op.voar !== false) voarPara(n);
    },

    /** Volta a câmera para o enquadramento inicial. */
    centralizar(){ enquadrar(true); },

    /** Liga/desliga a visão (mostra/esconde o canvas, para o desenho quando desligada). */
    ativar(on){
      on = !!on;
      if (destruido || on === S.ativo){ if (!destruido && on && canvas.hidden) canvas.hidden = false; return; }
      S.ativo = on;
      if (canvas.hidden === on) canvas.hidden = !on;
      if (on){
        lerTokens(); medir();
        if (!S.sel) enquadrar(false);
        if (S.G) revelar();
        dirty = true; ligarLaco();
      } else {
        if (raf){ cancelAnimationFrame(raf); raf = 0; }
        ponteiros.clear(); arrasto = null; pinca = null; S.tween = null;
        if (S.hover){ S.hover = null; avisarHover(null, { x:0, y:0 }); }
      }
    },

    /** Recalcula o tamanho (chamar no resize da janela). */
    redimensionar(){ medir(); if (!S.sel) enquadrar(false); dirty = true; },

    /** Remove eventos e para o desenho. */
    destruir(){
      destruido = true; S.ativo = false;
      if (raf){ cancelAnimationFrame(raf); raf = 0; }
      canvas.removeEventListener('pointerdown', aoBaixar);
      canvas.removeEventListener('pointermove', aoMover);
      canvas.removeEventListener('pointerup', aoSoltar);
      canvas.removeEventListener('pointercancel', aoCancelar);
      canvas.removeEventListener('pointerleave', aoSair);
      canvas.removeEventListener('dblclick', aoDuplo);
      canvas.removeEventListener('wheel', aoRolar);
      try { ro?.disconnect(); } catch (e) {}
      try { mo?.disconnect(); } catch (e) {}
      ponteiros.clear(); S.G = null; S.sel = null; S.hover = null; L = [];
      try { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); } catch (e) {}
    },

    /* ---- Extras (mesmos nomes do robô, para o app tratar as duas visões igual) ---- */
    /** Mostra ou esconde todas as conexões (checkbox "Mostrar sinapses"). */
    sinapses(on){ S.mostrarTodas = !!on; dirty = true; },
    /** 'baixa' desliga sombras e brilhos (checkbox "Efeitos de brilho"). */
    qualidade(q){ S.brilho = q !== 'baixa'; dirty = true; },
    /** Anel de pulso nesses ids/caminhos por ~25 s. */
    pulsoNovo(ids){ const agora = performance.now(); for (const id of idsDe(ids)) S.frescos.set(id, agora); dirty = true; ligarLaco(); },
    /** Giro automático da memória (0–1, controle "Giro da memória"); com movimento reduzido fica parado. */
    giro(v){ S.giro = Math.max(0, Math.min(1, +v || 0)); S.spin = reduzido ? 0 : S.giro; dirty = true; ligarLaco(); },
    /** Nomes das notas sempre visíveis (controle "Mostrar nomes das notas"). */
    nomes(on){ S.nomes = !!on; dirty = true; },
    /** Esconde departamentos (Set de nomes): saem do mapa e os outros ocupam a volta toda. */
    ocultar(nomes){
      S.ocultos = new Set(nomes || []);
      if (!S.G) return;
      montarLayout(S.G);
      if (S.sel && S.sel.kind !== 'core' && (S.sel.kind === 'dept' ? S.ocultos.has(S.sel.name) : S.sel.kind === 'memory' && S.ocultos.has(S.sel.dept))) S.sel = null;
      if (S.hover && !mundo(S.hover) && S.hover.kind !== 'core'){ S.hover = null; avisarHover(null, { x:0, y:0 }); }
      dirty = true;
    },
    /** A pessoa ligou/desligou "reduzir movimento" com a página aberta. */
    reduzir(v){ reduzido = !!v; S.spin = reduzido ? 0 : S.giro; if (reduzido){ S.revelando = false; S.reveal = 1; S.onda = null; } dirty = true; ligarLaco(); },
    /** Desloca o foco na horizontal (fração da largura; -0.18 = foco mais à esquerda, leitor aberto). */
    deslocar(fracaoX){
      S.desvio = Number(fracaoX) || 0;
      if (S.sel) voarPara(S.sel); else enquadrar(true);
    },
    /** Posição de tela (px CSS, relativa ao canvas) de um nó. */
    projetar(no){
      const n = resolver(no); if (!n) return { x:0, y:0, visivel:false };
      const w = n.kind === 'core' ? { x:0, y:0 } : mundo(n); if (!w) return { x:0, y:0, visivel:false };
      const p = tela(w); return { x:p.x, y:p.y, visivel:S.ativo && p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H };
    }
  };

  lerTokens();
  if (!canvas.hidden) api.ativar(true);
  return api;
}
