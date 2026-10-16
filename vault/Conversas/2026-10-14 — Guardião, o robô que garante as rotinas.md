---
tipo: conversa
data: 2026-10-14
projeto: "[[GUARDIÃO DA LUBE]]"
departamento: TI
status: resumido
tags: [conversa, guardiao, saude, rotinas, supabase, telegram, cerebro]
---
# 2026-10-14 — Guardião, o robô que garante as rotinas

## Resumo
O Júlio pediu que o robô do cérebro **garantisse os processos**: "validar todas as rotinas se rodaram e se subiram
as informações corretamente… garanta a saúde do sistema… quem vai garantir é ele." Nasceu o [[GUARDIÃO DA LUBE]]:
schema `saude` no DATA WAREHOUSE com pg_cron (de 5 em 5 e de 10 em 10 min), a função `guardiao` publicada (código
1.0.2), uma RPC só de contagens no [[GESTÃO TI]], o vigia da VM pronto (ainda não instalado) e a saúde no painel do
robô (versão 7 do artifact). No primeiro dia ele já achou três problemas reais que ninguém tinha visto. Estado às
14:05: 39 itens, 17 em dia, 1 atenção, 0 falha, 19 sem dado, 2 desligados.

## Decisões
- 2026-10-14 (Júlio): alerta por **Telegram**, no mesmo bot do [[Gestão TI - Resumo diário no Telegram]].
- 2026-10-14 (Júlio): **tentar de novo 1 vez e avisar** quando uma carga falhar.
- 2026-10-14 (Júlio): **vigia na VM `SRV-IA`**, para ver o Agendador e conferir as cargas com o [[WinThor]].
- 2026-10-14 (Júlio): **saúde também no arquivo baixado** do cérebro, com uma chave de leitura.
- 2026-10-14 (Claude): **alarme falso é pior que nenhum alarme** — na dúvida, "sem dado" com o motivo; carga só é
  julgada depois da tolerância; site só abre incidente na 2ª checagem ruim seguida; VM sem batimento ainda é "sem
  dado", nunca alarme.
- 2026-10-14 (Claude): **"deu certo" só com prova** — a VM respondeu "Disparei…" e a carga começou depois do disparo.
- 2026-10-14 (Claude): cargas pesadas só ganham nova tentativa de madrugada (faturamento até 07:20, margem até 06:00),
  para não pesar no Oracle no expediente.
- 2026-10-14 (Claude): o aquecedor do Reposições é vigiado pelo log na VM, e não pelo `painel_cache` como dizia a
  especificação (daria alarme falso o dia todo: o `painel_cache` só muda com a carga).
- 2026-10-14 (Claude): a RPC do Gestão TI devolve só contagens, sem texto de erro, e é chamada com a chave publicável,
  para a chave de serviço dele não ir para outro projeto.
- 2026-10-14 (Claude): a pasta do código passou de `Desktop\BI\11. GUARDIAO` para `12. GUARDIAO`, porque o 11 ficou
  com o TRADE (outra conversa do mesmo dia).

## O que foi criado ou mudou
- [[GUARDIÃO DA LUBE]] (nota nova): o que é, as peças, o que vigia, as regras contra alarme falso, a correção
  automática, os avisos, como conferir, os achados, o que fica com o Júlio e as limitações.
- [[Guardião - Verificação na nuvem]] e [[Guardião - Vigia da VM]] (rotinas novas, com `## Fluxo`; a da VM como
  "planejado" até o Júlio instalar).
- **DATA WAREHOUSE** ([[Supabase]]): extensões `pg_cron` e `pg_net`; schema `saude` (7 tabelas, RLS sem política);
  migrações `saude_v1`, `saude_v1_catalogo`, `saude_v1_ajuste_textos`, `saude_v1_ajuste_sem_dado`,
  `saude_v1_acao_sites`, `saude_v1_correcao_com_prova`, `saude_v1_consultas_compartilhadas` e
  `saude_v1_correcao_final`; segredo `guardiao_cron` gerado no Vault sem ninguém ver; tarefas `saude-verificar`,
  `saude-guardiao` e `saude-limpeza`; Edge Function `guardiao` (versão 3, código 1.0.2, `verify_jwt = false`).
- **GESTAO TI**: migração `saude_robo` (RPC `public.saude_robo()` liberada a `anon`, só tipo, horários, sucesso e
  contagens) — ver [[GESTÃO TI]].
- **VM**: pasta `P:\INTEGRAÇÃO BI\GUARDIAO` com o vigia, o instalador e o `TESTAR SEM GRAVAR.bat`; testado em
  `--teste` na `LOGISTICA-55`, sem gravar nada. Nada instalado na `SRV-IA`.
- **Painel do robô** ([[Cérebro da Lube]]): chip de saúde, painel Saúde, bolinha e "última: …" na aba Rotinas, selo
  por etapa no funil, robô âmbar/vermelho reagindo, `ver_saude` no Pergunte ao cérebro, cartão da chave de leitura.
  Versão 7 do artifact, declarando o conector Supabase só com `select saude.painel()`.
- **Código:** `Desktop\BI\12. GUARDIAO`, git local sem remoto, commits `62e6d0c`, `d67d9cc` e `0bb8a2a`.
- **Achados registrados nas notas dos sistemas:** [[BI COMPRAS]] (faturamento de 2026-10-11 falhou por statement
  timeout e voltou no dia seguinte), [[BI COMERCIAL]] (`mv_margem_dia` parada em 10/10; `margem_item` sem registro em
  11/10 e 13/10; carga de ~6 para 17–20 min; commit `ad7eefb` ainda fora do `P:`). Também: [[Mapa de sistemas]],
  [[Registro de mudanças]] e o [[CLAUDE.md]].

## Achados do primeiro dia
- O **faturamento de 2026-10-11** deu ERRO às 03:05:41 (statement timeout, 3 de 4 consultas OK) e ninguém soube;
  voltou na carga de 12/10. O Guardião teria acusado às 03:08–03:10.
- A **`mv_margem_dia` parou em 10/10** e a `fato_margem_item` tem 14/10: a *Margem por item* do Comercial mostra dado
  velho. Atenção real, incidente aberto às 13:40. A correção está no commit `ad7eefb` (2026-10-13), que não foi para a
  rede nem para a VM.
- A **`margem_item` morreu sem registrar** em 11/10 e 13/10, e a carga passou de ~6 para 17–20 min.
- A **guarda da Sentinela fria** responde a primeira pergunta sem a lista da central (assunto da
  [[SENTINELA LUBE]]).

## Pendências
- [ ] Cadastrar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` nos Secrets das Edge Functions do DATA WAREHOUSE e testar
  com `select saude.testar_telegram();` — Júlio
- [ ] Criar `guardiao_chave_leitura` no Vault (gerada pelo próprio banco) e digitar no arquivo baixado — Júlio
- [ ] Rodar `P:\INTEGRAÇÃO BI\GUARDIAO\INSTALAR TUDO.bat` na `SRV-IA` com conta administradora e conferir o primeiro
  batimento — Júlio
- [ ] Levar o commit `ad7eefb` do COMERCIAL para o `P:` e rodar o `INSTALAR TUDO.bat` do COMERCIAL na `SRV-IA` — Júlio
- [ ] Conferir que `net` não está em DATA WAREHOUSE › Settings › API › Exposed schemas — Júlio
- [ ] Investigar no `sync_bi_comercial.log` da VM a `margem_item` de 11/10 e 13/10 — Claude, quando o Júlio pedir
- [ ] Conferir no claude.ai o chip, o painel Saúde e "está tudo rodando?" na versão 7 — Júlio e Claude
- [ ] Confirmar que o `Cerebro da Lube.html` baixado foi regerado com a saúde — Claude
- [ ] Decidir: o vigia da VM também vigiar o próprio Guardião; pôr o [[Trade - Sync]] no catálogo; remoto no GitHub
  para o código — Júlio
- [ ] Avisar o dono da [[SENTINELA LUBE]] da guarda fria sem lista — Júlio
