---
tipo: conversa
data: 2026-10-13
projeto: "[[Cérebro da Lube]]"
departamento: TI
status: resumido
tags: [conversa, cerebro, painel, rotinas, funil]
---
# 2026-10-13 — Aba Rotinas e o funil do fluxo no cérebro

## Resumo
O Júlio pediu "uma aba dentro do cérebro além das conversas" com as **rotinas**: clicando numa, abre um painel ao
lado com **o funil mostrando o fluxo, conectado um ao outro**. O painel do robô ganhou a aba **Rotinas** e o
**funil**, e as 11 notas de `Rotinas/` ganharam a seção `## Fluxo`, que é a fonte do funil. Publicado no mesmo link,
versão 5 do artifact. Continuação de [[2026-10-09 — Cérebro vira robô e tudo o que mudou anotado]].

## Decisões
- 2026-10-13 (Claude): o funil sai de uma seção **`## Fluxo`** escrita em cada nota de rotina, e não de adivinhação:
  lista numerada `N. **Tipo** · texto`, com os tipos Gatilho, Pessoa, Lê, Processa, Confere, Grava, Avisa e Entrega.
  Sub-itens `**Se falhar:**` (vermelho) e `**Atenção:**` (âmbar). Fica legível também no Obsidian.
- 2026-10-13 (Claude): cada etapa só com fatos que as notas já registravam; o que não se sabia ficou de fora ou com
  "a confirmar".
- 2026-10-13 (Claude): rotina sem `## Fluxo` aparece com um fluxo **deduzido** e o aviso para escrever a seção.

## O que foi criado ou mudou
- [[Cérebro da Lube]]: abas **Departamentos | Rotinas** no trilho; lista das rotinas por sistema com horário e
  "próxima em …" (atualiza a cada minuto); painel do **funil** (silhueta de funil, etapas que estreitam, ícone e cor
  por tipo, conectores com partículas descendo, avisos presos à etapa, "Ver nota completa", link de etapa abre a nota
  com "← Voltar ao fluxo"); as contas vermelhas do halo do robô e o mapa em anéis também abrem o funil.
- `Rotinas/`: seção `## Fluxo` nas 11 notas ([[BI Compras - Sync rapidas]], [[BI Compras - Sync faturamento]],
  [[BI Comercial - Sync rapidas]], [[BI Comercial - Sync margem]], [[BI Comercial - Servidor de margem]],
  [[Gestão TI - Leitura de e-mail e cobrança]], [[Gestão TI - Resumo diário no Telegram]], [[Gestão TI - Kanban TI]],
  [[Reposições - Sync]], [[Reposições - Aquecer painel]], [[Validação mensal da folha]]). Nada do texto antigo foi
  apagado (conferido linha a linha).
- **Arquivo para baixar** (pedido do Júlio): `Cerebro da Lube.html`, o painel inteiro num arquivo só (~460 KB),
  que abre com dois cliques no Chrome/Edge. Os 5 scripts vão dentro dele e se ligam ao abrir; o 3D continua vindo da
  internet (jsdelivr) e, sem internet, cai no mapa em anéis. Não leva nenhuma nota dentro: as notas entram pelo
  **Recarregar cérebro** e ficam guardadas só naquele navegador. Conferido aberto do disco e pelo servidor local.
- De quebra: o leitor numera certo listas com sub-itens; o mapa em anéis não dá mais erro de raio negativo ao abrir
  (defeito que já estava na versão 4).

## Pendências
- [ ] Júlio: clicar em **Recarregar cérebro** para o painel ler as seções Fluxo novas (o navegador guarda a última leitura).
- [ ] Júlio decide: pôr `frequencia` no frontmatter de [[Gestão TI - Resumo diário no Telegram]] e de
  [[Validação mensal da folha]] (hoje o painel acha 09:00 e "mensal" pelo corpo da nota) e `departamento: TI` em
  [[Gestão TI - Leitura de e-mail e cobrança]].
- [ ] Conferir se o `?preview=1` e o `?descobrir=1` do [[Gestão TI - Resumo diário no Telegram]] ainda abrem desde
  que a [[SENTINELA LUBE]] passou a exigir o `CRON_SECRET` no cabeçalho (2026-10-07).
- [ ] Ideia, se o Júlio quiser: um mapa compacto das etapas fixo no topo do funil, para ver um fluxo de 8 etapas sem rolar em telas de 720 px.
