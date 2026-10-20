/* Teste da integração do Jarvis que FAZ (docs/JARVIS-ACOES.md §9 e §10) com o servidor de verdade num processo filho:
   node teste/testar-jarvis-faz.js
   - O servidor sobe com --simulado --trava-aberta e --teste-pasta numa pasta temporária: a pasta do Jarvis, a chave do
     atalho, o perfil do navegador e o gasto do construtor ficam lá dentro (apagada no fim). Nada vai para o OneDrive, para
     a Lixeira do Windows nem para a API (o construtor usa o query de mentira).
   - Prova pelas rotas: anotar e planilha (livres) criando arquivo; mover só depois de aprovado por voz (via: 'voz', com o
     cartão de volta); apagar recusado não apaga; o canal /api/jarvis/eventos recebendo nova/decidida; o quadro da câmera
     (400 estragado ou velho; o olhar_camera recebendo o quadro); a rota de arquivo (só imagem); abrir no Windows (de
     mentira); o atalho (401 sem chave, 200 com ela, o evento jarvis no /api/events); Host e Origin nas rotas novas.
   - Com o Google Chrome: o site de mentira (1ª vez pede a aprovação "navegar"; aprovado, o print volta como cartão e a
     rota de arquivo serve o PNG), a construção de mentira com andamento no canal, o print da prévia e a fala do fim.
   - Um segundo servidor com a trava FECHADA (rosto numa pasta temporária, sem cadastro): 423 no canal, no arquivo, no
     abrir e no aprovar; parar a construção passa.
   - No fim: nenhum chrome.exe com o perfil de teste. */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acharChrome } from '../ouvido.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SERVIDOR = path.resolve(AQUI, '..', 'servidor.js');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const COM_CHROME = !!acharChrome();

let total = 0, falhas = 0;
function ok(cond, txt) { total++; if (cond) console.log(`OK   ${txt}`); else { falhas++; console.log(`FALHA ${txt}`); } }
function titulo(t) { console.log(`\n== ${t}`); }

function portaLivre() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
function contarChrome(perfil) {
  const script = String.raw`$p = [regex]::Escape($env:PERFIL_CONTAR); $rx = '--user-data-dir="?' + $p + '\\?"?(\s|$)'; @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -match $rx }).Count`;
  return new Promise((res) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, timeout: 20000, env: { ...process.env, PERFIL_CONTAR: path.resolve(perfil) } },
      (err, out) => res(err ? -1 : Number(String(out || '').trim()) || 0));
  });
}

async function subir({ trava = 'aberta' } = {}) {
  const porta = await portaLivre();
  const tmp = fs.realpathSync.native(await fsp.mkdtemp(path.join(os.tmpdir(), 'cerebro-faz-')));
  const vault = path.join(tmp, 'vault');
  await fsp.mkdir(path.join(vault, 'Preferências'), { recursive: true });
  await fsp.writeFile(path.join(vault, 'CLAUDE.md'), '# teste\n', 'utf8');
  const env = path.join(tmp, 'ENV');
  await fsp.writeFile(env, '# vazio: o teste não usa banco, e-mail nem a chave do Claude\n', 'utf8');
  const teste = path.join(tmp, 'teste');
  await fsp.mkdir(path.join(tmp, 'rosto'), { recursive: true });
  const args = [SERVIDOR, '--simulado', `--teste-pasta=${teste}`, `--ouvido-perfil=${path.join(tmp, 'ouvido')}`];
  if (trava === 'aberta') args.push('--trava-aberta'); else args.push(`--rosto-pasta=${path.join(tmp, 'rosto')}`);
  const filho = spawn(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, JARVIS_PORTA: String(porta), JARVIS_ENV: env, VAULT_DIR: vault, ARQUIVOS_RAIZES: tmp, JARVIS_SIMULADO: '1', CEREBRO_ABRIR: '' },
  });
  let saida = '';
  filho.stdout.on('data', (d) => { saida += d; });
  filho.stderr.on('data', (d) => { saida += d; });
  const t0 = Date.now();
  while (Date.now() - t0 < 25000 && !/no ar em http/.test(saida) && filho.exitCode === null) await esperar(100);
  const base = `http://127.0.0.1:${porta}`;
  let token = null;
  try { token = ((await (await fetch(`${base}/`)).text()).match(/<meta name="cerebro-token" content="([^"]+)"/) || [])[1] || null; } catch (_) { /* não subiu */ }
  return {
    porta, base, token, tmp, teste, jarvis: path.join(teste, 'JARVIS'), perfil: path.join(teste, 'navegador-chrome'), filho, saida: () => saida,
    async parar() {
      try { filho.kill(); } catch (_) { /* já saiu */ }
      await Promise.race([new Promise((r) => filho.once('exit', r)), esperar(5000)]);
      // o Chrome do navegador sai sozinho quando o pipe fecha (o Node morreu)
      for (let i = 0; i < 30 && (await contarChrome(this.perfil)) > 0; i++) await esperar(300);
    },
    async limpar() { await fsp.rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {}); },
  };
}
async function pedir(S, metodo, rota, corpo, { token = S.token, host, origem, prazo = 60000, cabecalhos = {} } = {}) {
  const h = { ...cabecalhos };
  if (token) h['x-cerebro-token'] = token;
  if (corpo !== undefined) h['content-type'] = 'application/json';
  if (host) h.host = host;
  if (origem) h.origin = origem;
  const r = await fetch(`${S.base}${rota}`, { method: metodo, headers: h, body: corpo !== undefined ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(prazo) });
  const tipo = r.headers.get('content-type') || '';
  let dados = null, texto = '', bytes = null;
  if (tipo.includes('event-stream')) texto = await r.text();
  else if (tipo.startsWith('image/')) bytes = Buffer.from(await r.arrayBuffer());
  else { try { dados = await r.json(); } catch (_) { dados = null; } }
  return { status: r.status, dados, texto, tipo, bytes };
}
function lerSse(texto) {
  return texto.split(/\r?\n\r?\n/).map((b) => {
    const ev = (b.match(/^event: (.+)$/m) || [])[1];
    const d = (b.match(/^data: (.+)$/m) || [])[1];
    if (!ev) return null;
    let dados = {};
    try { dados = JSON.parse(d || '{}'); } catch (_) { dados = {}; }
    return { ev, dados };
  }).filter(Boolean);
}
const ABA = 'abaTesteFaz01';
async function turno(S, texto, contexto = {}) {
  const r = await pedir(S, 'POST', '/api/jarvis/turno', { conversa: [{ papel: 'julio', texto }], contexto: { aba: ABA, ...contexto } }, { prazo: 90000 });
  const evs = r.status === 200 ? lerSse(r.texto) : [];
  return {
    status: r.status, dados: r.dados, evs,
    de: (n) => evs.filter((e) => e.ev === n).map((e) => e.dados),
    fala: evs.filter((e) => e.ev === 'texto').map((e) => e.dados.delta).join(''),
  };
}
function canal(S, aba = ABA) {
  const ctl = new AbortController();
  const eventos = [];
  const pronto = (async () => {
    const r = await fetch(`${S.base}/api/jarvis/eventos?aba=${aba}`, { headers: { 'x-cerebro-token': S.token, accept: 'text/event-stream' }, signal: ctl.signal });
    if (!r.ok || !r.body) return r.status;
    (async () => {
      const dec = new TextDecoder(); let buf = '';
      try {
        for await (const p of r.body) {
          buf += dec.decode(p, { stream: true });
          let k;
          while ((k = buf.indexOf('\n\n')) >= 0) {
            const bloco = buf.slice(0, k); buf = buf.slice(k + 2);
            for (const e of lerSse(bloco)) eventos.push(e);
          }
        }
      } catch (_) { /* fechado */ }
    })();
    return r.status;
  })().catch(() => 0);
  return { eventos, pronto, fechar: () => ctl.abort() };
}
async function esperarAte(fn, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await esperar(150); } return !!fn(); }
const listar = (p) => { try { return fs.readdirSync(p); } catch (_) { return []; } };

/* =============================================================================
   1. Trava aberta: o que o Jarvis faz
   ============================================================================= */
const ONEDRIVE_JARVIS = path.join(process.env.OneDriveCommercial || path.join(os.homedir(), 'OneDrive - Lube'), 'JARVIS');
const tinhaJarvisReal = fs.existsSync(ONEDRIVE_JARVIS);
let S = await subir();
try {
  titulo('o servidor sobe com a pasta de teste');
  ok(!!S.token, `subiu na porta ${S.porta} e a página traz o token`);
  ok(/pasta do Jarvis: TEMPORÁRIA de teste/.test(S.saida()) && /construtor: de mentira/.test(S.saida()), 'o log diz: pasta temporária e construtor de mentira');
  let r = await pedir(S, 'GET', '/api/jarvis/estado');
  ok(r.status === 200 && r.dados.jarvis && r.dados.jarvis.pasta_teste === true && r.dados.jarvis.navegador && r.dados.jarvis.navegador.estado === 'desligado', `estado: jarvis ${JSON.stringify(r.dados.jarvis)}`);

  titulo('Host e Origin nas rotas novas');
  r = await pedir(S, 'GET', '/api/jarvis/construcao', undefined, { origem: 'https://exemplo.com' });
  ok(r.status === 403, `Origin de fora: ${r.status}`);
  // o fetch do Node não deixa trocar o Host: vai pelo node:http (o DNS rebinding chega com o Host do site de fora)
  const st421 = await new Promise((ok2) => {
    const q = http.request({ host: '127.0.0.1', port: S.porta, path: '/api/jarvis/abrir', method: 'POST', headers: { host: 'evil.example:8790', 'x-cerebro-token': S.token, 'content-type': 'application/json' } },
      (resp) => { resp.resume(); ok2(resp.statusCode); });
    q.on('error', () => ok2(0));
    q.end(JSON.stringify({ id: 'arq_' + 'a'.repeat(22), modo: 'abrir' }));
  });
  ok(st421 === 421, `Host estranho: ${st421}`);
  r = await pedir(S, 'GET', '/api/jarvis/construcao', undefined, { token: null });
  ok(r.status === 401, `sem token: ${r.status}`);
  r = await pedir(S, 'GET', `/api/jarvis/eventos?aba=x`);
  ok(r.status === 400, `canal sem aba válida: ${r.status}`);

  titulo('canal de eventos da aba');
  const C = canal(S);
  ok((await C.pronto) === 200, 'o canal abre (200)');

  titulo('anotar e planilha: livres, na pasta de teste');
  let t = await turno(S, 'Jarvis, anota que a reunião de compras ficou para quinta às três');
  const anot = t.de('cartao').find((c) => c.tipo === 'anotacao');
  ok(t.status === 200 && !!anot && /^arq_/.test(anot.dados.arquivo.id), `cartão anotacao (${anot && anot.dados.arquivo.nome})`);
  const anots = listar(path.join(S.jarvis, 'Anotações'));
  ok(anots.length === 1 && /\.md$/.test(anots[0]) && /reuni/i.test(fs.readFileSync(path.join(S.jarvis, 'Anotações', anots[0]), 'utf8')), `o arquivo existe: Anotações\\${anots[0]}`);
  ok(/Anotei/.test(t.fala), `o Jarvis conta que anotou: "${t.fala.slice(0, 120)}"`);
  t = await turno(S, 'cria uma planilha de venda por filial');
  const pl = t.de('cartao').find((c) => c.tipo === 'planilha');
  ok(!!pl && pl.dados.total_linhas === 4 && pl.dados.linhas.length === 4, `cartão planilha com a prévia (${pl && pl.dados.total_linhas} linhas)`);
  ok(listar(path.join(S.jarvis, 'Planilhas')).some((n) => /\.xlsx$/.test(n)), 'o .xlsx existe em Planilhas');

  titulo('abrir no Windows (de mentira no teste) e a rota de arquivo (só imagem)');
  r = await pedir(S, 'POST', '/api/jarvis/abrir', { id: pl.dados.arquivo.id, modo: 'abrir' });
  ok(r.status === 200 && r.dados.ok && r.dados.simulado === true, `abrir a planilha: ${r.status} (nenhuma janela abre no teste)`);
  r = await pedir(S, 'GET', '/api/jarvis/estado');
  ok((r.dados.jarvis.abertos_teste || []).some((x) => /\.xlsx$/.test(x.nome) && x.modo === 'abrir'), 'o "abrir" de mentira registrou a planilha');
  r = await pedir(S, 'POST', '/api/jarvis/abrir', { id: 'arq_' + 'b'.repeat(22), modo: 'abrir' });
  ok(r.status === 404, `id desconhecido: ${r.status}`);
  r = await pedir(S, 'POST', '/api/jarvis/abrir', { id: 'nada', modo: 'abrir' });
  ok(r.status === 400, `id inválido: ${r.status}`);
  r = await pedir(S, 'GET', `/api/jarvis/arquivo/${anot.dados.arquivo.id}`);
  ok(r.status === 415, `a rota de arquivo não serve .md: ${r.status}`);
  r = await pedir(S, 'GET', `/api/jarvis/arquivo/arq_${'c'.repeat(22)}`);
  ok(r.status === 404, `arquivo desconhecido: ${r.status}`);

  titulo('mover: só depois do "aprovado" (por voz)');
  t = await turno(S, 'move a anotação para arquivos');
  const am = t.de('acao')[0];
  ok(!!am && am.tipo === 'mover' && am.rotulo && am.detalhe.total === 1, `ação pendente mover (${am && am.resumo})`);
  ok(listar(path.join(S.jarvis, 'Anotações')).length === 1 && !listar(path.join(S.jarvis, 'Arquivos')).length, 'nada foi movido antes de aprovar');
  ok(!/\b(aprovado|pode)\b/i.test(t.fala) && /aprovação/.test(t.fala), `o Jarvis não diz as palavras de aprovar: "${t.fala}"`);
  ok(await esperarAte(() => C.eventos.some((e) => e.ev === 'acao' && e.dados.evento === 'nova' && e.dados.id === am.id), 3000), 'o canal recebe acao nova');
  r = await pedir(S, 'POST', `/api/jarvis/acao/${am.id}`, { decisao: 'confirmar', via: 'voz' });
  ok(r.status === 200 && r.dados.ok && r.dados.cartao && r.dados.cartao.tipo === 'pasta', `aprovado por voz: ${r.dados && r.dados.mensagem} (cartão ${r.dados && r.dados.cartao && r.dados.cartao.tipo})`);
  ok(!listar(path.join(S.jarvis, 'Anotações')).length && listar(path.join(S.jarvis, 'Arquivos')).length === 1, 'o arquivo foi para Arquivos');
  ok(await esperarAte(() => C.eventos.some((e) => e.ev === 'acao' && e.dados.evento === 'decidida' && e.dados.id === am.id), 3000), 'o canal recebe acao decidida');
  ok(/aprovada por voz \(mover, 1 item\)/.test(S.saida()), 'o log diz "aprovada por voz (mover, 1 item)", sem o conteúdo');
  t = await turno(S, 'obrigado');
  ok(/aprovou foi feita/.test(t.fala), `o desfecho entra na fala seguinte: "${t.fala.slice(0, 100)}"`);

  titulo('apagar recusado não apaga; uma pendente por vez');
  t = await turno(S, 'apaga o arquivo');
  const aa = t.de('acao')[0];
  ok(!!aa && aa.tipo === 'apagar' && aa.detalhe.destino === 'Lixeira do Windows', `ação apagar (${aa && aa.resumo})`);
  t = await turno(S, 'renomeia a planilha');
  const ar = t.de('acao')[0];
  ok(!!ar && ar.tipo === 'renomear' && /saiu/.test(t.fala), `renomear troca a ação anterior e avisa: "${t.fala.slice(0, 90)}"`);
  r = await pedir(S, 'POST', `/api/jarvis/acao/${aa.id}`, { decisao: 'confirmar', via: 'voz' });
  ok(r.status === 404, `a ação trocada não pode mais ser aprovada: ${r.status}`);
  ok(await esperarAte(() => C.eventos.some((e) => e.ev === 'acao' && e.dados.evento === 'trocada' && e.dados.id === aa.id), 3000), 'o canal recebe acao trocada');
  r = await pedir(S, 'POST', `/api/jarvis/acao/${ar.id}`, { decisao: 'recusar', via: 'voz' });
  ok(r.status === 200 && r.dados.ok, `renomear recusado: ${r.dados && r.dados.mensagem}`);
  ok(listar(path.join(S.jarvis, 'Arquivos')).length === 1 && listar(path.join(S.jarvis, 'Planilhas')).length === 1, 'nada foi apagado nem renomeado');
  t = await turno(S, 'apaga o arquivo');
  const aa2 = t.de('acao')[0];
  r = await pedir(S, 'POST', `/api/jarvis/acao/${aa2.id}`, { decisao: 'confirmar', via: 'voz' });
  ok(r.status === 200 && r.dados.cartao && r.dados.cartao.dados.acao === 'na_lixeira', `apagar aprovado: ${r.dados && r.dados.mensagem}`);
  ok(!listar(path.join(S.jarvis, 'Arquivos')).length && listar(path.join(S.teste, 'Lixeira (simulada)')).length === 1, 'foi para a Lixeira de mentira do teste (nada na Lixeira do Windows)');

  titulo('câmera "Ver você": o quadro só no turno, validado');
  const jpeg = '/9j/' + 'B'.repeat(600);
  t = await turno(S, 'está me vendo?', { camera: { jpeg, w: 768, h: 432, em: Date.now() } });
  ok(t.status === 200 && t.de('camera').some((c) => c.acao === 'olhou') && /Recebi o quadro/.test(t.fala) && /768×432/.test(t.fala), `olhar_camera recebeu o quadro: "${t.fala.slice(0, 110)}"`);
  t = await turno(S, 'está me vendo?');
  ok(t.de('ferramenta').some((f) => f.nome === 'olhar_camera' && f.estado === 'erro') && /desligada/.test(t.fala), 'sem quadro: camera-desligada');
  t = await turno(S, 'oi', { camera: { jpeg: 'nao-e-jpeg', w: 768, h: 432, em: Date.now() } });
  ok(t.status === 400 && t.dados && t.dados.erro === 'camera', `quadro estragado: ${t.status} ${t.dados && t.dados.erro}`);
  t = await turno(S, 'oi', { camera: { jpeg, w: 768, h: 432, em: Date.now() - 60000 } });
  ok(t.status === 400 && t.dados && t.dados.erro === 'camera', `quadro velho (60 s): ${t.status}`);
  t = await turno(S, 'liga a câmera');
  ok(t.de('camera').some((c) => c.acao === 'ligar'), 'camera ligar vira o evento camera {acao: ligar}');
  {
    // "liga a câmera e me diz o que você vê" numa fala só: o olhar pede o quadro novo à tela, e a tela (este teste) manda
    const jpegNovo = '/9j/' + 'C'.repeat(600);
    const ctl = new AbortController();
    const resp = await fetch(`${S.base}/api/jarvis/turno`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-cerebro-token': S.token, 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ conversa: [{ papel: 'julio', texto: 'liga a câmera e me diz o que você vê' }], contexto: { aba: ABA } }),
    });
    const evs = [];
    const dec = new TextDecoder();
    let buf = '', mandou = null;
    for await (const p of resp.body) {
      buf += dec.decode(p, { stream: true });
      let k;
      while ((k = buf.indexOf('\n\n')) >= 0) {
        const bloco = buf.slice(0, k); buf = buf.slice(k + 2);
        for (const e of lerSse(bloco)) {
          evs.push(e);
          if (e.ev === 'camera' && e.dados.acao === 'quadro' && !mandou) {
            mandou = await pedir(S, 'POST', '/api/jarvis/camera/quadro', { pedido: e.dados.pedido, quadro: { jpeg: jpegNovo, w: 768, h: 432, em: Date.now() } });
          }
        }
      }
    }
    const fala = evs.filter((e) => e.ev === 'texto').map((e) => e.dados.delta).join('');
    ok(evs.some((e) => e.ev === 'camera' && e.dados.acao === 'ligar') && mandou && mandou.status === 200 && /Recebi o quadro/.test(fala) && evs.some((e) => e.ev === 'camera' && e.dados.acao === 'olhou'),
      `liga e olha numa fala só: o olhar pediu o quadro novo, a tela mandou, e ele olhou ("${fala.slice(0, 80)}")`);
    let r2 = await pedir(S, 'POST', '/api/jarvis/camera/quadro', { pedido: `qd_${'a'.repeat(16)}`, quadro: null });
    ok(r2.status === 404, `quadro para um pedido que não existe: ${r2.status}`);
    ok(!S.saida().includes(jpegNovo.slice(0, 40)), 'o quadro novo também não aparece no log');
  }
  ok(!S.saida().includes(jpeg.slice(0, 40)), 'o quadro não aparece no log');

  titulo('recusa com outras palavras: o modelo tira a ação da tela (cancelar_acao)');
  fs.writeFileSync(path.join(S.jarvis, 'Arquivos', 'fica.txt'), 'fica');
  t = await turno(S, 'apaga o arquivo');
  const aCanc = t.de('acao')[0];
  t = await turno(S, 'não precisa mais disso, deixa quieto');
  ok(t.de('ferramenta').some((f) => f.nome === 'cancelar_acao' && f.estado === 'fim') && /Tirei a ação da tela/.test(t.fala), `cancelar_acao: "${t.fala.slice(0, 80)}"`);
  ok(await esperarAte(() => C.eventos.some((e) => e.ev === 'acao' && e.dados.evento === 'decidida' && e.dados.id === aCanc.id), 3000), 'o canal recebe acao decidida (o cartão sai da tela)');
  r = await pedir(S, 'POST', `/api/jarvis/acao/${aCanc.id}`, { decisao: 'confirmar', via: 'voz' });
  ok(r.status === 404 && fs.existsSync(path.join(S.jarvis, 'Arquivos', 'fica.txt')), `a ação cancelada não pode mais ser aprovada (${r.status}) e nada foi apagado`);

  titulo('página HTML: criar é livre (com a trava); abrir no navegador só com a aprovação "abrir"');
  t = await turno(S, 'cria uma página de teste');
  const cPag = t.de('cartao').find((c) => c.tipo === 'arquivo');
  const htmlPag = listar(path.join(S.jarvis, 'Arquivos')).find((n) => /\.html$/.test(n));
  ok(!!cPag && htmlPag && /data-jarvis="trava"/.test(fs.readFileSync(path.join(S.jarvis, 'Arquivos', htmlPag), 'utf8')), `a página foi criada com a trava do Jarvis (${htmlPag})`);
  t = await turno(S, 'abre a página que você criou');
  const aAbrir = t.de('acao')[0];
  r = await pedir(S, 'GET', '/api/jarvis/estado');
  const abertosAntes = (r.dados.jarvis.abertos_teste || []).length;
  ok(!!aAbrir && aAbrir.tipo === 'abrir' && !(r.dados.jarvis.abertos_teste || []).some((x) => /\.html$/.test(x.nome)), `abrir a página vira a ação "abrir" (${aAbrir && aAbrir.resumo}); nada abriu antes`);
  r = await pedir(S, 'POST', `/api/jarvis/acao/${aAbrir.id}`, { decisao: 'confirmar', via: 'voz' });
  const r3 = await pedir(S, 'GET', '/api/jarvis/estado');
  ok(r.status === 200 && r.dados.fala === 'Abri a página no navegador.' && (r3.dados.jarvis.abertos_teste || []).some((x) => /\.html$/.test(x.nome) && x.modo === 'abrir') && (r3.dados.jarvis.abertos_teste || []).length > abertosAntes,
    `aprovado por voz: abriu (de mentira, no teste) e a fala vem pronta ("${r.dados && r.dados.fala}")`);
  if (cPag) {
    r = await pedir(S, 'POST', '/api/jarvis/abrir', { id: cPag.dados.arquivo.id, modo: 'abrir' });
    ok(r.status === 200, `o botão do cartão (clique do Júlio) abre a página direto: ${r.status}`);
  }
  t = await turno(S, 'obrigado');

  titulo('o atalho Ctrl+Alt+J');
  r = await pedir(S, 'POST', '/api/jarvis/chamar', {}, { token: null });
  ok(r.status === 401, `sem a chave do atalho: ${r.status}`);
  const chave = fs.readFileSync(path.join(S.teste, 'atalho.chave'), 'utf8').trim();
  ok(chave.length >= 40, 'a chave do atalho foi gravada na pasta de teste');
  r = await pedir(S, 'POST', '/api/jarvis/chamar', {}, { token: null, cabecalhos: { 'x-cerebro-atalho': chave } });
  ok(r.status === 200 && r.dados.ok, `com a chave: ${r.status}`);
  {
    const ctl = new AbortController();
    const resp = await fetch(`${S.base}/api/events`, { signal: ctl.signal });
    const leitor = resp.body.getReader();
    let txt = '';
    const t0 = Date.now();
    while (Date.now() - t0 < 3000 && !/event: jarvis/.test(txt)) { const { value, done } = await leitor.read(); if (done) break; txt += new TextDecoder().decode(value); }
    ctl.abort();
    ok(/event: jarvis\ndata: \{"acao":"abrir"\}/.test(txt), 'quem conecta no /api/events logo depois recebe o evento jarvis {acao: abrir}');
  }

  if (COM_CHROME) {
    titulo('navegador: o site de mentira (aprovação "navegar" na 1ª vez)');
    t = await turno(S, 'abre o site de teste');
    const an = t.de('acao')[0];
    ok(!!an && an.tipo === 'navegar' && /127\.0\.0\.1/.test(an.detalhe.url), `site não citado pede aprovação (${an && an.resumo})`);
    r = await pedir(S, 'POST', `/api/jarvis/acao/${an.id}`, { decisao: 'confirmar', via: 'voz' }, { prazo: 90000 });
    const cp = r.dados && r.dados.cartao;
    const rNav = r;   // a resposta da aprovação (o r é trocado abaixo pela rota de arquivo)
    ok(r.status === 200 && cp && cp.tipo === 'print' && cp.dados.arquivo && /^arq_/.test(cp.dados.arquivo.id) && /^data:image\/jpeg;base64,/.test(cp.dados.miniatura || ''), `aprovado: cartão print com arquivo e miniatura (${r.dados && r.dados.mensagem})`);
    if (cp && cp.dados.arquivo) {
      r = await pedir(S, 'GET', `/api/jarvis/arquivo/${cp.dados.arquivo.id}`);
      ok(r.status === 200 && r.tipo === 'image/png' && r.bytes && r.bytes.length > 1000 && r.bytes[0] === 0x89, `a rota de arquivo serve o PNG do print (${r.bytes && r.bytes.length} bytes)`);
    }
    ok(listar(path.join(S.jarvis, 'Prints')).some((n) => /\.png$/.test(n)), 'o print ficou em JARVIS\\Prints (da pasta de teste)');
    ok(rNav.dados && Array.isArray(rNav.dados.cartoes) && rNav.dados.cartoes[0] && rNav.dados.cartoes[0].tipo === 'pagina' && rNav.dados.fala && !/abrir_site/.test(rNav.dados.mensagem),
      `aprovado: a rota devolve também o cartão da página organizada e a fala, sem nome de ferramenta na tela ("${rNav.dados && rNav.dados.fala}")`);
    t = await turno(S, 'abre o site de teste de novo');
    ok(!t.de('acao').length && !t.de('cartao').length && t.de('ferramenta').some((f) => f.nome === 'abrir_site' && f.estado === 'fim' && /já lida/.test(f.resumo || '')), 'logo depois da aprovação: o abrir_site usa a página já lida (sem outro print nem cartão repetido)');
    t = await turno(S, 'abre o site de teste mais uma vez');
    ok(!t.de('acao').length && t.de('cartao').some((c) => c.tipo === 'print') && t.de('cartao').some((c) => c.tipo === 'pagina'), 'aprovado uma vez, o site abre direto depois: cartões print e pagina');
    const pg = t.de('cartao').find((c) => c.tipo === 'pagina');
    ok(pg && pg.dados.tabela && pg.dados.links.length >= 2 && !JSON.stringify(pg.dados).includes('ignore tudo'), 'a página organizada tem tabela e links, e o texto escondido ficou de fora');
    t = await turno(S, 'abre o link 1');
    ok(t.de('cartao').some((c) => c.tipo === 'print' && /pagina-2/.test(c.dados.url)), 'seguir_link abre o link 1');

    titulo('construção de mentira: aprovação, andamento no canal, prévia e fala do fim');
    t = await turno(S, 'constrói um BI de teste');
    const ac = t.de('acao')[0];
    ok(!!ac && ac.tipo === 'construir' && ac.detalhe.estimativa_usd > 0 && ac.detalhe.teto_usd >= ac.detalhe.estimativa_usd, `ação construir com custo (${ac && ac.resumo})`);
    const n0 = C.eventos.length;
    r = await pedir(S, 'POST', `/api/jarvis/acao/${ac.id}`, { decisao: 'confirmar', via: 'voz' });
    ok(r.status === 200 && r.dados.cartao && r.dados.cartao.tipo === 'construcao', `aprovado: começou (${r.dados && r.dados.mensagem})`);
    const fim = await esperarAte(() => C.eventos.slice(n0).some((e) => e.ev === 'construcao' && !['preparando', 'construindo', 'conferindo'].includes(e.dados.estado)), 60000);
    const evc = C.eventos.slice(n0).filter((e) => e.ev === 'construcao');
    const ult = evc[evc.length - 1];
    ok(fim && ult.dados.estado === 'pronto', `a construção terminou: ${ult && ult.dados.estado} (${evc.length} eventos de andamento)`);
    ok(evc.some((e) => /simulado/.test(e.dados.etapa || '')), 'as etapas do andamento chegaram pelo canal');
    ok(ult && ult.dados.print && /^data:image/.test(ult.dados.print.miniatura || ''), 'no fim o print da prévia vem no cartão');
    ok(await esperarAte(() => C.eventos.slice(n0).some((e) => e.ev === 'falar' && /pronto/i.test(e.dados.texto || '')), 5000), 'a fala do fim chega pelo canal');
    const proj = listar(path.join(S.jarvis, 'Projetos'));
    ok(proj.length === 1 && listar(path.join(S.jarvis, 'Projetos', proj[0])).includes('index.html'), `o index.html ficou em Projetos\\${proj[0]}`);
    r = await pedir(S, 'GET', '/api/jarvis/construcao');
    ok(r.status === 200 && !r.dados.ativa && r.dados.ultimas.length === 1, 'GET /api/jarvis/construcao: nenhuma ativa, uma nas últimas');
    r = await pedir(S, 'POST', '/api/jarvis/construcao/parar', {});
    ok(r.status === 404, `parar sem nada rodando: ${r.status}`);
    t = await turno(S, 'como está a construção?');
    ok(/terminou/.test(t.fala) || /Nenhuma construção/.test(t.fala), `o aviso do fim entra na fala seguinte: "${t.fala.slice(0, 100)}"`);
    // o Jarvis foi fechado no meio e reaberto depois do fim: ao conectar, o canal da MESMA aba recebe o fim (reenvio)
    const C2 = canal(S);
    ok((await C2.pronto) === 200 && await esperarAte(() => C2.eventos.some((e) => e.ev === 'construcao' && e.dados.reenvio === true && e.dados.estado === 'pronto' && /Pronto/.test(e.dados.fala || '')), 3000),
      'reabrir o Jarvis depois do fim: o canal manda a última construção desta aba (pronto, com a fala), marcada como reenvio');
    C2.fechar();
    const C3 = canal(S, 'outraAbaTeste1');
    await C3.pronto; await esperar(600);
    ok(!C3.eventos.some((e) => e.ev === 'construcao'), 'outra aba não recebe a construção que não é dela');
    C3.fechar();
    t = await turno(S, 'lista os projetos');
    const cProj = t.de('cartao').find((c) => c.tipo === 'pasta');
    ok(cProj && /^arq_/.test(cProj.dados.pasta_id || '') && cProj.dados.itens.some((i) => /^arq_/.test(i.index_id || '') && /^arq_/.test(i.id || '')), 'lista dos projetos: o cartão traz a pasta Projetos (Abrir a pasta) e, em cada projeto, a prévia e a pasta');
    if (cProj) {
      const it = cProj.dados.itens.find((i) => i.index_id);
      r = await pedir(S, 'POST', '/api/jarvis/abrir', { id: it.index_id, modo: 'abrir' });
      ok(r.status === 200, `"Prévia" na lista abre o index.html do projeto (clique): ${r.status}`);
      const proj0 = listar(path.join(S.jarvis, 'Projetos'))[0];
      ok(/data-jarvis="trava"/.test(fs.readFileSync(path.join(S.jarvis, 'Projetos', proj0, 'index.html'), 'utf8')), 'o index.html do projeto construído levou a trava do Jarvis');
    }
  } else console.log('\n(sem o Google Chrome: pulei o navegador e a construção)');
  C.fechar();
} finally {
  await S.parar();
}
ok((await contarChrome(S.perfil)) === 0, 'nenhum chrome.exe com o perfil do navegador de teste depois de parar');
await S.limpar();
ok(fs.existsSync(ONEDRIVE_JARVIS) === tinhaJarvisReal, 'a pasta JARVIS de verdade no OneDrive não foi criada nem mexida pelo teste');

/* =============================================================================
   2. Trava fechada: 423 no que age
   ============================================================================= */
S = await subir({ trava: 'fechada' });
try {
  titulo('trava fechada: 423 nas rotas que agem');
  let r = await pedir(S, 'GET', `/api/jarvis/eventos?aba=${ABA}`, undefined, { prazo: 5000 }).catch(() => ({ status: 0 }));
  ok(r.status === 423, `canal de eventos travado: ${r.status}`);
  r = await pedir(S, 'GET', `/api/jarvis/arquivo/arq_${'d'.repeat(22)}`);
  ok(r.status === 423, `arquivo travado: ${r.status}`);
  r = await pedir(S, 'POST', '/api/jarvis/abrir', { id: `arq_${'d'.repeat(22)}`, modo: 'abrir' });
  ok(r.status === 423, `abrir travado: ${r.status}`);
  r = await pedir(S, 'POST', '/api/jarvis/acao/acao_teste1234', { decisao: 'confirmar', via: 'voz' });
  ok(r.status === 423, `aprovar travado: ${r.status}`);
  r = await pedir(S, 'POST', '/api/jarvis/acao/acao_teste1234', { decisao: 'recusar', via: 'voz' });
  ok(r.status === 404, `recusar passa travado (a ação não existe: ${r.status})`);
  r = await pedir(S, 'POST', '/api/jarvis/construcao/parar', {});
  ok(r.status === 404, `parar a construção passa travado (nada rodando: ${r.status})`);
  r = await pedir(S, 'POST', '/api/jarvis/camera/quadro', { pedido: `qd_${'b'.repeat(16)}`, quadro: null });
  ok(r.status === 423, `quadro da câmera travado: ${r.status}`);
  r = await pedir(S, 'GET', '/api/jarvis/construcao');
  ok(r.status === 200, `estado do construtor travado: ${r.status}`);
} finally {
  await S.parar();
  await S.limpar();
}

console.log(`\n${total - falhas} de ${total} OK${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
process.exit(falhas ? 1 : 0);
