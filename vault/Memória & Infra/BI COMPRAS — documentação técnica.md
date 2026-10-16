---
tipo: nota
departamento: Compras
status: ativo
levantado_em: 2026-09-18
origem: projeto do Claude "ANÁLISE DE BI (POWER BI)", arquivo BI-COMPRAS-documentacao-tecnica.md
tags: [bi, compras, power-bi, documentacao]
---
# BI COMPRAS — documentação técnica

Levantamento completo do BI COMPRAS **original, no Power BI**, feito em 2026-09-18 para a reconstrução no DATA WAREHOUSE. Resultado da reconstrução: [[BI COMPRAS]]. Projeto: [[ANÁLISE DE BI (POWER BI)]]. As seções 1 a 9 descrevem o Power BI; a **seção 10** descreve o que foi de fato construído (banco, ETL e painel), atualizada em 2026-10-09.

> Esta nota traz tudo, menos o texto integral dos 12 SQLs. Os SQLs completos estão no documento original do projeto do Claude e no repositório `Desktop\BI\6. COMPRAS`.

## 1. Visão geral
Ferramenta de gestão do departamento de compras. Responde:
- Quais produtos vão **faltar** (ruptura)? → aba COMPRAS
- Quais produtos estão **sobrando** (excesso)? → abas COMPRAS e EXCESSO DE ESTOQUE
- **Quanto comprar** de cada fornecedor/produto? → aba SUGESTÃO FORNECEDOR X PRODUTO
- Qual a **cobertura** por item? → aba ESTOQUE x VENDA
- Qual o **saldo de verba** e a **avaria** por fornecedor? → abas SALDO VERBA e SALDO VERBA X AVARIA
- Como está a **performance de faturamento** por comprador? → abas PERFORMANCE COMPRAS e MÉTRICAS

Toda a inteligência está **no SQL** contra o Oracle do [[WinThor]]. O Power BI é quase só apresentação: 3 colunas calculadas e 17 medidas DAX, muitas quebradas. **95% da reconstrução é portar os 12 SELECTs.**

## 2. Ambiente
| Item | Valor |
|---|---|
| Workspace / modelo / relatório | `COMPRAS` (ids `791efdc3…`, `e5fc278e…`, `2080cc86…`) |
| Banco de origem | [[Oracle]] `192.168.0.5:1521/wint` (WinThor / PC Sistemas – TOTVS) |
| Armazenamento | Import (todas as tabelas) |
| Atualização | Diária às 06:30 |
| Filiais | 1, 2, 7, 8, 10, 11, 12 (varia por consulta) |
| Região de preço | `NUMREGIAO = 1` |

Há no workspace um modelo antigo `final`, com atualização falhando desde 28/07/2026. É lixo.

## 3. Tabelas do modelo
| Original | Nome funcional | Grão | Linhas | Propósito |
|---|---|---|---:|---|
| Consulta1 | FATO_RUPTURA_COBERTURA | produto | 7.166 | Base do dashboard: giro, estoque, verba, avaria, RUPTURA e COBERTURA |
| Consulta2 | DIM_ATUALIZACAO | 1 linha | 1 | Carimbo "ATUALIZADO …" (vira `data_carga`) |
| Consulta3 | FATO_SALDO_VERBA | fornecedor principal | 719 | Saldo de verba; KPI VERBA usa `SALDOMOV` |
| Consulta4 | FATO_AVARIA_PRODUTO_FORNECEDOR | produto × fornec. princ. | 26.830 | Ponte produto↔fornecedor principal |
| Consulta5 | FATO_AVARIA_VALOR_PRODUTO | produto | 3.954 | Fonte do KPI AVARIA |
| Consulta6 | FATO_ESTOQUE_X_VENDA | produto | 7.271 | 9 semanas de venda, média aparada, COB e SUG |
| Consulta7 | DIM_COMPRADOR_FORNECEDOR_COM_SUGESTAO | comprador × fornecedor | 269 | Pares com sugestão positiva em 30 dias |
| Consulta8 | DIM_FORNECEDOR | fornecedor | 1.759 | Costura o modelo (fornecedor × comprador) |
| Consulta9 | FATO_EXCESSO_PRODUTO | produto | 2.052 | Excesso: sugestão negativa em 60 dias |
| Consulta10 | FATO_FATURAMENTO | data × UF × supervisor × fornecedor × comprador × depto × seção | 1.615.340 | Sell-out desde 2021 |
| SUGESTÃO PRODUTO | FATO_SUGESTAO_PRODUTO | filial × produto | 1.883 | Sugestão 30 dias por produto |
| SUGESTÃO FORNECEDOR | FATO_SUGESTAO_FORNECEDOR | fornecedor | 144 | Sugestão 30 dias por fornecedor |

## 4. Fórmulas-chave
**Estoque**
```
ESTOQUE DISPONÍVEL  = QTESTGER - QTRESERV - QTBLOQUEADA
EST_BLOQUEADO_SEMAV = QTBLOQUEADA - QTINDENIZ
VALOR AVARIA        = QTINDENIZ × VALORULTENT
```
**Ruptura (Consulta1, SQL):** necessidade de 7 dias (média de venda trimestral ÷ dias úteis do mês × 7) maior que o estoque disponível → `SIM`.
**Cobertura (Consulta1, SQL):** necessidade de 56 dias em caixas maior que o estoque disponível em caixas → `SIM`. **`COBERTURA = NAO` significa excesso de estoque.**

**Consulta6: média aparada, cobertura e sugestão**
```
MEDIA = (vendas das 9 semanas - maior semana - menor semana) / (semanas com venda - 2)
COB   = (EST_DISPONIVEL + EST_BLOQUEADO_SEMAV) / MEDIA      -- cobertura em semanas
SUG   = (MEDIA × 8) - EST_DISPONIVEL, se positivo           -- sugestão para 8 semanas
```
**Faturamento (Consulta10):** `VENDA = QT × (PVENDA - ST)` só `CONDVENDA = 1`; `CMV = (VLCUSTOFIN - ST) × QT`; `MARGEM = (VENDA - CMV) / VENDA × 100`.

**Classificação COBERTURA X ESTOQUE (DAX, Consulta6)**
| COB | Classe |
|---|---|
| venda total = 0 e estoque = 0 | SEM VENDA |
| 0 < COB ≤ 4 | PRECISA COMPRAR |
| 4 < COB < 8 | COBERTURA IDEAL (cai no ELSE) |
| 8 ≤ COB ≤ 15 | COBERTURA EM ATENÇÃO |
| COB > 15 | COBERTURA ALTA |
| COB nulo ou ≤ 0 | COBERTURA IDEAL (falso positivo) |

## 5. KPIs do dashboard (verificados em 2026-09-18, sem filtro)
| Card | Valor | Fórmula real |
|---|---:|---|
| AVARIA | R$ 2.603.850,31 | `SUM(Consulta5[VALOR])` |
| TOTAL ATIVOS | 5.241 | linhas de Consulta1 com STATUS = ATIVO |
| TOTAL DE ITENS | 7.166 | linhas de Consulta1 |
| ITENS C/ RUPTURA | 1.175 | Consulta1[RUPTURA] = SIM (coluna do SQL) |
| VERBA | R$ 2.241.441,83 | `SUM(Consulta3[SALDOMOV])` |
| COBERTURA NAO | 4.775 | Consulta1[COBERTURA] = NAO |
| % EXCESSO ESTOQUE | 66,63% | 4.775 / 7.166 |
| % RUPTURA | 16,40% | 1.175 / 7.166 |

Outros totais de referência: sugestão (aba 4) R$ 6.250.094,00 · excesso (aba 5) −R$ 1.481.596,00 · faturamento 2024 R$ 110.984.488,59 (−9,04%).

## 6. As 8 abas
1. **COMPRAS** — 8 cards de KPI, matriz por comprador (% excesso, % ruptura, avaria, verba, saldo), slicers (comprador, ruptura, cobertura, status, fornecedor) e tabela de detalhe. Fundo azul escuro, logo Lube, botão LIMPAR FILTROS.
2. **SALDO VERBA X AVARIA** — verba − avaria por fornecedor principal; mostra onde a avaria já consumiu a verba.
3. **ESTOQUE x VENDA** — rosca e 5 cards por classe de cobertura (339 precisa comprar · 381 sem venda · 210 alta · 240 atenção · 690 ideal) e tabela com vendas semanais, MEDIA, COB e SUG.
4. **SUGESTÃO FORNECEDOR X PRODUTO** — sugestão por fornecedor e por produto.
5. **EXCESSO DE ESTOQUE** — excesso por fornecedor e por produto (valores negativos).
6. **PERFORMANCE COMPRAS** — sell-out atual × ano anterior, por ano e mês. Tema claro.
7. **MÉTRICAS** — faturamento por fornecedor, departamento e seção, atual × anterior.
8. **SALDO VERBA** — saldo por fornecedor principal.

## 7. Regras de negócio
- **Filiais inconsistentes entre consultas** — a maior falha do BI. Exemplos: estoque disponível em UN usa 1,2,8; em CX usa 1,2,7,8; Consulta6 usa 1,2,7,8,10; faturamento usa 1,10,11,7; sugestão por produto usa 1,7,12.
- **Três definições de sugestão de compra** coexistem (30 dias por giro cadastrado; 8 semanas por média aparada; 60 dias negativo para excesso).
- **Duas definições de ruptura**: SQL (1.175 itens) e DAX `EST_DISP_CX / GIRO_DIA_CX ≤ 7` (1.217 itens).
- **Preços:** `PVENDA` (região 1) para venda; `PTABELA4` ("Tabela 4") para valorizar sugestão e excesso; `PRECOFIXO` promocional tem prioridade na Consulta6; `VLST` (ST) é descontado da venda.
- **Status:** `OBS2 = ' '` → ATIVO; `OBS2 = 'FL'` → FORALINHA. Sempre `REVENDA = 'S'` e, na maioria, `DTEXCLUSAO IS NULL`.
- `CODUSUR NOT IN (1248,1249)` exclui dois RCAs na sugestão por produto (provavelmente vendas internas).

## 8. Problemas encontrados
| # | Onde | Problema | Prioridade |
|---|---|---|---|
| 1 | Consulta4 | Filtro de filial comentado e depois do GROUP BY → soma todas as filiais (diverge R$ 10.149) | Alta |
| 2 | SUGESTÃO FORNECEDOR | `VALOR = SUM(sugestão) × MAX(PTABELA4)` → valor superestimado | Alta |
| 3 | Consulta10 | `CASE WHEN VENDA = 100` (devia ser `= 0`) na margem | Alta |
| 4 | Todas | Filiais diferentes em cada consulta | Alta |
| 5 | Modelo | Relações bidirecionais + muitos-para-muitos → totais ambíguos | Alta |
| 6 | MEDIDAS | 7 de 17 medidas quebradas ou órfãs | Média |
| 7 | Consulta1 | Duas definições de ruptura | Média |
| 8 | Consulta6 | Lógica de MEDIA/COB/SUG repetida 6 vezes inline | Média |
| 9 | Consulta6 | Faixa 4–8 e nulos no mesmo ELSE | Média |
| 10–15 | Vários | Colunas literais fixas, SALDOTOTAL global, `Infinito`/`NaN` na tela, nomes genéricos, tabelas de data automáticas, modelo `final` quebrado | Baixa |

## 9. Roteiro de reconstrução proposto
1. **Staging** por consulta, carga diária às 06:00; faturamento incremental por data.
2. **Modelo estrela:** `dim_produto`, `dim_fornecedor`, `dim_comprador`, `dim_filial`, `dim_calendario` (com dia útil do `PCDATAS`), seção, departamento, supervisor, estado; fatos de posição de estoque, venda semanal, faturamento, verba, avaria e sugestão (com coluna `metodo`).
3. **Padronizar antes de migrar:** conjunto oficial de filiais, uma definição de ruptura e uma de cobertura, corrigir os bugs 1–3, materializar MEDIA/COB/SUG, faixas de cobertura explícitas.
4. **Apresentação:** reproduzir as 8 abas.
5. **Validação:** comparar os KPIs com os valores de referência da seção 5.

## 10. O que foi construído (estado em 2026-10-09)
O roteiro acima foi a proposta. O que está em produção difere dele em alguns pontos, de propósito:
- **Sem padronizar filiais.** Cada consulta manteve as filiais do original; padronizar mexe em número e espera os
  responsáveis (decisão do Júlio, 2026-09-28 — [[2026-09-28 — Comparativo do painel de Compras contra o Power BI]]).
- **Uma definição de ruptura só**, a do SQL (1.175 itens na referência). A segunda, em DAX, não foi trazida.
- **Faturamento sem carga incremental:** recarregado inteiro (TRUNCATE + INSERT) toda madrugada, e só **o ano corrente**
  desde 2026-10-01 ([[2026-10-01 — Faturamento só do ano corrente e o gráfico mensal]]).
- **Bugs do original:** a margem da Consulta10 foi corrigida (`venda = 0`); a sugestão por fornecedor tem `valor`
  (certo) e `valor_original` (o do Power BI); a avaria da Consulta4 reproduz o original (soma todas as filiais), com
  aviso no comentário da tabela; o `PCPRODUT.OBS2` segue pendente.

### Tabelas no DATA WAREHOUSE ([[Supabase]], `ivcnotrynogaljrvvyes`)
Todas com RLS ligado e sem políticas. Linhas aproximadas em 2026-10-09.

| Objeto | Origem | Linhas |
|---|---|---:|
| `core.dim_produto`, `core.dim_fornecedor`, `core.dim_comprador` | PCPRODUT, PCFORNEC, PCEMPR (upsert; o COMPRAS é o dono) | 7.287 · 1.768 · — |
| `compras.fato_ruptura_cobertura` | Consulta1 | 7.244 |
| `compras.fato_saldo_verba` | Consulta3 (histórico inteiro) | 721 |
| `compras.fato_avaria_prod_fornec` | Consulta4 | 26.928 |
| `compras.fato_avaria_produto` | Consulta5 (fonte do KPI AVARIA) | 3.763 |
| `compras.fato_estoque_venda` | Consulta6 | 7.244 |
| `compras.dim_comprador_fornec_sugestao` | Consulta7 | 282 |
| `compras.fato_excesso_produto` | Consulta9 | 2.055 |
| `compras.fato_faturamento` | Consulta10 (ano corrente) | ~259 mil |
| `compras.fato_sugestao_produto` / `compras.fato_sugestao_fornecedor` | SUGESTÃO PRODUTO / FORNECEDOR | 1.792 / 129 |
| `compras.controle_carga` | log de cada consulta em cada carga | — |
| `stg_compras.stg_ruptura_cobertura`, `stg_compras.stg_estoque_venda` | staging (vazias; da primeira versão) | 0 |
| `compras.mv_fat_*` (9 views materializadas) | agregados do faturamento, refresh no `pos_carga` | — |

O comentário de `compras.fato_faturamento` no banco ainda diz "desde 2021" (desatualizado desde 2026-10-01).

### Migrações (o que cada uma fez)
| Data | Migração | O que fez |
|---|---|---|
| 2026-09-18 | `create_schemas` | schemas `core`, `compras` e `stg_compras` |
| 2026-09-18 | `create_core_dimensions` | `core.dim_produto`, `dim_fornecedor`, `dim_comprador` |
| 2026-09-18 | `create_staging_and_fato_ruptura_cobertura` | staging e o primeiro fato (Consulta1) |
| 2026-09-22 | `add_fato_estoque_venda` | fato da Consulta6 (9 semanas, MEDIA, COB, SUG) |
| 2026-09-22 | `bi_compras_todas_as_consultas` | as tabelas das demais consultas |
| 2026-09-22 | `dim_produto_add_fornec_comprador` | fornecedor e comprador na dimensão de produto |
| 2026-09-22 | `relaxar_pks_fatos_ate_validacao` | chaves primárias dos fatos afrouxadas até a validação do grão |
| 2026-09-22 | `habilitar_rls_todas_as_tabelas` | RLS ligado e sem políticas em todas as tabelas |
| 2026-09-22 | `views_materializadas_faturamento` | as 9 `compras.mv_fat_*` |
| 2026-09-22 | `funcao_painel_dados` | `compras.painel_dados()`, que devolve o JSON inteiro do painel |
| 2026-10-05 | `painel_dados_geradoem_vira_hora_da_carga` | o `geradoEm` deixa de ser `now()` e passa a vir do `controle_carga` |
| 2026-10-05 | `painel_dados_carga_mais_antiga_na_tela` | `geradoEm` = carga OK mais antiga da tela (7 dias); campo `cargas {estoque, faturamento}` |

Datas em UTC, pela versão da migração. As de 2026-09-18 e 2026-09-22 estão descritas pelo nome e pelo código do
repositório; o SQL exato de cada uma fica no histórico de migrações do próprio banco. As duas de 2026-10-05 foram
descritas na conversa em que nasceram ([[2026-10-05 — Painel de Compras lento de manhã e a Última carga]]).

As demais migrações do projeto são de outros sistemas: `comercial_*` ([[BI COMERCIAL]]), `reposicao_*`
([[REPOSIÇÕES E CHAMADOS]]), `dim_rca_email` (e-mail em `core.dim_rca`, dimensão do COMERCIAL usada pelo [[SAC]]) e
`dim_nf_saida` (2026-10-09: `core.dim_nf_saida`, capa das NFs de saída, também do COMERCIAL e usada pelo SAC).
Conferido em 2026-10-09: 26 migrações no projeto, 12 delas do COMPRAS.

### ETL (`etl/`, editado em `P:\INTEGRAÇÃO BI\COMPRAS`, executado na VM SRV-IA)
- 13 consultas no catálogo `consultas_compras.py`: 12 no grupo `rapidas` (3 dimensões + 9 fatos) e o `faturamento` no
  grupo `pesadas`, que também faz o refresh das 9 views.
- `COMPRADORES_EXCLUIDOS = (621, 278, 376, 375, 277, 178)` no `SQL_DIM_COMPRADOR`, com o impacto medido no comentário.
- `_data_inicial()` = 1º de janeiro do ano corrente; `FATURAMENTO_DATA_INICIAL` no `ENV` sobrepõe.
- `bi_comum.py`: `conectar_supabase()` com `connect_timeout` 20 s, keepalive e `statement_timeout` 120 s (2026-09-28).
- Agendamento: `executar.py`, `_teste_agendador.py`, `instalar_e_agendar.ps1`, `testar_agora.ps1` e
  `verificar_agendamento.ps1` — **em uso e fora do Git**.

### Painel (`web/`, projeto `painel-compras` na [[Vercel]])
- `index.html`: as 8 páginas, o "kit" de clique que abre a planilha filtrada, os pop-ups e o chat. Lista
  `COMPRADORES_EXCLUIDOS` com os mesmos 6 códigos; `HORAS = [0,8,12,18]` para o "Próxima".
- `api/dados.js`: `SELECT compras.painel_dados()`, porta 6543, um `Pool` (max 1) guardado entre chamadas quentes,
  3 tentativas, `statement_timeout` 25 s; `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400,
  stale-if-error=86400`.
- `api/agente.js` + `agente.js` + `planilha.js`: o assistente (modelo `claude-sonnet-5`, chave em `ANTHROPIC_API_KEY`).
- `middleware.ts` + `sentinela-guarda.ts`: guarda da [[SENTINELA LUBE]], modo fechado (`painel-compras` / `gestao-compras`).
- `vercel.json`: `maxDuration` 30 s nas duas funções e os cabeçalhos de segurança; **sem crons** desde 2026-10-06.

Glossário das tabelas do WinThor: [[Glossário WinThor]].
