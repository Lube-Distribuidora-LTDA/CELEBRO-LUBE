---
tipo: projeto
departamento: Comercial
status: ativo
inicio: 2026-10-07
tags: [projeto, sac, chamados, rca, email, winthor]
---
# SAC

> **Nome:** de 2026-10-07 a 2026-10-09 o sistema se chamou **SAQ** — o Júlio corrigiu: o nome é **SAC**.
> Trocados juntos em 2026-10-09: tela, e-mail, protocolo (`SAC-…`), endereço (`sac-lube.vercel.app`; o antigo
> `saq-lube.vercel.app` redireciona), repositório (`Lube-Distribuidora-LTDA/SAC`; o GitHub redireciona o antigo),
> projeto na Vercel, cadastro na Sentinela, pasta `Desktop\BI\10. SAC` e o atalho do portal.

Sistema de **chamados do RCA para o SAC**. O nome é "SAC" (Júlio). A ideia final é um sistema de
chamados completo. A **fase 1** (2026-10-07) é só a **tela de abertura e o e-mail de comprovante**: o RCA
preenche a ocorrência no celular, o sistema gera um protocolo e manda para o e-mail que ele informou um
comprovante formatado na pegada do e-mail de cobrança do [[GESTÃO TI]], com design melhor.
Origem: [[2026-10-07 — SAC, tela de chamado do RCA]].

**Duas decisões do Júlio (2026-10-07, segunda rodada):**
1. **O e-mail sai como se o RCA mandasse para ele mesmo** — nome do RCA como remetente, para o e-mail dele,
   resposta voltando para ele.
2. **Sem login no portal:** o SAC abre por um atalho na **tela de login do [[PAINEL LUBE DISTRIBUIDORA]]**; o RCA
   não precisa de conta no portal. _Em 2026-10-09 o SAC ganhou login próprio (ver "Login do SAC")._

- Pasta: `Desktop\BI\10. SAC` (repositório git, enviado ao GitHub)
- Mesmo molde do [[REPOSIÇÕES E CHAMADOS]]: site estático + funções serverless sem framework, Root Directory `web`, região `gru1`
- Rodar no computador: `node servidor_local.js` em `web\` → http://localhost:3110 (no cérebro: `.claude/launch.json` "sac")
- **No ar desde 2026-10-07 (~17:45):** `https://sac-lube.vercel.app` — projeto Vercel `sac-lube`
  (`prj_HnjGoS8pFCFCIDD17iz3nvQ1LoB1`, Root Directory `web`, `gru1`, Node 22, OIDC do time).
- Repositório: [Lube-Distribuidora-LTDA/SAC](https://github.com/Lube-Distribuidora-LTDA/SAC), **público** (no Hobby,
  privado trava o deploy). Criado pela API do GitHub com a credencial do git desta máquina: `Lube-Distribuidora-LTDA`
  é uma **conta de usuário**, não organização (criar repositório é em `/user/repos`).
- **O projeto não está ligado ao Git** (foi criado antes do repositório): todo deploy até hoje foi feito pela API
  (o primeiro com o commit `eaefe21`; o de produção em 2026-10-09 é o do `f050e2b`). Para publicar a cada push,
  ligar em Vercel › sac-lube › Settings › Git; até lá, deploy pela API.
- Sentinela: cadastrado na central (`sentinela.sistemas`, `exige_login = false`, ação `sistema_novo` em
  `acoes_admin`); `/.sentinela/saude` respondeu `oidc: true`, lista ok, modo proteger.
- **Funcionando desde 2026-10-09 (~09:33):** o Júlio cadastrou as 3 senhas (`SUPABASE_DB_PASSWORD`, `SMTP_PASS`,
  `IMAP_PASS`; Sensitive, Production — o Claude conferiu só os nomes) e o SAC foi publicado de novo. Conferido no ar: cadastro com 7.287 produtos (1,4 s na 1ª chamada, 0,22 s do CDN na 2ª);
  `/api/rca` reconhece RCA cadastrado e recusa quem não é; `/api/enviar` com e-mail de fora → 400, nada sai.
- **Atalho do portal no ar** (commit `7529c25`, deploy READY; renomeado para SAC no commit `913476c`): tela de
  login → "SAC · Abrir chamado" → SAC, sem login, conferido no navegador em tamanho de celular, sem erro no console.
- **Ainda não testado:** o envio de verdade (SMTP e cópia em Enviados do `sac@`). O primeiro chamado real é o teste.

## Campos (desenho do Júlio)
| Campo | Como ficou |
|---|---|
| E-mail do RCA | **primeiro campo** (passo 01 "Quem está abrindo"); só aceita e-mail de **RCA ativo no WinThor** e mostra "✓ RCA 9 · Nome" na hora; fica lembrado no aparelho |
| NF | só números; **conferida no WinThor ao digitar** (desde 2026-10-09): mostra a emissão e o cliente, e **recusa NF emitida há mais de 1 mês** (mês de calendário: emitida em 09/09 vale até 09/10), cancelada ou não encontrada. O envio confere de novo |
| Motivo | os 9 assuntos **"SAC - ..."** do [[WinThor]] (`PCMANASSUNTO` 65 a 73), em botões; o código vai no e-mail |
| Detalhe | texto livre, mínimo 15 caracteres |
| Cód. produto | completa o **Produto** sozinho pelo cadastro do WinThor (`core.dim_produto` do DATA WAREHOUSE) |
| Produto | também dá para buscar pelo nome (todas as palavras digitadas); mostra "fora de linha" |
| Foto comprobatória | de 1 a 3, do produto ou da NF; reduzidas no celular (lado maior 1600 px) antes de subir |

## Como funciona
- **NF conferida no WinThor** (regra do Júlio, 2026-10-09): `/api/nf` (ao digitar) e `/api/enviar` (de novo)
  procuram a nota em `core.dim_nf_saida` — a capa da `PCNFSAID` dos últimos 45 dias, carregada pelo ETL do
  [[BI COMERCIAL]] 8 vezes por dia na VM `SRV-IA`. Só aceita nota não cancelada emitida até 1 mês atrás. O número
  da NF se repete entre filiais: vale a não cancelada, depois a do próprio RCA, depois a mais recente. Nota emitida
  depois da última carga só aparece na seguinte (7h, 8h, 9h, 10h, 13h, 15h, 16h, 17h) — a mensagem diz isso. Banco
  fora do ar no envio → nada sai. O e-mail ganhou a emissão, a filial e o cliente da nota.
- **Remetente = o RCA, no nome.** O e-mail chega com o nome do RCA (do WinThor) como remetente, para o e-mail
  dele, com "Responder" voltando para ele; o corpo diz "Olá, Fulano!" e traz "RCA 9 · Nome". O **endereço** do
  remetente é a caixa da Lube (`SMTP_USER`), não o Gmail dele: 80% dos RCAs usam Gmail/Hotmail, e e-mail que diz
  vir de `@gmail.com` saindo de outro servidor é falsificação de remetente — Gmail e Hotmail jogam no spam e o
  Yahoo (`p=reject`) recusa. Sair da caixa do próprio RCA exigiria a senha dele, e senha não se guarda.
- **Só RCA cadastrado:** como a tela é pública, `/api/rca` (ao digitar) e `/api/enviar` (de novo, no envio)
  conferem o e-mail em `core.dim_rca` (`email`/`email2`, sem término e sem bloqueio). Sem isso, a rota de envio
  seria um disparador de e-mail com a marca da Lube para qualquer endereço. Banco fora → **nada sai** (falha
  fechada) e a tela avisa. As colunas novas vêm do ETL do [[BI COMERCIAL]], dono do `dim_rca`.
- **Abre na hora** (regra de [[Como trabalhar comigo]]): o cadastro de produtos (~7.300 itens, ~330 KB) fica
  guardado no aparelho e é atualizado por trás; o CDN guarda por 1 h e entrega a cópia velha por até 7 dias. Banco
  lento não trava a tela — o RCA escreve o nome do produto.
- **O servidor confere tudo de novo:** motivo da lista, um e-mail só e sem quebra de linha (injeção de cabeçalho),
  foto que é foto de verdade (assinatura do arquivo), texto escapado no HTML. 14 testes passaram em 2026-10-07.
- **Nunca "enviado" de mentira:** SMTP fora ou faltando → a tela diz que **não** foi, e os dados ficam.
- **E-mail:** faixa azul "SAC" com "● CHAMADO DO RCA" e a marca da Lube em texto, filete azul→vermelho, selo
  "Chamado registrado", assunto "[SAC-…] Chamado registrado — motivo — NF", caixa do protocolo, andamento Registrado → Em análise → Resolvido, motivo com o código do
  WinThor, tabela NF/código/produto/e-mail, detalhes e as fotos no corpo **e** em anexo (o Outlook não lista as
  embutidas na barra de anexos). Feito com tabela e estilo em linha por causa do Outlook.
- **Protocolo:** `SAC-AAMMDD-XXXXX` (data de Brasília + 5 caracteres sem 0/O/1/I/L). Sem banco não dá para ser
  sequencial; com 50 chamados/dia a chance de repetir num ano é ~1,6%.
- **Modo prévia** no servidor local: nada sai, o e-mail vai para `web\previas\` (.html e .eml).
- **Envio:** `nodemailer` pelo SMTP da [[Locaweb]] e cópia em Enviados por IMAP. Variáveis na Vercel (só os
  nomes; valor nunca aqui): `SUPABASE_DB_HOST/PORT/NAME/USER/PASSWORD`, `SMTP_HOST/PORT/USER/PASS`,
  `IMAP_HOST/USER/PASS` e `SAC_COPIA_PARA` (opcional). As 3 senhas são Sensitive e quem cadastra é o Júlio.
- **No banco**, a conexão do SAC aparece como `application_name = 'sac'` (o `_db.js` é cópia do do
  [[REPOSIÇÕES E CHAMADOS]]). No `vercel.json`: `api/enviar.js` pode levar até 30 s e `api/produtos.js` até 60 s;
  todas as páginas saem com `noindex` (não aparecem no Google).

## Os motivos SAC do WinThor (conferidos no Oracle em 2026-10-07)
Família criada para o SAC, setor 12, todos `ATIVO = 'S'`. Alguns ainda nunca foram usados (69 e 71).

| Cód. | Assunto no WinThor | Na tela |
|---|---|---|
| 65 | SAC - PEDIDO EM DESACORDO | Pedido em desacordo |
| 66 | SAC - FALTA DE MERCADORIA | Falta de mercadoria |
| 67 | SAC - MERCADORIA AVARIADA | Mercadoria avariada |
| 68 | SAC - VENCIMENTO CURTO | Vencimento curto |
| 69 | SAC - ITEM VENCIDO | Item vencido |
| 70 | SAC - DESISTIU DA COMPRA | Desistiu da compra |
| 71 | SAC - PEDIDO DUPLICADO | Pedido duplicado |
| 72 | SAC - MERCADORIA DIFERENTE NF | Mercadoria diferente da NF |
| 73 | SAC - CLIENTE NAO PEDIU | Cliente não pediu |

Os outros ~60 assuntos (logística, fiscal, transportadora, "TESTE2") ficaram de fora: não são do RCA. Mudou no
WinThor? Mexer só em `web\motivos.js`.

## Login do SAC (desde 2026-10-09)
Pedido do Júlio: tela de login parecida com a do Painel ("Entrar" / "Primeiro acesso"); o primeiro acesso
**avisa o TI no painel administrativo**, numa aba separada da dos usuários do painel. Substitui o "sem login" de
07/10 — o atalho na tela de login do Painel continua, agora com o texto "RCAs e supervisores · login próprio do SAC".

- **Onde mora a conta:** na **mesma base de login do Painel** (Supabase Auth do projeto PAINEL LUBE DISTRIBUIDORA),
  mas como **conta do SAC**: `public.sac_usuarios` (pendente → liberado / recusado / bloqueado), **sem** `profiles`
  — não abre o painel. O gatilho `handle_new_user` desvia quem chega com `sistema = 'sac'` nos metadados; o resto
  da regra do domínio (@lube.com.br ou `emails_externos`) ficou igual. Migração `sac_acesso_v1`
  (`db/03_sac_acesso.sql` no repositório do Painel), **15 testes numa transação desfeita** antes de aplicar; o
  aplicado confere com o arquivo (md5). Funções: `sac_meu_acesso`, `sac_pedir_acesso`, `sac_registrar`.
- **Primeiro acesso:** nome, **RCA ou Supervisor**, e-mail, senha. RCA: e-mail conferido no WinThor (`/api/rca`,
  mostra "RCA 9 · Nome") e o código vai junto. Supervisor: o TI confere (o WinThor não tem o e-mail dele). A base
  confirma o e-mail na hora; o SAC sai da sessão e diz "seu cadastro chegou ao TI".
- **Aviso ao TI:** aba **"SAC · externos"** no painel admin, com selo vermelho com o número de pendentes, faixa no
  topo ("2 cadastros novos no SAC esperando liberação") e "(2)" no título da página; o admin confere de minuto em
  minuto. Lá: Liberar, Recusar, Bloquear, Senha, Remover e os **acessos do SAC** (primeiro acesso, pedido, entrou,
  saiu, enviou chamado). "Acessos" do painel virou "Acessos do painel".
- **Entrar:** só conta `liberado` entra. Pendente/recusado/bloqueado saem com a mensagem certa. Usuário do painel
  (@lube) sem conta do SAC pode **pedir acesso**. Conta do SAC que tenta entrar no Painel sai da sessão com aviso.
- **API:** `/api/nf` e `/api/enviar` exigem o token; `_auth.js` confere no Supabase do Painel (`/auth/v1/user`) e a
  conta liberada, **só com a chave pública** — nenhum segredo do Painel no SAC. O comprovante vai para o e-mail
  **da conta**. O formulário perdeu o campo de e-mail. **Supervisor liberado envia** ("Aberto por: Supervisor ·
  Nome"); RCA precisa continuar ativo no WinThor.
- **Testado:** banco (15), API com login simulado (11) e token falso contra o login real (401); admin num banco
  simulado (selo, faixa, título, Liberar grava `liberado`); telas do login no celular (RCA reconhecido, senhas
  diferentes barradas antes de qualquer cadastro). **Não testado:** cadastro, aprovação e entrada de verdade — o
  Claude não cria conta nem entra com senha; é o primeiro teste do Júlio.

## Segurança
- **Login próprio do SAC** (desde 2026-10-09; de 07 a 09/10 foi aberto sem login). O guarda da Sentinela segue
  com `exige_login = false` — a porta é o login do SAC, não o do portal — e barra ataque, robô e rajada, inclusive
  quem tentar descobrir e-mails de RCA em série pelo `/api/rca` (público, usado no cadastro).
- Ponto fraco conhecido: quem souber o e-mail de alguém pode cadastrar uma conta do SAC com ele antes da pessoa
  (fica pendente; o TI recusa/remove). O cadastro não precisa de confirmação por e-mail (a base confirma na hora).
- Também fica público o **cadastro de produtos** (código e descrição, sem preço), pelo `/api/produtos`.

## RCAs que ainda não conseguem usar (WinThor, 2026-10-07)
128 RCAs ativos: **101 com e-mail válido, 20 sem e-mail e 7 com e-mail errado** (`@gmailcom`, `@hotmail`,
`@htmail.com`, `@hormail.com.br`, `@yahoo.com.by`, `@gmail.com.br`, `@lube.com`); só 1 se salva pelo `EMAIL2`.
Esses 27 levam "este e-mail não está no cadastro" até alguém corrigir o `PCUSUARI`. A carga do COMERCIAL leva a
correção ao SAC sozinha (4 vezes por dia).

## Próximo passo pedido: abrir o chamado também no WinThor (levantado em 2026-10-09)
O Júlio quer que o chamado, além do e-mail, seja **aberto no WinThor** (a manifestação das rotinas 1902/1905).
Levantado no Oracle (só leitura):

- **Como o WinThor guarda:** `PCMANIF` (capa) + `PCMANIFPROD` (produto e quantidade reclamada). Sem gatilho nas duas
  tabelas. O número vem de `PCCONSUM.PROXNUMMANIF` (contador do WinThor, não sequence). Um chamado recém-aberto
  (`SITUACAO = 'AB'`) tem só: `NUMMANIF`, `NUMSEQ` (0), `CODCLI`, `CODFILIAL`, `NUMNOTA`, `CODRCA`, `CODMOTORISTA`,
  `CODTRANSPORTADOR` (às vezes), `CODASSUNTO`, `MANIFESTACAO` (texto), `CONTATO`, `CODFUNCAB` (quem abriu), `DTAB`,
  `TEMPODECORRIDO`. Situações vistas em 90 dias: `AB` aberto, `PR` providência, `SO` solucionado, `RT`.
- **Hoje quem abre é o SAC, à mão:** os 27 chamados SAC (assuntos 65–73) dos últimos 30 dias foram todos digitados
  pela matrícula 772 (atendente do SAC), com `MEIO = 'E-Mail'` e texto "SEGUNDO RCA, ...". **Todos têm quantidade**
  em `PCMANIFPROD` (30 de 30) — o formulário do SAC ainda não pede quantidade.
- **Dá para fazer, mas não com o que existe hoje.** Falta: (1) a Vercel não alcança o Oracle → um **agente na VM
  `SRV-IA`** (mesmo caminho da [[Abertura de margem]]) que pega os chamados pendentes e grava no WinThor; (2) o SAC
  **guardar os chamados num banco** (schema `sac`, a "fase 2") para o agente ter de onde ler; (3) um **usuário Oracle
  de escrita** só com `INSERT` em `PCMANIF`/`PCMANIFPROD` e `UPDATE` em `PCCONSUM` — o do ETL é só leitura, e o de
  escrita da margem ainda nem foi cadastrado; (4) decidir a **matrícula de abertura** (`CODFUNCAB`): um funcionário
  "SAC WEB" no WinThor ou a do SAC; (5) **campo de quantidade** no formulário; (6) o **motorista** da NF
  (`PCNFSAID.CODMOTORISTA`) na `core.dim_nf_saida`; (7) **um primeiro chamado de teste** gravado com o ok do Júlio e
  conferido pelo SAC na rotina 1905. Foto não tem lugar na `PCMANIF`: continua no e-mail.

## Supervisores (levantado em 2026-10-09)
**Desde o login (2026-10-09) podem entrar:** escolhem "Supervisor" no primeiro acesso e o TI libera. Antes não
estavam inclusos: Dos 21 supervisores ativos (`PCSUPERV`, sem demissão, posição A), **nenhum tem e-mail no
cadastro de supervisor** (rotina 516). 19 têm o próprio código de RCA (`COD_CADRCA`), mas em 16 esse RCA está
desligado/bloqueado e em 2 sem e-mail: **só 1 supervisor entra hoje**, pelo cadastro de RCA. Para incluir: preencher
o e-mail na rotina 516 e estender o `core.dim_supervisor` (dono: ETL do COMERCIAL) com e-mail e situação; o SAC passa a
aceitar o e-mail do supervisor e o identifica como supervisor.

## Pendências
- [x] ~~Por qual caixa o SAC sai~~ → **`sac@lube.com.br`**, caixa do SAC que já existe (Júlio, 2026-10-07).
  O e-mail chega como "Nome do RCA <sac@lube.com.br>". Com o IMAP do `sac@` cadastrado, cada chamado fica em
  Enviados do `sac@` — o registro de todos os chamados enquanto não há banco.
- [x] **Júlio:** cadastrar na Vercel a senha do `sac@` (`SMTP_PASS` e `IMAP_PASS`) e a do DATA WAREHOUSE —
  feito em 2026-10-09 (Sensitive, Production).
- [ ] **Júlio:** confirmar os motivos (só os 9 "SAC - ...", 65 a 73) e a foto obrigatória (pelo menos 1) —
  escolhas do Claude em 2026-10-07, ainda sem resposta.
- [ ] **Júlio:** a caixa de entrada do `sac@` recebe cópia de todo chamado? Qual endereço (`SAC_COPIA_PARA`)? Hoje só o RCA recebe.
- [x] ~~RCA entra pelo Painel Lube?~~ Não: atalho na tela de login, sem login (2026-10-07).
- [ ] **Comercial:** corrigir o e-mail dos 27 RCAs no WinThor (lista com o Júlio).
- [ ] **Primeiro chamado real** (Júlio, com um RCA avisado): conferir a chegada no Gmail/Hotmail e a cópia em Enviados do `sac@`.
- [x] Publicado (2026-10-07/09): repositório, projeto `sac-lube`, variáveis, Sentinela, senhas, atalho no portal.
- [ ] Ligar o projeto `sac-lube` ao repositório (Vercel › Settings › Git) para publicar a cada push.
- [x] Commit no repositório do COMERCIAL (`consultas_comercial.py` e `web/db/07-dim-rca-email.sql`) — entrou em
  2026-10-08 no commit `bb64f16` ("Tranca na carga…"). Falta commitar a troca de "SAQ" por "SAC" nos
  comentários desses dois arquivos (feita em 2026-10-09, ainda não commitada) e, desde 2026-10-09, a consulta
  `dim_nf_saida` e o `web/db/08-dim-nf-saida.sql` (ver [[BI COMERCIAL]]).
- [ ] **Conferência da NF** (em andamento desde 2026-10-09): terminar, testar, commitar e publicar no SAC. Antes de
  publicar, a `core.dim_nf_saida` precisa estar sendo carregada pela `SRV-IA` — senão NF nova não é achada e o RCA
  não consegue abrir o chamado.
- [ ] **README do repositório** ainda diz "Publicar na Vercel (ainda não publicado)" e "endereço previsto" —
  atualizar na próxima mexida no SAC.
- [ ] **Fase 2 — sistema de chamados:** banco (protocolo sequencial, fila, andamento, resposta do SAC).

## Ideias que ficaram de fora da fase 1 (não pedidas)
- ~~Conferir a NF e mostrar o cliente~~ — feito em 2026-10-09, com a regra de 1 mês. Falta: escolher o produto
  entre os itens da própria NF.
- Quantidade reclamada (o WinThor tem `OBRIGAQTDE` por assunto; os assuntos SAC estão vazios).
- Mais de um produto por chamado.
- Identificar o RCA pelo código (`core.dim_rca`).

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-09** — **Login do SAC** (Júlio): "Entrar" / "Primeiro acesso" na base de login do Painel, conta do SAC
  pendente até o TI liberar na nova aba "SAC · externos" do painel admin (selo, faixa, título); supervisores entram;
  formulário sem e-mail; `/api/nf` e `/api/enviar` exigem token. Migração `sac_acesso_v1` no Painel; commits
  `1d563aa` (SAC, deploy `dpl_5fYzRGoxGVKMxyLA8gWb7JBkVUV4`), `9ab901c` e `10f8ead` (Painel) · [[2026-10-07 — SAC, tela de chamado do RCA]]

- **2026-10-09** — **NF conferida no WinThor: só aceita nota emitida até 1 mês atrás** (Júlio). `/api/nf` e conferência
  no `/api/enviar`; tela mostra emissão e cliente ou o motivo da recusa; e-mail com emissão, filial e cliente. Fonte
  `core.dim_nf_saida` (nova, dona: ETL do COMERCIAL). Commit `ebff1fa`, deploy `dpl_AvLXHH3fFeFLfP3X9yRbDFu3xxMK`.
  Testes: 9 da regra + 12 anteriores, e no ar (NF de hoje aceita; de 25/08 recusada; inexistente recusada) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-09 (em andamento, não commitado nem publicado)** — **Conferência da NF** (regra do Júlio: só NF emitida
  até 1 mês atrás, mês de calendário). `web/api/_nf.js` e a rota nova `POST /api/nf` procuram a nota em
  `core.dim_nf_saida` (com o cliente de `core.dim_cliente`) ao digitar, e o `/api/enviar` confere de novo: nota
  que não existe, cancelada ou com mais de 1 mês → recusa; banco fora na conferência → 502, nada sai. O número da
  NF se repete entre filiais: vale a não cancelada, depois a do próprio RCA, depois a mais recente. A tela mostra
  emissão e cliente; o e-mail ganha "emitida em … · filial …" e a linha Cliente (`app.js`, `index.html`,
  `estilo.css`, `_email.js`, `servidor_local.js` mexidos). A tabela vem do ETL do [[BI COMERCIAL]] (migração
  `dim_nf_saida` às 10:48; 33.985 notas já carregadas em 2026-10-09). Em produção continua o `f050e2b` ·
  [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-09** — Atalho do portal renomeado para "SAC · Abrir chamado", levando a `sac-lube.vercel.app` (commit
  `913476c` no [[PAINEL LUBE DISTRIBUIDORA]]) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-09** — Endereço antigo `saq-lube.vercel.app` redireciona (308) para `sac-lube.vercel.app`, pela regra
  `redirects` do `web/vercel.json` (Claude); deploy `dpl_A5YjukjYoz6V84e7jUZD33sqqhmY`, o de produção hoje (commit
  `f050e2b`) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-09** — **Nome corrigido de SAQ para SAC** (Júlio), tudo de uma vez porque ainda não estava em uso
  (Claude): tela, faixa e assunto do e-mail, protocolo `SAC-AAMMDD-XXXXX`, variáveis `SAC_*`, chaves do aparelho
  `sac.*`, README; pasta `10. SAQ` → `10. SAC`; repositório no GitHub `SAQ` → `SAC`; projeto Vercel `saq-lube` →
  `sac-lube` (mesmo id, senhas mantidas) com o domínio novo; linha da Sentinela (`sistema_renomeado`); `launch.json`
  do cérebro. O repositório foi renomeado por PATCH na API do GitHub e o `origin` local atualizado; as prévias
  `SAQ-*` de `web\previas` foram apagadas. Os 12 testes passaram de novo (commit `8cc213d`; deploy `dpl_3YUZfSQgKn3ztbLBajsAnNoDcj5S`) ·
  [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-09** — Comentários do ETL do [[BI COMERCIAL]] (`consultas_comercial.py`, `web/db/07-dim-rca-email.sql`)
  trocados de SAQ para SAC (em andamento, não commitado — repositório `Desktop\BI\8. COMERCIAL`) ·
  [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-09** — Atalho do portal publicado (commit `7529c25`, feito em 2026-10-07 e guardado até o SAC funcionar
  — Claude) e conferido no celular: login → atalho → SAC sem login · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-09** — **SAC funcionando:** o Júlio cadastrou as 3 senhas na Vercel; dois deploys de produção do
  `eaefe21` (09:31 `dpl_NGYNWEMviUr8WuQCRgVntukGZoA1` e 09:33 `dpl_8gQf4QSXgKbdx8ddnHujnpE6kAeJ`) para carregá-las. Conferido no ar sem mandar e-mail:
  7.287 produtos, RCA reconhecido e recusado, envio para e-mail de fora → 400 · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-08** — A consulta do `dim_rca` com e-mail e o `07-dim-rca-email.sql` entraram no Git do
  [[BI COMERCIAL]] (commit `bb64f16`, junto da tranca de carga) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — **Publicado** com o "OK pode publicar" do Júlio: repositório público `Lube-Distribuidora-LTDA/SAQ`
  (hoje SAC, criado pela API do GitHub; `git init` às 17:44, branch `main`, autor local "GTI Julio"), projeto
  Vercel `saq-lube` (criado às 17:42; Root `web`, `gru1`, Node 22, variáveis sem senha), cadastro na central da [[SENTINELA LUBE]] com `exige_login = false` (`sistema_novo`), deploy pela API às
  17:45 (commit `eaefe21`, `dpl_Dv8rXtQWLXkrASt6mZyy18ttbzMB`). Sem as senhas, as APIs respondiam "falta
  `SUPABASE_DB_PASSWORD`" · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — Caixa de envio = **`sac@lube.com.br`** (Júlio, 17:07): padrão do `SMTP_USER` no `_correio.js`, remetente "Nome do RCA <sac@lube.com.br>", cópia
  em Enviados por IMAP, README com as variáveis da Vercel (commit `eaefe21`) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — Banco: `core.dim_rca` ganhou `email`, `email2`, `bloqueio` e `dttermino` (migração
  `dim_rca_email` às 16:30, pelo ETL do [[BI COMERCIAL]], dono da dimensão); carga avulsa às 16:31 ·
  [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — Segunda rodada (Júlio): e-mail "como se o RCA mandasse para ele mesmo" (nome do RCA no remetente,
  `To` e `Reply-To` = RCA, "Olá, Fulano!") e acesso **sem login**. Para a tela pública não virar disparador de
  e-mail (Claude): `/api/rca` e conferência do RCA de novo no envio, banco fora = nada sai; o e-mail virou o passo
  01 da tela; 12 testes contra o banco real (commit `eaefe21`) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — Guarda da Sentinela 1.1.0 (`middleware.ts`, `sentinela-guarda.ts`) copiado do portal;
  `.vercelignore` com `previas/` e `servidor_local.js` (commit `eaefe21`) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — **Fase 1 construída** (Júlio pediu a tela e o e-mail): tela para o celular, 9 motivos "SAC - ..."
  do WinThor, produto completado pelo `core.dim_produto` com cache no aparelho e no CDN, e-mail na pegada do
  [[GESTÃO TI]] com fotos no corpo e em anexo, tudo validado de novo no servidor, servidor local com modo prévia
  (porta 3110), protocolo de 5 caracteres, visual trocado para o padrão da casa, logo do portal reduzida para 560 px,
  14 testes da API, README (commit
  `eaefe21`) · [[2026-10-07 — SAC, tela de chamado do RCA]]

Veja também [[REPOSIÇÕES E CHAMADOS]], [[Glossário WinThor]], [[GESTÃO TI]], [[Mapa de sistemas]].
