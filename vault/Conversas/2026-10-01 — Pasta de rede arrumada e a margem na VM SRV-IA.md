---
tipo: conversa
data: 2026-10-01
projeto: "[[BI COMERCIAL]]"
departamento: Comercial
status: resumido
tags: [conversa, comercial, margem, rede, vm, instalacao]
---
# 2026-10-01 — Pasta de rede arrumada e a margem na VM SRV-IA

Continuação de [[2026-09-30 — Sistema de abertura de margem das filiais]].

## Resumo
O Júlio pediu o passo a passo de configuração e depois a **pasta `P:\INTEGRAÇÃO BI\COMERCIAL` organizada em
subpastas, só com o necessário**. O Claude reorganizou a pasta, ensinou o instalador a ler as subpastas e criou
o `INSTALAR TUDO.bat`, o `LEIA-ME.txt` e o `CONFERIR SERVIDOR.bat`. O servidor da [[Abertura de margem]] saiu da
estação do Júlio (`LOGISTICA-55`) e foi para a VM `SRV-IA`, em **`http://SRV-IA:8080`**. Uma queda de 15
minutos do Supabase derrubou o servidor a manhã inteira, e ele passou a subir mesmo sem banco.

## Decisões
- 2026-10-01 (Júlio): o servidor da margem fica **na VM**, não na estação dele.
- 2026-10-01 (Júlio): pasta de rede em subpastas com nome claro, só com o necessário; os outros computadores do
  comercial **só recebem a URL**, sem instalar nada.
- 2026-10-01 (Claude): passar o endereço **pelo nome da máquina**, não pelo IP — o IP da estação era DHCP.
- 2026-10-01 (Claude): manter a estação no ar até a VM responder **de outro computador**, e só então desligá-la;
  testar só na própria máquina engana, porque o tráfego local não passa pelo firewall.
- 2026-10-01 (Claude): um programa que precisa ficar no ar **não pode tratar o banco como condição de partida**.
- 2026-10-01 (Claude): a instalação em `C:\BI\COMERCIAL` continua **plana** — os scripts se importam entre si; a
  separação em subpastas é para gente, não para máquina.

## O que foi criado ou mudou
- **Pasta de rede** (commit `71cfbf5`): `1 - CONFIGURACAO` (o `ENV`), `2 - SISTEMA COMERCIAL`,
  `3 - PAINEL DE ABERTURA DE MARGEM`, `4 - INSTALACAO`, `5 - SAIDAS ANTIGAS` (logs e saídas de teste movidos,
  nada apagado); na raiz, `LEIA-ME.txt` e `INSTALAR TUDO.bat`. O instalador acha a raiz procurando
  `1 - CONFIGURACAO` e ganhou `-Conferir` (12 arquivos conferidos sem tocar na máquina). O
  `iniciar_servidor_margem.bat` acha a instalação sozinho.
- **Página da margem** (commit `9c15d24`): aberta com duplo clique (`file://`) agora diz para abrir pelo
  endereço; o "Failed to fetch" cita servidor parado e firewall da 8080.
- **Log** (commit `e80e5ed`): o `servidor_margem.log` ficava sempre vazio (o `logging.basicConfig` criava o
  arquivo e o descartava, e tudo ia para o `agente_margem.log`). Corrigido, e nasceu o `CONFERIR SERVIDOR.bat`.
- **Na VM `SRV-IA`** (192.168.12.30, IP fixo): o Júlio rodou o `INSTALAR TUDO.bat`; tarefa "BI Comercial -
  Servidor de margem" em modo *Password*; regra de firewall "BI Comercial - Abertura de margem" (TCP 8080 de
  entrada). Testado de outra máquina e sub-rede, por nome e por IP, com o dado real.
- **Na `LOGISTICA-55`:** a tarefa do servidor foi apagada (PowerShell como administrador) e a máquina reiniciada;
  o Claude encerrou dois Python de teste dele (porta 8094 e um `servidor_teste.py` esquecido desde 28/09).
- **Servidor resistente a queda do banco** (commit `e21ae12`): a falha na partida virou aviso, e a primeira
  consulta que der certo reconecta; a tarefa ganhou um gatilho de 30 em 30 minutos com `IgnoreNew`.
- **`conferir_margem.py`** (novo, só leitura): `--pedido N` confere produto a produto no WinThor; sem argumento,
  conta direto do Oracle e compara com a tela. O Claude copiou direto para a `C:\BI\COMERCIAL` da VM — o que
  travou a reinstalação de 2026-10-09 (ver [[2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga]]).
  Entrou no Git só em 2026-10-08.
- [[Abertura de margem]], [[BI COMERCIAL]] e [[BI Comercial - Servidor de margem]]: atualizadas.

## Incidentes
- **08:17 — o Supabase ficou ~15 min sem responder** (`{:error, :timeout}` no pooler). O servidor da margem
  morreu na partida, as 5 tentativas de reinício se esgotaram em 10 min e o sistema ficou a manhã fora na
  `SRV-IA`. O ETL nem sentiu (a carga das 08:45 passou inteira). Ver [[Supabase]].
- Depois do reboot da `LOGISTICA-55` o `P:` não voltou (o `Z:` voltou). Sem ele, a versão resistente a queda não
  chegou à VM — ela ficou com a versão anterior **até 2026-10-09**.
- `Acesso negado` no `schtasks /delete`: precisava de PowerShell como administrador.
- **Ficou despercebido até 2026-10-08:** o instalador rodou nas **duas** máquinas nesse dia — na `SRV-IA` às 08:17 e
  na `LOGISTICA-55` às 09:02 — e criou **todas** as tarefas nas duas; da estação só se apagou a do servidor. Daí em
  diante as duas máquinas rodavam a mesma carga. (Datas conferidas em 2026-10-09 pelos arquivos e logs de cada máquina.)
- **Efeito bom, também despercebido:** a VM já carregava o COMERCIAL desde 2026-09-28, mas com os gatilhos **4 horas
  atrasados** (relógio da VM atrasado quando foram gravados). A reinstalação das 08:17 regravou os gatilhos com o
  relógio certo, e desde 2026-10-02 as cargas da VM rodam na hora. Ver [[BI COMERCIAL]].
- Achado: **25 produtos com piso de 0%** nas filiais 11 e 12, contados como "fechados" (o resto tem 5%).

## Pendências
- [x] Remapear o `P:` na estação — a pasta de rede voltou a ser lida em 2026-10-09
- [ ] Júlio: preencher `MARGEM_PESSOAS` no `ENV` — com o endereço circulando, o nome em texto livre é o elo fraco
  da regra de quem fecha (ainda ausente em 2026-10-09)
- [ ] Júlio: decidir se os 25 produtos com piso 0% aparecem à parte na tela
- [ ] Júlio: apagar a `5 - SAIDAS ANTIGAS` quando quiser (nada nela faz falta)
