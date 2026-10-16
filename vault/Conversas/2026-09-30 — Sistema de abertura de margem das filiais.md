---
tipo: conversa
departamento: Comercial
status: ativo
tags: [comercial, margem, winthor, seguranca]
---
# 2026-09-30 — Sistema de abertura de margem das filiais

Com quem: Júlio (TI/CPD).

## O pedido

O Júlio mostrou oito `.bat` em `Z:\Alexandre TI\BATS` — quatro punham
`PCPRODFILIAL.PERCMARGEMMIN = 5` e quatro punham `NULL`, um par por filial (1, 7,
11, 12) — e quis que o próprio pessoal do comercial pudesse fazer isso sozinho,
**obrigando nome, data e motivo**.

Depois evoluiu a ideia: um sistema separado só para isso, com **dashboard**
(quantas vezes abriu, quem abre, quais filiais), rodando como "INDEX" na pasta da
rede, com a regra de que **quem abriu tem que ser quem fecha**.

## O que não dava para fazer como pedido

Um `index.html` aberto da pasta da rede **não executa `.bat` nem fala com o
Oracle**. O navegador impede — e ainda bem: se conseguisse, qualquer página da
internet também conseguiria. Só o IE antigo com ActiveX fazia isso.

O caminho é um programa pequeno rodando numa máquina da rede, que serve a página.
E, nesse desenho, os `.bat` deixam de ser necessários: chamá-los de volta traria a
senha do WinThor escrita dentro do arquivo e perderia o registro — que é
justamente o que faltava.

## Decisões do Júlio

- **Onde mora a operação:** sistema local na rede (não na Vercel).
- **A regra de quem fecha:** *bloqueio total* — ninguém além de quem abriu fecha,
  sem exceção.

## O que foi construído

[[Abertura de margem]], em `etl/servidor_margem.py` + `etl/painel_margem.html`.
Sobe com a máquina pela tarefa [[BI Comercial - Servidor de margem]].

- A tela mostra **antes de executar** quais produtos são de outra pessoa, em vez
  de recusar o pedido no final. A regra em si mora em
  `comercial.margem_registrar`, no banco.
- O estado vem do WinThor (nova consulta `margem_filial`, 137.488 linhas, 6s por
  carga), não do nosso registro. Entre cargas, o agente corrige as linhas que
  acabou de mudar — senão um produto aberto às 10h15 pareceria sem dono até as
  11h, e a regra teria buraco.
- Painel de uso com tudo que o Júlio pediu, e a aba do [[BI COMERCIAL]] na Vercel
  virou **só consulta** (sem POST, sem formulário).

## O ponto que ficou claro no meio do caminho

Os 546 produtos abertos hoje (319 na filial 1, 22 na 7, 56 na 11, 149 na 12) não
têm dono: os `.bat` não registravam ninguém. Sob bloqueio total, ninguém poderia
fechá-los. A saída foi tratar "sem dono" pelo que é — produto sem responsável,
que qualquer um fecha, marcado na tela como *aberto antes do sistema*. Não é
exceção à regra; é a ausência de alguém a quem cobrar.

## Pendências

- [ ] **Senha do WinThor** em texto claro nos `.bat`, numa pasta de rede aberta. O
  plano era trocá-la e só depois apagar os oito arquivos; o [[data-warehouse]]
  registra que a senha do WinThor não se troca — decisão do Júlio pendente (ver
  [[Abertura de margem]]).
- [ ] Cadastrar `ORACLE_USER_ESCRITA` / `ORACLE_PASSWORD_ESCRITA` no ENV —
  **ainda ausentes em 2026-10-09**. A parte de rodar o instalador de novo na VM foi
  feita em 2026-10-01 e 2026-10-09.
- [ ] Definir `MARGEM_PESSOAS` (a lista de quem pode usar). Sem ela o nome é digitado
  livre, e a regra de quem fecha vale pelo que a pessoa escreveu.
- [x] Repositório `GESTAO-COMERCIAL` privado (~2026-10-05) e painel da Vercel
  fechado pela [[SENTINELA LUBE]] (2026-10-06).
- [ ] Apagar a `MARGEM_ATIVA` da Vercel, se tiver sido criada, e cadastrar a
  `MARGEM_ENDERECO` (Júlio).

## Decisões do Claude no mesmo dia
- A primeira versão (aba no painel da Vercel com fila no Supabase e o
  `agente_margem.py` na rede, travada por `MARGEM_ATIVA=sim`) existiu porque o
  painel na Vercel não alcança o Oracle em `192.168.0.5`. Virou rede de segurança
  quando o sistema foi para a rede.
- Sem credencial de escrita, o pedido vira **erro** em vez de ficar preso em
  "executando" (falha achada antes de publicar).
- O painel da Vercel ficou **só consulta**: um botão que muda o cadastro de
  produto não fica num endereço público.

## Os oito `.bat` e o que sobrou do dia
- Nomes, para achar e arquivar: `Definir_margen_5_filial_{1,7,11,12}.bat` (põem 5, **fecham**) e
  `zera_margem_filial{1,7,11,12}.bat` (põem `NULL`, **abrem**). Todos chamam o `sqlplus` com a senha em
  texto claro dentro do arquivo.
- Dois commits no mesmo dia: `0d2571c` (a fila e o agente, migração `comercial_margem_filial`) e `b3bb730` (o
  sistema na rede, migração `comercial_margem_estado_e_regra`).
- Os pedidos de teste (feitos com códigos de produto que não existem) foram **apagados do banco** no fim do dia: a
  fila e o histórico começaram vazios.

## Erros no caminho
- O classificador do modo automático negou um comando encadeado; foi refeito em comandos separados.
- Os heredocs do bash quebravam com `$(` e `$fn$` (o corpo das funções SQL); os patches passaram a ser escritos
  como scripts.

Continuação: [[2026-10-01 — Pasta de rede arrumada e a margem na VM SRV-IA]].

Ver também: [[BI COMERCIAL]], [[WinThor]],
[[2026-09-28 — BI COMERCIAL do Power BI ao DATA WAREHOUSE]].
