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
 *   POST /api/contacts               → cria contato (doc "API Criar Contato")
 */
const axios = require('axios');

// Confirmado na doc oficial do GK ("API Criar Contato"): POST em
// {BACKEND_URL}/api/contacts. A alternativa sem "/api" fica só como rede de
// segurança pra instalação antiga que ainda monte a rota no caminho do
// Whaticket de origem.
const EP_CONTATO = '/api/contacts';
const EP_CONTATO_ALT = '/contacts';

// A doc do GK pede "Authorization: Bearer <token>" em todas as rotas, contato
// incluído — então é esse o esquema principal. O 'raw' (token sem prefixo)
// continua como tentativa de reserva porque é assim que o n8n que entrega
// contatos hoje está configurado, e uma instalação pode comparar o header
// inteiro. Só é usado depois que o Bearer volta 401/403.
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
async function comAuth(backend, token, fn, ordem = ['bearer', 'raw']) {
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

// Desembrulha a resposta de "Obter um Contato" — cada fork embrulha diferente.
function extrairContato(data) {
  const alvo = Array.isArray(data) ? data[0] : data;
  if (!alvo || typeof alvo !== 'object') return null;
  const c = alvo.contact && typeof alvo.contact === 'object' ? alvo.contact
          : alvo.data && typeof alvo.data === 'object' && !Array.isArray(alvo.data) ? alvo.data
          : alvo;
  return c && c.id != null ? c : null;
}

// Procura o contato pelo número (doc: GET /api/contacts/single, com o número no
// corpo). Devolve o contato, null se não existe, ou undefined se não deu pra
// saber (rota ausente, erro do CRM) — aí quem chama segue pelo caminho antigo
// de criar, pra não travar o envio por causa da consulta.
async function buscarContato(backend, token, number) {
  if (!number) return undefined;
  try {
    const { data } = await comAuth(backend, token, (c) =>
      c.request({ method: 'GET', url: '/api/contacts/single', data: { number } }), ['bearer', 'raw']);
    return extrairContato(data);
  } catch (err) {
    const s = err.response?.status;
    if (s === 404) {
      // 404 pode ser "contato não existe" ou "rota não existe". Só confia no
      // primeiro quando o corpo é um erro de negócio (JSON), não página de rota.
      const d = err.response?.data;
      return d && typeof d === 'object' ? null : undefined;
    }
    if (s === 400) return null;   // alguns forks respondem 400 ERR_NO_CONTACT_FOUND
    return undefined;
  }
}

// Junta o que o Hunter sabe com o que já está no CRM SEM apagar nada de lá: o
// contato pode ser um cliente com histórico. Campos do CRM preenchidos ficam;
// só os vazios recebem o dado do Hunter. Nas informações adicionais, as que o
// Hunter escreve (Origem, hunter_ref, Score...) são atualizadas e as demais
// ficam intactas.
function mesclarContato(existente, novo) {
  const out = { id: existente.id };
  for (const [k, v] of Object.entries(novo)) {
    if (k === 'extraInfo' || k === 'companyId') continue;
    const atual = existente[k];
    out[k] = (atual != null && String(atual).trim() !== '') ? atual : v;
  }
  // O número do CRM manda: a consulta casou por ele.
  if (existente.number) out.number = existente.number;
  const nossos = new Set((novo.extraInfo || []).map(x => x.name));
  const deles = (Array.isArray(existente.extraInfo) ? existente.extraInfo : [])
    .filter(x => x && x.name && !nossos.has(x.name))
    .map(x => ({ name: x.name, value: x.value }));
  out.extraInfo = [...deles, ...(novo.extraInfo || [])];
  if (novo.companyId) out.companyId = novo.companyId;
  return out;
}

// Upsert de verdade: a rota de criar só cria, então primeiro procura pelo
// número. Achou → atualiza (mesclando) e reusa o id; não achou → cria. É o que
// impede o retry do job de duplicar contato quando o ticket falha depois.
async function upsertContato(backend, token, contato) {
  const existente = await buscarContato(backend, token, contato.number);
  if (existente) {
    try {
      await comAuth(backend, token, (c) => c.post('/api/contact/update', mesclarContato(existente, contato)),
        ['bearer', 'raw']);
    } catch (err) {
      // O contato existe: dado desatualizado não pode impedir o ticket. Segue.
      console.warn('[gk] contato existe, mas a atualização falhou:', traduzErro(err, 'Atualizar contato').message);
    }
    return existente.id;
  }
  return criarContato(backend, token, contato);
}

// Cria o contato e devolve o contactId. Bearer primeiro, como manda a doc; se
// voltar 401/403 ainda tenta o token cru antes de desistir.
async function criarContato(backend, token, contato) {
  const rotas = [EP_CONTATO, EP_CONTATO_ALT];
  for (let i = 0; i < rotas.length; i++) {
    const rota = rotas[i];
    let resp;
    try {
      resp = await comAuth(backend, token, (c) => c.post(rota, contato), ['bearer', 'raw']);
    } catch (err) {
      // 404 = rota inexistente nesta instalação: tenta a alternativa. Qualquer
      // outro erro é real e precisa chegar ao usuário como veio.
      if (err.response?.status === 404 && i < rotas.length - 1) continue;
      const s = err.response?.status;
      // 401/403 aqui é quase sempre o token errado, não a rota: a doc do GK diz
      // que o token desta rota é o "cadastrado na conexão" — o da tela de
      // Conexões do CRM, não o token geral da empresa. E ele muda quando a
      // conexão é recriada, que é como uma integração que funcionava para de
      // funcionar sozinha. Sem dizer isso, o erro bruto do CRM ("Expired
      // Session") mandava procurar no lugar errado.
      if (s === 401 || s === 403) {
        throw new Error(
          `Criar/atualizar contato (${rota}): o CRM recusou o token [HTTP ${s}] `
          + `${amostraCorpo(err.response?.data)} — confira em Conexões, no CRM, o token da conexão `
          + `usada para esta integração e cole o valor atual aqui (ele muda se a conexão for recriada)`
        );
      }
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
      await comAuth(backend, token, (c) => c.get(rota), ['bearer', 'raw']);
      return { ok: true, rota };
    } catch (err) {
      const s = err.response?.status;
      if (s === 404 && i < rotas.length - 1) continue;
      if (s === 405) return { ok: true, rota };   // existe, só não aceita GET
      // 401/403 aqui NÃO é conexão quebrada. A sonda é um GET (leitura) e o
      // envio é um POST (escrita): no Whaticket a leitura de contatos é
      // guardada pela sessão do usuário e recusa qualquer token de API, com
      // ou sem "Bearer". Quem respondeu foi o próprio CRM, então a rota
      // existe. Tratar isso como falha fazia a tela acusar erro numa conexão
      // que podia estar boa — e o usuário desistir antes de testar o envio.
      if (s === 401 || s === 403) return { ok: true, rota, somenteEscrita: true,
        motivo: `a leitura de ${rota} é bloqueada pelo CRM (HTTP ${s}: ${amostraCorpo(err.response?.data)}) — `
          + `isso é esperado, essa rota só libera leitura pra sessão de usuário. O envio de leads usa POST `
          + `na mesma rota e não passa por essa checagem. Pra confirmar de verdade, envie um lead e veja o `
          + `resultado em Monitoramento` };
      if (s === 404) return { ok: false,
        motivo: `nenhuma rota de contato encontrada (${rotas.join(' e ')} responderam 404)` };
      if (s) return { ok: false, rota, motivo: `${rota} respondeu HTTP ${s}: ${amostraCorpo(err.response?.data)}` };
      return { ok: false, rota, motivo: `backend indisponível (${err.message})` };
    }
  }
}

function extrairTicket(data) {
  const alvo = Array.isArray(data) ? data[0] : data;
  if (!alvo || typeof alvo !== 'object') return null;
  const t = alvo.ticket && typeof alvo.ticket === 'object' ? alvo.ticket
          : alvo.data && typeof alvo.data === 'object' && !Array.isArray(alvo.data) ? alvo.data
          : alvo;
  const id = t.ticketId ?? t.id;
  return id != null ? { id, status: t.status, queueId: t.queueId ?? t.queue?.id ?? null, contactId: t.contactId } : null;
}

// Quando o createTicketAPI não devolve o ticket (doc: "se o contato já tiver
// ticket nesta conexão, nada acontece"), acha o ticket pelos tickets do
// contato. Devolve o ticket ainda aberto mais recente (Aguardando primeiro); quem
// chama decide se mexe — um em atendimento é de alguém e fica como está.
async function acharTicketPendente(backend, token, { contactId, number }) {
  if (!number) return null;
  try {
    const { data } = await comAuth(backend, token, (c) =>
      c.request({ method: 'GET', url: '/api/contacts/alltickets', data: { number } }), ['bearer', 'raw']);
    const lista = Array.isArray(data) ? data : (data?.tickets || data?.data || []);
    const candidatos = lista.map(extrairTicket).filter(t => t && t.status !== 'closed'
      && (t.contactId == null || String(t.contactId) === String(contactId)));
    candidatos.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1)
      || Number(b.id) - Number(a.id));
    return candidatos[0] || null;
  } catch (_) { return null; }
}

// Abre o ticket e põe na fila. A doc do createTicketAPI só aceita contactId e
// abre "em Aguardando, sem Setor" — o queueId mandado ali é ignorado, e o lead
// caía sem fila. Por isso a fila é aplicada depois, no updateAPI, com o id do
// ticket. Ticket já em atendimento (open) não é mexido: tem alguém nele.
async function abrirTicket(backend, token, { contactId, queueId, status, number }) {
  let data;
  try {
    ({ data } = await comAuth(backend, token, (c) =>
      // queueId/status seguem no corpo: inofensivo onde é ignorado, e há
      // instalação que respeita.
      c.post('/api/tickets/createTicketAPI', { contactId, queueId, status: status || 'pending' }),
      ['bearer', 'raw']));
  } catch (err) { throw traduzErro(err, 'Abrir ticket'); }

  const ticket = extrairTicket(data) || await acharTicketPendente(backend, token, { contactId, number });
  if (!ticket) {
    // Sem id não há como pôr na fila. O contato e o ticket existem, então não
    // vale falhar o job (o retry não mudaria nada) — mas fica registrado.
    console.warn(`[gk] ticket do contato ${contactId} sem id na resposta — fila ${queueId} não aplicada`);
    return { ticketId: null, filaAplicada: false, motivo: 'ticket_sem_id' };
  }
  if (ticket.status && ticket.status !== 'pending') {
    return { ticketId: ticket.id, filaAplicada: false, motivo: `ticket_${ticket.status}` };
  }
  if (!queueId || String(ticket.queueId) === String(queueId)) {
    return { ticketId: ticket.id, filaAplicada: !!queueId };
  }
  try {
    await comAuth(backend, token, (c) =>
      c.post('/api/tickets/updateAPI', { ticketId: String(ticket.id), queueId: String(queueId), status: 'pending' }),
      ['bearer', 'raw']);
  } catch (err) { throw traduzErro(err, `Pôr o ticket ${ticket.id} na fila ${queueId}`); }
  return { ticketId: ticket.id, filaAplicada: true };
}

// A doc do GK mostra o número com DDI: 5541992018982. Os telefones do Hunter
// vêm como (41) 99201-8982, e sem o 55 na frente o contato entra no CRM com um
// número que não existe no WhatsApp — o contato até é criado, mas o ticket
// nunca casa com a conversa. DDI só entra quando o número tem cara de nacional
// (10 ou 11 dígitos); o que já vem com 55 e comprimento de DDI fica como está.
function normalizarNumero(bruto) {
  const d = String(bruto || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length >= 12 && d.startsWith('55')) return d;
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
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
  const tel = normalizarNumero(extras.telefone);
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

module.exports = { listarEmpresas, listarFilas, upsertContato, criarContato, buscarContato, mesclarContato,
  abrirTicket, montarContato, checarRotaContato, normalizarNumero, EP_CONTATO, EP_CONTATO_ALT };
