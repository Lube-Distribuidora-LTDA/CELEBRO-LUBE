---
tipo: nota
departamento: Comercial
status: ativo
tags: [fotos, produto, validacao, trade]
---
# Validação das fotos dos produtos — 2026-10-15

Pedido do Júlio (2026-10-15): "uma validação dos produtos que estão com foto, e valide se as imagens estão batendo com o nome do produto; os que não estiverem batendo, traga o relatório apontando os códigos". Contexto: [[GESTÃO COMERCIAL TRADE]], fotos em [[Pasta de fotos FOTOS_ION]], carga em [[Trade - Sync]].

**Relatório em Excel, com a foto ao lado de cada código:** `Validação das fotos dos produtos — 2026-10-15.xlsx` (nesta mesma pasta).

## Resultado
- Validados: **5.193 produtos ativos** com foto e nome no cadastro (pacote `20261015-144432`, depois de uma carga completa às 14:43).
- **113 fotos apontadas (2.2% dos validados)**, por tipo abaixo; uma delas (cód 27042) é uma imagem inútil, só um ícone minúsculo.
  - Outro produto: **11**
  - Outra marca (mesmo tipo de produto): **9**
  - Foto sem utilidade: **1**
  - Variante diferente (sabor, peso, tamanho, formato): **87**
  - Conferir (baixa prioridade): **5**

## Como foi feito
1. Uma carga completa antes (14:43, a partir da LOGISTICA-55): 9 passos `OK`, 8.540 fotos mapeadas, 15 miniaturas novas.
2. 260 folhas de contato (20 produtos por folha: foto, código e nome) olhadas por 13 revisores em paralelo, com o mesmo critério.
3. O Claude conferiu cada apontado com a foto **original** da pasta FOTOS_ION, em tamanho grande; 1 falso alarme descartado (cód 941376).
4. Amostra de controle: 3 folhas inteiras (60 produtos) olhadas à parte, sem erro que tivesse passado; 2 dúvidas pequenas (cód 30938 e 14314) conferidas e certas.

**Fora do alcance:** 1.844 fotos de códigos sem nome no cadastro e 1.503 de produtos inativos. Produtos genéricos (copo, sacola) com qualquer foto do mesmo tipo foram aceitos. Letra miúda ilegível não foi apontada.

## Padrões que apareceram
- **Gelatina Tecnutri/Nutrare (cód 27972, 27974, 27979, 27986):** o sabor da foto não é o do nome (limão no cereja, morango no limão, abacaxi no uva); os cód 27977 e 27978 estão com o sabor certo mas na marca Tecnutri.
- **Cappuccino 3 Corações (cód 26877 e 26878):** as fotos estão **trocadas** (Classic no Chocolate e vice-versa). Também parecem trocadas a Essência Kalipto (cód 31112 e 31113).
- **Pesos que não batem** (Amacitel, Invicto, Rampinelli, Coamo, Sinhá…): a foto mostra 1 kg/1,6 kg onde o nome diz 2 a 50 kg; vale conferir se é a foto ou o nome que está errado.
- Fotos repetidas em vários códigos: aba própria do Excel (tamanhos diferentes do mesmo item costumam ser aceitáveis; o cód 940871, molho shoyu, usa a foto da pimenta malagueta Irici).

## Outro produto (11)
_a foto é de outro tipo de produto, ou de outro item da marca_

| Código | Produto | O que está errado |
|---|---|---|
| 17882 | BEIJINHO DE MOCA C/ CHOC DACOLONIA 30 GR | Foto é Pé de Moça com Chocolate Dacolônia; o nome pede Beijinho de Moça com chocolate. |
| 21721 | PIMENTA REINO PO 500 GR NATIVO | Foto é de massa talharim Venturelli; o nome pede pimenta-do-reino em pó Nativo 500 g. |
| 23829 | SORVETE EM PO YOKI 150GR CHOCOLATE | Foto é Mousse sabor Chocolate Yoki; o nome pede sorvete em pó Yoki 150 g. |
| 26267 | EMB P/ PIZZA 45 CM PRETA | Foto é do achocolatado Chocolatto 3 Corações; o nome pede embalagem para pizza 45 cm preta. |
| 27863 | CAD. 1/ 8 FLEX. ESPIRAL 48 FL TOME NOTA | Foto é de creme dental infantil Trá Lá Lá; o nome pede caderno 1/8 espiral 48 folhas Tome Nota. |
| 27976 | GELATINA 1 KG NUTRARE FRAMBOESA | Foto é Pudim com leite sabor chocolate Tecnutri 1 kg; o nome pede gelatina Nutrare framboesa. |
| 28904 | FAR. TRIGO 25KG COAMO PAO DE ALHO | Foto é a mistura para pão francês Predilecta 25 kg; o nome pede farinha de trigo Coamo para pão de alho 25 kg. |
| 30463 | COLONIA INF TLL BABY 250ML HIDRATA | Foto é o sabonete líquido Trá Lá Lá Baby (frasco com pump); o nome pede colônia infantil Trá Lá Lá Baby Hidrata. |
| 940871 | MOLHO SHOYU 1,01LT MESHIAH | Foto é de molho de pimenta malagueta Irici; o nome pede molho shoyu Meshiah 1,01 L. |
| 940894 | MOLHO 150G MESHIAH PIMENTA VERDE | Foto é o sachê de pimenta Sriracha Fugini; o nome pede molho de pimenta verde Meshiah 150 g. |
| 940907 | COLORAU 70 GR SABORITI | Foto é o Creme de Cebola Saboriti 64 g; o nome pede colorau Saboriti 70 g. |

## Outra marca (mesmo tipo de produto) (9)
_o tipo bate, mas a marca da embalagem é outra_

| Código | Produto | O que está errado |
|---|---|---|
| 15834 | ACUCAR MASCAVO ORGANICO 500GR DACOLONIA | Foto é do Açúcar Mascavo Orgânico Saúde da Terra 500 g; o nome pede Dacolônia. |
| 20955 | SELETA LEGUMES 170GR LATA PREDILECTA | Foto é da lata Quero Seleta de Legumes 280 g; o nome pede Predilecta 170 g. |
| 28173 | SAL GLOBO HIMALAIA ROSA FINO 500G POTE | Foto é do Sal Rosa do Himalaia Fino 500 g da Essenciali; o nome pede Globo. |
| 28709 | DOCE LEITE ZEROLACTOSE PIRACANJUBA 350GR | Foto é a caixa de doce de leite Portão de Cambuí; o nome pede doce de leite zero lactose Piracanjuba 350 g. |
| 30007 | TINT CR MARCIA 12.11 LOURO PLATINADO | Foto é Cor&Ton 12.11 (Niely); o nome pede a tintura creme Márcia 12.11. |
| 30322 | DETERGENTE ATILA 500ML COCO | Foto é o lava-louças Teiú Coco 500 ml; o nome pede Atila. |
| 30468 | SAB LIQ TRALALA 180ML HIDRATA REFIL | Foto é o refil de sabonete Johnson's Baby 180 ml; o nome pede Trá Lá Lá Hidrata. |
| 30925 | LUVA NITRILI DESC BOMPACK PRETA GG 100UN | Foto é a luva nitrílica preta Vabene 100 un; o nome pede Bompack GG (tamanho não legível). |
| 940601 | MINI ARROZ ARBORIO 500GR ALTO MARINS | Foto é o arroz Arbório Rampinelli 500 g; o nome pede Alto Marins. |

## Foto sem utilidade (1)
_a imagem não deixa ver o produto_

| Código | Produto | O que está errado |
|---|---|---|
| 27042 | CHIPS GULOZITOS 80GR CHURRASCO | A foto é um ícone minúsculo num quadro branco: não dá para ver marca nem sabor (Gulozitos Churrasco 80 g). |

## Conferir (baixa prioridade) (5)
_pode estar certo: mesma fabricante ou outra versão da embalagem_

| Código | Produto | O que está errado |
|---|---|---|
| 1002 | PILHA RAYOVAC AM. SM PEQUENA AA 4 UN | Foto é a Rayovac Alcalina AA (azul) com 4 pilhas; o nome diz 'AM.' (linha amarela, como os cód 1000 e 1001). Conferir. |
| 27977 | GELATINA 1 KG NUTRARE LIMAO | Sabor limão bate; a embalagem é Tecnutri Food Service e o nome diz Nutrare (pode ser a mesma fabricante). Conferir a marca. |
| 27978 | GELATINA 1 KG NUTRARE MORANGO | Sabor morango bate; a embalagem é Tecnutri Food Service e o nome diz Nutrare (pode ser a mesma fabricante). Conferir a marca. |
| 940677 | ELMA CHIPS SENSAÇÕES PEIT PE 35G PP | Embalagem diz 40 g; o nome diz 35 g (pode ser outra versão da embalagem). Conferir. |
| 940926 | FIO DENT DENTALFLEX WOMAN 100M | Foto é o fio dental Hillo 100 m; o nome diz Dentalflex Woman (pode ser a mesma fabricante). Conferir a marca. |

## Variante diferente (sabor, peso, tamanho, formato) (87)
_mesma marca e linha, mas o que está na embalagem difere do nome; em vários casos de peso o erro pode estar no NOME do cadastro_

| Código | Produto | O que está errado |
|---|---|---|
| 108 | MATE LEAO 200 GR | Embalagem mostra 250 g; o nome diz 200 GR. |
| 5249 | FLANELA 38 X 58 CM LARANJA | Embalagem diz flanela 28 x 48 cm; o nome pede 38 x 58 cm. |
| 5939 | FAR. TRIGO 1KG NUMERO UM FERMENTO PLAST | Foto é a farinha Número Um comum (tipo 1, sem fermento); o nome pede 'fermento'. |
| 8128 | ASSAD RED. C/TAMPA M 2,4 LT 1.6495.25-7 | Nome é de assadeira REDONDA; a foto é de assadeira retangular (Marinex). |
| 8389 | FLOCAO PRE COZIDO SINHA 400GR | Embalagem mostra 500 g; o nome diz 400 GR. |
| 10154 | MILHO PIPOCA SINHA PREMIUM 400GR | Embalagem mostra 500 g; o nome diz 400 GR. |
| 11945 | ESSENCIA AROMATEC MIL FLORES 100 ML | Rótulo diz Flores do Cerrado; o nome pede Mil Flores. |
| 14275 | LUVA VINIL DESCART. TRANSP. PO M 100 UN | Caixa mostra tamanho G; o nome pede M. |
| 14675 | MOLHO SALADA CASTELO PARMESAO 236 ML | Rótulo diz Rosé; o nome pede Parmesão (foto repetida do cód 14674). |
| 15427 | CAFE PO 3CORACOES 250GR EXTRA FORTE | Embalagem mostra 500 g; o nome diz 250 GR (a mesma imagem serve ao cód 15496, 500 GR). |
| 15488 | SABAO MARMORIZADO TEIU 450 GR | Embalagem mostra 500 g; o nome diz 450 GR (diferença pequena). |
| 16110 | CHA NOBEL 10UN HIBISCO | Caixa diz 15 sachês; o nome diz 10 UN. |
| 16279 | AZEITONA PRETA 2K FATIADA CAMPOBELO | As azeitonas da foto são VERDES; o nome diz preta. |
| 16316 | PAZINHA SORVETE STRAWP GDE SORTIDA 200UN | Embalagem diz Pazinha PEQUENA; o nome diz GDE (grande); foto igual à do cód 16315. |
| 16647 | COND. SEDA 325ML PRETO LUMINOSOS | Foto é do Seda Ceramidas (frasco rosa); o nome pede Pretos Luminosos (cód 16657 tem o preto). |
| 16804 | SUCO PRONTO MARATA 200ML UVA | Embalagem diz 1 litro; o nome diz 200 ML. |
| 16951 | DEO ROLL REXONA 50ML FEM INVISIBLE | Embalagem diz Powder Dry; o nome pede Invisible. |
| 17841 | TEMPERO PO SINHA ARROZ 50 GR | Foto é o tempero Sinhá para carnes, legumes e arroz (mesma arte do cód 15432); o nome pede o tempero para arroz. |
| 18109 | FECULA MANDIOCA AMAFIL 1KG | Embalagem diz 25 kg; o nome diz 1 KG. |
| 20419 | ARROZ PARBOILIZADO 2KG RAMPINELLI | Embalagem diz 1 kg; o nome diz 2 KG. |
| 20511 | CHA MAIS MATE VERDE, MACA CAPIM-C 10 SAQ | Caixa é do Chá Mais Chá Verde; o nome pede o misto de mate verde, maçã e capim-cidreira. |
| 20967 | FAR. TRIGO 5KG COAMO | Embalagem diz 1 kg; o nome diz 5 KG. |
| 21137 | MOLHO TOMATE TRAD 300G PRAMESA SACHE | Embalagem é do molho Refogado, 340 g; o nome pede o Tradicional 300 g. |
| 21476 | CHARQUE FRINENSE 400 GR DIANTEIRO | Embalagem diz 500 g; o nome diz 400 GR. |
| 21664 | PIRULITO BLONG 672G BLUE | Embalagem diz 600 g; o nome diz 672 G. |
| 21665 | PIRULITO BLONG 672G BLACK | Embalagem diz 600 g; o nome diz 672 G. |
| 22717 | DEO AERO AXE 150ML BLACK | Embalagem é Axe Dark Temptation; o nome pede a fragrância Black. |
| 24357 | COND. SEDA 300ML JUNTINHO BRILHO ENCANT | Foto é o Seda Juntinhos Tiana (Crespos Encantados, rosa); o nome pede Brilho Encantado. |
| 24423 | BALAO ANIV BOMPACK LISO AZ ESC N7 30 UN | Balões da foto são azul CLARO; o nome pede azul ESCURO. |
| 24425 | BALAO ANIV BOMPACK LISO LARANJA N7 30 UN | A foto é o pacote de balões SORTIDOS; o nome pede laranja. |
| 24771 | SABAO PO COQUEL 800GR CX VEGANO | Embalagem diz 1 kg; o nome diz 800 GR. |
| 25320 | LEITE COND CAMPONESA SEMI 2,5KG 4% | Embalagem é leite condensado INTEGRAL (8% de gordura); o nome pede o SEMI (4%). |
| 26243 | FARINHA EMPANAR PANKO 200GR QUALIMAX | Embalagem diz 1 kg; o nome diz 200 GR. |
| 26383 | REFRI GUARANA ANTARCTICA 350ML ZERO LT | A lata é do Guaraná Antarctica tradicional; o nome pede o ZERO. |
| 26457 | MOLHO TOMATE PIZZA 1,7KG CEPERA SACHE | Embalagem é o molho Tradicional Cepêra; o nome pede o molho de PIZZA. |
| 26877 | CAPPUCCINO 3C LIQUIDO 260ML CHOCOLATE | Foto é do Cappuccino CLASSIC; o nome pede CHOCOLATE (fotos dos cód 26877 e 26878 estão trocadas). |
| 26878 | CAPPUCCINO 3C LIQUIDO 260ML CLASSIC | Foto é do Cappuccino CHOCOLATE; o nome pede CLASSIC (fotos dos cód 26877 e 26878 estão trocadas). |
| 27153 | LEITE 1LT PIRACANJUBA ZEROLACTOSE DESNAT | Foto é do Pira Kids Zero Lactose INTEGRAL; o nome pede o desnatado. |
| 27501 | ANTIMOFO PO QUALITYPAN 800 GR | Foto é do Antimofo LÍQUIDO QualityPan (galão 5 L); o nome pede o antimofo em PÓ 800 g. |
| 27542 | SABAO BARRA RAZZO 180GR LIMAO | Embalagem é o Razzo Azul Anil (branqueador); o nome pede o de Limão. |
| 27643 | MOLHO LIMAO 150 ML GOTA MARATA | Rótulo é Molho de Salsa; o nome pede Molho de Limão. |
| 27866 | AZEITONA VERDE 2K C/CAROCO AGROMAIS | Rótulo diz azeitona verde SEM caroço; o nome pede COM caroço. |
| 27972 | GELATINA 1 KG TECNUTRI CEREJA | Pacote diz LIMÃO; o nome pede cereja. |
| 27974 | GELATINA 1 KG TECNUTRI LIMAO | Pacote diz MORANGO; o nome pede limão. |
| 27979 | GELATINA 1 KG NUTRARE UVA | Pacote diz ABACAXI; o nome pede uva. |
| 27986 | GELATINA 1 KG TECNUTRI UVA | Pacote diz ABACAXI; o nome pede uva. |
| 28171 | SAL GLOBO MARINHO INTEGRAL 500GR POUCH | Embalagem é o Sal Globo Refinado Extra; o nome pede o Marinho Integral. |
| 28438 | SABAO PO INVICTO 800GR SACHE SUPERACAO | Embalagem diz 1,6 kg; o nome diz 800 GR. |
| 28448 | SABAO PO INVICTO 2,4KG SACHE SUPERACAO | Embalagem diz 4 kg; o nome diz 2,4 KG. |
| 28544 | REFRESCO MARATA 25GR CUPUACU - RENDE 1L | Embalagem é do sabor Caju; o nome pede Cupuaçu. |
| 28758 | COLHER PLAST. ULTRATALHER REFEIC BR 50U | Embalagem é de Colheres SOBREMESA; o nome pede REFEIÇÃO. |
| 28808 | SACOS LIXO INDUP. TRANSP 200LT 100UN | Foto é de saco de lixo PRETO; o nome pede transparente. |
| 28842 | SAB LIQ PREMISSE 300ML ERVA DOCE REFIL | Embalagem diz 450 ml; o nome diz 300 ML. |
| 28901 | RACAO GATO WHISKAS 85G FRANGO FILHOTE | Embalagem é sabor Carne ao molho; o nome pede Frango. |
| 29275 | RACAO GATO WHISKAS 500G FRANGO LEITE | Embalagem é sabor Carne, 900 g; o nome pede Frango e Leite, 500 g. |
| 29450 | AGUA TONICA SCHWEPPES 350 ML | Foto é o Schweppes Citrus (lata); o nome pede Água Tônica Schweppes. |
| 29963 | TINT CR MARCIA 3.0 CASTANHO ESCURO | Caixa é o tom 2.0 Preto Suave; o nome pede 3.0 Castanho Escuro. |
| 30029 | AMPOLA TRAT HIDRASHOK 10ML OLEO COCO | Rótulo é Queratina e Vitamina B5; o nome pede Óleo de Coco. |
| 30087 | ABS CLINOFF S/ABAS C/08UND | Embalagem diz 'Com Abas'; o nome pede sem abas. |
| 30276 | REMOVEDOR ESMAL SEM ACETONA MARCIA 100ML | Rótulo é de solução à base de ACETONA; o nome pede SEM acetona. |
| 30328 | DESINF PINHO BRIL 500ML PROMO C LAVANDA | Frasco verde, Flores de Limão; o nome pede o promocional com Lavanda. |
| 30388 | BATATA PALHA 400G BOA EXTRAFINA | Embalagem diz 1 kg; o nome diz 400 G. |
| 30445 | BATATA PALHA 900G BOA | Embalagem diz 1 kg; o nome diz 900 G. |
| 30461 | SAB LIQ TRALALA 180ML SUAVE REFIL | Refil da foto é Trá Lá Lá Baby Hidrata (verde); o nome pede a linha Suave. |
| 30464 | FEIJAO VERMELHO 1KG SAO MATEUS | Rótulo diz Feijão CARIOCA; o nome pede VERMELHO. |
| 30467 | CR DESEMB INF TLL BABY SPRAY 250ML PROT | Foto é do spray Trá Lá Lá KIDS de 300 ml; o nome pede o BABY de 250 ml. |
| 30538 | ARROZ PREMIUM 5KG RAMPINELLI | Embalagem diz 1 kg; o nome diz 5 KG. |
| 30585 | ACUCAR CRISTAL 50KG ALCON | Embalagem diz 5 kg; o nome diz 50 KG. |
| 30592 | RACAO CAO PEDIGREE 100G CARNE MOLH SEN | Foto é o saco de 20 kg de ração Pedigree Adulto (seca); o nome pede o sachê úmido de 100 g, carne molho. |
| 30619 | SH. SKALA 325ML MELANCIA | Rótulo diz MORANGO; o nome pede Melancia. |
| 30656 | KIT SH325+COND200ML SKALA CEREJA | Caixa diz Ceramidas; o nome pede o kit Cereja. |
| 30660 | SH. SKALA 600ML GLICOLICO | Frasco da foto é de 325 ml; o nome diz 600 ML. |
| 30751 | SABAO PO AMACITEL 2,4KG SACHE ROSA | Embalagem diz 1,6 kg; o nome diz 2,4 KG (mesma imagem do cód 30753). |
| 30753 | SABAO PO AMACITEL 4KG SACHE ROSA | Embalagem diz 1,6 kg; o nome diz 4 KG (mesma imagem do cód 30751). |
| 30754 | SABAO PO AMACITEL 4KG SACHE AZUL | Embalagem diz 1,6 kg (antes 2 kg); o nome diz 4 KG. |
| 30848 | MAC. RENATA OVOS FURADINHO 5 500 GR | Embalagem é Renata LINGUINE com ovos; o nome pede FURADINHO. |
| 31112 | ESSENCIA KALIPTO 120ML CONC FLORAL/TALCO | Rótulo diz Chá Branco; o nome pede Floral/Talco (parece trocada com a foto do cód 31113). |
| 31113 | ESSENCIA KALIPTO 120ML CHA BRANCO | Frasco é o Floral (vermelho); o nome pede Chá Branco (parece trocada com a foto do cód 31112). |
| 31141 | MAC. SANTA AMALIA SEMO NINHO3 FETUC 500G | Embalagem é massa COM OVOS; o nome pede massa de semolina (SEMO). |
| 940970 | WHEY PIRACANJUBA 250ML 23GR FRUTAS VERME | Rótulo é sabor BAUNILHA; o nome pede Frutas Vermelhas. |
| 940986 | PROTETOR CERDAS DENTALFLEX C/2 | Foto é o protetor de cerdas Hillo com 4 unidades; o nome pede Dentalflex com 2 (C/2). |
| 941211 | CHA NOBEL 10UN FRUTAS VERMELHAS | Caixa é Chá Verde com MARACUJÁ; o nome pede Frutas Vermelhas. |
| 941241 | FILTRO PAPEL MELITTA CAF ELET N4 30UN | Caixa diz 60 unidades; o nome diz 30 UN. |
| 941471 | CR DENTAL BIANCO ULTRAFRESH FRUITMIN 70G | Embalagem é Supermint; o nome pede Fruitmin. |
| 941670 | CHOCOLATE PO 50% 1,01KG JUNCO | A caixa mostrada é a de 200 g; o nome pede 1,01 kg. |
| 941712 | GOIABADA CREMOSA AMORE 500GR | Rótulo diz 400 g; o nome diz 500 GR. |
| 941972 | SUPLEM ALIMENT B12 LIQ 20ML | Foto é a Vitamina B12 em CÁPSULAS (60); o nome pede B12 LÍQUIDA 20 ml. |

