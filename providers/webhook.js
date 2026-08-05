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

// Telefone BR no formato que o CRM/WhatsApp espera: só dígitos, sempre com o
// DDI 55. As fontes de contato variam (site, Places, digitação manual) e nem
// todas trazem o país, então padronizamos aqui.
//   1136544306    (10 = fixo)   -> 551136544306
//   11987654321   (11 = celular)-> 5511987654321
//   551136544306  (já com 55)   -> mantém
// Fora desses casos (internacional, número quebrado), devolve os dígitos como
// vieram em vez de inventar um DDI errado.
function normalizarTelefoneBR(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10 || d.length === 11) return '55' + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return d;
}

// Monta o payload a partir da empresa + lead. NÃO inclui o contato bruto da
// Receita (é do contador) — o contato validado do decisor entra na fase de
// validação de contato.
// `crm`: dados da conexão do CRM (URL, token, fila) pra quem recebe o webhook
// — tipicamente um n8n — conseguir criar o contato/ticket direto na API.
function montarPayload(empresa, lead, busca, ref, crm) {
  const e = empresa || {};
  return {
    evento: 'lead.pronto',
    enviado_em: new Date().toISOString(),
    hunter_lead_id: lead?.id,
    // Devolva este hunter_ref quando o lead converter — o Hunter identifica o
    // lead na própria base e o adiciona à lista de semelhantes.
    hunter_ref: ref || lead?.crm_ref || null,
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
    // telefone/whatsapp saem sempre com DDI 55 (o resto do objeto é preservado).
    contato_validado: lead?.contato_validado ? {
      ...lead.contato_validado,
      telefone: normalizarTelefoneBR(lead.contato_validado.telefone),
      whatsapp: normalizarTelefoneBR(lead.contato_validado.whatsapp || lead.contato_validado.telefone),
    } : null,
    swot: lead?.swot || null,
    busca: busca ? { id: busca.id, nome: busca.nome } : null,
    // Conexão do CRM de destino: quem recebe (n8n) usa pra abrir o ticket.
    // fila_id já respeita a fila configurada no radar, caindo na padrão quando
    // o radar não define uma.
    crm: crm ? {
      url: crm.url || null,
      token: crm.token || null,
      fila_id: crm.fila_id || null,
      empresa_id: crm.empresa_id || null,
    } : null,
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

module.exports = { enviar, montarPayload, normalizarTelefoneBR };
