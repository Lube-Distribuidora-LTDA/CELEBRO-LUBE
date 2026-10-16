---
tipo: conversa
departamento: TI
origem: claude.ai
data: 2026-09-23
projeto: "[[Cérebro da Lube]]"
status: resumido
tags: [conversa, cerebro]
---
# 2026-09-23 — criação do Cérebro da Lube

## Resumo
Partindo de um vídeo sobre "segundo cérebro" (painel Playbook Lab), decidimos criar o [[Cérebro da Lube]]: um vault do Obsidian no OneDrive como memória oficial de conversas, skills, projetos, preferências e conceitos. Foi feito um protótipo de painel em anéis e um kit com servidor local e scripts, mas ficou complicado demais. Voltamos ao simples: o Claude grava as notas direto nesta pasta.

## Decisões
- 2026-09-23: pasta oficial = OneDrive › CEREBRO DA LUBE, aberta no [[Obsidian]].
- 2026-09-23: o Claude grava no cérebro pelo conector do Microsoft 365, ao final de cada conversa relevante ([[registrar-conversa]]). _Vale para o claude.ai. No Claude Code, no computador do Júlio, o Claude grava direto na pasta sincronizada do OneDrive desde o mesmo dia (ver [[Claude]])._
- 2026-09-23: sem servidor local, scripts ou Cowork por enquanto. O visual é o grafo do próprio Obsidian.

## Lições
- O zip do kit criou pastas aninhadas e quebrou os nomes com acento no Windows. Não usar zip para montar o vault.
- Pedir para o Cowork montar tudo gerou duplicatas. Preferir o Claude gravando direto.
- Ver [[Como trabalhar comigo]]: simples primeiro, fazer em vez de explicar.

## O que foi criado
- [[CLAUDE.md]]: mapa e regras do cérebro
- Skills: [[data-warehouse]], [[registrar-conversa]]
- Preferências: [[Como eu gosto dos BIs]], [[Como trabalhar comigo]]
- Memória: [[Mapa de sistemas]], [[BI COMPRAS]]
- Protótipo do painel: https://claude.ai/artifact/Tnrde74sov8LPGmgj8yjT4

## Pendências
- [ ] Colar a instrução do cérebro nas preferências do Claude
- [x] 2026-09-23 — Trazer as conversas antigas: veio o export do Claude (6 conversas; 5 vazias, sem título nem texto). Ver [[Cérebro da Lube]].
- [x] 2026-10-09 — Apagar as cópias antigas do kit no OneDrive: conferido, não há mais cópia (só o vault tem as pastas `Conversas/`, `Skills/` e `Preferências/`, e não há zip recente).
