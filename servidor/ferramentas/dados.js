/* consultar_dados / descrever_dados — o DATA WAREHOUSE, só leitura (as travas estão em servidor/banco.js). */
import { SCHEMAS_LIBERADOS } from '../banco.js';
import { ErroFerramenta } from '../util.js';

export const consultarDados = {
  nome: 'consultar_dados',
  descricao: `Roda UM SELECT de leitura no DATA WAREHOUSE da Lube (Postgres/Supabase), com o dado que as ETLs trazem do WinThor. Schemas liberados: ${SCHEMAS_LIBERADOS.join(', ')} — sempre escreva schema.tabela (ex.: compras.controle_carga). O schema financeiro (folha) e os de sistema ficam fora; nada de INSERT/UPDATE/DELETE, nada de dois comandos. Limite de 15 segundos e 200 linhas: agregue no SQL (sum, count, group by) em vez de trazer linha a linha. Se não souber as tabelas, use descrever_dados antes.`,
  schema: {
    type: 'object',
    properties: {
      sql: { type: 'string', minLength: 1, maxLength: 20000, description: 'Um SELECT (ou WITH ... SELECT) com schema.tabela.' },
      objetivo: { type: 'string', maxLength: 200, description: 'Em poucas palavras, o que a consulta responde (aparece no painel).' },
    },
    required: ['sql'],
    additionalProperties: false,
  },
  rotulo: 'Consultando o banco',
  async executar({ sql }, ctx) {
    if (!ctx.banco.configurado) throw new ErroFerramenta('O banco não está configurado no ENV deste computador (faltam as SUPABASE_DB_).', 'sem-banco');
    const r = await ctx.banco.consultar(sql, { signal: ctx.signal });
    return {
      conteudo: { ...r, aviso: r.mais_linhas ? 'Vieram só as primeiras 200 linhas: agregue no SQL para ver o total.' : undefined },
      resumo: `${r.linhas_devolvidas}${r.mais_linhas ? '+' : ''} linha${r.linhas_devolvidas === 1 ? '' : 's'}`,
    };
  },
};

export const descreverDados = {
  nome: 'descrever_dados',
  descricao: `Lista as tabelas e visões dos schemas liberados do DATA WAREHOUSE (${SCHEMAS_LIBERADOS.join(', ')}) ou, com tabela, as colunas e tipos dela. Use antes de consultar_dados quando não souber o nome exato.`,
  schema: {
    type: 'object',
    properties: {
      schema: { type: 'string', enum: SCHEMAS_LIBERADOS, description: 'Opcional: um schema só.' },
      tabela: { type: 'string', maxLength: 120, description: 'Opcional: nome da tabela (ou schema.tabela) para ver as colunas.' },
    },
    additionalProperties: false,
  },
  rotulo: 'Olhando as tabelas do banco',
  async executar(input, ctx) {
    if (!ctx.banco.configurado) throw new ErroFerramenta('O banco não está configurado no ENV deste computador (faltam as SUPABASE_DB_).', 'sem-banco');
    const r = await ctx.banco.descrever(input || {}, { signal: ctx.signal });
    const n = r.schemas ? Object.values(r.schemas).reduce((a, l) => a + l.length, 0) : Object.values(r.colunas_por_schema).reduce((a, l) => a + l.length, 0);
    return { conteudo: r, resumo: r.schemas ? `${n} tabelas` : `${n} colunas` };
  },
};
