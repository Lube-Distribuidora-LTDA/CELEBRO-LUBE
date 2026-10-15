/* Cérebro da Lube — js/saude.js (Guardião: a saúde das rotinas e dos sistemas)
   Camada de dados do painel Saúde (GUARDIAO.md §6 e §7). Busca o saude.painel() do Guardião e avisa o app.
   - claude.ai (artifact): capability `mcp` → Supabase.execute_sql com UM SELECT fixo ("select saude.painel() as p").
     Nada mais é mandado para o banco daqui.
   - Arquivo baixado (file://) ou outro endereço: GET <guardião>/resumo com o cabeçalho x-chave-leitura. A chave é
     digitada no cartão "Chave de leitura do Guardião" e fica só nesta aba (sessionStorage). Só com "Lembrar neste
     computador" marcado ela vai para o localStorage: no file:// o Chrome e o Edge dividem o localStorage entre TODOS os
     arquivos abertos do disco, e qualquer outro .html baixado leria a chave.
   - localhost: se existir o arquivo de teste api/saude (não publicado), usa ele; senão, como o arquivo baixado.
   Atualiza a cada 60 s com a página visível e pausa com ela oculta. Sem DOM (só visibilidade e localStorage).
   A chave nunca vai para console, aviso ou URL: só para o cabeçalho da chamada ao Guardião. */

export const PROJETO = 'ivcnotrynogaljrvvyes';                      // Supabase DATA WAREHOUSE
export const GUARDIAO = `https://${PROJETO}.supabase.co/functions/v1/guardiao`;
export const SERVIDOR_MCP = 'Supabase';                              // nome do conector no claude.ai (o mesmo do manifesto)
const CONSULTA = 'select saude.painel() as p';
const CHAVE_LS = 'cerebro-robo:guardiao-chave';
const INTERVALO = 60000;
const PRAZO_MCP = 30000, PRAZO_HTTP = 15000;
const STATUS = new Set(['ok', 'atencao', 'falha', 'sem_dado', 'desligado']);

/* ---------- Mensagens (por código, nunca por texto de erro; GUARDIAO.md §7 e mcp.d.ts) ---------- */
const MSG = {
  'sem-mcp': 'O claude.ai não liberou os conectores nesta página. Abra o cérebro pelo claude.ai ou use o arquivo baixado.',
  needs_reauth: 'O conector do Supabase precisa ser reconectado: claude.ai › Configurações › Conectores.',
  server_not_connected: 'Falta o conector do Supabase: adicione em claude.ai › Configurações › Conectores.',
  selection_required: 'Há mais de um conector do Supabase: escolha qual usar quando o claude.ai perguntar.',
  server_not_found: 'O conector do Supabase não existe mais nesta conta. Adicione de novo em claude.ai › Conectores.',
  not_in_manifest: 'O acesso ao Supabase não foi liberado para esta página.',
  consent_required: 'O acesso ao Supabase não foi liberado para esta página. Toque em "Tentar de novo" para liberar.',
  blocked_by_policy: 'A política da conta bloqueia o Supabase nesta página.',
  approval_required: 'A política da conta pede aprovação a cada uso do Supabase, e a página ainda não consegue pedir.',
  not_granted: 'Esta página não tem acesso aos conectores aqui.',
  capability_disabled: 'Esta página não tem acesso aos conectores aqui.',
  capability_removed: 'Esta página não tem acesso aos conectores aqui.',
  server_unavailable: 'O Supabase não respondeu agora. Tento de novo no próximo minuto.',
  rate_limited: 'Muitas leituras em sequência. Tento de novo no próximo minuto.',
  upstream_error: 'O Supabase não respondeu agora. Tento de novo no próximo minuto.',
  bad_request: 'A leitura da saúde foi recusada pelo conector. Avise o TI.',
  transform_error: 'A leitura da saúde foi recusada pelo conector. Avise o TI.',
  'sem-guardiao': 'O Guardião ainda não foi instalado no banco (falta a função saude.painel).',
  tool_error: 'O banco recusou a leitura da saúde.',
  'formato': 'A resposta do Guardião veio num formato que o painel não conhece.',
  'sem-chave': 'Digite a chave de leitura do Guardião para ver a saúde aqui.',
  'sem-cadastro': 'O Júlio ainda não cadastrou a chave de leitura no Guardião.',
  'chave-errada': 'Chave errada. Confira e digite de novo.',
  'sem-funcao': 'A função guardiao ainda não foi publicada no Supabase.',
  'sem-rede': 'Sem conexão com o Guardião agora. Tento de novo no próximo minuto.',
  'http': 'O Guardião respondeu com erro. Tento de novo no próximo minuto.',
  'erro': 'Não consegui ler a saúde agora. Tento de novo no próximo minuto.',
};
// códigos que não se resolvem sozinhos: param a atualização automática até a pessoa agir (mcp.d.ts: nunca repetir
// needs_reauth / server_not_connected sem ação; recusa de consentimento só com novo gesto)
const TERMINAL = new Set(['sem-mcp', 'needs_reauth', 'server_not_connected', 'selection_required', 'server_not_found', 'not_in_manifest',
  'consent_required', 'blocked_by_policy', 'approval_required', 'not_granted', 'capability_disabled', 'capability_removed',
  'bad_request', 'transform_error', 'sem-guardiao', 'sem-chave', 'sem-cadastro', 'chave-errada', 'sem-funcao', 'user_changed']);
// negações de acesso: o dado que estava na tela sai (não fica mostrando o que a pessoa não pode mais ver)
const RETIRA = new Set(['needs_reauth', 'server_not_connected', 'blocked_by_policy', 'approval_required', 'not_in_manifest', 'consent_required', 'chave-errada', 'user_changed']);

/* ---------- Utilidades ---------- */
const agoraMs = () => Date.now();
function ehLocal() {
  try { return /^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/i.test(location.hostname); } catch (_) { return false; }
}
function detectarModo() {
  try { if (window.claude && typeof window.claude.use === 'function') return 'artifact'; } catch (_) { /* nada */ }
  return ehLocal() ? 'local' : 'arquivo';
}
function prazo(ms) {
  try { if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return { signal: AbortSignal.timeout(ms), fim() {} }; } catch (_) { /* cai no controlador */ }
  const c = typeof AbortController === 'function' ? new AbortController() : null;
  const t = c ? setTimeout(() => { try { c.abort(); } catch (_) { /* nada */ } }, ms) : 0;
  return { signal: c ? c.signal : undefined, fim() { clearTimeout(t); } };
}
const esperar = ms => new Promise(r => setTimeout(r, ms));
function lerChave() {
  try { const v = sessionStorage.getItem(CHAVE_LS); if (v) return v; } catch (_) { /* sem armazenamento da aba */ }
  try { return localStorage.getItem(CHAVE_LS) || ''; } catch (_) { return ''; }
}
const lembrada = () => { try { return !!localStorage.getItem(CHAVE_LS); } catch (_) { return false; } };
/* -> 'computador' (localStorage), 'aba' (sessionStorage) ou '' (não deu para guardar: vale até fechar a página) */
function gravarChave(v, lembrar = false) {
  let onde = '';
  try { if (v) { sessionStorage.setItem(CHAVE_LS, v); onde = 'aba'; } else sessionStorage.removeItem(CHAVE_LS); } catch (_) { /* nada */ }
  try {
    if (v && lembrar) { localStorage.setItem(CHAVE_LS, v); onde = 'computador'; } else localStorage.removeItem(CHAVE_LS);
  } catch (_) { /* nada */ }
  return onde;
}

/* ---------- Leitura do resultado do execute_sql ----------
   O conector devolve o texto da consulta com as linhas entre marcas <untrusted-data-…> … </untrusted-data-…>
   (às vezes dentro de {"result": "…"}). O conteúdo é dado, nunca instrução: aqui só se faz JSON.parse dele. */
const MARCA = /<untrusted-data-[\w-]+>([\s\S]*?)<\/untrusted-data-[\w-]+>/;
function jsonDe(s) {
  const t = String(s || '').trim();
  if (!t) return undefined;
  try { return JSON.parse(t); } catch (_) { /* tenta o trecho entre colchetes */ }
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { /* nada */ } }
  const c = t.indexOf('{'), d = t.lastIndexOf('}');
  if (c >= 0 && d > c) { try { return JSON.parse(t.slice(c, d + 1)); } catch (_) { /* nada */ } }
  return undefined;
}
function linhasDe(v, prof = 0) {
  if (v == null || prof > 5) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    // texto que já é JSON (ex.: {"result": "…<untrusted-data-…>…"}): abre primeiro, as marcas estão dentro dele
    const t = v.trim();
    if (/^[[{]/.test(t)) { try { return linhasDe(JSON.parse(t), prof + 1); } catch (_) { /* segue para as marcas */ } }
    const m = v.match(MARCA);
    return linhasDe(jsonDe(m ? m[1] : v), prof + 1);
  }
  if (typeof v === 'object') {
    if (painelValido(v)) return [{ p: v }];
    if ('p' in v) return [v];
    if (Array.isArray(v.rows)) return v.rows;
    for (const k of ['result', 'text', 'data', 'content', 'payload']) {
      if (k in v) { const r = linhasDe(v[k], prof + 1); if (r) return r; }
    }
  }
  return null;
}
function painelDeResultado(res) {
  const fontes = [res && res.payload, res && res.structuredContent];
  if (res && Array.isArray(res.content)) for (const b of res.content) if (b && b.type === 'text') fontes.push(b.text);
  for (const f of fontes) {
    const linhas = linhasDe(f);
    if (!linhas || !linhas.length) continue;
    const l = linhas[0] || {};
    let p = l.p !== undefined ? l.p : l.painel !== undefined ? l.painel : l.saude_painel !== undefined ? l.saude_painel : l;
    if (typeof p === 'string') p = jsonDe(p);
    if (painelValido(p)) return p;
  }
  return null;
}
/** Para teste: o painel tirado de um resultado do execute_sql (ou null). */
export function lerResultadoSql(res) { return normalizar(painelDeResultado(res)); }
function painelValido(p) { return !!p && typeof p === 'object' && !Array.isArray(p) && Array.isArray(p.itens); }

/* Normaliza o que o banco manda (§6): status em minúsculas e conhecidos, contagens completas, listas sempre listas. */
export function normalizar(p) {
  if (!painelValido(p)) return null;
  const st = s => { const v = String(s || '').toLowerCase().replace(/[^a-z_]/g, ''); return STATUS.has(v) ? v : 'sem_dado'; };
  const itens = p.itens.filter(i => i && typeof i === 'object' && i.id != null).map(i => ({ ...i, id: String(i.id), status: st(i.status), detalhe: i.detalhe && typeof i.detalhe === 'object' ? i.detalhe : {} }));
  const conta = { ok: 0, atencao: 0, falha: 0, sem_dado: 0, desligado: 0 };
  for (const i of itens) conta[i.status]++;
  const g = p.geral && typeof p.geral === 'object' ? p.geral : {};
  const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const geral = {
    ok: n(g.ok, conta.ok), atencao: n(g.atencao, conta.atencao), falha: n(g.falha, conta.falha), sem_dado: n(g.sem_dado, conta.sem_dado),
    total: n(g.total, itens.length),
  };
  geral.desligado = Math.max(0, geral.total - geral.ok - geral.atencao - geral.falha - geral.sem_dado);
  geral.status = geral.falha > 0 ? 'falha' : geral.atencao > 0 ? 'atencao' : geral.ok > 0 ? 'ok' : 'sem_dado';
  const inc = p.incidentes && typeof p.incidentes === 'object' ? p.incidentes : {};
  const lista = v => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object').map(x => ({ ...x, id: String(x.id ?? `${x.alvo_id}@${x.aberto_em}`), status: st(x.status) })) : []);
  return {
    ...p,
    verificado_em: p.verificado_em || null,
    geral,
    telegram: p.telegram && typeof p.telegram === 'object' ? p.telegram : { configurado: false, ultimo_aviso_em: null },
    vm: p.vm && typeof p.vm === 'object' ? p.vm : null,
    itens,
    incidentes: { abertos: lista(inc.abertos), recentes: lista(inc.recentes) },
  };
}

/* ================================================================================================ */
/* criarSaude({onDados, onEstado}) -> { atualizar(opc), parar(), modo, guardarChave(v), esquecerChave(), temChave(), ultimo() }
   onDados(dados|null, {modo, origem:'mcp'|'guardiao'|'teste', recebidoEm})
   onEstado(estado, {codigo, motivo, modo, terminal, retirar})   estado: carregando | ok | erro | indisponivel | sem-chave */
export function criarSaude({ onDados, onEstado } = {}) {
  const modo = detectarModo();
  let parado = false, timer = 0, ocupado = false, pendente = false, ultimoOk = 0, ultimaTentativa = 0, terminal = false;
  let dados = null, chaveMem = '', usarTeste = null, mcpP = null;

  const avisar = (estado, info = {}) => { try { onEstado?.(estado, { modo, ...info }); } catch (_) { /* o app segue */ } };
  const entregar = (d, origem) => { try { onDados?.(d, { modo, origem, recebidoEm: agoraMs() }); } catch (_) { /* o app segue */ } };
  function falhar(codigo, extra = {}) {
    const term = TERMINAL.has(codigo);
    terminal = term;
    if (RETIRA.has(codigo) && dados) { dados = null; entregar(null, extra.origem || ''); }
    const estado = codigo === 'sem-chave' ? 'sem-chave' : term ? 'indisponivel' : 'erro';
    avisar(estado, { codigo, motivo: extra.motivo || MSG[codigo] || MSG.erro, terminal: term, retirar: RETIRA.has(codigo), temDados: !!dados });
  }

  /* --- claude.ai: mcp → execute_sql (só o SELECT fixo) --- */
  function mcp() {
    if (!mcpP) mcpP = Promise.resolve().then(() => window.claude.use('mcp')).catch(() => null);
    return mcpP;
  }
  async function lerMcp() {
    const m = await mcp();
    if (!m || typeof m.callTool !== 'function') { falhar('sem-mcp'); return; }
    let tentou = false;
    for (;;) {
      const pz = prazo(PRAZO_MCP);
      try {
        const res = await m.callTool(SERVIDOR_MCP, 'execute_sql', { project_id: PROJETO, query: CONSULTA }, { cache: false, signal: pz.signal });
        pz.fim();
        const p = normalizar(painelDeResultado(res));
        if (!p) { falhar('formato'); return; }
        sucesso(p, 'mcp');
        return;
      } catch (e) {
        pz.fim();
        let codigo = e && typeof e.code === 'string' ? e.code : 'upstream_error';
        if (codigo === 'user_changed') { parar(); return; }
        if (codigo === 'cancelled') codigo = 'upstream_error';   // estourou o prazo desta leitura
        // a leitura é idempotente: um erro marcado retryable pode ser repetido UMA vez nesta rodada
        if (e && e.retryable === true && !tentou) {
          tentou = true;
          const ms = Math.min(60000, Number(e.retryAfterMs) > 0 ? Number(e.retryAfterMs) : 0) + 700 + Math.random() * 1300;
          await esperar(ms);
          if (parado) return;
          continue;
        }
        if (codigo === 'tool_error') {
          // tool_error: o banco respondeu e recusou. "Não instalado" (terminal) só com o erro exato: função saude.painel()
          // inexistente (42883) ou schema saude inexistente (3F000). Qualquer outro erro, mesmo citando a função (tempo
          // esgotado, "prepared statement … does not exist"), é passageiro e tenta de novo no minuto seguinte.
          const txt = String((e && e.message) || '');
          if (/function saude\.painel\(\) does not exist|schema "saude" does not exist/i.test(txt)) { falhar('sem-guardiao'); return; }
          falhar('tool_error', { motivo: `${MSG.tool_error}${txt ? ` (${txt.replace(/\s+/g, ' ').slice(0, 140)})` : ''}` });
          return;
        }
        falhar(MSG[codigo] ? codigo : 'upstream_error');
        return;
      }
    }
  }

  /* --- arquivo baixado / outro endereço: GET <guardião>/resumo com a chave --- */
  async function lerGuardiao() {
    const chave = chaveMem || lerChave();
    if (!chave) { falhar('sem-chave'); return; }
    const pz = prazo(PRAZO_HTTP);
    let r;
    try {
      r = await fetch(`${GUARDIAO}/resumo`, { method: 'GET', headers: { 'x-chave-leitura': chave }, cache: 'no-store', credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer', signal: pz.signal });
    } catch (_) { pz.fim(); falhar('sem-rede'); return; }
    pz.fim();
    if (r.status === 503) { falhar('sem-cadastro'); return; }
    if (r.status === 401 || r.status === 403) { falhar('chave-errada'); return; }
    if (r.status === 404) { falhar('sem-funcao'); return; }
    if (!r.ok) { falhar('http', { motivo: `${MSG.http} (código ${r.status})` }); return; }
    let j = null;
    try { j = await r.json(); } catch (_) { j = null; }
    const p = normalizar(j && j.p ? j.p : j);
    if (!p) { falhar('formato'); return; }
    sucesso(p, 'guardiao');
  }

  /* --- localhost: arquivo de teste api/saude (não é publicado) --- */
  async function lerTeste() {
    const pz = prazo(4000);
    try {
      const r = await fetch('api/saude', { cache: 'no-store', signal: pz.signal });
      pz.fim();
      if (!r.ok) return false;
      const p = normalizar(await r.json());
      if (!p) return false;
      usarTeste = true;   // antes do sucesso: o painel já mostra o selo "Teste local" na primeira leitura
      sucesso(p, 'teste');
      return true;
    } catch (_) { pz.fim(); return false; }
  }

  function sucesso(p, origem) {
    dados = p;
    terminal = false;
    ultimoOk = agoraMs();
    entregar(p, origem);
    avisar('ok', { origem });
  }

  /* --- app do computador (servidor/ com a meta cerebro-token): api/saude é o próprio app, não um arquivo de teste.
     Erro dele (banco fora, leitura lenta) não vira "arquivo baixado pedindo chave": tenta de novo no minuto seguinte.
     Só o 503 "sem-banco" (o ENV deste computador não tem o banco) segue para o Guardião, com a chave. --- */
  async function lerApp() {
    const pz = prazo(20000);   // o servidor espera até 15 s pela conexão do banco
    let r;
    try { r = await fetch('api/saude', { cache: 'no-store', signal: pz.signal }); }
    catch (_) { pz.fim(); falhar('erro', { motivo: 'O app do cérebro não respondeu à leitura da saúde. Tento de novo no próximo minuto.' }); return; }
    pz.fim();
    let j = null;
    try { j = await r.json(); } catch (_) { j = null; }
    if (r.status === 503 && j && j.erro === 'sem-banco') { usarTeste = false; await lerGuardiao(); return; }
    if (!r.ok) {
      const m = j && typeof j.mensagem === 'string' ? j.mensagem.replace(/\.?$/, '.') : `Não consegui ler a saúde agora (código ${r.status}).`;
      usarTeste = true;
      falhar('erro', { motivo: `${m} Tento de novo no próximo minuto.` });
      return;
    }
    const p = normalizar(j);
    if (!p) { falhar('formato'); return; }
    usarTeste = true;
    sucesso(p, 'teste');
  }
  const appLocal = () => { try { return !!document.querySelector('meta[name="cerebro-token"]'); } catch (_) { return false; } };

  async function rodada() {
    if (modo === 'artifact') { await lerMcp(); return; }
    if (modo === 'local' && appLocal() && usarTeste !== false) { await lerApp(); return; }
    if (modo === 'local' && usarTeste !== false) {
      const ok = await lerTeste();
      if (ok) { usarTeste = true; return; }
      if (usarTeste === null) usarTeste = false;   // não há arquivo de teste: segue como o arquivo baixado
      else { falhar('erro'); return; }             // o arquivo de teste existia e sumiu ou quebrou
    }
    await lerGuardiao();
  }

  async function atualizar(opc = {}) {
    if (parado) return;
    if (ocupado) { pendente = true; return; }
    if (opc.manual) terminal = false;
    ocupado = true;
    // "carregando" só na primeira leitura e quando a pessoa pede (senão o chip piscaria a cada minuto sem dado)
    if (!dados && (!ultimaTentativa || opc.manual)) avisar('carregando', {});
    ultimaTentativa = agoraMs();
    try { await rodada(); } catch (_) { falhar('erro'); }
    finally {
      ocupado = false;
      if (pendente) { pendente = false; setTimeout(() => atualizar(), 0); }
      else agendar();
    }
  }
  function agendar(ms = INTERVALO) {
    clearTimeout(timer); timer = 0;
    if (parado || terminal || document.hidden) return;
    timer = setTimeout(() => { timer = 0; atualizar(); }, ms);
  }
  function aoVisibilidade() {
    if (parado) return;
    if (document.hidden) { clearTimeout(timer); timer = 0; return; }
    if (terminal) return;
    const falta = INTERVALO - (agoraMs() - ultimaTentativa);
    if (falta <= 1000) atualizar(); else agendar(falta);
  }
  document.addEventListener('visibilitychange', aoVisibilidade);

  function parar() {
    parado = true;
    clearTimeout(timer); timer = 0;
    document.removeEventListener('visibilitychange', aoVisibilidade);
  }
  /* Chave de leitura (arquivo baixado): fica nesta aba; com lembrar = true, também neste computador (localStorage).
     -> {ok, onde: 'computador' | 'aba' | ''} ('' = sem armazenamento: vale até fechar a página) */
  function guardarChave(v, opc = {}) {
    const k = String(v || '').trim();
    if (!k) return { ok: false, onde: '' };
    chaveMem = k;
    const onde = gravarChave(k, opc.lembrar === true);
    terminal = false;
    atualizar({ manual: true });
    return { ok: true, onde, guardada: !!onde };
  }
  function esquecerChave() {
    chaveMem = '';
    gravarChave('');
    dados = null;
    entregar(null, 'guardiao');
    clearTimeout(timer); timer = 0;
    falhar('sem-chave');
  }

  setTimeout(() => atualizar(), 0);
  return {
    atualizar, parar, guardarChave, esquecerChave,
    temChave: () => !!(chaveMem || lerChave()),
    chaveLembrada: () => lembrada(),
    ultimo: () => dados,
    ultimoOk: () => ultimoOk,
    get modo() { return modo === 'local' && usarTeste ? 'teste' : modo; },
    get usaChave() { return modo === 'arquivo' || (modo === 'local' && usarTeste === false); },
  };
}
