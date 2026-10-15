/* Cérebro da Lube — orquestrador (js/app.js)
   Liga a camada de dados, o robô 3D, a interface holográfica, o mapa em anéis e o "Pergunte ao cérebro".
   Regra de ouro: nada quebra se uma peça faltar. Robô ausente → anéis. Sem `sample` → barra escondida.
   Contrato: CONTRATO.md §5 (seção js/app.js). */

import * as D from './dados.js';
import * as H from './holo.js';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);
// "Reduzir movimento" lido ao vivo: se a pessoa liga com a página aberta, robô, anéis e app param de voar.
const mmReduz = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)'); } catch { return null; } })();
const reduzido = () => !!(mmReduz && mmReduz.matches);
// O CSS abre o leitor como painel lateral a partir de 760 px (abaixo disso é folha de baixo). O robô
// precisa ir para a esquerda no mesmo corte, senão o painel cobre a cabeça entre 760 e 899 px (iPad em
// pé). O §5 do contrato fala em ≥ 900; o corte foi igualado ao do CSS de propósito (o enquadramento já
// encolhe o robô e esconde o trilho quando o espaço aperta).
const LARGURA_DESKTOP = 760;   // a partir daqui o robô vai para a esquerda com o leitor aberto
const LARGURA_CELULAR = 760;   // abaixo disso o leque vira grade embaixo
const DESLOCAMENTO = -0.18;
const MAX_LEQUE = { desktop: 16, celular: 8 };
const PREF = 'cerebro-robo:';
const TEMPO = Symbol('tempo');
const ROTULO = D.KIND_LABEL || { core: 'Mapa central', skill: 'Skill', memory: 'Memória', routine: 'Rotina', app: 'Aplicação', dept: 'Departamento' };

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
const S = {
  G: null, dados: null, demo: false,
  aoVivo: false, estadoVivo: 'ao vivo',
  robo: null, aneis: null, roboFalhou: false, cliqueVazioLigado: false,
  visao: 'robo', visaoEscolhida: false, aneisCentralizado: false,
  leitorNo: null, transitando: false, intencao: null, focoAntes: null,
  ultimoRect: null, ultimoTam: '',
  depto: null, lequePos: new Map(), lequeSuspenso: null, lequeAssin: '',
  buscaIds: null, ultimaVarredura: 0,
  frescosAneis: null, frescosAte: 0,
  sample: null, semFerramentas: false, perguntando: false, ctl: null, turns: [],
  achadas: new Set(), usadas: new Map(),
  ponteiro: null, teclado: false,
  ref: { left: 0, top: 0, width: 0, height: 0 },
  ultimoToqueRobo: 0, bootSeq: 0, avisouQualidade: false,
  ocultos: new Set(), dormindo: false, voltarRobo: false,
  // aba Rotinas + funil: rotina aberta no funil, rotina para onde o "← Voltar ao fluxo" do leitor leva,
  // as rotinas do vault (D.rotinas) e as notas da etapa em foco (acesas no cérebro)
  fluxoNo: null, voltarFluxo: null, rotinas: [], etapaIds: null,
  // painel Saúde (GUARDIAO.md §7): aberto no lugar do leitor; notas das rotinas com problema (acesas com ele aberto)
  saudeAberta: false, saudeIds: null
};
let ui; // definido em iniciar(); até lá é NADA

// ---------------------------------------------------------------------------
// Blindagem: um erro numa peça vira aviso no console, não quebra o resto
// ---------------------------------------------------------------------------
const falhas = new Set();
function avisarFalha(onde, err) {
  if (falhas.has(onde)) return;
  falhas.add(onde);
  try { console.warn(`[Cérebro] ${onde} falhou; seguindo sem essa parte.`, err); } catch { /* nada */ }
}
// Objeto "vazio" que aceita qualquer chamada e qualquer propriedade (peça ausente).
const NADA = new Proxy(function () {}, {
  get: (_alvo, prop) => (prop === 'then' || typeof prop === 'symbol' ? undefined : NADA),
  apply: () => undefined
});
ui = NADA;

function blindar(obj, nome) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return NADA;
  const cache = new Map();
  return new Proxy(obj, {
    get(alvo, prop) {
      if (typeof prop === 'symbol' || prop === 'then') return Reflect.get(alvo, prop);
      let v;
      try { v = alvo[prop]; } catch (err) { avisarFalha(`${nome}.${prop}`, err); return NADA; }
      if (typeof v === 'function') {
        if (!cache.has(prop)) {
          cache.set(prop, (...args) => {
            try {
              const r = alvo[prop](...args);
              if (r && typeof r.then === 'function') {
                return Promise.resolve(r).catch((err) => { avisarFalha(`${nome}.${prop}`, err); return undefined; });
              }
              return r;
            } catch (err) { avisarFalha(`${nome}.${prop}`, err); return undefined; }
          });
        }
        return cache.get(prop);
      }
      if (v === undefined || v === null) return NADA;
      if (typeof v === 'object' && !(typeof Node !== 'undefined' && v instanceof Node)) {
        if (!cache.has(prop)) cache.set(prop, blindar(v, `${nome}.${prop}`));
        return cache.get(prop);
      }
      return v;
    }
  });
}
function seguro(fn, padrao) {
  try { const v = fn(); return v === undefined || v === null ? padrao : v; }
  catch (err) { avisarFalha('dados', err); return padrao; }
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function comPrazo(p, ms) {
  return new Promise((resolve) => {
    let feito = false;
    const t = setTimeout(() => { feito = true; resolve(undefined); }, ms);
    Promise.resolve(p).then(
      (v) => { if (!feito) { feito = true; clearTimeout(t); resolve(v); } },
      () => { if (!feito) { feito = true; clearTimeout(t); resolve(undefined); } }
    );
  });
}
const limitar = (v, a, b) => (a > b ? (a + b) / 2 : Math.min(b, Math.max(a, v)));
const ponto = (p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null);
const inflar = (r, m) => ({ left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m });
const cruza = (a, b, m = 0) => a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;
const desktop = () => S.ref.width >= LARGURA_DESKTOP;
const tamTela = () => `${Math.round(S.ref.width)}x${Math.round(S.ref.height)}`;
const classeTela = () => (S.ref.width < LARGURA_CELULAR ? 'celular' : 'desktop');
const chaveNo = (n) => n.path || `${n.kind}:${n.name}`;

function atualizarRef() {
  const el = $('#app') || document.documentElement;
  const r = el.getBoundingClientRect();
  S.ref = { left: r.left, top: r.top, width: r.width || innerWidth, height: r.height || innerHeight };
}
function centroTela() {
  return { x: S.ref.width / 2, y: S.ref.height * (S.visao === 'robo' ? 0.42 : 0.5) };
}
function ehLocal() {
  try {
    return /^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/i.test(location.hostname);
  } catch { return false; }
}
function digitando() {
  const a = document.activeElement;
  if (!a) return false;
  if (a.isContentEditable) return true;
  if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
  if (a.tagName === 'INPUT') return !/^(checkbox|radio|button|submit|reset|range|color|file)$/i.test(a.type || '');
  return false;
}
function lerPref(k, padrao) { try { const v = localStorage.getItem(PREF + k); return v === null ? padrao : v; } catch { return padrao; } }
function gravarPref(k, v) { try { localStorage.setItem(PREF + k, v); } catch { /* sem armazenamento */ } }

// Nó equivalente no grafo atual (os objetos mudam a cada leitura do vault).
function mapear(no, G) {
  if (!no || !G) return null;
  if (no.kind === 'core') return G.core || null;
  if (no.kind === 'dept') return G.depts.find((d) => d.name === no.name)?.hub || null;
  return G.nodes.find((n) => n.kind === no.kind && n.path && n.path === no.path)
    || G.nodes.find((n) => n.kind === no.kind && n.name === no.name) || null;
}
function atual(no) {
  if (!no || !S.G) return null;
  if (S.G.nodes[no.id] === no) return no;
  return mapear(no, S.G);
}
const vizinhanca = (no) => new Set([no.id, ...(no.links || []), ...(no.back || [])]);
const baseRepouso = () => (S.perguntando ? 'pensando' : S.leitorNo || S.fluxoNo || S.saudeAberta ? 'lendo' : 'neutro');
function roboVisivel() { return !!S.robo && S.visao === 'robo' && !document.hidden; }
function estaAberto() {
  const v = ui.leitorAberto();
  if (typeof v === 'boolean') return v;
  const el = $('#leitor');
  return !!el && !el.hidden;
}
// O funil da rotina ocupa o mesmo lugar do leitor (um ou outro, nunca os dois).
function fluxoAberto() {
  const v = ui.fluxoAberto();
  if (typeof v === 'boolean') return v;
  const el = $('#fluxo');
  return !!el && !el.hidden;
}
// O painel Saúde também ocupa o lugar do leitor (um painel por vez).
function saudeAbertaUI() {
  const v = ui.saudeAberta();
  if (typeof v === 'boolean') return v;
  const el = $('#saude');
  return !!el && !el.hidden;
}
const painelAberto = () => estaAberto() || fluxoAberto() || saudeAbertaUI();
const dentroPainel = (a) => !!(a && a.closest && a.closest('#leitor, #fluxo, #saude'));
function rotinaDe(no) {
  if (!no) return null;
  return S.rotinas.find((r) => r.no === no) || S.rotinas.find((r) => r.no.path && r.no.path === no.path) || null;
}
// Notas acesas com o funil aberto: a rotina, as conexões dela e as notas citadas nas etapas.
function idsDoFluxo(no) {
  const ids = vizinhanca(no);
  const r = rotinaDe(no);
  if (r && r.fluxo && S.G) for (const p of r.fluxo.passos) for (const a of p.alvos || []) { const n = seguro(() => D.seguirLink(S.G, a), null); if (n) ids.add(n.id); }
  return ids;
}

// ---------------------------------------------------------------------------
// Transições do leitor (uma de cada vez; o pedido mais novo vence)
// ---------------------------------------------------------------------------
let pedido = 0;
let fila = Promise.resolve();
function transicao(fn, substitui = true) {
  const meu = substitui ? ++pedido : pedido;
  const anterior = fila;
  const p = (async () => {
    try { await anterior; } catch { /* nada */ }
    if (substitui && meu !== pedido) return false;
    try { await fn(() => meu !== pedido); } catch (err) { avisarFalha('transição do leitor', err); }
    return true;
  })();
  fila = p;
  return p;
}

// Retângulo do leitor em coordenadas de #app (as mesmas do robô). O holo.js já devolve nesse
// referencial (e mede mesmo com o leitor escondido); a reserva converte da janela.
function rectLeitor() {
  const norm = (r) => (r && r.width >= 20 && r.height >= 20
    ? { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height, width: r.width, height: r.height }
    : null);
  const deUI = norm(ui.retanguloLeitor());
  if (deUI) return deUI;
  const el = $('#leitor');
  if (!el || el.hidden) return null;
  const r = el.getBoundingClientRect();
  return norm({ left: r.left - S.ref.left, top: r.top - S.ref.top, width: r.width, height: r.height });
}
const centroDe = (r) => (r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null);
function centroLeitor() { return centroDe(rectLeitor()); }
// Onde o leitor vai abrir, antes de ele existir na tela.
function estimarCentro() {
  const medido = centroDe(rectLeitor());
  if (medido) return medido;
  if (S.ultimoRect && S.ultimoTam === tamTela()) return centroDe(S.ultimoRect);
  const W = S.ref.width, H = S.ref.height;
  if (W >= LARGURA_CELULAR) { const w = Math.min(600, W * 0.46); return { x: W - 24 - w / 2, y: H * 0.52 }; }
  return { x: W / 2, y: H * 0.575 };
}
// Ponto da borda do leitor onde o feixe encosta.
function pontoBorda(t, r) {
  if (!t || !r) return null;
  if (r.left >= t.x + 24) return { x: r.left, y: limitar(t.y, r.top + 56, r.bottom - 56) };
  if (r.top >= t.y + 24) return { x: limitar(t.x, r.left + 40, r.right - 40), y: r.top };
  return null;
}

// Leitor aberto no desktop: o robô vai para o espaço livre à esquerda do painel e encolhe para caber.
// Se entre o trilho e o painel não cabe nem um robô pequeno, o trilho some enquanto o leitor está aberto
// (classe .sem-trilho) e o robô usa a faixa toda.
function enquadrarComLeitor() {
  const R = S.robo, app = $('#app');
  S.aneis?.deslocar(desktop() ? -0.2 : 0);          // mapa em anéis: a nota escolhida fica fora de trás do painel
  if (!R) return;
  if (!desktop()) { app?.classList.remove('sem-trilho'); R.deslocar(0); return; }
  const lr = rectLeitor();
  if (!lr) { R.deslocar(DESLOCAMENTO); return; }
  const k = R.cabeca(true);
  const r1 = k && k.r1 > 20 ? k.r1 : Math.min(S.ref.width, S.ref.height) * 0.25;
  const precisa = 2 * r1 * 1.06;                    // cabeça com as orelhas e uma folga
  const direita = lr.left - 20;
  const tr = $('#trilho');
  const tRect = tr && !tr.hidden ? tr.getBoundingClientRect() : null;
  let esquerda = (tRect && tRect.width ? tRect.right - S.ref.left : 0) + 12;
  const semTrilho = direita - esquerda < precisa * 0.62;
  if (semTrilho) esquerda = 16;
  app?.classList.toggle('sem-trilho', semTrilho);
  const esc = limitar((direita - esquerda) / precisa, 0.5, 0.86);
  const cx = (esquerda + direita) / 2;
  R.deslocar(limitar((cx - S.ref.width / 2) / S.ref.width, -0.45, 0), esc);
}
function centralizarRobo() {
  $('#app')?.classList.remove('sem-trilho');
  S.robo?.deslocar(0);
  S.aneis?.deslocar(0);
}

function guardarFoco() {
  const a = document.activeElement;
  S.focoAntes = a && a !== document.body && !dentroPainel(a) ? a : null;
}
function focarLeitor(sel = '#leitor', fechar = '#lFechar') {
  const l = $(sel);
  if (!l || !S.teclado || l.contains(document.activeElement)) return;
  const alvo = $(fechar) || l;
  try { alvo.focus({ preventScroll: true }); } catch { /* nada */ }
}
function restaurarFoco() {
  const a = document.activeElement, f = S.focoAntes;
  S.focoAntes = null;
  const perdido = !a || a === document.body || dentroPainel(a);
  if (!perdido || !f || !f.isConnected || f.closest('[hidden]')) return;
  try { f.focus({ preventScroll: true }); } catch { /* nada */ }
}

// Origem de um clique vindo de um cartão do leque.
function origemDoCartao(no) {
  if (!no || !S.depto) return {};
  const p = S.lequePos.get(chaveNo(no));
  return p ? { origem: p, cartao: true } : {};
}

// Abrir nota: o robô puxa o neurônio da mente e o painel se abre onde a esfera chega.
// Rotina abre no funil (lista, conta do halo, nó dos anéis, busca, resposta). No leitor ela abre quando o pedido
// vem de dentro dele (link, conexão), de um link de etapa do funil ou do "Ver nota completa" (opc.leitor).
function abrir(no, opc = {}) {
  no = atual(no);
  if (!no || !S.G) return Promise.resolve(false);
  if (no.kind === 'dept') { alternarDepto(S.G.depts[no.ci]); return Promise.resolve(false); }
  if (no.kind === 'routine' && !opc.leitor && !opc.troca && !opc.noLeitor) return abrirRotina(no, opc);
  ui.dica(null);
  S.intencao = 'abrir';
  return transicao(async (cancelado) => {
    S.transitando = true;
    try { await executarAbrir(no, opc, cancelado); } finally { S.transitando = false; }
  });
}

async function executarAbrir(no, opc, cancelado) {
  const G = S.G;
  no = atual(no) || no;
  const R = S.robo, rv = roboVisivel(), voar = rv && !reduzido();
  const leitorJa = !!S.leitorNo && estaAberto();
  const fluxoJa = !!S.fluxoNo && fluxoAberto();
  const saudeJa = S.saudeAberta && saudeAbertaUI();   // painel Saúde aberto: o leitor entra no lugar dele
  const jaAberto = leitorJa || fluxoJa || saudeJa;
  if (leitorJa && S.leitorNo === no) { R?.expressao('feliz', 700); return; }
  if (!jaAberto) { guardarFoco(); suspenderLeque(); }
  S.saudeAberta = false;
  const anterior = S.leitorNo || S.fluxoNo;
  // Do funil para o leitor: o "← Voltar ao fluxo" leva de volta àquela rotina (e continua lá navegando no leitor).
  if (fluxoJa) S.voltarFluxo = S.fluxoNo;
  else if (!leitorJa) S.voltarFluxo = null;
  if (S.fluxoNo) { S.fluxoNo = null; S.etapaIds = null; ui.rotinas(S.rotinas, null); }
  S.leitorNo = no;
  S.aneis?.selecionar(no);
  aplicarDestaque();
  R?.expressao('procurando', 1100);
  enquadrarComLeitor();

  if (jaAberto) {
    // Troca: o neurônio anterior é solto (apaga devagar, sem voo), o robô puxa a próxima nota pelo feixe
    // e o glitch do painel acontece quando a esfera encosta nele (com o funil aberto, o leitor entra no lugar dele).
    if (anterior && anterior !== no) R?.devolver(anterior.id, null);
    const alvo = pontoBorda(rv ? ponto(R.testa()) : null, rectLeitor()) || centroLeitor() || estimarCentro();
    if (voar) {
      const voo = comPrazo(R.puxar(no.id, alvo), 1800);
      await Promise.race([voo, esperar(260 + 760 * 0.8)]);   // 260 ms de "procurando" + 80% do voo
      if (cancelado() && S.intencao === 'fechar') return;    // pediram para fechar no meio do voo: não troca à toa
    } else R?.puxar(no.id, null);   // sem voo: só marca o neurônio (acende forte, sinapses realçadas)
    await comPrazo(ui.abrirLeitor(no, G, { origem: alvo, troca: true, voltarFluxo: S.voltarFluxo }), 3000);
  } else {
    const alvo = estimarCentro();
    let origem = ponto(opc.origem) || (S.teclado ? alvo : ponto(S.ponteiro) || alvo);
    if (voar && !opc.cartao) {
      await comPrazo(R.puxar(no.id, alvo), 2400);
      origem = alvo;
      if (cancelado() && S.intencao === 'fechar') {
        // Desistiu no meio do voo: a esfera volta para a cúpula; o fechar() da fila arruma o resto.
        await comPrazo(R.devolver(no.id, alvo), 1800);
        S.leitorNo = null;
        S.aneis?.selecionar(null);
        return;
      }
    } else R?.puxar(no.id, null);   // do cartão do leque ou sem voo: o neurônio acende forte mesmo assim
    R?.base('lendo');
    await comPrazo(ui.abrirLeitor(no, G, { origem, troca: false, voltarFluxo: null }), 3500);
  }
  if (S.leitorNo !== no) return;
  const r = rectLeitor();
  if (r) { S.ultimoRect = r; S.ultimoTam = tamTela(); }
  if (R) { R.base(baseRepouso()); const c = centroDe(r); if (c) R.olharPara(c); }
  if (!document.hidden) iniciarFeixe();
  focarLeitor();
}

// Abrir rotina: a conta dela no halo acende, o robô olha para ela, a conta sai do halo como esfera e voa até
// onde o funil abre; feixe da testa até o painel e "lendo", como no leitor.
function abrirRotina(no, opc = {}) {
  no = atual(no);
  if (!no || !S.G || no.kind !== 'routine') return Promise.resolve(false);
  ui.dica(null);
  S.intencao = 'abrir';
  return transicao(async (cancelado) => {
    S.transitando = true;
    try { await executarAbrirRotina(no, opc, cancelado); } finally { S.transitando = false; }
  });
}

async function executarAbrirRotina(no, opc, cancelado) {
  const G = S.G;
  no = atual(no) || no;
  const rot = rotinaDe(no) || seguro(() => D.rotinas(G).find((r) => r.no === no), null);
  // sem a rotina (nota que o D.rotinas não conseguiu ler): abre a nota no leitor em vez de não fazer nada
  if (!rot) { await executarAbrir(no, { ...opc, leitor: true }, cancelado); return; }
  const R = S.robo, rv = roboVisivel(), voar = rv && !reduzido();
  const leitorJa = !!S.leitorNo && estaAberto();
  const fluxoJa = !!S.fluxoNo && fluxoAberto();
  const saudeJa = S.saudeAberta && saudeAbertaUI();   // rotina clicada no painel Saúde: o funil entra no lugar dele
  const jaAberto = leitorJa || fluxoJa || saudeJa;
  if (fluxoJa && S.fluxoNo === no) { R?.expressao('feliz', 700); return; }
  if (!jaAberto) { guardarFoco(); suspenderLeque(); }
  S.saudeAberta = false;
  const anterior = S.leitorNo || S.fluxoNo;
  S.leitorNo = null;
  S.voltarFluxo = null;
  S.etapaIds = null;
  S.fluxoNo = no;
  ui.rotinas(S.rotinas, no);
  S.aneis?.selecionar(no);
  aplicarDestaque();
  R?.expressao('procurando', 1100);
  enquadrarComLeitor();

  if (jaAberto) {
    // Troca (outra rotina, ou o leitor dando lugar ao funil): solta o anterior e puxa a conta pelo feixe.
    if (anterior && anterior !== no) R?.devolver(anterior.id, null);
    const alvo = pontoBorda(rv ? ponto(R.testa()) : null, rectLeitor()) || centroLeitor() || estimarCentro();
    if (voar) {
      R.apontar(no.id);
      const voo = comPrazo(R.puxar(no.id, alvo), 1800);
      await Promise.race([voo, esperar(260 + 760 * 0.8)]);
      R.apontar(null);
      if (cancelado() && S.intencao === 'fechar') return;
    } else R?.puxar(no.id, null);
    await comPrazo(ui.abrirFluxo(no, rot, G, { origem: alvo, troca: true }), 3000);
  } else {
    const alvo = estimarCentro();
    let origem = ponto(opc.origem) || (S.teclado ? alvo : ponto(S.ponteiro) || alvo);
    if (voar) {
      R.apontar(no.id);                       // olha para a conta antes de ela sair do halo
      await comPrazo(R.puxar(no.id, alvo), 2400);
      R.apontar(null);
      origem = alvo;
      if (cancelado() && S.intencao === 'fechar') {
        await comPrazo(R.devolver(no.id, alvo), 1800);
        S.fluxoNo = null;
        ui.rotinas(S.rotinas, null);
        S.aneis?.selecionar(null);
        return;
      }
    } else R?.puxar(no.id, null);
    R?.base('lendo');
    await comPrazo(ui.abrirFluxo(no, rot, G, { origem, troca: false }), 3500);
  }
  if (S.fluxoNo !== no) return;
  const r = rectLeitor();
  if (r) { S.ultimoRect = r; S.ultimoTam = tamTela(); }
  if (R) { R.apontar(null); R.base(baseRepouso()); const c = centroDe(r); if (c) R.olharPara(c); }
  if (!document.hidden) iniciarFeixe();
  focarLeitor('#fluxo', '#fFechar');
}
// Etapa do funil em foco: o cérebro acende as notas que ela cita (e a própria rotina).
function marcarEtapa(alvos) {
  if (!S.fluxoNo || !S.G) { S.etapaIds = null; return; }
  const ids = alvos && alvos.length ? new Set([S.fluxoNo.id]) : null;
  if (ids) for (const a of alvos) { const n = seguro(() => D.seguirLink(S.G, a), null); if (n) ids.add(n.id); }
  S.etapaIds = ids && ids.size > 1 ? ids : null;
  aplicarDestaque();
}

// Fechar: o painel se dobra numa esfera que volta para a cúpula.
function fechar(opc = {}) {
  S.intencao = 'fechar';
  return transicao(async () => {
    S.transitando = true;
    try { await executarFechar(opc); } finally { S.transitando = false; }
  });
}

async function executarFechar({ jaFechado = false } = {}) {
  const no = S.leitorNo || S.fluxoNo;
  const eraFluxo = !S.leitorNo && !!S.fluxoNo;
  pararFeixe();
  let p = null;
  if (!jaFechado) {
    if (estaAberto()) p = ponto(await comPrazo(ui.fecharLeitor(), 2500));
    else if (fluxoAberto()) p = ponto(await comPrazo(ui.fecharFluxo(), 2500));
    else if (saudeAbertaUI()) p = ponto(await comPrazo(ui.fecharSaude(), 2500));
  }
  S.saudeAberta = false;
  if (!p) p = centroDe(S.ultimoRect) || estimarCentro();
  S.leitorNo = null;
  S.fluxoNo = null;
  S.voltarFluxo = null;
  S.etapaIds = null;
  if (eraFluxo) ui.rotinas(S.rotinas, null);
  S.aneis?.selecionar(null);
  const R = S.robo;
  if (R) { R.base(baseRepouso()); R.olharPara(null); R.apontar(null); }   // e solta a conta do halo, se ainda estiver apontada
  centralizarRobo();
  // sempre solta o neurônio (apaga devagar); a esfera só voa de volta se o robô estiver na tela e houver movimento
  if (no && R) await comPrazo(R.devolver(no.id, roboVisivel() && !reduzido() ? p : null), 2000);
  aplicarDestaque();
  restaurarFoco();
  if (S.lequeSuspenso && !S.depto) {
    const d = S.lequeSuspenso;
    S.lequeSuspenso = null;
    await esperar(reduzido() ? 0 : 380);  // deixa o robô voltar para o centro antes de abrir o leque
    if (!S.leitorNo && !S.fluxoNo && !S.depto) {
      mostrarLeque(d, { silencioso: true });   // volta sem repetir o aviso "as N mais recentes"
      // quem usa o teclado volta para o cartão da nota que estava aberta (o cartão antigo foi recriado)
      if (S.teclado && no && !dentroPainel(document.activeElement)) {
        let c = null;
        try { c = document.querySelector(`#leque .carta[data-chave="${CSS.escape(chaveNo(no))}"]`); } catch { c = null; }
        if (c && (document.activeElement === document.body || !document.activeElement)) { try { c.focus({ preventScroll: true }); } catch { /* nada */ } }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Feixe testa → leitor (um quadro por vez enquanto o leitor estiver aberto)
// ---------------------------------------------------------------------------
let rafFeixe = 0;
let feixeVazio = false;
function iniciarFeixe() { if (!rafFeixe) rafFeixe = requestAnimationFrame(passoFeixe); }
function pararFeixe() {
  if (rafFeixe) cancelAnimationFrame(rafFeixe);
  rafFeixe = 0;
  feixeVazio = true;
  ui.feixe(null, null);
}
function passoFeixe() {
  rafFeixe = 0;
  if ((!S.leitorNo && !S.fluxoNo && !S.saudeAberta) || document.hidden) { pararFeixe(); return; }
  if (!S.transitando && !(S.leitorNo ? estaAberto() : S.fluxoNo ? fluxoAberto() : saudeAbertaUI())) {
    // O leitor fechou sozinho (pela própria interface): devolve a esfera e arruma o estado.
    pararFeixe();
    fechar({ jaFechado: true });
    return;
  }
  const r = rectLeitor();
  if (r) { S.ultimoRect = r; S.ultimoTam = tamTela(); }
  let de = null, ate = null;
  if (r && roboVisivel()) {
    const t = ponto(S.robo.testa());
    ate = pontoBorda(t, r);
    if (ate) de = t;
  }
  if (de && ate) { feixeVazio = false; ui.feixe(de, ate); }
  else if (!feixeVazio) { feixeVazio = true; ui.feixe(null, null); }
  rafFeixe = requestAnimationFrame(passoFeixe);
}

// ---------------------------------------------------------------------------
// Destaque dos neurônios (camadas: pergunta > busca > etapa do funil > leitor > funil > leque > resposta > notas novas)
// ---------------------------------------------------------------------------
function aplicarDestaque() {
  let ids = null;
  if (S.perguntando && S.achadas.size) ids = S.achadas;
  else if (S.buscaIds && S.buscaIds.size) ids = S.buscaIds;
  else if (S.fluxoNo && S.etapaIds && S.etapaIds.size) ids = S.etapaIds;
  else if (S.leitorNo) ids = vizinhanca(S.leitorNo);
  else if (S.fluxoNo) ids = idsDoFluxo(S.fluxoNo);
  else if (S.saudeAberta && S.saudeIds && S.saudeIds.size) ids = S.saudeIds;
  else if (S.depto) ids = new Set(S.depto.list.map((n) => n.id));
  else if (S.achadas.size) ids = S.achadas;
  const copia = ids ? new Set(ids) : null;
  S.robo?.destacar(copia);
  // Os anéis não têm anel de pulso: as notas novas ficam acesas por alguns segundos.
  if (!copia && S.frescosAneis && performance.now() < S.frescosAte) S.aneis?.destacar(new Set(S.frescosAneis));
  else S.aneis?.destacar(copia);
}

// ---------------------------------------------------------------------------
// Leque de memórias por departamento
// ---------------------------------------------------------------------------
const CARTAO = { w: 0, h: 0, medido: false, chave: '' };
// Tamanho do cartão (vem do CSS). Mede uma vez por largura de tela com um cartão-sonda invisível
// de nome longo (2 linhas, o maior caso), antes de calcular o arco: assim nada é refeito na frente da pessoa.
function tamCartao() {
  const chave = `${classeTela()}:${Math.round(S.ref.width)}`;
  if (CARTAO.medido && CARTAO.chave === chave) return CARTAO;
  const caixa = $('#leque');
  if (caixa) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'carta';
    b.setAttribute('aria-hidden', 'true');
    b.tabIndex = -1;
    b.style.visibility = 'hidden';
    b.innerHTML = '<span class="carta-nm">2026-10-09 — Uma nota com nome comprido que ocupa as duas linhas do cartão</span><span class="carta-mt"><span>há 12 dias</span><span><b>88</b> conexões</span></span>';
    caixa.appendChild(b);
    const w = b.offsetWidth, h = b.offsetHeight;
    b.remove();
    if (w > 40 && h > 20) { CARTAO.w = w; CARTAO.h = h; CARTAO.medido = true; CARTAO.chave = chave; return CARTAO; }
  }
  const W = S.ref.width;
  return W < LARGURA_CELULAR ? { w: Math.max(120, Math.min(200, (W - 34) / 2)), h: 74 } : { w: 214, h: 86 };
}
// Área onde os cartões podem ficar: a mesma que o holo.js usa para prendê-los (abaixo do topo, à direita do trilho).
function areaLeque() {
  const a = ui.areaLivre();
  if (a && a.width > 60 && a.height > 60) return { left: a.left, top: a.top, right: a.right, bottom: a.bottom };
  return { left: 12, top: 12, right: S.ref.width - 12, bottom: S.ref.height - 12 };
}

function retanguloDe(sel) {
  const el = $(sel);
  if (!el || el.closest('[hidden]')) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { left: r.left - S.ref.left, top: r.top - S.ref.top, right: r.right - S.ref.left, bottom: r.bottom - S.ref.top };
}
function obstaculos(modo) {
  // #recentes não entra: ele some sozinho enquanto o leque está aberto (CSS .com-leque).
  const sels = modo === 'grade'
    ? ['#trilho', '#perguntaForm', '#legenda', '#maosCam']
    : ['.marca', '.topo', '#trilho', '#perguntaForm', '#resposta', '#legenda', '#menu', '#maosCam'];   // #maosCam: cartão da câmera (modo Mãos)
  const out = [];
  for (const s of sels) { const r = retanguloDe(s); if (r) out.push(inflar(r, 8)); }
  return out;
}

// Cabeça do robô na tela (onde ela vai parar, se ainda estiver deslizando): o leque não cobre rosto nem cúpula.
function cabecaNaTela(c) {
  if (!roboVisivel()) return null;
  const k = S.robo.cabeca(true);
  if (k && Number.isFinite(k.x) && Number.isFinite(k.y) && k.r > 20) return { x: k.x, y: k.y, r: k.r };
  const t = ponto(S.robo.testa(true));
  if (!t) return null;
  const r = Math.max(80, Math.hypot(t.x - c.x, t.y - c.y) * 2.6);
  return { x: t.x, y: t.y + r * 0.2, r };
}

// Leque em arco (desktop): colunas de cartões dos dois lados da cabeça. A coluna de dentro abraça a
// cabeça redonda (no alto, perto da cúpula, ela se aproxima do centro), as de fora vêm logo depois.
// Os cartões nunca se sobrepõem (linhas e colunas com folga) e não cobrem rosto, cúpula nem painéis.
// O cartão mais recente fica ao lado da cúpula; os seguintes se espalham para cima, para baixo e para fora.
function posicoesArco(n, c) {
  const { w, h } = tamCartao();
  const gap = 12;
  const A = areaLeque();
  const obst = obstaculos('arco');
  const menor = Math.min(S.ref.width, S.ref.height);
  const cab = cabecaNaTela(c) || { x: c.x, y: c.y + menor * 0.12, r: Math.max(110, menor * 0.26) };
  // Meia largura da cabeça na faixa [y0, y1]: elipse mais alta em cima (cúpula); abaixo do centro, reta (ombros).
  const meiaLargura = (y0, y1) => {
    const yn = Math.min(Math.max(cab.y, y0), y1);
    if (yn >= cab.y) return cab.r * 0.98;
    const dy = (yn - cab.y) / (cab.r * 1.24);
    return dy <= -1 ? 0 : cab.r * 0.98 * Math.sqrt(1 - dy * dy);
  };
  const linhas = [];
  for (let y = A.top + h / 2; y + h / 2 <= A.bottom; y += h + gap) linhas.push(y);
  const yPref = cab.y - cab.r * 0.35;
  const vagas = [];
  for (const y of linhas) {
    const meia = meiaLargura(y - h / 2, y + h / 2), desvio = meia + gap + w / 2;
    for (const lado of [-1, 1]) {
      for (let col = 0; col < 4; col++) {
        // Arco: as colunas de fora se abrem em leque (as linhas de cima sobem e as de baixo descem em
        // direção aos ombros), em vez de formar dois blocos retangulares ao lado da cabeça.
        const yy = col === 0 ? y : y + (y >= cab.y ? 0.45 : -0.2) * col * (h + gap);
        let x = cab.x + lado * (desvio + col * (w + gap));
        // Coluna de dentro sem espaço por poucos px: encosta na borda da área e aceita roçar a orelha.
        if (col === 0 && lado < 0 && x - w / 2 < A.left && A.left + w <= cab.x - meia * 0.9) x = A.left + w / 2;
        if (col === 0 && lado > 0 && x + w / 2 > A.right && A.right - w >= cab.x + meia * 0.9) x = A.right - w / 2;
        const r = { left: x - w / 2, right: x + w / 2, top: yy - h / 2, bottom: yy + h / 2 };
        if (r.left < A.left || r.right > A.right || r.top < A.top || r.bottom > A.bottom) continue;
        if (obst.some((o) => cruza(r, o))) continue;
        vagas.push({ x, y: yy, r, nota: col * 10 + Math.abs(yy - yPref) / (h + gap) + (lado > 0 ? 0.01 : 0) });
      }
    }
  }
  vagas.sort((a, b) => a.nota - b.nota);
  // escolhe na ordem de preferência, sem deixar dois cartões se encostarem
  const aceitas = [], max = Math.min(n, MAX_LEQUE.desktop);
  for (const v of vagas) {
    if (aceitas.length >= max) break;
    if (aceitas.some((a) => cruza(a.r, v.r, gap / 2))) continue;
    aceitas.push(v);
  }
  return aceitas.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}

// Grade embaixo (celular, ou quando o arco não cabe).
function posicoesGrade(n, max) {
  const W = S.ref.width, H = S.ref.height;
  const { w, h } = tamCartao();
  const gap = 10;
  // a mesma área em que o holo.js prende os cartões (à direita do trilho no tablet, acima dele no celular):
  // fora dela os cartões seriam empurrados para dentro e se sobreporiam
  const A = areaLeque();
  const util = Math.max(w, A.right - A.left);
  let baixo = Math.min(H - 12, A.bottom);
  for (const o of obstaculos('grade')) {
    if (o.top > H * 0.4 && o.left < A.left + util * 0.75 && o.right > A.left + util * 0.25) baixo = Math.min(baixo, o.top - 2);
  }
  const cols = Math.max(1, Math.min(3, Math.floor((util + gap) / (w + gap))));
  const topo = Math.max(A.top, H * (W < LARGURA_CELULAR ? 0.4 : 0.5));
  const linhasMax = Math.max(1, Math.min(4, Math.floor((baixo - topo + gap) / (h + gap))));
  const N = Math.min(n, cols * linhasMax, max);
  const linhas = Math.ceil(N / cols);
  const y0 = baixo - linhas * h - (linhas - 1) * gap + h / 2;
  const out = [];
  for (let i = 0; i < N; i++) {
    const lin = Math.floor(i / cols), col = i % cols;
    const naLinha = Math.min(cols, N - lin * cols);
    const larg = naLinha * w + (naLinha - 1) * gap;
    const x0 = A.left + (util - larg) / 2 + w / 2;
    out.push({ x: Math.round(x0 + col * (w + gap)), y: Math.round(y0 + lin * (h + gap)) });
  }
  return out;
}

function calcularLeque(n, c) {
  S.lequeModo = 'grade';
  if (S.ref.width < LARGURA_CELULAR) return posicoesGrade(n, MAX_LEQUE.celular);
  const arco = posicoesArco(n, c);
  S.lequeModo = 'arco';
  if (arco.length >= Math.min(n, 6)) return arco;
  // tela estreita (tablet em pé): o arco só cabe de um lado; a grade embaixo, nos ombros, mostra mais
  const grade = posicoesGrade(n, MAX_LEQUE.celular);
  if (grade.length > arco.length) { S.lequeModo = 'grade'; return grade; }
  return arco;
}
function origemLeque() {
  if (roboVisivel()) { const c = ponto(S.robo.cupula(true)); if (c) return c; }
  return centroTela();
}
const assinaturaLeque = (dep) => dep.list.map((n) => `${chaveNo(n)}@${n.mtime || 0}`).sort().join('|');

// reposicionar = true: só o tamanho da tela mudou; os mesmos cartões deslizam para as vagas novas
// (sem recolher e reabrir, sem "procurando" e sem aviso).
function mostrarLeque(dep, { silencioso = false, reposicionar = false } = {}) {
  if (!S.G || !dep) return;
  S.depto = dep;
  S.lequeSuspenso = null;
  const nos = dep.list.slice().sort((a, b) => (b.mtime || 0) - (a.mtime || 0) || String(a.name).localeCompare(String(b.name)));
  const origem = origemLeque();
  const pos = calcularLeque(nos.length, origem);
  // Não coube tudo: a última vaga vira o cartão "e mais N notas", que abre a lista com as outras.
  const cabe = pos.length >= nos.length ? nos.length : Math.max(0, pos.length - 1);
  const mostrados = nos.slice(0, cabe), resto = nos.slice(cabe);
  ui.leque(mostrados, origem, pos, { resto, reposicionar, onMais: (lista) => mostrarResto(dep, lista) });
  $('#app')?.classList.toggle('leque-grade', S.lequeModo === 'grade');   // grade embaixo: o aviso fica no alto
  S.lequePos = new Map(mostrados.map((n, i) => [chaveNo(n), pos[i]]));
  S.lequeAssin = assinaturaLeque(dep);
  trilho(dep);
  if (reposicionar) return;
  ui.dica(null);
  S.robo?.expressao('procurando', 800);
  aplicarDestaque();
  if (resto.length && !(silencioso && S.lequeAvisado === dep.name)) {
    S.lequeAvisado = dep.name;
    ui.aviso(`${dep.name}: as ${mostrados.length} mais recentes de ${nos.length}. O cartão "e mais" lista as outras.`, 3400);
  }
}
// Cartão "e mais N notas": a lista de resultados (que já rola e aceita setas e Enter) mostra as que não couberam.
function mostrarResto(dep, lista) {
  if (!lista || !lista.length) return;
  const q = lista.length;
  const campo = $('#q');
  if (campo && campo.value) { campo.value = ''; S.buscaIds = null; }   // a lista é do departamento, não da busca anterior
  ui.resultados(lista, dep.name, { titulo: `${dep.name}: mais ${q} ${q === 1 ? 'nota' : 'notas'}` });
  if (S.teclado) { try { $('#q')?.focus({ preventScroll: true }); } catch { /* nada */ } }
}
function recolherLeque(manterSuspenso = false) {
  if (!manterSuspenso) S.lequeSuspenso = null;
  const tinha = !!S.depto || S.lequePos.size > 0;
  S.depto = null;
  S.lequePos = new Map();
  if (!tinha) return;
  ui.leque([], origemLeque(), []);
  if (S.G) trilho(null);
  if (!S.leitorNo && !S.fluxoNo) {
    S.robo?.olharPara(null);                       // um cartão em foco pode ter sumido sem avisar
    S.aneis?.selecionar(null, { voar: false });    // anéis: o hub do departamento deixa de estar escolhido
  }
  aplicarDestaque();
}
// Trilho de departamentos + marca dos escondidos pelo filtro do menu.
function trilho(ativo) {
  if (!S.G) return;
  ui.trilho(S.G.depts, ativo);
  marcarOcultos();
}
function suspenderLeque() {
  if (!S.depto) return;
  const d = S.depto;
  recolherLeque(true);
  S.lequeSuspenso = d;   // volta quando o leitor fechar
}
function alternarDepto(d) {
  if (!S.G) return;
  const nome = d && typeof d === 'object' ? d.name : d;
  const dep = nome != null ? S.G.depts.find((x) => x.name === nome) : null;
  if (!dep || (S.depto && S.depto.name === dep.name)) { recolherLeque(); return; }
  if (S.ocultos.has(dep.name)) alternarOculto(dep.name, true);   // escolheu no trilho um departamento escondido: volta a mostrar
  if (S.leitorNo || S.fluxoNo || painelAberto()) {
    S.lequeSuspenso = dep;   // fechar() abre este leque no fim
    fechar();
    return;
  }
  mostrarLeque(dep);
}
function aoClicarVazio() {
  ui.dica(null);
  if (S.depto) recolherLeque();
}

// ---------------------------------------------------------------------------
// Filtro de departamentos (menu, porte do antigo): esconde um ou mais departamentos no robô e nos anéis
// ---------------------------------------------------------------------------
let assinChips = '';
function renderChips() {
  const caixa = $('#deptChips');
  if (!caixa || !S.G) return;
  const assin = S.G.depts.map((d) => `${d.name}:${d.list.length}:${d.ci}`).join('|');
  if (assin !== assinChips) {
    assinChips = assin;
    const esc = (s) => seguro(() => D.esc(s), '');
    const cor = (d) => { const c = seguro(() => D.corDe(d.hub || { kind: 'dept', ci: d.ci }), ''); return /^#[0-9a-f]{3,8}$/i.test(c) ? c : 'var(--holo)'; };
    caixa.innerHTML = S.G.depts.map((d, i) => `<button type="button" class="chip" data-i="${i}" aria-pressed="true" style="--c:${cor(d)}"><i aria-hidden="true"></i><span class="chip-nm">${esc(d.name)}</span><span class="chip-qt">${d.list.length}</span></button>`).join('');
  }
  caixa.querySelectorAll('.chip').forEach((b) => { const d = S.G.depts[+b.dataset.i]; b.setAttribute('aria-pressed', String(!(d && S.ocultos.has(d.name)))); });
}
function marcarOcultos() {
  const t = $('#trilho');
  if (!t || !S.G) return;
  t.querySelectorAll('.depto').forEach((b) => { const d = S.G.depts[+b.dataset.i]; b.classList.toggle('oculto', !!d && S.ocultos.has(d.name)); });
}
function aplicarOcultos() {
  S.robo?.ocultar(S.ocultos);
  S.aneis?.ocultar(S.ocultos);
  renderChips();
  marcarOcultos();
}
// mostrar: true mostra, false esconde, undefined alterna
function alternarOculto(nome, mostrar) {
  const esconder = mostrar === undefined ? !S.ocultos.has(nome) : !mostrar;
  if (esconder) S.ocultos.add(nome); else S.ocultos.delete(nome);
  aplicarOcultos();
  if (esconder && S.depto && S.depto.name === nome) recolherLeque();
}

// ---------------------------------------------------------------------------
// Busca, links, Obsidian, copiar
// ---------------------------------------------------------------------------
function aoBuscar(valor) {
  const q = String(valor ?? $('#q')?.value ?? ''), t = q.trim();
  const nos = t && S.G ? seguro(() => D.buscar(S.G, t, 10), []) : [];
  ui.resultados(nos, q);
  S.buscaIds = t ? new Set(nos.map((n) => n.id)) : null;
  aplicarDestaque();
  const agora = performance.now();
  if (t && nos.length && agora - S.ultimaVarredura > 900) { S.ultimaVarredura = agora; S.robo?.expressao('procurando', 800); }
}
function escolherBusca(no) {
  S.buscaIds = null;
  abrir(no);
}
function seguir(alvo, info = {}) {
  if (!S.G) return;
  const nome = String(alvo ?? '').trim();
  const no = nome ? seguro(() => D.seguirLink(S.G, nome), null) : null;
  if (!no) {
    S.robo?.expressao('alerta', 1200);
    ui.aviso(`A nota "${nome}" ainda não existe no vault.`, 3200, 'alerta');
    return;
  }
  // link de etapa do funil: abre no leitor (com "← Voltar ao fluxo"); link dentro do leitor fica no leitor
  abrir(no, { origem: info && info.origem, leitor: !!(info && info.noFluxo), noLeitor: !!(info && info.noLeitor) });
}
// O clique da pinça (modo Mãos) é um evento sintético: não dá "ativação de usuário", e sem ela o Chrome e o Edge
// barram a janela nova, o obsidian:// e o seletor de arquivos sem avisar ninguém. Nesses casos, a frase explica.
function semAtivacao() {
  try { return !!navigator.userActivation && !navigator.userActivation.isActive; } catch { return false; }
}
const TXT_SEM_ATIVACAO = {
  obsidian: 'Pelas mãos o navegador não deixa abrir o Obsidian. Use o mouse (ou "Copiar caminho").',
  pasta: 'Pelas mãos o navegador não deixa abrir a escolha de pasta. Use o mouse.',
  link: 'Pelas mãos o navegador não deixa abrir links externos. Use o mouse.'
};
function abrirObsidian(no) {
  no = atual(no) || no;
  if (!no || !S.G) return;
  if (S.demo) { ui.aviso('No exemplo não há vault real. Abra a pasta do seu vault para usar este botão.'); return; }
  if (no.virtual) { ui.aviso('Este vault ainda não tem um CLAUDE.md na raiz.'); return; }
  const url = seguro(() => D.obsidianUrl(S.G, no), '');
  if (!url) return;
  if (semAtivacao()) { ui.aviso(TXT_SEM_ATIVACAO.obsidian, 4200); return; }
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a);
  try { a.click(); } catch { /* o navegador bloqueou */ }
  a.remove();
  ui.aviso('Pedindo ao Obsidian para abrir a nota. Se nada acontecer, use "Copiar caminho".');
}
function copiarCaminho(no) {
  const txt = String(no?.path || no?.name || '');
  if (!txt) return;
  const antes = document.activeElement;
  const reserva = () => {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.className = 'sr';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    try { antes?.focus?.({ preventScroll: true }); } catch { /* nada */ }
    ui.aviso(ok ? 'Caminho copiado.' : txt, ok ? 3200 : 6000);
  };
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(txt).then(() => ui.aviso('Caminho copiado.', 3200, 'ok'), reserva);
      return;
    }
  } catch { /* cai na reserva */ }
  reserva();
}

// ---------------------------------------------------------------------------
// Pergunte ao cérebro (Claude): porte do antigo, com o robô reagindo
// ---------------------------------------------------------------------------
const ERR = {
  not_granted: 'O acesso ao Claude não foi liberado nesta página.',
  rate_limited: 'Muitas perguntas em sequência. Espere um pouco e tente de novo.',
  prompt_too_large: 'A conversa ficou grande demais. Pergunte de novo: comecei uma conversa nova.',
  session_expired: 'Sua sessão expirou. Recarregue a página.',
  sampling_disabled: 'O acesso ao Claude está desativado para esta conta.',
  refused: 'O Claude não respondeu a esta pergunta.',
  upstream_error: 'O Claude não respondeu agora. Tente de novo em instantes.',
  tools_unavailable: 'As ferramentas de busca não estão disponíveis aqui. Pergunte de novo: vou mandar as notas junto.',
  empty_completion: 'O Claude não escreveu nada. Pergunte de outro jeito.',
  not_declared: 'O acesso ao Claude não está disponível nesta página.',
  capability_disabled: 'O acesso ao Claude não está disponível nesta página.',
  capability_removed: 'O acesso ao Claude não está disponível nesta página.',
  invalid_request: 'Não deu para montar a pergunta. Tente de novo.',
  transform_error: 'Não deu para montar a pergunta. Tente de novo.',
  queue_overflow: 'Muitas perguntas de uma vez. Recarregue a página.'
};
const DESLIGA = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

function visaoGeral() {
  const G = S.G;
  const por = (k) => G.nodes.filter((n) => n.kind === k).map((n) => n.name);
  const s = `Vault: ${G.vaultName}${S.demo ? ' (dados de exemplo)' : ''}\nDepartamentos da memória: ${G.depts.map((d) => `${d.name} (${d.list.length})`).join(', ')}\nSkills: ${por('skill').join(', ') || 'nenhuma'}\nRotinas: ${por('routine').join(', ') || 'nenhuma'}\nAplicações: ${por('app').join(', ') || 'nenhuma'}\n\nConteúdo do CLAUDE.md:\n${String(G.core?.text || '').slice(0, 5000)}`;
  return s.slice(0, 9000);
}
const INTRO = 'Você é o assistente do "Cérebro da Lube", o segundo cérebro da empresa guardado num vault do Obsidian. Responda sempre em português do Brasil, de forma direta e prática.';
const FORMATO = 'Use markdown simples: parágrafos curtos, listas quando ajudar, sem tabelas grandes.';
function regras() {
  return `${INTRO}

Antes de responder, use as ferramentas: buscar_notas para achar notas relevantes e ler_nota para ler as mais promissoras. Não invente fatos que não estejam nas notas; se a informação não estiver no cérebro, diga isso e sugira qual nota deveria ser criada e em que pasta.

Para saber se as rotinas rodaram, se as cargas subiram certo ou se os sistemas estão no ar, use ver_saude: é o estado ao vivo do Guardião (as notas dizem como deveria ser; ver_saude diz o que aconteceu).

Cite as notas que usou no formato [[Nome da nota]] (use o nome exato devolvido pelas ferramentas). ${FORMATO}

Visão geral do cérebro:
${visaoGeral()}`;
}
function regrasSemFerramentas(notas) {
  return `${INTRO}

Nesta conversa você não tem ferramentas. Use só a visão geral e as notas abaixo, que a página separou com a busca local para a pergunta mais recente. Não invente fatos que não estejam nelas; se a informação não estiver aqui, diga isso e sugira qual nota deveria ser criada e em que pasta.

Cite as notas que usou no formato [[Nome da nota]] (use o nome exato do título). ${FORMATO}

Visão geral do cérebro:
${visaoGeral()}
${textoSaude()}
Notas encontradas:
${notas}`;
}
function acharNota(G, caminho) {
  const alvo = seguro(() => D.norm(String(caminho).replace(/\.md$/i, '')), '').trim();
  if (!alvo) return null;
  const pool = G.nodes.filter((x) => x.kind !== 'dept');
  const N = (s) => seguro(() => D.norm(s), '');
  return pool.find((x) => x.path && N(x.path.replace(/\.md$/i, '')) === alvo)
    || pool.find((x) => N(x.name) === alvo)
    || pool.find((x) => x.path && N(x.path).includes(alvo))
    || seguro(() => D.seguirLink(G, String(caminho)), null);
}
function reagirBusca(q, achadas) {
  ui.resposta.status(`Buscando "${q}"…`);
  S.robo?.expressao('procurando', 1300);
  for (const n of achadas) S.achadas.add(n.id);
  aplicarDestaque();
}
function reagirLeitura(n) {
  ui.resposta.status(`Lendo "${n.name}"…`);
  S.robo?.faisca(n.id);
  S.achadas.add(n.id);
  S.usadas.set(n.id, n);
  ui.resposta.usadas([...S.usadas.values()]);
  aplicarDestaque();
}
function ferramentas(ctl) {
  const ativa = () => S.ctl === ctl;
  return [
    {
      name: 'buscar_notas',
      description: 'Busca notas do vault por palavras-chave (nome, tags, departamento e texto). Devolve até 8 notas com nome, caminho, tipo, departamento e um trecho. Use primeiro, com termos curtos.',
      inputSchema: { type: 'object', properties: { consulta: { type: 'string', description: 'Palavras-chave em português' } }, required: ['consulta'] },
      execute(input) {
        const G = S.G;
        const q = String(input?.consulta ?? '').slice(0, 200);
        const achadas = G ? seguro(() => D.buscar(G, q, 8), []).filter((n) => n && n.kind !== 'dept') : [];
        if (ativa()) reagirBusca(q, achadas);
        return achadas.map((n) => ({ nome: n.name, caminho: n.path, tipo: ROTULO[n.kind] || n.kind, departamento: n.dept || undefined, trecho: seguro(() => D.trecho(n, q), '') }));
      }
    },
    {
      name: 'ler_nota',
      description: 'Lê o conteúdo completo de uma nota pelo caminho ou nome. Devolve o texto (até 12 mil caracteres) e os nomes das notas ligadas a ela.',
      inputSchema: { type: 'object', properties: { caminho: { type: 'string', description: 'Caminho ou nome da nota, como devolvido por buscar_notas' } }, required: ['caminho'] },
      execute(input) {
        const G = S.G;
        const n = G ? acharNota(G, String(input?.caminho ?? '')) : null;
        if (!n || n.kind === 'dept') throw new Error('Nota não encontrada. Use buscar_notas para achar o caminho certo.');
        if (ativa()) reagirLeitura(n);
        return {
          nome: n.name, caminho: n.path, tipo: ROTULO[n.kind] || n.kind, departamento: n.dept || undefined,
          texto: String(n.text || '').slice(0, 12000),
          ligadas: [...(n.links || []), ...(n.back || [])].slice(0, 25).map((id) => G.nodes[id]?.name).filter(Boolean)
        };
      }
    },
    {
      name: 'ver_saude',
      description: 'Mostra a saúde das rotinas e dos sistemas da Lube, vigiados pelo Guardião: o que está em dia, com atenção ou com falha, os incidentes abertos e os últimos fechados, e quando foi a última verificação. Use para perguntas como "está tudo rodando?", "alguma carga falhou?" ou "o BI Compras atualizou hoje?".',
      inputSchema: { type: 'object', properties: { somente_problemas: { type: 'boolean', description: 'true = só o que está com atenção ou falha' } } },
      execute(input) {
        if (ativa()) reagirVerSaude();
        return resumoSaude({ soProblemas: input?.somente_problemas === true });
      }
    }
  ];
}

async function perguntar(q) {
  const sample = S.sample;
  if (!sample || !S.G) return;
  S.ctl?.abort();
  const ctl = new AbortController();
  S.ctl = ctl;
  S.perguntando = true;
  S.achadas = new Set();
  S.usadas = new Map();
  ui.resposta.abrir(q);
  ui.resposta.status('Pensando…', true);
  ui.resposta.usadas([]);
  atualizarBotaoPerguntar();
  S.robo?.base('pensando');
  aplicarDestaque();

  const turno = { role: 'user', content: q };
  S.turns.push(turno);
  if (S.turns.length > 16) S.turns.splice(0, S.turns.length - 16);
  const semFerramentas = S.semFerramentas;
  let primeiro;
  if (semFerramentas) {
    // Sem ferramentas na página: a busca é feita aqui e as notas vão junto com a pergunta.
    const achadas = seguro(() => D.buscar(S.G, q, 5), []).filter((n) => n && n.kind !== 'dept');
    reagirBusca(q, achadas);
    achadas.forEach((n, i) => setTimeout(() => { if (S.ctl === ctl) reagirLeitura(n); }, 260 + i * 280));
    const notas = achadas.map((n) => `### ${n.name} (${n.path})\n${String(n.text || '').slice(0, 3000)}`).join('\n\n');
    primeiro = regrasSemFerramentas(notas || '(nenhuma nota encontrada para esta pergunta)');
  } else primeiro = regras();
  const input = [{ role: 'user', content: primeiro }, ...S.turns.slice(semFerramentas ? -6 : -8)];

  let escrevendo = false, desfecho = 'erro';
  try {
    const opcoes = {
      cache: false,
      signal: ctl.signal,
      onText: ({ text }) => {
        if (S.ctl !== ctl) return;
        ui.resposta.texto(text);
        if (!escrevendo) { escrevendo = true; ui.resposta.status('Escrevendo…', true); }
      }
    };
    if (!semFerramentas) opcoes.tools = ferramentas(ctl);
    const res = await sample(input, opcoes);
    if (S.ctl !== ctl) return;
    const text = String(res?.text ?? '');
    ui.resposta.texto(text);
    S.turns.push({ role: 'assistant', content: text });
    ui.resposta.status(res?.truncated ? 'A resposta foi cortada. Peça uma parte de cada vez.' : (S.usadas.size ? 'Notas consultadas:' : ''), false);
    if (S.usadas.size) S.achadas = new Set(S.usadas.keys());
    desfecho = 'ok';
  } catch (e) {
    const i = S.turns.lastIndexOf(turno);
    if (i >= 0) S.turns.splice(i, 1);
    if (S.ctl !== ctl) return;   // uma pergunta mais nova (ou "Nova conversa") já cuida da tela
    const codigo = e && e.code;
    if (codigo === 'refused') ui.resposta.texto('');
    else if (e && typeof e.text === 'string' && e.text) ui.resposta.texto(e.text);
    ui.resposta.status(codigo === 'cancelled' ? 'Parado.' : (ERR[codigo] || 'Não foi possível falar com o Claude agora.'), false);
    if (codigo === 'tools_unavailable') S.semFerramentas = true;
    if (codigo === 'prompt_too_large') S.turns = [];
    if (DESLIGA.has(codigo)) desligarPergunta();
    desfecho = codigo === 'cancelled' ? 'parado' : 'erro';
  } finally {
    if (S.ctl === ctl) {
      S.ctl = null;
      S.perguntando = false;
      atualizarBotaoPerguntar();
      S.robo?.base(baseRepouso());
      if (desfecho === 'ok') S.robo?.expressao('feliz', 1800);
      else if (desfecho === 'erro') S.robo?.expressao('alerta', 1400);
      aplicarDestaque();
    }
  }
}
function pararPergunta() { S.ctl?.abort(); }
function novaConversa() {
  const c = S.ctl;
  S.ctl = null;
  S.perguntando = false;
  try { c?.abort(); } catch { /* nada */ }
  S.turns = [];
  S.achadas = new Set();
  S.usadas = new Map();
  atualizarBotaoPerguntar();
  S.robo?.base(baseRepouso());
  aplicarDestaque();
}
function desligarPergunta() {
  S.sample = null;
  const f = $('#perguntaForm');
  if (f) f.hidden = true;
}
function atualizarBotaoPerguntar() {
  const b = $('#perguntaBtn');
  if (b) b.disabled = S.perguntando;   // como no antigo: uma pergunta por vez ("Parar" fica no painel)
}
async function ligarPergunta() {
  const caixa = $('#pergunta');
  let sample = null;
  try {
    const c = window.claude;
    if (c && typeof c.use === 'function') sample = await c.use('sample');
  } catch { sample = null; }
  if (typeof sample !== 'function') sample = null;
  S.sample = sample;
  if (caixa) caixa.hidden = !sample;
  if (!sample) return;
  try {
    if (typeof sample.limits === 'function') {
      const lim = await sample.limits();
      if (lim && typeof lim === 'object' && !lim.tools) S.semFerramentas = true;
    }
  } catch { /* sem limites: tenta com ferramentas; se não der, o erro troca de modo */ }
}

// ---------------------------------------------------------------------------
// Dados: montar o grafo, instalar nas peças, ligar (boot)
// ---------------------------------------------------------------------------
function construir(data) {
  try {
    if (!data || !Array.isArray(data.files)) return null;
    return D.buildGraph(data.files, data.vaultName || 'Vault');
  } catch (err) { avisarFalha('buildGraph', err); return null; }
}
function contarLocal(G) {
  const c = (k) => G.nodes.filter((n) => n.kind === k).length;
  return { memorias: c('memory'), skills: c('skill'), rotinas: c('routine'), apps: c('app'), conexoes: G.linkCount || 0 };
}
function mostrarStats(animar) {
  if (!S.G) return;
  const c = seguro(() => D.contar(S.G), null) || contarLocal(S.G);
  ui.stats(c, { vaultName: S.G.vaultName, aoVivo: S.aoVivo ? S.estadoVivo : false, exemplo: S.demo, animar: !!animar && !reduzido() });
}
function maisRecentes(G, n = 5) {
  const porData = (a, b) => (b.mtime || 0) - (a.mtime || 0);
  const mem = G.nodes.filter((x) => x.kind === 'memory' && x.mtime).sort(porData);
  if (mem.length >= n) return mem.slice(0, n);
  const outros = G.nodes.filter((x) => x.kind !== 'memory' && x.kind !== 'dept' && !x.virtual && x.mtime).sort(porData);
  return [...mem, ...outros].slice(0, n);
}
function atualizarMenuVault() {
  const G = S.G;
  const hint = $('#vaultHint'), load = $('#loadBtn'), demo = $('#demoBtn');
  if (!G) return;
  if (S.aoVivo) {
    if (hint) hint.textContent = `Conectado ao vault "${G.vaultName}" pelo servidor local. Toda nota criada ou alterada aparece aqui sozinha.`;
    if (load) load.hidden = true;
    if (demo) demo.hidden = true;
    return;
  }
  if (load) load.hidden = false;
  if (demo) { demo.hidden = false; demo.textContent = S.demo ? 'Ver exemplo' : 'Trocar pelo exemplo'; }
  if (!hint) return;
  if (S.demo) {
    hint.textContent = 'Exemplo: você está vendo um vault com dados fictícios. Escolha a pasta do seu vault: os arquivos são lidos só neste navegador e ficam guardados aqui para a próxima visita.';
  } else {
    const quando = S.dados && S.dados.loadedAt ? seguro(() => D.relTime(S.dados.loadedAt), '') : '';
    hint.textContent = `Vault "${G.vaultName}" carregado${quando ? ` ${quando}` : ''}. Para ver mudanças feitas no Obsidian, use "Recarregar cérebro".`;
  }
}
// Caminhos novos ou alterados → ids no grafo novo (skills contam pelos arquivos da pasta).
function idsDe(G, caminhos) {
  const set = caminhos instanceof Set ? caminhos : new Set(caminhos || []);
  const ids = new Set();
  if (!set.size) return ids;
  for (const n of G.nodes) {
    if (n.virtual || n.kind === 'dept') continue;
    if ((n.path && set.has(n.path)) || (Array.isArray(n.files) && n.files.some((f) => set.has(f.path)))) ids.add(n.id);
  }
  return ids;
}
const msgAtualizado = (k) => (k === 1 ? 'Cérebro atualizado: 1 nota nova ou alterada.' : `Cérebro atualizado: ${k} notas novas ou alteradas.`);
// O pulso das notas novas e o "surpreso" saem no fim do boot de recarga (420 + 950 ms): o aviso vem junto, não antes.
const ATRASO_PULSO = 420 + 950;
function avisarDepoisDoPulso(texto, frescos) {
  if (frescos && frescos.size && roboVisivel() && !reduzido()) setTimeout(() => ui.aviso(texto), ATRASO_PULSO);
  else ui.aviso(texto);
}

// Põe um grafo novo em todas as peças, mantendo (quando dá) o que estava aberto.
function instalar(G, data, { exemplo = false } = {}) {
  const ant = S.G, antDemo = S.demo;
  const leitorAntes = S.leitorNo, fluxoAntes = S.fluxoNo;
  S.G = G;
  S.dados = data;
  S.demo = !!exemplo;
  S.rotinas = seguro(() => D.rotinas(G), []);
  S.etapaIds = null;
  if (S.voltarFluxo) {
    S.voltarFluxo = mapear(S.voltarFluxo, G);
    // o "← Voltar ao fluxo" do leitor segue a rotina nova (ou some, se ela saiu do vault)
    ui.voltarFluxo(S.voltarFluxo);
  }
  if (ant) {
    const m = (n) => (n ? mapear(n, G) : null);
    const ids = (set) => new Set([...set].map((id) => m(ant.nodes[id])?.id).filter((id) => id != null));
    S.achadas = ids(S.achadas);
    S.usadas = new Map([...S.usadas.values()].map(m).filter(Boolean).map((n) => [n.id, n]));
    S.buscaIds = null;
    if (S.depto) S.depto = G.depts.find((d) => d.name === S.depto.name) || null;
    if (S.lequeSuspenso) S.lequeSuspenso = G.depts.find((d) => d.name === S.lequeSuspenso.name) || null;
  }
  // filtro de departamentos: vale para o mesmo vault (recarga, ao vivo); outro vault ou o exemplo começam sem filtro
  if (S.ocultos.size && (!ant || ant.vaultName !== G.vaultName || antDemo !== S.demo)) S.ocultos = new Set();
  S.robo?.ocultar(S.ocultos);
  S.aneis?.ocultar(S.ocultos);
  S.robo?.setGrafo(G);
  S.aneis?.setGrafo(G);
  trilho(S.depto);
  renderChips();
  ui.recentes(maisRecentes(G));
  ui.rotinas(S.rotinas, fluxoAntes ? mapear(fluxoAntes, G) : null);
  atualizarMenuVault();
  if (fluxoAntes) {
    const novo = mapear(fluxoAntes, G);
    if (!novo) {
      S.fluxoNo = null;
      fechar({ jaFechado: !fluxoAberto() });
      ui.aviso('A rotina aberta saiu do vault.');
    } else {
      S.fluxoNo = novo;
      S.aneis?.selecionar(novo);
      if (novo.mtime !== fluxoAntes.mtime || novo.text !== fluxoAntes.text) {
        // Mesma rotina, nota nova: o funil troca no lugar (glitch), sem cancelar o que está na fila.
        transicao(async () => {
          S.transitando = true;
          try {
            if (S.fluxoNo === novo && fluxoAberto()) await comPrazo(ui.abrirFluxo(novo, rotinaDe(novo), G, { origem: centroLeitor() || estimarCentro(), troca: true }), 3000);
          } finally { S.transitando = false; }
        }, false);
      }
    }
  }
  if (leitorAntes) {
    const novo = mapear(leitorAntes, G);
    if (!novo) {
      S.leitorNo = null;
      fechar({ jaFechado: !estaAberto() });
      ui.aviso('A nota aberta saiu do vault.');
    } else {
      S.leitorNo = novo;
      S.aneis?.selecionar(novo);
      if (novo.mtime !== leitorAntes.mtime || novo.text !== leitorAntes.text) {
        // Mesma nota, conteúdo novo: troca no lugar (sem cancelar o que está na fila).
        transicao(async () => {
          S.transitando = true;
          try {
            if (S.leitorNo === novo && estaAberto()) {
              await comPrazo(ui.abrirLeitor(novo, G, { origem: centroLeitor() || estimarCentro(), troca: true, voltarFluxo: S.voltarFluxo }), 3000);
            }
          } finally { S.transitando = false; }
        }, false);
      }
    }
  }
  if (S.depto) { if (assinaturaLeque(S.depto) !== S.lequeAssin) mostrarLeque(S.depto, { silencioso: true }); }
  else if (S.lequePos.size) recolherLeque(true);
  saudeNoGrafo();
  if (SA.dados) ui.saude(undefined, {});   // as linhas do painel Saúde viram clicáveis quando a nota existe no vault
  aplicarDestaque();
  return true;
}

// Boot do robô + contador subindo. Aceita ser chamado de novo (o mais novo vence).
async function ligar({ recarga = false, frescos = new Set() } = {}) {
  const meu = ++S.bootSeq;
  const R = S.robo;
  if (R) {
    const p = comPrazo(R.boot({ recarga, frescos }), recarga ? 7000 : 9000);
    if (roboVisivel() && !reduzido()) {
      // O contador sobe junto com a onda de neurônios (passo 4 do boot).
      setTimeout(() => { if (meu === S.bootSeq) mostrarStats(true); }, recarga ? 420 : 1650);
      await p;
    } else mostrarStats(!reduzido());
  } else mostrarStats(!reduzido());
  if (meu !== S.bootSeq) return;
  aplicarEstadoRobo();
  if (frescos.size) {
    S.frescosAneis = new Set(frescos);
    S.frescosAte = performance.now() + 8000;
    aplicarDestaque();
    setTimeout(aplicarDestaque, 8100);
    // O boot de recarga do robô já faz o anel de pulso nas notas novas e o surpreso → feliz.
    // Se o robô chegou depois deste boot começar, ele não viu as notas novas: o pulso sai daqui.
    if (S.robo && !R) S.robo.pulsoNovo(new Set(frescos));
  }
}
// Reaplica no robô o estado da tela (depois de boot, troca de visão ou robô que chegou tarde).
function aplicarEstadoRobo() {
  const R = S.robo;
  if (!R) return;
  R.sinapses($('#sinapses')?.checked !== false);
  R.ocultar(S.ocultos);
  R.base(baseRepouso());
  R.saude(SA.tom || 'ok');   // cor da cúpula conforme a saúde (o robô pode ter chegado depois do dado)
  if (S.leitorNo || S.fluxoNo || S.saudeAberta) {
    enquadrarComLeitor();
    const c = centroLeitor();
    if (c) R.olharPara(c);
  } else {
    centralizarRobo();
    R.olharPara(null);
  }
  aplicarDestaque();
}

async function fecharTudo() {
  S.lequeSuspenso = null;
  recolherLeque();
  if (S.leitorNo || S.fluxoNo || painelAberto()) await fechar();
  const resp = $('#resposta');
  if (resp && !resp.hidden) ui.resposta.fechar();
  novaConversa();
}
// Troca de vault pedida pela pessoa (pasta, exemplo, recarregar ao vivo).
async function trocarVault(data, { exemplo = false, recarga = true } = {}) {
  const antes = S.G, antesDemo = S.demo;
  const G = construir(data);
  if (!G) {
    ui.aviso('Não deu para montar o cérebro com essas notas.', 5000, 'alerta');
    S.robo?.expressao('alerta', 1400);
    return null;
  }
  await fecharTudo();
  instalar(G, data, { exemplo });
  // Só compara com a leitura anterior do MESMO vault: outro vault (ou o exemplo) não tem "notas novas".
  const comparou = !!(recarga && antes && !antesDemo && !exemplo && antes.vaultName === G.vaultName);
  const frescos = comparou ? idsDe(G, seguro(() => D.mudancas(antes, G), new Set())) : new Set();
  ligar({ recarga, frescos });
  return { G, frescos, comparou };
}

async function dadosIniciais() {
  try {
    if (ehLocal()) {
      const vivo = await D.buscarVaultLocal();
      if (vivo && Array.isArray(vivo.files) && vivo.files.length) return { data: vivo, vivo: true };
    }
  } catch (err) { avisarFalha('vault local', err); }
  try {
    const g = await comPrazo(D.idbGet('vault'), 2500);   // IndexedDB pendurado (Safari, frame restrito) não trava o início
    if (g && Array.isArray(g.files) && g.files.length) return { data: g, aviso: `Vault "${g.vaultName}" carregado da última visita.` };
  } catch (err) { avisarFalha('vault guardado', err); }
  return { data: seguro(() => D.vaultExemplo(), { vaultName: 'Exemplo', files: [] }), exemplo: true };
}

// ---------------------------------------------------------------------------
// Ao vivo (servidor local), pasta do vault, exemplo, recarregar
// ---------------------------------------------------------------------------
let vivoOcupado = false, vivoPendente = null;
async function aplicarAoVivo(dados) {
  if (vivoOcupado) { vivoPendente = dados || vivoPendente || true; return; }
  vivoOcupado = true;
  try {
    const d = dados && Array.isArray(dados.files) ? dados : await D.buscarVaultLocal();
    if (!d || !Array.isArray(d.files) || !S.G) return;
    const antes = S.G;
    const G = construir(d);
    if (!G) return;
    const caminhos = seguro(() => D.mudancas(antes, G), null);
    const mudou = !caminhos || caminhos.size > 0 || G.nodes.length !== antes.nodes.length || G.linkCount !== antes.linkCount;
    if (!mudou) return;
    instalar(G, d, {});
    const frescos = idsDe(G, caminhos);
    ligar({ recarga: true, frescos });
    if (frescos.size) avisarDepoisDoPulso(msgAtualizado(frescos.size), frescos);
  } catch (err) { avisarFalha('ao vivo', err); }
  finally {
    vivoOcupado = false;
    if (vivoPendente) { const p = vivoPendente; vivoPendente = null; aplicarAoVivo(p === true ? null : p); }
  }
}
function iniciarAoVivo() {
  try {
    D.ouvirMudancas(
      (dados) => { aplicarAoVivo(dados); },
      (estado) => { S.estadoVivo = estado === 'reconectando' ? 'reconectando' : 'ao vivo'; mostrarStats(false); }
    );
  } catch (err) { avisarFalha('ouvirMudancas', err); }
}
async function recarregarAoVivo() {
  S.robo?.expressao('procurando', 1200);
  const d = await Promise.resolve().then(() => D.buscarVaultLocal()).catch(() => null);
  if (!d || !Array.isArray(d.files)) {
    ui.aviso('O servidor local não respondeu.', 4000, 'alerta');
    S.robo?.expressao('alerta', 1200);
    return;
  }
  const r = await trocarVault(d, { recarga: true });
  if (r) avisarDepoisDoPulso(r.frescos.size ? msgAtualizado(r.frescos.size) : 'Cérebro recarregado: nenhuma nota nova ou alterada.', r.frescos);
}
function recarregar() {
  if (S.aoVivo) { recarregarAoVivo(); return; }
  abrirPasta();
}
function abrirPasta() {
  const p = $('#pasta');
  if (!p) return;
  if (semAtivacao()) { ui.aviso(TXT_SEM_ATIVACAO.pasta, 4200); return; }
  try { p.click(); } catch { ui.aviso('Este navegador não deixou abrir a escolha de pasta.', 4000, 'alerta'); }
}
async function carregarPasta(input) {
  const lista = input && input.files;
  if (!lista || !lista.length) return;
  ui.menu(false);
  S.robo?.expressao('procurando', 1500);
  ui.aviso('Lendo as notas…', 0);
  let data;
  try {
    data = await D.lerPasta(lista, (lidas, total) => ui.aviso(`Lendo ${lidas} de ${total} notas…`, 0));
  } catch (err) {
    const semMd = err && err.message === 'sem-md';
    ui.aviso(semMd ? 'Essa pasta não tem arquivos .md. Escolha a pasta raiz do vault do Obsidian.' : 'Não deu para ler essa pasta. Tente de novo.', 5000, 'alerta');
    S.robo?.expressao('alerta', 1400);
    return;
  } finally {
    try { input.value = ''; } catch { /* nada */ }
  }
  const guardar = seguro(() => D.idbSet('vault', data), Promise.resolve(false));
  const r = await trocarVault(data, { recarga: true });
  const ok = await comPrazo(guardar, 8000);
  if (!r) return;
  const n = Array.isArray(data.files) ? data.files.length : 0;
  if (r.comparou) {
    const k = r.frescos.size;
    avisarDepoisDoPulso(`${k ? msgAtualizado(k) : 'Cérebro recarregado: nenhuma nota nova ou alterada.'}${ok ? '' : ' Não deu para guardar neste navegador.'}`, r.frescos);
  } else {
    ui.aviso(`${n} notas carregadas${ok ? ' e guardadas neste navegador' : ''}.`);
  }
}
async function verExemplo() {
  ui.menu(false);
  await comPrazo(seguro(() => D.idbDel('vault'), null), 2000);
  const r = await trocarVault(seguro(() => D.vaultExemplo(), null), { exemplo: true, recarga: true });
  if (r) ui.aviso('Mostrando o vault de exemplo.');
}

// ---------------------------------------------------------------------------
// Robô 3D e mapa em anéis (as duas visões)
// ---------------------------------------------------------------------------
function temWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}
function opcoesRobo() {
  const marcar = () => { S.ultimoToqueRobo = performance.now(); };
  return {
    reduzido: reduzido(),
    qualidade: $('#qualidade')?.checked === false ? 'baixa' : 'alta',
    onHover: (no, p) => {
      if (S.visao !== 'robo') return;
      const n = no ? atual(no) || no : null;
      ui.dica(n, n ? ponto(p) || S.ponteiro : null);
    },
    onClique: (no) => {
      marcar();
      if (!no) { aoClicarVazio(); return; }
      ui.dica(null);
      abrir(no, { origem: ponto(S.robo?.projetar(no.id)) || S.ponteiro });
    },
    onCabeca: () => { marcar(); ui.dica(null); },   // o robô já faz feliz + pulo + faíscas
    onLogo: () => { marcar(); ui.dica(null); if (S.G && S.G.core) abrir(S.G.core, { origem: ponto(S.robo?.testa()) }); },
    // Contexto WebGL perdido (reset da GPU): cai para os anéis e volta quando o 3D voltar.
    onPerdido: () => {
      if (S.visao !== 'robo') return;
      S.voltarRobo = true;
      mudarVisao('aneis');
      ui.aviso('O 3D parou. Mostrando o mapa em anéis.', 4000, 'alerta');
    },
    onRestaurado: () => {
      const voltar = S.voltarRobo && S.visao === 'aneis';
      S.voltarRobo = false;
      if (voltar) { mudarVisao('robo'); ui.aviso('O 3D voltou.'); }
    },
    onQualidade: (q) => {
      const c = $('#qualidade');
      if (c) c.checked = q !== 'baixa';
      S.aneis?.qualidade(q);   // o menu mostra um estado só para as duas visões
      if (q === 'baixa' && !S.avisouQualidade) {
        S.avisouQualidade = true;
        ui.aviso('Brilho reduzido para o 3D ficar leve neste computador.', 3600);
      }
    }
  };
}
async function carregarRobo() {
  try {
    const palco = $('#palco');
    if (!palco || !temWebGL()) return null;
    const mod = await import('./robo.js');   // traz o three (CDN); se falhar, ficam os anéis
    if (typeof mod.criarRobo !== 'function') throw new Error('robo.js sem criarRobo');
    return await mod.criarRobo(palco, opcoesRobo());
  } catch (err) {
    avisarFalha('robô 3D', err);
    return null;
  }
}
async function carregarAneis() {
  try {
    const cv = $('#aneis');
    if (!cv) return null;
    const mod = await import('./aneis.js');
    if (typeof mod.criarAneis !== 'function') throw new Error('aneis.js sem criarAneis');
    const a = await mod.criarAneis(cv, {
      reduzido: reduzido(),
      onSelecionar: (no) => {
        if (!no) { aoClicarVazio(); return; }
        const n = atual(no) || no;
        if (n.kind === 'dept') { alternarDepto(S.G?.depts[n.ci] || n.name); return; }
        abrir(n, { origem: S.ponteiro });
      },
      onHover: (no, p) => {
        if (S.visao !== 'aneis') return;
        const n = no ? atual(no) || no : null;
        ui.dica(n, n ? ponto(p) || S.ponteiro : null);
      }
    });
    return a ? blindar(a, 'anéis') : null;
  } catch (err) {
    avisarFalha('mapa em anéis', err);
    return null;
  }
}
function instalarRobo(r) {
  if (!r || S.robo) return;
  S.robo = blindar(r, 'robô');
  S.roboFalhou = false;
  const b = $('#visaoRobo');
  if (b) { b.disabled = false; b.removeAttribute('title'); }
  if (S.G) S.robo.setGrafo(S.G);
  if (!S.visaoEscolhida || S.visao === 'robo') mudarVisao('robo');
  else atualizarPausa();
  aplicarEstadoRobo();
  ligar({ recarga: false });
}
function falhaRobo() {
  if (S.robo) return;
  S.roboFalhou = true;
  const aviso = $('#semWebgl');
  if (aviso) { aviso.hidden = false; setTimeout(() => { aviso.hidden = true; }, 8000); }
  const b = $('#visaoRobo');
  if (b) { b.disabled = true; b.title = 'O 3D não ligou neste navegador.'; }
  mudarVisao('aneis');
}
function mudarVisao(v, pelaPessoa = false) {
  if (v === 'robo' && !S.robo) {
    if (pelaPessoa) ui.aviso(S.roboFalhou ? 'O 3D não ligou neste navegador. Fique com o mapa em anéis.' : 'O 3D ainda está ligando…');
    if (S.aneis) v = 'aneis';
  }
  if (v === 'aneis' && !S.aneis) {
    if (pelaPessoa) ui.aviso('O mapa em anéis não carregou.', 3200, 'alerta');
    v = 'robo';
  }
  if (pelaPessoa) { S.visaoEscolhida = true; S.voltarRobo = false; }
  const mudou = S.visao !== v;
  S.visao = v;
  ui.visao(v);
  const palco = $('#palco'), cv = $('#aneis');
  if (palco) palco.hidden = v !== 'robo';
  if (cv) cv.hidden = v !== 'aneis';
  ['visaoRobo', 'visaoAneis'].forEach((id) => $(`#${id}`)?.setAttribute('aria-pressed', String((id === 'visaoRobo') === (v === 'robo'))));
  ui.dica(null);
  atualizarPausa();
  requestAnimationFrame(() => {
    atualizarRef();
    if (v === 'robo') S.robo?.redimensionar();
    else {
      S.aneis?.redimensionar();
      if (!S.aneisCentralizado) { S.aneisCentralizado = true; S.aneis?.centralizar(); }
    }
    if (mudou && S.depto) mostrarLeque(S.depto, { silencioso: true });   // a origem do leque mudou
  });
  if (mudou) { if (v === 'robo') aplicarEstadoRobo(); else ui.feixe(null, null); }
}
function atualizarPausa() {
  const oculto = document.hidden;
  S.robo?.pausar(oculto || S.visao !== 'robo');
  S.aneis?.ativar(!oculto && S.visao === 'aneis');
  if (oculto) { if (rafFeixe) cancelAnimationFrame(rafFeixe); rafFeixe = 0; }
  else if ((S.leitorNo && estaAberto()) || (S.fluxoNo && fluxoAberto()) || (S.saudeAberta && saudeAbertaUI())) iniciarFeixe();
}

// ---------------------------------------------------------------------------
// Eventos da página
// ---------------------------------------------------------------------------
function criarUI() {
  try {
    if (typeof H.iniciarUI !== 'function') throw new Error('holo.js sem iniciarUI');
    return blindar(H.iniciarUI({
      onAbrir: (no, info) => abrir(no, { ...origemDoCartao(no), ...(info || {}) }),
      onFechar: () => fechar(),
      onDepto: (d) => alternarDepto(d),
      onBuscaEscolher: (no) => escolherBusca(no),
      onBusca: (valor) => aoBuscar(valor),
      onLink: (alvo, info) => seguir(alvo, info),
      onObsidian: (no) => abrirObsidian(no),
      onCopiar: (no) => copiarCaminho(no),
      onVisao: (v) => mudarVisao(v, true),
      onParar: () => pararPergunta(),
      onNovaConversa: () => novaConversa(),
      onFoco: (no, p) => { if (!S.leitorNo && !S.fluxoNo && roboVisivel()) S.robo.olharPara(no ? ponto(p) : null); },
      // aba Rotinas e funil
      onRotina: (no, info) => abrirRotina(no, info || {}),
      // durante uma transição (o foco volta ao item quando o funil fecha) o robô não fixa o olhar na conta
      onFocoRotina: (no) => { if (S.robo) S.robo.apontar(no && S.visao === 'robo' && !S.transitando ? no.id : null); },
      onAba: (nome) => {
        if (nome === 'rotinas') { if (S.depto) recolherLeque(); S.robo?.expressao('procurando', 700); }
        // o trilho muda de largura (220 → 252 px): com um painel aberto, o robô e o .sem-trilho são recalculados
        if (S.leitorNo || S.fluxoNo || S.saudeAberta) { enquadrarComLeitor(); const c = centroLeitor(); if (c) S.robo?.olharPara(c); }
      },
      onNotaCompleta: (no, info) => abrir(no, { ...(info || {}), leitor: true }),
      onFluxoDoLeitor: (no, info) => {
        if (!atual(no)) { ui.voltarFluxo(null); ui.aviso('A rotina saiu do vault.'); return; }
        abrirRotina(no, info || {});
      },
      onEtapa: (alvos) => marcarEtapa(alvos),
      // saúde dos sistemas (GUARDIAO.md §7)
      onSaude: (info) => alternarSaude(info || {}),
      onSaudeAtualizar: () => verificarSaudeAgora(),
      onSaudeChave: (v, opc) => guardarChaveSaude(v, opc),
      onSaudeEsquecer: () => esquecerChaveSaude(),
      onSaudeItem: (item, info) => aoItemSaude(item, info || {}),
      onFocoSaude: (item) => {
        const no = item && item.nota && S.G ? notaPorNome(item.nota) : null;
        if (S.robo) S.robo.apontar(no && no.kind === 'routine' && S.visao === 'robo' && !S.transitando ? no.id : null);
      },
      notaSaude: (nome) => { const no = S.G ? notaPorNome(nome) : null; return no ? (no.kind === 'routine' ? 'rotina' : 'nota') : null; }
    }), 'interface');
  } catch (err) {
    avisarFalha('interface', err);
    return NADA;
  }
}
function aplicarPrefs() {
  const s = $('#sinapses'), q = $('#qualidade'), g = $('#giro'), n = $('#nomes');
  if (s) s.checked = lerPref('sinapses', '1') === '1';
  if (q) q.checked = lerPref('qualidade', 'alta') !== 'baixa';
  if (g) { const v = parseFloat(lerPref('giro', '0.15')); g.value = String(Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.15); g.disabled = reduzido(); }
  if (n) n.checked = lerPref('nomes', '0') === '1';
}
// Estado do menu de Exibição aplicado no mapa em anéis (quando ele carrega e a cada troca de vault).
function aplicarExibicaoAneis() {
  const A = S.aneis;
  if (!A) return;
  A.sinapses($('#sinapses')?.checked !== false);
  A.qualidade($('#qualidade')?.checked === false ? 'baixa' : 'alta');
  A.giro($('#giro')?.value ?? 0.15);
  A.nomes(!!$('#nomes')?.checked);
  A.ocultar(S.ocultos);
}

// ---------------------------------------------------------------------------
// Sono: depois de ~1 min sem ponteiro nem tecla, com leitor, leque e pergunta fechados, o robô dorme
// ---------------------------------------------------------------------------
const SONO_MS = 60000;
let sonoT = 0;
function agendarSono() { clearTimeout(sonoT); sonoT = setTimeout(dormir, SONO_MS); }
function dormir() {
  const resp = $('#resposta');
  const ocupado = !S.robo || S.visao !== 'robo' || document.hidden || S.leitorNo || S.fluxoNo || S.saudeAberta || painelAberto() || S.depto || S.perguntando || (resp && !resp.hidden);
  if (ocupado) { agendarSono(); return; }
  S.dormindo = true;
  S.robo.base('dormindo');
}
function acordar() {
  if (S.dormindo) {
    S.dormindo = false;
    S.robo?.base(baseRepouso());
    S.robo?.expressao('surpreso', 500);
  }
  agendarSono();
}
function observarOculto(el, fn) {
  if (!el || typeof MutationObserver !== 'function') return;
  new MutationObserver(() => fn(el.hidden)).observe(el, { attributes: true, attributeFilter: ['hidden'] });
}

// ---------------------------------------------------------------------------
// Saúde dos sistemas (GUARDIAO.md §7): o robô garante as rotinas. O js/saude.js lê o saude.painel() do Guardião
// (claude.ai: conector Supabase; arquivo baixado: GET com a chave de leitura; teste local: api/saude). Aqui: o chip
// e o painel (pelo holo.js), a cor da cúpula, o robô reagindo aos incidentes e a ferramenta ver_saude.
// Import dinâmico: se o js/saude.js falhar, o resto da página segue igual e o chip diz "Saúde indisponível".
// ---------------------------------------------------------------------------
const SA = {
  motor: null, dados: null, estado: 'carregando', info: {},
  abertos: null,   // Map id → incidente aberto na leitura anterior (null = ainda não houve leitura com dado)
  tom: null,       // 'atencao' | 'falha' | null (cor da cúpula e o olhar de vez em quando para o chip)
  olharT: 0,
  resumo: (o) => resumoSaude(o),  // teste local: o que a ferramenta ver_saude devolve
  olhar: () => olharSaude()        // teste local: o olhar de vez em quando para o chip, na hora
};
S.saude = SA;   // teste local: window.__cerebro.saude.motor.atualizar() (só com ?debug)
const ROT_SAUDE = { ok: 'Em dia', atencao: 'Atenção', falha: 'Falha', sem_dado: 'Sem dado', desligado: 'Desligado' };
const chaveNome = (s) => seguro(() => D.norm(String(s || '')), String(s || '').toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
function nomeSaudeApp(i) {
  if (!i) return '';
  const nome = String(i.nome || i.id || ''), sis = String(i.sistema || '');
  const a = seguro(() => D.norm(nome), nome.toLowerCase()).trim(), b = seguro(() => D.norm(sis), sis.toLowerCase()).trim();
  return b && a !== b && !a.startsWith(`${b} `) ? `${sis} · ${nome}` : nome;
}
// nota do vault com esse nome (itens[].nota = nome exato da nota: a rotina em Rotinas/ ou o projeto)
function notaPorNome(nome) {
  if (!S.G || !nome) return null;
  const alvo = chaveNome(nome);
  return S.G.nodes.find((n) => n.kind !== 'dept' && !n.virtual && chaveNome(n.name) === alvo) || seguro(() => D.seguirLink(S.G, String(nome)), null);
}

async function iniciarSaude() {
  try {
    const mod = await import('./saude.js');
    if (typeof mod.criarSaude !== 'function') throw new Error('saude.js sem criarSaude');
    SA.motor = blindar(mod.criarSaude({ onDados: aoDadosSaude, onEstado: aoEstadoSaude }), 'saúde');
  } catch (err) {
    avisarFalha('saúde dos sistemas', err);
    SA.estado = 'indisponivel';
    ui.saude(null, { estado: 'indisponivel', motivo: 'O painel de saúde não carregou nesta página.' });
  }
}
function infoMotor() {
  const m = SA.motor;
  if (!m) return {};
  return { modo: m.modo, usaChave: m.usaChave === true, temChave: m.temChave() === true,
           chaveLembrada: typeof m.chaveLembrada === 'function' && m.chaveLembrada() === true };
}
function aoEstadoSaude(estado, info = {}) {
  SA.estado = estado;
  SA.info = info || {};
  ui.saude(undefined, { estado, motivo: info.motivo || '', codigo: info.codigo || '', ...infoMotor() });
}
// meta.recebidoEm = quando chegou esta leitura boa: separa "o agendador do Guardião parou" (verificado_em velho numa
// leitura nova) de "o painel não conseguiu ler" (nenhuma leitura nova)
function aoDadosSaude(d, meta = {}) {
  SA.dados = d || null;
  SA.recebidoEm = d && Number.isFinite(meta.recebidoEm) ? meta.recebidoEm : (d ? Date.now() : null);
  ui.saude(SA.dados, { ...infoMotor(), recebidoEm: SA.recebidoEm });
  saudeNoGrafo();
  aplicarTomSaude();
  reagirIncidentes(SA.dados);
}
// Rotinas com atenção ou falha: acesas no cérebro com o painel Saúde aberto.
function saudeNoGrafo() {
  let ids = null;
  if (SA.dados && S.G) {
    for (const i of SA.dados.itens) {
      if (i.status !== 'falha' && i.status !== 'atencao') continue;
      const no = notaPorNome(i.nota);
      if (no) (ids || (ids = new Set())).add(no.id);
    }
  }
  S.saudeIds = ids;
  if (S.saudeAberta) aplicarDestaque();
}
// Cúpula: atenção = leve tom âmbar; falha = tom vermelho. Sem dados = normal (não assusta).
function aplicarTomSaude() {
  const g = SA.dados && SA.dados.geral;
  SA.tom = g && (g.status === 'falha' || g.status === 'atencao') ? g.status : null;
  S.robo?.saude(SA.tom || 'ok');
  agendarOlharSaude();
}
// De vez em quando, com algo errado, o robô olha para o chip: preocupado (atenção) ou em alerta (falha).
function agendarOlharSaude() {
  clearTimeout(SA.olharT);
  SA.olharT = 0;
  if (!SA.tom) return;
  SA.olharT = setTimeout(olharSaude, (SA.tom === 'falha' ? 16000 : 26000) + Math.random() * 9000);
}
function livreParaReagir() {
  return !!S.robo && roboVisivel() && !S.dormindo && !S.perguntando && !S.transitando && !S.leitorNo && !S.fluxoNo && !S.saudeAberta && !S.depto
    && !(M.estado === 'ligado' && M.presente);
}
function olharSaude() {
  SA.olharT = 0;
  if (!SA.tom) return;
  if (livreParaReagir()) {
    const R = S.robo, c = ponto(ui.centroChip());
    if (c) R.olharPara(c);
    R.expressao(SA.tom === 'falha' ? 'alerta' : 'preocupado', 1500);
    setTimeout(() => { if (!S.leitorNo && !S.fluxoNo && !S.saudeAberta) S.robo?.olharPara(null); }, 1500);
  }
  agendarOlharSaude();
}
// Incidente novo com a página aberta: surpreso + clarão na cúpula + aviso. Incidente fechado: feliz.
// Na primeira leitura nada é "novo" (já estava aberto antes de a página abrir).
function reagirIncidentes(d) {
  if (!d) { SA.abertos = null; return; }
  const atual = new Map(d.incidentes.abertos.map((i) => [i.id, i]));
  const antes = SA.abertos;
  SA.abertos = atual;
  if (!antes) return;
  const novos = [...atual.values()].filter((i) => !antes.has(i.id) || (antes.get(i.id).status === 'atencao' && i.status === 'falha'));
  const fechados = [...antes.values()].filter((i) => !atual.has(i.id));
  if (novos.length) reagirIncidenteNovo(novos, d);
  else if (fechados.length) reagirIncidenteFechado(fechados, d);
}
// "BI Compras · Sync rapidas": o nome sozinho se repete entre sistemas (Sync rapidas, Conferência com o WinThor…)
function nomeIncidente(inc, d) {
  if (inc.nome) return nomeSaudeApp(inc);
  const i = d && d.itens.find((x) => x.id === inc.alvo_id);
  return i ? nomeSaudeApp(i) : String(inc.alvo_id || 'um item vigiado');
}
function reagirIncidenteNovo(lista, d) {
  const inc = lista.find((i) => i.status === 'falha') || lista[0];
  const falha = inc.status === 'falha';
  acordar();
  const R = S.robo;
  if (R) {
    R.expressao('surpreso', 900);
    // só com o robô na tela: com a visão em anéis ele está pausado e o clarão ficaria guardado para piscar à toa depois
    if (roboVisivel()) R.clarao(falha ? 'falha' : 'atencao');
    const c = ponto(ui.centroChip());
    if (c && !S.leitorNo && !S.fluxoNo && !S.saudeAberta) {
      R.olharPara(c);
      setTimeout(() => { if (!S.leitorNo && !S.fluxoNo && !S.saudeAberta) S.robo?.olharPara(null); }, 2000);
    }
    setTimeout(() => S.robo?.expressao(falha ? 'alerta' : 'preocupado', 1600), 900);
  }
  const mais = lista.length > 1 ? ` (e mais ${lista.length - 1})` : '';
  ui.aviso(`${falha ? 'Falha nova' : 'Atenção nova'}: ${nomeIncidente(inc, d)}${mais}. ${inc.resumo || ''}`.trim(), 9000, falha ? 'alerta' : 'rever');
}
function reagirIncidenteFechado(lista, d) {
  acordar();
  S.robo?.expressao('feliz', 1800);
  const mais = lista.length > 1 ? ` (e mais ${lista.length - 1})` : '';
  ui.aviso(`Voltou ao normal: ${nomeIncidente(lista[0], d)}${mais}.`, 5000, 'ok');
}

// Chip: abre ou fecha o painel Saúde (no mesmo lugar do leitor; o robô vai para a esquerda e fica "lendo").
function alternarSaude(info = {}) {
  if (S.saudeAberta || saudeAbertaUI()) { fechar(); return; }
  ui.dica(null);
  S.intencao = 'abrir';
  transicao(async () => {
    S.transitando = true;
    try { await executarAbrirSaude(info); } finally { S.transitando = false; }
  });
}
async function executarAbrirSaude(opc = {}) {
  if (S.saudeAberta && saudeAbertaUI()) return;
  const R = S.robo;
  const leitorJa = !!S.leitorNo && estaAberto(), fluxoJa = !!S.fluxoNo && fluxoAberto();
  if (!leitorJa && !fluxoJa) { guardarFoco(); suspenderLeque(); }
  // leitor ou funil aberto: a nota é solta (apaga devagar) e o painel Saúde entra no lugar com o glitch
  const anterior = S.leitorNo || S.fluxoNo;
  if (anterior) R?.devolver(anterior.id, null);
  if (S.fluxoNo) ui.rotinas(S.rotinas, null);
  S.leitorNo = null; S.fluxoNo = null; S.voltarFluxo = null; S.etapaIds = null;
  S.aneis?.selecionar(null);
  S.saudeAberta = true;
  aplicarDestaque();
  R?.expressao('procurando', 900);
  enquadrarComLeitor();
  R?.base('lendo');
  await comPrazo(ui.abrirSaude({ origem: ponto(opc.origem) || ponto(ui.centroChip()) || estimarCentro() }), 3500);
  if (!S.saudeAberta) return;
  const r = rectLeitor();
  if (r) { S.ultimoRect = r; S.ultimoTam = tamTela(); }
  if (R) { R.base(baseRepouso()); const c = centroDe(r); if (c) R.olharPara(c); }
  if (!document.hidden) iniciarFeixe();
  focarLeitor('#saude', '#sFechar');
}
// Linha do painel: rotina abre o funil dela; sistema abre a nota do projeto no leitor.
function aoItemSaude(item, info = {}) {
  const no = item && item.nota ? notaPorNome(item.nota) : null;
  if (!no) { ui.aviso(`A nota "${(item && (item.nota || item.nome)) || ''}" não está no vault aberto.`, 3600); return; }
  if (no.kind === 'routine') abrirRotina(no, { origem: info.origem });
  else abrir(no, { origem: info.origem, leitor: true });
}
function verificarSaudeAgora() {
  if (!SA.motor) { ui.aviso('O painel de saúde não carregou nesta página.', 3200, 'alerta'); return; }
  SA.motor.atualizar({ manual: true });
  S.robo?.expressao('procurando', 900);
}
function guardarChaveSaude(v, opc = {}) {
  if (!SA.motor) return;
  const r = SA.motor.guardarChave(v, { lembrar: opc.lembrar === true });
  if (!r || r.ok !== true) return;
  const txt = r.onde === 'computador' ? 'Chave lembrada neste computador. Lendo a saúde…'
    : r.onde === 'aba' ? (opc.lembrar === true ? 'Não deu para lembrar a chave neste computador: ela vale para esta aba. Lendo a saúde…' : 'Chave guardada só nesta aba. Lendo a saúde…')
    : 'Não deu para guardar a chave neste navegador: ela vale até fechar a página.';
  ui.aviso(txt, 3600, r.onde ? 'ok' : undefined);
}
function esquecerChaveSaude() {
  SA.motor?.esquecerChave();
  ui.aviso('Chave esquecida.', 3000);
}

// Pergunte ao cérebro: ver_saude devolve o saude.painel() resumido (sem as consultas uma a uma).
function idadeSaudeMin(d) {
  const t = d && d.verificado_em ? new Date(d.verificado_em).getTime() : NaN;
  return Number.isFinite(t) ? Math.round((Date.now() - t) / 60000) : null;
}
// Datas do banco vêm em UTC ("2026-10-14T05:51:17+00:00" = 02:51 em Brasília): para o Claude, "hoje 02:51",
// "ontem 23:50" ou "12/10 02:50", sempre no horário de Brasília.
const FMT_SP = seguro(() => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), null);
function partesSP(t) {
  if (!FMT_SP || !Number.isFinite(t)) return null;
  const p = {};
  for (const x of FMT_SP.formatToParts(new Date(t))) p[x.type] = x.value;
  return p;
}
function quandoSP(v) {
  const t = v ? new Date(v).getTime() : NaN;
  const p = partesSP(t);
  if (!p) return undefined;
  const dia = (q) => `${q.year}-${q.month}-${q.day}`;
  const hoje = partesSP(Date.now()), ontem = partesSP(Date.now() - 864e5), amanha = partesSP(Date.now() + 864e5);
  const pre = dia(p) === dia(hoje) ? 'hoje' : dia(p) === dia(ontem) ? 'ontem' : dia(p) === dia(amanha) ? 'amanhã' : `${p.day}/${p.month}`;
  return `${pre} ${p.hour}:${p.minute}`;
}
// Mesma regra do chip (holo.js): leitura parada = o painel não leu; verificação atrasada = leitura nova, verificado_em velho.
function estadoLeituraSaude() {
  const d = SA.dados, r = SA.recebidoEm, agora = Date.now();
  const t = d && d.verificado_em ? new Date(d.verificado_em).getTime() : NaN;
  const parada = !!d && (SA.estado === 'erro' || SA.estado === 'indisponivel' || (Number.isFinite(r) && agora - r > 2 * 60000 && !document.hidden));
  const atrasada = !parada && Number.isFinite(r) && Number.isFinite(t) && (r - t) / 60000 > 20;
  return { parada, atrasada, lido_em: Number.isFinite(r) ? quandoSP(r) : undefined };
}
function resumoSaude({ soProblemas = false } = {}) {
  const d = SA.dados;
  if (!d) return { disponivel: false, motivo: (SA.info && SA.info.motivo) || 'A saúde dos sistemas ainda não foi lida nesta página.' };
  const g = d.geral, idade = idadeSaudeMin(d), leitura = estadoLeituraSaude();
  const tg = d.telegram || {};
  const inc = (i) => ({ nome: nomeIncidente(i, d), situacao: ROT_SAUDE[i.status] || i.status, resumo: i.resumo || undefined, aberto_em: quandoSP(i.aberto_em), fechado_em: quandoSP(i.fechado_em), nova_tentativa_em: quandoSP(i.correcao_pedida_em), resultado_da_tentativa: i.correcao_resultado === 'pedido' ? (i.fechado_em ? 'pedida, a VM não chegou a responder' : 'pedida, esperando a VM responder') : (i.correcao_resultado || undefined) });
  return {
    disponivel: true,
    verificado_em: quandoSP(d.verificado_em),
    minutos_desde_a_verificacao: idade,
    lido_em: leitura.lido_em,
    leitura_ok: !leitura.parada,
    verificacao_atrasada: leitura.atrasada,
    geral: { situacao: ROT_SAUDE[g.status] || g.status, em_dia: g.ok, atencao: g.atencao, falha: g.falha, sem_dado: g.sem_dado, total: g.total },
    telegram_configurado: !!tg.configurado,
    telegram_ultimo_envio_ok: tg.ultima_tentativa_ok === false ? false : tg.ultima_tentativa_ok === true ? true : undefined,
    telegram_erro: tg.ultima_tentativa_ok === false ? (tg.ultimo_erro || 'o último envio falhou') : undefined,
    telegram_ultimo_aviso_entregue_em: quandoSP(tg.ultimo_aviso_em),
    vm_srv_ia: d.vm && d.vm.em ? { ultimo_batimento_em: quandoSP(d.vm.em) } : 'o vigia da VM ainda não mandou batimento',
    itens: d.itens.filter((i) => !soProblemas || i.status === 'falha' || i.status === 'atencao').slice(0, 60).map((i) => ({
      nome: nomeSaudeApp(i), tipo: i.tipo, situacao: ROT_SAUDE[i.status] || i.status, resumo: i.resumo || undefined,
      ultima_execucao: quandoSP(i.ultima_execucao), proxima_execucao: quandoSP(i.proxima_execucao), nota: i.nota || undefined
    })),
    incidentes_abertos: d.incidentes.abertos.map(inc),
    ultimos_incidentes: d.incidentes.recentes.slice(0, 8).map(inc),
    legenda: 'Em dia = conferido e certo; Atenção = rodou com atraso, queda de linhas, painel com dado velho ou conferência duvidosa; Falha = não rodou ou deu erro; Sem dado = o Guardião ainda não tem como conferir; Desligado = sem execução automática. Datas já no horário de Brasília (hoje/ontem HH:MM). leitura_ok = false: o painel não conseguiu ler a saúde desde lido_em (não é o Guardião que parou); verificacao_atrasada = true: a leitura chegou, mas o agendador do Guardião não verifica há mais de 20 min.'
  };
}
function reagirVerSaude() {
  ui.resposta.status('Conferindo a saúde das rotinas e dos sistemas…');
  S.robo?.expressao('procurando', 1100);
}
// Sem ferramentas na página: um resumo curto da saúde vai junto com as notas.
function textoSaude() {
  const d = SA.dados;
  if (!d) return '';
  const g = d.geral, idade = idadeSaudeMin(d), leitura = estadoLeituraSaude();
  const linhas = d.itens.filter((i) => i.status !== 'desligado').slice(0, 30).map((i) => `- ${nomeSaudeApp(i)}: ${ROT_SAUDE[i.status] || i.status}${i.resumo ? ` — ${i.resumo}` : ''}`);
  const ab = d.incidentes.abertos.map((i) => `- ${nomeIncidente(i, d)} (${ROT_SAUDE[i.status] || i.status}): ${i.resumo || ''}`);
  const aviso = leitura.parada ? ` ATENÇÃO: o painel não conseguiu ler a saúde desde ${leitura.lido_em || 'a abertura'}; isto é a última leitura.` : leitura.atrasada ? ' ATENÇÃO: a verificação do Guardião está atrasada (o agendador dele pode ter parado).' : '';
  return `\nSaúde dos sistemas agora (Guardião, verificado ${idade != null ? `há ${idade} min` : 'sem horário'}).${aviso} ${g.ok} em dia, ${g.atencao} com atenção, ${g.falha} com falha, ${g.sem_dado} sem dado.\n${linhas.join('\n')}${ab.length ? `\nIncidentes abertos:\n${ab.join('\n')}` : ''}\n`;
}

// ---------------------------------------------------------------------------
// Modo Mãos (MAOS.md): a câmera vira mouse. O motor (js/maos.js) e as camadas (js/efeitos-maos.js) só são
// importados quando a pessoa liga, e o MediaPipe só vem com o motor. Se um deles falhar, o resto da página
// segue igual. Nunca liga sozinho ao abrir a página; só "esconder vídeo" e "ajuda já vista" ficam guardadas.
// ---------------------------------------------------------------------------
const MAOS_OCULTO_MS = 120000;                  // aba escondida por mais de 2 min: desliga a câmera
// "esconder vídeo": a mesma chave e os mesmos valores do js/efeitos-maos.js ('visivel' | 'oculto'); a "ajuda já
// vista" (chave 'maos-ajuda' = 'vista') a própria camada de efeitos guarda e mostra sozinha na primeira vez
const PREF_MAOS_VIDEO = 'maos-video';
const TXT_MAOS = {
  ligar: 'Mexa a mão na frente da câmera e o cérebro segue: o cursor anda com os dedos e a pinça (polegar com indicador) abre o que está embaixo. Para fechar, como o Esc, abra a mão e segure parada.',
  simular: 'Simulador (só no teste local): o mouse faz o papel da mão. Segure P para a pinça, A para a mão aberta, F para o punho, J para o joinha, V para a vitória; as setas deslizam.',
  artifact: 'Os gestos usam a câmera, e o claude.ai não libera a câmera para páginas publicadas. Abra o arquivo baixado (Cerebro da Lube.html) no Chrome ou no Edge.',
  'sem-camera': 'Não encontrei nenhuma câmera neste computador. Conecte uma webcam e tente de novo.',
  negado: 'Você não liberou a câmera. Clique no cadeado da barra de endereço e permita a câmera.',
  'em-uso': 'A câmera está sendo usada por outro programa (Teams, Zoom…). Feche e tente de novo.',
  'sem-modelo': 'Não consegui baixar o reconhecimento de mãos. Confira a internet.',
  'sem-gpu': 'Este computador não conseguiu rodar o reconhecimento de mãos. Atualize o Chrome ou o Edge e tente de novo.',
  'sem-suporte': 'Este navegador não liga a câmera nesta página. Abra o arquivo baixado no Chrome ou no Edge.',
  erro: 'Não deu para ligar o controle pelas mãos. Tente de novo.'
};
// códigos de erro do motor (MAOS.md §3) que têm frase própria; o resto vira "erro"
const ERROS_MAOS = new Set(['artifact', 'sem-camera', 'negado', 'em-uso', 'sem-modelo', 'sem-gpu', 'sem-suporte']);
const codigoMaos = (c) => (ERROS_MAOS.has(c) ? c : 'erro');
const M = {
  estado: 'desligado',     // desligado | preparando (cartão de ligar aberto) | carregando | ligado
  seq: 0,                  // cada ligar/desligar/erro invalida o pedido anterior (import lento, câmera que chega tarde)
  fx: null, motor: null, modFx: null, modMotor: null, ctl: null, videoEl: null,
  video: lerPref(PREF_MAOS_VIDEO, 'visivel') !== 'oculto', ajuda: false,
  presente: false, agarrando: false, campo: false, desligouOculto: false, ocultoT: 0, avisoProgresso: false,
  cursor: { x: 0, y: 0, ok: false }, cliente: { x: 0, y: 0 }, campoArg: { x: 0, y: 0, raio: 110, forca: 0 },
  ultimaAcao: { nome: '', t: 0 }
};
S.maos = M;   // teste local: window.__cerebro.maos

const maosLigado = () => M.estado === 'ligado' || M.estado === 'carregando';
// claude.ai: a página publicada não tem câmera (sem capability e o CSP barra o WASM e o modelo)
function emArtifact() {
  try { return !!(window.claude && typeof window.claude.use === 'function'); } catch { return false; }
}
// ?maos=simular: mão de mentira guiada pelo mouse, só no teste local (localhost ou arquivo aberto do disco)
function maosSimular() {
  try { return (ehLocal() || location.protocol === 'file:') && /[?&]maos=simular\b/.test(location.search); } catch { return false; }
}
function visivel(sel) {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!el || el.hidden || (el.closest && el.closest('[hidden]')) || !el.getClientRects().length) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
}
const doisQuadros = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

const ROT_MAOS_BTN = 'Controle pelas mãos (câmera)';
function botaoMaos(estado) {
  const b = $('#maosBtn');
  $('#app')?.classList.toggle('maos-ligado', estado === 'ligado');
  if (!b) return;
  const ligado = estado === 'ligado' || estado === 'carregando';
  b.dataset.estado = estado;
  b.setAttribute('aria-pressed', String(ligado));
  // botão de alternância: o nome é fixo e o estado vai no aria-pressed (nome que muda + "pressionado" se contradiz)
  b.setAttribute('aria-label', ROT_MAOS_BTN);
  b.title = ligado ? 'Desligar o controle pelas mãos (a câmera desliga)' : 'Controlar com as mãos pela câmera';
}

// Cartão do app (#maosInfo): o texto do §0 no claude.ai e, sem a camada de efeitos, o cartão de ligar e os erros.
function infoMaos(texto, { tom = '', ligar = false, privado = true } = {}) {
  const c = $('#maosInfo'), t = $('#maosInfoTxt'), bl = $('#maosInfoLigar'), pv = c && c.querySelector('.maos-privado');
  if (!c) { ui.aviso(texto, 6000, tom || undefined); return; }
  if (t) t.textContent = texto;
  if (tom) c.dataset.tom = tom; else delete c.dataset.tom;
  if (pv) pv.hidden = !privado;
  if (bl) { bl.hidden = !ligar; bl.textContent = ligar && tom ? 'Tentar de novo' : 'Ligar câmera'; }
  c.hidden = false;
  try { (ligar && bl ? bl : $('#maosInfoFechar'))?.focus({ preventScroll: true }); } catch { /* nada */ }
}
function fecharInfoMaos() {
  const c = $('#maosInfo');
  if (!c || c.hidden) return;
  const tinhaFoco = c.contains(document.activeElement);
  c.hidden = true;
  if (tinhaFoco) { try { $('#maosBtn')?.focus({ preventScroll: true }); } catch { /* nada */ } }
}

function coresMaos() {
  const cs = getComputedStyle(document.documentElement);
  const tk = (n) => (cs.getPropertyValue(n) || '').trim();
  return { holo: tk('--holo'), azul: tk('--azul'), vermelho: tk('--vermelho'), ok: tk('--ok'), rever: tk('--rever') };
}
// Um clique duplo no mesmo botão (ou o mesmo pedido chegando duas vezes) não liga/desliga duas vezes.
function acaoMaos(nome, fn) {
  const t = performance.now(), u = M.ultimaAcao;
  if (u.nome === nome && t - u.t < 160) return;
  M.ultimaAcao = { nome, t };
  try { fn(); } catch (err) { avisarFalha(`mãos: ${nome}`, err); }
}
// Botões dos cartões da camada de efeitos (#maosLigar, #maosCam, #maosAjuda). O vídeo e a ajuda ela mesma já
// trocou na tela; aqui só fica o estado (e a preferência do vídeo).
function retornosEfeitos() {
  return {
    onLigar: () => acaoMaos('ligar', ligarCamera),
    onDesligar: () => acaoMaos('desligar', () => desligarMaos()),
    onCancelar: () => acaoMaos('cancelar', cancelarMaos),   // "Agora não", "×", "Fechar", "Entendi" e "Cancelar"
    onVideo: (v) => { M.video = v !== false; gravarPref(PREF_MAOS_VIDEO, M.video ? 'visivel' : 'oculto'); },
    onAjuda: (v) => { M.ajuda = !!v; }
  };
}
// O vídeo da câmera: o que a camada de efeitos mostra no cartão dela (ela o tira do #app e põe no cartão);
// sem ela, o #maosVideo escondido do index.html (ou um novo, se a camada já o levou embora junto com o cartão).
function videoMaosEl() {
  const v = M.fx ? M.fx.video : null;
  if (typeof HTMLVideoElement === 'function' && v instanceof HTMLVideoElement) return v;
  let el = $('#maosVideo');
  if (!el || el.tagName !== 'VIDEO') {
    el = document.createElement('video');
    el.id = 'maosVideo';
    el.className = 'maos-video';
    el.muted = true; el.playsInline = true;
    el.setAttribute('muted', ''); el.setAttribute('playsinline', ''); el.setAttribute('aria-hidden', 'true');
    ($('#app') || document.body).appendChild(el);
  }
  return el;
}
async function carregarEfeitos(seq) {
  if (M.fx) return M.fx;
  try {
    const mod = M.modFx || (M.modFx = await import('./efeitos-maos.js'));
    if (seq !== M.seq) return null;
    if (typeof mod.criarEfeitos !== 'function') throw new Error('efeitos-maos.js sem criarEfeitos');
    const fx = mod.criarEfeitos({ reduzido, cores: coresMaos(), ...retornosEfeitos() });   // reduzido como função: vale ao vivo
    M.fx = fx && typeof fx === 'object' ? blindar(fx, 'efeitos das mãos') : null;
    return M.fx;
  } catch (err) {
    avisarFalha('efeitos das mãos', err);
    return null;
  }
}
function destruirEfeitos() {
  const fx = M.fx;
  M.fx = null;
  M.ajuda = false;
  try { fx?.destruir(); } catch { /* nada */ }
}
function ajudaMaos(v) {
  M.ajuda = !!v;
  M.fx?.ajuda(M.ajuda);
}

// Botão "Mãos": desligado → cartão de ligar; cartão aberto → fecha; ligado → desliga (a câmera para).
function aoBotaoMaos() {
  if (maosLigado()) { desligarMaos(); return; }
  if (M.estado === 'preparando') { cancelarMaos(); return; }
  const c = $('#maosInfo');
  if (c && !c.hidden) { fecharInfoMaos(); destruirEfeitos(); return; }
  abrirMaos();
}
async function abrirMaos() {
  if (emArtifact()) { infoMaos(TXT_MAOS.artifact, { privado: false }); return; }
  if (M.estado !== 'desligado') return;
  const seq = ++M.seq;
  M.estado = 'preparando';
  botaoMaos('preparando');
  const fx = await carregarEfeitos(seq);
  if (seq !== M.seq) return;
  fx?.estado('ligar', { simular: maosSimular() });
  // sem a camada de efeitos (ou se ela não mostrou o cartão de ligar), o cartão do app explica e liga
  doisQuadros(() => {
    if (seq !== M.seq || M.estado !== 'preparando' || visivel('#maosLigar')) return;
    infoMaos(maosSimular() ? TXT_MAOS.simular : TXT_MAOS.ligar, { ligar: true });
  });
}
// Fecha o cartão de ligar sem ligar (ou desiste no meio do carregamento). Com as mãos já ligadas, não mexe.
function cancelarMaos() {
  if (M.estado === 'ligado') return;
  desligarMaos({ aviso: false });
}

async function ligarCamera() {
  if (maosLigado()) return;
  if (emArtifact()) { erroMaos('artifact', ++M.seq); return; }
  const seq = ++M.seq;
  fecharInfoMaos();
  M.estado = 'carregando';
  botaoMaos('carregando');
  const simular = maosSimular();
  await carregarEfeitos(seq);
  if (seq !== M.seq) return;
  if (!M.fx) progressoMaos('camera');   // sem a camada de efeitos, o progresso vai no aviso
  let mod;
  try {
    mod = M.modMotor || (M.modMotor = await import('./maos.js'));
    if (typeof mod.iniciarMaos !== 'function') throw new Error('maos.js sem iniciarMaos');
  } catch (err) {
    if (seq !== M.seq) return;
    avisarFalha('motor das mãos', err);
    erroMaos('erro', seq);
    return;
  }
  if (seq !== M.seq) return;
  let motor = null;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  M.ctl = ctl;
  M.videoEl = videoMaosEl();
  try {
    motor = await mod.iniciarMaos({
      video: M.videoEl,
      simular,
      sinal: ctl ? ctl.signal : undefined,   // desligar no meio do carregamento solta a câmera na hora
      onQuadro: (q) => { if (seq === M.seq) aoQuadroMaos(q); },
      onGesto: (nome, dados) => { if (seq === M.seq) aoGestoMaos(nome, dados); },
      onEstado: (estado, detalhe) => { if (seq === M.seq) aoEstadoMaos(estado, detalhe, seq); },
      onProgresso: (fase, pct) => { if (seq === M.seq) progressoMaos(fase, pct); }
    });
  } catch (err) {
    if (seq !== M.seq) return;
    const codigo = codigoMaos(err && (err.codigo || err.code));
    if (codigo === 'erro') avisarFalha('motor das mãos', err);
    erroMaos(codigo, seq);
    return;
  }
  if (seq !== M.seq) { try { motor?.parar(); } catch { /* nada */ } return; }   // desligaram enquanto a câmera abria
  if (!motor || typeof motor !== 'object') { erroMaos('erro', seq); return; }
  M.motor = blindar(motor, 'motor das mãos');
  M.estado = 'ligado';
  botaoMaos('ligado');
  M.fx?.mostrarVideo(M.video);
  reposicionarLequeMaos();
  if (document.hidden) maosVisibilidade();
  // a ajuda dos gestos aparece sozinha na primeira vez (a camada de efeitos cuida disso e lembra); com a camada,
  // o cartão de ligar e a ajuda já explicam (um aviso aqui ficaria escondido atrás deles)
  if (!M.fx) ui.aviso(simular ? 'Simulador das mãos ligado: o mouse é a mão. P pinça, A mão aberta, F punho, J joinha, V vitória.' : 'Mãos ligadas. Mostre a mão aberta para a câmera.', simular ? 5200 : 4200, 'ok');
  else if (M.avisoProgresso) ui.aviso('');
  M.avisoProgresso = false;
}
// Progresso do carregamento: a camada de efeitos mostra no cartão de ligar; sem ela, vai no aviso (fica até o fim).
function progressoMaos(fase, pct) {
  if (M.fx) { M.fx.progresso(fase, pct); return; }
  const f = seguro(() => D.norm(String(fase || '')), '');
  const n = Number(pct);
  const pc = Number.isFinite(n) && n > 0 ? ` ${Math.round(Math.min(100, n <= 1 ? n * 100 : n))}%` : '';
  const texto = /camera/.test(f) ? 'Abrindo a câmera…'
    : /model|reconhec|wasm|baix|carreg/.test(f) ? `Carregando o reconhecimento de mãos (8 MB, só na primeira vez)…${pc}`
      : /mao|pronto|mostr/.test(f) ? 'Mostre a mão aberta para a câmera.' : 'Ligando as mãos…';
  M.avisoProgresso = true;
  ui.aviso(texto, 0);
}
// Erro ao ligar (ou a câmera caiu): a câmera para, a camada de efeitos mostra a frase no cartão dela; se ela não
// mostrou, o cartão do app mostra.
function erroMaos(codigo, seq = M.seq, detalhe = null) {
  // o motor avisa pelo onEstado e também recusa a promessa: só o primeiro aviso do pedido atual vale, e daqui em
  // diante o que o motor antigo ainda mandar (o "parado" do fim) é ignorado
  if (seq !== M.seq) return;
  const meu = ++M.seq;
  codigo = codigoMaos(codigo);
  // a frase do motor vale quando ele explica o caso (ex.: "A câmera foi desligada ou desconectada.")
  const texto = (detalhe && typeof detalhe.mensagem === 'string' && detalhe.mensagem.trim()) || TXT_MAOS[codigo];
  pararMotorMaos();
  limparMaosNaTela();
  M.estado = 'desligado';
  botaoMaos('desligado');
  if (M.avisoProgresso) { M.avisoProgresso = false; ui.aviso(''); }
  S.robo?.expressao('alerta', 1200);
  M.fx?.estado('erro', { ...(detalhe && typeof detalhe === 'object' ? detalhe : {}), codigo, mensagem: texto });
  const novaTentativa = codigo !== 'artifact' && codigo !== 'sem-suporte';
  doisQuadros(() => {
    if (M.seq !== meu || maosLigado() || visivel('#maosLigar')) return;
    destruirEfeitos();
    infoMaos(texto, { tom: 'alerta', ligar: novaTentativa, privado: codigo !== 'artifact' });
  });
}
function aoEstadoMaos(estado, detalhe, seq) {
  if (estado === 'erro') { erroMaos(detalhe && detalhe.codigo, seq, detalhe); return; }
  M.fx?.estado(estado, detalhe);
}
function pararMotorMaos() {
  const m = M.motor, ctl = M.ctl;
  M.motor = null;
  M.ctl = null;
  try { ctl?.abort(); } catch { /* nada */ }
  try { m?.parar(); } catch { /* nada */ }
  // garantia: a câmera desliga mesmo se o motor não parou as trilhas (ou nem chegou a existir)
  const v = M.videoEl || $('#maosVideo');
  M.videoEl = null;
  try {
    const s = v && v.srcObject;
    if (s && typeof s.getTracks === 'function') s.getTracks().forEach((t) => { try { t.stop(); } catch { /* nada */ } });
    if (v) { try { v.pause(); } catch { /* nada */ } v.srcObject = null; }
  } catch { /* nada */ }
  clearTimeout(M.ocultoT);
  M.ocultoT = 0;
}
// O cartão da câmera é obstáculo do leque (obstaculos()), mas o leque só se recalcula no resize: quando o cartão
// entra (depois do maosEntra de 0,42 s, porque o retângulo inclui o transform) ou sai, os cartões que caíram
// embaixo dele deslizam para as vagas livres.
let lequeMaosT = 0;
function reposicionarLequeMaos() {
  clearTimeout(lequeMaosT);
  lequeMaosT = setTimeout(() => { if (S.depto) mostrarLeque(S.depto, { silencioso: true, reposicionar: true }); }, 450);
}
function limparMaosNaTela() {
  document.querySelectorAll('.mao-hover').forEach((el) => el.classList.remove('mao-hover'));
  const R = S.robo;
  if (R) { R.campoMao(null); R.agarrar(null); if (M.presente) R.olharEmVolta(); }
  M.presente = false; M.agarrando = false; M.campo = false; M.cursor.ok = false;
}
function desligarMaos({ aviso = true } = {}) {
  const estava = M.estado;
  M.seq++;
  pararMotorMaos();
  destruirEfeitos();
  fecharInfoMaos();
  limparMaosNaTela();
  M.estado = 'desligado';
  botaoMaos('desligado');
  if (estava === 'ligado' || estava === 'carregando') reposicionarLequeMaos();
  if (aviso && (estava === 'ligado' || estava === 'carregando')) ui.aviso('Mãos desligadas. A câmera foi desligada.', 3000);
  else if (M.avisoProgresso) ui.aviso('');
  M.avisoProgresso = false;
}
// Aba escondida: o motor pausa sozinho (e volta sozinho); passou de 2 min escondida, a câmera desliga.
function maosVisibilidade() {
  if (document.hidden) {
    if (!maosLigado()) return;
    clearTimeout(M.ocultoT);
    M.ocultoT = setTimeout(() => {
      if (!document.hidden || !maosLigado()) return;
      desligarMaos({ aviso: false });
      M.desligouOculto = true;
    }, MAOS_OCULTO_MS);
    return;
  }
  clearTimeout(M.ocultoT);
  M.ocultoT = 0;
  if (M.desligouOculto) {
    M.desligouOculto = false;
    ui.aviso('As mãos foram desligadas porque a aba ficou escondida por mais de 2 minutos.', 4600);
  }
}

// Cada quadro do motor: a camada desenha; o cursor da mão vira o campo sobre os neurônios (afasta e acende;
// na pinça, puxa) e, com o punho fechado, o ponto que a cabeça segue.
function aoQuadroMaos(q) {
  M.fx?.quadro(q);
  const R = S.robo;
  const m = q && Array.isArray(q.maos) && q.principal >= 0 ? q.maos[q.principal] : null;
  const c = m && m.cursor;
  if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) {
    M.cursor.ok = false;
    if (M.campo) { M.campo = false; R?.campoMao(null); }
    return;
  }
  M.cliente.x = c.x; M.cliente.y = c.y;
  M.cursor.x = c.x - S.ref.left; M.cursor.y = c.y - S.ref.top; M.cursor.ok = true;
  if (!R || S.visao !== 'robo') return;
  const a = M.campoArg;
  a.x = M.cursor.x; a.y = M.cursor.y;
  a.raio = limitar((Number(m.escala) || 140) * 0.8, 70, 170);
  a.forca = m.pincando ? -0.95 : 0.75;
  R.campoMao(a);
  M.campo = true;
  if (M.agarrando) R.agarrar(M.cursor);
}
function pontoMao(dados) {
  if (dados && Number.isFinite(dados.x) && Number.isFinite(dados.y)) return { x: dados.x - S.ref.left, y: dados.y - S.ref.top };
  return M.cursor.ok ? { x: M.cursor.x, y: M.cursor.y } : null;
}

// Reações do robô e da página a cada gesto (o clique, o arraste e o hover já chegam pelo mouse sintético).
function aoGestoMaos(nome, dados) {
  // a camada de efeitos anima o gesto; no "fechar" ela devolve true quando já fechou a ajuda ou o cartão de ligar, e
  // 'ignorado' quando o consumiu sem efeito (carência da ajuda): aí nada fecha e o robô não pisca
  const res = M.fx ? M.fx.gesto(nome, dados) : false;
  const ignorado = res === 'ignorado', consumido = res === true || ignorado;
  const R = S.robo;
  switch (nome) {
    case 'entrou':   // a mão apareceu: o robô se surpreende e fica feliz, como quem diz oi
      M.presente = true;
      acordar();
      if (R) {
        R.expressao('surpreso', 560);
        setTimeout(() => { if (M.presente && maosLigado()) S.robo?.expressao('feliz', 1300); }, 560);
      }
      break;
    case 'saiu':     // sumiu: solta tudo e o robô volta a olhar em volta
      M.presente = false; M.agarrando = false; M.campo = false; M.cursor.ok = false;
      if (R) { R.agarrar(null); R.campoMao(null); R.olharEmVolta(); }
      break;
    case 'fechar':   // mão aberta parada: fecha como o Esc, e o robô pisca
      if (!ignorado) R?.expressao('piscar');
      if (!consumido) fecharComoEsc();
      break;
    case 'deslizar':
      deslizarMaos(dados && dados.direcao);
      break;
    case 'agarrarInicio':
    case 'agarrar': {
      const p = pontoMao(dados);
      if (nome === 'agarrarInicio') { M.agarrando = true; R?.expressao('surpreso', 500); }
      else M.agarrando = true;
      if (p) R?.agarrar(p);
      break;
    }
    case 'agarrarFim':
      M.agarrando = false;
      if (R) { R.agarrar(null); R.expressao('feliz', 900); }
      break;
    case 'joinha':   // comemora: feliz + pulinho com faíscas
      if (R) { R.expressao('feliz', 1700); R.pular(); }
      break;
    case 'vitoria': { // alterna Robô / Mapa em anéis
      const nova = S.visao === 'robo' ? 'aneis' : 'robo';
      S.robo?.expressao('feliz', 1400);
      mudarVisao(nova, true);
      if (S.visao === nova) ui.aviso(nova === 'robo' ? 'Visão: robô.' : 'Visão: mapa em anéis.', 2200);
      break;
    }
    default: break;
  }
}

// "Fechar" da mão = mesma ordem do Esc do holo.js (leitor → funil → menu → leque → resposta), sem fingir uma
// tecla (o Esc de mentira acenderia o contorno de foco de teclado). Antes de tudo, a ajuda dos gestos.
function fecharComoEsc() {
  if (visivel('#maosAjuda')) { ajudaMaos(false); return; }
  if (digitando()) { try { document.activeElement.blur(); } catch { /* nada */ } }
  if (estaAberto()) {
    // leitor aberto a partir do funil: volta um nível, como o "← Voltar ao fluxo"
    const v = $('#lFluxo');
    if (v && !v.hidden && v.dataset.modo === 'voltar') v.click(); else fechar();
    return;
  }
  if (S.leitorNo || S.fluxoNo || S.saudeAberta || fluxoAberto() || saudeAbertaUI()) { fechar(); return; }
  const m = $('#menu');
  if (m && !m.hidden) { ui.menu(false); m.hidden = true; $('#menuBtn')?.setAttribute('aria-expanded', 'false'); return; }
  if (S.depto || $('#leque')?.childElementCount) { recolherLeque(); return; }
  const r = $('#resposta');
  if (r && !r.hidden) { ui.resposta.fechar(); r.hidden = true; }
}

// Deslizar: com o funil aberto, esquerda/direita = próxima/anterior rotina; senão troca a aba do trilho.
// Cima/baixo rola o leitor (ou o funil, ou a lista debaixo do cursor): mão subindo = texto sobe (avança).
function deslizarMaos(direcao) {
  if (direcao === 'cima' || direcao === 'baixo') { rolarMaos(direcao); return; }
  if (direcao !== 'esquerda' && direcao !== 'direita') return;
  if (S.fluxoNo && fluxoAberto() && !estaAberto()) { trocarRotinaMaos(direcao === 'esquerda' ? 1 : -1); return; }
  const tr = $('#trilho');
  if (!tr || tr.hidden) return;
  ui.aba(tr.dataset.aba === 'rotinas' ? 'deptos' : 'rotinas');   // duas abas: qualquer lado troca
}
function trocarRotinaMaos(passo) {
  const lista = S.rotinas.filter((r) => r && r.no);
  if (lista.length < 2) return;
  let i = lista.findIndex((r) => r.no === S.fluxoNo || (!!r.no.path && r.no.path === S.fluxoNo?.path));
  if (i < 0) i = 0;
  const prox = lista[(i + passo + lista.length) % lista.length];
  abrirRotina(prox.no, { origem: centroLeitor() || estimarCentro() });
}
function rolarMaos(direcao) {
  let alvo = null;
  if (estaAberto()) alvo = $('#lCorpo');
  else if (fluxoAberto()) alvo = $('#fCorpo');
  else if (saudeAbertaUI()) alvo = $('#sCorpo');
  else if (M.cursor.ok) alvo = rolavelSob(M.cliente.x, M.cliente.y);
  if (!alvo) return;
  const passo = Math.max(80, alvo.clientHeight * 0.7) * (direcao === 'cima' ? 1 : -1);
  try { alvo.scrollBy({ top: passo, behavior: reduzido() ? 'auto' : 'smooth' }); } catch { alvo.scrollTop += passo; }
}
function rolavelSob(x, y) {
  let el = null;
  try { el = document.elementFromPoint(x, y); } catch { el = null; }
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 4) continue;
    const oy = getComputedStyle(el).overflowY;
    if (oy === 'auto' || oy === 'scroll') return el;
  }
  return null;
}

function ligarEventosMaos() {
  const on = (sel, ev, fn, o) => $(sel)?.addEventListener(ev, fn, o);
  botaoMaos('desligado');
  on('#maosBtn', 'click', aoBotaoMaos);
  on('#maosInfoLigar', 'click', () => acaoMaos('ligar', ligarCamera));
  on('#maosInfoFechar', 'click', () => {
    fecharInfoMaos();
    if (!maosLigado()) { if (M.estado === 'preparando') cancelarMaos(); else destruirEfeitos(); }
  });
  // Esc ou clique fora fecha o cartão do app (antes de o Esc chegar no leitor e no resto)
  window.addEventListener('keydown', (e) => {
    const c = $('#maosInfo');
    if (e.key !== 'Escape' || !c || c.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    $('#maosInfoFechar')?.click();
  }, true);
  document.addEventListener('pointerdown', (e) => {
    const c = $('#maosInfo');
    if (!c || c.hidden || c.contains(e.target) || $('#maosBtn')?.contains(e.target)) return;
    $('#maosInfoFechar')?.click();
  }, true);
  document.addEventListener('visibilitychange', maosVisibilidade);
  window.addEventListener('pagehide', () => { if (maosLigado()) desligarMaos({ aviso: false }); });
  // link externo do texto da nota (target=_blank) pinçado: o navegador barraria a janela em silêncio
  document.addEventListener('click', (e) => {
    if (e.isTrusted || !e.daMao) return;
    const a = e.target && e.target.closest ? e.target.closest('a[target="_blank"], a[href^="obsidian:"]') : null;
    if (!a || !semAtivacao()) return;
    e.preventDefault();
    ui.aviso(TXT_SEM_ATIVACAO.link, 4200);
  }, true);
}
function ligarEventos() {
  const on = (sel, ev, fn, o) => $(sel)?.addEventListener(ev, fn, o);

  // Vault: recarregar, abrir pasta, exemplo
  on('#recarregar', 'click', recarregar);
  on('#loadBtn', 'click', abrirPasta);
  on('#demoBtn', 'click', verExemplo);
  on('#pasta', 'change', (e) => carregarPasta(e.target));

  // Exibição
  // Exibição: as chaves valem para as duas visões (robô e mapa em anéis)
  on('#sinapses', 'change', (e) => { S.robo?.sinapses(e.target.checked); S.aneis?.sinapses(e.target.checked); gravarPref('sinapses', e.target.checked ? '1' : '0'); });
  on('#qualidade', 'change', (e) => { const q = e.target.checked ? 'alta' : 'baixa'; S.robo?.qualidade(q); S.aneis?.qualidade(q); gravarPref('qualidade', q); });
  on('#giro', 'input', (e) => { S.aneis?.giro(e.target.value); gravarPref('giro', String(e.target.value)); });
  on('#nomes', 'change', (e) => { S.aneis?.nomes(e.target.checked); gravarPref('nomes', e.target.checked ? '1' : '0'); });
  on('#centralizarBtn', 'click', () => { if (!S.leitorNo && !S.fluxoNo) S.aneis?.selecionar(null, { voar: false }); S.aneis?.centralizar(); ui.menu(false); });
  on('#deptChips', 'click', (e) => {
    const b = e.target.closest('.chip');
    const d = b && S.G ? S.G.depts[+b.dataset.i] : null;
    if (d) alternarOculto(d.name);
  });

  // Movimento reduzido ligado/desligado com a página aberta
  try {
    mmReduz?.addEventListener('change', () => {
      const v = reduzido();
      S.robo?.reduzir(v);
      S.aneis?.reduzir(v);   // (a camada das mãos lê o "reduzir movimento" ao vivo sozinha)
      const g = $('#giro'); if (g) g.disabled = v;
    });
  } catch { /* navegador antigo: fica o valor da carga */ }

  // Sem ninguém mexendo por ~1 min (e nada aberto): o robô dorme; a próxima ação acorda.
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, acordar, { passive: true, capture: true });
  agendarSono();

  // Menu: o holo.js alterna; se ninguém alternou no mesmo clique, o app alterna (reserva).
  const menu = $('#menu'), menuBtn = $('#menuBtn');
  if (menu && menuBtn) {
    const foto = () => `${menu.hidden}|${menuBtn.getAttribute('aria-expanded')}`;
    let antes = null, abertoAntes = false;
    document.addEventListener('click', (e) => { if (menuBtn.contains(e.target)) { antes = foto(); abertoAntes = !menu.hidden; } }, true);
    window.addEventListener('click', (e) => {
      if (antes === null || !menuBtn.contains(e.target)) return;
      const a = antes;
      antes = null;
      if (foto() !== a) return;
      ui.menu(!abertoAntes);
      if (menu.hidden !== abertoAntes) menu.hidden = abertoAntes;   // ui.menu não respondeu
      menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
    });
  }

  // Pergunte ao cérebro
  on('#perguntaForm', 'submit', (e) => {
    e.preventDefault();
    const input = $('#perguntaInput');
    const q = (input?.value || '').trim();
    if (!q || S.perguntando) return;
    input.value = '';
    perguntar(q);
  });
  const resp = $('#resposta');
  observarOculto(resp, (oculto) => {
    if (!oculto) return;
    // Fechou o painel da resposta: para o que estiver rodando e começa conversa nova.
    if (S.perguntando || S.turns.length || S.achadas.size || S.usadas.size) novaConversa();
    if (!S.sample) { const c = $('#pergunta'); if (c) c.hidden = true; }
  });
  observarOculto($('#resultados'), (oculto) => { if (oculto && S.buscaIds) { S.buscaIds = null; aplicarDestaque(); } });
  // Leitor fechado por fora (sem passar pelo app): devolve a esfera e arruma o estado.
  observarOculto($('#leitor'), (oculto) => {
    if (oculto && S.leitorNo && !S.transitando) setTimeout(() => { if (S.leitorNo && !S.transitando && !estaAberto()) fechar({ jaFechado: true }); }, 0);
  });
  observarOculto($('#fluxo'), (oculto) => {
    if (oculto && S.fluxoNo && !S.transitando) setTimeout(() => { if (S.fluxoNo && !S.transitando && !fluxoAberto()) fechar({ jaFechado: true }); }, 0);
  });
  observarOculto($('#saude'), (oculto) => {
    if (oculto && S.saudeAberta && !S.transitando) setTimeout(() => { if (S.saudeAberta && !S.transitando && !saudeAbertaUI()) fechar({ jaFechado: true }); }, 0);
  });

  // Clique no vazio do palco recolhe o leque (o robô avisa quando o clique foi nele).
  const palco = $('#palco');
  if (palco) {
    let baixo = null;
    palco.addEventListener('pointerdown', (e) => { baixo = { x: e.clientX, y: e.clientY }; });
    palco.addEventListener('click', (e) => {
      const b = baixo;
      baixo = null;
      if (b && Math.hypot(e.clientX - b.x, e.clientY - b.y) > 9) return;
      const t = performance.now();
      setTimeout(() => { if (S.ultimoToqueRobo < t - 450) aoClicarVazio(); }, 80);
    });
  }

  // Ponteiro e teclado (para saber de onde abrir e quando mover o foco)
  window.addEventListener('pointermove', (e) => { S.ponteiro = { x: e.clientX - S.ref.left, y: e.clientY - S.ref.top }; }, { passive: true });
  window.addEventListener('pointerdown', (e) => { S.teclado = false; S.ponteiro = { x: e.clientX - S.ref.left, y: e.clientY - S.ref.top }; }, { passive: true, capture: true });
  window.addEventListener('keydown', (e) => { if (/^(Tab|Enter| |Escape|Arrow)/.test(e.key)) S.teclado = true; }, true);

  // Esc: quem fecha é o holo.js (leitor → funil → menu → leque → resposta). Se ele não mexeu em nada, o app fecha.
  let fotoEsc = null;
  const fotoEstado = () => [pedido, S.depto ? S.depto.name : '', $('#menu')?.hidden, $('#resposta')?.hidden, estaAberto(), fluxoAberto(), saudeAbertaUI(), $('#leque')?.childElementCount].join('|');
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fotoEsc = digitando() ? null : fotoEstado(); }, true);
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const a = fotoEsc;
    fotoEsc = null;
    if (a === null || fotoEstado() !== a) return;
    if (S.leitorNo || S.fluxoNo || S.saudeAberta || painelAberto()) { e.preventDefault(); fechar(); return; }
    const m = $('#menu');
    if (m && !m.hidden) { ui.menu(false); m.hidden = true; $('#menuBtn')?.setAttribute('aria-expanded', 'false'); return; }
    if (S.depto) { recolherLeque(); return; }
    const r = $('#resposta');
    if (r && !r.hidden) { ui.resposta.fechar(); r.hidden = true; }
  });

  // Aba escondida: pausa tudo. Tamanho da tela: robô, anéis, leitor e leque se ajustam.
  document.addEventListener('visibilitychange', atualizarPausa);
  let rzRaf = 0, rzT = 0;
  window.addEventListener('resize', () => {
    if (!rzRaf) rzRaf = requestAnimationFrame(() => {
      rzRaf = 0;
      atualizarRef();
      if (S.visao === 'robo') S.robo?.redimensionar(); else S.aneis?.redimensionar();
      if (S.leitorNo || S.fluxoNo || S.saudeAberta) {
        enquadrarComLeitor();
        const c = centroLeitor();
        if (c) S.robo?.olharPara(c);
      }
    });
    clearTimeout(rzT);
    rzT = setTimeout(() => { if (S.depto) mostrarLeque(S.depto, { silencioso: true, reposicionar: true }); }, 240);
  }, { passive: true });

  // Modo Mãos: botão, cartão do app, botões das camadas, aba escondida
  try { ligarEventosMaos(); } catch (err) { avisarFalha('modo Mãos', err); }
}

// ---------------------------------------------------------------------------
// Início: (1) interface; (2) robô (ou anéis); (3) dados; (4) grafo nas peças e boot
// ---------------------------------------------------------------------------
async function iniciar() {
  atualizarRef();
  aplicarPrefs();
  ui = criarUI();
  ligarEventos();
  ligarPergunta();
  iniciarSaude();
  const pRobo = carregarRobo();
  const pAneis = carregarAneis();
  const pDados = dadosIniciais();

  S.aneis = await pAneis;
  aplicarExibicaoAneis();   // "Mostrar sinapses", "Efeitos de brilho", giro e nomes valem também para os anéis
  const ini = await pDados;
  let G = construir(ini.data);
  if (!G && !ini.exemplo) {
    ini.data = seguro(() => D.vaultExemplo(), null);
    ini.exemplo = true;
    ini.aviso = 'O vault guardado não abriu. Mostrando o exemplo.';
    G = construir(ini.data);
  }
  S.aoVivo = !!ini.vivo;
  if (G) instalar(G, ini.data, { exemplo: ini.exemplo });
  atualizarPausa();
  if (S.aoVivo) iniciarAoVivo();

  const r = await Promise.race([pRobo, esperar(4000).then(() => TEMPO)]);
  if (r === TEMPO) {
    // O 3D está demorando (rede lenta): mostra os anéis enquanto isso e troca quando o robô chegar.
    if (S.aneis && !S.visaoEscolhida) mudarVisao('aneis');
    ligar();
    ui.aviso('Ligando o 3D…', 3000);
    pRobo.then((robo) => { if (robo) instalarRobo(robo); else falhaRobo(); });
  } else if (r) {
    instalarRobo(r);
  } else {
    falhaRobo();
    ligar();
  }
  if (ini.aviso) setTimeout(() => ui.aviso(ini.aviso), 900);
}

iniciar().catch((err) => avisarFalha('início', err));
if (ehLocal() && /[?&]debug\b/.test(location.search)) window.__cerebro = S;   // teste local: estado em window.__cerebro só em localhost com ?debug (no Artifact nunca liga)
