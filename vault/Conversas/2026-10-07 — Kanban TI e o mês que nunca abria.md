---
tipo: conversa
data: 2026-10-07
projeto: "[[GESTÃO TI]]"
status: resumido
tags: [conversa, ti, kanban, competencia, telegram]
---
# 2026-10-07 — Kanban TI e o mês que nunca abria

## Resumo
Começou com uma pergunta simples — "o robô não me avisou destas contas que vencem semana que vem" — e descobriu-se que **a abertura automática de competências nunca funcionou**: 26 contas ativas, 4 faturas de outubro, e as quatro criadas pelo robô ao receber documento, nenhuma pelo agendamento. Depois disso veio o **Kanban TI**, quadro novo para os problemas internos do setor.

## O defeito que ninguém via

A função `gerar_faturas_competencia` tem `p_competencia` com padrão "mês corrente", mas **padrão de SQL só vale quando o argumento é omitido** — e as três rotas que a chamam mandavam `null` explícito, que sobrescreve. Com isso a competência virava nula, a checagem de existência não casava com ninguém (nada é igual a `null`) e o insert batia na restrição NOT NULL.

O erro acontecia **todo dia e não aparecia em lugar nenhum**: a rota de cobrança embrulhava a chamada num `catch` vazio. Passo diário que falha em silêncio é indistinguível de passo que deu certo.

Corrigido com `coalesce` na própria função — assim vale para os três chamadores, inclusive o botão do painel — e o `catch` passou a devolver o erro na resposta.

## O segundo defeito, que só apareceu depois do primeiro

Com a geração voltando a rodar, nasceram 22 faturas de outubro — **8 com a data errada**. A função calculava o vencimento sempre dentro do mês da competência, o que só vale para parte das contas (ver [[Notas, boletos e recibos]]). Para Vix, Kaizen, Print Solução e INTELI+, a competência de outubro nasceu com a data da de setembro, e as duas apareciam lado a lado no painel: mesmo fornecedor, mesmo valor, mesma data. **Parecia duplicata, e era** — a mesma conta do mundo real contada duas vezes.

Nenhuma foi apagada: as faturas eram legítimas, só estavam com a data errada, e foram movidas para o mês certo (decisão do Claude): Vix 05/11, Mais Dados Digital 01/11, INTELI+ 01/11, Kaizen 08/11, as três contas da Print Solução 15/11 e IMPREMIX 25/11. A função passou a ler a distância do histórico da própria conta — a mesma regra que o robô já usava.

Isso expôs um terceiro buraco: para essas contas, **o boleto que vence 15/10 é a competência de setembro**, e setembro também nunca fora aberto para os dois firewalls da Print Solução.

## Kanban TI
Aba nova no menu, em Infraestrutura. **Não se mistura com chamados** — lá o usuário abre pedido pelo portal; aqui é a própria TI organizando o que precisa resolver. Decisão do Júlio: colunas **Em análise · Tranquilo resolver · Crítico · Resolvido**, cartões criados à mão, arrastados entre colunas, e contagem por coluna no dashboard.

As colunas são **dados, não enum**: renomear ou acrescentar uma é um insert, não uma migração.

## Decisões
- 2026-10-07 (Claude): **as colunas do Kanban são configuráveis pelo banco.** Os nomes vieram como exemplo, então travá-los em enum obrigaria uma migração a cada ajuste.
- 2026-10-07 (Claude): a faixa do Kanban **some do dashboard quando não há cartão** — faixa que só mostra zeros ocupa espaço sem dizer nada.
- 2026-10-06 (Júlio): **janela de aviso do resumo passou de 5 para 7 dias.** Duas semanas chegou a ser pedido e desfeito no mesmo dia. As contas se concentram nos dias 10, 15, 16, 17 e 24, e cinco dias mostravam a conta do dia 15 só na sexta anterior.
- 2026-10-06: **gerar as 22 faturas com a cobrança automática ligada**, escolha do Júlio depois de eu listar o efeito: 8 fornecedores entrariam na fila de cobrança já no dia seguinte.
- 2026-10-06: o filtro padrão do painel **fecha o mês corrente** em vez de abrir para o futuro. (Júlio) "Mês atual + vencidas" é o mês corrente mais o que atrasou dele e dos anteriores — nunca meses futuros. No caminho eu misturei o filtro do painel com a janela do resumo, e o Júlio corrigiu.
- 2026-10-06 (Júlio): **nada fica marcado como confirmado ou entregue sem ele ter confirmado.** Foi o caso da Itanet Out/26.
## O que foi criado ou mudou
- [[Gestão TI - Kanban TI]]: rotina nova
- [[GESTÃO TI]]: aba nova, defeito da geração de competências
- [[Notas, boletos e recibos]]: a distância competência→vencimento agora vale também para a geração automática, não só para o robô
- Código: 8 commits, 3 migrações (arquivos 12 e 13 do repositório para a competência, 14 para o Kanban; no banco, `competencia_nula_vira_mes_corrente`, `competencia_respeita_distancia_da_conta` e `kanban_ti`)
- Dados (2026-10-06): a **Itanet Out/26** aparecia como "assinado e entregue" sem o Júlio ter confirmado — efeito colateral de uma alteração do Claude em 05/10. Voltou para "documentos recebidos", com `entregue_em` e `entregue_por` limpos; conferido que nenhum gatilho a remarca. Descoberto junto: **`entregue_por` nunca é gravado** — as 35 faturas entregues estão com ele vazio
- Varredura de 45 dias na caixa `cpd@`: achados o boleto da Alterdata (`smtperp@alterdata.com.br`, 18/09 e 02/10) e o aviso da prefeitura de Vila Velha das NFS-e 954, 956 e 963 da Print Solução — à tarde a própria Print mandou as notas e o robô vinculou sozinho, então não foi preciso cadastrar a prefeitura. O Júlio subiu à mão Alterdata, Top Link, Dinâmica e Fusion
- **No ar desde 2026-10-08 08:14** (commit `9a866cc`): o deploy do `11297c7` tinha ficado `BLOCKED`. Conferido pelo alias de produção e pelo log de build, que lista `/kanban` e `/api/kanban`; a migração `kanban_ti` está aplicada no banco. O deploy de produção é o `dpl_H1XzHsK1HQRuHE6JnCbBEG7qyJDm`, READY; o do `11297c7` (`dpl_62viDNjHLUseRnQjNU1NpP864a8c`) segue como `BLOCKED`. Em 2026-10-09 continuava sendo o último deploy de produção.
- Dados de 2026-10-06, além da Itanet: a geração rodou com **22 faturas criadas e 4 já existentes** (26 contas ativas, R$ 53.397,42); depois da segunda migração, rodar de novo deu **0 criadas e 26 existentes**, sem duplicata. Foram criadas as competências de setembro do Firewall Matriz (R$ 2.500,00) e do Firewall Rio (R$ 703,87), vencendo 15/10, e corrigido o vencimento de setembro do Banco de Horas da Print Solução

## Armadilhas técnicas que valem lembrar
- **`null` não aciona o DEFAULT de uma função SQL.** Omitir o argumento e passar null são coisas diferentes.
- **`catch` vazio em passo diário** transforma falha em silêncio. O erro existia desde o primeiro dia.
- **`useAviso` recriava suas funções a cada render**, e qualquer tela que as pusesse nas dependências de um efeito de carga entrava em laço — o Kanban fez 465 chamadas à API em segundos antes de eu estabilizar o hook. Valia para as 11 telas que usam o hook.
- **Arrastar não pode carregar o id no estado do React**: entre o `dragstart` e o `drop` pode não ter havido render. O id viaja no `dataTransfer`.
- **Esperar deploy conferindo "respondeu 200" engana** — a versão antiga responde igual. Confira por algo que só a versão nova tenha. Errei isso três vezes seguidas e mandei quatro mensagens repetidas no Telegram.

## Pendências
- [ ] Cadastrar `@alterdata.com.br` e o remetente da **Top Link Rio**: as duas estão com a lista de remetentes **vazia**, então o robô nunca olha os e-mails delas. O boleto da Alterdata estava na caixa desde 18/09 e o Júlio acabou subindo à mão — Júlio decide
- [ ] **Dinâmica Telecom**: nada chegou em 45 dias na caixa do `cpd@`, nem buscando "dinamica" solto. Vence dia 10 — Júlio (subiu o documento de outubro à mão em 2026-10-06; falta saber por onde ela manda)
- [ ] Avaliar **desligar a cobrança automática** de Vix, Kaizen e ION, cujo documento já existe ou que nunca respondem — oferecido pelo Claude, sem resposta registrada
- [ ] Opcional: passar a gravar **quem** marca "assinado e entregue" (`entregue_por`)
- [ ] **ION Sistemas**: R$ 7.805,30 vencendo, sem documento. Não mandam nota por e-mail desde 2019
- [ ] Atualizar `scripts/testar-painel.mjs`: as três telas públicas acusam falha com 302 desde a Sentinela (o guarda de login que passou a mandar o acesso para o Painel Lube, acrescentado por outra sessão em 2026-10-06/07), que é o comportamento correto agora

Veja também [[2026-10-05 — Documento no mês errado na Itanet, SAAM e Vix]] e [[Gestão TI - Resumo diário no Telegram]].
