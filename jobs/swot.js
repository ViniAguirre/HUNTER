'use strict';
/*
 * Hunter — agente SWOT (Fase 3.2).
 * Roda depois do Score 1 aprovar. Pega a firmografia (que já temos de graça) +
 * o motivo do match (breakdown do Score 1) e monta um briefing analítico pro
 * closer. Se não houver chave OpenAI ativa, deixa o lead como 'scored' (sem
 * gasto, sem erro) — a formulação da abordagem em si é feita no CRM, não aqui.
 */
const openai = require('../providers/openai');

// Rótulos do fichamento comercial (tela "Agente SWOT", master). Precisa casar
// com as perguntas do front — é o que transforma as respostas salvas num bloco
// legível que calibra o agente.
const PERFIL_LABELS = {
  icp: 'Cliente ideal (ICP)',
  diferencial: 'Diferencial competitivo',
  dores: 'Dores que resolvemos',
  processo: 'Modelo de processo comercial',
  cadencia: 'Cadência de abordagem',
  gatilhos: 'Gatilhos de bom timing',
  objecoes: 'Objeções comuns',
  desqualificadores: 'Desqualificadores (mau lead)',
  concorrentes: 'Concorrentes / alternativas',
  tom: 'Tom desejado do briefing',
  observacoes: 'Observações adicionais',
};

function compilarPerfil(perfil) {
  if (!perfil || typeof perfil !== 'object') return '';
  const linhas = [];
  for (const [k, label] of Object.entries(PERFIL_LABELS)) {
    const v = String(perfil[k] || '').trim();
    if (v) linhas.push(`- ${label}: ${v}`);
  }
  // Campos extras que porventura existam além do schema conhecido.
  for (const [k, v] of Object.entries(perfil)) {
    if (!PERFIL_LABELS[k] && String(v || '').trim()) linhas.push(`- ${k}: ${String(v).trim()}`);
  }
  return linhas.length ? `Perfil comercial deste cliente (fichamento — use pra calibrar a análise e o SWOT):\n${linhas.join('\n')}` : '';
}

module.exports = async function swot(job, pool, queues) {
  const { cnpj, busca_id, lead_id } = job.data;

  const { rows: [busca] } = await pool.query(`SELECT criterios, crm_auto FROM buscas WHERE id=$1`, [busca_id]);
  const { rows: [cfg] } = await pool.query(`SELECT crm_auto_global, swot_perfil FROM config`);
  const crmAuto = !!(busca?.crm_auto || cfg?.crm_auto_global);
  const instrucoesCliente = compilarPerfil(cfg?.swot_perfil);   // fichamento comercial (tela master)

  // Integrações de IA ativas em ordem de preferência (OpenRouter antes de
  // OpenAI). Se a primeira falhar — crédito esgotado, chave inválida, rate
  // limit — tenta a próxima automaticamente.
  const igs = await openai.integracoesIA(pool);
  // Sem isto, "nenhuma IA ativa" some sem deixar rastro e o briefing só aparece
  // vazio na tela, sem explicação. O log diz a verdade.
  if (!igs.length) {
    console.warn(`[swot] lead ${lead_id} (${cnpj}): NENHUMA integração de IA ativa ` +
      `(Integrações → Inteligência: salve a chave E clique em "Ativar"). Briefing não gerado.`);
  }

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
            instrucoesCliente,
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
      console.log(`[swot] lead ${lead_id} (${cnpj}): briefing gerado.`);
    } else {
      console.warn(`[swot] lead ${lead_id}: empresa ${cnpj} não encontrada na base — briefing não gerado.`);
    }
  }
  // Sem chave IA: o lead segue 'scored' (sem gasto). Mesmo assim pode ir ao CRM.

  // Gate de contato: envio AUTOMÁTICO ao CRM só acontece com telefone E e-mail
  // validados. Sem os dois, fica pendente/decisão manual — o envio manual pela
  // triagem continua liberado.
  let contatoOk = job.data.contato_ok;
  if (contatoOk === undefined) {
    const { rows: [l] } = await pool.query(`SELECT contato_validado FROM leads WHERE id=$1`, [lead_id]);
    const cv = l?.contato_validado || {};
    contatoOk = !!((cv.whatsapp || cv.telefone) && cv.email);
  }

  if (crmAuto && contatoOk && queues?.crm) {
    await queues.crm.add('crm', { lead_id },
      { jobId: `crm-${lead_id}`, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 4, backoff: { type: 'exponential', delay: 15000 } });
  }

  return { cnpj, lead_id, swot: igs.length > 0, crm_auto: crmAuto, contato_ok: contatoOk };
};
