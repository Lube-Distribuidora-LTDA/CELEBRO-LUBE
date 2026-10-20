/* Cérebro da Lube — servidor/pessoal.js
   Nota com dado de pessoa (salário, IR, plano de saúde, afastamento): as que levam "repositorio: nao" no frontmatter e as
   da lista ferramentas/fora_do_repositorio.txt (a mesma regra do backup no GitHub, ferramentas/atualizar_repositorio.py).
   O construtor do Jarvis não lê essas notas, e o Jarvis não copia nenhuma delas para JARVIS\Projetos: o que está lá vira
   página, dados.js e print, e abre no navegador. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LISTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'ferramentas', 'fora_do_repositorio.txt');
const chave = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '').normalize('NFC').toLowerCase();
let cache = null;   // {mtime, itens}

/** Os caminhos (relativos ao vault, com /) da lista fora_do_repositorio.txt. */
export function listaForaDoRepositorio() {
  let st = null;
  try { st = fs.statSync(LISTA); } catch (_) { return new Set(); }
  if (cache && cache.mtime === st.mtimeMs) return cache.itens;
  let t = '';
  try { t = fs.readFileSync(LISTA, 'utf8'); } catch (_) { return new Set(); }
  const itens = new Set(t.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(chave));
  cache = { mtime: st.mtimeMs, itens };
  return itens;
}

/** O frontmatter diz "repositorio: nao" (ou false, no)? fm: o objeto já lido (o grafo do vault), ou o texto da nota. */
export function marcadaPessoal({ fm = null, texto = '' } = {}) {
  if (fm && typeof fm === 'object') {
    for (const [k, v] of Object.entries(fm)) {
      if (!/^reposit[oó]rio$/i.test(k)) continue;
      if (v === false || /^(n[aã]o|false|no)$/i.test(String(v).trim())) return true;
    }
  }
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(String(texto || '').slice(0, 3000));
  return !!(m && /^reposit[oó]rio:\s*["']?(n[aã]o|false|no)["']?\s*$/mi.test(m[1]));
}

/** A nota (caminho relativo ao vault) tem dado de pessoa? */
export function notaPessoal({ caminho = '', fm = null, texto = '' } = {}) {
  if (caminho && listaForaDoRepositorio().has(chave(caminho))) return true;
  return marcadaPessoal({ fm, texto });
}

/** Um arquivo do disco (abs) é uma nota do vault com dado de pessoa? Lê só o começo dele. */
export function arquivoPessoal(abs, vaultDir) {
  if (!/\.md$/i.test(String(abs || ''))) return false;
  let rel = '';
  if (vaultDir) {
    const r = path.relative(path.resolve(vaultDir).toLowerCase(), path.resolve(abs).toLowerCase());
    if (r && !r.startsWith('..') && !path.isAbsolute(r)) rel = path.relative(path.resolve(vaultDir), path.resolve(abs));
  }
  let texto = '';
  try {
    const fd = fs.openSync(abs, 'r');
    try { const b = Buffer.alloc(3000); const n = fs.readSync(fd, b, 0, 3000, 0); texto = b.subarray(0, n).toString('utf8'); } finally { fs.closeSync(fd); }
  } catch (_) { texto = ''; }
  return notaPessoal({ caminho: rel, texto });
}
