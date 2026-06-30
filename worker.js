'use strict';
/*
 * Hunter — Motor de prospecção (Fase 3). Processo separado (hunter-worker)
 * que consome as filas BullMQ e roda o scheduler que respeita o `ritmo`
 * (leads/h) de cada busca Ativa.
 */
const { Worker, Queue } = require('bullmq');
const { Pool } = require('pg');

const REDIS_OPTS = {
  host: process.env.REDIS_HOST || 'hunter-redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

const queues = {
  descoberta: new Queue('hunter-descoberta', { connection: REDIS_OPTS }),
  enriquecimento: new Queue('hunter-enriquecimento', { connection: REDIS_OPTS }),
  filtroContador: new Queue('hunter-filtro_contador', { connection: REDIS_OPTS }),
  score1: new Queue('hunter-score1', { connection: REDIS_OPTS }),
};

const descobertaFn = require('./jobs/descoberta');
const enriquecimentoFn = require('./jobs/enriquecimento');
const filtroContadorFn = require('./jobs/filtro-contador');
const score1Fn = require('./jobs/score1');

const workers = {
  descoberta: new Worker('hunter-descoberta', job => descobertaFn(job, pool, queues), { connection: REDIS_OPTS, concurrency: 2 }),
  enriquecimento: new Worker('hunter-enriquecimento', job => enriquecimentoFn(job, pool, queues), { connection: REDIS_OPTS, concurrency: 5 }),
  filtroContador: new Worker('hunter-filtro_contador', job => filtroContadorFn(job, pool, queues), { connection: REDIS_OPTS, concurrency: 10 }),
  score1: new Worker('hunter-score1', job => score1Fn(job, pool), { connection: REDIS_OPTS, concurrency: 10 }),
};

for (const [nome, w] of Object.entries(workers)) {
  w.on('completed', job => console.log(`[${nome}] job ${job.id} ok`));
  w.on('failed', (job, err) => console.error(`[${nome}] job ${job?.id} falhou: ${err.message}`));
}

// ── scheduler: respeita o ritmo (leads/h) de cada busca Ativa ───────────────
async function runScheduler() {
  try {
    const { rows: buscas } = await pool.query(
      `SELECT id, ritmo, criterios, corte_score, tipo FROM buscas WHERE status='Ativa' AND ritmo > 0`
    );

    for (const busca of buscas) {
      const { rows: [{ n }] } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM leads WHERE busca_id=$1 AND criado_em >= now() - interval '1 hour'`,
        [busca.id]
      );
      const slots = busca.ritmo - n;
      if (slots <= 0) continue;

      const batches = Math.min(Math.ceil(slots / 20), 10);
      for (let i = 0; i < batches; i++) {
        await queues.descoberta.add('descoberta', {
          busca_id: busca.id,
          criterios: busca.criterios,
          corte_score: busca.corte_score,
          tipo: busca.tipo,
          offset: i * 20,
        }, {
          jobId: `busca-${busca.id}-offset-${i * 20}-${Date.now()}`,
          removeOnComplete: { count: 200, age: 86400 },
          removeOnFail: { count: 100 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        });
      }
    }

    await pool.query(`UPDATE buscas SET ultimo_heartbeat=now() WHERE status='Ativa' AND ritmo > 0`);
  } catch (err) {
    console.error('[scheduler] erro:', err.message);
  }
}

setInterval(runScheduler, 60_000);
runScheduler();

async function shutdown() {
  console.log('[worker] desligando…');
  await Promise.all(Object.values(workers).map(w => w.close()));
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[worker] Hunter Motor iniciado — aguardando jobs.');
