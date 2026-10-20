/* Cérebro da Lube — servidor/banco.js
   Leitura do DATA WAREHOUSE (Supabase) com o usuário das ETLs (SUPABASE_DB_* do ENV).
   Esse usuário é DONO dos schemas: por isso toda leitura aqui roda numa transação READ ONLY, com statement_timeout,
   lock_timeout e search_path = pg_catalog, e termina em ROLLBACK. Nada é gravado.

   consultar(sql) — o SELECT que o Claude escreve passa por quatro travas, nesta ordem:
     1. texto: um comando só; começa por SELECT ou WITH; sem $ (dollar quoting); sem comando de escrita; sem os schemas
        proibidos (financeiro, auth, vault, storage, cron, net…) em lugar nenhum, nem dentro de texto; sem funções de
        sistema (pg_*, lo_*, dblink, *_to_xml, set_config, regclass…);
     2. EXPLAIN (VERBOSE): toda tabela, visão e função que o plano toca tem que estar nos schemas liberados
        (compras, comercial, reposicao, trade, core, saude) — visão que lê schema proibido também é recusada;
     3. a própria transação READ ONLY (o banco recusa qualquer escrita, até de função);
     4. protocolo estendido do Postgres (recusa mais de um comando) e cursor com FETCH de no máximo 201 linhas.
   saude.painel() e o catálogo de tabelas usam consultas fixas, escritas aqui. */
import fs from 'node:fs';
import pg from 'pg';
import { ErroFerramenta, corrida, log } from './util.js';

export const SCHEMAS_LIBERADOS = ['compras', 'comercial', 'reposicao', 'trade', 'core', 'saude'];
const SCHEMAS_PROIBIDOS = ['financeiro', 'auth', 'vault', 'storage', 'cron', 'net', 'extensions', 'information_schema',
  'pg_catalog', 'pg_toast', 'realtime', '_realtime', 'supabase_functions', 'supabase_migrations', 'graphql',
  'graphql_public', 'pgsodium', 'pgsodium_masks', 'pgbouncer'];
const RX_PROIBIDO = new RegExp(`\\b(${SCHEMAS_PROIBIDOS.join('|')})\\b`, 'i');
const RX_ESCRITA = /\b(insert|update|delete|merge|truncate|drop|alter|create|grant|revoke|copy|call|do|vacuum|analyze|refresh|lock|execute|prepare|deallocate|listen|notify|unlisten|reindex|cluster|discard|into|reset|checkpoint|security|import|load)\b/i;
// funções de sistema e as que executam SQL recebido como texto (ts_stat, ts_rewrite, *_to_xml): nem no texto, nem no plano
const RX_FUNCAO = /\b(pg_\w+|lo_\w+|dblink\w*|\w*_to_xml\w*|query_to_\w+|ts_stat|ts_rewrite|set_config|current_setting|to_regclass|regclass|regproc|regprocedure|regnamespace|txid_\w+|inet_\w+)\b/i;
// no plano, um schema proibido aparece qualificando um nome (financeiro.folha), também dentro de um texto constante que o
// planejador já juntou ('select … from ' || 'finan' || 'ceiro.folha' vira um texto só)
const RX_PROIBIDO_QUAL = new RegExp(`\\b(${SCHEMAS_PROIBIDOS.filter(x => x !== 'pg_catalog').join('|')})\\s*\\.\\s*["a-z_]`, 'i');
const MAX_LINHAS = 200;
const MAX_CELULA = 300;

/* ---------- Leitura léxica do SQL: comentários, textos e identificadores entre aspas ---------- */
/* Devolve {semComentarios, identificadores}: o primeiro é o SQL sem comentários (vai para o banco); o segundo, o mesmo
   SQL com cada texto '...' trocado por '' e cada "Identificador" sem as aspas (para procurar palavras proibidas). */
export function lerSql(sql) {
  const s = String(sql ?? '');
  let semC = '', ident = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '-' && d === '-') {                          // comentário de linha
      while (i < n && s[i] !== '\n') i++;
      semC += ' '; ident += ' ';
      continue;
    }
    if (c === '/' && d === '*') {                          // comentário de bloco (no Postgres, aninhável)
      let prof = 1; i += 2;
      while (i < n && prof > 0) {
        if (s[i] === '/' && s[i + 1] === '*') { prof++; i += 2; }
        else if (s[i] === '*' && s[i + 1] === '/') { prof--; i += 2; }
        else i++;
      }
      if (prof > 0) throw new ErroFerramenta('A consulta tem um comentário /* sem fechar.', 'sql');
      semC += ' '; ident += ' ';
      continue;
    }
    if ((c === "'" || c === '"') && /u&$/i.test(semC.slice(-2))) {
      // U&'\0066inanceiro' e U&"\0070g_read_file" escondem o nome do filtro de texto: não são aceitos
      throw new ErroFerramenta('Não use U&\'…\' nem U&"…" (escapes Unicode) na consulta: escreva os nomes e textos por extenso.', 'sql');
    }
    if (c === "'") {                                       // texto; E'..' aceitaria barra invertida, que é recusada
      const anterior = semC.slice(-1);
      const comBarra = /[eE]/.test(anterior) && !/[\w$]/.test(semC.slice(-2, -1) || ' ');
      let j = i + 1, txt = "'";
      for (;;) {
        if (j >= n) throw new ErroFerramenta('A consulta tem um texto entre aspas sem fechar.', 'sql');
        const x = s[j];
        // E'\x66inanceiro' esconde o nome do filtro de texto: barra invertida dentro de E'…' não é aceita
        if (comBarra && x === '\\') throw new ErroFerramenta("Não use barra invertida dentro de E'…' (escapes) na consulta: escreva o texto por extenso.", 'sql');
        if (x === "'") { if (s[j + 1] === "'") { txt += "''"; j += 2; continue; } txt += "'"; j++; break; }
        txt += x; j++;
      }
      semC += txt; ident += "''"; i = j;
      continue;
    }
    if (c === '"') {                                       // identificador entre aspas
      let j = i + 1, nome = '';
      for (;;) {
        if (j >= n) throw new ErroFerramenta('A consulta tem um nome entre aspas duplas sem fechar.', 'sql');
        if (s[j] === '"') { if (s[j + 1] === '"') { nome += '"'; j += 2; continue; } j++; break; }
        nome += s[j]; j++;
      }
      semC += s.slice(i, j); ident += ' ' + nome + ' '; i = j;
      continue;
    }
    semC += c; ident += c; i++;
  }
  return { semComentarios: semC, identificadores: ident };
}

/** Confere o texto do SELECT (trava 1). Devolve o SQL limpo, pronto para o EXPLAIN. */
export function conferirSql(sql) {
  if (typeof sql !== 'string' || !sql.trim()) throw new ErroFerramenta('Mande o SELECT em texto.', 'sql');
  if (sql.length > 20000) throw new ErroFerramenta('A consulta é grande demais (máx. 20 mil caracteres).', 'sql');
  const { semComentarios, identificadores } = lerSql(sql);
  let limpo = semComentarios.trim();
  let ids = identificadores.trim();
  while (limpo.endsWith(';')) { limpo = limpo.slice(0, -1).trim(); ids = ids.replace(/;\s*$/, '').trim(); }
  if (ids.includes(';')) throw new ErroFerramenta('Mande um comando só (sem ";" no meio).', 'sql-multiplos');
  if (!/^\(*\s*(select|with)\b/i.test(ids)) throw new ErroFerramenta('Só consulta de leitura: comece por SELECT ou WITH.', 'sql-escrita');
  if (ids.includes('$')) throw new ErroFerramenta('Não use $ (dollar quoting nem parâmetros) na consulta.', 'sql');
  const proib = limpo.match(RX_PROIBIDO) || ids.match(RX_PROIBIDO);
  if (proib) {
    const nome = proib[1].toLowerCase();
    const msg = nome === 'financeiro'
      ? 'O schema financeiro (folha de pagamento) fica fora do Jarvis.'
      : `O schema ${nome} fica fora do Jarvis. Use só: ${SCHEMAS_LIBERADOS.join(', ')}.`;
    throw new ErroFerramenta(msg, 'sql-schema');
  }
  const esc = ids.match(RX_ESCRITA);
  if (esc) throw new ErroFerramenta(`A consulta tem "${esc[1].toUpperCase()}": o Jarvis só lê o banco, nunca grava.`, 'sql-escrita');
  const fn = ids.match(RX_FUNCAO);
  if (fn) throw new ErroFerramenta(`A função ou tipo "${fn[1]}" não é liberado nas consultas do Jarvis.`, 'sql-funcao');
  return limpo;
}

/* Trava 2: o que o plano toca. */
export function conferirPlano(plano) {
  const schemas = new Set();      // de tabelas e visões: só os liberados
  const funcoes = new Set();      // de funções: os liberados ou o pg_catalog (as perigosas já caíram na trava do texto)
  const RX_CHAMADA = /(?:^|[^\w."$])"?([a-z_][a-z0-9_$]*)"?\s*\.\s*"?([a-z_][a-z0-9_$]*)"?\s*\(/gi;
  const chamadas = s => { for (const m of s.matchAll(RX_CHAMADA)) funcoes.add(m[1].toLowerCase()); };
  (function andar(v) {
    if (Array.isArray(v)) { v.forEach(andar); return; }
    if (v && typeof v === 'object') {
      const sch = typeof v.Schema === 'string' ? v.Schema.toLowerCase() : null;
      if (sch) ('Function Name' in v && !('Relation Name' in v) ? funcoes : schemas).add(sch);
      for (const [k, x] of Object.entries(v)) {
        if (k === 'Schema') continue;
        if (typeof x === 'string') chamadas(x);
        else andar(x);
      }
    } else if (typeof v === 'string') chamadas(v);
  })(plano);
  const fora = [...[...schemas].filter(s => !SCHEMAS_LIBERADOS.includes(s)),
    ...[...funcoes].filter(s => !SCHEMAS_LIBERADOS.includes(s) && s !== 'pg_catalog')];
  // o plano mostra o nome real (sem escape) de cada função e os textos constantes já juntados: as mesmas travas do texto
  // valem aqui, em todos os campos menos o "Schema" (conferido acima; funções do pg_catalog são as comuns, como sum)
  const textos = [];
  (function coletar(v, chave) {
    if (Array.isArray(v)) { v.forEach(x => coletar(x, chave)); return; }
    if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) if (k !== 'Schema') coletar(x, k); return; }
    if (typeof v === 'string') textos.push(v.replace(/\bpg_catalog\s*\.\s*/gi, ''));
  })(plano, null);
  const tudo = textos.join('\n');
  const fn = tudo.match(RX_FUNCAO);
  if (fn) throw new ErroFerramenta(`A consulta chega na função "${fn[1]}", que não é liberada nas consultas do Jarvis.`, 'sql-funcao');
  const qual = tudo.match(RX_PROIBIDO_QUAL);
  if (qual) fora.push(qual[1].toLowerCase());
  if (fora.length) {
    const lista = [...new Set(fora)];
    const msg = lista.includes('financeiro')
      ? 'A consulta chega no schema financeiro (folha de pagamento), que fica fora do Jarvis.'
      : `A consulta toca ${lista.join(', ')}, que fica fora do Jarvis. Use só: ${SCHEMAS_LIBERADOS.join(', ')} (sempre com o schema na frente, ex.: compras.tabela).`;
    throw new ErroFerramenta(msg, 'sql-schema');
  }
  return [...schemas];
}

/* ---------- Valores para JSON curto ---------- */
const fmtTz = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const tipos = {
  getTypeParser(oid, formato) {
    if (formato === 'text' || formato === undefined) {
      if (oid === 20 || oid === 1700) return v => { const x = Number(v); return Number.isFinite(x) && Math.abs(x) < 1e15 ? x : v; };
      if (oid === 1082 || oid === 1114) return v => v;                       // date, timestamp: como o banco escreveu
      if (oid === 1184) return v => { const d = new Date(v); return Number.isFinite(d.getTime()) ? fmtTz.format(d) : v; };  // timestamptz em Brasília
    }
    return pg.types.getTypeParser(oid, formato);
  },
};
function celula(v, max = MAX_CELULA) {
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return fmtTz.format(v);
  if (Buffer.isBuffer(v)) return `[binário, ${v.length} bytes]`;
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
// a planilha (criar_planilha) pede mais linhas e células maiores; a conversa fica nas 200 linhas e 300 caracteres
const TETO_LINHAS = 100000, TETO_CELULA = 2000;

export function criarBanco(cfgBanco) {
  let pool = null;
  let painelCache = null, painelEm = 0, painelLendo = null;

  // TLS: com SUPABASE_DB_CA (caminho do certificado do Supabase, Project Settings › Database › SSL) o certificado do
  // servidor é conferido. Sem ele, como as ETLs (sslmode=require): cifrado, mas sem conferir (fica registrado no log).
  function opcoesSsl() {
    if (cfgBanco.ca) {
      let ca;
      try { ca = fs.readFileSync(cfgBanco.ca, 'utf8'); } catch (_) {
        throw new ErroFerramenta('O certificado do banco (SUPABASE_DB_CA no ENV) não foi encontrado neste computador.', 'sem-banco');
      }
      return { ca, rejectUnauthorized: true };
    }
    log('banco: certificado do Supabase não conferido (sem SUPABASE_DB_CA no ENV)');
    return { rejectUnauthorized: false };
  }

  function obterPool() {
    if (!cfgBanco) throw new ErroFerramenta('O banco (DATA WAREHOUSE) não está configurado: faltam as variáveis SUPABASE_DB_ no ENV.', 'sem-banco');
    if (!pool) {
      const { ca: _caminho, ...conexao } = cfgBanco;
      pool = new pg.Pool({
        ...conexao,
        ssl: opcoesSsl(),
        max: 3,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        query_timeout: 25000,
        keepAlive: true,
        application_name: 'cerebro-jarvis (leitura)',
        types: tipos,
      });
      pool.on('error', e => log('banco: conexão ociosa caiu', e?.code || ''));
    }
    return pool;
  }

  /** Abre uma transação só de leitura, roda fn(client) e desfaz tudo no fim. */
  async function emLeitura(fn, { signal, timeoutMs = 15000 } = {}) {
    // turno cancelado com a conexão ainda abrindo: quando ela chegar, volta para o pool (senão vazava uma das 3)
    const pedido = obterPool().connect();
    let cliente;
    try { cliente = await corrida(pedido, signal); }
    catch (e) { pedido.then(c => { try { c.release(); } catch (_) { /* nada */ } }, () => {}); throw e; }
    let estragado = false;
    const aoAbortar = () => { estragado = true; try { cliente.release(new Error('cancelado')); } catch (_) { /* já solto */ } };
    try {
      const r = await corrida((async () => {
        await cliente.query('BEGIN READ ONLY');
        await cliente.query(`SET LOCAL statement_timeout = ${Math.round(timeoutMs)}`);
        await cliente.query('SET LOCAL lock_timeout = 3000');
        await cliente.query('SET LOCAL idle_in_transaction_session_timeout = 30000');
        await cliente.query('SET LOCAL search_path = pg_catalog');
        return fn(cliente);
      })(), signal, aoAbortar);
      return r;
    } catch (e) {
      if (e && e.code === '57014') throw new ErroFerramenta(`A consulta passou de ${Math.round(timeoutMs / 1000)} segundos e foi cancelada. Tente uma consulta mais simples ou com filtro.`, 'sql-tempo');
      if (e && e.code === '25006') throw new ErroFerramenta('O banco recusou: a consulta tentou gravar, e o Jarvis só lê.', 'sql-escrita');
      if (e && e.code === '42601') throw new ErroFerramenta(`Erro de sintaxe no SQL: ${e.message}`, 'sql');
      if (e && typeof e.code === 'string' && /^(42|22|0A|21)/.test(e.code)) throw new ErroFerramenta(`O banco recusou a consulta: ${e.message}`, 'sql');
      throw e;
    } finally {
      if (!estragado) {
        try { await cliente.query('ROLLBACK'); cliente.release(); }
        catch (_) { try { cliente.release(true); } catch (__) { /* nada */ } }
      }
    }
  }

  /* maxLinhas e celulaMax: a planilha pede até 100 mil linhas e 2 mil caracteres por célula; as travas são as mesmas.
     tipos: o OID do Postgres de cada coluna (a planilha escolhe o formato: inteiro, número, data). */
  async function consultar(sql, { signal, maxLinhas = MAX_LINHAS, celulaMax = MAX_CELULA } = {}) {
    const limpo = conferirSql(sql);
    const nMax = Math.max(1, Math.min(TETO_LINHAS, Math.floor(Number(maxLinhas) || MAX_LINHAS)));
    const cMax = Math.max(20, Math.min(TETO_CELULA, Math.floor(Number(celulaMax) || MAX_CELULA)));
    return emLeitura(async c => {
      const ex = await c.query({ text: `EXPLAIN (VERBOSE, FORMAT JSON) ${limpo}`, queryMode: 'extended' });
      const plano = ex.rows?.[0]?.['QUERY PLAN'];
      const tocados = conferirPlano(plano);
      await c.query({ text: `DECLARE jarvis_c NO SCROLL CURSOR FOR ${limpo}`, queryMode: 'extended' });
      const r = await c.query({ text: `FETCH ${nMax + 1} FROM jarvis_c`, rowMode: 'array', queryMode: 'extended' });
      const colunas = (r.fields || []).map(f => f.name);
      const tipos = (r.fields || []).map(f => f.dataTypeID);
      const linhas = r.rows.slice(0, nMax).map(l => l.map(v => celula(v, cMax)));
      return { colunas, tipos, linhas, linhas_devolvidas: linhas.length, mais_linhas: r.rows.length > nMax, schemas: tocados };
    }, { signal, timeoutMs: 15000 });
  }

  async function descrever({ schema, tabela } = {}, { signal } = {}) {
    let sch = schema ? String(schema).toLowerCase().trim() : null;
    let tab = tabela ? String(tabela).toLowerCase().trim() : null;
    if (tab && tab.includes('.')) { const [a, b] = tab.split('.', 2); sch = a; tab = b; }
    if (sch && !SCHEMAS_LIBERADOS.includes(sch)) {
      throw new ErroFerramenta(sch === 'financeiro' ? 'O schema financeiro (folha de pagamento) fica fora do Jarvis.' : `O schema ${sch} fica fora do Jarvis. Liberados: ${SCHEMAS_LIBERADOS.join(', ')}.`, 'sql-schema');
    }
    return emLeitura(async c => {
      if (tab) {
        const r = await c.query({
          text: `select c.table_schema, c.column_name, c.data_type
                   from information_schema.columns c
                  where c.table_schema = any($1::text[]) and c.table_name = $2
                  order by c.table_schema, c.ordinal_position`,
          values: [sch ? [sch] : SCHEMAS_LIBERADOS, tab],
        });
        if (!r.rows.length) throw new ErroFerramenta(`Não achei a tabela ${sch ? sch + '.' : ''}${tab} nos schemas liberados.`, 'sql');
        const porSchema = {};
        for (const x of r.rows) (porSchema[x.table_schema] ||= []).push(`${x.column_name} (${x.data_type})`);
        return { tabela: tab, colunas_por_schema: porSchema };
      }
      const r = await c.query({
        text: `select t.table_schema, t.table_name, t.table_type
                 from information_schema.tables t
                where t.table_schema = any($1::text[])
                order by t.table_schema, t.table_name
                limit 600`,
        values: [sch ? [sch] : SCHEMAS_LIBERADOS],
      });
      const porSchema = {};
      for (const x of r.rows) (porSchema[x.table_schema] ||= []).push(x.table_type === 'VIEW' ? `${x.table_name} (visão)` : x.table_name);
      return { schemas: porSchema, dica: 'Use sempre schema.tabela no SELECT. Para ver as colunas, chame de novo com tabela.' };
    }, { signal, timeoutMs: 15000 });
  }

  /** select saude.painel() — o mesmo SELECT fixo do painel; guarda 20 s para não martelar o banco. */
  async function painelSaude({ signal, fresco = false } = {}) {
    if (!fresco && painelCache && Date.now() - painelEm < 20000) return painelCache;
    if (!painelLendo) {
      painelLendo = emLeitura(async c => {
        const r = await c.query('select saude.painel() as p');
        return r.rows?.[0]?.p ?? null;
      }, { timeoutMs: 15000 })
        .then(p => { painelCache = p; painelEm = Date.now(); return p; })
        .finally(() => { painelLendo = null; });
    }
    return corrida(painelLendo, signal);
  }

  /** Para o teste: a transação recusa escrita? (CREATE TEMP TABLE tem que dar 25006; se passasse, o ROLLBACK desfaria.) */
  async function _testarSomenteLeitura() {
    try {
      await emLeitura(c => c.query('CREATE TEMP TABLE jarvis_teste_leitura (x int)'));
      return { recusou: false };
    } catch (e) {
      return { recusou: e instanceof ErroFerramenta && e.codigo === 'sql-escrita', mensagem: e.message };
    }
  }

  return {
    configurado: !!cfgBanco,
    consultar,
    descrever,
    painelSaude,
    _testarSomenteLeitura,
    async fechar() { if (pool) { const p = pool; pool = null; await p.end().catch(() => {}); } },
  };
}
