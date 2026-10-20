---
tipo: conversa
data: 2026-10-20
projeto: "[[JARVIS DA LUBE]]"
status: em andamento
tags: [conversa, jarvis, agente, camera, navegador, planilha, construtor]
---
# 2026-10-20 — Jarvis que executa, o sistema nativo

## Resumo
O Júlio quer que o [[JARVIS DA LUBE]] deixe de só ler e responder e passe a **executar**, como um sistema nativo:
ver pela câmera, abrir site e mostrar o print num cartão, fazer anotações, mexer em pastas, criar planilhas, BI e site,
tudo por voz. Decididos os limites (abaixo) e iniciado um fluxo de 9 agentes para construir.

## Pedido (palavras do Júlio)
"preciso que o Jarvis seja um sistema operacional que seja mais que leitura e resposta, quero que ele seja literalmente
um sistema nativo, execute muito mais. por exemplo (quero mais que isso): Abrir a Câmeras e reconhecer meu rosto ou apenas
abrir minha câmera e conversar comigo me vendo; acessar site e tirar print ou trazer ás informações em Card organizado ou
tirar um print do local e me mostrar em janelinha (card); quero pedir pra ele fazer anotações e mexer em pastas, criar
planilhas, BI, site, tudo!!!; quero poder falar com ele e ele conseguir executar. intendeu, sistema totalmente fora da
curva."

## Decisões
- 2026-10-20 (Júlio): o Jarvis **cria e mexe só na pasta própria** `OneDrive - Lube\JARVIS` (Anotações, Planilhas,
  Prints, Projetos, Arquivos). Continua lendo o que já lia (cérebro, OneDrive, `P:`). As anotações dele ficam nessa
  pasta, não no vault.
- 2026-10-20 (Júlio): **aprovação por voz, sem clique**: "ele mostra um cartão só que não quero clicar em nada, apenas
  falando se ta aprovado ou não e ele aprova altomaticamente". Criar é livre; mudar, mover, renomear, apagar (sempre
  para a Lixeira), mandar e-mail, preencher formulário em site e começar uma construção pedem o "aprovado" falado. Para o
  eco não aprovar sozinho, a aprovação só vale com o Jarvis calado (Claude).
- 2026-10-20 (Júlio): **construtor de site, BI e programa** = um Claude Code dentro do Jarvis (pacote
  `@anthropic-ai/claude-agent-sdk` 0.3.290), com o **Sonnet 5.5** e **aviso de custo** antes de começar; pasta isolada
  por projeto; dados só de leitura.
- 2026-10-20 (Claude): câmera **"Ver você"**: o Júlio liga, aparece uma janelinha com a imagem dele, e o Jarvis só
  "olha" (manda uma foto ao Claude) quando a conversa pede; nenhum quadro vai para disco ou log.
- 2026-10-20 (Claude): **navegador** = um Chrome escondido próprio, sem login em site nenhum (nunca digita senha), sem
  download; o print vai para `JARVIS\Prints` e aparece numa janelinha; conteúdo de site é dado, nunca instrução.
- 2026-10-20 (Claude): planilhas com `exceljs` 4.4.0; atalho do Windows **Ctrl+Alt+J** por um `CRIAR ATALHO.bat` que o
  Júlio roda.

## Pendências
- [ ] Construção pelo fluxo de 9 agentes (pesquisa, 4 construtores, integração, 2 revisões, correção) — Claude
- [ ] Depois: reabrir pelo `INICIAR.bat`, rodar o `CRIAR ATALHO.bat` e testar cada coisa por voz — Júlio
