---
tipo: conversa
data: 2026-09-23
projeto: "[[BI COMPRAS]]"
status: resumido
tags: [conversa, bi, compras, agendador, vercel]
---
# 2026-09-23 — agendamento do BI COMPRAS, acesso ao painel e skill data-warehouse

## Resumo
Conversa de dois dias (22 e 23/09). O agendamento do [[BI COMPRAS]] passou a funcionar sozinho depois de encontrarmos a causa real de uma falha silenciosa; a proteção de acesso do painel na [[Vercel]] foi desligada a pedido do Júlio; e a skill [[data-warehouse]] foi criada para que todo sistema novo siga o mesmo caminho sem precisar reexplicar nada.

## O problema que travou o agendamento
As tarefas eram acionadas, o `LastRunTime` atualizava, e **o Python nunca rodava** — sem log, sem erro, sem janela. A causa só apareceu no log operacional do Agendador de Tarefas:

> O Agendador não iniciou a tarefa "BI Compras - Sync rapidas", pois o usuário **"LUBE\Administrador"** não estava conectado.

O instalador lia `$env:USERNAME` **dentro da janela elevada**. Como o UAC pede credencial de administrador, essa janela é de outra conta, e uma tarefa registrada para o `Administrador` nunca roda, porque essa conta nunca está logada. Erro do script, não do Júlio.

Antes disso foram descartadas, uma a uma: pasta de rede, `-WorkingDirectory` em UNC, falta de biblioteca, `.ps1` lido como ANSI e falta de privilégio.

## Decisões
- 2026-09-22: **executar o ETL de `C:\BI\COMPRAS`, não da pasta de rede.** A sessão da tarefa não tem o `P:` mapeado e pode não alcançar o `\\servidor`. A pasta de rede segue sendo onde o código é editado.
- 2026-09-22: **desligar a proteção de acesso do painel na Vercel.** O link levava a uma tela "Log in to Vercel" para quem não é do time. Júlio optou por liberar para qualquer pessoa com o endereço, ciente de que isso expõe faturamento, margem e custo por fornecedor. O `X-Robots-Tag: noindex, nofollow` mantém o painel fora dos buscadores — discrição, não controle de acesso.
  **Substituída em 2026-10-06** pela decisão do Júlio de abrir todos os sistemas só para quem tem acesso pelo Painel
  Lube: o painel passou a ser fechado pela [[SENTINELA LUBE]].
- 2026-09-23: **criar a skill [[data-warehouse]]** com o manual do caminho inteiro, incluindo os dados de conexão do [[Oracle]]/[[WinThor]] e do [[Supabase]].
- 2026-09-23: **senhas não entram na skill nem no vault**, mesmo com o Júlio autorizando. A skill fica na conta Claude e sincroniza para toda sessão futura, então o "ninguém acessa meu computador" não a protege — e as senhas não são necessárias, porque o pipeline lê do `ENV` e a função da Vercel lê da variável de ambiente.
- 2026-09-23: **um schema por sistema, sem misturar fatos.** Ver [[Como eu gosto dos BIs]].

## O que foi criado ou mudou
- `etl/executar.py`: chama o sync dentro de um `try/except` e grava falhas em `falha_inicial.log`. Sem ele, um erro anterior ao logging é invisível.
- `etl/_teste_agendador.py`: tarefa-cobaia de 2 segundos que prova se um modo de logon realmente dispara um processo.
- `etl/instalar_e_agendar.ps1`: reescrito. Passa o usuário da janela normal para a elevada, confere as bibliotecas antes de criar as tarefas, e testa senha guardada → S4U → interativo, ficando com o primeiro que funcionar.
- [[data-warehouse]]: skill nova, salva.
- [[BI COMPRAS]]: agendamento em produção (na época, na LOGISTICA-55), painel sem proteção.
- [[BI Compras - Sync rapidas]] e [[BI Compras - Sync faturamento]]: durações reais medidas.

## Medições da primeira madrugada (23/09)
Todas as cargas rodaram sozinhas, com a tela bloqueada, no modo "roda mesmo com você deslogado". 28 execuções, zero erros.

| Carga | Início | Fim | Linhas |
|---|---|---|---|
| rápidas 23:50 | 23:50:03 | 23:50:34 (31s) | 59.159 |
| faturamento 02:50 | 02:50 | 02:55 (315s) | 1.622.488 |
| rápidas 07:50 | 07:50:41 | **07:59:06** (8m25s) | 59.152 |

A carga da manhã é **dezesseis vezes mais lenta** que a da meia-noite — é o Oracle sob carga no começo do expediente. Ela terminou 54 segundos antes das 08:00: a folga de 10 minutos virou menos de um minuto.

## Pendências
- [ ] Antecipar a carga rápida da manhã de 07:50 para **07:30**, dando 30 minutos de folga — aguardando o ok do Júlio
- [ ] Medir as cargas das 11:50 e 17:50 sob carga real antes de mexer nelas (desde 2026-09-28 rodam na VM SRV-IA)
- [ ] Commit e push dos arquivos novos no repositório `Desktop\BI\6. COMPRAS` — em 2026-10-09 os 5 scripts de
  agendamento e as mudanças do README seguiam sem commit (lista em [[BI COMPRAS]])
- [x] ~~Conferir se a máquina do ETL suspende à noite~~ — superado em 2026-09-28: o ETL foi para a VM SRV-IA
  ([[2026-09-28 — ETL do BI COMPRAS levado para a VM]])
- [x] Pasta obsoleta `ESTOQUE_VENDA` — já não existe (conferido em 2026-10-09). Seguem na raiz de `P:\INTEGRAÇÃO BI`:
  `.env.example`, `.env.txt` vazio e a pasta `Claude outputs`.
- [ ] Diagnosticar na origem o `PCPRODUT.OBS2`, cujo `DECODE` sem `ELSE` devolve nulo

Veja também [[Como trabalhar comigo]] e [[Mapa de sistemas]].
