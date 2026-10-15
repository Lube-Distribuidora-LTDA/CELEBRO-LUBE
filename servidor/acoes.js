/* Cérebro da Lube — servidor/acoes.js
   Ações que mudam algo fora do computador (hoje: enviar e-mail) nunca rodam pelo modelo. A ferramenta só PREPARA e
   registra aqui uma ação pendente; quem decide é a interface, com POST /api/jarvis/acao/:id (clique, ou a frase curta
   de confirmação reconhecida enquanto o cartão está aberto). Uma ação pendente expira em 5 minutos.
   Só uma ação pendente de cada tipo por vez: um rascunho novo SUBSTITUI o anterior, de forma explícita (a ferramenta
   avisa o modelo), e o anterior não pode mais ser confirmado.
   O desfecho (enviado, cancelado, expirou, falhou) vira um aviso que entra na próxima fala do Jarvis como mensagem do
   sistema — é assim que ele fica sabendo, e só assim pode dizer que algo foi enviado. Cada aviso pertence à aba (janela)
   que criou a ação: outra janela do app não recebe o desfecho de uma conversa que não é dela. */
import crypto from 'node:crypto';
import { horaSP, log } from './util.js';

const EXPIRA_MS = 5 * 60 * 1000;
const pendentes = new Map();   // id -> {id, tipo, resumo, detalhe, criadaEm, expiraEm, estado, executar, timer, aba}
let avisos = [];               // [{texto, aba}]
export const MOTIVOS_RECUSA = new Set(['substituida', 'expirou', 'saiu']);

function publico(a) {
  return { id: a.id, tipo: a.tipo, resumo: a.resumo, detalhe: a.detalhe, expira_em: new Date(a.expiraEm).toISOString() };
}
const avisar = (a, texto) => avisos.push({ texto, aba: a.aba || null });

/**
 * Registra uma ação pendente. executar() -> Promise<{ok, mensagem}> só é chamado na confirmação.
 * Devolve o público da ação e, se havia outra pendente do mesmo tipo, `substituiu` (o resumo dela), que sai na hora.
 */
export function criarAcao({ tipo, resumo, detalhe, executar, aba = null }) {
  let substituiu = null;
  for (const [idVelha, v] of pendentes) {
    if (v.tipo === tipo && v.estado === 'pendente') {
      pendentes.delete(idVelha); clearTimeout(v.timer);
      substituiu = v.resumo;   // o modelo fica sabendo pelo resultado da própria ferramenta (sem aviso duplicado)
    }
  }
  const id = 'acao_' + crypto.randomBytes(9).toString('base64url');
  const agora = Date.now();
  const a = { id, tipo, resumo, detalhe, criadaEm: agora, expiraEm: agora + EXPIRA_MS, estado: 'pendente', executar, aba: aba || null };
  a.timer = setTimeout(() => {
    if (pendentes.get(id) === a && a.estado === 'pendente') {
      pendentes.delete(id);
      avisar(a, `A ação "${resumo}" expirou sem confirmação do Júlio às ${horaSP()}: nada foi enviado.`);
    }
  }, EXPIRA_MS);
  a.timer.unref?.();
  pendentes.set(id, a);
  return { ...publico(a), substituiu };
}

/** decisao: 'confirmar' | 'recusar' (motivo da recusa automática: 'substituida' | 'expirou' | 'saiu'). Devolve {status HTTP, ok, mensagem}. */
export async function decidir(id, decisao, motivo) {
  const a = pendentes.get(id);
  // a interface avisa que trocou o cartão; o servidor já tinha tirado o rascunho velho ao criar o novo: nada a fazer
  if (!a && decisao === 'recusar' && motivo === 'substituida') return { status: 200, ok: true, mensagem: 'O rascunho anterior já tinha saído.' };
  if (!a) return { status: 404, ok: false, mensagem: 'Essa ação não está mais pendente (já foi decidida, trocada por outra ou expirou).' };
  if (a.estado !== 'pendente') return { status: 409, ok: false, mensagem: 'Essa ação já está sendo executada.' };
  if (Date.now() > a.expiraEm) {
    pendentes.delete(id); clearTimeout(a.timer);
    avisar(a, `A ação "${a.resumo}" expirou sem confirmação do Júlio: nada foi enviado.`);
    return { status: 410, ok: false, mensagem: 'Essa ação expirou (passou de 5 minutos). Nada foi enviado.' };
  }
  if (decisao === 'recusar') {
    pendentes.delete(id); clearTimeout(a.timer);
    const m = MOTIVOS_RECUSA.has(motivo) ? motivo : null;
    avisar(a, m === 'substituida' ? `O rascunho "${a.resumo}" foi trocado por um novo na tela: ele não foi enviado.`
      : m === 'expirou' ? `A ação "${a.resumo}" expirou sem confirmação do Júlio às ${horaSP()}: nada foi enviado.`
        : m === 'saiu' ? `O Júlio saiu do modo Jarvis com a ação "${a.resumo}" esperando confirmação: nada foi enviado.`
          : `O Júlio cancelou na tela a ação "${a.resumo}" às ${horaSP()}: nada foi enviado.`);
    return { status: 200, ok: true, mensagem: 'Cancelado. Nada foi enviado.' };
  }
  if (decisao !== 'confirmar') return { status: 400, ok: false, mensagem: 'Decisão inválida: use confirmar ou recusar.' };
  a.estado = 'executando';
  clearTimeout(a.timer);
  let r;
  try {
    r = await a.executar();
  } catch (e) {
    log('ação: falhou', a.tipo, e?.code || '');
    r = { ok: false, mensagem: 'Não consegui concluir a ação. Nada foi confirmado como enviado.' };
  } finally {
    pendentes.delete(id);
  }
  avisar(a, r.ok
    ? `O Júlio confirmou na tela a ação "${a.resumo}" e ela foi concluída às ${horaSP()}: ${r.mensagem}`
    : `O Júlio confirmou na tela a ação "${a.resumo}", mas ela falhou às ${horaSP()}: ${r.mensagem}`);
  return { status: r.ok ? 200 : 502, ok: !!r.ok, mensagem: r.mensagem };
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
