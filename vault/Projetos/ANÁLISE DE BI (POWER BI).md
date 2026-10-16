---
tipo: projeto
departamento: Compras
status: ativo
inicio: 2026-09-16
origem: projeto do Claude "ANÁLISE DE BI (POWER BI)"
tags: [projeto, bi, power-bi]
---
# ANÁLISE DE BI (POWER BI)

Projeto do Claude onde ficam **todas as análises dos BIs do Power BI** que vamos trazer para dentro do banco de dados e reconstruir no padrão da Lube ([[data-warehouse]]).

## Como o projeto trabalha (instrução do projeto)
> Entre no Power BI (https://app.powerbi.com/home?experience=power-bi), acesse o BI pelo "workspace" e ache o BI a ser analisado. Entenda como ele funciona pelo modelo semântico e pelo relatório pronto.

O resultado de cada análise é uma **documentação técnica completa**: origem dos dados, SQL, modelo, regras de negócio, medidas, telas, problemas e roteiro de reconstrução.

## BIs analisados
| BI | Documento | Situação |
|---|---|---|
| COMPRAS | [[BI COMPRAS — documentação técnica]] | Analisado em 2026-09-18 e reconstruído: [[BI COMPRAS]] |
| COMERCIAL | [[BI COMERCIAL — documentação técnica]] | Analisado em 2026-09-28 e reconstruído no mesmo dia: [[BI COMERCIAL]], no ar em `gestao-comercial-web-three.vercel.app` |
| FINAL (Trade, no workspace COMPRAS) | `BI-FINAL-documentacao-tecnica.md` (Downloads, 2026-10-14) | Analisado em 2026-10-14 e reconstruído no mesmo dia: [[GESTÃO COMERCIAL TRADE]] (só na máquina; publicação pendente) |

## O que levar para a próxima reconstrução (aprendido no COMERCIAL)
- **Os horários do BI novo são os mesmos do Power BI antigo** (Júlio, 2026-09-28): o dado fica pronto nos mesmos
  momentos, e a tarefa roda antes, escalonada dos outros ETLs.
- **Nenhuma tela fala de como era no Power BI** (Júlio, 2026-09-28). A história da migração e as diferenças de
  conta ficam no README e na documentação técnica.
- O original pode ter **erro de dinheiro**, não só de tela: no COMERCIAL, a comissão do rodapé não era a soma das
  linhas. Corrigir com o valor antigo ao lado e **medir** depois — das duas duplicidades suspeitas na análise, uma
  não existia na base.
- Validar contra os números lidos do modelo antes de gravar: o diagnóstico soma no Oracle os mesmos valores da
  documentação e imprime obtido × esperado.

- **Regra de cálculo se descobre no dado, não no documento** (2026-10-14, [[GESTÃO COMERCIAL TRADE]]): a venda do "final"
  só fechou com a exportação do Power BI quando a conta foi trocada de `PUNIT − ST` para `PUNIT + VLOUTROS`. Antes de
  reconstruir, comparar **um mês** da planilha original com o WinThor, dia a dia e por equipe.
- **O Power BI antigo pode estar incompleto**: as planilhas salvas à mão deixaram 2023 com ~R$ 17 mi a menos que o WinThor.
  Conferir mês a mês antes de tratar o antigo como verdade.

## Próximos passos
- [ ] Escolher o próximo BI do Power BI para analisar
- [ ] Repetir o mesmo formato de documentação e salvar aqui no cérebro

Veja também [[Como eu gosto dos BIs]] e [[Mapa de sistemas]].
