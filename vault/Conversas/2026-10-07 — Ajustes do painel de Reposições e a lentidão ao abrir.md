---
tipo: conversa
data: 2026-10-07
projeto: "[[REPOSIÇÕES E CHAMADOS]]"
departamento: Logística
status: resumido
tags: [conversa, bi, reposicao, desempenho, supabase, incidente]
---
# 2026-10-07 — Ajustes do painel de Reposições e a lentidão ao abrir

## Resumo
Dois pedidos do Júlio no mesmo dia. **De manhã:** ajustes no painel já publicado — renomear a coluna "Itens" para "SKU" em Motivos, filtro de **Cliente** no cabeçalho, card do **cliente que mais fez reposições**, **clique em tudo abrindo o Detalhe já filtrado** e tooltip mais bonito nos gráficos. **À tarde:** o sistema demorava muito na tela "lendo o banco", o que gera frustração "principalmente na frente da empresa que estou mostrando". Medi, achei que o banco/pooler do Supabase estava saturado (reiniciou sozinho às 14:14) e redesenhei a abertura para o painel **não depender do banco** — provado com o banco travado: 0,18 s. Continuação de [[2026-10-06 — Dashboard de Reposições e Chamados]]; projeto em [[REPOSIÇÕES E CHAMADOS]].

## Parte 1 — os ajustes pedidos
- **SKU:** ao renomear, o número estava errado para o nome novo. A coluna contava linhas de item (pedido × produto) — **1.201** em "Falta de mercadoria"; SKU são produtos distintos — **761**. Corrigido na tabela de Motivos e nos textos "itens distintos" da Visão geral.
- **Filtro Cliente:** mais de 2 mil clientes; a lista mostra os 300 que mais pedem e o resto vem pela busca.
- **Card "Cliente que mais fez reposições":** mais pedidos distintos; empate vai para o maior valor. Em 2026-10-07: 12 reposições, R$ 1.257,18 (o nome do cliente aparece no card).
- **Clique → Detalhe filtrado:** todo cartão, barra (e cada cor da barra), ponto do acumulado, média anual, ranking e linha de tabela. O clique **troca só a dimensão clicada** e mantém o resto; **← Voltar** restaura a tela e os filtros de antes. Item e fornecedor, que não têm controle na barra, aparecem numa **faixa** sob os filtros com ✕. Conferi uns 20 caminhos com o dado real (ex.: cartão "sem chamado" = R$ 45.081,63 em 241 reposições; Falta de mercadoria = R$ 100.024,35; o motorista com mais chamados = 125 chamados, R$ 12.509,03; o nome fica no painel, não aqui).
- **Tooltip:** um cartão por mês (escuro, borda dourada), com cada série, total, reposições do mês, % com chamado e a dica do clique; a coluna inteira fica destacada. A posição do cartão depois de rolar a página foi corrigida. O tooltip dos **gráficos de linha** não foi conferido com os olhos: as capturas de tela estouravam o tempo (janela minimizada).
- Enviado no commit `fee976d` (no ar às 11:33), com o README atualizado.

## Parte 2 — "o sistema demora muito para abrir"
- **Medi antes de mexer** (no painel publicado, `reposicoes-web.vercel.app`): a página abre em 0,3 s; a `/api/dados` deu **504 depois de 60 s**, depois 13 s, depois 0,16 s. A consulta nunca foi o problema: o tempo era conseguir uma conexão.
- **Primeiro diagnóstico, errado em parte:** "o pooler esfria quando fica parado". Um teste de ociosidade desmentiu — 2 e 5 min parado conectaram em 0,15 s; aos 10 min falhou com `ECHECKOUTTIMEOUT ... Session mode` (**pool esgotado**), e 56 s depois o banco reiniciou sozinho (14:14); depois do reinício, 15 min parado conectou em 0,20 s. Nos logs: a consulta de monitoramento do Supabase estourando o tempo ~50×/h desde as 08:00. Detalhes em [[Supabase]] (incidente de 07/10).
- **Uma carga que ontem levou 7 s levou 4 min** (55, 74 e 95 s por consulta, com o Oracle respondendo na hora) — o sinal de que o problema estava no Supabase.
- **Solução, que vale com ou sem crise:** o painel deixou de ler o banco quando alguém abre. Resposta pronta guardada pela carga (`reposicao.painel_cache`), CDN da Vercel com `stale-while-revalidate`, aquecedor agendado de 5 em 5 min ([[Reposições - Aquecer painel]]), cópia no navegador (IndexedDB) e tela de espera com relógio e motivo. **Prova:** com o banco travado, a API publicada respondeu em **0,18 s** (`X-Vercel-Cache: STALE`); depois do reinício, 0,5 s na primeira chamada e 0,28 s nas seguintes.
- Peças: `painel_cache` é uma linha só (`id = 1`, `gerado_em`, `carga`, `payload`), preenchida na primeira vez com um JSON de 1,4 MB; a API diz de onde veio a resposta no cabeçalho `X-Painel-Origem`; o aquecedor se identifica como `Lube-Aquecedor/1.0 (+reposicoes)` e foi testado contra o painel publicado; o servidor local ganhou `--atraso=` / `ATRASO_API_MS` para simular banco lento (com 9 s, a segunda visita abriu em ~1 s). A carga foi rodada de novo pelo `executar.py`, já com o passo do cache, e `controle_carga` e `painel_cache` foram conferidos.
- O padrão virou parte do manual: [[data-warehouse]], seção 8b.

## Decisões
- 2026-10-07 (Claude): **o clique troca só a dimensão clicada**; o Voltar devolve tudo. Item e fornecedor ficam na faixa, não na barra.
- 2026-10-07 (Claude): ao renomear para SKU, **corrigir a conta** para produtos distintos — o número antigo não correspondia ao nome novo.
- 2026-10-07 (Claude): **"Atualizar" usa a cópia do CDN** — a carga só muda quando o ETL roda, então furar o cache a cada clique só faria quem está mostrando esperar o banco. Shift+clique lê direto do banco.
- 2026-10-07 (Claude): **o painel não lê o banco na hora de abrir.** Quem espera o banco é o robô, não a pessoa ([[Como eu gosto dos BIs]]).
- 2026-10-07 (Claude): busca com `no-store` e cópia explícita no IndexedDB, em vez de confiar no cache HTTP do navegador.
- 2026-10-07 (Claude): **a primeira visita depois de um deploy segue fria** — aceito; o aquecedor cobre o resto.
- 2026-10-07 (Claude): o desenho vira padrão para os próximos painéis ([[data-warehouse]], seção 8b).

## Erros meus nesta conversa (para não repetir)
- **"Conexão fria de 35 s"** foi leitura errada: era pool saturado. Só o teste de ociosidade — que eu mesmo montei para checar — mostrou isso. Diagnóstico de lentidão pede medida **antes** e **depois**.
- A primeira versão da conexão abria **3 tentativas em paralelo** contra um pooler esgotado: no melhor caso inútil, no pior mais carga. Só a revalidação (a cada 5 min) usa isso, mas não é o que resolve; o que resolve é ninguém depender do pooler.
- O **`stale-while-revalidate` fazia o Chrome entregar a resposta velha do cache HTTP dele em 2 ms, sem avisar** (dado de uma visita atrás). A busca passou a ser `no-store`; a cópia guardada é explícita e diz "dados guardados · atualizando…".
- Um escape no meu script de edição colocou caracteres de controle em texto (um `\a` virou campainha no README, um `\1` virou `\x01`). Varri todos os arquivos do repositório atrás de caracteres de controle depois disso.
- Menores: no teste local a primeira leitura do banco demorou (ainda era a saturação); o `Write` em `_db.js` e `dados.js` falhou na primeira vez por eles não terem sido lidos antes; o script que remendava o instalador procurou um arquivo em `/tmp` que não existia (refeito no scratchpad); um comando longo para atualizar as notas falhou por heredoc e foi refeito por script Python.

## O que foi criado ou mudou
- Repositório [Lube-Distribuidora-LTDA/REPOSICOES](https://github.com/Lube-Distribuidora-LTDA/REPOSICOES): commits `fee976d` (ajustes), `e3cce06` (desempenho), `c5ab85e` e `5b6a0bd` (README).
- DATA WAREHOUSE: migração `reposicao_05_painel_cache` (tabela + `atualizar_painel_cache()`).
- ETL: `aquecer_painel.py`, passo novo no `sync_reposicao.py`, instalador com a tarefa do aquecedor, `PAINEL_URL` no `ENV` da rede.
- [[REPOSIÇÕES E CHAMADOS]], [[Reposições - Aquecer painel]] (nova), [[Reposições - Sync]], [[Supabase]], [[Vercel]], [[data-warehouse]], [[Como eu gosto dos BIs]], [[Como trabalhar comigo]], [[Mapa de sistemas]] e o [[CLAUDE.md|CLAUDE.md]]: atualizados.

## Pendências
**Em andamento:** o código está todo no ar (conferido em 2026-10-08, [[2026-10-08 — Conferência do deploy do Reposições]]), mas o painel só fica a salvo da lentidão e com números novos depois que a carga e o aquecedor forem agendados — o que ainda não aconteceu.
- [ ] **Agendar** — Júlio: `P:\INTEGRAÇÃO BI\REPOSICOES\INSTALAR TUDO.bat` (cria a carga **e** o aquecedor). Numa máquina só, de preferência a VM `SRV-IA` ([[Reposições - Sync]]).
- [ ] Conferir com os olhos o tooltip dos gráficos de linha no painel publicado.
- [ ] **Antes de uma demonstração:** abrir o painel uma vez no computador da apresentação, para ele guardar a cópia.
- [ ] Supabase: olhar *Reports → Database* (CPU e Disk IO) e decidir sobre o tamanho do compute; conferir a hipótese do `pg_stat_statements` inchado (consulta em [[Supabase]]).
- [ ] Levar o desenho do painel rápido aos outros painéis (COMPRAS, COMERCIAL, FINANCEIRO), que leem o banco a cada abertura a frio.
- [ ] Instalar o guarda da [[SENTINELA LUBE]] neste painel — e dar ao aquecedor um caminho liberado.
- [ ] Decidir se o repositório fica público ou vira privado.
- [ ] Levar a correção do diagnóstico também para o código: o README foi corrigido (`5b6a0bd`), mas os comentários de `web/api/_db.js` e `etl/aquecer_painel.py` ainda falam em "conexão a frio" e "painel que esfria" (achado em 2026-10-09; lista completa em [[REPOSIÇÕES E CHAMADOS]], Pendências).
