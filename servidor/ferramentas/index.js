/* As ferramentas do Jarvis: definição para a API do Claude, validação do input e execução.
   A ordem e o texto das definições são fixos durante a vida do processo (prompt caching: a lista de tools é o começo do
   prefixo, e qualquer mudança nela invalida o cache). */
import { buscarNotas, lerNota } from './notas.js';
import { saudeSistemas } from './saude.js';
import { consultarDados, descreverDados } from './dados.js';
import { listarEmails, lerEmail, prepararEmail } from './email.js';
import { buscarArquivos, lerArquivo } from './arquivos.js';
import { mostrarNaTela } from './tela.js';
import { FERRAMENTAS_PASTA } from './pasta.js';
import { criarPlanilha } from './planilha.js';
import { FERRAMENTAS_WEB } from './web.js';
import { FERRAMENTAS_CONSTRUIR } from './construir.js';
import { camera, olharCamera } from './camera.js';
import { cancelarAcao } from './acao.js';
import { validar } from '../validar.js';
import { ErroFerramenta, comPrazo, jsonParaModelo, log } from '../util.js';

/* As de leitura (até 2026-10-19) e, depois, as que FAZEM (docs/JARVIS-ACOES.md): a pasta do Jarvis e a planilha (A), o
   navegador (B), o construtor (C) e a câmera (D). Ordem fixa: a lista de tools é o começo do prefixo do cache. */
export const BASE = [
  buscarNotas, lerNota, saudeSistemas, consultarDados, descreverDados, listarEmails, lerEmail, prepararEmail, buscarArquivos, lerArquivo, mostrarNaTela,
  ...FERRAMENTAS_PASTA, criarPlanilha,
  ...FERRAMENTAS_WEB,
  ...FERRAMENTAS_CONSTRUIR,
  camera, olharCamera,
  cancelarAcao,
];
{
  const vistos = new Set();
  for (const f of BASE) { if (vistos.has(f.nome)) throw new Error(`ferramenta repetida: ${f.nome}`); vistos.add(f.nome); }
}

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

/* Os blocos extras do tool_result (a imagem do olhar_camera, o print com olhar: true): só texto e imagem JPEG/PNG em
   base64, no máximo 4 (e 4 MB de base64 somados). O resto é descartado. */
const MIDIA = new Set(['image/jpeg', 'image/png']);
function blocosSeguros(blocos) {
  if (!Array.isArray(blocos)) return undefined;
  const out = [];
  let total = 0;
  for (const b of blocos.slice(0, 4)) {
    if (b && b.type === 'text' && typeof b.text === 'string' && b.text) out.push({ type: 'text', text: b.text.slice(0, 4000) });
    else if (b && b.type === 'image' && b.source && b.source.type === 'base64' && MIDIA.has(b.source.media_type)
      && typeof b.source.data === 'string' && /^[A-Za-z0-9+/]+=*$/.test(b.source.data) && (total += b.source.data.length) <= 4_000_000) {
      out.push({ type: 'image', source: { type: 'base64', media_type: b.source.media_type, data: b.source.data } });
    }
  }
  return out.some(b => b.type === 'image') ? out : undefined;
}

/**
 * Valida e roda. Devolve {ok, texto (para o tool_result), resumo, extra, blocos?}. Nunca lança (menos cancelamento):
 * erro de ferramenta vira tool_result com is_error, que o modelo lê e contorna. O prazo é o da ferramenta (f.prazoMs:
 * a planilha e a cópia têm 2 min, o site 1 min) ou 45 s.
 */
export async function executarFerramenta(f, input, ctx, prazoMs = f.prazoMs || 45000) {
  const erros = validar(f.schema, input);
  if (erros.length) {
    return { ok: false, texto: JSON.stringify({ INVALID_JSON: JSON.stringify(input), erros }), resumo: 'pedido inválido' };
  }
  const signal = comPrazo(ctx.signal, prazoMs);
  try {
    const r = await f.executar(input, { ...ctx, signal });
    return { ok: true, texto: jsonParaModelo(r.conteudo), resumo: r.resumo, extra: r.extra, blocos: blocosSeguros(r.blocos) };
  } catch (e) {
    if (ctx.signal?.aborted) throw ctx.signal.reason ?? e;
    if (e instanceof ErroFerramenta) return { ok: false, texto: e.message, resumo: e.message, codigo: e.codigo };
    if (signal.aborted) return { ok: false, texto: `A ferramenta ${f.nome} passou do tempo (${Math.round(prazoMs / 1000)} s).`, resumo: 'passou do tempo' };
    log(`ferramenta ${f.nome}: erro inesperado`, e?.code || e?.name || '');
    return { ok: false, texto: `A ferramenta ${f.nome} falhou agora. Tente de outro jeito ou diga ao Júlio que não deu.`, resumo: 'falhou' };
  }
}
