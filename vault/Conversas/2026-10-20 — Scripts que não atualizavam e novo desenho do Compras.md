---
tipo: conversa
data: 2026-10-20
projeto: "[[BI COMPRAS]]"
status: resumido
tags: [conversa, compras, design, guardiao, reposicoes, comercial, agendador]
---
# 2026-10-20 — Scripts que não atualizavam e novo desenho do Compras

## Resumo
Dois pedidos do Júlio no mesmo dia.

**1. "Por que os scripts aparentemente não estão atualizando?"** (print do resumo do [[GUARDIÃO DA LUBE]]). O Compras estava certo — `compras.controle_carga` com 07:50, 11:50, 17:50, 23:50 e 02:50 todos `OK` e a conferência com o Oracle sem diferença. Os dois problemas reais eram de outros sistemas:
- **[[Reposições - Aquecer painel]]** falhava desde o primeiro dia vigiado (14/10) com `CERTIFICATE_VERIFY_FAILED`: o Windows da SRV-IA não tem a raiz da Google Trust Services (que assina o `*.vercel.app`) e o Python no Windows só confia no que o Windows confia. O `aquecer_painel.py` agora tenta o certificado do sistema, depois o `certifi` e, por último, segue sem verificar (só lê uma página pública; o log marca `ssl=sem-verificar`). Copiado para `P:\INTEGRAÇÃO BI\REPOSICOES`. **Falta o Júlio rodar o `ATUALIZAR AGORA.bat` na VM.**
- **[[BI COMERCIAL]] · Margem por item** parada em 10/10: a correção de 13/10 (incluir a `mv_margem_dia` nas views atualizadas no fim da carga) ficou só no repositório; a cópia em `P:\INTEGRAÇÃO BI\COMERCIAL` ainda era a de 08/10 — a armadilha de editar sem copiar/reinstalar. Copiado o `sync_bi_comercial.py` certo. **Falta o `INSTALAR TUDO.bat` do Comercial na VM** (e, para ver hoje, `python sync_bi_comercial.py --consulta dim_rca` em `C:\BI\COMERCIAL`).

**2. "Mude o design e os filtros para o padrão dos sistemas recentes."** O Central Compras foi refeito sobre a base dos painéis novos (Comercial/Trade/Inventário/Fiscal) — ver o histórico em [[BI COMPRAS]]. Escolhas do Claude: referência = o framework do [[GESTÃO FISCAL]] (o mais novo); os números não mudam (50 KPIs conferidos um a um contra o painel antigo); clique em número/situação aplica o filtro e leva à planilha com "Voltar", clique em pessoa/coisa abre o relatório; sem foto de produto por enquanto.

## Para a próxima vez
- Dois painéis da casa ainda não têm foto de produto no Compras: ligar como no Fiscal (`trade.produto_miniatura` + `api/img`) é a sequência natural.
- Código novo só vale na VM depois de **copiar para `P:` e rodar o instalador/`ATUALIZAR AGORA.bat`**; o Guardião vê o sintoma (view parada), não a causa.
