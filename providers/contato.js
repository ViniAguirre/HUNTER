'use strict';
/*
 * Hunter — validação/enriquecimento de contato do decisor (Fase de validação).
 * Adaptador Econodata: match por CNPJ (que já temos) devolve os contatos dos
 * decisores. É o contato REAL do decisor — diferente do da Receita, que é do
 * contador. Só esse contato validado é repassado ao closer/CRM.
 *
 * Endpoint/backend/campos são ajustáveis (como fizemos com o GK), pra afinar
 * conforme a resposta real da conta.
 */
const axios = require('axios');

const BACKEND_PADRAO = 'https://api.econodata.com.br';

// Procura telefones/e-mails em várias formas possíveis do JSON (defensivo).
function coletar(obj, chavesArray, campo) {
  const out = [];
  const push = v => { if (v && !out.includes(v)) out.push(String(v)); };
  const varrer = node => {
    if (!node || typeof node !== 'object') return;
    for (const k of chavesArray) {
      const arr = node[k];
      if (Array.isArray(arr)) arr.forEach(x => push(typeof x === 'string' ? x : (x?.[campo] || x?.numero || x?.value)));
    }
  };
  varrer(obj);
  (obj?.socios || obj?.decisores || obj?.contatos || []).forEach(varrer);
  return out;
}

async function enriquecerContato(cnpj, { apiKey, backend } = {}) {
  if (!apiKey) throw new Error('Econodata: chave obrigatória (configure em Integrações).');
  const clean = String(cnpj).replace(/\D/g, '');
  const base = String(backend || BACKEND_PADRAO).replace(/\/+$/, '');
  try {
    const { data } = await axios.get(`${base}/enriquecer/cnpj/${clean}`, {
      headers: { 'x-api-token': apiKey, Accept: 'application/json' },
      timeout: 20000,
    });
    const telefones = coletar(data, ['telefones', 'phones', 'telefone'], 'numero');
    const emails = coletar(data, ['emails', 'email'], 'email');
    const decisor = data?.decisores?.[0]?.nome || data?.socios?.[0]?.nome || null;
    return {
      telefone: telefones[0] || null,
      email: emails[0] || null,
      telefones, emails,
      decisor_nome: decisor,
      fonte: 'econodata',
      validado: !!(telefones[0] || emails[0]),
      validado_em: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const s = err.response.status;
      if (s === 401 || s === 403) throw new Error('Econodata: token inválido ou sem permissão');
      if (s === 404) throw new Error('Econodata: CNPJ sem contato na base (404)');
      if (s === 429) { const e = new Error('Econodata: limite de taxa'); e.code = 'RATE_LIMIT'; throw e; }
      throw new Error(`Econodata HTTP ${s}: ${JSON.stringify(err.response.data).slice(0, 160)}`);
    }
    throw new Error(`Econodata: ${err.message}`);
  }
}

module.exports = { enriquecerContato, BACKEND_PADRAO };
