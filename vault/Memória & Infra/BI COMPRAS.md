---
tipo: projeto
departamento: Compras
status: ativo
tags: [bi, compras]
---
# BI COMPRAS

Primeiro BI em produção e modelo para todos os próximos. Quando algo estiver ambíguo em [[data-warehouse]], copie o padrão daqui.

- Origem: o BI COMPRAS do Power BI, analisado em 2026-09-18 no projeto [[ANÁLISE DE BI (POWER BI)]]. Levantamento completo em [[BI COMPRAS — documentação técnica]].
- Nome na tela: **Central Compras** (até 2026-09-23 o título dizia "Central Comercial").
- Endereço: **`https://painel-compras-rosy.vercel.app`** — projeto `painel-compras` na [[Vercel]]
  (`prj_DcJI82KyPyvSc4eUMuL9iJV6I7cp`), Root Directory `web`, região `gru1`. 8 páginas: 01 Compras, 02 Saldo verba x
  avaria, 03 Estoque x venda, 04 Sugestão fornecedor x produto, 05 Excesso de estoque, 06 Performance compras,
  07 Métricas, 08 Saldo verba.
- Repositório: `Desktop\BI\6. COMPRAS` → GitHub `Lube-Distribuidora-LTDA/COMPRAS`, **público desde 2026-10-06**
  (decisão do Júlio, para o deploy não travar no plano Hobby). Deploy automático a cada push na `main`.
- Edição do ETL: `P:\INTEGRAÇÃO BI\COMPRAS` · Execução: `C:\BI\COMPRAS` **na VM SRV-IA (192.168.12.30)** desde
  2026-09-28. Na LOGISTICA-55, onde rodava antes, as tarefas estão só desativadas (plano B).
- Schema no DATA WAREHOUSE ([[Supabase]], `ivcnotrynogaljrvvyes`): `compras`
- Dono das dimensões do `core`: `dim_fornecedor`, `dim_produto`, `dim_comprador`. As outras do `core` (`dim_rca`,
  `dim_supervisor`, `dim_cliente` e, desde 2026-10-09, `dim_nf_saida`, usada pelo [[SAC]]) são do [[BI COMERCIAL]].
- **Acesso: fechado pela [[SENTINELA LUBE]] desde 2026-10-06** (decisão do Júlio: só quem tem acesso pelo
  [[PAINEL LUBE DISTRIBUIDORA]]; slug `gestao-compras`). Sem login, `/` dá 302 para o portal e `/api/dados` e
  `/api/agente` dão 401. Vercel Authentication (Standard) ligada para os endereços de deploys antigos. Os aliases
  `painel-compras-lube-distribuidora-ltda` e `painel-compras-git-main-…` apontam para a produção e **dependem só do
  guarda**, como o endereço principal. De 2026-09-22 a
  2026-10-06 o painel ficou **aberto** a quem tivesse o endereço (decisão do Júlio de 2026-09-22).
- Rotinas: [[BI Compras - Sync rapidas]] e [[BI Compras - Sync faturamento]]
- Na validação contra o Power BI antigo, apareceram quatro bugs no original (ver [[data-warehouse]], seção 6)

## Estado em 2026-10-09
- **No ar:** commit `485ef61` (deploy `dpl_CBUs93hquLnZT8KoToyo3fV8vFkE`, READY às 10:03).
- **Cargas** na VM SRV-IA, de novo nos horários planejados desde 2026-10-09: rápidas 07:50, 11:50, 17:50 e 23:50;
  faturamento 02:50. De 2026-09-28 a 2026-10-09 rodaram **4 horas atrasadas** (relógio da VM atrasado quando as tarefas
  foram criadas). Teste de 2026-10-09 às 08:38: 12 de 12 consultas OK.
- **Clique em qualquer número abre a planilha já filtrada**, com Voltar, faixa de filtros e linha de Total; pop-up ao
  passar o mouse nos gráficos (padrão do [[REPOSIÇÕES E CHAMADOS]]).
- **Assistente virtual** (botão flutuante, Claude da Anthropic, relatório em `.xlsx`). Só responde com a
  `ANTHROPIC_API_KEY` cadastrada no projeto da Vercel — **ainda não confirmado**.
- **Faturamento só do ano corrente** (desde 2026-10-01): cerca de 259 mil linhas em 2026-10-09; zera sozinho na
  primeira carga de janeiro. Verba guarda o histórico inteiro.
- **Compradores que saíram da Lube** (matrículas 621, 278, 376, 375, 277 e 178) fora dos filtros e da coluna
  Comprador, no painel e no ETL, desde 2026-10-01. O dado deles continua; o nome vira "—".
- **"Última carga"** mostra a carga OK mais antiga entre as que alimentam a tela (desde 2026-10-05), com o horário de
  cada grupo ao passar o mouse; **"Próxima"** com 00/08/12/18.
- **Cache:** `s-maxage=600`, `stale-while-revalidate` e `stale-if-error` de 24 h. **Sem aquecedor e sem
  `painel_cache`:** a primeira abertura depois de 24 h sem acesso ainda espera o banco (o desenho que resolve está em
  [[data-warehouse]], seção 8b).
- **Fora do Git:** ver "Trabalho fora do Git" abaixo.

## Trabalho fora do Git (conferido em 2026-10-09)
- **No repositório, sem commit:** `README.md` e `etl/agendar_bi_compras.ps1` alterados; `etl/executar.py`,
  `etl/_teste_agendador.py`, `etl/instalar_e_agendar.ps1`, `etl/testar_agora.ps1` e `etl/verificar_agendamento.ps1`
  nunca commitados. **São os scripts em uso no agendamento** e estão iguais no P:. O README não commitado diz que "o
  site é público" (errado desde 2026-10-06), e o commitado diz que é restrito pela proteção da Vercel (meia verdade:
  quem fecha o endereço principal é a Sentinela; a Vercel Standard só cobre os deploys antigos).
- **Só no P:** `sync_compras.py` e `agendar_compras.ps1` (versão antiga, que fazia só a Consulta1, guardada como plano
  B), `README_DEPLOY.md` (guia de 2026-09-22), `diagnostico_bi_compras.txt` (saída do diagnóstico de 2026-09-22) e
  `consulta_acesso_rotina.py` + `CONSULTAR ACESSO 604.bat` (ferramenta avulsa de 2026-09-24 que lista quem tem acesso a
  uma rotina do [[WinThor]], só com SELECT; reaproveita o `ENV` e o `bi_comum.py` da pasta).
- O resto do P: é igual ao `etl/` do repositório (`bi_comum.py` de 2026-09-28, `consultas_compras.py` de 2026-10-01).
  Só o `ENV.example` difere, num comentário (o do P: ainda cita o `sync_compras.py`).
- **Branch `sentinela`** (local e no GitHub) parada no `9d4e645`. Já está toda na `main` (entrou por fast-forward em
  2026-10-06); sobrou da instalação da [[SENTINELA LUBE]] e gerou o preview `dpl_By1DV6rxfonJiEmsDBcL2EVDMADD`.
- A cópia em `C:\BI\COMPRAS` da **LOGISTICA-55** está velha (`consultas_compras.py` de 2026-10-01 11:52, sem a remoção
  dos compradores). Se o plano B for reativado, copiar de novo antes.

## Estado em 2026-09-23 (histórico)
**Em produção e rodando sozinho**, na época na LOGISTICA-55. O agendamento foi resolvido em 2026-09-22 — ver [[2026-09-23 — agendamento do BI COMPRAS, acesso ao painel e skill data-warehouse]]. As tarefas rodam no modo "senha guardada", ou seja, funcionam com a máquina ligada mesmo sem ninguém logado.

Na primeira madrugada completa: 28 execuções, zero erros. A carga das 23:50 levou 31 segundos; o faturamento das 02:50, 5 minutos; a das 07:50, **8 minutos e 25 segundos**, terminando às 07:59:06 — 54 segundos antes da hora em que o dado precisa estar pronto.

Três arquivos nasceram da depuração do agendamento e valem para qualquer BI novo: `executar.py` (captura falhas anteriores ao logging), `_teste_agendador.py` (cobaia que prova o modo de logon) e o `instalar_e_agendar.ps1` reescrito.

## Pendências
- [ ] Antecipar a carga rápida da manhã de 07:50 para 07:30 (aguarda o ok do Júlio). Os 8 min 25 s de 2026-09-23 foram
  medidos na LOGISTICA-55; na VM, a das 07:50 ainda não foi medida.
- [ ] Commit e push dos arquivos de agendamento e do README (lista em "Trabalho fora do Git"), corrigindo antes no
  README a seção de acesso (fechado pela Sentinela + Vercel Standard desde 2026-10-06) — Júlio
- [x] ~~Verificar se a máquina do ETL suspende à noite~~ — superado em 2026-09-28: o ETL foi para a VM; 8 dias seguidos
  com 4 cargas por dia e nenhuma falha (conferido em 2026-10-08).
- [x] `ESTOQUE_VENDA` já não existe em `P:\INTEGRAÇÃO BI` (conferido em 2026-10-09).
- [ ] Sobras na raiz de `P:\INTEGRAÇÃO BI`: `.env.example`, `.env.txt` (vazio) e a pasta `Claude outputs`.
- [ ] `PCPRODUT.OBS2` na origem: `DECODE` sem `ELSE` devolve nulo
- [x] Conferir no `controle_carga`, em 2026-10-10, a carga das 07:50 — prova de que a recriação das tarefas funcionou
  ([[2026-10-08 — Cargas do BI COMPRAS 4 horas fora do horário]]) — Júlio avisa, Claude confere.
  - 2026-10-14 (Claude): conferido — em 10/10 a carga rápida começou às 07:50:01 e terminou às 07:50:33, 12 de 12 `OK`;
    o faturamento de 10/10 rodou às 02:50 (`OK`, 31 s). A reavaliação do [[GUARDIÃO DA LUBE]] deu as rápidas em dia em
    todas as cargas desde 09/10.
- [ ] Apagar as tarefas desativadas da LOGISTICA-55 depois de alguns dias estáveis na VM — Júlio
- [ ] Assistente: gerar chave nova da Anthropic e revogar a que ficou exposta no chat; cadastrar `ANTHROPIC_API_KEY`
  (Production) no projeto `painel-compras` e republicar; testar com o modelo de verdade — Júlio
  ([[2026-10-01 — Assistente virtual da Central Compras]])
- [ ] Reatribuir no WinThor os 20 fornecedores e 58 produtos ainda no nome dos compradores que saíram — Júlio, com
  Compras ([[2026-09-24 — Compradores que saíram da Lube]])
- [ ] Itens do comparativo com o Power BI que esperam os responsáveis: filiais 11 e 12 na venda de 9 semanas (5.4),
  verba a vencer −12,4% (5.5), padronizar filiais (7.4), unificar as três avarias (7.3) — Júlio
  ([[2026-09-28 — Comparativo do painel de Compras contra o Power BI]])
- [ ] Conferir em produção, com o dado real, o clique que abre a planilha filtrada — Júlio
- [ ] Levar ao COMPRAS o painel que abre na hora ([[data-warehouse]], seção 8b): `painel_cache`, aquecedor com caminho
  liberado na Sentinela, cópia no navegador e conexão abrir → consultar → fechar (o `web/api/dados.js` ainda guarda um
  `Pool` entre chamadas, de 2026-09-23).
- [ ] Hospedar as fontes no próprio painel, para não depender do Google (sugestão do Claude, não pedida)
- [ ] Corrigir o comentário da tabela `compras.fato_faturamento` no banco, que ainda diz "desde 2021"
- [ ] Nivelar o `bi_comum.py` com o do [[BI COMERCIAL]], que tem `definir_schema()` (os dois já têm timeout e keepalive)
- [ ] Subir o compute do DATA WAREHOUSE de Micro para Small e olhar *Reports → Database* (CPU e Disk IO) na hora do
  faturamento, que agora roda às 02:50 — recomendação de 2026-10-01, depois que o refresh das `compras.mv_*` saturou o
  banco ([[2026-10-01 — Banco travado e o total dos Afastados INSS]]). No incidente de 2026-10-07 ainda estava por
  decidir ([[Supabase]]) — Júlio
- [ ] Opcional: quantidade dentro de cada chip de filtro, ex.: "Ativo (120)"

## Valores de referência do Power BI (2026-09-18)
Total de itens 7.166 · ativos 5.241 · itens com ruptura 1.175 (16,40%) · cobertura NAO 4.775 (66,63% de excesso) · avaria R$ 2.603.850,31 · verba R$ 2.241.441,83.

## Decisões que valem hoje
- 2026-09-22 (Júlio): **nada no sistema lembra o Power BI**, nem comparação de valores.
- 2026-09-28 (Júlio): o ETL roda na **VM SRV-IA**, não na LOGISTICA-55.
- 2026-09-28 (Júlio): correção do painel que **mexe em número só depois de confirmar com os responsáveis** da área;
  texto pode ser corrigido na hora.
- 2026-10-01 (Júlio): o faturamento guarda **só o ano corrente**, e só no COMPRAS.
- 2026-10-01 (Júlio): filtros e coluna Comprador **só com quem ainda está na Lube**.
- 2026-10-06 (Júlio): o painel **só abre para quem tem acesso pelo Painel Lube**; repositório GitHub público.
- 2026-10-09 (Júlio): **todo número leva à planilha bruta já filtrada**, como no Reposições.

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].
Compilado em 2026-10-09 a partir do Git, do banco e das conversas.

- **2026-10-14** — Passa a ser vigiado pelo [[GUARDIÃO DA LUBE]] (rápidas, faturamento, site e, quando o vigia da VM for instalado, as tarefas e a conferência com o WinThor), sem mudar nada no sistema. **Achado:** o `faturamento` de **2026-10-11** deu `ERRO` às 03:05:41 — `QueryCanceled: canceling statement due to statement timeout`, depois de 906,8 s; 3 de 4 consultas OK — e ninguém soube. Voltou sozinho na carga seguinte, **2026-10-12 às 02:51** (259.730 linhas, `OK`); 13/10 e 14/10 também `OK`. Com o Guardião, teria virado falha às 03:08–03:10 e, por ser carga pesada, nova tentativa permitida até 07:20 · [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-09** — Clique em qualquer número abre a planilha já filtrada (faixa de filtros com ✕, Voltar, saltos entre
  páginas, linha de Total) e pop-up nos gráficos, padrão Reposições; no ar às 10:03 (commit `485ef61`) ·
  [[2026-10-09 — Clique no número abre a planilha filtrada no BI COMPRAS]]
- **2026-10-09** — Tarefas da VM recriadas pelo Júlio com o `instalar_e_agendar.ps1`: voltam a 07:50/11:50/17:50/23:50 e
  02:50; "Próxima" de volta a 00/08/12/18 (commit `2a29b0b`) · [[2026-10-08 — Cargas do BI COMPRAS 4 horas fora do horário]]
- **2026-10-08** — Conferido no `controle_carga`: 8 dias sem falha, mas todas as cargas 4 horas atrasadas desde
  2026-09-28 · [[2026-10-08 — Cargas do BI COMPRAS 4 horas fora do horário]]
- **2026-10-07** — Guarda da Sentinela 1.1.0, que reconhece robôs e não-navegadores (commit `a197e96`) ·
  [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Guarda da Sentinela na porta (`web/middleware.ts` e `web/sentinela-guarda.ts`) com "exige login"
  ligado; Vercel Standard nos deploys antigos; saem a chave `_comentario_crons` e os crons do `web/vercel.json`, o que
  destrava o deploy parado desde 2026-10-05 e leva ao ar os commits de 2026-10-05; repositório GitHub fica público
  (Júlio) (commit `9d4e645`, feito no branch `sentinela` e levado à `main` por fast-forward; produção
  `dpl_FUdhsEQWJpKHMuNwSnSQZ13tFGBv` às 18:18) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-05** — "Última carga" passa a mostrar a carga OK mais antiga da tela, não a hora do acesso (migrações
  `painel_dados_geradoem_vira_hora_da_carga` e `painel_dados_carga_mais_antiga_na_tela`; pop-up na pílula e "Próxima"
  04/12/16/22, commit `b70531f`) · [[2026-10-05 — Painel de Compras lento de manhã e a Última carga]]
- **2026-10-05** — Painel abre mesmo com rede ruim ou banco fora: Google Fonts sem bloquear a tela, cache de 24 h com
  `stale-if-error`, crons de aquecimento (commit `9626669`; o deploy falhou pelo `_comentario_crons` e só foi ao ar em
  2026-10-06, já sem os crons) · [[2026-10-05 — Painel de Compras lento de manhã e a Última carga]]
- **2026-10-01** — Largura da coluna do gráfico tirada do maior rótulo, para os valores não encostarem (commit
  `264f1bc`) · [[2026-10-01 — Faturamento só do ano corrente e o gráfico mensal]]
- **2026-10-01** — Os 6 compradores que saíram da Lube removidos de novo do painel e do ETL, impacto de 0,8% (commit
  `1d84a3f`; arquivo copiado para o P: e para a VM) · [[2026-09-24 — Compradores que saíram da Lube]]
- **2026-10-01** — Faturamento só do ano corrente: 1,63 milhão → 251 mil linhas, banco 2.048 → 1.722 MB; períodos do
  painel saem da base (commit `742556f`; P: remapeado e VM atualizada) · [[2026-10-01 — Faturamento só do ano corrente e o gráfico mensal]]
- **2026-10-01** — Assistente virtual da Central Compras, com Claude e relatório em Excel (commit `4cd8ff2`); depende de
  `ANTHROPIC_API_KEY` na Vercel · [[2026-10-01 — Assistente virtual da Central Compras]]
- **2026-10-01** — Incidente: o refresh das nove `compras.mv_*` às 06:52 (pelos horários, a carga de faturamento rodando 4 h atrasada)
  saturou o DATA WAREHOUSE até cerca de 11:20 e derrubou o painel da folha; sem mudança no sistema ·
  [[2026-10-01 — Banco travado e o total dos Afastados INSS]]
- **2026-09-30** — Os 6 compradores voltam ao painel e ao ETL, a pedido do Júlio (commit `cb2767b`; P: e VM
  atualizados) · [[2026-09-24 — Compradores que saíram da Lube]]
- **2026-09-28** — Textos das notas técnicas corrigidos depois do comparativo com o Power BI, sem mudar cálculo (commit
  `f9611c9`) · [[2026-09-28 — Comparativo do painel de Compras contra o Power BI]]
- **2026-09-28** — ETL levado para a VM SRV-IA (Python 3.12.7, tarefas com senha guardada); tarefas da LOGISTICA-55
  desativadas; conexão com o Supabase com timeout e keepalive (commit `db22475`) ·
  [[2026-09-28 — ETL do BI COMPRAS levado para a VM]]
- **2026-09-28** — `consultas_compras.py` sem os 6 compradores copiado para o P: e para o `C:\BI\COMPRAS` (não tinha ido
  para a rede em 2026-09-24) · [[2026-09-24 — Compradores que saíram da Lube]]
- **2026-09-24** — 6 compradores que saíram da Lube fora do painel e do ETL (commit `137aadc`) ·
  [[2026-09-24 — Compradores que saíram da Lube]]
- **2026-09-23** — Botão Atualizar, horário da próxima carga, nova tentativa automática e conexão reaproveitada na
  função da Vercel (commit `a873c75`); título vira "Central Compras" (commit `c062537`) ·
  [[2026-09-22 — Painel mais vivo, fim do Power BI e botão Atualizar]]
- **2026-09-22** — Painel mais vivo (animações, rótulos nas colunas, busca com destaque, "Sobre esta página", números
  gordinhos) e fim de toda referência ao Power BI; busca que perdia o foco corrigida (commits `73ecfeb`, `3b418c3`) ·
  [[2026-09-22 — Painel mais vivo, fim do Power BI e botão Atualizar]]
- **2026-09-22** — Agendamento rodando sozinho na LOGISTICA-55 (senha guardada), com `executar.py`,
  `_teste_agendador.py` e `instalar_e_agendar.ps1` novos (**em uso, não commitados**); proteção de acesso da Vercel
  desligada a pedido do Júlio (revertida em 2026-10-06) ·
  [[2026-09-23 — agendamento do BI COMPRAS, acesso ao painel e skill data-warehouse]]
- **2026-09-22** — Primeira versão: pipeline ETL e painel web (commit `a9362df`); no banco, as 12 consultas, RLS em
  todas as tabelas, views materializadas do faturamento e `compras.painel_dados()` (migrações de `add_fato_estoque_venda`
  a `funcao_painel_dados`) · [[BI COMPRAS — documentação técnica]]
- **2026-09-18** — Análise do Power BI; criados no DATA WAREHOUSE os schemas, as dimensões do `core` e o primeiro fato
  (migrações `create_schemas`, `create_core_dimensions`, `create_staging_and_fato_ruptura_cobertura`) ·
  [[ANÁLISE DE BI (POWER BI)]]
- **(em andamento, não commitado)** — `README.md` (agendamento, `executar.py`, acesso) e `etl/agendar_bi_compras.ps1`
  alterados só na pasta local; os 5 scripts de agendamento em uso nunca foram commitados.

Veja também [[Mapa de sistemas]], [[Glossário WinThor]] e [[Como eu gosto dos BIs]].
