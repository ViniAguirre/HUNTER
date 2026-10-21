'use strict';
/*
 * Hunter — agente SWOT (Fase 3.2).
 * Roda depois do Score 1 aprovar. Pega a firmografia (que já temos de graça) +
 * o motivo do match (breakdown do Score 1) e monta um briefing analítico pro
 * closer. Se não houver chave OpenAI ativa, deixa o lead como 'scored' (sem
 * gasto, sem erro) — a formulação da abordagem em si é feita no CRM, não aqui.
 */
const openai = require('../providers/openai');
const google = require('../providers/google');

// O agente só analisa com MATERIAL sobre a empresa: o texto do site dela (ou do
// perfil na rede social). Só com o cadastro da Receita, a análise sai genérica
// — e um closer não confia em SWOT que serve pra qualquer empresa do ramo.
const MATERIAL_MIN = 40;
const temMaterial = cv => String(cv?.resumo_site || '').trim().length >= MATERIAL_MIN;
const { swotSemOrigem } = require('../sigilo');

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

// Por que o briefing não saiu, em categorias — sem nome de provedor nem de
// modelo (sigilo.js): a tela do lead mostra isso pra qualquer usuário. O erro
// cru fica no job (Monitoramento, só master).
function motivoFalhaIA(falhas) {
  const txt = falhas.map(f => String(f.erro || '')).join(' | ').toLowerCase();
  if (/http 402|insufficient|credit|cr[eé]dito|quota|billing/.test(txt)) return 'ia_sem_credito';
  if (/http 401|http 403|invalid.*key|chave/.test(txt)) return 'ia_chave_invalida';
  if (/http 429|rate.?limit|too many/.test(txt)) return 'ia_limite';
  if (/vazia|empty|sem conte[uú]do/.test(txt)) return 'ia_resposta_vazia';
  if (/json/.test(txt)) return 'ia_resposta_invalida';
  if (/timeout|timed out|econnaborted|etimedout/.test(txt)) return 'ia_tempo';
  return 'ia_falhou';
}

async function registrarFalha(pool, lead_id, motivo) {
  await pool.query(`UPDATE leads SET swot_erro=$2, swot_erro_em=now() WHERE id=$1`, [lead_id, motivo])
    .catch(e => console.error('[swot] gravar motivo da falha:', e.message));
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
  let usado = null;   // provedor/modelo que gerou o briefing (vai no retorno do job)
  // Sem isto, "nenhuma IA ativa" some sem deixar rastro e o briefing só aparece
  // vazio na tela, sem explicação. O log diz a verdade.
  if (!igs.length) {
    console.warn(`[swot] lead ${lead_id} (${cnpj}): NENHUMA integração de IA ativa ` +
      `(Integrações → Inteligência: salve a chave E clique em "Ativar"). Briefing não gerado.`);
    await registrarFalha(pool, lead_id, 'sem_ia');
  }

  if (igs.length) {
    const [{ rows: [empresa] }, { rows: [lead] }, { rows: [jev] }] = await Promise.all([
      pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [cnpj]),
      pool.query(`SELECT contato_validado, score, breakdown FROM leads WHERE id=$1`, [lead_id]),
      // Prova pela lista de semelhantes (Jev, jobs/score1.js): segmento do lead e
      // clientes atuais do vendedor no mesmo segmento. Só existe em radar
      // Semelhantes com o Jev ativo e raio-X pronto.
      pool.query(`SELECT prova FROM decisoes_jev WHERE tipo='score1' AND busca_id=$1 AND cnpj=$2
                  AND prova IS NOT NULL ORDER BY id DESC LIMIT 1`, [busca_id, cnpj]).catch(() => ({ rows: [] })),
    ]);
    let cvLead = lead?.contato_validado || {};
    // Site cadastrado à mão (ou achado sem texto): lê agora pra ter material.
    if (empresa && !temMaterial(cvLead) && cvLead.website) {
      const s = await google.scrapeSite(cvLead.website).catch(() => null);
      if (s?.resumo && s.resumo.trim().length >= MATERIAL_MIN) {
        cvLead = { ...cvLead, resumo_site: s.resumo, resumo_fonte: s.resumo_fonte || 'home' };
        await pool.query(`UPDATE leads SET contato_validado=$2::jsonb WHERE id=$1`, [lead_id, JSON.stringify(cvLead)]);
      }
    }
    if (empresa && !temMaterial(cvLead)) {
      console.log(`[swot] lead ${lead_id} (${cnpj}): sem material da empresa (site/perfil) — análise não gerada.`);
      await registrarFalha(pool, lead_id, 'sem_material');
    } else if (empresa) {
      const crit = busca?.criterios || {};
      const contexto = crit.params?.proposta_valor || crit.proposta_valor || crit.texto || '';
      // Contato validado (Google/Econodata) traz o resumo REAL do site da empresa
      // — dá ao agente algo específico pra falar, além do CNAE genérico. O
      // breakdown do Score 1 fundamenta a análise em POR QUE essa empresa deu match.
      const cv = cvLead;
      const perfilEmpresa = {
        resumoSite: cv.resumo_site || null, siteValidado: !!cv.validado, fonteContato: cv.fonte || null,
        score: lead?.score ?? null, breakdown: Array.isArray(lead?.breakdown) ? lead.breakdown : [],
        prova: jev?.prova || null,
      };
      // Guarda a falha de CADA provedor: antes só a última ia pro erro do job,
      // e com OpenRouter e OpenAI falhando a tela mostrava só a da OpenAI —
      // sem dizer que a OpenRouter tinha sido tentada antes (e por que caiu).
      let briefing = null;
      const falhas = [];
      for (const ig of igs) {
        try {
          briefing = await openai.gerarSwot(empresa, {
            apiKey: ig.key_cifrada, modelo: ig.config?.modelo, contexto, perfilEmpresa, provedor: ig.provedor,
            instrucoesCliente,
          });
          // Qual IA/modelo gerou fica só no retorno do job e no log — não vai
          // pro lead (sigilo.js): nem a tela nem o CRM mostram.
          usado = { provedor: ig.provedor, modelo: briefing.modelo,
                    ...(falhas.length ? { caiu_de: falhas } : {}) };
          briefing = swotSemOrigem(briefing);
          break;
        } catch (e) {
          falhas.push({ provedor: ig.provedor, modelo: ig.config?.modelo || null, erro: e.message.slice(0, 200) });
          console.warn(`[swot] provedor ${ig.provedor} falhou (${e.message}) — tentando o próximo`);
        }
      }
      // Todas as chaves falharam → job re-tenta com backoff.
      if (!briefing) {
        await registrarFalha(pool, lead_id, motivoFalhaIA(falhas));
        throw new Error('IA: todos os provedores falharam — ' + falhas.map(f => f.erro).join(' | '));
      }
      await pool.query(
        `UPDATE leads SET swot=$2::jsonb, estagio='pronto', swot_erro=NULL, swot_erro_em=NULL, atualizado_em=now() WHERE id=$1`,
        [lead_id, JSON.stringify(briefing)]
      );
      console.log(`[swot] lead ${lead_id} (${cnpj}): briefing gerado (${usado.provedor} · ${usado.modelo || 'padrão'}).`);
    } else {
      console.warn(`[swot] lead ${lead_id}: empresa ${cnpj} não encontrada na base — briefing não gerado.`);
      await registrarFalha(pool, lead_id, 'sem_firmografia');
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

  return { cnpj, lead_id, swot: igs.length > 0, crm_auto: crmAuto, contato_ok: contatoOk, ...(usado ? { ia: usado } : {}) };
};

module.exports.motivoFalhaIA = motivoFalhaIA;
