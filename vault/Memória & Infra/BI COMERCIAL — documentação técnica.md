---
tipo: nota
departamento: Comercial
status: ativo
levantado_em: 2026-09-28
origem: projeto do Claude "ANÁLISE DE BI (POWER BI)", arquivo BI-COMERCIAL-documentacao-tecnica.md
tags: [bi, comercial, power-bi, documentacao]
---
# BI COMERCIAL — documentação técnica

Levantamento completo do BI **comercial original, no Power BI**, feito em 2026-09-28 para a reconstrução no DATA WAREHOUSE. Resultado da reconstrução: [[BI COMERCIAL]]. Projeto: [[ANÁLISE DE BI (POWER BI)]].

> Esta nota traz tudo, menos o texto integral dos SQLs. Eles estão no documento original do projeto do Claude e, já reescritos, em `Desktop\BI\8. COMERCIAL\etl\consultas_comercial.py`.

## 1. Visão geral
Ferramenta da área de vendas para **acompanhar margem e calcular a comissão dos RCAs**. Responde:
- Quanto cada RCA recebe de **comissão** no período? → páginas TABELA COMISSÃO POR RCA -ST e duplicatas
- Quais itens saíram **abaixo da margem mínima**? → MARGEM X PRODUTO 5% e 10%
- Quais **pedidos em aberto** estão com margem baixa? → CONSULTA MARGEM 21
- Quanto foi **devolvido**, por qual motivo e por qual RCA? → DEVOLUÇÕES e DEVOLUÇÕES POR RCA

Diferente do [[BI COMPRAS]], onde quase tudo está no SQL, **aqui o coração está no DAX**: a regra de comissão é uma cadeia de medidas que termina numa faixa de % sobre a margem líquida.

## 2. Ambiente
| Item | Valor |
|---|---|
| Workspace / modelo / relatório | `COMERCIAL` (ids `64e50e88…`, `b0ce9857…`, `5a377ff9…`) |
| Banco de origem | [[Oracle]] — alias TNS `prod` (WinThor), via gateway. **Muito provavelmente o mesmo `192.168.0.5:1521/wint` do COMPRAS — confirmar com a TI.** |
| Armazenamento | Import (todas as tabelas) |
| Atualização | **8x ao dia**: 07, 08, 09, 10, 13, 15, 16 e 17h. Duração ~8 a 9 min |
| Filiais | 1 (margem, pedidos); 1, 7, 10, 11, 12 (comissão); todas (devoluções) |
| Tamanho do .pbix | ~92 MB |

## 3. Tabelas do modelo
| Original | Nome funcional | Grão | Linhas | Propósito |
|---|---|---|---:|---|
| Consulta1 | DIM_ATUALIZACAO | 1 linha | 1 | Carimbo "Atualizado …" (vira `data_carga`) |
| Consulta2 | FATO_MARGEM_ITEM | item de nota | 3.288.372 | Margem de cada item vendido, filial 1, desde 2023 |
| Consulta3 | FATO_DEVOLUCAO | nota de entrada × motivo | 12.803 | Devoluções de cliente com motivo, desde 2025 |
| Consulta4 | FATO_PEDIDO_ABERTO | pedido | 446 | Foto da carteira não faturada, filial 1 |
| Consulta5 | FATO_POSITIVACAO | ano × mês × cliente × RCA | 184.835 | **Não usada em nenhuma página** |
| Consulta6 | FATO_COMISSAO_NF | nota × operação | 205.503 | Base da comissão, filiais 1/7/10/11/12, desde 2025 |

35 medidas DAX, das quais **17 em uso** e 18 resquícios (3 vazias, 9 presas em datas fixas de 2024, 6 órfãs). 11 colunas calculadas, 4 delas sem uso.

## 4. A regra de comissão — a cadeia completa
```
VENDA (s/ ST)        = Σ  S : QT × (PUNIT − ST)                      [30]
DEVOLUÇÃO (c/ ST)    = Σ ED : QT × PUNITCONT                         [37]
TOTAL LÍQUIDO        = VENDA − DEVOLUÇÃO(c/ ST)                      [44]  ← base do pagamento
TOTAL LÍQUIDO s/ ST  = VENDA − Σ ED : QT × (PUNITCONT − ST)          [Medida 6] ← denominador do %

CMV LÍQUIDO   = CMV venda − CMV devolução + desconto financeiro + CMV bonificação − ST   [45]
MASSA MARGEM  = TOTAL LÍQUIDO s/ ST − CMV LÍQUIDO                                        [46]
% LÍQUIDO     = MASSA MARGEM / TOTAL LÍQUIDO s/ ST                                       [47]
COMISSÃO      = TOTAL LÍQUIDO × faixa(% LÍQUIDO)                     [NOVO 18/10/2023 ST]
```

**Faixas (valem desde 18/10/2023, data que dá nome à medida):**

| % líquido | Comissão |
|---|---:|
| < 20% (inclusive negativa) | 1,0% |
| 20% a 21% | 2,0% |
| 21% a 23% | 2,5% |
| 23% a 26% | 3,0% |
| 26% a 30% | 3,5% |
| ≥ 30% | 4,0% |

### As quatro armadilhas da regra
1. **A comissão não é somável.** A faixa se aplica ao % do contexto do visual. Em fev/2026: total do rodapé **R$ 180.531,96**, soma por RCA × filial **R$ 187.664,93**, soma nota a nota **R$ 188.143,73**. O total da tela não é a soma das linhas.
2. **Base ≠ denominador.** Paga-se sobre `[44]` (devolução **com** ST) mas a faixa sai de `[Medida 6]` (devolução **sem** ST).
3. **ST no CMV.** O CMV de venda já vem com ST e o ST de todas as operações é descontado depois; o CMV de devolução e o de bonificação continuam com ST. Efeito líquido **a validar com o financeiro**.
4. **Duas regras convivendo.** A coluna SQL `COMISSAO` (sem uso) paga 0% para margem negativa e usa `BETWEEN 20.01 AND 21`; a medida DAX paga 1% para qualquer coisa abaixo de 20%. **Vale a DAX**, que é a que aparece na tela.

## 5. As 9 páginas
1–2. **MARGEM X PRODUTO 5%** e **10%** — idênticas; as duas usam a mesma coluna calculada, que testa **< 5%**. Não existe nenhum teste de 10%.
3. **CONSULTA MARGEM 21** — pedidos em aberto; a coluna testa **< 20%** (o "21" do nome não existe na regra). Abria vazia porque o filtro de data ficou salvo em junho/2025.
4. **TABELA COMISSÃO POR RCA -ST** — a principal; 1 linha por RCA × filial, com drill-through para a página 5.
5. **COMISSÃO ST NF** (oculta) — as notas do RCA, com a faixa aplicada nota a nota.
6–7. Duplicatas da 4 e da 5, com pequenas diferenças (a 6 usa `Medida 6` no cartão de total líquido, mas a comissão ao lado continua vindo de `[44]`).
8. **DEVOLUÇÕES** · 9. **DEVOLUÇÕES POR RCA** — a 9 filtra 14 motivos "do vendedor".

## 6. Problemas encontrados
| # | Onde | Problema | Prioridade |
|---|---|---|---|
| 1 | Comissão (DAX) | Total depende da tela: R$ 180,5 mil × 187,7 mil × 188,1 mil no mesmo mês | 🔴 Alta |
| 2 | Comissão (DAX) | Base da comissão ≠ denominador do % | 🔴 Alta |
| 3 | Consulta6 | `VLDESCFIN` da capa repetido em cada linha de operação → desconto somado mais de uma vez | 🔴 Alta |
| 4 | Consulta3 | `VLTOTAL` é o total da NOTA e 81 notas aparecem em mais de uma linha → devolução superestimada | 🔴 Alta |
| 5 | Página 9 | O cartão não tem o filtro de motivos da tabela: R$ 365.013,47 × R$ 156.347,65 na mesma tela | 🔴 Alta |
| 6 | Página 6 | Cartão "total líquido" não é a base da comissão exibida ao lado | 🟡 Média |
| 7 | Consulta2 | Coluna `STATUS 9%` testa < 5%; as páginas "5%" e "10%" usam a mesma | 🟡 Média |
| 8 | Modelo | Único relacionamento é m:n bidirecional por `CODUSUR`; RCA sem venda some das devoluções | 🟡 Média |
| 9 | Consulta6 | Expressão de margem repetida 7× inline | 🟡 Média |
| 10 | MEDIDAS | 18 de 35 medidas vazias, presas em 2024 ou órfãs | 🟡 Média |
| 11 | Consulta5 | 185 mil linhas carregadas e nunca usadas | 🟢 Baixa |
| 12 | Modelo | 6 tabelas de data automáticas, sem calendário; coluna `SUMX` repetindo o total em 205 mil linhas | 🟢 Baixa |

**Medido depois, com o dado carregado (2026-09-28):** o #3 **não acontece** nesta base (desconto antigo e
corrigido iguais nos 21 meses); o #4 existe e é pequeno — 49 notas em mais de uma linha, R$ 9.624,60 em 16
meses. Detalhes em [[BI COMERCIAL]], "O que a carga real revelou".

## 7. Valores de referência (28/09/2026)
**Comissão — 02/02/2026 a 27/02/2026, todas as filiais:**
```
Total vendas s/ ST [30] ................ R$ 9.297.704,78
Total devolução c/ ST [37] ............. R$   271.106,53
TOTAL LÍQUIDO [44] ..................... R$ 9.026.598,25
SUM(TOTAL_LIQUIDO) [Medida 6] .......... R$ 9.031.601,57
TOTAL ST ............................... R$   179.866,47
CMV LÍQUIDO [45] ....................... R$ 7.157.039,00
MASSA DE MARGEM [46] ................... R$ 1.874.562,57
% LÍQUIDO [47] ......................... 20,7556%
Comissão – total geral do visual ....... R$   180.531,96
Comissão – soma por RCA × filial ....... R$   187.664,93
Comissão – soma por NF ................. R$   188.143,73
RCAs com movimento ..................... 145
```
**Devoluções:** 01/06/2025 a 28/09/2026 = **R$ 6.125.108,84** (Σ `VLTOTAL`, todas as filiais).

Esses números estão dentro do `diagnostico_bi_comercial.py`: ele soma os mesmos valores no Oracle e imprime obtido × esperado antes de qualquer carga.

## 8. Tabelas novas no glossário
`PCNFSAID` (capa da NF de saída), `PCNFENT` (capa da NF de entrada), `PCTABDEV` (motivos de devolução). Campos novos de `PCMOV`: `PUNITCONT`, `ST`, `VLOUTROS`, `CUSTOFIN`, `PBONIFIC`, `NUMTRANSVENDA`, `NUMTRANSENT`, `NUMNOTADEV`, `CODFISCAL`. Ver [[Glossário WinThor]].

## 9. A reconstrução: arquivos de banco × migrações no DATA WAREHOUSE
Cada arquivo de `web/db/` do repositório `GESTAO-COMERCIAL` e a migração que o levou ao projeto
`ivcnotrynogaljrvvyes` (hora de Brasília). Conferido em 2026-10-09 pelo histórico de migrações do Supabase.

| Arquivo | Migração | Quando | O que faz |
|---|---|---|---|
| `01-schema.sql` | `comercial_schema_inicial` | 2026-09-28 14:22 | schema `comercial`, os 4 fatos, `dim_faixa_comissao` (vigência 2023-10-18), `dim_motivo_devolucao` (com `responsabilidade_rca`), `controle_carga`; `core.dim_rca`, `core.dim_supervisor`, `core.dim_cliente` (dono: este ETL); RLS ligado sem políticas |
| `02-views-e-funcoes.sql` | `comercial_views_e_painel`, `comercial_painel_dados`, `comercial_painel_dados_clientes_por_rca` | 2026-09-28 14:24 a 14:35 | `comissao_percentual()`, 4 views materializadas (ex.: `mv_margem_mes`), `painel_dados(de, ate)` e `painel_detalhe()`; positivação = clientes distintos do RCA no período. **Substituído em parte pelo 03/04** |
| `03-margem-agregada.sql` | `comercial_margem_agregada` | 2026-09-29 11:16 | `mv_margem_dia` (dia × filial × RCA) e o índice parcial `ix_margem_piores` (`codoper='S' AND venda>0`) |
| `04-painel-dados-v2.sql` | — (mesmo script do 03, sem migração própria) | 2026-09-29 | `painel_dados` lê resumo e ranking da `mv_margem_dia`; só a lista dos piores itens toca a `fato_margem_item`. De 2,4 s (quente) e mais de 60 s (frio) para 0,2 s |
| `05-margem-filial.sql` | `comercial_margem_filial` | 2026-09-30 16:30 | `margem_solicitacao` (fila), `margem_alteracao` (valor anterior de cada produto), `margem_registrar()`, `margem_historico()` |
| `06-margem-estado-e-regra.sql` | `comercial_margem_estado_e_regra` | 2026-09-30 17:38 | `fato_margem_filial` (foto do `PCPRODFILIAL.PERCMARGEMMIN`, índice parcial dos abertos) e a regra "quem abriu é quem fecha" dentro de `margem_registrar` (nome ≥ 3 letras, motivo ≥ 10, filial inexistente recusada) |
| `07-dim-rca-email.sql` | `dim_rca_email` | 2026-10-07 16:30 | `core.dim_rca` ganha `email`, `email2`, `bloqueio`, `dttermino` e índices por `lower(email)` — para o [[SAC]]. O `COMMENT` de `email` foi trocado de "SAQ" para "SAC" em 2026-10-09, fora do histórico de migrações |
| `08-dim-nf-saida.sql` | `dim_nf_saida` | 2026-10-09 10:48 | `core.dim_nf_saida` (capa da NF de saída, `PCNFSAID`, 45 dias, upsert por `numtransvenda`, índice por `numnota`, RLS ligado) — para o [[SAC]] conferir a data de emissão. **Em andamento:** arquivo ainda fora do Git |

As migrações `painel_dados_geradoem_vira_hora_da_carga` e `painel_dados_carga_mais_antiga_na_tela`
(2026-10-05) do mesmo projeto **não são deste sistema** (são do [[BI COMPRAS]], junto do commit `b70531f` dele).

## 10. A reconstrução: onde mora cada coisa no código
Mapa do repositório `GESTAO-COMERCIAL` no commit `21ed527` (2026-10-08), conferido em 2026-10-09. Senha só no
`ENV` da máquina e nas variáveis da Vercel; aqui vão só os nomes.

**`etl/`** — editado em `P:\INTEGRAÇÃO BI\COMERCIAL`, roda em `C:\BI\COMERCIAL` da `SRV-IA`.

| Arquivo | O que faz |
|---|---|
| `consultas_comercial.py` | o catálogo. `dim_rca`, `dim_supervisor`, `dim_cliente` e `dim_motivo_devolucao` rodam **nos dois grupos**; `pedido_aberto`, `devolucao`, `comissao_nf` e `margem_filial` no "rapidas"; `margem_item` no "pesadas". `MOTIVOS_DO_RCA` reconhece os 14 motivos do vendedor apesar de acento, ponto e espaço duplo. Desde 2026-10-09 (sem commit) também a `dim_nf_saida` |
| `sync_bi_comercial.py` | o orquestrador: `--grupo todas/rapidas/pesadas`, `--consulta <nome>`, `--listar`, `--sem-views`. No fim atualiza as views da lista `VIEWS_DO_PAINEL` — **sem a `mv_margem_dia`** (ver [[BI COMERCIAL]]) — e aquece o painel (`_aquecer_painel`) |
| `bi_comum.py` | `definir_schema('comercial')` (o `controle_carga` era fixo em `compras`), `configurar_log`, `carregar_env` (acha o `ENV` também em `1 - CONFIGURACAO`), `tranca_de_carga` (*advisory lock*, 2026-10-08), carga em lotes de 50 mil |
| `diagnostico_bi_comercial.py` | roda as consultas sem gravar e confere os valores da seção 7 ("5) Conferência de valores contra o Power BI") |
| `executar.py` | o lançador que o Agendador chama; `--alvo <arquivo>` inicia outro script (agente e servidor da margem) |
| `agente_margem.py` | a fila da [[Abertura de margem]]: pega o pedido com `FOR UPDATE SKIP LOCKED`, grava o valor anterior e faz o `UPDATE PCPRODFILIAL` com bind, em lotes de 900 produtos (`CODFILIAL` vai como texto). Pedido preso há 15 min volta para a fila; depois de 3 tentativas vira erro |
| `servidor_margem.py` + `painel_margem.html` | o sistema da margem, em `0.0.0.0:8080` (porta trocável por `MARGEM_PORTA`): `/api/estado`, `/api/saude`, `/api/conferir`, `/api/executar` |
| `conferir_margem.py` | só leitura: `--pedido N` confere no WinThor se o pedido foi executado |
| `instalar_e_agendar.ps1` | copia para `C:\BI\COMERCIAL`, testa o modo de agendamento com a tarefa-cobaia "BI Comercial - teste de agendamento" (apagada no fim), cria as quatro tarefas (`RegistrarRepetida` faz a de 1 minuto) e roda uma carga de teste. `-Conferir` só lista |
| `ENV.example` | modelo do `ENV`, só nomes: as chaves do Oracle e do Supabase, `ORACLE_USER_ESCRITA`, `ORACLE_PASSWORD_ESCRITA`, `LOG_LEVEL`. **`MARGEM_PESSOAS` não está nele**: o formato (`"Nome;Nome;Nome"`) está no README e no `servidor_margem.py` |
| `verificar_agendamento.ps1`, `_teste_agendador.py`, `requirements.txt` | conferência das tarefas, a cobaia e as bibliotecas |
| `INSTALAR TUDO.bat`, `CONFERIR SERVIDOR.bat`, `LEIA-ME.txt`, `iniciar_servidor_margem.bat` | vão para a raiz e as subpastas da pasta de rede (2026-10-01) |

**`web/`** — Vercel, projeto `gestao-comercial-web`, Root Directory `web`, Framework Preset "Other".

| Arquivo | O que faz |
|---|---|
| `index.html`, `app.js`, `planilha.js`, `logo-lube.png` | o painel de 5 páginas; `planilha.js` escreve o `.xlsx` |
| `api/_db.js` | conexão com o DATA WAREHOUSE: `ipv4first`, porta 5432, e **recusa usuário de outro projeto** (confere a ref `ivcnotrynogaljrvvyes`, porque a máquina do Júlio tem variáveis de outro Supabase). `descartar(usado)` só encerra o pool da própria chamada |
| `api/dados.js` | `painel_dados(de, ate)`, com cache de CDN de 10 min (`s-maxage=600`, `stale-while-revalidate=3600`); `?atualizar=` fura o cache |
| `api/detalhe.js` | `painel_detalhe()`: as listas grandes, sob demanda |
| `api/margem.js` | só `GET` (estado e histórico da margem, `no-store`). Na primeira versão (`0d2571c`) tinha `POST`, que respondia **423** sem `MARGEM_ATIVA=sim` |
| `vercel.json` | região `gru1`, `maxDuration` de 60 s em `dados` e `detalhe`, cabeçalhos `noindex` e `nosniff` |
| `package.json` | Node 22.x e `pg` |
| `middleware.ts` + `sentinela-guarda.ts` | o guarda da [[SENTINELA LUBE]] (2026-10-06; versão 1.1.0 em 2026-10-07) |
| `db/01` a `db/08` | o banco — seção 9 |

Variáveis na Vercel (só os nomes): `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT` (5432), `SUPABASE_DB_NAME`,
`SUPABASE_DB_USER` e `SUPABASE_DB_PASSWORD`, cadastradas em 2026-09-28. `MARGEM_ENDERECO` é opcional; se já foi
cadastrada não está conferido (pendência em [[BI COMERCIAL]]).

O `web/db/README.md` tem duas frases erradas em 2026-10-09: diz que a `mv_margem_dia` é atualizada pelo ETL (não
é) e que os fatos rápidos carregam "5x/dia" (são 8).

Veja também [[BI COMERCIAL]], [[data-warehouse]] e [[Como eu gosto dos BIs]].
