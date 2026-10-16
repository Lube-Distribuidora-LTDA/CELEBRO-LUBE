---
tipo: conversa
data: 2026-10-09
projeto: "[[REPOSIÇÕES E CHAMADOS]]"
status: resumido
tags: [conversa, reposicao, comparacao, etl, vm]
---
# 2026-10-09 — Comparação com o período anterior e o script de atualização da VM

## Resumo
O Júlio pediu duas coisas no [[REPOSIÇÕES E CHAMADOS]]: (1) o cartão principal comparar o período escolhido **com o
período anterior** e não só com o ano anterior ("filtrei jan/26, ele precisa apontar a comparação com dez") e (2) um
**script para atualizar os dados na VM**. As duas estão prontas, testadas e no ar (commit `261b9a0`). Às ~14:07 o Júlio
rodou o `INSTALAR TUDO.bat` e **o agendamento foi criado** (carga e aquecedor); falta provar a primeira carga pelo
relógio (15:35) e confirmar que a máquina é a `SRV-IA`.

## Decisões
- 2026-10-09 (Júlio pediu; Claude definiu a regra): **período anterior = o que vem imediatamente antes e tem o mesmo
  tamanho.**
  - Meses fechados comparam mês com mês: jan/26 contra dez/25, fev contra jan, jan–mar contra out–dez (fevereiro
    não é comparado "dia a dia" com janeiro).
  - "Até hoje" (o mês em andamento) compara com os mesmos N meses antes **até o mesmo dia do mês**.
  - Datas livres comparam com os mesmos N dias imediatamente antes.
  - O período anterior e o ano anterior valem **com os mesmos filtros** (motivo, chamado, motorista, cliente, filial).
- 2026-10-09 (Claude): as duas comparações ficam **juntas no cartão principal** (Período anterior e Ano anterior), cada
  uma com a variação, o valor do período comparado, um tooltip (escolhido × comparado × diferença, reposições, ticket
  médio, % com chamado) e **clique que abre o período comparado no Detalhe**. Sem dado para o período comparado, mostra
  "sem dados de …" em cinza em vez de um número falso.
- 2026-10-09 (Claude): o script da VM **não mexe no agendamento** — só atualiza agora. Quem cria as tarefas continua
  sendo o `INSTALAR TUDO.bat`, uma vez. Fora da `SRV-IA` o script pede para digitar `SIM` (lição do COMERCIAL: duas
  máquinas com a mesma tarefa atropelaram as cargas por uma semana).
- 2026-10-09 (Claude): o `bi_comum.py` do REPOSIÇÕES passou a ser o de 2026-10-08 do COMERCIAL, com a **tranca de
  carga** — resolve a pendência de "trazer o `bi_comum.py` antes de instalar".

## O que foi criado ou mudou
- [[REPOSIÇÕES E CHAMADOS]]: cartão principal com Período anterior + Ano anterior; campos de data deixaram de trocar de
  lugar quando o "de" passava do "até" (agora o outro acompanha); `ATUALIZAR AGORA.bat`; tranca de carga e linha
  "PAINEL ATUALIZADO: reposições até DD/MM/AAAA (N pedidos)" no log; README e `LEIA-ME.txt` atualizados.
- [[Reposições - Sync]]: agora com tranca; atualização sob demanda pelo `ATUALIZAR AGORA.bat`.
- Pasta de rede `P:\INTEGRAÇÃO BI\REPOSICOES`: `ATUALIZAR AGORA.bat` novo, ETL atualizado (incl. `bi_comum.py`), `LEIA-ME.txt`.
- [[Supabase]]: terceiro reinício do banco em três dias (ver Pendências).

## Como foi testado
- **Comparação, com dados reais, também no painel publicado:** jan/26 → dez/25 **▲ 9,6%** (R$ 27.037,92); fev → jan
  **▼ 17,3%** (R$ 29.631,71); fev contra fev/25 ▼ 37,9%; jan contra jan/25 ▼ 4,3%; "ano até hoje" contra
  01/03/2025–08/12/2025 ▼ 10,8%; trimestre contra trimestre; datas livres; período sem dado.
- **`ATUALIZAR AGORA.bat`** a partir da pasta de rede, numa cópia de teste na `LOGISTICA-55` (pedindo `SIM`): copiou,
  carregou e chamou o painel. Conferido **no banco** (`reposicao.controle_carga`, não pelo log): as três consultas
  `OK` — 5.629 itens, 27.586 chamados, 32.184 itens de chamado — com dado até **2026-10-08** (4.492 pedidos) e
  `painel_cache` gerado às 13:37. Levou **4 min** (13:33–13:37; só `reposicao_item` levou 134 s).
- **Tranca:** duas cargas disparadas com 12 s de diferença — a segunda avisou "Já existe uma carga … Esta rodada vai
  ser pulada" e saiu; no banco entrou **uma** carga só (13:40, **30 s**, banco saudável). A cópia de teste, que tinha
  o `ENV`, foi apagada depois.
- **Não testado:** o script rodando **dentro da `SRV-IA`** (Python e bibliotecas de lá não conferidos).

## Pendências
- [x] **Júlio rodou o `INSTALAR TUDO.bat` (~14:07)** e mandou a tela do instalador: tarefa-cobaia no modo senha
  guardada funcionou, as duas tarefas foram criadas e a carga das 14:08 deu `OK` nas três consultas (conferido em
  `controle_carga`: 5.629 / 27.589 / 32.191 linhas, ~9 s; cache às 14:08:34; Postgres sem novo reinício).
  A tela mostra só a conta (`LUBE\gti.julio.alves`) e a pasta (`C:\BI\REPOSICOES`), **não o nome da máquina**; na
  `LOGISTICA-55` não há tarefa nem pasta, então foi em outra — esperado a `SRV-IA`.
- [ ] **Confirmar a máquina (`SRV-IA`)** e **provar o relógio:** carga das 15:35 em `controle_carga`, depois 17:35 e
  22:35, e `aquecer_painel.log` com linha nova a cada 5 min.
- [ ] Rodar o `ATUALIZAR AGORA.bat` uma vez na `SRV-IA` e conferir `controle_carga` (o instalador já provou o
  Python e as bibliotecas de lá, mas o `.bat` em si só foi testado na `LOGISTICA-55`).
- [ ] **Banco reiniciando:** o Postgres do DATA WAREHOUSE reiniciou em **2026-10-07 14:14**, **2026-10-08 ~17:00** e
  **2026-10-09 13:45:27** (BRT), este cerca de 5 min depois das duas cargas de teste. **Causa não provada** — o Claude
  não tem como reiniciar o banco. Decisão do Júlio: olhar *Reports → Database* no Supabase e o tamanho do compute;
  testar a hipótese do `pg_stat_statements` ([[Supabase]]).
- [ ] Seguem de pé as pendências do projeto: SENTINELA no painel, repositório público ou privado, levar o desenho rápido
  aos outros painéis, abrir o painel uma vez na máquina da apresentação.
