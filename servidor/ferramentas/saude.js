/* saude_sistemas — o saude.painel() do Guardião (DATA WAREHOUSE), resumido; com `item`, o detalhe de um alvo. Só leitura.
   O formato é o do GUARDIAO.md §6, normalizado pelo mesmo normalizar() do painel (web/js/saude.js). */
import { normalizar } from '../../web/js/saude.js';
import { ErroFerramenta, cortar, norm, quandoSP } from '../util.js';

const ROT = { ok: 'em dia', atencao: 'atenção', falha: 'falha', sem_dado: 'sem dado', desligado: 'desligado' };

/* "BI Comercial · Sync rapidas", sem repetir o sistema quando o nome já começa por ele ("BI Comercial - Sync rapidas"),
   como o jarvis-link.js faz no link */
function nomeItem(i) {
  const nome = String(i.nome || ''), sis = String(i.sistema || '');
  if (!nome) return sis || i.id;
  const a = norm(nome), b = norm(sis);
  return b && a !== b && !a.startsWith(`${b} `) ? `${sis} · ${nome}` : nome;
}

export function resumirPainel(d, { soProblemas = false } = {}) {
  const g = d.geral;
  const verificadoMin = d.verificado_em ? Math.round((Date.now() - new Date(d.verificado_em).getTime()) / 60000) : null;
  const inc = i => ({
    nome: i.nome || i.alvo_id, situacao: ROT[i.status] || i.status, resumo: i.resumo || undefined,
    aberto_em: quandoSP(i.aberto_em), fechado_em: quandoSP(i.fechado_em),
    nova_tentativa_em: quandoSP(i.correcao_pedida_em), resultado_da_tentativa: i.correcao_resultado || undefined,
  });
  return {
    verificado_em: quandoSP(d.verificado_em),
    minutos_desde_a_verificacao: verificadoMin,
    verificacao_atrasada: verificadoMin != null && verificadoMin > 20 ? true : undefined,
    geral: { situacao: ROT[g.status] || g.status, em_dia: g.ok, atencao: g.atencao, falha: g.falha, sem_dado: g.sem_dado, total: g.total },
    telegram_configurado: !!(d.telegram && d.telegram.configurado),
    vm_srv_ia: d.vm && d.vm.em ? { ultimo_batimento: quandoSP(d.vm.em) } : 'o vigia da VM ainda não mandou batimento',
    incidentes_abertos: d.incidentes.abertos.map(inc),
    itens: d.itens
      .filter(i => i.status !== 'desligado' && (!soProblemas || i.status === 'falha' || i.status === 'atencao'))
      .slice(0, 50)
      .map(i => ({ id: i.id, nome: nomeItem(i), tipo: i.tipo, situacao: ROT[i.status] || i.status, resumo: i.resumo ? cortar(i.resumo, 220) : undefined, ultima_execucao: quandoSP(i.ultima_execucao), proxima_execucao: quandoSP(i.proxima_execucao) })),
    ultimos_incidentes: d.incidentes.recentes.slice(0, 6).map(inc),
    legenda: 'Em dia = conferido e certo; atenção = rodou com atraso, queda de linhas ou conferência duvidosa; falha = não rodou ou deu erro; sem dado = o Guardião ainda não tem como conferir. Horários já em Brasília.',
  };
}

function detalheItem(d, item) {
  const q = norm(item);
  const achado = d.itens.find(i => norm(i.id) === q)
    || d.itens.find(i => norm(i.nota) === q || norm(i.nome) === q)
    || d.itens.find(i => norm(`${i.sistema} ${i.nome} ${i.nota} ${i.id}`).includes(q));
  if (!achado) throw new ErroFerramenta(`Não achei "${item}" entre os ${d.itens.length} itens vigiados pelo Guardião.`, 'sem-item');
  const det = achado.detalhe || {};
  const consultas = Array.isArray(det.consultas) ? det.consultas.slice(0, 25).map(c => (typeof c === 'object' ? c : { consulta: String(c) })) : undefined;
  return {
    id: achado.id, nome: nomeItem(achado), tipo: achado.tipo, nota: achado.nota || undefined,
    situacao: ROT[achado.status] || achado.status, resumo: achado.resumo || undefined, desde: quandoSP(achado.desde),
    ultima_execucao: quandoSP(achado.ultima_execucao), proxima_execucao: quandoSP(achado.proxima_execucao),
    etapas: det.etapas || undefined, consultas,
    incidente_aberto: d.incidentes.abertos.find(i => i.alvo_id === achado.id) || undefined,
  };
}

export const saudeSistemas = {
  nome: 'saude_sistemas',
  descricao: 'Estado ao vivo do Guardião da Lube: se cada rotina (carga do WinThor para o banco) rodou e subiu certo, se os sites estão no ar, se a VM SRV-IA está viva, e os incidentes abertos. Use para "está tudo rodando?", "a carga das sete e cinquenta rodou?", "algum sistema fora?". Com item (nome, nota ou id), traz o detalhe de um só, com as consultas e as etapas.',
  schema: {
    type: 'object',
    properties: {
      item: { type: 'string', maxLength: 200, description: 'Opcional: o nome da rotina/sistema, a nota dela ou o id (ex.: "rotina:bi-compras-sync-rapidas").' },
      so_problemas: { type: 'boolean', description: 'Opcional: true para listar só o que está com atenção ou falha.' },
    },
    additionalProperties: false,
  },
  rotulo: 'Conferindo a saúde dos sistemas',
  async executar({ item, so_problemas: soProblemas = false } = {}, ctx) {
    if (!ctx.banco.configurado) throw new ErroFerramenta('A saúde vem do banco, e o banco não está configurado no ENV deste computador.', 'sem-banco');
    const bruto = await ctx.banco.painelSaude({ signal: ctx.signal });
    const d = normalizar(bruto);
    if (!d) throw new ErroFerramenta('O Guardião respondeu num formato desconhecido (o saude.painel() mudou?).', 'formato');
    if (item) {
      const det = detalheItem(d, item);
      return { conteudo: det, resumo: `${det.nome}: ${det.situacao}` };
    }
    const r = resumirPainel(d, { soProblemas });
    const g = d.geral;
    return { conteudo: r, resumo: `${g.ok} de ${g.total} em dia${g.falha ? ` · ${g.falha} falha${g.falha > 1 ? 's' : ''}` : ''}${g.atencao ? ` · ${g.atencao} atenção` : ''}` };
  },
};
