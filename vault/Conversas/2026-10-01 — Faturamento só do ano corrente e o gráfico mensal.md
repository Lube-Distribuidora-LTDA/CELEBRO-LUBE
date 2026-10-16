---
tipo: conversa
data: 2026-10-01
projeto: "[[BI COMPRAS]]"
departamento: Compras
status: resumido
tags: [conversa, bi, compras, faturamento, supabase, grafico]
---
# 2026-10-01 — Faturamento só do ano corrente e o gráfico mensal

## Resumo
O Júlio pediu para o [[BI COMPRAS]] guardar só os dados de janeiro até o mês atual, com o ano anterior saindo sozinho a
cada virada. O corte foi feito na consulta que lê do [[Oracle]], e o painel passou a montar os períodos a partir do que
existe na base. A tabela de faturamento caiu de **1,63 milhão para 251 mil linhas** (387 MB → 61 MB), e o banco foi de
2.048 MB para 1.722 MB. Só as páginas 06 Performance e 07 Métricas mudaram; as outras já eram retrato do momento ou
histórico de verba. Em seguida o Júlio pediu para esticar o gráfico de Métricas, porque os rótulos encostavam.

## Decisões
- 2026-10-01 (Júlio): guardar só de janeiro até o mês atual, e **só no COMPRAS**. A maior tabela do banco,
  `comercial.fato_margem_item` (689 MB), não foi mexida.
- 2026-10-01 (Claude): cortar na consulta do Oracle, **sem DELETE**. A tabela é recarregada inteira (TRUNCATE + INSERT)
  toda madrugada, então a limpeza anual acontece sozinha na primeira carga de janeiro, sem rotina de expurgo.
- 2026-10-01 (Claude): a verba (páginas 02 e 08) guarda o **histórico inteiro** (721 linhas): o saldo de um fornecedor
  só fecha somando a vida toda.
- 2026-10-01 (Claude): o painel não promete o que a base não tem. Opções e rótulos de período saem dos meses carregados.
- 2026-10-01 (Claude): largura da coluna calculada pelo rótulo, e não por um valor fixo. Se os valores crescerem (de "mi"
  para "bi"), o gráfico se ajusta sozinho.

## O que foi criado ou mudou
- Commit `742556f`:
  - `etl/consultas_compras.py`: `_data_inicial()` passa a ser 1º de janeiro do ano corrente (o gancho
    `FATURAMENTO_DATA_INICIAL` no `ENV` continua valendo); descrição "Consulta10 — sell-out do ano corrente";
    `linhas_esperadas=None` no faturamento (a contagem cresce de janeiro a dezembro e zera na virada);
  - `web/index.html`: as opções de período saem dos meses da base (`periodoDaBase`, `opcoesPeriodo`, `periodoInicial`,
    `rotuloJanela`); o seletor some quando há uma janela só; saem "Desde 2021" e "24 meses"; o rótulo vem da base
    ("jan/26 – out/26");
  - página 06: as colunas "12m" da tabela de compradores só aparecem com mais de 12 meses; textos das páginas 06 e 07 e
    notas técnicas atualizados; "1 mês considerado" no singular; "Média mensal" com "—" quando ainda não há mês fechado.
- P: desmapeado e mapeado de novo (`net use P: /delete /y` e `net use P: \\192.168.0.5\winthor-adm /persistent:yes`);
  `consultas_compras.py` copiado para o P: e para o `C:\BI\COMPRAS` da VM, conferido com `.Contains()`; o Júlio rodou as
  duas tarefas na VM.
- Resultado no DATA WAREHOUSE: `compras.fato_faturamento` de 1.632.611 para **251.362 linhas** (01/01/2026 a
  01/10/2026) e de 387 MB para 61 MB; banco de 2.048 MB para 1.722 MB; `mv_fat_mes` com 10 meses.
- Commit `264f1bc` (`montarColunas`): a largura mínima da coluna sai do maior rótulo a ser desenhado (fonte mono de
  10,5 px, cerca de 6,8 px por caractere com folga); o `.chart-box` rola na horizontal se o gráfico não couber no
  cartão. Folga mínima medida entre rótulos: 17,2 px na Evolução mensal, 21,4 px na Venda das últimas 9 semanas e
  43,1 px na Distribuição da cobertura.

## Erros e incidentes
- O P: caiu na LOGISTICA-55 e a cópia pelo caminho UNC foi bloqueada pela política da empresa. Na primeira tentativa a
  VM copiou o arquivo antigo e o faturamento ficou com 1,63 milhão de linhas.
- O `net use` deu erro 85 (mapeamento quebrado pendurado), e um `Copy-Item` foi colado no campo de usuário.
- O Júlio viu Métricas ainda mostrando 2021, mas a produção já estava certa: era cache do navegador (resolve com
  Ctrl+Shift+R ou com o botão Atualizar).
- Rótulos de valor sobrepostos na evolução mensal ("R$ 12,6 mi" sobre "R$ 12,9 mi").

## Preferências do Júlio
Banco mais leve, guardando só o ano corrente, com a limpeza anual acontecendo sozinha. Dados dos gráficos bem separados,
sem rótulo encostando no outro.

## Pendências
- Em janeiro de 2027, Performance e Métricas vão ter poucos dias de dado (custo aceito). Se incomodar, afrouxar com
  `FATURAMENTO_DATA_INICIAL` no `ENV`, sem mexer no código.
- Não há mais comparação com o ano anterior no painel (custo aceito).
- [ ] O comentário da tabela `compras.fato_faturamento` no banco ainda diz "desde 2021". Corrigir na próxima migração do COMPRAS.
