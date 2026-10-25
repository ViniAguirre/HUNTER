'use strict';
/*
 * Hunter — Glasser (gateway pago de dados; cobra só o uso, sem assinatura).
 * https://api.glasser.ai — Search e Inspect de endpoints são grátis; só o Run
 * (a execução) é cobrado. Uso aqui: achar a empresa no GOOGLE MAPS (perfil da
 * empresa no Google) quando a busca grátis não achou telefone — é onde a loja
 * pequena sem site tem telefone/WhatsApp e, às vezes, o Instagram.
 *
 * O endpoint do Maps não é fixo no código: o Hunter o DESCOBRE pela busca
 * grátis do catálogo (preferindo o Serper, que é o Google Maps), confere o
 * schema e o preço pelo Inspect (grátis) e guarda a escolha na integração.
 * Assim uma mudança de nome/versão no catálogo não quebra a busca.
 *
 * Custo: cada Run devolve `charge_usd`; jobs/validacao.js grava por lead e o
 * limite diário (config.limite_dia) segura o gasto.
 */
const axios = require('axios');
const crypto = require('crypto');

// GLASSER_BASE_URL só pra testes (servidor simulado); em produção, o oficial.
const BASE = process.env.GLASSER_BASE_URL || 'https://api.glasser.ai';
const ESPERA_RUN_MS = 30000;      // Run assíncrono: espera até isto pelo resultado
const LIMITE_DIA_PADRAO = 100;    // consultas pagas por dia, se o cliente não definir

async function chamar(metodo, caminho, apiKey, corpo, { idempotencia, timeout = 20000 } = {}) {
  if (!apiKey) throw new Error('Glasser: chave obrigatória (Integrações → Contato).');
  try {
    const { data, status } = await axios({
      method: metodo, url: BASE + caminho, data: corpo, timeout,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
        ...(idempotencia ? { 'Idempotency-Key': idempotencia } : {}) },
    });
    return { data, status };
  } catch (err) {
    if (err.response) {
      const d = err.response.data || {};
      const msg = d.error?.message || d.detail?.message || d.message || (typeof d.detail === 'string' ? d.detail : '')
        || JSON.stringify(d).slice(0, 200);
      const e = new Error(`Glasser HTTP ${err.response.status}: ${msg}`);
      e.status = err.response.status;
      throw e;
    }
    throw new Error(`Glasser: ${err.message}`);
  }
}

// Teste de conexão (grátis): saldo do workspace da chave.
async function saldo(apiKey) {
  const { data } = await chamar('GET', '/v1/balance', apiKey);
  return { saldo_usd: data?.balance_usd ?? null, reservado_usd: data?.held_usd ?? null, disponivel_usd: data?.available_usd ?? null };
}

// Lista de resultados do catálogo em qualquer dos formatos prováveis.
const listaDe = d => (Array.isArray(d) ? d : d?.results || d?.endpoints || d?.items || d?.data || []);
const idDe = x => ({
  provider: x.provider || x.provider_slug || x.provider_id || x.provider?.slug || x.provider?.id || null,
  endpoint: x.endpoint || x.path || x.endpoint_path || x.slug || x.name || null,
  versao: x.endpoint_version || x.version || null,
});

// Acha o endpoint de busca no Google Maps (grátis). Prefere o Serper; aceita
// qualquer um cujo nome fale de maps/places.
async function descobrirMaps(apiKey) {
  const { data } = await chamar('POST', '/v1/endpoints/search', apiKey, {
    query: 'google maps places local business search phone website',
    use_case: 'Find a local business on Google Maps by its name and city in Brazil, to get its phone number and website',
  });
  const cands = listaDe(data).map(x => ({ ...idDe(x), bruto: x })).filter(x => x.provider && x.endpoint);
  const fala = x => /maps|places|local/i.test(`${x.endpoint} ${x.bruto?.title || ''} ${x.bruto?.description || ''}`);
  const escolhido = cands.find(x => /serper/i.test(x.provider) && fala(x)) || cands.find(fala) || null;
  if (!escolhido) return { endpoint: null, candidatos: cands.slice(0, 8).map(({ provider, endpoint }) => ({ provider, endpoint })) };
  const insp = await inspecionar(apiKey, escolhido.provider, escolhido.endpoint).catch(() => null);
  return {
    endpoint: { provider: escolhido.provider, endpoint: escolhido.endpoint, versao: insp?.versao || escolhido.versao || null,
      campos: insp?.campos || [], preco: insp?.preco || null, preco_bruto: insp?.preco_bruto || null },
    candidatos: cands.slice(0, 8).map(({ provider, endpoint }) => ({ provider, endpoint })),
  };
}

// Schema de entrada e preço do endpoint (grátis).
async function inspecionar(apiKey, provider, endpoint) {
  const { data } = await chamar('POST', '/v1/endpoints/inspect', apiKey, { provider, endpoint });
  const sch = data?.input_schema || data?.endpoint?.input_schema || {};
  const campos = Object.keys(sch.properties || sch || {});
  const p = data?.price || data?.pricing || data?.endpoint?.price || null;
  return { versao: data?.endpoint_version || data?.version || data?.endpoint?.version || null, campos,
    preco: textoPreco(p), preco_bruto: p == null ? null : JSON.stringify(p).slice(0, 400) };
}

// Preço do Inspect em texto ("US$ 0.001 por chamada"). O formato não é fixo
// (texto, número, objeto com valor/unidade, objeto aninhado por desfecho):
// procura o primeiro valor em USD e a unidade; sem achar, resume o objeto.
function textoPreco(p) {
  if (p == null) return null;
  if (typeof p === 'string' || typeof p === 'number') return String(p);
  if (typeof p !== 'object') return null;
  if (typeof p.display === 'string') return p.display;
  let valor = null, unidade = null;
  const andar = (o, prof) => {
    if (!o || typeof o !== 'object' || prof > 3) return;
    for (const [k, v] of Object.entries(o)) {
      if (valor == null && (typeof v === 'string' || typeof v === 'number') && /usd|amount|price|valor|unit_price|rate/i.test(k)
          && /^\d*\.?\d+$/.test(String(v))) valor = String(v);
      if (unidade == null && typeof v === 'string' && /^(unit|per|billing_unit|meter|kind|type)$/i.test(k)) unidade = v;
      if (v && typeof v === 'object') andar(v, prof + 1);
    }
  };
  andar(p, 0);
  if (valor != null) return `US$ ${valor}${unidade ? ` (${unidade})` : ''}`;
  return JSON.stringify(p).slice(0, 120);
}

// Entrada pro endpoint conforme o schema: Serper usa `q` (+ gl/hl); outros
// costumam usar `query` ou `keyword`.
function entradaMaps(campos, termo) {
  const tem = c => !campos.length || campos.includes(c);
  if (campos.includes('keyword')) return { keyword: termo, location_name: 'Brazil', language_code: 'pt' };
  if (campos.includes('query') && !campos.includes('q')) return { query: termo };
  return { q: termo, ...(tem('gl') ? { gl: 'br' } : {}), ...(tem('hl') ? { hl: 'pt-br' } : {}) };
}

// Executa e devolve { output, custo_usd, run_id }. Run assíncrono (202): espera.
async function executar(apiKey, { provider, endpoint, versao, input, metadata }) {
  const corpo = { provider, endpoint, input, ...(versao ? { endpoint_version: versao } : {}), ...(metadata ? { metadata } : {}) };
  let { data, status } = await chamar('POST', '/v1/runs', apiKey, corpo, { idempotencia: crypto.randomUUID(), timeout: 30000 });
  let run = data?.run || data;
  const fim = Date.now() + ESPERA_RUN_MS;
  while ((status === 202 || ['QUEUED', 'RUNNING'].includes(run?.status)) && run?.id && Date.now() < fim) {
    await new Promise(r => setTimeout(r, 1500));
    ({ data, status } = await chamar('GET', `/v1/runs/${run.id}`, apiKey));
    run = data?.run || data;
    status = 200;
  }
  const custo = run?.charge_usd ?? null;
  if (run?.status && run.status !== 'COMPLETED') {
    const e = new Error(`Glasser: run ${run.status}${run.failure ? ` (${JSON.stringify(run.failure).slice(0, 120)})` : ''}`);
    e.custo_usd = custo; throw e;
  }
  // COMPLETED com erro do provedor é falha de negócio, não resultado.
  const http = run?.provider_response?.http_status;
  if ((http && http >= 400) || run?.provider_response?.error) {
    const e = new Error(`Glasser: provedor respondeu ${http || 'erro'}`);
    e.custo_usd = custo; throw e;
  }
  return { output: run?.output ?? null, custo_usd: custo, run_id: run?.id || null };
}

// Lugares do resultado, normalizados (Serper: places[].title/phoneNumber/website/address).
function lugaresDe(output) {
  if (!output || typeof output !== 'object') return [];
  const lista = output.places || output.local_results || output.results || output.items
    || output.data || Object.values(output).find(Array.isArray) || [];
  return (Array.isArray(lista) ? lista : []).map(p => ({
    nome: p.title || p.name || p.displayName?.text || '',
    telefone: p.phoneNumber || p.phone || p.phone_number || p.formatted_phone_number || '',
    website: p.website || p.site || p.url || p.domain || '',
    endereco: p.address || p.formattedAddress || p.formatted_address || '',
    categoria: p.category || p.type || (Array.isArray(p.types) ? p.types[0] : '') || '',
  })).filter(p => p.nome);
}

// Razão social sem a forma jurídica e o "comércio de…" do cadastro: é assim
// que muita loja pequena aparece no Maps quando não tem nome fantasia.
function limparRazao(razao) {
  return String(razao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(ltda|s\.?\/?a\.?|eireli|me|epp|mei|ss|sociedade simples|limitada)\b\.?/gi, ' ')
    .replace(/^\d[\d.\/-]*\s+/, '')   // MEI: "60.114.929 ALEX MORAES"
    .replace(/\b(industria|ind|comercio|com|servicos|serv|e|de|do|da|dos|das)\b\.?/gi, ' ')
    .replace(/[-–—.,;:]+\s*$/g, '').replace(/\s+/g, ' ').trim()
    .replace(/[-–—.,;:]+$/g, '').trim();
}

const semAc = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const TIPO_LOGRADOURO = /^(rua|r|avenida|av|rodovia|rod|estrada|est|travessa|tv|alameda|al|praca|pc|largo|via|servidao|quadra|qd)\.?$/;

// Rua e número do endereço do cadastro ("Rua X, 123, Bairro, Cidade, UF, CEP").
function ruaENumero(endereco) {
  const partes = String(endereco || '').split(',').map(x => x.trim());
  const rua = semAc(partes[0] || '').split(/\s+/).filter(t => t.length >= 4 && !TIPO_LOGRADOURO.test(t));
  const numero = (partes[1] || '').match(/^\d{1,6}/)?.[0] || null;
  return { rua, numero };
}

// É mesmo esta empresa? Precisa estar no lugar certo (a cidade no endereço,
// ou — sem endereço — o DDD do telefone batendo com a UF) E ser ela: uma
// palavra distintiva de um dos nomes no título do lugar, OU o endereço do
// cadastro (rua e número) no endereço do lugar — muita empresa pequena está
// no Maps com um nome que não tem nada a ver com a razão social. O Maps
// devolve o "mais parecido" mesmo quando não acha, por isso as duas provas.
function confere(lugar, { nome, nomes, cidade, uf, endereco }) {
  const g = require('./google');
  const disp = semAc(lugar.nome);
  const cid = semAc(cidade).trim();
  const tel = String(lugar.telefone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (tel && g.telefoneDesmenteUf(tel, uf)) return false;
  const end = semAc(lugar.endereco);
  const lugarCerto = end ? (!!cid && end.includes(cid)) : (!!tel && !!uf);
  if (!lugarCerto) return false;
  const toks = [...new Set((nomes || [nome]).flatMap(n => g.tokensNome(n)))].filter(t => !cid.split(/\s+/).includes(t));
  if (toks.some(t => disp.includes(t))) return true;
  const { rua, numero } = ruaENumero(endereco);
  return !!(end && numero && rua.length && rua.some(t => end.includes(t)) && new RegExp(`\\b${numero}\\b`).test(end));
}

// Uma consulta ao Maps. Devolve os lugares e o custo.
async function consultarMaps(apiKey, ep, termo) {
  const r = await executar(apiKey, { provider: ep.provider, endpoint: ep.endpoint, versao: ep.versao,
    input: entradaMaps(ep.campos || [], termo), metadata: { origem: 'hunter_contato' } });
  return { lugares: lugaresDe(r.output), custo_usd: r.custo_usd, output: r.output };
}

const somaUsd = (a, b) => a == null ? (b ?? null) : b == null ? a
  : String(+(Number(a) + Number(b)).toFixed(6));

// Busca no Google Maps pelo Glasser. `cfg` = config da integração (endpoint
// descoberto). Primeiro pelo nome (fantasia ou razão) + cidade; se nenhum dos
// 5 primeiros lugares conferir e a razão social limpa for outro nome, tenta
// também por ela (2ª consulta, conta no limite). Devolve o contato no formato
// de providers/google.js, com custo, número de consultas e o resultado:
//   achou | lugar_nao_confere | sem_resultado.
// `debug`: devolve também os lugares vistos (tela de teste das Integrações).
async function buscarNoMaps(nome, cidade, uf, apiKey, cfg = {}, { razao = null, endereco = null, debug = false } = {}) {
  const ep = cfg.maps;
  if (!ep?.provider || !ep?.endpoint) throw new Error('Glasser: endpoint do Google Maps ainda não configurado (Integrações → Testar).');
  const nomes = [nome];
  const rz = limparRazao(razao);
  const tokNome = new Set(require('./google').tokensNome(nome));
  if (rz && require('./google').tokensNome(rz).some(t => !tokNome.has(t))) nomes.push(rz);
  const alvo = { nome, nomes, cidade, uf, endereco };
  let custo = null, consultas = 0, lugar = null, vistos = [], semNada = true;
  for (const n of nomes) {
    let r;
    try {
      r = await consultarMaps(apiKey, ep, [n, cidade, uf].filter(Boolean).join(' '));
    } catch (e) {
      e.custo_usd = somaUsd(custo, e.custo_usd); e.consultas = consultas + 1;
      throw e;
    }
    consultas++; custo = somaUsd(custo, r.custo_usd);
    if (r.lugares.length) semNada = false;
    if (debug) vistos.push({ termo: [n, cidade, uf].filter(Boolean).join(' '), lugares: r.lugares.slice(0, 5),
      chaves: r.output && typeof r.output === 'object' ? Object.keys(r.output).slice(0, 12) : typeof r.output });
    lugar = r.lugares.slice(0, 5).find(l => confere(l, alvo));
    if (lugar) break;
  }
  const agora = new Date().toISOString();
  const extra = { custo_usd: custo, consultas, ...(debug ? { vistos } : {}) };
  if (!lugar) {
    const motivo = semNada ? 'sem_resultado' : 'lugar_nao_confere';
    return { encontrado: false, fonte: 'glasser', validado: false, validado_em: agora, motivo, resultado: motivo, ...extra };
  }
  const telefone = String(lugar.telefone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '') || null;
  let website = lugar.website || null;
  const host = (() => { try { return new URL(website).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const social = website && /(^|\.)(instagram\.com|facebook\.com|linktr\.ee)$/i.test(host) ? website : null;
  if (social) website = null;
  return {
    encontrado: true, resultado: 'achou', telefone, whatsapp: telefone, website, email: null,
    ...(social ? { perfil_social: social } : {}),
    nome_google: lugar.nome, categoria_google: lugar.categoria || null,
    fonte: 'glasser', site_conferido: 'maps', validado: !!(telefone || website || social), validado_em: agora,
    ...extra,
  };
}

module.exports = { saldo, descobrirMaps, inspecionar, executar, buscarNoMaps, lugaresDe, confere, entradaMaps, textoPreco, limparRazao, ruaENumero, LIMITE_DIA_PADRAO };
