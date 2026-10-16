---
tipo: conversa
data: 2026-09-15
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, competencia, ponto, turnover, importacao]
registrado_em: 2026-10-09
---
# 2026-09-15 — corte do ponto, importação do PontoMais e gráficos do Turnover no BI de RH

## Resumo
Dois dias de ajustes no [[BI ABSENTEÍSMO RH]] (15 e 16/09):
- o **corte do ponto** (dia 21 a dia 20) virou parâmetro e passou a valer na InterJornadas, na Hora Extra e no Absenteísmo;
- a importação do **"Relatório de Faltas" do PontoMais** passou a funcionar, sem a tela "carregando um por um", e virou **cumulativa**;
- os gráficos do **Turnover** ganharam rótulos e viraram barras;
- o menu passou a se chamar **GESTÃO RH**.

## Decisões
- 2026-09-15 (Júlio): o ponto fecha do dia 21 ao dia 20, e isso precisa ser parametrizável — o mês de calendário quebra a análise do período real da folha.
- 2026-09-15 (Claude): um único dia de corte, guardado no navegador, compartilhado pelas três abas — mudar em uma recalcula as outras.
- 2026-09-15 (Júlio): na Hora Extra o corte vale **só no rótulo**; a importação continua por mês/ano.
- 2026-09-16 (Júlio): 21/07 a 20/08 é Julho (mês de abertura). **Revertido no dia seguinte** para o mês de fechamento — ver [[Corte do ponto]].
- 2026-09-15 (Júlio): a importação processa tudo por trás e entrega os dados prontos de uma vez.
- 2026-09-16 (Júlio): importar um período novo **nunca tira** os meses que já estavam, só acrescenta o que falta.
- 2026-09-16 (Claude): ocorrência repetida = mesmo colaborador + mesma data + mesmo motivo, ignorada na reimportação.
- 2026-09-15 (Júlio): Evolução Mensal do Turnover no formato do gráfico do Absenteísmo (barras), com os números visíveis em cada barra; pode aumentar o gráfico.
- 2026-09-15 (Claude): rótulos de dados só no Turnover nessa etapa, para não mexer nos outros painéis (em 2026-09-17 foram para todos).
- 2026-09-15 (Claude): um valor fora da curva não define a escala do eixo; a barra estoura o topo e mostra o número real.
- 2026-09-15 (Júlio): o sistema se chama **GESTÃO RH** no cabeçalho, sem subtítulo, como os outros sistemas; itens do menu numa linha só.

## O que foi criado ou mudou
**Menu** (commit `1b1edd4`)
- Cabeçalho do menu "LUBE BI RH" virou "GESTÃO RH", sem o subtítulo ciano "Suíte de Gestão de Pessoas". O item "Listagem de Empregados" virou "Empregados"; o título da seção manteve o nome completo.

**Corte do ponto**
- Commit `729186c` — InterJornadas: campo "Corte do Ponto — Dia [21]", guardado no navegador; funções de competência; filtro "Período (Ponto)" no lugar de "Mês/Ano"; novo gráfico de evolução mensal (violações × horas extras por período).
- Commit `cc83f76` — Hora Extra: meses rotulados com o período, ex. "Ago/2026 (21/07 a 20/08)", no filtro, no gráfico, no seletor de importação, na ficha, no aviso e no Excel.
- Commit `293804a` — a ficha da InterJornadas mostra só os dias do período filtrado.
- Commit `cac6144` — Absenteísmo: a competência é recalculada a partir da data real em todos os pontos de carga (carga inicial, sincronização, Realtime, histórico, registro manual, importação e restauração). Mudar o dia de corte atualiza as três abas ao vivo.
- Commit `daa52b4` (16/09) — competência pelo mês de **abertura**; validado com a planilha de faltas (173 faltas, todas em Julho). Revertido pelo `1e028ad` em 2026-09-17 — ver [[2026-09-17 — rótulos de dados e competência do ponto no BI de Absenteísmo RH]].

**Importação do Absenteísmo**
- Commit `9e268a6` — o "Relatório de Faltas" vem em blocos por colaborador (Colaborador / Nome, Data, Motivo / Resumo, Totais / Total), sem cabeçalho no topo. O painel reconhece pelo título e converte em linhas antes da classificação. Validado com 173 faltas ("FOLGA L-LOG BH" vira Folga/Banco de Horas, "Atestado" vira Justificado). A planilha de faltas de 21/07 a 20/08 foi junto para o repositório.
- Commit `cac6144` — tela de carregamento durante a importação; os ecos do Realtime da própria importação são ignorados, o que acabou com o efeito de "carregar um por um".
- Commit `77c3227` (16/09) — **carga cumulativa**: o painel busca todas as ocorrências, e não só a última importação; o lote novo soma ao que já está carregado, ignora repetidos e grava no banco só o que é novo (até sincronizar, as linhas novas usam id provisório negativo); o Realtime deixa de filtrar pelo último `import_id`; o diagnóstico de IA olha o panorama inteiro; o aviso diz quantas ocorrências eram novas. O histórico continua registrando cada lote.

**Turnover**
- Commit `293804a` — plugin `chartjs-plugin-datalabels` por CDN, registrado mas desligado por padrão; ligado nos 4 gráficos do Turnover.
- Commit `cac6144` — Evolução Mensal de linha (5 séries ilegíveis) para **barras agrupadas por setor**, com o valor em cima.
- Commit `c2fed03` — gráfico de 320 para 440 px, mais espaço entre grupos, teto do eixo calculado pelos valores normais (até 100%) e rótulos alternando altura para não se cobrirem.
- Commit `daa52b4` (16/09) — o rótulo do valor que estoura o teto (450%) fica dentro da barra, com ▲; "Entradas x Saídas" preenche a altura do card, sem vão branco.

## Erros e incidentes
- A importação do Relatório de Faltas falhava com "Nenhum registro válido encontrado" por causa do formato em blocos.
- "Flood" do Realtime: cada linha inserida voltava como evento, recalculava o painel e disparava um aviso.
- Os meses antigos "sumiam" ao importar 21/07 a 20/08: cada importação virava a "mais recente" e o painel mostrava só ela. Os dados continuavam no banco, visíveis só pelo Histórico.
- A primeira versão do corte nomeava pelo mês de fechamento; o Júlio reclamou que aparecia agosto em vez de julho e a regra foi invertida no dia 16. A contradição com o que ele disse no dia 17 ficou registrada em [[Corte do ponto]].
- Em 15/09 às 18:09 o Júlio recusou a pergunta sobre a carga cumulativa e reexplicou o pedido na manhã seguinte.
- Mais uma planilha com dados pessoais (faltas) foi para o GitHub.
- O rótulo de 450% invadia a legenda e o "Entradas x Saídas" ficava com vão branco; corrigidos no dia 16.

## Pendências
- [x] 2026-10-05 — Liberar meses anteriores na importação de Hora Extra (só aparecia do mês atual até dezembro, e a folha de Julho não entrava): resolvido com a lista Setembro a Dezembro
- [ ] Tirar do repositório a planilha de faltas com dados pessoais — Júlio. Continua aberto em [[BI ABSENTEÍSMO RH]]
- [x] 2026-08-31 — Investigar o 450% da LUBE RJ: já tinha sido explicado (base de 1 colaborador em fevereiro, 9 entradas em março). A conta está certa; se esse 1 colaborador de fevereiro é o dado real não foi conferido com o RH (o Claude ofereceu duas vezes, sem resposta)

Veja também [[BI ABSENTEÍSMO RH]], [[Corte do ponto]] e [[Como eu gosto dos BIs]].
