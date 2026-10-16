---
tipo: projeto
departamento: RH
status: ativo
tags: [projeto, rh, bi, absenteismo, turnover, hora-extra, interjornada, exames, supabase, vercel]
---
# BI ABSENTEÍSMO RH

Painel de gestão de pessoas da Lube (no menu e na aba do navegador: **GESTÃO RH**): absenteísmo, turnover, empregados, quadro de pessoal (HEAD), hora extra, interjornadas e exames periódicos (ASO). Não nasce do WinThor — os dados entram por **importação de planilha** (PontoMais e folha) e por cadastro na própria tela, direto num projeto [[Supabase]] próprio. Está **fora** do fluxo do [[Mapa de sistemas]] e não segue a skill [[data-warehouse]].

- Repositório: [Lube-Distribuidora-LTDA/GESTAO-RH](https://github.com/Lube-Distribuidora-LTDA/GESTAO-RH), branch `main` — renomeado de `Absente-smo-RH` e **de volta a público em 2026-10-16** (era privado desde ~2026-10-06; até 2026-10-05 já tinha sido público). O `git remote` da pasta local ainda aponta para o nome antigo, que o GitHub redireciona. Enquanto esteve privado, o deploy pelo Git ficava `BLOCKED` no plano Hobby e a publicação saía pela API da [[Vercel]]; público, o deploy pelo Git volta a funcionar — **mas as planilhas de pessoal ficam abertas na internet** (ver Pendências). Sobrou o branch `sentinela` (local e no GitHub), usado para as prévias do guarda em 2026-10-06; ele já está todo no `main`. Em 2026-10-09 não havia mudança sem commit na pasta.
- Pasta local: `Desktop\BI\4. RH\ABSENTEÍSMO RH - DASHBOARD\assets` (é a raiz do repositório)
- Banco: [[Supabase]] projeto **GESTÃO RH** (`jhznrwmwszpfogvbjnjx`, us-west-2). Nasceu em 2026-08-24 com o nome "RH Absenteísmo", que o README ainda usa.
- Painel: [[Vercel]], projeto `rh-absentismo` (`prj_DVpjRACXDvWA5e3x87ettwPn1sJL`) → `rh-absentismo.vercel.app`. **Fechado pela [[SENTINELA LUBE]] desde 2026-10-06**: só entra quem tem acesso pelo [[PAINEL LUBE DISTRIBUIDORA]] (slug `rh-absenteismo`); sem login a página vai para o portal, e `/api/*` e as planilhas respondem 401.
- Versão no ar: o rodapé do menu lateral mostra `versão AAAA-MM-DD (commit)` desde 2026-10-01. Em 2026-10-16 a produção é o commit `82c3ddc` (deploy `dpl_At11aErqUGkzPRsMakpPpjPLwa4H`, feito pela API).
- Cadastrado no [[PAINEL LUBE DISTRIBUIDORA]] como "Controle RH (absenteísmo)"

## Arquitetura — onde difere do padrão
Página única (`index.html`, ~9.560 linhas em 2026-10-09; ~7.600 em 2026-09-17) com Tailwind e Chart.js pelo CDN, sem bundler — o único passo de build gera o arquivo de configuração (ver abaixo). Duas diferenças conscientes em relação a [[Como eu gosto dos BIs]], registradas aqui para a documentação não mentir:

- **O navegador fala direto com o [[Supabase]]**, com a chave `anon` e Realtime por WebSocket — não há função serverless no meio. As únicas funções em `api/` são o diagnóstico executivo e o assistente de IA (ver abaixo).
- **Não existe ETL nem `controle_carga`.** A carga é a importação de planilha feita pelo usuário, que é **cumulativa** desde 2026-09-16 (commit `77c3227`): uma planilha nova soma ao que já existe e nunca substitui os meses anteriores; ocorrências repetidas (mesmo colaborador + data + motivo) são ignoradas. De 2026-08-31 a 2026-09-15 o painel mostrava **só a última importação** (escopo por `import_id`) e os meses antigos pareciam sumir. O botão **Histórico** continua listando cada importação, para renomear e consultar uma delas à parte.

Outros detalhes do desenho:
- **Build mínimo:** `npm run build` roda `generate-config.js`, que lê `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_PROJECT_NAME` da [[Vercel]] e gera `supabase-config.js` (fora do Git), desde 2026-08-24. Também grava a versão a partir de `VERCEL_GIT_COMMIT_SHA`, para o rodapé.
- **`vercel.json` com `routes` legado:** `{ handle: filesystem }` vem antes do redirecionamento geral para o `index.html` — sem isso `/api/*` caía no index (2026-08-31). O guarda da Sentinela funciona com esse formato; não precisou mudar.
- **Guarda da [[SENTINELA LUBE]]** em `middleware.ts` + `sentinela-guarda.ts`, runtime nodejs. Ele protege o site e `/api/*`, **não o banco**: o GESTÃO RH aceita leitura e gravação anônimas com a chave pública (ver Pendências). Não editar o `sentinela-guarda.ts` aqui; a cópia canônica fica no repositório do portal. Em 2026-10-07 os arquivos que a página carrega foram conferidos contra a lista de "arquivos proibidos" da Sentinela (entre eles `generate-config.js`, `Controle periodicos.xls` e `Importacao_Planilha.xlsx`).
- **`Dashboard Absenteísmo.html`** é uma cópia do `index.html` para abrir sem servidor. Foi mantida idêntica até 2026-09-09; depois os commits passaram a mexer só no `index.html` e a cópia ficou para trás. Exceção: os dois commits do Júlio de 2026-09-29 (`1e7afa0`, `959c662`) também mexeram nela. Em 2026-10-09 a cópia tinha ~6.500 linhas, contra ~9.560 do `index.html`.
- **Arquivos de dados soltos no repositório:** `dashboard_dataset.json` e `powerbi_data.json` vêm do primeiro commit (2026-08-21), trazem as 1.016 ocorrências da época **por funcionário** e não são lidos pela página; foram regravados nos commits de 2026-09-29. O `data.js` está vazio desde 2026-08-21 (`4eb26e2`), mas a versão cheia ficou no histórico. Ver Pendências.
- `deploy_schema.ps1` e `migrate_data.ps1` estão versionados apesar de constarem no `.gitignore` (entraram no primeiro commit). **Não têm token:** pedem o `SUPABASE_ACCESS_TOKEN` pelo ambiente ou na hora (conferido em 2026-10-09).
- Bibliotecas por CDN: Tailwind, Chart.js, `chartjs-plugin-datalabels` (desde 2026-09-15), SheetJS para ler `.xls`/`.xlsx` na tela, Lucide e o SDK do Supabase em versão fixa.

## Abas
| Aba | Origem do dado |
|---|---|
| Absenteísmo | Importação do "Relatório de Faltas" do PontoMais (vem em blocos por colaborador; o painel converte desde 2026-09-15) ou de planilha com cabeçalho; registro manual na tela |
| Turnover | Lançamento manual por setor e mês, só 2026 (os dados de 2025 foram apagados em 2026-08-31) |
| Empregados | Cadastro na tela e, desde 2026-10-01, importação da planilha (aba "Listagem empregados"). Status ATIVO, AFASTADO INSS ou DEMITIDO |
| Painel HEAD | Head **programado**: tabela de metas `head_necessidade_funcao` (carregada da planilha do RH em 2026-08-31, editável por empresa • departamento). Head **atual**: contado do cadastro de Empregados desde 2026-10-01 |
| Pagamento Hora Extra | Importação da folha, por competência escolhida na tela |
| InterJornadas | Importação do **"Relatório de Jornada"** do PontoMais; calcula o descanso de 11h entre jornadas |
| Exames Periódicos | Importação do "Controle periodicos.xls" (aba `Controle`) — vencimento do ASO |

Fora das abas: o **Diagnóstico Executivo** e o **Assistente Virtual do RH**, ambos com IA, e o **Histórico** de importações do Absenteísmo.

## InterJornadas: qual relatório do PontoMais exportar
Tem que ser o **"Relatório de Jornada"**. Não serve o de Horas Extras nem o de Faltas — de fora os três têm a mesma cara de planilha, e o nome do arquivo não denuncia.

O motivo é de conteúdo, não de formato: **só o Relatório de Jornada traz todos os dias do período**. O de Horas Extras lista apenas os dias que tiveram extra. Medido em 05/10/2026 na mesma equipe: Jornada = 2.291 linhas, 78 pessoas, até 31 dias cada (1.434 delas sem hora extra nenhuma); Horas Extras = 674 linhas, 66 pessoas, ~10 dias cada, com buracos — um motorista aparecia em 21/08 e só voltava em 25/08.

Com dias faltando, o descanso entre jornadas sai medido por cima do buraco (21/08 19:11 direto para 25/08 07:05) e o resultado **parece válido**. Por isso o painel recusa o arquivo em vez de aproveitar o que dá para ler. Desde 2026-10-05 o aviso identifica o relatório pelo título da planilha e diz por que ele não serve, em vez do antigo "nenhum registro válido encontrado".

Para reconhecer de olho:
- **Jornada** (o certo): blocos por pessoa — linha `Colaborador | NOME`, depois cabeçalho começando em `Data`, os dias, e `TOTAIS`.
- **Horas Extras / Faltas**: lista achatada — cabeçalho `Nome | Data | …`, com o nome repetido em toda linha.

Outras regras da InterJornadas:
- O descanso é medido da **última saída de um dia até a primeira entrada do dia seguinte**; abaixo de 11h é violação (`INTERJORNADA_LIMITE_MINUTOS`).
- A planilha **não tem rota**, então a análise de hora extra x descanso é **por colaborador**, não por rota como foi pedido no começo (2026-09-14).
- Descanso muito grande não é erro: quando há dias sem ponto no meio (Folga, DSR, Abonado), a ficha mostra o valor real e a nota "inclui N dias de Folga" (2026-09-15, pedido do Júlio: o número fica, a explicação vai ao lado).
- A ficha do colaborador mostra só os dias do período filtrado.
- **A equipe sai do nome do arquivo** (`equipe XXX`). Sem isso tudo entra como LLOG, sem aviso na tela. Por isso a coluna `equipe` não serve como empresa: o filtro Empresa usa o cruzamento por nome (ver abaixo).
- Reimportar o mesmo período atualiza, sem duplicar.

## Exames Periódicos (ASO)
A validade do ASO é **recalculada no painel** a cada carga, comparando `PROXIMO ASO` com a data de hoje. A coluna STATUS da planilha é o retrato do dia em que o RH salvou e envelhece sozinha — mesmo princípio de [[Corte do ponto]]: dado derivado se calcula, não se congela.

Faixas: Vencido · Vence em 30 dias · Vence em 90 dias · Em dia · Sem registro · Afastado INSS · Desligado. **Afastado e desligado ficam fora da conta de conformidade** — não há exame a cobrar deles, entrariam como falso vencido. Esses dois casos continuam vindo da planilha, porque a data sozinha não os identifica.

O TIPO vem digitado à mão (`ADMISSSIONAL`, `ADMISSINAL`, `MUDAANÇA FUNÇÃO`…): `normalizeTipoExame()` agrupa as variantes, senão cada erro de digitação vira uma fatia no gráfico. Datas vazias chegam como 1900/1901 (serial zero do Excel) e são tratadas como sem registro.

A tabela `exames_periodicos` **ainda não existe** no Supabase (conferido em 2026-10-09) — enquanto isso o painel usa `exames-periodicos-data.js` do repositório e guarda a importação no navegador, avisando na tela.

Desde 2026-10-01 há o filtro **Mês de Vencimento**, com a contagem de cada mês, separado em "Já vencidos" e "A vencer". O corte é o mês corrente, calculado na hora. Escolhido um mês, KPIs, gráficos e tabela mostram só quem vence nele; afastados e desligados ficam de fora. Na tabela, o badge de Situação usa rótulo curto ("Vence em 30d", "Sem exame") para caber numa linha; o rótulo longo fica na legenda, nos filtros e na exportação.

## Competência
Absenteísmo, Pagamento Hora Extra e InterJornadas agrupam pelo período de apuração do ponto, não pelo mês de calendário — ver [[Corte do ponto]]. **Turnover é exceção**: continua em mês de calendário, porque os números são digitados à mão e não têm data de origem para reclassificar.

## Funções — sem diferenciação de nível
No RH da Lube **não existe** MOTORISTA I, II, III ou CARRETEIRO: é tudo **MOTORISTA**. Da mesma forma, AJUDANTE DE MOTORISTA I/II/III é tudo **AJUDANTE**. As planilhas de origem vêm com o nível no nome; o painel normaliza em `normalizeFuncao()` antes de agrupar.

Vale em toda parte que agrupa por função — gráficos, filtros, importações e cadastro. Ao mexer em qualquer agrupamento por função, aplicar `normalizeFuncao()` na chave, senão a função volta a aparecer quebrada por nível.

## Empresa do colaborador (2026-10-01)
Nenhuma planilha de origem traz a empresa de verdade. Em `ocorrencias_absenteismo` a coluna `empresa` tem o mesmo valor padrão em todas as linhas e o "setor" são departamentos (ENTREGA, IMPNOITE, IMPDIA, ADMINISTRAÇÃO). Na hora extra, `departamento` só tem ENTREGA e ADMINISTRATIVO. Na interjornada, `equipe` é LLOG em tudo.

Por isso o painel **resolve a empresa pelo nome** do colaborador (`empresaDoColaborador()`), nesta ordem:
1. atribuição manual na tela (tabela `colaborador_empresa`);
2. cadastro de Empregados;
3. controle de Exames Periódicos.

Quem sobra fica como "NÃO IDENTIFICADA" e aparece no botão âmbar **"N sem empresa"** do Absenteísmo. Ele abre a lista com um seletor das 5 empresas; o que se escolhe vai para o banco e vale nas importações seguintes. Na estreia, 97,8% das ocorrências ganharam empresa e sobraram 7 pessoas.

O filtro **Empresa** existe no Absenteísmo (ao lado do Setor, que continua, decisão do Júlio), na Hora Extra (no lugar de Departamento) e na InterJornadas. Decisão do Claude: trocar só o rótulo "Departamento" por "Empresa" seria mentira; a empresa tinha de ser resolvida de verdade.

## Empregados e HEAD (2026-10-01)
- A importação de Empregados lê a aba "Listagem empregados". O status sai do DEPARTAMENTO: quem está em "AFASTADOS INSS" entra como **AFASTADO INSS**, o resto como **ATIVO**. É upsert pelo nome (único na tabela), então reimportar atualiza em vez de duplicar.
- **Head Atual = contagem de colaboradores ATIVOS por empresa + função.** Afastado INSS e demitido não contam (pedido do Júlio). Antes era um número importado; a troca mudou o total na tela de **196 para 203**, com 6 funções divergindo.
- Head Programado continua vindo da tabela de metas. Quando a mesma empresa + função tem meta em mais de um departamento, as metas **somam**.
- **Demitir** marca o status, não apaga: absenteísmo, hora extra e exames ligam a pessoa pelo nome, e apagar deixaria esses registros órfãos (decisão do Claude; o Júlio ainda não disse se prefere apagar).
- Adicionar, importar e demitir passam pelo mesmo ponto (`recarregarEmpregadosEHead`), para o HEAD nunca ficar defasado.
- Botão **Editar** em cada grupo empresa • departamento do HEAD (2026-08-31): ajusta atual e programado e recalcula Necessidade, Situação, Ação, Vagas e Reduções na hora.

## Pagamento Hora Extra: regras
- A coluna "(Qtde): Hora Extra 50%/100%" da planilha traz o **total em minutos**, não em horas. O painel converte (conferido contra salário-hora × valor pago, 2026-09-09).
- **Dinheiro sempre com centavos** (decisão do Júlio, 2026-09-09: R$ 10,87 é R$ 10,87, não R$ 11).
- Reimportar uma competência **substitui** os lançamentos dela (apaga e grava), sem duplicar.
- Tabela consolidada **uma linha por colaborador**, com "Ver Ficha" mostrando o histórico mês a mês; a ficha ignora os filtros da tela.
- **Seletor de competência da importação:**
  - de 2026-09-09 a 2026-10-04: ano travado no atual e meses do mês corrente até dezembro. Não deixava importar justamente a folha que acabou de fechar;
  - desde 2026-10-05: **só Setembro a Dezembro do ano corrente** (pedido do RH, via Júlio: lista curta evita escolher o mês errado), cada um com o período, ex. "Setembro/2026 (21/08 a 20/09)". O valor da opção é a competência inteira (`2026-09`) e o ano acompanha a escolha;
  - **na virada do ano a faixa precisa ser revista**: em janeiro/2027 ela mostraria Set–Dez/2027, que ainda não fecharam, e Dezembro/2026 sairia da lista.
- A tabela `pagamento_hora_extra` guarda **CPF e salário** e é lida do navegador com a chave pública.

## Faltas injustificadas: um critério só
Desde 2026-08-28 o card conta só `tipo_absenteismo = 'Injustificado'`, o mesmo critério da planilha exportada. Antes somava também motivo "Falta" e "Suspens…" e mostrava 318 contra 312 da planilha. O Júlio decidiu que vale o campo oficial.

**Conferido no código em 2026-10-09:** o gráfico **Top 10 Faltas Injustificadas** e a **ficha do colaborador** ainda somam `motivo = 'Falta'` ao `tipo_absenteismo`, então podem mostrar mais que o card (ver Pendências).

## Turnover
- Fórmula: ((Entradas + Saídas) / 2) ÷ colaboradores do mês anterior. Sem base, mostra "—" em vez do #DIV/0! da planilha original.
- Só 2026. Os dados de 2025 foram apagados em 2026-08-31 (decisão do Júlio): nas abas por empresa da planilha de 2025 os números eram iguais em todas, um modelo copiado que nunca foi preenchido.
- O pico de **450% da LUBE RJ em março está certo**: base de 1 colaborador em fevereiro e 9 entradas em março, ((9 + 0) / 2) / 1. No gráfico, o eixo ignora esse valor fora da curva e o rótulo fica dentro da barra, com ▲.
- Tabela "Movimentações Detalhadas" agrupada por setor, com totais e os meses do mais recente para o mais antigo.
- Continua em mês de calendário (ver Competência).

## Diagnóstico e Assistente de IA (2026-08-31)
- Funções `api/diagnostico.js` e `api/assistente.js` na [[Vercel]], com **Google Gemini** (`gemini-flash-lite-latest`, variável `GEMINI_API_KEY`). Começaram na NVIDIA NIM (DeepSeek e depois kimi-k3) e foram trocadas no mesmo dia, porque levavam de 55 s a mais de 90 s (decisão do Júlio: IA gratuita e estável). O `vercel.json` limita as duas a **30 s** (`maxDuration`); na fase da NVIDIA chegou a 60 s.
- A chave fica só no servidor e a IA recebe **só números agregados, sem nome de colaborador** (decisões do Claude).
- O diagnóstico é gerado uma vez por importação e guardado em `historico_importacoes.diagnostico_ia`. Se a IA falhar, vale o diagnóstico por regras, com o selo "MODO PADRÃO" em vez de "GERADO POR IA". Desde 2026-09-16 considera o panorama inteiro, não só o último lote.
- O **Assistente Virtual do RH** (botão redondo com a mascote da Lube, canto inferior direito) **só explica** as fórmulas e os números da aba aberta; não altera dados (decisão do Júlio). Tenta 2 vezes sozinho antes de mostrar "Tentar novamente".

## Integração com o PontoMais — em andamento
A ideia é puxar faltas, empregados e movimentações direto da API do PontoMais, sem importar planilha. Parada desde 2026-08-31: o token enviado pelo RH foi recusado (HTTP 403). Ver [[2026-08-31 — integração do BI de RH com o PontoMais]].

## Filtros — múltipla escolha (2026-10-16)
Todos os filtros do painel são de **múltipla escolha**, no contrato de [[Como eu gosto dos BIs]]: a partir de "Todas", o clique seleciona **só** aquela opção; depois cada clique soma ou tira; esvaziar volta para "Todas". **Conjunto vazio = tudo**, então nenhum filtro começa escondendo dado.

- Lista acima de 10 opções ganha campo de busca (são 78 colaboradores na InterJornadas).
- Só um painel aberto por vez; clique fora fecha.
- Bolinha ciano no rótulo quando o filtro está ativo. O botão mostra o rótulo quando é uma opção só e "N selecionados" quando é mais de uma.
- `descreverFiltroMulti()` escreve os filtros ativos no **cabeçalho do Excel**, então o relatório diz de onde veio.
- Nas abas que já tinham `<select>`, `ativarMultiNoSelect()` **mantém o select escondido e espelha as opções dele** — o filtro nasce pronto sem mexer no resto da aba. Cuidado aprendido: ativar **depois** de preencher os selects; ativar antes deixa a lista vazia e o filtro passa a aceitar tudo.
- **O Turnover ficou de fora**: lá o ano e o setor não filtram uma lista, eles **montam a série do gráfico** (12 meses do ano escolhido, uma linha por setor). Múltipla escolha ali exige refazer o gráfico — ver Pendências.

## Gráficos
Todos os gráficos têm rótulo de dados (24 em 2026-09-17; 28 depois da aba Exames), no padrão descrito em [[Como eu gosto dos BIs]]. O gráfico de Evolução Temporal mostra o valor dentro de cada segmento da pilha e o total acima da coluna; o badge do card ("Jan/2026 – Ago/2026") é calculado da base, não escrito à mão.

- **Roscas (8 no painel), regra desde 2026-10-01:** o rótulo fica **sempre dentro da fatia**, com `clip: true` — nunca para fora, cortado ou em cima de título (pedido do Júlio; ele aceita rótulo menor para caber). O código mede se o texto cabe na espessura do anel e no comprimento do arco: cabe tudo, valor + % em fonte 10; cabe pouco, só o valor em fonte 9; não cabe, nada. **A legenda mostra número e percentual de todas as fatias** ("Vencido — 26 · 13,1%"), então nenhum valor se perde. O ângulo vem dos dados, não do elemento do gráfico, que fica zerado durante a animação.
  - Até 2026-09-30 a fatia estreita tinha o rótulo **por fora, em balão**. Não funcionou: o balão caía na borda do canvas e era cortado (erro do Claude no commit `88dc90d`).
- **Eixo e rótulo usam o mesmo formato** (`fmtMoedaCurtaBR`, `fmtNumFlexBR`): "R$ 0 · R$ 2 mil · R$ 4 mil", sem casa decimal sobrando.
- O botão sol/lua redesenha os gráficos de todas as abas (desde 2026-09-30; antes só Absenteísmo, Turnover e HEAD).

## Modo claro
O botão sol/lua só trocava o ícone até 2026-09-01: o painel tinha sido feito só com cores escuras. O modo claro é um bloco de CSS em `html:not(.dark)`; o modo escuro não foi tocado.
- **Chip escuro continua chip:** badge de fundo `-950` semitransparente com texto claro ganha fundo sólido e **mantém o texto claro**, em vez de ter o texto escurecido pela regra geral. A regra cobre as opacidades **/60 e /80** — usar sempre uma delas. Os atalhos de Exames usaram /70 e ficaram ilegíveis (contraste 3,09; corrigido para 9,09 em 2026-10-01).
- Botão de fundo sólido (navy, gradiente) mantém texto branco.
- Lição de 2026-09-01: ao acertar um contraste, não estragar o que já estava bom. A primeira correção escureceu o texto de destaque de forma geral e quebrou os badges, e o Júlio reclamou.

## Desempenho
As buscas grandes vêm do banco em páginas de 1.000. Desde 2026-09-30 (`fetchPaginadoDB`) a primeira página traz a contagem total e as outras vêm **em paralelo, em lotes de 12**. O banco fica em us-west-2 e cada ida e volta leva ~0,5 s: a InterJornadas caiu de 11,4 s para 2,7 s. A paginação da Hora Extra ordena por `(ano_mes_sort, funcionario_nome, id)`: sem o `id`, a linha de 50% e a de 100% do mesmo colaborador empatam e podiam sair duplicadas ou puladas.

## Banco
- Tabela principal `ocorrencias_absenteismo`, com trigger `fn_enrich_ocorrencia` que deriva as colunas de calendário a partir de `data_iso` (pelo mês de calendário, enquanto a migração de 2026-09-17 não for aplicada — ver [[Corte do ponto]]). Tem `import_id` ligando cada ocorrência à importação de origem (`historico_importacoes`).
- Views analíticas `vw_kpis_absenteismo`, `vw_evolucao_mensal`, `vw_resumo_*`, `vw_ranking_injustificadas` — **nenhuma é consumida pelo painel hoje**; ele lê a tabela e calcula tudo no navegador.
- `historico_importacoes`: uma linha por importação do Absenteísmo, com `nome_customizado` (renomear na tela) e `diagnostico_ia` + `diagnostico_ia_gerado_em` (cache da IA).
- Outras tabelas: `colaboradores` (cadastro de Empregados, com `status`), `turnover_mensal`, `head_necessidade_funcao` (metas do HEAD), `pagamento_hora_extra`, `interjornada_registros`, `colaborador_empresa` (empresa atribuída à mão). `setores`, `cargos` e `motivos_ausencia` existem desde o schema inicial e estão vazias.
- `exames_periodicos` — **pendente**, migração pronta no repositório.
- **RLS ligado, mas com políticas que liberam `anon`** (é assim que o navegador grava): no levantamento da [[SENTINELA LUBE]] de 2026-10-05, quem tem a chave pública lia e gravava direto, sem passar pelo guarda.
- Sem Edge Functions no projeto (conferido em 2026-10-09); as únicas funções são as duas de IA na [[Vercel]].

### Migrações (conferido no Supabase em 2026-10-09)
O schema inicial (tabelas, views, RLS e Realtime) foi aplicado em 2026-08-24, fora do controle de migrações. A lista começa depois:

| Data | Migração | O que fez |
|---|---|---|
| 2026-08-31 | `add_import_id_and_nome_customizado` | `import_id` nas ocorrências e `nome_customizado` no histórico; as 1.016 ocorrências da época ligadas à importação 1 |
| 2026-08-31 | `add_diagnostico_ia_to_historico_importacoes` | cache do diagnóstico da IA por importação |
| 2026-08-31 | `add_turnover_and_extend_colaboradores` | tabela `turnover_mensal`; `colaboradores` ganha empresa, setor, função, admissão e último exame |
| 2026-08-31 | `add_head_necessidade_funcao` | tabela das metas do HEAD |
| 2026-09-09 | `create_pagamento_hora_extra` | tabela da hora extra |
| 2026-09-14 | `create_interjornada_registros` | tabela do ponto diário, com Realtime |
| 2026-10-01 | `colaborador_empresa` | empresa atribuída à mão (versionada em `migrations/2026-10-01_colaborador_empresa.sql`) |

**Não aparecem na lista:** `migrations/2026-09-17_competencia_mes_de_fechamento.sql` e `migrations/2026-09-30_exames_periodicos.sql`. A da competência pode ter sido colada no SQL Editor, que não registra migração — só uma consulta ao banco confirma.

### Retrato em 2026-10-09 (linhas por tabela)
`ocorrencias_absenteismo` 1.282 (eram 1.189 em 2026-10-01) · `colaboradores` 215 (eram 203) · `historico_importacoes` 4 · `turnover_mensal` 45 (40 depois de apagar 2025) · `head_necessidade_funcao` 63 (69 na carga de 2026-08-31; a diferença não está registrada) · `pagamento_hora_extra` 521 (464 na carga de 2026-09-09) · `interjornada_registros` 17.098 (eram 14.940) · `colaborador_empresa` 7 (vazia em 2026-10-01).

## Pendências
- [x] 2026-10-05 — Nomenclatura dos períodos de junho/julho/agosto: o próprio Júlio pediu "Setembro (21/08 a 20/09)" na importação de Hora Extra, o que é a regra do **mês de fechamento**. Ver [[Corte do ponto]] e [[2026-09-17 — rótulos de dados e competência do ponto no BI de Absenteísmo RH]]
- [ ] Importar o período 21/06 a 20/07 (competência Julho), que nunca entrou — Júlio. Não conferido depois de 2026-09-17
- [ ] Aplicar `migrations/2026-09-17_competencia_mes_de_fechamento.sql` no Supabase, fora do horário de uso — Júlio. Em 2026-10-09 não aparece na lista de migrações
- [ ] Aplicar `migrations/2026-09-30_exames_periodicos.sql` no Supabase — Júlio. Em 2026-10-09 a tabela não existe — ver [[2026-09-30 — nova aba de Exames Periódicos no BI de RH]]
- [ ] Tratar os 26 ASO vencidos e a colaboradora sem exame registrado; programar os picos de vencimento (Setembro/2027 com 31 e Julho/2027 com 24) — RH
- [ ] **Fechar o banco:** o GESTÃO RH aceita leitura e gravação anônimas com a chave pública, e `pagamento_hora_extra` tem CPF e salário. O guarda da Sentinela não resolve isso — conserto à parte (políticas de RLS) — Júlio/Claude. Fechar o site também não esconde a chave: ela ficou escrita no `supabase-client.js` até 2026-08-24 (o commit `45e3dfd` a tirou), e esse histórico esteve num repositório público
- [ ] **URGENTE — tirar os dados pessoais do repositório, que está público desde 2026-10-16:** conferido no mesmo dia, qualquer pessoa baixa sem login. `planilhas referencias/` (14 planilhas — hora extra com CPF e salário, empregados, HEAD, turnover, ponto e faltas — enviadas em 2026-09-15), `exames-periodicos-data.js`, `dashboard_dataset.json` e `powerbi_data.json` (ocorrências de falta por funcionário, desde 2026-08-21) estão versionados; o `data.js` cheio está no histórico. Apagar agora não limpa o histórico do Git — Júlio. Ver [[Como trabalhar comigo]] ("dado de pessoa não vai para o repositório")
- [x] 2026-10-16 — Decidir o repositório: o Júlio **voltou a público** para destravar o deploy. Resolveu o `BLOCKED`, mas reabriu a exposição dos dados de pessoa (item acima, agora urgente)
- [ ] Dizer se quer múltipla escolha no **Turnover**, que pede refazer o gráfico (ano e setor montam a série, não filtram lista) — Júlio
- [ ] Conferir logado a página publicada de 2026-10-16: rodapé deve mostrar `82c3ddc` e os filtros devem abrir com busca — Júlio. Com o guarda da [[SENTINELA LUBE]] ligado, o Claude não consegue abrir a página (308 para o portal, `.js` em 401)
- [ ] Gráfico Top 10 Faltas Injustificadas e ficha do colaborador ainda somam `motivo = 'Falta'` (conferido em 2026-10-09) — alinhar ao critério do card — Claude, quando o Júlio pedir
- [ ] Importação de Hora Extra: rever a faixa Setembro a Dezembro na virada para 2027 — Júlio avisar em janeiro
- [ ] Empregados: rodar a importação da planilha (199 na planilha × 203 no cadastro) — Júlio. Em 2026-10-09 o cadastro tinha 215 linhas, então algo entrou (importação ou cadastro na tela); confirmar
- [ ] Dizer se **Demitir** deve apagar do banco em vez de marcar o status — Júlio
- [ ] Avisar o RH que o Head Atual passou de 196 (importado) para 203 (contado do cadastro) em 2026-10-01 — Júlio
- [x] 2026-10-09 — Atribuir a empresa das 7 pessoas sem empresa: a tabela `colaborador_empresa` tem 7 linhas (estava vazia em 2026-10-01)
- [x] 2026-10-05 — Exportar o "Relatório de Jornada" de 21/08 a 20/09 e importar na InterJornadas: o Júlio resolveu exportando o certo; a tabela foi de 14.940 para 17.098 linhas. Falta conferir a cobertura (~31 datas por colaborador, sem buracos) — Claude, quando o Júlio pedir
- [ ] Confirmar que `GEMINI_API_KEY` está cadastrada na Vercel e que a próxima importação mostra o selo "GERADO POR IA" — Júlio. Não conferido
- [ ] Trocar as chaves da NVIDIA e do Gemini, que foram coladas no chat em 2026-08-31 (a da NVIDIA deixou de ser usada) — Júlio
- [ ] Integração com o PontoMais: conseguir o token público válido — Júlio/RH. Ver [[2026-08-31 — integração do BI de RH com o PontoMais]]
- [x] 2026-10-05 — Liberar meses anteriores na importação de Hora Extra (a folha de setembro não aparecia): resolvido com a lista Setembro a Dezembro
- [x] 2026-08-31 — Explicar o pico de 450% da LUBE RJ: base pequena, não erro (ver Turnover)
- [ ] `Dashboard Absenteísmo.html` (cópia local) está desatualizada em relação ao `index.html` — decidir se atualiza ou arquiva

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-16** — Repositório renomeado para `GESTAO-RH` e de volta a **público**, para destravar o deploy que vinha saindo `BLOCKED` · [[2026-10-16 — filtros de múltipla escolha no BI de RH e repositório de volta a público]]
- **2026-10-16** — Filtros de múltipla escolha em todas as abas menos Turnover, e Excel com os dados filtrados e os filtros no cabeçalho (commits `a0601b6`, `82c3ddc`) · [[2026-10-16 — filtros de múltipla escolha no BI de RH e repositório de volta a público]]
- **2026-10-07** — Guarda da Sentinela 1.1.0, que reconhece robôs e não-navegadores; publicado pela API (commit `d50de78`) · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-06** — Guarda da Sentinela instalado (`middleware.ts` + `sentinela-guarda.ts`, runtime nodejs) e "exige login" ligado: só entra quem tem acesso pelo Painel Lube; `/api/*` e planilhas dão 401 (decisão do Júlio). Repositório já privado, deploy pelo Git `BLOCKED`, publicado pela API (commits `87d9b7e`, `09d00f5`, `9bd4a05`, `a45b0b4`; as prévias rodaram no branch `sentinela`). Incidente: o teste de `/.env` na prévia do RH, feito do escritório, criou o bloqueio #5134 (7 dias) no IP do escritório e barrou o escritório no Financeiro, na Saída e no RH; revogado no mesmo dia · [[2026-10-05 — Sentinela Lube, sistema de segurança]]
- **2026-10-05** — Importação de Hora Extra lista só Setembro a Dezembro, com a competência inteira no valor e o ano acompanhando (commits `e6534c4`, `5222ada`) · [[2026-10-05 — relatório errado do PontoMais e meses da importação de Hora Extra no BI de RH]]
- **2026-10-05** — InterJornadas: aviso de importação diz qual relatório do PontoMais veio e por que não serve; Relatório de Jornada de 21/08 a 20/09 importado pelo Júlio (commit `6781f4a`) · [[2026-10-05 — relatório errado do PontoMais e meses da importação de Hora Extra no BI de RH]]
- **2026-10-01** — Empregados: importação da planilha, status AFASTADO INSS, botão Demitir; Head Atual passa a ser contado do cadastro (196 → 203) (commit `ce37b6e`) · [[2026-10-01 — filtro de Empresa, importação de empregados e HEAD do cadastro no BI de RH]]
- **2026-10-01** — Filtro Empresa na Hora Extra e na InterJornadas; filtro Mês de Vencimento nos Exames, separado em "Já vencidos" e "A vencer" (commits `8081434`, `30028ad`) · [[2026-10-01 — filtro de Empresa, importação de empregados e HEAD do cadastro no BI de RH]]
- **2026-10-01** — Filtro Empresa no Absenteísmo, empresa resolvida pelo nome; tabela `colaborador_empresa` criada no banco e botão "N sem empresa" (commit `3d3f0f5`) · [[2026-10-01 — filtro de Empresa, importação de empregados e HEAD do cadastro no BI de RH]]
- **2026-10-01** — Modo claro: atalhos de Exames legíveis e cores de chip que faltavam (commit `f77c791`) · [[2026-10-01 — filtro de Empresa, importação de empregados e HEAD do cadastro no BI de RH]]
- **2026-10-01** — Roscas medem se o rótulo cabe na fatia; carimbo de versão no rodapé do menu (commit `b4466bd`) · [[2026-09-30 — lentidão entre abas e rótulos das roscas no BI de RH]]
- **2026-09-30** — Roscas com rótulo sempre dentro e valor das pequenas na legenda; badges de Situação dos Exames numa linha; card do Raio-X de Motivos 280 → 340 px (commits `88dc90d`, `2684858`) · [[2026-09-30 — lentidão entre abas e rótulos das roscas no BI de RH]]
- **2026-09-30** — Páginas do Supabase buscadas em paralelo: InterJornadas de 11,4 s para 2,7 s (commit `b526433`) · [[2026-09-30 — lentidão entre abas e rótulos das roscas no BI de RH]]
- **2026-09-30** — Nova aba Exames Periódicos (ASO), com a base em `exames-periodicos-data.js` e migração da tabela criada sem aplicar; o tema passa a redesenhar todos os gráficos (commit `e60b621`) · [[2026-09-30 — nova aba de Exames Periódicos no BI de RH]]
- **2026-09-29** — Eixo de dinheiro no mesmo formato do rótulo, `fmtNumFlexBR` e fonte 10 nos rankings (commit `7f35b6b`) · [[2026-09-29 — consolidação de funções e eixo de dinheiro no BI de Absenteísmo RH]]
- **2026-09-29** — Funções sem nível (MOTORISTA, AJUDANTE) em `normalizeFuncao()`, feito pelo Júlio (commits `1e7afa0`, `959c662`, que também regravaram a cópia `Dashboard Absenteísmo.html`, o `dashboard_dataset.json` e o `powerbi_data.json`) · [[2026-09-29 — consolidação de funções e eixo de dinheiro no BI de Absenteísmo RH]]
- **2026-09-17** — Rótulos de dados nos 24 gráficos; competência pelo mês de fechamento; filtros de mês mostram o período (commit `1e028ad`) · [[2026-09-17 — rótulos de dados e competência do ponto no BI de Absenteísmo RH]]
- **2026-09-17** — Migração da competência no banco criada, **não aplicada** (commit `98d25e7`) · [[2026-09-17 — rótulos de dados e competência do ponto no BI de Absenteísmo RH]]
- **2026-09-16** — Competência pelo mês de abertura (revertida no dia 17); Turnover com o 450% dentro da barra e "Entradas x Saídas" ocupando o card (commit `daa52b4`) · [[2026-09-15 — corte do ponto, importação do PontoMais e gráficos do Turnover no BI de RH]]
- **2026-09-16** — Importação do Absenteísmo passa a ser cumulativa, ignorando ocorrência repetida (commit `77c3227`) · [[2026-09-15 — corte do ponto, importação do PontoMais e gráficos do Turnover no BI de RH]]
- **2026-09-15** — Corte do ponto parametrizável (dia 21) na InterJornadas, na Hora Extra e no Absenteísmo; ficha da InterJornadas respeita o período (commits `729186c`, `cc83f76`, `293804a`, `cac6144`) · [[2026-09-15 — corte do ponto, importação do PontoMais e gráficos do Turnover no BI de RH]]
- **2026-09-15** — Importação do "Relatório de Faltas" do PontoMais, tela de carregamento e fim do "flood" do Realtime (commits `9e268a6`, `cac6144`) · [[2026-09-15 — corte do ponto, importação do PontoMais e gráficos do Turnover no BI de RH]]
- **2026-09-15** — Turnover: rótulos de dados e Evolução Mensal em barras agrupadas, 440 px, com teto no eixo (commits `293804a`, `cac6144`, `c2fed03`) · [[2026-09-15 — corte do ponto, importação do PontoMais e gráficos do Turnover no BI de RH]]
- **2026-09-15** — Menu: cabeçalho "GESTÃO RH" sem subtítulo e item "Empregados" (commit `1b1edd4`) · [[2026-09-15 — corte do ponto, importação do PontoMais e gráficos do Turnover no BI de RH]]
- **2026-09-15** — InterJornadas: nota "inclui N dias de Folga" no descanso (commit `2773f81`) · [[2026-09-14 — aba InterJornadas no BI de RH]]
- **2026-09-14** — Nova aba InterJornadas (descanso de 11h) e tabela `interjornada_registros`; as planilhas de referência com dados pessoais foram para o GitHub junto (commit `e40d65f`, push do Júlio em 2026-09-15) · [[2026-09-14 — aba InterJornadas no BI de RH]]
- **2026-09-09** — Nova aba Pagamento Hora Extra, com 8 meses carregados (464 lançamentos); centavos exatos; tabela por colaborador com ficha; importação travada no ano atual (commits `03baf9a`, `505b292`, `bd95eea`, `ed6f890`) · [[2026-09-09 — Pagamento Hora Extra no BI de RH]]
- **2026-09-01** — Modo claro de verdade, com duas rodadas de contraste; logo só no menu; Markdown nas respostas do assistente; aba do navegador "GESTÃO RH | Lube Distribuidora" (commits `99bb5a1`, `775a096`, `df14be7`, `136fb69`) · [[2026-08-31 — logo, modo claro e título da aba no BI de RH]]
- **2026-08-31** — Painel HEAD com as 69 funções da planilha do RH e edição por empresa • departamento (commits `a4157da`, `731770b`) · [[2026-08-31 — menu lateral, Turnover, Empregados e Painel HEAD no BI de RH]]
- **2026-08-31** — Menu lateral; Turnover (88 registros carregados, depois só os 40 de 2026) e Listagem de Empregados (203 colaboradores) (commits `23218f5`, `4a94f6f`) · [[2026-08-31 — menu lateral, Turnover, Empregados e Painel HEAD no BI de RH]]
- **2026-08-31** — Diagnóstico Executivo e Assistente Virtual com IA, trocados no mesmo dia da NVIDIA para o Gemini; logo e favicons na pasta `imagens/` (commits `d41e850`, `4a94f6f`, `a4157da`, `bcedcb4`) · [[2026-08-31 — histórico de importações e IA no BI de RH]]
- **2026-08-31** — Histórico de importações com renomear; painel passa a mostrar só a última importação (desfeito em 2026-09-16); modais que ficavam invisíveis corrigidos (commit `24d7cfe`) · [[2026-08-31 — histórico de importações e IA no BI de RH]]
- **2026-08-31** — Levantamento da API do PontoMais; token do RH recusado, integração em andamento (sem commit) · [[2026-08-31 — integração do BI de RH com o PontoMais]]
- **2026-08-28** — Subtítulo "KPI's - indicador de perfomace", badge PRO RH numa linha; card de Faltas Injustificadas só pelo `tipo_absenteismo` (312) (commits `eb75dc1`, `48d7f05`; o card foi publicado no `24d7cfe`) · [[2026-08-28 — subtítulo, badge PRO RH e faltas injustificadas no BI de RH]]
- **2026-08-24** — Novo projeto Supabase `jhznrwmwszpfogvbjnjx` com o schema completo (de 2026-08-21 a 2026-08-24 o painel apontava para outro projeto, `issujcvninltzvxdfhqd`; não se sabe se ele ainda existe); URL e chave pública saem do código para variáveis da Vercel no build; favicon (commits `3abcce9`, `45e3dfd`, `5d4baba`; feitos com o Claude, que aparece como coautor, sem sessão registrada)
- **2026-08-21** — Criação do BI pelo Júlio: página única com Supabase e Vercel (`57b13e8`); ícones do Lucide e SDK do Supabase por CDN em versão fixa, acentos (UTF-8) e tela que travava (`9ff2bd8`, `26a61a3`, `8dadf78`); base zerada para a primeira importação oficial (`4eb26e2`); visual escuro e exportação para Excel com a marca da Lube (`f3d1c69`); fontes Plus Jakarta Sans/Inter, gráficos com gradiente e correção de um bug na terça-feira (`b35daf2`)

Veja também [[Corte do ponto]], [[Como eu gosto dos BIs]], [[Supabase]], [[Vercel]], [[SENTINELA LUBE]] e [[PAINEL LUBE DISTRIBUIDORA]].
