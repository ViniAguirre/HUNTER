'use strict';
/*
 * Hunter — TypeSafe Jev (decisões tipadas, sem geração de texto).
 * https://docs.typesafe.ai — o Jev recebe um estado e perguntas fechadas
 * (choice / score / noul) e devolve a resposta com probabilidade e confiança.
 *
 * Primeiro uso: "este site é mesmo DESTA empresa?", hoje decidido pelas
 * heurísticas de providers/google.js (tokens no domínio, frases de diretório,
 * DDD×UF). Começa em MODO OBSERVAÇÃO: o Jev opina ao lado das regras, a opinião
 * é gravada em `decisoes_jev` e nada muda no lead. Só liga para o cliente que
 * ativar a integração "decisao|typesafe" com a própria chave.
 *
 * Perguntas e opções em inglês (idioma principal do Jev); o conteúdo do site
 * segue em português. O decisor (dado pessoal) nunca é enviado.
 */
const axios = require('axios');

const URL = 'https://api.typesafe.ai/v1/systemone';
const MODELO_PADRAO = 'jev-latest';
const MAX_TEXTO = 600;

const corta = (s, n = MAX_TEXTO) => (s ? String(s).replace(/\s+/g, ' ').trim().slice(0, n) : null);

async function systemOne(apiKey, state, questions, { modelo, timeout = 15000 } = {}) {
  if (!apiKey) throw new Error('TypeSafe: chave obrigatória (Integrações → Decisões).');
  try {
    const { data } = await axios.post(URL, { model: modelo || MODELO_PADRAO, state, questions }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout,
    });
    return data;
  } catch (err) {
    if (err.response) {
      const msg = err.response.data?.error?.message || err.response.data?.detail
        || JSON.stringify(err.response.data).slice(0, 200);
      const e = new Error(`TypeSafe HTTP ${err.response.status}: ${msg}`);
      e.status = err.response.status;
      throw e;
    }
    throw new Error(`TypeSafe: ${err.message}`);
  }
}

// Tipos de página que um resultado de busca pode ser em relação à empresa.
const TIPOS_PAGINA = {
  site_proprio: {
    what: "The company's own official website",
    examples: ['Home page of the business itself, presenting its products or services'],
  },
  outra_empresa: {
    what: 'Website of a different business, even with a similar name, same industry or another city',
    examples: ['A law firm site for a company named Paiva e Paiva that is not a law firm',
      'A software company site for a local refrigeration business with the same word in its name'],
  },
  diretorio: {
    what: 'Directory, business listing, CNPJ lookup, guide or aggregator that lists many companies',
    examples: ['Guia de empresas', 'Consulta CNPJ', 'Lista telefônica'],
  },
  marketplace_ou_rede: { what: 'Marketplace listing, social network profile or platform page, not a standalone website' },
  orgao_publico: { what: 'Government, association or institutional page' },
  outro: { what: 'None of the above' },
};

// Página de um candidato, no formato que vai para o state.
function paginaParaJev(c) {
  return {
    url: c.site,
    search_title: corta(c.titulo, 200),
    identity: corta(c.identidade, 300),
    summary: corta(c.resumo),
    phone_on_page: c.telefone || null,
    cnpj_on_page: c.cnpj || null,
    phone_count_on_home: c.qtd_telefones || 0,
  };
}

// Duas perguntas por candidato: tipo da página e "pertence à empresa?". Empresa
// E página vão no state (o Jev julga contra o state; com a página nas
// instructions ele não a enxergava como conteúdo a avaliar).
function perguntasSite() {
  return {
    tipo: {
      type: 'choice',
      instructions: 'What is `page` in relation to the company in `company`?',
      criteria: TIPOS_PAGINA,
    },
    pertence: {
      type: 'noul',
      instructions: 'Is `page` the official website of the company described in `company`?',
      criteria: {
        true: 'The page is run by this exact business: same company, same city or region',
        false: 'The page belongs to someone else, lists many companies, or only mentions this company',
      },
    },
  };
}

// Opinião do Jev sobre os candidatos a site de UMA empresa: uma chamada por
// candidato, em paralelo. Devolve uma linha por candidato, na mesma ordem:
// { tipo, confianca, probabilidades, pertence }.
async function avaliarSites(apiKey, empresa, candidatos, opts = {}) {
  const company = {
    name: empresa.nome || null,
    legal_name: empresa.razao || null,
    trade_name: empresa.fantasia || null,
    city: empresa.cidade || null,
    state: empresa.uf || null,
    activity: empresa.setor || null,
    cnpj: empresa.cnpj || null,
  };
  const t0 = Date.now();
  let modelo = null, tokens = 0;
  const respostas = await Promise.all(candidatos.map(c =>
    systemOne(apiKey, { company, page: paginaParaJev(c) }, perguntasSite(), opts)
      .then(data => { modelo = data.model || modelo; tokens += data.usage?.input_tokens || 0; return data.answers || {}; })));
  return {
    modelo,
    latencia_ms: Date.now() - t0,
    tokens,
    candidatos: respostas.map(a => ({
      tipo: a.tipo?.choice ?? null,
      confianca: a.tipo?.confidence ?? null,
      probabilidades: a.tipo?.probabilities ?? null,
      pertence: a.pertence?.noul ?? null,
    })),
  };
}

// ── Nota de segurança da lista de semelhantes ────────────────────────────────
// Cada empresa da lista é julgada como COMPRADORA da oferta (texto da proposta
// de valor) numa escala de 4 níveis. A nota da lista é calculada no CÓDIGO a partir
// dessas respostas, para ser explicável: aderência média, quem puxa o perfil
// para fora e o tamanho da lista.
const NIVEIS_ADERENCIA = [
  { what: 'Unlikely buyer: the business has no plausible use or need for the offer',
    examples: ['A one-person online consultancy for an offer of industrial forklifts'] },
  { what: 'Possible buyer: could use the offer, but it is not a typical customer for it' },
  { what: 'Likely buyer: a typical customer that commonly needs this kind of offer' },
  { what: 'Ideal buyer: exactly the kind of business the offer is built for',
    examples: ['A restaurant for an offer of commercial kitchen equipment'] },
];
// Lista de semelhantes: as empresas JÁ COMPRARAM (é regra da lista). A pergunta
// não é "compraria?" (já comprou), é "é um bom MODELO?": achar mais empresas
// parecidas com ela traria mais compradores? Uma livraria que comprou
// purificador de uma fabricante é cliente de verdade, mas como modelo leva o
// radar a procurar livrarias.
const NIVEIS_REPRESENTATIVO = [
  { what: 'Atypical customer: bought, but its business is unrelated to the ideal customer profile; businesses similar to it are unlikely to buy',
    examples: ['A bookstore that bought from a manufacturer whose ideal customers are specialized resellers'] },
  { what: 'Occasional customer: related to the profile only at the edges; businesses similar to it buy only sometimes' },
  { what: 'Representative customer: a typical kind of business for this seller; similar businesses often buy' },
  { what: 'Core customer: exactly the ideal customer profile; similar businesses are the best prospects' },
];
const LOTE_LISTA = 8;    // chamadas ao Jev em paralelo (uma por empresa)

function empresaParaJev(e) {
  return {
    legal_name: e.razao || null,
    trade_name: e.fantasia || null,
    activity: e.setor || null,
    // O nome costuma dizer o negócio real melhor que o código da Receita:
    // "HDR PURIFICADORES DE AGUA" registrada como loja de eletrodomésticos.
    note: 'The official activity code is often generic or outdated; the legal and trade names may reveal the real business better.',
    cnae: e.cnae || null,
    size: e.porte || null,
    capital_range: e.capital || null,
    city: e.cidade || null,
    state: e.uf || null,
    founded: e.abertura || null,
    website_summary: corta(e.resumo_site, 400),
  };
}

// Devolve, na ordem das empresas: { cnpj, nivel (0..3 fracionário), norm (0..1),
// confianca, probabilidades }. Lança erro se o Jev falhar (o job registra).
async function avaliarAderencia(apiKey, icpTexto, empresas, opts = {}) {
  // A EMPRESA vai no state, não nas instructions: o Jev julga cada nível
  // "contra o state" (docs.typesafe.ai/primitives/score). Com a empresa nas
  // instructions e só a oferta no state, ele avaliava a própria oferta e dava
  // "comprador improvável" para quase todas (Planeta Água: nota 19, 109 de 119
  // suspeitas). Como o state é um só por chamada, vai uma empresa por chamada,
  // LOTE_LISTA em paralelo.
  // opts.modo 'cliente': empresas da lista de semelhantes (já compraram) —
  // julga se é um bom modelo. Padrão: prospect (Score 1) — julga se compraria.
  const cliente = opts.modo === 'cliente';
  const contexto = {
    // A proposta de valor descreve o que o CLIENTE DO HUNTER vende, não quem
    // compra: a empresa é julgada como compradora, não como parecida.
    offer: { seller_value_proposition: corta(icpTexto, 2000),
      note: cliente
        ? 'What the seller sells. `company` is a CONFIRMED customer that already bought from this seller.'
        : 'What the seller sells; it may mention who it targets. Judge `company` as a potential BUYER, not as a competitor or a similar seller.' },
    // Fichamento comercial (tela Agente SWOT): o próprio vendedor dizendo quem
    // compra, que dor resolve e o que desqualifica. Pesa mais que a oferta.
    ...(opts.perfil ? { buyer_profile: { ...opts.perfil,
      note: "The seller's own description of its buyers. Use it as the main reference: a company that matches a disqualifier is an unlikely buyer." } } : {}),
  };
  const questions = {
    fit: {
      type: 'score',
      instructions: cliente
        ? 'This confirmed customer in `company` will be used as a model to find more prospects. How well does it represent the ideal customer of the seller in `offer`?'
        : 'How likely is the business in `company` to buy what the seller offers in `offer`?',
      criteria: cliente ? NIVEIS_REPRESENTATIVO : NIVEIS_ADERENCIA,
    },
  };
  const out = new Array(empresas.length);
  let modelo = null, tokens = 0, falhas = 0, primeiroErro = null;
  for (let i = 0; i < empresas.length; i += LOTE_LISTA) {
    await Promise.all(empresas.slice(i, i + LOTE_LISTA).map(async (e, k) => {
      let a = {};
      try {
        const data = await systemOne(apiKey, { company: empresaParaJev(e), ...contexto }, questions, opts);
        modelo = data.model || modelo;
        tokens += data.usage?.input_tokens || 0;
        a = data.answers?.fit || {};
      } catch (err) { falhas++; primeiroErro = primeiroErro || err; }
      const nivel = typeof a.score === 'number' ? a.score : null;
      out[i + k] = {
        cnpj: e.cnpj,
        nome: e.fantasia || e.razao || e.cnpj,
        nivel,
        norm: nivel == null ? null : nivel / (NIVEIS_ADERENCIA.length - 1),
        confianca: a.confidence ?? null,
        probabilidades: a.probabilities || null,
      };
    }));
  }
  // Falha isolada vira "sem nota" para aquela empresa; tudo falhando é erro.
  if (falhas === empresas.length && primeiroErro) throw primeiroErro;
  return { modelo, tokens, falhas, itens: out };
}

// Nota 0–100 da lista, com os componentes à mostra.
//  - aderência: média do quanto cada empresa bate com o cliente ideal;
//  - suspeitas: empresas abaixo de "Related" (norm < 0,5), que puxam o perfil
//    médio para fora do cliente ideal — cada uma piora todo radar da lista;
//  - tamanho: lista curta tem perfil frágil (mesma régua de `confiancaDe`).
function notaDaLista(itens) {
  const validos = itens.filter(x => x.norm != null);
  if (!validos.length) return null;
  const aderencia = validos.reduce((s, x) => s + x.norm, 0) / validos.length;
  const suspeitas = validos.filter(x => x.norm < 0.5).sort((a, b) => a.norm - b.norm);
  const n = validos.length;
  const fatorTamanho = n < 6 ? 0.8 : n < 15 ? 0.9 : 1;
  const nota = Math.round(aderencia * 100 * fatorTamanho);
  return {
    nota,
    faixa: nota >= 75 ? 'segura' : nota >= 55 ? 'atencao' : 'arriscada',
    aderencia_media: Math.round(aderencia * 100),
    avaliadas: n,
    suspeitas: suspeitas.length,
    fator_tamanho: fatorTamanho,
    // Quanto a nota subiria tirando as suspeitas: ajuda a decidir se vale limpar.
    nota_sem_suspeitas: suspeitas.length && suspeitas.length < n
      ? Math.round(validos.filter(x => x.norm >= 0.5).reduce((s, x) => s + x.norm, 0) / (n - suspeitas.length) * 100
        * ((n - suspeitas.length) < 6 ? 0.8 : (n - suspeitas.length) < 15 ? 0.9 : 1))
      : null,
  };
}

// Aderência de UMA empresa ao cliente ideal (Score 1 em modo observação).
async function avaliarEmpresa(apiKey, icpTexto, empresa, opts = {}) {
  const t0 = Date.now();
  const r = await avaliarAderencia(apiKey, icpTexto, [empresa], opts);
  return { ...r.itens[0], modelo: r.modelo, latencia_ms: Date.now() - t0 };
}

// Resumo do site guardado no cadastro: contatos_verificados é objeto (descoberta
// web-first) ou lista (validação).
function resumoSite(cv) {
  if (!cv) return null;
  if (Array.isArray(cv)) return cv.find(c => c && c.resumo_site)?.resumo_site || null;
  return cv.resumo_site || null;
}

// Quem compra, segundo o fichamento comercial do tenant (config.swot_perfil).
// null quando nenhum dos três campos foi preenchido.
async function perfilComprador(pool) {
  const { rows: [c] } = await pool.query(`SELECT swot_perfil FROM config LIMIT 1`).catch(() => ({ rows: [] }));
  const f = c?.swot_perfil || {};
  const perfil = {
    ideal_customer: corta(f.icp, 1200),
    pains_solved: corta(f.dores, 800),
    disqualifiers: corta(f.desqualificadores, 800),
  };
  for (const k of Object.keys(perfil)) if (!perfil[k]) delete perfil[k];
  return Object.keys(perfil).length ? perfil : null;
}

// Integração ativa do tenant (RLS já filtra pelo tenant da conexão).
async function integracao(pool) {
  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada, config FROM integracoes
     WHERE categoria='decisao' AND provedor='typesafe' AND ativo=true
       AND key_cifrada IS NOT NULL AND key_cifrada <> '' LIMIT 1`
  );
  return ig ? { apiKey: ig.key_cifrada, modelo: ig.config?.modelo || null } : null;
}

module.exports = { systemOne, avaliarSites, perguntasSite, integracao, TIPOS_PAGINA, MODELO_PADRAO,
  avaliarAderencia, avaliarEmpresa, notaDaLista, resumoSite, perfilComprador, NIVEIS_ADERENCIA, NIVEIS_REPRESENTATIVO };
