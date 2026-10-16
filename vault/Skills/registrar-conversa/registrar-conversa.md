---
name: registrar-conversa
description: Usar ao final de toda conversa relevante, ou quando pedirem "registra", para salvar a conversa como nota no Cérebro da Lube e atualizar as notas que ela afeta.
tipo: skill
---
# registrar-conversa

Transforma uma conversa em memória permanente do [[CLAUDE.md|Cérebro da Lube]].

## Onde salvar
Pasta `Conversas/`, arquivo `AAAA-MM-DD — assunto.md`, com a **data em que o trabalho começou**, não a do registro (decisão de 2026-09-23). O nome **nunca leva `:`** (o Windows recusa e pode deixar um arquivo vazio com o nome cortado; use `—` ou `,`). Se a conversa for continuação de uma já registrada, atualize a nota existente em vez de criar outra.

## O que fazer
1. Escrever a nota com o modelo abaixo.
2. Para cada decisão, preferência ou informação durável, atualizar a nota do assunto (projeto, BI, sistema, cliente) e ligar de volta para a conversa.
3. Se algo se repete, sugerir uma skill nova (`Skills/`) ou uma rotina (`Rotinas/`).
4. Se o usuário mostrou uma preferência nova, registrar em [[Como trabalhar comigo]] ou [[Como eu gosto dos BIs]].
5. Nunca gravar senhas, tokens ou chaves.
6. **Toda mudança (código, banco, Vercel, agendamento, decisão) entra no `## Histórico de mudanças` da nota do
   sistema e no [[Registro de mudanças]].** Uma linha no topo da seção, do mais novo para o mais antigo:
   `- **AAAA-MM-DD** — o quê (Júlio ou Claude) (commit, deploy, migração) · [[conversa]]`. Nota de sistema sem a
   seção ganha uma, aberta com "Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os
   sistemas em [[Registro de mudanças]]." Pedido do Júlio em 2026-10-09: "preciso que tudo que eu fiz de mudança
   seja anotado dentro do cérebro" — sem esperar pedido.
7. **Rodar o backup do cérebro** depois de gravar (desde 2026-10-16, pedido do Júlio: "atualize toda vez que for
   guardar alguma coisa"): `python -I -X utf8 "C:\Users\gti.julio.alves\Desktop\BI\13. CEREBRO\ferramentas\atualizar_repositorio.py" --autor claude`
   (ou o `ATUALIZAR REPOSITORIO.bat` da mesma pasta). Copia o vault para o repositório `CELEBRO-LUBE`, confere segredos
   e só sobe se o repositório for privado. Se ele parar acusando segredo, tire o segredo da nota e rode de novo.
8. **Nota com dado de pessoa** (salário, base de IR, plano de saúde, afastamento, CPF de alguém com nome) leva
   `repositorio: nao` no frontmatter: fica no OneDrive e não vai para o GitHub ("dado de pessoa não vai para o
   repositório").

## Modelo
```
---
tipo: conversa
data: AAAA-MM-DD
projeto: "[[Nome do projeto]]"
status: resumido
tags: [conversa]
---
# AAAA-MM-DD — assunto

## Resumo
Uma ou duas frases sobre o que foi feito.

## Decisões
- AAAA-MM-DD: decisão, e por quê

## O que foi criado ou mudou
- [[Nota ou projeto]]: o que mudou

## Pendências
- [ ] próxima ação, responsável
```
