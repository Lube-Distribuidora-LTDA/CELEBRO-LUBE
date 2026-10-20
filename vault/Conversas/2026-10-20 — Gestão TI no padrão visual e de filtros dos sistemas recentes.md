---
tipo: conversa
data: 2026-10-20
projeto: "[[GESTÃO TI]]"
status: resumido
tags: [conversa, ti, design, filtros]
---
# 2026-10-20 — Gestão TI no padrão visual e de filtros dos sistemas recentes

## Resumo
O Júlio pediu: *"mude o design do sistema para os design e filtros que fizemos nos sistemas recentes, utilize o
cérebro para fazer"*. O [[GESTÃO TI]], que foi a origem do padrão em 2026-09-24, ficou para trás enquanto os
sistemas seguintes evoluíram. Ele voltou ao padrão atual, com o código do [[GESTÃO FISCAL]] (`web/css/base.css` e
`web/js/filtros.js`) como referência. Commit `a13796b`, no ar às 17:19.

## Decisões
- 2026-10-20: **troca de cara sem reescrever as telas** (Claude). Os nomes antigos do Tailwind (`lube-*`,
  `surface-*`, `brand-red`) passaram a apontar para os tokens do padrão no `@theme`, e um script trocou as cores
  fixas das telas: verde/âmbar/vermelho/azul-claro viraram `ok`/`atencao`/`perigo`/`info`, e o texto azulado virou
  `t1`/`t2`/`t3`. O HTML dos e-mails (`templates.ts`) não foi tocado: e-mail não lê o CSS do sistema.
- 2026-10-20: **fontes hospedadas no próprio sistema** (`public/fonts`, as mesmas 11 do Fiscal), sem CDN. A
  [[SENTINELA LUBE]] barrava até o arquivo de fonte sem login (401), o que deixaria a tela de login sem fonte; o
  `matcher` do middleware passou a deixar `/fonts/` de fora. Arquivo de fonte não tem dado.
- 2026-10-20: **ícone do KPI na linha do rótulo**, como no Fiscal (Claude). Com o valor em JetBrains Mono, mais
  largo, "R$ 107.515,44" não cabia ao lado da caixa de ícone e saía cortado.
- 2026-10-20: **Faturas guarda o recorte da casa** como primeira opção do período: "Mês atual + atrasadas" (o
  mês corrente fechado mais o que ficou atrasado em aberto, regra de 2026-10-06), seguido de Mês atual, 3 meses,
  Ano atual, 12 meses e Tudo, e as datas livres. O antigo seletor "Só Out/26" virou o "Mês atual".
- 2026-10-20: **Fornecedores abre nos ativos**, como Contas, com o segmento Ativos/Inativos/Todos (Claude).
- 2026-10-20: **os cartões de Inventário e Notas avulsas contam o que está filtrado**, como o resto da tela.

## O que foi criado ou mudou
- [[GESTÃO TI]]:
  - Visual: Archivo nos títulos, IBM Plex Sans 500 no texto, JetBrains Mono nos números (inclusive na coluna de
    valor das tabelas); tokens do Fiscal; item ativo do menu em ouro; marca com "Gestão de TI" em ouro; botão
    principal vermelho, "Excluir" em contorno; KPI com valor em mono, card de destaque em ouro e **card zerado
    cinza**; toast de 4 s com faixa de cor; gráficos com eixo e grade nos tokens.
  - **Carimbo de versão** no rodapé do menu (`versão AAAA-MM-DD (commit)`, montado no build a partir do commit
    que a Vercel injeta).
  - **Faixa de filtros** (componente `src/components/Filtros.tsx`): "Filtros", períodos rápidos em segmento,
    datas livres com atalho dos 6 últimos meses, um botão por dimensão com lista de **múltipla escolha** (busca
    quando passa de 10 opções, trecho achado destacado, marcados primeiro, "Marcar os N", "Limpar"), **pílulas**
    removíveis e "Limpar filtros". Vazio = todos. Em Faturas (período, situação, fornecedor, categoria,
    competência, busca + atalhos de alerta), Contas, Chamados, Inventário, Notas avulsas e Fornecedores.
  - **Faturas ganhou Excel** com exatamente o recorte da tela: lista e planilha usam a mesma consulta
    (`src/lib/consulta-faturas.ts`). A API de faturas, chamados e a exportação de contas aceitam vários valores
    separados por vírgula; faturas aceita `de`/`ate` (o `mesVencimento` antigo continua valendo).
- Conferido no navegador com sessão de teste: dashboard, Faturas (filtro, pílula, Excel de 23 KB), Contas,
  Fornecedores, Kanban e Faturas em 375 px sem rolagem lateral; `npm run build` limpo; produção conferida pelo
  `/fonts/` respondendo 200 (a versão antiga responde 401).

## Pendências
- [ ] **Tema claro**: o padrão pede claro e escuro, e o Gestão TI ainda é só escuro. As telas têm muita classe de
      transparência sobre fundo escuro (`bg-white/…`); vale como próximo passo, se o Júlio quiser.
- [ ] Chamados e Inventário estão **vazios no banco** (0 registros): a faixa nova foi conferida pela API, não com
      dado real.
- [ ] Clique nos números levando ao dado filtrado (regra de 2026-10-07 do [[REPOSIÇÕES E CHAMADOS]]) ainda não
      existe aqui, fora o que o dashboard já fazia.
