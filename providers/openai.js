'use strict';
/*
 * Hunter — provider OpenAI (agente SWOT, Fase 3.2).
 * Recebe a firmografia da empresa (que já temos de graça) e gera um briefing
 * SWOT + gancho de abordagem pro closer. Usa um modelo barato (gpt-4o-mini por
 * padrão, configurável) e força saída em JSON pra consumir estruturado.
 *
 * NUNCA manda pro modelo o contato bruto da Receita (é do contador) como se
 * fosse contato de venda — só a firmografia e o nome do decisor.
 */
const axios = require('axios');

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODELO_PADRAO = 'gpt-4o-mini';

const SYSTEM = `Você é um analista de inteligência comercial B2B brasileiro. Recebe os dados
cadastrais de uma empresa (firmografia da Receita Federal) e produz um briefing curto e
acionável para um closer (vendedor) abordar essa empresa. Seja concreto, evite generalidades.
Responda SEMPRE em português do Brasil e SOMENTE com um JSON válido no formato pedido.`;

function montarPrompt(empresa, contexto) {
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
  return `Empresa a analisar:\n${linhas.join('\n')}\n` +
    (ctx ? `\nContexto do que estamos vendendo / ICP:\n${ctx}\n` : '') +
    `\nProduza o briefing no formato JSON:
{
  "resumo": "2 frases: o que a empresa faz, porte e maturidade",
  "swot": {
    "forcas": ["..."],
    "fraquezas": ["..."],
    "oportunidades": ["..."],
    "ameacas": ["..."]
  },
  "gancho": "1-2 frases: por que essa empresa se beneficiaria do que vendemos"
}`;
}

// Gera o briefing SWOT. Retorna objeto já parseado (ou lança em erro de API).
async function gerarSwot(empresa, { apiKey, modelo, contexto } = {}) {
  if (!apiKey) throw new Error('OpenAI: chave obrigatória (configure em Integrações → Inteligência).');
  const body = {
    model: modelo || MODELO_PADRAO,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: montarPrompt(empresa, contexto) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 700,
  };
  try {
    const { data } = await axios.post(API_URL, body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    const txt = data?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(txt);
    return {
      resumo: parsed.resumo || '',
      swot: {
        forcas: parsed.swot?.forcas || [],
        fraquezas: parsed.swot?.fraquezas || [],
        oportunidades: parsed.swot?.oportunidades || [],
        ameacas: parsed.swot?.ameacas || [],
      },
      gancho: parsed.gancho || '',
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

module.exports = { gerarSwot, MODELO_PADRAO };
