'use strict';
/*
 * Hunter — validação de contato do decisor (Fase de validação).
 * Roda depois do Score 1 aprovar e ANTES do SWOT. Enriquece o contato REAL do
 * decisor (telefone/e-mail) via Econodata. Se não houver provedor ativo, apenas
 * segue pro SWOT (sem gasto). SEMPRE enfileira o SWOT ao final.
 */
const contato = require('../providers/contato');
const google = require('../providers/google');

async function seguirParaSwot(queues, data) {
  if (queues?.swot) {
    await queues.swot.add('swot', data,
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
  }
}

module.exports = async function validacao(job, pool, queues) {
  const { cnpj, busca_id, lead_id } = job.data;

  const { rows: [ig] } = await pool.query(
    `SELECT provedor, key_cifrada, config FROM integracoes
     WHERE categoria='contato' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
     ORDER BY ordem LIMIT 1`
  );

  try {
    const { rows: [emp] } = await pool.query(
      `SELECT razao, fantasia, cidade, uf, contato_receita, contatos_verificados FROM empresas WHERE cnpj=$1`, [cnpj]
    );
    const nome = emp?.fantasia || emp?.razao || '';

    let c = null;

    // 0) Descoberta WEB-FIRST já extraiu site/contato/resumo — reaproveita (sem re-buscar).
    const cvWeb = emp?.contatos_verificados;
    if (cvWeb && cvWeb.fonte === 'web' && (cvWeb.email || cvWeb.telefone || cvWeb.resumo_site)) {
      c = {
        telefone: cvWeb.telefone || null, whatsapp: cvWeb.telefone || null,
        email: cvWeb.email || null, website: cvWeb.website || null,
        resumo_site: cvWeb.resumo_site || null, resumo_fonte: cvWeb.resumo_fonte || null,
        fonte: 'web', validado: !!(cvWeb.email || cvWeb.telefone),
        validado_em: new Date().toISOString(),
      };
    }

    // 1) Provedor pago ativo (Google Places / Econodata), se houver e a chave funcionar.
    if (!c && ig) {
      try {
        if (ig.provedor === 'google') {
          c = await google.buscarContato(nome, emp?.cidade, emp?.uf, ig.key_cifrada);
        } else {
          c = await contato.enriquecerContato(cnpj, { apiKey: ig.key_cifrada, backend: ig.config?.backend });
        }
      } catch (e) {
        c = null;   // chave inválida / sem permissão / rate limit → cai no grátis
      }
    }

    // 2) Fallback GRÁTIS (busca web sem chave): usado quando não há provedor, quando
    //    o pago falhou, ou quando faltou o site/resumo (essencial pro SWOT).
    if (!c || !c.website || !c.resumo_site) {
      const g = await google.buscarContatoGratis(nome, emp?.cidade, emp?.uf).catch(() => null);
      if (g && (g.website || g.email || g.telefone)) {
        if (!c) {
          c = g;
        } else {
          // Completa os buracos do pago com o grátis (o pago manda no telefone).
          c.website = c.website || g.website;
          c.email = c.email || g.email;
          c.telefone = c.telefone || g.telefone;
          c.whatsapp = c.whatsapp || g.whatsapp;
          if (!c.resumo_site) { c.resumo_site = g.resumo_site; c.resumo_fonte = g.resumo_fonte; }
          c.validado = c.validado || g.validado;
          c.fonte = c.fonte && c.fonte !== 'busca_gratis' ? `${c.fonte}+gratis` : 'busca_gratis';
        }
      }
    }

    if (!c) {
      // Nada encontrado (nem grátis): segue pro SWOT só com firmografia.
      await seguirParaSwot(queues, { cnpj, busca_id, lead_id });
      return { skipped: 'sem_contato', lead_id };
    }

    // Cruzamento com a Receita: telefone comercial confirma/substitui o do contador.
    const cr = emp?.contato_receita || {};
    const telReceita = (Array.isArray(cr.telefones) && cr.telefones[0] || '').replace(/\D/g, '');
    c.confere_receita = !!(c.telefone && telReceita && c.telefone.includes(telReceita.slice(-8)));

    await pool.query(
      `UPDATE leads SET contato_validado=$2::jsonb, atualizado_em=now() WHERE id=$1`,
      [lead_id, JSON.stringify(c)]
    );
    if (c.validado) {
      await pool.query(
        `UPDATE empresas SET contatos_verificados=$2::jsonb WHERE cnpj=$1`,
        [cnpj, JSON.stringify({ telefone: c.telefone, email: c.email, website: c.website || null, fonte: c.fonte })]
      );
    }
    await seguirParaSwot(queues, { cnpj, busca_id, lead_id });
    return { lead_id, validado: c.validado, fonte: c.fonte };
  } catch (err) {
    // Erro não trava o pipeline: segue pro SWOT sem contato.
    await seguirParaSwot(queues, { cnpj, busca_id, lead_id });
    return { lead_id, erro: err.message };
  }
};
