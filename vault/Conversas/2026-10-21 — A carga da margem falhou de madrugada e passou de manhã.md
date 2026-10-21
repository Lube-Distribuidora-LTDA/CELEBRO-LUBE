---
tipo: conversa
data: 2026-10-21
projeto: "[[BI COMERCIAL]]"
status: resumido
tags: [conversa, comercial, margem, supabase]
---
# 2026-10-21 — A carga da margem falhou de madrugada e passou de manhã

## Resumo
A `margem_item` falhou na carga das 03:45 e na tentativa das 05:15. Rodada de
novo às 08:25, **sem nenhuma mudança de código**, passou em 436 s. O dado está
em dia; a causa ficou sem explicação.

## O que aconteceu
- **03:45** — 5 de 6 consultas OK, faltou a `margem_item`.
- **05:15** — a tarefa tentou de novo e terminou com **código 1**.
- **08:25 a 08:33** — o Claude rodou `sync_bi_comercial.py --grupo pesadas` da
  pasta de rede, depois de conferir que o banco estava saudável (0,27 s para
  contar até um milhão, contra 42 s em 14/10 e mais de 120 s em 19/10) e que a
  tranca estava livre. **6 de 6 OK**, 3.357.830 linhas em 436 s.
- O Guardião voltou sozinho para `ok`: *"Rodou de novo às 08:33 (correção
  automática pedida às 05:15)"*.

Resultado no painel: `fato_margem_item` e `mv_margem_dia` até **21/10**, cache
guardado às 08:33:57. Outubro com **R$ 9.006.728,95** de venda e
**R$ 1.781.404,73** de margem.

## A causa ficou sem explicação, e isso está registrado de propósito
A mesma carga levou **436 s hoje de manhã e 860 s ontem**. É o banco oscilando
— o cérebro registra 5 quedas dele em 6 dias desde 15/10 (ver [[Supabase]]).
Mas é **inferência, não prova**, por dois motivos que se somam:

1. **Quando a `margem_item` quebra, nem a linha de ERRO chega ao
   `controle_carga`.** Foi por isso que o Guardião disse "5 de 6" sem conseguir
   dizer o motivo.
2. **O `C:\BI` da `SRV-IA` deixou de aceitar leitura do Claude** (provavelmente
   a trava de permissões que o Guardião pedia). Era por ali que os logs das
   cargas eram lidos — o log daquela madrugada ficou inacessível.

O Júlio não viu mensagem nenhuma, o que é coerente: a tarefa roda com
`pythonw`, sem janela.

## Decisões
- 2026-10-21: **não mexer no registro de falha do ETL por enquanto** (Júlio). O
  Claude ofereceu fazer a falha ser gravada no `controle_carga` com o motivo,
  para o diagnóstico não depender de acesso a disco; o Júlio dispensou.
- 2026-10-21: rodar a carga na mão só depois de conferir banco e tranca, para
  não atropelar uma carga agendada (Claude).

## Pendências
- [ ] **Decidir sobre a instância do Supabase** (Júlio) — pendente desde 14/10.
  É a única coisa que faz as quedas pararem. Enquanto isso, a carga das 03:45
  pode falhar de novo a qualquer dia, do mesmo jeito.
- [ ] Definir se o Claude volta a ter leitura no `C:\BI` da `SRV-IA`, ou se o
  diagnóstico das cargas passa a depender só do que está no banco (Júlio).

Ver também: [[BI COMERCIAL]], [[BI Comercial - Sync margem]],
[[GUARDIÃO DA LUBE]], [[Supabase]],
[[2026-10-19 — Painel comercial no cache e o Guardião sem alarme falso]].
