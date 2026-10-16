---
tipo: conversa
data: 2026-08-28
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, bi, absenteismo]
registrado_em: 2026-10-09
---
# 2026-08-28 — subtítulo, badge PRO RH e faltas injustificadas no BI de RH

## Resumo
Três ajustes no [[BI ABSENTEÍSMO RH]]: o subtítulo do cabeçalho, o badge "PRO RH" que quebrava em duas linhas e a diferença entre o card de Faltas Injustificadas (**318**) e a planilha exportada (**312**). A causa da diferença era o card usar um critério mais largo que o da exportação.

## Decisões
- 2026-08-28 (Júlio): o número certo é o da planilha (312), porque ela usa o campo oficial `tipo_absenteismo`. O card segue esse critério.
- 2026-08-28 (Júlio): subtítulo do cabeçalho "KPI's - indicador de perfomace", sem "Lube Distribuidora" na frente.

## O que foi criado ou mudou
- Commit `eb75dc1` — subtítulo do cabeçalho (primeiro com "Lube Distribuidora •" na frente, depois só o texto).
- Commit `48d7f05` — badge "PRO RH" com `whitespace-nowrap`. Quebrava em duas linhas e o formato redondo virava quadrado.
- Card de Faltas Injustificadas: passou a contar só `tipo_absenteismo === 'Injustificado'`. Antes somava também motivo "Falta" ou começando com "Suspens". Publicado junto no commit `24d7cfe`, de 2026-08-31.
- `index.html` e a cópia `Dashboard Absenteísmo.html` mantidos idênticos.

## O que se descobriu
O mesmo critério largo aparecia no gráfico **Top 10 Faltas Injustificadas** e na ficha do colaborador. Só o card foi corrigido. **Conferido no código em 2026-10-09:** os dois ainda somam `motivo = 'Falta'`.

## Pendências
- [ ] Alinhar o Top 10 Faltas Injustificadas e a ficha do colaborador ao critério do card — Claude, quando o Júlio pedir

Veja também [[BI ABSENTEÍSMO RH]] e [[Como eu gosto dos BIs]].
