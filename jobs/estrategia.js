'use strict';
/*
 * Hunter — Estratégia (piloto automático de radares).
 *
 * O usuário escreve uma LINHA EDITORIAL: uma lista ordenada de pautas. Cada
 * pauta é um molde de radar (filtros de perfil, ou uma lista de semelhantes)
 * mais as REGIÕES a seguir, em ordem, e o PERÍODO em que ela vale (semanas do
 * mês, meses do ano). Uma pauta com 4 regiões vira até 4 radares, um de cada
 * vez: quando o radar de uma região esgota, o piloto abre o da próxima.
 *
 * O piloto roda no worker, a cada ciclo do scheduler (60s), e só abre radar
 * quando isso vai virar lead de verdade — ou seja, respeitando os limites de
 * Configurações (teto diário, cadência por hora, horário e dias de
 * funcionamento) e a esteira: se já tem empresa aprovada esperando vaga no
 * limite, ou empresa descoberta ainda na fila de análise, abrir radar novo só
 * gastaria crédito da CNPJá pra aumentar a fila.
 */
const orcamento = require('./orcamento');

// Quantas empresas ainda sem veredito (enriquecimento → filtro → score) seguram
// a abertura do próximo radar. Uma página da CNPJá são 100 empresas: com a
// esteira abaixo de meia página, o radar atual já está no fim.
const LIMIAR_FILA = 50;
// Radares esgotados há mais que isso podem ser varridos de novo quando a linha
// editorial acaba e o plano está em "recomeçar". Menos que um mês a CNPJá quase
// não tem empresa nova pra devolver — seria pagar pelas mesmas páginas.
const DIAS_RECOMECO = 30;
const MAX_SIMULTANEOS = 5;
const MAX_REGIOES = 60;
const MAX_PAUTAS = 50;

const UFS = new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
  'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);

// Fronteiras entre os estados — é por elas que a expansão automática anda:
// quem vende bem em SP tende a vender bem em MG/PR antes de vender no AM. A
// tabela é fechada em simetria abaixo, então basta listar cada par uma vez.
const VIZINHOS = (() => {
  const pares = {
    AC:['AM','RO'], AL:['PE','SE','BA'], AP:['PA'], AM:['RO','MT','PA','RR'],
    BA:['SE','PE','PI','TO','GO','MG','ES'], CE:['RN','PB','PE','PI'], DF:['GO','MG'],
    ES:['MG','RJ'], GO:['MG','TO','MT','MS'], MA:['PI','TO','PA'], MT:['RO','PA','TO','MS'],
    MS:['MG','SP','PR'], MG:['RJ','SP'], PA:['RR','TO'], PB:['RN','PE'], PR:['SP','SC'],
    PE:['PI'], PI:['TO'], RJ:['SP'], RS:['SC'],
  };
  const v = {};
  for (const uf of UFS) v[uf] = new Set();
  for (const [a, bs] of Object.entries(pares)) for (const b of bs) { v[a].add(b); v[b].add(a); }
  return v;
})();
// Desempate da expansão: do maior mercado (mais empresas ativas) pro menor.
const UFS_POR_MERCADO = ['SP','MG','RJ','PR','RS','SC','BA','GO','PE','CE','ES','DF','PA','MT','MS',
  'MA','RN','PB','AM','AL','PI','SE','RO','TO','AC','AP','RR'];
// Pauta que já varreu isso tudo sem virar um lead sequer não expande: o
// problema é o filtro, não a região — levar pra outro estado só gasta crédito.
const EXPANSAO_MIN_AMOSTRA = 200;
const EXPANSAO_MAX = 27;

class ErroEstrategia extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

// Semana do mês: dias 1–7 são a 1ª, 8–14 a 2ª… 29–31 a 5ª. É a conta que uma
// pessoa faz olhando o calendário ("primeira semana do mês"), sem depender de
// em que dia da semana o mês começou.
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const semanaDoMes = dia => Math.min(5, Math.ceil(dia / 7));

function noPeriodo(p, per) {
  const semanas = p.semanas || [], meses = p.meses || [];
  return (!semanas.length || semanas.includes(per.semana))
      && (!meses.length || meses.includes(per.mes));
}

// Data de hoje no fuso de Configurações (o container roda em UTC: às 22h de
// 31/03 em Brasília já é 01/04 lá, e a pauta de abril entraria 3h antes).
async function periodoAtual(db) {
  let tz = orcamento.TZ_PADRAO;
  try {
    const { rows: [c] } = await db.query(`SELECT janela_tz FROM config`);
    if (c?.janela_tz) tz = c.janela_tz;
  } catch (_) { /* coluna antiga: fica o padrão */ }
  const { rows: [r] } = await db.query(
    `SELECT EXTRACT(DAY FROM now() AT TIME ZONE $1)::int AS dia,
            EXTRACT(MONTH FROM now() AT TIME ZONE $1)::int AS mes,
            EXTRACT(YEAR FROM now() AT TIME ZONE $1)::int AS ano`, [tz]);
  return { dia: r.dia, mes: r.mes, ano: r.ano, semana: semanaDoMes(r.dia), tz };
}

// ── Regiões ──────────────────────────────────────────────────────────────────
// Uma região é um recorte geográfico que vira UM radar: um estado, um grupo de
// estados ("Sul") ou uma ou mais cidades. A chave é derivada do conteúdo (e não
// da posição na lista) pra reordenar ou renomear não fazer o piloto achar que
// é região nova e varrer de novo.
function normalizarRegiao(r) {
  if (!r || typeof r !== 'object') return null;
  const municipios = [];
  const vistos = new Set();
  for (const m of Array.isArray(r.municipios_rotulos) ? r.municipios_rotulos : []) {
    const c = String(m?.c || '').replace(/\D/g, '');
    const uf = String(m?.uf || '').toUpperCase();
    if (c.length !== 7 || vistos.has(c)) continue;
    vistos.add(c);
    municipios.push({ c, n: String(m?.n || '').trim().slice(0, 80), uf: UFS.has(uf) ? uf : '' });
  }
  let ufs = [...new Set((Array.isArray(r.ufs) ? r.ufs : []).map(u => String(u).toUpperCase()).filter(u => UFS.has(u)))];
  // Cidade sem a UF junto casava homônimos na busca local ("São José" de SC,
  // SP e RN): a UF da própria cidade entra no filtro.
  for (const m of municipios) if (m.uf && !ufs.includes(m.uf)) ufs.push(m.uf);
  ufs.sort();
  if (!ufs.length && !municipios.length) return null;
  const chave = municipios.length
    ? 'mun:' + municipios.map(m => m.c).sort().join(',')
    : 'uf:' + ufs.join(',');
  const auto = municipios.length
    ? municipios.map(m => m.uf ? `${m.n}/${m.uf}` : m.n).join(', ')
    : ufs.join('/');
  const rotulo = String(r.rotulo || '').trim().slice(0, 80) || auto;
  const out = { chave, rotulo, ufs, municipios_cod: municipios.map(m => m.c), municipios_rotulos: municipios };
  // Região que o próprio piloto acrescentou (expansão automática) e por quê.
  if (r.auto) { out.auto = true; out.motivo = String(r.motivo || '').slice(0, 200); }
  return out;
}

function normalizarRegioes(lista) {
  const out = [], chaves = new Set();
  for (const r of Array.isArray(lista) ? lista : []) {
    const n = normalizarRegiao(r);
    if (!n || chaves.has(n.chave)) continue;
    chaves.add(n.chave);
    out.push(n);
  }
  if (out.length > MAX_REGIOES) throw new ErroEstrategia(`no máximo ${MAX_REGIOES} regiões por pauta`);
  return out;
}

// Pauta sem região nenhuma = um radar só, com a geografia que os filtros
// tiverem (ou, no semelhantes, onde os clientes da lista já estão).
const REGIAO_UNICA = { chave: 'br', rotulo: 'Sem região definida', ufs: [], municipios_cod: [], municipios_rotulos: [] };
const regioesDa = p => (Array.isArray(p.regioes) && p.regioes.length ? p.regioes : [REGIAO_UNICA]);

const intsEntre = (v, min, max) => [...new Set((Array.isArray(v) ? v : [])
  .map(Number).filter(n => Number.isInteger(n) && n >= min && n <= max))].sort((a, b) => a - b);

// Valida o que vem da tela (ou de qualquer cliente da API). Parcial = PATCH:
// só valida o que veio.
function normalizarPauta(b, { parcial = false } = {}) {
  const out = {};
  if (!parcial || 'nome' in b) {
    const nome = String(b.nome || '').trim();
    if (!nome) throw new ErroEstrategia('dê um nome à pauta');
    out.nome = nome.slice(0, 120);
  }
  if (!parcial || 'tipo' in b) {
    out.tipo = b.tipo === 'lookalike' ? 'lookalike' : 'icp';
  }
  if (!parcial || 'lista' in b) out.lista = String(b.lista || '').trim() || null;
  if ((out.tipo === 'lookalike') && !out.lista) {
    throw new ErroEstrategia('pauta de semelhantes precisa de uma lista de clientes');
  }
  if (!parcial || 'criterios' in b) {
    const c = b.criterios && typeof b.criterios === 'object' && !Array.isArray(b.criterios) ? b.criterios : {};
    if (JSON.stringify(c).length > 50_000) throw new ErroEstrategia('filtros grandes demais');
    out.criterios = c;
  }
  if (!parcial || 'regioes' in b) out.regioes = normalizarRegioes(b.regioes);
  if (!parcial || 'semanas' in b) out.semanas = intsEntre(b.semanas, 1, 5);
  if (!parcial || 'meses' in b) out.meses = intsEntre(b.meses, 1, 12);
  if (!parcial || 'corte_score' in b) {
    const n = Number(b.corte_score);
    out.corte_score = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 60;
  }
  if (!parcial || 'crm_auto' in b) out.crm_auto = !!b.crm_auto;
  if (!parcial || 'crm_queue_id' in b) out.crm_queue_id = String(b.crm_queue_id || '').trim() || null;
  if (!parcial || 'expandir' in b) out.expandir = !!b.expandir;
  if (!parcial || 'expandir_max' in b) {
    const n = parseInt(b.expandir_max, 10);
    out.expandir_max = Number.isFinite(n) ? Math.max(1, Math.min(EXPANSAO_MAX, n)) : 5;
  }
  if (!parcial || 'expandir_excluir' in b) {
    out.expandir_excluir = [...new Set((Array.isArray(b.expandir_excluir) ? b.expandir_excluir : [])
      .map(u => String(u).toUpperCase()).filter(u => UFS.has(u)))].sort();
  }
  if ('ativo' in b) out.ativo = !!b.ativo;
  return out;
}

// Molde (pauta) + região → radar. Mesmo formato que a tela "Criar Radar" grava,
// pra descoberta tratar os dois sem diferença nenhuma.
function montarRadar(p, reg) {
  const crit = JSON.parse(JSON.stringify(p.criterios || {}));
  const nome = reg.chave === REGIAO_UNICA.chave ? p.nome : `${p.nome} — ${reg.rotulo}`;
  if (p.tipo === 'lookalike') {
    // A lista diz O QUE procurar; a região, ONDE. Sem params: a descoberta
    // perfila a lista na primeira rodada, como num semelhantes criado à mão.
    delete crit.params;
    crit.geo = { ufs: reg.ufs, municipios_cod: reg.municipios_cod, municipios_rotulos: reg.municipios_rotulos };
  } else {
    const params = { ...(crit.params || {}) };
    params.ufs = reg.ufs;
    params.municipios_cod = reg.municipios_cod;
    params.municipios_rotulos = reg.municipios_rotulos;
    crit.params = params;
    crit.chips = (Array.isArray(crit.chips) ? crit.chips : [])
      .filter(c => !/^(UF|Município): /.test(c))
      .concat(reg.ufs.map(u => `UF: ${u}`), reg.municipios_rotulos.map(m => `Município: ${m.n}`));
  }
  return {
    nome: nome.slice(0, 200), tipo: p.tipo, criterios: crit,
    lista: p.tipo === 'lookalike' ? p.lista : null,
    corte_score: p.corte_score ?? 60, crm_auto: !!p.crm_auto, crm_queue_id: p.crm_queue_id || null,
  };
}

// ── Expansão automática ───────────────────────────────────────────────────────
// A pauta acabou as regiões que a pessoa escolheu: qual a próxima? Regras, em
// ordem, todas explicáveis no diário (nada de caixa-preta):
//   1. cidade varrida → o estado inteiro dela;
//   2. estado vizinho de uma região já varrida, começando pelo vizinho da
//      região que MAIS rendeu (empresas encontradas que viraram lead);
//   3. empate → o maior mercado.
// `usadas` = chaves que já viraram radar nesta pauta (inclusive regiões que a
// pessoa tirou da lista depois): nunca propõe de novo o que já foi varrido.
// `desempenho` = { [chave]: { encontrados, leads } }.
function proximaExpansao(p, usadas, desempenho = {}) {
  const regs = Array.isArray(p.regioes) ? p.regioes : [];
  if (!p.expandir || !regs.length) return null;
  if (regs.filter(r => r.auto).length >= (p.expandir_max || 5)) return null;
  const excluir = new Set(p.expandir_excluir || []);
  const chaves = new Set(regs.map(r => r.chave));
  const livre = uf => !excluir.has(uf) && !chaves.has('uf:' + uf) && !usadas.has('uf:' + uf);
  const taxa = r => {
    const d = desempenho[r.chave];
    return d && d.encontrados >= 20 ? d.leads / d.encontrados : null;
  };
  const pct = t => `${Math.round(t * 100)}% das empresas encontradas lá viraram lead`;

  // 1) cidade → estado inteiro (se nenhuma região já cobre o estado todo)
  for (const r of regs) {
    if (!(r.municipios_rotulos || []).length) continue;
    for (const uf of r.ufs) {
      const cobertoInteiro = regs.some(x => !(x.municipios_rotulos || []).length && x.ufs.includes(uf));
      if (!cobertoInteiro && livre(uf)) {
        const t = taxa(r);
        return { uf, motivo: `o estado inteiro de ${r.rotulo}${t != null ? ` (${pct(t)})` : ''}` };
      }
    }
  }

  // 2) vizinhos das regiões cobertas
  const cobertas = new Set(regs.flatMap(r => r.ufs));
  const candidatos = UFS_POR_MERCADO.filter(u => !cobertas.has(u) && livre(u));
  if (!candidatos.length) return null;
  const avaliados = candidatos.map(u => {
    const origens = regs.filter(r => r.ufs.some(x => VIZINHOS[u].has(x)));
    let melhor = null, melhorTaxa = -1;
    // Empate de desempenho → cita a região de estado inteiro ("vizinho de SP"),
    // não a cidade que fica dentro dele ("vizinho de Campinas/SP").
    const ehCidade = r => (r.municipios_rotulos || []).length > 0;
    for (const r of origens) {
      const t = taxa(r) ?? -0.5;
      if (t > melhorTaxa || (t === melhorTaxa && melhor && ehCidade(melhor) && !ehCidade(r))) { melhorTaxa = t; melhor = r; }
    }
    return { uf: u, origens, melhor, melhorTaxa, mercado: UFS_POR_MERCADO.indexOf(u) };
  });
  const vizinhos = avaliados.filter(a => a.origens.length);
  if (vizinhos.length) {
    vizinhos.sort((a, b) => (b.melhorTaxa - a.melhorTaxa) || (b.origens.length - a.origens.length) || (a.mercado - b.mercado));
    const a = vizinhos[0];
    const t = a.melhorTaxa >= 0 ? a.melhorTaxa : null;
    return { uf: a.uf, motivo: `vizinho de ${a.melhor.rotulo}${t != null ? ` (${pct(t)})` : ''}` };
  }
  // 3) nenhum vizinho livre (todos excluídos/varridos): o maior mercado que sobrou
  return { uf: candidatos[0], motivo: 'o maior mercado que a pauta ainda não varreu' };
}

// ── Portão: dá pra abrir radar AGORA sem furar limite nem inchar a fila? ────────
async function contarFila(q, estados) {
  if (!q || typeof q.getJobCounts !== 'function') return 0;
  const c = await q.getJobCounts(...estados);
  return Object.values(c).reduce((s, n) => s + (n || 0), 0);
}

async function portao(pool, queues) {
  const v = await orcamento.disponivel(pool);
  if (v.foraDaJanela) return { livre: false, motivo: v.motivo || 'fora do horário de funcionamento' };
  if (v.dia <= 0) return { livre: false, motivo: 'o limite de leads de hoje já foi atingido — o próximo radar abre no próximo dia de funcionamento' };
  if (v.hora <= 0) return { livre: false, motivo: 'a cota de leads desta hora já foi usada — tenta de novo na próxima hora' };
  if (!queues) return { livre: true };
  try {
    // Empresa APROVADA esperando vaga (Score 1 adiado pelo limite): o gargalo é
    // o limite, não a falta de empresa. Radar novo só aumentaria essa fila.
    const esperandoVaga = queues.score1 ? await queues.score1.getDelayedCount() : 0;
    if (esperandoVaga > 0) {
      return { livre: false, motivo: `${esperandoVaga} empresa(s) aprovada(s) já esperam vaga no limite diário — radar novo só aumentaria a fila` };
    }
    const emAnalise =
      await contarFila(queues.enriquecimento, ['waiting', 'active', 'delayed', 'prioritized'])
      + await contarFila(queues.filtroContador, ['waiting', 'active', 'delayed', 'prioritized'])
      + await contarFila(queues.score1, ['waiting', 'active', 'prioritized']);
    if (emAnalise >= LIMIAR_FILA) {
      return { livre: false, motivo: `${emAnalise} empresa(s) ainda em análise — o próximo radar abre quando a esteira esvaziar` };
    }
  } catch (e) {
    // Redis fora: melhor não abrir do que abrir às cegas.
    return { livre: false, motivo: `não consegui ler as filas (${e.message})` };
  }
  return { livre: true };
}

// ── O piloto ──────────────────────────────────────────────────────────────────
async function evento(db, acao, { pauta_id = null, busca_id = null, detalhe = '' } = {}) {
  await db.query(
    `INSERT INTO estrategia_eventos (acao, pauta_id, busca_id, detalhe) VALUES ($1,$2,$3,$4)`,
    [acao, pauta_id, busca_id, String(detalhe || '').slice(0, 500)]);
}

async function lerPlano(db) {
  const { rows: [p] } = await db.query(`SELECT * FROM estrategia`);
  return p || null;
}

async function abrirRegiao(db, p, reg) {
  const r = montarRadar(p, reg);
  const { rows: [b] } = await db.query(
    `INSERT INTO buscas (nome, tipo, status, ritmo, criterios, corte_score, crm_auto, crm_queue_id, lista,
                         criador_id, estrategia_pauta_id, ultima_ativ)
     VALUES ($1,$2,'Ativa',120,$3::jsonb,$4,$5,$6,$7,$8,$9,now()) RETURNING id, nome`,
    [r.nome, r.tipo, JSON.stringify(r.criterios), r.corte_score, r.crm_auto, r.crm_queue_id, r.lista,
     p.criado_por || null, p.id]);
  await db.query(
    `INSERT INTO estrategia_slots (pauta_id, regiao_chave, regiao_rotulo, busca_id) VALUES ($1,$2,$3,$4)`,
    [p.id, reg.chave, reg.rotulo, b.id]);
  return b;
}

// Controle pelo CRM: o CRM conta os leads do Hunter parados na fila sem
// atendimento e avisa (POST /api/webhooks/crm/fila). Com o controle ligado,
// radar novo só abre quando a fila cai para o gatilho ou menos — o time
// comercial dita o ritmo, em vez de receber lead mais rápido do que atende.
// Sem aviso nenhum ainda, espera: ligar o controle é dizer "quem manda é o CRM".
function portaoCrm(plano) {
  if (!plano.crm_controle) return { livre: true };
  if (plano.crm_fila_em == null || plano.crm_fila_pendentes == null) {
    return { livre: false, motivo: 'o CRM ainda não informou quantos leads estão na fila sem atendimento' };
  }
  const n = plano.crm_fila_pendentes, g = plano.crm_fila_gatilho ?? 0;
  if (n > g) {
    return { livre: false, motivo: `o CRM tem ${n} lead(s) sem atendimento na fila — radar novo abre ${g === 0
      ? 'quando todos forem atendidos' : `quando cair para ${g} ou menos`}` };
  }
  return { livre: true };
}

async function passo(db, pool, queues) {
  const plano = await lerPlano(db);
  if (!plano || !plano.ativo) return { desligado: true };

  const per = await periodoAtual(db);
  const { rows: pautas } = await db.query(`SELECT * FROM estrategia_pautas ORDER BY ordem, id`);
  const elegiveis = pautas.filter(p => p.ativo && noPeriodo(p, per));
  const idsEleg = elegiveis.map(p => p.id);
  const posicao = new Map(elegiveis.map((p, i) => [p.id, i]));
  const nomePauta = new Map(pautas.map(p => [p.id, p.nome]));
  const acoes = [];

  // 1) Radar de pauta que saiu do período (ou foi desligada) pausa sozinho — e
  //    fica marcado como pausa AUTOMÁTICA, pra voltar quando o período voltar.
  //    Pausa feita à mão pelo usuário nunca é desfeita aqui.
  const { rows: pausados } = await db.query(
    `UPDATE buscas SET status='Pausada', pausa_auto=true
      WHERE estrategia_pauta_id IS NOT NULL AND status='Ativa'
        AND NOT (estrategia_pauta_id = ANY($1::int[]))
      RETURNING id, nome, estrategia_pauta_id`, [idsEleg]);
  for (const b of pausados) {
    const pauta = pautas.find(p => p.id === b.estrategia_pauta_id);
    const porque = pauta && !pauta.ativo ? 'a pauta foi desligada' : 'saiu do período da pauta';
    await evento(db, 'pausou', { pauta_id: b.estrategia_pauta_id, busca_id: b.id, detalhe: `${b.nome}: ${porque}` });
    acoes.push({ acao: 'pausou', busca_id: b.id });
  }

  const { rows: [{ n: ativos }] } = await db.query(
    `SELECT COUNT(*)::int n FROM buscas WHERE estrategia_pauta_id IS NOT NULL AND status='Ativa'`);
  const simultaneos = Math.max(1, Math.min(MAX_SIMULTANEOS, plano.simultaneos || 1));
  if (ativos >= simultaneos) {
    return { acoes, estado: ativos === 1 ? '1 radar da estratégia rodando' : `${ativos} radares da estratégia rodando` };
  }
  if (!elegiveis.length) {
    return { acoes, estado: pautas.some(p => p.ativo)
      ? `nenhuma pauta vale neste período (${per.semana}ª semana de ${MESES[per.mes - 1]})`
      : 'nenhuma pauta ativa na linha editorial' };
  }

  const gate = await portao(pool, queues);
  if (!gate.livre) return { acoes, estado: `aguardando: ${gate.motivo}` };
  const crm = portaoCrm(plano);
  if (!crm.livre) return { acoes, estado: `aguardando: ${crm.motivo}` };

  const porOrdem = rows => rows.sort((a, b) =>
    (posicao.get(a.estrategia_pauta_id) - posicao.get(b.estrategia_pauta_id)) || (a.id - b.id));

  // Um radar por ciclo (60s): abrir vários de uma vez despejaria a descoberta
  // de todos na esteira antes de o portão ter a chance de ver a fila crescer.

  // 2a) Volta o que o piloto mesmo pausou por período.
  const { rows: pausadosAuto } = await db.query(
    `SELECT id, nome, estrategia_pauta_id FROM buscas
      WHERE status='Pausada' AND pausa_auto AND estrategia_pauta_id = ANY($1::int[])`, [idsEleg]);
  if (pausadosAuto.length) {
    const b = porOrdem(pausadosAuto)[0];
    await db.query(`UPDATE buscas SET status='Ativa', pausa_auto=false, ultima_ativ=now() WHERE id=$1`, [b.id]);
    await evento(db, 'retomou', { pauta_id: b.estrategia_pauta_id, busca_id: b.id, detalhe: `${b.nome}: a pauta voltou ao período` });
    return { acoes: [...acoes, { acao: 'retomou', busca_id: b.id }], estado: `retomou "${b.nome}"` };
  }

  // 2b) Radar que parou no teto de páginas da varredura (a descoberta marca
  //     Esgotada mas guarda o cursor): ainda tem empresa — continua dele antes
  //     de abrir região nova.
  const { rows: comCursor } = await db.query(
    `SELECT id, nome, estrategia_pauta_id FROM buscas
      WHERE status='Esgotada' AND descoberta_token IS NOT NULL
        AND estrategia_pauta_id = ANY($1::int[])`, [idsEleg]);
  if (comCursor.length) {
    const b = porOrdem(comCursor)[0];
    await db.query(`UPDATE buscas SET status='Ativa', ultima_ativ=now() WHERE id=$1`, [b.id]);
    await evento(db, 'continuou', { pauta_id: b.estrategia_pauta_id, busca_id: b.id,
      detalhe: `${b.nome}: a varredura anterior parou no teto de páginas — continua de onde parou` });
    return { acoes: [...acoes, { acao: 'continuou', busca_id: b.id }], estado: `continuou "${b.nome}"` };
  }

  // 2c) Próxima região ainda não varrida, na ordem da linha editorial.
  const { rows: usados } = await db.query(`SELECT pauta_id, regiao_chave FROM estrategia_slots`);
  const usado = new Set(usados.map(s => `${s.pauta_id}|${s.regiao_chave}`));
  for (const p of elegiveis) {
    for (const reg of regioesDa(p)) {
      if (usado.has(`${p.id}|${reg.chave}`)) continue;
      const b = await abrirRegiao(db, p, reg);
      await evento(db, 'criou', { pauta_id: p.id, busca_id: b.id, detalhe: `criou e ligou "${b.nome}"` });
      return { acoes: [...acoes, { acao: 'criou', busca_id: b.id }], estado: `abriu "${b.nome}"` };
    }
  }

  // 2c') Expansão automática: acabaram as regiões que a pessoa escolheu numa
  //      pauta com "expandir" ligado → o piloto escolhe a próxima (ver
  //      proximaExpansao), grava na pauta — fica visível e editável na tela —
  //      e já abre o radar dela.
  const expansiveis = elegiveis.filter(p => p.expandir && (p.regioes || []).length);
  if (expansiveis.length) {
    const { rows: desemp } = await db.query(
      `SELECT s.pauta_id, s.regiao_chave, COALESCE(b.universo_varrido, 0)::int AS encontrados,
              (SELECT COUNT(*) FROM leads l WHERE l.busca_id = b.id)::int AS leads
         FROM estrategia_slots s LEFT JOIN buscas b ON b.id = s.busca_id
        WHERE s.pauta_id = ANY($1::int[])`, [expansiveis.map(p => p.id)]);
    for (const p of expansiveis) {
      const meus = desemp.filter(d => d.pauta_id === p.id);
      const total = meus.reduce((t, d) => ({ enc: t.enc + d.encontrados, leads: t.leads + d.leads }), { enc: 0, leads: 0 });
      if (total.enc >= EXPANSAO_MIN_AMOSTRA && total.leads === 0) {
        const { rows: ja } = await db.query(
          `SELECT 1 FROM estrategia_eventos WHERE acao='nao_expandiu' AND pauta_id=$1 LIMIT 1`, [p.id]);
        if (!ja.length) {
          await evento(db, 'nao_expandiu', { pauta_id: p.id,
            detalhe: `${p.nome}: ${total.enc} empresas encontradas e nenhuma virou lead — revise os filtros antes de levar a pauta pra outras regiões` });
        }
        continue;
      }
      const desempenho = Object.fromEntries(meus.map(d => [d.regiao_chave, d]));
      const usadas = new Set(meus.map(d => d.regiao_chave));
      const prox = proximaExpansao(p, usadas, desempenho);
      if (!prox) continue;
      const reg = normalizarRegiao({ ufs: [prox.uf], auto: true, motivo: prox.motivo });
      await db.query(
        `UPDATE estrategia_pautas SET regioes = regioes || $2::jsonb, atualizado_em=now() WHERE id=$1`,
        [p.id, JSON.stringify([reg])]);
      await evento(db, 'sugeriu', { pauta_id: p.id,
        detalhe: `${p.nome}: acabaram as regiões — escolheu ${prox.uf}, ${prox.motivo}` });
      const b = await abrirRegiao(db, { ...p, regioes: [...p.regioes, reg] }, reg);
      await evento(db, 'criou', { pauta_id: p.id, busca_id: b.id, detalhe: `criou e ligou "${b.nome}"` });
      return { acoes: [...acoes, { acao: 'sugeriu', busca_id: b.id }], estado: `expandiu a pauta e abriu "${b.nome}"` };
    }
  }

  // 2d) Linha editorial toda varrida. No modo "recomeçar", volta ao radar
  //     esgotado há mais tempo (só depois de DIAS_RECOMECO): nesse meio-tempo
  //     abriram empresas novas, e as já vistas o portão de existência pula.
  if (plano.ao_concluir === 'recomecar') {
    const { rows: [b] } = await db.query(
      `SELECT id, nome, tipo, criterios, estrategia_pauta_id FROM buscas
        WHERE status='Esgotada' AND estrategia_pauta_id = ANY($1::int[])
          AND COALESCE(ultimo_heartbeat, criado_em) < now() - make_interval(days => $2)
        ORDER BY COALESCE(ultimo_heartbeat, criado_em) LIMIT 1`, [idsEleg, DIAS_RECOMECO]);
    if (b) {
      const crit = b.criterios || {};
      // Semelhantes refaz o perfil: a lista pode ter crescido (conversões do CRM).
      if (b.tipo === 'lookalike') delete crit.params;
      await db.query(
        `UPDATE buscas SET status='Ativa', criterios=$2::jsonb, descoberta_token=NULL, descoberta_fase=1,
                           ultima_ativ=now() WHERE id=$1`, [b.id, JSON.stringify(crit)]);
      await evento(db, 'recomecou', { pauta_id: b.estrategia_pauta_id, busca_id: b.id,
        detalhe: `${b.nome}: varre de novo atrás de empresas novas (${DIAS_RECOMECO}+ dias desde a última varredura)` });
      return { acoes: [...acoes, { acao: 'recomecou', busca_id: b.id }], estado: `recomeçou "${b.nome}"` };
    }
  }

  // Avisa UMA vez que acabou (e não a cada minuto): só registra o evento se o
  // estado anterior ainda não era este.
  const estado = plano.ao_concluir === 'recomecar'
    ? `linha editorial concluída — os radares voltam a varrer ${DIAS_RECOMECO} dias depois de esgotar`
    : 'linha editorial concluída — adicione pautas ou regiões para continuar';
  if (plano.estado !== estado) {
    await evento(db, 'concluiu', { detalhe: `todas as regiões das pautas deste período já foram varridas` });
  }
  return { acoes, estado };
}

// Roda um passo com trava por cliente: dois workers (ou um deploy com o antigo
// ainda de pé) não abrem o mesmo radar duas vezes.
async function executar(pool, queues) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows: [{ ok }] } = await db.query(
      `SELECT pg_try_advisory_xact_lock(hashtext('hunter-estrategia:' || COALESCE(current_setting('app.tenant_id', true), ''))) AS ok`);
    if (!ok) { await db.query('ROLLBACK'); return { ocupado: true }; }
    const r = await passo(db, pool, queues);
    if (!r.desligado && r.estado) {
      await db.query(
        `UPDATE estrategia SET estado=$1, estado_em=now() WHERE estado IS DISTINCT FROM $1`, [r.estado]);
    }
    await db.query('COMMIT');
    return r;
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}

module.exports = {
  executar, portao, portaoCrm, proximaExpansao, VIZINHOS, periodoAtual, semanaDoMes, noPeriodo, montarRadar, regioesDa,
  normalizarPauta, normalizarRegioes, ErroEstrategia,
  LIMIAR_FILA, DIAS_RECOMECO, MAX_SIMULTANEOS, MAX_PAUTAS, REGIAO_UNICA,
};
