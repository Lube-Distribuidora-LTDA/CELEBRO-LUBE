/* Cérebro da Lube — servidor/ouvido.js: o ouvido do Jarvis, um Chrome escondido que reconhece a fala NO COMPUTADOR.
   Por quê: o reconhecimento do Edge 155 devolve texto vazio desde 18/10; o Chrome 155 com processLocally reconhece pt-BR
   sem internet. Decisão do Júlio (2026-10-19): "Edge fala, Chrome ouve". Especificação: docs/OUVIDO-E-ROSTO.md §3.
   - O Node abre o Chrome em --headless=new e fala com ele por PIPE (--remote-debugging-pipe: o Node escreve no fd 3 e lê
     no fd 4; cada mensagem é um JSON terminado em \0). Nunca porta de depuração: qualquer programa da máquina mandaria
     no Chrome.
   - O Chrome carrega web/ouvido.html servido pelo app. A página abre o microfone (com cancelamento de eco), entrega a
     trilha ao SpeechRecognition (processLocally) e manda parciais, finais, nível e estado pelo binding cerebroOuvido;
     aqui os eventos vão para o SSE da aba dona (/api/ouvido/eventos).
   - O pacote de voz (pt-BR + en-US juntos, ~296 MB, uma vez só) só baixa por pedido explícito: POST /api/ouvido/instalar,
     ou {instalar: true} no preparar ou no ligar. Sem o pacote, o ligar responde 409 sem-pacote.
   - O Chrome sai junto com o servidor: no exit do Node, taskkill /T /F na árvore; se o Node morre à força, o pipe fecha e
     o Chrome sai sozinho em ~0,3 s (medido). Sem uso por ociosoMs, fecha (libera ~250 MB).
   - O perfil do Chrome fica em %LOCALAPPDATA%\CerebroLube\ouvido-chrome (fora do repositório e do OneDrive).
   - Nunca loga texto falado: o log só leva estado e código de erro. */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile, execFileSync } from 'node:child_process';

const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
export const PERFIL_PADRAO = path.join(LOCAL, 'CerebroLube', 'ouvido-chrome');
// en-US é obrigatório: só com o pt-BR toda sessão termina em "aborted" ("Unable to find SODA files on the device", §1.2)
export const IDIOMAS_PADRAO = Object.freeze(['pt-BR', 'en-US']);
// frases de reforço do reconhecedor (uma volta do teste trouxe "charves" no lugar de "Jarvis")
export const FRASES_PADRAO = Object.freeze([
  ['Jarvis', 3], ['Lube', 2], ['WinThor', 2], ['Supabase', 2], ['Vercel', 2], ['Sentinela', 2], ['Guardião', 2], ['cpd', 2],
]);

/* Textos para a tela (frases curtas; docs/OUVIDO-E-ROSTO.md §9; sem-microfone, em-uso e audio-capture iguais aos do
   ERRO_MIC do jarvis.js). */
export const TEXTOS = Object.freeze({
  'sem-chrome': 'Não achei o Google Chrome neste computador. Ele é o ouvido do Jarvis: instale o Chrome e abra de novo. Enquanto isso, digite.',
  'sem-pacote': 'Falta baixar o pacote de voz em português, só desta vez (cerca de 300 MB). Peça para baixar e eu ligo o ouvido.',
  instalando: 'Baixando o pacote de voz em português, só desta vez (cerca de 300 MB)…',
  'pacote-falhou': 'Não consegui baixar o pacote de voz. Confira a internet e tente de novo. Enquanto isso, digite.',
  negado: 'O Windows bloqueou o microfone para o Chrome. Abra Configurações › Privacidade › Microfone e permita os aplicativos da área de trabalho.',
  'sem-microfone': 'Não encontrei nenhum microfone. Conecte um e tente de novo; enquanto isso, digite.',
  'em-uso': 'O microfone está sendo usado por outro programa (Teams, Zoom…). Feche e tente de novo.',
  'audio-capture': 'O microfone não respondeu. Confira se ele está conectado.',
  caiu: 'O ouvido do Jarvis parou. Feche e abra o Jarvis de novo.',
  trava: 'O Jarvis está travado. Faça o reconhecimento do rosto.',
  prazo: 'O ouvido do Jarvis demorou demais para responder. Tente de novo.',
  cancelado: 'O microfone foi pausado antes de ligar.',
  desligado: 'O ouvido do Jarvis está desligado. Abra o Jarvis de novo.',
  pagina: 'O ouvido do Jarvis não abriu. Feche e abra o Jarvis de novo.',
  perfil: 'Não consegui criar a pasta do ouvido em %LOCALAPPDATA%\\CerebroLube.',
  'sem-suporte': 'Este Chrome não reconhece voz no computador. Atualize o Google Chrome.',
  aba: 'Falta a identificação da aba (aba).',
  idioma: 'O ouvido não conhece esse idioma.',
  teste: 'O modo de teste do ouvido está desligado.',
  erro: 'O ouvido do Jarvis falhou. Tente de novo ou digite.',
});

/** Erro com código e status HTTP para a rota; a mensagem vai para a tela; o detalhe (técnico) só para o log. */
export class ErroOuvido extends Error {
  constructor(codigo = 'erro', status = 500, mensagem, detalhe) {
    super(mensagem || TEXTOS[codigo] || TEXTOS.erro);
    this.name = 'ErroOuvido'; this.codigo = codigo; this.status = status;
    if (detalhe) this.detalhe = String(detalhe).slice(0, 200);
  }
}

const FLAGS = [
  '--headless=new', '--remote-debugging-pipe',
  '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions', '--disable-default-apps',
  '--disable-background-networking', '--autoplay-policy=no-user-gesture-required',
  // nunca --use-fake-ui-for-media-stream: liberaria o microfone para qualquer origem. A permissão vem do
  // Browser.grantPermissions, só para a nossa.
];
const SEG = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin',
};
const ORDEM_PACOTE = { unavailable: 0, downloadable: 1, downloading: 2, available: 3 };
const CODIGOS_PAGINA = new Set(['negado', 'sem-microfone', 'em-uso', 'pacote-falhou', 'sem-suporte', 'audio-capture', 'arquivo', 'teste', 'cancelado', 'erro']);
const TIPOS_PAGINA = new Set(['nivel', 'resultado', 'estado', 'fala', 'erro']);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const existe = (f) => { try { return fs.statSync(f).isFile(); } catch (_) { return false; } };
const codigoDe = (e) => (e && (e.codigo || e.code || e.name)) || 'erro';
export const abaValida = (a) => typeof a === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(a);

/* ---------- programas do Windows (caminho completo: nada de PATH) ---------- */
const SISTEMA = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
const REG = path.join(SISTEMA, 'System32', 'reg.exe');
const TASKKILL = path.join(SISTEMA, 'System32', 'taskkill.exe');
const POWERSHELL = path.join(SISTEMA, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

/* ---------- achar o Chrome ---------- */
let chromeAchado = null;
function lerRegistro(chave) {
  try {
    const out = execFileSync(REG, ['query', chave, '/ve'], { windowsHide: true, timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }).toString('latin1');
    const m = out.match(/REG_(EXPAND_)?SZ[ \t]+([^\r\n]+)/);   // o rótulo é "(Padrão)" ou "(Default)": não importa
    if (!m) return null;
    let v = m[2].trim().replace(/^"(.*)"$/, '$1');
    if (m[1]) v = v.replace(/%([^%]+)%/g, (x, n) => process.env[n] ?? x);
    return v;
  } catch (_) { return null; }
}
/** O chrome.exe deste computador: App Paths (HKLM, HKCU) e as pastas de instalação. null = não tem. Guarda o achado. */
export function acharChrome({ forcar = false } = {}) {
  if (!forcar && chromeAchado && existe(chromeAchado)) return chromeAchado;
  chromeAchado = null;
  if (process.platform !== 'win32') return null;
  const fontes = [
    () => lerRegistro('HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe'),
    () => lerRegistro('HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe'),
    () => process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    () => process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    () => process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  for (const f of fontes) {
    const c = f();
    if (c && /chrome\.exe$/i.test(c) && existe(c)) { chromeAchado = c; return c; }
  }
  return null;
}

/* ---------- processos do Chrome com o NOSSO perfil ----------
   Só chrome.exe e só com --user-data-dir igual ao perfil (com ou sem aspas, seguido de espaço ou fim): o Chrome do Júlio
   nunca é tocado, e o perfil de teste "ouvido-chrome-teste" não casa com "ouvido-chrome". O caminho vai pelo ambiente e o
   script codificado (-EncodedCommand): nada de aspas montadas à mão. */
const PS_FILTRO = String.raw`$p = [regex]::Escape($env:CEREBRO_OUVIDO_PERFIL); $rx = '--user-data-dir="?' + $p + '\\?"?(\s|$)'; $l = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -match $rx })`;
function powershell(script, env, prazo = 20000) {
  return new Promise((res) => {
    if (process.platform !== 'win32') { res(''); return; }
    execFile(POWERSHELL, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, timeout: prazo, env: { ...process.env, ...env } },
      (err, out) => res(err ? '' : String(out || '')));
  });
}
/** Quantos chrome.exe estão rodando com este perfil. */
export async function contarProcessos(perfil) {
  const n = Number((await powershell(`${PS_FILTRO}; $l.Count`, { CEREBRO_OUVIDO_PERFIL: path.resolve(perfil) })).trim());
  return Number.isFinite(n) ? n : 0;
}
/** Mata os chrome.exe deste perfil (sobra de uma partida velha). Devolve quantos achou. */
export async function matarPerfil(perfil) {
  const out = await powershell(`${PS_FILTRO}; foreach ($x in $l) { Stop-Process -Id $x.ProcessId -Force -ErrorAction SilentlyContinue }; $l.Count`,
    { CEREBRO_OUVIDO_PERFIL: path.resolve(perfil) });
  const n = Number(out.trim());
  return Number.isFinite(n) ? n : 0;
}
// taskkill /T /F mata a árvore inteira; o código de saída pode vir ≠ 0 quando um filho já tinha saído (medido): ignorar
function matarArvore(pid) {
  return new Promise((res) => {
    if (!pid) { res(); return; }
    if (process.platform !== 'win32') { try { process.kill(pid, 'SIGKILL'); } catch (_) { /* já saiu */ } res(); return; }
    execFile(TASKKILL, ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 8000 }, () => res());
  });
}
function matarArvoreSync(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync(TASKKILL, ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 5000, stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
  } catch (_) { /* já saiu */ }
}
// o servidor saiu (Ctrl+C, process.exit, erro): mata a árvore do Chrome na hora (no 'exit' só dá para fazer síncrono).
// Se o Node morrer à força, o pipe fecha e o Chrome sai sozinho (medido: 0,33 s).
const VIVOS = new Set();
let ganchoSaida = false;
function guardarVivo(filho) {
  VIVOS.add(filho);
  filho.once('exit', () => VIVOS.delete(filho));
  if (ganchoSaida) return;
  ganchoSaida = true;
  process.on('exit', () => { for (const f of VIVOS) matarArvoreSync(f.pid); });
}

/* ---------- transporte CDP pelo pipe ---------- */
function criarTransporte(filho) {
  const escrever = filho.stdio[3], ler = filho.stdio[4];
  let buf = '', seq = 0, fechado = false;
  const pendentes = new Map(), ouvintes = new Set(), aoFechar = new Set();
  ler.setEncoding('utf8');   // para não partir um caractere ao meio
  ler.on('data', (d) => {
    buf += d;
    let k;
    while ((k = buf.indexOf('\0')) >= 0) {
      const msg = buf.slice(0, k); buf = buf.slice(k + 1);
      let o;
      try { o = JSON.parse(msg); } catch (_) { continue; }
      if (o.id != null && pendentes.has(o.id)) {
        const p = pendentes.get(o.id); pendentes.delete(o.id); clearTimeout(p.t);
        if (o.error) p.rej(new ErroOuvido(p.codigoErro, 503, undefined, `${p.method}: ${o.error.message || ''}`));
        else p.res(o.result || {});
      } else if (o.method) for (const f of ouvintes) { try { f(o); } catch (_) { /* nada */ } }
    }
    if (buf.length > 16 * 1024 * 1024) buf = '';   // proteção: mensagem sem fim
  });
  const fechar = (motivo) => {
    if (fechado) return;
    fechado = true;
    for (const p of pendentes.values()) { clearTimeout(p.t); p.rej(motivo || new ErroOuvido('caiu', 503)); }
    pendentes.clear();
    for (const f of aoFechar) { try { f(); } catch (_) { /* nada */ } }
    try { escrever.end(); } catch (_) { /* nada */ }
  };
  ler.on('error', () => {}); escrever.on('error', () => {});
  ler.on('close', () => fechar(new ErroOuvido('caiu', 503, undefined, 'pipe fechou')));
  return {
    enviar(method, params = {}, { sessao, prazo = 10000, codigoErro = 'pagina' } = {}) {
      return new Promise((res, rej) => {
        if (fechado) { rej(new ErroOuvido('caiu', 503)); return; }
        const id = ++seq;
        const t = setTimeout(() => { pendentes.delete(id); rej(new ErroOuvido('prazo', 504, undefined, method)); }, prazo);
        pendentes.set(id, { res, rej, t, method, codigoErro });
        try { escrever.write(JSON.stringify({ id, method, params, ...(sessao ? { sessionId: sessao } : {}) }) + '\0'); }
        catch (_) { clearTimeout(t); pendentes.delete(id); rej(new ErroOuvido('caiu', 503)); }
      });
    },
    ouvir(f) { ouvintes.add(f); return () => ouvintes.delete(f); },
    aoFechar(f) { aoFechar.add(f); return () => aoFechar.delete(f); },
    get fechado() { return fechado; },
    fechar,
  };
}

function piorPacote(disp, idiomas) {
  if (!disp || typeof disp !== 'object') return null;
  let p = null;
  for (const l of idiomas) {
    const v = disp[l];
    if (!(v in ORDEM_PACOTE)) return 'unavailable';
    if (p == null || ORDEM_PACOTE[v] < ORDEM_PACOTE[p]) p = v;
  }
  return p;
}
function limparFrases(frases) {
  if (!Array.isArray(frases)) return [];
  return frases.filter((f) => Array.isArray(f) && typeof f[0] === 'string' && f[0].trim() && f[0].length <= 40 && Number.isFinite(f[1]) && f[1] >= 0 && f[1] <= 10)
    .slice(0, 50).map(([t, b]) => [t.trim(), b]);
}
// {teste: {arquivo: '/fala-pt.wav', repetir?, atrasoMs?}}: só um .wav da mesma origem
function limparTeste(t) {
  if (!t || typeof t !== 'object' || typeof t.arquivo !== 'string' || !/^\/[A-Za-z0-9._-]{1,80}\.wav$/.test(t.arquivo)) return null;
  const atraso = Number(t.atrasoMs);
  return { arquivo: t.arquivo, repetir: t.repetir === true, ...(Number.isFinite(atraso) ? { atrasoMs: Math.max(0, Math.min(5000, atraso)) } : {}) };
}

/* =============================================================================
   criarOuvidoChrome
   ============================================================================= */
export function criarOuvidoChrome({
  urlPagina = 'http://localhost:8790/ouvido.html',
  origem = 'http://localhost:8790',            // para o Browser.grantPermissions (o microfone só para esta origem)
  perfil = PERFIL_PADRAO,
  chrome = acharChrome(),
  podeLigar = () => true,                      // a integração passa () => rosto.liberado()
  idiomas = IDIOMAS_PADRAO,
  frases = FRASES_PADRAO,
  ociosoMs = 10 * 60_000,                      // fecha o Chrome depois de 10 min sem dono e sem SSE
  permitirTeste = false,                       // só o testar-ouvido.js liga: aceita {teste: {arquivo}} no ligar
  instalarSemPedir = false,                    // true = baixa o pacote sozinho no preparar/ligar (sem pedido explícito)
  log = () => {},
  _semPreTrava = false,                        // só o teste: pula a conferência do lockfile (para provocar o código 21)
} = {}) {
  perfil = path.resolve(perfil);
  idiomas = Array.isArray(idiomas) && idiomas.length ? [...idiomas] : [...IDIOMAS_PADRAO];
  const frasesOk = limparFrases(frases);
  let exe = chrome || null;

  let filho = null, cdp = null, sessao = null, pagina = false;
  let estadoAtual = exe ? 'desligado' : 'sem-chrome', pacote = null, ger = 0, gerAtivo = null, dono = null, ultimoErro = null;
  let pedido = null;                     // {lang, teste} do ligar em curso (para religar depois de uma queda)
  let fechando = false, encerrado = false;
  let quedas = [], tVolta = 0;
  let ultimoUso = Date.now();
  let stderrFim = [];
  const sses = new Map();                // aba → Set<res>
  const tSemSse = new Map();             // aba → timer (a dona sem SSE: pausa em 2 s)
  const pendentes = new Set();           // ligar na fila: {aba, cancelado}
  let fila = Promise.resolve();
  const emSerie = (fn) => { const p = fila.then(fn, fn); fila = p.catch(() => {}); return p; };
  const pode = () => { try { return !!podeLigar(); } catch (_) { return false; } };

  const estadoPublico = () => ({ ok: true, estado: estadoAtual, pacote, ger, dono, ...(ultimoErro ? { erro: ultimoErro } : {}) });

  /* ---------- SSE ---------- */
  function escreverSse(res, ev, dados, descartavel = false) {
    if (res.writableEnded || res.destroyed) return;
    if (descartavel && res.writableNeedDrain) return;   // cliente lento: o nível pode cair, o resto não
    try { res.write(`event: ${ev}\ndata: ${JSON.stringify(dados ?? {})}\n\n`); } catch (_) { /* caiu */ }
  }
  function enviarSse(aba, ev, dados, descartavel) {
    const set = aba && sses.get(aba);
    if (set) for (const res of set) escreverSse(res, ev, dados, descartavel);
  }
  function enviarTodos(ev, dados) { for (const set of sses.values()) for (const res of set) escreverSse(res, ev, dados); }
  const temSse = (aba) => !!(aba && sses.get(aba) && sses.get(aba).size);
  const totalSse = () => { let n = 0; for (const s of sses.values()) n += s.size; return n; };

  // a aba dona sem SSE (fechada, F5, Edge travado): pausa depois de 2 s se ela não voltar — o microfone fecha quando a
  // página some
  function vigiarDono(prazoMs = 2000) {
    const aba = dono;
    if (!aba || temSse(aba) || tSemSse.has(aba)) return;
    const t = setTimeout(() => {
      tSemSse.delete(aba);
      if (dono === aba && !temSse(aba)) {
        log('ouvido: a aba dona sumiu; microfone fechado');
        emSerie(() => pausarInterno({ aba, motivo: 'sem-aba' })).catch(() => {});
      }
    }, prazoMs);
    tSemSse.set(aba, t);
  }

  /* ---------- Chrome ---------- */
  function guardarStderr(d) {
    for (const l of String(d).split(/\r?\n/)) if (l.trim()) stderrFim.push(l.slice(0, 200));
    if (stderrFim.length > 20) stderrFim = stderrFim.slice(-20);
  }
  async function abrirFilho() {
    let f;
    try { f = spawn(exe, [...FLAGS, `--user-data-dir=${perfil}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], windowsHide: true }); }
    catch (e) { return { erro: codigoDe(e) }; }
    if (!f.stdio || !f.stdio[2] || !f.stdio[3] || !f.stdio[4]) { matarArvore(f.pid); return { erro: 'pipe' }; }
    const saida = new Promise((r) => f.once('exit', (c) => r({ saiu: c ?? -1 })));
    const falhou = new Promise((r) => f.once('error', (e) => r({ erro: codigoDe(e) })));
    f.stdio[2].setEncoding('utf8');
    f.stdio[2].on('data', guardarStderr);
    f.stdio[2].on('error', () => {});
    const t = criarTransporte(f);
    const versao = t.enviar('Browser.getVersion', {}, { prazo: 10000 }).then(() => ({ ok: true }), () => ({ semResposta: true }));
    let r = await Promise.race([versao, saida, falhou]);
    if (r.semResposta) r = await Promise.race([saida, falhou, esperar(2000).then(() => ({ semResposta: true }))]);
    if (r.ok) return { ok: true, f, t };
    t.fechar();
    if (r.semResposta) { await matarArvore(f.pid); }
    return r;
  }
  async function partir() {
    if (!exe || !existe(exe)) exe = acharChrome({ forcar: true });
    if (!exe) { estadoAtual = 'sem-chrome'; throw new ErroOuvido('sem-chrome', 503); }
    estadoAtual = 'abrindo';
    enviarTodos('estado', { estado: 'abrindo', ger });
    try { await fsp.mkdir(perfil, { recursive: true }); }
    catch (e) { estadoAtual = 'desligado'; throw new ErroOuvido('perfil', 503, undefined, codigoDe(e)); }
    if (!_semPreTrava && existe(path.join(perfil, 'lockfile'))) {
      // um Chrome velho com o nosso perfil (o Node anterior morreu e ele ficou): fecha antes
      const n = await matarPerfil(perfil);
      if (n) log(`ouvido: fechei ${n} processo(s) do Chrome velho do ouvido`);
      await esperar(1000);
    }
    let r;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      r = await abrirFilho();
      if (r.ok) break;
      if (r.saiu === 21 && tentativa === 1) {
        // código 21: o perfil já tem dono (outra partida viva) — fecha o velho e tenta uma vez mais
        log('ouvido: o perfil do ouvido já estava em uso (código 21); fechando o Chrome velho e tentando de novo');
        await matarPerfil(perfil); await esperar(1000);
        continue;
      }
      break;
    }
    if (!r.ok) {
      estadoAtual = 'caiu';
      log(`ouvido: o Chrome não abriu (${r.saiu != null ? `código ${r.saiu}` : r.erro || 'sem resposta no pipe'})`);
      throw new ErroOuvido(r.erro === 'ENOENT' ? 'sem-chrome' : 'caiu', 503);
    }
    filho = r.f; cdp = r.t; pagina = false; sessao = null;
    guardarVivo(filho);
    const este = filho;
    filho.on('exit', (c) => aoSairFilho(este, c));
    cdp.ouvir(aoCdp);
    try {
      if (encerrado) throw new ErroOuvido('desligado', 503);
      await cdp.enviar('Browser.grantPermissions', { origin, permissions: ['audioCapture'] });   // a cada partida: não fica gravada
      await carregarPagina();
    } catch (e) {
      // não abriu direito: fecha sem contar como queda (senão a volta automática entraria em laço)
      fechando = true;
      try { await fecharChrome(); } finally { fechando = false; }
      estadoAtual = 'caiu';
      const x = e instanceof ErroOuvido ? e : new ErroOuvido('pagina', 503, undefined, codigoDe(e));
      log(`ouvido: a página do ouvido não carregou (${x.codigo}${x.detalhe ? `: ${x.detalhe}` : ''})`);
      throw x;
    }
    log('ouvido: Chrome escondido aberto');
  }
  function esperarEvento(nome, s, prazo) {
    return new Promise((res, rej) => {
      const t = cdp;
      if (!t || t.fechado) { rej(new ErroOuvido('caiu', 503)); return; }
      let tirar = () => {}, tirarFim = () => {};
      const tm = setTimeout(() => { tirar(); tirarFim(); rej(new ErroOuvido('prazo', 504, undefined, nome)); }, prazo);
      tirar = t.ouvir((o) => { if (o.method === nome && (!s || o.sessionId === s)) { clearTimeout(tm); tirar(); tirarFim(); res(o.params || {}); } });
      tirarFim = t.aoFechar(() => { clearTimeout(tm); tirar(); rej(new ErroOuvido('caiu', 503)); });
    });
  }
  async function carregarPagina() {
    pagina = false; sessao = null;
    const { targetInfos = [] } = await cdp.enviar('Target.getTargets');
    const alvo = targetInfos.find((x) => x.type === 'page');
    const targetId = alvo ? alvo.targetId : (await cdp.enviar('Target.createTarget', { url: 'about:blank' })).targetId;
    const { sessionId } = await cdp.enviar('Target.attachToTarget', { targetId, flatten: true });
    sessao = sessionId;
    await cdp.enviar('Page.enable', {}, { sessao });
    await cdp.enviar('Runtime.enable', {}, { sessao });
    try { await cdp.enviar('Inspector.enable', {}, { sessao }); } catch (_) { /* só para o aviso de página caída */ }
    await cdp.enviar('Runtime.addBinding', { name: 'cerebroOuvido' }, { sessao });   // antes do navigate: vale na página nova
    const carregou = esperarEvento('Page.loadEventFired', sessao, 10000);
    carregou.catch(() => {});
    const nav = await cdp.enviar('Page.navigate', { url: urlPagina }, { sessao });
    if (nav && nav.errorText) throw new ErroOuvido('pagina', 503, undefined, nav.errorText);
    await carregou;
    const tem = await avaliar('typeof window.ouvido === "object" && typeof window.cerebroOuvido === "function"');
    if (tem !== true) throw new ErroOuvido('pagina', 503, undefined, 'a página não tem window.ouvido');
    pagina = true;
  }
  async function avaliar(expr, { gesto = false, prazo = 10000 } = {}) {
    if (!cdp || !sessao) throw new ErroOuvido('caiu', 503);
    const r = await cdp.enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: gesto }, { sessao, prazo });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new ErroOuvido('pagina', 503, undefined, (d.exception && d.exception.description) || d.text || 'exceção');
    }
    return r.result ? r.result.value : undefined;
  }
  async function fecharChrome() {
    const f = filho, t = cdp;
    if (!f) return;
    const saiu = new Promise((r) => { if (f.exitCode !== null || f.signalCode) r(); else f.once('exit', () => r()); });
    if (t && !t.fechado) t.enviar('Browser.close', {}, { prazo: 3000 }).catch(() => {});
    const fechou = await Promise.race([saiu.then(() => true), esperar(3000).then(() => false)]);
    if (!fechou) { await matarArvore(f.pid); await Promise.race([saiu, esperar(2000)]); }
    // o lockfile some quando a árvore inteira sai; se ficar, sobrou algum filho do nosso perfil
    const trava = path.join(perfil, 'lockfile');
    for (let i = 0; i < 10 && existe(trava); i++) await esperar(150);
    if (existe(trava)) await matarPerfil(perfil);
  }

  /* ---------- eventos do Chrome ---------- */
  function aoCdp(o) {
    if (o.method === 'Runtime.bindingCalled') {
      if (o.sessionId === sessao && o.params && o.params.name === 'cerebroOuvido') aoEventoPagina(o.params.payload);
    } else if (o.method === 'Inspector.targetCrashed') {
      if (o.sessionId === sessao) aoPaginaCaiu('a página do ouvido caiu');
    } else if (o.method === 'Target.detachedFromTarget') {
      if (o.params && o.params.sessionId === sessao) aoPaginaCaiu('a página do ouvido se soltou');
    }
  }
  function aoEventoPagina(bruto) {
    if (typeof bruto !== 'string' || bruto.length > 10000) return;
    let ev;
    try { ev = JSON.parse(bruto); } catch (_) { return; }
    if (!ev || typeof ev !== 'object' || !TIPOS_PAGINA.has(ev.tipo)) return;
    if (!dono || gerAtivo == null || ev.ger !== gerAtivo) return;   // geração velha (pausado, outra aba): descarta
    const aba = dono, g = gerAtivo;
    switch (ev.tipo) {
      case 'nivel': {
        if (typeof ev.b !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(ev.b)) return;   // 64 bytes em base64
        const db = Number(ev.db);
        if (!Number.isFinite(db)) return;
        enviarSse(aba, 'nivel', { b: ev.b, db: Math.max(-200, Math.min(20, db)), ger: g }, true);
        return;
      }
      case 'resultado': {
        const final = typeof ev.final === 'string' ? ev.final : '', parcial = typeof ev.parcial === 'string' ? ev.parcial : '';
        if (final.length > 2000 || parcial.length > 2000) return;
        enviarSse(aba, 'resultado', { final, parcial, ger: g });   // texto falado: só para a aba, nunca para o log
        return;
      }
      case 'fala':
        if (ev.fase === 'inicio' || ev.fase === 'fim') enviarSse(aba, 'fala', { fase: ev.fase, ger: g });
        return;
      case 'estado':
        if (ev.estado === 'ouvindo') {
          estadoAtual = 'ouvindo';
          enviarSse(aba, 'estado', { estado: 'ouvindo', ger: g });
        } else if (ev.estado === 'parado') {
          // a página parou sozinha (erro sem volta): a aba deixa de ser dona
          dono = null; gerAtivo = null; pedido = null;
          if (filho) estadoAtual = 'pronto';
          enviarSse(aba, 'estado', { estado: 'parado', ger: g });
        }
        return;
      case 'erro': {
        const codigo = typeof ev.codigo === 'string' && /^[a-z-]{2,40}$/.test(ev.codigo) ? ev.codigo : 'erro';
        log(`ouvido: erro na escuta (${codigo})`);
        if (codigo === 'pacote-falhou') pacote = null;   // confere de novo no próximo preparar
        ultimoErro = codigo;
        enviarSse(aba, 'erro', { codigo, mensagem: TEXTOS[codigo] || TEXTOS.erro, ger: g });
        return;
      }
      default:
    }
  }
  // 3 quedas em 5 min: para de tentar
  function contarQueda() {
    const t = Date.now();
    quedas = quedas.filter((x) => t - x < 5 * 60_000);
    quedas.push(t);
    if (quedas.length >= 3) { desistir('caiu'); return false; }
    return true;
  }
  function desistir(codigo) {
    const aba = dono, g = gerAtivo;
    dono = null; gerAtivo = null; pedido = null;
    clearTimeout(tVolta);
    ultimoErro = codigo;
    log(`ouvido: parei de tentar (${codigo})`);
    if (aba) {
      enviarSse(aba, 'estado', { estado: 'caiu', ger: g });
      enviarSse(aba, 'erro', { codigo, mensagem: TEXTOS[codigo] || TEXTOS.erro, ger: g });
    }
    if (filho && pagina) emSerie(() => avaliar('ouvido.pausar()', { prazo: 5000 })).catch(() => {});
  }
  function aoPaginaCaiu(motivo) {
    if (fechando || !filho) return;
    const s = sessao;
    pagina = false; sessao = null;
    log(`ouvido: ${motivo}; carregando de novo`);
    if (dono && !contarQueda()) return;
    emSerie(async () => {
      if (!filho || fechando) return;
      if (s) await cdp.enviar('Target.detachFromTarget', { sessionId: s }).catch(() => {});
      await carregarPagina();
      if (dono && gerAtivo != null) {
        const r = await ligarPagina(gerAtivo);
        if (!r || r.ok !== true) throw new ErroOuvido((r && r.codigo) || 'erro', 409);
      }
    }).catch((e) => { log('ouvido: a página não voltou', codigoDe(e)); if (dono) desistir('caiu'); });
  }
  function aoSairFilho(f, codigo) {
    if (f !== filho) return;
    filho = null; sessao = null; pagina = false;
    const t = cdp; cdp = null;
    if (t) t.fechar(new ErroOuvido('caiu', 503));
    if (fechando) { estadoAtual = 'desligado'; return; }
    estadoAtual = 'caiu';
    log(`ouvido: o Chrome escondido saiu sozinho (código ${codigo ?? '?'})`);
    for (const l of stderrFim.slice(-5)) log(`  chrome: ${l}`);
    if (dono && gerAtivo != null && contarQueda()) agendarVolta();
  }
  // queda com dono: parte de novo com recuo 1 s → 5 s → 30 s e religa na mesma geração
  function agendarVolta() {
    const atraso = [1000, 5000, 30000][Math.min(2, quedas.length - 1)];
    clearTimeout(tVolta);
    tVolta = setTimeout(() => {
      emSerie(async () => {
        if (!dono || gerAtivo == null || fechando || encerrado) return;
        await prepararInterno({ instalar: false });
        if (pacote !== 'available') throw new ErroOuvido('sem-pacote', 409);
        if (!dono || gerAtivo == null) return;
        const r = await ligarPagina(gerAtivo);
        if (!r || r.ok !== true) throw new ErroOuvido((r && r.codigo) || 'erro', 409);
        log('ouvido: voltou depois da queda');
      }).catch((e) => { log('ouvido: não voltou', codigoDe(e)); if (dono && contarQueda()) agendarVolta(); });
    }, atraso);
  }

  /* ---------- preparar, ligar, pausar ---------- */
  async function conferirPacote() {
    pacote = piorPacote(await avaliar(`ouvido.disponivel(${JSON.stringify(idiomas)})`, { prazo: 15000 }), idiomas);
    return pacote;
  }
  async function prepararInterno({ instalar = false } = {}) {
    if (encerrado) throw new ErroOuvido('desligado', 503);
    ultimoUso = Date.now();
    if (!filho) await partir();
    else if (!pagina) await carregarPagina();
    // confere a cada vez: o Chrome pode apagar o pacote sem uso
    await conferirPacote();
    if (pacote !== 'available' && (instalar || instalarSemPedir)) {
      estadoAtual = 'instalando';
      enviarTodos('estado', { estado: 'instalando', ger });
      log(`ouvido: baixando o pacote de voz (${idiomas.join(' e ')}, cerca de 300 MB, só uma vez)`);
      const t0 = Date.now();
      let r = null;
      try { r = await avaliar(`ouvido.instalar(${JSON.stringify(idiomas)})`, { gesto: true, prazo: 120000 }); }
      catch (e) { log('ouvido: a instalação não respondeu', codigoDe(e)); }
      if (filho && pagina) await conferirPacote().catch(() => {});
      if (pacote !== 'available') {
        ultimoErro = 'pacote-falhou';
        estadoAtual = filho ? 'pronto' : 'caiu';
        enviarTodos('estado', { estado: 'pronto', ger });
        log(`ouvido: o pacote de voz não baixou (${(r && r.codigo) || pacote || 'sem resposta'})`);
        throw new ErroOuvido('pacote-falhou', 409);
      }
      ultimoErro = null;
      log(`ouvido: pacote de voz baixado em ${Math.round((Date.now() - t0) / 1000)} s`);
    }
    if (['abrindo', 'instalando', 'caiu', 'desligado'].includes(estadoAtual)) {
      estadoAtual = 'pronto';
      enviarTodos('estado', { estado: 'pronto', ger });
    }
    return estadoPublico();
  }
  function ligarPagina(g) {
    const p = pedido || { lang: 'pt-BR', teste: null };
    const op = { lang: p.lang, ger: g, frases: frasesOk, ...(p.teste ? { teste: p.teste } : {}) };
    return avaliar(`ouvido.ligar(${JSON.stringify(op)})`, { gesto: true, prazo: 15000 });
  }
  async function ligarInterno(op, pedidoFila) {
    const { aba, lang = 'pt-BR', teste, instalar = false } = op || {};
    if (!abaValida(aba)) throw new ErroOuvido('aba', 400);
    if (typeof lang !== 'string' || !idiomas.includes(lang)) throw new ErroOuvido('idioma', 400);
    let t = null;
    if (teste != null) {
      if (!permitirTeste) throw new ErroOuvido('teste', 400);   // nunca ignorar calado: sem o teste abriria o microfone
      t = limparTeste(teste);
      if (!t) throw new ErroOuvido('teste', 400, 'O teste precisa de {arquivo: "/nome.wav"}.');
    }
    if (!pode()) throw new ErroOuvido('trava', 423);
    if (encerrado) throw new ErroOuvido('desligado', 503);
    if (pedidoFila && pedidoFila.cancelado) throw new ErroOuvido('cancelado', 409);
    ultimoUso = Date.now();
    await prepararInterno({ instalar });   // pode levar o tempo da instalação (o SSE mostra "instalando")
    if (pacote !== 'available') throw new ErroOuvido('sem-pacote', 409);
    if (!pode()) throw new ErroOuvido('trava', 423);   // travou enquanto abria
    if (pedidoFila && pedidoFila.cancelado) throw new ErroOuvido('cancelado', 409);
    const velho = dono, gVelho = gerAtivo;
    const g = ++ger;
    dono = aba; gerAtivo = g; pedido = { lang, teste: t };
    clearTimeout(tVolta);
    if (velho && velho !== aba) {
      // a última aba que liga vence; a velha fica sabendo
      enviarSse(velho, 'estado', { estado: 'parado', ger: gVelho, motivo: 'outra-aba' });
      log('ouvido: outra aba ligou o microfone');
    }
    estadoAtual = 'iniciando';
    let r;
    try { r = await ligarPagina(g); }
    catch (e) {
      if (gerAtivo === g) { dono = null; gerAtivo = null; pedido = null; }
      if (filho) estadoAtual = 'pronto';
      log('ouvido: o ligar não respondeu', codigoDe(e));
      throw e instanceof ErroOuvido ? e : new ErroOuvido('erro', 500);
    }
    if (!r || r.ok !== true) {
      if (gerAtivo === g) { dono = null; gerAtivo = null; pedido = null; }
      if (filho) estadoAtual = 'pronto';
      const codigo = r && CODIGOS_PAGINA.has(r.codigo) ? r.codigo : 'erro';
      log(`ouvido: o microfone não ligou (${codigo})`);
      throw new ErroOuvido(codigo, codigo === 'sem-suporte' ? 503 : 409);
    }
    if (gerAtivo !== g) throw new ErroOuvido('cancelado', 409);
    if (estadoAtual === 'iniciando' && !r.aindaIniciando) estadoAtual = 'ouvindo';
    ultimoErro = null;
    log(`ouvido: ouvindo (${lang}${t ? ', teste com arquivo' : ''})`);
    vigiarDono(temSse(aba) ? 2000 : 5000);
    return { ok: true, ger: g };
  }
  async function pausarInterno({ aba, motivo } = {}) {
    ultimoUso = Date.now();
    if (!dono || aba !== dono) return { ok: true, ignorado: true };
    const g = gerAtivo;
    dono = null; gerAtivo = null; pedido = null;
    clearTimeout(tVolta);
    enviarSse(aba, 'estado', { estado: 'parado', ger: g, ...(motivo ? { motivo } : {}) });
    if (filho && pagina) {
      try { await avaliar('ouvido.pausar()', { prazo: 5000 }); }
      catch (e) {
        // a página não respondeu: fecha o Chrome inteiro (é a garantia de que o microfone fecha)
        log('ouvido: a página não pausou; fechando o Chrome escondido', codigoDe(e));
        fechando = true;
        try { await fecharChrome(); } finally { fechando = false; }
        estadoAtual = 'desligado';
      }
    }
    if (filho && (estadoAtual === 'ouvindo' || estadoAtual === 'iniciando')) estadoAtual = 'pronto';
    log(`ouvido: pausado${motivo ? ` (${motivo})` : ''}`);
    return { ok: true };
  }
  async function desligar({ final = false } = {}) {
    if (final) encerrado = true;
    clearTimeout(tVolta);
    const aba = dono, g = gerAtivo;
    dono = null; gerAtivo = null; pedido = null;
    for (const p of pendentes) p.cancelado = true;
    if (aba) enviarSse(aba, 'estado', { estado: 'parado', ger: g, motivo: 'desligado' });
    const tinha = !!filho;
    fechando = true;
    try { await fecharChrome(); } finally { fechando = false; }
    if (tinha) log('ouvido: Chrome escondido fechado');
    estadoAtual = exe ? 'desligado' : 'sem-chrome';
    if (final) {
      clearInterval(tVigia);
      for (const t of tSemSse.values()) clearTimeout(t);
      tSemSse.clear();
      for (const set of sses.values()) for (const res of set) { try { res.end(); } catch (_) { /* nada */ } }
      sses.clear();
    }
  }

  // vigia: a trava fechou com o microfone ligado (virou o dia) → pausa; sem dono e sem SSE por ociosoMs → fecha o Chrome
  const tVigia = setInterval(() => {
    if (dono && !pode()) {
      const aba = dono, g = gerAtivo;
      log('ouvido: a trava fechou; microfone desligado');
      enviarSse(aba, 'erro', { codigo: 'trava', mensagem: TEXTOS.trava, ger: g });
      emSerie(() => pausarInterno({ aba, motivo: 'trava' })).catch(() => {});
      return;
    }
    if (filho && !dono && !pendentes.size && totalSse() === 0 && Date.now() - ultimoUso >= ociosoMs) {
      log('ouvido: sem uso; fechando o Chrome escondido');
      emSerie(() => (filho && !dono && totalSse() === 0 ? desligar() : null)).catch(() => {});
    }
  }, Math.max(500, Math.min(15000, Math.floor(ociosoMs / 2))));
  tVigia.unref?.();

  /* ---------- rotas /api/ouvido/* (docs/OUVIDO-E-ROSTO.md §3.3) ----------
     ctx = { req, res, url, metodo, lerCorpoJson, json, erro }: as funções do servidor.js, que já conferiu token, Host e
     Origin. Devolve true se a rota era daqui. */
  async function tratar(ctx) {
    const { req, res, url, lerCorpoJson, json, erro } = ctx;
    const p = url.pathname;
    if (p !== '/api/ouvido' && !p.startsWith('/api/ouvido/')) return false;
    const rota = p.slice('/api/ouvido/'.length);
    const m = ctx.metodo || req.method;
    ultimoUso = Date.now();
    try {
      if (rota === 'estado') {
        if (m !== 'GET') { erro(res, 405, 'Use GET.', 'metodo'); return true; }
        json(res, 200, estadoPublico());
        return true;
      }
      if (rota === 'eventos') {
        if (m !== 'GET') { erro(res, 405, 'Use GET.', 'metodo'); return true; }
        const aba = url.searchParams.get('aba');
        if (!abaValida(aba)) { erro(res, 400, TEXTOS.aba, 'aba'); return true; }
        if (encerrado) { erro(res, 503, TEXTOS.desligado, 'desligado'); return true; }
        res.writeHead(200, { ...SEG, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.socket?.setNoDelay(true);
        res.write(': ok\n\n');
        let set = sses.get(aba);
        if (!set) sses.set(aba, set = new Set());
        set.add(res);
        if (tSemSse.has(aba)) { clearTimeout(tSemSse.get(aba)); tSemSse.delete(aba); }
        if (estadoAtual === 'abrindo' || estadoAtual === 'instalando') escreverSse(res, 'estado', { estado: estadoAtual, ger });
        const ping = setInterval(() => { if (!res.writableEnded && !res.destroyed) res.write(': ping\n\n'); }, 15000);
        res.on('close', () => {
          clearInterval(ping);
          const s = sses.get(aba);
          if (s) { s.delete(res); if (!s.size) sses.delete(aba); }
          ultimoUso = Date.now();
          vigiarDono();
        });
        return true;
      }
      if (rota === 'preparar' || rota === 'instalar' || rota === 'ligar' || rota === 'pausar') {
        if (m !== 'POST') { erro(res, 405, 'Use POST.', 'metodo'); return true; }
        let corpo;
        try { corpo = await lerCorpoJson(req); }
        catch (e) { erro(res, e.status || 400, e.status === 413 ? 'O pedido passou de 1 MB.' : e.status === 415 ? 'Mande JSON (Content-Type: application/json).' : 'JSON inválido.'); return true; }
        if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) corpo = {};
        let saida;
        if (rota === 'preparar') saida = await api.preparar({ instalar: corpo.instalar === true });
        else if (rota === 'instalar') saida = await api.preparar({ instalar: true });   // o pedido explícito de baixar o pacote
        else if (rota === 'ligar') saida = await api.ligar({ aba: corpo.aba, lang: corpo.lang ?? 'pt-BR', teste: corpo.teste, instalar: corpo.instalar === true });
        else {
          if (!abaValida(corpo.aba)) { erro(res, 400, TEXTOS.aba, 'aba'); return true; }
          saida = await api.pausar({ aba: corpo.aba });
        }
        json(res, 200, saida);
        return true;
      }
      erro(res, 404, 'Rota desconhecida.', 'rota');
      return true;
    } catch (e) {
      const x = e instanceof ErroOuvido ? e : new ErroOuvido('erro', 500, undefined, e && e.message);
      if (x.detalhe) log(`ouvido: ${rota}: ${x.codigo} (${x.detalhe})`);
      if (!res.headersSent) erro(res, x.status, x.message, x.codigo);
      else { try { res.end(); } catch (_) { /* nada */ } }
      return true;
    }
  }

  const api = {
    /** Abre o Chrome e carrega a página; confere o pacote; baixa só com {instalar: true}. NÃO abre o microfone. */
    preparar: (op = {}) => emSerie(() => prepararInterno(op)),
    /** Liga a escuta para a aba (a última que liga vence). Lança ErroOuvido (trava 423, sem-chrome 503, sem-pacote 409…). */
    ligar: (op = {}) => {
      const p = { aba: op && op.aba, cancelado: false };
      pendentes.add(p);
      return emSerie(() => ligarInterno(op, p)).finally(() => pendentes.delete(p));
    },
    /** Pausa, se a aba for a dona (senão {ok: true, ignorado: true}); cancela um ligar dela que ainda esteja na fila. */
    pausar: (op = {}) => {
      for (const p of pendentes) if (p.aba === (op && op.aba)) p.cancelado = true;
      return emSerie(() => pausarInterno(op));
    },
    estado: () => estadoPublico(),
    tratar,
    /** Fecha o Chrome (Browser.close; se não sair em 3 s, taskkill /T /F). {final: true} = o servidor está saindo. */
    desligar,
  };
  return api;
}
