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

- Pasta: `Desktop\BI\17. FISCAL` (README, `etl/`, `web/`, `INICIAR.bat`) · Git local (`main` = `5e39a30`) · **ainda não está no
  GitHub nem na Vercel** (precedente do Trade e do Inventário: o Júlio cria o repositório e cadastra as senhas).
- Carga: `P:\INTEGRAÇÃO BI\FISCAL` (`1 - CONFIGURACAO` com o `ENV` copiado do de leitura do Inventário, `2 - SISTEMA FISCAL`,
  `3 - INSTALACAO`, `INSTALAR TUDO.bat`, `ATUALIZAR AGORA.bat`, `DIAGNOSTICO.bat`, `LEIA-ME.txt`). Rotina: [[Fiscal - Sync]]
  (**ainda não agendada**).
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
- **Produtos de revenda não excluídos** (7.277): o de uso e consumo (`REVENDA = 'N'`) não tem preço por região. Fora de linha entra.
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
- 2026-10-20 (Claude): **cargas aos :15**, 07:15, 10:15, 13:15, 16:15 e 19:15 (Inventário :05, Trade :25, Reposições :35, Comercial
  :45, Compras :50). Carga medida em 2026-10-20 com o banco lento: ~9 min (produto 136 s, preço 263 s, pacote 62 s).
- 2026-10-20 (Claude): **GitHub, Vercel e agendamento ficam com o Júlio** (precedente do Trade e do Inventário).

## Pendências
- [ ] **Júlio:** confirmar se a **região 1 (Espírito Santo)** fica mesmo de fora (é uma linha no `ENV`: `FISCAL_REGIOES`).
- [ ] **Júlio:** criar o repositório no GitHub (público, como os outros, para o deploy do Hobby) — o Claude sobe o código, cria o
  projeto `gestao-fiscal` na Vercel e registra na [[SENTINELA LUBE]]; o Júlio cadastra as 5 `SUPABASE_DB_*`.
- [ ] **Júlio:** `P:\INTEGRAÇÃO BI\FISCAL\INSTALAR TUDO.bat` na `SRV-IA`; o Claude confere em `fiscal.controle_carga`.
- [ ] Ligar no [[GUARDIÃO DA LUBE]] (rotina, tarefa e site), depois do agendamento.
- [ ] Fiscal/Compras: revisar os itens de consumo marcados como revenda e a tributação da região 27.
- [ ] Ideias (não pedidas): tela de **Tributações** (o mesmo produto com CODST diferente em regiões da mesma UF); NCM × tributação.

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-20** — **Sistema criado** (Júlio pediu, Claude fez): schema `fiscal` no DATA WAREHOUSE (migrações `fiscal_01_schema`,
  `fiscal_02_situacao_e_funcao`, `fiscal_03_regioes_escolhidas` — esta pelo pedido do Júlio de só 16 regiões), ETL de 5 consultas
  com conferência × `PCTABPR` na mesma transação de leitura, pacote comprimido, `P:\INTEGRAÇÃO BI\FISCAL` com instalador (**não
  instalado**), painel de 4 telas com guarda da Sentinela (**só local**, `INICIAR.bat`, porta 3103); cargas reais às 10:45 (50
  regiões, 7 passos `OK`) e 11:04 (16 regiões, 7 passos `OK`, pacote `20261020-111314`); commits locais `680f2d5`, `3e28128`
  (chip legível no tema claro) e `5e39a30` (abre na hora com a cópia guardada); `.claude/launch.json` ganha `fiscal` · [[2026-10-20 — Gestão Fiscal, região sem tributação e sem preço]]

Veja também [[Mapa de sistemas]], [[Glossário WinThor]], [[MOVIMENTAÇÃO DE INVENTÁRIO]] (mesmo desenho e componentes) e
[[PAINEL ICMS]] (o outro painel fiscal, do Sérgio, em Supabase próprio).
