/* Cérebro da Lube — servidor/acoes.js
   O que muda algo (mandar e-mail; mover, renomear, apagar ou mudar um arquivo da pasta do Jarvis; preencher formulário
   em site; abrir site que o Júlio não citou; abrir no navegador padrão uma página HTML da pasta do Jarvis; começar uma
   construção) nunca roda pelo modelo. A ferramenta só PREPARA e
   registra aqui uma ação pendente; quem decide é a interface, com POST /api/jarvis/acao/:id (a fala "aprovado"
   reconhecida enquanto o cartão está aberto, ou o botão). Uma ação pendente expira em 5 minutos.
   UMA ação pendente por vez, de qualquer tipo (docs/JARVIS-ACOES.md §4.1): com duas na tela, "aprovado" seria ambíguo. A
   nova SUBSTITUI a anterior, de forma explícita (a ferramenta avisa o modelo, e o canal de eventos avisa a tela), e a
   anterior não pode mais ser aprovada.
   O desfecho (feito, cancelado, expirou, falhou) vira um aviso que entra na próxima fala do Jarvis como mensagem do
   sistema — é assim que ele fica sabendo, e só assim pode dizer que algo foi feito. Cada aviso pertence à aba (janela)
   que criou a ação: outra janela do app não recebe o desfecho de uma conversa que não é dela.
   O log diz só o tipo, a via e o tamanho ("ação: aprovada por voz (mover, 3 itens)"), nunca o conteúdo.
   Recusar é o lado seguro: o modelo pode tirar a ação da tela (cancelarDaAba, a ferramenta cancelar_acao) quando o Júlio
   recusa com palavras fora da lista da voz ("não precisa mais disso"). Aprovar, nunca. */
import crypto from 'node:crypto';
import { horaSP, log } from './util.js';

const EXPIRA_MS = 5 * 60 * 1000;
export const TIPOS_ACAO = Object.freeze(['enviar_email', 'mover', 'renomear', 'apagar', 'alterar', 'formulario', 'construir', 'navegar', 'abrir']);
const TIPOS = new Set(TIPOS_ACAO);
const pendentes = new Map();   // id -> {id, tipo, resumo, detalhe, criadaEm, expiraEm, estado, executar, timer, aba}
let avisos = [];               // [{texto, aba}]
const ouvintes = new Set();    // fn({evento, id, tipo, aba}) — o canal /api/jarvis/eventos
export const MOTIVOS_RECUSA = new Set(['substituida', 'expirou', 'saiu']);
export const VIAS = new Set(['voz', 'clique', 'teclado']);

// o que "não aconteceu" em cada tipo, para os avisos de recusa e de expiração
const NADA = {
  enviar_email: 'nada foi enviado', formulario: 'nada foi enviado', construir: 'a construção não começou',
  navegar: 'o site não foi aberto', abrir: 'a página não foi aberta',
};
const nadaFeito = (tipo) => NADA[tipo] || 'nada foi feito';
const COMO = { voz: 'por voz', clique: 'na tela', teclado: 'na tela' };

function publico(a) {
  return { id: a.id, tipo: a.tipo, resumo: a.resumo, detalhe: a.detalhe, expira_em: new Date(a.expiraEm).toISOString() };
}
const avisarDaAcao = (a, texto) => avisos.push({ texto, aba: a.aba || null });
function contar(evento, a) {
  for (const fn of ouvintes) { try { fn({ evento, id: a.id, tipo: a.tipo, aba: a.aba || null }); } catch (_) { /* o canal é extra */ } }
}
// "3 itens", "1 campo": só o tamanho, para o log
function tamanhoDe(a) {
  const d = a.detalhe && typeof a.detalhe === 'object' ? a.detalhe : {};
  if (Array.isArray(d.itens)) return `${d.itens.length} ${d.itens.length === 1 ? 'item' : 'itens'}`;
  if (Array.isArray(d.campos)) return `${d.campos.length} ${d.campos.length === 1 ? 'campo' : 'campos'}`;
  if (Array.isArray(d.para)) return `${d.para.length} ${d.para.length === 1 ? 'destinatário' : 'destinatários'}`;
  return '';
}

/** Escuta as mudanças das ações (nova, trocada, decidida, expirou). Devolve a função que para de escutar. */
export function ouvir(fn) {
  if (typeof fn !== 'function') return () => {};
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/** Um aviso para a próxima fala do Jarvis nesta aba (o construtor usa para contar que terminou). */
export function avisar(aba, texto) {
  if (typeof texto !== 'string' || !texto.trim()) return;
  avisos.push({ texto: texto.trim(), aba: aba || null });
  if (avisos.length > 50) avisos = avisos.slice(-50);
}

/**
 * Registra uma ação pendente. executar() -> Promise<{ok, mensagem, cartao?, cartoes?, fala?, paraModelo?}> só é chamado
 * na aprovação. mensagem: a tela (e o aviso do modelo); fala: a frase curta para a voz, sem caminho nem extensão;
 * paraModelo: um texto que só o modelo lê (no aviso da próxima fala), nunca a tela nem a voz.
 * Devolve o público da ação e, se havia outra pendente (de qualquer tipo), `substituiu` (o resumo dela) e
 * `substituiu_tipo`: ela sai na hora e não pode mais ser aprovada.
 */
export function criarAcao({ tipo, resumo, detalhe, executar, aba = null }) {
  if (!TIPOS.has(tipo)) throw new Error(`criarAcao: tipo de ação desconhecido (${tipo})`);
  if (typeof executar !== 'function') throw new Error('criarAcao: falta o executar');
  let substituiu = null, substituiuTipo = null;
  for (const [idVelha, v] of pendentes) {
    if (v.estado !== 'pendente') continue;
    pendentes.delete(idVelha); clearTimeout(v.timer);
    substituiu = v.resumo; substituiuTipo = v.tipo;   // o modelo fica sabendo pelo resultado da própria ferramenta (sem aviso duplicado)
    contar('trocada', v);
  }
  const id = 'acao_' + crypto.randomBytes(9).toString('base64url');
  const agora = Date.now();
  const a = { id, tipo, resumo, detalhe, criadaEm: agora, expiraEm: agora + EXPIRA_MS, estado: 'pendente', executar, aba: aba || null };
  a.timer = setTimeout(() => {
    if (pendentes.get(id) === a && a.estado === 'pendente') {
      pendentes.delete(id);
      avisarDaAcao(a, `A ação "${resumo}" expirou sem a aprovação do Júlio às ${horaSP()}: ${nadaFeito(tipo)}.`);
      contar('expirou', a);
    }
  }, EXPIRA_MS);
  a.timer.unref?.();
  pendentes.set(id, a);
  contar('nova', a);
  return { ...publico(a), substituiu, substituiu_tipo: substituiuTipo };
}

/**
 * decisao: 'confirmar' (aprovar) | 'recusar' (motivo da recusa automática: 'substituida' | 'expirou' | 'saiu').
 * via: 'voz' | 'clique' | 'teclado' (só para o aviso e o log). Devolve {status HTTP, ok, mensagem, cartao?}.
 */
export async function decidir(id, decisao, motivo, via = 'clique') {
  const a = pendentes.get(id);
  const como = COMO[VIAS.has(via) ? via : 'clique'];
  // a interface avisa que trocou o cartão; o servidor já tinha tirado a ação velha ao criar a nova: nada a fazer
  if (!a && decisao === 'recusar' && motivo === 'substituida') return { status: 200, ok: true, mensagem: 'A ação anterior já tinha saído.' };
  if (!a) return { status: 404, ok: false, mensagem: 'Essa ação não está mais pendente (já foi decidida, trocada por outra ou expirou).' };
  if (a.estado !== 'pendente') return { status: 409, ok: false, mensagem: 'Essa ação já está sendo executada.' };
  if (Date.now() > a.expiraEm) {
    pendentes.delete(id); clearTimeout(a.timer);
    avisarDaAcao(a, `A ação "${a.resumo}" expirou sem a aprovação do Júlio: ${nadaFeito(a.tipo)}.`);
    contar('expirou', a);
    return { status: 410, ok: false, mensagem: `Essa ação expirou (passou de 5 minutos). ${nadaFeito(a.tipo).replace(/^./, c => c.toUpperCase())}.` };
  }
  if (decisao === 'recusar') {
    pendentes.delete(id); clearTimeout(a.timer);
    const m = MOTIVOS_RECUSA.has(motivo) ? motivo : null;
    const nada = nadaFeito(a.tipo);
    avisarDaAcao(a, m === 'substituida' ? `A ação "${a.resumo}" foi trocada por uma nova na tela: ${nada}.`
      : m === 'expirou' ? `A ação "${a.resumo}" expirou sem a aprovação do Júlio às ${horaSP()}: ${nada}.`
        : m === 'saiu' ? `O Júlio saiu do modo Jarvis com a ação "${a.resumo}" esperando aprovação: ${nada}.`
          : `O Júlio recusou ${como} a ação "${a.resumo}" às ${horaSP()}: ${nada}.`);
    if (!m) log(`ação: recusada ${como} (${a.tipo}${tamanhoDe(a) ? `, ${tamanhoDe(a)}` : ''})`);
    contar(m === 'expirou' ? 'expirou' : 'decidida', a);
    return { status: 200, ok: true, mensagem: `Cancelado: ${nada}.` };
  }
  if (decisao !== 'confirmar') return { status: 400, ok: false, mensagem: 'Decisão inválida: use confirmar ou recusar.' };
  a.estado = 'executando';
  clearTimeout(a.timer);
  log(`ação: aprovada ${como} (${a.tipo}${tamanhoDe(a) ? `, ${tamanhoDe(a)}` : ''})`);
  let r;
  try {
    r = await a.executar();
  } catch (e) {
    log('ação: falhou', a.tipo, e?.code || e?.codigo || '');
    r = { ok: false, mensagem: `Não consegui concluir a ação: ${nadaFeito(a.tipo)} de certeza.` };
  } finally {
    pendentes.delete(id);
  }
  if (!r || typeof r !== 'object') r = { ok: false, mensagem: 'A ação não respondeu.' };
  const mensagem = String(r.mensagem || (r.ok ? 'Feito.' : 'Não deu certo.'));
  const extra = typeof r.paraModelo === 'string' && r.paraModelo.trim() ? ` ${r.paraModelo.trim()}` : '';
  avisarDaAcao(a, r.ok
    ? `O Júlio aprovou ${como} às ${horaSP()} a ação "${a.resumo}", e ela foi concluída: ${mensagem}${extra}`
    : `O Júlio aprovou ${como} às ${horaSP()} a ação "${a.resumo}", mas ela falhou: ${mensagem}${extra}`);
  contar('decidida', a);
  // o que a ação deixou para ver: um cartão (cartao) ou alguns (cartoes, até 3: o print e a página do site aprovado)
  const umCartao = c => (c && typeof c === 'object' && typeof c.tipo === 'string' ? { tipo: c.tipo, dados: c.dados ?? {} } : null);
  const cartoes = [r.cartao, ...(Array.isArray(r.cartoes) ? r.cartoes : [])].map(umCartao).filter(Boolean).slice(0, 3);
  const fala = typeof r.fala === 'string' && r.fala.trim() ? r.fala.trim().slice(0, 300) : undefined;
  return {
    status: r.ok ? 200 : 502, ok: !!r.ok, mensagem,
    ...(cartoes.length ? { cartao: cartoes[0] } : {}), ...(cartoes.length > 1 ? { cartoes: cartoes.slice(1) } : {}),
    ...(fala ? { fala } : {}),
  };
}

/**
 * A ferramenta cancelar_acao: o Júlio recusou com outras palavras e o modelo tira da tela a ação pendente desta aba (ou
 * a sem aba). Recusar é o lado seguro: nada roda. Sem aviso para a próxima fala (o resultado da ferramenta já conta ao
 * modelo); a tela fica sabendo pelo canal (evento decidida). Devolve {tipo, resumo} da ação tirada, ou null.
 */
export function cancelarDaAba(aba = null) {
  for (const [id, a] of pendentes) {
    if (a.estado !== 'pendente') continue;
    if (aba && a.aba && a.aba !== aba) continue;
    pendentes.delete(id); clearTimeout(a.timer);
    log(`ação: recusada na conversa (${a.tipo}${tamanhoDe(a) ? `, ${tamanhoDe(a)}` : ''})`);
    contar('decidida', a);
    return { tipo: a.tipo, resumo: a.resumo };
  }
  return null;
}

/** Os desfechos desde a última fala desta aba (e os sem aba), tirados da fila. */
export function tirarAvisos(aba = null) {
  const meus = [], outros = [];
  for (const v of avisos) (!v.aba || !aba || v.aba === aba ? meus : outros).push(v);
  avisos = outros;
  return meus.map(v => v.texto);
}

/** Devolve à fila avisos tirados por um turno que foi cancelado antes de o Jarvis dizer qualquer coisa. */
export function devolverAvisos(lista, aba = null) {
  if (!Array.isArray(lista) || !lista.length) return;
  avisos.unshift(...lista.map(texto => ({ texto, aba: aba || null })));
}

export function quantasPendentes() { return pendentes.size; }
