---
tipo: conversa
data: 2026-10-08
projeto: "[[REPOSIÇÕES E CHAMADOS]]"
departamento: Logística
status: resumido
tags: [conversa, reposicao, vercel, deploy]
---
# 2026-10-08 — Conferência do deploy do Reposições

## Resumo
O Júlio pediu para **subir os deploys das atualizações** do [[REPOSIÇÕES E CHAMADOS]] feitas em 2026-10-07 ([[2026-10-07 — Ajustes do painel de Reposições e a lentidão ao abrir]]). Não foi preciso subir nada: a produção já servia o último commit da `main`. Pedido feito numa sessão cujo assunto principal era a [[SENTINELA LUBE]].

## O que foi conferido
- **Produção** de `https://reposicoes-web.vercel.app` (projeto `reposicoes-web`, id `prj_IjVNqbwMq19wyDsAE0mfJZ7r3OIJ`, Root Directory `web`) no commit **`5b6a0bd`** (07/10 14:15), o mesmo da `origin/main`. Antes dele: `cc6d78e` (06/10), `fee976d`, `e3cce06` e `c5ab85e` (07/10).
- No ar, portanto: o clique que abre o Detalhe filtrado, o filtro de cliente, a coluna SKU, o tooltip novo e o painel que não espera o banco.
- A página e a `/api/dados` responderam normalmente.
- Os scripts do ETL em `P:\INTEGRAÇÃO BI\REPOSICOES\2 - SISTEMA REPOSICOES` são **idênticos** aos do repositório (fora logs, `__pycache__` e o `ENV`).
- Como conferir da próxima vez, sem cair no "respondeu 200": ver [[Vercel]] (o deploy que o endereço de produção aponta e o commit dele, comparado com a `main`).

## Decisões
- Nenhuma.

## O que foi criado ou mudou
- [[REPOSIÇÕES E CHAMADOS]]: registrado "conferido em 2026-10-08: produção no commit `5b6a0bd`".
- Nada mudou no sistema.

## Pendências
- [ ] **Agendar** a carga e o aquecedor — Júlio, `INSTALAR TUDO.bat` ([[Reposições - Sync]], [[Reposições - Aquecer painel]]).
- [ ] O painel continua **sem o guarda da Sentinela**: abre para quem tiver o link, fora da regra de 2026-10-06 de só abrir com login pelo Painel Lube. Não foi pedido nesta conversa.
