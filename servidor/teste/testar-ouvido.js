/* Teste do ouvido do Jarvis (servidor/ouvido.js + web/ouvido.html) com o Chrome de verdade e SEM microfone.
   node teste/testar-ouvido.js
   - A página toca teste/fala-pt.wav pela WebAudio e o Chrome escondido transcreve no computador (processLocally, pt-BR).
     Sem o arquivo, gera um em os.tmpdir() com a voz pt-BR do Windows (System.Speech); sem voz pt-BR, pula a transcrição.
   - Perfil de teste: %LOCALAPPDATA%\CerebroLube\ouvido-chrome-teste. Fica, para não baixar o pacote de voz (~300 MB) toda
     vez; OUVIDO_PERFIL_LIMPO=1 apaga antes. A primeira vez o teste PEDE a instalação (POST /api/ouvido/instalar).
   - Nunca abre o microfone de verdade: todo ligar vai com {teste: {arquivo}} (e o ouvido sem permitirTeste recusa o teste).
   - Sem Chrome: avisa e sai com 0. OUVIDO_LOG=1 mostra o log do ouvido.
   Modo filho (o próprio teste usa): node teste/testar-ouvido.js --filho <porta> <exit|vivo> */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  criarOuvidoChrome, acharChrome, ErroOuvido, PERFIL_PADRAO, TEXTOS, contarProcessos, matarPerfil, abaValida,
} from '../ouvido.js';

const ESTE = fileURLToPath(import.meta.url);
const AQUI = path.dirname(ESTE);
const WEB = path.resolve(AQUI, '..', '..', 'web');
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const PERFIL_TESTE = path.join(LOCAL, 'CerebroLube', 'ouvido-chrome-teste');
const TESTE_WAV = { arquivo: '/fala-pt.wav' };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const seg = (t0) => ((Date.now() - t0) / 1000).toFixed(1);

/* ---------------------------------------------------------------- ajudas */
function json(res, status, obj) {
  const corpo = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(corpo) });
  res.end(corpo);
}
function erro(res, status, mensagem, codigo) { json(res, status, { erro: codigo || 'erro', mensagem }); }
async function lerCorpoJson(req) {
  const tipo = String(req.headers['content-type'] || '').toLowerCase();
  if (!tipo.startsWith('application/json')) { const e = new Error('tipo'); e.status = 415; throw e; }
  const partes = [];
  for await (const p of req) partes.push(p);
  try { return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'); } catch (_) { const e = new Error('json'); e.status = 400; throw e; }
}
// servidor HTTP do teste: serve a página e o .wav, e passa /api/ouvido/* para o ouvido da vez (como o servidor.js fará)
function criarServidorTeste(wav) {
  let ouvido = null;
  const srv = http.createServer((req, res) => {
    (async () => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (ouvido && await ouvido.tratar({ req, res, url, metodo: req.method, lerCorpoJson, json, erro })) return;
        erro(res, 404, 'Rota desconhecida.', 'rota');
        return;
      }
      if (url.pathname === '/ouvido.html') {
        const html = await fsp.readFile(path.join(WEB, 'ouvido.html'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(html);
        return;
      }
      if (url.pathname === TESTE_WAV.arquivo && wav) {
        const dados = await fsp.readFile(wav);
        res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': dados.length, 'Cache-Control': 'no-store' });
        res.end(dados);
        return;
      }
      res.writeHead(404); res.end();
    })().catch(() => { if (!res.headersSent) { res.writeHead(500); } try { res.end(); } catch (_) { /* nada */ } });
  });
  return { srv, usar(o) { ouvido = o; } };
}
function analisarSse(bloco) {
  let evento = 'message'; const dados = [];
  for (const linha of bloco.split(/\r?\n/)) {
    if (!linha || linha.startsWith(':')) continue;
    const k = linha.indexOf(':'), campo = k < 0 ? linha : linha.slice(0, k);
    let v = k < 0 ? '' : linha.slice(k + 1);
    if (v.startsWith(' ')) v = v.slice(1);
    if (campo === 'event') evento = v; else if (campo === 'data') dados.push(v);
  }
  if (!dados.length) return null;
  try { return { evento, dados: JSON.parse(dados.join('\n')) }; } catch (_) { return null; }
}
// o SSE de uma aba, lido como o ouvido-remoto.js do Edge vai ler (fetch + corpo em blocos)
function abrirSse(porta, aba) {
  const ctl = new AbortController();
  const eventos = [], ouvintes = new Set();
  const aberto = (async () => {
    const r = await fetch(`http://127.0.0.1:${porta}/api/ouvido/eventos?aba=${aba}`, { headers: { accept: 'text/event-stream' }, signal: ctl.signal });
    if (!r.ok || !r.body) return r.status;
    (async () => {
      const dec = new TextDecoder(); let buf = '';
      try {
        for await (const p of r.body) {
          buf += dec.decode(p, { stream: true });
          let k;
          while ((k = buf.indexOf('\n\n')) >= 0) {
            const ev = analisarSse(buf.slice(0, k)); buf = buf.slice(k + 2);
            if (ev) { ev.t = Date.now(); ev.i = eventos.length; eventos.push(ev); for (const f of [...ouvintes]) f(ev); }
          }
        }
      } catch (_) { /* fechado */ }
    })();
    return r.status;
  })().catch(() => 0);
  return {
    eventos, aberto, fechar: () => ctl.abort(),
    esperar(pred, ms) {
      return new Promise((res) => {
        const ja = eventos.find(pred);
        if (ja) { res(ja); return; }
        const f = (ev) => { if (pred(ev)) { clearTimeout(t); ouvintes.delete(f); res(ev); } };
        const t = setTimeout(() => { ouvintes.delete(f); res(null); }, ms);
        ouvintes.add(f);
      });
    },
  };
}
async function chamar(porta, metodo, rota, corpo, prazo = 200000) {
  const r = await fetch(`http://127.0.0.1:${porta}/api/ouvido/${rota}`, {
    method: metodo, headers: corpo !== undefined ? { 'content-type': 'application/json' } : {},
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(prazo),
  });
  let dados = null;
  try { dados = await r.json(); } catch (_) { /* sem corpo */ }
  return { status: r.status, dados };
}
const post = (porta, rota, corpo, prazo) => chamar(porta, 'POST', rota, corpo ?? {}, prazo);
async function ate(cond, ms, passo = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await cond()) return true; await esperar(passo); }
  return !!(await cond());
}
async function tamanhoSoda(pasta) {
  let total = 0;
  async function andar(p, dentro) {
    let itens;
    try { itens = await fsp.readdir(p, { withFileTypes: true }); } catch (_) { return; }
    for (const it of itens) {
      const f = path.join(p, it.name), soda = dentro || /soda/i.test(it.name);
      if (it.isDirectory()) await andar(f, soda);
      else if (soda) { try { total += (await fsp.stat(f)).size; } catch (_) { /* sumiu */ } }
    }
  }
  await andar(pasta, false);
  return total;
}
async function apagarPasta(p) {
  for (let i = 0; i < 10; i++) {
    try { await fsp.rm(p, { recursive: true, force: true }); return true; } catch (_) { await esperar(500); }
  }
  return false;
}
// voz pt-BR do Windows → .wav temporário (só quando o teste/fala-pt.wav não existe)
function gerarWav() {
  const saida = path.join(os.tmpdir(), `ouvido-fala-${process.pid}.wav`);
  const script = "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
    + "$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'pt-BR' } | Select-Object -First 1; "
    + "if (-not $v) { exit 3 }; $s.SelectVoice($v.VoiceInfo.Name); $s.SetOutputToWaveFile($env:OUVIDO_WAV); "
    + "$s.Speak('Jarvis, está tudo rodando hoje? Quais e-mails chegaram na caixa do TI?'); $s.Dispose()";
  return new Promise((res) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, timeout: 60000, env: { ...process.env, OUVIDO_WAV: saida } },
      () => { try { res(fs.statSync(saida).size > 10000 ? saida : null); } catch (_) { res(null); } });
  });
}
function rodarFilho(porta, modo) {
  const f = spawn(process.execPath, [ESTE, '--filho', String(porta), modo], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let saida = '';
  const pronto = new Promise((res) => {
    const t = setTimeout(() => res(false), 30000);
    f.stdout.on('data', (d) => { saida += d; if (/PRONTO|FALHOU/.test(saida)) { clearTimeout(t); res(/PRONTO/.test(saida)); } });
    f.once('exit', () => { clearTimeout(t); res(/PRONTO/.test(saida)); });
  });
  const saiu = new Promise((res) => f.once('exit', (c) => res(c)));
  f.stderr.on('data', () => {});
  return { f, pronto, saiu };
}

/* ---------------------------------------------------------------- o teste */
async function principal() {
  let falhas = 0, total = 0;
  const ok = (cond, msg) => { total++; console.log(`${cond ? 'OK  ' : 'FALHOU'} ${msg}`); if (!cond) falhas++; return !!cond; };
  const titulo = (t) => console.log(`\n== ${t}`);
  const logs = [];
  const registrar = (...a) => { const l = a.join(' '); logs.push(l); if (process.env.OUVIDO_LOG === '1') console.log(`      log: ${l}`); };
  const t00 = Date.now();

  titulo('achar o Chrome');
  const chrome = acharChrome();
  if (!chrome) { console.log('AVISO: não achei o Google Chrome neste computador; o teste do ouvido não roda aqui.'); process.exit(0); }
  ok(true, `achou o Chrome: ${chrome}`);
  ok(acharChrome() === chrome, 'guarda o achado (a segunda chamada devolve o mesmo)');
  ok(PERFIL_PADRAO.toLowerCase().endsWith(path.join('CerebroLube', 'ouvido-chrome').toLowerCase()) && !/onedrive/i.test(PERFIL_PADRAO),
    `perfil padrão em %LOCALAPPDATA%, fora do OneDrive (${PERFIL_PADRAO.replace(os.homedir(), '~')})`);
  ok(abaValida('abcd') && abaValida('a'.repeat(40)) && !abaValida('abc') && !abaValida('a b c d') && !abaValida('a'.repeat(41)) && !abaValida(null),
    'aba: 4 a 40 caracteres [A-Za-z0-9_-]');

  titulo('áudio do teste');
  let wav = path.join(AQUI, 'fala-pt.wav'), wavTemp = null;
  if (!fs.existsSync(wav)) { wav = await gerarWav(); wavTemp = wav; }
  const temFala = ok(!!wav, wav ? `áudio: ${wavTemp ? 'gerado com a voz pt-BR do Windows (temporário)' : 'teste/fala-pt.wav'} (${Math.round(fs.statSync(wav).size / 1024)} KB)` : 'sem áudio (sem voz pt-BR no Windows): a transcrição fica de fora');

  const servidor = criarServidorTeste(wav);
  await new Promise((r) => servidor.srv.listen(0, '127.0.0.1', r));
  const porta = servidor.srv.address().port;
  const base = { urlPagina: `http://localhost:${porta}/ouvido.html?teste=1`, origem: `http://localhost:${porta}` };
  const sobras = await matarPerfil(PERFIL_TESTE);   // um Chrome de teste esquecido por uma volta que caiu
  if (sobras) console.log(`   (fechei ${sobras} processo(s) do Chrome de teste que tinham sobrado)`);
  if (process.env.OUVIDO_PERFIL_LIMPO === '1') { await apagarPasta(PERFIL_TESTE); console.log('   (perfil de teste apagado: vai baixar o pacote de novo)'); }

  let ouvido = null, outro = null;
  const instancias = [];
  try {
    titulo('trava e entradas (o Chrome nem abre)');
    const travado = criarOuvidoChrome({ ...base, perfil: PERFIL_TESTE, podeLigar: () => false, permitirTeste: true, log: registrar });
    instancias.push(travado);
    servidor.usar(travado);
    try { await travado.ligar({ aba: 'testeTrava', teste: TESTE_WAV }); ok(false, 'ligar travado (não recusou)'); }
    catch (e) { ok(e instanceof ErroOuvido && e.codigo === 'trava' && e.status === 423, `ligar travado → ErroOuvido ${e.status} ${e.codigo}`); }
    let r = await post(porta, 'ligar', { aba: 'testeTrava', teste: TESTE_WAV });
    ok(r.status === 423 && r.dados?.erro === 'trava' && r.dados?.mensagem === TEXTOS.trava, `POST /api/ouvido/ligar travado → ${r.status} ${r.dados?.erro} ("${r.dados?.mensagem}")`);
    ok(travado.estado().estado === 'desligado', `travado: o Chrome não abriu (estado ${travado.estado().estado})`);
    r = await post(porta, 'ligar', { aba: 'x' });
    ok(r.status === 400 && r.dados?.erro === 'aba', `aba inválida → ${r.status} ${r.dados?.erro}`);
    r = await post(porta, 'ligar', { aba: 'testeIdioma', lang: 'es-ES' });
    ok(r.status === 400 && r.dados?.erro === 'idioma', `idioma sem pacote (es-ES) → ${r.status} ${r.dados?.erro}`);
    r = await chamar(porta, 'GET', 'eventos');
    ok(r.status === 400 && r.dados?.erro === 'aba', `SSE sem aba → ${r.status}`);
    r = await chamar(porta, 'GET', 'ligar');
    ok(r.status === 405, `GET no ligar → ${r.status}`);
    r = await post(porta, 'nada');
    ok(r.status === 404 && r.dados?.erro === 'rota', `rota desconhecida → ${r.status}`);
    r = await post(porta, 'pausar', { aba: 'testeNinguem' });
    ok(r.status === 200 && r.dados?.ok === true && r.dados?.ignorado === true, 'pausar sem ser dono → 200 {ignorado: true}');
    r = await chamar(porta, 'GET', 'estado');
    ok(r.status === 200 && r.dados?.ok === true && r.dados?.estado === 'desligado' && r.dados?.dono === null, `GET estado → ${r.dados?.estado}`);
    r = await fetch(`http://127.0.0.1:${porta}/api/ouvido/ligar`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'oi' }).then((x) => x.status);
    ok(r === 415, `corpo que não é JSON → ${r}`);
    await travado.desligar({ final: true });

    const semTeste = criarOuvidoChrome({ ...base, perfil: PERFIL_TESTE, log: registrar });   // permitirTeste: false (como no app)
    instancias.push(semTeste);
    try { await semTeste.ligar({ aba: 'testeSemTeste', teste: TESTE_WAV }); ok(false, 'teste sem permitirTeste (não recusou)'); }
    catch (e) { ok(e.codigo === 'teste' && e.status === 400 && semTeste.estado().estado === 'desligado', `{teste} sem permitirTeste → ${e.status} ${e.codigo}, sem abrir o Chrome (o microfone de verdade nunca abre aqui)`); }
    await semTeste.desligar({ final: true });
    ok(await contarProcessos(PERFIL_TESTE) === 0, 'nenhum Chrome com o perfil de teste até aqui');

    titulo('consentimento: sem pedido, o pacote não baixa');
    const perfilVazio = await fsp.mkdtemp(path.join(os.tmpdir(), 'ouvido-vazio-'));
    const vazio = criarOuvidoChrome({ ...base, perfil: perfilVazio, permitirTeste: true, log: registrar });
    instancias.push(vazio);
    servidor.usar(vazio);
    let t0 = Date.now();
    let e = await vazio.preparar();
    ok(e.estado === 'pronto' && e.pacote !== 'available', `perfil novo, preparar sem pedido: estado ${e.estado}, pacote ${e.pacote} (${seg(t0)} s)`);
    r = await post(porta, 'ligar', { aba: 'testeVazio', teste: TESTE_WAV });
    ok(r.status === 409 && r.dados?.erro === 'sem-pacote', `ligar sem o pacote → ${r.status} ${r.dados?.erro}`);
    ok(vazio.estado().dono === null, 'sem pacote: ninguém vira dono');
    const soda = await tamanhoSoda(perfilVazio);
    ok(soda < 1024 * 1024, `nada baixado no perfil novo (pastas SODA: ${(soda / 1048576).toFixed(1)} MB)`);
    await vazio.desligar({ final: true });
    ok(await contarProcessos(perfilVazio) === 0, 'o Chrome do perfil novo fechou');
    await apagarPasta(perfilVazio);

    titulo('preparar e baixar o pacote (pedido explícito)');
    const logsOuvido = [];
    ouvido = criarOuvidoChrome({ ...base, perfil: PERFIL_TESTE, permitirTeste: true, ociosoMs: 8000, log: (...a) => { logsOuvido.push(a.join(' ')); registrar(...a); } });
    instancias.push(ouvido);
    servidor.usar(ouvido);
    const sseA = abrirSse(porta, 'testeAbaA');
    ok(await sseA.aberto === 200, 'SSE da aba A aberto');
    t0 = Date.now();
    e = await ouvido.preparar();
    ok(e.estado === 'pronto', `preparar: Chrome escondido aberto e página carregada em ${seg(t0)} s (pacote ${e.pacote})`);
    if (e.pacote !== 'available') {
      t0 = Date.now();
      r = await post(porta, 'instalar', {});
      ok(r.status === 200 && r.dados?.pacote === 'available', `POST /api/ouvido/instalar → ${r.status}, pacote ${r.dados?.pacote} em ${seg(t0)} s (${(await tamanhoSoda(PERFIL_TESTE) / 1048576).toFixed(0)} MB no perfil)`);
      ok(sseA.eventos.some((x) => x.evento === 'estado' && x.dados.estado === 'instalando'), 'o SSE avisou "instalando"');
    } else console.log('   (o pacote já estava no perfil de teste: a instalação não rodou agora)');
    const comPacote = ok(ouvido.estado().pacote === 'available', `pacote pt-BR + en-US: ${ouvido.estado().pacote}`);

    if (temFala && comPacote) {
      titulo('ouvir o .wav: parciais, final, nível');
      t0 = Date.now();
      r = await post(porta, 'ligar', { aba: 'testeAbaA', teste: TESTE_WAV });
      ok(r.status === 200 && r.dados?.ok === true && Number.isInteger(r.dados?.ger), `ligar → ${r.status}, ger ${r.dados?.ger} (${Date.now() - t0} ms)`);
      const g1 = r.dados?.ger;
      const fin1 = await sseA.esperar((x) => x.evento === 'resultado' && x.dados.ger === g1 && norm(x.dados.final).includes('rodando'), 15000);
      ok(!!fin1, fin1 ? `final com "rodando" ${seg(t0)} s depois do ligar: "${fin1.dados.final.trim()}"` : 'nenhum final com "rodando" em 15 s');
      const doG1 = sseA.eventos.filter((x) => x.dados && x.dados.ger === g1);
      const ouvindo = doG1.find((x) => x.evento === 'estado' && x.dados.estado === 'ouvindo');
      ok(!!ouvindo, 'SSE: estado ouvindo');
      const parcial = doG1.find((x) => x.evento === 'resultado' && x.dados.parcial.trim());
      ok(!!parcial && fin1 && parcial.t <= fin1.t, parcial ? `parciais antes do final (o 1º ${parcial.t - ouvindo.t} ms depois do ouvindo; o .wav começa 300 ms depois)` : 'nenhum parcial');
      ok(doG1.some((x) => x.evento === 'fala' && x.dados.fase === 'inicio'), 'SSE: fala início');
      const niveis = doG1.filter((x) => x.evento === 'nivel');
      const dur = niveis.length > 1 ? (niveis[niveis.length - 1].t - niveis[0].t) / 1000 : 0;
      ok(niveis.length >= 20 && dur > 0 && niveis.length / dur >= 12, `nível: ${niveis.length} eventos em ${dur.toFixed(1)} s (${dur ? (niveis.length / dur).toFixed(1) : 0} por segundo)`);
      ok(niveis.every((x) => Buffer.from(x.dados.b, 'base64').length === 64 && Number.isFinite(x.dados.db)), 'cada nível: 64 bandas (base64) e dB');
      ok(niveis.some((x) => x.dados.db > -40) && niveis.some((x) => Buffer.from(x.dados.b, 'base64').some((v) => v > 30)), `o nível sobe com a fala (máx. ${Math.max(...niveis.map((x) => x.dados.db)).toFixed(1)} dB)`);
      e = ouvido.estado();
      ok(e.estado === 'ouvindo' && e.dono === 'testeAbaA' && e.ger === g1, `estado: ${e.estado}, dono ${e.dono}`);

      titulo('pausar: nada da geração velha depois');
      r = await post(porta, 'pausar', { aba: 'testeOutraX' });
      ok(r.dados?.ignorado === true && ouvido.estado().dono === 'testeAbaA', 'pausar de quem não é dono → ignorado (segue ouvindo)');
      r = await post(porta, 'pausar', { aba: 'testeAbaA' });
      ok(r.status === 200 && r.dados?.ok === true && !r.dados?.ignorado, 'pausar da dona → ok');
      const parado = await sseA.esperar((x) => x.evento === 'estado' && x.dados.estado === 'parado' && x.dados.ger === g1, 2000);
      ok(!!parado, 'SSE: estado parado');
      await esperar(4500);   // a 2ª frase do .wav ("quais e-mails…") viria agora
      const vazou = parado ? sseA.eventos.filter((x) => x.i > parado.i && (x.evento === 'resultado' || x.evento === 'nivel' || x.evento === 'fala')) : [];
      ok(parado && vazou.length === 0, `nada depois do parado (${vazou.length} eventos)`);
      e = ouvido.estado();
      ok(e.estado === 'pronto' && e.dono === null, `estado: ${e.estado}, dono ${e.dono}`);

      titulo('ligar de novo: geração nova');
      r = await post(porta, 'ligar', { aba: 'testeAbaA', teste: TESTE_WAV });
      const g2 = r.dados?.ger;
      ok(r.status === 200 && g2 > g1, `ligar → ger ${g2} (antes ${g1})`);
      const fin2 = await sseA.esperar((x) => x.evento === 'resultado' && x.dados.ger === g2 && norm(x.dados.final).includes('rodando'), 15000);
      ok(!!fin2, 'transcreveu de novo com a geração nova');
      ok(parado && !sseA.eventos.some((x) => x.i > parado.i && x.dados?.ger === g1), 'nenhum evento da geração velha depois de pausar');

      titulo('outra aba liga: a última vence');
      const sseB = abrirSse(porta, 'testeAbaB');
      ok(await sseB.aberto === 200, 'SSE da aba B aberto');
      r = await post(porta, 'ligar', { aba: 'testeAbaB', teste: TESTE_WAV });
      const g3 = r.dados?.ger;
      ok(r.status === 200 && g3 > g2, `aba B liga → ger ${g3}`);
      const outraAba = await sseA.esperar((x) => x.evento === 'estado' && x.dados.estado === 'parado' && x.dados.motivo === 'outra-aba', 2000);
      ok(!!outraAba && outraAba.dados.ger === g2, 'a aba A recebe parado (motivo outra-aba, com a geração dela)');
      ok(ouvido.estado().dono === 'testeAbaB', 'dona agora: aba B');
      const finB = await sseB.esperar((x) => x.evento === 'resultado' && x.dados.ger === g3 && norm(x.dados.final).includes('rodando'), 15000);
      ok(!!finB, 'a aba B recebe a transcrição');
      ok(outraAba && !sseA.eventos.some((x) => x.i > outraAba.i && (x.evento === 'resultado' || x.evento === 'nivel')), 'a aba A não recebe mais nada');

      titulo('o Chrome cai com a aba dona ouvindo: volta sozinho');
      const tQueda = Date.now();
      const mortos = await matarPerfil(PERFIL_TESTE);
      ok(mortos > 0, `derrubei o Chrome de teste (${mortos} processos)`);
      const volta = await sseB.esperar((x) => x.t > tQueda && x.evento === 'resultado' && x.dados.ger === g3 && norm(x.dados.final).includes('rodando'), 30000);
      ok(!!volta, volta ? `voltou e transcreveu de novo em ${seg(tQueda)} s (mesma geração ${g3})` : 'não voltou em 30 s');
      ok(logsOuvido.some((l) => l.includes('saiu sozinho')) && logsOuvido.some((l) => l.includes('voltou depois da queda')), 'o log conta a queda e a volta');

      titulo('a aba dona some (SSE fecha): o microfone fecha');
      const tSome = Date.now();
      sseB.fechar();
      const pausou = await ate(() => ouvido.estado().dono === null, 6000);
      ok(pausou && ouvido.estado().estado === 'pronto', `pausou ${seg(tSome)} s depois de a aba sumir (estado ${ouvido.estado().estado})`);
      ok(logsOuvido.some((l) => l.includes('a aba dona sumiu')), 'o log conta');
    } else console.log('   (sem áudio ou sem pacote: a transcrição ficou de fora)');

    titulo('segunda partida no mesmo perfil (código 21)');
    const logsOutro = [];
    outro = criarOuvidoChrome({ ...base, perfil: PERFIL_TESTE, permitirTeste: true, _semPreTrava: true, log: (...a) => { logsOutro.push(a.join(' ')); registrar(...a); } });
    instancias.push(outro);
    t0 = Date.now();
    e = await outro.preparar().catch((x) => ({ estado: `erro ${x.codigo}` }));
    ok(e.estado === 'pronto', `a segunda partida abre (${seg(t0)} s; estado ${e.estado})`);
    ok(logsOutro.some((l) => l.includes('código 21')), 'saiu com código 21 na primeira tentativa e foi tratado');
    const caiu = await ate(() => ouvido.estado().estado === 'caiu', 4000);
    ok(caiu, `o primeiro ouvido viu o Chrome dele sair (sem dono: não volta sozinho; estado ${ouvido.estado().estado})`);
    await outro.desligar({ final: true });
    ok(await contarProcessos(PERFIL_TESTE) === 0, '0 Chrome com o perfil de teste depois de desligar o segundo');

    titulo('sem uso: fecha sozinho');
    e = await ouvido.preparar();
    ok(e.estado === 'pronto', 'o primeiro ouvido abre de novo');
    const tOcioso = Date.now();
    sseA.fechar();
    const fechou = await ate(() => ouvido.estado().estado === 'desligado', 25000, 500);
    ok(fechou, `fechou sozinho ${seg(tOcioso)} s depois da última SSE fechar (ociosoMs 8 s)`);
    ok(await contarProcessos(PERFIL_TESTE) === 0, '0 Chrome com o perfil de teste');
    ok(!fs.existsSync(path.join(PERFIL_TESTE, 'lockfile')), 'o lockfile do perfil sumiu');

    titulo('o servidor sai: o Chrome sai junto');
    let filho = rodarFilho(porta, 'exit');
    ok(await filho.pronto, 'filho (process.exit, como o servidor no Ctrl+C) abriu o ouvido');
    await filho.saiu;
    let zerou = await ate(async () => await contarProcessos(PERFIL_TESTE) === 0, 4000, 300);
    ok(zerou, 'depois do process.exit: 0 Chrome (o gancho do exit mata a árvore)');
    filho = rodarFilho(porta, 'vivo');
    ok(await filho.pronto, 'filho (morte à força, como fechar a janela) abriu o ouvido');
    ok(await contarProcessos(PERFIL_TESTE) > 0, 'com o filho vivo, o Chrome dele está rodando');
    const tMorte = Date.now();
    filho.f.kill();   // no Windows: TerminateProcess, sem chance de rodar nada
    await filho.saiu;
    zerou = await ate(async () => await contarProcessos(PERFIL_TESTE) === 0, 6000, 300);
    ok(zerou, `depois da morte à força: 0 Chrome em ${seg(tMorte)} s (o pipe fechou e ele saiu sozinho)`);

    titulo('o log não leva texto falado');
    const tudo = norm(logs.join('\n'));
    ok(logs.length > 5 && !/rodando|caixa|e-mails|quais|chegaram/.test(tudo), `nenhuma palavra da fala no log (${logs.length} linhas)`);
  } catch (e) {
    ok(false, `o teste parou com erro: ${e && (e.codigo || e.name)} ${e && e.message}`);
  } finally {
    for (const o of instancias) { try { await o.desligar({ final: true }); } catch (_) { /* nada */ } }
    const sobrou = await matarPerfil(PERFIL_TESTE);
    if (sobrou) console.log(`   (fechei ${sobrou} processo(s) que sobraram)`);
    servidor.srv.closeAllConnections?.();
    servidor.srv.close();
    if (wavTemp) { try { fs.unlinkSync(wavTemp); } catch (_) { /* nada */ } }
  }

  console.log(`\n${total - falhas} de ${total} passaram${falhas ? ` — ${falhas} FALHARAM` : ''} (${seg(t00)} s)`);
  process.exit(falhas ? 1 : 0);
}

/* ---------------------------------------------------------------- partida (no fim: as ajudas acima já existem) */
async function modoFilho() {
  const porta = Number(process.argv[3]);
  const ouvido = criarOuvidoChrome({ urlPagina: `http://localhost:${porta}/ouvido.html?teste=1`, origem: `http://localhost:${porta}`, perfil: PERFIL_TESTE, permitirTeste: true });
  try {
    const e = await ouvido.preparar();
    console.log(`PRONTO ${e.estado}`);
  } catch (e) { console.log(`FALHOU ${e.codigo || e.message}`); process.exit(3); }
  if (process.argv[4] === 'exit') setTimeout(() => process.exit(0), 200);   // como o servidor.js no Ctrl+C
  else setInterval(() => {}, 1000);                                          // fica vivo até ser morto
}
if (process.argv[2] === '--filho') await modoFilho();
else await principal();
