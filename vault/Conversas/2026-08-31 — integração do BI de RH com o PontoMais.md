---
tipo: conversa
data: 2026-08-31
projeto: "[[BI ABSENTEÍSMO RH]]"
departamento: RH
status: resumido
tags: [conversa, rh, pontomais, integracao, em-andamento]
registrado_em: 2026-10-09
---
# 2026-08-31 — integração do BI de RH com o PontoMais

## Resumo
**Em andamento.** A Aurea, do RH, mandou um token de acesso do sistema de ponto para alimentar o [[BI ABSENTEÍSMO RH]] sem importar planilha. O Júlio achava que era o "Meu RH"; é o **PontoMais**. O Claude achou a documentação da API e testou o token, que foi **recusado** (HTTP 403, "Token inválido"). Depois mapeou as rotas que serviriam a cada aba. Em 2026-09-01 explicou onde fica o token público no PontoMais. Nada de código foi feito.

## Decisões
- 2026-08-31 (Júlio e Claude): só construir a integração **com um token válido** e depois de ver o formato real das respostas, para não programar no escuro.

## O que se levantou
- API em `https://api.pontomais.com.br/external_api/v1/`, autenticação pelo cabeçalho `access-token`.
- Rotas úteis: `POST /reports/missing_days` (faltas, atestados e motivos por colaborador e dia → Absenteísmo); `/employees`, demissões e movimentações (→ Empregados e Turnover); `GET /absences` (afastamentos); e um relatório chamado Absenteísmo.
- Por que o token pode ter sido recusado: erro de cópia, não ser o "Token público" oficial, ou estar revogado.

## Onde achar o token público
Com um administrador da conta (RH): **Marketplace → API Pontomais → Saiba mais → Token público**, ou **Configurações → Extensões → Configuração extensões contratadas → API e Webhooks**. A extensão de API precisa estar contratada com a VR/Pontomais; sem ela o campo nem aparece.

## Pendências
- [ ] Conseguir o token público válido do PontoMais — Júlio/RH
- [ ] Com o token, testar e montar a carga automática de Absenteísmo, Turnover e Empregados, acabando com a importação de Excel — Claude

Veja também [[BI ABSENTEÍSMO RH]].
