/* Cérebro da Lube — servidor/util.js: pequenas utilidades sem dependência (texto, hora de Brasília, prazos). */

export const FUSO = 'America/Sao_Paulo';

/** minúsculas, sem acento, espaços colapsados */
export function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

export function cortar(s, max) {
  s = String(s ?? '');
  return s.length > max ? s.slice(0, Math.max(0, max - 1)) + '…' : s;
}

/** Erro com mensagem que pode ir para o modelo e para a tela (português, sem detalhe interno). */
export class ErroFerramenta extends Error {
  constructor(mensagem, codigo = 'erro') { super(mensagem); this.codigo = codigo; }
}

const fmtPartes = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function partes(d) {
  const o = {};
  for (const p of fmtPartes.formatToParts(d)) o[p.type] = p.value;
  return o;   // {day, month, year, hour, minute}
}

/** Data em Brasília do jeito curto: "hoje às 07:55", "ontem às 23:50", "13/10 às 02:50", "13/10/2025 às 02:50". */
export function quandoSP(v, agora = new Date()) {
  if (v == null || v === '') return undefined;
  const d = v instanceof Date ? v : new Date(v);
  if (!Number.isFinite(d.getTime())) return undefined;
  const p = partes(d), h = partes(agora);
  const hora = `${p.hour}:${p.minute}`;
  const diaDe = x => Date.UTC(+x.year, +x.month - 1, +x.day);
  const dias = Math.round((diaDe(h) - diaDe(p)) / 864e5);
  if (dias === 0) return `hoje às ${hora}`;
  if (dias === 1) return `ontem às ${hora}`;
  if (dias === -1) return `amanhã às ${hora}`;
  if (p.year === h.year) return `${p.day}/${p.month} às ${hora}`;
  return `${p.day}/${p.month}/${p.year} às ${hora}`;
}

/** "quarta-feira, 15 de outubro de 2026, 14:32" (Brasília) */
export function agoraPorExtenso(agora = new Date()) {
  const data = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(agora);
  const p = partes(agora);
  return `${data}, ${p.hour}:${p.minute}`;
}

export function horaSP(agora = new Date()) {
  const p = partes(agora);
  return `${p.hour}:${p.minute}`;
}

/** AbortSignal que dispara com o do turno OU depois de ms. */
export function comPrazo(signal, ms) {
  const lista = [AbortSignal.timeout(ms)];
  if (signal) lista.push(signal);
  return AbortSignal.any(lista);
}

export function abortado(signal) {
  return !!(signal && signal.aborted);
}

/** Espera ms, ou rejeita se o sinal disparar. */
export function esperar(ms, signal) {
  return new Promise((res, rej) => {
    if (signal?.aborted) { rej(signal.reason ?? new Error('cancelado')); return; }
    const t = setTimeout(() => { signal?.removeEventListener('abort', ab); res(); }, ms);
    const ab = () => { clearTimeout(t); rej(signal.reason ?? new Error('cancelado')); };
    signal?.addEventListener('abort', ab, { once: true });
  });
}

/** Corre a promessa, mas rejeita na hora se o sinal disparar (a promessa original segue sozinha e é ignorada). */
export function corrida(promessa, signal, aoAbortar) {
  if (!signal) return promessa;
  if (signal.aborted) { try { aoAbortar?.(); } catch (_) { /* nada */ } return Promise.reject(signal.reason ?? new Error('cancelado')); }
  return new Promise((res, rej) => {
    const ab = () => { try { aoAbortar?.(); } catch (_) { /* nada */ } rej(signal.reason ?? new Error('cancelado')); };
    signal.addEventListener('abort', ab, { once: true });
    promessa.then(v => { signal.removeEventListener('abort', ab); res(v); },
      e => { signal.removeEventListener('abort', ab); rej(e); });
  });
}

/* Encolhe os textos mais longos de um objeto (sem quebrar o JSON) até o total caber. */
function encolher(obj, max) {
  let o = JSON.parse(JSON.stringify(obj));
  for (let volta = 0; volta < 6; volta++) {
    const s = JSON.stringify(o);
    if (s.length <= max) return s;
    const textos = [];
    (function achar(v, dono, chave) {
      if (typeof v === 'string' && v.length > 200) textos.push({ dono, chave, n: v.length });
      else if (Array.isArray(v)) v.forEach((x, i) => achar(x, v, i));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) achar(x, v, k);
    })(o, null, null);
    if (!textos.length) break;
    textos.sort((a, b) => b.n - a.n);
    const sobra = s.length - max + 200;
    const alvo = textos[0];
    const novo = Math.max(200, alvo.n - sobra);
    if (alvo.dono) alvo.dono[alvo.chave] = alvo.dono[alvo.chave].slice(0, novo) + ' […cortado]';
    else o = o.slice(0, novo);
  }
  const s = JSON.stringify(o);
  return s.length <= max ? s : null;
}

/** JSON para tool_result, com teto de tamanho: encolhe os textos longos para o JSON continuar válido. */
export function jsonParaModelo(obj, max = 16000) {
  if (typeof obj === 'string') return obj.length <= max ? obj : obj.slice(0, max) + `\n[cortado: ${obj.length} caracteres no total]`;
  const s = JSON.stringify(obj);
  if (s.length <= max) return s;
  const menor = encolher(obj, max);
  if (menor) return menor;
  return JSON.stringify({ aviso: `O resultado tinha ${s.length} caracteres e não coube. Peça um pedaço menor.`, inicio: s.slice(0, max - 200) });
}

export function log(...a) {
  const p = partes(new Date());
  console.log(`[${p.hour}:${p.minute}]`, ...a);
}
