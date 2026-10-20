---
tipo: conversa
data: 2026-10-19
projeto: "[[JARVIS DA LUBE]]"
status: resumido
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

## No caminho
- A sessão do Claude fechou com o fluxo de agentes no meio: a pesquisa (`docs/OUVIDO-E-ROSTO.md`) e o servidor do
  rosto (`servidor/rosto.js`, 132 de 132 verificações) ficaram prontos; o resto foi **retomado** do ponto em que parou,
  com o aviso aos agentes de que havia trabalho pela metade nos arquivos.
- **Tropeço do backup:** entre 10:25 e 10:32 o backup do cérebro, rodado por outras conversas, usou `git add -A` e
  levou junto o código pela metade do ouvido e do rosto, com o nome "Cérebro: atualização" (3 commits, só no
  computador: nada subiu, o repositório segue público). Corrigido no commit `2265523`: o backup agora registra **só a
  pasta `vault/`** e avisa o que ficou fora.

## O que foi construído
Fluxo de 9 agentes (pesquisa, 4 construtores em arquivos separados, integração, 2 revisões, correção), sem erro.
Detalhes em [[JARVIS DA LUBE]] (seções Ouvido e Trava do rosto).
- **Ouvido:** Chrome sem janela, controlado por pipe, perfil em `%LOCALAPPDATA%\CerebroLube\ouvido-chrome`;
  reconhece offline; só abre com o microfone ligado. Achado da pesquisa: o pacote pt-BR sozinho não funciona
  (`aborted`, "Unable to find SODA files"); precisa de pt-BR + en-US, cerca de 300 MB.
- **Trava do rosto:** face-api 1.7.15 (descritor) + MediaPipe FaceLandmarker 0.10.14 (pontos e piscar); comparação no
  servidor (limiar 0,45); 423 no turno, no confirmar e no ligar do ouvido até liberar; Windows Hello de reserva. O
  Human 3.3.6 ficou de fora: confundia pessoas diferentes e era 9 vezes mais lento.
- **Revisões:** 18 achados (2 graves: o simulador do rosto funcionava no app de verdade, e a câmera ficava ligada sem
  prazo quando não havia rosto); 17 corrigidos, 1 era sobra de teste.
- **Testes, rodados de novo pelo Claude principal:** geral 128/128, cérebro 37/37, rosto 168/168, ouvido 81/81 (com o
  Chrome de verdade transcrevendo a frase gravada), ouvido remoto 159/159, integração 49/49. Nenhum Chrome de teste
  sobrou; a pasta real do rosto nunca foi criada pelos testes.
- Commits `599ee6b` e `efa3459` (local). O link do claude.ai continua na versão 8: ouvido e rosto só existem no app.
- O Júlio **não tem PIN do Windows Hello** nesta conta (`NgcSet: NO`), então a reserva só funciona depois de criar.
- O pesquisador abriu o microfone real duas vezes por 0,2 s, só para ver se o Chrome sem janela enxerga o microfone;
  nada foi gravado nem transcrito.

## 2026-10-20 — O Jarvis se ouvindo
- O Júlio perguntou onde abrir: `Desktop\BI\13. CEREBRO\INICIAR.bat`. No primeiro uso real: "o jarvis está escutando ele
  mesmo falar kkk preciso que quando ele estiver falando o microfone feche, e só abra quando eu clicar o botão de
  interromper". Ou seja, o ouvido do Chrome funcionou com a voz dele, mas sem fone o alto-falante voltava pelo microfone.
- Decisão (Júlio): **sem fone, um fala de cada vez**. Feito pelo Claude: enquanto o Jarvis fala (e 0,45 s depois) o
  que o microfone ouve é descartado; o botão Parar virou **Interromper**; o Espaço também abre; quando ele termina, o
  microfone abre sozinho (decisão do Claude, para a conversa não travar). De fone, a voz continua interrompendo.
- Testado no navegador do app com o simulador, num servidor de teste na porta 8791 (configuração nova `jarvis-teste`):
  todos os casos certos, nenhum erro no console. Commit `2af99ea` (local).

## Pendências
- [x] 2026-10-20 — Jarvis se ouvindo pelo alto-falante: microfone fecha enquanto ele fala — Claude
- [x] Construção do ouvido no Chrome e da trava do rosto — Claude
- [ ] Reabrir pelo `INICIAR.bat`, ligar o microfone e baixar o pacote de voz (cerca de 300 MB, uma vez) — Júlio
- [ ] Cadastrar o rosto (aparece sozinho), com boa luz — Júlio
- [ ] Criar o PIN do Windows Hello e cadastrar o Hello nos Ajustes do Jarvis — Júlio
- [ ] Mudar o `CELEBRO-LUBE` para privado (aí o código novo e o vault sobem) — Júlio
- [ ] Decidir se o "confirmar" do e-mail passa a exigir o Windows Hello (proteção de verdade contra quem tiver uma foto) — Júlio
