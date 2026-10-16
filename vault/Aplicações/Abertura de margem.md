---
tipo: app
departamento: Comercial
status: ativo
tags: [comercial, margem, winthor, rede]
---
# Abertura de margem

Sistema que o comercial usa para **abrir e fechar o piso de margem** dos produtos
por filial. Substitui oito arquivos `.bat` que ficavam em `Z:\Alexandre TI\BATS`:
`Definir_margen_5_filial_{1,7,11,12}.bat` (fecham, piso 5) e `zera_margem_filial{1,7,11,12}.bat` (abrem, `NULL`).

**Onde:** **`http://SRV-IA:8080`** — a VM do BI (`SRV-IA`, 192.168.12.30, IP
fixo), pela tarefa **BI Comercial - Servidor de margem** (ver
[[BI Comercial - Servidor de margem]]). No ar desde 2026-10-01, testado de
outra sub-rede. Nada se instala no computador de quem usa: é só a URL.

A porta 8080 foi liberada no firewall da SRV-IA em 2026-10-01 (regra
"BI Comercial - Abertura de margem", TCP 8080 de entrada). Sem essa regra
a página abre só na própria máquina — e o teste feito ali engana, porque o
tráfego local não passa pelo firewall.

**Como chegou na VM.** Em 2026-09-30 o servidor rodava na estação do Júlio
(`LOGISTICA-55`, IP por DHCP). Em 2026-10-01 o Júlio pediu que ficasse na VM:
`INSTALAR TUDO.bat` na `SRV-IA`, tarefa em modo *Password* (roda sem ninguém
logado), teste de outra máquina e outra sub-rede, por nome e por IP — e só então a
tarefa foi apagada da estação (PowerShell como administrador). O endereço se passa
**pelo nome da máquina**, não pelo IP (Claude). A VM ficou com a versão anterior à
correção da queda do banco (abaixo) até **2026-10-09**, quando a reinstalação a
levou — depois do reboot da estação o `P:` não voltou e a pasta de rede não pôde
ser sincronizada antes.

**Código:** `etl/servidor_margem.py` + `etl/painel_margem.html`, no repositório
`GESTAO-COMERCIAL`.
**Criado em:** 2026-09-30.

## O que "abrir" quer dizer

`PCPRODFILIAL.PERCMARGEMMIN` é a margem mínima que o produto aceita naquela
filial. Quando fica `NULL`, o piso sai do caminho: dá para vender abaixo da
margem. É disso que o comercial fala quando diz "abrir o sistema".

Fechar devolve o piso — o padrão da casa é 5%, mas o valor vai no pedido.

## As três regras

1. **Nome, data e motivo são obrigatórios.** Nada acontece sem eles, e é o que
   fica no histórico. Foi o pedido do Júlio.
2. **Quem abriu é quem fecha**, sem exceção — o Júlio escolheu bloqueio total em
   2026-09-30. A regra mora em `comercial.margem_registrar`, no banco, não na
   tela.
3. **Produto aberto antes deste sistema não tem dono**, porque os `.bat` não
   registravam ninguém. Aí qualquer um fecha. Não é exceção à regra 2: é a
   ausência de alguém a quem cobrar. A tela avisa, e o painel conta quantos são.

## Por que um programa, e não um `index.html` na pasta da rede

A ideia inicial era um `index.html` na rede que "buscasse os `.bat` e
executasse". Não existe: um HTML aberto do disco não executa `.bat` nem fala com
o Oracle — o navegador impede, e ainda bem, senão qualquer página da internet
também conseguiria. A página existe, mas quem executa é o programa, numa máquina
só.

E os `.bat` deixaram de ser necessários de propósito: chamá-los de volta traria a
senha do WinThor escrita dentro do arquivo e perderia o registro — que era
justamente o que faltava.

**A primeira versão, do mesmo dia (2026-09-30, commit `0d2571c`),** era uma aba no
painel da Vercel que só registrava o pedido numa fila no Supabase
(`comercial.margem_solicitacao`); o `agente_margem.py`, dentro da rede, executava de
minuto em minuto. O POST ficava travado pela variável `MARGEM_ATIVA=sim`. Quando o
Júlio pediu um sistema próprio, na rede, com dashboard (commit `b3bb730`), a fila
deixou de ser o caminho normal e a `MARGEM_ATIVA` foi abolida. O que ficou da fila:
o agente como rede de segurança (ver [[BI Comercial - Servidor de margem]]) e o
registro do valor anterior de cada produto (`comercial.margem_alteracao`), que
permite auditar e desfazer.

## O estado vem do WinThor

A consulta `margem_filial` traz `PCPRODFILIAL.PERCMARGEMMIN` das quatro filiais a
cada carga do BI (137.488 linhas, 6 segundos) para
`comercial.fato_margem_filial`. É dali que sai "o que está aberto agora". Se
alguém mexer por fora — no próprio WinThor, ou num `.bat` que sobrou em algum
canto — a tela conta a verdade do mesmo jeito.

Entre uma carga e outra, o `agente_margem.py` corrige as linhas que acabou de
mudar. Sem isso, um produto aberto às 10h15 pareceria fechado (e portanto sem
dono) até as 11h, e nesse intervalo a regra de quem fecha teria buraco.

## O painel de uso

Quantos produtos abertos agora e por filial, de quem é cada um e há quanto
tempo, quem mais abre, quais filiais mais abrem, série por dia e o histórico com
o motivo escrito por cada pessoa. O mesmo painel aparece, **só para consulta**,
na aba *Operação › Margem das filiais* do [[BI COMERCIAL]] na Vercel — lá não há
botão de executar, porque o Oracle não é alcançável de fora e um botão que muda o
cadastro de produto da empresa não precisa existir num endereço público.

## Estado em 2026-09-30, quando o sistema nasceu

546 produtos abertos: **319 na filial 1, 22 na 7, 56 na 11 e 149 na 12**. De
nenhum deles se sabe quem abriu.

## A primeira queda, e o que ela ensinou (2026-10-01)

Às 08:17 o Supabase ficou fora do ar por uns 15 minutos (`{:error, :timeout}`
do pooler). O ETL nem sentiu — a carga das 08:45 passou inteira. Mas o servidor
abria a conexão na partida e **morria** se ela falhasse; a tarefa tentou
reerguer 5 vezes a cada 2 minutos, esgotou em 10, e o sistema passou a manhã
fora do ar por causa de uma piscada.

Corrigido nas duas camadas:

- o servidor **sobe mesmo sem banco** — a falha virou aviso, a página mostra o
  erro, e a primeira consulta que der certo restabelece a conexão sozinha;
- a tarefa ganhou um gatilho **de 30 em 30 minutos** com `IgnoreNew`: se está no
  ar, a tentativa é descartada; se caiu por qualquer motivo, volta em meia hora.
  "Reiniciar N vezes" não cobre indisponibilidade mais longa que N × intervalo.

A lição vale para qualquer serviço da casa: um programa que precisa ficar no ar
não pode tratar o banco como condição de partida.

## Para conferir quando alguém disser que não funciona (2026-10-01)

- **`CONFERIR SERVIDOR.bat`**, na raiz de `P:\INTEGRAÇÃO BI\COMERCIAL`: numa tela só,
  se a tarefa existe, se está rodando, se a porta está liberada, se o servidor
  responde e qual endereço passar. É o primeiro lugar a ir.
- **`conferir_margem.py`**, na `C:\BI\COMERCIAL` da VM, **só leitura** (usuário do ETL):
  `python conferir_margem.py --pedido N` confere produto a produto, no WinThor, se o
  pedido N foi executado como o sistema diz; sem argumento, conta direto do Oracle
  e compara com a tela. Entrou no Git em 2026-10-08.
- **Página aberta com duplo clique** (`file://`) não funciona — o navegador não deixa
  um arquivo local falar com o servidor. Desde 2026-10-01 a tela reconhece o caso e
  manda abrir pelo endereço; o "Failed to fetch" genérico passou a citar as duas
  causas de sempre: servidor parado e firewall barrando a 8080.
- **Log:** `servidor_margem.log`, na mesma pasta. Até 2026-10-01 ele ficava sempre
  vazio e tudo ia para o `agente_margem.log` (o servidor importava o agente antes de
  ligar o próprio log) — quem procurava concluía que o programa nem tinha rodado.

## Estado em 2026-10-09

- **608 produtos abertos** (eram 546 em 30/09), e o histórico do sistema está
  **vazio**: os 62 a mais foram abertos por fora — no WinThor ou num `.bat`.
- **O sistema ainda não executa.** O `ENV` da rede e o da `SRV-IA` só têm as 11
  chaves do ETL: faltam `ORACLE_USER_ESCRITA`, `ORACLE_PASSWORD_ESCRITA` e
  `MARGEM_PESSOAS`. A página abre e mostra o estado, mas um pedido de abrir ou fechar
  termina em erro ("Faltam ORACLE_USER_ESCRITA e ORACLE_PASSWORD_ESCRITA no ENV da
  máquina") em vez de chegar ao WinThor. Nenhum pedido real foi feito até aqui: os de teste de 2026-09-30 (com
  códigos de produto que não existem) foram apagados do banco no mesmo dia.
- Para preencher a lista de nomes: `MARGEM_PESSOAS="Nome;Nome;Nome"` no `ENV` de
  `P:\INTEGRAÇÃO BI\COMERCIAL\1 - CONFIGURACAO`, e o instalador leva para a VM (o formato está no README e no
  `servidor_margem.py`; o `ENV.example` não traz essa chave).
- **25 produtos com piso de 0%** nas filiais 11 e 12 contam como "fechados" (o resto
  tem 5%). Achado de 2026-10-01; falta o Júlio dizer se aparecem à parte na tela.
- O `agente_margem.log` da VM tem 4,3 MB: cerca de 5.700 linhas por dia de "Nada na
  fila".

## Pendências

- Definir a lista de quem pode usar (`MARGEM_PESSOAS` no ENV). Sem ela o nome é
  digitado livre, e a regra de quem fecha vale pelo que a pessoa escreveu — com o
  endereço circulando, é o elo fraco da regra.
- Cadastrar `ORACLE_USER_ESCRITA` / `ORACLE_PASSWORD_ESCRITA` — usuário com
  `UPDATE` em `PCPRODFILIAL`; o do ETL é de leitura e continua sendo. **Ainda ausente
  em 2026-10-09.**
- **Senha do WinThor em texto claro dentro dos oito `.bat`**, numa pasta de rede
  aberta. O plano de 2026-09-30 era trocar a senha e só depois apagar os arquivos;
  mas o [[data-warehouse]] registra que a senha do WinThor não se troca. **Decisão do
  Júlio:** trocar a do usuário dos `.bat` (se for outro), ou criar um usuário dedicado
  só com `UPDATE` em `PCPRODFILIAL` e tirar os `.bat` da pasta aberta.
- Investigar os **62 produtos abertos por fora** entre 30/09 e 09/10: os `.bat` ainda
  estão em uso?
- Primeiro pedido real, conferido com `conferir_margem.py --pedido N` (Júlio).
- Cadastrar `MARGEM_ENDERECO` (`http://SRV-IA:8080`) na Vercel e apagar a
  `MARGEM_ATIVA`, se tiver sido criada; avisar o comercial do endereço.
- Decidir se os 25 produtos com piso 0% aparecem à parte (Júlio).
- Opcional, oferecido pelo Claude: o `agente_margem.log` registrar só quando houver
  algo na fila e ser cortado ao passar de um tamanho.
- Opcional: apagar `5 - SAIDAS ANTIGAS` da pasta de rede quando quiser (nada nela faz
  falta).

Histórico completo do sistema em [[BI COMERCIAL]] ("Histórico de mudanças"). Conversas:
[[2026-09-30 — Sistema de abertura de margem das filiais]],
[[2026-10-01 — Pasta de rede arrumada e a margem na VM SRV-IA]] e
[[2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga]].

Ver também: [[BI COMERCIAL]], [[WinThor]], [[Supabase]], [[Mapa de sistemas]].
