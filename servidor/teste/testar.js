/* Testes do servidor do Cérebro sem navegador e sem a chave da API.
   node teste/testar.js            (o banco é testado se o ENV tiver as SUPABASE_DB_; use JARVIS_ENV=<caminho do ENV>)
   Nada é gravado no banco; nenhum e-mail sai (o e-mail tem o próprio teste: teste/testar-email.js). */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { carregarConfig } from '../config.js';
import { conferirSql, conferirPlano, criarBanco } from '../banco.js';
import { conferirCaminho, nomeBloqueado, buscarArquivos, lerArquivo } from '../ferramentas/arquivos.js';
import { caminhoBloqueado, mascararSegredos } from '../../web/js/bloqueio.js';
import { limparFala } from '../../web/js/fala.js';
import { criarAcao, decidir, tirarAvisos, devolverAvisos } from '../acoes.js';
import { extrairTexto } from '../ferramentas/extrair.js';
import { executarFerramenta, BASE, DELEGAR, definicoesApi } from '../ferramentas/index.js';
import { consultarDados } from '../ferramentas/dados.js';
import { saudeSistemas } from '../ferramentas/saude.js';
import { buscarNotas, lerNota } from '../ferramentas/notas.js';
import { mostrarNaTela } from '../ferramentas/tela.js';
import { validar } from '../validar.js';
import { criarVault } from '../vault.js';
import {
  limparConversa, montarMensagens, novoRegistro, fecharRegistro, blocosParaRegistro, _limparRegistros,
  NOTA_INTERROMPIDO, linhaContexto,
} from '../conversa.js';

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; console.log(`${cond ? 'OK  ' : 'FALHOU'} ${msg}`); if (!cond) falhas++; };
const recusa = (fn, rx, msg) => { try { fn(); ok(false, `${msg} (não recusou)`); } catch (e) { ok(rx.test(e.message), `${msg} → ${e.message}`); } };
const titulo = t => console.log(`\n== ${t}`);

const cfg = carregarConfig([]);

/* ---------------------------------------------------------------- SQL, trava 1 (texto) */
titulo('consultar_dados: trava do texto');
ok(conferirSql('select count(*) from compras.controle_carga') === 'select count(*) from compras.controle_carga', 'SELECT simples passa');
ok(!!conferirSql('with x as (select 1 as a) select a from x;'), 'WITH … SELECT passa (o ; do fim sai)');
ok(!!conferirSql("select * from core.dim_rca where nome ilike '%; drop table x%' -- comentário"), 'texto com ; e comentário passa (o ; está dentro do texto)');
recusa(() => conferirSql('select 1; select 2'), /um comando só/, 'dois comandos');
recusa(() => conferirSql('select 1; delete from compras.x'), /um comando só/, 'comando escondido depois do ;');
recusa(() => conferirSql('select * from financeiro.folha'), /financeiro/, 'schema financeiro');
recusa(() => conferirSql('select * from "financeiro"."folha"'), /financeiro/, 'financeiro entre aspas duplas');
recusa(() => conferirSql("select table_to_xml('financeiro.folha', true, false, '')"), /financeiro/, 'financeiro dentro de texto (table_to_xml)');
recusa(() => conferirSql('select * from auth.users'), /auth/, 'schema auth');
recusa(() => conferirSql('select * from vault.decrypted_secrets'), /vault/, 'schema vault');
recusa(() => conferirSql('select * from information_schema.tables'), /information_schema/, 'information_schema direto');
recusa(() => conferirSql('insert into compras.x values (1)'), /SELECT ou WITH/, 'INSERT');
recusa(() => conferirSql('update compras.x set a = 1'), /SELECT ou WITH/, 'UPDATE');
recusa(() => conferirSql('with d as (delete from compras.x returning *) select * from d'), /DELETE/, 'DELETE dentro de WITH');
recusa(() => conferirSql('select * into compras.nova from compras.x'), /INTO/, 'SELECT INTO');
recusa(() => conferirSql('select * from compras.x for update'), /UPDATE/, 'FOR UPDATE');
recusa(() => conferirSql("select pg_read_file('/etc/passwd')"), /pg_read_file/, 'pg_read_file');
recusa(() => conferirSql('select pg_sleep(30)'), /pg_sleep/, 'pg_sleep');
recusa(() => conferirSql("select set_config('search_path', 'financeiro', false)"), /financeiro|set_config/, 'set_config');
recusa(() => conferirSql("select query_to_xml('select 1', true, false, '')"), /query_to_xml/, 'query_to_xml (SQL dinâmico)');
recusa(() => conferirSql('select $$x$$'), /\$/, 'dollar quoting');
recusa(() => conferirSql('select 1 /* sem fim'), /comentário/, 'comentário aberto');
recusa(() => conferirSql("select 'aberto"), /aspas/, 'texto aberto');
recusa(() => conferirSql('/* x */ select 1; /* y */ drop table compras.x'), /um comando só/, 'drop escondido entre comentários');
recusa(() => conferirSql("select '\\'; drop table compras.x; --'"), /um comando só/, "'\\' termina o texto (padrão do Postgres): o drop depois é outro comando");
recusa(() => conferirSql("select E'\\'; drop table compras.x; --'"), /barra invertida/, "E'\\'…' (escape com barra) é recusado");
// desvios achados na revisão de segurança: funções que executam SQL em texto e escapes que escondem nomes
recusa(() => conferirSql("select * from ts_stat('select to_tsvector(''simple'', f::text) from ' || 'finan' || 'ceiro.folha f')"), /ts_stat/, 'ts_stat (executa o SQL do texto)');
recusa(() => conferirSql("select ts_rewrite('a'::tsquery, 'select 1')"), /ts_rewrite/, 'ts_rewrite (executa o SQL do texto)');
recusa(() => conferirSql('select U&"\\0070g_read_file"(\'x\')'), /U&/, 'U&"…" escondendo pg_read_file');
recusa(() => conferirSql('select U&"query\\005fto\\005fxml"(\'select 1\', true, false, \'\')'), /U&/, 'U&"…" escondendo query_to_xml');
recusa(() => conferirSql("select * from compras.x where s = U&'\\0066inanceiro'"), /U&/, "U&'…' escondendo financeiro");
recusa(() => conferirSql("select E'\\x66inanceiro'"), /barra invertida/, "E'\\x66…' escondendo financeiro");
ok(!!conferirSql("select e.nome from core.dim_rca e where e.nome = 'x'"), "alias e seguido de texto ('x') não vira E'…'");

/* ---------------------------------------------------------------- SQL, trava 2 (plano) */
titulo('consultar_dados: trava do plano (EXPLAIN)');
const plano = (schema, extra = {}) => [{ Plan: { 'Node Type': 'Seq Scan', 'Relation Name': 't', Schema: schema, Output: ['t.a'], ...extra } }];
ok(conferirPlano(plano('compras')).includes('compras'), 'plano só com compras passa');
recusa(() => conferirPlano(plano('public')), /public/, 'tabela no public');
recusa(() => conferirPlano(plano('financeiro')), /financeiro/, 'visão que chega no financeiro');
recusa(() => conferirPlano([{ Plan: { 'Node Type': 'Result', Output: ['extensions.http_get(\'x\'::text)'] } }]), /extensions/, 'função de outro schema na saída');
ok(Array.isArray(conferirPlano([{ Plan: { 'Node Type': 'Result', Output: ['saude.painel()'] } }])), 'saude.painel() passa');
recusa(() => conferirPlano([{ Plan: { 'Node Type': 'Function Scan', 'Function Name': 'ts_stat', Schema: 'pg_catalog', Alias: 'ts_stat', Output: ['word', 'ndoc', 'nentry'], 'Function Call': "ts_stat('select to_tsvector(''simple''::regconfig, f.*::text) from financeiro.folha f'::text)" } }]), /ts_stat/, 'plano com ts_stat (função do pg_catalog que executa SQL)');
recusa(() => conferirPlano([{ Plan: { 'Node Type': 'Result', Output: ["pg_read_file('x'::text)"] } }]), /pg_read_file/, 'plano com pg_read_file (o nome real aparece no plano, sem o escape)');
recusa(() => conferirPlano([{ Plan: { 'Node Type': 'Result', Output: ["length('select * from financeiro.folha'::text)"] } }]), /financeiro/, 'plano com texto constante citando financeiro.folha');
ok(Array.isArray(conferirPlano([{ Plan: { 'Node Type': 'Function Scan', 'Function Name': 'generate_series', Schema: 'pg_catalog', Alias: 'g', Output: ['g'], 'Function Call': 'generate_series(1, 500)' } }])), 'plano com generate_series (pg_catalog comum) passa');

/* ---------------------------------------------------------------- banco de verdade (só leitura) */
titulo('banco (DATA WAREHOUSE, só leitura)');
const banco = criarBanco(cfg.banco);
if (!banco.configurado) {
  console.log('(pulado: o ENV não tem as SUPABASE_DB_; rode com JARVIS_ENV apontando para um ENV das ETLs)');
} else {
  const ctxB = { cfg, banco, emitir: () => {} };
  const ro = await banco._testarSomenteLeitura();
  ok(ro.recusou, `a transação recusa escrita (CREATE TEMP TABLE) → ${ro.mensagem}`);
  let r = await executarFerramenta(consultarDados, { sql: 'select count(*) as alvos from saude.alvo' }, ctxB);
  let d = r.ok ? JSON.parse(r.texto) : null;
  ok(r.ok && d.linhas[0][0] > 0, `consulta liberada roda: saude.alvo tem ${d?.linhas?.[0]?.[0]} alvos`);
  r = await executarFerramenta(consultarDados, { sql: 'select g as n from generate_series(1, 500) g' }, ctxB);
  d = r.ok ? JSON.parse(r.texto) : null;
  ok(r.ok && d.linhas.length === 200 && d.mais_linhas === true, 'no máximo 200 linhas, com aviso de que há mais');
  r = await executarFerramenta(consultarDados, { sql: 'select * from financeiro.folha_resumo' }, ctxB);
  ok(!r.ok && /financeiro/.test(r.texto), `financeiro recusado → ${r.texto}`);
  r = await executarFerramenta(consultarDados, { sql: 'select 1; select 2' }, ctxB);
  ok(!r.ok && /um comando só/.test(r.texto), 'múltiplos comandos recusados');
  r = await executarFerramenta(consultarDados, { sql: 'delete from saude.alvo' }, ctxB);
  ok(!r.ok && /SELECT ou WITH/.test(r.texto), 'escrita recusada');
  r = await executarFerramenta(consultarDados, { sql: 'select 1 from public.tabela_que_nao_existe' }, ctxB);
  ok(!r.ok, `tabela fora dos schemas → ${r.texto}`);
  r = await executarFerramenta(consultarDados, { sql: 'select count(*) from pg_class' }, ctxB);
  ok(!r.ok && /pg_class/.test(r.texto), 'catálogo do sistema recusado');
  r = await executarFerramenta(BASE.find(f => f.nome === 'descrever_dados'), {}, ctxB);
  d = r.ok ? JSON.parse(r.texto) : null;
  ok(r.ok && d.schemas && !('financeiro' in d.schemas), `descrever_dados lista os schemas liberados: ${d ? Object.keys(d.schemas).join(', ') : r.texto}`);
  r = await executarFerramenta(BASE.find(f => f.nome === 'descrever_dados'), { tabela: 'financeiro.folha' }, ctxB);
  ok(!r.ok && /financeiro/.test(r.texto), 'descrever_dados também recusa o financeiro');
  r = await executarFerramenta(saudeSistemas, {}, ctxB);
  d = r.ok ? JSON.parse(r.texto) : null;
  ok(r.ok && d.geral && Number.isFinite(d.geral.total), `saude_sistemas: ${r.resumo}`);
  r = await executarFerramenta(saudeSistemas, { so_problemas: true }, ctxB);
  ok(r.ok, `saude_sistemas só problemas: ${JSON.parse(r.texto).itens.length} itens`);
  const umId = d?.itens?.[0]?.id;
  if (umId) { r = await executarFerramenta(saudeSistemas, { item: umId }, ctxB); ok(r.ok && JSON.parse(r.texto).id === umId, `detalhe de um item (${umId})`); }
  await banco.fechar();
}

/* ---------------------------------------------------------------- arquivos */
titulo('arquivos: raízes e nomes proibidos');
const raizes = cfg.raizes;
const od = raizes[0];
const recusaAsync = async (p, rx, msg) => { try { await conferirCaminho(raizes, p); ok(false, `${msg} (não recusou)`); } catch (e) { ok(rx.test(e.message), `${msg} → ${e.message}`); } };
await recusaAsync('P:\\INTEGRAÇÃO BI\\REPOSICOES\\1 - CONFIGURACAO\\ENV', /senha, chave ou token/, 'ENV das ETLs');
await recusaAsync('P:\\INTEGRAÇÃO BI\\REPOSICOES\\1 - CONFIGURACAO\\.env.local', /senha, chave ou token/, '.env.local');
await recusaAsync('P:\\FOTOS_ION\\fotos.cred', /senha, chave ou token/, '*.cred');
await recusaAsync('P:\\x\\servidor.key', /senha, chave ou token/, '*.key');
await recusaAsync(path.join(od, 'senhas do wifi.xlsx'), /senha, chave ou token/, 'nome com "senha"');
await recusaAsync(path.join(od, 'FOLHA PGTO LUBE 2019.xlsx'), /folha/, 'planilha da folha');
await recusaAsync(path.join(od, 'DESLIGADOS 2026.docx'), /folha/, 'lista de desligados (RH)');
await recusaAsync(path.join(od, 'RH', 'qualquer.pdf'), /folha/, 'pasta RH');
await recusaAsync(path.join(od, 'projeto', '.git', 'config'), /sistema ou oculta/, 'pasta .git');
await recusaAsync('C:\\Windows\\win.ini', /fora das pastas liberadas/, 'fora das raízes (Windows)');
await recusaAsync('C:\\Users\\gti.julio.alves\\Desktop\\BI\\13. CEREBRO\\servidor\\config.js', /fora das pastas liberadas/, 'fora das raízes (Desktop)');
await recusaAsync(path.join(od, '..', 'Desktop', 'x.txt'), /fora das pastas liberadas/, 'escapando com ..');
await recusaAsync('CLAUDE.md', /caminho completo/, 'caminho relativo');
await recusaAsync('P:\\ETC\\PCSIS504.ini', /configuração/, '*.ini (configuração, como as do WinThor)');
await recusaAsync('P:\\Manager\\database.ini', /configuração/, 'database.ini');
await recusaAsync('P:\\INTEGRAÇÃO BI\\TRADE\\INSTALAR TUDO.bat', /configuração/, '*.bat (script)');
await recusaAsync('P:\\INTEGRAÇÃO BI\\TRADE\\etl\\rede.py', /configuração/, '*.py (script)');
ok(nomeBloqueado('relatorio.json') === null && nomeBloqueado('vendas.csv') === null && nomeBloqueado('ata.docx') === null, 'documentos comuns (json, csv, docx) continuam liberados');
ok(caminhoBloqueado('/personal/julio/Documents/RH/x.pdf') === 'folha' && caminhoBloqueado('Documentos/Compras/pedido.xlsx') === null, 'caminhoBloqueado (o link usa): pasta RH no meio do caminho');
const masc = mascararSegredos('host=10.0.0.5\nUser Id=admwinthor;Password=Segredo123;\nsenha: abc 123\n"token": "xyz"\npostgres://etl:minhasenha@db.exemplo:5432/x\nVenda total: 1200');
ok(!/Segredo123|minhasenha|xyz|abc/.test(masc) && /host=10\.0\.0\.5/.test(masc) && /Venda total: 1200/.test(masc), `mascararSegredos tira senha, token e usuário:senha@ → ${JSON.stringify(masc)}`);
ok(nomeBloqueado('ENV.example') === null && nomeBloqueado('.env.example') === null, 'ENV.example (só nomes) não é bloqueado');
ok(nomeBloqueado('ENVIO NF.xlsx') === null, '"ENVIO NF.xlsx" não é confundido com ENV');
const ctxA = { cfg, emitir: () => {} };
let ra = await executarFerramenta(lerArquivo, { caminho: path.join(cfg.vaultDir, 'CLAUDE.md') }, ctxA);
let da = ra.ok ? JSON.parse(ra.texto) : null;
ok(ra.ok && da.texto.includes('Cérebro da Lube') && da.partes >= 1, `ler_arquivo lê uma nota do vault (${ra.resumo})`);
ra = await executarFerramenta(lerArquivo, { caminho: path.join(cfg.vaultDir, 'CLAUDE.md'), parte: 2 }, ctxA);
ok(ra.ok && JSON.parse(ra.texto).parte === Math.min(2, da?.partes || 1), 'ler_arquivo devolve a parte pedida');
ra = await executarFerramenta(lerArquivo, { caminho: cfg.vaultDir }, ctxA);
ok(ra.ok && JSON.parse(ra.texto).itens.some(x => /Projetos/.test(x)), 'ler_arquivo numa pasta lista o conteúdo');
ra = await executarFerramenta(lerArquivo, { caminho: 'P:\\INTEGRAÇÃO BI\\REPOSICOES\\1 - CONFIGURACAO\\ENV' }, ctxA);
ok(!ra.ok && /senha, chave ou token/.test(ra.texto), 'ler_arquivo recusa o ENV (pela ferramenta)');
ra = await executarFerramenta(buscarArquivos, { termo: 'claude', pasta: cfg.vaultDir }, ctxA);
da = ra.ok ? JSON.parse(ra.texto) : null;
ok(ra.ok && da.arquivos.some(a => a.nome === 'CLAUDE.md'), `buscar_arquivos acha o CLAUDE.md no vault (${ra.resumo})`);
ra = await executarFerramenta(buscarArquivos, { termo: 'folha', pasta: od }, ctxA);
da = ra.ok ? JSON.parse(ra.texto) : null;
ok(ra.ok && da.arquivos.length === 0, `buscar_arquivos não mostra nada da folha (${ra.resumo})`);
ra = await executarFerramenta(buscarArquivos, { termo: 'env', pasta: 'P:\\INTEGRAÇÃO BI\\REPOSICOES' }, ctxA);
da = ra.ok ? JSON.parse(ra.texto) : null;
ok(ra.ok && !da.arquivos.some(a => /^\.?env$/i.test(a.nome)), `buscar_arquivos não lista o ENV (${da ? da.arquivos.map(a => a.nome).join(', ') || 'nenhum' : ra.texto})`);

/* ---------------------------------------------------------------- extração */
titulo('extração de texto (arquivos gerados aqui)');
function zip(itens) {
  const locais = [], centrais = [];
  let pos = 0;
  for (const [nome, txt] of Object.entries(itens)) {
    const dados = Buffer.from(txt, 'utf8'), comp = zlib.deflateRawSync(dados), n = Buffer.from(nome);
    const crc = zlib.crc32(dados);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(dados.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(dados.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(pos, 42);
    locais.push(lh, n, comp); centrais.push(ch, n);
    pos += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(centrais);
  const fim = Buffer.alloc(22); fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(Object.keys(itens).length, 8); fim.writeUInt16LE(Object.keys(itens).length, 10); fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(pos, 16);
  return Buffer.concat([...locais, cd, fim]);
}
const docx = zip({ 'word/document.xml': '<w:document><w:body><w:p><w:r><w:t>Relatório do Jarvis</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Vendas &amp; margem</w:t></w:r></w:p></w:body></w:document>' });
let t = await extrairTexto(docx, 'docx');
ok(/Relatório do Jarvis\nVendas & margem/.test(t), `docx → ${JSON.stringify(t)}`);
const xlsx = zip({
  'xl/workbook.xml': '<workbook><sheets><sheet name="Filiais" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/sharedStrings.xml': '<sst><si><t>Filial</t></si><si><t>Venda</t></si><si><t>Cariacica</t></si></sst>',
  'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>1234.5</v></c></row></sheetData></worksheet>',
});
t = await extrairTexto(xlsx, 'xlsx');
ok(/## Planilha: Filiais\nFilial \| Venda\nCariacica \| 1234\.5/.test(t), `xlsx → ${JSON.stringify(t.slice(0, 80))}`);
const pptx = zip({ 'ppt/slides/slide1.xml': '<p:sld><a:p><a:r><a:t>Slide um</a:t></a:r></a:p></p:sld>', 'ppt/slides/slide2.xml': '<p:sld><a:p><a:r><a:t>Slide dois</a:t></a:r></a:p></p:sld>' });
t = await extrairTexto(pptx, 'pptx');
ok(/Slide 1\nSlide um[\s\S]*Slide 2\nSlide dois/.test(t), 'pptx → slides na ordem');
const ods = zip({ 'content.xml': '<office:document-content><table:table table:name="Aba"><table:table-row><table:table-cell><text:p>A</text:p></table:table-cell><table:table-cell><text:p>B</text:p></table:table-cell></table:table-row></table:table></office:document-content>' });
t = await extrairTexto(ods, 'ods');
ok(/Planilha: Aba[\s\S]*A\s*\|\s*B/.test(t), `ods → ${JSON.stringify(t)}`);
function pdfMinimo(texto) {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const fluxo = `BT /F1 18 Tf 20 100 Td (${texto}) Tj ET`;
  objs[3] = `<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`;
  let s = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = s.length;
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(s, 'latin1');
}
t = await extrairTexto(pdfMinimo('Teste do Jarvis'), 'pdf');
ok(/Página 1\s+Teste do Jarvis/.test(t), `pdf → ${JSON.stringify(t)}`);
t = await extrairTexto(Buffer.from('nome;cidade\nJo\xe3o;Cariacica\n', 'latin1'), 'csv');
ok(t.includes('João'), 'csv em Windows-1252 vira texto certo');

/* ---------------------------------------------------------------- validador e definições */
titulo('validação do input das ferramentas');
ok(validar(consultarDados.schema, { sql: 'select 1' }).length === 0, 'input válido passa');
ok(validar(consultarDados.schema, {}).some(e => /obrigatório/.test(e)), 'campo obrigatório faltando');
ok(validar(consultarDados.schema, { sql: 1 }).some(e => /esperado string/.test(e)), 'tipo errado');
ok(validar(consultarDados.schema, { sql: 'x', extra: 1 }).some(e => /desconhecido/.test(e)), 'campo a mais');
ok(validar(mostrarNaTela.schema, { tipo: 'grafico' }).some(e => /fora da lista/.test(e)), 'enum');
ok(validar(mostrarNaTela.schema, { tipo: 'tabela', linhas: [[1, 'a', null]] }).length === 0, 'tabela com número, texto e nulo');
const defs = definicoesApi([...BASE, DELEGAR]);
ok(defs.every(d => d.eager_input_streaming === true && d.input_schema.type === 'object'), `${defs.length} ferramentas com eager_input_streaming e schema`);
ok(JSON.stringify(definicoesApi([...BASE, DELEGAR])) === JSON.stringify(defs), 'definições idênticas a cada montagem (cache)');
const rv = await executarFerramenta(consultarDados, { sql: 7 }, { cfg, banco: { configurado: false } });
ok(!rv.ok && /INVALID_JSON/.test(rv.texto), 'input inválido nem roda: volta INVALID_JSON para o modelo');

/* ---------------------------------------------------------------- notas e cartões */
titulo('notas do vault e cartões');
const vault = criarVault(cfg.vaultDir);
const ctxN = { cfg, vault, emitir: (ev, d) => cartoes.push({ ev, d }) };
const cartoes = [];
let rn = await executarFerramenta(buscarNotas, { consulta: 'faturamento compras' }, ctxN);
let dn = rn.ok ? JSON.parse(rn.texto) : null;
ok(rn.ok && dn.notas.length > 0, `buscar_notas: ${dn?.notas?.map(n => n.nome).slice(0, 3).join(' | ')}`);
rn = await executarFerramenta(lerNota, { nome: 'BI COMPRAS' }, ctxN);
dn = rn.ok ? JSON.parse(rn.texto) : null;
ok(rn.ok && dn.nome === 'BI COMPRAS' && dn.texto.length > 100, `ler_nota BI COMPRAS (${dn?.texto?.length} caracteres, cita ${dn?.cita?.length})`);
rn = await executarFerramenta(lerNota, { nome: 'Nota Que Não Existe 123' }, ctxN);
ok(!rn.ok && /Não achei/.test(rn.texto), 'nota inexistente vira mensagem clara');
await executarFerramenta(mostrarNaTela, { tipo: 'rotina', nome: 'Reposições - Sync' }, ctxN);
await executarFerramenta(mostrarNaTela, { tipo: 'tabela', titulo: 'T', colunas: ['a', 'b'], linhas: [[1, 2], [3, 4]] }, ctxN);
rn = await executarFerramenta(mostrarNaTela, { tipo: 'destaque', valor: '12' }, ctxN);
ok(!rn.ok && /rotulo/.test(rn.texto), 'cartão destaque sem rótulo é recusado');
ok(cartoes[0]?.d?.tipo === 'rotina' && /Rotinas\//.test(cartoes[0].d.dados.caminho), `cartão rotina aponta para a nota (${cartoes[0]?.d?.dados?.caminho})`);
ok(cartoes[1]?.d?.tipo === 'tabela' && cartoes[1].d.dados.linhas.length === 2, 'cartão tabela no formato do contrato');

/* ---------------------------------------------------------------- conversa e interrupção */
titulo('conversa: histórico, interrupção e mensagens de sistema');
_limparRegistros();
recusa(() => limparConversa([]), /vazia/, 'conversa vazia');
recusa(() => limparConversa([{ papel: 'julio', texto: 'oi' }, { papel: 'jarvis', texto: 'olá' }]), /última fala/, 'última fala do Jarvis');
let ent = limparConversa([{ papel: 'jarvis', texto: 'bom dia' }, { papel: 'julio', texto: 'oi' }, { papel: 'julio', texto: 'tudo bem?' }]);
ok(ent.length === 1 && ent[0].texto === 'oi tudo bem?', 'falas seguidas do Júlio viram uma; fala inicial do Jarvis sai');
// turno 1 com uma rodada de ferramenta, guardado como registro
const ctxLinha = linhaContexto({ tela: 'jarvis', nota_aberta: 'BI COMPRAS' }, new Date('2026-10-15T17:32:00Z'));
ok(/14:32/.test(ctxLinha) && /BI COMPRAS/.test(ctxLinha) && /não é fala do Júlio/.test(ctxLinha), `linha de contexto: ${ctxLinha}`);
let m1 = montarMensagens(limparConversa([{ papel: 'julio', texto: 'Quantos e-mails novos?' }]), ctxLinha);
const reg1 = novoRegistro(m1.atual, m1.sistema);
reg1.textoTotal = 'Um instante, vou olhar a caixa. Você tem três e-mails novos. O primeiro é da Locaweb.';
reg1.rounds.push({ assistant: blocosParaRegistro([{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: 'Um instante, vou olhar a caixa.' }, { type: 'tool_use', id: 'toolu_1', name: 'listar_emails', input: {} }]), resultados: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '{"emails":[]}' }], ini: 0, fim: 31 });
reg1.rounds.push({ assistant: [{ type: 'text', text: 'Você tem três e-mails novos. O primeiro é da Locaweb.' }], resultados: null, ini: 32, fim: reg1.textoTotal.length });
fecharRegistro(reg1);
ok(!JSON.stringify(reg1.rounds).includes('thinking'), 'o registro não guarda blocos de thinking');
// turno 2: o Júlio interrompeu no meio da segunda frase
const conv2 = [
  { papel: 'julio', texto: 'Quantos e-mails novos?' },
  { papel: 'jarvis', texto: 'Um instante, vou olhar a caixa. Você tem três e-mails', interrompido: true },
  { papel: 'julio', texto: 'Só os do fornecedor.' },
];
let m2 = montarMensagens(limparConversa(conv2), 'contexto do turno 2');
const papeis = m2.mensagens.map(x => x.role).join(',');
ok(papeis === 'user,system,assistant,user,assistant,user,system', `ordem das mensagens: ${papeis}`);
ok(m2.mensagens[1].content === m1.sistema, 'a mensagem de sistema do turno antigo volta igual (cache)');
ok(m2.mensagens[2].content.some(b => b.type === 'tool_use') && m2.mensagens[3].content[0].type === 'tool_result', 'a rodada de ferramenta dita antes do corte fica intacta');
ok(m2.mensagens[4].content[0].text === 'Você tem três e-mails', `a resposta cortada fica só com o que foi dito: "${m2.mensagens[4].content[0].text}"`);
ok(m2.mensagens[6].content.startsWith(NOTA_INTERROMPIDO) && m2.mensagens[6].content.includes('contexto do turno 2'), 'a nota de interrupção vem DEPOIS da nova fala do Júlio');
ok(m2.mensagens[5].content[0].cache_control?.type === 'ephemeral', 'breakpoint de cache na fala atual do Júlio');
// turno 3 sem registro (servidor reiniciado): vira texto, sem quebrar a ordem
_limparRegistros();
let m3 = montarMensagens(limparConversa(conv2), 'ctx');
ok(m3.mensagens.map(x => x.role).join(',') === 'user,assistant,user,system', `sem registro: ${m3.mensagens.map(x => x.role).join(',')}`);
// interrompido antes de falar qualquer coisa
let m4 = montarMensagens(limparConversa([{ papel: 'julio', texto: 'a' }, { papel: 'jarvis', texto: '', interrompido: true }, { papel: 'julio', texto: 'b' }]), 'ctx');
ok(m4.mensagens.map(x => x.role).join(',') === 'user,user,system' && /antes de você dizer/.test(m4.mensagens[2].content), 'interrompido antes de falar: sem mensagem vazia do assistente');

// a fala interrompida chega limpa (sem markdown nem [[ ]]); o registro guarda o texto bruto do Claude
_limparRegistros();
const mk1 = montarMensagens(limparConversa([{ papel: 'julio', texto: 'O que é o BI de compras?' }]), 'ctx');
const regMk = novoRegistro(mk1.atual, mk1.sistema);
regMk.textoTotal = 'Um instante. A nota **[[BI COMPRAS]]** diz que as cargas rodam na SRV-IA. O resto vem depois.';
regMk.rounds.push({ assistant: blocosParaRegistro([{ type: 'text', text: 'Um instante.' }, { type: 'tool_use', id: 'toolu_9', name: 'ler_nota', input: { nome: 'BI COMPRAS' } }]), resultados: [{ type: 'tool_result', tool_use_id: 'toolu_9', content: '{}' }], ini: 0, fim: 12 });
regMk.rounds.push({ assistant: [{ type: 'text', text: 'A nota **[[BI COMPRAS]]** diz que as cargas rodam na SRV-IA. O resto vem depois.' }], resultados: null, ini: 13, fim: regMk.textoTotal.length });
fecharRegistro(regMk);
const ditoMk = limparFala('Um instante. A nota **[[BI COMPRAS]]** diz que as cargas');
const mk2 = montarMensagens(limparConversa([
  { papel: 'julio', texto: 'O que é o BI de compras?' },
  { papel: 'jarvis', texto: ditoMk, interrompido: true },
  { papel: 'julio', texto: 'E o comercial?' },
]), 'ctx');
ok(mk2.mensagens.some(x => x.role === 'user' && Array.isArray(x.content) && x.content[0]?.type === 'tool_result'), `fala interrompida com markdown ainda acha o registro (a rodada de ferramenta fica): "${ditoMk}"`);
const cortadaMk = mk2.mensagens.filter(x => x.role === 'assistant').pop();
ok(/cargas$/.test(cortadaMk?.content?.[0]?.text || ''), `e corta no ponto certo do texto bruto: "${cortadaMk?.content?.[0]?.text}"`);
ok(limparFala('1. Primeiro *item* | segundo _ponto_ e o e_mail') === 'Primeiro item segundo ponto e o e_mail', `limparFala tira lista numerada, ênfase e barra: "${limparFala('1. Primeiro *item* | segundo _ponto_ e o e_mail')}"`);

/* ---------------------------------------------------------------- ações pendentes */
titulo('ações: só uma pendente por vez, motivo da recusa, avisos por aba');
tirarAvisos();
const a1 = criarAcao({ tipo: 'enviar_email', resumo: 'E-mail 1', detalhe: {}, executar: async () => ({ ok: true, mensagem: 'x' }), aba: 'abaUm123' });
const a2 = criarAcao({ tipo: 'enviar_email', resumo: 'E-mail 2', detalhe: {}, executar: async () => ({ ok: true, mensagem: 'x' }), aba: 'abaUm123' });
ok(a2.substituiu === 'E-mail 1', 'o rascunho novo substitui o anterior e diz qual');
let rd = await decidir(a1.id, 'confirmar');
ok(rd.status === 404 && !rd.ok, 'o rascunho substituído não pode mais ser confirmado');
rd = await decidir(a2.id, 'recusar', 'saiu');
ok(rd.ok && tirarAvisos('outraAba99').length === 0, 'o desfecho não vai para outra aba');
const av = tirarAvisos('abaUm123');
ok(av.length === 1 && /saiu do modo Jarvis/.test(av[0]), `o motivo da recusa entra no aviso: ${av[0]}`);
devolverAvisos(['aviso devolvido'], 'abaUm123');
ok(tirarAvisos('abaUm123')[0] === 'aviso devolvido', 'aviso devolvido por turno cancelado volta para a fila');

/* ---------------------------------------------------------------- vault ao vivo */
titulo('vault ao vivo (fs.watch numa pasta de teste)');
const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'cerebro-vault-'));
await fsp.writeFile(path.join(tmp, 'CLAUDE.md'), '# teste\n');
const mudou = new Promise(res => {
  const v = criarVault(tmp, { onMudou: lista => { v.parar(); res(lista); } });
  v.vigiar();
  setTimeout(() => fsp.mkdir(path.join(tmp, 'Projetos'), { recursive: true }).then(() => fsp.writeFile(path.join(tmp, 'Projetos', 'Nova.md'), '# nova\n[[CLAUDE]]')), 300);
  setTimeout(() => { v.parar(); res(null); }, 5000);
});
const lista = await mudou;
ok(Array.isArray(lista) && lista.some(p => /Nova\.md$/.test(p)), `aviso de mudança: ${JSON.stringify(lista)}`);
const v2 = criarVault(tmp);
const lidos = await v2.ler();
ok(lidos.files.length === 2 && lidos.files.every(f => typeof f.mtime === 'number' && typeof f.size === 'number'), 'formato {path, text, size, mtime}');
await fsp.rm(tmp, { recursive: true, force: true });

console.log(`\n${total - falhas} de ${total} OK${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
process.exit(falhas ? 1 : 0);
