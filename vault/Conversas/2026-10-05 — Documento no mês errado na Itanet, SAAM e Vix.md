---
tipo: conversa
data: 2026-10-05
projeto: "[[GESTÃO TI]]"
status: resumido
tags: [conversa, ti, notas-fiscais, competencia]
---
# 2026-10-05 — Documento no mês errado na Itanet, SAAM e Vix

## Resumo
Três fornecedores apareceram com documento na competência errada, sempre um mês à frente. Eram causas diferentes com o mesmo sintoma, e todas com a mesma raiz: **quando o robô não conseguia ler a data, ele chutava e mostrava o chute com cara de certeza**. Corrigido no código e nos dados, fornecedor por fornecedor, sempre conferindo no documento original antes de mexer.

## O que estava errado, e por quê

**Itanet — a nota e o boleto de um ciclo caíam na fatura do ciclo seguinte, todo mês.**
A Itanet emite a NFCom do mês fechado no dia 1º do mês seguinte. A competência **nunca era lida de dentro de um PDF** — só o caminho do XML preenchia esse campo. Sem ela, o robô caía no último recurso: datar o documento pelo dia em que o e-mail chegou. Nota de setembro chegando em 1º de outubro virava documento de outubro.

Junto com isso, o arquivo `NF_586259….pdf` estava classificado como "fatura". O `_` é caractere de palavra, então não havia fronteira entre "nf" e ele, e o padrão que reconhece nota fiscal não casava. A fatura nunca dava a nota por recebida: o painel pedia para sempre um documento que já estava anexado logo abaixo.

**SAAM — fatura de outubro nasceu com vencimento 15/11.**
Os e-mails da ContaAzul **não trazem data nenhuma** — só o link do portal. Sem data em lugar nenhum, o robô calculava o vencimento supondo que toda nota vence no mês seguinte ao de referência. Vale para a Itanet, que fecha o mês e cobra no outro; não vale para a SAAM, que cobra dentro do próprio mês. E como nenhum documento dela traz data, nada mais adiante corrigia o palpite.

**Vix Suporte — a data de emissão 02/10 estava certa.**
Falso alarme, mas revelou outra coisa: a fatura estava com vencimento 01/10, **um dia antes de a nota existir**. Esse número não veio de documento nenhum — a nota da Vix não traz vencimento, e a conta está cadastrada com "Vencimento a confirmar" e o dia 1º como palpite.

## Decisões
- 2026-10-05 (Júlio): documento de uma competência entrando em outra **é inaceitável** — "não posso deixar que isso aconteça". Pediu também que tudo fosse anotado no cérebro sem precisar pedir.
- 2026-10-05 (Júlio): a **Vix Suporte vence todo dia 05** do mês seguinte ao da competência.
- 2026-10-05 (Claude): **a competência passa a ser lida do texto do PDF**, não só do XML — exigindo o rótulo colado ao número ("Competência 09/2026"). Data solta não serve: a página de um boleto é cheia delas, e qualquer `MM/AAAA` perdido ali datava o papel errado.
- 2026-10-05 (Claude): quando o documento não declara competência (o caso da 2ª via, que a Itanet reenvia de um ciclo já aberto), **vale o vencimento** — desde que exista uma única fatura da conta com exatamente aquela data. Isso reencontra uma fatura que já existe; não deduz um mês a partir do vencimento, dedução que a regra da competência evita de propósito.
- 2026-10-05 (Claude): **a distância entre competência e vencimento passa a sair do histórico da própria conta**, em vez de supor "mês seguinte" para todo mundo. Uma data corrigida à mão uma vez passa a valer para os meses seguintes. O dia continua vindo do cadastro: o histórico ensina o mês, não um dia excepcional de alguma remessa.
- 2026-10-05 (Claude): fatura aberta com data calculada **diz na observação que o vencimento é estimado**. Uma data nossa estava sendo exibida com a mesma cara de uma data lida no documento.
- 2026-10-02 (Júlio): a **e-Auditoria não entra neste sistema** — é despesa do fiscal, não da TI. Cadastrei e removi quando o Júlio confirmou. (Claude) Não foi marcada como "cancelada": a fatura é real e será paga, e registrar como cancelada seria informação falsa no painel.

## O que foi criado ou mudou
- [[GESTÃO TI]]: regras de competência refeitas, achados de Itanet/SAAM/Vix, pendências atualizadas
- [[Notas, boletos e recibos]]: a regra da competência ganhou a ordem das fontes e o conceito de distância por fornecedor
- Código (2 commits em `main`, `872cf03` e `3a50ba2`; esta nota dizia 3): leitura de competência no PDF, reconhecimento de `NF_….pdf`, casamento por vencimento, distância aprendida do histórico. O `872cf03` subiu em `dpl_smk2GnrmgwTQbyrRiaoM5PiajU7d`
- Vault: a primeira gravação desta nota falhou (EINVAL) porque o título levava `:`, que o Windows não aceita em nome de arquivo; sobrou um arquivo vazio, registrado em [[Cérebro da Lube]]
- Resumo no Telegram: 5 commits no mesmo dia (`9eb8cdc`, `15da417`, `834b5a0`, `dd7e5d6`, `c27f0dc`) e as variáveis `TELEGRAM_BOT_TOKEN` (cadastrada pelo Júlio) e `TELEGRAM_CHAT_ID` (pelo Claude, depois de o Júlio confirmar que o perfil era dele) na [[Vercel]]
- Dados corrigidos: 5 documentos da Itanet voltaram para o ciclo certo, 2 vencimentos da Itanet, 1 vencimento e 1 valor da SAAM; Vix com `dia_vencimento` de 1 para 5 e três competências acertadas (07 → 05/08, 08 → 05/09, 09 → 05/10)
- No teste do resumo, o Júlio recebeu **4 mensagens** (2 repetidas por um laço que enviava dentro da própria checagem, 1 no formato antigo): a espera pelo deploy conferia "HTTP 200", que a versão antiga também devolve
- Outros tropeços do resumo: no teste local, a variável `SUPABASE_SERVICE_ROLE_KEY` do Windows (de outro projeto) venceu de novo o `.env.local` (ver [[Supabase]]); a porta 3000 estava ocupada por um servidor de desenvolvimento que o próprio Claude tinha deixado aberto; e um nome de variável inventado (`NEXT_PUBLIC_URL_PAINEL`) foi trocado pelo que já existia, `NEXT_PUBLIC_APP_URL`

## Como ficou, conferido documento por documento

**Itanet** (cada ciclo com sua nota e seu boleto):

| Competência | Vence | Nota | Documentos |
|---|---|---|---|
| 08/2026 | 10/09 | 286520 | nota + 3 boletos (original e 2ª vias) |
| 09/2026 | 10/10 | 295274 | nota + boleto |
| 10/2026 | 10/11 | — | só o boleto; a nota sai em 1º/11 |

**SAAM** — outubro vence **15/10/2026**, R$ 1.719,32 (SISAUDCON R$ 1.203,52 + NB Technology R$ 515,80), conferido nos dois links do portal. Setembro foi acertado para **28/09**, conforme o Júlio apontou no portal.

## Uma conta, duas empresas, duas datas
Olhando os links de setembro apareceu uma limitação estrutural: as duas empresas da SAAM **venceram em datas diferentes** — a SISAUDCON foi reemitida de 15/09 para 28/09, a NB Technology ficou em 15/09. A fatura tem **um** campo de vencimento e não consegue representar as duas; o campo guarda 28/09 e a observação registra as duas datas, para nada ficar escondido.

Já tinha acontecido com o valor: o previsto da competência é a soma das duas (R$ 1.719,32), mas cada parcela é paga por conta própria. Enquanto forem uma conta só, toda divergência entre as duas vai ter que viver na observação.

## Depois: o resumo no Telegram
Na mesma conversa nasceu o [[Gestão TI - Resumo diário no Telegram]] — avisar no celular o que vence, o que chegou e quem deve documento. A primeira versão saiu quase vazia porque olhava só faturas "em aberto", e **não havia nenhuma**: tudo vira "assinado e entregue" assim que o documento vai para a contabilidade. Refeito pela data de vencimento, apareceu a Kaizen de R$ 3.707,97 vencendo naquele mesmo dia.

O prazo da Vix foi confirmado ali: **dia 05 do mês seguinte**. Corrigido nas três competências, o que revelou que a de setembro (R$ 4.000,00) também vencia em 05/10 — somando R$ 7.707,97 no dia.

## Pendências
- [ ] **Avaliar separar a SAAM em duas contas** (SISAUDCON e NB Technology). Hoje é uma só, e cada divergência de data ou de valor entre as duas tem que ser explicada na observação em vez de aparecer no painel
- [ ] Conferir se a parcela SISAUDCON de setembro (R$ 1.203,52) foi mesmo paga — em 24/09 estava vencida com juros, e o `valor_real` da competência está em R$ 1.203,52 contra R$ 1.719,32 previstos
- [ ] Permitir que eu grave na memória do projeto no Claude Code (a gravação foi bloqueada em 02/10)

Veja também [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]] e [[Notas, boletos e recibos]].
