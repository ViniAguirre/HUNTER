'use strict';
/*
 * Hunter — provider nativo do CRM GK SaaS (Whaticket/Ticketz).
 * Fluxo: conexão (backend + token bearer) → lista empresas/filas → ao enviar
 * um lead, faz upsert do contato e abre um ticket na fila escolhida em status
 * "pending" (Aguardando).
 *
 * Endpoints confirmados pela doc:
 *   GET  /companies/all              → [{id, name}]
 *   GET  /api/company/queues         → [{id, queue}]
 *   POST /api/tickets/createTicketAPI → cria ticket {contactId, queueId, status}
 * Endpoint de contato NÃO veio na doc — usando o padrão abaixo (ajustável):
 */
const axios = require('axios');

const EP_CONTATO = '/api/contacts'; // TODO: confirmar com a doc/CRM (palpite pelo padrão Whaticket)

function client(backend, token) {
  return axios.create({
    baseURL: String(backend || '').replace(/\/+$/, ''),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
}

// Traduz erros de rede/HTTP em mensagens claras — incluindo a resposta real da
// API do GK, pra diagnóstico (a doc pede erros claros ao usuário).
function traduzErro(err, contexto) {
  if (err.code === 'ECONNABORTED') return new Error(`${contexto}: timeout da API do CRM`);
  if (err.response) {
    const s = err.response.status;
    const d = err.response.data;
    const corpo = (typeof d === 'string' ? d : JSON.stringify(d || {})).slice(0, 200);
    if (s === 401 || s === 403) return new Error(`${contexto}: token inválido/sem permissão [HTTP ${s}] ${corpo}`);
    if (s === 404) return new Error(`${contexto}: rota não encontrada [HTTP 404] ${corpo} — confira o Backend`);
    return new Error(`${contexto} [HTTP ${s}] ${corpo}`);
  }
  return new Error(`${contexto}: backend indisponível (${err.message})`);
}

async function listarEmpresas(backend, token) {
  // A doc lista /companies/all (sem /api), mas os outros endpoints usam /api.
  // Tentamos o documentado e, se der 404, o /api/companies/all como alternativa.
  const c = client(backend, token);
  try {
    const { data } = await c.get('/companies/all');
    return (data || []).map(x => ({ id: x.id, name: x.name }));
  } catch (err) {
    if (err.response?.status === 404) {
      try {
        const { data } = await c.get('/api/companies/all');
        return (data || []).map(x => ({ id: x.id, name: x.name }));
      } catch (err2) { throw traduzErro(err2, 'Buscar empresas'); }
    }
    throw traduzErro(err, 'Buscar empresas');
  }
}

async function listarFilas(backend, token) {
  try {
    const { data } = await client(backend, token).get('/api/company/queues');
    // A resposta real traz o nome em `name` (a doc dizia `queue`).
    return (data || []).map(q => ({ id: q.id, queue: q.name || q.queue || `Fila ${q.id}` }));
  } catch (err) { throw traduzErro(err, 'Buscar filas'); }
}

// Cria/atualiza o contato e devolve o contactId.
async function upsertContato(backend, token, contato) {
  try {
    const { data } = await client(backend, token).post(EP_CONTATO, contato);
    const id = data?.contactId ?? data?.id ?? data?.contact?.id;
    if (!id) throw new Error('resposta sem contactId');
    return id;
  } catch (err) {
    if (err.message === 'resposta sem contactId') throw new Error('Contato: resposta do CRM sem contactId');
    throw traduzErro(err, 'Criar/atualizar contato');
  }
}

async function abrirTicket(backend, token, { contactId, queueId, status }) {
  try {
    const { data } = await client(backend, token).post('/api/tickets/createTicketAPI', {
      contactId, queueId, status: status || 'pending',
    });
    return data;
  } catch (err) { throw traduzErro(err, 'Abrir ticket'); }
}

// Monta o payload de contato a partir da empresa + lead do Hunter.
// number precisa ser dígitos (5511999999999). Sem telefone válido, o contato
// não pode ser criado — quem chama trata isso.
function montarContato(empresa, lead, extras = {}) {
  const e = empresa || {};
  const tel = (extras.telefone || '').replace(/\D/g, '');
  const extraInfo = [
    { name: 'Origem', value: 'Hunter' },
    { name: 'Empresa', value: e.razao || e.fantasia || '' },
    { name: 'CNAE', value: e.setor || '' },
    { name: 'Score do Lead', value: lead?.score != null ? String(lead.score) : '' },
    { name: 'Capturado em', value: new Date().toISOString() },
  ].filter(x => x.value);
  return {
    name: e.decisor || e.fantasia || e.razao || 'Contato',
    number: tel,
    email: extras.email || '',
    cpfcnpj: e.cnpj || '',
    estado: e.uf || '',
    cidade: e.cidade || '',
    referencia: 'Hunter Automático',
    endereco: e.endereco || '',
    carteiraId: '',
    extraInfo,
  };
}

module.exports = { listarEmpresas, listarFilas, upsertContato, abrirTicket, montarContato, EP_CONTATO };
