/* Cérebro da Lube — servidor/conversa.js
   A conversa que a interface manda (conversa = [{papel:'julio'|'jarvis', texto, interrompido?:true}]) virando mensagens da
   API do Claude, do jeito que o pensamento preservado e o prompt caching exigem:
   - o histórico só cresce: cada turno antigo é reconstruído igual, byte a byte, a partir do registro que o servidor
     guardou dele (a fala do Júlio, a mensagem de sistema daquele turno, os blocos de ferramenta e resultados). Sem
     registro (servidor reiniciado, conversa de outra sessão), o turno vira só texto;
   - blocos de pensamento (thinking) nunca atravessam turnos: são tirados ao guardar o registro. Dentro do turno, o
     laço de ferramentas devolve tudo intacto;
   - interrupção sem editar o passado (JARVIS.md §7.10 b): a resposta interrompida fica só com o que foi realmente dito
     (e as rodadas de ferramenta que terminaram antes do corte), e uma mensagem de sistema DEPOIS da fala seguinte do
     Júlio avisa que ele não ouviu o resto;
   - a hora e o que está na tela vão numa mensagem de sistema curta logo depois da fala do Júlio — nunca no system do
     topo (cache) e nunca misturados com as palavras dele. */
import { ErroFerramenta, agoraPorExtenso, cortar, norm } from './util.js';
import { limparFala } from '../web/js/fala.js';

export const NOTA_INTERROMPIDO = 'O Júlio interrompeu sua última fala nesse ponto; ele não ouviu o resto.';
export const NOTA_INTERROMPIDO_MUDO = 'O Júlio interrompeu antes de você dizer qualquer coisa; ele não ouviu nada da resposta anterior.';
const MAX_ENTRADAS = 40;

/** Confere e arruma a conversa. A última entrada tem que ser uma fala do Júlio. */
export function limparConversa(conversa) {
  if (!Array.isArray(conversa) || !conversa.length) throw new ErroFerramenta('A conversa veio vazia.', 'conversa');
  if (conversa.length > 400) throw new ErroFerramenta('A conversa veio longa demais.', 'conversa');
  const ent = [];
  for (const e of conversa) {
    if (!e || typeof e !== 'object') continue;
    const papel = e.papel === 'julio' || e.papel === 'jarvis' ? e.papel : null;
    if (!papel) continue;
    const texto = cortar(String(e.texto ?? '').replace(/\r/g, '').trim(), 6000);
    const ult = ent[ent.length - 1];
    if (ult && ult.papel === papel) {               // duas falas seguidas do mesmo: uma só
      ult.texto = [ult.texto, texto].filter(Boolean).join(' ');
      if (papel === 'jarvis') ult.interrompido = e.interrompido === true;
      continue;
    }
    ent.push({ papel, texto, interrompido: papel === 'jarvis' && e.interrompido === true });
  }
  while (ent.length && ent[0].papel !== 'julio') ent.shift();
  let lista = ent.slice(-MAX_ENTRADAS);
  while (lista.length && lista[0].papel !== 'julio') lista = lista.slice(1);
  const ultima = lista[lista.length - 1];
  if (!ultima || ultima.papel !== 'julio' || !ultima.texto) throw new ErroFerramenta('A última fala da conversa precisa ser do Júlio, e não pode estar vazia.', 'conversa');
  return lista;
}

const limpo = (v, max) => (typeof v === 'string' ? cortar(v.replace(/[\r\n"]+/g, ' ').trim(), max) : '');

/** A linha da hora e da tela (vai na mensagem de sistema do turno). */
export function linhaContexto(contexto, agora = new Date()) {
  const c = contexto && typeof contexto === 'object' ? contexto : {};
  const partes = [`Agora: ${agoraPorExtenso(agora)} (horário de Brasília).`];
  const tela = limpo(c.tela, 60), nota = limpo(c.nota_aberta, 200), rotina = limpo(c.rotina_aberta, 200), depto = limpo(c.departamento, 80);
  if (tela) partes.push(`Tela: ${tela}.`);
  if (nota) partes.push(`Nota aberta no leitor: "${nota}".`);
  if (rotina) partes.push(`Rotina aberta no funil: "${rotina}".`);
  if (depto) partes.push(`Departamento aberto no leque: "${depto}".`);
  return `[Mensagem automática do painel, não é fala do Júlio] ${partes.join(' ')}`;
}

/* ---------- Registros dos turnos (para reconstruir o histórico igual) ---------- */
const registros = [];
export function guardarRegistro(r) {
  registros.push(r);
  if (registros.length > 80) registros.shift();
}
export function _limparRegistros() { registros.length = 0; }

/** Tira o que não pode atravessar turnos (thinking) e o que não é nosso (cache_control, campos internos). */
export function blocosParaRegistro(content, { semFerramentas = false } = {}) {
  const out = [];
  for (const b of content || []) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text') { if (b.text) out.push({ type: 'text', text: b.text }); }
    else if (b.type === 'tool_use') { if (!semFerramentas) out.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input ?? {} }); }
    else if (b.type === 'server_tool_use') { if (!semFerramentas) out.push({ type: 'server_tool_use', id: b.id, name: b.name, input: b.input ?? {} }); }
    else if (b.type === 'web_search_tool_result') { if (!semFerramentas) out.push(JSON.parse(JSON.stringify({ type: b.type, tool_use_id: b.tool_use_id, content: b.content }))); }
    // thinking, redacted_thinking, fallback e outros: ficam de fora
  }
  // server_tool_use sem o resultado par (turno pausado/cortado) não pode ser reenviado sozinho
  const comResultado = new Set(out.filter(b => b.type === 'web_search_tool_result').map(b => b.tool_use_id));
  return out.filter(b => b.type !== 'server_tool_use' || comResultado.has(b.id));
}

export function resultadosParaRegistro(blocos) {
  return blocos.map(b => {
    const { cache_control, ...resto } = b;   // eslint-disable-line no-unused-vars
    return JSON.parse(JSON.stringify(resto));
  });
}

/* comprimento de norm(s.slice(0, k)) para cada k, sem refazer a normalização a cada prefixo */
function comprimentosNormalizados(s) {
  const cum = new Array(s.length + 1);
  cum[0] = 0;
  let saida = 0, espacoPendente = false, inicio = true;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (/\s/.test(c)) { if (!inicio) espacoPendente = true; }
    else {
      const m = c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').length;
      if (m > 0) {
        if (espacoPendente) saida += 1;
        espacoPendente = false; inicio = false; saida += m;
      }
    }
    cum[k + 1] = saida;
  }
  return cum;
}

/* A fala interrompida chega como a interface a falou: limpa (sem markdown, sem [[ ]], URL trocada por "o link"; o
   mesmo limparFala de web/js/fala.js). A resposta completa chega como o Claude escreveu. */
const limpoNorm = s => norm(limparFala(s));

/* Onde, no texto bruto, termina o que foi dito. Sem nada para limpar, pelos comprimentos normalizados; com markdown
   ou [[ ]], percorrendo o texto bruto palavra a palavra até a versão limpa dele cobrir o que foi dito. */
function pontoDoCorte(bruto, dito) {
  const raw = String(bruto || '');
  if (limpoNorm(raw) === norm(raw)) {
    const alvo = norm(dito).length, cum = comprimentosNormalizados(raw);
    for (let k = 0; k <= raw.length; k++) if (cum[k] >= alvo) return k;
    return raw.length;
  }
  const alvo = limpoNorm(dito).length;
  for (let k = 1; k <= raw.length; k++) {
    if (k < raw.length && !/\s/.test(raw[k])) continue;   // só nos fins de palavra
    if (limpoNorm(raw.slice(0, k)).length >= alvo) return k;
  }
  return raw.length;
}

function acharRegistro(julio, jarvis) {
  const jn = norm(julio.texto), tn = norm(jarvis.texto), tl = jarvis.interrompido ? limpoNorm(jarvis.texto) : '';
  for (let i = registros.length - 1; i >= 0; i--) {
    const r = registros[i];
    if (r.julioNorm !== jn) continue;
    if (r.totalNorm === tn && !jarvis.interrompido) return { r, completo: true };
    if (jarvis.interrompido && tn && (r.totalNorm.startsWith(tn) || (r.limpoNorm ?? limpoNorm(r.textoTotal)).startsWith(tl))) {
      return { r, completo: r.totalNorm === tn || (r.limpoNorm ?? limpoNorm(r.textoTotal)) === tl };
    }
    if (jarvis.interrompido && !tn) return { r, completo: false };
  }
  return null;
}

/* As mensagens do assistente de um turno antigo. */
function mensagensDoJarvis(jarvis, achado) {
  const out = [];
  if (!achado) {
    if (jarvis.texto) out.push({ role: 'assistant', content: jarvis.texto });
    return out;
  }
  const { r, completo } = achado;
  if (completo) {
    for (const rd of r.rounds) {
      if (rd.assistant.length) out.push({ role: 'assistant', content: rd.assistant });
      if (rd.resultados && rd.assistant.some(b => b.type === 'tool_use')) out.push({ role: 'user', content: rd.resultados });
    }
    return out;
  }
  // interrompido: as rodadas de ferramenta ditas por inteiro antes do corte, e o pedaço dito da seguinte
  const L = pontoDoCorte(r.textoTotal, jarvis.texto);
  let pos = 0;
  for (const rd of r.rounds) {
    const temFerramenta = rd.resultados && rd.assistant.some(b => b.type === 'tool_use');
    if (temFerramenta && rd.fim <= L) {
      out.push({ role: 'assistant', content: rd.assistant });
      out.push({ role: 'user', content: rd.resultados });
      pos = rd.fim;
      continue;
    }
    break;
  }
  const dito = r.textoTotal.slice(pos, L).trim();
  if (dito) out.push({ role: 'assistant', content: [{ type: 'text', text: dito }] });
  return out;
}

/**
 * Monta as mensagens do turno. Devolve {mensagens, sistema, atual}.
 * `sistemaDoTurno` é a mensagem de sistema que vai depois da fala atual do Júlio (contexto + avisos);
 * a nota de interrupção é acrescentada aqui quando a fala anterior do Jarvis foi cortada.
 */
export function montarMensagens(ent, sistemaDoTurno) {
  const msgs = [];
  for (let i = 0; i < ent.length - 1; i++) {
    const e = ent[i];
    if (e.papel !== 'julio') continue;
    const prox = ent[i + 1]?.papel === 'jarvis' ? ent[i + 1] : null;
    const achado = prox ? acharRegistro(e, prox) : null;
    const jm = prox ? mensagensDoJarvis(prox, achado) : [];
    msgs.push({ role: 'user', content: [{ type: 'text', text: e.texto }] });   // o mesmo formato com que foi mandada no turno dela
    if (jm.length) {
      const anterior = ent[i - 1];
      const nota = achado ? achado.r.sistema
        : (anterior && anterior.papel === 'jarvis' && anterior.interrompido ? (anterior.texto ? NOTA_INTERROMPIDO : NOTA_INTERROMPIDO_MUDO) : null);
      if (nota) msgs.push({ role: 'system', content: nota });
      msgs.push(...jm);
    }
    if (prox) i++;
  }
  const atual = ent[ent.length - 1];
  const anterior = ent[ent.length - 2];
  const linhas = [];
  if (anterior && anterior.papel === 'jarvis' && anterior.interrompido) linhas.push(anterior.texto ? NOTA_INTERROMPIDO : NOTA_INTERROMPIDO_MUDO);
  if (sistemaDoTurno) linhas.push(sistemaDoTurno);
  const sistema = linhas.join('\n');
  msgs.push({ role: 'user', content: [{ type: 'text', text: atual.texto, cache_control: { type: 'ephemeral' } }] });
  if (sistema) msgs.push({ role: 'system', content: sistema });
  return { mensagens: msgs, sistema, atual };
}

export function novoRegistro(atual, sistema) {
  return { julio: atual.texto, julioNorm: norm(atual.texto), sistema, textoTotal: '', totalNorm: '', rounds: [] };
}
export function fecharRegistro(reg) {
  reg.totalNorm = norm(reg.textoTotal);
  reg.limpoNorm = limpoNorm(reg.textoTotal);
  if (reg.rounds.length || reg.textoTotal) guardarRegistro(reg);
}
