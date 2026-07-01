'use strict';
/*
 * Hunter — agente SWOT (Fase 3.2).
 * Roda depois do Score 1 aprovar. Pega a firmografia (que já temos de graça)
 * e pede à OpenAI um briefing SWOT + gancho pro closer. Se não houver chave
 * OpenAI ativa, apenas deixa o lead como 'scored' (sem gasto, sem erro).
 */
const openai = require('../providers/openai');

module.exports = async function swot(job, pool, queues) {
  const { cnpj, busca_id, lead_id } = job.data;

  const { rows: [busca] } = await pool.query(`SELECT criterios, crm_auto FROM buscas WHERE id=$1`, [busca_id]);

  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada, config FROM integracoes
     WHERE categoria='ia' AND provedor='openai' AND ativo=true
     ORDER BY ordem LIMIT 1`
  );

  if (ig?.key_cifrada) {
    const { rows: [empresa] } = await pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [cnpj]);
    if (empresa) {
      const crit = busca?.criterios || {};
      const contexto = crit.params?.proposta_valor || crit.proposta_valor || crit.texto || '';
      const briefing = await openai.gerarSwot(empresa, { apiKey: ig.key_cifrada, modelo: ig.config?.modelo, contexto });
      await pool.query(
        `UPDATE leads SET swot=$2::jsonb, estagio='pronto', atualizado_em=now() WHERE id=$1`,
        [lead_id, JSON.stringify(briefing)]
      );
    }
  }
  // Sem chave IA: o lead segue 'scored' (sem gasto). Mesmo assim pode ir ao CRM.

  // Envio automático ao CRM, se a busca estiver em modo automático.
  if (busca?.crm_auto && queues?.crm) {
    await queues.crm.add('crm', { lead_id },
      { jobId: `crm-${lead_id}`, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 4, backoff: { type: 'exponential', delay: 15000 } });
  }

  return { cnpj, lead_id, swot: !!ig?.key_cifrada, crm_auto: !!busca?.crm_auto };
};
