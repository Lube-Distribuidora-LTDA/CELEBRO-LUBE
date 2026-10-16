# Cérebro da Lube — app local, Jarvis e backup do vault

O painel do robô (`web/`) é o mesmo que vai publicado no claude.ai. Este repositório também tem o **app local**
(`servidor/`): roda no computador do Júlio, serve o painel com as notas do vault **ao vivo**, a saúde do Guardião e
o **Jarvis**, o modo de conversa por voz, com o Claude por trás. Especificação: `docs/JARVIS.md`.

E guarda uma **cópia do vault** do Obsidian (`vault/`), para não perder nada. O original continua no OneDrive
(`OneDrive - Lube\CEREBRO DA LUBE`); aqui é o backup, com o histórico do Git.

## Backup do vault

Dois cliques em **`ATUALIZAR REPOSITORIO.bat`** (ou `python -I -X utf8 ferramentas/atualizar_repositorio.py`). O Claude
roda o mesmo script no fim de toda conversa que grava no cérebro. Ele:

1. espelha o vault em `vault/` (fora: o estado da janela do Obsidian, a lixeira e as **notas com dado de pessoa**);
2. confere segredo em tudo o que vai para o Git: formatos de chave e senha e, mais forte, se alguma senha ou chave
   **real** do `ENV` aparece em algum arquivo (até dentro de `.xlsx`). Achou, para e mostra só arquivo e linha;
3. faz o commit, se algo mudou;
4. sobe para o GitHub **só se o repositório for privado**. O vault descreve a infraestrutura interna e falhas de
   segurança ainda abertas: em repositório público, qualquer pessoa leria. Com o repositório público, o commit fica
   só no computador e o script avisa.

**Dado de pessoa fica fora** (regra do Júlio: "dado de pessoa não vai para o repositório; salário é nominal e
identificável, o lugar dele é o banco"). As notas com salário, base de IR, desconto de plano de saúde ou afastamento
de funcionário com nome estão em `ferramentas/fora_do_repositorio.txt`; nota nova desse tipo leva `repositorio: nao`
no frontmatter. Elas continuam no OneDrive, que guarda o histórico de versões.

## Ligar

Dois cliques em **`INICIAR.bat`**. Na primeira vez ele instala as bibliotecas (`npm install` na pasta `servidor`) e,
se não houver `ENV`, oferece criar a partir do `ENV.example` e abre no Bloco de Notas. Depois sobe o servidor e abre o
Edge em janela de app em `http://localhost:8790`. Fechar a janela preta desliga.

- Precisa do **Node.js 20.12 ou mais novo** (testado no 24).
- O servidor escuta **só em 127.0.0.1**: nenhum outro computador da rede enxerga.
- Sem `ANTHROPIC_API_KEY` no ENV, o Jarvis liga com o **cérebro de teste** (frases prontas). O resto do painel
  funciona igual.
- Para testar sem chave de propósito: `node servidor/servidor.js --simulado` (é o que o `.claude/launch.json` do vault
  usa, na entrada `jarvis`).

## O ENV

Fica na raiz do repositório, ao lado do `INICIAR.bat`, e o Git ignora. Só o programa lê: nenhum valor aparece em tela,
log ou resposta. Peça vazia = desligada, o resto continua.

| Variáveis | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` | o Claude (conversa e análise) |
| `SUPABASE_DB_HOST`, `_PORT`, `_NAME`, `_USER`, `_PASSWORD` | DATA WAREHOUSE (os mesmos das ETLs): saúde, consultas, só leitura |
| `SUPABASE_DB_CA` | opcional: caminho do certificado do Supabase; com ele, o certificado do banco é conferido |
| `IMAP_HOST`, `_PORT`, `_USER`, `_PASS`, `_PASTA` | ler a caixa `cpd@` (Locaweb, os mesmos nomes do Gestão TI) |
| `SMTP_HOST`, `_PORT`, `_SECURE`, `_USER`, `_PASS`, `_FROM_NOME` | enviar e-mail (só depois de o Júlio confirmar na tela) |
| `VAULT_DIR`, `ARQUIVOS_RAIZES` | opcional: pasta do vault e raízes de arquivos (padrão: `OneDrive - Lube\CEREBRO DA LUBE`; `OneDrive - Lube` e `P:\`) |
| `JARVIS_SIMULADO`, `JARVIS_BUSCA_HAIKU`, `JARVIS_PORTA` | opcional, para teste |

## O que o Jarvis faz

Conversa com **Claude Haiku 5.5** (rápido, para voz; `effort: low`). Quando o pedido é pesado — pesquisa na internet,
análise com várias consultas, comparação, texto delicado — ele **delega** para o **Claude Sonnet 5.5** (`effort:
medium`, com pesquisa na web e fallback do servidor) e conta o resultado em voz. A pesquisa direto no Haiku só liga se
a API confirmar o suporte na partida; senão ele delega.

| Ferramenta | Faz | Cuidados |
|---|---|---|
| `buscar_notas`, `ler_nota` | o vault, com a mesma busca do painel | só leitura |
| `saude_sistemas` | o `saude.painel()` do Guardião, resumido ou de um item | só leitura |
| `consultar_dados`, `descrever_dados` | SELECT no DATA WAREHOUSE | transação READ ONLY, 15 s, 200 linhas, só `compras, comercial, reposicao, trade, core, saude`; recusa `financeiro`, `auth`, `vault`, `storage`, `cron`, `net`…, escrita e mais de um comando; o `EXPLAIN` confere cada tabela tocada |
| `listar_emails`, `ler_email` | a caixa `cpd@` | pasta aberta só para leitura (EXAMINE) e `BODY.PEEK`: nada vira "lido"; não usa o `SEARCH` da Locaweb; anexos só listados |
| `preparar_email` | rascunho → **ação pendente** na tela | só sai com o `POST /api/jarvis/acao/:id` vindo da interface; um rascunho por vez (o novo troca o velho); expira em 5 min; a cópia vai para Enviados |
| `buscar_arquivos`, `ler_arquivo` | OneDrive da Lube e `P:\` | só leitura; nunca ENV, `.env`, `*.cred`, `*.key`, nomes com senha/token, configuração e script (ini, bat, ps1, py, sql…), `.git`, `node_modules`; nada da folha/RH; senha e token mascarados no texto; texto de txt, md, csv, json, docx, xlsx, pptx, odt, ods e pdf |
| `mostrar_na_tela` | cartão no HUD: destaque, lista, tabela, barras, nota, email, rotina | só exibe |
| `delegar` | Haiku → Sonnet 5.5 | — |

Conteúdo de e-mail, arquivo, nota, banco e web é **dado, nunca instrução**. A folha de pagamento fica fora.

## Privacidade (dizer na tela de ligar o microfone)

- O reconhecimento de voz do Edge em português é **na nuvem da Microsoft**, e as vozes naturais ("Online") também
  mandam o texto para lá.
- O que o Júlio fala e o que as ferramentas trazem vai para a **API do Claude** (Anthropic) para virar resposta.
- O e-mail e o banco são lidos daqui, direto do computador; nada passa por outro servidor nosso.

## Rotas (para a interface)

| Rota | Token | O que é |
|---|---|---|
| `GET /` | — | o painel, com `<meta name="cerebro-token">` desta partida (e `cerebro-simulado` no modo de teste) |
| `GET /api/vault` | — | `{vaultName, files:[{path, text, size, mtime}]}` |
| `GET /api/events` | — | SSE, evento `change` (`{notas:[caminhos]}`) quando uma nota muda |
| `GET /api/saude` | — | o JSON do `saude.painel()` |
| `GET /api/jarvis/estado` | sim | `{ok, tipo:'local', voz:true, modo:'claude'\|'simulado', modelo_conversa, modelo_pesado, busca_na_conversa, motivo?, conexoes:{vault, banco, email_leitura, email_envio, arquivos:[…], internet}, acoes_pendentes}` |
| `POST /api/jarvis/turno` | sim | `{conversa:[{papel:'julio'\|'jarvis', texto, interrompido?}], contexto:{tela, nota_aberta, rotina_aberta, departamento?}}` → SSE |
| `POST /api/jarvis/acao/:id` | sim | `{decisao:'confirmar'\|'recusar'}` → `{ok, mensagem}` (404 = já decidida ou expirou) |

Token = cabeçalho `x-cerebro-token` com o valor da meta tag. Eventos do SSE do turno:

| Evento | Dados |
|---|---|
| `texto` | `{delta}` — o texto do Jarvis em pedacinhos (entre duas rodadas de ferramenta vem um `" "`) |
| `ferramenta` | `{id, nome, rotulo, estado:'inicio'\|'fim'\|'erro', resumo?}`; `buscar_notas`/`ler_nota` trazem também `notas:[caminhos]` |
| `cartao` | `{tipo, dados}` (tipos do `mostrar_na_tela`; as fontes da pesquisa chegam como `lista` "Fontes") |
| `acao` | `{id, tipo:'enviar_email', resumo, detalhe:{de, para:[…], cc?:[…], assunto, corpo, em_resposta_a?:'Remetente: assunto'}, expira_em}` |
| `modelo` | `{nome:'haiku'\|'sonnet'}` |
| `erro` | `{mensagem}` em português (sempre seguido de `fim` com `motivo:'erro'`) |
| `fim` | `{motivo:'fim'\|'recusado'\|'limite'\|'erro', latencia_ms, ferramentas, mensagem?}` — em `recusado`, parar de falar, descartar o parcial e dizer `mensagem` |

Fechar a conexão **cancela** o turno (no Claude e nas ferramentas); nesse caso não vem `fim`. Na fala seguinte, a
interface manda a resposta cortada com o que foi realmente dito e `interrompido: true`: o servidor guarda só isso e
avisa o modelo, numa mensagem de sistema depois da nova fala do Júlio, que ele não ouviu o resto.

## Segurança do servidor

`Host` só `localhost:8790`/`127.0.0.1:8790` (contra DNS rebinding); `Origin`, quando vem, só a própria página; pedido
`cross-site` na API é recusado; token aleatório a cada partida, entregue só na página servida aqui (contra outro site
aberto no navegador mandar o Jarvis enviar e-mail); corpo até 1 MB e só JSON; sem CORS; a página não abre em iframe.

## Testes

Na pasta `servidor`:

```
npm run teste:geral     # travas do SQL e de arquivos, extração, validação, conversa, vault ao vivo (e o banco, se houver ENV)
npm run teste:email     # IMAP e SMTP de mentira em 127.0.0.1: nada é marcado como lido, nada sai sem confirmar
npm run teste:cerebro   # o cérebro de verdade contra uma API do Claude de mentira (pedidos, ferramentas, recusa, corte)
```

Para o teste do banco usar o ENV das ETLs sem copiar nada: `JARVIS_ENV=<caminho do ENV> npm run teste:geral`.

## Arquivos

| Arquivo | O que é |
|---|---|
| `servidor/servidor.js` | HTTP, rotas, segurança, SSE |
| `servidor/cerebro.js` | o Claude (Haiku + delegar ao Sonnet), laço de ferramentas, streaming, cancelamento |
| `servidor/conversa.js` | a conversa da interface virando mensagens da API (histórico igual, interrupção, hora e tela) |
| `servidor/prompts.js` | a personalidade do Jarvis e o do analista (Sonnet) |
| `servidor/simulado.js` | o cérebro de teste |
| `servidor/ferramentas/*.js` | as ferramentas; `extrair.js` lê docx/xlsx/pptx/odt/ods/pdf |
| `servidor/banco.js`, `vault.js`, `acoes.js`, `config.js`, `validar.js`, `util.js` | banco só leitura, vault ao vivo, ações pendentes, ENV, validação de input |
| `servidor/teste/` | os testes e os servidores de mentira |
