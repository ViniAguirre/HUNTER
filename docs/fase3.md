# Fase 3 — O Motor (prospecção real)

Status: **aprovação do design em andamento**. Este doc consolida tudo que foi
desenhado para deixar de viver só no chat.

## Objetivo
Cada busca **Ativa** vira uma torneira que descobre empresas reais, enriquece,
pontua, valida contato do decisor e entrega um briefing comercial — respeitando
o `ritmo` (leads/h) e **sem gastar chave paga com lead ruim ou repetido**.

## Princípios de custo (inegociáveis)
1. **Pontuar com dado grátis primeiro; só gastar nos sobreviventes do corte.**
2. **Contato da Receita não vai pra frente** — é majoritariamente do contador.
   Serve só pra *detectar* contador (telefone/e-mail repetido entre muitos CNPJs).
3. **Portão de existência antes de qualquer chave paga**: CNPJ já travado
   (`qualificado`/`em_crm`/`descarte_duro`) é pulado de vez, sem duplicar no banco.
4. **Três memórias**:
   - `empresas` (permanente, por CNPJ) → nunca re-extrai/re-qualifica/re-descobre.
   - cache de resposta de API (TTL 30 dias) → não repaga consulta crua na janela.
   - índice único `(busca_id, cnpj)` → não duplica dentro da busca.

## Pipeline

```
descoberta (CNPJ)
   └─▶ [EXISTE NO LEDGER/LISTAS?]  (lookup local, R$ 0)
          ├─ travado (qualificado/em_crm/descarte_duro) ─▶ DESCARTA (sem linha, sem key)
          ├─ só coletado ─▶ REUSA empresa (sem duplicar) ─▶ score local
          └─ novo ─▶ cria no ledger
                       └─▶ enriquecimento (Receita, grátis: cadastro + QSA/decisor)
                            └─▶ filtro de contador (grátis)
                                 └─▶ SCORE 1 (firmográfico, grátis)
                                      └─▶ [CORTE]  score < corte ─▶ descarte por busca
                                           └─▶ contato real (PAGO, cascata de providers)
                                                └─▶ SCORE 2 (re-score com contato verificado)
                                                     └─▶ agente SWOT (Claude)
                                                          └─▶ curadoria (status='Novo')
```

Mapa de `estagio`: `coletado → enriquecido → scored → pronto` (ou `descartado`).

## Score
- **Modo lookalike**: similaridade ao perfil/centroide da lista de referência
  (CSV + sync do CRM). Features grátis da Receita: CNAE, porte, capital (faixa),
  região/UF, idade, natureza jurídica, Simples. O "quero 45% de proximidade" = corte.
- **Modo ICP**: filtros duros (CNAE/UF/porte) na descoberta + aderência ponderada
  como score. Opcional: reforço de similaridade com leads ganhos do CRM.
- **Dois momentos**: Score 1 (pré-corte, grátis, decide o gasto) e Score 2
  (pós-validação, soma "contato real do decisor verificado").
- Contato bruto da Receita **não** entra como sinal positivo (poluído por contador).

## Filtro de contador (grátis)
Como a base Receita está no Postgres, conta-se quantos CNPJs distintos
compartilham o mesmo telefone/e-mail. Acima de um limiar (ex.: 30) → contador,
contato descartado e `flag_contador=true`. Heurísticas extras: domínio contábil,
e-mail genérico, etc.

## Camada de providers (plugável, em cascata)
Tabela `integracoes` guarda **N providers** por categoria, cada um com `ordem` e
on/off. O motor tenta na ordem, para no 1º acerto verificado, cacheia 30 dias.

| Categoria          | Providers (plugáveis)                                   |
|--------------------|---------------------------------------------------------|
| contato (busca/crawl) | Tavily, Firecrawl, Serper                            |
| contato (base B2B)    | Apollo, RocketReach, Hunter.io, Snov, Dropcontact    |
| validacao_email       | NeverBounce, ZeroBounce                              |
| validacao_tel         | Twilio Lookup                                       |
| crm                   | RD Station                                          |
| ia                    | Claude (Anthropic)                                  |

## Agente SWOT (fim da linha)
Roda só nos qualificados+validados (volume baixo). Recebe firmografia + contato +
contexto raspado (site/notícias) e entrega `swot` (JSONB) + `abordagem` (texto):
SWOT sob a ótica do produto + briefing pro closer (dores prováveis, gatilhos,
ângulo, quem é o decisor e como falar). Modelo: **Haiku** nas tarefas baratas de
volume; **Sonnet 4.6** no agente SWOT (alto valor, baixo volume).

## Schema (já migrado, idempotente, na fundação 3.0)
- `empresas` (cnpj PK, firmografia, qsa, contatos_verificados, contato_receita,
  flag_contador, estado_global, …) — a memória permanente.
- `integracoes` (categoria, provedor, key_cifrada, config, ativo, ordem).
- `leads += empresa_cnpj, motivo_descarte, tentativas, processado_em`,
  índice único `(busca_id, cnpj)`.
- `buscas += universo_varrido, ultimo_heartbeat, corte_score`.

## Faseamento de entrega
- **3.0 (R$ 0):** Redis+BullMQ, worker, scheduler (respeita ritmo), portão de
  existência, descoberta + enriquecimento Receita + filtro contador + Score 1 +
  corte. Monitor real. Leads qualificados aparecem com "contato pendente".
- **3.1:** camada de providers plugável + tela Integrações cifrada + contato real
  + validação + Score 2. Lead vira acionável.
- **3.2:** agente SWOT (Sonnet) + push real ao RD Station.

## Pré-requisitos de infra (executados por você no VPS)
1. **Redis** na stack (rede `minha_rede`) — fila do BullMQ.
2. **Serviço `hunter-worker`** (mesma imagem, `CMD node worker.js`).
3. **Base Receita aberta ingerida no Postgres** — fonte da descoberta (Híbrido).
   É o maior pré-requisito; sem ela a descoberta não roda.
4. Keys dos providers (3.1+) e credenciais do CRM (3.2).
