---
tipo: conversa
data: 2026-10-13
projeto: "[[GESTÃO TI]]"
status: resumido
tags: [conversa, ti, fornecedores, faturas]
---
# 2026-10-13 — Fornecedor inativo sai do painel de notas

## Resumo
O Júlio apontou que a **Data R Informática** estava com status INATIVO e mesmo assim continuava no painel de notas em outubro. A causa: o estado do **fornecedor** e o da **conta** são campos independentes, e nada no sistema olhava o primeiro — nem a listagem, nem a geração automática de competências. A conta tinha ficado ativa, então a competência de outubro nasceu normalmente. Corrigido nos dois lugares e no ar (commits `69a443b` e `cbfc696`).

## Decisões
- 2026-10-13 (Júlio pediu; Claude implementou): **fornecedor inativo some do painel de notas.** Marcar como inativo é como se encerra um contrato no sistema. Vale para a listagem de faturas, os alertas do dashboard e o resumo do Telegram — avisar sobre contrato encerrado é o tipo de alarme que ensina a ignorar a mensagem.
- 2026-10-13 (Claude): **a geração deixa de abrir competência para fornecedor inativo.** Sem isso, a tela esconderia o sintoma e o robô continuaria criando a fatura todo mês. Conferido gerando novembro: nenhuma fatura da Data R nasceu.
- 2026-10-13 (Claude): **o histórico não é apagado.** Fornecedor encerrado continua consultável com `?inativos=1`, para olhar o passado sem precisar reativá-lo.
- 2026-10-13 (Júlio decidiu depois de eu corrigir uma suposição dele): a fatura da Data R **fica no banco, marcada como cancelada**. Ele autorizou manter "as faturas antigas", mas **não havia nenhuma antiga** — a única existente nasceu em 06/10 às 11:43, da geração automática que eu rodei enquanto ela já estava inativa. Era resíduo do defeito, não histórico.

## O efeito que ocultar não resolveria
A fatura somava **R$ 2.325,00 no custo de outubro**. Filtrar a lista não tira o valor do total: o número no topo do dashboard continuaria inflado. A view `vw_custos` ignora faturas canceladas, então cancelar resolveu as duas coisas de uma vez — **o custo de outubro caiu de R$ 53.269,29 para R$ 50.944,29**.

## O que foi criado ou mudou
- [[GESTÃO TI]]: regra do fornecedor inativo
- [[Notas, boletos e recibos]]: o que "inativo" quer dizer aqui
- Migração 15: a view expõe `fornecedor_ativo` e `conta_ativa`; a geração passa a exigir fornecedor ativo

## Armadilhas que valem lembrar
- **O estado do fornecedor e o da conta são independentes.** Inativar o fornecedor **não** inativa as contas dele. Enquanto a conta estiver ativa, tudo que olha só `contas.ativo` continua funcionando como se nada tivesse mudado.
- **Esconder da tela não corrige número somado.** Lista e total vêm de caminhos diferentes (`vw_faturas_detalhe` e `vw_custos`); o que entra num pode continuar no outro.
- **Rodar a geração para testar cria dados de verdade.** O teste de novembro abriu 24 competências reais, que tive de apagar. Testar geração sempre num mês que já existe, ou limpar depois.
- **Migração commitada sem o SQL.** O arquivo subiu só com o cabeçalho: banco certo, repositório errado. É a mesma divergência que já obrigou a reconstruir uma view aqui — conferir que o arquivo tem os comandos, não só o comentário.

Veja também [[2026-10-07 — Kanban TI e o mês que nunca abria]].
