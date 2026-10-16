---
tipo: rotina
status: ativo
frequencia: "08:00 e 09:00 (horário de Brasília), todo dia"
tags: [ti, gestao-ti, imap, cobranca, vercel]
---
# Gestão TI - Leitura de e-mail e cobrança

**Quando:** 11:00 e 12:00 UTC — **08:00 e 09:00 em Brasília**, todo dia.
**Onde:** cron da [[Vercel]], no projeto [[GESTÃO TI]]. Funções na região `gru1`, ao lado do banco em São Paulo.

| Horário | O que faz |
|---|---|
| 08:00 | `/api/cron/ler-emails` — lê a caixa `cpd@` na [[Locaweb]], reconhece os documentos e prende cada um à competência certa |
| 09:00 | `/api/cron/cobrar` — abre as competências do mês, cobra por e-mail quem ainda não mandou nota ou boleto e, no fim, manda o [[Gestão TI - Resumo diário no Telegram\|resumo no Telegram]] |

A leitura vem uma hora antes para que a cobrança já saiba o que chegou naquela manhã — senão o sistema cobraria documento que acabou de ser recebido.

**Abrir as competências** (`gerar_faturas_competencia`, no banco) foi para dentro da cobrança porque o Hobby só dá dois crons; a função é idempotente, então rodar todo dia não duplica nada. **Até 2026-10-06 esse passo falhava todo dia sem aparecer** — `null` explícito no lugar do DEFAULT e um `catch` vazio em volta. Agora o erro volta na resposta da rota. Ver [[2026-10-07 — Kanban TI e o mês que nunca abria]].

## Fluxo
1. **Gatilho** · cron da [[Vercel]] às 08:00 e 09:00 (Brasília), todo dia; passa pela [[SENTINELA LUBE]] com o `CRON_SECRET` no cabeçalho
   - Fora de hora: botões da tela **Robô** ("Ler webmail agora"; só a cobrança pede confirmação)
   - **Atenção:** a leitura das 08:00 ainda não foi conferida como "ROBÔ VERIFICADO" no painel da Sentinela
2. **Lê** · 08:00, `/api/cron/ler-emails`: caixa `cpd@` na [[Locaweb]] por IMAP, últimos 12 dias, percorrida pelo fim (sem `SEARCH SINCE`)
   - **Atenção:** limite de mensagens por execução (60 s no Hobby); o que sobra aparece na tela como "N sem ler"
3. **Confere** · só aceita remetente cadastrado no fornecedor (barra os boletos falsos) e descarta o e-mail já processado antes de baixar
   - **Atenção:** fornecedor com a lista de remetentes vazia nunca é lido (Alterdata e Top Link Rio, ver [[GESTÃO TI]])
4. **Processa** · reconhece nota, boleto e recibo e lê valor, vencimento e competência de dentro do documento ([[Notas, boletos e recibos]])
5. **Grava** · prende cada documento à competência certa no [[Supabase]] `gestao-ti`
6. **Processa** · 09:00, `/api/cron/cobrar`: abre as competências do mês com `gerar_faturas_competencia` (idempotente, não duplica)
   - **Se falhar:** o erro volta na resposta da rota; até 2026-10-06 falhava todo dia sem aparecer (`catch` vazio)
7. **Avisa** · cobra por e-mail quem ainda não mandou nota ou boleto, como "Assistente Virtual TI", e guarda a cópia em Enviados por IMAP
   - **Atenção:** não cobra fatura paga, entregue ou cancelada, fornecedor de canal WhatsApp nem conta com a cobrança desligada
8. **Entrega** · documentos nas competências do painel do [[GESTÃO TI]] e, no fim das 09:00, o [[Gestão TI - Resumo diário no Telegram|resumo no Telegram]]

## Como a cobrança escreve
Assinada como **"Assistente Virtual TI"**, numa faixa em HTML (não imagem, que o programa de e-mail bloqueia). O tom sobe a cada tentativa: a 1ª é cordial, a 2ª reitera, da 3ª em diante vai com **[URGENTE]**. A mensagem é montada uma vez, enviada e guardada em **Enviados** por IMAP, igual ao que o fornecedor recebeu. Não cobra fatura paga, entregue ou cancelada, nem fornecedor de canal WhatsApp, nem conta com a cobrança desligada no cadastro (as assinaturas de IA).

## Como o agendador entra
Desde 2026-10-07 o sistema está atrás da [[SENTINELA LUBE]], sem nenhuma rota aberta. O agendador da Vercel passa porque traz `Authorization: Bearer` com o `CRON_SECRET`, conferido no middleware. O `?secret=` na URL deixou de valer; para rodar fora de hora, use os botões da tela **Robô** ("Ler webmail agora"; só a cobrança pede confirmação). A rodada de cobrança de 2026-10-07 às 09:27 passou pela Sentinela e funcionou. **A leitura das 08:00 ainda não foi conferida** no painel da Sentinela como "ROBÔ VERIFICADO" (pendência em [[SENTINELA LUBE]]).

## Limites do plano Hobby
**Dois crons, uma execução por dia cada, 60 segundos por função.** É o que define o desenho: a varredura tem limite de mensagens por execução e avisa na tela quantas ficaram de fora ("N sem ler", em âmbar), em vez de tentar ler tudo e estourar o tempo.

## Como a leitura funciona
- Olha os últimos **12 dias** (`configuracoes`; subiu para 45–60 só nas cargas e reprocessamentos de 15 e 16/09).
- **Não usa `SEARCH SINCE` nem `SEARCH FROM`** da [[Locaweb]], que devolvem resultado errado: percorre a caixa pelo fim, em ordem de chegada, e corta pela data interna de cada mensagem — o cabeçalho `Date` vem forjado em spam.
- Só considera **remetente cadastrado** no fornecedor. É o que barra os boletos falsos, e também por que fornecedor com a lista de remetentes vazia nunca é lido.
- Descarta os e-mails **já processados antes de baixar** qualquer coisa; o limite por execução vale só para trabalho novo. Antes de 2026-09-16 a cota era gasta relendo o que já tinha entrado, e a nota de agosto da Mais Dados ficou fora do painel.
- Não marca nada como lido na caixa.

## Estado atual
A **cobrança automática está ligada.** Ficou desligada (`cobranca_ativa_global`) desde a carga inicial de 2026-09-15 até o Júlio revisar os dados; em 2026-10-06 ele gerou as faturas de outubro com a cobrança ativa, sabendo que 8 fornecedores entrariam na fila no dia seguinte. O dia exato em que a chave global voltou não ficou registrado. A leitura roda normalmente.

## O que essa rotina não alcança
Fornecedor que manda só link de portal com login (PC Winthor/TOTVS), quem não manda nota por e-mail (ION Sistemas), quem está com a lista de remetentes vazia (Alterdata, Top Link Rio) e o Google IA Pro, cujo recibo vai para o Gmail. A **SAAM** saiu desta lista em 2026-09-24: o link do portal da ContaAzul passou a ser guardado como documento. Lista e motivos em [[GESTÃO TI]].

Histórico em [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]], [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]] e [[2026-09-23 — SAAM pelo link do portal e o deploy travado]].
