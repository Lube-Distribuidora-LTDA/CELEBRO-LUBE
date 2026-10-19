/* Cérebro da Lube — js/jarvis.js  (agente INTERFACE)
   O modo Jarvis (JARVIS.md §3): conversar com o robô por voz e por texto, como com uma pessoa. Estados, voz de ouvir
   (SpeechRecognition) e de falar (speechSynthesis, com fila de frases), interrupção com filtro de eco, segurar Espaço
   para falar, confirmação de ação por voz e por clique, legenda viva, painéis de atividade e de exibição, contexto da
   tela e a ponte com o cérebro. O HUD e a transição ficam no js/jarvis-hud.js.

   O app.js importa este arquivo só ao entrar no modo:  const J = criarJarvis(opts); J.abrir();
   Jarvis = { abrir(), fechar(), alternar(), aberto(), destruir() }
   opts = { raiz (#app), botao, robo: () => robo, reduzido: () => bool, qualidadeBaixa: () => bool,
            contexto: () => ({tela, nota_aberta, rotina_aberta, departamento}), cena: () => ({memorias, rotinas, apps, conexoes, saude}),
            pagina: { ferramentas(), buscarNotas(q, n), lerNota(caminho), verSaude({somente_problemas}), visaoGeral(), nota(nome), rotina(nome) },
            onAbrindo(), onCoberto(bool), onFechou({abrir: {tipo:'nota'|'rotina', nome}|null}) }

   CONTRATO COM OS CÉREBROS (o mesmo para o local e o do link):
     cerebro = { tipo:'local'|'link'|'simulado', disponivel():Promise<{ok, motivo?, voz:boolean}>,
                 turno(conversa, contexto, h):{cancelar()}, decidirAcao(id, 'confirmar'|'recusar'):Promise<{ok, mensagem}> }
     h = { texto(delta), ferramenta({id,nome,rotulo,estado,resumo}), cartao({tipo,dados}), acao({id,tipo,resumo,detalhe}),
           modelo({nome}), fim({motivo}), erro({mensagem}) }
     conversa = [{papel:'julio'|'jarvis', texto, interrompido?:true}]  (o cérebro converte para o formato da API)
   Escolha: em localhost/127.0.0.1 com <meta name="cerebro-token"> → LOCAL (SSE em /api/jarvis/turno com o cabeçalho
   x-cerebro-token; ação em /api/jarvis/acao/:id). No claude.ai (window.claude.use) → LINK, de ./jarvis-link.js, que
   pode exportar criarCerebroLink(opcoes) (ou criarCerebro, default, ou um objeto cerebro); opcoes = { pagina, contexto,
   reduzido }. ?jarvis=simular (só em localhost ou arquivo) → painel de falas simuladas (ouvido de mentira); no app do
   computador quem responde continua sendo o servidor; sem ele, um cérebro de mentira da própria página.
   disponivel() do LOCAL lê GET /api/jarvis/estado (cérebro de teste ou de verdade, banco, e-mail; 401 = app reiniciado).
   Regras: o modelo nunca confirma nada (só o clique ou a frase curta reconhecida aqui chamam decidirAcao); nada de
   segredo em tela ou log; o microfone só fica aberto neste modo, com o ponto vermelho aceso.

   OUVIDO E ROSTO (docs/OUVIDO-E-ROSTO.md, 2026-10-19), só no app do computador (localhost + meta cerebro-token; o link e
   o arquivo único não carregam nada disso):
   - Ouvido: o reconhecimento do Edge 155 devolve texto vazio. Quem ouve agora é um Chrome escondido, ligado pelo servidor
     (js/ouvido-remoto.js, mesma cara do criarOuvido daqui). Padrão: Chrome quando o servidor diz que ele existe; senão o
     do Edge, com o vigia de resultados vazios. Ajustes › Ouvido: "Chrome (offline)" ou "Edge". Sem o pacote de voz
     (409 sem-pacote), a oferta "Baixar o pacote de voz (cerca de 300 MB, uma vez só)".
   - Rosto: na primeira conversa do dia (America/Sao_Paulo), antes do HUD, o portão (js/rosto.js) abre a câmera e
     confere o rosto (ou faz o cadastro, na primeira vez); só depois vem a transição do HUD e a saudação pela hora. Quem
     decide é o servidor: travado, o turno, o confirmar e o ligar do ouvido respondem 423 — e um 423 no meio da conversa
     (virou o dia) abre o portão por cima do HUD e refaz o pedido. Sem ação do Júlio (o vigia do ouvido à meia-noite,
     "Travar agora") o portão mostra só o cartão "Jarvis travado": a câmera liga no clique. Ajustes › Trava do rosto:
     travar, cadastrar de novo, Windows Hello e "Apagar meu cadastro" (trocar ou apagar pede a confirmação de até 5 min). */

import { criarHud, criarSons } from './jarvis-hud.js';
import { limparFala } from './fala.js';

/* ---------- utilidades ---------- */
const PREF = 'cerebro-robo:';
const agora = () => performance.now();
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function lerPref(k, padrao = null) { try { const v = localStorage.getItem(PREF + k); return v === null ? padrao : v; } catch { return padrao; } }
function gravarPref(k, v) { try { localStorage.setItem(PREF + k, v); } catch { /* sem armazenamento */ } }
const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// o hífen sai antes de separar, nos dois lados do filtro de eco: "e-mail" (o que eu digo) e "email" (o que o
// reconhecimento escreve) viram a mesma palavra
const palavrasDe = (s) => norm(s).replace(/-/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ehLocal() {
  try { return /^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname); } catch { return false; }
}
function emArtifact() { try { return !!(window.claude && typeof window.claude.use === 'function'); } catch { return false; } }
function simular() {
  try { return (ehLocal() || location.protocol === 'file:') && /[?&]jarvis=simular\b/.test(location.search); } catch { return false; }
}
function tokenLocal() {
  try { const m = document.querySelector('meta[name="cerebro-token"]'); const v = m && m.getAttribute('content'); return v && v.trim() ? v.trim() : null; } catch { return null; }
}
const ABA = (() => {
  try { if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID().replace(/-/g, '').slice(0, 20); } catch { /* sem crypto */ }
  return `${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
})();
// o vigia do reconhecimento do Edge (vigiarEdge do js/ouvido-remoto.js) troca o construtor da página: um só por página;
// cada Jarvis criado aponta o aviso e o medidor para si
const VIGIA_EDGE = { w: null, aviso: null, nivel: null };
const fmtNum = (n) => { const v = Number(n); return Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 10 ? 2 : Math.abs(v) < 1000 ? 1 : 0 }) : String(n ?? ''); };
const doisDig = (n) => String(n).padStart(2, '0');

// palavras vazias do filtro de eco (JARVIS.md §7.9) e comandos curtos
const VAZIAS = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'que', 'e', 'um', 'uma', 'para', 'pra', 'com', 'nao', 'isso', 'esse', 'essa', 'em', 'no', 'na', 'por', 'se', 'me', 'eu', 'mas', 'tem', 'ele', 'ela', 'voce', 'mais', 'muito', 'foi', 'sim', 'aqui', 'agora', 'entao']);
const SO_PARAR = new Set(['jarvis', 'para', 'pare', 'parar', 'espera', 'espere', 'chega', 'silencio', 'pera', 'perai', 'calma', 'opa',
  'espera ai', 'pera ai', 'calma ai', 'para ai', 'espera um pouco', 'jarvis para', 'jarvis espera', 'jarvis chega', 'para jarvis',
  'espera jarvis', 'jarvis espera ai', 'para para', 'ta bom para']);
// "não, não é isso": interrompe como fala e segue como pergunta (o Júlio vai dizer o que é)
const CORRIGE = new Set(['nao nao', 'nao e isso', 'nao e esse', 'nao e essa', 'nao foi isso', 'errado', 'ta errado', 'esta errado']);
const FECHAR = /^(jarvis )?(pode )?(fechar|fecha|sair|sai|encerrar|encerra|desligar|desliga)( o jarvis| jarvis| o modo jarvis)?$/;
// "pode", "manda" e "envia" sozinhos não confirmam: "Pode… [pausa] …mudar o assunto?" não pode enviar o e-mail
const SIM = new Set(['sim', 'pode sim', 'sim pode', 'confirmo', 'confirma', 'confirmar', 'pode confirmar', 'pode enviar', 'pode mandar', 'sim pode enviar', 'sim pode mandar', 'pode ir', 'confirmado', 'confirmo o envio']);
const NAO = new Set(['nao', 'cancela', 'cancelar', 'cancelado', 'nao envia', 'nao manda', 'nao pode', 'nao pode enviar', 'nao quero', 'negativo', 'cancela o envio', 'nao nao']);
const curto = (t) => palavrasDe(t).filter((w) => w !== 'jarvis' || palavrasDe(t).length === 1).join(' ');
const VAZIO = new Set();
const conteudo = (w) => w.length >= 3 && !VAZIAS.has(w) && !/^\d+$/.test(w);   // palavra que conta (número não: "três mil" vira "3.000")
// distância de edição limitada: "estante" ≈ "instante", "julho" ≈ "julio" (o reconhecimento troca letras do meu eco)
function distAte(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const lin = [i]; let menor = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(ant[j] + 1, lin[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      lin.push(v); if (v < menor) menor = v;
    }
    if (menor > max) return false;
    ant = lin;
  }
  return ant[b.length] <= max;
}
// a palavra veio do que eu disse? igual, no plural, com as mesmas 4 primeiras letras ou com 1 (2 nas longas) letra trocada
function ehEco(w, eco) {
  if (eco.has(w) || (w.endsWith('s') && eco.has(w.slice(0, -1)))) return true;
  if (w.length < 5 || !eco.size) return false;
  const max = w.length >= 7 ? 2 : 1, p4 = w.slice(0, 4);
  for (const e of eco) {
    if (e.length < 4) continue;
    if (e.slice(0, 4) === p4 || distAte(w, e, max)) return true;
  }
  return false;
}

const ROTULO_FERR = {
  buscar_notas: 'Buscando nas notas', ler_nota: 'Lendo a nota', saude_sistemas: 'Conferindo a saúde dos sistemas',
  ver_saude: 'Conferindo a saúde dos sistemas', consultar_dados: 'Consultando o banco', listar_emails: 'Lendo a caixa cpd@',
  ler_email: 'Abrindo o e-mail', preparar_email: 'Preparando o e-mail', buscar_arquivos: 'Procurando arquivos',
  ler_arquivo: 'Lendo o arquivo', delegar: 'Análise mais funda', web_search: 'Pesquisando na internet',
  mostrar_na_tela: 'Mostrando na tela'
};
const ESTADO_ROT = {
  repouso: 'Pronto', ouvindo: 'Ouvindo', pensando: 'Processando', falando: 'Falando', interrompido: 'Interrompido',
  confirmando: 'Aguardando confirmação', 'sem-conexao': 'Sem conexão', travado: 'Travado'
};

/* =============================================================================
   Voz — falar. Interface: { tipo, falar(frase, {inicio, palavra(charIndex, len), fim}), parar(), falando(),
   configurar({rate, pitch, volume}), cps } — para trocar por Azure ou ElevenLabs depois sem mexer no resto.
   ============================================================================= */
const MASCULINAS = /antonio|donato|fabio|humberto|julio|nicolau|valerio|leandro|daniel|duarte/;
function vozesPt() {
  try {
    const todas = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    return todas.filter((v) => v && v.name && !/undefined/i.test(v.name) && !/undefined/i.test(v.lang || '') && /^pt([-_](br|pt))?$/i.test(v.lang || ''));
  } catch { return []; }
}
// prioridade (JARVIS.md §7.7): Antônio natural → outra natural pt-BR masculina → natural pt-BR → qualquer pt-BR → Duarte (pt-PT) → nenhuma
function escolherVoz(lista, uri) {
  if (uri) { const s = lista.find((v) => v.voiceURI === uri || v.name === uri); if (s) return s; }
  const n = (v) => norm(v.name), br = lista.filter((v) => /^pt[-_]br$/i.test(v.lang || ''));
  return br.find((v) => n(v).includes('antonio') && n(v).includes('natural'))
    || br.find((v) => n(v).includes('natural') && MASCULINAS.test(n(v)))
    || br.find((v) => n(v).includes('natural'))
    || br.find((v) => MASCULINAS.test(n(v)))
    || br[0]
    || lista.find((v) => /^pt[-_]pt$/i.test(v.lang || '') && n(v).includes('duarte'))
    || null;
}
const nomeCurto = (v) => (v ? String(v.name).replace(/^Microsoft\s+/i, '').replace(/\s+Online.*$/i, '').replace(/\s*\(.*$/, '').replace(/\s+-\s+.*$/, '').trim() : '');

function criarVozNavegador(voz) {
  const ss = window.speechSynthesis;
  let rate = 1.05, pitch = 0.92, volume = 1, cps = 14, ger = 0, n = 0;
  const vivas = new Set();   // referência a cada fala até o fim (prática defensiva do Chromium)
  function falar(texto, h = {}) {
    const item = { ger, iniciou: false, t0: 0 };
    let u;
    try { u = new SpeechSynthesisUtterance(texto); } catch { h.fim && h.fim({ erro: 'sem-voz' }); return item; }
    if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = 'pt-BR';
    u.rate = rate; u.pitch = pitch; u.volume = volume;
    u.onstart = () => { if (item.ger !== ger) return; item.iniciou = true; item.t0 = agora(); h.inicio && h.inicio(); };
    u.onboundary = (e) => { if (item.ger !== ger) return; if (e.name && e.name !== 'word') return; h.palavra && h.palavra(e.charIndex | 0, e.charLength | 0); };
    const acabar = (erro) => {
      vivas.delete(u);
      if (item.ger !== ger) return;
      n = Math.max(0, n - 1);
      if (item.iniciou && !erro) {   // recalibra o relógio da voz com a duração real da frase (média móvel)
        const d = (agora() - item.t0) / 1000;
        if (d > 0.4 && texto.length > 12) cps = cps * 0.7 + Math.max(7, Math.min(28, texto.length / d / rate)) * 0.3;
      }
      h.fim && h.fim(erro ? { erro } : {});
    };
    u.onend = () => acabar(null);
    u.onerror = (e) => acabar((e && e.error) || 'erro');
    vivas.add(u); n++;
    try { ss.speak(u); } catch { acabar('erro'); }
    return item;
  }
  function parar() { ger++; n = 0; try { ss.cancel(); } catch { /* nada */ } }
  return {
    tipo: 'navegador', vozObj: voz, falar, parar, falando: () => n > 0,
    configurar(o = {}) { if (Number.isFinite(o.rate)) rate = o.rate; if (Number.isFinite(o.pitch)) pitch = o.pitch; if (Number.isFinite(o.volume)) volume = o.volume; },
    get cps() { return cps * rate; }, get nome() { return nomeCurto(voz); }
  };
}
// sem voz (sem internet, sem vozes em português, mudo): o mesmo relógio de palavras, sem som — a legenda segue sozinha
function criarVozRelogio(base = 15) {
  let ger = 0, fila = [], atual = null, timer = 0, mult = 1;
  function proximo() {
    if (atual || !fila.length) return;
    const item = fila.shift();
    atual = item; item.t0 = agora();
    item.h.inicio && item.h.inicio();
    const marcas = []; const re = /\S+/g; let m;
    while ((m = re.exec(item.texto))) marcas.push(m.index);
    let k = 0;
    const tick = () => {
      if (item.ger !== ger) return;
      const ci = ((agora() - item.t0) / 1000) * base * mult;
      while (k < marcas.length && marcas[k] <= ci) { item.h.palavra && item.h.palavra(marcas[k], 0); k++; }
      if (ci >= item.texto.length + 2) {
        atual = null; item.h.fim && item.h.fim({});
        timer = setTimeout(proximo, 160);
        return;
      }
      timer = setTimeout(tick, 40);
    };
    tick();
  }
  function falar(texto, h = {}) { const item = { texto, h, ger }; fila.push(item); proximo(); return item; }
  function parar() { ger++; fila = []; atual = null; clearTimeout(timer); }
  return {
    tipo: 'relogio', falar, parar, falando: () => !!atual || fila.length > 0,
    configurar(o = {}) { if (Number.isFinite(o.rate)) mult = o.rate; }, get cps() { return base * mult; }, nome: ''
  };
}

/* =============================================================================
   Ouvido — SpeechRecognition (pt-BR, contínuo, parciais) + o microfone para o medidor e a onda.
   h = { parcial(texto), final(texto), estado('ouvindo'|'parado'), erro(codigo) }
   ============================================================================= */
function criarOuvido(h, sons) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const O = { suportado: !!SR, ativo: false, ouvindo: false };
  let rec = null, querLigado = false, iniciando = false, semResultado = 0, tReinicio = 0, resultadoEm = 0, tInicio = 0, ultimoErro = '';
  let stream = null, trilha = null, usarTrilha = true, analisador = null, fonte = null, freq = null, tempo = null, vigiaTrilha = 0;
  const bandas = new Float32Array(64);
  const saidaNivel = { bandas, db: -90 };   // o laço lê a cada quadro: o mesmo objeto, sem alocar
  function criar() {
    const r = new SR();
    r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onstart = () => { iniciando = false; O.ouvindo = true; tInicio = agora(); ultimoErro = ''; h.estado && h.estado('ouvindo'); };
    r.onresult = (e) => {
      semResultado = 0; resultadoEm = agora();
      let fin = '', parc = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i], t = (res[0] && res[0].transcript) || '';
        if (res.isFinal) fin += ` ${t}`; else parc += ` ${t}`;
      }
      if (fin.trim()) h.final && h.final(fin.trim());
      h.parcial && h.parcial(parc.trim());
    };
    r.onerror = (e) => {
      const c = e && e.error;
      ultimoErro = c || 'erro';
      if (c === 'no-speech' || c === 'aborted') return;   // reinicia calado
      if (c === 'not-allowed' || c === 'service-not-allowed' || c === 'audio-capture') { querLigado = false; h.erro && h.erro(c); return; }
      if (c === 'network') { h.erro && h.erro('network'); return; }
      h.erro && h.erro(c || 'erro');
    };
    r.onend = () => {
      iniciando = false; O.ouvindo = false;
      if (!querLigado) { h.estado && h.estado('parado'); return; }
      // o Edge encerra a sessão depois de um silêncio (no-speech), mesmo contínuo: volta em 150 ms, sem recuo (senão o
      // microfone fica surdo boa parte do tempo e perde o começo do "Jarvis, …"). O recuo 0,5 → 1 → 2 → 4 s fica para
      // sessões que morrem em menos de 1 s, em sequência, e para erro de rede
      const curta = agora() - tInicio < 1000;
      if (ultimoErro === 'network' || (curta && ultimoErro !== 'no-speech' && ultimoErro !== 'aborted')) semResultado++;
      else semResultado = 0;
      const atraso = semResultado ? [500, 1000, 2000, 4000][Math.min(3, semResultado - 1)] : 150;
      clearTimeout(tReinicio);
      tReinicio = setTimeout(iniciarRec, atraso);
    };
    return r;
  }
  function iniciarRec() {
    if (!querLigado || iniciando || O.ouvindo || !SR) return;
    if (!rec) rec = criar();
    iniciando = true;
    try {
      // start(track): o reconhecimento ouve a trilha com cancelamento de eco (experimental); se não der, start() comum
      if (usarTrilha && trilha && trilha.readyState === 'live') {
        try { rec.start(trilha); } catch (err) { usarTrilha = false; rec.start(); }
      } else rec.start();
    } catch (err) {
      iniciando = false;
      if (err && err.name === 'InvalidStateError') return;   // já estava ligado
      clearTimeout(tReinicio); tReinicio = setTimeout(iniciarRec, 1000);
    }
  }
  async function abrirMicrofone() {
    if (stream) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      const n = err && err.name;
      throw Object.assign(new Error('microfone'), { codigo: n === 'NotAllowedError' || n === 'SecurityError' ? 'negado' : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'sem-microfone' : n === 'NotReadableError' ? 'em-uso' : 'erro' });
    }
    trilha = stream.getAudioTracks()[0] || null;
    try {
      const ctx = sons.contexto();
      if (ctx) {
        fonte = ctx.createMediaStreamSource(stream);
        analisador = ctx.createAnalyser(); analisador.fftSize = 512; analisador.smoothingTimeConstant = 0.6;
        fonte.connect(analisador);
        freq = new Uint8Array(analisador.frequencyBinCount); tempo = new Float32Array(analisador.fftSize);
      }
    } catch { analisador = null; }
    return true;
  }
  function fecharMicrofone() {
    try { fonte && fonte.disconnect(); } catch { /* nada */ }
    fonte = null; analisador = null;
    if (stream) { try { stream.getTracks().forEach((t) => t.stop()); } catch { /* nada */ } }
    stream = null; trilha = null;
  }
  async function ligar() {
    if (!SR) throw Object.assign(new Error('sem reconhecimento'), { codigo: 'sem-suporte' });
    querLigado = true; O.ativo = true; semResultado = 0;
    try { await abrirMicrofone(); } catch (err) { querLigado = false; O.ativo = false; throw err; }
    if (!querLigado) { fecharMicrofone(); return; }
    iniciarRec();
    // vigia do start(track): nível alto por bastante tempo e nenhum resultado em 4 s → volta para o start() comum
    clearInterval(vigiaTrilha);
    let alto = 0, desde = agora();
    vigiaTrilha = setInterval(() => {
      if (!querLigado || !usarTrilha || !trilha) { clearInterval(vigiaTrilha); return; }
      const n = nivel();
      if (n && n.db > -38) alto += 250;
      if (resultadoEm > desde) { clearInterval(vigiaTrilha); return; }
      if (agora() - desde > 4000 && alto > 1500) {
        usarTrilha = false; clearInterval(vigiaTrilha);
        try { rec && rec.abort(); } catch { /* reinicia no onend */ }
      }
    }, 250);
  }
  function pausar() {
    querLigado = false; O.ativo = false;
    clearTimeout(tReinicio); clearInterval(vigiaTrilha);
    try { rec && rec.abort(); } catch { /* nada */ }
    O.ouvindo = false;
    fecharMicrofone();
  }
  // nível do microfone: 64 bandas (0..1) e o volume em dB
  function nivel() {
    if (!analisador) return null;
    analisador.getByteFrequencyData(freq);
    const nb = freq.length;
    for (let i = 0; i < 64; i++) {
      // faixas de 80 Hz a ~6 kHz em escala quase logarítmica (onde a voz mora)
      const a = Math.floor(2 + Math.pow(i / 64, 1.6) * (nb * 0.55)), b = Math.max(a + 1, Math.floor(2 + Math.pow((i + 1) / 64, 1.6) * (nb * 0.55)));
      let s = 0; for (let k = a; k < b && k < nb; k++) s += freq[k];
      bandas[i] = Math.min(1, (s / (b - a) / 255) * 1.35);
    }
    analisador.getFloatTimeDomainData(tempo);
    let q = 0; for (let i = 0; i < tempo.length; i++) q += tempo[i] * tempo[i];
    saidaNivel.db = 20 * Math.log10(Math.sqrt(q / tempo.length) + 1e-9);
    return saidaNivel;
  }
  O.ligar = ligar; O.pausar = pausar; O.nivel = nivel;
  O.destruir = pausar;
  return O;
}

/* =============================================================================
   Cérebro LOCAL — o app do computador (servidor/ em 127.0.0.1:8790): POST /api/jarvis/turno → SSE
   ============================================================================= */
// o servidor gera um token novo a cada partida: a página aberta antes de reiniciar o app tem o velho
const REINICIADO = 'O app do cérebro foi reiniciado. Recarregue a página (F5) e fale de novo.';
function criarCerebroLocal(token) {
  const cab = () => ({ 'content-type': 'application/json', 'x-cerebro-token': token });
  return {
    tipo: 'local',
    // GET /api/jarvis/estado: o que está ligado neste computador (cérebro de verdade ou de teste, banco, e-mail)
    async disponivel() {
      let r;
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
        try { r = await fetch('/api/jarvis/estado', { headers: { 'x-cerebro-token': token }, cache: 'no-store', signal: ctl.signal }); } finally { clearTimeout(t); }
      } catch { return { ok: false, voz: true, motivo: 'O app do cérebro não respondeu. Ele ainda está ligado? Abra pelo INICIAR.bat.' }; }
      if (r.status === 401) return { ok: false, voz: true, motivo: REINICIADO };
      let e = {};
      try { e = await r.json(); } catch { e = {}; }
      if (!r.ok) return { ok: false, voz: true, motivo: `O app do cérebro respondeu ${r.status}.` };
      const cx = e.conexoes || {}, simulado = e.modo === 'simulado';
      const faltam = [!cx.banco && 'o banco', !(cx.email_leitura || cx.email_envio) && 'o e-mail'].filter(Boolean);
      // uma frase só, dita uma vez na entrada: o que não está ligado aqui
      const motivo = simulado
        ? 'Estou com o cérebro de teste: respondo com frases prontas, mas as notas e a saúde são de verdade.'
        : faltam.length ? `${faltam.join(' e ').replace(/^./, (c) => c.toUpperCase())} ainda não ${faltam.length > 1 ? 'estão' : 'está'} no ENV deste computador.` : undefined;
      // a trava do rosto e o ouvido (o Chrome escondido): o que o servidor sabe agora
      return { ok: true, voz: true, simulado, motivo, conexoes: cx, trava: e.trava || null, ouvido: e.ouvido || null };
    },
    turno(conversa, contexto, h) {
      const ctl = new AbortController();
      let acabou = false, tPrazo = 0, estourou = false;
      const terminar = (d) => { if (acabou) return; acabou = true; h.fim && h.fim(d || { motivo: 'fim' }); };
      const falhar = (mensagem) => { if (acabou) return; acabou = true; h.erro && h.erro({ mensagem }); };
      function despachar(bloco) {
        let ev = 'message'; const dados = [];
        for (const linha of bloco.split(/\r?\n/)) {
          if (!linha || linha.startsWith(':')) continue;
          const k = linha.indexOf(':'), campo = k < 0 ? linha : linha.slice(0, k);
          let val = k < 0 ? '' : linha.slice(k + 1);
          if (val.startsWith(' ')) val = val.slice(1);
          if (campo === 'event') ev = val; else if (campo === 'data') dados.push(val);
        }
        if (!dados.length && ev === 'message') return;
        let d = {};
        try { d = dados.length ? JSON.parse(dados.join('\n')) : {}; } catch { d = {}; }
        if (acabou || ctl.signal.aborted) return;
        switch (ev) {
          case 'texto': h.texto && h.texto(String(d.delta ?? '')); break;
          case 'ferramenta': h.ferramenta && h.ferramenta(d); break;
          case 'cartao': h.cartao && h.cartao(d); break;
          case 'acao': h.acao && h.acao(d); break;
          case 'modelo': h.modelo && h.modelo(d); break;
          case 'fim': terminar(d); break;
          case 'erro': falhar(String(d.mensagem || 'O cérebro não conseguiu responder.')); break;
          default: break;
        }
      }
      (async () => {
        let resp;
        // até 20 s pela resposta (o servidor manda o primeiro byte na hora): sem isso, uma fila de conexões presas deixava o
        // HUD em "pensando" para sempre
        tPrazo = setTimeout(() => { estourou = true; try { ctl.abort(); } catch { /* nada */ } }, 20000);
        try {
          resp = await fetch('/api/jarvis/turno', { method: 'POST', headers: { ...cab(), accept: 'text/event-stream' }, body: JSON.stringify({ conversa, contexto }), signal: ctl.signal, cache: 'no-store' });
        } catch (err) {
          clearTimeout(tPrazo);
          if (estourou && !acabou) { falhar('O app do cérebro não respondeu. Ele ainda está ligado? Abra pelo INICIAR.bat.'); return; }
          if (ctl.signal.aborted) return;
          falhar('Não consegui falar com o app do cérebro. Ele ainda está ligado?');
          return;
        }
        clearTimeout(tPrazo);
        if (resp.status === 401) { falhar(REINICIADO); return; }
        // 423: a trava do rosto fechou (virou o dia, "Travar agora"): quem chamou abre o portão e refaz o pedido
        if (resp.status === 423 && typeof h.trava === 'function') { if (!acabou) { acabou = true; h.trava(); } return; }
        if (!resp.ok || !resp.body) {
          let msg = '';
          try { const j = await resp.json(); msg = j && (j.mensagem || j.erro) ? String(j.mensagem || j.erro) : ''; } catch { /* sem corpo */ }
          falhar(msg || (resp.status === 403 ? 'O app do cérebro recusou o pedido. Recarregue a página.' : `O app do cérebro respondeu ${resp.status}.`));
          return;
        }
        const leitor = resp.body.getReader(), dec = new TextDecoder();
        let buf = '';
        try {
          for (;;) {
            const { value, done } = await leitor.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let m;
            while ((m = /\r?\n\r?\n/.exec(buf))) { const bloco = buf.slice(0, m.index); buf = buf.slice(m.index + m[0].length); despachar(bloco); }
          }
          buf += dec.decode();
          if (buf.trim()) despachar(buf);
        } catch (err) {
          if (ctl.signal.aborted) return;
          falhar('A conexão com o cérebro caiu no meio da resposta.');
          return;
        }
        if (!ctl.signal.aborted) terminar({ motivo: 'fim' });
      })();
      return { cancelar() { acabou = true; clearTimeout(tPrazo); try { ctl.abort(); } catch { /* nada */ } } };
    },
    // motivo (só na recusa automática): 'substituida' | 'expirou' | 'saiu' — o servidor conta ao modelo o motivo certo
    async decidirAcao(id, decisao, motivo) {
      try {
        const corpo = motivo && decisao === 'recusar' ? { decisao, motivo } : { decisao };
        const r = await fetch(`/api/jarvis/acao/${encodeURIComponent(id)}`, { method: 'POST', headers: cab(), body: JSON.stringify(corpo), cache: 'no-store' });
        if (r.status === 401) return { ok: false, mensagem: REINICIADO };
        let j = {};
        try { j = await r.json(); } catch { j = {}; }
        if (r.status === 423) return { ok: false, trava: true, mensagem: String(j.mensagem || 'O Jarvis está travado. Faça o reconhecimento do rosto.') };
        return { ok: r.ok && j.ok !== false, mensagem: String(j.mensagem || (r.ok ? '' : r.status === 404 ? 'Esse pedido já expirou.' : `O app do cérebro respondeu ${r.status}.`)) };
      } catch { return { ok: false, mensagem: 'Não consegui falar com o app do cérebro.' }; }
    }
  };
}

/* =============================================================================
   Cérebro SIMULADO (?jarvis=simular, só em localhost ou arquivo): frases fixas, mesmos eventos, dados de verdade da página
   ============================================================================= */
function criarCerebroSimulado(pagina) {
  let nAcao = 0, nConversa = 0;
  // como o Claude: cada trecho sai sem espaço no fim, e o espaço vem no começo do trecho seguinte
  const fatiar = (s) => (String(s).match(/\s*\S+/g) || []).reduce((acc, w, i) => { if (i % 2 === 0) acc.push(w); else acc[acc.length - 1] += w; return acc; }, []);
  function roteiroNota(fala, ctx) {
    const n = norm(fala), passos = [];
    const t = (texto, espera = 0) => passos.push({ espera, texto });
    const ev = (nome, dados, espera = 0) => passos.push({ espera, ev: nome, dados });
    const essa = ctx && ctx.nota_aberta && /essa|esta|isso/.test(n);
    const termo = essa ? ctx.nota_aberta : (fala.replace(/.*\b(nota|sobre|leia|ler|le pra mim)\b\s*(a |o |sobre |de |do |da )?/i, '').replace(/[?.!]+$/, '').trim() || fala);
    t('Deixa eu procurar nas notas. ', 300);
    ev('ferramenta', { id: 'n1', nome: 'buscar_notas', rotulo: 'Buscando nas notas', estado: 'inicio' }, 120);
    const achadas = (pagina && pagina.buscarNotas && pagina.buscarNotas(termo, 5)) || [];
    ev('ferramenta', { id: 'n1', nome: 'buscar_notas', estado: 'fim', resumo: achadas.length ? `${achadas.length} ${achadas.length === 1 ? 'nota' : 'notas'} sobre “${termo}”` : 'nenhuma nota' }, 700);
    if (achadas[0]) {
      ev('ferramenta', { id: 'n2', nome: 'ler_nota', rotulo: 'Lendo a nota', estado: 'inicio' }, 120);
      ev('ferramenta', { id: 'n2', nome: 'ler_nota', estado: 'fim', resumo: achadas[0].nome }, 500);
      ev('cartao', { tipo: 'nota', dados: { nome: achadas[0].nome } }, 150);
      const info = pagina && pagina.nota ? pagina.nota(achadas[0].nome) : null;
      const tr = limparFala(String((info && info.trecho) || '')).split(/(?<=[.!?])\s/)[0] || '';
      t(`Achei a nota ${achadas[0].nome}. ${tr ? `Ela diz assim: ${tr.slice(0, 160)}${tr.length > 160 ? '…' : ''} ` : ''}Quando você sair daqui, ela abre no leitor. `, 250);
    } else t('Não achei nenhuma nota sobre isso. Se quiser, eu digo em que pasta ela deveria ficar. ', 250);
    return passos;
  }
  function roteiro(fala, ctx, conversa) {
    const n = norm(fala), passos = [];
    const t = (texto, espera = 0) => passos.push({ espera, texto });
    const ev = (nome, dados, espera = 0) => passos.push({ espera, ev: nome, dados });
    ev('modelo', { nome: 'haiku' });
    if (/saude|rodou|rodaram|rotinas|cargas?|guardiao|falha|tudo (em dia|rodando|certo)/.test(n)) {
      t('Um instante, vou conferir o Guardião. ', 380);
      ev('ferramenta', { id: 's1', nome: 'saude_sistemas', rotulo: 'Conferindo a saúde dos sistemas', estado: 'inicio' }, 120);
      const r = (pagina && pagina.verSaude && pagina.verSaude({})) || {};
      const g = r.geral || null;
      ev('ferramenta', { id: 's1', nome: 'saude_sistemas', estado: 'fim', resumo: g ? `${g.em_dia} em dia · ${g.atencao} atenção · ${g.falha} falha` : 'sem leitura nesta página' }, 900);
      if (g) {
        ev('cartao', { tipo: 'destaque', dados: { valor: `${g.em_dia} de ${g.total}`, rotulo: 'em dia agora', detalhe: g.falha ? `${g.falha} com falha` : g.atencao ? `${g.atencao} com atenção` : 'nenhum alarme aberto' } }, 150);
        t(g.falha ? `Temos ${g.falha === 1 ? 'uma falha aberta' : `${g.falha} falhas abertas`}. O resto está em dia. Quer que eu mostre qual foi? ` : g.atencao ? `Quase tudo em dia: ${g.em_dia} de ${g.total}. ${g.atencao === 1 ? 'Uma rotina pede atenção' : `${g.atencao} pedem atenção`}, nada parado. ` : `Tudo em dia, Júlio. ${g.em_dia} de ${g.total} conferidos, nenhum alarme. Pode tomar o café tranquilo. `, 250);
      } else {
        ev('cartao', { tipo: 'lista', dados: { titulo: 'Saúde (simulador)', itens: ['A saúde não foi lida nesta página', 'No app do computador ela vem do Guardião'] } }, 150);
        t('Nesta página a saúde ainda não foi lida, então não vou chutar. No app do computador eu leio direto do Guardião. ', 250);
      }
    } else if (/e-?mail|caixa|cpd/.test(n)) {
      if (/(responde|responda|manda|mande|envia|envie|escreve|escreva)/.test(n)) {
        t('Certo. Vou preparar a resposta. ', 350);
        ev('ferramenta', { id: 'e2', nome: 'preparar_email', rotulo: 'Preparando o e-mail', estado: 'inicio' }, 100);
        ev('ferramenta', { id: 'e2', nome: 'preparar_email', estado: 'fim', resumo: 'rascunho pronto' }, 800);
        nAcao++;
        ev('acao', { id: `sim-${nAcao}`, tipo: 'enviar_email', resumo: 'Responder ao Fornecedor Exemplo: “Recebido, obrigado.”', detalhe: { para: 'financeiro@fornecedor-exemplo.com.br', assunto: 'Re: Boleto de outubro (exemplo)', corpo: 'Recebido, obrigado. O pagamento entra na programação desta semana. Júlio — TI Lube' } }, 120);
        t('A resposta para o Fornecedor Exemplo está na tela: recebido, obrigado, pagamento nesta semana. Só envio quando você confirmar. ', 200);
      } else {
        t('Um instante, vou olhar a caixa. ', 300);
        ev('ferramenta', { id: 'e1', nome: 'listar_emails', rotulo: 'Lendo a caixa cpd@', estado: 'inicio' }, 120);
        ev('ferramenta', { id: 'e1', nome: 'listar_emails', estado: 'fim', resumo: '3 novos (exemplo)' }, 1100);
        ev('cartao', { tipo: 'email', dados: { de: 'Fornecedor Exemplo', assunto: 'Boleto de outubro (exemplo)', quando: 'hoje 09:12', resumo: 'Manda o boleto de outubro e pede confirmação do recebimento.' } }, 150);
        t('Três novos desde ontem à noite. O que importa é o do Fornecedor Exemplo, com o boleto de outubro; os outros dois são avisos automáticos. Quer que eu responda confirmando o recebimento? ', 250);
      }
    } else if (/\bnota\b|le pra mim|leia\b/.test(n) && !/venda|faturamento/.test(n)) {
      passos.push(...roteiroNota(fala, ctx));
    } else if (/venda|vendas|compras|quanto|numero|faturamento|filial/.test(n) && !/analis|compar|por que|porque|tendencia|explica/.test(n)) {
      t('Vou consultar o banco. ', 320);
      ev('ferramenta', { id: 'd1', nome: 'consultar_dados', rotulo: 'Consultando o banco', estado: 'inicio' }, 120);
      ev('ferramenta', { id: 'd1', nome: 'consultar_dados', estado: 'fim', resumo: '5 linhas (exemplo)' }, 1000);
      ev('cartao', { tipo: 'barras', dados: { titulo: 'Venda por filial · exemplo', itens: [{ rotulo: 'Filial 1', valor: 412300 }, { rotulo: 'Filial 7', valor: 268900 }, { rotulo: 'Filial 10', valor: 197450 }, { rotulo: 'Filial 11', valor: 131200 }, { rotulo: 'Filial 12', valor: 88750 }] } }, 150);
      ev('cartao', { tipo: 'tabela', dados: { titulo: 'Resumo · exemplo', colunas: ['Filial', 'Venda', 'Margem'], linhas: [['1', '412.300', '18,2%'], ['7', '268.900', '16,9%'], ['10', '197.450', '17,4%']] } }, 120);
      t('Isto é o simulador, então os números são de exemplo. A filial um puxa a fila, com pouco mais de quatrocentos mil; a doze fecha com oitenta e oito mil. ', 260);
    } else if (/analis|compar|por que|porque|tendencia|explica/.test(n)) {
      t('Essa pede uma análise mais funda. Vou passar para o modelo maior. ', 350);
      ev('ferramenta', { id: 'g1', nome: 'delegar', rotulo: 'Análise mais funda', estado: 'inicio' }, 150);
      ev('modelo', { nome: 'sonnet' }, 50);
      ev('ferramenta', { id: 'g1', nome: 'delegar', estado: 'fim', resumo: 'análise pronta' }, 2600);
      ev('modelo', { nome: 'haiku' }, 50);
      t('Pronto. Resumindo em uma frase: a queda veio de duas filiais, não da linha inteira. Quer o detalhe na tela? ', 150);
    } else if (/sobre|ler\b/.test(n) || (ctx && ctx.nota_aberta && /essa|esta|isso/.test(n))) {
      passos.push(...roteiroNota(fala, ctx));
    } else if (/rotina|funil|fluxo/.test(n)) {
      const nome = (ctx && ctx.rotina_aberta) || (pagina && pagina.primeiraRotina && pagina.primeiraRotina()) || '';
      if (nome) { ev('cartao', { tipo: 'rotina', dados: { nome } }, 300); t(`Coloquei o fluxo da rotina ${nome} na tela. Quando você sair, o funil abre com ela. `, 200); }
      else t('Não encontrei rotinas neste vault. ', 300);
    } else if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai)\b/.test(n)) {
      t('Olá, Júlio. Tudo em ordem por aqui. O que vamos ver? ', 450);
    } else if (/obrigad|valeu/.test(n)) {
      t('Por nada. Estou por aqui. ', 400);
    } else {
      nConversa++;
      const ctxTxt = ctx && ctx.nota_aberta ? ` Você está com a nota ${ctx.nota_aberta} aberta, se quiser que eu leia.` : '';
      const falas = [
        `Claro. Eu sou o simulador do Jarvis, então respondo com frases fixas, mas a fila de frases, a legenda e o corte funcionam como com o cérebro de verdade. Fale por cima de mim quando quiser: eu paro na hora e respondo ao que você disse. Se for só o eco do alto-falante, eu sigo em frente sem me atrapalhar.${ctxTxt} `,
        'Entendi. Uma coisa de cada vez: primeiro eu respondo o que você perguntou, depois ofereço o próximo passo em uma frase. Sem listas, sem markdown, do jeito que se fala. E se eu não souber, digo que não sei. ',
        'Boa pergunta. Para essa eu precisaria do cérebro de verdade, com a chave do Claude no app do computador. Aqui no simulador eu só finjo que penso, o que, convenhamos, já é mais do que muita reunião. '
      ];
      t(falas[(nConversa - 1) % falas.length], 500);
    }
    return passos;
  }
  return {
    tipo: 'simulado',
    async disponivel() { return { ok: true, voz: true }; },
    turno(conversa, contexto, h) {
      let cancelado = false;
      const ultima = [...conversa].reverse().find((m) => m.papel === 'julio');
      const passos = roteiro(ultima ? ultima.texto : '', contexto || {}, conversa);
      (async () => {
        let falou = false;
        for (const p of passos) {
          if (cancelado) return;
          if (p.espera) await esperar(p.espera);
          if (cancelado) return;
          if (p.texto != null) {
            const txt = `${falou ? ' ' : ''}${String(p.texto).trim()}`; falou = true;
            for (const pedaco of fatiar(txt)) { if (cancelado) return; h.texto(pedaco); await esperar(30 + Math.random() * 45); }
            continue;
          }
          h[p.ev] && h[p.ev](p.dados);
        }
        if (!cancelado) h.fim({ motivo: 'fim' });
      })();
      return { cancelar() { cancelado = true; } };
    },
    async decidirAcao(id, decisao) {
      await esperar(650);
      return decisao === 'confirmar'
        ? { ok: true, mensagem: 'Pronto, enviado. No simulador nada sai de verdade.' }
        : { ok: true, mensagem: 'Cancelado. Nada foi enviado.' };
    }
  };
}

async function carregarCerebroLink(opcoes) {
  const mod = await import('./jarvis-link.js');
  const f = mod.criarCerebroLink || mod.criarCerebro || mod.default;
  const c = typeof f === 'function' ? await f(opcoes) : (mod.cerebro || null);
  if (!c || typeof c.turno !== 'function') throw new Error('jarvis-link.js sem cérebro');
  return c;
}

/* =============================================================================
   Marcação do modo
   ============================================================================= */
const ICO = {
  mic: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  micOff: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 9.3V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.9 2.3M5.5 11a6.5 6.5 0 0 0 10.6 5M18.4 12.6A6.5 6.5 0 0 0 18.5 11M12 17.5V21M3.5 3.5l17 17"/></svg>',
  som: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="so-som" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/><path class="so-mudo" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  ajustes: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>',
  fechar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  enviar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
  parar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
  logo: '<svg class="logo" viewBox="40 20 790 575" aria-hidden="true"><g class="logo-g"><path class="logo-l" d="M165 30L400 30L295 435L740 435L705 580L230 580Q48 580 72 410Z"/><path class="logo-r" d="M430 30L650 30Q822 34 795 188L748 410L335 410Z"/></g></svg>'
};
const CANTOS = '<span class="canto ce" aria-hidden="true"></span><span class="canto cd" aria-hidden="true"></span><span class="canto be" aria-hidden="true"></span><span class="canto bd" aria-hidden="true"></span>';
// o que dizer na tela de ligar o microfone e nos ajustes, conforme quem ouve (OUVIDO-E-ROSTO.md §8)
const CONSENT_EDGE = `<p>Para conversar por voz eu uso o reconhecimento de fala do navegador. No Edge, o áudio do microfone vai para o serviço de fala da Microsoft e volta como texto. As vozes “Online” também mandam o texto que eu falo.</p>
        <p>O microfone só fica aberto no modo Jarvis, com o ponto vermelho aceso. <b>Use fone de ouvido</b>: com alto-falante eu posso me ouvir.</p>`;
const CONSENT_CHROME = `<p>O reconhecimento de voz agora roda neste computador, no Google Chrome, sem internet. A primeira vez ele baixa um pacote de voz (cerca de 300 MB). O Windows vai mostrar que o Chrome está usando o microfone.</p>
        <p>A voz do Jarvis (Edge) manda o texto para a Microsoft virar áudio, e o que você fala vai para a API do Claude virar resposta. O microfone só fica aberto no modo Jarvis, com o ponto vermelho aceso. <b>Use fone de ouvido</b>: com alto-falante eu posso me ouvir.</p>`;
const PRIV_EDGE = 'No Edge, o reconhecimento de voz manda o áudio do microfone para o serviço de fala da Microsoft e recebe o texto de volta. As vozes “Online” também mandam o texto que eu falo. O microfone só fica aberto no modo Jarvis, com o ponto vermelho aceso.';
const PRIV_CHROME = 'Quem ouve é um Google Chrome escondido, neste computador, sem internet: o áudio do microfone não sai daqui. O texto que você fala vai para a API do Claude virar resposta, e as vozes “Online” do Edge mandam o texto que eu falo para a Microsoft. O microfone só fica aberto no modo Jarvis, com o ponto vermelho aceso.';
function marcacao() {
  return `
  <div class="jv-veu" aria-hidden="true"></div>
  <div class="jv-fundo" aria-hidden="true"></div>
  <div class="jv-cena" aria-hidden="true"><canvas class="jv-canvas"></canvas></div>
  <div class="jv-leituras" aria-hidden="true">
    <p class="jv-l jv-l-se"><span><i class="jv-dig">CÉREBRO DA LUBE</i></span><span><b data-l="hora">--:--:--</b> <i class="jv-dig" data-l="data"></i></span></p>
    <p class="jv-l jv-l-sd"><span><i class="jv-dig">ESTADO</i> <b data-l="estado">PRONTO</b></span><span><i class="jv-dig">MODELO</i> <b data-l="modelo">HAIKU</b></span></p>
    <p class="jv-l jv-l-ie"><span><i class="jv-dig">RESPOSTA</i> <b data-l="resposta">—</b></span><span><i class="jv-dig">FERRAMENTAS</i> <b data-l="ferramentas">0</b></span></p>
    <p class="jv-l jv-l-id"><span><i class="jv-dig">MIC</i> <b data-l="mic">DESLIGADO</b></span><span><i class="jv-dig">VOZ</i> <b data-l="voz">—</b></span></p>
  </div>
  <div class="jv-grao" aria-hidden="true"></div>
  <div class="jv-moldura" aria-hidden="true">${CANTOS}</div>
  <button class="jv-nucleo" type="button" aria-label="Segure para falar com o Jarvis" title="Segure para falar (ou Espaço)"></button>
  <header class="jv-topo">
    <div class="jv-marca">${ICO.logo}<h2 id="jvTitulo">Jarvis <span>da Lube</span></h2>
      <p class="jv-chip" data-estado="repouso"><i aria-hidden="true"></i><span class="jv-chip-txt">Pronto</span></p></div>
    <p class="jv-contexto" hidden></p>
    <div class="jv-botoes">
      <button class="btn icone jv-mudo" type="button" aria-pressed="false" aria-label="Sem som" title="Sem som (voz e sons do HUD)">${ICO.som}</button>
      <button class="btn icone jv-ajustes-btn" type="button" aria-expanded="false" aria-controls="jvAjustes" aria-label="Ajustes e ajuda" title="Voz, sons e como falar comigo">${ICO.ajustes}</button>
      <button class="btn jv-sair" type="button" aria-label="Sair do modo Jarvis">${ICO.fechar}<span class="jv-sair-rot">Sair</span><kbd>Esc</kbd></button>
    </div>
  </header>
  <section class="jv-atividade" aria-label="Atividade: as ferramentas que o Jarvis está usando">
    <h3 class="hud-rot">Atividade <b class="jv-at-qt"></b></h3>
    <ol class="jv-at-lista" role="list"></ol>
    <p class="jv-vazio jv-at-vazio">Cada ferramenta que eu usar aparece aqui: notas, saúde, banco, e-mail, arquivos.</p>
  </section>
  <section class="jv-exibicao" aria-label="Exibição: o que o Jarvis mostrou na tela">
    <h3 class="hud-rot">Exibição</h3>
    <div class="jv-cartoes"></div>
    <p class="jv-vazio jv-ex-vazio">Números, listas e notas que eu mostrar ficam aqui.</p>
  </section>
  <div class="jv-confirma" role="alertdialog" aria-modal="false" aria-labelledby="jvConfTit" aria-describedby="jvConfTxt" hidden>
    ${CANTOS}
    <svg class="jv-conf-arco" viewBox="0 0 100 100" aria-hidden="true"><circle class="jv-conf-trilha" cx="50" cy="50" r="47"/><circle class="jv-conf-resta" cx="50" cy="50" r="47" pathLength="100"/></svg>
    <p class="hud-rot jv-conf-rot">Ação pendente · <b class="jv-conf-tipo">enviar e-mail</b></p>
    <h3 id="jvConfTit" class="jv-conf-tit"></h3>
    <div id="jvConfTxt" class="jv-conf-detalhe"></div>
    <p class="jv-conf-voz"><span class="jv-conf-voz-txt">Diga <b>“pode enviar”</b> ou <b>“cancela”</b> depois que eu terminar de falar, ou use os botões.</span> Expira em <b class="jv-conf-tempo">5:00</b>.</p>
    <p class="jv-conf-res" role="status" hidden></p>
    <div class="acoes"><button class="btn principal jv-conf-sim" type="button">Confirmar</button><button class="btn jv-conf-nao" type="button">Cancelar</button></div>
  </div>
  <footer class="jv-pe">
    <div class="jv-legenda" aria-hidden="true">
      <p class="jv-lg-julio" hidden><b>VOCÊ</b><span class="jv-lg-julio-txt"></span></p>
      <div class="jv-lg-jarvis" hidden><b>JARVIS</b><div class="jv-frases"></div></div>
    </div>
    <p class="sr jv-falado" aria-live="polite"></p>
    <form class="jv-form" autocomplete="off">
      <button class="jv-mic" type="button" aria-pressed="false" aria-label="Microfone">
        <i class="jv-mic-pt" aria-hidden="true"></i><span class="jv-mic-ico">${ICO.micOff}</span><span class="jv-mic-rot">Microfone</span>
        <span class="jv-medidor" aria-hidden="true"><i></i></span>
      </button>
      <input class="jv-entrada" type="text" placeholder="Fale ou digite para o Jarvis…" aria-label="Mensagem para o Jarvis" enterkeyhint="send" autocomplete="off" spellcheck="true">
      <button class="btn jv-parar" type="button" hidden>${ICO.parar}<span>Parar</span></button>
      <button class="btn principal jv-enviar" type="submit" aria-label="Enviar">${ICO.enviar}<span>Enviar</span></button>
    </form>
    <p class="jv-dica"><span class="jv-dica-voz">Segure <kbd>Espaço</kbd> para falar e para me interromper · </span><kbd>Esc</kbd> sai</p>
  </footer>
  <div class="jv-ajustes" id="jvAjustes" role="dialog" aria-label="Ajustes e ajuda do Jarvis" hidden>
    <section><h3 class="hud-rot">Voz</h3>
      <label class="jv-campo"><span>Voz do Jarvis</span><select class="jv-voz-sel"></select></label>
      <p class="jv-nota-voz"></p>
      <label class="faixa"><span>Velocidade <b class="jv-vel-v">1,05</b></span><input class="jv-vel" type="range" min="0.8" max="1.4" step="0.05" value="1.05"></label>
      <label class="faixa"><span>Tom <b class="jv-tom-v">0,92</b></span><input class="jv-tom" type="range" min="0.6" max="1.3" step="0.02" value="0.92"></label>
      <p class="jv-obs">O Edge ignora o tom nas vozes “Online”; a velocidade vale.</p>
      <label class="chave"><span>Sons do HUD</span><input class="jv-sons" type="checkbox" checked></label>
      <label class="chave"><span>Estou de fone de ouvido <small class="jv-obs">sem eco: uma palavra já me interrompe</small></span><input class="jv-fone" type="checkbox"></label>
    </section>
    <section class="jv-sec-ouvido" hidden><h3 class="hud-rot">Ouvido</h3>
      <label class="jv-campo"><span>Quem reconhece a sua fala</span><select class="jv-ouvido-sel">
        <option value="chrome">Chrome (offline, neste computador)</option><option value="edge">Edge (nuvem da Microsoft)</option></select></label>
      <p class="jv-obs jv-ouvido-nota"></p>
      <div class="acoes jv-ouvido-acoes"><button class="btn pequeno jv-pacote-btn" type="button" hidden></button></div>
    </section>
    <section class="jv-sec-trava" hidden><h3 class="hud-rot">Trava do rosto</h3>
      <p class="jv-obs jv-trava-nota"></p>
      <div class="acoes jv-trava-bts">
        <button class="btn pequeno jv-travar" type="button">Travar agora</button>
        <button class="btn pequeno jv-recadastrar" type="button">Cadastrar o rosto de novo</button>
        <button class="btn pequeno jv-hello" type="button">Cadastrar o Windows Hello</button>
        <button class="btn pequeno jv-apagar" type="button">Apagar meu cadastro</button>
      </div>
      <p class="jv-obs">É uma trava do Jarvis neste computador, não do Windows. Não substitui o login: quem entra na sua conta do Windows consegue apagar a trava. Quem abrir o console do navegador aqui e tiver uma foto sua consegue passar, porque a prova de vida (o piscar) é conferida na página; um vídeo seu também poderia enganar o piscar. Trocar ou apagar o cadastro pede uma confirmação de até 5 minutos. Nenhuma foto é salva: só números do rosto, em %LOCALAPPDATA%\\CerebroLube\\rosto.</p>
    </section>
    <section><h3 class="hud-rot">Como falar comigo</h3>
      <ul class="jv-ajuda">
        <li>Fale normalmente. Quando você para, eu respondo.</li>
        <li>Segure <kbd>Espaço</kbd> para falar; isso também me interrompe na hora.</li>
        <li>Pode falar por cima de mim: eu paro e respondo ao que você disse. “Para”, “espera”, “chega” ou “Jarvis” sozinhos só me fazem parar.</li>
        <li>Para enviar e-mail eu sempre peço confirmação na tela: diga “pode enviar” ou “cancela” depois que eu terminar de falar, ou use os botões.</li>
        <li>“Pode fechar” ou <kbd>Esc</kbd> sai do modo Jarvis.</li>
        <li><b>Use fone de ouvido.</b> Com alto-falante o microfone me ouve, e o filtro de eco faz o possível.</li>
      </ul>
    </section>
    <section><h3 class="hud-rot">Privacidade</h3>
      <p class="jv-obs jv-priv-txt">${PRIV_EDGE}</p>
    </section>
    <div class="acoes"><button class="btn pequeno jv-ajustes-ok" type="button">Fechar</button></div>
  </div>
  <div class="jv-consent" role="dialog" aria-labelledby="jvConsTit" aria-describedby="jvConsTxt" hidden>
    <div class="jv-cons-cartao">${CANTOS}
      <p class="hud-rot">Microfone</p>
      <h2 id="jvConsTit">Ligar o microfone?</h2>
      <div id="jvConsTxt">${CONSENT_EDGE}</div>
      <div class="acoes"><button class="btn principal jv-cons-sim" type="button">${ICO.mic}Ligar microfone</button><button class="btn jv-cons-nao" type="button">Só digitar</button></div>
    </div>
  </div>
  <div class="jv-consent jv-pacote" role="dialog" aria-labelledby="jvPacTit" aria-describedby="jvPacTxt" hidden>
    <div class="jv-cons-cartao">${CANTOS}
      <p class="hud-rot">Ouvido · Chrome</p>
      <h2 id="jvPacTit">Baixar o pacote de voz?</h2>
      <div id="jvPacTxt">
        <p>Para me ouvir sem internet, o Chrome precisa do pacote de voz em português (junto vai o de inglês, que ele exige). São cerca de 300 MB, baixados uma vez só. Depois disso o reconhecimento roda neste computador.</p>
        <p class="jv-pac-st" role="status"></p>
      </div>
      <div class="acoes"><button class="btn principal jv-pac-sim" type="button"></button><button class="btn jv-pac-nao" type="button">Agora não</button></div>
    </div>
  </div>
  <div class="jv-aviso" role="status" hidden></div>`;
}

/* =============================================================================
   criarJarvis
   ============================================================================= */
export function criarJarvis(opts = {}) {
  const app = opts.raiz || document.getElementById('app') || document.body;
  const reduzido = typeof opts.reduzido === 'function' ? opts.reduzido : () => false;
  const robo = typeof opts.robo === 'function' ? opts.robo : () => null;
  const contextoTela = typeof opts.contexto === 'function' ? opts.contexto : () => ({});
  const pagina = opts.pagina || {};
  const sons = criarSons();

  // raiz do modo
  let raiz = document.getElementById('jarvis');
  if (!raiz) { raiz = document.createElement('div'); raiz.id = 'jarvis'; app.appendChild(raiz); }
  raiz.className = 'jarvis';
  raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true'); raiz.setAttribute('aria-labelledby', 'jvTitulo');
  raiz.hidden = true;
  raiz.innerHTML = marcacao();
  const $ = (s) => raiz.querySelector(s);
  const el = {
    canvas: $('.jv-canvas'), chip: $('.jv-chip'), chipTxt: $('.jv-chip-txt'),
    mudo: $('.jv-mudo'), ajustesBtn: $('.jv-ajustes-btn'), sair: $('.jv-sair'),
    atLista: $('.jv-at-lista'), atQt: $('.jv-at-qt'), cartoes: $('.jv-cartoes'),
    conf: $('.jv-confirma'), confTit: $('.jv-conf-tit'), confDet: $('.jv-conf-detalhe'), confTipo: $('.jv-conf-tipo'), confTempo: $('.jv-conf-tempo'),
    confRes: $('.jv-conf-res'), confSim: $('.jv-conf-sim'), confNao: $('.jv-conf-nao'), confResta: $('.jv-conf-resta'),
    contexto: $('.jv-contexto'), lgJulio: $('.jv-lg-julio'), lgJulioTxt: $('.jv-lg-julio-txt'), lgJarvis: $('.jv-lg-jarvis'), frases: $('.jv-frases'),
    falado: $('.jv-falado'), form: $('.jv-form'), mic: $('.jv-mic'), micIco: $('.jv-mic-ico'), micRot: $('.jv-mic-rot'), medidor: $('.jv-medidor i'),
    entrada: $('.jv-entrada'), parar: $('.jv-parar'), enviar: $('.jv-enviar'), dicaVoz: $('.jv-dica-voz'),
    ajustes: $('.jv-ajustes'), vozSel: $('.jv-voz-sel'), notaVoz: $('.jv-nota-voz'), vel: $('.jv-vel'), velV: $('.jv-vel-v'), tom: $('.jv-tom'), tomV: $('.jv-tom-v'),
    sonsChk: $('.jv-sons'), foneChk: $('.jv-fone'), ajustesOk: $('.jv-ajustes-ok'), confVozTxt: $('.jv-conf-voz-txt'),
    consent: $('.jv-consent:not(.jv-pacote)'), consTxt: $('#jvConsTxt'), consSim: $('.jv-cons-sim'), consNao: $('.jv-cons-nao'), aviso: $('.jv-aviso'),
    pacote: $('.jv-pacote'), pacSim: $('.jv-pac-sim'), pacNao: $('.jv-pac-nao'), pacSt: $('.jv-pac-st'), privTxt: $('.jv-priv-txt'),
    secOuvido: $('.jv-sec-ouvido'), ouvidoSel: $('.jv-ouvido-sel'), ouvidoNota: $('.jv-ouvido-nota'), pacoteBtn: $('.jv-pacote-btn'),
    secTrava: $('.jv-sec-trava'), travaNota: $('.jv-trava-nota'), travar: $('.jv-travar'), recadastrar: $('.jv-recadastrar'), hello: $('.jv-hello'), apagar: $('.jv-apagar'),
    leituras: Object.fromEntries([...raiz.querySelectorAll('[data-l]')].map((e) => [e.dataset.l, e]))
  };

  const hud = criarHud({
    // depois do portão do rosto, o HUD nasce no centro (onde a lente encolheu), sem o mergulho nos olhos do robô
    raiz, canvas: el.canvas, reduzido, robo: () => (J.semMergulho ? null : robo()), cena: opts.cena, qualidadeBaixa: opts.qualidadeBaixa,
    onFase: (f) => { if (f === 'paineis') aoPaineis(); if (f === 'pronto') aoPronto(); }
  });

  /* ---------- estado ---------- */
  const J = {
    aberto: false, entrando: false, saindo: false,
    cerebro: null, disp: { ok: false, motivo: 'Ligando…', voz: false }, carregandoCerebro: null,
    conversa: [], turno: null, ger: 0, msgTurno: null, msgFala: null, nFerr: 0, t0Turno: 0, latencia: null, modelo: 'haiku',
    interrompidoAte: 0, rotuloInterrompidoAte: 0, ultimoFimVoz: -1e9, eco: [],
    acao: null, acaoT: 0, decidindo: false, pendenteAbrir: null,
    mic: { querLigado: false, ptt: false, temporario: false, erro: null }, falaJulio: null,
    estado: '', mudo: lerPref('jarvis-mudo', '0') === '1', sons: lerPref('jarvis-sons', '1') !== '0',
    rate: Number(lerPref('jarvis-velocidade', '1.05')) || 1.05, pitch: Number(lerPref('jarvis-tom', '0.92')) || 0.92,
    vozUri: lerPref('jarvis-voz', ''), semVozAvisado: false, saudou: false, inertes: [], focoAntes: null, raf: 0, ultimaHora: '', ultSeg: -1,
    // escuta e eco: fone (sem eco), palavras ditas com a hora (para saber se um "para" ouvido é o meu), o pedaço do
    // reconhecimento que já foi usado (o resultado final dele ainda chega), a confirmação por voz esperando 1,2 s
    fone: lerPref('jarvis-fone', '0') === '1', ecoT: [], prefixo: null, confVoz: null, nFalas: 0, pttSemResposta: false,
    // turno: ferramentas abertas e a hora do último evento (vigia de demora), e a voz que falhou (tenta de novo)
    ferrAbertas: new Set(), tEvento: 0, avisouDemora: false, vozRetentou: false, vozRuim: false, primeiraFrase: true,
    // a trava do rosto: o portão na tela (o tipo do fluxo, o estado dele e se a câmera está ligada) e o HUD que nasce
    // no centro depois de liberar; baixando = o pacote de voz do Chrome
    portao: false, portaoTipo: null, portaoEstado: null, portaoCamera: false, portaoP: null, portaoDono: null, semMergulho: false, baixando: false,
    // cada abertura do Jarvis tem um número: a resposta atrasada de um portão velho não fecha o Jarvis novo
    nAbrir: 0
  };
  J.rate = Math.min(1.4, Math.max(0.8, J.rate)); J.pitch = Math.min(1.3, Math.max(0.6, J.pitch));
  // ouvido: o do Edge (SpeechRecognition daqui) ou, no app do computador, o Chrome escondido (js/ouvido-remoto.js); os
  // dois com a mesma cara. No app, o escolhido vem depois de o servidor dizer se há Chrome (escolherOuvido)
  const H_OUVIDO = {
    parcial: (t) => aoParcial(t), final: (t) => aoFinal(t), estado: () => atualizarMic(),
    erro: (c, msg) => aoErroMic(c, msg), aviso: (c, d) => aoAvisoOuvido(c, d)
  };
  const SIM_MODO = simular();
  const LOCAL_APP = ehLocal() && !!tokenLocal();
  // M = os módulos só do app do computador (ouvido remoto e portão do rosto), importados na primeira abertura
  let M = null, pModulos = null, portao = null, ouvidoEdge = null, ouvidoChrome = null;
  const OUVIDO_NADA = { suportado: false, ativo: false, ouvindo: false, async ligar() { throw Object.assign(new Error('sem ouvido'), { codigo: 'sem-suporte' }); }, pausar() {}, nivel: () => null, destruir() {} };
  let ouvido = SIM_MODO ? criarOuvidoSimulado() : LOCAL_APP ? OUVIDO_NADA : (ouvidoEdge = criarOuvido(H_OUVIDO, sons));

  /* ---------- voz de falar ---------- */
  let voz = criarVozRelogio();
  // ja = trocar já (mudo, escolha de voz): as frases que faltam são refeitas na voz nova, sem cortar a resposta;
  // sem ja (vozes que chegaram tarde), espera a fila esvaziar
  function montarVoz({ ja = false } = {}) {
    if (falandoAgora() && !ja) { J.trocarVoz = true; return; }
    J.trocarVoz = false;
    const pendentes = F.frases.filter((f) => f.estado !== 'dita');
    const lista = vozesPt();
    const escolhida = J.vozUri === 'nenhuma' ? null : escolherVoz(lista, J.vozUri);
    voz.parar();
    if (J.mudo || J.disp.falar === false) { voz = criarVozRelogio(30); voz._mudo = true; }
    else if (escolhida && window.speechSynthesis) voz = criarVozNavegador(escolhida);
    else voz = criarVozRelogio();
    voz.configurar({ rate: J.rate, pitch: J.pitch });
    if (pendentes.length) {
      for (const f of pendentes) { f.el.remove(); F.frases.splice(F.frases.indexOf(f), 1); }
      for (const f of pendentes) novaFrase(f.texto, f.msg);
    }
    preencherVozes(lista, escolhida);
    leitura('voz', voz.tipo === 'navegador' ? nomeCurto(escolhida).toUpperCase() : J.mudo ? 'MUDO' : 'SÓ LEGENDA');
  }
  // as vozes do Edge chegam tarde: voiceschanged + consulta a cada 250 ms por até 10 s (JARVIS.md §7.7)
  async function esperarVozes(ms = 10000) {
    if (!window.speechSynthesis) return [];
    let lista = vozesPt();
    if (lista.length) return lista;
    return new Promise((res) => {
      const t0 = agora();
      const fim = () => { clearInterval(iv); try { speechSynthesis.removeEventListener('voiceschanged', ver); } catch { /* nada */ } res(vozesPt()); };
      const ver = () => { if (vozesPt().length || agora() - t0 > ms) fim(); };
      const iv = setInterval(ver, 250);
      try { speechSynthesis.addEventListener('voiceschanged', ver); } catch { /* nada */ }
      try { speechSynthesis.getVoices(); } catch { /* nada */ }
    });
  }
  function aoMudarVozes() { if (!J.aberto || falandoAgora()) return; montarVoz(); }
  try { window.speechSynthesis && speechSynthesis.addEventListener('voiceschanged', aoMudarVozes); } catch { /* nada */ }
  function preencherVozes(lista, escolhida) {
    const s = el.vozSel; if (!s) return;
    const atual = escolhida ? escolhida.voiceURI : 'nenhuma';
    s.innerHTML = lista.map((v) => `<option value="${escHtml(v.voiceURI)}">${escHtml(nomeCurto(v))} · ${escHtml(/pt[-_]pt/i.test(v.lang) ? 'Portugal' : 'Brasil')}${/natural/i.test(v.name) ? ' · natural' : ''}</option>`).join('')
      + '<option value="nenhuma">Sem voz (só legenda)</option>';
    s.value = atual;
    el.notaVoz.textContent = lista.length ? '' : 'Nenhuma voz em português neste navegador. Sem internet, o Edge não tem voz em português: eu sigo só com a legenda.';
  }

  /* ---------- fila de frases (JARVIS.md §3: a primeira frase é falada antes de a resposta terminar) ---------- */
  // frases: {texto, el, palavras, estado:'espera'|'falando'|'dita', msg} — msg = a mensagem da conversa de onde a frase
  // veio (null = frase da própria interface); msg.dito guarda o que já foi falado dela (para a interrupção)
  const F = { buffer: '', frases: [], fechada: true, vigia: 0, msg: null, tSoltar: 0 };
  const RX_CORTE = /[.!?…]+["'”»)\]]*\s|\n+/g;
  const RX_FIM_FRASE = /[.!?…]+["'”»)\]]*$/;
  // "1. " no começo da linha é número de lista, não fim de frase (senão o "um." seria falado sozinho)
  const numeroDeLista = (s, i) => /^\s*\d{1,3}$/.test(s.slice(s.lastIndexOf('\n', i - 1) + 1, i));
  function acharCorte(s) {
    RX_CORTE.lastIndex = 0;
    let m;
    while ((m = RX_CORTE.exec(s))) {
      if (m[0][0] !== '\n' && numeroDeLista(s, m.index)) continue;
      return m.index + m[0].length;
    }
    if (s.length > 140) {
      const k = s.lastIndexOf(', ', 150);
      if (k > 40) return k + 2;
      if (s.length > 220) { const e = s.lastIndexOf(' ', 200); if (e > 60) return e + 1; }
    }
    return -1;
  }
  function empurrarTexto(delta) {
    F.buffer += delta; F.fechada = false;
    for (;;) {
      const c = acharCorte(F.buffer);
      if (c < 0) break;
      const frase = F.buffer.slice(0, c); F.buffer = F.buffer.slice(c);
      novaFrase(frase, F.msg);
    }
    // o bloco de texto que vem antes de uma ferramenta termina no ponto, sem espaço: a frase só fecharia quando a
    // ferramenta acabasse (de 2 s a 4 min de silêncio). Terminou em ponto e nada chegou em 250 ms: ela vai para a voz
    clearTimeout(F.tSoltar); F.tSoltar = 0;
    const m = RX_FIM_FRASE.exec(F.buffer);
    if (m && F.buffer.trim() && !numeroDeLista(F.buffer, m.index)) F.tSoltar = setTimeout(soltarFrase, 250);
  }
  // o que está no buffer vira frase agora (chegou ferramenta, cartão, ação ou troca de modelo: a frase acabou)
  function soltarFrase() {
    clearTimeout(F.tSoltar); F.tSoltar = 0;
    if (!F.buffer.trim()) return;
    const f = F.buffer; F.buffer = '';
    novaFrase(f, F.msg);
  }
  function fecharTexto() { clearTimeout(F.tSoltar); F.tSoltar = 0; const resto = F.buffer; F.buffer = ''; F.fechada = true; if (resto.trim()) novaFrase(resto, F.msg); }
  function novaFrase(bruto, msg = null) {
    const texto = limparFala(bruto);
    if (!texto) return;
    const div = document.createElement('p');
    div.className = 'jv-frase espera';
    const palavras = [];
    const re = /\S+/g; let m;
    while ((m = re.exec(texto))) {
      const s = document.createElement('span'); s.textContent = m[0];
      div.appendChild(s); div.appendChild(document.createTextNode(' '));
      palavras.push({ ini: m.index, fim: m.index + m[0].length, el: s, txt: m[0] });
    }
    const fr = { texto, el: div, palavras, estado: 'espera', t0: 0, ci: -1, boundary: false, vistas: 0, msg };
    F.frases.push(fr);
    el.frases.appendChild(div);
    el.lgJarvis.hidden = false;
    voz.falar(texto, {
      inicio: () => { fr.estado = 'falando'; fr.t0 = agora(); fr.el.classList.remove('espera'); fr.el.classList.add('falando'); clearTimeout(F.vigia); J.vozRetentou = false; J.primeiraFrase = false; },
      palavra: (ci) => { fr.boundary = true; fr.ci = ci; },
      fim: (inf) => {
        if (inf && inf.erro && inf.erro !== 'interrupted' && inf.erro !== 'canceled' && !fr.t0) { vozFalhou(); return; }
        fr.estado = 'dita'; fr.ci = texto.length + 1; revelar(fr, true);
        fr.el.classList.remove('falando', 'espera'); fr.el.classList.add('dita');
        if (fr.msg) fr.msg.dito = `${fr.msg.dito || ''} ${texto}`.trim();
        J.ultimoFimVoz = agora();
        anunciar(texto);
        podar();
        if (!F.frases.some((f) => f.estado === 'falando')) rolarLegenda(null);
        // a resposta inteira já foi dita: a próxima interrupção não mexe mais nela
        if (fr.msg && fr.msg === J.msgFala && !J.turno && F.fechada && !F.frases.some((f) => f.estado !== 'dita' && f.msg === fr.msg)) J.msgFala = null;
        if (F.frases.some((f) => f.estado === 'espera')) armarVigia();
        else if (J.trocarVoz && !voz.falando()) setTimeout(() => { if (J.trocarVoz && !falandoAgora()) montarVoz(); }, 0);
      }
    });
    armarVigia();
  }
  // vigia: a voz do navegador não começou a frase (Edge sem internet, voz Online com rede lenta, speak() engolido logo
  // depois de um cancel()). 8 s na primeira frase de cada resposta (a voz Online leva mais para começar), 4 s nas outras
  function armarVigia() {
    if (voz.tipo !== 'navegador') return;
    clearTimeout(F.vigia);
    F.vigia = setTimeout(() => { if (F.frases.some((f) => f.estado === 'espera') && !F.frases.some((f) => f.estado === 'falando')) vozFalhou(); }, J.primeiraFrase ? 8000 : 4000);
  }
  // a primeira falha não derruba a voz: a mesma voz fala de novo as mesmas frases, uma vez. Na segunda, segue só com a
  // legenda e, no próximo turno, tenta a voz do navegador outra vez
  function vozFalhou() {
    if (voz.tipo !== 'navegador') return;
    const pendentes = F.frases.filter((f) => f.estado !== 'dita');
    const antes = voz;
    voz.parar();
    if (!J.vozRetentou && antes.vozObj) {
      J.vozRetentou = true;
      voz = criarVozNavegador(antes.vozObj); voz.configurar({ rate: J.rate, pitch: J.pitch });
    } else {
      voz = criarVozRelogio(); voz.configurar({ rate: J.rate });
      J.vozRuim = true;
      leitura('voz', 'SÓ LEGENDA');
      if (!J.semVozAvisado) { J.semVozAvisado = true; avisar('A voz do navegador não respondeu. Sigo com a legenda.', 4200); }
    }
    for (const f of pendentes) { f.el.remove(); F.frases.splice(F.frases.indexOf(f), 1); }
    for (const f of pendentes) novaFrase(f.texto, f.msg);
  }
  // quanto já foi dito da frase da vez (pelo boundary; sem ele, pelo relógio da voz, recalibrado a cada frase)
  function revelar(fr, tudo = false) {
    let ci = fr.ci;
    if (!tudo && !fr.boundary && fr.t0) ci = ((agora() - fr.t0) / 1000) * voz.cps;
    let n = 0;
    for (const p of fr.palavras) if (tudo || p.ini <= ci) n++;
    if (n > fr.vistas) {
      const t = agora();
      for (let i = fr.vistas; i < n; i++) {
        const p = fr.palavras[i];
        p.el.classList.add('dita');
        for (const w of palavrasDe(p.txt)) { J.eco.push(w); J.ecoT.push({ w, t }); }
        if (!tudo) hud.palavra(0.55 + 0.45 * Math.min(1, p.txt.length / 8));
      }
      if (J.eco.length > 40) J.eco.splice(0, J.eco.length - 40);
      if (J.ecoT.length > 80) J.ecoT.splice(0, J.ecoT.length - 80);
      const ant = fr.palavras[fr.vistas - 1]; if (ant) ant.el.classList.remove('vez');
      const vez = fr.palavras[n - 1]; if (vez && !tudo) vez.el.classList.add('vez'); else if (vez) vez.el.classList.remove('vez');
      fr.vistas = n;
      if (vez && !tudo) rolarLegenda(vez.el);
    }
  }
  // a legenda viva é uma janela de ~2 linhas: a palavra da vez fica sempre à vista, na última linha (as frases da fila
  // nem entram no layout até começarem a ser faladas)
  function rolarLegenda(alvo) {
    const box = el.frases; if (!box) return;
    const topo = alvo ? Math.max(0, alvo.offsetTop + alvo.offsetHeight - box.clientHeight) : Math.max(0, box.scrollHeight - box.clientHeight);
    if (Math.abs(box.scrollTop - topo) > 1) box.scrollTop = topo;
  }
  function podar() {
    // a legenda guarda as 3 últimas frases ditas
    const ditas = F.frases.filter((f) => f.estado === 'dita');
    while (ditas.length > 3) { const f = ditas.shift(); f.el.remove(); F.frases.splice(F.frases.indexOf(f), 1); }
  }
  const falandoAgora = () => F.frases.some((f) => f.estado !== 'dita') || voz.falando();
  // o que o Júlio ouviu da mensagem msg: as frases dela já ditas + as palavras já ditas da frase da vez
  function ditoDe(msg) {
    if (!msg) return '';
    let s = String(msg.dito || '');
    const f = F.frases.find((x) => x.estado === 'falando' && x.msg === msg);
    if (f) { revelar(f); s = `${s} ${f.palavras.slice(0, f.vistas).map((p) => p.txt).join(' ')}`; }
    return s.replace(/\s+/g, ' ').trim();
  }
  function limparLegendaJarvis() {
    for (const f of [...F.frases]) if (f.estado === 'dita') { f.el.remove(); F.frases.splice(F.frases.indexOf(f), 1); }
  }
  // sem som (mudo, "sem voz", voz do navegador caída) ou de fone de ouvido, não existe eco
  const semEco = () => J.fone || voz.tipo === 'relogio';
  function conjuntoEco() {
    const s = new Set();
    if (semEco()) return s;
    const add = (w) => { s.add(w); if (w.length > 4 && w.endsWith('s')) s.add(w.slice(0, -1)); };
    for (const w of J.eco.slice(-25)) add(w);
    const i = F.frases.findIndex((f) => f.estado === 'falando');
    const cand = i >= 0 ? [F.frases[i - 1], F.frases[i], F.frases[i + 1]] : F.frases.slice(-2);
    for (const f of cand) if (f) for (const w of palavrasDe(f.texto)) add(w);
    return s;
  }
  function limparFila({ manterDitas = true } = {}) {
    clearTimeout(F.vigia); clearTimeout(F.tSoltar); F.tSoltar = 0;
    F.buffer = ''; F.fechada = true;
    for (const f of [...F.frases]) {
      if (manterDitas && f.estado === 'dita') continue;
      if (manterDitas && f.estado === 'falando') { revelar(f); f.palavras.slice(f.vistas).forEach((p) => p.el.remove()); f.palavras.forEach((p) => p.el.classList.remove('vez')); f.estado = 'dita'; f.el.classList.remove('falando'); f.el.classList.add('dita', 'cortada'); continue; }
      f.el.remove(); F.frases.splice(F.frases.indexOf(f), 1);
    }
  }
  function anunciar(t) { if (el.falado) el.falado.textContent = t; }

  /* ---------- conversa ---------- */
  function contexto() {
    let c = {};
    try { c = contextoTela() || {}; } catch { c = {}; }
    return c;
  }
  function falarLocal(texto) {
    // frase da própria interface (saudação, aviso, resultado da confirmação): vai para a fila como qualquer outra,
    // mas não pertence a nenhuma mensagem da conversa (interromper ela não mexe no histórico)
    if (!J.turno && !F.frases.some((f) => f.estado !== 'dita' && f.msg)) J.msgFala = null;
    novaFrase(texto, null);
    atualizarEstado();
  }
  // o que vai para o cérebro: só papel, texto e a marca de interrompido
  const conversaParaEnviar = () => J.conversa.map((m) => (m.interrompido ? { papel: m.papel, texto: m.texto, interrompido: true } : { papel: m.papel, texto: m.texto }));
  async function enviar(texto, { origem = 'texto', jaFiltrada = false } = {}) {
    texto = String(texto || '').replace(/\s+/g, ' ').trim();
    if (!texto || J.portao) return;   // com o portão do rosto na tela, nada vai para o cérebro
    if (J.acao && !jaFiltrada) {
      // digitado com o cartão aberto: "pode enviar" / "cancela" seguem as mesmas regras da voz (menos a do eco)
      const k = curto(texto), dec = SIM.has(k) ? 'confirmar' : NAO.has(k) ? 'recusar' : null;
      if (dec && respostaAcao(dec, { texto })) return;
    }
    J.nFalas++;   // a conversa andou: um cartão aberto antes daqui só se confirma pelo botão
    atualizarDicaAcao();
    if (falandoAgora() || J.turno) interromper({ motivo: 'nova', silencioso: true });
    limparLegendaJarvis();
    mostrarJulio(texto, true);
    const c = J.carregandoCerebro ? await J.carregandoCerebro : J.cerebro;
    if (!J.aberto) return;
    if (!c || !J.disp.ok) { falarLocal(J.disp.motivo || 'Estou sem conexão com o cérebro agora.'); return; }
    // a voz do navegador tinha caído (ficou só a legenda): a cada pergunta, tenta de novo
    if (J.vozRuim && !J.mudo && J.vozUri !== 'nenhuma' && !falandoAgora()) { J.vozRuim = false; J.vozRetentou = false; montarVoz({ ja: true }); }
    // fala do Júlio sem resposta (cortada antes de eu falar) + a nova = uma pergunta só
    const ult = J.conversa[J.conversa.length - 1];
    if (ult && ult.papel === 'julio') ult.texto = `${ult.texto} ${texto}`;
    else J.conversa.push({ papel: 'julio', texto });
    // passando de 40 entradas, corta em bloco (ficam as 20 últimas, começando pelo Júlio): o começo das mensagens fica
    // igual por vários turnos, e o cache do prompt continua valendo
    if (J.conversa.length > 40) {
      let k = J.conversa.length - 20;
      while (k < J.conversa.length - 1 && J.conversa[k].papel !== 'julio') k++;
      J.conversa.splice(0, k);
    }
    while (J.conversa.length && J.conversa[0].papel !== 'julio') J.conversa.shift();   // começa sempre pelo Júlio
    const ger = ++J.ger;
    J.msgTurno = null; F.msg = null; J.nFerr = 0; J.t0Turno = agora(); J.latencia = null; J.retirado = false;
    J.tEvento = agora(); J.avisouDemora = false; J.ferrAbertas.clear(); J.primeiraFrase = true;
    leitura('ferramentas', '0'); leitura('resposta', '…');
    const vivo = () => ger === J.ger && J.aberto;
    const evento = () => { J.tEvento = agora(); };
    const h = {
      texto: (delta) => {
        if (!vivo() || !delta) return;
        evento();
        if (!J.msgTurno) { J.msgTurno = { papel: 'jarvis', texto: '', dito: '' }; J.conversa.push(J.msgTurno); J.msgFala = J.msgTurno; F.msg = J.msgTurno; }
        if (J.latencia == null) { J.latencia = (agora() - J.t0Turno) / 1000; leitura('resposta', `${J.latencia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} S`); }
        J.msgTurno.texto += delta;
        empurrarTexto(delta);
        atualizarEstado();
      },
      // ferramenta, cartão, ação ou troca de modelo: a frase que veio antes acabou e já vai para a voz ("Um instante, vou
      // olhar a caixa." preenche o silêncio da ferramenta, em vez de ficar parada no buffer)
      ferramenta: (f) => {
        if (!vivo()) return;
        evento();
        const d = f || {}, id = String(d.id || d.nome || '');
        if (d.estado === 'inicio') { soltarFrase(); if (id) J.ferrAbertas.add(id); } else if (id) J.ferrAbertas.delete(id);
        aoFerramenta(d);
      },
      cartao: (c2) => { if (!vivo()) return; evento(); soltarFrase(); mostrarCartao(c2 || {}); },
      acao: (a) => { if (!vivo()) return; evento(); soltarFrase(); abrirAcao(a || {}); },
      modelo: (m) => {
        if (!vivo()) return;
        evento(); soltarFrase();
        J.modelo = m && m.nome === 'sonnet' ? 'sonnet' : 'haiku';
        hud.modelo(J.modelo);
        // no link o nível vem com rótulo próprio (RÁPIDO / ANÁLISE): o modelo exato lá não é garantido
        leitura('modelo', m && m.rotulo ? String(m.rotulo).toUpperCase() : rotuloModelo(J.modelo));
      },
      fim: (d) => {
        if (!vivo()) return;
        J.turno = null; J.ferrAbertas.clear();
        encerrarFerramentas('sem resposta');
        if (J.modelo !== 'haiku') { J.modelo = 'haiku'; hud.modelo('haiku'); leitura('modelo', rotuloModelo('haiku')); }
        if (J.retirado) { J.retirado = false; atualizarEstado(); return; }
        if (d && (d.motivo === 'refusal' || d.motivo === 'recusado')) {
          // recusa no meio do streaming: descarta o parcial e diz uma frase neutra (JARVIS.md §7.10)
          const frase = String((d && d.mensagem) || 'Esse pedido eu não consigo atender.');
          voz.parar(); limparFila({ manterDitas: false });
          if (J.msgTurno) { J.msgTurno.texto = frase; J.msgTurno.dito = ''; } else J.conversa.push({ papel: 'jarvis', texto: frase });
          F.msg = null; J.msgFala = null;
          falarLocal(frase);
          return;
        }
        fecharTexto();
        if (!J.msgTurno) {
          // terminou sem dizer nada: a pergunta fica sem resposta no histórico (a próxima fala junta com ela)
          leitura('resposta', '—');
        }
        atualizarEstado();
      },
      erro: (e) => {
        if (!vivo()) return;
        J.turno = null; J.ferrAbertas.clear();
        encerrarFerramentas('parou com o erro');
        const msg = String((e && e.mensagem) || 'O cérebro não conseguiu responder.');
        if (e && e.retirar) {
          // recusa: o que já foi mostrado e falado deste turno sai (sample.d.ts / JARVIS.md §7.10)
          voz.parar(); limparFila({ manterDitas: false });
          // no histórico fica só a frase neutra (o pedido recusado não se junta com o próximo)
          const frase = msg.length <= 160 ? msg : 'Esse pedido eu não consigo atender.';
          if (J.msgTurno) { J.msgTurno.texto = frase; J.msgTurno.dito = ''; } else J.conversa.push({ papel: 'jarvis', texto: frase });
          J.msgTurno = null; J.msgFala = null; F.msg = null; J.retirado = true;
          falarLocal(frase);
          return;
        }
        fecharTexto();
        avisar(msg, 6500, 'alerta');
        // erro antes de eu dizer qualquer coisa: a pergunta sai do histórico (ele vai repetir; não junta duas vezes)
        if (!J.msgTurno) { const ult2 = J.conversa[J.conversa.length - 1]; if (ult2 && ult2.papel === 'julio') J.conversa.pop(); }
        // frases curtas do cérebro já vêm prontas para falar; o resto vira uma frase genérica
        falarLocal(msg.length <= 140 ? msg : J.msgTurno ? 'A conexão caiu no meio. Pode repetir?' : 'Não consegui responder agora. Pode repetir daqui a pouco?');
        leitura('resposta', 'ERRO');
        J.retirado = true;   // o fim que vem depois do erro não fala de novo
      },
      // 423: a trava do rosto fechou (virou o dia, "Travar agora"). O servidor não viu a pergunta: ela sai do histórico,
      // o portão abre por cima do HUD e, liberado, a mesma pergunta vai de novo
      trava: () => {
        if (!vivo()) return;
        J.turno = null; J.ferrAbertas.clear();
        encerrarFerramentas('travado');
        const ult2 = J.conversa[J.conversa.length - 1];
        const pergunta = !J.msgTurno && ult2 && ult2.papel === 'julio' ? J.conversa.pop().texto : null;
        leitura('resposta', '—');
        pedirPortao({ refazer: pergunta, religarMic: J.mic.querLigado && !J.mic.temporario });
      }
    };
    const ctxTurno = contexto();
    if (c.tipo === 'local') ctxTurno.aba = ABA;   // os desfechos das ações desta janela só voltam para ela
    try {
      J.turno = c.turno(conversaParaEnviar(), ctxTurno, h) || { cancelar() {} };
    } catch (err) {
      J.turno = null;
      avisar('O cérebro não aceitou o pedido.', 5000, 'alerta');
    }
    void origem;
    atualizarEstado();
  }

  // vigia do turno (roda no laço, uma vez por segundo): 8 s sem nenhum evento e sem ferramenta rodando → avisa uma vez,
  // em voz, que está demorando; 45 s → desiste e diz que não conseguiu. Ferramenta rodando tem o prazo dela (no servidor)
  function vigiarTurno() {
    if (!J.turno || J.ferrAbertas.size) return;
    const sem = agora() - J.tEvento;
    if (sem > 45000) {
      interromper({ motivo: 'tempo', silencioso: true });
      avisar('O cérebro não respondeu a tempo.', 6000, 'alerta');
      falarLocal('Não consegui resposta a tempo. Pode repetir daqui a pouco?');
      return;
    }
    if (sem > 8000 && !J.avisouDemora && !J.msgTurno && !falandoAgora()) {
      J.avisouDemora = true;
      falarLocal('Está demorando mais que o normal. Continuo tentando.');
    }
  }

  // Interromper (o requisito central): corta a voz na hora, cancela o turno e guarda no histórico só o que foi dito.
  // motivo 'voz', 'nova' e 'ptt' = o Júlio continua falando (a fala dele vira a próxima pergunta, junto da anterior se
  // ainda não houve resposta); 'tecla', 'botao', 'comando', 'digitando', 'tempo' = ele só mandou parar (ou desisti).
  // silencioso = sem o clarão do "interrompido".
  function interromper({ motivo = 'voz', silencioso = false } = {}) {
    const falando = falandoAgora(), pensando = !!J.turno;
    if (!falando && !pensando) return false;
    const msg = J.msgFala, dito = ditoDe(msg);
    voz.parar();
    if (J.turno) { try { J.turno.cancelar(); } catch { /* nada */ } J.turno = null; encerrarFerramentas('interrompido'); }
    J.ferrAbertas.clear();
    J.ger++;
    if (msg) {
      const completo = limparFala(msg.texto || '');
      if (!dito) { const i = J.conversa.indexOf(msg); if (i >= 0) J.conversa.splice(i, 1); }
      else if (pensando || dito.length < completo.length - 2) { msg.texto = dito; msg.interrompido = true; }
    }
    // parou antes de eu dizer qualquer coisa: se ele só mandou parar, a pergunta sai do histórico; se ele continua
    // falando, a fala nova junta com ela
    const ult = J.conversa[J.conversa.length - 1];
    if (!dito && pensando && ult && ult.papel === 'julio' && motivo !== 'voz' && motivo !== 'nova' && motivo !== 'ptt') J.conversa.pop();
    J.msgFala = null; J.msgTurno = null; F.msg = null;
    if (J.modelo !== 'haiku') { J.modelo = 'haiku'; hud.modelo('haiku'); leitura('modelo', rotuloModelo('haiku')); }
    limparFila({ manterDitas: true });
    J.ultimoFimVoz = agora();
    if (!silencioso) {
      J.interrompidoAte = agora() + 370; J.rotuloInterrompidoAte = agora() + 900;
      hud.estado('interrompido');
      if (motivo !== 'voz') tocar('interrompido');
      setTimeout(atualizarEstado, 380);
    }
    atualizarEstado();
    return true;
  }
  function pararSo() { interromper({ motivo: 'comando' }); }

  /* ---------- ouvir: fala do Júlio, fim da fala, eco ---------- */
  function novaFalaJulio() {
    return {
      finais: '', parcial: '', tUlt: 0, tFinal: 0, timer: 0, interrompeu: false, cancelouPensando: false, durante: null, naJanela: null,
      descartar: false, ptt: false, eco: new Set(), antes: '', acaoId: J.acao ? J.acao.id : null
    };
  }
  // o pedaço do reconhecimento que já foi usado (o parcial de uma fala concluída; o trecho em curso quando o Espaço foi
  // apertado): o resultado final dele ainda vai chegar e não pode virar fala nova nem repetir a pergunta
  function ignorarPrefixo(texto) { const ps = palavrasDe(texto); J.prefixo = ps.length ? { ps, ate: agora() + 4000 } : null; }
  function tirarPrefixo(t) {
    const P = J.prefixo;
    if (!P || !t) return t;
    if (agora() > P.ate) { J.prefixo = null; return t; }
    const brutas = t.split(/\s+/).filter(Boolean);
    let i = 0, j = 0;
    while (i < brutas.length && j < P.ps.length) {
      const ws = palavrasDe(brutas[i]);
      if (!ws.length) { i++; continue; }
      let igual = true;
      for (const w of ws) { if (j < P.ps.length && P.ps[j] === w) j++; else { igual = false; break; } }
      if (!igual) break;
      i++;
    }
    if (j < Math.min(2, P.ps.length) && i < brutas.length) return t;   // quase nada em comum: é fala nova
    return brutas.slice(i).join(' ');
  }
  function aoParcial(t) {
    const bruto = String(t || '');
    if (!bruto.trim()) { if (J.falaJulio) J.falaJulio.parcial = ''; return; }
    t = tirarPrefixo(bruto);
    if (!t.trim()) return;
    seguirConfirmacao();
    const fj = J.falaJulio || (J.falaJulio = novaFalaJulio());
    fj.parcial = t; fj.tUlt = agora();
    avaliarFala();
  }
  function aoFinal(t) {
    t = tirarPrefixo(String(t || ''));
    J.prefixo = null;   // o trecho do reconhecimento fechou: o que vier depois é fala nova
    if (!t.trim()) return;
    seguirConfirmacao();
    const fj = J.falaJulio || (J.falaJulio = novaFalaJulio());
    fj.finais = `${fj.finais} ${t}`.trim(); fj.parcial = ''; fj.tFinal = fj.tUlt = agora();
    avaliarFala();
  }
  const textoFala = (fj) => `${fj.finais} ${fj.parcial}`.replace(/\s+/g, ' ').trim();
  // filtro de eco (JARVIS.md §7.9): só contam palavras de 3+ letras, fora das vazias, fora dos números e fora do que eu
  // disse (igual, no plural ou com uma letra trocada pelo reconhecimento)
  function palavrasNovas(texto, eco) { const vistas = new Set(); for (const w of palavrasDe(texto)) if (conteudo(w) && !ehEco(w, eco)) vistas.add(w); return vistas.size; }   // cada palavra conta uma vez
  function palavrasEco(texto, eco) { let n = 0; for (const w of palavrasDe(texto)) if (conteudo(w) && ehEco(w, eco)) n++; return n; }
  const todasEco = (texto, eco) => { const ps = palavrasDe(texto); return ps.length > 0 && ps.every((w) => eco.has(w) || VAZIAS.has(w) || /^\d+$/.test(w) || (conteudo(w) && ehEco(w, eco))); };
  // o eco de uma fala só cresce enquanto ela dura: nada do que eu disse sai da janela antes de a fala terminar (a fala
  // do microfone pode juntar o eco de várias frases minhas)
  function mesclarEco(fj) { if (semEco()) return VAZIO; for (const w of conjuntoEco()) fj.eco.add(w); return fj.eco; }
  // alguma dessas palavras eu disse há pouco (2,5 s) ou estou dizendo agora? Então o "para" ouvido pode ser o meu
  function ditaRecente(ws) {
    if (semEco() || !ws.length) return false;
    const t = agora(), atual = F.frases.find((f) => f.estado === 'falando');
    const daFrase = atual ? new Set(palavrasDe(atual.texto)) : null;
    return ws.some((w) => (daFrase && daFrase.has(w)) || J.ecoT.some((e) => e.w === w && t - e.t < 2500));
  }
  // o que vem depois da última palavra minha (com alto-falante, o reconhecimento junta o meu eco e a fala do Júlio
  // no mesmo trecho: "…a filial um puxa a fila para")
  function sufixoNovo(texto, eco) {
    const ps = String(texto).split(/\s+/).filter(Boolean);
    let ult = -1;
    ps.forEach((p, i) => { const w = palavrasDe(p).join(''); if (w && conteudo(w) && ehEco(w, eco)) ult = i; });
    return ult < 0 ? '' : ps.slice(ult + 1).join(' ');
  }
  // um comando curto (para, espera, não não, cancela…): a fala inteira, ou o que veio depois do meu eco; nunca
  // palavras que eu mesmo acabei de dizer (no Espaço não há eco: vale direto)
  function comandoDe(texto, eco, conjunto, fj) {
    const recente = (s) => !(fj && fj.ptt) && ditaRecente(palavrasDe(s));
    const k = curto(texto);
    if (conjunto.has(k) && !recente(k)) return k;
    const suf = curto(sufixoNovo(texto, eco));
    if (suf && suf !== k && conjunto.has(suf) && !recente(suf)) return suf;
    return null;
  }
  // uma confirmação por voz espera 1,2 s de silêncio: se o Júlio continua falando ("pode enviar… mas muda o assunto"),
  // não confirma, e o que ele disse vira o começo da fala nova (que vai para o cérebro)
  function seguirConfirmacao() {
    const c = J.confVoz; if (!c) return;
    clearTimeout(c.timer); J.confVoz = null;
    const fj = J.falaJulio || (J.falaJulio = novaFalaJulio());
    fj.finais = `${c.texto} ${fj.finais}`.trim();
    if (fj.durante === null) { fj.durante = c.durante; fj.naJanela = c.naJanela; }
    fj.ptt = fj.ptt || c.ptt;
    if (el.confRes.textContent === 'Confirmando…') el.confRes.hidden = true;
  }
  function avaliarFala() {
    const fj = J.falaJulio; if (!fj || !J.aberto) return;
    const texto = textoFala(fj);
    if (!texto) return;
    const falando = falandoAgora();
    if (fj.durante === null) { fj.durante = falando; fj.naJanela = !falando && agora() - J.ultimoFimVoz < 1500; }
    const eco = mesclarEco(fj), minimo = semEco() ? 1 : 2;
    if (falando && !fj.interrompeu) {
      // eu estou falando: o microfone pode estar ouvindo a minha voz
      if (comandoDe(texto, eco, SO_PARAR, fj)) { pararSo(); fj.descartar = true; mostrarJulio(texto, false); agendarFim(); return; }
      if (J.acao && (SIM.has(curto(texto)) || comandoDe(texto, eco, NAO, fj))) { mostrarJulio(texto, false); agendarFim(); return; }
      if (comandoDe(texto, eco, CORRIGE, fj) || palavrasNovas(texto, eco) >= minimo) {
        fj.antes = texto;   // o que veio até aqui pode começar com o fim da minha frase (eco); o que vier depois é do Júlio
        interromper({ motivo: 'voz' }); fj.interrompeu = true;
      } else { mostrarJulio(texto, false, true); agendarFim(); return; }   // eco (ou ainda curto demais para saber)
    } else if (J.turno && !fj.cancelouPensando && !fj.interrompeu) {
      // o Júlio voltou a falar enquanto eu pensava (ou rodava uma ferramenta): não respondo por cima; a fala nova junta
      // com a anterior. Se a fala começou com a minha voz no ar, ou logo depois, o eco dela não conta como palavra nova
      const veioDoEco = (fj.durante || fj.naJanela) && !semEco();
      if (palavrasNovas(texto, veioDoEco ? eco : VAZIO) >= minimo) { interromper({ motivo: 'voz', silencioso: true }); fj.cancelouPensando = true; }
    }
    mostrarJulio(texto, false);
    agendarFim();
  }
  // fim da fala: resultado final + 700 ms sem palavra nova; parcial parado por 1,2 s também conta (JARVIS.md §7.8).
  // Parou num conector ("as vendas de…", "e", "que"): a frase ainda não acabou, espera mais
  const CONECTORES = new Set(['e', 'de', 'do', 'da', 'dos', 'das', 'que', 'pra', 'para', 'o', 'a', 'os', 'as', 'com', 'no', 'na', 'nos', 'nas', 'mas', 'ou', 'um', 'uma', 'em', 'por', 'se']);
  function agendarFim() {
    const fj = J.falaJulio; if (!fj) return;
    clearTimeout(fj.timer);
    if (J.mic.ptt) return;   // segurando Espaço: só termina ao soltar
    const ps = palavrasDe(textoFala(fj)), conector = CONECTORES.has(ps[ps.length - 1] || '');
    fj.timer = setTimeout(concluirFala, fj.parcial ? (conector ? 1800 : 1200) : (conector ? 1500 : 700));
  }
  function concluirFala() {
    const fj = J.falaJulio; if (!fj) return;
    clearTimeout(fj.timer);
    J.falaJulio = null;
    let texto = textoFala(fj);
    if (!texto) { limparJulio(); return; }
    if (fj.parcial) ignorarPrefixo(fj.parcial);   // o resultado final desse trecho ainda vai chegar: não vira fala nova
    const eco = mesclarEco(fj);
    const parar = comandoDe(texto, eco, SO_PARAR, fj);
    if (fj.descartar && (parar || SO_PARAR.has(curto(texto)))) { limparJulio(); return; }   // "para" sozinho: já parei
    // resposta ao cartão: "pode enviar" só pela fala inteira (e com as regras do respostaAcao); "cancela" também vale
    // depois do meu eco, menos quando fui eu que acabei de dizer a palavra
    const k0 = curto(texto), ecoPossivel = (fj.durante || fj.naJanela) && !fj.ptt;
    const resposta = !J.acao ? null : SIM.has(k0) ? 'confirmar' : (ecoPossivel ? comandoDe(texto, eco, NAO, fj) : NAO.has(k0)) ? 'recusar' : null;
    if (!fj.interrompeu && !fj.ptt && !parar && !resposta && !comandoDe(texto, eco, CORRIGE, fj) && !semEco()) {
      const novas = palavrasNovas(texto, eco), ecos = palavrasEco(texto, eco);
      // começou enquanto eu falava sem nenhuma palavra nova, ou com uma só no meio do que eu disse: era a minha voz
      if (fj.durante && (novas === 0 || (novas < 2 && ecos >= 2))) { limparJulio(); return; }
      // começou logo depois de eu parar (eco atrasado): descarta só se for tudo eco
      if (fj.naJanela && todasEco(texto, eco)) { limparJulio(); return; }
    }
    if (fj.interrompeu && !fj.ptt && fj.antes) texto = tirarEcoInicial(texto, eco, fj.antes.split(/\s+/).filter(Boolean).length);
    const k = curto(texto);
    if (parar || SO_PARAR.has(k)) {
      // "Jarvis" sozinho, comigo calado: quem chama uma pessoa pelo nome espera resposta (frase da interface)
      if (k === 'jarvis' && !falandoAgora() && !J.turno) { mostrarJulio(texto, true); falarLocal('Pois não?'); return; }
      pararSo(); limparJulio(); return;
    }
    if (FECHAR.test(k)) { fechar(); return; }
    if (resposta && respostaAcao(resposta, { fj, texto })) return;
    enviar(texto, { origem: 'voz', jaFiltrada: true });
  }
  // a fala que interrompeu pode começar com o fim da minha frase (eco): tira o começo que é eco, só no pedaço que veio
  // até a interrupção (o que veio depois é do Júlio, mesmo repetindo palavras minhas: é o jeito normal de responder)
  function tirarEcoInicial(texto, eco, nAntes) {
    const ps = texto.split(/\s+/).filter(Boolean);
    const lim = Math.min(nAntes, ps.length - 1);
    let i = 0;
    while (i < lim) {
      const w = palavrasDe(ps[i]).join('');
      if (!w || eco.has(w) || (conteudo(w) && ehEco(w, eco))) i++; else break;
    }
    return ps.slice(i).join(' ');
  }
  function mostrarJulio(texto, final, eco = false) {
    el.lgJulio.hidden = false;
    el.lgJulio.classList.remove('apagada');
    // fala comprida: a legenda mostra o fim (as palavras mais novas), com reticências no começo
    el.lgJulioTxt.textContent = texto.length > 96 ? `…${texto.slice(-94).replace(/^\S*\s/, '')}` : texto;
    el.lgJulioTxt.title = texto;
    el.lgJulio.classList.toggle('parcial', !final);
    el.lgJulio.classList.toggle('eco', !!eco);
  }
  // fala descartada (eco, "para" sozinho): some da legenda
  function limparJulio() { el.lgJulio.classList.add('parcial'); setTimeout(() => { if (!J.falaJulio) el.lgJulio.classList.add('apagada'); }, 200); }

  /* ---------- microfone ---------- */
  function micDisponivel() { return J.disp.voz !== false && ouvido.suportado; }
  async function ligarMic({ temporario = false } = {}) {
    // o microfone só abre com o modo Jarvis aberto (e não saindo), e nunca com o portão do rosto na tela
    if (!micDisponivel() || !J.aberto || J.saindo || J.portao) return false;
    J.mic.querLigado = true; J.mic.temporario = temporario; J.mic.erro = null;
    atualizarMic();
    const este = ouvido;
    try {
      await este.ligar();
      if (!J.aberto || J.saindo || J.portao || este !== ouvido) { J.mic.querLigado = false; este.pausar(); atualizarMic(); return false; }
      if (!temporario) gravarPref('jarvis-mic', 'ligado');
    } catch (err) {
      J.mic.querLigado = false;
      const c = (err && err.codigo) || 'erro';
      if (este !== ouvido || !J.aberto || J.saindo) { atualizarMic(); return false; }
      // 423: a trava do rosto fechou (virou o dia): o portão e, liberado, o microfone de novo
      if (c === 'trava') { atualizarMic(); pedirPortao({ religarMic: !temporario }); return false; }
      // falta o pacote de voz do Chrome: a oferta de baixar (com o tamanho)
      if (c === 'sem-pacote') { atualizarMic(); abrirPacote(); return false; }
      aoErroMic(c, err && err.message !== c ? err.message : undefined);
    }
    atualizarMic();
    return J.mic.querLigado;
  }
  function pausarMic({ lembrar = true } = {}) {
    J.mic.querLigado = false; J.mic.temporario = false;
    ouvido.pausar();
    if (lembrar) gravarPref('jarvis-mic', 'pausado');
    if (J.falaJulio) { clearTimeout(J.falaJulio.timer); J.falaJulio = null; }
    hud.nivel(null);
    atualizarMic();
  }
  // a janela do app (Edge com --app) não tem barra de endereço nem cadeado: o caminho é o menu … da janela
  const MIC_NEGADO = LOCAL_APP
    ? 'Você não liberou o microfone. No menu … da janela, abra as permissões do site e permita o microfone. Se foi o Windows: Configurações › Privacidade › Microfone.'
    : 'Você não liberou o microfone. Clique no cadeado da barra de endereço e permita o microfone.';
  const ERRO_MIC = {
    negado: MIC_NEGADO,
    'not-allowed': MIC_NEGADO,
    'service-not-allowed': 'O reconhecimento de voz está bloqueado neste navegador (política da máquina). Siga pela caixa de texto.',
    'sem-microfone': 'Não encontrei nenhum microfone. Conecte um e tente de novo; enquanto isso, digite.',
    'audio-capture': 'O microfone não respondeu. Confira se ele está conectado.',
    'em-uso': 'O microfone está sendo usado por outro programa (Teams, Zoom…). Feche e tente de novo.',
    'sem-suporte': 'Este navegador não reconhece voz. Use o Edge ou digite.',
    network: 'O reconhecimento de voz precisa de internet e a conexão falhou. Vou tentando; enquanto isso, digite.',
    erro: 'O microfone não ligou. Tente de novo ou digite.'
  };
  // textos do ouvido do Chrome (js/ouvido-remoto.js): valem quando ele é o ouvido da vez (o "negado" de lá é o do Windows
  // bloqueando o Chrome, não o cadeado do Edge)
  const textoMic = (codigo) => (ouvido.remoto && M && M.o.TEXTOS_OUVIDO[codigo]) || ERRO_MIC[codigo] || (M && M.o.TEXTOS_OUVIDO[codigo]) || ERRO_MIC.erro;
  function aoErroMic(codigo, mensagem) {
    if (codigo === 'network') { avisar(ERRO_MIC.network, 5000, 'rever'); return; }
    J.mic.erro = codigo; J.mic.querLigado = false;
    try { ouvido.pausar(); } catch { /* nada */ }
    // a trava fechou com o microfone ligado (o vigia do servidor: virou o dia) — sem ação do Júlio, que pode nem estar na
    // mesa: o portão mostra só o cartão "Jarvis travado" e a câmera liga no clique
    if (codigo === 'trava') { atualizarMic(); pedirPortao({ religarMic: true, pedirClique: true }); return; }
    if (codigo === 'sem-pacote') { J.mic.erro = null; atualizarMic(); abrirPacote(); return; }
    // o Chrome sumiu, este Chrome não tem o pacote de voz em português ou o app não tem o ouvido novo: fica o ouvido do
    // Edge, sem perder a conversa
    if (ouvido.remoto && (codigo === 'sem-chrome' || codigo === 'sem-rota' || codigo === 'pacote-indisponivel')) {
      J.mic.erro = null;
      avisar(`${textoMic(codigo)} Vou pelo ouvido do Edge.`, 7000, 'rever');
      usarOuvido('edge', { religar: true });
      return;
    }
    // outra janela do Jarvis pegou o microfone: não é erro
    if (codigo === 'outra-aba') { J.mic.erro = null; avisar(textoMic(codigo), 4000); atualizarMic(); return; }
    avisar(ouvido.remoto ? textoMic(codigo) : (ERRO_MIC[codigo] || mensagem || ERRO_MIC.erro), 6500, 'alerta');
    atualizarMic();
  }
  // avisos do ouvido do Chrome que não param nada
  function aoAvisoOuvido(codigo, dados) {
    if (!M) return;
    const T = M.o.TEXTOS_OUVIDO;
    if (codigo === 'instalando') { avisar(T.instalando, 30000); leitura('mic', 'BAIXANDO'); }
    else if (codigo === 'caiu') avisar(T.religando, 4500, 'rever');
    else if (codigo === 'reconectando') avisar(T.reconectando, 3000, 'rever');
    else if (codigo === 'erro-remoto') { try { console.warn('[Jarvis] o ouvido do Chrome avisou:', dados && dados.codigo); } catch { /* nada */ } }
  }
  function atualizarMic() {
    const ligado = !!(J.mic.querLigado && ouvido.ativo);
    raiz.classList.toggle('mic-ligado', ligado);
    el.mic.setAttribute('aria-pressed', String(ligado));
    el.mic.setAttribute('aria-label', ligado ? 'Microfone ligado. Clique para pausar.' : 'Microfone pausado. Clique para ligar.');
    el.mic.title = ligado ? 'Pausar o microfone' : 'Ligar o microfone';
    el.micIco.innerHTML = ligado ? ICO.mic : ICO.micOff;
    el.micRot.textContent = J.mic.ptt ? 'Falando…' : ligado ? 'Ouvindo' : 'Microfone';
    el.mic.hidden = !micDisponivel();
    el.dicaVoz.hidden = !micDisponivel();
    if (!J.portao) leitura('mic', ligado ? 'LIGADO' : J.mic.erro ? 'BLOQUEADO' : micDisponivel() ? 'PAUSADO' : '—');
    atualizarEstado();
  }
  // o aceite do microfone vale para o ouvido da vez: o do Chrome tem o seu (o texto e o pacote de voz são outros)
  const chaveAceite = () => (ouvido.remoto ? 'jarvis-mic-aceito-chrome' : 'jarvis-mic-aceito');
  const aceitouMic = () => SIM_MODO || lerPref(chaveAceite(), '0') === '1';
  function aoBotaoMic() {
    if (J.mic.querLigado) { pausarMic(); return; }
    if (!aceitouMic()) { abrirConsent(); return; }
    ligarMic();
  }
  function abrirConsent() {
    el.consTxt.innerHTML = ouvido.remoto ? CONSENT_CHROME : CONSENT_EDGE;
    el.consent.hidden = false; try { el.consSim.focus({ preventScroll: true }); } catch { /* nada */ }
  }
  function fecharConsent() { el.consent.hidden = true; }

  /* ---------- o pacote de voz do Chrome (só uma vez, ~300 MB; o servidor só baixa por pedido explícito) ---------- */
  function abrirPacote() {
    if (!ouvido.remoto || !J.aberto || J.saindo) return;
    fecharConsent();
    el.pacSim.textContent = M ? M.o.TEXTOS_OUVIDO.baixar : 'Baixar o pacote de voz';
    el.pacSim.disabled = false; el.pacNao.disabled = false; el.pacSim.hidden = false;
    el.pacSt.textContent = ''; delete el.pacSt.dataset.tom;
    el.pacote.hidden = false;
    try { el.pacSim.focus({ preventScroll: true }); } catch { /* nada */ }
  }
  function fecharPacote() { el.pacote.hidden = true; }
  async function baixarPacote() {
    if (!ouvido.remoto || J.baixando) return;
    const este = ouvido;
    J.baixando = true;
    el.pacSim.disabled = true; el.pacNao.disabled = true;
    el.pacSt.textContent = M.o.TEXTOS_OUVIDO.instalando; delete el.pacSt.dataset.tom;
    leitura('mic', 'BAIXANDO');
    const t0 = agora();
    // numa internet mais lenta os ~300 MB levam minutos: o servidor continua esperando o Chrome (até 10 min), e a tela diz
    const tAinda = setTimeout(() => { if (J.baixando && este === ouvido) el.pacSt.textContent = M.o.TEXTOS_OUVIDO.ainda || M.o.TEXTOS_OUVIDO.instalando; }, 90000);
    let e = null;
    try { e = await este.instalar(); } catch { e = null; }
    clearTimeout(tAinda);
    J.baixando = false;
    if (este !== ouvido || !J.aberto) return;
    if (e && e.pacote === 'available') {
      el.pacSt.textContent = `Pacote de voz baixado em ${Math.max(1, Math.round((agora() - t0) / 1000))} s.`; el.pacSt.dataset.tom = 'ok';
      atualizarAjustes();
      setTimeout(() => { fecharPacote(); if (J.aberto && !J.saindo) ligarMic(); }, 700);
      return;
    }
    const c = ouvido.motivo || 'pacote-falhou';
    el.pacSt.textContent = M.o.TEXTOS_OUVIDO[c] || M.o.TEXTOS_OUVIDO['pacote-falhou']; el.pacSt.dataset.tom = 'alerta';
    // este Chrome não tem o pacote (ou não reconhece voz): baixar de novo não adianta; fica o Edge
    const semJeito = c === 'pacote-indisponivel' || c === 'sem-suporte';
    el.pacSim.disabled = semJeito; el.pacNao.disabled = false;
    if (semJeito) el.pacSim.hidden = true;
    atualizarMic();
    if (semJeito) setTimeout(() => { fecharPacote(); el.pacSim.hidden = false; if (J.aberto && !J.saindo) usarOuvido('edge', { religar: true }); }, 4500);
  }

  /* ---------- qual ouvido: Chrome (offline) ou Edge ---------- */
  function criarOuvidoEdge() {
    // o vigia do Edge vazio (js/ouvido-remoto.js) precisa entrar ANTES do criarOuvido: ele troca o construtor
    if (M && !VIGIA_EDGE.w) {
      try {
        VIGIA_EDGE.w = M.o.vigiarEdge({ aoVazio: () => VIGIA_EDGE.aviso && VIGIA_EDGE.aviso(), nivel: () => VIGIA_EDGE.nivel && VIGIA_EDGE.nivel() });
      } catch { /* sem vigia */ }
    }
    VIGIA_EDGE.aviso = () => {
      if (!J.aberto || ouvido !== ouvidoEdge) return;
      // "use o Chrome" só quando ele existe e serve; sem ele, o caminho que existe (instalar o Chrome, ou digitar)
      const T = M.o.TEXTOS_OUVIDO;
      const txt = chromeExiste() ? `${T['edge-vazio']} Troque em Ajustes › Ouvido: Chrome.`
        : `${T['edge-vazio-so']} ${ouvidoChrome && ouvidoChrome.motivo === 'pacote-indisponivel' ? T['pacote-indisponivel'] : T['sem-chrome']}`;
      avisar(txt, 9000, 'alerta');
    };
    VIGIA_EDGE.nivel = () => { const n = ouvidoEdge && ouvidoEdge.ativo ? ouvidoEdge.nivel() : null; return n ? n.db : null; };
    return criarOuvido(H_OUVIDO, sons);
  }
  const chromeExiste = () => !!(J.disp.ouvido && J.disp.ouvido.estado && J.disp.ouvido.estado !== 'sem-chrome' && (!ouvidoChrome || ouvidoChrome.suportado));
  // a preferência (Ajustes › Ouvido): 'chrome' | 'edge'; sem ela, o Chrome quando o servidor diz que ele existe
  function ouvidoPreferido() {
    const p = lerPref('jarvis-ouvido', '');
    if (p === 'edge') return 'edge';
    return chromeExiste() ? 'chrome' : 'edge';
  }
  function usarOuvido(tipo, { religar = false } = {}) {
    if (SIM_MODO) return;
    let novo;
    if (tipo === 'chrome' && LOCAL_APP && M && chromeExiste()) {
      if (!ouvidoChrome) ouvidoChrome = M.o.criarOuvidoRemoto(H_OUVIDO, sons, { token: tokenLocal(), aba: ABA });
      novo = ouvidoChrome;
    } else {
      if (!ouvidoEdge) ouvidoEdge = criarOuvidoEdge();
      novo = ouvidoEdge;
    }
    if (novo === ouvido) { atualizarAjustes(); return; }
    const estava = J.mic.querLigado && !J.mic.temporario;
    if (J.mic.querLigado) pausarMic({ lembrar: false });
    ouvido = novo;
    J.mic.erro = null;
    atualizarAjustes(); atualizarMic();
    if ((estava || religar) && J.aberto && !J.saindo && !J.portao) {
      if (aceitouMic()) ligarMic(); else abrirConsent();
    }
  }
  function escolherOuvido() {
    if (SIM_MODO || !LOCAL_APP) return;
    if (M) { usarOuvido(ouvidoPreferido()); return; }
    // os módulos do app não carregaram: fica o ouvido do Edge, como antes
    if (ouvido === OUVIDO_NADA) { ouvidoEdge = ouvidoEdge || criarOuvido(H_OUVIDO, sons); ouvido = ouvidoEdge; }
  }

  /* ---------- a trava do rosto: o portão (js/rosto.js); quem decide é o servidor ---------- */
  // os módulos só do app do computador (no link e no arquivo único nunca carregam)
  function carregarModulos() {
    if (!LOCAL_APP) return Promise.resolve(null);
    if (M) return Promise.resolve(M);
    return (pModulos ||= Promise.all([import('./ouvido-remoto.js'), import('./rosto.js')])
      .then(([o, r]) => { M = { o, r }; return M; })
      .catch((err) => { pModulos = null; try { console.warn('[Jarvis] o ouvido e a trava do rosto não carregaram.', err); } catch { /* nada */ } return null; }));
  }
  function garantirPortao() {
    if (portao || !M) return portao;
    try {
      portao = M.r.criarPortao({
        raiz, token: tokenLocal(), sons: { tocar: (n) => tocar(n) }, falar: (f) => falarLocal(f), reduzido,
        // antes do HUD entrar, a lente abre onde o núcleo vai nascer
        hud: { centro: () => (hud.modo === 'fechado' ? hud.previsto() : hud.centro()) }, saudar: false,
        onEstado: (nome, info) => { J.portaoEstado = nome; J.portaoCamera = !!(info && info.camera); atualizarEstado(); }
      });
    } catch (err) { portao = null; try { console.warn('[Jarvis] o portão do rosto não abriu.', err); } catch { /* nada */ } }
    return portao;
  }
  // um fluxo do portão (conferir, cadastrar, Windows Hello, apagar) com o Jarvis parado: microfone fechado, voz e turno
  // cortados, ajustes fechados; o microfone volta no fim se estava ligado (menos depois de "não liberou")
  async function comPortao(fn, tipo = 'outro') {
    if (J.portaoP) return J.portaoP;
    // dono: o fechar() do Jarvis solta o portão na hora; o fluxo velho, quando enfim terminar, não mexe no estado do novo
    const dono = {};
    J.portaoDono = dono;
    const meu = () => J.portaoDono === dono;
    const p = (async () => {
      const voltarMic = J.mic.querLigado && !J.mic.temporario;
      J.portao = true; J.portaoTipo = tipo;
      fecharAjustes(); fecharConsent(); fecharPacote();
      J.mic.ptt = false;
      if (J.mic.querLigado) pausarMic({ lembrar: false });
      if (falandoAgora() || J.turno) interromper({ motivo: 'comando', silencioso: true });
      atualizarEstado();
      let r;
      try { r = await fn(); } finally {
        if (meu()) {
          J.portao = false; J.portaoTipo = null; J.portaoEstado = null; J.portaoCamera = false;
          // o que o portão ainda dizia ("Pisque duas vezes.") não vale mais: sai da voz e da legenda
          if (F.frases.length) { voz.parar(); limparFila({ manterDitas: false }); }
          atualizarEstado();
        }
      }
      if (meu() && voltarMic && tipo !== 'abrir' && J.aberto && !J.saindo && aceitouMic()) ligarMic();
      return r;
    })();
    J.portaoP = p;
    try { return await p; } finally { if (J.portaoP === p) J.portaoP = null; if (meu()) J.portaoDono = null; }
  }
  // 423 no meio da conversa (virou o dia, "Travar agora"): o portão por cima do HUD; liberado, refaz o que parou;
  // "Agora não" fecha o Jarvis. pedirClique: aberto sem ação do Júlio (o vigia, "Travar agora") — só o cartão
  // "Jarvis travado", a câmera liga no clique
  async function pedirPortao({ refazer = null, religarMic = false, pedirClique = false } = {}) {
    if (J.portaoP) return J.portaoP;
    if (!garantirPortao() || !J.aberto || J.saindo) return { liberado: false };
    const ab = J.nAbrir;
    const r = await comPortao(() => portao.abrir({ pedirClique }), 'abrir');
    // o Jarvis fechou (ou fechou e abriu de novo) enquanto o portão estava na tela: nada daqui vale mais
    if (!J.aberto || J.saindo || ab !== J.nAbrir) return r;
    if (!r || !r.liberado) { fechar(); return r || { liberado: false }; }
    if (refazer) enviar(refazer, { origem: 'voz', jaFiltrada: true });
    else falarLocal('Liberado. Pode seguir.');
    if (religarMic && micDisponivel() && aceitouMic()) ligarMic();
    return r;
  }

  /* ---------- ajustes do app do computador: ouvido e trava ---------- */
  function atualizarAjustes() {
    el.privTxt.textContent = ouvido.remoto ? PRIV_CHROME : PRIV_EDGE;
    el.secOuvido.hidden = !(LOCAL_APP && M && !SIM_MODO);
    el.secTrava.hidden = !(LOCAL_APP && portao);
    if (!el.secOuvido.hidden) {
      const tem = chromeExiste();
      el.ouvidoSel.value = ouvido.remoto ? 'chrome' : 'edge';
      el.ouvidoSel.querySelector('option[value="chrome"]').disabled = !tem;
      el.ouvidoNota.textContent = !tem ? (ouvidoChrome && ouvidoChrome.motivo === 'pacote-indisponivel' ? 'Este Chrome não tem o pacote de voz em português: fica o Edge.' : 'Não achei o Google Chrome neste computador: fica o Edge.')
        : ouvido.remoto ? 'O Chrome ouve aqui mesmo, escondido: o áudio não sai deste computador.'
          : 'O reconhecimento do Edge está devolvendo vazio desde a atualização de 18/10. Prefira o Chrome.';
      const baixar = !!(ouvido.remoto && ouvido.precisaBaixar && ouvido.precisaBaixar());
      el.pacoteBtn.hidden = !baixar;
      el.pacoteBtn.textContent = M.o.TEXTOS_OUVIDO.baixar;
    }
  }
  async function atualizarTrava() {
    if (el.secTrava.hidden || !portao) return;
    const st = await portao.consultar();
    if (!st) { el.travaNota.textContent = 'O app do cérebro não respondeu.'; return; }
    const hora = st.em ? new Date(st.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '';
    const como = { rosto: 'pelo rosto', hello: 'pelo Windows Hello', cadastro: 'pelo cadastro' }[st.metodo] || '';
    el.travaNota.textContent = [
      st.trava_aberta ? 'Trava desligada (modo de teste).' : st.liberado ? `Liberado hoje${como ? ` ${como}` : ''}${hora ? ` às ${hora}` : ''}.` : 'Travado.',
      st.cadastro && st.cadastro.rosto ? `Rosto cadastrado (${st.cadastro.amostras} amostras).` : 'Sem rosto cadastrado.',
      st.hello && st.hello.cadastrado ? 'Windows Hello cadastrado.' : 'Windows Hello não cadastrado.'
    ].join(' ');
    el.hello.hidden = !!(st.hello && st.hello.cadastrado);
    el.recadastrar.textContent = st.cadastro && st.cadastro.rosto ? 'Cadastrar o rosto de novo' : 'Cadastrar o rosto';
    el.apagar.hidden = !(st.cadastro && st.cadastro.rosto) && !(st.hello && st.hello.cadastrado);
  }

  /* ---------- Espaço = falar (push-to-talk), e interrompe na hora ---------- */
  function emCampoTexto(a) {
    if (!a) return false;
    if (a.isContentEditable || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
    if (a.tagName === 'INPUT') return !/^(checkbox|radio|button|submit|reset|color|file)$/i.test(a.type || '');
    return false;
  }
  async function pttInicio() {
    if (J.mic.ptt || !micDisponivel() || !J.aberto || J.saindo || J.portao) return;
    J.mic.ptt = true;
    J.pttSemResposta = !!J.turno && !J.msgTurno;   // apertou com a pergunta ainda sem nada dito da resposta
    interromper({ motivo: 'ptt' });
    // fala nova: o que o microfone ouvia antes (o meu eco pelo alto-falante) não gruda no começo da pergunta
    const velha = J.falaJulio, nova = novaFalaJulio();
    nova.ptt = true; nova.interrompeu = true;   // o que vier agora é fala nova, não eco
    if (velha) {
      clearTimeout(velha.timer);
      if (!velha.durante && !velha.naJanela && !velha.descartar) nova.finais = textoFala(velha);   // era o Júlio falando: segue a mesma fala
      if (velha.parcial) ignorarPrefixo(velha.parcial);   // o trecho em curso do reconhecimento ainda traz o que veio antes
    }
    J.falaJulio = nova;
    if (!J.mic.querLigado) {
      if (!aceitouMic()) { J.mic.ptt = false; J.falaJulio = null; abrirConsent(); return; }
      await ligarMic({ temporario: true });
    }
    atualizarMic();
  }
  function pttFim() {
    if (!J.mic.ptt) return;
    J.mic.ptt = false;
    atualizarMic();
    // espera o resultado final chegar (até ~0,6 s) e envia; o final que chegar depois disso é tirado pelo prefixo
    setTimeout(() => {
      const fj = J.falaJulio;
      if (fj && textoFala(fj)) concluirFala();
      else {
        if (fj && fj.ptt) J.falaJulio = null;
        // segurou o Espaço com a pergunta sem resposta e não disse nada: era só para parar (a pergunta sai)
        const ult = J.conversa[J.conversa.length - 1];
        if (J.pttSemResposta && !J.turno && ult && ult.papel === 'julio') J.conversa.pop();
      }
      J.pttSemResposta = false;
      if (J.mic.temporario) pausarMic({ lembrar: false });
    }, 650);
  }

  /* ---------- confirmação de ação ---------- */
  const TIPO_ACAO = { enviar_email: 'enviar e-mail' };
  const CAMPO = { de: 'De', para: 'Para', cc: 'Cópia', cco: 'Cópia oculta', assunto: 'Assunto', corpo: 'Texto', em_resposta_a: 'Em resposta a', anexos: 'Anexos', observacao: 'Observação' };
  const DICA_VOZ = el.confVozTxt ? el.confVozTxt.innerHTML : '';
  const daLube = (e) => /@lube\.com\.br$/i.test(String(e || '').trim());
  const listaDe = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : String(v).split(/[,;]\s*/)).map((x) => String(x).trim()).filter(Boolean);
  // o rascunho inteiro, sem cortar nada (o texto e os destinatários rolam dentro do cartão): o Júlio confirma o que vê.
  // Destinatário fora de @lube.com.br vem em vermelho, com o rótulo
  function detalheAcaoHtml(d) {
    if (!d) return '';
    if (typeof d !== 'object') return `<p>${escHtml(String(d))}</p>`;
    const linhas = Object.entries(d).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => {
      const dd = (k === 'para' || k === 'cc' || k === 'cco')
        ? listaDe(v).map((e) => (daLube(e) ? `<span class="jv-end">${escHtml(e)}</span>` : `<span class="jv-end" data-fora="1">${escHtml(e)}<em>fora da Lube</em></span>`)).join('')
        : escHtml(Array.isArray(v) ? v.join(', ') : String(v));
      return `<div class="jv-cd-${escHtml(k)}"><dt>${escHtml(CAMPO[k] || k.replace(/_/g, ' '))}</dt><dd>${dd}</dd></div>`;
    });
    const dest = [...listaDe(d.para), ...listaDe(d.cc), ...listaDe(d.cco)], fora = dest.filter((e) => !daLube(e)).length;
    const corpo = typeof d.corpo === 'string' ? d.corpo : '';
    const conta = dest.length
      ? `<p class="jv-conf-conta">${dest.length} ${dest.length === 1 ? 'destinatário' : 'destinatários'}${fora ? ` · <b>${fora} fora da Lube</b>` : ''}${corpo ? ` · ${corpo.length.toLocaleString('pt-BR')} caracteres no texto` : ''}</p>`
      : '';
    return `<dl>${linhas.join('')}</dl>${conta}`;
  }
  function dicaAcao(msg) {
    if (!J.acao || J.decidindo) return;
    el.confRes.hidden = false; el.confRes.textContent = msg; delete el.confRes.dataset.tom;
  }
  function atualizarDicaAcao() {
    if (!el.confVozTxt) return;
    el.confVozTxt.innerHTML = J.acao && J.acao.nFalas !== J.nFalas ? 'A conversa seguiu: agora este rascunho só se confirma pelo botão.' : DICA_VOZ;
  }
  function abrirAcao(a) {
    if (!a || !a.id) return;
    const trocou = !!(J.acao && J.acao.id !== a.id);
    if (trocou) {
      // só um rascunho por vez: o anterior sai (o servidor já trocou; o aviso dele diz "trocado", não "cancelado")
      const velha = J.acao; J.cerebro?.decidirAcao(velha.id, 'recusar', 'substituida').catch(() => {});
      clearTimeout(J.confVoz?.timer); J.confVoz = null;
    }
    // a ação expira em 5 min (o servidor pode mandar a hora exata em expira_em)
    let resta = 5 * 60000;
    const exp = typeof a.expira_em === 'number' ? a.expira_em : Date.parse(a.expira_em || '');
    if (Number.isFinite(exp)) { const r = exp - Date.now(); if (r > 0 && r <= 10 * 60000) resta = r; }
    J.acao = { ...a, expira: agora() + resta, total: Math.max(resta, 1), desde: agora(), nFalas: J.nFalas, trocou };
    J.decidindo = false;
    el.confTipo.textContent = TIPO_ACAO[a.tipo] || String(a.tipo || 'ação').replace(/_/g, ' ');
    el.confTit.textContent = String(a.resumo || 'Ação pendente');
    el.confDet.innerHTML = detalheAcaoHtml(a.detalhe);
    el.confDet.scrollTop = 0;
    el.confRes.hidden = !trocou; el.confRes.textContent = trocou ? 'O rascunho mudou: este é o novo. Confira antes de confirmar.' : ''; delete el.confRes.dataset.tom;
    // rascunho trocado: Confirmar só depois de 1,5 s (ninguém confirma o novo achando que é o velho)
    el.confSim.disabled = trocou; el.confNao.disabled = false;
    clearTimeout(J.acaoLibera);
    if (trocou) J.acaoLibera = setTimeout(() => { if (J.acao && J.acao.id === a.id && !J.decidindo) el.confSim.disabled = false; }, 1500);
    atualizarDicaAcao();
    el.conf.hidden = false;
    raiz.classList.add('com-acao');
    tocar('confirmacao');
    clearInterval(J.acaoT);
    J.acaoT = setInterval(tickAcao, 250); tickAcao();
    atualizarEstado();
  }
  // "pode enviar" / "cancela" valem para o cartão aberto só se: é o mesmo rascunho de quando a fala começou, ninguém
  // falou outra coisa desde que ele abriu (senão o "sim" é resposta a outra pergunta e vai para o cérebro) e, se o
  // rascunho acabou de trocar, o novo já está na tela há 1,5 s. Para CONFIRMAR por voz, a fala ainda precisa ter começado com a minha voz calada há
  // 1,5 s (ou pelo Espaço): o microfone nunca confirma o que o alto-falante disse. Devolve true se tratou a fala.
  function respostaAcao(dec, { fj = null, texto = '' } = {}) {
    const a = J.acao;
    if (!a) return false;
    if (J.decidindo) return true;
    if (J.nFalas !== a.nFalas) return false;
    mostrarJulio(texto, true);
    if (fj && fj.acaoId !== a.id) { dicaAcao('O rascunho mudou enquanto você falava. Confira e responda de novo.'); return true; }
    if (a.trocou && agora() - a.desde < 1500) { dicaAcao('O rascunho acabou de mudar. Confira antes de responder.'); return true; }
    if (dec === 'confirmar' && fj && !fj.ptt && (fj.durante || fj.naJanela) && voz.tipo !== 'relogio') {
      dicaAcao(fj.durante ? 'Para confirmar, use o botão ou diga de novo quando eu terminar de falar.'
        : 'Você falou logo depois de mim e não dá para separar da minha voz: diga de novo ou use o botão.');
      return true;
    }
    if (dec === 'confirmar' && fj) { agendarConfirmacao(texto, fj); return true; }
    decidir(dec);
    return true;
  }
  // por voz, a confirmação espera mais 1,2 s de silêncio ("pode enviar… mas muda o assunto" não envia nada)
  function agendarConfirmacao(texto, fj) {
    clearTimeout(J.confVoz?.timer);
    const id = J.acao.id;
    dicaAcao('Confirmando…');
    J.confVoz = {
      texto, durante: fj.durante, naJanela: fj.naJanela, ptt: fj.ptt,
      timer: setTimeout(() => {
        J.confVoz = null;
        if (J.acao && J.acao.id === id && !J.falaJulio) decidir('confirmar');
        else if (J.acao && J.acao.id === id) el.confRes.hidden = true;
      }, 1200)
    };
  }
  function tickAcao() {
    if (!J.acao) { clearInterval(J.acaoT); return; }
    const resta = Math.max(0, J.acao.expira - agora()), s = Math.ceil(resta / 1000);
    el.confTempo.textContent = `${Math.floor(s / 60)}:${doisDig(s % 60)}`;
    el.confResta.style.strokeDashoffset = String(100 - (resta / (J.acao.total || 5 * 60000)) * 100);
    if (resta <= 0 && !J.decidindo) {
      const id = J.acao.id; fecharAcao();
      J.cerebro?.decidirAcao(id, 'recusar', 'expirou').catch(() => {});
      falarLocal('O pedido de confirmação expirou. Se ainda quiser, eu preparo de novo.');
    }
  }
  async function decidir(decisao) {
    const a = J.acao;
    if (!a || J.decidindo || !J.cerebro || J.portao) return;
    J.decidindo = true;
    clearTimeout(J.confVoz?.timer); J.confVoz = null;
    // a decisão encerra o que eu estava dizendo ou ainda pensando sobre o rascunho
    if (falandoAgora() || J.turno) interromper({ motivo: 'comando', silencioso: true });
    el.confSim.disabled = true; el.confNao.disabled = true;
    el.confRes.hidden = false; el.confRes.textContent = decisao === 'confirmar' ? 'Enviando…' : 'Cancelando…';
    let r;
    try { r = await J.cerebro.decidirAcao(a.id, decisao); } catch { r = { ok: false, mensagem: 'Não consegui falar com o cérebro.' }; }
    if (J.acao !== a) return;
    if (r && r.trava) {
      // a trava do rosto fechou antes do envio: nada saiu. O portão abre; liberado, o Júlio confirma de novo (no botão)
      J.decidindo = false; el.confSim.disabled = false; el.confNao.disabled = false;
      el.confRes.textContent = 'Nada foi enviado: o Jarvis travou. Confira o rosto e confirme de novo.'; el.confRes.dataset.tom = 'alerta';
      const lib = await pedirPortao({});
      if (lib && lib.liberado && J.acao === a) dicaAcao('Liberado. Confira o rascunho e confirme de novo.');
      return;
    }
    const ok = !!(r && r.ok);
    const msg = String((r && r.mensagem) || (ok ? (decisao === 'confirmar' ? 'Pronto, enviado.' : 'Cancelado. Nada foi enviado.') : 'Não deu certo.'));
    el.confRes.textContent = msg;
    el.confRes.dataset.tom = ok ? (decisao === 'confirmar' ? 'ok' : '') : 'alerta';
    // o modelo precisa saber o que aconteceu. O app do computador já conta (o servidor põe o desfecho na mensagem de
    // sistema da próxima fala) e reconstrói cada turno pelo texto exato: lá a fala não pode ser editada. Nos outros
    // cérebros o resultado entra junto da última fala minha.
    if (J.cerebro.tipo !== 'local') {
      const ult = [...J.conversa].reverse().find((m) => m.papel === 'jarvis');
      const nota = ok ? (decisao === 'confirmar' ? `(O Júlio confirmou na tela. ${msg})` : `(O Júlio cancelou na tela. ${msg})`) : `(A ação falhou: ${msg})`;
      if (ult) ult.texto = `${ult.texto} ${nota}`.trim(); else J.conversa.push({ papel: 'jarvis', texto: nota });
    }
    falarLocal(msg);
    setTimeout(() => { if (J.acao === a) fecharAcao(); }, ok ? 1400 : 2600);
  }
  function fecharAcao() {
    J.acao = null; J.decidindo = false; clearInterval(J.acaoT); clearTimeout(J.acaoLibera);
    clearTimeout(J.confVoz?.timer); J.confVoz = null;
    el.conf.hidden = true; raiz.classList.remove('com-acao');
    atualizarEstado();
  }

  /* ---------- atividade (cada ferramenta vira um cartão holográfico) ---------- */
  function aoFerramenta(f) {
    const id = String(f.id || f.nome || Math.random());
    if (f.nome === 'mostrar_na_tela') return;   // o cartão já aparece na Exibição
    let li = el.atLista.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!li) {
      li = document.createElement('li');
      li.className = 'jv-at'; li.dataset.id = id;
      const d = new Date();
      li.innerHTML = '<i class="jv-at-ico" aria-hidden="true"></i><div class="jv-at-txt"><b></b><span></span></div><time></time>';
      li.querySelector('time').textContent = `${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`;
      el.atLista.prepend(li);
      while (el.atLista.children.length > 6) el.atLista.lastElementChild.remove();
      J.nFerr++; leitura('ferramentas', String(J.nFerr));
      hud.hexagono();
      if (!falandoAgora() && !J.falaJulio) tocar('ferramenta');
      raiz.classList.add('com-atividade');
    }
    const rot = String(f.rotulo || li.dataset.rotulo || ROTULO_FERR[f.nome] || String(f.nome || 'Ferramenta').replace(/_/g, ' '));
    li.dataset.rotulo = rot;
    li.querySelector('b').textContent = rot;
    li.querySelector('span').textContent = f.resumo ? String(f.resumo) : f.estado === 'inicio' ? 'em andamento…' : '';
    li.dataset.estado = f.estado === 'erro' ? 'erro' : f.estado === 'fim' ? 'fim' : 'inicio';
    if (f.estado === 'erro') { li.classList.remove('pisca'); void li.offsetWidth; li.classList.add('pisca'); }
  }

  // o turno acabou (interrompido, erro, saída) com ferramenta ainda "em andamento": o cartão para de girar e diz por quê
  function encerrarFerramentas(texto) {
    for (const li of el.atLista.querySelectorAll('.jv-at[data-estado="inicio"]')) {
      li.dataset.estado = 'parado';
      const s = li.querySelector('span'); if (s) s.textContent = texto;
    }
  }

  /* ---------- exibição (mostrar_na_tela): os cartões saem do núcleo e voam até a lateral ---------- */
  function cartaoHtml(tipo, d) {
    d = d || {};
    const tit = (t) => (t ? `<p class="jv-c-tit">${escHtml(t)}</p>` : '');
    switch (tipo) {
      case 'destaque':
        return `<p class="hud-rot">${escHtml(d.rotulo || 'Destaque')}</p><p class="jv-c-valor">${escHtml(typeof d.valor === 'number' ? fmtNum(d.valor) : d.valor ?? '—')}</p>${d.detalhe ? `<p class="jv-c-det">${escHtml(d.detalhe)}</p>` : ''}`;
      case 'lista':
        return `${tit(d.titulo)}<ul class="jv-c-lista">${(Array.isArray(d.itens) ? d.itens : []).slice(0, 10).map((i) => `<li>${escHtml(typeof i === 'object' ? (i.texto ?? JSON.stringify(i)) : i)}</li>`).join('')}</ul>`;
      case 'tabela': {
        const cols = (Array.isArray(d.colunas) ? d.colunas : []).slice(0, 6), linhas = (Array.isArray(d.linhas) ? d.linhas : []).slice(0, 8);
        return `${tit(d.titulo)}<div class="jv-c-tbl"><table><thead><tr>${cols.map((c) => `<th>${escHtml(c)}</th>`).join('')}</tr></thead><tbody>${linhas.map((l) => `<tr>${(Array.isArray(l) ? l : Object.values(l || {})).slice(0, 6).map((v) => `<td>${escHtml(typeof v === 'number' ? fmtNum(v) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      case 'barras': {
        const itens = (Array.isArray(d.itens) ? d.itens : []).slice(0, 12), max = Math.max(1e-9, ...itens.map((i) => Math.abs(Number(i.valor) || 0)));
        return `${tit(d.titulo)}<ul class="jv-c-barras">${itens.map((i) => `<li><span class="jv-b-rot">${escHtml(i.rotulo)}</span><span class="jv-b-barra"><i style="--v:${(Math.abs(Number(i.valor) || 0) / max).toFixed(3)}"></i></span><b>${escHtml(fmtNum(i.valor))}</b></li>`).join('')}</ul>`;
      }
      case 'nota': {
        const n = pagina.nota ? pagina.nota(d.nome) : null;
        return `<p class="hud-rot">Nota${n && n.departamento ? ` · ${escHtml(n.departamento)}` : ''}</p><p class="jv-c-tit">${escHtml(n ? n.nome : d.nome || 'Nota')}</p>${n && n.trecho ? `<p class="jv-c-det jv-c-trecho">${escHtml(n.trecho)}</p>` : n ? '' : '<p class="jv-c-det">Essa nota não está neste vault.</p>'}${n ? '<p class="jv-c-abre">Abre no leitor quando você sair do Jarvis.</p>' : ''}`;
      }
      case 'email':
        return `<p class="hud-rot">E-mail${d.quando ? ` · ${escHtml(d.quando)}` : ''}</p><p class="jv-c-tit">${escHtml(d.assunto || '(sem assunto)')}</p><p class="jv-c-de">${escHtml(d.de || '')}</p>${d.resumo ? `<p class="jv-c-det">${escHtml(d.resumo)}</p>` : ''}`;
      case 'rotina': {
        const r = pagina.rotina ? pagina.rotina(d.nome) : null;
        if (!r) return `<p class="hud-rot">Rotina</p><p class="jv-c-tit">${escHtml(d.nome || '')}</p><p class="jv-c-det">Essa rotina não está neste vault.</p>`;
        return `<p class="hud-rot">Rotina · ${escHtml(r.grupo || '')}</p><p class="jv-c-tit">${escHtml(r.titulo || d.nome)}</p><p class="jv-c-de">${escHtml([r.horarios, r.proxima ? `próxima ${r.proxima}` : ''].filter(Boolean).join(' · '))}</p>${r.saude ? `<p class="jv-c-saude" data-st="${escHtml(r.saude.status || '')}"><i></i>${escHtml(r.saude.resumo || r.saude.status || '')}</p>` : ''}<ol class="jv-c-funil">${(r.passos || []).slice(0, 6).map((p) => `<li data-tipo="${escHtml(p.tipo || '')}"><b>${escHtml(p.rotulo || '')}</b> ${escHtml(p.texto || '')}</li>`).join('')}</ol><p class="jv-c-abre">O funil abre quando você sair do Jarvis.</p>`;
      }
      default:
        return `${tit(d.titulo || tipo)}<p class="jv-c-det">${escHtml(typeof d === 'string' ? d : JSON.stringify(d).slice(0, 300))}</p>`;
    }
  }
  function mostrarCartao(c) {
    const tipo = String(c.tipo || ''), dados = c.dados || {};
    const art = document.createElement('article');
    art.className = `jv-cartao jv-tipo-${tipo.replace(/[^a-z]/gi, '')}`;   // jv-c-lista e jv-c-barras já são as listas de dentro (o cartão ficava sem padding)
    art.innerHTML = `${CANTOS}${cartaoHtml(tipo, dados)}`;
    el.cartoes.prepend(art);
    el.cartoes.scrollTop = 0; el.cartoes.scrollLeft = 0;   // o cartão novo fica à vista (no celular a faixa rola de lado)
    raiz.classList.add('com-cartoes');
    while (el.cartoes.children.length > 4) el.cartoes.lastElementChild.remove();
    if ((tipo === 'nota' && pagina.nota && pagina.nota(dados.nome)) || (tipo === 'rotina' && pagina.rotina && pagina.rotina(dados.nome))) J.pendenteAbrir = { tipo, nome: dados.nome };
    // voo: do núcleo até o lugar do cartão, 420 ms easeOutCubic (FLIP)
    if (reduzido() || typeof art.animate !== 'function') return;
    try {
      const r = art.getBoundingClientRect(), rr = raiz.getBoundingClientRect(), cc = hud.centro();
      const dx = rr.left + cc.x - (r.left + r.width / 2), dy = rr.top + cc.y - (r.top + r.height / 2);
      art.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(.18)`, opacity: 0, filter: 'brightness(2.4)' },
        { opacity: 1, offset: 0.35 },
        { transform: 'none', opacity: 1, filter: 'none' }
      ], { duration: 420, easing: 'cubic-bezier(.215,.61,.355,1)' });
    } catch { /* sem voo */ }
  }

  /* ---------- estado, leituras, avisos ---------- */
  function estadoAtual() {
    if (J.portao) return 'travado';   // o portão do rosto na tela: nada de turno, microfone ou confirmação
    if (!J.disp.ok && !J.carregandoCerebro) return 'sem-conexao';
    if (J.acao) return 'confirmando';
    if (agora() < J.interrompidoAte) return 'interrompido';
    if (falandoAgora()) return 'falando';
    if (J.turno) return 'pensando';
    if (J.mic.querLigado && ouvido.ativo) return 'ouvindo';
    return 'repouso';
  }
  function atualizarEstado() {
    if (!J.aberto) return;
    const e = estadoAtual();
    if (e !== J.estado) {
      J.estado = e;
      raiz.dataset.estado = e;
      hud.estado(e);
      el.chip.dataset.estado = e;
      el.chipTxt.textContent = ESTADO_ROT[e] || e;
    }
    // com o portão: ESTADO RECONHECIMENTO (ou CADASTRO); a câmera ligada aparece embaixo da lente, com o ponto vermelho
    if (e === 'travado') leitura('estado', /^cadastro/.test(J.portaoEstado || '') ? 'CADASTRO' : 'RECONHECIMENTO');
    else if (agora() >= J.rotuloInterrompidoAte) leitura('estado', e === 'pensando' && J.modelo === 'sonnet' ? 'ANÁLISE' : (ESTADO_ROT[e] || e).toUpperCase());
    else leitura('estado', 'INTERROMPIDO');
    el.parar.hidden = !(falandoAgora() || J.turno);
  }
  // o rótulo do modelo na leitura do HUD: no link o claude.ai escolhe o modelo (nível RÁPIDO / ANÁLISE); no app com o
  // cérebro de teste, TESTE
  function rotuloModelo(nome) {
    const pesado = nome === 'sonnet';
    if (J.cerebro && J.cerebro.tipo === 'link') return pesado ? 'ANÁLISE' : 'RÁPIDO';
    if (J.disp.simulado || (J.cerebro && J.cerebro.tipo === 'simulado')) return pesado ? 'TESTE · ANÁLISE' : 'TESTE';
    return pesado ? 'SONNET · ANÁLISE' : 'HAIKU';
  }
  function leitura(chave, valor) {
    const e = el.leituras[chave];
    if (e && e.textContent !== valor) { e.textContent = valor; e.classList.remove('rola'); void e.offsetWidth; e.classList.add('rola'); }
  }
  let avisoT = 0;
  function avisar(texto, ms = 3600, tom = '') {
    const a = el.aviso; if (!a) return;
    a.textContent = texto; if (tom) a.dataset.tom = tom; else delete a.dataset.tom;
    a.hidden = false; clearTimeout(avisoT);
    avisoT = setTimeout(() => { a.hidden = true; }, ms);
  }
  function tocar(nome) { if (J.sons && !J.mudo) sons.tocar(nome); }
  function mostrarContexto() {
    const c = contexto(), partes = [];
    if (c.nota_aberta) partes.push(`<span>Nota aberta</span> <b>${escHtml(c.nota_aberta)}</b>`);
    if (c.rotina_aberta) partes.push(`<span>Rotina no funil</span> <b>${escHtml(c.rotina_aberta)}</b>`);
    if (c.departamento) partes.push(`<span>Departamento</span> <b>${escHtml(c.departamento)}</b>`);
    el.contexto.innerHTML = partes.length ? `<i aria-hidden="true"></i>${partes.join('<em aria-hidden="true">·</em>')}` : '';
    el.contexto.hidden = !partes.length;
  }

  /* ---------- laço da interface: relógio das palavras, nível do microfone, hora ---------- */
  function laco() {
    J.raf = 0;
    if (!J.aberto) return;
    const fr = F.frases.find((f) => f.estado === 'falando');
    if (fr) revelar(fr);
    if (J.digitando) digitar();
    if (J.mic.querLigado && ouvido.ativo && !falandoAgora()) {
      const n = ouvido.nivel();
      if (n) {
        hud.nivel(n.bandas, n.db);
        const db = Math.max(-60, Math.min(0, n.db));
        if (el.medidor) el.medidor.style.transform = `scaleX(${((db + 60) / 60).toFixed(3)})`;
        leiturasMic(n.db);
      }
    } else { hud.nivel(null); if (el.medidor) el.medidor.style.transform = 'scaleX(0)'; }
    const seg = (Date.now() / 1000) | 0;
    if (seg !== J.ultSeg) {
      J.ultSeg = seg;
      const d = new Date(), hora = `${doisDig(d.getHours())}:${doisDig(d.getMinutes())}:${doisDig(d.getSeconds())}`;
      if (hora !== J.ultimaHora) { J.ultimaHora = hora; if (raiz.classList.contains('paineis')) el.leituras.hora.textContent = hora; }
      vigiarTurno();
    }
    atualizarEstado();
    J.raf = requestAnimationFrame(laco);
  }
  let ultDb = 0;
  function leiturasMic(db) {
    const t = agora(); if (t - ultDb < 200) return; ultDb = t;
    leitura('mic', `${Math.round(Math.max(-90, db)).toString().replace('-', '−')} DB`);
  }

  /* ---------- transição: fases do HUD ---------- */
  function aoPaineis() {
    raiz.classList.add('paineis');
    const d = new Date(), DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'], MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const dataStr = `${DIAS[d.getDay()]} ${doisDig(d.getDate())} ${MESES[d.getMonth()]}`;
    // o alvo da digitação fica guardado no próprio elemento: a data entra lá também, senão a 2ª abertura digitava a velha
    if (el.leituras.data) { el.leituras.data.dataset.txt = dataStr; el.leituras.data.textContent = dataStr; }
    // leituras "digitadas" (25 ms por caractere): só os rótulos; os valores rolam até o valor (classe .rola)
    if (reduzido()) return;
    // o laço da interface (rAF) digita: o mesmo relógio dos anéis, sem timers soltos
    const t0 = agora();
    J.digitando = [...raiz.querySelectorAll('.jv-dig')].map((e, i) => {
      const alvo = e.dataset.txt || e.textContent; e.dataset.txt = alvo; e.textContent = '';
      return { e, alvo, t0: t0 + i * 35 };
    });
  }
  function digitar(fim = false) {
    if (!J.digitando) return;
    let resta = false;
    for (const d of J.digitando) {
      const n = fim ? d.alvo.length : Math.max(0, Math.floor((agora() - d.t0) / 25));
      const s = d.alvo.slice(0, n);
      if (d.e.textContent !== s) d.e.textContent = s;
      if (n < d.alvo.length) resta = true;
    }
    if (!resta) J.digitando = null;
  }
  function aoPronto() {
    raiz.classList.add('pronto'); tocar('pronto');
    // o fundo do HUD já fechou: o fundo do portão (a entrada depois da trava do rosto) sai sem a página de trás aparecer
    raiz.classList.remove('jv-portao');
    J.semMergulho = false;   // a saída volta para os olhos do robô, como sempre
  }

  /* ---------- escolher o cérebro ---------- */
  async function escolherCerebro() {
    let c = null, disp = { ok: false, motivo: '', voz: false };
    try {
      // o app do computador vem primeiro: com ?jarvis=simular nele, só o ouvido é de mentira (as falas do painel do
      // simulador vão para o servidor, que responde com o cérebro dele, real ou --simulado). Sem o servidor (arquivo,
      // servidor estático de teste), o simulador traz também um cérebro de mentira da própria página.
      if (ehLocal() && tokenLocal()) c = criarCerebroLocal(tokenLocal());
      else if (SIM_MODO) c = criarCerebroSimulado(pagina);
      else if (emArtifact()) c = await carregarCerebroLink({ ...(opts.link || {}), pagina, contexto, reduzido });
    } catch (err) {
      try { console.warn('[Jarvis] o cérebro não carregou.', err); } catch { /* nada */ }
      c = null;
      disp.motivo = 'O cérebro do link não carregou. Recarregue a página.';
    }
    if (c) {
      try { disp = { ok: false, voz: false, ...(await c.disponivel()) }; } catch { disp = { ok: false, motivo: 'O cérebro não respondeu.', voz: false }; }
    } else if (!disp.motivo) {
      disp.motivo = location.protocol === 'file:'
        ? 'Neste arquivo eu não tenho cérebro. Converso no app do computador (INICIAR.bat) e no link do claude.ai.'
        : 'Aqui eu não tenho cérebro. Converso no app do computador (INICIAR.bat) e no link do claude.ai.';
    }
    if (c && emArtifact() && c.tipo === 'link') disp.voz = false;   // o claude.ai não libera microfone
    J.cerebro = c; J.disp = disp;
    return c;
  }

  /* ---------- entrar e sair ---------- */
  function inerte(v) {
    if (v) {
      J.inertes = [];
      for (const filho of app.children) {
        if (filho === raiz || filho.hasAttribute('inert') || filho.id === 'maosFx') continue;
        filho.setAttribute('inert', ''); J.inertes.push(filho);
      }
    } else { for (const f of J.inertes) f.removeAttribute('inert'); J.inertes = []; }
  }
  async function abrir() {
    if (J.aberto || J.saindo) return;
    J.aberto = true; J.entrando = true;
    const ab = ++J.nAbrir;   // esta abertura (o portão de uma abertura velha não fecha esta)
    J.focoAntes = document.activeElement;
    raiz.classList.remove('paineis', 'pronto', 'saindo');
    raiz.hidden = false;
    raiz.dataset.estado = 'repouso'; J.estado = '';
    // a conversa continua de onde parou; a legenda começa limpa
    F.frases.forEach((f) => f.el.remove()); F.frases = []; F.buffer = ''; F.fechada = true;
    el.lgJarvis.hidden = true; el.lgJulio.hidden = true; el.lgJulio.classList.remove('apagada');
    J.interrompidoAte = 0; J.rotuloInterrompidoAte = 0; J.primeiraFrase = true; J.modelo = 'haiku'; hud.modelo('haiku'); leitura('modelo', rotuloModelo('haiku'));
    el.mudo.setAttribute('aria-pressed', String(J.mudo)); raiz.classList.toggle('mudo', J.mudo);
    el.mudo.setAttribute('aria-label', J.mudo ? 'Ligar o som' : 'Sem som');
    el.sonsChk.checked = J.sons;
    if (el.foneChk) el.foneChk.checked = J.fone;
    el.vel.value = String(J.rate); el.velV.textContent = J.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    el.tom.value = String(J.pitch); el.tomV.textContent = J.pitch.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    sons.mudo(J.mudo || !J.sons);
    opts.botao && opts.botao.setAttribute('aria-pressed', 'true');
    try { opts.onAbrindo && opts.onAbrindo(); } catch { /* nada */ }
    inerte(true);
    mostrarContexto();
    tocar('abrir');
    J.carregandoCerebro = escolherCerebro().finally(() => { J.carregandoCerebro = null; leitura('modelo', rotuloModelo(J.modelo)); atualizarMic(); atualizarEstado(); });
    const pVozes = esperarVozes(1500);
    if (!J.raf) J.raf = requestAnimationFrame(laco);
    // app do computador: a trava do rosto vem ANTES do HUD (a primeira conversa do dia). O fundo do Jarvis fecha, a lente
    // abre com a câmera e, só liberado, o HUD entra (nascendo no centro, onde a lente encolheu) e o Jarvis saúda
    if (LOCAL_APP) {
      await carregarModulos();
      if (!J.aberto || J.saindo) return;
      const st = garantirPortao() ? await portao.consultar() : null;   // null = servidor fora: o cérebro avisa
      if (!J.aberto || J.saindo) return;
      if (st && !st.liberado) {
        raiz.classList.add('jv-portao');
        await pVozes;
        if (!J.aberto || J.saindo) return;
        montarVoz();
        const r = await comPortao(() => portao.abrir(), 'abrir');
        if (!J.aberto || J.saindo || ab !== J.nAbrir) return;
        if (!r || !r.liberado) { fechar(); return; }
        J.saudou = false;   // liberou agora: a saudação pela hora vem depois do HUD
        J.semMergulho = true;
      }
    }
    await hud.entrar();
    // Esc, Ctrl+J ou "Sair" durante a entrada: o hud.sair() resolve a entrada, mas J.aberto só vira false no fim da
    // saída. Nada de cobrir o robô, ligar o microfone ou saudar com o HUD fechando
    if (!J.aberto || J.saindo) return;
    J.entrando = false;
    try { opts.onCoberto && opts.onCoberto(true); } catch { /* nada */ }
    try { el.entrada.focus({ preventScroll: true }); } catch { /* nada */ }
    await pVozes;
    if (!J.aberto || J.saindo) return;
    montarVoz();
    await (J.carregandoCerebro || Promise.resolve());
    if (!J.aberto || J.saindo) return;
    escolherOuvido();   // Chrome (offline) quando o servidor diz que ele existe; senão o Edge
    atualizarMic();
    // o reconhecimento só liga depois do "pronto" (~150 ms)
    setTimeout(() => {
      if (!J.aberto || J.saindo || J.portao) return;
      if (micDisponivel()) {
        if (aceitouMic() && (SIM_MODO || lerPref('jarvis-mic', 'ligado') === 'ligado')) ligarMic();
        else if (!aceitouMic()) abrirConsent();
      }
      saudar();
    }, 150);
  }
  function saudar() {
    if (!J.aberto || J.saindo) return;
    if (!J.disp.ok) { falarLocal(J.disp.motivo || 'Estou sem conexão com o cérebro agora.'); return; }
    if (J.saudou) return;
    J.saudou = true;
    // o Júlio já começou a falar ou a digitar (ou já conversamos): nada de "bom dia" atrasado por cima. As frases do
    // próprio portão do rosto (msg null) não contam: a saudação entra na fila depois delas
    const falandoConversa = F.frases.some((f) => f.estado !== 'dita' && f.msg);
    if (J.turno || J.falaJulio || falandoConversa || J.conversa.some((m) => m.papel === 'julio') || el.entrada.value) return;
    let h = new Date().getHours();
    try { h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date())); } catch { /* hora do computador */ }
    const periodo = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const ouvindo = J.mic.querLigado;
    const opcoes = ouvindo ? [`${periodo}, Júlio. Estou ouvindo.`, `${periodo}, Júlio. Em que posso ajudar?`] : [`${periodo}, Júlio. Em que posso ajudar?`, `${periodo}, Júlio. Às ordens.`];
    falarLocal(opcoes[Math.floor(Math.random() * opcoes.length)]);
    // o que não está disponível aqui (no link: conectores, ferramentas), em uma frase, uma vez
    if (J.disp.motivo) falarLocal(J.disp.motivo);
  }
  async function fechar() {
    if (!J.aberto || J.saindo) return;
    J.saindo = true;
    // para tudo: voz, turno, microfone; uma ação pendente é recusada (nada sai sem o clique)
    voz.parar(); limparFila({ manterDitas: true });
    if (J.turno) { try { J.turno.cancelar(); } catch { /* nada */ } J.turno = null; encerrarFerramentas('interrompido'); }
    J.ger++;
    if (J.acao) { const id = J.acao.id; fecharAcao(); J.cerebro?.decidirAcao(id, 'recusar', 'saiu').catch(() => {}); }
    clearTimeout(J.confVoz?.timer); J.confVoz = null; J.ferrAbertas.clear();
    pausarMic({ lembrar: false });
    fecharConsent(); fecharAjustes(); fecharPacote();
    // o portão do rosto aberto: cancela (a câmera desliga na hora; o abrir() dele resolve "não liberado") e o Jarvis
    // solta o portão já: a próxima abertura não herda a promessa nem o estado do fluxo velho
    try { portao && portao.fechar(); } catch { /* nada */ }
    J.portaoP = null; J.portaoDono = null;
    J.portao = false; J.portaoTipo = null; J.portaoEstado = null; J.portaoCamera = false;
    J.mic.ptt = false; J.mic.voltar = false;
    try { opts.onCoberto && opts.onCoberto(false); } catch { /* nada */ }
    digitar(true);
    const soPortao = raiz.classList.contains('jv-portao') && hud.modo === 'fechado';
    raiz.classList.remove('pronto', 'paineis'); raiz.classList.add('saindo');
    tocar('sair');
    await hud.sair();
    // saiu do portão antes de o HUD entrar: o fundo escuro some em 250 ms (sem o corte seco para o robô)
    if (soPortao && !reduzido()) await esperar(260);
    raiz.classList.remove('jv-portao'); J.semMergulho = false;
    // garantia: nada do que a entrada interrompida possa ter ligado continua depois da saída
    J.mic.querLigado = false; J.mic.ptt = false; J.falaJulio = null;
    try { ouvido.pausar(); } catch { /* nada */ }
    voz.parar(); limparFila({ manterDitas: false });
    raiz.hidden = true; raiz.classList.remove('saindo');
    inerte(false);
    J.aberto = false; J.saindo = false; J.entrando = false;
    if (J.raf) cancelAnimationFrame(J.raf); J.raf = 0;
    opts.botao && opts.botao.setAttribute('aria-pressed', 'false');
    const abrirDepois = J.pendenteAbrir; J.pendenteAbrir = null;
    try { opts.onFechou && opts.onFechou({ abrir: abrirDepois }); } catch { /* nada */ }
    const volta = opts.botao || J.focoAntes;
    if (!abrirDepois && volta && volta.isConnected) { try { volta.focus({ preventScroll: true }); } catch { /* nada */ } }
  }

  /* ---------- ajustes ---------- */
  function abrirAjustes() {
    if (J.portao) return;
    atualizarAjustes(); atualizarTrava();
    el.ajustes.hidden = false; el.ajustesBtn.setAttribute('aria-expanded', 'true'); try { el.vozSel.focus({ preventScroll: true }); } catch { /* nada */ }
  }
  function fecharAjustes() { if (el.ajustes.hidden) return; el.ajustes.hidden = true; el.ajustesBtn.setAttribute('aria-expanded', 'false'); }
  function alternarMudo() {
    J.mudo = !J.mudo; gravarPref('jarvis-mudo', J.mudo ? '1' : '0');
    el.mudo.setAttribute('aria-pressed', String(J.mudo)); raiz.classList.toggle('mudo', J.mudo);
    el.mudo.setAttribute('aria-label', J.mudo ? 'Ligar o som' : 'Sem som');
    sons.mudo(J.mudo || !J.sons);
    montarVoz({ ja: true });   // a resposta em curso continua, agora na legenda (ou de volta na voz)
    avisar(J.mudo ? 'Sem som: eu respondo só na legenda.' : 'Som ligado.', 2200);
  }

  /* ---------- eventos ---------- */
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = el.entrada.value.trim();
    if (!t) return;
    el.entrada.value = '';
    const k = curto(t);
    if (FECHAR.test(k)) { fechar(); return; }
    enviar(t, { origem: 'texto' });
  });
  el.entrada.addEventListener('input', () => { if (el.entrada.value && falandoAgora()) interromper({ motivo: 'digitando' }); });
  el.parar.addEventListener('click', () => interromper({ motivo: 'botao' }));
  // o núcleo do HUD também é um botão: segurar = falar (como o Espaço; no celular é o jeito de falar); sem microfone,
  // um toque só para de falar e põe o foco na caixa de texto
  const nucleo = $('.jv-nucleo');
  nucleo.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    if (!micDisponivel()) { interromper({ motivo: 'botao' }); try { el.entrada.focus({ preventScroll: true }); } catch { /* nada */ } return; }
    try { nucleo.setPointerCapture(e.pointerId); } catch { /* nada */ }
    nucleo.classList.add('segurando');
    pttInicio();
  });
  const soltarNucleo = () => { if (!nucleo.classList.contains('segurando')) return; nucleo.classList.remove('segurando'); pttFim(); };
  nucleo.addEventListener('pointerup', soltarNucleo);
  nucleo.addEventListener('pointercancel', soltarNucleo);
  nucleo.addEventListener('lostpointercapture', soltarNucleo);
  // pelo teclado (Enter no botão = clique sem ponteiro): um toque começa a falar, o outro termina
  nucleo.addEventListener('click', (e) => { if (e.detail !== 0 || !micDisponivel()) return; if (J.mic.ptt) pttFim(); else pttInicio(); });
  el.mic.addEventListener('click', aoBotaoMic);
  el.sair.addEventListener('click', () => fechar());
  el.mudo.addEventListener('click', alternarMudo);
  el.ajustesBtn.addEventListener('click', () => (el.ajustes.hidden ? abrirAjustes() : fecharAjustes()));
  el.ajustesOk.addEventListener('click', () => { fecharAjustes(); try { el.ajustesBtn.focus({ preventScroll: true }); } catch { /* nada */ } });
  el.confSim.addEventListener('click', (e) => {
    // o Modo Mãos dispara cliques sintéticos (e.daMao) no que está sob o cursor: envio só com mouse, toque ou teclado
    if (!e.isTrusted || e.daMao) { dicaAcao('Para confirmar o envio, use o mouse ou o teclado: o gesto das mãos não confirma.'); return; }
    decidir('confirmar');
  });
  el.confNao.addEventListener('click', () => decidir('recusar'));
  el.consSim.addEventListener('click', () => { gravarPref(chaveAceite(), '1'); fecharConsent(); ligarMic(); try { el.entrada.focus({ preventScroll: true }); } catch { /* nada */ } });
  // o pacote de voz do Chrome: só com o clique (o servidor só baixa por pedido explícito)
  el.pacSim.addEventListener('click', () => baixarPacote());
  el.pacNao.addEventListener('click', () => { fecharPacote(); avisar('Sem o pacote de voz eu não ouço pelo Chrome. Enquanto isso, digite.', 5000); try { el.entrada.focus({ preventScroll: true }); } catch { /* nada */ } });
  el.pacoteBtn.addEventListener('click', () => { fecharAjustes(); abrirPacote(); });
  el.ouvidoSel.addEventListener('change', () => {
    const v = el.ouvidoSel.value === 'chrome' ? 'chrome' : 'edge';
    gravarPref('jarvis-ouvido', v);
    usarOuvido(v);
    avisar(ouvido.remoto ? 'Ouvido: Chrome, neste computador.' : 'Ouvido: Edge, na nuvem da Microsoft.', 2600);
  });
  // a trava do rosto pelos ajustes (o portão pergunta antes de apagar; recadastrar e apagar só com o dia liberado)
  // travar = o Júlio vai sair da mesa: o portão fica no cartão "Jarvis travado", SEM câmera (com ela ligada, as piscadas
  // naturais de quem ficou na frente poderiam destravar sozinhas); a câmera só liga no clique "Conferir meu rosto"
  el.travar.addEventListener('click', async () => {
    fecharAjustes();
    if (!portao) return;
    const voltar = J.mic.querLigado && !J.mic.temporario;
    if (await portao.travar()) pedirPortao({ religarMic: voltar, pedirClique: true });
    else avisar('Não consegui travar agora. O app do cérebro respondeu?', 5000, 'alerta');
  });
  el.recadastrar.addEventListener('click', () => { if (portao) comPortao(() => portao.recadastrar(), 'recadastrar'); });
  el.hello.addEventListener('click', () => { if (portao) comPortao(() => portao.cadastrarHello(), 'hello'); });
  el.apagar.addEventListener('click', async () => {
    if (!portao) return;
    const apagou = await comPortao(() => portao.apagarCadastro(), 'apagar');
    // sem cadastro, o Jarvis fica travado: sai (a próxima abertura pede o cadastro novo)
    if (apagou && J.aberto) fechar();
  });
  el.consNao.addEventListener('click', () => { gravarPref('jarvis-mic', 'pausado'); fecharConsent(); try { el.entrada.focus({ preventScroll: true }); } catch { /* nada */ } });
  el.vozSel.addEventListener('change', () => { J.vozUri = el.vozSel.value; gravarPref('jarvis-voz', J.vozUri); const falando = falandoAgora(); montarVoz({ ja: true }); if (!falando) falarLocal(J.vozUri === 'nenhuma' ? 'Certo, sigo só na legenda.' : 'Esta é a minha voz agora.'); });
  el.vel.addEventListener('input', () => { J.rate = Number(el.vel.value) || 1.05; el.velV.textContent = J.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); gravarPref('jarvis-velocidade', String(J.rate)); voz.configurar({ rate: J.rate }); });
  el.tom.addEventListener('input', () => { J.pitch = Number(el.tom.value) || 0.92; el.tomV.textContent = J.pitch.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); gravarPref('jarvis-tom', String(J.pitch)); voz.configurar({ pitch: J.pitch }); });
  el.sonsChk.addEventListener('change', () => { J.sons = el.sonsChk.checked; gravarPref('jarvis-sons', J.sons ? '1' : '0'); sons.mudo(J.mudo || !J.sons); });
  // de fone não há eco: o filtro sai e uma palavra já interrompe
  el.foneChk && el.foneChk.addEventListener('change', () => { J.fone = el.foneChk.checked; gravarPref('jarvis-fone', J.fone ? '1' : '0'); avisar(J.fone ? 'De fone: uma palavra já me interrompe.' : 'Sem fone: eu filtro o meu eco do alto-falante.', 2600); });
  // clique fora dos ajustes fecha
  raiz.addEventListener('pointerdown', (e) => { if (!el.ajustes.hidden && !el.ajustes.contains(e.target) && !el.ajustesBtn.contains(e.target)) fecharAjustes(); });

  function aoTecla(e) {
    if (!J.aberto) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      // o portão do rosto: na trava do dia, Esc = "Agora não" (fecha o Jarvis, nada liberado); nos fluxos dos ajustes
      // (cadastrar de novo, Hello, apagar) só cancela o fluxo — o próprio portão também ouve o Esc
      if (J.portao) { if (J.portaoTipo === 'abrir') fechar(); else if (portao) portao.fechar(); return; }
      if (!el.ajustes.hidden) { fecharAjustes(); try { el.ajustesBtn.focus({ preventScroll: true }); } catch { /* nada */ } return; }
      if (!el.consent.hidden) { el.consNao.click(); return; }
      if (!el.pacote.hidden) { if (!el.pacNao.disabled) el.pacNao.click(); return; }
      fechar();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'j' || e.key === 'J')) { e.preventDefault(); e.stopPropagation(); fechar(); return; }
    // portão na tela: as teclas são dos botões dele (Espaço e Enter clicam); o painel de trás continua sem reagir
    if (J.portao) { e.stopPropagation(); return; }
    if (e.code === 'Space' || e.key === ' ') {
      // na caixa de texto vazia, o Espaço também é "segure para falar" (o foco fica nela ao abrir e depois de cada envio)
      const a = document.activeElement, caixaVazia = a === el.entrada && !el.entrada.value.trim() && micDisponivel();
      if ((emCampoTexto(a) && !caixaVazia && !J.mic.ptt) || !el.consent.hidden || !el.ajustes.hidden || !el.pacote.hidden) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) pttInicio();
      return;
    }
    // qualquer outra tecla fica com o modo: o painel de trás não reage enquanto o Jarvis está aberto (a ação padrão da
    // tecla — digitar, Enter no formulário, setas no seletor — continua acontecendo)
    e.stopPropagation();
  }
  function aoSoltar(e) {
    if (!J.aberto) return;
    if (e.code === 'Space' || e.key === ' ') { if (J.mic.ptt) { e.preventDefault(); e.stopPropagation(); pttFim(); } }
  }
  window.addEventListener('keydown', aoTecla, true);
  window.addEventListener('keyup', aoSoltar, true);
  window.addEventListener('blur', () => { if (J.mic.ptt) pttFim(); });
  let rz = 0;
  function aoRedimensionar() { if (!J.aberto) return; cancelAnimationFrame(rz); rz = requestAnimationFrame(() => hud.redimensionar()); }
  window.addEventListener('resize', aoRedimensionar, { passive: true });
  // aba escondida: o microfone fecha na hora (privacidade) e volta sozinho quando a aba aparece de novo
  function aoOculto() {
    if (!J.aberto) return;
    if (document.hidden) {
      if (J.mic.ptt) pttFim();
      if (J.mic.querLigado && !J.mic.temporario) { J.mic.voltar = true; pausarMic({ lembrar: false }); }
    } else if (J.mic.voltar) { J.mic.voltar = false; ligarMic(); }
  }
  document.addEventListener('visibilitychange', aoOculto);
  window.addEventListener('pagehide', () => { if (J.aberto) { pausarMic({ lembrar: false }); voz.parar(); } });

  /* ---------- simulador (?jarvis=simular, só no teste local) ---------- */
  function criarOuvidoSimulado() {
    const O = { suportado: true, ativo: false, ouvindo: false };
    const b = new Float32Array(64);
    let falandoAte = 0;
    O.ligar = async () => { O.ativo = true; O.ouvindo = true; };
    O.pausar = () => { O.ativo = false; O.ouvindo = false; };
    O.nivel = () => {
      const t = agora(), vivo = t < falandoAte;
      for (let i = 0; i < 64; i++) b[i] = vivo ? Math.max(0, 0.25 + 0.55 * Math.sin(i * 0.37 + t / 90) * Math.sin(t / 140 + i * 0.11)) : 0.02 + 0.02 * Math.random();
      return { bandas: b, db: vivo ? -22 + 6 * Math.sin(t / 120) : -58 };
    };
    O.falar = async (texto, { final = true } = {}) => {
      const ps = String(texto).split(/\s+/).filter(Boolean);
      if (!O.ativo) await ligarMic();
      falandoAte = agora() + ps.length * 170 + 300;
      let acc = '';
      for (const p of ps) { acc = `${acc} ${p}`.trim(); aoParcial(acc); await esperar(150 + Math.random() * 60); }
      if (final) aoFinal(acc);
    };
    return O;
  }
  if (SIM_MODO) montarPainelSimulador();
  function montarPainelSimulador() {
    const p = document.createElement('div');
    p.className = 'jv-sim';
    p.innerHTML = `<p class="hud-rot">Simulador <b>(teste local)</b></p>
      <form class="jv-sim-form"><input class="jv-sim-txt" type="text" placeholder="Fala do Júlio (simulada)" aria-label="Fala do Júlio, simulada" value="Jarvis, está tudo rodando?"><button class="btn pequeno" type="submit">Falar</button></form>
      <div class="jv-sim-bts"><button class="btn pequeno" type="button" data-sim="eco" title="O microfone ouve a minha própria voz (não pode interromper)">Eco</button><button class="btn pequeno" type="button" data-sim="corta">Interromper</button><button class="btn pequeno" type="button" data-sim="para">“Para”</button><button class="btn pequeno" type="button" data-sim="sim">“Pode enviar”</button><button class="btn pequeno" type="button" data-sim="nao">“Cancela”</button></div>`;
    raiz.appendChild(p);
    const txt = p.querySelector('.jv-sim-txt');
    p.querySelector('.jv-sim-form').addEventListener('submit', (e) => { e.preventDefault(); const t = txt.value.trim(); if (t) ouvido.falar(t); });
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sim]'); if (!b) return;
      const k = b.dataset.sim;
      if (k === 'eco') {
        // as próximas palavras da frase que estou falando, como se o microfone as ouvisse
        const fr = F.frases.find((f) => f.estado === 'falando') || F.frases[F.frases.length - 1];
        const ps = fr ? fr.palavras.slice(Math.max(0, fr.vistas - 3), fr.vistas + 2).map((x) => x.txt).join(' ') : 'eco';
        ouvido.falar(ps);
      } else if (k === 'corta') ouvido.falar('espera, me mostra os e-mails da caixa');
      else if (k === 'para') ouvido.falar('para');
      else if (k === 'sim') ouvido.falar('pode enviar');
      else if (k === 'nao') ouvido.falar('cancela');
    });
    p.addEventListener('keydown', (e) => { if (e.code === 'Space') e.stopPropagation(); });
  }

  /* ---------- API ---------- */
  const api = {
    abrir, fechar,
    alternar() { if (J.aberto && !J.saindo) fechar(); else if (!J.aberto) abrir(); },
    aberto: () => J.aberto,
    destruir() {
      try { fechar(); } catch { /* nada */ }
      window.removeEventListener('keydown', aoTecla, true); window.removeEventListener('keyup', aoSoltar, true);
      window.removeEventListener('resize', aoRedimensionar); document.removeEventListener('visibilitychange', aoOculto);
      try { window.speechSynthesis && speechSynthesis.removeEventListener('voiceschanged', aoMudarVozes); } catch { /* nada */ }
      hud.destruir(); sons.destruir();
      for (const o of [ouvidoEdge, ouvidoChrome]) { try { o && o.destruir(); } catch { /* nada */ } }
      try { portao && portao.destruir(); } catch { /* nada */ }
    }
  };
  // teste local (localhost com ?debug): o estado cru em window.__jarvis (no Artifact e no app normal nunca liga)
  if (ehLocal() && /[?&]debug\b/.test(location.search)) {
    api._teste = {
      J, F, enviar, interromper, hud, mostrarCartao, abrirAcao, aoFerramenta, aoParcial, aoFinal, concluirFala, conversa: () => conversaParaEnviar(),
      // o ouvido da vez (Edge, Chrome ou o simulado), o portão do rosto e os atalhos da integração
      get ouvido() { return ouvido; }, get portao() { return portao; }, get modulos() { return M; },
      usarOuvido, pedirPortao, abrirPacote, abrirAjustes
    };
    try { window.__jarvis = api._teste; } catch { /* nada */ }
  }
  return api;
}
