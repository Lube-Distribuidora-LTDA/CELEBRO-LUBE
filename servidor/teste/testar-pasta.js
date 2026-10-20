/* Teste da pasta do Jarvis (ferramentas/pasta.js) e da planilha (ferramentas/planilha.js), numa pasta TEMPORÁRIA:
   nada vai para o OneDrive (no fim confere que a pasta JARVIS de verdade não foi criada nem mexida).
   node teste/testar-pasta.js
   Prova: nomeSeguro e conferir (fora, "..", junção para fora, curto × longo, rede, arquivo:x, nome reservado); anotar
   (nome, conteúdo, segredo mascarado, sem sobrescrever); mover, renomear, apagar e alterar_texto SÓ fazem depois de
   decidir('confirmar'), e não fazem com recusar nem vencido; a estrutura não sai do lugar; abrir_no_windows recusa
   .bat, .js, .exe e .lnk; a planilha (tipos, filtro, congelado, total com resultado, texto que parece fórmula) relida pelo
   exceljs, pelo extrair.js e pelo ler_arquivo. A Lixeira e o "abrir no Windows" são falsos aqui.
   Com TESTE_LIXEIRA=1: também manda um arquivo e uma pasta de teste para a Lixeira DE VERDADE, confere lá e restaura. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import {
  criarPastaJarvis, pastaPadrao, nomeSeguro, motivoNome, SUBPASTAS, lixeiraPadrao,
  anotar, alterarTexto, listarPasta, criarPasta, criarArquivo, copiarParaJarvis, mover, renomear, apagar, abrirNoWindows,
} from '../ferramentas/pasta.js';
import { criarPlanilha, montarPlanilha, numeroDe, dataDe } from '../ferramentas/planilha.js';
import { lerArquivo } from '../ferramentas/arquivos.js';
import { extrairTexto } from '../ferramentas/extrair.js';
import { executarFerramenta } from '../ferramentas/index.js';
import { decidir, tirarAvisos } from '../acoes.js';

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FALHOU'} ${msg}`); if (!cond) falhas++; };
const existe = (p) => fs.existsSync(p);

// a pasta JARVIS de verdade: o teste não pode criar nem mexer nela
const REAL = pastaPadrao({});
const fotoReal = () => { try { const st = fs.statSync(REAL); return `existe ${st.mtimeMs}`; } catch (_) { return 'não existe'; } };
const realAntes = fotoReal();

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'jarvis-pasta-'));   // o os.tmpdir() vem no caminho curto (GTIJUL~1.ALV)
const tmpLongo = await fsp.realpath(tmp);
const raiz = path.join(tmp, 'JARVIS');
const fora = path.join(tmp, 'fora');
const lixoFalso = path.join(tmp, 'lixeira-falsa');
await fsp.mkdir(fora, { recursive: true });
await fsp.mkdir(lixoFalso, { recursive: true });
fs.writeFileSync(path.join(fora, 'segredo.txt'), 'não é para sair daqui');
fs.writeFileSync(path.join(fora, 'relatorio.pdf'), Buffer.alloc(2048, 7));
fs.writeFileSync(path.join(fora, 'script.bat'), '@echo off');
fs.writeFileSync(path.join(fora, 'programa.exe'), 'MZ');
fs.writeFileSync(path.join(fora, 'ENV'), 'SENHA=x');
await fsp.mkdir(path.join(fora, 'uma pasta'), { recursive: true });
const foraAntes = fs.readdirSync(fora).sort().join('|');

const naLixeira = [];
const abertos = [];
const lixeiraFalsa = async (abs, { tipo, tamanho }) => {
  const destino = path.join(lixoFalso, `${crypto.randomBytes(4).toString('hex')}-${path.basename(abs)}`);
  await fsp.rename(abs, destino);
  naLixeira.push({ abs, tipo, tamanho });
  return { ok: true, conferido: true };
};
const abridorFalso = async (abs, { modo }) => { abertos.push({ abs, modo }); };
const P = criarPastaJarvis({ raiz, log: () => {}, lixeira: lixeiraFalsa, abridor: abridorFalso, tipoDisco: async () => 'Fixed' });

const eventos = [];
const consultas = [];
let respostaBanco = null;
const banco = {
  configurado: true,
  async consultar(sql, opcoes) { consultas.push({ sql, opcoes: { maxLinhas: opcoes?.maxLinhas, celulaMax: opcoes?.celulaMax } }); return respostaBanco; },
};
const ABA = 'teste-pasta';
const ctx = { cfg: { raizes: [tmp, tmpLongo] }, jarvis: P, banco, emitir: (ev, d) => eventos.push({ ev, d }), aba: ABA };
const rodar = async (f, input) => {
  const r = await executarFerramenta(f, input, ctx, f.prazoMs || 45000);
  let d = null;
  try { d = JSON.parse(r.texto); } catch (_) { d = r.texto; }
  return { ...r, d };
};
const ultimo = (ev) => eventos.filter(e => e.ev === ev).at(-1)?.d;
const errou = async (promessa, codigo) => {
  try { await promessa; return false; } catch (e) { return e && e.codigo === codigo ? true : `veio ${e?.codigo || e?.message}`; }
};

try {
  /* ---------- nomes ---------- */
  ok(nomeSeguro('Reunião 14:55: compras') === 'Reunião 14h55 — compras', `nomeSeguro troca ":" (hora vira 14h55): "${nomeSeguro('Reunião 14:55: compras')}"`);
  ok(nomeSeguro('CON') === 'CON_' && nomeSeguro('nul.txt') === 'nul_.txt' && nomeSeguro('com1') === 'com1_', 'nomeSeguro: nome reservado do Windows ganha "_"');
  ok(nomeSeguro('relatório final.  ') === 'relatório final' && nomeSeguro('..escondido') === 'escondido', 'nomeSeguro: sem ponto nem espaço nas pontas');
  ok(nomeSeguro('boleto\u202Efdp.exe') === 'boleto fdp.exe' && nomeSeguro('a\u0007b') === 'a b', 'nomeSeguro: controle e bidi (U+202E) saem');
  ok(nomeSeguro('a/b\\c|d*e?"f"<g>') === "a-b-c-de'f'g", 'nomeSeguro: / \\ | viram "-", * ? < > saem, aspas viram apóstrofo');
  ok(nomeSeguro('') === 'sem nome' && Array.from(nomeSeguro('x'.repeat(200))).length === 80, 'nomeSeguro: vazio vira "sem nome"; corta em 80');
  ok(nomeSeguro('2026-10-20 14h55 — Reunião') === '2026-10-20 14h55 — Reunião', 'nomeSeguro não estraga um nome que já é bom');
  ok(motivoNome('CON') && motivoNome('COM1.txt') && motivoNome('a.') && motivoNome('a:b') && motivoNome('x\u202E') && !motivoNome('ok.txt'), 'motivoNome: reservado, ponto no fim, ":" e controle recusados; nome comum passa');

  /* ---------- a raiz ---------- */
  const raizR = await P.raizReal();
  ok(raizR === path.join(tmpLongo, 'JARVIS'), `raizReal resolve o caminho curto para o longo (${raizR})`);
  ok(SUBPASTAS.every(s => existe(path.join(raizR, s))), 'raizReal cria as cinco subpastas');
  ok(await errou(criarPastaJarvis({ raiz: '\\\\servidor\\pasta\\JARVIS', tipoDisco: async () => 'Fixed' }).raizReal(), 'jarvis-disco') === true, 'raiz na rede (\\\\servidor) é recusada');
  ok(await errou(criarPastaJarvis({ raiz: path.join(tmp, 'rede', 'JARVIS'), tipoDisco: async () => 'Network' }).raizReal(), 'jarvis-disco') === true, 'raiz em disco de rede (P:) é recusada');
  ok(await errou(criarPastaJarvis({ raiz: path.join(tmp, 'nao-existe', 'JARVIS'), tipoDisco: async () => 'Fixed' }).raizReal(), 'jarvis-disco') === true, 'sem a pasta de cima (o OneDrive), não cria nada');
  ok(!existe(path.join(tmp, 'rede')) && !existe(path.join(tmp, 'nao-existe')), 'as raízes recusadas não criaram pasta nenhuma');

  /* ---------- conferir ---------- */
  ok((await P.conferir('Anotações')).rel === 'Anotações', 'conferir: caminho relativo à raiz');
  ok((await P.conferir('JARVIS\\Planilhas')).rel === 'Planilhas', 'conferir: "JARVIS\\Planilhas" (o modelo repetindo a raiz) vale como Planilhas');
  ok((await P.conferir(path.join(raiz, 'Prints'))).rel === 'Prints' && (await P.conferir(path.join(raizR, 'Prints'))).rel === 'Prints', 'conferir: absoluto curto (GTIJUL~1.ALV) e longo dão o mesmo');
  ok(await errou(P.conferir('..\\fora\\segredo.txt'), 'jarvis-fora') === true, 'conferir: "..\\" para fora → jarvis-fora');
  ok(await errou(P.conferir('Anotações\\..\\..\\fora'), 'jarvis-fora') === true, 'conferir: ".." no meio → jarvis-fora');
  ok(await errou(P.conferir(path.join(fora, 'segredo.txt')), 'jarvis-fora') === true, 'conferir: absoluto fora da raiz → jarvis-fora');
  ok(await errou(P.conferir('C:\\Windows\\win.ini'), 'jarvis-fora') === true, 'conferir: C:\\Windows → jarvis-fora');
  ok(await errou(P.conferir('\\\\servidor\\share\\a.txt'), 'jarvis-fora') === true && await errou(P.conferir('//servidor/share'), 'jarvis-fora') === true, 'conferir: caminho de rede → jarvis-fora');
  ok(await errou(P.conferir('\\Users\\x'), 'jarvis-fora') === true, 'conferir: "\\caminho" sem a letra do disco → jarvis-fora');
  ok(await errou(P.conferir('Z:\\JARVIS\\a.txt'), 'jarvis-fora') === true, 'conferir: outra letra de disco → jarvis-fora (sem tocar no disco)');
  ok(await errou(P.conferir('Arquivos\\nota.txt:fluxo'), 'jarvis-nome') === true, 'conferir: fluxo alternativo (arquivo:x) → jarvis-nome');
  ok(await errou(P.conferir('C:relativo.txt'), 'jarvis-nome') === true, 'conferir: "C:relativo" → jarvis-nome');
  ok(await errou(P.conferir('Arquivos\\CON.txt'), 'jarvis-nome') === true && await errou(P.conferir('Arquivos\\lpt1'), 'jarvis-nome') === true, 'conferir: nome reservado (CON.txt, LPT1) → jarvis-nome');
  ok(await errou(P.conferir('Arquivos\\x\u202Etxt.exe'), 'jarvis-nome') === true, 'conferir: controle bidi no caminho → jarvis-nome');
  ok(await errou(P.conferir('Arquivos\\nao-tem.txt', { existe: true }), 'jarvis-sumiu') === true, 'conferir: existe=true num item que não existe → jarvis-sumiu');
  ok(await errou(P.conferir('Anotações', { existe: false }), 'jarvis-existe') === true, 'conferir: existe=false num item que existe → jarvis-existe');
  // junção dentro da pasta do Jarvis apontando para fora (o Jarvis não cria, mas pode existir)
  let temJuncao = false;
  try { fs.symlinkSync(fora, path.join(raizR, 'Arquivos', 'atalho'), 'junction'); temJuncao = true; } catch (_) { /* sem junção */ }
  ok(temJuncao, 'junção de teste criada (Arquivos\\atalho → fora)');
  if (temJuncao) {
    ok(await errou(P.conferir('Arquivos\\atalho\\segredo.txt'), 'jarvis-fora') === true, 'conferir: arquivo pela junção que sai da raiz → jarvis-fora');
    ok(await errou(P.conferir('Arquivos\\atalho'), 'jarvis-fora') === true, 'conferir: a própria junção que sai → jarvis-fora');
    ok(await errou(P.escreverTexto('Arquivos\\atalho\\novo.txt', 'x'), 'jarvis-fora') === true && !existe(path.join(fora, 'novo.txt')), 'escreverTexto pela junção: recusado, nada gravado fora');
  }

  /* ---------- escrever ---------- */
  ok(await errou(P.escreverTexto('Arquivos\\a.bat', '@echo off'), 'jarvis-extensao') === true, 'escreverTexto: .bat recusado');
  ok(await errou(P.escreverTexto('Arquivos\\a.js', 'x'), 'jarvis-extensao') === true, 'escreverTexto: .js fora de um projeto recusado');
  ok(await errou(P.escreverTexto('Arquivos\\a.docx', 'x'), 'jarvis-extensao') === true, 'escreverTexto: extensão que não é da lista (.docx) recusada');
  const js = await P.escreverTexto('Projetos\\site\\app.js', 'console.log(1)');
  ok(existe(js), 'escreverTexto: .js dentro de Projetos\\<nome> pode (o construtor)');
  ok(await errou(P.escreverTexto('Projetos\\app.js', 'x'), 'jarvis-extensao') === true, 'escreverTexto: .js solto em Projetos (fora de um projeto) recusado');
  ok(await errou(P.escreverTexto('Projetos\\site\\app.js', 'y'), 'jarvis-existe') === true && fs.readFileSync(js, 'utf8') === 'console.log(1)', 'escreverTexto novo=true nunca grava por cima');
  ok(!fs.readdirSync(path.join(raizR, 'Projetos', 'site')).some(n => n.endsWith('.tmp')), 'nenhum .tmp sobrou');

  /* ---------- anotar ---------- */
  let r = await rodar(anotar, { titulo: 'Reunião com compras', texto: 'Falar com o fornecedor.\nsenha = abc123\nPrazo: sexta.' });
  ok(r.ok && /^Anotações\\\d{4}-\d{2}-\d{2} \d{2}h\d{2} — Reunião com compras\.md$/.test(r.d.criado), `anotar: nome com data e hora (${r.d.criado})`);
  const nota1 = path.join(raizR, r.d.criado);
  const txt1 = fs.readFileSync(nota1, 'utf8');
  ok(txt1.startsWith('# Reunião com compras\n\nFalar com o fornecedor.') && /\n---\n_Anotado pelo Jarvis em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}\._\n$/.test(txt1), 'anotar: título, texto e o rodapé "Anotado pelo Jarvis em …"');
  ok(!txt1.includes('abc123') && txt1.includes('senha = [oculto]') && /senha/.test(r.d.aviso || ''), 'anotar: a senha sai mascarada e o modelo é avisado');
  const cartaoNota = ultimo('cartao');
  ok(cartaoNota?.tipo === 'anotacao' && cartaoNota.dados.arquivo?.id?.startsWith('arq_') && cartaoNota.dados.arquivo.pasta_rel === 'Anotações' && !cartaoNota.dados.trecho.includes('abc123'), 'anotar: cartão "anotacao" com id, pasta e trecho sem a senha');
  ok(P.porId(cartaoNota.dados.arquivo.id) === nota1, 'porId devolve o caminho do id do cartão');
  ok(P.porId('arq_inexistente') === null && P.porId('../../x') === null, 'porId de id desconhecido ou inventado: null');
  r = await rodar(anotar, { titulo: 'Reunião com compras', texto: 'Outra.' });
  const minutoIgual = path.basename(r.d.criado).slice(0, 16) === path.basename(nota1).slice(0, 16);
  ok(r.ok && (minutoIgual ? / \(2\)\.md$/.test(r.d.criado) : true) && fs.readFileSync(nota1, 'utf8') === txt1, `anotar de novo: nunca por cima (${path.basename(r.d.criado)})`);
  r = await rodar(anotar, { titulo: 'Pauta', texto: 'x', subpasta: 'Reuniões' });
  ok(r.ok && r.d.criado.startsWith('Anotações\\Reuniões\\'), 'anotar com subpasta: dentro de Anotações\\Reuniões');
  r = await rodar(anotar, { titulo: 'Fuga', texto: 'x', subpasta: '..\\..\\fora' });
  ok(r.ok && r.d.criado.startsWith('Anotações\\') && !fs.readdirSync(fora).some(n => n.endsWith('.md')), 'anotar com subpasta "..\\..\\fora": fica dentro de Anotações');
  r = await rodar(anotar, { titulo: 'x', texto: 'y', extra: 1 });
  ok(!r.ok && /INVALID_JSON|desconhecido/.test(r.texto), 'anotar com campo a mais: o schema recusa');

  /* ---------- criar_arquivo e criar_pasta ---------- */
  r = await rodar(criarArquivo, { nome: 'lista.md', tipo: 'md', conteudo: '- um\n- dois\ntoken: xyz' });
  ok(r.ok && r.d.criado === 'Arquivos\\lista.md' && !fs.readFileSync(path.join(raizR, r.d.criado), 'utf8').includes('xyz'), 'criar_arquivo: "lista.md" (sem .md.md), token mascarado');
  r = await rodar(criarArquivo, { nome: 'lista', tipo: 'md', conteudo: 'outra' });
  ok(r.ok && r.d.criado === 'Arquivos\\lista (2).md', 'criar_arquivo com nome que existe: "lista (2).md"');
  r = await rodar(criarArquivo, { nome: 'x', tipo: 'bat', conteudo: '@echo off' });
  ok(!r.ok, 'criar_arquivo tipo bat: o schema recusa');
  r = await rodar(criarArquivo, { pasta: '..\\fora', nome: 'x', tipo: 'txt', conteudo: 'x' });
  ok(!r.ok && r.codigo === 'jarvis-fora' && !existe(path.join(fora, 'x.txt')), 'criar_arquivo em "..\\fora": jarvis-fora');
  r = await rodar(criarPasta, { caminho: 'Arquivos\\Fornecedores' });
  ok(r.ok && r.d.criada === 'Arquivos\\Fornecedores' && existe(path.join(raizR, 'Arquivos', 'Fornecedores')), 'criar_pasta: Arquivos\\Fornecedores');
  const cartaoNovaPasta = ultimo('cartao');
  ok(cartaoNovaPasta?.tipo === 'arquivo' && cartaoNovaPasta.dados.acao === 'criado' && cartaoNovaPasta.dados.tipo === 'pasta' && cartaoNovaPasta.dados.pasta === 'Arquivos' && cartaoNovaPasta.dados.nome === 'Fornecedores', 'criar_pasta: cartão "arquivo" (criado, tipo pasta, pasta relativa à raiz)');
  r = await rodar(criarPasta, { caminho: 'Arquivos\\Fornecedores' });
  ok(r.ok && r.d.ja_existia === true, 'criar_pasta de novo: só avisa que já existia');
  r = await rodar(criarPasta, { caminho: 'Arquivos\\Nova: pasta' });
  ok(r.ok && r.d.criada === 'Arquivos\\Nova — pasta', `criar_pasta com ":" vira nome que o Windows aceita (${r.d?.criada})`);
  r = await rodar(criarPasta, { caminho: '..\\..\\fora\\nova' });
  ok(!r.ok && r.codigo === 'jarvis-fora' && !existe(path.join(fora, 'nova')), 'criar_pasta fora: jarvis-fora');

  /* ---------- listar_pasta ---------- */
  fs.writeFileSync(path.join(raizR, 'Arquivos', '~jarvis-sobra.tmp'), '');
  r = await rodar(listarPasta, {});
  ok(r.ok && SUBPASTAS.every(s => r.d.itens.some(i => i.nome === s && i.tipo === 'pasta')) && r.d.pasta === 'JARVIS', 'listar_pasta da raiz: as cinco pastas');
  ok(ultimo('cartao')?.dados?.pasta === '' && ultimo('cartao').dados.titulo === 'JARVIS', 'no cartão, a raiz é a pasta "" (a tela escreve JARVIS) e o título é JARVIS');
  r = await rodar(listarPasta, { pasta: 'Arquivos' });
  const cartaoLista = ultimo('cartao');
  ok(r.ok && r.d.itens[0].tipo === 'pasta' && r.d.itens.some(i => i.nome === 'lista.md' && i.kb >= 1) && !r.d.itens.some(i => i.nome.endsWith('.tmp')), 'listar_pasta: pastas primeiro, tamanho, sem o .tmp');
  ok(cartaoLista?.tipo === 'pasta' && cartaoLista.dados.pasta_id?.startsWith('arq_') && cartaoLista.dados.itens.every(i => i.tipo === 'atalho' || i.id?.startsWith('arq_')), 'listar_pasta: cartão "pasta" com ids');
  ok(!temJuncao || r.d.itens.some(i => i.nome === 'atalho' && i.tipo === 'atalho'), 'listar_pasta: a junção aparece como atalho (não é seguida)');
  const n0 = eventos.length;
  await rodar(listarPasta, { pasta: 'Arquivos', mostrar: false });
  ok(eventos.length === n0, 'listar_pasta com mostrar=false: sem cartão');
  r = await rodar(listarPasta, { pasta: 'Arquivos\\lista.md' });
  ok(!r.ok, 'listar_pasta de um arquivo: recusado');

  /* ---------- copiar_para_jarvis ---------- */
  r = await rodar(copiarParaJarvis, { de: path.join(fora, 'relatorio.pdf') });
  ok(r.ok && r.d.copiado === 'Arquivos\\relatorio.pdf' && fs.readFileSync(path.join(raizR, r.d.copiado)).equals(Buffer.alloc(2048, 7)), 'copiar_para_jarvis: o PDF de fora chega inteiro em Arquivos');
  r = await rodar(copiarParaJarvis, { de: path.join(fora, 'relatorio.pdf'), para: 'Arquivos\\Fornecedores' });
  ok(r.ok && r.d.copiado === 'Arquivos\\Fornecedores\\relatorio.pdf', 'copiar_para_jarvis com destino');
  r = await rodar(copiarParaJarvis, { de: path.join(fora, 'relatorio.pdf') });
  ok(r.ok && r.d.copiado === 'Arquivos\\relatorio (2).pdf', 'copiar de novo: "relatorio (2).pdf", nunca por cima');
  r = await rodar(copiarParaJarvis, { de: path.join(fora, 'script.bat') });
  ok(!r.ok && r.codigo === 'arquivo-bloqueado', 'copiar um .bat: recusado (as proibições do ler_arquivo)');
  r = await rodar(copiarParaJarvis, { de: path.join(fora, 'ENV') });
  ok(!r.ok && r.codigo === 'arquivo-bloqueado', 'copiar o ENV: recusado');
  r = await rodar(copiarParaJarvis, { de: path.join(fora, 'programa.exe') });
  ok(!r.ok && r.codigo === 'jarvis-extensao', 'copiar um .exe: jarvis-extensao');
  r = await rodar(copiarParaJarvis, { de: path.join(fora, 'uma pasta') });
  ok(!r.ok && /pasta/.test(r.texto), 'copiar uma pasta inteira: recusado');
  r = await rodar(copiarParaJarvis, { de: 'C:\\Windows\\win.ini' });
  ok(!r.ok && r.codigo === 'arquivo-fora', 'copiar de fora das raízes de leitura: recusado');
  r = await rodar(copiarParaJarvis, { de: path.join(fora, 'relatorio.pdf'), para: '..\\fora' });
  ok(!r.ok && r.codigo === 'jarvis-fora', 'copiar para fora da pasta do Jarvis: recusado');

  /* ---------- mover (só com aprovação) ---------- */
  const listaMd = path.join(raizR, 'Arquivos', 'lista.md');
  r = await rodar(mover, { itens: [{ de: 'Arquivos\\lista.md', para: 'Anotações' }] });
  let acao = ultimo('acao');
  ok(r.ok && r.d.situacao === 'aguardando_aprovacao' && acao?.tipo === 'mover' && acao.detalhe.itens[0].de === 'Arquivos\\lista.md' && acao.detalhe.itens[0].para === 'Anotações', 'mover: só prepara (ação pendente "mover" na tela)');
  ok(existe(listaMd), 'mover: nada mudou antes da aprovação');
  let dd = await decidir(acao.id, 'recusar');
  ok(dd.ok && existe(listaMd) && !existe(path.join(raizR, 'Anotações', 'lista.md')), 'mover recusado: nada mudou');
  r = await rodar(mover, { itens: [{ de: 'Arquivos\\lista.md', para: 'Anotações' }, { de: 'Arquivos\\lista (2).md', para: 'Anotações\\Listas' }] });
  acao = ultimo('acao');
  ok(r.ok && acao.detalhe.total === 2 && acao.detalhe.itens[1].pasta_nova === true, 'mover 2 itens: o cartão diz que a pasta Anotações\\Listas é nova');
  tirarAvisos(ABA);
  dd = await decidir(acao.id, 'confirmar');
  ok(dd.ok && !existe(listaMd) && existe(path.join(raizR, 'Anotações', 'lista.md')) && existe(path.join(raizR, 'Anotações', 'Listas', 'lista (2).md')), 'mover aprovado: os dois foram (e a pasta nova foi criada)');
  ok(tirarAvisos(ABA).some(a => /Movi 2 itens/.test(a)), 'o desfecho do mover vira aviso para a próxima fala');
  r = await rodar(mover, { itens: [{ de: 'Planilhas', para: 'Arquivos' }] });
  ok(!r.ok && r.codigo === 'jarvis-estrutura', 'mover a pasta Planilhas: jarvis-estrutura');
  fs.writeFileSync(path.join(raizR, 'Anotações', 'lista (2).md'), 'mesmo nome');
  r = await rodar(mover, { itens: [{ de: 'Anotações\\Listas\\lista (2).md', para: 'Anotações' }] });
  ok(!r.ok && r.codigo === 'jarvis-existe', 'mover para onde já tem um item com o nome: jarvis-existe (nunca por cima)');
  r = await rodar(mover, { itens: [{ de: 'Anotações\\Listas', para: 'Arquivos' }, { de: 'Anotações\\Listas\\lista (2).md', para: 'Arquivos' }] });
  ok(!r.ok && /dentro de outro/.test(r.texto), 'mover uma pasta e um item de dentro dela na mesma lista: recusado');
  r = await rodar(mover, { itens: [{ de: 'Anotações\\Listas', para: 'Anotações\\Listas\\Dentro' }] });
  ok(!r.ok && /dentro dela mesma/.test(r.texto), 'mover uma pasta para dentro dela mesma: recusado');
  r = await rodar(mover, { itens: [{ de: 'Anotações\\lista.md', para: 'Arquivos\\nova-lista.md' }] });
  ok(!r.ok && /renomear/.test(r.texto), 'mover com "para" que parece arquivo: pede para usar renomear');
  r = await rodar(mover, { itens: [{ de: 'Anotações\\lista.md', para: '..\\fora' }] });
  ok(!r.ok && r.codigo === 'jarvis-fora', 'mover para fora da pasta do Jarvis: jarvis-fora');
  // o item some entre a preparação e a aprovação
  fs.writeFileSync(path.join(raizR, 'Arquivos', 'some.txt'), 'x');
  r = await rodar(mover, { itens: [{ de: 'Arquivos\\some.txt', para: 'Anotações' }] });
  acao = ultimo('acao');
  fs.unlinkSync(path.join(raizR, 'Arquivos', 'some.txt'));
  dd = await decidir(acao.id, 'confirmar');
  ok(!dd.ok && /Não achei/.test(dd.mensagem), `mover de item que sumiu antes da aprovação: falha com mensagem clara ("${dd.mensagem}")`);

  /* ---------- renomear (só com aprovação) ---------- */
  const pdf = path.join(raizR, 'Arquivos', 'relatorio.pdf');
  r = await rodar(renomear, { caminho: 'Arquivos\\relatorio.pdf', novo_nome: 'Relatório: final' });
  acao = ultimo('acao');
  ok(r.ok && acao?.tipo === 'renomear' && acao.detalhe.de === 'relatorio.pdf' && acao.detalhe.para === 'Relatório — final.pdf' && acao.detalhe.pasta === 'Arquivos', 'renomear: só prepara; mantém o .pdf e troca ":" (cartão "antes → depois")');
  ok(existe(pdf), 'renomear: nada mudou antes da aprovação');
  dd = await decidir(acao.id, 'recusar');
  ok(existe(pdf), 'renomear recusado: nada mudou');
  r = await rodar(renomear, { caminho: 'Arquivos\\relatorio.pdf', novo_nome: 'Relatório final.pdf' });
  acao = ultimo('acao');
  dd = await decidir(acao.id, 'confirmar');
  ok(dd.ok && !existe(pdf) && existe(path.join(raizR, 'Arquivos', 'Relatório final.pdf')), 'renomear aprovado: virou "Relatório final.pdf"');
  r = await rodar(renomear, { caminho: 'Arquivos\\Relatório final.pdf', novo_nome: 'relatorio (2)' });
  ok(!r.ok && r.codigo === 'jarvis-existe', 'renomear para um nome que existe: jarvis-existe');
  r = await rodar(renomear, { caminho: 'Arquivos\\Relatório final.pdf', novo_nome: 'virus.exe' });
  ok(!r.ok && r.codigo === 'jarvis-extensao', 'renomear trocando a extensão (.pdf → .exe): recusado');
  r = await rodar(renomear, { caminho: 'Prints', novo_nome: 'Fotos' });
  ok(!r.ok && r.codigo === 'jarvis-estrutura', 'renomear a pasta Prints: jarvis-estrutura');
  r = await rodar(renomear, { caminho: '', novo_nome: 'OUTRA' });
  ok(!r.ok, 'renomear a raiz: recusado');
  r = await rodar(renomear, { caminho: 'Arquivos\\Relatório final.pdf', novo_nome: 'relatório FINAL' });
  acao = ultimo('acao');
  dd = await decidir(acao.id, 'confirmar');
  ok(dd.ok && fs.readdirSync(path.join(raizR, 'Arquivos')).includes('relatório FINAL.pdf'), 'renomear só maiúscula/minúscula funciona');

  /* ---------- alterar_texto (só com aprovação) ---------- */
  const notaAlt = path.join(raizR, 'Anotações', 'lista.md');
  const antesAlt = fs.readFileSync(notaAlt, 'utf8');
  r = await rodar(alterarTexto, { caminho: 'Anotações\\lista.md', modo: 'acrescentar', texto: '- três\npassword: segredo1' });
  acao = ultimo('acao');
  ok(r.ok && acao?.tipo === 'alterar' && acao.detalhe.modo === 'acrescentar' && acao.detalhe.depois.includes('- três') && !acao.detalhe.depois.includes('segredo1'), 'alterar_texto: só prepara (cartão com "antes" e "depois", senha mascarada)');
  ok(fs.readFileSync(notaAlt, 'utf8') === antesAlt, 'alterar_texto: nada mudou antes da aprovação');
  const agoraReal = Date.now;
  Date.now = () => agoraReal() + 6 * 60 * 1000;   // passou dos 5 minutos
  dd = await decidir(acao.id, 'confirmar');
  Date.now = agoraReal;
  ok(dd.status === 410 && fs.readFileSync(notaAlt, 'utf8') === antesAlt, 'alterar_texto vencido (5 min): aprovar não muda nada');
  r = await rodar(alterarTexto, { caminho: 'Anotações\\lista.md', modo: 'acrescentar', texto: '- três' });
  acao = ultimo('acao');
  dd = await decidir(acao.id, 'confirmar');
  ok(dd.ok && fs.readFileSync(notaAlt, 'utf8') === antesAlt + (antesAlt.endsWith('\n') ? '' : '\n') + '- três\n', 'alterar_texto aprovado: acrescentou no fim');
  r = await rodar(alterarTexto, { caminho: 'Anotações\\lista.md', modo: 'trocar_trecho', trecho_antigo: '- três', texto: '- 3' });
  acao = ultimo('acao');
  dd = await decidir(acao.id, 'confirmar');
  ok(dd.ok && fs.readFileSync(notaAlt, 'utf8').includes('- 3') && !fs.readFileSync(notaAlt, 'utf8').includes('- três'), 'trocar_trecho aprovado');
  r = await rodar(alterarTexto, { caminho: 'Anotações\\lista.md', modo: 'trocar_trecho', trecho_antigo: 'não tem isso', texto: 'x' });
  ok(!r.ok && /Não achei esse trecho/.test(r.texto), 'trocar_trecho sem o trecho: recusado');
  fs.writeFileSync(path.join(raizR, 'Arquivos', 'dobro.txt'), 'abc abc');
  r = await rodar(alterarTexto, { caminho: 'Arquivos\\dobro.txt', modo: 'trocar_trecho', trecho_antigo: 'abc', texto: 'x' });
  ok(!r.ok && /2 vezes/.test(r.texto), 'trocar_trecho com o trecho duas vezes: recusado');
  r = await rodar(alterarTexto, { caminho: 'Arquivos\\dobro.txt', modo: 'substituir_tudo', texto: 'novo' });
  acao = ultimo('acao');
  fs.writeFileSync(path.join(raizR, 'Arquivos', 'dobro.txt'), 'alguém mudou por fora');
  dd = await decidir(acao.id, 'confirmar');
  ok(!dd.ok && /mudou/.test(dd.mensagem) && fs.readFileSync(path.join(raizR, 'Arquivos', 'dobro.txt'), 'utf8') === 'alguém mudou por fora', 'alterar_texto com o arquivo mudado depois da preparação: jarvis-mudou, nada gravado');
  r = await rodar(alterarTexto, { caminho: 'Arquivos\\relatório FINAL.pdf', modo: 'acrescentar', texto: 'x' });
  ok(!r.ok && r.codigo === 'jarvis-extensao', 'alterar_texto num .pdf: recusado');
  fs.writeFileSync(path.join(raizR, 'Arquivos', 'latin1.txt'), Buffer.from([0x63, 0xe7, 0xe3, 0x6f]));   // "ção" em windows-1252
  r = await rodar(alterarTexto, { caminho: 'Arquivos\\latin1.txt', modo: 'acrescentar', texto: 'x' });
  ok(!r.ok && /UTF-8/.test(r.texto), 'alterar_texto num arquivo que não é UTF-8: recusado (não estraga os acentos)');

  /* ---------- apagar (só com aprovação, para a Lixeira) ---------- */
  const alvoApagar = path.join(raizR, 'Arquivos', 'lista.md');
  fs.writeFileSync(alvoApagar, 'para a Lixeira');
  r = await rodar(apagar, { itens: ['Arquivos\\lista.md', 'Arquivos\\Fornecedores'] });
  acao = ultimo('acao');
  ok(r.ok && acao?.tipo === 'apagar' && acao.detalhe.destino === 'Lixeira do Windows' && acao.detalhe.total === 2 && acao.detalhe.itens[1].tipo === 'pasta' && acao.detalhe.itens[1].arquivos === 1, 'apagar: só prepara (cartão com a lista, tamanho e "Lixeira do Windows")');
  ok(existe(alvoApagar) && naLixeira.length === 0, 'apagar: nada foi para a Lixeira antes da aprovação');
  dd = await decidir(acao.id, 'recusar');
  ok(existe(alvoApagar) && naLixeira.length === 0, 'apagar recusado: nada foi para a Lixeira');
  r = await rodar(apagar, { itens: ['Arquivos\\lista.md', 'Arquivos\\Fornecedores'] });
  acao = ultimo('acao');
  Date.now = () => agoraReal() + 6 * 60 * 1000;
  dd = await decidir(acao.id, 'confirmar');
  Date.now = agoraReal;
  ok(dd.status === 410 && existe(alvoApagar) && naLixeira.length === 0, 'apagar vencido: aprovar não apaga');
  r = await rodar(apagar, { itens: ['Arquivos\\lista.md', 'Arquivos\\Fornecedores'] });
  acao = ultimo('acao');
  dd = await decidir(acao.id, 'confirmar');
  ok(dd.ok && !existe(alvoApagar) && !existe(path.join(raizR, 'Arquivos', 'Fornecedores')) && naLixeira.length === 2 && /Lixeira/.test(dd.mensagem), 'apagar aprovado: os dois foram para a Lixeira (a falsa, aqui)');
  ok(naLixeira[1].tipo === 'pasta' && naLixeira[1].tamanho === 2048, 'a Lixeira recebe o tipo e o tamanho (para conferir se cabe)');
  for (const est of ['Prints', 'Projetos', '.', 'JARVIS', 'Anotações\\']) {
    r = await rodar(apagar, { itens: [est] });
    ok(!r.ok && r.codigo === 'jarvis-estrutura', `apagar "${est}": jarvis-estrutura`);
  }
  ok(await errou(P.lixeira(path.join(raizR, 'Planilhas')), 'jarvis-estrutura') === true, 'P.lixeira direto na estrutura: jarvis-estrutura');
  r = await rodar(apagar, { itens: [path.join(fora, 'segredo.txt')] });
  ok(!r.ok && r.codigo === 'jarvis-fora' && existe(path.join(fora, 'segredo.txt')), 'apagar fora da pasta do Jarvis: jarvis-fora');
  if (temJuncao) {
    await fsp.mkdir(path.join(raizR, 'Arquivos', 'com-juncao'), { recursive: true });
    fs.symlinkSync(fora, path.join(raizR, 'Arquivos', 'com-juncao', 'atalho2'), 'junction');
    r = await rodar(apagar, { itens: ['Arquivos\\com-juncao'] });
    ok(!r.ok && r.codigo === 'jarvis-lixeira' && existe(path.join(fora, 'segredo.txt')), 'apagar pasta com junção dentro: recusado (o Júlio apaga pelo Explorer)');
    fs.rmdirSync(path.join(raizR, 'Arquivos', 'com-juncao', 'atalho2'));
  }
  const muitos = path.join(raizR, 'Arquivos', 'muitos');
  await fsp.mkdir(muitos, { recursive: true });
  for (let i = 0; i < 2001; i++) fs.writeFileSync(path.join(muitos, `${i}.txt`), '');
  r = await rodar(apagar, { itens: ['Arquivos\\muitos'] });
  ok(!r.ok && r.codigo === 'jarvis-grande', 'apagar mais de 2.000 arquivos: jarvis-grande (o Júlio apaga ele mesmo)');
  ok(await errou(P.lixeira(muitos), 'jarvis-grande') === true && existe(muitos), 'P.lixeira direto (a rota) numa pasta grande demais: jarvis-grande, nada apagado');
  // o PowerShell não respondeu: se o item saiu do lugar, foi para a Lixeira (sem conferir); se ficou, nada foi apagado
  const Pmudo = criarPastaJarvis({ raiz, log: () => {}, tipoDisco: async () => 'Fixed', abridor: abridorFalso,
    lixeira: async (abs) => { await fsp.rename(abs, path.join(lixoFalso, 'mudo-' + path.basename(abs))); return { ok: false, erro: 'powershell' }; } });
  fs.writeFileSync(path.join(raizR, 'Arquivos', 'mudo.txt'), 'x');
  const rm = await Pmudo.lixeira(path.join(raizR, 'Arquivos', 'mudo.txt'));
  ok(rm.ok && rm.conferido === false, 'PowerShell sem resposta, mas o item saiu do lugar: "foi, sem conferir" (nunca diz que nada foi apagado)');
  const Pfalha = criarPastaJarvis({ raiz, log: () => {}, tipoDisco: async () => 'Fixed', abridor: abridorFalso, lixeira: async () => ({ ok: false, erro: 'powershell' }) });
  fs.writeFileSync(path.join(raizR, 'Arquivos', 'fica.txt'), 'x');
  ok(await errou(Pfalha.lixeira(path.join(raizR, 'Arquivos', 'fica.txt')), 'jarvis-lixeira') === true && existe(path.join(raizR, 'Arquivos', 'fica.txt')), 'PowerShell sem resposta e o item ficou: jarvis-lixeira ("nada foi apagado")');
  const Ppequena = criarPastaJarvis({ raiz, log: () => {}, tipoDisco: async () => 'Fixed', abridor: abridorFalso, lixeira: async () => ({ ok: false, erro: 'lixeira-pequena' }) });
  const ep = await Ppequena.lixeira(path.join(raizR, 'Arquivos', 'fica.txt')).catch(e => e);
  ok(ep.codigo === 'jarvis-lixeira' && /não cabe/.test(ep.message) && existe(path.join(raizR, 'Arquivos', 'fica.txt')), 'item que não cabe na Lixeira: recusado com o motivo');
  r = await rodar(apagar, { itens: ['Arquivos\\relatório FINAL.pdf', 'Arquivos\\relatório FINAL.pdf'] });
  ok(!r.ok && /duas vezes/.test(r.texto), 'apagar o mesmo item duas vezes na lista: recusado');

  /* ---------- abrir no Windows ---------- */
  for (const nome of ['x.bat', 'app.js', 'programa.exe', 'atalho.lnk', 'x.vbs', 'x.hta', 'x.ps1']) fs.writeFileSync(path.join(raizR, 'Arquivos', nome), 'x');
  for (const nome of ['x.bat', 'app.js', 'programa.exe', 'atalho.lnk', 'x.vbs', 'x.hta', 'x.ps1']) {
    r = await rodar(abrirNoWindows, { caminho: `Arquivos\\${nome}` });
    ok(!r.ok && r.codigo === 'jarvis-extensao', `abrir_no_windows recusa ${nome}`);
  }
  ok(abertos.length === 0, 'nada foi aberto nas recusas');
  fs.writeFileSync(path.join(raizR, 'Planilhas', 'teste.xlsx'), 'x');
  r = await rodar(abrirNoWindows, { caminho: 'Planilhas\\teste.xlsx' });
  ok(r.ok && abertos.at(-1)?.modo === 'abrir' && abertos.at(-1).abs === path.join(raizR, 'Planilhas', 'teste.xlsx'), 'abrir_no_windows: planilha no programa padrão');
  r = await rodar(abrirNoWindows, { caminho: 'Planilhas\\teste.xlsx', modo: 'mostrar_na_pasta' });
  ok(r.ok && abertos.at(-1)?.modo === 'mostrar', 'abrir_no_windows: mostrar na pasta');
  r = await rodar(abrirNoWindows, { caminho: 'Planilhas' });
  ok(r.ok && abertos.at(-1)?.modo === 'pasta', 'abrir_no_windows: pasta no Explorer');
  r = await rodar(abrirNoWindows, { caminho: path.join(fora, 'relatorio.pdf') });
  ok(!r.ok && r.codigo === 'jarvis-fora', 'abrir_no_windows fora da pasta do Jarvis: jarvis-fora');
  const nAbertos = abertos.length;
  ok(await errou(P.abrirNoWindows(path.join(raizR, 'Arquivos', 'x.bat')), 'jarvis-extensao') === true && abertos.length === nAbertos, 'P.abrirNoWindows (a rota da tela) também recusa .bat');

  /* ---------- página HTML: criar com a trava; abrir no navegador só com a aprovação "abrir" ---------- */
  r = await rodar(criarArquivo, { nome: 'Página de teste', tipo: 'html', conteudo: '<!doctype html><html><head><meta charset="utf-8"><title>t</title><script>location.href = "https://fora.example/?d=" + 1</script></head><body>oi</body></html>' });
  const htmlCriado = r.ok ? fs.readFileSync(path.join(raizR, r.d.criado), 'utf8') : '';
  ok(r.ok && /data-jarvis="trava"/.test(htmlCriado) && /connect-src 'none'/.test(htmlCriado) && htmlCriado.indexOf('data-jarvis') < htmlCriado.indexOf('<script'), 'criar_arquivo html: a página sai com a trava do Jarvis (CSP sem rede) antes do script');
  eventos.length = 0;
  const nAb = abertos.length;
  r = await rodar(abrirNoWindows, { caminho: r.d.criado });
  const acAbrir = ultimo('acao');
  ok(r.ok && r.d.situacao === 'aguardando_aprovacao' && acAbrir?.tipo === 'abrir' && /Página de teste\.html/.test(acAbrir.resumo) && abertos.length === nAb, `abrir_no_windows de .html: vira a ação "abrir" e nada abre antes (${acAbrir?.resumo})`);
  ok(await errou(P.abrirNoWindows(path.join(raizR, 'Arquivos', 'Página de teste.html')), 'jarvis-pagina') === true && abertos.length === nAb, 'P.abrirNoWindows de .html sem pagina: true também recusa');
  const decAbrir = await decidir(acAbrir.id, 'confirmar', undefined, 'voz');
  ok(decAbrir.ok && abertos.length === nAb + 1 && abertos.at(-1).modo === 'abrir' && /\.html$/.test(abertos.at(-1).abs) && decAbrir.fala === 'Abri a página no navegador.', `aprovado por voz: abriu no navegador padrão (${decAbrir.mensagem})`);
  tirarAvisos(ABA);
  r = await rodar(abrirNoWindows, { caminho: 'Arquivos\\Página de teste.html', modo: 'mostrar_na_pasta' });
  ok(r.ok && abertos.at(-1).modo === 'mostrar', 'mostrar a página na pasta (Explorer) continua livre');
  await P.abrirNoWindows(path.join(raizR, 'Arquivos', 'Página de teste.html'), { pagina: true });
  ok(abertos.at(-1).modo === 'abrir', 'com pagina: true (o clique do Júlio no cartão) abre direto');

  /* ---------- Lixeira em lote: um PowerShell só para a lista inteira ---------- */
  {
    const lotes = [];
    const Plote = criarPastaJarvis({
      raiz, log: () => {}, abridor: abridorFalso, tipoDisco: async () => 'Fixed',
      lixeiraLote: async (lista) => {
        lotes.push(lista.map(x => path.basename(x.abs)));
        const itens = [];
        for (const x of lista) { await fsp.rename(x.abs, path.join(lixoFalso, `lote-${path.basename(x.abs)}`)); itens.push({ ok: true, conferido: true }); }
        return { ok: true, itens };
      },
    });
    for (const n of ['l1.txt', 'l2.txt', 'l3.txt']) fs.writeFileSync(path.join(raizR, 'Arquivos', n), n);
    const ctxLote = { ...ctx, jarvis: Plote };
    const rl = await executarFerramenta(apagar, { itens: ['Arquivos\\l1.txt', 'Arquivos\\l2.txt', 'Arquivos\\l3.txt'] }, ctxLote);
    const dl = await decidir(JSON.parse(rl.texto).acao_id, 'confirmar', undefined, 'voz');
    ok(dl.ok && lotes.length === 1 && lotes[0].join(',') === 'l1.txt,l2.txt,l3.txt' && !['l1.txt', 'l2.txt', 'l3.txt'].some(n => existe(path.join(raizR, 'Arquivos', n))), `apagar 3 itens: um lote só para a Lixeira (${lotes.length} chamada)`);
    ok(/^Mandei 3 itens para a Lixeira\. Dá para restaurar\.$/.test(dl.fala || '') && !/[\\/]/.test(dl.fala), `a fala do fim, sem caminho: "${dl.fala}"`);
    tirarAvisos(ABA);
  }

  /* ---------- nota com dado de pessoa não vai para Projetos ---------- */
  fs.writeFileSync(path.join(fora, 'Nota pessoal.md'), '---\ntipo: nota\nrepositorio: nao\n---\n# Salários\n');
  r = await rodar(copiarParaJarvis, { de: path.join(fora, 'Nota pessoal.md'), para: 'Projetos\\bi-rh' });
  ok(!r.ok && r.codigo === 'jarvis-pessoal' && !existe(path.join(raizR, 'Projetos', 'bi-rh', 'Nota pessoal.md')), 'copiar nota com "repositorio: nao" para Projetos: recusado (o construtor leria)');
  r = await rodar(copiarParaJarvis, { de: path.join(fora, 'Nota pessoal.md'), para: 'Arquivos' });
  ok(r.ok, 'a mesma nota para Arquivos: copia (fica no OneDrive do Júlio)');
  fs.unlinkSync(path.join(fora, 'Nota pessoal.md'));

  /* ---------- planilha de uma lista ---------- */
  const colunas = [
    { titulo: 'Filial', tipo: 'texto' }, { titulo: 'Data', tipo: 'data' }, { titulo: 'Venda', tipo: 'dinheiro' },
    { titulo: 'Pedidos', tipo: 'inteiro' }, { titulo: 'Margem', tipo: 'percentual' }, { titulo: 'Código do produto', tipo: 'texto' },
  ];
  const linhas = [
    ['1', '2026-10-01', 1200000.5, 312, 0.183, '000123'],
    ['7', '01/10/2026', 'R$ 640.000,00', '155', '15,1%', '000124'],
    ['10', '2026-10-02', 410000.25, 98, 0.122, '004410'],
    ['11', '2026-10-02', null, 0, null, '=1+1'],
  ];
  r = await rodar(criarPlanilha, { nome: 'Vendas por filial', aba: 'Vendas', colunas, linhas });
  ok(r.ok && /^Planilhas\\Vendas por filial — \d{4}-\d{2}-\d{2}\.xlsx$/.test(r.d.criada) && r.d.linhas === 4 && r.d.colunas === 6, `criar_planilha: ${r.d?.criada}`);
  const xlsx = path.join(raizR, r.d.criada);
  const cartaoPl = ultimo('cartao');
  ok(cartaoPl?.tipo === 'planilha' && cartaoPl.dados.total_linhas === 4 && cartaoPl.dados.colunas.length === 6 && cartaoPl.dados.arquivo.id.startsWith('arq_'), 'criar_planilha: cartão "planilha" com o id do arquivo');
  ok(cartaoPl.dados.linhas[0][2] === 'R$ 1.200.000,50' && cartaoPl.dados.linhas[0][1] === '01/10/2026' && cartaoPl.dados.linhas[0][4] === '18,3%' && cartaoPl.dados.linhas[1][2] === 'R$ 640.000,00', 'o cartão mostra os valores formatados em pt-BR');
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsx);
  const ws = wb.getWorksheet('Vendas');
  ok(!!ws, 'a aba se chama "Vendas"');
  const c = (ref) => ws.getCell(ref);
  ok(c('B2').value instanceof Date && c('B2').value.getTime() === Date.UTC(2026, 9, 1) && c('B2').numFmt === 'dd/mm/yyyy', 'data é Date (01/10/2026, sem andar com o fuso) com dd/mm/yyyy');
  ok(c('B3').value instanceof Date && c('B3').value.getTime() === Date.UTC(2026, 9, 1), '"01/10/2026" também vira data');
  ok(c('C2').value === 1200000.5 && c('C2').numFmt === '"R$" #,##0.00' && c('C3').value === 640000, 'dinheiro é número com "R$" (e "R$ 640.000,00" vira 640000)');
  ok(c('D2').value === 312 && c('D2').numFmt === '#,##0' && c('D3').value === 155, 'inteiro é número (e "155" vira 155)');
  ok(c('E2').value === 0.183 && c('E2').numFmt === '0.0%' && Math.abs(c('E3').value - 0.151) < 1e-12, 'percentual é fração (e "15,1%" vira 0,151)');
  ok(c('F2').value === '000123' && c('F5').value === '=1+1' && c('A2').value === '1', 'texto fica texto: "000123", "=1+1" e a filial "1"');
  ok(c('C5').value === null || c('C5').value === undefined, 'vazio fica vazio');
  ok(String(ws.autoFilter?.ref || ws.autoFilter) === 'A1:F5' || JSON.stringify(ws.autoFilter).includes('A1:F5'), `filtro no intervalo dos dados (${JSON.stringify(ws.autoFilter)})`);
  ok(ws.views?.[0]?.state === 'frozen' && ws.views[0].ySplit === 1, 'cabeçalho congelado (linha 1)');
  const h = c('A1');
  ok(h.font?.bold && h.font?.color?.argb === 'FFFFFFFF' && h.fill?.fgColor?.argb === 'FF2A41C8' && ws.getRow(1).height === 20, 'cabeçalho negrito branco sobre o azul da Lube, altura 20');
  ok(c('A6').value === 'Total' && c('C6').value?.formula === 'SUBTOTAL(9,C2:C5)' && Math.abs(c('C6').value.result - 2250000.75) < 0.001, `linha Total com SUBTOTAL e o resultado calculado (${JSON.stringify(c('C6').value)})`);
  ok(c('D6').value?.formula === 'SUBTOTAL(9,D2:D5)' && c('D6').value.result === 565 && (c('E6').value == null), 'Total só em dinheiro e inteiro (percentual fica sem)');
  ok([1, 2, 3, 4, 5, 6].every(i => ws.getColumn(i).width >= 8 && ws.getColumn(i).width <= 60) && ws.getColumn(6).width > ws.getColumn(1).width, 'largura das colunas pelo maior texto, entre 8 e 60');
  const lido = await extrairTexto(fs.readFileSync(xlsx), 'xlsx');
  ok(/Filial/.test(lido) && /000123/.test(lido) && /=1\+1/.test(lido) && /2250000\.75/.test(lido), 'o extrair.js do Jarvis lê de volta (com o total)');
  const pelaFerramenta = await executarFerramenta(lerArquivo, { caminho: xlsx }, ctx);
  ok(pelaFerramenta.ok && /Vendas/.test(pelaFerramenta.texto) && /000124/.test(pelaFerramenta.texto), 'o ler_arquivo do Jarvis lê a planilha');
  r = await rodar(criarPlanilha, { nome: 'Vendas por filial', colunas, linhas });
  ok(r.ok && / \(2\)\.xlsx$/.test(r.d.criada), 'planilha com o mesmo nome no mesmo dia: " (2)", nunca por cima');
  r = await rodar(criarPlanilha, { nome: 'Sem tipo', colunas: [{ titulo: 'Quando' }, { titulo: 'Valor total' }, { titulo: 'Qtde' }, { titulo: 'Nome' }], linhas: [['2026-10-20', 10.5, 3, 'a'], ['2026-10-21', 2.25, 4, 'b']] });
  ok(r.ok && r.d.tipos.Quando === 'data' && r.d.tipos['Valor total'] === 'dinheiro' && r.d.tipos.Qtde === 'inteiro' && r.d.tipos.Nome === 'texto', `sem tipo, pelos valores (${JSON.stringify(r.d?.tipos)})`);
  r = await rodar(criarPlanilha, { nome: 'Formatos', colunas: [{ titulo: 'Código' }, { titulo: 'Valor' }], linhas: [[123, 5]], formatos: { 'Código': 'texto', 'Não existe': 'inteiro' } });
  ok(r.ok && r.d.tipos['Código'] === 'texto' && /Não existe/.test(r.d.aviso || ''), 'formatos troca o tipo; coluna desconhecida vira aviso');
  r = await rodar(criarPlanilha, { nome: 'x', colunas: [{ titulo: 'a' }], linhas: [[1, 2]] });
  ok(!r.ok && /2 valores/.test(r.texto), 'linha com mais valores que colunas: recusada');
  r = await rodar(criarPlanilha, { nome: 'x', sql: 'select 1', colunas: [{ titulo: 'a' }] });
  ok(!r.ok && /OU/.test(r.texto), 'sql e colunas juntos: recusado');
  r = await rodar(criarPlanilha, { nome: 'x' });
  ok(!r.ok && /Falta de onde/.test(r.texto), 'sem sql e sem colunas: recusado');
  r = await rodar(criarPlanilha, { nome: 'x', colunas: [{ titulo: 'a' }], linhas: [[1]], formatos: { a: 'moeda' } });
  ok(!r.ok && /não existe/.test(r.texto), 'formato que não existe: recusado');
  ok(numeroDe('1.234,56') === 1234.56 && numeroDe('1,234.56') === 1234.56 && numeroDe('1.234.567') === 1234567 && numeroDe('abc') === null && numeroDe('R$ 10') === 10, 'numeroDe: jeito brasileiro e americano');
  ok(dataDe('31/02/2026') === null && dataDe('2026-13-01') === null && dataDe('1899-12-31') === null && dataDe('2026-10-20 14:55', true).getTime() === Date.UTC(2026, 9, 20, 14, 55), 'dataDe: data que não existe fica texto; hora certa');

  /* ---------- planilha de uma consulta (banco falso) ---------- */
  respostaBanco = {
    colunas: ['filial', 'dia', 'valor_venda', 'pedidos', 'atualizado'],
    linhas: [['1', '2026-10-01', 1500.5, 10, '2026-10-20 14:55:03'], ['7', '2026-10-02', 99.9, 2, '2026-10-20 15:00:00']],
    linhas_devolvidas: 2, mais_linhas: true, tipos: [1043, 1082, 1700, 20, 1184],
  };
  r = await rodar(criarPlanilha, { nome: 'Do banco', sql: 'select filial, dia, valor_venda, pedidos, atualizado from comercial.venda' });
  ok(r.ok && r.d.tipos.filial === 'texto' && r.d.tipos.dia === 'data' && r.d.tipos.valor_venda === 'dinheiro' && r.d.tipos.pedidos === 'inteiro' && r.d.tipos.atualizado === 'data_hora', `do banco: tipo pela coluna do Postgres (${JSON.stringify(r.d?.tipos)})`);
  ok(consultas.at(-1)?.opcoes.maxLinhas === 50000 && consultas.at(-1)?.opcoes.celulaMax === 2000, 'pede ao banco até 50 mil linhas e células de 2 mil');
  ok(/primeiras 2 linhas/.test(r.d.aviso || '') && /primeiras 2 linhas/.test(ultimo('cartao')?.dados?.aviso || ''), 'mais_linhas: o modelo e o cartão avisam que ficou incompleta');
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(path.join(raizR, r.d.criada));
  const w2 = wb2.worksheets[0];
  ok(w2.name === 'Dados' && w2.getCell('E2').value.getTime() === Date.UTC(2026, 9, 20, 14, 55, 3) && w2.getCell('E2').numFmt === 'dd/mm/yyyy hh:mm', 'data_hora do banco com a hora de Brasília, dd/mm/yyyy hh:mm; aba "Dados"');
  respostaBanco = { colunas: ['dia', 'total'], linhas: [['2026-10-01', 3], ['2026-10-02', 4]], linhas_devolvidas: 2, mais_linhas: false };
  r = await rodar(criarPlanilha, { nome: 'Sem OID', sql: 'select dia, total from comercial.x' });
  ok(r.ok && r.d.tipos.dia === 'data' && r.d.tipos.total === 'inteiro' && !r.d.aviso, 'banco sem os tipos (o de hoje): pelos valores');
  // código e rótulo (filial, produto, ano) não somam nem ganham ponto de milhar; numeric sem casas vira inteiro
  respostaBanco = {
    colunas: ['CODFILIAL', 'Código do produto', 'Ano', 'Venda', 'Pedidos', 'Peso total', 'Total de pedidos'],
    linhas: [[1, 12345, 2026, 1200.5, 812, 10.5, 3], [7, 23456, 2026, 640, 455, 2.25, 5]],
    linhas_devolvidas: 2, mais_linhas: false, tipos: [23, 1700, 23, 1700, 20, 1700, 1700],
  };
  r = await rodar(criarPlanilha, { nome: 'Códigos', sql: 'select 1 from comercial.x' });
  ok(r.ok && r.d.tipos.CODFILIAL === 'codigo' && r.d.tipos['Código do produto'] === 'codigo' && r.d.tipos.Ano === 'codigo' && r.d.tipos.Venda === 'dinheiro'
    && r.d.tipos.Pedidos === 'inteiro' && r.d.tipos['Peso total'] === 'numero' && r.d.tipos['Total de pedidos'] === 'inteiro', `código, ano e "total" que não é dinheiro (${JSON.stringify(r.d?.tipos)})`);
  const cartaoCod = ultimo('cartao');
  ok(cartaoCod?.dados?.tipos?.slice(0, 4).join('|') === 'código|código|código|R$' && cartaoCod.dados.linhas[0][1] === '12345', `o cartão mostra o tipo de cada coluna e o código sem ponto de milhar (${cartaoCod?.dados?.tipos?.join(', ')})`);
  {
    const wb3 = new ExcelJS.Workbook();
    await wb3.xlsx.readFile(path.join(raizR, r.d.criada));
    const w3 = wb3.worksheets[0];
    ok(w3.getCell('A2').numFmt === '0' && w3.getCell('B2').value === 12345 && w3.getCell('B2').numFmt === '0', 'no Excel, o código é número sem ponto de milhar (formato 0)');
    ok(w3.getCell('A4').value === 'Total' && w3.getCell('B4').value == null && w3.getCell('C4').value == null && w3.getCell('D4').value?.formula && w3.getCell('E4').value?.result === 1267 && w3.getCell('G4').value?.result === 8,
      'o Total soma venda, pedidos e o total de pedidos, e deixa a filial, o produto e o ano de fora');
  }
  const semBanco = await executarFerramenta(criarPlanilha, { nome: 'x', sql: 'select 1' }, { ...ctx, banco: { configurado: false } });
  ok(!semBanco.ok && semBanco.codigo === 'sem-banco', 'sem banco no ENV: sem-banco');
  const semPasta = await executarFerramenta(anotar, { titulo: 'x', texto: 'y' }, { ...ctx, jarvis: undefined });
  ok(!semPasta.ok && semPasta.codigo === 'jarvis-sem-pasta', 'sem a pasta do Jarvis no ctx: nada é gravado (jarvis-sem-pasta)');

  /* ---------- tamanho: 5 mil linhas (o máximo de uma lista) ---------- */
  const t0 = Date.now();
  const grandes = Array.from({ length: 5000 }, (_, i) => [`Produto ${i}`, '2026-10-01', i * 1.5, i, 0.1, String(i).padStart(6, '0')]);
  r = await rodar(criarPlanilha, { nome: 'Grande', colunas, linhas: grandes });
  const ms = Date.now() - t0;
  ok(r.ok && r.d.linhas === 5000 && ms < 30000, `5 mil linhas × 6 colunas em ${ms} ms`);
  // o maior que vem do banco (50 mil linhas × 12 colunas), só na memória: o escritor em fluxo não estoura a memória do servidor
  const t1 = Date.now(), m1 = process.memoryUsage().rss;
  const enorme = await montarPlanilha({
    titulos: Array.from({ length: 12 }, (_, i) => `coluna ${i}`), oids: [1043, 1082, 1700, 20, 701, 1043, 1043, 1043, 1700, 23, 1184, 25],
    linhas: Array.from({ length: 50000 }, (_, i) => ['1', '2026-10-01', i * 1.25, i % 300, 0.18, String(i), `Produto ${i}`, 'F', i * 0.8, i % 40, '2026-10-20 14:55:03', '']),
  });
  const mb = Math.round((process.memoryUsage().rss - m1) / 1048576);
  ok(enorme.linhas === 50000 && enorme.buf.length > 1e6 && Date.now() - t1 < 60000 && mb < 500, `50 mil linhas × 12 colunas em ${Date.now() - t1} ms, +${mb} MB de memória`);

  /* ---------- nada fora ---------- */
  ok(fs.readdirSync(fora).sort().join('|') === foraAntes && fs.readFileSync(path.join(fora, 'segredo.txt'), 'utf8') === 'não é para sair daqui', 'a pasta de fora continua igual');
  ok(fotoReal() === realAntes, `a pasta JARVIS de verdade não foi criada nem mexida (${realAntes})`);
  ok(fs.readdirSync(tmp).sort().join('|') === ['JARVIS', 'fora', 'lixeira-falsa'].sort().join('|'), 'nada além da pasta de teste na pasta temporária');
} catch (e) {
  falhas++;
  console.log('FALHOU com erro inesperado:', e?.stack || e);
}

/* ---------- a Lixeira de verdade (só com TESTE_LIXEIRA=1) ---------- */
if (process.env.TESTE_LIXEIRA === '1' && process.platform === 'win32') {
  const tmp2 = await fsp.mkdtemp(path.join(os.tmpdir(), 'jarvis-lixeira-'));
  const P2 = criarPastaJarvis({ raiz: path.join(tmp2, 'JARVIS'), log: () => {} });
  const raiz2 = await P2.raizReal();
  const sufixo = crypto.randomBytes(4).toString('hex');
  const arq = path.join(raiz2, 'Arquivos', `jarvis-teste-lixeira-${sufixo}.txt`);
  const pasta = path.join(raiz2, 'Arquivos', `jarvis-teste-pasta-${sufixo}`);
  fs.writeFileSync(arq, 'teste da Lixeira');
  await fsp.mkdir(pasta);
  fs.writeFileSync(path.join(pasta, 'dentro.txt'), 'x');
  // o item que não cabe na Lixeira não pode ir (o Windows apagaria de vez sem perguntar): nada acontece
  const grande = await lixeiraPadrao(arq, { tipo: 'arquivo', tamanho: 1e15 });
  ok(!grande.ok && grande.erro === 'lixeira-pequena' && existe(arq), `Lixeira de verdade: item maior que a Lixeira é recusado antes, nada apagado (${grande.erro})`);
  const t = Date.now();
  let r1 = null, r2 = null;
  try { r1 = await P2.lixeira(arq); r2 = await P2.lixeira(pasta); } catch (e) { console.log('Lixeira: erro', e?.codigo, e?.message); }
  ok(r1?.ok && r1.conferido && !existe(arq), `Lixeira de verdade: o arquivo foi e está lá (${Date.now() - t} ms para os dois)`);
  ok(r2?.ok && r2.conferido && !existe(pasta), 'Lixeira de verdade: a pasta foi e está lá');
  // restaura os dois (para não deixar lixo na Lixeira do Júlio)
  const restaurar = String.raw`$lix = (New-Object -ComObject Shell.Application).Namespace(10); $n = 0
foreach ($i in @($lix.Items())) { $nm = $i.ExtendedProperty('System.FileName'); if (($nm -ieq $env:N1 -or $nm -ieq $env:N2) -and ($lix.GetDetailsOf($i, 1) -ieq $env:ORIGEM)) { $i.InvokeVerb('undelete'); $n++ } }
Start-Sleep -Milliseconds 1200; $n`;
  const n = await new Promise(res => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(restaurar, 'utf16le').toString('base64')],
    { windowsHide: true, timeout: 30000, env: { ...process.env, N1: path.basename(arq), N2: path.basename(pasta), ORIGEM: path.dirname(arq) } }, (err, out) => res(err ? -1 : Number(String(out).trim()))));
  ok(n === 2 && existe(arq) && existe(path.join(pasta, 'dentro.txt')), `restaurados da Lixeira: ${n} de 2`);
  // a lista inteira num PowerShell só (o apagar com vários itens): os dois vão, os dois são achados na Lixeira, e voltam
  const t2 = Date.now();
  let rl = null;
  try { rl = await P2.lixeiraLote([arq, pasta]); } catch (e) { console.log('Lixeira em lote: erro', e?.codigo, e?.message); }
  ok(rl && rl.feitos.length === 2 && rl.feitos.every(f => f.conferido) && !rl.falha && !existe(arq) && !existe(pasta), `Lixeira de verdade em lote: 2 itens num PowerShell só, os dois conferidos (${Date.now() - t2} ms)`);
  const n2 = await new Promise(res => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(restaurar, 'utf16le').toString('base64')],
    { windowsHide: true, timeout: 30000, env: { ...process.env, N1: path.basename(arq), N2: path.basename(pasta), ORIGEM: path.dirname(arq) } }, (err, out) => res(err ? -1 : Number(String(out).trim()))));
  ok(n2 === 2 && existe(arq) && existe(path.join(pasta, 'dentro.txt')), `restaurados da Lixeira (lote): ${n2} de 2`);
  await fsp.rm(tmp2, { recursive: true, force: true });
} else {
  console.log('(a Lixeira de verdade não foi testada: rode com TESTE_LIXEIRA=1)');
}

// as junções saem antes (rmdir tira só o link, nunca o destino)
for (const j of [path.join(tmp, 'JARVIS', 'Arquivos', 'atalho'), path.join(tmp, 'JARVIS', 'Arquivos', 'com-juncao', 'atalho2')]) {
  try { if (fs.lstatSync(j).isSymbolicLink()) fs.rmdirSync(j); } catch (_) { /* não existe */ }
}
await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
