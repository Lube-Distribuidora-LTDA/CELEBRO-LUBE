---
tipo: app
status: em uso
tags: [aplicacao, email, imap, smtp]
---
# Locaweb

Hospeda o e-mail `@lube.com.br`. O [[GESTÃO TI]] lê a caixa `cpd@lube.com.br` por IMAP e envia cobrança por SMTP.
O [[SAC]] envia pela caixa `sac@lube.com.br` (do SAC), com o nome do RCA como remetente, e guarda a cópia em
Enviados dela por IMAP. Senhas nunca entram aqui — ficam no `.env.local` da máquina e nas variáveis da [[Vercel]]. Ver [[Como trabalhar comigo]].

## Dados de conexão
| | |
|---|---|
| Host (IMAP e SMTP) | `email-ssl.com.br` |
| IMAP | porta 993, TLS |
| SMTP | porta 465, TLS |

O host é `email-ssl.com.br` para todo mundo: o certificado cobre `*.email-ssl.com.br`, então `imap.lube.com.br` **quebra a validação TLS**.

## O que o servidor não faz
- **`SEARCH SINCE` devolve resultado errado.** Uma busca por "últimos 50 dias" trouxe correspondência de sete meses antes e nenhuma das notas recentes. Por isso o robô percorre a caixa pelo fim, em ordem de chegada, e corta pela data interna de cada mensagem. `SEARCH FROM` tem o mesmo problema — devolveu a caixa inteira.
- **Não tem `ACL`.** Uma conta não enxerga a caixa de outra: o `NAMESPACE` publicado é só a árvore pessoal de quem entrou. Para procurar em `lube@` ou `financeiro@` é preciso a senha daquela conta — daí o `scripts/procurar-em-outra-caixa.mjs`, que lê a senha do ambiente.
- **SMTP só transmite.** Quem grava a cópia em Enviados é o programa de e-mail, por IMAP (`APPEND`). Sem isso a cobrança sai de verdade e não aparece no webmail — o que deu a impressão de que nada estava sendo enviado.

## Tamanho da caixa
A `cpd@lube.com.br` tem cerca de **122 mil mensagens em 30 pastas**, com ~50 novas por dia. Varrer tudo numa conexão só derruba o servidor no meio (`ECONNRESET`): a varredura é feita uma pasta por conexão. Foi o que aconteceu em 2026-09-18, na varredura das 122.796 mensagens: desde então o `scripts/procurar-em-outra-caixa.mjs` abre uma conexão nova a cada pasta e, se uma falhar, segue para a próxima.

## Cuidados com as senhas
- **`cpd@` e `lube@` usam a mesma senha** (constatado em 2026-09-18; o fato, não o valor). Pendência: trocar as duas e não repetir senha entre contas — ver [[GESTÃO TI]].

A `lube@lube.com.br` tem cerca de 11 mil, em 6 pastas.

Veja também [[GESTÃO TI]] e [[Mapa de sistemas]].
