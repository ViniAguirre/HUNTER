'use strict';
/*
 * Hunter — provider de busca web (SearXNG auto-hospedado).
 * Meta-buscador: consulta Google, Bing, Brave e DuckDuckGo de uma vez e devolve
 * o resultado unificado. Roda num container na rede interna, sem chave e sem
 * cota — por isso vem ANTES da Tavily na ordem: o que ele resolver é de graça.
 *
 * Alcança o índice do Google, que é justamente o que falta ao DuckDuckGo raspado
 * por HTML: PME brasileira sem SEO quase não aparece no DDG e aparece no Google.
 *
 * Mesmo contrato dos outros providers de busca: devolve [{ site, titulo,
 * conteudo }] e NUNCA lança — em qualquer falha volta [] e o motor cai na
 * próxima fonte.
 */
const axios = require('axios');

// Disjuntor: se o SearXNG está fora (container caiu, ainda subindo, sem rede),
// cada busca pagaria o timeout à toa. Depois de FALHAS_ATE_ABRIR erros seguidos
// ele é pulado por PAUSA_MS, e uma tentativa isolada reabre quando volta.
const FALHAS_ATE_ABRIR = 3;
const PAUSA_MS = 5 * 60 * 1000;
let falhasSeguidas = 0;
let mudoAte = 0;

function disponivel() { return Date.now() >= mudoAte; }
function registrarFalha() {
  if (++falhasSeguidas >= FALHAS_ATE_ABRIR) {
    mudoAte = Date.now() + PAUSA_MS;
    falhasSeguidas = 0;
    console.warn(`[searxng] fora do ar — pulando por ${PAUSA_MS / 60000} min (busca segue nas outras fontes)`);
  }
}

async function buscar(query, { url, max = 30 } = {}) {
  if (!url || !query || !disponivel()) return [];
  let base; try { base = new URL('/search', url).toString(); } catch { return []; }
  try {
    const { data } = await axios.get(base, {
      params: { q: query, format: 'json', language: 'pt-BR', safesearch: 0 },
      timeout: 12000, maxContentLength: 5_000_000,
    });
    const results = Array.isArray(data?.results) ? data.results : [];
    falhasSeguidas = 0;
    const out = [];
    for (const r of results.slice(0, Math.max(1, max))) {
      let origin; try { origin = new URL(r.url).origin; } catch { continue; }
      out.push({
        site: origin,
        titulo: (r.title || '').trim().slice(0, 120) || null,
        conteudo: (r.content || '').trim().slice(0, 600) || null,
      });
    }
    return out;
  } catch (e) {
    registrarFalha();
    return [];
  }
}

module.exports = { buscar };
