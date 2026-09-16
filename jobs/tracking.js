'use strict';
/*
 * Hunter — entrega de um evento no Tracking Hub.
 *
 * Fila própria de propósito: o contrato diz que falhar a entrega NÃO pode
 * travar o motor, mas "best-effort" não precisa significar "perder o evento".
 * Enfileirar custa um round-trip no Redis e dá retentativa de graça; quem chama
 * usa `registrar()`, que engole qualquer erro.
 */
const tracking = require('../providers/tracking');

module.exports = async function trackingJob(job, pool) {
  const { evento } = job.data || {};
  if (!evento || !evento.event_name) return { skip: 'job sem evento' };

  const url = await tracking.urlAtiva(pool);
  // Sem conexão configurada não é falha: a integração é opcional e pode ser
  // desligada a qualquer momento — inclusive com eventos já na fila.
  if (!url) return { skip: 'Tracking Hub não conectado' };

  const r = await tracking.enviar(url, evento);
  if (r.ok) {
    return { ok: true, evento: evento.event_name, duplicado: r.duplicado };
  }
  // Erro permanente (payload recusado, token inválido): retentar só repetiria a
  // recusa. Fica registrado no log e o job termina sem erro, pra não encher a
  // fila de falhas com algo que nenhuma tentativa conserta.
  if (r.permanente) {
    console.error(`[tracking] ${evento.event_name} descartado: ${r.motivo}`);
    return { ok: false, descartado: true, motivo: r.motivo };
  }
  // Transitório: joga pro BullMQ retentar.
  throw new Error(r.motivo);
};

// Enfileira um evento. NUNCA lança: é chamada de dentro dos jobs do motor, e uma
// falha aqui não pode derrubar a descoberta, o score ou o envio ao CRM.
module.exports.registrar = async function registrar(queues, nome, dados) {
  try {
    if (!queues || !queues.tracking) return;
    const evento = tracking.montarEvento(nome, dados);
    await queues.tracking.add('tracking', { evento }, {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
      attempts: 5,
      backoff: { type: 'exponential', delay: 10000 },
      // O Hub também deduplica por idempotency_key; o jobId evita gastar a ida
      // quando o mesmo estágio é reprocessado (retry de job, reprocesso manual).
      jobId: evento.idempotency_key,
    });
  } catch (e) {
    console.warn(`[tracking] não consegui enfileirar ${nome}: ${e.message}`);
  }
};
