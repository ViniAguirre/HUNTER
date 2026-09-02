'use strict';
/*
 * Hunter — validação de contato do decisor (Fase de validação).
 * Roda depois do Score 1 aprovar e ANTES do SWOT. Enriquece o contato REAL do
 * decisor (telefone/e-mail) via Econodata. Se não houver provedor ativo, apenas
 * segue pro SWOT (sem gasto). SEMPRE enfileira o SWOT ao final.
 */
const contato = require('../providers/contato');
const google = require('../providers/google');
const fontes = require('./fontes');

const MAX_TENT_CONTATO = 1;   // 1 re-enriquecimento se o contato vier incompleto

async function seguirParaSwot(queues, data) {
  if (queues?.swot) {
    await queues.swot.add('swot', data,
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
  }
}

module.exports = async function validacao(job, pool, queues) {
  const { cnpj, busca_id, lead_id } = job.data;
  // Re-enriquecimento pedido pelo usuário num lead que JÁ existe: nunca apaga o
  // lead se a busca nova não achar telefone. Descartar aqui seria destruir um
  // lead que o usuário só queria atualizar (a regra de apagar vale só na
  // primeira passagem, quando o lead ainda nem "existia" pro usuário).
  const preservarLead = !!job.data.preservar;

  const { rows: [ig] } = await pool.query(
    `SELECT provedor, key_cifrada, config FROM integracoes
     WHERE categoria='contato' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
     ORDER BY ordem LIMIT 1`
  );

  const busca = await fontes.fontesBuscaWeb(pool);
  // O motor teve alguma fonte REAL de enriquecimento nesta rodada? Sem provedor
  // de contato (Places/Econodata) e sem busca web (SearXNG/Tavily), sobra só o
  // DuckDuckGo raspado, que falha na maioria das empresas pequenas. Nesse
  // cenário, "não achou telefone" fala da CONFIGURAÇÃO, não da qualidade da
  // empresa — e descartar o lead apagaria a produção inteira do radar.
  const temFonteEnriquecimento = !!ig || fontes.temBuscaWeb(busca);

  try {
    const { rows: [emp] } = await pool.query(
      `SELECT razao, fantasia, cidade, uf, contato_receita, contatos_verificados FROM empresas WHERE cnpj=$1`, [cnpj]
    );
    const nome = emp?.fantasia || emp?.razao || '';

    let c = null;
    const tentativa = job.data.tentativa_contato || 0;
    // Nas retentativas, força busca FRESCA (não reaproveita cache) — a ideia é
    // justamente tentar de novo achar o contato que faltou.
    const forcarFresco = tentativa > 0;

    // 0) Empresa já validada ANTES — pela descoberta web-first, por este mesmo
    //    tenant numa busca anterior, ou por OUTRO tenant (o cache em `empresas`
    //    é global): reaproveita em vez de gastar Tavily/scrape de novo. Antes só
    //    reaproveitava fonte==='web'; qualquer contato já achado e válido serve.
    const cvWeb = emp?.contatos_verificados;
    if (!forcarFresco && cvWeb && (cvWeb.email || cvWeb.telefone || cvWeb.resumo_site)) {
      c = {
        telefone: cvWeb.telefone || null, whatsapp: cvWeb.telefone || null,
        email: cvWeb.email || null, website: cvWeb.website || null,
        resumo_site: cvWeb.resumo_site || null, resumo_fonte: cvWeb.resumo_fonte || null,
        fonte: cvWeb.fonte || 'cache', validado: !!(cvWeb.email || cvWeb.telefone),
        // COMO o site foi provado viaja junto com o contato. Sem isso o cache
        // entregava o dado e perdia a procedência: o lead ficava sem etiqueta e
        // era impossível saber se aquele telefone tinha sido conferido por CNPJ
        // ou apenas por semelhança de domínio.
        site_conferido: cvWeb.site_conferido || null,
        fonte_busca: cvWeb.fonte_busca || null,
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

    // 2) Fallback GRÁTIS (busca web sem chave paga de contato): usado quando não há
    //    provedor, quando o pago falhou, ou quando faltou o site/resumo (essencial
    //    pro SWOT). Se houver chave de busca web (Tavily), ela torna essa busca mais
    //    estável; senão, DuckDuckGo grátis.
    if (!c || !c.website || !c.resumo_site) {
      // O CNPJ vai junto: quando o site imprime o CNPJ no rodapé, ele CONFIRMA
      // (ou desmente) que aquele site é mesmo desta empresa — prova mais forte
      // que qualquer semelhança de domínio.
      const g = await google.buscarContatoGratis(nome, emp?.cidade, emp?.uf, { ...busca, cnpj }).catch(() => null);
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
          // O site veio do grátis? Então a prova dele vem junto — senão o lead
          // fica com dado do grátis e sem procedência nenhuma registrada.
          c.site_conferido = c.site_conferido || g.site_conferido || null;
          c.fonte_busca = c.fonte_busca || g.fonte_busca || null;
          c.validado = c.validado || g.validado;
          c.fonte = c.fonte && c.fonte !== 'busca_gratis' ? `${c.fonte}+gratis` : 'busca_gratis';
        }
      }
    }

    // IMPORTANTE: o contato comercial (telefone/e-mail/site) SÓ vem de fontes
    // comerciais (site da empresa / Places / Econodata) — NUNCA da Receita/CNPJá
    // (aquilo é o contato do contador). `contato_receita` é usado só pra CONFERIR.
    if (c) {
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
          [cnpj, JSON.stringify({
            telefone: c.telefone, email: c.email, website: c.website || null,
            resumo_site: c.resumo_site || null, resumo_fonte: c.resumo_fonte || null,
            fonte: c.fonte,
            // Guarda a prova junto com o contato — é o que permite auditar
            // depois, e o que faltava pra saber a procedência de 113 leads.
            site_conferido: c.site_conferido || null, fonte_busca: c.fonte_busca || null,
          })]
        );
      }
    } else if (tentativa >= MAX_TENT_CONTATO) {
      // Esgotou as tentativas sem achar contato bom: LIMPA o que estava lá pra
      // não ficar mostrando dado antigo/errado (ex.: site de diretório anterior).
      await pool.query(`UPDATE leads SET contato_validado=NULL WHERE id=$1`, [lead_id]);
    }

    // ── Árvore de decisão do contato ────────────────────────────────────────
    const hasPhone = !!(c && (c.whatsapp || c.telefone));
    const hasEmail = !!(c && c.email);
    const completo = hasPhone && hasEmail;

    // Incompleto (falta telefone OU e-mail): 1 re-enriquecimento (busca fresca).
    if (!completo && tentativa < MAX_TENT_CONTATO && queues?.validacao) {
      await queues.validacao.add('validacao',
        { cnpj, busca_id, lead_id, tentativa_contato: tentativa + 1, preservar: preservarLead },
        { delay: 2 * 60 * 1000, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
      return { lead_id, retry: tentativa + 1, motivo: 'contato_incompleto' };
    }

    // 1) Completo (telefone + e-mail) → segue e pode ir ao CRM automático.
    if (completo) {
      await pool.query(`UPDATE leads SET contato_status='completo', contato_pendente=false WHERE id=$1`, [lead_id]);
      await seguirParaSwot(queues, { cnpj, busca_id, lead_id, contato_ok: true });
      return { lead_id, contato: 'completo' };
    }

    // 2) Só telefone (sem e-mail) → NÃO vai ao CRM automático; entra na fila de
    //    DECISÃO manual (popup no próximo login). Gera o SWOT pra ter o briefing.
    if (hasPhone && !hasEmail) {
      await pool.query(`UPDATE leads SET contato_status='decisao', contato_pendente=true WHERE id=$1`, [lead_id]);
      await seguirParaSwot(queues, { cnpj, busca_id, lead_id, contato_ok: false });
      return { lead_id, contato: 'decisao_so_telefone' };
    }

    // 3) SEM telefone: o lead FICA, marcado como 'Incompleto'.
    //
    // Antes ele era APAGADO, e com isso sumia justamente a lista mais acionável
    // que o motor produz: empresas reais, ativas, aprovadas no Score 1, a que só
    // falta o contato. No radar 56 do Planeta Água foram 85 de 89 — 95% da
    // produção do dia indo pro lixo depois de já ter custado consulta paga na
    // CNPJá e raspagem de site.
    // Preservado, o usuário pode completar o telefone à mão na própria tela; e é
    // desta fila (`contato_status='sem_contato'`) que a extensão do Google Meu
    // Negócio vai puxar as empresas pra buscar.
    if (!temFonteEnriquecimento) {
      console.warn(`[validacao] lead ${lead_id} (${cnpj}): sem telefone e NENHUMA fonte de ` +
        `enriquecimento ativa (Integrações → Contato comercial / Busca na web) — configure um provedor.`);
    }
    await pool.query(`UPDATE buscas SET sem_contato = sem_contato + 1 WHERE id=$1`, [busca_id]).catch(() => {});
    await pool.query(
      `UPDATE leads SET status = CASE WHEN status IN ('Novo','Qualificado') THEN 'Incompleto' ELSE status END,
                        contato_status='sem_contato', contato_pendente=true, atualizado_em=now()
        WHERE id=$1`, [lead_id]
    );
    // Sem SWOT de propósito: briefing custa IA e não serve pra empresa que
    // ninguém consegue abordar. Quando o contato entrar — à mão ou pela
    // extensão — o botão "Refazer análise" gera o briefing.
    return { lead_id, contato: 'sem_contato_preservado' };
  } catch (err) {
    // Erro não trava o pipeline: marca pra decisão manual (não some silenciosamente).
    try { await pool.query(`UPDATE leads SET contato_status='decisao', contato_pendente=true WHERE id=$1`, [lead_id]); } catch (_) {}
    await seguirParaSwot(queues, { cnpj, busca_id, lead_id, contato_ok: false });
    return { lead_id, erro: err.message };
  }
};
