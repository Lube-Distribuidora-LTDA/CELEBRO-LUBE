---
tipo: projeto
departamento: Fiscal
status: ativo
inicio: 2026-10-20
tags: [bi, fiscal, tributacao, preco, regiao, winthor, pctabpr]
---
# GESTÃO FISCAL

BI da área **Fiscal**, pedido pelo Júlio em 2026-10-20: "Código do produto | Descrição | Região sem tributação | região sem
preço de venda", das rotinas 201 e 203 do [[WinThor]], "na mesma pegada dos últimos que fizemos com informações claras e
filtros personalizados". Primeiro módulo: **tributação e preço de venda por região**. Padrão da casa ([[data-warehouse]]):
WinThor → ETL em Python → [[Supabase]] (schema `fiscal` do DATA WAREHOUSE) → painel. Conversa de origem:
[[2026-10-20 — Gestão Fiscal, região sem tributação e sem preço]].

| Rotina | Nome no WinThor | De onde vem |
|---|---|---|
| **201** | Precificar Produto (`PCSIS201`) | `PCTABPR`: uma linha por produto × região, com o **preço de venda** (`PVENDA`) e a **tributação de saída** (`CODST`) |
| **203** | Cadastrar Produto (`PCSIS203`) | `PCPRODUT`: código, descrição, NCM (`NBM`), fornecedor, departamento, seção, fora de linha, `REVENDA` |
| **302** | Cadastrar Cliente | `PCCLIENT.NUMREGIAOCLI` (ou a região da praça, `PCPRACA`): em que região cada cliente compra |
| **514** | Cadastrar tipo de tributação | `PCTRIBUT`: mensagem, CST, ICMS, CFOP de cada CODST |
| **572** | (praças/regiões) | `PCREGIAO`: nome, UF, filial, ativa |

Mais o `PCMOV` (venda faturada dos últimos 12 meses por produto × região) e o `PCEST` (estoque de hoje, filiais 1/7/10/11/12).

**O pedido citava "203 (pcclient)" e "201 (pctabtrib)"; no WinThor é diferente, e o painel segue o WinThor:** a 203 é o cadastro
de **produto** (`PCPRODUT`; cliente é a 302), e a 201 grava a **`PCTABPR`**. A `PCTABTRIB` é a *tributação por UF*, que está
**desligada** na Lube (`PCPARAMFILIAL.CON_USATRIBUTACAOPORUF = 'N'`, `PCCONSUM.USATRIBUTACAOPORUF = 'N'`): tem só uma linha por
produto, filial 1 × ES, quase toda com CODST 0. A tributação de saída que vale é o `CODST` da `PCTABPR`, por região. O PCCLIENT
entrou para contar quantos clientes compram em cada região.

- Pasta: `Desktop\BI\17. FISCAL` (README, `etl/`, `web/`, `INICIAR.bat`) · **GitHub:**
  [Lube-Distribuidora-LTDA/GESTAO-FISCAL](https://github.com/Lube-Distribuidora-LTDA/GESTAO-FISCAL) (**público**, criado pelo Claude a
  pedido do Júlio em 2026-10-20; `main` = `ff6776b`) · **Vercel:** projeto `gestao-fiscal` (`prj_YF4fRNaCEaKmEmjbVTN5ZIpUTjMl`),
  **https://gestao-fiscal-olive.vercel.app** (o `gestao-fiscal.vercel.app` é de outra conta), fechado pela [[SENTINELA LUBE]]; push na
  `main` publica sozinho. **Falta o Júlio cadastrar as 5 `SUPABASE_DB_*`** (sem elas a API responde `configuracao_incompleta`).
- Carga: `P:\INTEGRAÇÃO BI\FISCAL` (`1 - CONFIGURACAO` com o `ENV` copiado do de leitura do Inventário, `2 - SISTEMA FISCAL`,
  `3 - INSTALACAO`, `INSTALAR TUDO.bat`, `ATUALIZAR AGORA.bat`, `DIAGNOSTICO.bat`, `LEIA-ME.txt`). Rotina: [[Fiscal - Sync]]
  (**agendada pelo Júlio em 2026-10-20 ~11:34**, `INSTALAR TUDO.bat`).
- Para ver hoje: **`INICIAR.bat`** na pasta do projeto (`http://localhost:3103`, só esta máquina) ou a configuração `fiscal` do
  `.claude/launch.json` do cérebro.

## A regra (uma só, no banco: `fiscal.vw_situacao`)
| Situação | Quando |
|---|---|
| Completo | tem tributação e preço de venda na região |
| **Sem tributação** | tem preço; CODST vazio (ou que não existe na 514) |
| **Sem preço de venda** | tem tributação; `PVENDA` zero ou vazio |
| Sem tributação e sem preço | a linha da 201 existe, vazia |
| Fora da tabela da região | não há linha na `PCTABPR` (zero nas 16 regiões em 2026-10-20) |

"Região sem tributação" de um produto = sem tributação + sem os dois + fora da tabela; "sem preço" = sem preço + sem os dois + fora.

## Universo (decisões)
- **Regiões: só as 16 que o Júlio pediu** ("eu preciso de apenas algumas regiões"): 18, 19, 23, 27, 31, 33, 35, 37, 38, 39, 40,
  41, 42, 43, 45 e 46. No `ENV` (`FISCAL_REGIOES`) e no banco (`fiscal.regiao.no_painel`). **A região 1 (Espírito Santo), a que
  mais vende (517 mil linhas em 12 meses), não está na lista** — perguntado ao Júlio, sem resposta ainda.
- **Com estoque nas filiais 1, 11 ou 12** (desde 2026-10-20 16:21, pedido do Júlio; `QTESTGER > 0` em pelo menos uma delas;
  `FISCAL_FILIAIS_ESTOQUE`, que também soma o estoque da tela): **4.274 produtos**. _Até 16:21: 5.328 ativos, com e sem estoque._
- **Só produtos ATIVOS** (5.318, desde 2026-10-20 13:16, pedido do Júlio: "apenas produtos ATIVOS e não todos, como: CONSUMO,
  INATIVOS e etc."): não excluído, de revenda, **em linha** (`OBS2 <> 'FL'`), **fora do fornecedor "INATIVOS"** (cód. 658801, onde a Lube
  guarda o que saiu de linha), **sem item de consumo** (descrição com "CONSUMO" ou departamento 9 Material Consumo) e com tipo de
  mercadoria preenchido. O `TIPOMERC = 'MC'` **não** é critério: Guaraná Antarctica, Sukita e Água Tônica estão como MC e vendem.
  _Até 13:16 eram os 7.277 de revenda não excluídos, com fora de linha._
- **Venda:** `S` não cancelada, 12 meses, `QT × (PUNIT + VLOUTROS)`, todas as filiais.

## Banco: schema `fiscal` (DATA WAREHOUSE, ~17 MB)
Migrações (em `web/db/`; 01 e 02 são a definição vigente): `fiscal_01_schema`, `fiscal_02_situacao_e_funcao`,
`fiscal_03_regioes_escolhidas`.
- Fatos: `fato_preco_regiao` (116.432 linhas = 7.277 × 16), `fato_venda_regiao` (18.924 produto × região). Cadastros: `produto`
  (próprio: o `core.dim_produto` não tem NCM, departamento, seção nem REVENDA — exceção consciente, como no Inventário), `regiao`
  (as 50, com clientes e `no_painel`), `tributacao` (a PCTRIBUT, 798).
- `controle_carga`, `painel_cache` (pacote gzip de ~473 KB; JSON de 3 MB). `painel_dados(meses)` lê `trade.produto_miniatura` só
  para saber quais produtos têm foto.

## O painel (4 telas)
**Visão geral** (cartões, situação por região em barras 100%, rosca produto × região, departamentos e fornecedores com pendência,
"mais urgentes": venderam na região e hoje têm pendência) · **Produtos** (a lista pedida: código, descrição, regiões sem tributação,
regiões sem preço — cada região é um chip com o número, na cor da situação, contorno dourado se vendeu lá; começa pelo que mais
vende) · **Mapa produto × região** (a matriz colorida, 16 colunas, tributação/CST/ICMS/CFOP/preço na dica; Excel da matriz) ·
**Regiões** (pendências, clientes e venda de cada uma).
Relatório a cada clique: **produto** (região a região: CODST, tributação, CST, ICMS, CFOP, preço, venda), **região** (produtos com
pendência, departamentos, fornecedores), fornecedor/departamento/CODST/NCM (situação por região, produtos, combinações). Filtros de
múltipla escolha com busca: região, UF, filial da região, situação na região, CODST, venda na região, departamento, seção, fornecedor,
produto, NCM, situação do produto, estoque, venda do produto, data de cadastro. Excel formatado, link da visão, tema claro/escuro,
modo apresentação, foto do produto. **Abre na hora com a cópia guardada** e confere a versão do banco por trás (seção 8b do manual).

## Validação (2026-10-20)
- **Conferência na carga, na mesma foto do Oracle** (`SET TRANSACTION READ ONLY`): banco × `PCTABPR` igual em todas as regiões —
  50 regiões e 644.433 linhas na 1ª carga; 16 regiões e 116.432 linhas na carga com o recorte. Diagnóstico sem gravar também igual.
- **Tela × banco:** 7.277 produtos; 6.686 com região sem tributação; 7.133 com região sem preço; 83.544 de 116.432 combinações
  completas (71,8%); 2.615 com preço e sem tributação; 15.683 com tributação e sem preço; 14.590 sem os dois.
- **Tela × WinThor, produto a produto:** cód. 15722 (Coca-Cola Zero lata) nas 16 regiões, CODST e preço iguais à `PCTABPR`.

## Achados para o Júlio
- **Região 27 (Somar ⇒ Espírito Santo):** 2.280 produtos com **preço e sem tributação** (87% de todos os "tem preço e falta a
  tributação" das 16 regiões); a região vendeu R$ 3,2 mi em 12 meses, mas nenhum desses 2.280 vendeu lá.
- **Sem preço com tributação:** concentrado nas regiões de transferência 39 (2.971), 45 (2.577), 40 (2.130) e 41 (1.990), e na 38
  (Rio de Janeiro interno, 992).
- **Mais urgentes (venderam na região e hoje têm pendência): 11 casos, 6 produtos** — 9 são **cestas de Natal 2025** sem preço nas
  regiões 31, 35 e 43 (preço retirado depois da temporada); os 2 reais: **Amendoim 500 g Kutko (21504) sem tributação na 38** e
  **Óleo de girassol Sinhá 900 ml (2706) sem tributação na 42**.
- Há itens de consumo marcados como revenda (ex.: "Óleo Diesel S10 (Lube-Consumo)", copiadoras, peças de caminhão) sem tributação
  e sem preço em nenhuma das 16 regiões: inflam o "sem os dois". Candidatos a `REVENDA = 'N'` no cadastro.

## Decisões
- 2026-10-20 (Claude): sistema **GESTÃO FISCAL**, schema `fiscal`, pasta `17. FISCAL`, rotina `Fiscal - Sync` — nome largo para os
  próximos módulos do Fiscal; o primeiro é "Tributação e preço por região".
- 2026-10-20 (Claude): fonte da tributação = **`PCTABPR.CODST`** (a da 201), não a `PCTABTRIB` (tributação por UF desligada).
- 2026-10-20 (Júlio): **só as 16 regiões** listadas por ele.
- 2026-10-20 (Claude): universo = **produtos de revenda não excluídos**.
- 2026-10-20 (Claude): **conferência na mesma transação de leitura do Oracle** — a 201 é usada o dia inteiro, e um preço mudado no
  meio da carga viraria alarme falso.
- 2026-10-20 (Claude): listas de produto começam pelo **que mais vende** (por quantidade de pendência, o topo era cesta de Natal e
  item de consumo sem preço em lugar nenhum).
- 2026-10-20 (Júlio): **só produtos com estoque nas filiais 1, 11 ou 12** (em pelo menos uma; "nas três" seriam 10 produtos).
- 2026-10-20 (Júlio): **carga de 30 em 30 minutos**; o Claude pôs das 07:10 às 19:40, aos :10 e :40 (minutos sem outro ETL).
- 2026-10-20 (Claude, substituída no mesmo dia): cargas aos :15, 07:15, 10:15, 13:15, 16:15 e 19:15 (Inventário :05, Trade :25, Reposições :35, Comercial
  :45, Compras :50). Carga medida em 2026-10-20 com o banco lento: ~9 min (produto 136 s, preço 263 s, pacote 62 s).
- 2026-10-20 (Claude): **GitHub, Vercel e agendamento ficam com o Júlio** (precedente do Trade e do Inventário).

## Pendências
- [ ] **Júlio:** confirmar se a **região 1 (Espírito Santo)** fica mesmo de fora (é uma linha no `ENV`: `FISCAL_REGIOES`).
- [x] **GitHub, Vercel e Sentinela** — Claude, 2026-10-20, a pedido do Júlio (repositório criado pelo Claude desta vez).
- [x] **Variáveis `SUPABASE_DB_*`** — Júlio, 2026-10-20 (com o conserto do usuário no `c32f5c1`).
- [x] **Cartão ativo no portal** — Claude, 2026-10-20 11:57, com o aceite do Júlio; `cpd@` e `comercial@` já entraram.
- [x] **`INSTALAR TUDO.bat` de novo** — Júlio, 2026-10-20 ~16:00: tarefa de 30 em 30 min no ar (16:10:01 rodou; 16:15 não) e regra dos ativos na VM.
- [ ] **Júlio: `ATUALIZAR AGORA.bat` na `SRV-IA`** — para a VM pegar a regra do estoque nas filiais 1, 11 e 12 (senão cada carga da VM volta aos ~5.328).
- [x] **Agendar na `SRV-IA`** — Júlio, 2026-10-20 ~11:34 (`INSTALAR TUDO.bat`); Claude conferiu a carga em `fiscal.controle_carga` (7 de 7 `OK`).
- [ ] Ligar no [[GUARDIÃO DA LUBE]] (rotina, tarefa e site), depois do agendamento.
- [ ] Fiscal/Compras: revisar os itens de consumo marcados como revenda e a tributação da região 27.
- [ ] Ideias (não pedidas): tela de **Tributações** (o mesmo produto com CODST diferente em regiões da mesma UF); NCM × tributação.

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-20 (16:50)** — **Foto do produto inteira na moldura** (Júlio mandou o print da garrafa da Pedra Azul passando da moldura; Claude fez): dentro de um grid, o `max-height: 100%` da imagem não tem referência fixa — produto alto e fino vazava da foto ampliada e saía cortado na miniatura. Agora a imagem ocupa exatamente o quadro (`width/height: 100%`) com `object-fit: contain`, na miniatura, na ampliada e na do relatório; medido no navegador (a foto mais alta da tela, 69×288, inteira nos dois tamanhos). Commit `66da382`. **O mesmo defeito está no `base.css` do [[MOVIMENTAÇÃO DE INVENTÁRIO]] e do [[GESTÃO COMERCIAL TRADE]]** (componente de origem), ainda sem correção · [[2026-10-20 — Gestão Fiscal, região sem tributação e sem preço]]
- **2026-10-20 (16:21)** — **Só produtos com estoque nas filiais 1, 11 ou 12** (Júlio pediu "preciso apenas dos produtos que tem estoque nas filiais 1, 11 e 12, de restante pode manter"; Claude fez): o universo ganha `EXISTS PCEST QTESTGER > 0` nas filiais de `FISCAL_FILIAIS_ESTOQUE` (padrão agora **1,11,12**, que também somam o estoque da tela); "nas três ao mesmo tempo" seriam só 10 produtos, então vale **em pelo menos uma**: **5.328 → 4.274**. Carga das 16:21 com 7 de 7 `OK`; tela sem o filtro de estoque; commit `52a3aa3`; ETL na pasta de rede. **Os 30 min funcionam** (a VM rodou às 16:10:01 e não às 16:15), mas a VM ainda tem o código sem o estoque: **falta o Júlio rodar o `ATUALIZAR AGORA.bat`** (a tarefa já está certa; só o código precisa chegar) · [[2026-10-20 — Gestão Fiscal, região sem tributação e sem preço]]
- **2026-10-20** — **Carga de 30 em 30 minutos** (Júlio pediu "preciso que seja a cada 30 min"; Claude fez): o instalador passa a criar 26 gatilhos, **07:10 a 19:40, aos :10 e :40** (nenhum outro ETL começa nesses minutos), com limite de 25 min por carga (antes 1 h) e `IgnoreNew`; commit `fa15c69`, instalador e `LEIA-ME` copiados para `P:\INTEGRAÇÃO BI\FISCAL`. **Só vale depois que o Júlio rodar o `INSTALAR TUDO.bat` de novo na `SRV-IA`** (que também leva a regra dos ativos para a VM); até lá seguem os 5 horários aos :15 · [[Fiscal - Sync]]
- **2026-10-20 (13:16)** — **Só produtos ATIVOS** (Júlio pediu "apenas produtos ATIVOS e não todos, como: CONSUMO, INATIVOS e etc."; Claude fez): universo do ETL = não excluído, de revenda, **em linha** (`OBS2 <> 'FL'`, o ATIVO dos outros BIs), **fora do fornecedor INATIVOS** (658801), **sem item de consumo** (descrição com "CONSUMO" ou departamento 9) e com `TIPOMERC` preenchido: **7.277 → 5.318 produtos** (tirou 1.864 fora de linha, 26 do fornecedor INATIVOS, 66 de consumo — nenhum com venda em 12 meses — e 3 sem tipo). O `TIPOMERC = 'MC'` não serve: Guaraná Antarctica, Sukita e Água Tônica estão como MC e vendem. Carga das 13:16 com 7 de 7 `OK` (85.088 linhas da 201, conferência igual); tela sem o filtro "Situação do produto"; commit `86b8c4b`. **A VM ainda tem o código antigo** (a carga das 13:15 trouxe os 7.277): ETL copiado para `P:\INTEGRAÇÃO BI\FISCAL`, **falta o Júlio rodar o `ATUALIZAR AGORA.bat` na `SRV-IA`** antes das 16:15 · [[2026-10-20 — Gestão Fiscal, região sem tributação e sem preço]]
- **2026-10-20 (12:01)** — **Conserto: "user not found" na 1ª entrada** (Claude): com as variáveis cadastradas pelo Júlio, a API respondia 502 — o pooler recusava o `SUPABASE_DB_USER` (`EAUTHQUERY user not found in the database`; o código só conferia o final do nome). A `_db.js` passou a aparar espaço e aspas das variáveis e a dizer, se o usuário não bater, exatamente o que chegou (usuário e host no log; da senha, só o tamanho). Commit `c32f5c1`; às 12:01 a entrada do Júlio (`cpd@`) leu versão, dados e fotos; às 13:06 `comercial@lube.com.br` também abriu. Cartão **ativado** no portal às 11:57 (Júlio autorizou: "Ativar e acompanhar") · [[2026-10-20 — Gestão Fiscal, região sem tributação e sem preço]]
- **2026-10-20 (11:32–11:45)** — **No GitHub, na Vercel e na Sentinela** (Júlio pediu "faça um repositório no Github e suba para Vercel"; Claude fez): repositório **público** `Lube-Distribuidora-LTDA/GESTAO-FISCAL` criado pela API do GitHub com a credencial do Git da máquina (a `Lube-Distribuidora-LTDA` é conta de usuário, não organização; o `gh` não está instalado), push do `5e39a30` (varrido: sem ENV, IP ou senha em todo o histórico); projeto Vercel `gestao-fiscal` (`prj_YF4fRNaCEaKmEmjbVTN5ZIpUTjMl`, Root `web`, Other, `gru1`, Node 22.x, Vercel Authentication Standard) ligado ao repositório; registro **antes** do 1º deploy no banco do portal (migração `registrar_gestao_fiscal`: `sentinela.sistemas` com `exige_login`, ícone `fiscal` "GESTÃO FISCAL", cartão **inativo** em CONTABILIDADE); 1º deploy de produção `dpl_BrewyhYaE1EyJHMfQYT6Kr3jebDh` `READY`. O endereço `gestao-fiscal.vercel.app` é de outra conta: o projeto ficou com **`gestao-fiscal-olive.vercel.app`**, corrigido na Sentinela e no cartão (migração `gestao_fiscal_endereco_olive`). Provado de fora, sem login: `/` vai para o portal, `/api/versao` dá `login_necessario`, `/.sentinela/saude` com `oidc: true`, lista ok, modo proteger; IP do escritório sem bloqueio. Push do `ff6776b` (README) publicou sozinho. **Faltam as 5 `SUPABASE_DB_*` (Júlio) e um Redeploy** · [[2026-10-20 — Gestão Fiscal, região sem tributação e sem preço]]
- **2026-10-20 (11:34)** — **Agendado** (Júlio rodou o `INSTALAR TUDO.bat`; esperado na `SRV-IA`, a tela do instalador não mostra a máquina): a carga que o instalador dispara entrou com **7 de 7 `OK`** em ~16 s (preço 9,8 s, conferência igual ao WinThor nas 16 regiões, pacote `20261020-113428`), conferida em `fiscal.controle_carga` · [[Fiscal - Sync]]
- **2026-10-20** — **Sistema criado** (Júlio pediu, Claude fez): schema `fiscal` no DATA WAREHOUSE (migrações `fiscal_01_schema`,
  `fiscal_02_situacao_e_funcao`, `fiscal_03_regioes_escolhidas` — esta pelo pedido do Júlio de só 16 regiões), ETL de 5 consultas
  com conferência × `PCTABPR` na mesma transação de leitura, pacote comprimido, `P:\INTEGRAÇÃO BI\FISCAL` com instalador (**não
  instalado**), painel de 4 telas com guarda da Sentinela (**só local**, `INICIAR.bat`, porta 3103); cargas reais às 10:45 (50
  regiões, 7 passos `OK`) e 11:04 (16 regiões, 7 passos `OK`, pacote `20261020-111314`); commits locais `680f2d5`, `3e28128`
  (chip legível no tema claro) e `5e39a30` (abre na hora com a cópia guardada); `.claude/launch.json` ganha `fiscal` · [[2026-10-20 — Gestão Fiscal, região sem tributação e sem preço]]

Veja também [[Mapa de sistemas]], [[Glossário WinThor]], [[MOVIMENTAÇÃO DE INVENTÁRIO]] (mesmo desenho e componentes) e
[[PAINEL ICMS]] (o outro painel fiscal, do Sérgio, em Supabase próprio).
