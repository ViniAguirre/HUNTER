'use strict';
/*
 * Hunter — provider de busca web (Tavily).
 * Substitui o scraping frágil do DuckDuckGo por uma API de busca feita pra isso:
 * mais estável, e traz um trecho de conteúdo por resultado (útil como resumo
 * de reserva pro SWOT quando o scrape do site não rende).
 *
 * NÃO é enriquecimento firmográfico (isso é Receita/CNPJá) nem telefone
 * comercial (isso é Places/Econodata) — é só a camada de "encontrar na web".
 * Se a chave não existir ou falhar, o motor cai no DuckDuckGo grátis.
 */
const axios = require('axios');

const ENDPOINT = 'https://api.tavily.com/search';

// Busca web. Retorna [{ site, titulo, conteudo }] com `site` no formato origin
// (esquema+host), pra o chamador filtrar/deduplicar igual faz com o DDG.
// Em qualquer erro, devolve [] (o chamador cai no fallback grátis).
async function buscar(query, { apiKey, max = 30 } = {}) {
  if (!apiKey || !query) return [];
  try {
    const { data } = await axios.post(ENDPOINT, {
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: Math.min(Math.max(max, 1), 50),
      include_answer: false,
      include_raw_content: false,
    }, { timeout: 12000, headers: { 'Content-Type': 'application/json' } });

    const results = Array.isArray(data?.results) ? data.results : [];
    const out = [];
    for (const r of results) {
      let origin; try { origin = new URL(r.url).origin; } catch { continue; }
      out.push({
        site: origin,
        titulo: (r.title || '').trim().slice(0, 120) || null,
        conteudo: (r.content || '').trim().slice(0, 600) || null,
      });
    }
    return out;
  } catch (_) {
    return [];   // chave inválida / rate limit / rede → fallback grátis
  }
}

module.exports = { buscar };
