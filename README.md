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
- **Eco:** o Chrome não ouve a voz do Jarvis (quem toca é o Edge), então o cancelador de eco não ajuda aqui.
  **Sem fone, um fala de cada vez** (desde 2026-10-20, pedido do Júlio): enquanto o Jarvis fala, e 0,45 s depois, o que
  o microfone ouve é jogado fora (o botão mostra "Mudo"); o trecho do reconhecimento que começou com a voz dele no ar
  sai inteiro. Para cortar a fala: o botão **Interromper** ou segurar **Espaço**; quando ele termina, o microfone abre
  sozinho. Com "Estou de fone de ouvido" marcado nos Ajustes, o microfone fica aberto e a voz interrompe.

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
| `JARVIS_PASTA` | opcional: a pasta do Jarvis, o único lugar onde ele escreve (padrão `OneDrive - Lube\JARVIS`; disco deste computador) |
| `JARVIS_TETO_DIA_USD` | opcional: teto de gasto do construtor por dia, em dólar (padrão 10, no máximo 50) |
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

### O Jarvis que faz (2026-10-20; especificação em `docs/JARVIS-ACOES.md`)

**A pasta do Jarvis.** Ele cria, muda, move, renomeia e apaga **só** em `OneDrive - Lube\JARVIS` (subpastas `Anotações`,
`Planilhas`, `Prints`, `Projetos`, `Arquivos`; nasce no primeiro uso). Fora dela continua só lendo. Copiar de fora
**para dentro** pode. Todo caminho é conferido pelo caminho real (junção, `..`, caminho curto 8.3, rede, `arquivo:x`,
nome reservado do Windows); a raiz e as cinco subpastas não saem do lugar; o que executa (`.bat`, `.js` fora de um
projeto, `.exe`, `.lnk`…) nunca é criado nem aberto; senha, token e chave saem mascarados do texto gravado.

**Criar é livre; o resto espera o "aprovado" falado.** Mudar um arquivo, mover, renomear, apagar (**sempre para a
Lixeira do Windows**, nunca de vez; antes ele confere que a Lixeira daquele disco está ligada e cabe o item), mandar
e-mail, preencher formulário em site, abrir site que o Júlio não citou e começar uma construção viram um **cartão** na
tela. O Júlio aprova **falando** ("aprovado", "pode fazer", "confirmo"…) ou recusa ("não", "cancela", "reprovado"…);
o botão **Aprovar** continua. Uma ação por vez (a nova troca a velha, com aviso); cada uma vence em 5 minutos. Travas da
voz: o cartão na tela há 1,5 s, a fala começando com o Jarvis calado há 1,5 s (o eco dele nunca aprova), a fala inteira
sendo a frase e o silêncio depois (1,2 s; 1,8 s para palavra única). "Sim", "pode" e "isso" sozinhos só valem antes de a
conversa andar. O Jarvis nunca diz as palavras de aprovar.

| Ferramenta | Faz | Aprovação |
|---|---|---|
| `anotar`, `criar_arquivo`, `criar_pasta`, `listar_pasta` | anotação Markdown em `Anotações` (data e hora no nome), arquivo de texto, pasta, listar | livre |
| `copiar_para_jarvis` | copia um arquivo que ele lê (OneDrive, `P:`) para `Arquivos` (até 200 MB; as proibições do `ler_arquivo`) | livre |
| `criar_planilha` | `.xlsx` (exceljs 4.4.0) de um SELECT (até 50 mil linhas, as travas do `consultar_dados`) ou de uma lista: cabeçalho azul, filtro, cabeçalho congelado, número como número, data como data, linha Total | livre |
| `abrir_no_windows` | abre no programa padrão (Excel, PDF, imagem) ou mostra no Explorer, só da pasta do Jarvis | livre; página HTML no navegador = **ação `abrir`** (aprovação por voz) |
| `alterar_texto`, `mover`, `renomear`, `apagar` | mudar um texto que existe; mover; renomear; mandar para a Lixeira | **cartão + "aprovado"** |
| `abrir_site`, `print_site`, `seguir_link` | um Chrome escondido **só dele** (perfil `%LOCALAPPDATA%\CerebroLube\navegador-chrome`, sem login, sem download) abre o site, tira o print (`Prints`, e a janelinha na tela) e organiza a página num cartão (títulos, trechos, tabela, links numerados) | livre para site citado, visto na pesquisa ou em link, `*.gov.br` e `*.lube.com.br`; outro = cartão `navegar` |
| `preencher_formulario` | preenche e envia um formulário da página aberta (nunca senha, login, CPF, CNPJ, cartão ou código) | **cartão + "aprovado"** |
| `construir`, `ver_construcao`, `parar_construcao`, `listar_projetos` | o **construtor**: um Claude Code dentro do Jarvis faz site, BI ou pequeno programa em `Projetos\<nome>` | começar = **cartão com o custo + "aprovado"**; parar é livre |
| `camera`, `olhar_camera` | a câmera **"Ver você"** (botão no HUD): ligar, desligar, conferir o rosto; olhar o quadro de agora | ligar só quando a fala do Júlio pede a câmera (senão o botão pisca); o quadro só vai à API quando ele olha |
| `cancelar_acao` | tira da tela a ação que espera aprovação, sem fazer nada | livre (recusar é o lado seguro; aprovar, nunca) |

**O navegador** não entra na rede da Lube nem neste computador (127.0.0.1, `localhost`, IP interno, nome de uma palavra
só como `SRV-IA`, nome que o DNS resolve para dentro; nem por redirecionamento): o Jarvis não alcança o próprio app nem a
Abertura de margem (que escreve no WinThor). Conteúdo de site é **dado, nunca instrução** (texto escondido fica de fora).

**O construtor** (`@anthropic-ai/claude-agent-sdk` **0.3.290**, modelo `claude-sonnet-5-5`): antes de começar mostra o
custo estimado e o teto (pequeno ~US$ 0,13 / teto 0,40; médio ~0,32 / 0,90; grande ~0,78 / 2,00; no máximo US$ 5 por
construção e `JARVIS_TETO_DIA_USD` por dia) e espera o "aprovado". Trabalha só na pasta do projeto (uma guarda
`PreToolUse` libera só Read, Write, Edit, Glob e Grep lá dentro; sem comandos, sem internet, sem `node_modules`; HTML e
JavaScript com bibliotecas por CDN); dados só pela ferramenta própria, só leitura (as travas do `consultar_dados`). O
andamento aparece no HUD (chip "CONSTRUINDO · 2:14 · US$ 0,12"); para no teto; no fim confere o código (endereço de fora,
chamada de rede, ActiveX), tira o print da prévia e, se passou, abre a prévia **por `file://`** no navegador padrão
(nunca servida pelo app: uma página gerada lá leria o token). O gasto do dia fica em
`%LOCALAPPDATA%\CerebroLube\construtor\gastos.json`.

**A câmera "Ver você"**: janelinha redonda com a imagem do Júlio. Enquanto ela está ligada, cada fala leva o quadro mais
recente (JPEG de 768 px, só na memória); o servidor só entrega ao Claude quando ele chama `olhar_camera`, e no histórico
a imagem vira uma linha de texto. Nada de quadro em disco, log ou repositório. A tela avisa: "Quando eu olho, a foto vai
para a API do Claude." Ela desliga sozinha com a janela fora da frente, o Jarvis fechando, o portão do rosto e 10 min sem
conversa.

**O atalho Ctrl+Alt+J**: o Júlio roda o `CRIAR ATALHO.bat` (cria "Jarvis da Lube" no menu Iniciar; para desfazer,
apague o atalho). Com o app desligado, ele liga o app já no Jarvis; ligado, avisa o app (`POST /api/jarvis/chamar` com a
chave de `%LOCALAPPDATA%\CerebroLube\atalho.chave`, nova a cada partida) e traz a janela para a frente.

**Pastas novas** (fora do repositório): `OneDrive - Lube\JARVIS\` (o que ele cria; sincroniza com a nuvem da Lube),
`%LOCALAPPDATA%\CerebroLube\navegador-chrome\`, `construtor-claude\` (a configuração do construtor, sem chave nem
conversa), `construtor\gastos.json` e `atalho.chave`.

**`npm audit`**: 2 avisos moderados no `uuid@8` que o `exceljs` usa (GHSA-w5hq-g745-h8pq: só nas versões v3/v5/v6 com
`buf`; o exceljs usa a v4). Aceito.

## Privacidade (dizer na tela de ligar o microfone)

- Com o ouvido do **Chrome** (o padrão), o reconhecimento roda **neste computador, sem internet**: o áudio do microfone
  não sai daqui. Com o ouvido do **Edge**, o reconhecimento em português é **na nuvem da Microsoft**.
- As vozes naturais do Edge ("Online") mandam o texto que o Jarvis fala para a Microsoft virar áudio.
- O que o Júlio fala e o que as ferramentas trazem vai para a **API do Claude** (Anthropic) para virar resposta.
- O e-mail e o banco são lidos daqui, direto do computador; nada passa por outro servidor nosso.
- A câmera "Ver você" fica só na janela; quando o Jarvis olha, a foto daquele momento vai para a API do Claude. Nada é
  gravado. O que ele cria na pasta JARVIS sincroniza com o OneDrive da Lube.

## Rotas (para a interface)

| Rota | Token | O que é |
|---|---|---|
| `GET /` | — | o painel, com `<meta name="cerebro-token">` desta partida (e `cerebro-simulado` no modo de teste) |
| `GET /api/vault` | — | `{vaultName, files:[{path, text, size, mtime}]}` |
| `GET /api/events` | — | SSE, evento `change` (`{notas:[caminhos]}`) quando uma nota muda; `jarvis` (`{acao:'abrir'}`) quando o Ctrl+Alt+J chama (guardado 10 s) |
| `GET /api/saude` | — | o JSON do `saude.painel()` |
| `GET /api/jarvis/estado` | sim | `{ok, tipo:'local', voz:true, modo:'claude'\|'simulado', modelo_conversa, modelo_pesado, busca_na_conversa, motivo?, conexoes:{vault, banco, email_leitura, email_envio, arquivos:[…], internet}, acoes_pendentes, trava:{liberado, dia, metodo?, cadastro, hello, tentativas_restantes, …}, ouvido:{estado, pacote, ger, dono}, jarvis:{pasta, pasta_teste?, navegador:{estado, url?, titulo?}, construcao}}` |
| `POST /api/jarvis/turno` | sim | `{conversa:[{papel:'julio'\|'jarvis', texto, interrompido?}], contexto:{tela, nota_aberta, rotina_aberta, departamento?, aba, camera?:{jpeg, w, h, em}}}` → SSE; **423 `trava`** enquanto o dia não foi liberado; **400 `camera`** se o quadro veio estragado ou velho (mais de 30 s) |
| `POST /api/jarvis/acao/:id` | sim | `{decisao:'confirmar'\|'recusar', motivo?, via?:'voz'\|'clique'\|'teclado'}` → `{ok, mensagem, cartao?, cartoes?, fala?}` (`fala`: a frase da voz, sem caminho; 404 = já decidida, trocada ou expirou; aprovar travado = 423, recusar passa) |
| `POST /api/jarvis/camera/quadro` | sim | `{pedido, quadro:{jpeg, w, h, em}\|null}`: o quadro novo que o `olhar_camera` pediu no turno (evento `camera {acao:'quadro', pedido}`); só na memória; 404 pedido que não existe; 400 quadro estragado ou velho; 423 travado |
| `GET /api/jarvis/eventos?aba=` | sim | SSE da aba: `construcao` (andamento), `acao` (`{evento:'nova'\|'trocada'\|'decidida'\|'expirou', id, tipo}`), `cartao`, `falar`; ao conectar, a construção que roda ou a última desta aba que terminou há até 15 min (`reenvio: true`); 423 travado |
| `GET /api/jarvis/arquivo/:id` | sim | um print (`png`, `jpg`, `webp`) da pasta do Jarvis pelo id do cartão, sem cache; 404; 415 outro tipo; 423 travado |
| `POST /api/jarvis/abrir` | sim | `{id, modo:'abrir'\|'mostrar'}` → `{ok}`: abre no Windows ou mostra no Explorer (é o clique do Júlio: a página HTML abre direto; pelo modelo, só com a ação `abrir` aprovada); 404; 415 (o que executa); 423 |
| `GET /api/jarvis/construcao` | sim | o estado do construtor `{ativa, ultimas}` |
| `POST /api/jarvis/construcao/parar` | sim | para a construção que roda (sem a trava: parar é seguro); 404 = nada rodando |
| `POST /api/jarvis/chamar` | **não**: `x-cerebro-atalho` | o atalho Ctrl+Alt+J; só pede para a tela abrir o Jarvis; 401 sem a chave |
| `/api/rosto/*` | sim | a trava: `estado`, `desafio`, `conferir`, `cadastro`, `apagar`, `travar`, `hello/opcoes`, `hello/cadastrar`, `hello/conferir` (`docs/OUVIDO-E-ROSTO.md` §5.4); trocar ou apagar sem a confirmação de até 5 min = 423 `reconfirme`; cadastro ilegível = 409 `ilegivel` |
| `/api/ouvido/*` | sim | o ouvido: `preparar`, `instalar` (baixa o pacote de voz; espera até 10 min), `ligar` (423 travado; 409 `sem-pacote`; 409 `pacote-indisponivel`), `pausar`, `estado`, `eventos?aba=` (SSE com `resultado`, `nivel`, `estado`, `fala`, `erro`) (§3.3) |

Token = cabeçalho `x-cerebro-token` com o valor da meta tag. Eventos do SSE do turno:

| Evento | Dados |
|---|---|
| `texto` | `{delta}` — o texto do Jarvis em pedacinhos (entre duas rodadas de ferramenta vem um `" "`) |
| `ferramenta` | `{id, nome, rotulo, estado:'inicio'\|'fim'\|'erro', resumo?}`; `buscar_notas`/`ler_nota` trazem também `notas:[caminhos]` |
| `cartao` | `{tipo, dados}` (tipos do `mostrar_na_tela`; as fontes da pesquisa chegam como `lista` "Fontes"; e os do Jarvis que faz: `print`, `pagina`, `arquivo`, `pasta`, `planilha`, `anotacao`, `construcao`, formato no cabeçalho do `web/js/jarvis-acoes.js`) |
| `acao` | `{id, tipo:'enviar_email'\|'mover'\|'renomear'\|'apagar'\|'alterar'\|'formulario'\|'construir'\|'navegar', rotulo?, resumo, detalhe, expira_em, substituiu?}` (o detalhe de cada tipo em `docs/JARVIS-ACOES.md` §4.1) |
| `camera` | `{acao:'ligar'\|'desligar'\|'conferir'\|'olhou'\|'pedir'\|'quadro', pedido?}` — a câmera "Ver você" (`pedir`: o botão pisca; `quadro`: mande o quadro de agora pela rota `camera/quadro`) |
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
npm run teste:camera    # as listas da aprovação por voz, os cartões e o olhar_camera (sem câmera de verdade)
npm run teste:pasta     # a pasta do Jarvis numa pasta temporária: caminhos, nomes, ações só depois de aprovar, planilha
npm run teste:construtor      # o construtor com um query de mentira (guarda, custo, teto, parar); com
                              # TESTE_CONSTRUTOR_REAL=1, uma rodada de verdade (~US$ 0,03)
npm run teste:navegador # o Chrome escondido de verdade contra um site de mentira em 127.0.0.1 (~1 min)
npm run teste:faz       # o servidor.js de verdade com --simulado e --teste-pasta: anotar, planilha, mover aprovado por
                        # voz, apagar recusado, a câmera, o site, a construção de mentira, o atalho e o 423 travado
```
`npm run teste` roda todos, um depois do outro. Com `--simulado` (e no cérebro de teste) a pasta do Jarvis, o perfil do
navegador, o gasto do construtor e a chave do atalho ficam numa pasta temporária (`--teste-pasta=<pasta>` escolhe qual);
a Lixeira e o "abrir no Windows" são de mentira e o construtor não chama a API. Nenhum teste escreve em
`OneDrive - Lube\JARVIS` (o `teste:faz` confere). O `teste:ouvido` usa o perfil `%LOCALAPPDATA%\CerebroLube\ouvido-chrome-teste`
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
| `servidor/ferramentas/pasta.js`, `planilha.js` | a pasta do Jarvis (as 10 ferramentas de arquivo, a Lixeira, abrir no Windows) e a planilha |
| `servidor/navegador.js`, `servidor/ferramentas/web.js` | o navegador escondido (regra de rede, política de endereço, extração, print) e as 4 ferramentas de site |
| `servidor/construtor.js`, `servidor/ferramentas/construir.js` | o construtor (Agent SDK, guarda, custo, teto) e as 4 ferramentas dele |
| `servidor/ferramentas/camera.js` | `camera` e `olhar_camera` |
| `servidor/ferramentas/acao.js` | `cancelar_acao` |
| `servidor/pessoal.js` | nota com dado de pessoa (`repositorio: nao` ou a lista `fora_do_repositorio.txt`): o construtor não lê, não vai para `Projetos` |
| `web/js/jarvis-acoes.js`, `web/css/jarvis-acoes.css` | os cartões novos, a janelinha do print, a câmera "Ver você", o canal da aba e as listas da aprovação por voz |
| `CRIAR ATALHO.bat`, `ferramentas/chamar-jarvis.ps1` | o atalho Ctrl+Alt+J |
| `servidor/teste/` | os testes e os servidores de mentira |
