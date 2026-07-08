'use strict';
/*
 * Hunter — validação de contato do decisor (Fase de validação).
 * Roda depois do Score 1 aprovar e ANTES do SWOT. Enriquece o contato REAL do
 * decisor (telefone/e-mail) via Econodata. Se não houver provedor ativo, apenas
 * segue pro SWOT (sem gasto). SEMPRE enfileira o SWOT ao final.
 */
const contato = require('../providers/contato');
const google = require('../providers/google');

async function seguirParaSwot(queues, data) {
  if (queues?.swot) {
    await queues.swot.add('swot', data,
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
  }
}

module.exports = async function validacao(job, pool, queues) {
  const { cnpj, busca_id, lead_id } = job.data;

  const { rows: [ig] } = await pool.query(
    `SELECT provedor, key_cifrada, config FROM integracoes
     WHERE categoria='contato' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
     ORDER BY ordem LIMIT 1`
  );

  if (!ig) {
    // Sem provedor de validação: segue pro SWOT sem gasto.
    await seguirParaSwot(queues, { cnpj, busca_id, lead_id });
    return { skipped: 'sem_provedor', lead_id };
  }

  try {
    const { rows: [emp] } = await pool.query(
      `SELECT razao, fantasia, cidade, uf, contato_receita FROM empresas WHERE cnpj=$1`, [cnpj]
    );

    let c;
    if (ig.provedor === 'google') {
      const nome = emp?.fantasia || emp?.razao || '';
      c = await google.buscarContato(nome, emp?.cidade, emp?.uf, ig.key_cifrada);
      // Cruzamento com a Receita: telefone do Google confirma / substitui o do contador.
      const cr = emp?.contato_receita || {};
      const telReceita = (Array.isArray(cr.telefones) && cr.telefones[0] || '').replace(/\D/g, '');
      c.confere_receita = !!(c.telefone && telReceita && c.telefone.includes(telReceita.slice(-8)));
    } else {
      c = await contato.enriquecerContato(cnpj, { apiKey: ig.key_cifrada, backend: ig.config?.backend });
    }

    await pool.query(
      `UPDATE leads SET contato_validado=$2::jsonb, atualizado_em=now() WHERE id=$1`,
      [lead_id, JSON.stringify(c)]
    );
    if (c.validado) {
      await pool.query(
        `UPDATE empresas SET contatos_verificados=$2::jsonb WHERE cnpj=$1`,
        [cnpj, JSON.stringify({ telefone: c.telefone, email: c.email, website: c.website || null, fonte: c.fonte })]
      );
    }
    await seguirParaSwot(queues, { cnpj, busca_id, lead_id });
    return { lead_id, validado: c.validado, fonte: c.fonte };
  } catch (err) {
    // Erro de validação não trava o pipeline: segue pro SWOT sem contato.
    await seguirParaSwot(queues, { cnpj, busca_id, lead_id });
    return { lead_id, erro: err.message };
  }
};
