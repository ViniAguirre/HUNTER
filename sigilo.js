'use strict';
/**
 * Hunter — o que NUNCA sai do servidor: qual IA/modelo gerou o briefing e de
 * qual API/fonte veio o contato. Vale pra tela (inclusive do master), pro
 * payload do CRM e pra qualquer outra saída. Os dados ficam só nos logs e na
 * configuração (Integrações), onde as chaves são cadastradas.
 */

const CAMPOS_SWOT = ['modelo', 'provedor', 'reserva_de'];
const CAMPOS_CONTATO = ['fonte', 'fonte_busca', 'resumo_fonte'];

function semCampos(obj, campos) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj ?? null;
  const out = { ...obj };
  for (const c of campos) delete out[c];
  return out;
}

const swotSemOrigem = (sw) => semCampos(sw, CAMPOS_SWOT);
const contatoSemOrigem = (cv) => semCampos(cv, CAMPOS_CONTATO);

module.exports = { swotSemOrigem, contatoSemOrigem, CAMPOS_SWOT };
