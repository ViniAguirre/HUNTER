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
const baseRates = require('../providers/base');
const google = require('../providers/google');

const TRAVADOS = ['qualificado', 'em_crm', 'descarte_duro'];
const TETO_PAGINAS = 20;   // com limit=100, até ~2000 empresas por varredura
const TETO_AMOSTRA = 120;  // quantos CNPJs da lista analisamos pra montar o perfil

module.exports = async function descoberta(job, pool, queues) {
  const { busca_id } = job.data;

  const { rows: [busca] } = await pool.query(
    `SELECT tipo, criterios, lista FROM buscas WHERE id=$1`, [busca_id]
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
    const resultado = await perfilar(pool, criterios, busca_id, busca.lista);
    if (resultado.erro) return resultado;
    criterios = resultado.criterios;
  }

  // Limite diário GERAL de consumo: teto de leads novos criados por dia em todas
  // as buscas somadas. Ao bater, a descoberta para (protege o orçamento).
  const orcamento = await orcamentoHoje(pool);
  if (orcamento <= 0) {
    await pool.query(`UPDATE buscas SET ultimo_heartbeat=now() WHERE id=$1`, [busca_id]);
    return { skipped: 'limite_diario', motivo: 'teto diário de leads atingido', novos: 0 };
  }

  // ── Modo WEB-FIRST (icp): descobre pela internet e confirma CNPJ/ativa na CNPJá.
  if (tipo === 'icp') {
    const modo = criterios.params?.modo_descoberta || await modoPadrao(pool);
    if (modo === 'web') {
      return descobrirWebFirst(pool, queues, busca_id, criterios, ig?.key_cifrada || null, orcamento);
    }
  }

  // ── Modo importação: os leads SÃO os CNPJs da lista (sem expandir) ──────────
  if (tipo === 'cnpj') {
    const cnpjs = perfilamento.parseCnpjs(criterios);
    const counters = { novos: 0, pulados: 0, enfileirados: 0, total: cnpjs.length, orcamento, limiteAtingido: false };
    for (const cnpj of cnpjs) {
      if (counters.limiteAtingido) break;
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
  // Palavra-chave (nome/fantasia) é um filtro específico por si só — dispensa UF/CNAE.
  const temFiltro = params.states.length || params.activities.length
    || (params.municipalities || []).length || (params.names || []).length;
  if (!temFiltro) {
    await pool.query(`UPDATE buscas SET ultimo_heartbeat=now() WHERE id=$1`, [busca_id]);
    return { skipped: 'sem_filtro', motivo: 'busca sem UF, CNAE, município nem palavra-chave — defina ao menos um', novos: 0 };
  }

  let token = null, pagina = 0, esgotou = false;
  const counters = { novos: 0, pulados: 0, enfileirados: 0, total: 0, orcamento, limiteAtingido: false };

  do {
    const { offices, next } = await cnpja.search({ ...params, token }, ig.key_cifrada);
    counters.total += offices.length;
    for (const office of offices) {
      if (counters.limiteAtingido) break;
      await processarOffice(pool, queues, busca_id, office, counters);
    }
    token = next;
    pagina++;
    if (counters.limiteAtingido) break;   // bateu o teto diário → para a varredura
    if (!next) { esgotou = true; break; }
  } while (pagina < TETO_PAGINAS);

  // Se parou só pelo teto diário, deixa a busca 'Ativa' pra continuar amanhã;
  // se varreu o universo todo, marca 'Esgotada'.
  await pool.query(
    `UPDATE buscas SET universo_varrido = universo_varrido + $1,
       status = CASE WHEN $3 THEN status ELSE 'Esgotada' END,
       ultimo_heartbeat=now() WHERE id=$2`,
    [counters.total, busca_id, counters.limiteAtingido && !esgotou]
  );

  return { modo: tipo, ...counters, paginas: pagina, esgotou };
};

// Quantos leads novos ainda cabem hoje no teto geral (config.limite_diario).
async function orcamentoHoje(pool) {
  const { rows: [cfg] } = await pool.query(`SELECT limite_diario FROM config WHERE id=1`);
  const limite = cfg?.limite_diario ?? 350;
  if (!limite) return Number.MAX_SAFE_INTEGER;   // 0 = sem teto
  const { rows: [{ n }] } = await pool.query(
    `SELECT COUNT(*)::int n FROM leads WHERE criado_em >= date_trunc('day', now())`
  );
  return Math.max(0, limite - n);
}

const semAcentoLower = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function modoPadrao(pool) {
  try { const { rows: [c] } = await pool.query(`SELECT descoberta_modo_padrao FROM config WHERE id=1`); return c?.descoberta_modo_padrao || 'cnpja'; }
  catch { return 'cnpja'; }
}

// ── Descoberta WEB-FIRST ──────────────────────────────────────────────────────
// Parte da internet (como o cliente pesquisaria no Google), pega o site, tenta o
// CNPJ do rodapé (grátis) e confirma ativa/sócios na CNPJá. Só cai na CNPJá paga
// (names.in) quando o site não expõe o CNPJ. Guarda o site pra a validação reusar.
async function descobrirWebFirst(pool, queues, busca_id, criterios, cnpjaKey, orcamento) {
  const p = criterios.params || {};
  const termo = ((p.keywords || []).join(' ').trim())
    || ((p.cnaes_rotulos || []).map(x => x.d).join(' ').trim());
  const uf = (p.ufs || [])[0] || '';
  const cidade = (p.municipios_rotulos || [])[0]?.n || '';
  if (!termo) {
    await pool.query(`UPDATE buscas SET ultimo_heartbeat=now() WHERE id=$1`, [busca_id]);
    return { skipped: 'sem_termo_web', motivo: 'modo internet exige palavra-chave (ou atividade)', novos: 0 };
  }

  const candidatos = await google.buscarEmpresasWeb(termo, cidade, uf, 40);
  const counters = { novos: 0, pulados: 0, enfileirados: 0, total: candidatos.length, orcamento, limiteAtingido: false, via_site: 0, via_cnpja: 0 };

  for (const cand of candidatos) {
    if (counters.limiteAtingido) break;
    const s = await google.scrapeSite(cand.site);

    let firmo = null;
    if (s.cnpj) { try { firmo = await cnpja.enrichCnpj(s.cnpj); counters.via_site++; } catch (_) {} } // grátis
    if (!firmo && cnpjaKey) { firmo = await resolverPorNome(cand.titulo || cand.site, uf, cidade, cnpjaKey); if (firmo) counters.via_cnpja++; }

    if (!firmo || !firmo.cnpj || firmo.cnpj.length !== 14) { counters.pulados++; continue; }
    if (firmo.situacao && !/ativa/i.test(firmo.situacao)) { counters.pulados++; continue; } // confirma ATIVA

    const antes = counters.enfileirados;
    await processarOffice(pool, queues, busca_id, firmo, counters);
    if (counters.enfileirados > antes) {
      // Reaproveitamento: guarda o que já achamos na web pra a validação não re-buscar.
      await pool.query(`UPDATE empresas SET contatos_verificados=$2::jsonb WHERE cnpj=$1`,
        [firmo.cnpj, JSON.stringify({ website: cand.site, email: s.email, telefone: s.telefone, resumo_site: s.resumo, resumo_fonte: s.resumo_fonte, fonte: 'web' })]);
    }
  }

  await pool.query(
    `UPDATE buscas SET status = CASE WHEN $2 THEN status ELSE 'Esgotada' END, ultimo_heartbeat=now() WHERE id=$1`,
    [busca_id, counters.limiteAtingido]
  );
  return { modo: 'web', ...counters };
}

// Resolve nome → empresa na CNPJá (fallback pago, quando o site não traz CNPJ).
// Só aceita se a cidade bater (quando informada), pra evitar casar a empresa errada.
async function resolverPorNome(nome, uf, cidade, cnpjaKey) {
  const termo = String(nome).split(/[|\-–—:•]/)[0]
    .replace(/\b(ltda|s\.?\/?a\.?|eireli|mei|me|epp)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  if (termo.length < 3) return null;
  try {
    const { offices } = await cnpja.search({ names: [termo], states: uf ? [uf] : [], limit: 5 }, cnpjaKey);
    if (!offices.length) return null;
    if (cidade) return offices.find(o => semAcentoLower(o.cidade) === semAcentoLower(cidade)) || null;
    return offices[0];
  } catch (_) { return null; }
}

// ── Perfilamento: baixa firmografia (grátis) dos CNPJs da lista e monta o perfil.
// Sementes vêm da lista colada (criterios.cnpjs) E da lista alimentada pelo CRM.
async function perfilar(pool, criterios, busca_id, lista) {
  const cnpjs = new Set(perfilamento.parseCnpjs(criterios));
  if (lista) {
    const { rows } = await pool.query(`SELECT cnpj FROM sementes WHERE lista=$1`, [lista]);
    for (const r of rows) if (r.cnpj) cnpjs.add(r.cnpj);
  }
  return perfilarComLista(pool, criterios, busca_id, [...cnpjs]);
}

async function perfilarComLista(pool, criterios, busca_id, cnpjs) {
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

  const base = await baseRates.baseRates(pool);   // taxas do universo p/ peso de raridade
  const { params } = perfilamento.construirPerfil(amostra, base);
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
  // Teto diário geral: se o orçamento zerou, não cria mais lead novo.
  if (counters.orcamento != null && counters.orcamento <= 0) { counters.limiteAtingido = true; return; }
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
    if (counters.orcamento != null) {
      counters.orcamento--;
      if (counters.orcamento <= 0) counters.limiteAtingido = true;
    }
  }
}

function buildSearchParams(criterios) {
  const p = criterios.params || {};
  const out = { states: [], activities: [], municipalities: [], names: [], limit: 100 };

  if (p.ufs || p.cnaes || p.municipios_cod || p.keywords || p.founded_gte || p.equity_gte != null) {
    out.states = p.ufs || [];
    out.activities = p.cnaes || [];
    out.municipalities = p.municipios_cod || [];
    out.names = p.keywords || [];
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
