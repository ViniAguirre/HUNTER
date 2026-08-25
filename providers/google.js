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
const searxng = require('./searxng');

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

// Como a PÁGINA se apresenta: título, descrição e os H1. É onde um site diz o
// próprio nome. Deliberadamente NÃO é o corpo do texto — um diretório cita o
// nome de centenas de empresas no meio da página, mas o título dele é o nome do
// diretório. Por isso a conferência de identidade olha só aqui.
function identidadeDa(html) {
  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => limpar(m[1])).slice(0, 3);
  return [titulo(html), metaDescricao(html), ...h1].filter(Boolean).join(' ').slice(0, 400) || null;
}

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
// pra checar se um site achado é REALMENTE dela. Aceita a partir de 3 letras:
// muita empresa é uma sigla ("AWJ Comércio de Purificadores"), e ignorar a sigla
// deixava o nome SEM token nenhum — que era justamente o buraco por onde entrava
// site de terceiro.
const NOME_STOP = new Set(['ltda','me','epp','eireli','mei','cia','sa','comercio','comercial','servicos',
  'servico','industria','industrias','the','and','das','dos','representacoes','distribuidora']);
function palavrasDoNome(nome) {
  return semAcento(String(nome || '').toLowerCase()).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}
function tokensNome(nome) {
  // Puro dígito fora: MEI carrega o CNPJ no nome ("60.114.929 ALEX MORAES"), e
  // número solto casa com qualquer coisa por acaso.
  const toks = palavrasDoNome(nome).filter(t => t.length >= 3 && !NOME_STOP.has(t) && !/^\d+$/.test(t));
  return [...new Set(toks)];
}
// Siglas de 2 letras ("SG" Refrigeração, "FC" Filtro, "CL" Refrigeração). Curtas
// demais pra casar por substring sem dar falso positivo, mas são justamente o que
// identifica a empresa quando o resto do nome é a palavra do ramo. Entram só como
// CONFERÊNCIA: se a sigla não está no domínio, o nome não casou por inteiro.
function siglasDoNome(nome) {
  return [...new Set(palavrasDoNome(nome).filter(t => t.length === 2 && /^[a-z]{2}$/.test(t) && !NOME_STOP.has(t)))];
}
function hostDe(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

// Só o "miolo" do domínio, sem sufixo público: purificadores-brasil.com.br →
// "purificadoresbrasil". É contra esse miolo que se mede quanto do domínio o
// nome da empresa realmente explica.
const SUFIXO_PUB = /^(com|net|org|gov|edu|ind|adv|eng|med|art|agr|esp|tur|br|io|co|app|dev|me|info|biz|tv|shop|store|site|online|xyz|pt|us)$/;
function hostBase(host) {
  const partes = String(host || '').toLowerCase().replace(/^www\./, '').split('.');
  while (partes.length > 1 && SUFIXO_PUB.test(partes[partes.length - 1])) partes.pop();
  return semAcento(partes.join('')).replace(/[^a-z0-9]/g, '');
}

// Quão forte é a evidência de que `host` é o site DA empresa `nome`?
// Bastava UM token aparecer como substring — e isso trazia empresa errada o tempo
// todo: "Paiva E Paiva" casava com paivaadvogados.com.br, "J. K. Aparelhos" com
// aparelhosauditivos.com.br, "D P Maia" com maiaconstrutora.com.br. Um pedaço do
// nome dentro de um domínio grande NÃO é a empresa; é coincidência.
//
// Três provas, qualquer uma basta:
//   1. 2+ tokens do nome no domínio           (fit + purificadores → fitpurificadores)
//   2. o nome INTEIRO casou e explica 60%+    (kservice → kserviceone, myshop → myshopbr)
//   3. 1 token só, mas explicando 85%+        (voatec.com.br pra "Drone Voatec")
//
// A prova 2 é o que separa marca de palavra-do-ramo. "AWJ Comércio de
// Purificadores" casa "purificadores" em purificadores-brasil.com.br, mas "awj" —
// o que identifica a empresa — não está lá: nome incompleto, não passa. Já
// "Kservice" em kserviceone.com.br casou por inteiro; o que sobra do domínio é
// enfeite, não outra empresa.
//
// Sigla de 2 letras conta na prova 2 (sem somar cobertura): "SG Refrigeração" só
// tem "refrigeracao" como token, e sem exigir o "sg" ela casaria com
// sulrefrigeracao.com.br — outra empresa do mesmo ramo.
//
// A cidade NÃO é mais descartada do nome: "Araguaína Purificadores" tem a cidade
// no próprio nome, e removê-la fazia o casamento perfeito com
// araguainapurificadores.com.br ser recusado. Quem protege contra
// "encontrasorocaba" é a regra dos 2 tokens, não a exclusão.
const COBERTURA_MIN = 0.85;      // token único explicando quase todo o domínio
// Teto de tempo pra avaliar os candidatos de UM lead. Sem ele, um lead cujos
// candidatos são todos sites lentos segura o worker e a fila inteira atrás.
const PRAZO_CANDIDATOS_MS = 45000;
const COBERTURA_NOME_INTEIRO = 0.6;  // nome completo casou: régua mais folgada
const RESTO_MAX = 4;                 // letras de enfeite toleradas no domínio ("pet"+mendes)
// Casa o token no domínio tolerando plural/flexão: "eletronicos" acha
// "casadoeletronico". Devolve o tamanho do trecho que casou (0 = não casou).
function casaToken(h, t) {
  if (h.includes(t)) return t.length;
  if (t.length >= 6 && h.includes(t.slice(0, -1))) return t.length - 1;
  if (t.length >= 7 && h.includes(t.slice(0, -2))) return t.length - 2;
  return 0;
}
function forcaDominio(nome, cidade, host) {
  const toks = tokensNome(nome);
  const h = hostBase(host);
  if (!toks.length || !h) return { ok: false, casados: 0, cobertura: 0, nomeInteiro: false };
  let casados = 0, letras = 0;
  for (const t of toks) { const n = casaToken(h, t); if (n) { casados++; letras += n; } }
  const cobertura = letras / h.length;
  const naoCasados = toks.length - casados;
  const resto = h.length - letras;          // letras do domínio que o nome NÃO explica
  const siglasOk = siglasDoNome(nome).every(s => h.includes(s));
  // Nome inteiro no domínio: todo token casou E toda sigla de 2 letras aparece.
  const nomeInteiro = naoCasados === 0 && siglasOk;
  // Quase inteiro: sobrou UMA palavra do nome (quase sempre a do ramo — "Mendes
  // Serviços VETERINÁRIOS" em petmendes.com.br) e o domínio quase não tem letra
  // estranha. É o que separa "petmendes" de "girardiautopecas": lá sobram 3
  // letras de enfeite, aqui sobram 9 que são o nome de OUTRO negócio.
  const quaseInteiro = casados >= 1 && naoCasados <= 1 && siglasOk && resto <= RESTO_MAX;
  const ok = casados >= 2
    || (nomeInteiro && cobertura >= COBERTURA_NOME_INTEIRO)
    || quaseInteiro
    || (casados >= 1 && cobertura >= COBERTURA_MIN);
  return { ok, casados, cobertura, nomeInteiro, resto };
}

// O perfil devolvido pelo Places é MESMO da empresa procurada? Vale nome OU cidade:
// o Places mostra a fantasia (que pode não lembrar a razão social), e a razão
// social pode não lembrar a fantasia — mas errar as DUAS coisas ao mesmo tempo
// (nome nada a ver E cidade errada) significa que casou com outro negócio.
function confereLugar(nome, cidade, p) {
  const disp = semAcento(String(p.displayName?.text || '').toLowerCase());
  const stopCidade = new Set(semAcento(String(cidade || '').toLowerCase()).split(/\s+/).filter(Boolean));
  const toks = tokensNome(nome).filter(t => !stopCidade.has(t));
  if (toks.some(t => disp.includes(t))) return true;
  const cid = semAcento(String(cidade || '').toLowerCase()).trim();
  const end = semAcento(String(p.formattedAddress || '').toLowerCase());
  return !!cid && end.includes(cid);
}

// Página com "cara" de diretório/agregador (consulta de CNPJ, guia de empresas,
// lista telefônica…) — mesmo que cite a empresa, não é o site dela.
const DIRETORIO_FRASES = ['guia mais completo', 'lista telefonica', 'encontre empresas', 'encontre prestadores',
  'prestadores de servicos', 'consulte cnpj', 'quadros societarios', 'inteligencia de mercado',
  'cadastre sua empresa', 'cadastre seu negocio', 'todos os negocios', 'anuncie gratis', 'anuncie sua empresa',
  'guia comercial', 'guia de empresas', 'historico de empresas',
  // guias/diretórios de ramo (ex.: "O Maior Guia de Veterinários do Brasil"):
  'maior guia', 'guia de ', 'guia dos ', 'guia das ', 'guia do ', 'diretorio', 'classificados',
  'catalogo de empresas', 'lista de empresas', 'encontre os melhores', 'encontre o melhor',
  'as melhores empresas', 'melhores profissionais', 'cadastre-se gratis'].map(semAcento);
function pareceDiretorio(txt) {
  const t = semAcento(String(txt || '').toLowerCase());
  return DIRETORIO_FRASES.some(f => t.includes(f));
}

// Quantos telefones DISTINTOS a página lista. Sinal niche-agnóstico de
// diretório: um site de EMPRESA tem 1–3 telefones; um catálogo lista dezenas
// (uma empresa por linha). Não depende de bloquear domínio por palavra — assim
// uma empresa real com domínio genérico (ex.: purificadoresdeagua.com) passa.
function contarTelefones(html) {
  const txt = String(html || '').replace(/<[^>]+>/g, ' ');
  const achados = txt.match(/\(\d{2}\)\s?9?\d{4}[-\s]?\d{4}/g) || [];
  return new Set(achados.map(x => x.replace(/\D/g, ''))).size;
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

const DDD_VALIDO = n => { const d = parseInt(n.slice(0, 2), 10); return d >= 11 && d <= 99; };

// Candidatos a telefone no HTML, das formas mais confiáveis pras mais soltas:
// link tel:/DDD entre parênteses (o site marcou explicitamente OU é o formato
// BR mais comum) valem mais que dígitos soltos sem separador (mais chance de
// pegar CEP/protocolo/etc. por engano).
function candidatosTelefone(html) {
  const out = [];
  for (const m of html.matchAll(/href=["']tel:\+?55?(\d{10,11})["']/gi)) out.push({ num: m[1], forte: true });
  const txt = html.replace(/<[^>]+>/g, ' ');
  for (const m of txt.matchAll(/\(\d{2}\)\s?9?\d{4}[-\s]?\d{4}/g)) out.push({ num: m[0].replace(/\D/g, ''), forte: true });
  // DDD-NNNNN-NNNN / DDD.NNNNN.NNNN / DDD NNNNN NNNN sem parênteses.
  for (const m of txt.matchAll(/\b(\d{2})[-.\s](9\d{4})[-.\s]?(\d{4})\b/g)) out.push({ num: m[1] + m[2] + m[3], forte: false });
  for (const m of txt.matchAll(/\b(\d{2})[-.\s](\d{4})[-.\s](\d{4})\b/g)) out.push({ num: m[1] + m[2] + m[3], forte: false });
  // DDD colado (sem separador nenhum) — só o formato celular (9 na frente), o
  // fixo colado sem separador tem alto risco de casar com outra sequência numérica.
  for (const m of txt.matchAll(/\b(\d{2})(9\d{8})\b/g)) out.push({ num: m[1] + m[2], forte: false });
  return out.filter(c => DDD_VALIDO(c.num));
}

// Telefone brasileiro no texto. Prioriza candidatos "fortes" (tel:/parênteses)
// e, entre iguais, celular (11 dígitos) antes de fixo (10 dígitos).
function extrairTelefoneDe(html) {
  const cands = candidatosTelefone(html);
  if (!cands.length) return null;
  cands.sort((a, b) => (a.forte === b.forte ? b.num.length - a.num.length : (a.forte ? -1 : 1)));
  return cands[0].num;
}

// Link de WhatsApp (wa.me / api.whatsapp.com / whatsapp.com "send") — sinal MAIS
// forte que qualquer regex em texto solto: o próprio site diz que aquele número
// é o WhatsApp dele.
function extrairWhatsappDe(html) {
  const m = html.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp\.com\/send\/?\?phone=)\+?(\d{10,13})/i);
  if (!m) return null;
  let d = m[1];
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  return (d.length === 10 || d.length === 11) && DDD_VALIDO(d) ? d : null;
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

// UMA requisição: a home. É tudo que a decisão de identidade precisa — o CNPJ do
// rodapé e o título/H1 estão aqui. Separado do scrape profundo de propósito:
// avaliar um candidato custa 1 página, não 3. Guarda o HTML pra quem for
// aprofundar não ter que baixar de novo.
async function lerHome(site) {
  const home = await baixar(site);
  if (!home) return null;
  return {
    html: home,
    email: extrairEmailDe(home),
    telefone: extrairWhatsappDe(home) || extrairTelefoneDe(home),
    cnpj: extrairCnpjDe(home),
    resumo: resumoDe(home, 2),
    resumo_fonte: 'home',
    identidade: identidadeDa(home),
    qtd_telefones: contarTelefones(home),
    paginas_lidas: 1,
  };
}

// Só depois que o site FOI ACEITO como sendo da empresa: segue "sobre" e
// "contato" pra completar resumo, e-mail, telefone e CNPJ. Antes desta separação
// todo candidato pagava essas páginas, mesmo os que seriam recusados — o que
// fazia um lead sem site provável custar até 18 requisições.
async function aprofundar(site, h0) {
  const home = h0.html;
  let { email, telefone, cnpj } = h0;
  const partes = [h0.resumo].filter(Boolean);
  let fonte = 'home';
  const lidas = new Set([site]);

  const sobre = acharLinks(home, site, PALAVRAS_SOBRE).find(u => !lidas.has(u));
  if (sobre) {
    const h = await baixar(sobre); lidas.add(sobre);
    const r = resumoDe(h, 4);
    if (r && r.length >= 60) { partes.push(r); fonte = 'sobre'; }
    if (!email) email = extrairEmailDe(h);
    if (!telefone) telefone = extrairWhatsappDe(h) || extrairTelefoneDe(h);
    if (!cnpj) cnpj = extrairCnpjDe(h);
  }

  if (!email || !telefone || !cnpj) {
    const contato = acharLinks(home, site, PALAVRAS_CONTATO).find(u => !lidas.has(u));
    if (contato) {
      const h = await baixar(contato); lidas.add(contato);
      email = email || extrairEmailDe(h); telefone = telefone || extrairWhatsappDe(h) || extrairTelefoneDe(h); cnpj = cnpj || extrairCnpjDe(h);
    }
  }

  const uniq = [];
  for (const p of partes) if (p && !uniq.some(u => u.includes(p) || p.includes(u))) uniq.push(p);
  return { email, telefone, cnpj, resumo: (uniq.join(' ').slice(0, 600).trim()) || null,
    resumo_fonte: fonte, paginas_lidas: lidas.size,
    identidade: h0.identidade, qtd_telefones: h0.qtd_telefones };
}

// Scrape completo (home + sobre + contato). Mantido pra quem já usa assim.
async function scrapeSite(site) {
  const h0 = await lerHome(site);
  if (!h0) return { email: null, resumo: null, telefone: null, cnpj: null, identidade: null };
  return aprofundar(site, h0);
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

// Camada de busca web unificada. Ordem deliberada, do mais barato pro mais caro:
//   1. SearXNG  — auto-hospedado, sem cota, alcança o índice do Google;
//   2. Tavily   — API paga, estável, já traz trecho de conteúdo;
//   3. DuckDuckGo raspado — último recurso, índice pobre pra PME brasileira.
// Cada uma só é consultada se a anterior voltou vazia, então o que o SearXNG
// resolver não gasta crédito. Nenhuma delas lança: cota estourada, chave
// inválida ou container fora do ar caem pra próxima sem interromper a busca.
// Devolve { resultados, fonte } — a fonte fica gravada no lead pra dar pra medir
// qual camada está sustentando o enriquecimento.
async function buscarResultados(termo, opts = {}) {
  if (opts.searxngUrl) {
    const r = filtrarResultados(await searxng.buscar(termo, { url: opts.searxngUrl, max: 40 }));
    if (r.length) return { resultados: r, fonte: 'searxng' };
  }
  if (opts.tavilyKey) {
    const r = filtrarResultados(await tavily.buscar(termo, { apiKey: opts.tavilyKey, max: 40 }));
    if (r.length) return { resultados: r, fonte: 'tavily' };
  }
  return { resultados: resultadosDDG(await buscarDDG(termo)), fonte: 'ddg' };
}

// Acha o site oficial (1º resultado) — usado no fallback de validação.
async function acharSite(nome, cidade, uf, opts = {}) {
  const { resultados } = await buscarResultados([nome, cidade, uf].filter(Boolean).join(' '), opts);
  return resultados.length ? resultados[0].site : null;
}

// Descoberta WEB-FIRST: lista negócios que aparecem na busca (como o cliente
// pesquisaria no Google) pra depois confirmar CNPJ/ativa na CNPJá.
async function buscarEmpresasWeb(termo, cidade, uf, max = 30, opts = {}) {
  const { resultados } = await buscarResultados([termo, cidade, uf].filter(Boolean).join(' '), opts);
  return resultados.slice(0, max);
}

// DDD → UF. É a única informação de LUGAR que a busca web nos dá de graça, e
// lugar é justamente o que as provas de nome não cobrem: "Teixeira Refrigeração"
// existe em BH e em São Paulo, e o domínio não distingue as duas.
const DDD_UF = {
  11:'SP',12:'SP',13:'SP',14:'SP',15:'SP',16:'SP',17:'SP',18:'SP',19:'SP',
  21:'RJ',22:'RJ',24:'RJ',27:'ES',28:'ES',
  31:'MG',32:'MG',33:'MG',34:'MG',35:'MG',37:'MG',38:'MG',
  41:'PR',42:'PR',43:'PR',44:'PR',45:'PR',46:'PR',
  47:'SC',48:'SC',49:'SC',51:'RS',53:'RS',54:'RS',55:'RS',
  61:'DF',62:'GO',64:'GO',63:'TO',65:'MT',66:'MT',67:'MS',
  68:'AC',69:'RO',71:'BA',73:'BA',74:'BA',75:'BA',77:'BA',
  79:'SE',81:'PE',87:'PE',82:'AL',83:'PB',84:'RN',85:'CE',88:'CE',
  86:'PI',89:'PI',91:'PA',93:'PA',94:'PA',92:'AM',97:'AM',95:'RR',96:'AP',98:'MA',99:'MA',
};
// O telefone achado no site DESMENTE a UF da empresa? Só responde `true` quando
// há contradição clara — sem telefone, sem UF ou DDD desconhecido devolve false
// (na dúvida não acusa). 0800 e 4004 não têm DDD e passam batido, que é o certo:
// número nacional não diz nada sobre localização.
function telefoneDesmenteUf(telefone, uf) {
  const d = String(telefone || '').replace(/\D/g, '');
  const estado = String(uf || '').trim().toUpperCase();
  if (!estado || d.length < 10 || /^(0800|4004|4003|3003)/.test(d)) return false;
  const ufDoDdd = DDD_UF[parseInt(d.slice(0, 2), 10)];
  return !!ufDoDdd && ufDoDdd !== estado;
}

// A página se APRESENTA com o nome desta empresa? Compara os tokens do nome
// contra como o site se identifica (título + meta description + H1), nunca
// contra o corpo do texto: um guia de empresas cita o nome de quem ele lista,
// mas o título dele é o nome do guia.
// Exige TODOS os tokens distintivos — meio nome é justamente o erro que a gente
// passou o dia inteiro corrigindo. A cidade sai da conta (muito site põe a
// cidade no título, e isso não prova identidade nenhuma).
function paginaSeApresentaComo(nome, cidade, identidade) {
  if (!identidade) return false;
  const stopCidade = new Set(palavrasDoNome(cidade));
  const toks = tokensNome(nome).filter(t => !stopCidade.has(t));
  if (!toks.length) return false;
  const txt = semAcento(String(identidade).toLowerCase()).replace(/[^a-z0-9]+/g, ' ');
  return toks.every(t => casaToken(txt, t) > 0);
}

// Contato comercial SEM chave paga: acha o site (busca) e faz o scrape rico.
// Se o scrape não render um resumo, usa o trecho de conteúdo da busca (Tavily)
// como reserva — dá contexto ao SWOT mesmo em sites pobres em texto.
async function buscarContatoGratis(nome, cidade, uf, opts = {}) {
  const agora = new Date().toISOString();
  const cnpjAlvo = String(opts.cnpj || '').replace(/\D/g, '');
  const { resultados: r, fonte: fonteBusca } = await buscarResultados([nome, cidade, uf].filter(Boolean).join(' '), opts);

  // TRÊS provas independentes de que o site é DESTA empresa, qualquer uma basta:
  //   1. o domínio explica o nome (forcaDominio);
  //   2. o CNPJ impresso na página é o mesmo do lead — prova definitiva;
  //   3. a página se APRESENTA com o nome da empresa (título/descrição/H1).
  // E uma VETO: se a página mostra um CNPJ DIFERENTE, é outra empresa — descarta
  // mesmo que as outras provas passem. Sem nenhuma prova, não devolve nada.
  //
  // A prova 3 existe porque a 2 rendeu pouco na prática: quase nenhum site de PME
  // imprime CNPJ. Já o nome, quase todo site diz — mas só no título/H1 é que ele
  // diz o nome DELE. No corpo do texto um diretório cita centenas de empresas.
  // Avaliar um candidato custa UMA página (a home). Só o vencedor paga o scrape
  // profundo. Sem essa separação, um lead cujos 6 candidatos são todos de outras
  // empresas gastava até 18 requisições e travava a fila — foi o que aconteceu
  // quando o SearXNG passou a devolver resultado pra todo mundo.
  const prazo = Date.now() + PRAZO_CANDIDATOS_MS;
  const olhar = r.slice(0, 6);
  for (const cand of olhar) {
    // Teto de tempo do laço: um lead nunca pode segurar o worker indefinidamente.
    // Sai pelo que já tem em vez de arrastar a fila inteira.
    if (Date.now() > prazo) break;
    const f = forcaDominio(nome, cidade, hostDe(cand.site));
    // Sem sinal no domínio, sem CNPJ pra conferir e sem nome pra procurar: não há
    // como provar nada. Nem gasta requisição.
    if (!f.ok && !cnpjAlvo && !tokensNome(nome).length) continue;
    const h0 = await lerHome(cand.site);
    if (!h0) continue;
    const cnpjSite = String(h0.cnpj || '').replace(/\D/g, '');
    if (cnpjAlvo && cnpjSite && cnpjSite !== cnpjAlvo) continue;   // veto: site de OUTRA empresa
    const confereCnpj = !!(cnpjAlvo && cnpjSite && cnpjSite === cnpjAlvo);
    const confereNome = paginaSeApresentaComo(nome, cidade, h0.identidade);
    if (!f.ok && !confereCnpj && !confereNome) continue;            // nenhuma prova

    // Domínio curto que casa com UMA palavra do nome é evidência fraca demais
    // sozinha: "ASPEN Refrigeração" (MG) casou com aspentech.com (software
    // americano), "Teixeira Refrigeração" com teixeira.com.br. O token existe no
    // domínio e explica ele quase todo — mas é sobrenome ou palavra comum, não
    // marca. Nesses casos exige que a PÁGINA também confirme o nome. Com 2+
    // tokens no domínio a coincidência já é improvável e o domínio basta.
    if (f.ok && f.casados < 2 && !confereCnpj && !confereNome) continue;

    // O telefone do site desmente a UF do cadastro? Então é outra empresa de
    // mesmo nome noutro estado — caso clássico em nome genérico de refrigeração,
    // que se repete em toda cidade do país. O CNPJ conferido é prova definitiva e
    // passa por cima disso (empresa pode ter número de outro estado); as provas
    // de nome, não. Nenhuma delas fala de LUGAR — o DDD é a única que fala.
    if (!confereCnpj && telefoneDesmenteUf(h0.telefone, uf)) continue;

    // Descarta diretório ANTES de aprofundar: a página se descreve como guia/
    // lista/consulta de CNPJ, ou lista muitos negócios (muitos telefones
    // distintos). Ambos os sinais já estão na home — não vale ler mais páginas
    // de um catálogo pra depois jogar fora.
    if (pareceDiretorio(h0.resumo) || pareceDiretorio(cand.titulo) || (h0.qtd_telefones || 0) >= 10) continue;

    // Passou em tudo: agora sim vale ler "sobre" e "contato".
    const s = await aprofundar(cand.site, h0);
    const resumo = s.resumo || cand.conteudo || null;
    return {
      encontrado: true,
      telefone: s.telefone || null,
      whatsapp: s.telefone || null,
      website: cand.site,
      email: s.email || null,
      resumo_site: resumo,
      resumo_fonte: s.resumo ? s.resumo_fonte : (cand.conteudo ? 'busca' : null),
      fonte: 'busca_gratis',
      // Qual camada de busca achou este site (searxng/tavily/ddg) — permite ver
      // quanto cada uma sustenta sem depender de log.
      fonte_busca: fonteBusca,
      // Como o site foi conferido — aparece no lead, pro usuário saber o quanto confiar.
      site_conferido: confereCnpj ? 'cnpj' : (f.ok ? 'dominio' : 'nome'),
      validado: !!(s.email || s.telefone || resumo),
      validado_em: agora,
    };
  }
  // Nenhum resultado se PROVOU o site próprio da empresa → melhor não trazer
  // dado nenhum (fica vermelho "sem contato") do que trazer contato errado.
  return { encontrado: false, fonte: 'busca_gratis', fonte_busca: fonteBusca, validado: false,
    validado_em: agora, motivo: 'sem_site_proprio' };
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

  // O Places SEMPRE devolve o "melhor" resultado — mesmo quando não achou nada
  // parecido. Sem conferir, o telefone de um negócio qualquer virava o contato do
  // lead. Exige uma âncora: ou o nome do perfil bate com o da empresa (o Places
  // costuma mostrar a fantasia, então basta 1 token), ou o endereço é na cidade
  // certa. Nenhuma das duas → é outro negócio, e não devolvemos nada.
  if (!confereLugar(nome, cidade, p)) {
    return { encontrado: false, fonte: 'google', validado: false, validado_em: new Date().toISOString(),
      motivo: 'lugar_nao_confere', nome_google: p.displayName?.text || null };
  }

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

module.exports = { buscarContato, buscarContatoGratis, buscarEmpresasWeb, scrapeSite,
  forcaDominio, confereLugar, tokensNome, hostBase, paginaSeApresentaComo, identidadeDa,
  telefoneDesmenteUf };
