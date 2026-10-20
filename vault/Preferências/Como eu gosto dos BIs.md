---
tipo: preferencia
status: ativo
tags: [bi, preferencia]
---
# Como eu gosto dos BIs

Resumo do padrão que já está em produção. O manual completo está na skill [[data-warehouse]] e o exemplo vivo é o [[BI COMPRAS]].

## O caminho é sempre o mesmo
[[WinThor]] ([[Oracle]]) → ETL em Python → [[Supabase]] (projeto DATA WAREHOUSE) → painel na [[Vercel]].
- Nada de planilha no meio.
- O navegador nunca fala direto com o banco.

## Organização
- **Um banco só, um schema por sistema** (`compras`, `financeiro`, `logistica`). Nada no `public`.
- Um sistema **nunca** escreve no schema de outro. Cruzar dados só na leitura (view ou função do painel).
- Dimensões compartilhadas ficam no `core`, com **um dono único** cada. Os outros só leem.
- Toda tabela nasce com RLS ligado e sem políticas.
- Cada sistema tem pasta própria, repositório próprio e `ENV` próprio.

## Qualidade
- **Validar antes de confiar:** rodar o diagnóstico sem gravar, comparar contagens com o BI antigo e investigar toda divergência antes de ajustar.
- **Conferir contra o documento da fonte, não contra uma tabela deduzida.** No [[SISTEMA FINANCEIRO]] o desconto de plano era conferido por uma tabela de valor único montada a partir das próprias folhas — e acusava gente cujo desconto estava certo, porque cada um paga conforme os dependentes. A referência virou a **planilha da operadora, nome por nome**. Regra geral: se existe o documento que manda no número, é contra ele que se confere; tabela deduzida do próprio dado só repete o que o dado já diz.
- **Nome de pessoa em planilha de terceiro vem errado.** Casar por igualdade perde registro. O cruzamento compara pedaços do nome com tolerância a erro de digitação, e quando o valor bate e só a grafia diverge, isso vira **nota**, não erro.
- **Casar nome de gente é para errar para o lado de não casar.** No [[SISTEMA FINANCEIRO]], a regra "primeiro nome parecido + dois pedaços em comum" juntou "Paulo Cesar de Souza" com "Paulo Cesar Barcelos" e "Rosiane" com "Geisiane" — e cada casamento errado vira um alarme falso em duas pessoas. A regra que ficou: primeiro nome com no máximo uma letra de diferença, e **todos** os pedaços do nome mais curto presentes no mais longo. Um nome que não casa vira uma pendência visível; um que casa errado vira um erro escondido.
- **Regra de cálculo se descobre no recibo, não no manual.** O INSS "certo" dava 2 centavos de diferença em 40 recibos até ver que a contabilidade trunca cada faixa; o IR só fechou depois de ler recibo a recibo o que entra em cada base (prêmio entra no IR e não no INSS; ajuda de custo em nenhuma). Antes de acusar a contabilidade, reproduzir a conta dela ao centavo — o que sobrar depois disso é achado de verdade.
- **Quando o recibo não tem informação para conferir, o painel diz isso** — não acusa nem finge que conferiu. Férias pagas em recibo à parte deixam o INSS do mês incalculável só pela folha: a situação é "não conferível pela folha", com a base que explicaria o desconto, e não "erro".
- **Transcrição de papel só vale se o subtotal fechar.** Lista que chega em imagem ou PDF traz subtotal impresso: a digitação só é aceita depois que cada subtotal bate com a soma do que foi digitado. Se não fecha, não carrega.
- **Planilha consolidada à mão é referência, não fonte** (2026-10-06). A de Reposições e Chamados juntava uma rotina de capa com uma de item, e o total do pedido ficou repetido em cada linha: somar a coluna dava 44% a mais. Regra geral: antes de somar qualquer coluna de planilha que cruze capa e item, conferir a soma contra a fonte; e, quando houver planilha, fazer dela a conta de conferência do diagnóstico (pedidos, itens e total), não a origem do painel. Ver [[REPOSIÇÕES E CHAMADOS]].
- **Dinheiro que se reparte tem que fechar ao centavo.** Quando um valor de cabeçalho é distribuído entre linhas (itens, chamados), a repartição é em centavos exatos — método do maior resto — e não em frações arredondadas depois. Sem isso o painel mostrava R$ 221.288,79 e a planilha exportada R$ 221.288,94.
- Erro corrigido do original fica documentado, com as duas colunas lado a lado (`valor` e `valor_original`).
- "A carga entrou?" se responde pelo `controle_carga`, nunca de memória.
- **Número de imposto não tem arredondamento** (Júlio, 2026-09-10, [[PAINEL ICMS]]). Identidade que não fecha ao centavo é achado, não tolerância. A diferença de R$ 7,07 da V1 em julho/2026 ficou para tratar. **Conflito em aberto:** o `AGENTE_ICMS_Lube.md` ainda aceita R$ 0,05 por linha e R$ 1,00 no total; as duas regras não valem juntas e o Júlio precisa decidir.
- **Regra de horário é exata** (Júlio, 2026-09-09, [[GESTÃO DE SAÍDA DE VEÍCULOS]]): "se tem que estar aqui 6:30 é 6:30". Sem tolerância nem arredondamento, comparação ao segundo (saída às 06:30:20 = 20 s de atraso).
- **Importação entrega pronto e soma, nunca substitui nem duplica.** Reimportar a mesma planilha é o fluxo normal (2026-09-10, Saída de Veículos): chave natural contra linha repetida e identificador normalizado na entrada (placa `TOF-8J77` = `TOF8J77`). Importar um período novo só acrescenta o que falta (2026-09-16, [[BI ABSENTEÍSMO RH]]). Uma tela de carregamento cobre o processamento e o resultado chega de uma vez, sem dado pingando um por um.
- **Número só muda depois dos responsáveis da área** (Júlio, 2026-09-28, [[BI COMPRAS]]). Divergência contra o sistema antigo: o texto se corrige na hora; o que mexe em número espera quem é dono do número.
- **Horário de atualização verdadeiro** (2026-10-05, [[BI COMPRAS]]). "Última carga" é a carga OK mais antiga do que está na tela, nunca a hora do acesso, com botão Atualizar e o horário real da próxima carga.

## Painel
- Todo o conteúdo vem de **uma função SQL** (`painel_dados()`) que devolve JSON; a função serverless é só encanamento. Exceção consciente: quando o volume é pequeno (milhares de linhas) e os filtros se cruzam com todos os gráficos, a função devolve **as linhas** e o navegador calcula (feito em [[REPOSIÇÕES E CHAMADOS]]).
- Cache de 10 minutos para não martelar o banco.
- Agendamento 10 minutos antes da hora em que o dado precisa estar pronto, com horários escalonados entre sistemas.
- **Primeiro os KPIs que eu pedi** (Júlio, 2026-10-06, [[REPOSIÇÕES E CHAMADOS]]): "foque nisso primeiro". Entregue o que foi listado, bem feito; KPI a mais vem depois, como sugestão, não no lugar do pedido.

## Segurança
- Senhas só no `ENV` da máquina e nas variáveis da Vercel. Quem cadastra é o Júlio.
- **Todo sistema só abre para quem tem acesso pelo [[PAINEL LUBE DISTRIBUIDORA]]** (Júlio, 2026-10-06), pela porta da [[SENTINELA LUBE]]. Exceção de propósito: o [[SAC]], dos RCAs.
- Repositório: **sem regra única hoje.** No plano Hobby da [[Vercel]], repositório privado deixa o deploy pelo Git `BLOCKED`. São públicos o [[BI COMPRAS]] (Júlio, 2026-10-06), o [[REPOSIÇÕES E CHAMADOS]] (Júlio, 2026-10-06), o [[GESTÃO TI]] (Júlio voltou a público em 2026-09-24; público de novo em 2026-10-08), o [[PAINEL LUBE DISTRIBUIDORA]] e o [[SAC]] (Claude, 2026-10-07). Comercial, Financeiro, RH, Saída de Veículos e ICMS estão privados, com o deploy pelo Git travado: público, plano Pro ou publicar sempre pela API é decisão pendente do Júlio. Público ou não, **senha, IP do Oracle e dado de pessoa nunca entram no repositório**: varrer antes de cada push. _Até 2026-10-09 esta nota dizia só "Repositórios privados"._

## Estilo visual

### Padrão dos sistemas (definido em 2026-09-24)
Todo sistema novo nasce com a **cara do [[GESTÃO TI]]**: fundo azul-marinho escuro da Lube, com o azul e o vermelho da marca como acento. Foi o que o Júlio pediu ao ver a primeira versão do [[SISTEMA FINANCEIRO]] em verde neon: *"puxe a ideia de criação de design da TI"*.

- **Logo da Lube no cabeçalho**, sempre. Como o arquivo tem fundo branco, ela vai numa placa branca arredondada.
- Cores: fundo `#050b1c`, superfícies `#0d1830`/`#132242`, azul da marca `#2a41c8`, vermelho da marca `#e5202c`.
- Cor de estado é separada da cor da marca: verde `#34e89e` para conferido, âmbar `#ffb340` para revisar, vermelho claro `#ff6b74` para alerta, azul `#5fb2ff` para novo/corrigido.
- **Letra e número gordinhos** (pedido de 2026-09-25): **Archivo 700/800** nos títulos, **IBM Plex Sans 500/600/700** no texto (500 é o peso base, não 400) e **JetBrains Mono 600/800** em todo número, valor e código de rubrica — dígito alinhado em coluna, bem mais encorpado que a IBM Plex Mono que usávamos antes.
- **Menu lateral fixo à esquerda**, com os módulos do sistema agrupados. Abaixo de 1080px vira menu que desliza, com botão no canto.
- **O menu mostra só o que existe.** Nada de item "em breve" ocupando lugar — coloquei uma lista de módulos futuros no [[SISTEMA FINANCEIRO]] e o Júlio mandou tirar (2026-09-25). Módulo entra no menu quando estiver pronto.
- **Bloco não pode ficar tudo junto:** informação que serve para conferir contra outra (tipo bases de INSS/FGTS/IRRF contra o que foi descontado) sai da tabela e ganha bloco próprio, com moldura e divisória.
- **Card de indicador tem ícone**, número grande e realce na cor do estado (um brilho suave no canto, não uma tarja). **Card zerado fica sóbrio**, em cinza: zero alerta não é para chamar atenção.
- **Barra de progresso mostra composição, não só o quanto falta.** Um segmento por status, cada um na sua cor, com legenda e quantidade — de relance se vê como a folha está. Padrão implantado no [[SISTEMA FINANCEIRO]] em 2026-09-30.
- **Nada de parágrafo explicando a regra no meio da tela** (pedido de 2026-09-30). Explicação de como o sistema funciona vira dica no próprio controle ou fica na documentação; a tela mostra o dado.
- **Título de seção tem que pesar mais que o subtítulo de dentro dela.** No detalhe da folha estava ao contrário — a faixa de "Proventos" saltava mais que "Comparativo completo da folha" e tudo parecia o mesmo nível. Título de seção: barra vertical azul acesa, texto claro, maior e mais forte.
- **Número errado fica em vermelho, com o valor certo logo abaixo.** Não adianta só marcar a linha: quem confere precisa ver, no mesmo lugar, o que a folha trouxe e o que deveria ser. Linha inteira ganha tarja vermelha, e o que está certo leva uma etiqueta verde curta — implantado no [[SISTEMA FINANCEIRO]] em 2026-09-30.
- **O que a fonte cobra e não aparece no dado não pode sumir da tela.** Se não há linha para marcar, cria-se uma: no comparativo da folha, o desconto cobrado e não feito ganha linha própria em vermelho, e quem é cobrado sem estar na folha ganha bloco próprio com status *Conferir*. Some sozinho quando o dado que falta entrar.
- **Subtítulo carrega a cor do que agrupa:** o que entra em verde, o que sai em vermelho, totais em azul. Diferencia de relance sem precisar ler.
- Interface escura, bonita e chamativa, mas com aspecto profissional — não é protótipo de tela, é sistema.
- **Botão principal chama atenção:** vermelho Lube, nunca preto ("preto ficava estranho", Júlio, 2026-09-14, [[PAINEL LUBE DISTRIBUIDORA]]).
- **Nada que lembre o Power BI** na tela, nem coluna de comparação com o valor antigo: o painel é da Lube (Júlio, 2026-09-22 no [[BI COMPRAS]] e 2026-09-28 no [[BI COMERCIAL]]). A história da migração vai para o README e a documentação técnica.
- **Painel vivo** (2026-09-10 no [[GESTÃO DE SAÍDA DE VEÍCULOS]], 2026-09-22 no [[BI COMPRAS]]): número conta até o valor novo quando o filtro muda, barra muda de tamanho com transição suave, cartão reage ao rolar e ao passar o mouse. Tudo desligado com `prefers-reduced-motion`, e animação **finita**: fundo animado sem parar trava máquina modesta (visto no [[BI COMERCIAL]]).
- **Nada de gráfico com degradê brilhante ("vidro")**: cor sólida, no máximo um brilho sutil (Júlio, 2026-09-10).
- **Notificação é um toast** que entra deslizando e some sozinho em ~4 s, bonito e chamativo (Júlio, 2026-09-10).
- **Cor bem visível nos dois temas, claro e escuro** (Júlio, 2026-09-01 no RH). Tema escuro sem letra preta: a cor do texto vem de variável CSS por tema, nunca fixa no JS — no Saída de Veículos a cor fixa deixou os números ilegíveis (2026-09-10).
- **Elemento flutuante não pode tampar nenhuma funcionalidade.** A bolinha do assistente do [[PAINEL ICMS]] cobria a barra do rodapé e subiu (2026-09-08).
- **Busca fácil por código ou nome**, com o trecho achado destacado (Júlio, 2026-09-22, [[BI COMPRAS]]).

### Painel de luxo (pedido do Júlio no [[BI COMERCIAL]], 2026-09-28 e 2026-09-29)
A base continua a cara do GESTÃO TI. Quando o painel precisa de impacto, como o COMERCIAL, o Júlio pediu "luxo", chamativo e intuitivo — e **não tudo azul**:
- **Ouro como acento** (`#e9c877`) no número-herói, no menu ativo e nos selos; um número-herói por página. A paleta de dados foi validada contra o fundo (escolha do Claude): azul `#5f7ef5`, ouro `#b8892a`, violeta `#8a6ce8`, verde `#1a9468`; verde, âmbar e vermelho só para estado.
- **Tabela grande navegável:** duas primeiras colunas fixas, cabeçalho fixo, botão "Colunas essenciais / Todas", #1 a #3 em destaque, barra proporcional atrás da coluna principal, paginação de 25/50/100/tudo.
- **Totais numa faixa centralizada acima da tabela**, com o número principal maior — não no rodapé.
- **Cartões de KPI alinhados:** grade de três faixas (rótulo, número, legenda) e um tamanho de número só para dinheiro e percentual.
- **Gráfico grande e nunca com dois eixos:** dinheiro e percentual em dois desenhos empilhados. Linha de referência tracejada e chamativa, com o rótulo numa plaqueta que não cobre ponto.
- **Filtro de chips:** a partir de "Todas", o clique seleciona só aquela opção; depois cada clique soma ou tira; esvaziar volta para "Todas". **Vale para todo filtro de todo painel** — o Júlio cobrou isso no [[BI ABSENTEÍSMO RH]] em 2026-10-16: "os filtros precisam seguir a ideia de navegação dos outros BI que fizemos", podendo marcar quantos meses e quantas pessoas quiser. Na implementação, **conjunto vazio = tudo**, para nenhum filtro começar escondendo dado; acima de ~10 opções, campo de busca; e o Excel sai com **as linhas filtradas**, não com a base inteira.

### Assistente virtual
- **Responde rápido e sempre.** No [[PAINEL ICMS]] o Opus 5 levava ~15 s e estourava os 60 s da Vercel; ficou o Sonnet 5 em esforço baixo, ~7 a 10 s (Claude, 2026-09-08). No RH o Júlio pediu uma IA estável, "que sempre responda", e gratuita quando der (2026-08-31). No assistente do site do ICMS ele escolheu só a API do Claude (2026-09-08).
- **Texto com tipografia profissional**, sem símbolo solto de markdown na tela (Júlio, 2026-09-01, [[BI ABSENTEÍSMO RH]]).
- **Bonito, responde tudo e gera relatório em Excel** no padrão da Lube (Júlio, 2026-10-01, [[BI COMPRAS]]). Desenho do Claude: o modelo recebe ferramentas, não os dados; quem calcula é o navegador, sobre a base que o painel já carregou.

### Ainda a completar
- _Tipo de gráfico preferido e o que não pode faltar num painel._

## Gráficos e números (2026-09-17)
Vale para todo painel, não só os do WinThor. Padrão implantado no [[BI ABSENTEÍSMO RH]].

- **Todo gráfico tem rótulo de dados.** Não quero passar o mouse para saber quanto é.
- **Número tem que sair certinho e apresentável**, sempre em padrão brasileiro: `1.234`, `12,5%`, `12,5h`, `R$ 14,4 mil`, `R$ 1,25 mi`. Valor cheio com centavos fica no tooltip — dentro da barra não cabe.
- **Rótulo que não cabe não aparece.** Melhor o dado só no tooltip do que uma sopa de dígitos sobrepostos:
  - barra empilhada: valor dentro de cada segmento + **total acima da coluna**; segmento baixo demais fica de fora;
  - rosca: rótulo **sempre dentro da fatia**, nunca por fora, cortado ou em cima de título (pedido do Júlio, 2026-10-01; ele aceita rótulo menor para caber). O código mede se o texto cabe na espessura do anel e no comprimento do arco: cabe tudo, valor + % em fonte 10; cabe pouco, só o valor em fonte 9; não cabe, nada. **A legenda mostra número e percentual de todas as fatias**, então nenhum valor se perde. _(Até 2026-09-30 a fatia estreita levava o rótulo por fora, em balão: caía na borda do canvas e era cortado — ver [[BI ABSENTEÍSMO RH]].)_
  - zero não vira rótulo (enchia o gráfico de `0,0%`);
  - gráfico diário com dezenas de barras desliga os rótulos.
- **Barra precisa de folga para o rótulo:** `layout.padding` no topo e `grace` no eixo, senão o número encosta na borda ou é cortado.
- **Rótulo não encosta em rótulo nem cobre legenda** (Júlio, 2026-09-16 no RH e 2026-10-01 no [[BI COMPRAS]]): a largura da coluna sai do maior rótulo, e o gráfico rola na horizontal se não couber. Pode aumentar o gráfico para ficar apresentável, mas sem vão branco entre cards lado a lado.
- **Eixo e rótulo falam a mesma língua** (2026-09-29, [[BI ABSENTEÍSMO RH]]): se a barra diz `R$ 4,6 mil`, o eixo diz `R$ 4 mil`, não `R$ 4.000`, e sem casa decimal sobrando (`12`, não `12,0`).
- **O painel mostra a versão que está no ar** (Claude, 2026-10-01, [[BI ABSENTEÍSMO RH]]): rodapé do menu com `versão AAAA-MM-DD (commit)`, gravado no build a partir do commit que a Vercel publicou. Em vez de pedir Ctrl+F5, confere-se o carimbo: print de versão em cache já custou depuração de bug que não existia mais.
- **Todo número clicável leva ao dado por trás dele** (pedido do Júlio em 2026-10-07, no [[REPOSIÇÕES E CHAMADOS]]): cartão, barra, ponto, ranking e linha de tabela abrem o detalhe **já filtrado** — clicar em "Falta de mercadoria" mostra só as reposições dessa falta —, com um **Voltar** que devolve a tela anterior e os filtros dela. O clique troca só a dimensão clicada e mantém o resto.
- **Cartão de valor compara com o período de antes, não só com o ano anterior** (pedido do Júlio em 2026-10-09, no [[REPOSIÇÕES E CHAMADOS]]: "filtrei jan/26, ele precisa apontar a comparação com dez"). Mês fechado compara com o mês anterior (não dia contra dia), "até hoje" compara até o mesmo dia do mês, datas livres com os mesmos N dias antes; sempre com os mesmos filtros e com o ano anterior ao lado. Cada comparação mostra o valor comparado e abre o período comparado ao clicar.
- **Todo BI com carga agendada tem um "atualizar agora"** (Claude, 2026-10-09): um `.bat` de duplo clique que copia o ETL, roda uma carga e mostra o resultado, sem mexer no agendamento. A carga manual convive com a agendada pela tranca do banco.
- **Tooltip é um cartão, não o texto nativo do navegador:** título do período, uma linha colorida por série, o total, o contexto (quantas reposições, quantos por cento) e a dica do clique.
- **Nome de coluna tem que dizer o que o número conta.** "Itens" contava linhas de pedido; ao virar "SKU" o número passou a ser de produtos distintos (1.201 → 761). Renomear coluna é motivo para conferir a conta dela.
- **O painel não pode esperar o banco para abrir** (pedido do Júlio em 2026-10-07: a espera na tela "lendo o banco" gera frustração, "principalmente na frente da empresa que estou mostrando"). Padrão: resposta pronta guardada pela carga, CDN com `stale-while-revalidate`, aquecedor agendado e cópia no navegador — quem abre nunca paga a conexão com o banco, que em crise leva de 13 s a 60 s. Tela de espera nunca fica muda: relógio e motivo. Tese da casa: **o que se mostra aos outros tem que abrir na hora; o que é lento precisa ser lento no robô, não na pessoa.**
- **Nada de texto fixo no cabeçalho do card.** Badge de período se calcula a partir da base — um "Dez/2025 – Jun/2026" escrito à mão vira mentira na semana seguinte. Vale para todo número da tela: o "03" de sistemas ativos fixo no HTML do [[PAINEL LUBE DISTRIBUIDORA]] virou cálculo em 2026-09-30 (Júlio: número na tela se atualiza sozinho).

## Acrescentado em 2026-10-14 ([[GESTÃO COMERCIAL TRADE]])
Pedido do Júlio: o sistema vai ser **apresentado ao gestor comercial** — "precisa ficar um luxo, do design à mecânica de dados".
- **Todo clique abre um relatório personalizado** (extensão do padrão de 2026-10-07): barra, ponto, fatia, cartão, linha de tabela
  e resultado da busca abrem o relatório daquele recorte — KPIs com comparativo, evolução, quebras, abas *Detalhar* (a tabela que
  o usuário monta, com colunas à escolha e Excel), *Estoque* e *Verba* —, e dentro dele o clique abre o relatório do item, com
  *Voltar*. Ctrl+clique aplica como filtro. Tem *Imprimir / PDF* e link.
- **Comparação com o mesmo número de dias.** Mês em andamento não se compara com mês cheio: cada linha guarda também a venda "até
  o dia de corte" e a comparação usa o mesmo trecho do mês anterior (outubro parcial parecia −41% contra o ano passado). Os dados
  vão só até **ontem**, e o painel diz "dados até dd/mm". Cada comparação mostra o período comparado e abre esse período ao clicar.
- **Rótulo medido, não adivinhado.** Rótulo horizontal se cabe e girado se não; dentro da fatia só se cabe; linha com várias séries
  rotula só a série em destaque (botão para todas); a venda parcial do mês corrente vai tracejada, com ponto vazado e `*`. O número
  do centro da rosca cabe dentro do furo.
- **Produto aparece com a foto, não só com o nome** (pedido do Júlio em 2026-10-15: "coloque as fotos nos produtos no painel"): miniatura antes do nome em toda lista de produto, foto maior ao passar o mouse, quadradinho cinza quando não há foto (a linha não desalinha). A foto vem do banco, nunca de uma pasta de rede ([[Pasta de fotos FOTOS_ION]]).
- **Tela de espera tem a cara da Lube** (pedido do Júlio em 2026-10-15, "um caminhão catando painel de maneira animada, usando o mesmo design do painel da Lube"): o caminhão do [[PAINEL LUBE DISTRIBUIDORA]] animado, com painéis caindo no baú, em vez do relógio puro; o relógio e o motivo continuam embaixo.
- **Dado classificado à mão que falta não vira "sem classificação" no topo do ranking.** Produto novo herda o departamento da
  maioria dos produtos já classificados da mesma seção do WinThor, fica marcado, aparece num aviso e se filtra.
- **Quando o BI antigo tem planilha, ela é o espelho da regra** (conferir um mês, dia a dia, por equipe). Foi assim que se achou
  `QT × (PUNIT + VLOUTROS)` para a venda; as fórmulas do documento davam −0,2% a −2%. Conferência fica em script que não grava
  (`conferir_power_bi.py`), com os números de referência no cabeçalho.
- **Dado nominal em máquina de apresentação:** o servidor local escuta só a própria máquina; abrir para a rede é um arquivo à parte
  que avisa que não há login.
- **Filtros de período rápidos** (mês atual, 3 meses, ano atual, 12 meses, ano anterior, tudo) ao lado dos filtros normais, e
  estoque valorizado por botão (custo real ou "preço ÷ 1,35" do original) em vez de trocar o número em silêncio.
- **Foto de produto vem direto da pasta que o ERP usa** (pedido do Júlio em 2026-10-14: "pegue diretamente dessa pasta, FOTOS_ION"),
  não de uma cópia mantida à parte: [[Pasta de fotos FOTOS_ION]]. Foto grande não vai crua para a tela (miniatura gerada e guardada).
- **Todo BI novo nasce com o banco e a pasta de integração**, "assim como os outros sistemas": schema no DATA WAREHOUSE, carga em
  `P:\INTEGRAÇÃO BI\<SISTEMA>` com instalador e `ATUALIZAR AGORA.bat`, e prova da carga em `<schema>.controle_carga`. Rodar só em
  arquivo local serve para mostrar rápido, não para ficar.
- **A carga confere antes de publicar e, se uma fonte secundária sair do ar, avisa e segue** com a cópia do banco (AVISO), em vez de
  parar ou de apagar o painel.

## Acrescentado em 2026-10-19 ([[MOVIMENTAÇÃO DE INVENTÁRIO]])
Pedido do Júlio: "alta profundidade de personalização de dados dentro do navegador", nas mesmas formas dos últimos BIs. O que
ficou de padrão (escolhas do Claude, a confirmar com o uso):
- **Análise livre:** uma tela onde a pessoa monta a própria tabela — base × linhas × colunas × medida —, com cor de calor (escala
  em raiz, para um valor gigante não apagar o resto), totais, Excel e clique em qualquer célula abrindo o relatório.
- **Livro do WinThor se lê programa a programa.** Quando vários programas gravam na mesma tabela de log, cada um preenche os campos
  de um jeito (na 266, o mesmo campo é "quanto bloqueou" num e "saldo depois" no outro). Antes de somar, conferir cada leitura
  contra o saldo do PCEST; a leitura fica numa view, e programa desconhecido vira "Outro" com aviso no diagnóstico.
- **O que o livro não registra não vira KPI de saldo.** O recebimento entra bloqueado sem registro; somar "entrou − saiu" mentiria.
  No lugar, a foto de hoje (PCEST).
- **Quando o log não registra um movimento, procure quem registra e prove contra a foto do saldo** (2026-10-20, Claude). O
  recebimento não estava no livro da 266, mas estava na linha da nota (`PCMOV.QTBLOQUEADA`); a ligação pela liberação do WMS
  enganava (o WMS cita a transação de outra nota da mesma carga). A prova foi a **foto diária do estoque** (`PCHISTEST`): a variação
  do saldo de cada produto tem que ser o que se soma. Fica num script que não grava, com os números de referência no cabeçalho
  (`conferir_recebimento.py`). Ver [[2026-10-20 — Recebimento de compra no Movimentação de Inventário]].
- **Lançamento impossível fica fora da soma, com aviso e botão "incluir"** (ex.: 17 milhões de paletes num registro só). Nada some
  em silêncio, e um erro de digitação não decide o número da tela.
- **Valor vai cheio no pacote; arredondar só na tela.** Arredondar linha a linha tirou centavos da soma do inventário.
- **Base de percentual é o todo, não o recorte do numerador** (o "% do estoque bloqueado" saiu com 27% em vez de 14% até a base
  passar a ser o estoque inteiro). Erro do Claude, achado na conferência da tela contra o banco — que fica sendo passo obrigatório.

## Exportação (2026-09-29)
**Planilha que sai do painel é `.xlsx` formatado, não CSV.** O CSV chega do outro lado como texto:
número em coluna de texto, sem filtro, sem identidade, e quem recebe refaz o trabalho. O padrão,
implantado no [[BI COMERCIAL]]:

- faixa de identidade da Lube no topo, em azul-marinho e dourado;
- **os filtros aplicados escritos por extenso** logo abaixo — sem isso, quem recebe lê um recorte
  achando que é a lista inteira;
- cabeçalho congelado e **filtro automático** em todas as colunas;
- moeda, percentual, inteiro e data com formato **nativo** do Excel — número é número, então dá
  para somar, ordenar e filtrar do outro lado;
- linhas alternadas, negativo em vermelho e linha de total, somando só o que faz sentido somar
  (percentual fica vazio: média de percentual sem peso mente).

O arquivo é montado sem biblioteca externa (`web/planilha.js`): um `.xlsx` é um ZIP com alguns XML
dentro, e escrevê-lo à mão custa menos código do que o peso do download de uma biblioteca de CDN —
que ainda quebraria se a rede da empresa bloqueasse o domínio.

O primeiro a fazer assim foi o [[GESTÃO DE SAÍDA DE VEÍCULOS]] (2026-09-10, `escritor-planilha.js`, relatório
de 5 abas): o `.xls` XML anterior fazia o Excel avisar que o formato não batia com a extensão, e o Júlio
não quer aviso estranho ao abrir o arquivo.

## Filtros de período
- **Filtro de mês mostra o período que representa:** `Janeiro/2026 (21/12 a 20/01)`. Ver [[Corte do ponto]].
- **No eixo do gráfico fica só o nome do mês.** A parametrização é interna — tooltip e badge dão o detalhe.
