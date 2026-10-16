---
tipo: conceito
departamento: TI
status: ativo
tags: [conceito, financeiro, notas-fiscais]
---
# Notas, boletos e recibos

Como o Júlio usa esses termos. Vale para o [[GESTÃO TI]] e para qualquer sistema que mexa com documento de fornecedor.

## Os três documentos não são a mesma coisa
- **Nota fiscal** — documento fiscal do serviço. Verde no painel.
- **Boleto / fatura** — ordem de pagamento, algo **a pagar**. Azul.
- **Recibo** — comprovante de pagamento **já feito**. Âmbar. É o único que fala do passado, e por isso tem cor própria. Assinaturas de software no exterior (Claude, ChatGPT, Supabase, Google IA Pro) só emitem isto — nunca nota fiscal nem boleto.

Chamar um recibo de "fatura" na tela afirma que existe algo a pagar, justamente na conta em que o dinheiro já saiu.

Um quarto caso: **Link do portal** (azul, com ícone de link). Fornecedor que não manda anexo — a SAAM, pela ContaAzul — manda um link para a página onde estão a nota e o boleto. O link vale pelos dois, e um clique abre o portal. Pedido do Júlio em 2026-09-24. Mas data, valor e competência continuam só lá dentro: o que o painel mostra dessa conta é estimado até alguém abrir o link.

### Nota ou boleto: o nome do arquivo decide
O mesmo e-mail quase sempre traz os dois e o assunto cita os dois ("Boleto - MAIS DADOS - NFS-e: 2284"). Por isso quem decide é **o nome de cada arquivo**; o assunto só entra quando o nome não diz nada. Quando o assunto cita os dois juntos ("nf+bol") e outro anexo já é boleto pelo nome, o que sobrou é a nota — foi o caso da "Fatura de Locação" da IMPREMIX, documento que a lei dispensa de virar nota fiscal separada e que vale como a nota (2026-09-29).

## Competência não é vencimento
**Competência** é o mês de referência do serviço. **Vencimento** é quando se paga. O fornecedor emite num mês para receber no seguinte, então:

> A competência **nunca** sai do mês do vencimento.

Datar pelo vencimento joga a cobrança um mês à frente e abre uma segunda competência ao lado da que já existia. Foi o que duplicou a INTELI+ e a Kaizen em setembro de 2026.

### De onde a competência sai, nesta ordem
1. **O que o próprio documento declara** — "Competência 09/2026" escrito na nota, ou o `dCompet` do XML. Isto ganha de tudo.
2. **O mês escrito no e-mail** — "| JULHO |", "Competência 08/2026" no assunto.
3. **O mês em que o documento chegou** — último recurso.

Exceção antes do passo 3: documento que **não declara competência** — a 2ª via que a Itanet reenvia de um ciclo já aberto — reencontra a fatura pelo **vencimento exato**, desde que só uma fatura da conta tenha aquela data. Isso acha uma fatura que já existe; nunca deduz um mês a partir do vencimento (2026-10-05).

A ordem importa porque o passo 3 é um chute, e por muito tempo ele era o único caminho possível para um PDF: a competência só era lida de XML. Como a Itanet emite a nota do mês fechado no dia 1º do mês seguinte, a nota de setembro chegava em outubro e era arquivada em outubro — **todo mês**, desde que ela existe no sistema (corrigido em 2026-10-05).

Só vale a data que vier **colada ao rótulo** "competência". Um `MM/AAAA` solto não serve: a página de um boleto é cheia de datas — emissão, processamento, vencimento, protocolo.

### Cada fornecedor tem a sua distância
Quantos meses separam a competência do vencimento **muda conforme o fornecedor**, e não dá para supor um padrão único:

| Fornecedor | Competência → vencimento |
|---|---|
| Itanet, IMPREMIX | mês seguinte |
| Kaizen, Print Solução, Mais Dados, INTELI+ | mês seguinte |
| Vix Suporte | mês seguinte, **dia 05** |
| SAAM (SISAUDCON), Vivo | **mesmo mês** |
| Assinaturas de IA | mesmo mês (dia de débito 24) |

A linha de Kaizen, Print, Mais Dados, INTELI+ e Vivo entrou em 2026-10-06, quando a geração automática de outubro pôs 8 faturas na data da competência de setembro (ver [[2026-10-07 — Kanban TI e o mês que nunca abria]]).

A **Vix Suporte** é o caso extremo: a NFS-e dela não traz vencimento nenhum, então o dia 05 **só existe no cadastro da conta** — não há documento de onde relê-lo. Ficou meses no palpite "dia 1º", a ponto de a competência de setembro vencer em 01/10, um dia *antes* de a própria nota ser emitida (02/10). Confirmado pelo Júlio em 2026-10-05. A de agosto, que parecia 5 dias de atraso, era 10.

Quando nenhum documento informa a data, o sistema olha o histórico da própria conta para saber essa distância. Na prática: **uma data corrigida à mão uma vez passa a valer para os meses seguintes**. O dia continua vindo do cadastro da conta — o histórico ensina o mês, não um dia excepcional de alguma remessa.

### Data calculada tem que se assumir como calculada
Quando o vencimento não veio de documento nenhum, a fatura diz isso na observação. Uma estimativa exibida com a mesma cara de um dado conferido é como a cobrança da SAAM passou um mês inteiro parecendo confirmada.

## Débito automático não vence
Conta paga no cartão em data fixa (as assinaturas de IA, todo dia 24) **não tem vencimento** — tem dia de débito. A data é quando o dinheiro sai, não um prazo a cumprir. Tratar como vencimento deixaria a conta vermelha todo dia 25, para sempre, e **alarme que sempre toca ninguém mais escuta**.

Dessas contas só interessa o comprovante do ciclo atual: nada de buscar histórico, nem de recolher recibo de compra avulsa que caiu fora do dia. Na prática, o robô só aceita o recibo **do dia 24 até o fim do 7º dia seguinte**, e só se ele tiver chegado nessa janela. A competência é **o mês do débito**, não o ciclo que o recibo descreve ("Team plan, Aug 24–Sep 24" é o pagamento de setembro). Regra pedida pelo Júlio em 2026-09-17, depois que o recibo de agosto e um crédito avulso de API de R$ 128,13 tomaram a linha da assinatura de R$ 826,00.

## "Assinado e entregue" não é "pago"
O status **Assinado e entregue à contabilidade** encerra a fatura no painel, como "paga" — nunca aparece como atraso. Mas significa que o documento foi encaminhado, **não que o dinheiro saiu**. A Itanet de 10/09/2026 estava assim no painel e em aberto na operadora.

## Documento repetido
Fornecedor costuma mandar o mesmo documento duas vezes — pelo sistema dele e reencaminhado à mão. **Vale o primeiro envio**, que é o que chegou no prazo e já foi conferido. O número da nota identifica o documento.

## Melhor vazio que errado
Valor, vencimento e competência saem **de dentro do documento** — XML da NFS-e, texto do PDF com o rótulo colado ao número, ou linha digitável do boleto com dígito verificador conferido. Se não der para ler com segurança, o campo fica vazio e alguém confere. Nada de "pegar o maior número da página": foi assim que uma nota de R$ 1.000 virou R$ 180.422,33.

- **O valor gravado é o líquido** — o que sai do caixa —, com o bruto ao lado quando há retenção (ISS retido).
- **O vencimento sai do texto** (documento, assunto ou corpo do e-mail). O nome do arquivo e o dia do contrato são só palpite: "NFSe 934 ... 09-24.pdf" virou 24/09 quando o assunto dizia 15/09, e o Júlio levou bronca por uma conta que venceu sem aparecer (2026-09-15).
- **O número da nota sai do documento** (`nNFSe` no XML), não do nome do arquivo — a Mais Dados aparecia com 11334723, o id do XML, em vez da nota 2571.
- A linha digitável só vale com **os três dígitos verificadores certos**; sem essa checagem, amontoados de números do PDF viravam boletos de 2024.

Quando não dá para ficar vazio — a fatura precisa de um vencimento para existir no painel —, o campo é preenchido com a melhor estimativa **e a observação diz que é estimativa**.

## Fornecedor inativo não tem conta a pagar
Inativar o fornecedor é o gesto que encerra o contrato. A partir dali ele não deve aparecer em lista, alerta ou resumo, e competência nenhuma deve nascer no nome dele — uma conta de quem não presta mais serviço é cobrança de algo que não existe.

O que já passou continua: as faturas antigas ficam guardadas, e o custo dos meses em que ele de fato atendeu não se mexe. Só o futuro para.

## Conferir no documento, não na tela
Toda correção de data ou valor sai do documento original: o PDF aberto, ou o portal do fornecedor aberto no navegador. A tela do painel é o que está sendo questionado — não serve de prova de si mesma. Em 2026-10-05 isso mostrou que o papel que o Júlio recebeu estava certo e o sistema errado nos três casos que ele levantou.

Veja também [[Como trabalhar comigo]] e [[GESTÃO TI]].
