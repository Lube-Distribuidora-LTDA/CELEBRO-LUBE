/* Cérebro da Lube — servidor/ferramentas/planilha.js
   criar_planilha — uma planilha do Excel (.xlsx) na pasta do Jarvis (JARVIS\Planilhas), pelo exceljs 4.4.0, carregado só
   no primeiro uso (frio leva ~1,7 s). Os dados vêm de uma consulta ao DATA WAREHOUSE (as travas do consultar_dados, em
   servidor/banco.js) OU de uma lista que o modelo monta (colunas + linhas). Criar é livre: nunca grava por cima.
   - Cabeçalho negrito branco sobre o azul da Lube, filtro, cabeçalho congelado, largura pelo maior texto.
   - Números como número, data como data (Date.UTC: a data não anda com o fuso), dinheiro "R$", percentual (fração).
   - Texto fica texto: "000123" e "=1+1" nunca viram número nem fórmula.
   - Linha Total com SUBTOTAL(9, …) (respeita o filtro) e o resultado já calculado (outros leitores veem o número).
   Contrato em docs/JARVIS-ACOES.md §5.4. */
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { nomeSeguro, agoraSP } from './pasta.js';
import { ErroFerramenta, cortar } from '../util.js';

export const TIPOS = ['texto', 'inteiro', 'numero', 'dinheiro', 'percentual', 'data', 'data_hora', 'codigo'];
const FMT = {
  data: 'dd/mm/yyyy', data_hora: 'dd/mm/yyyy hh:mm', dinheiro: '"R$" #,##0.00', inteiro: '#,##0', numero: '#,##0.00',
  percentual: '0.0%', texto: '@', codigo: '0',
};
// como o tipo aparece no cartão (o Júlio vê quando o Jarvis errou)
export const NOME_TIPO = Object.freeze({
  texto: 'texto', inteiro: 'inteiro', numero: 'número', dinheiro: 'R$', percentual: '%', data: 'data', data_hora: 'data e hora', codigo: 'código',
});
// dinheiro pelo título: palavra inteira ("Total de pedidos" e "Peso total" não são dinheiro; "Valor total" é), e os nomes
// do WinThor (VLTOTAL, VLVENDA, PVENDA)
const RX_DINHEIRO = /(?<![\p{L}\p{N}])(valor|valores|vendas?|vlr?|pre[cç]os?|custos?|receitas?|faturamento|frete|descontos?|comiss[aã]o|comiss[oõ]es|r\$|reais|ticket)(?![\p{L}\p{N}])|^(vl|pvenda|pcusto)[a-z_]*$/iu;
/* Número que é código ou rótulo (filial, produto, RCA, pedido, nota, ano, mês, CNPJ…): sem soma no Total e sem ponto de
   milhar ("Filial 1+7+10+11+12 = 41" e "Código 12.345" não fazem sentido). Plural é contagem ("Pedidos", "Notas"). */
const RX_CODIGO = /^(c[oó]d(igo)?|id|num|matr[ií]cula|cnpj|cpf|cep|ano|m[eê]s|filial|rca|pedido|nota|nf|nfe|lote|seq)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(c[oó]digo|n[uú]mero d[oa])(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])n[º°]|^(cod|num)[a-z_]+$|[_ ]id$/iu;
export const ehCodigo = (titulo) => RX_CODIGO.test(String(titulo || '').trim());
const AZUL_LUBE = 'FF2A41C8';
const MAX_LINHAS = 50000;
const MAX_CELULAS = 1000000;         // 50 mil linhas × 20 colunas (o escritor em fluxo segura isso em ~150 MB)
const MAX_TEXTO_CELULA = 32000;      // o Excel aceita até 32.767 caracteres por célula

let excel = null;
function carregarExcel() {
  if (!excel) excel = import('exceljs').then(m => m.default || m).catch(e => { excel = null; throw e; });
  return excel;
}

/* ---------- tipo de cada coluna ---------- */
// OID do Postgres (r.tipos, quando o banco devolver) → tipo
function tipoPorOid(oid, titulo) {
  if (oid === 20 || oid === 21 || oid === 23) return ehCodigo(titulo) ? 'codigo' : 'inteiro';
  if (oid === 700 || oid === 701 || oid === 1700 || oid === 790) return RX_DINHEIRO.test(titulo) ? 'dinheiro' : 'numero';
  if (oid === 1082) return 'data';
  if (oid === 1114 || oid === 1184) return 'data_hora';
  if (oid === 16 || oid === 25 || oid === 1043 || oid === 1042 || oid === 18 || oid === 19) return 'texto';
  return null;
}
const RX_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RX_DATA_HORA = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/;
// sem tipo: pelos valores (até 500 preenchidos)
function tipoPelosValores(valores, titulo) {
  let n = 0, nums = 0, ints = 0, datas = 0, horas = 0;
  for (const v of valores) {
    if (v == null || v === '') continue;
    n++;
    if (typeof v === 'number' && Number.isFinite(v)) { nums++; if (Number.isInteger(v)) ints++; }
    else if (typeof v === 'string' && RX_DATA.test(v)) datas++;
    else if (typeof v === 'string' && RX_DATA_HORA.test(v)) horas++;
    if (n >= 500) break;
  }
  if (!n) return 'texto';
  if (nums === n) return ints === n ? (ehCodigo(titulo) ? 'codigo' : 'inteiro') : (RX_DINHEIRO.test(titulo) ? 'dinheiro' : 'numero');
  if (datas === n) return 'data';
  if (datas + horas === n) return 'data_hora';
  return 'texto';
}

/* todos os valores preenchidos da coluna (até 2.000) são números sem casa decimal? */
function todosInteiros(linhas, i) {
  let n = 0;
  for (const l of linhas) {
    const v = l[i];
    if (v == null || v === '') continue;
    const x = numeroDe(v);
    if (x == null || !Number.isInteger(x)) return false;
    if (++n >= 2000) break;
  }
  return n > 0;
}

/* ---------- valores ---------- */
/** "1.234,56", "R$ 1.234,56", "1234.5", "18,3%" → número (percentual vira fração). null = não é número. */
export function numeroDe(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/^R\$\s*/i, '').replace(/[\s ]/g, '');
  const pct = s.endsWith('%');
  if (pct) s = s.slice(0, -1);
  if (!/^[-+]?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const ultPonto = s.lastIndexOf('.'), ultVirg = s.lastIndexOf(',');
  if (ultPonto >= 0 && ultVirg >= 0) s = ultVirg > ultPonto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (ultVirg >= 0) s = (s.match(/,/g).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.'));
  else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // "1.234.567": milhar do jeito brasileiro
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}
/** "2026-10-01", "01/10/2026", "2026-10-01 14:55[:03]" → Date em UTC com a hora de parede (o Excel guarda sem fuso). */
export function dataDe(v, comHora) {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let a, m, d, h = 0, mi = 0, se = 0, x;
  if ((x = s.match(RX_DATA_HORA)) || (x = s.match(RX_DATA))) { [a, m, d] = [+x[1], +x[2], +x[3]]; if (x[4] != null) { h = +x[4]; mi = +x[5]; se = +(x[6] || 0); } }
  else if ((x = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/))) { [d, m, a] = [+x[1], +x[2], +x[3]]; if (x[4] != null) { h = +x[4]; mi = +x[5]; se = +(x[6] || 0); } }
  else return null;
  if (a < 1900 || a > 9999 || m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) return null;
  const dt = new Date(Date.UTC(a, m - 1, d, comHora ? h : 0, comHora ? mi : 0, comHora ? se : 0));
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== m - 1) return null;   // 31/02 não existe
  return dt;
}
function converter(v, tipo) {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (tipo === 'texto') return cortar(typeof v === 'string' ? v : String(v), MAX_TEXTO_CELULA);
  // código com zero na frente ("000123") fica texto: como número, o zero sumiria
  if (tipo === 'codigo' && typeof v === 'string' && /^0\d/.test(v.trim())) return cortar(v.trim(), MAX_TEXTO_CELULA);
  if (tipo === 'data' || tipo === 'data_hora') return dataDe(v, tipo === 'data_hora') ?? cortar(String(v), MAX_TEXTO_CELULA);
  const n = numeroDe(v);
  return n == null ? cortar(String(v), MAX_TEXTO_CELULA) : n;   // o que não é número fica como veio (texto)
}

/* ---------- como aparece no cartão (pt-BR) e na largura da coluna ---------- */
const F_DINHEIRO = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const F_INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const F_NUMERO = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const F_PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dois = n => String(n).padStart(2, '0');
function mostrar(v, tipo) {
  if (v == null) return '';
  if (v instanceof Date) {
    const d = `${dois(v.getUTCDate())}/${dois(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
    return tipo === 'data_hora' ? `${d} ${dois(v.getUTCHours())}:${dois(v.getUTCMinutes())}` : d;
  }
  if (typeof v === 'number') {
    if (tipo === 'dinheiro') return F_DINHEIRO.format(v).replace(/ /g, ' ');
    if (tipo === 'percentual') return F_PCT.format(v).replace(/ /g, ' ');
    if (tipo === 'inteiro') return F_INTEIRO.format(v);
    if (tipo === 'numero') return F_NUMERO.format(v);
    return String(v);
  }
  return String(v);
}

/* nome de aba que o Excel aceita: até 31 caracteres, sem [ ] : * ? / \, sem apóstrofo nas pontas, nunca "History" */
function nomeAba(aba) {
  let s = String(aba || '').replace(/[[\]:*?/\\]/g, ' ').replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '');
  s = Array.from(s).slice(0, 31).join('').trim();
  if (!s) s = 'Dados';
  if (/^history$/i.test(s)) s = 'History_';
  return s;
}

/**
 * Monta a planilha (puro, sem disco): {buf, tipos, linhas, colunas, amostra}. Exportado para o teste.
 * titulos: [texto]; linhas: [[valor]]; tiposPedidos: [tipo|null] (o que veio de colunas/formatos); oids: [OID|undefined].
 */
export async function montarPlanilha({ titulos, linhas, tiposPedidos = [], oids = [], aba, total = true }) {
  const ExcelJS = await carregarExcel();
  const nc = titulos.length;
  const tipos = titulos.map((t, i) => {
    const pedido = tiposPedidos[i] || null;
    let tp = pedido || tipoPorOid(oids[i], t) || tipoPelosValores(linhas.map(l => l[i]), t);
    if (tp === 'numero' || tp === 'inteiro') {
      // o numeric do Postgres (uma soma de quantidades) sem nenhuma casa: inteiro; e número que é código ou rótulo pelo
      // título (filial, produto, RCA, ano): código, sem soma e sem ponto de milhar
      const inteiros = tp === 'inteiro' || todosInteiros(linhas, i);
      if (inteiros && ehCodigo(t)) tp = 'codigo';
      else if (tp === 'numero' && !pedido && inteiros) tp = 'inteiro';
    }
    return tp;
  });
  const linha = (l) => Array.from({ length: nc }, (_, i) => converter(l[i], tipos[i]));
  // largura pelo maior texto (cabeçalho e as primeiras 3 mil linhas, já formatados), entre 8 e 60
  const primeiras = linhas.slice(0, 3000).map(linha);
  const larguras = titulos.map((t, i) => {
    let larg = Array.from(String(t)).length + 3;   // + a setinha do filtro
    for (const l of primeiras) larg = Math.max(larg, Array.from(mostrar(l[i], tipos[i])).length);
    return Math.min(60, Math.max(8, larg + 2));
  });
  // o escritor em fluxo: 50 mil × 12 em ~90 MB de memória (o Workbook comum passava de 900 MB, medido em 2026-10-20)
  const pedacos = [];
  const saida = new PassThrough();
  saida.on('data', c => pedacos.push(c));
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: saida, useSharedStrings: true, useStyles: true });
  wb.creator = 'Jarvis da Lube';
  wb.created = new Date();
  const ws = wb.addWorksheet(nomeAba(aba), { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = titulos.map((t, i) => ({ header: t, key: `c${i}`, width: larguras[i], style: { numFmt: FMT[tipos[i]] } }));
  const ultima = linhas.length + 1;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ultima), column: nc } };
  const cab = ws.getRow(1);
  cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_LUBE } };
  cab.alignment = { vertical: 'middle' };
  cab.height = 20;
  for (let i = 1; i <= nc; i++) cab.getCell(i).numFmt = 'General';
  cab.commit();
  const somaveis = tipos.map(t => t === 'dinheiro' || t === 'inteiro');
  const somas = new Array(nc).fill(0);
  for (let k = 0; k < linhas.length; k++) {
    const l = k < primeiras.length ? primeiras[k] : linha(linhas[k]);
    for (let i = 0; i < nc; i++) if (somaveis[i] && typeof l[i] === 'number') somas[i] += l[i];
    ws.addRow(l).commit();
  }
  // linha Total: só dinheiro e inteiro, com o resultado já calculado
  if (total && linhas.length > 0 && somaveis.some(Boolean)) {
    const rotulo = somaveis.indexOf(false);
    const tot = ws.addRow(titulos.map((_, i) => {
      if (somaveis[i]) {
        const L = ws.getColumn(i + 1).letter;
        return { formula: `SUBTOTAL(9,${L}2:${L}${ultima})`, result: Math.round(somas[i] * 100) / 100 };
      }
      return i === rotulo ? 'Total' : null;
    }));
    tot.font = { bold: true };
    if (rotulo >= 0) tot.getCell(rotulo + 1).numFmt = 'General';
    tot.commit();
  }
  ws.commit();
  await wb.commit();
  const buf = Buffer.concat(pedacos);
  const amostra = primeiras.slice(0, 8).map(l => l.slice(0, 6).map((v, i) => cortar(mostrar(v, tipos[i]), 60)));
  return { buf, tipos, linhas: linhas.length, colunas: nc, amostra };
}

export const criarPlanilha = {
  nome: 'criar_planilha',
  descricao: 'Cria uma planilha do Excel (.xlsx) na pasta do Jarvis (JARVIS\\Planilhas), com cabeçalho, filtro, cabeçalho congelado, números como número, datas como data e uma linha Total. Passe sql (um SELECT do DATA WAREHOUSE, com as mesmas travas do consultar_dados) OU colunas + linhas. Livre, sem aprovação; nunca grava por cima. Agregue no SQL quando der; até 50 mil linhas. Percentual vai como fração (0,183 = 18,3%). Número que é código (filial, produto, RCA, pedido, ano) vai como codigo: sem soma e sem ponto de milhar. Mostra um cartão com a prévia e o tipo de cada coluna.',
  schema: {
    type: 'object',
    properties: {
      nome: { type: 'string', minLength: 1, maxLength: 80, description: 'O nome da planilha (vira o nome do arquivo, com a data de hoje).' },
      aba: { type: 'string', maxLength: 31, description: 'Opcional: o nome da aba (padrão "Dados").' },
      sql: { type: 'string', minLength: 1, maxLength: 20000, description: 'Um SELECT (ou WITH … SELECT) com schema.tabela. Use os nomes das colunas do jeito que devem aparecer (as "Valor da venda").' },
      colunas: {
        type: 'array', maxItems: 60,
        items: {
          type: 'object',
          properties: {
            titulo: { type: 'string', maxLength: 60 },
            tipo: { type: 'string', enum: TIPOS },
          },
          required: ['titulo'],
          additionalProperties: false,
        },
        description: 'Sem sql: as colunas, com o tipo de cada uma (texto, inteiro, numero, dinheiro, percentual, data, data_hora, codigo).',
      },
      linhas: {
        type: 'array', maxItems: 5000,
        items: { type: 'array', maxItems: 60, items: { type: ['string', 'number', 'null'] } },
        description: 'Sem sql: as linhas, cada uma com os valores na ordem das colunas. Data como "2026-10-20".',
      },
      formatos: { type: 'object', description: 'Opcional: {"nome da coluna": tipo} para trocar o tipo de uma coluna (vale também para o sql).' },
      total: { type: 'boolean', description: 'Opcional: false para não pôr a linha Total (padrão true; soma as colunas de dinheiro e inteiro).' },
    },
    required: ['nome'],
    additionalProperties: false,
  },
  rotulo: 'Criando a planilha',
  prazoMs: 120000,
  async executar({ nome, aba, sql, colunas, linhas, formatos, total = true }, ctx) {
    const P = ctx && ctx.jarvis;
    if (!P) throw new ErroFerramenta('A pasta do Jarvis não está ligada neste computador agora.', 'jarvis-sem-pasta');
    if (sql && (colunas || linhas)) throw new ErroFerramenta('Passe sql OU colunas + linhas, não os dois.', 'planilha');
    if (!sql && !(colunas && colunas.length)) throw new ErroFerramenta('Falta de onde vêm os dados: passe sql, ou colunas + linhas.', 'planilha');
    if (formatos != null && (typeof formatos !== 'object' || Array.isArray(formatos))) throw new ErroFerramenta('formatos é um objeto {"coluna": tipo}.', 'planilha');
    for (const [k, v] of Object.entries(formatos || {})) {
      if (!TIPOS.includes(v)) throw new ErroFerramenta(`formatos: "${cortar(k, 40)}" tem o tipo "${cortar(String(v), 20)}", que não existe. Use: ${TIPOS.join(', ')}.`, 'planilha');
    }
    const avisos = [];
    let titulos, dados, oids = [], pedidos = [];
    if (sql) {
      if (!ctx.banco || !ctx.banco.configurado) throw new ErroFerramenta('O banco não está configurado no ENV deste computador (faltam as SUPABASE_DB_).', 'sem-banco');
      const r = await ctx.banco.consultar(sql, { signal: ctx.signal, maxLinhas: MAX_LINHAS, celulaMax: 2000 });
      titulos = (r.colunas || []).map((c, i) => String(c || `Coluna ${i + 1}`));
      dados = r.linhas || [];
      oids = Array.isArray(r.tipos) ? r.tipos : [];
      if (r.mais_linhas) avisos.push(`Vieram só as primeiras ${dados.length} linhas do banco: a planilha ficou incompleta. Agregue ou filtre no SQL.`);
      if (!titulos.length) throw new ErroFerramenta('A consulta não devolveu nenhuma coluna.', 'planilha');
    } else {
      titulos = colunas.map((c, i) => String(c.titulo || '').trim() || `Coluna ${i + 1}`);
      pedidos = colunas.map(c => c.tipo || null);
      dados = linhas || [];
      const longa = dados.findIndex(l => l.length > titulos.length);
      if (longa >= 0) throw new ErroFerramenta(`A linha ${longa + 1} tem ${dados[longa].length} valores, mas só há ${titulos.length} colunas.`, 'planilha');
    }
    const fora = Object.keys(formatos || {}).filter(k => !titulos.includes(k));
    if (fora.length) avisos.push(`Não achei a coluna ${fora.map(f => `"${cortar(f, 40)}"`).join(', ')} para o formato.`);
    titulos.forEach((t, i) => { if (formatos && formatos[t]) pedidos[i] = formatos[t]; });
    if (dados.length * titulos.length > MAX_CELULAS) {
      const cabe = Math.max(1, Math.floor(MAX_CELULAS / titulos.length));
      avisos.push(`A planilha passaria de ${MAX_CELULAS.toLocaleString('pt-BR')} células: ficaram as primeiras ${cabe.toLocaleString('pt-BR')} linhas.`);
      dados = dados.slice(0, cabe);
    }
    if (ctx.signal?.aborted) throw ctx.signal.reason ?? new Error('cancelado');
    const m = await montarPlanilha({ titulos, linhas: dados, tiposPedidos: pedidos, oids, aba, total });
    if (ctx.signal?.aborted) throw ctx.signal.reason ?? new Error('cancelado');
    const pasta = await P.garantir('Planilhas');
    const base = `${nomeSeguro(String(nome).replace(/\.xlsx$/i, ''), 60)} — ${agoraSP().data}`;
    let abs = null;
    for (let volta = 0; volta < 3 && !abs; volta++) {
      const livre = await P.nomeLivre(pasta, base, 'xlsx');
      try { abs = await P.escreverTexto(livre, m.buf, { novo: true }); }
      catch (e) { if (!(e instanceof ErroFerramenta && e.codigo === 'jarvis-existe')) throw e; }
    }
    if (!abs) throw new ErroFerramenta('Já existe uma planilha com esse nome.', 'jarvis-existe');
    const rel = P.relativo(abs);
    const aviso = avisos.length ? avisos.join(' ') : undefined;
    try {
      ctx.emitir?.('cartao', {
        tipo: 'planilha',
        dados: {
          titulo: cortar(String(nome), 80), arquivo: { id: P.registrar(abs), nome: path.basename(abs), pasta_rel: P.relativo(path.dirname(abs)) },
          colunas: titulos.slice(0, 6).map(t => cortar(t, 40)), tipos: m.tipos.slice(0, 6).map(t => NOME_TIPO[t] || t), linhas: m.amostra, total_linhas: m.linhas, total_colunas: m.colunas, aviso,
        },
      });
    } catch (_) { /* a tela é extra */ }
    return {
      conteudo: { criada: rel, linhas: m.linhas, colunas: m.colunas, tipos: Object.fromEntries(titulos.slice(0, 60).map((t, i) => [t, m.tipos[i]])), aviso },
      resumo: `${cortar(path.basename(abs), 50)} · ${m.linhas} linha${m.linhas === 1 ? '' : 's'}`,
    };
  },
};
