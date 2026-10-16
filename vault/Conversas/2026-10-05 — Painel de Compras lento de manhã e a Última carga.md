---
tipo: conversa
data: 2026-10-05
projeto: "[[BI COMPRAS]]"
departamento: Compras
status: resumido
tags: [conversa, bi, compras, vercel, cache, desempenho]
---
# 2026-10-05 — Painel de Compras lento de manhã e a Última carga

## Resumo
O Júlio relatou demora para entrar no [[BI COMPRAS]], principalmente de manhã, e erros que o obrigavam a recarregar a
página. Isso não pode acontecer, porque ele abre o painel **na frente da diretoria**. A medição mostrou que o banco não
estava lento (102 ms com cache, cerca de 380 ms indo ao banco). A causa principal era a folha do Google Fonts, que
bloqueava a tela, somada à cópia em cache que expirava durante a noite. Na mesma manhã ele notou que o painel sempre
parecia ter acabado de atualizar: a "Última carga" mostrava a hora do acesso, e não a da carga.

## Decisões
- 2026-10-05 (Claude): atacar a fonte que bloqueava a tela, o cache frio da manhã e a falta de rede de segurança — a
  medição mostrou que o banco não era o gargalo. A nova tentativa automática da tela de carregamento, que já estava no
  ar, foi mantida.
- 2026-10-05 (Claude): a "Última carga" mostra a carga OK **mais antiga** entre as que alimentam a tela, e não a mais
  recente. Estoque, verba e sugestões rodam 4 vezes por dia e o faturamento 1 vez; assim, "tudo o que você vê é ao menos
  desta hora" é verdade. Efeito desejado: se uma carga parar, o horário congela e a falha aparece na tela.

## O que foi criado ou mudou
- Commit `9626669`:
  - `web/index.html`: a folha do Google Fonts deixa de bloquear a tela (carrega como `media="print"` e vira `all` no
    `onload`); fontes de reserva reforçadas (`system-ui` etc.);
  - `web/api/dados.js`: `Cache-Control` com `s-maxage=600`, `stale-while-revalidate` de 1 hora para **86400 (24 h)** e
    `stale-if-error=86400`, para servir a última cópia boa se o banco estiver fora;
  - `web/vercel.json`: 2 crons de aquecimento do `/api/dados`, `55 0,6,9,14,18 * * *` (UTC, logo depois das cargas da
    época) e `30 10 * * 1-5` (07:30 de Brasília em dias úteis).
- Migrações no DATA WAREHOUSE ([[Supabase]], `ivcnotrynogaljrvvyes`):
  - `painel_dados_geradoem_vira_hora_da_carga`: `compras.painel_dados()` deixa de usar `now()` no `geradoEm` e passa a
    ler `compras.controle_carga` (troca cirúrgica do trecho, que aborta se não achar);
  - `painel_dados_carga_mais_antiga_na_tela`: o `geradoEm` passa a ser a carga OK mais antiga entre as consultas da tela
    (últimos 7 dias); novo campo `cargas {estoque, faturamento}`.
- Commit `b70531f` (`web/index.html`): pop-up na pílula "Última carga" com o horário de cada grupo; o "Próxima" muda de
  00/08/12/18 para 04/12/16/22, os horários reais naquele momento (as tarefas da VM estavam deslocadas).
- Medições: JSON de 1.793 KB (508 KB comprimido); com o Google Fonts fora do ar o painel ficou interativo em 31 ms e
  carregou inteiro com a fonte do sistema; nenhum timeout nem checkpoint pesado no banco naquela manhã.

## Erros e incidentes
- Tela em branco e lenta de manhã: o `<link>` do Google Fonts bloqueava a renderização, e o primeiro acesso do dia
  esperava a função acordar e consultar o banco.
- O `geradoEm` vinha de `now()`: às 09:45 o painel mostrava 09:45, mas a carga real era das 03:50.
- Um script Python de edição converteu as quebras de linha para CRLF; o git normalizou e o diff ficou limpo (16 linhas).
- **Os dois commits não foram ao ar no dia.** Os deploys de 09:34 (`dpl_BLGGG15zLDDiiQ59FX1sWoyH1kEc`, commit
  `9626669`) e 09:50 (`dpl_CZETooero4P8jeM5G8Yhg8wqWhCm`, commit `b70531f`) ficaram em ERROR na validação do
  `vercel.json` (a chave `_comentario_crons`, que entrou com os crons). Em 2026-10-06 o Júlio achou que a trava era o
  repositório privado no GitHub. Eram duas coisas: o erro registrado era o do `vercel.json`, e o repositório privado
  travaria em seguida no plano Hobby. Só subiram em 2026-10-06, na instalação da [[SENTINELA LUBE]],
  que tirou a chave e os crons (ver [[2026-10-05 — Sentinela Lube, sistema de segurança]]). As duas migrações valeram
  desde 2026-10-05, porque foram aplicadas direto no banco.

## Preferências do Júlio
O painel não pode demorar nem dar erro ao abrir: ele abre na frente da diretoria. O horário de atualização mostrado no
painel tem que ser verdadeiro. Ver [[Como eu gosto dos BIs]].

## Pendências
- [ ] Hospedar as fontes no próprio painel, para não depender do Google — sugerido pelo Claude, não pedido.
- [x] 2026-10-06: os crons de aquecimento saíram do `vercel.json` (a porta da Sentinela barraria o aquecedor). Desde
  então o COMPRAS **não tem aquecedor**.
- [x] 2026-10-09: o "Próxima" voltou a 00/08/12/18 depois que as tarefas da VM foram recriadas
  ([[2026-10-08 — Cargas do BI COMPRAS 4 horas fora do horário]]).
