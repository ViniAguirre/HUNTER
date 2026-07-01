'use strict';
/*
 * Hunter — job de descoberta (Fase 3).
 * Busca CNPJs reais via CNPJá conforme os critérios da busca, aplica o
 * portão de existência (lookup local, R$ 0) ANTES de criar qualquer linha,
 * e só então cria empresa/lead e enfileira o enriquecimento.
 */
const cnpja = require('../providers/cnpja');

const TRAVADOS = ['qualificado', 'em_crm', 'descarte_duro'];
const TETO_PAGINAS = 50; // até ~1000 empresas por varredura (protege o crédito)

module.exports = async function descoberta(job, pool, queues) {
  const { busca_id, criterios = {} } = job.data;

  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada FROM integracoes
     WHERE categoria='descoberta' AND provedor='cnpja' AND ativo=true
     ORDER BY ordem LIMIT 1`
  );
  if (!ig?.key_cifrada) {
    throw new Error('Nenhuma integração de descoberta (CNPJá) ativa — configure em Integrações.');
  }

  const params = buildSearchParams(criterios);

  // Trava de segurança: sem NENHUM filtro que restrinja de verdade (UF, CNAE
  // ou município), não varre o Brasil inteiro — queimaria crédito e traria
  // nicho errado. Data/capital sozinhos não bastam.
  const temFiltro = params.states.length || params.activities.length || (params.municipalities || []).length;
  if (!temFiltro) {
    await pool.query(`UPDATE buscas SET ultimo_heartbeat=now() WHERE id=$1`, [busca_id]);
    return { skipped: 'sem_filtro', motivo: 'busca sem UF, CNAE nem município — defina ao menos um', novos: 0 };
  }

  // Paginação CONTÍNUA numa só execução: o cursor (token) da CNPJá expira em
  // segundos, então não dá pra guardar entre ciclos. Varremos o universo todo
  // aqui, com o cursor vivo em memória, até acabar (next=null) ou bater o teto.
  let token = null, pagina = 0, esgotou = false;
  let novos = 0, pulados = 0, enfileirados = 0, total = 0;

  do {
    const { offices, next } = await cnpja.search({ ...params, token }, ig.key_cifrada);
    total += offices.length;

    for (const office of offices) {
      if (!office.cnpj || office.cnpj.length !== 14) continue;
      if (office.situacao && !/ativa/i.test(office.situacao)) { pulados++; continue; }

      // Portão de existência — lookup local, R$ 0.
      const { rows: [existente] } = await pool.query(
        `SELECT estado_global FROM empresas WHERE cnpj=$1`, [office.cnpj]
      );
      if (existente && TRAVADOS.includes(existente.estado_global)) { pulados++; continue; }

      const { rows: [leadExistente] } = await pool.query(
        `SELECT id FROM leads WHERE busca_id=$1 AND cnpj=$2`, [busca_id, office.cnpj]
      );
      if (leadExistente) { pulados++; continue; }

      if (!existente) {
        // A busca já traz o cadastro COMPLETO — gravamos tudo aqui. Com
        // atualizado_em=now(), o enriquecimento cai no cache e NÃO repaga.
        await pool.query(`
          INSERT INTO empresas (cnpj, razao, fantasia, cnae, setor, porte, cidade, uf, situacao,
            abertura, capital, endereco, natureza_juridica, opcao_simples, decisor, cargo,
            qsa, contato_receita, origem_descoberta, atualizado_em)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,'cnpja',now())
          ON CONFLICT (cnpj) DO NOTHING`,
          [office.cnpj, office.razao, office.fantasia, office.cnae, office.setor,
           office.porte, office.cidade, office.uf, office.situacao,
           office.abertura || null, office.capital || null, office.endereco || null,
           office.natureza_juridica || null, office.opcao_simples ?? null,
           office.decisor || null, office.cargo || null,
           JSON.stringify(office.qsa || []), JSON.stringify(office.contato_receita || { telefones: [], emails: [] })]
        );
        novos++;
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
        enfileirados++;
      }
    }

    token = next;
    pagina++;
    if (!next) { esgotou = true; break; }
  } while (pagina < TETO_PAGINAS);

  // Uma varredura por busca: ao terminar (ou bater o teto), marca 'Esgotada'
  // pra o motor NÃO re-varrer e re-pagar. Pra pegar empresas novas depois,
  // basta reativar a busca. Assim cada busca gasta crédito uma vez só.
  await pool.query(
    `UPDATE buscas SET universo_varrido = universo_varrido + $1, status='Esgotada', ultimo_heartbeat=now() WHERE id=$2`,
    [total, busca_id]
  );

  return { novos, pulados, enfileirados, total, paginas: pagina, esgotou };
};

function buildSearchParams(criterios) {
  // Filtros confirmados pela API. Porte/Simples ficam pro Score 1 (grátis).
  const p = criterios.params || {};
  const out = { states: [], activities: [], municipalities: [], limit: 20 };

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

  // Critérios legados (chips em texto livre) — parse best-effort.
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
