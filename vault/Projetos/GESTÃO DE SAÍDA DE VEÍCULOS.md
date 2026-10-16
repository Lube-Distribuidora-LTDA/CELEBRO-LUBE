---
tipo: projeto
departamento: Operacional
status: ativo
inicio: 2026-09-09
tags: [projeto, frota, getrak, supabase, vercel, sentinela]
---
# GESTÃO DE SAÍDA DE VEÍCULOS

BI pedido para o **Araujo** (pasta `3. ARAUJO`): mede as **horas de atraso na saída dos veículos**. Compara o
**1º horário de saída de cada dia** de cada placa com a **entrada do motorista, 06:30**, ao segundo e **sem
tolerância**. O dado vem do rastreador **Getrak** (relatório "Deslocamentos e Paradas", uma planilha por placa),
não do [[WinThor]]: é um dos sistemas fora do fluxo do ETL ([[Mapa de sistemas]]).
Origem: [[2026-09-09 — Criação do sistema de Saída de Veículos]].

## Onde mora
- **Pasta local:** `Desktop\BI\3. ARAUJO\GESTAO SAIDA VEICULOS` (repositório git; planilhas de entrada em
  `PLANILHAS REFERENCIAS\`, logo em `IMAGENS\`).
- **GitHub:** `Lube-Distribuidora-LTDA/GESTAO-DE-SAIDAS-DE-VEICULOS`, branch `main` (sobrou a branch `sentinela`
  da instalação do guarda). **Privado** — em 2026-10-09 o GitHub responde 404 sem login. Em 2026-10-09 **não há
  nada sem commit** (`main` = `origin/main`). A config local do git usa o nome "Lube Distribuidora" e o e-mail do
  CPD; a máquina não tem `gh` nem `~/.gitconfig`, e o push sai pelo Git Credential Manager do Windows.
- **[[Vercel]]:** projeto `gestao-de-saidas-de-veiculos` (`prj_ObANJiC1HKBSzrUPQdU79V4VEnLR`), time
  lube-distribuidora-ltda, endereço **https://gestao-de-saidas-de-veiculos.vercel.app**. Site estático, sem build
  e sem framework. O `vercel.json` só manda `/` para `Gestao de Saida de Veiculos.html` (o nome ficou para o
  arquivo continuar abrindo com duplo clique). O middleware roda em `iad1` (padrão; não foi posto em `gru1`).
  Produção em 2026-10-09: `dpl_9XGTGuv73ujWdu7c9pNa72HPRKU7` = commit `b9ac2a0` = `HEAD` da `main`.
- **[[Supabase]]:** projeto **GESTÃO DE SAIDA DE VEICULO** (`ubfxhnricinclxkbvkzw`, us-west-2), schema `public`,
  tabelas `veiculos` e `deslocamentos`. Sem Edge Functions. Em 2026-10-09: **~75 veículos e ~18.856
  deslocamentos** (contagem do Supabase).
- **Portal:** cadastrado no [[PAINEL LUBE DISTRIBUIDORA]] com o slug **`saida-veiculos`**.

## Para quem e como se entra
Para o Araujo e quem acompanha a frota. Desde 2026-10-06 **só abre com login do Painel Lube e permissão
`saida-veiculos`** (decisão do Júlio, vale para todos os sistemas — ver [[SENTINELA LUBE]]). Abrir o HTML com
duplo clique no computador continua funcionando e não passa pelo guarda.

## Como funciona
- **Regra do indicador:** 1º horário do dia = menor início de **deslocamento** (evento `D`; paradas `P` não
  contam) da placa na data. **Atraso = 1º horário − entrada**, quando sai depois. Saiu antes ou na hora = atraso
  zero; **não existe "hora excedente"** (Júlio, 2026-09-09). Saída às 06:30:20 = 20 s de atraso.
- **Indicadores:** horas de atraso, atraso médio, maior atraso, 1º horário médio, aderência (% de dias sem
  atraso), dias com saída e, por veículo, **% de saídas atrasadas** (card "Saídas atrasadas por veículo", do pior
  para o melhor: até 20% verde, até 45% azul, acima disso vermelho).
- **Corte da noite:** dia cuja 1ª saída foi **às 18:00 ou depois** sai da conta inteira (Júlio pediu, Claude
  escolheu 18:00). Editável e desligável na tela; o mesmo valor está no `processar.py` (`CORTE_NOITE`). A tela
  diz quantos dias saíram. Exemplo: na base da TOH8G66, o dia 13/08 saiu da conta (1ª saída às 18:23:27).
- **Filtros (uma linha só):** período, entrada do motorista (**um horário para a frota toda**, padrão 06:30),
  "Ignorar saída após", dias (todos, úteis, fim de semana), situação (com/sem atraso), faixa de horário da 1ª
  saída (mín./máx.), veículo; botão "Restaurar padrão".
- **Telas:** Frota, Veículo e Importar. Clicar na placa abre o veículo; clicar na data abre as viagens do dia
  (início, fim, duração, movimento, ocioso, KM, origem → destino, 1ª saída marcada). Clicar numa barra do
  gráfico "Atraso da frota dia a dia" recorta o painel para aquele dia. `Esc` volta.
- **Importação (tela Importar):** vários `.xlsx` de uma vez, ou arrastar e soltar. Lidos no navegador pelo
  `leitor-xlsx.js`, sem biblioteca e sem internet. **Só aceita `.xlsx`/`.xlsm`**: `.xls` antigo precisa ser
  salvo como `.xlsx` antes. Colunas achadas pelo nome do cabeçalho; a placa vem da coluna
  `Placa` ou do cabeçalho "Placa / Apelido". **A placa é normalizada** (maiúsculas, só letras e números:
  `TOF-8J77` = `TOF8J77`). **Reimportar não duplica:** chave placa + evento + início + fim, no navegador e no
  banco (chave única). O que é novo vai para o Supabase (`POST` com `on_conflict`, ignorando repetidos).
- **Leitura:** ao abrir, mostra na hora a base local (`dados.js` + o que está salvo no navegador) e, em paralelo,
  busca `deslocamentos` no Supabase e junta sem duplicar. Horários lidos no fuso America/Sao_Paulo. A tela
  Importar mostra se está conectado e quantos deslocamentos vieram do banco.
- **Exportar planilha:** o `escritor-planilha.js` monta no navegador um **`.xlsx` de verdade, de 5 abas** (Resumo
  Executivo, Saída de Veículos, Consolidado por placa, Por dia da semana, Indicadores), com as cores da Lube,
  autofiltro e cabeçalho congelado, no recorte da tela. Só a logo fica de fora.
- **`processar.py` (lote, à mão):** lê `PLANILHAS REFERENCIAS\` e regera `dados.js`, `dados.json` e
  `Gestao_Saida_Veiculos.xlsx` (o mesmo relatório de 5 abas, com a logo via Pillow; sem Pillow sai sem a logo).
- **Visual:** azul `#0E176C` e vermelho `#F90A19` da logo (nos gráficos, os tons derivados `#3c56ae` e
  `#c52c27`, este o do atraso); fontes Barlow e Source Sans 3 guardadas em `FONTES\`
  (funciona offline); tema claro e escuro com botão; números que contam ao filtrar; toast que some sozinho.
  É anterior ao padrão de 2026-09-24 ([[Como eu gosto dos BIs]]: "cara do Gestão TI").
- **Guardado no navegador** (`localStorage`): `lube.saidaveiculos.base`, `lube.saidaveiculos.importacoes`,
  `lube.saidaveiculos.tema`. A chave antiga `lube.saidaveiculos.entradas` é apagada ao abrir.

## Banco (Supabase)
| Migração (2026-09-10, horário de Brasília) | O que faz |
|---|---|
| `criar_schema_gestao_saida_veiculos` (09:35) | Tabelas `veiculos` (placa como chave, motorista) e `deslocamentos` (arquivo, evento, placa, motorista, início, fim, segundos de movimento/ocioso/duração, KM, hodômetro, locais, data), chave única placa + evento + início + fim, RLS com **leitura pública** e o gatilho `upsert_veiculo_do_deslocamento`, que preenche `veiculos` |
| `fix_search_path_upsert_veiculo` (09:42) | `search_path` fixo na função do gatilho (aviso do advisor de segurança) |
| `permitir_insercao_publica_deslocamentos` (10:03) | Política "insercao publica de deslocamentos": **só INSERT** para anon e authenticated; UPDATE e DELETE seguem bloqueados. Aplicada depois da confirmação do Júlio |
| `revogar_execute_publico_trigger_veiculos` (10:04) | Tira o `execute` da função do gatilho de public, anon e authenticated |

- Fora das migrações: os **76 deslocamentos da TOH8G66** (13/08 a 09/09/2026) foram inseridos e conferidos em
  2026-09-10; o resto entrou pelas importações na tela.
- A função `rls_auto_enable` já existia no projeto e não foi mexida.
- O navegador fala direto com o banco usando a **chave pública** (`anon`), que fica em `supabase-config.js`
  (variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`; nada a cadastrar na Vercel). Não há login no banco.

## Segurança
- **Porta:** guarda da [[SENTINELA LUBE]] na raiz (`middleware.ts` + `sentinela-guarda.ts`), em **modo fechado**
  (`FECHADO = gestao-de-saidas-de-veiculos / saida-veiculos`): sem a lista da central, só passa quem tem sessão.
  **"Exige login" ligado** desde 2026-10-06, sem rotas públicas: sem sessão a página vai para o portal
  (`/?abrir=saida-veiculos`) e `dados.js`, `dados.json` e o `.xlsx` respondem 401. CSS, imagens e fontes ficam
  fora do guarda. Guarda 1.1.0 desde 2026-10-07. Saúde: `/.sentinela/saude`.
- **Arquivos proibidos** na central: `processar.py`, `PLANILHAS REFERENCIAS/`, `design do sistema…`, `README.md`.
- **Buraco que continua aberto:** o banco aceita **SELECT e INSERT com a chave pública**, direto na API do
  Supabase, sem passar pelo guarda. Quem tiver a chave lê motoristas, trajetos e KM e pode gravar deslocamento
  falso (não consegue alterar nem apagar). Na lista da Sentinela é exposição "alta", aberta. Conserto: login no
  app + RLS por usuário, e depois trocar a chave.
- **Antes de 2026-10-06:** o site abria para qualquer um e publicava o repositório inteiro (`dados.json`,
  planilhas, `.xlsx`, `processar.py`).
- **Repositório:** era **público com dado real** (motoristas, rotas, planilha) em 2026-09-10, e o Claude avisou.
  Em 2026-10-06 o deploy pelo Git já deu `BLOCKED` (repositório privado no Hobby). O dado real **continua
  versionado na `main`** em 2026-10-09: `dados.js`, `dados.json`, `Gestao_Saida_Veiculos.xlsx` e a planilha da
  TOH8G66 em `PLANILHAS REFERENCIAS\`, além da chave pública. Voltar o repositório a público expõe tudo isso de
  novo, e o histórico do Git guarda as versões antigas.
- **Deploys antigos** (anteriores ao guarda) pedem login da Vercel — ver [[Vercel]].
- **Deploy:** enquanto o repositório for privado, o push não publica sozinho (`BLOCKED`). Publicar pela API da
  Vercel (`create_deployment` com o mesmo commit) e conferir com `get_deployment` no endereço de produção — ver
  [[Vercel]].

## Rotinas
**Nenhuma rotina agendada.** O dado entra quando alguém importa as planilhas do Getrak na tela Importar. O
`processar.py` roda à mão.

## Regras de trabalho neste projeto
- **Toda alteração vai direto para o GitHub:** commit e push a cada mudança, sem esperar pedido (Júlio,
  2026-09-10: "tudo o que fomos fazer aqui precisa ir direto pro GitHub"). Está na memória do Claude Code da pasta
  `3. ARAUJO` (`C:\Users\gti.julio.alves\.claude\projects\c--Users-gti-julio-alves-Desktop-BI-3--ARAUJO\memory\`:
  `feedback_push_github_sempre.md`, `projeto_gestao_saida_veiculos.md` e o índice `MEMORY.md`).
- **Regra de segurança do banco (RLS, grants, funções) só com confirmação explícita do Júlio.**
- Nunca testar caminho de ataque a partir do escritório (bloqueia o IP de todos) — ver [[SENTINELA LUBE]].

## Pendências
- [ ] **Banco aberto para a chave pública** (leitura e inserção): consertar à parte — Júlio decide.
- [ ] Júlio: revogar o token pessoal do Supabase colado no chat em 2026-09-10 (Account › Access Tokens). O Claude
  não usou o token.
- [ ] **Suspeita do Claude (2026-10-09, lendo o código; não testada):** a busca do painel no Supabase
  (`deslocamentos?select=*&order=inicio.asc`) **não pagina**. O Supabase devolve no máximo 1.000 linhas por
  pedido (padrão de "Max rows" da API) e o banco tem ~18.856. Num navegador sem importação salva, o painel
  mostraria só os **1.000 deslocamentos mais antigos**. E a base inteira pode não caber no `localStorage`
  (~5 MB), aí ela nem fica salva. Conferir em Supabase › Settings › API › Max rows e no número que a tela
  Importar mostra ("N deslocamento(s) no Supabase"). Se for isso, paginar a busca ou ler por período.
- [ ] Ver no Supabase se há placa gravada **fora do padrão** (com hífen ou espaço). A normalização vale na leitura
  e nas importações novas, mas não foi aplicada às linhas já gravadas, e a chave única do banco compara o texto.
- [ ] Júlio: conferir quais placas foram unificadas e se a contagem menor de veículos de 2026-09-11 está certa
  ([[2026-09-11 — Título e filtro de placa no Saída de Veículos]]).
- [ ] Júlio: confirmar se o brilho (glow) dos números atende o pedido de "números piscando" (o piscar de verdade
  não foi feito, para não atrapalhar a leitura).
- [ ] README do repositório: diz que na importação "nada é enviado para fora" e que a base só fica salva no
  navegador. Desde 2026-09-10 tudo vai para o Supabase. Corrigir junto com a próxima mudança.
- [ ] Júlio: decidir sobre o **repositório privado que trava o deploy pelo Git** (pendência comum a cinco
  sistemas, em [[2026-10-05 — Sentinela Lube, sistema de segurança]]). Aqui, voltar a público expõe o dado real
  que continua versionado (ver Segurança); o caminho de hoje é publicar pela API. Esse dado no repositório (nome de
  motorista, trajetos) também contraria a regra "dado de pessoa não vai para o repositório" de
  [[Como trabalhar comigo]] — tirar do Git é decisão do Júlio.
- [x] Guarda da Sentinela e login obrigatório (2026-10-06).
- [x] Repositório privado (já estava em 2026-10-06; conferido em 2026-10-09).
- [x] Visual trocado pelo design de referência "design do sistema - gestão de saida de veiculo" (2026-09-09/10).
- [x] Nota de projeto no cérebro (2026-10-09).

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-07** — Guarda da Sentinela 1.1.0 (reconhece robôs de nome genérico e "não-navegadores"); deploy pela
  API `dpl_9XGTGuv73ujWdu7c9pNa72HPRKU7`, o de produção hoje (commit `b9ac2a0`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-07** — Sentinela em **modo proteger** nos 8 sistemas, inclusive este: robôs, rajada, Tor e arquivos
  proibidos passam a levar 403 (mudança na central, sem commit aqui) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — **Só abre com login do Painel Lube** e permissão `saida-veiculos` (Júlio): guarda da Sentinela em
  modo fechado, "exige login" ligado na central, arquivos de dados com 401 sem login, seção "Acesso" no README
  (commits `b560968`, `7811755`). O deploy pelo Git deu `BLOCKED`; publicado pela API
  (`dpl_5uYUgfkLQ8Xm2PBtmDUE1dDRkY9E`, do `b560968`; prévia `dpl_6PYJ7kqaF2kzTdTiakgaxY4Rbkg3`). O `7811755`
  (só README) não ganhou deploy próprio e entrou no de 2026-10-07. Na instalação, testes de `/.env` feitos do
  escritório ajudaram a bloquear o IP do escritório (bloqueios revogados) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-09-11** — Subtítulo do cabeçalho tirado e título "Gestão de Saída de Veículos" maior (Barlow 29px, peso
  800); opções do filtro de placa legíveis no tema escuro (commits `530522e`, `fa2814f`) · [[2026-09-11 — Título e filtro de placa no Saída de Veículos]]
- **2026-09-10** — Placa normalizada na entrada: reimportar nunca cria veículo duplicado (Júlio pediu; commit
  `ea43f2d`) · [[2026-09-09 — Criação do sistema de Saída de Veículos]]
- **2026-09-10** — Redesenho na linha dos BIs de RH e ICMS (Júlio): números peso 800, ícones nos KPIs, tema claro e
  escuro, toast que some sozinho, filtros com ícones; números ilegíveis no tema escuro corrigidos na raiz
  (commits `945301a`, `0d14a3e`, `a695a15`) · [[2026-09-09 — Criação do sistema de Saída de Veículos]]
- **2026-09-10** — "Exportar planilha" passa de `.csv` para `.xls` XML, depois `.xlsx` real e por fim o relatório de
  5 abas com os filtros da tela; tela Importar mostra a conexão com o Supabase (commits `e703d18`, `c3a5f22`,
  `46f4df5`, `8c0cbd6`) · [[2026-09-09 — Criação do sistema de Saída de Veículos]]
- **2026-09-10** — No ar na Vercel (projeto importado do GitHub pelo Júlio); 404 da raiz corrigido com `vercel.json`
  (commit `b73d429`) · [[2026-09-09 — Criação do sistema de Saída de Veículos]]
- **2026-09-10** — Painel lê o Supabase ao abrir e grava cada importação no banco (Júlio; commit `5505ade`); RLS
  libera só INSERT público e o gatilho perde o `execute` público (migrações `permitir_insercao_publica_deslocamentos`,
  `revogar_execute_publico_trigger_veiculos`) · [[2026-09-09 — Criação do sistema de Saída de Veículos]]
- **2026-09-10** — Banco criado no Supabase (migrações `criar_schema_gestao_saida_veiculos`,
  `fix_search_path_upsert_veiculo`) com os 76 deslocamentos da TOH8G66; repositório no GitHub e primeiro commit
  (`f4c88a3`) · [[2026-09-09 — Criação do sistema de Saída de Veículos]]
- **2026-09-10** — Card "Saídas atrasadas por veículo" (% de dias com atraso) e relatório Excel de 5 abas, com as
  cores da Lube, no `processar.py` (Júlio; entrou em `f4c88a3`) · [[2026-09-09 — Criação do sistema de Saída de Veículos]]
- **2026-09-10** — Números animados ao filtrar, gráfico "Atraso da frota dia a dia" sem degradê e clicável, saídas
  a partir das 18:00 fora da conta (Júlio; entrou em `f4c88a3`) · [[2026-09-09 — Criação do sistema de Saída de Veículos]]
- **2026-09-09** — Visual trocado pelo design de referência (Júlio): `estilo.css`, `painel.js`, fontes offline, três
  abas; em 2026-09-10 corrigidos "Sem motorista" como nome e o plural "1 veículos" (antes do Git; entrou em
  `f4c88a3`) · [[2026-09-09 — Criação do sistema de Saída de Veículos]]
- **2026-09-09** — Sistema criado (antes do Git): `processar.py`, dashboard HTML que abre com duplo clique, leitor de
  `.xlsx` próprio, importação no navegador, drill-down placa → data, cores e logo da Lube; regra 06:30 **sem
  tolerância**, só horas de atraso, filtro de faixa da 1ª saída, um horário de entrada para a frota (Júlio) · [[2026-09-09 — Criação do sistema de Saída de Veículos]]

Veja também [[Supabase]], [[Vercel]], [[SENTINELA LUBE]], [[PAINEL LUBE DISTRIBUIDORA]] e [[Mapa de sistemas]].
