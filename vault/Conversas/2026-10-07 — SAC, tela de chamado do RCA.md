---
tipo: conversa
data: 2026-10-07
projeto: "[[SAC]]"
departamento: Comercial
status: resumido
tags: [conversa, sac, chamados, rca, email]
---
# 2026-10-07 — SAC, tela de chamado do RCA

## Resumo
O Júlio quer um **sistema de chamados** chamado **SAC** e pediu para começar pela **tela**: o RCA preenche NF,
motivo, detalhe, código e nome do produto, até 3 fotos comprobatórias (produto ou NF) e o próprio e-mail; o
sistema manda para esse e-mail um comprovante formatado "igual o sistema de cobrança da TI, mas com design
melhor". Veio com um rascunho à mão (SAC → formulário → e-mail; "motivos WinThor" no motivo; "detalhe" abaixo).
O Claude construiu a tela e o e-mail em `Desktop\BI\10. SAC` (então `10. SAQ`), testou de ponta a ponta em modo
prévia (nada foi enviado) e deixou a publicação para depois das decisões abaixo. Detalhes em [[SAC]].

**Situação em 2026-10-09 (assunto em andamento):** publicado em 2026-10-07 (~17:45), funcionando desde 2026-10-09
(~09:33, depois das senhas) e com o nome corrigido para SAC. Falta o **primeiro envio real**. Desde ~10:48 está
**em andamento** (não commitado nem publicado) a **conferência da NF**: só NF emitida até 1 mês atrás, pela tabela
nova `core.dim_nf_saida` do [[BI COMERCIAL]] — ver o Histórico em [[SAC]].

## Decisões
- 2026-10-07 (Júlio): sistema de chamados, começando pela fase 1 = só a tela e o e-mail. Nesse dia o sistema foi
  registrado como **SAQ**; em 2026-10-09 o Júlio corrigiu: o nome é **SAC** (ver a terceira rodada).
- 2026-10-07 (Júlio): o e-mail vai **para o próprio RCA**, no endereço que ele digitar.
- 2026-10-07 (Claude, a confirmar): o motivo usa os 9 assuntos **"SAC - ..."** do WinThor (65 a 73), e não os
  ~60 assuntos do `PCMANASSUNTO`. A família SAC foi criada em set/out para isso; o resto é logística, fiscal e
  transportadora. O código do assunto vai no e-mail.
- 2026-10-07 (Claude, a confirmar): **pelo menos 1 foto** é obrigatória ("comprobatória"); detalhe com no mínimo 15 caracteres.
- 2026-10-07 (Claude): o **código do produto completa o nome** pelo cadastro do WinThor no DATA WAREHOUSE, e dá
  para buscar pelo nome. Não estava no pedido, mas evita o RCA digitar o nome errado; sem banco, a tela não trava.
- 2026-10-07 (Claude): visual pelo padrão da casa ([[Como eu gosto dos BIs]]): cara do Gestão TI, logo em placa
  branca, Archivo / IBM Plex Sans 500 / JetBrains Mono. A primeira versão tinha a logo solta no fundo escuro e
  texto em Archivo 400 — corrigido ao reler a preferência.
- 2026-10-07 (Claude): recomendou cadastrar o IMAP do `sac@`, para cada chamado ficar em Enviados — o registro dos
  chamados enquanto não há banco.
- 2026-10-07 (Claude): repositório **público**, como REPOSIÇÕES e COMPRAS: no plano Hobby o privado trava o deploy
  (`BLOCKED`); o código não tem senha.
- 2026-10-07 (Claude): as senhas na Vercel quem cadastra é o Júlio (Sensitive); o Claude não manipula senha e
  confere só os nomes das variáveis.
- 2026-10-07 (Claude): o atalho do portal só seria publicado depois de o SAC funcionar com as senhas, para o botão
  não levar a um sistema pela metade.
- 2026-10-09 (Claude): o **primeiro envio real** é do Júlio, com um RCA avisado — o teste manda e-mail para um RCA.
- 2026-10-09 (Claude): na troca de nome, trocar tudo de uma vez (ainda não estava em uso); onde só trocar a letra
  ficaria estranho ("SAC registrado", "Enviar SAC"), usar "chamado". O endereço antigo continua redirecionando.
- 2026-10-09 (Júlio): o SAC só aceita **NF emitida até 1 mês atrás** (mês de calendário: emitida em 09/09 vale até
  09/10); nota cancelada ou que não existe também não abre chamado. Implementação em andamento.

## Como foi conferido
- Celular (375 px) e computador no navegador do app: validação campo a campo, motivo, código 642 →
  "MAIONESE 200GR SACHE HELLMANS", busca "maionese hellm", 2 fotos de 3000×4000 reduzidas para 55 KB e 189 KB,
  envio, tela de sucesso, "Abrir outro chamado" mantendo o e-mail.
- E-mail aberto pela prévia: selo, protocolo, andamento, motivo com código, tabela, detalhe e fotos. O `.eml`
  traz cada foto embutida e anexa.
- 14 testes da API passaram: método errado, corpo inválido, e-mail com quebra de linha (injeção de cabeçalho),
  dois e-mails, motivo fora da lista, detalhe curto, sem foto, 4 fotos, texto disfarçado de JPEG, HTML no
  detalhe (sai escapado), produção sem SMTP (dá 502, nunca "enviado"), protocolo sem repetição.

## Erros pegos no teste
- A lista de sugestões do produto ficava **por baixo** do bloco seguinte (cada bloco com desfoque cria a própria
  camada). O bloco em uso agora fica por cima.
- O ícone da câmera sumia no quadro de foto em tela de celular (o conteúdo não cabia e o ícone encolhia a zero).
- Protocolo com 4 caracteres repetiu 1 vez em 2.000 gerações no mesmo dia; passou para 5.
- O e-mail quebrava no meio ("cpd / @lube.com.br") na tela de sucesso.
- De quebra, o tamanho de cada foto passou a aparecer no quadro.

## Outros tropeços (2026-10-07)
- Consulta a `reposicao.chamado` falhou: a tabela não existe; o certo é `reposicao.fato_chamado`.
- Uma edição do `_correio.js` quebrou a regex que tira quebra de linha do nome do remetente (o `\r\n` virou quebra
  de linha de verdade); consertado na hora.
- `gh` e `vercel` (linha de comando) não estão instalados nesta máquina: a publicação foi pelo conector da Vercel e
  pela API do GitHub.
- Criar o repositório na "organização" `Lube-Distribuidora-LTDA` deu "Not Found": no GitHub ela é **conta de
  usuário**; o repositório foi criado em `/user/repos`.
- O projeto da Vercel foi criado **antes** do repositório, então não ficou ligado ao Git; todo deploy é pela API.

## O que foi criado ou mudou
- [[SAC]]: nota nova do projeto.
- `Desktop\BI\10. SAC`: tela, API, e-mail, servidor local e README.
- `.claude/launch.json` do cérebro: configuração "sac" (porta 3110).
- [[Glossário WinThor]]: colunas do `PCMANASSUNTO` e a família de assuntos SAC.
- [[Mapa de sistemas]] e [[CLAUDE.md|CLAUDE]]: SAC na lista.
- [[BI COMERCIAL]]: `core.dim_rca` com `email`, `email2`, `bloqueio`, `dttermino` (migração `dim_rca_email`) e, em
  2026-10-09, a tabela nova `core.dim_nf_saida` (migração `dim_nf_saida`, em andamento).
- [[PAINEL LUBE DISTRIBUIDORA]]: atalho "SAC · Abrir chamado" na tela de login (`7529c25`, `913476c`).
- [[SENTINELA LUBE]]: 9º sistema, com `exige_login = false`.
- [[Vercel]] e [[Locaweb]]: projeto `sac-lube` e a caixa `sac@lube.com.br`.

## Segunda rodada — e-mail "do próprio RCA" e acesso sem login
O Júlio respondeu: (1) todo RCA deve enviar "através do próprio e-mail dele, como se ele mesmo estivesse
enviando para ele"; (2) o SAC tem que estar **na tela de login do Painel Lube**, para os RCAs não precisarem
entrar no portal.

- **O que o WinThor mostrou:** dos 128 RCAs ativos, 55 usam Gmail, 24 Hotmail, só 17 `@lube.com.br`; 20 sem
  e-mail e 7 com e-mail digitado errado. DMARC: Gmail e Hotmail `p=none` (mas jogam no spam o "@gmail.com" que
  não saiu do Google), Yahoo `p=reject`.
- **Como ficou o ponto 1:** remetente com o **nome** do RCA, para o e-mail dele, resposta para ele. O
  **endereço** do remetente continua sendo uma caixa da Lube: sair "de fulano@gmail.com" por outro servidor é
  falsificação de remetente e não chega; sair da caixa do RCA exigiria a senha dele. Explicado ao Júlio.
- **Como ficou o ponto 2:** cartão "SAC · Abrir chamado" abaixo do botão Entrar do portal (aparece sem
  rolar num celular de 812 px), levando a `sac-lube.vercel.app`. O SAC fica sem "exige login".
- **Consequência de ser público, tratada:** a tela só manda para e-mail de **RCA ativo no WinThor**. Para isso o
  `core.dim_rca` ganhou `email`, `email2`, `bloqueio`, `dttermino` — estendendo a consulta do **dono** (ETL do
  COMERCIAL), como manda o [[data-warehouse]]. Migração aplicada, carga avulsa às 16:31 conferida no
  `controle_carga`. O e-mail virou o **passo 01** da tela: o RCA vê "✓ RCA 9 · Nome" antes de preencher o resto,
  e quem não está no cadastro descobre logo, não depois de tirar as fotos.
- **Testes:** 12 contra o banco real (só leitura, modo prévia): RCA ativo reconhecido, e-mail de fora recusado,
  RCA desligado recusado, injeção de cabeçalho recusada, remetente com o nome do RCA, `To` e `Reply-To` = RCA,
  banco fora → nada sai. Tela testada no celular: e-mail de fora barrado, e-mail de RCA reconhecido, e-mail
  "Olá, Marcelo!". As prévias com dado de RCA foram apagadas.
- **Achado de passagem:** `C:\BI\COMERCIAL\bi_comum.py` está mais velho que o da rede (ver [[BI COMERCIAL]]).

## Terceira rodada (2026-10-09) — o nome é SAC, não SAQ
O Júlio corrigiu: o sistema se chama **SAC**. Como ainda não estava em uso, tudo foi trocado de uma vez:
tela ("SAC", "Abrir chamado", "Enviar chamado", "Chamado registrado"), e-mail ("[SAC-…] Chamado registrado"),
protocolo `SAC-AAMMDD-XXXXX`, variáveis `SAC_*`, repositório renomeado no GitHub (`SAQ` → `SAC`), projeto na
Vercel (`saq-lube` → `sac-lube`, mesmo id) com o endereço novo `sac-lube.vercel.app` (o antigo redireciona 308
pelo `vercel.json`), linha da Sentinela atualizada junto com o nome do projeto (a central acha o sistema pelo
**nome** e confere o id; ação `sistema_renomeado`), atalho do portal ("SAC · Abrir chamado"), pasta
`Desktop\BI\10. SAC`, `launch.json` e as notas do cérebro (nota do projeto agora é [[SAC]]). Os 12 testes passaram
de novo com os nomes novos.

Commits: no SAC, `8cc213d` (troca do nome, 09:43) e `f050e2b` (redirecionamento do endereço antigo, 09:44, hoje em
produção); no [[PAINEL LUBE DISTRIBUIDORA]], `913476c` (atalho "SAC", 09:46). Nos comentários do ETL do
[[BI COMERCIAL]] (`consultas_comercial.py` e `web/db/07-dim-rca-email.sql`) a troca foi feita mas **ainda não foi
commitada**.

## Quarta rodada (2026-10-09) — NF de até 1 mês e atualização automática
O Júlio pediu: (1) ao digitar a NF, buscar no WinThor e **recusar nota emitida há mais de 1 mês**; (2) que a lista
de e-mails dos RCAs se atualize sozinha, sem ninguém rodar consulta.

- **(2) já era automático:** o `dim_rca` (com o e-mail) é recarregado pela carga agendada do COMERCIAL 8 vezes por
  dia; corrigiu o e-mail no WinThor, em até ~1 h o SAC aceita. Conferido: 125 → 127 RCAs ativos com e-mail entre
  07/10 e 09/10 sem ninguém mexer.
- **(1):** a Vercel não alcança o Oracle, então a capa das notas (`PCNFSAID`) foi para o banco na mesma carga
  automática: `core.dim_nf_saida` (45 dias, upsert por `NUMTRANSVENDA`, dona: ETL do COMERCIAL, como manda o
  [[data-warehouse]]). O SAC confere ao digitar e de novo no envio; mostra emissão e cliente; recusa mais de 1 mês
  (mês de calendário), cancelada e não encontrada. Achado: o número da NF se repete entre filiais (4.668 em 400
  dias; 3 na janela de 45) — vale a não cancelada, a do próprio RCA, a mais recente.
- **Testes:** 9 da regra (inclusive o limite: emitida exatamente há 1 mês ainda passa) + os 12 anteriores, e no ar.
- **No meio do caminho:** a carga do COMERCIAL tinha ido para a VM `SRV-IA` hoje (registro da outra sessão). A
  consulta nova estava só na rede e nesta máquina; o arquivo foi copiado para a VM às 10:56, depois de conferir que
  era a única diferença. A carga avulsa das 10:49 saiu desta máquina (sem a tranca), antes de saber disso — mexeu só
  na tabela nova. **A primeira carga agendada com a NF é a das 12:45 — conferir no `controle_carga`.**

## Quinta rodada (2026-10-09) — chamado no WinThor e supervisores
O Júlio perguntou: (1) dá para, além do e-mail, **abrir o chamado no WinThor** com o que já existe? (2) os
**supervisores** já estão inclusos?

- **(1)** Levantado no Oracle: chamado = `PCMANIF` + `PCMANIFPROD`, número do `PCCONSUM.PROXNUMMANIF`, sem gatilho;
  o chamado recém-aberto tem poucos campos e o SAC tem quase todos (NF, cliente, filial, RCA, assunto, texto).
  Dá para fazer, mas falta: agente na VM `SRV-IA`, banco dos chamados (fase 2), usuário Oracle de escrita,
  matrícula de abertura, campo de quantidade (todo chamado SAC no WinThor tem quantidade), motorista da NF e um
  teste com o ok do Júlio. Detalhes em [[SAC]].
- **(2)** Não: nenhum dos 21 supervisores ativos tem e-mail na rotina 516; só 1 entra pelo cadastro de RCA.

## Sexta rodada (2026-10-09) — login do SAC e aviso no painel admin
O Júlio pediu login para entrar no SAC, com tela parecida com a do Painel; o "Primeiro acesso" deve notificar o TI
no painel administrativo, numa aba separada da dos usuários do painel corporativo.

- **Decisão (Claude):** usar a **mesma base de login do Painel**, com as contas em `sac_usuarios` — nunca em
  `profiles` —, para reaproveitar o fluxo que já existe (primeiro acesso pendente, TI libera) sem criar segredo novo
  no SAC. A marca `sistema = 'sac'` vem do navegador, por isso só dá direito a conta **pendente** do SAC.
- **Supervisores** entram escolhendo "Supervisor" no cadastro (o TI confere), o que resolve a pergunta da rodada
  anterior sem depender da rotina 516.
- Feito e publicado: migração `sac_acesso_v1` no Painel (15 testes antes), aba "SAC · externos" no admin, login no
  SAC, API exigindo token, texto do atalho do portal corrigido ("sem login" deixou de ser verdade). Detalhes em [[SAC]].
- **Primeiro teste é do Júlio:** cadastrar uma conta pelo "Primeiro acesso" (pode ser como Supervisor, com um e-mail
  dele), ver o aviso no admin, liberar, entrar e abrir um chamado de verdade.

## Pendências
- [x] Caixa por onde o SAC sai: **`sac@lube.com.br`**, que já existe (Júlio, 2026-10-07). Teste em modo
  prévia: `From: Nome do RCA <sac@lube.com.br>`, `Reply-To` = o RCA.
- [x] Júlio: cadastrar na Vercel a senha do `sac@` e a do DATA WAREHOUSE — feito em 2026-10-09.
- [ ] Júlio: o SAC recebe cópia? Qual endereço.
- [ ] Comercial: corrigir o e-mail dos 27 RCAs no WinThor.
- [ ] Confirmar os motivos (só os SAC) e a foto obrigatória.
- [ ] Teste de envio real, com autorização do Júlio (é o mesmo "primeiro envio real" abaixo).
- [x] "OK pode publicar" (Júlio). SAC **no ar** em `sac-lube.vercel.app` (~17:45; na época `saq-lube`): repositório
  público `Lube-Distribuidora-LTDA/SAC` (criado como `SAQ` pela API do GitHub; descoberto que `Lube-Distribuidora-LTDA` é conta de
  usuário, não organização), projeto `sac-lube` com Root `web` e variáveis sem senha, cadastro na central da
  Sentinela (`exige_login = false`), deploy pela API (READY, não `BLOCKED`). Conferido de fora: página 200,
  `/.sentinela/saude` com OIDC e lista ok, APIs dizendo "falta `SUPABASE_DB_PASSWORD`".
- [x] 2026-10-09: Júlio cadastrou as 3 senhas. Novo deploy (09:33); no ar: produtos 200 (7.287), RCA reconhecido/recusado,
  envio para e-mail de fora recusado (400). Atalho do portal enviado (`7529c25`, READY) e conferido no navegador:
  login → atalho → SAC sem login.
- [ ] Primeiro envio real (SMTP + cópia em Enviados do `sac@`) — com o Júlio e um RCA avisado.
- [ ] Ligar o projeto `sac-lube` ao repositório (Settings › Git) para publicar a cada push.
- [x] Commit do COMERCIAL (consulta + `07-dim-rca-email.sql`) — entrou em 2026-10-08 no commit `bb64f16`. Falta
  commitar a troca de "SAQ" por "SAC" nos comentários (2026-10-09) e a consulta `dim_nf_saida` com o
  `08-dim-nf-saida.sql`.
- [ ] Conferência da NF (em andamento desde 2026-10-09): terminar, testar, commitar e publicar; antes, a
  `core.dim_nf_saida` precisa estar sendo carregada pela `SRV-IA`.
- [ ] Atualizar o README do repositório do SAC, que ainda diz "ainda não publicado".
- [ ] Conferir a carga das 12:45 na `SRV-IA`: `dim_nf_saida` no `comercial.controle_carga`.
- [ ] Commit do COMERCIAL: `consultas_comercial.py`, `07-dim-rca-email.sql` (comentário SAC) e `08-dim-nf-saida.sql`.
- [ ] Júlio: decidir o caminho do chamado no WinThor (usuário de escrita, matrícula de abertura, e-mail antes ou
  depois do número do WinThor) — ver [[SAC]].
- [ ] Comercial: preencher o e-mail dos supervisores na rotina 516 (hoje vazio nos 21 ativos).
- [ ] Fase 2: banco e o sistema de chamados.
