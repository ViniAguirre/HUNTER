# Jev (TypeSafe) — decisões tipadas no Hunter

O [Jev](https://docs.typesafe.ai/introduction) não gera texto: recebe um estado
e perguntas fechadas (choice, score, noul) e devolve a resposta com
probabilidade e confiança. Custa cerca de US$ 0,042 por milhão de tokens de
entrada e responde em 70 a 500 ms.

## Fase 1 — modo observação: "este site é desta empresa?"

`providers/google.js` (`buscarContatoGratis`) decide com regras se um resultado
de busca é o site da empresa: tokens do nome no domínio, frases de diretório,
"a página se apresenta com o nome", DDD × UF e CNPJ impresso. Nesta fase:

- as regras continuam decidindo; nada muda no lead;
- para cada candidato cuja home foi lida, o veredito da regra é anotado
  (`aceito_cnpj`, `aceito_dominio`, `aceito_nome`, `cnpj_diferente`,
  `sem_prova`, `dominio_fraco`, `ddd_outra_uf`, `diretorio`);
- `jobs/validacao.js` manda todos os candidatos de uma empresa ao Jev numa
  única chamada (`providers/typesafe.js`): tipo da página (site próprio, outra
  empresa, diretório, marketplace/rede, órgão público, outro) e "pertence à
  empresa?" (0 a 1);
- as duas respostas vão para a tabela `decisoes_jev` (isolada por tenant).

Enviados ao Jev: nome, razão, fantasia, cidade, UF, atividade e CNPJ da
empresa, e título, identidade, resumo (até 600 caracteres), telefone e CNPJ
impressos na página. O decisor nunca é enviado.

## Ligar por cliente

Desligado por padrão. Cada cliente (tenant) liga na tela **Integrações →
Decisões (Jev)** com a própria chave da TypeSafe. Sem a integração ativa, o
código não chama o Jev nem grava nada.

## Relatório

`GET /api/decisao/relatorio?dias=30` (master): avaliações, erros, latência
média e, por veredito da regra, quantas vezes o Jev disse sim (≥ 0,8), não
(≤ 0,2) ou ficou incerto, com a distribuição dos tipos de página. O resumo
`concordancia` cruza "regra aceitou/recusou" com "Jev sim/não".

As divergências mais úteis de revisar:

- `regra_aceitou_jev_nao`: possível contato errado entregue hoje;
- `regra_recusou_jev_sim`: possível site certo descartado hoje.

## Próximas fases (depois de medir)

1. Jev decide o site quando a regra não tem prova forte (o CNPJ continua
   sendo prova e veto, calculado no código).
2. Filtro antes da consulta paga na descoberta web-first.
3. Aderência semântica ao ICP antes do SWOT (composite scoring).
4. Verificação dos itens do SWOT contra o site (anti-invenção).
