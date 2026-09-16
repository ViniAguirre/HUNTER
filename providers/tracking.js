'use strict';
/*
 * Hunter — Tracking Hub da Antídoto (eventos do funil de prospecção).
 *
 * Manda um POST por evento numa URL de webhook com token embutido. Os quatro
 * eventos espelham as etapas que o Dashboard já mostra:
 *   company_found → lead_segmented → lead_qualified → lead_sent_to_crm
 *
 * O que amarra tudo é `identity.hunter_id`: o MESMO identificador que já vai no
 * payload do lead pro CRM (o `crm_ref`). É por ele que o Tracking Hub costura a
 * jornada de descoberta daqui com o card que o lead vira no CRM depois.
 *
 * Envio é best-effort por contrato: nada aqui pode travar o motor.
 */
const axios = require('axios');
const crypto = require('crypto');

const SCHEMA = '1.0';
const EVENTOS = ['company_found', 'lead_segmented', 'lead_qualified', 'lead_sent_to_crm'];

// hunter_id determinístico a partir de (radar, CNPJ). Precisa ser determinístico
// porque `company_found` dispara na descoberta, quando o lead ainda não existe —
// e `lead_sent_to_crm`, lá na frente, tem que falar do MESMO registro. Com id
// aleatório por etapa, o Hub veria quatro pessoas soltas em vez de uma jornada.
// Não leva o CNPJ em texto puro: o handoff pede pra não mandar documento cru, e
// o hash resolve a correlação do mesmo jeito.
function hunterId(busca_id, cnpj) {
  const limpo = String(cnpj || '').replace(/\D/g, '');
  if (!limpo) return null;
  const base = `${busca_id || 0}:${limpo}`;
  return 'hnt_' + crypto.createHash('sha256').update(base).digest('hex').slice(0, 12);
}

// Campos vazios saem do payload: o Hub valida o formato, e mandar
// "company_name": "" é pior que não mandar o campo.
function limpar(obj) {
  const saida = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === null || v === undefined || v === '') continue;
    saida[k] = v;
  }
  return saida;
}

function montarEvento(nome, { hunter_id, properties, occurred_at } = {}) {
  if (!EVENTOS.includes(nome)) throw new Error(`evento desconhecido: ${nome}`);
  if (!hunter_id) throw new Error('evento sem hunter_id');
  return {
    schema_version: SCHEMA,
    event_id: crypto.randomUUID(),
    event_name: nome,
    occurred_at: new Date(occurred_at || Date.now()).toISOString(),
    source: { system: 'hunter' },
    identity: { hunter_id },
    properties: limpar(properties),
    // Um evento por empresa por etapa: reenviar a mesma etapa é inofensivo.
    idempotency_key: `hunter:${nome}:${hunter_id}`,
  };
}

function amostraCorpo(data) {
  const txt = typeof data === 'string' ? data : JSON.stringify(data ?? null);
  return (txt || '').slice(0, 300);
}

// Classifica a resposta do Hub. Atenção ao 202: nesta API ele NÃO é sucesso —
// é "payload inválido", com a lista de erros no corpo. Tratar 2xx como OK
// engoliria justamente o caso que precisa de conserto nosso, e ainda faria o
// evento ser dado como entregue sem nunca ter entrado.
function classificar(status, data) {
  if (status === 200) {
    return { ok: true, duplicado: !!(data && data.duplicate) };
  }
  if (status === 202) {
    return { ok: false, permanente: true,
      motivo: `payload recusado pelo Hub (HTTP 202): ${amostraCorpo(data)}` };
  }
  if (status === 404) {
    return { ok: false, permanente: true,
      motivo: 'URL/token do Tracking Hub inválido (HTTP 404) — gere a URL de novo em Integrações' };
  }
  return { ok: false, permanente: status >= 400 && status < 500,
    motivo: `Tracking Hub respondeu HTTP ${status}: ${amostraCorpo(data)}` };
}

// Faz o POST. `validateStatus` aceita tudo pra classificar aqui em cima em vez
// de deixar o axios transformar 404/202 em exceção sem corpo legível.
async function enviar(url, evento, { timeout = 10000 } = {}) {
  let resp;
  try {
    resp = await axios.post(url, evento, {
      timeout,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
  } catch (err) {
    // Rede/timeout: transitório, vale retentar.
    return { ok: false, permanente: false,
      motivo: `Tracking Hub inacessível (${err.code || err.message})` };
  }
  return classificar(resp.status, resp.data);
}

// Lê a conexão ativa. A URL é segredo (tem o token dentro), então mora em
// key_cifrada — o mesmo lugar das outras chaves, que a API nunca devolve
// inteira pra tela. TRACKING_HUB_URL segue valendo como plano B pra quem
// preferir configurar pela stack.
async function urlAtiva(pool) {
  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada FROM integracoes
      WHERE categoria='tracking' AND provedor='hub' AND ativo=true
        AND key_cifrada IS NOT NULL AND key_cifrada <> '' LIMIT 1`
  );
  const url = (ig && ig.key_cifrada) || process.env.TRACKING_HUB_URL || '';
  return String(url).trim() || null;
}

function urlValida(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch (_) { return false; }
}

module.exports = { hunterId, montarEvento, enviar, urlAtiva, urlValida, classificar, EVENTOS, SCHEMA };
