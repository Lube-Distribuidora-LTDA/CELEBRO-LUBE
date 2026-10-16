---
tipo: projeto
departamento: Comercial
status: ativo
inicio: 2026-09-28
tags: [bi, comercial, comissao, margem, devolucao]
---
# BI COMERCIAL

Reconstrução do BI **comercial** do Power BI no padrão da casa ([[data-warehouse]]): [[WinThor]] → ETL em Python → [[Supabase]] (schema `comercial` do DATA WAREHOUSE) → painel na [[Vercel]]. Levantamento do original em [[BI COMERCIAL — documentação técnica]].

- Repositório: [Lube-Distribuidora-LTDA/GESTAO-COMERCIAL](https://github.com/Lube-Distribuidora-LTDA/GESTAO-COMERCIAL) · cópia local em `Desktop\BI\8. COMERCIAL`
  - **Privado desde ~2026-10-05** (o GitHub responde 404 sem login). Até lá foi público: o primeiro push, em 2026-09-28, foi para um repositório público — sem senha nem IP do Oracle, mas com a estrutura do banco e a regra de comissão.
  - Efeito colateral do privado no plano Hobby: **o deploy pelo Git fica `BLOCKED`** (ver [[Vercel]]). Os deploys de 2026-10-06 e 2026-10-07 foram feitos pela API. Os pushes de 2026-10-08 (`bb64f16`, `21ed527`) estão `BLOCKED`, mas só mexem em `etl/` e `web/db/` — **o painel no ar é o do commit `34c5c42`** (guarda 1.1.0, 2026-10-07), e isso não muda nada para quem usa.
- Edição do ETL: `P:\INTEGRAÇÃO BI\COMERCIAL` · Execução: `C:\BI\COMERCIAL` **na VM `SRV-IA`** — desde 2026-10-09, **só lá**. A cópia em `C:\BI\COMERCIAL` da estação `LOGISTICA-55` ficou sem tarefa nenhuma; o `bi_comum.py` de lá é de 2026-09-30, **sem a tranca de carga** — carga avulsa rodada dela não respeita a tranca e pode atropelar a da VM.
- Schema no DATA WAREHOUSE: `comercial`
- Dono das dimensões do `core`: `dim_rca`, `dim_supervisor`, `dim_cliente` e, desde 2026-10-09, `dim_nf_saida`
  - **2026-10-09 (no ar; ainda não commitado):** nova dimensão `core.dim_nf_saida` — capa das NFs de saída
    (`PCNFSAID`) dos últimos 45 dias, upsert por `NUMTRANSVENDA`, grupo "rapidas" — para o [[SAC]] só aceitar
    nota emitida até 1 mês atrás (pedido do Júlio). Migração `dim_nf_saida` aplicada às 10:48 (arquivo
    `web/db/08-dim-nf-saida.sql`, ainda não rastreado no Git); consulta nova em `consultas_comercial.py` na rede,
    no repositório e na `C:\BI\COMERCIAL` da `LOGISTICA-55`. **Às 10:56 o arquivo foi para a `SRV-IA`** pelo
    compartilhamento `\\SRV-IA\c$\BI\COMERCIAL` (Claude): antes, conferido que a única diferença entre a VM e a rede
    era esta mudança (os outros arquivos já eram iguais) — o mesmo que o instalador faria com esse arquivo. A
    primeira carga agendada com ela é a das 12:45: **conferir no `controle_carga`** (`consulta = 'dim_nf_saida'`).
    A carga avulsa das 10:49 (33.985 notas em 42,7 s) saiu da `LOGISTICA-55`, sem a tranca — só antes de saber que
    as cargas tinham ido para a VM; mexeu só na tabela nova, que ninguém mais escrevia.
    Atenção: `NUMNOTA` se repete entre filiais (4.668 números repetidos em 400 dias).
  - **2026-10-07:** `dim_rca` ganhou `email`, `email2`, `bloqueio` e `dttermino` (`PCUSUARI`), para o [[SAC]]
    conferir que o e-mail digitado é de um RCA ativo. Migração `dim_rca_email` (arquivo
    `web/db/07-dim-rca-email.sql`), consulta estendida nas três cópias (rede, `C:\BI\COMERCIAL`, repositório)
    e carga avulsa às 16:31 conferida no `controle_carga` (1.831 linhas). O painel do COMERCIAL não lê essas
    colunas. **Commitado em 2026-10-08**, junto com a tranca de carga (`bb64f16`). Só a troca de "SAQ" por "SAC"
    nos comentários (2026-10-09, rede + repositório + o `COMMENT` da coluna no banco) **ainda não tem commit**; a
    VM ficou com o comentário antigo, sem efeito nenhum.
  - Conferido em 2026-10-09: as cargas agendadas seguem trazendo o e-mail (127 RCAs ativos com e-mail).
    As **duas linhas de `dim_rca` no mesmo minuto** (07:45 e 08:45 de 09/10) eram as duas máquinas rodando a
    mesma carga — resolvido no mesmo dia (ver abaixo). Na carga das 09:04 cada consulta já aparece uma vez.
  - O `bi_comum.py` "mais velho" achado em 2026-10-07 era o da `LOGISTICA-55`, que deixou de rodar em
    2026-10-09. A VM recebeu o atual (08/10) na reinstalação.
- Rotinas: [[BI Comercial - Sync rapidas]] e [[BI Comercial - Sync margem]]; da [[Abertura de margem]],
  [[BI Comercial - Servidor de margem]] (com a tarefa "BI Comercial - Agente de margem", de 1 em 1 minuto)
- Onde mora cada coisa no código: [[BI COMERCIAL — documentação técnica]], seção 10
- Branch `sentinela` (local e no GitHub) parada em `cae4dc9` (2026-10-06); tudo o que tem nela já está na `main`.

## O que o painel tem
Cinco páginas, menu lateral, no visual do [[GESTÃO TI]] (regra de [[Como eu gosto dos BIs]]):
1. **Comissão por RCA** — KPIs, tabela por RCA (ou RCA × filial), clique abre as notas do vendedor, gráfico mês a mês e o bloco **"Como o total muda conforme o grão"** (até 2026-09-28 se chamava "Conferência da comissão").
2. **Margem por item** — limite em botão (5, 8, 10, 15, 20%), os piores itens do período, ranking por RCA e série mensal.
3. **Pedidos em aberto** — foto da carteira, margem mínima em botão, posição em chips.
4. **Devoluções** — barra de proporção "do vendedor × da operação" (até 2026-09-28 era uma rosca), ranking por RCA, tabela por nota e série mensal.
5. **Operação › Margem das filiais** (desde 2026-09-30) — **só consulta** do que está aberto na [[Abertura de margem]]: por filial, de quem, há quanto tempo, histórico com o motivo.

**Nenhuma tela fala do Power BI** (pedido do Júlio, 2026-09-28): a tela explica a regra; a história da migração fica no README e em [[BI COMERCIAL — documentação técnica]].

**O visual (repaginado em 2026-09-28 e 2026-09-29, pedido do Júlio: "luxo", menos azul, com animação):**
- ouro como acento (número-herói com degradê em cada página, menu ativo, selos); números que sobem contando; animações **finitas** — fundo animado sem parar travava a renderização;
- tabelas grandes com as duas primeiras colunas fixas, cabeçalho fixo, botão "Colunas essenciais / Todas as colunas" (a comissão abre com 9 de 15), #1 a #3 em ouro, barra proporcional atrás da coluna principal, paginação de 25/50/100/tudo;
- totais numa **faixa centralizada acima da tabela**, com o número principal em ouro;
- KPIs numa grade de três faixas com **um tamanho de número só** (23 px);
- gráfico nunca com dois eixos (dinheiro e percentual empilhados); a linha dos 20% da margem é tracejada, com o rótulo numa plaqueta à esquerda;
- filtro de chips (filiais e posição dos pedidos): a partir de "Todas", clicar seleciona **só** aquela; depois cada clique soma ou tira; esvaziar volta para "Todas".

**Toda tabela exporta `.xlsx` formatado** (desde 2026-09-29; antes era CSV): faixa da Lube, filtros aplicados escritos por extenso, cabeçalho congelado, filtro automático, moeda/percentual/data nativos e linha de total. Gerado no navegador por `web/planilha.js`, sem biblioteca externa. Padrão registrado em [[Como eu gosto dos BIs]]; conversa em [[2026-09-29 — Exportação do painel comercial em Excel]].

**Acesso:** desde 2026-10-06 o painel **só abre para quem tem acesso pelo [[PAINEL LUBE DISTRIBUIDORA]]** — guarda da [[SENTINELA LUBE]] com "exige login" (decisão do Júlio). Sem login, a página vai para o portal e `/api/dados` e `/api/margem` respondem 401.

## Duas máquinas rodavam a mesma carga (2026-10-08)

O Júlio perguntou se o script estava abastecendo o banco nos horários certos.
**Os horários sempre estiveram certos** — o problema era outro: **duas máquinas
tinham as mesmas tarefas agendadas**, a VM `SRV-IA` e a estação de quem
instalou (`LOGISTICA-55`). O instalador cria todas as tarefas; ao mudar o
sistema para a VM, só a tarefa do servidor de margem foi apagada da estação.

As duas truncavam e inseriam nas mesmas tabelas no mesmo minuto. Uma ganhava, a
outra morria esperando o lock aos **exatos 120 segundos** do `statement_timeout`.
A mensagem de erro dizia isso literalmente: `while locking tuple in relation
"dim_cliente"`.

**O estrago, medido:** a `margem_item` (3,3 milhões de linhas) falhou na
primeira tentativa **todas as noites desde 02/10**, e em **02/10 e 05/10 não
carregou**. Como a carga é transacional, o rollback preservou o dado — o painel
ficou com a véspera nesses dois dias, nunca vazio.

**Duas correções.** Apagar as três tarefas da estação resolve o caso; e a nova
`bi_comum.tranca_de_carga` resolve a classe: um *advisory lock* do Postgres, uma
carga por grupo na empresa inteira. Quem chegar depois descobre na hora, avisa e
sai com código 0 — não é erro, é a tranca trabalhando.

Vale lembrar para os outros sistemas: a carga duplicada também dobrava o peso
deste BI no Supabase, que [[Supabase]] registra ter saturado em 07/10.

Nas 48 horas até 09/10 foram **9 falhas na `comissao_nf` e 5 na `dim_cliente`**,
todas recuperadas na carga seguinte.

**Desde quando** (conferido em 2026-10-09 pelas datas dos arquivos e pelos logs das duas máquinas; até
então esta nota dizia que as tarefas de 2026-09-28 eram da estação e que a VM só entrou em 2026-10-01):
- **2026-09-28:** o instalador começou na `LOGISTICA-55` às 17:21 (copiou os arquivos e deixou a tarefa-cobaia),
  mas lá **não ficou carga nenhuma**: não existe log de carga na estação antes de 01/10. Às **17:25 ele rodou na
  `SRV-IA`**, criou as tarefas e fez a carga de teste (7 consultas). **A VM carrega o COMERCIAL desde 2026-09-28.**
- **2026-10-01:** o instalador rodou de novo **nas duas**: na `SRV-IA` às 08:17 e na `LOGISTICA-55` às 09:02 (a
  carga de teste e os arquivos da margem de lá são dessa hora). Criou todas as tarefas nas duas máquinas; da
  estação só se apagou a do servidor de margem. Daí as falhas a partir de 02/10, a primeira noite com a margem
  nas duas.

### Antes disso: a VM rodava 4 horas atrasada (2026-09-28 a 2026-10-01)
Mesma causa do [[BI COMPRAS]]: as tarefas foram gravadas em 2026-09-28 com o relógio da VM 4 horas atrasado (o
log da VM marca 13:25 para a carga das 17:25). Até a reinstalação de **2026-10-01 às 08:17**, a margem rodou por
volta das **07:45** (e não às 03:45) e as rápidas das **10:45 às 20:45** (e não das 06:45 às 16:45). A reinstalação
regravou os gatilhos com o relógio já certo: **desde 2026-10-02 os horários batem** (o COMPRAS, que não foi
reinstalado, ficou atrasado até 2026-10-09). Pelo log, o relógio da VM foi acertado em 2026-09-30, entre 07:45 e
10:45. Nesses dias o dado das 07:00 só chegava depois das 10:45.

**A margem não recarregou nos primeiros dias.** No log da VM, as cargas da `margem_item` de 29/09, 30/09, 01/10 e
02/10 param no meio da gravação (2,15 mi, 1,0 mi, 1,15 mi e 3,25 mi de linhas), sem erro e sem a linha de resumo.
A estação falhou em 02/10. A primeira carga completa depois da manual de 2026-09-28 foi a de **2026-10-03** (na
estação). A carga é transacional, então a tabela ficou com o dado de 28/09 até lá. Conferir no `controle_carga`.
Em 01/10 essa carga pesada rodou às 07:45, na manhã em que o DATA WAREHOUSE saturou (ver [[Supabase]]); se ela
pesou no incidente não está provado.

### Resolvido em 2026-10-09 — uma máquina só
- O Júlio apagou da `LOGISTICA-55` as três tarefas que sobravam (**Sync rapidas**,
  **Sync margem** e **Agente de margem**). Conferido: não ficou nenhuma tarefa
  `BI Comercial*` nem Python rodando na estação.
- O `INSTALAR TUDO.bat` rodou na `SRV-IA` e levou a versão de 08/10: a tranca de
  carga, o `carregar_env` corrigido, o servidor de margem resistente a queda do
  banco e o `conferir_margem.py`. As quatro tarefas foram recriadas.
- Na primeira tentativa o instalador parou com **acesso negado** ao sobrescrever o
  `conferir_margem.py`: o Claude o tinha copiado direto para
  `\\SRV-IA\C$\BI\COMERCIAL` em 01/10, com outra credencial. O Claude apagou essa
  cópia e a segunda rodada foi inteira. **Regra que ficou (Claude):** nada se copia
  direto para a VM — sempre pela pasta de rede e pelo instalador.
- Prova: na carga das **09:04** cada consulta aparece **uma vez** no
  `controle_carga`, todas OK.

Também em 2026-10-08, de quebra: o `carregar_env` não achava mais o `ENV` desde
a arrumação da pasta em subpastas (regressão do Claude, de 01/10). Agora ele procura
também em `1 - CONFIGURACAO`.

Conversa: [[2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga]].

## A pasta de rede foi arrumada (2026-10-01)

`P:\INTEGRAÇÃO BI\COMERCIAL` estava com 24 arquivos soltos na raiz — script,
log, saída de teste e configuração tudo junto. O Júlio pediu para separar, e
ficou assim:

| Pasta | O que tem |
|---|---|
| `1 - CONFIGURACAO` | o `ENV` e o `ENV.example` — **o único lugar que se edita** |
| `2 - SISTEMA COMERCIAL` | o ETL que alimenta o painel |
| `3 - PAINEL DE ABERTURA DE MARGEM` | a [[Abertura de margem]] |
| `4 - INSTALACAO` | os dois `.ps1` |
| `5 - SAIDAS ANTIGAS` | relatórios e logs das primeiras instalações |

Na raiz ficaram só o `LEIA-ME.txt`, que explica cada pasta, e o
`INSTALAR TUDO.bat`, que é duplo clique.

**A instalação na VM continua plana**, e tem que continuar: os scripts se
importam entre si e o Python procura o vizinho na mesma pasta. A separação é
para gente, não para máquina — o instalador sabe de onde tirar cada arquivo.

O instalador ganhou `-Conferir`, que lista o que está no lugar e o que falta sem
tocar na máquina nem no Agendador.

No mesmo dia entraram na raiz o **`CONFERIR SERVIDOR.bat`** (tarefa, situação,
porta, resposta e endereço do servidor de margem numa tela só) e o servidor de
margem foi para a VM `SRV-IA` (pedido do Júlio). Detalhes em [[Abertura de margem]];
conversa em [[2026-10-01 — Pasta de rede arrumada e a margem na VM SRV-IA]].

Conferido em 2026-10-09: os arquivos da pasta de rede são **idênticos** aos do
repositório (`etl/`), inclusive o que ainda não tem commit (a troca "SAQ" → "SAC" e a
`dim_nf_saida`). Só a rede
tem a `5 - SAIDAS ANTIGAS` (de propósito) e um `sync_bi_comercial.log` de 08/10
(09:18), de um teste rodado direto da rede.

## Margem das filiais — virou sistema próprio, na rede (2026-09-30)

A quinta página, em **Operação › Margem das filiais**, começou o dia sendo um
formulário que enfileirava pedidos para um agente executar. Terminou o dia como
**só consulta**: abrir e fechar mudou-se para a [[Abertura de margem]], um sistema
que roda dentro da rede, em `http://<máquina>:8080` — desde 2026-10-01, **`http://SRV-IA:8080`**.

**Por quê.** A ideia do Júlio era um `index.html` na pasta da rede que buscasse os
`.bat` e executasse. Isso não existe: navegador não executa `.bat` nem fala com o
Oracle. Um programa servindo a página resolve — e, estando dentro da rede, executa
**na hora**, sem fila e sem espera. A fila deixou de ser necessária.

**O que o painel da Vercel mostra agora:** quantos produtos estão abertos e por
filial, de quem é cada um e há quanto tempo, quem mais abre, quais filiais, e o
histórico com o motivo escrito. Sem botão de executar — e por isso a trava
`MARGEM_ATIVA` deixou de existir: não há mais POST a travar.

**A regra que o Júlio escolheu:** quem abriu é quem fecha, **bloqueio total**. Mora
em `comercial.margem_registrar`, no banco. Produto aberto antes do sistema não tem
dono — os `.bat` não registravam ninguém — e aí qualquer um fecha.

**O estado vem do WinThor.** Nova consulta `margem_filial`: 137.488 linhas
(4 filiais × 34.372 produtos) em 6 segundos, a cada carga, para
`comercial.fato_margem_filial`. Entre cargas, o `agente_margem.py` corrige as
linhas que acabou de mudar — senão um produto aberto às 10h15 pareceria sem dono
até as 11h, e a regra teria buraco.

**Em 2026-09-30 havia 546 produtos abertos:** 319 na filial 1, 22 na 7, 56 na 11 e
149 na 12. De nenhum deles se sabe quem abriu. **Em 2026-10-09 eram 608**, com o
histórico do sistema vazio: 62 foram abertos por fora (ver [[Abertura de margem]]).

Detalhes em [[Abertura de margem]] e [[BI Comercial - Servidor de margem]].

## Decisões que fecham as ambiguidades do original
- **A régua da comissão virou tabela**: `comercial.dim_faixa_comissao`, com vigência. A atual vale desde 18/10/2023. Mudar a regra é inserir faixas com vigência nova — o histórico fica.
- **Grão oficial da comissão: por RCA**, e não por RCA × filial. O painel tem o botão para ver dos dois jeitos e mostra a diferença em reais, porque a escolha muda quanto o vendedor recebe. **A palavra final é do comercial** — o padrão já está no mais defensável (um vendedor, uma faixa por mês).
- **O total é a soma das linhas.** A faixa aplicada sobre a empresa inteira (o que o rodapé do Power BI fazia) aparece só no bloco de conferência, identificada como tal.
- **Desconto financeiro contado uma vez** por nota, com o valor do jeito antigo ao lado.
- **Devolução pelo valor da linha** (QT × PUNITCONT), somável, com o total da nota ao lado.
- **Motivo "do vendedor" virou coluna** (`responsabilidade_rca`) na dimensão de motivos — cartão e tabela leem a mesma coisa.
- **Positivação (Consulta5) não é carregada.** Clientes distintos por RCA saem da própria base de comissão.
- **ST no CMV mantido como está**, para os números baterem com a tela antiga. **Pendente de validação com o financeiro.**

## Estado em 2026-09-28 — **no ar**
- **Painel:** https://gestao-comercial-web-three.vercel.app (projeto `gestao-comercial-web`, Root Directory `web`, Framework Preset "Other", região `gru1`, Node 22.x). Variáveis cadastradas no mesmo dia (só os nomes): `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT` (5432), `SUPABASE_DB_NAME`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`
- **Agendado:** 8 cargas rápidas por dia + a margem às 03:45. A carga que o instalador disparou às 17:25 chegou ao painel. **Na VM `SRV-IA`**, como dizia a versão original desta linha (em 2026-10-09 ela chegou a ser trocada para "na estação `LOGISTICA-55`", o que os logs desmentem). Até 2026-10-01 a VM rodou 4 horas atrasada; de 2026-10-01 a 2026-10-09 a estação também rodava; hoje é só a `SRV-IA` — ver "Duas máquinas rodavam a mesma carga".
- **Ainda aberto em 2026-09-28:** o repositório estava público e a Vercel sem proteção de acesso, com comissão nominal de vendedor à vista.
  - **Atualização 2026-10-05:** a Vercel Authentication foi ligada, mas no modo Standard, que não cobre o
    endereço principal: `gestao-comercial-web-three.vercel.app/api/dados` responde sem login (223 KB), e
    `/db/*.sql` também está publicado. O repositório parece privado agora (GitHub responde 404 sem login).
    O Júlio decidiu manter o painel como está; a porta prevista é o "exige login" da [[SENTINELA LUBE]].
  - **Fechado em 2026-10-06 (decisão do Júlio: só entra quem tem acesso pelo Painel Lube).** Guarda da
    Sentinela em `web/sentinela-guarda.ts` + `web/middleware.ts` (commits `0988f8d`, `cae4dc9`), em modo fechado
    (sem a lista da central, só passa sessão válida do portal), e `exige_login` ligado para
    `gestao-comercial-web` (README em `c98fa62`). O deploy pelo Git ficou `BLOCKED`; o de produção foi feito
    pela API (`dpl_FWczt4epEM8fCbCEZJVQfTf3PMw7`). Em 2026-10-07 entrou o guarda 1.1.0, que reconhece robôs
    (`34c5c42`, deploy pela API `dpl_AXiPQmp9R1Tph7bk1Um3Ae4YVbpZ`). Conversa:
    [[2026-10-05 — Sentinela Lube, sistema de segurança]].
- Banco criado no DATA WAREHOUSE: 3 dimensões no `core`, 6 tabelas em `comercial`, 4 views materializadas e as funções `painel_dados()` e `painel_detalhe()`.
- A cadeia da comissão foi conferida contra os números do Power BI **antes de existir dado**: alimentada com os totais de fev/2026, devolve TOTAL LÍQUIDO R$ 9.026.598,25, massa R$ 1.874.562,57, 20,7556% e faixa de 2% — comissão R$ 180.531,97 contra os R$ 180.531,96 da tela (1 centavo de arredondamento).
- Painel testado de ponta a ponta com dado sintético e, depois, **com o dado real do DATA WAREHOUSE**: as quatro páginas, o drill por nota, os filtros, os gráficos e o modal, sem erro de console, no desktop e no celular.
- Até o meio da tarde de 2026-09-28 o painel ainda não estava publicado nem agendado; as duas coisas aconteceram no mesmo dia (17:18 a 17:44).

### A primeira carga (2026-09-28, 16:50 e 16:57)
O ETL rodou de dentro da rede, a partir da própria conversa — o Oracle responde da sessão do Claude nesta máquina (correção registrada em [[data-warehouse]]).

| Consulta | Linhas | Power BI | Tempo |
|---|---:|---:|---:|
| dim_rca | 1.823 | — | 0,2s |
| dim_supervisor | 27 | — | 0,1s |
| dim_cliente | 61.956 | — | 3,1s |
| dim_motivo_devolucao | 101 | — | 0,1s |
| pedido_aberto | 678 | 446 (foto) | 0,3s |
| devolucao | 12.816 | 12.803 | 1,4s |
| comissao_nf | 205.519 | 205.503 | 34,5s |
| margem_item | 3.288.133 | 3.288.372 | 377,6s |

O banco foi de 410 MB para **1.052 MB** (limite do plano Pro: 8 GB); a `fato_margem_item` sozinha ocupa 594 MB.

### Validação: bate com o Power BI até o centavo
Período 02/02/2026 a 27/02/2026, lido do DATA WAREHOUSE depois da carga:

| | Obtido | Power BI |
|---|---|---|
| Total vendas s/ ST [30] | 9.297.704,78 | 9.297.704,78 |
| Total devolução c/ ST [37] | 271.106,53 | 271.106,53 |
| TOTAL LÍQUIDO [44] | 9.026.598,25 | 9.026.598,25 |
| TOTAL LÍQUIDO s/ ST [Medida 6] | 9.031.601,57 | 9.031.601,57 |
| TOTAL ST | 179.866,47 | 179.866,47 |
| CMV LÍQUIDO [45] | 7.157.039,00 | 7.157.039,00 |
| MASSA DE MARGEM [46] | 1.874.562,57 | 1.874.562,57 |
| % LÍQUIDO [47] | 20,7556% | 20,7556% |
| RCAs com movimento | 145 | 145 |

E os três jeitos de somar a comissão, calculados sobre o dado carregado:

| Como calcular | fev/2026 | Power BI |
|---|---|---|
| Faixa sobre a empresa (rodapé da tela antiga) | R$ 180.531,96 | R$ 180.531,96 |
| Soma por RCA (o que o painel paga) | R$ 185.401,77 | não existia |
| Soma por RCA × filial | R$ 187.664,93 | R$ 187.664,93 |
| Soma nota a nota | R$ 188.186,79 | R$ 188.143,73 |

### O que a carga real revelou
- **A armadilha do rodapé é muito maior em mês ruim.** Em setembro/2026 (1 a 28) a margem da empresa fecha em **18,71%**, abaixo da primeira faixa: o rodapé do Power BI mostraria **R$ 117.085,38** de comissão, enquanto os vendedores somam **R$ 210.864,57**. Em fevereiro a diferença era de 4%; em setembro, de 80%.
- **A duplicidade do desconto financeiro não existe nesta base.** Nos 21 meses carregados, `desc_financeiro` e `desc_financeiro_original` são idênticos em todos os meses: o `VLDESCFIN` da capa só casa com a linha de venda. A correção fica no código, sem efeito — e agora isso está medido, não suposto.
- **A duplicidade da devolução existe, e é pequena:** 49 notas aparecem em mais de uma linha, somando **R$ 9.624,60** contados duas vezes em 16 meses. O resto da diferença entre os dois números (R$ 6.128.806,65 pelo total da nota × R$ 6.096.999,66 pela linha) é composição: o total da nota inclui ST e despesas.
- Os **14 motivos de responsabilidade do vendedor** foram reconhecidos corretamente entre os 101 do WinThor, apesar de acentos, pontos soltos e espaços duplos. Devolução do vendedor: R$ 2.319.309,00 de R$ 6.096.999,66 (38%).
- **A carteira em aberto tem 678 pedidos e R$ 834,7 mil**, dos quais **301 pedidos (44,4%) e R$ 411,0 mil estão abaixo de 20% de margem** — é a tela que mais dá o que fazer hoje.
- `painel_dados()` responde em **2,4s com cache quente** e levou **27s na primeira chamada** (banco frio). O cache de 10 minutos da Vercel cobre isso, mas é o motivo de o `maxDuration` estar em 60s.

## Resolvido em 2026-09-29
O banco voltou e as duas migrações entraram: `mv_margem_dia` (46.692 linhas, 8,6 MB) e a nova
`painel_dados`. **A função caiu de 2,4 s com cache quente — e mais de 60 s com ele frio — para
0,2 s.** O painel deixou de varrer os 594 MB da `fato_margem_item` a cada acesso.

O que destravou a aplicação foi `SET statement_timeout = '45min'` antes da DDL: criar a view
materializada sobre 3,3 milhões de linhas leva 15 s, mas o limite padrão da sessão cancelava antes.
O script também usou `lock_timeout = '3min'` e rodou `ANALYZE` no fim. No histórico de migrações do
Supabase aparece só `comercial_margem_agregada` (2026-09-29 11:16); a nova `painel_dados`
(`04-painel-dados-v2.sql`) entrou pelo mesmo script, sem migração com nome próprio. Mapa arquivo ×
migração em [[BI COMERCIAL — documentação técnica]].

### ⚠️ Achado de 2026-10-09: ninguém atualiza a `mv_margem_dia`
A lista `VIEWS_DO_PAINEL` do `sync_bi_comercial.py` tem só quatro views (`mv_comissao_rca_mes`,
`mv_comissao_mes`, `mv_devolucao_rca_mes`, `mv_margem_mes`); a `mv_margem_dia` ficou de fora quando nasceu,
e a `margem_item` não tem `pos_carga`. Nos logs das duas máquinas (`SRV-IA` e `LOGISTICA-55`) **não existe
nenhuma linha "view mv_margem_dia atualizada"**. O `web/db/README.md` diz que ela é atualizada pelo ETL — não
é. **Efeito provável (não conferido no banco):** o resumo e o ranking por RCA da página *Margem por item*, e o
período de datas que ela oferece, estão parados no dado de 2026-09-29; só a lista dos piores itens, que lê a
`fato_margem_item`, anda. Correção: pôr `mv_margem_dia` na `VIEWS_DO_PAINEL` e reinstalar na `SRV-IA`.

Nos mesmos logs, em dias de banco pesado (ex.: 06/10, com a carga em dobro), o `REFRESH` da
`mv_comissao_rca_mes` e da `mv_margem_mes` e o aquecimento do painel morrem por `statement timeout`.

**Corrigido no repositório, ainda não na VM (2026-10-13 e 2026-10-14).** O commit **`ad7eefb`** (2026-10-13,
`Desktop\BI\8. COMERCIAL`, de outra conversa) põe a `mv_margem_dia` na `VIEWS_DO_PAINEL`; a mensagem dele diz que a
página *Margem por item* mostrava zero para qualquer período depois de 28/09 e que a view foi atualizada à mão naquele
dia. O mesmo commit tira a aba "Margem das filiais" do painel. Mas o `sync_bi_comercial.py` da rede
(`P:\INTEGRAÇÃO BI\COMERCIAL\2 - SISTEMA COMERCIAL`) **ainda tem só as quatro views antigas** (conferido em 2026-10-14),
então a carga da VM não recalcula a view. Em 2026-10-14 o [[GUARDIÃO DA LUBE]] acusou: "a mv_margem_dia (página Margem
por item) parou em 10/10, e a fato_margem_item já tem 14/10: o painel mostra dado velho" (atenção, incidente aberto às
13:40). **Falta (Júlio):** levar o `ad7eefb` para o `P:` e rodar o `INSTALAR TUDO.bat` do COMERCIAL na `SRV-IA`; o alarme
fecha sozinho quando a view alcançar a tabela (na margem das 03:45).

### A `margem_item` que morre sem registrar (achado de 2026-10-14)
Na reavaliação dos últimos dias, o Guardião achou que a `margem_item` **não tem nenhuma linha** no
`comercial.controle_carga` em **2026-10-11 e 2026-10-13** — nem `OK` nem `ERRO`. O sync sempre grava uma das duas, a
não ser que o processo morra; o limite de tempo da tarefa é de 3 h, então não foi isso. Nesses dias a margem do painel
ficou um dia atrasada (a carga é transacional: o rollback guarda a véspera). A carga também cresceu: de **6 min 18 s**
em 2026-09-28 para **17 a 20 min** (2026-10-14: terminou às 04:04:57, 19 min 55 s). Causa ainda não investigada: ver o
`sync_bi_comercial.log` da VM. A nota [[BI Comercial - Sync margem]] já sugeria antecipar para 03:30 se a base crescesse.

## Incidente de 2026-09-28, ~17:45 — banco sem resposta

Depois da primeira carga completa e dos testes do painel, o DATA WAREHOUSE parou de aceitar
conexões. O diagnóstico, para não repetir a investigação:

- **TCP abre na hora** nas duas portas do pooler (5432 e 6543) — a rede está boa;
- o log do pooler mostra `ClientHandler: Connection authenticated` (o cliente entra no pooler) e,
  logo em seguida, `DbHandler: Connection failed {:error, :timeout}` — **o pooler é quem não
  consegue falar com o Postgres**;
- o `postgres_logs` parou às 21:45 e não voltou;
- o MCP do Supabase também cai (`Connection terminated due to connection timeout`), e ele nem passa
  pelo pooler;
- a página de status do Supabase não reporta incidente em sa-east-1.

**Conclusão: a instância do Postgres parou de responder.** Não é rede, não é pooler, não é
credencial.

### Duas leituras erradas que custaram tempo (para não repetir)
1. **"O banco está recusando conexão."** Nas primeiras tentativas ele *aceitava*: o log do Postgres
   mostra a migração chegando (21:37, 21:40, 21:42, 21:45) e sendo morta por
   `canceling statement due to statement timeout`. Criar uma view materializada sobre 3,3 milhões
   de linhas não cabe no limite padrão da sessão — precisa de `SET statement_timeout` antes.
   O erro foi ler só o fim do log e a ausência do "APLICADO".
2. **"O Postgres caiu às 21:45 porque o log parou."** Log que para pode ser só atraso de ingestão
   (houve um incidente desses hoje). O que provou a queda foi o `DbHandler: Connection failed`
   do pooler, não o silêncio do log.

**O que provavelmente causou:** a carga de 3,3 milhões de linhas (594 MB) seguida de repetidas
leituras cheias dessa mesma tabela pelo `painel_dados`, numa instância pequena. Autovacuum e
análise da tabela nova competindo com as consultas fecham a conta.

**O que foi feito em resposta:** o `painel_dados` deixou de varrer a tabela grande (ver
`03-margem-agregada.sql` e `04-painel-dados-v2.sql` no repositório) e o `sync_bi_comercial.py`
passou a aquecer o painel depois de cada carga. As duas migrações não entraram naquela noite — o banco
não aceitou conexão (os scripts de reaplicação falharam 61 e depois mais 30 vezes). **Entraram em
2026-09-29**, ver "Resolvido em 2026-09-29". O Claude decidiu não pausar o projeto pelo MCP (tiraria o
banco do ar) e pediu ao Júlio o *Restart project* no Supabase. Conversa:
[[2026-09-28 — Painel comercial repaginado e o banco que parou]].

**O ETL se vira sozinho:** cada consulta falha isolada e fica registrada em `controle_carga`; a
carga seguinte (de hora em hora, das 07:00 às 17:00) recupera. Não há perda de dado, no máximo
uma carga pulada.

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-14** — Passa a ser vigiado pelo [[GUARDIÃO DA LUBE]] (rápidas, margem, servidor e fila da [[Abertura de margem]], site e as views que o painel lê), sem mudar nada no sistema. Achados: `mv_margem_dia` parada em 10/10 com a `fato_margem_item` em 14/10 (atenção aberta às 13:40); `margem_item` sem registro nenhum em 11/10 e 13/10; carga da margem de ~6 para 17–20 min · [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-13** — Commit `ad7eefb`: `mv_margem_dia` entra na `VIEWS_DO_PAINEL` (a view foi atualizada à mão no mesmo dia, pela mensagem do commit) e a aba "Margem das filiais" sai do painel; seguido do `a62e23b` (redeploy, o anterior saiu `BLOCKED`). **A correção do ETL não foi para o `P:` nem para a `SRV-IA`** (conferido em 2026-10-14). Registrado aqui em 2026-10-14, pelo Git · [[2026-10-14 — Guardião, o robô que garante as rotinas]]
- **2026-10-09** — Nova dimensão `core.dim_nf_saida` (capa das NFs de saída, 45 dias) para o [[SAC]] conferir a emissão da nota: migração `dim_nf_saida`, consulta nova, arquivo `08-dim-nf-saida.sql` (não commitado); na `SRV-IA` desde 10:56, primeira carga agendada às 12:45 · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-09** — Achado: a `mv_margem_dia` não está na `VIEWS_DO_PAINEL` e nunca foi atualizada pelo ETL (resumo e ranking da *Margem por item* provavelmente parados em 2026-09-29); ainda sem correção · [[2026-09-28 — Painel comercial repaginado e o banco que parou]]
- **2026-10-09** — Fim da carga em dobro: o Júlio apagou as três tarefas da `LOGISTICA-55` e rodou o `INSTALAR TUDO.bat` na `SRV-IA` (versão de 08/10, com a tranca); na carga das 09:04 cada consulta roda uma vez · [[2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga]]
- **2026-10-09** — Comentários "SAQ" → "SAC" em `consultas_comercial.py`, `web/db/07-dim-rca-email.sql` e no `COMMENT` de `core.dim_rca.email` (em andamento, não commitado) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-08** — Tranca de carga (`bi_comum.tranca_de_carga`, *advisory lock*), `carregar_env` volta a achar o `ENV` em `1 - CONFIGURACAO`, `conferir_margem.py` e a extensão do `dim_rca` entram no Git, instalador leva o `conferir_margem.py` (commits `bb64f16`, `21ed527`; deploy pelo Git `BLOCKED`, sem efeito no painel) · [[2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga]]
- **2026-10-07** — `core.dim_rca` ganha `email`, `email2`, `bloqueio` e `dttermino` para o [[SAC]] (migração `dim_rca_email`, consulta estendida, carga avulsa às 16:31) · [[2026-10-07 — SAC, tela de chamado do RCA]]
- **2026-10-07** — Guarda da Sentinela 1.1.0, que reconhece robôs e não-navegadores (commit `34c5c42`, deploy pela API) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Painel fechado: guarda da Sentinela em modo fechado e `exige_login` ligado — só entra quem tem acesso pelo Painel Lube (Júlio) (commits `0988f8d`, `cae4dc9`, `c98fa62`; produção pela API, Git `BLOCKED`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-05** — Nota corrigida: o painel não estava protegido (Vercel Standard não cobre o endereço principal); o Júlio decide deixar como está por ora; repositório constatado privado · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-01** — Servidor de margem vai para a VM `SRV-IA` (`http://SRV-IA:8080`, firewall da 8080, tarefa em modo Password) e passa a subir mesmo sem banco, com gatilho de 30 em 30 min; nasce o `conferir_margem.py` (fora do Git até 08/10) (commit `e21ae12`) · [[2026-10-01 — Pasta de rede arrumada e a margem na VM SRV-IA]]
- **2026-10-01** — Instalador rodado de novo na `SRV-IA` (08:17) — os horários da VM voltam ao certo a partir de 02/10 — e também na `LOGISTICA-55` (09:02), o que deixou as cargas nas duas máquinas até 2026-10-09 · [[2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga]]
- **2026-10-01** — Pasta de rede em subpastas, `LEIA-ME.txt`, `INSTALAR TUDO.bat`, instalador com `-Conferir`, página da margem reconhece `file://`, log do servidor no arquivo certo e `CONFERIR SERVIDOR.bat` (commits `71cfbf5`, `9c15d24`, `e80e5ed`) · [[2026-10-01 — Pasta de rede arrumada e a margem na VM SRV-IA]]
- **2026-09-29 a 2026-10-01** — Incidente: as cargas da VM rodaram 4 horas atrasadas (relógio da VM atrasado quando os gatilhos foram gravados), e a `margem_item` não terminou nenhuma carga de 29/09 a 02/10 (primeira completa em 03/10). Visto no log da VM em 2026-10-09 · [[2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga]]
- **2026-09-30** — [[Abertura de margem]] vira sistema local na rede (`servidor_margem.py` + `painel_margem.html`), com a regra "quem abriu é quem fecha" em bloqueio total (Júlio) no banco, a consulta `margem_filial` e a aba da Vercel só de consulta (commit `b3bb730`; migração `comercial_margem_estado_e_regra`) · [[2026-09-30 — Sistema de abertura de margem das filiais]]
- **2026-09-30** — Primeira versão da margem: aba "Operação › Margem das filiais" no painel, fila no Supabase, `agente_margem.py` e a trava `MARGEM_ATIVA` (commit `0d2571c`; migração `comercial_margem_filial`) · [[2026-09-30 — Sistema de abertura de margem das filiais]]
- **2026-09-29** — Exportação de toda tabela vira `.xlsx` formatado, gerado por `web/planilha.js` (commit `4d9d739`) · [[2026-09-29 — Exportação do painel comercial em Excel]]
- **2026-09-29** — Filtro de filial corrigido, KPIs alinhados e gráfico de margem maior (commit `d882156`) · [[2026-09-28 — Painel comercial repaginado e o banco que parou]]
- **2026-09-29** — Margem agregada no banco (`mv_margem_dia`, `ix_margem_piores`, nova `painel_dados`): o painel cai para 0,2 s (migração `comercial_margem_agregada`; arquivos do commit `a67b3fd`) · [[2026-09-28 — Painel comercial repaginado e o banco que parou]]
- **2026-09-28** — Incidente: o DATA WAREHOUSE para de responder das ~17:45 até 2026-09-29 · [[2026-09-28 — Painel comercial repaginado e o banco que parou]]
- **2026-09-28** — Painel repaginado: sem Power BI na tela (Júlio), ouro como acento, tabelas navegáveis, totais em faixa, animações finitas (commit `61b8df3`) · [[2026-09-28 — Painel comercial repaginado e o banco que parou]]
- **2026-09-28** — Correção do pool da API (502), aquecimento do painel no fim de cada carga e tela de erro com o motivo real (commit `1c0738e`) · [[2026-09-28 — BI COMERCIAL do Power BI ao DATA WAREHOUSE]]
- **2026-09-28** — Publicado na Vercel em `gestao-comercial-web-three.vercel.app` (Root Directory `web`, porta 5432, região `gru1`) (commit `583012c`) · [[2026-09-28 — BI COMERCIAL do Power BI ao DATA WAREHOUSE]]
- **2026-09-28** — Agendado aos :45, nos oito horários do Power BI (Júlio), e a margem às 03:45; instalador rodado na VM `SRV-IA` às 17:25 (na `LOGISTICA-55`, às 17:21, ele copiou os arquivos e deixou a tarefa-cobaia, sem carga) · [[2026-09-28 — BI COMERCIAL do Power BI ao DATA WAREHOUSE]]
- **2026-09-28** — Primeiras cargas contra o WinThor e validação ao centavo com o Power BI (fev/2026) · [[2026-09-28 — BI COMERCIAL do Power BI ao DATA WAREHOUSE]]
- **2026-09-28** — Sistema criado: ETL com 8 consultas, schema `comercial` e três dimensões do `core`, painel de 4 páginas (commit `2bd2363`; migrações `comercial_schema_inicial`, `comercial_views_e_painel`, `comercial_painel_dados`, `comercial_painel_dados_clientes_por_rca`) · [[2026-09-28 — BI COMERCIAL do Power BI ao DATA WAREHOUSE]]

## Pendências
- [x] Copiar `etl/` para `P:\INTEGRAÇÃO BI\COMERCIAL` — 2026-09-28
- [x] Rodar o diagnóstico e conferir contra o Power BI — 2026-09-28, tudo bateu
- [x] Primeira carga completa — 2026-09-28
- [x] Publicar no GitHub — 2026-09-28, commit `2bd2363`
- [x] **Tornar o repositório privado** — constatado privado em 2026-10-05 (404 sem login)
- [ ] **Júlio:** decidir sobre o deploy pelo Git, que fica `BLOCKED` com o repositório privado no Hobby: voltar a público, assinar o Pro ou publicar sempre pela API (ver [[Vercel]])
- [x] Projeto na Vercel publicado — 2026-09-28
- [x] ~~Ligar a Vercel Authentication~~ — substituído pela [[SENTINELA LUBE]]: `exige_login` ligado em 2026-10-06
  - **Root Directory = `web`**, antes do primeiro deploy. Sem isso a Vercel faz o build na raiz, acha os scripts Python do `etl/` e morre com `No python entrypoint found` — aconteceu em 2026-09-28. Mesma configuração do [[SISTEMA FINANCEIRO]].
- [x] Agendado — 2026-09-28 (na `SRV-IA`, 4 horas atrasado até a reinstalação de 2026-10-01; também na estação `LOGISTICA-55` de 2026-10-01 a 2026-10-09; **só na `SRV-IA` desde 2026-10-09**)
- [x] Rodar o instalador de novo na VM para levar o aquecimento do painel — 2026-10-09 (`INSTALAR TUDO.bat` na `SRV-IA`)
- [x] Migrações `03-margem-agregada.sql` e `04-painel-dados-v2.sql` aplicadas — 2026-09-29
- [ ] Se a lentidão voltar com o banco saudável, avaliar subir o tamanho da instância do Supabase
- [ ] **Conferir no banco e corrigir: a `mv_margem_dia` não é atualizada pelo ETL** (ver "Achado de 2026-10-09"); depois, corrigir o `web/db/README.md` (que também diz "5x/dia" para os fatos rápidos; são 8)
  - 2026-10-14: corrigido no repositório (`ad7eefb`, 2026-10-13); **falta o Júlio** levar o `sync_bi_comercial.py` para `P:\INTEGRAÇÃO BI\COMERCIAL\2 - SISTEMA COMERCIAL` e rodar o `INSTALAR TUDO.bat` do COMERCIAL na `SRV-IA`. O [[GUARDIÃO DA LUBE]] fecha o alarme sozinho quando a view alcançar a `fato_margem_item`
- [ ] Investigar no `sync_bi_comercial.log` da `SRV-IA` por que a `margem_item` morreu sem registrar em 2026-10-11 e 2026-10-13, e se a carga de 17–20 min pede antecipar a margem para 03:30 (achado do [[GUARDIÃO DA LUBE]], 2026-10-14)
- [ ] Avaliar levar para cá o painel que abre na hora do [[REPOSIÇÕES E CHAMADOS]] (resposta pronta no banco + CDN): este ainda lê o banco a cada abertura a frio
- [ ] **[[Abertura de margem]]:** cadastrar `ORACLE_USER_ESCRITA`/`ORACLE_PASSWORD_ESCRITA` no `ENV` (Júlio). **Conferido em 2026-10-09: o `ENV` da rede e o da `SRV-IA` só têm as 11 chaves do ETL** — até lá nenhum pedido de abrir ou fechar chega ao WinThor. A parte de "rodar o instalador de novo" já foi feita (2026-10-01 e 2026-10-09). `MARGEM_ATIVA` não é mais necessário: o painel da Vercel não escreve mais
- [ ] Definir `MARGEM_PESSOAS` — a lista de quem pode abrir e fechar (ausente do `ENV` em 2026-10-09). Sem ela o nome é digitado livre, e a regra de quem fecha vale pelo que a pessoa escreveu
- [ ] Avisar o comercial do endereço — **`http://SRV-IA:8080`** desde 2026-10-01 — e criar `MARGEM_ENDERECO` na Vercel (apagar `MARGEM_ATIVA`, se tiver sido criada), para o painel apontar o caminho a quem procurar por lá
- [ ] **Senha do WinThor em texto puro nos 8 `.bat`** de `Z:\Alexandre TI\BATS` (pasta de rede aberta). O plano era trocar a senha e só então apagar os arquivos, mas o [[data-warehouse]] registra que a senha do WinThor não se troca — **o Júlio precisa decidir** (trocar a do usuário dos `.bat`, se for outro; ou criar um usuário só com `UPDATE` em `PCPRODFILIAL` e tirar os `.bat` da pasta aberta). O sistema já os dispensa
- [ ] Investigar os **62 produtos abertos fora do sistema** entre 30/09 e 09/10 (546 → 608, histórico vazio): os `.bat` ainda estão em uso?
- [ ] Primeiro pedido real de abrir/fechar e conferência com `python conferir_margem.py --pedido N` na `SRV-IA` (Júlio, depois da credencial de escrita)
- [ ] Commitar a troca "SAQ" → "SAC" dos comentários (`etl/consultas_comercial.py`, `web/db/07-dim-rca-email.sql`) e a `dim_nf_saida` (`etl/consultas_comercial.py`, `web/db/08-dim-nf-saida.sql`)
- [x] Levar a `dim_nf_saida` para a `SRV-IA` — 2026-10-09 10:56, cópia direta pelo `\\SRV-IA\c$` (exceção à regra "só pelo instalador", conferida arquivo a arquivo). Se a próxima rodada do `INSTALAR TUDO.bat` parar com acesso negado no `consultas_comercial.py`, é esta cópia (mesmo caso do `conferir_margem.py` em 2026-10-09)
- [ ] Conferir a primeira carga agendada da `dim_nf_saida` (12:45 de 2026-10-09) no `controle_carga`
- [ ] Conferir no `controle_carga` se a `margem_item` ficou mesmo sem recarregar de 2026-09-29 a 2026-10-02 (pelo log da VM, as quatro cargas pararam no meio; ver "Antes disso: a VM rodava 4 horas atrasada")
- [x] Investigar a "Sync rapidas" rodando em dobro no mesmo minuto — 2026-10-09: eram as duas máquinas; resolvido
- [x] Nivelar o `bi_comum.py` de `C:\BI\COMERCIAL` — 2026-10-09: a cópia velha era a da `LOGISTICA-55`, que parou; a `SRV-IA` recebeu a atual
- [x] Remapear o `P:` depois do reboot da `LOGISTICA-55` — 2026-10-09 a pasta de rede voltou a ser lida e o instalador rodou dela
- [ ] **Decisão do comercial:** grão oficial da comissão (RCA ou RCA × filial; diferença de R$ 2.263,16 em fev/2026) e o que fazer com o ST dentro do CMV
- [ ] Confirmar com a TI se o alias `prod` do Power BI é o mesmo banco `192.168.0.5:1521/wint`
- [ ] Nivelar o `bi_comum.py` do [[BI COMPRAS]] com esta versão (ganhou `definir_schema()` e, em 2026-10-08, `tranca_de_carga`)

Veja também [[Mapa de sistemas]], [[Glossário WinThor]] e [[2026-09-28 — BI COMERCIAL do Power BI ao DATA WAREHOUSE]].
