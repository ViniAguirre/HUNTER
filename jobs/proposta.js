'use strict';
/*
 * Hunter — proposta de valor de um radar.
 *
 * O radar criado à mão leva a proposta escolhida no assistente
 * (criterios.proposta_valor). O aberto pelo piloto da Estratégia vem da pauta,
 * que nem sempre tem uma: sem ela, a segunda verificação de quem entra só pela
 * atividade (Score 1) e a análise ficavam sem saber o que se vende. Nesse caso
 * vale a primeira proposta cadastrada em "Propostas".
 */
let _cache = { em: 0, texto: null };
async function propostaPadrao(pool) {
  if (Date.now() - _cache.em < 60_000) return _cache.texto;
  const { rows: [p] } = await pool.query(`SELECT texto FROM propostas_valor ORDER BY criado_em LIMIT 1`)
    .catch(() => ({ rows: [] }));
  _cache = { em: Date.now(), texto: p?.texto ? String(p.texto) : null };
  return _cache.texto;
}

async function propostaDoRadar(pool, criterios) {
  const c = criterios || {};
  const propria = c.params?.proposta_valor || c.proposta_valor || c.texto || '';
  if (String(propria).trim()) return { texto: String(propria), origem: 'radar' };
  const padrao = await propostaPadrao(pool);
  return padrao && padrao.trim() ? { texto: padrao, origem: 'cadastro' } : { texto: '', origem: null };
}

module.exports = { propostaDoRadar, propostaPadrao };
