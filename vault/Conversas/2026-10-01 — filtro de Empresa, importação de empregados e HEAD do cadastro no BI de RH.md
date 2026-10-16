---
tipo: conversa
data: 2026-10-01
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, empresa, empregados, head, exames, supabase]
registrado_em: 2026-10-09
---
# 2026-10-01 — filtro de Empresa, importação de empregados e HEAD do cadastro no BI de RH

## Resumo
Um dia de pedidos do RH no [[BI ABSENTEÍSMO RH]]:
- um botão ilegível no modo claro;
- **filtro por Empresa** no Absenteísmo, na Hora Extra e na InterJornadas. Nenhuma planilha traz a empresa, então ela é **resolvida pelo nome** do colaborador, e quem sobra recebe a empresa pela tela, gravada no banco;
- filtro **Mês de Vencimento** nos Exames;
- na Listagem de Empregados, importação da planilha, status **Afastado INSS** e botão **Demitir**, com o **Head Atual** passando a ser contado do cadastro.

## Decisões
- 2026-10-01 (Claude): seguir a convenção /60 e /80 do modo claro em vez de criar mais um caso particular no CSS.
- 2026-10-01 (Claude): "setor" não é empresa (são departamentos: ENTREGA, IMPNOITE, IMPDIA, ADMINISTRAÇÃO). A empresa vem do cruzamento por nome, não da planilha. Conferido no banco antes de começar.
- 2026-10-01 (Júlio): **manter o filtro Setor e acrescentar o Empresa**, com uma tela para atribuir a empresa de quem estiver sem, gravando no banco. O pedido veio da responsável do RH, que queria trocar Setor por Empresa.
- 2026-10-01 (Claude): na Hora Extra, não trocar só o rótulo "Departamento" por "Empresa" — seria mentira. A empresa é resolvida de verdade.
- 2026-10-01 (Claude): nos Exames, o corte entre vencido e a vencer é o mês corrente, calculado na hora, sem data fixa.
- 2026-10-01 (Júlio): quem está **AFASTADO INSS não conta** para o Head; toda mudança no cadastro (importar, adicionar, demitir) atualiza o Head na hora.
- 2026-10-01 (Claude): Head Atual passa a ser **contado do cadastro**, não importado — é o que "atualizar automaticamente" exige.
- 2026-10-01 (Claude): **Demitir marca o status em vez de apagar**, para manter ligado o histórico de absenteísmo, hora extra e exames, que referencia a pessoa pelo nome.
- 2026-10-01 (Claude): não rodar a importação real de empregados, que trocaria o cadastro de 203 pelas 199 da planilha — a decisão é do Júlio.

## O que foi criado ou mudou
**Modo claro** (commit `f77c791`)
- Atalhos da aba Exames de `-950/70` para `-950/80`. CSS do modo claro completado com `bg-yellow-950/80` (badge "Vence em 90d"), `bg-teal-950/60` (ícone do cabeçalho de Exames) e `bg-blue-950/80` (avatar da ficha de Hora Extra, que já estava quebrado).
- Contraste do botão "Vencidos agora" de 3,09 para 9,09; atalhos, 7 badges e ícone entre 4,2 e 10,4 (o "Desligado", em 4,2, é cinza de propósito).

**Empresa no Absenteísmo** (commit `3d3f0f5`)
- Migração `colaborador_empresa` **aplicada** no [[Supabase]] GESTÃO RH pelo Claude: uma empresa por nome normalizado, com origem "MANUAL". Versionada em `migrations/2026-10-01_colaborador_empresa.sql`.
- `carregarMapaEmpresas()` resolve a empresa pelo nome, na ordem atribuição manual > cadastro de empregados > controle de exames. Vale na carga, na importação e no Realtime.
- Filtro "Empresa" ao lado de "Setor" (grade de 6 para 7 colunas) e botão âmbar "N sem empresa", que abre a lista com as ocorrências de cada um e um seletor das 5 empresas.
- Resultado: L LOG TRANSPORTES 635, LUBE DISTRIBUIDORA 504, LUBE RIO 17, IMPÉRIO LOG 7, NÃO IDENTIFICADA 26 (7 pessoas) — 97,8% com empresa.

**Empresa na Hora Extra e na InterJornadas; mês de vencimento nos Exames** (commits `8081434`, `30028ad`)
- Hora Extra: o filtro "Departamento" virou "Empresa" (a coluna só tinha ENTREGA 454 e ADMINISTRATIVO 10). Resultado: L LOG 442, não identificada 22.
- InterJornadas: filtro de Empresa novo (a coluna `equipe` é LLOG nas 14.940 linhas). Resultado: L LOG 14.938, não identificada 2.
- `empresaDoColaborador()` extraído para as três abas usarem o mesmo mapa.
- Exames: filtro "Mês de Vencimento" com a contagem de cada mês ("Novembro/2026 (2)"); escolhido um mês, KPIs, gráficos e tabela mostram só quem vence nele; afastados e desligados ficam de fora; grade de 5 para 6 colunas.
- Depois o Júlio estranhou meses de 2025 na lista: eram os ASO **já vencidos** (os meses passados somavam os 26 do KPI). A lista foi separada em "Já vencidos (26)" e "A vencer".

**Empregados e HEAD** (commit `ce37b6e`)
- Botão "Importar Planilha" na Listagem de Empregados, lendo a aba "Listagem empregados". "AFASTADOS INSS" no departamento vira status AFASTADO INSS; o resto, ATIVO. Upsert pelo nome.
- Coluna Status na listagem e botão **Demitir** por linha, com confirmação.
- `head_atual` deixa de ser gravado: é a contagem de ATIVOS por empresa + função. `head_programado` continua vindo da tabela de metas.
- Adicionar, importar e demitir passam por `recarregarEmpregadosEHead`.
- Efeito na tela: **Head Atual Total de 196 (importado) para 203 (contado)**, com 6 funções divergindo (ex.: MOTORISTA da L LOG de 34 para 36). A planilha real foi lida sem gravar: 199 registros, 195 ativos + 4 afastados, 5 empresas.
- Cada commit foi publicado e conferido no ar pelo carimbo de versão.

## Erros e incidentes
- Causa do botão ilegível: o próprio Claude usou /70 nos atalhos ao criar a aba Exames.
- A primeira versão do filtro de empresa mostrou 19 pessoas sem empresa em vez de 7: o mapa era montado antes de o Supabase conectar e só entrava a base de exames embutida. Passou a ser recarregado depois da sincronização.
- A função `unaccent()` não existe no banco do RH; a consulta foi refeita sem ela.
- Uma linha de teste foi gravada e apagada em `colaborador_empresa` para validar a gravação; a tabela voltou a zero.
- Na InterJornadas, a linha do filtro de empresa caiu dentro do `if` da função e só filtrava com uma função escolhida. Corrigido antes do commit.
- No teste do HEAD, o head programado caiu de 213 para 190: o código sobrescrevia em vez de somar quando a mesma empresa + função tem meta em mais de um departamento. Corrigido antes do commit.

## Pendências
- [x] 2026-10-09 — Atribuir pela tela a empresa das 7 pessoas sem empresa: `colaborador_empresa` tem 7 linhas
- [ ] Rodar a importação da planilha de empregados (199 na planilha × 203 no cadastro) — Júlio. Em 2026-10-09 o cadastro tinha 215 linhas; confirmar o que entrou
- [ ] Dizer se "Demitir" deve apagar do banco em vez de marcar o status — Júlio
- [ ] Avisar o RH que o Head Atual mudou de 196 para 203 — Júlio
- [ ] Programar com antecedência os picos de vencimento de ASO (Setembro/2027 com 31 e Julho/2027 com 24) — RH

Veja também [[BI ABSENTEÍSMO RH]] e [[Como eu gosto dos BIs]].
