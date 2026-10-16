---
tipo: conversa
data: 2026-10-01
projeto: "[[SISTEMA FINANCEIRO]]"
status: resumido
tags: [conversa, financeiro, folha-pagamento, supabase, incidente]
---
# 2026-10-01 — Banco travado e o total dos Afastados INSS

Continuação de [[2026-09-30 — Ajustes de tela do painel de folha]].

## Resumo
De manhã o painel da Validação de Folha devolvia erro 500. Não era código nem variável: o banco
DATA WAREHOUSE (t3.micro) estava com **Disk IO em 100%** desde o refresh das views do
[[BI COMPRAS]] às 06:52, e nada mais entrava. Detalhes e saída em [[Supabase]]. O banco voltou
sozinho por volta das 11:20. Depois o Júlio perguntou por que o total da folha em AFASTADOS INSS é
tão alto — resposta na [[GESTÃO FINANCEIRO — documentação técnica]]: é o saldo devedor do plano de
saúde carregado mês a mês pelo par 998/609, não dinheiro pago. Líquido do departamento é zero.

## Decisões
- O botão "Restart project" fica em Settings → General, não em Infrastructure.
- Recomendação: subir o compute de Micro para Small (a troca já reinicia) e trazer o refresh
  pesado do COMPRAS para a madrugada, como o agendador previa (02:50).

## Pendências
- [ ] Subir o compute do DATA WAREHOUSE para Small — Júlio
- [ ] Descobrir de onde saiu o refresh do COMPRAS às 06:52 (não foi da máquina do Júlio) — Júlio
- [ ] Decidir se o painel mostra os Afastados INSS à parte ou exclui 998/609 do "total da folha"
