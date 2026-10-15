/* Cérebro da Lube — js/holo.js (agente UI)
   Componentes de tela do HUD holográfico: leitor de nota, leque de memórias, trilho de departamentos,
   recentes, resultados da busca, dica, aviso, painel de resposta do Claude, contador e feixe.

   Referencial: toda coordenada {x,y} que entra ou sai daqui é px CSS relativo a #app — o mesmo do canvas
   #palco (os dois ocupam a caixa inteira de #app). retanguloLeitor() também devolve nesse referencial.

   Animações: Web Animations + CSS. Com prefers-reduced-motion tudo vira fade curto, sem voo nem digitação. */

// Import por namespace: se algum nome faltar em dados.js, a UI continua de pé com o fallback local.
import * as D from './dados.js';

const esc = typeof D.esc === 'function' ? D.esc
  : s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const renderMD = typeof D.renderMD === 'function' ? D.renderMD : t => `<p>${esc(t)}</p>`;
const blocosMD = typeof D.blocosMD === 'function' ? D.blocosMD : null;
const parseFM = typeof D.parseFM === 'function' ? D.parseFM : t => ({ fm: {}, body: String(t ?? '') });
const corDe = typeof D.corDe === 'function' ? D.corDe : () => '';
const KIND_LABEL = D.KIND_LABEL || { core: 'Mapa central', skill: 'Skill', memory: 'Memória', routine: 'Rotina', app: 'Aplicação', dept: 'Departamento' };
const relTime = typeof D.relTime === 'function' ? D.relTime : () => '';
/* Valor do frontmatter: [[links]] viram links clicáveis (inline do dados.js recebe texto já escapado). */
const fmValor = s => { const e = esc(s); if (typeof D.inline !== 'function') return e; try { return D.inline(e); } catch (_) { return e; } };
const kb = typeof D.kb === 'function' ? D.kb : n => `${n} B`;

/* ---------- utilidades puras ---------- */
const semAcento = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const chave = s => semAcento(s).replace(/[^a-z0-9]+/g, ' ').trim();
const fmtN = n => Math.round(n).toLocaleString('pt-BR');
const n1 = v => (Math.round(v * 10) / 10).toString();
const graus = n => (n && n.links ? n.links.size : 0) + (n && n.back ? n.back.size : 0);
const rotulo = n => (n.kind === 'memory' ? n.dept : KIND_LABEL[n.kind]) || '';
/* Cor de um nó vinda de dados.js; só aceita hex (vai para atributo style). Sem cor válida, usa o token. */
const cor = n => { let c = ''; try { c = n ? corDe(n) : ''; } catch (_) { c = ''; } return /^#[0-9a-f]{3,8}$/i.test(c) ? c : 'var(--holo)'; };
const bez = (a, b, c, d, t) => { const u = 1 - t; return { x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x, y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y }; };

const ICO_FECHAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const LOGO_MINI = '<svg class="lg lg-logo" viewBox="40 20 790 575" aria-hidden="true"><g class="logo-g"><path class="logo-l" d="M165 30L400 30L295 435L740 435L705 580L230 580Q48 580 72 410Z"/><path class="logo-r" d="M430 30L650 30Q822 34 795 188L748 410L335 410Z"/></g></svg>';
const CANTOS = '<span class="canto ce" aria-hidden="true"></span><span class="canto cd" aria-hidden="true"></span><span class="canto be" aria-hidden="true"></span><span class="canto bd" aria-hidden="true"></span>';

const ITENS = [
  ['memorias', 'memória', 'memórias'],
  ['skills', 'skill', 'skills'],
  ['rotinas', 'rotina', 'rotinas'],
  ['apps', 'aplicação', 'aplicações'],
  ['conexoes', 'conexão', 'conexões'],
];
const LEGENDA = {
  robo: [['Logo', 'CLAUDE.md', null], ['Neurônio', 'memória', 'lg-neur'], ['Estrela', 'skill', 'lg-estrela'], ['Anel vermelho', 'rotinas', 'lg-anel'], ['Satélite', 'aplicações', 'lg-sat']],
  aneis: [['Centro', 'CLAUDE.md', null], ['Ponto', 'memória', 'lg-neur'], ['Estrela', 'skill', 'lg-estrela'], ['Anel vermelho', 'rotinas', 'lg-anel'], ['Hexágono', 'aplicações', 'lg-sat']],
};
const legendaHTML = v => LEGENDA[v].map(([a, b, g]) => `<span>${g ? `<i class="lg ${g}"></i>` : LOGO_MINI}<b>${a}</b> ${b}</span>`).join('');

/* ---------- Funil das rotinas: tipos de etapa, ícones desenhados em código, cores de situação ---------- */
const TIPOS = D.TIPOS_ETAPA || { processa: { rotulo: 'Processa', cor: '--holo' } };
const tipoEtapa = t => TIPOS[t] || TIPOS.processa || { rotulo: 'Etapa', cor: '--holo' };
/* a cor do tipo é o nome de um token CSS ("--holo"); só nomes válidos vão para o style */
const corToken = nome => (/^--[a-z0-9-]+$/i.test(String(nome || '')) ? `var(${nome})` : 'var(--holo)');
const ico = corpo => `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;
/* engrenagem: 8 dentes calculados (raio do dente 9,2, do vale 7) */
const engrenagem = (() => {
  const n = 8, R = 9.2, r = 7, c = 12, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, w = Math.PI / n;
    for (const [da, rr] of [[-0.62, r], [-0.36, R], [0.36, R], [0.62, r]]) { const t = a + da * w; pts.push(`${n1(c + Math.cos(t) * rr)} ${n1(c + Math.sin(t) * rr)}`); }
  }
  return `<path d="M${pts.join('L')}Z"/><circle cx="12" cy="12" r="2.9"/>`;
})();
const ICONE = {
  gatilho: ico('<path d="M13.2 2.8 5.6 13.4h5.6l-1 7.8 7.6-10.6h-5.6z"/>'),
  pessoa: ico('<circle cx="12" cy="8.2" r="3.7"/><path d="M4.6 20.4c.8-4 3.7-6.2 7.4-6.2s6.6 2.2 7.4 6.2"/>'),
  le: ico('<ellipse cx="12" cy="5.8" rx="7" ry="2.8"/><path d="M5 5.8v12.4c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8V5.8"/><path d="M5 12c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8"/>'),
  processa: ico(engrenagem),
  confere: ico('<path d="M12 2.9 4.9 5.7v5.6c0 4.5 3 8 7.1 9.8 4.1-1.8 7.1-5.3 7.1-9.8V5.7z"/><path d="m8.7 12.1 2.4 2.4 4.3-4.7"/>'),
  grava: ico('<path d="M12 3.4v10.4"/><path d="m7.6 9.6 4.4 4.4 4.4-4.4"/><path d="M4 14.6v3.6A1.8 1.8 0 0 0 5.8 20h12.4a1.8 1.8 0 0 0 1.8-1.8v-3.6"/>'),
  avisa: ico('<path d="M6.3 16.6v-5.4a5.7 5.7 0 0 1 11.4 0v5.4l1.7 1.9H4.6z"/><path d="M10 21a2.3 2.3 0 0 0 4 0"/>'),
  entrega: ico('<path d="M12 2.8 4.2 6.9v10.2L12 21.2l7.8-4.1V6.9z"/><path d="M4.2 6.9 12 11l7.8-4.1"/><path d="M12 11v10.2"/>'),
};
const COR_SITUACAO = { ativo: 'var(--ok)', planejado: 'var(--rever)', pausado: 'var(--muted)', arquivado: 'var(--muted)' };
const corSituacao = s => (Object.prototype.hasOwnProperty.call(COR_SITUACAO, s) ? COR_SITUACAO[s] : 'var(--muted)');   // "constructor" não acha Object.prototype
const proximaDe = (r, agora) => {
  if (!r || (r.status && r.status !== 'ativo') || typeof D.proximaExecucao !== 'function') return null;
  try { return D.proximaExecucao(r.horarios, agora || new Date(), { dias: r.dias, intervaloMin: r.intervaloMin }); } catch (_) { return null; }
};
const PREF_ABA = 'cerebro-robo:aba';

/* ---------- Saúde dos sistemas (Guardião, GUARDIAO.md §6 e §7): rótulos, cores e datas ---------- */
const SAUDE_ST = {
  ok: { rot: 'Em dia', cor: 'var(--ok)', ordem: 2 },
  atencao: { rot: 'Atenção', cor: 'var(--rever)', ordem: 1 },
  falha: { rot: 'Falha', cor: 'var(--alerta)', ordem: 0 },
  sem_dado: { rot: 'Sem dado', cor: 'var(--muted)', ordem: 3 },
  desligado: { rot: 'Desligado', cor: 'var(--muted)', ordem: 4 },
};
const stSaude = s => (Object.prototype.hasOwnProperty.call(SAUDE_ST, s) ? SAUDE_ST[s] : SAUDE_ST.sem_dado);
const SAUDE_VELHA_MIN = 20;   // o Guardião verifica de 5 em 5 min: leitura BOA com verificação de mais de 20 min = o agendador dele parou
const LEITURA_PARADA_MS = 2 * 60000;   // o painel lê de minuto em minuto: 2 min sem leitura boa (com a aba visível) = quem parou foi a leitura
const VISIVEL_FOLGA_MS = 20000;        // depois de a aba voltar, a leitura nova leva uns segundos: não acusar antes disso
const dataDe = v => { if (!v) return null; const d = new Date(v); return Number.isFinite(d.getTime()) ? d : null; };
const dois = n => String(n).padStart(2, '0');
const hhmm = d => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
/* "hoje 07:50", "ontem 23:50", "amanhã 02:50", "11/10 03:05" (hora do computador de quem vê) */
function quandoTxt(v, agora = new Date()) {
  const d = dataDe(v); if (!d) return '';
  const dia = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const k = Math.round((dia(d) - dia(agora)) / 864e5);
  const pre = k === 0 ? 'hoje' : k === -1 ? 'ontem' : k === 1 ? 'amanhã' : `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
  return `${pre} ${hhmm(d)}`;
}
/* "há instantes", "há 3 min", "há 2 h 10 min", "há 3 dias" */
function haQuanto(v, agora = Date.now()) {
  const d = dataDe(v); if (!d) return '';
  const min = Math.max(0, Math.floor((agora - d.getTime()) / 60000));
  if (min < 1) return 'há instantes';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  if (h < 24) return h < 4 && r ? `há ${h} h ${r} min` : `há ${h} h`;
  const dd = Math.floor(h / 24); return dd === 1 ? 'há 1 dia' : `há ${dd} dias`;
}
function duracaoTxt(de, ate) {
  const a = dataDe(de), b = dataDe(ate); if (!a || !b) return '';
  const min = Math.max(0, Math.round((b - a) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  if (h < 48) return r ? `${h} h ${r} min` : `${h} h`;
  return `${Math.round(h / 24)} dias`;
}
const plural = (n, um, varios) => `${fmtN(n)} ${n === 1 ? um : varios}`;
/* "BI Compras · Sync rapidas" (sem repetir o sistema quando o nome já começa por ele) */
function nomeSaude(i) {
  if (!i) return '';
  const nome = String(i.nome || i.id || ''), sis = String(i.sistema || '');
  const a = semAcento(nome).trim(), b = semAcento(sis).trim();   // "gestao-ti-ruddy.vercel.app" não começa por "Gestão TI"
  return b && a !== b && !a.startsWith(`${b} `) ? `${sis} · ${nome}` : nome;
}
/* etapa do funil: "ok" ou {status, motivo} */
function etapaSaude(v) {
  if (v == null) return null;
  if (typeof v === 'string') return { st: SAUDE_ST[v] ? v : 'sem_dado', motivo: '' };
  if (typeof v === 'object') { const s = String(v.status || v.estado || ''); return { st: SAUDE_ST[s] ? s : 'sem_dado', motivo: String(v.motivo || v.resumo || '') }; }
  return null;
}
/* "1 falha e 2 atenções" / "2 atenções" / "Tudo em dia" / "Sem dados" */
function tituloSaude(g) {
  if (!g) return 'Sem dados';
  const f = +g.falha || 0, a = +g.atencao || 0;
  if (f && a) return `${plural(f, 'falha', 'falhas')} e ${plural(a, 'atenção', 'atenções')}`;
  if (f) return plural(f, 'falha', 'falhas');
  if (a) return plural(a, 'atenção', 'atenções');
  return (+g.ok || 0) > 0 ? 'Tudo em dia' : 'Sem dados';
}
const SAUDE_SECOES = [
  ['rotina', 'Rotinas'], ['site', 'Sistemas no ar'], ['vm', 'VM SRV-IA'], ['conferencia', 'Conferência com o WinThor'], ['outro', 'Outros'],
];
const secaoDe = tipo => (tipo === 'rotina' ? 'rotina' : tipo === 'site' ? 'site' : tipo === 'vm' || tipo === 'servico' || tipo === 'tarefa' ? 'vm' : tipo === 'conferencia' ? 'conferencia' : 'outro');

/* ================================================================================================ */
export function iniciarUI(opts = {}) {
  const doc = document;
  const $id = id => doc.getElementById(id);
  const app = $id('app') || doc.body;
  const el = {
    stats: $id('stats'), q: $id('q'), res: $id('resultados'), menu: $id('menu'), menuBtn: $id('menuBtn'),
    trilho: $id('trilho'), recentes: $id('recentes'), leque: $id('leque'), leitor: $id('leitor'),
    selos: $id('lSelos'), titulo: $id('lTitulo'), caminho: $id('lCaminho'), meta: $id('lMeta'),
    obsidian: $id('lObsidian'), copiar: $id('lCopiar'), fechar: $id('lFechar'),
    corpo: $id('lCorpo'), fm: $id('lFm'), texto: $id('lTexto'), conexoes: $id('lConexoes'),
    feixe: $id('feixe'), pergunta: $id('pergunta'), resposta: $id('resposta'), form: $id('perguntaForm'),
    perguntaInput: $id('perguntaInput'), dica: $id('dica'), aviso: $id('aviso'), legenda: $id('legenda'),
    palco: $id('palco'), aneis: $id('aneis'), visaoRobo: $id('visaoRobo'), visaoAneis: $id('visaoAneis'),
    topo: app.querySelector('.topo'), marca: app.querySelector('.marca'),
    // abas do trilho e lista de rotinas
    abaDeptos: $id('abaDeptos'), abaRotinas: $id('abaRotinas'), qtDeptos: $id('qtDeptos'), qtRotinas: $id('qtRotinas'),
    trilhoDeptos: $id('trilhoDeptos'), trilhoRotinas: $id('trilhoRotinas'),
    // painel do funil (mesma moldura do leitor) e o botão do leitor que volta para ele
    fluxo: $id('fluxo'), fSelos: $id('fSelos'), fTitulo: $id('fTitulo'), fChips: $id('fChips'), fNota: $id('fNota'),
    fCopiar: $id('fCopiar'), fFechar: $id('fFechar'), fCorpo: $id('fCorpo'), fDeduzido: $id('fDeduzido'),
    fFunil: $id('fFunil'), fSilhueta: $id('fSilhueta'), fEtapas: $id('fEtapas'), fConexoes: $id('fConexoes'), lFluxo: $id('lFluxo'),
    fSaude: $id('fSaude'),
    // saúde dos sistemas: chip da barra de cima e o painel Saúde (mesma moldura do leitor)
    chip: $id('saudeChip'), saude: $id('saude'), sSelos: $id('sSelos'), sTitulo: $id('sTitulo'), sMeta: $id('sMeta'),
    sAtualizar: $id('sAtualizar'), sFechar: $id('sFechar'), sCorpo: $id('sCorpo'),
  };
  const moldura = el.leitor ? el.leitor.querySelector('.leitor-moldura') : null;
  const molduraF = el.fluxo ? el.fluxo.querySelector('.leitor-moldura') : null;
  const molduraS = el.saude ? el.saude.querySelector('.leitor-moldura') : null;
  /* estado da saúde (declarado aqui em cima: a lista de rotinas e o funil já perguntam por ele) */
  let saudeDados = null, saudeInfo = { estado: 'carregando', motivo: '', modo: '', usaChave: false, temChave: false }, saudeAb = false, seqSaude = 0, arrasteYS = 0;
  let visivelDesde = Date.now();   // quando a aba voltou a ficar visível (a leitura nova ainda está a caminho)
  const comAbas = !!(el.trilho && el.abaDeptos && el.abaRotinas && el.trilhoDeptos && el.trilhoRotinas);
  const mmReduz = matchMedia('(prefers-reduced-motion: reduce)');
  const mmCel = matchMedia('(max-width: 759px)');
  const reduz = () => mmReduz.matches;
  const celular = () => mmCel.matches;

  /* ---------- referencial e animação ---------- */
  const local = r => { const a = app.getBoundingClientRect(); return new DOMRect(r.left - a.left, r.top - a.top, r.width, r.height); };
  const centroDe = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  const centroEl = e => centroDe(local(e.getBoundingClientRect()));
  const visivel = e => !!e && !e.hidden && e.getClientRects().length > 0;
  const anim = (e, kf, o) => { if (!e || typeof e.animate !== 'function') return null; try { return e.animate(kf, o); } catch (_) { return null; } };
  const fim = a => (a && a.finished ? a.finished.then(() => {}, () => {}) : Promise.resolve());
  const espera = ms => new Promise(r => setTimeout(r, ms));
  function pararAnims(raiz) {
    if (!raiz || typeof raiz.getAnimations !== 'function') return;
    for (const a of raiz.getAnimations({ subtree: true })) {
      if ((window.CSSAnimation && a instanceof window.CSSAnimation) || (window.CSSTransition && a instanceof window.CSSTransition)) continue;
      a.cancel();
    }
  }
  function cascata(lista, base = 0, passo = 30, max = 40, dist = 10) {
    if (reduz()) return;
    lista.slice(0, max).forEach((e, i) => anim(e, [{ opacity: 0, transform: `translateY(${dist}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 380, delay: base + i * passo, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  }

  /* ================================ CONTADOR ================================ */
  let statsRaf = 0;
  function stats(contagem = {}, o = {}) {
    if (!el.stats) return;
    cancelAnimationFrame(statsRaf);
    const animar = !!o.animar && !reduz();
    // Linha 1: estado (ao vivo / exemplo) + nome do vault. Linha 2: o contador.
    const cab = [], partes = [];
    if (o.aoVivo) {
      const rec = o.aoVivo === 'reconectando';
      cab.push(`<span class="st-vivo${rec ? ' st-recon' : ''}"><i aria-hidden="true"></i>${rec ? 'reconectando' : 'ao vivo'}</span>`);
    }
    if (o.exemplo) cab.push('<span class="st-ex">Exemplo</span>');
    else if (o.vaultName) cab.push(`<span class="st-vault">${esc(o.vaultName)}</span>`);
    for (const [k, um, varios] of ITENS) {
      const v = Math.max(0, Math.round(+(contagem || {})[k] || 0));
      const txt = fmtN(v);
      partes.push(`<span class="st-it"><b data-v="${v}" style="min-width:${txt.length}ch">${animar ? '0' : txt}</b> ${v === 1 ? um : varios}</span>`);
    }
    const sep = '<span class="st-sep" aria-hidden="true">·</span>';
    el.stats.innerHTML = (cab.length ? `${cab.join(sep)}<span class="st-quebra" aria-hidden="true"></span>` : '') + partes.join(sep);
    if (!animar) return;
    const bs = [...el.stats.querySelectorAll('b[data-v]')];
    const t0 = performance.now(), dur = 1500;
    const passo = agora => {
      let falta = false;
      bs.forEach((b, i) => {
        const e = Math.min(1, Math.max(0, (agora - t0 - i * 110) / dur));
        b.textContent = fmtN(+b.dataset.v * (1 - Math.pow(1 - e, 3)));
        if (e < 1) falta = true;
      });
      if (falta) statsRaf = requestAnimationFrame(passo);
    };
    statsRaf = requestAnimationFrame(passo);
  }

  /* ================================ TRILHO ================================ */
  let deptsAtuais = [], deptAtivo = null, assinaturaTrilho = '';
  const nomeDept = d => (d == null ? null : typeof d === 'string' ? d : d.name);
  const corDept = d => cor(d.hub || { kind: 'dept', ci: d.ci, name: d.name });
  function marcarTrilho() {
    if (!el.trilho) return;
    el.trilho.querySelectorAll('.depto').forEach(b => {
      const d = deptsAtuais[+b.dataset.i];
      b.setAttribute('aria-pressed', String(!!d && d.name === deptAtivo));
    });
  }
  // Com as abas (Departamentos | Rotinas) a lista de departamentos vai para o painel da aba; sem elas, para o trilho.
  const caixaDeptos = comAbas ? el.trilhoDeptos : el.trilho;
  function trilhoVisivel() { if (el.trilho) el.trilho.hidden = !deptsAtuais.length && !(comAbas && rotinasAtuais.length); }
  function trilho(depts, ativo = null) {
    if (!el.trilho) return;
    deptsAtuais = Array.isArray(depts) ? depts : [];
    deptAtivo = nomeDept(ativo);
    const assin = deptsAtuais.map(d => `${d.name}:${d.list ? d.list.length : 0}:${d.ci}`).join('|');
    if (assin !== assinaturaTrilho) {
      assinaturaTrilho = assin;
      const total = deptsAtuais.reduce((a, d) => a + (d.list ? d.list.length : 0), 0);
      // resumo do cartão de departamento antigo: "N notas · M conexões saindo"
      const resumo = d => { const q = d.list ? d.list.length : 0, c = d.list ? d.list.reduce((a, x) => a + (x.links ? x.links.size : 0), 0) : 0;
        return `${fmtN(q)} ${q === 1 ? 'nota' : 'notas'} · ${fmtN(c)} ${c === 1 ? 'conexão saindo' : 'conexões saindo'}`; };
      // com abas, o cabeçalho "Departamentos N" é a própria aba (com o total de notas, como o cabeçalho antigo)
      caixaDeptos.innerHTML = deptsAtuais.length
        ? `${comAbas ? '' : `<p class="hud-rot trilho-cab"><span>Departamentos</span><b>${fmtN(total)}</b></p>`}<div class="trilho-lista">${deptsAtuais.map((d, i) =>
          `<button type="button" class="depto" data-i="${i}" aria-pressed="false" title="${esc(resumo(d))}" style="--c:${corDept(d)}"><i class="pt" aria-hidden="true"></i><span class="nm">${esc(d.name)}</span><b class="qt">${fmtN(d.list ? d.list.length : 0)}</b></button>`).join('')}</div>`
        : '';
      // a aba conta o que a lista dela mostra (como "Rotinas 11"): departamentos; o total de notas fica na dica e na leitura de tela
      if (comAbas && el.qtDeptos) {
        const q = deptsAtuais.length, notas = `${fmtN(total)} ${total === 1 ? 'nota' : 'notas'}`;
        el.qtDeptos.textContent = fmtN(q);
        el.abaDeptos.setAttribute('aria-label', `Departamentos, ${fmtN(q)}, com ${notas}`);
        el.abaDeptos.title = `${fmtN(q)} ${q === 1 ? 'departamento' : 'departamentos'} · ${notas}`;
      }
      trilhoVisivel();
      if (!reduz()) {
        const de = celular() ? 'translateY(12px)' : 'translateX(-14px)';
        caixaDeptos.querySelectorAll('.depto').forEach((b, i) => anim(b, [{ opacity: 0, transform: de }, { opacity: 1, transform: 'none' }],
          { duration: 420, delay: 120 + Math.min(i, 20) * 45, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
      }
    }
    marcarTrilho();
  }
  el.trilho?.addEventListener('click', e => {
    const b = e.target.closest('.depto'); if (!b) return;
    const d = deptsAtuais[+b.dataset.i]; if (!d) return;
    const desligar = deptAtivo === d.name;
    deptAtivo = desligar ? null : d.name;
    marcarTrilho();
    if (!desligar && celular()) { try { b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduz() ? 'auto' : 'smooth' }); } catch (_) {} }
    if (desligar) leque([], null, []);
    opts.onDepto?.(desligar ? null : d);
  });

  /* ================================ ABAS DO TRILHO ================================ */
  let abaAtual = 'deptos';
  try { const v = localStorage.getItem(PREF_ABA); if (v === 'rotinas' || v === 'deptos') abaAtual = v; } catch (_) {}
  /* aba(nome, o?) — o.foco: leva o foco para a aba; o.silencioso: não grava nem avisa o app */
  function aba(nome, o = {}) {
    if (!comAbas || (nome !== 'deptos' && nome !== 'rotinas')) return abaAtual;
    const mudou = nome !== abaAtual, ehR = nome === 'rotinas';
    abaAtual = nome;
    el.abaDeptos.setAttribute('aria-selected', String(!ehR)); el.abaDeptos.tabIndex = ehR ? -1 : 0;
    el.abaRotinas.setAttribute('aria-selected', String(ehR)); el.abaRotinas.tabIndex = ehR ? 0 : -1;
    el.trilhoDeptos.hidden = ehR; el.trilhoRotinas.hidden = !ehR;
    el.trilho.dataset.aba = nome;
    if (o.foco) { try { (ehR ? el.abaRotinas : el.abaDeptos).focus({ preventScroll: true }); } catch (_) {} }
    if (!mudou || o.silencioso) return abaAtual;
    try { localStorage.setItem(PREF_ABA, nome); } catch (_) {}
    if (!reduz()) {
      const de = celular() ? 'translateY(10px)' : 'translateX(-12px)';
      (ehR ? el.trilhoRotinas : el.trilhoDeptos).querySelectorAll('.depto, .rotina, .rot-grupo').forEach((b, i) => anim(b, [{ opacity: 0, transform: de }, { opacity: 1, transform: 'none' }],
        { duration: 340, delay: Math.min(i, 24) * 22, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
    }
    opts.onAba?.(nome);
    return abaAtual;
  }
  if (comAbas) {
    aba(abaAtual, { silencioso: true });
    el.abaDeptos.addEventListener('click', () => aba('deptos'));
    el.abaRotinas.addEventListener('click', () => aba('rotinas'));
    // setas trocam de aba (padrão de tablist): esquerda/direita, Home e End
    el.abaDeptos.parentElement.addEventListener('keydown', e => {
      const k = e.key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
      e.preventDefault();
      aba(k === 'Home' ? 'deptos' : k === 'End' ? 'rotinas' : abaAtual === 'deptos' ? 'rotinas' : 'deptos', { foco: true });
    });
  }

  /* ================================ ROTINAS (lista da aba) ================================ */
  let rotinasAtuais = [], rotinaAtiva = null, assinRotinas = '';
  const mesmaNota = (a, b) => !!a && !!b && (a === b || (!!a.path && a.path === b.path));
  const rotinaDe = no => rotinasAtuais.find(r => r.no === no) || rotinasAtuais.find(r => mesmaNota(r.no, no)) || null;
  function marcarRotinas() {
    el.trilhoRotinas?.querySelectorAll('.rotina').forEach(b => {
      const r = rotinasAtuais[+b.dataset.i];
      // aria-current (não aria-pressed): é a rotina aberta no funil, não um botão de alternar
      if (r && mesmaNota(r.no, rotinaAtiva)) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }
  /* rotinas(lista, ativa) — lista = D.rotinas(G); ativa = nó da rotina aberta no funil (ou null) */
  function rotinas(lista, ativa = null) {
    if (!comAbas) return;
    rotinasAtuais = Array.isArray(lista) ? lista.filter(r => r && r.no) : [];
    rotinaAtiva = ativa || null;
    const q = rotinasAtuais.length;
    el.qtRotinas.textContent = fmtN(q);
    el.abaRotinas.setAttribute('aria-label', `Rotinas, ${fmtN(q)}`);
    const assin = rotinasAtuais.map(r => `${r.no.path}@${r.no.mtime || 0}|${r.resumo}|${r.status}|${r.grupo}`).join('§');
    if (assin !== assinRotinas) {
      assinRotinas = assin;
      let h = '', grupo = null;
      rotinasAtuais.forEach((r, i) => {
        if (r.grupo !== grupo) { grupo = r.grupo; h += `<p class="hud-rot rot-grupo">${esc(grupo)}</p>`; }
        h += `<button type="button" class="rotina" data-i="${i}" style="--c:${corSituacao(r.status)}"><i class="pt" aria-hidden="true"></i>`
          + `<span class="rot-nm">${esc(r.titulo)}</span><span class="rot-g">${esc(r.grupo)}</span><span class="rot-hr">${esc(r.resumo)}</span>`
          + `<span class="rot-saude" data-saude="${i}" hidden></span>`
          + `<span class="rot-prox" data-prox="${i}"></span><span class="sr">, situação: ${esc(r.status || 'não registrada')}</span><span class="sr rot-saude-sr"></span></button>`;
      });
      el.trilhoRotinas.innerHTML = q
        ? `<div class="trilho-lista rot-lista">${h}</div>`
        : '<p class="rot-vazio">Nenhuma rotina no vault. As notas da pasta Rotinas/ aparecem aqui.</p>';
      atualizarProximas();
      marcarSaudeRotinas();
    }
    marcarRotinas();
    trilhoVisivel();
  }
  el.trilhoRotinas?.addEventListener('click', e => {
    const b = e.target.closest('.rotina'); if (!b) return;
    const r = rotinasAtuais[+b.dataset.i]; if (!r) return;
    if (celular()) { try { b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduz() ? 'auto' : 'smooth' }); } catch (_) {} }
    opts.onRotina?.(r.no, { origem: centroEl(b) });
  });
  // ponteiro ou foco num item: o robô olha para a conta dessa rotina no halo
  if (el.trilhoRotinas && typeof opts.onFocoRotina === 'function') {
    const entra = e => { const b = e.target.closest('.rotina'); const r = b ? rotinasAtuais[+b.dataset.i] : null; if (r) opts.onFocoRotina(r.no); };
    const sai = e => { const b = e.target.closest('.rotina'); if (b && !(e.relatedTarget && b.contains(e.relatedTarget))) opts.onFocoRotina(null); };
    el.trilhoRotinas.addEventListener('pointerover', entra); el.trilhoRotinas.addEventListener('pointerout', sai);
    // foco só conta vindo do teclado: o clique já é coberto pelo pointerover, e o foco devolvido ao botão quando o
    // funil fecha deixaria o robô encarando a conta parada (o "apontado" vence o mouse)
    el.trilhoRotinas.addEventListener('focusin', e => { if (viaTeclado) entra(e); }); el.trilhoRotinas.addEventListener('focusout', sai);
  }
  /* "próxima em 2 h 10 min": a lista e o chip do funil se atualizam na virada de cada minuto */
  function atualizarProximas() {
    const agora = new Date();
    el.trilhoRotinas?.querySelectorAll('.rot-prox').forEach(s => {
      const p = proximaDe(rotinasAtuais[+s.dataset.prox], agora);
      const t = p ? `próxima ${p.falta}` : '';
      if (s.textContent !== t) s.textContent = t;
      s.title = p ? `Próxima: ${p.texto}` : '';
    });
    const chip = el.fChips && el.fChips.querySelector('.f-prox > span');
    if (chip && fluxoR) { const p = proximaDe(fluxoR, agora); chip.textContent = p ? p.texto : '—'; }
    atualizarIdadesSaude();   // "verificado há 3 min" no chip, no painel Saúde e no funil
  }
  let proxT = 0;
  function agendarProximas() {
    clearTimeout(proxT);
    proxT = setTimeout(() => { atualizarProximas(); agendarProximas(); }, 60000 - (Date.now() % 60000) + 40);
  }
  agendarProximas();
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) { visivelDesde = Date.now(); atualizarProximas(); agendarProximas(); } });

  /* ================================ RECENTES ================================ */
  let recentesAtuais = [];
  function recentes(nos) {
    if (!el.recentes) return;
    recentesAtuais = (Array.isArray(nos) ? nos : []).filter(Boolean).slice(0, 5);
    el.recentes.hidden = !recentesAtuais.length;
    el.recentes.innerHTML = recentesAtuais.length
      ? `<h2 class="hud-rot">Memórias recentes</h2><ol class="rec-lista">${recentesAtuais.map((n, i) =>
        `<li><button type="button" class="rec" data-i="${i}" style="--c:${cor(n)}"><span class="nm">${esc(n.name)}</span><span class="mt"><i class="pt" aria-hidden="true"></i><span class="dp">${esc(rotulo(n))}</span><span class="qd">${esc(relTime(n.mtime))}</span></span></button></li>`).join('')}</ol>`
      : '';
  }
  el.recentes?.addEventListener('click', e => {
    const b = e.target.closest('.rec'); if (!b) return;
    const n = recentesAtuais[+b.dataset.i];
    if (n) opts.onAbrir?.(n, { origem: centroEl(b) });
  });

  /* Foco opcional (hover/foco de cartão ou recente) para o robô olhar: opts.onFoco(no|null, {x,y}) */
  function ligarFoco(raiz, sel, achar) {
    if (!raiz || typeof opts.onFoco !== 'function') return;
    const entra = e => { const b = e.target.closest(sel); if (b && raiz.contains(b)) { const n = achar(b); if (n) opts.onFoco(n, centroEl(b)); } };
    const sai = e => { const b = e.target.closest(sel); if (b && !(e.relatedTarget && b.contains(e.relatedTarget))) opts.onFoco(null, null); };
    raiz.addEventListener('pointerover', entra); raiz.addEventListener('pointerout', sai);
    raiz.addEventListener('focusin', entra); raiz.addEventListener('focusout', sai);
  }
  ligarFoco(el.recentes, '.rec', b => recentesAtuais[+b.dataset.i]);

  /* ================================ LEQUE ================================ */
  let lequeOrigem = null, lequeDados = [];
  function limites() {
    const W = app.clientWidth, H = app.clientHeight, g = 16;
    const L = { x0: g, x1: W - g, y0: g, y1: H - g };
    const r = e => (visivel(e) ? local(e.getBoundingClientRect()) : null);
    const tetos = [r(el.topo), r(el.marca), r(el.stats)].filter(Boolean).map(x => x.bottom);
    if (tetos.length) L.y0 = Math.max(L.y0, Math.max(...tetos) + 10);
    const t = el.trilho && el.trilho.children.length ? r(el.trilho) : null;
    if (celular()) {
      const f = el.pergunta && !el.pergunta.hidden ? r(el.form) : null;
      const piso = Math.min(t ? t.top : H, f ? f.top : H);
      L.y1 = Math.min(L.y1, piso - 10);
    } else if (t) L.x0 = Math.max(L.x0, t.right + 12);
    return new DOMRect(L.x0, L.y0, Math.max(0, L.x1 - L.x0), Math.max(0, L.y1 - L.y0));
  }
  function posicionarCartas() {
    if (!lequeDados.length) return;
    const L = limites();
    const preso = (v, a, b, m) => (b - a < 2 * m ? (a + b) / 2 : Math.min(b - m, Math.max(a + m, v)));
    for (const c of (lequeMais ? [...lequeDados, lequeMais] : lequeDados)) {
      const w = c.b.offsetWidth, h = c.b.offsetHeight;
      c.x = preso(+c.p.x || 0, L.left, L.right, w / 2);
      c.y = preso(+c.p.y || 0, L.top, L.bottom, h / 2);
      c.b.style.left = `${n1(c.x)}px`; c.b.style.top = `${n1(c.y)}px`;
    }
  }
  function recolherCarta(b, volta, ordem) {
    const lida = b.classList.contains('lida');
    b.classList.add('saindo'); b.tabIndex = -1; b.setAttribute('aria-hidden', 'true');
    const x = parseFloat(b.style.left) || 0, y = parseFloat(b.style.top) || 0;
    // O cartão escolhido não volta para a cúpula: ele vira a semente do leitor e se apaga no lugar.
    const a = lida && !reduz()
      ? anim(b, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(.82)', opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' })
      : reduz() || !volta
        ? anim(b, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' })
        : anim(b, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(-50%,-50%) translate(${n1(volta.x - x)}px, ${n1(volta.y - y)}px) scale(.08)`, opacity: 0 }],
          { duration: 360, delay: Math.min(ordem, 20) * 12, easing: 'cubic-bezier(.55,0,.75,.2)', fill: 'forwards' });
    if (a) a.finished.then(() => b.remove(), () => b.remove()); else b.remove();
  }
  const chaveNo = no => no.path || `${no.kind}:${no.name}`;
  let lequeMais = null;   // { b, resto:[nós], titulo, p, x, y } — cartão "e mais N notas"
  /* leque(nos, origem, posicoes, o?) — o.resto: nós que não couberam (vira o cartão "e mais N" na última
     posição, que chama o.onMais(resto)); o.reposicionar: mesmos cartões, só desliza para as novas posições. */
  function leque(nos, origem, posicoes, o = {}) {
    if (!el.leque) return;
    const lista = Array.isArray(nos) ? nos.filter(Boolean) : [];
    const pos = Array.isArray(posicoes) ? posicoes : [];
    const resto = Array.isArray(o.resto) ? o.resto.filter(Boolean) : [];
    const temMais = resto.length > 0 && pos.length > 0;
    const n = Math.min(lista.length, temMais ? pos.length - 1 : pos.length);
    // Reposicionar (resize): os mesmos cartões deslizam para as vagas novas, sem recolher nem reabrir.
    if (o.reposicionar && lequeDados.length === n && n > 0 && lequeDados.every((c, i) => chaveNo(c.no) === chaveNo(lista[i]))
      && (!!lequeMais === temMais) && (!lequeMais || lequeMais.resto.length === resto.length)) {
      const todos = lequeMais ? [...lequeDados, lequeMais] : lequeDados;
      const antes = todos.map(c => ({ x: c.x, y: c.y }));
      lequeDados.forEach((c, i) => { c.p = pos[i] || c.p; });
      if (lequeMais) { lequeMais.p = pos[n] || lequeMais.p; lequeMais.resto = resto; }
      if (origem && Number.isFinite(origem.x) && Number.isFinite(origem.y)) lequeOrigem = { x: origem.x, y: origem.y };
      posicionarCartas();
      if (!reduz()) todos.forEach((c, i) => {
        const dx = antes[i].x - c.x, dy = antes[i].y - c.y;
        if (Math.abs(dx) + Math.abs(dy) > .5) anim(c.b, [{ transform: `translate(-50%,-50%) translate(${n1(dx)}px, ${n1(dy)}px)` }, { transform: 'translate(-50%,-50%)' }], { duration: 260, easing: 'cubic-bezier(.3,.7,.2,1)' });
      });
      return;
    }
    const velhas = [...el.leque.querySelectorAll('.carta:not(.saindo)')];
    const volta = lequeOrigem || origem || null;
    velhas.reverse().forEach((b, i) => recolherCarta(b, volta, i));
    lequeDados = []; lequeMais = null;
    if (!n) { lequeOrigem = null; app.classList.remove('com-leque'); return; }
    lequeOrigem = origem && Number.isFinite(origem.x) && Number.isFinite(origem.y) ? { x: origem.x, y: origem.y } : null;
    app.classList.add('com-leque');
    const frag = doc.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const no = lista[i], deg = graus(no), quando = relTime(no.mtime);
      const b = doc.createElement('button');
      b.type = 'button'; b.className = 'carta';
      b.dataset.chave = chaveNo(no);
      b.style.setProperty('--c', cor(no));
      b.setAttribute('aria-label', `${no.name}${quando ? `, editada ${quando}` : ''}, ${deg} ${deg === 1 ? 'conexão' : 'conexões'}`);
      b.innerHTML = `<span class="carta-nm">${esc(no.name)}</span><span class="carta-mt"><span>${esc(quando || '—')}</span><span><b>${deg}</b> ${deg === 1 ? 'conexão' : 'conexões'}</span></span>`;
      frag.appendChild(b);
      lequeDados.push({ b, no, p: pos[i] || { x: 0, y: 0 }, x: 0, y: 0 });
    }
    if (temMais) {
      const b = doc.createElement('button');
      b.type = 'button'; b.className = 'carta carta-mais';
      b.style.setProperty('--c', cor(lista[0]));
      const q = resto.length;
      b.setAttribute('aria-label', `E mais ${q} ${q === 1 ? 'nota' : 'notas'}: ver a lista`);
      b.innerHTML = `<span class="carta-nm">e mais <b>${fmtN(q)}</b> ${q === 1 ? 'nota' : 'notas'}</span><span class="carta-mt"><span>ver a lista</span><span aria-hidden="true">→</span></span>`;
      frag.appendChild(b);
      lequeMais = { b, resto, onMais: o.onMais, p: pos[n] || { x: 0, y: 0 }, x: 0, y: 0 };
    }
    el.leque.appendChild(frag);
    posicionarCartas();
    const todos = lequeMais ? [...lequeDados, lequeMais] : lequeDados;
    if (reduz()) { todos.forEach(c => anim(c.b, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 })); return; }
    const or = lequeOrigem || centroDe(limites());
    todos.forEach((c, i) => anim(c.b, [
      { transform: `translate(-50%,-50%) translate(${n1(or.x - c.x)}px, ${n1(or.y - c.y)}px) scale(.1)`, opacity: 0 },
      { opacity: 1, offset: .35 },
      { transform: 'translate(-50%,-50%)', opacity: 1 },
    ], { duration: 560, delay: Math.min(i, 30) * 28, easing: 'cubic-bezier(.2,.85,.25,1.06)', fill: 'backwards' }));
  }
  el.leque?.addEventListener('click', e => {
    const b = e.target.closest('.carta:not(.saindo)'); if (!b) return;
    if (lequeMais && b === lequeMais.b) { lequeMais.onMais?.(lequeMais.resto); return; }
    const c = lequeDados.find(x => x.b === b); if (!c) return;
    b.classList.add('lida');
    if (!reduz()) anim(b, [{ boxShadow: '0 0 0 0 var(--holo)' }, { boxShadow: '0 0 0 10px transparent' }], { duration: 420, easing: 'ease-out' });
    opts.onAbrir?.(c.no, { origem: centroEl(b) });
  });
  ligarFoco(el.leque, '.carta:not(.saindo)', b => (lequeDados.find(x => x.b === b) || {}).no);

  /* ================================ BUSCA ================================ */
  let resLista = [], resIdx = 0;
  function marcar(nome, q) {
    const termos = semAcento(q).split(/[\s,;]+/).filter(t => t.length > 1);
    const s = String(nome || ''), ns = semAcento(s);
    if (!termos.length || ns.length !== s.length) return esc(s);
    const marcas = new Array(s.length).fill(false);
    for (const t of termos) { let i = ns.indexOf(t); while (i >= 0) { for (let k = i; k < i + t.length; k++) marcas[k] = true; i = ns.indexOf(t, i + t.length); } }
    let out = '', aberto = false;
    for (let i = 0; i < s.length; i++) {
      if (marcas[i] && !aberto) { out += '<mark>'; aberto = true; }
      if (!marcas[i] && aberto) { out += '</mark>'; aberto = false; }
      out += esc(s[i]);
    }
    return out + (aberto ? '</mark>' : '');
  }
  function esconderRes() {
    if (!el.res) return;
    el.res.hidden = true;
    el.q?.setAttribute('aria-expanded', 'false');
    el.q?.removeAttribute('aria-activedescendant');
  }
  function ativarRes(i) {
    resIdx = i;
    el.res.querySelectorAll('[role="option"]').forEach((b, k) => { b.classList.toggle('act', k === i); b.setAttribute('aria-selected', String(k === i)); });
    const b = el.res.querySelector(`#res-${i}`);
    if (b) { el.q?.setAttribute('aria-activedescendant', b.id); try { b.scrollIntoView({ block: 'nearest' }); } catch (_) {} }
  }
  /* resultados(nos, q, o?) — o.titulo: cabeçalho da lista (ex.: as notas do departamento que não couberam no leque) */
  function resultados(nos, q, o = {}) {
    if (!el.res) return;
    const termo = String(q ?? (el.q ? el.q.value : '')).trim();
    if (!termo) { resLista = []; esconderRes(); return; }
    resLista = Array.isArray(nos) ? nos.filter(Boolean) : [];
    resIdx = 0;
    el.res.innerHTML = (o.titulo ? `<p class="res-cab hud-rot">${esc(o.titulo)}</p>` : '') + (resLista.length
      ? resLista.map((n, i) => `<button type="button" role="option" id="res-${i}" data-i="${i}" aria-selected="${i === 0}" class="${i === 0 ? 'act' : ''}" style="--c:${cor(n)}"><i class="pt" aria-hidden="true"></i><span class="nm">${marcar(n.name, termo)}</span><span class="dp">${esc(rotulo(n))}</span></button>`).join('')
      : `<p class="vazio">Nada encontrado para "${esc(termo)}".</p>`);
    el.res.hidden = false;
    el.res.scrollTop = 0;
    el.q?.setAttribute('aria-expanded', 'true');
    if (resLista.length) el.q?.setAttribute('aria-activedescendant', 'res-0'); else el.q?.removeAttribute('aria-activedescendant');
  }
  function escolherRes(i) {
    const n = resLista[i]; if (!n) return;
    esconderRes();
    el.q?.blur();
    opts.onBuscaEscolher?.(n);
  }
  if (el.q) {
    el.q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!resLista.length || el.res.hidden) return;
        e.preventDefault();
        ativarRes((resIdx + (e.key === 'ArrowDown' ? 1 : -1) + resLista.length) % resLista.length);
      } else if (e.key === 'Enter') {
        if (el.res.hidden || !resLista.length) return;
        e.preventDefault(); escolherRes(resIdx);
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        el.q.value = ''; resLista = []; esconderRes(); el.q.blur();
      }
    });
    el.q.addEventListener('input', () => {
      if (!el.q.value.trim()) { resLista = []; esconderRes(); }
      opts.onBusca?.(el.q.value);
    });
    el.q.addEventListener('focus', () => { if (el.q.value.trim() && el.res.innerHTML) { el.res.hidden = false; el.q.setAttribute('aria-expanded', 'true'); } });
  }
  el.res?.addEventListener('click', e => { const b = e.target.closest('[role="option"]'); if (b) escolherRes(+b.dataset.i); });
  el.res?.addEventListener('pointermove', e => { const b = e.target.closest('[role="option"]'); if (b && +b.dataset.i !== resIdx) ativarRes(+b.dataset.i); });

  /* ================================ DICA E AVISO ================================ */
  function dica(no, p) {
    if (!el.dica) return;
    if (!no || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { el.dica.hidden = true; return; }
    let sub = rotulo(no);
    if (no.kind === 'dept') { const d = deptsAtuais.find(x => x.name === no.name); const q = d && d.list ? d.list.length : 0; sub = `${q} ${q === 1 ? 'nota' : 'notas'}`; }
    // conta do halo (rotina): nome + horários + próxima execução
    const rot = no.kind === 'routine' ? rotinaDe(no) : null;
    if (rot) { const pr = proximaDe(rot); sub = `${rot.resumo}${pr ? ` · próxima ${pr.falta}` : ''}`; }
    const deg = no.links && !rot ? graus(no) : null;
    el.dica.style.setProperty('--c', cor(no));
    el.dica.innerHTML = `<span class="dica-nm">${esc(no.name)}</span><span class="dica-sub"><i class="pt" aria-hidden="true"></i>${esc(sub)}${deg != null && no.kind !== 'dept' ? ` · ${deg} ${deg === 1 ? 'conexão' : 'conexões'}` : ''}</span>`;
    el.dica.hidden = false;
    const W = app.clientWidth, H = app.clientHeight, w = el.dica.offsetWidth, h = el.dica.offsetHeight, m = 16;
    let x = p.x + 16, y = p.y + 16;
    if (x + w > W - m) x = p.x - w - 16;
    if (y + h > H - m) y = p.y - h - 16;
    el.dica.style.left = `${n1(Math.max(m, Math.min(W - w - m, x)))}px`;
    el.dica.style.top = `${n1(Math.max(m, Math.min(H - h - m, y)))}px`;
  }

  let avisoT = 0, avisoSai = null;
  function aviso(texto, ms = 3200, tom) {
    if (!el.aviso) return;
    clearTimeout(avisoT);
    if (avisoSai) { const a = avisoSai; avisoSai = null; try { a.cancel(); } catch (_) {} }
    if (!texto) { el.aviso.hidden = true; return; }
    const jaVisivel = !el.aviso.hidden;
    el.aviso.textContent = String(texto);
    el.aviso.dataset.tom = tom === 'alerta' || tom === 'ok' || tom === 'rever' ? tom : '';
    el.aviso.hidden = false;
    if (!reduz() && !jaVisivel) anim(el.aviso, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
    if (ms) avisoT = setTimeout(() => {
      if (reduz()) { el.aviso.hidden = true; return; }
      const a = anim(el.aviso, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
      if (!a) { el.aviso.hidden = true; return; }
      avisoSai = a;
      a.finished.then(() => { if (avisoSai !== a) return; avisoSai = null; el.aviso.hidden = true; try { a.cancel(); } catch (_) {} }, () => {});
    }, ms);
  }

  /* ================================ MENU E VISÃO ================================ */
  let menuTravado = false;
  function menu(aberto) {
    if (!el.menu) return false;
    if (aberto === undefined && menuTravado) return !el.menu.hidden; // o mesmo clique já alternou
    const o = aberto === undefined ? el.menu.hidden : !!aberto;
    el.menu.hidden = !o;
    el.menuBtn?.setAttribute('aria-expanded', String(o));
    return o;
  }
  el.menuBtn?.addEventListener('click', () => { menu(); menuTravado = true; setTimeout(() => { menuTravado = false; }, 0); });

  function visao(v) {
    const aneis = v === 'aneis';
    el.visaoRobo?.setAttribute('aria-pressed', String(!aneis));
    el.visaoAneis?.setAttribute('aria-pressed', String(aneis));
    app.dataset.visao = aneis ? 'aneis' : 'robo';
    if (el.aneis) el.aneis.hidden = !aneis;
    if (el.palco) el.palco.hidden = aneis;
    if (el.legenda) el.legenda.innerHTML = legendaHTML(aneis ? 'aneis' : 'robo');
    if (aneis) feixe(null);
  }
  if (typeof opts.onVisao === 'function') {
    el.visaoRobo?.addEventListener('click', () => opts.onVisao('robo'));
    el.visaoAneis?.addEventListener('click', () => opts.onVisao('aneis'));
  }
  if (el.legenda) el.legenda.innerHTML = legendaHTML(app.dataset.visao === 'aneis' ? 'aneis' : 'robo');

  /* ================================ FEIXE ================================ */
  const NS = 'http://www.w3.org/2000/svg';
  const fx = { caminhos: [], corr: [], halo: [] };
  if (el.feixe) {
    const mk = (tag, cls, at = {}) => { const e = doc.createElementNS(NS, tag); e.setAttribute('class', cls); for (const k in at) e.setAttribute(k, at[k]); el.feixe.appendChild(e); return e; };
    fx.caminhos = ['fx-halo', 'fx-brilho', 'fx-nucleo', 'fx-fluxo'].map(c => mk('path', c));
    fx.anel = mk('circle', 'fx-anel', { r: 9 });
    fx.orig = mk('circle', 'fx-orig', { r: 3.2 });
    for (let i = 0; i < 2; i++) { fx.halo.push(mk('circle', 'fx-corr-h', { r: 7 })); fx.corr.push(mk('circle', 'fx-corr', { r: 2.6 })); }
    fx.fim = mk('path', 'fx-fim');
  }
  function feixe(de, ate) {
    if (!el.feixe || !fx.fim) return;
    const ok = de && ate && Number.isFinite(de.x) && Number.isFinite(de.y) && Number.isFinite(ate.x) && Number.isFinite(ate.y);
    if (!ok) { el.feixe.classList.remove('on'); return; }
    el.feixe.classList.add('on');
    const dx = ate.x - de.x, dy = ate.y - de.y, horiz = Math.abs(dx) >= Math.abs(dy);
    const p0 = de, p3 = ate;
    const p1 = horiz ? { x: de.x + dx * .42, y: de.y - Math.min(70, Math.abs(dx) * .16) } : { x: de.x, y: de.y + dy * .42 };
    const p2 = horiz ? { x: ate.x - dx * .3, y: ate.y } : { x: ate.x, y: ate.y - dy * .3 };
    const d = `M${n1(p0.x)} ${n1(p0.y)}C${n1(p1.x)} ${n1(p1.y)} ${n1(p2.x)} ${n1(p2.y)} ${n1(p3.x)} ${n1(p3.y)}`;
    for (const c of fx.caminhos) c.setAttribute('d', d);
    for (const c of [fx.anel, fx.orig]) { c.setAttribute('cx', n1(de.x)); c.setAttribute('cy', n1(de.y)); }
    const s = 13, k = 6;
    if (horiz) { const sx = Math.sign(dx) || 1; fx.fim.setAttribute('d', `M${n1(ate.x + k * sx)} ${n1(ate.y - s)}H${n1(ate.x)}V${n1(ate.y + s)}H${n1(ate.x + k * sx)}`); }
    else { const sy = Math.sign(dy) || 1; fx.fim.setAttribute('d', `M${n1(ate.x - s)} ${n1(ate.y + k * sy)}V${n1(ate.y)}H${n1(ate.x + s)}V${n1(ate.y + k * sy)}`); }
    const corre = !reduz();
    const t = performance.now() / 1500;
    fx.corr.forEach((c, i) => {
      const u = (t + i * .5) % 1, p = bez(p0, p1, p2, p3, u), a = corre ? Math.sin(Math.PI * u).toFixed(2) : '0';
      for (const e of [c, fx.halo[i]]) { e.setAttribute('cx', n1(p.x)); e.setAttribute('cy', n1(p.y)); e.style.opacity = a; }
    });
  }

  /* ================================ LEITOR ================================ */
  let seqLeitor = 0, aberto = false, noAtual = null, grafo = null, focoAntes = null, arrasteY = 0;
  /* Celular: a folha cobre 85% da tela; o que fica atrás dela sai do Tab e do leitor de tela (inert). */
  const atras = () => [el.topo, el.marca, el.trilho, el.recentes, el.leque, el.pergunta].filter(Boolean);
  function marcarInerte(on) { for (const e of atras()) { if (on) e.setAttribute('inert', ''); else e.removeAttribute('inert'); } }

  function conexoesHTML(no) {
    const nodes = grafo && grafo.nodes ? grafo.nodes : [];
    const out = [...(no.links || [])].map(id => nodes[id]).filter(Boolean);
    const inn = [...(no.back || [])].filter(id => !(no.links && no.links.has(id))).map(id => nodes[id]).filter(Boolean);
    let h = '';
    if (no.kind === 'skill' && Array.isArray(no.files) && no.files.length) {
      h += `<section class="cx-grupo"><h3 class="hud-rot">Arquivos da skill <b>${no.files.length}</b></h3><ul class="arqs">${no.files.slice(0, 30).map(f =>
        `<li><span>${esc(f.name || f.path)}</span><b>${esc(kb(f.size || 0))}</b></li>`).join('')}${no.files.length > 30 ? `<li class="cx-mais">e mais ${no.files.length - 30}</li>` : ''}</ul></section>`;
    }
    const grupo = (titulo, lista) => (lista.length
      ? `<section class="cx-grupo"><h3 class="hud-rot">${titulo} <b>${lista.length}</b></h3><div class="cx-lista">${lista.slice(0, 40).map(m =>
        `<button type="button" class="cx" data-id="${m.id}" style="--c:${cor(m)}" title="${esc(rotulo(m))}"><i class="pt" aria-hidden="true"></i><span class="nm">${esc(m.name)}</span></button>`).join('')}${lista.length > 40 ? `<span class="cx-mais">e mais ${lista.length - 40}</span>` : ''}</div></section>`
      : '');
    h += grupo('Cita', out) + grupo('Citada por', inn);
    if (!out.length && !inn.length) h += `<p class="cx-vazio">Nenhum link ainda. Use ${esc('[[nome da nota]]')} no Obsidian para ligar esta nota ao resto do cérebro.</p>`;
    return h;
  }

  function montarLeitor(no, G) {
    noAtual = no;
    if (G) grafo = G;
    const c = cor(no), nome = String(no.name || '');
    el.leitor.style.setProperty('--c', c);
    const selos = [`<span class="selo selo-tipo">${esc(KIND_LABEL[no.kind] || 'Nota')}</span>`];
    if (no.kind === 'memory' && no.dept) selos.push(`<span class="selo"><i class="pt" aria-hidden="true"></i>${esc(no.dept)}</span>`);
    for (const t of (Array.isArray(no.tags) ? no.tags : []).slice(0, 4)) selos.push(`<span class="selo selo-tag">#${esc(String(t).replace(/^#/, ''))}</span>`);
    if (no.virtual) selos.push('<span class="selo selo-aviso">Ainda não existe no vault</span>');
    if (el.selos) el.selos.innerHTML = selos.join('');
    if (el.titulo) el.titulo.innerHTML = `<span class="sr">${esc(nome)}</span><span class="dig" aria-hidden="true">${esc(nome)}</span>`;
    if (el.caminho) el.caminho.textContent = no.path || '';
    if (el.meta) {
      const deg = graus(no), meta = [];
      if (no.kind === 'skill' && Array.isArray(no.files) && no.files.length) meta.push(`<span><b>${no.files.length}</b> ${no.files.length === 1 ? 'arquivo' : 'arquivos'}</span>`);
      if (no.size) meta.push(`<span><b>${esc(kb(no.size))}</b></span>`);
      meta.push(`<span><b>${deg}</b> ${deg === 1 ? 'conexão' : 'conexões'}</span>`);
      if (no.mtime) meta.push(`<span>editada ${esc(relTime(no.mtime))}</span>`);
      el.meta.innerHTML = meta.join('');
    }
    let fm = {}, body = '';
    try { const p = parseFM(String(no.text || '')); fm = p.fm || {}; body = p.body || ''; } catch (_) { body = String(no.text || ''); }
    if (el.fm) {
      // o que já está nos selos (departamento e até 4 tags) não se repete nos chips
      const tagsNosSelos = (Array.isArray(no.tags) ? no.tags.length : 0) <= 4;
      const jaNosSelos = (k, v) => (k === 'tags' && tagsNosSelos)
        || (k === 'departamento' && no.kind === 'memory' && String(Array.isArray(v) ? v[0] : v).replace(/\[\[|\]\]/g, '').trim() === no.dept);
      const chips = Object.entries(fm).filter(([k, v]) => v != null && v !== '' && (!Array.isArray(v) || v.length) && !jaNosSelos(k, v)).slice(0, 12)
        .map(([k, v]) => `<span class="fm-chip"><b>${esc(k)}</b><span>${fmValor(Array.isArray(v) ? v.join(', ') : String(v))}</span></span>`);
      el.fm.innerHTML = chips.join('');
      el.fm.hidden = !chips.length;
    }
    if (el.texto) {
      const fonte = body.trim() ? body : '*Nota vazia.*';
      let blocos = null;
      if (blocosMD) { try { blocos = blocosMD(fonte); } catch (_) { blocos = null; } }
      el.texto.innerHTML = Array.isArray(blocos) ? blocos.join('') : renderMD(fonte);
      const pri = el.texto.firstElementChild; // o título já está no cabeçalho: tira o H1 repetido
      if (pri && /^H[1-6]$/.test(pri.tagName) && chave(pri.textContent) === chave(nome) && el.texto.children.length > 1) pri.remove();
    }
    if (el.conexoes) el.conexoes.innerHTML = conexoesHTML(no);
    if (el.corpo) el.corpo.scrollTop = 0;
    if (el.obsidian) el.obsidian.disabled = !!no.virtual;
    botaoFluxo(no);
  }
  /* Botão do leitor que leva ao funil: "← Voltar ao fluxo" (o leitor abriu no lugar de um funil) ou
     "Ver o fluxo" (a nota aberta é uma rotina). Sem nenhum dos dois, some. */
  let leitorVoltar = null;
  function botaoFluxo(no) {
    if (!el.lFluxo) return;
    const alvo = leitorVoltar || (no && no.kind === 'routine' ? no : null);
    el.lFluxo.hidden = !alvo;
    el.lFluxo.dataset.modo = leitorVoltar ? 'voltar' : 'ver';
    const t = el.lFluxo.querySelector('span');
    if (t) t.textContent = leitorVoltar ? 'Voltar ao fluxo' : 'Ver o fluxo';
    el.lFluxo.title = alvo ? `${leitorVoltar ? 'Voltar ao fluxo de' : 'Ver o fluxo de'} ${alvo.name}` : '';
  }
  /* voltarFluxo(no|null): o app avisa que a rotina do "← Voltar ao fluxo" mudou (recarga do vault) ou saiu dele */
  function voltarFluxo(no) {
    leitorVoltar = no || null;
    if (aberto) botaoFluxo(noAtual);
  }
  el.lFluxo?.addEventListener('click', () => {
    const alvo = leitorVoltar || (noAtual && noAtual.kind === 'routine' ? noAtual : null);
    if (alvo) opts.onFluxoDoLeitor?.(alvo, { origem: centroEl(el.lFluxo) });
  });

  function digitar(seq) {
    digitarEm(el.titulo, String(noAtual && noAtual.name || ''), () => seq === seqLeitor);
  }
  /* Título digitado letra a letra (leitor e funil); vivo() = false para no meio (outra nota abriu). */
  function digitarEm(titulo, texto, vivo) {
    const alvo = titulo && titulo.querySelector('.dig'); if (!alvo) return;
    const letras = Array.from(String(texto || ''));
    const total = Math.min(720, Math.max(240, letras.length * 26));
    const t0 = performance.now();
    const quadro = agora => {
      if (!vivo()) return;
      const k = Math.min(1, (agora - t0) / total), n = Math.round(letras.length * k);
      alvo.innerHTML = `${esc(letras.slice(0, n).join(''))}<span class="cursor"></span><span class="fantasma">${esc(letras.slice(n).join(''))}</span>`;
      if (k < 1) requestAnimationFrame(quadro);
      else setTimeout(() => { if (vivo()) alvo.textContent = letras.join(''); }, 900);
    };
    requestAnimationFrame(quadro);
  }
  function varrer(atraso = 0, mold = moldura) {
    const v = mold && mold.querySelector('.varredura'); if (!v || reduz()) return;
    const h = mold.clientHeight;
    anim(v, [{ transform: 'translateY(-100%)', opacity: 1 }, { transform: `translateY(${h}px)`, opacity: .8 }],
      { duration: Math.min(1050, 420 + h * .55), delay: atraso, easing: 'cubic-bezier(.45,.05,.3,1)' });
  }
  function entrarConteudo(seq) {
    if (seq !== seqLeitor || !moldura) return;
    moldura.classList.remove('montando');
    if (reduz()) return;
    anim(moldura.querySelector('header'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    digitar(seq);
    cascata([...(el.selos ? el.selos.children : [])], 40, 40, 8, 6);
    cascata([...(el.fm ? el.fm.children : [])], 120, 22, 12, 6);
    const blocos = [...(el.texto ? el.texto.children : [])];
    cascata(blocos, 180, 34, 40, 10);
    anim(el.conexoes, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 420, delay: 220 + Math.min(blocos.length, 40) * 34, easing: 'ease-out', fill: 'backwards' });
    varrer(0);
  }
  /* O título recebe o foco (leitor de tela anuncia a nota); o contorno só aparece para quem usa o teclado. */
  let viaTeclado = false;
  doc.addEventListener('keydown', e => { if (!e.ctrlKey && !e.metaKey && !e.altKey) viaTeclado = true; }, true);
  doc.addEventListener('pointerdown', () => { viaTeclado = false; }, true);
  function focar(titulo = el.titulo) {
    if (!titulo) return;
    titulo.tabIndex = -1;
    titulo.classList.toggle('foco-tecla', viaTeclado);
    try { titulo.focus({ preventScroll: true }); } catch (_) {}
  }
  function semente() {
    let s = app.querySelector(':scope > .semente');
    if (!s) { s = doc.createElement('div'); s.className = 'semente'; s.setAttribute('aria-hidden', 'true'); app.appendChild(s); }
    return s;
  }
  /* No fim da animação a linha de luz encolhe para 0: parada na posição antiga, depois de um resize ela
     passaria da borda do #app e o deixaria rolar (scrollIntoView / foco). */
  function soltarSemente(s, a) {
    if (a && a.finished) a.finished.then(() => { if (typeof s.getAnimations !== 'function' || !s.getAnimations().length) s.style.width = '0px'; }, () => {});
    return a;
  }
  const EASE = 'cubic-bezier(.3,.7,.2,1)';
  /* Abertura desktop: a esfera vira uma linha de luz no centro do painel e a moldura se abre na vertical. */
  function abrirHolo(origem, dur, painel = el.leitor, mold = moldura) {
    const r = local(painel.getBoundingClientRect()), c = centroDe(r);
    const p = origem && Number.isFinite(origem.x) && Number.isFinite(origem.y) ? origem : c;
    const s = semente();
    s.style.left = `${n1(r.x)}px`; s.style.top = `${n1(c.y - 1)}px`; s.style.width = `${n1(r.width)}px`;
    const k = 14 / Math.max(1, r.width);
    soltarSemente(s, anim(s, [
      { transform: `translate(${n1(p.x - c.x)}px, ${n1(p.y - c.y)}px) scale(${k}, 7)`, opacity: 1, easing: EASE },
      { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1, offset: .42 },
      { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1, offset: .58, easing: 'ease-in' },
      { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 0 },
    ], { duration: dur }));
    const a = anim(mold, [
      { transform: 'scaleY(.004)', opacity: 0 },
      { transform: 'scaleY(.004)', opacity: 0, offset: .4 },
      { transform: 'scaleY(.004)', opacity: 1, offset: .42, easing: EASE },
      { transform: 'scaleY(1)', opacity: 1 },
    ], { duration: dur });
    mold.querySelectorAll('.canto').forEach(e => anim(e, [{ transform: 'scale(.3)', opacity: .4 }, { transform: 'scale(1.35)', opacity: 1, offset: .55 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 420, delay: dur * .78, easing: 'ease-out', fill: 'backwards' }));
    return a;
  }
  /* Glitch da troca (cortes horizontais + ruído); devolve a animação da moldura. */
  function glitch(mold) {
    const a = anim(mold, [
      { transform: 'none', clipPath: 'inset(0 0 0 0)' },
      { transform: 'translateX(-7px) skewX(-1.5deg)', clipPath: 'inset(8% 0 52% 0)', offset: .18 },
      { transform: 'translateX(6px)', clipPath: 'inset(46% 0 12% 0)', offset: .36 },
      { transform: 'translateX(-3px) skewX(1deg)', clipPath: 'inset(0 0 0 0)', offset: .54 },
      { transform: 'translateX(2px)', clipPath: 'inset(24% 0 30% 0)', offset: .72 },
      { transform: 'none', clipPath: 'inset(0 0 0 0)' },
    ], { duration: 300, easing: 'linear' });
    anim(mold.querySelector('.ruido'), [{ opacity: 0 }, { opacity: .9, transform: 'translateY(-6px)', offset: .2 }, { opacity: .25, offset: .5 }, { opacity: .8, transform: 'translateY(5px)', offset: .7 }, { opacity: 0 }], { duration: 300 });
    return a;
  }
  /* Troca: glitch rápido; o conteúdo é trocado no meio. */
  async function trocar(no, G, seq) {
    const a = glitch(moldura);
    await espera(140);
    if (seq !== seqLeitor) return;
    montarLeitor(no, G);
    moldura.classList.add('montando');
    await fim(a);
  }

  async function abrirLeitor(no, G, o = {}) {
    if (!no || no.kind === 'dept' || !el.leitor || !moldura) return;
    const seq = ++seqLeitor;
    const estavaAberto = aberto && !el.leitor.hidden;
    // o leitor abre no lugar do funil (link de etapa, "Ver nota completa"): o funil sai na hora e o glitch cobre a troca
    // (ou no lugar do painel Saúde: clicar num sistema dele abre a nota do projeto)
    const doSaude = !estavaAberto && saudeAb && !!el.saude && !el.saude.hidden;
    const doFluxo = (!estavaAberto && fluxoAb && !!el.fluxo && !el.fluxo.hidden) || doSaude;
    if (!estavaAberto && !doFluxo && !el.leitor.contains(doc.activeElement)) focoAntes = doc.activeElement;
    if ('voltarFluxo' in o) leitorVoltar = o.voltarFluxo || null;
    if (doSaude) esconderSaudeJa(); else if (doFluxo) esconderFluxoJa();
    pararAnims(el.leitor);
    moldura.style.transform = '';
    arrasteY = 0;
    aberto = true;
    app.classList.add('lendo');
    marcarInerte(celular());
    esconderRes();
    if (estavaAberto) {
      const focoDentro = el.leitor.contains(doc.activeElement);
      if (reduz()) {
        montarLeitor(no, G);
        moldura.classList.remove('montando');
        await fim(anim(el.corpo, [{ opacity: .25 }, { opacity: 1 }], { duration: 160 }));
      } else {
        await trocar(no, G, seq);
        if (seq !== seqLeitor) return;
        entrarConteudo(seq);
      }
      if (seq === seqLeitor && (focoDentro || doc.activeElement === doc.body)) focar();
      return;
    }
    montarLeitor(no, G);
    moldura.classList.toggle('montando', !reduz());
    el.leitor.hidden = false;
    if (el.corpo) el.corpo.scrollTop = 0;   // escondido, o scrollTop = 0 do montarLeitor não vale (a nota nova abria no meio)
    if (reduz()) {
      await fim(anim(moldura, [{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' }));
      if (seq === seqLeitor) focar();
      return;
    }
    if (doFluxo) {
      const a = glitch(moldura);
      setTimeout(() => entrarConteudo(seq), 140);
      await fim(a);
      if (seq === seqLeitor) focar();
      return;
    }
    const cel = celular();
    const dur = cel ? 460 : 600;
    const a = cel
      ? anim(moldura, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: dur, easing: 'cubic-bezier(.2,.9,.25,1)' })
      : abrirHolo(o.origem, dur);
    setTimeout(() => entrarConteudo(seq), dur * (cel ? .4 : .62));
    await fim(a);
    if (seq === seqLeitor) focar();
  }
  /* O leitor sai na hora, sem dobrar (o funil abre no lugar dele com o glitch). */
  function esconderLeitorJa() {
    ++seqLeitor;
    aberto = false;
    pararAnims(el.leitor);
    moldura.style.transform = '';
    el.leitor.hidden = true;
    moldura.classList.remove('montando');
    noAtual = null; leitorVoltar = null; arrasteY = 0;
  }

  async function fecharLeitor() {
    const r = el.leitor ? local(el.leitor.getBoundingClientRect()) : new DOMRect(0, 0, 0, 0);
    const c = centroDe(r);
    if (!el.leitor || !moldura || el.leitor.hidden) { aberto = false; if (!fluxoAb && !saudeAb) { app.classList.remove('lendo'); marcarInerte(false); } return c; }
    const seq = ++seqLeitor;
    aberto = false;
    app.classList.remove('lendo');
    pararAnims(el.leitor);
    moldura.style.transform = '';
    feixe(null);
    let a;
    if (reduz()) a = anim(moldura, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
    else if (celular()) a = anim(moldura, [{ transform: `translateY(${n1(arrasteY)}px)` }, { transform: 'translateY(100%)' }], { duration: arrasteY ? 240 : 300, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    else {
      for (const e of [moldura.querySelector('header'), el.corpo]) anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 130, fill: 'forwards' });
      a = anim(moldura, [
        { transform: 'scaleY(1)', opacity: 1, easing: 'cubic-bezier(.6,0,.8,.3)' },
        { transform: 'scaleY(.004)', opacity: 1, offset: .5 },
        { transform: 'scaleY(.004)', opacity: 0, offset: .52 },
        { transform: 'scaleY(.004)', opacity: 0 },
      ], { duration: 440, fill: 'forwards' });
      const s = semente();
      s.style.left = `${n1(r.x)}px`; s.style.top = `${n1(c.y - 1)}px`; s.style.width = `${n1(r.width)}px`;
      const k = 14 / Math.max(1, r.width);
      soltarSemente(s, anim(s, [
        { transform: 'scale(1, 1)', opacity: 0 },
        { transform: 'scale(1, 1)', opacity: 0, offset: .46 },
        { transform: 'scale(1, 1)', opacity: 1, offset: .5, easing: 'cubic-bezier(.5,0,.3,1)' },
        { transform: `scale(${k}, 7)`, opacity: 1, offset: .94 },
        { transform: `scale(${k}, 7)`, opacity: 0 },
      ], { duration: 440 }));
    }
    arrasteY = 0;
    marcarInerte(false);
    await fim(a);
    if (seq !== seqLeitor) return c; // reaberto no meio do caminho
    el.leitor.hidden = true;
    pararAnims(el.leitor);
    moldura.classList.remove('montando');
    noAtual = null; leitorVoltar = null;
    const ativo = doc.activeElement;
    if (!ativo || ativo === doc.body || el.leitor.contains(ativo)) {
      if (focoAntes && focoAntes.isConnected && typeof focoAntes.focus === 'function' && focoAntes !== doc.body) { try { focoAntes.focus({ preventScroll: true }); } catch (_) {} }
      else if (ativo && el.leitor.contains(ativo)) ativo.blur();
    }
    focoAntes = null;
    return c;
  }

  /* ================================ FUNIL DA ROTINA ================================ */
  let seqFluxo = 0, fluxoAb = false, fluxoNo = null, fluxoR = null, arrasteYF = 0;
  const tituloFluxo = r => String((r && r.titulo) || (fluxoNo && fluxoNo.name) || '');

  /* "Notas ligadas": as conexões da nota da rotina (cita e citada por), num grupo só, como os botões do leitor */
  function ligadasHTML(no) {
    const nodes = grafo && grafo.nodes ? grafo.nodes : [];
    const ids = [...new Set([...(no.links || []), ...(no.back || [])])];
    const lista = ids.map(id => nodes[id]).filter(m => m && m.kind !== 'dept');
    if (!lista.length) return '';
    return `<section class="cx-grupo"><h3 class="hud-rot">Notas ligadas <b>${lista.length}</b></h3><div class="cx-lista">${lista.slice(0, 40).map(m =>
      `<button type="button" class="cx" data-id="${m.id}" style="--c:${cor(m)}" title="${esc(rotulo(m))}"><i class="pt" aria-hidden="true"></i><span class="nm">${esc(m.name)}</span></button>`).join('')}${lista.length > 40 ? `<span class="cx-mais">e mais ${lista.length - 40}</span>` : ''}</div></section>`;
  }
  function etapasHTML(passos) {
    const n = passos.length;
    return passos.map((p, i) => {
      const t = tipoEtapa(p.tipo), prox = passos[i + 1], t2 = prox ? tipoEtapa(prox.tipo) : null;
      const w = n > 1 ? 100 - 32 * (i / (n - 1)) : 100;   // cada etapa um pouco mais estreita: a última tem 68% da primeira
      const notas = (Array.isArray(p.notas) ? p.notas : []).map(nt => {
        const tom = nt.tom === 'falha' || nt.tom === 'atencao' ? nt.tom : 'info';
        return `<li class="nota nota-${tom}">${tom === 'falha' ? '<b>Se falhar</b>' : tom === 'atencao' ? '<b>Atenção</b>' : ''}<span>${nt.html || ''}</span></li>`;
      }).join('');
      return `<li class="etapa" data-i="${i}" style="--c:${corToken(t.cor)};${t2 ? `--c2:${corToken(t2.cor)};` : ''}--w:${n1(w)}%">`
        + `<div class="etapa-cartao"><span class="etapa-ico">${ICONE[p.tipo] || ICONE.processa}</span><div class="etapa-txt">`
        + `<p class="etapa-cab"><span class="etapa-tipo">${esc(p.rotulo || t.rotulo)}</span><span class="etapa-saude" data-tipo="${esc(p.tipo)}" hidden></span><span class="etapa-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span></p>`
        + `<p class="etapa-texto">${p.html || esc(p.texto || '')}</p><p class="etapa-motivo" hidden></p>${notas ? `<ul class="etapa-notas" role="list">${notas}</ul>` : ''}</div></div>`
        + `${t2 ? '<span class="conector" aria-hidden="true"><i style="--k:0"></i><i style="--k:1"></i><i style="--k:2"></i></span>' : ''}</li>`;
    }).join('');
  }
  function montarFluxo(no, r, G) {
    fluxoNo = no; fluxoR = r || null;
    if (G) grafo = G;
    el.fluxo.style.setProperty('--c', cor(no));
    const nome = tituloFluxo(r);
    if (el.fSelos) {
      // a situação vira um selo ao lado do grupo (antes era um chip numa linha só dela)
      const grupo = r && r.grupo && semAcento(r.grupo).trim() !== 'rotinas' ? r.grupo : '';   // sem grupo nem departamento: só "Rotina" (não "Rotina · Rotinas")
      const selos = [`<span class="selo selo-tipo">Rotina${grupo ? ` · ${esc(grupo)}` : ''}</span>`];
      if (r) selos.push(`<span class="selo selo-sit" style="--c-selo:${corSituacao(r.status)}"><i class="pt" aria-hidden="true"></i><span class="sr">situação: </span>${esc(r.status || 'situação não registrada')}</span>`);
      el.fSelos.innerHTML = selos.join('');
    }
    if (el.fTitulo) el.fTitulo.innerHTML = `<span class="sr">${esc(no.name || nome)}</span><span class="dig" aria-hidden="true">${esc(nome)}</span>`;
    if (el.fChips) {
      const chip = (k, v, cls = '') => `<span class="fm-chip${cls}"><b>${k}</b><span>${v}</span></span>`;
      const chips = [];
      if (r) {
        const temHora = !!(r.horarios && r.horarios.length);
        chips.push(chip(temHora ? 'horários' : 'quando', esc(temHora ? r.horarios.join(' · ') : r.resumo || '—')));
        const p = proximaDe(r);
        if (p) chips.push(chip('próxima', esc(p.texto), ' f-prox'));
        if (r.maquina) chips.push(chip('onde', esc(r.maquina)));
      }
      el.fChips.innerHTML = chips.join('');
    }
    const passos = r && r.fluxo && Array.isArray(r.fluxo.passos) ? r.fluxo.passos : [];
    if (el.fDeduzido) el.fDeduzido.hidden = !(r && r.fluxo && r.fluxo.deduzido);
    if (el.fEtapas) el.fEtapas.innerHTML = passos.length ? etapasHTML(passos) : '';
    if (el.fFunil) { el.fFunil.classList.remove('vivo'); el.fFunil.hidden = !passos.length; }
    if (el.fSilhueta) el.fSilhueta.innerHTML = '';
    if (el.fConexoes) el.fConexoes.innerHTML = ligadasHTML(no) || (passos.length ? '' : '<p class="cx-vazio">A nota desta rotina ainda não descreve o fluxo. Escreva uma seção Fluxo nela.</p>');
    if (el.fCorpo) el.fCorpo.scrollTop = 0;
    marcarSaudeFluxo();
  }

  /* Silhueta do funil (SVG atrás das etapas): cone que contém todos os cartões, aro elíptico em cima,
     costelas tracejadas entre as etapas e um bico embaixo com a gota. Medido com offset* (ignora as animações). */
  function desenharFunil() {
    const svg = el.fSilhueta, caixa = el.fFunil;
    if (!svg || !caixa || !el.fluxo || el.fluxo.hidden || caixa.hidden) return;
    const W = caixa.clientWidth, H = caixa.clientHeight;
    const cartoes = [...el.fEtapas.querySelectorAll('.etapa-cartao')];
    if (!W || !H || !cartoes.length) { svg.innerHTML = ''; return; }
    const rs = cartoes.map(c => { let x = 0, y = 0, e = c; while (e && e !== caixa) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { l: x, t: y, b: y + c.offsetHeight }; });
    if (rs.some(r => !Number.isFinite(r.l))) return;
    const P = 16, topo = rs[0].t - 12, ult = rs[rs.length - 1], fundo = ult.b + 10, cx = W / 2;
    // o aro começa o mais aberto possível (as etapas têm recuo lateral no CSS): é essa folga sobre a 1ª etapa que
    // deixa a borda inclinar; colado na 1ª etapa, o cone saía reto (x = 1 do aro até a última etapa)
    const xa = Math.max(1, rs[0].l - 2 * P);
    // borda esquerda em linha reta de (xa, topo) a (xb, fundo), sem cortar nenhum cartão
    let xb = ult.l - P;
    for (const r of rs) { const k = (r.b - topo) / Math.max(1, fundo - topo); if (k > 0) xb = Math.min(xb, xa + (r.l - P * 0.55 - xa) / k); }
    xb = Math.max(xa, Math.min(xb, cx - 30));
    const xEm = y => xa + (xb - xa) * (y - topo) / Math.max(1, fundo - topo);
    // abaixo da última etapa o cone continua fechando até o bico (o "gargalo" do funil) e o bico desce reto
    const pesc = 12, b1 = fundo + 44, b2 = fundo + 62;
    const d = `M${n1(xa)} ${n1(topo)}L${n1(xb)} ${n1(fundo)}C${n1(xb)} ${n1(fundo + 18)} ${n1(cx - pesc)} ${n1(b1 - 16)} ${n1(cx - pesc)} ${n1(b1)}L${n1(cx - pesc)} ${n1(b2)}`
      + `L${n1(cx + pesc)} ${n1(b2)}L${n1(cx + pesc)} ${n1(b1)}C${n1(cx + pesc)} ${n1(b1 - 16)} ${n1(W - xb)} ${n1(fundo + 18)} ${n1(W - xb)} ${n1(fundo)}L${n1(W - xa)} ${n1(topo)}Z`;
    let costelas = '';
    for (let i = 0; i < rs.length - 1; i++) { const y = (rs[i].b + rs[i + 1].t) / 2, x = xEm(y) + 3; costelas += `M${n1(x)} ${n1(y)}H${n1(W - x)}`; }
    svg.setAttribute('viewBox', `0 0 ${n1(W)} ${n1(H)}`);
    svg.innerHTML = '<defs><linearGradient id="fGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--holo);stop-opacity:.13"/><stop offset=".72" style="stop-color:var(--holo);stop-opacity:.045"/><stop offset="1" style="stop-color:var(--holo);stop-opacity:.14"/></linearGradient></defs>'
      + `<path class="fs-brilho" d="${d}"/><path class="fs-corpo" d="${d}"/>`
      + (costelas ? `<path class="fs-costela" d="${costelas}"/>` : '')
      + `<ellipse class="fs-aro" cx="${n1(cx)}" cy="${n1(topo)}" rx="${n1(cx - xa)}" ry="7"/>`
      + `<circle class="fs-gota" cx="${n1(cx)}" cy="${n1(b2 + 3)}" r="2.6"/>`;
  }
  let funilRaf = 0;
  const redesenharFunil = () => { if (funilRaf) return; funilRaf = requestAnimationFrame(() => { funilRaf = 0; desenharFunil(); }); };
  if (el.fFunil && typeof ResizeObserver === 'function') { try { new ResizeObserver(redesenharFunil).observe(el.fFunil); } catch (_) {} }
  try { doc.fonts?.ready?.then(redesenharFunil); } catch (_) {}

  /* Abertura: moldura como a do leitor, título digitado, etapas caindo uma a uma (100 ms entre elas), cada
     conector se desenha depois da etapa de cima e, no fim, as partículas começam a descer. */
  function entrarFluxo(seq) {
    if (seq !== seqFluxo || !molduraF) return;
    molduraF.classList.remove('montando');
    desenharFunil();
    const funil = el.fFunil;
    if (reduz()) { funil?.classList.add('vivo'); return; }   // movimento reduzido: tudo pronto (o CSS segura as partículas)
    funil?.classList.remove('vivo');
    anim(molduraF.querySelector('header'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    digitarEm(el.fTitulo, tituloFluxo(fluxoR), () => seq === seqFluxo);
    cascata([...(el.fSelos ? el.fSelos.children : [])], 40, 40, 8, 6);
    cascata([...(el.fChips ? el.fChips.children : [])], 110, 30, 8, 6);
    if (el.fDeduzido && !el.fDeduzido.hidden) cascata([el.fDeduzido], 160, 0, 1, 6);
    const base = 240, passo = 100;
    const etapas = el.fEtapas ? [...el.fEtapas.children] : [];
    anim(el.fSilhueta, [{ opacity: 0 }, { opacity: 1 }], { duration: 520, delay: 120, easing: 'ease-out', fill: 'backwards' });
    etapas.forEach((li, i) => {
      const atraso = base + Math.min(i, 14) * passo;
      anim(li.querySelector('.etapa-cartao'), [
        { opacity: 0, transform: 'translateY(-26px) scale(.97)' },
        { opacity: 1, transform: 'translateY(2px) scale(1)', offset: .72 },
        { opacity: 1, transform: 'none' },
      ], { duration: 380, delay: atraso, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'backwards' });
      const cn = li.querySelector('.conector');
      if (cn) anim(cn, [{ transform: 'scaleY(0)', opacity: .3 }, { transform: 'scaleY(1)', opacity: 1 }], { duration: 220, delay: atraso + 300, easing: 'ease-out', fill: 'backwards' });
    });
    const fimEtapas = base + Math.min(etapas.length, 14) * passo + 260;
    anim(el.fConexoes, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: fimEtapas, easing: 'ease-out', fill: 'backwards' });
    setTimeout(() => { if (seq === seqFluxo) funil?.classList.add('vivo'); }, fimEtapas + 120);
    varrer(0, molduraF);
  }
  // onde o funil estava rolado quando o leitor entrou no lugar dele ("← Voltar ao fluxo" volta para o mesmo ponto)
  let voltaFluxo = null;
  function esconderFluxoJa() {
    voltaFluxo = fluxoNo && el.fCorpo ? { path: fluxoNo.path, top: el.fCorpo.scrollTop } : null;
    ++seqFluxo;
    fluxoAb = false;
    pararAnims(el.fluxo);
    molduraF.style.transform = '';
    el.fluxo.hidden = true;
    molduraF.classList.remove('montando');
    el.fFunil?.classList.remove('vivo');
    fluxoNo = null; fluxoR = null; arrasteYF = 0;
    rotinaAtiva = null; marcarRotinas();
    app.classList.remove('com-fluxo');
  }
  /* abrirFluxo(no, rotina, G, {origem, troca}) — mesma coreografia do leitor; com o leitor aberto, o funil
     entra no lugar dele com o glitch; com outro funil aberto, troca com o glitch. Resolve quando a moldura abriu. */
  async function abrirFluxo(no, r, G, o = {}) {
    if (!no || !el.fluxo || !molduraF) return;
    const seq = ++seqFluxo;
    r = r || rotinaDe(no);
    const estavaAberto = fluxoAb && !el.fluxo.hidden;
    // o funil entra no lugar do leitor ou do painel Saúde (clicar numa rotina dele) com o glitch
    const doSaude = !estavaAberto && saudeAb && !!el.saude && !el.saude.hidden;
    const doLeitor = (!estavaAberto && aberto && !!el.leitor && !el.leitor.hidden) || doSaude;
    if (!estavaAberto && !doLeitor && !el.fluxo.contains(doc.activeElement)) focoAntes = doc.activeElement;
    if (doSaude) esconderSaudeJa(); else if (doLeitor) esconderLeitorJa();
    pararAnims(el.fluxo);
    molduraF.style.transform = '';
    arrasteYF = 0;
    fluxoAb = true;
    app.classList.add('lendo', 'com-fluxo');
    marcarInerte(celular());
    esconderRes();
    rotinaAtiva = no; marcarRotinas();
    if (estavaAberto) {
      // troca pela lista: ao fechar, o foco volta para o item da rotina aberta agora, não para o da primeira
      const at = doc.activeElement;
      if (at && at !== doc.body && !el.fluxo.contains(at)) focoAntes = at;
      const focoDentro = el.fluxo.contains(doc.activeElement);
      if (reduz()) {
        montarFluxo(no, r, G);
        molduraF.classList.remove('montando');
        entrarFluxo(seq);
        await fim(anim(el.fCorpo, [{ opacity: .25 }, { opacity: 1 }], { duration: 160 }));
      } else {
        const a = glitch(molduraF);
        await espera(140);
        if (seq !== seqFluxo) return;
        montarFluxo(no, r, G);
        molduraF.classList.add('montando');
        await fim(a);
        if (seq !== seqFluxo) return;
        entrarFluxo(seq);
      }
      if (seq === seqFluxo && (focoDentro || doc.activeElement === doc.body)) focar(el.fTitulo);
      return;
    }
    montarFluxo(no, r, G);
    molduraF.classList.toggle('montando', !reduz());
    el.fluxo.hidden = false;
    // escondido (display:none) o scrollTop = 0 do montarFluxo não vale e a rolagem antiga voltava: zera aqui, já visível
    const volta = doLeitor && voltaFluxo && voltaFluxo.path === no.path ? voltaFluxo.top : 0;
    voltaFluxo = null;
    if (el.fCorpo) el.fCorpo.scrollTop = volta;
    if (reduz()) {
      entrarFluxo(seq);
      await fim(anim(molduraF, [{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' }));
      if (seq === seqFluxo) focar(el.fTitulo);
      return;
    }
    if (doLeitor) {
      const a = glitch(molduraF);
      setTimeout(() => entrarFluxo(seq), 140);
      await fim(a);
      if (seq === seqFluxo) focar(el.fTitulo);
      return;
    }
    const cel = celular(), dur = cel ? 460 : 600;
    const a = cel
      ? anim(molduraF, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: dur, easing: 'cubic-bezier(.2,.9,.25,1)' })
      : abrirHolo(o.origem, dur, el.fluxo, molduraF);
    setTimeout(() => entrarFluxo(seq), dur * (cel ? .4 : .62));
    await fim(a);
    if (seq === seqFluxo) focar(el.fTitulo);
  }
  /* Fechar: o funil se dobra numa linha de luz (desktop) ou desce (celular); devolve o centro do painel. */
  async function fecharFluxo() {
    const r = el.fluxo ? local(el.fluxo.getBoundingClientRect()) : new DOMRect(0, 0, 0, 0);
    const c = centroDe(r);
    if (!el.fluxo || !molduraF || el.fluxo.hidden) { fluxoAb = false; app.classList.remove('com-fluxo'); if (!aberto && !saudeAb) { app.classList.remove('lendo'); marcarInerte(false); } return c; }
    const seq = ++seqFluxo;
    fluxoAb = false;
    app.classList.remove('lendo', 'com-fluxo');
    pararAnims(el.fluxo);
    molduraF.style.transform = '';
    feixe(null);
    rotinaAtiva = null; marcarRotinas();
    let a;
    if (reduz()) a = anim(molduraF, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
    else if (celular()) a = anim(molduraF, [{ transform: `translateY(${n1(arrasteYF)}px)` }, { transform: 'translateY(100%)' }], { duration: arrasteYF ? 240 : 300, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    else {
      for (const e of [molduraF.querySelector('header'), el.fCorpo]) anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 130, fill: 'forwards' });
      a = anim(molduraF, [
        { transform: 'scaleY(1)', opacity: 1, easing: 'cubic-bezier(.6,0,.8,.3)' },
        { transform: 'scaleY(.004)', opacity: 1, offset: .5 },
        { transform: 'scaleY(.004)', opacity: 0, offset: .52 },
        { transform: 'scaleY(.004)', opacity: 0 },
      ], { duration: 440, fill: 'forwards' });
      const s = semente();
      s.style.left = `${n1(r.x)}px`; s.style.top = `${n1(c.y - 1)}px`; s.style.width = `${n1(r.width)}px`;
      const k = 14 / Math.max(1, r.width);
      soltarSemente(s, anim(s, [
        { transform: 'scale(1, 1)', opacity: 0 },
        { transform: 'scale(1, 1)', opacity: 0, offset: .46 },
        { transform: 'scale(1, 1)', opacity: 1, offset: .5, easing: 'cubic-bezier(.5,0,.3,1)' },
        { transform: `scale(${k}, 7)`, opacity: 1, offset: .94 },
        { transform: `scale(${k}, 7)`, opacity: 0 },
      ], { duration: 440 }));
    }
    arrasteYF = 0;
    marcarInerte(false);
    await fim(a);
    if (seq !== seqFluxo) return c;   // reaberto no meio do caminho
    el.fluxo.hidden = true;
    pararAnims(el.fluxo);
    molduraF.classList.remove('montando');
    el.fFunil?.classList.remove('vivo');
    fluxoNo = null; fluxoR = null;
    const ativo = doc.activeElement;
    if (!ativo || ativo === doc.body || el.fluxo.contains(ativo)) {
      if (focoAntes && focoAntes.isConnected && typeof focoAntes.focus === 'function' && focoAntes !== doc.body && !focoAntes.closest('[hidden]')) { try { focoAntes.focus({ preventScroll: true }); } catch (_) {} }
      else if (ativo && el.fluxo.contains(ativo)) ativo.blur();
    }
    focoAntes = null;
    return c;
  }
  const fecharFluxoPeloUsuario = () => { if (typeof opts.onFechar === 'function') opts.onFechar(); else fecharFluxo(); };
  el.fFechar?.addEventListener('click', fecharFluxoPeloUsuario);
  el.fNota?.addEventListener('click', () => { if (fluxoNo) opts.onNotaCompleta?.(fluxoNo, { origem: centroEl(el.fNota) }); });
  el.fCopiar?.addEventListener('click', () => { if (!fluxoNo) return; if (typeof opts.onCopiar === 'function') opts.onCopiar(fluxoNo); else copiarTexto(fluxoNo.path || ''); });
  el.fConexoes?.addEventListener('click', e => {
    const b = e.target.closest('.cx[data-id]'); if (!b || !grafo || !grafo.nodes) return;
    const m = grafo.nodes[+b.dataset.id];
    if (m) opts.onAbrir?.(m, { origem: centroEl(b), doFluxo: true });
  });
  // etapa em foco: o cérebro acende as notas que ela cita
  if (el.fEtapas && typeof opts.onEtapa === 'function') {
    let etapaFoco = -1;
    const avisar = i => { if (i === etapaFoco) return; etapaFoco = i; const p = i >= 0 && fluxoR && fluxoR.fluxo ? fluxoR.fluxo.passos[i] : null; opts.onEtapa(p && p.alvos && p.alvos.length ? p.alvos : null); };
    const entra = e => { const li = e.target.closest('.etapa'); if (li && el.fEtapas.contains(li)) avisar(+li.dataset.i); };
    const sai = e => { const li = e.target.closest('.etapa'); if (li && !(e.relatedTarget && li.contains(e.relatedTarget))) avisar(-1); };
    el.fEtapas.addEventListener('pointerover', entra); el.fEtapas.addEventListener('pointerout', sai);
    el.fEtapas.addEventListener('focusin', entra); el.fEtapas.addEventListener('focusout', sai);
  }
  // Celular: arrastar a alça da folha do funil para baixo fecha (igual ao leitor).
  const alcaF = molduraF && molduraF.querySelector('.alca');
  alcaF?.addEventListener('pointerdown', e => {
    if (!celular() || !fluxoAb) return;
    const y0 = e.clientY; let dy = 0;
    try { alcaF.setPointerCapture(e.pointerId); } catch (_) {}
    const mover = ev => { dy = Math.max(0, ev.clientY - y0); molduraF.style.transform = `translateY(${dy}px)`; };
    const soltar = () => {
      alcaF.removeEventListener('pointermove', mover); alcaF.removeEventListener('pointerup', soltar); alcaF.removeEventListener('pointercancel', soltar);
      if (dy > 80) { arrasteYF = dy; fecharFluxoPeloUsuario(); return; }
      molduraF.style.transform = '';
      if (dy > 0 && !reduz()) anim(molduraF, [{ transform: `translateY(${n1(dy)}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
    };
    alcaF.addEventListener('pointermove', mover); alcaF.addEventListener('pointerup', soltar); alcaF.addEventListener('pointercancel', soltar);
  });

  function retanguloLeitor() {
    if (!el.leitor) return new DOMRect(0, 0, 0, 0);
    if (!el.leitor.hidden) return local(el.leitor.getBoundingClientRect());
    // o funil ocupa o mesmo lugar do leitor: com ele aberto, mede o funil (sem mexer no leitor escondido)
    if (el.fluxo && !el.fluxo.hidden) return local(el.fluxo.getBoundingClientRect());
    if (el.saude && !el.saude.hidden) return local(el.saude.getBoundingClientRect());   // o painel Saúde também fica no lugar do leitor
    // escondido: mede sem mostrar (para o robô saber para onde levar a esfera)
    const vis = el.leitor.style.visibility;
    el.leitor.style.visibility = 'hidden'; el.leitor.hidden = false;
    const r = local(el.leitor.getBoundingClientRect());
    el.leitor.hidden = true; el.leitor.style.visibility = vis;
    return r;
  }

  const fecharPeloUsuario = () => { if (typeof opts.onFechar === 'function') opts.onFechar(); else fecharLeitor(); };
  async function copiarTexto(txt) {
    try { await navigator.clipboard.writeText(txt); aviso('Caminho copiado.'); }
    catch (_) {
      const ta = doc.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.className = 'sr'; doc.body.appendChild(ta); ta.select();
      let ok = false; try { ok = doc.execCommand('copy'); } catch (__) { ok = false; }
      ta.remove(); aviso(ok ? 'Caminho copiado.' : txt, ok ? 3200 : 7000);
    }
  }
  el.fechar?.addEventListener('click', fecharPeloUsuario);
  el.obsidian?.addEventListener('click', () => { if (noAtual) opts.onObsidian?.(noAtual); });
  el.copiar?.addEventListener('click', () => { if (!noAtual) return; if (typeof opts.onCopiar === 'function') opts.onCopiar(noAtual); else copiarTexto(noAtual.path || ''); });
  el.conexoes?.addEventListener('click', e => {
    const b = e.target.closest('.cx[data-id]'); if (!b || !grafo || !grafo.nodes) return;
    const m = grafo.nodes[+b.dataset.id];
    if (m) opts.onAbrir?.(m, { origem: centroEl(b), troca: true });
  });
  // Celular: arrastar a alça da folha para baixo fecha o leitor (a folha desce a partir de onde foi solta).
  const alca = moldura && moldura.querySelector('.alca');
  alca?.addEventListener('pointerdown', e => {
    if (!celular() || !aberto) return;
    const y0 = e.clientY; let dy = 0;
    try { alca.setPointerCapture(e.pointerId); } catch (_) {}
    const mover = ev => { dy = Math.max(0, ev.clientY - y0); moldura.style.transform = `translateY(${dy}px)`; };
    const soltar = () => {
      alca.removeEventListener('pointermove', mover); alca.removeEventListener('pointerup', soltar); alca.removeEventListener('pointercancel', soltar);
      if (dy > 80) { arrasteY = dy; fecharPeloUsuario(); return; }   // fecharLeitor parte de translateY(dy)
      moldura.style.transform = '';
      if (dy > 0 && !reduz()) anim(moldura, [{ transform: `translateY(${n1(dy)}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
    };
    alca.addEventListener('pointermove', mover); alca.addEventListener('pointerup', soltar); alca.addEventListener('pointercancel', soltar);
  });

  /* ================================ RESPOSTA DO CLAUDE ================================ */
  let usadasAtuais = [];
  const parteR = s => el.resposta && el.resposta.querySelector(s);
  function montarResposta(pergunta) {
    if (!el.resposta) return;
    el.resposta.innerHTML = `${CANTOS}<div class="resp-rolagem"><div class="resp-cab"><span class="hud-rot">Pergunta ao cérebro</span><button type="button" class="resp-x" data-acao="fechar" aria-label="Fechar resposta">${ICO_FECHAR}</button></div><p class="resp-q"></p><div class="md resp-md"></div><p class="resp-status"><i aria-hidden="true"></i><span></span></p><div class="resp-usadas" hidden></div></div><div class="resp-barra"><button type="button" class="btn-txt" data-acao="parar">Parar</button><button type="button" class="btn-txt" data-acao="nova">Nova conversa</button></div>`;
    parteR('.resp-q').textContent = pergunta || '';
    usadasAtuais = [];
  }
  const garantirResposta = () => { if (el.resposta && !parteR('.resp-md')) montarResposta(''); };
  function ocupado(v) {
    if (!el.resposta) return;
    el.resposta.classList.toggle('ocupado', !!v);
    el.resposta.setAttribute('aria-busy', String(!!v));
    const p = parteR('[data-acao="parar"]'); if (p) p.hidden = !v;
  }
  const resposta = {
    abrir(pergunta) {
      if (!el.resposta) return;
      montarResposta(pergunta);
      el.resposta.hidden = false;
      ocupado(true);
      resposta.status('Pensando…');
      if (!reduz()) anim(el.resposta, [{ opacity: 0, transform: 'translateY(10px) scaleY(.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    },
    texto(md) {
      garantirResposta();
      const b = parteR('.resp-md'), rol = parteR('.resp-rolagem'); if (!b) return;
      const perto = rol ? rol.scrollHeight - rol.scrollTop - rol.clientHeight < 48 : false;
      b.innerHTML = renderMD(String(md || ''));
      if (rol && perto) rol.scrollTop = rol.scrollHeight;
    },
    /* status(t, ocupado?): sem o 2º parâmetro, "…" no fim do texto = ainda trabalhando (mostra Parar). */
    status(t, estaOcupado) {
      garantirResposta();
      const s = parteR('.resp-status'); if (!s) return;
      const txt = String(t || '');
      s.lastElementChild.textContent = txt;
      s.hidden = !txt;
      ocupado(estaOcupado !== undefined ? !!estaOcupado : /(…|\.\.\.)\s*$/.test(txt));
    },
    usadas(nos) {
      garantirResposta();
      const u = parteR('.resp-usadas'); if (!u) return;
      usadasAtuais = (Array.isArray(nos) ? nos : nos instanceof Map ? [...nos.values()] : nos instanceof Set ? [...nos] : []).filter(Boolean);
      u.innerHTML = usadasAtuais.map((n, i) => `<button type="button" class="usada" data-i="${i}" style="--c:${cor(n)}"><i class="pt" aria-hidden="true"></i>${esc(n.name)}</button>`).join('');
      u.hidden = !usadasAtuais.length;
    },
    ocupado,
    aberta: () => !!el.resposta && !el.resposta.hidden,
    fechar() {
      if (!el.resposta) return;
      el.resposta.hidden = true;
      el.resposta.innerHTML = '';
      el.resposta.classList.remove('ocupado');
      el.resposta.removeAttribute('aria-busy');
      usadasAtuais = [];
    },
  };
  el.resposta?.addEventListener('click', e => {
    const b = e.target.closest('[data-acao]');
    if (b) {
      const ac = b.dataset.acao;
      if (ac === 'fechar') resposta.fechar();
      else if (ac === 'parar') { opts.onParar?.(); el.resposta.dispatchEvent(new CustomEvent('parar', { bubbles: true })); }
      else if (ac === 'nova') {
        (opts.onNovaConversa || opts.onNova)?.();
        el.resposta.dispatchEvent(new CustomEvent('nova', { bubbles: true }));
        resposta.fechar();
        el.perguntaInput?.focus();
      }
      return;
    }
    const u = e.target.closest('.usada');
    if (u) { const n = usadasAtuais[+u.dataset.i]; if (n) opts.onAbrir?.(n, { origem: centroEl(u) }); }
  });

  /* ================================ SAÚDE DOS SISTEMAS (Guardião) ================================
     Chip na barra de cima, painel Saúde (mesma moldura do leitor, no mesmo lugar), bolinha da saúde na aba Rotinas e
     selo do estado em cada etapa do funil. Os dados vêm do app (js/saude.js → saude.painel(), GUARDIAO.md §6). */
  const ST_CURTO = { ok: 'OK', atencao: 'Atenção', falha: 'Falha', sem_dado: 'Sem dado', desligado: 'Desligado' };
  const itensSaude = () => (saudeDados && Array.isArray(saudeDados.itens) ? saudeDados.itens : []);
  /* Duas coisas diferentes, que o painel não pode confundir:
     - verificação atrasada: a última leitura BOA trouxe um verificado_em de mais de 20 min (o agendador do Guardião parou);
     - leitura parada: o painel é que não conseguiu ler (erro, ou 2 min sem leitura boa com a aba visível). O dado na tela
       é o da última leitura, e o painel diz desde quando, sem culpar o agendador. */
  const recebidoEm = () => (Number.isFinite(saudeInfo.recebidoEm) ? saudeInfo.recebidoEm : null);
  function saudeVelha() {
    const d = saudeDados && dataDe(saudeDados.verificado_em), r = recebidoEm();
    return !!(d && r) && (r - d.getTime()) / 60000 > SAUDE_VELHA_MIN;
  }
  function leituraParada() {
    if (!saudeDados) return false;
    if (saudeInfo.estado === 'erro' || saudeInfo.estado === 'indisponivel') return true;
    const r = recebidoEm(), agora = Date.now();
    return !!r && !doc.hidden && agora - r > LEITURA_PARADA_MS && agora - visivelDesde > VISIVEL_FOLGA_MS;
  }
  const lidoAs = () => { const r = recebidoEm(); return r ? hhmm(new Date(r)) : ''; };
  /* item da saúde ligado a uma nota (itens[].nota = nome exato da nota do vault). A rotina vem antes da tarefa do
     Agendador e do serviço que repetem a mesma nota, em qualquer ordem do catálogo. */
  function itemDaNota(no) {
    if (!no || !saudeDados) return null;
    const alvos = new Set([chave(no.name)]);
    if (no.path) alvos.add(chave(String(no.path).replace(/\.md$/i, '').split('/').pop()));
    const bate = itensSaude().filter(i => i.nota && alvos.has(chave(i.nota)));
    return bate.find(i => i.tipo === 'rotina') || bate[0] || null;
  }
  function consultasOk(i) {
    const c = i && i.detalhe && Array.isArray(i.detalhe.consultas) ? i.detalhe.consultas : null;
    if (!c || !c.length) return '';
    const ok = c.filter(x => x && String(x.estado || x.status || '').toLowerCase() === 'ok').length;
    return `${ok}/${c.length} OK`;
  }
  const SEM_EXECUCAO = { ok: 'em dia', atencao: 'atenção', falha: 'falha', sem_dado: 'sem dado ainda', desligado: 'sem vigia automático' };
  /* "última: hoje 07:50 · 12/12 OK" (aba Rotinas) */
  function linhaRotinaSaude(i) {
    if (!i.ultima_execucao) return SEM_EXECUCAO[i.status] || 'sem dado ainda';
    const q = consultasOk(i);
    return `última: ${quandoTxt(i.ultima_execucao)} · ${q || stSaude(i.status).rot.toLowerCase()}`;
  }
  function marcarSaudeRotinas() {
    if (!el.trilhoRotinas) return;
    el.trilhoRotinas.querySelectorAll('.rotina').forEach(b => {
      const r = rotinasAtuais[+b.dataset.i]; if (!r) return;
      const i = itemDaNota(r.no);
      const ln = b.querySelector('.rot-saude'), sr = b.querySelector('.rot-saude-sr');
      if (!i) {
        b.style.setProperty('--c', corSituacao(r.status)); delete b.dataset.saude; b.removeAttribute('title');
        if (ln) { ln.hidden = true; ln.textContent = ''; }
        if (sr) sr.textContent = '';
        return;
      }
      const st = stSaude(i.status);
      b.style.setProperty('--c', st.cor);   // a bolinha passa a ser a da saúde
      b.dataset.saude = i.status;
      if (ln) { ln.hidden = false; ln.textContent = linhaRotinaSaude(i); }
      if (sr) sr.textContent = `, saúde: ${st.rot}. ${i.resumo || ''}`;
      b.title = `${st.rot}${i.resumo ? ` — ${i.resumo}` : ''}`;
    });
  }
  /* Funil: o cabeçalho mostra o resumo da verificação e cada etapa ganha o selo do estado (detalhe.etapas[tipo]) */
  function marcarSaudeFluxo() {
    const i = fluxoNo ? itemDaNota(fluxoNo) : null;
    if (el.fSaude) {
      if (!i) { el.fSaude.hidden = true; el.fSaude.innerHTML = ''; }
      else {
        const st = stSaude(i.status), v = saudeDados && saudeDados.verificado_em;
        el.fSaude.hidden = false;
        el.fSaude.dataset.st = i.status;
        el.fSaude.style.setProperty('--c-s', st.cor);
        const h = `<span class="f-saude-cab"><i class="pt" aria-hidden="true"></i><b>Saúde: ${esc(st.rot)}</b>${v ? `<span class="f-saude-qd">verificado <span data-ha="${esc(v)}">${esc(haQuanto(v))}</span></span>` : ''}</span>`
          + (i.resumo ? `<span class="f-saude-rs">${esc(i.resumo)}</span>` : '');
        if (el.fSaude.innerHTML !== h) el.fSaude.innerHTML = h;
      }
    }
    if (!el.fEtapas) return;
    const et = i && i.detalhe && i.detalhe.etapas && typeof i.detalhe.etapas === 'object' ? i.detalhe.etapas : null;
    el.fEtapas.querySelectorAll('.etapa').forEach(li => {
      const s = li.querySelector('.etapa-saude'), m = li.querySelector('.etapa-motivo');
      if (!s) return;
      const tipo = s.dataset.tipo || '';
      const e = et && Object.prototype.hasOwnProperty.call(et, tipo) ? etapaSaude(et[tipo]) : null;
      if (!e) {
        s.hidden = true; s.textContent = ''; s.removeAttribute('title'); delete li.dataset.saude;
        if (m) { m.hidden = true; m.textContent = ''; }
        return;
      }
      const st = stSaude(e.st);
      const motivo = e.motivo || (e.st === 'ok' ? 'Em dia na última verificação.' : e.st === 'sem_dado' ? 'O Guardião ainda não tem como conferir esta etapa.' : e.st === 'desligado' ? 'Sem vigia automático.' : (i.resumo || ''));
      s.hidden = false;
      s.dataset.st = e.st;
      s.style.setProperty('--c-s', st.cor);
      s.innerHTML = `<span class="sr">Saúde desta etapa: </span>${esc(ST_CURTO[e.st] || st.rot)}<span class="sr">. ${esc(motivo)}</span>`;
      s.title = motivo;
      li.dataset.saude = e.st;
      if (m) {
        // só o motivo próprio da etapa ({status, motivo}); o resumo geral já está no cabeçalho do funil
        const mostra = (e.st === 'falha' || e.st === 'atencao') && !!e.motivo;
        m.hidden = !mostra; m.textContent = mostra ? e.motivo : '';
        m.style.setProperty('--c-s', st.cor);
      }
    });
  }

  /* ---------- Chip da barra de cima ---------- */
  function estadoChip() {
    const d = saudeDados, g = d && d.geral, e = saudeInfo.estado;
    if (d && g) {
      const ha = d.verificado_em ? haQuanto(d.verificado_em) : '';
      const st = g.status === 'falha' || g.status === 'atencao' || g.status === 'ok' ? g.status : 'sem_dado';
      const parada = leituraParada(), velha = !parada && saudeVelha();
      let rot = tituloSaude(g);
      let curto = g.falha ? plural(+g.falha, 'falha', 'falhas') : g.atencao ? plural(+g.atencao, 'atenção', 'atenções') : st === 'ok' ? 'Em dia' : 'Sem dados';
      const sub = parada ? `sem atualizar desde ${lidoAs()}` : velha ? `${ha} · atrasada` : ha ? `verificado ${ha}` : '';
      // "Em dia" velho engana: o próprio rótulo troca (o subtexto some abaixo de 1280 px). Com falha ou atenção, a
      // contagem fica (já é um aviso) e o atraso vai no subtexto, no title e no aria-label.
      if ((velha || parada) && (st === 'ok' || st === 'sem_dado')) {
        rot = velha ? 'Verificação atrasada' : 'Saúde sem atualizar';
        curto = velha ? 'Atrasada' : 'Sem atualizar';
      }
      return { st, rot, curto, sub, velha, parada, frase: `${rot}${g.ok ? `, ${plural(+g.ok, 'item em dia', 'itens em dia')} na última leitura` : ''}. ${sub ? `${sub[0].toUpperCase()}${sub.slice(1)}.` : ''}` };
    }
    if (e === 'carregando') return { st: 'carregando', rot: 'Saúde…', curto: 'Saúde…', sub: 'lendo', frase: 'Lendo a saúde dos sistemas.' };
    if (e === 'sem-chave') return { st: 'sem_dado', rot: 'Saúde: falta a chave', curto: 'Sem chave', sub: 'toque para digitar', frase: 'Falta a chave de leitura do Guardião.' };
    if (saudeInfo.codigo === 'chave-errada') return { st: 'indisponivel', rot: 'Saúde: chave errada', curto: 'Chave errada', sub: 'toque para trocar', frase: 'A chave de leitura do Guardião está errada.' };
    return { st: 'indisponivel', rot: 'Saúde indisponível', curto: 'Indisponível', sub: 'toque para ver', frase: `Saúde indisponível. ${saudeInfo.motivo || ''}` };
  }
  function renderChip() {
    const c = el.chip; if (!c) return;
    const k = estadoChip();
    c.dataset.st = k.st;
    c.toggleAttribute('data-velho', !!k.velha);
    c.toggleAttribute('data-parada', !!k.parada);
    const h = `<i class="pt" aria-hidden="true"></i><span class="sc-txt"><span class="sc-rot">${esc(k.rot)}</span><span class="sc-curto">${esc(k.curto)}</span><span class="sc-sub">${esc(k.sub)}</span></span>`;
    if (c.innerHTML !== h) c.innerHTML = h;
    c.setAttribute('aria-label', `Saúde dos sistemas: ${k.frase} Abre o painel Saúde.`);
    c.title = saudeInfo.motivo && !saudeDados ? `Saúde indisponível: ${saudeInfo.motivo}` : k.frase;
  }
  /* "há 3 min" que muda sozinho a cada minuto (chip, cabeçalho do painel, funil, incidentes) */
  function atualizarIdadesSaude() {
    renderChip();
    for (const raiz of [el.saude, el.fSaude]) {
      if (!raiz || raiz.hidden) continue;
      raiz.querySelectorAll('[data-ha]').forEach(s => { const t = haQuanto(s.dataset.ha); if (s.textContent !== t) s.textContent = t; });
    }
    if (saudeAb && saudeDados) {
      // passou do limite com o painel aberto: o aviso (leitura parada ou verificação atrasada) aparece sem esperar o dado
      const paradaAgora = leituraParada(), velhaAgora = !paradaAgora && saudeVelha();
      if (velhaAgora !== !!el.saude.querySelector('.s-nota-velho') || paradaAgora !== !!el.saude.querySelector('.s-nota-parada')) atualizarSaudeAberta();
    }
  }

  /* ---------- Painel Saúde: conteúdo ---------- */
  const precisaChave = () => !!saudeInfo.usaChave && (saudeInfo.estado === 'sem-chave' || saudeInfo.codigo === 'chave-errada' || saudeInfo.codigo === 'sem-cadastro');
  function tituloPainelSaude() {
    if (saudeDados) return tituloSaude(saudeDados.geral);
    if (precisaChave()) return saudeInfo.codigo === 'chave-errada' ? 'Chave de leitura errada' : 'Falta a chave de leitura';
    return saudeInfo.estado === 'carregando' ? 'Lendo a saúde…' : 'Saúde indisponível';
  }
  function cabecaSaude(digitar) {
    const d = saudeDados, g = d && d.geral;
    el.saude.style.setProperty('--c', g ? stSaude(g.status).cor : 'var(--holo)');
    if (el.sSelos) {
      const selos = ['<span class="selo selo-tipo">Guardião · Saúde</span>'];
      if (saudeInfo.modo === 'teste') selos.push('<span class="selo selo-aviso">Teste local · api/saude</span>');
      if (d && leituraParada()) selos.push(`<span class="selo selo-aviso">Sem atualizar desde ${esc(lidoAs())}</span>`);
      else if (d && saudeVelha()) selos.push('<span class="selo selo-alerta">Verificação atrasada</span>');
      el.sSelos.innerHTML = selos.join('');
    }
    const t = tituloPainelSaude();
    if (el.sTitulo && (digitar || el.sTitulo.dataset.t !== t)) {
      el.sTitulo.dataset.t = t;
      ++seqTituloS;
      el.sTitulo.innerHTML = `<span class="sr">${esc(t)}</span><span class="dig" aria-hidden="true">${esc(t)}</span>`;
    }
    if (el.sMeta) {
      const meta = [];
      if (d && d.verificado_em) {
        meta.push(`<span>verificado <b data-ha="${esc(d.verificado_em)}">${esc(haQuanto(d.verificado_em))}</b></span>`);
        meta.push(`<span>${esc(quandoTxt(d.verificado_em))}</span>`);
      }
      if (d) meta.push(`<span><b>${fmtN(itensSaude().length)}</b> ${itensSaude().length === 1 ? 'item vigiado' : 'itens vigiados'}</span>`);
      el.sMeta.innerHTML = meta.join('');
      el.sMeta.hidden = !meta.length;
    }
    if (el.sAtualizar) el.sAtualizar.hidden = precisaChave();
  }
  let seqTituloS = 0;
  const chipInfo = (rot, valor, cls = '') => `<span class="fm-chip${cls}"><b>${esc(rot)}</b><span>${valor}</span></span>`;
  /* O canal de alarme também é vigiado: "configurado" só diz que o segredo existe. Se o último envio falhou (token
     revogado, bot fora do grupo, chat errado), ou se passou de 26 h sem nenhum aviso entregue (o resumo das 07:40
     garante um por dia), o painel diz, na cor do problema. */
  function telegramHTML(tg) {
    if (!tg.configurado) return chipInfo('Telegram', 'ainda não configurado: os avisos ficam só no painel', ' s-chip-rever');
    if (tg.ultima_tentativa_ok === false) {
      return chipInfo('Telegram', `o último envio falhou ${esc(quandoTxt(tg.ultima_tentativa_em))}${tg.ultimo_erro ? ` — ${esc(String(tg.ultimo_erro))}` : ''}`, ' s-chip-falha');
    }
    const ult = dataDe(tg.ultimo_aviso_em);
    if (!ult) return chipInfo('Telegram', 'configurado, mas nenhum aviso entregue ainda', ' s-chip-rever');
    const ha = `<span data-ha="${esc(tg.ultimo_aviso_em)}">${esc(haQuanto(tg.ultimo_aviso_em))}</span>`;
    if (Date.now() - ult.getTime() > 26 * 3600000) return chipInfo('Telegram', `nenhum aviso entregue desde ${ha} (o resumo das 07:40 deveria ter saído)`, ' s-chip-rever');
    return chipInfo('Telegram', `configurado · último aviso entregue ${ha}`);
  }
  function resumoSaudeHTML(d) {
    const g = d.geral;
    const cont = [['ok', 'em dia', 'em dia'], ['atencao', 'atenção', 'atenções'], ['falha', 'falha', 'falhas'], ['sem_dado', 'sem dado', 'sem dado']];
    const linhas = [];
    linhas.push(telegramHTML(d.telegram || {}));
    linhas.push(d.vm && d.vm.em
      ? chipInfo('VM SRV-IA', `batimento <span data-ha="${esc(d.vm.em)}">${esc(haQuanto(d.vm.em))}</span>`)
      : chipInfo('VM SRV-IA', 'vigia ainda não instalado', ' s-chip-mudo'));
    if (+g.desligado > 0) linhas.push(chipInfo('Sem vigia', plural(+g.desligado, 'item desligado', 'itens desligados'), ' s-chip-mudo'));
    return `<div class="s-resumo">${cont.map(([k, um, varios]) => { const n = +g[k] || 0; return `<div class="s-cont${n ? '' : ' s-zero'}" data-st="${k}" style="--c-s:${stSaude(k).cor}"><b>${fmtN(n)}</b><span>${n === 1 ? um : varios}</span></div>`; }).join('')}</div>`
      + `<div class="s-linhas">${linhas.join('')}</div>`;
  }
  function podeAbrir(i) {
    if (!i || !i.nota) return null;
    if (typeof opts.notaSaude !== 'function') return 'nota';
    try { return opts.notaSaude(i.nota) || null; } catch (_) { return null; }
  }
  /* Correção automática de um incidente. correcao_resultado = 'pedido' é o banco esperando a VM; outro texto é a
     resposta da VM ("Disparei a tarefa…", "Não disparei: …") ou o motivo de não ter pedido ("Fora da janela…"). */
  function correcaoHTML(inc, aberto) {
    const r = inc.correcao_resultado ? String(inc.correcao_resultado) : '';
    if (inc.correcao_pedida_em) {
      const resp = !r || r === 'pedido' ? (aberto ? 'esperando a VM responder' : 'a VM não chegou a responder') : r;
      return aberto
        ? `<span class="s-inc-corr"><b>Nova tentativa</b> pedida ${esc(quandoTxt(inc.correcao_pedida_em))} — ${esc(resp)}</span>`
        : `<span class="s-t-corr">Nova tentativa ${esc(quandoTxt(inc.correcao_pedida_em))}: ${esc(resp)}</span>`;
    }
    if (!r || r === 'pedido') return '';
    // correcao_adiada: motivo passageiro (tranca presa, vigia fora, máquina a confirmar); o Guardião decide de novo
    if (aberto && inc.correcao_adiada === true) return `<span class="s-inc-corr"><b>Nova tentativa ainda não</b> — ${esc(r)}</span>`;
    return aberto ? `<span class="s-inc-corr"><b>Sem nova tentativa</b> — ${esc(r)}</span>` : `<span class="s-t-corr">${esc(r)}</span>`;
  }
  function abertosHTML(d) {
    const ab = d.incidentes && Array.isArray(d.incidentes.abertos) ? d.incidentes.abertos : [];
    if (!ab.length) return '';
    const itens = itensSaude();
    return `<section class="s-sec s-abertos"><h3 class="hud-rot">Incidentes abertos <b>${fmtN(ab.length)}</b></h3><ul class="s-inc-lista" role="list">${ab.map(inc => {
      const st = stSaude(inc.status), item = itens.find(i => i.id === inc.alvo_id);
      const nome = nomeSaude(inc) || nomeSaude(item) || inc.alvo_id || 'Item vigiado';   // "BI Compras · Sync rapidas": o nome se repete entre sistemas
      const abrir = item ? podeAbrir(item) : null;
      const corr = correcaoHTML(inc, true);
      const corpo = `<span class="s-inc-cab"><span class="s-st">${esc(st.rot)}</span><span class="s-inc-qd">aberto ${esc(quandoTxt(inc.aberto_em))}${inc.aberto_em ? ` (<span data-ha="${esc(inc.aberto_em)}">${esc(haQuanto(inc.aberto_em))}</span>)` : ''}</span></span>`
        + `<span class="s-inc-nm">${esc(nome)}</span>${inc.resumo ? `<span class="s-inc-rs">${esc(inc.resumo)}</span>` : ''}${corr}`;
      return `<li>${abrir ? `<button type="button" class="s-inc" data-id="${esc(item.id)}" style="--c-s:${st.cor}" title="${abrir === 'rotina' ? 'Abrir o funil desta rotina' : 'Abrir a nota no leitor'}">${corpo}</button>` : `<div class="s-inc" style="--c-s:${st.cor}">${corpo}</div>`}</li>`;
    }).join('')}</ul></section>`;
  }
  function itemSaudeHTML(i) {
    const st = stSaude(i.status), abrir = podeAbrir(i);
    const quando = [];
    if (i.ultima_execucao) quando.push(`última ${quandoTxt(i.ultima_execucao)}`);
    if (i.proxima_execucao) quando.push(`próxima ${quandoTxt(i.proxima_execucao)}`);
    const corpo = `<i class="pt" aria-hidden="true"></i><span class="s-nm">${esc(nomeSaude(i))}</span><span class="s-st">${esc(st.rot)}</span>`
      + `${i.resumo ? `<span class="s-rs">${esc(i.resumo)}</span>` : ''}${quando.length ? `<span class="s-qd">${esc(quando.join(' · '))}</span>` : ''}`;
    return `<li>${abrir
      ? `<button type="button" class="s-item" data-id="${esc(i.id)}" data-st="${esc(i.status)}" style="--c:${st.cor}" title="${abrir === 'rotina' ? 'Abrir o funil desta rotina' : 'Abrir a nota no leitor'}">${corpo}</button>`
      : `<div class="s-item" data-st="${esc(i.status)}" style="--c:${st.cor}">${corpo}</div>`}</li>`;
  }
  function vmHTML(d) {
    const vm = d.vm; if (!vm || !vm.em) return '';
    const inf = vm.info && typeof vm.info === 'object' ? vm.info : {};
    const partes = [`batimento <b data-ha="${esc(vm.em)}">${esc(haQuanto(vm.em))}</b>`];
    const gb = Number(inf.disco_livre_gb), pc = Number(inf.disco_livre_pct);
    if (Number.isFinite(gb)) partes.push(`disco C: <b>${fmtN(gb)} GB</b> livres${Number.isFinite(pc) ? ` (${fmtN(pc)}%)` : ''}`);
    if (inf.uptime != null) {
      const u = Number(inf.uptime);
      partes.push(Number.isFinite(u) && u > 0 ? `ligada há ${u >= 86400 ? plural(Math.floor(u / 86400), 'dia', 'dias') : plural(Math.max(1, Math.floor(u / 3600)), 'hora', 'horas')}` : `ligada: ${esc(String(inf.uptime))}`);
    }
    if (vm.versao) partes.push(`vigia ${esc(String(vm.versao))}`);
    return `<p class="s-vm">${partes.join(' · ')}</p>`;
  }
  function secoesSaudeHTML(d) {
    const grupos = new Map(SAUDE_SECOES.map(([k]) => [k, []]));
    itensSaude().forEach((i, idx) => grupos.get(secaoDe(i.tipo)).push([i, idx]));
    return SAUDE_SECOES.map(([k, titulo]) => {
      const lista = grupos.get(k);
      if (!lista.length) return '';
      lista.sort((a, b) => stSaude(a[0].status).ordem - stSaude(b[0].status).ordem || a[1] - b[1]);   // problemas primeiro
      const vigiados = lista.filter(([i]) => i.status !== 'desligado').length, ok = lista.filter(([i]) => i.status === 'ok').length;
      return `<section class="s-sec" data-secao="${k}"><h3 class="hud-rot">${esc(titulo)} <span class="s-sec-qt"><b>${fmtN(ok)}</b> de ${fmtN(vigiados)} em dia</span></h3>`
        + `${k === 'vm' ? vmHTML(d) : ''}<ul class="s-lista" role="list">${lista.map(([i]) => itemSaudeHTML(i)).join('')}</ul></section>`;
    }).join('');
  }
  function recentesSaudeHTML(d) {
    const rc = d.incidentes && Array.isArray(d.incidentes.recentes) ? d.incidentes.recentes.slice(0, 15) : [];
    const itens = itensSaude();
    return `<section class="s-sec s-historico"><h3 class="hud-rot">Últimos incidentes${rc.length ? ` <b>${fmtN(rc.length)}</b>` : ''}</h3>${rc.length
      ? `<ol class="s-tempo" role="list">${rc.map(inc => {
        const st = stSaude(inc.status), item = itens.find(i => i.id === inc.alvo_id);
        const nome = nomeSaude(inc) || nomeSaude(item) || inc.alvo_id || 'Item vigiado';   // "BI Compras · Sync rapidas": o nome se repete entre sistemas
        const dur = duracaoTxt(inc.aberto_em, inc.fechado_em);
        return `<li style="--c-s:${st.cor}"><span class="s-t-qd">${esc(quandoTxt(inc.aberto_em))} → ${esc(inc.fechado_em ? quandoTxt(inc.fechado_em) : 'aberto')}${dur ? ` · ${esc(dur)}` : ''}</span>`
          + `<span class="s-t-nm">${esc(nome)}<span class="s-st">${esc(st.rot)}</span></span>${inc.resumo ? `<span class="s-t-rs">${esc(inc.resumo)}</span>` : ''}`
          + `${correcaoHTML(inc, false)}</li>`;
      }).join('')}</ol>`
      : '<p class="cx-vazio">Nenhum incidente fechado ainda.</p>'}</section>`;
  }
  function chaveHTML() {
    const erro = saudeInfo.codigo === 'chave-errada' || saudeInfo.codigo === 'sem-cadastro' ? saudeInfo.motivo : '';
    return `<form class="s-chave" autocomplete="off" novalidate><h3 class="hud-rot">Chave de leitura do Guardião</h3>`
      + '<p>No arquivo baixado a saúde vem direto do Guardião. Digite a chave de leitura: ela vale para esta aba e some quando você fecha.</p>'
      + (erro ? `<p class="s-chave-erro" role="alert">${esc(erro)}</p>` : '')
      + '<div class="s-chave-linha"><label class="sr" for="sChave">Chave de leitura do Guardião</label>'
      + '<input id="sChave" name="chave" type="password" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="Chave de leitura">'
      + '<button type="submit" class="btn principal pequeno">Usar a chave</button></div>'
      + '<label class="s-chave-lembrar"><input type="checkbox" name="lembrar"> Lembrar neste computador</label>'
      + '<p class="s-chave-dica">Lembrada, a chave fica no navegador e qualquer outro arquivo .html aberto do disco nele consegue lê-la. Num computador só seu, tudo bem; num compartilhado, deixe desmarcado.</p>'
      + '<p class="s-chave-dica">Quem cria a chave é o Júlio, no SQL Editor do DATA WAREHOUSE (segredo <code>guardiao_chave_leitura</code> do Vault). Ela só deixa ler a saúde.</p></form>';
  }
  /* O rodapé diz o que o Guardião confere HOJE, não o que ele vai conferir: sem batimento, a VM ainda não entra; sem
     Telegram, nenhum aviso sai. */
  function rodapeSaudeHTML() {
    const d = saudeDados;
    const esquecer = saudeInfo.usaChave && saudeInfo.temChave && !precisaChave();
    const partes = ['Quem garante: o Guardião da Lube. Ele confere o banco de 5 em 5 min e os sites de 10 em 10 min'];
    partes.push(d && d.vm && d.vm.em ? ', e a VM SRV-IA de 15 em 15 min' : '; a VM SRV-IA entra quando o vigia for instalado nela');
    const tg = (d && d.telegram) || {};
    const avisos = !d ? '' : !tg.configurado ? ' Os avisos pelo Telegram começam quando o bot for cadastrado; até lá, ficam só aqui.'
      : tg.ultima_tentativa_ok === false ? ' O último aviso pelo Telegram não foi entregue (veja acima).' : ' Avisa pelo Telegram, só com prova.';
    return `<p class="s-rodape">${esc(partes.join(''))}.${esc(avisos)}</p>`
      + (esquecer ? `<p class="s-rodape"><button type="button" class="btn-txt" data-acao="esquecer">${saudeInfo.chaveLembrada ? 'Esquecer a chave deste computador' : 'Esquecer a chave desta aba'}</button></p>` : '');
  }
  function corpoSaudeHTML() {
    const d = saudeDados, e = saudeInfo.estado, h = [];
    if (precisaChave()) h.push(chaveHTML());
    else if (!d) {
      const txt = e === 'carregando' ? 'Lendo a saúde das rotinas e dos sistemas…' : (saudeInfo.motivo || 'Sem dados da saúde agora.');
      h.push(`<div class="s-vazio"><p>${esc(txt)}</p>${e === 'carregando' ? '' : '<button type="button" class="btn pequeno" data-acao="tentar">Tentar de novo</button>'}</div>`);
    }
    if (!d) { h.push(rodapeSaudeHTML()); return h.join(''); }
    if (leituraParada()) {
      // quem parou foi a leitura do painel (conector, rede, função): o dado é o da última leitura boa
      const motivo = (e === 'erro' || e === 'indisponivel') && saudeInfo.motivo ? ` ${saudeInfo.motivo}` : '';
      h.push(`<p class="s-nota s-nota-erro s-nota-parada">Sem atualizar desde ${esc(lidoAs())}: o painel não conseguiu ler a saúde.${esc(motivo)} Mostrando a última leitura.</p>`);
    } else if (saudeVelha()) {
      h.push(`<p class="s-nota s-nota-velho">A leitura chegou, mas a última verificação do Guardião foi <span data-ha="${esc(d.verificado_em)}">${esc(haQuanto(d.verificado_em))}</span>. Ele verifica de 5 em 5 min: se continuar assim, o agendador dele (pg_cron) parou.</p>`);
    }
    h.push(resumoSaudeHTML(d), abertosHTML(d), secoesSaudeHTML(d), recentesSaudeHTML(d), rodapeSaudeHTML());
    return h.join('');
  }
  function atualizarSaudeAberta() {
    if (!el.saude || !el.sCorpo) return;
    cabecaSaude(false);
    const foco = doc.activeElement;
    if (foco && el.sCorpo.contains(foco) && foco.tagName === 'INPUT') return;   // digitando a chave: não refaz o cartão
    const top = el.sCorpo.scrollTop;
    const idFoco = foco && el.sCorpo.contains(foco) ? (foco.dataset.id || foco.dataset.acao || '') : '';
    el.sCorpo.innerHTML = corpoSaudeHTML();
    el.sCorpo.scrollTop = top;
    if (idFoco) {
      let alvo = null;
      try { alvo = el.sCorpo.querySelector(`[data-id="${CSS.escape(idFoco)}"], [data-acao="${CSS.escape(idFoco)}"]`); } catch (_) { alvo = null; }
      if (alvo) { try { alvo.focus({ preventScroll: true }); } catch (_) { /* nada */ } }
    }
  }
  /* saude(dados|null|undefined, info) — dados undefined: só o estado mudou (erro, carregando, sem chave) */
  function saude(dados, info = {}) {
    if (dados !== undefined) saudeDados = dados || null;
    saudeInfo = { ...saudeInfo, ...info };
    if (info.estado === 'ok') { saudeInfo.codigo = ''; saudeInfo.motivo = ''; }
    renderChip();
    marcarSaudeRotinas();
    marcarSaudeFluxo();
    if (saudeAb) atualizarSaudeAberta();
  }

  /* ---------- Painel Saúde: abrir e fechar (mesma coreografia do leitor) ---------- */
  function entrarSaude(seq) {
    if (seq !== seqSaude || !molduraS) return;
    molduraS.classList.remove('montando');
    if (reduz()) return;
    anim(molduraS.querySelector('header'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    const meu = seqTituloS;
    digitarEm(el.sTitulo, el.sTitulo ? el.sTitulo.dataset.t : '', () => seq === seqSaude && meu === seqTituloS);
    cascata([...(el.sSelos ? el.sSelos.children : [])], 40, 40, 8, 6);
    cascata([...(el.sCorpo ? el.sCorpo.children : [])], 150, 55, 14, 10);
    varrer(0, molduraS);
  }
  /* abrirSaude({origem}) — com o leitor ou o funil aberto, o painel entra no lugar dele com o glitch */
  async function abrirSaude(o = {}) {
    if (!el.saude || !molduraS) return;
    if (saudeAb && !el.saude.hidden) { focar(el.sTitulo); return; }
    const seq = ++seqSaude;
    const doLeitor = aberto && !!el.leitor && !el.leitor.hidden, doFluxoS = fluxoAb && !!el.fluxo && !el.fluxo.hidden;
    const troca = doLeitor || doFluxoS;
    if (!troca && !el.saude.contains(doc.activeElement)) focoAntes = doc.activeElement;
    if (doLeitor) esconderLeitorJa();
    if (doFluxoS) esconderFluxoJa();
    pararAnims(el.saude);
    molduraS.style.transform = '';
    arrasteYS = 0;
    saudeAb = true;
    app.classList.add('lendo', 'com-saude');
    el.chip?.setAttribute('aria-expanded', 'true');
    marcarInerte(celular());
    esconderRes();
    cabecaSaude(true);
    el.sCorpo.innerHTML = corpoSaudeHTML();
    molduraS.classList.toggle('montando', !reduz());
    el.saude.hidden = false;
    el.sCorpo.scrollTop = 0;
    if (reduz()) {
      await fim(anim(molduraS, [{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' }));
      if (seq === seqSaude) focar(el.sTitulo);
      return;
    }
    if (troca) {
      const a = glitch(molduraS);
      setTimeout(() => entrarSaude(seq), 140);
      await fim(a);
      if (seq === seqSaude) focar(el.sTitulo);
      return;
    }
    const cel = celular(), dur = cel ? 460 : 600;
    const a = cel
      ? anim(molduraS, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: dur, easing: 'cubic-bezier(.2,.9,.25,1)' })
      : abrirHolo(o.origem, dur, el.saude, molduraS);
    setTimeout(() => entrarSaude(seq), dur * (cel ? .4 : .62));
    await fim(a);
    if (seq === seqSaude) focar(el.sTitulo);
  }
  /* O painel sai na hora (o leitor ou o funil abre no lugar dele com o glitch). */
  function esconderSaudeJa() {
    if (!el.saude || !molduraS) return;
    ++seqSaude;
    saudeAb = false;
    pararAnims(el.saude);
    molduraS.style.transform = '';
    el.saude.hidden = true;
    molduraS.classList.remove('montando');
    arrasteYS = 0;
    app.classList.remove('com-saude');
    el.chip?.setAttribute('aria-expanded', 'false');
  }
  async function fecharSaude() {
    const r = el.saude ? local(el.saude.getBoundingClientRect()) : new DOMRect(0, 0, 0, 0);
    const c = centroDe(r);
    el.chip?.setAttribute('aria-expanded', 'false');
    if (!el.saude || !molduraS || el.saude.hidden) {
      saudeAb = false; app.classList.remove('com-saude');
      if (!aberto && !fluxoAb) { app.classList.remove('lendo'); marcarInerte(false); }
      return c;
    }
    const seq = ++seqSaude;
    saudeAb = false;
    app.classList.remove('lendo', 'com-saude');
    pararAnims(el.saude);
    molduraS.style.transform = '';
    feixe(null);
    let a;
    if (reduz()) a = anim(molduraS, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
    else if (celular()) a = anim(molduraS, [{ transform: `translateY(${n1(arrasteYS)}px)` }, { transform: 'translateY(100%)' }], { duration: arrasteYS ? 240 : 300, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    else {
      for (const e of [molduraS.querySelector('header'), el.sCorpo]) anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 130, fill: 'forwards' });
      a = anim(molduraS, [
        { transform: 'scaleY(1)', opacity: 1, easing: 'cubic-bezier(.6,0,.8,.3)' },
        { transform: 'scaleY(.004)', opacity: 1, offset: .5 },
        { transform: 'scaleY(.004)', opacity: 0, offset: .52 },
        { transform: 'scaleY(.004)', opacity: 0 },
      ], { duration: 440, fill: 'forwards' });
      const s = semente();
      s.style.left = `${n1(r.x)}px`; s.style.top = `${n1(c.y - 1)}px`; s.style.width = `${n1(r.width)}px`;
      const k = 14 / Math.max(1, r.width);
      soltarSemente(s, anim(s, [
        { transform: 'scale(1, 1)', opacity: 0 },
        { transform: 'scale(1, 1)', opacity: 0, offset: .46 },
        { transform: 'scale(1, 1)', opacity: 1, offset: .5, easing: 'cubic-bezier(.5,0,.3,1)' },
        { transform: `scale(${k}, 7)`, opacity: 1, offset: .94 },
        { transform: `scale(${k}, 7)`, opacity: 0 },
      ], { duration: 440 }));
    }
    arrasteYS = 0;
    marcarInerte(false);
    await fim(a);
    if (seq !== seqSaude) return c;   // reaberto no meio do caminho
    el.saude.hidden = true;
    pararAnims(el.saude);
    molduraS.classList.remove('montando');
    const ativo = doc.activeElement;
    if (!ativo || ativo === doc.body || el.saude.contains(ativo)) {
      if (focoAntes && focoAntes.isConnected && typeof focoAntes.focus === 'function' && focoAntes !== doc.body && !focoAntes.closest('[hidden]')) { try { focoAntes.focus({ preventScroll: true }); } catch (_) {} }
      else if (ativo && el.saude.contains(ativo)) ativo.blur();
    }
    focoAntes = null;
    return c;
  }
  const fecharSaudePeloUsuario = () => { if (typeof opts.onFechar === 'function') opts.onFechar(); else fecharSaude(); };
  el.chip?.addEventListener('click', () => { if (typeof opts.onSaude === 'function') opts.onSaude({ origem: centroEl(el.chip) }); else if (saudeAb) fecharSaude(); else abrirSaude({ origem: centroEl(el.chip) }); });
  el.sFechar?.addEventListener('click', fecharSaudePeloUsuario);
  el.sAtualizar?.addEventListener('click', () => opts.onSaudeAtualizar?.());
  el.sCorpo?.addEventListener('submit', e => {
    const f = e.target.closest && e.target.closest('form.s-chave'); if (!f) return;
    e.preventDefault();
    const inp = f.querySelector('input[name="chave"]');
    const lembrar = !!f.querySelector('input[name="lembrar"]')?.checked;
    const v = inp ? inp.value.trim() : '';
    if (!v) { try { inp?.focus(); } catch (_) {} return; }
    inp.value = '';
    try { inp.blur(); } catch (_) {}
    opts.onSaudeChave?.(v, { lembrar });
  });
  el.sCorpo?.addEventListener('click', e => {
    const a = e.target.closest('button[data-acao]');
    if (a) { if (a.dataset.acao === 'tentar') opts.onSaudeAtualizar?.(); else if (a.dataset.acao === 'esquecer') opts.onSaudeEsquecer?.(); return; }
    const b = e.target.closest('button.s-item[data-id], button.s-inc[data-id]'); if (!b) return;
    const i = itensSaude().find(x => x.id === b.dataset.id);
    if (i) opts.onSaudeItem?.(i, { origem: centroEl(b) });
  });
  // a linha de uma rotina em foco no painel: o robô olha para a conta dela no halo (como na aba Rotinas)
  if (el.sCorpo && typeof opts.onFocoSaude === 'function') {
    const entra = e => { const b = e.target.closest('button.s-item[data-id], button.s-inc[data-id]'); const i = b ? itensSaude().find(x => x.id === b.dataset.id) : null; if (i) opts.onFocoSaude(i); };
    const sai = e => { const b = e.target.closest('button.s-item, button.s-inc'); if (b && !(e.relatedTarget && b.contains(e.relatedTarget))) opts.onFocoSaude(null); };
    el.sCorpo.addEventListener('pointerover', entra); el.sCorpo.addEventListener('pointerout', sai);
  }
  // Celular: arrastar a alça da folha para baixo fecha (igual ao leitor e ao funil).
  const alcaS = molduraS && molduraS.querySelector('.alca');
  alcaS?.addEventListener('pointerdown', e => {
    if (!celular() || !saudeAb) return;
    const y0 = e.clientY; let dy = 0;
    try { alcaS.setPointerCapture(e.pointerId); } catch (_) {}
    const mover = ev => { dy = Math.max(0, ev.clientY - y0); molduraS.style.transform = `translateY(${dy}px)`; };
    const soltar = () => {
      alcaS.removeEventListener('pointermove', mover); alcaS.removeEventListener('pointerup', soltar); alcaS.removeEventListener('pointercancel', soltar);
      if (dy > 80) { arrasteYS = dy; fecharSaudePeloUsuario(); return; }
      molduraS.style.transform = '';
      if (dy > 0 && !reduz()) anim(molduraS, [{ transform: `translateY(${n1(dy)}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
    };
    alcaS.addEventListener('pointermove', mover); alcaS.addEventListener('pointerup', soltar); alcaS.addEventListener('pointercancel', soltar);
  });
  renderChip();

  /* ================================ TECLADO E CLIQUES GLOBAIS ================================ */
  const campoTexto = a => !!a && (a.tagName === 'TEXTAREA' || a.isContentEditable || (a.tagName === 'INPUT' && /^(text|search|email|url|tel|password|number)$/i.test(a.type || 'text')));
  doc.addEventListener('keydown', e => {
    const a = doc.activeElement, digitando = campoTexto(a);
    if (e.key === '/' && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey && el.q) { e.preventDefault(); el.q.focus(); el.q.select(); return; }
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (digitando) { a.blur(); return; }
    // leitor aberto a partir do funil: Esc volta um nível (para o funil daquela rotina), como o "← Voltar ao fluxo"
    if (aberto) { e.preventDefault(); if (leitorVoltar && el.lFluxo && !el.lFluxo.hidden) el.lFluxo.click(); else fecharPeloUsuario(); return; }
    if (fluxoAb) { e.preventDefault(); fecharFluxoPeloUsuario(); return; }
    if (saudeAb) { e.preventDefault(); fecharSaudePeloUsuario(); return; }
    if (el.menu && !el.menu.hidden) { menu(false); el.menuBtn?.focus(); return; }
    if (lequeDados.length) { deptAtivo = null; marcarTrilho(); leque([], null, []); opts.onDepto?.(null); return; }
    if (resposta.aberta()) { resposta.fechar(); return; }
  });
  doc.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a.wl');
    if (!a) return;
    e.preventDefault();
    const alvo = a.dataset.wl || a.textContent || '';
    opts.onLink?.(alvo, { origem: centroEl(a), noLeitor: !!(el.leitor && el.leitor.contains(a)), noFluxo: !!(el.fluxo && el.fluxo.contains(a)) });
  });
  doc.addEventListener('pointerdown', e => {
    const t = e.target;
    if (el.res && !el.res.hidden && !(t.closest && t.closest('.busca'))) esconderRes();
    if (el.menu && !el.menu.hidden && !(t.closest && (t.closest('#menu') || t.closest('#menuBtn')))) menu(false);
  }, true);
  let resizeT = 0;
  window.addEventListener('resize', () => {
    if (el.dica) el.dica.hidden = true;
    clearTimeout(resizeT); resizeT = setTimeout(() => { posicionarCartas(); if (aberto || fluxoAb || saudeAb) marcarInerte(celular()); }, 80);
  });

  return {
    stats, trilho, recentes,
    abrirLeitor, fecharLeitor,
    leitorAberto: () => aberto,
    retanguloLeitor, feixe, leque, resultados, dica, aviso, resposta, menu, visao,
    // extras (fora do contrato, opcionais): nó aberto no leitor e área livre para posicionar o leque
    noAberto: () => noAtual,
    areaLivre: limites,
    // aba Rotinas e o funil (ROTINAS.md §3)
    aba, rotinas, abrirFluxo, fecharFluxo, voltarFluxo,
    fluxoAberto: () => fluxoAb,
    noFluxo: () => fluxoNo,
    // saúde dos sistemas (GUARDIAO.md §7): chip, painel Saúde, aba Rotinas e funil
    saude, abrirSaude, fecharSaude, esconderSaudeJa,
    saudeAberta: () => saudeAb,
    centroChip: () => (el.chip && visivel(el.chip) ? centroEl(el.chip) : null),
  };
}
