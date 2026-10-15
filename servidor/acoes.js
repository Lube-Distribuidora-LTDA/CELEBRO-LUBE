/* Cérebro da Lube — servidor/acoes.js
   Ações que mudam algo fora do computador (hoje: enviar e-mail) nunca rodam pelo modelo. A ferramenta só PREPARA e
   registra aqui uma ação pendente; quem decide é a interface, com POST /api/jarvis/acao/:id (clique ou a frase curta
   de confirmação reconhecida enquanto o cartão está aberto). Uma ação pendente expira em 5 minutos.
   O desfecho (enviado, cancelado, expirou, falhou) vira um aviso que entra na próxima fala do Jarvis como mensagem do
   sistema — é assim que ele fica sabendo, e só assim pode dizer que algo foi enviado. */
import crypto from 'node:crypto';
import { horaSP, log } from './util.js';

const EXPIRA_MS = 5 * 60 * 1000;
const pendentes = new Map();   // id -> {id, tipo, resumo, detalhe, criadaEm, expiraEm, estado, executar, timer}
let avisos = [];

function publico(a) {
  return { id: a.id, tipo: a.tipo, resumo: a.resumo, detalhe: a.detalhe, expira_em: new Date(a.expiraEm).toISOString() };
}

/** Registra uma ação pendente. executar() -> Promise<{ok, mensagem}> só é chamado na confirmação. */
export function criarAcao({ tipo, resumo, detalhe, executar }) {
  const id = 'acao_' + crypto.randomBytes(9).toString('base64url');
  const agora = Date.now();
  const a = { id, tipo, resumo, detalhe, criadaEm: agora, expiraEm: agora + EXPIRA_MS, estado: 'pendente', executar };
  a.timer = setTimeout(() => {
    if (pendentes.get(id) === a && a.estado === 'pendente') {
      pendentes.delete(id);
      avisos.push(`A ação "${resumo}" expirou sem confirmação do Júlio às ${horaSP()}: nada foi enviado.`);
    }
  }, EXPIRA_MS);
  a.timer.unref?.();
  pendentes.set(id, a);
  return publico(a);
}

/** decisao: 'confirmar' | 'recusar'. Devolve {status HTTP, ok, mensagem}. */
export async function decidir(id, decisao) {
  const a = pendentes.get(id);
  if (!a) return { status: 404, ok: false, mensagem: 'Essa ação não está mais pendente (já foi decidida ou expirou).' };
  if (a.estado !== 'pendente') return { status: 409, ok: false, mensagem: 'Essa ação já está sendo executada.' };
  if (Date.now() > a.expiraEm) {
    pendentes.delete(id); clearTimeout(a.timer);
    avisos.push(`A ação "${a.resumo}" expirou sem confirmação do Júlio: nada foi enviado.`);
    return { status: 410, ok: false, mensagem: 'Essa ação expirou (passou de 5 minutos). Nada foi enviado.' };
  }
  if (decisao === 'recusar') {
    pendentes.delete(id); clearTimeout(a.timer);
    avisos.push(`O Júlio cancelou na tela a ação "${a.resumo}" às ${horaSP()}: nada foi enviado.`);
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
  avisos.push(r.ok
    ? `O Júlio confirmou na tela a ação "${a.resumo}" e ela foi concluída às ${horaSP()}: ${r.mensagem}`
    : `O Júlio confirmou na tela a ação "${a.resumo}", mas ela falhou às ${horaSP()}: ${r.mensagem}`);
  return { status: r.ok ? 200 : 502, ok: !!r.ok, mensagem: r.mensagem };
}

/** Os desfechos desde a última fala (e esvazia a lista). */
export function tirarAvisos() {
  const a = avisos; avisos = [];
  return a;
}

export function quantasPendentes() { return pendentes.size; }
