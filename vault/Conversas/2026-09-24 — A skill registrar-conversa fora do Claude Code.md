---
tipo: conversa
departamento: TI
data: 2026-09-24
projeto: "[[Cérebro da Lube]]"
status: resumido
tags: [conversa, cerebro, skill, claude-code]
---
# 2026-09-24 — A skill registrar-conversa fora do Claude Code

## Resumo
Numa conversa aberta na própria pasta do cérebro (de 2026-09-24 a 2026-10-01: a da
[[2026-09-24 — Validação de folha do Administrativo|validação de folha]] e do [[SISTEMA FINANCEIRO]]), o Júlio
pediu várias vezes para registrar tudo no cérebro ("escreve tudo no celebro"). Chamar a skill
[[registrar-conversa]] pelo nome deu **"Unknown skill"** duas vezes (2026-09-24 e 2026-09-30): ela existe só
como nota no vault, **não está instalada no Claude Code**. Em 2026-09-25 o Júlio colou o texto da skill na
conversa, e o Claude passou a seguir a nota à mão.

## Decisões
- 2026-09-25 (Júlio): quando a conversa continua uma já registrada, **atualizar a nota existente** em vez de
  criar outra; uma nota por dia e assunto em `Conversas/`, com o modelo da skill.

## O que foi criado ou mudou
- 2026-09-25: registro completo seguindo a skill colada: [[2026-09-25 — Sistema Financeiro no ar]] reescrita,
  rotina nova [[Validação mensal da folha]], [[Como trabalhar comigo]], link de continuação na nota de
  2026-09-24 e [[Mapa de sistemas]].
- 2026-09-30: os wikilinks das notas novas foram conferidos por script — nenhum quebrado. Naquele dia, 14 notas
  do vault citavam o [[SISTEMA FINANCEIRO]].
- O Júlio trocou o modelo duas vezes nessa conversa (ver [[2026-09-10 — Modelo padrão do Claude Code]]).

## Lições
- Em 2026-10-09 a lista de skills do Claude Code mostrava a `data-warehouse` como skill da conta e **nenhuma
  `registrar-conversa`**. O Claude lê `Skills/registrar-conversa/registrar-conversa.md` (não existe `SKILL.md`).

## Pendências
- [ ] Instalar a `registrar-conversa` como skill da conta, como a `data-warehouse`, para o Claude Code achar
  pelo nome — Júlio decide (sugestão do Claude)
