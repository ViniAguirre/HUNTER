'use strict';
/*
 * Hunter — provider de webhook de saída (integração CRM, Fase CRM).
 * Envia o lead pronto (empresa + decisor + score + briefing SWOT) para uma URL
 * de webhook configurável. Universal: funciona com qualquer CRM que receba
 * webhook, direto ou via n8n/Zapier/Make.
 *
 * Assinatura opcional: se houver segredo, manda um header X-Hunter-Signature
 * com HMAC-SHA256 do corpo, pra o destino validar a origem.
 */
const axios = require('axios');
const crypto = require('crypto');

// Monta o payload a partir da empresa + lead. NÃO inclui o contato bruto da
// Receita (é do contador) — o contato validado do decisor entra na fase de
// validação de contato.
function montarPayload(empresa, lead, busca) {
  const e = empresa || {};
  return {
    evento: 'lead.pronto',
    enviado_em: new Date().toISOString(),
    hunter_lead_id: lead?.id,
    score: lead?.score ?? null,
    empresa: {
      cnpj: e.cnpj,
      razao: e.razao,
      fantasia: e.fantasia,
      cnae: e.cnae,
      setor: e.setor,
      porte: e.porte,
      capital: e.capital,
      abertura: e.abertura,
      situacao: e.situacao,
      natureza_juridica: e.natureza_juridica,
      opcao_simples: e.opcao_simples,
      cidade: e.cidade,
      uf: e.uf,
      endereco: e.endereco,
    },
    decisor: { nome: e.decisor || null, cargo: e.cargo || null },
    swot: lead?.swot || null,
    busca: busca ? { id: busca.id, nome: busca.nome } : null,
  };
}

async function enviar(url, payload, secret) {
  if (!url) throw new Error('Webhook: URL não configurada (Integrações → CRM via Webhook).');
  const corpo = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Hunter/3' };
  if (secret) {
    headers['X-Hunter-Signature'] = 'sha256=' +
      crypto.createHmac('sha256', secret).update(corpo).digest('hex');
  }
  try {
    const { status } = await axios.post(url, corpo, { headers, timeout: 15000 });
    return { ok: true, status };
  } catch (err) {
    if (err.response) {
      throw new Error(`Webhook HTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 160)}`);
    }
    throw new Error(`Webhook: ${err.message}`);
  }
}

module.exports = { enviar, montarPayload };
