---
tipo: projeto
departamento: Logística
status: ativo
inicio: 2026-10-06
tags: [bi, reposicao, chamados, logistica, winthor]
---
# REPOSIÇÕES E CHAMADOS

Painel das **reposições** (pedidos lançados no vendedor `999 REPOSICAO`) e dos **chamados** que as causam, no padrão da casa ([[data-warehouse]]): [[WinThor]] → ETL em Python → [[Supabase]] (schema `reposicao` do DATA WAREHOUSE) → painel na [[Vercel]]. Nasceu da planilha `Consolidado_Chamados_Reposicoes_Janeiro_a_Setembro_2026.xlsx`, que o Júlio montava juntando as duas rotinas à mão. Origem da conversa: [[2026-10-06 — Dashboard de Reposições e Chamados]]; ajustes e lentidão em [[2026-10-07 — Ajustes do painel de Reposições e a lentidão ao abrir]]; comparação com o período anterior e o script da VM em [[2026-10-09 — Comparação com o período anterior e o script de atualização da VM]].

- **Rotina 8352** — *Pedido de Reposição*: `PCPEDC`/`PCPEDI` com `CODUSUR = 999` e `POSICAO = 'F'`.
- **Rotina 8353** — *Relatório Geral de Chamados*: `PCMANIF`/`PCMANIFPROD`/`PCMANASSUNTO` (as "manifestações" do SAC). Ambas rodam no `PCSIS800` (relatórios personalizados).
- Os assuntos **"SAC - ..." (65 a 73)** são os que o RCA usa no [[SAC]] (2026-10-07), a tela de abertura de chamado.
- Repositório: [Lube-Distribuidora-LTDA/REPOSICOES](https://github.com/Lube-Distribuidora-LTDA/REPOSICOES) (commits `cc6d78e` de 2026-10-06; `fee976d`, `e3cce06`, `c5ab85e` e `5b6a0bd` de 2026-10-07; `261b9a0` de 2026-10-09) · cópia local em `Desktop\BI\9. REPOSICOES`
  - ⚠️ **Está público.** Não há senha, IP do Oracle nem usuário do banco lá dentro (conferido antes do push); o que aparece é a estrutura do banco, a regra de ligação e números de reposição. O padrão da casa é privado — mas no plano Hobby da [[Vercel]] repositório privado pode travar o deploy (ver a nota). Decisão do Júlio.
- Edição em `P:\INTEGRAÇÃO BI\REPOSICOES` (`1 - CONFIGURACAO` com o `ENV` e o `ENV.example`, `2 - SISTEMA REPOSICOES` com os scripts, `3 - INSTALACAO` com o `instalar_e_agendar.ps1`, e o `INSTALAR TUDO.bat` na raiz) · execução em `C:\BI\REPOSICOES`, que **só passa a existir quando o instalador roda**.
  - O `ENV` da rede é o de **leitura** do BI Comercial, copiado sem abrir, mais o `PAINEL_URL`. É o único arquivo que fica fora do Git, de propósito (tem senha).
- Rotinas: [[Reposições - Sync]] (carga) e [[Reposições - Aquecer painel]] (aquecedor).
- Mais detalhes (regra de ligação, divergências, como rodar): `README.md` do repositório.

## Peças do sistema
- **ETL (`etl/`):** `consultas_reposicao.py` (as 3 consultas — `reposicao_item`, `chamado`, `chamado_item` — e o leitor da NF digitada nas observações, que aceita várias NFs por observação e grafias como `PEND. RE.F  ANF 1540436`), `sync_reposicao.py` (orquestrador; grava `controle_carga` e, no fim, o cache do painel), `diagnostico_reposicao.py` (roda tudo **sem gravar** e confere 2026 contra a planilha), `aquecer_painel.py`, `executar.py` (inicializador do Agendador; erro antes do log vai para `falha_inicial.log`), `bi_comum.py` — **copiado do BI COMERCIAL em 2026-10-06 e trocado pela versão de 2026-10-08 em 2026-10-09**, com a **tranca de carga** (uma carga por vez, mesmo com duas máquinas) — e o **`ATUALIZAR AGORA.bat`** (2026-10-09; ver abaixo).
- **Variáveis do `ENV`** (nomes, sem valor): `ORACLE_*`, `SUPABASE_DB_*`, `PAINEL_URL`, `LOG_LEVEL` e, opcionais, `REPOSICAO_DATA_INICIAL` (padrão 2025-01-01) e `REPOSICAO_FILIAIS` (vazio = todas).
- **Painel (`web/`):** `index.html` (estilo do [[BI COMERCIAL]]), `app.js` (filtros, KPIs, gráficos em SVG, rankings, tabelas e a cópia no navegador), `planilha.js` (gera o `.xlsx` **sem biblioteca**, com os filtros escritos e o rodapé "Gerado pelo painel de Reposições"), `api/dados.js` e `api/_db.js` (conexão com `application_name = painel-reposicoes`, que identifica o painel nas conexões do banco).
- **`web/servidor_local.js`:** abre o painel em `http://localhost:3101` (porta muda com `PORTA`) chamando o banco de verdade com o `ENV` do ETL, sem imprimir a senha. `--atraso=` ou `ATRASO_API_MS` simulam o banco lento (com 9 s, a segunda visita abriu em ~1 s pela cópia do navegador).

## Banco: o schema `reposicao` (DATA WAREHOUSE)
Cinco migrações, registradas no histórico de migrações do projeto no [[Supabase]] e versionadas em `web/db/` (horário de Brasília). Conferido em 2026-10-09: não há outra migração mexendo em `reposicao`.

| Migração | Quando | O que fez |
|---|---|---|
| `reposicao_01_schema` | 2026-10-06 15:17 | schema, `controle_carga` e as 3 fatos (`fato_item`, `fato_chamado`, `fato_chamado_item`); RLS ligado e **sem políticas** |
| `reposicao_02_views_e_funcao` | 2026-10-06 15:21 | `vw_vinculo` (regra de ligação), `vw_linhas` (junta cliente e emitente) e `painel_dados()`, que devolve o JSON |
| `reposicao_03_valor_em_centavos` | 2026-10-06 15:34 | `vw_linhas` reparte o valor do pedido em **centavos exatos** entre as linhas (4.475 pedidos fecham ao centavo, unidades também) |
| `reposicao_04_painel_dados_compacto` | 2026-10-06 15:35 | JSON enxuto: quantidade inteira, valor com 2 casas, cliente e emitente num dicionário por índice |
| `reposicao_05_painel_cache` | 2026-10-07 13:52 | `painel_cache` (uma linha só, `id = 1`: `gerado_em`, `carga`, `payload`) e `atualizar_painel_cache()`, que monta o JSON e devolve o tamanho (1,4 MB na primeira vez) |

- A API lê `painel_cache`; se a linha não existir (banco novo), **cai para `painel_dados()`** e monta na hora. O cabeçalho `X-Painel-Origem` diz qual dos dois respondeu (`cache` ou `calculado`).
- Mudou `painel_dados()`? Rode `SELECT reposicao.atualizar_painel_cache();`, senão o painel continua mostrando o JSON antigo.
- `web/db/02-views-e-funcao.sql` é a definição vigente das views e da função; o 03 e o 04 registram a ordem em que foram aplicados.

## Painel na Vercel
- Projeto `reposicoes-web`, criado pelo **Júlio** em 2026-10-06 (primeiro deploy às 17:17, commit `cc6d78e`). Framework **Other**, **Root Directory `web`** (sem isso dá 404), Build e Output em branco, região `gru1`, `api/dados.js` com até 60 s, cabeçalho `X-Robots-Tag: noindex, nofollow`.
- Cinco variáveis `SUPABASE_DB_*` em Production, Preview e Development, cadastradas pelo Júlio, com a **porta 5432**: a 6543 conecta e trava neste banco (medido no [[SISTEMA FINANCEIRO]]). A senha é a mesma que o painel do COMERCIAL usa.
- Deploy automático a cada push na `main`. Todos os deploys até 2026-10-09: `cc6d78e` (06/10 17:17), `fee976d` (07/10 11:33), `e3cce06` (14:01), `c5ab85e` (14:14) e `5b6a0bd` (14:15), todos `READY`. Em 2026-10-09 entrou o `261b9a0` (comparação com o período anterior), conferido no ar.

## O que o painel tem
Cinco páginas, menu lateral, filtros fixos no topo: **período · motivo · com/sem chamado · motorista · cliente** (e filial).
Período, motivo, com/sem chamado e motorista foram pedidos pelo Júlio (2026-10-06); a filial foi acréscimo do Claude no mesmo dia; o cliente veio a pedido do Júlio em 2026-10-07 (são mais de 2 mil: a lista mostra os 300 que mais pedem e o resto vem pela busca). No celular a barra de filtros recolhe num botão.
1. **Visão geral** — R$ mês a mês (com × sem chamado) e acumulado do ano contra o anterior; **% de reposições com chamado** mês a mês com média do período e média anual; principais motivos e clientes; no cartão principal, a variação contra o **período anterior** e contra o **mesmo período do ano anterior** (ver abaixo).
2. **Motivos** — ranking por R$, evolução mensal dos 4 maiores, tabela completa.
3. **Itens** — por valor, por volume e por recorrência (itens ou fornecedores).
4. **Motoristas** — chamados e valor reposto por motorista.
5. **Detalhe** — linha a linha, com exportação `.xlsx` formatado.

### Clique leva ao Detalhe já filtrado (2026-10-07)
Todo cartão, barra, ponto, ranking, média anual e linha de tabela abre o **Detalhe** com o recorte do número — "Falta de mercadoria" abre só esse motivo; a parte "sem chamado" da coluna de abril abre abril sem chamado; um item abre só aquele item (a faixa sob os filtros mostra e deixa tirar). **← Voltar** devolve a tela de onde saiu, com os filtros dela. Ao passar o mouse nos gráficos, cartão com o valor de cada série, total, reposições do mês e % com chamado. Na Visão geral há o card **Cliente que mais fez reposições** (mais pedidos distintos; empate vai para o maior valor). **SKU** (tabela de Motivos) = produtos distintos, não linhas de item.

### Comparação do cartão principal (2026-10-09)
Pedido do Júlio: "filtrei jan/26, ele precisa aparecer apontando a comparação com dez". O cartão ganhou duas linhas, cada uma com a variação (▲/▼ %), o valor do período comparado, um tooltip (escolhido × comparado × diferença, reposições, ticket médio, % com chamado) e **clique que abre o período comparado no Detalhe**:
- **Período anterior** — o que vem logo antes e tem o mesmo tamanho: **meses fechados comparam mês com mês** (jan/26 → dez/25, fev → jan, jan–mar → out–dez); **"até hoje"** (mês em andamento) → os mesmos N meses antes até o mesmo dia do mês; **datas livres** → os mesmos N dias imediatamente antes.
- **Ano anterior** — o mesmo período um ano antes (jan/26 → jan/25).
- Valem **com os mesmos filtros** do período escolhido. Sem dado no período comparado (o histórico começa em 2025-01-01), aparece "sem dados de …" em cinza.
- Conferido com dado real, **no painel publicado**: jan/26 → dez/25 ▲ 9,6% (R$ 27.037,92); fev → jan ▼ 17,3%; jan contra jan/25 ▼ 4,3%; fev contra fev/25 ▼ 37,9%.
- Junto veio uma correção: os campos de data **não trocam mais de lugar** quando o "de" passa do "até" (o outro acompanha).

## Atualizar os dados na VM sem esperar o agendamento (2026-10-09)
**`ATUALIZAR AGORA.bat`** (no repositório em `etl/` e em `P:\INTEGRAÇÃO BI\REPOSICOES`): duplo clique **na `SRV-IA`** (em outra máquina pede para digitar `SIM`). Faz três passos e mostra o resultado na tela: (1) copia o ETL mais novo da pasta de rede para `C:\BI\REPOSICOES`; (2) roda **uma** carga (`executar.py`); (3) chama o painel publicado (`aquecer_painel.py`) para ele buscar o dado novo. Mostra a linha **"PAINEL ATUALIZADO: reposições até DD/MM/AAAA (N pedidos no banco)"** do log. **Não cria nem muda tarefa agendada** — isso é o `INSTALAR TUDO.bat`, uma vez só. A tranca de carga faz uma carga manual esperar de fora se a agendada estiver rodando. Depois da carga o painel mostra o dado novo em até 5 min; para ver na hora: **Shift+clique em Atualizar**. Rotina em [[Reposições - Sync]].
- Testado de ponta a ponta na `LOGISTICA-55` (carga de verdade, conferida em `reposicao.controle_carga`) e a **tranca** com duas cargas ao mesmo tempo (a segunda saiu sozinha, só uma entrou no banco). **Ainda não rodado dentro da `SRV-IA`.**

## Desempenho: o painel não espera mais o banco (2026-10-07)
O Júlio reclamou que o sistema demorava muito "lendo o banco" — **na frente da empresa a quem estava mostrando**. Medido no painel publicado: 504 depois de 60 s na primeira chamada, 13 s na segunda, 0,16 s na terceira (CDN). A causa foi o banco/pooler saturado (ver [[Supabase]], incidente de 07/10), mas o desenho também era frágil: cada visita fria dependia de abrir uma conexão. Agora:
1. **`reposicao.painel_cache`** — a carga monta o JSON uma vez; a API só lê essa linha (antes montava a cada visita).
2. **CDN da Vercel** — `s-maxage=300, stale-while-revalidate=86400`: depois de 5 min a resposta ainda é entregue na hora enquanto uma nova é buscada por trás. Com `stale-if-error=86400`, se a busca nova falhar, a cópia velha continua saindo por até 24 h. Erro nunca vai para o cache.
3. **Aquecedor** — `aquecer_painel.py` chama o painel de 5 em 5 minutos ([[Reposições - Aquecer painel]]); a espera, se houver, é dele.
4. **Cópia no navegador (IndexedDB)** — a tela abre na hora com os últimos dados, mostra "dados guardados · atualizando…" e troca se houver carga nova.
5. Conexão com tentativas escalonadas; tela de espera com relógio e explicação; "Atualizar" usa a cópia do CDN (Shift+clique força o banco).

**Prova:** com o banco travado (o conector do Supabase dando timeout), a API publicada respondeu em **0,18 s** (`X-Vercel-Cache: STALE`). Depois do reinício do banco: primeira chamada pós-deploy 0,5 s, seguintes 0,28 s. Detalhes e o que olhar se voltar a demorar: README, seção *Desempenho*.

**Limite:** a primeira visita depois de um deploy, ou depois de 24 h sem ninguém chamar o painel, ainda é fria. O aquecedor impede isso — **agendado em 2026-10-09, mas em 2026-10-14 o [[GUARDIÃO DA LUBE]] provou que NÃO está
esquentando na `SRV-IA`**: toda chamada dá `URLError … CERTIFICATE_VERIFY_FAILED: unable to get local issuer certificate`
(o Python da VM não confia no certificado do `vercel.app`; hipótese: a raiz que o Windows baixa sob demanda nunca foi
baixada na VM, porque ninguém abriu o site por lá). E, quando a [[SENTINELA LUBE]] for instalada, o aquecedor precisará de um jeito de passar pelo guarda.

## A planilha somava 44% a mais
A coluna `VALOR TOTAL` da planilha é o total do **pedido**, repetido em cada item e em cada chamado do item. Somá-la dava **R$ 316.230,78** em jan–set/2026; o total real é **R$ 218.896,89** (soma de `PCPEDC.VLTOTAL`, conferido no Oracle ao centavo: 1.622 pedidos, 2.005 itens). O mesmo vale para qualquer planilha consolidada que junte rotina de capa com rotina de item — ver [[Como eu gosto dos BIs]].

## Números de referência (2026-10-06)
| | jan–set/2026 |
|---|---|
| Total reposto | R$ 218.896,89 em 1.622 pedidos (ticket médio ~R$ 135) |
| Pedidos com chamado | 85,1% (1.381) — a planilha dizia 83,4% |
| Valor sem chamado | ~20% do reposto |
| Principal motivo | Falta de mercadoria (~45% do R$) |
| Até 02/10 (ano) | R$ 221.288,79 · 17,1% abaixo do mesmo período de 2025 |
| 2025 inteiro | R$ 336.714,36 em 2.826 pedidos; 81,2% com chamado |

## Decisões
- 2026-10-06 (Júlio): os dados vêm do **acesso de consulta ao WinThor registrado no cérebro**, não só da planilha.
- 2026-10-06 (Júlio): **campo de chamado vazio = reposição sem chamado.** No banco isso virou "nenhum chamado ligado, por nenhum dos dois caminhos da regra de ligação".
- 2026-10-06 (Claude): **a fonte é o Oracle, não a planilha.** A planilha virou referência de conferência (`diagnostico_reposicao.py`).
- 2026-10-06 (Claude): **unidade da "reposição" é o pedido.** Pedido conta como *com chamado* se ao menos um item tem chamado ligado; o percentual de valor é por item.
- 2026-10-06 (Claude): **regra de ligação** (view `reposicao.vw_vinculo`): mesma filial + NF citada na observação + mesmo produto; se não houver, qualquer chamado da mesma NF. Chamado aberto até 90 dias antes ou 7 dias depois da reposição. Reproduz **2.073 das 2.127 linhas** da planilha (97,5%); as diferenças, medidas uma a uma, estão no README. A janela de 7 dias depois evita as 46 ligações da planilha com chamados abertos até 145 dias depois da reposição. Por estar numa view, mudar a regra não exige carga nova.
- 2026-10-06 (Claude): **dinheiro aditivo em centavos exatos** (maior resto): a soma das linhas de um pedido é o total do pedido, e a tela fecha com o Excel exportado. Motivo: 15 centavos de diferença entre a tela e o Excel no teste.
- 2026-10-06 (Claude): **histórico desde 2025-01-01** (ajustável por `REPOSICAO_DATA_INICIAL`) — permite o comparativo com o ano anterior.
- 2026-10-06 (Claude): **não publicar nem agendar por conta própria** — a senha do banco na Vercel e a instalação são do Júlio ([[Como trabalhar comigo]]).
- 2026-10-06 (Júlio): o repositório é `Lube-Distribuidora-LTDA/REPOSICOES`, criado por ele, e ficou **público** (o Claude avisou que foge do padrão da casa).
- 2026-10-07 (Júlio pediu o clique; Claude definiu o comportamento): **o clique troca só a dimensão clicada** e abre o Detalhe; o **Voltar** restaura os filtros de antes. Item e fornecedor, que não têm controle na barra, vão numa faixa sob ela.
- 2026-10-07 (Claude, depois da reclamação do Júlio sobre a lentidão): **o painel não lê o banco ao abrir** (cache no banco + CDN + aquecedor + cópia no navegador). "Atualizar" usa a cópia do CDN, porque os dados só mudam quando a carga roda; Shift+clique lê o banco.
- 2026-10-07 (Claude): a busca usa `fetch` com `no-store` e a cópia fica explícita no IndexedDB — o Chrome entregava a resposta velha do cache dele sem avisar.
- 2026-10-07 (Claude): **a primeira visita depois de um deploy segue fria** — aceito; o aquecedor cobre o resto.
- 2026-10-07 (Júlio pediu "Itens → SKU"; Claude corrigiu a conta): **SKU = produtos distintos**, não linhas de item (1.201 → 761 em "Falta de mercadoria").
- 2026-10-09 (Júlio pediu; Claude definiu a regra): **comparar o período escolhido com o anterior de mesmo tamanho** — mês fechado contra mês, não dia contra dia — além do ano anterior, ambos com os mesmos filtros (detalhe acima).
- 2026-10-09 (Claude): o **script da VM só atualiza, não agenda**, e **fora da `SRV-IA` pede confirmação** (SIM); o agendamento fica no `INSTALAR TUDO.bat`, decisão do Júlio.
- 2026-10-09 (Claude): `bi_comum.py` trocado pelo de 2026-10-08 do COMERCIAL, para a carga ter a **tranca** antes de ser instalada.
- 2026-10-06 (Claude): a função do banco devolve **linhas**, e os filtros e gráficos são calculados no navegador — exceção consciente ao "uma função, um JSON de totais", porque o volume é de ~6 mil linhas e os cinco filtros se cruzam com tudo.

## Estado em 2026-10-07 (reconferido e atualizado em 2026-10-09)
- **Banco:** schema `reposicao` com 5 migrações (01 a 05). **Última carga: 2026-10-09 13:40** (à mão, pelo `ATUALIZAR AGORA.bat` de teste na `LOGISTICA-55`): 5.629 itens, 27.586 chamados, 32.184 itens de chamado, dado até **2026-10-08** (4.492 pedidos). Cargas rodadas à mão em 06/10 (7 s), 07/10 às 14:03 (**4 min**, banco saturado) e 09/10 às 13:33 (**4 min**) e 13:40 (**30 s**). O Postgres reiniciou de novo em 2026-10-09 13:45 (ver [[Supabase]]).
- **Painel:** **publicado** na [[Vercel]] — projeto `reposicoes-web`, endereço `https://reposicoes-web.vercel.app` (Root Directory `web`), deploy automático a cada push na `main`. **Sem o guarda da SENTINELA**: o endereço abre para quem tiver o link.
  Conferido em 2026-10-08: produção no commit `5b6a0bd` (o último da `main`), com todos os ajustes de 07/10; os
  scripts do ETL no `P:` são idênticos aos do repositório ([[2026-10-08 — Conferência do deploy do Reposições]]).
  Conferido de novo em 2026-10-09 (de manhã): nenhum deploy depois de 07/10 14:15; repositório sem nada por commitar;
  os 12 arquivos do `P:` iguais byte a byte aos do repositório. **Depois:** comparação com o período anterior no ar
  (commit `261b9a0`, conferida em produção) e o `P:` atualizado com o ETL novo e o `ATUALIZAR AGORA.bat`.
- **Agendamento: feito em 2026-10-09 (~14:07) pelo Júlio**, com o `INSTALAR TUDO.bat`: tarefas `Reposicoes - Sync` (07:35, 09:35, 11:35, 13:35, 15:35, 17:35, 22:35) e `Reposicoes - Aquecer painel` (a cada 5 min), modo **senha guardada** (roda com o usuário deslogado), conta `LUBE\gti.julio.alves`, pasta `C:\BI\REPOSICOES`. A carga de verdade que o instalador disparou às 14:08 deu `OK` nas três consultas (~9 s), **conferida em `reposicao.controle_carga`** (dado até 08/10, 4.492 pedidos; cache às 14:08:34). **Não foi na `LOGISTICA-55`** (sem tarefa e sem pasta lá); a tela do instalador não mostra o nome da máquina — esperado `SRV-IA`, **a confirmar**. **Ainda não provado:** uma carga disparada pelo relógio (a primeira é a das 15:35) e o `aquecer_painel.log`.
  Em 2026-10-09 `C:\BI\REPOSICOES` não existe na estação `LOGISTICA-55` (a VM `SRV-IA` não foi conferida). As
  estatísticas do banco também não mostram escrita nas tabelas do schema depois do reinício de 07/10 14:14 —
  indício, não prova, de que nenhuma carga rodou desde a manual. Quem responde é `reposicao.controle_carga`.

## Pendências
- [x] **Publicar na Vercel** — Júlio, 2026-10-06: projeto `reposicoes-web`, Root Directory `web`, cinco variáveis `SUPABASE_DB_*` (porta 5432).
- [ ] **Antes de uma demonstração:** abrir o painel uma vez no computador da apresentação (deixa a cópia no navegador).
- [ ] Supabase: olhar *Reports → Database* e decidir sobre o tamanho do compute; conferir a hipótese do `pg_stat_statements` inchado ([[Supabase]]).
- [ ] Levar o desenho do painel rápido aos outros painéis (COMPRAS, COMERCIAL, FINANCEIRO).
- [x] **Agendar** — Júlio, 2026-10-09 ~14:07 (`INSTALAR TUDO.bat`: carga e aquecedor, modo senha guardada, carga de teste `OK` às 14:08).
- [ ] **Provar o agendamento:** conferir em `reposicao.controle_carga` a carga das **15:35** (a primeira disparada pelo relógio) e as de 17:35 e 22:35, e o `aquecer_painel.log` (uma linha nova a cada 5 min); e **confirmar que a máquina é a `SRV-IA`** (a tela do instalador não diz). Se foi em outra, desinstalar de lá — o COMERCIAL ficou uma semana com tarefas em duas máquinas.
  - Sugestão do Claude (mantida): instalar **só na VM `SRV-IA`**, a máquina do ETL. O COMERCIAL ficou uma semana com as mesmas tarefas em duas máquinas, e as cargas se atropelavam ([[BI COMERCIAL]]).
  - ✅ O `bi_comum.py` de 2026-10-08 do COMERCIAL **já foi trazido** (2026-10-09), com a **tranca de carga** e a busca do `ENV` em `1 - CONFIGURACAO`; o `sync_reposicao.py` usa a tranca. Testado com duas cargas ao mesmo tempo.
  - O `instalar_e_agendar.ps1` ainda **não avisa** se a máquina não é a `SRV-IA` (o `ATUALIZAR AGORA.bat` avisa).
- [ ] **Rodar o `ATUALIZAR AGORA.bat` uma vez na `SRV-IA`** e conferir `reposicao.controle_carga`: só foi testado na `LOGISTICA-55`; o Python e as bibliotecas da VM não foram conferidos por ele.
- [ ] **Banco reiniciando:** 2026-10-07 14:14, 2026-10-08 ~17:00 e 2026-10-09 13:45 (este ~5 min depois de duas cargas de teste). Causa não provada — ver [[Supabase]].
- [ ] Conferir **com os olhos** o tooltip dos gráficos de linha no painel publicado: em 07/10 só o conteúdo e o clique foram testados (as capturas de tela estouravam o tempo).
- [x] `/api/dados` conferida no ar — 2026-10-07: 0,5 s na primeira chamada, `X-Painel-Origem: cache`.
- [ ] Conferir na tela publicada que **"Ano 2026" fecha com o banco** — previsto para depois do primeiro deploy (R$ 221.288,79 até 02/10, carga de 06/10), sem registro de que foi feito.
- [ ] **README do repositório desatualizado em dois pontos:** a "Estrutura" diz que `api/dados.js` chama `painel_dados()` (desde 07/10 lê `painel_cache` e só cai para a função se a linha não existir) e que o instalador "cria a tarefa" (são duas). O comentário no topo de `web/api/dados.js` diz que o "Atualizar" fura o cache — só o Shift+clique fura.
  - Também ficou de pé, nos comentários do código, o **diagnóstico antigo** que o commit `5b6a0bd` corrigiu só no README: o topo de `web/api/_db.js` ainda diz que o tempo era "a abertura da conexão com o pooler a frio", e o de `etl/aquecer_painel.py` fala em "quando o painel esfria". A causa foi o **pool do pooler esgotado** ([[Supabase]], incidente de 07/10). Conferido em 2026-10-09 no commit `5b6a0bd`.
- [x] Código no GitHub — 2026-10-06
- [ ] Decidir se o repositório fica público ou vira privado (ver acima).
- [ ] **SENTINELA:** este painel ainda **não tem o guarda** — a regra do Júlio é que todo sistema só abra para quem tem acesso pelo Painel Lube ([[SENTINELA LUBE]]). Cadastrar na central e instalar o guarda antes de divulgar o endereço. O aquecedor hoje só manda o User-Agent `Lube-Aquecedor/1.0 (+reposicoes)`, sem segredo: vai precisar de um, como o `CRON_SECRET` do agendador do [[GESTÃO TI]], senão o guarda o barra e o painel volta a abrir frio.
- [ ] Decidir a proteção do painel: tem nome de cliente e de motorista; o endereço principal da Vercel não é coberto pela proteção Standard ([[Vercel]], [[SENTINELA LUBE]]).
- [ ] **Operação:** 241 pedidos (R$ 45,1 mil, 20% do reposto) saíram **sem chamado** em 2026 — decidir se isso é falha de processo ou reposição legítima sem SAC.
- [ ] Confirmar com quem lança a reposição a mudança de setembro: o **nº do chamado** passou a ir em `OBS` e a NF em `OBS1`.
- [ ] Se o comercial quiser taxa de chamado **por motorista**, falta o total de entregas de cada um — o ranking atual é absoluto.

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-09** — **agendamento feito pelo Júlio** (~14:07): `INSTALAR TUDO.bat` criou as tarefas `Reposicoes - Sync` (07:35 a 22:35) e `Reposicoes - Aquecer painel` (5 em 5 min), modo senha guardada, conta `LUBE\gti.julio.alves`, `C:\BI\REPOSICOES`; carga de verdade às 14:08 `OK` nas três consultas (5.629 / 27.589 / 32.191 linhas, ~9 s), conferida em `controle_carga`; Postgres sem novo reinício desde 13:45. Máquina não identificada pela tela (não é a `LOGISTICA-55`; esperado `SRV-IA`) · [[2026-10-09 — Comparação com o período anterior e o script de atualização da VM]]
- **2026-10-09** — conferido: o Postgres do DATA WAREHOUSE reiniciou às 13:45:27, ~5 min depois das duas cargas de teste (terceiro reinício em três dias; causa não provada, ver [[Supabase]]); o painel publicado seguiu respondendo pelo CDN · [[2026-10-09 — Comparação com o período anterior e o script de atualização da VM]]
- **2026-10-09** — carga testada de ponta a ponta pelo `ATUALIZAR AGORA.bat` numa cópia na `LOGISTICA-55` (Claude): 13:33–13:37, 4 min, 5.629 / 27.586 / 32.184 linhas, dado até 08/10, conferido em `controle_carga`; segunda carga às 13:40 em 30 s. Teste da **tranca** com duas cargas ao mesmo tempo: a segunda foi pulada, só uma entrou. Cópia de teste (com o `ENV`) apagada · [[2026-10-09 — Comparação com o período anterior e o script de atualização da VM]]
- **2026-10-09** — comparação do cartão principal com o **período anterior** e o **ano anterior** (jan/26 contra dez/25 etc.), com tooltip e clique para o Detalhe; campos de data que não trocam mais de lugar; `ATUALIZAR AGORA.bat` (copia o ETL, roda uma carga, aquece o painel); `bi_comum.py` de 2026-10-08 com a tranca de carga; `sync_reposicao.py` pula a rodada se já houver outra carga e registra até que dia o painel foi atualizado; README e `LEIA-ME.txt` (Júlio pediu; Claude fez; commit `261b9a0`, deploy automático da Vercel, varredura de segredos limpa) · [[2026-10-09 — Comparação com o período anterior e o script de atualização da VM]]
- **2026-10-09** — no `P:\INTEGRAÇÃO BI\REPOSICOES`: `ATUALIZAR AGORA.bat` novo, ETL atualizado (`bi_comum.py`, `sync_reposicao.py`, `aquecer_painel.py` etc.) e `LEIA-ME.txt`; o `ENV` não mudou · [[2026-10-09 — Comparação com o período anterior e o script de atualização da VM]]
- **2026-10-08** — conferido a pedido do Júlio ("subir os deploys"): a produção já servia o último commit (`5b6a0bd`) e o `P:` era igual ao repositório; nada a subir · [[2026-10-08 — Conferência do deploy do Reposições]]
- **2026-10-07** — README com o diagnóstico corrigido da lentidão (pool do pooler esgotado, não "conexão fria") e o que olhar quando o painel abre devagar (commits `c5ab85e`, `5b6a0bd`) · [[2026-10-07 — Ajustes do painel de Reposições e a lentidão ao abrir]]
- **2026-10-07** — carga rodada à mão às 14:03, já com o passo novo do cache: **4 min** em vez de 7 s, com o banco saturado; o banco reiniciou sozinho às 14:14 (incidente em [[Supabase]]) · [[2026-10-07 — Ajustes do painel de Reposições e a lentidão ao abrir]]
- **2026-10-07** — no `P:`: `aquecer_painel.py`, instalador que cria também a tarefa do aquecedor, e `PAINEL_URL` no `ENV` (fora do Git) · [[2026-10-07 — Ajustes do painel de Reposições e a lentidão ao abrir]]
- **2026-10-07** — o painel deixou de ler o banco ao abrir: tabela `painel_cache` + `atualizar_painel_cache()` (migração `reposicao_05_painel_cache`), a carga monta o JSON, CDN com `stale-while-revalidate`, aquecedor de 5 em 5 min, cópia no IndexedDB, tela de espera com relógio, conexão escalonada, simulador de banco lento no servidor local (commit `e3cce06`) · [[2026-10-07 — Ajustes do painel de Reposições e a lentidão ao abrir]]
- **2026-10-07** — pedidos do Júlio: coluna "Itens" de Motivos virou "SKU" (produtos distintos), filtro de Cliente, card "Cliente que mais fez reposições", clique que abre o Detalhe filtrado com "← Voltar", faixa de item e fornecedor, tooltip novo nos gráficos (commit `fee976d`) · [[2026-10-07 — Ajustes do painel de Reposições e a lentidão ao abrir]]
- **2026-10-06** — o Júlio publicou o painel na [[Vercel]]: projeto `reposicoes-web`, Root Directory `web`, cinco variáveis `SUPABASE_DB_*`, primeiro deploy às 17:17 · [[2026-10-06 — Dashboard de Reposições e Chamados]]
- **2026-10-06** — o Júlio criou o repositório `Lube-Distribuidora-LTDA/REPOSICOES` (público); primeiro commit e push depois de uma varredura por segredos nos 27 arquivos (commit `cc6d78e`) · [[2026-10-06 — Dashboard de Reposições e Chamados]]
- **2026-10-06** — pasta de rede `P:\INTEGRAÇÃO BI\REPOSICOES` montada (configuração, sistema, instalação, `INSTALAR TUDO.bat`) com o `ENV` de leitura do BI Comercial; tarefas preparadas, não criadas · [[2026-10-06 — Dashboard de Reposições e Chamados]]
- **2026-10-06** — primeira carga, com histórico desde 2025-01-01 (~8 s), e outra pelo mesmo caminho do Agendador (`executar.py`) · [[2026-10-06 — Dashboard de Reposições e Chamados]]
- **2026-10-06** — banco: schema `reposicao` com as 3 fatos e `controle_carga`, views da regra de ligação, `painel_dados()`, valor em centavos exatos e JSON enxuto (migrações `reposicao_01_schema` a `reposicao_04_painel_dados_compacto`) · [[2026-10-06 — Dashboard de Reposições e Chamados]]
- **2026-10-06** — sistema criado a partir das rotinas 8352 e 8353 (não da planilha): ETL com 3 consultas e leitor de NF nas observações, diagnóstico contra a planilha, painel de 5 páginas com filtros e Excel sem biblioteca, servidor local de teste. Ajustes do teste visual: filtro fixo no topo, formato das unidades, período "Tudo" (dois anos) e filtros que recolhem no celular (commit `cc6d78e`) · [[2026-10-06 — Dashboard de Reposições e Chamados]]
