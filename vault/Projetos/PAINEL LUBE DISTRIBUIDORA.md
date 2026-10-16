---
tipo: projeto
departamento: TI
status: ativo
inicio: 2026-09-14
tags: [projeto, portal, acesso, supabase, vercel, sentinela]
---
# PAINEL LUBE DISTRIBUIDORA

Portal que centraliza o acesso aos sistemas internos da Lube: login restrito a e-mails `@lube.com.br`, cada pessoa só abre os sistemas liberados para ela, e um painel administrativo cuida de usuários, sistemas e permissões. Não faz parte do fluxo de BI do [[Mapa de sistemas]] — é um projeto à parte, de controle de acesso.

- Repositório: [Lube-Distribuidora-LTDA/PAINEL-LUBE-DISTRIBUIDORA](https://github.com/Lube-Distribuidora-LTDA/PAINEL-LUBE-DISTRIBUIDORA), branch `main`
- Pasta local: `Desktop\BI\1. PAINEL LUBE DISTRIBUIDORA`
- Git: `user.name` "Lube Distribuidora" e `user.email` `cpd@lube.com.br` configurados **só nesta pasta** (2026-09-14) —
  por isso os commits saem como "Lube Distribuidora". Em 2026-10-09 a pasta estava limpa (nada sem commit).
- Site estático (HTML/CSS/JS puro, sem build) + [[Supabase]] para autenticação e banco
- **No ar na [[Vercel]] desde 2026-09-14** — o Júlio conectou o repositório no mesmo dia. Projeto
  `painel-lube-distribuidora` (`prj_WGmlGvONBuausosdw6AgnDhrCnge`), endereço
  **https://painel-lube-distribuidora.vercel.app**, deploy automático a cada push na `main`. Framework **Other**,
  sem build, Output Directory `.`, **nenhuma variável de ambiente**. (Até 2026-10-09 esta nota dizia "ainda não
  conectado" — estava errado.)
- **O repositório tem que ficar público.** No plano Hobby, repositório privado deixa o deploy `BLOCKED` — aconteceu
  em 2026-09-30 e de novo em 2026-10-06. Ver [[Vercel]].
- **Vercel Authentication ligada no modo Standard:** pede login da Vercel só nas URLs de deploy e nos aliases
  `-lube-distribuidora-ltda`. O **endereço principal abre para todos** (é a tela de login): mande sempre ele.
- Produção em 2026-10-09: commit `913476c` (deploy `dpl_3bo2uYnT2pjF1h5agkvYdwnBv8dA`, READY).
- Desde 2026-10-06 o portal é a **porta de todos os sistemas** (decisão do Júlio), pela [[SENTINELA LUBE]].

## Como funciona
- **Login:** usuário sem `@` + senha; o portal completa `@lube.com.br` sozinho (o sufixo cinza some quando a pessoa digita o e-mail completo). A restrição de domínio roda num gatilho do banco (`handle_new_user`), não no JavaScript — não dá para burlar pelo navegador. Desde 2026-10-06 o navegador só confere o formato do e-mail.
- **E-mail de fora do domínio (desde 2026-10-06):** só quem está na tabela `emails_externos` — hoje **uma pessoa**, a consultora Melissa (Mancebo Consulting), a pedido do Júlio. Ela digita o e-mail completo. A conta é criada **pelo painel admin**, nunca pelo Primeiro acesso. Liberar mais alguém = `insert` em `public.emails_externos` no SQL Editor (modelo no README). Ver [[2026-10-06 — Acesso da consultora externa ao Painel Lube]].
- **Primeiro acesso:** o colaborador cria a própria senha, mas a conta nasce **pendente**. O TI aprova pelo painel admin e escolhe os sistemas na hora. A tela de acesso tem as abas **Entrar / Primeiro acesso** (nome, e-mail, senha com confirmação e o olho para mostrar a senha). No admin, o pedido aparece no topo com a etiqueta **Aguardando** e o botão **Liberar**; no login, "aguardando liberação" e "desativado" têm mensagens diferentes.
- **Portal:** mostra todos os sistemas cadastrados. Os liberados abrem normal; os demais aparecem cinza, com cadeado e o aviso "sem autorização — peça ao TI".
- **Acesso total:** opção de perfil que libera automaticamente todo sistema, inclusive os cadastrados no futuro — sem precisar voltar e marcar um a um. Pode ter exceções: marcando "Todos os sistemas" no admin, aparece "Liberar tudo, exceto:" para tirar sistemas pontuais (tabela `permissoes_excecao`, 2026-09-30).
- **Painel admin** (`admin.html`, azul escuro + vermelho): usuários (criar, aprovar, editar, promover a admin, ativar/desativar, trocar senha, remover), sistemas (cadastrar, editar, ordenar, ativar/desativar, excluir, escolher ícone), acessos (últimos 200 registros de login e abertura). Quem não é admin e abre `admin.html` volta para o portal. Desde 2026-10-06 o topo tem o link **Sentinela**, que leva ao painel `/sentinela/` (só admin).
- **Ícones:** catálogo reutilizável (tabela `icones`) — desenhado no padrão Lube com prévia ao vivo (linha de cima, principal, segunda linha, rodapé), ou imagem enviada (PNG/JPG/SVG/WEBP até 2 MB, bucket `icones` do Storage). O desenho fica em `icones.js`, usado pelo portal e pelo admin.
- **Números do hero:** "Sistemas ativos" e "Áreas atendidas" são calculados na hora pelo `portal.js` (desde 2026-09-30; antes era "03" fixo no HTML; no `index.html` ficam em `data-stat-sistemas` e `data-stat-areas`). Contam a **empresa toda**, não o que a pessoa logada pode abrir.
- **Abrir um sistema (desde 2026-10-06, com a [[SENTINELA LUBE]]):** o cartão pede à central um **passe de uso único de 90 s** e abre o sistema com `?sentinela_passe=`; o guarda do sistema troca o passe por uma sessão de 8 h. Quem chega a um sistema fechado sem login é mandado para `/?abrir=<slug>` e, depois do login, segue direto para o sistema (no máximo uma ida automática por sistema a cada 30 s). Se a troca falhar, aparece "Não foi possível entrar...". O portal também registra a identidade após o login e avisa a central de tentativa de login falha (usuário mascarado). **Primeiro passe real: 2026-10-07 08:24 (cpd@).**
- **O portal tem guarda, mas sem porta:** `middleware.ts` + `sentinela-guarda.ts` na raiz, com `FECHADO = null` e `exige_login = false` — ele é a tela de login, então o guarda só registra e barra ataque.
- **Arquivos internos fora do site** (`.vercelignore`, no ar em 2026-10-06): `db/`, `supabase/`, `guarda/`, `docs/`, `.claude/`, `README.md` e `sentinela/demo.js` dão 404. Antes disso a produção servia o SQL do banco e o código da Edge Function.
- **Rodapé:** o botão "Falar com o TI" abre o WhatsApp do Júlio e do Alexandre com mensagem pronta (o painel fecha clicando fora, com Esc ou clicando de novo); o e-mail `cpd@lube.com.br` fica na coluna Suporte TI. Os números estão no README do repositório.
- **Visual:** cortina de entrada com a logo, hero com zoom na rolagem, caminhão da Lube na transição ("EM MOVIMENTO / desde 1959" → "NOSSOS / sistemas"), busca com feixes azul e vermelho na borda (ignora acento e maiúscula, aceita várias palavras, procura em título, área, descrição e palavras-chave; sem resultado, sugere RH / fiscal / frota), carrossel de cartões (setas, arraste, toque), manifesto "Mais de seis décadas..." com linha que cresce e rodapé em tipografia pesada. A navbar troca de cor pela seção que está atrás dela. `prefers-reduced-motion` desliga as animações. A logo (`assets/logo-lube.png`) é cópia de `Desktop\LOGOS\logo maior.png`.
- **Cache:** `.js` e `.css` carregam com `?v=AAAAMMDD`; troque a data em `index.html` e `admin.html` a cada mudança. Hoje: `20261006` (e `portal.js?v=20261005s2`). Antes: `20260915` → `20260930` → `20260930b` → `20261006`.

## Contas do SAC e a aba "SAC · externos" (2026-10-09)
O [[SAC]] ganhou login próprio **nesta base de login**, mas as contas são do SAC: `public.sac_usuarios`, sem
`profiles`, então nunca abrem o painel (se tentarem, `portal.js` sai da sessão e aponta o atalho do SAC). O gatilho
`handle_new_user` desvia quem chega com `sistema = 'sac'`; a regra do domínio continua igual para o resto.
Migração `sac_acesso_v1` (`db/03_sac_acesso.sql`). No admin, nova aba **"SAC · externos"**: contas (Liberar,
Recusar, Bloquear, Senha, Remover) e acessos do SAC; cadastro novo aparece com selo na aba, faixa no topo e "(n)"
no título, conferido a cada minuto. "Acessos" virou "Acessos do painel". Commits `9ab901c` e `10f8ead`.

## Atalho do SAC na tela de login (2026-10-07)
Pedido do Júlio: os RCAs abrem chamado ao SAC **sem login no portal**. Abaixo do botão Entrar, depois de
"ou, sem login", há o cartão **"SAC · Abrir chamado"**, que leva a `https://sac-lube.vercel.app/` —
um sistema à parte ([[SAC]]). O portal só leva até lá, não passa sessão. Num celular de 812 px o cartão
aparece sem rolar. **No ar desde 2026-10-09** (commit `7529c25`, enviado só depois de o SAC funcionar com as
senhas, para o botão não abrir um sistema pela metade).

Até 09:46 de 2026-10-09 o cartão se chamava "SAQ · Abrir chamado ao SAC" e apontava para `saq-lube.vercel.app`;
o commit `913476c` trocou o nome, o endereço e as classes (`gate__saq` → `gate__sac`). Mudou o endereço do SAC?
Troque o `href` da `.gate__sac` no `index.html`. O SAC **não** é cartão do portal: na Sentinela ele tem `sistema_slug` nulo (não há permissão a conferir).

## Banco
Projeto Supabase dedicado **PAINEL LUBE DISTRIBUIDORA** (`wkkdcsqwlxjxorutrbnx`, sa-east-1, US$10/mês, aprovado pelo Júlio em 2026-09-14) — separado do banco de cada sistema e do DATA WAREHOUSE. Foi criado com o nome `painel-lube-acesso`, que ainda aparece no README e em notas antigas: é o mesmo projeto. Ver a lista completa em [[Supabase]]. O schema `sentinela` e a Edge Function `sentinela`, no mesmo projeto, são da [[SENTINELA LUBE]].

Por que dedicado: o gatilho "só @lube.com.br" vale para o projeto inteiro e bloquearia os usuários de um projeto que já estava em uso.

| Tabela (`public`) | Para que serve | Linhas em 2026-10-09 |
|---|---|---|
| `profiles` | usuário: nome, cargo, `is_admin`, `ativo`, `acesso_total`, `aprovado_em`, `aprovado_por` | 10 |
| `sistemas` | catálogo dos cartões (slug, nome, categoria, url, ícone, ordem, ativo) | 8 |
| `permissoes` | quem abre qual sistema | 5 |
| `permissoes_excecao` | sistemas tirados de quem tem `acesso_total` (ignorada para os demais) | 2 |
| `emails_externos` | e-mails fora do domínio liberados um a um (só admin lê e altera) | 1 |
| `acessos` | log de login e de abertura de sistema | 169 |
| `icones` | ícones predefinidos (desenhados ou imagem no bucket `icones`) | 10 |

- **Regra de acesso a um sistema:** perfil ativo **e** (`acesso_total` sem linha em `permissoes_excecao`, **ou** linha em `permissoes`).
- **Funções:** `handle_new_user` (gatilho em `auth.users`: recusa e-mail fora de `@lube.com.br` e de `emails_externos`), `is_admin()`, `is_ativo()`, `touch_profile()`. RLS em todas as tabelas. Em 2026-10-06 o verificador do Supabase ainda acusava aviso (WARN) em `is_admin` e `is_ativo` (SECURITY DEFINER) e a proteção de senha vazada desligada.
- **Edge Function `admin-users`** (verify_jwt ligado): criar usuário, aprovar cadastro, trocar senha e remover. Confere o JWT e o `is_admin` no servidor; a chave de serviço só existe lá dentro. v1 em 2026-09-14, v2 no mesmo dia (aprovação de cadastro), v3 em 2026-09-15 (`acesso_total`), v4 em 2026-09-30 (exceções), v5 em 2026-10-06 (e-mail externo). O Supabase mostra **versão 6**, publicada em 2026-10-06 14:43.
- O SQL aplicado fica em `db/01_schema.sql` no repositório, sincronizado a cada migração.

| Data | Migração | O que fez |
|---|---|---|
| 2026-09-14 | `painel_acesso_schema` | pgcrypto; `profiles`, `sistemas`, `permissoes`, `acessos`; gatilho de domínio; funções; RLS |
| 2026-09-14 | `restringe_leitura_sistemas` | usuário comum só lia os sistemas liberados (revisto em 2026-09-15) |
| 2026-09-14 | `endurece_funcoes` | `search_path` fixo e `revoke` das funções de gatilho para public/anon/authenticated (pedido do verificador de segurança) |
| 2026-09-14 | `primeiro_acesso_com_aprovacao` | `ativo` nasce `false`; colunas `aprovado_em` e `aprovado_por`; quem já existia ficou aprovado |
| 2026-09-14 | `icones_predefinidos` | tabela `icones` (os 3 ícones da época viraram registros) e bucket `icones` (leitura pública, escrita só admin) |
| 2026-09-15 | `acesso_total_e_catalogo_visivel` | `profiles.acesso_total`; catálogo de `sistemas` visível a todo usuário ativo |
| 2026-09-30 | `excecoes_do_acesso_total` | tabela `permissoes_excecao` (dono lê a própria, admin lê e escreve tudo) |
| 2026-10-06 | `emails_externos_liberados` | tabela `emails_externos` e `handle_new_user` aceitando a lista |

As migrações `sentinela_v1_1_tabelas`, `sentinela_v1_2_ajudantes`, `sentinela_v1` (2026-10-06) e `sentinela_v1_3_tor_where` (2026-10-07) são da [[SENTINELA LUBE]].

## Sistemas cadastrados (atualizado 2026-09-30)
Gestão de Saída de Veículos · Controle RH (absenteísmo, ver [[BI ABSENTEÍSMO RH]]) · Painel ICMS · Gestão TI · Gestão Compras · Gestão Financeiro · Gestão Comercial — sete sistemas, cada um hospedado à parte, com seu próprio projeto Supabase.

- Slugs (usados pela Sentinela e pelo `?abrir=`): `saida-veiculos`, `rh-absenteismo`, `painel-icms`, `gestao-ti`, `gestao-compras`, `gestao-financeiro`, `gestao-comercial`.
- O nome **"Controle RH"** é escolha do Júlio (2026-09-14). O Claude chegou a trocar para "Controle RH — Absenteísmo" achando que era erro, e desfez.
- **Conferir:** em 2026-10-09 a tabela `sistemas` tem **8 linhas** — qual é a 8ª não foi conferido (pode ser um cadastro inativo; o hero conta só os ativos).

## Conta administradora
`cpd@lube.com.br` (login digitando só `cpd`), nome "TI — CPD", com `acesso_total`. Nasceu como `administrador@lube.com.br` e foi renomeada no mesmo dia (2026-09-14, pedido do Júlio), com a mesma senha, permissões e histórico. Foi criada direto em `auth.users` (a senha fica só como hash no Supabase, nunca no código). No teste de 2026-09-15 a permissão individual dela ao Painel ICMS foi tirada de propósito; como ela tem `acesso_total`, isso não muda o que ela abre. **Senha não gravada aqui** — combinada por fora. Ela apareceu em texto na conversa do Claude Code (2026-09-14 e de novo em 2026-09-22), então precisa ser trocada. Ver [[Como trabalhar comigo]].

## Bugs e incidentes
- **Sistemas duplicados (2026-09-15; até 2026-10-09 esta nota dizia 2026-09-22):** a consulta de permissões não filtrava por `user_id`; numa sessão de admin, a política de segurança devolve as permissões de todo mundo. Só apareceu quando um segundo usuário ganhou acesso. Corrigido com filtro explícito (`e070531`).
- **"Não consigo entrar" do admin (2026-09-14):** era `cdp` digitado no lugar de `cpd` — não era bug. O sufixo `@LUBE.COM.BR` repetido na tela ajudou a confundir; corrigido (`18a5d09`).
- **Nome do RH desfeito pelo Claude (2026-09-14):** ver Sistemas cadastrados. Corrigido na hora.
- **Cache velho no navegador (2026-09-15):** o `portal.js` antigo continuava em uso durante o teste. Daí o `?v=` nos arquivos.
- **Deploy `BLOCKED` (2026-09-30 e 2026-10-06):** repositório privado no Hobby. Em 09-30 o "Liberar tudo, exceto" não aparecia no site por isso. Saída nas duas vezes: o Júlio deixou o repositório público e o Claude criou um **deploy novo** de produção do mesmo commit — promover o bloqueado é recusado (422) e refazê-lo também (400 `deployment_can_never_deploy`). Desde 2026-10-07 os deploys pelo Git passam sem bloqueio.
- **Arquivos internos servidos em produção (achado em 2026-10-05):** `/db/01_schema.sql`, `supabase/functions/admin-users/index.ts` e `.claude/launch.json` abriam para qualquer um. Fechado com o `.vercelignore` (404 conferido em 2026-10-06).
- **IP do escritório bloqueado no portal (2026-10-06, ~4 min):** efeito dos testes de `/.env` feitos do escritório. Bloqueio revogado e portal reimplantado (`dpl_4gQB67GFFRDZa3atsrptftaNYh54`). Regra: nunca testar caminho de ataque a partir do escritório.
- **Imagem de teste no Storage (2026-09-14):** apagar direto em `storage.objects` é recusado (42501, "use a Storage API"), então pode ter ficado uma imagem de teste no bucket `icones`.
- **"Confirm email" ligado (2026-09-14):** quem faz o Primeiro acesso ficaria esperando um e-mail que o SMTP padrão não entrega. Ver pendências.

## Pendências
- [ ] Júlio: trocar a senha de `cpd@lube.com.br` (painel admin › Usuários › Senha).
- [ ] Júlio: desligar "Confirm email" (Supabase › Authentication › Sign In / Providers › Email).
- [ ] Júlio: ligar "Prevent use of leaked passwords" (Authentication › Attack Protection) — desligado na conferência de 2026-10-06.
- [ ] Júlio: pôr `https://painel-lube-distribuidora.vercel.app` em Authentication › URL Configuration › Site URL.
- [ ] Júlio: decidir sobre CAPTCHA (Turnstile) no login — a senha é conferida direto no Supabase Auth, sem passar pela Sentinela, e um robô pode testar senhas ali. Exige mudança no `portal.js`. Ver [[SENTINELA LUBE]].
- [ ] Júlio: criar a conta da Melissa no painel admin (Novo usuário, e-mail completo, senha provisória, escolher os sistemas). O banco tinha 8 perfis em 2026-10-06 e 10 em 2026-10-09: conferir se ela já está lá.
- [ ] Júlio: criar conta no portal para quem usava algum BI só pelo link.
- [ ] Conferir se ficou imagem de teste sem uso no bucket `icones`.
- [ ] Conferir qual é a 8ª linha de `sistemas`.
- [ ] Na próxima mudança de estilo, trocar o `?v=` do `styles.css`: ele mudou em 2026-10-07 e 2026-10-09 (cartão do SAC) e continua `20261006`.
- [ ] Opcional: SMTP próprio no Supabase, se quiser recuperação de senha por e-mail.
- [x] ~~Conectar o repositório na [[Vercel]]~~ — conectado pelo Júlio em 2026-09-14 (a nota estava errada até 2026-10-09).
- [x] ~~Proteger os sistemas na origem~~ — 2026-10-06: o guarda da [[SENTINELA LUBE]] com "exige login" nos 7 sistemas tirou o cadeado da condição de "só sinalização". Os bancos do RH, ICMS e Saída de Veículos ainda aceitam a chave pública (pendência da Sentinela).
- [x] ~~Desligar a Vercel Authentication para a Melissa entrar~~ (aberta desde 2026-09-30) — não é preciso: no modo Standard o endereço principal fica aberto (o portal respondeu 200 de fora em 2026-10-06); só as URLs de deploy pedem login da Vercel. Desligar de vez continua sendo decisão do Júlio.
- Lembrete: se o repositório voltar a privado, o deploy trava de novo.

## Preferências do Júlio neste sistema
- Mostra o que quer com **imagem de referência** anexada na conversa (o portal partiu da referência "Cinematic Noir").
- Botão principal **chamativo, em vermelho Lube — nunca preto**.
- **Nada fixo no código:** número na tela se atualiza sozinho (foi o caso do hero).
- Liberar acesso com **poucos cliques** ("todos, exceto" em vez de marcar um a um); exceção de acesso só **pontual**, para quem ele indicar.

## Decisões
- 2026-09-14 (Júlio): visual animado e cinematográfico, cores da Lube (azul e vermelho), letras grandes; home limpa e centralizada; suporte pelo WhatsApp do Júlio e do Alexandre; sem os rótulos numerados e sem o contador de sistemas.
- 2026-09-14 (Claude): HTML/CSS/JS puro, sem build — sobe na Vercel como site estático.
- 2026-09-14 (Claude): a navbar lê a superfície atrás dela (`data-surface`) em vez de `mix-blend-difference`, que deixava a marca amarelada sobre o azul.
- 2026-09-14 (Claude): precisa de banco — senha escrita no navegador seria lida por qualquer um.
- 2026-09-14 (Júlio): projeto Supabase novo e dedicado (US$ 10/mês).
- 2026-09-14 (Claude): restrição de domínio no banco (gatilho); login por usuário curto.
- 2026-09-14 (Claude): Primeiro acesso cria conta pendente que o TI aprova — senão alguém de fora cadastraria um `@lube.com.br` inexistente e entraria.
- 2026-09-14 (Júlio): conta admin = `cpd@lube.com.br`; botão Entrar em vermelho Lube (preto ficava estranho); admin em azul escuro com marcações vermelhas; ícone criado fica salvo como predefinido; nome "Controle RH" fica.
- 2026-09-15 (Júlio): sistema sem acesso aparece cinza com cadeado, em vez de sumir; opção de liberar todos os sistemas de uma vez (não o painel admin).
- 2026-09-15 (Claude): `acesso_total` vale também para sistema cadastrado depois; `?v=AAAAMMDD` nos arquivos.
- 2026-09-30 (Júlio): "Liberar tudo, exceto:"; repositório público para a Vercel publicar; números do hero automáticos.
- 2026-09-30 (Claude): exceções só valem para quem tem `acesso_total`; números do hero contam a empresa toda; não desligar a Vercel Authentication sem ordem do Júlio (é configuração de segurança).
- 2026-10-05/06 (Júlio): a porta de todos os sistemas é o login do Painel Lube ([[SENTINELA LUBE]]).
- 2026-10-06 (Claude): o portal fica sem porta (`exige_login = false`), porque é a própria tela de login.
- 2026-10-06 (Júlio): só a Melissa pode entrar com e-mail de fora — exceção só para ela.
- 2026-10-06 (Claude): a exceção mora numa lista no banco; a conta dela é criada pelo admin, nunca pelo Primeiro acesso, e nasce sem sistemas.
- 2026-10-07 (Júlio): atalho do SAC na tela de login, sem login, para os RCAs.
- 2026-10-07 (Claude): o portal só leva até o SAC — não passa sessão nem passe; o SAC se protege sozinho.

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-09** — atalho do SAC no ar na tela de login: push às 09:34 e, 12 min depois, renomeado de "SAQ" para "SAC · Abrir chamado", apontando para `sac-lube.vercel.app` (commits `7529c25`, `913476c`; deploys `dpl_En67mE64ubeoDrGk1VcYFuordJsK` às 09:34 e `dpl_3bo2uYnT2pjF1h5agkvYdwnBv8dA` às 09:47, READY) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — cartão "SAQ · Abrir chamado ao SAC" abaixo do botão Entrar, depois de "ou, sem login" (Júlio): `index.html`, `styles.css` (classes `.gate__ou` e `.gate__saq`), README; commit `7529c25` segurado sem push até o SAC funcionar · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — primeiro passe real usado (cpd@, 08:24): entrada portal → sistema funcionando · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-07** — guarda do portal atualizado para 1.1.0 e mudanças da Sentinela publicadas por este mesmo projeto Vercel (central confere a chave da IA, rótulos do painel `/sentinela/`, nome de robô como identidade, lista Tor); deploys pelo Git READY, sem `BLOCKED` (commits `64e51a0`, `50e748c`, `7bdf3a7`, `9b21b19`, `856a068`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — portal vira a porta da Sentinela: passe de 90 s ao abrir sistema, `?abrir=`, identidade após o login, aviso de tentativa falha; guarda sem porta na raiz (`FECHADO = null`); link "Sentinela" no admin; painel `/sentinela/` só para admin; `.vercelignore`; README com a seção da Sentinela; merge do branch `sentinela-v1` na `main` (commits `c7366de`, `4e9249d`, `cb2a988`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — IP do escritório bloqueado ~4 min no portal pelos testes de `/.env`; bloqueio revogado e portal reimplantado (deploy `dpl_4gQB67GFFRDZa3atsrptftaNYh54`, sem código novo) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — e-mail de fora do domínio só para a consultora Melissa (Júlio): tabela `emails_externos`, gatilho, portal, admin e `admin-users` v5; deploy `BLOCKED` às 14:46 (`dpl_6ECDkXkpfakkxqEDtfLhZ68QE4qt`, repositório privado de novo), Júlio liberou, deploy novo `dpl_5hnBxo2Y3PoDWwc3ohSiCiMjtMrF` READY às 14:55 (commit `5941e8b`, migração `emails_externos_liberados`) · [[2026-10-06 — Acesso da consultora externa ao Painel Lube]]
- **2026-10-05 18:02 e 2026-10-06 08:09** — dois **redeploys** de produção do `db0dda3` na Vercel, sem código novo (origem "redeploy": `dpl_9t1JQeRKf6JFok3xeJTuhA5wJooK` e `dpl_E5EgkP3DwpvNeTxmB3sxVvgMhHVr`). Quem pediu e por quê não ficou registrado em nenhuma conversa · [[Vercel]]
- **2026-10-05** — passe, `?abrir=` e `.vercelignore` feitos na pasta, sem commit (entraram em `c7366de` no dia 6); achado: a produção servia o SQL do banco e o código da Edge Function · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-09-30** — "Sistemas ativos" e "Áreas atendidas" do hero passam a ser calculados (antes "03" fixo); deploy automático voltou a funcionar (commit `db0dda3`) · [[2026-09-23 — criação do Painel Lube Distribuidora]]
- **2026-09-30** — deploy `BLOCKED` por repositório privado (10:44, `dpl_D9MwWVcG1kebxbzLDZk65xg2eZV1`); Júlio deixou o repositório público e o Claude criou deploy novo de produção do `b313c59` às 11:33 (`dpl_4JBDcg8QkwphBbxcaeP1tVRHgqeN`) · [[2026-09-23 — criação do Painel Lube Distribuidora]]
- **2026-09-30** — "Liberar tudo, exceto:" no admin; chip "exceto X" na tabela; `admin-users` v4 (commit `b313c59`, migração `excecoes_do_acesso_total`) · [[2026-09-23 — criação do Painel Lube Distribuidora]]
- **2026-09-15** — cartões duplicados corrigidos; sistema sem acesso em cinza com cadeado; `acesso_total` ("Todos os sistemas"); catálogo visível a todo usuário ativo; `?v=` nos arquivos; `admin-users` v3 (commit `e070531`, migração `acesso_total_e_catalogo_visivel`) · [[2026-09-23 — criação do Painel Lube Distribuidora]]
- **2026-09-14** — admin em azul escuro com marcações vermelhas; ícones cadastráveis (galeria, "+ Novo ícone", bucket `icones`, `icones.js`); nome "Controle RH" desfeito pelo Claude e devolvido; dados de teste (sistema `portal-de-compras` e ícones de teste) criados e apagados de `sistemas` e `icones` (commit `9214901`, migração `icones_predefinidos`) · [[2026-09-23 — criação do Painel Lube Distribuidora]]
- **2026-09-14** — conta admin passa a ser `cpd@lube.com.br`; sufixo `@LUBE.COM.BR` some com o e-mail completo (commits `ec30595`, `18a5d09`) · [[2026-09-23 — criação do Painel Lube Distribuidora]]
- **2026-09-14** — Primeiro acesso com aprovação do TI; botão Entrar vermelho Lube; `admin-users` v2 (commit `a68bdf3`, migração `primeiro_acesso_com_aprovacao`) · [[2026-09-23 — criação do Painel Lube Distribuidora]]
- **2026-09-14** — controle de acesso: projeto Supabase dedicado, login `@lube.com.br` por gatilho, RLS, Edge Function `admin-users`, portal com login e painel admin; repositório criado e publicado; Júlio ligou a Vercel (1º deploy 14:19) (commit `5586b20`, migrações `painel_acesso_schema`, `restringe_leitura_sistemas`, `endurece_funcoes`) · [[2026-09-23 — criação do Painel Lube Distribuidora]]
- **2026-09-14** — site visual antes do primeiro commit: cortina de entrada, hero com zoom, caminhão na transição, busca com feixes azul e vermelho, carrossel, home limpa, botão "Falar com o TI" pelo WhatsApp, tela de carregamento com a logo; ícones SVG de Saída de Veículos, RH e ICMS redesenhados (o filete vermelho ficava em cima das letras); rótulos numerados retirados (entrou em `5586b20`) · [[2026-09-23 — criação do Painel Lube Distribuidora]]

Veja também [[2026-09-23 — criação do Painel Lube Distribuidora]], [[2026-10-06 — Acesso da consultora externa ao Painel Lube]], [[SENTINELA LUBE]], [[SAC]], [[Mapa de sistemas]] e [[Supabase]].
