/* Teste do ouvido remoto (web/js/ouvido-remoto.js) com um servidor DE MENTIRA que imita as rotas /api/ouvido/* e o SSE
   (docs/OUVIDO-E-ROSTO.md §3.3 e §4). Sem navegador, sem Chrome, sem microfone.
   node teste/testar-ouvido-remoto.js
   Prova: o SSE abre antes do ligar e leva o token; a ordem final → parcial; o ger velho é descartado e o novo, adotado;
   o nível chega como 64 bandas (o mesmo objeto, null quando fica velho); o pausar chega com keepalive; 423, 503, 409,
   401 e prazo viram o código certo; o SSE cai e volta (e liga de novo se o servidor esqueceu a dona); a queda do Chrome
   avisa e volta; outra aba; o aviso de instalação; e o vigia do ouvido antigo do Edge. */
import http from 'node:http';
import crypto from 'node:crypto';
import {
  criarOuvidoRemoto, analisarSse, criarVigiaVazio, vigiarEdge, TEXTOS_OUVIDO,
} from '../../web/js/ouvido-remoto.js';

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; console.log(`${cond ? 'OK  ' : 'FALHOU'} ${msg}`); if (!cond) falhas++; };
const titulo = (t) => console.log(`\n== ${t}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function ate(cond, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (cond()) return true; await esperar(10); }
  return !!cond();
}

/* ---------------------------------------------------------------- o servidor de mentira */
const TOKEN = crypto.randomBytes(24).toString('base64url');   // token de teste gerado agora
const S = {
  ger: 0, dono: null, estado: 'pronto', pacote: 'available',
  modo: 'ok',                 // ok | trava | sem-chrome | negado | mudo | instalando
  antes: null,                // (aba) => void: roda antes de responder ao ligar (manda eventos "adiantados")
  esquecerAoCair: false,      // quando o SSE da dona cai, o servidor solta a dona (como o servidor de verdade, depois de 2 s)
  sseModo: 'ok',              // ok | 503 | 401
  sses: new Map(), conexoes: 0, registro: [],
  prepararMs: 0,
};
function zerarServidor() {
  for (const r of S.sses.values()) { try { r.destroy(); } catch { /* nada */ } }
  Object.assign(S, { ger: S.ger, dono: null, estado: 'pronto', pacote: 'available', modo: 'ok', antes: null, esquecerAoCair: false, sseModo: 'ok', conexoes: 0, registro: [], prepararMs: 0, donoDepois: false });
  S.sses = new Map();
}
const enviar = (aba, ev, d) => { const r = S.sses.get(aba); if (r && !r.writableEnded && !r.destroyed) r.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`); };
const derrubar = (aba) => { const r = S.sses.get(aba); if (r) r.destroy(); };
const rotas = (nome) => S.registro.filter((x) => x.rota === nome);
const estadoServidor = () => ({ ok: true, estado: S.estado, pacote: S.pacote, ger: S.ger, dono: S.dono });

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname;
  const reg = { rota: `${req.method} ${p}`, t: performance.now(), token: req.headers['x-cerebro-token'] === TOKEN, accept: req.headers.accept || '', tipo: req.headers['content-type'] || '' };
  S.registro.push(reg);
  const json = (st, o) => { if (res.writableEnded) return; res.writeHead(st, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
  let corpo = null;
  if (req.method === 'POST') { let s = ''; for await (const c of req) s += c; try { corpo = JSON.parse(s || '{}'); } catch { corpo = null; } reg.corpo = corpo; }
  if (!reg.token || S.sseModo === '401') { json(401, { erro: 'token', mensagem: 'Falta o token desta página (x-cerebro-token).' }); return; }

  if (p === '/api/ouvido/eventos' && req.method === 'GET') {
    const aba = u.searchParams.get('aba');
    if (!aba) { json(400, { erro: 'aba', mensagem: 'Falta a aba.' }); return; }
    if (S.sseModo === '503') { json(503, { erro: 'erro', mensagem: 'fora' }); return; }
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': ok\n\n');
    S.sses.set(aba, res); S.conexoes++;
    res.on('close', () => {
      if (S.sses.get(aba) === res) S.sses.delete(aba);
      S.registro.push({ rota: 'sse-fechou', t: performance.now(), aba });
      if (S.esquecerAoCair && S.dono === aba) { S.dono = null; S.estado = 'pronto'; }
    });
    return;
  }
  if (p === '/api/ouvido/estado' && req.method === 'GET') { json(200, estadoServidor()); return; }
  if (p === '/api/ouvido/preparar' && req.method === 'POST') {
    if (S.modo === 'sem-chrome') { json(503, { erro: 'sem-chrome', mensagem: 'Sem Chrome.' }); return; }
    if (S.prepararMs) { S.estado = 'instalando'; S.pacote = 'downloading'; await esperar(S.prepararMs); S.estado = 'pronto'; S.pacote = 'available'; }
    json(200, estadoServidor());
    return;
  }
  if (p === '/api/ouvido/ligar' && req.method === 'POST') {
    const aba = corpo && corpo.aba;
    if (S.modo === 'trava') { json(423, { erro: 'trava', mensagem: 'O Jarvis está travado. Faça o reconhecimento do rosto.' }); return; }
    if (S.modo === 'sem-chrome') { json(503, { erro: 'sem-chrome', mensagem: 'Sem Chrome.' }); return; }
    if (S.modo === 'negado') { json(409, { erro: 'negado', mensagem: 'O Windows bloqueou o microfone.' }); return; }
    if (S.modo === 'mudo') return;   // nunca responde (o prazo do cliente vence)
    if (S.modo === 'instalando') {
      S.estado = 'instalando'; S.pacote = 'downloading';
      enviar(aba, 'estado', { estado: 'instalando', ger: S.ger, pacote: 'downloading' });
      await esperar(400);
      S.pacote = 'available';
    }
    const velho = S.dono;
    S.ger++;
    if (!S.donoDepois) S.dono = aba;
    S.estado = 'ouvindo';
    if (velho && velho !== aba) enviar(velho, 'estado', { estado: 'parado', motivo: 'outra-aba', ger: S.ger });
    if (S.antes) await S.antes(aba);
    if (S.donoDepois) S.dono = aba;   // como o servidor de verdade: vira a dona só depois de preparar o Chrome
    json(200, { ok: true, ger: S.ger });
    return;
  }
  if (p === '/api/ouvido/pausar' && req.method === 'POST') {
    const aba = corpo && corpo.aba;
    if (aba !== S.dono) { json(200, { ok: true, ignorado: true }); return; }
    S.dono = null; S.estado = 'pronto';
    json(200, { ok: true });
    return;
  }
  json(404, { erro: 'rota', mensagem: 'Rota desconhecida.' });
});
async function ligarServidor() {
  for (const porta of [8794, 0]) {
    try {
      await new Promise((r, j) => { servidor.once('error', j); servidor.listen(porta, '127.0.0.1', () => { servidor.off('error', j); r(); }); });
      return servidor.address().port;
    } catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
  }
  throw new Error('sem porta');
}
const PORTA = await ligarServidor();
const BASE = `http://127.0.0.1:${PORTA}`;

/* ---------------------------------------------------------------- quem ouve (o h do jarvis.js) e o fetch espião */
function coletor() {
  const log = [];
  const h = {
    parcial: (t) => log.push(['parcial', t]), final: (t) => log.push(['final', t]), estado: (e) => log.push(['estado', e]),
    erro: (c) => log.push(['erro', c]), aviso: (c, d) => log.push(['aviso', c, d]), fala: (f) => log.push(['fala', f]),
  };
  return { log, h, de: (tipo) => log.filter((x) => x[0] === tipo).map((x) => x[1]) };
}
const chamadas = [];
const espiao = (url, init = {}) => { chamadas.push({ url: String(url), init }); return fetch(url, init); };
const ABA = 'abaTeste01';
function novo(extra = {}) {
  const c = coletor();
  const O = criarOuvidoRemoto(c.h, null, { token: TOKEN, aba: ABA, base: BASE, fetch: espiao, ...extra });
  return { c, O };
}
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

/* ---------------------------------------------------------------- analisarSse */
titulo('analisarSse: o parser de blocos do SSE');
{
  const a = analisarSse('event: resultado\ndata: {"final":" oi","parcial":"","ger":3}');
  ok(a && a.evento === 'resultado' && a.dados.final === ' oi' && a.dados.ger === 3, 'evento + data JSON');
  ok(analisarSse(': ping') === null, 'comentário (: ping) não é evento');
  ok(analisarSse(': ok\n') === null, 'comentário com quebra não é evento');
  const b = analisarSse('event: estado\r\ndata: {"estado":\r\ndata: "ouvindo"}');
  ok(b && b.evento === 'estado' && b.dados.estado === 'ouvindo', 'CRLF e data em duas linhas');
  ok(analisarSse('event: nivel\ndata: {quebrado') === null, 'JSON quebrado é descartado');
  const c = analisarSse('event: fim');
  ok(c && c.evento === 'fim' && Object.keys(c.dados).length === 0, 'evento sem data vem com dados vazios');
  ok(analisarSse('data: 5').dados && typeof analisarSse('data: 5').dados === 'object', 'data que não é objeto vira {}');
}

/* ---------------------------------------------------------------- o contrato do criarOuvido */
titulo('a mesma cara do criarOuvido do jarvis.js');
{
  const { O } = novo();
  for (const k of ['suportado', 'ativo', 'ouvindo']) ok(typeof O[k] === 'boolean', `O.${k} é booleano`);
  for (const k of ['ligar', 'pausar', 'nivel', 'destruir', 'preparar', 'consultar', 'precisaBaixar', 'estadoRemoto']) ok(typeof O[k] === 'function', `O.${k}() existe`);
  ok(O.remoto === true && O.suportado === true && O.ativo === false && O.ouvindo === false, 'começa suportado, parado, remoto');
  ok(O.nivel() === null, 'nivel() é null antes de ligar');
  const semToken = criarOuvidoRemoto({}, null, { aba: ABA, base: BASE, fetch: espiao });
  ok(semToken.suportado === false, 'sem token: não suportado');
  let cod = '';
  try { await semToken.ligar(); } catch (e) { cod = e.codigo; }
  ok(cod === 'sem-suporte', `sem token: ligar lança sem-suporte (${cod})`);
  ok(criarOuvidoRemoto({}, null, { token: TOKEN, aba: 'x', base: BASE }).suportado === false, 'aba inválida: não suportado');
  for (const k of ['sem-chrome', 'instalando', 'pacote-falhou', 'negado', 'caiu', 'trava', 'reiniciado', 'edge-vazio', 'baixar']) ok(typeof TEXTOS_OUVIDO[k] === 'string' && TEXTOS_OUVIDO[k].length > 10, `texto para ${k}`);
}

/* ---------------------------------------------------------------- ligar, eventos, nível, pausar */
titulo('ligar: SSE antes, resultado, nível, ger velho, pausar com keepalive');
{
  zerarServidor(); chamadas.length = 0;
  const { c, O } = novo();
  await O.ligar();
  const sseT = rotas('GET /api/ouvido/eventos')[0], ligT = rotas('POST /api/ouvido/ligar')[0];
  ok(sseT && ligT && sseT.t < ligT.t, 'o SSE abriu antes do POST /ligar');
  ok(sseT && sseT.token && /text\/event-stream/.test(sseT.accept), 'o SSE leva o x-cerebro-token e accept: text/event-stream');
  ok(ligT && ligT.corpo && ligT.corpo.aba === ABA && ligT.corpo.lang === 'pt-BR' && /application\/json/.test(ligT.tipo), 'o ligar manda {aba, lang} em JSON');
  ok(O.ativo === true, 'ativo depois do ligar');
  const g = S.ger;
  enviar(ABA, 'estado', { estado: 'ouvindo', ger: g });
  ok(await ate(() => O.ouvindo), 'estado ouvindo → O.ouvindo');
  ok(c.de('estado').includes('ouvindo'), 'h.estado("ouvindo")');
  enviar(ABA, 'resultado', { final: '', parcial: ' Jarvis está', ger: g });
  enviar(ABA, 'resultado', { final: ' Jarvis está tudo rodando hoje ', parcial: ' quais', ger: g });
  ok(await ate(() => c.de('final').length === 1), 'um final chegou');
  const seq = c.log.filter((x) => x[0] === 'final' || x[0] === 'parcial').map((x) => `${x[0]}:${x[1]}`);
  ok(JSON.stringify(seq) === JSON.stringify(['parcial:Jarvis está', 'final:Jarvis está tudo rodando hoje', 'parcial:quais']), `ordem final → parcial e texto aparado (${seq.join(' | ')})`);
  // nível: 64 bytes 0..252 → bandas ÷ 255
  const bytes = Array.from({ length: 64 }, (_, i) => i * 4);
  enviar(ABA, 'nivel', { b: b64(bytes), db: -21.5, ger: g });
  ok(await ate(() => O.nivel() !== null), 'nivel() deixa de ser null com o evento nivel');
  const n1 = O.nivel();
  ok(n1.bandas instanceof Float32Array && n1.bandas.length === 64, 'nivel().bandas é Float32Array(64)');
  ok(Math.abs(n1.bandas[10] - 40 / 255) < 1e-6 && Math.abs(n1.bandas[63] - 252 / 255) < 1e-6 && n1.bandas[0] === 0, 'bandas = byte ÷ 255');
  ok(n1.db === -21.5, 'db vem do evento');
  ok(O.nivel() === n1, 'nivel() devolve o mesmo objeto (sem alocar)');
  await esperar(360);
  ok(O.nivel() === null, 'nivel() volta a null depois de 300 ms sem nível');
  // ger velho
  enviar(ABA, 'resultado', { final: 'ger velho', parcial: '', ger: g - 1 });
  enviar(ABA, 'nivel', { b: b64(bytes), db: -10, ger: g - 1 });
  enviar(ABA, 'resultado', { final: 'ger certo', parcial: '', ger: g });
  ok(await ate(() => c.de('final').includes('ger certo')), 'resultado do ger atual chega');
  ok(!c.de('final').includes('ger velho'), 'resultado de ger velho é descartado');
  ok(O.nivel() === null, 'nível de ger velho é descartado');
  enviar(ABA, 'fala', { fase: 'inicio', ger: g });
  ok(await ate(() => c.de('fala').includes('inicio')), 'evento fala → h.fala("inicio")');
  // pausar
  chamadas.length = 0;
  O.pausar();
  ok(O.ativo === false && O.ouvindo === false, 'pausar: ativo e ouvindo falsos na hora');
  ok(await ate(() => rotas('POST /api/ouvido/pausar').length === 1), 'o POST /pausar chegou');
  const pz = rotas('POST /api/ouvido/pausar')[0];
  ok(pz && pz.corpo && pz.corpo.aba === ABA && pz.token, 'o pausar leva {aba} e o token');
  const chPausar = chamadas.find((x) => x.url.endsWith('/api/ouvido/pausar'));
  ok(chPausar && chPausar.init.keepalive === true, 'o pausar vai com keepalive: true');
  ok(await ate(() => rotas('sse-fechou').length >= 1), 'o SSE fechou');
  ok(await ate(() => c.de('estado').at(-1) === 'parado'), 'h.estado("parado") depois do pausar');
  ok(S.dono === null, 'o servidor soltou a dona');
  const antes = c.log.length;
  O.pausar();
  await esperar(60);
  ok(rotas('POST /api/ouvido/pausar').length === 1 && c.log.length === antes, 'pausar de novo não manda nada nem chama ninguém');
}

/* ---------------------------------------------------------------- eventos antes da resposta e religar com ger novo */
titulo('eventos adiantados (antes da resposta do ligar) e religar descartando a sessão velha');
{
  zerarServidor();
  const { c, O } = novo();
  S.antes = async (aba) => { enviar(aba, 'estado', { estado: 'ouvindo', ger: S.ger }); enviar(aba, 'resultado', { final: 'adiantado', parcial: '', ger: S.ger }); await esperar(80); };
  await O.ligar();
  ok(await ate(() => c.de('final').includes('adiantado')), 'resultado que chegou antes da resposta do ligar não se perde');
  const g1 = S.ger;
  O.pausar();
  await ate(() => rotas('POST /api/ouvido/pausar').length === 1);
  S.antes = async (aba) => { enviar(aba, 'resultado', { final: 'sessao velha', parcial: '', ger: g1 }); await esperar(50); };
  await O.ligar();
  enviar(ABA, 'resultado', { final: 'sessao velha 2', parcial: '', ger: g1 });
  enviar(ABA, 'resultado', { final: 'sessao nova', parcial: '', ger: S.ger });
  ok(await ate(() => c.de('final').includes('sessao nova')), 'resultado da sessão nova chega');
  ok(!c.de('final').some((t) => t.startsWith('sessao velha')), 'nada da sessão velha passa depois de religar (nem adiantado)');
  O.pausar();
  await esperar(50);
}

/* ---------------------------------------------------------------- códigos de erro do ligar */
titulo('ligar: 423, 503, 409, 401, prazo e pausar no meio');
{
  for (const [modo, esperado] of [['trava', 'trava'], ['negado', 'negado'], ['sem-chrome', 'sem-chrome']]) {
    zerarServidor(); S.modo = modo;
    const { O } = novo();
    let cod = '';
    try { await O.ligar(); } catch (e) { cod = e.codigo; }
    ok(cod === esperado, `${modo}: ligar lança ${esperado} (${cod})`);
    ok(O.ativo === false && O.ouvindo === false, `${modo}: fica parado`);
    ok(await ate(() => rotas('sse-fechou').length >= 1), `${modo}: o SSE fechou`);
    if (modo === 'sem-chrome') {
      ok(O.suportado === false, 'sem-chrome: O.suportado = false (a interface esconde o microfone ou volta ao ouvido do Edge)');
      let c2 = ''; try { await O.ligar(); } catch (e) { c2 = e.codigo; }
      ok(c2 === 'sem-chrome', 'sem-chrome: o próximo ligar nem chama o servidor');
    }
    if (modo === 'trava') {
      S.modo = 'ok';
      await O.ligar();
      ok(O.ativo === true, 'trava: depois de liberar, o mesmo ouvido liga');
      O.pausar(); await esperar(50);
    }
  }
  // 401: o servidor reiniciou (token novo)
  zerarServidor();
  {
    const c = coletor();
    const O = criarOuvidoRemoto(c.h, null, { token: 'token-velho-de-outra-partida', aba: ABA, base: BASE, fetch: espiao });
    let cod = '';
    try { await O.ligar(); } catch (e) { cod = e.codigo; }
    ok(cod === 'reiniciado', `401 no SSE: ligar lança reiniciado (${cod})`);
    ok(rotas('POST /api/ouvido/ligar').length === 0, '401: nem tenta o POST /ligar');
    ok(rotas('POST /api/ouvido/pausar').every((x) => !x.token), '401: não insiste com pausar autenticado');
  }
  // 404: servidor sem o ouvido do Chrome
  {
    const c = coletor();
    const O = criarOuvidoRemoto(c.h, null, { token: TOKEN, aba: ABA, base: `${BASE}/velho`, fetch: espiao });
    let cod = '';
    try { await O.ligar(); } catch (e) { cod = e.codigo; }
    ok(cod === 'sem-rota' && O.suportado === false, `404: sem-rota e não suportado (${cod})`);
  }
  // servidor fora do ar
  {
    const c = coletor();
    const O = criarOuvidoRemoto(c.h, null, { token: TOKEN, aba: ABA, base: 'http://127.0.0.1:1', fetch: espiao });
    let cod = '';
    try { await O.ligar(); } catch (e) { cod = e.codigo; }
    ok(cod === 'sem-app', `app fora do ar: sem-app (${cod})`);
  }
  // prazo
  zerarServidor(); S.modo = 'mudo';
  {
    const { O } = novo({ prazoLigarMs: 300 });
    let cod = '';
    try { await O.ligar(); } catch (e) { cod = e.codigo; }
    ok(cod === 'prazo', `ligar sem resposta: prazo (${cod})`);
    ok(await ate(() => rotas('POST /api/ouvido/pausar').length >= 1), 'prazo: manda pausar (o servidor pode ter virado a dona depois)');
  }
  // pausar com o ligar no meio: sem erro, e o pausar vale quando o ligar volta
  zerarServidor();
  {
    const { O } = novo();
    S.donoDepois = true;
    S.antes = async () => { await esperar(250); };
    const p = O.ligar();
    await ate(() => rotas('POST /api/ouvido/ligar').length === 1);
    O.pausar();
    await ate(() => rotas('POST /api/ouvido/pausar').length === 1);
    ok(S.dono === null, 'o primeiro pausar chega antes de o servidor virar a dona (é ignorado)');
    let lancou = false;
    try { await p; } catch { lancou = true; }
    ok(!lancou, 'pausar no meio do ligar: o ligar termina sem erro');
    ok(await ate(() => rotas('POST /api/ouvido/pausar').length >= 2 && S.dono === null), 'e o pausar de novo, depois da resposta, solta a dona');
    ok(O.ativo === false, 'continua parado');
  }
  // dois ligar seguidos: um POST só
  zerarServidor();
  {
    const { O } = novo();
    await Promise.all([O.ligar(), O.ligar()]);
    ok(rotas('POST /api/ouvido/ligar').length === 1, 'dois ligar() juntos: um POST /ligar só');
    O.pausar(); await esperar(50);
  }
}

/* ---------------------------------------------------------------- o SSE cai e volta */
titulo('o SSE cai e volta');
{
  zerarServidor();
  const { c, O } = novo();
  await O.ligar();
  enviar(ABA, 'estado', { estado: 'ouvindo', ger: S.ger });
  await ate(() => O.ouvindo);
  derrubar(ABA);
  ok(await ate(() => c.de('aviso').includes('reconectando')), 'aviso reconectando');
  ok(await ate(() => S.conexoes === 2, 3000), 'reconectou o SSE');
  ok(await ate(() => O.ouvindo), 'o servidor ainda me tinha como dona: volta a ouvindo sem novo ligar');
  ok(rotas('POST /api/ouvido/ligar').length === 1, 'sem POST /ligar a mais');
  enviar(ABA, 'resultado', { final: 'depois da volta', parcial: '', ger: S.ger });
  ok(await ate(() => c.de('final').includes('depois da volta')), 'resultados voltam a chegar');
  // agora o servidor esquece a dona quando o SSE cai (o servidor de verdade pausa 2 s depois)
  S.esquecerAoCair = true;
  derrubar(ABA);
  ok(await ate(() => rotas('POST /api/ouvido/ligar').length === 2, 4000), 'servidor sem dona depois da queda: liga de novo sozinho');
  ok(S.dono === ABA, 'e volta a ser a dona');
  enviar(ABA, 'resultado', { final: 'religado', parcial: '', ger: S.ger });
  ok(await ate(() => c.de('final').includes('religado')), 'o ger novo do religar vale');
  ok(!c.de('erro').length, 'nenhum h.erro na queda e volta');
  O.pausar(); await esperar(50);
}
titulo('o SSE não volta: 401 (app reiniciado) e app fora por muito tempo');
{
  zerarServidor();
  const { c, O } = novo();
  await O.ligar();
  S.sseModo = '401';
  derrubar(ABA);
  ok(await ate(() => c.de('erro').includes('reiniciado'), 3000), '401 na reconexão → h.erro("reiniciado")');
  ok(O.ativo === false, 'e para');
  zerarServidor();
  const x = novo({ tempos: { semApp: 600 } });
  await x.O.ligar();
  S.sseModo = '503';
  derrubar(ABA);
  ok(await ate(() => x.c.de('erro').includes('sem-app'), 5000), 'SSE fora por mais que o limite → h.erro("sem-app")');
  ok(x.O.ativo === false, 'e para');
}

/* ---------------------------------------------------------------- queda do Chrome, outra aba, erro da página, instalação */
titulo('queda do Chrome (caiu), outra aba, erro da página e instalação');
{
  zerarServidor();
  const { c, O } = novo();
  await O.ligar();
  enviar(ABA, 'estado', { estado: 'ouvindo', ger: S.ger });
  await ate(() => O.ouvindo);
  enviar(ABA, 'estado', { estado: 'caiu', ger: S.ger });
  ok(await ate(() => c.de('aviso').includes('caiu')), 'estado caiu → h.aviso("caiu") (sem parar: o servidor religa)');
  ok(O.ouvindo === false && O.ativo === true && c.de('estado').at(-1) === 'parado', 'parado, mas ainda ligado');
  // o servidor religou o Chrome sozinho, com ger novo
  S.ger++;
  enviar(ABA, 'estado', { estado: 'ouvindo', ger: S.ger });
  enviar(ABA, 'resultado', { final: 'voltei', parcial: '', ger: S.ger });
  ok(await ate(() => c.de('final').includes('voltei')), 'o ger novo da religada do servidor é adotado');
  ok(O.ouvindo === true && !c.de('erro').length, 'volta a ouvindo sem erro');
  enviar(ABA, 'erro', { codigo: 'caiu', mensagem: 'parou', ger: S.ger });
  ok(await ate(() => c.de('erro').includes('caiu')), 'erro caiu (3 quedas) → h.erro("caiu")');
  ok(O.ativo === false, 'e para');
}
{
  zerarServidor();
  const x = novo({ tempos: { caiu: 500, religarAposCaiu: 150 } });
  await x.O.ligar();
  enviar(ABA, 'estado', { estado: 'ouvindo', ger: S.ger });
  await ate(() => x.O.ouvindo);
  enviar(ABA, 'estado', { estado: 'caiu', ger: S.ger });
  await esperar(30);
  enviar(ABA, 'estado', { estado: 'pronto', ger: S.ger });   // o Chrome voltou, a sessão não
  ok(await ate(() => rotas('POST /api/ouvido/ligar').length === 2, 2000), 'caiu e voltou só "pronto": liga de novo sozinho');
  enviar(ABA, 'estado', { estado: 'ouvindo', ger: S.ger });
  ok(await ate(() => x.O.ouvindo), 'e volta a ouvindo');
  x.O.pausar(); await esperar(50);
  zerarServidor();
  const y = novo({ tempos: { caiu: 300, religarAposCaiu: 10000 } });
  await y.O.ligar();
  enviar(ABA, 'estado', { estado: 'caiu', ger: S.ger });
  ok(await ate(() => y.c.de('erro').includes('caiu'), 2000), 'caiu e não voltou no prazo → h.erro("caiu")');
}
{
  zerarServidor();
  const a = novo();
  await a.O.ligar();
  const outro = criarOuvidoRemoto(coletor().h, null, { token: TOKEN, aba: 'outraAba02', base: BASE, fetch: espiao });
  await outro.ligar();
  ok(await ate(() => a.c.de('erro').includes('outra-aba')), 'outra aba ligou: a velha recebe h.erro("outra-aba")');
  ok(a.O.ativo === false && S.dono === 'outraAba02', 'a velha para; a nova é a dona');
  outro.pausar(); await esperar(50);
}
{
  zerarServidor();
  const { c, O } = novo();
  await O.ligar();
  enviar(ABA, 'erro', { codigo: 'no-speech', ger: S.ger });
  enviar(ABA, 'erro', { codigo: 'network', ger: S.ger });
  ok(await ate(() => c.de('erro').includes('network')), 'erro network → h.erro("network") sem parar');
  ok(O.ativo === true && !c.de('erro').includes('no-speech'), 'no-speech é ignorado');
  enviar(ABA, 'erro', { codigo: 'negado', ger: S.ger - 1 });
  await esperar(80);
  ok(!c.de('erro').includes('negado'), 'erro de ger velho é ignorado');
  enviar(ABA, 'erro', { codigo: 'audio-capture', ger: S.ger });
  ok(await ate(() => c.de('erro').includes('audio-capture')), 'erro audio-capture → h.erro');
  ok(O.ativo === false, 'e para');
  ok(await ate(() => rotas('POST /api/ouvido/pausar').length >= 1), 'e avisa o servidor (pausar)');
}
{
  zerarServidor(); S.modo = 'instalando';
  const { c, O } = novo();
  await O.ligar();
  const av = c.log.filter((x) => x[0] === 'aviso' && x[1] === 'instalando');
  ok(av.length === 1, `estado instalando no SSE → h.aviso("instalando") uma vez (${av.length})`);
  O.pausar(); await esperar(50);
}
{
  zerarServidor(); S.prepararMs = 1800; S.pacote = 'downloadable';
  const { c, O } = novo();
  const e0 = await O.consultar();
  ok(e0 && O.precisaBaixar() === true && O.estadoRemoto() === 'pronto', 'consultar: pacote downloadable → precisaBaixar()');
  const e = await O.preparar();
  ok(e && e.pacote === 'available' && O.precisaBaixar() === false, 'preparar: devolve o estado com o pacote instalado');
  ok(c.de('aviso').includes('instalando'), 'preparar demorado: h.aviso("instalando") pelo estado');
  ok(rotas('GET /api/ouvido/estado').length >= 2, 'preparar confere o estado enquanto espera');
  zerarServidor(); S.modo = 'sem-chrome';
  const z = novo();
  ok((await z.O.preparar()) === null && z.O.suportado === false && z.O.motivo === 'sem-chrome', 'preparar sem Chrome: null, não suportado, motivo sem-chrome');
}

/* ---------------------------------------------------------------- o vigia do ouvido antigo do Edge */
titulo('vigia do ouvido antigo do Edge (resultado final vazio)');
const res = (lista, ini = 0) => ({ resultIndex: ini, results: lista.map(([t, fin]) => Object.assign([{ transcript: t }], { isFinal: fin })) });
{
  let t = 0, disparos = 0;
  const v = criarVigiaVazio({ aoVazio: () => disparos++, agora: () => t });
  const falar = (ms, db = -20) => { for (let k = 0; k < ms; k += 16) { t += 16; v.nivel(db); } };
  const calar = (ms) => falar(ms, -60);
  falar(800); v.resultado(res([['', true]]));
  falar(800); v.resultado(res([['', true]]));
  ok(v.vazios === 2 && disparos === 0, 'dois finais vazios com fala: ainda não avisa');
  falar(800); v.resultado(res([['', true]]));
  ok(disparos === 1 && v.disparou, 'o terceiro final vazio com fala avisa');
  falar(800); v.resultado(res([['', true]]));
  ok(disparos === 1, 'avisa uma vez só');
  v.zerar();
  calar(3000); v.resultado(res([['', true]])); calar(3000); v.resultado(res([['', true]])); calar(3000); v.resultado(res([['', true]]));
  ok(v.vazios === 0 && disparos === 1, 'final vazio em silêncio (o Edge 155 manda até sem som) não conta');
  falar(800); v.resultado(res([['', true]])); falar(800); v.resultado(res([['', true]]));
  falar(800); v.resultado(res([['jarvis', false]]));
  falar(800); v.resultado(res([['', true]]));
  ok(v.vazios === 1 && disparos === 1, 'um parcial com texto zera a conta');
  falar(800); v.resultado(res([['oi jarvis', true]]));
  ok(v.vazios === 0, 'um final com texto zera a conta');
  falar(100); v.resultado(res([['', true]]));
  ok(v.vazios === 0, 'menos de 250 ms de voz não conta como fala');
}
{
  let disparos = 0;
  const v = criarVigiaVazio({ aoVazio: () => disparos++ });
  v.fala('inicio');
  v.resultado(res([['', true]])); v.resultado(res([['', true]])); v.resultado(res([['', true]]));
  ok(disparos === 1, 'sem medidor: vale o speechstart');
  v.zerar(); v.fala('fim');
  v.resultado(res([['', true]])); v.resultado(res([['', true]])); v.resultado(res([['', true]]));
  ok(disparos === 1, 'sem medidor e depois do speechend: não conta');
}
{
  // vigiarEdge troca o construtor por uma subclasse que liga o vigia (um SpeechRecognition de mentira)
  class FalsoSR extends EventTarget { constructor() { super(); this.lang = ''; } start() {} static available() { return 'ok-estatico'; } }
  const janela = { webkitSpeechRecognition: FalsoSR };
  janela.SpeechRecognition = FalsoSR;   // o Edge tem os dois nomes para o mesmo construtor
  let avisos = 0, db = -20;
  const W = vigiarEdge({ janela, aoVazio: () => avisos++, nivel: () => ({ db }) });
  ok(janela.SpeechRecognition !== FalsoSR && janela.SpeechRecognition === janela.webkitSpeechRecognition, 'os dois nomes viram a mesma subclasse');
  ok(janela.webkitSpeechRecognition.available() === 'ok-estatico', 'os métodos estáticos (available, install) continuam');
  const rec = new janela.webkitSpeechRecognition();
  ok(rec instanceof FalsoSR && rec.lang === '', 'o reconhecedor criado é o de verdade (subclasse)');
  const ev = (tipo, extra = {}) => Object.assign(new Event(tipo), extra);
  rec.dispatchEvent(ev('start'));
  for (let i = 0; i < 3; i++) { await esperar(600); rec.dispatchEvent(ev('result', res([['', true]]))); }
  ok(avisos === 1, 'três finais vazios com o medidor alto (lido de 100 em 100 ms) → aoVazio');
  rec.dispatchEvent(ev('end'));
  W.vigia.zerar(); db = -70;
  rec.dispatchEvent(ev('start'));
  for (let i = 0; i < 3; i++) { await esperar(600); rec.dispatchEvent(ev('result', res([['', true]]))); }
  ok(avisos === 1, 'com o medidor em silêncio: não avisa');
  rec.dispatchEvent(ev('end'));
  const Sub = janela.SpeechRecognition;
  const W2 = vigiarEdge({ janela, aoVazio: () => {} });
  ok(janela.SpeechRecognition === Sub && janela.webkitSpeechRecognition === Sub, 'chamar de novo não embrulha duas vezes');
  W2.desfazer(); W.desfazer();
  ok(janela.SpeechRecognition === FalsoSR && janela.webkitSpeechRecognition === FalsoSR, 'desfazer() devolve os construtores originais');
}

/* ---------------------------------------------------------------- fim */
servidor.closeAllConnections?.();
servidor.close();
console.log(`\n${total - falhas} de ${total} OK${falhas ? ` — ${falhas} FALHARAM` : ''}`);
process.exit(falhas ? 1 : 0);
