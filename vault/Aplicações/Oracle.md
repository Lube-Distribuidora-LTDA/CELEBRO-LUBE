---
tipo: app
status: em uso
tags: [aplicacao, banco]
---
# Oracle

Banco de dados do [[WinThor]]. Acesso só de dentro da rede da empresa. Conexão descrita em [[data-warehouse]]
(`192.168.0.5:1521`, service `WINT`, modo thin; senha só no `ENV`). Tabelas e campos em [[Glossário WinThor]].

## Quem lê (2026-10-09)
- Os ETLs do [[BI COMPRAS]] e do [[BI COMERCIAL]], na VM `SRV-IA`, e o do [[REPOSIÇÕES E CHAMADOS]] (ainda sem
  agendamento). **Só leitura**, com o usuário do ETL.
- A ponte do [[PAINEL ICMS]], na máquina do Júlio (não passa pelo DATA WAREHOUSE).
- O Claude Code, quando roda na máquina do Júlio (conectou e carregou em 2026-09-28).

## Quem escreve
- A [[Abertura de margem]] foi feita para escrever (`UPDATE` em `PCPRODFILIAL.PERCMARGEMMIN`) com um **usuário
  próprio de escrita**, separado do de leitura. Em 2026-10-09 essa credencial **ainda não foi cadastrada**: o sistema
  não executa.
- Os 8 `.bat` antigos de `Z:\Alexandre TI\BATS` fazem a mesma coisa, com a senha em texto claro — pendência da
  [[Abertura de margem]].
- Abrir o chamado do [[SAC]] também no WinThor (`PCMANIF`) foi levantado em 2026-10-09, mas não existe ainda.
