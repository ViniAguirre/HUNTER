'use strict';
/*
 * Hunter — envio ao CRM via webhook (Fase CRM).
 * Dispara o lead pronto para a URL de webhook configurada. Usado tanto pelo
 * envio manual (botão no lead) quanto pelo automático (após o SWOT, se a busca
 * estiver em modo automático). Roda em fila com retry — falha vai pra DLQ.
 */
const webhook = require('../providers/webhook');

module.exports = async function crm(job, pool) {
  const { lead_id } = job.data;

  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada, config FROM integracoes
     WHERE categoria='crm' AND provedor='webhook' AND ativo=true
     ORDER BY ordem LIMIT 1`
  );
  const url = ig?.key_cifrada || null;
  if (!url) return { skipped: 'sem_webhook', lead_id };

  const { rows: [lead] } = await pool.query(
    `SELECT l.id, l.cnpj, l.busca_id, l.score, l.swot, b.nome AS busca_nome
     FROM leads l LEFT JOIN buscas b ON b.id=l.busca_id WHERE l.id=$1`, [lead_id]
  );
  if (!lead) return { error: 'lead ausente', lead_id };

  const { rows: [empresa] } = await pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [lead.cnpj]);

  const payload = webhook.montarPayload(empresa, lead, { id: lead.busca_id, nome: lead.busca_nome });
  const secret = ig.config?.secret || null;

  await webhook.enviar(url, payload, secret);

  await pool.query(
    `UPDATE leads SET status='Enviado', enviado_crm_em=now(), atualizado_em=now() WHERE id=$1`,
    [lead_id]
  );

  return { ok: true, lead_id };
};
