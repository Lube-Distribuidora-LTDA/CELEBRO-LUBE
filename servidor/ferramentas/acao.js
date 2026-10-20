/* cancelar_acao — tira da tela a ação que espera aprovação, sem fazer nada (docs/JARVIS-ACOES.md §4).
   A voz já reconhece "não", "cancela", "não precisa"… (web/js/jarvis-acoes.js). Esta ferramenta cobre o resto: o Júlio
   recusou com outras palavras ("deixa quieto, não quero mais aquilo") e a fala foi para o cérebro. Recusar é o lado
   seguro: nada roda, e um texto injetado que pedisse para cancelar só tiraria um cartão. Aprovar continua sendo só a voz
   ou o botão do Júlio, nunca o modelo. */
import { cancelarDaAba } from '../acoes.js';
import { ErroFerramenta, cortar } from '../util.js';

export const cancelarAcao = {
  nome: 'cancelar_acao',
  descricao: 'Tira da tela a ação que espera a aprovação do Júlio (e-mail, mover, renomear, apagar, mudar arquivo, formulário, site, página, construção), sem fazer nada. Use quando o Júlio disser que não quer mais, com qualquer palavra ("deixa quieto", "não quero mais isso", "esquece o e-mail"). Você nunca aprova: aprovar é só a voz ou o botão dele.',
  schema: { type: 'object', properties: {}, additionalProperties: false },
  rotulo: 'Cancelando a ação da tela',
  async executar(_input, ctx) {
    const a = cancelarDaAba(ctx && ctx.aba);
    if (!a) throw new ErroFerramenta('Não tem nenhuma ação esperando aprovação agora.', 'acao-nenhuma');
    return {
      conteudo: { cancelada: cortar(a.resumo, 160), tipo: a.tipo, mensagem: 'A ação saiu da tela e nada foi feito. Diga isso em uma frase curta.' },
      resumo: 'cancelada',
    };
  },
};
