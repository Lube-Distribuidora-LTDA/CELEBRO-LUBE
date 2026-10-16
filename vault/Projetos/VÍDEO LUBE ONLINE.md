---
tipo: projeto
departamento: Marketing
status: ativo
inicio: 2026-10-15
tags: [projeto, video, motion, narracao, ecommerce, lube-online, marketing, ia]
---
# VÍDEO LUBE ONLINE

Vídeo animado e **narrado** que apresenta a proposta do **Lube Online**, o e-commerce B2B da Lube com um time novo de
Marketing + IA. Base: o PDF "Lube Online — Proposta de E-commerce" (18 páginas, Departamento de Marketing, outubro de
2026) e um vídeo de referência de estilo (vitrine de motion design de um produto de IA: barra digitando, telas do
produto em 3D, títulos curtos com destaque colorido, parede de telas inclinada no fim). Feito com o [[Claude]] em
2026-10-15 ([[2026-10-15 — Vídeo animado da proposta Lube Online]]), no mesmo esquema de gravação do
[[VÍDEO WORKSHOP LUBE]] e da [[VINHETA CPG]].

## O vídeo
- 1920×1080, 60 qps, H.264 + AAC, **2 min 33 s** (9.180 quadros), com narração, música e efeitos.
- **Roteiro em 14 cenas**, cada uma no tempo da fala:
  1. **Abertura** (só música): uma barra digita `loja.lube.com.br` e responde "Esta página ainda não existe."
  2. **Legado:** "1959" gigante, o caminhão da Lube atravessando, ES/RJ/BA e os números (67 anos, 200 mil m², ~210
     colaboradores).
  3. **Problema:** "Hoje, o site só apresenta." (site institucional, catálogo em PDF "sem preço / sem estoque") e
     depois "Hoje, o pedido é manual." (telefone ou representante, WhatsApp, "horário comercial · FECHADO" e o pedido
     redigitado em que 100 caixas viram 10).
  4. **Expectativa:** celular às 23:47 de domingo com a loja aberta; "preço da sua conta", "estoque disponível",
     "prazo na hora".
  5. **Revelação:** a barra digita o endereço de novo, túnel de luz, "Apresentamos", e o **drop** da música com a marca
     **Lube Online** (o "L" da Lube em vetor + "Lube" branco e "Online" laranja, como no PDF), no exato instante em
     que o narrador diz "Lube".
  6. **Site** `loja.lube.com.br`: login por CNPJ, preços liberados com "preço da sua conta", busca "café" (produtos,
     marcas, código) e "repetir último pedido" com os produtos voando para o carrinho (12 itens).
  7. **Checkout no celular:** boleto ou PIX, limite de crédito, "pedido confirmado", rastreio (recebido → separação →
     em rota → entregue), NF-e e boleto, aviso no WhatsApp.
  8. **Benefícios:** os 6 pontos do PDF (vendas 24 h, mais alcance, vendedor estratégico, menos erros, dados de cada
     cliente, ticket médio maior), um por vez, no tempo da fala.
  9. **Time Marketing + IA:** duas esferas que se juntam em "um só time"; marca e campanhas de um lado, dados,
     previsões e automação do outro.
  10. **IA na prática:** descrição de produto escrita pela IA, "quem leva este, também leva…", aviso de estoque
      acabando e atendimento no WhatsApp às 02:14.
  11. **ERP e PIX:** Lube Online ⇄ ERP (estoque, preço, crédito, faturamento); "Quanto custa uma venda no PIX?" e
      **R$ 0,80** (AbacatePay; num PIX de R$ 1.000, contra R$ 11,90 na Stripe), "dinheiro na hora".
  12. **Plano de 12 meses:** diagnóstico, piloto, lançamento no ES, expansão RJ e BA, com as fases marcadas na régua e
      a ressalva do PDF ("prazos estimados, confirmados depois do diagnóstico do ERP e da escolha da plataforma").
  13. **Próximos passos:** os 4 do PDF, cada um com uma seta laranja (próximo passo, não "feito").
  14. **Final:** parede de telas e produtos inclinada, "67 anos abastecendo o comércio. Agora, também online." e a
      assinatura Lube Online + `loja.lube.com.br` + logo oficial em placa branca.
- **Produtos reais do catálogo da Lube:** 24 fotos de `P:\FOTOS_ION` (as mesmas do [[GESTÃO COMERCIAL TRADE]]):
  arroz Rei Arthur e Dono da Casa, cafés Pilão, 3 Corações, Melitta e Camargo, Tixan Ypê, óleo Soya, açúcar União,
  feijão Granvita, Leite Moça, azeite Gallo, Nescau, Hellmann's, Pomarola, papel Mili, sal Globo, Toddynho, Toddy,
  Cream Cracker Galo, Elefante, Ypê Bak, Limpol. **Preços, CNPJ, cliente ("Mercado Bom Preço") e pedido são
  ilustrativos**; o canto da tela avisa "Layout, produtos e preços ilustrativos" nas cenas da loja.
- **Narração:** voz neural do Edge `pt-BR-AntonioNeural` (+10% de velocidade, −2 Hz), grátis, a mesma família de
  vozes do [[JARVIS DA LUBE]]. Cada palavra tem o seu tempo, e as animações entram nela.
- **Música e efeitos:** compostos do zero em código (120 BPM, Ré maior / Si menor), sem música nem amostra de
  terceiros. Cada cena começa num tempo forte; o clima muda por cena (calmo no legado, tensão no problema, subida e
  **drop** na revelação, groove na loja, pausa no time, golpe final). A música abaixa sozinha quando o narrador fala.
- **Som medido, não ouvido pelo Claude:** narração 13,8 dB acima da música; entrega em **−14 LUFS** e pico −1,5 dBFS
  (padrão de YouTube e redes).

## Onde estão as coisas
- Vídeo final: `Downloads\Lube Online - Vídeo da proposta.mp4` (98,5 MB, 2026-10-15; cópia em `out\Lube Online.mp4`
  no projeto). A prévia de antes da revisão foi só enviada na conversa, não ficou em `Downloads`.
- Projeto para refazer: `Desktop\BI\14. VIDEO LUBE ONLINE\` (ler o `LEIA-ME.md`). Dois cliques em
  **`GERAR VIDEO.bat`** refazem tudo (~25 min) e copiam para `Downloads` sem sobrescrever.
- Fontes de origem: `Downloads\Lube Online — Proposta de E-commerce.pdf` e `Downloads\video.mp4` (referência de
  estilo, 15 s, 1280×720).

## Como foi feito
- `roteiro.json` (texto e voz) → `tools\voz.py` (narração e tempo de cada palavra) → `tools\tempo.py` (cenas na grade
  de 120 BPM, em múltiplos de 1 s) → `web\` (cenas em HTML/CSS: `motor.js`, `ui.js`, `cenas1-3.js`; tudo
  determinístico por `seek(t)`) → `node tools\render.js eventos` (efeitos que as cenas pedem) → `tools\som.py`
  (trilha + mixagem) → `node tools\render.js video` (Chrome sem janela via `puppeteer-core`, 3 trabalhadores em blocos retomáveis de 10 s,
  ffmpeg H.264 crf 16, cor bt709) → `tools\montar.py`.
- Diferente dos dois vídeos anteriores (WebGL), este é **HTML/CSS**: o site e o celular são telas de verdade, com
  fotos e texto nítidos.
- O passo a passo virou a skill [[video-motion]] (2026-10-16), com este projeto como referência e as lições da
  revisão; o próximo vídeo começa por ela.

## Decisões
- 2026-10-15 (Claude): o "ultracode" do prompt colado foi lido como parte do texto de referência (o prompt original
  era sobre o TypingMind), não como pedido de orquestração.
- 2026-10-15 (Claude): o vídeo segue o PDF e corta o que é tabela (custos da Shopify, indicadores e orçamento com
  campos "[__]" ainda em branco); do pagamento ficou só o número forte (R$ 0,80 por PIX).
- 2026-10-15 (Claude): produtos com fotos reais do catálogo da Lube em vez de embalagens desenhadas; preços
  ilustrativos com aviso na tela, como o próprio PDF faz.
- 2026-10-15 (Claude): narrador masculino (`AntonioNeural`). Trocar é uma linha no `roteiro.json`.
- 2026-10-15 (Claude): música própria, sintetizada, para não depender de licença.

## Erros e incidentes
- 2026-10-15: 1ª gravação travou numa das 6 partes (o Chrome parou de responder no 1º quadro, com a máquina ocupada
  compondo a trilha ao mesmo tempo). O `render.js` passou a reabrir o Chrome e repetir o quadro (até 4 vezes).
- 2026-10-15: duas gravações morreram quando a sessão do Claude fechou (processo filho da sessão). Desde então a
  gravação roda **fora da sessão** (processo do Windows criado pelo WMI, log em `out\render.log`) e é **retomável**: grava
  em blocos de 10 s e, se parar, rodar de novo só grava o que falta (`.ok` por bloco). `--refazer 21-45` regrava só
  um trecho.
- 2026-10-15: com 5 Chromes + 5 codificadores a máquina (7,8 GB de RAM) ficou sem memória e um ffmpeg caiu no meio
  (`EPIPE`). Passou a usar **3 trabalhadores** e preset `medium`, e bloco que falhar volta para a fila (até 3 vezes).
  Uma gravação completa leva ~15 min.
- 2026-10-15: **revisão independente** (3 revisores, cada um com um terço do vídeo, olhando quadros do MP4 em tamanho
  real): 3 defeitos altos, ~25 médios e baixos, **todos corrigidos** antes da entrega:
  - altos: chip cobrindo o título em 42 s; aviso "último pedido repetido" embolado na troca site → checkout; placa da
    logo oficial 126 px fora do centro no final (era medida antes de a imagem carregar);
  - sincronia: o narrador dizia "Lube Online" 0,8 s antes de a marca aparecer → a fala foi reposicionada para o
    "Lube" cair exatamente no drop (49,0 s);
  - fidelidade: "em 3 estados" nos colaboradores (não está no PDF), "Entrega amanhã" (virou "Prazo na hora"),
    "212 páginas" e "08h às 18h" inventados (saíram), "PIX recebido" junto de "boleto vencendo", conversa das 02:14
    dizendo que o pedido "saiu às 08:12"; preços sem embalagem pareciam preço unitário (embalagem em todos);
  - acabamento: pontuação descolada nos títulos (fonte Jakarta 800), "500 / g" quebrando a linha, textos pequenos
    nos cartões da IA, Toddy com fundo branco no banner laranja, títulos de cenas se cruzando nas trocas, passos
    marcados como "feitos" (viraram seta: é o que se pede à diretoria), ressalva dos prazos do PDF no plano.
- 2026-10-15: detalhes de código achados nos quadros de prévia e corrigidos antes da gravação: títulos sem posição,
  aviso de erro aparecendo antes da hora (a curva `outBack` dava 2e-16 em vez de 0), lista da busca escondida atrás do
  banner, títulos dos cartões de benefício batendo nos ícones.

## Pendências
- [x] Assistir com som e dizer se a voz e a música estão boas — Júlio, **aprovado em 2026-10-16** ("Assisti com som e
      ficou bom")
- [x] Criar a skill `video-motion` com o passo a passo dos vídeos — feita em 2026-10-16: [[video-motion]]
- [ ] Se o Marketing preferir voz feminina: `pt-BR-FranciscaNeural` ou `pt-BR-ThalitaMultilingualNeural` no
      `roteiro.json` e regravar (opcional; a voz masculina foi aprovada)
- [ ] Confirmar com o Marketing se `loja.lube.com.br` é o endereço planejado (veio do mockup do PDF)
- [ ] Se for mostrar fora da empresa: as marcas dos produtos são das indústrias parceiras; no vídeo interno não há
      problema

## Histórico de mudanças
Tudo o que mudou neste projeto, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].
Sem repositório Git.

- **2026-10-16** — skill [[video-motion]] criada a partir deste projeto e dos dois vídeos anteriores: o caminho do
  roteiro à entrega, a gravação fora da sessão, a revisão e as lições (Claude, a pedido do Júlio) ·
  [[2026-10-15 — Vídeo animado da proposta Lube Online]]
- **2026-10-16** — Júlio assistiu com som e aprovou a versão final (voz e música) ·
  [[2026-10-15 — Vídeo animado da proposta Lube Online]]
- **2026-10-15** — versão final (revisada) entregue em `Downloads\Lube Online - Vídeo da proposta.mp4`, 98,5 MB;
  gravação retomável fora da sessão (Claude) · [[2026-10-15 — Vídeo animado da proposta Lube Online]]
- **2026-10-15** — revisão independente (3 revisores) e correção de 3 defeitos altos e ~25 médios/baixos (Claude) ·
  [[2026-10-15 — Vídeo animado da proposta Lube Online]]
- **2026-10-15** — projeto criado em `Desktop\BI\14. VIDEO LUBE ONLINE\`; prévia enviada na conversa (Claude, a
  pedido do Júlio) · [[2026-10-15 — Vídeo animado da proposta Lube Online]]
