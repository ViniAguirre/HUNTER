'use strict';
/*
 * Hunter — agente SWOT (Fase 3.2).
 * Roda depois do Score 1 aprovar. Pega a firmografia (que já temos de graça)
 * e pede à OpenAI um briefing SWOT + gancho pro closer. Se não houver chave
 * OpenAI ativa, apenas deixa o lead como 'scored' (sem gasto, sem erro).
 */
const openai = require('../providers/openai');

module.exports = async function swot(job, pool) {
  const { cnpj, busca_id, lead_id } = job.data;

  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada, config FROM integracoes
     WHERE categoria='ia' AND provedor='openai' AND ativo=true
     ORDER BY ordem LIMIT 1`
  );
  if (!ig?.key_cifrada) {
    // Sem chave: não é erro. O lead segue 'scored' e pode ganhar SWOT depois.
    return { skipped: 'sem_chave_ia', lead_id };
  }

  const [empresaRes, buscaRes] = await Promise.all([
    pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [cnpj]),
    pool.query(`SELECT criterios FROM buscas WHERE id=$1`, [busca_id]),
  ]);
  const empresa = empresaRes.rows[0];
  if (!empresa) return { error: 'empresa ausente', cnpj };

  const contexto = buscaRes.rows[0]?.criterios?.texto || '';
  const modelo = ig.config?.modelo || undefined;

  const briefing = await openai.gerarSwot(empresa, { apiKey: ig.key_cifrada, modelo, contexto });

  await pool.query(
    `UPDATE leads SET swot=$2::jsonb, estagio='pronto', atualizado_em=now() WHERE id=$1`,
    [lead_id, JSON.stringify(briefing)]
  );

  return { cnpj, lead_id, ok: true };
};
