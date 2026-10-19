---
tipo: conversa
data: 2026-10-19
projeto: "[[JARVIS DA LUBE]]"
status: em andamento
tags: [conversa, jarvis, voz, edge, chrome, rosto, seguranca]
---
# 2026-10-19 — Jarvis surdo no Edge e o desbloqueio pelo rosto

## Resumo
O Júlio falava com o [[JARVIS DA LUBE]], a onda do microfone mexia, mas nada era transcrito e ele não respondia. O
Claude provou que a culpa é do **reconhecimento de voz do Edge**, que passou a devolver resultado **vazio**. Decisão:
**o Edge continua falando (voz Antônio), e um Chrome escondido ouve**, com o reconhecimento offline do Chrome. Junto,
o pedido novo: na primeira conversa do dia, o Jarvis abre a câmera, reconhece o rosto do Júlio com uma animação e só
então libera.

## Pedido (palavras do Júlio)
"o Javes não está me respondendo. Aparece como se eu estivesse falando mesmo, mas ele não me responde. Não aparece nem
o que eu estou falando [...] na caixinha de texto." E: "quando eu falar com ele, a primeira conversa do dia, ele abre a
câmera, faz um reconhecimento do meu rosto e animação, e aí ele libera o sistema de Jarvis".

## Diagnóstico (provado nesta máquina)
- O código do Jarvis não mudou desde 2026-10-16. O **Edge atualizou em 2026-10-18** (155.0.4283.45 → 155.0.4283.62).
- Teste válido: uma página toca uma frase gravada (voz Maria do Windows) e entrega essa trilha de áudio ao
  reconhecedor. **Edge:** ouve, mas devolve `""` a cada 3 s, em português e em inglês, nos dois modos (comum e com a
  trilha). **Chrome 155 offline** (`processLocally`): transcreveu ao vivo, com parciais — "está tudo rodando hoje",
  "quais e-mails chegaram na caixa do ti"; o primeiro texto aparece ~1,2 s depois de começar a fala.
- O Jarvis ignora resultado vazio, por isso nada aparecia e nada era enviado ao Claude.
- Falha conhecida do Edge: a interface existe, mas às vezes não devolve nada (relatos de 2020 a 2026, inclusive
  Edge 147 em abril de 2026 em outros países).
- O pacote offline de português do Chrome tem **~103 MB**, baixa uma vez (8 a 48 s) e depois funciona sem internet:
  a fala não sai do computador.
- Primeiro teste com o "microfone falso" do navegador não valia (o Chrome não recebe esse áudio); refeito com a trilha
  da página. 35 processos de teste que tinham sobrado foram fechados.

## Decisões
- 2026-10-19 (Júlio): **"Edge fala, Chrome ouve"**: o Jarvis segue no Edge com a voz Antônio; um Chrome escondido,
  ligado pelo app, faz o reconhecimento offline em pt-BR. Usar fone (o Chrome não cancela o eco da voz que sai pelo Edge).
- 2026-10-19 (Claude): o rosto é **reconhecimento de verdade** (cadastro uma vez; na primeira abertura do dia confere
  se é o Júlio, com piscar como prova de vida), e a liberação é conferida **no servidor**, não só na tela. Reserva:
  **Windows Hello**. Dado biométrico só em `%LOCALAPPDATA%\CerebroLube\rosto\` (fora do repositório, do vault e do
  OneDrive); nenhum quadro de vídeo é salvo.
- 2026-10-19 (Claude): nada sobe para o GitHub enquanto o `CELEBRO-LUBE` for público: os commits do vault estão na
  frente e iriam junto ([[2026-10-16 — Backup do cérebro no GitHub]]).

## Pendências
- [ ] Construção do ouvido no Chrome e do desbloqueio pelo rosto (fluxo de agentes em andamento) — Claude
- [ ] Mudar o `CELEBRO-LUBE` para privado — Júlio
