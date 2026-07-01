'use strict';
/*
 * Hunter — job de enriquecimento (Fase 3).
 * Busca cadastro + QSA (decisor) na Receita via CNPJá, grátis. Se a empresa
 * já foi enriquecida dentro do TTL de 30 dias, reusa o dado (cache local na
 * própria tabela empresas) e não repaga a consulta crua.
 */
const cnpja = require('../providers/cnpja');

const TTL_DIAS = 30;

module.exports = async function enriquecimento(job, pool, queues) {
  const { cnpj, busca_id, lead_id } = job.data;

  const { rows: [empresa] } = await pool.query(
    `SELECT cnpj, atualizado_em FROM empresas WHERE cnpj=$1`, [cnpj]
  );

  const idadeDias = empresa
    ? (Date.now() - new Date(empresa.atualizado_em).getTime()) / (86400 * 1000)
    : Infinity;

  if (empresa && idadeDias < TTL_DIAS) {
    await pool.query(
      `UPDATE leads SET estagio='enriquecido', atualizado_em=now() WHERE id=$1`, [lead_id]
    );
    await queues.filtroContador.add('filtro-contador', { cnpj, busca_id, lead_id },
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 } });
    return { cached: true, cnpj };
  }

  // Fallback raro: empresa sem dados da busca ou fora do TTL. Usa o endpoint
  // aberto (grátis) — nunca gasta crédito pago.
  const data = await cnpja.enrichCnpj(cnpj);

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

  await pool.query(`
    UPDATE leads SET
      razao=$2, fantasia=COALESCE(NULLIF($3,''), fantasia),
      setor=$4, cnae=$5, porte=$6, cidade=$7, uf=$8,
      decisor=$9, cargo=$10,
      estagio='enriquecido', atualizado_em=now()
    WHERE id=$1`,
    [lead_id, data.razao, data.fantasia, data.setor, data.cnae, data.porte,
     data.cidade, data.uf, data.decisor, data.cargo]
  );

  await queues.filtroContador.add('filtro-contador', { cnpj, busca_id, lead_id },
    { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

  return { enriched: true, cnpj };
};
