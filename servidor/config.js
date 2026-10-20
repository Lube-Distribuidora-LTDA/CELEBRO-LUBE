/* Cérebro da Lube — servidor/config.js
   Lê o ENV (credenciais) e monta a configuração do app local.
   - O ENV fica na pasta do repositório (ao lado do INICIAR.bat) e é ignorado pelo Git. Formato KEY=VALOR, como o das ETLs.
   - Só os nomes da lista NOMES são lidos do arquivo; qualquer outra linha é ignorada (o ENV das ETLs traz Oracle, que
     aqui não serve).
   - Uma variável já definida no ambiente do processo vale mais que a do arquivo (é assim que os testes apontam o e-mail
     para servidores de mentira).
   - Nenhum valor é impresso: fora deste arquivo, o resto do programa só pergunta "tem ou não tem". */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..');
export const WEB = path.join(RAIZ, 'web');

const NOMES = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_DB_HOST', 'SUPABASE_DB_PORT', 'SUPABASE_DB_NAME', 'SUPABASE_DB_USER', 'SUPABASE_DB_PASSWORD', 'SUPABASE_DB_CA',
  'IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASS', 'IMAP_PASTA', 'IMAP_SECURE',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_NOME',
  'VAULT_DIR', 'ARQUIVOS_RAIZES',
  'JARVIS_SIMULADO', 'JARVIS_PORTA', 'JARVIS_BUSCA_HAIKU',
  'JARVIS_PASTA', 'JARVIS_TETO_DIA_USD',
];

/* Onde procurar o ENV, nesta ordem: JARVIS_ENV (caminho explícito), a raiz do repositório, a pasta servidor/. */
function acharEnv() {
  const candidatos = [];
  if (process.env.JARVIS_ENV) candidatos.push(process.env.JARVIS_ENV);
  for (const pasta of [RAIZ, AQUI]) for (const nome of ['ENV', '.env']) candidatos.push(path.join(pasta, nome));
  for (const c of candidatos) {
    try { if (fs.statSync(c).isFile()) return c; } catch (_) { /* não existe */ }
  }
  return null;
}

function lerArquivoEnv(caminho) {
  if (!caminho) return {};
  try {
    const bruto = fs.readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '');
    const tudo = parseEnv(bruto);
    const out = {};
    for (const n of NOMES) if (typeof tudo[n] === 'string') out[n] = tudo[n].trim();
    return out;
  } catch (_) {
    return {};   // o motivo não é impresso: poderia citar um trecho do arquivo
  }
}

const oneDrive = (() => {
  const v = process.env.OneDriveCommercial;
  if (v && fs.existsSync(v)) return v;
  return path.join(os.homedir(), 'OneDrive - Lube');
})();

export function carregarConfig(argv = process.argv.slice(2)) {
  const arquivo = acharEnv();
  const doArquivo = lerArquivoEnv(arquivo);
  const v = {};
  for (const n of NOMES) {
    const doProcesso = process.env[n];
    v[n] = doProcesso != null && doProcesso !== '' ? String(doProcesso).trim() : (doArquivo[n] ?? '');
  }
  const tem = n => !!(v[n] && v[n].length);
  const porta = Number(v.JARVIS_PORTA) > 0 ? Number(v.JARVIS_PORTA) : 8790;
  const vaultDir = tem('VAULT_DIR') ? v.VAULT_DIR : path.join(oneDrive, 'CEREBRO DA LUBE');
  const raizes = (tem('ARQUIVOS_RAIZES') ? v.ARQUIVOS_RAIZES.split(';') : [oneDrive, 'P:\\'])
    .map(s => s.trim()).filter(Boolean).map(s => path.resolve(s));
  const simuladoPedido = argv.includes('--simulado') || v.JARVIS_SIMULADO === '1';
  const semChave = !tem('ANTHROPIC_API_KEY') && v.JARVIS_SIMULADO !== '0';
  // o teto de gasto do construtor por dia (docs/JARVIS-ACOES.md §7.5): padrão US$ 10, no máximo US$ 50
  const teto = Number(String(v.JARVIS_TETO_DIA_USD || '').replace(',', '.'));
  const cfg = {
    arquivoEnv: arquivo,
    porta,
    vaultDir,
    raizes,
    abrirNavegador: argv.includes('--abrir'),
    simulado: simuladoPedido || semChave,
    motivoSimulado: simuladoPedido ? 'Cérebro simulado (pedido com --simulado ou JARVIS_SIMULADO=1).'
      : semChave ? 'Sem ANTHROPIC_API_KEY no ENV: o Jarvis roda com o cérebro simulado.' : null,
    buscaHaiku: v.JARVIS_BUSCA_HAIKU === '1' ? true : v.JARVIS_BUSCA_HAIKU === '0' ? false : null,
    // a pasta do Jarvis (o único lugar onde ele cria, muda, move e apaga): padrão <OneDrive - Lube>\JARVIS (pasta.js)
    jarvisDir: tem('JARVIS_PASTA') ? path.resolve(v.JARVIS_PASTA) : null,
    tetoDiaUsd: Number.isFinite(teto) && teto > 0 ? Math.min(teto, 50) : 10,
    anthropic: { apiKey: tem('ANTHROPIC_API_KEY') ? v.ANTHROPIC_API_KEY : undefined },
    banco: tem('SUPABASE_DB_HOST') && tem('SUPABASE_DB_USER') && tem('SUPABASE_DB_PASSWORD') ? {
      host: v.SUPABASE_DB_HOST,
      port: Number(v.SUPABASE_DB_PORT) || 5432,
      database: v.SUPABASE_DB_NAME || 'postgres',
      user: v.SUPABASE_DB_USER,
      password: v.SUPABASE_DB_PASSWORD,
      ca: tem('SUPABASE_DB_CA') ? path.resolve(v.SUPABASE_DB_CA) : undefined,   // caminho do certificado (não é segredo)
    } : null,
    imap: tem('IMAP_HOST') && tem('IMAP_USER') && tem('IMAP_PASS') ? {
      host: v.IMAP_HOST,
      port: Number(v.IMAP_PORT) || 993,
      secure: v.IMAP_SECURE ? v.IMAP_SECURE !== 'false' : (Number(v.IMAP_PORT) || 993) !== 143,
      user: v.IMAP_USER,
      pass: v.IMAP_PASS,
      pasta: v.IMAP_PASTA || 'INBOX',
    } : null,
    smtp: tem('SMTP_HOST') && tem('SMTP_USER') && tem('SMTP_PASS') ? {
      host: v.SMTP_HOST,
      port: Number(v.SMTP_PORT) || 465,
      secure: v.SMTP_SECURE ? v.SMTP_SECURE === 'true' : (Number(v.SMTP_PORT) || 465) === 465,
      user: v.SMTP_USER,
      pass: v.SMTP_PASS,
      nome: v.SMTP_FROM_NOME || 'TI - Lube Distribuidora',
    } : null,
  };
  return cfg;
}

/* O que pode aparecer em tela e log: só se cada peça está configurada, nunca os valores. */
export function resumoConfig(cfg) {
  return {
    env: cfg.arquivoEnv ? path.basename(path.dirname(cfg.arquivoEnv)) + path.sep + path.basename(cfg.arquivoEnv) : null,
    cerebro: cfg.simulado ? 'simulado' : 'claude',
    banco: !!cfg.banco,
    email_leitura: !!cfg.imap,
    email_envio: !!cfg.smtp,
  };
}
