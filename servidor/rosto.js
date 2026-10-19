/* Cérebro da Lube — servidor/rosto.js: a trava do Jarvis pelo rosto, com o Windows Hello de reserva (docs/OUVIDO-E-ROSTO.md §5).
   A página manda só números (o descritor de 128 números do face-api e o resumo do piscar); quem decide é este arquivo:
   compara com o cadastro, guarda o "liberado hoje" (dia de Brasília) e diz às rotas que agem se podem seguir (423).
   Dados (dado biométrico: nunca no repositório, no vault, no OneDrive nem no log):
     <LOCALAPPDATA>\CerebroLube\rosto\cadastro.json   as amostras do rosto
     <LOCALAPPDATA>\CerebroLube\rosto\hello.json      a credencial do Windows Hello (id, chave pública, contador)
     <LOCALAPPDATA>\CerebroLube\rosto\estado.json     {dia, metodo, em} do liberado e o contador de falhas
   Com --simulado (ou JARVIS_SIMULADO=1) e com a trava aberta, a pasta é uma temporária (nunca o cadastro de verdade).
   É uma trava do Jarvis neste computador: não substitui o login do Windows, e um vídeo do Júlio poderia enganar o piscar. */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { FUSO } from './util.js';

const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
export const PASTA_PADRAO = path.join(LOCAL, 'CerebroLube', 'rosto');
export const PASTA_SIMULADO = path.join(os.tmpdir(), 'CerebroLube-simulado', 'rosto');

export const DIMENSAO = 128, LIMIAR = 0.45, MIN_AMOSTRAS = 5, MAX_AMOSTRAS = 12, FALHAS_ATE_HELLO = 3;
export const MIN_CONSULTAS = 3, MAX_CONSULTAS = 5;
const NORMA_MIN = 1.0, NORMA_MAX = 2.0;          // medido: 1,39–1,51
const DISPERSAO_MAX = 0.40;                      // amostra do cadastro longe das outras sai
const QUADROS_MIN = 0.002, QUADROS_MAX = 0.40;   // os quadros da conferência: nem repetidos, nem pessoas diferentes
const BLOQUEIO_MS = 10 * 60_000;
const DESAFIO_MS = 60_000;
const HELLO_MS = 5 * 60_000;
const PISCADA_MIN = 50, PISCADA_MAX = 600, FPS_MIN = 8, FPS_MAX = 240, FOLGA_MS = 500;   // o relógio da página começa depois do nosso: não pode estar na frente
const ALGORITMOS = [-8, -7, -257];               // EdDSA, ES256, RS256 (explícito: o padrão da v14 põe ML-DSA-44)
const MODELO = 'face-api@1.7.15/face_recognition_model';
const MSG_TRAVA = 'O Jarvis está travado. Faça o reconhecimento do rosto.';
const MSG_AMOSTRAS = 'Fique de frente, com boa luz, e tente de novo.';

/* ---------- A conta (sem estado; o teste usa direto) ---------- */

/** Distância euclidiana entre dois descritores (igual ao faceapi.euclideanDistance). */
export function distancia(a, b) {
  if (!a || !b || a.length !== b.length) throw new TypeError('descritores de tamanhos diferentes');
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/* mediana; com número par, a maior das duas do meio (mais rígido para uma trava) */
function mediana(v) {
  if (!v.length) return Infinity;
  const s = [...v].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
const tres = x => Math.round(x * 1000) / 1000;

/** 128 números finitos, |x| ≤ 1, norma entre 1,0 e 2,0 → cópia; senão null. */
export function validarDescritor(d) {
  if (!Array.isArray(d) || d.length !== DIMENSAO) return null;
  let s = 0;
  for (const x of d) {
    if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 1) return null;
    s += x * x;
  }
  const n = Math.sqrt(s);
  return n >= NORMA_MIN && n <= NORMA_MAX ? d.slice() : null;
}

/** melhor(q) = a amostra mais parecida; decisão = mediana dos melhores ≤ limiar. */
export function conferirDescritores(consultas, amostras, limiar = LIMIAR) {
  if (!amostras?.length || !consultas?.length) return { confere: false, distancia: Infinity, distancias: [] };
  const distancias = consultas.map(q => Math.min(...amostras.map(a => distancia(q, a))));
  const d = mediana(distancias);
  return { confere: d <= limiar, distancia: d, distancias };
}

/* todas as distâncias entre pares */
function pares(lista) {
  const r = [];
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) r.push(distancia(lista[i], lista[j]));
  return r;
}

/** Cadastro: tira as repetidas e as que ficam longe das outras; precisa sobrar MIN_AMOSTRAS.
    → { ok, amostras: <os descritores que ficaram>, removidas, dispersao: {max, mediana}, motivo? } */
export function avaliarCadastro(descritores) {
  const nada = motivo => ({ ok: false, amostras: [], removidas: 0, dispersao: null, motivo });
  if (!Array.isArray(descritores) || descritores.length < MIN_AMOSTRAS || descritores.length > MAX_AMOSTRAS) return nada('quantidade');
  const validos = descritores.map(validarDescritor);
  if (validos.some(v => !v)) return nada('formato');
  // o mesmo vetor duas vezes não é amostra nova (quadro repetido)
  const unicos = [];
  for (const v of validos) if (!unicos.some(u => distancia(u, v) < QUADROS_MIN)) unicos.push(v);
  if (unicos.length < MIN_AMOSTRAS) return nada('repetidas');
  // sai a pior de cada vez (a que mais se afasta das outras) e a conta é refeita sem ela: uma amostra ruim não
  // empurra as boas para fora
  const ficam = unicos.slice();
  while (ficam.length >= MIN_AMOSTRAS) {
    const med = ficam.map((v, i) => mediana(ficam.filter((_, j) => j !== i).map(u => distancia(v, u))));
    const pior = med.indexOf(Math.max(...med));
    if (med[pior] <= DISPERSAO_MAX) break;
    ficam.splice(pior, 1);
  }
  if (ficam.length < MIN_AMOSTRAS) return nada('dispersao');
  const d = pares(ficam);
  return {
    ok: true, amostras: ficam, removidas: descritores.length - ficam.length,
    dispersao: { max: tres(Math.max(...d)), mediana: tres(mediana(d)) },
  };
}

/** Prova de vida mandada pela página ({piscadas: [{ini, fim}], quadros, fps}, ms desde que recebeu o desafio).
    É fraca (a de verdade roda no navegador): confere o que dá. → { ok, formato?, motivo? } */
export function conferirProva(prova, pedidas, decorridoMs = DESAFIO_MS) {
  if (!prova || typeof prova !== 'object' || !Array.isArray(prova.piscadas) || prova.piscadas.length > 10) return { ok: false, formato: true };
  const { piscadas, quadros, fps } = prova;
  if (!piscadas.every(p => p && Number.isFinite(p.ini) && Number.isFinite(p.fim))) return { ok: false, formato: true };
  if (!Number.isInteger(quadros) || quadros < 1 || !Number.isFinite(fps)) return { ok: false, formato: true };
  if (fps < FPS_MIN || fps > FPS_MAX) return { ok: false, motivo: 'fps' };
  if (piscadas.length !== pedidas && piscadas.length !== pedidas + 1) return { ok: false, motivo: 'quantas' };
  const teto = Math.min(DESAFIO_MS, decorridoMs + FOLGA_MS);
  let fimAntes = 0;
  for (const { ini, fim } of piscadas) {
    const dur = fim - ini;
    if (dur < PISCADA_MIN || dur > PISCADA_MAX) return { ok: false, motivo: 'duracao' };
    if (ini < fimAntes || fim > teto) return { ok: false, motivo: 'tempo' };   // fora de ordem, ou depois do que já passou
    fimAntes = fim;
  }
  return { ok: true };
}

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
/** 'AAAA-MM-DD' em America/Sao_Paulo */
export function diaSP(data = new Date()) {
  const o = {};
  for (const p of fmtDia.formatToParts(data)) o[p.type] = p.value;
  return `${o.year}-${o.month}-${o.day}`;
}

/* ---------- A trava ---------- */

function escolherPasta(pasta, simulado, travaAberta) {
  const p = path.resolve(pasta || (simulado || travaAberta ? PASTA_SIMULADO : PASTA_PADRAO));
  // teste e preview nunca tocam no cadastro de verdade
  if ((simulado || travaAberta) && p.toLowerCase() === path.resolve(PASTA_PADRAO).toLowerCase()) return path.resolve(PASTA_SIMULADO);
  return p;
}

export function criarRosto({
  pasta,
  simulado = process.argv.includes('--simulado') || process.env.JARVIS_SIMULADO === '1',
  rpID = 'localhost', origem = 'http://localhost:8790', rpNome = 'Cérebro da Lube',
  usuario = { nome: 'julio', exibicao: 'Júlio' },
  agora = () => new Date(),
  webauthn,                  // padrão: import('@simplewebauthn/server'); o teste injeta um falso
  travaAberta = false,       // SÓ teste/preview: libera tudo
  log = () => {},
} = {}) {
  const PASTA = escolherPasta(pasta, simulado, travaAberta);
  const arq = nome => path.join(PASTA, nome);
  if (travaAberta) log('rosto: TRAVA DO ROSTO DESLIGADA (só teste)');

  let libWebauthn = null;
  const carregarWebauthn = () => (libWebauthn ??= (webauthn ? Promise.resolve(webauthn) : import('@simplewebauthn/server')));

  /* ----- leitura (na partida; daí em diante a memória é a verdade e o disco é escrito antes de mudar a memória) ----- */
  function lerJson(nome) {
    let txt;
    try { txt = fs.readFileSync(arq(nome), 'utf8'); }
    catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') log(`rosto: não consegui ler o ${nome} (${e.code || 'erro'})`); return null; }
    try { return JSON.parse(txt); }
    catch (_) { guardarAParte(nome); return null; }
  }
  function guardarAParte(nome) {
    // nada se apaga: o arquivo estragado fica ao lado (o "Apagar meu cadastro" leva junto)
    try { fs.renameSync(arq(nome), arq(`${nome}.ilegivel-${Date.now()}`)); } catch (_) { /* nada */ }
    log(`rosto: o ${nome} estava ilegível e foi guardado à parte`);
  }

  function carregarCadastro() {
    const c = lerJson('cadastro.json');
    if (!c) return null;
    const amostras = Array.isArray(c.amostras) ? c.amostras.map(validarDescritor) : [];
    if (c.dimensao !== DIMENSAO || amostras.length < MIN_AMOSTRAS || amostras.length > MAX_AMOSTRAS || amostras.some(a => !a)) {
      guardarAParte('cadastro.json');
      return null;
    }
    return { ...c, amostras };
  }
  function carregarHello() {
    const h = lerJson('hello.json');
    if (!h) return null;
    const c = h.credencial;
    if (typeof h.usuario_id !== 'string' || !c || typeof c.id !== 'string' || !c.id || typeof c.chave_publica !== 'string'
      || !Number.isInteger(c.contador) || c.contador < 0) { guardarAParte('hello.json'); return null; }
    return h;
  }
  function carregarEstado() {
    const e = lerJson('estado.json') || {};
    return {
      versao: 1,
      dia: typeof e.dia === 'string' ? e.dia : null,
      metodo: ['rosto', 'hello', 'cadastro'].includes(e.metodo) ? e.metodo : null,
      em: typeof e.em === 'string' ? e.em : null,
      falhas: Number.isInteger(e.falhas) && e.falhas > 0 ? Math.min(e.falhas, FALHAS_ATE_HELLO) : 0,
      bloqueado_ate: typeof e.bloqueado_ate === 'string' && Number.isFinite(Date.parse(e.bloqueado_ate)) ? e.bloqueado_ate : null,
    };
  }

  let cad = carregarCadastro();
  let hello = carregarHello();
  let est = carregarEstado();
  let desafio = null;          // {id, piscadas, criado, expira}: um por vez, vale uma conferência
  const usados = [];           // ids de desafio já usados (os últimos 20)
  let pendHello = null;        // {tipo, challenge, expira, usuarioId?}

  /* ----- escrita segura: .tmp + rename, em fila (uma de cada vez) ----- */
  let filaDisco = Promise.resolve();
  function gravar(nome, obj) {
    const tarefa = async () => {
      await fsp.mkdir(PASTA, { recursive: true });
      const tmp = arq(`${nome}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
      await fsp.writeFile(tmp, JSON.stringify(obj, null, 1), { encoding: 'utf8', mode: 0o600 });
      for (let i = 0; ; i++) {
        try { await fsp.rename(tmp, arq(nome)); return; }
        catch (e) {
          // no Windows o antivírus pode segurar o arquivo por um instante
          if (i >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { await fsp.rm(tmp, { force: true }).catch(() => {}); throw e; }
          await new Promise(r => setTimeout(r, 50 * (i + 1)));
        }
      }
    };
    const p = filaDisco.then(tarefa, tarefa);
    filaDisco = p.catch(() => {});
    return p;
  }
  async function apagarArquivos() {
    let nomes = [];
    try { nomes = await fsp.readdir(PASTA); } catch (_) { return; }
    for (const n of nomes) {
      if (/^(cadastro|hello)\.json(\..*)?$/.test(n) || /\.tmp$/.test(n)) await fsp.rm(arq(n), { force: true });
    }
  }

  /* um pedido que muda o estado de cada vez (as contas usam a memória, que só muda depois de gravar) */
  let filaPedidos = Promise.resolve();
  function emFila(fn) {
    const p = filaPedidos.then(fn, fn);
    filaPedidos = p.catch(() => {});
    return p;
  }

  /* ----- estado ----- */
  const ms = () => agora().getTime();
  const temCadastro = () => !!(cad || hello);
  function normalizar(t = ms()) {
    // bloqueio vencido: começa uma rodada nova de tentativas (a mesma regra vale ao ler o arquivo de novo)
    if (est.bloqueado_ate && t >= Date.parse(est.bloqueado_ate)) est = { ...est, falhas: 0, bloqueado_ate: null };
  }
  function bloqueado(t = ms()) { normalizar(t); return !!est.bloqueado_ate; }
  function liberado() {
    if (travaAberta) return true;
    return temCadastro() && !!est.dia && est.dia === diaSP(agora());
  }
  function estado() {
    const t = ms();
    normalizar(t);
    const lib = liberado();
    const o = {
      ok: true, liberado: lib, dia: diaSP(new Date(t)),
      cadastro: { rosto: !!cad, amostras: cad ? cad.amostras.length : 0 },
      hello: { cadastrado: !!hello },
      tentativas_restantes: Math.max(0, FALHAS_ATE_HELLO - est.falhas),
      precisa_cadastro: !temCadastro(),
    };
    if (lib && est.dia === o.dia && est.metodo) { o.metodo = est.metodo; o.em = est.em; }
    if (cad?.criado_em) o.cadastro.criado_em = cad.criado_em;
    if (hello?.criado_em) o.hello.criado_em = hello.criado_em;
    if (est.bloqueado_ate) o.bloqueado_ate = est.bloqueado_ate;
    if (travaAberta) o.trava_aberta = true;
    return o;
  }
  async function salvarEstado(novo) {
    const e = { versao: 1, ...novo };
    await gravar('estado.json', e);
    est = e;
  }
  async function liberar(metodo) {
    const t = agora();
    await salvarEstado({ dia: diaSP(t), metodo, em: t.toISOString(), falhas: 0, bloqueado_ate: null });
    log(`rosto: liberado (${metodo})`);
  }
  async function contarFalha() {
    const t = ms();
    normalizar(t);
    const falhas = Math.min(FALHAS_ATE_HELLO, est.falhas + 1);
    const bloq = falhas >= FALHAS_ATE_HELLO ? new Date(t + BLOQUEIO_MS).toISOString() : null;
    await salvarEstado({ ...est, falhas, bloqueado_ate: bloq });
    log(`rosto: não conferiu (${falhas} de ${FALHAS_ATE_HELLO})${bloq ? ' — rosto bloqueado por 10 min, fica o Windows Hello' : ''}`);
    return { tentativas_restantes: FALHAS_ATE_HELLO - falhas, ...(bloq ? { bloqueado_ate: bloq } : {}) };
  }

  /* ----- respostas ----- */
  function exigirLiberado(res, erro) {
    if (liberado()) return true;
    if (typeof erro === 'function') erro(res, 423, MSG_TRAVA, 'trava');
    else responderJson(res, 423, { erro: 'trava', mensagem: MSG_TRAVA });
    return false;
  }
  function responderJson(res, status, obj) {
    const corpo = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(corpo) });
    res.end(corpo);
  }

  /* ----- rotas ----- */
  async function tratar(ctx) {
    const { req, res, url } = ctx;
    const p = url?.pathname || '';
    if (!p.startsWith('/api/rosto/')) return false;
    const metodo = ctx.metodo || req.method;
    const json = (st, obj) => ctx.json(res, st, obj);
    const erro = (st, msg, cod) => ctx.erro(res, st, msg, cod);
    const rota = ROTAS[p.slice('/api/rosto/'.length)];
    if (!rota) { erro(404, 'Rota desconhecida.', 'rota'); return true; }
    if (rota.metodo !== metodo) { erro(405, 'Método não permitido.', 'metodo'); return true; }
    let corpo = {};
    if (metodo === 'POST') {
      try { corpo = await ctx.lerCorpoJson(req); }
      catch (e) {
        const st = e?.status || 400;
        erro(st, st === 413 ? 'O pedido passou de 1 MB.' : st === 415 ? 'Mande JSON (Content-Type: application/json).' : 'JSON inválido.');
        return true;
      }
      if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) { erro(400, 'Mande um objeto JSON.', 'corpo'); return true; }
    }
    try {
      await (metodo === 'POST' ? emFila(() => rota.fn(corpo, json, erro, res)) : rota.fn(corpo, json, erro, res));
    } catch (e) {
      // pasta sem acesso (gravar falhou) ou erro inesperado: só o nome do erro vai para o log
      const disco = e && typeof e.code === 'string' && /^E[A-Z]+$/.test(e.code);
      log(`rosto: ${disco ? `não consegui gravar na pasta (${e.code})` : `erro (${e?.name || 'erro'})`}`);
      if (!res.headersSent) {
        if (disco) erro(503, 'Não consegui gravar o cadastro do rosto neste computador.', 'sem-pasta');
        else erro(500, 'Erro na trava do rosto. O detalhe ficou no log do servidor.', 'erro');
      }
    }
    return true;
  }

  function lerConsultas(lista, min, max) {
    if (!Array.isArray(lista) || lista.length < min || lista.length > max) return null;
    const v = lista.map(validarDescritor);
    return v.some(x => !x) ? null : v;
  }

  const ROTAS = {
    estado: { metodo: 'GET', fn: (_c, json) => json(200, estado()) },

    desafio: {
      metodo: 'POST',
      async fn(_c, json, erro) {
        if (!cad) { erro(404, 'Ainda não há rosto cadastrado.', 'sem-cadastro'); return; }
        if (bloqueado()) { json(429, muitas()); return; }
        const t = ms();
        if (desafio) lembrarUsado(desafio.id);
        desafio = { id: crypto.randomBytes(16).toString('base64url'), piscadas: crypto.randomInt(2, 4), criado: t, expira: t + DESAFIO_MS };
        json(200, { id: desafio.id, piscadas: desafio.piscadas, expira_em: new Date(desafio.expira).toISOString() });
      },
    },

    conferir: {
      metodo: 'POST',
      async fn(c, json, erro) {
        if (!cad) { erro(404, 'Ainda não há rosto cadastrado.', 'sem-cadastro'); return; }
        if (bloqueado()) { json(429, muitas()); return; }
        const consultas = lerConsultas(c.descritores, MIN_CONSULTAS, MAX_CONSULTAS);
        if (!consultas) { erro(400, `Mande de ${MIN_CONSULTAS} a ${MAX_CONSULTAS} descritores de ${DIMENSAO} números.`, 'descritores'); return; }
        if (typeof c.desafio !== 'string' || !c.desafio) { erro(400, 'Falta o desafio.', 'desafio'); return; }
        const t = ms();
        if (!desafio || desafio.id !== c.desafio) {
          if (usados.includes(c.desafio)) erro(409, 'Este desafio já foi usado. Comece de novo.', 'desafio-usado');
          else erro(410, 'O desafio venceu. Comece de novo.', 'desafio-expirou');
          return;
        }
        const d = desafio;
        desafio = null;                // vale uma conferência só, dê certo ou não
        lembrarUsado(d.id);
        if (t > d.expira) { erro(410, 'O desafio venceu. Comece de novo.', 'desafio-expirou'); return; }
        const pv = conferirProva(c.prova, d.piscadas, t - d.criado);
        if (pv.formato) { erro(400, 'O resumo do piscar veio errado.', 'prova'); return; }

        // os quadros são de verdade: nem o mesmo vetor repetido, nem pessoas diferentes, nem cópia de uma amostra guardada
        const entre = pares(consultas);
        const copia = consultas.some(q => cad.amostras.some(a => distancia(q, a) < QUADROS_MIN));
        if (Math.min(...entre) < QUADROS_MIN || Math.max(...entre) > QUADROS_MAX || copia) {
          const r = await contarFalha();
          json(403, { erro: 'quadros', mensagem: 'Os quadros da câmera não parecem de verdade. Tente de novo.', ...r });
          return;
        }
        if (!pv.ok) {
          const r = await contarFalha();
          json(403, { erro: 'prova-de-vida', mensagem: `Não vi as ${d.piscadas} piscadas. Tente de novo.`, ...r });
          return;
        }
        const conta = conferirDescritores(consultas, cad.amostras, LIMIAR);
        if (!conta.confere) {
          const r = await contarFalha();
          json(403, { erro: 'nao-confere', mensagem: 'Não reconheci. Tente de novo.', distancia: tres(conta.distancia), ...r });
          return;
        }
        await liberar('rosto');
        json(200, { ok: true, liberado: true, metodo: 'rosto', distancia: tres(conta.distancia) });
      },
    },

    cadastro: {
      metodo: 'POST',
      async fn(c, json, erro) {
        if (temCadastro() && !liberado()) { erro(409, 'Já existe um cadastro. Faça o reconhecimento antes de cadastrar de novo.', 'cadastro-existe'); return; }
        const av = avaliarCadastro(c.descritores);
        if (!av.ok) {
          if (av.motivo === 'formato') erro(400, `Cada descritor tem que ter ${DIMENSAO} números.`, 'descritores');
          else erro(400, MSG_AMOSTRAS, 'amostras');
          return;
        }
        const t = agora();
        const novo = {
          versao: 1, modelo: MODELO, dimensao: DIMENSAO, limiar: LIMIAR, criado_em: t.toISOString(),
          amostras: av.amostras, dispersao: av.dispersao,
        };
        await gravar('cadastro.json', novo);
        cad = novo;
        desafio = null;
        log(`rosto: cadastro novo (${av.amostras.length} amostras)`);
        await liberar('cadastro');
        json(200, { ok: true, amostras: av.amostras.length, dispersao: av.dispersao });
      },
    },

    apagar: {
      metodo: 'POST',
      async fn(c, json, erro, res) {
        if (!exigirLiberado(res, (r, st, msg, cod) => erro(st, msg, cod))) return;
        if (c.confirmar !== true) { erro(400, 'Mande {"confirmar": true}.', 'confirmar'); return; }
        await apagarArquivos();
        cad = null; hello = null; desafio = null; pendHello = null;
        await salvarEstado({ dia: null, metodo: null, em: null, falhas: 0, bloqueado_ate: null });
        log('rosto: cadastro apagado');
        json(200, { ok: true });
      },
    },

    travar: {
      metodo: 'POST',
      async fn(_c, json) {
        // travar vale na hora, mesmo se o disco falhar (gravar é só para sobreviver a reiniciar)
        est = { ...est, dia: null, metodo: null, em: null };
        try { await gravar('estado.json', est); } catch (e) { log(`rosto: travado só na memória (${e?.code || 'erro'})`); }
        log('rosto: travado');
        json(200, { ok: true });
      },
    },

    'hello/opcoes': {
      metodo: 'POST',
      async fn(c, json, erro) {
        if (c.tipo !== 'cadastro' && c.tipo !== 'entrada') { erro(400, 'Mande {"tipo": "cadastro"} ou {"tipo": "entrada"}.', 'tipo'); return; }
        if (c.tipo === 'cadastro' && temCadastro() && !liberado()) { erro(409, 'Já existe um cadastro. Faça o reconhecimento antes de cadastrar o Windows Hello.', 'cadastro-existe'); return; }
        if (c.tipo === 'entrada' && !hello) { erro(404, 'O Windows Hello ainda não foi cadastrado.', 'sem-hello'); return; }
        const wa = await webauthnOuErro(erro);
        if (!wa) return;
        const t = ms();
        if (c.tipo === 'cadastro') {
          const usuarioId = hello?.usuario_id || crypto.randomBytes(16).toString('base64url');
          const opcoes = await wa.generateRegistrationOptions({
            rpName: rpNome, rpID, userName: usuario.nome, userDisplayName: usuario.exibicao,
            userID: new Uint8Array(Buffer.from(usuarioId, 'base64url')),
            attestationType: 'none', timeout: 60000,
            authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'discouraged', userVerification: 'required' },
            excludeCredentials: hello ? [{ id: hello.credencial.id, transports: hello.credencial.transportes }] : [],
            supportedAlgorithmIDs: ALGORITMOS,
          });
          pendHello = { tipo: 'cadastro', challenge: opcoes.challenge, expira: t + HELLO_MS, usuarioId };
          json(200, opcoes);
          return;
        }
        const opcoes = await wa.generateAuthenticationOptions({
          rpID, allowCredentials: [{ id: hello.credencial.id, transports: hello.credencial.transportes }],
          userVerification: 'required', timeout: 60000,
        });
        pendHello = { tipo: 'entrada', challenge: opcoes.challenge, expira: t + HELLO_MS };
        json(200, opcoes);
      },
    },

    'hello/cadastrar': {
      metodo: 'POST',
      async fn(c, json, erro) {
        const pend = tirarPendHello('cadastro', erro);
        if (!pend) return;
        if (temCadastro() && !liberado()) { erro(409, 'Já existe um cadastro. Faça o reconhecimento antes de cadastrar o Windows Hello.', 'cadastro-existe'); return; }
        if (!c.resposta || typeof c.resposta !== 'object') { erro(400, 'Falta a resposta do Windows Hello.', 'hello-falhou'); return; }
        const wa = await webauthnOuErro(erro);
        if (!wa) return;
        let v;
        try {
          v = await wa.verifyRegistrationResponse({
            response: c.resposta, expectedChallenge: pend.challenge, expectedOrigin: origem, expectedRPID: rpID,
            requireUserVerification: true, supportedAlgorithmIDs: ALGORITMOS,
          });
        } catch (_) { v = null; }
        const cred = v?.verified ? v.registrationInfo?.credential : null;
        if (!cred || typeof cred.id !== 'string' || !cred.publicKey) {
          log('rosto: o Windows Hello não conferiu (cadastro)');
          erro(400, 'O Windows Hello não confirmou. Tente de novo.', 'hello-falhou');
          return;
        }
        const primeiro = !temCadastro();
        const novo = {
          versao: 1, usuario_id: pend.usuarioId, criado_em: agora().toISOString(),
          credencial: {
            id: cred.id, chave_publica: Buffer.from(cred.publicKey).toString('base64url'),
            contador: Number.isInteger(cred.counter) && cred.counter >= 0 ? cred.counter : 0,
            transportes: Array.isArray(cred.transports) ? cred.transports.filter(x => typeof x === 'string').slice(0, 8) : undefined,
          },
        };
        await gravar('hello.json', novo);
        hello = novo;
        log('rosto: Windows Hello cadastrado');
        if (primeiro) await liberar('cadastro');   // sem câmera, o Hello sozinho é o cadastro de confiança
        json(200, { ok: true });
      },
    },

    'hello/conferir': {
      metodo: 'POST',
      async fn(c, json, erro) {
        if (!hello) { erro(404, 'O Windows Hello ainda não foi cadastrado.', 'sem-hello'); return; }
        const pend = tirarPendHello('entrada', erro);
        if (!pend) return;
        const r = c.resposta;
        const cr = hello.credencial;
        const falhou = () => { log('rosto: o Windows Hello não conferiu'); erro(403, 'O Windows Hello não confirmou. Tente de novo.', 'hello-falhou'); };
        // a biblioteca não confere se a resposta é da credencial guardada: conferir aqui
        if (!r || typeof r !== 'object' || r.id !== cr.id || (r.rawId !== undefined && r.rawId !== cr.id)) { falhou(); return; }
        const wa = await webauthnOuErro(erro);
        if (!wa) return;
        let v;
        try {
          v = await wa.verifyAuthenticationResponse({
            response: r, expectedChallenge: pend.challenge, expectedOrigin: origem, expectedRPID: rpID,
            credential: { id: cr.id, publicKey: new Uint8Array(Buffer.from(cr.chave_publica, 'base64url')), counter: cr.contador, transports: cr.transportes },
            requireUserVerification: true,
          });
        } catch (_) { v = null; }
        if (!v?.verified) { falhou(); return; }
        const n = v.authenticationInfo?.newCounter;
        if (Number.isInteger(n) && n >= 0 && n !== cr.contador) {
          const novo = { ...hello, credencial: { ...cr, contador: n } };
          await gravar('hello.json', novo);
          hello = novo;
        }
        await liberar('hello');
        json(200, { ok: true, liberado: true, metodo: 'hello' });
      },
    },
  };

  function muitas() {
    return {
      erro: 'muitas-tentativas', mensagem: 'Muitas tentativas com o rosto. Use o Windows Hello ou espere 10 minutos.',
      tentativas_restantes: 0, tentar_em: est.bloqueado_ate, bloqueado_ate: est.bloqueado_ate,
    };
  }
  function lembrarUsado(id) {
    usados.push(id);
    if (usados.length > 20) usados.shift();
  }
  function tirarPendHello(tipo, erro) {
    const p = pendHello;
    if (!p || p.tipo !== tipo) { erro(410, 'O pedido do Windows Hello venceu. Comece de novo.', 'desafio-expirou'); return null; }
    pendHello = null;           // vale uma resposta só
    if (ms() > p.expira) { erro(410, 'O pedido do Windows Hello venceu. Comece de novo.', 'desafio-expirou'); return null; }
    return p;
  }
  async function webauthnOuErro(erro) {
    try { return await carregarWebauthn(); }
    catch (_) {
      libWebauthn = null;
      log('rosto: falta o pacote @simplewebauthn/server (rode o npm install na pasta servidor)');
      erro(503, 'O Windows Hello não está pronto neste app. Rode o npm install na pasta servidor.', 'sem-hello-lib');
      return null;
    }
  }

  return { liberado, estado, exigirLiberado, tratar, get pasta() { return PASTA; } };
}
