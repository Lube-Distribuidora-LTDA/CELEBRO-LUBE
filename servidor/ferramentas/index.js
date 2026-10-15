/* As ferramentas do Jarvis: definição para a API do Claude, validação do input e execução.
   A ordem e o texto das definições são fixos durante a vida do processo (prompt caching: a lista de tools é o começo do
   prefixo, e qualquer mudança nela invalida o cache). */
import { buscarNotas, lerNota } from './notas.js';
import { saudeSistemas } from './saude.js';
import { consultarDados, descreverDados } from './dados.js';
import { listarEmails, lerEmail, prepararEmail } from './email.js';
import { buscarArquivos, lerArquivo } from './arquivos.js';
import { mostrarNaTela } from './tela.js';
import { validar } from '../validar.js';
import { ErroFerramenta, comPrazo, jsonParaModelo, log } from '../util.js';

export const BASE = [buscarNotas, lerNota, saudeSistemas, consultarDados, descreverDados, listarEmails, lerEmail, prepararEmail, buscarArquivos, lerArquivo, mostrarNaTela];

/** delegar: só o Haiku tem; quem executa é o cerebro.js (sub-turno com o Sonnet 5.5). */
export const DELEGAR = {
  nome: 'delegar',
  descricao: 'Passa uma tarefa pesada para um modelo mais forte (Claude Sonnet 5.5), que trabalha com as mesmas ferramentas e mais a pesquisa na internet, e devolve um relatório curto para você contar em voz. Use para: pesquisa na internet, análise com várias consultas ao banco, comparação, explicação longa, texto de e-mail delicado. Antes de chamar, avise o Júlio numa frase curta que vai levar alguns segundos.',
  schema: {
    type: 'object',
    properties: {
      tarefa: { type: 'string', minLength: 3, maxLength: 4000, description: 'O que precisa ser feito, com todo o contexto necessário (o outro modelo não vê a conversa inteira).' },
      porque: { type: 'string', maxLength: 300, description: 'Em uma frase, por que é pesado (aparece no painel).' },
    },
    required: ['tarefa'],
    additionalProperties: false,
  },
  rotulo: 'Pensando com mais calma',
};

export function definicoesApi(lista) {
  return lista.map(f => ({ name: f.nome, description: f.descricao, input_schema: f.schema, eager_input_streaming: true }));
}

export function acharFerramenta(lista, nome) {
  const n = String(nome || '');
  return lista.find(f => f.nome === n) || lista.find(f => f.nome.toLowerCase() === n.toLowerCase()) || null;
}

/** Lê o input de um bloco tool_use. Com o JSON bruto do stream à mão, faz o parse estrito (o leitor da SDK é tolerante). */
export function inputDoBloco(bloco) {
  const bruto = bloco && bloco.__json_buf;
  if (typeof bruto === 'string') {
    if (!bruto.trim()) return { ok: true, input: {} };
    try { return { ok: true, input: JSON.parse(bruto) }; } catch (_) { return { ok: false, bruto }; }
  }
  return { ok: true, input: bloco?.input ?? {} };
}

/**
 * Valida e roda. Devolve {ok, texto (para o tool_result), resumo, extra}. Nunca lança (menos cancelamento):
 * erro de ferramenta vira tool_result com is_error, que o modelo lê e contorna.
 */
export async function executarFerramenta(f, input, ctx, prazoMs = 45000) {
  const erros = validar(f.schema, input);
  if (erros.length) {
    return { ok: false, texto: JSON.stringify({ INVALID_JSON: JSON.stringify(input), erros }), resumo: 'pedido inválido' };
  }
  const signal = comPrazo(ctx.signal, prazoMs);
  try {
    const r = await f.executar(input, { ...ctx, signal });
    return { ok: true, texto: jsonParaModelo(r.conteudo), resumo: r.resumo, extra: r.extra };
  } catch (e) {
    if (ctx.signal?.aborted) throw ctx.signal.reason ?? e;
    if (e instanceof ErroFerramenta) return { ok: false, texto: e.message, resumo: e.message, codigo: e.codigo };
    if (signal.aborted) return { ok: false, texto: `A ferramenta ${f.nome} passou do tempo (${Math.round(prazoMs / 1000)} s).`, resumo: 'passou do tempo' };
    log(`ferramenta ${f.nome}: erro inesperado`, e?.code || e?.name || '');
    return { ok: false, texto: `A ferramenta ${f.nome} falhou agora. Tente de outro jeito ou diga ao Júlio que não deu.`, resumo: 'falhou' };
  }
}
