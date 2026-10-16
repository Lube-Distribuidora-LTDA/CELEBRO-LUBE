---
tipo: app
departamento: TI
status: em uso
tags: [aplicacao, hospedagem]
---
# Vercel

Hospeda os painéis dos BIs (um projeto por sistema) e o [[PAINEL LUBE DISTRIBUIDORA]]. Veja [[data-warehouse]] e [[BI COMPRAS]].

- **Time:** LUBE DISTRIBUIDORA LTDA (`lube-distribuidora-ltda`, id `team_k8YNfCDhgFwOScWnM5iHGqLC`), plano **Hobby**:
  2 crons diários por projeto e 60 s por função.
- **Onze projetos em 2026-10-14** (dez em 2026-10-09 + `gestao-comercial-trade`); os dez: `painel-compras`, `gestao-comercial-web`, `gestao-finaceiro`, `rh-absentismo`,
  `gestao-de-saidas-de-veiculos`, `painel-icms`, `gestao-ti`, `painel-lube-distribuidora`, `reposicoes-web` e
  `sac-lube` — um por linha da tabela abaixo.

## Controle de acesso
Em **Settings › Deployment Protection**:

- **Vercel Authentication** — só abre para quem está autenticado no time da Lube. Quem não é do time cai numa tela "Log in to Vercel", que parece erro mas não é.
- **Password Protection** — **não existe no plano Hobby** (no Pro custa US$ 20/mês por projeto). Esta nota dizia que era "o meio-termo"; estava errado para a nossa conta.
- **Sem proteção** — qualquer pessoa com o endereço entra.

> **Armadilha descoberta em 2026-10-05 (ver [[SENTINELA LUBE]]).** A Vercel Authentication no modo
> **Standard** ("all_except_custom_domains", o único do Hobby) protege só as **URLs de deploy** e os
> aliases `-lube-distribuidora-ltda`. O **endereço principal de produção** (`gestao-finaceiro.vercel.app`,
> `gestao-comercial-web-three.vercel.app`, `rh-absentismo.vercel.app`…) **fica aberto**. Quem testa pela
> URL do deploy vê a tela de login e acha que está protegido — foi o que aconteceu com a folha.
> Proteger também a produção exige o modo "All Deployments", que não é do Hobby.
>
> **Dois tipos de Standard (conferido em 2026-10-09):** COMPRAS e ICMS ganharam a proteção em 2026-10-06 no tipo
> `prod_deployment_urls_and_all_previews`, e ali os aliases `-lube-distribuidora-ltda` e `-git-main` **não** são
> cobertos: dependem só do guarda da [[SENTINELA LUBE]]. Os outros oito projetos estão em `all_except_custom_domains`.

**Situação desde 2026-10-06 (decisão do Júlio: todos os sistemas só para quem tem acesso pelo Painel Lube).**
Conferido com `curl` sem login, de fora:

| Sistema | Endereço principal | Situação |
|---|---|---|
| [[BI COMPRAS]] | painel-compras-rosy.vercel.app | **fechado pela Sentinela** (302 para o portal; API 401) + Vercel Standard ligada para os deploys antigos |
| [[BI COMERCIAL]] | gestao-comercial-web-three.vercel.app | **fechado pela Sentinela** |
| [[SISTEMA FINANCEIRO]] | gestao-finaceiro.vercel.app | **fechado pela Sentinela** |
| [[BI ABSENTEÍSMO RH]] | rh-absentismo.vercel.app | **fechado pela Sentinela** (inclusive os arquivos de dados) |
| [[GESTÃO DE SAÍDA DE VEÍCULOS]] | gestao-de-saidas-de-veiculos.vercel.app | **fechado pela Sentinela** (inclusive `dados.js`, `dados.json` e o `.xlsx`: 401 sem login) |
| [[PAINEL ICMS]] | painel-icms.vercel.app | **fechado pela Sentinela** + Vercel Standard ligada para os deploys antigos |
| [[GESTÃO TI]] | gestao-ti-ruddy.vercel.app | **fechado pela Sentinela**, inclusive abrir/acompanhar chamado (desde 2026-10-07); o agendador da Vercel entra só com o `CRON_SECRET` |
| [[PAINEL LUBE DISTRIBUIDORA]] | painel-lube-distribuidora.vercel.app | aberto (é a tela de login) |
| [[SAC]] (2026-10-07) | sac-lube.vercel.app (o antigo `saq-lube.vercel.app` redireciona) | **login próprio do SAC** desde 2026-10-09 (conta liberada pelo TI no painel admin); guarda da Sentinela com `exige_login = false`, porque a porta é o login do SAC, não o do portal |
| [[GESTÃO COMERCIAL TRADE]] (2026-10-14) | gestao-comercial-trade.vercel.app | **fechado pela Sentinela** (conferido de fora: `/` vai para o portal, `/dados/dims.json` dá `login_necessario`, `oidc: true`); cartão no portal **inativo** até o Júlio decidir quem abre; projeto `prj_PpgCB4Ez2d8ZK1ICjxOL8wjlueXT`, repositório público `GEST-O-COMERCIAL`, `gru1`, Root `web`; **faltam as variáveis `SUPABASE_DB_*`** |
| [[REPOSIÇÕES E CHAMADOS]] (2026-10-06) | reposicoes-web.vercel.app | **aberto, sem o guarda da Sentinela** (situação de 2026-10-09; tem nome de cliente e de motorista). Vercel Standard só nos deploys |

Os endereços de deploys antigos (sem guarda) pedem login da Vercel nos 7. A porta é o guarda da
[[SENTINELA LUBE]] com "exige login" por sistema; a chave de emergência é desligar o "exige login" no
painel da Sentinela (Configuração) ou no banco. Sempre que a proteção mudar, atualize o README do repositório junto.

> Situação de 2026-10-05 (histórico): folha, Comercial, RH, ICMS e Saída de Veículos respondiam sem login
> no endereço principal; COMPRAS aberto por decisão de 2026-09-22.

## Deploy pelo Git travado (BLOCKED) em repositório privado — de novo (2026-10-06)
Os repositórios do Gestão TI, Comercial, Financeiro, RH, Saída de Veículos e ICMS respondem 404 ao GitHub sem login (estão
**privados**) e os pushes de 2026-10-06 ficaram `BLOCKED` ("account-configuration") — o Gestão TI já estava
travado desde as 08:19, com 6 commits do Júlio sem ir ao ar. O COMPRAS, que o Júlio deixou **público** em
2026-10-06, deployou normal. O [[PAINEL LUBE DISTRIBUIDORA]] também travou às 14:46 (repositório privado de novo);
o Júlio o deixou público e um deploy novo do mesmo commit (`5941e8b`) entrou às 14:55. Contorno usado na instalação da Sentinela: criar o deploy pela API da Vercel
(`create_deployment` com `gitSource` do mesmo commit). Decisão pendente do Júlio: voltar os repositórios a
públicos, assinar o Pro, ou publicar sempre pela API.

**2026-10-08:** o Gestão TI voltou a ser **público** e o deploy pelo Git voltou a funcionar (commit `9a866cc`,
READY). O REPOSIÇÕES também é público. ~~Comercial, Financeiro, RH e ICMS não foram conferidos de novo.~~

**2026-10-09 (conferido pela API, `list_deployments`):** Comercial, Financeiro, RH, ICMS e Saída de Veículos
**continuam privados**: todo push desde 2026-10-06 fica `BLOCKED`, e a produção sai pela API.

| Sistema | Produção em 2026-10-09 | Pushes `BLOCKED` |
|---|---|---|
| [[BI COMERCIAL]] | `34c5c42` (guarda 1.1.0), pela API em 2026-10-07 | 06/10, 07/10 e 08/10 (`bb64f16`, `21ed527`). Os de 08/10 só mexem em `etl/` e `web/db/`: para quem usa, nada muda |
| [[SISTEMA FINANCEIRO]] | `0f4c9ac` (`dpl_J2yZBxfUCj7rqq78HTDkMJD3ihc3`), pela API em 2026-10-07 = `HEAD` da `main` | 06/10 e 07/10. Até o `02c38c9` (2026-09-30) o Git deployava normal |
| [[BI ABSENTEÍSMO RH]] | `d50de78`, pela API em 2026-10-07 = `HEAD` da `main` | 06/10 e 07/10 |
| [[PAINEL ICMS]] | `fc0ad34` (`dpl_oJwG8hhFsSqtjrtTWJUJYrFqiYdH`), pela API em 2026-10-07 = `HEAD` da `main` | 06/10 e 07/10 |
| [[GESTÃO DE SAÍDA DE VEÍCULOS]] | `b9ac2a0` (`dpl_9XGTGuv73ujWdu7c9pNa72HPRKU7`), pela API em 2026-10-07 = `HEAD` da `main` | 06/10 e 07/10 |

COMPRAS, Gestão TI, REPOSIÇÕES e o portal deployam pelo Git (`source: git`).

**Como conferir se uma atualização está no ar** sem cair na armadilha do "respondeu 200": `get_deployment` com o
endereço de produção (ex.: `gestao-ti-ruddy.vercel.app`) devolve o deploy que o alias aponta e o commit dele;
compare com o `HEAD` da `main`. O log de build lista as rotas, o que prova que uma tela nova entrou.

## GESTÃO FINANCEIRO (2026-09-25)
https://gestao-finaceiro.vercel.app — **fechado pela [[SENTINELA LUBE]] desde 2026-10-06** (exige login, sem
rotas públicas; sem login `/api/*` dá 401). Até lá a única proteção era a Vercel Authentication Standard, que
**não cobre este endereço**: em 2026-10-05 `/api/dados` respondeu sem login com a folha inteira. Root Directory
**`web`**: sem isso o deploy sobe e responde 404, porque o `index.html` não fica na raiz do repositório.
Repositório privado: o deploy sai pela API (ver a tabela de 2026-10-09 acima). Detalhes em
[[GESTÃO FINANCEIRO — documentação técnica]].

## PAINEL LUBE DISTRIBUIDORA (desde 2026-09-14)
O [[PAINEL LUBE DISTRIBUIDORA]] **está conectado desde 2026-09-14** (o Júlio ligou o repositório; 1º deploy às
14:19, commit `5586b20`): projeto `painel-lube-distribuidora` (`prj_WGmlGvONBuausosdw6AgnDhrCnge`),
https://painel-lube-distribuidora.vercel.app, repositório **público**, deploy automático a cada push na `main`.
Framework **Other**, sem build, Output Directory `.`, nenhuma variável de ambiente — é site estático puro. Desde
2026-10-06 tem o guarda da [[SENTINELA LUBE]] na raiz (`middleware.ts`, sem porta: é a tela de login) e um
`.vercelignore` que tira `db/`, `supabase/`, `guarda/`, `docs/`, `.claude/` e o README do site — antes, esses
arquivos eram servidos a qualquer um. _Até 2026-10-09 esta seção se chamava "Pendente de conectar" e dizia que o
portal ainda não tinha projeto na Vercel — estava errado._

## REPOSIÇÕES E CHAMADOS (2026-10-06)
O [[REPOSIÇÕES E CHAMADOS]] **está publicado**: projeto `reposicoes-web` (`prj_IjVNqbwMq19wyDsAE0mfJZ7r3OIJ`), endereço `https://reposicoes-web.vercel.app`, repositório [Lube-Distribuidora-LTDA/REPOSICOES](https://github.com/Lube-Distribuidora-LTDA/REPOSICOES) (público), deploy automático a cada push na `main` (leva ~1 min). Mesmo molde do COMERCIAL: Framework **Other**, **Root Directory = `web`**, Build e Output em branco, cinco variáveis `SUPABASE_DB_*` (porta 5432), região `gru1`. Primeiro deploy em 2026-10-06 17:17 (`cc6d78e`); em produção desde 2026-10-07 14:15 o `5b6a0bd` (conferido em 2026-10-08 e 2026-10-09). **Está sem o guarda da SENTINELA** e tem nome de cliente e de motorista.

## Cache de função: o que a Vercel faz com `s-maxage` e `stale-while-revalidate` (2026-10-07)
- A Vercel consome `s-maxage` e `stale-while-revalidate` no CDN e **não os repete** ao navegador: no cabeçalho que se vê só aparece `Cache-Control: public`. Quem diz o que houve é `X-Vercel-Cache` (`MISS`, `HIT`, `STALE`) e `Age`.
- `STALE` = entregou a cópia velha na hora e foi buscar a nova por trás. É o que protege o painel do REPOSIÇÕES quando o banco trava (respondeu em 0,18 s com o banco fora).
- **Armadilha:** o Chrome também implementa `stale-while-revalidate` no cache HTTP dele e entrega a resposta velha em 2 ms **sem avisar** — dado de uma visita atrás. Em quem busca com `fetch`, usar `cache: "no-store"`: o CDN (servidor) continua valendo, o do navegador não.
- Erro nunca pode ir para o cache: a rota responde 502 com `Cache-Control: no-store`.
- Função serverless que abre conexão por chamada deve **abrir, consultar e fechar na hora**: o *session pooler* do Supabase tem um número limitado de conexões e, em crise, quem pede uma espera até 15 s (`ECHECKOUTTIMEOUT`).

## Plano Hobby: repositório privado trava o deploy
Descoberto em 09/2026 no [[GESTÃO TI]]. No plano Hobby, **colaboração só é gratuita em repositório público**. Se o repositório vira privado, a Vercel passa a exigir que o autor do commit seja verificado como dono da conta, e o deploy morre no estado **`BLOCKED`** — que não é erro de build: o código nem chega a compilar.

Dois detalhes que custaram tempo:
- o **CLI reporta "UNKNOWN"** nesse caso. Quem conta a verdade é a API de deployment, que devolve `readyState: BLOCKED` e um link para a documentação da restrição;
- parece problema de cobrança e **não é**. O `vercel usage` reclama de "no active subscription" mesmo quando está tudo certo, o que manda a investigação para o lado errado.

Voltando o repositório a público, o deploy normaliza sozinho no commit seguinte. Fechar o repositório exigiria plano pago.

O portal travou assim em 2026-09-30 e em 2026-10-06. Nas duas vezes o Júlio deixou o repositório público e o
Claude criou um **deploy novo** do mesmo commit: promover o bloqueado dá **422**, e refazê-lo dá **400**
`deployment_can_never_deploy`. Com o repositório já público, um commit vazio também gera deploy novo ([[GESTÃO TI]]).

## Padrão dos projetos
Site estático mais uma função serverless, sem framework (em Next.js: [[GESTÃO TI]] e [[PAINEL ICMS]]). Região `gru1` (ver abaixo), cache de 10 minutos, e `X-Robots-Tag: noindex, nofollow` para manter os painéis fora dos buscadores. As variáveis de ambiente quem cadastra é o Júlio.

**Porta do [[Supabase]]:** a skill [[data-warehouse]] manda a 6543 (transaction pooler), e o [[BI COMPRAS]] usa
ela. FINANCEIRO, COMERCIAL e REPOSIÇÕES usam a **5432 (session pooler)**: o 6543 do DATA WAREHOUSE conecta e trava
a consulta (medido em 2026-09-25 no [[SISTEMA FINANCEIRO]]). _Até 2026-10-09 esta nota dava a 6543 como padrão._

## Região das funções: `gru1` (2026-09-15)
O padrão da Vercel é **`iad1` (Washington)**. Com o banco em São Paulo (sa-east-1), cada consulta atravessa o
continente: no [[GESTÃO TI]] a troca de tela levava 0,4–3,4 s e caiu para 0,12–0,48 s com `"regions": ["gru1"]`
no `vercel.json`. Fixar `gru1` foi decisão do Claude (2026-09-15) e virou regra para sistema com banco em São Paulo.

**Como conferir:** `get_deployment` com o endereço de produção devolve `regions`. No navegador, o cabeçalho
`x-vercel-id`: `gru1::gru1` está certo; `gru1::iad1` quer dizer função em Washington (logo depois do deploy ainda
pode aparecer a versão antiga).

**Situação em 2026-10-09 (pela API):** `gru1` em COMPRAS, COMERCIAL, FINANCEIRO, GESTÃO TI, REPOSIÇÕES e SAC.
`iad1` no [[PAINEL ICMS]] (banco em São Paulo), no [[BI ABSENTEÍSMO RH]] e na [[GESTÃO DE SAÍDA DE VEÍCULOS]]
(bancos em us-west-2) e no portal. Pendente (o Claude se ofereceu em 2026-09-15; falta o OK do Júlio): decidir a
região desses três — o ICMS é o caso claro.

## Armadilhas da CLI e do deploy (2026-09-15, [[GESTÃO TI]])
- **Next.js com vulnerabilidade crítica conhecida não sobe:** o deploy dá `ERROR` mesmo depois de compilar, sem
  erro aparente. Foi o 15.5.3 (RCE crítico); o Gestão TI foi para o 15.5.25. Atualize o Next antes de publicar.
- **`vercel env add` com nome `NEXT_PUBLIC_..._KEY`** abre uma pergunta (segredo ou configuração?) e, sem
  terminal, sai com código 0 **sem cadastrar**. Passe o tipo explícito e confira com `vercel env ls`.
- **`vercel link`** grava `VERCEL_OIDC_TOKEN` no `.env.local` e põe `.env*` no `.gitignore`, o que tiraria o
  `.env.example` do repositório (use a exceção `!.env.example`). O `VERCEL_OIDC_TOKEN` **nunca vai fixo**: a
  Vercel gera o dela.
- **Variável nova só vale em deploy novo:** cadastrar não basta; publique de novo (um commit vazio serve).

Detalhes em [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]].

## Registro de mudanças
_Compilado em 2026-10-09 a partir do Git, da API da Vercel e das sessões._
- **2026-10-14** — **Projeto duplicado do Trade** (14:4x): o Júlio importou o mesmo repositório `GEST-O-COMERCIAL` pela tela da Vercel e nasceu `gestao-comercial` (`prj_3uGBzq8eWFmEJy6eo2FWPYdj7Cvn`, `gestao-comercial-kappa.vercel.app`), com as 5 variáveis `SUPABASE_DB_*` (Sensitive) mas **Root Directory = raiz do repositório**: o `index.html` está em `web/`, então responde **404 NOT_FOUND** (a mesma armadilha do FINANCEIRO). Ele **não está na Sentinela** (o guarda e o registro são do projeto `gestao-comercial-trade`): se o Root virar `web` sem registrar, o painel abriria **sem login e com dado**. O projeto certo é `gestao-comercial-trade`, que não tinha variáveis. Recomendado: apagar o duplicado e cadastrar as variáveis no certo (Sensitive não se copia entre projetos). Nada foi apagado pelo Claude.
- **2026-10-14** — Projeto `gestao-comercial-trade` criado (Claude, `create_project` com o repositório público `GEST-O-COMERCIAL`; o 11º do time) e deploy pela API
  (`create_deployment` com `gitSource`, commit `8f08cff`, pronto em ~15 s de build). Sistema novo nasce com o guarda e **registrado na Sentinela antes** do primeiro deploy
  ([[SENTINELA LUBE]]). Funções com a mesma lógica do servidor local (`web/pacote.js`); conexão com o banco que abre e fecha; `maxDuration` 60 s. Variáveis a cadastrar pelo Júlio.
- **2026-10-09** — Corrigido: o portal estava como "pendente de conectar" (está no ar desde 2026-09-14). Entraram
  o time, os dez projetos, o REPOSIÇÕES na tabela, a produção dos repositórios privados, os dois tipos de Standard,
  a região de cada projeto, a porta 5432 e as armadilhas da CLI.
- **2026-10-08** — Gestão TI de volta a público; deploy pelo Git normal (`9a866cc`).
- **2026-10-07** — Guarda 1.1.0 nos sistemas privados publicado pela API (pushes `BLOCKED`).
- **2026-10-06** — Sentinela nos sistemas; COMPRAS público; Standard `prod_deployment_urls_and_all_previews` em
  COMPRAS e ICMS; portal `BLOCKED` às 14:46 e de novo no ar às 14:55; REPOSIÇÕES publicado.
- **2026-10-05** — Achado que a Standard não cobre o endereço principal ([[SENTINELA LUBE]]).
- **2026-09-30** — Portal `BLOCKED` por repositório privado; deploy novo às 11:33.
- **2026-09-24** — Gestão TI volta a público para destravar o deploy.
- **2026-09-15** — Gestão TI criado com região `gru1`; armadilhas da CLI.
- **2026-09-14** — Portal conectado na Vercel (Júlio).
