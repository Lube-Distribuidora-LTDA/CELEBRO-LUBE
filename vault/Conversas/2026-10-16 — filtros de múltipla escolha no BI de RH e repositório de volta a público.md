---
tipo: conversa
data: 2026-10-16
projeto: BI ABSENTEÍSMO RH
tags: [conversa, rh, bi, filtros, vercel, github, privacidade]
---
# 2026-10-16 — filtros de múltipla escolha no BI de RH e repositório de volta a público

## Resumo
O Júlio pediu que os filtros do [[BI ABSENTEÍSMO RH]] seguissem **a mesma navegação dos outros BIs da Lube**: poder marcar quantos meses e quantas pessoas quiser, e o Excel sair com os dados do filtro. Começou pela InterJornadas e se estendeu às demais abas.

No fim do dia apareceu um problema separado: para destravar o deploy, o repositório voltou a ser **público** — e com ele as planilhas de pessoal, que têm CPF e salário.

## O que foi feito
Um componente único de filtro múltiplo, reaproveitado em todas as abas, com o contrato já registrado em [[Como eu gosto dos BIs]]: a partir de "Todas", o clique seleciona **só** aquela opção; depois cada clique soma ou tira; esvaziar volta para "Todas". **Conjunto vazio = tudo**, então nenhum filtro começa escondendo dado.

- Lista acima de 10 opções ganha campo de busca (são 78 colaboradores na InterJornadas).
- Só um painel aberto por vez, e clique fora fecha.
- Bolinha ciano no rótulo quando o filtro está ativo — dá para ver o que está filtrando sem abrir.
- O resumo do botão mostra o rótulo quando é uma opção só, e "N selecionados" quando é mais de uma.
- `descreverFiltroMulti()` escreve os filtros ativos no cabeçalho do Excel, então o relatório diz de onde veio.

Nas abas que já tinham `<select>`, em vez de reescrever cada uma, `ativarMultiNoSelect()` **mantém o select escondido e espelha as opções dele** — o filtro múltiplo nasce pronto sem mexer no resto do código da aba.

- `a0601b6` — InterJornadas (os cinco filtros) e Excel com os dados filtrados
- `82c3ddc` — Absenteísmo (7 filtros), Hora Extra, Exames e Painel HEAD

## Conferência antes de subir
Feita na máquina, com os dados reais:
- InterJornadas (17.098 linhas): um período = 2.158; dois períodos = 4.449, igual à soma dos dois isolados; dois períodos + três pessoas = 186, igual ao número calculado por fora; tirar um clique reduziu certo; limpar voltou a 17.098.
- Absenteísmo: os 7 filtros com opções; atalhos ENTREGA 451, Segundas 434, Injustificado 387, todos com 100% das linhas batendo o critério; limpar voltou a 1.282.
- Hora Extra, Exames e HEAD: somas conferidas contra o total.

## Deploy
Os dois commits ficaram **`BLOCKED` na Vercel** — nem chegaram a construir, porque o repositório estava privado no plano Hobby (problema já conhecido, ver [[Vercel]]). O Júlio liberou e o deploy saiu pela API: `dpl_At11aErqUGkzPRsMakpPpjPLwa4H`, **READY**, com o alias `rh-absentismo.vercel.app`. Log de build limpo: clonou `82c3ddc`, rodou o `generate-config.js`, concluiu em 2 s.

**Não deu para conferir a página publicada**: com o guarda da [[SENTINELA LUBE]] ligado, sem sessão do Painel Lube a página responde 308 para o portal e os `.js` respondem 401. O matcher do middleware só deixa passar css, imagens e fontes. Quem confere é o Júlio, logado.

## O que ficou de fora
**O Turnover não foi convertido.** Lá o ano e o setor não filtram uma lista — eles **montam a série do gráfico** (12 meses do ano escolhido, uma linha por setor). Múltipla escolha ali exige refazer o gráfico, não só o filtro. Decisão do Júlio se vale a pena.

## Repositório público de novo — atenção
Para destravar o deploy o repositório foi renomeado para **GESTAO-RH** e voltou a ser **público** (conferido em 2026-10-16: `"visibility": "public"`). Com isso, **qualquer pessoa na internet baixa sem login**:
- `planilhas referencias/` — 14 planilhas, entre elas 8 de hora extra (CPF e salário), empregados, HEAD, turnover e ponto
- `exames-periodicos-data.js`, `dashboard_dataset.json`, `powerbi_data.json` — faltas por funcionário

Contraria o [[Como trabalhar comigo]] ("dado de pessoa não vai para o repositório"). Apagar agora **não limpa o histórico do Git**. Decisão do Júlio: assinar o Pro e fechar, ou limpar o histórico, ou publicar sempre pela API com o repositório privado.

## Decisões
- Filtro múltiplo é o padrão do BI de RH, igual aos outros BIs — a partir de "Todas", clique soma ou tira
- Excel sai com os dados filtrados e com os filtros escritos no cabeçalho
- Turnover fica como está por enquanto
- Repositório voltou a público em 2026-10-16 para destravar o deploy

## Pendências
- [ ] Conferir a página publicada logado (rodapé deve mostrar `82c3ddc`) — Júlio
- [ ] Dizer se quer múltipla escolha no Turnover, que pede refazer o gráfico — Júlio
- [ ] **Resolver os dados de pessoa no repositório público** — Júlio. Ver [[BI ABSENTEÍSMO RH]]
- [ ] Fechar as políticas de RLS do banco — segue aberto

## Links
[[BI ABSENTEÍSMO RH]] · [[Como eu gosto dos BIs]] · [[Como trabalhar comigo]] · [[SENTINELA LUBE]] · [[Vercel]] · [[Corte do ponto]]
