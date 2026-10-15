/* Cérebro da Lube — js/bloqueio.js
   O que o Jarvis nunca abre, em qualquer cérebro (o app do computador e o modo texto no claude.ai). Módulo sem
   dependência e sem DOM: o servidor (servidor/ferramentas/arquivos.js) e o link (js/jarvis-link.js) usam o mesmo.
   - credenciais: ENV, .env*, *.cred, *.key, *.pem, *.pfx, *.kdbx…, e nomes com senha/password/token/segredo;
   - configuração e script (ini, cfg, conf, bat, ps1, py, js, sql, xml…): costumam guardar conexão de banco e de
     e-mail (o P:\ do WinThor tem vários), e o filtro de nome não pega;
   - pastas de sistema e ocultas: .git, node_modules, .ssh, AppData, lixeira…;
   - folha de pagamento e RH (decisão da casa: nenhum dado da folha no Jarvis): nomes com folha, holerite,
     contracheque, salário, rescisão, distrato, desligados, admissão, férias, pró-labore, FGTS, eSocial, e pastas RH/DP.
   E, no texto que for lido, as linhas do tipo "senha = …" saem mascaradas. */

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

const PASTAS_FORA = new Set(['.git', 'node_modules', '.ssh', '.aws', '.azure', '.gnupg', '$recycle.bin', 'system volume information', 'appdata', '__pycache__', '.venv', 'venv']);
const PASTAS_RH = new Set(['rh', 'dp', 'recursos humanos', 'departamento pessoal', 'pessoal', 'folha', 'folha de pagamento']);
const EXT_SEGREDO = new Set(['cred', 'key', 'pem', 'pfx', 'p12', 'kdbx', 'kdb', 'ppk', 'jks', 'keystore', 'ovpn', 'rdp', 'pgpass', 'gpg', 'asc']);
export const EXT_CONFIG = new Set(['ini', 'cfg', 'conf', 'config', 'env', 'properties', 'toml', 'yaml', 'yml', 'reg', 'dsn', 'udl', 'ora',
  'bat', 'cmd', 'ps1', 'psm1', 'vbs', 'sh', 'py', 'js', 'mjs', 'cjs', 'ts', 'sql', 'xml']);
const RX_SEGREDO = /(senha|password|passwd|credencia|credential|token|segredo|secret|apikey|api_key|chave.?privada)/;
const RX_FOLHA = /(folha|holerite|contracheque|contra.cheque|salari|rescis|distrato|desligad|admiss|ferias|pro.?labore|fgts|e.?social|ponto.?eletronico|beneficiario)/;

/** null = pode; 'segredo' | 'config' | 'folha' | 'sistema' | 'vazio' = fica de fora. */
export function nomeBloqueado(nome, ehPasta = false) {
  const n = norm(nome);
  if (!n) return 'vazio';
  if (ehPasta) {
    if (n.startsWith('.') || PASTAS_FORA.has(n)) return 'sistema';
    if (PASTAS_RH.has(n) || RX_FOLHA.test(n)) return 'folha';
    return null;
  }
  if (n === 'env' || n === '.env' || /^\.?env\.(?!example$)/.test(n) || (/^\.env/.test(n) && n !== '.env.example')) return 'segredo';
  const ext = n.includes('.') ? n.split('.').pop() : '';
  if (EXT_SEGREDO.has(ext)) return 'segredo';
  if (/^(id_rsa|id_ed25519|id_ecdsa|\.npmrc|\.netrc|\.git-credentials|\.pypirc)/.test(n)) return 'segredo';
  if (RX_SEGREDO.test(n)) return 'segredo';
  if (RX_FOLHA.test(n)) return 'folha';
  if (EXT_CONFIG.has(ext)) return 'config';
  return null;
}

export const MSG_BLOQUEIO = {
  segredo: 'Esse arquivo parece guardar senha, chave ou token, e o Jarvis não lê esse tipo de arquivo.',
  config: 'Arquivos de configuração e de script ficam fora do Jarvis: costumam guardar conexão de banco e senha.',
  folha: 'Arquivos da folha de pagamento e do RH ficam fora do Jarvis.',
  sistema: 'Essa pasta é de sistema ou oculta e fica fora do Jarvis.',
  vazio: 'Esse caminho não tem nome de arquivo.',
};

/** Um caminho inteiro (pastas e o arquivo do fim), com \ ou /. Devolve o motivo do primeiro pedaço bloqueado. */
export function caminhoBloqueado(caminho, { ultimoEhPasta = false } = {}) {
  const segs = String(caminho || '').split(/[\\/]+/).filter((s) => s && s !== '.' && !/^[a-z]:$/i.test(s));
  for (let i = 0; i < segs.length; i++) {
    const b = nomeBloqueado(segs[i], i < segs.length - 1 || ultimoEhPasta);
    if (b) return b;
  }
  return null;
}

// "senha = x", "Password: x", "pwd=x", "User Id=x", "token: x", "api_key = x" e o usuário:senha@ de endereço
const RX_LINHA_SEGREDO = /\b(senha|password|passwd|pwd|pass|user\s*id|token|secret|segredo|api[_-]?key|access[_-]?key|key|chave)\b(\s*["']?\s*[=:][ \t]*)("[^"\r\n]*"|'[^'\r\n]*'|[^\r\n;&"'<>]*[^\s;&"'<>])/gi;   // sem aspas: até o ; & ou o fim da linha
const RX_URL_CRED = /(\/\/)[^\s:/@]+:[^\s@/]+@/g;

/** Mascara valores de senha, token e conexão no texto que vai para o modelo (e, dele, para a tela e a voz). */
export function mascararSegredos(texto) {
  return String(texto ?? '')
    .replace(RX_URL_CRED, '$1[oculto]@')
    .replace(RX_LINHA_SEGREDO, (m, nome, sep) => `${nome}${sep}[oculto]`);
}
