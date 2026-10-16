---
tipo: conversa
data: 2026-09-30
projeto: "[[SISTEMA FINANCEIRO]]"
status: resumido
tags: [conversa, financeiro, folha-pagamento, visual]
---
# 2026-09-30 — Ajustes de tela do painel de folha

Continuação de [[2026-09-29 — Importação da folha em PDF]].

## Resumo
Dia de acabamento no painel da Validação de Folha: saiu o parágrafo que explicava a regra, os cards
de indicador e a barra de progresso foram refeitos, e entrou a coluna **Observação** na lista — que
depois passou a somar mais de um motivo, como o Júlio apontou no caso da Keli.

## O que o Júlio pediu
1. **Tirar o explicativo** do topo e deixar os **cards e a barra mais bonitos**.
2. **Coluna Observação** ao lado do Status, "apenas para colocar algo curto, por exemplo ATESTADO".
3. **Centralizar** essa coluna e **não deixar as colunas tão juntas**.
4. No caso da Keli, "foram **férias e benefícios**" — a etiqueta mostrava só um motivo.
5. Os títulos do detalhe (*Cadastro*, *Comparativo completo da folha*) **mais chamativos**, para
   diferenciar as seções.

## Decisões
- 2026-09-30 (Júlio; a dica no seletor foi escolha do Claude): **nada de parágrafo explicando a regra no meio da tela.** A explicação de como a
  comparação anda de mês em mês virou dica no seletor de competência. A tela mostra o dado.
- 2026-09-30 (Claude): **card zerado fica sóbrio**, em cinza. Zero alerta não é para chamar atenção — só
  acende quando existe alguma coisa.
- 2026-09-30 (Claude): **a barra mostra composição, não só progresso.** Um segmento por status, com legenda e
  quantidade: de relance se vê como a folha está.
- 2026-09-30 (Júlio): **a etiqueta da coluna Observação acumula motivos.** Uma pessoa pode ter férias no mês
  anterior e benefício fora da tabela ao mesmo tempo; mostrar só o primeiro esconde metade do
  problema. A anotação de quem conferiu, quando existe, tem prioridade sobre a etiqueta automática.
- 2026-09-30 (Claude, a partir do pedido do Júlio): **a hierarquia dos títulos estava invertida** no detalhe da folha — a faixa de
  "Proventos", dentro da tabela, saltava mais que "Comparativo completo da folha", que é a seção
  inteira. Título de seção ganhou barra azul acesa e mais peso; o subtítulo passou a carregar a cor
  do que agrupa: proventos em verde, descontos em vermelho, totais em azul.
- 2026-09-30 (Claude): **admissão é detectada pela data, não pelo texto da folha.** O PDF não escreve
  "admitido neste mês" em lugar nenhum — quem entrou no meio do mês aparece só com o salário
  proporcional. Sem isso, a etiqueta ficava vazia justamente em quem tinha a maior variação da lista.

## O que foi criado ou mudou
- Painel: indicadores com ícone num quadrado da cor do estado, número maior, brilho no canto e
  hover que levanta; o card do **total da folha** é o único em branco, com a variação num selo; barra de composição com legenda e
  percentual; coluna **Observação** centralizada; espaçamento das colunas dobrado (13 → 26px);
  rótulo "Variação do salário base" encurtado para "Variação". Até 1240 px de largura o espaço cai
  para 22 px e, abaixo disso, a lista esconde primeiro o salário contratual e depois a variação.
- Commits, um por pedido: `8c132b1` (explicativo, cards e barra), `c832117` (coluna Observação),
  `642899d` (centralizar e espaçar), `0df1130` (motivos somados e admissão pela data) e `ddb1eb1`
  (títulos de seção).
- [[Como eu gosto dos BIs]]: três regras novas de estilo — card com ícone e card zerado sóbrio, barra
  por composição, e nada de parágrafo explicativo na tela.
- [[SISTEMA FINANCEIRO]]: descrição da coluna Observação e da detecção de admissão pela data.

## Como ficou a competência de setembro
21 colaboradores: 4 com *Admissão*, 2 com *Atestado*, 1 com *Férias*, 1 com *Férias e Benefício*
(Keli), 1 com *Função e Salário* (Gabryele) e 12 sem nada a observar.

## Pendências
Seguem as mesmas de [[2026-09-29 — Importação da folha em PDF]]: confirmar a Gabryele, conferir a
Keli com o DP, e importar as folhas de Logística e Transporte quando chegarem. Atualização: a da Keli
se resolveu no mesmo dia (alarme falso, ver [[2026-09-30 — Conferência de descontos contra as planilhas das operadoras]])
e a de Logística e Transporte foi superada pelas cinco empresas; a da Gabryele continua aberta.
