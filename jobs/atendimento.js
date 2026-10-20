'use strict';
/*
 * Hunter — acompanha no CRM GK se os leads enviados já começaram a ser
 * atendidos. Cada lead enviado guarda o ticket aberto e a fila (jobs/crm.js);
 * aqui, a cada ciclo do scheduler, o Hunter confere uma leva dos que ainda
 * estão "aguardando" e atualiza:
 *
 *   pending (Aguardando) → continua aguardando (e acompanha troca de fila)
 *   open    (Atendendo)  → em_atendimento — sai da conta da fila
 *   closed  (Resolvido)  → finalizado
 *   ticket não existe mais no contato → fora (apagado/transferido no CRM)
 *
 * A Estratégia mostra, por fila, quantos leads do Hunter seguem aguardando.
 * O CRM também pode avisar na hora (POST /api/webhooks/crm/atendimento); a
 * conferência periódica cobre quem não avisa.
 */
const gk = require('../providers/gk');
const distribuicao = require('./distribuicao');

const LOTE = 40;            // tickets conferidos por ciclo (o scheduler roda a cada 60s)
const INTERVALO_MIN = 3;    // o mesmo lead não é conferido de novo antes disso
const PARALELO = 4;

// Status do ticket no CRM → estado do atendimento no Hunter.
function estadoDoStatus(status) {
  const s = String(status || '').toLowerCase();
  if (['pending', 'aguardando', 'waiting'].includes(s)) return 'aguardando';
  if (['open', 'atendendo', 'em_atendimento', 'attending'].includes(s)) return 'em_atendimento';
  if (['closed', 'resolvido', 'finalizado', 'resolved'].includes(s)) return 'finalizado';
  return null;
}

// Um ciclo por vez: o scheduler não espera, e um CRM lento faria dois ciclos
// conferirem os mesmos leads.
let rodando = false;
async function verificar(pool) {
  if (rodando) return { conferidos: 0, ocupado: true };
  rodando = true;
  try { return await conferir(pool); } finally { rodando = false; }
}

async function conferir(pool) {
  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada, config FROM integracoes
      WHERE categoria='crm' AND provedor='gk' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
      LIMIT 1`);
  if (!ig?.config?.backend) return { conferidos: 0 };
  const { rows: [e] } = await pool.query(`SELECT distrib_token FROM estrategia`).catch(() => ({ rows: [] }));

  const { rows: leads } = await pool.query(
    `SELECT id, crm_ticket_id, crm_fila_id, crm_numero, crm_conexao_id FROM leads
      WHERE crm_atendimento = 'aguardando' AND crm_ticket_id IS NOT NULL AND crm_numero IS NOT NULL
        AND (crm_checado_em IS NULL OR crm_checado_em < now() - make_interval(mins => $1))
      ORDER BY crm_checado_em NULLS FIRST, id
      LIMIT $2`, [INTERVALO_MIN, LOTE]);

  // O lead fala com o CRM pela mesma conexão em que foi aberto (distribuição);
  // sem ela, pelo token de Integrações — como no envio.
  const authDe = (l) => (l.crm_conexao_id && e?.distrib_token)
    ? gk.comConexao(e.distrib_token, l.crm_conexao_id) : ig.key_cifrada;

  // Leads enviados antes deste acompanhamento existir não guardaram o ticket:
  // acha pelo telefone, uma vez, pra fila já começar com o número real.
  const legado = await adotarLegado(pool, ig, authDe, Math.max(0, LOTE - leads.length));
  if (!leads.length) return { conferidos: 0, legado };

  let conferidos = 0, mudaram = 0, falhas = 0;
  const fila = [...leads];
  async function proximo() {
    const l = fila.shift();
    if (!l) return;
    try {
      const tickets = await gk.ticketsDoContato(ig.config.backend, authDe(l), l.crm_numero);
      const t = tickets.find(x => String(x.id) === String(l.crm_ticket_id));
      const novo = t ? (estadoDoStatus(t.status) || 'aguardando') : 'fora';
      const filaAtual = t?.queueId != null ? String(t.queueId) : l.crm_fila_id;
      if (novo !== 'aguardando' || filaAtual !== l.crm_fila_id) mudaram++;
      await pool.query(
        `UPDATE leads SET crm_checado_em=now(), crm_fila_id=$3,
                crm_atendimento_em = CASE WHEN crm_atendimento IS DISTINCT FROM $2 THEN now() ELSE crm_atendimento_em END,
                crm_atendimento=$2
          WHERE id=$1 AND crm_atendimento='aguardando'`, [l.id, novo, filaAtual]);
      conferidos++;
    } catch (err) {
      // CRM fora do ar ou token recusado: tenta de novo no próximo intervalo.
      falhas++;
      await pool.query(`UPDATE leads SET crm_checado_em=now() WHERE id=$1`, [l.id]).catch(() => {});
      if (falhas === 1) console.warn(`[atendimento] falha ao conferir o ticket do lead ${l.id}: ${err.message}`);
    }
    return proximo();
  }
  await Promise.all(Array.from({ length: Math.min(PARALELO, fila.length) }, proximo));
  if (mudaram) console.log(`[atendimento] ${conferidos} conferido(s), ${mudaram} mudaram de estado/fila`);
  return { conferidos, mudaram, falhas };
}

// Os 15 últimos dias de leads enviados ao CRM GK sem acompanhamento. O número
// sai do mesmo lugar que o envio usa (contato validado → Receita).
const DIAS_LEGADO = 15;
async function adotarLegado(pool, ig, authDe, limite) {
  if (limite <= 0) return 0;
  const { rows } = await pool.query(
    `SELECT l.id, l.crm_conexao_id, l.contato_validado, e.contato_receita
       FROM leads l LEFT JOIN empresas e ON e.cnpj = l.cnpj
      WHERE l.crm_atendimento IS NULL AND l.crm_ticket_id IS NULL AND l.crm_afiliado IS NULL
        AND l.enviado_crm_em >= now() - make_interval(days => $1)
        AND (l.crm_checado_em IS NULL OR l.crm_checado_em < now() - interval '1 hour')
      ORDER BY l.enviado_crm_em DESC LIMIT $2`, [DIAS_LEGADO, limite]);
  let adotados = 0;
  for (const l of rows) {
    const cv = l.contato_validado || {}, cr = l.contato_receita || {};
    const numero = gk.normalizarNumero(cv.telefone || cv.whatsapp || (Array.isArray(cr.telefones) && cr.telefones[0]) || '');
    if (!numero) {   // sem telefone não houve ticket — não há o que acompanhar
      await pool.query(`UPDATE leads SET crm_atendimento='fora', crm_checado_em=now() WHERE id=$1`, [l.id]);
      continue;
    }
    try {
      const tickets = (await gk.ticketsDoContato(ig.config.backend, authDe(l), numero))
        .filter(t => !l.crm_conexao_id || t.whatsappId == null || String(t.whatsappId) === String(l.crm_conexao_id));
      // O mais recente ainda aberto; sem nenhum aberto, o mais recente de todos.
      tickets.sort((a, b) => ((a.status === 'closed') - (b.status === 'closed')) || Number(b.id) - Number(a.id));
      const t = tickets[0];
      await pool.query(
        `UPDATE leads SET crm_ticket_id=$2, crm_fila_id=$3, crm_numero=$4, crm_atendimento=$5,
                crm_atendimento_em=now(), crm_checado_em=now() WHERE id=$1 AND crm_atendimento IS NULL`,
        [l.id, t ? String(t.id) : null, t?.queueId != null ? String(t.queueId) : null, numero,
         t ? (estadoDoStatus(t.status) || 'aguardando') : 'fora']);
      adotados++;
    } catch (_) {
      // CRM sem resposta: tenta de novo daqui a uma hora.
      await pool.query(`UPDATE leads SET crm_checado_em=now() WHERE id=$1`, [l.id]).catch(() => {});
    }
  }
  return adotados;
}

// Quantos leads do Hunter estão nas filas do CRM sem atendimento — o mesmo
// número do cartão da Estratégia. Com a distribuição ligada, só as filas das
// conexões marcadas; sem ela, todas. null = sem CRM GK ativo (não há contagem
// própria; o controle cai no aviso do CRM).
async function pendentesHunter(db) {
  const { rows: [ig] } = await db.query(
    `SELECT 1 FROM integracoes WHERE categoria='crm' AND provedor='gk' AND ativo=true
       AND key_cifrada IS NOT NULL AND key_cifrada <> '' LIMIT 1`);
  if (!ig) return null;
  const { rows: [e] } = await db.query(`SELECT distrib_ativo, distrib_conexoes FROM estrategia`);
  const filas = e?.distrib_ativo
    ? [...new Set(distribuicao.elegiveis(e.distrib_conexoes).map(c => c.fila).filter(Boolean).map(String))] : [];
  const { rows: [r] } = filas.length
    ? await db.query(`SELECT COUNT(*)::int AS n FROM leads WHERE crm_atendimento='aguardando' AND crm_fila_id = ANY($1::text[])`, [filas])
    : await db.query(`SELECT COUNT(*)::int AS n FROM leads WHERE crm_atendimento='aguardando'`);
  return r.n;
}

module.exports = { verificar, estadoDoStatus, pendentesHunter };
