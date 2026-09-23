'use strict';
/*
 * Hunter — orçamento de captação: teto diário de leads + janela de funcionamento.
 *
 * Fonte ÚNICA da verdade pra "quantos leads ainda cabem agora". Usada pela
 * descoberta (saída rápida, antes de gastar crédito da CNPJá) e pelo Score 1
 * (checagem precisa, no instante em que o lead nasce).
 *
 * Duas regras importantes:
 *
 * 1) O consumo é contado por lead CRIADO, num contador próprio que nunca é
 *    decrementado — não por `COUNT(*) FROM leads`. Contar as linhas de `leads`
 *    subestimava o gasto: o lead sem telefone é APAGADO na validação, e o
 *    orçamento "devolvia" essa vaga, deixando o motor pagar CNPJá/Tavily muito
 *    além do teto configurado.
 *
 * 2) Dia e hora são sempre os do FUSO configurado (janela_tz), calculados no
 *    próprio Postgres. Os containers rodam em UTC — usar CURRENT_DATE fazia o
 *    "dia" do teto virar às 21h de Brasília.
 */

const CHAVE = 'leads_criados';
const TZ_PADRAO = 'America/Sao_Paulo';
const SEM_TETO = Number.MAX_SAFE_INTEGER;

const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];   // 0 = domingo, igual ao DOW do Postgres

// Dias válidos, sem repetição. Lista vazia ou inválida vira "todos": um motor
// que nunca abre é pior que um que ignora a restrição — e a tela já impede
// salvar sem nenhum dia marcado.
function normalizarDias(dias) {
  const ok = Array.isArray(dias)
    ? [...new Set(dias.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  return ok.length ? ok : TODOS_OS_DIAS;
}

async function lerConfig(pool) {
  let c = null;
  try {
    ({ rows: [c] } = await pool.query(
      `SELECT limite_diario, janela_inicio, janela_fim, janela_tz, janela_dias FROM config`));
  } catch (_) {
    // janela_dias ainda não migrada → lê o resto e assume todos os dias
    try {
      ({ rows: [c] } = await pool.query(
        `SELECT limite_diario, janela_inicio, janela_fim, janela_tz FROM config`));
    } catch (_) { /* colunas ainda não migradas → cai nos padrões (24h) */ }
  }
  return {
    limite: c?.limite_diario ?? 350,
    inicio: c?.janela_inicio ?? 0,
    fim: c?.janela_fim ?? 24,
    tz: c?.janela_tz || TZ_PADRAO,
    dias: normalizarDias(c?.janela_dias),
  };
}

// Dia/hora no fuso do cliente. `dia` volta como texto YYYY-MM-DD de propósito:
// evita o vaivém de DATE→Date do node-postgres reinterpretar no fuso do processo.
async function agoraLocal(pool, tz) {
  const { rows: [r] } = await pool.query(
    `SELECT to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD')     AS dia,
            EXTRACT(HOUR   FROM now() AT TIME ZONE $1)::int  AS hora,
            EXTRACT(DOW    FROM now() AT TIME ZONE $1)::int  AS dow,
            EXTRACT(MINUTE FROM now() AT TIME ZONE $1)::int  AS minuto,
            FLOOR(EXTRACT(SECOND FROM now() AT TIME ZONE $1))::int AS segundo`, [tz]
  );
  return { dia: r.dia, hora: r.hora, dow: r.dow, minuto: r.minuto, segundo: r.segundo };
}

// Quantas horas a janela cobre. Suporta janela que atravessa a meia-noite
// (ex.: 22h→6h = 8 horas).
function horasDaJanela(inicio, fim) {
  if (inicio === 0 && fim >= 24) return 24;
  return fim > inicio ? fim - inicio : 24 - inicio + fim;
}

function dentroDaJanela(hora, inicio, fim) {
  if (inicio === 0 && fim >= 24) return true;
  return fim > inicio ? (hora >= inicio && hora < fim) : (hora >= inicio || hora < fim);
}

// A janela está aberta nesta hora deste dia da semana? Janela que atravessa a
// meia-noite (22h→6h) pertence ao dia em que COMEÇA: a madrugada de terça faz
// parte do turno de segunda. Sem essa regra, desmarcar a terça cortaria o turno
// de segunda no meio, às 0h.
function abertoEm(dow, hora, cfg) {
  const { inicio, fim, dias } = cfg;
  const permitido = d => dias.includes(((d % 7) + 7) % 7);
  if (inicio === 0 && fim >= 24) return permitido(dow);
  if (fim > inicio) return permitido(dow) && hora >= inicio && hora < fim;
  if (hora >= inicio) return permitido(dow);
  if (hora < fim) return permitido(dow - 1);
  return false;
}

// Milissegundos até a próxima hora em que vale tentar de novo. Anda hora a hora
// pra frente (até 8 dias) em vez de uma conta fechada: com janela que atravessa
// a meia-noite, dias da semana e teto por dia de calendário, a fórmula teria
// casos de borda demais — 192 passos de aritmética não custam nada.
//   outroDia: o teto DO DIA acabou, então só serve uma hora de outro dia de
//   calendário (o contador é por dia, e só zera à meia-noite).
function esperaAteAbrir(agora, cfg, { outroDia = false } = {}) {
  const decorridoNaHora = (agora.minuto * 60 + agora.segundo) * 1000;
  for (let k = 1; k <= 24 * 8; k++) {
    const total = agora.hora + k;
    const hora = total % 24;
    const diasAFrente = Math.floor(total / 24);
    if (outroDia && diasAFrente === 0) continue;
    if (abertoEm(agora.dow + diasAFrente, hora, cfg)) return k * 3600_000 - decorridoNaHora;
  }
  return null;   // nenhum dia marcado — normalizarDias impede, mas fica o cinto
}

// Quanto do teto já foi consumido no dia e na hora local corrente.
async function consumo(pool, dia, hora) {
  const [d, h] = await Promise.all([
    pool.query(`SELECT valor FROM contadores      WHERE chave=$1 AND dia=$2`, [CHAVE, dia]),
    pool.query(`SELECT valor FROM contadores_hora WHERE chave=$1 AND dia=$2 AND hora=$3`, [CHAVE, dia, hora]),
  ]);
  return { dia: d.rows[0]?.valor || 0, hora: h.rows[0]?.valor || 0 };
}

/*
 * Quanto ainda cabe agora. Devolve:
 *   { dia, hora, foraDaJanela, motivo }
 * `dia`/`hora` = vagas restantes (0 = travado). Fora da janela, ambos são 0 —
 * o motor pausa e o scheduler volta a tentar sozinho quando a janela abrir.
 */
async function disponivel(pool) {
  const cfg = await lerConfig(pool);
  const { limite, inicio, fim } = cfg;
  const agora = await agoraLocal(pool, cfg.tz);
  const { dia, hora } = agora;

  if (!abertoEm(agora.dow, hora, cfg)) {
    const diaFechado = !cfg.dias.includes(agora.dow) && dentroDaJanela(hora, inicio, fim);
    return { dia: 0, hora: 0, foraDaJanela: true,
      esperarMs: esperaAteAbrir(agora, cfg),
      motivo: diaFechado
        ? `hoje (${NOMES_DIA[agora.dow]}) o motor não funciona — retoma no próximo dia marcado`
        : `fora do horário de funcionamento (${pad(inicio)}h–${pad(fim)}h) — retoma quando a janela abrir` };
  }
  if (!limite) return { dia: SEM_TETO, hora: SEM_TETO, foraDaJanela: false, esperarMs: 0, motivo: null };

  const usado = await consumo(pool, dia, hora);
  const porHora = Math.max(1, Math.ceil(limite / horasDaJanela(inicio, fim)));
  const vagasDia = Math.max(0, limite - usado.dia);
  const vagasHora = Math.max(0, porHora - usado.hora);
  return {
    dia: vagasDia,
    hora: vagasHora,
    foraDaJanela: false,
    // Teto do dia → só amanhã (ou no próximo dia marcado). Cota da hora → na
    // próxima hora em que a janela estiver aberta.
    esperarMs: vagasDia <= 0 ? esperaAteAbrir(agora, cfg, { outroDia: true })
      : vagasHora <= 0 ? esperaAteAbrir(agora, cfg) : 0,
    motivo: null,
  };
}

const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Registra 1 lead criado. Chamado UMA vez, logo após o INSERT em `leads` dar
// certo. Nunca é decrementado: apagar o lead depois não devolve a vaga.
async function registrarLead(pool) {
  const { tz } = await lerConfig(pool);
  const { dia, hora } = await agoraLocal(pool, tz);
  await Promise.all([
    pool.query(
      `INSERT INTO contadores (chave, dia, valor) VALUES ($1, $2, 1)
       ON CONFLICT (tenant_id, chave, dia) DO UPDATE SET valor = contadores.valor + 1`,
      [CHAVE, dia]),
    pool.query(
      `INSERT INTO contadores_hora (chave, dia, hora, valor) VALUES ($1, $2, $3, 1)
       ON CONFLICT (tenant_id, chave, dia, hora) DO UPDATE SET valor = contadores_hora.valor + 1`,
      [CHAVE, dia, hora]),
  ]);
}

const pad = n => String(n).padStart(2, '0');

module.exports = { disponivel, registrarLead, horasDaJanela, dentroDaJanela, abertoEm, esperaAteAbrir,
  normalizarDias, TODOS_OS_DIAS, CHAVE, TZ_PADRAO };
