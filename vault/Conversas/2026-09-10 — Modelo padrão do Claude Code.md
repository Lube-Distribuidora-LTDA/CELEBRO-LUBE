---
tipo: conversa
departamento: TI
data: 2026-09-10
projeto: "[[Cérebro da Lube]]"
status: resumido
tags: [conversa, claude-code, configuracao]
---
# 2026-09-10 — Modelo padrão do Claude Code

## Resumo
Numa conversa curta aberta na pasta do usuário (`C:\Users\gti.julio.alves`), o Júlio rodou `/model` duas vezes e
escolheu o **Sonnet 5**, que ficou salvo como **modelo padrão das novas sessões** do Claude Code. Os commits
da [[GESTÃO DE SAÍDA DE VEÍCULOS]] de 2026-09-11 já saíram assinados pelo Sonnet 5. Depois disso o Júlio
trocou de modelo outras vezes, sempre pelo `/model`. A configuração da máquina está em [[Claude]].

## Decisões
- 2026-09-10 (Júlio): Sonnet 5 como padrão das novas sessões. O modelo é escolha dele.

## Trocas de modelo registradas
| Data | Modelo | Onde |
|---|---|---|
| 2026-09-10 08:08 | Sonnet 5, **salvo como padrão** | pasta do usuário |
| 2026-09-23 | `claude-sonnet-5` | conversa do [[PAINEL LUBE DISTRIBUIDORA]] |
| 2026-09-24 | `claude-opus-5` | conversa da [[2026-09-24 — Validação de folha do Administrativo\|validação de folha]], aberta no cérebro |
| 2026-09-30 | `claude-fable-5-1` | mesma conversa |
| 2026-10-06 | `claude-sonnet-5-5` | conversa do [[PAINEL LUBE DISTRIBUIDORA]] |

- **Situação em 2026-10-09:** o padrão salvo na configuração do usuário (`~/.claude/settings.json`, alterada
  pela última vez em **2026-10-01 15:39**) é **`opus[1m]`** (Opus com contexto de 1 milhão), esforço `high`.
  O Sonnet 5 deixou de ser o padrão entre 2026-09-10 e 2026-10-01; quem trocou e quando, exatamente, não
  ficou registrado.

## O que foi criado ou mudou
- Configuração do usuário do Claude Code na máquina do Júlio: modelo padrão.
- No mesmo minuto (2026-09-10 08:08) o `claude` instalado pelo npm foi atualizado de 2.1.245 para **2.1.267**,
  e parou nessa versão. O app desktop usa binário próprio, mais novo (ver [[Claude]]).

## Pendências
- Nenhuma.
