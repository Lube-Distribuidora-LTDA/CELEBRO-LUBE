// js/efeitos-maos.js — a parte visual do Modo Mãos (MAOS.md §3, agente EFEITOS).
//
// O que faz: a camada de partículas e o cursor holográfico (<canvas id="maosFx"> por cima de tudo, sem pegar
// clique), o cartão da câmera com o vídeo espelhado e o esqueleto da mão (#maosCam), a ajuda dos 7 gestos
// (#maosAjuda) e o cartão de ligar, com o progresso e os erros (#maosLigar). Não abre a câmera nem carrega o
// MediaPipe: isso é do js/maos.js, que entrega os quadros, os gestos, os estados e o progresso.
//
// Leve de propósito: pool fixo de partículas e de ondas (nada é alocado por quadro), brilho aditivo com sprites
// desenhados uma vez, o laço de animação só roda enquanto há algo na tela, e a densidade cai sozinha se o quadro
// passar de ~20 ms. Movimento reduzido: só o cursor (sem rastros, sem confete, sem ondas).
//
// Uso (app.js):
//   const fx = criarEfeitos({ reduzido, cores, onLigar, onCancelar, onDesligar, onVideo, onAjuda });
//   const maos = await iniciarMaos({ video: fx.video, onQuadro: fx.quadro, onGesto: fx.gesto,
//                                    onEstado: fx.estado, onProgresso: fx.progresso });
// Os botões dos cartões chamam esses callbacks e também disparam eventos no #app (bubbles):
//   'maos:ligar', 'maos:cancelar', 'maos:desligar', 'maos:video' {detail:{visivel}}, 'maos:ajuda' {detail:{aberta}}.
// Efeitos = { quadro(q), gesto(nome, dados) -> consumido, estado(estado, detalhe), progresso(fase, pct),
//             mostrarVideo(bool), ajuda(bool), destruir(), video (o <video> do cartão), ajudaAberta(), ligarAberto() }
//   - criar já mostra o cartão de ligar (opts.mostrarLigar:false não mostra); estado('ligar', {simular}) o refaz.
//   - estados do motor: carregando {fase} · pronto · rastreando · pausado · parado · erro {codigo, mensagem}
//     (a mensagem, quando vem, vale sobre a frase padrão do código).
//   - gesto('fechar') devolve true quando fechou a ajuda ou o cartão de ligar (o app não segue a ordem do Esc) e
//     'ignorado' quando o consumiu sem efeito (carência da ajuda: nem onda de choque, nem o robô piscando).
//   - a ajuda abre sozinha na primeira vez (preferência 'cerebro-robo:maos-ajuda' = 'vista'); "esconder vídeo"
//     fica em 'cerebro-robo:maos-video' ('visivel' | 'oculto'). Esc fecha a ajuda e o cartão de ligar antes do app.
// Contrato da pinça: q.maos[i].pinca vai de 0 (dedos abertos) a 1 (pinça fechada); pincando:true vale como 1.
// Teste: opts.depurar(d) recebe { manual(bool), passo(t), hud(), estado() } — relógio manual para a página de teste
// avançar a animação quadro a quadro (com a aba oculta o requestAnimationFrame para).

/* ---------- Constantes ---------- */
const TAU = Math.PI * 2;
const MAX_P = 1500;            // pool fixo de partículas (MAOS.md §3: limite de ~1500)
const MAX_O = 40;              // pool fixo de ondas (anéis, choque, arcos, setas, flash)
const HIST = 12;               // quadros de rastro guardados por ponta de dedo
const PONTAS = [4, 8, 12, 16, 20];
const LIG = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const PALMA = [0, 1, 5, 9, 13, 17];
const PREF = 'cerebro-robo:';
const SEM_TRACO = [];
const CARENCIA_AJUDA = 2500;   // ms com a ajuda aberta (e a mão na tela) antes de a mão aberta poder fechá-la
// sobre um painel de texto (e sobre as listas de texto: trilho, recentes, cartões do leque) os rastros ficam
// discretos (o cursor e as animações dos gestos continuam inteiros)
const SEL_PAINEL = '.leitor-moldura, .ml-cartao, .ma-cartao, .resposta, .menu, #resultados, .maos-cam, .maos-info, .trilho, .recentes, .carta';
const TRACEJADO = [5, 7];
const PONTILHADO = [1.2, 4.2];

// reserva = tokens do CONTRATO.md §3 (o valor de verdade é lido do CSS)
const RESERVA = {
  '--holo': '#45d4ff', '--azul': '#2a41c8', '--vermelho': '#e5202c', '--ok': '#34e89e', '--rever': '#ffb340',
  '--bg': '#050b1c', '--novo': '#5fb2ff', '--branco': '#ffffff', '--ink': '#e8eeff',
};

// cores do canvas (índices dos sprites)
const HOLO = 0, NOVO = 1, AZUL = 2, VERM = 3, BRANCO = 4, OK = 5, REVER = 6, NCORES = 7;
const COR_DEDO = [HOLO, HOLO, NOVO, AZUL, NOVO];   // polegar, indicador, médio, anelar, mínimo

// tipos de partícula e de onda
const P_BRILHO = 0, P_TRACO = 1, P_CONFETE = 2, P_IMA = 3;
const O_ANEL = 1, O_CHOQUE = 2, O_ARCOS = 3, O_SETAS = 4, O_SURGE = 5, O_FLASH = 6;

const FRASES = {
  negado: 'Você não liberou a câmera. Clique no cadeado da barra de endereço e permita a câmera.',
  'em-uso': 'A câmera está sendo usada por outro programa (Teams, Zoom…). Feche e tente de novo.',
  'sem-camera': 'Não encontrei nenhuma câmera neste computador. Conecte uma webcam e tente de novo.',
  'sem-modelo': 'Não consegui baixar o reconhecimento de mãos. Confira a internet.',
  'sem-gpu': 'Este computador não conseguiu rodar o reconhecimento de mãos. Atualize o Chrome ou o Edge e tente de novo.',
  'sem-suporte': 'Este navegador não liga a câmera nesta página. Abra o arquivo baixado no Chrome ou no Edge.',
  artifact: 'Os gestos usam a câmera, e o claude.ai não libera a câmera para páginas publicadas. Abra o arquivo baixado (Cerebro da Lube.html) no Chrome ou no Edge.',
};
const TITULO_ERRO = {
  negado: 'A câmera foi bloqueada', 'em-uso': 'A câmera está ocupada', 'sem-camera': 'Nenhuma câmera encontrada',
  'sem-modelo': 'Faltou o reconhecimento de mãos', 'sem-gpu': 'O reconhecimento de mãos não rodou',
  'sem-suporte': 'Navegador sem suporte', artifact: 'Gestos só no arquivo baixado',
};
const PASSOS = [
  ['Abrindo a câmera…', 'Câmera aberta'],
  ['Carregando o reconhecimento de mãos (8 MB, só na primeira vez)…', 'Reconhecimento de mãos pronto'],
  ['Mostre a mão aberta para a câmera', 'Mão encontrada'],
];
const ROTULOS = {
  none: 'Movendo', closed_fist: 'Punho fechado', open_palm: 'Mão aberta', pointing_up: 'Apontando',
  thumb_down: 'Polegar para baixo', thumb_up: 'Joinha', victory: 'Vitória', iloveyou: 'Te amo',
};
const TOM = { open_palm: 'holo', closed_fist: 'rever', thumb_up: 'ok', victory: 'novo', thumb_down: 'rever' };

/* ---------- Pequenos utilitários ---------- */
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const eo3 = u => 1 - (1 - u) * (1 - u) * (1 - u);
const eo4 = u => 1 - (1 - u) ** 4;
const eio = u => (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2);
const suave = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const norma = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const chaveGesto = g => norma(g || 'none').replace(/[\s-]+/g, '_');

function rgbDe(c, reserva) {
  const s = String(c || '').trim();
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)];
  m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(s);
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (m) return [+m[1], +m[2], +m[3]];
  return reserva ? rgbDe(reserva) : [69, 212, 255];
}
const mistura = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

function lerPref(k) { try { return localStorage.getItem(PREF + k); } catch { return null; } }
function gravarPref(k, v) { try { localStorage.setItem(PREF + k, v); } catch { /* sem armazenamento */ } }

/* ---------- Mão em pose (21 pontos), usada nos ícones da ajuda ---------- */
// Palma de frente, polegar à esquerda; unidades da caixa 48 do ícone, centro da palma em (0,0).
const BASE = [
  [0, 15],
  [-6.5, 10], [-11, 5.6], [-14.2, 1.2], [-16.4, -3.2],
  [-5.6, -3.6], [-6.6, -10.6], [-7.1, -15], [-7.4, -19],
  [-0.9, -4.6], [-1.1, -12.2], [-1.2, -17.2], [-1.3, -21.6],
  [3.7, -3.9], [4.5, -10.6], [5, -15.1], [5.4, -19.1],
  [7.9, -1.6], [9.3, -7.2], [10.1, -10.8], [10.8, -14.2],
];
const DOBRA_ANG = [0.12, 2.75, 0.5];    // quanto cada falange gira com o dedo todo dobrado (de frente: dobra para baixo)
const DOBRA_ENC = [0.42, 0.52, 0.6];    // quanto encurta (a falange vem para a frente e "some"): o dedo vira um arco curto
const LEQUE = [-0.22, -0.14, -0.03, 0.07, 0.18];   // abertura dos dedos com a mão bem aberta (polegar..mínimo)

/**
 * Pontos de uma mão numa pose simples.
 * o = { dobra:[polegar, indicador, médio, anelar, mínimo] (0..1), pinca 0..1, abre 0..1, giro (rad),
 *       escala, cx, cy, espelhar, polegar:{ang} (direção fixa do polegar, para o joinha) }
 * Devolve 21 {x,y,z} na mesma ordem do MediaPipe (0 pulso, 4 polegar, 8 indicador, 12 médio, 16 anelar, 20 mínimo).
 */
export function poseMao(o = {}) {
  const d = o.dobra || [0, 0, 0, 0, 0];
  const pc = clamp01(+o.pinca || 0);
  const ab = +o.abre || 0;
  const P = BASE.map(p => [p[0], p[1]]);
  for (let f = 1; f <= 4; f++) {
    const b = f * 4 + 1;
    let c = clamp01(+d[f] || 0);
    if (f === 1) c = Math.max(c, pc * 0.42);
    const lado = f <= 2 ? -1 : 1;
    let x = P[b][0], y = P[b][1], ang = LEQUE[f] * ab;
    for (let j = 1; j <= 3; j++) {
      const vx = BASE[b + j][0] - BASE[b + j - 1][0], vy = BASE[b + j][1] - BASE[b + j - 1][1];
      ang += DOBRA_ANG[j - 1] * c * lado;
      const k = 1 - DOBRA_ENC[j - 1] * c, cs = Math.cos(ang), sn = Math.sin(ang);
      x += (vx * cs - vy * sn) * k; y += (vx * sn + vy * cs) * k;
      P[b + j] = [x, y];
    }
  }
  if (o.polegar && Number.isFinite(o.polegar.ang)) {
    const a = o.polegar.ang, L = [6.2, 5.4, 4.8];
    let x = P[1][0], y = P[1][1];
    for (let j = 0; j < 3; j++) { x += Math.cos(a) * L[j]; y += Math.sin(a) * L[j]; P[2 + j] = [x, y]; }
  } else {
    const ct = clamp01(+d[0] || 0);
    let x = P[1][0], y = P[1][1], ang = LEQUE[0] * ab;
    const giroP = [0.55, 0.8, 0.75];
    for (let j = 2; j <= 4; j++) {
      const vx = BASE[j][0] - BASE[j - 1][0], vy = BASE[j][1] - BASE[j - 1][1];
      ang += giroP[j - 2] * ct;
      const k = 1 - 0.14 * ct, cs = Math.cos(ang), sn = Math.sin(ang);
      x += (vx * cs - vy * sn) * k; y += (vx * sn + vy * cs) * k;
      P[j] = [x, y];
    }
  }
  if (pc > 0) {   // a ponta do polegar vai encontrar a do indicador, com o polegar arqueado para fora
    const t = P[8], T = [t[0] - 0.5, t[1] + 0.8], c = P[1];
    const dx = T[0] - c[0], dy = T[1] - c[1], L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L;
    const a2 = [c[0] + dx * 0.36 + nx * 2.6, c[1] + dy * 0.36 + ny * 2.6];
    const a3 = [c[0] + dx * 0.7 + nx * 2.0, c[1] + dy * 0.7 + ny * 2.0];
    const mix = (p, q) => [p[0] + (q[0] - p[0]) * pc, p[1] + (q[1] - p[1]) * pc];
    P[2] = mix(P[2], a2); P[3] = mix(P[3], a3); P[4] = mix(P[4], T);
  }
  const g = +o.giro || 0, e = o.escala || 1, cx = o.cx || 0, cy = o.cy || 0, sx = o.espelhar ? -1 : 1;
  const cs = Math.cos(g), sn = Math.sin(g);
  return P.map(([x, y]) => ({ x: cx + (x * sx * cs - y * sn) * e, y: cy + (x * sx * sn + y * cs) * e, z: 0 }));
}

/* ---------- Ícones (SVG desenhado em código) ---------- */
const f1 = n => (Math.round(n * 10) / 10).toString();
function maoSVG(pose, { vermelho = [], classe = '' } = {}) {
  const p = poseMao(pose);
  const dobra = pose.dobra || [];
  let osso = '';
  for (const [a, b] of LIG) osso += `M${f1(p[a].x)} ${f1(p[a].y)}L${f1(p[b].x)} ${f1(p[b].y)}`;
  const palma = 'M' + PALMA.map(i => `${f1(p[i].x)} ${f1(p[i].y)}`).join('L') + 'Z';
  let juntas = '';
  for (let i = 0; i < 21; i++) {
    const ponta = PONTAS.includes(i), red = vermelho.includes(i);
    // dedo dobrado: juntas menores (senão o punho vira um amontoado de bolinhas)
    const dedo = i === 0 ? -1 : Math.floor((i - 1) / 4), c = dedo >= 0 && !(dedo === 0 && pose.polegar) ? clamp01(+dobra[dedo] || 0) : 0;
    const meio = !ponta && i % 4 !== 1 && i !== 0;
    const r = ponta ? 1.9 * (1 - 0.25 * c) : meio ? 1.05 * (1 - 0.55 * c) : 1.05;
    juntas += `<circle class="${ponta ? 'mi-ponta' : 'mi-junta'}${red ? ' mi-red' : ''}" cx="${f1(p[i].x)}" cy="${f1(p[i].y)}" r="${f1(Math.max(0.45, r))}"/>`;
  }
  return { p, svg: `<g class="mi-mao ${classe}"><path class="mi-palma" d="${palma}"/><path class="mi-vol" d="${osso}"/><path class="mi-osso" d="${osso}"/>${juntas}</g>` };
}
const svgIcone = (miolo, cls = '') => `<svg class="mi ${cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${miolo}</svg>`;

function iconesGestos() {
  const ico = {};
  // 1. Mover a mão: mão relaxada + cruz de setas
  {
    const m = maoSVG({ dobra: [0.12, 0, 0.05, 0.12, 0.22], escala: 0.78, cx: 19, cy: 29, giro: -0.12 });
    ico.mover = svgIcone(m.svg + `<g class="mi-seta mi-a-mover"><path d="M38 5.5v14M31 12.5h14"/><path d="M35.6 8 38 5.5 40.4 8M35.6 17 38 19.5 40.4 17M33.5 10.1 31 12.5l2.5 2.4M42.5 10.1 45 12.5l-2.5 2.4"/></g>`);
  }
  // 2. Pinça: polegar no indicador, faísca vermelha no encontro
  {
    const m = maoSVG({ dobra: [0, 0, 0.28, 0.42, 0.55], pinca: 1, escala: 0.86, cx: 26, cy: 29 }, { vermelho: [4, 8] });
    const c = m.p[8];
    let raios = '';
    for (let k = 0; k < 5; k++) {
      const a = -2.6 + k * 0.55, r0 = 3.6, r1 = 7;
      raios += `M${f1(c.x + Math.cos(a) * r0)} ${f1(c.y + Math.sin(a) * r0)}L${f1(c.x + Math.cos(a) * r1)} ${f1(c.y + Math.sin(a) * r1)}`;
    }
    ico.pinca = svgIcone(m.svg + `<path class="mi-raio mi-a-brilha" d="${raios}"/><circle class="mi-toque" cx="${f1(c.x)}" cy="${f1(c.y)}" r="2.6"/>`);
  }
  // 3. Pinça segurada e arrastar: pinça + trilho com seta dupla
  {
    const m = maoSVG({ dobra: [0, 0, 0.28, 0.42, 0.55], pinca: 1, escala: 0.74, cx: 20, cy: 29 }, { vermelho: [4, 8] });
    const c = m.p[8];
    ico.arrastar = svgIcone(m.svg + `<circle class="mi-toque" cx="${f1(c.x)}" cy="${f1(c.y)}" r="2.3"/><g class="mi-seta"><path d="M41 9v30"/><path d="M37.6 12.4 41 9l3.4 3.4M37.6 35.6 41 39l3.4-3.4"/></g><circle class="mi-cursor mi-a-desliza-v" cx="41" cy="24" r="2.4"/>`);
  }
  // 4. Mão aberta parada: palma bem aberta + anel de espera
  {
    const m = maoSVG({ dobra: [0, 0, 0, 0, 0], abre: 1, escala: 0.8, cx: 24, cy: 27.5 });
    ico.aberta = svgIcone(`<circle class="mi-trilha" cx="24" cy="24" r="21.5"/><circle class="mi-anel mi-a-espera" cx="24" cy="24" r="21.5" pathLength="100"/>` + m.svg);
  }
  // 5. Mão aberta deslizando: palma inclinada + traços de velocidade + seta
  {
    const m = maoSVG({ dobra: [0, 0, 0, 0, 0], abre: 0.7, escala: 0.74, cx: 29, cy: 28, giro: 0.32 });
    ico.deslizar = svgIcone(`<g class="mi-vel mi-a-vento"><path d="M3 17h9M1.5 24h11M4 31h8"/></g>` + m.svg + `<path class="mi-seta" d="M42.5 37.5l3 3-3 3"/>`);
  }
  // 6. Punho fechado: punho + partículas sendo puxadas (ímã)
  {
    const m = maoSVG({ dobra: [1, 1, 1, 1, 1], escala: 0.98, cx: 24, cy: 25 });
    ico.punho = svgIcone(`<g class="mi-ima mi-a-ima"><path d="M5 7l5 5M43 7l-5 5M5 41l5-5M43 41l-5-5"/><circle cx="4" cy="6" r="1.4"/><circle cx="44" cy="6" r="1.4"/><circle cx="4" cy="42" r="1.4"/><circle cx="44" cy="42" r="1.4"/></g>` + m.svg);
  }
  // 7. Joinha: punho de lado com o polegar para cima + confete azul, vermelho e branco
  {
    const m = maoSVG({ dobra: [0, 1, 1, 1, 1], polegar: { ang: Math.PI }, giro: Math.PI / 2, escala: 0.92, cx: 27, cy: 31 });
    ico.joinha = svgIcone(m.svg + `<g class="mi-a-confete"><rect class="mi-conf-a" x="37" y="6" width="3" height="5" rx=".6" transform="rotate(24 38.5 8.5)"/><rect class="mi-conf-v" x="42" y="15" width="3" height="5" rx=".6" transform="rotate(-30 43.5 17.5)"/><rect class="mi-conf-b" x="34" y="15.5" width="2.6" height="4.4" rx=".6" transform="rotate(60 35.3 17.7)"/><rect class="mi-conf-v" x="7" y="5" width="2.6" height="4.4" rx=".6" transform="rotate(-20 8.3 7.2)"/><rect class="mi-conf-a" x="4" y="14" width="2.6" height="4.4" rx=".6" transform="rotate(40 5.3 16.2)"/></g>`);
  }
  return ico;
}

// ícones de interface (traço 2, como os do index.html)
const ICO = {
  olho: '<svg class="ic-olho" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>'
    + '<svg class="ic-olho-off" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.9 3.7M6.2 6.9C3.9 8.6 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  ajuda: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><path d="M12 17.2h.01"/></svg>',
  desligar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v8"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/></svg>',
  cadeado: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
  camera: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6.5" width="13" height="11" rx="2"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  alerta: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.4h.01"/></svg>',
  check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

/* ================================================================================================ */
export function criarEfeitos(opts = {}) {
  const doc = document;
  const app = doc.getElementById('app') || doc.body;
  const mm = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)'); } catch { return null; } })();
  const reduz = () => !!(typeof opts.reduzido === 'function' ? opts.reduzido() : opts.reduzido) || !!(mm && mm.matches);
  const avisar = (nome, detail) => { try { app.dispatchEvent(new CustomEvent(nome, { bubbles: true, detail })); } catch { /* sem CustomEvent */ } };
  const chamar = (fn, ...a) => { try { return typeof fn === 'function' ? fn(...a) : undefined; } catch (e) { console.error(e); } };

  /* ---------- Cores (tokens do CSS) ---------- */
  let cs = null; try { cs = getComputedStyle(doc.documentElement); } catch { /* sem estilo */ }
  const tok = k => { let v = ''; try { v = cs ? cs.getPropertyValue(k).trim() : ''; } catch { /* nada */ } return v || RESERVA[k]; };
  const dadas = opts.cores || {};
  const base = {
    holo: rgbDe(dadas.holo || tok('--holo'), RESERVA['--holo']),
    azul: rgbDe(dadas.azul || tok('--azul'), RESERVA['--azul']),
    vermelho: rgbDe(dadas.vermelho || tok('--vermelho'), RESERVA['--vermelho']),
    ok: rgbDe(dadas.ok || tok('--ok'), RESERVA['--ok']),
    rever: rgbDe(dadas.rever || tok('--rever'), RESERVA['--rever']),
    novo: rgbDe(tok('--novo'), RESERVA['--novo']),
    branco: rgbDe(tok('--branco'), RESERVA['--branco']),
    bg: rgbDe(tok('--bg'), RESERVA['--bg']),
  };
  // no brilho aditivo o azul da marca (#2a41c8) some no fundo escuro: puxa um pouco para o ciano e clareia
  const RGB = [];
  RGB[HOLO] = base.holo; RGB[NOVO] = base.novo; RGB[AZUL] = mistura(mistura(base.azul, base.holo, 0.38), base.branco, 0.14);
  RGB[VERM] = mistura(base.vermelho, base.branco, 0.1); RGB[BRANCO] = base.branco; RGB[OK] = base.ok; RGB[REVER] = base.rever;
  const CSS = RGB.map(c => rgba(c, 1));
  const CSS_BG = rgba(base.bg, 1);
  const MIX_VERM = Array.from({ length: 11 }, (_, l) => rgba(mistura(RGB[HOLO], RGB[VERM], l / 10), 1));
  const CONF_FRENTE = [rgba(mistura(base.azul, base.branco, 0.1), 1), rgba(base.vermelho, 1), rgba(base.branco, 1)];
  const CONF_VERSO = [rgba(mistura(base.azul, base.bg, 0.35), 1), rgba(mistura(base.vermelho, base.bg, 0.35), 1), rgba(mistura(base.branco, base.bg, 0.3), 1)];

  // sprites desenhados uma vez: brilho redondo e traço (cabeça clara à direita)
  const SPR = [], TRACO = [];
  for (let i = 0; i < NCORES; i++) {
    const c = RGB[i];
    const s = doc.createElement('canvas'); s.width = s.height = 64;
    const g = s.getContext('2d');
    if (g) {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(mistura(c, base.branco, 0.85), 1));
      gr.addColorStop(0.14, rgba(mistura(c, base.branco, 0.4), 0.95));
      gr.addColorStop(0.36, rgba(c, 0.5));
      gr.addColorStop(0.68, rgba(c, 0.12));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    SPR[i] = s;
    const t = doc.createElement('canvas'); t.width = 128; t.height = 16;
    const h = t.getContext('2d');
    if (h) {
      h.save(); h.translate(64, 8); h.scale(64, 8);
      const gr = h.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, rgba(mistura(c, base.branco, 0.8), 1)); gr.addColorStop(0.3, rgba(mistura(c, base.branco, 0.25), 0.95));
      gr.addColorStop(0.62, rgba(c, 0.4)); gr.addColorStop(1, rgba(c, 0));
      h.fillStyle = gr; h.fillRect(-1, -1, 2, 2); h.restore();
      h.globalCompositeOperation = 'destination-in';
      const lg = h.createLinearGradient(0, 0, 128, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.45, 'rgba(0,0,0,.55)'); lg.addColorStop(0.85, 'rgba(0,0,0,1)'); lg.addColorStop(1, 'rgba(0,0,0,1)');
      h.fillStyle = lg; h.fillRect(0, 0, 128, 16);
    }
    TRACO[i] = t;
  }

  /* ---------- Elementos ---------- */
  const criados = [];
  const usados = [];
  function garantir(id, tag, classe) {
    let e = doc.getElementById(id);
    if (!e || (tag === 'canvas' && e.tagName !== 'CANVAS')) {
      e = doc.createElement(tag); e.id = id; app.appendChild(e); criados.push(e);
    } else usados.push(e);
    e.classList.add(classe);
    return e;
  }
  const fxCanvas = garantir('maosFx', 'canvas', 'maos-fx');
  fxCanvas.setAttribute('aria-hidden', 'true');
  const ctx = fxCanvas.getContext('2d');

  const ICONES = iconesGestos();
  const maoAberta = cls => svgIcone(maoSVG({ dobra: [0, 0, 0, 0, 0], abre: 1, escala: 0.82, cx: 24, cy: 27 }).svg, cls);

  // cartão da câmera
  const camEl = garantir('maosCam', 'section', 'maos-cam');
  camEl.hidden = true;
  camEl.setAttribute('aria-label', 'Câmera do Modo Mãos');
  camEl.innerHTML = cantos()
    + '<div class="mc-topo"><i class="mc-led" aria-hidden="true"></i><b>Modo Mãos</b><span class="mc-qps" data-ref="qps">— qps</span></div>'
    + '<div class="mc-tela" data-ref="tela"><canvas class="mc-esqueleto" data-ref="esq" aria-hidden="true"></canvas><span class="mc-varre" aria-hidden="true"></span>'
    + `<div class="mc-procura" data-ref="procura">${maoAberta('mc-procura-ico')}<span>Mostre a mão aberta para a câmera</span></div>`
    + '<div class="mc-pausa" data-ref="pausa" hidden>Pausado</div>'
    + '<div class="mc-rotulo"><span class="mc-gesto" data-ref="gesto" data-tom="holo" hidden>—</span><span class="mc-mao" data-ref="mao"></span></div></div>'
    + '<div class="mc-acoes">'
    + `<button type="button" class="mc-btn" data-acao="video">${ICO.olho}<span data-ref="videoTxt">Esconder vídeo</span></button>`
    + `<button type="button" class="mc-btn" data-acao="ajuda" aria-pressed="false" aria-controls="maosAjuda">${ICO.ajuda}<span>Ajuda</span></button>`
    + `<button type="button" class="mc-btn mc-desligar" data-acao="desligar">${ICO.desligar}<span>Desligar</span></button></div>`
    + `<p class="mc-priv">${ICO.cadeado}<span>A imagem fica só neste computador.</span></p>`;
  const ref = (raiz, nome) => raiz.querySelector(`[data-ref="${nome}"]`);
  const cam = {
    tela: ref(camEl, 'tela'), esq: ref(camEl, 'esq'), qps: ref(camEl, 'qps'), procura: ref(camEl, 'procura'), pausa: ref(camEl, 'pausa'),
    gesto: ref(camEl, 'gesto'), mao: ref(camEl, 'mao'), videoTxt: ref(camEl, 'videoTxt'),
    btnVideo: camEl.querySelector('[data-acao="video"]'), btnAjuda: camEl.querySelector('[data-acao="ajuda"]'),
  };
  // o vídeo da câmera: o #maosVideo do index.html (escondido) vem para dentro do cartão; sem ele, um novo
  let video = doc.getElementById('maosVideo');
  if (!video || video.tagName !== 'VIDEO') { video = doc.createElement('video'); video.id = 'maosVideo'; }
  video.classList.add('mc-video');
  video.muted = true; video.playsInline = true; video.autoplay = true;
  video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
  cam.tela.insertBefore(video, cam.tela.firstChild);
  const camCtx = cam.esq.getContext('2d');

  // cartão de ligar
  const ligEl = garantir('maosLigar', 'div', 'maos-ligar');
  ligEl.hidden = true;
  ligEl.setAttribute('role', 'dialog'); ligEl.setAttribute('aria-labelledby', 'maosLigarTitulo');
  ligEl.innerHTML = '<div class="ml-cartao">' + cantos()
    + `<button type="button" class="ml-x btn icone" data-acao="cancelar" aria-label="Fechar">${ICO.x}</button>`
    + `<div class="ml-heroi" aria-hidden="true">${heroi()}</div>`
    + '<div class="ml-cab"><p class="hud-rot" data-ref="rot">Modo Mãos</p><h2 id="maosLigarTitulo" data-ref="titulo">Controle o cérebro com as mãos</h2></div>'
    + '<p class="ml-texto" data-ref="texto">Mexa a mão na frente da câmera para levar o cursor e junte o polegar com o indicador para abrir o que está embaixo. Para fechar, como o Esc, abra a mão e segure parada.</p>'
    + '<ol class="ml-passos" data-ref="passos" hidden>' + PASSOS.map((p, i) => `<li class="ml-passo" data-i="${i}" data-st="espera"><i class="ml-st" aria-hidden="true">${ICO.check}</i><span class="ml-txt">${p[0]}</span><span class="ml-barra" hidden><i></i></span></li>`).join('') + '</ol>'
    + `<div class="ml-erro" data-ref="erro" role="alert" hidden><span class="ml-erro-ico">${ICO.alerta}</span><p data-ref="erroTxt"></p></div>`
    + `<p class="ml-priv">${ICO.cadeado}<span><b>A imagem fica só neste computador.</b> O reconhecimento roda aqui no navegador; nada é gravado nem enviado.</span></p>`
    + '<div class="ml-acoes" data-ref="acoes"></div>'
    + '</div>';
  const lig = {
    cartao: ligEl.querySelector('.ml-cartao'), rot: ref(ligEl, 'rot'), titulo: ref(ligEl, 'titulo'), texto: ref(ligEl, 'texto'),
    passos: ref(ligEl, 'passos'), erro: ref(ligEl, 'erro'), erroTxt: ref(ligEl, 'erroTxt'), acoes: ref(ligEl, 'acoes'),
  };

  // ajuda dos gestos
  const ajEl = garantir('maosAjuda', 'div', 'maos-ajuda');
  ajEl.hidden = true;
  ajEl.setAttribute('role', 'dialog'); ajEl.setAttribute('aria-labelledby', 'maosAjudaTitulo');
  const GESTOS = [
    ['mover', 'Mover a mão', 'mexe o cursor'],
    ['pinca', 'Pinça (polegar + indicador)', 'abre o que está embaixo'],
    ['arrastar', 'Pinça segurada e arrastar', 'rola o texto / arrasta o mapa'],
    ['aberta', 'Abrir a mão e segurar parada', 'fecha (como Esc); o anel do cursor enche antes'],
    ['deslizar', 'Mão aberta deslizando para o lado', 'troca de aba / próxima rotina'],
    ['punho', 'Punho fechado', 'segura a cabeça do robô'],
    ['joinha', 'Joinha', 'o robô comemora'],
  ];
  ajEl.innerHTML = '<div class="ma-cartao">' + cantos()
    + '<header class="ma-cab"><p class="hud-rot">Modo Mãos <span aria-hidden="true">·</span> <b>7</b> gestos</p><h2 id="maosAjudaTitulo">Como usar as mãos</h2>'
    + `<button type="button" class="ma-x btn icone" data-acao="fechar-ajuda" aria-label="Fechar ajuda">${ICO.x}</button></header>`
    + '<p class="ma-status" data-ref="status" hidden><i aria-hidden="true"></i><span data-ref="statusTxt">Mostre a mão aberta para a câmera</span></p>'
    + '<ul class="ma-lista">' + GESTOS.map(([k, t, d]) => `<li class="ma-item"><span class="ma-ico">${ICONES[k]}</span><span class="ma-txt"><b>${t}</b><span>${d}</span></span></li>`).join('')
    + '<li class="ma-item ma-dica"><span class="ma-txt"><b>Dica</b><span>Fique a um braço da câmera, com a mão bem iluminada e a palma virada para a tela.</span></span></li></ul>'
    + `<footer class="ma-rodape"><p class="ma-priv">${ICO.cadeado}<span>A imagem fica só neste computador.</span></p><button type="button" class="btn principal pequeno" data-acao="fechar-ajuda">Entendi</button></footer>`
    + '</div>';
  const aj = { status: ref(ajEl, 'status'), statusTxt: ref(ajEl, 'statusTxt') };

  function cantos() {
    return '<span class="canto ce" aria-hidden="true"></span><span class="canto cd" aria-hidden="true"></span><span class="canto be" aria-hidden="true"></span><span class="canto bd" aria-hidden="true"></span>';
  }
  function heroi() {
    const m = maoSVG({ dobra: [0, 0, 0, 0, 0], abre: 0.8, escala: 1.62, cx: 60, cy: 64 });
    return '<svg class="ml-scan" viewBox="0 0 120 120" aria-hidden="true" focusable="false">'
      + '<defs><clipPath id="maosClipHeroi"><circle cx="60" cy="60" r="49"/></clipPath></defs>'
      + '<circle class="ml-fundo" cx="60" cy="60" r="49"/>'
      + '<circle class="ml-aro ml-aro1" cx="60" cy="60" r="56"/><circle class="ml-aro ml-aro2" cx="60" cy="60" r="49"/>'
      + '<g class="ml-marcas"><path d="M60 1v6M60 113v6M1 60h6M113 60h6"/></g>'
      + `<g class="mi">${m.svg}</g>`
      + '<g clip-path="url(#maosClipHeroi)"><g class="ml-feixe"><rect class="ml-feixe-banda" x="8" y="0" width="104" height="16"/><rect class="ml-feixe-linha" x="8" y="15" width="104" height="1.4"/></g></g></svg>';
  }

  /* ---------- Estado ---------- */
  let manual = false, tManual = 0;   // relógio manual: só a página de teste usa (opts.depurar)
  const agora = () => (manual ? tManual : performance.now());
  let morto = false, raf = 0, ultT = 0, emaDt = 1 / 60, fator = 1;
  let W = 0, H = 0, ox = 0, oy = 0, dpr = 1;
  let camW = 240, camH = 180, camDpr = 1;
  let simulando = false;
  let rodando = false, pausado = false, modoLig = '', esperandoMao = false, tFecharLig = 0, ultMao = 0, ultQ = 0, emaQ = 0;
  let videoVisivel = lerPref('maos-video') !== 'oculto';
  let ajudaAberta = false, focoAntes = null, ajudaDesde = 0, maoDesde = 0;
  let temMao = false, rotTxt = '—', rotTom = '', rotMao = '', qpsMotor = 0;
  let arrastando = false, agarrando = false;

  // mãos (slot 0 = a que comanda o cursor; slot 1 = a outra)
  const alvo = [new Float32Array(42), new Float32Array(42)];
  const mostra = [new Float32Array(42), new Float32Array(42)];
  const slotAtivo = [false, false], slotId = ['', ''], slotPincando = [false, false];
  const slotA = new Float32Array(2), slotPinca = new Float32Array(2), slotMix = new Float32Array(2), slotTam = new Float32Array([1, 1]);
  const hist = new Float32Array(2 * 5 * HIST * 2), hCab = new Int16Array(2), hQt = new Int16Array(2);
  const acum = new Float32Array(10);

  // cursor
  let cursorOn = false, cursorFora = false, cX = 0, cY = 0, cTx = 0, cTy = 0, cA = 0, cP = 0, pincaAlvo = 0, pincando = false, cRot = 0;
  let hoverAmt = 0, hoverAlgo = false, cEsp = 0, espAlvo = 0, ultEsp = 0, espCor = BRANCO;
  let arrDX = 0, arrDY = 0, surgirEm = 0, sobrePainel = false, painelAmt = 0;
  // mira em volta do elemento clicável (.mao-hover)
  let hvEl = null, hvCont = 0, hvOk = false, hvA = 0, hvFlash = 0;
  const hvR = new Float32Array(4), hvD = new Float32Array(4);
  // ímã do punho
  let imaOn = false, imaX = 0, imaY = 0, imaAcum = 0, imaT = 0;

  // pool de partículas (estrutura de vetores; morte = troca com a última)
  const px = new Float32Array(MAX_P), py = new Float32Array(MAX_P), pvx = new Float32Array(MAX_P), pvy = new Float32Array(MAX_P);
  const pVida = new Float32Array(MAX_P), pMax = new Float32Array(MAX_P), pTam = new Float32Array(MAX_P), pArr = new Float32Array(MAX_P);
  const pGrav = new Float32Array(MAX_P), pRot = new Float32Array(MAX_P), pVrot = new Float32Array(MAX_P), pFase = new Float32Array(MAX_P);
  const pVf = new Float32Array(MAX_P), pAsp = new Float32Array(MAX_P);
  const pTipo = new Uint8Array(MAX_P), pCor = new Uint8Array(MAX_P);
  let nP = 0;
  // pool de ondas
  const oTipo = new Uint8Array(MAX_O), oCor = new Uint8Array(MAX_O);
  const oX = new Float32Array(MAX_O), oY = new Float32Array(MAX_O), oT = new Float32Array(MAX_O), oDur = new Float32Array(MAX_O);
  const oA = new Float32Array(MAX_O), oB = new Float32Array(MAX_O), oW = new Float32Array(MAX_O), oRot = new Float32Array(MAX_O);
  let nO = 0;

  /* ---------- Tamanho ---------- */
  function medir() {
    let r = null;
    try { r = app.getBoundingClientRect(); } catch { /* nada */ }
    W = Math.max(1, Math.round((r && r.width) || innerWidth)); H = Math.max(1, Math.round((r && r.height) || innerHeight));
    ox = (r && r.left) || 0; oy = (r && r.top) || 0;
    dpr = Math.min(1.5, Math.max(1, devicePixelRatio || 1));
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    if (fxCanvas.width !== bw || fxCanvas.height !== bh) { fxCanvas.width = bw; fxCanvas.height = bh; }
    medirCam();
    acordar();
  }
  function medirCam() {
    const w = cam.tela.clientWidth || camW, h = cam.tela.clientHeight || camH;
    camW = w; camH = h; camDpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
    const bw = Math.round(w * camDpr), bh = Math.round(h * camDpr);
    if (cam.esq.width !== bw || cam.esq.height !== bh) { cam.esq.width = bw; cam.esq.height = bh; }
  }
  let ro = null;
  try { ro = new ResizeObserver(() => medir()); ro.observe(app); ro.observe(cam.tela); } catch { ro = null; }
  const onResize = () => medir();
  addEventListener('resize', onResize);
  medir();

  /* ---------- Pools ---------- */
  function emitir(tipo, cor, x, y, vx, vy, vida, tam, arr, grav) {
    if (nP >= MAX_P) return -1;
    const i = nP++;
    pTipo[i] = tipo; pCor[i] = cor; px[i] = x; py[i] = y; pvx[i] = vx; pvy[i] = vy;
    pVida[i] = vida; pMax[i] = vida; pTam[i] = tam; pArr[i] = arr || 0; pGrav[i] = grav || 0;
    pRot[i] = 0; pVrot[i] = 0; pFase[i] = 0; pVf[i] = 0; pAsp[i] = 1;
    return i;
  }
  function matar(i) {
    const n = --nP;
    if (i === n) return;
    pTipo[i] = pTipo[n]; pCor[i] = pCor[n]; px[i] = px[n]; py[i] = py[n]; pvx[i] = pvx[n]; pvy[i] = pvy[n];
    pVida[i] = pVida[n]; pMax[i] = pMax[n]; pTam[i] = pTam[n]; pArr[i] = pArr[n]; pGrav[i] = pGrav[n];
    pRot[i] = pRot[n]; pVrot[i] = pVrot[n]; pFase[i] = pFase[n]; pVf[i] = pVf[n]; pAsp[i] = pAsp[n];
  }
  function onda(tipo, x, y, dur, a, b, cor, w, atraso, rot) {
    let i = -1;
    for (let k = 0; k < MAX_O; k++) if (!oTipo[k]) { i = k; break; }
    if (i < 0) return;
    oTipo[i] = tipo; oX[i] = x; oY[i] = y; oDur[i] = dur; oA[i] = a; oB[i] = b; oCor[i] = cor;
    oW[i] = w || 1; oT[i] = -(atraso || 0); oRot[i] = rot || 0;
    nO++;
  }
  const qt = n => Math.max(1, Math.round(n * fator));
  const rnd = Math.random;

  /* ---------- Laço ---------- */
  function acordar() { if (!raf && !morto && !doc.hidden && !manual) raf = requestAnimationFrame(passo); }
  function precisa() {
    return slotAtivo[0] || slotAtivo[1] || slotA[0] > 0.01 || slotA[1] > 0.01 || cA > 0.01 || nP > 0 || nO > 0 || imaOn || hvA > 0.01;
  }
  function passo(t) {
    raf = 0;
    if (morto) return;
    const dtBruto = ultT ? Math.max(0, (t - ultT) / 1000) : 1 / 60;
    const dtReal = Math.min(0.1, dtBruto);
    ultT = t;
    emaDt = emaDt * 0.94 + dtReal * 0.06;
    if (emaDt > 0.021) fator = Math.max(0.35, fator - dtReal * 0.6);
    else if (emaDt < 0.0178) fator = Math.min(1, fator + dtReal * 0.3);
    // travada (aba voltando, máquina ocupada): o rastro recomeça em vez de riscar a tela de uma ponta à outra
    if (dtBruto > 0.09) for (let s = 0; s < 2; s++) { hQt[s] = 0; mostra[s].set(alvo[s]); }
    const dt = dtReal;
    atualizar(dt, t);
    desenhar(t);
    if (manual) return;
    if (precisa()) raf = requestAnimationFrame(passo);
    else { ultT = 0; ctx && ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height); }
  }

  function atualizar(dt, t) {
    const r = reduz();
    const k = 1 - Math.exp(-dt * 24);
    painelAmt += ((sobrePainel ? 1 : 0) - painelAmt) * (1 - Math.exp(-dt * 8));
    const densidade = fator * (1 - 0.7 * painelAmt);
    for (let s = 0; s < 2; s++) {
      slotA[s] += ((slotAtivo[s] ? 1 : 0) - slotA[s]) * (1 - Math.exp(-dt * (slotAtivo[s] ? 10 : 6)));
      if (!slotAtivo[s]) continue;
      const a = alvo[s], m = mostra[s];
      for (let i = 0; i < 42; i++) m[i] += (a[i] - m[i]) * k;
      const mixAlvo = slotPincando[s] ? 1 : suave(0.45, 0.95, slotPinca[s]) * 0.6;
      slotMix[s] += (mixAlvo - slotMix[s]) * (1 - Math.exp(-dt * 16));
      // rastro: guarda a posição de cada ponta e solta partículas pelo caminho (quanto mais rápido, mais)
      const prevCab = hCab[s], tinha = hQt[s] > 0;
      hCab[s] = (hCab[s] + 1) % HIST; if (hQt[s] < HIST) hQt[s]++;
      for (let f = 0; f < 5; f++) {
        const pi = PONTAS[f] * 2, b = ((s * 5 + f) * HIST + hCab[s]) * 2;
        const x = m[pi], y = m[pi + 1];
        hist[b] = x; hist[b + 1] = y;
        if (r || !tinha || dt <= 0) continue;
        const bp = ((s * 5 + f) * HIST + prevCab) * 2, x0 = hist[bp], y0 = hist[bp + 1];
        const dx = x - x0, dy = y - y0, dist = Math.hypot(dx, dy);
        if (dist < 0.4) continue;
        acum[s * 5 + f] += (dist / 6.5) * densidade * (s === 0 ? 1 : 0.7);
        let n = Math.floor(acum[s * 5 + f]); acum[s * 5 + f] -= n;
        if (n > 6) n = 6;
        const vel = dist / dt, tam = slotTam[s];
        const pinc = f < 2 && slotMix[s] > 0.5;
        for (let j = 0; j < n; j++) {
          const u = rnd();
          const cor = pinc ? VERM : (rnd() < 0.18 ? BRANCO : COR_DEDO[f]);
          const ex = x0 + dx * u + (rnd() - 0.5) * 3, ey = y0 + dy * u + (rnd() - 0.5) * 3;
          const ang = rnd() * TAU, sp = 10 + rnd() * 30;
          if (rnd() < 0.12 && vel > 600) {
            const nx = -dy / dist, ny = dx / dist, lado = rnd() < 0.5 ? -1 : 1, sp2 = 160 + rnd() * 260;
            emitir(P_TRACO, cor, ex, ey, nx * sp2 * lado - dx / dt * 0.1, ny * sp2 * lado - dy / dt * 0.1, 0.22 + rnd() * 0.18, 5 * tam, 6, 0);
          } else {
            emitir(P_BRILHO, cor, ex, ey, Math.cos(ang) * sp - dx / dt * 0.05, Math.sin(ang) * sp - dy / dt * 0.05 - 18,
              0.42 + rnd() * 0.5, (10 + rnd() * 14) * tam * (0.7 + Math.min(1, vel / 2200) * 0.7), 1.8, 0);
          }
        }
      }
    }
    // cursor
    const kc = 1 - Math.exp(-dt * 30);
    if (cursorOn) { cX += (cTx - cX) * kc; cY += (cTy - cY) * kc; }
    cA += ((cursorOn ? (cursorFora ? 0.4 : 1) : 0) - cA) * (1 - Math.exp(-dt * (cursorOn ? 12 : 6)));
    const pVis = pincando ? 1 : suave(0.08, 0.95, pincaAlvo) * 0.78;
    cP += (pVis - cP) * (1 - Math.exp(-dt * 20));
    hoverAmt += ((hoverAlgo && cursorOn ? 1 : 0) - hoverAmt) * (1 - Math.exp(-dt * 14));
    if (!r) cRot += dt * (0.6 + hoverAmt * 2.2 + (agarrando ? 5 : 0));
    if (t - ultEsp > 260) espAlvo = 0;
    cEsp += (espAlvo - cEsp) * (1 - Math.exp(-dt * (espAlvo > cEsp ? 30 : 9)));
    hvFlash *= Math.exp(-dt * 7);
    hvA += ((hvOk && cursorOn ? 1 : 0) - hvA) * (1 - Math.exp(-dt * (r ? 60 : 14)));
    const kh = r ? 1 : 1 - Math.exp(-dt * 20);
    for (let i = 0; i < 4; i++) hvD[i] += (hvR[i] - hvD[i]) * kh;
    // ímã do punho: segue a palma e puxa partículas em espiral
    if (imaOn) {
      if (slotAtivo[0]) { const m = mostra[0]; imaX = (m[0] + m[10] + m[18] + m[26] + m[34]) / 5; imaY = (m[1] + m[11] + m[19] + m[27] + m[35]) / 5; }
      imaT += dt;
      if (!r) {
        imaAcum += dt * 190 * fator;
        let n = Math.floor(imaAcum); imaAcum -= n; if (n > 8) n = 8;
        for (let j = 0; j < n; j++) {
          const a = rnd() * TAU, R = 120 + rnd() * 170, ca = Math.cos(a), sa = Math.sin(a), tg = 170 + rnd() * 220;
          const i = emitir(P_IMA, rnd() < 0.22 ? BRANCO : rnd() < 0.5 ? HOLO : NOVO, imaX + ca * R, imaY + sa * R,
            -sa * tg - ca * 40, ca * tg - sa * 40, 1.6, 6 + rnd() * 8, 1.1, 0);
          if (i >= 0) pAsp[i] = 0;   // pAsp = brilho de entrada (sobe de 0 a 1)
        }
      }
    }
    // partículas
    for (let i = 0; i < nP;) {
      const v = pVida[i] - dt;
      if (v <= 0) { matar(i); continue; }
      pVida[i] = v;
      const tp = pTipo[i];
      if (tp === P_IMA) {
        if (imaOn) {
          const dx = imaX - px[i], dy = imaY - py[i], d = Math.hypot(dx, dy) + 0.001;
          if (d < 14) { matar(i); continue; }
          const acc = 2300 + 160000 / (d + 40);
          pvx[i] += (dx / d) * acc * dt; pvy[i] += (dy / d) * acc * dt;
          pAsp[i] = Math.min(1, pAsp[i] + dt * 4);
        } else {   // soltou o punho: as presas viram faíscas que se espalham
          const dx = px[i] - imaX, dy = py[i] - imaY, d = Math.hypot(dx, dy) + 0.001, sp = 260 + rnd() * 260;
          pTipo[i] = P_BRILHO; pvx[i] = (dx / d) * sp; pvy[i] = (dy / d) * sp; pArr[i] = 3.2; pVida[i] = Math.min(pVida[i], 0.5); pMax[i] = 0.5;
        }
      }
      const ar = pArr[i];
      if (ar) { const fa = Math.exp(-ar * dt); pvx[i] *= fa; pvy[i] *= fa; }
      pvy[i] += pGrav[i] * dt;
      px[i] += pvx[i] * dt; py[i] += pvy[i] * dt;
      if (tp === P_CONFETE) { pRot[i] += pVrot[i] * dt; pFase[i] += pVf[i] * dt; pvx[i] += Math.sin(pFase[i] * 0.5) * 30 * dt; }
      i++;
    }
    // ondas
    for (let i = 0; i < MAX_O; i++) {
      if (!oTipo[i]) continue;
      oT[i] += dt;
      if (oT[i] >= oDur[i]) { oTipo[i] = 0; nO--; }
    }
  }

  /* ---------- Desenho ---------- */
  function linha(x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function circulo(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.stroke(); }
  function arcoBrilho(x, y, r, a0, a1, cor, lw, al) {
    ctx.strokeStyle = CSS[cor];
    ctx.globalAlpha = al * 0.22; ctx.lineWidth = lw * 3.4; ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke();
    ctx.globalAlpha = al; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke();
  }
  function sprite(cor, x, y, s, al) {
    if (al <= 0.004 || s <= 0.5) return;
    ctx.globalAlpha = al > 1 ? 1 : al;
    ctx.drawImage(SPR[cor], x - s / 2, y - s / 2, s, s);
  }

  function desenhar(t) {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const r = reduz();
    ctx.globalCompositeOperation = 'lighter';
    if (!r) { desenharRastros(); desenharOndas(); desenharParticulas(); desenharIma(t); }
    desenharMira();
    if (!r) desenharPontas();
    if (!r && nP) desenharConfete();
    desenharCursor(r);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function desenharRastros() {
    for (let s = 0; s < 2; s++) {
      const sa = slotA[s] * (1 - 0.65 * painelAmt), n = hQt[s];
      if (sa < 0.01 || n < 2) continue;
      const tam = slotTam[s];
      for (let f = 0; f < 5; f++) {
        const corCss = f < 2 ? MIX_VERM[Math.round(slotMix[s] * 10)] : CSS[COR_DEDO[f]];
        ctx.strokeStyle = corCss;
        const b0 = (s * 5 + f) * HIST;
        for (let pass = 0; pass < 3; pass++) {
          if (pass === 2) ctx.strokeStyle = f < 2 && slotMix[s] > 0.5 ? CSS[BRANCO] : corCss;
          for (let k = 0; k < n - 1; k++) {
            const i0 = (b0 + ((hCab[s] - k + HIST) % HIST)) * 2, i1 = (b0 + ((hCab[s] - k - 1 + HIST) % HIST)) * 2;
            const x0 = hist[i0], y0 = hist[i0 + 1], x1 = hist[i1], y1 = hist[i1 + 1];
            const len = Math.hypot(x1 - x0, y1 - y0);
            if (len < 0.6) continue;
            const fd = 1 - k / (HIST - 1), vis = Math.min(1, len / 7);
            const al = fd * vis * sa;
            if (al < 0.02) continue;
            if (pass === 0) { ctx.globalAlpha = al * 0.09; ctx.lineWidth = (8 + 18 * fd) * tam; }
            else if (pass === 1) { ctx.globalAlpha = al * 0.3; ctx.lineWidth = (2.5 + 6 * fd) * tam; }
            else { ctx.globalAlpha = al * 0.95; ctx.lineWidth = (0.8 + 2.2 * fd) * tam; }
            linha(x0, y0, x1, y1);
          }
        }
      }
    }
  }

  function desenharPontas() {
    for (let s = 0; s < 2; s++) {
      const sa = slotA[s];
      if (sa < 0.01) continue;
      const m = mostra[s], tam = slotTam[s], base = s === 0 ? 0.75 : 0.45;
      for (let f = 0; f < 5; f++) {
        const x = m[PONTAS[f] * 2], y = m[PONTAS[f] * 2 + 1];
        if (f < 2) {
          const mx = slotMix[s];
          sprite(HOLO, x, y, 24 * tam, sa * base * (1 - mx));
          sprite(VERM, x, y, (24 + 10 * mx) * tam, sa * base * mx * 1.3);
        } else sprite(COR_DEDO[f], x, y, 21 * tam, sa * base * 0.85);
      }
      // a fresta da pinça: linha do polegar ao indicador que encurta e avermelha
      if (s === 0 && cursorOn && !slotPincando[0] && slotPinca[0] > 0.18) {
        const al = Math.min(1, (slotPinca[0] - 0.18) / 0.55) * 0.75 * sa;
        ctx.strokeStyle = MIX_VERM[Math.round(Math.min(1, slotPinca[0]) * 7)];
        ctx.globalAlpha = al * 0.25; ctx.lineWidth = 5; linha(m[8], m[9], m[16], m[17]);
        ctx.globalAlpha = al; ctx.lineWidth = 1.2; linha(m[8], m[9], m[16], m[17]);
      }
    }
  }

  function desenharParticulas() {
    // brilhos primeiro (sem trocar a matriz), depois os traços (com matriz girada)
    for (let i = 0; i < nP; i++) {
      const tp = pTipo[i];
      if (tp === P_CONFETE || tp === P_TRACO) continue;
      const vida = pVida[i] / pMax[i];
      let al = vida < 0.35 ? vida / 0.35 : 1, tam = pTam[i] * (0.35 + 0.65 * vida);
      if (tp === P_IMA) { al *= 0.35 + 0.65 * pAsp[i]; tam = pTam[i] * 0.7; }
      sprite(pCor[i], px[i], py[i], tam, al);
    }
    // traços (rajadas e faíscas) e as partículas presas no ímã, esticadas na direção em que correm
    let girou = false;
    for (let i = 0; i < nP; i++) {
      const tp = pTipo[i];
      if (tp !== P_TRACO && tp !== P_IMA) continue;
      const vx = pvx[i], vy = pvy[i], sp = Math.hypot(vx, vy);
      if (sp < 1) continue;
      const vida = pVida[i] / pMax[i];
      let al = vida < 0.5 ? vida / 0.5 : 1, len, h;
      if (tp === P_IMA) { al = pAsp[i] * 0.85; len = Math.min(70, sp * 0.05); h = pTam[i] * 0.8; if (len < 6) continue; }
      else { len = Math.min(130, Math.max(10, sp * 0.07)) * (0.6 + 0.4 * vida); h = pTam[i] * 1.25; }
      const c = vx / sp, s = vy / sp;
      ctx.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, px[i] * dpr, py[i] * dpr);
      ctx.globalAlpha = al;
      ctx.drawImage(TRACO[pCor[i]], -len, -h / 2, len, h);
      girou = true;
    }
    if (girou) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function desenharConfete() {
    ctx.globalCompositeOperation = 'source-over';
    let girou = false;
    for (let i = 0; i < nP; i++) {
      if (pTipo[i] !== P_CONFETE) continue;
      const vida = pVida[i] / pMax[i], al = vida < 0.3 ? vida / 0.3 : 1;
      const fl = Math.cos(pFase[i]), c = Math.cos(pRot[i]), s = Math.sin(pRot[i]);
      const w = pTam[i], h = pTam[i] * pAsp[i];
      ctx.setTransform(c * dpr, s * dpr, -s * fl * dpr, c * fl * dpr, px[i] * dpr, py[i] * dpr);
      ctx.globalAlpha = al;
      ctx.fillStyle = fl > 0 ? CONF_FRENTE[pCor[i]] : CONF_VERSO[pCor[i]];
      ctx.fillRect(-w / 2, -h / 2, w, h);
      girou = true;
    }
    if (girou) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
  }

  function desenharIma(t) {
    if (!imaOn) return;
    const pulso = 0.5 + 0.5 * Math.sin(t / 110);
    sprite(HOLO, imaX, imaY, 120 + 24 * pulso, 0.22 + 0.1 * pulso);
    sprite(BRANCO, imaX, imaY, 34 + 8 * pulso, 0.35);
    ctx.strokeStyle = CSS[HOLO];
    for (let k = 0; k < 3; k++) {   // anéis que encolhem para o punho, sem parar
      const u = ((imaT * 1.4 + k / 3) % 1), R = 150 * (1 - eo3(u)) + 18;
      ctx.globalAlpha = Math.sin(Math.PI * u) * 0.45; ctx.lineWidth = 1.4;
      circulo(imaX, imaY, R);
    }
  }

  function desenharOndas() {
    for (let i = 0; i < MAX_O; i++) {
      const tp = oTipo[i];
      if (!tp || oT[i] < 0) continue;
      const u = clamp01(oT[i] / oDur[i]), x = oX[i], y = oY[i], cor = oCor[i];
      if (tp === O_ANEL) {
        const R = oA[i] + (oB[i] - oA[i]) * eo4(u), al = (1 - u) ** 1.3;
        ctx.strokeStyle = CSS[cor];
        ctx.globalAlpha = al * 0.25; ctx.lineWidth = oW[i] * (1 - u) * 3.5 + 2; circulo(x, y, R);
        ctx.globalAlpha = al; ctx.lineWidth = oW[i] * (1 - u) + 0.6; circulo(x, y, R);
      } else if (tp === O_CHOQUE) {
        const R = oA[i] + (oB[i] - oA[i]) * eo3(u), al = (1 - u) ** 1.5, lw = oW[i] * (1 - u * 0.85);
        ctx.strokeStyle = CSS[cor];
        ctx.globalAlpha = al * 0.18; ctx.lineWidth = lw * 2.6; circulo(x, y, R);
        ctx.globalAlpha = al * 0.5; ctx.lineWidth = lw; circulo(x, y, R);
        ctx.strokeStyle = CSS[BRANCO]; ctx.globalAlpha = al * 0.85; ctx.lineWidth = Math.max(1, lw * 0.2); circulo(x, y, R);
        ctx.globalAlpha = al * 0.12; ctx.lineWidth = lw * 0.6; circulo(x, y, R * 0.82);
        // riscos radiais na frente da onda
        ctx.strokeStyle = CSS[cor]; ctx.globalAlpha = al * 0.7; ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let k = 0; k < 28; k++) {
          const a = k * 2.39996 + oRot[i], c = Math.cos(a), s = Math.sin(a), l = 10 + (k % 4) * 7;
          ctx.moveTo(x + c * (R - l * 0.4), y + s * (R - l * 0.4)); ctx.lineTo(x + c * (R + l), y + s * (R + l));
        }
        ctx.stroke();
      } else if (tp === O_ARCOS) {
        const al = Math.sin(Math.PI * u) ** 0.6, e = eo3(u);
        const giro = 9 * (1 - (1 - u) ** 2), r1 = oA[i] * (0.8 + 0.3 * e), r2 = oB[i] * (0.8 + 0.3 * e);
        const a1 = oRot[i] + giro, a2 = oRot[i] + Math.PI - giro * 1.25, sw = 2.3;
        arcoBrilho(x, y, r1, a1 - 0.5, a1 + sw - 0.5, HOLO, 2, al * 0.3);
        arcoBrilho(x, y, r2, a2 + 0.6, a2 + sw + 0.6, VERM, 2, al * 0.3);
        arcoBrilho(x, y, r1, a1, a1 + sw, HOLO, 3.6, al);
        arcoBrilho(x, y, r2, a2, a2 + sw, VERM, 3.6, al);
        sprite(BRANCO, x + Math.cos(a1 + sw) * r1, y + Math.sin(a1 + sw) * r1, 22, al);
        sprite(BRANCO, x + Math.cos(a2 + sw) * r2, y + Math.sin(a2 + sw) * r2, 22, al);
        ctx.strokeStyle = CSS[HOLO]; ctx.globalAlpha = al * 0.25; ctx.lineWidth = 1;
        circulo(x, y, (r1 + r2) / 2);
      } else if (tp === O_SETAS) {
        const ang = oRot[i], ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
        for (let j = 0; j < 3; j++) {
          const uj = (u - j * 0.11) / 0.62;
          if (uj <= 0 || uj >= 1) continue;
          const d = 40 + 260 * eo3(uj), s = 17 - j * 2, al = Math.sin(Math.PI * uj);
          const tx = x + ux * d, ty = y + uy * d;
          ctx.strokeStyle = CSS[j === 0 ? BRANCO : HOLO];
          for (let pass = 0; pass < 2; pass++) {
            ctx.globalAlpha = pass ? al : al * 0.25; ctx.lineWidth = pass ? 3 : 10;
            ctx.beginPath();
            ctx.moveTo(tx - ux * s + nx * s * 0.85, ty - uy * s + ny * s * 0.85); ctx.lineTo(tx, ty);
            ctx.lineTo(tx - ux * s - nx * s * 0.85, ty - uy * s - ny * s * 0.85);
            ctx.stroke();
          }
        }
      } else if (tp === O_SURGE) {
        if (cursorOn) { oX[i] = cX; oY[i] = cY; }
        const xs = oX[i], ys = oY[i];
        const R = oA[i] + (oB[i] - oA[i]) * eio(u), al = Math.sin(Math.PI * u) ** 0.5;
        ctx.strokeStyle = CSS[cor];
        ctx.globalAlpha = al * 0.25; ctx.lineWidth = 6; circulo(xs, ys, R);
        ctx.globalAlpha = al; ctx.lineWidth = 1.5; circulo(xs, ys, R);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + u * 3, c = Math.cos(a), s = Math.sin(a);
          ctx.moveTo(xs + c * (R + 4), ys + s * (R + 4)); ctx.lineTo(xs + c * (R + 14), ys + s * (R + 14));
        }
        ctx.stroke();
      } else if (tp === O_FLASH) {
        const S = oA[i] + (oB[i] - oA[i]) * eo3(u);
        sprite(cor, x, y, S, oW[i] * (1 - u) * (1 - u));
      }
    }
  }

  function desenharMira() {
    if (hvA < 0.01) return;
    const inf = 5 + hvFlash * 7;
    const x = hvD[0] - inf, y = hvD[1] - inf, w = hvD[2] + inf * 2, h = hvD[3] + inf * 2;
    if (w < 2 || h < 2) return;
    const L = Math.min(13, w * 0.3, h * 0.42);
    const al = hvA * (0.8 + hvFlash * 0.2);
    ctx.strokeStyle = CSS[hvFlash > 0.4 ? BRANCO : HOLO];
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? al : al * 0.22; ctx.lineWidth = pass ? 1.7 : 6;
      ctx.beginPath();
      ctx.moveTo(x, y + L); ctx.lineTo(x, y); ctx.lineTo(x + L, y);
      ctx.moveTo(x + w - L, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + L);
      ctx.moveTo(x + w, y + h - L); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - L, y + h);
      ctx.moveTo(x + L, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - L);
      ctx.stroke();
    }
  }

  function desenharCursor(r) {
    if (cA < 0.01) return;
    const x = cX, y = cY, p = cP, R = 21 - 10 * p + hoverAmt * 3;
    // fundo escuro fino: o anel continua legível sobre o capacete branco e sobre os painéis
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = CSS_BG; ctx.globalAlpha = 0.55 * cA; ctx.lineWidth = 5; circulo(x, y, R);
    ctx.globalCompositeOperation = 'lighter';
    sprite(HOLO, x, y, R * 3.2, 0.12 * cA);
    ctx.strokeStyle = CSS[HOLO];
    ctx.globalAlpha = 0.22 * cA; ctx.lineWidth = 6; circulo(x, y, R);
    ctx.globalAlpha = 0.95 * cA; ctx.lineWidth = 1.6; circulo(x, y, R);
    // lente: anel interno pontilhado, girando devagar
    ctx.globalAlpha = 0.4 * cA; ctx.lineWidth = 1.2;
    ctx.setLineDash(PONTILHADO); ctx.lineDashOffset = -cRot * 6;
    circulo(x, y, Math.max(3, R - 5));
    ctx.setLineDash(SEM_TRACO); ctx.lineDashOffset = 0;
    // mira: quatro marcas que se aproximam com a pinça
    const tl = 7 - 3.5 * p, r0 = R + 3.5;
    ctx.globalAlpha = 0.9 * cA; ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = cRot * 0.35 + k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
      ctx.moveTo(x + c * r0, y + s * r0); ctx.lineTo(x + c * (r0 + tl), y + s * (r0 + tl));
    }
    ctx.stroke();
    // sobre algo clicável: quatro arcos girando ("alvo travado")
    if (hoverAmt > 0.01) {
      const ra = R + 8.5;
      ctx.globalAlpha = hoverAmt * cA * 0.85; ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        const a = -cRot + k * Math.PI / 2 + 0.3;
        ctx.beginPath(); ctx.arc(x, y, ra, a, a + 0.62); ctx.stroke();
      }
    }
    // espera: anel de progresso (branco = clique por espera; ciano = a mão aberta contando para fechar)
    if (cEsp > 0.01) {
      const a0 = -Math.PI / 2;
      ctx.strokeStyle = CSS[espCor];
      ctx.globalAlpha = 0.25 * cA; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, R + 5, a0, a0 + cEsp * TAU); ctx.stroke();
      ctx.globalAlpha = 0.95 * cA; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(x, y, R + 5, a0, a0 + cEsp * TAU); ctx.stroke();
    }
    // punho: anel tracejado girando rápido
    if (agarrando) {
      ctx.strokeStyle = CSS[HOLO]; ctx.globalAlpha = 0.8 * cA; ctx.lineWidth = 1.6;
      ctx.setLineDash(TRACEJADO); ctx.lineDashOffset = -cRot * 18;
      circulo(x, y, R + 13);
      ctx.setLineDash(SEM_TRACO); ctx.lineDashOffset = 0;
    }
    // arraste: setinha na direção em que a pinça está levando
    if (arrastando && !r) {
      const m = Math.hypot(arrDX, arrDY);
      if (m > 1.5) {
        const ux = arrDX / m, uy = arrDY / m, d0 = R + 6, d1 = R + 22, s = 5;
        ctx.strokeStyle = CSS[VERM]; ctx.globalAlpha = 0.9 * cA; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + ux * d0, y + uy * d0); ctx.lineTo(x + ux * d1, y + uy * d1);
        ctx.moveTo(x + ux * d1 - ux * s - uy * s, y + uy * d1 - uy * s + ux * s); ctx.lineTo(x + ux * d1, y + uy * d1);
        ctx.lineTo(x + ux * d1 - ux * s + uy * s, y + uy * d1 - uy * s - ux * s);
        ctx.stroke();
      }
    }
    // centro: ponto ciano; vermelho com brilho quando pinçando
    const mx = clamp01((p - 0.7) / 0.3);
    if (mx > 0) { sprite(VERM, x, y, 26, mx * cA); ctx.fillStyle = CSS[VERM]; ctx.globalAlpha = mx * cA; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill(); }
    if (mx < 1) { ctx.fillStyle = CSS[HOLO]; ctx.globalAlpha = (1 - mx) * cA; ctx.beginPath(); ctx.arc(x, y, 1.9, 0, TAU); ctx.fill(); }
  }

  /* ---------- Quadro (a cada detecção) ---------- */
  const limSalto2 = () => { const l = Math.hypot(W, H) * 0.3; return l * l; };
  function ocupar(s, m) {
    const pts = m && Array.isArray(m.pontos) && m.pontos.length >= 21 ? m.pontos : null;
    if (!pts) { slotAtivo[s] = false; return; }
    // reinicia pela trilha (q.maos[i].id): o lado que o MediaPipe dá pisca com a mão de lado ou em punho
    const a = alvo[s], id = m.id != null ? 'id' + m.id : 'lado' + String(m.lado || '');
    const reinicia = !slotAtivo[s] || id !== slotId[s];
    let salto = false;
    for (let i = 0; i < 21; i++) {
      const p = pts[i] || {}, x = (+p.x || 0) - ox, y = (+p.y || 0) - oy;
      if (!reinicia && i === 9) { const dx = x - a[18], dy = y - a[19]; if (dx * dx + dy * dy > limSalto2()) salto = true; }
      a[i * 2] = x; a[i * 2 + 1] = y;
    }
    if (reinicia || salto) { mostra[s].set(a); hQt[s] = 0; }
    slotAtivo[s] = true; slotId[s] = id;
    slotPincando[s] = !!m.pincando;
    slotPinca[s] = m.pincando ? 1 : clamp01(+m.pinca || 0);
    const esc = +m.escala;
    slotTam[s] = Number.isFinite(esc) && esc > 0 ? Math.min(1.4, Math.max(0.65, esc / 190)) : 1;
  }

  function quadro(q) {
    if (morto || !q) return;
    const t = agora();
    if (ultQ) { const dq = t - ultQ; if (dq > 0 && dq < 1000) emaQ = emaQ ? emaQ * 0.88 + dq * 0.12 : dq; }
    ultQ = t;
    qpsMotor = Number.isFinite(+q.qps) && +q.qps > 0 ? +q.qps : 0;
    const maos = Array.isArray(q.maos) ? q.maos : [];
    const pr = Number.isInteger(q.principal) && q.principal >= 0 && q.principal < maos.length ? q.principal : -1;
    const i0 = pr >= 0 ? pr : (maos.length ? 0 : -1), i1 = maos.length > 1 ? (i0 === 0 ? 1 : 0) : -1;
    ocupar(0, i0 >= 0 ? maos[i0] : null);
    ocupar(1, i1 >= 0 ? maos[i1] : null);
    if (pr >= 0) {
      const m = maos[pr], c = m.cursor;
      let x, y;
      if (c && Number.isFinite(+c.x)) { x = +c.x - ox; y = +c.y - oy; }
      else { x = (alvo[0][8] + alvo[0][16]) / 2; y = (alvo[0][9] + alvo[0][17]) / 2; }
      if (!cursorOn || cA < 0.05) { cX = x; cY = y; }
      cTx = x; cTy = y; cursorOn = true;
      if (surgirEm && t < surgirEm) surgir(); else surgirEm = 0;
      pincaAlvo = m.pincando ? 1 : clamp01(+m.pinca || 0); pincando = !!m.pincando;
      cursorFora = !!m.fora;   // a mão saiu da zona ativa: o cursor fica na borda, apagado (nada dispara)
    } else { cursorOn = false; pincando = false; cursorFora = false; }
    const tinha = temMao;
    temMao = maos.length > 0;
    if (temMao) { ultMao = t; if (!tinha) maoDesde = t; }
    if (!temMao) { arrastando = false; if (agarrando) { agarrando = false; imaOn = false; } }
    lerHover();
    sobrePainel = false;
    if (cursorOn) { try { const el = doc.elementFromPoint(cTx + ox, cTy + oy); sobrePainel = !!(el && el.closest && el.closest(SEL_PAINEL)); } catch { /* nada */ } }
    if (!rodando && temMao && !pausado) entrarRodando();   // reserva: se o 'pronto' não chegou, a mão na tela prova que ligou
    if (temMao && esperandoMao) maoEncontrada();
    if (temMao !== tinha) { camEl.classList.toggle('com-mao', temMao); statusAjuda(); }
    if (!camEl.hidden) { desenharEsqueleto(maos, pr); rotulo(maos, pr); }
    acordar();
  }

  function lerHover() {
    let el = null;
    if (cursorOn) { try { el = doc.querySelector('.mao-hover'); } catch { el = null; } }
    hoverAlgo = !!el;
    if (el !== hvEl) {
      const antes = hvEl;
      hvEl = el; hvCont = 0;
      if (el && (!antes || hvA < 0.05)) { hvD[0] = cX - 12; hvD[1] = cY - 12; hvD[2] = 24; hvD[3] = 24; }   // a mira nasce no cursor
    }
    if (!el) { hvOk = false; return; }
    if (hvCont++ % 3 === 0) {
      let r = null;
      try { r = el.getBoundingClientRect(); } catch { r = null; }
      hvOk = !!r && r.width > 0 && r.height > 0 && r.width <= 560 && r.height <= 240 && r.width * r.height <= 90000;
      if (hvOk) { hvR[0] = r.left - ox; hvR[1] = r.top - oy; hvR[2] = r.width; hvR[3] = r.height; }
    }
  }

  /* ---------- Cartão da câmera: esqueleto holográfico ---------- */
  function desenharEsqueleto(maos, pr) {
    const g = camCtx;
    if (!g) return;
    g.setTransform(camDpr, 0, 0, camDpr, 0, 0);
    g.clearRect(0, 0, camW, camH);
    if (!maos.length) return;
    const vw = video.videoWidth || 4, vh = video.videoHeight || 3;
    const sc = Math.max(camW / vw, camH / vh), offx = (camW - vw * sc) / 2, offy = (camH - vh * sc) / 2;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < maos.length && i < 2; i++) {
      const m = maos[i], pv = m && m.pontosVideo;
      if (!Array.isArray(pv) || pv.length < 21) continue;
      const cor = i === pr || (pr < 0 && i === 0) ? RGB[HOLO] : RGB[NOVO];
      const X = j => offx + (+pv[j].x || 0) * vw * sc, Y = j => offy + (+pv[j].y || 0) * vh * sc;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let j = 0; j < 21; j++) { const x = X(j), y = Y(j); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rgba(cor, 0.1);
      g.beginPath(); PALMA.forEach((j, k) => (k ? g.lineTo(X(j), Y(j)) : g.moveTo(X(j), Y(j)))); g.closePath(); g.fill();
      g.beginPath();
      for (const [a, b] of LIG) { g.moveTo(X(a), Y(a)); g.lineTo(X(b), Y(b)); }
      g.strokeStyle = rgba(cor, 0.3); g.lineWidth = 4.5; g.stroke();
      g.strokeStyle = rgba(cor, 0.95); g.lineWidth = 1.4; g.stroke();
      const pinc = !!m.pincando, pv01 = m.pincando ? 1 : clamp01(+m.pinca || 0);
      if (pv01 > 0.3) {
        g.strokeStyle = rgba(RGB[VERM], Math.min(1, (pv01 - 0.3) * 1.6)); g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(X(4), Y(4)); g.lineTo(X(8), Y(8)); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      for (let j = 0; j < 21; j++) {
        const x = X(j), y = Y(j), ponta = PONTAS.includes(j), red = pinc && (j === 4 || j === 8);
        const c = red ? RGB[VERM] : cor;
        if (ponta) {
          g.strokeStyle = rgba(c, 0.45); g.lineWidth = 1; g.beginPath(); g.arc(x, y, 5.6, 0, TAU); g.stroke();
          g.fillStyle = rgba(c, 1); g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
        } else {
          g.fillStyle = CSS_BG; g.strokeStyle = rgba(c, 1); g.lineWidth = 1.1;
          g.beginPath(); g.arc(x, y, 1.9, 0, TAU); g.fill(); g.stroke();
        }
      }
      // caixa com colchetes e o lado da mão
      const pad = 7, bx = Math.max(1, x0 - pad), by = Math.max(1, y0 - pad), bw = Math.min(camW - 1, x1 + pad) - bx, bh = Math.min(camH - 1, y1 + pad) - by;
      const L = Math.min(9, bw * 0.3, bh * 0.3);
      g.strokeStyle = rgba(cor, 0.85); g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(bx, by + L); g.lineTo(bx, by); g.lineTo(bx + L, by);
      g.moveTo(bx + bw - L, by); g.lineTo(bx + bw, by); g.lineTo(bx + bw, by + L);
      g.moveTo(bx + bw, by + bh - L); g.lineTo(bx + bw, by + bh); g.lineTo(bx + bw - L, by + bh);
      g.moveTo(bx + L, by + bh); g.lineTo(bx, by + bh); g.lineTo(bx, by + bh - L);
      g.stroke();
      const lado = m.lado === 'Esquerda' ? 'ESQ' : m.lado === 'Direita' ? 'DIR' : 'MÃO';
      g.font = '800 8px "JetBrains Mono", ui-monospace, monospace';
      const tw = g.measureText(lado).width + 8, ly = by > 13 ? by - 12 : by + 2;
      g.fillStyle = rgba(cor, 0.9); g.fillRect(bx, ly, tw, 11);
      g.fillStyle = CSS_BG; g.fillText(lado, bx + 4, ly + 8.2);
    }
  }

  function rotulo(maos, pr) {
    let txt = '—', tom = 'holo', mao = '';
    if (maos.length) {
      const m = maos[pr >= 0 ? pr : 0];
      const k = chaveGesto(m.gesto), proprio = typeof m.rotulo === 'string' && m.rotulo.trim() ? m.rotulo.trim().slice(0, 28) : '';
      if (agarrando || m.agarrando) { txt = 'Agarrando'; tom = 'rever'; }
      else if (arrastando || m.arrastando) { txt = 'Arrastando'; tom = 'vermelho'; }
      else if (m.pincando) { txt = proprio || 'Pinça'; tom = 'vermelho'; }
      else { txt = proprio || ROTULOS[k] || String(m.gesto || 'Mão'); tom = TOM[k] || 'holo'; }
      mao = m.lado === 'Esquerda' ? 'Mão esquerda' : m.lado === 'Direita' ? 'Mão direita' : 'Mão';
      if (maos.length > 1) mao = '2 mãos · ' + (m.lado === 'Esquerda' ? 'esquerda' : 'direita');
      if (pr < 0) mao += ' (não comanda)';
    }
    if (txt !== rotTxt) { rotTxt = txt; cam.gesto.textContent = txt; cam.gesto.hidden = txt === '—'; }
    if (tom !== rotTom) { rotTom = tom; cam.gesto.dataset.tom = tom; }
    if (mao !== rotMao) { rotMao = mao; cam.mao.textContent = mao; }
  }

  // HUD do cartão (qps, "mostre a mão"): 2,5 vezes por segundo, só com o cartão aberto
  let hud = 0;
  function tickHud() {
    if (camEl.hidden) return;
    const t = agora();
    const vivo = ultQ && t - ultQ < 1200 && (emaQ > 0 || qpsMotor > 0);
    const txt = vivo ? `${Math.round(qpsMotor > 0 ? qpsMotor : 1000 / emaQ)} qps` : '— qps';
    if (cam.qps.textContent !== txt) cam.qps.textContent = txt;
    const procura = !pausado && (!temMao || t - ultMao > 700);
    if (cam.procura.hidden === procura) cam.procura.hidden = !procura;
    if (!temMao && rotTxt !== '—') { rotTxt = '—'; cam.gesto.textContent = '—'; cam.gesto.hidden = true; rotMao = ''; cam.mao.textContent = ''; }
    if (ultQ && t - ultQ > 700 && (slotAtivo[0] || slotAtivo[1])) { slotAtivo[0] = slotAtivo[1] = false; cursorOn = false; acordar(); }
  }
  function ligarHud(on) {
    if (on && !hud) hud = setInterval(tickHud, 400);
    if (!on && hud) { clearInterval(hud); hud = 0; }
  }

  /* ---------- Vídeo e ajuda ---------- */
  function mostrarVideo(v) {
    videoVisivel = v !== false;
    camEl.classList.toggle('sem-video', !videoVisivel);
    cam.videoTxt.textContent = videoVisivel ? 'Esconder vídeo' : 'Mostrar vídeo';
    gravarPref('maos-video', videoVisivel ? 'visivel' : 'oculto');
  }
  mostrarVideo(videoVisivel);

  function ajuda(abrir, { foco = true } = {}) {
    abrir = abrir !== false;
    if (abrir === ajudaAberta) return;
    ajudaAberta = abrir;
    cam.btnAjuda.setAttribute('aria-pressed', String(abrir));
    if (abrir) {
      gravarPref('maos-ajuda', 'vista');
      ajudaDesde = agora();
      ajEl.hidden = false;
      statusAjuda();
      if (foco) { focoAntes = doc.activeElement; ajEl.querySelector('.ma-rodape .btn')?.focus({ preventScroll: true }); }
    } else {
      ajEl.hidden = true;
      if (focoAntes && focoAntes.isConnected && ajEl.contains(doc.activeElement)) focoAntes.focus({ preventScroll: true });
      else if (ajEl.contains(doc.activeElement)) doc.activeElement.blur();
      focoAntes = null;
    }
  }
  function statusAjuda() {
    if (!ajudaAberta) return;
    aj.status.hidden = !rodando;
    aj.status.dataset.tom = temMao ? 'ok' : 'holo';
    aj.statusTxt.textContent = temMao ? 'Mão encontrada. Pode usar os gestos.' : 'Mostre a mão aberta para a câmera';
  }

  /* ---------- Cartão de ligar ---------- */
  const BOTOES = {
    oferta: `<button type="button" class="btn principal" data-acao="ligar">${ICO.camera}Ligar câmera</button><button type="button" class="btn" data-acao="cancelar">Agora não</button>`,
    progresso: '<button type="button" class="btn" data-acao="cancelar">Cancelar</button>',
    erro: `<button type="button" class="btn principal" data-acao="ligar">${ICO.camera}Tentar de novo</button><button type="button" class="btn" data-acao="cancelar">Fechar</button>`,
    artifact: '<button type="button" class="btn principal" data-acao="cancelar">Entendi</button>',
    simulador: '<button type="button" class="btn principal" data-acao="ligar">Ligar simulador</button><button type="button" class="btn" data-acao="cancelar">Agora não</button>',
  };
  const TEXTO_LIGAR = 'Mexa a mão na frente da câmera para levar o cursor e junte o polegar com o indicador para abrir o que está embaixo. Para fechar, como o Esc, abra a mão e segure parada.';
  const TEXTO_SIMULADOR = 'Simulador (só no teste local): o mouse faz o papel da mão. Segure P para a pinça, A para a mão aberta, F para o punho, J para o joinha e V para a vitória; as setas deslizam.';
  function modoLigar(modo, refazer) {
    if (modo === modoLig && !ligEl.hidden && !refazer) return;
    const antes = ligEl.hidden;
    modoLig = modo;
    ligEl.hidden = false;
    ligEl.dataset.modo = modo;
    lig.acoes.innerHTML = modo === 'oferta' && simulando ? BOTOES.simulador : (BOTOES[modo] || BOTOES.oferta);
    lig.passos.hidden = modo !== 'progresso';
    lig.erro.hidden = !(modo === 'erro' || modo === 'artifact');
    lig.texto.hidden = modo !== 'oferta';
    if (modo === 'oferta' || modo === 'progresso') {
      lig.rot.textContent = modo === 'progresso' ? 'Modo Mãos · ligando' : simulando ? 'Modo Mãos · simulador' : 'Modo Mãos';
      lig.titulo.textContent = 'Controle o cérebro com as mãos';
      lig.texto.textContent = simulando ? TEXTO_SIMULADOR : TEXTO_LIGAR;
    }
    if (antes) {
      focoAntes = focoAntes || doc.activeElement;
      if (modo !== 'progresso') lig.acoes.querySelector('.btn')?.focus({ preventScroll: true });
    }
  }
  function fecharLigar() {
    clearTimeout(tFecharLig); tFecharLig = 0;
    esperandoMao = false;
    if (ligEl.hidden) return;
    const dentro = ligEl.contains(doc.activeElement);
    ligEl.hidden = true; modoLig = '';
    if (dentro) { if (focoAntes && focoAntes.isConnected && !ajudaAberta) focoAntes.focus({ preventScroll: true }); else doc.activeElement.blur(); }
    if (!ajudaAberta) focoAntes = null;
  }
  function marcarPasso(i, st, pct) {
    const li = lig.passos.querySelector(`[data-i="${i}"]`);
    if (!li) return;
    li.dataset.st = st;
    li.querySelector('.ml-txt').textContent = PASSOS[i][st === 'feito' ? 1 : 0];
    const barra = li.querySelector('.ml-barra');
    const temPct = st === 'ativo' && i === 1;
    barra.hidden = !temPct;
    if (temPct) {
      const ind = !Number.isFinite(pct);
      barra.classList.toggle('indef', ind);
      if (!ind) barra.firstChild.style.width = `${Math.round(clamp01(pct) * 100)}%`;
    }
  }
  function irParaPasso(i, pct) {
    for (let k = 0; k < PASSOS.length; k++) marcarPasso(k, k < i ? 'feito' : k === i ? 'ativo' : 'espera', k === i ? pct : undefined);
  }

  function codigoDe(d) {
    if (!d) return '';
    if (typeof d === 'string') return norma(d);
    return norma(d.codigo || d.code || d.name || '');
  }
  function erro(codigo, d) {
    const c = norma(codigo);
    rodando = false; esperandoMao = false;
    camEl.hidden = true; ligarHud(false);
    const art = c === 'artifact';
    // tentar de novo não adianta no claude.ai nem num navegador sem câmera: só "Entendi"
    modoLigar(art || c === 'sem-suporte' ? 'artifact' : 'erro');
    lig.rot.textContent = art ? 'Modo Mãos · claude.ai' : 'Modo Mãos · não ligou';
    // a frase que o app (ou o motor) manda vale quando vem: ela explica o caso ("a câmera foi desconectada")
    const dada = d && typeof d === 'object' && typeof d.mensagem === 'string' ? d.mensagem.trim().slice(0, 300) : '';
    // a câmera caiu no meio do uso (a frase é outra que a de "nenhuma câmera"): o título diz isso
    const caiu = c === 'sem-camera' && !!dada && dada !== FRASES['sem-camera'];
    lig.titulo.textContent = caiu ? 'A câmera desligou' : TITULO_ERRO[c] || 'Não deu para ligar os gestos';
    let frase = dada || FRASES[c];
    if (!frase) {
      const msg = d && typeof d === 'object' && d.message ? String(d.message) : (typeof d === 'string' && d !== codigo ? d : '');
      frase = 'Algo falhou ao ligar a câmera ou o reconhecimento de mãos. Tente de novo.' + (msg ? ` (${msg.slice(0, 140)})` : '');
    }
    lig.erroTxt.textContent = frase;
    lig.acoes.querySelector('.btn')?.focus({ preventScroll: true });
  }

  function entrarRodando() {
    if (rodando) return;
    rodando = true; pausado = false;
    camEl.hidden = false;
    camEl.classList.remove('desligando', 'pausado');
    cam.pausa.hidden = true;
    medirCam();
    ligarHud(true); tickHud();
    if (lerPref('maos-ajuda') !== 'vista') { fecharLigar(); ajuda(true, { foco: false }); }
    else if (!ligEl.hidden) {
      modoLigar('progresso'); irParaPasso(2);
      if (temMao) maoEncontrada();
      else { esperandoMao = true; clearTimeout(tFecharLig); tFecharLig = setTimeout(fecharLigar, 7000); }
    }
    statusAjuda();
  }
  function maoEncontrada() {
    esperandoMao = false;
    if (!ligEl.hidden && modoLig === 'progresso') {
      marcarPasso(0, 'feito'); marcarPasso(1, 'feito'); marcarPasso(2, 'feito');
      clearTimeout(tFecharLig); tFecharLig = setTimeout(fecharLigar, 700);
    }
  }
  function parar() {
    rodando = false; pausado = false; esperandoMao = false;
    camEl.hidden = true; ligarHud(false);
    camEl.classList.remove('desligando', 'pausado');
    fecharLigar(); ajuda(false);
    slotAtivo[0] = slotAtivo[1] = false; cursorOn = false; temMao = false; imaOn = false; agarrando = false; arrastando = false;
    hvEl = null; hoverAlgo = false; hvOk = false;
    camEl.classList.remove('com-mao');
    camCtx && camCtx.clearRect(0, 0, cam.esq.width, cam.esq.height);
    acordar();
  }

  function estado(e, d) {
    if (morto) return;
    const n = norma(e);
    if (FRASES[n] && n !== 'erro') return erro(n, d);
    switch (n) {
      case 'ligar': case 'oferta': case 'inicio': case 'pedir':
        if (!rodando) { simulando = !!(d && d.simular); modoLigar('oferta', true); } return;
      case 'carregando': case 'iniciando': case 'abrindo': case 'camera': case 'modelo': {
        const fase = norma((d && d.fase) || n);
        if (!rodando && fase !== 'simulador') { modoLigar('progresso'); irParaPasso(fase === 'modelo' ? 1 : 0); }
        return;
      }
      case 'pronto': case 'rastreando': case 'ativo': case 'ligado': case 'rodando': case 'procurando': case 'sem-mao': case 'retomado': case 'continuando':
        if (pausado) { pausado = false; cam.pausa.hidden = true; camEl.classList.remove('pausado'); }
        entrarRodando(); return;
      case 'pausado':
        pausado = true; cam.pausa.hidden = false; camEl.classList.add('pausado');
        slotAtivo[0] = slotAtivo[1] = false; cursorOn = false; acordar(); return;
      case 'parado': case 'desligado': case 'fim': case 'parou':
        parar(); return;
      case 'erro': case 'falhou':
        erro(codigoDe(d), d); return;
      default:
    }
  }

  function progresso(fase, pct) {
    if (morto || rodando) return;
    const n = norma(fase);
    let p = +pct;
    if (Number.isFinite(p) && p > 1) p /= 100;
    if (!Number.isFinite(p)) p = undefined;
    let i = 0;
    if (/mao|pronto|aguard|mostre/.test(n)) i = 2;
    else if (/wasm|modelo|reconhec|baix|carreg|gesture|vision/.test(n)) i = 1;
    else if (/simulador/.test(n)) return;
    modoLigar('progresso');
    if (i === 0 && p === 1) { irParaPasso(1); return; }   // câmera aberta: já marca e passa para o reconhecimento
    irParaPasso(i, p);
  }

  /* ---------- Gestos ---------- */
  function pontoDe(d) {
    if (d && Number.isFinite(+d.x) && Number.isFinite(+d.y)) return [+d.x - ox, +d.y - oy];
    if (cA > 0.05) return [cX, cY];
    return palma();
  }
  function palma() {
    if (slotAtivo[0]) { const m = mostra[0]; return [(m[0] + m[10] + m[18] + m[26] + m[34]) / 5, (m[1] + m[11] + m[19] + m[27] + m[35]) / 5]; }
    if (cA > 0.05) return [cX, cY];
    return [W / 2, H / 2];
  }

  function gesto(nome, d) {
    if (morto) return false;
    const n = norma(nome).replace(/[\s_-]+/g, '');
    const r = reduz();
    let consumido = false;
    switch (n) {
      case 'clique': {
        const [x, y] = pontoDe(d);
        hvFlash = 1;
        if (!r) {
          onda(O_ANEL, x, y, 0.42, 6, 46, HOLO, 3);
          onda(O_ANEL, x, y, 0.62, 4, 78, BRANCO, 1.4, 0.06);
          onda(O_FLASH, x, y, 0.26, 18, 80, HOLO, 0.9);
          const k = qt(20);
          for (let j = 0; j < k; j++) {
            const a = (j / k) * TAU + rnd() * 0.3, sp = 260 + rnd() * 560, c = Math.cos(a), s = Math.sin(a);
            emitir(P_TRACO, j % 4 === 0 ? VERM : j % 2 ? HOLO : BRANCO, x + c * 6, y + s * 6, c * sp, s * sp, 0.26 + rnd() * 0.24, 7, 7, 0);
          }
          for (let j = 0; j < qt(10); j++) emitir(P_BRILHO, HOLO, x, y, (rnd() - 0.5) * 240, (rnd() - 0.5) * 240, 0.4 + rnd() * 0.3, 10, 4, 0);
        }
        break;
      }
      case 'arrasteinicio': {
        arrastando = true; arrDX = arrDY = 0;
        const [x, y] = pontoDe(d);
        if (!r) onda(O_ANEL, x, y, 0.32, 30, 12, VERM, 2);
        break;
      }
      case 'arraste': {
        arrastando = true;
        if (d) { const dx = +d.dx || 0, dy = +d.dy || 0; arrDX = arrDX * 0.6 + dx * 0.4; arrDY = arrDY * 0.6 + dy * 0.4; }
        break;
      }
      case 'arrastefim': {
        arrastando = false;
        const [x, y] = pontoDe(d);
        if (!r) onda(O_ANEL, x, y, 0.36, 10, 34, VERM, 1.5);
        break;
      }
      case 'espera': {
        espAlvo = clamp01(+((d && d.progresso) || 0)); ultEsp = agora();
        if (espAlvo > 0) espCor = d && d.tipo === 'fechar' ? HOLO : BRANCO;
        break;
      }
      case 'cliquecancelado': {
        // pinça segurada demais sem arrastar: um anel pequeno que se fecha e apaga (não abriu nada)
        const [x, y] = pontoDe(d);
        if (!r) onda(O_ANEL, x, y, 0.38, 26, 6, NOVO, 1.4);
        break;
      }
      case 'fechar': {
        // a ajuda pede "mostre a mão aberta": a mesma mão aberta parada não pode fechá-la logo em seguida. Nessa
        // carência o gesto é consumido sem efeito: só um anel pequeno (devolve 'ignorado'; o robô não pisca)
        if (ajudaAberta && agora() - Math.max(ajudaDesde, maoDesde) <= CARENCIA_AJUDA) {
          const [x, y] = d && Number.isFinite(+d.x) ? pontoDe(d) : palma();
          if (!r) onda(O_ANEL, x, y, 0.4, 10, 30, HOLO, 1.2);
          acordar();
          return 'ignorado';
        }
        if (ajudaAberta) { consumido = true; ajuda(false); }
        else if (!ligEl.hidden && modoLig !== 'progresso') { cancelar(); consumido = true; }
        const [x, y] = d && Number.isFinite(+d.x) ? pontoDe(d) : palma();
        if (!r) {
          const R = Math.hypot(W, H) * 0.5;
          onda(O_CHOQUE, x, y, 0.8, 10, R, HOLO, 14, 0, rnd() * TAU);
          onda(O_CHOQUE, x, y, 0.95, 6, R * 0.72, NOVO, 6, 0.08, rnd() * TAU);
          onda(O_FLASH, x, y, 0.34, 60, 300, HOLO, 0.55);
          const k = qt(72);
          for (let j = 0; j < k; j++) {
            const a = rnd() * TAU, sp = 520 + rnd() * 900, c = Math.cos(a), s = Math.sin(a);
            emitir(P_TRACO, j % 3 ? HOLO : BRANCO, x + c * 22, y + s * 22, c * sp, s * sp, 0.42 + rnd() * 0.36, 9, 3, 0);
          }
        }
        break;
      }
      case 'deslizar': {
        const dir = norma(d && d.direcao);
        const ang = dir === 'esquerda' ? Math.PI : dir === 'cima' ? -Math.PI / 2 : dir === 'baixo' ? Math.PI / 2 : 0;
        const [x, y] = palma();
        if (!r) {
          const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
          onda(O_SETAS, x, y, 0.62, 0, 0, HOLO, 1, 0, ang);
          const k = qt(60);
          for (let j = 0; j < k; j++) {
            const off = (rnd() - 0.5) * 2 * 170, atras = -rnd() * 200, sp = 1300 + rnd() * 1600;
            emitir(P_TRACO, j % 4 === 0 ? BRANCO : j % 2 ? HOLO : NOVO, x + ux * atras + nx * off, y + uy * atras + ny * off,
              ux * sp, uy * sp, 0.28 + rnd() * 0.3, 7 + rnd() * 5, 4, 0);
          }
        }
        break;
      }
      case 'agarrarinicio': {
        agarrando = true; imaOn = true; imaT = 0; imaAcum = 0;
        const [x, y] = d && Number.isFinite(+d.x) ? pontoDe(d) : palma();
        imaX = x; imaY = y;
        if (!r) onda(O_ANEL, x, y, 0.45, 120, 24, HOLO, 2.2);
        break;
      }
      case 'agarrar': {
        if (!agarrando) { agarrando = true; imaOn = true; }
        if (!slotAtivo[0] && d && Number.isFinite(+d.x)) { imaX = +d.x - ox; imaY = +d.y - oy; }
        break;
      }
      case 'agarrarfim': {
        const x = imaX, y = imaY;
        agarrando = false; imaOn = false;
        if (!r) { onda(O_ANEL, x, y, 0.5, 20, 90, HOLO, 2); onda(O_FLASH, x, y, 0.3, 30, 120, HOLO, 0.5); }
        break;
      }
      case 'joinha': {
        const p = slotAtivo[0] ? [mostra[0][8], mostra[0][9]] : palma();
        const [x, y] = p;
        if (!r) {
          onda(O_ANEL, x, y, 0.7, 12, 96, BRANCO, 2.4);
          onda(O_FLASH, x, y, 0.42, 40, 200, HOLO, 0.5);
          const k = qt(150);
          for (let j = 0; j < k; j++) {
            const a = -Math.PI / 2 + (rnd() - 0.5) * 2.3, sp = 520 + rnd() * 950;
            const i = emitir(P_CONFETE, j % 3, x + (rnd() - 0.5) * 20, y + (rnd() - 0.5) * 20, Math.cos(a) * sp, Math.sin(a) * sp,
              1.7 + rnd() * 1.1, 5 + rnd() * 4, 1.7, 1500);
            if (i >= 0) { pRot[i] = rnd() * TAU; pVrot[i] = (rnd() - 0.5) * 16; pFase[i] = rnd() * TAU; pVf[i] = 7 + rnd() * 9; pAsp[i] = rnd() < 0.22 ? 3.2 : 1.5; }
          }
          for (let j = 0; j < qt(18); j++) {
            const a = rnd() * TAU, sp = 120 + rnd() * 380;
            emitir(P_BRILHO, j % 2 ? BRANCO : HOLO, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 120, 0.5 + rnd() * 0.5, 10 + rnd() * 8, 2.5, 300);
          }
        }
        break;
      }
      case 'vitoria': {
        const m = mostra[0];
        const [x, y] = slotAtivo[0] ? [(m[16] + m[24]) / 2, (m[17] + m[25]) / 2 + 20] : palma();
        if (!r) {
          onda(O_ARCOS, x, y, 1.3, 66, 92, HOLO, 3, 0, rnd() * TAU);
          onda(O_FLASH, x, y, 0.36, 30, 150, HOLO, 0.5);
          if (slotAtivo[0]) {
            for (const pi of [8, 12]) {
              for (let j = 0; j < qt(12); j++) {
                const a = -Math.PI / 2 + (rnd() - 0.5) * 2, sp = 140 + rnd() * 320;
                emitir(P_BRILHO, j % 2 ? VERM : HOLO, m[pi * 2], m[pi * 2 + 1], Math.cos(a) * sp, Math.sin(a) * sp, 0.4 + rnd() * 0.35, 10, 3.5, 0);
              }
            }
          }
        }
        break;
      }
      case 'entrou': {
        // o "entrou" pode chegar antes do primeiro quadro da mão: o anel nasce quando o cursor existir
        if (!r) { surgirEm = agora() + 600; if (cursorOn) surgir(); }
        break;
      }
      case 'saiu': {
        const x = cX, y = cY;
        arrastando = false; if (agarrando) { agarrando = false; imaOn = false; }
        if (!r && cA > 0.05) {
          onda(O_ANEL, x, y, 0.42, 18, 44, HOLO, 1.2);
          for (let j = 0; j < qt(14); j++) {
            const a = rnd() * TAU, sp = 30 + rnd() * 70;
            emitir(P_BRILHO, HOLO, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 20, 0.5 + rnd() * 0.4, 9, 1.5, 0);
          }
        }
        break;
      }
      default:
    }
    acordar();
    return consumido;
  }

  function surgir() {
    surgirEm = 0;
    const x = cTx, y = cTy;
    onda(O_SURGE, x, y, 0.5, 84, 22, HOLO, 1.5);
    const k = qt(24);
    for (let j = 0; j < k; j++) {
      const a = (j / k) * TAU, R = 74, c = Math.cos(a), s = Math.sin(a), v = 0.34;
      emitir(P_BRILHO, j % 3 ? HOLO : BRANCO, x + c * R, y + s * R, -c * R / v, -s * R / v, v, 9, 0, 0);
    }
  }

  /* ---------- Botões, teclado, aba ---------- */
  function cancelar() {
    fecharLigar();
    chamar(opts.onCancelar); avisar('maos:cancelar');
  }
  function onClique(e) {
    const b = e.target && e.target.closest ? e.target.closest('[data-acao]') : null;
    if (!b || !(ligEl.contains(b) || camEl.contains(b) || ajEl.contains(b))) return;
    const a = b.dataset.acao;
    if (a === 'ligar') {
      modoLigar('progresso'); irParaPasso(0);
      lig.cartao.querySelector('.ml-x')?.focus({ preventScroll: true });
      chamar(opts.onLigar); avisar('maos:ligar');
    } else if (a === 'cancelar') cancelar();
    else if (a === 'video') { mostrarVideo(!videoVisivel); chamar(opts.onVideo, videoVisivel); avisar('maos:video', { visivel: videoVisivel }); }
    else if (a === 'ajuda') { ajuda(!ajudaAberta); chamar(opts.onAjuda, ajudaAberta); avisar('maos:ajuda', { aberta: ajudaAberta }); }
    else if (a === 'fechar-ajuda') { ajuda(false); chamar(opts.onAjuda, false); avisar('maos:ajuda', { aberta: false }); }
    else if (a === 'desligar') { camEl.classList.add('desligando'); chamar(opts.onDesligar); avisar('maos:desligar'); }
  }
  ligEl.addEventListener('click', onClique);
  camEl.addEventListener('click', onClique);
  ajEl.addEventListener('click', onClique);
  // Esc fecha a ajuda e o cartão de ligar antes de qualquer coisa do app (captura na janela)
  function onTecla(e) {
    if (e.key !== 'Escape') return;
    if (ajudaAberta) { e.preventDefault(); e.stopPropagation(); ajuda(false); chamar(opts.onAjuda, false); avisar('maos:ajuda', { aberta: false }); return; }
    if (!ligEl.hidden) { e.preventDefault(); e.stopPropagation(); cancelar(); }
  }
  addEventListener('keydown', onTecla, true);
  function onVis() {
    if (doc.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; ultT = 0; }
    else acordar();
  }
  doc.addEventListener('visibilitychange', onVis);

  if (opts.mostrarLigar !== false) modoLigar('oferta');
  // só para a página de teste: relógio manual e leitura do estado interno
  if (typeof opts.depurar === 'function') {
    opts.depurar({
      manual(on) { manual = !!on; ultT = 0; if (manual && raf) { cancelAnimationFrame(raf); raf = 0; } if (!manual) { ultT = 0; acordar(); } },
      passo(t) { tManual = t; passo(t); },
      hud: () => tickHud(),
      estado: () => ({ nP, nO, fator, emaDt, cA, cX, cY, hvA, hvOk }),
    });
  }

  function destruir() {
    if (morto) return;
    morto = true;
    if (raf) cancelAnimationFrame(raf); raf = 0;
    ligarHud(false); clearTimeout(tFecharLig);
    removeEventListener('resize', onResize);
    removeEventListener('keydown', onTecla, true);
    doc.removeEventListener('visibilitychange', onVis);
    try { ro && ro.disconnect(); } catch { /* nada */ }
    ligEl.removeEventListener('click', onClique); camEl.removeEventListener('click', onClique); ajEl.removeEventListener('click', onClique);
    const devolver = [ligEl, camEl, ajEl].some(e => e.contains(doc.activeElement));
    if (devolver && focoAntes && focoAntes.isConnected) focoAntes.focus({ preventScroll: true });
    // o vídeo mora dentro do cartão: sai junto com ele (as tracks da câmera são paradas pelo maos.js)
    try { video.pause(); } catch { /* nada */ }
    for (const e of criados) e.remove();
    for (const e of usados) {
      if (e === fxCanvas) { ctx && ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height); continue; }
      e.innerHTML = ''; e.hidden = true;
    }
    nP = 0; nO = 0;
  }

  return {
    quadro, gesto, estado, progresso, mostrarVideo, ajuda: (v) => ajuda(v), destruir,
    get video() { return video; },
    ajudaAberta: () => ajudaAberta,
    ligarAberto: () => !ligEl.hidden,
  };
}
