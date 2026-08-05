'use strict';
/*
 * Hunter — envio ao CRM (Fase CRM). Roteia pelo provedor da integração ativa:
 *   - gk:      nativo GK SaaS — upsert de contato + abre ticket na fila
 *   - webhook: POST genérico para qualquer CRM/n8n
 * Usado tanto pelo envio manual (botão no lead) quanto pelo automático (após o
 * SWOT). Roda em fila com retry — falha vai pra DLQ com mensagem clara.
 */
const crypto = require('crypto');
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
    `SELECT l.id, l.cnpj, l.busca_id, l.score, l.swot, l.contato_validado, l.crm_ref,
            b.nome AS busca_nome, b.crm_queue_id AS busca_queue_id
     FROM leads l LEFT JOIN buscas b ON b.id=l.busca_id WHERE l.id=$1`, [lead_id]
  );
  if (!lead) return { error: 'lead ausente', lead_id };

  // Identificador de ida-e-volta: carimbado no CRM; quando o lead for marcado
  // como convertido, o CRM devolve só isso e o Hunter acha o CNPJ na base.
  // Estável por lead (reusa em reenvios).
  const ref = lead.crm_ref || ('hnt_' + crypto.randomBytes(6).toString('hex'));
  if (!lead.crm_ref) await pool.query(`UPDATE leads SET crm_ref=$2 WHERE id=$1`, [lead_id, ref]);

  const { rows: [empresa] } = await pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [lead.cnpj]);

  if (ig.provedor === 'gk') {
    const backend = ig.config?.backend;
    const token = ig.key_cifrada;
    // Fila do RADAR tem prioridade sobre a fila padrão da integração — permite
    // mandar cada radar pra uma fila diferente do CRM.
    const queueId = lead.busca_queue_id || ig.config?.queueId;
    // companyId é OPCIONAL: token com escopo de uma única empresa não lista
    // /companies/all, e o próprio CRM já vincula o contato à empresa do token.
    // Exigir aqui travava o envio de quem usa token escopado.
    if (!backend || !queueId) {
      throw new Error('GK: configure Backend e Fila em Integrações.');
    }

    // Contato do decisor. Prioriza o VALIDADO (Econodata); só cai no da Receita
    // (contador) como último recurso, sempre marcado.
    const cv = lead.contato_validado || {};
    const cr = empresa?.contato_receita || {};
    const validado = !!(cv.telefone || cv.email);
    const telefone = cv.telefone || (Array.isArray(cr.telefones) && cr.telefones[0]) || '';
    const email = cv.email || (Array.isArray(cr.emails) && cr.emails[0]) || '';

    const contato = gk.montarContato(empresa, lead, { telefone, email, ref, companyId: ig.config?.companyId || null });
    contato.extraInfo.push({ name: 'Contato', value: validado ? 'validado (decisor)' : (telefone || email ? 'não validado (Receita)' : 'sem contato') });
    if (lead.swot?.resumo) contato.extraInfo.push({ name: 'Resumo IA', value: String(lead.swot.resumo).slice(0, 240) });

    const contactId = await gk.upsertContato(backend, token, contato);
    await gk.abrirTicket(backend, token, { contactId, queueId, status: ig.config?.status || 'pending' });
  } else {
    // webhook genérico
    const url = ig.key_cifrada;
    const payload = webhook.montarPayload(empresa, lead, { id: lead.busca_id, nome: lead.busca_nome }, ref);
    await webhook.enviar(url, payload, ig.config?.secret || null);
  }

  await pool.query(
    `UPDATE leads SET status='Enviado', enviado_crm_em=now(), atualizado_em=now() WHERE id=$1`,
    [lead_id]
  );
  // Trava definitiva: uma vez no CRM, nenhuma busca (nem outra, nem esta de
  // novo) volta a criar lead pra esse CNPJ.
  await pool.query(
    `INSERT INTO empresa_tenant_estado (cnpj, estado_global) VALUES ($1, 'em_crm')
     ON CONFLICT (cnpj, tenant_id) DO UPDATE SET estado_global='em_crm', atualizado_em=now()`, [lead.cnpj]
  );

  return { ok: true, lead_id, provedor: ig.provedor };
};
