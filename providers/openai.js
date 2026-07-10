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

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODELO_PADRAO = 'gpt-4o-mini';

const SYSTEM = `Você é um analista de inteligência comercial B2B brasileiro. A partir dos dados de
uma empresa-alvo (firmografia da Receita, por que ela deu match no perfil buscado, e o que o site
dela diz sobre si) e do que NÓS vendemos, produz um briefing ANALÍTICO para o closer conhecer essa
empresa antes de abordá-la. Regras:
(1) Você entrega DADOS E ANÁLISE, não uma mensagem pronta. Nada de frases de abertura ou roteiro de
    conversa — isso é formulado depois, no CRM. Seu papel é técnico: organizar o que se sabe.
(2) O SWOT é sob a ÓTICA DA NOSSA VENDA: "oportunidades" e "ameaças" tratam de onde a nossa solução
    encaixa (ou o que atrapalha o fechamento), não macroeconomia genérica.
(3) NÃO invente fatos que os dados não sustentam. Se a base for rala, trabalhe com o provável e não
    afirme como certo. Prefira "provavelmente/tende a" a inventar números ou clientes.
(4) Seja concreto e ESPECÍFICO desta empresa (use o texto do site e o motivo do match quando houver);
    evite frases de efeito.
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
    `\nProduza o briefing no formato JSON (todas as listas com 2 a 4 itens curtos):
{
  "resumo": "2-3 frases: o que a empresa faz (use o que o site diz, se houver), porte, maturidade e por que ela deu match",
  "dores_provaveis": ["dores/desafios que uma empresa deste tipo provavelmente enfrenta e que o que vendemos ajuda a resolver"],
  "swot": {
    "forcas": ["forças da empresa relevantes pra decisão de compra"],
    "fraquezas": ["fraquezas/lacunas que a nossa solução endereça"],
    "oportunidades": ["onde a nossa solução gera ganho concreto pra ela"],
    "ameacas": ["objeções ou obstáculos prováveis ao fechamento (ex.: já ter fornecedor, orçamento, momento)"]
  },
  "sinal_comercial": "1-2 frases: o dado/contexto mais relevante pra CONHECER antes de abordar (timing, maturidade, característica que muda a abordagem) — um INSIGHT, não uma frase para dizer ao cliente"
}`;
}

// Gera o briefing SWOT. Retorna objeto já parseado (ou lança em erro de API).
async function gerarSwot(empresa, { apiKey, modelo, contexto, perfilEmpresa } = {}) {
  if (!apiKey) throw new Error('OpenAI: chave obrigatória (configure em Integrações → Inteligência).');
  const body = {
    model: modelo || MODELO_PADRAO,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: montarPrompt(empresa, contexto, perfilEmpresa) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 900,
  };
  const arr = v => Array.isArray(v) ? v.filter(Boolean).map(x => String(x)) : (v ? [String(v)] : []);
  try {
    const { data } = await axios.post(API_URL, body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    const txt = data?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(txt);
    return {
      resumo: parsed.resumo || '',
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
      throw new Error(`OpenAI HTTP ${err.response.status}: ${msg}`);
    }
    throw new Error(`OpenAI: ${err.message}`);
  }
}

// Mapeia uma descrição em linguagem natural do público-alvo para os códigos CNAE
// mais adequados. O modelo escolhe SOMENTE da lista fornecida (nada de inventar);
// validamos os retornos contra o catálogo real de qualquer forma.
const SYS_CNAE = `Você é um especialista na CNAE (Classificação Nacional de Atividades Econômicas) do Brasil.
Recebe uma descrição em linguagem natural do tipo de empresa que o usuário quer prospectar e a lista
oficial de subclasses CNAE (código e descrição). Devolve os códigos MAIS ADEQUados, do mais relevante
para o menos. Use SOMENTE códigos que existem na lista. Responda SOMENTE com JSON válido.`;

async function sugerirCnae(texto, catalogo, { apiKey, modelo, max = 8 } = {}) {
  if (!apiKey) throw new Error('OpenAI: chave obrigatória (Integrações → Inteligência).');
  if (!texto || !texto.trim()) return [];
  const valido = new Map((catalogo || []).map(x => [String(x.c), x.d]));
  const lista = (catalogo || []).map(x => `${x.c}\t${x.d}`).join('\n');

  const body = {
    model: modelo || MODELO_PADRAO,
    messages: [
      { role: 'system', content: SYS_CNAE },
      { role: 'user', content:
        `Empresa/público que quero prospectar:\n"${texto.trim()}"\n\n` +
        `Escolha até ${max} códigos CNAE da lista abaixo (formato "codigo<tab>descricao"):\n${lista}\n\n` +
        `Responda no formato JSON: { "codigos": ["7500100", "..."] } — só os códigos, do mais relevante ao menos.` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 200,
  };
  try {
    const { data } = await axios.post(API_URL, body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
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
      throw new Error(`OpenAI HTTP ${err.response.status}: ${msg}`);
    }
    throw new Error(`OpenAI: ${err.message}`);
  }
}

module.exports = { gerarSwot, sugerirCnae, MODELO_PADRAO };
