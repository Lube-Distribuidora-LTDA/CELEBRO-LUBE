---
tipo: nota
departamento: Memória & Infra
status: ativo
tags: [sistemas, infra]
---
# Mapa de sistemas

Como os dados da Lube andam, do ERP até os painéis.

**[[WinThor]]** (banco [[Oracle]], só leitura) → **ETL em Python** na VM **`SRV-IA`** (192.168.12.30), na rede da empresa → **[[Supabase]]**, projeto DATA WAREHOUSE → **painéis na [[Vercel]]**.

- Um banco só, um schema por sistema (`compras`, `comercial`, `financeiro`, `reposicao`, `trade`, `inventario`, `fiscal`); dimensões compartilhadas no
  `core`. O ETL do [[BI COMPRAS]] é dono de `dim_fornecedor`, `dim_produto` e `dim_comprador`; o do [[BI COMERCIAL]],
  de `dim_rca` (com e-mail e situação do RCA desde 2026-10-07), `dim_supervisor`, `dim_cliente` e `dim_nf_saida`
  (2026-10-09). O e-mail do `dim_rca` e o `dim_nf_saida` existem para o [[SAC]].
- Sistemas que já vieram do WinThor por esse caminho: [[BI COMPRAS]] (em produção), [[BI COMERCIAL]] (em produção desde 2026-09-28) e [[REPOSIÇÕES E CHAMADOS]] (schema `reposicao`, painel publicado desde 2026-10-06, carga e aquecedor agendados pelo Júlio em 2026-10-09; é o único que **não lê o banco ao abrir** — cache no banco, CDN e cópia no navegador; desenho em [[data-warehouse]], seção 8b) e a [[GESTÃO COMERCIAL TRADE]] (schema `trade`, desde 2026-10-14; carga [[Trade - Sync]] com instalador em `P:\INTEGRAÇÃO BI\TRADE`, **agendada pelo Júlio em 2026-10-14**, na `SRV-IA`; o painel só roda na máquina, ver "Fora deste fluxo") e o [[MOVIMENTAÇÃO DE INVENTÁRIO]] (schema `inventario`, desde 2026-10-19: rotinas 266 e 1147; carga [[Inventário - Sync]] com instalador em `P:\INTEGRAÇÃO BI\INVENTARIO`, **agendada na `SRV-IA` em 2026-10-20** e vigiada pelo [[GUARDIÃO DA LUBE]]; painel em `movimentacao-inventario.vercel.app` desde 2026-10-20, fechado pela Sentinela, em uso (cartão ativo no portal desde 2026-10-20); o navegador filtra e soma, como no REPOSIÇÕES, com o pacote comprimido guardado no banco e no navegador) e o [[GESTÃO FISCAL]] (schema `fiscal`, desde 2026-10-20: tributação e preço de venda por região da rotina 201, nas 16 regiões escolhidas pelo Júlio; carga [[Fiscal - Sync]] com instalador em `P:\INTEGRAÇÃO BI\FISCAL`, **ainda não agendada**; painel **só local** por enquanto, `INICIAR.bat`, porta 3103; mesmo desenho de navegador do Inventário, abrindo com a cópia guardada).
- As cargas do COMPRAS e do COMERCIAL rodam na `SRV-IA` desde 2026-09-28. O COMERCIAL roda **só lá** desde
  2026-10-09: de 2026-10-01 a 2026-10-09 as mesmas tarefas também rodavam na estação `LOGISTICA-55`, e as cargas se
  atropelavam (daí a tranca de carga de 2026-10-08). Sugestão (Claude): agendar sistema novo numa máquina só, a `SRV-IA`.
- **Um sistema anda no sentido contrário**, escrevendo no WinThor: a [[Abertura de margem]] (2026-09-30), que abre e fecha `PCPRODFILIAL.PERCMARGEMMIN` por filial. Ele não roda na Vercel, e sim na VM `SRV-IA`, em `http://SRV-IA:8080`, desde 2026-10-01 — o Oracle em `192.168.0.5` não é alcançável de fora. Em 2026-10-09 ainda **sem a credencial de escrita no ENV**: a página abre, mas não abre nem fecha nada. Usuário Oracle separado, de escrita; o do ETL é de leitura e continua sendo.
- Código editado em `P:\INTEGRAÇÃO BI\<SISTEMA>`, executado em `C:\BI\<SISTEMA>`, versionado em `Desktop\BI\<n>. <SISTEMA>` (GitHub). Públicos: COMPRAS, REPOSIÇÕES, Gestão TI, SAC e o portal, porque no plano Hobby da [[Vercel]] repositório privado trava o deploy. Privados: COMERCIAL, FINANCEIRO, RH, Saída de Veículos e ICMS, publicados pela API da Vercel (situação de 2026-10-09).
- Manual completo: [[data-warehouse]]. Referência viva: [[BI COMPRAS]].

## Quem vigia o fluxo: o Guardião (2026-10-14)
O [[GUARDIÃO DA LUBE]] confere o caminho inteiro, ponta a ponta: a **tarefa** do Agendador da `SRV-IA` disparou
(gatilho), o **WinThor** respondeu (lê), cada consulta gravou `OK` no `controle_carga` com as linhas de sempre
(processa e grava), o destino e o WinThor batem com a carga (confere) e o painel recebeu o dado novo — `painel_cache`
do REPOSIÇÕES, views do COMERCIAL, site no ar (entrega). Mora no próprio DATA WAREHOUSE (schema `saude`, pg_cron de 5
em 5 e de 10 em 10 min, função `guardiao`) e tem um **vigia na `SRV-IA`** para o que o banco não enxerga (Agendador,
servidor de margem, disco, relógio, contagem no WinThor) — ainda não instalado em 2026-10-14. Falha vira incidente,
**uma** nova tentativa pedida à VM e aviso no Telegram. Vigia as cargas de `compras`, `comercial` e `reposicao`, a folha
do `financeiro`, o robô do [[GESTÃO TI]] e os 10 sites; **ainda não vigia** o [[Trade - Sync]], as importações do RH e
da Frota nem a ponte do ICMS. Estado: `select saude.painel()` ou o chip do painel do robô do [[Cérebro da Lube]].

## Segurança: a Sentinela na porta de todos (2026-10-06)
Os 8 sistemas do portal (o próprio [[PAINEL LUBE DISTRIBUIDORA]] e os 7 que ele abre) têm o guarda da
[[SENTINELA LUBE]] na porta, em **modo proteger** desde 2026-10-07. Nos 7, quem não entrou pelo portal (login +
permissão para aquele sistema) é mandado para a tela de login do portal; a API responde 401. O portal tem o guarda
sem porta, porque é a própria tela de login. O [[SAC]] (2026-10-07) é o 9º sistema com guarda, mas **abre sem login
de propósito** (`exige_login = false`, decisão do Júlio): o guarda segue barrando ataque, robô e rajada. O guarda registra cada acesso na central (schema `sentinela` do projeto Supabase do portal),
barra ataque na hora e alimenta o painel com o globo. Sistema novo nasce com o guarda (ver `guarda/LEIA-ME.md`
no repositório do portal). **O guarda não cobre o banco:** RH, ICMS e Saída de Veículos ainda aceitam acesso direto
com a chave pública (situação de 2026-10-09).

**Exceção aberta:** o [[REPOSIÇÕES E CHAMADOS]] (publicado em 2026-10-06) é o único painel **sem o guarda**
— abre para quem tiver o endereço, e tem nome de cliente e de motorista. Ao instalar, lembrar que o **aquecedor**
dele ([[Reposições - Aquecer painel]]) chama a API de 5 em 5 minutos e também seria barrado: precisa de um
caminho liberado, senão o painel volta a abrir frio.

## Fora deste fluxo
O **[[GESTÃO COMERCIAL TRADE]]** (2026-10-14) tem um desenho diferente dos outros BIs: o ETL ([[Trade - Sync]]) grava no schema `trade` o **pacote** (a venda de 2,9 milhões de linhas não é tabela: viaja como arquivo colunar, mais estoque, conta corrente, classificação, fotos e histórico), e o painel é um **motor em memória** que lê esse pacote do banco, tanto no servidor local (`node servidor_local.js`, com as fotos de `P:\FOTOS_ION`, [[Pasta de fotos FOTOS_ION]]) quanto nas funções da Vercel (`gestao-comercial-trade.vercel.app`, **sem fotos**, fechado pela Sentinela; o repositório público `GEST-O-COMERCIAL`). O cartão no portal está inativo até o Júlio decidir quem abre. Cada instância guarda ~380 MB de venda e troca de versão sozinha quando o ETL publica.

Nem todo sistema da Lube passa pelo ETL. O [[BI ABSENTEÍSMO RH]], o [[PAINEL ICMS]] (ver abaixo), a [[GESTÃO DE SAÍDA DE VEÍCULOS]] (dado do rastreador Getrak, importado em planilha), o [[GESTÃO TI]] e o [[PAINEL LUBE DISTRIBUIDORA]] (que dá acesso a eles) têm cada um seu próprio projeto Supabase, sem passar pelo ETL. No RH, na Saída de Veículos e no portal, o dado entra por importação de planilha ou cadastro na tela, e o navegador costuma falar direto com o banco. Lista completa em [[Supabase]].

O [[PAINEL ICMS]] **vem do WinThor, mas por outro caminho**: uma ponte em Python (`sync_supabase.py`), que só roda
na máquina do Júlio, atende o botão Atualizar do site, consulta no Oracle o que as rotinas 8086 (entradas) e 8087
(saídas) mostram e grava o resultado em JSON no Supabase próprio (`painel-icms-lube`), sem ETL e sem DATA WAREHOUSE.
O navegador fala direto com esse banco, com a chave pública. A ponte **não é agendada**: desligada (como estava em
2026-10-09), o site fica no último período processado.

O [[SISTEMA FINANCEIRO]] (2026-09-25) é um caso misto: **não vem do WinThor** — a folha chega em PDF do DP — mas mora no **schema `financeiro` do DATA WAREHOUSE**, sem projeto Supabase próprio. E, como o [[GESTÃO TI]], o navegador nunca fala com o banco: tudo passa por função serverless. Ver [[GESTÃO FINANCEIRO — documentação técnica]].

O [[SAC]] (publicado em 2026-10-07, funcionando desde 2026-10-09, `sac-lube.vercel.app`) é uma tela de abertura de chamado do RCA, **com login próprio desde 2026-10-09** (conta do SAC na base de login do [[PAINEL LUBE DISTRIBUIDORA]], liberada pelo TI; atalho na
tela de login do portal, sem login): **lê** do DATA WAREHOUSE o cadastro de produtos (`core.dim_produto`) e o
e-mail do RCA (`core.dim_rca`, para só mandar a quem é RCA ativo) e a capa das notas (`core.dim_nf_saida`, com o cliente de
`core.dim_cliente`, para só aceitar NF emitida até 1 mês atrás, desde 2026-10-09) e **manda e-mail** pelo SMTP da [[Locaweb]],
em nome do RCA. Na fase 1 não grava nada em banco. É o único sistema aberto de propósito, sem "exige login".

O [[GESTÃO TI]] é a exceção dupla: além de não usar o ETL, o dado chega **do e-mail** — um robô lê a caixa `cpd@lube.com.br` na [[Locaweb]] e extrai valor e vencimento de dentro da nota. E o navegador nunca fala com o banco: tudo passa por rotas de API no servidor.

O que mudou em cada sistema, por data: [[Registro de mudanças]].
