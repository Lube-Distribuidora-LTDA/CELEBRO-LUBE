---
tipo: conversa
data: 2026-08-31
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, absenteismo, ia, supabase, vercel]
registrado_em: 2026-10-09
---
# 2026-08-31 — histórico de importações e IA no BI de RH

## Resumo
No [[BI ABSENTEÍSMO RH]]: cada planilha importada passou a ficar num **histórico** (ver, renomear) e o painel passou a mostrar só a mais recente. Entraram também duas funções de IA: o **Diagnóstico Executivo Automatizado de RH**, gerado a cada importação, e o **Assistente Virtual do RH**, um chat que explica o sistema. As duas começaram na NVIDIA e foram trocadas no mesmo dia pelo Google Gemini. Em 2026-09-01 o assistente ganhou formatação de texto.

## Decisões
- 2026-08-31 (Júlio): ao importar uma planilha nova, o painel mostra só os dados dela; as anteriores ficam no histórico, sem misturar. **Desfeito em 2026-09-16**, quando a importação passou a ser cumulativa — ver [[2026-09-15 — corte do ponto, importação do PontoMais e gráficos do Turnover no BI de RH]].
- 2026-08-31 (Claude): o escopo é **por importação** (`import_id`), não por mês, porque cada planilha já é um retrato de vários meses.
- 2026-08-31 (Claude): a chave da IA **nunca vai para o navegador** (site e repositório eram públicos); fica numa variável de ambiente da [[Vercel]], usada por função serverless.
- 2026-08-31 (Claude): para a IA vão **só números agregados**, nunca nome de colaborador.
- 2026-08-31 (Claude): o diagnóstico é gerado uma vez por importação e guardado no banco; o diagnóstico por regras continua como resposta imediata e reserva.
- 2026-08-31 (Júlio): trocar a NVIDIA pelo **Google Gemini** (AI Studio), gratuito e estável, em vez de Groq ou da API paga da DeepSeek.
- 2026-08-31 (Júlio): o assistente **só explica**; não altera dados nem regra de cálculo. Ficou para o futuro um modo em que a IA sugere a mudança e o Júlio confirma.

## O que foi criado ou mudou
**Histórico de importações** (commit `24d7cfe`)
- Migração `add_import_id_and_nome_customizado` no [[Supabase]]: `historico_importacoes.nome_customizado` e `ocorrencias_absenteismo.import_id`, com índice. As 1.016 ocorrências da época (Dez/2025 a Jun/2026) foram ligadas à importação 1.
- Botão "Histórico" no cabeçalho, modal com data, arquivo e número de registros, lápis para renomear e olho para visualizar. Faixa âmbar de modo histórico com "Voltar ao Atual".
- O Realtime passou a ignorar inserções de outra importação.
- Na máquina do Júlio: Chromium do Playwright instalado (`npx playwright install chromium`) para os testes de tela.
- Bug antigo corrigido: o modal "Novo Registro" tinha 2 `</div>` faltando, e o navegador escondia dentro dele os modais seguintes (Status do Supabase, Histórico e o aviso).

**Diagnóstico Executivo por IA** (commits `d41e850`, `a4157da`)
- Migração `add_diagnostico_ia_to_historico_importacoes`: `diagnostico_ia` e `diagnostico_ia_gerado_em`.
- Função `api/diagnostico.js`. Começou na NVIDIA NIM (DeepSeek, depois kimi-k3, com tempo limite de 9 s para 55 s) e foi reescrita para o Gemini `gemini-flash-lite-latest`, que respondeu entre 0,8 e 3,6 s. Variável `GEMINI_API_KEY`.
- Selo "GERADO POR IA" ou "MODO PADRÃO" no painel.
- `vercel.json`: `{ handle: filesystem }` antes do redirecionamento geral, senão `/api/*` caía no `index.html`. O tempo máximo das funções (`maxDuration`) foi de 30 s para 60 s na fase da NVIDIA (o assistente começou em 45 s) e voltou a 30 s com o Gemini.

**Assistente Virtual do RH** (commits `4a94f6f`, `a4157da`, `bcedcb4`, `99bb5a1`)
- Botão redondo no canto inferior direito e painel de chat com "Digitando…". Função `api/assistente.js` com as fórmulas de cada aba e o contexto ao vivo da aba aberta.
- Imagem do botão: a mascote da Lube (`imagens/logo agente virtual.png`), primeiro recortada no rosto e depois inteira (`object-contain`), a pedido do Júlio.
- Tenta 2 vezes sozinho antes de mostrar "Tentar novamente".
- 2026-09-01: respostas com negrito, itálico e listas formatados. Antes os símbolos `**` e `*` apareciam crus. O texto é escapado antes de formatar.

## Erros e incidentes
- O classificador do modo automático bloqueou a migração no Supabase; ela só foi aplicada depois da confirmação do Júlio.
- Na NVIDIA, os modelos DeepSeek passaram de 100 s sem responder, e o kimi-k3 variou de 4 s a mais de 90 s (limite do plano gratuito). O teste ponta a ponta caiu na reserva; nada foi gravado em produção. O Júlio viu erro na tela do assistente.
- O teste renomeou a importação 1; o nome voltou para vazio no banco.
- As chaves da NVIDIA e do Gemini foram coladas no chat, e uma resposta do Claude repetiu parte da chave da NVIDIA.

## Pendências
- [ ] Confirmar que a `GEMINI_API_KEY` está cadastrada na Vercel e que a próxima importação mostra "GERADO POR IA" — Júlio. A `NVIDIA_API_KEY` deixou de ser usada
- [ ] Trocar as chaves da NVIDIA e do Gemini que passaram pelo chat — Júlio
- [x] 2026-09-16 — Conferir se o escopo por importação foi revertido: foi, no commit `77c3227` (importação cumulativa)

Veja também [[BI ABSENTEÍSMO RH]], [[Supabase]] e [[Vercel]].
