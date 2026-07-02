'use strict';
/*
 * Hunter — validação de contato do decisor (Fase de validação).
 * Roda depois do Score 1 aprovar e ANTES do SWOT. Enriquece o contato REAL do
 * decisor (telefone/e-mail) via Econodata. Se não houver provedor ativo, apenas
 * segue pro SWOT (sem gasto). SEMPRE enfileira o SWOT ao final.
 */
const contato = require('../providers/contato');

async function seguirParaSwot(queues, data) {
  if (queues?.swot) {
    await queues.swot.add('swot', data,
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
  }
}

module.exports = async function validacao(job, pool, queues) {
  const { cnpj, busca_id, lead_id } = job.data;

  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada, config FROM integracoes
     WHERE categoria='contato' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
     ORDER BY ordem LIMIT 1`
  );

  if (!ig) {
    // Sem provedor de validação: segue pro SWOT sem gasto.
    await seguirParaSwot(queues, { cnpj, busca_id, lead_id });
    return { skipped: 'sem_provedor', lead_id };
  }

  try {
    const c = await contato.enriquecerContato(cnpj, { apiKey: ig.key_cifrada, backend: ig.config?.backend });
    await pool.query(
      `UPDATE leads SET contato_validado=$2::jsonb, atualizado_em=now() WHERE id=$1`,
      [lead_id, JSON.stringify(c)]
    );
    // Guarda também no ledger da empresa (memória permanente do contato bom).
    if (c.validado) {
      await pool.query(
        `UPDATE empresas SET contatos_verificados=$2::jsonb WHERE cnpj=$1`,
        [cnpj, JSON.stringify({ telefone: c.telefone, email: c.email, fonte: c.fonte })]
      );
    }
    await seguirParaSwot(queues, { cnpj, busca_id, lead_id });
    return { lead_id, validado: c.validado };
  } catch (err) {
    // Erro de validação não trava o pipeline: segue pro SWOT sem contato.
    await seguirParaSwot(queues, { cnpj, busca_id, lead_id });
    return { lead_id, erro: err.message };
  }
};
