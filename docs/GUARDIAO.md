# Guardião da Lube — o robô garante as rotinas e a saúde dos sistemas (especificação, 2026-10-14)

Pedido do Júlio:
> "preciso que esse robô garanta meus processos, por exemplo, precisa validar todas as rotinas se rodaram e se
> subiram as informações corretamente, preciso que ele garanta a saúde do sistema, tudo precisa estar atualizando e
> funcionando e quem vai garantir é ele."

Decisões do Júlio (2026-10-14): **alerta por Telegram** (mesmo bot do resumo do Gestão TI) · **tentar de novo 1 vez
e avisar** · **vigia na VM SRV-IA** para conferir com o WinThor · **saúde também no arquivo baixado** (chave de leitura).

Regras da casa que mandam aqui: **alarme falso é pior que nenhum alarme**; **nada pode sumir em silêncio**; **prove,
não afirme**; senha/token/chave **nunca** em código, nota ou log — o Júlio cadastra; o Claude não lê valores de segredo.

---------------------------------------------------------------------------------------------------
## 1. Peças e onde moram

| Peça | Onde | Faz |
|---|---|---|
| **Banco** — schema `saude` | Supabase **DATA WAREHOUSE** (`ivcnotrynogaljrvvyes`) | catálogo do que vigiar, estado atual, incidentes, conferências, pedidos de correção, avisos; função `saude.verificar()` |
| **Agendador** | `pg_cron` no DW | `saude.verificar()` de 5 em 5 min; chama a função `guardiao` de 10 em 10 min (`pg_net`) |
| **Função `guardiao`** | Edge Function no DW (`verify_jwt=false`, autenticação própria) | testa os 10 sites, lê o robô do Gestão TI, manda Telegram (abertura, volta, resumo das 07:40), serve o resumo para o arquivo baixado |
| **RPC `public.saude_robo()`** | Supabase **GESTAO TI** (`mpupmrzcbygwpblrewrb`) | devolve só tipo, horários, sucesso e contagens das execuções do robô (48 h), **sem o texto de erro**; única exceção ao "anon revogado" do Gestão TI, para não levar a chave de serviço dele para outro projeto |
| **Vigia da VM** | VM **SRV-IA** (`C:\BI\GUARDIAO`, editado em `P:\INTEGRAÇÃO BI\GUARDIAO`) | batimento, tarefas agendadas, servidor de margem, disco, **conferência com o WinThor**, executa os pedidos de correção, alerta direto se o Supabase sumir |
| **Painel do robô** | artifact + arquivo baixado | chip de saúde, painel Saúde, rotinas e funil com a cor do estado, robô reagindo, ferramenta `ver_saude` no "Pergunte ao cérebro" |
| **Código versionado** | `C:\Users\gti.julio.alves\Desktop\BI\11. GUARDIAO` (git local, sem remoto por enquanto) | `db/`, `supabase/functions/guardiao/`, `vm/`, `README.md` |

---------------------------------------------------------------------------------------------------
## 2. Banco: schema `saude` (migração `saude_v1`)

Tudo com RLS ligado e **sem política** (ninguém de fora lê/escreve direto); funções `security definer` com
`set search_path = saude, public, pg_temp`, `revoke all ... from public, anon, authenticated`, `grant execute ... to
service_role` (a VM entra pelo usuário do banco das ETLs, que já é dono). Horários sempre em `America/Sao_Paulo`.

Tabelas:
- `saude.alvo` — catálogo: `id text pk` (ex.: `rotina:bi-compras-sync-rapidas`, `site:painel-compras`, `vm:SRV-IA`,
  `servico:margem`, `tarefa:<nome>`), `tipo` (rotina | site | vm | servico | tarefa | conferencia), `nome` (como a
  pessoa reconhece), `sistema` ("BI Compras", "BI Comercial", "Reposições", "Gestão TI", "Folha", "Portal"…),
  `nota` (nome exato da nota do vault: a rotina em `Rotinas/` ou o projeto), `config jsonb`, `ativo bool`, `ordem int`.
  - `config` de rotina com fonte `controle_carga`: `{fonte:'compras.controle_carga', consultas:[...], horarios:['07:50',...],
    dias:null|[1..7] (ISO), tolerancia_min, duracao_max_min, variacao_queda (0.6), conferir:[consultas com carga
    completa], conferir_origem:[consultas leves], conferir_origem_noite:[pesadas], tarefa_windows:'<nome exato da
    tarefa no Agendador>', maquina:'SRV-IA', pode_corrigir:true, correcao_janela:['00:00','23:59']|['00:00','07:20']}`.
  - **Os horários, consultas e nomes de tarefa saem das notas de `Rotinas/` (frontmatter `frequencia`, linhas
    "Quando/Onde", seção `## Fluxo`) e do histórico real de `controle_carga` (quais consultas rodam juntas em cada
    horário). Nada chutado: o que não se sabe fica `null` e a verificação diz "a confirmar".**
- `saude.verificacao` — estado atual: `alvo_id pk`, `status` (ok | atencao | falha | sem_dado | desligado),
  `resumo text` (uma frase em português: "Rodou às 07:50, 12 de 12 consultas OK, 59.212 linhas"),
  `detalhe jsonb` (por consulta: status, linhas, mediana, conferência; e `etapas`: estado por tipo de etapa do funil
  — `{gatilho, le, processa, grava, confere, entrega}` cada um ok|atencao|falha|sem_dado), `ultima_execucao`,
  `proxima_execucao`, `verificado_em`, `desde` (desde quando está nesse status).
- `saude.incidente` — `id`, `alvo_id`, `status` (atencao | falha), `resumo`, `aberto_em`, `fechado_em`,
  `avisado_abertura_em`, `avisado_fechamento_em`, `correcao_pedida_em`, `correcao_resultado`, `ultimo_resumo`.
  Abre quando o status sai de ok/sem_dado para atencao/falha; piora atencao→falha no mesmo incidente; fecha quando
  volta a ok. Um incidente aberto por alvo, no máximo.
- `saude.batimento` — `origem pk` (`vm:SRV-IA`), `em`, `versao`, `info jsonb` (máquina, disco livre, uptime).
- `saude.conferencia` — `id`, `sistema` (schema), `consulta`, `tabela_destino`, `carga_id` (id do controle_carga),
  `carga_em`, `linhas_carga`, `linhas_destino`, `linhas_origem`, `conferido_em`, `status`, `mensagem`.
- `saude.pedido_correcao` — `id`, `alvo_id`, `incidente_id`, `tarefa_windows`, `maquina`, `pedido_em`,
  `atendido_em`, `resultado`.
- `saude.aviso` — `id`, `em`, `tipo` (abertura | fechamento | resumo_diario | teste | vm_fora), `texto`, `ok`, `erro`.

Funções:
- `saude.verificar() returns jsonb` — avalia **no banco** todos os alvos que dependem só do banco (rotinas de
  `controle_carga`, `reposicao.painel_cache`, folha mensal, batimento da VM, conferências) e grava `verificacao`
  e `incidente`. Idempotente, rápida (só lê `controle_carga` recente com índice por `executado_em`).
- `saude.registrar(itens jsonb) returns jsonb` — a função `guardiao` e a VM mandam o resultado das checagens que
  o banco não faz (sites, Gestão TI, tarefas, servidor de margem, disco); mesma lógica de incidente.
- `saude.batida(origem text, versao text, info jsonb)`, `saude.pedidos_pendentes(maquina text)`,
  `saude.atender_pedido(id bigint, resultado text)`, `saude.registrar_conferencia(jsonb)`.
- `saude.avisos_pendentes() / saude.marcar_aviso(...)` — o que a função `guardiao` precisa mandar no Telegram.
- `saude.painel() returns jsonb` — tudo o que o painel do robô mostra (formato no §6).
- `saude.chave_confere(nome text, valor text) returns boolean` — compara com o segredo do Vault (`guardiao_cron`
  ou `guardiao_chave_leitura`) sem expor o valor. O `guardiao_cron` é **criado pela própria migração** com
  `gen_random_bytes` (ninguém precisa ver); o `guardiao_chave_leitura` quem cria é o Júlio (§8).

### Regras de avaliação das rotinas (o coração; errar aqui = alarme falso)
- Ocorrência esperada `o` = o último horário de `horarios` (no dia/dia da semana certo) com `o + tolerancia_min ≤ agora`.
  Antes disso, nada é julgado (a carga ainda pode estar rodando).
- **ok**: toda consulta da rotina tem execução `OK` em `[o − 3 min, próxima ocorrência)`.
- **falha**: alguma consulta com `ERRO` nessa janela e sem `OK` depois; ou nenhuma execução até `o + tolerancia`
  ("Não rodou às 02:50"); ou `linhas = 0` quando a mediana das últimas 10 execuções OK é > 0.
- **atencao**: rodou, mas com atraso > tolerância; ou durou mais que `duracao_max_min`; ou caiu mais que
  `variacao_queda` contra a mediana das últimas 10 OK (só **queda**; subida só acima de 3×); ou a conferência deu
  atenção. **Ignorar** o "ATENCAO: o Power BI tinha X linhas" das mensagens (comparação antiga e fixa, que daria
  âmbar todo dia — alarme falso).
- O `status` do `controle_carga` vem em **maiúsculas** (`OK`, `ERRO`): comparar sem caixa.
- `resumo` sempre diz o fato em uma frase, com horário e números; nunca "erro desconhecido".
- Rotina sem horário fixo (Servidor de margem "sempre no ar", Aquecer painel "a cada 5 min"): regra própria
  (serviço respondendo na VM; `painel_cache.gerado_em` com menos de 20 min entre 06:00 e 23:30).
- Folha mensal: atenção se até o dia 15 do mês a competência anterior não foi importada (confira o "Quando" da nota
  [[Validação mensal da folha]]); é rotina de pessoa, então nunca "falha" de madrugada.
- Kanban TI: não é rotina automática → `desligado` com o resumo "Sem execução automática para vigiar".
- **VM:** sem nenhum batimento ainda → `sem_dado` ("O vigia da VM ainda não foi instalado") e **nada de alarme**;
  depois do primeiro batimento, batimento com mais de 35 min → `falha` ("O vigia da VM SRV-IA parou de responder às
  HH:MM"). Rotina que não rodou com a VM sem batimento: o resumo diz que provavelmente a VM caiu.

### Correção automática (decisão do Júlio: tentar 1 vez e avisar)
- Incidente de **falha** em rotina com `tarefa_windows`, `pode_corrigir` e agora dentro de `correcao_janela`, e
  `correcao_pedida_em` nulo → grava **um** `pedido_correcao` (para a `maquina`). A VM executa na rodada seguinte
  (`Start-ScheduledTask`) e responde. A tranca de carga do `bi_comum.py` impede carga em dobro.
- Pesadas (faturamento, margem_item) só de madrugada (`correcao_janela` termina 07:20), para não pesar no Oracle no
  expediente. Nunca mais de 1 tentativa por incidente.

---------------------------------------------------------------------------------------------------
## 3. Agendador (pg_cron + pg_net no DW)
- Habilitar as extensões `pg_cron` e `pg_net`.
- `saude-verificar`: `*/5 * * * *` → `select saude.verificar();`
- `saude-guardiao`: `*/10 * * * *` → `net.http_post` para `https://ivcnotrynogaljrvvyes.supabase.co/functions/v1/guardiao/rodar`
  com o cabeçalho `x-guardiao` lido do Vault (`guardiao_cron`), corpo `{}` e timeout de 30 s.
- Limpeza diária: `saude.aviso`, `saude.conferencia` e incidentes fechados com mais de 90 dias.

---------------------------------------------------------------------------------------------------
## 4. Função `guardiao` (Edge Function no DW, Deno/TypeScript)
- `POST /rodar` — só com `x-guardiao` válido (`saude.chave_confere`). Faz, nesta ordem, com `Promise.allSettled` e
  timeout de 8 s por chamada:
  1. **Sites**: `GET <site>/.sentinela/saude` dos sistemas: painel-lube-distribuidora, painel-compras-rosy,
     gestao-comercial-web-three, gestao-finaceiro, rh-absentismo, gestao-de-saidas-de-veiculos, painel-icms,
     gestao-ti-ruddy, sac-lube (todos `.vercel.app`) e `reposicoes-web.vercel.app/` (não tem guarda: 200 na página).
     200 com `lista.ok` = ok; 200 sem lista = atenção ("guarda sem a lista da central"); erro/timeout = falha. Essa rota
     da Sentinela é atendida antes de qualquer regra e não registra evento: pode ser chamada de 10 em 10 min.
     User-agent `Guardiao-Lube/1.0`.
  2. **Gestão TI**: RPC `saude_robo` do projeto GESTAO TI com a **chave publicável** dele (pública, pode ir no código).
     Leitura esperada todo dia ~08:00–08:30 (aceitar até 10:00); cobrança ~09:00–09:30 (até 11:00); `sucesso=false`
     = falha.
  3. `saude.registrar(...)` com os resultados; `saude.verificar()`.
  4. **Avisos** (`saude.avisos_pendentes`): abertura e volta de incidente; vários de uma vez viram **uma** mensagem;
     resumo diário às **07:40** (uma vez por dia): "Bom dia. Noite: … Agora: X de Y em dia." Entre 22:00 e 06:30
     manda com `disable_notification` (chega sem tocar). Sem segredo do Telegram: grava o aviso com
     `ok=false, erro='Telegram ainda não configurado'` e segue.
  - `?simular=1`: faz tudo menos mandar Telegram e devolve o que mandaria.
- `GET /resumo` — com `x-chave-leitura` válida → `saude.painel()`. Sem a chave cadastrada no Vault → 503 com
  `{erro:'chave-nao-cadastrada'}`; chave errada → 401. CORS: `Access-Control-Allow-Origin: *`, cabeçalho
  `x-chave-leitura` permitido, `OPTIONS` respondido (o arquivo baixado abre como `file://`, origem `null`).
- `POST /teste-telegram` (com `x-guardiao`) → manda "Guardião da Lube ligado ✅" e devolve ok/erro.
- Segredos lidos do ambiente (o Júlio cadastra em Supabase › Edge Functions › Secrets): `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já vêm prontos. Nunca logar valores.
- Mensagem do Telegram: no estilo do resumo do Gestão TI (ver a nota [[Gestão TI - Resumo diário no Telegram]]):
  "🔴 BI Compras · Sync faturamento — não rodou às 02:50. Vou tentar de novo às 03:20." / "✅ Voltou: … tentei de
  novo às 03:20 e deu certo (261.920 linhas)." / "🟠 …" para atenção.

---------------------------------------------------------------------------------------------------
## 5. Vigia da VM (`guardiao_vm.py`, Python, igual às ETLs)
- Estrutura igual à do REPOSICOES em `P:\INTEGRAÇÃO BI\GUARDIAO`: `1 - CONFIGURACAO\ENV.example`,
  `2 - SISTEMA GUARDIAO\` (`guardiao_vm.py`, `bi_comum.py` — copiar a versão mais nova, com timeouts e tranca),
  `3 - INSTALACAO\instalar_e_agendar.ps1`, `INSTALAR TUDO.bat`, `LEIA-ME.txt`. Instala em `C:\BI\GUARDIAO` e cria a
  tarefa **"Guardiao - Vigia"** de 15 em 15 min, modo senha guardada (como as outras). **Instalar só na SRV-IA.**
- ENV: as mesmas variáveis do banco das ETLs (`SUPABASE_DB_*`) e do Oracle de leitura (`ORACLE_*`); opcionais
  `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` para o alerta direto. Nomes conferidos nos `ENV.example` existentes.
- A cada rodada (com tempo máximo de 4 min e trava contra rodada dupla):
  1. `saude.batida('vm:SRV-IA', versao, {maquina, disco_livre_gb, disco_livre_pct, uptime})`.
  2. **Tarefas**: PowerShell `Get-ScheduledTask` + `Get-ScheduledTaskInfo` (saída JSON) das tarefas citadas em
     `config.tarefa_windows` + a própria → `tarefa:<nome>`: último resultado ≠ 0 = falha (com o código), desativada =
     atenção, não encontrada nesta máquina = atenção.
  3. **Servidor de margem**: `GET http://localhost:8080/` (200/302/401 = no ar) → `servico:margem`.
  4. **Disco**: C: com menos de 10% livre = atenção, menos de 3% = falha.
  5. **Conferência** das cargas `OK` ainda não conferidas: (a) **integridade**, para as `conferir` (carga completa):
     `count(*)` do destino = `linhas` da carga → senão falha; (b) **origem**, para as `conferir_origem` (leves, a qualquer
     hora) e `conferir_origem_noite` (pesadas, só 01:00–06:30): `SELECT COUNT(*) FROM (<sql da consulta>)` no Oracle,
     com timeout de 60 s, contra o destino; diferença ≤ 1% ou ≤ 20 linhas = ok (dado vivo muda entre a carga e a
     conferência), até 5% = atenção, acima = falha. O SQL de cada consulta vem do catálogo do próprio sistema
     (`consultas_<sistema>.py` em `C:\BI\<SISTEMA>\`), importado sem rodar a carga.
  6. **Pedidos de correção** desta máquina: `Start-ScheduledTask -TaskName …` → `saude.atender_pedido`.
  7. Supabase fora por mais de 30 min (estado num arquivo local): manda Telegram direto, se o ENV tiver o token.
- `--teste`: roda tudo **sem gravar nada** e sem disparar tarefa, imprimindo o que faria (para testar fora da VM).
- Log em `C:\BI\GUARDIAO\guardiao.log` com rotação; nunca loga senha.

---------------------------------------------------------------------------------------------------
## 6. O que o painel recebe — `saude.painel()`
```
{ "verificado_em": "...", "geral": {"status":"ok|atencao|falha", "ok":12, "atencao":1, "falha":0, "sem_dado":1, "total":14},
  "telegram": {"configurado": true|false, "ultimo_aviso_em": "..."},
  "vm": {"origem":"vm:SRV-IA", "em":"...", "info":{...}} | null,
  "itens": [ {"id","tipo","nome","sistema","nota","status","resumo","ultima_execucao","proxima_execucao","desde",
              "detalhe":{ "consultas":[...], "etapas":{"gatilho":"ok","le":"ok","processa":"ok","grava":"ok","confere":"sem_dado","entrega":"ok"} } } ],
  "incidentes": { "abertos":[{"id","alvo_id","nome","status","resumo","aberto_em","correcao_pedida_em","correcao_resultado"}],
                  "recentes":[ ...últimos 15 fechados com fechado_em... ] } }
```
`itens[].nota` = nome da nota do vault, para o painel ligar a verificação à rotina da aba Rotinas e ao funil.

---------------------------------------------------------------------------------------------------
## 7. Painel do robô (artifact + arquivo baixado)
- **`js/saude.js`** (novo): `criarSaude({onDados, onEstado})` → `{ atualizar(), parar(), modo }`.
  - **No claude.ai (artifact):** `await claude.use('mcp')` → `callTool('Supabase', 'execute_sql', {project_id:
    'ivcnotrynogaljrvvyes', query: 'select saude.painel() as p'})` — só esse SELECT fixo; ler o JSON do resultado
    (o texto vem embrulhado em `<untrusted-data-…>`: extrair o array/objeto entre as marcas). Tipos oficiais em
    `…\artifact-capabilities\0.2.54\mcp.d.ts` e `claude.d.ts` (ler antes). O artifact passa a declarar
    `capabilities: {sample:{}, mcp:{servers:[{server:'Supabase', tools:['execute_sql']}]}}` (o Claude principal faz o
    publish). `null`/recusa → o chip mostra "Saúde indisponível" com o motivo.
  - **No arquivo baixado e em localhost:** `fetch(<guardiao>/resumo, {headers:{'x-chave-leitura': chave}})`; a chave é
    pedida num cartão ("Chave de leitura do Guardião") e fica só na aba (sessionStorage, try/catch); no localStorage só
    com "Lembrar neste computador" marcado (no file:// todo arquivo local do navegador lê o localStorage); 503 = "o Júlio
    ainda não cadastrou a chave"; 401 = "chave errada". Em `localhost`, se existir `api/saude` (arquivo de teste),
    usar ele.
  - Atualiza a cada 60 s com a página visível; pausa oculta.
- **Chip de saúde** na barra de cima: "● Tudo em dia" (verde `--ok`) / "● 2 atenções" (âmbar) / "● 1 falha"
  (vermelho) / "● Sem dados" (cinza), com "verificado há 3 min". Clique abre o **painel Saúde**.
- **Painel Saúde** (mesma moldura holográfica do leitor/funil, à direita; folha de baixo no celular): resumo no topo
  (contagens, Telegram configurado ou não, VM), **incidentes abertos** primeiro (com a correção tentada), depois as
  seções **Rotinas**, **Sistemas no ar**, **VM SRV-IA** (tarefas, margem, disco) e **Conferência com o WinThor**, e no
  fim **Últimos incidentes** (linha do tempo). Clicar numa rotina abre o funil dela.
- **Aba Rotinas:** a bolinha de cada rotina passa a ser a da saúde, com "última: hoje 07:55 · 12/12 OK".
- **Funil:** cada etapa ganha o selo do estado (`detalhe.etapas[tipo]`): ok, atenção, falha, sem dado, com o motivo;
  o cabeçalho mostra o resumo da verificação.
- **Robô:** tudo ok → normal; atenção → cúpula com um leve tom âmbar e olhar preocupado de vez em quando; falha →
  tom vermelho, expressão `alerta` periódica olhando para o chip; incidente novo com a página aberta → `surpreso` +
  aviso na tela + clarão vermelho na cúpula; incidente fechado → `feliz`. Sem dados → normal (não assustar).
- **Pergunte ao cérebro:** ferramenta nova `ver_saude` (devolve o `saude.painel()` resumido), para perguntas como
  "está tudo rodando?".
- Nada disso pode quebrar o que existe (robô, leitor, funil, mãos, anéis, celular, reduced motion).

---------------------------------------------------------------------------------------------------
## 8. O que fica com o Júlio (dizer no fim, em passos curtos)
1. Telegram: em Supabase (DATA WAREHOUSE) › Edge Functions › Secrets, cadastrar `TELEGRAM_BOT_TOKEN` e
   `TELEGRAM_CHAT_ID` (os mesmos do Gestão TI na Vercel). Depois, um teste: botão/SQL `select saude.testar_telegram()`.
2. Chave de leitura do arquivo baixado: no SQL Editor do DATA WAREHOUSE, gerar no próprio banco (a chave não fica
   escrita no histórico do SQL Editor) com
   `select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'guardiao_chave_leitura');`, ler uma vez em
   `vault.decrypted_secrets` e digitar no arquivo. Chave com menos de 32 caracteres não vale (`saude.chave_confere` e a
   função recusam). (2026-10-14, correção final)
3. Na VM SRV-IA: rodar `P:\INTEGRAÇÃO BI\GUARDIAO\INSTALAR TUDO.bat` (como os outros) e conferir o primeiro batimento.
4. Conferir em DATA WAREHOUSE › Settings › API › Exposed schemas que `net` não está exposto (o cabeçalho `x-guardiao`
   passa pela fila do pg_net, aberta a PUBLIC); não revogar o PUBLIC do schema `net` sem testar.

## 9. Critérios de pronto
- Rodando de verdade no DW: as duas tarefas do pg_cron ativas; a função `guardiao` publicada; `saude.painel()`
  mostrando o estado real de hoje **sem nenhum alarme falso** (conferir regra por regra contra os últimos 7 dias:
  a falha do faturamento de 2026-10-11 03:05 teria sido pega; as cargas normais não).
- Simulação de falha **dentro de transação com ROLLBACK** (nunca dado falso gravado em produção): incidente abre,
  pedido de correção sai, volta fecha.
- Painel mostra a saúde (com o arquivo de teste `api/saude` gerado do `saude.painel()` real) e o robô reage.
- Vigia da VM roda em `--teste` nesta máquina sem gravar nada e sem consulta pesada no Oracle.
- Nada de segredo em código, nota, log ou resposta; nenhuma senha lida.
