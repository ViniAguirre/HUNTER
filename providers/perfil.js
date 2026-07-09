'use strict';
/*
 * Hunter — perfilamento de lista (lookalike / público semelhante).
 * Recebe a firmografia (grátis, via CNPJá open) das empresas que o cliente subiu
 * — normalmente clientes que JÁ converteram — e destila um "perfil médio":
 * distribuição de CNAE, UF, porte, capital e Simples. Esse perfil:
 *   1) alimenta a descoberta na CNPJá (busca semelhantes: UF.in + CNAE.in);
 *   2) alimenta o Score 1, que dá NOTA por PROXIMIDADE ao perfil (quanto mais
 *      parecido com o núcleo da lista, maior a nota).
 * O contato bruto da Receita nunca entra aqui — só firmografia.
 */

// Mínimo para montar um perfil que signifique algo. Abaixo disso a "média" é
// ruído estatístico. Não é o ideal — é o piso.
const MIN_PERFIL = 3;

// Extrai CNPJs limpos (14 dígitos) de uma lista colada (texto) ou de um array.
function parseCnpjs(criterios = {}) {
  const bruto = [];
  if (Array.isArray(criterios.cnpjs)) bruto.push(...criterios.cnpjs);
  if (typeof criterios.texto === 'string') bruto.push(...criterios.texto.split(/[\s,;]+/));
  const vistos = new Set();
  const out = [];
  for (const item of bruto) {
    const c = String(item).replace(/\D/g, '');
    if (c.length === 14 && !vistos.has(c)) { vistos.add(c); out.push(c); }
  }
  return out;
}

// Conta frequências e devolve lista ordenada [{ chave, n, freq }].
function distribuicao(valores) {
  const mapa = new Map();
  let total = 0;
  for (const v of valores) {
    if (v == null || v === '') continue;
    mapa.set(v, (mapa.get(v) || 0) + 1);
    total++;
  }
  const lista = [...mapa.entries()]
    .map(([chave, n]) => ({ chave, n, freq: total ? n / total : 0 }))
    .sort((a, b) => b.n - a.n);
  return { lista, total };
}

function confiancaDe(n) {
  if (n < 6) return 'baixa';
  if (n < 15) return 'média';
  return 'alta';
}

// Monta o perfil + os parâmetros derivados (descoberta + Score 1) a partir da
// firmografia das empresas da amostra.
function construirPerfil(empresas) {
  const amostra = empresas.length;

  const cnae = distribuicao(empresas.map(e => String(e.cnae || '').replace(/\D/g, '')).filter(Boolean));
  const uf = distribuicao(empresas.map(e => e.uf).filter(Boolean));
  const porte = distribuicao(empresas.map(e => e.porte).filter(Boolean));
  const capital = distribuicao(empresas.map(e => e.capital).filter(Boolean));

  const simplesVals = empresas.map(e => e.opcao_simples).filter(v => v === true || v === false);
  const simplesSim = simplesVals.filter(Boolean).length;
  const simplesProp = simplesVals.length ? simplesSim / simplesVals.length : null;

  // Datas de abertura → faixa p10..p90 (informativo; não filtra a descoberta).
  const datas = empresas.map(e => e.abertura).filter(Boolean).sort();

  const perfil = {
    amostra,
    confianca: confiancaDe(amostra),
    cnaes: cnae.lista.map(x => ({ c: x.chave, n: x.n, freq: +x.freq.toFixed(3) })),
    ufs: uf.lista.map(x => ({ uf: x.chave, n: x.n, freq: +x.freq.toFixed(3) })),
    portes: porte.lista.map(x => ({ porte: x.chave, n: x.n, freq: +x.freq.toFixed(3) })),
    capitais: capital.lista.map(x => ({ faixa: x.chave, n: x.n, freq: +x.freq.toFixed(3) })),
    simples_prop: simplesProp != null ? +simplesProp.toFixed(3) : null,
    abertura: datas.length ? { de: datas[Math.floor(datas.length * 0.1)], ate: datas[Math.floor(datas.length * 0.9)] } : null,
  };

  // Descoberta (CNPJá): UF é sinal geográfico forte → manda todas as observadas
  // (teto 8). CNAE → cobre ~90% da amostra (teto 10) pra não abrir demais.
  const ufsBusca = perfil.ufs.slice(0, 8).map(x => x.uf);
  const cnaesBusca = [];
  let cobertura = 0;
  for (const x of perfil.cnaes) {
    cnaesBusca.push(x.c);
    cobertura += x.freq;
    if (cnaesBusca.length >= 10 || cobertura >= 0.9) break;
  }

  const params = {
    origem: 'lookalike',
    perfil,
    // parâmetros de descoberta (mesma forma que o ICP usa)
    ufs: ufsBusca,
    cnaes: cnaesBusca,
    portes: [],           // porte fica pro Score 1 (a CNPJá não filtra bem por porte)
    municipios_cod: [],
    founded_gte: null, founded_lte: null,
    equity_gte: null, equity_lte: null,
  };

  return { perfil, params };
}

// Score 1 por PROXIMIDADE ao perfil. `W` são os mesmos pesos do Score 1 ICP,
// então a escala (0–100) e o corte continuam iguais.
function pontuarProximidade(emp, perfil, W) {
  let score = 0;
  const breakdown = [];
  const add = (item, pts) => { if (pts > 0) { pts = Math.round(pts); score += pts; breakdown.push({ item, pts }); } };

  // fator de dominância: quanto mais central no núcleo da lista, mais perto de 1.
  const maxFreq = (arr) => arr.reduce((m, x) => Math.max(m, x.freq), 0) || 1;

  if (/ativa/i.test(emp.situacao || 'Ativa')) add('Situação ativa', W.SITUACAO_ATIVA);

  const cnaeEmp = String(emp.cnae || '').replace(/\D/g, '');
  if (cnaeEmp && perfil.cnaes?.length) {
    const mf = maxFreq(perfil.cnaes);
    const exato = perfil.cnaes.find(x => x.c === cnaeEmp);
    const grupo = !exato && perfil.cnaes.find(x => x.c.slice(0, 4) === cnaeEmp.slice(0, 4));
    if (exato) add(`CNAE no perfil (${cnaeEmp})`, W.CNAE_EXATO * (0.65 + 0.35 * (exato.freq / mf)));
    else if (grupo) add(`CNAE do mesmo grupo (${cnaeEmp})`, W.CNAE_GRUPO * (0.65 + 0.35 * (grupo.freq / mf)));
  }

  if (emp.uf && perfil.ufs?.length) {
    const mf = maxFreq(perfil.ufs);
    const hit = perfil.ufs.find(x => x.uf === emp.uf);
    if (hit) add(`UF ${emp.uf} (no perfil)`, W.UF * (0.7 + 0.3 * (hit.freq / mf)));
  }

  if (emp.porte && perfil.portes?.length) {
    const mf = maxFreq(perfil.portes);
    const pn = emp.porte.toLowerCase();
    const hit = perfil.portes.find(x => x.porte.toLowerCase() === pn || x.porte.toLowerCase().includes(pn) || pn.includes(x.porte.toLowerCase()));
    if (hit) add(`Porte ${emp.porte} (no perfil)`, W.PORTE * (0.7 + 0.3 * (hit.freq / mf)));
  }

  if (emp.capital && perfil.capitais?.length) {
    const hit = perfil.capitais.find(x => x.faixa === emp.capital);
    if (hit) add(`Capital ${emp.capital} (no perfil)`, W.CAPITAL);
  }

  if (perfil.simples_prop != null && emp.opcao_simples != null) {
    const perfilSimples = perfil.simples_prop >= 0.5;
    if (perfilSimples === !!emp.opcao_simples) add(`Simples: ${emp.opcao_simples ? 'Sim' : 'Não'} (bate com o perfil)`, W.SIMPLES);
  }

  return { score: Math.min(100, score), breakdown };
}

module.exports = { MIN_PERFIL, parseCnpjs, construirPerfil, pontuarProximidade };
