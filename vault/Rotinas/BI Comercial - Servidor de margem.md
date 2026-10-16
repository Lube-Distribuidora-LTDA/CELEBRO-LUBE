---
tipo: rotina
departamento: Comercial
status: ativo
frequencia: "sempre no ar"
tags: [bi, comercial, margem, agendador]
---
# BI Comercial - Servidor de margem

**Quando:** sobe junto com a máquina e fica no ar o tempo todo (gatilhos *ao
iniciar* e *ao fazer logon*, com reinício automático a cada 2 minutos se cair,
até 5 vezes). **Desde 2026-10-01, um terceiro gatilho de 30 em 30 minutos** com
`MultipleInstances IgnoreNew`: com o servidor no ar a tentativa é descartada; se
ele caiu por qualquer motivo, volta em no máximo meia hora. "Reiniciar N vezes"
não cobre uma queda mais longa que N × intervalo — foi o que deixou o sistema a
manhã de 01/10 fora do ar.
**Onde:** Agendador de Tarefas da **VM `SRV-IA`** (192.168.12.30), rodando de
`C:\BI\COMERCIAL`, em modo *Password* (roda sem ninguém logado). Até 2026-10-01
rodava na estação `LOGISTICA-55`; a tarefa de lá foi apagada no mesmo dia.
**O que faz:** serve a página da [[Abertura de margem]] para a rede, em
**`http://SRV-IA:8080`** (porta liberada no firewall da VM).

Recriada pela última vez em 2026-10-09, na reinstalação da `SRV-IA`. Para ver se
está de pé: `CONFERIR SERVIDOR.bat`, na raiz de `P:\INTEGRAÇÃO BI\COMERCIAL`.

Ao contrário das cargas, esta tarefa **não tem limite de tempo de execução** — um
limite mataria o servidor no meio do expediente.

Para subir na mão e ver a janela: `iniciar_servidor_margem.bat`, na mesma pasta.
É o único `.bat` que sobrou desta história, e ele não mexe em nada no WinThor: só
liga o programa.

## Fluxo
1. **Gatilho** · Agendador da VM `SRV-IA` (modo Password): ao iniciar, ao fazer logon e de 30 em 30 min com `IgnoreNew`
   - **Se falhar:** reinicia a cada 2 min, até 5 vezes; numa queda mais longa, o gatilho de 30 min o traz de volta
2. **Processa** · `executar.py --alvo` sobe o `servidor_margem.py` em `C:\BI\COMERCIAL`, porta 8080, sem limite de tempo
   - Sobe mesmo sem banco: a página mostra o erro e reconecta sozinha na primeira consulta que der certo
   - **Se falhar:** conferir com o `CONFERIR SERVIDOR.bat` (raiz de `P:\INTEGRAÇÃO BI\COMERCIAL`) e o `servidor_margem.log`
3. **Lê** · [[Supabase]] DATA WAREHOUSE: o que está aberto, em `comercial.fato_margem_filial`, foto trazida pelo [[BI Comercial - Sync rapidas]]
4. **Pessoa** · alguém do comercial abre `http://SRV-IA:8080` e pede abrir ou fechar o piso de margem, com nome, data e motivo
5. **Confere** · `comercial.margem_registrar`, no banco: quem abriu é quem fecha (bloqueio total); produto sem dono, qualquer um fecha
   - **Atenção:** sem a lista de quem pode usar no `ENV` (faltava em 2026-10-09), o nome é digitado livre
6. **Grava** · [[WinThor]] na hora: `PCPRODFILIAL.PERCMARGEMMIN` (abrir = `NULL`, fechar = piso, padrão 5%); valor anterior em `comercial.margem_alteracao`
   - **Atenção:** em 2026-10-09 faltava a credencial de escrita no `ENV`: o pedido termina em erro e nada chega ao WinThor
   - **Se falhar:** a tarefa "BI Comercial - Agente de margem", de 1 em 1 min, termina o pedido pendente ou marca erro com o motivo
7. **Entrega** · página da [[Abertura de margem]] na rede: abertos por filial, de quem, há quanto tempo e histórico; só consulta no [[BI COMERCIAL]]

## A outra tarefa, a de 1 minuto

**BI Comercial - Agente de margem** continua existindo, mas mudou de papel. Ela
não é mais o caminho normal: o servidor executa na hora, porque está dentro da
rede. Ela é a rede de segurança — se um pedido for registrado e a execução falhar
no meio (máquina reiniciou, Oracle fora do ar), o agente pega o pedido pendente e
termina o serviço, ou marca erro com o motivo escrito. Pedido preso em
"executando" volta para a fila depois de 15 minutos e, após 3 tentativas, vira erro.

Também roda **só na `SRV-IA`** desde 2026-10-09 (até lá a `LOGISTICA-55` também
tinha esta tarefa). O log dela, `agente_margem.log`, cresce cerca de 5.700 linhas
por dia de "Nada na fila" (4,3 MB em 2026-10-09) — o Claude ofereceu registrar só
quando houver algo; sem resposta ainda.

Ver também: [[BI Comercial - Sync rapidas]], [[BI Comercial - Sync margem]],
[[BI COMERCIAL]].
