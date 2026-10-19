---
tipo: rotina
departamento: Logística
status: ativo
frequencia: "a cada 5 minutos, o dia inteiro"
tags: [bi, reposicao, agendador, desempenho]
---
# Reposições - Aquecer painel

**Quando:** de 5 em 5 minutos, o dia inteiro (tarefa `Reposicoes - Aquecer painel`, criada pelo instalador junto com a [[Reposições - Sync]]).
**Onde:** Agendador de Tarefas do Windows, na máquina do ETL, `C:\BI\REPOSICOES`, via `executar.py --alvo aquecer_painel.py`.
**O que faz:** chama `PAINEL_URL/api/dados` (o endereço do painel na [[Vercel]], que está no `ENV` — não é segredo). Isso mantém a resposta no CDN sempre renovada: quem abre o [[REPOSIÇÕES E CHAMADOS]] recebe a cópia na hora, e a espera por uma conexão com o banco — que em 07/10 chegou a 60 s — fica com o aquecedor, nunca com quem está mostrando o sistema.
**Prova de que funciona:** `C:\BI\REPOSICOES\aquecer_painel.log`, uma linha por chamada: `OK 200 0.4s 241 KB cdn=HIT idade=9s origem=cache linhas=6001`. `cdn=HIT` ou `STALE` = veio do CDN. Linha `ERRO` ou falta de linhas recentes = o aquecedor parou (tarefa não instalada, máquina suspensa, sem rede).

**Como ele aparece do outro lado:** User-Agent `Lube-Aquecedor/1.0 (+reposicoes)`. É por ele que se reconhece o aquecedor nos logs da [[Vercel]]. Não manda cabeçalho de autorização: nome não é prova de identidade, e para passar por um guarda com login ele vai precisar de um segredo próprio, como o agendador do [[GESTÃO TI]] (`CRON_SECRET`, ver [[SENTINELA LUBE]]) — mudança de código ainda não feita.
**Gatilho:** diário às 00:00, repetindo de 5 em 5 minutos (criado pelo `instalar_e_agendar.ps1`, que também cria a carga).
**Modo de logon:** o instalador testa senha guardada, depois S4U, depois interativo, e fica com o primeiro que dispara de verdade. Se cair no **interativo**, o aquecedor (e a carga das 22:35) **só roda com o Windows logado** — pode bloquear a tela, não pode deslogar. O resumo do fim do instalador diz qual modo ficou.

**Status: agendada em 2026-10-09 (~14:07) pelo Júlio, com o `INSTALAR TUDO.bat`.** O instalador criou a tarefa `Reposicoes - Aquecer painel` ("a cada 5 minutos") no modo **senha guardada** (roda com o usuário deslogado), na conta `LUBE\gti.julio.alves`, pasta `C:\BI\REPOSICOES`. Não foi na `LOGISTICA-55` (lá não há tarefa nem pasta); a tela não mostra o nome da máquina — esperado `SRV-IA`, **confirmar**. Antes disso foi só testado à mão (2026-10-07 e, pelo `ATUALIZAR AGORA.bat`, em 2026-10-09 13:37). Instalar numa máquina só.
**Conferido em 2026-10-19 (log da `SRV-IA`, só até 18/10): a tarefa dispara direitinho, mas NÃO esquenta nada.** Em 17/10 08:00 a 18/10 23:55 foram **480 chamadas, de 5 em 5 min (maior intervalo 5,0 min), e as 480 deram `ERRO`** — `URLError: [SSL: CERTIFICATE_VERIFY_FAILED] … unable to get local issuer certificate`; **nenhuma linha `OK`** em todo o arquivo. (O log guarda só as últimas 600 linhas, ~50 h, por isso não mostra antes de 17/10; o [[GUARDIÃO DA LUBE]] já tinha provado a falha em 2026-10-14.) O Python da VM não confia na cadeia de certificados do `vercel.app`. **Efeito hoje: pequeno** — o painel segue abrindo na hora porque o CDN entrega a cópia velha enquanto renova (`stale-while-revalidate` de 24 h) e a carga renova o `painel_cache`; o que fica descoberto é a primeira visita depois de um deploy ou de 24 h sem ninguém abrir. **Falta consertar** (decisão do Júlio, na VM): ver as opções em [[REPOSIÇÕES E CHAMADOS]].
**Atenção:** se a [[SENTINELA LUBE]] passar a exigir login neste painel, o aquecedor também será barrado e deixará de aquecer — precisará de um caminho liberado para ele.

## Fluxo
1. **Gatilho** · Agendador do Windows na máquina do ETL (tarefa `Reposicoes - Aquecer painel`), de 5 em 5 minutos, o dia inteiro
   - **Atenção:** máquina esperada `SRV-IA`, a confirmar (não é a `LOGISTICA-55`); instalar numa máquina só
2. **Processa** · `executar.py --alvo aquecer_painel.py` (em `C:\BI\REPOSICOES`) chama `PAINEL_URL/api/dados`, o painel na [[Vercel]]
   - **Atenção:** só manda o User-Agent `Lube-Aquecedor/1.0 (+reposicoes)`; se a [[SENTINELA LUBE]] exigir login, ele é barrado
3. **Lê** · a [[Vercel]] responde do CDN e mantém a cópia renovada, lendo `reposicao.painel_cache` no [[Supabase]]
4. **Grava** · uma linha por chamada em `C:\BI\REPOSICOES\aquecer_painel.log`: `OK 200`, tempo, `cdn=HIT` ou `STALE`
   - **Se falhar:** linha `ERRO` ou sem linhas recentes = aquecedor parado (tarefa não instalada, máquina suspensa, sem rede)
   - **Atenção:** em 2026-10-19 o log da `SRV-IA` mostrou **480 de 480 chamadas com `ERRO` de certificado** (17 e 18/10) e nenhuma `OK` — o aquecedor não está esquentando
5. **Entrega** · quem abre o [[REPOSIÇÕES E CHAMADOS]] recebe a cópia na hora; a espera pelo banco (60 s em 2026-10-07) fica com o aquecedor
