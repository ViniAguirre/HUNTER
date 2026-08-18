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

// Pesos de fábrica do Score 1 (escala 0–100). No modo ICP são usados direto;
// no lookalike servem de PRIOR, e `calcularPesos` redistribui conforme o que
// cada dimensão discrimina naquela lista específica.
const W = {
  CNAE_EXATO: 35,
  // Atividade do mesmo GRUPO (4 primeiros dígitos) não é a mesma atividade —
  // 4753100 e 4753900 são vizinhas, não iguais. Valia 15 (43% do exato), o que
  // deixava "quase certo" passar em corte 60; a 8 (23%) o quase-certo cai fora
  // e o corte volta a significar "quero a atividade exata".
  CNAE_GRUPO: 8,
  UF: 25,
  PORTE: 20,
  CAPITAL: 10,
  SIMPLES: 5,
  SITUACAO_ATIVA: 5,
};

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

/*
 * PODER DISCRIMINANTE de uma dimensão para ESTA lista.
 *
 * A lista do cliente só tem COMPRADORES — não existe contra-exemplo. Então
 * "60% dos meus clientes são do CNAE X" só é informação se X NÃO for 60% do
 * mercado inteiro. Duas perguntas definem se a dimensão vale ponto:
 *
 *   1) CONCENTRAÇÃO — a lista aponta pra poucos valores ou está espalhada?
 *      Espalhada = a dimensão não caracteriza o comprador (ex.: clientes em 20
 *      UFs diferentes: a UF não diz nada sobre quem compra).
 *   2) LIFT — esses valores são desproporcionais em relação ao universo?
 *      Lift 1x = a lista só reflete a composição do mercado → zero sinal.
 *
 * O resultado (0..1) redistribui os pontos: a dimensão que realmente separa
 * comprador de não-comprador fica com o peso, em vez de todo mundo carregar
 * um peso fixo decidido na mão.
 */
function poderDimensao(dist, base, dim) {
  if (!dist || dist.length === 0) return 0;

  // Herfindahl: probabilidade de dois compradores sorteados da lista caírem no
  // MESMO valor. 1 = todos iguais (dimensão define o comprador); perto de 0 =
  // espalhado (não define nada). Usamos o índice cru de propósito: normalizar
  // pelos valores OBSERVADOS puniria a lista de nicho puro — numa lista 90/10 o
  // "espalhamento máximo" seria 50/50, o que não faz sentido como referência
  // (a referência certa é o universo inteiro de valores possíveis).
  const concentracao = dist.reduce((s, x) => s + x.freq * x.freq, 0);

  // Lift médio ponderado pela frequência na lista. Sem base confiável pra essa
  // dimensão, fica neutro (1x) e só a concentração manda.
  let lift = 1;
  if (base && typeof base.share === 'function') {
    let acc = 0, pesoTotal = 0;
    for (const x of dist) {
      const share = base.share(dim, x.chave);
      if (share > 0) { acc += x.freq * (x.freq / share); pesoTotal += x.freq; }
    }
    if (pesoTotal > 0) lift = acc / pesoTotal;
  }
  // lift 1x → 0 ; 10x → 0,5 ; 100x+ → 1
  const sinalLift = Math.max(0, Math.min(1, Math.log10(Math.max(1, lift)) / 2));

  return Math.max(0, Math.min(1, 0.6 * concentracao + 0.4 * sinalLift));
}

// Distribui os 100 pontos entre as dimensões conforme o poder de cada uma
// nesta lista. Parte dos pesos "de fábrica" (W) como prior e modula: uma
// dimensão sem poder nenhum cai pra 35% do peso original; com poder total,
// fica com 100%. Depois normaliza pra a escala continuar 0–100 (o corte do
// usuário significa a mesma coisa em qualquer radar).
function calcularPesos(perfil, base, W) {
  const dims = [
    ['CNAE',    W.CNAE_EXATO, poderDimensao(perfil.cnaes.map(x => ({ chave: x.c, freq: x.freq })), base, 'cnae')],
    ['UF',      W.UF,         poderDimensao(perfil.ufs.map(x => ({ chave: x.uf, freq: x.freq })), base, 'uf')],
    ['PORTE',   W.PORTE,      poderDimensao(perfil.portes.map(x => ({ chave: x.porte, freq: x.freq })), null, 'porte')],
    ['CAPITAL', W.CAPITAL,    poderDimensao(perfil.capitais.map(x => ({ chave: x.faixa, freq: x.freq })), null, 'capital')],
    ['SIMPLES', W.SIMPLES,    perfil.simples_prop == null ? 0 : Math.abs(perfil.simples_prop - 0.5) * 2],
  ];

  const bruto = dims.map(([nome, wBase, poder]) => ({ nome, poder, peso: wBase * (0.35 + 0.65 * poder) }));
  const disponivel = 100 - W.SITUACAO_ATIVA;
  const soma = bruto.reduce((s, d) => s + d.peso, 0) || 1;

  const pesos = { SITUACAO_ATIVA: W.SITUACAO_ATIVA };
  const diagnostico = [];
  for (const d of bruto) {
    const peso = +(d.peso / soma * disponivel).toFixed(1);
    pesos[d.nome] = peso;
    diagnostico.push({ dim: d.nome, poder: +d.poder.toFixed(3), peso });
  }
  // CNAE de grupo (mesmos 4 primeiros dígitos) vale uma fração do CNAE exato.
  pesos.CNAE_GRUPO = +(pesos.CNAE * (W.CNAE_GRUPO / W.CNAE_EXATO)).toFixed(1);
  return { pesos, diagnostico };
}

// Monta o perfil + os parâmetros derivados (descoberta + Score 1) a partir da
// firmografia das empresas da amostra. `base` (opcional) traz as taxas do universo
// pra ponderar por RARIDADE (lift): CNAE/UF raro no país vale mais.
function construirPerfil(empresas, base, W) {
  const amostra = empresas.length;
  const peso = (dim, chave) => {
    if (!base) return 1;
    const { pesoRaridade } = require('./base');
    return pesoRaridade(base.share(dim, chave));
  };

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
    cnaes: cnae.lista.map(x => ({ c: x.chave, n: x.n, freq: +x.freq.toFixed(3), peso: peso('cnae', x.chave) })),
    ufs: uf.lista.map(x => ({ uf: x.chave, n: x.n, freq: +x.freq.toFixed(3), peso: peso('uf', x.chave) })),
    portes: porte.lista.map(x => ({ porte: x.chave, n: x.n, freq: +x.freq.toFixed(3) })),
    capitais: capital.lista.map(x => ({ faixa: x.chave, n: x.n, freq: +x.freq.toFixed(3) })),
    simples_prop: simplesProp != null ? +simplesProp.toFixed(3) : null,
    abertura: datas.length ? { de: datas[Math.floor(datas.length * 0.1)], ate: datas[Math.floor(datas.length * 0.9)] } : null,
  };

  // Pesos DESTA lista: quais dimensões realmente separam comprador de
  // não-comprador aqui. Fica gravado no perfil pra o Score 1 usar e pra a tela
  // conseguir explicar ao usuário o que definiu o perfil ideal.
  if (W) {
    const { pesos, diagnostico } = calcularPesos(perfil, base, W);
    perfil.pesos = pesos;
    perfil.diagnostico = diagnostico;
  }

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

  // Pesos DESTA lista (perfis antigos, gravados antes desta versão, não têm o
  // campo — nesse caso cai nos pesos fixos de fábrica, sem quebrar radar vivo).
  const P = perfil.pesos || {
    CNAE: W.CNAE_EXATO, CNAE_GRUPO: W.CNAE_GRUPO, UF: W.UF,
    PORTE: W.PORTE, CAPITAL: W.CAPITAL, SIMPLES: W.SIMPLES,
    SITUACAO_ATIVA: W.SITUACAO_ATIVA,
  };

  // Afinidade dentro da dimensão: 1 = é o valor DOMINANTE da lista; perto de
  // `PISO` = é um valor de ponta, que aparece pouco entre os compradores.
  // O piso antigo (0,65–0,7) era alto demais: comprimia a escala e fazia um
  // acerto periférico valer quase tanto quanto o núcleo da lista.
  const PISO = 0.25;
  const maxFreq = (arr) => arr.reduce((m, x) => Math.max(m, x.freq), 0) || 1;
  const afin = (freq, mf) => PISO + (1 - PISO) * (freq / mf);

  if (/ativa/i.test(emp.situacao || 'Ativa')) add('Situação ativa', P.SITUACAO_ATIVA);

  const raro = x => (x?.peso > 1.05) ? ' · raro no país' : '';
  const cnaeEmp = String(emp.cnae || '').replace(/\D/g, '');
  if (cnaeEmp && perfil.cnaes?.length) {
    const mf = maxFreq(perfil.cnaes);
    const exato = perfil.cnaes.find(x => x.c === cnaeEmp);
    const grupo = !exato && perfil.cnaes.find(x => x.c.slice(0, 4) === cnaeEmp.slice(0, 4));
    if (exato) add(`CNAE no perfil (${cnaeEmp})${raro(exato)}`, P.CNAE * afin(exato.freq, mf) * (exato.peso || 1));
    else if (grupo) add(`CNAE do mesmo grupo (${cnaeEmp})${raro(grupo)}`, P.CNAE_GRUPO * afin(grupo.freq, mf) * (grupo.peso || 1));
  }

  if (emp.uf && perfil.ufs?.length) {
    const mf = maxFreq(perfil.ufs);
    const hit = perfil.ufs.find(x => x.uf === emp.uf);
    if (hit) add(`UF ${emp.uf} (no perfil)${raro(hit)}`, P.UF * afin(hit.freq, mf) * (hit.peso || 1));
  }

  if (emp.porte && perfil.portes?.length) {
    const mf = maxFreq(perfil.portes);
    const pn = emp.porte.toLowerCase();
    const hit = perfil.portes.find(x => x.porte.toLowerCase() === pn || x.porte.toLowerCase().includes(pn) || pn.includes(x.porte.toLowerCase()));
    if (hit) add(`Porte ${emp.porte} (no perfil)`, P.PORTE * afin(hit.freq, mf));
  }

  if (emp.capital && perfil.capitais?.length) {
    const mf = maxFreq(perfil.capitais);
    const hit = perfil.capitais.find(x => x.faixa === emp.capital);
    if (hit) add(`Capital ${emp.capital} (no perfil)`, P.CAPITAL * afin(hit.freq, mf));
  }

  if (perfil.simples_prop != null && emp.opcao_simples != null) {
    const perfilSimples = perfil.simples_prop >= 0.5;
    if (perfilSimples === !!emp.opcao_simples) add(`Simples: ${emp.opcao_simples ? 'Sim' : 'Não'} (bate com o perfil)`, P.SIMPLES);
  }

  return { score: Math.min(100, score), breakdown };
}

module.exports = { MIN_PERFIL, W, parseCnpjs, construirPerfil, pontuarProximidade, poderDimensao, calcularPesos };
