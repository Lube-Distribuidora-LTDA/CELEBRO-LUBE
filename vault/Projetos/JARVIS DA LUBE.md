---
tipo: projeto
departamento: TI
status: ativo
inicio: 2026-10-15
tags: [projeto, cerebro, jarvis, voz, claude-api]
---
# JARVIS DA LUBE

O assistente de voz do [[Cérebro da Lube]]: o Júlio fala com ele, ele responde falando, como gente, e **para quando é
interrompido**. Mexe no cérebro, no [[GUARDIÃO DA LUBE]], nos bancos do DATA WAREHOUSE, na caixa `cpd@`, nos arquivos
e na internet. Nasceu do pedido do Júlio em 2026-10-15 ("quero poder me comunicar com ele e ele me responder como se
fosse uma pessoa, respeitando quando eu interromper"). Conversa: [[2026-10-15 — Jarvis da Lube, o assistente de voz do cérebro]].

## Como abrir
- **No computador (completo, com voz):** `Desktop\BI\13. CEREBRO\INICIAR.bat`. Liga o app local em
  `http://localhost:8790` (só este computador enxerga) e abre o Edge em janela de app. No painel do robô, botão
  **Jarvis** ou **Ctrl+J**; Esc ou "pode fechar" fecham. Na primeira vez o Edge pede o microfone.
- **No link do cérebro (só texto):** https://claude.ai/artifact/Tnrde74sov8LPGmgj8yjT4 (versão 8). O claude.ai não dá
  microfone à página, então se digita; a resposta pode sair falada. Pede consentimento para o Claude e para cada
  conector na primeira vez.

## O que ele faz
- **Transição:** ao abrir, o robô "mergulha", vira um ponto de luz e abre o **HUD** (núcleo com anéis girando, régua,
  onda da voz, legenda viva palavra por palavra, cartões na área de Exibição). Inspirado no formato do Jarvis dos
  filmes, com as **cores da Lube**; nada de logo, arte ou som da Marvel.
- **Estados:** repouso, ouvindo, pensando (mostra HAIKU ou SONNET), falando, interrompido, confirmando e sem conexão
  (tudo cinza e parado).
- **Interrupção:** falar enquanto ele fala corta a voz na hora; o histórico guarda só o que ele chegou a dizer, e o
  modelo é avisado. **Espaço** também interrompe. "Para" sozinho só para; "Jarvis" sozinho responde "Pois não?".
  Filtro de eco para ele não se interromper com a própria voz; com **fone de ouvido**, marcar "Estou de fone de
  ouvido" nos Ajustes (desliga o filtro).
- **Fala:** frase curta antes de usar uma ferramenta ("Um instante, vou conferir a saúde dos sistemas."), sem
  markdown, sem terminar com pergunta de sim ou não. Português do Brasil, calmo, educado, com humor seco.
- **Cartões na tela:** destaque, lista, tabela, barras, nota, e-mail e funil de rotina (`mostrar_na_tela`).

## Cérebro (modelos)
- **Claude Haiku 5.5** (`claude-haiku-5-5`, esforço baixo) conversa e usa as ferramentas: é rápido para a voz.
- Pedido pesado (análise, cruzar dados, "com calma"): ele chama a ferramenta `delegar` e o **Claude Sonnet 5.5**
  (`claude-sonnet-5-5`, esforço médio) faz. Escolha do Júlio em 2026-10-15 (Haiku 5.5 + Sonnet 5.5).
- No app local, pela chave `ANTHROPIC_API_KEY` do `ENV`, com cache de prompt (a partir do 2º turno sai mais barato).
  No link, pelo Claude do próprio claude.ai (capacidade `sample`), sem chave.
- Sem chave no `ENV`, ele liga com o **cérebro de teste** (frases prontas) e avisa isso ao abrir.

## Voz
- **Voz grátis do Edge** (escolha do Júlio): Microsoft **Antônio** Online (Natural), Francisca ou Thalita
  multilíngue, escolhidas nos Ajustes. São vozes on-line da Microsoft: o texto da resposta passa por elas.
- O reconhecimento de fala **não é mais o do Edge** (desde 2026-10-19): o Edge passou a devolver texto vazio. Quem
  ouve é um Chrome escondido, offline (ver Ouvido).
- **Não se clona voz de pessoa real**: a voz do Jarvis do filme é de um ator. Fica o jeito do personagem, com uma voz
  pronta.

## Ouvido (desde 2026-10-19)
- **"Edge fala, Chrome ouve"** (escolha do Júlio): o Jarvis segue no Edge com a voz Antônio; quem transcreve é um
  **Chrome sem janela** aberto pelo app, com o reconhecimento **offline** do Chrome (`processLocally`). A fala não sai
  do computador. Por quê: o Edge 155.0.4283.62 (atualizou em 2026-10-18) ouve, mas devolve resultado vazio
  ([[2026-10-19 — Jarvis surdo no Edge e o desbloqueio pelo rosto]]).
- O app controla o Chrome por **pipe** (`--remote-debugging-pipe`, sem porta aberta), com perfil próprio em
  `%LOCALAPPDATA%\CerebroLube\ouvido-chrome`. O Chrome só abre quando o microfone liga e fecha junto com o app.
- Na primeira vez, o Jarvis pede para **baixar o pacote de voz** (pt-BR + en-US, cerca de 300 MB, uma vez; ~650 MB
  no disco). Só pt-BR não basta: sem o en-US toda sessão termina em `aborted`.
- Consumo medido: 8,6% de um núcleo ouvindo silêncio, 42% ouvindo fala, 200 a 315 MB de memória.
- Nos Ajustes: **Ouvido: Chrome (offline) / Edge**. No Edge fica um vigia: depois de 3 resultados vazios, avisa.
- **Sem fone, um fala de cada vez** (desde 2026-10-20, pedido do Júlio: "o jarvis está escutando ele mesmo falar"):
  enquanto o Jarvis fala, e 0,45 s depois, o que o microfone ouve é descartado (o botão mostra **Mudo**). Para cortar a
  fala: o botão **Interromper** (era "Parar") ou segurar **Espaço**; quando ele termina, o microfone abre sozinho. O
  trecho do reconhecimento que começou com a voz dele no ar sai inteiro, para o eco atrasado não virar pergunta.
- **De fone** (Ajustes › "Estou de fone de ouvido"), o microfone fica aberto enquanto ele fala e a sua voz o
  interrompe. O cancelador de eco do Chrome não ouve a voz que sai pelo Edge, por isso sem fone o microfone fecha.

## Trava do rosto (desde 2026-10-19)
- **Primeira conversa do dia** (fuso de Brasília): o Jarvis abre a câmera num visor redondo no estilo do HUD
  (imagem espelhada, anéis, varredura, os 478 pontos do rosto), pede para **piscar** e, se for o Júlio, mostra
  "IDENTIDADE CONFIRMADA · JÚLIO", e o HUD nasce no centro com a saudação pela hora. Na primeira vez é o **cadastro**
  (8 amostras com o rosto um pouco virado).
- Bibliotecas no navegador: **face-api 1.7.15** (descritor de 128 números) + **MediaPipe FaceLandmarker 0.10.14**
  (pontos e piscar). A comparação é **no servidor** do app (distância euclidiana, limiar 0,45): enquanto não libera, o
  turno, o "confirmar" de uma ação e o ligar do ouvido respondem 423.
- 3 falhas travam o rosto por 10 min; o 2º bloqueio do dia vale até a meia-noite, e só o **Windows Hello** libera
  antes. Cadastrar de novo, cadastrar o Hello e apagar pedem confirmação recente.
- **Dado biométrico só neste computador**, em `%LOCALAPPDATA%\CerebroLube\rosto\` (fora do repositório, do vault e
  do OneDrive). Nenhum quadro da câmera é guardado; a câmera desliga ao terminar (e sozinha se não achar rosto em
  45 s, 60 s no cadastro).
- Nos Ajustes, **Trava do rosto**: Travar agora, Cadastrar o rosto de novo, Windows Hello e Apagar meu cadastro.
- **Limite, dito na tela e no README:** é uma trava do Jarvis neste computador, não substitui o login do Windows.
  Quem tem este computador destravado e uma foto ou vídeo do Júlio poderia passar. Proteção mais forte seria exigir o
  Windows Hello no "confirmar" do e-mail (não feito: o Júlio ainda não tem PIN do Hello).

## Ferramentas
| Ferramenta | App local | Link |
|---|---|---|
| Cérebro (buscar e ler notas) | sim | sim |
| Saúde dos sistemas ([[GUARDIÃO DA LUBE]]) | `saude.painel()` | `select saude.painel()` pelo conector Supabase |
| Consultar dados do DATA WAREHOUSE | só leitura, schemas `compras`, `comercial`, `reposicao`, `trade`, `core` e `saude`; 15 s e 200 linhas no máximo | não |
| E-mail `cpd@` (listar, ler, preparar envio) | sim, IMAP/SMTP da [[Locaweb]] | não (a conta do conector Microsoft 365 não tem caixa) |
| Arquivos | OneDrive Lube e `P:\` | OneDrive/SharePoint pelo conector Microsoft 365 (busca e leitura) |
| Pesquisa na internet | sim | não |

Travas:
- **Envio de e-mail só com confirmação na tela.** Ele prepara o rascunho, a tela mostra De, Para, Assunto, Texto e
  Observação, e só sai com o botão ou com "pode enviar" dito com ele calado (o eco da própria voz não confirma). Um
  rascunho por vez; vence em 5 minutos; destinatário fora de `@lube.com.br` aparece em vermelho.
- **SQL só de leitura** (transação READ ONLY), conferido no texto e no plano: nada de `financeiro`, `auth`, `vault`,
  `storage`, `cron`, `net` nem funções que executam SQL por dentro.
- **Arquivos:** nunca abre `ENV`, `.env`, `*.cred`, `*.key`, configuração e script (`ini`, `cfg`, `bat`, `ps1`, `py`,
  `js`, `sql`, `xml`…) nem pastas de folha e RH; o que parece senha no texto lido sai mascarado. No link, só abre o
  que apareceu numa busca da própria conversa.
- **App local:** escuta só em `127.0.0.1`, com um token novo a cada partida e conferência de Host e Origin.

## Onde fica
- Código: `Desktop\BI\13. CEREBRO` (no GitHub `CELEBRO-LUBE` até o commit `62b5520`; o resto espera o repositório
  ficar privado): `web/` (painel do robô + `jarvis.js`, `jarvis-hud.js`, `jarvis-link.js`, `fala.js`, `bloqueio.js`,
  `ouvido-remoto.js`, `rosto.js`, `css/rosto.css`, `ouvido.html`), `servidor/` (Node: `servidor.js`, `cerebro.js`,
  `conversa.js`, `prompts.js`, `ouvido.js`, `rosto.js`, `ferramentas/`), `docs/JARVIS.md` e `docs/OUVIDO-E-ROSTO.md`
  (especificação e pesquisa), `ENV.example`.
- `ENV` (credenciais) na raiz da pasta, ao lado do `INICIAR.bat`; o Git ignora. **Quem preenche é o Júlio**; só o
  programa lê.
- Arquivo único do painel (sem o Jarvis de voz): `dist\Cerebro da Lube.html`, gerado por
  `ferramentas\empacotar.py web "dist\Cerebro da Lube.html"`.
- Teste sem gastar: `.claude/launch.json` do vault tem a configuração `jarvis` (`servidor.js --simulado`, porta 8790);
  na página, `?jarvis=simular` simula o microfone.

## Como foi testado (2026-10-15)
- Servidor: 115 de 115 testes (com o banco real, só leitura), cérebro 37 de 37, e-mail contra servidores de mentira.
- Navegador do app com `--simulado`: transição, conversa com ferramenta, interrupção (a voz cortou em 8 ms), eco que
  não interrompe, "para", e-mail de mentira (nada enviado), fechar no meio da entrada, celular 375×812.
- Link: módulo testado com um `window.claude` de mentira; a busca real do SharePoint e a consulta real da saúde
  foram conferidas pelo Claude Code. **Ainda não testado no claude.ai de verdade nem com microfone.**

## Pendências
- [x] 2026-10-15 — `ENV` preenchido: `ANTHROPIC_API_KEY` e `SUPABASE_DB_*` pelo Júlio (12:41); `IMAP_*` e `SMTP_*` da `cpd@` copiados pelo Claude do `.env.local` do [[GESTÃO TI]], a pedido do Júlio, sem a senha passar pela conversa
- [ ] Primeira leitura real da `cpd@` a partir desta máquina (a LOGISTICA-55): o robô do Gestão TI lê da Vercel, então as portas 993 e 465 daqui ainda não foram provadas — Júlio
- [ ] Criar no Supabase um usuário só de leitura (`jarvis_leitura`) nos 6 schemas liberados e usar no `ENV`, no lugar do usuário das ETLs (sugestão do Claude; Júlio decide)
- [ ] Primeiro uso no Edge com microfone: escolher a voz Antônio, medir o tempo até a primeira palavra (meta 1,5 s), contar interrupções falsas com alto-falante (meta zero) — Júlio
- [ ] Primeiro e-mail de verdade: ler antes; o primeiro envio para a própria `cpd@` — Júlio
- [ ] Abrir o link no claude.ai e aceitar os consentimentos (Claude, Supabase, Microsoft 365); conferir se o HUD mostra HAIKU — Júlio
- [ ] Opcional: `ARQUIVOS_RAIZES` só com pastas de documentos (o `P:\` inteiro inclui as pastas do WinThor) — Júlio
- [x] 2026-10-16 — Repositório no GitHub (`CELEBRO-LUBE`); o código novo só sobe quando ele ficar privado ([[2026-10-16 — Backup do cérebro no GitHub]])
- [ ] Reabrir o app pelo `INICIAR.bat` (o servidor mudou), ligar o microfone e **baixar o pacote de voz** (cerca de 300 MB, uma vez) — Júlio
- [ ] **Cadastrar o rosto** (aparece sozinho na primeira abertura): sozinho na frente da câmera, com boa luz; depois, em dias diferentes, conferir no `?debug` a distância dele para ele mesmo (meta até 0,35) — Júlio
- [ ] **Criar o PIN do Windows Hello** (Configurações › Contas › Opções de entrada; hoje não existe) e cadastrar o Hello nos Ajustes do Jarvis. Sem ele não há reserva: 3 falhas travam o rosto por 10 min — Júlio
- [ ] Conferir no uso real: microfone com a voz dele, eco com alto-falante, tempo até a primeira palavra, piscar com óculos e pouca luz — Júlio
- [ ] Copiar face-api, MediaPipe, SimpleWebAuthn e os modelos para `web/vendor/` com hash conferido (hoje vêm do jsdelivr, sem SRI) — Claude, quando o Júlio quiser
- [ ] Opcional: apagar `%LOCALAPPDATA%\CerebroLube\ouvido-chrome-teste` (646 MB, perfil só dos testes) se precisar do espaço; os testes baixam de novo — Júlio

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-20** — **Sem fone, um fala de cada vez** (Júlio pediu: "quando ele estiver falando o microfone feche, e só abra quando eu clicar o botão de interromper"; Claude fez): no primeiro uso real o Jarvis se ouvia pelo alto-falante. Agora, sem fone, o que o microfone ouve enquanto ele fala (e 0,45 s depois) é descartado, inclusive o trecho que começou com a voz dele no ar; o botão Parar virou **Interromper**, o Espaço também abre, e o botão do microfone mostra **Mudo**. De fone, segue a interrupção por voz. Testado no navegador do app com o simulador (falar por cima, eco atrasado, fala emendada, Interromper, Espaço, de fone), sem erro no console. `ferramentas/jarvis-teste.cmd` + configuração `jarvis-teste` no `.claude/launch.json` do vault (porta 8791, cérebro simulado, trava aberta). Commit `2af99ea` (local) · [[2026-10-19 — Jarvis surdo no Edge e o desbloqueio pelo rosto]]
- **2026-10-19** — **Ouvido pelo Chrome escondido e trava do rosto** (Júlio pediu, Claude fez com um fluxo de 9 agentes: pesquisa, 4 construtores, integração, 2 revisões com 18 achados, correção). O Edge parou de transcrever (resultado vazio); um Chrome sem janela, por pipe, ouve offline. Na primeira conversa do dia o rosto é conferido no servidor (face-api + MediaPipe, limiar 0,45, piscar), com o Windows Hello de reserva; o turno, o confirmar e o ligar do ouvido dão 423 até liberar. CSP nova na página do app. Testes: geral 128/128, cérebro 37/37, rosto 168/168, ouvido 81/81, ouvido remoto 159/159, integração 49/49 (rodados de novo pelo Claude principal). Commits `599ee6b` e `efa3459` (local; nada subiu, o repositório segue público). O link do claude.ai continua na versão 8 (ouvido e rosto só existem no app local) · [[2026-10-19 — Jarvis surdo no Edge e o desbloqueio pelo rosto]]
- **2026-10-15** — **E-mail no `ENV`** (Júlio pediu "me passe esses valores", Claude fez): os 11 campos `IMAP_*` e `SMTP_*` vieram do `Desktop\BI\5. GESTÃO TI\.env.local` por um script que só preenche linhas vazias, confere que o resto do arquivo ficou igual e que o Jarvis lê o mesmo valor que a Vercel usa; as senhas não foram mostradas. Valores que não são segredo: `email-ssl.com.br`, IMAP 993, SMTP 465 com TLS, usuário `cpd@lube.com.br`, pasta `INBOX`, nome "TI - Lube Distribuidora". O Jarvis passa a ler: cérebro Claude, banco, leitura e envio de e-mail · [[2026-10-15 — Jarvis da Lube, o assistente de voz do cérebro]]
- **2026-10-15** — Link: o trecho da busca do SharePoint vinha com as marcas de destaque (`<c0>`, `<ddd/>`) e seria lido em voz alta; limpo (Claude, visto numa chamada real) — commit `8b96b9a` · [[2026-10-15 — Jarvis da Lube, o assistente de voz do cérebro]]
- **2026-10-15** — **Publicado na versão 8 do painel do cérebro** (artifact, runtime `0.2.80`): conectores Supabase (`execute_sql`) e Microsoft 365 (`sharepoint_search`, `sharepoint_folder_search`, `read_resource`) e o Claude do claude.ai (`sample`) (Claude) · [[2026-10-15 — Jarvis da Lube, o assistente de voz do cérebro]]
- **2026-10-15** — Correção final depois de 4 revisões (58 achados): eco não confirma e-mail, comandos curtos, SQL que executa SQL por dentro barrado, arquivos de configuração e script fora, fechar no meio da transição, legenda, layout do celular (Claude) — commit `462063f` · [[2026-10-15 — Jarvis da Lube, o assistente de voz do cérebro]]
- **2026-10-15** — **Jarvis criado** (Júlio pediu, Claude fez): app local em Node com Claude Haiku 5.5 e Sonnet 5.5, voz do Edge com interrupção, HUD com transição, ferramentas de cérebro, saúde, banco, e-mail, arquivos e internet, modo texto no link — commit `b5f9f76` · [[2026-10-15 — Jarvis da Lube, o assistente de voz do cérebro]]
- **2026-10-15** — Especificação e pesquisa (vozes do Edge, reconhecimento, interrupção, API do Claude) em `docs/JARVIS.md` — commit `c6de918` · [[2026-10-15 — Jarvis da Lube, o assistente de voz do cérebro]]

Veja também [[Cérebro da Lube]], [[GUARDIÃO DA LUBE]], [[Claude]], [[data-warehouse]].
