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

  // ── Perfilamento: SÓ o lookalike destila um perfil médio pra buscar semelhantes.
  // A importação (tipo 'cnpj') NÃO perfila: cada CNPJ é importado como pedido e
  // qualifica por intenção no Score 1 (o enriquecimento acontece no laço abaixo,
  // respeitando o limite grátis de 5/min da Receita).
  if (tipo === 'lookalike' && !(criterios.params && criterios.params.perfil)) {
    const resultado = await perfilar(pool, criterios, busca_id, busca.lista);
    if (resultado.erro) return resultado;
    criterios = resultado.criterios;
  }

  // Teto diário GERAL de leads (empresas qualificadas) já bate zero antes de
  // começar? Nem vale a pena varrer hoje. O teto de verdade (preciso, à prova de
  // corrida) é aplicado no Score 1, no momento exato em que o lead nasceria —
  // aqui é só uma saída rápida pra não gastar crédito à toa num dia já esgotado.
  // A cota da HORA atual (mesmo teto, dividido por 24) também é checada aqui —
  // evita ficar paginando a CNPJá à toa numa hora já cheia; a busca continua
  // "Ativa" e o scheduler tenta de novo no próximo ciclo (60s), retomando assim
  // que a hora virar ou o dia liberar orçamento.
  const [orcamentoDia, orcamentoDaHora] = await Promise.all([orcamentoHoje(pool), orcamentoHora(pool)]);
  if (orcamentoDia <= 0 || orcamentoDaHora <= 0) {
    await pool.query(`UPDATE buscas SET ultimo_heartbeat=now() WHERE id=$1`, [busca_id]);
    return {
      skipped: orcamentoDia <= 0 ? 'limite_diario' : 'cadencia_horaria',
      motivo: orcamentoDia <= 0 ? 'teto diário de leads atingido' : 'cota da hora atual já usada — retoma na próxima hora',
      novos: 0,
    };
  }

  // ── Modo WEB-FIRST (icp): descobre pela internet e confirma CNPJ/ativa na CNPJá.
  if (tipo === 'icp') {
    const modo = criterios.params?.modo_descoberta || await modoPadrao(pool);
    if (modo === 'web') {
      return descobrirWebFirst(pool, queues, busca_id, criterios, ig?.key_cifrada || null);
    }
  }

  // ── Modo importação: os leads SÃO os CNPJs da lista (sem expandir) ──────────
  if (tipo === 'cnpj') {
    const cnpjs = perfilamento.parseCnpjs(criterios);
    const counters = { novos: 0, pulados: 0, enfileirados: 0, total: cnpjs.length };
    for (const cnpj of cnpjs) {
      // Import é um pedido EXPLÍCITO por este CNPJ. Regra à prova de estado:
      //  • Se JÁ existe um lead vivo pra este CNPJ (qualquer busca), não duplica —
      //    pula (pra atualizar dados desse lead, use "Re-enriquecer").
      //  • Se NÃO existe lead (foi excluído, ou é empresa nova/órfã), destrava a
      //    empresa de QUALQUER estado travado (descarte_duro/em_crm/qualificado)
      //    e reprocessa com busca de contato fresca.
      const { rows: [temLead] } = await pool.query(`SELECT 1 FROM leads WHERE cnpj=$1 LIMIT 1`, [cnpj]);
      if (temLead) { counters.pulados++; continue; }
      const { rows: [estadoAtual] } = await pool.query(
        `SELECT estado_global FROM empresa_tenant_estado WHERE cnpj=$1`, [cnpj]);
      if (estadoAtual && estadoAtual.estado_global !== 'coletado') {
        await pool.query(`UPDATE empresas SET contatos_verificados='[]'::jsonb WHERE cnpj=$1`, [cnpj]);
      }
      await pool.query(
        `INSERT INTO empresa_tenant_estado (cnpj, estado_global) VALUES ($1, 'coletado')
         ON CONFLICT (cnpj, tenant_id) DO UPDATE SET estado_global='coletado', atualizado_em=now()
         WHERE empresa_tenant_estado.estado_global <> 'coletado'`, [cnpj]);
      let { rows: [emp] } = await pool.query(`SELECT * FROM empresas WHERE cnpj=$1`, [cnpj]);
      if (!emp) {
        // Consulta o cadastro no endpoint aberto (grátis). Se bater no limite de
        // 5/min (429), ESPERA e tenta de novo — em vez de descartar o CNPJ. É o
        // que faz a lista grande do upload ir sendo processada ~5/min sem perder.
        try { const f = await enrichComRetry(cnpj); await upsertEmpresa(pool, f); emp = f; }
        catch (_) { counters.pulados++; continue; }   // CNPJ inválido/indisponível → pula
      }
      await processarOffice(pool, queues, busca_id, emp, counters);
      await pool.query(`UPDATE buscas SET ultimo_heartbeat=now() WHERE id=$1`, [busca_id]);   // sinal de vida em lista longa
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

// Quantos leads (empresas qualificadas) ainda cabem hoje no teto geral
// (config.limite_diario). Usado como saída rápida aqui; o Score 1 refaz esta
// mesma consulta na hora exata de criar o lead (checagem precisa).
async function orcamentoHoje(pool) {
  const { rows: [cfg] } = await pool.query(`SELECT limite_diario FROM config`);
  const limite = cfg?.limite_diario ?? 350;
  if (!limite) return Number.MAX_SAFE_INTEGER;   // 0 = sem teto
  const { rows: [{ n }] } = await pool.query(
    `SELECT COUNT(*)::int n FROM leads WHERE criado_em >= date_trunc('day', now())`
  );
  return Math.max(0, limite - n);
}

// Cota da HORA atual (limite diário / 24, arredondado pra cima) — ver score1.js.
async function orcamentoHora(pool) {
  const { rows: [cfg] } = await pool.query(`SELECT limite_diario FROM config`);
  const limite = cfg?.limite_diario ?? 350;
  if (!limite) return Number.MAX_SAFE_INTEGER;
  const porHora = Math.max(1, Math.ceil(limite / 24));
  const { rows: [{ n }] } = await pool.query(
    `SELECT COUNT(*)::int n FROM leads WHERE criado_em >= date_trunc('hour', now())`
  );
  return Math.max(0, porHora - n);
}

const semAcentoLower = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function modoPadrao(pool) {
  try { const { rows: [c] } = await pool.query(`SELECT descoberta_modo_padrao FROM config`); return c?.descoberta_modo_padrao || 'cnpja'; }
  catch { return 'cnpja'; }
}

// Chave da busca web (Tavily), se houver integração ativa. Grátis por padrão.
async function chaveBuscaWeb(pool) {
  try {
    const { rows: [ig] } = await pool.query(
      `SELECT key_cifrada FROM integracoes
       WHERE categoria='busca_web' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
       ORDER BY ordem LIMIT 1`
    );
    return ig?.key_cifrada || null;
  } catch { return null; }
}

// ── Descoberta WEB-FIRST ──────────────────────────────────────────────────────
// Parte da internet (como o cliente pesquisaria no Google), pega o site, tenta o
// CNPJ do rodapé (grátis) e confirma ativa/sócios na CNPJá. Só cai na CNPJá paga
// (names.in) quando o site não expõe o CNPJ. Guarda o site pra a validação reusar.
async function descobrirWebFirst(pool, queues, busca_id, criterios, cnpjaKey) {
  const p = criterios.params || {};
  const termo = ((p.keywords || []).join(' ').trim())
    || ((p.cnaes_rotulos || []).map(x => x.d).join(' ').trim());
  const uf = (p.ufs || [])[0] || '';
  const cidade = (p.municipios_rotulos || [])[0]?.n || '';
  if (!termo) {
    await pool.query(`UPDATE buscas SET ultimo_heartbeat=now() WHERE id=$1`, [busca_id]);
    return { skipped: 'sem_termo_web', motivo: 'modo internet exige palavra-chave (ou atividade)', novos: 0 };
  }

  // Confirmação paga (names.in) só quando o site não traz o CNPJ — bem mais cara
  // que o modo Por CNPJ (que é ~1 crédito por 100 empresas). Teto diário próprio
  // + interruptor, pra não gastar sem controle enquanto o custo real não é medido.
  const { rows: [cfgWeb] } = await pool.query(
    `SELECT web_paid_lookup_ativo, web_paid_lookup_limite FROM config`
  );
  const pagoAtivo = cfgWeb?.web_paid_lookup_ativo ?? true;
  const pagoLimite = cfgWeb?.web_paid_lookup_limite ?? 30;
  // Mesmo teto diário, dividido por 24h — evita gastar o limite do dia inteiro
  // logo nos primeiros minutos se a busca ficar ligada direto.
  const pagoLimiteHora = pagoLimite > 0 ? Math.max(1, Math.ceil(pagoLimite / 24)) : 0;
  let pagoUsadoHoje = pagoAtivo ? await contadorHoje(pool, 'web_paid_lookup') : 0;
  let pagoUsadoHora = pagoAtivo ? await contadorHora(pool, 'web_paid_lookup') : 0;

  // Chave de busca web (Tavily): quando ativa, o motor de busca fica mais estável;
  // sem ela, cai no DuckDuckGo grátis. Não é gasto pago da CNPJá — é só a camada
  // de "encontrar na web".
  const tavilyKey = await chaveBuscaWeb(pool);

  const candidatos = await google.buscarEmpresasWeb(termo, cidade, uf, 40, { tavilyKey });
  const counters = { novos: 0, pulados: 0, enfileirados: 0, total: candidatos.length, via_site: 0, via_cnpja: 0, via_cnpja_bloqueado: 0 };

  for (const cand of candidatos) {
    const s = await google.scrapeSite(cand.site);

    let firmo = null;
    if (s.cnpj) { try { firmo = await cnpja.enrichCnpj(s.cnpj); counters.via_site++; } catch (_) {} } // grátis
    if (!firmo && cnpjaKey) {
      if (pagoAtivo && pagoUsadoHoje < pagoLimite && pagoUsadoHora < pagoLimiteHora) {
        firmo = await resolverPorNome(cand.titulo || cand.site, uf, cidade, cnpjaKey);
        if (firmo) {
          counters.via_cnpja++; pagoUsadoHoje++; pagoUsadoHora++;
          await Promise.all([incrementarContador(pool, 'web_paid_lookup'), incrementarContadorHora(pool, 'web_paid_lookup')]);
        }
      } else {
        counters.via_cnpja_bloqueado++;   // site sem CNPJ + confirmação paga desligada/esgotada hoje ou nesta hora
      }
    }

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
    `UPDATE buscas SET status='Esgotada', ultimo_heartbeat=now() WHERE id=$1`, [busca_id]
  );
  return { modo: 'web', ...counters };
}

// Contador diário genérico (tabela `contadores`), usado pelo teto de confirmação
// paga do modo internet.
async function contadorHoje(pool, chave) {
  const { rows: [c] } = await pool.query(
    `SELECT valor FROM contadores WHERE chave=$1 AND dia=CURRENT_DATE`, [chave]
  );
  return c?.valor || 0;
}
async function incrementarContador(pool, chave) {
  await pool.query(
    `INSERT INTO contadores (chave, dia, valor) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (tenant_id, chave, dia) DO UPDATE SET valor = contadores.valor + 1`, [chave]
  );
}

// Mesmo contador, mas por HORA (tabela separada) — usado só pra fracionar o
// teto diário de confirmação paga ao longo do dia, sem mexer no total diário.
async function contadorHora(pool, chave) {
  const { rows: [c] } = await pool.query(
    `SELECT valor FROM contadores_hora WHERE chave=$1 AND dia=CURRENT_DATE AND hora=EXTRACT(HOUR FROM now())`, [chave]
  );
  return c?.valor || 0;
}
async function incrementarContadorHora(pool, chave) {
  await pool.query(
    `INSERT INTO contadores_hora (chave, dia, hora, valor) VALUES ($1, CURRENT_DATE, EXTRACT(HOUR FROM now()), 1)
     ON CONFLICT (tenant_id, chave, dia, hora) DO UPDATE SET valor = contadores_hora.valor + 1`, [chave]
  );
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

// Enriquecimento individual (endpoint aberto, grátis) tolerante ao limite de
// 5/min: no 429, espera o retry-after (limitado) e tenta de novo, até 6 vezes.
// Assim uma lista longa vinda de upload vai sendo consumida ~5/min sem descartar.
async function enrichComRetry(cnpj, maxTentativas = 6) {
  for (let i = 1; ; i++) {
    try {
      return await cnpja.enrichCnpj(cnpj);
    } catch (e) {
      if (e.code === 'RATE_LIMIT' && i < maxTentativas) {
        const espera = Math.min(Math.max((e.retryAfter || 60), 5), 70) * 1000;
        await new Promise(r => setTimeout(r, espera));
        continue;
      }
      throw e;   // outro erro (CNPJ inválido) ou acabaram as tentativas
    }
  }
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

// Portão de existência: empresa já TRAVADA (qualificada/no CRM/descarte duro em
// QUALQUER busca anterior) é pulada de vez — nunca mais vira lead, em nenhuma
// busca. Empresa só "coletada" (nunca qualificou antes) PODE ser reavaliada por
// uma busca diferente, com critério diferente — só o score é recalculado.
// O lead só é CRIADO se/quando qualificar no Score 1 (não aqui na descoberta).
async function processarOffice(pool, queues, busca_id, office, counters) {
  if (!office.cnpj || office.cnpj.length !== 14) return;
  if (office.situacao && !/ativa/i.test(office.situacao)) { counters.pulados++; return; }

  // Trava é POR TENANT (empresa_tenant_estado); o cadastro em si (empresas) é
  // global e compartilhado — por isso são duas checagens separadas.
  const { rows: [travaTenant] } = await pool.query(
    `SELECT estado_global FROM empresa_tenant_estado WHERE cnpj=$1`, [office.cnpj]
  );
  if (travaTenant && TRAVADOS.includes(travaTenant.estado_global)) { counters.pulados++; return; }

  const { rows: [existente] } = await pool.query(
    `SELECT 1 FROM empresas WHERE cnpj=$1`, [office.cnpj]
  );
  if (!existente) {
    await upsertEmpresa(pool, office);
    counters.novos++;
  }

  // Registra que ESTE tenant descobriu o CNPJ (estado 'coletado', sem rebaixar
  // estados superiores). É o que faz "empresas encontradas" contar por cliente
  // mesmo com o cadastro `empresas` sendo global.
  await pool.query(
    `INSERT INTO empresa_tenant_estado (cnpj, estado_global) VALUES ($1, 'coletado')
     ON CONFLICT (cnpj, tenant_id) DO NOTHING`, [office.cnpj]
  );

  await queues.enriquecimento.add('enriquecimento',
    { cnpj: office.cnpj, busca_id },
    { removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );
  counters.enfileirados++;
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
