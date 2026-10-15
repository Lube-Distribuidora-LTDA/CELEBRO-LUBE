/* mostrar_na_tela — manda um cartão para o HUD do Jarvis. Só exibe.
   Tipos e formato do evento `cartao` (contrato da interface):
     destaque {valor, rotulo, detalhe?} · lista {titulo, itens:[texto]} · tabela {titulo, colunas, linhas} (até 8×6)
     barras {titulo, itens:[{rotulo, valor}]} (até 12) · nota {nome, caminho} · email {de, assunto, quando, resumo}
     rotina {nome, caminho} */
import { ErroFerramenta, cortar, norm } from '../util.js';

const txt = (v, max) => cortar(String(v ?? '').trim(), max);

export const mostrarNaTela = {
  nome: 'mostrar_na_tela',
  descricao: 'Mostra um cartão no painel do Jarvis enquanto você fala: destaque (um número grande com rótulo), lista (até 12 itens), tabela (até 8 linhas e 6 colunas), barras (até 12 barras para comparar), nota (abre uma nota do cérebro no leitor), email (resumo de um e-mail) ou rotina (abre o funil de uma rotina). Use quando houver números, nomes ou comparação: na tela vai o exato, na voz só o essencial. Preencha só os campos do tipo escolhido.',
  schema: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['destaque', 'lista', 'tabela', 'barras', 'nota', 'email', 'rotina'] },
      titulo: { type: 'string', maxLength: 80, description: 'lista, tabela, barras: o título do cartão.' },
      valor: { type: 'string', maxLength: 40, description: 'destaque: o número ou valor, já formatado (ex.: "59.212", "R$ 1,2 mi", "12 de 14").' },
      rotulo: { type: 'string', maxLength: 80, description: 'destaque: o que é o número.' },
      detalhe: { type: 'string', maxLength: 160, description: 'destaque: opcional, uma linha de contexto.' },
      itens: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 160 }, description: 'lista: os itens.' },
      colunas: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 40 }, description: 'tabela: os nomes das colunas.' },
      linhas: { type: 'array', maxItems: 8, items: { type: 'array', maxItems: 6, items: { type: ['string', 'number', 'null'] } }, description: 'tabela: as linhas (cada uma com o mesmo número de colunas).' },
      barras: { type: 'array', maxItems: 12, items: { type: 'object', properties: { rotulo: { type: 'string', maxLength: 60 }, valor: { type: 'number' } }, required: ['rotulo', 'valor'], additionalProperties: false }, description: 'barras: rótulo e valor numérico de cada barra.' },
      nome: { type: 'string', maxLength: 300, description: 'nota ou rotina: o nome dela no cérebro.' },
      de: { type: 'string', maxLength: 160, description: 'email: remetente.' },
      assunto: { type: 'string', maxLength: 200, description: 'email: assunto.' },
      quando: { type: 'string', maxLength: 60, description: 'email: quando chegou.' },
      resumo: { type: 'string', maxLength: 400, description: 'email: resumo em uma ou duas frases.' },
    },
    required: ['tipo'],
    additionalProperties: false,
  },
  rotulo: 'Mostrando na tela',
  async executar(e, ctx) {
    let dados;
    const falta = c => { throw new ErroFerramenta(`Para o cartão ${e.tipo}, falta ${c}.`, 'cartao'); };
    switch (e.tipo) {
      case 'destaque':
        if (!e.valor) falta('valor'); if (!e.rotulo) falta('rotulo');
        dados = { valor: txt(e.valor, 40), rotulo: txt(e.rotulo, 80), detalhe: e.detalhe ? txt(e.detalhe, 160) : undefined };
        break;
      case 'lista':
        if (!e.itens || !e.itens.length) falta('itens');
        dados = { titulo: txt(e.titulo || 'Lista', 80), itens: e.itens.slice(0, 12).map(i => txt(i, 160)) };
        break;
      case 'tabela': {
        if (!e.colunas || !e.colunas.length) falta('colunas'); if (!e.linhas || !e.linhas.length) falta('linhas');
        const nc = Math.min(6, e.colunas.length);
        dados = {
          titulo: txt(e.titulo || 'Tabela', 80),
          colunas: e.colunas.slice(0, nc).map(c => txt(c, 40)),
          linhas: e.linhas.slice(0, 8).map(l => Array.from({ length: nc }, (_, i) => (l[i] == null ? '' : typeof l[i] === 'number' ? l[i] : txt(l[i], 60)))),
        };
        break;
      }
      case 'barras':
        if (!e.barras || !e.barras.length) falta('barras');
        dados = { titulo: txt(e.titulo || 'Comparação', 80), itens: e.barras.slice(0, 12).map(b => ({ rotulo: txt(b.rotulo, 60), valor: Number(b.valor) })) };
        break;
      case 'nota': case 'rotina': {
        if (!e.nome) falta('nome');
        const G = await ctx.vault.grafo();
        const D = ctx.vault.D;
        let n = D.seguirLink(G, e.nome);
        if (e.tipo === 'rotina' && (!n || n.kind !== 'routine')) {
          const q = norm(e.nome);
          n = G.nodes.find(x => x.kind === 'routine' && norm(x.name) === q) || G.nodes.find(x => x.kind === 'routine' && norm(x.name).includes(q)) || null;
        }
        if (!n) throw new ErroFerramenta(`Não achei ${e.tipo === 'rotina' ? 'a rotina' : 'a nota'} "${e.nome}" no cérebro.`, 'cartao');
        dados = { nome: n.name, caminho: n.path };
        break;
      }
      case 'email':
        if (!e.assunto) falta('assunto');
        dados = { de: txt(e.de, 160), assunto: txt(e.assunto, 200), quando: txt(e.quando, 60), resumo: txt(e.resumo, 400) };
        break;
      default:
        throw new ErroFerramenta('Tipo de cartão desconhecido.', 'cartao');
    }
    ctx.emitir('cartao', { tipo: e.tipo, dados });
    return { conteudo: 'Mostrado na tela.', resumo: e.tipo };
  },
};
