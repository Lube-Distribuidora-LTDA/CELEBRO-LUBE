---
tipo: app
departamento: TI
status: em uso
tags: [aplicacao, cerebro]
---
# Claude

Lê e escreve no [[Cérebro da Lube]] seguindo o [[CLAUDE.md]]. Usa as skills [[registrar-conversa]], [[data-warehouse]] e [[video-motion]].

## Por onde o Claude grava no cérebro
- **Claude Code, no computador do Júlio:** grava **direto na pasta sincronizada do OneDrive**
  (`C:\Users\gti.julio.alves\OneDrive - Lube\CEREBRO DA LUBE`). É o caminho usado desde 2026-09-23 (Júlio: usar
  a pasta sincronizada quando estiver no computador).
- **claude.ai (navegador):** pelo conector do Microsoft 365, como ficou decidido na
  [[2026-09-23 — criação do Cérebro da Lube|criação do cérebro]]. _Até 2026-10-09 esta nota dava esse como o
  único caminho._
- Em 2026-10-09 o Claude Code também tinha o conector do Microsoft 365 (Outlook, SharePoint, Teams), mas ele
  não é usado para gravar o vault.

## Skills
- **`data-warehouse`:** instalada na conta; no Claude Code aparece como `anthropic-skills:data-warehouse`. O
  texto também está em [[data-warehouse]]. Em 2026-10-09 era a única skill da conta feita para a Lube (as
  outras são as padrão da Anthropic).
- **`registrar-conversa`:** **não está instalada** no Claude Code. Chamar pelo nome dá "Unknown skill"
  (2026-09-24 e 2026-09-30). O Claude lê `Skills/registrar-conversa/registrar-conversa.md` e segue à mão
  ([[2026-09-24 — A skill registrar-conversa fora do Claude Code]]).
- **`video-motion`** (desde 2026-10-16): só no vault, **não está instalada** no Claude Code. Para fazer ou refazer um
  vídeo animado da Lube, o Claude lê `Skills/video-motion/video-motion.md` e segue à mão ([[video-motion]]).

## Claude Code nesta máquina (conferido em 2026-10-09)
| O quê | Situação |
|---|---|
| App desktop | binários próprios em `%APPDATA%\Claude\claude-code\`: 2.1.289 (desde 2026-10-06) e 2.1.293 (desde 2026-10-07 15:56) |
| `claude` do PATH | npm global (`AppData\Roaming\npm`), **2.1.267** — atualizado de 2.1.245 em 2026-09-10 e parado desde então. Reprova até o exemplo oficial de mod: **não usar para validar** ([[MOD BARRA LUBE]]) |
| Configuração do usuário | `~/.claude/settings.json` (última alteração 2026-10-01 15:39): modelo padrão `opus[1m]`, esforço `high`, tema escuro, atualização pelo canal `latest`, plugin `cloudflare` ligado |
| Plugin Cloudflare | `cloudflare@cloudflare` 1.0.0 (marketplace `cloudflare/skills`), escopo do usuário, instalado em 2026-08-28. Os conectores dele (API, builds, bindings, observability) **pedem autorização do Júlio** (`/mcp`): pediam em 2026-10-08 e ainda em 2026-10-09 |
| Mods | `~/.claude/dev-mods/`: só o [[MOD BARRA LUBE]], numa pasta com o id da sessão em que nasceu |
| Python | 3.12.10 em `AppData\Local\Programs\Python\Python312` (instalado em 2026-08-26). `python` acha ele; **`python3` cai no atalho da Microsoft Store**. Em 2026-09-23 o `python` do Git Bash abriu o atalho da Store; em 2026-09-30 o caminho completo resolveu |
| Node | 24.19 em `C:\Program Files\nodejs` |

### Modelo
O Júlio escolhe o modelo pelo `/model`. Em 2026-09-10 salvou o **Sonnet 5** como padrão; em 2026-10-09 o
padrão salvo é **`opus[1m]`**. Todas as trocas registradas em [[2026-09-10 — Modelo padrão do Claude Code]].

### Memória do Claude Code (fora do cérebro)
Cada pasta de projeto tem memória própria em `~/.claude/projects/<pasta>/memory/`, que só vale para conversas
abertas naquela pasta. Em 2026-10-09 três tinham conteúdo, sem nenhuma chave gravada:

| Pasta | Desde | Arquivos |
|---|---|---|
| `2. SERGIO LUBE\PainelICMS` | 2026-09-04 | `arquitetura_painel_icms.md`, `assistente_virtual_gemini.md`, `chave_gemini_compartilhada.md` (a cota da chave, não a chave) — ver [[PAINEL ICMS]] |
| `3. ARAUJO` | 2026-09-10 | `feedback_push_github_sempre.md` (push sem esperar pedido), `projeto_gestao_saida_veiculos.md` — ver [[GESTÃO DE SAÍDA DE VEÍCULOS]] |
| `5. GESTÃO TI` | 2026-09-15 | `padrao-sistemas-lube.md`, `gestao-ti-lube.md`, `infra-lube-locaweb-vercel.md` — ver [[2026-09-15 — Memória do Claude Code e a variável do Windows]] |

Cada uma tem também o índice `MEMORY.md`. As pastas do Painel Lube, RH, COMPRAS e do cérebro têm memória vazia.
**O cérebro é a memória oficial:** o que só existir lá precisa vir para cá.

### Servidores locais do cérebro (`.claude/launch.json`)
Configurações que o Claude usa para abrir um sistema no navegador do app. Sem segredo nenhum.

| Nome | O que roda | Porta | Desde |
|---|---|---|---|
| `painel-lube` | `python -m http.server` na pasta do [[PAINEL LUBE DISTRIBUIDORA]] (para ver `/sentinela/?demo=1`) | 4321 | 2026-10-06 |
| `sac` | `node ...\10. SAC\web\servidor_local.js` ([[SAC]]) | 3110 | 2026-10-07 (até 2026-10-09 chamava `saq`, com a pasta `10. SAQ`) |
| `trade` | `node ...\11. TRADE\web\servidor_local.js` ([[GESTÃO COMERCIAL TRADE]]) | 8700 | 2026-10-14 |

- `reposicoes-teste` (`node servidor_local.js`, porta 3101) entrou e saiu a cada rodada de teste do
  [[REPOSIÇÕES E CHAMADOS]] em 2026-10-06 e 2026-10-07. Não fica no arquivo.
- História em [[2026-10-06 — Servidores locais e permissões do Claude Code]].

### Permissões
- **As permissões do Claude Code são decisão do Júlio.** O Claude não grava as próprias regras: em 2026-10-06 a
  tentativa de criar `.claude/settings.local.json` no cérebro foi recusada pelo classificador
  ("Self-Modification") e o arquivo não existe. O Júlio trocou o modo de permissão da conversa.
- No modo automático, o classificador recusa ação de produção vinda de agente auxiliar ("Production Deploy"),
  mesmo com a autorização do Júlio no chat (2026-10-06, [[SENTINELA LUBE]]). Também barrou migrações na
  [[GESTÃO DE SAÍDA DE VEÍCULOS]] (2026-09-10) e o commit da folha (2026-09-24, [[SISTEMA FINANCEIRO]]).

### Armadilhas desta máquina
- Variáveis `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no ambiente do Windows apontam para o PAINEL ICMS e
  vencem o `.env.local` de qualquer projeto local — ver [[Supabase]].
