/* Cérebro da Lube — servidor/vault.js
   O vault do Obsidian ao vivo: lê as notas (.md) da pasta, monta o grafo com o MESMO módulo do painel
   (web/js/dados.js: buildGraph, buscar, trecho, seguirLink) e vigia a pasta com fs.watch.
   Formato de /api/vault: {vaultName, files:[{path, text, size, mtime}]} — o que o dados.js já entende.
   Só leitura: nada aqui escreve no vault. */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import * as D from '../web/js/dados.js';
import { log } from './util.js';

const MAX_NOTAS = 5000;
const MAX_BYTES = 600000;   // o mesmo teto do lerPasta do painel

function ignorar(nome) {
  return nome.startsWith('.') || nome === 'node_modules';
}

async function listarMd(raiz) {
  const out = [];
  const fila = [''];
  while (fila.length && out.length < MAX_NOTAS) {
    const rel = fila.shift();
    let itens;
    try { itens = await fsp.readdir(path.join(raiz, rel), { withFileTypes: true }); } catch (_) { continue; }
    for (const it of itens) {
      if (ignorar(it.name)) continue;
      const r = rel ? `${rel}/${it.name}` : it.name;
      if (it.isDirectory()) fila.push(r);
      else if (it.isFile() && /\.md$/i.test(it.name)) out.push(r);
    }
  }
  return out;
}

/* O caminho longo da pasta. No Windows, o fs.watch derruba o processo (assert do libuv em fs-event.c) quando a pasta
   vem no formato curto 8.3 (ex.: GTIJUL~1.ALV): o caminho é resolvido antes de ler e de vigiar. */
function caminhoLongo(dir) {
  try { return fs.realpathSync.native(dir); } catch (_) { return path.resolve(dir); }
}

export function criarVault(dirPedido, { onMudou } = {}) {
  const dir = caminhoLongo(dirPedido);
  const vaultName = path.basename(dir);
  let cache = null;        // {vaultName, files, lidoEm}
  let lendo = null;
  let grafo = null, grafoDe = null;
  let watcher = null, pend = null, mudados = new Set(), religar = null;

  async function lerTudo() {
    const rels = await listarMd(dir);
    const files = [];
    for (let i = 0; i < rels.length; i += 32) {
      const lote = await Promise.all(rels.slice(i, i + 32).map(async rel => {
        const abs = path.join(dir, ...rel.split('/'));
        try {
          const st = await fsp.stat(abs);
          let text;
          if (st.size > MAX_BYTES) {
            const fh = await fsp.open(abs, 'r');
            try { const b = Buffer.alloc(MAX_BYTES); const { bytesRead } = await fh.read(b, 0, MAX_BYTES, 0); text = b.subarray(0, bytesRead).toString('utf8'); }
            finally { await fh.close(); }
          } else text = await fsp.readFile(abs, 'utf8');
          return { path: rel, text: text.replace(/^﻿/, ''), size: st.size, mtime: Math.floor(st.mtimeMs) };
        } catch (_) { return null; }   // nota sumiu no meio da leitura (o OneDrive sincronizando)
      }));
      for (const f of lote) if (f) files.push(f);
    }
    return { vaultName, files, lidoEm: Date.now() };
  }

  async function ler() {
    if (cache) return cache;
    if (!lendo) lendo = lerTudo().then(d => { cache = d; return d; }).finally(() => { lendo = null; });
    return lendo;
  }

  async function obterGrafo() {
    const d = await ler();
    if (grafo && grafoDe === d) return grafo;
    grafo = D.buildGraph(d.files, d.vaultName);
    grafoDe = d;
    return grafo;
  }

  function avisar() {
    const lista = [...mudados];
    mudados = new Set();
    cache = null;
    try { onMudou?.(lista); } catch (e) { log('vault: erro ao avisar mudança', e?.message); }
  }

  function vigiar() {
    try {
      watcher = fs.watch(caminhoLongo(dir), { recursive: true }, (_ev, nome) => {
        const rel = String(nome || '').replace(/\\/g, '/');
        if (rel && (rel.split('/').some(ignorar) || !/\.md$/i.test(rel))) return;
        if (rel) mudados.add(rel);
        clearTimeout(pend);
        pend = setTimeout(avisar, 300);
      });
      watcher.on('error', e => {
        log('vault: o vigia da pasta parou', e?.code || '', '— tento de novo em 30 s');
        try { watcher.close(); } catch (_) { /* nada */ }
        watcher = null;
        religar = setTimeout(vigiar, 30000);
      });
    } catch (e) {
      log('vault: não consegui vigiar a pasta', e?.code || '', '— tento de novo em 30 s');
      religar = setTimeout(vigiar, 30000);
    }
  }

  return {
    dir,
    vaultName,
    existe: () => { try { return fs.statSync(dir).isDirectory(); } catch (_) { return false; } },
    ler,
    grafo: obterGrafo,
    vigiar,
    parar() { clearTimeout(pend); clearTimeout(religar); try { watcher?.close(); } catch (_) { /* nada */ } },
    D,
  };
}
