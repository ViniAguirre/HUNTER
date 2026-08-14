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

async function lerConfig(pool) {
  let c = null;
  try {
    ({ rows: [c] } = await pool.query(
      `SELECT limite_diario, janela_inicio, janela_fim, janela_tz FROM config`));
  } catch (_) { /* colunas ainda não migradas → cai nos padrões (24h) */ }
  return {
    limite: c?.limite_diario ?? 350,
    inicio: c?.janela_inicio ?? 0,
    fim: c?.janela_fim ?? 24,
    tz: c?.janela_tz || TZ_PADRAO,
  };
}

// Dia/hora no fuso do cliente. `dia` volta como texto YYYY-MM-DD de propósito:
// evita o vaivém de DATE→Date do node-postgres reinterpretar no fuso do processo.
async function agoraLocal(pool, tz) {
  const { rows: [r] } = await pool.query(
    `SELECT to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD')     AS dia,
            EXTRACT(HOUR FROM now() AT TIME ZONE $1)::int    AS hora`, [tz]
  );
  return { dia: r.dia, hora: r.hora };
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
  const { limite, inicio, fim, tz } = await lerConfig(pool);
  const { dia, hora } = await agoraLocal(pool, tz);

  if (!dentroDaJanela(hora, inicio, fim)) {
    return { dia: 0, hora: 0, foraDaJanela: true,
      motivo: `fora do horário de funcionamento (${pad(inicio)}h–${pad(fim)}h) — retoma quando a janela abrir` };
  }
  if (!limite) return { dia: SEM_TETO, hora: SEM_TETO, foraDaJanela: false, motivo: null };

  const usado = await consumo(pool, dia, hora);
  const porHora = Math.max(1, Math.ceil(limite / horasDaJanela(inicio, fim)));
  return {
    dia: Math.max(0, limite - usado.dia),
    hora: Math.max(0, porHora - usado.hora),
    foraDaJanela: false,
    motivo: null,
  };
}

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

module.exports = { disponivel, registrarLead, horasDaJanela, dentroDaJanela, CHAVE, TZ_PADRAO };
