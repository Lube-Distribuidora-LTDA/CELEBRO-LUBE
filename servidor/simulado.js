/* Cérebro da Lube — servidor/simulado.js: o cérebro DE MENTIRA do Jarvis, para testar a interface sem a chave da API.
   Liga com --simulado, JARVIS_SIMULADO=1, ou sozinho quando o ENV não tem ANTHROPIC_API_KEY.
   Responde com frases prontas, em pedacinhos (como o streaming de verdade), chama DE VERDADE saude_sistemas e
   buscar_notas, mostra cartões e prepara uma ação de e-mail que, confirmada, NÃO envia nada.
   Emite exatamente os mesmos eventos do cérebro real (cerebro.js). */
import crypto from 'node:crypto';
import { buscarNotas } from './ferramentas/notas.js';
import { saudeSistemas } from './ferramentas/saude.js';
import { mostrarNaTela } from './ferramentas/tela.js';
import { executarFerramenta } from './ferramentas/index.js';
import { criarAcao, tirarAvisos, devolverAvisos } from './acoes.js';
import { limparConversa } from './conversa.js';
import { esperar, norm, cortar } from './util.js';

const id = () => 'sim_' + crypto.randomBytes(6).toString('hex');
const PARAR = /^(para|pare|espera|chega|jarvis|silencio)[.!]?$/;

export function criarCerebroSimulado({ cfg, vault, banco }) {
  async function turno({ conversa, contexto }, emitir, signal) {
    const ent = limparConversa(conversa);
    const fala = ent[ent.length - 1].texto;
    const q = norm(fala);
    const anterior = ent[ent.length - 2];
    const aba = contexto && typeof contexto.aba === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(contexto.aba) ? contexto.aba : null;
    const avisos = tirarAvisos(aba);
    const t0 = Date.now();
    let primeira = null, nFerr = 0;
    const ctx = { cfg, vault, banco, emitir, signal, conversa: ent, aba };

    // como o Claude: cada frase sai SEM espaço no fim (o bloco de texto antes de uma ferramenta termina no ponto), e o
    // espaço entre um trecho e o seguinte só vem quando o próximo começa (cerebro.js faz o mesmo entre rodadas)
    let falou = false;
    const dizer = async bruto => {
      const texto = (falou ? ' ' : '') + String(bruto).trim();
      falou = true;
      const pedacos = texto.match(/\s*\S+/g) || [];
      for (let i = 0; i < pedacos.length; i += 2) {
        if (signal.aborted) throw signal.reason ?? new Error('cancelado');
        emitir('texto', { delta: pedacos.slice(i, i + 2).join('') });
        if (primeira === null) primeira = Date.now() - t0;
        await esperar(45, signal);
      }
    };
    const ferramenta = async (f, input) => {
      const fid = id();
      emitir('ferramenta', { id: fid, nome: f.nome, rotulo: f.rotulo, estado: 'inicio' });
      await esperar(350, signal);
      const r = await executarFerramenta(f, input, ctx);
      nFerr++;
      emitir('ferramenta', { id: fid, nome: f.nome, rotulo: f.rotulo, estado: r.ok ? 'fim' : 'erro', resumo: r.resumo, ...(r.extra || {}) });
      return r;
    };
    const cartao = async input => { await executarFerramenta(mostrarNaTela, input, ctx); };

    try {
      emitir('modelo', { nome: 'haiku' });
      await esperar(350, signal);   // "pensando"
      if (anterior && anterior.papel === 'jarvis' && anterior.interrompido) await dizer('Certo, parei. ');
      if (avisos.length) await dizer(avisos.some(a => /concluída/.test(a)) ? 'Pronto, a ação que você confirmou foi registrada, e como sou o cérebro de teste, nada saiu de verdade. ' : 'Entendido, a ação ficou cancelada. ');

      if (PARAR.test(q)) {
        await dizer('Pois não. Fico aqui quietinho.');
      } else if (/(funil|fluxo|abre a rotina|mostra a rotina)/.test(q)) {
        // cartão "rotina": a rotina aberta no funil, a que a fala cita, ou a primeira do cérebro
        await dizer('Vou pôr o fluxo na tela. ');
        const G = await vault.grafo();
        const rotinas = G.nodes.filter(n => n.kind === 'routine');
        const termos = q.replace(/[^\p{L}\p{N}\s-]+/gu, ' ').replace(/\b(jarvis|me|mostra|abre|o|a|do|da|de|rotina|funil|fluxo|por favor)\b/g, ' ').replace(/\s+/g, ' ').trim();
        const aberta = contexto && typeof contexto.rotina_aberta === 'string' ? rotinas.find(n => n.name === contexto.rotina_aberta) : null;
        const alvo = aberta || (termos ? vault.D.buscar(G, termos, 8).find(n => n.kind === 'routine') : null) || rotinas[0];
        if (alvo) {
          await cartao({ tipo: 'rotina', nome: alvo.name });
          await dizer(`Coloquei o fluxo da rotina ${alvo.name} na tela. Quando você sair daqui, o funil abre com ela.`);
        } else await dizer('Não achei nenhuma rotina no cérebro.');
      } else if (/(saude|rodou|rodaram|rodando|rodar|funcionando|rotina|sistema|tudo (bem|certo|ok|em dia|rodando)|no ar|carga|guardiao|incidente)/.test(q)) {
        await dizer('Um instante, vou conferir a saúde dos sistemas. ');
        const r = await ferramenta(saudeSistemas, {});
        if (r.ok) {
          const d = JSON.parse(r.texto);
          const g = d.geral;
          await cartao({ tipo: 'destaque', valor: `${g.em_dia} de ${g.total}`, rotulo: 'em dia no Guardião', detalhe: d.verificado_em ? `verificado ${d.verificado_em}` : undefined });
          const problemas = (d.itens || []).filter(i => i.situacao === 'falha' || i.situacao === 'atenção');
          if (problemas.length) await cartao({ tipo: 'lista', titulo: 'Pedem atenção', itens: problemas.slice(0, 8).map(i => `${i.nome}: ${i.situacao}`) });
          await dizer(g.falha || g.atencao
            ? `Das ${g.total} coisas que o Guardião vigia, ${g.em_dia} estão em dia. ${g.falha ? `${g.falha} com falha` : ''}${g.falha && g.atencao ? ' e ' : ''}${g.atencao ? `${g.atencao} pedindo atenção` : ''}. Deixei a lista na tela.`
            : `Tudo em dia: ${g.em_dia} de ${g.total} itens conferidos pelo Guardião. Nada para se preocupar agora.`);
        } else {
          await dizer(`Tentei, mas não consegui ler a saúde agora. ${r.texto}`);
        }
      } else if (/(e-?mail|caixa|cpd)/.test(q) && /(mand|envi|escrev|prepar|respond)/.test(q)) {
        await dizer('Vou preparar o rascunho. ');
        const acao = criarAcao({
          tipo: 'enviar_email',
          resumo: 'E-mail para teste@exemplo.com.br: Teste do Jarvis (simulação)',
          detalhe: { de: 'TI - Lube Distribuidora <cpd@lube.com.br>', para: ['teste@exemplo.com.br'], assunto: 'Teste do Jarvis (simulação)', corpo: 'Olá,\n\nEste é um e-mail de teste do cérebro simulado. Ele nunca é enviado.\n\nTI - Lube Distribuidora', observacao: 'Cérebro de teste: mesmo confirmando, nada é enviado.' },
          executar: async () => ({ ok: true, mensagem: 'Simulação: nenhum e-mail foi enviado de verdade.' }),
          aba,
        });
        const fid = id();
        emitir('ferramenta', { id: fid, nome: 'preparar_email', rotulo: 'Preparando o e-mail', estado: 'inicio' });
        await esperar(300, signal);
        emitir('acao', { id: acao.id, tipo: acao.tipo, resumo: acao.resumo, detalhe: acao.detalhe, expira_em: acao.expira_em });
        emitir('ferramenta', { id: fid, nome: 'preparar_email', rotulo: 'Preparando o e-mail', estado: 'fim', resumo: 'para teste@exemplo.com.br' });
        nFerr++;
        await dizer('Pronto. É um e-mail de teste para teste arroba exemplo ponto com ponto br. Está na tela, esperando a sua confirmação. Como sou o cérebro simulado, mesmo confirmando nada sai de verdade.');
      } else if (/(e-?mail|caixa|cpd)/.test(q)) {
        await dizer('Deixa eu olhar a caixa. ');
        const fid = id();
        emitir('ferramenta', { id: fid, nome: 'listar_emails', rotulo: 'Lendo a caixa cpd@', estado: 'inicio' });
        await esperar(600, signal);
        emitir('ferramenta', { id: fid, nome: 'listar_emails', rotulo: 'Lendo a caixa cpd@', estado: 'fim', resumo: '2 novos (exemplo)' });
        nFerr++;
        await cartao({ tipo: 'email', de: 'Fornecedor de exemplo', assunto: 'Nota fiscal de outubro (exemplo)', quando: 'hoje às 09:12', resumo: 'E-mail inventado pelo cérebro simulado, só para testar o cartão.' });
        await dizer('No cérebro de teste eu não abro a caixa de verdade. Para mostrar como fica, deixei um e-mail de exemplo na tela. Quando a chave da API estiver no ENV, eu leio a cpd@ de verdade, sem marcar nada como lido.');
      } else if (/(tabela|venda|numero|compar|grafico|barra)/.test(q)) {
        await dizer('Vou montar um exemplo na tela. ');
        await cartao({ tipo: 'tabela', titulo: 'Exemplo · venda por filial', colunas: ['Filial', 'Venda', 'Variação'], linhas: [['1', 'R$ 1,20 mi', '+4%'], ['7', 'R$ 640 mil', '-2%'], ['10', 'R$ 410 mil', '+9%'], ['11', 'R$ 380 mil', '+1%']] });
        await cartao({ tipo: 'barras', titulo: 'Exemplo · venda por filial (mil R$)', barras: [{ rotulo: '1', valor: 1200 }, { rotulo: '7', valor: 640 }, { rotulo: '10', valor: 410 }, { rotulo: '11', valor: 380 }] });
        nFerr += 2;
        await dizer('Os números são de mentira, só para testar a tabela e as barras. A filial um lidera com folga, perto de um milhão e duzentos mil.');
      } else if (/(pesquis|internet|procura na web|google|notici|analis)/.test(q)) {
        await dizer('Deixa eu pensar nisso com calma, leva uns segundos. ');
        const did = id(), wid = id();
        emitir('ferramenta', { id: did, nome: 'delegar', rotulo: 'Pensando com mais calma', estado: 'inicio' });
        emitir('modelo', { nome: 'sonnet' });
        await esperar(500, signal);
        emitir('ferramenta', { id: wid, nome: 'web_search', rotulo: 'Pesquisando na internet', estado: 'inicio' });
        await esperar(1200, signal);
        emitir('ferramenta', { id: wid, nome: 'web_search', rotulo: 'Pesquisando na internet', estado: 'fim', resumo: '5 resultados (exemplo)' });
        await cartao({ tipo: 'lista', titulo: 'Fontes (exemplo)', itens: ['Site de exemplo — exemplo.com.br', 'Outro site de exemplo — exemplo.org'] });
        await esperar(600, signal);
        emitir('modelo', { nome: 'haiku' });
        emitir('ferramenta', { id: did, nome: 'delegar', rotulo: 'Pensando com mais calma', estado: 'fim', resumo: 'pronto' });
        nFerr += 2;
        await dizer('Isto é uma simulação da pesquisa: no cérebro de verdade, o modelo mais forte pesquisa e eu conto o resultado. Por enquanto, só deu para testar a troca de ritmo no painel.');
      } else if (/(nota|sobre|o que (a gente )?sabe|procur|busca|onde fica|como funciona)/.test(q) || q.split(' ').length >= 2) {
        const termos = q.replace(/[^\p{L}\p{N}\s-]+/gu, ' ').replace(/\b(jarvis|me|fala|sobre|o que|a gente|sabe|sabemos|da|do|de|a|o|nota|notas|procura|procure|busca|busque|onde|fica|como|funciona|por favor|pra|para|mim|le|ler|leia)\b/g, ' ').replace(/\s+/g, ' ').trim() || q;
        await dizer('Vou procurar nas notas. ');
        const r = await ferramenta(buscarNotas, { consulta: cortar(termos, 200), limite: 5 });
        const d = r.ok ? JSON.parse(r.texto) : { notas: [] };
        if (d.notas && d.notas.length) {
          await cartao({ tipo: 'lista', titulo: `Notas sobre "${cortar(termos, 40)}"`, itens: d.notas.map(n => `${n.nome}${n.departamento ? ` · ${n.departamento}` : ''}`) });
          await cartao({ tipo: 'nota', nome: d.notas[0].nome });
          await dizer(`Achei ${d.notas.length === 1 ? 'uma nota' : `${d.notas.length} notas`}. A mais certeira é ${d.notas[0].nome}, que deixei aberta para você. Sou o cérebro de teste, então não resumo o conteúdo, mas a busca foi de verdade.`);
        } else {
          await dizer(`Procurei por "${cortar(termos, 60)}" e não achei nada nas notas. Tente com outras palavras.`);
        }
      } else {
        await dizer('Estou aqui, Júlio. Este é o cérebro de teste: ainda sem a chave da API do Claude, então respondo com frases prontas. ');
        await dizer('Dá para testar quase tudo: peça a saúde dos sistemas, procure uma nota, peça uma tabela de exemplo, ou para preparar um e-mail de teste. ');
        await dizer('E pode me interromper a qualquer momento, que eu paro na hora e respondo ao que você disser. Quando a chave entrar no ENV, quem fala é o Claude de verdade.');
      }
    } catch (e) {
      if (primeira === null) devolverAvisos(avisos, aba);   // cancelado antes de dizer qualquer coisa: o aviso fica para a próxima fala
      throw e;
    }
    emitir('fim', { motivo: 'fim', latencia_ms: primeira, ferramentas: nFerr, simulado: true });
  }

  return {
    tipo: 'simulado',
    turno,
    estado: () => ({ modo: 'simulado', modelo_conversa: 'simulado', modelo_pesado: 'simulado', busca_na_conversa: false }),
  };
}
