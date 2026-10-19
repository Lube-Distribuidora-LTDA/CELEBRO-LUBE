/* Teste da integração do servidor.js com a trava do rosto e o ouvido (docs/OUVIDO-E-ROSTO.md §7), com o servidor de
   verdade num processo filho e SEM rosto, SEM câmera e SEM microfone de verdade.
   node teste/testar-integracao.js
   - O servidor sobe com --simulado numa porta livre, com um ENV vazio, um vault de mentira e as pastas do rosto e do
     ouvido em pastas temporárias (--rosto-pasta, --ouvido-perfil): o cadastro de verdade e o perfil do Chrome do app
     nunca são tocados (o teste confere).
   - Prova: o 423 nas rotas que agem (turno, confirmar ação, ligar o ouvido) antes de liberar, o recusar passando, o
     Chrome que não abre com a trava fechada, o cadastro sintético liberando, o turno respondendo, o travar fechando de
     novo, o token, o Host e a Origin nas rotas novas, e o estado com trava e ouvido. E (revisão de 2026-10-19): a CSP
     da página, o "teste: true" só com --simulado e a recusa de --trava-aberta e --rosto-pasta sem --simulado.
   - Com o Chrome e o perfil de teste do testar-ouvido.js já com o pacote de voz (%LOCALAPPDATA%\CerebroLube\
     ouvido-chrome-teste), sobe um segundo servidor com --ouvido-teste=teste/fala-pt.wav e confere o caminho inteiro
     servidor.js → Chrome escondido → SSE: o texto falado chega. Sem eles, pula essa parte (avisa).
   Não rodar junto com o testar-ouvido.js (os dois usam o perfil de teste). */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PASTA_PADRAO } from '../rosto.js';
import { acharChrome, PERFIL_PADRAO } from '../ouvido.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SERVIDOR = path.resolve(AQUI, '..', 'servidor.js');
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const PERFIL_TESTE = path.join(LOCAL, 'CerebroLube', 'ouvido-chrome-teste');
const WAV_FIXO = path.join(AQUI, 'fala-pt.wav');   // fora do Git (áudio nenhum vai para o repositório): sem ele, gera um
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let total = 0, falhas = 0;
function ok(cond, txt) { total++; if (cond) console.log(`OK   ${txt}`); else { falhas++; console.log(`FALHA ${txt}`); } }
function titulo(t) { console.log(`\n== ${t}`); }

/* ---------- ajudas ---------- */
function portaLivre() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
// nomes e datas de uma pasta (para provar que o teste não mexeu nela)
function foto(p) {
  try { return fs.readdirSync(p).sort().map((n) => { const st = fs.statSync(path.join(p, n)); return `${n}:${st.size}:${st.mtimeMs}`; }).join('|'); }
  catch (e) { return `sem pasta (${e.code})`; }
}
// quantos chrome.exe com este perfil (mesma regra do ouvido.js: só o --user-data-dir igual)
function contarChrome(perfil) {
  const script = String.raw`$p = [regex]::Escape($env:PERFIL_CONTAR); $rx = '--user-data-dir="?' + $p + '\\?"?(\s|$)'; @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -match $rx }).Count`;
  return new Promise((res) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, timeout: 20000, env: { ...process.env, PERFIL_CONTAR: path.resolve(perfil) } },
      (err, out) => res(err ? -1 : Number(String(out || '').trim()) || 0));
  });
}
// descritores sintéticos (128 números, norma ~1,45): uma "pessoa" e amostras com ruído pequeno (como o testar-rosto.js)
function aleatorio(semente) { let s = semente >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function vetor(sorteio, normaAlvo) {
  const v = Array.from({ length: 128 }, () => { const u = sorteio() || 1e-9, w = sorteio(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); });
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => (x / n) * normaAlvo);
}
function amostra(pessoa, sorteio, d = 0.2) {
  const r = vetor(sorteio, d);
  return pessoa.map((x, i) => Math.max(-1, Math.min(1, Math.round((x + r[i]) * 1e6) / 1e6)));
}
// voz pt-BR do Windows → .wav temporário (só quando o teste/fala-pt.wav não existe; como o testar-ouvido.js)
function gerarWav() {
  const saida = path.join(os.tmpdir(), `integracao-fala-${process.pid}.wav`);
  const script = "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
    + "$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'pt-BR' } | Select-Object -First 1; "
    + "if (-not $v) { exit 3 }; $s.SelectVoice($v.VoiceInfo.Name); $s.SetOutputToWaveFile($env:INTEGRACAO_WAV); "
    + "$s.Speak('Jarvis, está tudo rodando hoje?'); $s.Dispose()";
  return new Promise((res) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, timeout: 60000, env: { ...process.env, INTEGRACAO_WAV: saida } },
      () => { try { res(fs.statSync(saida).size > 10000 ? saida : null); } catch (_) { res(null); } });
  });
}

/* ---------- o servidor de verdade num processo filho ---------- */
async function subir({ extra = [], pastaRosto, perfil }) {
  const porta = await portaLivre();
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'cerebro-integracao-'));
  const vault = path.join(tmp, 'vault');
  await fsp.mkdir(path.join(vault, 'Projetos'), { recursive: true });
  await fsp.writeFile(path.join(vault, 'Projetos', 'Teste.md'), '---\ntipo: projeto\n---\n# Teste\nNota de teste da integração.\n', 'utf8');
  const env = path.join(tmp, 'ENV');
  await fsp.writeFile(env, '# vazio: o teste não usa banco, e-mail nem a chave do Claude\n', 'utf8');
  const filho = spawn(process.execPath, [SERVIDOR, '--simulado', `--rosto-pasta=${pastaRosto}`, `--ouvido-perfil=${perfil}`, ...extra], {
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, JARVIS_PORTA: String(porta), JARVIS_ENV: env, VAULT_DIR: vault, ARQUIVOS_RAIZES: tmp, JARVIS_SIMULADO: '1' },
  });
  let saida = '';
  filho.stdout.on('data', (d) => { saida += d; });
  filho.stderr.on('data', (d) => { saida += d; });
  const t0 = Date.now();
  while (Date.now() - t0 < 20000 && !/no ar em http/.test(saida) && filho.exitCode === null) await esperar(100);
  const base = `http://127.0.0.1:${porta}`;
  let token = null;
  try {
    const html = await (await fetch(`${base}/`)).text();
    token = (html.match(/<meta name="cerebro-token" content="([^"]+)"/) || [])[1] || null;
  } catch (_) { /* não subiu */ }
  return {
    porta, base, token, tmp, filho, saida: () => saida,
    async parar() {
      try { filho.kill(); } catch (_) { /* já saiu */ }
      await Promise.race([new Promise((r) => filho.once('exit', r)), esperar(5000)]);
      await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    },
  };
}
async function pedir(S, metodo, rota, corpo, { token = S.token, host, origem, prazo = 30000 } = {}) {
  const h = {};
  if (token) h['x-cerebro-token'] = token;
  if (corpo !== undefined) h['content-type'] = 'application/json';
  if (host) h.host = host;
  if (origem) h.origin = origem;
  const r = await fetch(`${S.base}${rota}`, { method: metodo, headers: h, body: corpo !== undefined ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(prazo) });
  const tipo = r.headers.get('content-type') || '';
  let dados = null, texto = '';
  if (tipo.includes('event-stream')) texto = await r.text();
  else { try { dados = await r.json(); } catch (_) { dados = null; } }
  return { status: r.status, dados, texto, tipo };
}
const eventosSse = (texto) => texto.split(/\r?\n\r?\n/).map((b) => (b.match(/^event: (.+)$/m) || [])[1]).filter(Boolean);
function abrirSse(S, aba) {
  const ctl = new AbortController();
  const eventos = [];
  const pronto = (async () => {
    const r = await fetch(`${S.base}/api/ouvido/eventos?aba=${aba}`, { headers: { 'x-cerebro-token': S.token, accept: 'text/event-stream' }, signal: ctl.signal });
    if (!r.ok || !r.body) return r.status;
    (async () => {
      const dec = new TextDecoder(); let buf = '';
      try {
        for await (const p of r.body) {
          buf += dec.decode(p, { stream: true });
          let k;
          while ((k = buf.indexOf('\n\n')) >= 0) {
            const bloco = buf.slice(0, k); buf = buf.slice(k + 2);
            const ev = (bloco.match(/^event: (.+)$/m) || [])[1], d = (bloco.match(/^data: (.+)$/m) || [])[1];
            if (ev) { let dados = {}; try { dados = JSON.parse(d || '{}'); } catch (_) { /* nada */ } eventos.push({ ev, dados, t: Date.now() }); }
          }
        }
      } catch (_) { /* fechado */ }
    })();
    return r.status;
  })().catch(() => 0);
  return { eventos, pronto, fechar: () => ctl.abort() };
}

/* =============================================================================
   1. A trava nas rotas que agem
   ============================================================================= */
const fotoRostoAntes = foto(PASTA_PADRAO), fotoPerfilAntes = foto(PERFIL_PADRAO);
const pastaRosto = await fsp.mkdtemp(path.join(os.tmpdir(), 'cerebro-rosto-'));
const perfilVazio = await fsp.mkdtemp(path.join(os.tmpdir(), 'cerebro-ouvido-'));
let S = await subir({ pastaRosto, perfil: perfilVazio });
try {
  titulo('o servidor sobe com o rosto e o ouvido ligados');
  ok(!!S.token, `subiu na porta ${S.porta} e a página traz o token`);
  ok(/trava do rosto: sem cadastro/.test(S.saida()), 'o log da partida diz que não há cadastro do rosto');
  ok(/ouvido: Google Chrome (achado|não achado)/.test(S.saida()), 'o log da partida diz se achou o Chrome');

  // a CSP da página: só este app, as CDNs das bibliotecas e o Guardião (nada de quadro da câmera ou token para fora)
  const pag = await fetch(`${S.base}/`);
  const csp = pag.headers.get('content-security-policy') || '';
  const dir = (n) => (csp.split(';').map((x) => x.trim()).find((x) => x.startsWith(`${n} `)) || '');
  ok(/^connect-src 'self' https:\/\/cdn\.jsdelivr\.net https:\/\/storage\.googleapis\.com https:\/\/[a-z]+\.supabase\.co$/.test(dir('connect-src')),
    `CSP da página: ${dir('connect-src')}`);
  ok(dir('img-src') === "img-src 'self' data: blob:" && dir('media-src') === "media-src 'self' blob:" && /frame-ancestors 'none'/.test(csp)
    && /form-action 'self'/.test(csp) && !/\*/.test(csp), 'CSP: imagem e mídia só daqui, sem iframe, sem curinga');
  await pag.arrayBuffer().catch(() => {});
  let r = await pedir(S, 'GET', '/api/rosto/estado');
  ok(r.status === 200 && r.dados.teste === true, 'com --simulado o rosto diz teste: true (só aí a página aceita ?rosto=simular)');
  r = await pedir(S, 'GET', '/api/jarvis/estado');
  ok(r.status === 200 && r.dados.trava && r.dados.trava.liberado === false && r.dados.trava.precisa_cadastro === true, 'estado: trava fechada, precisa de cadastro');
  ok(r.dados.ouvido && ['desligado', 'sem-chrome'].includes(r.dados.ouvido.estado), `estado: ouvido ${r.dados.ouvido && r.dados.ouvido.estado} (o Chrome não abriu sozinho)`);
  ok(!JSON.stringify(r.dados.trava).match(/amostras":\s*\[/), 'estado: nenhum descritor no estado');

  titulo('travado: 423 no que age');
  r = await pedir(S, 'POST', '/api/jarvis/turno', { conversa: [{ papel: 'julio', texto: 'oi Jarvis' }], contexto: {} });
  ok(r.status === 423 && r.dados && r.dados.erro === 'trava', 'turno travado: 423 trava');
  ok(r.dados && /reconhecimento do rosto/.test(r.dados.mensagem || ''), 'a mensagem diz para fazer o reconhecimento do rosto');
  r = await pedir(S, 'POST', '/api/jarvis/acao/abcd1234', { decisao: 'confirmar' });
  ok(r.status === 423 && r.dados.erro === 'trava', 'confirmar uma ação travado: 423');
  r = await pedir(S, 'POST', '/api/jarvis/acao/abcd1234', { decisao: 'recusar' });
  ok(r.status === 404, `recusar travado passa pela trava (404 = a ação não existe; veio ${r.status})`);
  r = await pedir(S, 'POST', '/api/ouvido/ligar', { aba: 'abaTeste01' });
  ok(r.status === 423 && r.dados.erro === 'trava', 'ligar o ouvido travado: 423');
  r = await pedir(S, 'GET', '/api/ouvido/estado');
  ok(r.status === 200 && ['desligado', 'sem-chrome'].includes(r.dados.estado), `o Chrome não abriu com a trava fechada (estado ${r.dados.estado})`);
  ok(await contarChrome(perfilVazio) === 0, '0 chrome.exe com o perfil do teste');

  titulo('token, Host e Origin valem nas rotas novas');
  r = await pedir(S, 'GET', '/api/rosto/estado', undefined, { token: null });
  ok(r.status === 401, 'rosto sem token: 401');
  r = await pedir(S, 'GET', '/api/ouvido/estado', undefined, { token: 'x'.repeat(43) });
  ok(r.status === 401, 'ouvido com token errado: 401');
  r = await pedir(S, 'POST', '/api/rosto/travar', {}, { origem: 'https://exemplo.com' });
  ok(r.status === 403, 'rosto com Origin de outro site: 403');
  r = await pedir(S, 'GET', '/api/rosto/estado', undefined, { origem: `http://localhost:${S.porta}` });
  ok(r.status === 200 && r.dados.liberado === false, 'rosto com a Origin da própria página: 200');
  ok(!fs.existsSync(path.join(pastaRosto, 'cadastro.json')), 'nada gravado na pasta do rosto ainda');

  titulo('cadastro sintético libera o dia');
  const sorteio = aleatorio(20261019), pessoa = vetor(sorteio, 1.45);
  const descritores = Array.from({ length: 8 }, () => amostra(pessoa, sorteio));
  r = await pedir(S, 'POST', '/api/rosto/cadastro', { descritores });
  ok(r.status === 200 && r.dados.ok && r.dados.amostras >= 5, `cadastro: 200 (${r.dados && r.dados.amostras} amostras)`);
  ok(fs.existsSync(path.join(pastaRosto, 'cadastro.json')), 'cadastro.json na pasta do teste');
  r = await pedir(S, 'GET', '/api/jarvis/estado');
  ok(r.dados.trava.liberado === true && r.dados.trava.metodo === 'cadastro', 'estado: liberado hoje pelo cadastro');
  r = await pedir(S, 'POST', '/api/rosto/cadastro', { descritores });
  ok(r.status === 200, 'recadastrar liberado: 200');

  titulo('liberado: o turno responde');
  r = await pedir(S, 'POST', '/api/jarvis/turno', { conversa: [{ papel: 'julio', texto: 'oi Jarvis' }], contexto: {} });
  const evs = eventosSse(r.texto);
  ok(r.status === 200 && /event-stream/.test(r.tipo) && evs.includes('texto') && evs.includes('fim'), `turno liberado: SSE com texto e fim (${evs.slice(0, 6).join(', ')})`);

  titulo('travar agora fecha de novo');
  r = await pedir(S, 'POST', '/api/rosto/travar', {});
  ok(r.status === 200, 'travar: 200');
  r = await pedir(S, 'POST', '/api/jarvis/turno', { conversa: [{ papel: 'julio', texto: 'oi de novo' }], contexto: {} });
  ok(r.status === 423, 'turno depois de travar: 423');
  r = await pedir(S, 'POST', '/api/rosto/apagar', { confirmar: true });
  ok(r.status === 423 && fs.existsSync(path.join(pastaRosto, 'cadastro.json')), 'apagar travado: 423 (o cadastro fica)');
  r = await pedir(S, 'POST', '/api/rosto/desafio', {});
  ok(r.status === 200 && (r.dados.piscadas === 2 || r.dados.piscadas === 3) && typeof r.dados.id === 'string', `desafio do dia: ${r.dados.piscadas} piscadas`);
} finally {
  await S.parar();
}
titulo('o estado sobrevive a reiniciar o app');
S = await subir({ pastaRosto, perfil: perfilVazio });
try {
  ok(/trava do rosto: cadastrada, pede o rosto/.test(S.saida()), 'a partida nova lembra o cadastro e pede o rosto (travado)');
  const r = await pedir(S, 'POST', '/api/jarvis/turno', { conversa: [{ papel: 'julio', texto: 'oi' }], contexto: {} });
  ok(r.status === 423, 'turno na partida nova: 423');
} finally {
  await S.parar();
}
titulo('--trava-aberta (só teste): libera e avisa');
const pastaAberta = await fsp.mkdtemp(path.join(os.tmpdir(), 'cerebro-rosto-'));
S = await subir({ pastaRosto: pastaAberta, perfil: perfilVazio, extra: ['--trava-aberta'] });
try {
  ok(/TRAVA DO ROSTO DESLIGADA/.test(S.saida()), 'o log avisa em destaque');
  const r = await pedir(S, 'POST', '/api/jarvis/turno', { conversa: [{ papel: 'julio', texto: 'oi' }], contexto: {} });
  ok(r.status === 200, 'turno com a trava aberta: 200');
} finally {
  await S.parar();
  await fsp.rm(pastaAberta, { recursive: true, force: true }).catch(() => {});
}

titulo('sem --simulado, as opções de teste da trava são recusadas (o app não liga)');
// um comando de teste esquecido não pode desligar a trava do app de verdade. O teste sobe SEM --simulado e sem
// JARVIS_SIMULADO, mas com ENV vazio, vault e perfil temporários e porta livre: se a recusa falhar, nada de verdade é tocado
for (const extra of [['--trava-aberta'], [`--rosto-pasta=${path.join(os.tmpdir(), 'cerebro-rosto-nao-usar')}`]]) {
  const porta = await portaLivre();
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'cerebro-recusa-'));
  await fsp.writeFile(path.join(tmp, 'ENV'), '# vazio\n', 'utf8');
  const env = { ...process.env, JARVIS_PORTA: String(porta), JARVIS_ENV: path.join(tmp, 'ENV'), VAULT_DIR: tmp, ARQUIVOS_RAIZES: tmp };
  delete env.JARVIS_SIMULADO;
  const filho = spawn(process.execPath, [SERVIDOR, `--ouvido-perfil=${path.join(tmp, 'perfil')}`, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env });
  let saida = '';
  filho.stdout.on('data', (d) => { saida += d; }); filho.stderr.on('data', (d) => { saida += d; });
  const codigo = await Promise.race([new Promise((r) => filho.once('exit', (c) => r(c))), esperar(15000).then(() => 'vivo')]);
  if (codigo === 'vivo') { try { filho.kill(); } catch (_) { /* nada */ } }
  ok(codigo === 1 && /Recusado: --trava-aberta e --rosto-pasta só valem com --simulado/.test(saida) && !/no ar em http/.test(saida),
    `${extra[0].split('=')[0]} sem --simulado: sai com código 1 e avisa (veio ${codigo})`);
  await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
}

/* =============================================================================
   2. O caminho inteiro do ouvido: servidor.js → Chrome escondido → SSE
   ============================================================================= */
titulo('ouvido de ponta a ponta (servidor.js de verdade, Chrome escondido, .wav no lugar do microfone)');
const chrome = acharChrome();
const temPacote = fs.existsSync(path.join(PERFIL_TESTE, 'SODALanguagePacks'));
const WAV = chrome && temPacote ? (fs.existsSync(WAV_FIXO) ? WAV_FIXO : await gerarWav()) : null;
const wavGerado = WAV && WAV !== WAV_FIXO;
if (!chrome || !temPacote || !WAV) {
  console.log(`(pulado: ${!chrome ? 'sem Chrome' : !temPacote ? 'o perfil de teste ainda não tem o pacote de voz — rode antes o testar-ouvido.js' : 'sem voz pt-BR no Windows para gerar o áudio'})`);
} else if (await contarChrome(PERFIL_TESTE) > 0) {
  console.log('(pulado: o perfil de teste está em uso por outro teste)');
} else {
  const pasta2 = await fsp.mkdtemp(path.join(os.tmpdir(), 'cerebro-rosto-'));
  S = await subir({ pastaRosto: pasta2, perfil: PERFIL_TESTE, extra: [`--ouvido-teste=${WAV}`] });
  try {
    ok(/TESTE: toca o \.wav/.test(S.saida()), 'o servidor diz que está no modo de teste do ouvido');
    let r = await pedir(S, 'GET', '/teste-ouvido.wav', undefined);
    ok(r.status === 200, 'o .wav do teste é servido em /teste-ouvido.wav');
    const sorteio = aleatorio(7), pessoa = vetor(sorteio, 1.45);
    r = await pedir(S, 'POST', '/api/rosto/cadastro', { descritores: Array.from({ length: 6 }, () => amostra(pessoa, sorteio)) });
    ok(r.status === 200, 'liberado pelo cadastro sintético');
    const aba = 'integracao01';
    const sse = abrirSse(S, aba);
    ok(await sse.pronto === 200, 'SSE do ouvido aberto');
    const t0 = Date.now();
    r = await pedir(S, 'POST', '/api/ouvido/ligar', { aba, lang: 'pt-BR' }, { prazo: 160000 });
    ok(r.status === 200 && Number.isFinite(r.dados.ger), `ligar: 200 em ${((Date.now() - t0) / 1000).toFixed(1)} s (ger ${r.dados && r.dados.ger})`);
    let final = null;
    for (let i = 0; i < 200 && !final; i++) {
      final = sse.eventos.find((e) => e.ev === 'resultado' && /rodando/.test(norm(e.dados.final)));
      if (!final) await esperar(100);
    }
    const parciais = sse.eventos.filter((e) => e.ev === 'resultado' && e.dados.parcial).length;
    const niveis = sse.eventos.filter((e) => e.ev === 'nivel').length;
    ok(!!final, `o texto chegou pelo SSE: "${final ? final.dados.final.trim() : '—'}" (${parciais} parciais antes)`);
    ok(niveis > 20, `nível do "microfone" pelo SSE (${niveis} eventos)`);
    r = await pedir(S, 'POST', '/api/rosto/travar', {});
    // o vigia do ouvido confere a trava a cada até 15 s e pausa sozinho
    let pausou = false;
    for (let i = 0; i < 200 && !pausou; i++) {
      pausou = sse.eventos.some((e) => e.ev === 'estado' && e.dados.estado === 'parado' && e.dados.motivo === 'trava');
      if (!pausou) await esperar(100);
    }
    ok(pausou, 'travar com o microfone ligado: o ouvido pausa sozinho (motivo trava)');
    r = await pedir(S, 'POST', '/api/ouvido/ligar', { aba });
    ok(r.status === 423, 'ligar de novo travado: 423');
    sse.fechar();
    ok(!S.saida().toLowerCase().includes('rodando'), 'o log do servidor não tem o texto falado');
  } finally {
    await S.parar();
    // o filho morreu à força: o pipe fechou e o Chrome sai sozinho (medido: 0,3 s)
    let n = -1;
    for (let i = 0; i < 30; i++) { n = await contarChrome(PERFIL_TESTE); if (n === 0) break; await esperar(300); }
    ok(n === 0, 'o servidor morreu: 0 chrome.exe com o perfil de teste (o Chrome saiu junto)');
    await fsp.rm(pasta2, { recursive: true, force: true }).catch(() => {});
    if (wavGerado) await fsp.rm(WAV, { force: true }).catch(() => {});
  }
}

titulo('as pastas de verdade não mudaram');
ok(foto(PASTA_PADRAO) === fotoRostoAntes, 'a pasta de verdade do rosto (%LOCALAPPDATA%\\CerebroLube\\rosto) não mudou');
ok(foto(PERFIL_PADRAO) === fotoPerfilAntes, 'o perfil de verdade do ouvido não mudou');
await fsp.rm(pastaRosto, { recursive: true, force: true }).catch(() => {});
await fsp.rm(perfilVazio, { recursive: true, force: true }).catch(() => {});

console.log(`\n${total - falhas} de ${total} OK`);
process.exit(falhas ? 1 : 0);
