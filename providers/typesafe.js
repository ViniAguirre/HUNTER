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

// Monta UMA chamada para todos os candidatos lidos de um lead: duas perguntas
// por candidato (tipo da página e "pertence à empresa?"), todas em paralelo no
// Jev, com a página dentro das instructions e a empresa no state.
function perguntasSite(candidatos) {
  const q = {};
  candidatos.forEach((c, i) => {
    const pagina = {
      url: c.site,
      search_title: corta(c.titulo, 200),
      identity: corta(c.identidade, 300),
      summary: corta(c.resumo),
      phone_on_page: c.telefone || null,
      cnpj_on_page: c.cnpj || null,
      phone_count_on_home: c.qtd_telefones || 0,
    };
    q[`tipo_${i}`] = {
      type: 'choice',
      instructions: { page: pagina, question: 'What is `page` in relation to the company in `company`?' },
      criteria: TIPOS_PAGINA,
    };
    q[`pertence_${i}`] = {
      type: 'noul',
      instructions: { page: pagina, question: 'Is `page` the official website of the company described in `company`?' },
      criteria: {
        true: 'The page is run by this exact business: same company, same city or region',
        false: 'The page belongs to someone else, lists many companies, or only mentions this company',
      },
    };
  });
  return q;
}

// Opinião do Jev sobre os candidatos a site de UMA empresa. Devolve uma linha
// por candidato, na mesma ordem: { tipo, confianca, probabilidades, pertence }.
async function avaliarSites(apiKey, empresa, candidatos, opts = {}) {
  const state = {
    company: {
      name: empresa.nome || null,
      legal_name: empresa.razao || null,
      trade_name: empresa.fantasia || null,
      city: empresa.cidade || null,
      state: empresa.uf || null,
      activity: empresa.setor || null,
      cnpj: empresa.cnpj || null,
    },
  };
  const t0 = Date.now();
  const data = await systemOne(apiKey, state, perguntasSite(candidatos), opts);
  const a = data.answers || {};
  return {
    modelo: data.model || null,
    latencia_ms: Date.now() - t0,
    tokens: data.usage?.input_tokens ?? null,
    candidatos: candidatos.map((_, i) => ({
      tipo: a[`tipo_${i}`]?.choice ?? null,
      confianca: a[`tipo_${i}`]?.confidence ?? null,
      probabilidades: a[`tipo_${i}`]?.probabilities ?? null,
      pertence: a[`pertence_${i}`]?.noul ?? null,
    })),
  };
}

// ── Nota de segurança da lista de semelhantes ────────────────────────────────
// Cada empresa da lista é julgada contra o cliente ideal (texto da proposta de
// valor) numa escala de 4 níveis. A nota da lista é calculada no CÓDIGO a partir
// dessas respostas, para ser explicável: aderência média, quem puxa o perfil
// para fora e o tamanho da lista.
const NIVEIS_ADERENCIA = [
  { what: 'Unrelated: sells or does something the ideal customer description does not cover',
    examples: ['A law firm in a list meant for auto repair shops'] },
  { what: 'Loosely related: same broad sector, but a different kind of business from the ideal customer',
    examples: ['A car dealership in a list meant for tire and brake repair shops'] },
  { what: 'Related: a similar kind of business, with some differences in what it sells, its size or how it operates' },
  { what: 'Strong match: exactly the kind of business the ideal customer description targets' },
];
const LOTE_LISTA = 25;   // empresas por chamada ao Jev

function empresaParaJev(e) {
  return {
    legal_name: e.razao || null,
    trade_name: e.fantasia || null,
    activity: e.setor || null,
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
  const out = [];
  let modelo = null, tokens = 0;
  for (let i = 0; i < empresas.length; i += LOTE_LISTA) {
    const lote = empresas.slice(i, i + LOTE_LISTA);
    const questions = {};
    lote.forEach((e, j) => {
      questions[`fit_${j}`] = {
        type: 'score',
        instructions: {
          company: empresaParaJev(e),
          question: 'How well does `company` match the ideal customer described in `ideal_customer`?',
        },
        criteria: NIVEIS_ADERENCIA,
      };
    });
    const data = await systemOne(apiKey, { ideal_customer: corta(icpTexto, 2000) }, questions, opts);
    modelo = data.model || modelo;
    tokens += data.usage?.input_tokens || 0;
    lote.forEach((e, j) => {
      const a = data.answers?.[`fit_${j}`] || {};
      const nivel = typeof a.score === 'number' ? a.score : null;
      out.push({
        cnpj: e.cnpj,
        nome: e.fantasia || e.razao || e.cnpj,
        nivel,
        norm: nivel == null ? null : nivel / (NIVEIS_ADERENCIA.length - 1),
        confianca: a.confidence ?? null,
        probabilidades: a.probabilities || null,
      });
    });
  }
  return { modelo, tokens, itens: out };
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
  avaliarAderencia, avaliarEmpresa, notaDaLista, resumoSite, NIVEIS_ADERENCIA };
