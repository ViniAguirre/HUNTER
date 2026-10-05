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

// Integração ativa do tenant (RLS já filtra pelo tenant da conexão).
async function integracao(pool) {
  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada, config FROM integracoes
     WHERE categoria='decisao' AND provedor='typesafe' AND ativo=true
       AND key_cifrada IS NOT NULL AND key_cifrada <> '' LIMIT 1`
  );
  return ig ? { apiKey: ig.key_cifrada, modelo: ig.config?.modelo || null } : null;
}

module.exports = { systemOne, avaliarSites, perguntasSite, integracao, TIPOS_PAGINA, MODELO_PADRAO };
