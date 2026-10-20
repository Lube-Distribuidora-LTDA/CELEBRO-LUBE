---
tipo: mapa
status: ativo
tags: [cerebro, mapa]
---
# CLAUDE.md — Cérebro da Lube

Esta pasta (OneDrive › CEREBRO DA LUBE) é o **segundo cérebro da Lube Distribuidora**: um vault do Obsidian com tudo o que sabemos e fazemos com o Claude. O objetivo é que ninguém precise explicar o mesmo contexto duas vezes.

## Antes de responder qualquer pedido
1. Leia este arquivo.
2. Procure as notas do assunto (cliente, sistema, BI, processo) e leia antes de fazer perguntas.
3. Leia [[Como trabalhar comigo]] e, se o assunto for BI, [[Como eu gosto dos BIs]].
4. Só pergunte o que não estiver aqui. Depois, registre a resposta na nota certa.

## Ao final de toda conversa relevante
Use a skill [[registrar-conversa]]: salve uma nota em `Conversas/` e atualize as notas afetadas. Não espere pedirem.
No Claude Code a skill não está instalada (chamar pelo nome dá "Unknown skill"): leia
`Skills/registrar-conversa/registrar-conversa.md` e siga à mão. Cada mudança entra também no `## Histórico de
mudanças` da nota do sistema e no [[Registro de mudanças]] (ver Regras).
Depois de gravar, **rode o backup do cérebro**: `python -I -X utf8 "C:\Users\gti.julio.alves\Desktop\BI\13. CEREBRO\ferramentas\atualizar_repositorio.py" --autor claude`
(o Júlio usa o `ATUALIZAR REPOSITORIO.bat` da mesma pasta). Ele copia o vault para o repositório `CELEBRO-LUBE`,
confere segredos e só sobe se o repositório for privado (desde 2026-10-16, pedido do Júlio: "atualize toda vez que for
guardar alguma coisa"). Nota com dado de pessoa leva `repositorio: nao` no frontmatter e fica fora do GitHub.

## Pastas
| Pasta | O que vai lá |
|---|---|
| `Conversas/` | Uma nota por conversa relevante: resumo, decisões, pendências |
| `Projetos/` | Uma nota por projeto (BIs, sistemas, o próprio cérebro) |
| `Skills/` | Uma pasta por skill, com a nota da skill (`Skills/<nome>/<nome>.md`; não existe `SKILL.md`) |
| `Preferências/` | Como eu gosto das coisas: BIs, jeito de conversar, conceitos |
| `Memória & Infra/` | Sistemas, bancos, decisões técnicas |
| `Rotinas/` | Tarefas recorrentes: o que roda, quando, onde. Toda rotina tem a seção `## Fluxo` (`N. **Tipo** · texto`; tipos Gatilho, Pessoa, Lê, Processa, Confere, Grava, Avisa, Entrega), que o painel do cérebro mostra como funil |
| `Aplicações/` | Uma nota por sistema ou ferramenta |

Novas pastas de departamento (Comercial, Financeiro, Logística, Compras…) são criadas quando surgir a primeira nota delas.

## Frontmatter padrão
```
tipo: nota | conversa | projeto | skill | rotina | app | preferencia | conceito
departamento: Comercial
status: ativo | arquivado
tags: [tag1, tag2]
```

## Regras
- Toda nota nova liga pelo menos uma nota existente com [[wikilinks]].
- Datas no formato AAAA-MM-DD.
- Nada se apaga: marque `status: arquivado`.
- **Nunca grave senhas, tokens ou chaves aqui.**
- **Toda mudança (código, banco, Vercel, agendamento, decisão) entra no `## Histórico de mudanças` da nota do
  sistema e no [[Registro de mudanças]]**, sem esperar pedido: no topo, do mais novo para o mais antigo, com a data,
  o quê, quem (Júlio ou Claude), commit/deploy e o link da conversa. Pedido do Júlio em 2026-10-09: "preciso que
  tudo que eu fiz de mudança seja anotado dentro do cérebro".
- Nome de nota sem `:` (o Windows recusa e pode deixar um arquivo vazio com o nome cortado; use `—` ou `,`).

## O que já sabemos
- **A Lube:** Lube Distribuidora, em Cariacica-ES. _A completar: o que vende, equipe e responsáveis._
- **Sistemas:** WinThor (Oracle) → ETL em Python (VM `SRV-IA`) → Supabase, projeto DATA WAREHOUSE → painéis na Vercel. Ver [[Mapa de sistemas]] e [[data-warehouse]].
- **O que mudou:** [[Registro de mudanças]], o histórico de tudo o que mudou, por data e por sistema (desde
  2026-10-09). Cada nota de sistema tem o seu `## Histórico de mudanças`.
- **Portal de acesso:** [[PAINEL LUBE DISTRIBUIDORA]] (`painel-lube-distribuidora.vercel.app`, no ar desde 2026-09-14), a
  porta de todos os sistemas: login `@lube.com.br` com Primeiro acesso aprovado pelo TI, permissão por sistema
  ("Todos os sistemas" e "Liberar tudo, exceto:") e painel admin. E-mail de fora só por lista no banco (hoje uma
  consultora). **O repositório tem que ficar público** (no Hobby, privado deixa o deploy `BLOCKED`).
- **BI de referência:** [[BI COMPRAS]] ("Central Compras", `painel-compras-rosy.vercel.app`): cargas na VM `SRV-IA`
  (rápidas 07:50/11:50/17:50/23:50, faturamento 02:50; tarefas recriadas em 2026-10-09, antes rodavam 4 h atrasadas),
  faturamento só do ano corrente, todo número abre a planilha filtrada. O assistente (Claude) só responde com a
  `ANTHROPIC_API_KEY` na Vercel, **ainda não confirmada**.
- **Comercial:** [[BI COMERCIAL]] (comissão de RCA, margem, devoluções), no ar desde 2026-09-28; cargas na VM `SRV-IA`,
  **só lá** desde 2026-10-09. Junto vem a [[Abertura de margem]] (`http://SRV-IA:8080`), que escreve
  `PCPRODFILIAL.PERCMARGEMMIN` no WinThor: no ar, mas **sem a credencial de escrita no ENV** (2026-10-09), então ainda
  não abre nem fecha nada.
- **Gestão Comercial (Trade):** [[GESTÃO COMERCIAL TRADE]] (2026-10-14): o Power BI "final" (venda, ruptura, cobertura, ABC,
  carteira, conta corrente de fornecedor, custo de compra) recriado em 14 telas, com **relatório personalizado a cada clique**,
  para o Júlio apresentar ao gestor comercial. O painel roda **na máquina** (`Desktop\BI\11. TRADE`, `INICIAR.bat`), com um ETL
  próprio e um motor em memória: **ainda não está na Vercel nem no GitHub** (decisão do Júlio). Conferido
  contra as planilhas do Power BI: venda de fev/2026 bate em +0,005%. Venda = `QT × (PUNIT + VLOUTROS)`, S − ED, filiais
  1, 7, 10, 11 e 12; comparações com o mesmo número de dias; 11% da venda de 2026 está fora da classificação do Trade.
  **Banco e fotos (2026-10-14, mesma conversa):** dados no schema `trade` do DATA WAREHOUSE (pacote da venda em arquivo colunar +
  bases pequenas; ~37 MB), carga [[Trade - Sync]] com pasta própria em `P:\INTEGRAÇÃO BI\TRADE` (**agendada pelo Júlio em
  2026-10-14**, 5 cargas ao dia; na `SRV-IA`; a tarefa **lê `P:\FOTOS_ION` sozinha desde 2026-10-15 09:14**, pelo `etl/rede.py` com o `fotos.cred` (sem credencial explícita a tarefa dava o erro 1272; o `cmdkey` falhava porque a senha guardada estava errada).
  **Falta:** trocar a senha do usuário do compartilhamento e refazer o `fotos.cred`, e pedir ao TI uma conta só de leitura; se a pasta sair do ar a carga segue com o mapa de fotos
  do banco, em AVISO) e fotos direto de `P:\FOTOS_ION` ([[Pasta de fotos FOTOS_ION]]). **No GitHub e na Vercel
  desde 2026-10-14:** repositório público `Lube-Distribuidora-LTDA/GEST-O-COMERCIAL`, projeto `gestao-comercial-trade` (https://gestao-comercial-trade.vercel.app),
  fechado pela Sentinela (provado de fora), **em uso** (variáveis `SUPABASE_DB_*` cadastradas pelo Júlio, cartão ativo, 7 contas abrem; o projeto duplicado
  `gestao-comercial` ainda precisa ser apagado). **Fotos na Vercel (2026-10-14):** o ETL guarda miniaturas WebP no banco (`trade.produto_miniatura`, 8.515, ~97 MB) e a
  função `api/img` serve de lá; **na carga agendada o passo já funciona** (Pillow e `fotos.cred` na `SRV-IA`, conferido em 2026-10-15 09:14: 9 passos `OK`).
- **Movimentação de Inventário:** [[MOVIMENTAÇÃO DE INVENTÁRIO]] (2026-10-19): tudo o que mexe no estoque do galpão, das rotinas
  **266** (livro `PCLOGDESBLOQUEIO`: bloqueio, desbloqueio, avaria, devolução que entra bloqueada, liberação do WMS — **cada
  programa grava os campos de um jeito**) e **1147** (inventário rotativo, conferido ao centavo contra o PCMOV). Schema `inventario`
  no DATA WAREHOUSE, carga [[Inventário - Sync]] **agendada na `SRV-IA` em 2026-10-20** (8 horários, aos :05) e **vigiada pelo
  Guardião** (rotina, tarefa e site, migração `saude_v1_inventario`), painel de
  7 telas com análise livre, **publicado em 2026-10-20** em `movimentacao-inventario.vercel.app` (repositório público
  `Lube-Distribuidora-LTDA/MOVIMENTACAO-INVENTARIO`, fechado pela Sentinela), **em uso**: variáveis `SUPABASE_DB_*` cadastradas pelo
  Júlio, cartão ativo no portal (GESTÃO OPERACIONAL) e entrada do Júlio conferida em 2026-10-20 09:23; local pelo
  `Desktop\BI\16. INVENTARIO\INICIAR.bat` (porta 3102). Achados: acurácia do inventário rotativo 6,6% em 2026; 17 milhões de paletes
  desbloqueados por erro em 04/07/2025 (fora das somas, com aviso; a origem é um recebimento de 17 paletes lançado com 17 milhões
  bloqueados); R$ 3,01 mi bloqueados hoje. **Recebimento de compra (1301) no painel desde 2026-10-20**: o livro não registra o bloqueio
  do recebimento, a linha da nota no PCMOV registra (`QTBLOQUEADA`), provado contra a foto diária do estoque (`PCHISTEST`); tela
  "Recebimento e devoluções" com o tempo de armazenagem; commit `cf65b78` no ar. **Pacote com formato novo só junto com a tela
  publicada** (o painel está na Vercel, deploy a cada push).
- **Fiscal (tributação e preço por região):** [[GESTÃO FISCAL]] (2026-10-20): "Código | Descrição | Região sem tributação |
  Região sem preço de venda" da rotina **201** (`PCTABPR`: preço de venda e `CODST` por região; a `PCTABTRIB` é a tributação por UF,
  **desligada** no WinThor). Só as **16 regiões** que o Júlio pediu (18, 19, 23, 27, 31, 33, 35, 37, 38, 39, 40, 41, 42, 43, 45, 46;
  `ENV` `FISCAL_REGIOES`; a região 1 ficou fora — perguntado) × **só produtos ativos** (5.318: em linha, fora do fornecedor INATIVOS
  658801, sem item de consumo; pedido do Júlio). Schema `fiscal`, carga
  [[Fiscal - Sync]] com instalador em `P:\INTEGRAÇÃO BI\FISCAL` (**de 30 em 30 min, 07:10 a 19:40**, depois de o Júlio rodar o
  `INSTALAR TUDO.bat` de novo), conferida contra a PCTABPR em
  toda carga; painel de 4 telas em **`gestao-fiscal-olive.vercel.app`** (repositório público `Lube-Distribuidora-LTDA/GESTAO-FISCAL`,
  projeto `gestao-fiscal`, fechado pela Sentinela; o `gestao-fiscal.vercel.app` é de outra conta). Em uso desde 2026-10-20 (cartão
  ativo em CONTABILIDADE). **Falta o Júlio:** `INSTALAR TUDO.bat` de novo na `SRV-IA` (30 em 30 min e a regra dos ativos). Local: `Desktop\BI\17. FISCAL\INICIAR.bat` (porta 3103).
- **Folha de pagamento:** [[SISTEMA FINANCEIRO]] (no ar desde 2026-09-25, `gestao-finaceiro.vercel.app`): Validação de
  Folha das cinco empresas (LUBE, LUBE RJ, L LOG, IMPÉRIO LOG, SERMAR) no schema `financeiro` do DATA WAREHOUSE. A
  folha entra em PDF do DP e só grava se bater com o resumo impresso. Rotina: [[Validação mensal da folha]].
- **Reposições e chamados:** [[REPOSIÇÕES E CHAMADOS]] (2026-10-06): rotinas 8352 e 8353 do WinThor no schema
  `reposicao` do DATA WAREHOUSE, painel de 5 páginas **publicado** (`reposicoes-web.vercel.app`, sem guarda da
  SENTINELA), onde todo número clicável abre o Detalhe já filtrado e o cartão principal compara o período com o
  **anterior** (jan/26 contra dez/25) e com o ano anterior (2026-10-09). **Carga e aquecedor agendados em 2026-10-09**
  (Júlio rodou o `INSTALAR TUDO.bat`; cargas 07:35 a 22:35, aquecedor de 5 em 5 min; **na `SRV-IA`**, confirmado em
  2026-10-19: a carga cumpriu 66 de 66 horários de 09/10 a 18/10, todas `OK`; **o aquecedor falha em toda chamada**
  com `CERTIFICATE_VERIFY_FAILED`, conserto pendente na VM). O `bi_comum.py` tem a tranca de carga. Para atualizar o dado na hora: **`ATUALIZAR AGORA.bat`** — ver [[Reposições - Sync]]. Abre
  na hora porque **não lê o banco ao abrir** (cache no banco + CDN + cópia no navegador): em 07/10 o banco do
  Supabase saturou e o painel respondeu em 0,18 s mesmo assim — ver [[Supabase]] e [[data-warehouse]] (seção 8b).
  Atenção: somar a coluna de valor da planilha consolidada dá 44% a mais — é o total do pedido repetido em cada item.
- **RH:** [[BI ABSENTEÍSMO RH]] (no menu, **GESTÃO RH**; `rh-absentismo.vercel.app`, Supabase próprio): absenteísmo,
  turnover, empregados, HEAD, hora extra, interjornadas e exames (ASO), por planilha do PontoMais e da folha. Competência
  do ponto de 21 a 20, com o nome do mês em que fecha ([[Corte do ponto]]). **O banco aceita acesso anônimo com a
  chave pública, e o repositório guarda planilhas com dados pessoais.**
- **Painel ICMS (fiscal, do Sérgio):** [[PAINEL ICMS]] (desde 2026-08-28, `painel-icms.vercel.app`): ICMS de entrada e
  saída do WinThor (8086/8087) por uma **ponte** (`sync_supabase.py`) que só roda na máquina do Júlio, **sem
  agendamento**; em 2026-10-09 estava **desligada**, e sem ela o Atualizar não completa. Login próprio desligado e banco
  aberto à chave pública. Fala-se em **entrada/saída, nunca débito/crédito** (Júlio). A Lube está no **Regime
  Atacadista-ES**: o card de ICMS a recolher provavelmente não é o valor recolhido (cálculo do regime em pausa).
- **Saída de Veículos (frota do Araujo):** [[GESTÃO DE SAÍDA DE VEÍCULOS]] (desde 2026-09-09,
  `gestao-de-saidas-de-veiculos.vercel.app`): horas de atraso da 1ª saída do dia contra a entrada das 06:30, **ao
  segundo e sem tolerância**, com planilhas do rastreador Getrak importadas na tela. O banco (Supabase próprio)
  **ainda aceita leitura e inserção com a chave pública.**
- **Gestão TI:** [[GESTÃO TI]] (no ar desde 2026-09-15, `gestao-ti-ruddy.vercel.app`): contratos, notas, boletos e
  recibos da TI. Um robô lê a caixa `cpd@` às 08:00 e cobra às 09:00, com resumo no Telegram; Kanban TI no ar desde
  2026-10-08. O navegador nunca fala com o banco. Repositório **público de propósito**. Regras em [[Notas, boletos e recibos]].
- **Power BI antigo:** [[ANÁLISE DE BI (POWER BI)]]: análise de cada BI do Power BI antes de reconstruí-lo no DATA
  WAREHOUSE (COMPRAS e COMERCIAL já feitos).
- **Projeto atual:** [[Cérebro da Lube]]. O painel do cérebro (desde 2026-10-09) é um **robô 3D** com a mente em
  cúpula de vidro, que puxa cada nota para um painel holográfico: https://claude.ai/artifact/Tnrde74sov8LPGmgj8yjT4
  (código em `Desktop\BI\13. CEREBRO`, desde 2026-10-15; para mudar, editar o `web/` de lá e republicar no mesmo
  endereço). **Backup no GitHub** desde 2026-10-16: `Lube-Distribuidora-LTDA/CELEBRO-LUBE`, com o código e a cópia
  do vault em `vault/` (sem as notas com dado de pessoa); o vault só sobe com o repositório **privado** (foi criado
  público; em 2026-10-16 subiu só o código). Tem a aba **Rotinas** com o funil de cada rotina e, **só no arquivo baixado**
  (`Cerebro da Lube.html`), o **Modo Mãos**: gestos pela câmera como mouse — o claude.ai não libera câmera para
  páginas publicadas.
- **Jarvis:** [[JARVIS DA LUBE]] (2026-10-15, versão 8 do painel): o assistente de voz do cérebro, que conversa como
  gente e para quando é interrompido. Claude **Haiku 5.5** na conversa e **Sonnet 5.5** no pesado; voz grátis do Edge;
  HUD com transição (botão Jarvis ou Ctrl+J). Completo só no **app local** (`Desktop\BI\13. CEREBRO\INICIAR.bat`,
  `127.0.0.1:8790`): cérebro, saúde, banco só de leitura, e-mail `cpd@` (envio só com confirmação na tela), arquivos e
  internet. No link, só texto (cérebro, saúde e arquivos do OneDrive). `ENV` preenchido em 2026-10-15 (o e-mail veio
  do `.env.local` do Gestão TI, sem mostrar a senha). **Desde 2026-10-19 o Edge só fala:** o reconhecimento do Edge
  passou a devolver texto vazio, e quem ouve é um **Chrome sem janela**, offline (pacote de voz de ~300 MB, uma vez).
  Na **primeira conversa do dia** o Jarvis confere o **rosto** do Júlio (câmera com animação, piscar; comparação no
  servidor; Windows Hello de reserva); dado biométrico só em `%LOCALAPPDATA%\CerebroLube\rosto\`. **Falta o Júlio:**
  baixar o pacote de voz, cadastrar o rosto e criar o PIN do Windows Hello (hoje não tem).
- **Vídeo do Workshop Lube:** [[VÍDEO WORKSHOP LUBE]] (2026-10-01): as 23 logos de fornecedores
  sobre mármore branco, com abertura e encerramento da Lube. Em 2026-10-09 a pasta do projeto já não estava na Área
  de Trabalho; ver a nota antes de refazer.
- **Segurança:** [[SENTINELA LUBE]] (no ar desde 2026-10-06; **modo proteger** e IA ligados desde 2026-10-07): guarda
  nos 8 sistemas do portal e no [[SAC]] (9 no total), central no Supabase do Painel Lube, painel com globo 3D em
  `painel-lube-distribuidora.vercel.app/sentinela/` (só administrador). **Todos os sistemas só abrem para quem tem
  acesso pelo Painel Lube** (decisão do Júlio), **menos o SAC**, aberto de propósito (`exige_login = false`). O guarda
  não cobre o banco. Nunca testar caminho de ataque a partir do escritório (bloqueia o IP de todos). Ver [[Vercel]].
- **Saúde das rotinas:** [[GUARDIÃO DA LUBE]] (2026-10-14): o robô que confere se cada carga rodou e subiu certo, se
  os 10 sites estão no ar e se a VM está viva; abre incidente, tenta de novo **1 vez** e avisa no Telegram. Schema
  `saude` + pg_cron + função `guardiao` no DATA WAREHOUSE (no ar); estado em `select saude.painel()` e no chip do
  painel do robô. **Telegram ligado** e **vigia na `SRV-IA`** (2026-10-14); a instalação errada da LOGISTICA-55 já
  saiu (tarefa e pasta, conferido em 2026-10-15). **Falta o Júlio:** chave de leitura e travar `C:\BI` (para
  comparar com o WinThor). Alarme falso é pior que nenhum alarme. **Desde 2026-10-20 ele alarma quando ele próprio
  para** (item "Verificação na nuvem": função sem rodar, agendador falhando), mas o Telegram ainda sai pela própria
  função; o vigia da VM está sem Telegram no ENV. **O banco cai quase todo dia desde 15/10** (5 quedas em 6 dias): o
  `pg_stat_statements` incha com os lotes do `execute_values` dos ETLs — ver [[Supabase]]; correção com o Júlio.
  **Espaço do banco** (desde 2026-10-20, [[Guardião - Espaço do banco]]): medição todo dia às 05:40 e limpeza semanal
  (**sexta 05:30**) só do registro operacional, e **toda sexta às 08:11 o Claude confere** (tarefa agendada
  `limpeza-semanal-banco`: limpa, mede, procura quedas e tabela inchada, anota a semana na nota da rotina). Regra do
  Júlio: primeiro limpar; **trocar a máquina do banco só se faltar espaço com o ambiente limpo**. O DATA WAREHOUSE tem **4,4 GB, mas só 1,2 GB são dados**: 3,3 GB são
  arquivos sem dono das **quedas do banco** no meio de cargas (4 na semana de 15 a 19/10, máquina Small). SQL não apaga;
  sai na atualização do projeto no Supabase ou pelo suporte. **Decisão pendente do Júlio:** como parar as quedas.
- **Mod do Claude Code:** [[MOD BARRA LUBE]] (2026-10-07): barra azul tecnológica com a logo da Lube que
  aparece quando o Claude termina de mexer em um projeto. Testado (7 de 7); no app a barra aparece, e a logo
  precisou virar **vetor** (o app descarta PNG embutido em Svg). Validar mods só com o binário **do app**
  (`%APPDATA%\Claude\claude-code\<versão>`; 2.1.289 em 2026-10-07, e o app já tem o 2.1.293), nunca com o `claude`
  do PATH (2.1.267). Até ir para uma pasta fixa, o mod só carrega na sessão em que nasceu.
- **Ferramentas do Claude Code:** [[Claude]]: modelo (`/model`, escolha do Júlio; padrão `opus[1m]` em 2026-10-09),
  memória por pasta, `.claude/launch.json` do cérebro e permissões. **Permissão é decisão do Júlio:** o Claude não
  grava as próprias regras.
- **SAC (chamado do RCA para o SAC):** [[SAC]] (2026-10-07): tela + e-mail de comprovante na pegada do Gestão TI.
  **Login próprio** (desde 2026-10-09): conta do SAC na base de login do Painel, pendente até o TI liberar na aba
  **"SAC · externos"** do painel admin, que avisa cada cadastro novo; RCAs e supervisores. O e-mail sai **em nome do RCA,
  para o próprio RCA**, e só para e-mail de RCA ativo no WinThor (`core.dim_rca`). Motivos = assuntos "SAC - ..."
  (65 a 73). Sai pela caixa **`sac@lube.com.br`** (com o nome do RCA). **No ar e funcionando** desde 2026-10-09 em
  `sac-lube.vercel.app` (repositório público `Lube-Distribuidora-LTDA/SAC`, guarda da Sentinela sem "exige login"),
  com o atalho já na tela de login do portal. **A NF é conferida no WinThor: só aceita nota emitida até 1 mês atrás**
  (`core.dim_nf_saida`, carga do COMERCIAL na VM `SRV-IA`). Falta o primeiro envio real. Até 2026-10-09 se chamou **SAQ**
  (nome errado); o endereço antigo `saq-lube.vercel.app` redireciona.
- **Vídeo do Lube Online:** [[VÍDEO LUBE ONLINE]] (2026-10-15): animação **narrada** de 2 min 33 s da proposta de
  e-commerce B2B do Marketing (PDF "Lube Online — Proposta de E-commerce"), com o site `loja.lube.com.br` e fotos reais
  de `P:\FOTOS_ION` (preços ilustrativos), voz do Edge e trilha feita em código. Projeto em
  `Desktop\BI\14. VIDEO LUBE ONLINE\` (`GERAR VIDEO.bat` refaz tudo); MP4 em `Downloads`. **Aprovado pelo Júlio com
  som em 2026-10-16.**
- **Proposta de e-commerce B2B (TI):** [[PROPOSTA E-COMMERCE B2B]] (2026-10-16): VTEX B2B + camada de integração
  própria sobre WinThor e Kaizen, em 8 páginas A4 com a marca da Lube para imprimir (`Desktop\BI\15. PROPOSTA ECOMMERCE
  B2B\`, `GERAR PDF.bat`; PDF em `Downloads`). Logo, cores e letras da marca em [[Identidade visual da Lube]].
- **Vinheta do canal CoffeePlayGames:** [[VINHETA CPG]] (2026-10-02): intro 3D de 6,5 s com a logo
  CPG e os personagens da arte do canal, com e sem som. Mesmo esquema de gravação do vídeo do Workshop. Em
  2026-10-09 a pasta do projeto já não estava na Área de Trabalho; ver a nota antes de refazer.
