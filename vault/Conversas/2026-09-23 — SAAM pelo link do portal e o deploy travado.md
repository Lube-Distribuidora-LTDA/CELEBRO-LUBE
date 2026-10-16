---
tipo: conversa
data: 2026-09-23
projeto: "[[GESTÃO TI]]"
status: resumido
tags: [conversa, ti, gestao-ti, contaazul, vercel, deploy]
---
# 2026-09-23 — SAAM pelo link do portal e o deploy travado

## Resumo
A SAAM trocou o Omie pela ContaAzul e passou a mandar **um link**, nunca anexo — o robô descartava o e-mail todo mês, em silêncio. O [[GESTÃO TI]] ganhou o documento **"Link do portal"**: um clique leva à página onde estão a nota e o boleto. A mudança ficou dois deploys presa em `BLOCKED` na [[Vercel]], porque o repositório tinha virado privado no plano Hobby; o Júlio voltou a público e destravou. Depois o vencimento das duas faturas da SAAM apareceu um mês adiantado, e a leitura da data foi corrigida.

Começou em 23/09 (a busca na caixa achou 76 mensagens da SAAM e a sessão bateu no limite) e foi resolvida em 24/09.

## Decisões
- 2026-09-24 (Júlio): fatura que chega por link aparece como **"Link do portal"**, no lugar de nota e boleto — basta clicar.
- 2026-09-24 (Júlio): **o Claude não mexe na Vercel.** Sobe para o repositório e a Vercel atualiza sozinha.
- 2026-09-24 (Júlio): **repositório `Gestao-TI` volta a público.** No Hobby, privado trava o deploy, e ele não tem Vercel paga.
- 2026-09-24 (Claude): em plataforma de cobrança compartilhada (Omie, ContaAzul), o fornecedor **só é aceito com confirmação pelo nome ou pelo contexto do e-mail**, mesmo havendo um só cadastrado no endereço.
- 2026-09-24 (Claude): o link é guardado como documento próprio, **sem passar pelo Storage**, e vale por nota e boleto ao mesmo tempo.
- 2026-09-24 (Claude): migração que mexe na view tem que **espelhar a view que está no ar**, com as colunas novas no fim — `create or replace view` casa as colunas por posição.
- 2026-09-24 (Claude): a primeira proposta foi **manter o repositório privado** e resolver cadastrando `cpd@lube.com.br` como e-mail secundário na Vercel. Ficou superada pela decisão do Júlio de voltar a público.

## Defeitos encontrados
- **A ION Labs quase entrou como SAAM.** As duas cobram por `pagamentos@contaazul.com`. Corrigido antes de ir ao ar: agora a fatura da ION Labs fica sem fornecedor.
- **E-mail sem anexo era descartado em dois pontos** da leitura (triagem e montagem final). Os dois passaram a aceitar, por remetente, quem está marcado como "documento via link".
- **Recibo e link enviados à mão não fechavam a fatura** — o recibo do ChatGPT continuava pedindo "o boleto". E a validação de tipo não conhecia "recibo". Agora a lista de tipos vem da mesma fonte do seletor da tela.
- **Deploy `BLOCKED` duas vezes seguidas.** O CLI dizia só "UNKNOWN"; quem contou a verdade foi a API de deployment (`account-configuration`). O primeiro diagnóstico — falta de plano pago — estava errado: o "sem assinatura ativa" do `vercel usage` é a resposta normal do Hobby. Detalhe em [[Vercel]].
- **Vencimento da SAAM um mês à frente** (agosto dizia 15/09, setembro 10/10). A leitura não entendia "vencimento **em** DD/MM" nem os **espaços invisíveis** que a ContaAzul põe entre os dígitos da data.
- A ferramenta de edição gravou os caracteres invisíveis literalmente no código; foram trocados por escapes `\u` e conferidos caractere a caractere.
- O Júlio colou a senha real de uma caixa dentro de `scripts/procurar-em-outra-caixa.mjs`. Saiu do arquivo antes de qualquer push e **nunca chegou ao GitHub**.

## Como ficou a SAAM
- Conta marcada como **documento via link**; remetentes `@saamauditoria.com.br` e `@contaazul.com`; razão social SISAUDCON; vencimento **dia 15**.
- Cadastro limpo no caminho: as palavras-chave da conta tinham virado uma URL inteira e voltaram a ser `saam`/`sisaudcon`; saiu um status "documentos recebidos" falso; saiu um "documento" que era só a imagem da assinatura do e-mail.
- Ago/26: vencimento **20/08** (renegociado de 15/08), paga, R$ 1.719,32.
- Set/26: vencimento 15/09, previsto R$ 1.719,32, real R$ 515,80 — só a parcela da NB Technology tinha sido paga. Em 2026-10-05 o vencimento foi para 28/09, reemitido no portal (ver [[2026-10-05 — Documento no mês errado na Itanet, SAAM e Vix]]).

## Depois: IMPREMIX (24 e 29/09)
- 2026-09-24: o Júlio pediu a IMPREMIX, recém-cadastrada, em Faturas e notas com o vencimento de setembro já atrasado. O e-mail de 27/08 era **anterior ao cadastro**, e a varredura só olha os últimos dias — o robô nunca o viu. A fatura (NF 6711, vence 20/09/2026, R$ 2.725,00) foi registrada à mão com os PDFs reais da nota e do boleto.
- 2026-09-29: a nota seguinte entrou como **boleto**. O nome do arquivo não dá pista e o assunto "nf+bol" cita os dois. (Claude) A "Fatura de Locação" da IMPREMIX vale como a nota: quando outro anexo do mesmo e-mail já é boleto pelo nome, o que só virou boleto pelo assunto passa a nota. Os documentos já gravados foram reclassificados: o PDF `6863-LUBE DISTRIBUIDORA.pdf` virou nota fiscal (confirmado como correção manual) e o relatório do período de locação virou "outro".
- O que o Júlio quer daqui para a frente: **poder corrigir a classificação de um documento na tela**, ou que o sistema aprenda sozinho o padrão de cada fornecedor.

## Rastro do deploy travado
- O deploy do `7e9637a` (`dpl_CWH3MDcz313RrhBi4pqkg2KZ5LZ4`) e o anterior ficaram `BLOCKED` (`account-configuration`). O `vercel redeploy` foi recusado ("can not be redeployed... from a fresh commit"), e o site seguiu no ar com a versão anterior.
- O `gh` não está instalado na máquina, e a API pública do GitHub devolvia 404 — foi assim que se viu que o repositório tinha virado privado.
- Depois do commit vazio `8e9933d`, o deploy `dpl_8R82UqiCKbLBNjXg16zmzEKXxb8e` foi de BUILDING a READY. O `b447f7b` subiu em `dpl_ErN32CUr2z3X355HUW6RQyAANA2a`, READY.
- A partir do `7e9637a` (até o `820f07e`) a sessão rodou no modelo Sonnet 5, trocado pelo `/model`.

## O que foi criado ou mudou
- [[GESTÃO TI]]: tipo de documento `link_portal`, `contas.documento_via_link`, `documentos.url_externa` (commit `7e9637a`, migrações `documento_via_link_do_portal` e `documento_via_link_na_view_de_faturas`); commit vazio `8e9933d` para destravar o deploy; vencimento da ContaAzul (commit `b447f7b`); IMPREMIX (commit `820f07e`)
- [[Vercel]]: a seção "Plano Hobby: repositório privado trava o deploy"
- [[Notas, boletos e recibos]]: fornecedor que só manda link

## Pendências
- [ ] Conferir se a parcela SISAUDCON de setembro (NF 38921, R$ 1.203,52) foi paga — estava vencida, com juros no portal — Júlio
- [ ] Para ter repositório privado **sem** travar o deploy: cadastrar `cpd@lube.com.br` como e-mail secundário verificado na conta da Vercel — Júlio, se quiser
- [x] Ver a SAAM com "Link do portal" em produção — no ar em 2026-09-24 (deploy READY depois do repositório voltar a público)

Veja também [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]] e [[Gestão TI - Leitura de e-mail e cobrança]].
