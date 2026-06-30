'use strict';
/*
 * Hunter — filtro de contador (Fase 3, grátis).
 * O contato bruto da Receita é majoritariamente do contador da empresa, não
 * do decisor. Como a checagem é só contra a própria base local (Postgres),
 * não custa nada: conta quantos CNPJs distintos compartilham o mesmo
 * telefone/e-mail. Acima do limiar, marca flag_contador — esse contato NUNCA
 * é repassado ao closer (entra como sinal positivo só o contato verificado
 * da cascata paga, na Fase 3.1).
 */

const LIMIAR_CONTADOR = 30;
const DOMINIOS_CONTABIL = ['contabil', 'contabilidade', 'escritoriocontabil', 'assessoriacontabil'];

module.exports = async function filtroContador(job, pool, queues) {
  const { cnpj, busca_id, lead_id } = job.data;

  const { rows: [empresa] } = await pool.query(
    `SELECT contato_receita FROM empresas WHERE cnpj=$1`, [cnpj]
  );

  if (!empresa) {
    await queues.score1.add('score1', { cnpj, busca_id, lead_id },
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 } });
    return { skipped: true, cnpj };
  }

  const cr = empresa.contato_receita || {};
  const telefones = cr.telefones || [];
  const emails = cr.emails || [];

  let isContador = false;

  for (const tel of telefones) {
    if (!tel) continue;
    const { rows: [{ n }] } = await pool.query(`
      SELECT COUNT(DISTINCT cnpj)::int AS n FROM empresas
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(contato_receita->'telefones') AS t(v)
        WHERE t.v = $1
      )`, [tel]);
    if (n >= LIMIAR_CONTADOR) { isContador = true; break; }
  }

  if (!isContador) {
    for (const email of emails) {
      if (!email) continue;
      const { rows: [{ n }] } = await pool.query(`
        SELECT COUNT(DISTINCT cnpj)::int AS n FROM empresas
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(contato_receita->'emails') AS e(v)
          WHERE e.v = $1
        )`, [email]);
      if (n >= LIMIAR_CONTADOR) { isContador = true; break; }

      const dominio = String(email).split('@')[1] || '';
      if (DOMINIOS_CONTABIL.some(d => dominio.toLowerCase().includes(d))) { isContador = true; break; }
    }
  }

  if (isContador) {
    await pool.query(`UPDATE empresas SET flag_contador=true WHERE cnpj=$1`, [cnpj]);
  }

  await queues.score1.add('score1', { cnpj, busca_id, lead_id },
    { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

  return { cnpj, isContador };
};
