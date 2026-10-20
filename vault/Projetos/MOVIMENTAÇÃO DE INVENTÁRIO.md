---
tipo: projeto
departamento: Logística
status: ativo
inicio: 2026-10-19
tags: [bi, inventario, estoque, bloqueio, avaria, wms, winthor, recebimento]
---
# MOVIMENTAÇÃO DE INVENTÁRIO

Painel de **tudo o que mexe no estoque do galpão**, pedido pelo Júlio em 2026-10-19 ("visualizar todas as
movimentações que estão acontecendo no meu galpão"), a partir de duas rotinas do [[WinThor]], no padrão da casa
([[data-warehouse]]): WinThor → ETL em Python → [[Supabase]] (schema `inventario` do DATA WAREHOUSE) → painel.
Conversa de origem: [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]. Recebimento de compra (1301): [[2026-10-20 — Recebimento de compra no Movimentação de Inventário]].

| Rotina | Nome no WinThor | De onde vem |
|---|---|---|
| **266** | Bloquear Produtos no Estoque (`PCSIS266`) | `PCLOGDESBLOQUEIO` — o livro de tudo o que entra e sai do estoque **bloqueado** |
| **1147** | Manutenção de inventário rotativo (`PCSIS1147`) | `PCINVENTROT` (o que foi contado) + `PCLOGATUALIZAINVENT` (a diferença lançada: EI sobra, SI falta) |
| **1301** | Entrada de mercadoria (recebimento de compra) | `PCMOV` E/EB/ER: **quanto de cada nota entrou bloqueado** (`QTBLOQUEADA`), com a hora da nota (`PCNFENT`). Desde 2026-10-20 |

Mais o `PCEST` de hoje (estoque, bloqueado, avaria, custo financeiro).

- Pasta: `Desktop\BI\16. INVENTARIO` (README, `etl/`, `web/`, `INICIAR.bat`) · **GitHub:**
  [Lube-Distribuidora-LTDA/MOVIMENTACAO-INVENTARIO](https://github.com/Lube-Distribuidora-LTDA/MOVIMENTACAO-INVENTARIO) (**público**, criado
  pelo Júlio em 2026-10-20; `main` = `cf65b78`) · **Vercel:** projeto `movimentacao-inventario` (`prj_xVuRpkvAQcpTQUW2LljQYqJiBj7O`),
  **https://movimentacao-inventario.vercel.app**, fechado pela [[SENTINELA LUBE]], **no ar e em uso** (cartão ativo no portal, Júlio
  entrou em 2026-10-20 09:23) — ver "Publicação na Vercel".
- Carga: `P:\INTEGRAÇÃO BI\INVENTARIO` (`1 - CONFIGURACAO` com o `ENV` copiado do de leitura do REPOSIÇÕES, `2 - SISTEMA INVENTARIO`,
  `3 - INSTALACAO`, `INSTALAR TUDO.bat`, `ATUALIZAR AGORA.bat`, `DIAGNOSTICO.bat`, `LEIA-ME.txt`). Rotina: [[Inventário - Sync]].
  **Agendada na `SRV-IA` em 2026-10-20** (Júlio, `INSTALAR TUDO.bat`) e **vigiada pelo [[GUARDIÃO DA LUBE]]** (rotina, tarefa e site).
- Para ver hoje: **`INICIAR.bat`** na pasta do projeto (`http://localhost:3102`, só esta máquina) ou a configuração `inventario`
  do `.claude/launch.json` do cérebro.

## Como o livro da 266 é lido (o achado que manda em tudo)
Cada programa grava os campos de um jeito; conferido produto a produto contra o saldo do PCEST (13618 e 13662 da filial 1)
e numa devolução inteira (transação 1165302):

| Programa | O que é | Quantidade |
|---|---|---|
| `PCSIS266` (sem versão) | bloqueio na 266 | `QTBLOQUEADA` = quanto bloqueou; `QTINDENIZ` = quanto é avaria; `QTDESBLOQUEADA` = desbloqueio de avaria |
| `[PCSIS266 - versão]` | desbloqueio na 266 | `QTDESBLOQUEADA`; `QTBLOQUEADA` é o saldo **depois** (o "ANT" vem igual) |
| `WMS DA KAIZEN SOLUTIONS` | liberação após a armazenagem (motivo 30, que não existe na PCTABDEV) | `QTDESBLOQUEADA` |
| 1303 / 1346 / 1361 | devolução de cliente, que entra **bloqueada** | `QTBLOQUEADA`, motivo da devolução |
| 1316 | cancelamento da devolução | estorna a entrada (ED negativo); **não** mexe no bloqueado |
| 552 (até mai/2025) | desbloqueio automático (Atualização Diária II) | `QTDESBLOQUEADA` |
| 1122 | montagem de produtos | `QTBLOQUEADA` |

A leitura mora numa view (`inventario.vw_movimento`): mudar a regra não exige carga. A rotina **1188** (Atualização Contábil
de Inventários) também lança EI/SI, mas no estoque contábil — fica fora.

**O recebimento de compra (1301) entra bloqueado e o livro NÃO registra esse bloqueio**, só a liberação (pelo WMS, ou na 266
com o motivo 53 "Conferido pelo recebimento"). **Quem registra é a linha da nota no PCMOV** (`QTBLOQUEADA` = `QT` em 99,8% das
linhas; `ESTOQUEDESBLOQUEADO = 'S'` = entrou livre). Desde 2026-10-20 o painel lê o recebimento de lá (tipos 13 Recebimento de
compra, 14 Recebimento cancelado e 15 Recebimento sem bloqueio, os dois últimos neutros), **provado contra a foto diária do
estoque** (`PCHISTEST`): somar o recebimento derruba o que o livro não explica de 35,6 mi para 4,5 mi de unidades na filial 1
(`etl/conferir_recebimento.py`, sem gravar). **A ligação pela liberação do WMS não prova nada:** o WMS só passou a liberar
recebimento em set/2025, e às vezes libera uma carga inteira citando a transação de uma nota só. O painel continua sem "saldo do
período" (o livro tem outras falhas, ver Achados) e mostra o bloqueado de hoje (PCEST). Ver [[2026-10-20 — Recebimento de compra no Movimentação de Inventário]].

## Banco: schema `inventario` (DATA WAREHOUSE, ~51 MB)
Migrações (versionadas em `web/db/`; a 01 e a 02 são a definição vigente): `inventario_01_schema` (tabelas, RLS sem políticas),
`inventario_02_views_e_funcao` (`vw_movimento`, `vw_inventario`, `painel_dados()`), `inventario_03_fotos`,
`inventario_04_estoque_completo`, `inventario_05_custo_6_casas`, `inventario_06_ajuste_cheio`, `inventario_07_recebimento` (2026-10-20).
- Fatos: `fato_bloqueio` (201 mil desde 2025), `fato_recebimento` (55,6 mil linhas da 1301 desde 2025), `fato_inventario` (5.326 contagens, 648 inventários), `fato_posicao` (8.837 linhas do PCEST).
- Cadastros próprios: `produto` (o `core.dim_produto` não tem departamento/seção/embalagem — exceção consciente), `funcionario`, `motivo`, `filial`.
- `controle_carga` e `painel_cache` (o pacote do painel em **gzip**, ~1,5 MB; JSON de ~11,2 MB com o recebimento; 257 mil movimentos).
- `painel_dados()` lê `trade.produto_miniatura` **só** para saber quais produtos têm foto (leitura, não carga).

## O painel (7 telas)
Visão geral ("o que está acontecendo no galpão") · Bloqueios e avarias (266) · **Recebimento e devoluções** (até 2026-10-19
"Devoluções e WMS": recebimento que entrou bloqueado, **tempo de armazenagem do recebimento**, recebimento cancelado e sem
bloqueio, e o **tempo até o WMS liberar** cada devolução, os dois medidos pela transação de entrada) · Bloqueado hoje (com **há quanto tempo está bloqueado**) ·
Inventário rotativo (1147: acurácia, sobra, falta, quem contou, produtos que sempre divergem) · **Análise livre** (base ×
linhas × colunas × medida, com calor e Excel) · Movimentações (linha a linha).
No padrão de [[Como eu gosto dos BIs]]: cara do Gestão Comercial (azul-marinho e ouro), filtros de múltipla escolha com busca
(vazio = todos), períodos rápidos + datas livres, comparação com o período anterior e o ano anterior, **todo clique abre o
relatório do recorte** (Voltar; Ctrl+clique filtra), foto do produto (a do [[GESTÃO COMERCIAL TRADE]]), Excel formatado, link da
visão, tema claro/escuro, modo apresentação. O navegador filtra e soma (como o [[REPOSIÇÕES E CHAMADOS]]): 201 mil movimentos,
telas em 25–90 ms; o pacote fica guardado no navegador e só é baixado de novo quando a carga gera outro.

## Publicação na Vercel (2026-10-20)
Mesmo molde do [[GESTÃO COMERCIAL TRADE]]: Root Directory `web`, Framework Other, sem build, região `gru1`, Node pelo `engines` (22.x),
Vercel Authentication Standard (`prod_deployment_urls_and_all_previews`), guarda da Sentinela 1.1.0 (`middleware.ts`, `FECHADO =
movimentacao-inventario`). Funções `api/dados` (o pacote comprimido), `api/versao` e `api/img` (foto do produto, lida de `trade.produto_miniatura`).
- **Registro antes do 1º deploy** (migração `registrar_movimentacao_inventario` no banco do portal): `sentinela.sistemas` (`exige_login = true`;
  `arquivos_proibidos`: `package*.json`, `vercel.json`, `db/`, README, `servidor_local.js`, os `.ts` do guarda), ícone novo `inventario`
  ("GESTÃO DE INVENTÁRIO") e o cartão `movimentacao-inventario` em `public.sistemas` ("MOVIMENTAÇÃO DE INVENTÁRIO", categoria GESTÃO OPERACIONAL,
  ordem 10; nasceu com `ativo = false` e foi **ativado em 2026-10-20 às 09:20**, a pedido do Júlio — o portal só lista e abre cartão ativo).
  Quem tem "Todos os sistemas" no portal passou a ver o painel (nome de funcionário e valor de estoque): em 2026-10-20, 6 contas
  (a lista está no painel admin do portal).
- **1º deploy de produção:** `dpl_2xag48pCjMwtPK5SZoRaPaEdyhAk`, commit `b9554f9`, `READY` em 2026-10-20 ~08:11. Daqui em diante, push na `main` publica sozinho.
- **Provado de fora** (navegador do app, sem login, do escritório): `/` vai para o portal; `/api/versao` responde `{"erro":"login_necessario"}`;
  `/.sentinela/saude` com `oidc: true`, lista ok, modo proteger. A Sentinela registrou os acessos como `sem_login` (risco 0) e **não bloqueou o IP
  do escritório**; os robôs de captura de tela da própria Vercel foram barrados (`robo`/`lista`), como no Trade.
- **Variáveis:** as 5 `SUPABASE_DB_*` (porta 5432), cadastradas pelo Júlio em 2026-10-20 (Production, Sensitive), valem desde o deploy
  `dpl_DAxsrSoibSCrWDGMyrYWwTWDYb8G` (`cf65b78`).
- **Provado com login** (2026-10-20, 09:23, conta `cpd@`): a Sentinela liberou `/`, `/api/versao` e `/api/dados` com a identidade do Júlio,
  o painel buscou 30 fotos (`/api/img`) e as telas de bloqueio e detalhe; nenhum erro na Vercel.

## Validação (2026-10-19)
- **1147 × PCMOV:** a diferença de cada produto bate com os EI/SI que a 1147 lançou no PCMOV, **41 de 41 meses/tipos**, quantidade
  e valor ao centavo (jan/2025 a out/2026). A carga refaz isso sempre (`conferencia_1147`).
- **Tela × banco:** bloqueios da filial 1 em 2026 — 9.742 movimentos, R$ 3.028.149, 3.154 SKUs — iguais à consulta no banco;
  bloqueado de hoje igual ao PCEST por filial (filial 1 R$ 2.397.671,78; 10 R$ 377.190,91; 12 R$ 210.443,03; 7 R$ 24.824,96;
  11 R$ 1.316,15); sobra e falta de 2026 (R$ 640.588,65 e R$ 173.152,36) iguais ao log do WinThor.
- Dois erros do próprio Claude, achados e corrigidos no mesmo dia: o "% do estoque bloqueado" usava como base só os produtos
  bloqueados (dava 27,4%; o certo é 14,4%) e o valor do inventário era arredondado linha a linha (5 a 9 centavos a mais na soma).

## Validação do recebimento (2026-10-20)
- **Recebimento × foto diária do estoque** (`PCHISTEST`, produto × mês, set/2025–out/2026, `conferir_recebimento.py`): |o que o livro
  não explica| cai de 35.632.097 para 4.501.843 un. na filial 1, de 1.602.698 para 278.074 na 7, de 467.285 para **0** na 10, de
  1.713.390 para 260.314 na 12. Só 118 de 32.975 produto × mês da filial 1 (0,4%) fecham *sem* o recebimento.
- **Tela × banco, ao centavo** (filial 1, 2026, carga das 08:30): recebimento 22.046 linhas, 28.815.075,329 un., **R$ 87.988.623,75**,
  4.259 notas, 4.342 SKUs; cancelado R$ 12.087.343,37; sem bloqueio R$ 176.558,18; liberado pelo WMS R$ 75.330.666,51; tempo mediano
  de armazenagem 7,3 h (7,275 h no banco, 1.876 notas). Nenhum erro no console nas 7 telas.
- **Reconferido depois da carga completa** (08:56, 9 passos `OK`, conferência 1147 `OK`, pacote `20261020-085550`): recebimento
  22.066 linhas, 28.827.415,329 un., **R$ 88.066.991,27**, 4.261 notas; cancelado R$ 12.087.351,42; sem bloqueio R$ 176.558,18;
  liberado pelo WMS R$ 75.360.387,05; mediana 7,275 h (1.876 notas) — tela e banco iguais ao centavo. A carga levou ~15 min (o livro,
  8,6 min; o pacote, 3,8 min) porque o banco estava lento por CPU (um `count(*)` de 201 mil linhas em memória levando 0,5 s), não pela
  mudança: o plano da view nova é normal.

## Achados para o Júlio
- **Acurácia do inventário rotativo em 2026: 6,6%** (203 de 3.074 contagens bateram com o estoque). Divergência de 18,1% do valor
  contado; **"Material Consumo" é 48% da divergência de 2026** (R$ 394,8 mil). Sobras atípicas: mar/2026 (R$ 382,5 mil) e jun/2025
  (R$ 714,6 mil).
- **Lançamento impossível:** em 04/07/2025, desbloqueio de **17.000.043 un. de PALLETE CHEP (CONSUMO)** (cód. 9711) — R$ 2,28 bi
  ao custo de hoje. **A origem é o recebimento** (descoberto em 2026-10-20): a nota de 17 paletes (transação 918016, ER) entrou em
  27/06/2025 com **17.000.000 bloqueados**; a foto do estoque mostra o salto no bloqueado e no estoque, e o estoque já estava certo em
  01/08/2025. A entrada e o desbloqueio ficam fora das somas, com aviso e botão para incluir.
- **Recebimento (2026, filial 1):** R$ 88,0 mi entraram bloqueados em 4.259 notas; mediana de **7,3 h** da nota lançada à última
  liberação do WMS — mas só **44% das notas** (1.876) têm liberação inteira do WMS com a própria transação: 43% aparecem "Sem WMS"
  (liberação manual na 266, motivo 53, ou o WMS citou a transação de outra nota da mesma carga) e 8% foram canceladas.
- **O livro ainda não fecha sozinho:** a devolução ao fornecedor (1302, `SD`) e a 1322 (`SR`) tiram do bloqueado pelo PCMOV sem passar
  pelo livro (filial 1, desde 28/03/2025: 143 mil e 520 mil un.), e o WMS às vezes grava liberação que não mexe no saldo.
- **Bloqueado hoje: R$ 3,01 mi** (R$ 1,79 mi em avaria), **14,4% do estoque a custo** das filiais 1, 7, 10, 11 e 12; R$ 947 mil com o
  último bloqueio há mais de 90 dias.
- **Devoluções (últimos 30 dias):** mediana de **47 h** entre a entrada da devolução e a liberação do WMS; 271 de 413 notas sem
  liberação do WMS no período (podem ter sido liberadas à mão na 266, que não grava a transação).
- O PCADMIN (sistema/WMS) faz ~60% dos movimentos do bloqueado; a 266 manual concentra-se em poucas pessoas da logística.

## Decisões
- 2026-10-19 (Claude): **schema `inventario`**, pasta `16. INVENTARIO`, rotina `Inventario - Sync`; o nome na tela é "Movimentação de Inventário".
- 2026-10-19 (Claude): **filiais 1, 7, 10, 11 e 12** (as de distribuição; o PCEST das 3, 4 e 6 tem milhões "bloqueados" que não são galpão) e **histórico desde 2025-01-01** (comparação com o ano anterior). Ambos no ENV.
- 2026-10-19 (Claude): **valor dos movimentos = quantidade × custo financeiro de hoje** (o livro não guarda custo); inventário com o valor que a 1147 lançou.
- 2026-10-19 (Claude): **movimento com 1 milhão de unidades ou mais num registro só é "suspeito"**: fora das somas, com aviso e botão "incluir".
- 2026-10-19 (Claude): **sem KPI de saldo do período** (o recebimento não aparece no livro); no lugar, o bloqueado de hoje. _Em
  2026-10-20 o recebimento entrou, mas a decisão fica: o livro ainda tem as falhas de 1302/1322 e do WMS._
- 2026-10-20 (Claude): **recebimento pela linha da nota** (`PCMOV.QTBLOQUEADA`), não pela liberação do WMS; hora = lançamento da nota
  (`PCNFENT.DTENT` + `HORALANC` + `MINUTOLANC` — o minuto existe); **cancelamento do recebimento neutro** (tira do bloqueado só se a
  mercadoria ainda não tinha sido liberada: 81% das vezes na filial 1, 44% na 12); **recebimento fora do "último bloqueio"** em
  Bloqueado hoje (entra e sai em horas); menu "Rotina 266" → "Estoque bloqueado". · [[2026-10-20 — Recebimento de compra no Movimentação de Inventário]]
- 2026-10-20 (sessão principal): **pacote com formato novo só com a tela junto.** O painel está na Vercel com deploy a cada push na
  `main`; gravar no `painel_cache` um pacote que a tela publicada não conhece quebra a tela. Antes de mudar o formato, avisar e
  subir o código no mesmo passo.
- 2026-10-19 (Claude): **o navegador filtra e soma**; o pacote viaja comprimido em bytes (`application/octet-stream` + `X-Pacote: gzip`) porque descomprimido passa do limite de 4,5 MB das funções da Vercel; o navegador descomprime e guarda (IndexedDB) por versão.
- 2026-10-19 (Claude): **sem aquecedor**: o painel não depende de CDN quente (cópia no navegador + `api/versao` pequena).
- 2026-10-19 (Claude): **agendamento aos :05, de 2 em 2 horas, 07:05 a 19:05, e 22:05** (Trade :25, Reposições :35, Comercial :45, Compras :50). Carga medida: ~31 s.
- 2026-10-19 (Claude): **GitHub, Vercel e agendamento ficam com o Júlio** (precedente do Trade e do Reposições: ele cria/indica o repositório e cadastra as senhas).

## Pendências
- [x] **GitHub** — Júlio criou `Lube-Distribuidora-LTDA/MOVIMENTACAO-INVENTARIO` (público) em 2026-10-20; o Claude subiu o `b9554f9` (varrido: sem senha, IP ou nome de pessoa).
- [x] **Vercel e Sentinela** — Claude, 2026-10-20: projeto `movimentacao-inventario`, registro na Sentinela e cartão inativo antes do 1º deploy, deploy de produção `READY`, provado de fora.
- [x] **Variáveis `SUPABASE_DB_*`** — Júlio cadastrou e publicou de novo em 2026-10-20.
- [x] **Cartão no portal** — Júlio decidiu abrir; Claude ativou em 2026-10-20 09:20 e acompanhou a entrada do Júlio (09:23, tudo liberado, sem erro).
- [ ] **Júlio:** liberar o painel para quem não tem "Todos os sistemas" (logística, coordenador), pelo painel admin do portal.
- [x] **Agendar na `SRV-IA`** — Júlio, 2026-10-20 ~10:03 (`INSTALAR TUDO.bat`); Claude conferiu a carga em `inventario.controle_carga` (10 de 10 `OK`).
- [x] **Commit do recebimento no ar** — o pacote das 08:30 (tipos 13 a 15) quebrava a tela publicada (`b9554f9`); a sessão principal
  testou o `cf65b78` e fez o push às ~09:00. **Regra daqui em diante:** pacote com formato novo só se grava avisando, para a tela
  publicada e o pacote andarem juntos.
- [ ] Logística/TI: decidir se corrige no WinThor o registro do recebimento 918016 (17 paletes com 17.000.000 bloqueados, 27/06/2025),
  origem do desbloqueio de 17.000.043 de 04/07/2025. O estoque já está certo.
- [ ] Ler a devolução ao fornecedor (1302) e a 1322 como saída do bloqueado (PCMOV `SD`/`SR` com `QTBLOQUEADA`).
- [ ] Perguntar à Kaizen por que o WMS cita a transação de outra nota da mesma carga (o tempo de armazenagem mede 44% das notas).
- [ ] Levar a acurácia de 6,6% e a divergência do "Material Consumo" ao coordenador de logística.
- [x] [[GUARDIÃO DA LUBE]] vigiar a [[Inventário - Sync]] — Claude, 2026-10-20 10:27 (migração `saude_v1_inventario`: rotina, tarefa e site).
- [x] **Recebimento (1301) como entrada no bloqueado** e o **tempo de armazenagem do recebimento** — Claude, 2026-10-20 (pela linha da nota, não pela transação do WMS) · [[2026-10-20 — Recebimento de compra no Movimentação de Inventário]]
- [ ] Departamento, seção e embalagem no `core.dim_produto` (dono: [[BI COMPRAS]]) para aposentar o `inventario.produto`.

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-20 (10:27)** — **No Guardião** (Júlio pediu, Claude fez): migração `saude_v1_inventario` no DATA WAREHOUSE (commit `977ae31` no `12. GUARDIAO`): rotina, tarefa e site no catálogo; às 10:30 o vigia viu a tarefa na `SRV-IA` e o site respondeu. Falha de carga agora avisa no Telegram e tenta de novo 1 vez · [[GUARDIÃO DA LUBE]]
- **2026-10-20 (10:03–10:20)** — **Agendado na `SRV-IA`** (Júlio rodou o `INSTALAR TUDO.bat`, tarefa `Inventario - Sync` com 8 horários) e 1ª carga disparada pelo instalador: 10 passos `OK` em 17 min, conferência 1147 igual ao PCMOV, pacote `20261020-101950`; acompanhada pelo Claude em `inventario.controle_carga` · [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]
- **2026-10-20 (09:20)** — **Cartão ativado no portal** (Júlio pediu, Claude fez): `public.sistemas.ativo = true` para `movimentacao-inventario` no banco do [[PAINEL LUBE DISTRIBUIDORA]]. Às 09:23 o Júlio entrou pelo portal: a Sentinela liberou `/`, `/api/versao`, `/api/dados` e 30 fotos com a identidade `cpd@lube.com.br`, sem erro na Vercel. Passa a aparecer para as 6 contas com "Todos os sistemas" · [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]
- **2026-10-20 (~09:00)** — **Variáveis e o recebimento no ar** (Júlio cadastrou as 5 `SUPABASE_DB_*` — Production, Sensitive — e fez o redeploy `dpl_4wjrZ8L4r14xv7NhD6PX4w1RyjVV`; Claude conferiu pelos nomes). O pacote do recebimento (tipos 13–15, gravado às 08:30) **quebraria a tela publicada** (`b9554f9` não conhece esses tipos); o Claude testou o `cf65b78` localmente (7 telas OK com o pacote `20261020-083045`) e fez o push: produção `dpl_DAxsrSoibSCrWDGMyrYWwTWDYb8G` (`cf65b78`) `READY`. Lição: **pacote com formato novo e tela publicada andam juntos** — gravar o pacote antes do push quebra quem abrir. **Falta:** ativar o cartão no portal (o portal só abre cartão ativo) e conferir com login · [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]
- **2026-10-20** — **Recebimento de compra (1301) no painel** (sessão aberta pela conversa de origem; Claude fez): investigação só
  leitura no Oracle confirmou pela linha da nota (`PCMOV.QTBLOQUEADA`) e pela foto diária do estoque (`PCHISTEST`) que o recebimento
  entra bloqueado; tabela `inventario.fato_recebimento`, migração **`inventario_07_recebimento`** (view `vw_movimento` com os tipos 13,
  14 e 15, `painel_dados()` lendo o recebimento), consulta `recebimento` no ETL (carga às 08:28, 55.551 linhas, e carga completa
  depois), `etl/conferir_recebimento.py`, diagnóstico por situação, tela **Recebimento e devoluções** com o tempo de armazenagem;
  ETL copiado para `P:\INTEGRAÇÃO BI\INVENTARIO`; tela × banco ao centavo; commit **`cf65b78`**, que a sessão principal testou (7 telas) e subiu para a `main` às ~09:00 (deploy automático) · [[2026-10-20 — Recebimento de compra no Movimentação de Inventário]]

- **2026-10-20** — **No GitHub e na Vercel** (Júlio criou o repositório e mandou publicar; Claude fez): push do `b9554f9` para `Lube-Distribuidora-LTDA/MOVIMENTACAO-INVENTARIO` (público); projeto `movimentacao-inventario` (`prj_xVuRpkvAQcpTQUW2LljQYqJiBj7O`); registro na Sentinela + ícone + cartão inativo no portal (migração `registrar_movimentacao_inventario`, antes do deploy); deploy de produção `dpl_2xag48pCjMwtPK5SZoRaPaEdyhAk` `READY`; provado de fora que só abre com login. **Faltam as variáveis `SUPABASE_DB_*` (Júlio)** · [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]
- **2026-10-19** — **Sistema criado** (Júlio pediu, Claude fez): schema `inventario` no DATA WAREHOUSE (migrações `inventario_01_schema` a `inventario_06_ajuste_cheio`), ETL de 7 consultas com conferência 1147 × PCMOV e pacote comprimido, pasta `P:\INTEGRAÇÃO BI\INVENTARIO` com instalador (não instalado), painel de 7 telas com guarda da Sentinela (não publicado), `INICIAR.bat` local; cargas reais às 18:04 e 18:38 (esta pelo `executar.py`, 9 passos `OK`, 31 s), conferidas em `inventario.controle_carga`; commit local `b9554f9` · [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]

Veja também [[Mapa de sistemas]], [[Glossário WinThor]], [[REPOSIÇÕES E CHAMADOS]] (mesmo desenho de navegador) e [[GESTÃO COMERCIAL TRADE]] (mesma cara e componentes).
