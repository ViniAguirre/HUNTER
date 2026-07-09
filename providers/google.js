'use strict';
/*
 * Hunter — validação de contato via Google (Places API New).
 * A empresa já veio ATIVA da CNPJá. Aqui buscamos o perfil do Google Meu
 * Negócio (por razão/fantasia + cidade/UF) pra pegar o CONTATO COMERCIAL real:
 * telefone/WhatsApp e o site. O e-mail sai de um scrape leve do site (grátis) —
 * o Google não expõe e-mail. Nada disso é o contato do contador.
 */
const axios = require('axios');

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.displayName', 'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
  'places.websiteUri', 'places.businessStatus', 'places.formattedAddress',
].join(',');

// Scrape leve do site — grátis. Além da home, SEGUE uma página "Sobre/Serviços"
// (e "Contato" se faltar e-mail) pra montar um resumo rico do que a empresa faz.
// Limites de segurança: mesmo domínio, no máx. 3 páginas, timeouts curtos.
const UA = 'Mozilla/5.0 (compatible; HunterBot/3)';
const GET_OPTS = { timeout: 9000, maxContentLength: 3_000_000, maxRedirects: 3, headers: { 'User-Agent': UA } };
const PALAVRAS_SOBRE = ['sobre', 'quem-somos', 'quem somos', 'institucional', 'a-empresa', 'a empresa',
  'nossa-historia', 'nossa historia', 'historia', 'o-que-fazemos', 'servico', 'servicos', 'produto',
  'solucao', 'solucoes', 'about'];
const PALAVRAS_CONTATO = ['contato', 'fale-conosco', 'fale conosco', 'contact'];

const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function limpar(s) {
  return s.replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#3[49];|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function metaDescricao(html) {
  const m = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']{20,400})["']/i)
    || html.match(/<meta[^>]+content=["']([^"']{20,400})["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
  return m ? limpar(m[1]).slice(0, 400) : null;
}
function paragrafos(html, max) {
  const semRuido = html.replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ');
  const out = [];
  for (const m of semRuido.matchAll(/<(?:p|h1|h2|li)[^>]*>([\s\S]*?)<\/(?:p|h1|h2|li)>/gi)) {
    const t = limpar(m[1]);
    if (t.length >= 40 && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
function titulo(html) { const m = html.match(/<title>([^<]{5,150})<\/title>/i); return m ? limpar(m[1]) : null; }

// Monta um resumo (meta description + parágrafos relevantes, sem duplicar).
function resumoDe(html, maxParag) {
  const partes = [metaDescricao(html), ...paragrafos(html, maxParag)].filter(Boolean);
  const uniq = [];
  for (const p of partes) if (!uniq.some(u => u.includes(p) || p.includes(u))) uniq.push(p);
  return uniq.join(' ').trim() || titulo(html) || null;
}

function extrairEmailDe(html) {
  const achados = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return achados.find(e => !/(example|sentry|wixpress|godaddy|\.png|\.jpg|\.gif|\.webp|@2x)/i.test(e)) || null;
}

// Links internos (mesmo domínio) cujo texto ou caminho batem com as palavras.
function acharLinks(html, baseUrl, palavras) {
  let host; try { host = new URL(baseUrl).host; } catch { return []; }
  const out = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;
    let abs; try { abs = new URL(href, baseUrl); } catch { continue; }
    if (abs.host !== host) continue;
    if (/\.(pdf|jpe?g|png|gif|webp|zip|mp4|docx?|xlsx?)$/i.test(abs.pathname)) continue;
    let alvo; try { alvo = semAcento((limpar(m[2]) + ' ' + decodeURIComponent(abs.pathname)).toLowerCase()); } catch { continue; }
    if (palavras.some(p => alvo.includes(p))) {
      const u = abs.href.split('#')[0];
      if (u !== baseUrl && !out.includes(u)) out.push(u);
    }
  }
  return out;
}

async function baixar(url) {
  try { const { data } = await axios.get(url, GET_OPTS); return typeof data === 'string' ? data : ''; }
  catch (_) { return ''; }
}

// Telefone brasileiro no texto (com DDD entre parênteses pra evitar falso positivo).
function extrairTelefoneDe(html) {
  const txt = html.replace(/<[^>]+>/g, ' ');
  const m = txt.match(/\(\d{2}\)\s?9?\d{4}[-\s]?\d{4}/);
  return m ? m[0].replace(/\D/g, '') : null;
}

async function scrapeSite(site) {
  const home = await baixar(site);
  if (!home) return { email: null, resumo: null, telefone: null };

  let email = extrairEmailDe(home);
  let telefone = extrairTelefoneDe(home);
  const partes = [resumoDe(home, 2)].filter(Boolean);
  let fonte = 'home';
  const lidas = new Set([site]);

  // 1) Segue UMA página institucional/serviços pra enriquecer o resumo.
  const sobre = acharLinks(home, site, PALAVRAS_SOBRE).find(u => !lidas.has(u));
  if (sobre) {
    const h = await baixar(sobre); lidas.add(sobre);
    const r = resumoDe(h, 4);
    if (r && r.length >= 60) { partes.push(r); fonte = 'sobre'; }
    if (!email) email = extrairEmailDe(h);
    if (!telefone) telefone = extrairTelefoneDe(h);
  }

  // 2) Se ainda faltar e-mail/telefone, tenta a página de contato.
  if (!email || !telefone) {
    const contato = acharLinks(home, site, PALAVRAS_CONTATO).find(u => !lidas.has(u));
    if (contato) { const h = await baixar(contato); lidas.add(contato); email = email || extrairEmailDe(h); telefone = telefone || extrairTelefoneDe(h); }
  }

  // Combina/dedupe num resumo único e limitado.
  const uniq = [];
  for (const p of partes) if (p && !uniq.some(u => u.includes(p) || p.includes(u))) uniq.push(p);
  const resumo = (uniq.join(' ').slice(0, 600).trim()) || null;
  return { email, telefone, resumo, resumo_fonte: fonte, paginas_lidas: lidas.size };
}

// ── Fallback GRÁTIS: acha o site oficial via busca web sem chave (DuckDuckGo) ──
const UA_NAV = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
// Domínios que NÃO são o site da empresa (redes sociais, diretórios, agregadores).
// Checagem por HOSTNAME (não substring) pra não pegar "fisiox.com" por causa de "x.com".
const HOSTS_BLOQ = ['duckduckgo.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com',
  'x.com', 'youtube.com', 'wikipedia.org', 'google.com', 'google.com.br', 'bing.com', 'guiamais.com.br',
  'apontador.com.br', 'econodata.com.br', 'casadosdados.com.br', 'cnpja.com', 'cnpj.biz', 'jusbrasil.com.br',
  'reclameaqui.com.br', 'indeed.com', 'glassdoor.com', 'mercadolivre.com.br', 'olx.com.br', 'tripadvisor.com',
  'tripadvisor.com.br', 'ifood.com.br', 'yelp.com', 'telelistas.net', 'solutudo.com.br'];
function hostBloqueado(u) {
  let host; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch { return true; }
  return HOSTS_BLOQ.some(d => host === d || host.endsWith('.' + d));
}

async function acharSite(nome, cidade, uf) {
  const q = encodeURIComponent([nome, cidade, uf].filter(Boolean).join(' '));
  let html = '';
  try {
    const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${q}`, {
      timeout: 9000, maxContentLength: 3_000_000, maxRedirects: 3,
      headers: { 'User-Agent': UA_NAV, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    html = typeof data === 'string' ? data : '';
  } catch (_) { return null; }

  for (const m of html.matchAll(/href="((?:https?:\/\/|\/l\/\?uddg=)[^"]+)"/gi)) {
    let u = m[1];
    if (u.startsWith('/l/?uddg=')) { try { u = decodeURIComponent(u.match(/uddg=([^&]+)/)[1]); } catch { continue; } }
    if (hostBloqueado(u)) continue;
    try { return new URL(u).origin; } catch { continue; }   // raiz do domínio
  }
  return null;
}

// Contato comercial SEM chave paga: acha o site (busca grátis) e faz o scrape rico.
async function buscarContatoGratis(nome, cidade, uf) {
  const agora = new Date().toISOString();
  const site = await acharSite(nome, cidade, uf);
  if (!site) return { encontrado: false, fonte: 'busca_gratis', validado: false, validado_em: agora };
  const s = await scrapeSite(site);
  return {
    encontrado: true,
    telefone: s.telefone || null,
    whatsapp: s.telefone || null,
    website: site,
    email: s.email || null,
    resumo_site: s.resumo || null,
    resumo_fonte: s.resumo_fonte || null,
    fonte: 'busca_gratis',
    validado: !!(s.email || s.telefone || s.resumo),
    validado_em: agora,
  };
}

// Busca o contato comercial da empresa no Google. Retorna também business_status
// (OPERATIONAL / CLOSED_*) como reforço — mas a fonte de "ativa" é a Receita.
async function buscarContato(nome, cidade, uf, apiKey) {
  if (!apiKey) throw new Error('Google: chave obrigatória (configure em Integrações).');
  const textQuery = [nome, cidade, uf].filter(Boolean).join(' ');
  let data;
  try {
    ({ data } = await axios.post(PLACES_URL,
      { textQuery, regionCode: 'BR', maxResultCount: 1, languageCode: 'pt-BR' },
      { headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK }, timeout: 15000 }
    ));
  } catch (err) {
    if (err.response) {
      const s = err.response.status;
      const msg = err.response.data?.error?.message || JSON.stringify(err.response.data).slice(0, 160);
      if (s === 403) throw new Error(`Google: chave sem permissão/Places API não ativada (${msg})`);
      throw new Error(`Google HTTP ${s}: ${msg}`);
    }
    throw new Error(`Google: ${err.message}`);
  }

  const p = data?.places?.[0];
  if (!p) return { encontrado: false, fonte: 'google', validado: false, validado_em: new Date().toISOString() };

  const telefone = (p.nationalPhoneNumber || p.internationalPhoneNumber || '').replace(/\D/g, '');
  const website = p.websiteUri || null;
  const s = website ? await scrapeSite(website) : { email: null, resumo: null, resumo_fonte: null, paginas_lidas: 0 };
  const { email, resumo } = s;

  return {
    encontrado: true,
    telefone: telefone || null,
    whatsapp: telefone || null,   // no BR, o telefone comercial costuma ser o WhatsApp
    website,
    email,
    resumo_site: resumo,   // contexto real da empresa, pro agente SWOT — grátis (mesmo scrape do e-mail)
    resumo_fonte: s.resumo_fonte,   // 'home' | 'sobre' (de onde saiu o resumo)
    business_status: p.businessStatus || null,
    nome_google: p.displayName?.text || null,
    fonte: 'google',
    validado: !!(telefone || email),
    validado_em: new Date().toISOString(),
  };
}

module.exports = { buscarContato, buscarContatoGratis };
