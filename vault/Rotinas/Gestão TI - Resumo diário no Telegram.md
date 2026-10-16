---
tipo: rotina
departamento: TI
status: ativo
inicio: 2026-10-05
tags: [rotina, ti, telegram, notificacao]
---
# Gestão TI - Resumo diário no Telegram

Todo dia, no fim da rodada da cobrança, o [[GESTÃO TI]] manda no Telegram do Júlio um resumo do que exige atenção: o que vence, o que chegou no painel e quem ainda deve documento. Existe para ele saber das contas **sem estar na frente do computador**.

## Fluxo
1. **Gatilho** · fim da rodada de cobrança das 09:00 ([[Gestão TI - Leitura de e-mail e cobrança]]), sem agendamento próprio
   - O Hobby da [[Vercel]] só permite dois crons, e os dois já são a leitura (08:00) e a cobrança (09:00)
2. **Lê** · faturas e documentos do [[GESTÃO TI]] pela **data de vencimento**, não pelo status: até 3 dias para trás e 7 para frente
3. **Processa** · `resumo-diario.ts` monta as seções, de "vence hoje" a "ainda devem documento", em duas linhas por item
   - Ordem: vence hoje · venceu (até 3 dias) · vence em até 7 dias · chegou no painel · precisa de conferência · ainda devem documento
4. **Confere** · regras de silêncio: débito automático fica fora dos vencimentos e documento repetido é agrupado
   - **Atenção:** sem nada a dizer, nenhuma mensagem é enviada; silêncio quer dizer que não há conta chegando
5. **Avisa** · `telegram.ts` manda pelo bot para o Telegram do Júlio; texto maior que o limite é fatiado na quebra de linha
   - **Se falhar:** não derruba a cobrança; o erro volta na resposta e a rodada segue
6. **Entrega** · no celular do Júlio, o que vence, o que chegou e quem ainda deve documento, sem precisar estar no computador
   - **Atenção:** `/api/cron/resumo?preview=1` testava o formato sem enviar; desde 2026-10-07 o `/api/cron/` pede o `CRON_SECRET` no cabeçalho, a confirmar

## Quando sai
Junto da rodada das **09:00**, não em agendamento próprio: o plano Hobby da [[Vercel]] só permite dois e os dois já são a leitura de e-mail (08:00) e a cobrança (09:00). Essa também é a hora certa — a leitura já passou, então o resumo sabe o que chegou de madrugada.

Falha no Telegram **não derruba a cobrança**: o erro volta na resposta e a rodada segue.

## O que entra, e por quê
O recorte é a **data de vencimento**, não o status da fatura. Isso foi decidido depois de a primeira versão sair quase vazia: na prática a competência é marcada como "assinado e entregue" assim que o documento vai para a contabilidade, o que encerra a linha no painel — e naquele dia **não havia uma única fatura "em aberto"**, enquanto a Kaizen de R$ 3.707,97 vencia. Ver [[Notas, boletos e recibos]].

Seções, nesta ordem: vence hoje · venceu (até 3 dias) · **vence em até 7 dias** · chegou no painel · precisa de conferência · ainda devem documento.

A janela para frente é de **7 dias desde 2026-10-06**, escolha do Júlio. Nasceu com 5, e a conta do dia 15 só aparecia na sexta anterior — as contas da Lube se concentram nos dias 10, 15, 16, 17 e 24. Chegou a ir para 14 dias no mesmo dia e voltou para 7. Para trás continua em 3.

## Regras de silêncio
São o que separa um aviso útil de um alarme que ninguém escuta:

- **Sem nada a dizer, nenhuma mensagem é enviada.** Silêncio significa que não há conta chegando — vale mais que um "sem novidades" diário que ninguém abre.
- **Janela curta**: o que venceu há mais de 3 dias sai da lista. Repetir todo dia uma fatura de 25 dias atrás não faz ninguém pagá-la.
- **Débito automático não entra** em nenhuma seção de vencimento: tem dia de débito, o cartão cobra sozinho.
- **Documento repetido é agrupado** — a SAAM manda dois links iguais no mesmo dia (SISAUDCON e NB Technology) e, soltos, pareciam erro.

## O que foi tirado, e por quê
Registrado para ninguém devolver sem querer:

- **Total "sem baixa de pagamento"** (chegou a mostrar R$ 24.191,10). Dar baixa não é rotina no painel, então o número não media dívida em aberto — media o que ninguém registrou. Valor com cara de dívida que não é dívida vale menos que nenhum valor.
- **O selo "entregue à contabilidade" sozinho.** Voltou em 05/10/2026 a pedido do Júlio, mas agora aparece **nos dois sentidos**: "entregue à contabilidade" ou **"ainda não entregue"** em negrito. Só o lado positivo repetiria a mesma palavra em toda linha; é o lado que falta que pede ação — a competência que ainda espera a assinatura do Sergio.

Tudo fica numa tela de celular (~640 caracteres), duas linhas por item. Mensagem maior que o limite do Telegram é fatiada em quebra de linha, nunca no meio de uma marcação.

## Configuração
- Bot criado no **@BotFather**; o token fica em `TELEGRAM_BOT_TOKEN` nas variáveis da [[Vercel]] (produção).
- `TELEGRAM_CHAT_ID` é a conversa que recebe. Para descobrir sem expor o token, existe `/api/cron/resumo?descobrir=1` — faz a chamada do servidor e devolve só os ids. O caminho comum (abrir `api.telegram.org/bot<TOKEN>/getUpdates` no navegador) põe o segredo na barra de endereço, no histórico e em qualquer print.
- Só enxerga conversa que **já mandou mensagem ao bot**, e o Telegram guarda isso por ~24h.
- **Variável nova só vale em build novo.** Isso travou a configuração duas vezes: adicionar na Vercel não basta, tem que sair um deploy depois (em 2026-10-05 foi um commit vazio).
- Em 2026-10-05 o `TELEGRAM_BOT_TOKEN` foi cadastrado na Vercel pelo Júlio, e o `TELEGRAM_CHAT_ID` pelo Claude, em produção, depois de o Júlio confirmar que o perfil achado era o dele.

## Conferir sem incomodar ninguém
`/api/cron/resumo?preview=1` devolve o texto **sem enviar nada**. É assim que se testa formato.

Ao esperar um deploy para testar, confira por algo que **só a versão nova** tenha — um texto ou campo novo. Checar "a rota respondeu 200" ou um dado que vem do banco engana: a versão antiga responde igual, e o teste passa contra o build errado.

## Telegram agora, WhatsApp depois
Começar pelo Telegram e avaliar o WhatsApp oficial depois foi **decisão do Júlio em 2026-10-05**, por causa das exigências da Meta. O Telegram não depende de aprovação: o bot nasce no BotFather e já manda. O WhatsApp exigiria API oficial da Meta — conta no Meta Business, número dedicado e template aprovado, porque mensagem iniciada por empresa só vai em modelo aprovado. Bibliotecas não-oficiais estão descartadas: não rodam em serverless e arriscam banimento do número.

Por isso o **conteúdo é montado separado do envio** (`resumo-diario.ts` × `telegram.ts`): trocar o canal não refaz o resumo.

Veja também [[GESTÃO TI]], [[Notas, boletos e recibos]] e [[Gestão TI - Leitura de e-mail e cobrança]].
