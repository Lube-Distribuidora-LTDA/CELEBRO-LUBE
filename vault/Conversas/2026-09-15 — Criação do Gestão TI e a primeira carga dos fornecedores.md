---
tipo: conversa
data: 2026-09-15
projeto: "[[GESTÃO TI]]"
status: resumido
tags: [conversa, ti, gestao-ti, supabase, vercel, imap]
---
# 2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores

## Resumo
Num dia só, o [[GESTÃO TI]] saiu do zero e foi ao ar em `gestao-ti-ruddy.vercel.app`: banco próprio no [[Supabase]], app Next.js com 9 telas, portal de chamados, robô que lê a caixa `cpd@` na [[Locaweb]] e cobra quem não mandou a nota. À tarde o Júlio mandou a foto da **planilha de controle do dono** e o sistema foi carregado com os fornecedores reais — e foi aí que apareceram os defeitos de verdade: o robô via zero notas, misturava contratos e mandava nota para o mês errado.

## O que o Júlio pediu
Controle de contas e contratos com faturas e notas; um robô que entra no webmail num horário fixo, **cobra quem não mandou a nota e dá baixa quando ela chega**; dashboard de custo do setor; área de chamados aberta por link. Tudo no tema azul escuro da Lube, "chamativo, com detalhes dinâmicos".

## Decisões
- 2026-09-15 (Júlio): **Supabase + Vercel**, o padrão da casa, e o código no GitHub da organização (`Lube-Distribuidora-LTDA/Gestao-TI`).
- 2026-09-15 (Júlio): a cobrança **sai sozinha**, sem rascunho para aprovar, e o robô lê direto a caixa `cpd@lube.com.br`, sem caixa dedicada.
- 2026-09-15 (Claude propôs, o Júlio aprovou o custo): **projeto Supabase próprio** (US$ 10/mês), e não um schema no banco do [[PAINEL LUBE DISTRIBUIDORA]]: o portal de chamados era aberto e exporia a API do banco que guarda as permissões de todos os sistemas. Também separa backup e raio de impacto. (Até 2026-10-09 esta linha dizia só "Júlio"; um dos resumos da sessão atribui a escolha ao Claude.)
- 2026-09-15 (Claude): **o navegador nunca fala com o banco.** Tudo passa por `/api` com a `service_role`; RLS ligado sem política e privilégios da chave pública revogados — ela não lê nada nem se vazar.
- 2026-09-15 (Claude): **o robô não chuta.** PDF sem pista de nota, boleto ou fatura fica "a conferir" e a cobrança daquele fornecedor para.
- 2026-09-15 (Claude): só aceita documento de **remetente cadastrado**. É o que barra os boletos falsos.
- 2026-09-15 (Claude): host de e-mail `email-ssl.com.br` com TLS estrito, em vez de desligar a validação — desligar exporia a senha da caixa.
- 2026-09-15 (Júlio): Vercel no **plano Hobby**. Daí 2 crons e 60 s por função; a abertura das competências do mês foi para dentro da cobrança das 09:00.
- 2026-09-15 (Claude): fixar a região **`gru1`** (São Paulo). O padrão da Vercel é Washington, e cada consulta atravessava o continente.
- 2026-09-15 (Claude): rodar `scripts/testar-painel.mjs` antes de todo deploy de tela — os três erros do dia passaram limpos pelo `tsc` e pelo build.
- 2026-09-15 (Claude): valor previsto vem da planilha; **vencimento só quando confirmado no documento**. As contas sem confirmação ficaram no dia 10 provisório.
- 2026-09-15 (Claude): fornecedor que manda vários contratos pelo mesmo e-mail vira **um fornecedor com várias contas**, separadas por palavra-chave.
- 2026-09-15 (Claude): **cobrança automática desligada** até o Júlio conferir o cadastro — cobrar fornecedor por engano é constrangedor e difícil de desfazer.
- 2026-09-15 (Júlio): a coluna Documentos mostra **só o que chegou**; o que falta já aparece em Situação.
- 2026-09-15 (Júlio): fornecedor **pode ser excluído** e sair do dashboard — quem manda no cadastro é ele. (Claude) A tela mostra antes quanto vai junto; inventário e marca de e-mail lido ficam, só perdem o vínculo.
- 2026-09-15 (Júlio): alerta **ao entrar o mês do vencimento** e outro mais forte **a duas semanas**.

## Defeitos encontrados e corrigidos
- **Deploy em ERROR sem erro aparente:** a Vercel bloqueia Next.js vulnerável (15.5.3, RCE crítico). Foi para 15.5.25; o nodemailer para 10.0.10 (injeção SMTP).
- **Login com "supabaseKey is required":** a CLI da Vercel não cadastrou `NEXT_PUBLIC_SUPABASE_ANON_KEY` (nome com `_KEY` e prefixo público abre um prompt) e saiu com código 0. O script passou a mandar o tipo explícito e a conferir com `vercel env ls`. O `VERCEL_OIDC_TOKEN` tinha ido junto e foi removido.
- **"Application error" em todas as telas depois do login:** um Server Component passava a função do ícone para um Client Component. Corrigido em 16 chamadas.
- **O robô via zero notas:** o `SEARCH SINCE` da Locaweb devolve mensagens de meses antes. A leitura passou a percorrer a caixa pela ordem de chegada e cortar pela data interna.
- **"Invalid API key" no teste local:** uma variável do Windows trazia a chave do Painel ICMS e vence o `.env.local`. O sistema passou a conferir o `ref` do JWT contra a URL. Ver [[Supabase]].
- **"rio" casava com "escritório" e "prioridade"** e quase tudo da Print Solução ia para o Firewall Rio. Palavra-chave passou a ter mínimo de 4 letras, peso pelo tamanho e termo negativo (`!lube rj`).
- **Nota fiscal marcada como boleto:** o assunto "Boleto - ... NFS-e: 2284" vencia o nome do arquivo `NFSE_2284.pdf`. Agora o **nome do arquivo decide**. Conferido em 18 nomes reais.
- **Navegação lenta (0,4 a 3,4 s):** funções em Washington, layout consultando o banco a cada clique e nenhum retorno visual. Depois: 0,12 a 0,48 s.
- **A conta que venceu sem aparecer, e o Júlio levou bronca.** Notas de julho e agosto da Print Solução estavam em setembro, com vencimento lido do nome do arquivo ("09-24" virou 24/09; o assunto dizia 15/09). E a leitura parava no limite antes de chegar às notas mais novas. O texto do e-mail passou a mandar na competência e no vencimento, e print de chamado deixou de entrar como documento.

## Outros tropeços do dia
- **`create-next-app` recusou a pasta** `5. GESTÃO TI` (o npm não aceita acento e maiúscula no nome). A estrutura foi montada à mão: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`.
- **Migração 03 falhou na primeira vez:** usava `'cancelada'`, e o valor do enum é `'cancelado'`. Reaplicada.
- **O build quebrou duas vezes:** o Tailwind v4 não aceita `@apply` de classe do próprio projeto (os componentes `.card`, `.btn`, `.input`, `.tbl` foram reescritos em CSS puro), e um route handler exportava `traduzirErro` — rota só pode exportar métodos HTTP. A função foi para `src/lib/crud-config.ts`.
- **Os advisors do Supabase** mostraram views legíveis pela chave pública, passando por cima do RLS. Fechado na migração 07 (`security_invoker` e privilégios revogados).
- **O `vercel link` pôs `.env*` no `.gitignore`**, o que tiraria o `.env.example` do repositório. Ganhou a exceção `!.env.example`.
- **Cache `.next` corrompido** por atualizar o Next com o servidor de desenvolvimento rodando ("Cannot find module ./chunks/vendor-chunks/next.js"). Apagado.
- **Servidor local antigo:** um processo fantasma ocupava a porta 3000 com um build velho, e a tabela `robo_execucoes` ficava vazia.
- **Rota de diagnóstico temporária:** a pasta `_diag` não vira rota (o Next ignora pasta com sublinhado) e o middleware barrava rota fora da lista. Ficou em `api/cron/diagnostico` e foi apagada no fim.
- **Primeira carga com janela de 45 e depois 60 dias** para alcançar agosto; voltou a 12 no fim do dia. Na primeira rodada corrigida veio zero, porque o controle de "já processado" barrou os e-mails — foi preciso limpar `emails_processados`.
- **Os valores das notas da Print Solução** foram lidos de dentro dos PDFs (pdfplumber): NF 920/921/922 em julho, vencendo 15/08; NF 934/935/936 em agosto, vencendo 15/09; NF 944 é complemento de setembro. Onde há ISS retido, vale o boleto e o bruto vai na observação.
- A conferência de visibilidade do repositório por `curl` foi barrada pelo classificador do modo automático; conferido pelo navegador.

## Conferido antes de entregar
- **Primeiro deploy** (`dpl_8iVJTABDFqLkLmwFVNi7BB6fhWPX`) em ERROR, barrado pelo Next vulnerável; o segundo (`dpl_EQD7qM5x3Qv5RUHj2ywkV8suLLkP`) ficou READY. Projeto Vercel `gestao-ti` (`prj_sxnusj4EGtvYF30N5VxoyBbleW83`), time LUBE DISTRIBUIDORA LTDA, deploy a cada push na `main`.
- **8 de 8 testes de acesso em produção:** cron sem segredo 401, APIs sem sessão 401, painel manda para o login, portal público 200, token inexistente 404, tabela fora da lista fechada 401. A chave pública leva "permission denied" em toda tabela, view e função.
- Banco no fim do dia: **13 tabelas e 5 views analíticas**; build com **29 rotas**. As 7 migrações exportadas para `supabase/migrations/`.
- **Exclusão de fornecedor** testada com o descartável "ZZZ TESTE EXCLUSAO" (2 contratos, 2 faturas, 2 documentos): apagou tudo, sem resíduo. Ficaram 22 fornecedores, 25 contas, 24 faturas e 41 documentos.
- **Alerta em degraus** conferido em dez casos de borda, inclusive o limite exato de 14 dias e a virada de mês.

## Como ficou o cadastro
- **22 fornecedores e 24 contas**, somando **R$ 43.227,37** — igual, centavo por centavo, à planilha do dono.
- Mais Dados e INTELI+: um fornecedor, duas contas. Print Solução: três (Firewall Matriz, Firewall Rio, Banco de Horas).
- Setembro aberto (24 faturas). Primeira rodada real do robô: **887 e-mails, 54 documentos vinculados, 12 contas com baixa**. Os 7 e-mails da Print Solução que ficaram "não identificados" eram propostas comerciais e relatórios de firewall — (Claude) foi certo não vinculá-los.
- A varredura achou **cinco boletos falsos** imitando Vivo, Unimed, Hapvida, AMIL e Locaweb. O sistema os rejeita por construção.

## O que foi criado ou mudou
- [[GESTÃO TI]]: o sistema inteiro (15 commits do dia, migrações 01 a 11 do banco). Linha a linha no Histórico de mudanças da nota.
- [[Gestão TI - Leitura de e-mail e cobrança]]: os dois crons das 08:00 e 09:00.
- [[Notas, boletos e recibos]]: nota x boleto pelo nome do arquivo; texto do e-mail manda no vencimento.
- No repositório, além do código: `README.md` (instalação, automações do Hobby, hosts da Locaweb, região `gru1`, decisões de segurança) e `FORNECEDORES-ENCONTRADOS.md`, a lista dos fornecedores legítimos que mandam documento para o `cpd@`.
- Memórias do Claude Code para a pasta do projeto: `padrao-sistemas-lube.md`, `gestao-ti-lube.md`, `infra-lube-locaweb-vercel.md` e `MEMORY.md` (ver [[2026-09-15 — Memória do Claude Code e a variável do Windows]]).

## O que o Júlio deixou claro
- Clicou e não respondeu, parece travado: a tela tem que reagir ao clique, nem que seja com o esqueleto de carregamento.
- Vencimento e valor no painel são os do documento. Uma data errada custou bronca para ele.
- Quer o sistema conferido contra a planilha do dono e contra os documentos reais, e já testado com o que venceu no mês — não só cadastrado.
- Manda o print do erro e espera que a causa saia do log, sem adivinhação.
- Prefere poder excluir um cadastro e ver o efeito na hora a ter o sistema bloqueando a ação.

## Pendências
- [ ] Preencher o dia de vencimento das contas que ficaram no **dia 10 provisório**: Alterdata, ION, PC Winthor, Ponto Mais, Manager, Dinâmica, Top Link, Print Help, Data R e as duas Microsoft — Júlio (a SAAM foi para o dia 15 em 2026-09-24)
- [ ] Avisar o financeiro dos cinco boletos falsos — Júlio
- [ ] Trocar a senha da caixa `cpd@`, que passou pelo chat para preencher o `.env.local` — Júlio
- [ ] Tirar ou corrigir `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` do ambiente do Windows, que afetam os outros projetos locais — Júlio
- [ ] Atualizar para o Next 16 com calma, para fechar os avisos que sobraram (next moderado, postcss alto) — Claude, quando o Júlio pedir
- [ ] Conferir a região dos outros sistemas Next/Vercel (Painel ICMS, Gestão de RH, Saída de Veículos) pelo cabeçalho `x-vercel-id` — o Claude se ofereceu, falta o OK do Júlio
- [ ] A Print Solução chama o boleto de `LUBE NF 934.pdf`: conferir na tela se ficou como Boleto e reclassificar à mão se preciso — Júlio
- [x] Testar IMAP e SMTP pela tela do Robô — na prática conferido: a primeira rodada real leu 887 e-mails no mesmo dia, e a cobrança de teste de 2026-09-16 chegou à caixa e apareceu em Enviados
- [x] Classificação de nota marcada como boleto (último pedido da manhã, interrompido) — corrigida à tarde, commit `3fd683f`
- [x] Firewall Matriz: planilha R$ 2.500,00 × NF 934 de R$ 1.000,00 — resolvido pelo Júlio em 2026-09-16
- [x] Tornar o repositório privado — resolvido como "não" em 2026-09-24: no Hobby, repositório privado trava o deploy
- [x] Religar a cobrança automática — já estava ligada quando as faturas de outubro foram geradas, em 2026-10-06 (ver [[2026-10-07 — Kanban TI e o mês que nunca abria]])

Veja também [[2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA]] e [[Vercel]].
