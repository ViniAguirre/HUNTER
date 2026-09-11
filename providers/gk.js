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

// A rota de contato nunca veio na doc do GK. No Whaticket de origem ela é
// montada como "/contacts"; nesta instalação as outras rotas vivem sob "/api",
// então tentamos a de "/api" primeiro e caímos na outra se der 404 — o mesmo
// que já era preciso fazer em listarEmpresas.
const EP_CONTATO = '/api/contacts';
const EP_CONTATO_ALT = '/contacts';

// O GK não usa o mesmo esquema de Authorization em todas as rotas: as de
// empresa/fila aceitam "Bearer <token>", mas a de contato compara o header
// INTEIRO com o token da empresa — com o prefixo, a comparação falha e ela
// responde "Expired Session - New token generated!". O n8n que já entrega
// contatos hoje manda o token CRU, sem prefixo; é daí que vem o 'raw'.
function client(backend, token, esquema = 'bearer') {
  return axios.create({
    baseURL: String(backend || '').replace(/\/+$/, ''),
    headers: {
      Authorization: esquema === 'raw' ? String(token || '') : `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

// Executa a chamada tentando os dois formatos de Authorization, na ordem dada.
// Só re-tenta em 401/403: nesses a chamada comprovadamente não teve efeito,
// então repetir um POST não corre risco de criar o registro duas vezes.
async function comAuth(backend, token, fn, ordem = ['raw', 'bearer']) {
  let ultimoErro;
  for (const esquema of ordem) {
    try {
      return await fn(client(backend, token, esquema), esquema);
    } catch (err) {
      const s = err.response?.status;
      if (s === 401 || s === 403) { ultimoErro = err; continue; }
      throw err;
    }
  }
  throw ultimoErro;
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
  // Endpoint confirmado no CRM real: /api/companies/all (a doc dizia
  // /companies/all, que responde 401). Tentamos o confirmado primeiro.
  // Bearer primeiro aqui: é o esquema que já funciona nesta rota.
  const puxar = (rota) => comAuth(backend, token, (c) => c.get(rota), ['bearer', 'raw']);
  try {
    const { data } = await puxar('/api/companies/all');
    return (data || []).map(x => ({ id: x.id, name: x.name }));
  } catch (err) {
    try {
      const { data } = await puxar('/companies/all');
      return (data || []).map(x => ({ id: x.id, name: x.name }));
    } catch (_) {
      throw traduzErro(err, 'Buscar empresas');
    }
  }
}

async function listarFilas(backend, token) {
  try {
    const { data } = await comAuth(backend, token, (c) => c.get('/api/company/queues'), ['bearer', 'raw']);
    // A resposta real traz o nome em `name` (a doc dizia `queue`).
    return (data || []).map(q => ({ id: q.id, queue: q.name || q.queue || `Fila ${q.id}` }));
  } catch (err) { throw traduzErro(err, 'Buscar filas'); }
}

// Onde o id do contato pode aparecer. Cada fork do Whaticket embrulha a
// resposta de um jeito; alguns devolvem lista.
function extrairContactId(data) {
  const alvo = Array.isArray(data) ? data[0] : data;
  if (!alvo || typeof alvo !== 'object') return null;
  return alvo.contactId ?? alvo.id ?? alvo.contact?.id ?? alvo.data?.id ?? null;
}

function amostraCorpo(data) {
  const txt = typeof data === 'string' ? data : JSON.stringify(data ?? null);
  return (txt || '').slice(0, 200);
}

// Cria/atualiza o contato e devolve o contactId. Token CRU primeiro: é o que o
// n8n usa nesta mesma rota e comprovadamente funciona.
async function upsertContato(backend, token, contato) {
  const rotas = [EP_CONTATO, EP_CONTATO_ALT];
  for (let i = 0; i < rotas.length; i++) {
    const rota = rotas[i];
    let resp;
    try {
      resp = await comAuth(backend, token, (c) => c.post(rota, contato), ['raw', 'bearer']);
    } catch (err) {
      // 404 = rota inexistente nesta instalação: tenta a alternativa. Qualquer
      // outro erro é real e precisa chegar ao usuário como veio.
      if (err.response?.status === 404 && i < rotas.length - 1) continue;
      throw traduzErro(err, `Criar/atualizar contato (${rota})`);
    }
    const id = extrairContactId(resp.data);
    if (id) return id;
    // Respondeu 2xx mas sem id. NÃO tenta a outra rota: se esta criou o contato,
    // repetir o POST duplicaria. A mensagem carrega status e corpo porque, sem
    // eles, "resposta do CRM sem contactId" não dizia nada sobre a causa.
    throw new Error(
      `Contato: o CRM respondeu sem contactId em ${rota} [HTTP ${resp.status}] ${amostraCorpo(resp.data)}`
    );
  }
}

// Confere se a rota de contato existe e aceita o token, SEM criar nada: no
// Whaticket o GET da mesma rota é a listagem. Serve pra separar "rota errada"
// de "o token não vale pra essa rota" — o teste de conexão só olhava filas e
// empresas, então dava verde mesmo com o envio quebrado.
async function checarRotaContato(backend, token) {
  const rotas = [EP_CONTATO, EP_CONTATO_ALT];
  for (let i = 0; i < rotas.length; i++) {
    const rota = rotas[i];
    try {
      await comAuth(backend, token, (c) => c.get(rota), ['raw', 'bearer']);
      return { ok: true, rota };
    } catch (err) {
      const s = err.response?.status;
      if (s === 404 && i < rotas.length - 1) continue;
      if (s === 405) return { ok: true, rota };   // existe, só não aceita GET
      // Cuidado pra não afirmar demais: a sonda é um GET (leitura) e o envio é
      // um POST. Uma rota pode recusar a leitura com o token e ainda aceitar a
      // escrita — é o que parece acontecer aqui. O corpo vai junto porque
      // distingue "o app negou" de "um WAF/Cloudflare barrou antes".
      if (s === 401 || s === 403) return { ok: false, rota, aviso: true,
        motivo: `a LEITURA de ${rota} foi recusada (HTTP ${s}): ${amostraCorpo(err.response?.data)}. `
          + `O envio usa POST na mesma rota e pode passar mesmo assim — se os leads falharem, `
          + `o motivo exato aparece em Monitoramento` };
      if (s === 404) return { ok: false,
        motivo: `nenhuma rota de contato encontrada (${rotas.join(' e ')} responderam 404)` };
      if (s) return { ok: false, rota, motivo: `${rota} respondeu HTTP ${s}: ${amostraCorpo(err.response?.data)}` };
      return { ok: false, rota, motivo: `backend indisponível (${err.message})` };
    }
  }
}

async function abrirTicket(backend, token, { contactId, queueId, status }) {
  try {
    const { data } = await comAuth(backend, token, (c) =>
      c.post('/api/tickets/createTicketAPI', { contactId, queueId, status: status || 'pending' }),
      ['bearer', 'raw']);
    return data;
  } catch (err) { throw traduzErro(err, 'Abrir ticket'); }
}

// Monta o payload de contato a partir da empresa + lead do Hunter.
// number precisa ser dígitos (5511999999999). Sem telefone válido, o contato
// não pode ser criado — quem chama trata isso.
function montarContato(empresa, lead, extras = {}) {
  const e = empresa || {};
  const l = lead || {};
  // A firmografia de `empresas` manda (é a enriquecida/verificada), mas o lead
  // entra como fallback: nem todo lead tem linha lá — o cadastrado à mão não
  // tem. Sem isso o contato ia pro CRM como "Contato", sem CNPJ nem cidade, e
  // ninguém conseguia achar o lead do outro lado.
  const de = (campo) => e[campo] || l[campo] || '';
  const tel = (extras.telefone || '').replace(/\D/g, '');
  const extraInfo = [
    { name: 'Origem', value: 'Hunter' },
    // Identificador de ida-e-volta: quando o contato for marcado como convertido,
    // o webhook do GK devolve este ref e o Hunter acha o lead na própria base.
    { name: 'hunter_ref', value: extras.ref || '' },
    { name: 'Empresa', value: de('razao') || de('fantasia') },
    { name: 'CNAE', value: de('setor') },
    { name: 'Score do Lead', value: l.score != null ? String(l.score) : '' },
    { name: 'Capturado em', value: new Date().toISOString() },
  ].filter(x => x.value);
  const contato = {
    name: de('decisor') || de('fantasia') || de('razao') || 'Contato',
    number: tel,
    email: extras.email || '',
    cpfcnpj: de('cnpj'),
    estado: de('uf'),
    cidade: de('cidade'),
    referencia: 'Hunter Automático',
    endereco: de('endereco'),
    carteiraId: '',
    extraInfo,
  };
  // O CRM exige o vínculo com a empresa (do config da integração).
  if (extras.companyId) contato.companyId = extras.companyId;
  return contato;
}

module.exports = { listarEmpresas, listarFilas, upsertContato, abrirTicket, montarContato,
  checarRotaContato, EP_CONTATO, EP_CONTATO_ALT };
