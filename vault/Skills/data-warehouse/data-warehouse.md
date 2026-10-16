---
name: "data-warehouse"
description: "Usar ao criar, alterar ou diagnosticar qualquer BI ou sistema da Lube que leia do Oracle/WinThor e grave no Supabase DATA WAREHOUSE — conexões, isolamento por schema, pastas, consultas, agendamento e publicação."
tipo: skill
---

# DATA WAREHOUSE — como a Lube monta um BI

Este é o manual do caminho que já está em produção. Todo sistema novo que precise
ler o WinThor segue esta mesma trilha: **Oracle/WinThor → ETL em Python → Supabase
(projeto DATA WAREHOUSE) → painel na Vercel**. Nada de planilha no meio, nada de
navegador falando direto com o banco.

O BI COMPRAS é a referência viva. Quando algo aqui estiver ambíguo, abra o
repositório em `Desktop\BI\6. COMPRAS` e copie o padrão de lá.

Ligações no cérebro: [[BI COMPRAS]] · [[Mapa de sistemas]] · [[Como eu gosto dos BIs]] · [[WinThor]] · [[Oracle]] · [[Supabase]] · [[Vercel]]

---

## 1. Um banco só, um schema por sistema

**Todo sistema novo grava no projeto DATA WAREHOUSE.** Não se cria projeto novo no
Supabase por sistema: uma credencial, um backup, um lugar para olhar, e dimensões
que são compartilhadas de verdade em vez de duplicadas.

**Cada sistema ganha o próprio schema**, com o nome do sistema — `compras`,
`financeiro`, `logistica`. Dentro dele ficam os fatos, as views materializadas, o
`controle_carga` e a função do painel daquele sistema. Nada vai para o `public`.

### O que não pode se misturar

- **Um sistema nunca escreve no schema de outro.** Nenhum `TRUNCATE`, nenhum
  `INSERT`, nenhum `REFRESH` cruzando fronteira. O ETL do sistema X toca só o schema
  X (mais as dimensões de que ele é dono, ver abaixo).
- **O ETL nunca lê o fato de outro sistema.** Se o sistema novo precisa de um dado
  que já existe noutro schema, ele extrai do Oracle de novo ou o cruzamento acontece
  no banco — nunca no meio da carga, que assim não depende da ordem em que os
  sistemas rodam nem quebra quando o outro falha.
- **Cruzar sistemas é permitido no banco, no momento da leitura**: uma view ou uma
  função de painel pode juntar `compras.fato_x` com `financeiro.fato_y`. Isso é
  consulta, não carga, e não cria acoplamento entre os pipelines. Documente em
  `web/db/` qual painel faz isso.
- **Cada sistema tem o próprio `controle_carga`** dentro do seu schema. Para ver o
  estado de todos de uma vez, faça `UNION ALL` na consulta — não uma tabela comum,
  que viraria ponto único de falha entre pipelines independentes.

### A exceção combinada: o schema `core`

`core` guarda as **dimensões compartilhadas** — em 2026-10-09: `dim_fornecedor`,
`dim_produto`, `dim_comprador`, `dim_rca`, `dim_supervisor`, `dim_cliente` e
`dim_nf_saida`. Elas são de todos os sistemas de propósito: se cada
BI novo criasse a própria cópia do cadastro de fornecedores, em pouco tempo haveria
várias listas divergentes e nenhuma confiável.

A regra que mantém isso são:

- **Cada dimensão do `core` tem um dono único** — o ETL que a carrega.
  `dim_fornecedor`, `dim_produto` e `dim_comprador` são do [[BI COMPRAS]];
  `dim_rca`, `dim_supervisor` e `dim_cliente` são do [[BI COMERCIAL]] (desde
  2026-09-28), e a `dim_nf_saida` também (desde 2026-10-09, para o [[SAC]]).
  _Até 2026-09-28 as três que existiam eram todas do COMPRAS._
- **Só o dono escreve. Os outros leem.** Um sistema novo que precise da dimensão
  apenas a consulta.
- **Precisa de um campo que não existe?** Acrescente a coluna e estenda a consulta
  **do dono**, com valor nulo para quem não usa. Nunca crie uma segunda versão da
  mesma dimensão noutro schema.
- Carga de dimensão é sempre **upsert**, nunca `TRUNCATE`: um registro que sumiu da
  extração de hoje não pode desaparecer e quebrar as chaves dos fatos de outro
  sistema que ainda apontam para ele.

### Nomes

```
core.dim_*            dimensões compartilhadas (um dono cada)
<sistema>.fato_*      fatos, só do sistema
<sistema>.mv_*        views materializadas
<sistema>.controle_carga
<sistema>.painel_dados()
stg_<sistema>.*       staging, quando precisar
```

O schema já carrega o nome do sistema; não repita o prefixo no nome da tabela.

**Toda tabela nova nasce com RLS habilitado e sem políticas**: a chave pública
`anon` não lê nem escreve nada. O ETL não é afetado, porque conecta como dono.

---

## 2. As conexões

### Oracle / WinThor

| Campo | Valor |
|---|---|
| Host | `192.168.0.5` |
| Porta | `1521` |
| Service name | `WINT` |
| Usuário | `JULIOCESAR` |
| Senha | no `ENV` da máquina — ver abaixo |

Conexão pelo `oracledb` em **modo thin** (sem Oracle Client instalado). Acesso só de
leitura, e só de dentro da rede da empresa. A senha do WinThor **não se troca**; já
foi decidido, não sugerir rotação. (A decisão foi registrada aqui para o usuário de
leitura do ETL. A senha em texto claro nos 8 `.bat` de margem de `Z:\Alexandre TI\BATS`
é pendência aberta da [[Abertura de margem]]: se o usuário deles for este, quem decide
é o Júlio.)

**Correção de 2026-09-28:** aqui dizia que "o contêiner do assistente não alcança esse
IP". Não é verdade quando o Claude Code roda na máquina do Júlio: na construção do
[[BI COMERCIAL]] a sessão conectou no `192.168.0.5:1521/WINT`, rodou o diagnóstico e
fez a carga inteira, com o Supabase pelo session pooler. O que muda é a **pasta de
rede**: o `P:` só aparece depois de ser adicionado como diretório de trabalho da
sessão. Ou seja, dá para diagnosticar e carregar de dentro da conversa — não é preciso
devolver a tarefa para o Júlio rodar.

### Supabase — projeto DATA WAREHOUSE

| Campo | ETL (Python) | Vercel (serverless) |
|---|---|---|
| Host | `aws-0-sa-east-1.pooler.supabase.com` | igual |
| Porta | `5432` — session pooler | **`5432`** — ver a exceção abaixo (no papel, `6543`) |
| Banco | `postgres` | igual |
| Usuário | `postgres.ivcnotrynogaljrvvyes` | igual |
| Senha | no `ENV` | variável de ambiente na Vercel |

**Exceção medida em 2026-09-25:** neste projeto o transaction pooler (6543) conecta
mas **trava a consulta** (`Query read timeout` em ~5 s), e o session pooler (5432)
responde em 0,95 s. Por isso [[SISTEMA FINANCEIRO]], [[BI COMERCIAL]] e
[[REPOSIÇÕES E CHAMADOS]] usam **5432 também na Vercel**. O código do COMPRAS, o
mais antigo, ainda tem 6543 como padrão. A porta vem da variável `SUPABASE_DB_PORT`:
se um dia o 6543 voltar ao normal, basta trocá-la. Detalhe em
[[GESTÃO FINANCEIRO — documentação técnica]]. _Até 2026-10-09 esta tabela dava 6543
para a Vercel sem ressalva._

Id do projeto: **`ivcnotrynogaljrvvyes`** — é esse o valor a passar para as
ferramentas do Supabase MCP.

As duas portas existem por motivos diferentes. O **session pooler (5432)** serve ao
ETL, que roda de uma máquina numa rede IPv4 comum — a conexão "Direct" do Supabase
usa IPv6 e não funciona ali. Em tese, o **transaction pooler (6543)** serve à função
serverless, que não combina com conexão mantida aberta — mas neste projeto ele trava
(exceção acima). O padrão novo é 5432 com uma conexão por chamada (seção 8b, item 7).

### As duas senhas

Elas vivem em exatamente dois lugares, e **não são escritas aqui nem em nenhum
arquivo do repositório**:

- o arquivo `ENV` na máquina que roda o ETL (`C:\BI\<SISTEMA>\ENV`, copiado de
  `P:\INTEGRAÇÃO BI\<SISTEMA>\ENV`);
- as variáveis de ambiente do projeto na Vercel, cadastradas pelo Júlio.

Quem preenche é sempre o Júlio. O assistente não transcreve, não repete e não grava
senha em lugar nenhum — e não precisa: o pipeline lê do `ENV` sozinho, e a função da
Vercel lê da variável de ambiente sozinha.

---

## 3. Onde cada coisa mora

São três lugares, com papéis diferentes. Confundi-los custou um dia de depuração.

| Lugar | Papel |
|---|---|
| `P:\INTEGRAÇÃO BI\<SISTEMA>\` | Onde o código é **editado** e guardado na rede. |
| `C:\BI\<SISTEMA>\` | Cópia local; é o que a máquina **executa**. |
| `Desktop\BI\<n>. <SISTEMA>\` | Repositório git, sincronizado com o GitHub. |

Cada sistema tem a sua pasta nos três lugares e o seu repositório próprio — nunca
dois sistemas dividindo a mesma pasta de ETL ou o mesmo `ENV`.

A tarefa agendada roda numa sessão que **não tem o drive `P:` mapeado** e pode não
alcançar o `\\192.168.0.5\winthor-adm`. Por isso a execução é sempre local. O
instalador copia da rede para `C:\BI\<SISTEMA>` e precisa ser rodado de novo a cada
alteração — editar na rede sem reinstalar deixa a máquina rodando código velho, o
que já congelou uma carga sem nenhum erro aparecer. Mudança feita só no repositório
também não chega: em 2026-09-24 a mudança dos compradores do COMPRAS foi para o GitHub,
e a máquina do ETL seguiu com o código velho até 2026-09-28, quando o arquivo foi
copiado para o `P:` e para o `C:\BI\COMPRAS`.

**Onde os ETLs rodam (2026-10-09):** na **VM `SRV-IA` (192.168.12.30)** — o
[[BI COMPRAS]] desde 2026-09-28 e o [[BI COMERCIAL]] só nela desde 2026-10-09. A estação
`LOGISTICA-55`, onde o COMPRAS rodava antes, guarda as tarefas dele só desativadas
(plano B). O [[REPOSIÇÕES E CHAMADOS]] foi agendado pelo Júlio em 2026-10-09 (~14:07), numa máquina que **não** é a
`LOGISTICA-55` — esperado: a `SRV-IA`; a tela do instalador não mostra o nome da máquina, então confirmar.

**Nunca copie arquivo direto para a `C:\BI\<SISTEMA>` da VM** (pelo `\\SRV-IA\C$`). O
arquivo fica com outro dono e o instalador para com **acesso negado** ao sobrescrevê-lo
(BI COMERCIAL, 2026-10-09). O caminho é sempre pasta de rede + instalador (Claude,
2026-10-09).

Dentro do repositório:

```
etl/     pipeline Python que roda na rede do WinThor
web/     painel publicado na Vercel
web/db/  documentação dos objetos de banco que o painel usa
```

O repositório fica **privado quando o plano permite**: mesmo sem senha, ele descreve a
estrutura interna do banco e as regras de negócio da operação. Mas no Hobby da
[[Vercel]] repositório privado **trava o deploy pelo Git** (`BLOCKED`). Por isso COMPRAS
(desde 2026-10-06), Gestão TI e REPOSIÇÕES estão **públicos**, por decisão do Júlio;
COMERCIAL e FINANCEIRO seguem privados e saem pela API da Vercel. O que impede vazamento
é o `.gitignore`: o `ENV` nunca entra; o que vai para o git é o `ENV.example`, com
espaços reservados. _Até 2026-10-09 esta seção dizia só "o repositório fica privado"._

---

## 4. O arquivo ENV

Nome exatamente `ENV`, sem extensão, na mesma pasta dos scripts.

```
ORACLE_HOST=192.168.0.5
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=WINT
ORACLE_USER=JULIOCESAR
ORACLE_PASSWORD=...

SUPABASE_DB_HOST=aws-0-sa-east-1.pooler.supabase.com
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.ivcnotrynogaljrvvyes
SUPABASE_DB_PASSWORD="..."

LOG_LEVEL=INFO
```

Dois detalhes que já quebraram carga em silêncio:

- **A senha do Supabase vai entre aspas duplas.** Se tiver `#` e não estiver entre
  aspas, tudo depois do `#` vira comentário e a senha é cortada pela metade, sem
  nenhum aviso.
- **Campos separados, nunca uma URL de conexão.** As senhas do Supabase costumam ter
  `@`, `/`, `%`, que quebrariam a URL se não fossem codificadas.

---

## 5. Anatomia de um pipeline

Sete arquivos em `etl/`, sempre com os mesmos papéis:

| Arquivo | Papel |
|---|---|
| `bi_comum.py` | Infraestrutura: conexões, extração, carga, log, validação. Não roda sozinho. |
| `consultas_<sistema>.py` | Catálogo: uma `Consulta` por tabela de destino. |
| `sync_<sistema>.py` | Orquestrador — é ele que carrega de verdade. |
| `diagnostico_<sistema>.py` | Roda tudo **sem gravar nada**. Use antes de qualquer carga. |
| `executar.py` | Chama o sync capturando falhas que aconteceriam sem log. |
| `_teste_agendador.py` | Cobaia de 2 segundos que prova se uma tarefa consegue disparar. |
| `instalar_e_agendar.ps1` | Instala em `C:\BI\<SISTEMA>` e cria as tarefas. |

O `bi_comum.py` é o mesmo em todos os sistemas: copie-o inteiro do COMPRAS em vez de
reescrever. Se precisar mudar algo nele, mude na origem e releve a cópia para todos.

`conectar_supabase()` abre a conexão com `connect_timeout` de 20 s, keepalive e
`statement_timeout` de 120 s (COMPRAS, 2026-09-28). Sem isso, uma conexão derrubada
em silêncio pelo pooler pendurou a carga do COMPRAS na VM por mais de 5 minutos, sem
erro nenhum no log. Desde 2026-10-08 o `bi_comum.py` do COMERCIAL tem também a
`tranca_de_carga` (seção 7, item 7), que ainda falta levar para os outros ETLs.

O desenho é **dirigido por catálogo**: um `dataclass Consulta` descreve tudo, e um
carregador genérico executa. Nunca escreva um script por consulta.

```python
Consulta(
    nome="ruptura_cobertura",
    descricao="...",
    pagina="COMPRAS",              # a página do Power BI que isso alimenta
    sql="...",
    destino="compras.fato_ruptura_cobertura",
    colunas=(...),                  # colunas do destino, na ordem
    mapear=lambda r: (...),         # linha do Oracle -> tupla do Postgres
    linhas_esperadas=7166,          # referência do Power BI, para validar
    grupo="rapidas",                # "rapidas" | "pesadas"
    streaming=False,                # True acima de ~500 mil linhas
    tolerancia_pct=0.02,            # 0.15 quando o filtro depende do estoque do dia
    chave_conflito=None,            # preenchido = upsert em vez de truncate
    pos_carga=None,                 # ex.: REFRESH MATERIALIZED VIEW
)
```

### Como cada tipo de tabela carrega

- **Fatos**: `TRUNCATE` + `INSERT`, tudo dentro de uma transação.
- **Dimensões**: upsert via `chave_conflito`, pelo motivo da seção 1.
- **Tabelas muito grandes**: `streaming=True`, que carrega em lotes de 50 mil.
- **Agregados caros**: view materializada, atualizada pelo `pos_carga` **dentro da
  mesma transação**. No COMPRAS isso levou cortes de 6,5 s para 0,15 ms.

Cada consulta roda isolada: se uma falhar, as outras seguem, e o resultado de toda
execução vai para `<sistema>.controle_carga` — é essa tabela, não o log em arquivo,
que responde "a carga de ontem à noite entrou?".

---

## 6. Validar antes de confiar

Um BI que substitui um Power BI existente precisa bater com ele — ou divergir de
propósito, documentado. No COMPRAS apareceram quatro bugs no original. A regra:

1. Rode o `diagnostico_*.py` primeiro. Ele testa todas as consultas sem gravar.
2. Compare a contagem de linhas com o `linhas_esperadas` de cada consulta.
3. Onde divergir, **investigue antes de ajustar**. Já foram encontrados: filtro
   escrito depois do `GROUP BY` (nunca executa), `DECODE` sem `ELSE` devolvendo
   nulo, divisão protegida contra `100` em vez de `0`, e grão errado por join com
   pedidos em aberto.
4. Ao corrigir um erro do original, **mantenha as duas colunas** — `valor` e
   `valor_original` — para quem confere lado a lado, e escreva no README por quê.
5. Ao manter de propósito um comportamento errado para os números baterem com o BI
   atual, escreva isso também. Silêncio aqui vira desconfiança depois.

Um somatório nunca se valida sozinho: confira contra a fonte oficial daquele número.
No COMPRAS, somar a coluna de verba do fato de ruptura dobrava o valor, porque ela é
por fornecedor principal e não por fornecedor.

---

## 7. Agendamento — as armadilhas

Os horários ficam **10 minutos antes** do momento em que o dado precisa estar pronto.
Meça a duração real depois: no COMPRAS a carga das 07:50 levou **8 min 25 s** sob
carga do Oracle pela manhã, contra 31 segundos à meia-noite — a folga de 10 minutos
quase não bastou. A medição é de 2026-09-23, na `LOGISTICA-55`; na VM `SRV-IA`, onde o
ETL roda desde 2026-09-28, a das 07:50 ainda não foi medida (2026-10-09).

Com mais de um sistema agendado, **escalone os horários**: dois ETLs pesados na mesma
hora disputam o mesmo Oracle e ambos ficam lentos.

As tarefas rodam **sem abrir janela**. Oito coisas que custaram caro para descobrir:

1. **`pythonw.exe` deixa `sys.stdout` e `sys.stderr` como `None`.** O primeiro
   `print` derruba o script com `AttributeError`, invisivelmente. Por isso
   `configurar_log` redireciona os dois para `os.devnull` quando não há console.
2. **Erro anterior ao logging não tem para onde ir.** Uma biblioteca faltando e a
   tarefa "roda" sem escrever nada em lugar nenhum. É para isso que existe o
   `executar.py`: ele chama o sync dentro de um `try/except` e grava qualquer falha
   em `falha_inicial.log`.
3. **A janela elevada pode ser de outra conta.** Quando o UAC pede credencial de
   administrador, `$env:USERNAME` naquela janela é `Administrador`, e uma tarefa
   registrada para ela nunca roda — o Agendador aciona e recusa, com
   `o usuário "LUBE\Administrador" não estava conectado` no log operacional e nenhum
   sinal no log do ETL. O instalador anota o usuário da janela **normal** e repassa.
4. **Não suponha o modo de logon.** Registre uma tarefa-cobaia apontando para
   `_teste_agendador.py`, dispare, e veja se o arquivo aparece. Teste senha guardada,
   depois S4U, depois interativo, e fique com o primeiro que disparar de verdade. Se
   nenhum disparar, o bloqueio é a política da máquina (direito *Fazer logon como
   tarefa em lote*) e quem resolve é o TI — não crie tarefa que nunca vai rodar.
5. **`.ps1` sem BOM é lido como ANSI** pelo Windows PowerShell, e acento em caminho
   vira lixo. Grave os scripts em **ASCII puro + BOM UTF-8 + CRLF**, e use
   `$PSScriptRoot` em vez de caminho escrito à mão.
6. **Gatilho gravado com o relógio errado não se corrige mudando o fuso.** A VM
   `SRV-IA` estava com o relógio **4 horas atrasado** quando as tarefas do COMPRAS e do
   COMERCIAL foram criadas, em 2026-09-28, e elas rodaram 4 horas depois do planejado —
   **sem nenhuma falha** no `controle_carga`, só o horário errado (e o faturamento das
   02:50 indo às 06:50 coincidiu com o banco saturado de 2026-10-01). O COMERCIAL se
   acertou na reinstalação de 2026-10-01; o COMPRAS, só em 2026-10-09. A correção é
   rodar o `instalar_e_agendar.ps1` de novo. **Antes de agendar, confira o relógio da
   máquina; depois, confira no `controle_carga` se o horário bate**, e não só se a
   carga entrou.
7. **Uma máquina por tarefa.** O instalador cria todas as tarefas na máquina onde
   roda. Ao mudar o sistema de máquina, **apague todas as tarefas da antiga**
   (`Get-ScheduledTask 'BI <Sistema>*' | Unregister-ScheduledTask -Confirm:$false`, em
   PowerShell como administrador; `&` encadeando comandos é do cmd, não do
   PowerShell). No [[BI COMERCIAL]], de 2026-10-01 a 2026-10-09, a estação e a VM
   rodaram a mesma carga no mesmo minuto: uma morria aos 120 s do `statement_timeout`,
   esperando o lock (`while locking tuple`). Defesa no código:
   `bi_comum.tranca_de_carga` (*advisory lock* do Postgres, uma carga por grupo na
   empresa inteira; quem chega depois sai com código 0, para o Agendador não
   reiniciar). Apagar a tarefa resolve o caso; a tranca resolve a classe — leve-a para
   todo ETL.
8. **Serviço que fica no ar não trata o banco como condição de partida.** Uma falha
   de conexão na partida vira aviso, e a primeira consulta que der certo reconecta. A
   tarefa leva um gatilho de 30 em 30 min com `MultipleInstances IgnoreNew`:
   "reiniciar N vezes" não cobre uma queda maior que N × intervalo
   ([[Abertura de margem]], 2026-10-01).

Também: `Start-ScheduledTask` exige administrador; o Agendador recusa
`-WorkingDirectory` em caminho de rede; e tarefa criada com senha guardada só é
**visível** para sessão elevada — `Acesso negado` ao listar não significa que ela não
existe. Bloquear a tela não atrapalha; a máquina **suspender** atrapalha.

### Horários em produção

Todas na VM `SRV-IA`. As do COMPRAS estão lá desde 2026-09-28, com os gatilhos
recriados em 2026-10-09; as do COMERCIAL, só lá desde 2026-10-09.

| Tarefa | Roda às | Dado pronto às |
|---|---|---|
| [[BI Compras - Sync rapidas]] | 07:50, 11:50, 17:50, 23:50 | 08:00, 12:00, 18:00, 00:00 |
| [[BI Compras - Sync faturamento]] | 02:50 | 03:00 |
| [[BI Comercial - Sync rapidas]] | 06:45, 07:45, 08:45, 09:45, 12:45, 14:45, 15:45, 16:45 | 07:00 a 17:00 (os oito do Power BI) |
| [[BI Comercial - Sync margem]] | 03:45 | 04:00 |

O COMERCIAL roda aos :45 (15 min antes) para terminar antes de o COMPRAS começar aos
:50.

---

## 8. O painel na Vercel

Um projeto da Vercel por sistema. Site estático mais uma função serverless, sem
framework.

- Todo o conteúdo do painel vem de **uma função SQL** (`<sistema>.painel_dados()`)
  que devolve o payload inteiro como JSON. A função serverless é só encanamento.
- O navegador **nunca** fala com o banco. Ele chama `/api/dados`, e a função, no
  servidor, conecta com credencial de variável de ambiente.
- Porta 5432 (ver a exceção da seção 2), região `gru1`.
- Resposta com `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400,
  stale-if-error=86400`, para que só o primeiro acesso de cada janela toque o banco e,
  com o banco fora, a Vercel sirva a última cópia boa. É o do COMPRAS desde 2026-10-06
  (commit de 2026-10-05): com `stale-while-revalidate=3600`, quem abria primeiro de
  manhã esperava a função acordar e consultar o banco. _Até 2026-10-09 esta linha dava
  o de 1 h._ Para abrir sempre na hora, o padrão novo é o da seção 8b.
- Cabeçalhos no `vercel.json`: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy` e `X-Robots-Tag: noindex, nofollow`.

**Acesso.** Em *Settings › Deployment Protection*: *Vercel Authentication* exige
conta no time da Lube — é o que faz o link cair numa tela "Log in to Vercel" para
quem não é do time. **Mas no plano Hobby ela só existe no modo Standard, que deixa o
endereço principal de produção aberto** (descoberto em 2026-10-05: a folha do
SISTEMA FINANCEIRO respondia sem login). *Password Protection* não existe no Hobby.
**Teste a proteção sempre pelo endereço principal** (`<projeto>.vercel.app`), nunca
pela URL do deploy. A porta que funciona sem plano pago é o guarda da
[[SENTINELA LUBE]] com "exige login". Todo painel novo nasce com o guarda instalado
(ver `guarda/LEIA-ME.md` no repositório do Painel Lube). **Desde 2026-10-06 todos os
sistemas do portal, o COMPRAS inclusive, só abrem para quem entra pelo
[[PAINEL LUBE DISTRIBUIDORA]]** — guarda da Sentinela com "exige login" (decisão do
Júlio). No COMPRAS (slug `gestao-compras`), sem login `/` dá 302 para o portal e a API
dá 401; a Vercel Standard ficou ligada só para os endereços de deploys antigos. _De
2026-09-22 a 2026-10-06 o COMPRAS ficou aberto a quem tivesse o endereço, também por
decisão do Júlio._ Sempre que a proteção for mexida,
atualize o README — um README que afirma ser restrito quando está aberto é pior que
nenhum.

---

## 8b. Painel que abre na hora (padrão desde 2026-10-07)

Nasceu de um pedido do Júlio ("fica muito tempo esperando abrir e gera frustração, principalmente na frente da
empresa que estou mostrando") e de um incidente: com o banco saturado, a primeira chamada de um painel que lê o
banco a cada abertura a frio **deu 504 depois de 60 s**. Medida em 2026-10-07: página 0,3 s; API 60 s → 13 s →
0,16 s (CDN). **A consulta nunca é o problema — conseguir a conexão é.** O desenho tira o banco do caminho de
quem abre. Referência viva: [[REPOSIÇÕES E CHAMADOS]] (`web/api/dados.js`, `web/api/_db.js`, `web/app.js`,
`etl/aquecer_painel.py`, `web/db/05-painel-cache.sql`).

1. **Resposta pronta no banco.** Tabela `<sistema>.painel_cache` (uma linha: `payload text`, `gerado_em`, `carga`) e
   a função `<sistema>.atualizar_painel_cache()`, chamada pelo `sync_*.py` no fim de cada carga. A API faz
   `SELECT payload FROM ... WHERE id = 1` — e cai para `painel_dados()` se a linha não existir. Mudou
   `painel_dados()`? Rode `atualizar_painel_cache()` na mão.
2. **CDN.** `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400` nas respostas
   boas e `no-store` nos erros. Depois de 5 min a Vercel ainda entrega a cópia na hora e renova por trás.
3. **Aquecedor.** Um script (`aquecer_painel.py`, tarefa de 5 em 5 minutos) chama `PAINEL_URL/api/dados` e grava uma
   linha por chamada (`cdn=HIT/STALE`, tempo, idade). É ele que espera o banco; nunca a pessoa. `PAINEL_URL` fica
   no `ENV` (não é segredo). **Se o painel passar a exigir login (SENTINELA), o aquecedor também é barrado** —
   precisa de um caminho liberado. Esse caminho é um **segredo próprio num cabeçalho** (`Authorization: Bearer ...`,
   como o `CRON_SECRET` do agendador do [[GESTÃO TI]]), guardado no `ENV` e na Vercel. **Nunca o User-Agent:**
   qualquer um copia um nome. Em 2026-10-09 o aquecedor do REPOSIÇÕES ainda só manda o User-Agent
   (ver [[Reposições - Aquecer painel]]).
4. **Cópia no navegador.** IndexedDB (não `localStorage`: o JSON passa de 1 MB). A tela abre com a cópia, mostra
   "dados guardados · atualizando…" e troca se `carga` mudou. Versione o formato (`VERSAO_GUARDADO`).
5. **`fetch(..., { cache: "no-store" })`.** Sem isso o Chrome entrega a resposta velha do cache HTTP em 2 ms, sem
   avisar (efeito do `stale-while-revalidate`). A cópia do IndexedDB é explícita; a do navegador, não.
6. **Tela de espera que não fica muda:** relógio depois de 3 s e, depois de 12 s, o motivo ("o banco está
   acordando"). "Atualizar" pede a cópia do CDN; **Shift+clique** força o banco.
7. **Conexão da função serverless:** uma por chamada, **abrir → consultar → fechar** (nada de pool preso), com
   tentativas escalonadas. Isso não conserta pooler esgotado — só o desenho acima conserta.

**O que NÃO resolve** (aprendido errando): abrir várias conexões em paralelo (todas esperam o mesmo pool);
supor "pooler esfria quando fica parado" (um teste de ociosidade mostrou 0,15 s depois de 5 min parado; o que
havia era **pool esgotado**, `ECHECKOUTTIMEOUT ... in Session mode`).

**Como saber se o banco está mal** antes de culpar o código: `execute_sql` do MCP dando `connection timeout`;
nos logs (`query_logs`, fonte `postgres_logs`) a consulta do `postgres_exporter` sobre `pg_stat_statements`
passando de ~15 s ou estourando o tempo dezenas de vezes por hora; `pg_postmaster_start_time()` mostra um
reinício. O "checkpoint com `write=266 s`" que parece alarmante é normal. Receita completa e hipótese do
`pg_stat_statements` inchado (trocar `execute_values` por `COPY FROM STDIN` nos ETLs, se confirmada) em [[Supabase]].

## 9. Checklist de um sistema novo

1. Definir o nome do sistema — ele vira o schema, a pasta e o repositório.
2. Levantar as consultas de origem e o que cada página consome.
3. Escrever **todas** as consultas de uma vez no catálogo, com `linhas_esperadas`.
4. Rodar o `diagnostico_*.py` — nada gravado ainda.
5. Conferir cada contagem contra a referência e investigar toda divergência.
6. Criar o schema do sistema e as tabelas, com RLS habilitado e sem políticas.
   Dimensão que já existe no `core` se reaproveita, não se recria.
7. Carga completa. Conferir `<sistema>.controle_carga`.
8. Medir os cortes agregados; onde passar de um segundo, criar view materializada e
   pendurar o refresh no `pos_carga`.
9. Escrever a função `painel_dados()` e o painel.
10. Publicar na Vercel, com as variáveis cadastradas pelo Júlio.
11. Instalar e agendar com `instalar_e_agendar.ps1`, em horário que não colida com
    os outros sistemas, e **provar** que rodou olhando `controle_carga`. **Numa máquina
    só** (de preferência a VM `SRV-IA`), com o relógio dela conferido antes, e com a
    `tranca_de_carga` no sync (seção 7, itens 6 e 7).
12. README com a arquitetura, as consultas, e as divergências conscientes em relação
    à fonte original.
13. **Painel que abre na hora** (seção 8b): `painel_cache` preenchido pela carga, cabeçalhos de cache na API,
    aquecedor agendado e `PAINEL_URL` no `ENV`. Medir a abertura a frio **antes** de entregar ao Júlio:
    `curl -s -o /dev/null -w "%{time_total}\n" https://<painel>/api/dados`, três vezes seguidas.

---

## 10. Ao diagnosticar

- "A carga de hoje entrou?" → consulte `<sistema>.controle_carga` pelo Supabase MCP,
  projeto `ivcnotrynogaljrvvyes`. Nunca responda de memória nem pelo log na tela.
- "A tarefa rodou mas nada aconteceu" → veja `falha_inicial.log`, depois o log
  operacional do Agendador (Visualizador de Eventos › Microsoft › Windows ›
  TaskScheduler › Operational). O motivo real quase sempre está lá.
- "O painel está com número velho" → veja se as views materializadas foram
  atualizadas, e se a cópia em `C:\BI\` é mesmo a última versão da pasta de rede.
- "A carga entrou, mas o dado parece de horas atrás" → compare os horários do
  `controle_carga` com os da tabela de horários: gatilho gravado com o relógio errado
  (seção 7, item 6).
- "Consulta morrendo aos 120 s com `while locking tuple`" → a mesma tarefa em duas
  máquinas (seção 7, item 7). Liste `Get-ScheduledTask 'BI <Sistema>*'` em cada uma.
- Resultado grande de `execute_sql` → redirecione para arquivo e leia com Python, em
  vez de trazer tudo para o contexto.

---

## Registro de mudanças

- **2026-10-14** — Schema `trade` ([[GESTÃO COMERCIAL TRADE]]): primeiro que guarda um **pacote** (arquivo colunar comprimido,
  em pedaços de 4 MB numa tabela `bytea`, com ponteiro de versão trocado numa transação) em vez de um fato linha a linha, porque
  o consumidor precisa da base inteira em memória. Também novos neste padrão: o ETL **confere antes de publicar** (recusa carga
  com menos de 90% das linhas da versão no ar), **fonte secundária fora do ar vira AVISO e usa a cópia do banco**, o ENV **manda
  sobre variável de ambiente do sistema** e o ref do projeto é conferido antes de ler ou gravar (as `SUPABASE_*` do Windows apontam
  para outro projeto). Carga: [[Trade - Sync]] · [[2026-10-14 — Gestão Comercial recriada do BI final do Power BI]]
- **2026-10-09** — Skill revista com o que mudou desde 2026-09-23 (compilado do Git e das
  sessões): `core` com as dimensões do COMERCIAL; porta 5432 também na Vercel;
  repositório público no Hobby; onde os ETLs rodam e nada copiado direto para a VM;
  timeouts do `bi_comum.py`; três armadilhas novas no agendamento (relógio, duas
  máquinas, serviço que fica no ar); horários do COMERCIAL; cache de 24 h; COMPRAS
  fechado pela Sentinela; segredo do aquecedor · [[2026-10-08 — Cargas do BI COMPRAS 4 horas fora do horário]],
  [[2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga]]
- **2026-10-07** — Seção 8b "Painel que abre na hora" e item 13 do checklist (Claude) ·
  [[2026-10-07 — Ajustes do painel de Reposições e a lentidão ao abrir]]
- **2026-10-05** — Seção 8 corrigida: a Vercel Standard do Hobby não protege o endereço
  principal · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-09-28** — Seção 2 corrigida: o Oracle responde da própria sessão do Claude Code ·
  [[2026-09-28 — BI COMERCIAL do Power BI ao DATA WAREHOUSE]]
- **2026-09-23** — Skill criada na conta do Claude e no vault, sem senhas ·
  [[2026-09-23 — agendamento do BI COMPRAS, acesso ao painel e skill data-warehouse]]

_A cópia instalada na conta (`anthropic-skills:data-warehouse`) é separada desta nota:
mudança feita aqui não chega lá sozinha. Em 2026-10-09 a da conta ainda tem o texto
anterior a esta revisão._
