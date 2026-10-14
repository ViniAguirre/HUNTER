'use strict';
/*
 * Hunter — CRM dos Afiliados (Antídoto). Nativo: em vez de um webhook genérico,
 * fala direto com a API do sistema de afiliados, que tem o funil (kanban) de
 * cada afiliado.
 *
 * Cada radar que vai pra cá escolhe o alvo: um GRUPO (nicho) — o sistema de
 * afiliados entrega o lead ao afiliado do grupo que está há mais tempo sem
 * receber — ou um AFILIADO específico. O lead cai na coluna "Novo lead" dele.
 *
 * A chave é gerada no sistema de afiliados (Admin → Integrações) e vai no
 * header Authorization. Reenviar o mesmo hunter_ref não duplica: a API devolve
 * o lead que já existe.
 */
const axios = require('axios');
const webhook = require('./webhook');

// https sempre; http só pra rodar local (localhost / 127.0.0.1).
function normalizarUrl(url) {
  const s = String(url || '').trim().replace(/\/+$/, '');
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch (_) { return null; }
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null;
  return u.origin + u.pathname.replace(/\/+$/, '');
}

function chaveValida(key) {
  return /^afh_[A-Za-z0-9_-]{20,}$/.test(String(key || '').trim());
}

function erroDe(err) {
  if (err.response) {
    const d = err.response.data || {};
    const e = new Error(`Afiliados HTTP ${err.response.status}: ${d.message || JSON.stringify(d).slice(0, 160)}`);
    e.status = err.response.status;
    e.code = d.code || null;
    return e;
  }
  return new Error(`Afiliados: ${err.message}`);
}

function cliente(url, key) {
  return axios.create({
    baseURL: url,
    timeout: 15000,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'Hunter/3' },
  });
}

// Grupos (nichos) com quantos afiliados ativos têm, e os afiliados ativos.
async function diretorio(url, key) {
  try {
    const { data } = await cliente(url, key).get('/api/integrations/hunter/directory');
    return {
      grupos: (data.groups || []).map(g => ({ id: g.id, nome: g.name, afiliados: g.affiliates || 0 })),
      afiliados: (data.affiliates || []).map(a => ({ id: a.id, nome: a.name, ref: a.ref_code, grupos: a.groups || [] })),
    };
  } catch (err) { throw erroDe(err); }
}

// Payload completo do lead — o mesmo do webhook, sem a conexão do CRM GK (o
// token de lá não é da conta do sistema de afiliados), mais os motivos do score.
function montarPayload(empresa, lead, busca, ref) {
  const p = webhook.montarPayload(empresa, lead, busca, ref, null);
  delete p.crm;
  p.origem = 'hunter';
  p.motivos_score = Array.isArray(lead?.breakdown) ? lead.breakdown : [];
  return p;
}

// alvo: { tipo: 'grupo'|'afiliado', id, nome }
async function enviarLead(url, key, alvo, payload) {
  const target = { kind: alvo.tipo === 'afiliado' ? 'affiliate' : 'group', id: alvo.id };
  try {
    const { data, status } = await cliente(url, key).post('/api/integrations/hunter/leads', { target, lead: payload });
    return { status, leadId: data.lead_id, duplicado: !!data.duplicate, afiliado: data.affiliate || null };
  } catch (err) { throw erroDe(err); }
}

// Alvo do radar validado (o que vem da tela). Nulo = inválido.
function normalizarAlvo(v) {
  if (!v || typeof v !== 'object') return null;
  const tipo = v.tipo === 'afiliado' ? 'afiliado' : v.tipo === 'grupo' ? 'grupo' : null;
  const id = String(v.id || '').trim().toLowerCase();
  if (!tipo || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null;
  return { tipo, id, nome: String(v.nome || '').trim().slice(0, 120) || null };
}

module.exports = { normalizarUrl, chaveValida, diretorio, montarPayload, enviarLead, normalizarAlvo };
