/* Teste da trava do rosto (rosto.js) com descritores SINTÉTICOS, numa pasta temporária: nenhum rosto de verdade, nenhuma
   câmera, nada no %LOCALAPPDATA%. O relógio é injetado (desafio que vence, bloqueio de 10 min, virada do dia em Brasília).
   O Windows Hello é testado duas vezes: com um WebAuthn falso injetado e com o @simplewebauthn/server de verdade contra
   um autenticador de software (chave P-256 gerada agora, só na memória).
   node teste/testar-rosto.js */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  criarRosto, distancia, conferirDescritores, avaliarCadastro, conferirProva, validarDescritor, diaSP,
  PASTA_PADRAO, PASTA_SIMULADO, DIMENSAO, LIMIAR, FALHAS_ATE_HELLO,
} from '../rosto.js';

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; console.log(`${cond ? 'OK  ' : 'FALHOU'} ${msg}`); if (!cond) falhas++; };
const titulo = t => console.log(`\n== ${t}`);

/* ---------- descritores sintéticos (sorteio com semente: o teste dá sempre o mesmo resultado) ---------- */
let semente = Number(process.env.ROSTO_SEMENTE) || 20261019;   // ROSTO_SEMENTE=<n> sorteia outros vetores
function sorteio() {   // mulberry32
  semente = (semente + 0x6D2B79F5) | 0;
  let t = semente;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const gauss = () => Math.sqrt(-2 * Math.log(1 - sorteio())) * Math.cos(2 * Math.PI * sorteio());
const arred = v => v.map(x => Math.round(x * 1e6) / 1e6);          // como a página manda
function direcao(norma) {
  const v = Array.from({ length: DIMENSAO }, gauss);
  const n = Math.hypot(...v);
  return v.map(x => x * norma / n);
}
const somar = (a, b) => a.map((x, i) => x + b[i]);
const entre = (a, b) => a + (b - a) * sorteio();
const perto = (base, min, max) => arred(somar(base, direcao(entre(min, max))));

const pessoa = direcao(1.45);
const amostras = Array.from({ length: 8 }, () => perto(pessoa, 0.15, 0.30));
const parecida = somar(pessoa, direcao(0.50));
const outra = direcao(1.45);
const consultasDe = (base, n = 3) => Array.from({ length: n }, () => perto(base, 0.10, 0.20));

/* ---------- relógio, pastas e log ---------- */
let relogio = Date.parse('2026-10-19T12:00:00-03:00');
const agora = () => new Date(relogio);
const passar = ms => { relogio += ms; };
const RAIZ = await fsp.mkdtemp(path.join(os.tmpdir(), 'cerebro-rosto-'));
const linhasLog = [];
const log = (...a) => linhasLog.push(a.join(' '));

function fotoPasta(p) {   // nomes e datas da pasta de verdade, para provar que o teste não mexe nela
  try { return fs.readdirSync(p).map(n => `${n}:${fs.statSync(path.join(p, n)).mtimeMs}`).sort().join('|'); }
  catch (e) { return `sem pasta (${e.code})`; }
}
const padraoAntes = fotoPasta(PASTA_PADRAO);

/* ---------- chamar as rotas como o servidor.js chama (ctx com lerCorpoJson, json, erro) ---------- */
async function chamar(r, metodo, rota, corpo) {
  const res = { headersSent: false, st: 0, c: null };
  const ctx = {
    req: { method: metodo, corpo }, res, url: new URL(`http://localhost:8790/api/rosto/${rota}`), metodo,
    lerCorpoJson: async q => { if (q.corpo instanceof Error) throw q.corpo; return q.corpo ?? {}; },
    json: (rr, st, obj) => { rr.st = st; rr.c = JSON.parse(JSON.stringify(obj)); rr.headersSent = true; },
    erro: (rr, st, mensagem, codigo) => ctx.json(rr, st, { erro: codigo || 'erro', mensagem }),
  };
  const tratou = await r.tratar(ctx);
  return { tratou, st: res.st, c: res.c || {} };
}
const respostas = [];   // tudo o que as rotas devolveram (para conferir que nenhum descritor sai)
async function rota(r, metodo, nome, corpo) {
  const x = await chamar(r, metodo, nome, corpo);
  respostas.push(JSON.stringify(x.c));
  return x;
}

function provaCom(n, { dur = 150, inicio = 1000, passo = 500, fps = 30, quadros = 150 } = {}) {
  return { piscadas: Array.from({ length: n }, (_, i) => ({ ini: inicio + i * passo, fim: inicio + i * passo + dur })), quadros, fps };
}
/* pede o desafio, "espera" 5 s (o tempo das piscadas) e manda a conferência */
async function tentar(r, consultas, { extra = 0, dur, fps, espera = 5000 } = {}) {
  const d = await rota(r, 'POST', 'desafio', {});
  if (d.st !== 200) return { d, x: d };
  passar(espera);
  const x = await rota(r, 'POST', 'conferir', { desafio: d.c.id, descritores: consultas, prova: provaCom(d.c.piscadas + extra, { dur, fps }) });
  return { d, x };
}
const existe = p => fs.existsSync(p);

try {
  /* ================================================================ a conta */
  titulo('a conta (distância, decisão, cadastro, piscar, dia)');
  const z = Array(DIMENSAO).fill(0), tq = Array(DIMENSAO).fill(0);
  tq[0] = 3; tq[1] = 4;
  ok(distancia(pessoa, pessoa) === 0, 'distância de um vetor para ele mesmo é 0');
  ok(distancia(amostras[0], amostras[1]) === distancia(amostras[1], amostras[0]), 'a distância é simétrica');
  ok(distancia(z, tq) === 5, 'conta feita à mão: (3, 4, 0…) até a origem = 5');
  let lancou = false;
  try { distancia(z, z.slice(1)); } catch (_) { lancou = true; }
  ok(lancou, 'tamanhos diferentes: recusa');
  ok(!!validarDescritor(amostras[0]) && !validarDescritor(amostras[0].slice(1)) && !validarDescritor([...amostras[0].slice(1), NaN])
    && !validarDescritor([...amostras[0].slice(1), 1.5]) && !validarDescritor(direcao(0.5)) && !validarDescritor(direcao(2.5)),
    'descritor: 128 números finitos, |x| ≤ 1, norma de 1,0 a 2,0');

  const cp = conferirDescritores(consultasDe(pessoa), amostras);
  ok(cp.confere && cp.distancia < LIMIAR, `a pessoa confere (distância ${cp.distancia.toFixed(3)} ≤ ${LIMIAR})`);
  const cpar = conferirDescritores(consultasDe(parecida), amostras);
  ok(!cpar.confere, `a parecida (0,50 da pessoa) não confere (distância ${cpar.distancia.toFixed(3)})`);
  const cout = conferirDescritores(consultasDe(outra), amostras);
  ok(!cout.confere, `outra pessoa não confere (distância ${cout.distancia.toFixed(3)})`);
  const [b1, b2] = consultasDe(pessoa, 2), [r1, r2] = consultasDe(outra, 2);
  ok(conferirDescritores([b1, b2, r1], amostras).confere && !conferirDescritores([b1, r1, r2], amostras).confere,
    'decide pela mediana dos 3 quadros (2 bons e 1 ruim confere; 1 bom e 2 ruins não)');

  const av = avaliarCadastro(amostras);
  ok(av.ok && av.amostras.length === 8 && av.removidas === 0 && av.dispersao.max <= 0.6,
    `cadastro com 8 amostras passa (dispersão máx. ${av.dispersao?.max}, mediana ${av.dispersao?.mediana})`);
  const av2 = avaliarCadastro([...amostras, outra, parecida]);
  const foraFicou = av2.amostras?.some(a => distancia(a, outra) === 0 || distancia(a, parecida) === 0);
  ok(av2.ok && !foraFicou && av2.amostras.length >= 7, `as amostras de fora (outra pessoa, parecida) saem (saíram ${av2.removidas} de 10)`);
  ok(avaliarCadastro([...amostras.slice(0, 4), ...Array.from({ length: 6 }, () => direcao(1.45))]).motivo === 'dispersao', 'sobra menos de 5 boas: recusa');
  ok(avaliarCadastro(Array(8).fill(amostras[0])).motivo === 'repetidas', 'o mesmo vetor 8 vezes: recusa (repetidas)');
  ok(avaliarCadastro(amostras.slice(0, 4)).motivo === 'quantidade' && avaliarCadastro([...amostras, ...amostras.slice(0, 5)]).motivo === 'quantidade',
    '4 ou 13 amostras: recusa');
  ok(avaliarCadastro([...amostras.slice(0, 7), [1, 2, 3]]).motivo === 'formato', 'amostra com formato errado: recusa');

  for (const n of [2, 3]) {
    ok(conferirProva(provaCom(n), n, 5000).ok && conferirProva(provaCom(n + 1), n, 5000).ok, `piscar: ${n} e ${n + 1} passam (desafio de ${n})`);
    ok(!conferirProva(provaCom(n - 1), n, 5000).ok && !conferirProva(provaCom(n + 2), n, 5000).ok, `piscar: ${n - 1} e ${n + 2} não passam`);
  }
  ok(!conferirProva(provaCom(2, { dur: 30 }), 2, 5000).ok && !conferirProva(provaCom(2, { dur: 900 }), 2, 5000).ok, 'piscada de 30 ms e de 900 ms não passam');
  ok(!conferirProva(provaCom(2, { fps: 5 }), 2, 5000).ok, 'fps 5 não passa (mínimo 8)');
  ok(!conferirProva(provaCom(2), 2, 0).ok, 'piscada depois do tempo que já passou não passa');
  ok(!conferirProva(provaCom(2, { inicio: 59_800 }), 2, 61_000).ok, 'piscada depois dos 60 s do desafio não passa');
  ok(!conferirProva(provaCom(2, { passo: 100 }), 2, 5000).ok, 'piscadas encavaladas não passam');
  ok(conferirProva(null, 2).formato && conferirProva({ piscadas: [{ ini: 'a', fim: 2 }], quadros: 3, fps: 30 }, 2).formato, 'prova sem formato: marcada como formato');

  ok(diaSP(new Date('2026-10-19T23:59:59-03:00')) === '2026-10-19' && diaSP(new Date('2026-10-20T00:00:01-03:00')) === '2026-10-20',
    'dia de Brasília: 23:59:59 é dia 19, 00:00:01 é dia 20');
  ok(diaSP(new Date('2026-10-20T02:59:59Z')) === '2026-10-19', 'dia de Brasília, não o de Greenwich (02:59 UTC do dia 20 ainda é dia 19)');

  /* ================================================================ cadastro, conferência, falhas */
  titulo('cadastro, conferência e falhas (pasta temporária, WebAuthn falso)');
  const helloFalso = {
    respostaOk: true,
    async generateRegistrationOptions(o) { return { challenge: 'desafio-falso-' + crypto.randomBytes(4).toString('hex'), rp: { id: o.rpID, name: o.rpName }, user: { name: o.userName } }; },
    async verifyRegistrationResponse({ response, expectedChallenge }) {
      return response.ok && response.challenge === expectedChallenge
        ? { verified: true, registrationInfo: { credential: { id: 'credencial-falsa', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] } } }
        : { verified: false };
    },
    async generateAuthenticationOptions() { return { challenge: 'entrada-falsa-' + crypto.randomBytes(4).toString('hex') }; },
    async verifyAuthenticationResponse({ response, expectedChallenge }) {
      return { verified: !!response.ok && response.challenge === expectedChallenge, authenticationInfo: { newCounter: 0 } };
    },
  };
  const pastaA = path.join(RAIZ, 'a');
  const rA = criarRosto({ pasta: pastaA, agora, webauthn: helloFalso, log });
  let e = rA.estado();
  ok(!e.liberado && e.precisa_cadastro && !e.cadastro.rosto && !e.hello.cadastrado && e.tentativas_restantes === FALHAS_ATE_HELLO, 'sem cadastro: travado, pede cadastro');
  let pegou = null;
  ok(rA.exigirLiberado({}, (res, st, msg, cod) => { pegou = { st, msg, cod }; }) === false && pegou?.st === 423 && pegou.cod === 'trava'
    && /travado/.test(pegou.msg), `exigirLiberado responde 423 "trava": ${pegou?.msg}`);
  const resCru = { writeHead(st, h) { this.st = st; this.h = h; }, end(c) { this.c = JSON.parse(c); } };
  ok(rA.exigirLiberado(resCru) === false && resCru.st === 423 && resCru.c.erro === 'trava', 'exigirLiberado sem a função erro também responde 423');
  let x = await rota(rA, 'POST', 'desafio', {});
  ok(x.tratou && x.st === 404 && x.c.erro === 'sem-cadastro', 'desafio sem cadastro: 404 sem-cadastro');
  x = await rota(rA, 'POST', 'cadastro', { descritores: amostras.slice(0, 3) });
  ok(x.st === 400 && x.c.erro === 'amostras', 'cadastro com 3 amostras: 400 amostras');
  x = await rota(rA, 'POST', 'cadastro', { descritores: amostras });
  ok(x.st === 200 && x.c.amostras === 8 && typeof x.c.dispersao?.max === 'number', `primeiro cadastro passa: ${x.c.amostras} amostras`);
  e = rA.estado();
  ok(e.liberado && e.metodo === 'cadastro' && e.cadastro.rosto && e.cadastro.amostras === 8 && !e.precisa_cadastro, 'o cadastro já libera o dia (metodo cadastro)');
  ok(existe(path.join(pastaA, 'cadastro.json')) && existe(path.join(pastaA, 'estado.json')), 'gravou cadastro.json e estado.json na pasta do rosto');
  ok(rA.exigirLiberado({}, () => { throw new Error('não devia responder'); }) === true, 'liberado: exigirLiberado deixa seguir');

  // Hello falso cadastrado junto (liberado)
  x = await rota(rA, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  ok(x.st === 200 && /^desafio-falso/.test(x.c.challenge), 'Hello (falso): opções de cadastro');
  x = await rota(rA, 'POST', 'hello/cadastrar', { resposta: { ok: true, challenge: x.c.challenge } });
  ok(x.st === 200 && rA.estado().hello.cadastrado, 'Hello (falso): cadastrado junto com o rosto');

  x = await rota(rA, 'POST', 'cadastro', { descritores: amostras });
  ok(x.st === 200, 'recadastrar com o Jarvis liberado: passa');
  x = await rota(rA, 'POST', 'travar', {});
  ok(x.st === 200 && !rA.liberado(), 'travar agora: desfaz o liberado');
  x = await rota(rA, 'POST', 'cadastro', { descritores: amostras });
  ok(x.st === 409 && x.c.erro === 'cadastro-existe', 'segundo cadastro com o Jarvis travado: 409 cadastro-existe');
  x = await rota(rA, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  ok(x.st === 409, 'cadastrar o Hello de novo com o Jarvis travado: 409');

  let t = await tentar(rA, consultasDe(pessoa));
  ok(t.d.st === 200 && [2, 3].includes(t.d.c.piscadas) && typeof t.d.c.id === 'string' && t.d.c.id.length >= 20, `desafio: ${t.d.c.piscadas} piscadas, vale 60 s`);
  ok(t.x.st === 200 && t.x.c.liberado && t.x.c.metodo === 'rosto' && t.x.c.distancia < LIMIAR, `a pessoa libera (distância ${t.x.c.distancia})`);
  ok(rA.liberado() && rA.estado().metodo === 'rosto', 'liberado hoje pelo rosto');
  x = await rota(rA, 'POST', 'conferir', { desafio: t.d.c.id, descritores: consultasDe(pessoa), prova: provaCom(t.d.c.piscadas) });
  ok(x.st === 409 && x.c.erro === 'desafio-usado', 'o mesmo desafio duas vezes: 409 desafio-usado');
  const d1 = await rota(rA, 'POST', 'desafio', {});
  passar(61_000);
  x = await rota(rA, 'POST', 'conferir', { desafio: d1.c.id, descritores: consultasDe(pessoa), prova: provaCom(d1.c.piscadas) });
  ok(x.st === 410 && x.c.erro === 'desafio-expirou', 'desafio depois de 60 s: 410 desafio-expirou');
  x = await rota(rA, 'POST', 'conferir', { desafio: 'nunca-existiu-xyz', descritores: consultasDe(pessoa), prova: provaCom(2) });
  ok(x.st === 410, 'desafio que nunca existiu: 410');
  x = await rota(rA, 'POST', 'conferir', { desafio: 'x', descritores: [pessoa.slice(0, 10)], prova: provaCom(2) });
  ok(x.st === 400 && x.c.erro === 'descritores', 'descritor com formato errado: 400 (não conta como falha)');
  x = await rota(rA, 'POST', 'conferir', { desafio: 'x', descritores: consultasDe(pessoa, 2), prova: provaCom(2) });
  ok(x.st === 400, 'só 2 quadros: 400');

  await rota(rA, 'POST', 'travar', {});
  t = await tentar(rA, consultasDe(parecida));
  ok(t.x.st === 403 && t.x.c.erro === 'nao-confere' && t.x.c.tentativas_restantes === 2 && t.x.c.distancia === undefined,
    `a parecida não libera: 403 nao-confere, SEM a distância na resposta (restam ${t.x.c.tentativas_restantes})`);
  ok(rA.estado().teste === undefined, 'fora do modo de teste o estado não diz teste (a página recusa o simulador)');
  t = await tentar(rA, consultasDe(outra));
  ok(t.x.st === 403 && t.x.c.erro === 'nao-confere' && t.x.c.tentativas_restantes === 1, 'outra pessoa não libera (resta 1)');
  ok(!rA.liberado(), 'continua travado');

  // estado.json sobrevive a reiniciar o servidor no mesmo dia
  const rA2 = criarRosto({ pasta: pastaA, agora, webauthn: helloFalso, log });
  e = rA2.estado();
  ok(e.cadastro.rosto && e.cadastro.amostras === 8 && e.hello.cadastrado && e.tentativas_restantes === 1 && !e.liberado,
    'criarRosto novo na mesma pasta: lembra o cadastro, o Hello e as falhas (resta 1)');
  const igual = consultasDe(pessoa, 1)[0];
  t = await tentar(rA2, [igual, igual, igual]);
  ok(t.x.st === 403 && t.x.c.erro === 'quadros' && t.x.c.tentativas_restantes === 0 && !!t.x.c.bloqueado_ate && t.x.c.distancia === undefined,
    '3 quadros idênticos: 403 quadros, 3ª falha, bloqueia (sem distância na resposta)');
  x = await rota(rA2, 'POST', 'desafio', {});
  ok(x.st === 429 && x.c.erro === 'muitas-tentativas' && !!x.c.tentar_em, `rosto bloqueado: 429 muitas-tentativas até ${x.c.tentar_em}`);
  x = await rota(rA2, 'POST', 'conferir', { desafio: 'qualquer', descritores: consultasDe(pessoa), prova: provaCom(2) });
  ok(x.st === 429, 'conferir com o rosto bloqueado: 429');
  x = await rota(rA2, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  ok(x.st === 200 && /^entrada-falsa/.test(x.c.challenge), 'com o rosto bloqueado, o Hello continua: opções de entrada');
  const ch = x.c.challenge;
  x = await rota(rA2, 'POST', 'hello/conferir', { resposta: { ok: false, id: 'credencial-falsa', challenge: ch } });
  ok(x.st === 403 && x.c.erro === 'hello-falhou' && !rA2.liberado(), 'Hello que não confirma: 403 hello-falhou');
  x = await rota(rA2, 'POST', 'hello/conferir', { resposta: { ok: true, id: 'credencial-falsa', challenge: ch } });
  ok(x.st === 410, 'o pedido do Hello vale uma resposta só: 410');
  x = await rota(rA2, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  x = await rota(rA2, 'POST', 'hello/conferir', { resposta: { ok: true, id: 'outra-credencial', challenge: x.c.challenge } });
  ok(x.st === 403, 'resposta de outra credencial: 403');
  x = await rota(rA2, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  x = await rota(rA2, 'POST', 'hello/conferir', { resposta: { ok: true, id: 'credencial-falsa', challenge: x.c.challenge } });
  e = rA2.estado();
  ok(x.st === 200 && x.c.metodo === 'hello' && e.liberado && e.metodo === 'hello' && e.tentativas_restantes === 3 && !e.bloqueado_ate,
    'o Hello (falso) libera e zera as falhas e o bloqueio');

  // o bloqueio vence sozinho em 10 min
  await rota(rA2, 'POST', 'travar', {});
  for (let i = 0; i < 3; i++) await tentar(rA2, consultasDe(outra));
  ok((await rota(rA2, 'POST', 'desafio', {})).st === 429, 'três falhas de novo: bloqueado');
  passar(9 * 60_000);
  ok((await rota(rA2, 'POST', 'desafio', {})).st === 429, 'depois de 9 min: ainda bloqueado');
  passar(70_000);
  x = await rota(rA2, 'POST', 'desafio', {});
  ok(x.st === 200 && rA2.estado().tentativas_restantes === 3, 'depois de 10 min: libera o rosto, 3 tentativas de novo');

  // prova de vida e quadros, pela rota
  t = await tentar(rA2, consultasDe(pessoa), { extra: -1 });
  ok(t.x.st === 403 && t.x.c.erro === 'prova-de-vida' && t.x.c.distancia === undefined, 'uma piscada a menos: 403 prova-de-vida');
  t = await tentar(rA2, consultasDe(pessoa), { dur: 30 });
  ok(t.x.st === 403 && t.x.c.erro === 'prova-de-vida', 'piscada de 30 ms: 403 prova-de-vida');
  t = await tentar(rA2, consultasDe(pessoa), { extra: 1 });
  ok(t.x.st === 200, 'uma piscada a mais (natural): passa, e zera as falhas');
  t = await tentar(rA2, [consultasDe(pessoa, 1)[0], consultasDe(outra, 1)[0], consultasDe(direcao(1.45), 1)[0]]);
  ok(t.x.st === 403 && t.x.c.erro === 'quadros', '3 pessoas diferentes nos 3 quadros: 403 quadros');
  t = await tentar(rA2, [amostras[0], ...consultasDe(pessoa, 2)]);
  ok(t.x.st === 403 && t.x.c.erro === 'quadros', 'um quadro igual a uma amostra guardada (cópia do cadastro): 403 quadros');
  t = await tentar(rA2, consultasDe(pessoa));
  ok(t.x.st === 200 && rA2.estado().tentativas_restantes === 3, 'depois de 2 falhas, o acerto zera (3 tentativas de novo)');
  t = await tentar(rA2, consultasDe(pessoa), { espera: 0 });
  ok(t.x.st === 403 && t.x.c.erro === 'prova-de-vida', 'piscadas "no futuro" (a 1ª em 1 s, mandada logo depois do desafio): 403');
  t = await tentar(rA2, consultasDe(pessoa));
  ok(t.x.st === 200 && rA2.estado().tentativas_restantes === 3, 'acerto depois de 1 falha: libera e zera');

  // pedidos ao mesmo tempo: o desafio vale uma vez e as falhas não se perdem
  let dd = await rota(rA2, 'POST', 'desafio', {});
  passar(5000);
  const corpoPar = { desafio: dd.c.id, descritores: consultasDe(pessoa), prova: provaCom(dd.c.piscadas) };
  const par = await Promise.all([rota(rA2, 'POST', 'conferir', corpoPar), rota(rA2, 'POST', 'conferir', corpoPar)]);
  ok(par.map(p => p.st).sort().join() === '200,409', `o mesmo desafio em dois pedidos juntos: um passa, o outro 409 (${par.map(p => p.st)})`);
  await rota(rA2, 'POST', 'travar', {});
  dd = await rota(rA2, 'POST', 'desafio', {});
  const dd2 = await rota(rA2, 'POST', 'desafio', {});
  passar(5000);
  const parF = await Promise.all([
    rota(rA2, 'POST', 'conferir', { desafio: dd.c.id, descritores: consultasDe(outra), prova: provaCom(dd.c.piscadas) }),
    rota(rA2, 'POST', 'conferir', { desafio: dd2.c.id, descritores: consultasDe(outra), prova: provaCom(dd2.c.piscadas) }),
  ]);
  ok(parF[0].st === 409 && parF[1].st === 403 && rA2.estado().tentativas_restantes === 2, 'o desafio novo troca o velho (o velho dá 409)');
  t = await tentar(rA2, consultasDe(pessoa));
  ok(t.x.st === 200, 'e o rosto libera de novo');

  // virada do dia em Brasília
  titulo('virada do dia e 423');
  relogio = Date.parse('2026-10-19T23:59:50-03:00');
  t = await tentar(rA2, consultasDe(pessoa), { espera: 5000 });
  ok(t.x.st === 200 && rA2.liberado(), 'liberado às 23:59:55 de Brasília');
  relogio = Date.parse('2026-10-19T23:59:59-03:00');
  ok(rA2.liberado(), '23:59:59: ainda liberado');
  passar(2000);
  ok(!rA2.liberado() && rA2.estado().dia === '2026-10-20', '00:00:01 do dia seguinte: travado');
  pegou = null;
  ok(rA2.exigirLiberado({}, (res, st, msg, cod) => { pegou = { st, cod }; }) === false && pegou?.st === 423, 'virou o dia: a próxima ação recebe 423');
  ok(rA2.estado().metodo === undefined, 'o estado de hoje não mostra o método de ontem');

  // apagar
  titulo('apagar');
  x = await rota(rA2, 'POST', 'apagar', { confirmar: true });
  ok(x.st === 423 && x.c.erro === 'trava' && existe(path.join(pastaA, 'cadastro.json')), 'apagar com o Jarvis travado: 423 (nada apagado)');
  t = await tentar(rA2, consultasDe(pessoa));
  ok(t.x.st === 200, 'liberou pelo rosto');
  x = await rota(rA2, 'POST', 'apagar', {});
  ok(x.st === 400 && x.c.erro === 'confirmar', 'apagar sem {confirmar: true}: 400');
  x = await rota(rA2, 'POST', 'apagar', { confirmar: true });
  e = rA2.estado();
  ok(x.st === 200 && !existe(path.join(pastaA, 'cadastro.json')) && !existe(path.join(pastaA, 'hello.json')), 'apagar liberado: cadastro.json e hello.json saem');
  ok(!e.liberado && e.precisa_cadastro && !e.cadastro.rosto && !e.hello.cadastrado, 'depois de apagar: travado e pede cadastro novo');
  ok((await rota(rA2, 'POST', 'desafio', {})).st === 404 && (await rota(rA2, 'POST', 'hello/opcoes', { tipo: 'entrada' })).st === 404,
    'depois de apagar: desafio 404 sem-cadastro e Hello 404 sem-hello');
  const rA3 = criarRosto({ pasta: pastaA, agora, webauthn: helloFalso, log });
  ok(rA3.estado().precisa_cadastro && !rA3.liberado(), 'reiniciado depois de apagar: continua sem cadastro');
  x = await rota(rA3, 'POST', 'cadastro', { descritores: amostras });
  ok(x.st === 200 && rA3.liberado(), 'o cadastro novo é de confiança outra vez');

  // arquivo estragado não derruba nada (fica guardado à parte)
  fs.writeFileSync(path.join(pastaA, 'estado.json'), '{ quebrado');
  const rA4 = criarRosto({ pasta: pastaA, agora, webauthn: helloFalso, log });
  ok(!rA4.liberado() && rA4.estado().cadastro.rosto && fs.readdirSync(pastaA).some(n => n.startsWith('estado.json.ilegivel-')),
    'estado.json estragado: travado, cadastro mantido, o arquivo ruim guardado à parte');

  /* ================================================================ revisão de 2026-10-19 */
  titulo('modo de teste: só ele diz teste e mostra a distância da recusa');
  const rE = criarRosto({ simulado: true, pasta: path.join(RAIZ, 'e'), agora, webauthn: helloFalso, log });
  ok(rE.estado().teste === true && rE.pasta === path.resolve(RAIZ, 'e'), 'com --simulado (pasta de teste): estado.teste = true');
  ok((await rota(rE, 'POST', 'cadastro', { descritores: amostras })).st === 200, 'cadastro no modo de teste');
  await rota(rE, 'POST', 'travar', {});
  t = await tentar(rE, consultasDe(parecida));
  ok(t.x.st === 403 && t.x.c.erro === 'nao-confere' && t.x.c.distancia > LIMIAR, `no modo de teste a recusa traz a distância (${t.x.c.distancia})`);

  titulo('trocar ou apagar o cadastro pede confirmação de até 5 min');
  relogio = Date.parse('2026-10-21T08:00:00-03:00');
  const pastaD = path.join(RAIZ, 'd');
  const rD = criarRosto({ pasta: pastaD, agora, webauthn: helloFalso, log });
  x = await rota(rD, 'POST', 'cadastro', { descritores: amostras });
  ok(x.st === 200 && rD.estado().recente === true, 'primeiro cadastro: liberado e recente');
  t = await tentar(rD, consultasDe(parecida));
  ok(t.x.st === 403 && t.x.c.tentativas_restantes === 3 && rD.estado().tentativas_restantes === 3,
    'o teste logo depois do cadastro que não confere não gasta tentativa (restam 3)');
  t = await tentar(rD, consultasDe(pessoa));
  ok(t.x.st === 200 && rD.estado().metodo === 'rosto' && rD.estado().recente, 'conferiu pelo rosto: recente');
  passar(4 * 60_000);
  x = await rota(rD, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  ok(x.st === 200, '4 min depois: ainda dá para cadastrar o Hello');
  x = await rota(rD, 'POST', 'hello/cadastrar', { resposta: { ok: true, challenge: x.c.challenge } });
  ok(x.st === 200 && rD.estado().hello.cadastrado, 'Hello cadastrado dentro dos 5 min');
  passar(2 * 60_000);
  e = rD.estado();
  ok(e.liberado && e.recente === false, '6 min depois: continua liberado, mas não é mais recente');
  const cadAntes = fs.readFileSync(path.join(pastaD, 'cadastro.json'), 'utf8');
  x = await rota(rD, 'POST', 'cadastro', { descritores: Array.from({ length: 8 }, () => perto(outra, 0.15, 0.30)) });
  ok(x.st === 423 && x.c.erro === 'reconfirme' && fs.readFileSync(path.join(pastaD, 'cadastro.json'), 'utf8') === cadAntes,
    'o colega na mesa com o Jarvis aberto: "Cadastrar o rosto de novo" dá 423 reconfirme e o cadastro não muda');
  x = await rota(rD, 'POST', 'apagar', { confirmar: true });
  ok(x.st === 423 && x.c.erro === 'reconfirme' && existe(path.join(pastaD, 'cadastro.json')) && existe(path.join(pastaD, 'hello.json')),
    'apagar sem confirmação recente: 423 reconfirme (nada apagado)');
  x = await rota(rD, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  ok(x.st === 423 && x.c.erro === 'reconfirme', 'cadastrar outro Hello sem confirmação recente: 423 reconfirme');
  t = await tentar(rD, consultasDe(parecida));
  ok(t.x.st === 403 && t.x.c.tentativas_restantes === 2, 'fora do teste do cadastro, a recusa conta (restam 2)');
  x = await rota(rD, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  x = await rota(rD, 'POST', 'hello/conferir', { resposta: { ok: true, id: 'credencial-falsa', challenge: x.c.challenge } });
  ok(x.st === 200 && rD.estado().recente, 'confirmou pelo Hello: recente de novo');
  x = await rota(rD, 'POST', 'cadastro', { descritores: amostras });
  ok(x.st === 200, 'agora o recadastro passa');

  titulo('bloqueios: o 2º do dia vale até a meia-noite; falha de ontem não conta hoje');
  relogio = Date.parse('2026-10-22T09:00:00-03:00');
  const pastaF = path.join(RAIZ, 'f');
  const rF = criarRosto({ pasta: pastaF, agora, webauthn: helloFalso, log });
  await rota(rF, 'POST', 'cadastro', { descritores: amostras });
  x = await rota(rF, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  await rota(rF, 'POST', 'hello/cadastrar', { resposta: { ok: true, challenge: x.c.challenge } });
  await rota(rF, 'POST', 'travar', {});
  for (let i = 0; i < 3; i++) await tentar(rF, consultasDe(outra));
  x = await rota(rF, 'POST', 'desafio', {});
  ok(x.st === 429 && x.c.bloqueio === '10min' && /10 minutos/.test(x.c.mensagem), '1º bloqueio do dia: 10 min');
  passar(11 * 60_000);
  ok((await rota(rF, 'POST', 'desafio', {})).st === 200 && rF.estado().tentativas_restantes === 3, 'depois de 10 min: 3 tentativas de novo');
  for (let i = 0; i < 3; i++) t = await tentar(rF, consultasDe(outra));
  ok(t.x.st === 403 && t.x.c.bloqueio === 'dia' && t.x.c.bloqueado_ate === new Date('2026-10-23T00:00:00-03:00').toISOString(),
    `2º bloqueio do dia: até a meia-noite de Brasília (${t.x.c.bloqueado_ate})`);
  passar(3 * 60 * 60_000);
  x = await rota(rF, 'POST', 'desafio', {});
  ok(x.st === 429 && x.c.bloqueio === 'dia' && /amanhã/.test(x.c.mensagem) && rF.estado().bloqueio === 'dia', '3 h depois: continua bloqueado ("tente amanhã")');
  const rF2 = criarRosto({ pasta: pastaF, agora, webauthn: helloFalso, log });
  ok(rF2.estado().bloqueio === 'dia' && (await rota(rF2, 'POST', 'desafio', {})).st === 429, 'reiniciar o app não tira o bloqueio do dia');
  x = await rota(rF2, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  x = await rota(rF2, 'POST', 'hello/conferir', { resposta: { ok: true, id: 'credencial-falsa', challenge: x.c.challenge } });
  e = rF2.estado();
  ok(x.st === 200 && e.liberado && !e.bloqueado_ate && e.tentativas_restantes === 3, 'o Windows Hello libera e zera o bloqueio do dia');
  await rota(rF2, 'POST', 'travar', {});
  for (let i = 0; i < 3; i++) await tentar(rF2, consultasDe(outra));
  passar(11 * 60_000);
  for (let i = 0; i < 3; i++) await tentar(rF2, consultasDe(outra));
  ok(rF2.estado().bloqueio === 'dia', 'dois bloqueios de novo no mesmo dia: bloqueado até a meia-noite');
  relogio = Date.parse('2026-10-23T00:00:05-03:00');
  ok((await rota(rF2, 'POST', 'desafio', {})).st === 200 && rF2.estado().tentativas_restantes === 3 && !rF2.estado().bloqueado_ate,
    'virou o dia: o rosto volta, com 3 tentativas');
  relogio = Date.parse('2026-10-23T23:50:00-03:00');
  for (let i = 0; i < 2; i++) await tentar(rF2, consultasDe(outra));
  ok(rF2.estado().tentativas_restantes === 1, '2 falhas às 23:50: resta 1');
  relogio = Date.parse('2026-10-24T08:00:00-03:00');
  ok(rF2.estado().tentativas_restantes === 3 && criarRosto({ pasta: pastaF, agora, webauthn: helloFalso, log }).estado().tentativas_restantes === 3,
    'no dia seguinte: 3 tentativas (a falha de ontem não conta, nem depois de reiniciar)');

  titulo('cadastro que existe mas não dá para ler: a trava fica fechada');
  const pastaG = path.join(RAIZ, 'g'), cadG = path.join(pastaG, 'cadastro.json');
  const rG = criarRosto({ pasta: pastaG, agora, webauthn: helloFalso, log });
  await rota(rG, 'POST', 'cadastro', { descritores: amostras });
  await rota(rG, 'POST', 'travar', {});
  const cadBom = fs.readFileSync(cadG, 'utf8');
  fs.writeFileSync(cadG, JSON.stringify({ ...JSON.parse(cadBom), dimensao: 512 }));   // formato de outra versão
  const rG2 = criarRosto({ pasta: pastaG, agora, webauthn: helloFalso, log });
  e = rG2.estado();
  ok(!e.liberado && e.precisa_cadastro === false && e.erro === 'ilegivel' && !e.cadastro.rosto,
    'formato de outra versão: travado, NÃO pede "primeiro cadastro" e o estado diz ilegivel');
  const outraPessoa = Array.from({ length: 8 }, () => perto(outra, 0.15, 0.30));
  x = await rota(rG2, 'POST', 'cadastro', { descritores: outraPessoa });
  ok(x.st === 409 && x.c.erro === 'ilegivel' && JSON.parse(fs.readFileSync(cadG, 'utf8')).dimensao === 512,
    'quem chega primeiro não ganha o cadastro: 409 ilegivel e o arquivo fica como estava');
  x = await rota(rG2, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  ok(x.st === 409 && x.c.erro === 'ilegivel', 'cadastrar o Hello por cima: 409 ilegivel');
  ok((await rota(rG2, 'POST', 'desafio', {})).c.erro === 'ilegivel', 'desafio: 409 ilegivel (não "sem cadastro")');
  fs.writeFileSync(cadG, '{ quebr');
  const rG3 = criarRosto({ pasta: pastaG, agora, webauthn: helloFalso, log });
  ok(rG3.estado().erro === 'ilegivel' && (await rota(rG3, 'POST', 'cadastro', { descritores: outraPessoa })).st === 409
    && fs.readFileSync(cadG, 'utf8') === '{ quebr' && !fs.readdirSync(pastaG).some(n => n.startsWith('cadastro.json.')),
    'JSON estragado: o mesmo (409, o arquivo não é movido nem trocado)');
  fs.rmSync(cadG); fs.mkdirSync(cadG);   // "existe mas não abre" (como o antivírus segurando: EISDIR no lugar de EBUSY)
  const rG4 = criarRosto({ pasta: pastaG, agora, webauthn: helloFalso, log });
  ok(rG4.estado().erro === 'ilegivel' && !rG4.estado().precisa_cadastro && (await rota(rG4, 'POST', 'cadastro', { descritores: outraPessoa })).st === 409,
    'erro de leitura (não é "não existe"): travado e 409');
  fs.rmSync(cadG, { recursive: true }); fs.writeFileSync(cadG, cadBom);
  x = await rota(rG4, 'GET', 'estado');
  ok(x.st === 200 && x.c.cadastro.rosto && !x.c.erro && !x.c.precisa_cadastro, 'o arquivo voltou: o próximo pedido lê de novo e o cadastro aparece');
  ok((await tentar(rG4, consultasDe(pessoa))).x.st === 200, 'e o rosto confere com ele');

  /* ================================================================ Windows Hello de verdade (biblioteca real) */
  titulo('Windows Hello com o @simplewebauthn/server de verdade (autenticador de software)');
  const pastaB = path.join(RAIZ, 'b');
  const rB = criarRosto({ pasta: pastaB, agora, log });
  const aut = criarAutenticador();
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  ok(x.st === 404 && x.c.erro === 'sem-hello', 'entrada sem Hello: 404 sem-hello');
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  const op = x.c;
  ok(x.st === 200 && op.rp?.id === 'localhost' && op.authenticatorSelection?.authenticatorAttachment === 'platform'
    && op.authenticatorSelection?.userVerification === 'required' && op.attestation === 'none'
    && JSON.stringify(op.pubKeyCredParams?.map(p => p.alg)) === '[-8,-7,-257]',
    `opções de cadastro: rpID localhost, plataforma, verificação obrigatória, algoritmos ${JSON.stringify(op.pubKeyCredParams?.map(p => p.alg))}`);
  x = await rota(rB, 'POST', 'hello/cadastrar', { resposta: aut.criar(op, { uv: false }) });
  ok(x.st === 400 && x.c.erro === 'hello-falhou', 'cadastro sem verificação do usuário (sem PIN): 400 hello-falhou');
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  const opRp = await rota(rB, 'POST', 'hello/cadastrar', { resposta: aut.criar(x.c, { rpId: 'exemplo.com.br' }) });
  ok(opRp.st === 400, 'cadastro de outro rpID: 400');
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  const opOr = await rota(rB, 'POST', 'hello/cadastrar', { resposta: aut.criar(x.c, { origem: 'http://127.0.0.1:8790' }) });
  ok(opOr.st === 400, 'cadastro vindo de 127.0.0.1 (outra origem): 400');
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  x = await rota(rB, 'POST', 'hello/cadastrar', { resposta: aut.criar(x.c) });
  e = rB.estado();
  ok(x.st === 200 && e.hello.cadastrado && !e.cadastro.rosto && e.liberado && e.metodo === 'cadastro',
    'sem câmera: o Hello sozinho é o cadastro de confiança e libera o dia');
  const hj = JSON.parse(fs.readFileSync(path.join(pastaB, 'hello.json'), 'utf8'));
  ok(hj.credencial.id === aut.id && typeof hj.credencial.chave_publica === 'string' && hj.credencial.contador === 0 && !/PRIVATE|"d"/.test(JSON.stringify(hj)),
    'hello.json guarda o id, a chave pública e o contador (nada privado)');

  await rota(rB, 'POST', 'travar', {});
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'cadastro' });
  ok(x.st === 409, 'cadastrar outro Hello travado: 409');
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  const opE = x.c;
  ok(x.st === 200 && opE.rpId === 'localhost' && opE.userVerification === 'required' && opE.allowCredentials?.[0]?.id === aut.id,
    'opções de entrada: só a credencial guardada, verificação obrigatória');
  const assin = aut.assinar(opE);
  x = await rota(rB, 'POST', 'hello/conferir', { resposta: assin });
  e = rB.estado();
  ok(x.st === 200 && x.c.metodo === 'hello' && e.liberado && e.metodo === 'hello', 'entrada pelo Hello: assinatura conferida, liberado');
  ok(JSON.parse(fs.readFileSync(path.join(pastaB, 'hello.json'), 'utf8')).credencial.contador === 1, 'o contador da credencial foi atualizado (1)');
  await rota(rB, 'POST', 'travar', {});
  x = await rota(rB, 'POST', 'hello/conferir', { resposta: assin });
  ok(x.st === 410, 'repetir a mesma assinatura sem pedido novo: 410');
  await rota(rB, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  x = await rota(rB, 'POST', 'hello/conferir', { resposta: assin });
  ok(x.st === 403 && !rB.liberado(), 'assinatura velha num pedido novo (outro desafio): 403');
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  x = await rota(rB, 'POST', 'hello/conferir', { resposta: aut.assinar(x.c, { uv: false }) });
  ok(x.st === 403 && !rB.liberado(), 'entrada sem verificação do usuário: 403');
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  x = await rota(rB, 'POST', 'hello/conferir', { resposta: aut.assinar(x.c, { origem: 'https://exemplo.com.br' }) });
  ok(x.st === 403 && !rB.liberado(), 'entrada de outra origem: 403');
  const outroAut = criarAutenticador();
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  x = await rota(rB, 'POST', 'hello/conferir', { resposta: { ...outroAut.assinar(x.c), id: aut.id, rawId: aut.id } });
  ok(x.st === 403 && !rB.liberado(), 'assinatura de outra chave com o id da guardada: 403');
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  passar(5 * 60_000 + 1000);
  x = await rota(rB, 'POST', 'hello/conferir', { resposta: aut.assinar(x.c) });
  ok(x.st === 410 && !rB.liberado(), 'pedido do Hello depois de 5 min: 410');
  x = await rota(rB, 'POST', 'hello/opcoes', { tipo: 'entrada' });
  x = await rota(rB, 'POST', 'hello/conferir', { resposta: aut.assinar(x.c) });
  ok(x.st === 200 && rB.liberado(), 'e com um pedido novo libera de novo');
  x = await rota(rB, 'POST', 'cadastro', { descritores: amostras });
  ok(x.st === 200 && rB.estado().cadastro.rosto, 'liberado pelo Hello, cadastra o rosto (câmera chegou depois)');

  /* ================================================================ rotas por HTTP, como no servidor.js */
  titulo('pelo HTTP (mesmo ctx do servidor.js)');
  const pastaC = path.join(RAIZ, 'c');
  const rC = criarRosto({ pasta: pastaC, agora, log });
  const srv = await servidorDeTeste(rC);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const pedir = (metodo, p, corpo, tipo = 'application/json') => fetch(base + p, {
    method: metodo, headers: corpo !== undefined ? { 'content-type': tipo } : {}, body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  }).then(async r => ({ st: r.status, c: await r.json() }));
  x = await pedir('POST', '/api/jarvis/turno', {});
  ok(x.st === 423 && x.c.erro === 'trava' && /travado/.test(x.c.mensagem), `turno travado: 423 ${JSON.stringify(x.c)}`);
  x = await pedir('POST', '/api/ouvido/ligar', { aba: 'abc123' });
  ok(x.st === 423, 'ligar o ouvido travado (podeLigar = liberado): 423');
  x = await pedir('POST', '/api/jarvis/acao/abcd1234', { decisao: 'recusar' });
  ok(x.st === 200, 'recusar uma ação continua permitido travado');
  x = await pedir('POST', '/api/jarvis/acao/abcd1234', { decisao: 'confirmar' });
  ok(x.st === 423, 'confirmar uma ação travado: 423');
  x = await pedir('GET', '/api/rosto/estado');
  ok(x.st === 200 && x.c.ok && x.c.liberado === false && x.c.precisa_cadastro, 'GET /api/rosto/estado');
  x = await pedir('POST', '/api/rosto/desafio', {}, 'text/plain');
  ok(x.st === 415, 'POST sem JSON: 415');
  x = await pedir('GET', '/api/rosto/desafio');
  ok(x.st === 405, 'GET numa rota de POST: 405');
  x = await pedir('POST', '/api/rosto/nada', {});
  ok(x.st === 404 && x.c.erro === 'rota', 'rota desconhecida do rosto: 404');
  x = await pedir('POST', '/api/outra/coisa', {});
  ok(x.st === 404 && x.c.erro === 'fora', 'fora de /api/rosto/: o tratar devolve false');
  x = await pedir('POST', '/api/rosto/cadastro', { descritores: amostras });
  ok(x.st === 200, 'cadastro pelo HTTP');
  x = await pedir('POST', '/api/jarvis/turno', {});
  ok(x.st === 200, 'liberado: o turno passa');
  srv.close();

  /* ================================================================ pastas: simulado, trava aberta, sem acesso */
  titulo('pastas');
  ok(PASTA_PADRAO === path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'CerebroLube', 'rosto'),
    `pasta de verdade: ${PASTA_PADRAO}`);
  ok(criarRosto({ simulado: true, agora, log }).pasta === path.resolve(PASTA_SIMULADO), `--simulado: pasta temporária própria (${PASTA_SIMULADO})`);
  ok(criarRosto({ simulado: true, pasta: PASTA_PADRAO, agora, log }).pasta === path.resolve(PASTA_SIMULADO), '--simulado com a pasta de verdade pedida: vai para a temporária');
  ok(criarRosto({ simulado: true, pasta: PASTA_PADRAO.toUpperCase() + path.sep, agora, log }).pasta === path.resolve(PASTA_SIMULADO),
    '--simulado com a pasta de verdade em maiúsculas e barra no fim: vai para a temporária');
  // o %TEMP% desta máquina vem com o nome curto do Windows (C:\Users\GTIJUL~1.ALV\...): o mesmo lugar escrito de outro jeito
  const localCurto = path.dirname(os.tmpdir());
  if (/~\d/.test(localCurto) && fs.existsSync(localCurto)) {
    const curta = path.join(localCurto, 'CerebroLube', 'rosto');
    ok(curta.toLowerCase() !== PASTA_PADRAO.toLowerCase() && criarRosto({ simulado: true, pasta: curta, agora, log }).pasta === path.resolve(PASTA_SIMULADO),
      `--simulado com a pasta de verdade em nome curto (${curta}): vai para a temporária`);
  } else console.log('     (pulado: o %TEMP% não tem nome curto nesta máquina)');
  const nLog = linhasLog.length;
  const rT = criarRosto({ travaAberta: true, pasta: PASTA_PADRAO, agora, log });
  ok(rT.pasta === path.resolve(PASTA_SIMULADO) && rT.liberado() && rT.estado().trava_aberta && linhasLog.slice(nLog).some(l => /TRAVA DO ROSTO DESLIGADA/.test(l)),
    'trava aberta: libera tudo, avisa no log e nunca usa a pasta de verdade');
  fs.writeFileSync(path.join(RAIZ, 'arquivo.txt'), 'não é pasta');
  const rS = criarRosto({ pasta: path.join(RAIZ, 'arquivo.txt', 'rosto'), agora, log });
  x = await rota(rS, 'POST', 'cadastro', { descritores: amostras });
  ok(x.st === 503 && x.c.erro === 'sem-pasta' && !rS.liberado() && rS.estado().precisa_cadastro, 'pasta sem acesso: 503 sem-pasta e nada muda');
  x = await rota(rS, 'POST', 'travar', {});
  ok(x.st === 200 && !rS.liberado(), 'travar funciona mesmo sem pasta');

  /* ================================================================ privacidade */
  titulo('privacidade (log, respostas, arquivos)');
  const numeros = linhasLog.filter(l => /\d[.,]\d/.test(l));
  ok(linhasLog.length > 10 && numeros.length === 0, `o log (${linhasLog.length} linhas) não tem número com casa decimal (descritor ou distância)`);
  ok(!linhasLog.some(l => l.includes(aut.id) || l.includes('credencial-falsa') || /chave|desafio-falso|entrada-falsa/.test(l)), 'o log não tem credencial nem desafio');
  console.log('     log: ' + [...new Set(linhasLog)].join(' | '));
  const comVetor = respostas.filter(s => /\[(-?\d+\.\d+,){10,}/.test(s));
  ok(comVetor.length === 0, `nenhuma das ${respostas.length} respostas devolve um descritor`);
  const estadoTxt = fs.readFileSync(path.join(pastaA, 'cadastro.json'), 'utf8');
  ok(JSON.parse(estadoTxt).amostras.length === 8 && !/\d\.\d{4}/.test(fs.readFileSync(path.join(pastaC, 'estado.json'), 'utf8')),
    'os descritores ficam só no cadastro.json (o estado.json não tem)');
  const todos = [];
  (function andar(p) { for (const n of fs.readdirSync(p)) { const q = path.join(p, n); if (fs.statSync(q).isDirectory()) andar(q); else todos.push(path.relative(RAIZ, q)); } })(RAIZ);
  const estranhos = todos.filter(f => !/^[a-g][\\/](cadastro|hello|estado)\.json$/.test(f) && f !== 'arquivo.txt' && !/^a[\\/]estado\.json\.ilegivel-\d+$/.test(f));
  ok(estranhos.length === 0, `na pasta de teste só os arquivos esperados (${todos.length}; estranhos: ${estranhos.join(', ') || 'nenhum'}; nenhum .tmp)`);
  ok(fotoPasta(PASTA_PADRAO) === padraoAntes, 'a pasta de verdade do rosto não mudou');
} finally {
  await fsp.rm(RAIZ, { recursive: true, force: true });
}

console.log(`\n${total - falhas} de ${total} OK${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
process.exit(falhas ? 1 : 0);

/* ---------- um servidor HTTP com o mesmo ctx do servidor.js (lerCorpoJson, json, erro) e as rotas travadas ---------- */
function servidorDeTeste(rosto) {
  function json(res, status, obj) {
    const corpo = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(corpo) });
    res.end(corpo);
  }
  const erro = (res, status, mensagem, codigo) => json(res, status, { erro: codigo || 'erro', mensagem });
  async function lerCorpoJson(req) {
    const tipo = String(req.headers['content-type'] || '').toLowerCase();
    if (!tipo.startsWith('application/json')) { const e = new Error('tipo'); e.status = 415; throw e; }
    const partes = [];
    for await (const p of req) partes.push(p);
    try { return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'); } catch (_) { const e = new Error('json'); e.status = 400; throw e; }
  }
  const s = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost:8790');
    const ctx = { req, res, url, metodo: req.method, lerCorpoJson, json, erro };
    if (url.pathname === '/api/jarvis/turno') { if (!rosto.exigirLiberado(res, erro)) return; json(res, 200, { ok: true }); return; }
    if (url.pathname === '/api/ouvido/ligar') { if (!rosto.liberado()) { erro(res, 423, 'travado', 'trava'); return; } json(res, 200, { ok: true }); return; }
    if (url.pathname.startsWith('/api/jarvis/acao/')) {
      const c = await lerCorpoJson(req);
      if (c.decisao === 'confirmar' && !rosto.exigirLiberado(res, erro)) return;
      json(res, 200, { ok: true });
      return;
    }
    if (await rosto.tratar(ctx)) return;
    erro(res, 404, 'fora', 'fora');
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}

/* ---------- autenticador de software (o papel do Windows Hello, só para o teste) ---------- */
function cbor(v) {   // o mínimo de CBOR do WebAuthn: inteiros, textos, bytes, listas e mapas (Map, para chave numérica)
  const cab = (tipo, n) => {
    if (n < 24) return Buffer.from([(tipo << 5) | n]);
    if (n < 256) return Buffer.from([(tipo << 5) | 24, n]);
    const b = Buffer.alloc(3); b[0] = (tipo << 5) | 25; b.writeUInt16BE(n, 1); return b;
  };
  if (typeof v === 'number') return v >= 0 ? cab(0, v) : cab(1, -1 - v);
  if (typeof v === 'string') { const b = Buffer.from(v, 'utf8'); return Buffer.concat([cab(3, b.length), b]); }
  if (v instanceof Uint8Array) return Buffer.concat([cab(2, v.length), Buffer.from(v)]);
  if (Array.isArray(v)) return Buffer.concat([cab(4, v.length), ...v.map(cbor)]);
  const ent = v instanceof Map ? [...v.entries()] : Object.entries(v);
  return Buffer.concat([cab(5, ent.length), ...ent.flatMap(([k, x]) => [cbor(k), cbor(x)])]);
}
function criarAutenticador() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const credId = crypto.randomBytes(32);
  const b64 = b => Buffer.from(b).toString('base64url');
  const sha = b => crypto.createHash('sha256').update(b).digest();
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
  let contador = 0;
  const cose = new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]);
  return {
    id: b64(credId),
    criar(opcoes, { origem = 'http://localhost:8790', rpId = opcoes.rp.id, uv = true } = {}) {
      const cliente = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: opcoes.challenge, origin: origem, crossOrigin: false }));
      const tam = Buffer.alloc(2); tam.writeUInt16BE(credId.length);
      const authData = Buffer.concat([sha(rpId), Buffer.from([0x01 | (uv ? 0x04 : 0) | 0x40]), u32(contador), Buffer.alloc(16), tam, credId, cbor(cose)]);
      const att = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
      return {
        id: b64(credId), rawId: b64(credId), type: 'public-key', authenticatorAttachment: 'platform', clientExtensionResults: {},
        response: { clientDataJSON: b64(cliente), attestationObject: b64(att), transports: ['internal'] },
      };
    },
    assinar(opcoes, { origem = 'http://localhost:8790', rpId = opcoes.rpId, uv = true } = {}) {
      contador++;
      const cliente = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: opcoes.challenge, origin: origem, crossOrigin: false }));
      const authData = Buffer.concat([sha(rpId), Buffer.from([0x01 | (uv ? 0x04 : 0)]), u32(contador)]);
      const assinatura = crypto.sign('sha256', Buffer.concat([authData, sha(cliente)]), privateKey);   // DER, como o WebAuthn
      return {
        id: b64(credId), rawId: b64(credId), type: 'public-key', authenticatorAttachment: 'platform', clientExtensionResults: {},
        response: { clientDataJSON: b64(cliente), authenticatorData: b64(authData), signature: b64(assinatura) },
      };
    },
  };
}
