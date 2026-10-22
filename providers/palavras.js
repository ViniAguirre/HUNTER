'use strict';
/*
 * Hunter — palavras do ramo (semelhantes).
 *
 * Os nomes dos clientes dizem o ramo melhor que o CNAE: "HDR PURIFICADORES DE
 * AGUA" registrada como loja de eletrodomésticos. O perfil já contava as
 * palavras que se repetem nos nomes; aqui elas viram PALAVRAS DO RAMO, usadas
 * na busca (palavra-chave) e no filtro (atividade rara entre os clientes só
 * passa com uma delas no nome). Três cuidados:
 *
 * 1) Família: "purificador", "purificadores" e "purificação" são a mesma
 *    palavra; "filtro", "filtros" e "filtragem" também (familia()).
 * 2) Especificidade: palavra que aparece em muito nome de empresa de outros
 *    ramos ("água": água mineral, poço, galão) traz quem não é cliente. Mede-se
 *    o quanto ela é comum no cadastro geral (o `empresas` de todos os clientes
 *    do Hunter) contra o quanto aparece entre os clientes; com a IA ativa, ela
 *    também julga — e a palavra genérica não vira palavra do ramo.
 * 3) Expansão: a IA sugere outras palavras do mesmo ramo que costumam aparecer
 *    em nome de empresa ("osmose", "bebedouros"); cada sugestão passa pelo mesmo
 *    teste de especificidade. O usuário remove a que não servir (radar).
 */
// O perfil também usa este módulo: o tokenizador dele é carregado na hora do uso.
const tokensNome = (...partes) => require('./perfil').tokensNome(...partes);

const FREQ_MIN = 0.05;          // família em 5%+ dos clientes vira candidata
const N_MIN = 2;                // e em pelo menos 2 empresas (1 é nome próprio)
const SHARE_GENERICA = 0.003;   // em 0,3%+ de todos os nomes do cadastro…
const LIFT_GENERICA = 50;       // …e menos de 50× mais comum entre os clientes → genérica
const MAX_SUGERIDAS = 8;
const MAX_TERMOS_BUSCA = 12;

// ── Família da palavra ──────────────────────────────────────────────────────
// Radical simples do português: tira o plural, um sufixo de derivação comum e
// a vogal final. Basta pra juntar as formas que aparecem em nome de empresa;
// não pretende ser um stemmer completo.
const SUFIXOS = ['acoes', 'acao', 'adoras', 'adores', 'adora', 'ador', 'agens', 'agem', 'arias', 'aria',
  'eiras', 'eiros', 'eira', 'eiro', 'antes', 'ante', 'mente'];
function singular(t) {
  if (t.length <= 4) return t;
  if (t.endsWith('oes') || t.endsWith('aes')) return t.slice(0, -3) + 'ao';
  if (t.endsWith('ores')) return t.slice(0, -2);
  if (t.endsWith('is') && t.length >= 5) return t.slice(0, -2) + 'il';
  if (t.endsWith('ns')) return t.slice(0, -2) + 'm';
  if (/[rsz]es$/.test(t)) return t.slice(0, -2);
  if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}
function familia(palavra) {
  let t = singular(String(palavra || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  for (const s of SUFIXOS) {
    if (t.endsWith(s) && t.length - s.length >= 4) { t = t.slice(0, -s.length); break; }
  }
  if (t.length > 4 && /[aeo]$/.test(t)) t = t.slice(0, -1);
  return t;
}

// Famílias dos nomes de uma lista de empresas: quantas empresas têm cada uma e
// com que formas ela aparece.
function agrupar(empresas) {
  const fam = new Map();
  for (const e of empresas || []) {
    const vistas = new Set();
    for (const tok of tokensNome(e.fantasia, e.razao)) {
      const f = familia(tok);
      if (f.length < 3) continue;
      const g = fam.get(f) || { n: 0, formas: new Map() };
      g.formas.set(tok, (g.formas.get(tok) || 0) + 1);
      if (!vistas.has(f)) { g.n++; vistas.add(f); }
      fam.set(f, g);
    }
  }
  return fam;
}

// ── Quão comum é cada família no cadastro geral ─────────────────────────────
// Uma varredura só no `empresas`, com uma expressão por família. Em cache por
// 6 h: o cadastro muda devagar e cada radar de cidade re-perfila a lista.
const _shareCache = new Map();
const CACHE_MS = 6 * 3600_000;
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function shareNoCadastro(pool, grupos) {
  const out = new Map(), faltam = [];
  for (const [f, formas] of grupos) {
    const c = _shareCache.get(f);
    if (c && Date.now() - c.em < CACHE_MS) out.set(f, c.v); else faltam.push([f, formas]);
  }
  if (!faltam.length) return out;
  const vals = [];
  const somas = faltam.map(([, formas]) => {
    // Palavra inteira (\m…\M), sem acento: "filtro" não casa "infiltração".
    vals.push(`\\m(${[...new Set(formas.map(x => escRe(x)))].join('|')})\\M`);
    return `COUNT(*) FILTER (WHERE nome ~ $${vals.length})::int`;
  });
  try {
    const { rows: [r] } = await pool.query(
      `SELECT COUNT(*)::int AS total, ${somas.map((s, i) => `${s} AS f${i}`).join(', ')}
         FROM (SELECT translate(lower(coalesce(razao, '') || ' ' || coalesce(fantasia, '')),
                      'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') AS nome FROM empresas) e`, vals);
    faltam.forEach(([f], i) => {
      const v = r.total >= 300 ? { share: r[`f${i}`] / r.total, n: r[`f${i}`], total: r.total } : null;
      out.set(f, v);
      _shareCache.set(f, { em: Date.now(), v });
    });
  } catch (e) {
    console.warn('[palavras] não consegui medir as palavras no cadastro:', e.message);
    for (const [f] of faltam) out.set(f, null);
  }
  return out;
}

const generica = (freq, base) => !!(base && base.share >= SHARE_GENERICA && freq / base.share < LIFT_GENERICA);

// ── Montagem ────────────────────────────────────────────────────────────────
// `empresas`: firmografia dos clientes (amostra do perfil). `negativas`: os que
// o usuário recusou (palavra só deles nunca é do ramo). `ia`: { avaliar(cands) }
// opcional (providers/openai.js → avaliarPalavras). `excluidas`: famílias que o
// usuário removeu (ficam marcadas, fora da busca e do filtro).
async function palavrasDoRamo(pool, empresas, { negativas = [], ia = null, excluidas = [] } = {}) {
  const amostra = (empresas || []).length;
  if (!amostra) return { palavras: [], termos: [] };
  const pos = agrupar(empresas), neg = agrupar(negativas);
  const fora = new Set((excluidas || []).map(familia));

  let cands = [...pos.entries()]
    .map(([f, g]) => ({ f, n: g.n, freq: +(g.n / amostra).toFixed(3),
      formas: [...g.formas.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t), nneg: neg.get(f)?.n || 0 }))
    .filter(c => c.n >= N_MIN && c.freq >= FREQ_MIN)
    .sort((a, b) => b.n - a.n)
    .slice(0, 25);

  // A IA julga cada candidata (do ramo × genérica) e sugere outras.
  let veredito = null;
  if (ia && cands.length) {
    try { veredito = await ia.avaliar(cands.map(c => ({ palavra: c.formas[0], freq: c.freq })), empresas); }
    catch (e) { console.warn('[palavras] IA não avaliou as palavras (fica a medida do cadastro):', e.message); }
  }
  const genIa = new Set((veredito?.genericas || []).map(familia));
  const sugeridas = [];
  for (const s of veredito?.sugeridas || []) {
    const formas = [...new Set([s.palavra, ...(s.formas || [])].map(x => String(x || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim()).filter(x => x.length >= 4))];
    if (!formas.length) continue;
    const f = familia(formas[0]);
    if (cands.some(c => c.f === f) || sugeridas.some(x => x.f === f)) continue;
    sugeridas.push({ f, n: 0, freq: 0, formas, nneg: neg.get(f)?.n || 0, sugerida: true });
    if (sugeridas.length >= MAX_SUGERIDAS) break;
  }

  const todas = [...cands, ...sugeridas];
  const share = await shareNoCadastro(pool, todas.map(c => [c.f, c.formas]));
  const palavras = todas.map(c => {
    const base = share.get(c.f) || null;
    // Sugerida não tem frequência entre clientes: é genérica se for comum no
    // cadastro (a mesma régua, como se 10% dos clientes a tivessem).
    const gen = c.sugerida ? generica(0.10, base) : (genIa.has(c.f) || generica(c.freq, base));
    return {
      f: c.f, formas: c.formas.slice(0, 4), n: c.n, freq: c.freq,
      base: base ? +base.share.toFixed(5) : null,
      origem: c.sugerida ? 'sugerida' : 'clientes',
      ...(gen ? { generica: true } : {}),
      // Só aparece entre os que você recusou mais do que entre os clientes.
      ...(c.nneg > c.n ? { recusada: true } : {}),
      ...(fora.has(c.f) ? { removida: true } : {}),
    };
  });
  return { palavras, termos: termosDeBusca(palavras), avaliadas_por_ia: !!veredito };
}

// Palavras que valem: do ramo, não genéricas, não recusadas, não removidas.
const valida = p => !p.generica && !p.recusada && !p.removida;

// Termos pra busca por nome: as duas formas mais comuns de cada família válida,
// primeiro as dos clientes (mais frequentes antes), depois as sugeridas.
function termosDeBusca(palavras) {
  const out = [];
  const ordem = [...(palavras || [])].filter(valida)
    .sort((a, b) => (a.origem === b.origem ? b.n - a.n : a.origem === 'clientes' ? -1 : 1));
  for (const p of ordem) {
    for (const t of p.formas.slice(0, 2)) if (!out.includes(t)) out.push(t);
    if (out.length >= MAX_TERMOS_BUSCA) break;
  }
  return out.slice(0, MAX_TERMOS_BUSCA);
}

// A empresa tem no nome uma palavra do ramo? Devolve a palavra (ou null).
function palavraDoRamoNoNome(emp, palavras) {
  const fams = new Set(tokensNome(emp?.fantasia, emp?.razao).map(familia));
  return (palavras || []).find(p => valida(p) && fams.has(p.f)) || null;
}

module.exports = { familia, agrupar, palavrasDoRamo, termosDeBusca, palavraDoRamoNoNome, valida,
  shareNoCadastro, SHARE_GENERICA, LIFT_GENERICA };
