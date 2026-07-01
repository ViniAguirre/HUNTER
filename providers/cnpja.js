'use strict';
/*
 * Hunter — adaptador CNPJá (provider de descoberta + enriquecimento, Fase 3).
 * Busca paga (cascata configurada por busca_id) e enriquecimento individual
 * (usa endpoint aberto se não houver chave; usa a paga se houver, mais limites).
 */
const axios = require('axios');

const OPEN_BASE = 'https://open.cnpja.com';
const PAID_BASE = 'https://api.cnpja.com';

async function request(url, apiKey) {
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = apiKey;
  try {
    const { data } = await axios.get(url, { headers, timeout: 15000 });
    return data;
  } catch (err) {
    if (err.response?.status === 429) {
      const e = new Error('CNPJá: limite de taxa atingido');
      e.code = 'RATE_LIMIT';
      e.retryAfter = parseInt(err.response.headers['retry-after'] || '60', 10);
      throw e;
    }
    if (err.response) {
      throw new Error(`CNPJá HTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 200)}`);
    }
    throw new Error(`CNPJá: ${err.message}`);
  }
}

// Busca por filtros (descoberta) — exige chave paga.
// Formato oficial CNPJá /office: filtros "campo.operador" e paginação por
// cursor (token). Resposta: { next, limit, count, records:[...] }.
// params: { states:['RS'], activities:[8650004], token:null, limit:20 }
async function search(params, apiKey) {
  if (!apiKey) throw new Error('CNPJá: chave obrigatória para descoberta (configure em Integrações)');
  const qs = new URLSearchParams();
  (params.states || []).forEach(s => { if (s) qs.append('address.state.in', String(s).toUpperCase()); });
  (params.activities || []).forEach(a => { const c = String(a).replace(/\D/g, ''); if (c) qs.append('mainActivity.id.in', c); });
  qs.append('status.id.in', '2'); // 2 = Ativa (só empresas ativas)
  qs.set('limit', String(Math.min(params.limit || 20, 20)));
  if (params.token) qs.set('token', params.token);

  const data = await request(`${PAID_BASE}/office?${qs.toString()}`, apiKey);
  return { offices: (data.records || []).map(normalizeOffice), next: data.next || null };
}

// Enriquecimento individual — usa endpoint aberto (grátis, rate-limited) se
// não houver chave configurada; usa a base paga (sem limite agressivo) se houver.
async function enrichCnpj(cnpj, apiKey) {
  const clean = String(cnpj).replace(/\D/g, '').padStart(14, '0');
  const base = apiKey ? PAID_BASE : OPEN_BASE;
  const data = await request(`${base}/office/${clean}`, apiKey || null);
  return parseCompany(data);
}

function normalizeOffice(o) {
  return {
    cnpj: String(o.taxId || o.cnpj || '').replace(/\D/g, '').padStart(14, '0'),
    razao: o.company?.name || o.razao || '',
    fantasia: o.alias || o.fantasia || '',
    cnae: String(o.mainActivity?.id || o.cnae || ''),
    setor: o.mainActivity?.text || o.setor || '',
    uf: o.address?.state || o.uf || '',
    cidade: o.address?.city || o.cidade || '',
    porte: normalizePorte(o.company?.size?.acronym || o.company?.size?.text || o.porte || ''),
    situacao: o.status?.text || 'Ativa',
  };
}

function parseCompany(d) {
  const cnpj = String(d.taxId || d.cnpj || '').replace(/\D/g, '').padStart(14, '0');

  const qsa = (d.company?.members || d.qsa || []).map(m => ({
    nome: m.person?.name || m.nome || '',
    qual: m.role?.text || m.qual || '',
  }));

  const decisor = qsa.find(m => /socio|administrador|diretor|presidente|ceo|coo|cfo/i.test(m.qual)) || qsa[0];

  const telefonesReceita = (d.phones || []).map(p => `(${p.area}) ${p.number}`).filter(Boolean);
  const emailsReceita = (d.emails || []).map(e => (e.address || e)).filter(Boolean);

  const capital = d.company?.equity;

  return {
    cnpj,
    razao: d.company?.name || '',
    fantasia: d.alias || '',
    cnae: String(d.mainActivity?.id || ''),
    setor: d.mainActivity?.text || '',
    porte: normalizePorte(d.company?.size?.acronym || d.company?.size?.text || ''),
    cidade: d.address?.city || '',
    uf: d.address?.state || '',
    situacao: d.status?.text || 'Ativa',
    abertura: d.founded || '',
    capital: typeof capital === 'number' ? faixaCapital(capital) : null,
    endereco: buildEndereco(d.address),
    natureza_juridica: d.company?.nature?.text || '',
    opcao_simples: d.company?.simples?.optant ?? null,
    decisor: decisor?.nome || null,
    cargo: decisor?.qual || null,
    qsa,
    contato_receita: { telefones: telefonesReceita, emails: emailsReceita },
  };
}

function normalizePorte(raw) {
  const s = String(raw).toUpperCase();
  if (s.includes('MICRO') || s === 'MEI' || s === 'ME') return 'Micro';
  if (s.includes('PEQUEN') || s === 'EPP') return 'Pequena';
  if (s.includes('MEDIO') || s.includes('MÉDIO')) return 'Média';
  if (s.includes('GRANDE') || s === 'GE') return 'Grande';
  return raw || 'Não informado';
}

function faixaCapital(v) {
  if (v < 10000) return '< R$ 10 mil';
  if (v < 100000) return 'R$ 10–100 mil';
  if (v < 500000) return 'R$ 100–500 mil';
  if (v < 1000000) return 'R$ 500 mil–1 mi';
  if (v < 5000000) return 'R$ 1–5 mi';
  if (v < 20000000) return 'R$ 5–20 mi';
  return '> R$ 20 mi';
}

function buildEndereco(a) {
  if (!a) return null;
  return [a.street, a.number, a.district, a.city, a.state, a.zip].filter(Boolean).join(', ');
}

module.exports = { search, enrichCnpj, normalizePorte };
