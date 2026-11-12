'use strict';
/*
 * Hunter — palavras negativadas.
 *
 * O joinha pra baixo ensina o perfil devagar (precisa de vários exemplos pra
 * uma palavra pesar). Aqui é o contrário: o usuário diz QUAL palavra do nome
 * indica que a empresa não serve ("drone", "automotivos"), e ela vira regra
 * na hora — empresa com essa palavra no nome não entra na esteira e nunca
 * vira lead, em nenhum radar do cliente.
 *
 * A comparação é por palavra inteira, juntando só singular/plural e gênero
 * ("automotivo", "automotiva", "automotivos"). NÃO usa a família larga das
 * palavras do ramo: lá "filtragem" e "filtros" são a mesma coisa, e negativar
 * uma derrubaria a outra.
 */
const { singular } = require('./palavras');
const tokensNome = (...partes) => require('./perfil').tokensNome(...partes);

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Raiz da palavra pra comparar: sem acento, no singular e sem a vogal final.
function raiz(palavra) {
  let t = singular(semAcento(palavra).replace(/[^a-z0-9]/g, ''));
  if (t.length > 4 && /[aeo]$/.test(t)) t = t.slice(0, -1);
  return t;
}

// A palavra pode ser negativada? Curta demais ou genérica de nome de empresa
// ("comercio", "ltda") não chega ao filtro — o tokenizador já a descarta.
function aceita(palavra) {
  const limpa = semAcento(palavra).replace(/[^a-z0-9]/g, '');
  return limpa.length >= 3 && tokensNome(limpa).length === 1;
}

// Raízes negativadas do cliente (uma conexão = um cliente; cache curto porque
// o Score 1 passa aqui a cada empresa).
let _cache = { em: 0, mapa: null };
const CACHE_MS = 20_000;
async function carregar(pool) {
  if (_cache.mapa && Date.now() - _cache.em < CACHE_MS) return _cache.mapa;
  const { rows } = await pool.query(`SELECT raiz, palavra FROM palavras_negativas`).catch(() => ({ rows: [] }));
  _cache = { em: Date.now(), mapa: new Map(rows.map(r => [r.raiz, r.palavra])) };
  return _cache.mapa;
}
function invalidar() { _cache = { em: 0, mapa: null }; }

// Palavras do nome da empresa (fantasia + razão), cada uma com a sua raiz.
function palavrasDoNome(emp) {
  const vistos = new Set(), out = [];
  for (const t of tokensNome(emp?.fantasia, emp?.razao)) {
    const r = raiz(t);
    if (!r || vistos.has(r)) continue;
    vistos.add(r); out.push({ palavra: t, raiz: r });
  }
  return out;
}

// A empresa tem no nome uma palavra negativada? Devolve a palavra (como o
// usuário cadastrou) ou null. `mapa` = resultado de carregar().
function noNome(emp, mapa) {
  if (!mapa || !mapa.size) return null;
  for (const p of palavrasDoNome(emp)) if (mapa.has(p.raiz)) return mapa.get(p.raiz);
  return null;
}

module.exports = { raiz, aceita, carregar, invalidar, noNome, palavrasDoNome };
