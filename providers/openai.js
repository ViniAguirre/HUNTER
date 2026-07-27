'use strict';
/*
 * Hunter — provider OpenAI (agente SWOT, Fase 3.2).
 * Recebe a firmografia da empresa (que já temos de graça) + o motivo técnico
 * do match (breakdown do Score 1) e gera um briefing analítico pro closer.
 * Usa um modelo barato (gpt-4o-mini por padrão, configurável) e força saída
 * em JSON pra consumir estruturado.
 *
 * O Hunter é a camada TÉCNICA de inteligência — capta e organiza dado sobre o
 * lead. A formulação da mensagem de abordagem em si é papel do CRM/closer, não
 * daqui: por isso o briefing entrega SINAIS e ANÁLISE, não frases prontas pra
 * dizer ao cliente.
 *
 * NUNCA manda pro modelo o contato bruto da Receita (é do contador) como se
 * fosse contato de venda — só a firmografia e o nome do decisor.
 */
const axios = require('axios');

// Dois provedores compatíveis com a mesma API de chat completions. O OpenRouter
// roteia pra vários modelos com uma chave só; quando ativo, tem preferência —
// e se a chave dele falhar (ex.: crédito esgotado, HTTP 402), o chamador cai
// automaticamente pra OpenAI (ver jobs/swot.js).
const PROVEDORES = {
  openai:     { url: 'https://api.openai.com/v1/chat/completions',     modelo: 'gpt-4o-mini',        rotulo: 'OpenAI' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions',  modelo: 'openai/gpt-4o-mini', rotulo: 'OpenRouter' },
};
const MODELO_PADRAO = PROVEDORES.openai.modelo;

function provedorDe(nome) { return PROVEDORES[nome] || PROVEDORES.openai; }

// Só a OpenAI nativa (e modelos openai/* via OpenRouter) garantem o "JSON mode"
// (response_format). Modelos livres/de terceiros no OpenRouter podem não aceitar
// — então só enviamos response_format quando é seguro.
function suportaJsonMode(provedor, modelo) {
  return provedor === 'openai' || /^openai\//i.test(String(modelo || ''));
}

// Parser tolerante: aceita JSON puro, JSON em cerca de código (```json … ```),
// ou JSON no meio de texto. Necessário pra modelos que não têm JSON mode e às
// vezes embrulham a resposta. Lança se não achar objeto algum.
function extrairJson(txt) {
  const s = String(txt || '').trim();
  try { return JSON.parse(s); } catch (_) {}
  const semCerca = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(semCerca); } catch (_) {}
  const ini = semCerca.indexOf('{'), fim = semCerca.lastIndexOf('}');
  if (ini !== -1 && fim > ini) {
    try { return JSON.parse(semCerca.slice(ini, fim + 1)); } catch (_) {}
  }
  throw new Error('resposta da IA não veio em JSON válido');
}

const SYSTEM = `Você é um analista de inteligência comercial B2B brasileiro. A partir dos dados de
uma empresa-alvo (firmografia da Receita, por que ela deu match no perfil buscado, e o que o site
dela diz sobre si) e do que NÓS vendemos, produz um briefing para MUNICIAR o vendedor/closer com
DADOS ÚTEIS sobre a empresa antes de ele fazer o contato. Regras:
(1) Foco em FATOS ÚTEIS e ESPECÍFICOS desta empresa que ajudem na conversa: o que ela vende/faz,
    marcas/produtos que trabalha, região que atende, porte/estrutura, tempo de mercado, sinais de
    maturidade digital, diferenciais e possíveis gargalos. Extraia o máximo do texto do site.
(2) Você entrega DADOS E ANÁLISE, NÃO uma mensagem pronta nem roteiro de conversa (isso é feito no
    CRM). Nada de "diga que…", "comece com…". Entregue o que o vendedor precisa SABER, não o que dizer.
(3) O SWOT é sob a ÓTICA DA NOSSA VENDA: "oportunidades" e "ameaças" tratam de onde a nossa solução
    encaixa (ou o que atrapalha o fechamento), não macroeconomia genérica.
(4) NÃO invente. Se a base for rala (sem texto de site), diga menos e marque como provável — nunca
    invente números, clientes, marcas ou fatos. Prefira "provavelmente/tende a" a afirmar sem base.
(5) Seja CONCRETO — evite frases de efeito e generalidades que serviriam pra qualquer empresa.
Responda SEMPRE em português do Brasil e SOMENTE com um JSON válido no formato pedido.`;

function montarPrompt(empresa, contexto, perfilEmpresa) {
  const e = empresa || {};
  const linhas = [
    `Razão social: ${e.razao || '—'}`,
    `Nome fantasia: ${e.fantasia || '—'}`,
    `Atividade (CNAE): ${e.setor || '—'} (${e.cnae || '—'})`,
    `Porte: ${e.porte || '—'}`,
    `Capital social: ${e.capital || '—'}`,
    `Data de abertura: ${e.abertura || '—'}`,
    `Cidade/UF: ${e.cidade || '—'}/${e.uf || '—'}`,
    `Situação: ${e.situacao || '—'}`,
    `Natureza jurídica: ${e.natureza_juridica || '—'}`,
    `Optante pelo Simples: ${e.opcao_simples == null ? '—' : (e.opcao_simples ? 'Sim' : 'Não')}`,
    `Decisor (sócio/administrador): ${e.decisor || '—'} (${e.cargo || '—'})`,
  ];
  const ctx = (contexto || '').trim();
  // Resumo do PRÓPRIO SITE da empresa (validado como contato comercial, não do
  // contador) — dá ao modelo algo concreto sobre o que ela realmente faz/vende,
  // em vez de inferir só pelo código CNAE.
  const resumoSite = (perfilEmpresa?.resumoSite || '').trim();
  // Motivo TÉCNICO do match (breakdown do Score 1) — fundamenta a análise em
  // por que ESSA empresa, especificamente, entrou nesta busca.
  const breakdown = Array.isArray(perfilEmpresa?.breakdown) ? perfilEmpresa.breakdown : [];
  const motivoMatch = breakdown.length
    ? breakdown.map(b => `${b.item}${b.pts != null ? ` (+${b.pts}pts)` : ''}`).join('; ')
    : '';
  return `Empresa a analisar:\n${linhas.join('\n')}\n` +
    (motivoMatch ? `\nPor que essa empresa deu match no perfil buscado (Score ${perfilEmpresa?.score ?? '—'}/100):\n${motivoMatch}\n` : '') +
    (resumoSite ? `\nO que o site oficial da empresa diz sobre ela mesma:\n"${resumoSite}"\n` : '') +
    (ctx ? `\nContexto do que estamos vendendo / ICP:\n${ctx}\n` : '') +
    `\nProduza o briefing no formato JSON (listas com 2 a 4 itens curtos e específicos):
{
  "resumo": "2-3 frases CONCRETAS: o que a empresa faz/vende (use o texto do site), região que atende, porte, tempo de mercado e por que deu match. Nada genérico.",
  "fatos_uteis": ["fatos ESPECÍFICOS desta empresa que o vendedor pode usar na conversa: marcas/produtos que trabalha, serviços, área de atuação, diferencial, canais, sinais do site. Só o que os dados sustentam."],
  "dores_provaveis": ["dores/desafios prováveis dessa empresa que o que NÓS vendemos ajuda a resolver"],
  "swot": {
    "forcas": ["forças relevantes pra decisão de compra"],
    "fraquezas": ["fraquezas/lacunas que a nossa solução endereça"],
    "oportunidades": ["onde a nossa solução gera ganho concreto pra ela"],
    "ameacas": ["objeções/obstáculos prováveis ao fechamento (já ter fornecedor, orçamento, momento)"]
  },
  "sinal_comercial": "1-2 frases: o dado/contexto mais relevante pra CONHECER antes de abordar (timing, maturidade, característica que muda a abordagem) — um INSIGHT, não uma frase pra dizer ao cliente"
}`;
}

// Gera o briefing SWOT. Retorna objeto já parseado (ou lança em erro de API).
// `provedor`: 'openai' (padrão) ou 'openrouter' — mesma API, endpoint diferente.
async function gerarSwot(empresa, { apiKey, modelo, contexto, perfilEmpresa, provedor, instrucoesCliente } = {}) {
  const prov = provedorDe(provedor);
  if (!apiKey) throw new Error(`${prov.rotulo}: chave obrigatória (configure em Integrações → Inteligência).`);
  // Personalização do cliente (tela "Agente SWOT", só master): entra COMO
  // COMPLEMENTO ao treinamento técnico base, sem poder violar as regras acima.
  const extra = (instrucoesCliente || '').trim();
  const systemContent = extra
    ? `${SYSTEM}\n\nPersonalização deste cliente (respeite, desde que NÃO contrarie as regras acima nem invente dados):\n${extra}`
    : SYSTEM;
  const body = {
    model: modelo || prov.modelo,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: montarPrompt(empresa, contexto, perfilEmpresa) },
    ],
    temperature: 0.4,
    max_tokens: 900,
  };
  if (suportaJsonMode(provedor, body.model)) body.response_format = { type: 'json_object' };
  const arr = v => Array.isArray(v) ? v.filter(Boolean).map(x => String(x)) : (v ? [String(v)] : []);
  try {
    const { data } = await axios.post(prov.url, body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    const txt = data?.choices?.[0]?.message?.content || '{}';
    const parsed = extrairJson(txt);
    return {
      resumo: parsed.resumo || '',
      fatos_uteis: arr(parsed.fatos_uteis),
      dores_provaveis: arr(parsed.dores_provaveis),
      swot: {
        forcas: arr(parsed.swot?.forcas),
        fraquezas: arr(parsed.swot?.fraquezas),
        oportunidades: arr(parsed.swot?.oportunidades),
        ameacas: arr(parsed.swot?.ameacas),
      },
      sinal_comercial: parsed.sinal_comercial || '',
      baseado_em_site: !!perfilEmpresa?.resumoSite,
      baseado_em_match: !!(perfilEmpresa?.breakdown && perfilEmpresa.breakdown.length),
      modelo: body.model,
      gerado_em: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const msg = err.response.data?.error?.message || JSON.stringify(err.response.data).slice(0, 200);
      const e = new Error(`${prov.rotulo} HTTP ${err.response.status}: ${msg}`);
      // 402 = crédito esgotado (OpenRouter) / 401 = chave inválida / 429 = rate
      // limit — todos justificam tentar o próximo provedor da fila.
      e.status = err.response.status;
      throw e;
    }
    throw new Error(`${prov.rotulo}: ${err.message}`);
  }
}

// Mapeia uma descrição em linguagem natural do público-alvo para os códigos CNAE
// mais adequados. O modelo escolhe SOMENTE da lista fornecida (nada de inventar);
// validamos os retornos contra o catálogo real de qualquer forma.
const SYS_CNAE = `Você é um especialista na CNAE (Classificação Nacional de Atividades Econômicas) do Brasil.
Recebe uma descrição em linguagem natural do tipo de empresa que o usuário quer prospectar e a lista
oficial de subclasses CNAE (código e descrição). Devolve os códigos MAIS ADEQUados, do mais relevante
para o menos. Use SOMENTE códigos que existem na lista. Responda SOMENTE com JSON válido.`;

async function sugerirCnae(texto, catalogo, { apiKey, modelo, max = 8, provedor } = {}) {
  const prov = provedorDe(provedor);
  if (!apiKey) throw new Error(`${prov.rotulo}: chave obrigatória (Integrações → Inteligência).`);
  if (!texto || !texto.trim()) return [];
  const valido = new Map((catalogo || []).map(x => [String(x.c), x.d]));
  const lista = (catalogo || []).map(x => `${x.c}\t${x.d}`).join('\n');

  const body = {
    model: modelo || prov.modelo,
    messages: [
      { role: 'system', content: SYS_CNAE },
      { role: 'user', content:
        `Empresa/público que quero prospectar:\n"${texto.trim()}"\n\n` +
        `Escolha até ${max} códigos CNAE da lista abaixo (formato "codigo<tab>descricao"):\n${lista}\n\n` +
        `Responda no formato JSON: { "codigos": ["7500100", "..."] } — só os códigos, do mais relevante ao menos.` },
    ],
    temperature: 0.1,
    max_tokens: 200,
  };
  if (suportaJsonMode(provedor, body.model)) body.response_format = { type: 'json_object' };
  try {
    const { data } = await axios.post(prov.url, body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    const parsed = extrairJson(data?.choices?.[0]?.message?.content || '{}');
    const codigos = Array.isArray(parsed.codigos) ? parsed.codigos : [];
    const out = [];
    for (const raw of codigos) {
      const c = String(raw).replace(/\D/g, '');
      if (valido.has(c) && !out.find(x => x.c === c)) out.push({ c, d: valido.get(c) });
      if (out.length >= max) break;
    }
    return out;
  } catch (err) {
    if (err.response) {
      const msg = err.response.data?.error?.message || JSON.stringify(err.response.data).slice(0, 200);
      const e = new Error(`${prov.rotulo} HTTP ${err.response.status}: ${msg}`);
      e.status = err.response.status;
      throw e;
    }
    throw new Error(`${prov.rotulo}: ${err.message}`);
  }
}

// Lista as integrações de IA ativas, na ordem de preferência do sistema:
// OpenRouter primeiro (quando ligado), depois OpenAI. O chamador tenta na
// ordem e cai pro próximo se a chave falhar (crédito esgotado, rate limit...).
async function integracoesIA(pool) {
  const { rows } = await pool.query(
    `SELECT provedor, key_cifrada, config FROM integracoes
     WHERE categoria='ia' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
     ORDER BY CASE provedor WHEN 'openrouter' THEN 0 ELSE 1 END, ordem`
  );
  return rows;
}

module.exports = { gerarSwot, sugerirCnae, integracoesIA, MODELO_PADRAO };
