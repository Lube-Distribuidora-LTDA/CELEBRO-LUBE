---
tipo: rotina
departamento: Financeiro
status: ativo
tags: [rotina, financeiro, folha-pagamento]
---
# Validação mensal da folha

Toda competência nova repete os mesmos passos, **para cada uma das cinco empresas** (LUBE, LUBE RJ,
L LOG, IMPÉRIO LOG, SERMAR). Desde 2026-09-29 a folha entra **pelo próprio painel**, sem passo
manual; desde 2026-09-30 o painel navega por empresa e departamento no menu lateral. Sistema:
[[SISTEMA FINANCEIRO]]. Detalhes técnicos em [[GESTÃO FINANCEIRO — documentação técnica]].

## Fluxo
1. **Gatilho** · O DP fecha a folha do mês e manda os PDFs das cinco empresas: um por empresa (a LUBE traz os nove departamentos) ou por departamento
2. **Pessoa** · Carregar a referência de desconto do mês em `financeiro.referencia_desconto`: planilhas das operadoras (aba do mês) e lista de vales
   - **Atenção:** ainda manual, pedir ao Claude; sem ela o painel não confere plano nem vale. Os vales só entram se cada subtotal por setor fechar
3. **Pessoa** · Em `gestao-finaceiro.vercel.app`, clicar em **Importar folha** e escolher o PDF como o DP mandou, sem converter nem recortar
   - **Atenção:** só abre com login do [[PAINEL LUBE DISTRIBUIDORA]] e o Gestão Financeiro liberado ([[SENTINELA LUBE]]); a 1ª abertura do dia leva 15 a 30 s
   - **Se falhar:** painel sem dados é conexão (conferir as variáveis na [[Vercel]]); erro 500 com `timeout` é o banco saturado, ver [[Supabase]]
4. **Lê** · `web/api/_folha-pdf.js` lê o PDF: empresa pelo cabeçalho e departamentos separados sozinhos; o `importar.js` mostra a prévia, sem gravar
5. **Confere** · Cada recibo fecha e os totais e o nº de pessoas batem com o resumo impresso da última página; só então aparece o botão de gravar
   - **Se falhar:** a tela diz o que divergiu, item por item, e **nada é gravado**
6. **Grava** · [[Supabase]] DATA WAREHOUSE, schema `financeiro`; a competência nova vira a atual e passa a ser comparada com a anterior (`set → out`)
   - **Atenção:** reimportar substitui os valores, mas mantém validações e correções; a tela avisa quantas existem antes de gravar
   - **Atenção:** outubro/2026 será o 1º mês inteiro pelo botão; ago e set/2026 entraram por carga feita pelo Claude
7. **Pessoa** · Tratar o apontado: contrato e desconto na aba *Observações*, INSS e IRRF em *Bases e encargos* e o bloco "Cobrado na planilha e sem folha"
   - **Atenção:** férias, atestado, admissão e parcela de empréstimo não são alteração de contrato; se virarem alarme, a regra quebrou
8. **Entrega** · Folha do mês conferida no [[SISTEMA FINANCEIRO]], por empresa e departamento; o que foi confirmado vira a referência do mês seguinte

## Quando
Assim que o DP fechar a folha do mês e mandar os PDFs — um por empresa (a LUBE vem com os nove
departamentos no mesmo arquivo) ou um por departamento; o painel aceita os dois.

## Passo a passo
0. **Carregar a referência de desconto do mês** (desde 2026-09-30). Sem ela o painel não confere
   plano nem vale. São duas fontes:
   - as **cinco planilhas das operadoras** (LUBE/IMPÉRIO odonto e saúde, LLOG odonto e saúde,
     Unimed LUBE) — cada uma tem **uma aba por competência**, usa-se a do mês;
   - a **lista de vales** em PDF. A transcrição só vale se **cada subtotal por setor fechar** com a
     soma dos valores digitados. Se não fechar, não carrega: está errado.

   As duas viram linhas em `financeiro.referencia_desconto`. Enquanto não houver importador na tela,
   esse passo é manual — pedir ao Claude. Em setembro/2026 deram 127 cobranças.
1. Abrir https://gestao-finaceiro.vercel.app e clicar em **Importar folha**. Desde 2026-10-06 o
   sistema só abre com **login do Painel Lube** (guarda da [[SENTINELA LUBE]]): sem sessão, a página
   vai para o portal. Quem for fazer a rotina precisa ter o Gestão Financeiro liberado lá.
2. Escolher o PDF do jeito que o DP mandou — não precisa converter nem recortar nada. O arquivo
   pode trazer uma empresa inteira com vários departamentos (a LUBE vem com nove): o painel lê a
   empresa do cabeçalho e separa os departamentos sozinho.
3. **Ler a tela de conferência.** Ela mostra competência, departamento, quantidade de colaboradores e
   compara os totais lidos com o **resumo impresso na última página da folha**. Só aparece o botão de
   gravar quando tudo bate; se algo divergir, a tela diz o quê e **nada é gravado**.
4. Gravar. A competência nova vira automaticamente a atual e passa a ser comparada com a anterior:
   `set → out`, `out → nov`, e assim por diante.
5. **Tratar o que o sistema apontou**, pela aba *Observações* de cada pessoa: contrato alterado,
   salário base diferente sem evento que explique, e **desconto que não bate com a planilha da
   operadora** — valor diferente, cobrado e não descontado, ou vale sem justificativa. O número
   errado aparece **em vermelho**, com o valor da planilha logo abaixo. Confirmar, marcar para
   verificar ou anotar o que foi apurado. O que for confirmado vira a referência do mês seguinte.
6. **Olhar o bloco "Cobrado na planilha e sem folha"**, embaixo da lista do departamento principal
   de cada empresa. É gente que a operadora cobra e que não aparece em **nenhuma folha do mês, de
   nenhuma empresa**: ou a cobrança está indevida, ou a pessoa é de uma entidade que não tem folha
   aqui.
7. **Olhar INSS e IRRF no bloco *Bases e encargos*** de quem estiver em *Revisar* com etiqueta
   *INSS* ou *IRRF*. Errado aparece em vermelho com o valor devido embaixo. Quem teve férias pagas
   à parte aparece como "não conferível pela folha" — não é erro, é limite do recibo.

## Cuidados que já custaram tempo
- A **primeira abertura do dia demora** de 15 a 30 segundos: a função e o pooler acordam juntos. Não
  é erro; da segunda vez em diante responde na hora.
- Se o painel ficar sem dados, o problema é conexão — conferir as variáveis na Vercel antes de mexer
  em qualquer outra coisa. Se as variáveis estiverem certas e o erro for 500 com `timeout`, é o
  **banco DATA WAREHOUSE saturado** (aconteceu em 2026-10-01): esperar ou olhar em [[Supabase]].
- **Férias, atestado, admissão no meio do mês e parcela de empréstimo não são alteração de contrato**
  e não devem virar alarme. Se começarem a virar, a regra quebrou.
- Reimportar uma competência **substitui os valores**, mas mantém as validações e as correções já
  feitas. A tela avisa quantas existem antes de gravar.
- **Nome na planilha da operadora vem errado com frequência** — a Keli está como *"KELI STANFIN
  GAATI"* na de saúde e *"KELI SFALSIN GATI"* na de vales. O sistema aguenta o erro e casa mesmo
  assim, avisando na ficha como está escrito lá. Vale pedir a correção, mas não trava a conferência.
- O que vem do PDF é a **fonte da verdade**: na carga manual de setembro eu havia abreviado um nome e
  acrescentado um acento que a folha não tem. A importação corrige isso para o que está impresso.

## Pendência
- [x] Carregar Logística e Transporte quando as folhas chegarem — 2026-09-30: superado, a LUBE
      entrou com os nove departamentos e as outras quatro empresas com a folha geral.
- [x] Importar as folhas das outras filiais (LUBE RJ, LLOG, IMPÉRIO, SERMAR) para o cruzamento das
      planilhas fechar inteiro — 2026-09-30, ago e set. Ver [[2026-09-30 — Cinco empresas no painel, INSS e IRRF conferidos]].
- [ ] Primeira competência nova (outubro/2026) entrando pelo botão *Importar folha*, com a
      referência de desconto de outubro carregada antes. Será o primeiro mês inteiro pelo painel:
      ago e set/2026 entraram por carga feita pelo Claude.
- [ ] Importador das planilhas das operadoras na própria tela (hoje o passo 0 é manual).
