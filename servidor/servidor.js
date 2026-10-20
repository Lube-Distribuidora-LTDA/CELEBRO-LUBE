/* Cérebro da Lube — servidor/servidor.js: o app local.
   node servidor/servidor.js [--simulado] [--abrir] [--trava-aberta] [--rosto-pasta=<pasta>] [--ouvido-perfil=<pasta>]
                             [--ouvido-teste=<arquivo.wav>] [--teste-pasta=<pasta>] [--jarvis-pasta=<pasta>]
   Escuta SÓ em 127.0.0.1:8790 e serve:
     GET  /                         o painel (web/index.html) com a meta tag cerebro-token desta partida
     GET  /<arquivo>                os arquivos de web/ (css, js…)
     GET  /api/vault                as notas do vault: {vaultName, files:[{path, text, size, mtime}]}
     GET  /api/events               SSE: evento `change` quando uma nota muda; `jarvis` {acao:'abrir'} quando o atalho
                                    Ctrl+Alt+J chama (guardado 10 s para quem conectar logo depois)
     GET  /api/saude                select saude.painel() no DATA WAREHOUSE (o JSON do Guardião)
     GET  /api/jarvis/estado        o que está ligado (cérebro, banco, e-mail, arquivos, trava, ouvido, pasta do Jarvis,
                                    navegador, construção) — com token
     POST /api/jarvis/turno         uma fala do Júlio → SSE com texto, ferramenta, cartao, acao, camera, modelo, fim, erro
                                    — com token; 423 enquanto a trava do rosto não liberou o dia. contexto.camera (o
                                    quadro da câmera "Ver você") sai do contexto antes de tudo e só vai ao Claude se
                                    olhar_camera for chamada; 400 `camera` se veio estragado ou velho
     POST /api/jarvis/acao/:id      {decisao:'confirmar'|'recusar', motivo?, via?:'voz'|'clique'|'teclado'} → {ok,
                                    mensagem, cartao?, cartoes?, fala?} — com token; SÓ a interface chama; aprovar = 423
                                    travado (recusar passa)
     POST /api/jarvis/camera/quadro {pedido, quadro|null}: o quadro novo que o olhar_camera pediu no turno (evento camera
                                    {acao:'quadro', pedido}) — com token; 423; 404 pedido que não existe; 400 quadro
                                    estragado ou velho. Só na memória: nunca vai para log nem disco
     GET  /api/jarvis/eventos?aba=  SSE da aba: construcao (andamento), acao (nova, trocada, decidida, expirou), cartao,
                                    falar — com token; 423 travado; ao conectar, a construção que roda ou a última desta
                                    aba que terminou há até 15 min (reenvio: true)
     GET  /api/jarvis/arquivo/:id   um print (png, jpg, webp) da pasta do Jarvis pelo id opaco (pasta.registrar), sem
                                    cache — com token; 423 travado; 404; 415 outro tipo. Nada mais da pasta é servido
                                    (a prévia de um projeto abre por file://, nunca daqui: leria o token)
     POST /api/jarvis/abrir         {id, modo:'abrir'|'mostrar'}: abre no Windows (ou mostra no Explorer) um item da pasta
                                    do Jarvis — com token; 423; 404; 415 (o que executa nunca abre). É o clique do Júlio:
                                    a página HTML abre direto (pelo modelo, só com a ação "abrir" aprovada)
     GET  /api/jarvis/construcao    o estado do construtor — com token
     POST /api/jarvis/construcao/parar  para a construção que roda (parar é o lado seguro: sem a trava) — com token; 404
     POST /api/jarvis/chamar        o atalho Ctrl+Alt+J (ferramentas/chamar-jarvis.ps1): SEM o token da página, com o
                                    cabeçalho x-cerebro-atalho = a chave gravada a cada partida em
                                    %LOCALAPPDATA%\CerebroLube\atalho.chave; só pede para a tela abrir o Jarvis
     /api/rosto/*                   a trava do rosto e o Windows Hello (rosto.js; docs/OUVIDO-E-ROSTO.md §5.4) — com token
     /api/ouvido/*                  o ouvido: o Chrome escondido que reconhece a fala no computador (ouvido.js, §3.3) —
                                    com token; o Chrome só abre quando a interface liga o microfone, e fecha com o servidor
   O Jarvis que FAZ (docs/JARVIS-ACOES.md): a pasta do Jarvis (ferramentas/pasta.js; escreve SÓ em OneDrive\JARVIS), o
   navegador escondido (navegador.js, um Chrome próprio sem login) e o construtor (construtor.js, o Agent SDK) nascem
   aqui e fecham com o servidor. Com --simulado (ou sem a chave do Claude: o cérebro de teste), tudo isso fica numa pasta
   TEMPORÁRIA (--teste-pasta, ou uma nova em %TEMP% apagada no fim): a pasta do Jarvis, a chave do atalho, o perfil do
   navegador e o gasto do construtor. Nesse modo a Lixeira é de mentira (move para "Lixeira (simulada)"), "abrir no
   Windows" só registra no log (nenhuma janela abre) e o construtor usa o query de mentira (nada vai para a API).
   Opções: --trava-aberta (SÓ teste: a trava libera tudo, e o rosto usa uma pasta temporária), --rosto-pasta (pasta de
   teste), --teste-pasta e --jarvis-pasta só valem com --simulado: sem ele o servidor recusa e sai (um comando de teste
   esquecido não desliga a trava do app de verdade nem troca a pasta do Jarvis); --ouvido-perfil (perfil de teste do
   Chrome); --ouvido-teste=<.wav> (só com --simulado: o ouvido toca o arquivo no lugar do microfone, servido em
   /teste-ouvido.wav, para provar o caminho Edge → servidor → Chrome sem abrir o microfone). Com --simulado o servidor
   também liga um site de mentira em 127.0.0.1 (a única origem local que o navegador de teste aceita).
   CEREBRO_ABRIR=jarvis no ambiente (o atalho, com o app desligado): o Edge abre já no Jarvis (/#jarvis).
   Segurança: Host tem que ser localhost:8790 ou 127.0.0.1:8790 (contra DNS rebinding); Origin, quando vem, tem que ser a
   própria página; toda rota /api/ (menos os GET de leitura do vault, eventos e saúde) exige x-cerebro-token, um valor
   aleatório gerado a cada partida e entregue só na página servida aqui (contra outro site aberto no navegador mandar o
   Jarvis enviar e-mail). Corpo até 1 MB, só JSON. Sem CORS. A página não pode ser posta em iframe. A página tem uma CSP
   que só deixa ela falar com este app e com as CDNs das bibliotecas (a câmera e o token não vão para outro lugar). A
   trava do rosto é conferida aqui, mas com os números que a página manda: quem abre o console deste computador e tem uma
   foto do Júlio consegue passar (a prova de vida é conferida na página). Ela é uma trava do Jarvis, não do Windows. */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { carregarConfig, resumoConfig, WEB } from './config.js';
import { criarVault } from './vault.js';
import { criarBanco } from './banco.js';
import { decidir, quantasPendentes, MOTIVOS_RECUSA, VIAS, ouvir as ouvirAcoes, avisar as avisarAcoes } from './acoes.js';
import { raizesConhecidas, raizesAcessiveis } from './ferramentas/arquivos.js';
import { criarPastaJarvis, pastaPadrao, extDe } from './ferramentas/pasta.js';
import { quadroValido } from './ferramentas/camera.js';
import { criarNavegador } from './navegador.js';
import { criarConstrutor, queryDeMentira } from './construtor.js';
import { limparConversa } from './conversa.js';
import { criarRosto } from './rosto.js';
import { criarOuvidoChrome, acharChrome } from './ouvido.js';
import { ErroFerramenta, log } from './util.js';

const ARGV = process.argv.slice(2);
// --nome=valor (o valor pode ter espaço se vier entre aspas no comando)
const opcao = (nome) => { const a = ARGV.find(x => x.startsWith(`--${nome}=`)); const v = a ? a.slice(nome.length + 3).trim() : ''; return v || null; };
const TRAVA_ABERTA = ARGV.includes('--trava-aberta');
// o simulado PEDIDO (--simulado ou JARVIS_SIMULADO=1). Não é o cfg.simulado, que também liga quando falta a chave do
// Claude: aí o app é o de verdade (ENV, e-mail, banco) e a trava tem que valer
const SIMULADO_PEDIDO = ARGV.includes('--simulado') || process.env.JARVIS_SIMULADO === '1';
// as opções que mexem na trava e nas pastas são só de teste: no app de verdade um comando copiado ou um atalho
// esquecido desligaria a trava (--trava-aberta), cairia num "primeiro cadastro" novo (--rosto-pasta) ou mudaria onde o
// Jarvis escreve (--teste-pasta, --jarvis-pasta). Recusa e sai.
const OPCOES_TESTE = ['--rosto-pasta', '--teste-pasta', '--jarvis-pasta'];
if ((TRAVA_ABERTA || ARGV.some(x => OPCOES_TESTE.some(o => x.startsWith(o)))) && !SIMULADO_PEDIDO) {
  log('Recusado: --trava-aberta e --rosto-pasta só valem com --simulado (são de teste), e --teste-pasta e --jarvis-pasta também. O app não ligou.');
  process.exit(1);
}
const cfg = carregarConfig();
const PORTA = cfg.porta;
const ORIGEM_APP = `http://localhost:${PORTA}`;   // o WebAuthn (rpID localhost) e a permissão do microfone do Chrome
const TOKEN = crypto.randomBytes(32).toString('base64url');
const HOSTS = new Set([`localhost:${PORTA}`, `127.0.0.1:${PORTA}`]);
const ORIGENS = new Set([`http://localhost:${PORTA}`, `http://127.0.0.1:${PORTA}`]);
const MAX_CORPO = 1024 * 1024;
const SEG = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
/* A CSP da página do painel (só o index). As bibliotecas do rosto, do Modo Mãos e do robô vêm do jsdelivr por import()
   dinâmico, que não aceita SRI, e rodam com a câmera ligada e o token na página: a CSP é a barreira para um arquivo
   trocado na CDN não mandar quadro da câmera nem o token para outro servidor (fetch, imagem, mídia, formulário).
   A página só fala com este app, com as CDNs das bibliotecas (jsdelivr; os modelos do MediaPipe no storage.googleapis.com)
   e com o Guardião (o Supabase do DATA WAREHOUSE, o mesmo PROJETO do web/js/saude.js, para quando o ENV não tem o banco).
   'unsafe-inline' fica pelo importmap do three e pelos estilos montados no HTML; 'wasm-unsafe-eval' pelo WASM do MediaPipe. */
const CDN = 'https://cdn.jsdelivr.net';
const GUARDIAO = 'https://ivcnotrynogaljrvvyes.supabase.co';
const CSP_PAINEL = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${CDN}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  `connect-src 'self' ${CDN} https://storage.googleapis.com ${GUARDIAO}`,
  "worker-src 'self' blob:",
  "frame-src 'none'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'self'",
].join('; ');
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
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

/* ---------- O Jarvis que faz: a pasta, o navegador, o construtor (docs/JARVIS-ACOES.md) ---------- */
/* Teste (cérebro de teste): tudo numa pasta temporária. O caminho real (realpath.native): o %TEMP% desta máquina vem
   curto (GTIJUL~1.ALV), e o navegador e o construtor comparam caminhos reais. */
const TESTE = cfg.simulado;
let raizTeste = null, raizTesteNossa = false;
if (TESTE) {
  const pedida = opcao('teste-pasta');
  try {
    if (pedida) { raizTeste = path.resolve(pedida); fs.mkdirSync(raizTeste, { recursive: true }); }
    else { raizTeste = fs.mkdtempSync(path.join(os.tmpdir(), 'cerebro-teste-')); raizTesteNossa = true; }
    raizTeste = fs.realpathSync.native(raizTeste);
  } catch (_) { log('Não consegui criar a pasta de teste do Jarvis. O app não ligou.'); process.exit(1); }
}
// caminho real do pai mais próximo que existe + o resto (a pasta do Jarvis pode ainda não existir: nasce no 1º uso)
function caminhoReal(p) {
  const resto = [];
  let atual = path.resolve(p);
  for (let i = 0; i < 40; i++) {
    try { return path.join(fs.realpathSync.native(atual), ...resto.reverse()); }
    catch (_) { const pai = path.dirname(atual); if (pai === atual) break; resto.push(path.basename(atual)); atual = pai; }
  }
  return path.resolve(p);
}
const PASTA_JARVIS = caminhoReal(TESTE ? (opcao('jarvis-pasta') || path.join(raizTeste, 'JARVIS')) : pastaPadrao(cfg));
/* no teste, a Lixeira e o "abrir no Windows" são de mentira: nada vai para a Lixeira do Júlio e nenhuma janela abre */
const LIXEIRA_TESTE = TESTE ? path.join(raizTeste, 'Lixeira (simulada)') : null;
const abertosTeste = [];   // o que o "abrir no Windows" de mentira abriria (só o nome e o modo; o teste confere)
const pasta = criarPastaJarvis({
  raiz: PASTA_JARVIS, log,
  ...(TESTE ? {
    lixeira: async (abs) => {
      await fsp.mkdir(LIXEIRA_TESTE, { recursive: true });
      await fsp.rename(abs, path.join(LIXEIRA_TESTE, `${Date.now()} ${path.basename(abs)}`));
      return { ok: true, conferido: true };
    },
    abridor: async (abs, { modo = 'abrir' } = {}) => {
      abertosTeste.push({ nome: path.basename(abs), modo });
      if (abertosTeste.length > 50) abertosTeste.shift();
      log(`teste: "abrir no Windows" de mentira (${modo}) — nada abriu`);
    },
  } : {}),
});
// o site de mentira do teste (só --simulado): a única origem local que o navegador de teste aceita
let siteTeste = null;
if (SIMULADO_PEDIDO) {
  const { criarSiteDeTeste } = await import('./simulado.js');
  try { siteTeste = await criarSiteDeTeste(); } catch (_) { siteTeste = null; log('teste: o site de mentira não ligou'); }
}
const navegador = criarNavegador({
  projetosDir: path.join(PASTA_JARVIS, 'Projetos'),
  ...(TESTE ? { perfil: path.join(raizTeste, 'navegador-chrome') } : {}),
  ...(siteTeste ? { permitirTeste: { origem: siteTeste.origem } } : {}),
  log,
});

/* O canal de eventos de cada aba (/api/jarvis/eventos): o andamento da construção, o fim das ações e a fala do fim.
   Sem aba (null): todas as abas. */
const canais = new Map();   // aba -> Set(sse)
// os pedidos de quadro da câmera em aberto (olhar_camera sem quadro no turno): id -> fim(quadro|null). Só na memória
const pedidosQuadro = new Map();
function emitirAba(aba, ev, dados) {
  const alvos = aba ? [canais.get(aba)] : [...canais.values()];
  for (const s of alvos) for (const c of s || []) { try { c.enviar(ev, dados); } catch (_) { /* caiu */ } }
}
ouvirAcoes(({ evento, id, tipo, aba }) => emitirAba(aba, 'acao', { evento, id, tipo }));
const construtor = criarConstrutor({
  cfg, pasta, banco, vault, navegador, log,
  emitir: emitirAba, avisar: avisarAcoes,
  ...(TESTE ? { query: queryDeMentira, gastosArquivo: path.join(raizTeste, 'construtor', 'gastos.json'), configDir: path.join(raizTeste, 'construtor-claude') } : {}),
});

let cerebro;
if (cfg.simulado) {
  const { criarCerebroSimulado } = await import('./simulado.js');
  cerebro = criarCerebroSimulado({ cfg, vault, banco, jarvis: pasta, navegador, construtor, siteTeste });
} else {
  const { criarCerebro } = await import('./cerebro.js');
  cerebro = criarCerebro({ cfg, vault, banco, jarvis: pasta, navegador, construtor });
}

/* A chave do atalho Ctrl+Alt+J: nova a cada partida, gravada para o chamar-jarvis.ps1 (no teste, na pasta de teste:
   o servidor de teste não troca a chave do app de verdade). Não é senha: só prova que o pedido veio deste usuário. */
const ATALHO = crypto.randomBytes(32).toString('base64url');
const ARQ_ATALHO = TESTE ? path.join(raizTeste, 'atalho.chave') : path.join(LOCAL, 'CerebroLube', 'atalho.chave');
try { fs.mkdirSync(path.dirname(ARQ_ATALHO), { recursive: true }); fs.writeFileSync(ARQ_ATALHO, ATALHO, { encoding: 'utf8', mode: 0o600 }); }
catch (_) { log('atalho: não consegui gravar a chave do Ctrl+Alt+J (o atalho só liga o app)'); }
let chamadaJarvis = 0;      // quando o atalho pediu o Jarvis (quem conectar no /api/events em até 10 s recebe)
const CHAMADA_MS = 10000;
const EVENTO_JARVIS = `event: jarvis\ndata: ${JSON.stringify({ acao: 'abrir' })}\n\n`;
function atalhoOk(req) {
  const v = req.headers['x-cerebro-atalho'];
  if (typeof v !== 'string' || !v) return false;
  const a = Buffer.from(v.trim()), b = Buffer.from(ATALHO);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// a pasta do Jarvis existe? (sem esperar o disco no /api/jarvis/estado: o último valor, conferido ao fundo)
let pastaExiste = false;
const conferirPasta = () => fsp.stat(PASTA_JARVIS).then(st => { pastaExiste = st.isDirectory(); }, () => { pastaExiste = false; });

/* A trava do rosto (rosto.js): quem decide se o Jarvis está liberado hoje. Dado biométrico só em
   %LOCALAPPDATA%\CerebroLube\rosto (com --simulado ou --trava-aberta, numa pasta temporária). */
const rosto = criarRosto({ travaAberta: TRAVA_ABERTA, pasta: opcao('rosto-pasta') || undefined, origem: ORIGEM_APP, log });

/* O ouvido (ouvido.js): um Chrome escondido, aberto só quando a interface liga o microfone; o microfone só liga com a
   trava aberta. --ouvido-teste: o .wav no lugar do microfone (só com --simulado; nunca no app de verdade). */
const WAV_TESTE = (() => {
  const f = opcao('ouvido-teste');
  if (!f) return null;
  if (!SIMULADO_PEDIDO) { log('ouvido: --ouvido-teste só vale com --simulado; ignorado'); return null; }
  const abs = path.resolve(f);
  let ok = false;
  try { ok = /\.wav$/i.test(abs) && fs.statSync(abs).isFile(); } catch (_) { ok = false; }
  if (!ok) { log('ouvido: o arquivo do --ouvido-teste não existe ou não é .wav; ignorado'); return null; }
  return abs;
})();
const ouvido = criarOuvidoChrome({
  urlPagina: `${ORIGEM_APP}/ouvido.html${WAV_TESTE ? '?teste=1' : ''}`,
  origem: ORIGEM_APP,
  perfil: opcao('ouvido-perfil') || undefined,
  podeLigar: () => rosto.liberado(),
  permitirTeste: !!WAV_TESTE,
  log,
});

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
  res.writeHead(200, { ...SEG, 'Content-Security-Policy': CSP_PAINEL, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(pagina) });
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
  // sem esperar o disco: uma unidade de rede que não responde travaria o servidor inteiro (o último valor conhecido;
  // a conferência roda ao fundo, com prazo)
  const raizes = raizesConhecidas(cfg.raizes);
  return {
    ok: true, tipo: 'local', voz: true,
    ...cerebro.estado(),
    motivo: cfg.simulado ? cfg.motivoSimulado : undefined,
    conexoes: {
      vault: vault.existe(), banco: banco.configurado, email_leitura: !!cfg.imap, email_envio: !!cfg.smtp,
      arquivos: raizes, internet: !cfg.simulado,
    },
    acoes_pendentes: quantasPendentes(),
    // a trava do rosto (sem dado biométrico: só se há cadastro, quantas amostras e se o dia está liberado) e o ouvido
    trava: rosto.estado(),
    ouvido: ouvido.estado(),
    // o Jarvis que faz: a pasta (existe? de teste?), o navegador escondido e a construção que roda
    jarvis: {
      pasta: (conferirPasta(), pastaExiste), pasta_teste: TESTE || undefined,
      navegador: navegador.estado(), construcao: construtor.estado().ativa,
      ...(TESTE ? { abertos_teste: abertosTeste.slice(-5) } : {}),
    },
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
      // o atalho Ctrl+Alt+J pediu o Jarvis há pouco (a aba escondida tinha soltado esta conexão): recebe na hora
      if (chamadaJarvis && Date.now() - chamadaJarvis < CHAMADA_MS) res.write(EVENTO_JARVIS);
      clientesEventos.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) { /* caiu */ } }, 25000);
      res.on('close', () => { clearInterval(ping); clientesEventos.delete(res); });
      return;
    }
    // o atalho Ctrl+Alt+J (ferramentas/chamar-jarvis.ps1): sem o token da página (o script não tem), com a chave do
    // atalho. Só pede para a tela abrir o Jarvis; com a trava fechada, a tela abre no portão do rosto
    if (p === '/api/jarvis/chamar') {
      if (m !== 'POST') { erro(res, 405, 'Use POST.', 'metodo'); return; }
      if (!atalhoOk(req)) { erro(res, 401, 'Falta a chave do atalho (x-cerebro-atalho).', 'atalho'); return; }
      try { await lerCorpoJson(req); } catch (_) { /* o corpo não importa */ }
      chamadaJarvis = Date.now();
      for (const r of clientesEventos) { try { r.write(EVENTO_JARVIS); } catch (_) { /* caiu */ } }
      log('atalho: Ctrl+Alt+J pediu o Jarvis');
      json(res, 200, { ok: true, telas: clientesEventos.size });
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

    // a trava do rosto e o ouvido: o token, o Host e a Origin já foram conferidos aqui em cima
    const ctx = { req, res, url, metodo: m, lerCorpoJson, json, erro };
    if (p.startsWith('/api/rosto/')) { await rosto.tratar(ctx); return; }
    if (p === '/api/ouvido' || p.startsWith('/api/ouvido/')) {
      // --ouvido-teste: o ligar ganha o .wav no lugar do microfone (o Edge não sabe de nada)
      if (WAV_TESTE && p === '/api/ouvido/ligar') {
        ctx.lerCorpoJson = async (r) => {
          const c = await lerCorpoJson(r);
          return { ...(c && typeof c === 'object' && !Array.isArray(c) ? c : {}), teste: { arquivo: '/teste-ouvido.wav', atrasoMs: 2500 } };
        };
      }
      await ouvido.tratar(ctx);
      return;
    }

    if (p === '/api/jarvis/turno' && m === 'POST') {
      // travado (o dia ainda não foi liberado pelo rosto ou pelo Windows Hello): nada de turno
      if (!rosto.exigirLiberado(res, erro)) return;
      let corpo;
      try { corpo = await lerCorpoJson(req); }
      catch (e) { erro(res, e.status || 400, e.status === 413 ? 'O pedido passou de 1 MB.' : e.status === 415 ? 'Mande JSON (Content-Type: application/json).' : 'JSON inválido.'); return; }
      // o quadro da câmera "Ver você" sai do contexto ANTES de tudo (nunca entra na linha de contexto nem no log) e
      // vira o quadroCamera deste turno, que morre com ele
      let quadroCamera = null;
      if (corpo && corpo.contexto && typeof corpo.contexto === 'object' && 'camera' in corpo.contexto) {
        const q = corpo.contexto.camera;
        delete corpo.contexto.camera;
        if (q != null) {
          const idade = Date.now() - Number(q && q.em);
          if (!quadroValido(q) || !(idade >= -5000 && idade <= 30000)) { erro(res, 400, 'O quadro da câmera veio estragado ou velho.', 'camera'); return; }
          quadroCamera = { jpeg: q.jpeg, w: q.w, h: q.h, em: q.em };
        }
      }
      try { limparConversa(corpo && corpo.conversa); }
      catch (e) { erro(res, 400, e.message, 'conversa'); return; }
      const ctl = new AbortController();
      res.on('close', () => { if (!res.writableFinished) ctl.abort(new Error('conexão fechada')); });
      const sse = abrirSse(res);
      // olhar_camera sem quadro no turno (a câmera acabou de ligar): pede um à tela e espera; morre com o turno
      const meusPedidos = new Set();
      const pedirQuadro = (prazoMs = 2500) => new Promise((ok) => {
        if (ctl.signal.aborted) { ok(null); return; }
        const id = 'qd_' + crypto.randomBytes(12).toString('base64url');
        const fim = (q) => { clearTimeout(t); pedidosQuadro.delete(id); meusPedidos.delete(id); ok(q || null); };
        const t = setTimeout(() => fim(null), Math.max(500, Math.min(10000, prazoMs)));
        pedidosQuadro.set(id, fim); meusPedidos.add(id);
        sse.enviar('camera', { acao: 'quadro', pedido: id });
      });
      try {
        await cerebro.turno({ conversa: corpo.conversa, contexto: corpo.contexto, quadroCamera, pedirQuadro }, sse.enviar, ctl.signal);
      } catch (e) {
        if (!ctl.signal.aborted) {
          log('turno: erro', e?.name || '', e?.message ? String(e.message).slice(0, 200) : '');
          sse.enviar('erro', { mensagem: e?.codigo ? e.message : 'Algo deu errado no cérebro do Jarvis. O detalhe ficou no log do servidor.' });
          sse.enviar('fim', { motivo: 'erro' });
        }
      } finally {
        for (const id of [...meusPedidos]) { const f = pedidosQuadro.get(id); if (f) f(null); }
        sse.fechar();
      }
      return;
    }

    /* ---------- um quadro novo da câmera "Ver você" (o olhar_camera pediu no turno): só na memória ---------- */
    if (p === '/api/jarvis/camera/quadro' && m === 'POST') {
      if (!rosto.exigirLiberado(res, erro)) return;
      let corpo;
      try { corpo = await lerCorpoJson(req); }
      catch (e) { erro(res, e.status || 400, 'Pedido inválido.'); return; }
      const id = corpo && typeof corpo.pedido === 'string' ? corpo.pedido : '';
      const fim = /^qd_[A-Za-z0-9_-]{16}$/.test(id) ? pedidosQuadro.get(id) : null;
      if (!fim) { erro(res, 404, 'Esse pedido de quadro não existe mais.', 'quadro'); return; }
      const q = corpo.quadro;
      if (q == null) { fim(null); json(res, 200, { ok: true }); return; }
      const idade = Date.now() - Number(q && q.em);
      if (!quadroValido(q) || !(idade >= -5000 && idade <= 30000)) { fim(null); erro(res, 400, 'O quadro da câmera veio estragado ou velho.', 'camera'); return; }
      fim({ jpeg: q.jpeg, w: q.w, h: q.h, em: q.em });
      json(res, 200, { ok: true });
      return;
    }

    const ma = p.match(/^\/api\/jarvis\/acao\/([A-Za-z0-9_-]{4,80})$/);
    if (ma && m === 'POST') {
      let corpo;
      try { corpo = await lerCorpoJson(req); }
      catch (e) { erro(res, e.status || 400, 'Pedido inválido.'); return; }
      const decisao = corpo && corpo.decisao;
      if (decisao !== 'confirmar' && decisao !== 'recusar') { erro(res, 400, 'Mande {"decisao":"confirmar"} ou {"decisao":"recusar"}.', 'decisao'); return; }
      // aprovar age (envia o e-mail, move, apaga, constrói): só com a trava aberta. Recusar continua valendo travado
      if (decisao === 'confirmar' && !rosto.exigirLiberado(res, erro)) return;
      const motivo = decisao === 'recusar' && MOTIVOS_RECUSA.has(corpo.motivo) ? corpo.motivo : undefined;
      const via = VIAS.has(corpo.via) ? corpo.via : 'clique';
      const r = await decidir(ma[1], decisao, motivo, via);
      json(res, r.status, { ok: r.ok, mensagem: r.mensagem, ...(r.cartao ? { cartao: r.cartao } : {}), ...(r.cartoes ? { cartoes: r.cartoes } : {}), ...(r.fala ? { fala: r.fala } : {}) });
      return;
    }

    /* ---------- o canal de eventos da aba ---------- */
    if (p === '/api/jarvis/eventos' && m === 'GET') {
      const aba = url.searchParams.get('aba') || '';
      if (!/^[A-Za-z0-9_-]{6,40}$/.test(aba)) { erro(res, 400, 'Falta a aba (aba=).', 'aba'); return; }
      if (!rosto.exigirLiberado(res, erro)) return;
      const sse = abrirSse(res);
      if (!canais.has(aba)) canais.set(aba, new Set());
      canais.get(aba).add(sse);
      res.on('close', () => { sse.fechar(); const s = canais.get(aba); if (s) { s.delete(sse); if (!s.size) canais.delete(aba); } });
      // ao conectar: a construção que roda e, se não roda nenhuma, a última desta aba que terminou há pouco (o Jarvis
      // estava fechado no fim: o cartão final, o print e a fala chegam agora; reenvio: a tela sabe que é atrasado)
      const ativa = construtor.estado().ativa;
      if (ativa) sse.enviar('construcao', { ...ativa, reenvio: true });
      else {
        const ult = construtor.ultimaDaAba(aba, 15 * 60000);
        if (ult) sse.enviar('construcao', { ...ult, reenvio: true });
      }
      return;
    }

    /* ---------- um print da pasta do Jarvis (só imagem; pelo id opaco, conferido de novo) ---------- */
    const mf = p.match(/^\/api\/jarvis\/arquivo\/(arq_[A-Za-z0-9_-]{22})$/);
    if (mf && (m === 'GET' || m === 'HEAD')) {
      if (!rosto.exigirLiberado(res, erro)) return;
      const abs = pasta.porId(mf[1]);
      if (!abs) { erro(res, 404, 'Esse arquivo não está na pasta do Jarvis.', 'arquivo'); return; }
      let c;
      try { c = await pasta.conferir(abs, { existe: true, tipo: 'arquivo' }); } catch (_) { erro(res, 404, 'Esse arquivo não está mais na pasta do Jarvis.', 'arquivo'); return; }
      const tipo = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[extDe(c.abs)];
      if (!tipo) { erro(res, 415, 'Daqui eu só mostro imagem (o print).', 'tipo'); return; }
      if (c.st.size > 40 * 1024 * 1024) { erro(res, 413, 'O print é grande demais para mostrar.', 'grande'); return; }
      res.writeHead(200, { ...SEG, 'Content-Type': tipo, 'Content-Length': c.st.size, 'Cache-Control': 'no-store' });
      if (m === 'HEAD') { res.end(); return; }
      fs.createReadStream(c.abs).on('error', () => res.destroy()).pipe(res);
      return;
    }

    /* ---------- abrir no Windows (o botão "Abrir", "Mostrar na pasta", "Abrir no Excel" dos cartões) ---------- */
    if (p === '/api/jarvis/abrir' && m === 'POST') {
      let corpo;
      try { corpo = await lerCorpoJson(req); }
      catch (e) { erro(res, e.status || 400, 'Pedido inválido.'); return; }
      const id = corpo && typeof corpo.id === 'string' ? corpo.id : '';
      const modo = corpo && corpo.modo === 'mostrar' ? 'mostrar' : corpo && (corpo.modo === 'abrir' || corpo.modo == null) ? 'abrir' : null;
      if (!/^arq_[A-Za-z0-9_-]{22}$/.test(id) || !modo) { erro(res, 400, 'Mande {"id":"arq_…","modo":"abrir"|"mostrar"}.', 'pedido'); return; }
      if (!rosto.exigirLiberado(res, erro)) return;
      const abs = pasta.porId(id);
      if (!abs) { erro(res, 404, 'Esse arquivo não está na pasta do Jarvis.', 'arquivo'); return; }
      try {
        // o clique do Júlio no cartão: aqui a página HTML abre direto (pagina: true); pelo modelo, só com a ação "abrir"
        await pasta.abrirNoWindows(abs, { mostrar: modo === 'mostrar', pagina: true });
        json(res, 200, { ok: true, ...(TESTE ? { simulado: true } : {}) });
      } catch (e) {
        const cod = e instanceof ErroFerramenta ? e.codigo : '';
        if (cod === 'jarvis-extensao') erro(res, 415, e.message, cod);
        else if (cod === 'jarvis-sumiu' || cod === 'jarvis-fora' || cod === 'jarvis-nome') erro(res, 404, e.message, cod);
        else { if (!cod) log('abrir: falhou', e?.code || e?.name || ''); erro(res, 502, cod ? e.message : 'O Windows não conseguiu abrir isso agora.', cod || 'jarvis-abrir'); }
      }
      return;
    }

    /* ---------- o construtor ---------- */
    if (p === '/api/jarvis/construcao' && m === 'GET') { json(res, 200, construtor.estado()); return; }
    if (p === '/api/jarvis/construcao/parar' && m === 'POST') {
      try { await lerCorpoJson(req); } catch (_) { /* parar não precisa de corpo */ }
      const r = await construtor.parar('pedido');   // sem a trava: parar é o lado seguro
      json(res, r.ok ? 200 : 404, { ok: !!r.ok, mensagem: r.mensagem });
      return;
    }
    erro(res, 404, 'Rota desconhecida.', 'rota');
    return;
  }

  if (m !== 'GET' && m !== 'HEAD') { erro(res, 405, 'Método não permitido.', 'metodo'); return; }
  if (p === '/' || p === '/index.html') { await servirIndex(res, m === 'HEAD'); return; }
  if (WAV_TESTE && p === '/teste-ouvido.wav') {
    let st;
    try { st = await fsp.stat(WAV_TESTE); } catch (_) { erro(res, 404, 'Não encontrado.'); return; }
    res.writeHead(200, { ...SEG, 'Content-Type': 'audio/wav', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
    if (m === 'HEAD') { res.end(); return; }
    fs.createReadStream(WAV_TESTE).on('error', () => res.destroy()).pipe(res);
    return;
  }
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
  // CEREBRO_ABRIR=jarvis (o atalho Ctrl+Alt+J com o app desligado): a página abre já no Jarvis
  const url = `http://localhost:${PORTA}${process.env.CEREBRO_ABRIR === 'jarvis' ? '/#jarvis' : ''}`;
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
  raizesAcessiveis(cfg.raizes).catch(() => {});   // já deixa conferido para o /api/jarvis/estado
  const r = resumoConfig(cfg);
  let notas = '?';
  try { notas = vault.existe() ? (await vault.ler()).files.length : 'pasta não encontrada'; } catch (_) { /* nada */ }
  log(`Cérebro da Lube no ar em http://localhost:${PORTA}`);
  log(`  cérebro: ${cfg.simulado ? `simulado (${cfg.motivoSimulado})` : 'Claude Haiku 5.5 (conversa) + Sonnet 5.5 (pesado)'}`);
  log(`  ENV: ${r.env || 'não encontrado'} · banco: ${r.banco ? 'sim' : 'não'} · e-mail: leitura ${r.email_leitura ? 'sim' : 'não'}, envio ${r.email_envio ? 'sim' : 'não'}`);
  log(`  vault: ${notas} notas · arquivos: ${cfg.raizes.join(' ; ')}`);
  const tr = rosto.estado();
  log(`  ouvido: ${acharChrome() ? 'Google Chrome achado (abre escondido só quando o microfone liga)' : 'Google Chrome não achado (fica o reconhecimento do Edge)'}${WAV_TESTE ? ' · TESTE: toca o .wav no lugar do microfone' : ''}`);
  if (TRAVA_ABERTA) log('  !!! TRAVA DO ROSTO DESLIGADA (só teste): o Jarvis libera tudo sem conferir o rosto !!!');
  else log(`  trava do rosto: ${tr.cadastro.rosto || tr.hello.cadastrado ? `cadastrada${tr.liberado ? ', liberada hoje' : ', pede o rosto na primeira conversa do dia'}` : 'sem cadastro (o Jarvis pede o cadastro na primeira vez)'}`);
  await conferirPasta();
  log(`  pasta do Jarvis: ${TESTE ? 'TEMPORÁRIA de teste (nada vai para o OneDrive; Lixeira e "abrir no Windows" de mentira)' : `${PASTA_JARVIS}${pastaExiste ? '' : ' (nasce no primeiro uso)'}`}`);
  log(`  construtor: ${TESTE ? 'de mentira (nada vai para a API)' : cfg.anthropic.apiKey ? `Claude Sonnet 5.5 pelo Agent SDK, teto de US$ ${cfg.tetoDiaUsd} por dia` : 'sem a chave do Claude'}${siteTeste ? ' · TESTE: site de mentira em 127.0.0.1' : ''}`);
  if (cfg.abrirNavegador) abrirEdge();
});

let desligando = false;
async function desligar() {
  if (desligando) return;
  desligando = true;
  log('Desligando o Cérebro…');
  vault.parar();
  for (const res of clientesEventos) { try { res.end(); } catch (_) { /* nada */ } }
  servidor.close();
  for (const s of canais.values()) for (const c of s) { try { c.fechar(); } catch (_) { /* nada */ } }
  canais.clear();
  // os Chromes escondidos (o ouvido e o navegador) fecham junto (Browser.close; se não sair em 3 s, taskkill na
  // árvore) e a construção que roda para (interrupt + close). Se o Node morrer antes, o pipe fecha e eles saem sozinhos
  await Promise.race([
    Promise.all([
      ouvido.desligar({ final: true }).catch(() => {}),
      navegador.desligar({ final: true }).catch(() => {}),
      construtor.desligar().catch(() => {}),
    ]),
    new Promise(r => setTimeout(r, 8000).unref()),
  ]);
  try { await siteTeste?.fechar(); } catch (_) { /* nada */ }
  await banco.fechar();
  // a pasta de teste que este servidor criou em %TEMP% (nunca a do Júlio, nunca a passada por --teste-pasta)
  if (raizTesteNossa && raizTeste && path.basename(raizTeste).startsWith('cerebro-teste-')) {
    try { await fsp.rm(raizTeste, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch (_) { log('teste: a pasta temporária ficou (algum arquivo preso)'); }
  }
  setTimeout(() => process.exit(0), 300).unref();
}
process.on('SIGINT', desligar);
process.on('SIGTERM', desligar);
// fechar a janela preta do INICIAR.bat chega como SIGHUP no Windows (há alguns segundos antes de o Windows matar)
process.on('SIGHUP', desligar);
