'use strict';
/*
 * Hunter — multi-tenant (mesmo Postgres, isolado por tenant_id + Row-Level
 * Security). Cada stack (Antídoto, GK, etc.) roda com um TENANT_ID fixo nas
 * envs — sem isso não dá pra saber de quem são os dados, então o processo
 * recusa subir. Compartilhado entre server.js e worker.js (dois processos,
 * mesma regra) pra não duplicar a lógica de migração dos singletons antigos.
 */

// TENANT_ID por enquanto tem default 'antidoto' pra não derrubar o stack já
// em produção caso o deploy suba antes da env ser adicionada no Portainer —
// qualquer stack NOVA (ex.: GK) deve setar TENANT_ID explicitamente.
const TENANT_ID = (process.env.TENANT_ID || 'antidoto').trim().toLowerCase();
if (!/^[a-z0-9_]+$/.test(TENANT_ID)) {
  console.error(`[tenant] TENANT_ID inválido: "${TENANT_ID}" (use só letras minúsculas, números e _)`);
  process.exit(1);
}

// Dono das linhas PRÉ-multi-tenant: tudo que existia no banco antes desta
// migração pertence, por definição, à instalação original (Antídoto) — não
// importa QUAL stack rode a migração primeiro. Nunca mude este valor.
const TENANT_LEGADO = 'antidoto';

// Seta app.tenant_id uma vez por CONEXÃO física do pool (não por query) — a
// chamada é síncrona, então o SET entra na fila da conexão antes de qualquer
// query que o pool despachar pra esse client em seguida (garantia do próprio
// node-postgres: uma conexão processa sua fila de queries em ordem).
function ligarTenantNoPool(pool) {
  pool.on('connect', (client) => {
    client.query('SELECT set_config($1, $2, false)', ['app.tenant_id', TENANT_ID])
      .catch(err => console.error('[tenant] falha ao setar app.tenant_id:', err.message));
  });
}

// TRAVA DE SEGURANÇA: superuser (e roles com BYPASSRLS) IGNORAM o Row-Level
// Security no Postgres — com um usuário assim, um cliente enxerga os dados do
// outro como se o RLS não existisse (aconteceu em produção: o POSTGRES_USER
// da imagem Docker nasce superuser). Então o app se RECUSA a subir assim.
async function exigirRlsEnforcavel(pool) {
  const { rows: [r] } = await pool.query(
    `SELECT current_user AS usuario, rolsuper, rolbypassrls
     FROM pg_roles WHERE rolname = current_user`
  );
  if (r && (r.rolsuper || r.rolbypassrls)) {
    console.error(
      `[tenant] ERRO FATAL: o usuário do banco ("${r.usuario}") é ${r.rolsuper ? 'SUPERUSER' : 'BYPASSRLS'} — ` +
      `o Postgres ignora o Row-Level Security pra ele e um cliente enxergaria os dados do outro.\n` +
      `[tenant] Correção (uma vez, no Postgres): crie um superusuário de manutenção e rode\n` +
      `[tenant]   ALTER ROLE ${r.usuario} NOSUPERUSER NOBYPASSRLS;\n` +
      `[tenant] Depois suba o serviço de novo. O app NÃO vai rodar até isso ser corrigido.`
    );
    process.exit(1);
  }
}

// Tabela "de cliente" comum: ganha tenant_id + RLS. A coluna é criada em TRÊS
// passos de propósito (e não ADD COLUMN ... DEFAULT direto): com default de
// current_setting, o Postgres avalia o default UMA única vez no ALTER e
// carimbaria todas as linhas antigas com o tenant de QUEM RODOU A MIGRAÇÃO
// PRIMEIRO — foi exatamente o bug que carimbou a base do Antídoto como
// 'gktechai' quando a stack da GK subiu antes. Linhas pré-migração são sempre
// do TENANT_LEGADO; só linhas novas usam o default da sessão.
async function tenantizarTabela(pool, tabela) {
  await pool.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS tenant_id TEXT`);
  await pool.query(`UPDATE ${tabela} SET tenant_id = $1 WHERE tenant_id IS NULL`, [TENANT_LEGADO]);
  await pool.query(`ALTER TABLE ${tabela} ALTER COLUMN tenant_id SET DEFAULT current_setting('app.tenant_id', true)`);
  await pool.query(`ALTER TABLE ${tabela} ALTER COLUMN tenant_id SET NOT NULL`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_${tabela}_tenant ON ${tabela}(tenant_id);
    ALTER TABLE ${tabela} ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${tabela} FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_iso ON ${tabela};
    CREATE POLICY tenant_iso ON ${tabela}
      USING (tenant_id = current_setting('app.tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
  `);
}

// Tabelas que eram singleton GLOBAL (PK fixa tipo id=1: `config`, `motor_status`)
// viram 1 linha POR tenant — a PK passa a ser o próprio tenant_id. RLS sozinho
// não resolve isso (o bug não é "falta filtro", é "sempre olha pra id=1").
// A linha única legada pertence ao TENANT_LEGADO (mesma regra acima).
async function migrarSingletonParaTenant(pool, tabela) {
  await pool.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS tenant_id TEXT`);
  await pool.query(`UPDATE ${tabela} SET tenant_id = $1 WHERE tenant_id IS NULL`, [TENANT_LEGADO]);
  await pool.query(`ALTER TABLE ${tabela} ALTER COLUMN tenant_id SET DEFAULT current_setting('app.tenant_id', true)`);
  await pool.query(`ALTER TABLE ${tabela} ALTER COLUMN tenant_id SET NOT NULL`);
  await pool.query(`ALTER TABLE ${tabela} DROP CONSTRAINT IF EXISTS ${tabela}_pkey`);
  await pool.query(`ALTER TABLE ${tabela} DROP COLUMN IF EXISTS id`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '${tabela}'::regclass AND contype = 'p') THEN
        EXECUTE 'ALTER TABLE ${tabela} ADD PRIMARY KEY (tenant_id)';
      END IF;
    END $$;
  `);
  await pool.query(`
    ALTER TABLE ${tabela} ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${tabela} FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_iso ON ${tabela};
    CREATE POLICY tenant_iso ON ${tabela}
      USING (tenant_id = current_setting('app.tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
  `);
}

module.exports = { TENANT_ID, TENANT_LEGADO, ligarTenantNoPool, exigirRlsEnforcavel, tenantizarTabela, migrarSingletonParaTenant };
