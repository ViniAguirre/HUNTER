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
      const base = d.error?.message || d.detail?.message || d.message || (typeof d.detail === 'string' ? d.detail : '');
      // O 400 de schema traz o porquê nos detalhes (campo faltando, valor fora
      // da lista): sem eles a mensagem não diz o que corrigir.
      const det = d.error?.details ?? d.error?.errors ?? d.errors ?? (Array.isArray(d.detail) ? d.detail : null);
      const msg = (base ? base + (det ? ' — ' + JSON.stringify(det).slice(0, 300) : '') : '') || JSON.stringify(d).slice(0, 300);
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
      campos: insp?.campos || [], schema: insp?.schema || null, preco: insp?.preco || null, preco_bruto: insp?.preco_bruto || null },
    candidatos: cands.slice(0, 8).map(({ provider, endpoint }) => ({ provider, endpoint })),
  };
}

// Schema de entrada e preço do endpoint (grátis).
async function inspecionar(apiKey, provider, endpoint) {
  const { data } = await chamar('POST', '/v1/endpoints/inspect', apiKey, { provider, endpoint });
  const sch = data?.input_schema || data?.endpoint?.input_schema || data?.schemas?.input || {};
  const schema = resumoSchema(sch);
  const campos = schema.campos.map(c => c.nome);
  const p = data?.price || data?.pricing || data?.endpoint?.price || null;
  return { versao: data?.endpoint_version || data?.version || data?.endpoint?.version || null, campos, schema,
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

// Schema de entrada resumido: nome, tipo, obrigatório, valores aceitos e padrão
// de cada campo. É o que monta a consulta (entradaMaps) e o que a tela de
// teste mostra quando o endpoint recusa a entrada.
function resumoSchema(sch) {
  const props = sch && typeof sch === 'object' && sch.properties && typeof sch.properties === 'object' ? sch.properties : {};
  const obrig = new Set(Array.isArray(sch?.required) ? sch.required : []);
  return {
    campos: Object.entries(props).slice(0, 30).map(([nome, d]) => ({
      nome, tipo: d?.type || (d?.enum ? 'enum' : null), obrigatorio: obrig.has(nome),
      ...(Array.isArray(d?.enum) ? { valores: d.enum.slice(0, 40) } : {}),
      ...(d?.default !== undefined ? { padrao: d.default } : {}),
      ...(d?.description ? { descricao: String(d.description).slice(0, 160) } : {}),
    })),
    livre: sch?.additionalProperties !== false,
  };
}

const CAMPOS_TEXTO = ['q', 'query', 'keyword', 'search', 'term', 'text', 'searchQuery', 'search_query'];

// Entrada pro endpoint. Com o schema do Inspect: só os campos que ele aceita,
// o texto no campo de busca que ele tiver, país/idioma/local só se existirem e
// com valor que caiba na lista aceita. Sem schema (integração antiga): o
// formato do Serper (q + gl/hl) ou o que os campos sugerirem.
// `minimo`: só o texto — a 2ª tentativa quando o endpoint recusa a entrada.
function entradaMaps(campos, termo, { schema = null, cidade = null, uf = null, minimo = false } = {}) {
  const lista = schema?.campos?.length ? schema.campos : (campos || []).map(nome => ({ nome }));
  const nomes = lista.map(c => c.nome);
  const campoTexto = CAMPOS_TEXTO.find(c => nomes.includes(c)) || (nomes.length ? null : 'q');
  if (!campoTexto) {
    if (nomes.includes('keyword')) return { keyword: termo };
    // Nenhum campo de texto conhecido: usa o primeiro obrigatório de texto.
    const alt = lista.find(c => c.obrigatorio && (!c.tipo || c.tipo === 'string')) || lista.find(c => c.tipo === 'string');
    return { [alt ? alt.nome : 'q']: termo };
  }
  const out = { [campoTexto]: termo };
  if (minimo) return out;
  const cabe = (nome, valor) => {
    if (!nomes.length) return nome === 'gl' || nome === 'hl';   // sem schema: formato do Serper
    const c = lista.find(x => x.nome === nome);
    if (!c) return false;
    return !c.valores || c.valores.map(v => String(v).toLowerCase()).includes(String(valor).toLowerCase());
  };
  const valorDe = (nome, valor) => {
    const c = lista.find(x => x.nome === nome);
    return c?.valores?.find(v => String(v).toLowerCase() === String(valor).toLowerCase()) ?? valor;
  };
  for (const [nome, valor] of [['gl', 'br'], ['hl', 'pt-br'], ['location_name', 'Brazil'], ['language_code', 'pt'], ['country', 'br']]) {
    if (cabe(nome, valor)) out[nome] = valorDe(nome, valor);
  }
  if (cidade && nomes.includes('location') && !lista.find(x => x.nome === 'location')?.valores) {
    out.location = [cidade, uf, 'Brazil'].filter(Boolean).join(', ');
  }
  return out;
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

// Rua, número e CEP do endereço do cadastro ("Rua X, 123, Bairro, Cidade, UF, CEP").
function ruaENumero(endereco) {
  const partes = String(endereco || '').split(',').map(x => x.trim());
  // Palavras da rua, e também números de 3+ dígitos ("Quadra 104 Sul", "SQN 308"):
  // nas cidades planejadas é a quadra que identifica o endereço.
  const rua = semAc(partes[0] || '').split(/\s+/).filter(t => (t.length >= 4 && !TIPO_LOGRADOURO.test(t)) || /^\d{3,}$/.test(t));
  // Sem zero à esquerda: o cadastro escreve "03", o Maps "3".
  const numero = (partes[1] || '').match(/^\d{1,6}/)?.[0]?.replace(/^0+(?=\d)/, '') || null;
  const cep = (partes[partes.length - 1] || '').replace(/\D/g, '');
  return { rua, numero, cep: cep.length === 8 ? cep : null };
}
const cepsDe = texto => (String(texto || '').match(/\b\d{5}-?\d{3}\b/g) || []).map(c => c.replace('-', ''));

// Palavras que não identificam a empresa: as do ramo (o que os clientes têm
// no nome — "filtros", "purificadores" —, as palavras-chave do radar e as da
// atividade do cadastro) e as de loja em geral. "Filtros" no título do lugar
// casa qualquer loja de filtros da cidade; sozinha, não prova que é ESTA.
const GENERICAS_LOJA = ['loja', 'lojas', 'center', 'centro', 'store', 'shop', 'express', 'brasil', 'brazil', 'nacional',
  'assistencia', 'tecnica', 'tecnico', 'solucoes', 'sistemas', 'equipamentos', 'produtos', 'materiais', 'artigos',
  'casa', 'mundo', 'ponto', 'mega', 'super', 'grupo', 'atacado', 'varejo', 'importadora', 'comercio', 'servicos',
  'distribuidora', 'representacoes', 'industria', 'company', 'oficial'];
function genericasDe({ setor = null, criterios = null } = {}) {
  const p = criterios?.params || {};
  const ramo = (p.perfil?.palavras || []).flatMap(x => x?.formas || []);
  return [...new Set([...ramo, ...(p.keywords || []), ...require('./google').tokensNome(setor || '')]
    .map(t => semAc(t).trim()).filter(Boolean))];
}

// É mesmo esta empresa? Precisa estar no lugar certo (a cidade no endereço,
// ou — sem endereço — o DDD do telefone batendo com a UF) E ser ela:
//  • uma palavra DISTINTIVA de um dos nomes no título do lugar ("Aiqa"); ou
//  • só palavra do ramo/genérica no título ("filtros") + o mesmo número E a
//    mesma rua ou o mesmo CEP do cadastro; ou
//  • nome nenhum, mas a mesma rua e número (muita empresa pequena está no
//    Maps com um nome sem nada a ver com a razão social).
// O Maps devolve o "mais parecido" mesmo quando não acha, por isso as provas.
function confere(lugar, { nome, nomes, cidade, uf, endereco, genericas = [] }) {
  const g = require('./google');
  const disp = semAc(lugar.nome);
  const cid = semAc(cidade).trim();
  const tel = String(lugar.telefone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (tel && g.telefoneDesmenteUf(tel, uf)) return false;
  const end = semAc(lugar.endereco);
  const lugarCerto = end ? (!!cid && end.includes(cid)) : (!!tel && !!uf);
  if (!lugarCerto) return false;
  const fam = require('./palavras').familia;
  const gen = new Set([...GENERICAS_LOJA, ...genericas].map(fam));
  const toks = [...new Set((nomes || [nome]).flatMap(n => g.tokensNome(n)))].filter(t => !cid.split(/\s+/).includes(t));
  const bate = toks.filter(t => disp.includes(t));
  if (bate.some(t => !gen.has(fam(t)))) return true;
  // Sigla de 2 letras ("HD" Purificadores, "SG" Refrigeração) também identifica,
  // como palavra inteira no título.
  const siglas = [...new Set((nomes || [nome]).flatMap(n => g.siglasDoNome(n)))];
  if (siglas.some(sg => new RegExp(`(^|[^a-z0-9])${sg}([^a-z0-9]|$)`).test(disp))) return true;
  const { rua, numero, cep } = ruaENumero(endereco);
  const numeroOk = !!(end && numero && new RegExp(`(^|\\D)0*${numero}(\\D|$)`).test(end));
  const ruaOk = !!(end && rua.length && rua.some(t => /^\d+$/.test(t) ? new RegExp(`(^|\\D)${t}(\\D|$)`).test(end) : end.includes(t)));
  const cepOk = !!(cep && cepsDe(lugar.endereco).includes(cep));
  if (bate.length) return numeroOk && (ruaOk || cepOk);
  return numeroOk && ruaOk;
}

// Uma consulta ao Maps. Devolve os lugares e o custo.
async function consultarMaps(apiKey, ep, termo, local = {}) {
  const rodar = input => executar(apiKey, { provider: ep.provider, endpoint: ep.endpoint, versao: ep.versao,
    input, metadata: { origem: 'hunter_contato' } });
  const input = entradaMaps(ep.campos || [], termo, { schema: ep.schema, ...local });
  let r;
  try {
    r = await rodar(input);
  } catch (e) {
    // Entrada recusada (HTTP 400/422: o run nem é criado, não cobra): tenta
    // uma vez só com o texto da busca.
    const minimo = entradaMaps(ep.campos || [], termo, { schema: ep.schema, minimo: true });
    if (!(e.status === 400 || e.status === 422) || JSON.stringify(minimo) === JSON.stringify(input)) throw e;
    r = await rodar(minimo);
  }
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
async function buscarNoMaps(nome, cidade, uf, apiKey, cfg = {}, { razao = null, endereco = null, genericas = [], debug = false } = {}) {
  const ep = cfg.maps;
  if (!ep?.provider || !ep?.endpoint) throw new Error('Glasser: endpoint do Google Maps ainda não configurado (Integrações → Testar).');
  const nomes = [nome];
  const rz = limparRazao(razao);
  const tokNome = new Set(require('./google').tokensNome(nome));
  if (rz && require('./google').tokensNome(rz).some(t => !tokNome.has(t))) nomes.push(rz);
  const alvo = { nome, nomes, cidade, uf, endereco, genericas };
  let custo = null, consultas = 0, lugar = null, vistos = [], semNada = true;
  for (const n of nomes) {
    let r;
    try {
      r = await consultarMaps(apiKey, ep, [n, cidade, uf].filter(Boolean).join(' '), { cidade, uf });
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

module.exports = { saldo, descobrirMaps, inspecionar, executar, buscarNoMaps, lugaresDe, confere, entradaMaps, resumoSchema, textoPreco, limparRazao, ruaENumero, genericasDe, LIMITE_DIA_PADRAO };
