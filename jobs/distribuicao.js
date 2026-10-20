'use strict';
/*
 * Hunter — distribuição de leads entre as conexões (números de WhatsApp) do CRM
 * GK. Configurada na aba Estratégia; usada pelo envio ao CRM (jobs/crm.js).
 *
 * Dois modos:
 *   - rodizio:   um lead pra cada conexão marcada, na ordem, e volta ao começo.
 *                O ponteiro é um contador no banco, incrementado atomicamente —
 *                o worker manda até 5 leads em paralelo e dois não podem pegar a
 *                mesma vez.
 *   - ponderada: sorteio em que a chance de cada conexão é o peso dela dividido
 *                pela soma dos pesos (peso 3 e peso 1 → ~75% / ~25%).
 *   - demanda:   o lead vai pra conexão com MENOS leads aguardando atendimento
 *                (jobs/atendimento.js). Quem atende rápido esvazia a fila e
 *                recebe mais; quem atende devagar recebe menos. Empate: a que
 *                recebeu lead há mais tempo.
 *
 * Cada conexão pode ter a própria fila (Setor) no CRM. A fila do lead segue,
 * nesta ordem: a da conexão sorteada → a do radar → a padrão de Integrações.
 *
 * O lead guarda a conexão escolhida: retentativa e reenvio reusam a mesma, sem
 * gastar a vez de outra conexão no rodízio.
 */
const crypto = require('crypto');

const MODOS = ['rodizio', 'ponderada', 'demanda'];
const PESO_MAX = 100;

// Normaliza o que vem da tela: só id/nome/ativo/peso, peso inteiro de 1 a 100.
function normalizarConexoes(lista) {
  if (!Array.isArray(lista)) return null;
  const vistos = new Set();
  const out = [];
  for (const c of lista.slice(0, 200)) {
    if (!c || c.id == null) continue;
    const id = String(c.id).trim();
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const p = parseInt(c.peso, 10);
    // Fila (Setor) do CRM onde os leads desta conexão caem. Vazia = vale a fila
    // do radar (e, sem ela, a padrão de Integrações).
    const fila = c.fila != null && String(c.fila).trim() !== '' ? String(c.fila).trim().slice(0, 40) : null;
    out.push({ id, nome: String(c.nome || `Conexão ${id}`).slice(0, 120), ativo: c.ativo === true,
               peso: Number.isFinite(p) ? Math.min(PESO_MAX, Math.max(1, p)) : 1, fila });
  }
  return out;
}

// Conexões que entram no sorteio, em ordem estável (a ordem do rodízio).
function elegiveis(conexoes) {
  return (Array.isArray(conexoes) ? conexoes : []).filter(c => c && c.ativo)
    .sort((a, b) => String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true }));
}

// Sorteio ponderado. `r` em [0,1) — injetável pra teste.
function escolherPonderada(lista, r = crypto.randomInt(0, 1e9) / 1e9) {
  const total = lista.reduce((t, c) => t + (c.peso || 1), 0);
  let alvo = r * total;
  for (const c of lista) {
    alvo -= (c.peso || 1);
    if (alvo < 0) return c;
  }
  return lista[lista.length - 1];
}

// Lê a configuração da distribuição. null = desligada ou sem conexão marcada.
async function config(pool) {
  const { rows: [e] } = await pool.query(
    `SELECT distrib_ativo, distrib_modo, distrib_conexoes, distrib_token FROM estrategia`);
  if (!e || !e.distrib_ativo) return null;
  const lista = elegiveis(e.distrib_conexoes);
  if (!lista.length) return { ativo: true, lista, motivo: 'nenhuma_conexao_marcada' };
  if (!e.distrib_token) return { ativo: true, lista, motivo: 'sem_token_empresa' };
  return { ativo: true, modo: MODOS.includes(e.distrib_modo) ? e.distrib_modo : 'rodizio', lista, token: e.distrib_token };
}

// Escolhe a conexão do lead. Reusa a que ele já tem se ela continua marcada.
async function escolher(pool, cfg, lead) {
  const ja = lead?.crm_conexao_id != null ? cfg.lista.find(c => c.id === String(lead.crm_conexao_id)) : null;
  if (ja) return { conexao: ja, reuso: true };
  if (cfg.modo === 'demanda') return escolherPorDemanda(pool, cfg, lead);
  let conexao;
  if (cfg.modo === 'ponderada') {
    conexao = escolherPonderada(cfg.lista);
  } else {
    const { rows: [r] } = await pool.query(
      `UPDATE estrategia SET distrib_pos = distrib_pos + 1 RETURNING distrib_pos`);
    const pos = Number(r?.distrib_pos || 1) - 1;
    conexao = cfg.lista[((pos % cfg.lista.length) + cfg.lista.length) % cfg.lista.length];
  }
  return { conexao, reuso: false };
}

// Carga de cada conexão: os leads aguardando atendimento mais os que acabaram
// de ser atribuídos e ainda estão a caminho do CRM (o worker manda vários em
// paralelo — sem contar esses, uma rajada inteira cairia na mesma conexão).
// A trava serializa a escolha: a contagem e a gravação valem juntas.
const A_CAMINHO_MIN = 15;
async function escolherPorDemanda(pool, cfg, lead) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(`SELECT pg_advisory_xact_lock(hashtext('hunter:distrib-demanda'))`);
    const ids = cfg.lista.map(c => c.id);
    const { rows } = await db.query(
      `SELECT crm_conexao_id AS id,
              COUNT(*) FILTER (WHERE crm_atendimento = 'aguardando'
                 OR (crm_atendimento IS NULL AND enviado_crm_em IS NULL
                     AND crm_conexao_em > now() - make_interval(mins => $2)))::int AS carga,
              max(crm_conexao_em) AS ultimo
         FROM leads WHERE crm_conexao_id = ANY($1::text[]) GROUP BY crm_conexao_id`, [ids, A_CAMINHO_MIN]);
    const porId = new Map(rows.map(r => [String(r.id), r]));
    const conexao = escolherMenorCarga(cfg.lista, porId);
    if (lead?.id != null) {
      await db.query(`UPDATE leads SET crm_conexao_id=$2, crm_conexao_nome=$3, crm_conexao_em=now() WHERE id=$1`,
        [lead.id, conexao.id, conexao.nome]);
    }
    await db.query('COMMIT');
    return { conexao, reuso: false, gravado: lead?.id != null };
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { db.release(); }
}

// Menor carga; empate → a que recebeu lead há mais tempo (nunca recebeu = primeiro).
function escolherMenorCarga(lista, porId) {
  const t = d => (d ? new Date(d).getTime() : 0);
  return [...lista].sort((a, b) => {
    const ca = porId.get(a.id), cb = porId.get(b.id);
    return ((ca?.carga || 0) - (cb?.carga || 0)) || (t(ca?.ultimo) - t(cb?.ultimo));
  })[0];
}

module.exports = { MODOS, PESO_MAX, normalizarConexoes, elegiveis, escolherPonderada, escolherMenorCarga, config, escolher };
