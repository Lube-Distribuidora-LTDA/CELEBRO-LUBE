# Aba Rotinas + funil do fluxo (especificação, 2026-10-13)

Pedido do Júlio:
> "eu gostaria de criar uma aba dentro do cérebro além das conversas, queria colocar as rotinas, aí quando eu
> clicar em uma delas, abre um painel no lado com o funil mostrando o fluxo conectados um ao outro"

Vale tudo do `CONTRATO.md` (tokens, fontes, CSP, ids existentes, regras do frame, reduced motion, 400 px).
O painel publicado é https://claude.ai/artifact/Tnrde74sov8LPGmgj8yjT4 (versão 4); o código desta pasta é a fonte.

---------------------------------------------------------------------------------------------------
## 1. A fonte do fluxo: seção `## Fluxo` nas notas de `Rotinas/`

Cada nota de rotina ganha (logo depois do parágrafo de abertura, antes das outras seções `##`) uma seção:

```
## Fluxo
1. **Gatilho** · Agendador do Windows na VM `SRV-IA`, às 07:50, 11:50, 17:50 e 23:50
2. **Lê** · [[WinThor]] (Oracle, só leitura): 12 consultas, ~59 mil linhas
   - **Atenção:** a das 07:50 leva ~8 min por causa da carga do Oracle no começo do expediente
3. **Processa** · `executar.py --grupo rapidas` chama o `sync_bi_compras.py` ([[data-warehouse]])
4. **Grava** · [[Supabase]] DATA WAREHOUSE, schemas `compras` e `core`; registra em `compras.controle_carga`
   - **Se falhar:** a carga seguinte refaz tudo; conferir no `controle_carga`
5. **Entrega** · painel do [[BI COMPRAS]] com o dado pronto 10 min depois
```

Regras do formato (o painel lê exatamente isto):
- Lista **numerada**, uma etapa por item: `N. **Tipo** · texto`. O separador é ` · ` (aceitar também ` — ` e ` - `).
- `Tipo` é **um** destes (decide ícone e cor): **Gatilho** (o que dispara: agendador, cron, evento, pessoa),
  **Pessoa** (passo manual de alguém), **Lê** (de onde vem o dado), **Processa** (o que o programa faz),
  **Confere** (validação), **Grava** (onde fica guardado), **Avisa** (e-mail, Telegram, aviso), **Entrega** (o que
  sai no fim e para quem). Começa quase sempre por Gatilho ou Pessoa e termina em Entrega.
- Sub-itens com `   - ` abaixo de uma etapa são observações dela: `**Se falhar:**` (vermelho), `**Atenção:**`
  (âmbar) ou texto livre (detalhe).
- Texto curto: até ~140 caracteres por etapa, 3 a 8 etapas. Pode ter `[[links]]`, `` `código` `` e **negrito**.
- **Só fatos que a própria nota ou as notas ligadas já registram.** Nada inventado; o que não se sabe fica de fora
  (ou vai como `**Atenção:** a confirmar`). Nunca senha, token ou chave.

Rotina sem `## Fluxo`: o painel deduz um fluxo simples (Gatilho = `frequencia`/linha "Quando:"; uma etapa por
`[[link]]` do corpo, na ordem, até 5; Entrega = a nota do projeto do departamento, se houver) e mostra o selo
"Fluxo deduzido — escreva a seção Fluxo na nota para ficar exato".

---------------------------------------------------------------------------------------------------
## 2. Dados (js/dados.js) — novas exportações

```
export const TIPOS_ETAPA   // {gatilho:{rotulo:'Gatilho', cor:'--holo'}, pessoa:{'Pessoa','--rever'}, le:{'Lê','--novo'}, processa:{'Processa', violeta '#8E7CFF'}, confere:{'Confere','--ok'}, grava:{'Grava','--azul' clareado}, avisa:{'Avisa','--vermelho'}, entrega:{'Entrega','--holo'}}
export function parseFluxo(no, G) -> {passos:[{tipo, rotulo, html, alvos:[string], notas:[{tom:'falha'|'atencao'|'info', html}]}], deduzido:boolean}
   // html via inline() do próprio dados.js (já escapa e transforma [[link]] em a.wl); alvos = os [[...]] da etapa
export function rotinas(G) -> [{no, grupo, titulo, horarios:['07:50',...], frequenciaTexto, maquina, status, fluxo}]
   // grupo = prefixo antes de " - " no nome ("BI Compras"), senão o departamento; titulo = o resto ("Sync rapidas")
   // horarios = todos os HH:MM achados em fm.frequencia (ou na linha "**Quando:**" do corpo); maquina = fm.maquina ou a linha "**Onde:**" (texto puro, curto)
   // status = fm.status (ativo | planejado | pausado | arquivado)
export function proximaExecucao(horarios, agora=new Date()) -> {quando:Date, texto:'hoje 17:50 (em 2 h 10 min)'} | null
```
Testar com node contra `api/vault` (regerado com `python -I ../gerar-vault.py`, ver §5).

---------------------------------------------------------------------------------------------------
## 3. Tela

**Abas no trilho** (esquerda no desktop; faixa de baixo no celular): `Departamentos` | `Rotinas`, com a contagem
de cada, `role="tablist"`, setas do teclado trocam, a escolha fica no localStorage (try/catch). A aba Departamentos
é exatamente o trilho de hoje.

**Aba Rotinas:** lista agrupada por `grupo` (cabeçalho pequeno mono com o nome do grupo). Cada rotina: título,
linha mono com o resumo dos horários ("4× por dia · 07:50 → 23:50", "03:45", "a cada 5 min", "sempre no ar",
"mensal"), bolinha de situação (ativo = `--ok`, planejado = `--rever`, pausado/arquivado = `--muted`) e, quando há
horários, "próxima em 2 h 10 min" (atualiza a cada minuto). Clicar abre o funil.

**Painel do funil** (`<aside id="fluxo" class="leitor fluxo" hidden>`): mesma moldura holográfica do leitor
(cantos, varredura, mesmo lugar à direita; folha de baixo no celular), com:
- Cabeçalho: selo `ROTINA · {grupo}`, título (digitado como no leitor), chips mono: horários, "Próxima: hoje 17:50
  (em 2 h 10 min)", máquina, situação. Botões: **Ver nota completa** (abre a nota da rotina no leitor),
  **Copiar caminho**, Fechar.
- **O funil:** uma silhueta de funil (SVG atrás das etapas, larga em cima e estreita embaixo, contorno ciano fino
  e preenchimento muito sutil) e, dentro dela, as etapas empilhadas de cima para baixo, cada uma um pouco mais
  estreita que a anterior (largura mínima que mantém o texto legível, ~68% da primeira). Cada etapa: ícone do
  tipo (SVG desenhado em código, traço 1.6), rótulo do tipo em mono maiúsculo com a cor do tipo, número da etapa,
  texto (com links clicáveis). Observações da etapa como etiquetas ao lado/embaixo (Se falhar = vermelho,
  Atenção = âmbar).
- **Conectores** entre as etapas: linha vertical com brilho e **partículas descendo** em fluxo contínuo (o dado
  "passando" pelo funil); entre etapas, uma setinha. Tudo em SVG/CSS, sem biblioteca.
- Rodapé: "Notas ligadas" (as conexões da nota, como no leitor).
- Selo "Fluxo deduzido…" quando `deduzido`.
- Animação de abertura: moldura abre como o leitor; as etapas caem de cima uma a uma (80–120 ms entre elas), cada
  conector se desenha depois da etapa de cima; depois as partículas começam. Reduced motion: tudo pronto, sem
  partículas andando.
- Clicar num `[[link]]` de etapa: o robô puxa a nota e abre o **leitor** no lugar do funil, com um botão
  **"← Voltar ao fluxo"** no leitor que reabre o funil daquela rotina.
- Esc fecha (ordem: leitor → funil → menu → leque → resposta). Abrir outra rotina com o funil aberto troca com o
  mesmo glitch do leitor.

**Robô:** ao abrir uma rotina, a **conta vermelha** dela no halo acende, o robô olha para ela (`procurando`), a conta
sai do halo como esfera (puxar) e voa até o painel; feixe da testa até o painel e `lendo`, como no leitor.
Passar o mouse numa conta do halo mostra a dica (nome + horários); clicar abre o funil. Na visão anéis, clicar
num nó de rotina também abre o funil.

---------------------------------------------------------------------------------------------------
## 4. Critérios
- As 11 rotinas aparecem na aba, com horários e próxima execução corretos para o horário local.
- Cada uma abre um funil com as etapas da seção `## Fluxo` dela, na ordem, com links funcionando.
- Nada do que já existe quebra (leitor, leque, busca, anéis, pergunte ao cérebro, boot, Esc, celular).
- Console limpo; 400 px sem rolagem lateral; foco de teclado visível; reduced motion respeitado.

## 5. Teste local
`python -I "<scratchpad>\gerar-vault.py"` regera `cerebro-robo/api/vault` a partir do vault real (só para teste, não
publicar). Servidor: `preview_start` com name `cerebro-robo` (http://localhost:4330). O `index.html` não tem
doctype/head: para testar, gerar `dev.html` = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta
name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>` + index.html +
`</body></html>` e abrir `/dev.html`. Apagar o `dev.html` no fim.
