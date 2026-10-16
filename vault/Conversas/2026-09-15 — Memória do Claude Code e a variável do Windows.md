---
tipo: conversa
departamento: TI
data: 2026-09-15
projeto: "[[Cérebro da Lube]]"
status: resumido
tags: [conversa, claude-code, memoria, configuracao]
---
# 2026-09-15 — Memória do Claude Code e a variável do Windows

## Resumo
Durante a criação do [[GESTÃO TI]] ([[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]]),
o Claude gravou na **memória do Claude Code** daquela pasta o padrão de arquitetura da Lube e as armadilhas de
infraestrutura que custaram tempo. No mesmo dia achou, no ambiente do Windows, variáveis com a chave do
[[PAINEL ICMS]] que vencem o `.env.local` de qualquer projeto local. A defesa foi feita no código; as
variáveis continuam lá.

## A memória do Claude Code
- Fica **fora do cérebro**, em `C:\Users\gti.julio.alves\.claude\projects\<pasta do projeto>\memory\`, e só vale
  para conversas abertas naquela pasta.
- Gravado em 2026-09-15 na pasta `Desktop\BI\5. GESTÃO TI` (Claude):
  - `padrao-sistemas-lube.md`: cada sistema = **1 projeto [[Supabase]] + 1 deploy [[Vercel]]**, catalogados no
    [[PAINEL LUBE DISTRIBUIDORA]] com permissões. Organização do Supabase "Lube Distribuidora LTDA"
    (`ixtkrqqifwnjjyxckhln`), onde projeto novo custa **US$ 10/mês**. Perguntado, o Júlio **preferiu pagar um
    projeto dedicado** a misturar schemas no hub (isolamento de dados).
  - `gestao-ti-lube.md`: projeto, endereço de produção, repositório.
  - `infra-lube-locaweb-vercel.md`: IMAP/SMTP da [[Locaweb]] em `email-ssl.com.br`, `SEARCH SINCE` não confiável,
    time da Vercel "LUBE DISTRIBUIDORA LTDA" (`team_k8YNfCDhgFwOScWnM5iHGqLC`) no plano Hobby (2 crons diários,
    60 s por função), região `gru1` obrigatória. E mais: a Vercel **bloqueia o deploy de Next.js com
    vulnerabilidade crítica conhecida** (falha com ERROR mesmo depois de compilar).
  - As armadilhas da CLI da Vercel do mesmo dia (variável `NEXT_PUBLIC_..._KEY` não cadastrada e a CLI saindo com
    código 0; `vercel link` gravando `VERCEL_OIDC_TOKEN` no `.env.local` e pondo `.env*` no `.gitignore`) **não**
    estão na memória: ficaram em [[2026-09-15 — Criação do Gestão TI e a primeira carga dos fornecedores]].
  - `MEMORY.md`: o índice.
- Outras duas pastas já tinham memória: PainelICMS (2026-09-04) e Saída de Veículos (2026-09-10). Lista em
  [[Claude]].
- O que está lá também está no cérebro ([[Locaweb]], [[Vercel]], [[GESTÃO TI]]). O cérebro é a memória oficial.
  _Até 2026-10-09 esta nota dizia isso sem ressalva, mas o id da organização do Supabase, a preferência por
  projeto dedicado e o bloqueio por Next.js vulnerável só existiam na memória; agora estão aqui._
- Conferido em 2026-10-09: nenhuma chave gravada nesses arquivos.

## A variável do Windows
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estão no **ambiente do usuário do Windows**, apontando para o
  projeto do PAINEL ICMS (`ylzjamsiknkcgyzgehnl`). Variável do sistema operacional vence o `.env.local` do
  Next.js: um projeto local pode gravar no banco errado sem avisar. Detalhe em [[Supabase]].
- Apareceu como "Invalid API key" no teste local do Gestão TI: o processo recebia a chave do ICMS. Se as URLs
  coincidissem, o sistema gravaria no banco errado em silêncio. O servidor local subiu com a chave certa
  forçada no processo, lida do `.env.local`.
- **Não foi removida.** Provavelmente é a que a ponte do ICMS usa (a máquina da ponte usa essas duas
  variáveis, ver [[PAINEL ICMS]]).

## Decisões
- 2026-09-15 (Claude): registrar o padrão da empresa e as armadilhas de infraestrutura na memória, para não
  descobrir tudo de novo no próximo projeto.
- 2026-09-15 (Claude): conferir no código o `ref` do JWT contra a URL, em vez de confiar na origem da
  variável. Vale copiar para os outros sistemas que rodam no computador.

## O que foi criado ou mudou
- Memória do Claude Code da pasta do Gestão TI (4 arquivos, acima).
- Código do Gestão TI: a conexão confere o `ref` do JWT (ver [[GESTÃO TI]]).

## Pendências
- [ ] Decidir se tira ou renomeia `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` do ambiente do Windows (cuidado
  com a ponte do ICMS) — Júlio
- [ ] Copiar a checagem do `ref` do JWT para os outros sistemas que rodam no computador — Claude, quando mexer
  neles
- [ ] Conferir a região `gru1` nos outros sistemas — em 2026-10-09 o [[PAINEL ICMS]] e a
  [[GESTÃO DE SAÍDA DE VEÍCULOS]] estão em `iad1` (não em `gru1`); o [[BI ABSENTEÍSMO RH]] não foi conferido —
  Júlio/Claude
