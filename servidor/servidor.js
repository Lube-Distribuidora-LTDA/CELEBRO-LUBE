/* Cérebro da Lube — servidor/servidor.js: o app local.
   node servidor/servidor.js [--simulado] [--abrir]
   Escuta SÓ em 127.0.0.1:8790 e serve:
     GET  /                         o painel (web/index.html) com a meta tag cerebro-token desta partida
     GET  /<arquivo>                os arquivos de web/ (css, js…)
     GET  /api/vault                as notas do vault: {vaultName, files:[{path, text, size, mtime}]}
     GET  /api/events               SSE: evento `change` quando uma nota muda
     GET  /api/saude                select saude.painel() no DATA WAREHOUSE (o JSON do Guardião)
     GET  /api/jarvis/estado        o que está ligado (cérebro, banco, e-mail, arquivos) — com token
     POST /api/jarvis/turno         uma fala do Júlio → SSE com texto, ferramenta, cartao, acao, modelo, fim, erro — com token
     POST /api/jarvis/acao/:id      {decisao:'confirmar'|'recusar'} — com token; SÓ a interface chama
   Segurança: Host tem que ser localhost:8790 ou 127.0.0.1:8790 (contra DNS rebinding); Origin, quando vem, tem que ser a
   própria página; toda rota /api/ (menos os GET de leitura do vault, eventos e saúde) exige x-cerebro-token, um valor
   aleatório gerado a cada partida e entregue só na página servida aqui (contra outro site aberto no navegador mandar o
   Jarvis enviar e-mail). Corpo até 1 MB, só JSON. Sem CORS. A página não pode ser posta em iframe. */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { carregarConfig, resumoConfig, WEB } from './config.js';
import { criarVault } from './vault.js';
import { criarBanco } from './banco.js';
import { decidir, quantasPendentes } from './acoes.js';
import { limparConversa } from './conversa.js';
import { log } from './util.js';

const cfg = carregarConfig();
const PORTA = cfg.porta;
const TOKEN = crypto.randomBytes(32).toString('base64url');
const HOSTS = new Set([`localhost:${PORTA}`, `127.0.0.1:${PORTA}`]);
const ORIGENS = new Set([`http://localhost:${PORTA}`, `http://127.0.0.1:${PORTA}`]);
const MAX_CORPO = 1024 * 1024;
const SEG = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.task': 'application/octet-stream',
};

/* ---------- Peças ---------- */
const clientesEventos = new Set();
const vault = criarVault(cfg.vaultDir, {
  onMudou(lista) {
    const dados = `event: change\ndata: ${JSON.stringify({ notas: lista.slice(0, 50) })}\n\n`;
    for (const res of clientesEventos) { try { res.write(dados); } catch (_) { /* cliente caiu */ } }
  },
});
const banco = criarBanco(cfg.banco);
let cerebro;
if (cfg.simulado) {
  const { criarCerebroSimulado } = await import('./simulado.js');
  cerebro = criarCerebroSimulado({ cfg, vault, banco });
} else {
  const { criarCerebro } = await import('./cerebro.js');
  cerebro = criarCerebro({ cfg, vault, banco });
}

/* ---------- Respostas ---------- */
function json(res, status, obj, extra = {}) {
  const corpo = JSON.stringify(obj);
  res.writeHead(status, { ...SEG, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(corpo), ...extra });
  res.end(corpo);
}
function erro(res, status, mensagem, codigo) { json(res, status, { erro: codigo || 'erro', mensagem }); }

function tokenOk(req) {
  const v = req.headers['x-cerebro-token'];
  if (typeof v !== 'string' || !v) return false;
  const a = Buffer.from(v), b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function lerCorpoJson(req) {
  const tipo = String(req.headers['content-type'] || '').toLowerCase();
  if (!tipo.startsWith('application/json')) { const e = new Error('tipo'); e.status = 415; throw e; }
  const tam = Number(req.headers['content-length'] || 0);
  if (tam > MAX_CORPO) { const e = new Error('grande'); e.status = 413; throw e; }
  const partes = [];
  let total = 0;
  for await (const p of req) {
    total += p.length;
    if (total > MAX_CORPO) { const e = new Error('grande'); e.status = 413; throw e; }
    partes.push(p);
  }
  try { return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'); }
  catch (_) { const e = new Error('json'); e.status = 400; throw e; }
}

function abrirSse(res) {
  res.writeHead(200, { ...SEG, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.socket?.setNoDelay(true);
  res.write(': ok\n\n');
  const ping = setInterval(() => { if (!res.writableEnded && !res.destroyed) res.write(': ping\n\n'); }, 15000);
  return {
    enviar(ev, dados) { if (!res.writableEnded && !res.destroyed) res.write(`event: ${ev}\ndata: ${JSON.stringify(dados ?? {})}\n\n`); },
    fechar() { clearInterval(ping); if (!res.writableEnded) res.end(); },
  };
}

/* O index.html do painel é um "conteúdo de página" (o artifact embrulha); aqui ele ganha o esqueleto e a meta tag. */
async function servirIndex(res, cabeca) {
  let html;
  try { html = await fsp.readFile(path.join(WEB, 'index.html'), 'utf8'); } catch (_) { erro(res, 500, 'Não achei o web/index.html.'); return; }
  const metas = `<meta name="cerebro-token" content="${TOKEN}">\n${cfg.simulado ? '<meta name="cerebro-simulado" content="1">\n' : ''}`;
  let pagina;
  if (/^\s*<!doctype/i.test(html)) pagina = html.replace(/<head[^>]*>/i, m => `${m}\n${metas}`);
  else {
    pagina = '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
      + metas + '</head>\n<body>\n' + html + '\n</body>\n</html>\n';
  }
  res.writeHead(200, { ...SEG, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(pagina) });
  res.end(cabeca ? undefined : pagina);
}

async function servirEstatico(req, res, url, cabeca) {
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch (_) { erro(res, 400, 'Endereço inválido.'); return; }
  const partes = rel.split('/').filter(Boolean);
  if (partes.some(p => p.startsWith('.') || p.includes('\\') || p.includes('\0'))) { erro(res, 404, 'Não encontrado.'); return; }
  const abs = path.resolve(WEB, ...partes);
  const relWeb = path.relative(WEB, abs);
  if (!relWeb || relWeb.startsWith('..') || path.isAbsolute(relWeb)) { erro(res, 404, 'Não encontrado.'); return; }
  let st;
  try { st = await fsp.stat(abs); } catch (_) { erro(res, 404, 'Não encontrado.'); return; }
  if (!st.isFile()) { erro(res, 404, 'Não encontrado.'); return; }
  res.writeHead(200, { ...SEG, 'Content-Type': TIPOS[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
  if (cabeca) { res.end(); return; }
  fs.createReadStream(abs).on('error', () => res.destroy()).pipe(res);
}

function estado() {
  const raizes = cfg.raizes.filter(r => { try { return fs.statSync(r).isDirectory(); } catch (_) { return false; } });
  return {
    ok: true, tipo: 'local', voz: true,
    ...cerebro.estado(),
    motivo: cfg.simulado ? cfg.motivoSimulado : undefined,
    conexoes: {
      vault: vault.existe(), banco: banco.configurado, email_leitura: !!cfg.imap, email_envio: !!cfg.smtp,
      arquivos: raizes, internet: !cfg.simulado,
    },
    acoes_pendentes: quantasPendentes(),
  };
}

/* ---------- Rotas ---------- */
async function tratar(req, res) {
  const host = String(req.headers.host || '').toLowerCase();
  if (!HOSTS.has(host)) { erro(res, 421, 'Endereço não permitido.', 'host'); return; }
  const origem = req.headers.origin;
  if (origem !== undefined && !ORIGENS.has(String(origem))) { erro(res, 403, 'Origem não permitida.', 'origem'); return; }
  let url;
  try { url = new URL(req.url, `http://${host}`); } catch (_) { erro(res, 400, 'Endereço inválido.'); return; }
  const p = url.pathname;
  const m = req.method;

  if (p.startsWith('/api/')) {
    if (req.headers['sec-fetch-site'] === 'cross-site') { erro(res, 403, 'Origem não permitida.', 'origem'); return; }
    if (m === 'OPTIONS') { erro(res, 403, 'Sem CORS.', 'origem'); return; }

    if (p === '/api/vault' && m === 'GET') {
      if (!vault.existe()) { erro(res, 503, `A pasta do vault não está acessível (${cfg.vaultDir}).`, 'sem-vault'); return; }
      const d = await vault.ler();
      json(res, 200, { vaultName: d.vaultName, files: d.files });
      return;
    }
    if (p === '/api/events' && m === 'GET') {
      res.writeHead(200, { ...SEG, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(': ao vivo\n\n');
      clientesEventos.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) { /* caiu */ } }, 25000);
      res.on('close', () => { clearInterval(ping); clientesEventos.delete(res); });
      return;
    }
    if (p === '/api/saude' && m === 'GET') {
      if (!banco.configurado) { erro(res, 503, 'O banco não está configurado no ENV deste computador.', 'sem-banco'); return; }
      try {
        const painel = await banco.painelSaude();
        if (!painel) { erro(res, 502, 'O saude.painel() não devolveu nada.', 'sem-guardiao'); return; }
        json(res, 200, painel);
      } catch (e) {
        log('saúde: a leitura falhou', e?.codigo || e?.code || '');
        erro(res, 502, e?.codigo ? e.message : 'Não consegui ler a saúde no banco agora.', 'banco');
      }
      return;
    }

    if (!tokenOk(req)) { erro(res, 401, 'Falta o token desta página (x-cerebro-token).', 'token'); return; }

    if (p === '/api/jarvis/estado' && m === 'GET') { json(res, 200, estado()); return; }

    if (p === '/api/jarvis/turno' && m === 'POST') {
      let corpo;
      try { corpo = await lerCorpoJson(req); }
      catch (e) { erro(res, e.status || 400, e.status === 413 ? 'O pedido passou de 1 MB.' : e.status === 415 ? 'Mande JSON (Content-Type: application/json).' : 'JSON inválido.'); return; }
      try { limparConversa(corpo && corpo.conversa); }
      catch (e) { erro(res, 400, e.message, 'conversa'); return; }
      const ctl = new AbortController();
      res.on('close', () => { if (!res.writableFinished) ctl.abort(new Error('conexão fechada')); });
      const sse = abrirSse(res);
      try {
        await cerebro.turno({ conversa: corpo.conversa, contexto: corpo.contexto }, sse.enviar, ctl.signal);
      } catch (e) {
        if (!ctl.signal.aborted) {
          log('turno: erro', e?.name || '', e?.message ? String(e.message).slice(0, 200) : '');
          sse.enviar('erro', { mensagem: e?.codigo ? e.message : 'Algo deu errado no cérebro do Jarvis. O detalhe ficou no log do servidor.' });
          sse.enviar('fim', { motivo: 'erro' });
        }
      } finally {
        sse.fechar();
      }
      return;
    }

    const ma = p.match(/^\/api\/jarvis\/acao\/([A-Za-z0-9_-]{4,80})$/);
    if (ma && m === 'POST') {
      let corpo;
      try { corpo = await lerCorpoJson(req); }
      catch (e) { erro(res, e.status || 400, 'Pedido inválido.'); return; }
      const decisao = corpo && corpo.decisao;
      if (decisao !== 'confirmar' && decisao !== 'recusar') { erro(res, 400, 'Mande {"decisao":"confirmar"} ou {"decisao":"recusar"}.', 'decisao'); return; }
      const r = await decidir(ma[1], decisao);
      json(res, r.status, { ok: r.ok, mensagem: r.mensagem });
      return;
    }
    erro(res, 404, 'Rota desconhecida.', 'rota');
    return;
  }

  if (m !== 'GET' && m !== 'HEAD') { erro(res, 405, 'Método não permitido.', 'metodo'); return; }
  if (p === '/' || p === '/index.html') { await servirIndex(res, m === 'HEAD'); return; }
  await servirEstatico(req, res, url, m === 'HEAD');
}

const servidor = http.createServer((req, res) => {
  tratar(req, res).catch(e => {
    log('servidor: erro', e?.name || '', e?.message ? String(e.message).slice(0, 200) : '');
    if (!res.headersSent) erro(res, 500, 'Erro no servidor do cérebro.');
    else try { res.end(); } catch (_) { /* nada */ }
  });
});
servidor.headersTimeout = 20000;
servidor.requestTimeout = 60000;

function abrirEdge() {
  const url = `http://localhost:${PORTA}`;
  const edges = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const edge = edges.find(e => fs.existsSync(e));
  try {
    if (edge) spawn(edge, [`--app=${url}`], { detached: true, stdio: 'ignore' }).unref();
    else spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch (_) { log(`Abra ${url} no Edge.`); }
}

servidor.on('error', e => {
  if (e && e.code === 'EADDRINUSE') {
    log(`A porta ${PORTA} já está em uso: o Cérebro já deve estar ligado.`);
    if (cfg.abrirNavegador) abrirEdge();
    process.exit(2);
  }
  log('servidor: não consegui ligar', e?.code || '');
  process.exit(1);
});

servidor.listen(PORTA, '127.0.0.1', async () => {
  vault.vigiar();
  const r = resumoConfig(cfg);
  let notas = '?';
  try { notas = vault.existe() ? (await vault.ler()).files.length : 'pasta não encontrada'; } catch (_) { /* nada */ }
  log(`Cérebro da Lube no ar em http://localhost:${PORTA}`);
  log(`  cérebro: ${cfg.simulado ? `simulado (${cfg.motivoSimulado})` : 'Claude Haiku 5.5 (conversa) + Sonnet 5.5 (pesado)'}`);
  log(`  ENV: ${r.env || 'não encontrado'} · banco: ${r.banco ? 'sim' : 'não'} · e-mail: leitura ${r.email_leitura ? 'sim' : 'não'}, envio ${r.email_envio ? 'sim' : 'não'}`);
  log(`  vault: ${notas} notas · arquivos: ${cfg.raizes.join(' ; ')}`);
  if (cfg.abrirNavegador) abrirEdge();
});

async function desligar() {
  log('Desligando o Cérebro…');
  vault.parar();
  for (const res of clientesEventos) { try { res.end(); } catch (_) { /* nada */ } }
  servidor.close();
  await banco.fechar();
  setTimeout(() => process.exit(0), 300).unref();
}
process.on('SIGINT', desligar);
process.on('SIGTERM', desligar);
