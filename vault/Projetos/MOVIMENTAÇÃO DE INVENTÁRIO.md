---
tipo: projeto
departamento: Logística
status: ativo
inicio: 2026-10-19
tags: [bi, inventario, estoque, bloqueio, avaria, wms, winthor]
---
# MOVIMENTAÇÃO DE INVENTÁRIO

Painel de **tudo o que mexe no estoque do galpão**, pedido pelo Júlio em 2026-10-19 ("visualizar todas as
movimentações que estão acontecendo no meu galpão"), a partir de duas rotinas do [[WinThor]], no padrão da casa
([[data-warehouse]]): WinThor → ETL em Python → [[Supabase]] (schema `inventario` do DATA WAREHOUSE) → painel.
Conversa de origem: [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]].

| Rotina | Nome no WinThor | De onde vem |
|---|---|---|
| **266** | Bloquear Produtos no Estoque (`PCSIS266`) | `PCLOGDESBLOQUEIO` — o livro de tudo o que entra e sai do estoque **bloqueado** |
| **1147** | Manutenção de inventário rotativo (`PCSIS1147`) | `PCINVENTROT` (o que foi contado) + `PCLOGATUALIZAINVENT` (a diferença lançada: EI sobra, SI falta) |

Mais o `PCEST` de hoje (estoque, bloqueado, avaria, custo financeiro).

- Pasta: `Desktop\BI\16. INVENTARIO` (README, `etl/`, `web/`, `INICIAR.bat`) · Git **só local** (commit `b9554f9`, branch `main`) ·
  **ainda sem GitHub e sem Vercel** (decisão do Júlio, ver Pendências).
- Carga: `P:\INTEGRAÇÃO BI\INVENTARIO` (`1 - CONFIGURACAO` com o `ENV` copiado do de leitura do REPOSIÇÕES, `2 - SISTEMA INVENTARIO`,
  `3 - INSTALACAO`, `INSTALAR TUDO.bat`, `ATUALIZAR AGORA.bat`, `DIAGNOSTICO.bat`, `LEIA-ME.txt`). Rotina: [[Inventário - Sync]].
  **Ainda não agendada** (é o `INSTALAR TUDO.bat` na `SRV-IA`, com o Júlio).
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

**O recebimento de compra (1301) entra bloqueado e o WinThor NÃO registra esse bloqueio no livro**, só a liberação (pelo WMS,
ou na 266 com o motivo "Conferido pelo recebimento", nas filiais sem WMS). Por isso, no livro, sai muito mais do que entra: o
painel não mostra "saldo do período"; mostra o bloqueado de hoje (PCEST).

## Banco: schema `inventario` (DATA WAREHOUSE, ~51 MB)
Migrações (versionadas em `web/db/`; a 02 é a definição vigente): `inventario_01_schema` (tabelas, RLS sem políticas),
`inventario_02_views_e_funcao` (`vw_movimento`, `vw_inventario`, `painel_dados()`), `inventario_03_fotos`,
`inventario_04_estoque_completo`, `inventario_05_custo_6_casas`, `inventario_06_ajuste_cheio`.
- Fatos: `fato_bloqueio` (201 mil desde 2025), `fato_inventario` (5.326 contagens, 648 inventários), `fato_posicao` (8.837 linhas do PCEST).
- Cadastros próprios: `produto` (o `core.dim_produto` não tem departamento/seção/embalagem — exceção consciente), `funcionario`, `motivo`, `filial`.
- `controle_carga` e `painel_cache` (o pacote do painel em **gzip**, ~1,2 MB; JSON de ~8,9 MB).
- `painel_dados()` lê `trade.produto_miniatura` **só** para saber quais produtos têm foto (leitura, não carga).

## O painel (7 telas)
Visão geral ("o que está acontecendo no galpão") · Bloqueios e avarias (266) · Devoluções e WMS (com o **tempo até o WMS
liberar** cada devolução, medido pela transação de entrada) · Bloqueado hoje (com **há quanto tempo está bloqueado**) ·
Inventário rotativo (1147: acurácia, sobra, falta, quem contou, produtos que sempre divergem) · **Análise livre** (base ×
linhas × colunas × medida, com calor e Excel) · Movimentações (linha a linha).
No padrão de [[Como eu gosto dos BIs]]: cara do Gestão Comercial (azul-marinho e ouro), filtros de múltipla escolha com busca
(vazio = todos), períodos rápidos + datas livres, comparação com o período anterior e o ano anterior, **todo clique abre o
relatório do recorte** (Voltar; Ctrl+clique filtra), foto do produto (a do [[GESTÃO COMERCIAL TRADE]]), Excel formatado, link da
visão, tema claro/escuro, modo apresentação. O navegador filtra e soma (como o [[REPOSIÇÕES E CHAMADOS]]): 201 mil movimentos,
telas em 25–90 ms; o pacote fica guardado no navegador e só é baixado de novo quando a carga gera outro.

## Validação (2026-10-19)
- **1147 × PCMOV:** a diferença de cada produto bate com os EI/SI que a 1147 lançou no PCMOV, **41 de 41 meses/tipos**, quantidade
  e valor ao centavo (jan/2025 a out/2026). A carga refaz isso sempre (`conferencia_1147`).
- **Tela × banco:** bloqueios da filial 1 em 2026 — 9.742 movimentos, R$ 3.028.149, 3.154 SKUs — iguais à consulta no banco;
  bloqueado de hoje igual ao PCEST por filial (filial 1 R$ 2.397.671,78; 10 R$ 377.190,91; 12 R$ 210.443,03; 7 R$ 24.824,96;
  11 R$ 1.316,15); sobra e falta de 2026 (R$ 640.588,65 e R$ 173.152,36) iguais ao log do WinThor.
- Dois erros do próprio Claude, achados e corrigidos no mesmo dia: o "% do estoque bloqueado" usava como base só os produtos
  bloqueados (dava 27,4%; o certo é 14,4%) e o valor do inventário era arredondado linha a linha (5 a 9 centavos a mais na soma).

## Achados para o Júlio
- **Acurácia do inventário rotativo em 2026: 6,6%** (203 de 3.074 contagens bateram com o estoque). Divergência de 18,1% do valor
  contado; **"Material Consumo" é 48% da divergência de 2026** (R$ 394,8 mil). Sobras atípicas: mar/2026 (R$ 382,5 mil) e jun/2025
  (R$ 714,6 mil).
- **Lançamento impossível na 266:** em 04/07/2025, desbloqueio de **17.000.043 un. de PALLETE CHEP (CONSUMO)** (cód. 9711) — R$ 2,28 bi
  ao custo de hoje. Fica fora das somas, com aviso e botão para incluir; corrigir no WinThor.
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
- 2026-10-19 (Claude): **sem KPI de saldo do período** (o recebimento não aparece no livro); no lugar, o bloqueado de hoje.
- 2026-10-19 (Claude): **o navegador filtra e soma**; o pacote viaja comprimido em bytes (`application/octet-stream` + `X-Pacote: gzip`) porque descomprimido passa do limite de 4,5 MB das funções da Vercel; o navegador descomprime e guarda (IndexedDB) por versão.
- 2026-10-19 (Claude): **sem aquecedor**: o painel não depende de CDN quente (cópia no navegador + `api/versao` pequena).
- 2026-10-19 (Claude): **agendamento aos :05, de 2 em 2 horas, 07:05 a 19:05, e 22:05** (Trade :25, Reposições :35, Comercial :45, Compras :50). Carga medida: ~31 s.
- 2026-10-19 (Claude): **GitHub, Vercel e agendamento ficam com o Júlio** (precedente do Trade e do Reposições: ele cria/indica o repositório e cadastra as senhas).

## Pendências
- [ ] **Júlio:** criar o repositório no GitHub (público, por causa do plano Hobby; sugestão `Lube-Distribuidora-LTDA/MOVIMENTACAO-INVENTARIO`) e avisar — o Claude sobe o commit `b9554f9` (varrido: sem senha, IP ou nome de pessoa).
- [ ] **Júlio:** projeto na Vercel (Root Directory `web`, Framework Other) e as 5 variáveis `SUPABASE_DB_*` (porta 5432). **Antes do primeiro deploy**, o Claude registra o sistema na [[SENTINELA LUBE]] (`exige_login = true`, projeto `movimentacao-inventario`) e o cartão no portal (inativo até o Júlio decidir quem abre).
- [ ] **Júlio:** agendar na `SRV-IA` — `P:\INTEGRAÇÃO BI\INVENTARIO\INSTALAR TUDO.bat`; depois o Claude confere em `inventario.controle_carga`.
- [ ] Corrigir no WinThor o desbloqueio de 17.000.043 paletes (04/07/2025) — logística/TI.
- [ ] Levar a acurácia de 6,6% e a divergência do "Material Consumo" ao coordenador de logística.
- [ ] [[GUARDIÃO DA LUBE]] vigiar a [[Inventário - Sync]] (depois do agendamento).
- [ ] Sugestão: registrar o **recebimento (1301)** como entrada no bloqueado (PCMOV E pela transação) — o livro passaria a fechar e daria o **tempo de armazenagem do recebimento** (hoje só da devolução). A hora do recebimento no WinThor é só a hora cheia (`HORALANC`).
- [ ] Departamento, seção e embalagem no `core.dim_produto` (dono: [[BI COMPRAS]]) para aposentar o `inventario.produto`.

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-19** — **Sistema criado** (Júlio pediu, Claude fez): schema `inventario` no DATA WAREHOUSE (migrações `inventario_01_schema` a `inventario_06_ajuste_cheio`), ETL de 7 consultas com conferência 1147 × PCMOV e pacote comprimido, pasta `P:\INTEGRAÇÃO BI\INVENTARIO` com instalador (não instalado), painel de 7 telas com guarda da Sentinela (não publicado), `INICIAR.bat` local; cargas reais às 18:04 e 18:38 (esta pelo `executar.py`, 9 passos `OK`, 31 s), conferidas em `inventario.controle_carga`; commit local `b9554f9` · [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]

Veja também [[Mapa de sistemas]], [[Glossário WinThor]], [[REPOSIÇÕES E CHAMADOS]] (mesmo desenho de navegador) e [[GESTÃO COMERCIAL TRADE]] (mesma cara e componentes).
