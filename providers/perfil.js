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
  // Palavras do nome da empresa. Peso alto de propósito: em nicho que a CNAE
  // não distingue, é o único sinal que separa cliente de não-cliente.
  NOME: 18,
  SIMPLES: 5,
  SITUACAO_ATIVA: 5,
};

/*
 * TOKENS DO NOME da empresa.
 *
 * O CNAE é grosso demais pra alguns nichos: "comércio varejista de
 * eletrodomésticos" cobre tanto uma loja de filtros de água quanto uma loja de
 * drones. Quem separa as duas é o NOME — "Mundo dos Filtros" e "Drone Vision"
 * têm o mesmo CNAE e nada a ver uma com a outra.
 *
 * Fora as palavras que não dizem nada (LTDA, COMERCIO, SERVICOS...), o que
 * sobra costuma ser o ramo real do negócio.
 */
const STOP_NOME = new Set([
  'ltda','me','epp','eireli','sa','cia','filial','matriz','brasil','group','grupo',
  'comercio','comercial','industria','industrial','servicos','servico','solucoes','solucao',
  'representacoes','distribuidora','distribuidor','empresa','negocios','participacoes',
  'geral','central','nacional','regional','ind','com','imp','exp','importacao','exportacao',
]);

function tokensNome(...partes) {
  const txt = partes.filter(Boolean).join(' ');
  const limpo = String(txt).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const out = new Set();
  for (const t of limpo.split(/[^a-z0-9]+/)) {
    if (t.length >= 3 && !STOP_NOME.has(t) && !/^\d+$/.test(t)) out.add(t);
  }
  return [...out];
}

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
/*
 * EVIDÊNCIA de um valor, quando existem CONTRAEXEMPLOS (leads que o usuário
 * marcou como "fora do perfil").
 *
 * Sem contraexemplo, a lista só diz "meus clientes são assim" — e não dá pra
 * saber se aquilo caracteriza o comprador ou se é só o normal do mercado. Com
 * os dois lados, a pergunta vira direta: entre quem eu quero e quem eu recusei,
 * de que lado esse valor aparece?
 *
 *   0,5 = aparece igual nos dois lados  → não diz nada
 *   → 1 = só aparece entre compradores  → sinal forte a favor
 *   → 0 = só aparece entre os recusados → sinal forte contra
 *
 * Compara TAXAS, não contagens: "que fração dos meus clientes tem esse valor"
 * contra "que fração dos recusados tem esse valor". Comparar contagem cru
 * enviesaria pro lado maior — com 10 clientes e 4 recusados, um valor presente
 * em 100% dos DOIS lados pareceria 70% a favor do cliente, quando na verdade
 * não distingue nada.
 *
 * O +1 (Laplace) evita que UM caso isolado vire conclusão absoluta.
 */
function evidenciaDe(nPos, nNeg, totPos, totNeg) {
  if (!totNeg) return null;                       // sem contraexemplo, sem evidência
  const taxaPos = (nPos + 1) / (totPos + 2);
  const taxaNeg = (nNeg + 1) / (totNeg + 2);
  return taxaPos / (taxaPos + taxaNeg);
}

// Multiplicador aplicado aos pontos da dimensão. O joinha pra baixo só SUBTRAI:
// derruba o que é típico de quem você recusou, e nunca infla o que é típico de
// quem você quer (isso a frequência na lista já mede). Além de casar com o que
// o botão significa, evita um artefato: com poucos contraexemplos, um valor
// presente nos DOIS lados pendia pro positivo só por haver mais compradores que
// recusados na amostra, e o lead ruim subia de nota em vez de cair.
function ajusteDe(ev) {
  if (ev == null) return 1;
  return Math.max(0.25, Math.min(1, ev * 2));
}

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
// O quanto esta dimensão SEPARA compradores de recusados. 0 = os dois lados
// têm os mesmos valores (a dimensão não decide nada); 1 = cada valor pertence
// claramente a um lado só. Só existe quando há contraexemplo marcado.
function separacaoDimensao(arr) {
  let acc = 0, tot = 0;
  for (const x of arr || []) {
    if (x.ev == null) continue;
    const peso = (x.n || 0) + (x.nneg || 0);
    acc += peso * Math.abs(2 * x.ev - 1);
    tot += peso;
  }
  return tot > 0 ? acc / tot : null;
}

// Poder da dimensão NOME: que fração dos clientes é coberta pelas palavras que
// se repetem. Lista onde metade dos nomes tem "filtros"/"refrigeracao" tem sinal
// forte; lista de nomes todos diferentes entre si não tem sinal nenhum.
function coberturaNome(nomes) {
  if (!nomes || !nomes.length) return 0;
  const melhor = nomes.reduce((m, x) => Math.max(m, x.freq || 0), 0);
  const soma = Math.min(1, nomes.reduce((s, x) => s + (x.freq || 0), 0));
  return Math.max(0, Math.min(1, 0.5 * melhor + 0.5 * soma));
}

function calcularPesos(perfil, base, W, opts = {}) {
  // Geografia escolhida na mão: TODA empresa encontrada já está na UF pedida,
  // então a UF não separa mais uma da outra — vira filtro, não sinal. Zera o
  // poder dela e os pontos vão pras dimensões que ainda discriminam.
  const poderUf = opts.geoManual
    ? 0
    : poderDimensao(perfil.ufs.map(x => ({ chave: x.uf, freq: x.freq })), base, 'uf');
  // `temDados` = a dimensão existe nesta lista. Sem dado nenhum (ex.: nenhuma
  // empresa tem nome cadastrado), ela sai da divisão de pontos em vez de ficar
  // com o peso mínimo — senão consumiria pontos que ninguém consegue ganhar e o
  // cliente perfeito nunca chegaria a 100.
  const dims = [
    ['CNAE',    W.CNAE_EXATO, poderDimensao(perfil.cnaes.map(x => ({ chave: x.c, freq: x.freq })), base, 'cnae'), perfil.cnaes.length > 0],
    // Geografia na mão: a UF sai da divisão de pontos INTEIRA, não só com poder
    // zero. Com `temDados` true ela ainda levava o peso mínimo (~13 de 100) — e
    // como o filtro leva a busca pra uma UF que quase nunca está na lista de
    // clientes, TODA empresa encontrada tirava zero nesses pontos. Não por ser
    // ruim: por não haver com o que comparar. Todo lead nascia com 13 pontos de
    // desconto e o corte ficava desalinhado com o que o usuário pediu.
    ['UF',      W.UF,         poderUf, !opts.geoManual && perfil.ufs.length > 0],
    ['PORTE',   W.PORTE,      poderDimensao(perfil.portes.map(x => ({ chave: x.porte, freq: x.freq })), null, 'porte'), perfil.portes.length > 0],
    ['CAPITAL', W.CAPITAL,    poderDimensao(perfil.capitais.map(x => ({ chave: x.faixa, freq: x.freq })), null, 'capital'), perfil.capitais.length > 0],
    // O nome não é "distribuição de valores" como as outras: mede-se pela
    // COBERTURA (que fatia dos clientes é alcançada pelas palavras repetidas).
    ['NOME',    W.NOME,       coberturaNome(perfil.nomes), (perfil.nomes || []).length > 0],
    ['SIMPLES', W.SIMPLES,    perfil.simples_prop == null ? 0 : Math.abs(perfil.simples_prop - 0.5) * 2, perfil.simples_prop != null],
  ];

  // Com contraexemplos, o que MAIS importa é o que separa os dois lados — mais
  // até que a concentração. O peso dessa evidência cresce conforme o usuário
  // marca leads fora do perfil (satura em 60% com ~20 marcações), pra dois ou
  // três cliques não virarem regra.
  const nNeg = perfil.negativos || 0;
  const wSep = Math.min(0.7, nNeg / 8);
  const sepPor = {
    CNAE: separacaoDimensao(perfil.cnaes),
    UF: separacaoDimensao(perfil.ufs),
    PORTE: separacaoDimensao(perfil.portes),
    CAPITAL: separacaoDimensao(perfil.capitais),
    NOME: separacaoDimensao(perfil.nomes),
    SIMPLES: null,
  };
  // O piso (fração do peso que a dimensão mantém mesmo sem poder nenhum) cai
  // conforme ganhamos evidência dos contraexemplos. Sem evidência, 35% — uma
  // aposta prudente. Com evidência de que a dimensão NÃO separa os dois lados
  // (ex.: o mesmo CNAE aparece em clientes e recusados), ela desce quase a zero
  // e os pontos vão pra quem de fato distingue. Sem isso, CNAE/UF/porte
  // idênticos nos dois lados seguravam ~80 pontos e o lead ruim nunca caía.
  const piso = 0.35 * (1 - wSep);
  const bruto = dims.map(([nome, wBase, poder, temDados]) => {
    if (!temDados) return { nome, poder: 0, peso: 0 };
    const sep = sepPor[nome];
    const p = (sep != null && wSep > 0) ? (1 - wSep) * poder + wSep * sep : poder;
    return { nome, poder: p, peso: wBase * (piso + (1 - piso) * p) };
  });
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
function construirPerfil(empresas, base, W, opts = {}) {
  const amostra = empresas.length;
  // Contraexemplos: empresas que o usuário marcou como "fora do perfil".
  const negativas = Array.isArray(opts.negativas) ? opts.negativas : [];
  const temNeg = negativas.length > 0;
  // Contagem por valor entre os recusados, pra cruzar com a dos compradores.
  const contarNeg = (campo, norm = x => x) => {
    const m = new Map();
    for (const e of negativas) {
      const v = norm(e[campo]);
      if (v == null || v === '') continue;
      m.set(v, (m.get(v) || 0) + 1);
    }
    return m;
  };
  // Tokens do nome: cada empresa contribui com o CONJUNTO dos seus tokens (sem
  // repetir), então "freq" vira "em que fração das empresas essa palavra aparece".
  const contarTokens = (lista) => {
    const m = new Map();
    for (const e of lista) for (const t of tokensNome(e.fantasia, e.razao)) m.set(t, (m.get(t) || 0) + 1);
    return m;
  };
  const tokPos = contarTokens(empresas);
  const tokNeg = contarTokens(negativas);

  const negCnae = contarNeg('cnae', v => String(v || '').replace(/\D/g, ''));
  const negUf = contarNeg('uf');
  const negPorte = contarNeg('porte');
  const negCapital = contarNeg('capital');
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
    cnaes: cnae.lista.map(x => ({ c: x.chave, n: x.n, freq: +x.freq.toFixed(3), peso: peso('cnae', x.chave),
      ...(temNeg ? { ev: +evidenciaDe(x.n, negCnae.get(x.chave) || 0, amostra, negativas.length).toFixed(3), nneg: negCnae.get(x.chave) || 0 } : {}) })),
    ufs: uf.lista.map(x => ({ uf: x.chave, n: x.n, freq: +x.freq.toFixed(3), peso: peso('uf', x.chave),
      ...(temNeg ? { ev: +evidenciaDe(x.n, negUf.get(x.chave) || 0, amostra, negativas.length).toFixed(3), nneg: negUf.get(x.chave) || 0 } : {}) })),
    portes: porte.lista.map(x => ({ porte: x.chave, n: x.n, freq: +x.freq.toFixed(3),
      ...(temNeg ? { ev: +evidenciaDe(x.n, negPorte.get(x.chave) || 0, amostra, negativas.length).toFixed(3) } : {}) })),
    capitais: capital.lista.map(x => ({ faixa: x.chave, n: x.n, freq: +x.freq.toFixed(3),
      ...(temNeg ? { ev: +evidenciaDe(x.n, negCapital.get(x.chave) || 0, amostra, negativas.length).toFixed(3) } : {}) })),
    // Só entram palavras que se repetem (>=2 empresas) de um dos lados. Palavra
    // única costuma ser nome próprio da empresa ("Novoclima"), não o ramo.
    nomes: [...new Set([...tokPos.keys(), ...tokNeg.keys()])]
      .map(t => ({ t, n: tokPos.get(t) || 0, nneg: tokNeg.get(t) || 0 }))
      .filter(x => x.n >= 2 || x.nneg >= 2)
      .map(x => ({
        t: x.t, n: x.n, freq: amostra ? +(x.n / amostra).toFixed(3) : 0,
        ...(temNeg ? { ev: +evidenciaDe(x.n, x.nneg, amostra, negativas.length).toFixed(3), nneg: x.nneg } : {}),
        ...(x.n === 0 ? { so_negativo: true } : {}),
      }))
      .sort((a, b) => b.n - a.n),
    negativos: negativas.length,
    simples_prop: simplesProp != null ? +simplesProp.toFixed(3) : null,
    abertura: datas.length ? { de: datas[Math.floor(datas.length * 0.1)], ate: datas[Math.floor(datas.length * 0.9)] } : null,
  };

  // Valor que aparece SÓ entre os recusados não está na lista de compradores —
  // mas precisa entrar no perfil, senão o score não teria como penalizá-lo.
  if (temNeg) {
    const addSo = (arr, mapa, chave, campo) => {
      for (const [v, nn] of mapa) {
        if (arr.some(x => x[campo] === v)) continue;
        arr.push({ [campo]: v, n: 0, freq: 0, ev: +evidenciaDe(0, nn, amostra, negativas.length).toFixed(3), nneg: nn, so_negativo: true });
      }
    };
    addSo(perfil.cnaes, negCnae, 'c', 'c');
    addSo(perfil.ufs, negUf, 'uf', 'uf');
    addSo(perfil.portes, negPorte, 'porte', 'porte');
    addSo(perfil.capitais, negCapital, 'faixa', 'faixa');
  }

  // Pesos DESTA lista: quais dimensões realmente separam comprador de
  // não-comprador aqui. Fica gravado no perfil pra o Score 1 usar e pra a tela
  // conseguir explicar ao usuário o que definiu o perfil ideal.
  if (W) {
    const { pesos, diagnostico } = calcularPesos(perfil, base, W, opts);
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

  // As palavras que caracterizam os clientes viram PALAVRA-CHAVE na busca da
  // CNPJá (filtro por razão/fantasia). É o que faz o radar mirar "filtros" e
  // "refrigeração" em vez de varrer todo o CNAE de eletrodomésticos.
  const nomesFortes = (perfil.nomes || [])
    .filter(x => !x.so_negativo && x.freq >= 0.15 && (x.ev == null || x.ev > 0.5))
    .slice(0, 6).map(x => x.t);

  const params = {
    origem: 'lookalike',
    perfil,
    keywords: nomesFortes,
    geo_manual: !!opts.geoManual,
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
  // Item de 0 ponto que existe só pra EXPLICAR: sem ele o usuário veria a nota
  // cair depois de marcar leads como fora do perfil e não saberia o motivo.
  const avisa = (item) => breakdown.push({ item, pts: 0 });

  // Pesos DESTA lista (perfis antigos, gravados antes desta versão, não têm o
  // campo — nesse caso cai nos pesos fixos de fábrica, sem quebrar radar vivo).
  const P = perfil.pesos || {
    CNAE: W.CNAE_EXATO, CNAE_GRUPO: W.CNAE_GRUPO, UF: W.UF,
    PORTE: W.PORTE, CAPITAL: W.CAPITAL, NOME: W.NOME, SIMPLES: W.SIMPLES,
    SITUACAO_ATIVA: W.SITUACAO_ATIVA,
  };

  // Afinidade dentro da dimensão: 1 = é o valor DOMINANTE da lista; perto de
  // `PISO` = é um valor de ponta, que aparece pouco entre os compradores.
  // O piso antigo (0,65–0,7) era alto demais: comprimia a escala e fazia um
  // acerto periférico valer quase tanto quanto o núcleo da lista.
  const PISO = 0.25;
  const maxFreq = (arr) => arr.reduce((m, x) => Math.max(m, x.freq), 0) || 1;
  // freq 0 = valor que só apareceu entre os RECUSADOS (entrou no perfil apenas
  // pra o cálculo de peso enxergá-lo). Bater nele não vale ponto nenhum — antes
  // rendia o piso, então marcar um lead como ruim dava +1 a quem era igual a ele.
  const afin = (freq, mf) => (freq > 0 ? PISO + (1 - PISO) * (freq / mf) : 0);

  if (/ativa/i.test(emp.situacao || 'Ativa')) add('Situação ativa', P.SITUACAO_ATIVA);

  const raro = x => (x?.peso > 1.05) ? ' · raro no país' : '';
  // Deixa VISÍVEL no breakdown quando o ajuste veio dos leads que o usuário
  // marcou como fora do perfil — senão o score muda e ninguém sabe por quê.
  const marca = x => {
    if (x?.ev == null) return raro(x);
    if (x.ev <= 0.35) return ` · comum entre os que você recusou${x.nneg ? ` (${x.nneg})` : ''}`;
    if (x.ev >= 0.7) return ' · típico dos seus clientes' + raro(x);
    return raro(x);
  };
  const cnaeEmp = String(emp.cnae || '').replace(/\D/g, '');
  if (cnaeEmp && perfil.cnaes?.length) {
    const mf = maxFreq(perfil.cnaes);
    const exato = perfil.cnaes.find(x => x.c === cnaeEmp);
    const grupo = !exato && perfil.cnaes.find(x => x.c.slice(0, 4) === cnaeEmp.slice(0, 4));
    if (exato && exato.so_negativo) avisa(`Atividade ${cnaeEmp} — só aparece entre os que você recusou (${exato.nneg})`);
    else if (exato) add(`CNAE no perfil (${cnaeEmp})${marca(exato)}`, P.CNAE * afin(exato.freq, mf) * (exato.peso || 1) * ajusteDe(exato.ev));
    else if (grupo) add(`CNAE do mesmo grupo (${cnaeEmp})${marca(grupo)}`, P.CNAE_GRUPO * afin(grupo.freq, mf) * (grupo.peso || 1) * ajusteDe(grupo.ev));
  }

  if (emp.uf && perfil.ufs?.length) {
    const mf = maxFreq(perfil.ufs);
    const hit = perfil.ufs.find(x => x.uf === emp.uf);
    if (hit && hit.so_negativo) avisa(`Estado ${emp.uf} — só aparece entre os que você recusou (${hit.nneg})`);
    else if (hit) add(`UF ${emp.uf} (no perfil)${marca(hit)}`, P.UF * afin(hit.freq, mf) * (hit.peso || 1) * ajusteDe(hit.ev));
  }

  if (emp.porte && perfil.portes?.length) {
    const mf = maxFreq(perfil.portes);
    const pn = emp.porte.toLowerCase();
    const hit = perfil.portes.find(x => x.porte.toLowerCase() === pn || x.porte.toLowerCase().includes(pn) || pn.includes(x.porte.toLowerCase()));
    if (hit && hit.so_negativo) avisa(`Porte ${emp.porte} — só aparece entre os que você recusou (${hit.nneg})`);
    else if (hit) add(`Porte ${emp.porte} (no perfil)${marca(hit)}`, P.PORTE * afin(hit.freq, mf) * ajusteDe(hit.ev));
  }

  if (emp.capital && perfil.capitais?.length) {
    const mf = maxFreq(perfil.capitais);
    const hit = perfil.capitais.find(x => x.faixa === emp.capital);
    if (hit && hit.so_negativo) avisa(`Capital ${emp.capital} — só aparece entre os que você recusou (${hit.nneg})`);
    else if (hit) add(`Capital ${emp.capital} (no perfil)${marca(hit)}`, P.CAPITAL * afin(hit.freq, mf) * ajusteDe(hit.ev));
  }

  // NOME: a palavra do ramo. Pega a MELHOR palavra que casa (não soma várias —
  // um nome comprido não deve valer mais que um nome certeiro).
  if (perfil.nomes?.length) {
    const meus = tokensNome(emp.fantasia, emp.razao);
    let melhor = null;
    for (const t of meus) {
      const hit = perfil.nomes.find(x => x.t === t);
      if (hit && (!melhor || (hit.freq || 0) > (melhor.freq || 0))) melhor = hit;
    }
    if (melhor && melhor.so_negativo) {
      avisa(`Nome contém "${melhor.t}" — palavra dos que você recusou (${melhor.nneg})`);
    } else if (melhor) {
      const mf = perfil.nomes.reduce((m, x) => Math.max(m, x.freq || 0), 0) || 1;
      add(`Nome contém "${melhor.t}" (${Math.round((melhor.freq || 0) * 100)}% dos seus clientes)`,
        P.NOME * afin(melhor.freq, mf) * ajusteDe(melhor.ev));
    }
  }

  if (perfil.simples_prop != null && emp.opcao_simples != null) {
    const perfilSimples = perfil.simples_prop >= 0.5;
    if (perfilSimples === !!emp.opcao_simples) add(`Simples: ${emp.opcao_simples ? 'Sim' : 'Não'} (bate com o perfil)`, P.SIMPLES);
  }

  return { score: Math.min(100, score), breakdown };
}

module.exports = { MIN_PERFIL, W, parseCnpjs, construirPerfil, pontuarProximidade, poderDimensao, calcularPesos, tokensNome };
