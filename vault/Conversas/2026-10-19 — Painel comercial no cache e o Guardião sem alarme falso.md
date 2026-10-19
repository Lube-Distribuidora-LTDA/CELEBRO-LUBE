---
tipo: conversa
data: 2026-10-19
projeto: "[[BI COMERCIAL]]"
status: resumido
tags: [conversa, comercial, guardiao, supabase]
---
# 2026-10-19 — Painel comercial no cache e o Guardião sem alarme falso

## Resumo
O Júlio mostrou dois alarmes do Guardião e perguntou por que os scripts não
rodavam como deveriam. Eram **três coisas diferentes**, e só uma era defeito de
script. Corrigidos: o painel comercial passou a ler JSON pronto em vez de
calcular ao abrir, e o Guardião deixou de acusar carga parada quando a tranca
some com a carga ainda viva.

## O que os alarmes eram, de verdade

**1. Margem parada em 10/10 — verdadeiro, e defeito do Claude.** A correção de
13/10 (pôr a `mv_margem_dia` na `VIEWS_DO_PAINEL`) foi commitada e publicada na
Vercel, mas **o ETL não vem da Vercel**: vem da pasta de rede pelo instalador. A
`SRV-IA` continua com o arquivo de **08/10**, e o log prova — ele atualiza quatro
views e a diária não está entre elas. Meio caminho dado por encerrado.

**2. "A carga das 07:45 parou no meio" — falso.** As nove consultas rodaram e
registraram (`comissao_nf` 07:46:34, `margem_filial` 07:46:49, "Todas as
consultas foram carregadas com sucesso" às 07:47:06). A própria verificação do
Guardião já tinha voltado a `ok` às 09:55.

**3. O que está por trás — o banco.** Incidente aberto desde 18/10 04:15 pela
`margem_item` que não registrou, e a configuração do próprio Guardião anota o
mesmo em 11/10 e 13/10. A carga das 09:45 de hoje levou **11 min 29 s** (eram
40 s em setembro).

## Medição do banco, que explica quase tudo
Contar até um milhão — conta pura, sem tocar disco:

| Quando | Tempo | Normal |
|---|---|---|
| 2026-10-14 | 42 s | 0,1 s |
| 2026-10-19 | passou de 120 s (estourou o limite) | 0,1 s |

No `EXPLAIN`, uma busca de **uma linha** por índice, com a página **já em
memória**, levava 18,6 ms (o normal é 0,01 ms), e só o **planejamento** da
consulta — que nem toca no disco — levava 574 ms. Tudo lento pelo mesmo fator:
é a máquina do banco, não o SQL. Mas é **intermitente**: às 10:22 a mesma
`painel_dados` levou 0,7 s.

## O que foi criado ou mudou
- [[BI COMERCIAL]]: `comercial.painel_cache` + `painel_cache_guardar` +
  `painel_servir`; a `/api/dados` passou a ler o pronto; o ETL passou a guardar
  o JSON do mês corrente e do anterior no fim de cada carga.
- [[GUARDIÃO DA LUBE]]: `_avaliar_carga` espera o silêncio antes de acusar
  "parou no meio".

## Decisões
- 2026-10-19: **o painel comercial não calcula mais ao abrir** (Júlio pediu, era
  uma das duas opções oferecidas em 14/10). Mesmo remédio do
  [[REPOSIÇÕES E CHAMADOS]], que respondeu em 0,18 s no dia em que o banco
  saturou. Medido: **100 s → 8 ms**.
- 2026-10-19: o cache **serve a linha guardada mesmo quando uma carga entrou
  depois dela**. Dado de algumas horas, com a data da última carga à vista, é
  melhor do que não abrir.
- 2026-10-19: a diferença para as reposições é que o comercial tem período,
  então o cache é **por (de, ate)**; o ETL aquece os dois meses mais pedidos e
  um período incomum é calculado uma vez e fica guardado.
- 2026-10-19: no Guardião, **"sem tranca" deixa de ser prova de morte**. O
  *advisory lock* morre junto com a sessão, e com o banco instável uma conexão
  reaberta faz a tranca sumir com o processo vivo.

## Pendências
- [x] **`INSTALAR TUDO.bat` rodado na `SRV-IA` às 10:30** (Júlio). A
  `mv_margem_dia` foi de 10/10 para **17/10** e a *Margem por item* de outubro
  voltou ao completo: R$ 7.470.816,94 de venda e R$ 1.513.490,04 de margem em
  50.409 itens. O aquecimento gravou os dois períodos (286 KB e 308 KB).
- [ ] **Decidir sobre a instância do Supabase** (Júlio) — pendente desde 14/10.
  O cache protege o painel, mas não cura a lentidão, que também atinge as
  cargas e é o que vem causando os registros perdidos.
- [x] Aquecimento conferido na carga das 10:30: as duas linhas gravadas, com
  `carga` de referência 19/10 10:30.

Ver também: [[BI COMERCIAL]], [[GUARDIÃO DA LUBE]], [[Supabase]],
[[REPOSIÇÕES E CHAMADOS]], [[Registro de mudanças]].
