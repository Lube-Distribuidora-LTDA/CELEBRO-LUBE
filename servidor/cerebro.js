/* Cérebro da Lube — servidor/cerebro.js: o Jarvis falando com o Claude (SDK oficial @anthropic-ai/sdk).
   - Conversa: claude-haiku-5-5, effort 'low' (voz pede resposta rápida), thinking adaptativo (o padrão; em 'low' ele
     pula o raciocínio nas perguntas simples), streaming, max_tokens 4000 (o raciocínio conta no teto). Sem fallbacks
     (o Haiku 5.5 não tem fallback no servidor). Sem temperature/top_p/top_k (400 nos modelos 5.5).
   - Pesado: a ferramenta `delegar` roda um sub-turno com claude-sonnet-5-5, effort 'medium', as mesmas ferramentas menos
     `delegar`, mais a pesquisa na internet; fallbacks: 'default' com o beta server-side-fallback-2026-07-01.
   - Pesquisa no Haiku: só se a API confirmar suporte na partida (models.retrieve; senão, count_tokens com a ferramenta);
     se não, ele delega. A decisão vale para o processo inteiro (tools e system iguais em todo turno).
   - Prompt caching: system com cache_control (ttl 1h, cobre tools + system); a fala atual do Júlio e o último bloco de
     resultado de ferramenta levam o breakpoint de mensagens. Uso do cache vai para o log, só números.
   - Ferramentas: eager_input_streaming em todas as nossas; o input é validado contra o schema antes de rodar; erro de
     ferramenta volta como tool_result com is_error; stop_reason 'refusal' e 'max_tokens' são conferidos antes.
   - Interrupção: fechar a conexão do SSE aborta o turno (AbortController até a chamada do Claude e das ferramentas).
   Eventos para a interface (SSE): texto {delta} · ferramenta {id, nome, rotulo, estado, resumo} · cartao {tipo, dados}
   · acao {id, tipo, resumo, detalhe} · modelo {nome:'haiku'|'sonnet'} · fim {motivo, …} · erro {mensagem}. */
import Anthropic from '@anthropic-ai/sdk';
import { BASE, DELEGAR, definicoesApi, acharFerramenta, inputDoBloco, executarFerramenta } from './ferramentas/index.js';
import { promptHaiku, promptSonnet, contextoDaLube } from './prompts.js';
import { tirarAvisos } from './acoes.js';
import {
  limparConversa, linhaContexto, montarMensagens, novoRegistro, fecharRegistro, blocosParaRegistro, resultadosParaRegistro,
} from './conversa.js';
import { validar } from './validar.js';
import { agoraPorExtenso, comPrazo, cortar, esperar, log } from './util.js';

export const HAIKU = 'claude-haiku-5-5';
export const SONNET = 'claude-sonnet-5-5';
const LOCAL = { type: 'approximate', city: 'Cariacica', region: 'Espírito Santo', country: 'BR', timezone: 'America/Sao_Paulo' };
const BUSCA_HAIKU = { type: 'web_search_20250305', name: 'web_search', max_uses: 2, user_location: LOCAL };
const BUSCA_SONNET = { type: 'web_search_20260209', name: 'web_search', max_uses: 5, user_location: LOCAL };
const FRASE_RECUSA = 'Esse pedido eu não consigo atender.';
const MAX_PEDIDOS_HAIKU = 8;
const MAX_PEDIDOS_SONNET = 10;

const ROTULOS = Object.fromEntries([...BASE, DELEGAR].map(f => [f.nome, f.rotulo]));
ROTULOS.web_search = 'Pesquisando na internet';

/** Rótulo do cartão de atividade, quando o input já é conhecido. */
function rotuloCom(nome, input) {
  const i = input || {};
  switch (nome) {
    case 'ler_nota': return i.nome ? `Lendo a nota ${cortar(i.nome, 60)}` : ROTULOS[nome];
    case 'buscar_notas': return i.consulta ? `Procurando nas notas: ${cortar(i.consulta, 50)}` : ROTULOS[nome];
    case 'consultar_dados': return i.objetivo ? `Banco: ${cortar(i.objetivo, 60)}` : ROTULOS[nome];
    case 'listar_emails': return i.filtro === 'nao_lidos' ? 'Lendo a caixa cpd@ (não lidos)' : ROTULOS[nome];
    case 'ler_arquivo': return i.caminho ? `Lendo ${cortar(String(i.caminho).split(/[\\/]/).pop(), 60)}` : ROTULOS[nome];
    case 'buscar_arquivos': return i.termo ? `Procurando arquivos: ${cortar(i.termo, 50)}` : ROTULOS[nome];
    case 'delegar': return i.porque ? `Pensando com mais calma: ${cortar(i.porque, 60)}` : ROTULOS[nome];
    default: return ROTULOS[nome] || nome;
  }
}

export function mensagemErroApi(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'A chave da API do Claude não foi aceita. Confira o ANTHROPIC_API_KEY no ENV.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'A conta da API do Claude não tem permissão para esse modelo.';
  if (e instanceof Anthropic.NotFoundError) return 'O modelo do Claude não foi encontrado nesta conta.';
  if (e instanceof Anthropic.RateLimitError) return 'O Claude está com muitos pedidos agora. Tente de novo em alguns segundos.';
  if (e instanceof Anthropic.BadRequestError) return 'O Claude recusou o pedido (erro 400). O detalhe ficou no log do servidor.';
  if (e instanceof Anthropic.InternalServerError) return 'O Claude está sobrecarregado ou fora do ar agora. Tente de novo em instantes.';
  if (e instanceof Anthropic.APIConnectionTimeoutError) return 'O Claude demorou demais para responder. Tente de novo.';
  if (e instanceof Anthropic.APIConnectionError) return 'Sem conexão com o Claude. Confira a internet.';
  if (e instanceof Anthropic.APIError) return `O Claude respondeu com erro (${e.status ?? 'sem código'}).`;
  return 'Algo deu errado no cérebro do Jarvis. O detalhe ficou no log do servidor.';
}

/* Fontes citadas pela pesquisa (título e site), para um cartão: nunca para a voz. */
function fontesDe(content) {
  const out = new Map();
  for (const b of content || []) {
    if (b.type !== 'text' || !Array.isArray(b.citations)) continue;
    for (const c of b.citations) {
      if (!c || !c.url) continue;
      let site = '';
      try { site = new URL(c.url).hostname.replace(/^www\./, ''); } catch (_) { site = ''; }
      out.set(c.url, `${cortar(c.title || site || 'Fonte', 90)}${site ? ` — ${site}` : ''}`);
    }
  }
  return [...out.values()].slice(0, 8);
}

/* Depois de um fallback no meio do turno: só o que vem depois do último bloco `fallback` vale por inteiro; antes
   dele ficam só texto e pares completos de ferramenta de servidor (skill claude-api, refusal fallbacks). */
function depoisDoFallback(content) {
  let k = -1;
  content.forEach((b, i) => { if (b.type === 'fallback') k = i; });
  if (k < 0) return content;
  const antes = content.slice(0, k);
  const pares = new Set(antes.filter(b => b.type === 'web_search_tool_result').map(b => b.tool_use_id));
  const fica = antes.filter(b => b.type === 'text' || b.type === 'web_search_tool_result' || (b.type === 'server_tool_use' && pares.has(b.id)));
  return [...fica, ...content.slice(k + 1)];
}

/**
 * Um pedido em streaming, com a única repetição que a skill manda: JSON de ferramenta que nem parseia (eager input
 * streaming) rejeita o stream; isso — e só isso, nunca os erros tipados da API — é refeito até 2 vezes.
 */
async function rodarStream(criar, aoEvento, signal) {
  for (let tent = 0; ; tent++) {
    const stream = criar();
    try {
      for await (const ev of stream) aoEvento(ev, tent);
      return await stream.finalMessage();
    } catch (e) {
      if (signal?.aborted || e instanceof Anthropic.APIUserAbortError) throw e;
      if (e instanceof Anthropic.APIError || tent >= 2) throw e;
      log('jarvis: o input de uma ferramenta veio com JSON quebrado; refazendo o pedido', tent + 1);
    }
  }
}

export function criarCerebro({ cfg, vault, banco }) {
  const client = new Anthropic({ apiKey: cfg.anthropic.apiKey, maxRetries: 2, timeout: 120000 });
  const lube = contextoDaLube(cfg.vaultDir);
  let buscaHaiku = null;            // decidido uma vez
  let sysHaiku, toolsHaiku;
  const sysSonnet = [{ type: 'text', text: promptSonnet({ lube }), cache_control: { type: 'ephemeral', ttl: '1h' } }];
  const toolsSonnet = [...definicoesApi(BASE), BUSCA_SONNET];

  function montarHaiku() {
    sysHaiku = [{ type: 'text', text: promptHaiku({ lube, buscaNaWeb: buscaHaiku }), cache_control: { type: 'ephemeral', ttl: '1h' } }];
    toolsHaiku = [...definicoesApi([...BASE, DELEGAR]), ...(buscaHaiku ? [BUSCA_HAIKU] : [])];
  }

  async function detectarBusca() {
    if (cfg.buscaHaiku !== null) return cfg.buscaHaiku;
    try {
      const m = await client.models.retrieve(HAIKU);
      const c = m?.capabilities || {};
      const v = c?.server_tools?.web_search?.supported ?? c?.web_search?.supported ?? c?.tools?.web_search?.supported;
      if (typeof v === 'boolean') return v;
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) { log('jarvis: a chave da API não foi aceita (models.retrieve)'); return false; }
    }
    try {
      await client.messages.countTokens({ model: HAIKU, messages: [{ role: 'user', content: 'oi' }], tools: [BUSCA_HAIKU] });
      return true;
    } catch (_) { return false; }
  }
  const pronto = detectarBusca().then(v => { if (buscaHaiku === null) { buscaHaiku = !!v; montarHaiku(); log(`jarvis: pesquisa na internet direto no Haiku: ${buscaHaiku ? 'sim' : 'não (ele delega ao Sonnet)'}`); } }).catch(() => {});

  async function garantirDecisao() {
    await Promise.race([pronto, esperar(6000)]);
    if (buscaHaiku === null) { buscaHaiku = false; montarHaiku(); }
  }

  /* ---------- Sub-turno com o Sonnet (ferramenta delegar) ---------- */
  async function delegar(input, ctx) {
    ctx.emitir('modelo', { nome: 'sonnet' });
    try {
      const recentes = (ctx.conversa || []).slice(-8).map(e => `${e.papel === 'julio' ? 'Júlio' : 'Jarvis'}: ${cortar(e.texto, 500)}`).join('\n');
      const msgs = [{
        role: 'user',
        content: [
          { type: 'text', text: `Tarefa passada pelo Jarvis: ${input.tarefa}${input.porque ? `\nPor que é pesada: ${input.porque}` : ''}\n\nConversa recente, só para contexto:\n${recentes || '(nenhuma)'}` },
          { type: 'text', text: `[Agora: ${agoraPorExtenso()} (horário de Brasília).${ctx.linhaTela ? ` ${ctx.linhaTela}` : ''}]`, cache_control: { type: 'ephemeral' } },
        ],
      }];
      let marcado = null;
      for (let req = 0; req < MAX_PEDIDOS_SONNET; req++) {
        const aoEvento = ev => {
          if (ev.type !== 'content_block_start') return;
          const b = ev.content_block;
          if (b.type === 'tool_use') ctx.emitir('ferramenta', { id: b.id, nome: b.name, rotulo: rotuloCom(b.name), estado: 'inicio' });
          else if (b.type === 'server_tool_use') ctx.emitir('ferramenta', { id: b.id, nome: 'web_search', rotulo: ROTULOS.web_search, estado: 'inicio' });
          else if (b.type === 'web_search_tool_result') {
            const erro = !Array.isArray(b.content);
            ctx.emitir('ferramenta', { id: b.tool_use_id, nome: 'web_search', rotulo: ROTULOS.web_search, estado: erro ? 'erro' : 'fim', resumo: erro ? 'a pesquisa falhou' : `${b.content.length} resultados` });
          }
        };
        const t0 = Date.now();
        const msg = await rodarStream(() => client.beta.messages.stream({
          model: SONNET, max_tokens: 16000, output_config: { effort: 'medium' },
          system: sysSonnet, tools: toolsSonnet, messages: msgs,
          betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        }, { signal: ctx.signal }), aoEvento, ctx.signal);
        const u = msg.usage || {};
        log(`jarvis: sonnet ${msg.stop_reason} · entrada ${u.input_tokens ?? '?'} · cache lido ${u.cache_read_input_tokens ?? 0} · cache escrito ${u.cache_creation_input_tokens ?? 0} · saída ${u.output_tokens ?? '?'} · ${Date.now() - t0} ms`);
        if (msg.stop_reason === 'refusal') return { ok: false, texto: 'O modelo de análise recusou esse pedido. Diga ao Júlio, numa frase neutra, que esse pedido não dá para atender.', resumo: 'recusado' };
        const content = depoisDoFallback(msg.content);
        const usos = content.filter(b => b.type === 'tool_use');
        if (msg.stop_reason === 'max_tokens') {
          const t = content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
          return { ok: !!t, texto: t ? `${t} (o relatório foi cortado no limite de tamanho)` : 'O relatório passou do limite de tamanho e veio cortado.', resumo: 'cortado' };
        }
        if (msg.stop_reason === 'pause_turn') { msgs.push({ role: 'assistant', content }); continue; }
        if (msg.stop_reason === 'tool_use' && usos.length) {
          msgs.push({ role: 'assistant', content });
          const blocos = await Promise.all(usos.map(b => rodarFerramenta(b, BASE, ctx)));
          if (marcado) delete marcado.cache_control;
          marcado = blocos[blocos.length - 1];
          marcado.cache_control = { type: 'ephemeral' };
          msgs.push({ role: 'user', content: blocos });
          continue;
        }
        const texto = content.filter(b => b.type === 'text').map(b => b.text).join(' ').replace(/\s+/g, ' ').trim();
        const fontes = fontesDe(content);
        if (fontes.length) ctx.emitir('cartao', { tipo: 'lista', dados: { titulo: 'Fontes', itens: fontes } });
        return { ok: !!texto, texto: texto || 'O modelo de análise terminou sem relatório.', resumo: 'pronto' };
      }
      return { ok: false, texto: 'A análise passou do número de passos e parou sem concluir.', resumo: 'parou' };
    } finally {
      ctx.emitir('modelo', { nome: 'haiku' });
    }
  }

  /* Uma chamada de ferramenta: valida, roda, emite o cartão de atividade e devolve o bloco tool_result. */
  async function rodarFerramenta(bloco, lista, ctx) {
    const lido = inputDoBloco(bloco);
    const f = acharFerramenta(lista, bloco.name);
    const fim = (estado, resumo, extra) => ctx.emitir('ferramenta', { id: bloco.id, nome: bloco.name, rotulo: rotuloCom(bloco.name, lido.input), estado, resumo, ...(extra || {}) });
    if (!lido.ok) {
      fim('erro', 'pedido com JSON quebrado');
      return { type: 'tool_result', tool_use_id: bloco.id, is_error: true, content: JSON.stringify({ INVALID_JSON: lido.bruto }) };
    }
    if (!f) {
      fim('erro', 'ferramenta desconhecida');
      return { type: 'tool_result', tool_use_id: bloco.id, is_error: true, content: `A ferramenta "${bloco.name}" não existe. As que existem: ${lista.map(x => x.nome).join(', ')}.` };
    }
    let r;
    if (f.nome === 'delegar') {
      const erros = validar(f.schema, lido.input);
      if (erros.length) r = { ok: false, texto: JSON.stringify({ INVALID_JSON: JSON.stringify(lido.input), erros }), resumo: 'pedido inválido' };
      else {
        const sig = comPrazo(ctx.signal, 240000);
        try { r = await delegar(lido.input, { ...ctx, signal: sig }); }
        catch (e) {
          if (ctx.signal?.aborted) throw e;
          if (sig.aborted) r = { ok: false, texto: 'A análise passou de quatro minutos e foi cancelada. Diga ao Júlio e ofereça um caminho mais simples.', resumo: 'passou do tempo' };
          else {
            if (e instanceof Anthropic.APIError) log('jarvis: erro da API no sub-turno do Sonnet', e.status ?? '', cortar(String(e.message || ''), 300));
            r = { ok: false, texto: `A análise com o modelo mais forte não rodou: ${mensagemErroApi(e)}`, resumo: 'falhou' };
          }
        }
      }
    } else {
      r = await executarFerramenta(f, lido.input, ctx);
    }
    fim(r.ok ? 'fim' : 'erro', r.resumo, r.extra);
    return r.ok
      ? { type: 'tool_result', tool_use_id: bloco.id, content: r.texto }
      : { type: 'tool_result', tool_use_id: bloco.id, is_error: true, content: r.texto };
  }

  /* ---------- O turno ---------- */
  async function turno({ conversa, contexto }, emitir, signal) {
    await garantirDecisao();
    const ent = limparConversa(conversa);
    const linhaTela = linhaContexto(contexto);
    const avisos = tirarAvisos();
    const sistemaTurno = [linhaTela, ...(avisos.length ? [`Desde a sua última fala: ${avisos.join(' ')}`] : [])].join('\n');
    const { mensagens: msgs, sistema, atual } = montarMensagens(ent, sistemaTurno);
    const reg = novoRegistro(atual, sistema);
    const t0 = Date.now();
    let primeiraFala = null, nFerramentas = 0, motivo = 'fim';
    const extraFim = {};
    const ctx = { cfg, vault, banco, emitir, signal, conversa: ent, linhaTela };
    let marcado = null;
    let pendente = null;          // {conteudo, ini} de uma rodada cujas ferramentas ainda não voltaram
    let rodada = null;

    const falar = d => {
      if (!d) return;
      if (!rodada.temTexto) {
        if (reg.textoTotal && !/\s$/.test(reg.textoTotal) && !/^\s/.test(d)) { emitir('texto', { delta: ' ' }); reg.textoTotal += ' '; }
        rodada.ini = reg.textoTotal.length;
        rodada.temTexto = true;
      }
      emitir('texto', { delta: d });
      reg.textoTotal += d;
      rodada.texto += d;
      if (primeiraFala === null) primeiraFala = Date.now() - t0;
    };

    emitir('modelo', { nome: 'haiku' });
    try {
      let pedidos = 0;
      for (;;) {
        if (pedidos++ >= MAX_PEDIDOS_HAIKU) { motivo = 'limite'; break; }
        rodada = { ini: reg.textoTotal.length, texto: '', temTexto: false, tent: 0, retexto: '' };
        const iniciadas = new Set();
        const aoEvento = (ev, tent) => {
          if (tent > 0 && rodada.tent !== tent) {   // pedido refeito: fecha os cartões da tentativa anterior
            rodada.tent = tent; rodada.retexto = '';
            for (const id of iniciadas) emitir('ferramenta', { id, estado: 'erro', resumo: 'refeito' });
            iniciadas.clear();
          }
          if (ev.type === 'content_block_start') {
            const b = ev.content_block;
            if (b.type === 'tool_use') { iniciadas.add(b.id); emitir('ferramenta', { id: b.id, nome: b.name, rotulo: rotuloCom(b.name), estado: 'inicio' }); }
            else if (b.type === 'server_tool_use') emitir('ferramenta', { id: b.id, nome: 'web_search', rotulo: ROTULOS.web_search, estado: 'inicio' });
            else if (b.type === 'web_search_tool_result') {
              const erro = !Array.isArray(b.content);
              emitir('ferramenta', { id: b.tool_use_id, nome: 'web_search', rotulo: ROTULOS.web_search, estado: erro ? 'erro' : 'fim', resumo: erro ? 'a pesquisa falhou' : `${b.content.length} resultados` });
            }
          } else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
            let d = ev.delta.text;
            if (tent > 0) {                           // não repetir em voz o que já foi dito antes de refazer
              rodada.retexto += d;
              if (rodada.retexto.length <= rodada.texto.length) return;
              d = rodada.retexto.slice(rodada.texto.length);
            }
            falar(d);
          }
        };
        const params = () => ({ model: HAIKU, max_tokens: 4000, output_config: { effort: 'low' }, system: sysHaiku, tools: toolsHaiku, messages: msgs });
        let msg;
        try {
          msg = await rodarStream(() => client.messages.stream(params(), { signal }), aoEvento, signal);
        } catch (e) {
          if (buscaHaiku && e instanceof Anthropic.BadRequestError && /web_search|tool/i.test(String(e.message)) && !rodada.temTexto) {
            log('jarvis: a API recusou a pesquisa no Haiku; daqui em diante ele delega');
            buscaHaiku = false; montarHaiku(); pedidos--; continue;
          }
          throw e;
        }
        const u = msg.usage || {};
        log(`jarvis: haiku ${msg.stop_reason} · entrada ${u.input_tokens ?? '?'} · cache lido ${u.cache_read_input_tokens ?? 0} · cache escrito ${u.cache_creation_input_tokens ?? 0} · saída ${u.output_tokens ?? '?'} · 1ª fala ${primeiraFala ?? '-'} ms`);
        const content = msg.content;
        const sr = msg.stop_reason;
        const fontes = fontesDe(content);
        if (fontes.length) emitir('cartao', { tipo: 'lista', dados: { titulo: 'Fontes', itens: fontes } });

        if (sr === 'refusal') {               // descarta o parcial: a interface para de falar e diz a frase neutra
          motivo = 'recusado'; extraFim.mensagem = FRASE_RECUSA;
          // no histórico fica só a frase neutra (é o que a interface guarda no lugar do parcial)
          reg.textoTotal = FRASE_RECUSA;
          reg.rounds = [{ assistant: [{ type: 'text', text: FRASE_RECUSA }], resultados: null, ini: 0, fim: FRASE_RECUSA.length }];
          break;
        }
        const usos = content.filter(b => b.type === 'tool_use');
        if (sr === 'max_tokens') {            // input de ferramenta pode ter vindo cortado: não roda
          motivo = 'limite';
          for (const b of usos) emitir('ferramenta', { id: b.id, estado: 'erro', resumo: 'cortado no limite' });
          reg.rounds.push({ assistant: blocosParaRegistro(content, { semFerramentas: true }), resultados: null, ini: rodada.ini, fim: reg.textoTotal.length });
          break;
        }
        if (sr === 'pause_turn') {
          msgs.push({ role: 'assistant', content });
          reg.rounds.push({ assistant: blocosParaRegistro(content), resultados: null, ini: rodada.ini, fim: reg.textoTotal.length });
          continue;
        }
        if (sr === 'tool_use' && usos.length) {
          msgs.push({ role: 'assistant', content });
          pendente = { content, ini: rodada.ini, fim: reg.textoTotal.length };
          const blocos = await Promise.all(usos.map(b => rodarFerramenta(b, [...BASE, DELEGAR], ctx)));
          nFerramentas += usos.length;
          if (marcado) delete marcado.cache_control;
          marcado = blocos[blocos.length - 1];
          marcado.cache_control = { type: 'ephemeral' };
          msgs.push({ role: 'user', content: blocos });
          reg.rounds.push({ assistant: blocosParaRegistro(content), resultados: resultadosParaRegistro(blocos), ini: pendente.ini, fim: pendente.fim });
          pendente = null;
          continue;
        }
        reg.rounds.push({ assistant: blocosParaRegistro(content), resultados: null, ini: rodada.ini, fim: reg.textoTotal.length });
        break;
      }
    } catch (e) {
      if (signal.aborted || e instanceof Anthropic.APIUserAbortError) {
        motivo = 'cancelado';
        if (pendente) reg.rounds.push({ assistant: blocosParaRegistro(pendente.content, { semFerramentas: true }), resultados: null, ini: pendente.ini, fim: pendente.fim });
        else if (rodada && rodada.texto.trim()) reg.rounds.push({ assistant: [{ type: 'text', text: rodada.texto.trim() }], resultados: null, ini: rodada.ini, fim: reg.textoTotal.length });
      } else {
        motivo = 'erro';
        if (e instanceof Anthropic.APIError) log('jarvis: erro da API do Claude', e.status ?? '', e.constructor?.name ?? '', cortar(String(e.message || ''), 400));
        else log('jarvis: erro no turno', e?.name || '', cortar(String(e?.message || ''), 300));
        if (rodada && rodada.texto.trim()) reg.rounds.push({ assistant: [{ type: 'text', text: rodada.texto.trim() }], resultados: null, ini: rodada.ini, fim: reg.textoTotal.length });
        emitir('erro', { mensagem: mensagemErroApi(e) });
      }
    } finally {
      fecharRegistro(reg);
      if (!signal.aborted) emitir('fim', { motivo, latencia_ms: primeiraFala, ferramentas: nFerramentas, ...extraFim });
    }
  }

  return {
    tipo: 'claude',
    turno,
    estado: () => ({ modo: 'claude', modelo_conversa: HAIKU, modelo_pesado: SONNET, busca_na_conversa: buscaHaiku }),
  };
}
