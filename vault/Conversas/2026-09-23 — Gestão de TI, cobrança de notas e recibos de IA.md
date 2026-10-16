---
tipo: conversa
data: 2026-09-23
projeto: "[[GESTÃO TI]]"
status: resumido
tags: [conversa, ti, gestao-ti, imap, notas-fiscais, excel]
---
# 2026-09-23 — Gestão de TI, cobrança de notas e recibos de IA

## Resumo
Conversa de vários dias (16 a 23/09) sobre o [[GESTÃO TI]]. A cobrança automática passou a ficar registrada em Enviados, o robô parou de descartar documentos em silêncio, as assinaturas de IA ganharam regime próprio (recibo, débito automático, sem vencimento), a tela de contratos ganhou filtro e exportação em Excel com a marca da Lube, e vários documentos foram caçados na caixa a pedido do Júlio.

## Decisões
- 2026-09-16: **a competência sai do mês em que o documento foi enviado, nunca do vencimento.** O fornecedor emite num mês para receber no seguinte; datar pelo vencimento abria uma segunda competência ao lado da que já existia. Foi o que duplicou a INTELI+ e a Kaizen.
- 2026-09-16: **quando o mesmo documento chega duas vezes, vale o primeiro envio.** A Kaizen emite pelo Omie e o financeiro reencaminha à mão semanas depois; o número da nota identifica o documento e impede a segunda fatura.
- 2026-09-16 (Júlio; até 2026-10-09 esta nota dizia 17/09, mas o commit é de 16/09): **fornecedor pode ser cobrado por WhatsApp em vez de e-mail.** Quem só responde no WhatsApp sai da cobrança automática — mandar e-mail para quem não lê fazia o painel dar a conta por cobrada.
- 2026-09-17: **assinatura de IA não tem vencimento, tem dia de débito.** A data é o dia em que o dinheiro sai do cartão, não um prazo a cumprir.
- 2026-09-17: **para as IAs, só o comprovante do ciclo atual.** Nada de histórico: o robô só recolhe o recibo na janela do débito (o dia 24 e a semana seguinte). Correção pedida pelo Júlio depois que apareceram na tela o recibo de agosto e um crédito avulso de API de R$ 128,13 ocupando a linha da assinatura de R$ 826,00.
- 2026-09-17 (Júlio; esta nota dizia 18/09): **a exportação leva a identidade visual do painel** — marca, azul da Lube, filete vermelho — e os filtros ativos vão escritos na planilha. Um arquivo com 5 de 25 contratos passa por lista completa na mão de quem recebe.
- 2026-09-18 (Claude; esta nota dizia 23/09): **senha de outra caixa não passa por mim.** A busca em `lube@` foi feita com a senha em variável de ambiente, e o script foi escrito para nunca gravá-la. Ver [[Como trabalhar comigo]].
- 2026-09-16 (Júlio): **o fim do fluxo é "Assinado e entregue" à contabilidade, não "pago".** A TI confere, assina e entrega; quem paga é o financeiro. As 11 faturas que estavam "paga" foram migradas.
- 2026-09-16 (Júlio): **notas de serviço fora dos contratos são lançadas à mão** (empresa, serviço, valor, número da nota e anexo) e entram no custo do departamento.
- 2026-09-16 (Claude): **o valor vem de dentro do documento** — XML da NFS-e ou linha digitável do boleto com os três dígitos verificadores certos. O gravado é o líquido, o que sai do caixa, com o bruto ao lado.
- 2026-09-16 (Júlio): **a aba Faturas e notas mostra o mês atual**; mês passado só se estiver em atraso. Para o resto, o seletor de mês de vencimento.
- 2026-09-16 (Júlio): os e-mails do robô levam a marca **"Assistente Virtual TI"**. (Claude) A faixa é HTML, não imagem, porque programa de e-mail bloqueia imagem remota.
- 2026-09-16 (Júlio): **"Assinado e entregue" não mostra "(em atraso)".**
- 2026-09-16 (Claude): em plataforma compartilhada (Omie, ContaAzul), **o nome exibido no From desempata** o fornecedor — a Kaizen e a SAAM chegavam do mesmo `noreply@omie.com.br`.
- 2026-09-16 (Claude): **o canal de cobrança é do fornecedor, não da conta** — quem atende por WhatsApp atende assim em todos os contratos.
- 2026-09-16 (Claude): a mensagem de cobrança é **montada uma vez e usada duas** (enviada e arquivada em Enviados), para a cópia ser igual ao que o fornecedor recebeu; falha ao arquivar não derruba o envio.
- 2026-09-17 (Claude): **janela de 7 dias depois do dia 24** para o recibo de IA — cobre recibo de madrugada ou cron que falhou, sem alcançar o débito do mês anterior. A competência é o mês do débito, não o ciclo escrito no recibo.
- 2026-09-17 (Claude): corrigir **os três gráficos com rótulo** (custo por categoria, maiores fornecedores, chamados por situação), não só o apontado.
- 2026-09-17 (Claude): a tela de contratos ganhou, junto do filtro por categoria pedido, os filtros de **fornecedor e situação**, no padrão da tela de Faturas.
- 2026-09-18 (Claude): a Locaweb não tem ACL nem acesso delegado — cada caixa exige a própria senha (ver [[Locaweb]]).

## Defeitos encontrados e corrigidos
- **Cobrança que "não era enviada".** Ela saía de verdade (`250 Ok: queued`, chegava em 6s), mas o SMTP só transmite: sem gravar a cópia por IMAP, nada aparecia em Enviados e a impressão era de que nada tinha saído.
- **Corte silencioso na leitura de e-mails.** O limite por execução descartava do mais antigo para o mais novo — exatamente onde ficam as notas do mês anterior — e não avisava. A nota de agosto da Mais Dados ficou dois meses fora do painel. Medido: 109 candidatos com 49 cortes mudos viraram 66 com 6 cortes avisados.
- **"Em atraso" em fatura já entregue.** O status `entregue_contabilidade` nunca entrou nas migrations, e a view decidia atraso olhando só para `paga`. Em produção, o filtro de vencidas devolvia onze faturas que não deviam nada.
- **Valores invisíveis nos gráficos.** Não era a cor: o rótulo herdava o contorno da barra (2px da cor do fundo sobre um glifo de 11px) e era apagado no mesmo passo em que era desenhado.
- **`\bnf\b` gravado como caractere de controle** num commit anterior, matando a regra em silêncio: "Envio de NF 944" só era aceito se o assunto também dissesse "Boleto".
- **Número de recibo confundido com número de chamado.** A regra que descartava `#0000` jogava fora o recibo da Anthropic, cujo identificador é `#2260-7279-4892`.
- **Valores do painel que não batiam com as notas** (16/09). O valor vinha da planilha, o vencimento de uma regra por contrato e o número da nota do nome do arquivo — a Mais Dados mostrava 11334723, o id do XML, em vez da nota 2571. A primeira versão do extrator ainda inventou R$ 180.422,33 e R$ 263.707,97, de um código de barras lido frouxo e do "maior número da página". Conferido depois em 30 documentos reais.
- **Kaizen em duas competências.** A NF 1428 chegou pelo Omie em 21/08 e foi reencaminhada à mão em 10/09; cada cópia virou uma fatura. Ficou só a de ago/26, com os documentos do primeiro envio. A INTELI+ tinha uma fatura fantasma de set/26 pelo mesmo motivo.
- **O canal WhatsApp seria descartado ao salvar**: a lista fechada de colunas do cadastro não o conhecia. Pego no teste local, antes de ir ao ar.
- **Recibo de crédito avulso no lugar da assinatura** (17/09): o primeiro teste trouxe o recibo de agosto e um crédito de API de R$ 128,13 ocupando a linha de R$ 826,00 do Claude. Os dois foram apagados e a janela do débito nasceu daí.

## Tropeços técnicos que valem lembrar
- **`pdf-parse` quebra no import ESM** (procura um PDF de teste interno e dá ENOENT). Importado por `pdf-parse/lib/pdf-parse.js`, com declaração em `src/types/pdf-parse.d.ts` e entrada em `serverExternalPackages`.
- **"Vencimento 1ª Parcela: 01/10/2026"** não casava com `vencimento[^\d]{0,40}`; virou `vencimento.{0,40}?`.
- **O `buffer: true` do nodemailer não devolve a mensagem bruta**; para guardar em Enviados foi preciso o `MailComposer`.
- **View no banco à frente das migrations:** `apply_migration` falhou com "cannot change name of view column competencia to conta_id", porque a `vw_faturas_detalhe` tinha sido redefinida direto no banco. A definição real foi lida com `pg_get_viewdef` antes de reaplicar. No canal de cobrança, "cannot change name of view column categoria_id to canal_cobranca": coluna nova vai sempre no fim.
- **Dois conjuntos de mudança num commit só:** ao tentar separar, o push foi recusado (non-fast-forward), porque o remoto já tinha o commit combinado, com o mesmo conteúdo. O local foi alinhado com `reset --hard origin/main`.
- **Edição por Python e `node -e` come barra invertida:** `\b` virou caractere de controle (backspace) em `robo.ts` e um `\n` virou quebra de linha real em `DetalheFatura.tsx`. Um script de correção chegou a apagar a função `processarEmails` inteira, restaurada com `git checkout`. Para código com barra invertida, só a ferramenta Edit.
- **O classificador do modo automático barrou** a escrita no banco para repor a nota e o boleto de agosto da Mais Dados ([Modify Shared Resources]) e uma consulta de conferência. A reposição virou o script `_correcao/repor-mais-dados-agosto.mjs`, que o próprio Júlio rodou; a conferência foi feita por script node.
- **Arquivo temporário:** script em `$TMPDIR` deu "Permission denied" no Git Bash, e o `/tmp` do Git Bash não é visível ao Node no Windows. Os scripts passaram a ficar em `_correcao/`, ignorada pelo git (como `documentos-encontrados/`).
- **A conexão IMAP caiu** no meio da varredura de 122.796 mensagens; o script de busca passou a reconectar por pasta.
- **Falso positivo na busca da TOTVS:** `alerta.plataformafiscal@totvs.com.br` contém `fiscal@totvs.com.br` e trouxe notas de outro fornecedor.
- **`exceljs` traz `uuid` 8.3.2**, com alerta moderado. Conferido que o `exceljs` só usa `v4()` sem buffer e não é afetado.
- **Os screenshots do navegador estouravam o tempo** (5 s); os gráficos foram conferidos no SVG gerado e numa prévia em HTML.
- Em 2026-09-18 o Júlio colou a senha real da caixa `lube@` dentro de `scripts/procurar-em-outra-caixa.mjs`, com o repositório público. O Claude desfez com `git checkout` antes de qualquer commit; em 2026-09-24 foi conferido que nada chegou ao GitHub (ver [[2026-09-23 — SAAM pelo link do portal e o deploy travado]]). Na mesma busca ficou claro que `lube@` e `cpd@` usam a mesma senha.

## Dados mexidos no banco
- **Testes com fornecedor descartável**, apagados depois: "ZZZ TESTE COBRANCA" cobrou a própria caixa `cpd@` (a mensagem chegou na INBOX e apareceu em `INBOX.enviadas`); a Itanet foi marcada como WhatsApp e voltou para e-mail.
- **Assinaturas de IA** (2026-09-17): o fornecedor "Claude (Anthropic)" foi recriado (o antigo não estava mais na lista), com o remetente de faturamento da Anthropic; ChatGPT (OpenAI), Supabase e Google IA Pro cadastrados. Contas no dia 24, sem nota nem boleto, com recibo, débito automático e **cobrança desligada**. Setembro aberto com a observação "Débito automático no cartão, dia 24. Aguardando o recibo." Uma simulação do recibo na linha do Claude, para conferir o selo, foi desfeita em seguida.
- Os e-mails recusados pela regra antiga (`ignorado_nao_fiscal`) foram apagados de `emails_processados` para ganhar nova chance; os vinculados ficaram. O mesmo foi feito com os do Firewall do Rio: no reprocessamento a NF 936 caiu no Rio e a Matriz manteve a 934.
- A janela do débito foi testada em 12 pontos do calendário (`_correcao/_janela.mjs`).
- **Data R:** `financeiro@datarinformatica.com.br`, assunto "NFE E BOLETO", dois PDFs anexos. **PC Winthor:** `wf@totvs.com.br`, sem anexo. **SAAM:** tinha saído do Omie.
- **Janela do robô** subiu para 60 dias nos reprocessamentos de 16/09 e voltou a 12. Documentos e `emails_processados` refeitos sem mexer nas competências nem nos status já entregues.
- Em 16/09 a aba Faturas e notas passou a abrir com 14 faturas (13 de setembro e 1 de outubro).

## O que foi criado ou mudou
- [[GESTÃO TI]]: nota do projeto criada.
- Cobrança por WhatsApp, selo **Recibo** em âmbar, filtro por categoria e exportação em Excel na tela de contratos.
- Leitura de valor, vencimento e número de dentro do documento; status "Assinado e entregue"; tela de **notas avulsas**; Faturas abrindo no mês atual; cópia da cobrança em Enviados; faixa "Assistente Virtual TI"; rótulos dos gráficos de volta.
- Cadastro: Data R (manda nota e boleto em anexo, automatizável), ION Sistemas, PC Winthor (só link de portal da TOTVS) e SAAM, depois de uma busca em 88.607 mensagens; contas das 4 IAs com dia 24 e recibo.
- 15 commits entre 16 e 18/09 e 8 migrações no banco — linha a linha no Histórico de mudanças do [[GESTÃO TI]].
- `scripts/procurar-em-outra-caixa.mjs`: busca documento em qualquer caixa da empresa, com a senha vindo do ambiente.
- [[Locaweb]]: nota nova, com o que o servidor de e-mail permite e o que não permite.
- [[Supabase]]: projeto `gestao-ti` registrado na lista.
- [[Notas, boletos e recibos]]: conceitos que o Júlio usa no dia a dia.
- [[Mapa de sistemas]]: Gestão de TI entrou na lista dos sistemas fora do fluxo de BI.

## Documentos levantados a pedido
- **Itanet:** três boletos (jul, ago, set) e o de vencimento 10/06, todos de R$ 129,99. Descoberto que **o de setembro é 2ª via do mesmo título de agosto** (linha digitável idêntica), vencido em 10/09 e **em aberto** — a Itanet mandou comunicado de suspensão em 14/09. Não existe boleto com vencimento em 10/07 em nenhuma pasta.
- **Nota 68679 (CNPJ 07.363.764/0004-33):** é o PC Winthor. Não está em `cpd@` (122.796 mensagens, 30 pastas, 1.504 XMLs abertos) nem em `lube@` (10.892 mensagens). A TOTVS manda só link de portal, sem anexo.
- **Firewall — Rio:** contrato recriado a partir das notas na caixa, depois de ter sido excluído.

## Pendências
- [x] ~~Tornar o repositório `Gestao-TI` **privado**~~ — resolvido como "não" em 2026-09-24: no plano Hobby, repositório privado trava o deploy (ver [[2026-09-23 — SAAM pelo link do portal e o deploy travado]])
- [ ] Avisar o financeiro dos **cinco boletos falsos** que imitam Vivo, Unimed, Hapvida, AMIL e Locaweb
- [ ] Conferir com o financeiro se a Itanet de **10/09 foi paga** — a operadora diz que não, e ameaça cortar
- [ ] Pedir à TOTVS que envie nota e boleto **em anexo** para `cpd@lube.com.br`, não só link de portal
- [ ] Encaminhamento automático do `cpd.lube@gmail.com` para `cpd@lube.com.br` (recibo do Google IA Pro)
- [ ] Conferir no billing da OpenAI e do Supabase para qual e-mail vão os recibos — não chegam no `cpd@`
- [ ] Trocar a senha do `cpd@`/`lube@` e **usar senhas diferentes** em cada conta
- [x] Reativar a cobrança automática em Configurações — estava ligada em 2026-10-06, quando o Júlio gerou outubro com a cobrança ativa
- [ ] Consultar na Área do Cliente da Itanet o mês de julho, que não tem boleto com vencimento 10/07 — Júlio
- [ ] Baixar a nota 68679 / RPS 000068739 pelo portal da TOTVS (exige login) — Júlio
- [ ] Disparar uma cobrança de teste pela tela para ver a faixa "Assistente Virtual TI" num cliente de e-mail de verdade — Júlio
- [ ] Conferir se o recibo do Claude de 24/09 entrou sozinho pela janela do débito — a primeira prova real da regra
- [ ] PC Winthor (TOTVS) só manda link de portal com login: candidato a cobrança por WhatsApp — Júlio

Veja também [[Como trabalhar comigo]], [[Notas, boletos e recibos]] e [[Locaweb]].
