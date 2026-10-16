---
tipo: conversa
data: 2026-09-28
projeto: "[[BI COMERCIAL]]"
status: resumido
tags: [conversa, bi, comercial, comissao, margem, devolucao]
---
# 2026-09-28 — BI COMERCIAL do Power BI ao DATA WAREHOUSE

## Resumo
O Júlio trouxe a documentação técnica do BI **comercial** do Power BI e pediu o sistema inteiro. Em uma passada nasceram o ETL, o banco e o painel: schema `comercial` criado no DATA WAREHOUSE (6 tabelas, 3 dimensões no `core`, 4 views materializadas e duas funções de painel), catálogo de consultas com 8 extrações do [[WinThor]], e o painel de quatro páginas no visual do [[GESTÃO TI]]. Falta a primeira carga, que só roda de dentro da rede. (Feita no mesmo dia — ver a segunda parte. No fim do dia o BI estava no ar.)

## O que foi enfrentado
O BI antigo tem um problema que não é de tela, é de dinheiro: **a comissão dependia de onde você olhava**. Em fev/2026, a mesma comissão valia R$ 180.531,96 no rodapé, R$ 187.664,93 somando por RCA × filial e R$ 188.143,73 somando nota a nota — porque a faixa de % é aplicada sobre a margem do *conjunto*, e conjunto diferente cai em faixa diferente. Mais três erros de soma no caminho: desconto financeiro contado uma vez por operação da mesma nota, devolução somando o total da NOTA em cada linha (81 notas duplicadas) e um cartão de devolução sem o filtro de motivos que a tabela ao lado tinha (R$ 365 mil × R$ 156 mil na mesma tela).

## Decisões
- 2026-09-28 (Claude): **a regra de comissão saiu do código e virou tabela** (`comercial.dim_faixa_comissao`, com vigência desde 18/10/2023). Mudar a régua é inserir faixas novas, sem tocar em programa.
- 2026-09-28: **o total do painel é a soma das linhas.** A faixa aplicada sobre a empresa inteira aparece só num bloco de conferência, identificada como o número antigo — os três valores lado a lado, para ninguém mais ser pego de surpresa.
- 2026-09-28 (Claude): **grão oficial da comissão: por RCA** (um vendedor, uma faixa por mês), com botão para ver por RCA × filial e a diferença em reais na tela. **A palavra final é do comercial.**
- 2026-09-28: **desconto financeiro e devolução corrigidos, com o valor original ao lado** (`desc_financeiro_original`, `vltotal_nota`), como manda [[data-warehouse]] — quem confere vê as duas colunas.
- 2026-09-28: **ST dentro do CMV mantido como está**, de propósito, para os números baterem com a tela antiga. Registrado como pendência com o financeiro.
- 2026-09-28: a Consulta5 (positivação, 185 mil linhas) **não é carregada** — não alimentava nenhuma página e o grão já vinha errado. Clientes distintos por RCA saem da base de comissão, de graça.
- 2026-09-28: o painel usa **duas** funções de banco, não uma. `painel_dados(de, ate)` traz a tela; `painel_detalhe(...)` traz as listas grandes sob demanda. É exceção consciente ao padrão da casa: a base de margem tem 3,3 milhões de linhas e não cabe num payload.
- 2026-09-28 (Claude): a porta da Vercel neste painel é a **5432**, seguindo o que foi medido no [[SISTEMA FINANCEIRO]] (o 6543 deste projeto conecta e trava), e não a 6543 da skill.
- 2026-09-28: horários escalonados dos do [[BI COMPRAS]] — 06:50, 09:50, 12:50, 14:50, 16:50 e 03:50 para a margem. **Substituído no mesmo dia** pelos oito horários do Power BI, aos :45 (ver a terceira parte).
- 2026-09-28: o painel nasce com **Vercel Authentication ligada**: aqui tem comissão nominal de vendedor. **Não aconteceu assim:** o painel ficou aberto; a Vercel Standard ligada depois não cobria o endereço principal (2026-10-05), e quem fechou foi a [[SENTINELA LUBE]], em 2026-10-06.
- 2026-09-28 (Claude): o `ENV` foi copiado do COMPRAS — são as mesmas credenciais, e a skill pede um `ENV` por sistema.

## O que foi criado ou mudou
- `Desktop\BI\8. COMERCIAL` — repositório novo: `etl/` (8 arquivos), `web/` (painel, 3 rotas de API, SQL versionado) e README.
- **DATA WAREHOUSE**: schema `comercial` + `core.dim_rca`, `core.dim_supervisor`, `core.dim_cliente`. Três migrações aplicadas.
- [[BI COMERCIAL]] e [[BI COMERCIAL — documentação técnica]]: notas novas.
- [[BI Comercial - Sync rapidas]] e [[BI Comercial - Sync margem]]: rotinas planejadas.
- [[Mapa de sistemas]], [[Supabase]], [[Glossário WinThor]] e [[ANÁLISE DE BI (POWER BI)]]: atualizadas.
- `bi_comum.py` ganhou `definir_schema()` — o `controle_carga` era fixo no schema `compras`. O padrão continua "compras" quando ninguém avisa, então o [[BI COMPRAS]] não muda de comportamento.

## Como foi conferido, já que não dá para tocar o Oracle daqui
- A cadeia da comissão foi alimentada no banco com os totais de fev/2026 do Power BI: devolveu **R$ 9.026.598,25** de total líquido, **R$ 1.874.562,57** de massa, **20,7556%** e faixa de 2% — R$ 180.531,97 contra os R$ 180.531,96 da tela.
- O `diagnostico_bi_comercial.py` ganhou uma seção que **soma no Oracle os mesmos números da seção 13 da documentação** e imprime obtido × esperado, com as diferenças esperadas já anotadas.
- O painel rodou de ponta a ponta contra um servidor local com dado sintético: quatro páginas, drill por nota, filtros, gráficos e modal, sem erro de console, no desktop e no celular.

## Segunda parte do dia: o P: apareceu e o BI entrou no ar por dentro
O Júlio adicionou `P:\INTEGRAÇÃO BI` aos diretórios da sessão e pediu só os arquivos. Ao copiá-los,
descobriu-se que **o Oracle responde da própria sessão** (`192.168.0.5:1521/WINT`, `sysdate` às
16:48:51) — a skill [[data-warehouse]] dizia o contrário e foi corrigida. Então, em vez de devolver
a tarefa, o diagnóstico e as duas cargas rodaram ali mesmo.

- O `ENV` foi copiado do COMPRAS para a pasta nova **sem ser aberto** (conferidas só as 11 chaves).
- Diagnóstico: 8 consultas OK, contagens batendo (205.519 × 205.503 na comissão; 12.816 × 12.803 nas
  devoluções) e **todos os valores de referência idênticos ao Power BI**.
- Carga rápida em 40s; margem por item (3.288.133 linhas) em 6min18s. Banco foi a 1.052 MB.
- O painel foi aberto contra o banco de verdade, por um servidor local que chama as mesmas funções:
  as quatro páginas funcionam com dado real.

### O que só apareceu com o dado real
- **Setembro/2026 mostra a armadilha em tamanho grande:** a margem da empresa fecha em 18,71%, abaixo
  da primeira faixa. O rodapé do Power BI mostraria R$ 117.085,38 de comissão; a soma dos vendedores é
  **R$ 210.864,57**. Em fevereiro a diferença era de 4%; aqui, de 80%.
- **A duplicidade do desconto financeiro não existe** nesta base: nos 21 meses, o valor antigo e o
  corrigido são iguais. A suspeita da análise era razoável, mas a medição desmentiu — a correção fica
  no código sem efeito prático, e isso agora está escrito.
- **A duplicidade da devolução existe e é pequena:** 49 notas em mais de uma linha, R$ 9.624,60 em 16
  meses.
- **A carteira em aberto tem 301 pedidos (44,4%) abaixo de 20% de margem**, somando R$ 411,0 mil.

## Terceira parte: horários e repositório
- 2026-09-28: o Júlio pediu **os mesmos oito horários do Power BI** — dado pronto às 07, 08, 09, 10,
  13, 15, 16 e 17h. As tarefas passaram a rodar aos **:45** (e não aos :50 da regra dos 10 minutos):
  o [[BI COMPRAS]] roda aos :50 e disputaria o mesmo Oracle, e a carga da manhã pode ficar bem mais
  lenta — no COMPRAS a mesma carga passou de 31s para 8min25s às 07:50.
- 2026-09-28: código publicado em
  [Lube-Distribuidora-LTDA/GESTAO-COMERCIAL](https://github.com/Lube-Distribuidora-LTDA/GESTAO-COMERCIAL),
  commit `2bd2363`, 23 arquivos. **O repositório estava público** (até ~2026-10-05, quando passou a privado) — o padrão da casa é privado. Não
  vazou senha, IP do Oracle nem usuário do banco (conferido antes do push); o que está exposto é a
  estrutura do banco, a regra de comissão e o id do projeto do Supabase, que não é segredo.

## Quarta parte: no ar, com três tropeços no caminho
1. **Build falhou** com `No python entrypoint found`. A Vercel fez o build na raiz do repositório,
   encontrou os scripts do `etl/` e concluiu que o projeto era Python. Solução: **Root Directory =
   `web`**, a mesma configuração do [[SISTEMA FINANCEIRO]]. Está escrito no README agora.
2. **O painel abriu com erro de banco.** Os logs da Vercel mostraram a sequência: `504` depois de 60s
   na primeira chamada (banco frio: a `fato_margem_item` tem 594 MB e a primeira leitura vem do
   disco), e depois dois `502` com *"Cannot use a pool after calling end on the pool"*.
   Esse segundo era **bug meu**: o tratamento de erro fazia `if (pool) await pool.end()`, encerrando o
   pool que estivesse na variável naquele instante — que podia já ser um pool novo, de outra chamada
   em paralelo. Corrigido: cada chamada guarda o pool que usou e só descarta esse.
   Para o `504`, o `sync_bi_comercial.py` passou a chamar `painel_dados()` ao fim de cada carga (8x ao
   dia), deixando o banco quente.
3. **A tela escondia o motivo.** O JSON de erro já trazia `detalhe`, mas o painel mostrava só a
   mensagem amigável — exatamente o "não me faça diagnosticar no lugar do script" de
   [[Como trabalhar comigo]]. Agora mostra os dois, mais o código HTTP, e avisa depois de 7 segundos
   que o banco pode estar acordando.

Painel no ar: **https://gestao-comercial-web-three.vercel.app** — conferido de fora, carregando o
dado real (última carga 17:26, a que o próprio instalador disparou).

> **Atenção para o [[SISTEMA FINANCEIRO]]:** o `web/api/_db.js` dele tem o **mesmo padrão** que
> causou o erro aqui (`await pool.end()` dentro do catch, sobre a variável global). Lá ainda não
> apareceu, mas é a mesma armadilha esperando duas chamadas simultâneas. Vale copiar a correção.

## Pendências
- [x] Copiar `etl/` para `P:\INTEGRAÇÃO BI\COMERCIAL` — 2026-09-28
- [x] Diagnóstico rodado e conferido contra o Power BI — 2026-09-28
- [x] Primeira carga completa e validada — 2026-09-28
- [x] Repositório no GitHub — 2026-09-28
- [x] Projeto na Vercel publicado e funcionando — 2026-09-28
- [x] Tarefas agendadas — 2026-09-28, **na VM `SRV-IA`** (17:25). Na `LOGISTICA-55` o instalador rodou antes (17:21),
  copiou os arquivos e deixou a tarefa-cobaia "BI Comercial - teste de agendamento", mas não deixou carga; em 2026-10-09
  já não havia nenhuma tarefa "BI Comercial*" na estação. _Até 2026-10-09 esta linha dizia que a VM só recebeu o
  sistema em 2026-10-01; os logs mostram o contrário. Os gatilhos da VM ficaram 4 horas atrasados até 2026-10-01 —
  ver [[BI COMERCIAL]]._
- [x] **Trocar a visibilidade do repositório para privada** — privado desde ~2026-10-05
- [x] ~~Ligar a Vercel Authentication~~ — substituído: painel fechado pela [[SENTINELA LUBE]] em 2026-10-06
- [x] Reinstalar o ETL na VM para levar o aquecimento do painel — 2026-10-09 (`INSTALAR TUDO.bat` na `SRV-IA`)
- [ ] Copiar a correção do pool para o `_db.js` do [[SISTEMA FINANCEIRO]] (conferido em 2026-10-09: ainda com o `await pool.end()` no catch)
- [x] Agendar e provar que rodou — 2026-09-28, a carga disparada pelo instalador às 17:25 chegou ao painel
- [ ] Levar ao comercial: grão oficial da comissão e o ST dentro do CMV
- [ ] Confirmar com a TI se o alias `prod` é o mesmo banco do COMPRAS

Continuação: [[2026-09-28 — Painel comercial repaginado e o banco que parou]] (a mesma noite) e
[[2026-09-29 — Exportação do painel comercial em Excel]]. Tudo o que mudou depois está no "Histórico de
mudanças" de [[BI COMERCIAL]].
