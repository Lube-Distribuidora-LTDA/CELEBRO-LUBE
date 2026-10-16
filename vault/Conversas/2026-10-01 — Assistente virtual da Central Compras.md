---
tipo: conversa
data: 2026-10-01
projeto: "[[BI COMPRAS]]"
departamento: Compras
status: resumido
tags: [conversa, bi, compras, ia, assistente, excel]
---
# 2026-10-01 — Assistente virtual da Central Compras

## Resumo
O Júlio pediu um agente virtual "igual ao do Sistema de ICMS", com design bonito, que respondesse qualquer pergunta e
gerasse relatórios personalizados em Excel. Foi criado um **botão flutuante com chat** no [[BI COMPRAS]]: o Claude
recebe ferramentas, e quem as executa é o próprio navegador, sobre os dados já carregados. O gerador de `.xlsx` veio do
[[BI COMERCIAL]]. O código está publicado, mas **o assistente só responde depois que a chave for cadastrada na Vercel**.

## Decisões
- 2026-10-01 (Claude): o modelo **não recebe os dados nem consulta o banco**. Recebe as ferramentas `consultar`,
  `agregar` e `gerar_planilha`, executadas pelo navegador sobre o JSON que o painel já carregou. Motivos: são 7.200
  produtos, e um pedaço truncado faria o assistente responder sobre uma amostra; o DATA WAREHOUSE tinha saturado no
  mesmo dia; e só o recorte pedido sai da máquina.
- 2026-10-01 (Claude): usar o Claude, da Anthropic, porque a chave fornecida era da Anthropic. No código:
  `claude-sonnet-5`, até 1.500 tokens por resposta.
- 2026-10-01 (Claude): uso no estilo do Assistente Virtual do RH ([[BI ABSENTEÍSMO RH]]); planilha no padrão do BI
  COMERCIAL (faixa da Lube, filtros por extenso, cabeçalho congelado, filtro automático, moeda nativa, linha de total).
- 2026-10-01 (Claude): a chave fica **só na variável de ambiente `ANTHROPIC_API_KEY` da Vercel**, nunca em arquivo nem
  no navegador.

## O que foi criado ou mudou
- Commit `4cd8ff2`:
  - `web/planilha.js`, copiado de `Desktop\BI\8. COMERCIAL\web\planilha.js`, com os textos trocados para "Central Compras";
  - `web/api/agente.js` (novo): função serverless que conversa com a API da Anthropic e lê a chave de `ANTHROPIC_API_KEY`;
  - `web/agente.js` (novo): o chat no navegador; os conjuntos de dados só são montados na 1ª pergunta; o filtro de
    sim/não aceita `true`, `1`, "sim" e "true";
  - `web/index.html`: botão flutuante no canto inferior direito, painel de chat com sugestões de pergunta, CSS `.ag-*`
    nos temas claro e escuro;
  - `web/vercel.json`: `maxDuration` de 30 s para `api/agente.js`.
- Commit `742556f` (mesmo dia): o prompt do agente passa a dizer que o faturamento guarda só o ano corrente.

## Erros e incidentes
- O Júlio colou uma chave da API da Anthropic no chat. Ela não foi gravada em arquivo nenhum (conferido com busca), mas
  ficou no histórico da conversa. Foi recomendado gerar uma nova e revogar a antiga.
- **Premissa corrigida (2026-10-09):** na conversa o Claude concluiu que o Painel ICMS não tinha chat (só o script local
  `agente_ia.py`, com Gemini) e que nenhum painel usava a API da Anthropic. **Isso estava errado:** o assistente do site
  do [[PAINEL ICMS]] usa o Claude desde 2026-09-08 (ver [[2026-09-04 — IA do Painel ICMS, assistente do site e a ponte do WinThor]]).
  Provavelmente só a pasta local foi olhada; o repositório do site do ICMS não tem clone nesta máquina.
- No teste, um filtro de sim/não com tipo diferente devolvia lista vazia sem aviso (o assistente responderia "não há
  nenhum" com toda a convicção). Corrigido com `paraBooleano`.
- 2026-10-05: o levantamento da [[SENTINELA LUBE]] achou o `/api/agente` **aberto** (qualquer um gastaria a chave).
  Fechado em 2026-10-06: sem login, responde 401.

## Preferências do Júlio
Agente virtual com design bonito, que responda tudo e gere relatórios personalizados formatados em Excel. Pede para
consultar o Cérebro antes de começar.

## Pendências
- [ ] Júlio: gerar uma chave nova no console da Anthropic e revogar a que ficou exposta.
- [ ] Júlio: cadastrar `ANTHROPIC_API_KEY` (Production) no projeto `painel-compras` da Vercel e republicar. Não foi
  confirmado; sem ela, o assistente avisa que a chave não está cadastrada.
- [ ] Testar o assistente com o modelo de verdade (os testes usaram respostas simuladas no servidor local).
