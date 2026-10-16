---
tipo: conversa
data: 2026-09-30
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, desempenho, graficos, supabase]
registrado_em: 2026-10-09
---
# 2026-09-30 — lentidão entre abas e rótulos das roscas no BI de RH

## Resumo
Logo depois da aba Exames ([[2026-09-30 — nova aba de Exames Periódicos no BI de RH]]), no [[BI ABSENTEÍSMO RH]]:
- **Lentidão:** as abas do menu demoravam a mostrar os dados. A busca no banco era feita página por página, em fila. Passou a ser em paralelo, e a InterJornadas caiu de **11,4 s para 2,7 s**.
- **Rótulos:** o Júlio mandou prints de rótulos de rosca fora do gráfico, sobrepostos e cortados, e da coluna "Situação" quebrada na tabela de Exames. Foram três rodadas até 2026-10-01. Como os prints eram de uma versão em cache, entrou um **carimbo de versão** no rodapé do menu.

## Decisões
- 2026-09-30 (Claude): todas as colunas da interjornada são usadas, então o ganho tinha de vir de paralelizar, não de cortar colunas.
- 2026-09-30 (Claude): conferir que a busca em paralelo devolve exatamente o mesmo que a busca em fila antes de fixar.
- 2026-09-30 (Claude): numa rosca não se desenha rótulo para fora; o valor da fatia que não comporta rótulo vai para a **legenda**, com número e percentual.
- 2026-10-01 (Júlio): os rótulos podem ficar menores para caber dentro do gráfico, mas **nunca** para fora, sem aparecer ou em cima de títulos.
- 2026-10-01 (Claude): parar de pedir Ctrl+F5 e **mostrar na tela a versão publicada**, para saber se o que se vê é cache.

## O que foi criado ou mudou
**Desempenho** (commit `b526433`)
- Nova `fetchPaginadoDB` no `supabase-client.js`: a 1ª página traz a contagem total, e as outras vêm em lotes paralelos de 12 (6 foi testado antes). Removida a função morta `__fetchPagamentoHoraExtraAntigo`.
- Paginação da Hora Extra ordenada por `(ano_mes_sort, funcionario_nome, id)`. O `id` desempata: a linha de 50% e a de 100% do mesmo colaborador no mesmo mês empatavam, e o banco podia devolver uma delas duas vezes ou pular outra.
- Medido contra o banco real (us-west-2, ~0,5 a 0,7 s por ida e volta): InterJornadas 11.406 → 2.707 ms; Hora Extra 1.062 → 732; HEAD 511 → 517; Turnover 609 → 525; Exames 572 → 474. As 14.940 linhas da interjornada vieram idênticas, na mesma ordem, sem duplicata.

**Rótulos e badges**
- Commit `88dc90d` (30/09) — roscas com `display: 'auto'` (esconde o rótulo que colide), balão por fora com borda e fundo mais opaco e mais folga em cima. Tabela de Exames: badge de Situação com rótulo curto ("Vence em 30d", "Vence em 90d", "Sem exame", "Afastado") e sem quebra de linha; os 199 badges ficaram numa linha.
- Commit `2684858` (30/09) — rótulo **sempre dentro da fatia** (`clip: true`); fatia abaixo de 7% sem rótulo; legenda com número e percentual ("Vencido — 26 · 13,1%"), nas 8 roscas do painel. O card do Raio-X de Motivos subiu de 280 para 340 px. Varredura nos 28 gráficos: nenhuma legenda estoura o canvas.
- Commit `b4466bd` (01/10) — em vez do limiar fixo de 7%, a rosca **mede se o texto cabe**: espessura do anel e comprimento do arco. Cabe tudo: valor + % em fonte 10; cabe pouco: só o valor em fonte 9; não cabe: nada, e o valor fica na legenda. Resultado: Raio-X de Motivos 6 de 6 fatias rotuladas (antes 2), Tipo do Último Exame 5 de 7 (antes 2).
- Commit `b4466bd` — **carimbo de versão** no rodapé do menu ("versão 2026-10-01 (b4466bd)"), gravado no build pelo `generate-config.js` a partir do commit que a [[Vercel]] publicou.
- Os três commits foram publicados e conferidos no ar.

## Erros e incidentes
- **Erro do Claude:** o balão por fora do `88dc90d` caía na borda do canvas e era cortado — sobrava um quadradinho sem número. Corrigido no `2684858`.
- Os prints do Júlio de 2026-10-01 eram da versão antiga em cache (legenda sem número).
- A primeira tentativa de medir o encaixe zerou todos os rótulos, porque durante a animação o elemento do gráfico tem ângulo zero. Passou a usar o ângulo calculado dos dados.
- Na primeira medição de desempenho, o navegador usou o `supabase-client.js` antigo do cache (pareceu 11,4 → 7,9 s); refeito em outra porta.
- O painel do navegador do Claude travou esperando a animação com a janela oculta, e falhou nos prints com a página rolada; a verificação foi feita por medição programática.

## Pendências
Nenhuma.

Veja também [[BI ABSENTEÍSMO RH]], [[Como eu gosto dos BIs]] e [[Supabase]].
