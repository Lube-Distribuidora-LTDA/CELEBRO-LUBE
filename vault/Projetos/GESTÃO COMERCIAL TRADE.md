---
tipo: projeto
departamento: Comercial
status: ativo
inicio: 2026-10-14
tags: [bi, comercial, trade, venda, ruptura, cobertura, curva-abc, conta-corrente]
---
# GESTÃO COMERCIAL TRADE

Reconstrução do Power BI **"final"** (workspace COMPRAS; é o BI de Trade Marketing: venda, devolução, Higiene & Beleza,
ruptura, sem venda, cobertura, imagens, conta corrente de fornecedor, curva ABC, desvio padrão de compra) como sistema
próprio, **para o Júlio apresentar ao gestor comercial** (2026-10-14: "ESSE SISTEMA PRECISA FICAR UM LUXO … FAÇA O SEU
MELHOR"). O levantamento do original é o `BI-FINAL-documentacao-tecnica.md` (Downloads, 2026-10-14), do projeto
[[ANÁLISE DE BI (POWER BI)]]. Não confundir com o [[BI COMERCIAL]] (comissão de RCA, margem, devolução do vendedor): são
sistemas diferentes, e este **não** mexe em margem nem em comissão. Conversa de origem:
[[2026-10-14 — Gestão Comercial recriada do BI final do Power BI]].

- Pasta: `Desktop\BI\11. TRADE` (README, `etl/`, `web/`) · **GitHub:** [Lube-Distribuidora-LTDA/GEST-O-COMERCIAL](https://github.com/Lube-Distribuidora-LTDA/GEST-O-COMERCIAL),
  **público**, branch `main`, um commit só (`8f08cff`, 2026-10-14): a história de 6 commits locais foi condensada para tirar os números de negócio e
  os endereços internos antes de publicar (a história antiga, `6aeae28` … `9d4290c`, ficou só na branch local `master` — **não enviar**). ·
  **Vercel:** projeto `gestao-comercial-trade` (`prj_PpgCB4Ez2d8ZK1ICjxOL8wjlueXT`), https://gestao-comercial-trade.vercel.app, protegido pela
  Sentinela, ver "Publicação na Vercel" abaixo · o nome vem do schema (`trade`); na tela se chama **Gestão Comercial**.
- **Carga:** pasta **`P:\INTEGRAÇÃO BI\TRADE`** (2026-10-14, mesmo desenho da REPOSIÇÕES: `1 - CONFIGURACAO`, `2 - SISTEMA TRADE`,
  `3 - INSTALACAO`, `INSTALAR TUDO.bat`, `ATUALIZAR AGORA.bat`, `DIAGNOSTICO.bat`, `LEIA-ME.txt`). Rotina: [[Trade - Sync]] (tarefa
  `Trade - Sync`, 06:25, 09:25, 12:25, 15:25 e 18:25). **Agendada pelo Júlio em 2026-10-14 (~13:54)**, modo senha guardada, `C:\BI\TRADE`,
  máquina a confirmar (esperada `SRV-IA`); a primeira carga pelo relógio (15:25) está por conferir. Antes disso, até
  2026-10-14 as cargas foram à mão, da máquina dele (2 cargas reais, 8 passos `OK` em `trade.controle_carga`).
- Para ver: **`INICIAR.bat`** (`http://localhost:8700`, só nesta máquina) ou **`INICIAR PARA A REDE.bat`** (sem login: só em
  reunião). Para atualizar na hora: **`ATUALIZAR DADOS.bat`** (~65 s; lê o WinThor, só leitura, e grava no banco). O painel aberto
  troca de versão sozinho em até 1 minuto. O `.claude/launch.json` do cérebro tem a configuração `trade` (porta 8700).
- **Os dados moram no DATA WAREHOUSE** (schema `trade`, 2026-10-14; ~37 MB, 10 tabelas, RLS ligada e sem policies): o pacote do painel
  (venda desde 2023 em arquivo colunar de ~25 MB, guardado em pedaços) e as bases pequenas (estoque, entradas, conta corrente), mais a
  classificação do Trade, o mapa de fotos e o histórico da ruptura. O motor em Node, na memória, lê o pacote do banco e responde as
  telas; sem banco, abre com a cópia de `web/dados/` (fora do Git: tem venda por cliente e por RCA). O fato de venda **não** virou tabela
  de 2,9 milhões de linhas, de propósito (o banco já saturou em 07/10 e o motor precisa dele inteiro em memória).
- **Fotos:** direto de `P:\FOTOS_ION` ([[Pasta de fotos FOTOS_ION]]), em miniatura WebP; 94,1% dos produtos ativos têm foto. Na Vercel, pela miniatura guardada no banco (`trade.produto_miniatura`).

## As telas (14)
Vendas: **Visão geral** · **Comparativo anual** · **Higiene & Beleza** · **Devoluções** · **Análise de venda** · **Curva ABC** ·
**Carteira de clientes** (novo: retidos, novos, reativados, perdidos e a ponte da venda). Estoque: **Ruptura** · **Estoque sem
venda** · **Cobertura** · **Produtos sem imagem**. Compras: **Conta corrente** · **Lançamentos de verba** · **Custo de compra**.
Detalhe de cada uma, e de onde veio no Power BI, no `README.md` do projeto.

**O relatório personalizado:** clicar em qualquer barra, ponto, fatia, cartão, linha ou resultado da busca abre o relatório
do recorte (cliente, produto, fornecedor, RCA, comprador, estado, mês…) com os filtros da tela: KPIs com comparativo,
evolução, quebras e abas *Detalhar* (tabela por 11 dimensões, colunas à escolha, Excel), *Estoque* (com foto do produto) e
*Verba*. Dentro dele, clicar abre o relatório do item (com *Voltar*); Ctrl+clique aplica como filtro; *Imprimir / PDF*.
Também busca global (`/`), modo apresentação (`F`), tema claro/escuro, link da visão. Segue [[Como eu gosto dos BIs]]:
azul-marinho e ouro, logo na placa branca, número em padrão brasileiro, rótulo em todo gráfico, "Dados até" no menu.

## Como funciona (e por que não é SQL na hora)
- Fato de venda **mensal por RCA × cliente × produto** (2,94 milhões de linhas, 2023-01 em diante); positivação, ticket e mix
  são contagens distintas, que não se somam. O **motor** (`web/motor.js`) filtra e agrega em memória, por mapa de bits, em
  dezenas de milissegundos; o navegador nunca recebe as linhas. O servidor se aquece ao ligar: o painel abre em ~0,1 s.
  Alternativa descartada: função SQL com filtro dinâmico no Supabase (1 a 3 s por clique, e o banco já saturou em 07/10).
- Gráficos SVG próprios (`web/js/graficos.js`): rótulo **medido** (horizontal se cabe, girado se não, dentro da fatia só se
  couber), eixo e rótulo na mesma unidade, linhas sem rótulo encostando em rótulo, cascata para as pontes.
- **Comparação com o mesmo número de dias:** cada linha guarda também a venda "até o dia de corte" (ontem). O mês em
  andamento é comparado com o mesmo trecho do mês do ano/período anterior; sem isso outubro parcial parecia queda de 41%.
  Só entram dias fechados (dados até **ontem**).

## Regras que mandam (resumo; completas no README)
- **Venda líquida = Σ QT × (PUNIT + VLOUTROS)** das operações S menos ED, filiais 1, 7, 10, 11 e 12, sem cancelados. Regra
  **descoberta** comparando a exportação de fev/2026 do Power BI com o WinThor dia a dia (as fórmulas do documento, com
  `PUNIT − ST`, davam −0,2% a −2%).
- **Positivação** = clientes com venda bruta > 0 (o Power BI contava linha de devolução também); **mix** = pares cliente ×
  produto ÷ positivação; **ticket** = venda líquida ÷ positivação.
- **Ruptura** = ativo, não promocional, entrada em 365 dias, estoque total disponível ≤ 0; **sem venda** = ativo, com estoque,
  1ª entrada há > 14 dias e sem venda em 8 semanas; **cobertura** viva (a conta antiga, ÷ 1,35, aparece ao lado); **ABC** com
  cortes únicos 80/95; **conta corrente** = débitos − créditos sem estorno.

## Validação contra o Power BI (2026-10-14)
`etl/conferir_power_bi.py` (não grava nada; lê as planilhas do Power BI em `Z:\TRADE MARKETING\Power BI\Geral`):

| Conferência | Painel | Power BI |
|---|---:|---:|
| Venda líquida de fev/2026 | R$ 9.973.673,00 | R$ 9.973.146,03 (**+0,005%**) |
| Clientes com venda / SKUs / pares (fev/2026) | 4.021 / 3.634 / 63.592 | 4.017 / 3.654 / 64.264 |
| Equipes Litoral Sul, Vitória Norte, BA Sudoeste (fev/2026) | exato | exato |
| Ruptura na foto EEG de 02/03/2026 | 510 | 490 |
| Venda 2024 / 2025 | R$ 108,48 mi / 118,59 mi | R$ 106,29 mi / 117,45 mi (+2,1% / +1,0%) |
| Venda 2023 | R$ 121,4 mi | ≈ R$ 104 mi (o Power BI está incompleto) |

Os anos fechados ficam acima do Power BI porque as planilhas dele eram salvas à mão (bug nº 1 do documento); não foi
investigado mês a mês. **Número só muda depois dos responsáveis da área** — vale para qualquer divergência nova.

## Achados que o Júlio precisa saber
- **11% da venda de 2026 (R$ 13,8 mi; 1.331 SKUs) está em produto fora da planilha de classificação do Trade**
  (`Categoria e subcategoria.xlsx`, última edição 2026-01-05). Para não virar balde "sem classificação", o produto herda o
  departamento da maioria dos produtos já classificados da mesma seção do WinThor, e categoria/marca do WinThor; fica marcado
  ("Herdada do WinThor"), aparece num aviso da Visão geral e se filtra. Atualizar a planilha corrige na carga seguinte.
- **Ruptura subiu**: 18,4% dos SKUs ativos não promocionais hoje (984 de 5.360) contra 11,2% na foto de 02/03 (509 de 4.529),
  mesma regra. A venda cresceu ~38% no ano (jan–out/2026 contra o mesmo período de 2025), o estoque não acompanhou.
- **Carteira**: de 9.748 clientes que compraram em jan–out/2025, 4.602 não compraram em 2026 (mas só R$ 15,5 mi dos R$ 90 mi);
  entraram 2.660 novos (R$ 16,0 mi) e voltaram 994 (R$ 6,6 mi).
- A **equipe** de venda é a **atual** do RCA; no Power BI era a da época (por isso Televendas e RJ divergem do original).
- Compradores hoje: Geldson, Júlio César e Marcelo (mais contas internas: Sérgio Buzzette, Sérgio Firme, Consumo). Bruno,
  Gilsinei e Norton, do Power BI, não aparecem: saíram do cadastro de comprador.

## Pendências (decisões do Júlio)
- [x] **Júlio: agendar a carga** — feito em 2026-10-14 (~13:54), `INSTALAR TUDO.bat`, modo senha guardada.
- [ ] **Conferir a primeira carga pelo relógio** (15:25, 18:25, 06:25) em `trade.controle_carga`. A máquina já está confirmada:
  **`SRV-IA`**, conta `LUBE\gti.julio.alves` (`pacote_versao.meta.fontes.executou`, desde a carga de 14:02).
- [ ] **Fotos na carga agendada:** a tarefa não acessa `P:\FOTOS_ION` (`P:` não existe na sessão dela, erro 3) e o servidor
  `192.168.0.5` só aceita o usuário `admwinthor` (o do `P:`), não a conta de domínio (erro 1272). O `cmdkey` **não resolve** (a tarefa
  não usa o cofre: erro 1326 mesmo com a senha certa). `imagens` fica em AVISO e vale o mapa do banco. **Solução pronta (`etl/rede.py`,
  commit `9d4290c`), falta o Júlio:** rodar `ATUALIZAR AGORA.bat` na `SRV-IA` (copia o código novo), criar `C:\BI\TRADE\fotos.cred` (senha
  do `admwinthor` cifrada pelo Windows; comando no `LEIA-ME.txt`) e disparar a tarefa; `imagens` em `OK` prova que funcionou. Depois,
  `cmdkey /delete:192.168.0.5` para tirar a credencial do cofre.
- [ ] **Trocar a senha do `admwinthor`** (ou criar um usuário só de leitura para `FOTOS_ION`), pedido ao TI: a senha apareceu num
  print e no histórico do PowerShell da `SRV-IA` em 2026-10-14.
- [x] **`openpyxl` na máquina da carga** — instalado pelo Júlio; a carga de 14:02 releu a planilha (`classificacao` OK, 8.820).
- [x] **Publicar o painel** — feito em 2026-10-14 na Vercel (ver "Publicação na Vercel" abaixo).
- [x] **Variáveis no projeto certo** — o Júlio cadastrou as 5 `SUPABASE_DB_*` no `gestao-comercial-trade` (14:50) e o painel passou a carregar os dados (consultas
  liberadas para `cpd` 17:14, `g.comercial` 16:39 e `marketing` 15:40, na Sentinela). O projeto **duplicado** `gestao-comercial` (Root errado, 404, fora da Sentinela,
  com cópia da senha) **ainda existe**: apagar.
- [ ] **Júlio: quem abre?** O cartão está **ativo** (ativado no portal depois que o Claude o criou inativo). Hoje abrem **7 contas**: as 6 com "Todos os sistemas" e sem
  exceção (`araujo`, `aurea`, `cpd`, `dp`, `g.comercial`, `gustavo`) e `marketing` (permissão explícita; `g.comercial` é conta nova, criada depois). Para tirar alguém:
  "Liberar tudo, exceto" no painel admin. Conferido por SQL em 2026-10-14.
- [x] **Fotos na Vercel** — resolvido em 2026-10-14: o ETL guarda uma miniatura WebP (288 px, ~11 KB) de cada foto em `trade.produto_miniatura` (8.515 miniaturas, ~97 MB,
  168 s na primeira carga, feita à mão) e a função `api/img` serve de lá, só para quem entrou. Commit `ac6e4af`. **Falta, para o passo funcionar na carga agendada:**
  Pillow na `SRV-IA` (`python -m pip install pillow`) e o `fotos.cred`; até lá, foto nova só entra rodando `python sync_trade.py --so-miniaturas` de uma máquina que enxergue a pasta.
- [x] **GitHub** — repositório público, feito em 2026-10-14.
- [ ] **Quem mantém a classificação do Trade?** O documento recomenda uma tabela editável no painel
  (`core.produto_classificacao_trade`); hoje é a planilha à mão.
- [ ] O gestor comercial viu e aprovou as regras novas (positivação, equipe atual, cobertura, custo real)? Cada divergência
  está na tabela do README.
- [ ] **Conta corrente: o total ainda não fecha com o Power BI.** O saldo por fornecedor bate (303 de 323 fornecedores, ao
  centavo, contra o relatório `Base de dados.xlsx` de 14/11/2025 — **desde que os estornos entrem**: sem eles só 284 batem; foi o
  que se corrigiu nesta conversa). Mas o total dos fornecedores ativos em 11/02/2026 dá **R$ 1,28 mi** no painel contra
  **R$ 1,06 mi** no Power BI. Hipóteses não testadas: população diferente (4 compradores fixos, dois deles hoje fora do
  cadastro) e o `Saldo inicial` somado em linhas repetidas no modelo antigo. Hoje o painel mostra R$ 1,47 mi para os 287
  fornecedores ativos.

## Publicação na Vercel (2026-10-14)
Mesmo molde do [[BI COMERCIAL]]: Root Directory `web`, Framework Other, sem build, região `gru1`, Node 22 (`engines` do `package.json`), guarda da
[[SENTINELA LUBE]] (`middleware.ts` + `sentinela-guarda.ts` 1.1.0, `FECHADO = gestao-comercial-trade`), Vercel Authentication Standard
(`prod_deployment_urls_and_all_previews`). Funções `api/consulta`, `api/versao` e `api/dados` (rewrite `/dados/:nome`), com `web/pacote.js` igual ao do
servidor local: lê o pacote do banco na primeira chamada de cada instância (~5 s de partida a frio medidos com o banco em São Paulo), checa versão nova no máximo
1x por minuto (`waitUntil`), conexão que abre e fecha na hora. **Variáveis (cadastra o Júlio):** `SUPABASE_DB_HOST` `aws-0-sa-east-1.pooler.supabase.com`,
`SUPABASE_DB_PORT` `5432`, `SUPABASE_DB_NAME` `postgres`, `SUPABASE_DB_USER` `postgres.ivcnotrynogaljrvvyes`, `SUPABASE_DB_PASSWORD` (a do ENV, Sensitive).
- **Provado de fora (navegador, sem login, 14:39):** `/` vai para o portal; `/dados/dims.json` responde `{"erro":"login_necessario"}`; `/.sentinela/saude` mostra
  `oidc: true`, lista ok, modo proteger. A Sentinela registrou os três acessos (`bloqueado`, `sem_login`; o 1º, `robo`, sem bloqueio de IP).
- **Registro por SQL no banco do portal** (migração `registrar_gestao_comercial_trade`): `sentinela.sistemas` (`exige_login = true`; `arquivos_proibidos` para
  `package*.json`, `vercel.json`, `db/`, README e os módulos do servidor) e `public.sistemas` (slug `gestao-comercial-trade`, "GESTÃO COMERCIAL (TRADE)",
  categoria COMERCIAL, ordem 9, **`ativo = false`**). Zero permissões explícitas.
- **Versão trocada no meio da sessão:** a tela manda `meta.gerado_em` em cada pedido; o servidor responde 409 se for outra versão, e a tela recarrega
  (os índices de cliente, produto e RCA mudam a cada carga). Valia também para o servidor local desde a troca automática de versão.
- **Fotos na Vercel (2026-10-14):** a Vercel não enxerga a pasta (rede interna); o ETL, que enxerga, grava a miniatura de cada foto no banco e a função `api/img`
  serve de lá (`/img/:cod` reescrito para `/api/img?cod=`), com cache `private` e memória curta na instância; foto sem login nunca sai (o guarda manda para o portal, conferido de fora).
- **O que a Vercel não tem:** a carga (é a tarefa `Trade - Sync` na `SRV-IA`).

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-20 (~12:35)** — **Foto do produto inteira na moldura** (Júlio pediu "aplica a mesma correção de enquadramento das fotos no Gestão Comercial (Trade)", Claude fez): a moldura em grade não dava altura ao `max-height: 100%`, e a foto em pé passava da caixa (cortada na miniatura, vazando na ampliada e no relatório). `web/css/base.css` (`.foto-mini`, `.foto-zoom`, `.dos-foto`: grade de uma célula de 100% + `img` 100% com `object-fit: contain`), igual ao [[MOVIMENTAÇÃO DE INVENTÁRIO]]. Conferido no painel local (Curva ABC: 49 de 49 miniaturas dentro, garrafa de 144×480 desenhada 62×208 na moldura de 232); commit **`acb951a`**, deploy automático · [[2026-10-19 — Movimentação de Inventário, rotinas 266 e 1147]]

- **2026-10-19** — **Trade no Guardião e publicar mais leve** (Júlio pediu, Claude fez): o [[GUARDIÃO DA LUBE]] passou a vigiar a rotina, a tarefa e o site (migração `saude_v1_trade`); o `publicar` reaproveita o arquivo que não mudou (`versao_dados`), grava em pedaços com limite de tempo folgado e até 3 tentativas, e uma carga pulada pela tranca deixa rastro. Carga real: `publicar` em 10,6 s (antes 164 a 267 s). Commit `492b778`, painel publicado antes (`dpl_7EHiwHkSA4GrszvA1HhU36gDaJ55`). **Falta o Júlio rodar o `ATUALIZAR AGORA.bat` na `SRV-IA`.** Detalhe em [[Trade - Sync]] e [[Registro de mudanças]].
- **2026-10-19** — **Verificação da atualização** (Júlio pediu, Claude só leu): as cargas das 5 horas rodaram de 17 a 19/10, todos os passos `OK`, pacote `20261019-092802` no ar. Furos achados: 16/10 sem publicar às 09:25 (limite de tempo do banco) e sem registro às 12:25; `publicar` lento (37 a 214 s) desde 17/10; o Guardião não vigia o Trade. Detalhe e números em [[Registro de mudanças]].

- **2026-10-15** — **Validação das fotos dos produtos** (Júlio pediu, Claude fez): carga completa à mão antes (14:43, pacote `20261015-144432`); 5.193 produtos ativos com foto conferidos contra o nome; **113 apontados (2,2%)**, com relatório em Excel e a lista na nota [[Validação das fotos dos produtos — 2026-10-15]]. Só leitura: nenhum dado foi alterado. Corrigir foto ou nome é do cadastro (quem mantém `FOTOS_ION` e o WinThor).
- **2026-10-15** — **Tela de espera com o caminhão da Lube** (Júlio pediu, Claude fez): o caminhão do portal, animado, com painéis caindo no baú, no lugar do relógio puro; `L.espera` em `web/js/componentes.js`, CSS em `web/css/base.css`. Commit `4117c9f`, deploy `dpl_4TxrvXVUM5CPCikav28uiP7mfAeL`. Detalhe em [[Registro de mudanças]].
- **2026-10-15** — **Foto do produto nas listas** (Júlio pediu, Claude fez): miniatura de 38 px antes do nome em ruptura, sem venda, produtos sem imagem, venda por produto, curva ABC, custo de compra e na árvore por comprador; foto maior ao passar o mouse; cinza quando não há foto. Commit `f6887e6`, deploy `dpl_CGpXSgigHdaL53o4MYnZN9QNyScv` (produção, pelo Git); a Sentinela continua na frente. Código: `L.fotoMini` em `web/js/componentes.js`, `foto`/`fotoColuna` em `web/js/tabela.js`. Detalhe em [[Registro de mudanças]].
- **2026-10-15** — **Fotos na carga agendada funcionando** (Júlio criou o `fotos.cred` na `SRV-IA`, Claude conferiu no banco, 09:14): carga ids 158 a 166, 9 passos `OK`, `imagens` pela pasta de verdade (8.514 produtos), `miniaturas` `OK`, pacote `20261015-091536`. Foto nova entra sozinha nas 5 cargas do dia. Pendente: trocar a senha do usuário do compartilhamento e refazer o `fotos.cred`; conta só de leitura no TI. Detalhe em [[Trade - Sync]].
- **2026-10-15** — **Fotos na carga agendada, diagnóstico das 09:00** (Júlio na `SRV-IA`, Claude no banco): `fotos.cred` não existia; a senha do `cmdkey` estava errada; a conta de domínio do Júlio lista a pasta na sessão dele, mas a tarefa (senha guardada) segue com o erro 1272 (carga das 09:05, 8 passos `OK`). Decisão: criar o `fotos.cred` e disparar a tarefa; conta só de leitura no TI como melhoria. Detalhe em [[Trade - Sync]] e [[Pasta de fotos FOTOS_ION]].
- **2026-10-15** — **Fotos na carga agendada, ainda não** (Claude, 07:57): a `SRV-IA` já roda o código novo (carga das 07:49, 8 passos `OK`), mas `imagens`/`miniaturas` seguem em AVISO porque o `fotos.cred` não foi achado em `C:\BI\TRADE`. O `fotos.py` passa a avisar quando o arquivo não existe (sem commit; vai na próxima publicação). Detalhe em [[Trade - Sync]] e [[Registro de mudanças]].
- **2026-10-14** — **Fotos na Vercel** (Júlio pediu "preciso que essas imagens fiquem aparecendo no sistema", Claude fez): tabela `trade.produto_miniatura` (migração
  `trade_produto_miniatura`, `web/db/02-miniaturas.sql`); passo `miniaturas` no `sync_trade.py` (WebP 288 px, incremental, 10 min por carga, Pillow opcional, flags
  `--so-miniaturas`, `--sem-miniaturas`, `--minutos-miniaturas`); função `api/img` + rewrite `/img/:cod`; `fonte_dados.js` com conexão contada; servidor local cai para a
  miniatura do banco sem a pasta; primeira carga completa à mão (8.515 miniaturas em 168 s, 0 falhas) e uma carga completa depois (9 passos `OK`, miniaturas 0 em 0,3 s:
  incremental); 22 testes das funções em modo Vercel contra o banco real; commit `ac6e4af`, deploy `dpl_2PU3xzXcWAJTQHfwRT8cvEa8cyfo` pronto · [[Trade - Sync]] · [[2026-10-14 — Gestão Comercial recriada do BI final do Power BI]]
- **2026-10-14** — **No GitHub e na Vercel** (Júlio pediu, Claude fez): repositório público `Lube-Distribuidora-LTDA/GEST-O-COMERCIAL` (`8f08cff`, história condensada e
  varrida de números de negócio, IP interno e usuário do compartilhamento, que passaram para o ENV); projeto `gestao-comercial-trade` (`prj_PpgCB4Ez2d8ZK1ICjxOL8wjlueXT`),
  primeiro deploy `dpl_D4t4917jVK43ebuoPjpWYVwnfSP4` pronto; registro na Sentinela e no portal (cartão inativo); `web/pacote.js` compartilhado, funções da Vercel e
  recusa 409 de versão antiga · [[2026-10-14 — Gestão Comercial recriada do BI final do Power BI]]

- **2026-10-14** — **Carga agendada** (Júlio): `INSTALAR TUDO.bat`, tarefa `Trade - Sync` criada em modo senha guardada (conta
  `LUBE\gti.julio.alves`, `C:\BI\TRADE`); a carga disparada pelo instalador (13:54–13:55, versão `20261014-135518`) fechou 8 passos, 2 em
  AVISO (falta `openpyxl`; tarefa sem acesso a `P:\FOTOS_ION`). Claude passou a gravar o motivo de cada falha e a máquina/conta
  na carga (commit `a72e4a7`) · [[Trade - Sync]]
- **2026-10-14** — Instalador do Trade corrigido (Claude): o primeiro `INSTALAR TUDO.bat` do Júlio parou na conferência das bibliotecas
  do Python sem dizer qual faltava (erro do Python em stderr derruba o PowerShell 5.1 com `ErrorActionPreference=Stop`); agora testa uma
  biblioteca por vez e o `openpyxl` é opcional · [[Trade - Sync]]
- **2026-10-14** — **Ligado ao DATA WAREHOUSE, às fotos de `P:\FOTOS_ION` e à pasta de integração** (Júlio pediu, Claude fez): schema
  `trade` (migração `trade_schema_inicial`, 10 tabelas, RLS ligada sem policies), `sync_trade.py` com 8 passos e conferência antes de
  publicar, `gravar_trade.py`, `fotos.py`, `diagnostico_trade.py`, servidor lendo o pacote do banco e trocando de versão sozinho
  (`fonte_dados.js`), miniaturas WebP, histórico da ruptura por código de comprador, pasta `P:\INTEGRAÇÃO BI\TRADE` com instalador
  (tarefa `Trade - Sync`, **ainda não instalada na `SRV-IA`**), commit local `ab53223`; 2 cargas reais conferidas · [[Trade - Sync]] · [[2026-10-14 — Gestão Comercial recriada do BI final do Power BI]]
- **2026-10-14** — Sistema criado (Claude, a pedido do Júlio): ETL (`extrair_trade.py`), motor em memória, painel de 14 telas
  com relatório personalizado, `conferir_power_bi.py`, README, `.bat`s de uso; commits locais `6aeae28` e `228335a`, sem GitHub e sem deploy;
  `.claude/launch.json` do cérebro ganha `trade` (porta 8700) · [[2026-10-14 — Gestão Comercial recriada do BI final do Power BI]]

Veja também [[Mapa de sistemas]], [[BI COMPRAS]] (de onde vêm estoque x venda e dimensões), [[data-warehouse]], [[Trade - Sync]]
(a rotina da carga) e [[Pasta de fotos FOTOS_ION]].
