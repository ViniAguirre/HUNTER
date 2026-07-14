'use strict';
/*
 * Hunter — validação de contato via Google (Places API New).
 * A empresa já veio ATIVA da CNPJá. Aqui buscamos o perfil do Google Meu
 * Negócio (por razão/fantasia + cidade/UF) pra pegar o CONTATO COMERCIAL real:
 * telefone/WhatsApp e o site. O e-mail sai de um scrape leve do site (grátis) —
 * o Google não expõe e-mail. Nada disso é o contato do contador.
 */
const axios = require('axios');
const tavily = require('./tavily');

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

// Domínio de governo/institucional (prefeitura, tribunal, etc.) — NUNCA é o site
// comercial de uma empresa B2B. Cobre .gov.br, .go.gov.br (municipal), .jus.br,
// .leg.br, .mil.br e .gov estrangeiro.
function dominioInstitucional(host) {
  const h = String(host || '').toLowerCase();
  return /\.(gov|jus|leg|mil)\.br$/.test(h) || /\.gov$/.test(h) || h === 'gov.br';
}
function emailInstitucional(email) {
  const dom = (String(email).split('@')[1] || '').toLowerCase();
  return dominioInstitucional(dom);
}

function extrairEmailDe(html) {
  const achados = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  // Descarta e-mails de imagem/placeholder E e-mails .gov/institucionais (a busca
  // é sobre EMPRESAS; contato de prefeitura/órgão público nunca é o alvo).
  return achados.find(e =>
    !/(example|sentry|wixpress|godaddy|\.png|\.jpg|\.gif|\.webp|@2x)/i.test(e) && !emailInstitucional(e)
  ) || null;
}

// Tokens distintivos do nome da empresa (sem sufixos jurídicos e termos genéricos),
// pra checar se um site achado é REALMENTE dela.
const NOME_STOP = new Set(['ltda','me','epp','eireli','mei','cia','sa','comercio','comercial','servicos',
  'servico','industria','industrias','the','and','das','dos','representacoes','distribuidora']);
function tokensNome(nome) {
  return semAcento(String(nome || '').toLowerCase()).replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(t => t.length >= 4 && !NOME_STOP.has(t));
}
function hostDe(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

// O site é DA PRÓPRIA empresa? Sinal forte: um token distintivo do nome aparece
// no DOMÍNIO (fitpurificadores.com.br, casadospurificadores.com…). Diretórios
// que listam a empresa (applocal, eguias, todosnegocios, raizlegal, encontra…)
// não têm o nome no domínio → caem fora. Exclui o nome da cidade dos tokens
// (senão "encontrasorocaba" casaria com "…de Sorocaba"). Sem token distintivo
// → não dá pra checar → lenient (não barra).
function siteDaEmpresa(nome, cidade, host) {
  const stopCidade = new Set(semAcento(String(cidade || '').toLowerCase()).split(/\s+/).filter(Boolean));
  const toks = tokensNome(nome).filter(t => !stopCidade.has(t));
  if (!toks.length) return true;
  const h = semAcento(String(host || '').toLowerCase()).replace(/[^a-z0-9]/g, '');
  return toks.some(t => h.includes(t));
}

// Página com "cara" de diretório/agregador (consulta de CNPJ, guia de empresas,
// lista telefônica…) — mesmo que cite a empresa, não é o site dela.
const DIRETORIO_FRASES = ['guia mais completo', 'lista telefonica', 'encontre empresas', 'encontre prestadores',
  'prestadores de servicos', 'consulte cnpj', 'quadros societarios', 'inteligencia de mercado',
  'cadastre sua empresa', 'cadastre seu negocio', 'todos os negocios', 'anuncie gratis', 'guia comercial',
  'guia de empresas', 'histórico de empresas', 'historico de empresas'].map(semAcento);
function pareceDiretorio(txt) {
  const t = semAcento(String(txt || '').toLowerCase());
  return DIRETORIO_FRASES.some(f => t.includes(f));
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

// CNPJ no texto do site (rodapé costuma trazer). Grátis — evita consultar a CNPJá
// só pra descobrir o CNPJ na descoberta web-first.
function extrairCnpjDe(html) {
  const txt = html.replace(/<[^>]+>/g, ' ');
  const m = txt.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  if (!m) return null;
  const d = m[0].replace(/\D/g, '');
  return d.length === 14 ? d : null;
}

async function scrapeSite(site) {
  const home = await baixar(site);
  if (!home) return { email: null, resumo: null, telefone: null, cnpj: null };

  let email = extrairEmailDe(home);
  let telefone = extrairTelefoneDe(home);
  let cnpj = extrairCnpjDe(home);
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
    if (!cnpj) cnpj = extrairCnpjDe(h);
  }

  // 2) Se ainda faltar e-mail/telefone/CNPJ, tenta a página de contato (rodapé/CNPJ costumam estar lá).
  if (!email || !telefone || !cnpj) {
    const contato = acharLinks(home, site, PALAVRAS_CONTATO).find(u => !lidas.has(u));
    if (contato) {
      const h = await baixar(contato); lidas.add(contato);
      email = email || extrairEmailDe(h); telefone = telefone || extrairTelefoneDe(h); cnpj = cnpj || extrairCnpjDe(h);
    }
  }

  // Combina/dedupe num resumo único e limitado.
  const uniq = [];
  for (const p of partes) if (p && !uniq.some(u => u.includes(p) || p.includes(u))) uniq.push(p);
  const resumo = (uniq.join(' ').slice(0, 600).trim()) || null;
  return { email, telefone, cnpj, resumo, resumo_fonte: fonte, paginas_lidas: lidas.size };
}

// ── Fallback GRÁTIS: acha o site oficial via busca web sem chave (DuckDuckGo) ──
const UA_NAV = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
// Domínios que NÃO são o site da empresa (redes sociais, diretórios, agregadores
// de CNPJ que só repetem os dados da Receita). Se um desses for pescado como
// "site da empresa", o resumo vira firmografia reciclada — inútil pro SWOT.
// Checagem por HOSTNAME (não substring) pra não pegar "fisiox.com" por causa de "x.com".
const HOSTS_BLOQ = ['duckduckgo.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com',
  'x.com', 'youtube.com', 'tiktok.com', 'wikipedia.org', 'google.com', 'google.com.br', 'bing.com',
  'guiamais.com.br', 'apontador.com.br', 'econodata.com.br', 'casadosdados.com.br', 'jusbrasil.com.br',
  'reclameaqui.com.br', 'indeed.com', 'glassdoor.com', 'mercadolivre.com.br', 'olx.com.br', 'tripadvisor.com',
  'tripadvisor.com.br', 'ifood.com.br', 'yelp.com', 'telelistas.net', 'solutudo.com.br',
  // Agregadores/diretórios de CNPJ (repetem a Receita, não são a empresa):
  'diariocidade.com', 'escavador.com', 'receitaws.com.br', 'consultasocio.com', 'informecadastral.com.br',
  'quandoconstou.com.br', 'listamais.com.br', 'econodata.com', 'empresascnpj.com', 'cnpj.biz', 'cnpja.com',
  'cnpj.info', 'cnpjs.rocks', 'consultasocios.com.br', 'guiaempresas.com.br', 'boaspraticas.com.br',
  'dadosempresas.com.br', 'empresascnpj.com.br', 'consultapublica.com.br', 'buscacnpj.info'];
function hostBloqueado(u) {
  let host; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch { return true; }
  if (HOSTS_BLOQ.some(d => host === d || host.endsWith('.' + d))) return true;
  // Heurística: domínio com "cnpj" no nome é quase sempre agregador de cadastro,
  // nunca o site comercial da empresa. Barra a classe inteira sem precisar listar.
  if (/cnpj/i.test(host)) return true;
  // Governo/institucional (prefeitura, tribunal…) nunca é o site da empresa.
  if (dominioInstitucional(host)) return true;
  return false;
}

async function buscarDDG(termo) {
  const q = encodeURIComponent(termo);
  try {
    const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${q}`, {
      timeout: 9000, maxContentLength: 3_000_000, maxRedirects: 3,
      headers: { 'User-Agent': UA_NAV, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    return typeof data === 'string' ? data : '';
  } catch (_) { return ''; }
}

// Resultados orgânicos (site + título) da busca, filtrando diretórios/redes e
// deduplicando por domínio. O título costuma trazer o nome do negócio.
function resultadosDDG(html) {
  const out = [];
  for (const m of html.matchAll(/<a[^>]+href="((?:https?:\/\/|\/l\/\?uddg=)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let u = m[1];
    if (u.startsWith('/l/?uddg=')) { try { u = decodeURIComponent(u.match(/uddg=([^&]+)/)[1]); } catch { continue; } }
    if (hostBloqueado(u)) continue;
    let origin; try { origin = new URL(u).origin; } catch { continue; }
    if (out.some(x => x.site === origin)) continue;
    out.push({ site: origin, titulo: limpar(m[2]).slice(0, 120) || null });
  }
  return out;
}

// Remove diretórios/redes e deduplica por domínio — aplicado tanto aos
// resultados da Tavily quanto aos do DDG, uniformemente.
function filtrarResultados(lista) {
  const out = [];
  for (const r of (lista || [])) {
    if (!r?.site || hostBloqueado(r.site)) continue;
    if (out.some(x => x.site === r.site)) continue;
    out.push(r);
  }
  return out;
}

// Camada de busca web unificada: usa a Tavily quando há chave (mais estável e
// já traz um trecho de conteúdo), senão cai no DuckDuckGo grátis. Retorna
// sempre [{ site, titulo, conteudo? }].
async function buscarResultados(termo, opts = {}) {
  if (opts.tavilyKey) {
    const r = filtrarResultados(await tavily.buscar(termo, { apiKey: opts.tavilyKey, max: 40 }));
    if (r.length) return r;   // Tavily vazia (ex.: rate limit) → tenta o grátis
  }
  return resultadosDDG(await buscarDDG(termo));
}

// Acha o site oficial (1º resultado) — usado no fallback de validação.
async function acharSite(nome, cidade, uf, opts = {}) {
  const r = await buscarResultados([nome, cidade, uf].filter(Boolean).join(' '), opts);
  return r.length ? r[0].site : null;
}

// Descoberta WEB-FIRST: lista negócios que aparecem na busca (como o cliente
// pesquisaria no Google) pra depois confirmar CNPJ/ativa na CNPJá.
async function buscarEmpresasWeb(termo, cidade, uf, max = 30, opts = {}) {
  const r = await buscarResultados([termo, cidade, uf].filter(Boolean).join(' '), opts);
  return r.slice(0, max);
}

// Contato comercial SEM chave paga: acha o site (busca) e faz o scrape rico.
// Se o scrape não render um resumo, usa o trecho de conteúdo da busca (Tavily)
// como reserva — dá contexto ao SWOT mesmo em sites pobres em texto.
async function buscarContatoGratis(nome, cidade, uf, opts = {}) {
  const agora = new Date().toISOString();
  const r = await buscarResultados([nome, cidade, uf].filter(Boolean).join(' '), opts);
  // Só considera resultados cujo DOMÍNIO parece ser da própria empresa — descarta
  // diretórios/agregadores que citam a empresa mas não são ela. Varre até 3
  // candidatos (o site real às vezes não é o 1º resultado).
  const candidatos = r.filter(x => siteDaEmpresa(nome, cidade, hostDe(x.site))).slice(0, 3);
  for (const cand of candidatos) {
    const s = await scrapeSite(cand.site);
    const resumo = s.resumo || cand.conteudo || null;
    // Reforço: se a página se descreve como diretório/consulta de CNPJ, pula.
    if (pareceDiretorio(resumo) || pareceDiretorio(cand.titulo)) continue;
    return {
      encontrado: true,
      telefone: s.telefone || null,
      whatsapp: s.telefone || null,
      website: cand.site,
      email: s.email || null,
      resumo_site: resumo,
      resumo_fonte: s.resumo ? s.resumo_fonte : (cand.conteudo ? 'busca' : null),
      fonte: 'busca_gratis',
      validado: !!(s.email || s.telefone || resumo),
      validado_em: agora,
    };
  }
  // Nenhum resultado parece ser o site próprio da empresa → melhor não trazer
  // dado nenhum (fica vermelho "sem contato") do que trazer contato errado.
  return { encontrado: false, fonte: 'busca_gratis', validado: false, validado_em: agora, motivo: 'sem_site_proprio' };
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
  // Descarta site institucional/gov mesmo vindo do Places (ex.: casou com a
  // prefeitura). O telefone do Places segue valendo (é do estabelecimento).
  let website = p.websiteUri || null;
  if (website) { try { if (dominioInstitucional(new URL(website).hostname.replace(/^www\./, ''))) website = null; } catch { website = null; } }
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

module.exports = { buscarContato, buscarContatoGratis, buscarEmpresasWeb, scrapeSite };
