'use strict';
/*
 * Hunter — agente SWOT (Fase 3.2).
 * Roda depois do Score 1 aprovar. Pega a firmografia (que já temos de graça) +
 * o motivo do match (breakdown do Score 1) e monta um briefing analítico pro
 * closer. Se não houver chave OpenAI ativa, deixa o lead como 'scored' (sem
 * gasto, sem erro) — a formulação da abordagem em si é feita no CRM, não aqui.
 */
const openai = require('../providers/openai');

module.exports = async function swot(job, pool, queues) {
  const { cnpj, busca_id, lead_id } = job.data;

  const { rows: [busca] } = await pool.query(`SELECT criterios, crm_auto FROM buscas WHERE id=$1`, [busca_id]);
  const { rows: [cfg] } = await pool.query(`SELECT crm_auto_global FROM config WHERE id=1`);
  const crmAuto = !!(busca?.crm_auto || cfg?.crm_auto_global);

  // Integrações de IA ativas em ordem de preferência (OpenRouter antes de
  // OpenAI). Se a primeira falhar — crédito esgotado, chave inválida, rate
  // limit — tenta a próxima automaticamente.
  const igs = await openai.integracoesIA(pool);

  if (igs.length) {
    const [{ rows: [empresa] }, { rows: [lead] }] = await Promise.all([
      pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [cnpj]),
      pool.query(`SELECT contato_validado, score, breakdown FROM leads WHERE id=$1`, [lead_id]),
    ]);
    if (empresa) {
      const crit = busca?.criterios || {};
      const contexto = crit.params?.proposta_valor || crit.proposta_valor || crit.texto || '';
      // Contato validado (Google/Econodata) traz o resumo REAL do site da empresa
      // — dá ao agente algo específico pra falar, além do CNAE genérico. O
      // breakdown do Score 1 fundamenta a análise em POR QUE essa empresa deu match.
      const cv = lead?.contato_validado || {};
      const perfilEmpresa = {
        resumoSite: cv.resumo_site || null, siteValidado: !!cv.validado, fonteContato: cv.fonte || null,
        score: lead?.score ?? null, breakdown: Array.isArray(lead?.breakdown) ? lead.breakdown : [],
      };
      let briefing = null, ultimoErro = null;
      for (const ig of igs) {
        try {
          briefing = await openai.gerarSwot(empresa, {
            apiKey: ig.key_cifrada, modelo: ig.config?.modelo, contexto, perfilEmpresa, provedor: ig.provedor,
          });
          break;
        } catch (e) {
          ultimoErro = e;
          console.warn(`[swot] provedor ${ig.provedor} falhou (${e.message}) — tentando o próximo`);
        }
      }
      if (!briefing) throw ultimoErro;   // todas as chaves falharam → job re-tenta com backoff
      await pool.query(
        `UPDATE leads SET swot=$2::jsonb, estagio='pronto', atualizado_em=now() WHERE id=$1`,
        [lead_id, JSON.stringify(briefing)]
      );
    }
  }
  // Sem chave IA: o lead segue 'scored' (sem gasto). Mesmo assim pode ir ao CRM.

  // Gate de WhatsApp: envio AUTOMÁTICO ao CRM só acontece se houver telefone/
  // WhatsApp validado. Sem isso, o lead fica pendente (vermelho) pra decisão
  // manual — o envio manual pela triagem continua liberado.
  let contatoOk = job.data.contato_ok;
  if (contatoOk === undefined) {
    const { rows: [l] } = await pool.query(`SELECT contato_validado FROM leads WHERE id=$1`, [lead_id]);
    const cv = l?.contato_validado || {};
    contatoOk = !!(cv.whatsapp || cv.telefone);
  }

  if (crmAuto && contatoOk && queues?.crm) {
    await queues.crm.add('crm', { lead_id },
      { jobId: `crm-${lead_id}`, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 4, backoff: { type: 'exponential', delay: 15000 } });
  }

  return { cnpj, lead_id, swot: igs.length > 0, crm_auto: crmAuto, contato_ok: contatoOk };
};
