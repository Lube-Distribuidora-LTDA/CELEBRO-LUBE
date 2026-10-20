---
tipo: conceito
departamento: Memória & Infra
status: ativo
tags: [winthor, glossario, conceito]
---
# Glossário WinThor

Tabelas `PC*` do [[WinThor]] ([[Oracle]]) usadas nos BIs. Levantado na análise do BI COMPRAS ([[BI COMPRAS — documentação técnica]]) e completado com o [[BI COMERCIAL]], o [[SAC]], o [[REPOSIÇÕES E CHAMADOS]], o [[PAINEL ICMS]], o [[MOVIMENTAÇÃO DE INVENTÁRIO]] e o [[GESTÃO FISCAL]].

| Tabela | Conteúdo | Campos mais usados |
|---|---|---|
| `PCPRODUT` | Cadastro de produtos (rotina **203**) | `CODPROD`, `DESCRICAO`, `CODFORNEC`, `QTUNIT`, `QTUNITCX`, `UNIDADE`, `UNIDADEMASTER`, `CODAUXILIAR` (EAN), `CODAUXILIAR2` (DUN), `CODSEC`, `CODEPTO`, `OBS2`, `REVENDA` (`N` = uso e consumo), `NBM` (NCM), `DTCADASTRO`, `DTEXCLUSAO` |
| `PCEST` | Estoque por produto e filial | `QTESTGER`, `QTRESERV`, `QTBLOQUEADA`, `QTINDENIZ`, `QTGIRODIA`, `VALORULTENT`, `QTVENDMES1/2/3`, `CODFILIAL` |
| `PCMOV` | Movimentação (itens faturados) | `CODPROD`, `QT`, `CODOPER` (`S` = saída, `ED` = devolução de cliente, `SB` = saída bonificada), `DTMOV`, `DTCANCEL`, `CODFILIAL`, `CODUSUR`, `CODCLI`, `PUNIT`, `PUNITCONT` (preço contábil), `ST`, `VLOUTROS`, `CUSTOFIN` (CMV), `PBONIFIC`, `NUMTRANSVENDA`, `NUMTRANSENT`, `NUMNOTADEV`, `CODFISCAL` |
| `PCTABPR` | Tabela de preços por região — é o que a rotina **201** (Precificar Produto) grava: uma linha por produto × região | `CODPROD`, `NUMREGIAO`, `PVENDA` (preço de venda), `PTABELA`, `PTABELA4`, `VLST`, **`CODST`** (a **tributação de saída da região**, aponta para a `PCTRIBUT`; é a coluna "Tributação" da 201), `DTULTALTPVENDA`, `ROTINA` (quem alterou: 201, 552, 507), `EXCLUIDO`. Usada pelo [[GESTÃO FISCAL]] |
| `PCTABTRIB` | Tributação **por UF** (filial da NF × UF de destino) | `CODPROD`, `CODFILIALNF`, `UFDESTINO`, `CODST`, `CODTRIBPISCOFINS`. **Desligada na Lube** (`PCPARAMFILIAL.CON_USATRIBUTACAOPORUF = 'N'`, `PCCONSUM.USATRIBUTACAOPORUF = 'N'`, 2026-10-20): só filial 1 × ES, uma linha por produto, quase toda CODST 0 — a tributação que vale é a da `PCTABPR` |
| `PCTRIBUT` | Tipos de tributação (rotina **514**) — 798 códigos | `CODST`, `MENSAGEM`, `OBS`, `SITTRIBUT` (CST), `CODICM` (alíquota de ICMS), `CODICMTAB`, `IVA`, `PERCBASERED`, `CODFISCAL` / `CODFISCALINTER` (CFOP) |
| `PCREGIAO` | Regiões de preço (50) | `NUMREGIAO`, `REGIAO`, `UF`, `CODFILIAL` (99 = todas), `STATUS` (A/I; nulo = ativa) |
| `PCPRACA` | Praças | `CODPRACA`, `NUMREGIAO` — a região do cliente que não tem região própria |
| `PCPRECOPROM` | Preço promocional | `PRECOFIXO`, `DTFIMVIGENCIA`, `NUMREGIAO`, `CODFILIAL`, `CODCLI` |
| `PCFORNEC` | Fornecedores | `CODFORNEC`, `FORNECEDOR`, `CODFORNECPRINC`, `CODCOMPRADOR` |
| `PCEMPR` | Funcionários (compradores) | `MATRICULA`, `NOME` |
| `PCMOVCRFOR` | Movimento de crédito/verba de fornecedor | `TIPO` (`D` = entrada, `C` = saída), `VALOR`, `DATA`, `NUMVERBA`, `CODFORNEC`, `CODFILIAL`, `CODCONTA`, `CODFUNC` |
| `PCESTCRFOR` | Saldo de crédito por fornecedor e filial | `VALOR` |
| `PCVERBA` | Cadastro de verbas | `NUMVERBA`, `DTVENC` |
| `PCCONTA` | Plano de contas | `CODCONTA`, `CONTA` |
| `PCPEDC` / `PCPEDI` | Pedido de **venda** (capa / itens) | `NUMPED`, `DATA`, `CODCLI`, `CONDVENDA`, `POSICAO`, `CODFILIAL`, `CODUSUR`, `QT`, `PVENDA`, `ST`, `VLCUSTOFIN` |
| `PCPEDIDO` / `PCITEM` | Pedido de **compra** (capa / itens) | `NUMPED`, `QTPEDIDA`, `QTENTREGUE` |
| `PCCLIENT` / `PCCIDADE` | Clientes e cidades (cliente = rotina **302**) | `CODCLI`, `CODCIDADE`, `UF`, `CODPRACA`, **`NUMREGIAOCLI`** (região própria do cliente; vazia = a da praça), `DTEXCLUSAO`, `BLOQUEIO`, `DTULTCOMP` |
| `PCUSUARI` / `PCSUPERV` | RCAs e supervisores | `CODUSUR`, `CODSUPERVISOR`, `NOME`, `CODEQUIPE`; no `PCUSUARI`, desde 2026-10-07, também `EMAIL`, `EMAIL2` (o ETL apara os espaços das pontas), `BLOQUEIO` (S/N) e `DTTERMINO` (preenchida = RCA desligado) — vão para `core.dim_rca` e são usados pelo [[SAC]] |
| `PCSECAO` / `PCDEPTO` | Seção e departamento | `CODSEC`, `CODEPTO`, `DESCRICAO` |
| `PCUNIDADE` | Unidades de medida | `UNIDADE`, `DESCRICAO` |
| `PCDATAS` | Calendário com dia útil | `DATA`, `DIAUTIL` |
| `PCNFSAID` | Capa da NF de saída | `NUMTRANSVENDA` (único por nota), `NUMNOTA` (**repete entre filiais**), `DTSAIDA` (emissão, **sem hora**), `DTCANCEL`, `ESPECIE` (NF, CO, CE, NS), `CODCLI`, `CODUSUR`, `CONDVENDA`, `VLDESCFIN`, `VLCUSTOFIN`, `VLTOTAL`. ~21 mil notas/mês (2026). Vai para `core.dim_nf_saida` (45 dias) — ver [[SAC]] |
| `PCNFENT` | Capa da NF de entrada | `NUMTRANSENT`, `NUMNOTA`, `VLTOTAL`, `CODDEVOL` |
| `PCNFBASEENT` | Base fiscal das NFs de entrada (rotina **8086**) — usada pelo [[PAINEL ICMS]] | `CODFILIALNF`, `DTENTRADA`, `NUMNOTA`, `NUMTRANSENT`, `CODFISCAL` (CFOP), `UF`, `SITTRIBUT` (CST), `PERCICM`, `VLDESDOBRADO` (valor contábil, **é o total**), `VLBASE`, `VLISENTAS`, `VLOUTRAS`, `VLICMS`, `VLIPI` |
| `PCNFBASESAID` | Base fiscal das NFs de saída (rotina **8087**) — usada pelo [[PAINEL ICMS]] | `CODFILIALNF`, `DTSAIDA`, `NUMNOTA`, `NUMTRANSVENDA`, `SERIE`, `ESPECIE`, `CODFISCAL`, `UF`, `SITTRIBUT`, `PERCICM`, os mesmos valores da entrada e mais `VLBASE_REDUCAO`, `BASEST`, `VLST` |
| `PCCFO` | Natureza de operação (CFOP) | `CODFISCAL`, `DESCCFO` |
| `PCPRODFILIAL` | Produto por filial | `CODPROD`, `CODFILIAL` (**texto**: comparar com bind de texto), `PERCMARGEMMIN` (margem mínima; `NULL` = "aberto", vende abaixo do piso; o padrão da casa é 5). É o que a [[Abertura de margem]] altera |
| `PCTABDEV` | Motivos de devolução | `CODDEVOL`, `MOTIVO` |
| `PCMANIF` | Chamados / manifestações do SAC (capa) — rotinas **1902** (registrar) e **1905** (consultar/manter); `SITUACAO` AB aberto, PR providência, SO solucionado, RT; `CODFUNCAB` quem abriu; `MANIFESTACAO` o texto; sem gatilho | `NUMMANIF` (nº do chamado), `NUMSEQ`, `DTAB` (abertura), `CODASSUNTO`, `NUMNOTA`, `CODCLI`, `CODFILIAL` (texto!), `CODMOTORISTA`, `SITUACAO` |
| `PCMANIFPROD` | Produtos reclamados no chamado | `NUMMANIF`, `CODPROD`, `QTRECLAMADA`, `NUMNOTA`, `CODMOTORISTA` — (chamado, produto) repete em 2 linhas |
| `PCCONSUM` | Parâmetros e contadores gerais | `PROXNUMMANIF` — próximo número de manifestação (chamado); quem grava chamado fora do WinThor precisa tirar o número daqui |
| `PCSUPERV` | Supervisores | `CODSUPERVISOR`, `NOME`, `EMAIL` (**vazio em todos os 21 ativos**, 2026-10-09), `COD_CADRCA` (o código de RCA do próprio supervisor), `DTDEMISSAO`, `POSICAO` (A/I), `CODGERENTE` — rotina **516** |
| `PCMANASSUNTO` | Assuntos (= **motivos**) de chamado | `CODASSUNTO`, `ASSUNTO` (corta em 30 caracteres), `CODSETOR`, `PRAZO1..4`, `CODFUNC1..4` (responsáveis), `ATIVO`, `INTERNO`, `OBRIGAQTDE`. Os assuntos **"SAC - ..." (65 a 73, setor 12)** são os do RCA — usados no [[SAC]] |
| `PCROTINA` | Catálogo de rotinas | `CODIGO`, `NOMEROTINA`, `ROTINA` — onde se descobre o que é a rotina 8352 |
| `PCLOGDESBLOQUEIO` | Livro do estoque **bloqueado** (rotina **266** e companhia): uma linha por bloqueio, desbloqueio, avaria, devolução que entra bloqueada, liberação do WMS — usado pelo [[MOVIMENTAÇÃO DE INVENTÁRIO]]. **Cada programa grava os campos de um jeito** (tabela de leitura na nota do sistema) | `DTDESBLOQUEIO` (com hora), `CODFILIAL` (texto), `CODPROD`, `CODFUNCDESBLOQUEIO`, `CODDEVOL` (motivo, da `PCTABDEV`), `PROGRAMA`, `QTBLOQUEADA`, `QTDESBLOQUEADA`, `QTINDENIZ`, `QTBLOQUEADAANT`, `QTINDENIZANT`, `NUMTRANSENT`. Índice por data. Sem chave primária |
| `PCINVENTROT` | Inventário rotativo (rotina **1147**): um produto contado por linha | `NUMINVENT`, `DATA`, `CODFILIAL`, `CODPROD`, `CODLOCAL`, `QT1`/`QT2`/`QT3` (contagens; só a 1ª é usada hoje), `QTESTGER` (estoque na montagem), `CUSTO`, `DATACONT1`, `CODFUNCCONT1`, `DTATUALIZACAO`, `CODFUNCATUALIZACAO`, `DTCANCEL` |
| `PCLOGATUALIZAINVENT` | O que a atualização da 1147 lançou no estoque, **só para os produtos com diferença** | `NUMINVENT`, `CODPROD`, `CODFILIAL`, `QTINVENT`, `QTESTGER`, `QTDIF` (sempre positivo), `VLDIF`, `VLCUSTO`, `CUSTOUTILIZADO` (`F` = custo financeiro), `TIPOAJUSTE` (`EI` sobra / `SI` falta). Bate com o PCMOV EI/SI de `ROTINACAD` 1147 |
| `PCEMPR` | Funcionários (quem bloqueia, conta, atualiza) | `MATRICULA`, `NOME`, `NOME_GUERRA`, `FUNCAO`, `SITUACAO`. Matrícula **1 = PCADMIN** (é quem aparece nas liberações do WMS) |
| `PCFILIAL` | Filiais | `CODIGO` (texto), `RAZAOSOCIAL`, `FANTASIA`, `CIDADE`, `UF`. Distribuição: 1 (Cariacica), 7 (Somar), 10 e 12 (Itaperuna), 11 (Teixeira de Freitas); 3, 4 e 6 são SERMAR, L LOG e Império |
| `PCLOGESTOQUE` | Log de toda alteração do PCEST (antes/depois de estoque, bloqueado, avaria, custos), com `PROGRAMA` e `USUARIO` | ~218 milhões de linhas em 2026-10-19: só consultar por produto e data |

## Conceitos do negócio
- **Estoque disponível** = `QTESTGER - QTRESERV - QTBLOQUEADA`.
- **Avaria** = quantidade indenizada (`QTINDENIZ`) × valor da última entrada.
- **Verba** = crédito do fornecedor (entradas `D` menos saídas `C` em `PCMOVCRFOR`).
- **Fornecedor principal** (`CODFORNECPRINC`) agrupa fornecedores do mesmo grupo.
- **Tabela 4** (`PTABELA4`) = preço de referência para valorizar sugestão e excesso.
- **Status:** `OBS2 = ' '` ativo; `OBS2 = 'FL'` fora de linha.
- **Venda sem ST** = `QT × (PUNIT − ST)`; **devolução** = `QT × PUNITCONT` (com ST) ou `QT × (PUNITCONT − ST)` (sem). As duas convivem no cálculo da comissão — ver [[BI COMERCIAL — documentação técnica]].
- **Margem líquida do RCA** = (total líquido − CMV líquido) / total líquido. A faixa de comissão sai dela.
- **Reposição** = pedido de venda lançado no vendedor **`CODUSUR = 999` ("REPOSICAO")**, faturado (`POSICAO = 'F'`), que repõe ao cliente o que deu errado numa entrega. A NF original vai escrita à mão em `PCPEDC.OBS`/`OBS1` ("PEND. REF. A NF 1504784"). `PCPEDC.VLTOTAL` é o total do **pedido** — somar esse campo por item conta o pedido várias vezes. Ver [[REPOSIÇÕES E CHAMADOS]].
- **ICMS de entrada / ICMS de saída**: é assim que a Lube fala, **nunca "débito/crédito"** (Júlio, 2026-09-08). As rotinas **8086** (entradas) e **8087** (saídas), dentro da rotina **800** (Relatórios), são a origem do [[PAINEL ICMS]]. Identidade V1: `VLDESDOBRADO = VLBASE + VLISENTAS + VLOUTRAS`.
- **Estoque bloqueado** = `PCEST.QTBLOQUEADA`; a **avaria** (`QTINDENIZ`) é parte dele. Entra bloqueado: bloqueio manual
  na **266**, devolução de cliente (1303/1346/1361) e o **recebimento de compra (1301) — este sem registro no livro**; sai pelo
  desbloqueio da 266 (inclusive o "Conferido pelo recebimento" das filiais sem WMS) e pela liberação do **WMS da Kaizen** depois
  da armazenagem. A **1316** (cancelar devolução) estorna a entrada sem mexer no bloqueado. Ver [[MOVIMENTAÇÃO DE INVENTÁRIO]].
- **Tributação e preço por região:** a **201** (Precificar Produto) grava preço de venda e tributação de saída (`CODST`) na
  `PCTABPR`, região a região; a **574** (Cadastrar Tributação nos Produtos) e a **271** também mexem na tributação; a **514**
  cadastra os tipos (`PCTRIBUT`). "Região sem tributação" = CODST vazio; "sem preço" = `PVENDA` zero ou vazio. Ver [[GESTÃO FISCAL]].
- **Rotinas de inventário:** **1147** manutenção do inventário rotativo (lança EI/SI no estoque gerencial); **1188** atualização
  contábil de inventários (EI/SI no contábil); **1148** inventário de número de série; **266** bloquear produtos no estoque;
  **1182** gestão de avarias.
- **Chamado** = manifestação do SAC em `PCMANIF`; o **motivo** é o `ASSUNTO`. Rotinas personalizadas do módulo 8000 (`PCSIS800`): **8351** Histórico de Reposição, **8352** Pedido de Reposição, **8353** Relatório Geral de Chamados.

## Registro de mudanças
- **2026-10-20** — Entraram `PCTABTRIB`, `PCTRIBUT`, `PCREGIAO`, `PCPRACA`, o `CODST` da `PCTABPR`, o `NUMREGIAOCLI` do `PCCLIENT`, o `NBM` do `PCPRODUT` e as rotinas 201/203/302/514/574 (do [[GESTÃO FISCAL]]).
- **2026-10-19** — Entraram `PCLOGDESBLOQUEIO`, `PCINVENTROT`, `PCLOGATUALIZAINVENT`, `PCEMPR`, `PCFILIAL`, `PCLOGESTOQUE`, o conceito de estoque bloqueado e as rotinas de inventário (do [[MOVIMENTAÇÃO DE INVENTÁRIO]]).
- **2026-10-09** — Entraram `PCNFBASEENT`, `PCNFBASESAID`, `PCCFO` e o termo "ICMS de entrada/saída" (do [[PAINEL ICMS]]), `PCPRODFILIAL` (da [[Abertura de margem]]) e os campos de e-mail e situação do `PCUSUARI` (do [[SAC]]). Compilado do Git e das sessões.
