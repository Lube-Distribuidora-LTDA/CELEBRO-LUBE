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

**Status: agendada em 2026-10-09 (~14:07) pelo Júlio, com o `INSTALAR TUDO.bat`.** O instalador criou a tarefa `Reposicoes - Aquecer painel` ("a cada 5 minutos") no modo **senha guardada** (roda com o usuário deslogado), na conta `LUBE\gti.julio.alves`, pasta `C:\BI\REPOSICOES`. Não foi na `LOGISTICA-55` (lá não há tarefa nem pasta); a tela não mostra o nome da máquina — esperado `SRV-IA`, **confirmar**. Ainda **não conferi** o `aquecer_painel.log` dessa máquina: a prova de que está esquentando é uma linha nova a cada 5 min com `cdn=HIT` ou `STALE`. Antes disso foi só testado à mão (2026-10-07 e, pelo `ATUALIZAR AGORA.bat`, em 2026-10-09 13:37). Instalar numa máquina só.
**Atenção:** se a [[SENTINELA LUBE]] passar a exigir login neste painel, o aquecedor também será barrado e deixará de aquecer — precisará de um caminho liberado para ele.

## Fluxo
1. **Gatilho** · Agendador do Windows na máquina do ETL (tarefa `Reposicoes - Aquecer painel`), de 5 em 5 minutos, o dia inteiro
   - **Atenção:** máquina esperada `SRV-IA`, a confirmar (não é a `LOGISTICA-55`); instalar numa máquina só
2. **Processa** · `executar.py --alvo aquecer_painel.py` (em `C:\BI\REPOSICOES`) chama `PAINEL_URL/api/dados`, o painel na [[Vercel]]
   - **Atenção:** só manda o User-Agent `Lube-Aquecedor/1.0 (+reposicoes)`; se a [[SENTINELA LUBE]] exigir login, ele é barrado
3. **Lê** · a [[Vercel]] responde do CDN e mantém a cópia renovada, lendo `reposicao.painel_cache` no [[Supabase]]
4. **Grava** · uma linha por chamada em `C:\BI\REPOSICOES\aquecer_painel.log`: `OK 200`, tempo, `cdn=HIT` ou `STALE`
   - **Se falhar:** linha `ERRO` ou sem linhas recentes = aquecedor parado (tarefa não instalada, máquina suspensa, sem rede)
   - **Atenção:** o log da máquina agendada ainda não foi conferido (agendado em 2026-10-09)
5. **Entrega** · quem abre o [[REPOSIÇÕES E CHAMADOS]] recebe a cópia na hora; a espera pelo banco (60 s em 2026-10-07) fica com o aquecedor
