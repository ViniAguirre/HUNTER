'use strict';
/*
 * Hunter — Score 1 (Fase 3, grátis: firmográfico).
 * Decide quem sobrevive ao corte ANTES de gastar qualquer chave paga de
 * contato. Roda com dado 100% grátis (firmografia da Receita via CNPJá):
 * CNAE, porte, capital (faixa), UF, situação, opção pelo Simples. O
 * contato bruto da Receita NUNCA entra aqui como sinal positivo.
 */

const W = {
  CNAE_EXATO: 35,
  CNAE_GRUPO: 15,
  UF: 25,
  PORTE: 20,
  CAPITAL: 10,
  SIMPLES: 5,
  SITUACAO_ATIVA: 5,
};

module.exports = async function score1(job, pool, queues) {
  const { cnpj, busca_id, lead_id } = job.data;

  const [empresaRes, buscaRes] = await Promise.all([
    pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [cnpj]),
    pool.query(`SELECT tipo, criterios, corte_score FROM buscas WHERE id=$1`, [busca_id]),
  ]);
  const empresa = empresaRes.rows[0];
  const busca = buscaRes.rows[0];

  if (!empresa || !busca) {
    await pool.query(
      `UPDATE leads SET estagio='descartado', motivo_descarte='empresa_ou_busca_nao_encontrada', atualizado_em=now() WHERE id=$1`,
      [lead_id]
    );
    return { error: 'empresa ou busca ausente', cnpj };
  }

  const params = parseCriterios(busca.criterios);
  const { score, breakdown } = computeScore1(empresa, params);
  const corte = busca.corte_score ?? 60;
  const passou = score >= corte;
  const breakdownJson = JSON.stringify(breakdown);

  if (passou) {
    await pool.query(`
      UPDATE leads SET
        score=$2, breakdown=$3::jsonb,
        estagio='scored', status='Novo',
        situacao=$4, abertura=$5, capital=$6, endereco=$7,
        atualizado_em=now()
      WHERE id=$1`,
      [lead_id, score, breakdownJson, empresa.situacao, empresa.abertura, empresa.capital, empresa.endereco]
    );
    // Passou no corte → enfileira o agente SWOT (Fase 3.2). Se não houver chave
    // OpenAI ativa, o job apenas ignora e o lead segue 'scored' (sem gasto).
    if (queues?.swot) {
      await queues.swot.add('swot', { cnpj, busca_id, lead_id },
        { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
    }
  } else {
    await pool.query(`
      UPDATE leads SET
        score=$2, breakdown=$3::jsonb,
        estagio='descartado', motivo_descarte='score1_abaixo_do_corte',
        atualizado_em=now()
      WHERE id=$1`,
      [lead_id, score, breakdownJson]
    );
  }

  return { cnpj, score, corte, passou };
};

function parseCriterios(criterios) {
  if (criterios?.params) return criterios.params;
  const p = { cnaes: [], ufs: [], portes: [], capital_min: null, simples: null };
  for (const chip of (criterios?.chips || [])) {
    const idx = chip.indexOf(': ');
    if (idx === -1) continue;
    const key = chip.slice(0, idx).trim();
    const val = chip.slice(idx + 2).trim();
    if (!val) continue;
    if (key === 'UF') p.ufs.push(val);
    if (key === 'CNAE') p.cnaes.push(val.replace(/\D/g, ''));
    if (key === 'Porte') p.portes.push(val.toLowerCase());
  }
  return p;
}

function computeScore1(emp, params) {
  let score = 0;
  const breakdown = [];
  const add = (item, pts) => { if (pts) { score += pts; breakdown.push({ item, pts }); } };

  if (/ativa/i.test(emp.situacao || 'Ativa')) add('Situação ativa', W.SITUACAO_ATIVA);

  if (params.cnaes?.length && emp.cnae) {
    const cnaeClean = String(emp.cnae).replace(/\D/g, '');
    const exato = params.cnaes.some(c => c.replace(/\D/g, '') === cnaeClean);
    const grupo = !exato && params.cnaes.some(c => c.replace(/\D/g, '').slice(0, 4) === cnaeClean.slice(0, 4));
    if (exato) add(`CNAE exato (${emp.cnae})`, W.CNAE_EXATO);
    else if (grupo) add(`CNAE do mesmo grupo (${emp.cnae})`, W.CNAE_GRUPO);
  } else if (!params.cnaes?.length) {
    add('CNAE (sem filtro na busca)', Math.round(W.CNAE_EXATO * 0.5));
  }

  if (params.ufs?.length && emp.uf) {
    if (params.ufs.includes(emp.uf)) add(`UF ${emp.uf}`, W.UF);
  } else if (!params.ufs?.length) {
    add('UF (sem filtro na busca)', Math.round(W.UF * 0.5));
  }

  if (params.portes?.length && emp.porte) {
    const porteNorm = emp.porte.toLowerCase();
    if (params.portes.some(p => porteNorm.includes(p.toLowerCase()) || p.toLowerCase().includes(porteNorm))) {
      add(`Porte ${emp.porte}`, W.PORTE);
    }
  } else if (!params.portes?.length) {
    add('Porte (sem filtro na busca)', Math.round(W.PORTE * 0.5));
  }

  if (!params.capital_min) {
    add('Capital (sem filtro na busca)', Math.round(W.CAPITAL * 0.5));
  } else if (emp.capital) {
    add('Capital (faixa registrada)', Math.round(W.CAPITAL * 0.5));
  }

  if (params.simples != null && emp.opcao_simples != null) {
    if (params.simples === emp.opcao_simples) add(`Simples: ${emp.opcao_simples ? 'Sim' : 'Não'}`, W.SIMPLES);
  } else {
    add('Simples (sem filtro na busca)', Math.round(W.SIMPLES * 0.5));
  }

  return { score: Math.min(100, score), breakdown };
}
