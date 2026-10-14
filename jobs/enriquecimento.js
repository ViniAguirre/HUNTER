'use strict';
/*
 * Hunter — job de enriquecimento (Fase 3).
 * Busca cadastro + QSA (decisor) na Receita via CNPJá, grátis. Se a empresa
 * já foi enriquecida dentro do TTL de 30 dias, reusa o dado (cache local na
 * própria tabela empresas) e não repaga a consulta crua.
 *
 * Roda ANTES de a empresa virar lead — só empresas que passarem no Score 1
 * ganham uma linha em `leads`. Por isso esta etapa só mexe em `empresas`.
 */
const { DelayedError } = require('bullmq');
const cnpja = require('../providers/cnpja');

// A consulta aberta da CNPJá aceita 5 por minuto. Com várias empresas na fila
// (e 5 em paralelo), o 429 é rotina, não erro: antes o job gastava as 3
// tentativas em 35 s, caía na fila de falhas e virava o alerta "Falha em
// Enriquecimento — CNPJá: limite de taxa atingido". Agora ele espera o tempo
// que a CNPJá pede e volta pra fila, sem gastar tentativa.
const MAX_ESPERAS = 30;

module.exports = async function enriquecimento(job, pool, queues, token) {
  const { cnpj, busca_id } = job.data;

  const [{ rows: [empresa] }, { rows: [cfg] }] = await Promise.all([
    pool.query(`SELECT cnpj, atualizado_em FROM empresas WHERE cnpj=$1`, [cnpj]),
    pool.query(`SELECT ttl_cache_dias FROM config`),
  ]);
  const ttlDias = cfg?.ttl_cache_dias || 30;

  const idadeDias = empresa
    ? (Date.now() - new Date(empresa.atualizado_em).getTime()) / (86400 * 1000)
    : Infinity;

  if (empresa && idadeDias < ttlDias) {
    await queues.filtroContador.add('filtro-contador', { cnpj, busca_id },
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 } });
    return { cached: true, cnpj };
  }

  // Fallback raro: empresa sem dados da busca ou fora do TTL. Usa o endpoint
  // aberto (grátis) — nunca gasta crédito pago.
  let data;
  try {
    data = await cnpja.enrichCnpj(cnpj);
  } catch (e) {
    const esperas = job.data.esperas_cnpja || 0;
    if (e.code !== 'RATE_LIMIT' || !token || esperas >= MAX_ESPERAS) throw e;
    // Espalha a volta (até +30 s) pra as 5 consultas em paralelo não baterem
    // no limite de novo no mesmo segundo.
    const espera = Math.min(Math.max(e.retryAfter || 60, 15), 300) * 1000 + Math.floor(Math.random() * 30000);
    await job.updateData({ ...job.data, esperas_cnpja: esperas + 1 });
    await job.moveToDelayed(Date.now() + espera, token);
    throw new DelayedError();
  }

  await pool.query(`
    UPDATE empresas SET
      razao=$2, fantasia=$3, cnae=$4, setor=$5, porte=$6,
      cidade=$7, uf=$8, situacao=$9, abertura=$10, capital=$11, endereco=$12,
      natureza_juridica=$13, opcao_simples=$14,
      decisor=$15, cargo=$16,
      qsa=$17::jsonb, contato_receita=$18::jsonb,
      atualizado_em=now()
    WHERE cnpj=$1`,
    [cnpj, data.razao, data.fantasia, data.cnae, data.setor, data.porte,
     data.cidade, data.uf, data.situacao, data.abertura, data.capital,
     data.endereco, data.natureza_juridica, data.opcao_simples,
     data.decisor, data.cargo,
     JSON.stringify(data.qsa), JSON.stringify(data.contato_receita)]
  );

  await queues.filtroContador.add('filtro-contador', { cnpj, busca_id },
    { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

  return { enriched: true, cnpj };
};
