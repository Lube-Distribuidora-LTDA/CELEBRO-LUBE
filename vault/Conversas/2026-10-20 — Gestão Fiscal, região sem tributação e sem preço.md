---
tipo: conversa
data: 2026-10-20
projeto: "[[GESTÃO FISCAL]]"
status: resumido
tags: [conversa, bi, fiscal, tributacao, preco, winthor]
---
# 2026-10-20 — Gestão Fiscal, região sem tributação e sem preço

## Resumo
O Júlio pediu um BI para o Fiscal com "Código do produto | Descrição | Região sem tributação | região sem preço de venda", das
rotinas 203 e 201 do WinThor, "na mesma pegada dos últimos" (informação clara e filtros personalizados). No meio do trabalho
restringiu: "eu preciso de apenas algumas regiões: 18, 19, 23, 31, 33, 35, 39, 40, 41, 42, 43, 46, 27, 37, 38, 45". O Claude
confirmou no WinThor de onde vem cada coisa, criou o schema `fiscal` no DATA WAREHOUSE, o ETL com conferência embutida, a pasta de
integração com instalador e o painel de 4 telas (local; GitHub, Vercel e agendamento esperam o Júlio). Detalhe em [[GESTÃO FISCAL]].

## Como foi
1. **Descoberta (só leitura no Oracle):** `PCROTINA` deu 201 = Precificar Produto, 203 = Cadastrar Produto, 302 = Cadastrar
   Cliente, 514 = tipo de tributação, 574 = tributação nos produtos. A `PCTABTRIB` (que o pedido citava) só tem filial 1 × ES, uma
   linha por produto, e a **tributação por UF está desligada** (`CON_USATRIBUTACAOPORUF = 'N'`): a tributação de saída que vale é o
   `CODST` da `PCTABPR`, a mesma tabela do preço, por região. O "pcclient" da 203 virou a contagem de clientes por região (302).
2. **Medição:** a região 1 (ES) quase não tem pendência (4 sem tributação, 534 sem preço); regiões "ativas" como DF, SE e GO estão
   vazias e sem venda — por isso o painel nasceu pensando em "regiões em uso". O pedido das 16 regiões chegou logo depois e
   simplificou tudo (sem chave de escopo; a região 1 não está na lista — perguntado).
3. **Banco e carga:** diagnóstico sem gravar igual ao WinThor nas 50 regiões; 1ª carga completa (644 mil linhas, ~16 min com o banco
   lento) com a conferência OK; migração 03 e carga com o recorte (116 mil linhas, ~9 min), conferência OK nas 16.
4. **Painel:** feito sobre os componentes do [[MOVIMENTAÇÃO DE INVENTÁRIO]] e do [[GESTÃO COMERCIAL TRADE]]; revisado no navegador
   (escuro e claro). Duas correções de rumo do próprio Claude ao ver a tela: a lista começava por cesta de Natal e itens de consumo
   sem preço em lugar nenhum (passou a começar pelo que mais vende), e a tela ficava 20 s no caminhão esperando o `/api/versao`
   com o banco lento (passou a abrir com a cópia guardada e conferir por trás, como manda a seção 8b do [[data-warehouse]]).
5. **Prova:** tela × banco (7.277 produtos, 6.686 com região sem tributação, 7.133 sem preço) e tela × WinThor no cód. 15722, região
   a região.

### Segunda parte: agendamento, GitHub e Vercel
O Júlio rodou o `INSTALAR TUDO.bat` (carga das 11:34: 7 de 7 `OK`, ~16 s na VM) e pediu: "faça um repositório no Github e suba
para Vercel e me passe as variáveis". O Claude criou o repositório público `GESTAO-FISCAL` pela API do GitHub (o `gh` não está
instalado; usou a credencial do Git da máquina, sem exibir), subiu o código, criou o projeto `gestao-fiscal` na Vercel ligado ao
repositório, registrou na Sentinela e no portal (cartão inativo) **antes** do 1º deploy, publicou (`READY`) e provou de fora que só
abre com login. O endereço `gestao-fiscal.vercel.app` é de outra conta: ficou `gestao-fiscal-olive.vercel.app` (corrigido na
Sentinela e no cartão). Passou ao Júlio a lista das 5 variáveis (nomes e valores sem a senha).

### Terceira parte: variáveis, primeira entrada e só ativos
O Júlio cadastrou as variáveis e pediu o teste. Com o cartão ativado (ele escolheu "Ativar e acompanhar"), a entrada dele deu 502:
o log da Vercel mostrou `EAUTHQUERY user not found` (o usuário do banco chegou diferente do esperado). O Claude fez a API aparar as
variáveis e dizer o que chegou; às 12:01 versão, dados e fotos passaram com a identidade dele. Depois o Júlio pediu "apenas produtos
ATIVOS ... como: CONSUMO, INATIVOS e etc.": o Claude mediu no WinThor (fora de linha, fornecedor INATIVOS, consumo pela descrição e
pelo departamento; o tipo de mercadoria MC marca até Guaraná Antarctica) e o painel passou de 7.277 para 5.318 produtos. A VM rodou
às 13:15 em ponto, ainda com o código antigo: falta o `ATUALIZAR AGORA.bat` lá.

## Decisões
- 2026-10-20 (Júlio): só as regiões 18, 19, 23, 27, 31, 33, 35, 37, 38, 39, 40, 41, 42, 43, 45 e 46.
- 2026-10-20 (Claude): fonte = `PCTABPR` (preço e CODST por região), não `PCTABTRIB`; universo = produtos de revenda não excluídos;
  conferência na mesma transação de leitura do Oracle; sistema "GESTÃO FISCAL" (schema `fiscal`, pasta `17. FISCAL`); cargas aos :15.
  Motivos em [[GESTÃO FISCAL]].
- 2026-10-20 (Claude): GitHub, Vercel e agendamento com o Júlio (mesmo combinado do Trade e do Inventário). _Na segunda parte o
  Júlio pediu que o Claude criasse o repositório e publicasse; as senhas continuam com ele._
- 2026-10-20 (Claude): cartão do portal em **CONTABILIDADE** (a do [[PAINEL ICMS]]), nascido inativo, como o do Inventário.
- 2026-10-20 (Júlio): **só produtos ativos**; a regra (em linha, fora do fornecedor INATIVOS, sem consumo) é do Claude, medida no WinThor.

## O que foi criado ou mudou
- [[GESTÃO FISCAL]]: nota nova do projeto. [[Fiscal - Sync]]: rotina nova (ainda não instalada).
- DATA WAREHOUSE: schema `fiscal` — migrações `fiscal_01_schema`, `fiscal_02_situacao_e_funcao`, `fiscal_03_regioes_escolhidas`;
  cargas às 10:45 e 11:04.
- `Desktop\BI\17. FISCAL` (commits locais `680f2d5`, `3e28128`, `5e39a30`) e `P:\INTEGRAÇÃO BI\FISCAL` (com o `ENV` de leitura copiado
  do Inventário sem exibir a senha).
- `.claude/launch.json` do cérebro: configuração `fiscal` (porta 3103).
- [[Glossário WinThor]], [[Mapa de sistemas]], [[Supabase]], [[WinThor]], [[Como eu gosto dos BIs]], [[Registro de mudanças]] e o `CLAUDE.md`.

## Achados
- Região 27 (Somar ⇒ Espírito Santo): 2.280 produtos com preço e sem tributação.
- Sem preço com tributação concentrado nas regiões de transferência 39, 45, 40 e 41.
- Mais urgentes: 11 casos (9 cestas de Natal 2025; os reais são o Amendoim Kutko na 38 e o Óleo de girassol Sinhá na 42, sem tributação).
- Itens de consumo marcados como revenda inflam o "sem tributação e sem preço".

## Pendências
- [ ] Júlio: a região 1 (Espírito Santo) fica de fora mesmo?
- [x] GitHub, Vercel e Sentinela (Claude, a pedido do Júlio); `INSTALAR TUDO.bat` (Júlio, 11:34; carga conferida).
- [x] Júlio: as 5 `SUPABASE_DB_*` e o Redeploy; cartão ativado (Claude, com o aceite dele).
- [ ] Júlio: `ATUALIZAR AGORA.bat` na `SRV-IA` (regra dos ativos).
- [ ] Ligar no [[GUARDIÃO DA LUBE]] (rotina, tarefa e site).
