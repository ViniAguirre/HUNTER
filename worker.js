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
  swot: new Queue('hunter-swot', { connection: REDIS_OPTS }),
  crm: new Queue('hunter-crm', { connection: REDIS_OPTS }),
};

const descobertaFn = require('./jobs/descoberta');
const enriquecimentoFn = require('./jobs/enriquecimento');
const filtroContadorFn = require('./jobs/filtro-contador');
const score1Fn = require('./jobs/score1');
const swotFn = require('./jobs/swot');
const crmFn = require('./jobs/crm');

const workers = {
  descoberta: new Worker('hunter-descoberta', job => descobertaFn(job, pool, queues), { connection: REDIS_OPTS, concurrency: 2 }),
  enriquecimento: new Worker('hunter-enriquecimento', job => enriquecimentoFn(job, pool, queues), { connection: REDIS_OPTS, concurrency: 5 }),
  filtroContador: new Worker('hunter-filtro_contador', job => filtroContadorFn(job, pool, queues), { connection: REDIS_OPTS, concurrency: 10 }),
  score1: new Worker('hunter-score1', job => score1Fn(job, pool, queues), { connection: REDIS_OPTS, concurrency: 10 }),
  swot: new Worker('hunter-swot', job => swotFn(job, pool, queues), { connection: REDIS_OPTS, concurrency: 3 }),
  crm: new Worker('hunter-crm', job => crmFn(job, pool), { connection: REDIS_OPTS, concurrency: 5 }),
};

for (const [nome, w] of Object.entries(workers)) {
  w.on('completed', job => console.log(`[${nome}] job ${job.id} ok`));
  w.on('failed', (job, err) => console.error(`[${nome}] job ${job?.id} falhou: ${err.message}`));
}

// ── scheduler: respeita o ritmo (leads/h) de cada busca Ativa ───────────────
async function runScheduler() {
  try {
    const { rows: buscas } = await pool.query(
      `SELECT id, criterios FROM buscas WHERE status='Ativa'`
    );

    for (const busca of buscas) {
      // jobId ESTÁVEL por busca: enquanto a varredura anterior estiver na fila
      // ou rodando, o BullMQ ignora novos disparos — evita varredura concorrente
      // (custo duplicado). A descoberta varre o universo e marca 'Esgotada',
      // então o scheduler não redispara sozinho.
      await queues.descoberta.add('descoberta', {
        busca_id: busca.id,
        criterios: busca.criterios,
      }, {
        jobId: `descoberta-busca-${busca.id}`,
        removeOnComplete: { count: 200, age: 3600 },
        removeOnFail: { count: 100 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
      });
    }
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
