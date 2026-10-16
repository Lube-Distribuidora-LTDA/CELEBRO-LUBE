---
name: video-motion
description: Usar ao criar, ajustar ou refazer qualquer vídeo animado da Lube (motion, vinheta, vídeo de apresentação narrado, telão de evento) — do roteiro e da voz à gravação em MP4, à revisão independente e à entrega em Downloads.
tipo: skill
departamento: Marketing
status: ativo
tags: [skill, video, motion, narracao, animacao]
---

# video-motion — como a Lube faz um vídeo animado

Este é o manual do caminho que já fez três vídeos. Todo vídeo novo segue a mesma trilha: **o vídeo é uma página web
que sabe se desenhar em qualquer instante (`seek(t)`); um Chrome sem janela fotografa cada quadro (60 por segundo) e o
ffmpeg junta tudo num MP4.** Nada depende do relógio do computador: o mesmo `t` dá sempre o mesmo quadro. Por isso dá
para gravar em pedaços, em paralelo, e regravar só um trecho.

O [[VÍDEO LUBE ONLINE]] é a referência viva. Quando algo aqui estiver ambíguo, abra
`Desktop\BI\14. VIDEO LUBE ONLINE\` (leia o `LEIA-ME.md`) e copie o padrão de lá.

Ligações no cérebro: [[VÍDEO LUBE ONLINE]] · [[VÍDEO WORKSHOP LUBE]] · [[VINHETA CPG]] · [[Como trabalhar comigo]] ·
[[Pasta de fotos FOTOS_ION]] · [[JARVIS DA LUBE]] (a mesma família de vozes) · [[Claude]]

_No Claude Code esta skill não está instalada (como a [[registrar-conversa]]): leia esta nota e siga à mão._

---

## 1. Os três vídeos, lado a lado

| Vídeo | Data | Duração | Motor | Som | O que ensinou |
|---|---|---|---|---|---|
| [[VÍDEO WORKSHOP LUBE]] | 2026-10-01 | 1 min 57 s | WebGL (shaders) | sem som (não foi pedido) | recorte de logo com regra por logo; um fundo elegante só; 2 rodadas de revisão (55 defeitos) |
| [[VINHETA CPG]] | 2026-10-02 | 6,5 s | WebGL2 3D | sintetizado, com e sem som | 3 roteiros e um juiz; storyboard com o tempo de cada coisa; recortes da própria arte, nada baixado da internet |
| [[VÍDEO LUBE ONLINE]] | 2026-10-15 | 2 min 33 s | HTML/CSS | narração + trilha sintetizada | tudo no tempo da fala; gravação retomável fora da sessão; revisão contra o PDF de origem |

**Qual motor:** HTML/CSS quando há texto, tela de sistema, celular, foto de produto (sai nítido e é fácil de mexer).
WebGL quando o vídeo é 3D, partículas, brilho, material (mármore, logo extrudada). O resto do caminho é igual.

---

## 2. Antes de começar

Leia a nota do pedido no cérebro antes de perguntar. O que precisa estar claro:

1. **A fonte** (PDF, apresentação, zip de logos, arte). **É ela que manda nos fatos.**
2. **A referência de estilo**, se houver (um vídeo, uma imagem). O vídeo segue o conteúdo da fonte e o ritmo da
   referência ([[Como trabalhar comigo]], 2026-10-15).
3. **Onde vai passar** (telão, reunião, YouTube, redes): define duração, volume e se sai também uma versão sem som.
4. **Narrado ou não.** Vídeo de apresentação é narrado, explicativo e impactante. Se a proposta é um sistema, mostre a
   tela dele funcionando, com produto de verdade, e não só texto.
5. **O que o Júlio aprovou fica como está**, nem para melhorar um detalhe (Workshop, 2026-10-01).

"Notion" num pedido de vídeo é *motion* (Workshop). Mostre o visual cedo: uma prancha de quadros antes de gravar tudo.

---

## 3. Onde mora

- **Projeto:** `Desktop\BI\<n>. VIDEO <NOME>\` (o próximo número livre; em 2026-10-16 o último é `14`). A pasta `BI` foi a
  que sobreviveu quando as pastas do Workshop e da Vinheta sumiram da Área de Trabalho (até 2026-10-09). **Nunca deixe o
  projeto só na pasta temporária do Claude**: o Windows limpa.
- **Vídeo pronto:** em `Downloads`, **sem sobrescrever** (acrescenta `(2)`, `(3)`…). Uma cópia fica em `out\` do projeto.
- **Nota:** `Projetos/<NOME DO VÍDEO>.md`, no modelo do [[VÍDEO LUBE ONLINE]] (O vídeo, Onde estão as coisas, Como foi
  feito, Decisões, Erros e incidentes, Pendências, Histórico de mudanças).

```
roteiro.json        texto da narração, voz, BPM e cenas
GERAR VIDEO.bat     refaz tudo com dois cliques
LEIA-ME.md          como regravar e como mudar
tools\voz.py        narração + tempo de cada palavra
tools\tempo.py      linha do tempo na grade da música
tools\render.js     prévia, quadros soltos, eventos de som e gravação
tools\som.py        trilha, efeitos, mixagem e -14 LUFS
tools\montar.py     junta vídeo e som, copia para Downloads
tools\revisao.py    pranchas de revisão do MP4
tools\assets.py     fotos dos produtos (tira o fundo branco) e dados ilustrativos
web\                index.html, css\, js\motor.js, ui.js, cenas1-3.js, main.js, assets\ (fontes locais)
audio\  out\  qa\
```

**Vídeo novo:** copie a pasta do Lube Online **sem** `out\`, `qa\`, `audio\` e `node_modules\`, rode `npm install`,
troque o `roteiro.json`, reescreva as cenas, ajuste `PROG` e `ESTILO` no `som.py` e o nome do arquivo no `montar.py`.

**Precisa ter na máquina:** Node (com `npm install` na pasta, para o `puppeteer-core`), Python com `edge-tts`, `numpy`,
`scipy`, `pyloudnorm`, `pillow` e `imageio-ffmpeg`, o Google Chrome e internet (a voz é um serviço do Edge).

---

## 4. O caminho, do zero à entrega

No PowerShell, dentro da pasta do projeto, **um comando por vez** (o Júlio usa PowerShell: `&&` não funciona lá).
Com `$env:PYTHONIOENCODING = "utf-8"` antes, os acentos não quebram. O `GERAR VIDEO.bat` roda de uma vez os comandos
dos passos 2 a 9 (voz, linha do tempo, efeitos, trilha, gravação e montagem; ~25 min).

### 1. Roteiro (`roteiro.json`)
- Leia a fonte inteira e **extraia o texto do PDF para `qa\proposta_texto.txt`**: é ele que os revisores usam para
  conferir cada número.
- Uma ideia por cena, na ordem da fonte. Corte tabela com campo em branco (`[__]`) e detalhe; do número fica o forte
  (no Lube Online, só "R$ 0,80 por PIX" da tabela de custos).
- Escreva a fala **como se fala**: "sessenta e sete anos", "B dois B", "vinte e quatro horas". Número em algarismo a
  voz pode ler errado.
- Vídeo curto sem fala (vinheta) usa um `STORYBOARD.md` com o tempo de cada acontecimento, em segundos e quadros.
  Quando a ideia está aberta, peça 3 roteiros e um juiz com nota (beleza, marca, ritmo, viabilidade, restrições), como
  na [[VINHETA CPG]].

```json
{ "voz": "pt-BR-AntonioNeural", "taxa": "+10%", "tom": "-2Hz", "bpm": 120,
  "cenas": [
    { "id": "abertura", "compassos_min": 3, "entrada": 0, "falas": [] },
    { "id": "legado", "entrada": 0.5, "falas": [ { "id": "legado", "texto": "Desde 1959, a Lube abastece..." } ] }
  ] }
```

### 2. Voz — `python tools\voz.py`
- `edge-tts`, voz neural grátis do Edge. Padrão `pt-BR-AntonioNeural`, `+10%`, `-2Hz`. Femininas:
  `pt-BR-FranciscaNeural` e `pt-BR-ThalitaMultilingualNeural`. Trocar é uma linha no `roteiro.json`.
- Pede `boundary="WordBoundary"` e grava **o tempo de cada palavra** em `audio\voz\<id>.json`. Só gera de novo o trecho
  cujo texto mudou (`--tudo` refaz todos).

### 3. Linha do tempo — `python tools\tempo.py`
- 120 BPM: batida de 0,5 s. **Toda cena começa num tempo forte** e dura um número inteiro de segundos:
  entrada + fala + 0,55 s de respiro, arredondado para cima (ou `compassos_min`, se for maior).
- Cada palavra ganha o seu tempo global. Sai em `web\timeline.js` (para as cenas) e `audio\timeline.json` (para o som,
  a revisão e para saber os segundos de cada cena).
- A **revelação da marca** é especial: 4 compassos, o *drop* da música no começo do 3º, e a fala é deslocada para que a
  palavra "Lube" caia **exatamente no drop** (49,0 s no Lube Online).

### 4. Cenas (`web\js\cenas*.js`)
Cada cena é um `M.cena(id, { antes, depois, build, update })`. O `build` cria os elementos uma vez; o `update` só
calcula posição e opacidade a partir de `t`.

```js
M.cena('pix', {
  antes: 0.3, depois: 0.3,                       // aparece 0,3 s antes e some 0,3 s depois da cena
  build(r, c) {
    this.valor = el('div', 'abs', 'R$ 0,80', r);
    this.tVal = q(w('pix', 'oitenta'));          // quando o narrador diz "oitenta", na colcheia mais próxima
    sfx(this.tVal, 'impacto', { forca: 0.7 });   // e o som é pedido no mesmo instante
  },
  update(lt, c, t) {
    const k = p(t, this.tVal, 0.6, E.outBack);   // progresso de 0 a 1 com curva
    st(this.valor, { op: k, s: 0.8 + 0.2 * k });
  },
});
```

Regras:
- **Determinístico.** Nada de `Date.now()`, `requestAnimationFrame`, `transition`/`animation` do CSS ou
  `Math.random()` sem semente. Aleatório com semente fixa (o Lube Online usa 1959).
- **Tudo entra no tempo de uma palavra**: `q(w('cena', 'palavra'))`. Se o texto mudar, a animação acompanha sozinha; se
  a palavra sumir do roteiro, o `w()` dá erro na hora (melhor que animar no lugar errado).
- **Curva devolve 0 e 1 exatos nas pontas.** O `outBack` dava 2e-16 em `t = 0` e um aviso de erro apareceu antes da hora;
  na Vinheta, um z de ±1e-15 sumia a face do card (compare com tolerância: `Math.abs(z) < 1e-6`).
- **Meça posição só depois de fontes e imagens carregadas** (`document.fonts.load`, `img.decode()`, no `main.js`). A placa
  da logo do final ficou 126 px fora do centro porque era medida antes de a imagem chegar.
- **Fontes locais** (`web\assets\fontes`, licença OFL: Plus Jakarta Sans e Inter no Lube Online; Cinzel, Cormorant
  Garamond e Montserrat no Workshop), nunca da internet na hora de gravar.
- A página expõe `window.seek(t)`, `window.PRONTO`, `window.ERRO` e `window.EVENTOS`. Fora do modo `?render`, mostra uma
  barra de tempo para a prévia.
- **Fotos de produto:** de `P:\FOTOS_ION` ([[Pasta de fotos FOTOS_ION]]), com `tools\assets.py` tirando o fundo branco.
- **Logos e personagens:** recorte da arte que o Júlio mandou, com regra por peça quando precisar (Workshop:
  `extract.py`). **Não baixe imagem da internet** (direitos de terceiros); se aparecer um PNG melhor, é só trocar o
  arquivo e regravar.

### 5. Efeitos que as cenas pedem — `node tools\render.js eventos`
A cena chama `sfx(t, 'whoosh' | 'pop' | 'impacto' | 'ding' | …)` no mesmo lugar em que anima. Este comando abre a
página e grava a lista em `audio\eventos.json`. Assim o som nunca sai do lugar da imagem.

### 6. Trilha e mixagem — `python tools\som.py`
- **Música e efeitos sintetizados do zero** (numpy/scipy, semente fixa), sem música nem amostra de terceiros: nada de
  licença. Mesma grade de 120 BPM; acordes por cena em `PROG` e clima por cena em `ESTILO` (calmo, tensão, subida,
  build, groove, pausa, cheio).
- Voz a −17 dBFS RMS. **A música abaixa 14 dB quando o narrador fala** (ataque 40 ms, soltura 350 ms); os efeitos, 4 dB.
- **Entrega em −14 LUFS e pico −1,5 dBFS** (padrão de YouTube e redes), com limitador. O script imprime as medidas
  (no Lube Online: narração 13,8 dB acima da música). Sai `audio\mix.wav` e também `audio\trilha_sem_voz.wav`.
- **O Claude não ouve, só mede.** Ouvir é pendência do Júlio (caixa de som da sala e fone), sempre.
- Sem pedido de som: Workshop saiu mudo; a Vinheta saiu com e sem som, porque vinheta costuma ter.

### 7. Conferir antes de gravar
- `node tools\render.js still --t 10,49.5,80 --sheet` tira quadros soltos e monta uma prancha em `qa\stills`.
- `node tools\render.js serve` abre a prévia em http://127.0.0.1:8790/ (barra de tempo, espaço toca e pausa, `?t=60`
  abre num ponto; sem som).
- Olhe as pranchas antes de gravar: no Lube Online elas pegaram títulos sem posição, a lista da busca atrás do banner e
  os títulos dos cartões batendo nos ícones. Erro de JavaScript aparece aqui, e não trava a gravação depois.

### 8. Gravar — `node tools\render.js video --workers 3`
- Grava em **blocos de 10 s** (600 quadros), cada um com um `.ok`. **Parou? Rode de novo**: só grava o que falta.
- H.264, crf 16, preset `medium`, `-tune animation`, cor bt709; Chrome com `--force-color-profile=srgb` e
  `--force-device-scale-factor=1`.
- **No máximo 3 trabalhadores nesta máquina (7,8 GB de RAM).** Com 5 Chromes + 5 codificadores a memória acabou e um
  ffmpeg caiu no meio (`EPIPE`). Bloco que falha volta para a fila (até 3 vezes); quadro que trava reabre o Chrome (até
  4 vezes).
- **Rode fora da sessão do Claude** (abaixo). Leva ~15 min para 2 min 33 s.

### 9. Montar — `python tools\montar.py --downloads`
Junta `out\video_sem_som.mp4` com `audio\mix.wav` (AAC 256k), marca de novo a cor bt709 no fluxo (a junção dos blocos
perdia a marca), põe `+faststart` e copia para `Downloads` sem sobrescrever.

### 10. Revisão independente, correções e entrega
Ver as seções 6 e 7. Depois: MP4 em `Downloads`, `LEIA-ME.md` e `GERAR VIDEO.bat` na pasta, nota do projeto, conversa
([[registrar-conversa]]), `## Histórico de mudanças` e [[Registro de mudanças]].

---

## 5. Gravar fora da sessão do Claude

**A gravação morre se for processo filho da sessão do Claude**: duas gravações se perderam em 2026-10-15 quando a
sessão fechou. Lance pelo WMI, como um processo do próprio Windows, com o log em `out\render.log`:

```powershell
$d = "C:\Users\gti.julio.alves\Desktop\BI\14. VIDEO LUBE ONLINE"
$ff = "C:\Users\gti.julio.alves\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
$cmd = "cmd.exe /c set `"FFMPEG=$ff`" && `"C:\Program Files\nodejs\node.exe`" tools\render.js video --workers 3 --out out\video_sem_som.mp4 > out\render.log 2>&1"
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $d }
```

(O `&&` aqui fica **dentro** do `cmd.exe /c`, onde funciona.) Para acompanhar:

```powershell
Get-Content "C:\Users\gti.julio.alves\Desktop\BI\14. VIDEO LUBE ONLINE\out\render.log" -Tail 5
```

Antes de lançar de novo depois de uma queda, feche as sobras de Chrome do gravador (só as do puppeteer; o Chrome do
Júlio fica):

```powershell
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*puppeteer_dev_chrome_profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Não componha a trilha (`som.py`) enquanto grava: na 1ª gravação do Lube Online o Chrome travou no primeiro quadro com a
máquina ocupada nas duas coisas.

---

## 6. Revisão independente

Vídeo que vai para telão ou diretoria **passa por revisão quadro a quadro antes de ser entregue** ("ISSO PRECISA FICAR
PERFEITO!", [[Como trabalhar comigo]]). Não basta "gravou sem erro".

1. Revise **o MP4 final**, não a prévia: `python tools\revisao.py` monta uma prancha por cena em `qa\revisao\` (12
   quadros, com o tempo e **a fala daquele instante** na legenda).
2. **3 revisores** (agentes), cada um com um terço do vídeo. Cada um recebe as pranchas do seu trecho, o
   `roteiro.json`, o `audio\timeline.json`, o `qa\proposta_texto.txt`, o código das cenas (só para entender a
   intenção) e o caminho do ffmpeg para tirar quadro em tamanho real, gravando só em `qa\` com prefixo próprio
   (`rev_a_`, `rev_b_`…). **Não editam nada.** Olham em tamanho real todo ponto suspeito e pelo menos 6 quadros de
   entrada de texto.
3. **Cinco lentes:** acabamento visual (texto cortado, sobreposto, pequeno para telão, piscada, elemento antes da hora,
   transição feia); português; **fidelidade à fonte** (todo número e afirmação contra o texto do PDF); sincronia com a
   fala (mais de ~0,5 s é defeito); impacto (algo parece amador ou "demo"?).
4. Cada achado volta com tempo, cena, gravidade (**alta** = corrigir antes de apresentar, **média** = deveria corrigir,
   **baixa** = detalhe), o que está errado e a correção sugerida. "Seu trabalho é achar defeitos, não elogiar."
5. Corrija alto e médio (o Lube Online corrigiu os 3 altos e os ~25 médios e baixos), regrave só os trechos e
   **confira os quadros corrigidos no MP4 novo**. Se a 1ª rodada achar muito, faça uma 2ª nos quadros do MP4 (o
   Workshop achou mais 16 na 2ª).
6. Recortes de logo e personagem são revisados **antes** de animar, em pranchas sobre fundos de contraste (a 1ª
   revisão dos recortes da Vinheta reprovou com 11 problemas).

---

## 7. O que regravar depois de uma correção

Os segundos de cada cena estão no `audio\timeline.json` (`cenas`, campos `t` e `fim`) e na saída do `tempo.py`.

| Mudou | Rode |
|---|---|
| Uma cena só (texto na tela, posição, cor, foto) | `node tools\render.js video --workers 3 --refazer 21-45` (segundos da cena; vários trechos com vírgula: `21-45,104-114`) e `python tools\montar.py --downloads` |
| O momento de um efeito (`sfx`) na cena | o de cima, mais `node tools\render.js eventos` e `python tools\som.py` antes de montar |
| Só a música ou o volume (`som.py`) | `python tools\som.py` e `python tools\montar.py --downloads` (**não regrava o vídeo**) |
| O texto da fala ou a voz | tudo (`GERAR VIDEO.bat`): a duração das cenas muda e tudo anda |
| `motor.js`, `main.js`, `ui.js` ou o CSS comum | `video` sem `--refazer`: muda a "impressão" do projeto e todos os blocos são regravados |

**Cuidado com o `--refazer`:** ele aceita os outros blocos prontos **mesmo que estejam velhos**. Só use quando a mudança
é de verdade só naquele trecho.

---

## 8. Lições (o que já deu errado)

### Texto na tela
- **Pontuação descolada na Plus Jakarta Sans 800.** Nos títulos grandes o ponto e a vírgula ficam longe da palavra. O
  `main.js` embrulha `.,:` de todo `.titulo` num `span.pt` com `margin-left: -0.05em`.
- **Número e unidade com espaço que não quebra.** "500 g" quebrava a linha em "500 / g". O `ui.js` troca o espaço por
  espaço que não quebra (`\u00A0`) entre número e `g`, `kg`, `ml`, `L`, `m`, e na embalagem ("Caixa 10 un.").
- Texto de telão não é pequeno (os cartões da IA cresceram na revisão); título com `white-space: nowrap`.
- Na troca de cena, os títulos de uma e da outra não se cruzam: a saída termina antes da entrada da próxima.
- Foto de produto com fundo branco não vai sobre fundo colorido (o Toddy no banner laranja): tire o fundo.

### Fatos
- **Nunca invente dado que pareça fato.** Todo número e toda afirmação saem da fonte e são **conferidos contra o PDF**.
  A revisão do Lube Online pegou "em 3 estados" nos colaboradores (não está no PDF), "212 páginas" e "08h às 18h"
  (inventados) e "Entrega amanhã" (virou "Prazo na hora").
- O que é ilustrativo (preço, cliente, CNPJ, pedido) **diz isso na tela** ("Layout, produtos e preços ilustrativos"),
  como o próprio PDF faz.
- **Preço sempre com embalagem** ("Caixa 10 un."): preço solto parece preço unitário.
- Coerência dentro do vídeo: o mesmo número de pedido em todas as telas, o carrinho batendo, nada contraditório na
  mesma tela ("PIX recebido" ao lado de "boleto vencendo"; a conversa das 02:14 dizendo que o pedido "saiu às 08:12").
- Próximo passo é pedido à diretoria: ganha **seta**, não "feito".
- A ressalva da fonte vai junto (no plano: "prazos estimados, confirmados depois do diagnóstico do ERP").
- Marca de terceiros (produtos da indústria, personagens de jogo) serve para vídeo interno; para fora da empresa, a
  decisão é do dono.

### Sincronia
- **O nome da marca é dito no instante em que ela aparece.** O narrador dizia "Lube Online" 0,8 s antes da marca: a
  fala foi deslocada para "Lube" cair no drop.

### Gravação
- **Gravação morre se for filha da sessão:** lance pelo WMI (seção 5).
- **3 trabalhadores** nesta máquina; mais que isso esgota a memória.
- Com WebGL, vários Chromes ao mesmo tempo derrubam o contexto da GPU (`CONTEXTO_PERDIDO`): detectar e tentar de novo
  (Workshop).
- `robocopy` com código 1 quer dizer "copiado", não erro.
- Script Python vai em arquivo, não em heredoc (caminho do Windows com barra invertida corrompe).

---

## Registro de mudanças

- **2026-10-16** — Skill criada a partir dos três vídeos ([[VÍDEO WORKSHOP LUBE]], [[VINHETA CPG]] e
  [[VÍDEO LUBE ONLINE]]), com o projeto do Lube Online como referência (Claude, a pedido do Júlio) ·
  [[2026-10-15 — Vídeo animado da proposta Lube Online]]
