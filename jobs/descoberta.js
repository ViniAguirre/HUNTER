'use strict';
/*
 * Hunter — job de descoberta (Fase 3).
 * Busca CNPJs reais via CNPJá conforme os critérios da busca, aplica o
 * portão de existência (lookup local, R$ 0) ANTES de criar qualquer linha,
 * e só então cria empresa/lead e enfileira o enriquecimento.
 */
const cnpja = require('../providers/cnpja');

const TRAVADOS = ['qualificado', 'em_crm', 'descarte_duro'];

module.exports = async function descoberta(job, pool, queues) {
  const { busca_id, criterios = {}, tipo } = job.data;

  const { rows: [ig] } = await pool.query(
    `SELECT key_cifrada FROM integracoes
     WHERE categoria='descoberta' AND provedor='cnpja' AND ativo=true
     ORDER BY ordem LIMIT 1`
  );
  if (!ig?.key_cifrada) {
    throw new Error('Nenhuma integração de descoberta (CNPJá) ativa — configure em Integrações.');
  }

  const { rows: [bCursor] } = await pool.query(`SELECT cursor_descoberta FROM buscas WHERE id=$1`, [busca_id]);
  const params = buildSearchParams(criterios, bCursor?.cursor_descoberta || null);

  // Trava de segurança: sem cursor e sem NENHUM filtro que restrinja de verdade
  // (UF, CNAE ou município), não varre o Brasil inteiro — isso queimaria crédito
  // e encheria a busca de nicho errado. Data/capital sozinhos não bastam.
  const temFiltro = params.states.length || params.activities.length || (params.municipalities || []).length;
  if (!params.token && !temFiltro) {
    await pool.query(
      `UPDATE buscas SET ultimo_heartbeat=now(), cursor_descoberta=NULL WHERE id=$1`, [busca_id]
    );
    return { skipped: 'sem_filtro', motivo: 'busca sem UF, CNAE nem município — defina ao menos um', novos: 0 };
  }

  const { offices, next } = await cnpja.search(params, ig.key_cifrada);

  let novos = 0, pulados = 0, enfileirados = 0;

  for (const office of offices) {
    if (!office.cnpj || office.cnpj.length !== 14) continue;
    if (office.situacao && !/ativa/i.test(office.situacao)) { pulados++; continue; }

    // Portão de existência — lookup local, R$ 0, ANTES de qualquer criação.
    const { rows: [existente] } = await pool.query(
      `SELECT estado_global FROM empresas WHERE cnpj=$1`, [office.cnpj]
    );
    if (existente && TRAVADOS.includes(existente.estado_global)) {
      pulados++;
      continue; // travado: descarta sem linha, sem duplicar, sem gastar key
    }

    const { rows: [leadExistente] } = await pool.query(
      `SELECT id FROM leads WHERE busca_id=$1 AND cnpj=$2`, [busca_id, office.cnpj]
    );
    if (leadExistente) { pulados++; continue; }

    if (!existente) {
      await pool.query(`
        INSERT INTO empresas (cnpj, razao, fantasia, cnae, setor, porte, cidade, uf, situacao, origem_descoberta)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'cnpja')
        ON CONFLICT (cnpj) DO NOTHING`,
        [office.cnpj, office.razao, office.fantasia, office.cnae, office.setor,
         office.porte, office.cidade, office.uf, office.situacao]
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

  // Avança o cursor de descoberta (next). Se acabou (next=null), reseta pra
  // varrer de novo do início no próximo ciclo — o portão de existência evita
  // reprocessar quem já está no ledger, então só empresas novas entram.
  await pool.query(
    `UPDATE buscas SET universo_varrido = universo_varrido + $1, cursor_descoberta = $2, ultimo_heartbeat = now() WHERE id = $3`,
    [offices.length, next, busca_id]
  );

  return { novos, pulados, enfileirados, total: offices.length, fim: !next };
};

function buildSearchParams(criterios, token) {
  // Só filtros firmográficos confirmados pela API (UF + CNAE principal +
  // situação ativa). Porte/Simples ficam pro Score 1 (grátis) — evita
  // depender de IDs de porte e não custa recall na descoberta.
  const p = criterios.params || {};
  const out = { states: [], activities: [], municipalities: [], limit: 20, token };

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
