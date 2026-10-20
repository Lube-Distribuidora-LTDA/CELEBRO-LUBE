---
tipo: rotina
departamento: Fiscal
status: ativo
frequencia: "07:15, 10:15, 13:15, 16:15, 19:15"
tags: [bi, fiscal, agendador]
---
# Fiscal - Sync

**Quando:** 07:15, 10:15, 13:15, 16:15 e 19:15 — **ainda não agendada** (2026-10-20: falta o Júlio rodar o `INSTALAR TUDO.bat` na `SRV-IA`).
**Onde:** Agendador de Tarefas do Windows, na VM `SRV-IA`, rodando de `C:\BI\FISCAL` (tarefa `Fiscal - Sync`).
**O que atualiza:** o [[GESTÃO FISCAL]] — preço de venda e tributação de saída por região (rotina 201, `PCTABPR`), cadastros de
produto, região e tributação, venda por produto × região dos últimos 12 meses — confere o banco contra a `PCTABPR` e deixa pronto o
pacote do painel (`fiscal.painel_cache`).

**Por que :15.** O [[Inventário - Sync]] roda aos :05, o [[Trade - Sync]] aos :25, o [[Reposições - Sync]] aos :35, o
[[BI Comercial - Sync rapidas]] aos :45 e o [[BI Compras - Sync rapidas]] aos :50: dois ETLs na mesma hora disputam o mesmo Oracle e o
mesmo banco. A 201 é usada o dia inteiro: uma carga antes do expediente e outras quatro ao longo do dia.

## Fluxo
1. **Gatilho** · Agendador do Windows na `SRV-IA` (tarefa `Fiscal - Sync`), às 07:15, 10:15, 13:15, 16:15 e 19:15
   - Fora do horário, `ATUALIZAR AGORA.bat` roda uma carga sem mexer em tarefa
2. **Processa** · `executar.py` (com `pythonw`, em `C:\BI\FISCAL`) chama o `sync_fiscal.py` ([[data-warehouse]])
   - **Se falhar:** erro antes de o log existir vai para `falha_inicial.log`; a tranca do `bi_comum.py` pula a rodada se já houver outra carga
3. **Lê** · [[WinThor]] (Oracle, leitura, numa transação só de leitura): `PCTRIBUT`, `PCREGIAO` + `PCCLIENT`/`PCPRACA`, `PCPRODUT` + `PCEST`, `PCMOV` (venda 12 meses), `PCTABPR` (produtos de revenda não excluídos × as 16 regiões do `ENV`)
4. **Grava** · [[Supabase]] DATA WAREHOUSE, schema `fiscal`: `TRUNCATE` + `INSERT` nos fatos e no produto, upsert em região e tributação; registra cada passo em `controle_carga`
5. **Confere** · `conferencia`: região a região, linhas, sem tributação e sem preço no banco contra a `PCTABPR`, na mesma foto do Oracle; diferença vira `AVISO`
6. **Processa** · monta o pacote do painel (`fiscal.painel_dados(12)`), comprime em gzip e guarda em `fiscal.painel_cache` (passo `pacote`)
   - **Se falhar:** a tela segue com o pacote anterior
7. **Entrega** · painel do [[GESTÃO FISCAL]]: a tela abre com a cópia guardada no navegador e baixa o pacote novo por trás (o botão Atualizar acende)

## Duração medida (2026-10-20, esta máquina, banco do Supabase lento)
- **10:45 (50 regiões, antes do recorte):** ~16 min, 7 de 7 `OK` — preço 590 s (644.433 linhas), produto 106 s, venda 76 s, conferência 36 s, pacote 142 s.
- **11:04 (16 regiões):** ~9 min, 7 de 7 `OK` — produto 136 s (7.277), venda 61 s (18.924), preço 263 s (116.432), conferência 28 s
  (igual ao WinThor nas 16 regiões), pacote 62 s (JSON de 3 MB, 473 KB comprimido). A extração no Oracle leva ~5 s; o resto é o banco
  gravando devagar (~330 linhas/s, o mesmo que o [[Inventário - Sync]] viu na manhã de 2026-10-20).

**A carga entrou?** Responde `fiscal.controle_carga` (um registro por passo, mais a `conferencia` e o `pacote`), não o log.

## Atualizar agora e diagnóstico
- `P:\INTEGRAÇÃO BI\FISCAL\ATUALIZAR AGORA.bat` (na `SRV-IA`): copia o ETL mais novo para `C:\BI\FISCAL` e roda uma carga.
- `DIAGNOSTICO.bat`: roda tudo sem gravar, confere a `PCTABPR` extraída contra a contagem do WinThor e mostra a situação de cada região.
- Mudar as regiões: `FISCAL_REGIOES` no `ENV` de `1 - CONFIGURACAO` e rodar o `ATUALIZAR AGORA.bat`.

Veja também [[GESTÃO FISCAL]] e [[GUARDIÃO DA LUBE]] (ainda não vigia esta rotina).
