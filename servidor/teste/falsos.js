/* Servidores de e-mail DE MENTIRA para os testes (só em 127.0.0.1, sem TLS, credenciais de teste).
   IMAP: o mínimo que o imapflow usa (CAPABILITY, LOGIN, LIST/LSUB, SELECT/EXAMINE, FETCH/UID FETCH, APPEND, NOOP,
   LOGOUT) e registra cada comando — é o que prova que a leitura usa EXAMINE e BODY.PEEK e nunca STORE.
   SMTP: EHLO, AUTH PLAIN/LOGIN, MAIL, RCPT, DATA, QUIT; guarda o que recebeu. Nada sai deste computador. */
import net from 'node:net';

const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dataImap(d) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}-${MESES[d.getUTCMonth()]}-${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`;
}
const q = s => (s == null ? 'NIL' : `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
const end = (nome, email) => { const [m, h] = email.split('@'); return `((${q(nome)} NIL ${q(m)} ${q(h)}))`; };

/** msgs: [{uid, flags:[], data:Date, de:{nome,email}, para:email, assunto, messageId, bruta:Buffer, anexo?:{nome, tipo, tamanho}}] */
export function imapFalso({ usuario, senha, msgs }) {
  const registro = [];          // comandos recebidos (sem a senha)
  const anexados = [];          // APPEND recebidos {pasta, flags, bruta}
  const servidor = net.createServer(sock => {
    let buf = Buffer.alloc(0);
    let esperandoLiteral = null;  // {n, linha, tag}
    let logado = false, aberta = null, somenteLeitura = false;
    const enviar = s => sock.write(s);
    enviar('* OK [CAPABILITY IMAP4rev1] Servidor falso de teste pronto\r\n');

    const conjunto = (txt, porUid) => {
      const out = new Set();
      const maxSeq = msgs.length, maxUid = msgs.reduce((a, m) => Math.max(a, m.uid), 0);
      for (const parte of txt.split(',')) {
        const [a, b] = parte.split(':');
        const max = porUid ? maxUid : maxSeq;
        const ini = a === '*' ? max : +a, fim = b === undefined ? ini : (b === '*' ? max : +b);
        for (let i = Math.min(ini, fim); i <= Math.max(ini, fim); i++) out.add(i);
      }
      return msgs.map((m, i) => ({ m, seq: i + 1 })).filter(x => out.has(porUid ? x.m.uid : x.seq));
    };

    const envelope = m => `(${q(m.data.toUTCString())} ${q(m.assunto)} ${end(m.de.nome, m.de.email)} ${end(m.de.nome, m.de.email)} ${end(m.de.nome, m.de.email)} ${end('', m.para)} NIL NIL NIL ${q(m.messageId)})`;
    const estrutura = m => {
      const texto = '("text" "plain" ("charset" "utf-8") NIL NIL "7bit" 120 3 NIL NIL NIL NIL)';
      if (!m.anexo) return texto;
      return `(${texto}("application" "pdf" ("name" ${q(m.anexo.nome)}) NIL NIL "base64" ${m.anexo.tamanho} NIL ("attachment" ("filename" ${q(m.anexo.nome)})) NIL NIL) "mixed" ("boundary" "LIMITE") NIL NIL NIL)`;
    };

    function comando(tag, cmd, resto, literal) {
      const C = cmd.toUpperCase();
      registro.push(C === 'LOGIN' ? `${C} (credenciais)` : `${C} ${resto}`.trim());
      if (C === 'CAPABILITY') { enviar('* CAPABILITY IMAP4rev1\r\n'); enviar(`${tag} OK CAPABILITY concluído\r\n`); return; }
      if (C === 'NOOP') { enviar(`${tag} OK NOOP\r\n`); return; }
      if (C === 'LOGOUT') { enviar('* BYE até logo\r\n'); enviar(`${tag} OK LOGOUT\r\n`); sock.end(); return; }
      if (C === 'LOGIN') {
        const m = resto.match(/^"((?:[^"\\]|\\.)*)"\s+"((?:[^"\\]|\\.)*)"$/) || resto.match(/^(\S+)\s+(\S+)$/);
        const u = m && m[1].replace(/\\(.)/g, '$1'), p = m && m[2].replace(/\\(.)/g, '$1');
        if (u === usuario && p === senha) { logado = true; enviar(`${tag} OK LOGIN concluído\r\n`); }
        else enviar(`${tag} NO [AUTHENTICATIONFAILED] usuário ou senha errados\r\n`);
        return;
      }
      if (!logado) { enviar(`${tag} BAD faça login antes\r\n`); return; }
      if (C === 'LIST' || C === 'LSUB') {
        if (/^""\s+""$/.test(resto)) { enviar(`* ${C} (\\Noselect) "." ""\r\n${tag} OK ${C} concluído\r\n`); return; }   // sondagem do separador
        enviar(`* ${C} (\\HasNoChildren) "." "INBOX"\r\n`);
        enviar(`* ${C} (\\HasNoChildren \\Sent) "." "Enviados"\r\n`);
        enviar(`${tag} OK ${C} concluído\r\n`); return;
      }
      if (C === 'SELECT' || C === 'EXAMINE') {
        aberta = resto.replace(/"/g, '').split(' ')[0]; somenteLeitura = C === 'EXAMINE';
        enviar(`* ${msgs.length} EXISTS\r\n* 0 RECENT\r\n* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)\r\n`);
        enviar(`* OK [PERMANENTFLAGS (${somenteLeitura ? '' : '\\Seen \\Flagged'})] flags\r\n* OK [UIDVALIDITY 7] ok\r\n* OK [UIDNEXT ${msgs.length + 10}] ok\r\n`);
        enviar(`${tag} OK [${somenteLeitura ? 'READ-ONLY' : 'READ-WRITE'}] ${C} concluído\r\n`); return;
      }
      if (C === 'FETCH' || C === 'UID') {
        let porUid = false, args = resto;
        if (C === 'UID') { const [sub, ...r] = resto.split(' '); if (sub.toUpperCase() !== 'FETCH') { registro.push(`UID ${sub} (recusado)`); enviar(`${tag} BAD só UID FETCH aqui\r\n`); return; } porUid = true; args = r.join(' '); }
        const sp = args.indexOf(' ');
        const set = args.slice(0, sp), itens = args.slice(sp + 1).toUpperCase();
        for (const { m, seq } of conjunto(set, porUid)) {
          const partes = [`UID ${m.uid}`];
          if (itens.includes('FLAGS')) partes.push(`FLAGS (${m.flags.join(' ')})`);
          if (itens.includes('INTERNALDATE')) partes.push(`INTERNALDATE "${dataImap(m.data)}"`);
          if (itens.includes('ENVELOPE')) partes.push(`ENVELOPE ${envelope(m)}`);
          if (itens.includes('BODYSTRUCTURE')) partes.push(`BODYSTRUCTURE ${estrutura(m)}`);
          if (/BODY\[\]/.test(itens) && !/BODY\.PEEK\[\]/.test(itens)) m.flags = [...new Set([...m.flags, '\\Seen'])];   // como um servidor de verdade
          let corpo = null;
          if (/BODY(\.PEEK)?\[\]/.test(itens)) {
            const pm = itens.match(/BODY(?:\.PEEK)?\[\]<(\d+)\.(\d+)>/);
            const fatia = pm ? m.bruta.subarray(+pm[1], +pm[1] + +pm[2]) : m.bruta;
            corpo = fatia;
            partes.push(`BODY[]${pm ? `<${pm[1]}>` : ''} {${fatia.length}}`);
          }
          if (corpo) { sock.write(`* ${seq} FETCH (${partes.join(' ')}\r\n`); sock.write(corpo); sock.write(')\r\n'); }
          else sock.write(`* ${seq} FETCH (${partes.join(' ')})\r\n`);
        }
        enviar(`${tag} OK FETCH concluído\r\n`); return;
      }
      if (C === 'APPEND') {
        const pasta = (resto.match(/^"([^"]+)"|^(\S+)/) || [])[1] || (resto.match(/^(\S+)/) || [])[1];
        const flags = (resto.match(/\(([^)]*)\)/) || [])[1] || '';
        anexados.push({ pasta, flags, bruta: literal });
        enviar(`${tag} OK APPEND concluído\r\n`); return;
      }
      if (C === 'STORE') { enviar(`${tag} NO não neste teste\r\n`); return; }
      enviar(`${tag} BAD comando desconhecido ${C}\r\n`);
    }

    sock.on('data', d => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (esperandoLiteral) {
          if (buf.length < esperandoLiteral.n + 2) return;
          const lit = buf.subarray(0, esperandoLiteral.n);
          buf = buf.subarray(esperandoLiteral.n);
          const fimLinha = buf.indexOf('\r\n');
          if (fimLinha < 0) { buf = Buffer.concat([lit, buf]); return; }
          buf = buf.subarray(fimLinha + 2);
          const { tag, cmd, resto } = esperandoLiteral;
          esperandoLiteral = null;
          comando(tag, cmd, resto, Buffer.from(lit));
          continue;
        }
        const i = buf.indexOf('\r\n');
        if (i < 0) return;
        const linha = buf.subarray(0, i).toString('utf8');
        buf = buf.subarray(i + 2);
        const m = linha.match(/^(\S+)\s+(\S+)\s*(.*)$/);
        if (!m) continue;
        const [, tag, cmd, resto0] = m;
        const lit = resto0.match(/\{(\d+)(\+?)\}$/);
        if (lit) {
          if (!lit[2]) enviar('+ pode mandar\r\n');
          esperandoLiteral = { n: +lit[1], tag, cmd, resto: resto0.slice(0, lit.index).trim() };
          continue;
        }
        comando(tag, cmd, resto0.trim());
      }
    });
    sock.on('error', () => {});
  });
  return new Promise(res => servidor.listen(0, '127.0.0.1', () => res({ porta: servidor.address().port, registro, anexados, msgs, fechar: () => new Promise(r => servidor.close(r)) })));
}

export function smtpFalso({ usuario, senha }) {
  const recebidos = [];   // {de, para:[], dados:Buffer}
  const registro = [];
  const servidor = net.createServer(sock => {
    let buf = '', emDados = false, dados = '', de = null, para = [], authLogin = null, logado = false;
    const enviar = s => sock.write(s + '\r\n');
    enviar('220 smtp-falso ESMTP pronto');
    sock.on('data', d => {
      buf += d.toString('latin1');
      for (;;) {
        if (emDados) {
          const k = buf.indexOf('\r\n.\r\n');
          if (k < 0) { dados += buf; buf = ''; return; }
          dados += buf.slice(0, k); buf = buf.slice(k + 5);
          recebidos.push({ de, para: [...para], dados: Buffer.from(dados.replace(/^\.\./gm, '.'), 'latin1') });
          emDados = false; dados = ''; de = null; para = [];
          enviar('250 OK recebido (e não enviado: servidor de teste)');
          continue;
        }
        const i = buf.indexOf('\r\n');
        if (i < 0) return;
        const linha = buf.slice(0, i); buf = buf.slice(i + 2);
        if (authLogin) {
          if (authLogin.passo === 1) { authLogin.u = Buffer.from(linha, 'base64').toString(); authLogin.passo = 2; enviar('334 UGFzc3dvcmQ6'); }
          else { const p = Buffer.from(linha, 'base64').toString(); logado = authLogin.u === usuario && p === senha; authLogin = null; enviar(logado ? '235 OK' : '535 credenciais erradas'); }
          continue;
        }
        const C = linha.split(' ')[0].toUpperCase();
        registro.push(C === 'AUTH' ? 'AUTH (credenciais)' : linha.slice(0, 80));
        if (C === 'EHLO' || C === 'HELO') { sock.write('250-smtp-falso\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n'); }
        else if (C === 'AUTH') {
          const [, tipo, ini] = linha.split(' ');
          if (/^plain$/i.test(tipo)) {
            const partes = Buffer.from(ini || '', 'base64').toString().split('\0');
            logado = partes[1] === usuario && partes[2] === senha;
            enviar(logado ? '235 OK' : '535 credenciais erradas');
          } else { authLogin = { passo: 1 }; enviar('334 VXNlcm5hbWU6'); }
        }
        else if (C === 'MAIL') { if (!logado) { enviar('530 faça login'); continue; } de = linha; enviar('250 OK'); }
        else if (C === 'RCPT') { para.push((linha.match(/<([^>]+)>/) || [])[1]); enviar('250 OK'); }
        else if (C === 'DATA') { emDados = true; enviar('354 pode mandar'); }
        else if (C === 'RSET' || C === 'NOOP') enviar('250 OK');
        else if (C === 'QUIT') { enviar('221 tchau'); sock.end(); }
        else enviar('502 não implementado');
      }
    });
    sock.on('error', () => {});
  });
  return new Promise(res => servidor.listen(0, '127.0.0.1', () => res({ porta: servidor.address().port, recebidos, registro, fechar: () => new Promise(r => servidor.close(r)) })));
}
