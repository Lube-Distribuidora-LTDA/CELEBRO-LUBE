/* Cérebro da Lube — js/ouvido-remoto.js  (parte B do docs/OUVIDO-E-ROSTO.md §4)
   O ouvido do Jarvis no app do computador. Desde 2026-10-19 o reconhecimento do Edge 155 devolve resultado vazio; quem
   reconhece a fala agora é um Chrome escondido, ligado pelo servidor (servidor/ouvido.js), no próprio computador e sem
   internet ("Edge fala, Chrome ouve"). Por fora é igual ao criarOuvido do jarvis.js: a integração troca um pelo outro
   sem mexer no resto.

     O = criarOuvidoRemoto(h, sons, { token, aba, base = '', lang = 'pt-BR', medidor = 'remoto', fetch, prazoLigarMs, tempos })
     O = { suportado, ativo, ouvindo, remoto: true, pacote, motivo,
           ligar(): Promise<void> (lança Error com .codigo e a mensagem do servidor), pausar(),
           nivel(): { bandas: Float32Array(64), db } | null, destruir(),
           preparar(): Promise<EstadoOuvido|null>   abre o Chrome escondido e confere o pacote (não baixa),
           instalar(): Promise<EstadoOuvido|null>   baixa o pacote de voz (o botão "Baixar o pacote de voz"),
           consultar(): Promise<EstadoOuvido|null>, precisaBaixar(): boolean, estadoRemoto(): string }
     h = { parcial(texto), final(texto), estado('ouvindo'|'parado'), erro(codigo, mensagem?), aviso?(codigo, dados),
           fala?(fase) }

   Rotas do servidor (todas com x-cerebro-token): POST /api/ouvido/preparar {instalar?}, POST /api/ouvido/ligar
   {aba, lang}, POST /api/ouvido/pausar {aba}, GET /api/ouvido/estado e GET /api/ouvido/eventos?aba= (SSE com estado,
   resultado, nivel, fala e erro). O EventSource não manda cabeçalho, então o SSE é lido por fetch.

   Códigos (err.codigo do ligar e h.erro): trava (423: falta o rosto de hoje), sem-pacote (409: falta baixar o pacote
   de voz; precisaBaixar() fica true e a interface oferece instalar()), reiniciado (401: o app reiniciou, F5),
   sem-chrome (503), sem-rota (404: o app ainda não tem o ouvido do Chrome), prazo, sem-app (o app não respondeu),
   outra-aba (outra janela do Jarvis pegou o microfone), caiu (o Chrome caiu e não voltou), desligado, e os da página
   do Chrome: negado, sem-microfone, em-uso, audio-capture, pacote-falhou. Os textos estão em TEXTOS_OUVIDO.
   Avisos (h.aviso, sem parar nada): instalando (baixando o pacote de voz), caiu (o Chrome caiu e o servidor está
   religando), reconectando (o SSE caiu e estou voltando), erro-remoto ({codigo}: a página do Chrome errou e segue
   tentando).

   O microfone: quem abre é o Chrome escondido. A onda e o medidor vêm pelo SSE (evento nivel, 20 por segundo; a mesma
   conta do nivel() do criarOuvido). Com medidor: 'local', o Edge também abre o microfone, só para o medidor e a onda
   (nada é reconhecido aqui); se não abrir, fica o nível do Chrome. Nunca guarda nem manda o texto falado a log.

   Também exporta o vigia do ouvido ANTIGO (o SpeechRecognition do Edge): criarVigiaVazio e vigiarEdge. No Edge 155 o
   speechstart e o final vazio vêm até em silêncio puro (medido em 2026-10-19), então "fala detectada" é o medidor do
   microfone acima de -38 dB; sem medidor, vale o speechstart.

   Importável no Node (nada de window ou document no topo): servidor/teste/testar-ouvido-remoto.js. */

const agora = () => performance.now();
const ABA_OK = /^[A-Za-z0-9_-]{4,40}$/;
const RECUO_SSE = [500, 1000, 2000, 5000];   // reconexão do SSE enquanto ligado
const NIVEL_VELHO_MS = 300;                  // sem nível novo há mais que isso = sem nível
const PRAZO_LIGAR_MS = 150000;               // a primeira vez o servidor baixa o pacote de voz (17 a 30 s medidos)
const PRAZO_PREPARAR_MS = 150000;
const PRAZO_CURTO_MS = 8000;
const SEM_APP_MS = 30000;                    // SSE fora por 30 s seguidos = o app caiu
const CAIU_MS = 45000;                       // 'caiu' sem voltar a ouvir em 45 s (o servidor tenta 1, 5 e 30 s)
const RELIGAR_APOS_CAIU_MS = 8000;           // o Chrome voltou ('pronto') mas a sessão não: ligo de novo
const MAX_RELIGADAS = 3, JANELA_RELIGADAS_MS = 60000;
const MAX_TEXTO = 2000;
const ESTADOS = new Set(['desligado', 'abrindo', 'instalando', 'pronto', 'iniciando', 'ouvindo', 'parado', 'caiu', 'sem-chrome']);
// erro sem volta: para tudo. Os outros a página do Chrome manda e segue tentando (viram h.aviso('erro-remoto'));
// se um 'parado' vier logo depois de um deles, era sem volta também
const FATAIS = new Set(['negado', 'sem-microfone', 'em-uso', 'audio-capture', 'pacote-falhou', 'sem-pacote', 'caiu', 'trava', 'sem-suporte', 'desligado']);
const TAMANHO_PACOTE_MB = 300;               // pt-BR + en-US: 296 MB medidos (só o pt-BR não funciona)

// os textos para a tela (o jarvis.js junta no ERRO_MIC quando usa este ouvido); frases curtas, palavras simples. Os
// códigos que o servidor também tem (servidor/ouvido.js, TEXTOS) usam o mesmo texto de lá
export const TEXTOS_OUVIDO = {
  'sem-chrome': 'Não achei o Google Chrome neste computador. Ele é o ouvido do Jarvis: instale o Chrome e abra de novo. Enquanto isso, digite.',
  'sem-pacote': `Falta baixar o pacote de voz em português, só desta vez (cerca de ${TAMANHO_PACOTE_MB} MB). Peça para baixar e eu ligo o ouvido.`,
  instalando: `Baixando o pacote de voz em português, só desta vez (cerca de ${TAMANHO_PACOTE_MB} MB)…`,
  baixar: `Baixar o pacote de voz (cerca de ${TAMANHO_PACOTE_MB} MB, uma vez só)`,
  'pacote-falhou': 'Não consegui baixar o pacote de voz. Confira a internet e tente de novo. Enquanto isso, digite.',
  negado: 'O Windows bloqueou o microfone para o Chrome. Abra Configurações › Privacidade › Microfone e permita os aplicativos da área de trabalho.',
  caiu: 'O ouvido do Jarvis parou. Feche e abra o Jarvis de novo.',
  religando: 'O ouvido do Jarvis caiu. Estou religando…',
  reconectando: 'Perdi o contato com o ouvido. Voltando…',
  trava: 'O Jarvis está travado. Faça o reconhecimento do rosto.',
  reiniciado: 'O app do cérebro foi reiniciado. Recarregue a página (F5) e fale de novo.',
  'outra-aba': 'O microfone passou para outra janela do Jarvis.',
  'sem-app': 'O app do cérebro não respondeu. Ele ainda está ligado? Abra pelo INICIAR.bat.',
  prazo: 'O ouvido do Jarvis demorou demais para responder. Tente de novo.',
  desligado: 'O ouvido do Jarvis está desligado. Abra o Jarvis de novo.',
  pagina: 'O ouvido do Jarvis não abriu. Feche e abra o Jarvis de novo.',
  perfil: 'Não consegui criar a pasta do ouvido em %LOCALAPPDATA%\\CerebroLube.',
  'sem-suporte': 'Este Chrome não reconhece voz no computador. Atualize o Google Chrome.',
  'sem-rota': 'Este app do cérebro ainda não tem o ouvido do Chrome. Feche e abra de novo pelo INICIAR.bat.',
  'edge-vazio': 'O reconhecimento do Edge está devolvendo vazio; use o ouvido do Chrome.',
};

const erroCod = (codigo, mensagem) => Object.assign(new Error(mensagem || codigo), { codigo });
const textoDe = (x) => (typeof x === 'string' ? x.slice(0, MAX_TEXTO).trim() : '');

/* ---------- SSE: um bloco de texto → { evento, dados } (o mesmo parser do criarCerebroLocal, copiado) ---------- */
export function analisarSse(bloco) {
  let evento = 'message';
  const dados = [];
  for (const linha of String(bloco == null ? '' : bloco).split(/\r?\n/)) {
    if (!linha || linha.startsWith(':')) continue;   // comentário (: ok, : ping)
    const k = linha.indexOf(':'), campo = k < 0 ? linha : linha.slice(0, k);
    let val = k < 0 ? '' : linha.slice(k + 1);
    if (val.startsWith(' ')) val = val.slice(1);
    if (campo === 'event') evento = val; else if (campo === 'data') dados.push(val);
  }
  if (!dados.length && evento === 'message') return null;
  let d = {};
  try { d = dados.length ? JSON.parse(dados.join('\n')) : {}; } catch { return null; }
  return { evento, dados: d && typeof d === 'object' ? d : {} };
}

/* ---------- nível do microfone: 64 bandas (0..1) e o volume em dB (a mesma conta do criarOuvido do jarvis.js) ---------- */
function calcularNivel(analisador, freq, tempo, saida) {
  analisador.getByteFrequencyData(freq);
  const nb = freq.length, bandas = saida.bandas;
  for (let i = 0; i < 64; i++) {
    // faixas de 80 Hz a ~6 kHz em escala quase logarítmica (onde a voz mora)
    const a = Math.floor(2 + Math.pow(i / 64, 1.6) * (nb * 0.55)), b = Math.max(a + 1, Math.floor(2 + Math.pow((i + 1) / 64, 1.6) * (nb * 0.55)));
    let s = 0; for (let k = a; k < b && k < nb; k++) s += freq[k];
    bandas[i] = Math.min(1, (s / (b - a) / 255) * 1.35);
  }
  analisador.getFloatTimeDomainData(tempo);
  let q = 0; for (let i = 0; i < tempo.length; i++) q += tempo[i] * tempo[i];
  saida.db = 20 * Math.log10(Math.sqrt(q / tempo.length) + 1e-9);
  return saida;
}

/* =============================================================================
   Ouvido remoto
   ============================================================================= */
export function criarOuvidoRemoto(h = {}, sons = null, opcoes = {}) {
  const op = opcoes || {};
  const { token = '', aba = '', base = '', lang = 'pt-BR', medidor = 'remoto', prazoLigarMs = PRAZO_LIGAR_MS } = op;
  const buscar = typeof op.fetch === 'function' ? op.fetch : typeof fetch === 'function' ? (...a) => fetch(...a) : null;
  // tempos: só o teste encurta (op.tempos = { semApp, caiu, religarAposCaiu } em ms)
  const T = { semApp: SEM_APP_MS, caiu: CAIU_MS, religarAposCaiu: RELIGAR_APOS_CAIU_MS, ...(op.tempos || {}) };
  const O = { suportado: !!(buscar && token && ABA_OK.test(aba)), ativo: false, ouvindo: false, remoto: true, pacote: null, motivo: null };

  // nLigar: cada ligar (e cada parada) tem um número; a resposta de um ligar velho não mexe no ligar novo
  let querLigado = false, ligando = null, remoto = 'desconhecido', nLigar = 0;
  // ger: cada ligar do servidor tem um número novo. Evento com ger <= gerPiso é de uma sessão morta (descarta); um ger
  // maior que o atual é uma sessão nova minha (o servidor religou o Chrome sozinho): adoto
  let gerAtual = -Infinity, gerPiso = -Infinity;
  let sse = null, nSse = 0, falhasSse = 0, foraDesde = 0, avisouInstalando = false, religadas = [], ultimoErroRemoto = null;
  let tReconectar = 0, tCaiu = 0, tReligarCaiu = 0;
  const bandas = new Float32Array(64);
  const saidaNivel = { bandas, db: -90 };   // o laço lê a cada quadro: o mesmo objeto, sem alocar
  let nivelEm = 0;
  const local = { stream: null, fonte: null, analisador: null, freq: null, tempo: null, abrindo: false };

  const url = (caminho) => `${base}${caminho}`;
  function chamar(nome, ...args) {
    const f = h && h[nome];
    if (typeof f !== 'function') return;
    try { f(...args); } catch (err) { try { console.error(err); } catch { /* sem console */ } }   // o erro de quem ouve não derruba o ouvido
  }
  const aviso = (codigo, dados) => chamar('aviso', codigo, dados || {});
  function gerVale(g) {
    if (typeof g !== 'number' || !Number.isFinite(g)) return true;   // sem ger não dá para filtrar
    if (g <= gerPiso || g < gerAtual) return false;
    if (g > gerAtual) { gerAtual = g; gerPiso = Math.max(gerPiso, g - 1); }
    return true;
  }
  function marcarParado() { if (O.ouvindo) { O.ouvindo = false; chamar('estado', 'parado'); } }
  function marcarOuvindo() {
    clearTimeout(tCaiu); clearTimeout(tReligarCaiu);
    if (!O.ouvindo) { O.ouvindo = true; chamar('estado', 'ouvindo'); }
  }

  /* ---------- pedidos ---------- */
  async function pedir(metodo, caminho, corpo, prazo, extra = {}) {
    if (!buscar) throw erroCod('sem-suporte');
    const ctl = new AbortController();
    let estourou = false;
    const t = setTimeout(() => { estourou = true; try { ctl.abort(); } catch { /* nada */ } }, prazo);
    try {
      const init = { method: metodo, headers: { 'x-cerebro-token': token }, cache: 'no-store', signal: ctl.signal, ...extra };
      if (corpo !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(corpo); }
      const r = await buscar(url(caminho), init);
      let j = null;
      try { j = await r.json(); } catch { j = null; }
      return { status: r.status, ok: r.ok, corpo: j && typeof j === 'object' ? j : null };
    } catch (err) {
      throw erroCod(estourou ? 'prazo' : 'sem-app');
    } finally { clearTimeout(t); }
  }
  // status HTTP + corpo {erro, mensagem} do servidor → o código para a interface
  function codigoHttp(status, corpo) {
    const c = corpo && typeof corpo.erro === 'string' && /^[a-z0-9-]{2,40}$/.test(corpo.erro) && corpo.erro !== 'erro' ? corpo.erro : '';
    if (status === 401) return 'reiniciado';
    if (status === 423) return 'trava';
    if (status === 404) return 'sem-rota';
    if (status === 503) return c || 'sem-chrome';
    if (status === 504) return 'prazo';
    return c || 'erro';
  }
  function anotarEstado(e) {
    if (!e || typeof e !== 'object') return;
    if (typeof e.estado === 'string' && ESTADOS.has(e.estado)) remoto = e.estado;
    if (e.pacote === null || typeof e.pacote === 'string') O.pacote = e.pacote;
    if (remoto === 'sem-chrome') { O.suportado = false; O.motivo = 'sem-chrome'; }
  }
  function semSuporte(codigo) {
    if (codigo === 'sem-chrome' || codigo === 'sem-rota' || codigo === 'sem-suporte') { O.suportado = false; O.motivo = codigo; }
  }
  const mensagemDe = (corpo) => (corpo && typeof corpo.mensagem === 'string' ? corpo.mensagem.slice(0, 300) : undefined);

  // GET /api/ouvido/estado: o que o servidor sabe agora (não abre nada)
  async function consultar() {
    try {
      const r = await pedir('GET', '/api/ouvido/estado', undefined, PRAZO_CURTO_MS);
      if (!r.ok) { const c = codigoHttp(r.status, r.corpo); O.motivo = c; semSuporte(c); return null; }
      anotarEstado(r.corpo);
      return r.corpo;
    } catch (err) { O.motivo = err.codigo || 'sem-app'; return null; }
  }
  // enquanto um pedido longo corre (preparar, ligar), confere de 1,5 em 1,5 s se o servidor está baixando o pacote
  function vigiarInstalacao() {
    let vivo = true, t = 0;
    const passo = async () => {
      if (!vivo) return;
      const e = await consultar();
      if (!vivo) return;
      if (e && e.estado === 'instalando' && !avisouInstalando) { avisouInstalando = true; aviso('instalando', { pacote: e.pacote ?? null }); }
      t = setTimeout(passo, 1500);
    };
    t = setTimeout(passo, 1200);
    return { parar() { vivo = false; clearTimeout(t); } };
  }
  // POST /api/ouvido/preparar: abre o Chrome escondido e confere o pacote de voz. Com instalar: true baixa o pacote se
  // faltar (o botão "Baixar o pacote de voz"; o servidor só baixa por pedido explícito)
  async function pedirPreparar(corpo) {
    if (!buscar || !token) { O.motivo = 'sem-suporte'; return null; }
    avisouInstalando = false;
    const vigia = vigiarInstalacao();
    try {
      const r = await pedir('POST', '/api/ouvido/preparar', corpo, PRAZO_PREPARAR_MS);
      if (!r.ok) { const c = codigoHttp(r.status, r.corpo); O.motivo = c; semSuporte(c); return null; }
      anotarEstado(r.corpo);
      O.motivo = null;
      return r.corpo;
    } catch (err) { O.motivo = err.codigo || 'sem-app'; return null; } finally { vigia.parar(); }
  }
  const preparar = () => pedirPreparar({});
  const instalar = () => pedirPreparar({ instalar: true });
  function postPausar() {
    // keepalive: vale no pagehide (a página fechando); sem esperar a resposta
    pedir('POST', '/api/ouvido/pausar', { aba }, PRAZO_CURTO_MS, { keepalive: true }).catch(() => { /* o servidor pausa sozinho 2 s depois de o SSE cair */ });
  }

  /* ---------- SSE ---------- */
  function fecharSse() {
    nSse++;
    if (sse) { try { sse.ctl.abort(); } catch { /* nada */ } }
    sse = null;
  }
  // abre o SSE da aba; resolve quando o servidor aceitou (200), rejeita com .codigo. inicial = dentro do ligar (quem
  // trata a falha é o ligar); senão a falha agenda outra tentativa ou para tudo
  function abrirSse({ inicial }) {
    fecharSse();
    const n = nSse, ctl = new AbortController();
    sse = { n, ctl };
    let ok, falha;
    const pronto = new Promise((a, b) => { ok = a; falha = b; });
    pronto.catch(() => { /* quem não esperou não precisa ver */ });
    (async () => {
      let resp;
      let estourou = false;
      const t = setTimeout(() => { estourou = true; try { ctl.abort(); } catch { /* nada */ } }, PRAZO_CURTO_MS);   // só até os cabeçalhos
      try {
        resp = await buscar(url(`/api/ouvido/eventos?aba=${encodeURIComponent(aba)}`), {
          headers: { 'x-cerebro-token': token, accept: 'text/event-stream' }, cache: 'no-store', signal: ctl.signal,
        });
      } catch (err) {
        clearTimeout(t);
        if (n !== nSse) { falha(erroCod('fechado')); return; }   // fechado por mim (pausar)
        falha(erroCod(estourou ? 'prazo' : 'sem-app'));
        if (!inicial) aoQuedaSse(n);
        return;
      }
      clearTimeout(t);
      if (!resp.ok || !resp.body) {
        let j = null;
        try { j = await resp.json(); } catch { j = null; }
        // 5xx no SSE é passageiro (o servidor está ocupado ou reiniciando), menos o sem-chrome dito com todas as letras
        const c = codigoHttp(resp.status, j), passageiro = resp.status >= 500 && !(j && j.erro === 'sem-chrome');
        falha(erroCod(passageiro ? 'sem-app' : c));
        if (!inicial && n === nSse) {
          if (passageiro) aoQuedaSse(n);
          else { semSuporte(c); pararTudo(c, { avisarServidor: c !== 'reiniciado' }); }
        }
        return;
      }
      if (n !== nSse) { try { ctl.abort(); } catch { /* nada */ } falha(erroCod('fechado')); return; }
      falhasSse = 0; foraDesde = 0;
      ok();
      const leitor = resp.body.getReader(), dec = new TextDecoder();
      let buf = '';
      try {
        for (;;) {
          const { value, done } = await leitor.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let m;
          while ((m = /\r?\n\r?\n/.exec(buf))) {
            const bloco = buf.slice(0, m.index); buf = buf.slice(m.index + m[0].length);
            const ev = analisarSse(bloco);
            if (ev) aoEvento(ev.evento, ev.dados, n);
            if (n !== nSse) { try { leitor.cancel().catch(() => { /* já abortado */ }); } catch { /* nada */ } return; }
          }
          if (buf.length > 1e6) buf = '';   // bloco sem fim: lixo
        }
      } catch { /* caiu no meio */ }
      if (n === nSse) aoQuedaSse(n);
    })();
    return pronto;
  }
  function aoQuedaSse(n) {
    if (n !== nSse || !querLigado) return;
    sse = null;
    marcarParado();
    if (!foraDesde) { foraDesde = agora(); aviso('reconectando'); }
    if (agora() - foraDesde > T.semApp) { pararTudo('sem-app', { avisarServidor: true }); return; }
    const atraso = RECUO_SSE[Math.min(RECUO_SSE.length - 1, falhasSse++)];
    clearTimeout(tReconectar);
    tReconectar = setTimeout(reconectar, atraso);
  }
  async function reconectar() {
    if (!querLigado) return;
    try { await abrirSse({ inicial: false }); } catch { return; }   // a falha já agendou outra tentativa (ou parou)
    if (!querLigado || ligando) return;   // um ligar está correndo: ele mesmo acerta a sessão
    // o servidor pausa a dona 2 s depois de o SSE dela cair: confiro se ainda sou a dona e, se não, ligo de novo
    const e = await consultar();
    if (!querLigado || ligando) return;
    if (!e) { if (O.motivo === 'reiniciado' || O.motivo === 'sem-rota') pararTudo(O.motivo, { avisarServidor: false }); return; }
    if (e.dono !== aba) { religar(); return; }
    if (e.estado === 'ouvindo') { if (Number.isFinite(e.ger)) gerVale(e.ger); marcarOuvindo(); }
    else if (e.estado === 'caiu') armarCaiu();
    else if (e.estado === 'pronto' || e.estado === 'parado' || e.estado === 'desligado') religar();
    // abrindo, instalando, iniciando: o próprio servidor está ligando; os eventos chegam pelo SSE
  }

  /* ---------- eventos do servidor ---------- */
  function aoEvento(evento, d, n) {
    if (n !== nSse || !querLigado) return;
    switch (evento) {
      case 'resultado': {
        if (!gerVale(d.ger)) return;
        // igual ao onresult do criarOuvido: o final primeiro, depois o parcial (vazio limpa a legenda)
        const fin = textoDe(d.final), parc = textoDe(d.parcial);
        if (fin) chamar('final', fin);
        chamar('parcial', parc);
        return;
      }
      case 'nivel': if (gerVale(d.ger)) gravarNivel(d); return;
      case 'fala': if ((d.fase === 'inicio' || d.fase === 'fim') && gerVale(d.ger)) chamar('fala', d.fase); return;
      case 'estado': aoEstado(d); return;
      case 'erro': aoErroRemoto(d); return;
      default: return;
    }
  }
  function aoEstado(d) {
    const e = typeof d.estado === 'string' ? d.estado : '';
    if (!ESTADOS.has(e)) return;
    remoto = e;
    if (e === 'instalando') { if (!avisouInstalando) { avisouInstalando = true; aviso('instalando', { pacote: d.pacote ?? null }); } return; }
    // 'abrindo' sem eu estar ligando: o Chrome caiu e o servidor está abrindo de novo (ele religa na mesma sessão)
    if (e === 'caiu' || (e === 'abrindo' && !ligando)) { marcarParado(); aviso('caiu'); armarCaiu(); return; }
    if (e === 'sem-chrome') { pararTudo('sem-chrome', { avisarServidor: false }); return; }
    if (e === 'parado') {
      if (d.motivo === 'outra-aba' || d.motivo === 'desligado' || d.motivo === 'trava') { pararTudo(d.motivo, { avisarServidor: false }); return; }
      if (!gerVale(d.ger)) return;
      // a página do Chrome parou sozinha logo depois de um erro: era sem volta
      const er = ultimoErroRemoto && agora() - ultimoErroRemoto.t < 2000 ? ultimoErroRemoto : null;
      if (er) { pararTudo(er.codigo, { avisarServidor: false, mensagem: er.mensagem }); return; }
      marcarParado();
      // parado sem eu pedir (o servidor pausou a dona enquanto o SSE estava fora): ligo de novo
      if (!ligando) religar();
      return;
    }
    if (e === 'ouvindo' || e === 'iniciando') {
      if (!gerVale(d.ger)) return;
      if (e === 'ouvindo') marcarOuvindo();
    }
  }
  function aoErroRemoto(d) {
    const c = typeof d.codigo === 'string' && /^[a-z0-9-]{2,40}$/.test(d.codigo) ? d.codigo : 'erro';
    const mensagem = typeof d.mensagem === 'string' ? d.mensagem.slice(0, 300) : undefined;
    if (c === 'no-speech' || c === 'aborted') return;   // a página do Chrome já reinicia sozinha
    if (c !== 'caiu' && c !== 'trava' && !gerVale(d.ger)) return;
    if (FATAIS.has(c)) { pararTudo(c, { avisarServidor: true, mensagem }); return; }
    // a página do Chrome avisa e segue tentando: só aviso (o h.erro do jarvis.js pausaria o microfone)
    ultimoErroRemoto = { codigo: c, mensagem, t: agora() };
    aviso('erro-remoto', { codigo: c });
  }
  function gravarNivel(d) {
    if (typeof d.b !== 'string' || d.b.length > 200) return;
    let bin;
    try { bin = atob(d.b); } catch { return; }
    const n = Math.min(64, bin.length);
    for (let i = 0; i < n; i++) bandas[i] = bin.charCodeAt(i) / 255;
    for (let i = n; i < 64; i++) bandas[i] = 0;
    saidaNivel.db = Number.isFinite(d.db) ? Math.max(-120, Math.min(0, d.db)) : -90;
    nivelEm = agora();
  }
  function armarCaiu() {
    clearTimeout(tCaiu); clearTimeout(tReligarCaiu);
    tCaiu = setTimeout(() => { if (querLigado && !O.ouvindo) pararTudo('caiu', { avisarServidor: true }); }, T.caiu);
    // o servidor religa sozinho quando há dona; se o Chrome voltou ('pronto') e a sessão não, eu ligo de novo
    tReligarCaiu = setTimeout(() => { if (querLigado && !O.ouvindo && !ligando && remoto === 'pronto') religar(); }, T.religarAposCaiu);
  }

  /* ---------- ligar, religar, pausar ---------- */
  // POST /api/ouvido/ligar; minha = o nLigar de quem pediu (a resposta só vale se ninguém parou ou ligou de novo)
  async function pedirLigar(minha) {
    gerPiso = Math.max(gerPiso, gerAtual);   // a sessão anterior morreu: o que chegar dela é descartado
    avisouInstalando = false;
    const vigia = vigiarInstalacao();
    try {
      const r = await pedir('POST', '/api/ouvido/ligar', { aba, lang }, prazoLigarMs);
      if (!r.ok) throw erroCod(codigoHttp(r.status, r.corpo), mensagemDe(r.corpo));
      if (minha !== nLigar) return;
      const g = Number(r.corpo && r.corpo.ger);
      if (Number.isFinite(g) && g >= gerAtual) { gerAtual = g; gerPiso = Math.max(gerPiso, g - 1); }
      if (remoto !== 'ouvindo') remoto = 'iniciando';
    } finally { vigia.parar(); }
  }
  async function religar() {
    if (!querLigado || ligando) return;
    const t = agora();
    religadas = religadas.filter((x) => t - x < JANELA_RELIGADAS_MS);
    if (religadas.length >= MAX_RELIGADAS) { pararTudo('caiu', { avisarServidor: true }); return; }
    religadas.push(t);
    const minha = nLigar;
    const p = ligando = pedirLigar(minha);
    let falhou = null;
    try { await p; } catch (err) { falhou = err; }
    if (ligando === p) ligando = null;
    if (minha !== nLigar) { if (!falhou) postPausar(); return; }   // pararam (ou ligaram de novo) enquanto eu religava
    if (falhou) pararTudo((falhou && falhou.codigo) || 'erro', { avisarServidor: falhou.codigo !== 'reiniciado' });
  }
  async function ligar() {
    if (!O.suportado) throw erroCod(O.motivo === 'sem-chrome' || O.motivo === 'sem-rota' ? O.motivo : 'sem-suporte');
    if (querLigado) { if (ligando) return ligando.then(() => {}, () => {}); return; }   // já ligado (ou ligando)
    const minha = ++nLigar;
    querLigado = true; O.ativo = true; O.motivo = null; foraDesde = 0; falhasSse = 0; religadas = [];
    const p = ligando = (async () => {
      await abrirSse({ inicial: true });   // antes do ligar: nenhum evento se perde
      if (minha !== nLigar) return;
      await pedirLigar(minha);
    })();
    let falhou = null;
    try { await p; } catch (err) { falhou = err; }
    if (ligando === p) ligando = null;
    if (minha !== nLigar) {   // pausou no meio: sem erro (igual ao criarOuvido)
      if (!falhou) postPausar();   // o servidor já tinha me feito dona: pauso de novo, agora valendo
      return;
    }
    if (falhou) {
      const c = falhou.codigo || 'erro';
      semSuporte(c);
      pararTudo(null, { avisarServidor: c !== 'reiniciado' });
      O.motivo = c;
      if (c === 'sem-pacote') {
        // a interface oferece "Baixar o pacote de voz" (instalar()); o estado de verdade vem do servidor logo depois
        if (O.pacote !== 'unavailable') O.pacote = 'downloadable';
        consultar();
      }
      throw erroCod(c, falhou.message);
    }
    if (medidor === 'local') abrirMedidorLocal();   // sem esperar; se não abrir, fica o nível do Chrome
  }
  // para tudo; com codigo, avisa quem ouve com h.erro (depois de já estar parado: o pausar de lá não faz nada)
  function pararTudo(codigo, { avisarServidor = true, mensagem } = {}) {
    const tinha = querLigado || O.ativo || !!ligando || !!sse;
    nLigar++;
    querLigado = false; O.ativo = false; ultimoErroRemoto = null;
    clearTimeout(tReconectar); clearTimeout(tCaiu); clearTimeout(tReligarCaiu);
    fecharSse(); fecharMedidorLocal(); nivelEm = 0;
    gerPiso = Math.max(gerPiso, gerAtual);
    if (tinha && avisarServidor) postPausar();
    marcarParado();
    if (codigo) { O.motivo = codigo; chamar('erro', codigo, mensagem); }
  }
  function pausar() {
    const estava = O.ouvindo;
    O.ouvindo = false;
    pararTudo(null, { avisarServidor: true });
    // como o criarOuvido (o onend chega depois): o estado 'parado' vai na próxima volta
    if (estava) Promise.resolve().then(() => chamar('estado', 'parado'));
  }

  /* ---------- medidor local (medidor: 'local'): o microfone do Edge só para a onda ---------- */
  async function abrirMedidorLocal() {
    if (local.stream || local.abrindo) return;
    const md = typeof navigator !== 'undefined' && navigator.mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function' || !sons || typeof sons.contexto !== 'function') return;
    local.abrindo = true;
    try {
      const s = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const ctx = querLigado ? sons.contexto() : null;
      if (!ctx) { s.getTracks().forEach((t) => t.stop()); return; }
      local.stream = s;
      local.fonte = ctx.createMediaStreamSource(s);
      local.analisador = ctx.createAnalyser(); local.analisador.fftSize = 512; local.analisador.smoothingTimeConstant = 0.6;
      local.fonte.connect(local.analisador);
      local.freq = new Uint8Array(local.analisador.frequencyBinCount); local.tempo = new Float32Array(local.analisador.fftSize);
    } catch { fecharMedidorLocal(); } finally { local.abrindo = false; }
  }
  function fecharMedidorLocal() {
    try { local.fonte && local.fonte.disconnect(); } catch { /* nada */ }
    if (local.stream) { try { local.stream.getTracks().forEach((t) => t.stop()); } catch { /* nada */ } }
    local.stream = null; local.fonte = null; local.analisador = null;
  }

  function nivel() {
    if (!querLigado) return null;
    if (local.analisador) { try { return calcularNivel(local.analisador, local.freq, local.tempo, saidaNivel); } catch { fecharMedidorLocal(); } }
    return nivelEm && agora() - nivelEm <= NIVEL_VELHO_MS ? saidaNivel : null;
  }

  O.ligar = ligar; O.pausar = pausar; O.nivel = nivel;
  O.destruir = pausar;
  O.preparar = preparar; O.instalar = instalar; O.consultar = consultar;
  O.precisaBaixar = () => O.pacote === 'downloadable';
  O.estadoRemoto = () => remoto;
  return O;
}

/* =============================================================================
   Vigia do ouvido ANTIGO (o SpeechRecognition do Edge): depois de `limite` resultados finais vazios com fala
   detectada, sem nenhum texto no meio, chama aoVazio({vazios}) uma vez (zerar() arma de novo). A integração mostra
   TEXTOS_OUVIDO['edge-vazio'].
     V = criarVigiaVazio({ limite = 3, aoVazio, limiarDb = -38, vozMinMs = 250 })
     V.nivel(db)        o dB do medidor (o laço da interface manda a cada quadro); acima do limiar soma tempo de voz
     V.fala(fase)       'inicio' | 'fim' (speechstart / speechend) — só vale quando não há medidor
     V.resultado(e)     o SpeechRecognitionEvent (ou { resultIndex, results })
     V.fim(), V.zerar(), V.vazios, V.disparou
   ============================================================================= */
export function criarVigiaVazio({ limite = 3, aoVazio, limiarDb = -38, vozMinMs = 250, agora: relogio = agora } = {}) {
  let vazios = 0, disparou = false, vozMs = 0, ultNivel = 0, medidorEm = 0, falando = false;
  return {
    nivel(db) {
      const t = relogio();
      if (typeof db !== 'number' || !Number.isFinite(db)) return;
      const dt = ultNivel ? Math.max(0, Math.min(150, t - ultNivel)) : 0;
      if (db > limiarDb) vozMs += dt;
      ultNivel = t; medidorEm = t;
    },
    fala(fase) { falando = fase !== 'fim'; },
    resultado(e) {
      if (!e || !e.results) return;
      for (let i = e.resultIndex | 0; i < e.results.length; i++) {
        const r = e.results[i], t = String((r && r[0] && r[0].transcript) || '').trim();
        if (t) { vazios = 0; if (r.isFinal) vozMs = 0; continue; }   // veio texto: o reconhecimento funciona
        if (!r || !r.isFinal) continue;
        const comMedidor = medidorEm && relogio() - medidorEm < 2000;
        const falou = comMedidor ? vozMs >= vozMinMs : falando;
        vozMs = 0;
        if (!falou) continue;
        vazios++;
        if (vazios >= limite && !disparou) {
          disparou = true;
          try { aoVazio && aoVazio({ vazios }); } catch (err) { try { console.error(err); } catch { /* sem console */ } }
        }
      }
    },
    fim() { falando = false; },
    zerar() { vazios = 0; disparou = false; vozMs = 0; },
    get vazios() { return vazios; },
    get disparou() { return disparou; },
  };
}

/* vigiarEdge: troca window.SpeechRecognition / webkitSpeechRecognition por uma subclasse que liga o vigia em cada
   reconhecedor criado. Chamar ANTES do criarJarvis (o criarOuvido guarda o construtor quando é criado).
     W = vigiarEdge({ janela = window, aoVazio, limite = 3, nivel })   nivel: () => dB | {db} | null (lido de 100 em
         100 ms enquanto a sessão está ligada); sem ele, a interface chama W.vigia.nivel(db) no laço
     W = { vigia, observar(rec), desfazer() } */
export function vigiarEdge({ janela = globalThis, aoVazio, limite = 3, nivel = null } = {}) {
  const vigia = criarVigiaVazio({ limite, aoVazio });
  const trocados = new Map();   // nome → construtor original
  const subclasses = new Map(); // original → subclasse (o Edge pode ter os dois nomes para o mesmo construtor)
  function lerNivel() {
    if (typeof nivel !== 'function') return;
    let v = null;
    try { v = nivel(); } catch { v = null; }
    const db = typeof v === 'number' ? v : v && typeof v.db === 'number' ? v.db : null;
    if (db !== null) vigia.nivel(db);
  }
  function observar(rec) {
    if (!rec || typeof rec.addEventListener !== 'function') return rec;
    let t = 0;
    rec.addEventListener('result', (e) => vigia.resultado(e));
    rec.addEventListener('speechstart', () => vigia.fala('inicio'));
    rec.addEventListener('speechend', () => vigia.fala('fim'));
    rec.addEventListener('start', () => { clearInterval(t); if (typeof nivel === 'function') t = setInterval(lerNivel, 100); });
    rec.addEventListener('end', () => { clearInterval(t); t = 0; vigia.fim(); });
    return rec;
  }
  for (const nome of ['SpeechRecognition', 'webkitSpeechRecognition']) {
    const Orig = janela && janela[nome];
    if (typeof Orig !== 'function' || Orig.__cerebroVigiado) continue;
    let Sub = subclasses.get(Orig);
    if (!Sub) {
      Sub = class extends Orig { constructor(...a) { super(...a); observar(this); } };
      Object.defineProperty(Sub, '__cerebroVigiado', { value: true });
      subclasses.set(Orig, Sub);
    }
    trocados.set(nome, Orig);
    try { janela[nome] = Sub; } catch { trocados.delete(nome); }
  }
  return {
    vigia, observar,
    desfazer() { for (const [nome, Orig] of trocados) { try { janela[nome] = Orig; } catch { /* nada */ } } trocados.clear(); },
  };
}
