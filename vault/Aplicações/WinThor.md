---
tipo: app
status: em uso
tags: [aplicacao, erp]
---
# WinThor

ERP da operação da Lube. Os dados saem pelo banco [[Oracle]] para o DATA WAREHOUSE no [[Supabase]]. Veja [[Mapa de sistemas]].

Tabelas `PC*`, campos e rotinas usados nos sistemas: [[Glossário WinThor]]. Rotinas que já viraram sistema:
**8086/8087** (ICMS de entrada e de saída) no [[PAINEL ICMS]], **201** (preço e tributação por região, `PCTABPR`) no
[[GESTÃO FISCAL]], **266/1147/1301** no [[MOVIMENTAÇÃO DE INVENTÁRIO]], **8352/8353** (reposições e chamados) no
[[REPOSIÇÕES E CHAMADOS]], e os assuntos "SAC - ..." de chamado no [[SAC]].
