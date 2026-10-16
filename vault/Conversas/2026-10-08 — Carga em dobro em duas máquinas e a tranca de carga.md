---
tipo: conversa
data: 2026-10-08
projeto: "[[BI COMERCIAL]]"
departamento: Comercial
status: resumido
tags: [conversa, bi, comercial, etl, agendador, incidente]
---
# 2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga

Terminou em 2026-10-09.

## Resumo
O Júlio perguntou se o script estava abastecendo o banco nos horários certos. **Os horários estavam certos**; o
problema era que as tarefas do ETL do [[BI COMERCIAL]] existiam em **duas máquinas** (a VM `SRV-IA` e a estação
`LOGISTICA-55`), e as cargas se atropelavam no lock. O Claude criou uma tranca de carga e corrigiu uma regressão
dele no `carregar_env`. Em 2026-10-09 o Júlio apagou as tarefas da estação e reinstalou na VM; a duplicação
acabou.

## Decisões
- 2026-10-08 (Claude): apagar a tarefa duplicada resolve o caso; **a tranca no banco resolve a classe**, não
  importa quantas máquinas tenham a tarefa.
- 2026-10-08 (Claude): carga recusada pela tranca **sai com código 0** — sair com erro faria o Agendador
  reiniciar uma tarefa que está certa em não rodar.
- 2026-10-09 (Júlio): a carga fica **só na `SRV-IA`**; as tarefas da estação foram apagadas por ele.
- 2026-10-09 (Claude): **nada se copia direto para a VM** — sempre pela pasta de rede e pelo instalador.

## O que foi enfrentado
- Desde 2026-10-01 as duas máquinas truncavam e inseriam nas mesmas tabelas no mesmo minuto. Uma ganhava; a
  outra morria aos 120 s do `statement_timeout` esperando o lock (`while locking tuple in relation
  "dim_cliente"`).
- **Estrago medido:** a `margem_item` (3,3 milhões de linhas) falhou na primeira tentativa todas as noites desde
  02/10 e **não carregou em 02/10 nem em 05/10** (o rollback guardou a véspera; o painel nunca ficou vazio). Nas
  48 h até 09/10, 9 falhas na `comissao_nf` e 5 na `dim_cliente`. A carga em dobro também dobrava o peso no
  Supabase.
- Uma consulta de diagnóstico pelo MCP expirou (`statement timeout`) com o banco pesado.
- **Conferido em 2026-10-09, pelos arquivos e logs de cada máquina:** a VM tinha as cargas desde **2026-09-28**
  (17:25), e não desde 01/10; a estação ganhou as tarefas no instalador de **2026-10-01, 09:02**. Por noite, uma
  máquina carregava a margem e a outra falhava; em 02/10 e 05/10 nenhuma das duas completou. Antes, de 29/09 a
  01/10, a VM rodava 4 horas atrasada. Detalhes em [[BI COMERCIAL]] ("Desde quando").

## O que foi criado ou mudou
- `etl/bi_comum.py`: **`tranca_de_carga`** — *advisory lock* do Postgres, uma carga por grupo na empresa
  inteira; a tranca morre com a sessão, então máquina travada não deixa tranca presa. E o **`carregar_env`**
  voltou a achar o `ENV` em `1 - CONFIGURACAO` (regressão da arrumação de 01/10).
  `etl/sync_bi_comercial.py` passou a usar a tranca. Testado com duas sessões simultâneas (a segunda recusada),
  grupos diferentes sem se bloquear, e uma carga de verdade. Commit `bb64f16` (que levou junto o
  `conferir_margem.py` e a extensão do `dim_rca` para o [[SAC]], até então fora do Git).
- `etl/instalar_e_agendar.ps1` leva o `conferir_margem.py` para a VM (commit `21ed527`). Os dois pushes ficaram
  `BLOCKED` na Vercel (repositório privado no Hobby) — sem efeito, porque não mexem no painel.
- Copiados para o `P:`: `bi_comum.py` e `sync_bi_comercial.py` (`2 - SISTEMA COMERCIAL`), `servidor_margem.py`,
  `painel_margem.html` e `conferir_margem.py` (`3 - PAINEL DE ABERTURA DE MARGEM`).
- **2026-10-09:** o Júlio apagou da `LOGISTICA-55` as tarefas "BI Comercial - Sync rapidas", "Sync margem" e
  "Agente de margem"; o Claude confirmou que não sobrou tarefa `BI Comercial*` nem Python rodando. O Claude
  apagou o `conferir_margem.py` que ele mesmo tinha copiado para `\\SRV-IA\C$\BI\COMERCIAL` em 01/10 (dono
  errado). O `INSTALAR TUDO.bat` rodou na `SRV-IA`, as quatro tarefas foram recriadas (inclusive o gatilho de 30
  min do servidor) e, na carga das **09:04**, cada consulta apareceu **uma vez**, todas OK. O servidor de margem
  responde em `http://SRV-IA:8080`.
- [[BI COMERCIAL]], [[BI Comercial - Sync rapidas]], [[BI Comercial - Sync margem]] e
  [[BI Comercial - Servidor de margem]]: atualizadas.

## Erros no caminho
- Regressão do Claude: o `carregar_env` não achava o `ENV` depois da mudança para `1 - CONFIGURACAO`.
- O Claude passou comandos `schtasks` encadeados com `&` (sintaxe do cmd), que o PowerShell não aceita; o certo
  é `;` ou `Get-ScheduledTask 'BI Comercial*' | Unregister-ScheduledTask`.
- Na VM, o caminho com espaço foi digitado sem aspas no PowerShell; o certo é
  `& "P:\INTEGRAÇÃO BI\COMERCIAL\INSTALAR TUDO.bat"` ou o duplo clique no Explorer.
- O `INSTALAR TUDO.bat` parou com **acesso negado** ao sobrescrever o `conferir_margem.py` copiado com outra
  credencial em 01/10; levou parte dos arquivos e parou antes de recriar as tarefas. Rodou inteiro na segunda vez.

## O Júlio, nesta conversa
- Pede para o Claude **conferir direto no banco** se o BI está sendo atualizado e se a carga rodou na hora certa.
- Manda prints da máquina dele e da VM e espera **o próximo passo exato, com o comando pronto para colar**.

## Pendências
- [x] Registrar no cérebro o desfecho de 2026-10-09 — feito em [[BI COMERCIAL]]
- [ ] Investigar os **62 produtos abertos fora do sistema** entre 30/09 e 09/10 (546 → 608, histórico vazio): os
  `.bat` ainda estão em uso? (ver [[Abertura de margem]])
- [ ] Opcional, oferecido pelo Claude: o `agente_margem.log` (4,3 MB na VM, ~5.700 linhas por dia de "Nada na
  fila") registrar só quando houver algo e ser cortado ao passar de um tamanho
- [ ] Júlio: primeiro pedido real de abertura/fechamento e conferência com `python conferir_margem.py --pedido N`
  na `SRV-IA` — antes, falta a credencial de escrita no `ENV`
- [ ] Continuam de pé: `MARGEM_PESSOAS` vazio; senha do WinThor em texto claro nos 8 `.bat` de
  `Z:\Alexandre TI\BATS`
