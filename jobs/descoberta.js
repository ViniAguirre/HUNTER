'use strict';
/*
 * Hunter — job de descoberta (Fase 3).
 * Três modos, definidos por busca.tipo:
 *   • icp        → busca por filtros (UF/CNAE/município) direto na CNPJá.
 *   • lookalike  → lê a lista de CNPJs do cliente, destila um PERFIL MÉDIO
 *                  (grátis, via CNPJá open), e busca SEMELHANTES na CNPJá.
 *   • cnpj       → importa exatamente os CNPJs da lista como leads (sem expandir).
 * Em todos, o portão de existência (lookup local, R$ 0) roda ANTES de criar linha.
 */
const cnpja = require('../providers/cnpja');
const perfilamento = require('../providers/perfil');

const TRAVADOS = ['qualificado', 'em_crm', 'descarte_duro'];
const TETO_PAGINAS = 20;   // com limit=100, até ~2000 empresas por varredura
const TETO_AMOSTRA = 120;  // quantos CNPJs da lista analisamos pra montar o perfil

module.exports = async function descoberta(job, pool, queues) {
  const { busca_id } = job.data;

  const { rows: [busca] } = await pool.query(
    `SELECT tipo, criterios FROM buscas WHERE id=$1`, [busca_id]
  );
  if (!busca) return { skipped: 'busca_inexistente' };
  const tipo = busca.tipo || 'icp';
  let criterios = busca.criterios || job.data.criterios || {};

  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada FROM integracoes
     WHERE categoria='descoberta' AND provedor='cnpja' AND ativo=true
     ORDER BY ordem LIMIT 1`
  );

  // ── Perfilamento (lookalike / importação): destila o perfil médio da lista ──
  if ((tipo === 'lookalike' || tipo === 'cnpj') && !(criterios.params && criterios.params.perfil)) {
    const resultado = await perfilar(pool, criterios, busca_id);
    if (resultado.erro) return resultado;
    criterios = resultado.criterios;
  }

  // ── Modo importação: os leads SÃO os CNPJs da lista (sem expandir) ──────────
  if (tipo === 'cnpj') {
    const cnpjs = perfilamento.parseCnpjs(criterios);
    const counters = { novos: 0, pulados: 0, enfileirados: 0, total: cnpjs.length };
    for (const cnpj of cnpjs) {
      const { rows: [emp] } = await pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [cnpj]);
      if (!emp) { counters.pulados++; continue; }   // não perfilou/não existe → pula
      await processarOffice(pool, queues, busca_id, emp, counters);
    }
    await pool.query(
      `UPDATE buscas SET status='Esgotada', ultimo_heartbeat=now() WHERE id=$1`, [busca_id]
    );
    return { modo: 'importacao', ...counters };
  }

  // ── Modos icp e lookalike: busca por filtros na CNPJá ───────────────────────
  if (!ig?.key_cifrada) {
    throw new Error('Nenhuma integração de descoberta (CNPJá) ativa — configure em Integrações.');
  }

  const params = buildSearchParams(criterios);
  const temFiltro = params.states.length || params.activities.length || (params.municipalities || []).length;
  if (!temFiltro) {
    await pool.query(`UPDATE buscas SET ultimo_heartbeat=now() WHERE id=$1`, [busca_id]);
    return { skipped: 'sem_filtro', motivo: 'busca sem UF, CNAE nem município — defina ao menos um', novos: 0 };
  }

  let token = null, pagina = 0, esgotou = false;
  const counters = { novos: 0, pulados: 0, enfileirados: 0, total: 0 };

  do {
    const { offices, next } = await cnpja.search({ ...params, token }, ig.key_cifrada);
    counters.total += offices.length;
    for (const office of offices) {
      await processarOffice(pool, queues, busca_id, office, counters);
    }
    token = next;
    pagina++;
    if (!next) { esgotou = true; break; }
  } while (pagina < TETO_PAGINAS);

  await pool.query(
    `UPDATE buscas SET universo_varrido = universo_varrido + $1, status='Esgotada', ultimo_heartbeat=now() WHERE id=$2`,
    [counters.total, busca_id]
  );

  return { modo: tipo, ...counters, paginas: pagina, esgotou };
};

// ── Perfilamento: baixa firmografia (grátis) dos CNPJs da lista e monta o perfil.
async function perfilar(pool, criterios, busca_id) {
  const cnpjs = perfilamento.parseCnpjs(criterios);
  if (cnpjs.length < perfilamento.MIN_PERFIL) {
    await pool.query(`UPDATE buscas SET status='Esgotada', ultimo_heartbeat=now() WHERE id=$1`, [busca_id]);
    return { erro: true, skipped: 'lista_curta', minimo: perfilamento.MIN_PERFIL, enviados: cnpjs.length };
  }

  const amostra = [];
  for (const cnpj of cnpjs.slice(0, TETO_AMOSTRA)) {
    let { rows: [emp] } = await pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [cnpj]);
    if (!emp) {
      try {
        const f = await cnpja.enrichCnpj(cnpj);   // endpoint aberto, grátis
        await upsertEmpresa(pool, f);              // cache; NÃO cria lead
        emp = f;
      } catch (_) { continue; }                    // CNPJ inválido/indisponível → ignora
    }
    if (emp) amostra.push(emp);
  }

  if (amostra.length < perfilamento.MIN_PERFIL) {
    await pool.query(`UPDATE buscas SET status='Esgotada', ultimo_heartbeat=now() WHERE id=$1`, [busca_id]);
    return { erro: true, skipped: 'amostra_insuficiente', analisados: amostra.length, minimo: perfilamento.MIN_PERFIL };
  }

  const { params } = perfilamento.construirPerfil(amostra);
  params.proposta_valor = criterios.proposta_valor || criterios.params?.proposta_valor || '';
  const novo = { ...criterios, params };
  await pool.query(`UPDATE buscas SET criterios=$2::jsonb WHERE id=$1`, [busca_id, JSON.stringify(novo)]);
  return { criterios: novo };
}

// Grava/atualiza a empresa no ledger (cache), sem criar lead.
async function upsertEmpresa(pool, o) {
  await pool.query(`
    INSERT INTO empresas (cnpj, razao, fantasia, cnae, setor, porte, cidade, uf, situacao,
      abertura, capital, endereco, natureza_juridica, opcao_simples, decisor, cargo,
      qsa, contato_receita, origem_descoberta, atualizado_em)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,'cnpja',now())
    ON CONFLICT (cnpj) DO NOTHING`,
    [o.cnpj, o.razao, o.fantasia, o.cnae, o.setor, o.porte, o.cidade, o.uf, o.situacao,
     o.abertura || null, o.capital || null, o.endereco || null,
     o.natureza_juridica || null, o.opcao_simples ?? null, o.decisor || null, o.cargo || null,
     JSON.stringify(o.qsa || []), JSON.stringify(o.contato_receita || { telefones: [], emails: [] })]
  );
}

// Portão de existência + criação de empresa/lead + enfileira enriquecimento.
async function processarOffice(pool, queues, busca_id, office, counters) {
  if (!office.cnpj || office.cnpj.length !== 14) return;
  if (office.situacao && !/ativa/i.test(office.situacao)) { counters.pulados++; return; }

  const { rows: [existente] } = await pool.query(
    `SELECT estado_global FROM empresas WHERE cnpj=$1`, [office.cnpj]
  );
  if (existente && TRAVADOS.includes(existente.estado_global)) { counters.pulados++; return; }

  const { rows: [leadExistente] } = await pool.query(
    `SELECT id FROM leads WHERE busca_id=$1 AND cnpj=$2`, [busca_id, office.cnpj]
  );
  if (leadExistente) { counters.pulados++; return; }

  if (!existente) {
    await upsertEmpresa(pool, office);
    counters.novos++;
  }

  const { rows: [lead] } = await pool.query(`
    INSERT INTO leads (busca_id, empresa_cnpj, cnpj, fantasia, razao, setor, cnae, porte, cidade, uf, estagio, origem)
    VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,'coletado','cnpja')
    ON CONFLICT (busca_id, cnpj) DO NOTHING
    RETURNING id`,
    [busca_id, office.cnpj, office.fantasia || office.razao, office.razao,
     office.setor, office.cnae, office.porte, office.cidade, office.uf]
  );

  if (lead) {
    await queues.enriquecimento.add('enriquecimento',
      { cnpj: office.cnpj, busca_id, lead_id: lead.id },
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );
    counters.enfileirados++;
  }
}

function buildSearchParams(criterios) {
  const p = criterios.params || {};
  const out = { states: [], activities: [], municipalities: [], limit: 100 };

  if (p.ufs || p.cnaes || p.municipios_cod || p.founded_gte || p.equity_gte != null) {
    out.states = p.ufs || [];
    out.activities = p.cnaes || [];
    out.municipalities = p.municipios_cod || [];
    out.foundedGte = p.founded_gte || null;
    out.foundedLte = p.founded_lte || null;
    out.equityGte = p.equity_gte != null ? p.equity_gte : null;
    out.equityLte = p.equity_lte != null ? p.equity_lte : null;
    return out;
  }

  for (const chip of (criterios.chips || [])) {
    const idx = chip.indexOf(': ');
    if (idx === -1) continue;
    const key = chip.slice(0, idx).trim();
    const val = chip.slice(idx + 2).trim();
    if (!val) continue;
    if (key === 'UF') out.states.push(val);
    if (key === 'CNAE') out.activities.push(val.replace(/\D/g, ''));
  }
  return out;
}
