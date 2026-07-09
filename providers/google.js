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

// Tira um resumo do que a empresa diz de si mesma: <title>, meta description e,
// na falta desses, o primeiro texto visível do body. É o que dá ao agente SWOT
// contexto REAL (o que ela vende, pra quem, tom de voz) em vez de só o CNAE.
function extrairResumoSite(html) {
  const clean = s => s.replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
  const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,400})["']/i)
    || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,400})["']/i);
  if (meta) return clean(meta[1]).slice(0, 400);

  const title = html.match(/<title>([^<]{5,150})<\/title>/i);
  const semScript = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const paragrafos = [...semScript.matchAll(/<p[^>]*>([^<]{40,400})<\/p>/gi)].map(m => clean(m[1]));
  const corpo = paragrafos.find(p => p.length >= 40);

  const partes = [title ? clean(title[1]) : null, corpo].filter(Boolean);
  return partes.length ? partes.join(' — ').slice(0, 400) : null;
}

// Scrape leve do site (fetch + regex) — grátis. Best-effort: se falhar, ignora.
// Devolve tanto o e-mail quanto um resumo do site (mesma requisição, sem custo extra).
async function scrapeSite(site) {
  try {
    const { data } = await axios.get(site, {
      timeout: 10000, maxContentLength: 3_000_000, maxRedirects: 3,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HunterBot/3)' },
    });
    const html = typeof data === 'string' ? data : '';
    const achados = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    // descarta lixo comum (assets, libs de tracking, imagens)
    const email = achados.find(e => !/(example|sentry|wixpress|godaddy|\.png|\.jpg|\.gif|\.webp|@2x)/i.test(e)) || null;
    const resumo = html ? extrairResumoSite(html) : null;
    return { email, resumo };
  } catch (_) { return { email: null, resumo: null }; }
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
  const { email, resumo } = website ? await scrapeSite(website) : { email: null, resumo: null };

  return {
    encontrado: true,
    telefone: telefone || null,
    whatsapp: telefone || null,   // no BR, o telefone comercial costuma ser o WhatsApp
    website,
    email,
    resumo_site: resumo,   // contexto real da empresa, pro agente SWOT — grátis (mesmo scrape do e-mail)
    business_status: p.businessStatus || null,
    nome_google: p.displayName?.text || null,
    fonte: 'google',
    validado: !!(telefone || email),
    validado_em: new Date().toISOString(),
  };
}

module.exports = { buscarContato };
