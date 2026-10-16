---
tipo: projeto
departamento: TI
status: ativo
inicio: 2026-10-07
tags: [projeto, claude-code, mod, identidade-visual]
---
# MOD BARRA LUBE

Mod do Claude Code (plugin de hooks que recarrega sem reiniciar): uma **barra azul de design
tecnológico com a logo da Lube** que aparece logo acima do campo de digitação quando o Claude termina
de trabalhar em um projeto. Criado com o [[Claude]] em 2026-10-07
([[2026-10-07 — Mod da barra azul da Lube]]). Faz parte do [[Cérebro da Lube]].

## O que ela mostra
- Logo oficial numa placa branca arredondada com brilho ciano (regra de [[Como eu gosto dos BIs]]: logo
  sempre em placa branca). **A logo é vetor** (dois caminhos, azul e vermelho, traçados da arte original):
  a primeira versão embutia o PNG no desenho e o app desktop **descartou a imagem** (placa saiu vazia,
  conferido pelo Júlio em 2026-10-07). Caminho de vetor o app desenha; imagem embutida em Svg, não.
- Selo de "TRABALHO CONCLUÍDO", nome do projeto (nome da pasta da sessão), arquivos alterados e tempo.
- Fundo azul da Lube com grade, trilhas de circuito, um feixe de luz passando e filete vermelho da marca.
- Botão **Fechar**. Some sozinha quando o Júlio manda o próximo pedido.

## Quando aparece
- Só no fim de um turno que **terminou normalmente** (não interrompido, não erro) e em que o Claude
  **fez alguma coisa além de ler** (editar, rodar comando, publicar). Conversa pura e só leitura não acendem.
- Não aparece para subagentes, só para a conversa principal.

## Onde estão as coisas
- Código: `C:\Users\gti.julio.alves\.claude\dev-mods\3ccd0301-fa46-4fec-8561-5e4daf973852\lube-barra\`
  (`hooks/register.tsx` regras, `hooks/bar.ts` desenho SVG, `hooks/logo.ts` logo em vetor,
  `hooks/register.test.ts` testes).
- Manifesto: `.claude-plugin/plugin.json` (nome `lube-barra`, versão 0.1.0) e `hooks/hooks.json`, que aponta para
  `./register.tsx`. O manifesto aponta também para `types/index.d.ts` (com `tsconfig.json` na raiz do mod). A pasta
  `.claude-plugin/types/` é criada pelo próprio app ao carregar o mod (2026-10-07 14:20) e foi atualizada de novo às
  17:41, quando a sessão foi reaberta e o app recarregou o mod.
- Esse caminho tem o id da sessão em que nasceu (3ccd0301, aberta na pasta do cérebro) e **só carrega nela**;
  para usar sempre, o mod precisa ser carregado de uma pasta fixa (`CLAUDE_CODE_PLUGIN_DIRS` ou
  `claude --plugin-dir`). **Ainda não foi movido** (conferido em 2026-10-09).
- Não está em Git: a pasta do mod não é repositório.
- Logo de origem: `Downloads\LOGO LUBE.png` (2172×724, com transparência).
- O `trace.py` que traçou a logo ficou **só na pasta temporária da sessão**
  (`AppData\Local\Temp\claude\...\3ccd0301-...\scratchpad\trace.py`); se o Windows limpar a pasta, ele se perde.

## Como ajustar
- Cores: constantes no topo de `bar.ts` (`AZUL_FUNDO`, `CIANO`, `VERMELHO_LUBE`).
- O que conta como "mexer no projeto": `SO_LEITURA` no `register.tsx`.
- Texto da barra: `barraSvg()` em `bar.ts`. Limite do elemento Svg: 131.072 caracteres (hoje ~13,5 mil).
- Logo: `logo.ts` exporta `LOGO_AZUL`, `LOGO_VERMELHO`, `LOGO_LARGURA` e `LOGO_ALTURA`; o `bar.ts` desenha dois
  `<path>` (azul `#11196e` e vermelho `#f80b1a`, `fill-rule` evenodd, escala `96/LOGO_LARGURA`).
- Refazer a logo em vetor (se a arte mudar): `trace.py` com a biblioteca `potracer` instalada em pasta
  temporária (`pip install --target`); separa azul e vermelho por cor e traça cada máscara. Atenção:
  o `potracer` espera a máscara **invertida** (`Bitmap(~mascara)`), senão o vermelho preenche a placa toda.
- Na superfície de terminal não existe Svg: lá a barra é feita só de texto (L branco, UBE vermelho).

## Validação (2026-10-07)
- `claude plugin validate` passou e `claude plugin test` deu 7 de 7 (terminal, desktop e vscode; só
  leitura não acende; interrompido não acende; Fechar esconde; novo pedido esconde).
- Use o binário **do app** (`%APPDATA%\Claude\claude-code\<versão>\...\claude.exe`; em 2026-10-07 foi o
  **2.1.289**): o `claude` do PATH é o 2.1.267 e reprova o exemplo oficial. Desde 2026-10-07 15:56 o app tem
  também o 2.1.293 (ver [[Claude]]).
- Nos testes, o projeto é simulado com `session.cwd` = `C:\Lube\BI COMERCIAL`.

## Decisões
- 2026-10-07 (Claude): "quando termina de mexer em algum projeto" = fim de turno normal em que o Claude fez algo
  além de ler. Conversa pura, só leitura e turno interrompido não acendem. Ajustável em `SO_LEITURA`.
- 2026-10-07 (Claude): a barra some no próximo pedido ou no botão Fechar, sem prazo automático.
- 2026-10-07 (Claude): logo em placa branca arredondada, pela regra de [[Como eu gosto dos BIs]].
- 2026-10-07 (Claude): logo em vetor em vez de PNG embutido — o app descarta imagem embutida em Svg, mas
  desenha caminho de vetor.
- 2026-10-07 (Claude): validar e testar mods só com o binário do app, nunca com o `claude` do PATH.
- 2026-10-07 (Claude): **não mover o mod para pasta fixa nem mexer nas configurações pessoais do Claude sem o
  Júlio pedir**, porque isso muda os ajustes dele.

## Pendências
- [x] Barra apareceu no app (2026-10-07), mas sem a logo → logo refeita em vetor.
- [ ] Júlio conferir a barra com a logo em vetor no app
- [ ] Decidir se vira permanente (mover para pasta fixa e registrar nas configurações) — Júlio; o Claude faz
  quando ele confirmar
- [ ] Guardar o `trace.py` junto do mod (hoje só na pasta temporária) — junto com a mudança para pasta fixa

## Histórico de mudanças
Tudo o que mudou neste sistema, do mais novo para o mais antigo. Visão de todos os sistemas em [[Registro de mudanças]].

- **2026-10-07** — Logo refeita em vetor (dois caminhos traçados da arte, com `potracer`), porque o app descartava o PNG embutido; desenho de ~54 mil para ~13,5 mil caracteres; validação e 7 de 7 de novo, 17:43–17:45 (fora do Git) · [[2026-10-07 — Mod da barra azul da Lube]]
- **2026-10-07** — Mod `lube-barra` 0.1.0 criado e carregado pelo app, 14:15–14:20: barra azul com a logo em PNG embutido (300 px, achatado sobre branco), regras de quando acende, 7 testes (fora do Git) · [[2026-10-07 — Mod da barra azul da Lube]]
