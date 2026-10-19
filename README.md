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
  usa, na entrada `jarvis`). Com `--simulado`, a trava do rosto usa uma pasta temporária (nunca o cadastro de verdade);
  no navegador, `?jarvis=simular&rosto=simular&debug` simula o microfone e a câmera. **O `?rosto=simular` e os ganchos
  do `?debug` só valem com o servidor em `--simulado`** (o servidor diz `teste: true`); no app de verdade a página
  ignora e avisa no console. Atenção: com o `INICIAR.bat` ligado, a porta 8790 já está em uso e o preview com
  `--simulado` não sobe — o navegador cai no app de verdade.
- `--trava-aberta` e `--rosto-pasta` são só de teste: **sem `--simulado` o servidor recusa e não liga**.
- Precisa do **Google Chrome** instalado: ele é o ouvido do Jarvis (abaixo). Sem ele, fica o reconhecimento do Edge.

## O ouvido (Chrome escondido)

Desde 18/10 o reconhecimento de voz do Edge 155 devolve **texto vazio**: a onda mexe, mas nada é transcrito. Decisão do
Júlio: **"Edge fala, Chrome ouve"**. O Jarvis continua no Edge (com a voz Antônio Online), e um **Google Chrome escondido**,
aberto pelo próprio app, reconhece a fala **neste computador, sem internet** (`processLocally`), e manda o texto para o
Edge pelo servidor. Especificação: `docs/OUVIDO-E-ROSTO.md`.

- O Chrome escondido **só abre quando o microfone liga** e fecha junto com o servidor (fechar a janela preta). Sem uso
  por 10 minutos, fecha sozinho. Ele não aparece na tela nem na barra de tarefas; o Windows mostra "Google Chrome está
  usando o microfone".
- **Um microfone só:** quem abre o microfone é o Chrome. A onda e o medidor do HUD vêm dele.
- **Pacote de voz:** na primeira vez o Jarvis oferece **"Baixar o pacote de voz (cerca de 300 MB, uma vez só)"**: o
  português e o inglês, que o Chrome exige junto (só o português não funciona). Fica no disco, em
  `%LOCALAPPDATA%\CerebroLube\ouvido-chrome` (**cerca de 650 MB** com o cache do próprio Chrome). Só baixa com o clique.
  Numa internet lenta o servidor espera o Chrome terminar (até 10 minutos) e a tela diz "Ainda baixando…". Se o Chrome
  não tiver o pacote do português (`unavailable`), o Jarvis não oferece o download e fica no ouvido do Edge; Chrome
  velho (sem a instalação do pacote) pede "Atualize o Google Chrome".
- **Ajustes › Ouvido:** "Chrome (offline)" ou "Edge". O padrão é o Chrome quando ele existe. No Edge, se o reconhecimento
  devolver vazio 3 vezes com você falando, o Jarvis avisa.
- **Eco:** o Chrome não ouve a voz do Jarvis (quem toca é o Edge), então o cancelador de eco não ajuda aqui. O filtro de
  eco por texto continua; **use fone de ouvido**.

## A trava do rosto

Na **primeira conversa do dia** (fuso de Brasília), antes de tudo, o Jarvis abre a câmera numa lente redonda, confere o
seu rosto com **prova de vida** (piscar 2 ou 3 vezes) e só então libera: o HUD entra e ele dá bom dia. Na primeira vez,
ele faz o **cadastro** (8 amostras, mexendo a cabeça devagar) e oferece o **Windows Hello** como reserva.

- **Quem decide é o servidor.** A página manda só números (o descritor de 128 números do rosto e o resumo do piscar); o
  servidor compara com o cadastro e guarda "liberado hoje". Enquanto não libera, o turno, o confirmar de uma ação e o
  ligar do ouvido respondem **423**. Se virar o dia com o Jarvis aberto, a próxima fala abre o rosto de novo e refaz o
  pedido; se ninguém estiver falando (o vigia do microfone à meia-noite), aparece só o cartão "Jarvis travado" e a
  câmera liga no clique.
- **A recusa não diz a distância** (ela serviria de bússola para adivinhar o rosto). A distância do acerto aparece no
  `?debug`, para conferir a calibragem.
- **Reserva:** o Windows Hello (PIN ou digital) quando o rosto falha 3 vezes (o rosto fica bloqueado por 10 minutos; o
  **2º bloqueio do mesmo dia vale até a meia-noite**), a câmera não existe ou foi negada. Falha de ontem não conta hoje.
  **Precisa do PIN do Windows Hello criado** em Configurações › Contas › Opções de entrada (hoje esta conta não tem). O
  Hello só funciona em `http://localhost:8790` (não em `127.0.0.1`).
- **A câmera nunca fica ligada esperando:** sem rosto em 45 s (60 s no cadastro), ela desliga e ficam os botões.
  "Travar agora" não abre a câmera: mostra o cartão "Jarvis travado" com "Conferir meu rosto".
- **Ajustes › Trava do rosto:** Travar agora, Cadastrar o rosto de novo, Cadastrar o Windows Hello e **Apagar meu
  cadastro** (pergunta antes; só com o dia liberado). **Trocar ou apagar o cadastro pede uma confirmação de até 5
  minutos** (rosto ou Hello): um "liberado" das 8 h não deixa um colega cadastrar o próprio rosto com o Jarvis aberto.
- **Cadastro que existe mas não dá para ler** (antivírus segurando, sem permissão, formato de outra versão): a trava
  fica fechada e o Jarvis não aceita um "primeiro cadastro" por cima. Feche o app e abra de novo; se continuar, veja
  "Se tudo falhar" abaixo.
- **Privacidade:** nenhuma foto nem quadro de vídeo é salvo ou sai do computador; a câmera desliga ao terminar, ao
  cancelar e quando a janela sai da frente. Os números do rosto e a chave **pública** do Windows Hello ficam só em
  `%LOCALAPPDATA%\CerebroLube\rosto\` (fora do repositório, do vault e do OneDrive), e o log nunca leva descritor nem
  distância. As bibliotecas do rosto vêm do jsdelivr (versão fixa); a página tem uma CSP que só deixa ela falar com o
  app, com as CDNs das bibliotecas e com o Guardião, para um arquivo trocado na CDN não mandar quadro da câmera para fora.
- **Seja honesto com o que ela é:** uma trava do Jarvis **neste computador**, não do Windows. Ela **não substitui o
  login do Windows**: quem entra na sua conta do Windows consegue apagar a trava. E **quem abrir o console do
  navegador neste computador e tiver uma foto sua consegue passar**, porque a prova de vida (o piscar) é conferida na
  página — o servidor só recebe números. Um vídeo seu também poderia enganar o piscar. Faça o cadastro você mesmo,
  sozinho na frente da câmera. Para proteção de verdade (por exemplo, no envio de e-mail), o caminho é o Windows Hello,
  que o console não forja.
- **Se tudo falhar** (sem câmera, sem Hello, o rosto não confere): feche o app e apague a pasta
  `%LOCALAPPDATA%\CerebroLube\rosto`. O Jarvis pede um cadastro novo.

| Pasta (fora do repositório e do OneDrive) | O que guarda |
|---|---|
| `%LOCALAPPDATA%\CerebroLube\ouvido-chrome\` | o perfil do Chrome escondido, com o pacote de voz |
| `%LOCALAPPDATA%\CerebroLube\rosto\cadastro.json` | as amostras do rosto (descritores) — **dado biométrico** |
| `%LOCALAPPDATA%\CerebroLube\rosto\hello.json` | a credencial do Windows Hello (id, chave pública, contador) |
| `%LOCALAPPDATA%\CerebroLube\rosto\estado.json` | o "liberado hoje" (dia, método, hora), as falhas e os bloqueios do dia |

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

- Com o ouvido do **Chrome** (o padrão), o reconhecimento roda **neste computador, sem internet**: o áudio do microfone
  não sai daqui. Com o ouvido do **Edge**, o reconhecimento em português é **na nuvem da Microsoft**.
- As vozes naturais do Edge ("Online") mandam o texto que o Jarvis fala para a Microsoft virar áudio.
- O que o Júlio fala e o que as ferramentas trazem vai para a **API do Claude** (Anthropic) para virar resposta.
- O e-mail e o banco são lidos daqui, direto do computador; nada passa por outro servidor nosso.

## Rotas (para a interface)

| Rota | Token | O que é |
|---|---|---|
| `GET /` | — | o painel, com `<meta name="cerebro-token">` desta partida (e `cerebro-simulado` no modo de teste) |
| `GET /api/vault` | — | `{vaultName, files:[{path, text, size, mtime}]}` |
| `GET /api/events` | — | SSE, evento `change` (`{notas:[caminhos]}`) quando uma nota muda |
| `GET /api/saude` | — | o JSON do `saude.painel()` |
| `GET /api/jarvis/estado` | sim | `{ok, tipo:'local', voz:true, modo:'claude'\|'simulado', modelo_conversa, modelo_pesado, busca_na_conversa, motivo?, conexoes:{vault, banco, email_leitura, email_envio, arquivos:[…], internet}, acoes_pendentes, trava:{liberado, dia, metodo?, cadastro, hello, tentativas_restantes, …}, ouvido:{estado, pacote, ger, dono}}` |
| `POST /api/jarvis/turno` | sim | `{conversa:[{papel:'julio'\|'jarvis', texto, interrompido?}], contexto:{tela, nota_aberta, rotina_aberta, departamento?}}` → SSE; **423 `trava`** enquanto o dia não foi liberado |
| `POST /api/jarvis/acao/:id` | sim | `{decisao:'confirmar'\|'recusar'}` → `{ok, mensagem}` (404 = já decidida ou expirou; confirmar travado = 423, recusar passa) |
| `/api/rosto/*` | sim | a trava: `estado`, `desafio`, `conferir`, `cadastro`, `apagar`, `travar`, `hello/opcoes`, `hello/cadastrar`, `hello/conferir` (`docs/OUVIDO-E-ROSTO.md` §5.4); trocar ou apagar sem a confirmação de até 5 min = 423 `reconfirme`; cadastro ilegível = 409 `ilegivel` |
| `/api/ouvido/*` | sim | o ouvido: `preparar`, `instalar` (baixa o pacote de voz; espera até 10 min), `ligar` (423 travado; 409 `sem-pacote`; 409 `pacote-indisponivel`), `pausar`, `estado`, `eventos?aba=` (SSE com `resultado`, `nivel`, `estado`, `fala`, `erro`) (§3.3) |

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
A página tem CSP: `connect-src` só para o app, o jsdelivr, o `storage.googleapis.com` (modelos do MediaPipe) e o
Guardião; imagem e mídia só do app (`data:`/`blob:`); formulário só para o app. As bibliotecas vêm do jsdelivr por
`import()`, que não aceita SRI: copiar para `web/vendor/` com hash conferido é o próximo passo.

## Testes

Na pasta `servidor`:

```
npm run teste:geral     # travas do SQL e de arquivos, extração, validação, conversa, vault ao vivo (e o banco, se houver ENV)
npm run teste:email     # IMAP e SMTP de mentira em 127.0.0.1: nada é marcado como lido, nada sai sem confirmar
npm run teste:cerebro   # o cérebro de verdade contra uma API do Claude de mentira (pedidos, ferramentas, recusa, corte)
npm run teste:rosto     # a trava com descritores sintéticos numa pasta temporária (e o Windows Hello falso)
npm run teste:ouvido-remoto   # o ouvido do Edge contra um servidor de mentira (SSE, quedas, outra aba, 423, 409)
npm run teste:ouvido    # o Chrome escondido de verdade, sem microfone: toca um .wav e confere o texto (~1 min)
npm run teste:integracao      # o servidor.js de verdade: 423 antes de liberar, cadastro sintético, e o caminho
                              # servidor → Chrome → SSE com o .wav (rodar DEPOIS do teste:ouvido, nunca junto)
```
`npm run teste` roda todos, um depois do outro. O `teste:ouvido` usa o perfil `%LOCALAPPDATA%\CerebroLube\ouvido-chrome-teste`
(baixa o pacote de voz na primeira vez e guarda). Nenhum teste abre o microfone ou a câmera de verdade, nem toca no
cadastro do rosto de verdade.

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
| `servidor/ouvido.js`, `web/ouvido.html` | o ouvido: o Chrome escondido por pipe e a página que ele carrega |
| `servidor/rosto.js` | a trava do rosto e o Windows Hello (`@simplewebauthn/server`) |
| `web/js/ouvido-remoto.js` | o ouvido do Chrome visto do Edge (mesma cara do ouvido antigo) e o vigia do Edge vazio |
| `web/js/rosto.js`, `web/css/rosto.css` | o portão: a lente com a câmera, o piscar, o cadastro, o Windows Hello |
| `servidor/teste/` | os testes e os servidores de mentira |
