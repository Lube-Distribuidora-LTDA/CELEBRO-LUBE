---
tipo: conversa
data: 2026-10-19
projeto: "[[MOVIMENTAÇÃO DE INVENTÁRIO]]"
status: resumido
tags: [conversa, bi, inventario, winthor]
---
# 2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147

## Resumo
O Júlio pediu um BI de "MOVIMENTAÇÃO DE INVENTÁRIO" para ver tudo o que acontece no galpão, a partir das rotinas **266**
(Bloquear Produtos no Estoque) e **1147** (Manutenção de inventário rotativo) do WinThor, no design dos últimos BIs e com
"alta profundidade de personalização" de filtros no navegador. O Claude descobriu as tabelas por trás das rotinas
(`PCLOGDESBLOQUEIO`; `PCINVENTROT` + `PCLOGATUALIZAINVENT`), decifrou como cada programa grava o livro de bloqueio,
criou o schema `inventario` no DATA WAREHOUSE, o ETL com conferência embutida, a pasta de integração com instalador e
o painel de 7 telas (rodando local; GitHub, Vercel e agendamento esperam o Júlio). Detalhe em [[MOVIMENTAÇÃO DE INVENTÁRIO]].

## Como foi
1. **Descoberta:** `PCROTINA` deu os nomes (266 = Bloquear Produtos no Estoque; 1147 = Manutenção de inventário rotativo). O
   `PCMOV` mostrou que os EI/SI vêm da 1147 e da 1188 (contábil, fora). O livro `PCLOGDESBLOQUEIO` é escrito por vários
   programas (266 em dois formatos, WMS da Kaizen, devoluções 1303/1346/1361, 1316, 552, 1122) — cada um preenche os
   campos de um jeito. A leitura foi conferida produto a produto contra o saldo do PCEST e numa devolução inteira.
2. **Diagnóstico sem gravar:** 1147 × PCMOV bateu em 41 de 41 meses/tipos, quantidade e valor.
3. **Banco e carga:** schema `inventario` (6 migrações), 7 consultas, carga de ~31 s, conferência 1147 × PCMOV em toda carga,
   pacote do painel comprimido no banco.
4. **Painel:** construído sobre os componentes do [[GESTÃO COMERCIAL TRADE]] (gráficos, tabelas, relatório a cada clique), com
   o navegador filtrando e somando como no [[REPOSIÇÕES E CHAMADOS]]. Revisado no navegador em tela larga, tema claro e celular.
5. **Conferência da tela contra o banco** — achou dois erros do próprio Claude (base do "% do estoque bloqueado" e centavos do
   inventário por arredondar linha a linha), corrigidos (migrações 04 a 06); depois disso tudo fechou ao centavo.

### Segunda parte (2026-10-20): GitHub, Vercel e Sentinela
O Júlio criou o repositório `Lube-Distribuidora-LTDA/MOVIMENTACAO-INVENTARIO` (público) e mandou publicar: "pode subir o código, criar o
projeto na Vercel e registrar na Sentinela; as variáveis SUPABASE_DB_* eu cadastro". O Claude subiu o `b9554f9` (só esse commit, por
referência, para não levar trabalho de outra sessão que usa a mesma pasta), criou o projeto `movimentacao-inventario`, registrou o
sistema na Sentinela e o cartão inativo no portal **antes** do primeiro deploy, publicou em produção (`READY`) e provou de fora que só
abre com login. Faltam as variáveis (Júlio) e um novo deploy depois delas.

## Decisões
- 2026-10-19 (Claude): schema `inventario`, filiais 1/7/10/11/12, histórico desde 2025-01-01, valor ao custo financeiro de hoje,
  movimento ≥ 1 milhão de unidades fora das somas com aviso, sem KPI de "saldo do período" (o recebimento não aparece no livro),
  cadastro de produto próprio, pacote comprimido guardado no navegador, sem aquecedor, cargas aos :05 de 2 em 2 horas.
  Motivos em [[MOVIMENTAÇÃO DE INVENTÁRIO]].
- 2026-10-19 (Claude): **não criar repositório no GitHub nem projeto na Vercel por conta própria** — no Trade e no Reposições foi
  o Júlio quem criou/indicou o repositório e cadastrou as senhas. Tudo ficou pronto e commitado só no Git local.

## O que foi criado ou mudou
- [[MOVIMENTAÇÃO DE INVENTÁRIO]]: nota nova do projeto.
- [[Inventário - Sync]]: rotina nova (carga agendável, ainda não instalada).
- DATA WAREHOUSE: schema `inventario` — migrações `inventario_01_schema`, `inventario_02_views_e_funcao`, `inventario_03_fotos`,
  `inventario_04_estoque_completo`, `inventario_05_custo_6_casas`, `inventario_06_ajuste_cheio`; cargas às 18:04 e 18:38.
- `Desktop\BI\16. INVENTARIO` (commit local `b9554f9`) e `P:\INTEGRAÇÃO BI\INVENTARIO` (com o `ENV` de leitura copiado do REPOSIÇÕES sem exibir a senha).
- `.claude/launch.json` do cérebro: configuração `inventario` (porta 3102).
- [[Glossário WinThor]], [[Mapa de sistemas]], [[Supabase]], [[Como eu gosto dos BIs]], [[Registro de mudanças]] e o `CLAUDE.md`.

## Achados
- Acurácia do inventário rotativo em 2026: **6,6%**; "Material Consumo" é 48% da divergência de 2026.
- Desbloqueio de **17.000.043 paletes** (04/07/2025) — erro de digitação na 266.
- Bloqueado hoje **R$ 3,01 mi** (R$ 1,79 mi em avaria), 14,4% do estoque a custo.
- Devoluções: mediana de 47 h até o WMS liberar (últimos 30 dias).

## Pendências
- [x] GitHub (Júlio criou), Vercel e Sentinela (Claude) — 2026-10-20.
- [ ] Júlio: as 5 variáveis `SUPABASE_DB_*` no projeto `movimentacao-inventario` (porta 5432) e um Redeploy; decidir quem abre o cartão.
- [ ] Júlio: `INSTALAR TUDO.bat` na `SRV-IA`; Claude confere `inventario.controle_carga`.
- [ ] Corrigir no WinThor os 17 milhões de paletes; levar a acurácia ao coordenador de logística.
- [ ] Guardião vigiar a [[Inventário - Sync]]; avaliar o recebimento (1301) no livro.
