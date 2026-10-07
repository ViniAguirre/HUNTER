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

## Nota de segurança da lista de semelhantes

Na tela **Semelhantes**, cada lista ganha o botão **Avaliar com Jev**. O
usuário escolhe a proposta de valor que descreve o cliente ideal e o worker
(`jobs/avaliacao-lista.js`, fila `hunter-avaliacao_lista`):

1. lê até 120 empresas positivas da lista (o cadastro global costuma já ter a
   firmografia; o que faltar é consultado na CNPJá como no perfilamento);
2. manda ao Jev, uma chamada por empresa (8 em paralelo), uma pergunta `score`:
   "este cliente representa o cliente ideal?", em 4 níveis (cliente atípico,
   ocasional, representativo, cliente núcleo). Toda empresa da lista JÁ
   COMPROU (regra da lista), então a pergunta não é "compraria?", e sim "é um
   bom modelo?": uma livraria que comprou purificador é cliente de verdade, mas
   como modelo leva o radar a procurar livrarias. Vão no state a empresa, a
   oferta e o fichamento comercial (Cliente ideal, Dores, Desqualificadores),
   que é a referência principal. O nome da empresa é sinalizado como pista do
   negócio real (o código da Receita costuma ser genérico);
3. calcula no código (`typesafe.notaDaLista`) a nota 0–100: aderência média ×
   fator de tamanho (0,8 abaixo de 6 empresas, 0,9 abaixo de 15). Faixas:
   segura (≥ 75), atenção (≥ 55), arriscada;
4. grava em `avaliacoes_lista` (isolada por tenant) as suspeitas (abaixo de
   "relacionada") e a nota que a lista teria sem elas.

O usuário decide o que fazer com cada suspeita. **Retirar do perfil** marca a
semente como `excluida`: ela sai do perfil dos radares (que re-perfilam na
próxima varredura), mas continua cliente e nunca vira lead. **Devolver ao
perfil** desfaz. Ao criar um radar com uma lista de nota abaixo de 75, a tela
avisa antes.

Enviados ao Jev: o texto da proposta de valor e, de cada empresa, razão,
fantasia, atividade, CNAE, porte, capital, cidade, UF, abertura e resumo do
site (até 400 caracteres). Sem decisor nem contatos.

## Score 1 — modo observação: aderência ao cliente ideal e zona cinzenta

`jobs/score1.js` continua decidindo o corte só com a regra (firmografia ou
proximidade ao perfil da lista). Em paralelo, sem atrasar o job, quando o
radar tem proposta de valor e o tenant tem o Jev ativo:

- o Jev diz o quanto a empresa bate com o cliente ideal (mesma escala de 4
  níveis da nota da lista, gravada de 0 a 1 em `jev_score`);
- só são avaliadas as empresas que passaram e as que ficaram até 15 pontos
  abaixo do corte; as muito abaixo não gastam chamada;
- na **zona cinzenta** (até 15 pontos de cada lado do corte) fica registrado o
  que o Jev decidiria: `passaria` (nível "relacionada" ou melhor) ou
  `cortaria`.

Tudo vai para `decisoes_jev` com `tipo='score1'`, junto da nota da regra, do
corte e do radar. O relatório ganha a seção `score1`:

- `zona_cinza`: quantas vezes regra e Jev concordam ou discordam;
- `desfecho_por_nivel_jev`: dos leads que passaram, por nível do Jev, quantos
  foram enviados, marcados como fora do perfil e convertidos no CRM.

Se "fora do perfil" se concentra nos níveis baixos e "convertido" nos altos, o
Jev separa bem: aí vale ele entrar na nota (item 2) e decidir a zona cinzenta
(item 3). Até lá, nenhum lead muda.

## Raio-X da lista

Na mesma chamada da nota, o Jev classifica cada cliente num segmento
(`typesafe.SEGMENTOS`): especializado no produto do vendedor, material de
construção/hidráulico, eletro/eletrônicos, alimentação, outro varejo, atacado,
serviços técnicos, saúde e bem-estar, serviços profissionais, hospedagem e
eventos, indústria, outro. O nome da empresa entra como pista (o código da
Receita costuma ser genérico). A tela mostra a composição, quanto cada segmento
representa o cliente ideal e um botão para criar uma lista só com aquele
segmento, que vira um radar Semelhantes próprio.

Lista nova (ou reenviada) com o Jev ativo e ao menos uma proposta de valor é
avaliada sozinha, com a primeira proposta; o usuário pode reavaliar com outra.

## Regra do state

O Jev julga cada resposta **contra o `state`**. Tudo que é para ser avaliado
(a empresa, a página) vai no state; as `instructions` só dizem a pergunta. As
primeiras versões punham a empresa (nota da lista, Score 1) e a página (site)
nas instructions: o Jev avaliava o resto do state e a nota da lista da Planeta
Água saiu 19, com 109 de 119 suspeitas. Corrigido em 2026-10-07; como o state é
um só por chamada, agora é uma chamada por empresa ou por página. As
observações de site e de Score 1 gravadas antes disso não valem para o
relatório.

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
3. Aderência ao ICP com o site lido, antes do SWOT (Score 2).
4. Verificação dos itens do SWOT contra o site (anti-invenção).
