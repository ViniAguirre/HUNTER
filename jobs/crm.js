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
const distribuicao = require('./distribuicao');
const { registrar } = require('./tracking');

module.exports = async function crm(job, pool, queues) {
  const { lead_id } = job.data;

  // ORDER BY ordem, id: só "ordem" empatava (todas as integrações nascem com
  // ordem=100, e nenhuma tela manda outro valor). Com empate o Postgres devolve
  // a linha que varrer primeiro, o que muda depois de um UPDATE qualquer — e o
  // destino dos leads trocava sozinho de provedor. O id desempata de forma
  // estável.
  const { rows: [ig] } = await pool.query(
    `SELECT provedor, key_cifrada, config FROM integracoes
     WHERE categoria='crm' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
     ORDER BY ordem, id LIMIT 1`
  );
  if (!ig) return { skipped: 'sem_crm', lead_id };

  // Os campos de identificação do próprio lead (fantasia, razão, decisor,
  // cidade...) entram aqui porque nem todo lead tem linha em `empresas`: o
  // cadastrado à mão não tem. Sem eles, os providers só enxergavam a empresa e
  // mandavam um contato anônimo pro CRM.
  const { rows: [lead] } = await pool.query(
    `SELECT l.id, l.cnpj, l.busca_id, l.score, l.swot, l.contato_validado, l.crm_ref,
            l.fantasia, l.razao, l.setor, l.cnae, l.porte, l.cidade, l.uf,
            l.decisor, l.cargo, l.endereco, l.situacao, l.abertura, l.capital, l.breakdown, l.crm_conexao_id,
            b.nome AS busca_nome, b.crm_queue_id AS busca_queue_id, b.tags AS busca_tags
     FROM leads l LEFT JOIN buscas b ON b.id=l.busca_id WHERE l.id=$1`, [lead_id]
  );
  if (!lead) return { error: 'lead ausente', lead_id };

  // Identificador de ida-e-volta: carimbado no CRM; quando o lead for marcado
  // como convertido, o CRM devolve só isso e o Hunter acha o CNPJ na base.
  // Estável por lead (reusa em reenvios).
  const ref = lead.crm_ref || ('hnt_' + crypto.randomBytes(6).toString('hex'));
  if (!lead.crm_ref) await pool.query(`UPDATE leads SET crm_ref=$2 WHERE id=$1`, [lead_id, ref]);

  const { rows: [empresa] } = await pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [lead.cnpj]);

  // Id do card criado no CRM, quando a API devolve — vai junto no evento do
  // Tracking Hub e fecha a ponte antes mesmo do CRM ecoar o ref de volta.
  let crmLeadId = null;
  // O que o GK devolveu (ticket e se a fila pegou) — vai no retorno do job, que
  // é o que aparece em Monitoramento.
  let resultadoGk = null;

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

    const contatoStatus = validado ? 'validado (decisor)' : (telefone || email ? 'não validado (Receita)' : 'sem contato');
    const tags = Array.isArray(lead.busca_tags) ? lead.busca_tags : [];
    const extras = { telefone, email, ref, companyId: ig.config?.companyId || null,
                     radar: lead.busca_nome || '', tags, contatoStatus };
    const contato = gk.montarContato(empresa, lead, extras);
    contato.extraInfo.push({ name: 'Contato', value: contatoStatus });
    // Tags do radar pra triagem no CRM. A API de contato do GK não tem campo
    // de tag documentado, então vão em informação adicional, como o hunter_ref.
    if (tags.length) contato.extraInfo.push({ name: 'Tags', value: tags.join(', ').slice(0, 250) });

    // Distribuição entre conexões (aba Estratégia): sorteia o número de
    // WhatsApp que recebe este lead e fala com o CRM pelo Token da Empresa
    // apontado pra ele. Desligada (ou incompleta) = caminho de sempre, pelo
    // token da conexão salvo em Integrações.
    let auth = token, conexao = null, distribMotivo = null;
    const dcfg = await distribuicao.config(pool);
    if (dcfg?.token) {
      const esc = await distribuicao.escolher(pool, dcfg, lead);
      conexao = esc.conexao;
      auth = gk.comConexao(dcfg.token, conexao.id);
      // Grava antes de enviar: se algo falhar, a retentativa cai na mesma
      // conexão em vez de gastar a vez de outra no rodízio.
      if (!esc.reuso) {
        await pool.query(`UPDATE leads SET crm_conexao_id=$2, crm_conexao_nome=$3 WHERE id=$1`,
          [lead_id, conexao.id, conexao.nome]);
      }
    } else if (dcfg?.motivo) {
      distribMotivo = dcfg.motivo;
      console.warn(`[crm] distribuição ligada mas sem efeito (${dcfg.motivo}) — lead ${lead_id} vai pela conexão padrão`);
    }

    const contactId = await gk.upsertContato(backend, auth, contato);
    crmLeadId = contactId != null ? String(contactId) : null;
    const tk = await gk.abrirTicket(backend, auth,
      { contactId, queueId, status: ig.config?.status || 'pending', number: contato.number,
        whatsappId: conexao?.id || null });
    // Briefing completo do agente (empresa + SWOT + fatos + dores + sinal +
    // motivos do score) como nota interna no ticket: é o material que o closer
    // usa, e não cabe nos campos do contato. Sem ticket não há onde gravar —
    // fica registrado no resultado do job.
    let nota = false;
    if (tk.ticketId) {
      await gk.enviarNotaInterna(backend, auth, tk.ticketId, gk.montarBriefing(empresa, lead, extras));
      nota = true;
    }
    resultadoGk = { contactId, ticketId: tk.ticketId, fila_aplicada: tk.filaAplicada, nota_briefing: nota,
                    ...(conexao ? { conexao: { id: conexao.id, nome: conexao.nome } } : {}),
                    ...(distribMotivo ? { distribuicao: distribMotivo } : {}),
                    ...(tk.motivo ? { motivo: tk.motivo } : {}) };
  } else {
    // webhook genérico
    const url = ig.key_cifrada;
    // Dados da conexão do CRM GK (URL, token, fila) vão junto no payload pra
    // quem recebe — normalmente um n8n — abrir o contato/ticket direto na API
    // do CRM. Lido da integração GK salva mesmo que ela não seja a ativa: aqui
    // ela é fonte de configuração, não o canal de envio.
    const { rows: [gkIg] } = await pool.query(
      `SELECT key_cifrada, config FROM integracoes
       WHERE categoria='crm' AND provedor='gk' LIMIT 1`
    );
    const crmInfo = gkIg ? {
      url: gkIg.config?.backend || null,
      token: gkIg.key_cifrada || null,
      // Fila do radar tem prioridade sobre a padrão da integração.
      fila_id: lead.busca_queue_id || gkIg.config?.queueId || null,
      empresa_id: gkIg.config?.companyId || null,
    } : null;
    const payload = webhook.montarPayload(empresa, lead,
      { id: lead.busca_id, nome: lead.busca_nome, tags: lead.busca_tags || [] }, ref, crmInfo);
    await webhook.enviar(url, payload, ig.config?.secret || null);
  }

  await pool.query(
    `UPDATE leads SET status='Enviado', enviado_crm_em=now(), atualizado_em=now() WHERE id=$1`,
    [lead_id]
  );
  // Trava definitiva: uma vez no CRM, nenhuma busca (nem outra, nem esta de
  // novo) volta a criar lead pra esse CNPJ.
  //
  // Só vale pra CNPJ que exista em `empresas` — a tabela tem FK pra lá. Um lead
  // sem empresa conhecida (cadastrado à mão, por exemplo) fazia este INSERT
  // estourar DEPOIS do UPDATE acima: o lead ficava marcado como entregue, o job
  // caía em erro e o BullMQ re-tentava, recriando o contato no CRM a cada
  // tentativa. Sem empresa não há o que travar, então é só pular.
  if (lead.cnpj) {
    const { rowCount } = await pool.query('SELECT 1 FROM empresas WHERE cnpj=$1', [lead.cnpj]);
    if (rowCount) {
      await pool.query(
        `INSERT INTO empresa_tenant_estado (cnpj, estado_global) VALUES ($1, 'em_crm')
         ON CONFLICT (cnpj, tenant_id) DO UPDATE SET estado_global='em_crm', atualizado_em=now()`, [lead.cnpj]
      );
    }
  }

  // Última etapa do funil no Tracking Hub — o evento mais valioso do handoff:
  // é ele que liga a jornada de descoberta daqui ao card no CRM.
  await registrar(queues, 'lead_sent_to_crm', {
    hunter_id: ref,
    properties: { radar_id: lead.busca_id != null ? String(lead.busca_id) : '', crm_lead_id: crmLeadId },
  });

  return { ok: true, lead_id, provedor: ig.provedor, ...(resultadoGk ? { gk: resultadoGk } : {}) };
};
