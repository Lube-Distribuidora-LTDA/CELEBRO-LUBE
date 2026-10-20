/* construir / ver_construcao / parar_construcao / listar_projetos — o construtor do Jarvis (servidor/construtor.js;
   docs/JARVIS-ACOES.md §7.8).
   construir NÃO começa na hora: confere o pedido, calcula o custo estimado e o teto, e cria uma AÇÃO PENDENTE do tipo
   "construir" (servidor/acoes.js) com o cartão na tela. Só o "aprovado" do Júlio (por voz ou no botão, pela rota
   POST /api/jarvis/acao/:id) chama o executar(), que liga a construção. O modelo nunca aprova.
   Parar é livre (é o lado seguro). O construtor chega pelo ctx (ctx.construtor), montado pelo servidor. */
import { criarAcao } from '../acoes.js';
import { NOME_MODELO, NOME_TIPO, TIPOS, dinheiro } from '../construtor.js';
import { ErroFerramenta, cortar } from '../util.js';

function construtorDe(ctx) {
  const k = ctx?.construtor;
  if (!k || typeof k.preparar !== 'function') throw new ErroFerramenta('O construtor não está ligado neste computador.', 'construtor-desligado');
  return k;
}

/* o que o modelo precisa saber de uma construção (sem a miniatura do print) */
function paraModelo(e) {
  if (!e) return null;
  return {
    projeto: e.projeto, tipo: e.tipo, estado: e.estado, etapa: e.etapa, pasta: e.pasta_rel,
    custo_usd: e.custo_usd, teto_usd: e.teto_usd, segundos: e.segundos,
    arquivos: (e.arquivos || []).map(a => a.nome), mensagem: e.mensagem, avisos: e.avisos,
  };
}

export const construir = {
  nome: 'construir',
  descricao: 'Constrói um site, um BI ou um pequeno programa (HTML e JavaScript, abertos direto do arquivo) numa pasta do projeto em JARVIS\\Projetos, com um modelo mais forte (Claude Sonnet 5.5). Escreva no pedido tudo o que o Júlio quer: telas, números, filtros, de onde vêm os dados (o construtor consulta o DATA WAREHOUSE só para ler). NÃO começa na hora: mostra o custo estimado e o teto num cartão e espera a aprovação do Júlio por voz. Depois de chamar, diga o custo do jeito que se fala ("uns trinta centavos de dólar") e o teto, e que espera a aprovação; não diga as palavras de aprovar. Uma construção por vez. Para mudar um projeto que já existe, use alterar: true com o mesmo nome.',
  schema: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: [...TIPOS], description: 'site, bi ou programa.' },
      nome: { type: 'string', minLength: 2, maxLength: 40, description: 'Nome curto do projeto; vira a pasta (ex.: "vendas por filial" vira vendas-por-filial).' },
      pedido: { type: 'string', minLength: 20, maxLength: 8000, description: 'Tudo o que o Júlio pediu, com detalhes: telas, números, filtros, cores, de onde vêm os dados.' },
      tamanho: { type: 'string', enum: ['pequeno', 'medio', 'grande'], description: 'pequeno: uma página, uma tabela, um gráfico. medio: BI de 3 a 5 telas com dados. grande: site de várias páginas ou programa com várias telas.' },
      alterar: { type: 'boolean', description: 'true para mudar um projeto que já existe (a pasta tem que existir); false (padrão) para um novo.' },
    },
    required: ['tipo', 'nome', 'pedido', 'tamanho'],
    additionalProperties: false,
  },
  rotulo: 'Preparando a construção',
  async executar({ tipo, nome, pedido, tamanho, alterar = false }, ctx) {
    const k = construtorDe(ctx);
    const p = await k.preparar({ tipo, nome, pedido, tamanho, alterar });
    const tipoNome = NOME_TIPO[p.tipo];
    const detalhe = {
      projeto: p.projeto, tipo: tipoNome, pasta: p.pasta_rel, pedido: p.pedido, tamanho: p.tamanho,
      estimativa_usd: p.estimativa_usd, teto_usd: p.teto_usd, resta_hoje_usd: p.resta_hoje_usd,
      modelo: NOME_MODELO, novo: p.novo,
    };
    const resumo = `${p.novo ? 'Construir' : 'Alterar'} o ${tipoNome} ${p.projeto} (cerca de ${dinheiro(p.estimativa_usd)}, teto ${dinheiro(p.teto_usd)})`;
    const aba = ctx.aba || null;
    const acao = criarAcao({
      tipo: 'construir', resumo, detalhe, aba,
      executar: async () => {
        try {
          const r = await k.iniciar({ projeto: p.projeto, tipo: p.tipo, pedido: p.pedido, teto_usd: p.teto_usd, aba, tamanho: p.tamanho, novo: p.novo });
          return {
            ok: true,
            mensagem: `Comecei a construção de ${p.projeto} (teto ${dinheiro(r.teto_usd)}). O andamento aparece na tela; aviso quando terminar.`,
            cartao: { tipo: 'construcao', dados: k.estado().ativa },
          };
        } catch (e) {
          if (e instanceof ErroFerramenta) return { ok: false, mensagem: `${e.message} A construção não começou.` };
          throw e;
        }
      },
    });
    ctx.emitir('acao', {
      id: acao.id, tipo: acao.tipo, rotulo: 'começar a construção', resumo: acao.resumo, detalhe: acao.detalhe,
      expira_em: acao.expira_em, substituiu: acao.substituiu || undefined,
    });
    return {
      conteudo: {
        situacao: 'aguardando_aprovacao', acao_id: acao.id,
        projeto: p.projeto, pasta: p.pasta_rel, novo: p.novo,
        estimativa_usd: p.estimativa_usd, teto_usd: p.teto_usd, resta_hoje_usd: p.resta_hoje_usd, tempo_maximo_min: p.minutos,
        mensagem: 'O cartão com o custo está na tela. AINDA NÃO COMEÇOU: só começa quando o Júlio aprovar (vence em 5 minutos). Diga o custo estimado do jeito que se fala e o teto, e que espera a aprovação dele. Não diga as palavras de aprovar e não pergunte "posso?". Só diga que começou depois que a mensagem do sistema confirmar.',
        substituiu: acao.substituiu ? `A ação que esperava aprovação ("${cortar(acao.substituiu, 120)}") saiu da tela: só esta vale agora. Avise o Júlio.` : undefined,
      },
      resumo: `${p.projeto}: ~${dinheiro(p.estimativa_usd)}`,
    };
  },
};

export const verConstrucao = {
  nome: 'ver_construcao',
  descricao: 'Diz como está a construção que está rodando (etapa, arquivos, custo até agora, tempo) e as últimas que terminaram. Use quando o Júlio perguntar "como está a construção?".',
  schema: { type: 'object', properties: {}, additionalProperties: false },
  rotulo: 'Vendo a construção',
  async executar(_input, ctx) {
    const k = construtorDe(ctx);
    const e = k.estado();
    if (e.ativa) ctx.emitir('cartao', { tipo: 'construcao', dados: e.ativa });
    return {
      conteudo: {
        rodando: paraModelo(e.ativa),
        ultimas: e.ultimas.slice(0, 3).map(paraModelo),
        aviso: e.ativa ? undefined : 'Nenhuma construção está rodando agora.',
      },
      resumo: e.ativa ? `${e.ativa.projeto}: ${e.ativa.estado}` : 'nenhuma rodando',
    };
  },
};

export const pararConstrucao = {
  nome: 'parar_construcao',
  descricao: 'Para a construção que está rodando, na hora (não precisa de aprovação: parar é o lado seguro). O que já foi escrito fica na pasta do projeto.',
  schema: { type: 'object', properties: {}, additionalProperties: false },
  rotulo: 'Parando a construção',
  prazoMs: 20000,
  async executar(_input, ctx) {
    const k = construtorDe(ctx);
    const r = await k.parar('pedido');
    if (!r.ok) throw new ErroFerramenta(r.mensagem, 'construtor-parado');
    return { conteudo: { parou: true, mensagem: r.mensagem }, resumo: 'parada' };
  },
};

export const listarProjetos = {
  nome: 'listar_projetos',
  descricao: 'Lista os projetos do construtor (sites, BIs e programas em JARVIS\\Projetos), do mais recente para o mais velho, e mostra a lista na tela.',
  schema: { type: 'object', properties: {}, additionalProperties: false },
  rotulo: 'Listando os projetos',
  async executar(_input, ctx) {
    const k = construtorDe(ctx);
    const l = await k.listar();
    // o id da pasta Projetos (o botão "Abrir a pasta"); cada linha leva o da prévia (index_id) e o da pasta do projeto (id)
    let pastaId;
    try { if (ctx.jarvis && typeof ctx.jarvis.garantir === 'function') pastaId = ctx.jarvis.registrar(await ctx.jarvis.garantir('Projetos')); } catch (_) { pastaId = undefined; }
    ctx.emitir('cartao', {
      tipo: 'pasta',
      dados: {
        titulo: 'Projetos do Jarvis', pasta: 'Projetos', pasta_id: pastaId, total: l.length,
        itens: l.slice(0, 12).map(p => ({ nome: p.projeto, tipo: 'pasta', kb: p.kb, modificado: p.modificado, arquivos: p.arquivos, id: p.pasta_id, index_id: p.index_id })),
      },
    });
    return {
      conteudo: {
        projetos: l.map(p => ({ projeto: p.projeto, arquivos: p.arquivos, kb: p.kb, modificado: p.modificado, tem_index: !!p.index_id })),
        total: l.length,
        aviso: l.length ? undefined : 'Ainda não há projetos em JARVIS\\Projetos.',
      },
      resumo: l.length === 1 ? '1 projeto' : `${l.length} projetos`,
    };
  },
};

export const FERRAMENTAS_CONSTRUIR = [construir, verConstrucao, pararConstrucao, listarProjetos];
