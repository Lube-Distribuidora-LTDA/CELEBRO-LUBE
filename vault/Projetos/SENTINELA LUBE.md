---
tipo: projeto
departamento: TI
status: ativo
inicio: 2026-10-05
tags: [projeto, seguranca, sentinela, vercel, supabase]
---
# SENTINELA LUBE

Sistema de segurança do ecossistema da Lube na [[Vercel]]: um **guarda** na porta de cada sistema (os 8 do
portal desde 2026-10-06 e, desde 2026-10-07, o [[SAC]], aberto de propósito: 9 no total) registra e bloqueia
acessos indevidos, uma **central** no [[Supabase]] (projeto PAINEL LUBE DISTRIBUIDORA,
`wkkdcsqwlxjxorutrbnx`, schema `sentinela`) aplica as regras e chama a IA (Claude Haiku), e um **painel** com
globo 3D mostra quem tenta entrar e de onde, com arcos até a Lube (Cariacica-ES). O login do
[[PAINEL LUBE DISTRIBUIDORA]] vira a porta de verdade dos sistemas ("exige login" por sistema).

Especificação completa: `docs/SENTINELA-ESPECIFICACAO.md` no repositório do Painel Lube.

## Como funciona (resumo)
- **Painel:** `painel-lube-distribuidora.vercel.app/sentinela/`, **só para administrador** (as funções
  `public.sentinela_*` do painel exigem `is_admin()`). No painel admin do portal há o link **"Sentinela"** no topo.
- **Passe e sessão:** ao abrir um sistema pelo cartão, o portal pede à central um **passe de uso único (90 s)**, só
  para quem tem permissão naquele sistema; o guarda troca o passe por uma **sessão de 8 h**. Sistema com
  `exige_login = true` em `sentinela.sistemas` só deixa entrar quem chegou pelo portal.
- **Níveis:** "certo" (ataque: varredura, ferramenta de ataque, injeção) barra sempre; "suspeito" (robô,
  não-navegador, buscador, arquivo proibido, rajada, Tor, força bruta, bloqueio da IA) só barra no **modo proteger**
  — no observar vira "seria bloqueado". Rede confiável ignora o suspeito. Sem login num sistema fechado: página →
  302 para o portal, API → 401. País nunca bloqueia sozinho.
- **Saúde de cada guarda:** `/.sentinela/saude` mostra se o token OIDC da Vercel chega (`oidc`), se a lista da
  central chegou (`lista.ok`) e o modo.
- **Banco:** schema `sentinela` com 16 tabelas (config, sistemas, eventos, cadeia, bloqueios, confiaveis, ips,
  identidades, tentativas_login, analises, tor_saidas, passes_usados, chaves, exposicoes, acoes_admin, cache_kpis),
  RLS ligado e sem políticas; só a central (service_role) chama as `sentinela_srv_*`. Eventos encadeados por SHA-256.
- **Mudou o núcleo?** Edite `guarda/sentinela-guarda.ts`, copie para a raiz do portal, rode
  `node guarda/teste/guarda.teste.mjs` e reinstale nos sistemas (instalação em `guarda/LEIA-ME.md`).

## Decisões do Júlio (2026-10-05)
- Guarda nos **8 sistemas, em modo observar**: registra tudo e só bloqueia ataque certo (varredura, ferramenta de ataque, injeção). _(Mudou em 2026-10-07: modo proteger.)_
- **País não bloqueia sozinho.** Quem acessa do jeito certo entra de qualquer lugar; o que pega é comportamento indevido.
- **IA ligada**, com chave da Anthropic cadastrada pelo Júlio como segredo da Edge Function.
- Porta dos sistemas fechados = **login do Painel Lube**. Construída, mas **desligada**. _(Ligada em 2026-10-06.)_
- **Folha (Gestão Financeiro), BI Comercial e RH ficam abertos por enquanto**, mesmo com o risco mostrado (ver [[Vercel]]). _(Mudou em 2026-10-06: todos fechados.)_

## Decisões técnicas do Claude
- 2026-10-05: central no Supabase do Painel Lube; o guarda se autentica pelo **token OIDC da Vercel**. Plano B
  (`SENTINELA_CHAVE`) só se o OIDC não chegasse — chegou, e o plano B foi dispensado em 2026-10-06.
- 2026-10-05: corrigir no cérebro as notas que diziam que folha e Comercial estavam protegidos.
- 2026-10-06: varredura ou injeção pedida **por outro site** (`sec-fetch-site: cross-site`) leva 403 e é gravada, mas
  **não bloqueia o IP** — senão um site malicioso faria o navegador de um funcionário "atacar" a Lube.
- 2026-10-06: cada sistema passa por **preview antes da produção**, e a porta só liga depois de todos os guardas no ar.
- 2026-10-06: criar o **modo fechado** antes de ligar a porta, para fechar a falha aberta na partida a frio.
- 2026-10-06: quando o deploy pelo Git dá `BLOCKED`, publicar **pela API da Vercel** (`create_deployment` com
  `gitSource` do mesmo commit).
- 2026-10-06: não cadastrar a rede do escritório como confiável por conta própria (é decisão de segurança do
  Júlio). Ela ficou confiável sozinha pelo login do cpd@ em 2026-10-07.
- 2026-10-07: conferir a chave da IA com `GET /v1/models` a cada 5 min, sem gastar crédito; queda da Anthropic
  (5xx) ou da rede não mexe no status.
- 2026-10-07: ligar o modo proteger **só com o IP do escritório já confiável**, para não barrar o escritório.
- 2026-10-07: quem tem login **nunca** cai nas regras robô, não-navegador e buscador; ataque certo, lista e arquivo
  proibido valem para todos. Exceções que só veem a tela de login ou o redirecionamento (prévia de link, agendador
  da Vercel, sondas do Office, navegadores simples) nunca dispensam o login.
- 2026-10-07: não publicar o guarda 1.1.0 se a revisão achasse pessoa real barrada.
- 2026-10-07: no [[SAC]] (`exige_login = false`) o guarda continua barrando ataque, robô e rajada — inclusive quem
  tentar descobrir e-mails de RCA em série pelo `/api/rca`.
- 2026-10-09: atualizar a linha de `sentinela.sistemas` logo depois de renomear o projeto na Vercel, porque a
  central acha o sistema pelo nome.

## Estado em 2026-10-05: construído e testado, NADA publicado ainda
Construído no repositório `Desktop\BI\1. PAINEL LUBE DISTRIBUIDORA` (sem commit):
- `db/02_sentinela.sql` + `db/02_sentinela_teste.sql`: **149 de 149 testes** passaram no banco real, dentro de transação revertida (nada ficou gravado).
- `supabase/functions/sentinela/`: a central (OIDC da Vercel, passe/sessão ES256 com chave no Vault, IA, Tor), com testes em Node. A IA é o Claude Haiku (`claude-haiku-4-5-20251001`), que responde sempre pela ferramenta forçada `veredito`.
- `guarda/`: `sentinela-guarda.ts`, `middleware.ts`, `LEIA-ME.md` e testes. Falha aberta (desde 2026-10-06 os sistemas fechados usam o **modo fechado**, abaixo).
- `sentinela/`: o painel com globo 3D (globe.gl 2.46.2 copiado para `vendor/`) e modo demonstração só em localhost (`?demo=1`).
- `portal.js`: passe ao abrir sistema, `?abrir=`, identidade após login, tentativa de login falha.
- `.vercelignore`: tira `db/`, `supabase/`, `guarda/`, `docs/`, `.claude/`, `README.md` e `sentinela/demo.js` do site publicado.
  Achado do levantamento: **até 2026-10-06 o site do portal servia para qualquer um o SQL do banco, o código das
  Edge Functions e a documentação**; com o `.vercelignore` esses endereços dão 404.

Cada peça passou por revisores adversários: 64 achados corrigidos. A integração final corrigiu 9 incompatibilidades entre as peças.

## Estado em 2026-10-06 (manhã) — histórico, superado à noite
- **Ajustes finais feitos** (só local): os 6 pontos que os revisores deixaram — o principal é que varredura pedida
  por outro site (`sec-fetch-site: cross-site`) não bloqueia o IP, senão um site malicioso faria o navegador de um
  funcionário "atacar" a Lube e o funcionário é que seria bloqueado. Especificação atualizada para v1.1 (§8 lista
  todos os desvios e decisões). Testes: banco **200/200** (PGlite local), central **73/73**, guarda **57/57**,
  ponta a ponta **14/14**. Os outros ajustes: `sentinela_srv_identidade` recusa perfil inativo sem gravar; a ação
  "sistema" do painel recusa rota pública vazia, `/`, `/*`, `*` ou que não comece com `/`; `srv_lista` devolve o
  `projeto_id`; `srv_permissao` devolve `guarda_ativo` e o passe só sai para sistema com guarda ativo; o usuário
  aparece mascarado igual no painel e no portal.
- **Visual conferido** no modo demonstração (`python -m http.server 4321` na pasta do portal, abrir
  `http://localhost:4321/sentinela/?demo=1`; no cérebro há `.claude/launch.json` "painel-lube" para isso).
- **Chave da IA cadastrada pelo Júlio** em Supabase › PAINEL LUBE DISTRIBUIDORA › Edge Functions › Secrets (2026-10-06).
- **Bloqueio de permissão:** o Júlio autorizou no chat os 3 passos de produção, mas o classificador do Claude Code
  (modo auto) recusou o `apply_migration` vindo de agente auxiliar (motivo "Production Deploy"). Nada foi aplicado:
  em 2026-10-06 o schema `sentinela` não existe e o portal segue com 8 perfis e 139 acessos. O Júlio decidiu
  **parar por hoje**. Para retomar: liberar nas permissões do Claude Code (só nesta pasta) `apply_migration`,
  `execute_sql` e `deploy_edge_function` do Supabase e o `git push` do branch `sentinela-v1`.
- Detalhe técnico para quem aplicar: `db/02_sentinela_teste.sql` aborta se o schema não foi criado na mesma
  transação — o jeito previsto é `begin; migração; testes; rollback;` antes do `apply_migration`. Conferir o
  arquivo aplicado pelo md5 (`md5(current_query())` entre marcadores), como os agentes fizeram.

## Decisões de 2026-10-06 (substituem as de 2026-10-05 sobre sistemas abertos)
- **Todos os sistemas só para quem tem acesso pelo Painel Lube** — e cada pessoa só nos sistemas liberados para
  ela. Quem não tiver é barrado pela Sentinela ("exige login" ligado nos 7 sistemas; o portal é a porta).
  Isso fecha também a folha, o Comercial, o RH e o COMPRAS, que estavam abertos por decisão anterior.
- **Gestão TI:** abrir chamado e acompanhar chamado continuam abertos para quem não tem conta no Painel
  (`rotas_publicas`); as rotas do robô (`/api/cron/`) também, porque são chamadas pela Vercel e já têm segredo próprio.
  _(Mudou em 2026-10-07: chamados também só com login; o robô passa pelo `CRON_SECRET`.)_
- **COMPRAS e ICMS:** ligar a proteção da Vercel (Standard) para fechar os endereços de deploys antigos, que ficariam sem guarda.
- O Júlio deixou o repositório **COMPRAS público** (2026-10-06), o que tira o risco de bloqueio do Hobby por repositório privado.

## Estado em 2026-10-06 (noite) — NO AR
- **Banco** aplicado no projeto do portal em três migrações: `sentinela_v1_1_tabelas` (17:29, schema e tabelas
  vazias), `sentinela_v1_2_ajudantes` (17:37, 29 funções ajudantes) e `sentinela_v1` (17:45, idêntica ao
  `db/02_sentinela.sql`: md5 28ba2c29… conferido em `schema_migrations`); testes no banco real **200/200**, revertidos.
  Versões no Supabase (UTC): `20261006202904`, `20261006203740` e `20261006204554`; a 4ª, `sentinela_v1_3_tor_where`,
  é `20261007140946` (ver "Lista Tor consertada").
  Privilégios: anon nada; authenticated só as 10 funções de painel. Valores iniciais de `sentinela.config`: modo
  observar, rajada 120/min, IA até 60 análises/h, confiança mínima 0,85, retenção de 90 dias, casa "Lube
  Distribuidora · Cariacica-ES".
- **Central** publicada: Edge Function `sentinela` v1 (verify_jwt=false, ~18:01), conferida por SHA-256 contra os
  arquivos; `/saude` 200 e `/lista` sem token 401. Chave ES256 de passe e sessão criada em `sentinela.chaves`
  (guardada no Vault). Em 2026-10-09 a função ativa é a **versão 4** (2026-10-07).
  - Versões da Edge Function: **v1** em 2026-10-06 ~18:01; **v2 não saiu de publicação do Claude**: já estava ativa
    na manhã de 2026-10-07, antes da v3, com a mesma data de atualização da v1 (provavelmente pelo painel do
    Supabase, na época em que o Júlio cadastrou a chave da IA; não confirmado); **v3** às 08:33 e **v4** às 10:02 de
    2026-10-07. A 1ª tentativa da v3 (recusada pelo `import_map_path`) não gerou versão.
- **Guarda em produção nos 8 sistemas** (runtime nodejs nos estáticos, edge no Gestão TI e ICMS). A assinatura OIDC
  da Vercel chega ao guarda — o plano B (SENTINELA_CHAVE) não foi necessário. A prova foi o preview do portal no
  branch `sentinela-v1` (`dpl_9ux4sJvZ3E3efmnewMU8YM4938LQ`, READY, commit `c7366de`).
- **Porta ligada** (`exige_login=true`) em painel-compras, gestao-comercial-web, gestao-finaceiro, rh-absentismo,
  gestao-de-saidas-de-veiculos, painel-icms e gestao-ti (rotas públicas: `/abrir-chamado`, `/acompanhar`,
  `/api/chamados/publico`, `/api/cron/`). Portal sem porta (é a tela de login).
- **Modo fechado** no guarda (constante `FECHADO` no middleware de cada sistema): sem a lista da central (partida a
  frio ou central fora) só passa quem tem sessão válida, conferida pela chave pública ES256 gravada no núcleo
  (kid `23295be7908c33a1`). Trocou a chave na central? Atualize `CHAVES_FIXAS` no núcleo e reinstale.
  Commit `4e9249d` (18:14); testes guarda **62/62**, middleware 5/5, edge 4/4.
- **Vercel Standard** ligada em painel-compras (`prj_DcJI82KyPyvSc4eUMuL9iJV6I7cp`) e painel-icms
  (`prj_5h9PoHWB6qCeoEhUNzQ4RVxnGrbn`): os deploys antigos sem guarda passaram de 200 para 401. Os aliases
  `-lube-distribuidora-ltda` e `-git-main` desses dois **não** são cobertos por ela e dependem só do guarda.
- **Verificação de fora** (2026-10-06 21:47–21:53 UTC): 14/14 `GET /` → 302 para o portal; 10/10 APIs → 401;
  arquivos de dados do RH e da Saída → 401; `/.env` → 403; deploys antigos → login da Vercel; portal e
  `/sentinela/` → 200; abrir chamado → 200.
- **IA:** ~~a central acusou `sem_chave`~~ → **ligada desde 2026-10-07** (chave cadastrada pelo Júlio em
  Edge Functions › Secrets do projeto PAINEL LUBE DISTRIBUIDORA). Primeiras análises reais às 08:24–08:29 (BRT):
  escritório (Cariacica), um acesso de Curitiba e o cron da Vercel — os três "legítimo", sem bloqueio.
  - **Correção de 2026-10-07 (central v3, commit 64e51a0):** o status da IA só mudava quando aparecia um IP para
    analisar, e o painel continuou mostrando "sem chave" mesmo com a chave já cadastrada. Agora a central confere a
    chave a cada 5 min por instância (puxada pela `/lista` dos guardas) com `GET /v1/models/claude-haiku-4-5-20251001`,
    que não gasta token: grava "ligada · chave conferida", ou "erro" com o motivo (401 chave recusada, 402 sem
    crédito, 403 sem permissão, 404 modelo indisponível), ou "sem chave". Anthropic fora (5xx) ou rede não mexe no status.
    Testes da central: 77/77 (4 novos).
  - Ao publicar a Edge Function pelo MCP, passe `import_map_path: "deno.json"` (sem isso o deploy é recusado).
- **Entrada real pelo portal (passe → sessão): funcionou em 2026-10-07.** O primeiro passe foi usado pelo cpd@ às
  08:24; em 2026-10-09 `sentinela.passes_usados` tinha cerca de 14 linhas (contagem aproximada da tabela). (Até 2026-10-07 esta nota dizia "não testado,
  `passes_usados` = 0".)

## 2026-10-07 — "só entra quem fez login; não pode passar nada" (decisão do Júlio)
Nas palavras dele: só os computadores de quem entrou pelo painel com login e senha podem ser liberados; "qualquer
tipo de ataque o sentinela precisa pegar". Veio depois de ver "LIBERADO" para acessos de fora do país.
- **Chamados do Gestão TI fechados:** abrir e acompanhar chamado agora também só com login do Painel Lube (com permissão
  para o Gestão TI). `rotas_publicas` do gestao-ti = vazio (ação 20). Links de acompanhamento por e-mail só abrem após o login.
- **Agendador da Vercel do Gestão TI:** só passa se trouxer `Authorization: Bearer <CRON_SECRET>` (conferido no
  middleware, em tempo constante). Sem isso, 401 do guarda. Prova: o cron de cobrança rodou às 09:27 e funcionou. O
  `?secret=` na URL deixou de passar; para rodar fora de hora, use o botão do painel do Gestão TI.
- **Modo proteger ligado** (ação 21, 2026-10-07 12:40 UTC): o nível suspeito barra com 403 em todos os 8 (robôs,
  rajada, Tor, força bruta, arquivos proibidos, bloqueios da IA). Primeiros efeitos: IA bloqueou por 24 h o
  RecordedFuture (varredor dos EUA) e o Bingbot. Ligado só depois de o IP do escritório estar confiável
  (`sentinela.confiaveis` id 10, aprendido no login do cpd@, vencia em 2026-10-14 sem novo login) — escolha do
  Claude, para não barrar o escritório. Os 8 guardas confirmaram o modo proteger em `/.sentinela/saude`.
- **Rótulos do painel:** "LIBERADO" (verde) só para quem entrou com login; "PÚBLICO" = anônimo que só viu a tela de
  login do portal; "ROBÔ" / "ROBÔ VERIFICADO" = agendador. O Júlio tinha lido "LIBERADO" para robôs que só viram a
  tela de login e entendeu que tinham entrado — o rótulo é que estava errado.
- O escritório (131.255.253.169) é confiável por login do cpd@ (renova a cada login, 7 dias): ignora o nível suspeito.
  Por isso testes de robô feitos do escritório não tomam 403.
- Fora do guarda por desenho: CSS, imagens, fontes e `/_next/static` (código do navegador, sem dado).
- A central grava no máximo 30 eventos por IP por minuto (o resto entra só no contador `descartados`; a rajada conta todos).

### Guarda 1.1.0 (2026-10-07, nos 8 sistemas)
Versão `sentinela-guarda/1.1.0`, o mesmo núcleo nos 8 (SHA-256 `7a3c7547…` em todos); commits e deploys na tabela
"Instalação nos sistemas", abaixo. Testes: guarda 74/74, edge 5/5, middleware 6/6.
- **Robôs de nome genérico** passam a ser pegos (nível suspeito → 403 no proteger): bibliotecas e navegadores
  automatizados, varredores conhecidos (Censys, Shodan, RecordedFuture, NoMoreVibe…), palavras de rastreador (bot,
  crawler, spider, scanner, monitor, fetch…), endereço no user-agent e "Mozilla" sem motor de navegador.
- **Não-navegador:** página pedida sem `sec-fetch-mode` E sem `accept-language` (navegador de verdade sempre manda).
- **Buscadores** (Google, Bing…) deixaram de ser exceção: barram no proteger (o `robots.txt` continua servido).
- **Quem tem login nunca cai nessas regras**; ataque certo vale para todos. Exceções (só veem tela de login ou o
  redirecionamento): prévia de link do WhatsApp/Telegram etc., agendador da Vercel, sondas do Office e navegadores
  simples (w3m, Lynx, leitor do Google).
- **Agendador da Vercel** só é exceção se o user-agent **começar** com `vercel-cron/<dígito>`. User-agent que também
  traz cliente HTTP, varredor ou buscador não é exceção (ex.: `python-requests vercel-cron/1.0` cai em robô).
- **Bloqueio suspeito do IP não barra quem tem login** (no CGNAT do 4G ou no Wi-Fi de filial um IP é muita gente): a
  pessoa logada passa e o evento sai "observado". Bloqueio **certo** barra todos.
- Revisão adversária: 4.346 requisições de pessoa real (95 navegadores × 23 situações) sem nenhum 403. Ela pegou e
  corrigiu um falso positivo grave antes de publicar: celular de marca terminada em "bot" (FOSSiBOT) dentro do Instagram.
- Central v4 (commit `7bdf3a7`, Edge Function versão 4): aceita o nome do robô ("robô do gestão ti (agendador da
  vercel)") como identidade, só vindo do app (`sessao_app`); pelo passe, só e-mail. Antes, a v3 apagava esse nome e
  o painel mostrava o agendador sem identidade.
- **Lista Tor consertada (2026-10-07):** nunca tinha carregado — o safeupdate da API do Supabase recusava `DELETE` sem
  `WHERE` (erro 21000). `sentinela_srv_tor_atualizar` passou a usar `delete … where true` (migração
  `sentinela_v1_3_tor_where` às 11:09, commit `856a068`). Carregou 1.277 saídas Tor às 11:10; em 2026-10-09 eram
  cerca de 1.232. Num teste, `load 'safeupdate'` no `execute_sql` foi recusado (42501); o teste foi refeito sem ele.

### 9º sistema: SAC, aberto de propósito (2026-10-07)
Cadastrado como `saq-lube` e renomeado para `sac-lube` em 2026-10-09 (o nome certo é SAC). A central acha o
sistema pelo **nome** do projeto que vem no token OIDC e confere o id: ao renomear um projeto na Vercel, a
linha de `sentinela.sistemas` tem que mudar junto (feito; ação `sistema_renomeado` em `acoes_admin`).
O [[SAC]] (`sac-lube`, `prj_HnjGoS8pFCFCIDD17iz3nvQ1LoB1`) entrou na central com **`exige_login = false`** e
`sistema_slug` nulo (não é um sistema do portal: não há permissão a conferir). É a exceção à regra de 2026-10-06,
por decisão do Júlio: os RCAs abrem chamado sem login, pelo atalho na tela de login do portal. O guarda continua
barrando ataque, robô e rajada. Arquivos proibidos: `package*.json`, `vercel.json`, `previas/`, `README.md`,
`servidor_local.js`. Cadastro direto no banco (a ação `sistema` do painel só altera sistema existente), registrado
em `acoes_admin` como `sistema_novo`. Datas: guarda 1.1.0 copiado para `Desktop\BI\10. SAC\web` em 2026-10-07 16:40;
INSERT às 17:43 e primeiro sinal do guarda às 17:46; renomeação (`sac-lube`, "SAC (RCA, sem login)",
`https://sac-lube.vercel.app`) em 2026-10-09 09:43.

### Pendências em aberto (as de segurança dependem de decisão do Júlio)
- **Login do portal direto no Supabase Auth:** a senha é conferida pelo navegador direto no Supabase, sem passar pela
  Sentinela; um robô pode testar senhas ali. Fechar: ligar **CAPTCHA** (Turnstile) no Supabase Auth + mudança no
  portal.js, e **"Prevent use of leaked passwords"** (Authentication › Attack Protection).
  Para o CAPTCHA, os conectores da Cloudflare precisam ser autorizados pelo Júlio (`/mcp` ou configurações de
  conector do claude.ai).
- Quem ainda não tem login e divide IP (4G/CGNAT) com um robô bloqueado pode levar 403 por até 1 h.
- Bancos do RH, ICMS e Saída de Veículos aceitam acesso direto com a chave pública (conserto à parte; o guarda não
  cobre o banco).
- Deploy pelo Git BLOCKED nos repositórios privados (Hobby): Comercial, Financeiro, RH, Saída de Veículos e ICMS.
  O Gestão TI voltou a público em 2026-10-08 (ver [[Vercel]]). Decisão do Júlio: voltar a público, assinar o Pro ou
  publicar sempre pela API.
- Em COMPRAS e ICMS, os aliases `-lube-distribuidora-ltda` e `-git-main` dependem só do guarda.
- O [[REPOSIÇÕES E CHAMADOS]] (publicado em 2026-10-06) **ainda não tem o guarda**: cadastrar na central e instalar,
  com um caminho liberado para o aquecedor ([[Reposições - Aquecer painel]]).
- Júlio: criar conta no Painel Lube (e liberar os sistemas) para quem usava algum BI só pelo link.
- README do COMPRAS: seção "Acesso" quando o Júlio commitar as alterações dele no README.
- Conferir se o agendador do Gestão TI aparece como "ROBÔ VERIFICADO" e não é barrado (o cron de 2026-10-08 08:00
  ainda não foi conferido).
- Pontos técnicos ainda abertos no §8.7 da especificação: confirmar que o Supabase sobrescreve um `cf-connecting-ip`
  forjado (invariante 2); um token OIDC verdadeiro de outro projeto da Lube recebe a lista daquele projeto;
  `/.sentinela/saude` é público e mostra o modo e a idade da lista; o mapa local do guarda em IPv6 é por IP (o banco
  já usa /64); os achados 21 a 23 da revisão do banco chegaram truncados e ninguém os viu. Atenção: o 1º item do
  §8.7 ("Nada aplicado… não houve commit") e o "testes só locais" ficaram velhos em 2026-10-06.

### Lições da instalação
- **Nunca testar caminho de ataque (`/.env`) a partir do escritório.** Os testes das instalações criaram 4 bloqueios
  "certo" (#5131–#5134, até 7 dias por reincidência) no IP do escritório (131.255.253.169, Conectja) e por alguns
  minutos o escritório levou 403 em vários sistemas. Todos revogados; o guarda do portal foi reimplantado para
  limpar a memória local. Para testar, use o cabeçalho `Sec-Fetch-Site: cross-site` (barra sem bloquear o IP). O
  primeiro login pelo portal torna o IP confiável por 7 dias automaticamente.
- Mudança de "exige login" leva até ~1 h para valer numa instância parada (ela usa a lista em cache na 1ª requisição
  e renova em segundo plano). Melhoria possível: no modo fechado, lista velha não abre o sistema.
- Primeira leitura de `/.sentinela/saude` logo após o deploy dá `lista.ok=false` (cache vazio); a segunda dá ok.
- COMPRAS: o deploy travado desde 2026-10-05 era a chave `_comentario_crons` no `web/vercel.json`. Saíram a chave e o
  bloco `crons` (o aquecimento de `/api/dados` seria barrado pela porta de qualquer jeito). Subiram juntos os 2
  commits do Júlio presos desde então. A seção "Acesso" do README do COMPRAS ficou para depois: o README tem
  alterações do Júlio sem commit.
- Gestão TI: o deploy da Sentinela levou junto 6 commits do Júlio de 2026-10-06 que estavam presos pelo BLOCKED; as
  2 migrações deles já estavam aplicadas no banco do Gestão TI.
- Preview do Gestão TI deu "Configuração ausente": o branch `sentinela` não tem as variáveis de produção. Só no preview.
- Build local do ICMS para no prerender por falta das variáveis do Supabase na máquina; publicar pela Vercel.
- Logo depois de ligar o "exige login", Compras, RH, Saída e ICMS ainda deram 200 até 21:40 UTC (lista em cache).
- O teto de 30 eventos por IP por minuto deixa parte de uma bateria de testes sem evento no banco: não é falha.
- `db/02_sentinela.sql` é grande (~28 mil tokens): ler por partes.
- Nos commits da Sentinela ficaram de fora os arquivos sujos ou não rastreados do Júlio (ex.: `etl/conferir_margem.py`
  do Comercial e o README do COMPRAS).
- Bloqueio do escritório se desfaz sem apagar nada: `revogado_em`/`revogado_por` no bloqueio (foi assim com #5131–#5134).

## Estado em 2026-10-06 (tarde) — histórico, superado à noite
- Aplicada no banco do portal só a **parte 1** da migração (`sentinela_v1_1_tabelas`: schema e tabelas vazias,
  RLS ligado, schema sem acesso para anon/authenticated). Inofensivo: nenhuma função, nenhum dado.
- A parte 2 foi recusada pelo controle do Claude Code (modo automático), que também não permite que o Claude
  altere as próprias permissões. Para seguir, o Júlio precisa trocar o modo de permissão da conversa para o
  que pede aprovação a cada ação, ou colar as regras de permissão em `.claude/settings.local.json`.

## Próximos passos (nesta ordem)
1. [x] Revisar os itens não corrigidos do workflow (fechados em 2026-10-06; o que segue em aberto está no §8.7 da especificação, resumido em "Pendências em aberto").
2. [x] Liberar as permissões (ver acima) e aplicar `db/02_sentinela.sql` (apply_migration "sentinela_v1") + rodar o teste. (2026-10-06: o Júlio trocou o modo de permissão; 200/200.)
3. [x] Publicar a Edge Function `sentinela` (verify_jwt=false) e testar `/saude`, `/lista` sem token (401) e CORS. (2026-10-06)
4. [x] Júlio: cadastrar `ANTHROPIC_API_KEY` (feito em 2026-10-06).
5. [x] (2026-10-06: o token OIDC chega ao middleware nodejs; plano B dispensado.) Portal num branch de preview `sentinela-v1`: confirmar que o `middleware.ts` é detectado sem package.json, que `x-middleware-next` segue, e **se o token OIDC chega ao middleware**. Se não chegar, plano B: `SENTINELA_CHAVE` (Júlio cadastra, mínimo 32 caracteres).
6. [x] (2026-10-06, ver "Instalação nos sistemas".) Publicar o portal e instalar o guarda nos outros 7, conferindo cada endereço no ar (`/.sentinela/saude`):
   COMPRAS (`web/`; o deploy está **travado desde 2026-10-05 09:33** pela chave `_comentario_crons` do `web/vercel.json`, e os crons de 5x/dia podem não passar no Hobby), Comercial e Financeiro (`web/`), RH (raiz = `assets/`, vercel.json com `routes` legado: testar), Veículos (raiz), Gestão TI e ICMS (Next.js: dentro do `src/middleware.ts`; o ICMS não tem clone local, só no GitHub).
7. [x] Registrar a conversa e atualizar [[Mapa de sistemas]] e [[Supabase]]. (2026-10-06)

## Exposições achadas no levantamento (2026-10-05)
Estão na tabela `sentinela.exposicoes` (seed) e na especificação §6. As mais graves: folha aberta em
`gestao-finaceiro.vercel.app/api/dados` (aceita pelo Júlio por enquanto), banco do RH com leitura/gravação
anônima, ICMS com login desligado "temporariamente" e políticas TEMP, Veículos com inserção anônima,
`/api/agente` do COMPRAS aberto (gasta a chave da Anthropic).

**Situação em 2026-10-09:** o que era endereço aberto (folha, `/api/dados` e `/api/agente` do COMPRAS, Comercial,
RH, Saída, ICMS) foi **fechado pela porta em 2026-10-06** (API 401 sem login). Continua aberto o que fica **no banco**
de cada sistema: RH, ICMS e Saída de Veículos aceitam acesso direto com a chave pública.

## Instalação nos sistemas (commits e deploys)
Guarda 1.0 com modo fechado em 2026-10-06 e 1.1.0 em 2026-10-07; sempre preview e depois produção. Runtime nodejs
nos sites estáticos; edge no Gestão TI e no ICMS (Next.js, dentro do `src/middleware.ts`). Onde o Git deu
`BLOCKED`, o deploy foi criado pela API com o mesmo commit. Nos outros 7, o trabalho de 2026-10-06 foi num branch
`sentinela`, e o deploy de produção daquele dia é o do último commit do branch (guarda + README "Acesso").

| Sistema (projeto Vercel) | Guarda 1.0 — 2026-10-06 | README "Acesso" | Guarda 1.1.0 — 2026-10-07 |
|---|---|---|---|
| Portal (`painel-lube-distribuidora`) | `c7366de` + `4e9249d` (branch `sentinela-v1`, fast-forward na `main`; `dpl_J6yW6VHoje2KuBpM6SExTiuT4s7Q`) | `cb2a988` (`dpl_6tSupKrYBKQJtqJb4EDhff5YxukN`) | `9b21b19` (`dpl_85yfkQC3pMPFbU2A5JReth8Gp7YD`) |
| [[BI COMPRAS]] (`painel-compras`) | `9d4e645` (`dpl_FUdhsEQWJpKHMuNwSnSQZ13tFGBv`) | pendente | `a197e96` (`dpl_7geDaU48Jppq1oXYph4wHmVkbBQ6`) |
| [[BI COMERCIAL]] (`gestao-comercial-web`) | `0988f8d` (`dpl_FWczt4epEM8fCbCEZJVQfTf3PMw7`) | `cae4dc9`, `c98fa62` | `34c5c42` (`dpl_AXiPQmp9R1Tph7bk1Um3Ae4YVbpZ`) |
| [[SISTEMA FINANCEIRO]] (`gestao-finaceiro`) | `89fb3d3` (`dpl_GoPpHFagp8BzDjpE6F1kPFb7uYGs`) | `d419ca4`, `f7c877a` | `0f4c9ac` (`dpl_J2yZBxfUCj7rqq78HTDkMJD3ihc3`) |
| [[BI ABSENTEÍSMO RH]] (`rh-absentismo`) | `87d9b7e` + `09d00f5` (runtime nodejs explícito) (`dpl_H7VSX8zEqVJCMyqnxeDYnxtt9Pff`) | `9bd4a05`, `a45b0b4` | `d50de78` (`dpl_N5xCRBkx1JAPpgpgqGUf5g58p7w7`) |
| [[GESTÃO DE SAÍDA DE VEÍCULOS\|Saída de Veículos]] (`gestao-de-saidas-de-veiculos`) | `b560968` (`dpl_5uYUgfkLQ8Xm2PBtmDUE1dDRkY9E`) | `7811755` | `b9ac2a0` (`dpl_9XGTGuv73ujWdu7c9pNa72HPRKU7`) |
| [[GESTÃO TI]] (`gestao-ti`) | `be1c78e` (`dpl_APuoE2K1MCwCpcShTdCoRjs64hWP`) | `0ceac00`, `f7868da` | `418840c` (`dpl_2TYZxFtucxFp6YEnXyfzGwT8V9K1`) |
| [[PAINEL ICMS]] (`painel-icms`) | `9e66866` (`dpl_2khibvK3VgvspUac3do26zjWPugK`) | `55ad6d5`, `3e9eacf` | `fc0ad34` (`dpl_oJwG8hhFsSqtjrtTWJUJYrFqiYdH`) |
| [[SAC]] (`sac-lube`) | — | README do SAC | nasceu com o 1.1.0 (`eaefe21`, 2026-10-07) |

Os READMEs "exige login ligado" de 2026-10-06 18:42 (`c98fa62`, `f7c877a`, `a45b0b4`, `7811755`, `f7868da`,
`3e9eacf`) ficaram com deploy `BLOCKED`, mas a produção já tinha o guarda. No portal, depois: redeploy
`dpl_4gQB67GFFRDZa3atsrptftaNYh54` (limpar o bloqueio do escritório), rótulos `50e748c`
(`dpl_FfD9MMT7gk3YFrPMYBbDLQXRHwG7`) e central v4 `7bdf3a7` (`dpl_F6dWWbgUyxJb7YAESatk712onVFf`).

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-14** — **10º sistema com guarda: [[GESTÃO COMERCIAL TRADE]]** (`gestao-comercial-trade`, `prj_PpgCB4Ez2d8ZK1ICjxOL8wjlueXT`), `exige_login = true`, guarda 1.1.0 no `web/` do repositório `GEST-O-COMERCIAL` (público). Registrado por SQL **antes** do primeiro deploy (migração `registrar_gestao_comercial_trade`: `sentinela.sistemas` + `public.sistemas` com o cartão inativo). Provado de fora: `/` vai para o portal, `/dados/dims.json` responde `login_necessario`, `/.sentinela/saude` com `oidc: true`, lista ok, modo proteger; o 1º acesso do navegador do app foi classificado `robo` (incidente aberto), sem bloqueio de IP (conferido em `sentinela.bloqueios`). Regra seguida: **sistema novo só vai ao ar depois do registro**: pela especificação (§ `sem_login` só vale se `lista.sistema.exige_login`) e pelo comentário do `middleware.ts`, com a lista da central no ar e o projeto desconhecido o guarda deixaria abrir (o `FECHADO` só vale quando a lista não vem); não foi testado, por isso a ordem · [[2026-10-14 — Gestão Comercial recriada do BI final do Power BI]]
- **2026-10-09** — SAC renomeado na central (`saq-lube` → `sac-lube`, ação `sistema_renomeado`) junto com o projeto na Vercel; atalho do portal passa a se chamar SAC (commit `913476c`) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — SAC entra como 9º sistema, `exige_login = false` (INSERT em `sentinela.sistemas` + `sistema_novo`; guarda 1.1.0 no repositório do SAC, `eaefe21`) e ganha atalho na tela de login do portal (commit `7529c25`) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — Lista Tor volta a carregar: `delete … where true` (migração `sentinela_v1_3_tor_where`, commit `856a068`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-07** — Guarda 1.1.0 nos 8 sistemas: robôs, não-navegadores e buscadores barrados no proteger; quem tem login nunca cai nessas regras (commits `9b21b19`, `a197e96`, `34c5c42`, `0f4c9ac`, `d50de78`, `b9ac2a0`, `418840c`, `fc0ad34`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-07** — Central v4: nome de robô aceito como identidade só com `sessao_app` (commit `7bdf3a7`, Edge Function versão 4) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-07** — **Modo proteger** ligado (ação 21, 12:40 UTC), com o escritório já confiável — decisão do Júlio "não pode passar nada" · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-07** — Gestão TI fechado de vez: chamados só com login (`rotas_publicas` vazio, ação 20) e agendador só com `CRON_SECRET` (commit `1dcbea0` no Gestão TI) — decisão do Júlio · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-07** — Rótulos do painel dizem a verdade: LIBERADO só com login, PÚBLICO, ROBÔ, ROBÔ VERIFICADO (commit `50e748c`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-07** — Central v3: confere a chave da IA a cada 5 min; IA "ligada · chave conferida" às 08:34 (commit `64e51a0`, Edge Function versão 3) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-07** — Primeiro passe real usado (cpd@, 08:24); o IP do escritório ficou confiável pelo login · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06/07** — Edge Function `sentinela` passa à versão 2 sem publicação do Claude (mesma data de atualização da v1; origem não confirmada) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — **Porta ligada**: `exige_login = true` nos 7 sistemas (21:38 UTC, ação 19); proteção da Vercel em COMPRAS e ICMS; README "Acesso" em 6 repositórios; bloqueios #5131–#5134 do escritório revogados; verificado de fora que nenhum anônimo entra · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Guarda com **modo fechado** em produção nos 8 sistemas (portal `c7366de`, `4e9249d`, `cb2a988`; demais na tabela acima) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Preview do portal no branch `sentinela-v1` (`c7366de`, `dpl_9ux4sJvZ3E3efmnewMU8YM4938LQ`) prova que o token OIDC chega ao guarda; plano B `SENTINELA_CHAVE` dispensado · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Central publicada (Edge Function `sentinela` v1, verify_jwt=false) e chave ES256 de passe e sessão criada (kid `23295be7908c33a1`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Banco aplicado no projeto do portal: migrações `sentinela_v1_1_tabelas`, `sentinela_v1_2_ajudantes` e `sentinela_v1` (testes 200/200, revertidos) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Decisão do Júlio: **todos os sistemas só para quem tem acesso pelo Painel Lube** (substitui a de 2026-10-05) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Ajustes locais (cross-site não bloqueia IP, perfil inativo, rotas inválidas, `projeto_id`, `guarda_ativo`) e especificação v1.1; testes 200/73/57/14; o classificador do Claude Code barrou a produção e o dia parou · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-05** — Desenho e construção das 5 peças (banco, central, guarda, painel 3D, portal), sem commit; 149/149 testes no banco real (revertidos); 64 achados de revisão corrigidos · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-05** — Levantamento dos 8 projetos da Vercel (11 agentes): 13 exposições achadas; notas do cérebro que diziam que folha e Comercial estavam protegidos foram corrigidas · [[2026-10-05 — Sentinela Lube, sistema de segurança]]

Veja também [[Vercel]], [[Supabase]], [[PAINEL LUBE DISTRIBUIDORA]], [[Como trabalhar comigo]].
