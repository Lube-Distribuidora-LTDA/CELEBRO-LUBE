---
tipo: conversa
data: 2026-09-10
projeto: "[[PAINEL ICMS]]"
status: em andamento (em pausa desde 2026-09-11)
tags: [conversa, icms, fiscal, regime-atacadista]
---
# 2026-09-10 — Regime Atacadista e a identidade V1 no Painel ICMS

## Resumo
Ao reprocessar julho/2026, a segunda opinião da IA acusou falha na **identidade V1** nas saídas: **R$ 7,07** de diferença.
A V1 estava documentada no `AGENTE_ICMS_Lube.md`, mas **nunca tinha sido implementada** na trava do código. O Júlio
colocou na pasta a planilha **ATACADISTA** da Unicon e o Claude entendeu que a Lube está no **Regime Atacadista-ES**,
não na não-cumulatividade simples que o [[PAINEL ICMS]] calcula. Com o plano em fases aprovado, foi feita a **Fase 1**:
cálculo em paralelo, sem trocar o número do painel. Em 2026-09-11 o Júlio pôs o assunto **em pausa**: o Sérgio só quer
saber quanto vai pagar de ICMS por mês. **Em andamento, parado na Fase 1.**

## O que o regime muda
- **O ICMS de entrada passa a ser um percentual fixo por categoria**, não o ICMS da nota (17%/25% de compra do ES, 7%/12%
  de outros estados, base reduzida para chegar a 7%).
- **Saída é classificada por destino e tipo:** Varejista, Bonificação, Transferência, Consumidor Final, cada um com sua
  alíquota (inclusive **1,1%** para PJ/PF não contribuinte fora do ES).
- **Três apurações**, cada uma com seu DUA: operações internas ES (**121-0**), fora do estado (**380-8**, mais o
  **adicional de 3,5%** no **472-3**) e pessoas físicas/não contribuintes (DUA ainda não identificado).
- Demonstração não entra; devolução de compra estorna o ICMS de entrada daquela compra; Simples Nacional à parte; transferência entra nas duas apurações.
- A planilha da Unicon é um **modelo em branco**: não há exemplo conferido para validar.

## Decisões
- 2026-09-10 (Júlio): aprovou o **plano em fases**, sem trocar o número principal de uma vez. O número do regime só vira
  o card depois de validado em **pelo menos 3 períodos reais contra a Unicon**.
- 2026-09-10 (Claude): módulo próprio (`regime_atacadista.py`) chamado de um ponto só, dentro de `agregar()`, para não
  mexer nos 3 lugares que o usam. A classificação por categoria **nunca é adivinhada**.
- 2026-09-10 (Claude): V1 e regime só como **aviso no terminal**, sem bloquear a gravação do painel.
- 2026-09-11 (Júlio): **desconsiderar por enquanto** o regime atacadista e só conversar. O que o Sérgio quer é saber
  quanto vai pagar de ICMS por mês.
- 2026-09-11 (Claude): sugeriu pedir **uma planilha Atacadista já preenchida de um mês recente**, em vez das 9 perguntas
  separadas: serve para validar e mostra na prática a classificação Varejista x Consumidor Final.

## O que foi criado ou mudou
- 2026-09-10: `pip install xlrd` na máquina do Júlio, para ler o `.xls`.
- 2026-09-10: plano completo em `C:\Users\gti.julio.alves\.claude\plans\rippling-crunching-puddle.md`.
- 2026-09-10: `regime_atacadista.py` (novo): esqueleto de `apurar_regime_atacadista()` e `conferir_regime()`. Toda linha
  cai em `nao_classificado`, com o motivo, até confirmar os campos do WinThor.
- 2026-09-10: `extrator_winthor.py`: `agregar()` ganhou `dados["apuracao_regime"]` (não mexe em
  `kpis.icms_a_recolher`); nova `avisar_v1()` com tolerância de R$ 1,00; avisos da V1 e do regime em `extrair()`.
- 2026-09-10: `sync_supabase.py` imprime os mesmos avisos no fluxo de produção.
- 2026-09-10: planilha "ATACADISTA (versão 15 - out-2024-Terceiros).xls" da Unicon no Git local junto com o código
  (commit `562f4bd`). Teste com `painel_local.py --demo`: ICMS simples sem mudança (R$ 80.734,40 na demonstração), 236
  lançamentos como não classificados, JSON serializa normal.
- 2026-09-10: ponte reiniciada para pegar os avisos novos (ver [[2026-09-04 — IA do Painel ICMS, assistente do site e a ponte do WinThor]]).

## Erros e achados
- Julho/2026, saídas: base + isentas + outras = **R$ 13.577.823,61** contra valor desdobrado de **R$ 13.577.816,54**.
  Diferença de **R$ 7,07**, acima da tolerância de R$ 1,00. A trava só conferia V3 e V8. **Não afeta o ICMS a recolher**
  (V6/V7).
- O card "ICMS PRÓPRIO A RECOLHER" (R$ 291.541 em julho) mostra saída menos entrada simples e **provavelmente não é o
  valor que a Lube recolhe** no Regime Atacadista.
- O plano previa a V1 dentro da `conferir()`, bloqueando, com R$ 0,05 por linha. Na Fase 1 ela entrou **só como aviso**,
  com R$ 1,00 no total (`avisar_v1()`).
- O `regime_atacadista.py` usa `debito`/`credito` nos nomes dos campos de `dados.apuracao_regime` e nos avisos, contra
  a regra de 2026-09-08 (só entrada e saída).

## As 9 perguntas para o Sérgio ou a Unicon
1. Coluna do WinThor que marca fornecedor do Simples Nacional.
2. Critério de cliente pessoa física ou PJ sem inscrição estadual (não contribuinte).
3. Campo que distingue Varejista (revenda) de Consumidor Final, ou o critério que a Lube/Unicon já usa.
4. CFOPs de demonstração e consignação (ficam fora da apuração).
5. Onde fica a adesão ao regime dos clientes fora do ES.
6. CFOPs de transferência (interna e interestadual) realmente usados.
7. Campo de origem da mercadoria (nacional ou importada).
8. Código do DUA da apuração de pessoas físicas/não contribuintes.
9. Tolerância aceitável para considerar a validação "batendo" (decisão de negócio).

## Preferências do Júlio que apareceram
- **Não pode ter arredondamento** nos números do ICMS.
- Em tema grande, prefere **conversar antes de partir para o código**.
- Foco no que o usuário final precisa: o Sérgio só quer saber quanto vai pagar por mês.

## Pendências
- [ ] **Júlio:** pedir ao Sérgio ou à Unicon uma planilha Atacadista **preenchida** de um mês recente (ou as respostas às 9 perguntas).
- [ ] Fases 2 em diante (em pausa): classificar por categoria, as 3 apurações e os DUAs, o adicional de 3,5%, validar
  3 períodos e só então trocar o card, com aprovação do Sérgio.
- [ ] Tratar a diferença de arredondamento da V1 (o Júlio disse que não pode ter arredondamento) — combinado para depois.
- [ ] Decidir o que o card do ICMS a recolher mostra até o regime estar validado.
