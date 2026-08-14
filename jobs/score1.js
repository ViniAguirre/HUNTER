'use strict';
/*
 * Hunter — Score 1 (Fase 3, grátis: firmográfico).
 * Decide quem sobrevive ao corte ANTES de gastar qualquer chave paga de
 * contato. Roda com dado 100% grátis (firmografia da Receita via CNPJá):
 * CNAE, porte, capital (faixa), UF, situação, opção pelo Simples. O
 * contato bruto da Receita NUNCA entra aqui como sinal positivo.
 *
 * O LEAD SÓ NASCE AQUI, se/quando a empresa qualifica. Quem não qualifica não
 * vira lead — só incrementa `buscas.fora_perfil` (empresa verificada mas fora
 * do perfil desta busca). Isso mantém `leads` limpo: só empresas qualificadas.
 */

const perfilamento = require('../providers/perfil');
const orcamento = require('./orcamento');

const W = {
  CNAE_EXATO: 35,
  CNAE_GRUPO: 15,
  UF: 25,
  PORTE: 20,
  CAPITAL: 10,
  SIMPLES: 5,
  SITUACAO_ATIVA: 5,
};

const MAX_TENTATIVAS_ORCAMENTO = 96; // ~48h em ciclos de 30min — evita ficar preso pra sempre

module.exports = async function score1(job, pool, queues) {
  const { cnpj, busca_id } = job.data;

  const [empresaRes, buscaRes] = await Promise.all([
    pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [cnpj]),
    pool.query(`SELECT tipo, criterios, corte_score FROM buscas WHERE id=$1`, [busca_id]),
  ]);
  const empresa = empresaRes.rows[0];
  const busca = buscaRes.rows[0];

  if (!empresa || !busca) {
    // Nada foi criado ainda pra essa empresa/busca — não há lead pra descartar.
    return { error: 'empresa ou busca ausente', cnpj };
  }

  const params = parseCriterios(busca.criterios);
  let { score, breakdown } = computeScore1(empresa, params);
  const corte = busca.corte_score ?? 60;
  // Importação por CNPJ: o usuário pediu explicitamente ESTA empresa — qualifica
  // por intenção, sem corte de score. Com lista curta (sem perfil médio), o score
  // proximidade nem existe; marca o motivo real no breakdown.
  const importacao = busca.tipo === 'cnpj';
  if (importacao && !params?.perfil) {
    score = 100;
    breakdown = [{ item: 'Importada por CNPJ (solicitada explicitamente)', pts: 100 }];
  }
  const passou = importacao ? true : score >= corte;

  if (!passou) {
    // Verificada mas fora do perfil: NÃO vira lead — só conta na busca.
    await pool.query(`UPDATE buscas SET fora_perfil = fora_perfil + 1 WHERE id=$1`, [busca_id]);
    return { cnpj, score, corte, passou: false };
  }

  // Qualificou. Checagem PRECISA do teto diário — feita exatamente aqui, no
  // momento em que o lead nasceria (evita corrida: cada worker relê o valor
  // fresco antes de criar). Se estourou, reagenda pra tentar de novo mais tarde
  // em vez de descartar uma empresa boa por causa de timing.
  // Também respeita a cota DESTA hora (limite diário / 24) — sem isso, uma busca
  // ligada direto consumiria o dia inteiro na primeira hora em vez de espalhar
  // a captação ao longo do dia.
  const vagas = await orcamento.disponivel(pool);
  if (vagas.dia <= 0 || vagas.hora <= 0) {
    const tentativas = (job.data.tentativa_orcamento || 0) + 1;
    if (tentativas <= MAX_TENTATIVAS_ORCAMENTO && queues?.score1) {
      await queues.score1.add('score1', { cnpj, busca_id, tentativa_orcamento: tentativas },
        { delay: 30 * 60 * 1000, removeOnComplete: { count: 50 }, removeOnFail: { count: 50 } });
    }
    return { cnpj, score, corte, passou: true, aguardando_orcamento: true, tentativas,
      motivo: vagas.foraDaJanela ? 'fora_da_janela' : (vagas.dia <= 0 ? 'limite_diario' : 'cadencia_horaria') };
  }

  const breakdownJson = JSON.stringify(breakdown);
  const { rows: [lead] } = await pool.query(`
    INSERT INTO leads (busca_id, empresa_cnpj, cnpj, fantasia, razao, setor, cnae, porte, cidade, uf,
      decisor, cargo, score, breakdown, situacao, abertura, capital, endereco, estagio, status, origem)
    VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,'scored','Novo','cnpja')
    ON CONFLICT (busca_id, cnpj) DO NOTHING
    RETURNING id`,
    [busca_id, cnpj, empresa.fantasia || empresa.razao, empresa.razao, empresa.setor, empresa.cnae,
     empresa.porte, empresa.cidade, empresa.uf, empresa.decisor, empresa.cargo, score, breakdownJson,
     empresa.situacao, empresa.abertura, empresa.capital, empresa.endereco]
  );

  if (!lead) {
    // Corrida rara: essa busca já tinha criado o lead pra este CNPJ. Nada a fazer.
    return { cnpj, score, corte, passou: true, skipped: 'lead_ja_existe' };
  }

  // Consome 1 vaga do teto do dia/hora. Fica registrado mesmo se o lead for
  // apagado depois (ex.: validação não achou telefone) — o crédito de CNPJá e a
  // busca de contato JÁ foram gastos, então a vaga não pode voltar pro caixa.
  await orcamento.registrarLead(pool).catch(e =>
    console.error(`[score1] falha ao registrar consumo do lead ${lead.id}: ${e.message}`));

  // Trava o CNPJ pra sempre: nenhuma outra busca (nem esta, de novo) volta a
  // criar lead pra ele. Só sobe o estado (nunca rebaixa de em_crm pra qualificado).
  await pool.query(
    `INSERT INTO empresa_tenant_estado (cnpj, estado_global) VALUES ($1, 'qualificado')
     ON CONFLICT (cnpj, tenant_id) DO UPDATE SET estado_global='qualificado', atualizado_em=now()
     WHERE empresa_tenant_estado.estado_global='coletado'`, [cnpj]
  );

  // Passou no corte → validação de contato do decisor (que depois chama o
  // SWOT). Sem provedor de validação ativo, a etapa só repassa pro SWOT.
  if (queues?.validacao) {
    await queues.validacao.add('validacao', { cnpj, busca_id, lead_id: lead.id },
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
  } else if (queues?.swot) {
    await queues.swot.add('swot', { cnpj, busca_id, lead_id: lead.id },
      { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
  }

  return { cnpj, score, corte, passou: true, lead_id: lead.id };
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
  // Busca lookalike: nota por PROXIMIDADE ao perfil médio da lista (mesma
  // escala 0–100, mesmo corte). Quem se parece com o núcleo da lista pontua mais.
  if (params?.perfil) {
    return perfilamento.pontuarProximidade(emp, params.perfil, W);
  }

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
