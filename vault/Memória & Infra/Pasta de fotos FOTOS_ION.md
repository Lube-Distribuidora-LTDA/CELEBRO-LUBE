---
tipo: nota
departamento: Comercial
status: ativo
tags: [fotos, produto, winthor, trade]
---
# Pasta de fotos FOTOS_ION

A pasta onde ficam as fotos dos produtos: **`P:\FOTOS_ION`** (a unidade `P:` é `\\192.168.0.5\winthor-adm`, então também se chega por `\\192.168.0.5\winthor-adm\FOTOS_ION`; **tarefa agendada não enxerga unidade mapeada, use o caminho de rede**). É a mesma que o [[WinThor]] usa: a coluna `PCPRODUT.DIRFOTOPROD` de cada produto aponta para `P:\FOTOS_ION\<código>.PNG`. Em `P:\INTEGRAÇÃO BI\COMPRAS` há a conferência desses diretórios (`consulta_foto_produtos.py`: 34.425 produtos, 11.203 ativos, 6.656 ativos com diretório vazio ou arquivo ausente em 2026-10-13) e um script de correção com o CSV `correcao_diretorios_2026-10-14.csv`; quem rodou a correção e se ela foi aplicada ao WinThor não está registrado aqui. O Júlio pediu em 2026-10-14 que o [[GESTÃO COMERCIAL TRADE]] pegasse as fotos **direto dela**, e não mais do banco de imagens do Trade (`Z:\TRADE MARKETING\Banco_Imagem`).

## Como ela é (2026-10-14)
- 8.572 entradas, **4 GB**; PNG de 491 KB em média, o maior com 34 MB. Foto em tamanho original não serve para tela: o painel mostra **miniatura WebP** (1,5 MB virou 34 KB), gerada na hora e guardada em `web/cache_img/`.
- **8.441 produtos com foto** (124 códigos têm mais de um arquivo). Nomes bagunçados, de mão em mão: `123.png` (8.121), `123.PNG` (306), `123 .png` com espaço antes do ponto (132), `123 (1).png`, `.jpeg`/`.jpg` (3), mais atalhos `.lnk`, `desktop.ini`, `Thumbs.db` e `Sem Título-1.png`.
- **Regra de leitura** (`etl/fotos.py`): o código é o número no começo do nome; havendo mais de um arquivo, vale o mais "certo": nome exato › com espaço › `(n)` › outro; `.png` › `.jpg` › `.webp`; o mais novo desempata. Arquivo vazio, atalho, `desktop.ini` e nome sem código são ignorados.
- **Só leitura.** Nada do que a Lube faz grava, renomeia ou apaga nessa pasta. Os arquivos com espaço no nome que sobram ao lado do certo (`3184 .png`) podem ser apagados por quem mantém a pasta, mas isso é decisão dele.

## Quem consegue abrir (2026-10-14)
O `P:` do Júlio está mapeado com o usuário **`admwinthor`**. **Correção de 2026-10-15:** a nota dizia que o servidor `192.168.0.5` "só aceita" esse usuário e que o `cmdkey` "não vale para tarefa". Não era bem assim: o `cmdkey` do Júlio tinha **a senha errada**, e isso dava o erro 1326. Com a credencial antiga apagada, a **conta de domínio do Júlio lista a pasta** na `SRV-IA` (sessão dele). Mesmo assim a **tarefa agendada** (senha guardada, não S4U) segue recebendo "acesso de convidado bloqueado" (erro 1272, carga das 09:05); o motivo exato não foi confirmado. O que a carga usa é o `etl/rede.py`, que abre a conexão com usuário e senha explícitos, com a senha em `C:\BI\TRADE\fotos.cred` (cifrada pelo Windows, criada com `Read-Host -AsSecureString`, sem a senha aparecer). O melhor, quando o TI puder: conta só de leitura em `FOTOS_ION`, no lugar do `admwinthor`. Detalhe e estado em [[Trade - Sync]]. Quem **não** precisa disso: o servidor do painel e o `ATUALIZAR AGORA.bat` rodados no logon do Júlio, que já têm o `P:`.

## Na Vercel: miniaturas no banco (2026-10-14)
O painel na Vercel não enxerga esta pasta (rede interna). Por isso o ETL reduz cada foto para um **WebP de 288 px (~11 KB)** e guarda em `trade.produto_miniatura` (8.515 fotos, ~97 MB); a função `api/img` serve de lá. Só a foto nova ou alterada é regravada (compara nome, tamanho e data do arquivo). A primeira carga leu 4,3 GB de PNG em 168 s, sem falha. Foto nova na pasta chega ao painel quando uma máquina que **enxerga** a pasta roda a carga. **Desde 2026-10-15 09:14 a tarefa da `SRV-IA` enxerga** (com o `fotos.cred`, ver "Quem consegue abrir"), então isso acontece sozinho nas 5 cargas do dia; à mão continua valendo `python sync_trade.py --so-miniaturas`. Detalhe em [[Trade - Sync]].

## Qualidade das fotos (2026-10-15)
Das fotos dos 5.193 produtos ativos com foto e nome, **113 não batem com o nome** (2,2%): ver [[Validação das fotos dos produtos — 2026-10-15]], com a lista de códigos. O erro mais comum é peso ou variante diferente do nome; e há pares de fotos trocadas (Cappuccino 3 Corações 26877/26878, Essência Kalipto 31112/31113). Corrigir é decisão de quem mantém a pasta; o painel mostra o que está lá.

## O que o painel faz com ela
O ETL ([[Trade - Sync]]) lista a pasta a cada carga e guarda o mapa código → arquivo em `trade.produto_imagem`. No painel, 5.096 dos 5.414 produtos ativos têm foto (**94,1%**, na carga de 2026-10-14); a tela **Produtos sem imagem** lista os 318 que faltam. Se a pasta estiver fora do ar, a carga usa o mapa que já está no banco.

Origem: [[2026-10-14 — Gestão Comercial recriada do BI final do Power BI]].
