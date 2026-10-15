/* Extração de texto para ler_arquivo: txt/md/csv/json…, docx, xlsx/xlsm, pptx, odt/ods e pdf.
   Os formatos do Office e do LibreOffice são zip com XML dentro: um leitor de zip pequeno (só o que esses arquivos usam:
   "stored" e "deflate"), com teto de tamanho descompactado contra zip-bomba. PDF pelo unpdf (PDF.js). */
import zlib from 'node:zlib';
import { ErroFerramenta } from '../util.js';

const TETO_ZIP = 40 * 1024 * 1024;     // descompactado, somando tudo o que for lido

/* ---------- zip ---------- */
function abrirZip(buf) {
  const min = Math.max(0, buf.length - 65557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= min; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new ErroFerramenta('O arquivo não é um documento válido (zip corrompido).', 'arquivo-formato');
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const itens = new Map();
  for (let k = 0; k < n && p + 46 <= buf.length; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = buf.readUInt16LE(p + 10);
    const comp = buf.readUInt32LE(p + 20), tam = buf.readUInt32LE(p + 24);
    const ln = buf.readUInt16LE(p + 28), le = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + ln);
    itens.set(nome, { metodo, comp, tam, local });
    p += 46 + ln + le + lc;
  }
  let usado = 0;
  return {
    nomes: () => [...itens.keys()],
    tem: nome => itens.has(nome),
    ler(nome) {
      const it = itens.get(nome);
      if (!it) return null;
      if (it.tam > TETO_ZIP || usado + it.tam > TETO_ZIP) throw new ErroFerramenta('O documento é grande demais para ler aqui.', 'arquivo-grande');
      const lh = it.local;
      if (buf.readUInt32LE(lh) !== 0x04034b50) throw new ErroFerramenta('O arquivo não é um documento válido (zip corrompido).', 'arquivo-formato');
      const ini = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
      const dados = buf.subarray(ini, ini + it.comp);
      let out;
      if (it.metodo === 0) out = dados;
      else if (it.metodo === 8) out = zlib.inflateRawSync(dados, { maxOutputLength: Math.max(1024, TETO_ZIP - usado) });
      else throw new ErroFerramenta('O documento usa uma compressão que não sei abrir.', 'arquivo-formato');
      usado += out.length;
      return out.toString('utf8');
    },
  };
}

function entidades(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k === 'lt') return '<'; if (k === 'gt') return '>'; if (k === 'amp') return '&'; if (k === 'quot') return '"'; if (k === 'apos') return "'";
    const cp = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m;
  });
}
const semTags = s => entidades(s.replace(/<[^>]+>/g, ''));
const arrumar = s => s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

function docx(z) {
  const xml = z.ler('word/document.xml');
  if (!xml) throw new ErroFerramenta('O .docx não tem o texto principal.', 'arquivo-formato');
  return arrumar(semTags(xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, ' | ').replace(/<\/w:tr>/g, '\n')));
}

function pptx(z) {
  const slides = z.nomes().filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  return slides.map((n, i) => `## Slide ${i + 1}\n` + arrumar(semTags(z.ler(n).replace(/<\/a:p>/g, '\n')))).join('\n\n');
}

function odf(z) {
  const xml = z.ler('content.xml');
  if (!xml) throw new ErroFerramenta('O documento não tem o conteúdo principal.', 'arquivo-formato');
  return arrumar(semTags(xml.replace(/<\/text:p>\s*<\/table:table-cell>/g, '</table:table-cell>').replace(/<text:tab\/>/g, '\t').replace(/<text:line-break\/>/g, '\n').replace(/<\/text:p>/g, '\n').replace(/<\/table:table-cell>/g, ' | ').replace(/<\/table:table-row>/g, '\n').replace(/<table:table table:name="([^"]*)"/g, '\n## Planilha: $1\n<x')));
}

function colunaNum(ref) { let n = 0; for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }

function xlsx(z, maxLinhas = 400) {
  const ss = [];
  const sx = z.ler('xl/sharedStrings.xml');
  if (sx) for (const m of sx.matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(semTags(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '')));
  const wb = z.ler('xl/workbook.xml') || '';
  const rels = z.ler('xl/_rels/workbook.xml.rels') || '';
  const alvo = {};
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = m[1].match(/\bId="([^"]+)"/)?.[1], t = m[1].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && t) alvo[id] = t.replace(/^\/?xl\//, '').replace(/^\//, '');
  }
  const planilhas = [];
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const nome = entidades(m[1].match(/\bname="([^"]*)"/)?.[1] || 'Planilha');
    const rid = m[1].match(/\br:id="([^"]+)"/)?.[1];
    const est = m[1].match(/\bstate="([^"]+)"/)?.[1];
    if (rid && alvo[rid]) planilhas.push({ nome, caminho: 'xl/' + alvo[rid], oculta: est && est !== 'visible' });
  }
  const partes = [];
  let linhasTot = 0;
  for (const p of planilhas) {
    const xml = z.ler(p.caminho);
    if (!xml) continue;
    const linhas = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (linhasTot >= maxLinhas) break;
      const cel = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = c[1], corpo = c[2] || '';
        const ref = at.match(/\br="([A-Z]+)\d+"/)?.[1];
        const t = at.match(/\bt="([^"]+)"/)?.[1];
        let v = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        if (t === 's') v = ss[+v] ?? '';
        else if (t === 'inlineStr') v = semTags(corpo.match(/<is>([\s\S]*?)<\/is>/)?.[1] || '');
        else if (t === 'b') v = v === '1' ? 'VERDADEIRO' : 'FALSO';
        else if (v != null) v = entidades(v);
        if (v == null || v === '') continue;
        const col = ref ? colunaNum(ref) : cel.length + 1;
        while (cel.length < col - 1) cel.push('');
        cel[col - 1] = String(v).replace(/\s+/g, ' ').trim();
      }
      if (cel.some(x => x)) { linhas.push(cel.join(' | ')); linhasTot++; }
    }
    partes.push(`## Planilha: ${p.nome}${p.oculta ? ' (oculta)' : ''}\n${linhas.join('\n') || '(vazia)'}`);
    if (linhasTot >= maxLinhas) { partes.push(`[parei em ${maxLinhas} linhas]`); break; }
  }
  return partes.join('\n\n') + '\n(datas do Excel aparecem como número de série; 45000 ≈ 15/03/2023)';
}

async function pdf(buf) {
  const { getDocumentProxy, extractText } = await import('unpdf');
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const total = doc.numPages;
  const { text } = await extractText(doc, { mergePages: false });
  const paginas = text.slice(0, 60).map((t, i) => `## Página ${i + 1}\n${String(t).replace(/[ \t]+/g, ' ').trim()}`);
  if (total > 60) paginas.push(`[o PDF tem ${total} páginas; li as 60 primeiras]`);
  const tudo = paginas.join('\n\n');
  if (!tudo.replace(/## Página \d+/g, '').trim()) return `(o PDF tem ${total} página${total === 1 ? '' : 's'} sem texto: provavelmente é imagem escaneada)`;
  return tudo;
}

function texto(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch (_) { return new TextDecoder('windows-1252').decode(buf); }   // não é UTF-8 válido: CSV antigo do WinThor/Excel
}

export const TEXTO = new Set(['txt', 'md', 'csv', 'tsv', 'json', 'log', 'xml', 'html', 'htm', 'sql', 'py', 'js', 'mjs', 'ts', 'css', 'ini', 'yaml', 'yml', 'bat', 'ps1', 'cfg', 'conf', 'rtf']);
export const SUPORTADOS = new Set([...TEXTO, 'docx', 'xlsx', 'xlsm', 'pptx', 'odt', 'ods', 'pdf']);

export async function extrairTexto(buf, ext) {
  if (TEXTO.has(ext)) {
    const t = texto(buf);
    if (ext === 'html' || ext === 'htm') return arrumar(semTags(t.replace(/<(style|script)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')));
    if (ext === 'rtf') return t.replace(/\\par[d]?/g, '\n').replace(/\{\\\*[^}]*\}/g, '').replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').trim();
    return t;
  }
  if (ext === 'pdf') return pdf(buf);
  const z = abrirZip(buf);
  if (ext === 'docx') return docx(z);
  if (ext === 'xlsx' || ext === 'xlsm') return xlsx(z);
  if (ext === 'pptx') return pptx(z);
  if (ext === 'odt' || ext === 'ods') return odf(z);
  throw new ErroFerramenta(`Não sei extrair texto de .${ext}.`, 'arquivo-formato');
}
