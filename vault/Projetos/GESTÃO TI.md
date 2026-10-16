---
tipo: projeto
departamento: TI
status: ativo
inicio: 2026-09-15
tags: [projeto, ti, notas-fiscais, imap, supabase, vercel]
---
# GESTÃO TI

Sistema que controla o que a TI paga: contratos, notas fiscais, boletos e recibos. Um robô lê a caixa `cpd@lube.com.br`, reconhece os documentos que chegam, prende cada um à competência certa e cobra quem ainda não enviou. Tem dashboard de custo, notas avulsas, chamados, inventário e o [[Gestão TI - Kanban TI|Kanban TI]]. Os chamados nasceram como portal aberto por link; **desde 2026-10-07 só abrem com login do Painel Lube** (decisão do Júlio). Não faz parte do fluxo de BI do [[Mapa de sistemas]]. Criado em 2026-09-15 — ver [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]].

- Repositório: [Lube-Distribuidora-LTDA/Gestao-TI](https://github.com/Lube-Distribuidora-LTDA/Gestao-TI), branch `main` — **público** (situação de 2026-10-08), de propósito: no plano Hobby da Vercel, repositório privado trava o deploy. Já ficou privado duas vezes, e nas duas o deploy travou: em 2026-09-24 (o Júlio voltou a público) e em 2026-10-06. Em 2026-10-06 o GitHub respondia 404 sem login e os deploys pelo Git ficaram `BLOCKED` desde as 08:19; os 6 commits daquele dia (competência que nunca abria, janela do resumo, filtro do mês) só foram ao ar junto com a instalação da [[SENTINELA LUBE]], publicada pela API da Vercel. Desde então o sistema só abre para quem entra pelo [[PAINEL LUBE DISTRIBUIDORA]] (desde 2026-10-07, inclusive abrir/acompanhar chamado; o robô entra pelo `CRON_SECRET`). Em **2026-10-08** o repositório já estava **público de novo** (o GitHub responde 200 sem login): o Kanban, travado em `BLOCKED` na noite de 07/10, foi ao ar pelo Git com o commit `9a866cc` às 08:14.
- Pasta local: `Desktop\BI\5. GESTÃO TI`
- Next.js 15 (App Router, TypeScript) + Tailwind v4 · [[Supabase]] `gestao-ti` (`mpupmrzcbygwpblrewrb`, sa-east-1, US$ 10/mês) · deploy na [[Vercel]] (projeto `gestao-ti`, plano Hobby, funções na região `gru1`, ao lado do banco)
- No ar: https://gestao-ti-ruddy.vercel.app
- Tema azul escuro da Lube, o mesmo do [[PAINEL LUBE DISTRIBUIDORA]], que dá acesso a ele

## Como funciona
- **Fornecedor → contrato → competência.** Cada contrato gera uma competência por mês; o documento que chega se prende a ela.
- **O robô lê o e-mail** por IMAP na [[Locaweb]], reconhece nota fiscal, boleto e recibo pelo nome do arquivo e pelo assunto, e lê valor, vencimento e **competência de dentro do documento** — XML da NFS-e, texto do PDF com o rótulo colado ao número, ou linha digitável do boleto com o dígito verificador conferido. Melhor campo vazio que número errado: não há chute. Quando não dá para ficar vazio, a fatura diz que a data é estimada.
- **Cobrança automática** por e-mail, assinada como "Assistente Virtual TI", com cópia guardada em Enviados.
- **Cobrança por WhatsApp** para quem não responde e-mail: o botão abre a conversa com a mensagem já escrita, e esses fornecedores saem da cobrança automática.
- **Exportação em Excel** com a marca da Lube e os filtros escritos na planilha.
- **Alerta antes de vencer, em degraus:** atenção (entrou o mês), urgente (14 dias ou menos), hoje e vencida, as duas últimas piscando. O cálculo mora num lugar só (`alertaVencimento`), para o dashboard e a lista nunca discordarem.
- **Faturas e notas abre no mês atual** (do dia 1º ao último) mais o que está atrasado e em aberto. Outro período, pelo seletor de mês de vencimento.
- **Fim do fluxo é "Assinado e entregue"** à contabilidade, não "pago": a TI confere, o Sergio assina e a contabilidade recebe; quem paga é o financeiro.
- **Notas avulsas:** serviço fora dos contratos é lançado à mão, com anexo, e entra no custo do departamento.
- **Link do portal:** para quem não manda anexo (a SAAM, pela ContaAzul), o robô guarda o link do e-mail como documento, e ele vale por nota e boleto.
- **Recibo e débito automático:** as assinaturas de IA não têm nota nem boleto, só recibo, e não vencem — têm dia de débito (24).

## Kanban TI
Quadro dos **problemas internos do setor**, em Infraestrutura › Kanban TI, desde 2026-10-07. Não se mistura com chamados: lá o usuário abre pedido pelo portal, aqui é a TI organizando o que precisa resolver. Colunas e regras em [[Gestão TI - Kanban TI]].

## Segurança
O navegador nunca fala com o banco: tudo passa por rotas `/api` com `service_role`, e o RLS está ligado sem nenhuma política, com os privilégios de `anon` e `authenticated` revogados. A sessão é um cookie assinado em HMAC (`gti_sessao`), validado no Edge; o Supabase Auth guarda só a senha. Diferente dos outros sistemas da Lube, onde o navegador costuma acessar o Supabase direto.

- **A única exceção ao `anon` revogado** (desde 2026-10-14): a RPC `public.saude_robo()`, executável por `anon` e
  `service_role`, para o [[GUARDIÃO DA LUBE]] saber se a leitura das 08:00 e a cobrança das 09:00 rodaram. Ela devolve
  **só** tipo, início, fim, sucesso e contagens (e-mails lidos, documentos vinculados, cobranças enviadas, falhas,
  e-mails que ficaram para a próxima leitura) das execuções do robô nas últimas 48 h — **sem o texto de erro e sem os
  itens**, que citam fornecedores e e-mails. A função `guardiao` (no DATA WAREHOUSE) chama com a **chave publicável**,
  para a chave de serviço do Gestão TI não ir para outro projeto. O `anon` continua sem ler a tabela
  `robo_execucoes` direto, e o `authenticated` não executa a função (conferido em 2026-10-14). Migração `saude_robo`,
  versionada no repositório do Guardião (`Desktop\BI\12. GUARDIAO\db\02_gestao_ti_saude_robo.sql`), não em
  `supabase/migrations/` deste.

- **Sentinela na porta** desde 2026-10-06, dentro do `src/middleware.ts`, em modo fechado ([[SENTINELA LUBE]]). Desde 2026-10-07 **nenhuma rota fica aberta**, nem abrir/acompanhar chamado; o link de acompanhamento que vai por e-mail só abre depois do login.
- **O agendador da Vercel entra pelo segredo:** em `/api/cron/` o middleware confere `Authorization: Bearer` com o `CRON_SECRET` (comparação em tempo constante, mínimo 16 caracteres). O `?secret=` na URL deixou de valer em 2026-10-07; para rodar fora de hora, use o botão da tela do Robô.
- **A conexão confere o banco:** `supabaseAdmin()` compara o `ref` do JWT com a URL e recusa a combinação errada — a máquina do Júlio tem uma variável do Windows apontando para outro projeto (ver [[Supabase]]).
- **Variáveis** (nomes, nunca valores): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `IMAP_HOST/USER/PASS`, `SMTP_HOST/USER/PASS`, `CRON_SECRET`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. O `scripts/configurar-vercel.mjs` cadastra as do `.env.local` sem mostrar valores e confere no fim; `VERCEL_OIDC_TOKEN` nunca vai fixo.
- **Antes de publicar tela**, `scripts/testar-painel.mjs` abre cada página logada procurando exceção — `tsc` e build não pegam erro de renderização.

## Fornecedor inativo encerra o contrato
Marcar o fornecedor como **INATIVO** é como se encerra um contrato aqui. Desde 2026-10-13 ele some do painel de notas, dos alertas do dashboard e do resumo do Telegram, e **nenhuma competência nova é aberta** para ele.

**Cuidado:** o estado do fornecedor e o da conta são campos **independentes** — inativar o fornecedor não inativa as contas dele. Foi assim que a Data R Informática, inativa, continuou com fatura de outubro: a conta ficou ativa e tudo olhava só `contas.ativo`.

O histórico fica: as faturas continuam no banco, alcançáveis com `?inativos=1`.

## Regras que o sistema aprendeu
Estão explicadas em [[Notas, boletos e recibos]]. Em resumo:
- a competência sai primeiro **do que o documento declara**, depois do e-mail, e só por último do mês de chegada — e nunca do vencimento;
- a distância entre competência e vencimento **muda por fornecedor**: a Itanet cobra no mês seguinte, a SAAM no mesmo mês. Sem documento que informe a data, o sistema aprende essa distância do histórico da própria conta;
- vencimento calculado por nós **se identifica como estimativa** na observação da fatura;
- documento repetido não vira segunda fatura — vale o primeiro envio;
- assinatura de IA não vence: tem **dia de débito**, e só o recibo do ciclo atual entra;
- "Assinado e entregue" encerra a fatura como "paga" — nunca é atraso;
- documento que não declara competência (a 2ª via da Itanet) **reencontra a fatura pelo vencimento exato**, desde que só uma fatura da conta tenha aquela data — nunca deduz um mês;
- **o nome do arquivo decide** se é nota ou boleto; o assunto só entra quando o nome não diz nada. Quando o assunto cita os dois ("nf+bol") e outro anexo já é boleto pelo nome, o que sobrou é a nota;
- **o texto do e-mail manda no vencimento**; o dia do contrato é só o palpite de quando nada foi informado;
- e-mail sem pista de cobrança no assunto ou no anexo (relatório, print de chamado, proposta) fica registrado como **não fiscal** e não se prende a fatura nenhuma;
- palavra-chave de contrato tem no mínimo 4 letras, a mais longa pesa mais, e `!termo` descarta a conta — é o que separa os três contratos da Print Solução.

## Fornecedores que o robô não alcança
O robô só captura o que chega **em anexo** na caixa `cpd@`. Ficam de fora:

| Fornecedor | Por quê |
|---|---|
| PC Winthor (TOTVS) | Manda só link do portal, que exige login. Cliente **TB1900**, emitente Soluções em Software e Serviços TTS, CNPJ 07.363.764/0004-33 |
| ION Sistemas | Não manda nota por e-mail desde 2019 |
| Google IA Pro | Recibo vai para `cpd.lube@gmail.com`, caixa que o robô não lê |
| ChatGPT e Supabase | Recibos não chegam no `cpd@` — conferir o billing |
| IMPREMIX | Chega normal, mas só foi cadastrada em 09/2026: o que é anterior a isso o robô nunca viu, porque a varredura só olha os últimos dias |
| Alterdata e Top Link Rio | Lista de remetentes **vazia** no cadastro (achado em 2026-10-06): o robô nem olha os e-mails delas. O boleto da Alterdata vem de `smtperp@alterdata.com.br` |
| Dinâmica Telecom | Nada chegou em 45 dias no `cpd@`. Em 2026-10-06 o Júlio subiu o documento à mão |

A **SAAM** saiu desta lista em 09/2026: a conta ganhou a marcação "documento via link" e o robô passa a guardar o próprio link do portal como documento. O link resolve nota e boleto de uma vez — mas data, valor e competência continuam só lá dentro.

Omie e ContaAzul disparam de um endereço só em nome de vários clientes. Para esses domínios o robô **exige** confirmação pelo nome ou pelo contexto, mesmo quando só há um fornecedor cadastrado ali: sem isso, uma nota da ION Labs quase entrou na fatura da SAAM.

### Fora do escopo, não "não alcançado"
A **e-Auditoria** (CNPJ 10.750.188/0001-49, software fiscal) cobra em `fiscal@lube.com.br` e disponibiliza o boleto em `conta.e-auditoria.com.br`. **Não é despesa de TI** — confirmado pelo Júlio em 2026-10-02 — e por isso não entra neste sistema. Fica registrado aqui só para ninguém refazer a investigação quando o papel aparecer de novo no CPD.

## Quando o robô roda
Todo dia às 08:00 (leitura) e 09:00 (cobrança). Detalhes e limites em [[Gestão TI - Leitura de e-mail e cobrança]].

No fim da rodada das 09:00 sai também o **resumo no Telegram** do que vence, do que chegou e de quem ainda deve documento — ver [[Gestão TI - Resumo diário no Telegram]]. Não tem agendamento próprio porque o plano Hobby só permite dois.

## Custo
**26 contas ativas, R$ 53.397,42/mês previstos** (2026-10-06, na geração de outubro). Em 2026-09-23 eram 25 e R$ 51.072,42. Na carga inicial (2026-09-15) eram 22 fornecedores e 24 contas, **R$ 43.227,37 — igual, centavo por centavo, à planilha de controle do dono**, que é a referência dos valores de TI.

## Achados que valem lembrar
- **A abertura automática de competências nunca funcionou** — descoberto em 2026-10-06, com o sistema no ar havia semanas. Eram 26 contas ativas e 4 faturas de outubro, as quatro criadas pelo robô ao receber documento. Duas causas em sequência: `null` explícito sobrescrevendo o DEFAULT da função no banco, e depois o vencimento calculado sempre dentro do mês da competência, o que só vale para parte das contas. O erro acontecia **todo dia sem aparecer**, porque a rota de cobrança tinha um `catch` vazio em volta da chamada. Arquivos 12 e 13 do repositório (no banco, `competencia_nula_vira_mes_corrente` e `competencia_respeita_distancia_da_conta`).
- **`entregue_por` nunca é gravado** (achado em 2026-10-06): as 35 faturas entregues estavam com o campo vazio. O painel sabe **quando** foi entregue, não **quem** marcou.
- **O repositório não recria o banco sozinho.** As migrações do banco de 2026-09-15 e 16 que fazem a exclusão em cascata, as notas avulsas e as colunas `valor_bruto`, `entregue_em` e `entregue_por` nunca foram exportadas para `supabase/migrations/`. Ver "Banco: migrações" abaixo.
- **Cinco boletos falsos** circularam imitando Vivo, Unimed, Hapvida, AMIL e Locaweb, de domínios como `tivois.store` e `uni.medplano.store`. O sistema os rejeita porque só aceita remetente cadastrado; uma pessoa, não.
- **Itanet:** o boleto vem com um mês de antecedência, então o mês do e-mail nunca é o do vencimento. Em 2026-09-17 o título de 10/09 seguia em aberto na operadora, com comunicado de suspensão de 14/09 (até 2026-10-09 esta nota dizia "está em aberto", como se fosse a situação de hoje).
- **Itanet manda de dois endereços**, e eles querem dizer coisas diferentes: `nfscorporativos-no-reply@` ("SUA FATURA ITANET FOI EMITIDA") traz a nota e o boleto do **mês que acabou de fechar**, sempre no dia 1º; `envioboletos-no-reply@` ("ITANET CONECTA - 2ª VIA FATURA") reenvia o boleto de um ciclo já aberto e **não traz competência nenhuma**. Confundir os dois foi o que, mês após mês, pôs o documento de um ciclo na fatura do seguinte (corrigido em 2026-10-05).
- **SAAM:** os e-mails da ContaAzul **não trazem data, valor nem competência** — só o link do portal. Tudo o que aparece no painel para essa conta é estimado até alguém abrir o link e conferir. A conta soma **duas empresas** que cobram pelo mesmo portal: SISAUDCON (CNPJ 14.153.062/0001-48) e NB Technology (CNPJ 43.961.100/0001-97). O portal também **reemite vencimento** sem avisar — agosto foi de 15/08 para 20/08, setembro de 15/09 para 28/09.
- **Firewall Matriz:** planilha do dono diz R$ 2.500,00, a NF 934 diz R$ 1.000,00 e o boleto R$ 938,50. Resolvido pelo Júlio em 2026-09-16.
- **Firewall — Rio** foi excluído por engano e **não havia backup**. Em 2026-09-17 foi refeito a partir das notas na caixa (NF 896, 909, 922, 936; nota R$ 750,00, boleto R$ 703,87, dia 15, palavra-chave "LUBE RJ"). Excluir fornecedor ou conta leva o histórico junto, sem volta.
- **Mais Dados / INTELI+** são duas empresas do mesmo grupo, faturando pelo mesmo e-mail: a Mais Dados (PA Computadores) cobra a manutenção do Oracle (mês vencido) e a INTELI+ o backup em nuvem (antecipado). Mandam nota e boleto todo mês desde jul/2025.
- **Kaizen** emite pelo Omie e o financeiro reencaminha à mão semanas depois — foi o caso que criou a regra do "vale o primeiro envio".

## Pendências
- [ ] **Cadastrar os remetentes da Alterdata e da Top Link Rio.** As duas estão com a lista **vazia**, então o robô nunca olha os e-mails delas — o boleto da Alterdata ficou na caixa desde 18/09 e acabou subindo à mão
- [ ] **Dinâmica Telecom**: nada chegou em 45 dias na caixa do `cpd@`, nem buscando o nome solto. Em 2026-10-06 o Júlio subiu o documento à mão; falta descobrir por onde ela manda
- [ ] Atualizar `scripts/testar-painel.mjs`: as três telas que eram públicas (`/login`, `/abrir-chamado`, `/acompanhar`) acusam falha com 302 desde a Sentinela, que é o comportamento certo agora
- [ ] Avaliar migrar o resumo diário para o **WhatsApp** (API oficial da Meta) — ver [[Gestão TI - Resumo diário no Telegram]]
- [ ] Decidir se dar **baixa de pagamento** vira rotina no painel. Hoje quase nada tem `pago_em`, então o sistema não sabe o que foi pago — só o que foi entregue
- [ ] **Avaliar separar a SAAM em duas contas** (SISAUDCON e NB Technology). Hoje é uma conta só, e as duas já divergiram em data — em setembro a SISAUDCON foi reemitida para 28/09 e a NB Technology ficou em 15/09. A fatura tem um campo de vencimento só, então a segunda data vive na observação
- [ ] Conferir se a parcela SISAUDCON de setembro (R$ 1.203,52) foi paga — em 24/09 estava vencida, com juros correndo
- [ ] Avisar o financeiro dos cinco boletos falsos
- [x] Reativar a cobrança automática — **ligada**, pelo menos desde 2026-10-06: o Júlio escolheu gerar as faturas de outubro com a cobrança ativa, sabendo que 8 fornecedores entrariam na fila no dia seguinte (desligada desde a carga inicial de 2026-09-15; o dia exato em que a chave global voltou não ficou registrado)
- [ ] Encaminhamento do `cpd.lube@gmail.com` para o `cpd@`
- [ ] Pedir nota e boleto em anexo à TOTVS (e incluir o `cpd@` no envio); baixar a nota 68679 / RPS 000068739 pelo portal, que exige login — Júlio
- [ ] Trocar as senhas de e-mail e não repetir a mesma em contas diferentes (`cpd@` e `lube@` usam a mesma)
- [ ] **Exportar para `supabase/migrations/` as migrações do banco que faltam** (cascata do fornecedor, `valor_bruto`, notas avulsas, `entregue_em`/`entregue_por`, custo com avulsas) — sem elas o banco não se recria pelo repositório
- [ ] Preencher o dia de vencimento das contas que ficaram no **dia 10 provisório** na carga inicial: Alterdata, ION, PC Winthor, Ponto Mais, Manager, Dinâmica, Top Link, Print Help, Data R e as duas Microsoft — Júlio
- [ ] **ION Sistemas** (R$ 7.805,30): sem documento, e a cobrança automática deve sair sem resposta
- [ ] Avaliar **desligar a cobrança automática** de Vix, Kaizen e ION, cujo documento já existe ou que nunca respondem — o Claude ofereceu em 2026-10-06, sem resposta registrada
- [ ] PC Winthor só manda link de portal com login: candidato a **cobrança por WhatsApp** — Júlio
- [ ] Conferir no billing da OpenAI e do Supabase para qual e-mail vão os recibos — não chegam no `cpd@`
- [ ] Opcional: passar a gravar **quem** marca "assinado e entregue" (`entregue_por`)
- [ ] Disparar uma cobrança de teste pela tela para ver a faixa "Assistente Virtual TI" num cliente de e-mail de verdade — Júlio
- [ ] Atualizar para o **Next 16** com calma, para fechar os avisos de segurança que sobraram (next moderado, postcss alto) — Claude, quando o Júlio pedir
- [ ] Conferir com o financeiro se a **Itanet de 10/09** (R$ 129,99) foi paga — a operadora dizia que não e ameaçou suspender — Júlio
- [ ] Conferir se o **recibo do Claude de 24/09** entrou sozinho pela janela do débito. Seria a primeira prova real da regra de 2026-09-17, e não há registro de que alguém tenha olhado
- [ ] A Print Solução chama o boleto de `LUBE NF 934.pdf`: o nome engana a regra "o nome do arquivo decide". Conferir na tela se ficou como **Boleto** e reclassificar à mão se preciso (pendência de 2026-09-15) — Júlio

### Repositório privado: resolvido como "não"
Era pendência, e virou decisão. No plano **Hobby da Vercel, repositório privado trava o deploy** ("BLOCKED"): a plataforma passa a exigir que o autor do commit seja verificado como dono da conta. Em 09/2026 isso derrubou dois deploys seguidos e o diagnóstico demorou, porque o CLI só dizia "UNKNOWN" — quem conta a verdade é a API de deployment. O repositório voltou a ser público (Júlio, 2026-09-24) e os deploys normalizaram. Para fechá-lo seria preciso plano pago — ou cadastrar `cpd@lube.com.br` como e-mail secundário verificado na conta da Vercel. Em 2026-10-06 ele voltou a ficar privado e travou de novo; em 2026-10-08 estava público. Ver [[Vercel]] e [[2026-09-23 — SAAM pelo link do portal e o deploy travado]].

Quando um deploy fica `BLOCKED` e não vem a segunda tentativa `READY` de costume, **um commit vazio** gera um deploy novo (a Vercel recusa reprocessar o bloqueado). Para saber se uma mudança entrou, compare o commit do deploy de produção com a `main` — "respondeu 200" não prova nada.

## Banco: migrações
O banco tem **24 migrações**; o repositório tem **14 arquivos** em `supabase/migrations/`, **com outra numeração**. "Migração 12" no repositório não é a 12 do banco. Conferido em 2026-10-09.

| No banco | Data | Arquivo no repositório | O que faz |
|---|---|---|---|
| `01_core_cadastros` a `07_hardening_seguranca` | 2026-09-15 | 01 a 07 | cadastros, chamados, tabelas do robô, ativos, views, RLS, bucket privado, 8 categorias, perfis, paleta das categorias, fechamento da chave pública |
| `08_funcao_temporaria_exportar_migrations`, `09_remover_...` | 2026-09-15 | — | função temporária para exportar o histórico, removida em seguida |
| `10_view_faturas_expoe_precisa_revisao` | 2026-09-15 | — (a view do arquivo 08 já traz a coluna) | `precisa_revisao` na `vw_faturas_detalhe`, de que o filtro "A conferir" depende |
| `11_excluir_fornecedor_em_cascata` | 2026-09-15 | **falta** | `contas.fornecedor_id` com ON DELETE CASCADE (no arquivo 01 ainda é RESTRICT) |
| `12_valor_bruto_status_contabilidade_notas_avulsas` | 2026-09-16 | **falta** (o valor do enum entrou no arquivo 08) | `faturas.valor_bruto` e status `entregue_contabilidade` |
| `13_notas_avulsas_e_migracao_status` | 2026-09-16 | **falta** | tabela `notas_avulsas`, `entregue_em`/`entregue_por`; 11 faturas "paga" viraram "entregue" |
| `14_custos_incluem_notas_avulsas` | 2026-09-16 | **falta** | custo do departamento soma as notas avulsas |
| `entregue_contabilidade_quita_a_fatura` | 2026-09-16 | 08 | "assinado e entregue" encerra a fatura na view |
| `canal_de_cobranca_por_fornecedor` + `canal_cobranca_na_view_de_faturas` | 2026-09-16 | 09 | canal e-mail/WhatsApp por fornecedor |
| `recibo_e_pagamento_automatico` + `view_com_recibo_e_pagamento_automatico` | 2026-09-17 | 10 | tipo `recibo`, `exige_recibo`, `pagamento_automatico` |
| `documento_via_link_do_portal` + `documento_via_link_na_view_de_faturas` | 2026-09-24 | 11 | tipo `link_portal`, `documento_via_link`, `url_externa` |
| `competencia_nula_vira_mes_corrente` | 2026-10-06 | 12 | `coalesce` do `null` em `gerar_faturas_competencia` |
| `competencia_respeita_distancia_da_conta` | 2026-10-06 | 13 | a função aprende do histórico a distância competência→vencimento |
| `kanban_ti` | 2026-10-07 | 14 | `kanban_colunas` e `kanban_cartoes` |
| `saude_robo` | 2026-10-14 | — (está no repositório do Guardião: `db/02_gestao_ti_saude_robo.sql`) | RPC `public.saude_robo()` para o [[GUARDIÃO DA LUBE]], executável por `anon`, só contagens |

Tabelas em 2026-10-09: categorias_custo, fornecedores, contas, faturas, documentos, cobrancas, chamados, chamado_mensagens, emails_processados, robo_execucoes, ativos, configuracoes, perfis, notas_avulsas, kanban_colunas, kanban_cartoes — todas com RLS ligado.

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-14** — RPC `public.saude_robo()` liberada a `anon` (a única exceção ao "anon revogado"), só com tipo, horários, sucesso e contagens do robô em 48 h, sem texto de erro, para o [[GUARDIÃO DA LUBE]] vigiar a leitura e a cobrança; nada mudou no código nem na Vercel (Claude; migração `saude_robo`, arquivo no repositório do Guardião). Primeira leitura real: "Leitura às 08:29 OK (332 e-mails lidos, 1 documento novo) · cobrança às 09:27 OK (nenhuma cobrança a enviar)" · [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-08** — Kanban no ar: commit vazio destravou o deploy `BLOCKED` do dia anterior; conferido pelo commit do deploy de produção e pelas rotas `/kanban` e `/api/kanban` no build (commit `9a866cc`) · [[2026-10-07 — Kanban TI e o mês que nunca abria]]
- **2026-10-07** — Kanban TI: quadro dos problemas internos, colunas como dados, arrastar nativo, faixa no dashboard; `useAviso` estabilizado (o laço fazia 465 chamadas) (commit `11297c7`, migração `kanban_ti`) · [[2026-10-07 — Kanban TI e o mês que nunca abria]]
- **2026-10-07** — Chamados só com login do Painel Lube (Júlio); agendador da Vercel entra só com o `CRON_SECRET` no cabeçalho, `?secret=` deixou de valer; guarda 1.1.0. Publicado pela API porque o Git estava `BLOCKED` (commits `1dcbea0`, `418840c`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Guarda da Sentinela no `src/middleware.ts`, modo fechado; "exige login" ligado, com chamados (o Júlio quis abertos para quem não tem conta) e `/api/cron/` ainda abertos. Publicado pela API junto com os 6 commits presos do dia (commits `be1c78e`, `0ceac00`, `f7868da`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Filtro padrão de Faturas fecha o mês corrente mais as atrasadas, sem meses futuros (de 35 para 25 linhas); atalho "Só Out/26 (mês atual)" (commits `5fd170c`, `1e78cb6`) · [[2026-10-07 — Kanban TI e o mês que nunca abria]]
- **2026-10-06** — Abertura automática de competências consertada: `null` virava DEFAULT só com `coalesce`, o `catch` vazio passou a devolver o erro, e a função respeita a distância de cada conta (commits `072aa24`, `b1e7f79`, migrações `competencia_nula_vira_mes_corrente` e `competencia_respeita_distancia_da_conta`) · [[2026-10-07 — Kanban TI e o mês que nunca abria]]
- **2026-10-06** — Dados: 22 faturas de outubro geradas com a cobrança ligada (Júlio); 8 que nasceram com a data errada movidas para novembro; Set/26 dos dois firewalls criada; Itanet Out/26 desmarcada de "entregue", que ele não tinha confirmado · [[2026-10-07 — Kanban TI e o mês que nunca abria]]
- **2026-10-06** — Resumo no Telegram avisa com **7 dias** de antecedência (passou por 14 no mesmo dia; para trás, 3) (commits `34678ae`, `f40e639`) · [[2026-10-07 — Kanban TI e o mês que nunca abria]]
- **2026-10-05** — Resumo diário no Telegram no fim da cobrança das 09:00, com `?preview=1` e `?descobrir=1`; `TELEGRAM_BOT_TOKEN` cadastrado pelo Júlio e `TELEGRAM_CHAT_ID` pelo Claude, com o OK dele; sai o total "sem baixa", o status de entrega volta nos dois sentidos (commits `9eb8cdc`, `15da417`, `834b5a0`, `dd7e5d6`, `c27f0dc`) · [[2026-10-05 — Documento no mês errado na Itanet, SAAM e Vix]]
- **2026-10-05** — Competência lida do PDF com o rótulo, `NF_….pdf` reconhecido como nota, 2ª via casa pelo vencimento exato, distância competência→vencimento aprendida do histórico, vencimento estimado avisado na observação (commits `872cf03`, `3a50ba2`); dados de Itanet, SAAM e Vix (dia 05) corrigidos · [[2026-10-05 — Documento no mês errado na Itanet, SAAM e Vix]]
- **2026-10-02** — e-Auditoria cadastrada e apagada no mesmo dia: é despesa do fiscal, não da TI (Júlio) · [[2026-10-05 — Documento no mês errado na Itanet, SAAM e Vix]]
- **2026-09-29** — Anexo que só virou boleto pelo assunto "nf+bol" passa a nota quando outro anexo já é boleto pelo nome (IMPREMIX); documentos já gravados reclassificados (commit `820f07e`) · [[2026-09-23 — SAAM pelo link do portal e o deploy travado]]
- **2026-09-24** — IMPREMIX: fatura de setembro (NF 6711, vence 20/09) registrada à mão com os PDFs do e-mail de 27/08, anterior ao cadastro · [[2026-09-23 — SAAM pelo link do portal e o deploy travado]]
- **2026-09-24** — Vencimento da ContaAzul: aceita "vencimento em DD/MM" e tira os espaços invisíveis entre os dígitos; faturas Ago e Set da SAAM corrigidas (commit `b447f7b`) · [[2026-09-23 — SAAM pelo link do portal e o deploy travado]]
- **2026-09-24** — Repositório volta a público (Júlio) para destravar dois deploys `BLOCKED`; commit vazio para gerar deploy novo (commit `8e9933d`) · [[2026-09-23 — SAAM pelo link do portal e o deploy travado]]
- **2026-09-24** — Documento via **link do portal** (SAAM pela ContaAzul); plataforma compartilhada exige confirmação por nome ou contexto (a ION Labs quase entrou como SAAM); recibo e link enviados à mão fecham a fatura (commit `7e9637a`, migrações `documento_via_link_do_portal` e `documento_via_link_na_view_de_faturas`) · [[2026-09-23 — SAAM pelo link do portal e o deploy travado]]
- **2026-09-18** — `scripts/procurar-em-outra-caixa.mjs` (senha só pelo ambiente); PC Winthor com razão social, CNPJ e remetentes da TOTVS no cadastro (commit `09133af`) · [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]]
- **2026-09-17** — Contas e contratos: filtro por categoria, fornecedor e situação e exportação em Excel com a marca da Lube (commit `f6c06f8`); Firewall — Rio refeito a partir das notas · [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]]
- **2026-09-17** — Valores voltam aos rótulos dos gráficos (o contorno da barra apagava o texto) (commit `9556282`) · [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]]
- **2026-09-17** — Recibo e débito automático para as IAs (Claude, ChatGPT, Supabase, Google IA Pro): só o recibo da janela do dia 24 + 7 dias, selo "Recibo" em âmbar; `\bnf\b` restaurado e `#0000` deixa de descartar o recibo da Anthropic (commits `0f64783`, `39729b0`, `1a105a9`, `3b245cb`, migrações `recibo_e_pagamento_automatico` e `view_com_recibo_e_pagamento_automatico`) · [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]]
- **2026-09-16** — Cobrança por WhatsApp por fornecedor; nome exibido no From desempata Omie/ContaAzul; competência nunca mais do mês do vencimento; cadastro de Data R, ION, PC Winthor e SAAM (commits `93a159d`, `be8b2ca`, migrações `canal_de_cobranca_por_fornecedor` e `canal_cobranca_na_view_de_faturas`) · [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]]
- **2026-09-16** — "Assinado e entregue" deixa de aparecer em atraso e não é cobrado; reenvio vale o primeiro envio (Kaizen consolidada em ago/26) (commit `2ec70e8`, migração `entregue_contabilidade_quita_a_fatura`) · [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]]
- **2026-09-16** — A leitura descarta os e-mails já processados antes do download e avisa "N sem ler"; nota e boleto de agosto da Mais Dados repostos por script que o Júlio rodou (commit `862cd56`) · [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]]
- **2026-09-16** — Faturas abre no mês atual mais as atrasadas; cobrança guardada em Enviados por IMAP; faixa "Assistente Virtual TI" nos e-mails (commits `3eb6e71`, `bef267a`, `1f7d34f`) · [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]]
- **2026-09-16** — Valor, vencimento e número lidos **de dentro do documento** (XML da NFS-e, linha digitável com dígito verificador); "Paga" vira "Assinado e entregue" (Júlio); notas avulsas com anexo entram no custo (commit `21eee67`, migrações 12, 13 e 14 do banco) · [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]]
- **2026-09-15** — Alerta de vencimento em degraus: atenção, urgente, hoje, vencida (commit `d224ba8`) · [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]]
- **2026-09-15** — Competência e vencimento pelo texto do e-mail, filtro de e-mail não fiscal, leitura do mais novo para o mais antigo; documentos reprocessados com os valores dos PDFs (commit `a3b14dc`) · [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]]
- **2026-09-15** — Excluir fornecedor leva junto contratos, competências e documentos, com aviso do impacto e limpeza do storage (Júlio) (commit `71c784e`, migração `11_excluir_fornecedor_em_cascata`) · [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]]
- **2026-09-15** — Navegação cerca de 4 vezes mais rápida: região `gru1`, contadores do menu por `/api/pendencias`, esqueleto de carregamento (commits `083323b`, `694417b`) · [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]]
- **2026-09-15** — Carga inicial pela planilha do dono (22 fornecedores, 24 contas, R$ 43.227,37), setembro aberto, primeira rodada do robô; leitura sem `SEARCH SINCE`, checagem do `ref` do JWT, palavras-chave negativas, nota × boleto pelo nome do arquivo; cobrança automática desligada (commits `026e21b`, `3fd683f`, migração `10_view_faturas_expoe_precisa_revisao`) · [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]]
- **2026-09-15** — Sistema criado e publicado: projeto Supabase próprio, app Next.js com 9 telas, portal de chamados, robô IMAP/SMTP, 2 crons do Hobby, Next 15.5.25 e nodemailer 10 por segurança, variáveis cadastradas por script, usuário admin do Júlio pelo `/setup` (commits `b86a136`, `cf6bca7`, `2833ec8`, `1b16781`, `0ac2de4`, `4109a03`, `9e83d65`, `2bb4a76`, migrações 01 a 09) · [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]]

Veja também [[2026-10-07 — Kanban TI e o mês que nunca abria]], [[2026-10-05 — Documento no mês errado na Itanet, SAAM e Vix]], [[2026-09-23 — SAAM pelo link do portal e o deploy travado]], [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]], [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]], [[Locaweb]] e [[PAINEL LUBE DISTRIBUIDORA]].
