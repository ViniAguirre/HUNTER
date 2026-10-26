'use strict';
/*
 * Hunter — validação de contato do decisor (Fase de validação).
 * Roda depois do Score 1 aprovar e ANTES do SWOT. Enriquece o contato REAL do
 * decisor (telefone/e-mail) via Econodata. Se não houver provedor ativo, apenas
 * segue pro SWOT (sem gasto). SEMPRE enfileira o SWOT ao final.
 */
const contato = require('../providers/contato');
const tracking = require('../providers/tracking');
const { registrar } = require('./tracking');
const google = require('../providers/google');
const fontes = require('./fontes');
const typesafe = require('../providers/typesafe');
const glasser = require('../providers/glasser');
const orcamento = require('./orcamento');

// Glasser (Google Maps) como ÚLTIMO recurso pago: só no lead que a busca grátis
// não resolveu (sem telefone), na última tentativa (não paga duas vezes o mesmo
// lead) e dentro do limite diário de consultas escolhido em Integrações.
async function cotaGlasser(pool) {
  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada, config FROM integracoes
      WHERE categoria='contato' AND provedor='glasser' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
      LIMIT 1`).catch(() => ({ rows: [] }));
  if (!ig || !ig.config?.maps?.endpoint) return null;
  const limite = Number.isInteger(ig.config.limite_dia) ? ig.config.limite_dia : glasser.LIMITE_DIA_PADRAO;
  // Conta no limite só a consulta que RODOU: a recusada antes de rodar (chave,
  // saldo, formato) não custa nada e não deveria tirar a vez de outro lead.
  const { rows: [{ n }] } = await pool.query(
    `SELECT COALESCE(SUM(COALESCE(pago_consultas, 1)), 0)::int AS n FROM busca_contato_log
      WHERE pago_fonte='glasser' AND ${CONSULTA_RODOU}
        AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date`);
  // Disjuntor: as últimas consultas deram todas erro (serviço fora, formato
  // recusado)? Pausa PAUSA_ERRO_MIN e tenta de novo — sem queimar a vez dos
  // leads numa integração que não está respondendo.
  const { rows: ult } = await pool.query(
    `SELECT pago_resultado, criado_em FROM busca_contato_log WHERE pago_fonte='glasser'
      ORDER BY id DESC LIMIT ${ERROS_PARA_PAUSAR}`).catch(() => ({ rows: [] }));
  const pausado = ult.length === ERROS_PARA_PAUSAR && ult.every(r => r.pago_resultado === 'erro')
    && Date.now() - new Date(ult[0].criado_em).getTime() < PAUSA_ERRO_MIN * 60_000;
  return { ig, limite, usados: n, pausado };
}
async function glasserDisponivel(pool) {
  const c = await cotaGlasser(pool);
  return c && !c.pausado && c.usados < c.limite ? c.ig : null;
}
const ERROS_PARA_PAUSAR = 5;
const PAUSA_ERRO_MIN = 30;
// A consulta rodou de fato (achou, não conferiu ou voltou vazia — ou deu erro
// mas cobrou). Linha antiga, de antes do resultado ser gravado: só conta se
// teve custo (as de custo vazio eram recusas).
const CONSULTA_RODOU = `(pago_resultado <> 'erro' OR custo_usd > 0 OR (pago_resultado IS NULL AND custo_usd IS NOT NULL))`;

// ── Repescagem nos mapas ────────────────────────────────────────────────────
// O lead novo do radar já passa pelos mapas sozinho (2ª tentativa, acima). Os
// que ficaram sem telefone ANTES — Glasser ainda não ligado, limite do dia
// acabado, radar antigo — não voltariam à busca sem alguém clicar em "Buscar
// contato de novo". A cada minuto o motor manda alguns deles direto aos mapas
// (sem refazer a busca na internet, que já não achou), usando só a SOBRA do
// limite do dia: REPESCA_RESERVA dele fica para os leads novos dos radares.
// Primeiro os que nunca passaram pelos mapas; quem passou e não foi achado volta
// depois de REPESCA_DIAS (empresa pequena entra no Maps depois), até
// REPESCA_MAX_VEZES ao todo. Consulta que deu erro não conta.
const REPESCA_POR_CICLO = 2;
const REPESCA_RESERVA = 0.25;
const REPESCA_DIAS = 15;
const REPESCA_MAX_VEZES = 3;
// Leads elegíveis à repescagem (usado aqui e no Monitoramento).
function sqlRepescaveis(alias = 'l') {
  const rodou = CONSULTA_RODOU.replace(/(pago_resultado|custo_usd)/g, 'g.$1');
  return `${alias}.contato_status = 'sem_contato' AND ${alias}.status NOT IN ('Descartado', 'Enviado')
    AND (SELECT COUNT(*) FROM busca_contato_log g WHERE g.lead_id = ${alias}.id AND g.pago_fonte = 'glasser' AND ${rodou}) < ${REPESCA_MAX_VEZES}
    AND NOT EXISTS (SELECT 1 FROM busca_contato_log g WHERE g.lead_id = ${alias}.id AND g.pago_fonte = 'glasser' AND ${rodou}
                      AND g.criado_em > now() - interval '${REPESCA_DIAS} days')`;
}
async function repescarSemTelefone(pool, queues) {
  if (!queues?.validacao) return 0;
  const cota = await cotaGlasser(pool);
  if (!cota || cota.pausado || cota.usados >= Math.floor(cota.limite * (1 - REPESCA_RESERVA))) return 0;
  // Dentro do horário de funcionamento: o lead achado vai pro CRM, que não atende fora dele.
  const vagas = await orcamento.disponivel(pool).catch(() => null);
  if (!vagas || vagas.foraDaJanela) return 0;
  // Fila da validação com trabalho na frente → espera: o lead novo tem prioridade.
  const fila = await queues.validacao.getJobCounts('waiting', 'active').catch(() => null);
  if (!fila || fila.waiting + fila.active > 0) return 0;
  const rodou = CONSULTA_RODOU.replace(/(pago_resultado|custo_usd)/g, 'g.$1');
  const { rows } = await pool.query(
    `SELECT l.id, l.cnpj, l.busca_id FROM leads l
      WHERE ${sqlRepescaveis('l')}
      ORDER BY (SELECT COUNT(*) FROM busca_contato_log g WHERE g.lead_id = l.id AND g.pago_fonte = 'glasser' AND ${rodou}),
               l.score DESC NULLS LAST, l.criado_em DESC
      LIMIT $1`, [Math.min(REPESCA_POR_CICLO, cota.limite - cota.usados)]);
  const dia = new Date().toISOString().slice(0, 10);
  for (const l of rows) {
    await queues.validacao.add('validacao',
      { cnpj: l.cnpj, busca_id: l.busca_id, lead_id: l.id, tentativa_contato: MAX_TENT_CONTATO, preservar: true, so_mapas: true },
      // Um por lead por dia: se o job não chegar a consultar (limite acabou no
      // meio), o lead volta à repescagem no dia seguinte.
      { jobId: `repesca-mapas-${l.id}-${dia}`, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 },
        attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
  }
  return rows.length;
}

// Jev como juiz do caso duvidoso da busca nos mapas (glasser.buscarNoMaps):
// só existe com a integração decisao|typesafe ativa. Cada lugar avaliado fica
// em decisoes_jev (tipo 'lugar'), pra auditar o que ele aceitou e recusou.
async function juizDoJev(pool, emp, cnpj) {
  const jev = await typesafe.integracao(pool).catch(() => null);
  if (!jev) return null;
  return async lugares => {
    const r = await typesafe.avaliarLugares(jev.apiKey, emp, lugares, { modelo: jev.modelo });
    for (const [i, l] of lugares.entries()) {
      await pool.query(
        `INSERT INTO decisoes_jev (tipo, cnpj, alvo, regra, jev_pertence, modelo, latencia_ms)
         VALUES ('lugar', $1, $2, 'regras_recusaram', $3, $4, $5)`,
        [cnpj, `${l.nome} — ${l.endereco || 'sem endereço'}`.slice(0, 400), r.probabilidades[i], r.modelo, r.latencia_ms]
      ).catch(e => console.error('[jev] gravar lugar:', e.message));
    }
    return r;
  };
}

// Modo observação do Jev (só para o tenant com a integração decisao|typesafe
// ativa): opina sobre os mesmos candidatos a site que as regras do google.js
// avaliaram e grava as duas respostas em `decisoes_jev`. Não altera o lead.
function observarSites(pool, jev, empresa) {
  return async (avaliados) => {
    let r = null, erro = null;
    try {
      r = await typesafe.avaliarSites(jev.apiKey, empresa, avaliados, { modelo: jev.modelo });
    } catch (e) {
      erro = String(e.message || e).slice(0, 300);
    }
    for (const [i, c] of avaliados.entries()) {
      const o = r?.candidatos?.[i] || null;
      await pool.query(
        `INSERT INTO decisoes_jev (tipo, cnpj, alvo, regra, jev_tipo, jev_confianca, jev_pertence, jev_probabilidades, modelo, latencia_ms, erro)
         VALUES ('site', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [empresa.cnpj, c.site, c.regra, o?.tipo ?? null, o?.confianca ?? null, o?.pertence ?? null,
         o?.probabilidades ? JSON.stringify(o.probabilidades) : null, r?.modelo ?? null, r?.latencia_ms ?? null, erro]
      ).catch(err => console.error('[jev] gravar decisão:', err.message));
    }
  };
}

// Lead que ficou 'Incompleto' (sem contato) e agora achou telefone volta pra
// triagem como 'Novo' — o mesmo que acontece quando o contato entra à mão.
const SAI_DO_INCOMPLETO = `status = CASE WHEN status='Incompleto' THEN 'Novo' ELSE status END, atualizado_em=now()`;
const MAX_TENT_CONTATO = 1;   // 1 re-enriquecimento se o contato vier incompleto

// Opção de contato da Estratégia (o cliente escolhe): WhatsApp basta pro envio
// automático.
async function opcoesContato(pool) {
  const { rows: [e] } = await pool.query(`SELECT crm_so_whatsapp FROM estrategia`).catch(() => ({ rows: [] }));
  return { soWhatsapp: !!e?.crm_so_whatsapp };
}

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
  // Repescagem (repescarSemTelefone): só os mapas — a busca na internet já
  // rodou neste lead e não achou telefone.
  const soMapas = !!job.data.so_mapas;

  const { rows: [ig] } = await pool.query(
    `SELECT provedor, key_cifrada, config FROM integracoes
     WHERE categoria='contato' AND provedor <> 'glasser' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
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
      `SELECT razao, fantasia, cidade, uf, setor, endereco, contato_receita, contatos_verificados FROM empresas WHERE cnpj=$1`, [cnpj]
    );
    const nome = emp?.fantasia || emp?.razao || '';

    let c = null;
    // Pro diagnóstico da busca de contato (Monitoramento → Busca de contato).
    let origem = null, diagBusca = null;
    // Como o lead estava antes desta busca: quem sai de "sem contato" volta pra
    // triagem, e o contador do radar não conta duas vezes o mesmo lead.
    const { rows: [antes] } = await pool.query(
      `SELECT contato_status, contato_validado FROM leads WHERE id=$1`, [lead_id]).catch(() => ({ rows: [] }));
    const estavaSemContato = antes?.contato_status === 'sem_contato';
    // Na repescagem o que a busca anterior achou (e-mail, site) continua valendo.
    if (soMapas && antes?.contato_validado && Object.keys(antes.contato_validado).length) {
      c = { ...antes.contato_validado };
      origem = 'anterior';
    }
    const t0 = Date.now();
    // Pedido do usuário pra ESTE lead: uma passada só, já como a última (busca
    // fresca na internet e, sem telefone, os mapas na sequência) — sem esperar
    // os 2 min da 2ª tentativa; ele está olhando a tela.
    const tentativa = job.data.manual ? MAX_TENT_CONTATO : (job.data.tentativa_contato || 0);
    // Nas retentativas, força busca FRESCA (não reaproveita cache) — a ideia é
    // justamente tentar de novo achar o contato que faltou.
    const forcarFresco = tentativa > 0;

    // 0) Empresa já validada ANTES — pela descoberta web-first, por este mesmo
    //    tenant numa busca anterior, ou por OUTRO tenant (o cache em `empresas`
    //    é global): reaproveita em vez de gastar Tavily/scrape de novo. Antes só
    //    reaproveitava fonte==='web'; qualquer contato já achado e válido serve.
    const cvWeb = emp?.contatos_verificados;
    if (!soMapas && !forcarFresco && cvWeb && (cvWeb.email || cvWeb.telefone || cvWeb.resumo_site)) {
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
        perfil_social: cvWeb.perfil_social || null,
        validado_em: new Date().toISOString(),
      };
      origem = 'cache';
    }

    // 1) Provedor pago ativo (Google Places / Econodata), se houver e a chave funcionar.
    if (!soMapas && !c && ig) {
      try {
        if (ig.provedor === 'google') {
          c = await google.buscarContato(nome, emp?.cidade, emp?.uf, ig.key_cifrada);
        } else {
          c = await contato.enriquecerContato(cnpj, { apiKey: ig.key_cifrada, backend: ig.config?.backend });
        }
        if (c) origem = 'pago';
      } catch (e) {
        c = null;   // chave inválida / sem permissão / rate limit → cai no grátis
      }
    }

    // 2) Fallback GRÁTIS (busca web sem chave paga de contato): usado quando não há
    //    provedor, quando o pago falhou, ou quando faltou o site/resumo (essencial
    //    pro SWOT). Se houver chave de busca web (Tavily), ela torna essa busca mais
    //    estável; senão, DuckDuckGo grátis.
    if (!soMapas && (!c || !c.website || !c.resumo_site)) {
      // O CNPJ vai junto: quando o site imprime o CNPJ no rodapé, ele CONFIRMA
      // (ou desmente) que aquele site é mesmo desta empresa — prova mais forte
      // que qualquer semelhança de domínio.
      const jev = await typesafe.integracao(pool).catch(() => null);
      const aoAvaliar = jev ? observarSites(pool, jev, {
        cnpj, nome, razao: emp?.razao, fantasia: emp?.fantasia, cidade: emp?.cidade, uf: emp?.uf, setor: emp?.setor,
      }) : undefined;
      const g = await google.buscarContatoGratis(nome, emp?.cidade, emp?.uf,
        { ...busca, cnpj, razao: emp?.razao, aoAvaliar }).catch(() => null);
      diagBusca = g?.diag || null;
      if (g) delete g.diag;
      if (g && (g.website || g.email || g.telefone)) {
        if (!c) {
          c = g;
          origem = 'gratis';
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

    // 3) Google Maps pelo Glasser (pago, último recurso): a busca grátis não
    //    achou telefone, é a última tentativa e há cota no dia.
    let pagoFonte = null, custoUsd = null, pagoResultado = null, pagoErro = null, pagoConsultas = null;
    if (!(c && (c.telefone || c.whatsapp)) && tentativa >= MAX_TENT_CONTATO) {
      // Pedido do usuário pra ESTE lead ("Buscar contato de novo"): não esbarra
      // no limite do dia (a consulta conta nele do mesmo jeito). Sem os mapas,
      // o motivo fica no log — a tela diz por que a busca terminou sem telefone.
      const cota = await cotaGlasser(pool).catch(() => null);
      const ig = cota && !cota.pausado && (job.data.manual || cota.usados < cota.limite) ? cota.ig : null;
      if (!ig) pagoResultado = !cota ? 'mapas_desligado' : cota.pausado ? 'mapas_pausado' : 'mapas_sem_cota';
      if (ig) {
        pagoFonte = 'glasser';
        try {
          // Palavras do ramo do radar (e da atividade): no título do lugar, sozinhas
          // não provam que é esta empresa (glasser.confere).
          const { rows: [bz] } = await pool.query(`SELECT criterios FROM buscas WHERE id=$1`, [busca_id]).catch(() => ({ rows: [] }));
          const m = await glasser.buscarNoMaps(nome, emp?.cidade, emp?.uf, ig.key_cifrada, ig.config,
            { razao: emp?.razao, endereco: emp?.endereco, genericas: glasser.genericasDe({ setor: emp?.setor, criterios: bz?.criterios }),
              juiz: await juizDoJev(pool, emp, cnpj) });
          custoUsd = m.custo_usd ?? null;
          pagoResultado = m.resultado || (m.encontrado ? 'achou' : 'lugar_nao_confere');   // achou_ia = confirmado pelo Jev
          pagoConsultas = m.consultas ?? 1;
          if (m.encontrado && (m.telefone || m.website || m.perfil_social)) {
            if (m.website && !(c && c.resumo_site)) {
              const sx = await google.scrapeSite(m.website).catch(() => null);
              if (sx) { m.email = m.email || sx.email || null; m.resumo_site = sx.resumo || null; m.resumo_fonte = sx.resumo_fonte || null; }
            }
            if (!c) { c = m; origem = 'glasser'; }
            else {
              c.telefone = c.telefone || m.telefone; c.whatsapp = c.whatsapp || m.whatsapp;
              c.website = c.website || m.website; c.email = c.email || m.email;
              c.perfil_social = c.perfil_social || m.perfil_social || null;
              if (!c.resumo_site && m.resumo_site) { c.resumo_site = m.resumo_site; c.resumo_fonte = m.resumo_fonte; }
              c.validado = c.validado || m.validado;
              c.fonte = c.fonte ? `${c.fonte}+glasser` : 'glasser';
              if (origem === 'anterior') origem = 'glasser';
            }
            delete c.custo_usd;
          }
        } catch (e) {
          custoUsd = e.custo_usd ?? null;
          pagoResultado = 'erro'; pagoErro = String(e.message || e).slice(0, 300); pagoConsultas = e.consultas ?? 1;
          console.warn(`[validacao] lead ${lead_id} (${cnpj}): Google Maps (Glasser) falhou — ${e.message}`);
        }
      }
    }

    if (origem === 'anterior') origem = null;   // os mapas não acharam nada novo

    // IMPORTANTE: o contato comercial (telefone/e-mail/site) SÓ vem de fontes
    // comerciais (site da empresa / rede social / Google Maps / Places /
    // Econodata) — NUNCA da Receita/CNPJá: aquilo costuma ser o contato do
    // contador. `contato_receita` serve só pra CONFERIR.
    const opcoes = await opcoesContato(pool);
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
            perfil_social: c.perfil_social || null,
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

    // Diagnóstico: uma linha por tentativa — é o que mostra se a busca na
    // internet está achando contato, por qual caminho e por que falha.
    await pool.query(
      `INSERT INTO busca_contato_log (lead_id, busca_id, tentativa, origem, resultado, conferido, fonte_busca,
                                      consultas, regras, motivo, telefone, email, ms, pago_fonte, custo_usd,
                                      pago_resultado, pago_erro, pago_consultas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [lead_id, busca_id || null, tentativa, origem || (diagBusca ? 'gratis' : 'nenhum'),
       diagBusca?.resultado || (c ? 'site' : 'nada'), c?.site_conferido || null, c?.fonte_busca || null,
       JSON.stringify(diagBusca?.consultas || []), JSON.stringify(diagBusca?.regras || {}),
       diagBusca?.motivo || null, hasPhone, hasEmail, Date.now() - t0, pagoFonte, custoUsd,
       pagoResultado, pagoErro, pagoConsultas]
    ).catch(e => console.error('[validacao] log da busca:', e.message));

    // Incompleto (falta telefone OU e-mail): 1 re-enriquecimento (busca fresca).
    if (!completo && tentativa < MAX_TENT_CONTATO && queues?.validacao) {
      await queues.validacao.add('validacao',
        { cnpj, busca_id, lead_id, tentativa_contato: tentativa + 1, preservar: preservarLead },
        { delay: 2 * 60 * 1000, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
      return { lead_id, retry: tentativa + 1, motivo: 'contato_incompleto' };
    }

    // 3ª etapa do funil no Tracking Hub. Só o COMPLETO conta: qualificado é o
    // lead que o vendedor consegue abordar de fato, com telefone e e-mail. O
    // só-telefone tem faixa própria na tela e não entra aqui, senão o funil do
    // Hub contaria uma etapa que o Dashboard não conta.
    if (completo) {
      await registrar(queues, 'lead_qualified', {
        hunter_id: tracking.hunterId(busca_id, cnpj),
        properties: { radar_id: busca_id != null ? String(busca_id) : '' },
      });
    }

    // 1) Completo (telefone + e-mail) → segue e pode ir ao CRM automático.
    if (completo) {
      await pool.query(`UPDATE leads SET contato_status='completo', contato_pendente=false, ${SAI_DO_INCOMPLETO} WHERE id=$1`, [lead_id]);
      await seguirParaSwot(queues, { cnpj, busca_id, lead_id, contato_ok: true });
      return { lead_id, contato: 'completo' };
    }

    // 2) Só telefone (sem e-mail) → por padrão NÃO vai ao CRM automático; entra
    //    na fila de DECISÃO manual (popup no próximo login). Com a opção "WhatsApp
    //    basta" (Estratégia), segue pro envio automático como o completo — o CRM
    //    atende pelo WhatsApp. O SWOT roda nos dois casos.
    if (hasPhone && !hasEmail) {
      await pool.query(`UPDATE leads SET contato_status='decisao', contato_pendente=$2, ${SAI_DO_INCOMPLETO} WHERE id=$1`,
        [lead_id, !opcoes.soWhatsapp]);
      await seguirParaSwot(queues, { cnpj, busca_id, lead_id, contato_ok: opcoes.soWhatsapp });
      return { lead_id, contato: opcoes.soWhatsapp ? 'so_telefone_envia' : 'decisao_so_telefone' };
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
    if (!estavaSemContato) {
      await pool.query(`UPDATE buscas SET sem_contato = sem_contato + 1 WHERE id=$1`, [busca_id]).catch(() => {});
    }
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

module.exports.repescarSemTelefone = repescarSemTelefone;
module.exports.cotaGlasser = cotaGlasser;
module.exports.CONSULTA_RODOU = CONSULTA_RODOU;
module.exports.juizDoJev = juizDoJev;
module.exports.sqlRepescaveis = sqlRepescaveis;
