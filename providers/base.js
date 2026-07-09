'use strict';
/*
 * Hunter — taxas-base do universo (para o peso por RARIDADE / lift no Score 1).
 * A ideia: um CNAE que é raro no Brasil mas domina a lista do cliente é um sinal
 * MUITO mais forte que um CNAE comum. Para saber o que é "raro", precisamos da
 * distribuição da base. Fonte: o próprio ledger `empresas` (cresce e afia sozinho),
 * com um prior estático de UF pra já funcionar do dia 1. Nada disso é pago.
 */

// Participação aproximada de empresas ativas por UF (fonte pública IBGE/Receita).
// É só um prior — assim o lift de UF já funciona antes do ledger encher.
const UF_PRIOR = {
  SP:0.280, MG:0.100, RJ:0.082, RS:0.072, PR:0.070, SC:0.062, BA:0.050, GO:0.043,
  PE:0.035, CE:0.032, PA:0.026, ES:0.024, DF:0.022, MT:0.021, MA:0.018, MS:0.017,
  PB:0.014, RN:0.014, AM:0.013, PI:0.012, AL:0.011, SE:0.009, RO:0.010,
  TO:0.008, AC:0.004, AP:0.003, RR:0.003,
};

const MIN_LEDGER = 300;        // abaixo disso o ledger é fino demais → usa prior/neutro
const TTL_MS = 10 * 60 * 1000; // cache de 10 min (a base muda devagar)
let _cache = null, _cacheEm = 0;

async function carregar(pool) {
  if (_cache && (Date.now() - _cacheEm) < TTL_MS) return _cache;

  let total = 0;
  const cnae = new Map();
  const uf = new Map();
  try {
    const { rows } = await pool.query(
      `SELECT cnae, uf, COUNT(*)::int AS n FROM empresas GROUP BY cnae, uf`
    );
    for (const r of rows) {
      const c = String(r.cnae || '').replace(/\D/g, '');
      if (c) cnae.set(c, (cnae.get(c) || 0) + r.n);
      if (r.uf) uf.set(r.uf, (uf.get(r.uf) || 0) + r.n);
      total += r.n;
    }
  } catch (_) { /* sem ledger ainda → cai no prior/neutro */ }

  _cache = { total, cnae, uf };
  _cacheEm = Date.now();
  return _cache;
}

// Retorna um objeto com share(dim, chave) → participação [0..1] ou null (desconhecido).
async function baseRates(pool) {
  const b = await carregar(pool);
  const usaLedger = b.total >= MIN_LEDGER;
  return {
    total: b.total,
    share(dim, chave) {
      if (dim === 'uf') {
        if (usaLedger && b.uf.has(chave)) return b.uf.get(chave) / b.total;
        return UF_PRIOR[chave] ?? null;
      }
      if (dim === 'cnae') {
        if (usaLedger && b.cnae.has(chave)) return b.cnae.get(chave) / b.total;
        return null; // sem base confiável de CNAE → lift neutro
      }
      return null;
    },
  };
}

// Converte uma participação-base em multiplicador de REFORÇO (>= 1): raro reforça,
// comum fica neutro. Nunca reduz — não quebra o corte de listas de nicho comum.
const S_COMUM = 0.05, S_RARO = 0.002, BOOST_MAX = 0.5;
function pesoRaridade(share) {
  if (share == null || share <= 0) return 1;
  const lo = Math.log10(1 / S_COMUM);   // ~1.30
  const hi = Math.log10(1 / S_RARO);    // ~2.70
  const x = Math.log10(1 / share);
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return +(1 + BOOST_MAX * t).toFixed(3);
}

module.exports = { baseRates, pesoRaridade, invalidarCache: () => { _cache = null; } };
