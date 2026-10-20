/* Cérebro da Lube — servidor/navegador.js: o navegador do Jarvis, um Chrome escondido SÓ DELE, para abrir site, tirar
   print e ler a página. Especificação: docs/JARVIS-ACOES.md §6 (provas no §1.2).
   - O jeito do servidor/ouvido.js: --headless=new e --remote-debugging-pipe (o Node escreve no fd 3 e lê no fd 4; cada
     mensagem é um JSON terminado em \0). Nunca porta de depuração. Perfil próprio, separado do ouvido:
     %LOCALAPPDATA%\CerebroLube\navegador-chrome (fora do repositório e do OneDrive). Sem login em site nenhum.
   - Rede: o Fetch ligado no NAVEGADOR INTEIRO (sem sessão) faz toda requisição passar por motivoRede (§6.3): nada de
     127.0.0.1, localhost, IP interno, nome de uma palavra só (SRV-IA), nome que o DNS resolve para a rede interna,
     usuário e senha no endereço, nem esquema estranho. Assim o Jarvis não alcança o próprio app (o token), o SRV-IA:8080
     (a Abertura de margem ESCREVE no WinThor) nem outra máquina da Lube, nem por redirecionamento.
     O Fetch NÃO vê o aperto de mão do WebSocket (medido em 2026-10-20; o Network.setBlockedURLs também não barra): quem
     barra o WebSocket de uma página pública para a rede local é o Local Network Access do próprio Chrome 155 com
     --deny-permission-prompts (medido: WebSocket, fetch, imagem e iframe de example.com para 127.0.0.1 não chegaram).
     Por isso a aba principal nunca carrega página da rede local, e a prévia do construtor roda sem WebSocket.
     Contra DNS rebinding: o endereço de onde a página veio (Network.responseReceived) também é conferido; se for da rede
     local, a página é fechada (sem proxy no Windows; com proxy esse endereço é o do proxy e a conferência fica desligada).
   - Endereço (§6.4, urlLiberada): host citado pelo Júlio, aprovado (ação navegar), gov.br e lube.com.br abrem inteiros;
     host que só apareceu na pesquisa ou num link de página, só no endereço EXATO visto. A página aberta pela ferramenta
     que vai sozinha para outro site (redirecionamento, script, meta refresh) passa pela mesma regra (destinoOk do
     abrir); barrada, vira o erro site-redirecionou e a ferramenta oferece a aprovação "navegar" do destino.
   - Download negado (Browser.setDownloadBehavior), janela nova fechada na hora, alerta da página sempre "cancelar",
     pedido de permissão (câmera, local, notificação) sempre negado.
   - Uma operação por vez (fila em série). Abre na primeira ferramenta; fecha depois de ociosoMs sem uso, no desligar() e
     no exit do Node (taskkill /T /F na árvore). Código 21 (perfil em uso) → fecha o Chrome velho e tenta uma vez mais.
   - O log leva só o motivo e o site ("navegador: bloqueei nome-de-rede srv-ia"), nunca o endereço inteiro nem o texto. */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import net from 'node:net';
import dns from 'node:dns/promises';
import path from 'node:path';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acharChrome, matarPerfil } from './ouvido.js';
import { ErroFerramenta, norm } from './util.js';

const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
export const PERFIL_PADRAO = path.join(LOCAL, 'CerebroLube', 'navegador-chrome');

/* Textos para o modelo e para a tela (frases curtas; códigos do §6.5). */
export const TEXTOS = Object.freeze({
  'site-url': 'Esse endereço não vale. Use o endereço completo de um site, com http ou https (ex.: https://www.bcb.gov.br).',
  'site-bloqueado': 'Esse endereço é da rede da Lube ou deste computador: o navegador do Jarvis não entra lá.',
  'site-fora-do-ar': 'O site não respondeu (fora do ar, endereço errado ou sem internet).',
  'site-prazo': 'O site demorou demais para abrir.',
  'site-sem-pagina': 'Não tem página aberta no navegador do Jarvis. Abra um site antes (abrir_site).',
  'site-sem-chrome': 'Não achei o Google Chrome neste computador. O navegador do Jarvis precisa dele.',
  'site-download': 'Esse endereço é um download. O navegador do Jarvis não baixa arquivos.',
  'site-caiu': 'O navegador do Jarvis parou no meio. Tente de novo.',
  'site-perfil': 'Não consegui criar a pasta do navegador em %LOCALAPPDATA%\\CerebroLube.',
  'formulario-senha': 'Esse formulário pede senha, login, CPF, CNPJ, cartão ou código. Isso eu não preencho: faça você mesmo.',
  'formulario-campo': 'Não achei esse campo no formulário da página.',
  'formulario-valor': 'Esse valor não serve para o campo.',
  'formulario-botao': 'Não achei o botão para enviar o formulário. Diga o nome do botão que está na tela.',
  'formulario-mudou': 'A página mudou desde que preparei o formulário. Nada foi enviado.',
  'previa-fora': 'Essa prévia fica fora da pasta Projetos do Jarvis.',
  'site-redirecionou': 'O site quis me levar para outro site, que você não citou. Não abri sem a sua aprovação.',
});
const erro = (codigo, mensagem) => new ErroFerramenta(mensagem || TEXTOS[codigo] || TEXTOS['site-caiu'], codigo);

const FLAGS = [
  '--headless=new', '--remote-debugging-pipe',
  '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions', '--disable-default-apps',
  '--disable-background-networking', '--disable-component-update', '--disable-domain-reliability',
  '--mute-audio', '--hide-scrollbars', '--lang=pt-BR', '--password-store=basic', '--deny-permission-prompts',
  '--disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication,PasswordManagerOnboarding',
  // nunca --use-fake-ui-for-media-stream, nunca porta de depuração, nunca Browser.grantPermissions
];
// a prévia do construtor só carrega biblioteca destes (os mesmos da conferência do fim, §7.6), e só por https
const CDN_PREVIA = new Set(['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com']);
const ALTURA_MAX = 8000;           // página inteira: no máximo 8.000 px de altura (§6.5)
const PNG_MAX = 6 * 1024 * 1024;   // página inteira muito pesada em PNG: vai em JPEG
const MINI_MAX = 160 * 1024;       // a miniatura do cartão (data:)
const RUIDO_STDERR = /update_service_dialer|updater|gcm|registration_request|DEPRECATED_ENDPOINT|DevTools listening|ssl_client_socket|Fontconfig/i;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const existe = (f) => { try { return fs.statSync(f).isFile(); } catch (_) { return false; } };
const codigoDe = (e) => (e && (e.codigo || e.code || e.name)) || 'erro';

/* ---------- programas do Windows (caminho completo: nada de PATH) ---------- */
const SISTEMA = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
const TASKKILL = path.join(SISTEMA, 'System32', 'taskkill.exe');
const REG = path.join(SISTEMA, 'System32', 'reg.exe');
// taskkill /T /F mata a árvore inteira; o código pode vir ≠ 0 quando um filho já tinha saído: ignorar
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
// Se o Node morrer à força, o pipe fecha e o Chrome sai sozinho.
const VIVOS = new Set();
let ganchoSaida = false;
function guardarVivo(filho) {
  VIVOS.add(filho);
  filho.once('exit', () => VIVOS.delete(filho));
  if (ganchoSaida) return;
  ganchoSaida = true;
  process.on('exit', () => { for (const f of VIVOS) matarArvoreSync(f.pid); });
}

/* Proxy do Windows ligado? Com proxy, o "endereço de onde a página veio" é o do proxy (às vezes 127.0.0.1): a
   conferência contra DNS rebinding fica desligada. Lido uma vez (o Chrome usa as Opções da Internet, HKCU). */
let proxyLido = null;
function lerRegistroValor(nome) {
  return new Promise((res) => {
    if (process.platform !== 'win32') { res(null); return; }
    execFile(REG, ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings', '/v', nome],
      { windowsHide: true, timeout: 4000 }, (err, out) => {
        if (err) { res(null); return; }
        const m = String(out || '').match(/REG_\w+\s+([^\r\n]*)/);
        res(m ? m[1].trim() : null);
      });
  });
}
export function proxyDoSistema() {
  if (!proxyLido) {
    proxyLido = Promise.all([lerRegistroValor('ProxyEnable'), lerRegistroValor('AutoConfigURL')])
      .then(([liga, pac]) => !!((liga && /^0x0*1$/i.test(liga)) || (pac && pac.length > 0)))
      .catch(() => false);
  }
  return proxyLido;
}

/* =============================================================================
   Regra de rede (§6.3)
   ============================================================================= */
function v4Privado([a, b, c]) {
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 192 && b === 88 && c === 99) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113) || a >= 224;
}
// IPv6 em 16 bytes (com o IPv4 embutido no fim, "::ffff:1.2.3.4"); null = inválido
function bytesV6(ip) {
  let s = String(ip).toLowerCase();
  const pct = s.indexOf('%');
  if (pct >= 0) s = s.slice(0, pct);
  let v4 = null;
  const m = s.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (m) {
    if (!net.isIPv4(m[2])) return null;
    v4 = m[2].split('.').map(Number);
    s = `${m[1]}0:0`;
  }
  const partes = s.split('::');
  if (partes.length > 2) return null;
  const esq = partes[0] ? partes[0].split(':') : [];
  const dir = partes.length === 2 && partes[1] ? partes[1].split(':') : [];
  const falta = 8 - esq.length - dir.length;
  if (falta < 0 || (partes.length === 1 && falta !== 0)) return null;
  const grupos = [...esq, ...Array(partes.length === 2 ? falta : 0).fill('0'), ...dir];
  if (grupos.length !== 8) return null;
  const b = [];
  for (const g of grupos) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16);
    b.push(n >> 8, n & 255);
  }
  if (v4) [b[12], b[13], b[14], b[15]] = v4;
  return b;
}
function v6Privado(b) {
  const zeros = (de, ate) => b.slice(de, ate).every((x) => x === 0);
  if (zeros(0, 15) && (b[15] === 0 || b[15] === 1)) return true;                 // :: e ::1
  if (zeros(0, 10) && b[10] === 0xff && b[11] === 0xff) return v4Privado(b.slice(12));   // ::ffff:a.b.c.d
  if (zeros(0, 12)) return v4Privado(b.slice(12));                                // ::a.b.c.d (antigo)
  if (b[0] === 0 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return b[4] === 0 && b[5] === 0 && zeros(6, 12) ? v4Privado(b.slice(12)) : true;   // NAT64
  if (b[0] === 0x20 && b[1] === 0x02) return v4Privado(b.slice(2, 6));             // 6to4
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0 && b[3] === 0) return true;     // Teredo
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true;   // documentação
  if (b[0] === 0x01 && zeros(1, 8)) return true;                                   // 100::/64 (descarte)
  if ((b[0] & 0xfe) === 0xfc) return true;                                         // fc00::/7
  if (b[0] === 0xfe && (b[1] & 0x80) === 0x80) return true;                        // fe80::/10 e fec0::/10
  return b[0] === 0xff;                                                            // multicast
}
/** IP da rede local, do próprio computador ou especial (documentação, multicast…). Texto que não é IP = true. */
export function ipPrivado(ip) {
  const s = String(ip || '').replace(/^\[|\]$/g, '');
  if (net.isIPv4(s)) return v4Privado(s.split('.').map(Number));
  if (net.isIPv6(s)) { const b = bytesV6(s); return !b || v6Privado(b); }
  return true;
}

// nomes que nunca saem da rede local
const NOMES_LOCAIS = /(^|\.)(localhost|local|lan|internal|intranet|localdomain|home\.arpa|home|corp)$/;
const cacheDns = new Map();   // host -> {r, ate}
function lembrarDns(h, r, ms) {
  cacheDns.set(h, { r, ate: Date.now() + ms });
  if (cacheDns.size > 500) cacheDns.delete(cacheDns.keys().next().value);
  return r;
}
/** Nome do host como o Chrome usa: minúsculas, IPv4 em forma canônica (0x7f.1 → 127.0.0.1), sem colchetes nem ponto no fim. null = inválido. */
export function hostCanonico(host) {
  let h = String(host ?? '').trim().toLowerCase();
  if (!h || h.length > 260) return null;
  if (h.includes(':') && !h.startsWith('[')) h = `[${h}]`;
  try { h = new URL(`http://${h}/`).hostname; } catch (_) { return null; }
  return h.replace(/^\[|\]$/g, '').replace(/\.$/, '') || null;
}
/**
 * Por que o navegador do Jarvis não entra neste host (§6.3): 'ip-local' | 'nome-local' | 'nome-de-rede' | 'dns-local' |
 * 'sem-dns' | 'nome-invalido' | 'vazio'; null = pode. O DNS fica guardado 60 s (a falta dele, 10 s).
 */
export async function hostBloqueado(host) {
  if (host == null || String(host).trim() === '') return 'vazio';
  const h = hostCanonico(host);
  if (!h) return 'nome-invalido';
  if (net.isIP(h)) return ipPrivado(h) ? 'ip-local' : null;
  if (NOMES_LOCAIS.test(h)) return 'nome-local';
  if (!h.includes('.')) return 'nome-de-rede';            // SRV-IA, intranet: nome de uma palavra só
  const c = cacheDns.get(h);
  if (c && c.ate > Date.now()) return c.r;
  let ends = null;
  try {
    ends = await Promise.race([
      dns.lookup(h, { all: true, verbatim: true }),
      new Promise((res) => { const t = setTimeout(() => res(null), 5000); t.unref?.(); }),
    ]);
  } catch (_) { ends = null; }
  if (!ends || !ends.length) return lembrarDns(h, 'sem-dns', 10_000);
  return lembrarDns(h, ends.some((e) => ipPrivado(e.address)) ? 'dns-local' : null, 60_000);
}

function dentroDe(raiz, alvo) {
  const rel = path.relative(raiz.toLowerCase(), alvo.toLowerCase());
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/* =============================================================================
   Que endereço o modelo abre sem aprovação (§6.4)
   ============================================================================= */
const SEMPRE_LIBERADOS = /(^|\.)(gov\.br|lube\.com\.br)$/;
// sufixos públicos: citar "com.br" não libera o .com.br inteiro
const SUFIXOS = new Set(['com', 'net', 'org', 'br', 'io', 'co', 'gov', 'edu', 'info', 'biz', 'app', 'dev', 'me', 'tv', 'us', 'uk', 'pt', 'ar',
  'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'art.br', 'eco.br', 'blog.br', 'ind.br', 'inf.br', 'tur.br', 'jus.br', 'leg.br', 'mp.br', 'mil.br',
  'co.uk', 'org.uk', 'com.ar', 'com.pt', 'com.mx', 'com.au', 'co.jp', 'github.io', 'vercel.app', 'netlify.app', 'pages.dev', 'web.app', 'firebaseapp.com']);
const RX_EMBRULHO = /[A-Za-z0-9+/=_-]{60,}/;   // dado embrulhado (base64, hex longo) no caminho ou depois do "?"
const PORTAS_LIBERADAS = new Set(['', '80', '443', '8080', '8443']);
const semWww = (h) => h.replace(/^www\d?\./, '');

/** Os domínios que o Júlio disse nesta conversa ("bcb ponto gov ponto br", "bcb.gov.br", "https://…"). Só as falas dele. */
export function sitesCitados(conversa) {
  const out = new Set();
  for (const e of Array.isArray(conversa) ? conversa : []) {
    if (!e || e.papel !== 'julio' || typeof e.texto !== 'string') continue;
    // "bcb ponto gov ponto br" vira "bcb.gov.br"; o ponto final de frase ("… br. Ah") não emenda com a palavra seguinte
    const t = norm(e.texto).replace(/\s+(ponto|dot)\s+/g, '.');
    for (const m of t.matchAll(/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}/g)) {
      const h = semWww(m[0].replace(/\.$/, ''));
      if (h.includes('.') && !SUFIXOS.has(h)) out.add(h);
    }
    for (const m of t.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g)) if (net.isIPv4(m[0])) out.add(m[0]);
  }
  return out;
}
function casaDominio(host, dominio) { return host === dominio || host.endsWith(`.${dominio}`); }
/** O endereço exato, para comparar com o que foi visto (link de página, resultado da pesquisa): sem esquema, sem www,
 *  sem o # e sem a barra do fim. */
export function chaveUrl(url) {
  let u;
  try { u = url instanceof URL ? url : new URL(String(url)); } catch (_) { return ''; }
  const caminho = u.pathname.replace(/\/+$/, '') || '';
  return `${semWww(u.hostname.toLowerCase())}${u.port ? `:${u.port}` : ''}${caminho}${u.search}`;
}
/** O site de um host ("g1.globo.com" e "consent.globo.com" → "globo.com"; "loja.exemplo.com.br" → "exemplo.com.br"). */
export function dominioBase(host) {
  const h = semWww(String(host || '').toLowerCase().replace(/^\[|\]$/g, ''));
  if (!h || net.isIP(h)) return h;
  const p = h.split('.');
  if (p.length <= 2) return h;
  return SUFIXOS.has(p.slice(-2).join('.')) ? p.slice(-3).join('.') : p.slice(-2).join('.');
}
/** Normaliza o que o modelo mandou: sem esquema vira https://; só http e https. Lança site-url. */
export function normalizarUrl(bruta) {
  let s = String(bruta ?? '').trim();
  if (!s || s.length > 2000) throw erro('site-url');
  if (/[\s\0]/.test(s)) throw erro('site-url', 'O endereço tem espaço ou caractere inválido. Mande o endereço sem espaços.');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s.replace(/^\/+/, '')}`;
  let u;
  try { u = new URL(s); } catch (_) { throw erro('site-url'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw erro('site-url', 'Só abro endereços http ou https.');
  if (u.username || u.password) throw erro('site-bloqueado', 'Endereço com usuário ou senha embutidos eu não abro.');
  if (!u.hostname) throw erro('site-url');
  return u;
}

/* =============================================================================
   O que roda DENTRO da página, sempre num mundo isolado (o JavaScript da página não mexe nestas funções)
   ============================================================================= */
/* Extração (§6.5): título, descrição, títulos, texto principal, tabelas e links — só o que aparece na tela. Texto
   escondido (display:none, visibility, opacidade, fonte minúscula, fora da página, "sr-only", cor transparente) e
   caracteres invisíveis (largura zero, bidi, tags Unicode) ficam de fora: é por onde uma página tenta dar ordem ao
   Jarvis sem o Júlio ver. */
function extrairNaPagina(op) {
  const INVIS = /[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff\ufff9-\ufffb]|[\u{e0000}-\u{e007f}]/gu;
  const limpo = (t, n) => String(t || '').replace(INVIS, '').replace(/[\s\u00a0]+/g, ' ').trim().slice(0, n);
  const PULAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'IFRAME', 'FRAME', 'OBJECT', 'EMBED', 'HEAD', 'SELECT', 'DATALIST', 'VIDEO', 'AUDIO', 'IMG', 'PICTURE', 'INPUT', 'TEXTAREA', 'MAP', 'MATH', 'DIALOG']);
  const BLOCO = /^(block|flex|grid|list-item|table|table-row|table-caption|flow-root|table-row-group|table-header-group|table-footer-group)$/;
  const fim = performance.now() + op.prazoMs;
  const cache = new Map();
  const larg = document.documentElement.scrollWidth, alt = document.documentElement.scrollHeight;
  function info(el) {
    let v = cache.get(el);
    if (v) return v;
    const cs = getComputedStyle(el);
    let vis = !(cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || Number(cs.opacity) < 0.05
      || parseFloat(cs.fontSize) < 4 || cs.contentVisibility === 'hidden');
    if (vis && (cs.color === 'rgba(0, 0, 0, 0)' || cs.color === 'transparent') && cs.webkitBackgroundClip !== 'text' && cs.backgroundClip !== 'text') vis = false;
    if (vis && cs.display !== 'contents') {
      const r = el.getBoundingClientRect();
      const x = r.left + window.scrollX, y = r.top + window.scrollY;
      if ((r.width < 2 || r.height < 2) && cs.overflow !== 'visible') vis = false;                 // o truque "sr-only"
      else if (r.width > 0 && (x + r.width <= 0 || y + r.height <= 0 || x >= larg + 50 || y >= alt + 50)) vis = false;   // fora da página
      else if (/inset\(\s*(49|50)%|circle\(\s*0/.test(cs.clipPath || '')) vis = false;
      else if (/rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)/.test(cs.clip || '')) vis = false;
      else if (/scale\(\s*0(\.0+)?\s*\)|matrix\(\s*0(\.0+)?,\s*0(\.0+)?,\s*0(\.0+)?,\s*0(\.0+)?/.test(cs.transform || '')) vis = false;
    }
    v = { vis, bloco: BLOCO.test(cs.display), celula: cs.display === 'table-cell' };
    cache.set(el, v);
    return v;
  }
  const raiz = document.querySelector('main, [role="main"], article');
  const tudo = [], principal = [];
  let nTudo = 0, nPrincipal = 0, dentro = 0, passos = 0, parou = false;
  const coletores = [];
  const titulos = [], links = [], tabelas = [], vistos = new Set();
  const aqui = location.href.split('#')[0];
  function por(t) {
    if (nTudo < op.maxTexto) { tudo.push(t); nTudo += t.length; }
    if (dentro && nPrincipal < op.maxTexto) { principal.push(t); nPrincipal += t.length; }
    for (const c of coletores) if (c.n < 400) { c.p.push(t); c.n += t.length; }
  }
  function lerTabela(tb) {
    const linhas = [];
    for (const tr of tb.rows) {
      if (linhas.length >= 16) break;
      if (!info(tr).vis) continue;
      const cel = [...tr.cells].slice(0, 8).map((c) => limpo(c.innerText, 80));
      if (cel.some(Boolean)) linhas.push(cel);
    }
    if (linhas.length >= 2) tabelas.push(linhas);
  }
  function andar(no) {
    for (let c = no.firstChild; c; c = c.nextSibling) {
      if (parou) return;
      if (++passos % 256 === 0 && performance.now() > fim) { parou = true; return; }
      if (c.nodeType === 3) { const t = c.nodeValue; if (t && /\S/.test(t)) por(t.replace(/\s+/g, ' ')); continue; }
      if (c.nodeType !== 1) continue;
      const tag = c.tagName;
      if (tag === 'BR') { por('\n'); continue; }
      if (PULAR.has(tag)) continue;
      const e = info(c);
      if (!e.vis) continue;
      const ehRaiz = c === raiz;
      if (ehRaiz) dentro++;
      const titulo = /^H[1-3]$/.test(tag) && titulos.length < 30;
      const link = tag === 'A' && c instanceof HTMLAnchorElement && c.hasAttribute('href') && links.length < 60;
      const col = titulo || link ? { p: [], n: 0 } : null;
      if (col) coletores.push(col);
      if (tag === 'TABLE' && tabelas.length < 3 && (!raiz || dentro) && !c.parentElement?.closest('table')) lerTabela(c);
      if (e.bloco) por('\n');
      if (c.shadowRoot) andar(c.shadowRoot);
      andar(c);
      if (e.celula) por(' | ');
      if (e.bloco) por('\n');
      if (col) {
        coletores.splice(coletores.indexOf(col), 1);
        if (titulo) { const t = limpo(col.p.join(''), 160); if (t) titulos.push({ n: Number(tag[1]), t }); }
        if (link) {
          let u = null;
          try { u = new URL(c.href); } catch (_) { u = null; }
          if (u && (u.protocol === 'http:' || u.protocol === 'https:') && u.href.length <= 500) {
            const sem = u.href.split('#')[0];
            const t = limpo(col.p.join('') || c.getAttribute('aria-label') || c.title, 100);
            if (t && sem !== aqui && !vistos.has(sem)) { vistos.add(sem); links.push({ texto: t, url: u.href }); }
          }
        }
      }
      if (ehRaiz) dentro--;
    }
  }
  if (document.body) andar(document.body);
  const juntar = (lista) => lista.join('').replace(INVIS, '').split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((l, i, a) => l || (i > 0 && a[i - 1])).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const meta = document.querySelector('meta[name="description" i], meta[property="og:description" i]');
  const usarPrincipal = raiz && nPrincipal >= 300;
  return {
    titulo: limpo(document.title, 200), url: location.href, descricao: limpo(meta && meta.content, 300),
    titulos, texto: juntar(usarPrincipal ? principal : tudo).slice(0, op.maxTexto), links, tabelas,
    idioma: limpo(document.documentElement.lang, 20), cortado: parou || nTudo >= op.maxTexto,
  };
}

/* Formulário (§6.6): acha cada campo por rótulo, aria-label, placeholder, name ou id; recusa senha, login, CPF, CNPJ,
   cartão e código; recusa select ou caixa de marcar que não casa. Com op.preencher, preenche (valor + eventos input e
   change) e aperta o botão (ou envia o formulário). */
function formularioNaPagina(op) {
  const n = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9@]+/g, ' ').trim();
  const SENS = /senha|password|passwd|\bpass\b|\bpwd\b|\bcpf\b|\bcnpj\b|cartao|\bcard\b|\bcvv2?\b|\bcvc\b|token|\bpin\b|login|usuario|username|\botp\b|\b2fa\b|codigo de (seguranca|verificacao|acesso)/;
  const AUTO_SENS = /password|one-time-code|^cc-|\bcc-|username/;
  const TIPOS_TEXTO = new Set(['text', 'email', 'search', 'tel', 'url', 'number', 'date', 'datetime-local', 'month', 'time', 'week', '']);
  const visivel = (el) => (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : !!(el.offsetWidth || el.offsetHeight));
  const campos = [...document.querySelectorAll('input, textarea, select')].filter((el) => el.type !== 'hidden' && visivel(el));
  const rotulos = (el) => {
    const r = [];
    if (el.labels) for (const l of el.labels) r.push(l.innerText);
    const al = el.getAttribute('aria-label'); if (al) r.push(al);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) for (const id of lb.split(/\s+/)) { const x = document.getElementById(id); if (x) r.push(x.innerText); }
    r.push(el.getAttribute('placeholder'), el.getAttribute('name'), el.id, el.getAttribute('title'));
    return r.map(n).filter(Boolean);
  };
  const legivel = (el) => {
    if (el.labels && el.labels[0]) return el.labels[0].innerText.trim().slice(0, 80);
    return String(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.id || '').trim().slice(0, 80);
  };
  const sensivel = (el) => {
    if (String(el.type).toLowerCase() === 'password') return true;
    if (AUTO_SENS.test(String(el.getAttribute('autocomplete') || '').toLowerCase())) return true;
    return rotulos(el).some((x) => SENS.test(x));
  };
  const casa = (lista, q) => lista.find((el) => rotulos(el).some((x) => x === q))
    || lista.find((el) => rotulos(el).some((x) => ` ${x} `.includes(` ${q} `)))
    || lista.find((el) => rotulos(el).some((x) => x.length >= 3 && ` ${q} `.includes(` ${x} `)));
  const SIM = new Set(['sim', 'marcar', 'marcado', 'marca', 'true', '1', 'x', 'yes', 'aceito', 'concordo']);
  const NAO = new Set(['nao', 'desmarcar', 'desmarcado', 'false', '0', 'no']);
  const achados = [];
  for (const p of op.campos) {
    const q = n(p.campo);
    const el = q ? casa(campos, q) : null;
    if (!el) return { erro: 'formulario-campo', campo: p.campo };
    if (achados.some((a) => a.el === el)) return { erro: 'formulario-campo', campo: p.campo, repetido: true };
    if (sensivel(el)) return { erro: 'formulario-senha', campo: p.campo };
    if (el.disabled || el.readOnly) return { erro: 'formulario-campo', campo: p.campo, travado: true };
    const tag = el.tagName, tipo = String(el.type || '').toLowerCase();
    const a = { el, p, rotulo: legivel(el) || p.campo, tipo: tag === 'SELECT' ? 'lista' : tag === 'TEXTAREA' ? 'texto' : tipo };
    if (tag === 'SELECT') {
      const v = n(p.valor);
      const opc = [...el.options].find((o) => n(o.text) === v || o.value === p.valor) || [...el.options].find((o) => v && n(o.text).includes(v));
      if (!opc) return { erro: 'formulario-valor', campo: p.campo, opcoes: [...el.options].slice(0, 12).map((o) => o.text.trim().slice(0, 40)) };
      a.opcao = opc;
    } else if (tipo === 'checkbox' || tipo === 'radio') {
      const v = n(p.valor);
      if (!SIM.has(v) && !NAO.has(v)) return { erro: 'formulario-valor', campo: p.campo, marcar: true };
      if (tipo === 'radio' && NAO.has(v)) return { erro: 'formulario-valor', campo: p.campo, marcar: true };
      a.marcar = SIM.has(v);
    } else if (tag === 'TEXTAREA' || TIPOS_TEXTO.has(tipo)) {
      a.valor = String(p.valor);
      if (tipo === 'date') {
        const m = a.valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) a.valor = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(a.valor)) return { erro: 'formulario-valor', campo: p.campo, data: true };
      }
    } else return { erro: 'formulario-campo', campo: p.campo, tipo };   // arquivo, imagem, cor, faixa…: não
    achados.push(a);
  }
  const forms = [...new Set(achados.map((a) => a.el.form).filter(Boolean))];
  for (const f of forms) if (f.querySelector('input[type="password" i]')) return { erro: 'formulario-senha' };
  if (!forms.length && [...document.querySelectorAll('input[type="password" i]')].some(visivel)) return { erro: 'formulario-senha' };
  const escopo = forms.length === 1 ? forms[0] : document;
  const botoes = [...escopo.querySelectorAll('button, input[type="submit" i], input[type="button" i], [role="button"]')].filter(visivel);
  const textoBotao = (b) => String(b.innerText || b.value || b.getAttribute('aria-label') || b.title || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  let botao = null;
  if (op.botao) {
    const q = n(op.botao);
    botao = botoes.find((b) => n(textoBotao(b)) === q) || botoes.find((b) => q && n(textoBotao(b)).includes(q)) || null;
    if (!botao) return { erro: 'formulario-botao', botoes: botoes.slice(0, 8).map(textoBotao).filter(Boolean) };
  } else {
    botao = botoes.find((b) => String(b.type).toLowerCase() === 'submit') || null;
    if (!botao && !forms.length) return { erro: 'formulario-botao', botoes: botoes.slice(0, 8).map(textoBotao).filter(Boolean) };
  }
  let destino = null;   // para onde o formulário manda (origem: esquema, host e porta)
  try { if (forms.length === 1) destino = new URL(forms[0].action || location.href).origin; } catch (_) { destino = null; }
  if (!op.preencher) {
    return {
      ok: true, url: location.href, titulo: document.title.slice(0, 200), destino,
      campos: achados.map((a) => ({ campo: a.p.campo, rotulo: a.rotulo, valor: a.opcao ? a.opcao.text.trim().slice(0, 80) : a.marcar !== undefined ? (a.marcar ? 'marcar' : 'desmarcar') : String(a.p.valor), tipo: a.tipo })),
      botao: botao ? textoBotao(botao) || 'Enviar' : 'Enviar (o próprio formulário)',
    };
  }
  if (location.href.split('#')[0] !== String(op.url || '').split('#')[0]) return { erro: 'formulario-mudou' };
  const evento = (el, nome) => el.dispatchEvent(new Event(nome, { bubbles: true }));
  for (const a of achados) {
    const el = a.el;
    el.focus();
    if (a.opcao) { a.opcao.selected = true; evento(el, 'input'); evento(el, 'change'); }
    else if (a.marcar !== undefined) { if (el.checked !== a.marcar) el.click(); }
    else {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, a.valor);
      evento(el, 'input'); evento(el, 'change');
    }
    el.blur();
  }
  if (botao) botao.click();
  else if (forms[0].requestSubmit) forms[0].requestSubmit(); else forms[0].submit();
  return { ok: true, preenchidos: achados.length };
}

// a prévia (página gerada pelo construtor) roda sem WebSocket, WebRTC nem worker: o Fetch não vê o WebSocket, e uma
// página aberta por file:// conta como "local" para o Chrome (o Local Network Access não barra)
const SEM_CONEXAO = `(() => { for (const k of ['WebSocket', 'WebTransport', 'RTCPeerConnection', 'webkitRTCPeerConnection', 'Worker', 'SharedWorker', 'EventSource']) { try { Object.defineProperty(window, k, { value: undefined, writable: false, configurable: false }); } catch (_) {} } try { Object.defineProperty(navigator, 'sendBeacon', { value: () => false, configurable: false }); } catch (_) {} try { if (navigator.serviceWorker) Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: false }); } catch (_) {} })();`;

/* =============================================================================
   Transporte CDP pelo pipe (o do servidor/ouvido.js, com o erro do navegador)
   ============================================================================= */
function criarTransporte(filho) {
  const escrever = filho.stdio[3], ler = filho.stdio[4];
  let buf = '', seq = 0, fechado = false;
  const pendentes = new Map(), ouvintes = new Set();
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
        if (o.error) { const e = erro('site-caiu'); e.cdp = `${p.method}: ${String(o.error.message || '').slice(0, 120)}`; p.rej(e); }
        else p.res(o.result || {});
      } else if (o.method) for (const f of ouvintes) { try { f(o); } catch (_) { /* nada */ } }
    }
    if (buf.length > 96 * 1024 * 1024) buf = '';   // proteção: mensagem sem fim (o print da página inteira cabe)
  });
  const fechar = () => {
    if (fechado) return;
    fechado = true;
    for (const p of pendentes.values()) { clearTimeout(p.t); p.rej(erro('site-caiu')); }
    pendentes.clear();
    try { escrever.end(); } catch (_) { /* nada */ }
  };
  ler.on('error', () => {}); escrever.on('error', () => {});
  ler.on('close', fechar);
  return {
    enviar(method, params = {}, { sessao, prazo = 15000 } = {}) {
      return new Promise((res, rej) => {
        if (fechado) { rej(erro('site-caiu')); return; }
        const id = ++seq;
        const t = setTimeout(() => { pendentes.delete(id); const e = erro('site-caiu'); e.prazo = method; rej(e); }, prazo);
        pendentes.set(id, { res, rej, t, method });
        try { escrever.write(JSON.stringify({ id, method, params, ...(sessao ? { sessionId: sessao } : {}) }) + '\0'); }
        catch (_) { clearTimeout(t); pendentes.delete(id); rej(erro('site-caiu')); }
      });
    },
    ouvir(f) { ouvintes.add(f); return () => ouvintes.delete(f); },
    get fechado() { return fechado; },
    fechar,
  };
}

/* =============================================================================
   criarNavegador
   ============================================================================= */
export function criarNavegador({
  perfil = PERFIL_PADRAO,
  chrome = acharChrome(),
  log = () => {},
  largura = 1366, altura = 900,
  ociosoMs = 5 * 60_000,       // fecha o Chrome depois de 5 min sem uso
  projetosDir = null,          // JARVIS\Projetos: o único lugar de onde file:// pode carregar (a prévia do construtor)
  permitirTeste = null,        // só o teste: { origem: 'http://127.0.0.1:<porta>' } liberada na regra de rede
  _conferirIp = null,          // só o teste: força ligar (true) ou desligar (false) a conferência do IP da página
} = {}) {
  perfil = path.resolve(perfil);
  const projetos = projetosDir ? path.resolve(projetosDir) : null;
  // só o teste: a origem do servidor de mentira (liberada na regra de rede e sem a conferência do IP) e, opcional, uma
  // origem "rebinding" (liberada na regra, mas COM a conferência do IP: faz o papel de um nome público que apontou para
  // a rede local depois de passar no DNS)
  const origemDe = (x) => {
    try {
      const u = new URL(String(x));
      return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost') && u.port ? u.origin : null;
    } catch (_) { return null; }
  };
  const origemTeste = permitirTeste ? origemDe(permitirTeste.origem) : null;
  const origensRede = new Set([origemTeste, permitirTeste ? origemDe(permitirTeste.rebinding) : null].filter(Boolean));
  let exe = chrome || null;

  let filho = null, cdp = null, sessao = null, alvoId = null, quadroId = null;
  let estadoAtual = 'desligado', estragado = false, ocupado = false, encerrado = false, fechando = false;
  let atual = null;              // {url, titulo, site} da página aberta
  let ultimaExtracao = null;     // os links da última extração (seguir_link)
  let ultimoUso = Date.now();
  let stderrFim = [];
  let conferirIp = _conferirIp;  // null = decide pelo proxy do Windows na partida
  let modoPrevia = false;
  const nossos = new Set();      // abas que nós abrimos (a principal e a da prévia)
  const contextos = new Set();   // contextos isolados da prévia
  const diag = { bloqueios: [], downloads: 0, janelasFechadas: 0, liberados: 0 };
  const logados = new Set();     // "motivo host" já logado nesta página (uma página pode pedir 100 vezes)
  let ultimoBloqueioDoc = null;  // {motivo, host, em} o último documento (página ou quadro) barrado
  let respostaDoc = null;        // {loaderId, status, ip} a resposta do documento principal
  let ipLocalNaPagina = null;    // a página veio de um endereço local (DNS rebinding)
  let loaderAtual = null;
  const ouvintesPagina = new Set();

  // hosts liberados para abrir sem aprovação nesta partida (§6.4)
  const lembrados = new Map();   // host -> 'pesquisa' | 'aprovado' | 'link'
  const urlsVistas = new Set();  // endereços exatos (chaveUrl) vistos em links de página aberta e nos resultados da pesquisa
  // a página aberta pela ferramenta: para onde ela pode ir sozinha (redirecionamento, script) sem a aprovação "navegar".
  // {pedida: chaveUrl, base: dominioBase, ok(url) → bool}; null = sem regra (formulário aprovado, teste direto)
  let politica = null;

  let fila = Promise.resolve();
  const emSerie = (fn) => { const p = fila.then(fn, fn); fila = p.catch(() => {}); return p; };

  const dizer = (m) => { try { log(m); } catch (_) { /* nada */ } };
  function guardarStderr(d) {
    for (const l of String(d).split(/\r?\n/)) if (l.trim() && !RUIDO_STDERR.test(l)) stderrFim.push(l.slice(0, 200));
    if (stderrFim.length > 20) stderrFim = stderrFim.slice(-20);
  }

  /* ---------- a regra de rede (cada Fetch.requestPaused) ---------- */
  async function motivoRede(urlTexto) {
    let u;
    try { u = new URL(urlTexto); } catch (_) { return { motivo: 'url', host: '?' }; }
    if (u.protocol === 'file:') {
      if (!modoPrevia || !projetos) return { motivo: 'arquivo', host: 'file' };
      let p;
      try { p = fileURLToPath(u); } catch (_) { return { motivo: 'arquivo', host: 'file' }; }
      if (p.startsWith('\\\\') || !dentroDe(projetos, p)) return { motivo: 'arquivo-fora', host: 'file' };
      try { if (!dentroDe(await fsp.realpath(projetos), await fsp.realpath(p))) return { motivo: 'arquivo-fora', host: 'file' }; }
      catch (_) { /* arquivo que não existe: o Chrome dá 404 sozinho */ }
      return null;
    }
    const esquema = u.protocol.replace(/:$/, '');
    if (!['http', 'https', 'ws', 'wss'].includes(esquema)) return { motivo: 'esquema', host: esquema };
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (u.username || u.password) return { motivo: 'credencial-na-url', host, origem: u.origin };
    if (origensRede.has(u.origin)) return null;
    if (modoPrevia && !(esquema === 'https' && CDN_PREVIA.has(host))) return { motivo: 'previa-fora-cdn', host, origem: u.origin };
    const m = await hostBloqueado(host);
    return m ? { motivo: m, host, origem: u.origin } : null;
  }
  /** Por que este endereço não abre de jeito nenhum (rede local, nome de rede…), antes de qualquer aprovação. null = pode. */
  async function bloqueioDe(url) {
    let u;
    try { u = url instanceof URL ? url : new URL(String(url)); } catch (_) { return 'url'; }
    if (origensRede.has(u.origin)) return null;
    if (u.username || u.password) return 'credencial-na-url';
    return hostBloqueado(u.hostname.replace(/^\[|\]$/g, ''));
  }
  /* A página principal indo para outro site (redirecionamento do servidor, script, meta refresh): o destino passa pela
     mesma regra do §6.4 que o endereço pedido (politica.ok). O mesmo site (www, outro subdomínio, http → https) passa.
     Não passou → o pedido falha e a ferramenta oferece a aprovação "navegar" do destino (o endereço que o site montou
     pode levar um dado saindo). */
  function destinoBarrado(request, resourceType, frameId) {
    // o Fetch é do navegador inteiro (o evento vem sem sessão): a aba principal é a do quadro principal (quadroId)
    if (!politica || resourceType !== 'Document' || !quadroId || frameId !== quadroId || !request) return null;
    let u;
    try { u = new URL(request.url); } catch (_) { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (chaveUrl(u) === politica.pedida || dominioBase(u.hostname) === politica.base) return null;
    let ok = false;
    try { ok = !!politica.ok(u); } catch (_) { ok = false; }
    return ok ? null : { motivo: 'destino-nao-liberado', host: u.hostname.toLowerCase(), origem: u.origin, url: u.href };
  }
  async function aoPedido(o) {
    const { requestId, request, resourceType, frameId } = o.params || {};
    const op = o.sessionId ? { sessao: o.sessionId } : {};
    let r;
    try { r = await motivoRede(request && request.url); } catch (_) { r = { motivo: 'erro', host: '?' }; }
    if (!r) r = destinoBarrado(request, resourceType, frameId);
    if (!cdp || cdp.fechado) return;
    if (r) {
      diag.bloqueios.push({ motivo: r.motivo, host: r.host });
      if (diag.bloqueios.length > 200) diag.bloqueios.shift();
      if (resourceType === 'Document') ultimoBloqueioDoc = { ...r, frameId, em: Date.now() };
      const k = `${r.motivo} ${r.host}`;
      if (!logados.has(k) && logados.size < 50) { logados.add(k); dizer(`navegador: bloqueei ${r.motivo} ${r.host}`); }
      cdp.enviar('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, op).catch(() => {});
    } else {
      diag.liberados++;
      cdp.enviar('Fetch.continueRequest', { requestId }, op).catch(() => {});
    }
  }

  /* ---------- eventos do Chrome ---------- */
  function aoCdp(o) {
    const m = o.method;
    if (m === 'Fetch.requestPaused') { aoPedido(o); return; }
    if (m === 'Target.targetCreated') {
      const ti = o.params && o.params.targetInfo;
      if (!ti || ti.type !== 'page' || nossos.has(ti.targetId)) return;
      // janela nova da página (window.open, target=_blank): fecha. O targetCreated da nossa aba chega ANTES da resposta
      // do createTarget (medido): sem openerId, espera meio segundo para ver se é nossa
      const fecharSeEstranha = () => {
        if (nossos.has(ti.targetId) || !cdp || cdp.fechado) return;
        diag.janelasFechadas++;
        dizer('navegador: fechei uma janela nova aberta pela página');
        cdp.enviar('Target.closeTarget', { targetId: ti.targetId }).catch(() => {});
      };
      if (ti.openerId) fecharSeEstranha(); else setTimeout(fecharSeEstranha, 500).unref?.();
      return;
    }
    if (m === 'Browser.downloadWillBegin') { diag.downloads++; dizer('navegador: recusei um download'); return; }
    if (m === 'Page.javascriptDialogOpening') {
      cdp.enviar('Page.handleJavaScriptDialog', { accept: false }, { sessao: o.sessionId }).catch(() => {});
      return;
    }
    if (m === 'Target.detachedFromTarget') {
      if (o.params && o.params.sessionId === sessao) { estragado = true; atual = null; }
      return;
    }
    if (o.sessionId === sessao && o.params) {
      if (m === 'Page.frameNavigated' && o.params.frame && !o.params.frame.parentId) loaderAtual = o.params.frame.loaderId;
      else if (m === 'Network.responseReceived' && o.params.type === 'Document' && o.params.frameId === quadroId) aoDocumento(o.params);
      else if (m === 'Inspector.targetCrashed') { estragado = true; atual = null; dizer('navegador: a página caiu'); }
    }
    for (const f of ouvintesPagina) { try { f(o); } catch (_) { /* nada */ } }
  }
  // a resposta do documento principal: o status, e de que endereço ela veio (DNS rebinding: o nome passou na nossa
  // conferência e depois apontou para a rede local)
  function aoDocumento(p) {
    const r = p.response || {};
    const ip = r.remoteIPAddress || null;
    respostaDoc = { loaderId: p.loaderId, status: r.status ?? null, ip };
    let u = null;
    try { u = new URL(r.url); } catch (_) { u = null; }
    if (!ip || !conferirIp || !ipPrivado(ip) || (origemTeste && u && u.origin === origemTeste)) return;
    ipLocalNaPagina = { host: u ? u.hostname : '?' };
    dizer(`navegador: a página de ${ipLocalNaPagina.host} veio de um endereço local; fechando`);
    cdp.enviar('Page.stopLoading', {}, { sessao }).catch(() => {});
    cdp.enviar('Page.navigate', { url: 'about:blank' }, { sessao }).catch(() => {});
  }

  /* ---------- Chrome: abrir e fechar ---------- */
  async function abrirFilho() {
    let f;
    stderrFim = [];
    try { f = spawn(exe, [...FLAGS, `--window-size=${largura},${altura}`, `--user-data-dir=${perfil}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], windowsHide: true }); }
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
    if (r.semResposta) await matarArvore(f.pid);
    return r;
  }
  async function partir() {
    if (!exe || !existe(exe)) exe = acharChrome({ forcar: true });
    if (!exe) { estadoAtual = 'desligado'; throw erro('site-sem-chrome'); }
    estadoAtual = 'abrindo';
    try { await fsp.mkdir(perfil, { recursive: true }); }
    catch (_) { estadoAtual = 'desligado'; throw erro('site-perfil'); }
    if (existe(path.join(perfil, 'lockfile'))) {
      // um Chrome velho com o nosso perfil (o Node anterior morreu e ele ficou): fecha antes
      const n = await matarPerfil(perfil);
      if (n) dizer(`navegador: fechei ${n} processo(s) do Chrome velho do navegador`);
      await esperar(800);
    }
    let r;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      r = await abrirFilho();
      if (r.ok) break;
      if (r.saiu === 21 && tentativa === 1) {
        dizer('navegador: o perfil já estava em uso (código 21); fechando o Chrome velho e tentando de novo');
        await matarPerfil(perfil); await esperar(1000);
        continue;
      }
      break;
    }
    if (!r.ok) {
      estadoAtual = 'caiu';
      dizer(`navegador: o Chrome não abriu (${r.saiu != null ? `código ${r.saiu}` : r.erro || 'sem resposta no pipe'})`);
      throw erro(r.erro === 'ENOENT' ? 'site-sem-chrome' : 'site-caiu');
    }
    filho = r.f; cdp = r.t; sessao = null; alvoId = null; estragado = false; atual = null;   // os links da última página ficam (seguir_link)
    nossos.clear(); contextos.clear();
    guardarVivo(filho);
    const este = filho;
    filho.on('exit', (c) => aoSairFilho(este, c));
    cdp.ouvir(aoCdp);
    try {
      if (encerrado) throw erro('site-caiu');
      if (conferirIp === null) {
        conferirIp = !(await proxyDoSistema());
        if (!conferirIp) dizer('navegador: o Windows usa proxy; a conferência do endereço da página fica desligada');
      }
      await cdp.enviar('Browser.setDownloadBehavior', { behavior: 'deny', eventsEnabled: true });
      await cdp.enviar('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });   // o navegador inteiro
      // a aba que o Chrome abriu é nossa ANTES de ligar o aviso de abas novas (o setDiscoverTargets anuncia as que já existem)
      const { targetInfos = [] } = await cdp.enviar('Target.getTargets');
      for (const x of targetInfos) if (x.type === 'page') nossos.add(x.targetId);
      const inicial = targetInfos.find((x) => x.type === 'page');
      await cdp.enviar('Target.setDiscoverTargets', { discover: true });
      await prepararAba(inicial ? inicial.targetId : null);
    } catch (e) {
      fechando = true;
      try { await fecharChrome(); } finally { fechando = false; }
      estadoAtual = 'caiu';
      dizer(`navegador: o Chrome abriu mas não ficou pronto (${codigoDe(e)}${e && e.cdp ? `: ${e.cdp}` : ''})`);
      throw e instanceof ErroFerramenta ? e : erro('site-caiu');
    }
    estadoAtual = 'pronto';
    dizer('navegador: Chrome escondido aberto');
  }
  async function prepararAba(inicial) {
    alvoId = inicial || (await cdp.enviar('Target.createTarget', { url: 'about:blank' })).targetId;
    nossos.add(alvoId);
    const { sessionId } = await cdp.enviar('Target.attachToTarget', { targetId: alvoId, flatten: true });
    sessao = sessionId;
    const S = { sessao };
    await cdp.enviar('Page.enable', {}, S);
    // o quadro principal (o id dele é o da aba no Chrome de hoje; conferido para não depender disso)
    try { const ft = await cdp.enviar('Page.getFrameTree', {}, S); if (ft && ft.frameTree && ft.frameTree.frame) quadroId = ft.frameTree.frame.id; }
    catch (_) { quadroId = alvoId; }
    await cdp.enviar('Runtime.enable', {}, S);
    await cdp.enviar('Network.enable', { maxTotalBufferSize: 1_000_000, maxResourceBufferSize: 200_000 }, S);
    await cdp.enviar('Page.setLifecycleEventsEnabled', { enabled: true }, S);
    try { await cdp.enviar('Inspector.enable', {}, S); } catch (_) { /* só para o aviso de página caída */ }
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false }, S);
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
  function aoSairFilho(f, codigo) {
    if (f !== filho) return;
    filho = null; sessao = null; alvoId = null; atual = null;
    const t = cdp; cdp = null;
    if (t) t.fechar();
    if (fechando) { estadoAtual = 'desligado'; return; }
    estadoAtual = 'caiu';
    dizer(`navegador: o Chrome escondido saiu sozinho (código ${codigo == null ? '?' : codigo > 0x7fffffff ? codigo - 0x100000000 : codigo})`);
    for (const l of stderrFim.slice(-5)) dizer(`  chrome: ${l}`);
  }
  // Chrome pronto para a próxima operação: abre, ou abre de novo se a aba caiu ou um comando passou do prazo
  async function garantir() {
    if (encerrado) throw erro('site-caiu');
    if (filho && cdp && !cdp.fechado && sessao && !estragado) return;
    if (filho) {
      dizer('navegador: refazendo o Chrome escondido');
      fechando = true;
      try { await fecharChrome(); } finally { fechando = false; }
    }
    await partir();
  }
  // um comando de página que passou do prazo deixa a aba num estado desconhecido: a próxima operação refaz o Chrome
  async function pagina(method, params = {}, prazo = 15000) {
    try { return await cdp.enviar(method, params, { sessao, prazo }); }
    catch (e) { if (e && e.prazo) estragado = true; throw e; }
  }
  async function mundoIsolado(frameId = quadroId) {
    const { executionContextId } = await pagina('Page.createIsolatedWorld', { frameId, worldName: 'jarvis', grantUniveralAccess: false });
    return executionContextId;
  }
  async function noMundoIsolado(fn, arg, { prazo = 10000, gesto = false } = {}) {
    const contextId = await mundoIsolado();
    const r = await pagina('Runtime.evaluate', {
      expression: `(${fn.toString()})(${JSON.stringify(arg)})`, contextId, returnByValue: true, awaitPromise: true,
      userGesture: gesto, timeout: prazo,
    }, prazo + 3000);
    if (r.exceptionDetails) { const e = erro('site-caiu'); e.cdp = 'exceção na página'; throw e; }
    return r.result ? r.result.value : undefined;
  }

  /* ---------- esperar a carga (§6.2): load + networkIdle, ou load + 1,5 s; com o DOM pronto no prazo, segue em parte ---------- */
  function esperarCarga(prazoMs, signal) {
    return new Promise((res) => {
      let dom = false, load = false, tIdle = null, fim = false;
      const acabar = (como) => {
        if (fim) return;
        fim = true;
        clearTimeout(tPrazo); clearTimeout(tIdle);
        ouvintesPagina.delete(f);
        signal?.removeEventListener('abort', ab);
        res(como);
      };
      const f = (o) => {
        if (o.sessionId !== sessao || o.method !== 'Page.lifecycleEvent') return;
        const p = o.params || {};
        // só a página nova: o frameNavigated (a troca de página) chega antes dos eventos de carga dela
        if (p.frameId !== quadroId || !loaderAtual || p.loaderId !== loaderAtual) return;
        if (p.name === 'DOMContentLoaded') dom = true;
        else if (p.name === 'load') { load = true; dom = true; tIdle = setTimeout(() => acabar('load'), 1500); }
        else if (p.name === 'networkIdle' && load) acabar('completo');
      };
      const ab = () => acabar('cancelado');
      const tPrazo = setTimeout(() => acabar(load ? 'load' : dom ? 'parcial' : 'prazo'), prazoMs);
      ouvintesPagina.add(f);
      signal?.addEventListener('abort', ab, { once: true });
    });
  }
  function semPagina() { atual = null; ultimaExtracao = null; }
  function erroRedirecionou(b) {
    const e = erro('site-redirecionou', `O site quis me levar para ${semWww(String(b.host || 'outro site'))}, que você não citou. Não abri sem a sua aprovação.`);
    e.destino = b.url;
    return e;
  }

  /* ---------- operações (sempre dentro da fila, pelo sessao()) ---------- */
  /**
   * destinoOk(url) → bool: a regra do §6.4 para onde a página pode ir sozinha (redirecionamento, script). Sem ela, só a
   * rede local é barrada (o formulário aprovado, o teste direto). O destino barrado vira o erro site-redirecionou, com
   * e.destino (o endereço), para a ferramenta oferecer a aprovação "navegar".
   */
  async function abrir(url, { prazoMs = 25000, signal, destinoOk = null } = {}) {
    const u = url instanceof URL ? url : normalizarUrl(url);
    if (signal?.aborted) throw signal.reason ?? erro('site-prazo');
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!origensRede.has(u.origin)) {
      const m = await hostBloqueado(host);
      if (m === 'sem-dns') throw erro('site-fora-do-ar');
      if (m) { dizer(`navegador: recusei abrir ${m} ${host}`); throw erro('site-bloqueado'); }
    }
    politica = typeof destinoOk === 'function' ? { pedida: chaveUrl(u), base: dominioBase(host), ok: destinoOk } : null;
    semPagina();
    logados.clear();
    ultimoBloqueioDoc = null; respostaDoc = null; ipLocalNaPagina = null; loaderAtual = null;
    const t0 = Date.now();
    const carga = esperarCarga(prazoMs, signal);
    const nav = await pagina('Page.navigate', { url: u.href }, prazoMs + 5000);
    if (nav.isDownload) { await pagina('Page.navigate', { url: 'about:blank' }).catch(() => {}); throw erro('site-download'); }
    if (nav.errorText) {
      if (/BLOCKED_BY_CLIENT/.test(nav.errorText) && ultimoBloqueioDoc) {
        if (ultimoBloqueioDoc.motivo === 'destino-nao-liberado') throw erroRedirecionou(ultimoBloqueioDoc);
        if (ultimoBloqueioDoc.motivo === 'sem-dns') throw erro('site-fora-do-ar');
        throw erro('site-bloqueado', ultimoBloqueioDoc.origem && ultimoBloqueioDoc.origem !== u.origin ? 'O site tentou me levar para a rede da Lube ou para este computador. Parei: o navegador do Jarvis não entra lá.' : TEXTOS['site-bloqueado']);
      }
      if (/ABORTED/.test(nav.errorText) && signal?.aborted) throw signal.reason ?? erro('site-prazo');
      dizer(`navegador: ${host} não abriu (${String(nav.errorText).replace(/[^\w:.-]/g, '').slice(0, 60)})`);
      throw erro('site-fora-do-ar');
    }
    if (!loaderAtual) loaderAtual = nav.loaderId || null;
    const como = nav.loaderId ? await carga : 'completo';   // sem loaderId: só mudou o # (a mesma página)
    if (como === 'cancelado') { await pagina('Page.stopLoading').catch(() => {}); throw signal?.reason ?? erro('site-prazo'); }
    if (ipLocalNaPagina) { semPagina(); throw erro('site-bloqueado', 'Esse site me mandou para um endereço da rede local. Parei: o navegador do Jarvis não entra lá.'); }
    if (como === 'prazo') {
      await pagina('Page.stopLoading').catch(() => {});
      throw erro('site-prazo', `O site demorou demais para abrir (mais de ${Math.round(prazoMs / 1000)} s).`);
    }
    if (como === 'parcial') await pagina('Page.stopLoading').catch(() => {});
    const info = await noMundoIsolado(() => ({ titulo: document.title, url: location.href }), null, { prazo: 5000 });
    let site = host;
    try { site = new URL(info.url).hostname.replace(/^www\./, ''); } catch (_) { /* fica o pedido */ }
    if (/^chrome-error:/.test(String(info.url))) {
      semPagina();
      // um script ou meta refresh da página tentou ir para outro site (barrado na regra): a aprovação "navegar" do destino
      if (ultimoBloqueioDoc && ultimoBloqueioDoc.motivo === 'destino-nao-liberado' && Date.now() - ultimoBloqueioDoc.em < 60000) throw erroRedirecionou(ultimoBloqueioDoc);
      throw erro('site-fora-do-ar');
    }
    atual = { url: info.url, titulo: String(info.titulo || '').slice(0, 200), site, pedida: u.href };
    return { url: atual.url, titulo: atual.titulo, site, ms: Date.now() - t0, status: respostaDoc ? respostaDoc.status : null, ...(como === 'parcial' ? { parcial: true } : {}) };
  }
  function exigirPagina() { if (!atual) throw erro('site-sem-pagina'); }

  async function extrair({ maxTexto = 20000 } = {}) {
    exigirPagina();
    const d = await noMundoIsolado(extrairNaPagina, { maxTexto: Math.max(500, Math.min(100000, maxTexto)), prazoMs: 4000 }, { prazo: 8000 });
    if (!d || typeof d !== 'object') throw erro('site-caiu');
    const site = (() => { try { return new URL(d.url).hostname.replace(/^www\./, ''); } catch (_) { return atual.site; } })();
    const links = (Array.isArray(d.links) ? d.links : []).slice(0, 40).map((l, i) => ({ n: i + 1, texto: String(l.texto), url: String(l.url) }));
    const ext = {
      site, url: d.url, titulo: d.titulo, descricao: d.descricao || '', titulos: Array.isArray(d.titulos) ? d.titulos.slice(0, 20) : [],
      texto: String(d.texto || ''), tabelas: Array.isArray(d.tabelas) ? d.tabelas.slice(0, 3) : [], links, idioma: d.idioma || '', cortado: !!d.cortado,
    };
    // os links (seguir_link) e a página inteira (o abrir_site logo depois da aprovação "navegar" usa sem abrir de novo).
    // Ficam até a próxima página, mesmo com o Chrome fechado por falta de uso
    ultimaExtracao = { url: d.url, pedida: atual && atual.pedida, links, ext, em: Date.now() };
    return ext;
  }

  async function print({ inteira = false, formato = 'png', qualidade, larguraMax } = {}) {
    exigirPagina();
    const m = await pagina('Page.getLayoutMetrics');
    const vv = m.cssVisualViewport || m.visualViewport || { pageX: 0, pageY: 0, clientWidth: largura, clientHeight: altura };
    let w, h, x = 0, y = 0;
    if (inteira) {
      const cs = m.cssContentSize || m.contentSize || { width: largura, height: altura };
      w = Math.max(1, Math.min(Math.ceil(cs.width), largura * 2));
      h = Math.max(1, Math.min(Math.ceil(cs.height), ALTURA_MAX));
    } else {
      w = Math.max(1, Math.round(vv.clientWidth)); h = Math.max(1, Math.round(vv.clientHeight));
      x = vv.pageX || 0; y = vv.pageY || 0;
    }
    const escala = larguraMax && Math.max(w, h) > larguraMax ? larguraMax / Math.max(w, h) : 1;
    const tirar = async (fmt, q) => {
      const p = { format: fmt, clip: { x, y, width: w, height: h, scale: escala }, captureBeyondViewport: !!inteira };
      if (fmt === 'jpeg') p.quality = q ?? 80;
      const { data } = await pagina('Page.captureScreenshot', p, 45000);
      return Buffer.from(data, 'base64');
    };
    let fmt = formato === 'jpeg' ? 'jpeg' : 'png';
    let buf = await tirar(fmt, qualidade);
    if (fmt === 'png' && buf.length > PNG_MAX) { fmt = 'jpeg'; buf = await tirar('jpeg', 80); }
    return { buf, largura: Math.round(w * escala), altura: Math.round(h * escala), formato: fmt };
  }

  async function miniatura({ largura: lm = 640 } = {}) {
    exigirPagina();
    const m = await pagina('Page.getLayoutMetrics');
    const vv = m.cssVisualViewport || m.visualViewport || { pageX: 0, pageY: 0, clientWidth: largura, clientHeight: altura };
    const w = Math.max(1, Math.round(vv.clientWidth)), h = Math.max(1, Math.round(vv.clientHeight));
    const escala = Math.min(1, lm / w);
    for (const q of [60, 45, 30]) {
      const { data } = await pagina('Page.captureScreenshot', { format: 'jpeg', quality: q, clip: { x: vv.pageX || 0, y: vv.pageY || 0, width: w, height: h, scale: escala } }, 30000);
      if (data.length * 0.75 <= MINI_MAX || q === 30) return `data:image/jpeg;base64,${data}`;
    }
    return null;
  }

  async function conferirFormulario(campos, { botao } = {}) {
    exigirPagina();
    const r = await noMundoIsolado(formularioNaPagina, { campos, botao: botao || null, preencher: false });
    if (!r || r.erro) throw erroFormulario(r);
    return { ...r, site: atual.site };
  }
  async function preencher(campos, { botao, url, prazoMs = 20000 } = {}) {
    exigirPagina();
    if (url && atual.url.split('#')[0] !== String(url).split('#')[0]) throw erro('formulario-mudou');
    politica = null;   // o Júlio aprovou o envio, com o destino no cartão: a página de resposta pode ser de outro site
    let navegou = false;
    const NAVEGANDO = new Set(['Page.frameRequestedNavigation', 'Page.frameStartedLoading', 'Page.frameStartedNavigating']);
    const f = (o) => { if (o.sessionId === sessao && NAVEGANDO.has(o.method) && o.params && o.params.frameId === quadroId) navegou = true; };
    ouvintesPagina.add(f);
    let r;
    try {
      loaderAtual = null; respostaDoc = null; ultimoBloqueioDoc = null; ipLocalNaPagina = null;
      logados.clear();
      const carga = esperarCarga(prazoMs);
      r = await noMundoIsolado(formularioNaPagina, { campos, botao: botao || null, preencher: true, url: url || atual.url }, { gesto: true });
      if (!r || r.erro) throw erroFormulario(r);
      // o envio pode trocar a página (formulário comum) ou não (formulário que manda por trás): espera um pouco para ver
      for (let i = 0; i < 15 && !navegou && !loaderAtual; i++) await esperar(100);
      if (loaderAtual) await carga;
      else await esperar(navegou ? 2500 : 1200);
    } finally { ouvintesPagina.delete(f); }
    if (ipLocalNaPagina) { semPagina(); throw erro('site-bloqueado'); }
    if (ultimoBloqueioDoc && ultimoBloqueioDoc.frameId === quadroId) {
      semPagina();
      throw erro('site-bloqueado', 'O formulário mandaria os dados para a rede da Lube ou para este computador. Parei antes: nada saiu.');
    }
    const info = await noMundoIsolado(() => ({ titulo: document.title, url: location.href }), null, { prazo: 5000 });
    if (/^chrome-error:/.test(String(info.url))) { semPagina(); throw erro('site-fora-do-ar', 'Mandei o formulário, mas a página de resposta não abriu.'); }
    let site = atual ? atual.site : '';
    try { site = new URL(info.url).hostname.replace(/^www\./, ''); } catch (_) { /* fica */ }
    atual = { url: info.url, titulo: String(info.titulo || '').slice(0, 200), site };
    ultimaExtracao = null;
    return { url: atual.url, titulo: atual.titulo, site, preenchidos: r.preenchidos };
  }
  function erroFormulario(r) {
    const c = r && r.erro ? r.erro : 'formulario-campo';
    if (c === 'formulario-campo' && r && r.campo) return erro(c, r.repetido ? `Dois campos pedidos caíram no mesmo lugar ("${r.campo}"). Use os nomes que aparecem na tela.` : r.travado ? `O campo "${r.campo}" está travado na página.` : r.tipo ? `O campo "${r.campo}" é de um tipo que eu não preencho (${r.tipo}).` : `Não achei o campo "${r.campo}" no formulário da página. Use o nome que aparece na tela.`);
    if (c === 'formulario-valor' && r) return erro(c, r.opcoes ? `O campo "${r.campo}" é uma lista; as opções são: ${r.opcoes.join(', ')}.` : r.marcar ? `O campo "${r.campo}" é de marcar: use "sim" ou "não".` : r.data ? `O campo "${r.campo}" é uma data: use DD/MM/AAAA.` : TEXTOS[c]);
    if (c === 'formulario-botao' && r && r.botoes && r.botoes.length) return erro(c, `Não achei esse botão. Os botões da página: ${r.botoes.join(', ')}.`);
    return erro(c);
  }

  /* A prévia do construtor (C): um arquivo de JARVIS\Projetos aberto por file:// num contexto isolado, sem WebSocket e
     só com biblioteca dos CDNs liberados; devolve o print em JPEG e os erros de console. */
  async function printArquivo(abs, { largura: lp = 1280, altura: ap = 800, esperaMs = 1200, prazoMs = 20000 } = {}) {
    if (!projetos) throw erro('previa-fora', 'A prévia não está ligada (falta a pasta Projetos do Jarvis).');
    const alvo = path.resolve(String(abs || ''));
    if (!/\.html?$/i.test(alvo) || alvo.startsWith('\\\\') || !dentroDe(projetos, alvo)) throw erro('previa-fora');
    try {
      const [rr, ra] = await Promise.all([fsp.realpath(projetos), fsp.realpath(alvo)]);
      if (!dentroDe(rr, ra)) throw erro('previa-fora');
    } catch (e) { if (e instanceof ErroFerramenta) throw e; throw erro('previa-fora', 'Não achei esse arquivo na pasta do projeto.'); }
    let ctxId = null, tid = null, s = null;
    const erros = [];
    const f = (o) => {
      if (!s || o.sessionId !== s) return;
      if (o.method === 'Runtime.exceptionThrown') {
        const d = o.params.exceptionDetails || {};
        erros.push(`exceção: ${String((d.exception && d.exception.description) || d.text || '').split('\n')[0].slice(0, 200)}`);
      } else if (o.method === 'Runtime.consoleAPICalled' && (o.params.type === 'error' || o.params.type === 'assert')) {
        erros.push(`console: ${(o.params.args || []).map((a) => (a.value !== undefined ? String(a.value) : a.description || '')).join(' ').slice(0, 200)}`);
      } else if (o.method === 'Log.entryAdded' && o.params.entry && o.params.entry.level === 'error') {
        erros.push(`rede: ${String(o.params.entry.text || '').slice(0, 160)}`);
      }
    };
    ouvintesPagina.add(f);
    modoPrevia = true;
    try {
      ({ browserContextId: ctxId } = await cdp.enviar('Target.createBrowserContext', { disposeOnDetach: true }));
      contextos.add(ctxId);
      await cdp.enviar('Browser.setDownloadBehavior', { behavior: 'deny', browserContextId: ctxId }).catch(() => {});
      ({ targetId: tid } = await cdp.enviar('Target.createTarget', { url: 'about:blank', browserContextId: ctxId }));
      nossos.add(tid);
      ({ sessionId: s } = await cdp.enviar('Target.attachToTarget', { targetId: tid, flatten: true }));
      const S = { sessao: s };
      await cdp.enviar('Page.enable', {}, S);
      let quadroPrevia = tid;
      try { const ft = await cdp.enviar('Page.getFrameTree', {}, S); quadroPrevia = ft.frameTree.frame.id; } catch (_) { /* fica o da aba */ }
      await cdp.enviar('Runtime.enable', {}, S);
      await cdp.enviar('Log.enable', {}, S).catch(() => {});
      await cdp.enviar('Page.setLifecycleEventsEnabled', { enabled: true }, S);
      await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: lp, height: ap, deviceScaleFactor: 1, mobile: false }, S);
      await cdp.enviar('Page.addScriptToEvaluateOnNewDocument', { source: SEM_CONEXAO, runImmediately: true }, S);
      const carregou = new Promise((res) => {
        let load = false;
        const t = setTimeout(() => { ouvintesPagina.delete(g); res(load ? 'load' : 'prazo'); }, prazoMs);
        const g = (o) => {
          if (o.sessionId !== s || o.method !== 'Page.lifecycleEvent' || o.params.frameId !== quadroPrevia) return;
          if (o.params.name === 'load') load = true;
          if (load && o.params.name === 'networkIdle') { clearTimeout(t); ouvintesPagina.delete(g); res('completo'); }
        };
        ouvintesPagina.add(g);
      });
      const nav = await cdp.enviar('Page.navigate', { url: pathToFileURL(alvo).href }, { sessao: s, prazo: prazoMs });
      if (nav.errorText) throw erro('previa-fora', 'A prévia não abriu (o arquivo não carregou).');
      const como = await carregou;
      if (como === 'prazo') erros.push('a página demorou mais de 20 s para carregar');
      await esperar(Math.max(0, Math.min(10000, esperaMs)));   // a animação dos gráficos
      const { data } = await cdp.enviar('Page.captureScreenshot', { format: 'jpeg', quality: 75 }, { sessao: s, prazo: 30000 });
      return { buf: Buffer.from(data, 'base64'), erros: erros.slice(0, 20), largura: lp, altura: ap };
    } finally {
      ouvintesPagina.delete(f);
      if (tid) { await cdp.enviar('Target.closeTarget', { targetId: tid }).catch(() => {}); nossos.delete(tid); }
      if (ctxId) { await cdp.enviar('Target.disposeBrowserContext', { browserContextId: ctxId }).catch(() => {}); contextos.delete(ctxId); }
      modoPrevia = false;
    }
  }

  const interno = { abrir, extrair, print, miniatura, conferirFormulario, preencher, printArquivo };

  /** Roda fn(interno) sozinha na fila, com o Chrome pronto. Dentro de fn, use só o objeto recebido (não a api: travaria a fila). */
  function sessaoFila(fn) {
    return emSerie(async () => {
      ultimoUso = Date.now();
      ocupado = true;
      try {
        await garantir();
        estadoAtual = 'ocupado';
        return await fn(interno);
      } finally {
        ocupado = false;
        ultimoUso = Date.now();
        if (filho && estadoAtual === 'ocupado') estadoAtual = 'pronto';
      }
    });
  }

  /* ---------- política de endereço (§6.4) ---------- */
  /* Hosts que a pesquisa trouxe ou que apareceram num link de página: só os ENDEREÇOS EXATOS que foram vistos abrem sem
     aprovação (o modelo não monta endereço novo nesses sites: um caminho ou um "?" diferente poderia levar um dado
     saindo). Host aprovado pelo Júlio (a ação navegar) e host que ele citou valem inteiros. */
  function lembrarHosts(urls, { origem = 'pesquisa' } = {}) {
    for (const x of Array.isArray(urls) ? urls : [urls]) {
      let u;
      try { u = new URL(String(x)); } catch (_) { continue; }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      const h = semWww(u.hostname.toLowerCase());
      if (origem === 'aprovado') { lembrados.set(h, 'aprovado'); continue; }
      urlsVistas.add(chaveUrl(u));
      if (urlsVistas.size > 800) urlsVistas.delete(urlsVistas.values().next().value);
      if (!lembrados.has(h)) lembrados.set(h, origem === 'link' ? 'link' : 'pesquisa');
      else if (origem !== 'link' && lembrados.get(h) === 'link') lembrados.set(h, 'pesquisa');
      if (lembrados.size > 400) lembrados.delete(lembrados.keys().next().value);
    }
  }
  function liberarHost(host) { const h = hostCanonico(host); if (h) lembrados.set(semWww(h), 'aprovado'); }
  function porqueLiberado(host, conversa) {
    const h = semWww(hostCanonico(host) || '');
    if (!h) return null;
    if (SEMPRE_LIBERADOS.test(h)) return 'sempre';
    for (const d of sitesCitados(conversa)) if (casaDominio(h, d)) return 'citado';
    for (const [d, o] of lembrados) if (o === 'aprovado' && casaDominio(h, d)) return 'aprovado';
    const o = lembrados.get(h);
    return o === 'pesquisa' || o === 'link' ? o : null;
  }
  /** O host pode abrir sem aprovação? (citado pelo Júlio, aprovado, gov.br ou lube.com.br; visto na pesquisa ou num link
   *  de página: só o endereço exato, conferido no urlLiberada) */
  function hostLiberado(host, conversa) { return !!porqueLiberado(host, conversa); }
  /**
   * A regra inteira do §6.4 para um endereço que o MODELO escreveu: {ok: true} ou {ok: false, porque: [texto]}.
   * Host visto só na pesquisa ou num link de página: só o endereço exato que apareceu lá.
   */
  function urlLiberada(url, conversa) {
    const u = url instanceof URL ? url : normalizarUrl(url);
    const porque = [];
    const testePorta = origemTeste && u.origin === origemTeste;
    if (!PORTAS_LIBERADAS.has(u.port) && !testePorta) porque.push('O endereço usa uma porta fora do comum.');
    if (u.href.length > 500) porque.push('O endereço é longo demais.');
    if (u.search.length > 301) porque.push('O endereço leva um texto longo depois do "?".');
    let dec = `${u.pathname}${u.search}`;
    try { dec = decodeURIComponent(dec); } catch (_) { /* fica o bruto */ }
    if (RX_EMBRULHO.test(`${u.pathname}${u.search}`) || RX_EMBRULHO.test(dec)) porque.push('O endereço leva um trecho codificado (pode ser um dado saindo).');
    const como = porqueLiberado(u.hostname, conversa);
    if (!como) porque.unshift('Você não citou este site nesta conversa.');
    else if ((como === 'link' || como === 'pesquisa') && !urlsVistas.has(chaveUrl(u))) porque.unshift('Você não citou este site, e esse endereço não é o que apareceu na pesquisa ou na página.');
    return porque.length ? { ok: false, porque } : { ok: true, como };
  }
  /** O endereço do link N da última página lida (vale mesmo com o Chrome fechado por falta de uso). */
  function linkNumero(n) {
    if (!ultimaExtracao) return null;
    const l = ultimaExtracao.links.find((x) => x.n === n);
    return l ? l.url : null;
  }
  /** A extração da última página, se ela é a deste endereço e foi lida há até maxMs (sem abrir de novo). */
  function paginaRecente(url, maxMs = 120000) {
    if (!ultimaExtracao || !ultimaExtracao.ext || Date.now() - ultimaExtracao.em > maxMs) return null;
    const k = chaveUrl(url);
    return k && (k === chaveUrl(ultimaExtracao.url) || k === chaveUrl(ultimaExtracao.pedida || '')) ? { ext: ultimaExtracao.ext, em: ultimaExtracao.em } : null;
  }

  /* ---------- desligar e vigia ---------- */
  async function desligar({ final = false } = {}) {
    if (final) { encerrado = true; clearInterval(tVigia); }
    const tinha = !!filho;
    fechando = true;
    try { await fecharChrome(); } finally { fechando = false; }
    // fechar por falta de uso não esquece os links da última página: "abre o link 3" reabre o Chrome no endereço guardado
    filho = null; cdp = null; sessao = null; alvoId = null; atual = null;
    if (final) { semPagina(); politica = null; }
    estadoAtual = 'desligado';
    if (tinha) dizer('navegador: Chrome escondido fechado');
  }
  const tVigia = setInterval(() => {
    if (filho && !ocupado && Date.now() - ultimoUso >= ociosoMs) {
      dizer('navegador: sem uso; fechando o Chrome escondido');
      emSerie(() => (filho && !ocupado && Date.now() - ultimoUso >= ociosoMs ? desligar() : null)).catch(() => {});
    }
  }, Math.max(500, Math.min(15000, Math.floor(ociosoMs / 2))));
  tVigia.unref?.();

  return {
    abrir: (url, op) => sessaoFila((n) => n.abrir(url, op)),
    extrair: (op) => sessaoFila((n) => n.extrair(op)),
    print: (op) => sessaoFila((n) => n.print(op)),
    miniatura: (op) => sessaoFila((n) => n.miniatura(op)),
    conferirFormulario: (campos, op) => sessaoFila((n) => n.conferirFormulario(campos, op)),
    preencher: (campos, op) => sessaoFila((n) => n.preencher(campos, op)),
    printArquivo: (abs, op) => sessaoFila((n) => n.printArquivo(abs, op)),
    sessao: sessaoFila,
    lembrarHosts, liberarHost, hostLiberado, urlLiberada, linkNumero, paginaRecente, bloqueioDe,
    estado: () => ({
      estado: estadoAtual, ...(atual ? { url: atual.url, titulo: atual.titulo, site: atual.site } : {}),
      ...(!exe ? { sem_chrome: true } : {}),   // sem acharChrome() aqui: ele lê o registro sem esperar (travaria a rota)
    }),
    /** Só para o teste e o diagnóstico: contadores, sem endereço completo. */
    diagnostico: () => ({ ...diag, bloqueios: diag.bloqueios.slice(), pid: filho ? filho.pid : null, conferirIp }),
    desligar,
    // só o teste (com permitirTeste): roda um JavaScript NA PÁGINA, com gesto do usuário (janela nova, download, o
    // Local Network Access de uma página pública). O servidor de verdade nunca passa permitirTeste.
    ...(origemTeste ? {
      _avaliarTeste: (expr) => sessaoFila(async () => {
        exigirPagina();
        const r = await pagina('Runtime.evaluate', { expression: String(expr), awaitPromise: true, returnByValue: true, userGesture: true, timeout: 10000 }, 15000);
        return r.result ? r.result.value : undefined;
      }),
    } : {}),
  };
}
