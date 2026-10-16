---
tipo: conversa
data: 2026-10-13
projeto: "[[Cérebro da Lube]]"
departamento: TI
status: resumido
tags: [conversa, cerebro, painel, camera, gestos, mediapipe]
---
# 2026-10-13 — Modo Mãos, o cérebro controlado pela câmera

## Resumo
O Júlio pediu "uma mudança ousada": o sistema **capta os movimentos das mãos pela câmera** e usa como um mouse
para selecionar e abrir, com **animações de partículas** que seguem as mãos. O painel do robô ganhou o **Modo
Mãos**. Ele funciona no **arquivo baixado** (`Cerebro da Lube.html`, no Chrome ou Edge), porque o claude.ai não
libera câmera para páginas publicadas: lá o botão explica isso. Continuação de
[[2026-10-13 — Aba Rotinas e o funil do fluxo no cérebro]].

## Decisões
- 2026-10-13 (Júlio): controlar o cérebro com as mãos pela câmera, com partículas.
- 2026-10-13 (Claude): reconhecimento pelo **MediaPipe** do Google (`@mediapipe/tasks-vision@0.10.14`, GestureRecognizer),
  que roda **dentro do navegador**: a imagem da câmera **não sai do computador** e nada é gravado. O modelo (8,4 MB)
  é baixado pelo navegador só na primeira vez que se liga a câmera.
- 2026-10-13 (Claude): **a câmera nunca liga sozinha**: só no botão Mãos → Ligar câmera; nada do MediaPipe é carregado
  enquanto o modo está desligado (conferido numa aba nova).
- 2026-10-13 (Claude): no claude.ai a conta não tem capability de câmera e o frame bloqueia o download do modelo,
  por isso o Modo Mãos é do arquivo baixado. Não é escolha, é limite da plataforma.

## Como funciona
- **Gestos:** mover a mão = cursor holográfico (o robô olha para ele); **pinça** (polegar + indicador) = clicar e
  abrir; **pinça segurada e arrastar** = rolar o texto ou o funil, arrastar o mapa; **mão aberta parada** (depois de
  fechada por um instante) = fechar, como o Esc; **mão aberta deslizando** = trocar de aba ou de rotina; **punho** =
  segurar a cabeça do robô; **joinha** = o robô comemora; **V de vitória** = alterna robô e mapa em anéis.
- **Partículas:** rastros saindo das pontas dos dedos, nas cores da Lube, mais fortes com a mão rápida; faíscas na
  pinça, onda de choque na mão aberta, confete azul, vermelho e branco no joinha. Os neurônios da cúpula acendem e se
  afastam quando a mão passa e se juntam na pinça.
- **Cartão da câmera:** vídeo espelhado com o esqueleto da mão em holograma, o gesto atual, quadros por segundo,
  botões de esconder o vídeo, ajuda e desligar. A ajuda dos 7 gestos aparece sozinha na primeira vez.
- **Limites do navegador:** pela mão não dá para abrir o Obsidian, escolher a pasta do vault nem links externos (o
  navegador exige clique de verdade); a página avisa com uma frase.
- Código: `js/maos.js` (câmera, MediaPipe, filtros, gestos, mouse sintético, simulador) e `js/efeitos-maos.js`
  (partículas, cursor, cartões); versão 6 do artifact. O arquivo baixado é gerado com o `empacotar.py`, que junta
  todos os módulos num `.html` só (~700 KB).

## Armadilhas que valem lembrar
- O navegador interno do app não tem câmera: todos os gestos foram testados com um **simulador** (mão de mentira
  guiada pelo mouse e pelo teclado, `?maos=simular`, só em localhost ou arquivo local) e com o MediaPipe de verdade
  carregando o modelo e reconhecendo uma imagem vazia. **Falta o teste com a webcam real.**
- Dois defeitos achados na revisão, antes de publicar: o clique virava arraste quando os dedos se separavam (o cursor
  agora fica preso no ponto da pinça) e o painel recém-aberto fechava sozinho quando a pessoa relaxava a mão aberta
  (o "fechar" agora só arma com a mão fechada antes).

## Pendências
- [ ] Júlio: testar com a webcam real e dizer o que ajustar (sensibilidade da pinça, tamanho da área da mão, velocidade do deslizar).
- [ ] Ideia: o cartão da câmera fica sobre o queixo do robô com o leitor aberto em telas de ~1366 px; ajustar se incomodar.
