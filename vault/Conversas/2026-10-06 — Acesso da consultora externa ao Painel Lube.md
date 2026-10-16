---
tipo: conversa
data: 2026-10-06
projeto: "[[PAINEL LUBE DISTRIBUIDORA]]"
departamento: TI
status: resumido
tags: [conversa, portal, acesso, supabase, vercel]
---
# 2026-10-06 — Acesso da consultora externa ao Painel Lube

## Resumo
O Júlio pediu que a consultora **Melissa, da Mancebo Consulting**, entrasse no [[PAINEL LUBE DISTRIBUIDORA]] com o
e-mail da consultoria, sem o portal acrescentar `@lube.com.br` — **exceção só para ela**. Feito no banco, no portal,
no painel admin e na Edge Function, testado com e-mail descartável e publicado em produção. **Em andamento:** falta
criar a conta dela. Continuação da conversa [[2026-09-23 — criação do Painel Lube Distribuidora]].

## Decisões
- 2026-10-06 (Júlio): só a Melissa pode usar e-mail de fora do domínio.
- 2026-10-06 (Claude): a liberação mora numa **lista no banco** (`public.emails_externos`); o navegador só confere o
  formato do e-mail. Qualquer outro e-mail externo continua recusado pelo gatilho `handle_new_user`.
- 2026-10-06 (Claude): a conta dela é criada **pelo painel admin**, não pelo Primeiro acesso — sem a confirmação por
  e-mail (que a pendência do portal manda desligar), qualquer um poderia cadastrar esse e-mail antes dela. A conta nasce **sem sistemas**: o TI escolhe ao criar.
- 2026-10-06 (Claude): o commit levou só as mudanças desta conversa. O trabalho da [[SENTINELA LUBE]] que estava sem
  commit na mesma pasta ficou de fora (entrou à noite, no `c7366de`).

## O que foi criado ou mudou
- **Banco** (migração `emails_externos_liberados`, 14:41): tabela `public.emails_externos` (e-mail em minúsculas como
  chave, observação, quem e quando criou), só admin lê e altera; `handle_new_user` passa a aceitar `@lube.com.br`
  **ou** e-mail da lista. Hoje a lista tem **1** e-mail.
- `portal.js`: a trava de domínio do navegador virou checagem de formato; com e-mail completo, o `@lube.com.br` não é
  acrescentado.
- `admin.js`: o campo Usuário aceita o e-mail completo e esconde o sufixo fixo; dica explicando o caso de consultor.
- Edge Function `admin-users` v5 (o Supabase conta versão 6): fora do domínio, só cria usuário que esteja na lista.
- `db/01_schema.sql` (tabela e RLS na seção 7, depois de `is_admin()`), README com o `insert` para liberar mais um
  e-mail, cache `?v=20261006`.
- Commit `5941e8b` e push. O deploy ficou **`BLOCKED`** (`dpl_6ECDkXkpfakkxqEDtfLhZ68QE4qt`, 14:46): o repositório tinha voltado a ser privado. O Júlio liberou e o
  Claude criou um deploy novo de produção do mesmo commit (`dpl_5hnBxo2Y3PoDWwc3ohSiCiMjtMrF`, READY às 14:55);
  `portal.js` novo conferido no ar.
- [[PAINEL LUBE DISTRIBUIDORA]]: atualizado.

## Erros e incidentes
- Deploy `BLOCKED` por repositório privado — segunda vez (a primeira foi em 2026-09-30). Refazer o deploy bloqueado é
  recusado (400 `deployment_can_never_deploy`): o jeito é um deploy novo do commit. Ver [[Vercel]].
- No preview, o sufixo `@lube.com.br` parecia não sumir; era só a transição parada no painel de teste.

## Pendências
- [ ] Júlio: criar a conta da Melissa no painel admin (Novo usuário → e-mail completo → senha provisória → escolher
  os sistemas). Em 2026-10-09 o banco tem 10 perfis (eram 8 em 06/10): conferir se ela já está lá.
- [x] ~~Vercel Authentication barrando a Melissa~~ — conferido em 2026-10-09: no modo Standard o endereço principal
  (`painel-lube-distribuidora.vercel.app`) abre para todos; só as URLs de deploy pedem login da Vercel. **Mande a ela
  o endereço principal.** Desligar a proteção de vez segue sendo decisão do Júlio.
- [ ] Lembrete: se o repositório voltar a privado, o deploy trava de novo.
