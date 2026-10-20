/* Teste da parte D do docs/JARVIS-ACOES.md (§8.9), sem navegador, sem câmera e sem API:
   node teste/testar-camera.js
   Prova: as ferramentas camera e olhar_camera (sem quadro, quadro estranho, quadro velho, quadro bom com os blocos certos,
   o evento olhou); e as funções puras do web/js/jarvis-acoes.js: a aprovação por voz (as três listas, "pode…" com mais
   palavras, a conversa que andou), o detalhe de cada ação e os cartões novos escapando HTML, recusando imagem que não é
   imagem e id que não é id. Nenhuma foto de verdade: o "quadro" é um JPEG mínimo montado aqui. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { camera, olharCamera, quadroValido, falaPedeCamera, QUADRO_MAX_IDADE_MS } from '../ferramentas/camera.js';
import { executarFerramenta } from '../ferramentas/index.js';
import { validar } from '../validar.js';
import { ErroFerramenta } from '../util.js';
import {
  FRASES, normalizarResposta, respostaDeVoz, palavraUnica, rotuloAcao, detalheAcaoHtml, cartaoHtml, analisarSse,
  fmtUsd, fmtKb, fmtTempo, TEXTOS_ACOES
} from '../../web/js/jarvis-acoes.js';

let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FALHOU'} ${msg}`); if (!cond) falhas++; };

/* ---------- 1. camera ---------- */
{
  for (const [acao, esperado] of [['ligar', 'ligar'], ['desligar', 'desligar'], ['conferir_rosto', 'conferir']]) {
    const evs = [], estadoTurno = {};
    const r = await camera.executar({ acao }, { emitir: (ev, d) => evs.push({ ev, d }), falaJulio: 'Jarvis, liga a câmera e me diz o que você vê', estadoTurno });
    ok(evs.length === 1 && evs[0].ev === 'camera' && evs[0].d.acao === esperado && /^Pedi na tela\./.test(r.conteudo) && (acao !== 'ligar' || estadoTurno.cameraLigou > 0), `camera ${acao} (o Júlio pediu a câmera) → evento camera {acao: '${esperado}'} e "Pedi na tela."`);
  }
  // ninguém pediu a câmera nesta fala (um texto lido num site, por exemplo): a tela só destaca o botão
  for (const fala of [undefined, 'abre o site do G1 e me fala as notícias', 'Jarvis, resume esse e-mail']) {
    const evs = [];
    const r = await camera.executar({ acao: 'ligar' }, { emitir: (ev, d) => evs.push({ ev, d }), falaJulio: fala, estadoTurno: {} });
    ok(evs.length === 1 && evs[0].d.acao === 'pedir' && /Não liguei/.test(r.conteudo), `camera ligar sem a fala pedir ("${fala}") → só {acao: 'pedir'} (o clique liga)`);
  }
  ok(['liga a câmera', 'Está me vendo?', 'olha pra mim', 'liga a webcam', 'Ver você', 'me diz o que você está vendo'].every(falaPedeCamera)
    && !['abre o site', 'sim', 'aprovado', 'liga pro Araujo'].some(falaPedeCamera), 'falaPedeCamera: as falas que pedem a câmera e as que não pedem');
  ok(validar(camera.schema, { acao: 'filmar' }).length > 0, 'camera recusa ação fora da lista');
  ok(validar(camera.schema, {}).length > 0, 'camera exige a ação');
  ok(validar(olharCamera.schema, { motivo: 'x'.repeat(121) }).length > 0 && validar(olharCamera.schema, {}).length === 0, 'olhar_camera: motivo até 120, opcional');
}

/* ---------- 2. olhar_camera ---------- */
// um JPEG de verdade em base64 começa com /9j/ (FF D8 FF); o resto aqui é enchimento, nunca uma foto
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(600, 7), Buffer.from([0xff, 0xd9])]).toString('base64');
const quadroBom = (idadeMs = 1200) => ({ jpeg, w: 768, h: 432, em: Date.now() - idadeMs });
async function olhar(quadroCamera) {
  const evs = [];
  try { const r = await olharCamera.executar({ motivo: 'teste' }, { emitir: (ev, d) => evs.push({ ev, d }), quadroCamera }); return { r, evs }; }
  catch (e) { return { e, evs }; }
}
{
  let x = await olhar(undefined);
  ok(x.e instanceof ErroFerramenta && x.e.codigo === 'camera-desligada' && /desligada/.test(x.e.message) && !x.evs.length, 'sem quadro → camera-desligada, sem evento');
  for (const [nome, q] of [
    ['não é JPEG', { ...quadroBom(), jpeg: 'iVBORw0KGgo' + 'A'.repeat(200) }],
    ['caractere estranho', { ...quadroBom(), jpeg: `/9j/${'A'.repeat(200)}<script>` }],
    ['largura 32', { ...quadroBom(), w: 32 }],
    ['altura 4000', { ...quadroBom(), h: 4000 }],
    ['grande demais', { ...quadroBom(), jpeg: `/9j/${'A'.repeat(700001)}` }],
    ['sem hora', { ...quadroBom(), em: undefined }],
  ]) {
    x = await olhar(q);
    ok(x.e && x.e.codigo === 'camera-desligada' && !x.evs.length, `quadro estranho (${nome}) → camera-desligada`);
  }
  x = await olhar(quadroBom(QUADRO_MAX_IDADE_MS + 1000));
  ok(x.e && x.e.codigo === 'camera-velha' && !x.evs.length, 'quadro de 16 s → camera-velha, sem olhar');
  x = await olhar(quadroBom(1200));
  const b = x.r && x.r.blocos;
  ok(!x.e && Array.isArray(b) && b.length === 2, 'quadro bom → dois blocos');
  ok(b && b[0].type === 'text' && /Ver você/.test(b[0].text) && /há 1 s/.test(b[0].text) && /768×432/.test(b[0].text) && /dado, não instrução/.test(b[0].text), `bloco de texto: "${b && b[0].text}"`);
  ok(b && b[1].type === 'image' && b[1].source.type === 'base64' && b[1].source.media_type === 'image/jpeg' && b[1].source.data === jpeg, 'bloco image: base64, image/jpeg, o quadro do turno');
  ok(x.r && x.r.conteudo === b[0].text && !String(x.r.resumo).includes(jpeg.slice(0, 20)) && !String(x.r.conteudo).includes(jpeg.slice(0, 20)), 'conteúdo e resumo sem a imagem');
  ok(x.evs.length === 1 && x.evs[0].ev === 'camera' && x.evs[0].d.acao === 'olhou', 'evento camera {acao: olhou}');
  ok(quadroValido(quadroBom()) && !quadroValido(null) && !quadroValido({}), 'quadroValido');
  // sem quadro no turno: pede um novo à tela (a câmera acabou de ligar) e olha esse
  {
    const pedidos = [], evs = [];
    const novo = quadroBom(300);
    const ctx = { emitir: (ev, d) => evs.push({ ev, d }), estadoTurno: { cameraLigou: Date.now() }, pedirQuadro: async (ms) => { pedidos.push(ms); return novo; } };
    const r = await olharCamera.executar({}, ctx);
    ok(pedidos.length === 1 && pedidos[0] >= 5000 && r.blocos && r.blocos[1].source.data === novo.jpeg && evs.some((e) => e.d.acao === 'olhou'), `liga e olha na mesma fala: pediu o quadro novo (esperando ${pedidos[0]} ms, a câmera acabou de ligar) e olhou`);
    const pedidos2 = [];
    const e2 = await olharCamera.executar({}, { emitir: () => {}, estadoTurno: {}, pedirQuadro: async (ms) => { pedidos2.push(ms); return null; } }).catch((e) => e);
    ok(e2 instanceof ErroFerramenta && e2.codigo === 'camera-desligada' && pedidos2.length === 1 && pedidos2[0] < 5000, 'câmera desligada de verdade: a tela responde null na hora e o erro vem (espera curta)');
    const e3 = await olharCamera.executar({}, { emitir: () => {}, estadoTurno: {}, pedirQuadro: async () => ({ jpeg: 'x', w: 1, h: 1, em: Date.now() }) }).catch((e) => e);
    ok(e3 instanceof ErroFerramenta && e3.codigo === 'camera-desligada', 'quadro novo estragado: não olha');
  }
  // pelo executarFerramenta de hoje (antes da integração passar os blocos adiante): o erro volta como texto para o modelo
  const r1 = await executarFerramenta(olharCamera, {}, { emitir: () => {} });
  ok(!r1.ok && r1.codigo === 'camera-desligada', 'executarFerramenta: camera desligada vira erro que o modelo lê');
  const r2 = await executarFerramenta(olharCamera, {}, { emitir: () => {}, quadroCamera: quadroBom() });
  ok(r2.ok && !String(r2.texto).includes(jpeg.slice(0, 20)), 'executarFerramenta: o texto do tool_result não carrega a imagem');
}
{
  // nada do quadro em log: o arquivo da ferramenta não escreve log nem disco
  const fonte = fs.readFileSync(fileURLToPath(new URL('../ferramentas/camera.js', import.meta.url)), 'utf8');
  ok(!/\blog\(|console\.|writeFile|appendFile|createWriteStream/.test(fonte), 'camera.js não loga nem grava nada');
  const ui = fs.readFileSync(fileURLToPath(new URL('../../web/js/jarvis-acoes.js', import.meta.url)), 'utf8');
  ok(!/console\.(log|info|warn|error|debug)\(/.test(ui) && !/localStorage\.setItem\([^)]*jpeg/i.test(ui), 'jarvis-acoes.js não loga nada nem guarda quadro');
}

/* ---------- 3. aprovação por voz ---------- */
{
  const todas = [...FRASES.aprovarSempre, ...FRASES.aprovarCurto, ...FRASES.recusar];
  ok(new Set(todas).size === todas.length, 'as três listas não se cruzam');
  ok(FRASES.aprovarSempre.every((f) => respostaDeVoz(f) === 'aprovar' && respostaDeVoz(f, { conversaAndou: true }) === 'aprovar'), `"aprovar, sempre" (${FRASES.aprovarSempre.length}) vale com e sem conversa no meio`);
  ok(FRASES.aprovarCurto.every((f) => respostaDeVoz(f) === 'aprovar' && respostaDeVoz(f, { conversaAndou: true }) === null), `"aprovar, curto" (${FRASES.aprovarCurto.join(', ')}) só antes de a conversa andar`);
  ok(FRASES.recusar.every((f) => respostaDeVoz(f) === 'recusar' && respostaDeVoz(f, { conversaAndou: true }) === 'recusar'), `"recusar" (${FRASES.recusar.length}) vale sempre`);
  const casos = [
    ['Jarvis, aprovado!', 'aprovar'], ['Aprovado, Jarvis.', 'aprovar'], ['pode fazer, por favor', 'aprovar'], ['Por favor, pode começar', 'aprovar'],
    ['Tá aprovado', 'aprovar'], ['Pode, pode.', 'aprovar'], ['SIM', 'aprovar'], ['Faça.', 'aprovar'], ['pode-construir', null],
    ['Não.', 'recusar'], ['não, não', 'recusar'], ['Reprovado!', 'recusar'], ['deixa pra lá', 'recusar'], ['Não tá aprovado', 'recusar'], ['cancela, Jarvis', 'recusar'],
    ['pode mudar o assunto?', null], ['pode enviar mas muda o assunto', null], ['aprovado mas antes muda o nome', null],
    ['manda', null], ['envia', null], ['para', null], ['espera', null], ['chega', null], ['jarvis', null], ['', null], ['   ', null],
    ['sim, mas qual é o valor?', null], ['não sei', null], ['pode ser amanhã', null],
    // a fala em pedaços (achado da revisão: só a frase exata valia, e "Não, cancela" ia para o cérebro)
    ['Não, cancela', 'recusar'], ['Cancela isso', 'recusar'], ['Não precisa não', 'recusar'], ['não quero não', 'recusar'],
    ['Aprovado, pode fazer', 'aprovar'], ['Sim, pode apagar', 'aprovar'], ['aprovado sim', 'aprovar'], ['Ok', 'aprovar'], ['Beleza', 'aprovar'],
    ['Pode prosseguir', 'aprovar'], ['não pode apagar', 'recusar'], ['Não, pode fazer', 'recusar'], ['isso não', null], ['sim não', null],
    ['aprovado, mas cancela', null], ['não precisa mais disso', null]
  ];
  for (const [t, esp] of casos) ok(respostaDeVoz(t) === esp, `respostaDeVoz("${t}") → ${esp}`);
  ok(respostaDeVoz('Ok', { conversaAndou: true }) === null && respostaDeVoz('ok, sim', { conversaAndou: true }) === null && respostaDeVoz('ok, pode fazer', { conversaAndou: true }) === 'aprovar' && respostaDeVoz('não, cancela', { conversaAndou: true }) === 'recusar',
    'depois de a conversa andar: "ok" e "sim" (sozinhos ou juntos) não aprovam; com uma frase de sempre aprova; a recusa vale sempre');
  ok(respostaDeVoz('sim', { conversaAndou: true }) === null && respostaDeVoz('pode', { conversaAndou: true }) === null, '"sim" e "pode" depois de a conversa andar não aprovam');
  ok(normalizarResposta('Jarvis, pode começar, por favor!') === 'pode comecar', 'normalizar: sem acento, sem pontuação, sem "jarvis" e "por favor" nas pontas');
  ok(palavraUnica('Pode.') && palavraUnica('Jarvis, sim') && !palavraUnica('pode fazer') && !palavraUnica('') && !palavraUnica('jarvis'), 'palavraUnica');
  ok(rotuloAcao('apagar') === 'mandar para a Lixeira' && rotuloAcao('construir') === 'começar a construção' && rotuloAcao('enviar_email') === 'enviar e-mail' && rotuloAcao('outra_coisa') === 'outra coisa', 'rotuloAcao');
  ok(/“aprovado”/.test(TEXTOS_ACOES.aprovacao.dica) && /Lixeira/.test(TEXTOS_ACOES.ajuda) && /API do Claude/.test(TEXTOS_ACOES.camera.aviso), 'textos do §11');
}

/* ---------- 4. detalhe das ações (escapando HTML) ---------- */
const MAU = '<script>alert(1)</script>"><img src=x onerror=alert(2)>';
// o texto escapado pode ter a palavra "onerror=" (é só texto, ou fica dentro de um atributo entre aspas, com as aspas
// de dentro escapadas); o que não pode é uma etiqueta de verdade com ela. Tira os valores entre aspas e procura
const semTag = (h) => typeof h === 'string' && !/<script|<img src=x|<iframe/i.test(h) && !/<[a-z][^>]*\son[a-z]+=/i.test(h.replace(/"[^"]*"/g, '""'));
{
  ok(detalheAcaoHtml('enviar_email', { para: 'x' }) === null && detalheAcaoHtml('desconhecido', {}) === null, 'enviar_email e tipo desconhecido → null (fica o detalhe de hoje)');
  const d = {
    mover: { itens: [{ de: `Arquivos\\${MAU}.txt`, para: 'Planilhas' }, { de: 'a.md', para: 'Anotações' }], total: 2 },
    renomear: { pasta: 'Arquivos', de: MAU, para: 'novo.txt' },
    apagar: { itens: [{ caminho: MAU, tipo: 'arquivo', kb: 12 }, { caminho: 'Projetos\\velho', tipo: 'pasta', kb: 3400, arquivos: 9 }], total: 2, destino: 'Lixeira do Windows' },
    alterar: { arquivo: 'Anotações\\x.md', modo: 'trocar_trecho', antes: MAU, depois: `novo ${MAU}` },
    formulario: { site: 'exemplo.com.br', url: `https://exemplo.com.br/?q=${MAU}`, campos: [{ campo: MAU, valor: MAU }], botao: MAU },
    construir: { projeto: 'vendas-por-filial', tipo: 'bi', pasta: 'Projetos\\vendas-por-filial', pedido: MAU, tamanho: 'medio', estimativa_usd: 0.32, teto_usd: 0.9, resta_hoje_usd: 9.1, modelo: 'Claude Sonnet 5.5', novo: true },
    navegar: { url: `https://fora.example/‮moc.elgoog`, site: 'fora.example', porque: MAU }
  };
  for (const [tipo, det] of Object.entries(d)) {
    const h = detalheAcaoHtml(tipo, det);
    ok(semTag(h) && h.includes('&lt;script&gt;') === (JSON.stringify(det).includes('<script>')), `detalhe ${tipo}: HTML escapado`);
  }
  ok(/2 itens/.test(detalheAcaoHtml('mover', d.mover)) && /→/.test(detalheAcaoHtml('mover', d.mover)), 'mover: conta os itens e mostra de → para');
  ok(/Lixeira do Windows\. Dá para restaurar/.test(detalheAcaoHtml('apagar', d.apagar)) && /9 arquivos/.test(detalheAcaoHtml('apagar', d.apagar)) && /3,3 MB/.test(detalheAcaoHtml('apagar', d.apagar)), 'apagar: Lixeira, arquivos da pasta e tamanho');
  const hc = detalheAcaoHtml('construir', d.construir);
  ok(/US\$ 0,32/.test(hc) && /US\$ 0,90/.test(hc) && /Resta hoje US\$ 9,10/.test(hc) && /JARVIS\\Projetos\\vendas-por-filial/.test(hc) && /pasta nova/.test(hc), 'construir: estimativa, teto, resta hoje, pasta nova');
  ok(!detalheAcaoHtml('navegar', d.navegar).includes('‮') && detalheAcaoHtml('navegar', d.navegar).includes('�'), 'navegar: caractere de direção vira sinal visível (o endereço não se disfarça)');
  ok(/Você não citou este site/.test(detalheAcaoHtml('navegar', { url: 'https://a.com' })), 'navegar: o porquê padrão');
  ok(/Depois eu aperto o botão/.test(detalheAcaoHtml('formulario', d.formulario)), 'formulario: diz o botão que será apertado');
  const hab = detalheAcaoHtml('abrir', { arquivo: `Projetos\\vendas\\${MAU}.html`, kb: 12 });
  ok(semTag(hab) && /JARVIS\\Projetos\\vendas/.test(hab) && /seu navegador/.test(hab) && rotuloAcao('abrir') === 'abrir página no navegador', 'abrir (página HTML no navegador): o arquivo, o aviso e o rótulo, escapados');
  ok(semTag(detalheAcaoHtml('mover', MAU)) && semTag(detalheAcaoHtml('apagar', null)) && semTag(detalheAcaoHtml('alterar', { antes: 5, depois: ['x'] })), 'detalhe com lixo no lugar do objeto não quebra');
}

/* ---------- 5. cartões novos ---------- */
const ID = 'arq_AbCdEf0123456789_-xy';
const MINI = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD';
{
  ok(cartaoHtml('destaque', {}) === null && cartaoHtml('xyz', {}) === null, 'tipo de hoje (destaque) ou desconhecido → null');
  const dados = {
    print: { titulo: MAU, site: MAU, url: `https://x.com/${MAU}`, quando: '2026-10-20T17:55:03Z', arquivo: { id: ID, nome: 'p.png' }, miniatura: MINI, largura: 1366, altura: 900, inteira: true },
    pagina: { titulo: MAU, site: 'bcb.gov.br', url: 'https://www.bcb.gov.br/', descricao: MAU, titulos: [MAU, 'b'], trechos: [MAU], tabela: { colunas: [MAU, 'Valor'], linhas: [[MAU, 12.5]] }, links: [{ n: 3, texto: MAU }] },
    arquivo: { acao: 'criado', nome: MAU, pasta: 'Arquivos', kb: 2, id: ID },
    pasta: { pasta: 'Planilhas', id: ID, itens: [{ nome: MAU, tipo: 'arquivo', kb: 7, modificado: '2026-10-20T12:00:00Z' }, { nome: 'Sub', tipo: 'pasta' }], total: 14 },
    planilha: { titulo: MAU, arquivo: { id: ID, nome: 'v.xlsx', pasta_rel: 'Planilhas' }, colunas: [MAU], linhas: [[MAU]], total_linhas: 1234, total_colunas: 6, aviso: MAU },
    anotacao: { titulo: MAU, trecho: MAU, arquivo: { id: ID, nome: 'a.md', pasta_rel: 'Anotações' } },
    construcao: { id: 'c1', projeto: MAU, tipo: 'bi', estado: 'construindo', etapa: MAU, arquivos: [{ nome: MAU, kb: 3 }], custo_usd: 0.12, teto_usd: 0.9, segundos: 134, avisos: [MAU], mensagem: MAU, print: { miniatura: MINI, id: ID }, pasta_id: ID }
  };
  for (const [tipo, d] of Object.entries(dados)) ok(semTag(cartaoHtml(tipo, d)), `cartão ${tipo}: HTML escapado`);
  for (const tipo of Object.keys(dados)) ok(typeof cartaoHtml(tipo, null) === 'string' && typeof cartaoHtml(tipo, 'texto') === 'string' && semTag(cartaoHtml(tipo, { itens: MAU, links: 5, tabela: 'x' })), `cartão ${tipo} com dados faltando ou errados não quebra`);
  const hp = cartaoHtml('print', dados.print);
  ok(hp.includes(`src="${MINI}"`) && /data-ja="ampliar"/.test(hp) && /data-ja="abrir" data-id="arq_/.test(hp) && /data-ja="mostrar"/.test(hp) && /página inteira/.test(hp), 'print: miniatura, Ampliar, Abrir, Mostrar na pasta, página inteira');
  for (const ruim of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zz4=', `${MINI}" onerror="x`, 'https://fora.com/a.jpg']) {
    ok(!cartaoHtml('print', { ...dados.print, miniatura: ruim }).includes('<img'), `print recusa miniatura "${ruim.slice(0, 34)}…"`);
  }
  for (const ruim of ['arq_x" onclick="y', '../../ENV', 'arq_', 'outra_AbCdEf0123456789']) {
    ok(!/data-id=/.test(cartaoHtml('arquivo', { ...dados.arquivo, id: ruim })), `arquivo recusa id "${ruim}"`);
  }
  ok(/Diga “abre o link 3”/.test(cartaoHtml('pagina', dados.pagina)) && /<b>3<\/b>/.test(cartaoHtml('pagina', dados.pagina)), 'página: links numerados e a dica de voz');
  ok(/JARVIS\\Planilhas/.test(cartaoHtml('pasta', dados.pasta)) && /e mais 12/.test(cartaoHtml('pasta', dados.pasta)) && /Abrir a pasta/.test(cartaoHtml('pasta', dados.pasta)), 'pasta: caminho, "e mais", Abrir a pasta');
  ok(/1\.234 linhas · 6 colunas/.test(cartaoHtml('planilha', dados.planilha)) && /Abrir no Excel/.test(cartaoHtml('planilha', dados.planilha)), 'planilha: contagem em pt-BR e Abrir no Excel');
  const hpt = cartaoHtml('planilha', { ...dados.planilha, colunas: ['Filial', 'Venda', MAU], tipos: ['código', 'R$', MAU] });
  ok(/<b>Filial<\/b> código/.test(hpt) && /<b>Venda<\/b> R\$/.test(hpt) && semTag(hpt), 'planilha: o tipo escolhido de cada coluna aparece no cartão (escapado)');
  const ID2 = 'arq_ZyXwVu9876543210_-ab';
  const hproj = cartaoHtml('pasta', { pasta: 'Projetos', pasta_id: ID, itens: [{ nome: 'vendas', tipo: 'pasta', id: ID, index_id: ID2 }, { nome: 'sem-index', tipo: 'pasta', id: ID }], total: 2 });
  ok(new RegExp(`data-ja="abrir" data-id="${ID2}"`).test(hproj) && (hproj.match(/data-ja="mostrar"/g) || []).length === 2 && /Abrir a pasta/.test(hproj), 'lista dos projetos: cada linha com Prévia (index_id) e Pasta (id), e o Abrir a pasta de Projetos');
  ok(!/ja-it-bts/.test(cartaoHtml('pasta', { ...dados.pasta, itens: [{ nome: 'x', id: 'arq_x" onclick="y' }] })), 'linha com id inválido: sem botão');
  const lix = cartaoHtml('arquivo', { acao: 'na_lixeira', nome: 'velho.txt', pasta: 'Arquivos', id: ID });
  ok(/Na Lixeira do Windows/.test(lix) && /restaurar/.test(lix) && !/data-ja="abrir"/.test(lix), 'arquivo na Lixeira: sem Abrir, diz que dá para restaurar');
  ok(/Não achei na Lixeira/.test(cartaoHtml('arquivo', { acao: 'na_lixeira', nome: 'x', conferido: false })), 'arquivo na Lixeira sem conferir: avisa');
  const hc = cartaoHtml('construcao', dados.construcao);
  ok(/data-ja="parar"/.test(hc) && !/Abrir prévia/.test(hc) && /US\$ 0,12/.test(hc) && /de US\$ 0,90/.test(hc) && /2:14/.test(hc) && /--v:0\.133/.test(hc), 'construção rodando: Parar, custo de teto, tempo e barra');
  const hf = cartaoHtml('construcao', { ...dados.construcao, estado: 'pronto', index_id: ID, custo_usd: 0.85 });
  ok(!/data-ja="parar"/.test(hf) && /Abrir prévia/.test(hf) && /data-perto="1"/.test(hf) && /Pronto/.test(hf), 'construção pronta: sem Parar, com Abrir prévia; perto do teto marcado');
  ok(/data-estado="construindo"/.test(cartaoHtml('construcao', { estado: '"><script>' })), 'construção com estado estranho vira "construindo"');
}

/* ---------- 6. SSE e formatos ---------- */
{
  const e = analisarSse('event: construcao\ndata: {"id":"c1","estado":"pronto"}');
  ok(e && e.evento === 'construcao' && e.dados.estado === 'pronto', 'analisarSse: evento e dados');
  ok(analisarSse(': ping') === null && analisarSse('event: x\ndata: {quebrado') === null, 'analisarSse: ping e JSON quebrado → null');
  ok(fmtUsd(0.32) === 'US$ 0,32' && fmtUsd(5) === 'US$ 5,00' && fmtUsd(0.001) === 'menos de US$ 0,01' && fmtUsd(0) === 'US$ 0,00' && fmtUsd('x') === '', 'fmtUsd');
  ok(fmtKb(0.4) === 'menos de 1 KB' && fmtKb(12) === '12 KB' && fmtKb(1536) === '1,5 MB' && fmtKb(3 * 1024 * 1024) === '3 GB', 'fmtKb');
  ok(fmtTempo(134) === '2:14' && fmtTempo(3725) === '1:02:05' && fmtTempo(-5) === '0:00', 'fmtTempo');
}

console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
