---
tipo: app
departamento: TI
status: em uso
tags: [aplicacao, cerebro]
---
# Obsidian

Onde o [[Cérebro da Lube]] é visto e editado. Esta pasta inteira é o vault. A visão de grafo mostra as ligações entre as notas.

## Como está configurado (conferido em 2026-10-09)
- Configuração do vault em `.obsidian/`, criada em 2026-09-23. **Só plugins nativos** (grafo, backlinks,
  propriedades, modelos, notas diárias, bases, sync etc.); **nenhum plugin da comunidade**. A última vez que o
  Obsidian salvou a área de trabalho foi em 2026-10-02.
- O Obsidian não mostra pastas que começam com ponto. A `.claude/` do vault guarda só configuração do Claude Code
  (o `launch.json` dos servidores locais, ver [[Claude]]), não nota.
- Quem escreve as notas, quase sempre, é o [[Claude]], direto na pasta do OneDrive. O Obsidian é para ler e
  ajustar.

## Cuidados com os arquivos
- **Nome de nota sem `:`.** O Windows não aceita dois-pontos em nome de arquivo: a gravação falha ou sobra um
  arquivo cortado e vazio (aconteceu em 2026-09-23; em 2026-10-09 ainda havia em `Conversas/` um arquivo vazio,
  sem `.md`, chamado `2026-10-05 — Documento no mês errado`). Use `—` ou `,` no lugar.
- Wikilink aponta pelo nome da nota. Renomear fora do Obsidian (o Claude, direto no disco) **não atualiza os
  links**: é preciso trocá-los junto, como foi feito de SAQ para [[SAC]] em 2026-10-09.
