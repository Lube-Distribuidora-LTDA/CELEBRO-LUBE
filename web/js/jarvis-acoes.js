/* Cérebro da Lube — js/jarvis-acoes.js  (parte D do docs/JARVIS-ACOES.md §8)
   O Jarvis que FAZ, do lado da tela: os cartões novos da Exibição (print, página organizada, arquivo, pasta, planilha,
   anotação, construção), a janelinha do print em tamanho grande, o cartão de aprovação por voz de cada tipo de ação, a
   câmera "Ver você" e o canal de eventos do servidor (andamento da construção, cartões e falas que chegam fora do turno).
   Só no app do computador (localhost + meta cerebro-token); o link e o arquivo único não carregam nada disto.

   Importável no Node (nada de window ou document no topo): o servidor/teste/testar-camera.js roda as funções puras.

     FRASES = { aprovarSempre, aprovarCurto, recusar }      as frases já normalizadas (sem acento, minúsculas)
     normalizarResposta(texto) → 'pode fazer'               a fala como as listas comparam ("jarvis" e "por favor" nas
                                                            pontas não contam; palavra repetida em seguida conta uma vez)
     respostaDeVoz(texto, { conversaAndou }) → 'aprovar' | 'recusar' | null
     palavraUnica(texto) → bool                             para os 1,8 s de silêncio
     rotuloAcao(tipo) → 'mover arquivos'…
     detalheAcaoHtml(tipo, detalhe) → html | null           null = enviar_email ou tipo que não é daqui (fica o de hoje)
     cartaoHtml(tipo, dados) → html | null                  null = tipo que não é daqui
     TEXTOS_ACOES                                           os textos do §11 (ajuda, aprovação, câmera, erros)

     ui = criarAcoesUi({ raiz (#jarvis), barra (.jv-botoes), token, aba, reduzido, sons ({tocar(nome)}), falar(frase),
                         onCartao({tipo, dados}) (o mostrarCartao do jarvis.js), onAviso(texto, tom), onCamera(ligada),
                         onAcao(d) (opcional: o evento acao do canal: nova, trocada, decidida, expirou),
                         conferirRosto() (opcional: a conferência do rosto, o conferirAgora do rosto.js),
                         abrirAcao(a) (opcional, só o ?debug: o abrirAcao do jarvis.js), fetch (opcional, o teste) })
     ui = { aoCartao(c, art), camera: { ligar(), desligar(), ligada(), quadro(), olhou() }, aoEventoCamera({acao}),
            eventos: { conectar(), fechar() }, janela(id, titulo, info?), janelaAberta(), fecharJanela(), teclaEsc(),
            destruir() }

   O que a integração (jarvis.js) precisa saber:
   - Os cartões: cartaoHtml(tipo, dados) antes do switch de hoje; o article continua .jv-cartao com os CANTOS; depois de pôr
     no DOM, ui.aoCartao(c, art). Os botões falam com POST /api/jarvis/abrir {id, modo} e /api/jarvis/construcao/parar.
   - Esc: o aoTecla do jarvis.js roda antes de qualquer ouvinte daqui (captura na window). Com a janelinha aberta, o Esc
     tem que fechar só ela: no começo do ramo do Escape, `if (ui.teclaEsc()) return;`. E o Espaço não liga o "segure para
     falar" com a janelinha aberta (ui.janelaAberta()).
   - A câmera desliga sozinha ao fechar o Jarvis, quando a janela sai da frente, com o portão do rosto na tela
     (classe rs-travado na raiz) e depois de 10 min sem nenhum quadro pedido (quadro() é chamado a cada turno).
   - quadro() devolve {jpeg (base64 sem o prefixo), w, h, em} ou null; nunca grava nem loga. Vai em contexto.camera.
   - O evento camera do turno: ligar, desligar, olhou, conferir; pedir (o Jarvis quis ligar sem o Júlio pedir: só o botão
     pisca, quem liga é o clique); quadro {pedido} (o olhar_camera quer a imagem de agora: espera a câmera que está
     ligando e manda por POST /api/jarvis/camera/quadro, ou null se ela está desligada).
   - Reabrir o Jarvis (eventos.conectar) confere no servidor a construção que estava rodando: o fim que chegou com o
     canal fechado vira o cartão final, um aviso e a fala do fim.

   Formato dos cartões (dados), tolerante a campo faltando:
     print     { titulo, site, url, quando, arquivo: {id, nome}, miniatura: 'data:image/jpeg;base64,…', largura, altura, inteira }
     pagina    { titulo, site, url, descricao?, titulos ≤8, trechos ≤3, tabela?: {colunas ≤6, linhas ≤8}, links ≤8 [{n, texto}] }
     arquivo   { acao: criado|copiado|movido|renomeado|alterado|na_lixeira, nome, pasta (relativa a JARVIS), tipo?: arquivo|pasta,
                 kb?, id?, antes? (nome ou pasta de antes), conferido? (Lixeira), itens? [{nome, pasta?, tipo?, kb?}], total?,
                 arquivo?: {id, nome, pasta_rel, kb} }
     pasta     { pasta, id? | pasta_id?, itens: [{nome, tipo, kb?, modificado?, id? (Mostrar na pasta), index_id? (Prévia)}], total }
     planilha  { titulo, arquivo: {id, nome, pasta_rel}, colunas ≤6, tipos? ≤6 (o tipo de cada coluna), linhas ≤8 (já
                 formatadas), total_linhas, total_colunas, aviso? }
     anotacao  { titulo, trecho, arquivo: {id, nome, pasta_rel} }
     construcao{ id, projeto, tipo, estado, etapa, arquivos ≤12 [{nome, kb}], custo_usd, teto_usd, segundos, mensagem?,
                 print?: {miniatura, id}, index_id?, pasta_id?, avisos? [texto] }   (atualizado no lugar a cada evento) */

/* =============================================================================
   Utilidades puras
   ============================================================================= */
const FUSO = 'America/Sao_Paulo';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// caracteres invisíveis e de direção (bidi): um endereço com eles na tela pode parecer outro. Viram um sinal visível
const INVISIVEIS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const limpo = (v) => String(v == null ? '' : v).replace(INVISIVEIS, '�');
// texto de uma linha, cortado; objeto e função não viram texto
function txt(v, max = 200) {
  if (v == null || typeof v === 'object' || typeof v === 'function') return '';
  const s = limpo(v).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s;
}
// texto de várias linhas (para os blocos que rolam), cortado
function bloco(v, max = 2000) {
  if (v == null || typeof v === 'object' || typeof v === 'function') return '';
  const s = limpo(v).replace(/\r\n?/g, '\n');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
const lista = (v) => (Array.isArray(v) ? v : []);
const num = (v) => { const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return typeof n === 'number' && Number.isFinite(n) ? n : null; };
const doisDig = (n) => String(n).padStart(2, '0');
const plural = (n, um, varios) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

// o id opaco de um arquivo da pasta do Jarvis (servidor: pasta.registrar) e a miniatura que vem dentro do cartão
const ID_OK = /^arq_[A-Za-z0-9_-]{6,80}$/;
const idOk = (v) => (typeof v === 'string' && ID_OK.test(v) ? v : null);
const IMG_OK = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const imgOk = (v) => (typeof v === 'string' && v.length <= 600000 && IMG_OK.test(v) ? v : null);

export function fmtKb(kb) {
  const v = num(kb);
  if (v == null || v < 0) return '';
  if (v < 1) return 'menos de 1 KB';
  if (v < 1024) return `${Math.round(v).toLocaleString('pt-BR')} KB`;
  const mb = v / 1024;
  if (mb < 1024) return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
  return `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;
}
export function fmtUsd(v) {
  const n = num(v);
  if (n == null || n < 0) return '';
  if (n > 0 && n < 0.005) return 'menos de US$ 0,01';
  return `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function fmtTempo(seg) {
  const s = Math.max(0, Math.floor(num(seg) || 0)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${doisDig(m)}:${doisDig(s % 60)}` : `${m}:${doisDig(s % 60)}`;
}
let fmtPartes = null;
function partesSP(d) {
  fmtPartes ||= new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const o = {};
  for (const p of fmtPartes.formatToParts(d)) o[p.type] = p.value;
  return o;
}
// "hoje 14:55", "ontem 09:10", "18/10 14:55", "18/10/2025" (Brasília). Texto que não é data passa como veio
export function fmtQuando(v, agora = new Date()) {
  if (v == null || v === '') return '';
  let d = null;
  if (typeof v === 'number') d = new Date(v);
  else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v.trim())) d = new Date(v.trim());
  if (!d || !Number.isFinite(d.getTime())) return txt(v, 40);
  const p = partesSP(d), h = partesSP(agora), hora = `${p.hour}:${p.minute}`;
  const dia = (x) => Date.UTC(+x.year, +x.month - 1, +x.day);
  const dias = Math.round((dia(h) - dia(p)) / 864e5);
  if (dias === 0) return `hoje ${hora}`;
  if (dias === 1) return `ontem ${hora}`;
  if (p.year === h.year) return `${p.day}/${p.month} ${hora}`;
  return `${p.day}/${p.month}/${p.year}`;
}
// endereço para mostrar: host + caminho (sem a query, que pode ser comprida); o site do cartão vem à parte
function urlCurta(u, max = 90) {
  const s = txt(u, 600);
  if (!s) return '';
  try { const x = new URL(s); return txt(`${x.host}${x.pathname === '/' ? '' : x.pathname}${x.search ? '?…' : ''}`, max); } catch { return txt(s, max); }
}
// caminho relativo à pasta do Jarvis, como o Júlio vê no Explorer
const rel = (v) => txt(v, 300).replace(/\//g, '\\');
const naJarvis = (pasta) => { const p = rel(pasta).replace(/^\\+/, ''); return p ? `JARVIS\\${p}` : 'JARVIS'; };

/* =============================================================================
   Aprovação por voz (§4.2): as listas, já normalizadas como o curto() do jarvis.js
   ============================================================================= */
const congelar = (a) => Object.freeze(a.map((s) => normalizarResposta(s)));
export function normalizarResposta(texto) {
  let ps = String(texto == null ? '' : texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/-/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  // "jarvis" e "por favor" nas pontas não contam ("Jarvis, aprovado", "pode fazer, por favor")
  for (let mudou = true; mudou && ps.length;) {
    mudou = false;
    if (ps[0] === 'jarvis') { ps.shift(); mudou = true; } else if (ps[0] === 'por' && ps[1] === 'favor') { ps.splice(0, 2); mudou = true; }
    const n = ps.length;
    if (n && ps[n - 1] === 'jarvis') { ps.pop(); mudou = true; } else if (n >= 2 && ps[n - 2] === 'por' && ps[n - 1] === 'favor') { ps.splice(-2); mudou = true; }
  }
  // "pode, pode" e "sim, sim" contam como uma palavra
  ps = ps.filter((w, i) => w !== ps[i - 1]);
  return ps.join(' ');
}
// "manda" e "envia" sozinhos continuam não aprovando; "para", "espera" e "chega" continuam sendo só parar de falar.
// Fora da lista do §4.2 entraram as formas do próprio Júlio ("se tá aprovado ou não") e o espelho negativo de cada uma
const SEMPRE = ['aprovado', 'aprovo', 'aprova', 'aprovada', 'tá aprovado', 'está aprovado', 'pode fazer', 'pode sim',
  'sim pode', 'pode ir', 'pode seguir', 'pode continuar', 'pode prosseguir', 'confirmo', 'confirmado', 'confirma', 'autorizado',
  'autorizo', 'manda ver', 'sim aprovado', 'pode enviar', 'pode mandar', 'pode apagar', 'pode mover', 'pode renomear',
  'pode alterar', 'pode trocar', 'pode abrir', 'pode preencher', 'pode começar', 'pode construir'];
export const FRASES = Object.freeze({
  aprovarSempre: congelar(SEMPRE),
  // só valem se ninguém falou outra coisa desde que o cartão abriu (o "sim" e o "ok" podem ser resposta a outra pergunta)
  aprovarCurto: congelar(['sim', 'pode', 'faz', 'faça', 'isso', 'ok', 'beleza', 'pode ser']),
  recusar: congelar(['não', 'não pode', 'não quero', 'não faz', 'não faça', 'não envia', 'não manda', 'não apaga', 'não move',
    'não altera', 'não renomeia', 'não abre', 'não preenche', 'não constrói', 'não começa', 'não aprovado', 'não aprovo',
    'não tá aprovado', 'não está aprovado', 'não precisa', 'não precisa não', 'não precisa mais', 'não quero não',
    'não quero mais', 'cancela', 'cancelar', 'cancelado', 'cancela isso', 'cancela tudo', 'reprovado', 'reprovada', 'reprovo',
    'reprova', 'tá reprovado', 'está reprovado', 'recusado', 'recuso', 'negativo', 'deixa', 'deixa pra lá', 'deixa para lá',
    'deixa quieto', 'esquece', 'esquece isso',
    // o espelho negativo de cada "pode …" ("não pode apagar")
    ...SEMPRE.filter((f) => f.startsWith('pode ') && f !== 'pode sim').map((f) => `não ${f}`)])
});
const CONJ = { sempre: new Set(FRASES.aprovarSempre), curto: new Set(FRASES.aprovarCurto), recusar: new Set(FRASES.recusar) };
const MAX_PALAVRAS_FRASE = Math.max(...[...FRASES.aprovarSempre, ...FRASES.aprovarCurto, ...FRASES.recusar].map((f) => f.split(' ').length));
const classeDe = (f) => (CONJ.recusar.has(f) ? 'R' : CONJ.sempre.has(f) ? 'S' : CONJ.curto.has(f) ? 'C' : null);

/* A fala partida nas frases das listas, com o menor número de pedaços ("não, cancela" = "não" + "cancela"; "aprovado, pode
   fazer" = "aprovado" + "pode fazer"). Devolve o conjunto das classes dos pedaços (R recusar, S aprovar sempre, C aprovar
   curto), ou null se sobra palavra que não é de nenhuma lista. Dois jeitos de partir com o mesmo número de pedaços e
   classes diferentes: junta as classes (mistura vira "não sei"). */
function partir(k) {
  const ps = k.split(' ');
  const n = ps.length;
  const melhor = new Array(n + 1).fill(null);   // {pedacos, classes: Set}
  melhor[0] = { pedacos: 0, classes: new Set() };
  for (let i = 0; i < n; i++) {
    if (!melhor[i]) continue;
    for (let j = i + 1; j <= Math.min(n, i + MAX_PALAVRAS_FRASE); j++) {
      const c = classeDe(ps.slice(i, j).join(' '));
      if (!c) continue;
      const novo = { pedacos: melhor[i].pedacos + 1, classes: new Set([...melhor[i].classes, c]) };
      const atual = melhor[j];
      if (!atual || novo.pedacos < atual.pedacos) melhor[j] = novo;
      else if (novo.pedacos === atual.pedacos) for (const x of novo.classes) atual.classes.add(x);
    }
  }
  return melhor[n] ? melhor[n].classes : null;
}

/**
 * A fala inteira é uma resposta ao cartão? A fala pode juntar frases das listas ("não, cancela", "aprovado, pode fazer",
 * "sim, pode apagar"); palavra que não é de lista nenhuma = fala comum (vai para o cérebro). Recusa e aprovação juntas na
 * mesma fala ("não… pode") = não sei (null). "sim", "pode", "ok" sozinhos (ou só eles) só valem antes de a conversa andar.
 */
export function respostaDeVoz(texto, { conversaAndou = false } = {}) {
  const k = normalizarResposta(texto);
  if (!k) return null;
  if (CONJ.recusar.has(k)) return 'recusar';
  if (CONJ.sempre.has(k)) return 'aprovar';
  if (CONJ.curto.has(k)) return conversaAndou ? null : 'aprovar';
  const cl = partir(k);
  if (!cl || !cl.size) return null;
  if (cl.has('R')) return cl.size === 1 ? 'recusar' : null;
  if (cl.has('S')) return 'aprovar';
  return conversaAndou ? null : 'aprovar';
}
/** Uma palavra só ("pode", "sim"): a aprovação espera 1,8 s de silêncio, não 1,2 ("pode… mudar o assunto?"). */
export function palavraUnica(texto) {
  const k = normalizarResposta(texto);
  return !!k && !k.includes(' ');
}

const ROTULOS_ACAO = {
  enviar_email: 'enviar e-mail', mover: 'mover arquivos', renomear: 'renomear', apagar: 'mandar para a Lixeira',
  alterar: 'alterar arquivo', formulario: 'preencher formulário', construir: 'começar a construção', navegar: 'abrir site',
  abrir: 'abrir página no navegador'
};
export function rotuloAcao(tipo) {
  const t = String(tipo || '');
  return ROTULOS_ACAO[t] || (t ? t.replace(/_/g, ' ') : 'ação');
}

/* =============================================================================
   Textos da tela (§11)
   ============================================================================= */
const TEXTO_CAMERA = {
  aviso: 'A câmera fica só nesta janela. Quando eu olho, a foto daquele momento vai para a API do Claude. Nada é gravado.',
  nota: 'Quando eu olho, a foto vai para a API do Claude.',
  // os mesmos textos do portão do rosto (js/rosto.js, erroCamera)
  'sem-camera': 'Não encontrei câmera neste computador.',
  negado: 'Você não liberou a câmera. No menu … da janela, abra as permissões do site e permita a câmera. Se foi o Windows: Configurações › Privacidade › Câmera.',
  'em-uso': 'A câmera está aberta em outro programa. Feche o outro programa e tente de novo.',
  'sem-suporte': 'Este navegador não abre a câmera aqui. Abra o Jarvis pelo atalho do app.',
  oculto: 'A câmera desligou porque a janela saiu da frente.',
  caiu: 'A câmera parou no meio. Confira o cabo e tente de novo.',
  ocioso: 'Desliguei a câmera: 10 minutos sem conversa.',
  pedir: 'Para eu ver você, toque em “Ver você”. A câmera só liga quando você pede.',
  travado: 'Com o Jarvis travado a câmera Ver você não liga. Faça o reconhecimento do rosto.'
};
export const TEXTOS_ACOES = Object.freeze({
  ajuda: 'Eu crio na pasta JARVIS do seu OneDrive sem perguntar. Para mudar, mover, apagar (vai para a Lixeira), mandar, preencher site ou construir, eu mostro um cartão e espero você dizer “aprovado” ou “cancela”.',
  aprovacao: Object.freeze({
    rotulo: 'Aprovar por voz', dica: 'Diga <b>“aprovado”</b> ou <b>“cancela”</b>.',
    dicaAndou: 'A conversa seguiu: agora vale <b>“aprovado”</b> ou o botão.', aprovar: 'Aprovar', cancelar: 'Cancelar', aprovando: 'Aprovando…'
  }),
  camera: Object.freeze({ ...TEXTO_CAMERA }),
  construcaoPronta: 'Pronto. O {tipo} {projeto} ficou pronto e abri a prévia. Custou {valor}.',
  construcaoComAviso: 'Ficou pronto, mas a conferência achou endereços de fora ou código que fala com a rede. Não abri sozinho: confira antes.',
  erros: Object.freeze({
    'jarvis-fora': 'Isso fica fora da pasta do Jarvis. Lá eu só leio.',
    'jarvis-existe': 'Já existe um item com esse nome.',
    'jarvis-estrutura': 'Essa pasta é da estrutura do Jarvis e não sai do lugar.',
    'jarvis-extensao': 'Esse tipo de arquivo eu não crio nem abro: poderia executar alguma coisa.',
    'jarvis-lixeira': 'Não consegui mandar para a Lixeira. Nada foi apagado.',
    'site-bloqueado': 'Esse endereço é da rede da Lube ou deste computador: o navegador do Jarvis não entra lá.',
    'camera-desligada': 'A câmera Ver você está desligada. Toque em “Ver você” para ligar.',
    'jarvis-pagina': 'Página HTML abre no navegador só com a sua aprovação.',
    'construtor-teto-dia': 'O teto de construção de hoje acabou (US$ 10). Amanhã eu volto a construir.',
    'construtor-ocupado': 'Já tem uma construção rodando. Espere ela terminar ou peça para parar.'
  })
});
const REINICIADO = 'O app do cérebro foi reiniciado. Recarregue a página (F5) e fale de novo.';
const TRAVADO = 'O Jarvis está travado. Faça o reconhecimento do rosto.';
const SEM_APP = 'Não consegui falar com o app do cérebro.';

/* =============================================================================
   O cartão de aprovação de cada tipo (o .jv-confirma do jarvis.js mostra este HTML no lugar do detalhe de hoje)
   ============================================================================= */
const MODO_ALTERAR = { acrescentar: 'Acrescentar no fim', substituir_tudo: 'Trocar o texto inteiro', trocar_trecho: 'Trocar um trecho' };
const TIPO_PROJETO = { site: 'Site', bi: 'BI', programa: 'Programa' };
const TAMANHO = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' };
const TIPOS_ACAO_D = new Set(['mover', 'renomear', 'apagar', 'alterar', 'formulario', 'construir', 'navegar', 'abrir']);
const seta = '<span class="ja-seta" aria-hidden="true">→</span><span class="sr"> para </span>';
const dl = (linhas) => `<dl>${linhas.filter(Boolean).join('')}</dl>`;
const lin = (rot, html, cls = '') => (html ? `<div${cls ? ` class="${cls}"` : ''}><dt>${esc(rot)}</dt><dd>${html}</dd></div>` : '');

export function detalheAcaoHtml(tipo, detalhe) {
  const t = String(tipo || '');
  if (!TIPOS_ACAO_D.has(t)) return null;   // enviar_email e tipo desconhecido: o jarvis.js mostra o de hoje
  if (detalhe != null && typeof detalhe !== 'object') return `<div class="ja-ad"><p>${esc(txt(detalhe, 600))}</p></div>`;
  const d = detalhe || {};
  switch (t) {
    case 'mover': {
      const itens = lista(d.itens).filter((i) => i && typeof i === 'object').slice(0, 20);
      const total = num(d.total) ?? itens.length;
      return `<div class="ja-ad ja-ad-mover"><p class="ja-ad-conta">${esc(plural(total, 'item', 'itens'))} · dentro da pasta JARVIS</p>`
        + `<ul class="ja-ad-lista" role="list">${itens.map((i) => `<li><span class="ja-de">${esc(rel(i.de))}</span>${seta}<span class="ja-para">${esc(rel(i.para))}</span></li>`).join('')}</ul>`
        + `${total > itens.length ? `<p class="ja-ad-mais">e mais ${esc((total - itens.length).toLocaleString('pt-BR'))}</p>` : ''}</div>`;
    }
    case 'renomear':
      return `<div class="ja-ad ja-ad-renomear">${dl([lin('Pasta', `<span class="ja-mono">${esc(naJarvis(d.pasta))}</span>`)])}`
        + `<p class="ja-ad-troca"><span class="ja-de">${esc(txt(d.de, 120))}</span>${seta}<b class="ja-para">${esc(txt(d.para, 120))}</b></p></div>`;
    case 'apagar': {
      const itens = lista(d.itens).filter((i) => i && typeof i === 'object').slice(0, 20);
      const total = num(d.total) ?? itens.length;
      const somaKb = itens.reduce((s, i) => s + (num(i.kb) || 0), 0);
      const meta = (i) => [i.tipo === 'pasta' ? 'pasta' : '', num(i.arquivos) != null ? plural(num(i.arquivos), 'arquivo', 'arquivos') : '', fmtKb(i.kb)].filter(Boolean).join(' · ');
      return `<div class="ja-ad ja-ad-apagar"><p class="ja-ad-conta">${esc(plural(total, 'item', 'itens'))}${somaKb ? ` · ${esc(fmtKb(somaKb))}` : ''}</p>`
        + `<ul class="ja-ad-lista ja-ad-itens" role="list">${itens.map((i) => `<li data-tipo="${i.tipo === 'pasta' ? 'pasta' : 'arquivo'}"><span class="ja-de">${esc(rel(i.caminho))}</span><span class="ja-meta">${esc(meta(i))}</span></li>`).join('')}</ul>`
        + `${total > itens.length ? `<p class="ja-ad-mais">e mais ${esc((total - itens.length).toLocaleString('pt-BR'))}</p>` : ''}`
        + `<p class="ja-ad-alerta">Vai para a ${esc(txt(d.destino, 60) || 'Lixeira do Windows')}. Dá para restaurar.</p></div>`;
    }
    case 'alterar': {
      const modo = String(d.modo || ''), acr = modo === 'acrescentar';
      const antes = bloco(d.antes, 600), depois = bloco(d.depois, 600);
      return `<div class="ja-ad ja-ad-alterar">${dl([lin('Arquivo', `<span class="ja-mono">${esc(naJarvis(d.arquivo))}</span>`), lin('Modo', esc(MODO_ALTERAR[modo] || txt(modo, 40)))])}`
        + `${antes ? `<p class="ja-ad-rot">${acr ? 'Como termina hoje' : 'Antes'}</p><pre class="ja-ad-bloco" tabindex="0">${esc(antes)}</pre>` : ''}`
        + `${depois || !antes ? `<p class="ja-ad-rot">${acr ? 'O que entra no fim' : 'Depois'}</p><pre class="ja-ad-bloco ja-ad-depois" tabindex="0">${esc(depois) || '<i>(vazio)</i>'}</pre>` : ''}</div>`;
    }
    case 'formulario': {
      const campos = lista(d.campos).filter((c) => c && typeof c === 'object').slice(0, 20);
      return `<div class="ja-ad ja-ad-formulario"><p class="ja-ad-site">${esc(txt(d.site, 80) || urlCurta(d.url, 60) || 'Site')}</p>`
        + `${d.url ? `<p class="ja-ad-url">${esc(txt(d.url, 500))}</p>` : ''}`
        + `${campos.length ? dl(campos.map((c) => lin(txt(c.campo, 80) || 'campo', esc(txt(c.valor, 500)) || '<i>(vazio)</i>'))) : '<p>Nenhum campo.</p>'}`
        + `<p class="ja-ad-botao">${d.botao ? `Depois eu aperto o botão <b>“${esc(txt(d.botao, 60))}”</b>.` : 'Depois eu envio o formulário.'}</p></div>`;
    }
    case 'construir': {
      const pasta = txt(d.pasta, 200) || (d.projeto ? `Projetos\\${txt(d.projeto, 60)}` : '');
      // tipo, tamanho e modelo numa linha só: o cartão fica baixo o bastante para caber em 768 px de altura
      const linha = [TIPO_PROJETO[d.tipo] || txt(d.tipo, 30), TAMANHO[d.tamanho] ? `tamanho ${TAMANHO[d.tamanho].toLowerCase()}` : txt(d.tamanho, 30), txt(d.modelo, 60) || 'Claude Sonnet 5.5'].filter(Boolean).join(' · ');
      return `<div class="ja-ad ja-ad-construir"><p class="ja-ad-site">${esc(txt(d.projeto, 60) || 'Projeto')}</p><p class="ja-ad-linha">${esc(linha)}</p>`
        + dl([lin('Pasta', pasta ? `<span class="ja-mono">${esc(naJarvis(pasta))}</span>${d.novo === false ? ' <em class="ja-tag">já existe: muda só o pedido</em>' : d.novo === true ? ' <em class="ja-tag">pasta nova</em>' : ''}` : '')])
        + `${d.pedido ? `<p class="ja-ad-rot">Pedido</p><pre class="ja-ad-bloco" tabindex="0">${esc(bloco(d.pedido, 8000))}</pre>` : ''}`
        + `<div class="ja-ad-custo"><div><span>Estimativa</span><b>${esc(fmtUsd(d.estimativa_usd) || '—')}</b></div><div><span>Teto</span><b>${esc(fmtUsd(d.teto_usd) || '—')}</b></div></div>`
        + `<p class="ja-ad-nota">${num(d.resta_hoje_usd) != null ? `Resta hoje ${esc(fmtUsd(d.resta_hoje_usd))}. ` : ''}Se chegar no teto, ele para sozinho.</p></div>`;
    }
    case 'abrir':
      // a página HTML da pasta do Jarvis no navegador padrão do Júlio (com a sessão e a rede dele)
      return `<div class="ja-ad ja-ad-abrir">${dl([lin('Página', `<span class="ja-mono">${esc(naJarvis(d.arquivo))}</span>`), lin('Tamanho', esc(fmtKb(d.kb)))])}`
        + '<p class="ja-ad-nota">Abre no seu navegador. A página leva a trava do Jarvis (não fala com a internet), mas roda com o seu navegador: abra só se foi você que pediu.</p></div>';
    case 'navegar':
      return `<div class="ja-ad ja-ad-navegar"><p class="ja-ad-site">${esc(txt(d.site, 80) || urlCurta(d.url, 60) || 'Site')}</p>`
        + `<p class="ja-ad-url">${esc(txt(d.url, 600))}</p>`
        + `<p class="ja-ad-nota">${esc(txt(d.porque, 200) || 'Você não citou este site nesta conversa.')}</p></div>`;
    default:
      return null;
  }
}

/* =============================================================================
   Os cartões novos da Exibição
   ============================================================================= */
const ICO = {
  camera: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.6A2.6 2.6 0 0 1 5.6 6h1.6l1.5-2.2h6.6L16.8 6h1.6A2.6 2.6 0 0 1 21 8.6v8.8a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 17.4z"/><circle cx="12" cy="12.6" r="3.7"/></svg>',
  abrir: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  pasta: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 9.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>',
  ampliar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6"/></svg>',
  parar: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1.5"/></svg>',
  fechar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  excel: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 9h17M3.5 14.5h17M9.5 9v11.5"/></svg>'
};
const TIPOS_CARTAO = new Set(['print', 'pagina', 'arquivo', 'pasta', 'planilha', 'anotacao', 'construcao']);
function bt(acao, id, rotulo, icone = '') {
  return `<button class="btn pequeno ja-bt" type="button" data-ja="${acao}"${id ? ` data-id="${esc(id)}"` : ''}>${icone}<span>${esc(rotulo)}</span></button>`;
}
const bts = (lista2) => { const h = lista2.filter(Boolean).join(''); return h ? `<div class="ja-bts">${h}</div>` : ''; };
function tabelaHtml(colunas, linhas) {
  const cols = lista(colunas).slice(0, 6), ls = lista(linhas).slice(0, 8);
  if (!cols.length && !ls.length) return '';
  const cel = (v) => (typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : txt(v, 80));
  return `<div class="jv-c-tbl ja-tbl" tabindex="0"><table>${cols.length ? `<thead><tr>${cols.map((c) => `<th>${esc(txt(c, 40))}</th>`).join('')}</tr></thead>` : ''}`
    + `<tbody>${ls.map((l) => `<tr>${(Array.isArray(l) ? l : l && typeof l === 'object' ? Object.values(l) : [l]).slice(0, 6).map((v) => `<td>${esc(cel(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
// o arquivo de um cartão: o objeto arquivo {id, nome, pasta_rel, kb} ou os campos soltos
function arquivoDe(d) {
  const a = d && d.arquivo && typeof d.arquivo === 'object' ? d.arquivo : {};
  return { id: idOk(a.id) || idOk(d.id), nome: txt(a.nome ?? d.nome, 160), pasta: a.pasta_rel ?? a.pasta ?? d.pasta_rel ?? d.pasta ?? '', kb: num(a.kb ?? d.kb) };
}
const ESTADOS_CONS = {
  preparando: 'Preparando', construindo: 'Construindo', conferindo: 'Conferindo', pronto: 'Pronto', parado: 'Parado', teto: 'Parou no teto', erro: 'Erro'
};
const RODANDO = new Set(['preparando', 'construindo', 'conferindo']);

export function cartaoHtml(tipo, dados) {
  const t = String(tipo || '');
  if (!TIPOS_CARTAO.has(t)) return null;
  const d = dados && typeof dados === 'object' ? dados : {};
  switch (t) {
    case 'print': {
      const a = arquivoDe(d), img = imgOk(d.miniatura), tit = txt(d.titulo, 160) || txt(d.site, 80) || 'Print';
      const L = num(d.largura), A = num(d.altura);
      const meta = [txt(d.site, 80), fmtQuando(d.quando), L && A ? `${Math.round(L)}×${Math.round(A)}` : ''].filter(Boolean).join(' · ');
      return `<div class="ja-c ja-c-print"><p class="hud-rot">Print${d.inteira ? ' · <b>página inteira</b>' : ''}</p>`
        + (img ? `<button class="ja-mini${d.inteira ? ' ja-mini-inteira' : ''}" type="button" data-ja="ampliar"${a.id ? ` data-id="${esc(a.id)}"` : ''} aria-label="Ampliar o print: ${esc(tit)}"><img src="${esc(img)}" alt=""${L && A ? ` width="${Math.round(L)}" height="${Math.round(A)}"` : ''} decoding="async"></button>` : '<p class="ja-falta">Sem miniatura.</p>')
        + `<p class="jv-c-tit">${esc(tit)}</p>${meta ? `<p class="jv-c-de">${esc(meta)}</p>` : ''}${d.url ? `<p class="ja-url">${esc(urlCurta(d.url))}</p>` : ''}`
        + bts([img || a.id ? bt('ampliar', a.id, 'Ampliar', ICO.ampliar) : '', a.id && bt('abrir', a.id, 'Abrir', ICO.abrir), a.id && bt('mostrar', a.id, 'Mostrar na pasta', ICO.pasta)])
        + '</div>';
    }
    case 'pagina': {
      const titulos = lista(d.titulos).map((x) => txt(x, 120)).filter(Boolean).slice(0, 8);
      const trechos = lista(d.trechos).map((x) => txt(x, 240)).filter(Boolean).slice(0, 3);
      const links = lista(d.links).filter((l) => l && typeof l === 'object').slice(0, 8);
      const tb = d.tabela && typeof d.tabela === 'object' ? tabelaHtml(d.tabela.colunas, d.tabela.linhas) : '';
      const n1 = links.length ? (num(links[0].n) ?? 1) : null;
      return `<div class="ja-c ja-c-pagina"><p class="hud-rot">Página${d.site ? ` · ${esc(txt(d.site, 80))}` : ''}</p>`
        + `<p class="jv-c-tit">${esc(txt(d.titulo, 200) || txt(d.site, 80) || 'Página')}</p>`
        + `${d.descricao ? `<p class="jv-c-det">${esc(txt(d.descricao, 300))}</p>` : ''}`
        + `${titulos.length ? `<ul class="ja-titulos" role="list">${titulos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`
        + trechos.map((x) => `<p class="ja-trecho">${esc(x)}</p>`).join('')
        + tb
        + `${links.length ? `<ol class="ja-links" role="list">${links.map((l, i) => `<li><b>${esc(String(num(l.n) ?? i + 1))}</b><span>${esc(txt(l.texto, 120) || urlCurta(l.url, 80) || 'link')}</span></li>`).join('')}</ol><p class="jv-c-abre">Diga “abre o link ${esc(String(n1))}”.</p>` : ''}`
        + `${d.url ? `<p class="ja-url">${esc(urlCurta(d.url))}</p>` : ''}</div>`;
    }
    case 'arquivo': {
      const a = arquivoDe(d), acao = String(d.acao || d.situacao || 'criado').toLowerCase(), pasta = d.tipo === 'pasta';
      const lixeira = acao === 'na_lixeira' || acao === 'lixeira' || acao === 'apagado';
      const ROT = {
        criado: pasta ? 'Pasta criada' : 'Arquivo criado', criada: pasta ? 'Pasta criada' : 'Arquivo criado', copiado: 'Copiado para a pasta do Jarvis',
        movido: 'Movido', renomeado: 'Renomeado', alterado: 'Alterado', na_lixeira: 'Na Lixeira do Windows', lixeira: 'Na Lixeira do Windows', apagado: 'Na Lixeira do Windows'
      };
      const itens = lista(d.itens).filter((i) => i && typeof i === 'object').slice(0, 8);
      const total = num(d.total) ?? itens.length;
      const meta = [naJarvis(a.pasta), fmtKb(a.kb)].filter(Boolean).join(' · ');
      const antes = txt(d.antes, 160);
      let corpo = '';
      if (itens.length > 1 || (itens.length && !a.nome)) {
        corpo = `<p class="jv-c-tit">${esc(plural(total, 'item', 'itens'))}</p><ul class="ja-itens" role="list">${itens.map((i) => `<li data-tipo="${i.tipo === 'pasta' ? 'pasta' : 'arquivo'}"><i class="ja-ico" aria-hidden="true"></i><span class="ja-nm">${esc(txt(i.nome, 120))}</span><span class="ja-mt">${esc([i.pasta != null ? naJarvis(i.pasta) : '', fmtKb(i.kb)].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>${total > itens.length ? `<p class="ja-mais">e mais ${esc((total - itens.length).toLocaleString('pt-BR'))}</p>` : ''}`;
      } else {
        corpo = `<p class="jv-c-tit ja-nome">${esc(a.nome || 'Arquivo')}</p>${meta ? `<p class="jv-c-de">${esc(meta)}</p>` : ''}`
          + (antes && acao === 'renomeado' ? `<p class="jv-c-det">Antes: ${esc(antes)}</p>` : '')
          + (antes && acao === 'movido' ? `<p class="jv-c-det">Estava em ${esc(naJarvis(antes))}</p>` : '');
      }
      const nota = lixeira ? `<p class="ja-nota${d.conferido === false ? ' ja-nota-rever' : ''}">${d.conferido === false ? 'Não achei na Lixeira para conferir. Olhe lá antes de esvaziar.' : 'Dá para restaurar pela Lixeira.'}</p>` : '';
      return `<div class="ja-c ja-c-arquivo" data-acao="${lixeira ? 'lixeira' : esc(acao.replace(/[^a-z_]/g, ''))}"><p class="hud-rot">${esc(ROT[acao] || txt(acao, 40))}</p>${corpo}${nota}`
        + (lixeira ? '' : bts([a.id && bt('abrir', a.id, pasta ? 'Abrir a pasta' : 'Abrir', pasta ? ICO.pasta : ICO.abrir), a.id && !pasta && bt('mostrar', a.id, 'Mostrar na pasta', ICO.pasta)]))
        + '</div>';
    }
    case 'pasta': {
      const id = idOk(d.pasta_id) || idOk(d.id), itens = lista(d.itens).filter((i) => i && typeof i === 'object').slice(0, 12);
      const total = num(d.total) ?? itens.length;
      // cada linha com id (a pasta de um projeto) ou index_id (a prévia dele) ganha os botões dela
      const btsItem = (i) => {
        const iid = idOk(i.index_id), pid = idOk(i.id), nm = txt(i.nome, 60);
        if (!iid && !pid) return '';
        return `<span class="ja-it-bts">${iid ? `<button class="btn pequeno ja-bt ja-bt-it" type="button" data-ja="abrir" data-id="${esc(iid)}" aria-label="Abrir a prévia de ${esc(nm)}">${ICO.abrir}<span>Prévia</span></button>` : ''}`
          + `${pid ? `<button class="btn pequeno ja-bt ja-bt-it" type="button" data-ja="mostrar" data-id="${esc(pid)}" aria-label="Mostrar ${esc(nm)} na pasta">${ICO.pasta}<span>Pasta</span></button>` : ''}</span>`;
      };
      return `<div class="ja-c ja-c-pasta"><p class="hud-rot">Pasta · ${esc(plural(total, 'item', 'itens'))}</p><p class="jv-c-tit ja-mono-tit">${esc(naJarvis(d.pasta))}</p>`
        + (itens.length ? `<ul class="ja-itens" role="list">${itens.map((i) => `<li data-tipo="${i.tipo === 'pasta' ? 'pasta' : 'arquivo'}"><i class="ja-ico" aria-hidden="true"></i><span class="ja-nm">${esc(txt(i.nome, 120))}</span><span class="ja-mt">${esc([i.tipo === 'pasta' ? '' : fmtKb(i.kb), fmtQuando(i.modificado)].filter(Boolean).join(' · '))}</span>${btsItem(i)}</li>`).join('')}</ul>` : '<p class="jv-c-det">A pasta está vazia.</p>')
        + `${total > itens.length ? `<p class="ja-mais">e mais ${esc((total - itens.length).toLocaleString('pt-BR'))}</p>` : ''}`
        + bts([id && bt('abrir', id, 'Abrir a pasta', ICO.pasta)]) + '</div>';
    }
    case 'planilha': {
      const a = arquivoDe(d), nl = num(d.total_linhas), nc = num(d.total_colunas);
      const conta = [nl != null ? plural(nl, 'linha', 'linhas') : '', nc != null ? plural(nc, 'coluna', 'colunas') : ''].filter(Boolean).join(' · ');
      return `<div class="ja-c ja-c-planilha"><p class="hud-rot">Planilha · Excel</p><p class="jv-c-tit">${esc(txt(d.titulo, 160) || a.nome || 'Planilha')}</p>`
        + `${conta ? `<p class="jv-c-de">${esc(conta)}</p>` : ''}${d.aviso ? `<p class="ja-nota ja-nota-rever">${esc(txt(d.aviso, 240))}</p>` : ''}`
        + tabelaHtml(d.colunas, d.linhas)
        // o tipo que o Jarvis escolheu para cada coluna (o Júlio vê quando ele errou: código somado, número como texto)
        + (lista(d.tipos).length ? `<p class="ja-tipos">${lista(d.colunas).slice(0, 6).map((c, i) => `<span><b>${esc(txt(c, 30))}</b> ${esc(txt(lista(d.tipos)[i], 20))}</span>`).filter((_, i) => lista(d.tipos)[i]).join('')}</p>` : '')
        + `${a.nome ? `<p class="ja-url">${esc(naJarvis(a.pasta))}\\${esc(a.nome)}</p>` : ''}`
        + bts([a.id && bt('abrir', a.id, 'Abrir no Excel', ICO.excel), a.id && bt('mostrar', a.id, 'Mostrar na pasta', ICO.pasta)]) + '</div>';
    }
    case 'anotacao': {
      const a = arquivoDe(d);
      return `<div class="ja-c ja-c-anotacao"><p class="hud-rot">Anotação</p><p class="jv-c-tit">${esc(txt(d.titulo, 160) || a.nome || 'Anotação')}</p>`
        + `${d.trecho ? `<p class="jv-c-det ja-trecho-nota">${esc(bloco(d.trecho, 300))}</p>` : ''}`
        + `${a.nome ? `<p class="ja-url">${esc(naJarvis(a.pasta))}\\${esc(a.nome)}</p>` : ''}`
        + bts([a.id && bt('abrir', a.id, 'Abrir', ICO.abrir), a.id && bt('mostrar', a.id, 'Mostrar na pasta', ICO.pasta)]) + '</div>';
    }
    case 'construcao': {
      const estado = ESTADOS_CONS[d.estado] ? d.estado : 'construindo', roda = RODANDO.has(estado);
      const custo = num(d.custo_usd) || 0, teto = num(d.teto_usd), v = teto ? Math.max(0, Math.min(1, custo / teto)) : 0;
      const arqs = lista(d.arquivos).filter((x) => x && typeof x === 'object').slice(0, 12);
      const avisos = lista(d.avisos).map((x) => txt(x, 240)).filter(Boolean).slice(0, 5);
      const pr = d.print && typeof d.print === 'object' ? { img: imgOk(d.print.miniatura), id: idOk(d.print.id) } : null;
      const idx = idOk(d.index_id), pid = idOk(d.pasta_id);
      const cid = txt(d.id, 80).replace(/[^A-Za-z0-9_-]/g, '');
      return `<div class="ja-c ja-c-construcao" data-estado="${estado}" data-cid="${esc(cid)}"${v >= 0.9 ? ' data-perto="1"' : ''}>`
        + `<p class="hud-rot ja-cons-rot"><span>Construção${TIPO_PROJETO[d.tipo] ? ` · ${TIPO_PROJETO[d.tipo]}` : ''}</span><b class="ja-est">${esc(ESTADOS_CONS[estado])}</b></p>`
        + `<p class="jv-c-tit">${esc(txt(d.projeto, 80) || 'Projeto')}</p>`
        + `${d.etapa || roda ? `<p class="ja-etapa">${roda ? '<i aria-hidden="true"></i>' : ''}<span>${esc(txt(d.etapa, 120) || 'Começando…')}</span></p>` : ''}`
        + `<div class="ja-custo"><p class="ja-custo-txt"><span><b>${esc(fmtUsd(custo) || 'US$ 0,00')}</b>${teto != null ? ` de ${esc(fmtUsd(teto))}` : ''}</span><span class="ja-tempo" data-seg="${Math.max(0, Math.floor(num(d.segundos) || 0))}">${esc(fmtTempo(d.segundos))}</span></p>`
        + `${teto ? `<span class="ja-barra" role="img" aria-label="Custo: ${esc(Math.round(v * 100))}% do teto"><i style="--v:${v.toFixed(3)}"></i></span>` : ''}</div>`
        + `${arqs.length ? `<ul class="ja-arqs" role="list">${arqs.map((x) => `<li><span>${esc(txt(x.nome, 60))}</span><b>${esc(fmtKb(x.kb))}</b></li>`).join('')}</ul>` : ''}`
        + `${d.mensagem ? `<p class="jv-c-det">${esc(txt(d.mensagem, 300))}</p>` : ''}`
        + `${avisos.length ? `<ul class="ja-avisos" role="list">${avisos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`
        + `${pr && pr.img ? `<button class="ja-mini" type="button" data-ja="ampliar"${pr.id ? ` data-id="${esc(pr.id)}"` : ''} aria-label="Ampliar o print da prévia"><img src="${esc(pr.img)}" alt="" decoding="async"></button>` : ''}`
        + bts([roda && bt('parar', null, 'Parar', ICO.parar), !roda && idx && bt('abrir', idx, 'Abrir prévia', ICO.abrir), pid && bt('mostrar', pid, 'Mostrar na pasta', ICO.pasta)])
        + '</div>';
    }
    default:
      return null;
  }
}

/* =============================================================================
   SSE: um bloco de texto → { evento, dados } (o mesmo parser do js/ouvido-remoto.js, copiado)
   ============================================================================= */
export function analisarSse(blocoTxt) {
  let evento = 'message';
  const dados = [];
  for (const linha of String(blocoTxt == null ? '' : blocoTxt).split(/\r?\n/)) {
    if (!linha || linha.startsWith(':')) continue;   // comentário (: ping)
    const k = linha.indexOf(':'), campo = k < 0 ? linha : linha.slice(0, k);
    let val = k < 0 ? '' : linha.slice(k + 1);
    if (val.startsWith(' ')) val = val.slice(1);
    if (campo === 'event') evento = val; else if (campo === 'data') dados.push(val);
  }
  if (!dados.length && evento === 'message') return null;
  let d = {};
  try { d = dados.length ? JSON.parse(dados.join('\n')) : {}; } catch { return null; }
  return { evento, dados: d && typeof d === 'object' ? d : {} };
}

/* =============================================================================
   criarAcoesUi — a parte que mexe na tela (só no navegador)
   ============================================================================= */
const RECUO_SSE = [500, 1000, 2000, 5000];
const CAMERA_LARGURA = 768, CAMERA_QUALIDADE = 0.7, CAMERA_MAX_B64 = 700000;
const OCIOSO_MS = 10 * 60_000;
function ehLocal() {
  try { return /^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname); } catch { return false; }
}
let promessaCss = null;
function garantirCss() {
  if (promessaCss) return promessaCss;
  if (document.querySelector('link[data-acoes-css]')) return (promessaCss = Promise.resolve());
  let href = 'css/jarvis-acoes.css';
  try { href = new URL('../css/jarvis-acoes.css', import.meta.url).href; } catch { /* relativo à página */ }
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = href; l.dataset.acoesCss = '1';
  promessaCss = new Promise((ok) => { const tm = setTimeout(ok, 2500); l.onload = l.onerror = () => { clearTimeout(tm); ok(); }; });
  document.head.appendChild(l);
  return promessaCss;
}

export function criarAcoesUi(opts = {}) {
  const raiz = opts.raiz || document.getElementById('jarvis');
  const barra = opts.barra || (raiz && raiz.querySelector('.jv-botoes'));
  const token = opts.token || '';
  const aba = opts.aba || '';
  const reduzido = typeof opts.reduzido === 'function' ? opts.reduzido : () => false;
  const semMovimento = () => { try { return reduzido() || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return reduzido(); } };
  const tocar = (n) => { try { opts.sons && typeof opts.sons.tocar === 'function' && opts.sons.tocar(n); } catch { /* sem som */ } };
  const falar = (f) => { try { typeof opts.falar === 'function' && opts.falar(f); } catch { /* sem voz */ } };
  const avisar = (t, tom = '') => { try { typeof opts.onAviso === 'function' && opts.onAviso(t, tom); } catch { /* nada */ } };
  const mostrarCartao = (c) => { try { typeof opts.onCartao === 'function' && opts.onCartao(c); } catch { /* nada */ } };
  const buscar = (...a) => (typeof opts.fetch === 'function' ? opts.fetch(...a) : fetch(...a));
  let destruido = false;
  garantirCss();

  /* ---------- pedidos ao servidor ---------- */
  async function pedir(metodo, caminho, corpo) {
    let r;
    try {
      r = await buscar(caminho, {
        method: metodo, cache: 'no-store',
        headers: { 'x-cerebro-token': token, ...(corpo ? { 'content-type': 'application/json' } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined
      });
    } catch { return { status: 0, ok: false, j: {} }; }
    let j = {};
    try { j = await r.json(); } catch { j = {}; }
    return { status: r.status, ok: r.ok && j && j.ok !== false, j: j || {} };
  }
  function textoDoErro(status, j, de = {}) {
    if (status === 0) return SEM_APP;
    if (status === 401) return REINICIADO;
    if (status === 423) return TRAVADO;
    const cod = j && typeof j.erro === 'string' ? j.erro : '';
    if (TEXTOS_ACOES.erros[cod]) return TEXTOS_ACOES.erros[cod];
    if (de[status]) return de[status];
    return txt(j && j.mensagem, 200) || `O app do cérebro respondeu ${status}.`;
  }
  async function abrirNoWindows(id, modo, botao) {
    if (!idOk(id)) return;
    if (botao) { botao.disabled = true; botao.setAttribute('aria-busy', 'true'); }
    const r = await pedir('POST', '/api/jarvis/abrir', { id, modo: modo === 'mostrar' ? 'mostrar' : 'abrir' });
    if (botao && botao.isConnected) {
      botao.disabled = false; botao.removeAttribute('aria-busy');
      if (r.ok) { botao.dataset.st = 'ok'; setTimeout(() => { delete botao.dataset.st; }, 1400); }
    }
    if (!r.ok) avisar(textoDoErro(r.status, r.j, { 404: 'Esse arquivo não está mais na pasta do Jarvis.', 415: TEXTOS_ACOES.erros['jarvis-extensao'], 400: 'Esse pedido de abrir veio errado.' }), 'alerta');
  }
  async function pararConstrucao(botao) {
    if (botao) { botao.disabled = true; botao.setAttribute('aria-busy', 'true'); }
    const r = await pedir('POST', '/api/jarvis/construcao/parar', {});
    if (botao && botao.isConnected) { botao.disabled = false; botao.removeAttribute('aria-busy'); }
    if (r.ok) avisar(txt(r.j.mensagem, 200) || 'Pedi para parar a construção.');
    else avisar(textoDoErro(r.status, r.j, { 404: 'Não tem construção rodando agora.' }), r.status === 404 ? '' : 'alerta');
  }

  /* ---------- cartões ---------- */
  const dadosDe = new WeakMap();   // article → {tipo, dados}
  const construcoes = new Map();   // id da construção → {art, dados, recebidoEm}
  function aoCartao(c, art) {
    if (destruido || !c || !art) return;
    const tipo = String(c.tipo || '');
    if (!TIPOS_CARTAO.has(tipo)) return;
    dadosDe.set(art, { tipo, dados: c.dados && typeof c.dados === 'object' ? c.dados : {} });
    art.classList.add('ja-cartao');
    if (!art.dataset.jaLigado) { art.dataset.jaLigado = '1'; art.addEventListener('click', aoClique); }
    if (tipo === 'construcao') {
      const d = dadosDe.get(art).dados, id = String(d.id || '');
      if (id) { const reg = construcoes.get(id); construcoes.set(id, { art, dados: d, recebidoEm: reg && reg.dados === d ? reg.recebidoEm : performance.now() }); }
      atualizarChip();
    }
  }
  function aoClique(e) {
    const art = e.currentTarget, b = e.target && e.target.closest ? e.target.closest('[data-ja]') : null;
    if (!b || !art.contains(b) || b.disabled) return;
    const info = dadosDe.get(art) || { tipo: '', dados: {} }, d = info.dados, id = idOk(b.dataset.id);
    switch (b.dataset.ja) {
      case 'ampliar': {
        if (info.tipo === 'construcao') { const p = d.print || {}; janela(id, `Prévia · ${txt(d.projeto, 80) || 'construção'}`, { miniatura: p.miniatura, site: 'file:// (a prévia do projeto)' }); }
        else janela(id, txt(d.titulo, 160) || txt(d.site, 80) || 'Print', { miniatura: d.miniatura, site: d.site, url: d.url, quando: d.quando, inteira: d.inteira });
        break;
      }
      case 'abrir': case 'mostrar': abrirNoWindows(id, b.dataset.ja, b); break;
      case 'parar': pararConstrucao(b); break;
      default: break;
    }
  }

  /* ---------- construção: o cartão atualizado no lugar e o chip da barra de cima ---------- */
  let chip = null, tChip = 0, tSomeChip = 0, rafCons = 0;
  const filaCons = new Map();
  // reenvio: o canal mandou de novo ao conectar (o Jarvis estava fechado, ou a página recarregou). Se o fim chegou assim,
  // a fala do fim se perdeu com o canal fechado: ela sai agora, com um aviso
  function aoConstrucao(d, { reenvio = false } = {}) {
    if (!d || typeof d !== 'object') return;
    const id = String(d.id || '');
    if (!id) return;
    const ja = filaCons.get(id);
    filaCons.set(id, { d, reenvio: reenvio || !!(ja && ja.reenvio) });   // no máximo um redesenho por quadro (até 4 por segundo)
    if (!rafCons) rafCons = requestAnimationFrame(desenharConstrucoes);
  }
  function desenharConstrucoes() {
    rafCons = 0;
    for (const [id, { d, reenvio }] of filaCons) {
      const reg = construcoes.get(id);
      const antes = reg ? reg.dados : null;
      // o fim desta construção já está na tela: o reenvio não põe outro cartão
      if (reenvio && antes && !RODANDO.has(antes.estado) && !RODANDO.has(d.estado)) continue;
      const dados = { ...(antes || {}), ...d };
      const fimAgora = antes && RODANDO.has(antes.estado) && !RODANDO.has(dados.estado);
      if (reg && reg.art.isConnected) {
        const velho = reg.art.querySelector('.ja-c-construcao'), html = cartaoHtml('construcao', dados);
        if (velho && html) {
          const tpl = document.createElement('template'); tpl.innerHTML = html;
          const novo = tpl.content.firstElementChild;
          if (novo) velho.replaceWith(novo);
        }
        construcoes.set(id, { art: reg.art, dados, recebidoEm: performance.now() });
        dadosDe.set(reg.art, { tipo: 'construcao', dados });
      } else {
        construcoes.set(id, { art: null, dados, recebidoEm: performance.now() });
        mostrarCartao({ tipo: 'construcao', dados });   // volta pelo aoCartao, que guarda o article
      }
      if (fimAgora) {
        tocar(dados.estado === 'pronto' ? 'pronto' : 'interrompido');
        if (reenvio) {
          avisar(`A construção ${txt(dados.projeto, 60) || ''} terminou enquanto o Jarvis estava fechado.`.replace(/\s+/g, ' '));
          const f = txt(dados.fala, 400) || txt(dados.mensagem, 300);
          if (f) falar(f);
        }
      }
    }
    filaCons.clear();
    // só as 3 últimas ficam no mapa
    while (construcoes.size > 3) construcoes.delete(construcoes.keys().next().value);
    atualizarChip();
  }
  function ativa() {
    let a = null;
    for (const [id, r] of construcoes) if (r.dados && RODANDO.has(r.dados.estado)) a = { id, ...r };
    return a;
  }
  function montarChip() {
    if (chip || !barra) return chip;
    chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'ja-chip-cons'; chip.hidden = true;
    chip.innerHTML = '<i aria-hidden="true"></i><span class="ja-cc-rot">Construindo</span><b class="ja-cc-tempo">0:00</b><span class="ja-cc-pt" aria-hidden="true">·</span><b class="ja-cc-custo">US$ 0,00</b>';
    chip.addEventListener('click', () => {
      const a = ativa() || [...construcoes.values()].pop();
      if (!a) return;
      if (a.art && a.art.isConnected) {
        try { a.art.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: semMovimento() ? 'auto' : 'smooth' }); } catch { /* nada */ }
        if (!semMovimento()) { a.art.classList.remove('ja-pisca'); void a.art.offsetWidth; a.art.classList.add('ja-pisca'); }
      } else mostrarCartao({ tipo: 'construcao', dados: a.dados });
    });
    barra.insertBefore(chip, barra.firstChild);
    return chip;
  }
  function atualizarChip() {
    const a = ativa();
    clearInterval(tChip); tChip = 0;
    if (!a) {
      // terminou: o chip mostra o desfecho por 6 s e sai
      raiz && raiz.classList.remove('ja-construindo');
      if (chip && !chip.hidden && !tSomeChip) {
        const ult = [...construcoes.values()].pop();
        if (ult && ult.dados) {
          chip.dataset.estado = ult.dados.estado || '';
          chip.querySelector('.ja-cc-rot').textContent = ESTADOS_CONS[ult.dados.estado] || 'Fim';
          chip.querySelector('.ja-cc-tempo').textContent = fmtTempo(ult.dados.segundos);
          chip.querySelector('.ja-cc-custo').textContent = fmtUsd(ult.dados.custo_usd) || 'US$ 0,00';
          chip.setAttribute('aria-label', `Construção ${txt(ult.dados.projeto, 60)}: ${ESTADOS_CONS[ult.dados.estado] || 'fim'}, ${fmtTempo(ult.dados.segundos)}, ${fmtUsd(ult.dados.custo_usd) || 'US$ 0,00'}. Mostra o cartão.`);
        }
        tSomeChip = setTimeout(() => { tSomeChip = 0; if (chip && !ativa()) chip.hidden = true; }, 6000);
      }
      return;
    }
    clearTimeout(tSomeChip); tSomeChip = 0;
    montarChip();
    if (!chip) return;
    chip.hidden = false; chip.dataset.estado = a.dados.estado;
    raiz && raiz.classList.add('ja-construindo');
    chip.querySelector('.ja-cc-rot').textContent = ESTADOS_CONS[a.dados.estado] || 'Construindo';
    const passo = () => {
      const r = construcoes.get(a.id);
      if (!r || !RODANDO.has(r.dados.estado)) { atualizarChip(); return; }
      const seg = (num(r.dados.segundos) || 0) + (performance.now() - r.recebidoEm) / 1000;
      chip.querySelector('.ja-cc-tempo').textContent = fmtTempo(seg);
      chip.querySelector('.ja-cc-custo').textContent = fmtUsd(r.dados.custo_usd) || 'US$ 0,00';
      chip.setAttribute('aria-label', `Construção ${txt(r.dados.projeto, 60)}: ${ESTADOS_CONS[r.dados.estado]}, ${fmtTempo(seg)}, ${fmtUsd(r.dados.custo_usd) || 'US$ 0,00'}. Mostra o cartão.`);
      // o relógio do cartão também anda entre um evento e outro
      const tm = r.art && r.art.isConnected ? r.art.querySelector('.ja-tempo') : null;
      if (tm) tm.textContent = fmtTempo(seg);
    };
    passo();
    tChip = setInterval(passo, 1000);
  }

  /* ---------- a janelinha do print em tamanho grande ---------- */
  let jan = null;
  function fecharJanela() {
    if (!jan) return false;
    const j = jan; jan = null;
    j.vivo = false;
    try { j.ctl && j.ctl.abort(); } catch { /* nada */ }
    if (j.url) { try { URL.revokeObjectURL(j.url); } catch { /* nada */ } }
    j.el.remove();
    raiz && raiz.classList.remove('ja-com-janela');
    if (j.voltar && j.voltar.isConnected) { try { j.voltar.focus({ preventScroll: true }); } catch { /* nada */ } }
    return true;
  }
  async function janela(id, titulo, info = {}) {
    if (destruido || !raiz) return;
    fecharJanela();
    const idv = idOk(id), mini = imgOk(info && info.miniatura);
    if (!idv && !mini) { avisar('Esse print não tem imagem para mostrar.', 'rever'); return; }
    const tit = txt(titulo, 200) || 'Print';
    const meta = [txt(info.site, 80), fmtQuando(info.quando), info.inteira ? 'página inteira' : ''].filter(Boolean).join(' · ');
    const el = document.createElement('div');
    el.className = 'ja-janela';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'jaJanTit');
    el.innerHTML = `<div class="ja-jan-caixa"><span class="canto ce" aria-hidden="true"></span><span class="canto cd" aria-hidden="true"></span><span class="canto be" aria-hidden="true"></span><span class="canto bd" aria-hidden="true"></span>`
      + `<header class="ja-jan-cab"><p class="hud-rot">Print${meta ? ` · ${esc(meta)}` : ''}</p><h3 id="jaJanTit">${esc(tit)}</h3>${info.url ? `<p class="ja-url">${esc(txt(info.url, 300))}</p>` : ''}</header>`
      + `<div class="ja-jan-img" tabindex="0" aria-label="Print, role para ver tudo"><img alt="Print: ${esc(tit)}"></div>`
      + '<p class="ja-jan-st" role="status"></p>'
      + `<div class="acoes ja-jan-bts">${idv ? bt('abrir', idv, 'Abrir', ICO.abrir) + bt('mostrar', idv, 'Mostrar na pasta', ICO.pasta) : ''}<button class="btn pequeno ja-jan-fechar" type="button">${ICO.fechar}<span>Fechar</span><kbd>Esc</kbd></button></div></div>`;
    const j = { el, vivo: true, url: null, ctl: null, voltar: document.activeElement };
    jan = j;
    const img = el.querySelector('img'), st = el.querySelector('.ja-jan-st');
    el.addEventListener('click', (e) => {
      if (e.target === el) { fecharJanela(); return; }   // clique fora da caixa
      const b = e.target.closest('[data-ja], .ja-jan-fechar');
      if (!b) return;
      if (b.classList.contains('ja-jan-fechar')) { fecharJanela(); return; }
      abrirNoWindows(idOk(b.dataset.id), b.dataset.ja, b);
    });
    // Esc com o foco aqui dentro (o aoTecla do jarvis.js chama ui.teclaEsc() antes, ver o cabeçalho)
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharJanela(); } });
    if (mini) img.src = mini;
    raiz.appendChild(el);
    raiz.classList.add('ja-com-janela');
    try { el.querySelector('.ja-jan-fechar').focus({ preventScroll: true }); } catch { /* nada */ }
    if (!idv) { st.textContent = 'Só a miniatura: este print não ficou guardado.'; return; }
    // o print inteiro: GET com o token → blob → objeto local (a CSP aceita blob:)
    st.textContent = mini ? 'Carregando o print grande…' : 'Carregando o print…';
    j.ctl = new AbortController();
    let r;
    try { r = await buscar(`/api/jarvis/arquivo/${encodeURIComponent(idv)}`, { headers: { 'x-cerebro-token': token }, cache: 'no-store', signal: j.ctl.signal }); } catch { r = null; }
    if (!j.vivo) return;
    if (!r || !r.ok) {
      const s = r ? r.status : 0;
      st.textContent = `${s === 404 ? 'O print não está mais na pasta.' : s === 423 ? TRAVADO : s === 401 ? REINICIADO : s === 0 ? SEM_APP : `Não consegui abrir o print grande (${s}).`}${mini ? ' Mostrei a miniatura.' : ''}`;
      st.dataset.tom = 'rever';
      return;
    }
    let blob = null;
    try { blob = await r.blob(); } catch { blob = null; }
    if (!j.vivo) return;
    if (!blob || !/^image\/(png|jpeg|webp)$/.test(blob.type || '')) { st.textContent = 'O arquivo do print veio estranho.'; st.dataset.tom = 'rever'; return; }
    j.url = URL.createObjectURL(blob);
    await new Promise((ok) => { img.onload = img.onerror = () => ok(); img.src = j.url; });
    if (!j.vivo) return;
    st.textContent = '';
  }
  const teclaEsc = () => fecharJanela();

  /* ---------- câmera "Ver você" ---------- */
  const cam = { stream: null, el: null, video: null, ligando: null, ger: 0, simular: false, simParar: null, tOcioso: 0, tOlhei: 0, tPede: 0, ocultou: false, avisado: false, botao: null };
  function lerPref(k) { try { return localStorage.getItem(`cerebro-robo:${k}`); } catch { return null; } }
  function gravarPref(k, v) { try { localStorage.setItem(`cerebro-robo:${k}`, v); } catch { /* sem armazenamento */ } }
  function montarBotaoCamera() {
    if (cam.botao || !barra) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ja-ver';
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', 'Ver você: ligar a câmera nesta janela');
    b.title = 'Ver você: a câmera numa janelinha. Eu só olho quando a conversa pede.';
    b.innerHTML = `${ICO.camera}<span class="ja-ver-rot">Ver você</span>`;
    b.addEventListener('click', () => { if (ligada() || cam.ligando) desligar(); else ligar(); });
    const ref = barra.querySelector('.jv-ajustes-btn');
    if (ref) barra.insertBefore(b, ref); else barra.appendChild(b);
    cam.botao = b;
  }
  function montarJanelinha() {
    if (cam.el || !raiz) return cam.el;
    const el = document.createElement('section');
    el.className = 'ja-camera'; el.hidden = true;
    el.setAttribute('aria-label', 'Câmera Ver você');
    // a lente redonda (vídeo espelhado, anel, o ponto vermelho CÂMERA, o "OLHEI" e o x) e, ao lado ou embaixo, o aviso
    el.innerHTML = `<div class="ja-cam-lente"><video class="ja-cam-video" muted playsinline autoplay></video><span class="ja-cam-anel" aria-hidden="true"></span>`
      + '<span class="ja-cam-ponto" aria-hidden="true"><i></i>Câmera</span><span class="ja-cam-olhei" aria-hidden="true">OLHEI</span>'
      + `<button class="ja-cam-x" type="button" aria-label="Desligar a câmera" title="Desligar a câmera">${ICO.fechar}</button></div>`
      + `<div class="ja-cam-txt"><p class="ja-cam-tit">Ver você</p><p class="ja-cam-nota">${esc(TEXTO_CAMERA.nota)}</p></div>`
      + '<p class="sr ja-cam-st" role="status" aria-live="polite"></p>';
    el.querySelector('.ja-cam-x').addEventListener('click', () => desligar());
    raiz.appendChild(el);
    cam.el = el; cam.video = el.querySelector('video');
    cam.video.muted = true; cam.video.playsInline = true;
    return el;
  }
  const ligada = () => !!(cam.stream && cam.stream.getVideoTracks().some((t) => t.readyState === 'live'));
  function erroCamera(e) {
    const n = (e && e.name) || '';
    if (e && e.codigo) return e.codigo;
    if (/NotFound|DevicesNotFound|Overconstrained|ConstraintNotSatisfied/i.test(n)) return 'sem-camera';
    if (/NotReadable|TrackStart|Abort/i.test(n)) return 'em-uso';
    if (/NotAllowed|PermissionDenied|Security/i.test(n)) return 'negado';
    return 'sem-camera';
  }
  async function abrirReal() {
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
    if (!md || typeof md.getUserMedia !== 'function') throw Object.assign(new Error('sem-suporte'), { codigo: 'sem-suporte' });
    return md.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  }
  // câmera de mentira (só o ?debug): um canvas desenhado aqui vira a trilha de vídeo (canvas.captureStream)
  function abrirSimulada() {
    const c = document.createElement('canvas');
    c.width = 960; c.height = 540;
    if (typeof c.captureStream !== 'function') throw Object.assign(new Error('sem-suporte'), { codigo: 'sem-suporte' });
    const q = c.getContext('2d'), cs = getComputedStyle(raiz || document.documentElement);
    const cor = (k) => cs.getPropertyValue(k).trim();
    const C = { bg: cor('--bg'), s1: cor('--surface'), s2: cor('--surface-2'), holo: cor('--holo'), ink: cor('--ink'), muted: cor('--muted'), azul: cor('--azul'), vermelho: cor('--vermelho') };
    const stream = c.captureStream(15), tr = stream.getVideoTracks()[0];
    let raf = 0;
    const tick = () => {
      if (!tr || tr.readyState === 'ended') { c.width = 0; return; }
      const t = performance.now() / 1000, W = c.width, H = c.height;
      const g = q.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.s2); g.addColorStop(1, C.bg);
      q.fillStyle = g; q.fillRect(0, 0, W, H);
      q.fillStyle = C.s1; q.fillRect(W * 0.66, H * 0.1, W * 0.24, H * 0.42);   // a janela do escritório
      const cx = W / 2 + Math.sin(t * 0.7) * 26, cy = H * 0.45;
      q.fillStyle = C.azul; q.beginPath(); q.ellipse(cx, H * 1.02, W * 0.24, H * 0.36, 0, 0, Math.PI * 2); q.fill();   // ombros
      q.fillStyle = C.muted; q.beginPath(); q.ellipse(cx, cy, W * 0.085, H * 0.2, 0, 0, Math.PI * 2); q.fill();        // cabeça
      q.fillStyle = C.vermelho; q.fillRect(W * 0.08, H * 0.12, 120, 64);
      q.fillStyle = C.ink; q.font = '600 26px "JetBrains Mono", monospace'; q.fillText('LUBE', W * 0.08 + 22, H * 0.12 + 42);
      q.fillStyle = C.holo; q.font = '600 22px "JetBrains Mono", monospace'; q.fillText('CÂMERA SIMULADA', 28, H - 30);
      q.fillText(new Date().toLocaleTimeString('pt-BR'), W - 150, H - 30);
      raf = requestAnimationFrame(tick);
    };
    tick();
    cam.simParar = () => { cancelAnimationFrame(raf); c.width = 0; };
    return stream;
  }
  function pararStream(s) { try { for (const t of s.getTracks()) t.stop(); } catch { /* nada */ } }
  function armarOcioso() {
    clearTimeout(cam.tOcioso);
    cam.tOcioso = setTimeout(() => { if (ligada()) { desligar(); avisar(TEXTO_CAMERA.ocioso); } }, OCIOSO_MS);
  }
  function marcarBotao() {
    const on = ligada() || !!cam.ligando;
    if (cam.botao) {
      cam.botao.setAttribute('aria-pressed', String(on));
      cam.botao.setAttribute('aria-label', on ? 'Ver você: desligar a câmera' : 'Ver você: ligar a câmera nesta janela');
      cam.botao.classList.toggle('ja-ligando', !!cam.ligando && !ligada());
    }
  }
  async function ligar() {
    if (destruido || !raiz || ligada()) return;
    if (cam.ligando) return cam.ligando;
    if (raiz && raiz.classList.contains('rs-travado')) { avisar(TEXTO_CAMERA.travado, 'rever'); return; }
    clearTimeout(cam.tPede); if (cam.botao) cam.botao.classList.remove('ja-pede');
    const ger = ++cam.ger;
    cam.ligando = (async () => {
      montarJanelinha(); marcarBotao();
      let s;
      try { s = cam.simular ? abrirSimulada() : await abrirReal(); } catch (e) {
        if (ger === cam.ger) avisar(TEXTO_CAMERA[erroCamera(e)] || TEXTO_CAMERA['sem-camera'], 'alerta');
        return;
      }
      // desligado (ou desligado e ligado de novo) enquanto o pedido de permissão estava na tela: a trilha velha para aqui
      if (ger !== cam.ger || destruido) { pararStream(s); return; }
      cam.stream = s;
      const tr = s.getVideoTracks()[0];
      if (tr) tr.addEventListener('ended', () => { if (cam.stream === s) { desligar(); avisar(TEXTO_CAMERA.caiu, 'rever'); } });
      const v = cam.video;
      v.srcObject = s;
      try { await Promise.race([v.play(), new Promise((ok) => setTimeout(ok, 3000))]); } catch { /* o autoplay mudo costuma bastar */ }
      if (ger !== cam.ger || destruido) return;
      cam.el.hidden = false;
      raiz.classList.add('ja-com-camera');
      if (!semMovimento()) { cam.el.classList.remove('ja-entra'); void cam.el.offsetWidth; cam.el.classList.add('ja-entra'); }
      armarOcioso();
      if (!cam.avisado && lerPref('jarvis-ver-voce-avisado') !== '1') { cam.avisado = true; gravarPref('jarvis-ver-voce-avisado', '1'); avisar(TEXTO_CAMERA.aviso); }
      try { typeof opts.onCamera === 'function' && opts.onCamera(true); } catch { /* nada */ }
    })().finally(() => { if (ger === cam.ger) cam.ligando = null; marcarBotao(); });
    return cam.ligando;
  }
  function desligar() {
    const estava = ligada() || !!cam.ligando;
    cam.ger++;
    cam.ligando = null;
    clearTimeout(cam.tOcioso); clearTimeout(cam.tOlhei);
    if (cam.stream) pararStream(cam.stream);
    cam.stream = null;
    if (cam.simParar) { cam.simParar(); cam.simParar = null; }
    if (cam.video) { try { cam.video.pause(); } catch { /* nada */ } cam.video.srcObject = null; }
    if (cam.el) { cam.el.hidden = true; cam.el.classList.remove('ja-olhou', 'ja-entra'); }
    raiz && raiz.classList.remove('ja-com-camera');
    marcarBotao();
    if (estava) { try { typeof opts.onCamera === 'function' && opts.onCamera(false); } catch { /* nada */ } }
  }
  // o quadro mais recente, só na memória: 768 px de largura (sem aumentar câmera menor), JPEG 0,7, sem espelhar (o
  // Claude vê a cena como ela é; o espelho é só na janelinha). O canvas some no fim
  function quadro() {
    const v = cam.video;
    if (!ligada() || !v || !(v.videoWidth > 0) || v.readyState < 2) return null;
    // câmera em pé (retrato): a altura também fica em até 1280 px (o servidor recusa mais que isso)
    const vw = v.videoWidth, vh = v.videoHeight, s = Math.min(1, CAMERA_LARGURA / vw, 1280 / vh);
    const w = Math.round(vw * s), h = Math.round(vh * s);
    if (w < 64 || h < 64) return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    let url = '';
    try {
      c.getContext('2d').drawImage(v, 0, 0, w, h);
      url = c.toDataURL('image/jpeg', CAMERA_QUALIDADE);
      if (url.length > CAMERA_MAX_B64 + 32) url = c.toDataURL('image/jpeg', 0.5);
    } catch { url = ''; } finally { c.width = 0; c.height = 0; }
    const k = url.indexOf(','), jpeg = k > 0 ? url.slice(k + 1) : '';
    if (!jpeg.startsWith('/9j/') || jpeg.length > CAMERA_MAX_B64) return null;
    armarOcioso();   // a conversa está andando: os 10 min contam de novo
    return { jpeg, w, h, em: Date.now() };
  }
  function olhou() {
    if (!cam.el || cam.el.hidden) return;
    const st = cam.el.querySelector('.ja-cam-st');
    if (st) { st.textContent = ''; setTimeout(() => { st.textContent = 'Olhei pela câmera agora.'; }, 30); }
    clearTimeout(cam.tOlhei);
    // movimento reduzido (o do Windows ou o ajuste do app): sem o pisca do anel, fica só o OLHEI
    cam.el.classList.toggle('ja-calmo', semMovimento());
    cam.el.classList.remove('ja-olhou'); void cam.el.offsetWidth; cam.el.classList.add('ja-olhou');
    cam.tOlhei = setTimeout(() => cam.el && cam.el.classList.remove('ja-olhou'), 1200);
  }
  // o Jarvis quis ligar a câmera sem a fala do Júlio pedir (um texto lido num site pode ter pedido): quem liga é o clique.
  // O botão "Ver você" pisca por 8 s
  function pedirClique() {
    if (ligada() || cam.ligando || !cam.botao) return;
    clearTimeout(cam.tPede);
    cam.botao.classList.remove('ja-pede'); void cam.botao.offsetWidth; cam.botao.classList.add('ja-pede');
    cam.tPede = setTimeout(() => cam.botao && cam.botao.classList.remove('ja-pede'), 8000);
    avisar(TEXTO_CAMERA.pedir, 'rever');
  }
  // o olhar_camera pediu um quadro novo no meio do turno (a câmera acabou de ligar): espera ela ligar e a primeira imagem,
  // e manda (só na memória; null = a câmera está desligada)
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  async function mandarQuadro(pedido) {
    if (typeof pedido !== 'string' || !/^qd_[A-Za-z0-9_-]{16}$/.test(pedido) || destruido) return;
    let q = null;
    if (cam.ligando) { try { await Promise.race([cam.ligando, pausa(5000)]); } catch { /* nada */ } }
    for (let i = 0; i < 20 && !q && ligada(); i++) { q = quadro(); if (!q) await pausa(150); }
    await pedir('POST', '/api/jarvis/camera/quadro', { pedido, quadro: q || null });
  }
  function aoEventoCamera(e) {
    const acao = e && typeof e === 'object' ? String(e.acao || '') : String(e || '');
    if (acao === 'ligar') ligar();
    else if (acao === 'desligar') desligar();
    else if (acao === 'pedir') pedirClique();
    else if (acao === 'quadro') mandarQuadro(e && e.pedido);
    else if (acao === 'olhou') olhou();
    else if (acao === 'conferir' || acao === 'conferir_rosto') {
      // o portão do rosto abre a câmera dele: a daqui desliga antes
      desligar();
      try { typeof opts.conferirRosto === 'function' && opts.conferirRosto(); } catch { /* nada */ }
    }
  }
  // a câmera nunca fica ligada sem o Jarvis na frente: janela escondida, Jarvis fechando, portão do rosto
  function aoVisibilidade() {
    if (document.hidden) { if (ligada() || cam.ligando) { cam.ocultou = true; desligar(); } }
    else if (cam.ocultou) { cam.ocultou = false; avisar(TEXTO_CAMERA.oculto, 'rever'); }
  }
  document.addEventListener('visibilitychange', aoVisibilidade);
  let vigia = null;
  if (raiz && typeof MutationObserver === 'function') {
    vigia = new MutationObserver(() => {
      const saindo = raiz.hidden || raiz.classList.contains('saindo');
      if (saindo) { if (ligada() || cam.ligando) desligar(); fecharJanela(); }
      else if (raiz.classList.contains('rs-travado') && (ligada() || cam.ligando)) desligar();
    });
    vigia.observe(raiz, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }

  /* ---------- o canal de eventos (/api/jarvis/eventos?aba=): andamento, cartões e falas fora do turno ---------- */
  const ev = { ctl: null, quer: false, n: 0, falhas: 0, t: 0 };
  function aoEvento(nome, d) {
    if (destruido) return;
    switch (nome) {
      case 'construcao': aoConstrucao(d, { reenvio: !!(d && d.reenvio) }); break;
      case 'acao': try { typeof opts.onAcao === 'function' && opts.onAcao(d); } catch { /* nada */ } break;
      case 'cartao': if (d && d.tipo) mostrarCartao({ tipo: String(d.tipo), dados: d.dados && typeof d.dados === 'object' ? d.dados : {} }); break;
      case 'falar': if (d && typeof d.texto === 'string' && d.texto.trim()) falar(txt(d.texto, 400)); break;
      case 'camera': aoEventoCamera(d); break;
      default: break;
    }
  }
  function reagendar(ms) {
    if (!ev.quer || destruido) return;
    const atraso = ms ?? RECUO_SSE[Math.min(RECUO_SSE.length - 1, ev.falhas++)];
    clearTimeout(ev.t);
    ev.t = setTimeout(() => { if (ev.quer && !ev.ctl) abrirEventos(); }, atraso);
  }
  async function abrirEventos() {
    if (!token || !aba || destruido) return;
    const n = ++ev.n, ctl = new AbortController();
    ev.ctl = ctl;
    let resp;
    try {
      resp = await buscar(`/api/jarvis/eventos?aba=${encodeURIComponent(aba)}`, { headers: { 'x-cerebro-token': token, accept: 'text/event-stream' }, cache: 'no-store', signal: ctl.signal });
    } catch { if (n === ev.n) { ev.ctl = null; reagendar(); } return; }
    if (n !== ev.n) { try { ctl.abort(); } catch { /* nada */ } return; }
    if (resp.status === 401) { ev.ctl = null; ev.quer = false; avisar(REINICIADO, 'alerta'); return; }
    if (resp.status === 423) { ev.ctl = null; reagendar(5000); return; }   // travado: volta sozinho quando o portão liberar
    if (resp.status === 404 || resp.status === 400) { ev.ctl = null; ev.quer = false; return; }   // o app ainda não tem o canal
    if (!resp.ok || !resp.body) { ev.ctl = null; reagendar(); return; }
    ev.falhas = 0;
    const leitor = resp.body.getReader(), dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let m;
        while ((m = /\r?\n\r?\n/.exec(buf))) {
          const b = buf.slice(0, m.index); buf = buf.slice(m.index + m[0].length);
          const e = analisarSse(b);
          if (e && n === ev.n) aoEvento(e.evento, e.dados);
        }
        if (n !== ev.n) { try { leitor.cancel().catch(() => {}); } catch { /* nada */ } return; }
        if (buf.length > 2e6) buf = '';   // bloco sem fim: lixo
      }
    } catch { /* caiu no meio */ }
    if (n === ev.n) { ev.ctl = null; reagendar(); }
  }
  // ao reabrir o Jarvis: a construção que estava rodando aqui pode ter terminado com o canal fechado. Pergunta ao servidor
  // e acerta o cartão (o fim, o print e a fala); a que o servidor nem conhece mais (app reiniciado) vira "parado"
  async function conferirConstrucoes() {
    const rodando = [...construcoes.entries()].filter(([, r]) => r.dados && RODANDO.has(r.dados.estado));
    if (!rodando.length || destruido) return;
    const r = await pedir('GET', '/api/jarvis/construcao');
    if (r.status !== 200 || !r.j || typeof r.j !== 'object') return;
    const at = r.j.ativa && typeof r.j.ativa === 'object' ? r.j.ativa : null;
    const ultimas = lista(r.j.ultimas).filter((u) => u && typeof u === 'object');
    for (const [id, reg] of rodando) {
      if (at && String(at.id) === id) { aoConstrucao(at); continue; }
      const fim = ultimas.find((u) => String(u.id) === id);
      if (fim) aoConstrucao(fim, { reenvio: true });
      else aoConstrucao({ ...reg.dados, estado: 'parado', etapa: 'Parado', mensagem: 'A construção parou: o app do cérebro foi reiniciado. O que ficou está na pasta do projeto.' }, { reenvio: true });
    }
  }
  const eventos = {
    conectar() {
      if (destruido) return;
      ev.quer = true;
      conferirConstrucoes().catch(() => {});
      if (ev.ctl) return;
      clearTimeout(ev.t); ev.falhas = 0;
      abrirEventos();
    },
    // o Jarvis fechou: o canal fecha e o relógio do chip para (volta no conectar, se ainda houver construção rodando)
    fechar() {
      ev.quer = false; ev.n++; clearTimeout(ev.t); try { ev.ctl && ev.ctl.abort(); } catch { /* nada */ } ev.ctl = null;
      clearInterval(tChip); tChip = 0;
    },
    ligado: () => !!ev.ctl
  };

  montarBotaoCamera();

  /* ---------- fim ---------- */
  function destruir() {
    if (destruido) return;
    desligar(); fecharJanela(); eventos.fechar();
    destruido = true;
    clearInterval(tChip); clearTimeout(tSomeChip); cancelAnimationFrame(rafCons);
    document.removeEventListener('visibilitychange', aoVisibilidade);
    try { vigia && vigia.disconnect(); } catch { /* nada */ }
    for (const e of [cam.el, cam.botao, chip]) { try { e && e.remove(); } catch { /* nada */ } }
    cam.el = null; cam.botao = null; chip = null;
    raiz && raiz.classList.remove('ja-com-camera', 'ja-construindo', 'ja-com-janela');
    construcoes.clear();
    try { if (window.__acoes && window.__acoes._ui === api) delete window.__acoes; } catch { /* nada */ }
  }

  const api = {
    aoCartao,
    camera: { ligar, desligar, ligada, quadro, olhou },
    aoEventoCamera,
    eventos,
    janela, janelaAberta: () => !!jan, fecharJanela, teclaEsc,
    destruir
  };
  // teste local (localhost com ?debug): ganchos para pôr cartões, ações, eventos e a câmera de mentira na tela
  if (ehLocal() && /[?&]debug\b/.test(location.search)) {
    try {
      window.__acoes = {
        _ui: api,
        cartao: (tipo, dados) => mostrarCartao({ tipo, dados }),
        acao: (tipo, detalhe, resumo) => {
          const a = { id: `teste-${Date.now().toString(36)}`, tipo, resumo: resumo || `Teste: ${rotuloAcao(tipo)}`, detalhe, expira_em: new Date(Date.now() + 5 * 60000).toISOString() };
          if (typeof opts.abrirAcao === 'function') opts.abrirAcao(a);
          return detalheAcaoHtml(tipo, detalhe);
        },
        camera: {
          simular(v = true) { cam.simular = !!v; return cam.simular; },
          // o tamanho do quadro, nunca a imagem
          quadro() { const q = quadro(); return q ? { w: q.w, h: q.h, em: q.em, kb: Math.round((q.jpeg.length * 3) / 4 / 1024), jpeg: q.jpeg.startsWith('/9j/') } : null; }
        },
        evento: (nome, dados) => aoEvento(nome, dados || {}),
        janela
      };
    } catch { /* nada */ }
  }
  return api;
}
