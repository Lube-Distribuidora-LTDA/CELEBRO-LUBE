/* Teste do cérebro de verdade (cerebro.js) contra uma API do Claude DE MENTIRA, em 127.0.0.1, que fala o mesmo SSE da
   Anthropic. A SDK oficial é apontada para ela com ANTHROPIC_BASE_URL e uma chave falsa: nada sai deste computador.
   node teste/testar-cerebro.js
   Confere os pedidos (modelo, effort, cache, ferramentas, mensagens de sistema, beta de fallback no Sonnet) e o
   comportamento (laço de ferramentas, delegar, recusa, JSON quebrado, max_tokens, corte, histórico reconstruído). */
import http from 'node:http';

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; console.log(`${cond ? 'OK  ' : 'FALHOU'} ${msg}`); if (!cond) falhas++; };
const titulo = t => console.log(`\n== ${t}`);

/* ---------- a API de mentira ---------- */
const pedidos = [];            // {caminho, cabecalhos, corpo}
let roteiro = [];              // funções (corpo) -> {status?, eventos?:[...], atraso?}
const sse = (tipo, dados) => `event: ${tipo}\ndata: ${JSON.stringify({ type: tipo, ...dados })}\n\n`;
function mensagem({ modelo = 'claude-haiku-5-5', blocos = [], parada = 'end_turn' }) {
  const ev = [sse('message_start', { message: { id: 'msg_' + Math.random().toString(36).slice(2), type: 'message', role: 'assistant', model: modelo, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 900, output_tokens: 1, cache_read_input_tokens: 700, cache_creation_input_tokens: 0 } } })];
  blocos.forEach((b, i) => {
    if (b.texto !== undefined) {
      ev.push(sse('content_block_start', { index: i, content_block: { type: 'text', text: '' } }));
      for (const p of [].concat(b.texto)) ev.push(sse('content_block_delta', { index: i, delta: { type: 'text_delta', text: p } }));
    } else if (b.pensando) {
      ev.push(sse('content_block_start', { index: i, content_block: { type: 'thinking', thinking: '', signature: '' } }));
      ev.push(sse('content_block_delta', { index: i, delta: { type: 'signature_delta', signature: 'assinatura-falsa' } }));
    } else if (b.ferramenta) {
      ev.push(sse('content_block_start', { index: i, content_block: { type: 'tool_use', id: b.id, name: b.ferramenta, input: {} } }));
      for (const p of [].concat(b.json)) ev.push(sse('content_block_delta', { index: i, delta: { type: 'input_json_delta', partial_json: p } }));
    }
    ev.push(sse('content_block_stop', { index: i }));
  });
  ev.push(sse('message_delta', { delta: { stop_reason: parada, stop_sequence: null }, usage: { output_tokens: 40 } }));
  ev.push(sse('message_stop', {}));
  return ev;
}
const api = http.createServer(async (req, res) => {
  let s = '';
  for await (const p of req) s += p;
  const corpo = s ? JSON.parse(s) : {};
  pedidos.push({ caminho: req.url, cabecalhos: req.headers, corpo });
  const passo = roteiro.shift();
  const r = passo ? passo(corpo, req) : { status: 500, json: { type: 'error', error: { type: 'api_error', message: 'sem roteiro' } } };
  if (r.json) { res.writeHead(r.status || 200, { 'content-type': 'application/json', ...(r.cabecalhos || {}) }); res.end(JSON.stringify(r.json)); return; }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const e of r.eventos) {
    if (res.destroyed) return;
    res.write(e);
    if (r.atraso) await new Promise(t => setTimeout(t, r.atraso));
  }
  res.end();
});
await new Promise(r => api.listen(0, '127.0.0.1', r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${api.address().port}`;

const { carregarConfig } = await import('../config.js');
const { criarVault } = await import('../vault.js');
const { criarBanco } = await import('../banco.js');
const { criarCerebro } = await import('../cerebro.js');
const base = carregarConfig([]);
const cfg = { ...base, simulado: false, buscaHaiku: false, anthropic: { apiKey: 'chave-falsa-so-para-o-teste' }, banco: null, imap: null, smtp: null };
const vault = criarVault(cfg.vaultDir);
const cerebro = criarCerebro({ cfg, vault, banco: criarBanco(null) });

async function rodar(conversa, { abortarEm } = {}) {
  const eventos = [];
  const ctl = new AbortController();
  const emitir = (ev, d) => { eventos.push({ ev, d }); if (abortarEm && abortarEm(ev, d, eventos)) ctl.abort(new Error('corte do teste')); };
  await cerebro.turno({ conversa, contexto: { tela: 'jarvis', nota_aberta: 'BI COMPRAS' } }, emitir, ctl.signal).catch(e => eventos.push({ ev: 'EXCECAO', d: String(e?.message || e) }));
  const texto = eventos.filter(e => e.ev === 'texto').map(e => e.d.delta).join('');
  return { eventos, texto, fim: eventos.find(e => e.ev === 'fim')?.d, de: n => eventos.filter(e => e.ev === n).map(e => e.d) };
}

try {
  /* 1. resposta simples */
  titulo('resposta simples e o formato do pedido');
  roteiro = [() => ({ eventos: mensagem({ blocos: [{ pensando: true }, { texto: ['Bom dia, ', 'Júlio. ', 'Tudo em ordem por aqui.'] }] }) })];
  let r = await rodar([{ papel: 'julio', texto: 'Bom dia, Jarvis' }]);
  ok(r.texto === 'Bom dia, Júlio. Tudo em ordem por aqui.', `texto em streaming: "${r.texto}"`);
  ok(r.de('modelo')[0]?.nome === 'haiku' && r.fim?.motivo === 'fim' && Number.isFinite(r.fim?.latencia_ms), `eventos modelo e fim (${JSON.stringify(r.fim)})`);
  const p1 = pedidos[0].corpo;
  ok(pedidos[0].caminho.startsWith('/v1/messages') && p1.model === 'claude-haiku-5-5' && p1.stream === true, 'POST /v1/messages, claude-haiku-5-5, streaming');
  ok(p1.output_config?.effort === 'low' && p1.max_tokens === 4000, 'effort low, max_tokens 4000');
  ok(!('thinking' in p1) && !('temperature' in p1) && !('top_p' in p1) && !('top_k' in p1) && !('fallbacks' in p1), 'sem thinking explícito, sem temperature/top_p/top_k, sem fallbacks no Haiku');
  ok(p1.system?.[0]?.cache_control?.ttl === '1h' && !/\d{2}:\d{2}/.test(p1.system[0].text.slice(0, 3000)), 'system com cache 1h e sem hora');
  ok(p1.tools.length === 12 && p1.tools.every(t => t.eager_input_streaming === true) && p1.tools.some(t => t.name === 'delegar') && !p1.tools.some(t => t.type), '12 ferramentas nossas (com delegar), eager_input_streaming, sem pesquisa no Haiku');
  const ult = p1.messages.at(-1), pen = p1.messages.at(-2);
  ok(ult.role === 'system' && /Agora: .*Brasília/.test(ult.content) && /BI COMPRAS/.test(ult.content), 'a hora e a tela vão numa mensagem de sistema no fim');
  ok(pen.role === 'user' && pen.content[0].text === 'Bom dia, Jarvis' && pen.content[0].cache_control?.type === 'ephemeral', 'a fala do Júlio sozinha no bloco, com breakpoint de cache');

  /* 2. laço de ferramentas */
  titulo('laço de ferramentas (buscar_notas de verdade no vault)');
  roteiro = [
    () => ({ eventos: mensagem({ parada: 'tool_use', blocos: [{ pensando: true }, { texto: 'Um instante, vou procurar nas notas.' }, { ferramenta: 'buscar_notas', id: 'toolu_A', json: ['{"consulta": "fatura', 'mento compras"}'] }] }) }),
    () => ({ eventos: mensagem({ blocos: [{ texto: 'Achei a nota da carga de faturamento.' }] }) }),
  ];
  const n0 = pedidos.length;
  const conv2 = [{ papel: 'julio', texto: 'Quando roda o faturamento?' }];
  r = await rodar(conv2);
  const fs2 = r.de('ferramenta');
  ok(fs2[0]?.estado === 'inicio' && fs2[0]?.nome === 'buscar_notas' && fs2[1]?.estado === 'fim' && /notas/.test(fs2[1]?.resumo) && Array.isArray(fs2[1]?.notas), `cartão de atividade: inicio → fim (${fs2[1]?.resumo})`);
  ok(r.texto === 'Um instante, vou procurar nas notas. Achei a nota da carga de faturamento.', `as duas falas com espaço entre elas: "${r.texto}"`);
  const p2 = pedidos[n0 + 1].corpo;
  const asst = p2.messages.at(-2), res2 = p2.messages.at(-1);
  ok(asst.role === 'assistant' && asst.content[0].type === 'thinking' && asst.content[0].signature === 'assinatura-falsa', 'dentro do turno o bloco de thinking volta intacto');
  ok(res2.role === 'user' && res2.content[0].type === 'tool_result' && res2.content[0].tool_use_id === 'toolu_A' && !res2.content[0].is_error, 'o resultado volta como tool_result do mesmo id');
  ok(res2.content.at(-1).cache_control?.type === 'ephemeral', 'breakpoint de cache no último resultado');
  ok(JSON.parse(res2.content[0].content).notas.length > 0, 'a busca rodou de verdade no vault');
  const reg2 = { julio: conv2[0], jarvis: { papel: 'jarvis', texto: r.texto } };

  /* 3. histórico reconstruído no turno seguinte */
  titulo('histórico reconstruído igual no turno seguinte');
  roteiro = [() => ({ eventos: mensagem({ blocos: [{ texto: 'Às duas e cinquenta da manhã.' }] }) })];
  const n1 = pedidos.length;
  r = await rodar([reg2.julio, reg2.jarvis, { papel: 'julio', texto: 'E que horas?' }]);
  const p3 = pedidos[n1].corpo.messages;
  ok(p3.map(m => m.role).join(',') === 'user,system,assistant,user,assistant,user,system', `ordem: ${p3.map(m => m.role).join(',')}`);
  ok(p3[2].content.some(b => b.type === 'tool_use' && b.id === 'toolu_A') && p3[3].content[0].tool_use_id === 'toolu_A', 'a rodada de ferramenta do turno anterior volta (não só o texto)');
  ok(!JSON.stringify(p3.slice(0, -2)).includes('"thinking"'), 'thinking de turno anterior não volta (nada de 400 do pensamento preservado)');
  ok(JSON.stringify(p3[1]) === JSON.stringify(pedidos[n0].corpo.messages.at(-1)), 'a mensagem de sistema do turno anterior volta byte a byte');
  ok(JSON.stringify(pedidos[n1].corpo.system) === JSON.stringify(pedidos[n0].corpo.system) && JSON.stringify(pedidos[n1].corpo.tools) === JSON.stringify(pedidos[n0].corpo.tools), 'system e tools idênticos entre turnos (cache)');

  /* 4. delegar ao Sonnet */
  titulo('delegar: sub-turno com o Sonnet 5.5');
  roteiro = [
    () => ({ eventos: mensagem({ parada: 'tool_use', blocos: [{ texto: 'Deixa eu pensar nisso com calma.' }, { ferramenta: 'delegar', id: 'toolu_D', json: '{"tarefa":"Pesquisar o preço do diesel no ES","porque":"pesquisa na internet"}' }] }) }),
    () => ({ eventos: mensagem({ modelo: 'claude-sonnet-5-5', blocos: [{ pensando: true }, { texto: 'O diesel no Espírito Santo está em torno de seis reais, segundo a ANP.' }] }) }),
    () => ({ eventos: mensagem({ blocos: [{ texto: 'Pelo que apurei, o diesel está perto de seis reais.' }] }) }),
  ];
  const n2 = pedidos.length;
  r = await rodar([{ papel: 'julio', texto: 'Quanto está o diesel?' }]);
  const ps = pedidos[n2 + 1];
  ok(ps.corpo.model === 'claude-sonnet-5-5' && ps.corpo.output_config?.effort === 'medium' && ps.corpo.fallbacks === 'default', 'Sonnet 5.5, effort medium, fallbacks "default"');
  ok(String(ps.cabecalhos['anthropic-beta'] || '').includes('server-side-fallback-2026-07-01'), `beta do fallback no cabeçalho (${ps.cabecalhos['anthropic-beta']})`);
  ok(ps.corpo.tools.some(t => t.type === 'web_search_20260209') && !ps.corpo.tools.some(t => t.name === 'delegar') && !ps.corpo.tools.some(t => t.type === 'code_execution_20260521'), 'Sonnet com pesquisa na web, sem delegar e sem code_execution');
  ok(/diesel/.test(ps.corpo.messages[0].content[0].text) && /Agora:/.test(ps.corpo.messages[0].content[1].text), 'a tarefa e a hora vão para o Sonnet');
  ok(r.de('modelo').map(m => m.nome).join('>') === 'haiku>sonnet>haiku', `o HUD muda de ritmo: ${r.de('modelo').map(m => m.nome).join(' > ')}`);
  const resD = pedidos[n2 + 2].corpo.messages.at(-1).content[0];
  ok(resD.tool_use_id === 'toolu_D' && /seis reais/.test(resD.content), 'o relatório do Sonnet volta para o Haiku contar');
  ok(!/seis reais, segundo a ANP/.test(r.texto) && /perto de seis reais/.test(r.texto), 'quem fala é o Haiku (o texto do Sonnet não vai direto para a voz)');

  /* 5. recusa */
  titulo('recusa no meio do streaming');
  roteiro = [() => ({ eventos: mensagem({ parada: 'refusal', blocos: [{ texto: 'Vou te explicar como' }] }) })];
  r = await rodar([{ papel: 'julio', texto: 'pedido recusado' }]);
  ok(r.fim?.motivo === 'recusado' && r.fim?.mensagem === 'Esse pedido eu não consigo atender.', `fim com motivo recusado e a frase neutra (${JSON.stringify(r.fim)})`);

  /* 6. JSON quebrado na ferramenta */
  titulo('input de ferramenta com JSON quebrado');
  roteiro = [
    () => ({ eventos: mensagem({ parada: 'tool_use', blocos: [{ ferramenta: 'ler_nota', id: 'toolu_J', json: '{"nome": "BI COMPRAS", "extra": tru' }] }) }),
    () => ({ eventos: mensagem({ blocos: [{ texto: 'Tentei de novo.' }] }) }),
  ];
  const n3 = pedidos.length;
  r = await rodar([{ papel: 'julio', texto: 'lê a nota' }]);
  const rj = pedidos[n3 + 1]?.corpo.messages.at(-1).content[0];
  ok(rj?.is_error === true && /INVALID_JSON/.test(rj.content), 'a ferramenta não roda; volta INVALID_JSON com is_error');
  ok(r.de('ferramenta').some(f => f.estado === 'erro'), 'o cartão de atividade fica em erro');

  /* 7. max_tokens com ferramenta */
  titulo('max_tokens com ferramenta: não roda');
  roteiro = [() => ({ eventos: mensagem({ parada: 'max_tokens', blocos: [{ texto: 'Vou consultar' }, { ferramenta: 'consultar_dados', id: 'toolu_M', json: '{"sql": "select' }] }) })];
  const n4 = pedidos.length;
  r = await rodar([{ papel: 'julio', texto: 'consulta grande' }]);
  ok(r.fim?.motivo === 'limite' && pedidos.length === n4 + 1, 'para no limite sem rodar a ferramenta nem pedir de novo');

  /* 8. corte (interrupção) */
  titulo('interrupção: fechar a conexão cancela o pedido ao Claude');
  roteiro = [() => ({ atraso: 120, eventos: mensagem({ blocos: [{ texto: ['Este ', 'é ', 'um ', 'texto ', 'bem ', 'comprido ', 'que ', 'vai ', 'ser ', 'cortado.'] }] }) })];
  r = await rodar([{ papel: 'julio', texto: 'fala bastante' }], { abortarEm: (ev, d, evs) => ev === 'texto' && evs.filter(e => e.ev === 'texto').length >= 3 });
  ok(!r.fim && !r.eventos.some(e => e.ev === 'erro' || e.ev === 'EXCECAO'), 'turno cancelado em silêncio (sem fim, sem erro)');
  ok(r.texto.length > 0 && !r.texto.includes('cortado.'), `parou no meio: "${r.texto}"`);
  roteiro = [() => ({ eventos: mensagem({ blocos: [{ texto: 'Certo.' }] }) })];
  const n5 = pedidos.length;
  await rodar([{ papel: 'julio', texto: 'fala bastante' }, { papel: 'jarvis', texto: r.texto, interrompido: true }, { papel: 'julio', texto: 'chega, outra coisa' }]);
  const p8 = pedidos[n5].corpo.messages;
  ok(p8.at(-3).role === 'assistant' && p8.at(-3).content.at(-1).text === r.texto.trim(), `a fala cortada volta só com o que foi dito: "${p8.at(-3).content.at(-1).text}"`);
  ok(p8.at(-1).role === 'system' && /interrompeu/.test(p8.at(-1).content) && p8.at(-2).content[0].text === 'chega, outra coisa', 'a nota de interrupção vem depois da nova fala do Júlio');

  /* 9. erro da API */
  titulo('erro da API vira mensagem em português');
  roteiro = [() => ({ status: 401, json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } })];
  r = await rodar([{ papel: 'julio', texto: 'oi' }]);
  ok(r.de('erro')[0]?.mensagem === 'A chave da API do Claude não foi aceita. Confira o ANTHROPIC_API_KEY no ENV.' && r.fim?.motivo === 'erro', `401 → "${r.de('erro')[0]?.mensagem}"`);
  ok(pedidos.at(-1).cabecalhos['x-api-key'] === 'chave-falsa-so-para-o-teste', 'a SDK usou a chave falsa do teste (nada foi para a Anthropic)');
} finally {
  api.close();
}
console.log(`\n${total - falhas} de ${total} OK${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
process.exit(falhas ? 1 : 0);
