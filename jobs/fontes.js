'use strict';
/*
 * Hunter — de onde vem a busca web deste cliente.
 * Antes cada job tinha a própria cópia de `chaveBuscaWeb`, que só sabia ler a
 * chave da Tavily. Com o SearXNG entrando como fonte grátis, virou mais de uma
 * coisa — e duas cópias divergindo é bug esperando acontecer.
 */

// Fontes de busca web configuradas em `integracoes` (categoria 'busca_web').
// Nunca lança: sem configuração, o motor cai no DuckDuckGo grátis.
async function fontesBuscaWeb(pool) {
  const out = { tavilyKey: null, searxngUrl: null };
  try {
    const { rows } = await pool.query(
      `SELECT provedor, key_cifrada, config FROM integracoes
       WHERE categoria='busca_web' AND ativo=true ORDER BY ordem`
    );
    for (const r of rows) {
      if (r.provedor === 'searxng') {
        const u = String(r.config?.url || '').trim();
        if (u) out.searxngUrl = u;
      } else if (r.key_cifrada) {
        // Qualquer outro provedor de busca com chave é tratado como Tavily —
        // é o único com chave hoje, e assim uma linha legada sem `provedor`
        // preenchido continua funcionando.
        out.tavilyKey = r.key_cifrada;
      }
    }
  } catch (_) { /* sem integrações → grátis */ }
  return out;
}

// O motor tem alguma fonte de busca web configurada? Usado pra distinguir
// "não achei contato" de "não fui configurado pra achar".
function temBuscaWeb(f) { return !!(f?.searxngUrl || f?.tavilyKey); }

module.exports = { fontesBuscaWeb, temBuscaWeb };
