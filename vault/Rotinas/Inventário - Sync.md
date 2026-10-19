---
tipo: rotina
departamento: Logística
status: ativo
frequencia: "07:05, 09:05, 11:05, 13:05, 15:05, 17:05, 19:05, 22:05"
tags: [bi, inventario, agendador]
---
# Inventário - Sync

**Quando:** 07:05, 09:05, 11:05, 13:05, 15:05, 17:05, 19:05 e 22:05 — **ainda não agendada** (2026-10-19: falta o Júlio rodar o
`INSTALAR TUDO.bat` na `SRV-IA`).
**Onde:** Agendador de Tarefas do Windows, na VM `SRV-IA`, rodando de `C:\BI\INVENTARIO` (tarefa `Inventario - Sync`).
**O que atualiza:** o [[MOVIMENTAÇÃO DE INVENTÁRIO]] — livro de bloqueio (rotina 266), inventário rotativo (1147), posição do PCEST
e cadastros — confere a 1147 contra o PCMOV e deixa pronto o pacote do painel (`inventario.painel_cache`).

**Por que :05.** O [[Trade - Sync]] roda aos :25, o [[Reposições - Sync]] aos :35, o [[BI Comercial - Sync rapidas]] aos :45 e o
[[BI Compras - Sync rapidas]] aos :50: dois ETLs na mesma hora disputam o mesmo Oracle e o mesmo banco. De 2 em 2 horas porque o
galpão mexe o dia inteiro.

## Fluxo
1. **Gatilho** · Agendador do Windows na `SRV-IA` (tarefa `Inventario - Sync`), às 07:05, 09:05, 11:05, 13:05, 15:05, 17:05, 19:05 e 22:05
   - **Atenção:** ainda não instalada (2026-10-19); fora do horário, `ATUALIZAR AGORA.bat` roda uma carga sem mexer em tarefa
2. **Processa** · `executar.py` (com `pythonw`, em `C:\BI\INVENTARIO`) chama o `sync_inventario.py` ([[data-warehouse]])
   - **Se falhar:** erro antes de o log existir vai para `falha_inicial.log`; a tranca do `bi_comum.py` pula a rodada se já houver outra carga
3. **Lê** · [[WinThor]] (Oracle, leitura): `PCLOGDESBLOQUEIO` (266 e companhia, desde 2025), `PCINVENTROT` + `PCLOGATUALIZAINVENT` (1147), `PCEST`, `PCPRODUT`, `PCEMPR`, `PCTABDEV`, `PCFILIAL`
4. **Grava** · [[Supabase]] DATA WAREHOUSE, schema `inventario`: `TRUNCATE` + `INSERT` nos fatos (o livro em lotes de 50 mil), upsert nos cadastros; registra cada passo em `controle_carga`
5. **Confere** · `conferencia_1147`: os ajustes da 1147 no banco contra os EI/SI que a 1147 lançou no PCMOV (quantidade e valor); diferença vira `AVISO`
6. **Processa** · monta o pacote do painel (`painel_dados()`), comprime em gzip e guarda em `inventario.painel_cache` (passo `pacote`)
   - **Se falhar:** a tela segue com o pacote anterior
7. **Entrega** · painel do [[MOVIMENTAÇÃO DE INVENTÁRIO]]: a API lê o `painel_cache`; o navegador só baixa de novo quando a versão muda (botão Atualizar)

## Duração medida (2026-10-19, 18:38, LOGISTICA-55, pelo `executar.py`)
**31 s:** cadastros 2,6 s, posição 0,5 s, inventário 0,5 s, livro de bloqueio 9,3 s (201.050 linhas), conferência 0,2 s, pacote 17 s
(6 s com o banco quente). 9 passos `OK` em `inventario.controle_carga`.

**A carga entrou?** Responde `inventario.controle_carga` (um registro por passo, mais a `conferencia_1147` e o `pacote`), não o log.

## Atualizar agora e diagnóstico
- `P:\INTEGRAÇÃO BI\INVENTARIO\ATUALIZAR AGORA.bat` (na `SRV-IA`): copia o ETL mais novo para `C:\BI\INVENTARIO` e roda uma carga; fora da `SRV-IA` pede `SIM`.
- `DIAGNOSTICO.bat`: roda tudo sem gravar e confere a 1147 contra o PCMOV mês a mês; avisa programa novo no livro de bloqueio.
- O instalador avisa (e pede `SIM`) se a máquina não for a `SRV-IA` — a falta disso era pendência do instalador do Reposições.
