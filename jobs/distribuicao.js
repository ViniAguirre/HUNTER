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
 *
 * O lead guarda a conexão escolhida: retentativa e reenvio reusam a mesma, sem
 * gastar a vez de outra conexão no rodízio.
 */
const crypto = require('crypto');

const MODOS = ['rodizio', 'ponderada'];
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
    out.push({ id, nome: String(c.nome || `Conexão ${id}`).slice(0, 120), ativo: c.ativo === true,
               peso: Number.isFinite(p) ? Math.min(PESO_MAX, Math.max(1, p)) : 1 });
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

module.exports = { MODOS, PESO_MAX, normalizarConexoes, elegiveis, escolherPonderada, config, escolher };
