---
tipo: projeto
departamento: TI
status: ativo
inicio: 2026-10-16
tags: [projeto, proposta, ecommerce, b2b, vtex, winthor, kaizen, impressao]
---
# PROPOSTA E-COMMERCE B2B

A proposta "Plataforma de E-commerce B2B integrada ao WinThor e Kaizen" (Lube Distribuidora, TI, 2026-10-16),
refeita com a [[Identidade visual da Lube]] em **A4 para imprimir e apresentar**. Feita com o [[Claude]] em
2026-10-16 ([[2026-10-16 — Proposta de e-commerce B2B com a identidade da Lube]]). Parente do
[[VÍDEO LUBE ONLINE]] (a proposta de e-commerce do Marketing); esta é a da TI, sobre **qual plataforma** e **como
integrar**.

## O que a proposta diz
- **Recomendação:** VTEX B2B, ligada ao WinThor e ao Kaizen por uma camada de integração própria (API + o
  [[Supabase]] que a Lube já usa), que envia e recebe nos dois sentidos. Alternativa: Shopify Plus com a mesma
  camada (parte das regras B2B teria de ser desenvolvida).
- **10 fluxos:** 6 em que a loja recebe (produtos, preços, clientes e crédito, estoque, NF, rastreio) e 4 em que
  envia (pedido, reserva de estoque, novo cliente, cancelamento). O WinThor aceita gravar o pedido pela rotina
  integradora; **o Kaizen aceitar a reserva por API ou banco ainda precisa ser confirmado**.
- **Plataformas:** VTEX B2B, Shopify Plus, Adobe Commerce (Magento), Medusa.js. No PDF original os preços eram
  **estimativas** (VTEX R$ 120 mil a R$ 480 mil por ano + 1% a 3% do faturamento; dólar sem conversão). Desde
  2026-10-16 a página de valores traz **todos os planos**, ver [[#Preços de todos os planos (2026-10-16)]].

## Preços de todos os planos (2026-10-16)
Pedido do Júlio: "coloque os valores de todos os planos, porque vamos apenas começar e precisa de investimento baixo".
Consultado em 2026-10-16; dólar a R$ 5,08 (PTAX do dia, R$ 5,0826). Sem implantação, IOF, impostos e taxa do meio de
pagamento.

| Plataforma | Planos (mensalidade) | Sobre as vendas | Menor custo para começar |
|---|---|---|---|
| VTEX B2B (loja de assinaturas `assine.vtex.com`, em reais) | On Demand R$ 1.500 · Business R$ 1.500 · Corporate R$ 4.500 · Enterprise R$ 11.000 (fixo) | Business 2,5% · Corporate 2,0% · Enterprise 1,5% dos pedidos aprovados; On Demand não publicada | R$ 1.500/mês + 2,5% |
| Shopify (página do Brasil, em dólar; mensal / anual) | Basic US$ 19/14 · Grow US$ 52/39 · Advanced US$ 399/299 · Plus a partir de US$ 2.300 | taxa por venda com gateway de terceiros, varia por plano (sem Shopify Payments no Brasil; confirmar) | Basic anual, R$ 71/mês |
| Adobe Commerce (não publica preço; estimativa para vendas até US$ 1 milhão/ano) | Open Source R$ 0 · Commerce ~US$ 22 mil/ano · Cloud ~US$ 40 mil/ano | sobe com o faturamento | Open Source, sem B2B |
| Medusa.js (MIT ou Medusa Cloud) | Open source R$ 0 · Develop US$ 29 · Launch US$ 99 · Scale US$ 299 · Enterprise sob consulta | não cobra | Launch, R$ 503/mês |
| Camada (Supabase) | Free US$ 0 · Pro US$ 25 · Team US$ 599 · Enterprise sob consulta | não cobra | projeto novo no Pro da Lube, US$ 10 (R$ 51)/mês |

- **Shopify B2B em todos os planos desde 2026-04-02** (anúncio da Shopify "B2B for all"): perfis de empresa, até 3
  catálogos (tabelas de preço), descontos por volume, prazo de pagamento. Só no Plus: catálogos sem limite e
  atribuídos direto a cada cliente, depósitos e pagamento parcial. A Lube tem preço **por cliente e região**: se
  precisar de mais de 3 tabelas, o Shopify só resolve no Plus.
- **VTEX:** os produtos da loja de assinaturas aparecem "esgotados" (contratação pelo comercial). Planos anuais pagos à
  vista (Business R$ 60 mil, Corporate R$ 127,5 mil e R$ 345 mil, Enterprise R$ 995 mil) são opcionais e baixam a taxa.
  **Confirmar em qual plano entra o B2B.**
- **Medusa Cloud Develop** não tem domínio próprio nem backup: só para desenvolver. O menor para ir ao ar é o Launch.
- **Supabase Free** pausa o projeto após 1 semana sem uso: não serve para a loja.
- **Próximos passos:** confirmar o Kaizen com o fornecedor, a versão do WinThor e a rotina integradora com a TI,
  cotação formal VTEX e Shopify Plus (com o GMV de 12 meses), demonstração da VTEX, regra de estoque vendável.

## O documento
- 8 páginas A4: capa, resumo, fluxos, plataformas, preços, arquitetura, recomendação, próximos passos.
- Os próximos passos têm **campos de responsável, prazo e caixa de marcar**, para preencher na reunião.
- O diagrama da arquitetura foi redesenhado na vertical (loja no alto, camada da Lube no meio, Kaizen, RPAs e WinThor
  embaixo), com **o que passa em cada seta**, tirado da tabela dos 10 fluxos: azul = dado que chega à loja,
  vermelho = dado que a loja devolve.
- Conferido: os 25 valores do PDF original estão no novo; nenhuma página estoura.

## Onde estão as coisas
- PDF: `Downloads\Proposta E-commerce B2B - Lube (impressão).pdf` (8 páginas, ~1,7 MB). O original continua em
  `Downloads\Proposta_Ecommerce_B2B_Lube.pdf`.
- Só a página de valores: `Downloads\Proposta E-commerce B2B - Lube - valores (impressão).pdf` (1 página, desde
  2026-10-16); refaz com **`GERAR SO VALORES.bat`** (`gerar_pdf.ps1 -Pagina 5`; o HTML aceita `?pagina=N`).
- Projeto: `Desktop\BI\15. PROPOSTA ECOMMERCE B2B\` (ler o `LEIA-ME.md`). Dois cliques em **`GERAR PDF.bat`** refazem
  o PDF a partir do `proposta.html` (Chrome sem janela) e avisam se alguma página estourou.

## Decisões
- 2026-10-16 (Claude): texto e valores do original sem mudança de conteúdo; só a forma. Ajustes de redação que o
  formato pediu: "os fluxos em negrito são os de envio, que você pediu" virou o grupo "A loja envia" em vermelho;
  "O WinThor aceita / no Kaizen ainda precisa ser confirmado" viraram selos; as três notas dos preços viraram
  cartões; os verbos do objetivo foram para o presente ("vê, compra, acompanha") nos cartões.
- 2026-10-16 (Claude): capa com a logo em fundo branco e a base azul com faixa vermelha inclinada, que sobrevive à
  impressora comum (sem borda, ela corta uns 4 mm da cor nas bordas, sem perder nada importante).
- 2026-10-16 (Claude): HTML impresso pelo Chrome em vez de Word ou Claude Docs, porque a identidade (logo, cores,
  letras) precisa sair exata no papel.

- 2026-10-16 (Claude): na página de valores, preços **oficiais** onde existem (Shopify Brasil, VTEX, Medusa,
  Supabase) em vez das estimativas do original; Adobe segue estimativa porque não publica. Convertido a R$ 5,08.
  O Shopify aparece como "Shopify" (todos os planos), não só "Shopify Plus". As outras 7 páginas não mudaram.

## Pendências
- [x] Página 4 (plataformas) dizia "Shopify Plus, B2B só no Plus" — corrigida em 2026-10-16 a pedido do Júlio
      (coluna "Shopify, do Basic ao Plus"; B2B "Sim" em todos os planos com até 3 tabelas de preço)
- [ ] A página 7 (alternativa) e o passo 3 seguem falando em **Shopify Plus**: coerente (é o plano com tabela por
      cliente sem limite), mas, se a Lube começar num plano menor, ajustar
- [ ] Confirmar com a VTEX em qual plano entra o B2B e a taxa do On Demand; com a Shopify, a taxa por venda com
      gateway de terceiros no Brasil
- [ ] Imprimir uma página de teste para conferir as cores na impressora da Lube — Júlio
- [ ] Os próximos passos da proposta (Kaizen, WinThor, cotações, demonstração, regra de estoque) — dono a definir na
      apresentação

## Histórico de mudanças
Tudo o que mudou neste projeto, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].
Sem repositório Git.

- **2026-10-16** — página 4 corrigida para bater com a de valores: coluna "Shopify" (do Basic ao Plus), B2B "Sim"
  em todos os planos desde 02/04/2026 com até 3 tabelas de preço, e "mais de 3 tabelas só no Plus" no ponto de
  atenção; entregue sozinha em `Downloads\... - plataformas (impressão).pdf` e no PDF completo (Claude, a pedido do
  Júlio) · [[2026-10-16 — Proposta de e-commerce B2B com a identidade da Lube]]
- **2026-10-16** — página de valores refeita com **todos os planos** de cada plataforma e o menor custo para começar
  (preços oficiais de 16/10, dólar a R$ 5,08); entregue sozinha em `Downloads\... - valores (impressão).pdf` e
  também no PDF completo; `GERAR SO VALORES.bat` novo (Claude, a pedido do Júlio) ·
  [[2026-10-16 — Proposta de e-commerce B2B com a identidade da Lube]]
- **2026-10-16** — versão para impressão criada (8 páginas A4) em `Desktop\BI\15. PROPOSTA ECOMMERCE B2B\`, PDF em
  `Downloads` (Claude, a pedido do Júlio) · [[2026-10-16 — Proposta de e-commerce B2B com a identidade da Lube]]
