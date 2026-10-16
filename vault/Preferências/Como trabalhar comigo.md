---
tipo: preferencia
status: ativo
tags: [preferencia, conversa]
---
# Como trabalhar comigo

O que já ficou claro nas conversas. Atualize sempre que aparecer algo novo.

- **Idioma:** português do Brasil.
- **Simples primeiro.** Não gosto de soluções complicadas, com muitos passos, scripts e ferramentas. Se der para fazer em um passo, faça em um.
- **Faça em vez de explicar.** Quando for possível executar (criar a nota, salvar no cérebro, arrumar a pasta), execute e me mostre o resultado.
- **Respostas diretas:** o que eu preciso fazer, em poucos passos.
- **Não me faça explicar de novo.** Consulte o cérebro antes de perguntar.
- **Visual importa:** gosto de interfaces bonitas, escuras, no estilo do painel do [[Cérebro da Lube]].
- **Tudo centralizado:** conversas, skills, projetos e conceitos vão para este vault.

## Acrescentado em 2026-09-25 (conversa do [[SISTEMA FINANCEIRO]])

- **Meu terminal é o Windows PowerShell.** Comando com `&&` para encadear **não funciona** lá — dá
  erro de parser e não roda nada. Me passe um comando por linha, ou já no formato do PowerShell.
- **Dado de pessoa não vai para o repositório.** Salário é nominal e identificável: o lugar dele é o
  banco. Repositório guarda código, schema e documentação.
- **Painel com dado sensível nasce protegido.** Desde 2026-10-06 **todo sistema só abre para quem tem
  acesso pelo [[PAINEL LUBE DISTRIBUIDORA]]**, pelo "exige login" da [[SENTINELA LUBE]] — o [[BI COMPRAS]]
  também. A única exceção é o [[SAC]], aberto de propósito para os RCAs, por um atalho na tela de login do
  portal (decisão minha). A proteção da [[Vercel]] sozinha não basta: no plano Hobby ela não cobre o
  endereço principal, e a folha do [[SISTEMA FINANCEIRO]] respondeu sem login até 2026-10-06.
  _Até 2026-10-09 esta linha dizia que o COMPRAS ficava aberto por decisão minha e que a proteção da
  Vercel cobria a folha._

## Acrescentado em 2026-09-23 (conversa do [[GESTÃO TI]])

- **Alarme falso é pior que nenhum alarme.** Conta já entregue não pode aparecer "em atraso", e conta de débito automático não pode ficar vermelha todo mês. Quem vê atraso onde não há para de acreditar no aviso, e aí o atraso de verdade passa despercebido.
- **Nada pode sumir em silêncio.** Se o sistema descartou um documento, cortou e-mails por limite ou não conseguiu ler um valor, isso tem que aparecer na tela. Documento que some sem aviso só é descoberto quando o boleto vence.
- **Melhor campo vazio que número errado.** Valor e vencimento saem de dentro do documento, conferidos no dígito verificador. Sem chute, sem "pegar o maior número da página".
- **Não me traga histórico que eu não pedi.** Assinatura precisa só do comprovante do ciclo atual. Buscar meses anteriores enche a tela e chegou a trocar o valor da conta do mês.
- **Quando eu pedir um documento, traga o arquivo.** Não basta dizer onde está: baixe e me entregue na conversa.
- **Exportação leva a cara do sistema.** Planilha que sai do painel vai com a marca da Lube, as cores, e os filtros aplicados escritos dentro dela — senão quem recebe lê uma lista parcial como se fosse completa.
- **Senha não entra em arquivo, nem no exemplo de uso.** Se eu colar uma senha no código, tire de lá e me avise. O certo é variável de ambiente, que morre quando o terminal fecha.

## Acrescentado em 2026-09-23

- **Prove, não afirme.** "Funcionou" só vale com evidência independente: a carga se confere no `controle_carga`, não no log da tela nem de memória. O mesmo para o painel — abrir a URL e ver o conteúdo.
- **Não me faça diagnosticar no lugar do script.** Quando algo falha, prefiro um script que descubra a causa sozinho e me diga em uma frase, em vez de rodadas de tentativa e erro consumindo meu tempo. Foi assim que a tarefa-cobaia do agendador nasceu.
- **Assuma o erro quando for seu.** Se o script errou, diga que o script errou. Não me deixe achando que a culpa foi minha.
- **Me avise do risco, mas a decisão é minha.** Quando eu escolher o caminho mais aberto (como liberar o painel sem senha), registre a consequência com clareza e siga em frente.
- **Senhas não entram no vault nem nas skills**, mesmo que eu autorize. Elas ficam só no `ENV` da máquina e nas variáveis de ambiente da Vercel. Dados de conexão que não são segredo (host, porta, service, usuário, id do projeto) podem e devem ser registrados, porque poupam tempo.
- **Documentação que mente é pior que nenhuma.** Se a realidade mudar (o painel deixou de ser restrito, por exemplo), o README e a nota mudam junto.
- **Se eu disser que a mudança foi minha, aceite.** Não insista que foi você nem repita a correção — corrija o registro e siga.

## Acrescentado em 2026-09-17

- **Quando eu disser que um número está errado, vá ao dado antes de mexer no código.** Em vez de "corrigir" o rótulo, consulte a origem e me mostre o que existe de verdade. Foi assim que apareceu o buraco de um mês inteiro no [[BI ABSENTEÍSMO RH]]: o rótulo estava certo, faltava o dado.
- **Se eu me contradisser, aponte a contradição em vez de adivinhar** qual das duas versões eu quis dizer. Duas regras que não podem valer ao mesmo tempo viram retrabalho se você escolher por mim.
- **Bloqueio de permissão não é desculpa para parar.** Se não puder aplicar (uma migração em produção, por exemplo), deixe pronto e versionado, diga exatamente o que rodar e onde, e siga com o resto.
- **Diga o que ficou de fora.** Terminou metade? Diga qual metade e por quê, sem enfeitar.

## Acrescentado em 2026-10-07 (conversa de [[2026-10-07 — Ajustes do painel de Reposições e a lentidão ao abrir]])

- **O que eu mostro para os outros tem que abrir na hora.** Espera na tela, ainda mais na frente da empresa a quem estou apresentando, é falha — não detalhe. Quando eu reclamar de lentidão, trate como urgente: **meça antes de mexer**, ache a causa de verdade e me entregue algo que proteja a próxima demonstração, mesmo que a causa esteja fora do código (aqui era o banco do Supabase saturado).
- **Se o diagnóstico mudar no meio do caminho, diga.** Eu havia dito "o banco esfria quando fica parado"; um teste mostrou que era pool esgotado. Corrija o que escreveu — no código, no README e no cérebro — em vez de deixar a explicação antiga de pé.
- **Renomear coluna é motivo para conferir a conta dela.** Pedi "Itens → SKU" e o número estava errado para o nome novo (1.201 linhas de item contra 761 produtos distintos).
- **"Anote tudo isso no cérebro" quer dizer tudo:** a conversa, as decisões, os erros, o incidente, o padrão novo no manual e as notas que ficaram desatualizadas (o painel já estava publicado e três notas ainda diziam que não).

## Acrescentado em 2026-09-01 (conversas do [[BI ABSENTEÍSMO RH]])

- **Ao corrigir uma coisa, não estrague o que já estava bom.** No modo claro do RH, o acerto de contraste escureceu badges que estavam legíveis: "você mexeu neles enquanto acertava os outros" (2026-09-01, [[2026-08-31 — logo, modo claro e título da aba no BI de RH]]). Depois de cada ajuste, confira o resto da tela.
- **Antes de construir, leia a planilha de exemplo que eu mandar** e entenda o que ela traz (2026-09-14, [[2026-09-14 — aba InterJornadas no BI de RH]]). Ela é referência: se tiver dado de pessoa, fica fora do repositório.
- **Número grande que parece erro ganha explicação ao lado, sem mudar o valor.** Um descanso de 66h na interjornada era folga de verdade: o valor ficou, e a ficha passou a dizer quantos dias de folga há no meio (2026-09-15).

## Acrescentado em 2026-09-10 (conversas do [[GESTÃO DE SAÍDA DE VEÍCULOS]])

- **Tudo nos mínimos detalhes, certinho** ([[2026-09-09 — Criação do sistema de Saída de Veículos]]).
- **Eu mostro o visual com uma referência.** Imagem anexada na conversa ou HTML de design deixado na pasta do sistema (export do Claude Design): o sistema fica fiel a ela. Quando não gosto do visual, mando prints dos meus outros sistemas (RH, ICMS): mantenha a estrutura e mude só o visual. O portal partiu de uma imagem "Cinematic Noir" (2026-09-14, [[PAINEL LUBE DISTRIBUIDORA]]).
- **Percebo quando o número muda.** Se a tela passar a mostrar menos (ou mais), explique a causa antes de eu perguntar (2026-09-11, [[2026-09-11 — Título e filtro de placa no Saída de Veículos]]).

## Acrescentado em 2026-09-11 (conversa de [[2026-09-10 — Regime Atacadista e a identidade V1 no Painel ICMS]])

- **Em tema grande, converse antes de codar.** No Regime Atacadista do [[PAINEL ICMS]] eu parei o código e pedi para só conversar.
- **Foco no que o usuário final precisa.** O Sérgio só quer saber quanto vai pagar de ICMS por mês; o resto vem depois.

## Acrescentado em 2026-09-15 (conversa de [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]])

- **Clique sem resposta parece travado.** Toda tela reage na hora ao clique, nem que seja com um esqueleto de carregamento.
- **Mando o print do erro; ache a causa no log**, sem adivinhar.
- **Não me bloqueie no cadastro.** Prefiro poder excluir e ver o efeito na hora, com o aviso do que vai junto antes de confirmar.
- **Sistema novo se entrega testado com dado real**, não só cadastrado: conferido contra a planilha do dono e contra os documentos de verdade, com o que venceu no mês.

## Acrescentado em 2026-09-15 (conversa de [[2026-09-23 — criação do Painel Lube Distribuidora]])

- **Mostre o que existe, mesmo sem acesso.** Sistema não liberado aparece cinza, com cadeado, para a pessoa saber o que pedir ao TI (2026-09-15).
- **Liberar acesso em poucos cliques:** "todos, exceto" em vez de marcar um a um (2026-09-30).
- **Exceção de acesso é pontual**, só para quem eu indicar: a consultora externa no portal (2026-10-06, [[2026-10-06 — Acesso da consultora externa ao Painel Lube]]).

## Acrescentado em 2026-09-24 (conversa de [[2026-09-23 — SAAM pelo link do portal e o deploy travado]])

- **Não mexa na Vercel.** Basta subir para o repositório, que ela atualiza sozinha. Uso o plano **Hobby**, gratuito. Se o deploy pelo Git travar (`BLOCKED`), me avise. Na [[SENTINELA LUBE]] (2026-10-06), com a produção autorizada por mim no chat, o Claude publicou pela API da [[Vercel]] o mesmo commit.

## Acrescentado em 2026-09-30 (conversa de [[2026-09-30 — Quem mexeu por último nos BIs]])

- **Quero saber quem mexeu e quando.** Rastreabilidade importa: se um sistema não registra quem fez a ação, diga isso (no [[GESTÃO TI]], quem marca "assinado e entregue" nunca foi gravado).

## Acrescentado em 2026-10-01 (vídeos [[VÍDEO WORKSHOP LUBE]] e [[VINHETA CPG]])

- **Material de evento sai perfeito** ("ISSO PRECISA FICAR PERFEITO!"). Vídeo para telão passa por revisão independente, quadro a quadro, antes de ser entregue — não basta "funcionou".
- **O que eu aprovei fica como está.** Quando digo que uma parte pode ficar (a abertura e o encerramento do Workshop), não mexa nela, nem para melhorar um detalhe.
- **Um fundo elegante só, em vez de um tema por item.** No Workshop troquei os temas de luxo diferentes pelo mesmo mármore branco nas 23 logos.
- **Vídeo pronto vai para Downloads**, e o projeto editável fica numa pasta própria, para refazer.
- "Notion" num pedido de vídeo foi lido como *motion* (animação) no Workshop (Claude) — e era isso.
- **Texto de divulgação é curto e chamativo**, com um título que se lê em dois segundos (2026-09-25, [[2026-09-25 — Texto de story sobre o segundo cérebro]]).

## Acrescentado em 2026-10-15 (vídeo [[VÍDEO LUBE ONLINE]])

- **Vídeo de apresentação é narrado, explicativo e impactante.** Mando a apresentação (PDF) e um vídeo de referência
  de estilo: o vídeo segue o conteúdo do PDF e o ritmo da referência, com o movimento casado com a música.
- **Mostrar a ideia funcionando:** quando a proposta é um sistema (o e-commerce), quero ver a tela dele com produtos
  de verdade, não só texto ([[2026-10-15 — Vídeo animado da proposta Lube Online]]).

## Acrescentado em 2026-10-05 (conversa de [[2026-10-05 — Sentinela Lube, sistema de segurança]])

- **Quero ver o visual cedo.** Antes de terminar tudo, me mostre como a tela está ficando.
- **Segurança: não pode passar nada** (2026-10-07). Liberado só quem entrou com login e senha pelo Painel Lube; qualquer ataque tem que ser pego.
- **Todo status na tela diz o que aconteceu, e eu quero entender o porquê.** Eu li "LIBERADO" para um robô que só viu a tela de login e achei que ele tinha entrado: o rótulo é que estava errado (2026-10-07). Vale para qualquer mensagem: no Saída de Veículos a tela tinha que dizer que o banco é o Supabase, não o `dados.js` (2026-09-10).
- **Não mexa nos meus arquivos sujos.** Nos seus commits, deixe de fora o que eu alterei e não commitei (o README do COMPRAS, o `etl/conferir_margem.py` do Comercial) e me avise.
- **README sobe junto com a mudança.** Mudou o acesso ou o comportamento, o README do repositório é atualizado e publicado no mesmo passo.

## Acrescentado em 2026-10-06 (conversa de [[2026-10-06 — Dashboard de Reposições e Chamados]])

- **Senha e chave quem cadastra sou eu.** Na [[Vercel]] (variável Sensitive, em Production) e nos segredos do Supabase. Você cria o que não é senha, confere os arquivos atrás de segredo antes do push e me passa a lista das variáveis que faltam — nome, ambiente e observação (ex.: "porta 5432") —, nunca o valor. Depois confere só pelos nomes. Foi assim no [[PAINEL ICMS]] (2026-09-08, `ANTHROPIC_API_KEY`), na [[SENTINELA LUBE]] (chave da IA), no [[REPOSIÇÕES E CHAMADOS]] (eu criei o repositório e cadastrei as 5 variáveis) e no [[SAC]] (as 3 senhas, 2026-10-09).

## Acrescentado em 2026-10-08 (conversa de [[2026-10-07 — Kanban TI e o mês que nunca abria]])

- **Nada fica marcado como confirmado ou entregue sem eu confirmar** (2026-10-06). No [[GESTÃO TI]] uma fatura apareceu "assinado e entregue" por efeito colateral de uma correção sua, e eu não tinha confirmado.
- **Terminou é: no GitHub, no ar e no cérebro.** Ao dizer que acabou, o commit e o push já saíram, o deploy foi conferido pelo commit de produção (não pelo "respondeu 200") e a conversa já está registrada no cérebro — sem eu perguntar. Já era assim antes: no RH eu pedia "sobe pro GitHub" depois de aprovar (2026-08-28 a 2026-09-17); no Saída de Veículos o push a cada alteração virou instrução salva (2026-09-10); no ICMS o Git local é backup e o Claude commita sozinho depois de mudança relevante (2026-09-04). Se o push for bloqueado, me diga: eu rodo o `git push` no meu terminal.

## Acrescentado em 2026-10-08 (conversa de [[2026-10-08 — Carga em dobro em duas máquinas e a tranca de carga]])

- **Mando print da minha máquina e da VM e espero o próximo passo exato, com o comando pronto para colar**, na sintaxe do PowerShell: o `&` do cmd não encadeia comando, e caminho com espaço vai entre aspas com `&` na frente (`& "P:\INTEGRAÇÃO BI\COMERCIAL\INSTALAR TUDO.bat"`). Quando der, um comando rápido de terminal resolve (ex.: instalar o Python na VM pelo PowerShell, 2026-09-28).

## Acrescentado em 2026-10-09 (o cérebro e as ferramentas do Claude Code, ver [[Claude]])

- **Tudo o que eu mudo fica anotado no cérebro**, sem eu pedir: "PRECISO QUE TUDO QUE EU FIZ DE MUDANÇA SEJA ANOTADO DENTRO DO CELEBRO" ([[2026-10-06 — Servidores locais e permissões do Claude Code]]). Cada sistema tem o seu **Histórico de mudanças**, do mais novo para o mais antigo, e a visão de todos fica no [[Registro de mudanças]]. Vale também para configuração do Claude Code, modelo, mods e servidores locais. Eu já pedia isso antes: "escreve tudo no celebro" (2026-09-30, [[SISTEMA FINANCEIRO]]) e "não esqueça de anotar tudo" (2026-10-05, [[2026-10-05 — Documento no mês errado na Itanet, SAAM e Vix]]).
- **Tarefa que se repete vira nota em `Rotinas/`** (ex.: [[Validação mensal da folha]]; [[2026-09-24 — A skill registrar-conversa fora do Claude Code]]).
- **Permissão e modelo do Claude Code são escolha minha.** Não grave regras de permissão para você mesmo; se travar, diga o que precisa liberar e eu troco o modo da conversa (2026-10-06). O modelo eu troco pelo `/model` ([[2026-09-10 — Modelo padrão do Claude Code]]).
- **A cara da Lube vale também nas ferramentas** — azul, vermelho, logo oficial em placa branca — e quero um aviso visual claro quando o Claude termina de mexer num projeto meu (2026-10-07, [[MOD BARRA LUBE]]).

## Acrescentado em 2026-10-16 (conversa de [[2026-10-16 — Backup do cérebro no GitHub]])

- **O cérebro tem backup no GitHub, atualizado toda vez que algo é gravado**: "só quero que coloque tudo lá e atualize toda vez que for guardar alguma coisa, só tô fazendo isso pra ter uma segurança em não perder". É o repositório `CELEBRO-LUBE`; o Claude roda o backup no fim de cada conversa ([[registrar-conversa]], passo 7). O vault só sobe com o repositório **privado**, e nota com dado de pessoa fica fora (vale a regra de cima: dado de pessoa não vai para o repositório).

Veja também [[Como eu gosto dos BIs]].
