---
tipo: projeto
departamento: Fiscal
status: ativo
inicio: 2026-08-28
tags: [projeto, icms, fiscal, winthor, supabase, vercel, sentinela]
---
# PAINEL ICMS

Painel de **apuração do ICMS da Lube (Filial 1)**, feito para o **Sérgio** (área fiscal; o projeto é dele). Mostra o
ICMS de entrada e de saída do [[WinThor]] (rotinas **8086** = entradas e **8087** = saídas), por alíquota e carga
efetiva, o **ICMS a recolher**, um gráfico 3D, o botão **Exportar planilha** e um **assistente virtual** com IA.
O que o Sérgio quer de verdade: **saber quanto vai pagar de ICMS por mês** (Júlio, 2026-09-11).

- **No ar:** https://painel-icms.vercel.app — só com login do [[PAINEL LUBE DISTRIBUIDORA]] (guarda da [[SENTINELA LUBE]]).
- **Terminologia:** no ICMS da Lube só se fala em **entrada e saída, nunca em débito e crédito** (Júlio, 2026-09-08).
- Conversas: [[2026-09-04 — IA do Painel ICMS, assistente do site e a ponte do WinThor]],
  [[2026-09-10 — Regime Atacadista e a identidade V1 no Painel ICMS]],
  [[2026-10-05 — Sentinela Lube, sistema de segurança]].

## Onde mora
| Peça | Onde |
|---|---|
| Site | Next.js 16.3.3 (App Router, middleware edge), repositório [Lube-Distribuidora-LTDA/PAINEL-ICMS](https://github.com/Lube-Distribuidora-LTDA/PAINEL-ICMS) (**privado**), branch `main`. Sobrou a branch `sentinela` no GitHub, parada no `55ad6d5` (tudo dela já está na `main`) |
| Clone do site | `Desktop\BI\2. SERGIO LUBE\PAINEL-ICMS` (com remoto, desde 2026-10-06) |
| [[Vercel]] | projeto `painel-icms` (`prj_5h9PoHWB6qCeoEhUNzQ4RVxnGrbn`), funções em `iad1` (não em `gru1` como os outros), plano Hobby: função morre em 60 s |
| [[Supabase]] | `painel-icms-lube` (`ylzjamsiknkcgyzgehnl`, sa-east-1). Sem Edge Functions |
| Ponte e painel local | `Desktop\BI\2. SERGIO LUBE\PainelICMS` (Git **só local**, branch `master`, sem remoto, desde 2026-09-04) |
| Regras fiscais | `AGENTE_ICMS_Lube.md` na pasta local: origem dos dados, campos, identidades V1 a V8, armadilhas já cometidas |
| Memórias do Claude Code | `C:\Users\gti.julio.alves\.claude\projects\c--Users-gti-julio-alves-Desktop-BI-2--SERGIO-LUBE-PainelICMS\memory\`. **Desatualizadas** (são de 2026-09-04): ainda dizem que o site usa Gemini e que a pasta local não tem Git |

Conferido em 2026-10-09: a produção roda o commit **`fc0ad34`** (deploy `dpl_oJwG8hhFsSqtjrtTWJUJYrFqiYdH`), que é o
`HEAD` da `main`. A pasta local `PainelICMS` está sem nada pendente de commit.

## Como funciona
**[[WinThor]] ([[Oracle]]) → ponte `sync_supabase.py` na máquina do Júlio → Supabase `painel-icms-lube` → site na Vercel.**
Não passa pelo ETL nem pelo DATA WAREHOUSE. O site **nunca fala com o Oracle**: só lê do Supabase.

1. O Sérgio escolhe o período e clica **Atualizar**. O navegador grava um pedido em `pedidos_atualizacao`.
2. A **ponte** olha a fila **a cada 10 s**. Ela roda na máquina do Júlio, a única que alcança o Oracle.
3. Consulta o WinThor (`PCNFBASEENT`, `PCNFBASESAID`, `PCCFO`, `PCNFSAID`, `PCMOV`), filial 1 por padrão.
4. Agrega com a mesma conta do painel local e roda a **trava determinística** (`conferir()`: V3 e V8). Se falhar,
   **não grava** e o pedido vai para `erro`.
5. Avisos que não bloqueiam: identidade **V1** e o cálculo do Regime Atacadista em paralelo (ver abaixo).
6. **Segunda opinião da IA** (Gemini) sobre os números já calculados, gravada em `dados.analise_ia`.
7. Gera a planilha `.xlsx` e sobe para o bucket `planilhas`. Grava o período em `periodos` (um JSON `dados` por período).
8. O site consulta o pedido a cada 3 s e **espera até 3 min**. Passou disso: "Demorou demais — a ponte local pode
   estar desligada".

- Ao ligar, a ponte já processa o mês corrente.
- **Exportar planilha** abre um link assinado do Storage que vale 60 s.
- **Painel local:** `painel_local.py` faz a mesma conta sem a web (`--demo` roda sem banco). O passo a passo da
  instalação está em `PASSO_A_PASSO_Instalacao.md`; o atalho `Painel.bat` é o do Passo 11. A memória do Claude Code
  de 2026-09-04 diz que o painel local roda **no PC do Sérgio** por esse atalho. Nesta máquina não há `Painel.bat`.
- **Cálculo atual:** não-cumulatividade simples, **saída menos entrada**, no card "ICMS PRÓPRIO A RECOLHER".
  Tolerância das identidades: R$ 0,05 por linha e R$ 1,00 no total.

> **Atenção:** a Lube está no **Regime Atacadista-ES** (3 apurações, cada uma com seu DUA). O card provavelmente **não é o valor
> que a Lube recolhe de fato**. O cálculo do regime existe só como esqueleto e está em pausa.

## Banco (Supabase `painel-icms-lube`)
| Tabela | O que guarda |
|---|---|
| `periodos` | um período por linha (`inicio`, `fim`, `titulo`, `dados` em JSON, `status` ok/erro, `planilha_path`). 9 linhas em 2026-10-09 |
| `pedidos_atualizacao` | a fila de pedidos do botão Atualizar: `pendente` → `processando` → `concluido`/`erro`, com `solicitado_por`. 12 linhas |
| `usuarios_permitidos` | e-mails que podem entrar pelo login próprio do site, com `senha_definida`. 5 e-mails |
| Storage `planilhas` | a planilha de cada período, `AAAA-MM-DD_a_AAAA-MM-DD.xlsx` |

Migrações aplicadas (o SQL não está no repositório; o que cada uma faz vem do nome e da estrutura atual):

| Data | Migração | O que faz |
|---|---|---|
| 2026-08-28 | `criar_estrutura_painel_icms` | cria `periodos` e `pedidos_atualizacao` |
| 2026-08-28 | `restringir_acesso_por_email_permitido` | `usuarios_permitidos`: só entra e-mail da lista |
| 2026-09-03 | `liberar_anon_temporariamente_login_desligado` | **políticas TEMP para o anônimo**, porque o login do site foi desligado |
| 2026-09-03 | `adicionar_planilha_e_bucket_storage` | coluna `planilha_path` e bucket `planilhas` |
| 2026-09-03 | `preparar_login_com_senha` | coluna `senha_definida` (primeiro acesso por link define a senha) |

## Assistente virtual (no site)
- Bolinha com a foto do Sérgio no canto inferior direito, a **88 px do rodapé** para não cobrir a barra fixa
  (período, atualizar, e-mail/sair). Não aparece em `/login` nem em `/definir-senha`.
- `/api/assistente`: **Claude Sonnet 5** pelo SDK oficial da Anthropic (`@anthropic-ai/sdk` ^0.124.0), esforço baixo, até 1.200 tokens de saída,
  **busca na web** (até 5 por pergunta) e **cache de prompt** no prompt de sistema fixo (`src/lib/assistenteSistema.ts`,
  com as regras fiscais). Responde em ~10 s.
- Mostra markdown de verdade (tabela, negrito). A janela cresce quando vem tabela, texto longo ou bloco de código.
- Chave: `ANTHROPIC_API_KEY` na Vercel, cadastrada pelo Júlio. A `GEMINI_API_KEY` antiga continua lá, **sem uso**.
  Essa chave antiga foi **colada no chat** em 2026-09-04 (memória do Claude Code do projeto).
- Desde 2026-10-06 a rota responde **401 sem login**: antes estava aberta e qualquer um gastava a chave.
- **Só a API do Claude neste assistente** (Júlio, 2026-09-08; ele avisa se mudar de ideia).

## Segunda opinião da IA (na ponte)
- `agente_ia.py`: **Gemini `gemini-3.6-flash`** (Google AI Studio, nível gratuito) pela lib `openai` compatível,
  até **4.000 tokens** (o Gemini "pensa" antes e gasta parte do limite). Recebe só os números agregados, nunca as linhas.
- Sem chave ou com a API fora, devolve nada e o painel segue normal.
- Chave na variável de ambiente de usuário `GEMINI_API_KEY` do Windows: **uma chave só do agente local**, separada da
  do site, para um não derrubar a cota do outro.
- O texto fica em `dados.analise_ia`, mas **o site ainda não mostra**.
- O agente lê o `AGENTE_ICMS_Lube.md`, que **ainda escreve "débito/crédito"** (10 linhas, inclusive a V6). Só o
  prompt do site foi corrigido. O `regime_atacadista.py` (2026-09-10) também usa `debito`/`credito` nos nomes dos
  campos de `dados.apuracao_regime` e nos avisos.

## Acesso e segurança
- **Porta:** guarda da [[SENTINELA LUBE]] (`src/lib/sentinela-guarda.ts`, versão 1.1.0), chamado na primeira linha do
  `src/middleware.ts` em **modo fechado** (`FECHADO = { projeto: "painel-icms", slug: "painel-icms" }`).
  `exige_login = true` desde 2026-10-06, sem rotas públicas: sem sessão a página vai para o portal
  (`/?abrir=painel-icms`) e `/api/*` responde 401. Saúde: `/.sentinela/saude`.
- **Vercel Authentication Standard** desde 2026-10-06: os endereços de deploy (inclusive os antigos, sem guarda) e as
  prévias pedem login da Vercel. Os aliases `painel-icms-lube-distribuidora-ltda.vercel.app` e
  `painel-icms-git-main-lube-distribuidora-ltda.vercel.app` **não são cobertos** e dependem só do guarda.
- **Login próprio do site desligado "temporariamente" desde 2026-08-28** (`AUTH_DESLIGADA_TEMPORARIAMENTE = true` em
  `src/lib/auth-config.ts`). Motivo escrito no código: o Wi-Fi da Lube bloqueava `supabase.co` e o link de acesso não
  saía. O login com senha existe, mas não roda. Com ele desligado, todo pedido sai como `acesso-temporario@lube.com.br`.
- **Banco aberto à chave pública:** o navegador fala direto com o Supabase com a chave pública, e as políticas TEMP
  deixam o anônimo ler e gravar. **O guarda não resolve isso**: quem tiver a chave (ela vai no código do site) chega
  ao banco sem passar pela Sentinela. As políticas exatas não foram conferidas aqui.
- **Repositório privado:** no Hobby o push na `main` fica `BLOCKED`. Em 2026-10-06 e 2026-10-07 a produção saiu
  **pela API** da Vercel (`create_deployment` com o mesmo commit). Ver [[Vercel]]. Em 2026-09-08 o deploy pelo Git
  ainda saía READY (`7817909`); não está registrado quando o repositório ficou privado. Em 2026-10-07 o push do
  `fc0ad34` ainda ficou `BLOCKED`.
- **Build sem as variáveis do Supabase quebra** no prerender da página inicial (o `@supabase/ssr` exige a URL e a
  chave): aconteceu no preview do branch `sentinela` pelo Git (2026-10-06, `ERROR`) e no build local (2026-10-07).
  Para conferir, publicar pela Vercel.
- O build avisa que o Next 16 marca o arquivo `middleware` como obsoleto (o nome novo é `proxy`). Hoje funciona, e
  é nele que mora o guarda: se um dia renomear, o guarda vai junto.
- **Variáveis** (só os nomes). Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (sem uso). Máquina da ponte: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  (acesso total; cuidado, ver [[Supabase]]), `WINTHOR_DSN`, `WINTHOR_USER`, `WINTHOR_PASSWORD`, `LUBE_FILIAL`,
  `LUBE_FUNDAP`, `GEMINI_API_KEY`.

## Rotina: a ponte
- **Não há agendamento.** A ponte só roda quando alguém a liga na máquina do Júlio (`python sync_supabase.py`, log em
  `_ponte.log`). Ligada pelo Claude, ela é processo filho da sessão e **cai quando a sessão fecha**.
- Caiu duas vezes (2026-09-08 e 2026-09-10) e o pedido do Sérgio ficou parado até alguém religar.
- **Em 2026-10-09 a ponte estava desligada**: nenhum processo Python rodando e nenhuma tarefa agendada. O último
  registro do `_ponte.log` é de **2026-09-14 06:15**, com erros de conexão (`WinError 10060`). O site mostra o último
  período processado; o botão Atualizar não completa.
- **Sem alerta** quando o Sérgio pede atualização (som, notificação ou e-mail): basta atualizar em silêncio (Júlio, 2026-09-08).
- Plano do Júlio: levar tudo o que roda nesta máquina para uma **VM mais potente da empresa**.

## Regime Atacadista-ES (em pausa desde 2026-09-11)
- A Lube é aderida ao **Regime Atacadista** (Art. 16 da Lei 10.568/2016; arts. 534-Z-Z-A e 530-L-R-K do RICMS-ES):
  3 apurações (internas ES no DUA 121-0; fora do estado no 380-8, mais o adicional de 3,5% no 472-3; pessoas
  físicas/não contribuintes, DUA ainda não identificado). O painel calcula a não-cumulatividade simples.
- A planilha da Unicon é um **modelo em branco**: não há um mês preenchido para validar.
- **Fase 1 feita (2026-09-10):** `regime_atacadista.py` calcula em paralelo, **sem trocar o número do painel**. Toda
  linha cai em "não classificado" com o motivo, até confirmar os campos do WinThor; a classificação nunca é adivinhada.
- Referência: planilha **ATACADISTA (versão 15, out-2024)** da **Unicon** (contabilidade), na pasta local. Plano
  completo em `C:\Users\gti.julio.alves\.claude\plans\rippling-crunching-puddle.md`.
- O número do regime só vira o card depois de **bater com a Unicon em pelo menos 3 meses reais** (Júlio, 2026-09-10).
- Detalhe, as 9 perguntas e as fases seguintes: [[2026-09-10 — Regime Atacadista e a identidade V1 no Painel ICMS]].

## Decisões
- 2026-09-04 (Júlio): agente da segunda opinião **de graça, rápido e preciso** → Gemini; o Ollama local saiu.
- 2026-09-04 (Júlio): Git **só local** na pasta `PainelICMS`; o Claude commita depois de mudança relevante.
- 2026-09-04 (Claude): chave sempre em variável de ambiente, nunca no código; chave Gemini separada para o agente local.
- 2026-09-04 (Claude): a análise da IA vai no JSON `dados` que já existe, sem tabela nova; falha da IA não para o painel.
- 2026-09-08 (Júlio): no assistente do site, **só a API do Claude**.
- 2026-09-08 (Claude): Sonnet 5 em esforço baixo para caber nos 60 s do Hobby e responder rápido (~7 s contra ~15 s do Opus 5).
- 2026-09-08 (Júlio): **entrada/saída, nunca débito/crédito**.
- 2026-09-08 (Júlio): tirar os filtros "Com Redução · ICMS" e "Sem Redução · ICMS".
- 2026-09-08 (Júlio): nada de alerta quando o Sérgio pede atualização.
- 2026-09-10 (Júlio): Regime Atacadista em fases, sem trocar o número principal de uma vez.
- 2026-09-11 (Júlio): **Regime Atacadista em pausa**; foco em quanto o Sérgio paga de ICMS por mês.
- 2026-10-06 (Júlio): ICMS só para quem tem acesso pelo Painel Lube, com a proteção da Vercel nos deploys antigos.

## Pendências
- [ ] **Ponte sempre ligada** (serviço do Windows ou tarefa agendada). O Claude ofereceu; o Júlio decide. Hoje está desligada.
- [ ] Levar a ponte para a VM da empresa, quando houver a migração.
- [ ] **Fechar o banco:** religar o login próprio ou tirar as políticas TEMP e o acesso anônimo (projeto do Sérgio; conserto à parte).
- [ ] Mostrar `dados.analise_ia` no site (hoje só a ponte gera e grava).
- [ ] **Júlio:** o agente local segue no Gemini, mas a regra de 2026-09-08 diz "só Claude nesse painel". Vale só para o
  assistente do site ou troca o agente local também?
- [ ] Trocar "débito/crédito" por "entrada/saída" no `AGENTE_ICMS_Lube.md`, que o agente local lê (e avaliar os
  campos `debito`/`credito` do `regime_atacadista.py`).
- [ ] Assistente gerar planilha/relatório para baixar e executar código: combinado como passo separado, depois do login.
  O site já está fechado pela Sentinela desde 2026-10-06; o passo não foi feito.
- [ ] **Júlio:** alerta de gasto no console da Anthropic e conferir o custo real depois de ~2 semanas de uso.
- [ ] **Júlio:** avaliar remover a `GEMINI_API_KEY` antiga da Vercel (ela passou pelo chat em 2026-09-04: vale apagar
  a chave no Google AI Studio também).
- [ ] Atualizar as memórias do Claude Code do projeto (ainda dizem Gemini no site e pasta sem Git).
- [ ] Apagar a branch `sentinela` que sobrou no GitHub (tudo dela já está na `main`) — Júlio decide.
- [ ] Júlio/Sérgio: reiniciar o Windows uma vez para o `Painel.bat` enxergar a `GEMINI_API_KEY` nova (não confirmado).
- [ ] Repositório privado trava o deploy pelo Git: decidir entre público, plano Pro ou publicar sempre pela API.
- [ ] Aliases `-lube-distribuidora-ltda` e `-git-main` dependem só do guarda.
- [ ] Regime Atacadista (em pausa): planilha preenchida de um mês recente da Unicon, fases 2 em diante, a diferença de
  arredondamento da V1 e o que o card deve mostrar até o regime estar validado.
- [x] ICMS só com login do Painel Lube e proteção da Vercel nos deploys antigos (2026-10-06).
- [x] Clone local com remoto (2026-10-06).
- [x] Resposta da segunda opinião cortada (2026-09-10, 4.000 tokens).
- [x] Assistente do site estourando 60 s (2026-09-08, Sonnet 5).

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-07** — guarda da Sentinela 1.1.0 (reconhece robôs e não-navegadores); o push ficou `BLOCKED` e a produção saiu pela API (`dpl_oJwG8hhFsSqtjrtTWJUJYrFqiYdH`) (commit `fc0ad34`). O build local compilou e passou no TypeScript, mas parou no prerender por falta das variáveis do Supabase na máquina · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Vercel Authentication Standard ligada no projeto (`prod_deployment_urls_and_all_previews`): deploys antigos e prévias pedem login da Vercel · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Sentinela: `exige_login` ligado para `painel-icms`, sem rotas públicas; `/api/assistente` passa a dar 401 sem login; README atualizado (commit `3e9eacf`; deploy `BLOCKED` e sem republicar, por ser só README: entrou no ar junto com o `fc0ad34`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — guarda da Sentinela no `src/middleware.ts` em modo fechado e seção "Acesso" no README; feito na branch `sentinela` e levado à `main` por fast-forward. Previews: pelo Git, um `BLOCKED` e outro `ERROR` no build (o preview não tinha as variáveis do Supabase); um preview pela CLI saiu READY. Push `BLOCKED`, produção pela API (`dpl_2khibvK3VgvspUac3do26zjWPugK`) (commits `9e66866`, `55ad6d5`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — clone do repositório com remoto criado em `Desktop\BI\2. SERGIO LUBE\PAINEL-ICMS` · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-09-11** — Regime Atacadista posto em pausa pelo Júlio: o foco é quanto o Sérgio paga de ICMS por mês · [[2026-09-10 — Regime Atacadista e a identidade V1 no Painel ICMS]]
- **2026-09-10** — Regime Atacadista-ES, Fase 1: `regime_atacadista.py` em paralelo, avisos da V1 e do regime sem bloquear, planilha ATACADISTA da Unicon no Git local; `xlrd` instalado (commit `562f4bd`, pasta local) · [[2026-09-10 — Regime Atacadista e a identidade V1 no Painel ICMS]]
- **2026-09-10** — segunda opinião da IA: limite de 2.000 para 4.000 tokens; ponte religada e reiniciada (julho e o mês corrente reprocessados) (commit `7c4c118`, pasta local) · [[2026-09-04 — IA do Painel ICMS, assistente do site e a ponte do WinThor]]
- **2026-09-08** — segunda opinião da IA: limite de 500 para 2.000 tokens; `.gitignore` passa a ignorar `_ponte.log`; ponte religada (estava desligada) e reiniciada (commit `28f86fe`, pasta local) · [[2026-09-04 — IA do Painel ICMS, assistente do site e a ponte do WinThor]]
- **2026-09-08** — saem os filtros "Com Redução · ICMS" e "Sem Redução · ICMS" do gráfico de alíquota; deploy pelo Git READY (commit `7817909`) · [[2026-09-04 — IA do Painel ICMS, assistente do site e a ponte do WinThor]]
- **2026-09-08** — assistente: quebra de linha em bloco de código, "entrada/saída" no lugar de "débito/crédito", bolinha sobe para não cobrir o rodapé (commits `4e8aed6`, `513db74`, `31fe468`) · [[2026-09-04 — IA do Painel ICMS, assistente do site e a ponte do WinThor]]
- **2026-09-08** — assistente do site trocado de Gemini para Claude (SDK oficial, busca na web, cache de prompt); depois do timeout de 60 s, Sonnet 5 em esforço baixo e respostas diretas; `ANTHROPIC_API_KEY` cadastrada pelo Júlio na Vercel (commits `a979697`, `4eef69d`, `524bfc9`) · [[2026-09-04 — IA do Painel ICMS, assistente do site e a ponte do WinThor]]
- **2026-09-04** — Git só local na pasta `PainelICMS` (commit inicial com 56 arquivos); a ponte passa a gravar a segunda opinião da IA em `dados.analise_ia` (commit `401373e`, pasta local) · [[2026-09-04 — IA do Painel ICMS, assistente do site e a ponte do WinThor]]
- **2026-09-04** — agente da segunda opinião (o `agente_ia.py` vinha configurado para o DeepSeek pela NVIDIA): tentativa com Ollama local abandonada (lento sem GPU; desinstalado, ~8,4 GB liberados) e troca para o Gemini, com `GEMINI_API_KEY` própria no Windows · [[2026-09-04 — IA do Painel ICMS, assistente do site e a ponte do WinThor]]
- **2026-09-03** — filtro "Com Redução / Sem Redução" no gráfico de alíquota; o extrator separa cada faixa com e sem redução, com a trava V8 (commit `a17e98c`)
- **2026-09-03** — favicon e assistente virtual com Gemini (bolinha do Sérgio, markdown, rota com as regras fiscais), animações e aviso claro de cota esgotada (429) (commits `41b8615`, `fc6f664`)
- **2026-09-03** — login com senha (primeiro acesso por link define a senha), que não roda porque o login segue desligado (commit `8e117e3`; migração `preparar_login_com_senha`)
- **2026-09-03** — banco: bucket `planilhas`, coluna `planilha_path` e políticas TEMP para o anônimo; botão Exportar planilha (commit `5fd6c6b`; migrações `adicionar_planilha_e_bucket_storage`, `liberar_anon_temporariamente_login_desligado`)
- **2026-09-03** — painel reconstruído com o design real: logo, cores, layout e gráfico 3D interativo, com R$ nos rótulos (commits `afae7d7`, `1f95e8e`, `5fd6c6b`)
- **2026-08-28** — login do site desligado "temporariamente" porque o Wi-Fi da Lube bloqueava `supabase.co` (commit `2e89931`)
- **2026-08-28** — site criado: Next.js, login por e-mail, dashboard lendo do Supabase; projeto `painel-icms` na Vercel; banco com `periodos`, `pedidos_atualizacao` e acesso por e-mail permitido (commits `d77ee33`, `7dc3afa`, `35adefa`; migrações `criar_estrutura_painel_icms`, `restringir_acesso_por_email_permitido`)

Veja também [[Mapa de sistemas]], [[Supabase]], [[Vercel]], [[SENTINELA LUBE]], [[Claude]].
