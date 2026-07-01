'use strict';
/*
 * Hunter — envio ao CRM (Fase CRM). Roteia pelo provedor da integração ativa:
 *   - gk:      nativo GK SaaS — upsert de contato + abre ticket na fila
 *   - webhook: POST genérico para qualquer CRM/n8n
 * Usado tanto pelo envio manual (botão no lead) quanto pelo automático (após o
 * SWOT). Roda em fila com retry — falha vai pra DLQ com mensagem clara.
 */
const webhook = require('../providers/webhook');
const gk = require('../providers/gk');

module.exports = async function crm(job, pool) {
  const { lead_id } = job.data;

  const { rows: [ig] } = await pool.query(
    `SELECT provedor, key_cifrada, config FROM integracoes
     WHERE categoria='crm' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
     ORDER BY ordem LIMIT 1`
  );
  if (!ig) return { skipped: 'sem_crm', lead_id };

  const { rows: [lead] } = await pool.query(
    `SELECT l.id, l.cnpj, l.busca_id, l.score, l.swot, b.nome AS busca_nome
     FROM leads l LEFT JOIN buscas b ON b.id=l.busca_id WHERE l.id=$1`, [lead_id]
  );
  if (!lead) return { error: 'lead ausente', lead_id };

  const { rows: [empresa] } = await pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [lead.cnpj]);

  if (ig.provedor === 'gk') {
    const backend = ig.config?.backend;
    const token = ig.key_cifrada;
    const queueId = ig.config?.queueId;
    if (!backend || !queueId) throw new Error('GK: configure Backend, Empresa e Fila em Integrações.');

    // Contato do decisor. O telefone/e-mail VALIDADO (fase de validação) entra
    // aqui quando existir; por ora usamos o da Receita como ponto de partida,
    // sempre marcado como não validado pra o closer confirmar.
    const cr = empresa?.contato_receita || {};
    const telefone = (Array.isArray(cr.telefones) && cr.telefones[0]) || '';
    const email = (Array.isArray(cr.emails) && cr.emails[0]) || '';

    const contato = gk.montarContato(empresa, lead, { telefone, email });
    contato.extraInfo.push({ name: 'Contato', value: telefone || email ? 'não validado (Receita)' : 'sem contato' });
    if (lead.swot?.resumo) contato.extraInfo.push({ name: 'Resumo IA', value: String(lead.swot.resumo).slice(0, 240) });

    const contactId = await gk.upsertContato(backend, token, contato);
    await gk.abrirTicket(backend, token, { contactId, queueId, status: ig.config?.status || 'pending' });
  } else {
    // webhook genérico
    const url = ig.key_cifrada;
    const payload = webhook.montarPayload(empresa, lead, { id: lead.busca_id, nome: lead.busca_nome });
    await webhook.enviar(url, payload, ig.config?.secret || null);
  }

  await pool.query(
    `UPDATE leads SET status='Enviado', enviado_crm_em=now(), atualizado_em=now() WHERE id=$1`,
    [lead_id]
  );

  return { ok: true, lead_id, provedor: ig.provedor };
};
