/* Cérebro da Lube — servidor/ferramentas/pasta.js
   A pasta do Jarvis (OneDrive - Lube\JARVIS, com Anotações, Planilhas, Prints, Projetos e Arquivos): o ÚNICO lugar onde
   ele cria, muda, move, renomeia e apaga (decisão do Júlio, 2026-10-20). Ler continua como hoje (arquivos.js).
   - Criar é livre: anotar, criar pasta, criar arquivo de texto, copiar um arquivo de fora para dentro, abrir no Windows.
   - Mudar, mover, renomear e apagar viram AÇÃO PENDENTE (acoes.js): cartão na tela e aprovação por voz. A ferramenta só
     prepara; quem faz é o executar() da ação, que confere tudo de novo na hora.
   - Apagar vai SEMPRE para a Lixeira do Windows (PowerShell + Microsoft.VisualBasic.FileIO), nunca de vez. Antes, confere
     que a Lixeira daquele disco está ligada e cabe o item (senão o Windows apagaria de vez sem perguntar).
   - Todo caminho passa pela conferência (docs/JARVIS-ACOES.md §3): dentro da raiz também depois de resolver junção e
     atalho, sem caminho de rede, sem fluxo alternativo (arquivo:x), sem nome reservado do Windows.
   - Texto gravado passa pelo mascararSegredos: o Jarvis não guarda senha.
   - Página HTML (.html, .htm) não abre sozinha no navegador padrão do Júlio: lá ela roda com a sessão e a rede dele, sem
     as travas do navegador escondido. Abrir pelo abrir_no_windows vira a ação pendente "abrir" (aprovada por voz); o
     botão do cartão (clique do Júlio) abre direto. Todo .html que o Jarvis grava leva a TRAVA (travarHtml): uma CSP que
     não deixa a página falar com a rede (connect-src 'none', form-action 'none') e só carrega script, estilo e fonte do
     próprio arquivo e das CDNs liberadas. Mudar de página por código (location) a CSP não barra: por isso a aprovação.
   Contrato completo em docs/JARVIS-ACOES.md §5. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { criarAcao } from '../acoes.js';
import { conferirCaminho } from './arquivos.js';
import { mascararSegredos } from '../../web/js/bloqueio.js';
import { arquivoPessoal } from '../pessoal.js';
import { ErroFerramenta, cortar, quandoSP, log as logPadrao } from '../util.js';

export const SUBPASTAS = ['Anotações', 'Planilhas', 'Prints', 'Projetos', 'Arquivos'];

/* ---------- regras de nome e de extensão (§3) ---------- */
// o que o Jarvis cria fora de um projeto; dentro de Projetos\<nome> o construtor também cria css, js e svg
const CRIAVEIS = new Set(['md', 'txt', 'csv', 'json', 'html', 'xlsx', 'png', 'jpg']);
const CRIAVEIS_PROJETO = new Set([...CRIAVEIS, 'htm', 'css', 'js', 'svg']);
// abrir no Windows: só o que não executa (um app.js com dois cliques roda no Windows Script Host). html e htm só com o
// clique do Júlio ou a ação "abrir" aprovada (EXT_PAGINA)
const ABRIVEIS = new Set(['md', 'txt', 'csv', 'xlsx', 'docx', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'html', 'htm']);
export const EXT_PAGINA = new Set(['html', 'htm']);
// texto que alterar_texto muda
const ALTERAVEIS = new Set(['md', 'txt', 'csv', 'json', 'html', 'htm']);
// nunca entra na pasta (nem copiado de fora): executa com dois cliques ou monta um disco
const PERIGOSAS = new Set(['bat', 'cmd', 'ps1', 'psm1', 'psd1', 'ps1xml', 'vbs', 'vbe', 'js', 'jse', 'mjs', 'cjs', 'wsf', 'wsh', 'hta',
  'exe', 'com', 'scr', 'msi', 'msp', 'pif', 'reg', 'lnk', 'url', 'dll', 'cpl', 'msc', 'jar', 'appx', 'msix', 'appref-ms',
  'scf', 'inf', 'sys', 'gadget', 'application', 'iso', 'img', 'vhd', 'vhdx', 'library-ms', 'settingcontent-ms', 'xll', 'xlam']);
// extensões comuns: para saber se "relatorio.pdf" no renomear/mover é extensão ou parte do nome
const CONHECIDAS = new Set([...CRIAVEIS_PROJETO, ...ABRIVEIS, ...ALTERAVEIS, ...PERIGOSAS, 'doc', 'xls', 'xlsm', 'xlsb', 'ppt', 'pptx',
  'odt', 'ods', 'odp', 'rtf', 'zip', 'rar', '7z', 'gz', 'tar', 'gif', 'bmp', 'tif', 'tiff', 'ico', 'heic', 'mp4', 'mov', 'avi', 'mkv',
  'mp3', 'wav', 'ogg', 'm4a', 'xml', 'ini', 'cfg', 'log', 'tsv', 'eml', 'msg', 'ofx', 'sql', 'py', 'ts', 'yaml', 'yml', 'pbix']);
export const EXT_ABRIVEIS = ABRIVEIS;
const RX_PROIBIDO = /[\\/:*?"<>|]/;
const RX_INVISIVEL = /[\p{Cc}\p{Cf}]/u;          // controles e formatação invisível (U+202E e companhia)
const RX_RESERVADO = /^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])$/i;
const ESCONDIDOS = new Set(['desktop.ini', 'thumbs.db']);
const RX_TEMP = /^~jarvis-[A-Za-z0-9_-]+\.tmp$/;  // o arquivo temporário da gravação (o OneDrive não sincroniza *.tmp)
const MAX_CAMINHO = 240;                            // o Explorer e o Excel se perdem perto dos 260 do Windows
const MAX_ESCRITA = 60 * 1024 * 1024;
const MAX_COPIA = 200 * 1024 * 1024;
const MAX_ALTERAR = 1024 * 1024;
const MAX_APAGAR_ARQUIVOS = 2000;
const MAX_APAGAR_BYTES = 1024 * 1024 * 1024;

/* ---------- a trava das páginas HTML que o Jarvis grava ---------- */
// as CDNs das bibliotecas (as mesmas da conferência do construtor e da prévia do navegador escondido)
const CDNS = ['https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com'];
export const CSP_PAGINA = [
  "default-src 'none'",
  `script-src file: 'unsafe-inline' ${CDNS.join(' ')}`,
  `style-src file: 'unsafe-inline' ${CDNS.join(' ')} https://fonts.googleapis.com`,
  `font-src file: data: ${CDNS.join(' ')} https://fonts.gstatic.com`,
  'img-src file: data: blob:', 'media-src file: data: blob:',
  "connect-src 'none'", "form-action 'none'", "frame-src 'none'", "object-src 'none'", "worker-src 'none'", "base-uri 'none'",
].join('; ');
const META_TRAVA = `<meta http-equiv="Content-Security-Policy" content="${CSP_PAGINA}" data-jarvis="trava">`;
const RX_TRAVA_VELHA = /(\r?\n)?[ \t]*<meta\b[^>]*\bdata-jarvis\s*=\s*["']?trava["']?[^>]*>/gi;
/**
 * A página com a trava (a CSP do Jarvis) no começo do <head>, antes de qualquer script, estilo ou imagem. A trava velha
 * sai (vale a de agora). O charset vem antes dela: o navegador só procura o charset nos primeiros 1.024 bytes, e o
 * arquivo é sempre UTF-8 (o Jarvis e o construtor gravam assim).
 */
export function travarHtml(html) {
  let s = String(html ?? '');
  const bom = s.startsWith('﻿') ? '﻿' : '';
  if (bom) s = s.slice(1);
  // já tem a trava de agora, uma só, antes de qualquer script: fica como está
  const ja = s.indexOf(META_TRAVA), primeiroAtivo = s.search(/<(script|link|style|base|iframe|img|object|embed|svg|video|audio)\b/i);
  if (ja >= 0 && (s.match(RX_TRAVA_VELHA) || []).length === 1 && (primeiroAtivo < 0 || ja < primeiroAtivo)) return bom + s;
  s = s.replace(RX_TRAVA_VELHA, '');
  const ativo = /<(script|link|style|base|iframe|img|object|embed|svg|video|audio)\b/i.exec(s);
  const antes = (m) => !!m && (!ativo || m.index + m[0].length <= ativo.index);
  const charset = /<meta\b[^>]*\bcharset\s*=[^>]*>/i.exec(s);
  const cabeca = /<head(?:\s[^>]*)?>/i.exec(s);
  const doctype = /^\s*<!doctype[^>]*>/i.exec(s);
  let pos, junto;
  if (antes(charset)) { pos = charset.index + charset[0].length; junto = `\n${META_TRAVA}`; }
  else if (antes(cabeca)) { pos = cabeca.index + cabeca[0].length; junto = `\n<meta charset="utf-8">\n${META_TRAVA}`; }
  else if (antes(doctype)) { pos = doctype[0].length; junto = `\n<meta charset="utf-8">\n${META_TRAVA}`; }
  else { pos = 0; junto = `<meta charset="utf-8">\n${META_TRAVA}\n`; }
  return bom + s.slice(0, pos) + junto + s.slice(pos);
}

export const MSG = {
  'jarvis-fora': 'Isso fica fora da pasta do Jarvis. Lá eu só leio.',
  'jarvis-existe': 'Já existe um item com esse nome.',
  'jarvis-sumiu': 'Não achei esse item na pasta do Jarvis (ele pode ter sido movido ou apagado).',
  'jarvis-estrutura': 'Essa pasta é da estrutura do Jarvis e não sai do lugar.',
  'jarvis-extensao': 'Esse tipo de arquivo eu não crio nem abro: poderia executar alguma coisa.',
  'jarvis-lixeira': 'Não consegui mandar para a Lixeira. Nada foi apagado.',
  'jarvis-mudou': 'O arquivo mudou desde que preparei. Peça de novo.',
  'jarvis-disco': 'A pasta do Jarvis tem que ficar num disco deste computador (não na rede): lá a Lixeira funciona.',
  'jarvis-ocupado': 'O arquivo está aberto em outro programa (ou é só leitura). Feche e peça de novo.',
  'jarvis-sem-pasta': 'A pasta do Jarvis não está ligada neste computador agora.',
};
const erro = (codigo, mensagem) => new ErroFerramenta(mensagem || MSG[codigo] || 'Não deu para fazer isso na pasta do Jarvis.', codigo);

export const extDe = (nome) => { const n = path.basename(String(nome || '')).toLowerCase(); const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1) : ''; };
const kb = (bytes) => Math.max(1, Math.round(bytes / 1024));
const chave = (s) => String(s || '').normalize('NFC').toLowerCase();
function dentro(raiz, alvo) {
  const rel = path.relative(chave(raiz), chave(alvo));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Por que um pedaço de caminho não vale como nome no Windows (null = vale). */
export function motivoNome(nome) {
  const s = String(nome ?? '');
  if (!s.trim()) return 'Falta o nome.';
  if (RX_INVISIVEL.test(s)) return 'O nome tem caracteres invisíveis de controle.';
  if (RX_PROIBIDO.test(s)) return 'O Windows não aceita \\ / : * ? " < > | em nome de arquivo.';
  if (/[. ]$/.test(s)) return 'O Windows não aceita nome terminado em ponto ou espaço.';
  if (s === '.' || s === '..') return 'Nome inválido.';
  if (RX_RESERVADO.test(s.split('.')[0].trim())) return `"${s}" é um nome reservado do Windows.`;
  if (s.length > 200) return 'O nome é longo demais.';
  return null;
}

/** Texto livre → nome de arquivo que o Windows aceita (sem a extensão). "Reunião 14:55: compras" → "Reunião 14h55 — compras". */
export function nomeSeguro(texto, max = 80) {
  let s = String(texto ?? '').normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/(\d{1,2}):(\d{2})/g, '$1h$2')          // hora: o Windows recusa ":"
    .replace(/\s*:\s+/g, ' — ').replace(/:/g, '-')
    .replace(/[\\/|]/g, '-').replace(/"/g, "'").replace(/[*?<>]/g, '')
    .replace(/\s+/g, ' ').trim()
    .replace(/^[.\s]+/, '');
  const cortado = Array.from(s);
  if (cortado.length > max) s = cortado.slice(0, max).join('');
  s = s.replace(/[.\s]+$/, '');
  if (!s) s = 'sem nome';
  if (RX_RESERVADO.test(s.split('.')[0].trim())) s = s.replace(/^([^.]*)/, '$1_');
  return s;
}

/** A raiz padrão: JARVIS_PASTA (cfg.jarvisDir, ou o ambiente) ou <OneDrive - Lube>\JARVIS. */
export function pastaPadrao(cfg = {}) {
  if (cfg && cfg.jarvisDir) return path.resolve(cfg.jarvisDir);
  if (process.env.JARVIS_PASTA) return path.resolve(process.env.JARVIS_PASTA);
  const od = process.env.OneDriveCommercial;
  const oneDrive = od && fs.existsSync(od) ? od : path.join(os.homedir(), 'OneDrive - Lube');
  return path.join(oneDrive, 'JARVIS');
}

/* ---------- data e hora de Brasília para o nome do arquivo ---------- */
const fmtSP = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
/** {data: '2026-10-20', hora: '14h55', br: '20/10/2026', hm: '14:55'} */
export function agoraSP(d = new Date()) {
  const [data, hms] = fmtSP.format(d).split(' ');
  const [h, m] = hms.split(':');
  const [a, me, di] = data.split('-');
  return { data, hora: `${h}h${m}`, br: `${di}/${me}/${a}`, hm: `${h}:${m}` };
}

/* ---------- PowerShell (como o ouvido.js: caminho completo, -EncodedCommand, o alvo pelo ambiente) ---------- */
const SISTEMA = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
const POWERSHELL = path.join(SISTEMA, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
// o programa aberto pelo Windows (Excel, Explorer, navegador) herda o ambiente: nada que pareça credencial vai junto
const RX_ENV_SEGREDO = /(key|token|secret|senha|pass|pwd|cred|anthropic|claude|supabase|imap|smtp|cerebro)/i;
function ambiente(extra) {
  const e = {};
  for (const [k, v] of Object.entries(process.env)) if (!RX_ENV_SEGREDO.test(k)) e[k] = v;
  return { ...e, ...extra };
}
function powershell(script, env, prazo = 30000) {
  return new Promise((res) => {
    if (process.platform !== 'win32') { res({ ok: false, saida: '' }); return; }
    const corpo = `$ProgressPreference = 'SilentlyContinue'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${script}`;
    execFile(POWERSHELL, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(corpo, 'utf16le').toString('base64')],
      { windowsHide: true, timeout: prazo, env: ambiente(env), maxBuffer: 1024 * 1024 },
      (err, out) => res({ ok: !err, saida: String(out || ''), codigo: err?.code }));
  });
}

/* tipo do disco pela letra ('Fixed', 'Network', 'Removable'…; null = não deu para saber) */
async function tipoDiscoPadrao(letra) {
  if (process.platform !== 'win32') return 'Fixed';
  const r = await powershell('([System.IO.DriveInfo]::new($env:CEREBRO_DISCO)).DriveType.ToString()', { CEREBRO_DISCO: letra }, 15000);
  const t = r.saida.trim();
  return r.ok && /^[A-Za-z]+$/.test(t) ? t : null;
}

/* A Lixeira de verdade, com a LISTA inteira num PowerShell só (abrir um por item, cada um varrendo a Lixeira, levava
   até 10 s por item). Antes de apagar, uma vez: a Lixeira desse disco está ligada (NukeOnDelete, NoRecycleFiles) e cada
   item cabe nela (MaxCapacity, em MB; sem a configuração do volume, o padrão do Windows, ~5% do disco)? Com
   OnlyErrorDialogs o Windows não pergunta nada: o que não coubesse seria apagado DE VEZ. Depois, uma volta só na Lixeira
   (pasta especial 10; o Name vem sem extensão, por isso System.FileName, e a coluna 1 é a pasta de origem) confere todos.
   Para no primeiro que falhar (o resto fica onde está). Os itens vêm em JSON pelo ambiente (CEREBRO_ITENS: [{a: caminho,
   p: pasta?, t: bytes}]). Só saída ASCII (JSON pequeno): o PowerShell 5.1 estraga acento na saída. */
const PS_LIXEIRA = String.raw`
$ErrorActionPreference = 'Stop'
function Sai($o) { ConvertTo-Json -InputObject $o -Compress -Depth 4; exit 0 }
# o ConvertFrom-Json do PowerShell 5.1 solta a lista como UM objeto: o ForEach-Object abre ela item por item
$itens = @((ConvertFrom-Json -InputObject $env:CEREBRO_ITENS) | ForEach-Object { $_ })
if ($itens.Count -lt 1) { Sai @{ ok = $false; erro = 'vazio'; itens = @() } }
$limite = 0
try {
  $letra = ([string]$itens[0].a).Substring(0, 2)
  $di = [System.IO.DriveInfo]::new($letra.Substring(0, 1))
  if ($di.DriveType.ToString() -ne 'Fixed') { Sai @{ ok = $false; erro = 'disco'; itens = @() } }
  foreach ($k in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer')) {
    $p = Get-ItemProperty -LiteralPath $k -ErrorAction SilentlyContinue
    if ($p -and $p.NoRecycleFiles -eq 1) { Sai @{ ok = $false; erro = 'lixeira-desligada'; itens = @() } }
  }
  $limite = [double]$di.TotalSize * 0.05
  $vol = (Get-CimInstance Win32_Volume -Filter ("DriveLetter='" + $letra + "'") | Select-Object -First 1).DeviceID
  if ($vol -match '\{[0-9a-fA-F-]+\}') {
    $cfg = Get-ItemProperty -LiteralPath ('HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket\Volume\' + $Matches[0]) -ErrorAction SilentlyContinue
    if ($cfg -and $cfg.NukeOnDelete -eq 1) { Sai @{ ok = $false; erro = 'lixeira-desligada'; itens = @() } }
    if ($cfg -and $cfg.MaxCapacity) { $limite = [double]$cfg.MaxCapacity * 1MB }
  }
  if (-not ($limite -gt 0)) { Sai @{ ok = $false; erro = 'conferir'; itens = @() } }
} catch { Sai @{ ok = $false; erro = 'conferir'; itens = @() } }
$res = New-Object System.Collections.ArrayList
try {
  Add-Type -AssemblyName Microsoft.VisualBasic
  $ui = [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs
  $lx = [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
} catch { Sai @{ ok = $false; erro = 'apagar'; itens = @() } }
foreach ($it in $itens) {
  $alvo = [string]$it.a
  if ([double]$it.t -ge $limite) { [void]$res.Add(@{ ok = $false; erro = 'lixeira-pequena' }); break }
  try {
    if ($it.p) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($alvo, $ui, $lx) }
    else { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($alvo, $ui, $lx) }
  } catch { [void]$res.Add(@{ ok = $false; erro = 'apagar' }); break }
  if (Test-Path -LiteralPath $alvo) { [void]$res.Add(@{ ok = $false; erro = 'ficou' }); break }
  [void]$res.Add(@{ ok = $true; conferido = $false })
}
try {
  $quer = @{}
  for ($i = 0; $i -lt $res.Count; $i++) {
    if ($res[$i].ok) { $a = [string]$itens[$i].a; $quer[([System.IO.Path]::GetFileName($a)).ToLowerInvariant() + '|' + ([System.IO.Path]::GetDirectoryName($a)).ToLowerInvariant()] = $i }
  }
  if ($quer.Count -gt 0) {
    $lix = (New-Object -ComObject Shell.Application).Namespace(10)
    $relogio = [System.Diagnostics.Stopwatch]::StartNew()
    foreach ($x in $lix.Items()) {
      if ($relogio.ElapsedMilliseconds -gt 15000 -or $quer.Count -eq 0) { break }   # Lixeira enorme: não confere, mas responde a tempo
      $n = $x.ExtendedProperty('System.FileName')
      if (-not $n) { continue }
      $k = ([string]$n).ToLowerInvariant() + '|' + ([string]$lix.GetDetailsOf($x, 1)).ToLowerInvariant()
      if ($quer.ContainsKey($k)) { $res[$quer[$k]].conferido = $true; $quer.Remove($k) }
    }
  }
} catch { }
Sai @{ ok = $true; itens = @($res.ToArray()) }
`;
/**
 * A Lixeira do Windows de verdade para uma lista [{abs, tipo: 'arquivo'|'pasta', tamanho}], num PowerShell só. Devolve
 * {ok, erro?, itens: [{ok, conferido?, erro?}]} na ordem (para no primeiro que falhar). Exportada para o teste com
 * TESTE_LIXEIRA=1; o resto usa P.lixeira / P.lixeiraLote, que conferem antes.
 */
export async function lixeiraLotePadrao(lista) {
  const itens = (Array.isArray(lista) ? lista : []).map(x => ({ a: x.abs, p: x.tipo === 'pasta', t: Math.round(Number(x.tamanho) || 0) }));
  if (!itens.length) return { ok: true, itens: [] };
  const r = await powershell(PS_LIXEIRA, { CEREBRO_ITENS: JSON.stringify(itens) }, 30000 + 5000 * itens.length);
  let o = null;
  try { o = JSON.parse(r.saida.trim().split(/\r?\n/).filter(Boolean).pop() || 'null'); } catch (_) { o = null; }
  if (!o || typeof o !== 'object') return { ok: false, erro: r.ok ? 'saida' : 'powershell', itens: [] };
  const res = (Array.isArray(o.itens) ? o.itens : o.itens && typeof o.itens === 'object' ? [o.itens] : [])
    .map(x => ({ ok: !!(x && x.ok), conferido: !!(x && x.conferido), erro: (x && x.erro) || undefined }));
  return { ok: !!o.ok, erro: o.erro || undefined, itens: res };
}
/** Um item só (o teste com TESTE_LIXEIRA=1 usa direto). */
export async function lixeiraPadrao(abs, { tipo = 'arquivo', tamanho = 0 } = {}) {
  const r = await lixeiraLotePadrao([{ abs, tipo, tamanho }]);
  const it = r.itens[0];
  if (!r.ok) return { ok: false, erro: r.erro || 'powershell' };
  if (!it) return { ok: false, erro: 'saida' };
  return { ok: it.ok, conferido: it.conferido, erro: it.erro };
}

/* Abrir no Windows pelo .NET (nada de cmd /c start: um & no nome viraria comando; nada de Start-Process -FilePath, que
   lê [ ] como curinga). */
const PS_ABRIR = String.raw`
$alvo = $env:CEREBRO_ALVO
$exp = Join-Path $env:SystemRoot 'explorer.exe'
switch ($env:CEREBRO_MODO) {
  'pasta'   { [void][System.Diagnostics.Process]::Start($exp, ('"' + $alvo + '"')) }
  'mostrar' { [void][System.Diagnostics.Process]::Start($exp, ('/select,"' + $alvo + '"')) }
  default   { $si = New-Object System.Diagnostics.ProcessStartInfo; $si.FileName = $alvo; $si.UseShellExecute = $true; [void][System.Diagnostics.Process]::Start($si) }
}
'ok'
`;
async function abridorPadrao(abs, { modo = 'abrir' } = {}) {
  const r = await powershell(PS_ABRIR, { CEREBRO_ALVO: abs, CEREBRO_MODO: modo }, 20000);
  if (!r.ok || !/ok/.test(r.saida)) throw erro('jarvis-abrir', 'O Windows não conseguiu abrir isso agora.');
}

/* realpath do pai mais próximo que existe + o resto (arquivo novo ainda não existe) */
async function realMaisProximo(p) {
  let atual = p;
  const resto = [];
  for (let i = 0; i < 64; i++) {
    try { const r = await fsp.realpath(atual); return resto.length ? path.join(r, ...resto.reverse()) : r; }
    catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
      const pai = path.dirname(atual);
      if (pai === atual) throw e;
      resto.push(path.basename(atual));
      atual = pai;
    }
  }
  throw new Error('caminho fundo demais');
}

/* ---------- a pasta ---------- */
/**
 * A pasta do Jarvis. `lixeira` (um item: (abs, {tipo, tamanho}) → {ok, conferido, erro}), `lixeiraLote` (a lista
 * inteira), `abridor` e `tipoDisco` existem para o teste (o padrão é o PowerShell de verdade). Um `lixeira` de teste sem
 * `lixeiraLote` vale para a lista, item por item. Contrato em docs/JARVIS-ACOES.md §5.1.
 */
export function criarPastaJarvis({ raiz, log = logPadrao, lixeira = null, lixeiraLote = null, abridor = abridorPadrao, tipoDisco = tipoDiscoPadrao } = {}) {
  if (!raiz) throw new Error('criarPastaJarvis: falta a raiz');
  const lixeiraDeVerdade = !lixeira && !lixeiraLote;
  const lote = lixeiraLote || (lixeira
    ? async (lista) => {
      const itens = [];
      for (const x of lista) {
        let r;
        try { r = await lixeira(x.abs, { tipo: x.tipo, tamanho: x.tamanho }); } catch (_) { r = { ok: false, erro: 'apagar' }; }
        // sem resposta do PowerShell (prazo, saída estranha): como o de verdade, a lista para sem resposta para este item
        if (!r || r.erro === 'powershell' || r.erro === 'saida') return { ok: false, erro: (r && r.erro) || 'saida', itens };
        itens.push({ ok: !!r.ok, conferido: !!r.conferido, erro: r.erro });
        if (!r.ok) break;
      }
      return { ok: true, itens };
    }
    : lixeiraLotePadrao);
  const raizAbs = path.resolve(raiz);
  let real = null;           // realpath da raiz, depois da primeira preparação
  let preparando = null;
  const discos = new Map();  // letra -> tipo
  const ids = new Map();     // id -> abs (LRU de 500)
  const porCaminho = new Map();

  async function discoFixo(abs) {
    if (/^[\\/]{2}/.test(abs) || !/^[a-z]:\\/i.test(abs)) throw erro('jarvis-disco');
    const letra = abs[0].toUpperCase();
    if (!discos.has(letra)) discos.set(letra, await tipoDisco(letra));
    const t = discos.get(letra);
    if (t && t !== 'Fixed') throw erro('jarvis-disco');
    if (!t) discos.delete(letra);   // não deu para saber: tenta de novo da próxima vez (a Lixeira confere de novo antes de apagar)
    return t === 'Fixed';
  }

  async function preparar() {
    await discoFixo(raizAbs);
    const pai = path.dirname(raizAbs);
    try { if (!(await fsp.stat(pai)).isDirectory()) throw new Error('não é pasta'); }
    catch (_) { throw erro('jarvis-disco', `Não achei a pasta ${pai}, onde fica a pasta do Jarvis.`); }
    await fsp.mkdir(raizAbs, { recursive: true });
    const r = await fsp.realpath(raizAbs);
    if (!/^[a-z]:\\/i.test(r)) throw erro('jarvis-disco');
    if (r[0].toUpperCase() !== raizAbs[0].toUpperCase()) await discoFixo(r);
    for (const sub of SUBPASTAS) {
      const s = path.join(r, sub);
      await fsp.mkdir(s, { recursive: true });
      const rs = await fsp.realpath(s);
      if (!dentro(r, rs) || chave(path.relative(r, rs)) !== chave(sub)) throw erro('jarvis-fora', `A pasta ${sub} do Jarvis aponta (por atalho) para fora dela.`);
    }
    return r;
  }

  /** Cria a raiz e as subpastas se faltarem; devolve o realpath da raiz. */
  async function raizReal() {
    if (real) {
      try { if ((await fsp.stat(real)).isDirectory()) return real; } catch (_) { /* sumiu: prepara de novo */ }
      real = null;
    }
    if (!preparando) preparando = preparar().then(r => { real = r; return r; }).finally(() => { preparando = null; });
    return preparando;
  }

  const nomeRaiz = () => path.basename(real || raizAbs);
  function relativo(abs) {
    const base = real || raizAbs;
    const r = path.relative(base, abs);
    return r;
  }
  /** Para mostrar: 'Planilhas', 'Projetos\vendas'; a própria raiz = 'JARVIS'. */
  function rotuloPasta(absPasta) {
    const r = relativo(absPasta);
    return r ? r : nomeRaiz();
  }
  const ehEstrutura = (abs) => {
    const r = chave(relativo(abs));
    return r === '' || SUBPASTAS.some(s => chave(s) === r);
  };

  /**
   * Confere um caminho (relativo à raiz, ou absoluto). Lança ErroFerramenta. existe: true (tem que existir) | false (não
   * pode existir) | null; tipo: 'arquivo' | 'pasta' | null. Devolve {abs (o real), rel, st (ou null)}.
   */
  async function conferir(caminho, { existe = null, tipo = null } = {}) {
    const raizR = await raizReal();
    if (typeof caminho !== 'string') throw erro('jarvis-nome', 'Falta o caminho.');
    let bruto = caminho.trim().replace(/^"+|"+$/g, '').normalize('NFC');
    if (bruto.includes('\0') || RX_INVISIVEL.test(bruto)) throw erro('jarvis-nome', 'O caminho tem caracteres invisíveis de controle.');
    if (/^[\\/]{2}/.test(bruto)) throw erro('jarvis-fora', 'Caminho de rede não vale: a pasta do Jarvis fica neste computador.');
    const comLetra = /^[a-z]:[\\/]/i.test(bruto);
    if ((comLetra ? bruto.slice(2) : bruto).includes(':')) throw erro('jarvis-nome', 'O Windows não aceita ":" em nome de arquivo.');
    if (!comLetra && /^[\\/]/.test(bruto)) throw erro('jarvis-fora', 'Use o caminho dentro da pasta do Jarvis (ex.: Anotações\\reuniao.md) ou o caminho completo.');
    let abs;
    if (comLetra) {
      abs = path.resolve(bruto);
      // outra letra de disco nem é tocada (o P: fora do ar travaria por segundos)
      if (![raizR, raizAbs].some(b => b[0].toUpperCase() === abs[0].toUpperCase())) throw erro('jarvis-fora');
    } else {
      const segs = bruto.split(/[\\/]+/).filter(s => s && s !== '.');
      // o modelo às vezes repete o nome da raiz ("JARVIS\Planilhas\…"): tira, se não houver uma pasta com esse nome dentro
      if (segs.length && chave(segs[0]) === chave(path.basename(raizR)) && !fs.existsSync(path.join(raizR, segs[0]))) segs.shift();
      abs = path.resolve(raizR, ...segs);
    }
    // quem decide é o caminho real (junção e atalho resolvidos; o curto GTIJUL~1.ALV e o longo dão o mesmo)
    let r;
    try { r = await realMaisProximo(abs); } catch (_) { throw erro('jarvis-fora', 'Não consegui conferir esse caminho agora.'); }
    if (!dentro(raizR, r)) {
      const lexico = [raizR, raizAbs].some(b => dentro(b, abs));
      throw erro('jarvis-fora', lexico ? 'Esse caminho aponta (por atalho ou junção) para fora da pasta do Jarvis.' : undefined);
    }
    for (const s of path.relative(raizR, r).split(path.sep).filter(Boolean)) {
      const m = motivoNome(s);
      if (m) throw erro('jarvis-nome', m);
    }
    if (r.length > MAX_CAMINHO) throw erro('jarvis-nome', 'O caminho ficou longo demais para o Windows. Use nomes mais curtos.');
    let st = null;
    try { st = await fsp.stat(r); } catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw erro('jarvis-fora', 'Não consegui abrir esse caminho agora.'); }
    if (existe === true && !st) throw erro('jarvis-sumiu');
    if (existe === false && st) throw erro('jarvis-existe');
    if (st && tipo === 'pasta' && !st.isDirectory()) throw erro('jarvis-nome', 'Isso é um arquivo, não uma pasta.');
    if (st && tipo === 'arquivo' && !st.isFile()) throw erro('jarvis-nome', 'Isso é uma pasta, não um arquivo.');
    return { abs: r, rel: path.relative(raizR, r), st };
  }

  /** O caminho de uma subpasta (uma das SUBPASTAS, ou dentro de uma delas), criada se faltar. */
  async function garantir(sub) {
    const { abs, rel, st } = await conferir(String(sub || ''), { tipo: 'pasta' });
    const primeiro = rel.split(path.sep)[0];
    if (!SUBPASTAS.some(s => chave(s) === chave(primeiro))) throw erro('jarvis-fora', `Use uma das pastas do Jarvis: ${SUBPASTAS.join(', ')}.`);
    if (!st) await fsp.mkdir(abs, { recursive: true });
    return abs;
  }

  /** Um caminho livre na pasta: "<base>.<ext>", senão "<base> (2).<ext>"… (nunca por cima). */
  async function nomeLivre(pastaAbs, base, ext) {
    const { abs: pasta } = await conferir(pastaAbs, { tipo: 'pasta' });
    const e = ext ? '.' + String(ext).replace(/^\./, '').toLowerCase() : '';
    let b = nomeSeguro(base);
    const folga = MAX_CAMINHO - pasta.length - 1 - e.length - 5;
    if (folga < 8) throw erro('jarvis-nome', 'O caminho ficou longo demais para o Windows. Use nomes mais curtos.');
    if (Array.from(b).length > folga) b = nomeSeguro(Array.from(b).slice(0, folga).join(''));
    for (let n = 1; n < 1000; n++) {
      const nome = n === 1 ? `${b}${e}` : `${b} (${n})${e}`;
      const abs = path.join(pasta, nome);
      try { await fsp.lstat(abs); } catch (err) { if (err.code === 'ENOENT') return abs; throw err; }
    }
    throw erro('jarvis-existe', 'Já existem itens demais com esse nome.');
  }

  function registrar(abs) {
    const a = path.resolve(abs);
    let id = porCaminho.get(chave(a));
    if (id && ids.has(id)) { ids.delete(id); ids.set(id, a); return id; }
    id = 'arq_' + crypto.randomBytes(16).toString('base64url');
    ids.set(id, a); porCaminho.set(chave(a), id);
    while (ids.size > 500) { const [velho, va] = ids.entries().next().value; ids.delete(velho); porCaminho.delete(chave(va)); }
    return id;
  }
  /** O caminho de um id da interface (null = não conheço). Quem usa confere de novo (abrirNoWindows confere). */
  function porId(id) {
    if (typeof id !== 'string' || !/^arq_[A-Za-z0-9_-]{22}$/.test(id)) return null;
    const a = ids.get(id);
    if (!a) return null;
    ids.delete(id); ids.set(id, a);
    return dentro(real || raizAbs, a) ? a : null;
  }

  /* Criar: só as extensões do §3 (em Projetos\<nome>, também css, js e svg). Regravar um que já existe: também os de
     texto do alterar_texto (um .htm copiado de fora). Nunca o que executa (o .js só dentro de um projeto). */
  function extensaoCriavel(abs, rel, novo) {
    const ext = extDe(abs);
    const segs = rel.split(path.sep);
    const emProjeto = segs.length >= 3 && chave(segs[0]) === chave('Projetos');
    if (PERIGOSAS.has(ext) && !(emProjeto && ext === 'js')) throw erro('jarvis-extensao');
    const lista = emProjeto ? CRIAVEIS_PROJETO : CRIAVEIS;
    if (!lista.has(ext) && !(!novo && ALTERAVEIS.has(ext))) throw erro('jarvis-extensao', `Arquivo .${ext || '(sem extensão)'} eu não crio aqui. Crio ${[...CRIAVEIS].join(', ')}.`);
  }

  /** Grava (texto ou bytes) pelo .tmp + rename. novo = true: o nome não pode existir (reserva o nome antes, sem corrida).
   *  Página HTML sai sempre com a trava (travarHtml). */
  async function escreverTexto(abs, dados, { novo = true } = {}) {
    const c = await conferir(abs, { existe: novo ? false : true, tipo: novo ? null : 'arquivo' });
    extensaoCriavel(c.abs, c.rel, novo);
    if (EXT_PAGINA.has(extDe(c.abs))) dados = travarHtml(typeof dados === 'string' ? dados : Buffer.from(dados ?? '').toString('utf8'));
    const buf = typeof dados === 'string' ? Buffer.from(dados, 'utf8') : Buffer.from(dados ?? '');
    if (buf.length > MAX_ESCRITA) throw erro('jarvis-grande', 'O arquivo ficou grande demais para gravar pelo Jarvis.');
    await fsp.mkdir(path.dirname(c.abs), { recursive: true });
    const tmp = path.join(path.dirname(c.abs), `~jarvis-${crypto.randomBytes(6).toString('base64url')}.tmp`);
    let reservado = false;
    try {
      if (novo) { const fh = await fsp.open(c.abs, 'wx'); await fh.close(); reservado = true; }
      await fsp.writeFile(tmp, buf, { flag: 'wx' });
      await fsp.rename(tmp, c.abs);
      reservado = false;
    } catch (e) {
      await fsp.unlink(tmp).catch(() => {});
      if (reservado) { try { if ((await fsp.stat(c.abs)).size === 0) await fsp.unlink(c.abs); } catch (_) { /* nada */ } }
      if (e.code === 'EEXIST') throw erro('jarvis-existe');
      if (e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES') throw erro('jarvis-ocupado');
      throw e;
    }
    return c.abs;
  }

  const MSG_LIXEIRA = {
    'lixeira-desligada': 'A Lixeira do Windows está desligada neste disco: o Windows apagaria de vez. Nada foi apagado.',
    'lixeira-pequena': 'Esse item não cabe na Lixeira do Windows: o Windows apagaria de vez. Nada foi apagado.',
    disco: 'A pasta do Jarvis não está num disco deste computador. Nada foi apagado.',
  };
  /** Confere um item antes da Lixeira (dentro, não é da estrutura, sem junção, cabe no limite, não está aberto). */
  async function prepararLixeira(abs) {
    const c = await conferir(abs, { existe: true });
    if (ehEstrutura(c.abs)) throw erro('jarvis-estrutura');
    const ehPasta = c.st.isDirectory();
    const medida = ehPasta ? await medirPasta(c.abs) : { arquivos: 1, bytes: c.st.size, atalho: false, passou: c.st.size > MAX_APAGAR_BYTES };
    if (medida.atalho) throw erro('jarvis-lixeira', 'Essa pasta tem um atalho de pasta (junção) dentro. Apague você mesmo, pelo Explorer.');
    if (medida.passou) throw erro('jarvis-grande', 'Grande demais para a Lixeira pelo Jarvis (mais de 2.000 arquivos ou 1 GB). Apague você mesmo.');
    if (!ehPasta) await conferirLivre(c.abs);
    return { abs: c.abs, rel: c.rel, tipo: ehPasta ? 'pasta' : 'arquivo', tamanho: medida.bytes };
  }
  /**
   * Manda uma lista para a Lixeira do Windows (nunca apaga de vez), num PowerShell só, e para no primeiro que falhar.
   * Devolve {feitos: [{abs, rel, tipo, conferido}], falha: {rel, mensagem} | null}.
   */
  async function mandarParaLixeiraLote(lista) {
    const feitos = [];
    if (!Array.isArray(lista) || !lista.length) return { feitos, falha: null };
    const prontos = [];
    let falha = null;
    for (const x of lista) {
      try { prontos.push(await prepararLixeira(x)); }
      catch (e) { if (!(e instanceof ErroFerramenta)) throw e; falha = { rel: typeof x === 'string' ? x : '', mensagem: e.message, codigo: e.codigo }; break; }
    }
    if (prontos.length && process.platform === 'win32' && lixeiraDeVerdade) {
      const fixo = await discoFixo(prontos[0].abs);
      if (!fixo) throw erro('jarvis-lixeira', 'Não consegui conferir o disco da pasta do Jarvis. Nada foi apagado.');
    }
    if (!prontos.length) return { feitos, falha };
    const r = (await lote(prontos.map(p => ({ abs: p.abs, tipo: p.tipo, tamanho: p.tamanho })))) || { ok: false, erro: 'saida', itens: [] };
    const itens = Array.isArray(r.itens) ? r.itens : [];
    for (let i = 0; i < prontos.length; i++) {
      const p = prontos[i], it = itens[i];
      if (it && it.ok) { feitos.push({ ...p, conferido: !!it.conferido }); continue; }
      // o PowerShell passou do prazo ou não respondeu: o item que já saiu do lugar foi para a Lixeira (só não deu para conferir)
      if (!it && !r.ok && !MSG_LIXEIRA[r.erro] && !fs.existsSync(p.abs)) { feitos.push({ ...p, conferido: false }); continue; }
      const cod = (it && it.erro) || r.erro || '';
      log('pasta do Jarvis: a Lixeira recusou', cod);
      falha = { rel: p.rel, mensagem: MSG_LIXEIRA[cod] || MSG['jarvis-lixeira'], codigo: 'jarvis-lixeira' };
      break;
    }
    return { feitos, falha };
  }
  /** Um item só: {ok, conferido}; lança ErroFerramenta. */
  async function mandarParaLixeira(abs) {
    const r = await mandarParaLixeiraLote([abs]);
    if (r.feitos.length) return { ok: true, conferido: r.feitos[0].conferido };
    throw erro((r.falha && r.falha.codigo) || 'jarvis-lixeira', r.falha ? r.falha.mensagem : undefined);
  }

  /**
   * Abre no programa padrão (mostrar = false) ou mostra na pasta (Explorer). Só da pasta do Jarvis; nada que execute.
   * Página HTML só com pagina: true (o clique do Júlio no cartão, a ação "abrir" aprovada, a prévia do construtor).
   */
  async function abrirNoWindows(abs, { mostrar = false, pagina = false } = {}) {
    const c = await conferir(abs, { existe: true });
    if (c.st.isDirectory()) {
      await abridor(c.abs, { modo: mostrar && !ehEstrutura(c.abs) ? 'mostrar' : 'pasta' });
      return;
    }
    const ext = extDe(c.abs);
    if (!ABRIVEIS.has(ext)) throw erro('jarvis-extensao');
    if (!mostrar && EXT_PAGINA.has(ext) && !pagina) throw erro('jarvis-pagina', 'Página HTML abre no navegador só com a sua aprovação.');
    await abridor(c.abs, { modo: mostrar ? 'mostrar' : 'abrir' });
  }

  return {
    raiz: raizAbs, raizReal, garantir, conferir, nomeLivre, relativo, rotuloPasta, nomeRaiz, ehEstrutura, registrar, porId,
    lixeira: mandarParaLixeira, lixeiraLote: mandarParaLixeiraLote, abrirNoWindows, escreverTexto, escrever: escreverTexto,
  };
}

/* conta arquivos e bytes de uma pasta sem seguir junção (achou junção ou link: atalho = true) */
async function medirPasta(abs, limite = { arquivos: MAX_APAGAR_ARQUIVOS, bytes: MAX_APAGAR_BYTES }) {
  let arquivos = 0, bytes = 0, atalho = false, passou = false;
  const fila = [abs];
  while (fila.length && !passou && !atalho) {
    const d = fila.shift();
    let itens;
    try { itens = await fsp.readdir(d, { withFileTypes: true }); } catch (_) { continue; }
    for (const it of itens) {
      const p = path.join(d, it.name);
      if (it.isSymbolicLink()) { atalho = true; break; }
      if (it.isDirectory()) { fila.push(p); continue; }
      arquivos++;
      try { bytes += (await fsp.lstat(p)).size; } catch (_) { /* sumiu */ }
      if (arquivos > limite.arquivos || bytes > limite.bytes) { passou = true; break; }
    }
  }
  return { arquivos, bytes, atalho, passou };
}

/* um arquivo aberto no Excel (sem compartilhar escrita) faria o Windows mostrar uma janela de erro: confere antes */
async function conferirLivre(abs) {
  let fh = null;
  try { fh = await fsp.open(abs, 'r+'); }
  catch (e) { if (e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES') throw erro('jarvis-ocupado'); throw e; }
  finally { await fh?.close().catch(() => {}); }
}

/* ---------- ajudantes das ferramentas ---------- */
function pastaDe(ctx) {
  if (!ctx || !ctx.jarvis) throw erro('jarvis-sem-pasta');
  return ctx.jarvis;
}
const emitir = (ctx, ev, dados) => { try { ctx.emitir?.(ev, dados); } catch (_) { /* a tela é extra */ } };
/* Nos cartões, pasta e pasta_rel são relativas à raiz ('Planilhas', 'Projetos\vendas'; a raiz = ''): a tela mostra
   "JARVIS\" na frente. */
function item(P, abs, st) {
  const pasta = st ? st.isDirectory() : false;
  const rel = P.relativo(path.dirname(abs));
  return {
    id: P.registrar(abs), nome: path.basename(abs), pasta_rel: rel, pasta: rel, tipo: pasta ? 'pasta' : 'arquivo',
    kb: st && !pasta ? kb(st.size) : undefined, modificado: st ? quandoSP(st.mtimeMs) : undefined,
  };
}
async function itemDe(P, abs) {
  let st = null;
  try { st = await fsp.stat(abs); } catch (_) { st = null; }
  return item(P, abs, st);
}
/* cartão "arquivo": o principal em arquivo e solto (nome, pasta, tipo, kb, id); a lista em itens quando há mais de um */
function cartaoArquivo(acao, titulo, itens, extra = {}) {
  const a = itens[0] || {};
  return {
    tipo: 'arquivo',
    dados: {
      acao, titulo, arquivo: a, id: a.id, nome: a.nome, pasta: a.pasta_rel, tipo: a.tipo, kb: a.kb,
      itens: itens.length > 1 ? itens.slice(0, 12) : undefined, total: itens.length, ...extra,
    },
  };
}
async function cartaoPasta(P, absPasta, { titulo } = {}) {
  const lista = await listarItens(P, absPasta, 12);
  const rel = P.relativo(absPasta);
  return { tipo: 'pasta', dados: { titulo: titulo || P.rotuloPasta(absPasta), pasta: rel, pasta_rel: rel, pasta_id: P.registrar(absPasta), itens: lista.itens, total: lista.total } };
}
async function listarItens(P, absPasta, max = 100) {
  const ents = await fsp.readdir(absPasta, { withFileTypes: true });
  const vis = ents.filter(e => !ESCONDIDOS.has(e.name.toLowerCase()) && !RX_TEMP.test(e.name) && !e.name.startsWith('~$'));
  const com = await Promise.all(vis.map(async e => {
    const abs = path.join(absPasta, e.name);
    let st = null;
    try { st = await fsp.lstat(abs); } catch (_) { st = null; }
    return { e, abs, st };
  }));
  com.sort((a, b) => (b.e.isDirectory() - a.e.isDirectory()) || ((b.st?.mtimeMs || 0) - (a.st?.mtimeMs || 0)));
  const itens = com.slice(0, max).map(({ e, abs, st }) => {
    if (e.isSymbolicLink()) return { nome: e.name, tipo: 'atalho', modificado: st ? quandoSP(st.mtimeMs) : undefined };
    return item(P, abs, st);
  });
  return { itens, total: vis.length };
}
/* a ação pendente: o evento para a tela e o texto para o modelo (o mesmo jeito do preparar_email) */
const ROTULO_ACAO = { mover: 'mover', renomear: 'renomear', apagar: 'mandar para a Lixeira', alterar: 'mudar o arquivo', abrir: 'abrir a página' };
function pendente(ctx, { tipo, resumo, detalhe, executar }) {
  const acao = criarAcao({ tipo, resumo, detalhe, aba: ctx.aba, executar });
  const sub = acao.substituiu ? (typeof acao.substituiu === 'string' ? acao.substituiu : acao.substituiu.resumo) : null;
  emitir(ctx, 'acao', { id: acao.id, tipo: acao.tipo, rotulo: ROTULO_ACAO[tipo], resumo: acao.resumo, detalhe: acao.detalhe, expira_em: acao.expira_em, substituiu: acao.substituiu || undefined });
  return {
    situacao: 'aguardando_aprovacao', acao_id: acao.id,
    mensagem: 'O cartão está na tela. AINDA NÃO FOI FEITO: só acontece se o Júlio aprovar (por voz ou no botão da tela). Vence em 5 minutos. Diga em uma ou duas frases o que vai acontecer e que espera a aprovação dele na tela. Não diga as palavras de aprovar nem pergunte "posso?". Só diga que fez depois que a mensagem do sistema confirmar.',
    substituiu: sub ? `A ação anterior ("${cortar(sub, 120)}") saiu da tela e não vale mais: só esta espera aprovação.` : undefined,
  };
}
/* o executar() de uma ação nunca lança: erro de pasta vira a mensagem do desfecho */
async function seguro(oQue, fn) {
  try { return await fn(); } catch (e) {
    if (e instanceof ErroFerramenta) return { ok: false, mensagem: e.message };
    logPadrao(`pasta do Jarvis: ${oQue} falhou`, e?.code || e?.name || '');
    return { ok: false, mensagem: `Não consegui ${oQue} agora.` };
  }
}
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/* ---------- ferramentas ---------- */
export const anotar = {
  nome: 'anotar',
  descricao: 'Cria uma anotação nova (Markdown) na pasta do Jarvis, em JARVIS\\Anotações, com a data e a hora no nome. Criar é livre, sem aprovação. Use quando o Júlio disser "anota", "toma nota", "guarda isso". Nunca anote senha, token ou chave. Para mudar uma anotação que já existe, use alterar_texto (pede aprovação).',
  schema: {
    type: 'object',
    properties: {
      titulo: { type: 'string', minLength: 1, maxLength: 80, description: 'O título curto da anotação (vira o nome do arquivo).' },
      texto: { type: 'string', minLength: 1, maxLength: 20000, description: 'O texto da anotação, em Markdown, do jeito que o Júlio pediu.' },
      subpasta: { type: 'string', maxLength: 80, description: 'Opcional: uma pasta dentro de Anotações (ex.: "Reuniões"). Criada se faltar.' },
    },
    required: ['titulo', 'texto'],
    additionalProperties: false,
  },
  rotulo: 'Anotando',
  async executar({ titulo, texto, subpasta }, ctx) {
    const P = pastaDe(ctx);
    const pasta = await P.garantir(subpasta ? path.join('Anotações', ...String(subpasta).split(/[\\/]+/).filter(Boolean).map(s => nomeSeguro(s, 60))) : 'Anotações');
    const t0 = String(titulo).replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
    const c0 = String(texto).replace(/\r\n/g, '\n').trim();
    const t = mascararSegredos(t0), corpo = mascararSegredos(c0);
    const mascarou = t !== t0 || corpo !== c0;
    const ag = agoraSP();
    const conteudo = `# ${t}\n\n${corpo}\n\n---\n_Anotado pelo Jarvis em ${ag.br} às ${ag.hm}._\n`;
    let abs = null;
    for (let volta = 0; volta < 3 && !abs; volta++) {
      const livre = await P.nomeLivre(pasta, `${ag.data} ${ag.hora} — ${nomeSeguro(t, 60)}`, 'md');
      try { abs = await P.escreverTexto(livre, conteudo, { novo: true }); }
      catch (e) { if (!(e instanceof ErroFerramenta && e.codigo === 'jarvis-existe')) throw e; }
    }
    if (!abs) throw erro('jarvis-existe');
    const rel = P.relativo(abs);
    emitir(ctx, 'cartao', { tipo: 'anotacao', dados: { titulo: cortar(t, 80), trecho: cortar(corpo, 300), arquivo: { id: P.registrar(abs), nome: path.basename(abs), pasta_rel: P.relativo(path.dirname(abs)) } } });
    return {
      conteudo: { criado: rel, aviso: mascarou ? 'Tirei da anotação o que parecia senha, token ou chave.' : undefined },
      resumo: cortar(path.basename(abs), 60),
    };
  },
};

export const alterarTexto = {
  nome: 'alterar_texto',
  descricao: 'Muda um arquivo de texto que já existe na pasta do Jarvis (md, txt, csv, json, html, até 1 MB): acrescentar no fim, trocar um trecho exato ou substituir tudo. NÃO muda na hora: põe um cartão na tela e espera o Júlio aprovar por voz. Depois de chamar, diga em uma frase o que vai mudar e que espera a aprovação.',
  schema: {
    type: 'object',
    properties: {
      caminho: { type: 'string', minLength: 3, maxLength: 400, description: 'O arquivo, dentro da pasta do Jarvis (ex.: "Anotações\\2026-10-20 14h55 — Reunião.md").' },
      modo: { type: 'string', enum: ['acrescentar', 'substituir_tudo', 'trocar_trecho'], description: 'acrescentar (no fim), substituir_tudo ou trocar_trecho (troca trecho_antigo por texto).' },
      texto: { type: 'string', minLength: 0, maxLength: 200000, description: 'O texto novo.' },
      trecho_antigo: { type: 'string', minLength: 1, maxLength: 20000, description: 'Só em trocar_trecho: o trecho exato que sai (tem que aparecer uma vez só).' },
    },
    required: ['caminho', 'modo', 'texto'],
    additionalProperties: false,
  },
  rotulo: 'Preparando a mudança',
  async executar({ caminho, modo, texto, trecho_antigo: trecho }, ctx) {
    const P = pastaDe(ctx);
    const c = await P.conferir(caminho, { existe: true, tipo: 'arquivo' });
    if (!ALTERAVEIS.has(extDe(c.abs))) throw erro('jarvis-extensao', `Só mudo arquivo de texto (${[...ALTERAVEIS].join(', ')}). Para os outros, crie um novo.`);
    if (c.st.size > MAX_ALTERAR) throw erro('jarvis-grande', 'O arquivo passa de 1 MB: grande demais para mudar pelo Jarvis.');
    const buf = await fsp.readFile(c.abs);
    const bom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    let velho;
    try { velho = new TextDecoder('utf-8', { fatal: true }).decode(bom ? buf.subarray(3) : buf); }
    catch (_) { throw erro('jarvis-nome', 'Esse arquivo não está em UTF-8: para não estragar os acentos, não mexo nele. Crie um novo.'); }
    const novoTexto = mascararSegredos(String(texto));
    let novo, antes, depois;
    if (modo === 'acrescentar') {
      if (!novoTexto.trim()) throw erro('jarvis-nome', 'Falta o texto para acrescentar.');
      const junta = !velho || velho.endsWith('\n') ? '' : '\n';
      novo = velho + junta + novoTexto + (novoTexto.endsWith('\n') ? '' : '\n');
      antes = velho.length > 600 ? '…' + velho.slice(-599) : velho;
      depois = cortar(novoTexto, 600);
    } else if (modo === 'substituir_tudo') {
      novo = novoTexto;
      antes = cortar(velho, 600); depois = cortar(novoTexto, 600);
    } else {
      if (!trecho) throw erro('jarvis-nome', 'Em trocar_trecho, passe o trecho_antigo (o trecho exato que sai).');
      const vezes = velho.split(trecho).length - 1;
      if (vezes === 0) throw erro('jarvis-nome', 'Não achei esse trecho no arquivo. Leia o arquivo e passe o trecho exato.');
      if (vezes > 1) throw erro('jarvis-nome', `Esse trecho aparece ${vezes} vezes: passe um trecho maior, que apareça uma vez só.`);
      const i = velho.indexOf(trecho);
      novo = velho.slice(0, i) + novoTexto + velho.slice(i + trecho.length);
      antes = cortar(mascararSegredos(trecho), 600); depois = cortar(novoTexto, 600);
    }
    if (novo === velho) throw erro('jarvis-nome', 'O arquivo ficaria igual: não há o que mudar.');
    const bytes = (bom ? '\uFEFF' : '') + novo;
    if (Buffer.byteLength(bytes) > 2 * MAX_ALTERAR) throw erro('jarvis-grande', 'O arquivo ficaria grande demais (mais de 2 MB).');
    const marca = { mtimeMs: c.st.mtimeMs, size: c.st.size };
    const rel = c.rel;
    const modoTexto = { acrescentar: 'acrescentar no fim', substituir_tudo: 'substituir tudo', trocar_trecho: 'trocar um trecho' }[modo];
    const r = pendente(ctx, {
      tipo: 'alterar',
      resumo: `Mudar ${cortar(path.basename(c.abs), 80)} (${modoTexto})`,
      detalhe: { arquivo: rel, modo, antes: mascararSegredos(antes), depois },
      executar: () => seguro('mudar o arquivo', async () => {
        const agora = await P.conferir(rel, { existe: true, tipo: 'arquivo' });
        if (agora.st.mtimeMs !== marca.mtimeMs || agora.st.size !== marca.size) throw erro('jarvis-mudou');
        await P.escreverTexto(agora.abs, bytes, { novo: false });
        return {
          ok: true, mensagem: `Mudei ${rel} (${modoTexto}).`,
          fala: `Pronto, mudei ${chave(rel.split(path.sep)[0]) === chave('Anotações') ? 'a anotação' : 'o arquivo'}.`,
          cartao: cartaoArquivo('alterado', 'Arquivo mudado', [await itemDe(P, agora.abs)]),
        };
      }),
    });
    return { conteudo: { ...r, arquivo: rel }, resumo: `${cortar(path.basename(c.abs), 40)} · espera aprovação` };
  },
};

export const listarPasta = {
  nome: 'listar_pasta',
  descricao: 'Lista o que tem numa pasta da pasta do Jarvis (sem pasta = a raiz JARVIS, com Anotações, Planilhas, Prints, Projetos e Arquivos): pastas primeiro, depois os mais recentes, até 100 itens. Mostra um cartão na tela. Livre.',
  schema: {
    type: 'object',
    properties: {
      pasta: { type: 'string', maxLength: 400, description: 'Opcional: a pasta (ex.: "Planilhas"). Sem ela, a raiz.' },
      mostrar: { type: 'boolean', description: 'Opcional: false para não pôr o cartão na tela (padrão true).' },
    },
    additionalProperties: false,
  },
  rotulo: 'Olhando a pasta do Jarvis',
  async executar({ pasta = '', mostrar = true } = {}, ctx) {
    const P = pastaDe(ctx);
    const c = await P.conferir(pasta || '', { existe: true, tipo: 'pasta' });
    const lista = await listarItens(P, c.abs, 100);
    if (mostrar) emitir(ctx, 'cartao', await cartaoPasta(P, c.abs));
    return {
      conteudo: { pasta: P.rotuloPasta(c.abs), itens: lista.itens.map(({ id: _id, pasta_rel: _p, pasta: _q, ...x }) => x), total: lista.total },
      resumo: `${P.rotuloPasta(c.abs)} · ${plural(lista.total, 'item', 'itens')}`,
    };
  },
};

export const criarPasta = {
  nome: 'criar_pasta',
  descricao: 'Cria uma pasta nova dentro da pasta do Jarvis (ex.: "Projetos\\Campanha", "Arquivos\\Fornecedores"). Livre. Se já existir, só avisa.',
  schema: {
    type: 'object',
    properties: { caminho: { type: 'string', minLength: 1, maxLength: 400, description: 'A pasta nova, dentro da pasta do Jarvis.' } },
    required: ['caminho'],
    additionalProperties: false,
  },
  rotulo: 'Criando a pasta',
  async executar({ caminho }, ctx) {
    const P = pastaDe(ctx);
    const raiz = await P.raizReal();
    let segs = String(caminho).split(/[\\/]+/).filter(s => s && s !== '.');
    if (/^[a-z]:$/i.test(segs[0] || '')) {
      // caminho completo: só vale dentro da pasta do Jarvis (o conferir diz se não for)
      const c = await P.conferir(String(caminho), { tipo: 'pasta' });
      segs = c.rel.split(path.sep).filter(Boolean);
    } else if (segs.length && chave(segs[0]) === chave(path.basename(raiz)) && !fs.existsSync(path.join(raiz, segs[0]))) segs.shift();
    if (!segs.length) throw erro('jarvis-nome', 'Falta o nome da pasta nova.');
    // os pedaços que já existem ficam como estão; os novos passam pelo nomeSeguro ("Reunião: compras" → "Reunião — compras")
    let atual = '';
    for (const s of segs) {
      const tentativa = atual ? path.join(atual, s) : s;
      atual = fs.existsSync(path.join(raiz, tentativa)) ? tentativa : (atual ? path.join(atual, nomeSeguro(s, 80)) : nomeSeguro(s, 80));
    }
    if (atual.split(path.sep).length > 8) throw erro('jarvis-nome', 'Pasta funda demais (mais de 8 níveis).');
    const c = await P.conferir(atual, { tipo: 'pasta' });
    if (c.st) {
      return { conteudo: { pasta: c.rel || P.nomeRaiz(), ja_existia: true }, resumo: `${cortar(c.rel || P.nomeRaiz(), 50)} já existia` };
    }
    await fsp.mkdir(c.abs, { recursive: true });
    emitir(ctx, 'cartao', cartaoArquivo('criado', 'Pasta criada', [await itemDe(P, c.abs)]));
    return { conteudo: { criada: P.relativo(c.abs) }, resumo: cortar(P.relativo(c.abs), 60) };
  },
};

export const criarArquivo = {
  nome: 'criar_arquivo',
  descricao: 'Cria um arquivo de texto novo (md, txt, csv, json ou html) na pasta do Jarvis (padrão: JARVIS\\Arquivos). Nunca grava por cima: se o nome existir, ganha " (2)". Livre. Nunca grave senha, token ou chave.',
  schema: {
    type: 'object',
    properties: {
      pasta: { type: 'string', maxLength: 400, description: 'Opcional: a pasta dentro da pasta do Jarvis (padrão "Arquivos"). Criada se faltar.' },
      nome: { type: 'string', minLength: 1, maxLength: 80, description: 'O nome do arquivo, sem a extensão.' },
      tipo: { type: 'string', enum: ['md', 'txt', 'csv', 'json', 'html'] },
      conteudo: { type: 'string', minLength: 0, maxLength: 200000, description: 'O conteúdo do arquivo.' },
    },
    required: ['nome', 'tipo', 'conteudo'],
    additionalProperties: false,
  },
  rotulo: 'Criando o arquivo',
  async executar({ pasta = 'Arquivos', nome, tipo, conteudo }, ctx) {
    const P = pastaDe(ctx);
    const c = await P.conferir(pasta || 'Arquivos', { tipo: 'pasta' });
    if (!c.st) await fsp.mkdir(c.abs, { recursive: true });
    const base = String(nome).replace(new RegExp(`\\.${tipo}$`, 'i'), '');
    const texto = mascararSegredos(String(conteudo));
    let abs = null;
    for (let volta = 0; volta < 3 && !abs; volta++) {
      const livre = await P.nomeLivre(c.abs, nomeSeguro(base, 80), tipo);
      try { abs = await P.escreverTexto(livre, texto, { novo: true }); }
      catch (e) { if (!(e instanceof ErroFerramenta && e.codigo === 'jarvis-existe')) throw e; }
    }
    if (!abs) throw erro('jarvis-existe');
    emitir(ctx, 'cartao', cartaoArquivo('criado', 'Arquivo criado', [await itemDe(P, abs)]));
    return {
      conteudo: { criado: P.relativo(abs), aviso: texto !== String(conteudo) ? 'Tirei do arquivo o que parecia senha, token ou chave.' : undefined },
      resumo: cortar(path.basename(abs), 60),
    };
  },
};

export const copiarParaJarvis = {
  nome: 'copiar_para_jarvis',
  descricao: 'Copia um arquivo que você consegue ler (OneDrive da Lube, P:\\) para dentro da pasta do Jarvis (padrão: JARVIS\\Arquivos), até 200 MB. Livre. Passe o caminho completo que o buscar_arquivos devolveu. Arquivo de senha, de configuração, de script, da folha e do RH não sai; programa (.exe, .bat…) também não.',
  schema: {
    type: 'object',
    properties: {
      de: { type: 'string', minLength: 3, maxLength: 600, description: 'O caminho completo do arquivo de origem.' },
      para: { type: 'string', maxLength: 400, description: 'Opcional: a pasta de destino dentro da pasta do Jarvis (padrão "Arquivos").' },
    },
    required: ['de'],
    additionalProperties: false,
  },
  rotulo: 'Copiando para a pasta do Jarvis',
  prazoMs: 120000,
  async executar({ de, para = 'Arquivos' }, ctx) {
    const P = pastaDe(ctx);
    const { abs: origem } = await conferirCaminho(ctx.cfg.raizes, de);   // as mesmas proibições do ler_arquivo
    let st;
    try { st = await fsp.stat(origem); } catch (_) { throw new ErroFerramenta('Esse arquivo não existe (ou foi movido).', 'arquivo-sumiu'); }
    if (!st.isFile()) throw erro('jarvis-nome', 'Copio um arquivo por vez, não uma pasta inteira.');
    const ext = extDe(origem);
    if (PERIGOSAS.has(ext)) throw erro('jarvis-extensao');
    if (st.size > MAX_COPIA) throw erro('jarvis-grande', `O arquivo tem ${Math.round(st.size / 1048576)} MB: passa do limite de 200 MB para copiar.`);
    const c = await P.conferir(para || 'Arquivos', { tipo: 'pasta' });
    // nota com dado de pessoa não vai para Projetos: lá o construtor lê, e o que ele faz vira página e print
    if (chave(c.rel.split(path.sep)[0]) === chave('Projetos') && arquivoPessoal(origem, ctx.cfg && ctx.cfg.vaultDir)) {
      throw erro('jarvis-pessoal', 'Essa nota tem dado de pessoa: ela não vai para a pasta Projetos. Copie para Arquivos, se precisar.');
    }
    if (!c.st) await fsp.mkdir(c.abs, { recursive: true });
    const nomeOrig = path.basename(origem);
    const base = ext ? nomeOrig.slice(0, -(ext.length + 1)) : nomeOrig;
    let destino = null;
    for (let volta = 0; volta < 3 && !destino; volta++) {
      const livre = await P.nomeLivre(c.abs, base, ext);
      await P.conferir(livre, { existe: false });
      try { await fsp.copyFile(origem, livre, fs.constants.COPYFILE_EXCL); destino = livre; }
      catch (e) {
        if (e.code === 'EEXIST') continue;
        await fsp.unlink(livre).catch(() => {});
        if (e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES') throw new ErroFerramenta('Não consegui ler o arquivo de origem (está aberto em outro programa ou sem permissão).', 'arquivo');
        throw e;
      }
    }
    if (!destino) throw erro('jarvis-existe');
    emitir(ctx, 'cartao', cartaoArquivo('copiado', 'Arquivo copiado', [await itemDe(P, destino)], { de: cortar(origem, 200) }));
    return { conteudo: { copiado: P.relativo(destino), de: origem, kb: kb(st.size) }, resumo: cortar(path.basename(destino), 60) };
  },
};

export const mover = {
  nome: 'mover',
  descricao: 'Move de 1 a 20 itens (arquivos ou pastas) para outra pasta, tudo dentro da pasta do Jarvis. NÃO faz na hora: cartão na tela + aprovação por voz. Nunca grava por cima. A raiz e as pastas Anotações, Planilhas, Prints, Projetos e Arquivos não saem do lugar. Para trocar o nome, use renomear.',
  schema: {
    type: 'object',
    properties: {
      itens: {
        type: 'array', minItems: 1, maxItems: 20,
        items: {
          type: 'object',
          properties: {
            de: { type: 'string', minLength: 1, maxLength: 400, description: 'O item que sai (ex.: "Arquivos\\nota.pdf").' },
            para: { type: 'string', minLength: 1, maxLength: 400, description: 'A PASTA de destino (ex.: "Planilhas\\Outubro"). Criada se faltar.' },
          },
          required: ['de', 'para'],
          additionalProperties: false,
        },
      },
    },
    required: ['itens'],
    additionalProperties: false,
  },
  rotulo: 'Preparando para mover',
  async executar({ itens }, ctx) {
    const P = pastaDe(ctx);
    const plano = [];
    const vistos = new Set();
    for (const it of itens) {
      const o = await P.conferir(it.de, { existe: true });
      if (P.ehEstrutura(o.abs)) throw erro('jarvis-estrutura');
      if (vistos.has(chave(o.abs)) || plano.some(x => dentro(x.abs, o.abs) || dentro(o.abs, x.abs))) throw erro('jarvis-nome', `O item ${o.rel} aparece duas vezes (ou está dentro de outro da lista).`);
      vistos.add(chave(o.abs));
      const d = await P.conferir(it.para, { tipo: 'pasta' });
      if (!d.st && CONHECIDAS.has(extDe(d.abs))) throw erro('jarvis-nome', 'Em mover, "para" é a PASTA de destino. Para trocar o nome, use renomear.');
      if (dentro(o.abs, d.abs)) throw erro('jarvis-nome', 'Não dá para mover uma pasta para dentro dela mesma.');
      if (chave(path.dirname(o.abs)) === chave(d.abs)) throw erro('jarvis-nome', `${o.rel} já está em ${P.rotuloPasta(d.abs)}.`);
      const alvo = path.join(d.abs, path.basename(o.abs));
      await P.conferir(alvo, { existe: false });
      if (plano.some(x => chave(x.alvo) === chave(alvo))) throw erro('jarvis-existe', `Dois itens com o mesmo nome iriam para ${P.rotuloPasta(d.abs)}.`);
      plano.push({ abs: o.abs, de: o.rel, para: d.rel, alvo, pastaNova: !d.st, tipo: o.st.isDirectory() ? 'pasta' : 'arquivo' });
    }
    const destinos = [...new Set(plano.map(x => x.para))];
    const rotDest = (r) => r || P.nomeRaiz();
    const resumo = plano.length === 1 ? `Mover ${cortar(path.basename(plano[0].de), 60)} para ${rotDest(plano[0].para)}`
      : `Mover ${plano.length} itens para ${destinos.length === 1 ? rotDest(destinos[0]) : `${destinos.length} pastas`}`;
    const r = pendente(ctx, {
      tipo: 'mover', resumo,
      detalhe: { itens: plano.map(x => ({ de: x.de, para: rotDest(x.para), tipo: x.tipo, pasta_nova: x.pastaNova || undefined })), total: plano.length },
      executar: () => seguro('mover', async () => {
        const feitos = [];
        for (const x of plano) {
          try {
            const o = await P.conferir(x.de, { existe: true });
            if (P.ehEstrutura(o.abs)) throw erro('jarvis-estrutura');
            const d = await P.conferir(x.para, { tipo: 'pasta' });
            if (!d.st) await fsp.mkdir(d.abs, { recursive: true });
            if (dentro(o.abs, d.abs)) throw erro('jarvis-nome', 'Não dá para mover uma pasta para dentro dela mesma.');
            const alvo = await P.conferir(path.join(d.abs, path.basename(o.abs)), { existe: false });
            try { await fsp.rename(o.abs, alvo.abs); }
            catch (e) { if (e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES') throw erro('jarvis-ocupado'); throw e; }
            feitos.push(alvo.abs);
          } catch (e) {
            const falha = e instanceof ErroFerramenta ? e.message : 'erro inesperado';
            if (!(e instanceof ErroFerramenta)) logPadrao('pasta do Jarvis: mover falhou', e?.code || '');
            return {
              ok: feitos.length > 0, mensagem: `${feitos.length ? `Movi ${plural(feitos.length, 'item', 'itens')}; ` : ''}parei em ${x.de}: ${falha}`,
              fala: `${feitos.length ? `Movi ${plural(feitos.length, 'item', 'itens')}, mas parei num deles.` : 'Não consegui mover.'} O motivo está na tela.`,
            };
          }
        }
        const pastaFim = path.dirname(feitos[0]);
        return {
          ok: true, mensagem: `Movi ${plural(feitos.length, 'item', 'itens')} para ${destinos.length === 1 ? rotDest(destinos[0]) : 'as pastas pedidas'}.`,
          fala: `Movi ${plural(feitos.length, 'item', 'itens')} para ${destinos.length === 1 ? `a pasta ${path.basename(rotDest(destinos[0]))}` : 'as pastas pedidas'}.`,
          cartao: await cartaoPasta(P, pastaFim, { titulo: `Movido para ${P.rotuloPasta(pastaFim)}` }),
        };
      }),
    });
    return { conteudo: { ...r, itens: plano.length }, resumo: `${plural(plano.length, 'item', 'itens')} · espera aprovação` };
  },
};

export const renomear = {
  nome: 'renomear',
  descricao: 'Renomeia um arquivo ou uma pasta dentro da pasta do Jarvis. NÃO faz na hora: cartão na tela + aprovação por voz. O tipo do arquivo (a extensão) continua o mesmo. A raiz e as pastas Anotações, Planilhas, Prints, Projetos e Arquivos não mudam de nome.',
  schema: {
    type: 'object',
    properties: {
      caminho: { type: 'string', minLength: 1, maxLength: 400, description: 'O item, dentro da pasta do Jarvis.' },
      novo_nome: { type: 'string', minLength: 1, maxLength: 80, description: 'O nome novo, só o nome (sem pasta). A extensão pode ficar de fora.' },
    },
    required: ['caminho', 'novo_nome'],
    additionalProperties: false,
  },
  rotulo: 'Preparando para renomear',
  async executar({ caminho, novo_nome: novoNome }, ctx) {
    const P = pastaDe(ctx);
    const o = await P.conferir(caminho, { existe: true });
    if (P.ehEstrutura(o.abs)) throw erro('jarvis-estrutura');
    if (/[\\/]/.test(novoNome)) throw erro('jarvis-nome', 'Em renomear, passe só o nome novo, sem pasta. Para mudar de pasta, use mover.');
    const ehPasta = o.st.isDirectory();
    const extVelha = ehPasta ? '' : extDe(o.abs);
    let base = String(novoNome).trim();
    if (extVelha) {
      const extNova = extDe(base);
      if (extNova === extVelha) base = base.slice(0, -(extVelha.length + 1));
      else if (CONHECIDAS.has(extNova)) throw erro('jarvis-extensao', `Renomear não troca o tipo do arquivo (.${extVelha}). Passe o nome sem a extensão.`);
    }
    const nome = nomeSeguro(base, 80) + (extVelha ? '.' + extVelha : '');
    const pasta = path.dirname(o.abs);
    if (nome === path.basename(o.abs)) throw erro('jarvis-nome', 'O nome novo é igual ao de agora.');
    const so = chave(nome) === chave(path.basename(o.abs));   // só maiúscula/minúscula: o Windows acha que é o mesmo nome
    if (!so) await P.conferir(path.join(pasta, nome), { existe: false });
    const relPasta = P.relativo(pasta);   // a tela mostra "JARVIS\" na frente
    const de = path.basename(o.abs);
    const r = pendente(ctx, {
      tipo: 'renomear',
      resumo: `Renomear ${cortar(de, 60)} para ${cortar(nome, 60)}`,
      detalhe: { pasta: relPasta, de, para: nome, tipo: ehPasta ? 'pasta' : 'arquivo' },
      executar: () => seguro('renomear', async () => {
        const agora = await P.conferir(o.rel, { existe: true });
        if (P.ehEstrutura(agora.abs)) throw erro('jarvis-estrutura');
        const alvo = path.join(path.dirname(agora.abs), nome);
        if (!so) await P.conferir(alvo, { existe: false });
        try { await fsp.rename(agora.abs, alvo); }
        catch (e) { if (e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES') throw erro('jarvis-ocupado'); throw e; }
        return {
          ok: true, mensagem: `Renomeei ${de} para ${nome}.`,
          fala: `Renomeei. O nome novo é ${extVelha ? nome.slice(0, -(extVelha.length + 1)) : nome}.`,
          cartao: cartaoArquivo('renomeado', 'Renomeado', [await itemDe(P, alvo)], { antes: de }),
        };
      }),
    });
    return { conteudo: { ...r, de: o.rel, para: nome }, resumo: `${cortar(nome, 40)} · espera aprovação` };
  },
};

export const apagar = {
  nome: 'apagar',
  descricao: 'Manda de 1 a 20 itens da pasta do Jarvis para a Lixeira do Windows (dá para restaurar; nunca apaga de vez). NÃO faz na hora: cartão na tela + aprovação por voz. A raiz e as pastas Anotações, Planilhas, Prints, Projetos e Arquivos não saem do lugar. Mais de 2.000 arquivos ou 1 GB, o Júlio apaga ele mesmo.',
  schema: {
    type: 'object',
    properties: {
      itens: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 400 }, description: 'Os itens, dentro da pasta do Jarvis.' },
    },
    required: ['itens'],
    additionalProperties: false,
  },
  rotulo: 'Preparando para mandar para a Lixeira',
  async executar({ itens }, ctx) {
    const P = pastaDe(ctx);
    const plano = [];
    let arquivos = 0, bytes = 0;
    for (const caminho of itens) {
      const c = await P.conferir(caminho, { existe: true });
      if (P.ehEstrutura(c.abs)) throw erro('jarvis-estrutura');
      if (plano.some(x => chave(x.abs) === chave(c.abs) || dentro(x.abs, c.abs) || dentro(c.abs, x.abs))) throw erro('jarvis-nome', `O item ${c.rel} aparece duas vezes (ou está dentro de outro da lista).`);
      const ehPasta = c.st.isDirectory();
      const m = ehPasta ? await medirPasta(c.abs) : { arquivos: 1, bytes: c.st.size };
      if (m.atalho) throw erro('jarvis-lixeira', `A pasta ${c.rel} tem um atalho de pasta (junção) dentro. Apague você mesmo, pelo Explorer.`);
      arquivos += m.arquivos; bytes += m.bytes;
      if (m.passou || arquivos > MAX_APAGAR_ARQUIVOS || bytes > MAX_APAGAR_BYTES) throw erro('jarvis-grande', 'Grande demais para a Lixeira pelo Jarvis (mais de 2.000 arquivos ou 1 GB). Apague você mesmo.');
      plano.push({ abs: c.abs, rel: c.rel, tipo: ehPasta ? 'pasta' : 'arquivo', kb: kb(m.bytes), arquivos: ehPasta ? m.arquivos : undefined });
    }
    const resumo = plano.length === 1 ? `Mandar ${cortar(path.basename(plano[0].rel), 60)} para a Lixeira` : `Mandar ${plano.length} itens para a Lixeira`;
    const r = pendente(ctx, {
      tipo: 'apagar', resumo,
      detalhe: { itens: plano.map(x => ({ caminho: x.rel, tipo: x.tipo, kb: x.kb, arquivos: x.arquivos })), total: plano.length, destino: 'Lixeira do Windows' },
      // a lista inteira num PowerShell só (P.lixeiraLote): confere a Lixeira uma vez, manda todos e confere todos juntos
      executar: () => seguro('mandar para a Lixeira', async () => {
        const r = await P.lixeiraLote(plano.map(x => x.rel));
        const kbDe = new Map(plano.map(x => [chave(x.rel), x.kb]));
        const feitos = r.feitos.map(f => ({ nome: path.basename(f.abs), pasta_rel: P.relativo(path.dirname(f.abs)), pasta: P.relativo(path.dirname(f.abs)), tipo: f.tipo, kb: kbDe.get(chave(f.rel)) }));
        const semConferir = r.feitos.filter(f => !f.conferido).map(f => path.basename(f.abs));
        if (r.falha) {
          return {
            ok: feitos.length > 0,
            mensagem: `${feitos.length ? `Mandei ${plural(feitos.length, 'item', 'itens')} para a Lixeira; ` : ''}parei em ${r.falha.rel}: ${r.falha.mensagem}`,
            fala: `${feitos.length ? `Mandei ${plural(feitos.length, 'item', 'itens')} para a Lixeira, mas parei num deles. ` : 'Não consegui mandar para a Lixeira. Nada foi apagado. '}O motivo está na tela.`,
            cartao: feitos.length ? cartaoArquivo('na_lixeira', 'Na Lixeira do Windows', feitos, { conferido: !semConferir.length }) : undefined,
          };
        }
        const aviso = semConferir.length ? ` Não achei ${semConferir.length === 1 ? `"${semConferir[0]}"` : `${semConferir.length} deles`} na Lixeira para conferir: veja lá.` : '';
        return {
          ok: true, mensagem: `Mandei ${plural(feitos.length, 'item', 'itens')} para a Lixeira do Windows (dá para restaurar).${aviso}`,
          fala: `Mandei ${plural(feitos.length, 'item', 'itens')} para a Lixeira. Dá para restaurar.${semConferir.length ? ' Só não consegui conferir lá: veja a Lixeira.' : ''}`,
          cartao: cartaoArquivo('na_lixeira', 'Na Lixeira do Windows', feitos, { conferido: !semConferir.length, aviso: aviso.trim() || undefined }),
        };
      }),
    });
    return { conteudo: { ...r, itens: plano.length }, resumo: `${plural(plano.length, 'item', 'itens')} · espera aprovação` };
  },
};

export const abrirNoWindows = {
  nome: 'abrir_no_windows',
  descricao: 'Abre um arquivo da pasta do Jarvis no programa do Windows (planilha no Excel, PDF, imagem, texto) ou mostra o arquivo na pasta (Explorer). Pasta abre no Explorer. Só da pasta do Jarvis; nada que execute. Livre, menos página HTML (um site ou BI que você criou): ela abre no navegador do Júlio só com a aprovação dele, por um cartão na tela; depois de chamar, diga que espera a aprovação.',
  schema: {
    type: 'object',
    properties: {
      caminho: { type: 'string', minLength: 1, maxLength: 400, description: 'O arquivo ou a pasta, dentro da pasta do Jarvis.' },
      modo: { type: 'string', enum: ['abrir', 'mostrar_na_pasta'], description: 'abrir (padrão) ou mostrar_na_pasta.' },
    },
    required: ['caminho'],
    additionalProperties: false,
  },
  rotulo: 'Abrindo no Windows',
  async executar({ caminho, modo = 'abrir' }, ctx) {
    const P = pastaDe(ctx);
    const c = await P.conferir(caminho, { existe: true });
    const ext = extDe(c.abs);
    // página HTML no navegador padrão: roda com a sessão e a rede do Júlio, sem as travas do navegador escondido. Só com
    // a aprovação dele (um texto lido num site ou e-mail poderia ter pedido para criar e abrir a página)
    if (modo !== 'mostrar_na_pasta' && c.st.isFile() && EXT_PAGINA.has(ext)) {
      const rel = c.rel;
      const r = pendente(ctx, {
        tipo: 'abrir',
        resumo: `Abrir a página ${cortar(path.basename(c.abs), 80)} no navegador`,
        detalhe: { arquivo: rel, kb: kb(c.st.size), id: P.registrar(c.abs) },
        executar: () => seguro('abrir a página', async () => {
          const agora = await P.conferir(rel, { existe: true, tipo: 'arquivo' });
          await P.abrirNoWindows(agora.abs, { pagina: true });
          return { ok: true, mensagem: `Abri ${rel} no navegador.`, fala: 'Abri a página no navegador.' };
        }),
      });
      return { conteudo: { ...r, arquivo: rel }, resumo: `${cortar(path.basename(c.abs), 40)} · espera aprovação` };
    }
    await P.abrirNoWindows(c.abs, { mostrar: modo === 'mostrar_na_pasta' });
    const oQue = c.st.isDirectory() ? 'a pasta' : 'o arquivo';
    return {
      conteudo: { aberto: c.rel || P.nomeRaiz(), mensagem: modo === 'mostrar_na_pasta' ? `Mostrei ${oQue} no Explorer.` : `Abri ${oQue} no Windows.` },
      resumo: cortar(path.basename(c.abs), 60),
    };
  },
};

/** As ferramentas da pasta, na ordem fixa (a lista de tools é o começo do prefixo do cache). criar_planilha fica no planilha.js. */
export const FERRAMENTAS_PASTA = [anotar, alterarTexto, listarPasta, criarPasta, criarArquivo, copiarParaJarvis, mover, renomear, apagar, abrirNoWindows];
