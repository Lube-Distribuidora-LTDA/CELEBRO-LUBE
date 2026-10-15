/* ==========================================================================
   Cérebro da Lube — camada de dados (js/dados.js)
   Porte fiel do painel antigo: vault, grafo, markdown, busca, armazenamento,
   modo ao vivo local e vault de exemplo. Sem DOM (só lerPasta recebe um FileList).
   ========================================================================== */

/* ---------- Constantes ---------- */
export const KIND_LABEL = { core:'Mapa central', skill:'Skill', memory:'Memória', routine:'Rotina', app:'Aplicação', dept:'Departamento' };
export const PALETA = ['#3DA9FF','#FF4D63','#8E7CFF','#35E3FF','#F1F5FF','#5B7BFF','#FF94A8','#2DD4BF','#B9C7FF','#FFC24D','#7FD8FF','#C98BFF'];
export const COR_TIPO = { core:'#F20D1F', skill:'#3DA9FF', routine:'#FF2D46', app:'#9EB2FF' };
const COR_NEUTRA = '#8a97c4'; // --muted

/** Cor do nó: a do tipo (core, skill, rotina, aplicação) ou a do departamento. */
export function corDe(n){
  if (!n) return COR_NEUTRA;
  if (COR_TIPO[n.kind]) return COR_TIPO[n.kind];
  return PALETA[(n.ci || 0) % PALETA.length];
}

/* ---------- Utilidades ---------- */
export function norm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
export function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function rng(seed){ let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hash(s){ s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function relTime(ms){
  if (!ms) return ''; const d = Math.floor((Date.now() - ms) / 864e5);
  if (d <= 0) return 'hoje'; if (d === 1) return 'ontem'; if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30); if (d < 365) return m === 1 ? 'há 1 mês' : `há ${m} meses`;
  const a = Math.floor(d / 365); return a === 1 ? 'há 1 ano' : `há ${a} anos`;
}
export function kb(n){ n = Math.max(0, +n || 0); return n < 1024 ? `${n} B` : `${(n / 1024).toLocaleString('pt-BR', { maximumFractionDigits:n < 10240 ? 1 : 0 })} KB`; }
export function initials(name){ const w = String(name || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/); if (/^\d/.test(w[1] || '')) return (w[0][0] + w[1]).slice(0, 3).toUpperCase(); return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase(); }

/* ---------- Frontmatter ---------- */
export function parseFM(text){
  text = String(text ?? '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm:{}, body:text };
  const fm = {}; let key = null;
  for (const line of m[1].split(/\r?\n/)){
    let mm;
    if ((mm = line.match(/^([A-Za-zÀ-ÿ0-9_ -]+):\s*(.*)$/))){
      key = mm[1].trim().toLowerCase(); let v = mm[2].trim();
      if (/^\[.*\]$/.test(v) && !/^\[\[[^\[]/.test(v)) v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      else v = v.replace(/^["']|["']$/g, '');
      fm[key] = v === '' ? [] : v;
    } else if (key && (mm = line.match(/^\s*-\s+(.*)/))){
      if (!Array.isArray(fm[key])) fm[key] = fm[key] ? [fm[key]] : [];
      fm[key].push(mm[1].trim().replace(/^["']|["']$/g, ''));
    }
  }
  return { fm, body:text.slice(m[0].length) };
}

/* ---------- Markdown ---------- */
/** Negrito, itálico e ==marca== (texto já escapado, sem links). */
function enfase(s){
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/==([^=]+)==/g, '<mark>$1</mark>');
  return s;
}
/**
 * Marcação de linha (recebe texto JÁ escapado). [[alvo|apelido]] vira <a class="wl" data-wl="alvo">.
 * O HTML já gerado (código, [[links]], [texto](url), URL solta) é guardado atrás de um marcador
 * (\u0001N\u0001) antes das trocas seguintes: nenhuma regex mexe dentro de uma tag ou de um atributo.
 */
export function inline(s){
  s = String(s ?? '').replace(/\u0001/g, '');
  const html = [], cru = [];
  const guardar = (h, txt) => { html.push(h); cru.push(txt); return `\u0001${html.length - 1}\u0001`; };
  const MARCA = /\u0001(\d+)\u0001/g;
  const semMarca = x => x.replace(MARCA, (m, i) => cru[+i] ?? '');   // texto puro (para atributos)
  s = s.replace(/`([^`]+)`/g, (m, c) => guardar(`<code>${c}</code>`, '`' + c + '`'));
  s = s.replace(/\[\[([^\]]+?)\]\]/g, (m, t) => {
    const [tg, al] = t.split(/\\?\|/);
    const target = semMarca(tg.split('#')[0]).trim();
    const rot = (al || tg).trim();
    return guardar(`<a href="#" class="wl" data-wl="${target}">${enfase(rot)}</a>`, semMarca(rot));
  });
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s\u0001]+)\)/g, (m, rot, url) => guardar(`<a href="${url}" target="_blank" rel="noopener">${enfase(rot)}</a>`, semMarca(rot)));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>"')\u0001]+)/g, (m, antes, url) => antes + guardar(`<a href="${url}" target="_blank" rel="noopener">${url}</a>`, url));
  s = enfase(s);
  for (let k = 0; k < 4 && s.includes('\u0001'); k++) s = s.replace(MARCA, (m, i) => html[+i] ?? '');
  return s;
}
export function table(rows){
  // "\|" é barra escapada (o Obsidian usa em [[nota\|apelido]] dentro de tabela): não separa célula.
  const cells = r => r.trim().replace(/^\||\|$/g, '').replace(/\\\|/g, '\u0000').split('|').map(c => inline(esc(c.replace(/\u0000/g, '|').trim())));
  const body = rows.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r));
  if (!body.length) return '';
  const [h, ...rest] = body;
  return `<div class="tbl"><table><thead><tr>${cells(h).map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rest.map(r => `<tr>${cells(r).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/** Mesmo algoritmo do renderMD antigo, mas guardando cada bloco de nível superior separado. */
function blocos(text){
  const lines = String(text).split(/\r?\n/); const out = []; let i = 0, list = null, buf = '', sub = false;
  // sub = há um <ul> aberto dentro do último <li> de um <ol> (sub-itens "   - " de uma etapa numerada)
  const closeSub = () => { if (sub){ buf += '</ul></li>'; sub = false; } };
  const closeList = () => { closeSub(); if (list){ out.push(buf + `</${list}>`); list = null; buf = ''; } };
  const blockStart = /^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|>|\s*\|)/;
  while (i < lines.length){
    const l = lines[i]; let m;
    if (/^```/.test(l)){ closeList(); const code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++; out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue; }
    if (/^\s*\|/.test(l)){ closeList(); const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]); out.push(table(rows)); continue; }
    if ((m = l.match(/^(#{1,6})\s+(.*)/))){ closeList(); const h = Math.min(4, m[1].length + 1); out.push(`<h${h}>${inline(esc(m[2]))}</h${h}>`); i++; continue; }
    if ((m = l.match(/^(\s*)[-*+]\s+(\[( |x|X)\]\s+)?(.*)/))){
      const box = m[2] ? (m[3].trim() ? '☑ ' : '☐ ') : '', li = `<li>${box}${inline(esc(m[4]))}</li>`;
      // recuado embaixo de um item numerado: lista dentro do item (a numeração do <ol> continua depois)
      if (list === 'ol' && m[1].length >= 2 && buf.endsWith('</li>')){ if (!sub){ buf = buf.slice(0, -5) + '<ul>'; sub = true; } buf += li; i++; continue; }
      if (list !== 'ul'){ closeList(); buf = '<ul>'; list = 'ul'; } buf += li; i++; continue;
    }
    if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)/))){ closeSub(); if (list !== 'ol'){ closeList(); const n = +m[1]; buf = n !== 1 ? `<ol start="${n}">` : '<ol>'; list = 'ol'; } buf += `<li>${inline(esc(m[2]))}</li>`; i++; continue; }
    if (/^>/.test(l)){ closeList(); const q = []; while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${inline(esc(q.join(' ')))}</blockquote>`); continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(l)){ closeList(); out.push('<hr>'); i++; continue; }
    if (!l.trim()){ closeList(); i++; continue; }
    closeList(); const p = [l]; i++;
    while (i < lines.length && lines[i].trim() && !blockStart.test(lines[i])) p.push(lines[i++]);
    out.push(`<p>${inline(esc(p.join(' ')))}</p>`);
  }
  closeList();
  return out.filter(Boolean);
}
/** HTML da nota inteira (igual ao antigo). */
export function renderMD(text){ return blocos(text).join(''); }
/** Um HTML por bloco de nível superior (título, parágrafo, lista, tabela, código, citação, linha). blocosMD(t).join('') === renderMD(t). */
export function blocosMD(text){ return blocos(text); }

/* ---------- Grafo do vault ---------- */
const RX_SKILL = /^(\d+[\s._-]*)?(skills?|habilidades?)$/i;
const RX_ROUT = /^(\d+[\s._-]*)?(rotinas?|routines?|automa[cç](o|õ)es)$/i;
const RX_APP = /^(\d+[\s._-]*)?(apps?|aplica[cç](o|õ)es|applications?|conex(o|õ)es|integra[cç](o|õ)es|ferramentas)$/i;
export const IGNORE = /(^|\/)(\.[^\/]+|node_modules)\//i;
export const DEPT_ORDER = ['comercial','clientes','conversas','processos','financeiro','logistica','compras','marketing','memoria & infra','diario'];
const cleanFolder = s => s.replace(/^[\d\s._-]+/, '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || s;
const first = v => Array.isArray(v) ? v[0] : v;

/**
 * Monta o grafo. G = {nodes, depts, core, vaultName, linkCount}.
 * Nós: id, kind, name, path, text, size, mtime, fm, tags, dept, ci, links:Set<id>, back:Set<id>, _hay.
 * Skills: uma pasta por skill (files, folder, skillFolder). depts = [{name, ci, list, hub}].
 */
export function buildGraph(files, vaultName){
  const nodes = []; const skillGroups = new Map(); let core = null;
  const mk = o => { const n = Object.assign({ links:new Set(), back:new Set(), size:0, mtime:0, tags:[], fm:{}, text:'', files:[], dept:'', kind:'memory' }, o); n.id = nodes.length; nodes.push(n); return n; };
  for (const f of files || []){
    const rel = f.path; if (!rel || IGNORE.test(rel) || !/\.md$/i.test(rel)) continue;
    const text = String(f.text ?? '');
    const segs = rel.split('/'); const fname = segs[segs.length - 1]; const base = fname.replace(/\.md$/i, '');
    const { fm } = parseFM(text);
    const tipo = norm(first(fm.tipo || fm.type || ''));
    const tags = [].concat(fm.tags || []).map(String);
    // Skills: uma pasta por skill
    let skillKey = null;
    const si = segs.findIndex((s, i) => i < segs.length - 1 && RX_SKILL.test(s));
    if (si >= 0) skillKey = segs.length - si > 2 ? segs.slice(0, si + 2).join('/') : rel;
    else if (/^skill\.md$/i.test(fname) && segs.length > 1) skillKey = segs.slice(0, -1).join('/');
    else if (/^(skill|habilidade)/.test(tipo)) skillKey = rel;
    if (skillKey){ if (!skillGroups.has(skillKey)) skillGroups.set(skillKey, []); skillGroups.get(skillKey).push({ ...f, text, rel, fm, tags, base }); continue; }
    if (!core && /^claude\.md$/i.test(rel)){ core = mk({ kind:'core', name:'CLAUDE.md', path:rel, text, size:f.size, mtime:f.mtime, fm, tags }); continue; }
    let kind = 'memory';
    if (segs.slice(0, -1).some(s => RX_ROUT.test(s)) || /^(rotina|routine|automacao)/.test(tipo)) kind = 'routine';
    else if (segs.slice(0, -1).some(s => RX_APP.test(s)) || /^(app|aplicacao|conexao|integracao|ferramenta)/.test(tipo)) kind = 'app';
    let dept = '';
    if (kind === 'memory'){
      const fd = first(fm.departamento || fm.area || fm.frente || fm.department);
      dept = fd ? String(fd).replace(/\[\[|\]\]/g, '') : (segs.length > 1 ? cleanFolder(segs[0]) : 'Geral');
    }
    mk({ kind, name:base, path:rel, text, size:f.size, mtime:f.mtime, fm, tags, dept });
  }
  if (!core) core = mk({ kind:'core', name:'CLAUDE.md', path:'CLAUDE.md', text:'# CLAUDE.md\n\nEste vault ainda não tem um `CLAUDE.md` na raiz. Crie um: ele é o mapa que o Claude lê primeiro para entender como o cérebro está organizado.', virtual:true });
  for (const [key, list] of skillGroups){
    const main = list.find(x => /^skill\.md$/i.test(x.base + '.md')) || list[0];
    const name = /\.md$/i.test(key) ? key.split('/').pop().replace(/\.md$/i, '') : key.split('/').pop();
    const n = mk({ kind:'skill', name: first(main.fm.name) || name, path:main.rel, text:main.text, fm:main.fm, tags:main.tags,
      size:list.reduce((a, x) => a + (x.size || 0), 0), mtime:Math.max(...list.map(x => x.mtime || 0)), folder:key,
      files:list.map(x => ({ path:x.rel, name:x.rel.slice(key.length + 1) || x.base, size:x.size })), _all:list });
    n.skillFolder = name;
  }
  // Índice de nomes
  const idx = new Map();
  const put = (k, n) => { k = norm(k); if (k && !idx.has(k)) idx.set(k, n); };
  for (const n of nodes){
    if (n.kind === 'skill'){ put(n.name, n); put(n.skillFolder, n); for (const x of n._all){ put(x.rel.replace(/\.md$/i, ''), n); if (!/^skill$/i.test(x.base)) put(x.base, n); } }
    else { put(n.path.replace(/\.md$/i, ''), n); put(n.name, n); for (const a of [].concat(n.fm.aliases || [])) put(a, n); }
  }
  const resolve = t => { t = norm(t.replace(/\.md$/i, '')); return idx.get(t) || idx.get(t.split('/').pop()); };
  for (const n of nodes){
    const texts = n.kind === 'skill' ? n._all.map(x => x.text) : [n.text];
    for (const txt of texts){
      for (const m of txt.matchAll(/\[\[([^\]]+?)\]\]/g)){ const tgt = resolve(m[1].split(/\\?\|/)[0].split('#')[0].trim()); if (tgt && tgt !== n){ n.links.add(tgt.id); tgt.back.add(n.id); } }
      for (const m of txt.matchAll(/\]\(([^)\s]+?\.md)\)/g)){ let p; try { p = decodeURIComponent(m[1]); } catch (e) { p = m[1]; } const tgt = resolve(p); if (tgt && tgt !== n){ n.links.add(tgt.id); tgt.back.add(n.id); } }
    }
    n._hay = norm(n.name + ' ' + n.tags.join(' ') + ' ' + n.dept + ' ' + texts.join('\n'));
    delete n._all;
  }
  // Departamentos
  const dmap = new Map();
  for (const n of nodes) if (n.kind === 'memory'){ if (!dmap.has(n.dept)) dmap.set(n.dept, []); dmap.get(n.dept).push(n); }
  const depts = [...dmap.entries()].map(([name, list]) => ({ name, list }));
  depts.sort((a, b) => { const ia = DEPT_ORDER.indexOf(norm(a.name)), ib = DEPT_ORDER.indexOf(norm(b.name)); if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); return b.list.length - a.list.length; });
  depts.forEach((d, i) => { d.ci = i; d.hub = mk({ kind:'dept', name:d.name, dept:d.name, ci:i }); d.hub._hay = norm(d.name); d.list.forEach(n => n.ci = i); });
  const linkCount = nodes.reduce((a, n) => a + n.links.size, 0);
  const G = { nodes, depts, core, vaultName, linkCount };
  Object.defineProperty(G, 'resolver', { value:resolve, enumerable:false }); // mesma resolução usada nas conexões
  return G;
}

/** Contagem para o contador da marca. */
export function contar(G){
  const c = { memorias:0, skills:0, rotinas:0, apps:0, conexoes:G ? G.linkCount || 0 : 0 };
  if (!G) return c;
  for (const n of G.nodes){
    if (n.kind === 'memory') c.memorias++;
    else if (n.kind === 'skill') c.skills++;
    else if (n.kind === 'routine') c.rotinas++;
    else if (n.kind === 'app') c.apps++;
  }
  return c;
}

/** Caminhos de notas novas ou com mtime diferente entre duas leituras do vault. */
export function mudancas(Gantes, Gdepois){
  const out = new Set(); if (!Gantes || !Gdepois) return out;
  const prevM = new Map(); for (const n of Gantes.nodes) if (n.path) prevM.set(n.path, n.mtime);
  for (const n of Gdepois.nodes) if (n.path && !n.virtual && (!prevM.has(n.path) || prevM.get(n.path) !== n.mtime)) out.add(n.path);
  return out;
}

/* ---------- Busca ---------- */
/** Busca por nome, tags, departamento e texto (= searchNodes antigo; inclui os nós de departamento). */
export function buscar(G, q, limit = 8){
  if (!G) return [];
  const terms = norm(q).split(/[\s,;]+/).filter(t => t.length > 1); if (!terms.length) return [];
  const out = [];
  for (const n of G.nodes){
    if (!n._hay) continue; const nm = norm(n.name); let s = 0;
    for (const t of terms){ if (nm.includes(t)) s += nm.startsWith(t) ? 12 : 8; let c = 0, i = n._hay.indexOf(t); while (i >= 0 && c < 6){ c++; i = n._hay.indexOf(t, i + t.length); } s += c; }
    if (s > 0) out.push([n, s + (n.kind === 'skill' ? 1 : 0)]);
  }
  return out.sort((a, b) => b[1] - a[1]).slice(0, limit).map(x => x[0]);
}
/** Trecho do texto em volta do primeiro termo encontrado (= snippet antigo). */
export function trecho(n, q){ const terms = norm(q).split(/\s+/).filter(t => t.length > 1); const txt = (n && n.text) || ''; const hay = norm(txt); let i = -1; for (const t of terms){ i = hay.indexOf(t); if (i >= 0) break; } const s = Math.max(0, i - 120); return txt.slice(s, s + 320).replace(/\s+/g, ' ').trim(); }

/** Segue um [[link]]: por caminho, nome, pasta da skill e sufixo (= followWiki antigo); depois, a mesma resolução das conexões. */
export function seguirLink(G, alvo){
  if (!G || alvo == null) return null;
  const t = norm(String(alvo).trim());
  if (!t) return null;
  const P = x => norm((x.path || '').replace(/\.md$/i, '')); const pool = G.nodes.filter(x => x.kind !== 'dept');
  const n = pool.find(x => P(x) === t) || pool.find(x => norm(x.name) === t) || pool.find(x => x.kind === 'skill' && norm(x.skillFolder) === t) || pool.find(x => P(x).endsWith('/' + t));
  if (n) return n;
  const r = G.resolver ? G.resolver(String(alvo).trim()) : null;
  return r && r.kind !== 'dept' ? r : null;
}

export function obsidianUrl(G, n){ return `obsidian://open?vault=${encodeURIComponent(G.vaultName)}&file=${encodeURIComponent(String(n.path || '').replace(/\.md$/i, ''))}`; }

/* ---------- Rotinas e o fluxo de cada uma (aba Rotinas + funil) ---------- */
/**
 * Tipos de etapa do funil. `cor` é o nome do token CSS (estilo.css): --violeta = #8E7CFF e
 * --azul-claro = --azul clareado ficam lá, junto dos outros tokens.
 */
export const TIPOS_ETAPA = {
  gatilho:  { rotulo:'Gatilho',  cor:'--holo' },
  pessoa:   { rotulo:'Pessoa',   cor:'--rever' },
  le:       { rotulo:'Lê',       cor:'--novo' },
  processa: { rotulo:'Processa', cor:'--violeta' },
  confere:  { rotulo:'Confere',  cor:'--ok' },
  grava:    { rotulo:'Grava',    cor:'--azul-claro' },
  avisa:    { rotulo:'Avisa',    cor:'--vermelho' },
  entrega:  { rotulo:'Entrega',  cor:'--holo' },
};
const TIPO_POR_NOME = { gatilho:'gatilho', dispara:'gatilho', disparo:'gatilho', pessoa:'pessoa', manual:'pessoa', le:'le', leitura:'le',
  processa:'processa', processamento:'processa', confere:'confere', conferencia:'confere', valida:'confere', validacao:'confere',
  grava:'grava', gravacao:'grava', guarda:'grava', avisa:'avisa', aviso:'avisa', entrega:'entrega', saida:'entrega' };
// hasOwn: um rótulo como "**Constructor**" não pode achar uma propriedade de Object.prototype
const tipoDeRotulo = rot => { const k = norm(rot).replace(/[^a-z]/g, ''); return Object.prototype.hasOwnProperty.call(TIPO_POR_NOME, k) ? TIPO_POR_NOME[k] : null; };
const limparLink = v => String(v ?? '').replace(/\[\[|\]\]/g, '').trim();
const alvoDoLink = t => String(t).split(/\\?\|/)[0].split('#')[0].trim();

/** Texto puro de uma linha de markdown ([[alvo|apelido]] → apelido, sem `código`, ** e *). */
function textoPuro(s){
  return String(s ?? '')
    .replace(/\[\[([^\]]+?)\]\]/g, (m, t) => { const [a, b] = t.split(/\\?\|/); return (b || a.split('#')[0]).trim(); })
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1$2')
    .replace(/==([^=]+)==/g, '$1').replace(/~~([^~]+)~~/g, '$1')
    .replace(/\s+/g, ' ').trim();
}
/** Até `max` caracteres, cortando de preferência no fim de uma frase ou parte. */
function curto(s, max = 140){
  s = String(s || '').trim(); if (s.length <= max) return s;
  const c = s.slice(0, max + 1);
  const m = Math.max(c.lastIndexOf('. '), c.lastIndexOf('; '), c.lastIndexOf(': '), c.lastIndexOf(' — '));
  if (m > max * 0.45) return c.slice(0, m).replace(/[\s,;:—-]+$/, '');
  const e = c.lastIndexOf(' ');
  return (e > max * 0.6 ? c.slice(0, e) : s.slice(0, max)).replace(/[\s,;:—-]+$/, '') + '…';
}
/** Parte inicial de uma frase: até o primeiro parêntese, travessão, ponto ou dois-pontos (e vírgula, se pedir). */
function parteInicial(s, virgula = false){
  s = String(s || ''); let fim = s.length;
  for (const sep of [' (', '(', ' — ', ' – ', '. ', ': ', ...(virgula ? [', '] : [])]){ const i = s.indexOf(sep); if (i > 0 && i < fim) fim = i; }
  return s.slice(0, fim).trim();
}
/** Linha "**Rótulo:** texto" do corpo (a primeira). */
function linhaRotulada(body, rotulo){
  const rx = new RegExp(`^\\s*(?:[-*]\\s+)?\\*\\*${rotulo}\\s*:?\\s*\\*\\*\\s*:?\\s*(.+)$`, 'im');
  const m = String(body || '').match(rx); return m ? m[1].trim() : '';
}
/** Primeiro parágrafo depois de um título "## Quando…" (ex.: "## Quando sai"). */
function secaoQuando(body){
  const ls = String(body || '').split(/\r?\n/);
  const i = ls.findIndex(l => /^#{2,4}\s+quando\b/i.test(norm(l)));
  if (i < 0) return '';
  const p = [];
  for (let k = i + 1; k < ls.length; k++){ const l = ls[k]; if (/^#{1,6}\s/.test(l)) break; if (!l.trim()){ if (p.length) break; continue; } p.push(l.trim()); }
  return p.join(' ');
}
/** Todos os HH:MM de um texto (aceita 7h30 e 18h; "a cada 2h" / "em 2h" não é horário), em ordem. */
function acharHorarios(txt){
  const s = String(txt || ''), out = new Set();
  for (const m of s.matchAll(/(^|[^\d:])([01]?\d|2[0-3])[:h]([0-5]\d)(?![\d:])/g)) out.add(`${m[2].padStart(2, '0')}:${m[3]}`);
  if (!/cada|\bem\s+\d/i.test(s)) for (const m of s.matchAll(/(^|[^\d:])([01]?\d|2[0-3])h(?![\wÀ-ÿ])/g)) out.add(`${m[2].padStart(2, '0')}:00`);
  return [...out].sort();
}
const DIAS_SEMANA = [['domingo', 0], ['segunda', 1], ['terca', 2], ['quarta', 3], ['quinta', 4], ['sexta', 5], ['sabado', 6]];
const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** Dias da semana citados (0 = domingo); null = todo dia. */
function acharDias(txt){
  const s = norm(txt);
  if (/dias? ute(is|l)/.test(s)) return [1, 2, 3, 4, 5];
  if (/fins? de semana/.test(s)) return [0, 6];
  const d = DIAS_SEMANA.filter(([n]) => new RegExp(`(^|[^a-z])${n}`).test(s)).map(([, i]) => i);
  return d.length ? d : null;
}
/** "a cada 5 minutos" / "de 5 em 5 minutos" / "a cada 2 horas" → minutos; 0 se não houver. */
function acharIntervalo(txt){
  const m = norm(txt).match(/(?:a cada|de)\s+(\d+)\s*(?:em\s+\d+\s*)?(min|minutos?|h|horas?)(?![a-z])/);
  if (!m) return 0; const v = +m[1]; return v > 0 ? (/^h/.test(m[2]) ? v * 60 : v) : 0;
}
function textoDias(dias){
  if (!dias || !dias.length) return '';
  const k = [...dias].sort().join('');
  if (k === '12345') return 'dias úteis'; if (k === '06') return 'fim de semana';
  return dias.map(d => NOME_DIA[d].slice(0, 3)).join(', ');
}
function resumoDe(horarios, dias, intervaloMin, texto, nome){
  let r;
  if (horarios.length > 1) r = `${horarios.length}× por dia · ${horarios[0]} → ${horarios[horarios.length - 1]}`;
  else if (horarios.length === 1) r = horarios[0];
  else if (intervaloMin) r = intervaloMin % 60 === 0 ? `a cada ${intervaloMin / 60} h` : `a cada ${intervaloMin} min`;
  else {
    const s = norm(`${texto} ${nome}`);
    if (/sempre no ar|o tempo todo|24 ?h|continu/.test(s)) r = 'sempre no ar';
    else if (/mensa|todo mes|cada mes|do mes|competencia/.test(s)) r = 'mensal';
    else if (/semana/.test(s)) r = 'semanal';
    else r = texto ? curto(texto, 34) : 'sem horário fixo';
  }
  const d = horarios.length || intervaloMin ? textoDias(dias) : '';
  return d ? `${d} · ${r}` : r;
}

/** Quando, onde e situação de uma rotina, lidos do frontmatter (ou das linhas **Quando:** / **Onde:** do corpo). */
function infoRotina(no){
  const { fm, body } = parseFM(no && no.text);
  const nome = String((no && no.name) || '');
  const k = nome.indexOf(' - ');
  const departamento = limparLink(first(fm.departamento || fm.area || fm.frente || fm.department));
  const grupo = k > 0 ? nome.slice(0, k).trim() : (departamento || 'Rotinas');
  const titulo = (k > 0 ? nome.slice(k + 3).trim() : '') || nome;
  const fv = fm.frequencia || fm['frequência'] || fm.frequency || fm.quando || fm.horario || fm['horário'];
  const freqFm = Array.isArray(fv) ? fv.join(', ') : fv;   // "frequencia: [07:50, 11:50]" vira lista no parseFM
  const fonte = String(freqFm || '').trim() || linhaRotulada(body, 'Quando') || secaoQuando(body);
  const puro = textoPuro(fonte), base = parteInicial(puro);
  const horarios = acharHorarios(base), dias = acharDias(base), intervaloMin = horarios.length ? 0 : acharIntervalo(puro);
  const frequenciaTexto = curto(puro, 140);
  const maqFm = first(fm.maquina || fm['máquina'] || fm.onde);
  const maquina = curto(maqFm ? textoPuro(maqFm) : parteInicial(textoPuro(linhaRotulada(body, 'Onde')), true), 60);
  const status = norm(first(fm.status) || '').trim();
  return { body, grupo, titulo, departamento, horarios, dias, intervaloMin, frequenciaTexto, maquina, status,
    resumo: resumoDe(horarios, dias, intervaloMin, frequenciaTexto, nome) };
}

/** Etapas da seção "## Fluxo" (lista numerada "N. **Tipo** · texto", sub-itens "   - " = observações). */
function lerSecaoFluxo(body){
  const ls = String(body || '').split(/\r?\n/);
  const i = ls.findIndex(l => /^#{2,3}\s+fluxo\b/i.test(norm(l)));
  if (i < 0) return [];
  const nivel = ls[i].match(/^#+/)[0].length;
  const cru = []; let etapa = null, nota = null;
  for (let k = i + 1; k < ls.length; k++){
    const l = ls[k], h = l.match(/^(#{1,6})\s/);
    if (h && h[1].length <= nivel) break;
    let m;
    if ((m = l.match(/^\s{0,3}\d+[.)]\s+(.*)$/))){ etapa = { txt:m[1].trim(), notas:[] }; cru.push(etapa); nota = null; continue; }
    if (etapa && (m = l.match(/^\s+[-*+]\s+(.*)$/))){ nota = { txt:m[1].trim() }; etapa.notas.push(nota); continue; }   // só o sub-item recuado ("   - ")
    if (etapa && /^\s+\S/.test(l)){ if (nota) nota.txt += ' ' + l.trim(); else etapa.txt += ' ' + l.trim(); continue; }   // continuação da linha
    if (!l.trim()){ nota = null; continue; }
    etapa = null; nota = null;   // texto sem recuo (parágrafo, lista solta) encerra a etapa: nada dele vira observação
  }
  const alvos = txt => [...String(txt).matchAll(/\[\[([^\]]+?)\]\]/g)].map(m => alvoDoLink(m[1])).filter(Boolean);
  return cru.map((e, idx) => {
    let rotulo = '', texto = e.txt, m;
    if ((m = texto.match(/^\*\*([^*]+?)\*\*\s*(?:·|—|–|-|:)\s*([\s\S]*)$/)) || (m = texto.match(/^\*\*([^*]+?):\*\*\s*([\s\S]*)$/))){ rotulo = m[1].replace(/:\s*$/, '').trim(); texto = m[2].trim(); }
    let tipo = rotulo ? tipoDeRotulo(rotulo) : null;
    if (!tipo) tipo = idx === 0 ? 'gatilho' : idx === cru.length - 1 ? 'entrega' : 'processa';
    const rot = rotulo && !tipoDeRotulo(rotulo) ? rotulo : TIPOS_ETAPA[tipo].rotulo;
    const notas = e.notas.map(n => {
      const mm = n.txt.match(/^\*\*\s*(se falhar|aten[cç][aã]o)\s*:?\s*\*\*\s*:?\s*([\s\S]*)$/i);
      const tom = mm ? (/^se/i.test(mm[1]) ? 'falha' : 'atencao') : 'info';
      return { tom, html:inline(esc(mm ? mm[2] : n.txt)) };
    });
    return { tipo, rotulo:rot, html:inline(esc(texto)), texto:textoPuro(texto), alvos:[...new Set([...alvos(texto), ...e.notas.flatMap(n => alvos(n.txt))])], notas };
  });
}

/** Nota de projeto do departamento da rotina (fm tipo: projeto ou pasta Projetos/). */
function projetoDaRotina(no, G, inf){
  if (!G || !Array.isArray(G.nodes)) return null;
  const projs = G.nodes.filter(n => n.kind === 'memory' && (norm(first(n.fm && n.fm.tipo) || '') === 'projeto' || /^projetos\//i.test(norm(n.path))));
  const g = norm(inf.grupo);
  return projs.find(p => norm(p.name) === g)
    || projs.find(p => { const a = norm(p.name); return g.length > 3 && (a.startsWith(g + ' ') || g.startsWith(a + ' ')); })
    || projs.find(p => no.links && no.links.has(p.id))
    || (inf.departamento ? projs.find(p => norm(p.dept) === norm(inf.departamento)) : null) || null;
}
function tipoPorAlvo(n){
  const s = norm(n.name);
  if (/winthor|oracle|pontomais|planilha|getrak|locaweb|imap|e-?mail|caixa/.test(s)) return 'le';
  if (/supabase|data.?warehouse|banco|postgres/.test(s)) return 'grava';
  if (/telegram|whatsapp|slack|aviso|notifica/.test(s)) return 'avisa';
  if (/sentinela|valida|confer/.test(s)) return 'confere';
  return 'processa';
}
/** Fluxo simples para a rotina sem "## Fluxo": Gatilho (quando/onde), um passo por [[link]] do corpo (até 5), Entrega (projeto). */
function deduzirFluxo(no, G, inf){
  const passos = [];
  const passo = (tipo, md, alvos = []) => ({ tipo, rotulo:TIPOS_ETAPA[tipo].rotulo, html:inline(esc(md)), texto:textoPuro(md), alvos, notas:[] });
  if (inf.frequenciaTexto || inf.maquina) passos.push(passo('gatilho', [inf.frequenciaTexto && `**Quando:** ${inf.frequenciaTexto}`, inf.maquina && `**Onde:** ${inf.maquina}`].filter(Boolean).join(' · ')));
  const proj = projetoDaRotina(no, G, inf);
  const vistos = new Set([no.id]); if (proj) vistos.add(proj.id);
  let links = 0;
  for (const m of String(inf.body || '').matchAll(/\[\[([^\]]+?)\]\]/g)){
    if (links >= 5) break;
    const alvo = alvoDoLink(m[1]); const n = G && alvo ? seguirLink(G, alvo) : null;
    if (!n || vistos.has(n.id) || n.kind === 'core' || n.kind === 'dept' || /^conversas\//i.test(norm(n.path))) continue;
    vistos.add(n.id); links++;
    passos.push(passo(tipoPorAlvo(n), m[0], [alvo]));
  }
  if (proj) passos.push(passo('entrega', `[[${proj.name}]]`, [proj.name]));
  return passos;
}

/** Fluxo da nota de rotina: as etapas da seção "## Fluxo" ou, sem ela, o fluxo deduzido (deduzido: true). */
export function parseFluxo(no, G){
  if (!no) return { passos:[], deduzido:true };
  const inf = infoRotina(no);
  const passos = lerSecaoFluxo(inf.body);
  if (passos.length) return { passos, deduzido:false };
  return { passos:deduzirFluxo(no, G, inf), deduzido:true };
}

/**
 * As rotinas do vault, em ordem de grupo e título: [{no, grupo, titulo, horarios, frequenciaTexto, maquina, status, fluxo,
 * resumo, dias, intervaloMin, departamento}]. grupo = o que vem antes de " - " no nome (senão o departamento).
 */
export function rotinas(G){
  if (!G || !Array.isArray(G.nodes)) return [];
  const out = [];
  for (const no of G.nodes){
    if (no.kind !== 'routine') continue;
    try {   // uma nota estranha não pode esvaziar a lista inteira: ela fica de fora e as outras aparecem
      const inf = infoRotina(no);
      const passos = lerSecaoFluxo(inf.body);
      const fluxo = passos.length ? { passos, deduzido:false } : { passos:deduzirFluxo(no, G, inf), deduzido:true };
      const { body, ...resto } = inf;
      out.push({ no, ...resto, fluxo });
    } catch (_) { /* nota pulada */ }
  }
  return out.sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR') || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/**
 * Próxima execução a partir de agora: {quando:Date, texto:'hoje 17:50 (em 2 h 10 min)', dia, hora, falta, minutos} | null.
 * opc.dias = dias da semana em que roda (0 = domingo); opc.intervaloMin = "a cada N min" (contado da meia-noite) quando não há horários.
 * A conta é de relógio: às 15:40 (e 15:40:59) faltam 2 h 10 min para as 17:50.
 */
export function proximaExecucao(horarios, agora = new Date(), opc = {}){
  const t0 = agora instanceof Date ? agora : new Date(agora);
  if (!Number.isFinite(t0.getTime())) return null;
  const dias = opc && Array.isArray(opc.dias) && opc.dias.length ? new Set(opc.dias) : null;
  const hm = (Array.isArray(horarios) ? horarios : []).map(h => String(h).trim().match(/^(\d{1,2}):(\d{2})$/)).filter(Boolean)
    .map(m => [+m[1], +m[2]]).filter(([h, m]) => h < 24 && m < 60).sort((a, b) => a[0] * 60 + a[1] - (b[0] * 60 + b[1]));
  let quando = null;
  if (hm.length){
    for (let d = 0; d <= 7 && !quando; d++){
      const y = t0.getFullYear(), mo = t0.getMonth(), dd = t0.getDate() + d;
      if (dias && !dias.has(new Date(y, mo, dd).getDay())) continue;
      for (const [h, m] of hm){ const c = new Date(y, mo, dd, h, m, 0, 0); if (c > t0){ quando = c; break; } }
    }
  } else if (opc && opc.intervaloMin > 0){
    const N = Math.round(opc.intervaloMin), meia = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate());
    quando = new Date(meia.getTime() + (Math.floor((t0 - meia) / 60000 / N) + 1) * N * 60000);
  }
  if (!quando) return null;
  const doMinuto = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate(), t0.getHours(), t0.getMinutes());
  const minutos = Math.max(1, Math.round((quando - doMinuto) / 60000));
  let falta;
  if (minutos < 60) falta = `em ${minutos} min`;
  else if (minutos < 1440){ const h = Math.floor(minutos / 60), r = minutos % 60; falta = r ? `em ${h} h ${r} min` : `em ${h} h`; }
  else { const d = Math.floor(minutos / 1440), h = Math.floor((minutos % 1440) / 60); falta = `em ${d} ${d === 1 ? 'dia' : 'dias'}${h ? ` e ${h} h` : ''}`; }
  const hoje = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()), alvo = new Date(quando.getFullYear(), quando.getMonth(), quando.getDate());
  const ddias = Math.round((alvo - hoje) / 864e5);
  const dia = ddias === 0 ? 'hoje' : ddias === 1 ? 'amanhã' : ddias < 7 ? NOME_DIA[quando.getDay()] : `${String(quando.getDate()).padStart(2, '0')}/${String(quando.getMonth() + 1).padStart(2, '0')}`;
  const hora = `${String(quando.getHours()).padStart(2, '0')}:${String(quando.getMinutes()).padStart(2, '0')}`;
  return { quando, texto:`${dia} ${hora} (${falta})`, dia, hora, falta, minutos };
}

/* ---------- Armazenamento no navegador (IndexedDB 'cerebro-lube', store 'kv') ---------- */
function idb(){ return new Promise((res, rej) => { const r = indexedDB.open('cerebro-lube', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('idb-blocked')); }); }
export async function idbSet(k, v){ try { const db = await idb(); try { await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); } finally { db.close(); } return true; } catch (e) { return false; } }
export async function idbGet(k){ try { const db = await idb(); try { return await new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); } finally { db.close(); } } catch (e) { return null; } }
export async function idbDel(k){ try { const db = await idb(); try { await new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = res; tx.onerror = res; tx.onabort = res; }); } finally { db.close(); } } catch (e) {} }

/* ---------- Leitura da pasta do vault ---------- */
/**
 * Lê os .md de um FileList de <input webkitdirectory>, em lotes de 50, até 600000 bytes por arquivo,
 * ignorando pastas ocultas e node_modules. onProgresso(lidas, total) é chamado no começo e a cada lote.
 * Lança Error('sem-md') se não houver nenhuma nota.
 */
export async function lerPasta(fileList, onProgresso){
  const list = Array.from(fileList || []);
  const vaultName = ((list[0] && list[0].webkitRelativePath) || '').split('/')[0] || 'Vault';
  const md = list.filter(f => /\.md$/i.test(f.name) && !IGNORE.test(f.webkitRelativePath || ''));
  if (!md.length) throw new Error('sem-md');
  const files = [];
  try { onProgresso?.(0, md.length); } catch (e) {}
  for (let i = 0; i < md.length; i += 50){
    const chunk = md.slice(i, i + 50);
    const texts = await Promise.all(chunk.map(f => f.size > 600000 ? f.slice(0, 600000).text() : f.text()));
    chunk.forEach((f, j) => files.push({ path:(f.webkitRelativePath || f.name).split('/').slice(f.webkitRelativePath ? 1 : 0).join('/'), text:texts[j], size:f.size, mtime:f.lastModified }));
    try { onProgresso?.(Math.min(md.length, i + 50), md.length); } catch (e) {}
  }
  return { vaultName, files, loadedAt:Date.now() };
}

/* ---------- Modo ao vivo (servidor local) ---------- */
function emLocalhost(){
  try { return typeof location !== 'undefined' && location.protocol.startsWith('http') && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); } catch (e) { return false; }
}
async function fetchVault(){
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 4000);
  try { const r = await fetch('/api/vault', { cache:'no-store', signal:ctl.signal }); if (!r.ok) return null; const j = await r.json(); return j && Array.isArray(j.files) ? j : null; }
  catch (e) { return null; } finally { clearTimeout(tm); }
}
/** GET /api/vault com timeout de 4 s. Só tenta em localhost; fora dele devolve null. */
export async function buscarVaultLocal(){ if (!emLocalhost()) return null; return fetchVault(); }

/**
 * Escuta /api/events (EventSource). A cada evento 'change' (debounce 350 ms) lê o vault de novo e chama onMudou(data).
 * onEstado('ao vivo') ao conectar; onEstado('reconectando') quando a conexão cai (ao voltar, relê o vault).
 * Devolve uma função que para de escutar.
 */
export function ouvirMudancas(onMudou, onEstado){
  if (typeof EventSource === 'undefined') return () => {};
  let es; try { es = new EventSource('/api/events'); } catch (e) { return () => {}; }
  let pend = null, caiu = false;
  const recarregar = async () => { const d = await fetchVault(); if (d) { try { onMudou?.(d); } catch (e) { console.error(e); } } };
  es.addEventListener('change', () => { clearTimeout(pend); pend = setTimeout(recarregar, 350); });
  es.onerror = () => { if (!caiu){ caiu = true; try { onEstado?.('reconectando'); } catch (e) {} } };
  es.onopen = () => { const voltou = caiu; caiu = false; try { onEstado?.('ao vivo'); } catch (e) {} if (voltou) recarregar(); };
  return () => { clearTimeout(pend); try { es.close(); } catch (e) {} };
}

/* ---------- Vault de exemplo (dados fictícios) ---------- */
export function vaultExemplo(){
  const r = rng(20260923); const pick = a => a[Math.floor(r() * a.length)]; const now = Date.now();
  const files = [];
  const fmStr = fm => '---\n' + Object.entries(fm).map(([k, v]) => `${k}: ${Array.isArray(v) ? '[' + v.join(', ') + ']' : v}`).join('\n') + '\n---\n';
  const add = (path, text, days) => files.push({ path, text, size:Math.round(text.length * 1.04), mtime:now - days * 864e5 - Math.floor(r() * 8e7) });

  add('CLAUDE.md', `${fmStr({ tipo:'mapa', status:'ativo', tags:['cerebro', 'mapa'] })}# CLAUDE.md — mapa do Cérebro da Lube

Este é o primeiro arquivo que o Claude lê. Ele explica como o cérebro está organizado e como registrar coisas novas.

## Estrutura de pastas
- **Comercial/**, **Clientes/**, **Financeiro/**, **Logística/**, **Compras/**, **Marketing/**, **Processos/**: memória por departamento
- **Conversas/**: resumo de cada conversa importante com o Claude, uma nota por conversa
- **Memória & Infra/**: sistemas, bancos de dados e decisões técnicas
- **Skills/**: uma pasta por skill, com um \`SKILL.md\` e arquivos de referência
- **Rotinas/**: tarefas recorrentes (o que roda, quando e onde)
- **Aplicações/**: uma nota por sistema conectado (WinThor, Supabase, Slack…)

## Frontmatter padrão
\`\`\`
tipo: nota | conversa | skill | rotina | app
departamento: Comercial
status: ativo | arquivado
tags: [tag1, tag2]
\`\`\`

## Regras
1. Toda nota nova liga pelo menos uma nota existente com [[wikilink]].
2. Toda conversa relevante vira uma nota em Conversas/ usando a skill [[registrar-conversa]].
3. Dados de vendas vêm do WinThor via [[data-warehouse]]; nunca copie números à mão.
4. Decisões ficam em [[Decisões de arquitetura]] ou na nota do departamento.

## Por onde começar
[[Metas Q3 2026]] · [[Pipeline de vendas]] · [[Fluxo de pedido WinThor]] · [[Schema do data warehouse]] · [[Brief da manhã]]
`, 2);

  const skills = {
    'data-warehouse':['Usar ao criar, alterar ou diagnosticar qualquer BI ou sistema da Lube que leia do Oracle/WinThor e grave no Supabase DATA WAREHOUSE.', ['referencias/conexoes.md', 'referencias/agendamento.md', 'exemplos/consulta-vendas.md'], ['WinThor', 'Oracle', 'Supabase', 'Schema do data warehouse', 'Sync WinThor para Supabase']],
    'proposta-comercial':['Monta propostas comerciais no padrão da Lube a partir do cliente, do mix e da tabela de preços.', ['modelo-proposta.md', 'referencias/tom-de-voz.md'], ['Tabela de preços', 'Política de descontos', 'HubSpot']],
    'analise-de-vendas':['Analisa vendas por vendedor, região e linha de produto usando o data warehouse.', ['referencias/indicadores.md'], ['data-warehouse', 'Metas Q3 2026', 'Supabase']],
    'relatorio-semanal':['Gera o relatório semanal da diretoria com números, riscos e decisões pendentes.', ['modelo-relatorio.md'], ['Revisão semanal', 'analise-de-vendas', 'Microsoft 365']],
    'registrar-conversa':['Transforma uma conversa com o Claude em nota no padrão do vault, com frontmatter, resumo e links.', ['modelo-conversa.md', 'referencias/frontmatter.md'], ['Obsidian', 'Registro de conversas do dia']],
    'precificacao':['Calcula preço de venda considerando custo, frete, impostos e margem-alvo por linha.', ['referencias/impostos.md', 'planilha-base.md'], ['Tabela de preços', 'Política de descontos', 'Giro de estoque']],
    'atendimento-cliente':['Responde dúvidas de clientes sobre pedidos, prazos e produtos com base no histórico.', ['referencias/perguntas-frequentes.md'], ['Prazo de entrega por região', 'Devolução de mercadoria', 'Slack']]
  };
  for (const [name, [desc, refs, links]] of Object.entries(skills)){
    add(`Skills/${name}/SKILL.md`, `${fmStr({ name, tipo:'skill', status:'ativo' })}# ${name}\n\n${desc}\n\n## Quando usar\n- Sempre que o pedido se encaixar na descrição acima\n- Quando alguém da equipe pedir esse tipo de entrega no Slack\n\n## Passos\n1. Ler o [[CLAUDE.md]] e as notas ligadas abaixo\n2. Confirmar os dados de entrada\n3. Produzir a entrega e registrar no vault\n\n## Ligações\n${links.map(l => `- [[${l}]]`).join('\n')}\n`, Math.floor(r() * 40));
    for (const ref of refs) add(`Skills/${name}/${ref}`, `# ${ref.split('/').pop().replace('.md', '')}\n\nMaterial de apoio da skill [[${name}]].\n`, Math.floor(r() * 60));
  }
  const routines = [['Brief da manhã', 'Dias úteis, 7h30', 'Resume agenda, pedidos atrasados e metas do dia.', ['Microsoft 365', 'Slack', 'Metas Q3 2026']], ['Fechamento diário de vendas', 'Dias úteis, 18h', 'Consolida vendas do dia no data warehouse e avisa no Slack.', ['data-warehouse', 'Slack', 'Pipeline de vendas']],
    ['Sync WinThor para Supabase', 'A cada 30 minutos', 'Copia pedidos, clientes e estoque do Oracle/WinThor para o Supabase.', ['data-warehouse', 'WinThor', 'Supabase']], ['Revisão semanal', 'Sexta, 16h', 'Revisa metas, riscos e decisões da semana.', ['relatorio-semanal', 'Metas Q3 2026']],
    ['Cobrança de títulos vencidos', 'Segunda e quinta, 9h', 'Lista títulos vencidos e prepara mensagens de cobrança.', ['Contas a receber', 'Inadimplência']], ['Registro de conversas do dia', 'Dias úteis, 19h', 'Salva as conversas importantes do dia em Conversas/.', ['registrar-conversa', 'Obsidian']],
    ['Backup do vault', 'Diário, 23h', 'Copia o vault para o OneDrive.', ['Microsoft 365', 'Obsidian']]];
  for (const [name, when, what, links] of routines) add(`Rotinas/${name}.md`, `${fmStr({ tipo:'rotina', frequencia:`"${when}"`, status:'ativo' })}# ${name}\n\n**Quando:** ${when}\n\n${what}\n\n## Depende de\n${links.map(l => `- [[${l}]]`).join('\n')}\n`, Math.floor(r() * 30));
  const apps = [['WinThor', 'ERP da operação: pedidos, faturamento, estoque e financeiro.'], ['Oracle', 'Banco de dados do WinThor. Acesso só leitura para o data warehouse.'], ['Supabase', 'Data warehouse da Lube e base dos painéis.'], ['Slack', 'Comunicação da equipe e alertas das rotinas.'], ['Microsoft 365', 'E-mail, agenda, Teams e OneDrive.'], ['ClickUp', 'Tarefas e projetos.'], ['Vercel', 'Hospedagem dos painéis e sistemas internos.'], ['Notion', 'Páginas públicas e propostas.'], ['HubSpot', 'CRM e funil comercial.'], ['Figma', 'Materiais de marketing e telas.'], ['Obsidian', 'Onde o cérebro vive.'], ['Claude', 'Lê e escreve no cérebro, executa as skills.']];
  for (const [name, what] of apps) add(`Aplicações/${name}.md`, `${fmStr({ tipo:'app', status:'conectado' })}# ${name}\n\n${what}\n\nVeja também [[CLAUDE.md]].\n`, Math.floor(r() * 90));

  const depts = {
    'Comercial':['Pipeline de vendas', 'Metas Q3 2026', 'Tabela de preços', 'Política de descontos', 'Roteiro de visita', 'Objeções frequentes', 'Mix de produtos por segmento', 'Campanha de óleo sintético', 'Carteira por vendedor', 'Comissões', 'Script de prospecção', 'Concorrentes da região', 'Metas Q2 2026 (arquivo)', 'Proposta padrão para frotas'],
    'Processos':['Fluxo de pedido WinThor', 'Onboarding de vendedor', 'Devolução de mercadoria', 'Checklist de fechamento do mês', 'Cadastro de cliente novo', 'Aprovação de crédito', 'Troca de produto em garantia', 'Padrão de nomes no vault', 'Como pedir ajuda ao Claude', 'Inventário trimestral', 'Emissão de nota de bonificação', 'Separação e conferência'],
    'Financeiro':['Fluxo de caixa', 'Contas a receber', 'Inadimplência', 'DRE mensal', 'Conciliação bancária', 'Limite de crédito por cliente', 'Custos fixos', 'Impostos sobre lubrificantes', 'Orçamento 2026', 'Prazo médio de recebimento', 'Contas a pagar', 'Indicadores financeiros'],
    'Logística':['Rotas de entrega', 'Frota própria', 'Estoque mínimo por filial', 'Prazo de entrega por região', 'Transportadoras parceiras', 'Custo de frete por km', 'Janela de recebimento dos clientes', 'Armazenagem de tambores', 'Ocorrências de entrega', 'Roteirização semanal', 'Manutenção dos caminhões'],
    'Compras':['Fornecedores', 'Pedido de compra padrão', 'Negociação com fabricante', 'Giro de estoque', 'Curva ABC de produtos', 'Calendário de reajustes', 'Produtos em ruptura', 'Lead time por fornecedor', 'Bonificações de fabricante'],
    'Marketing':['Calendário de conteúdo', 'Catálogo digital', 'Posts LinkedIn', 'Feira do setor 2026', 'Identidade visual', 'Campanha para oficinas', 'Materiais de ponto de venda', 'Depoimentos de clientes', 'Newsletter mensal', 'Site institucional', 'Fotos de produtos'],
    'Memória & Infra':['Schema do data warehouse', 'Conexão Oracle', 'Supabase — projetos', 'Glossário WinThor', 'Decisões de arquitetura', 'Painel de vendas', 'Usuários e acessos', 'Tabelas do WinThor mais usadas', 'Erros conhecidos do sync', 'Padrão de schemas por sistema', 'Custos de infraestrutura', 'Mapa de integrações']
  };
  const clients = []; const pre = ['Auto Center', 'Oficina', 'Transportadora', 'Frota', 'Posto', 'Agro', 'Mecânica', 'Locadora', 'Usina']; const suf = ['Norte', 'Sul', 'Leste', 'Central', 'Vale', 'Serra', 'Litoral', 'Planalto', 'Rio Claro', 'Boa Vista'];
  while (clients.length < 26){ const n = `${pick(pre)} ${pick(suf)} (exemplo)`; if (!clients.includes(n)) clients.push(n); }
  depts['Clientes'] = clients;
  const topics = ['proposta para frota de caminhões', 'erro no sync do WinThor', 'meta de vendas de setembro', 'novo painel de inadimplência', 'rota de entrega da região sul', 'reajuste do fabricante', 'estrutura do cérebro no Obsidian', 'skill de precificação', 'campanha para oficinas', 'relatório da diretoria', 'curva ABC de produtos', 'onboarding do vendedor novo', 'cobrança de títulos vencidos', 'schema do data warehouse', 'post sobre óleo sintético', 'análise de concorrentes', 'limite de crédito', 'devolução de mercadoria', 'automação do brief da manhã', 'indicadores financeiros'];
  const conv = []; for (let i = 0; i < 38; i++){ const d = new Date(now - (i * 2.3 + r()) * 864e5); conv.push(`${d.toISOString().slice(0, 10)} — ${pick(topics)}`); }
  depts['Conversas'] = [...new Set(conv)];
  for (const dp of ['Comercial', 'Financeiro', 'Logística', 'Compras', 'Marketing', 'Processos']){ for (let i = 0; i < 5 + Math.floor(r() * 5); i++){ const d = new Date(now - (i * 7 + r() * 3) * 864e5); depts[dp].push(`Reunião ${dp.toLowerCase()} ${d.toISOString().slice(0, 10)}`); } }
  depts['Diário'] = []; for (let i = 0; i < 30; i++){ const d = new Date(now - i * 864e5); if (d.getDay() % 6) depts['Diário'].push(d.toISOString().slice(0, 10)); }

  const allTitles = Object.values(depts).flat(); const skillNames = Object.keys(skills); const appNames = apps.map(a => a[0]); const routNames = routines.map(x => x[0]);
  const points = ['Revisar os números com o data warehouse antes de enviar', 'Responsável definido e prazo combinado', 'Registrar a decisão no vault', 'Conferir com o time comercial', 'Atualizar o painel de vendas', 'Pendência com o fornecedor', 'Cliente pediu retorno até sexta', 'Ajustar a tabela de preços', 'Criar tarefa no ClickUp', 'Avisar no canal do Slack'];
  const folderOf = { 'Memória & Infra':'Memória & Infra', 'Diário':'Diário' };
  for (const [dp, titles] of Object.entries(depts)){
    for (const t of titles){
      const links = new Set(); const nl = 1 + Math.floor(r() * 4);
      for (let j = 0; j < nl; j++){ const x = r(); links.add(x < .55 ? pick(titles) : x < .75 ? pick(allTitles) : x < .88 ? pick(skillNames) : x < .95 ? pick(appNames) : pick(routNames)); }
      links.delete(t);
      const tipo = dp === 'Conversas' ? 'conversa' : dp === 'Diário' ? 'diario' : dp === 'Clientes' ? 'cliente' : 'nota';
      const intro = dp === 'Conversas' ? `Resumo da conversa com o Claude sobre ${t.split(' — ')[1] || t}.` : dp === 'Clientes' ? `Ficha do cliente ${t}. Dados fictícios de exemplo.` : dp === 'Diário' ? `Anotações do dia.` : `Nota de ${dp.toLowerCase()} sobre ${t.toLowerCase()}.`;
      const body = `${fmStr({ tipo, departamento:`"${dp}"`, status:r() < .9 ? 'ativo' : 'arquivado', tags:[norm(dp).replace(/[^a-z]/g, ''), tipo] })}# ${t}\n\n${intro}\n\n## Pontos-chave\n- ${pick(points)}\n- ${pick(points)}\n${r() < .5 ? `- ${pick(points)}\n` : ''}\n## Relacionados\n${[...links].map(l => `- [[${l}]]`).join('\n')}\n`;
      const days = dp === 'Conversas' || dp === 'Diário' || /\d{4}-\d{2}-\d{2}/.test(t) ? Math.max(0, Math.round((now - new Date((t.match(/\d{4}-\d{2}-\d{2}/) || [new Date(now).toISOString().slice(0, 10)])[0]).getTime()) / 864e5)) : Math.floor(r() * 120);
      add(`${folderOf[dp] || dp}/${t.replace(/[\\/:]/g, '-')}.md`, body, days);
    }
  }
  return { vaultName:'Cérebro da Lube', files, exemplo:true };
}
