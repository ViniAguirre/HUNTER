'use strict';
/*
 * Hunter — Fase 3
 * Servidor Node/Express: serve o front + API de autenticação + API de dados
 * (leads, buscas, integrações) + monitoramento real das filas do motor.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { TENANT_ID, TENANT_LEGADO, ligarTenantNoPool, exigirRlsEnforcavel, tenantizarTabela, migrarSingletonParaTenant } = require('./tenant');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'troque-este-segredo';
const COOKIE = 'hunter_session';
const SESSION_HOURS = 8;
// SameSite do cookie de sessão. Padrão 'lax' (mais seguro contra CSRF). Para
// embedar o Hunter num iframe de OUTRO domínio (ex.: dentro do CRM do cliente),
// o navegador só mantém a sessão cross-site com SameSite=None — então esse
// cliente sobe a stack com COOKIE_SAMESITE=none. 'none' exige Secure (HTTPS),
// que já é sempre true aqui.
const COOKIE_SAMESITE = (() => {
  const v = String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  return ['lax', 'none', 'strict'].includes(v) ? v : 'lax';
})();
const PUBLIC = path.join(__dirname, 'public');

const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@hunter.local').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mudar123';

// PGSSL=true liga TLS na conexão com o Postgres — necessário pra bancos
// gerenciados externos (Supabase, RDS, etc.) que exigem criptografia. Sem essa
// variável, comportamento igual a sempre (banco local no próprio stack, sem TLS).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});
ligarTenantNoPool(pool);

// Conexão com o Redis do motor (opcional — só pra leitura de stats das filas).
let monitorQueues = null;
if (process.env.REDIS_HOST) {
  const { Queue } = require('bullmq');
  const redisOpts = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };
  monitorQueues = {
    descoberta: new Queue('hunter-descoberta', { connection: { ...redisOpts } }),
    enriquecimento: new Queue('hunter-enriquecimento', { connection: { ...redisOpts } }),
    filtroContador: new Queue('hunter-filtro_contador', { connection: { ...redisOpts } }),
    score1: new Queue('hunter-score1', { connection: { ...redisOpts } }),
    validacao: new Queue('hunter-validacao', { connection: { ...redisOpts } }),
    swot: new Queue('hunter-swot', { connection: { ...redisOpts } }),
    crm: new Queue('hunter-crm', { connection: { ...redisOpts } }),
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function computeHealth(b) {
  if (b.status === 'Encerrada') return 'gray';
  if (b.status === 'Pausada') return 'red';
  if (b.status === 'Esgotada') return 'amber';
  if (!b.ultima_ativ) return 'amber';
  const mins = (Date.now() - new Date(b.ultima_ativ).getTime()) / 60000;
  if (mins < 10) return 'green';
  if (mins < 60) return 'amber';
  return 'red';
}

function buildLeadsFilter(query) {
  const { q, status, uf, busca_id, email_only, local, score_min } = query;
  const conditions = [];
  const vals = [];
  if (q && q.trim()) {
    vals.push(`%${q.trim()}%`);
    const n = vals.length;
    conditions.push(`(l.fantasia ILIKE $${n} OR l.decisor ILIKE $${n} OR l.razao ILIKE $${n})`);
  }
  if (status) { vals.push(status); conditions.push(`l.status = $${vals.length}`); }
  if (uf) { vals.push(uf); conditions.push(`l.uf = $${vals.length}`); }
  // Local: casa cidade OU UF (ex.: "Goiânia", "GO", "São Paulo").
  if (local && String(local).trim()) {
    vals.push(`%${String(local).trim()}%`);
    const n = vals.length;
    conditions.push(`(l.cidade ILIKE $${n} OR l.uf ILIKE $${n})`);
  }
  if (busca_id) {
    const bid = parseInt(busca_id, 10);
    if (!isNaN(bid)) { vals.push(bid); conditions.push(`l.busca_id = $${vals.length}`); }
  }
  const sMin = parseInt(score_min, 10);
  if (!isNaN(sMin) && sMin > 0) { vals.push(sMin); conditions.push(`l.score >= $${vals.length}`); }
  if (email_only === 'true' || email_only === '1') conditions.push('l.tem_email = true');
  return { conditions, vals };
}

// ── seed de dados de exemplo ──────────────────────────────────────────────────

async function seed(adminId) {
  const now = Date.now();
  const buscasSeed = [
    { nome:'Agências de marketing — Sul', tipo:'icp', status:'Ativa', ritmo:120, universo_est:2340,
      criterios:{chips:['Setor: Agências de publicidade','UF: PR','Cidade: Curitiba','Porte: Médio']},
      ultima_ativ: new Date(now - 2*60*1000), dias:30 },
    { nome:'Indústrias alimentícias — GO/MG', tipo:'icp', status:'Ativa', ritmo:80, universo_est:1800,
      criterios:{chips:['Setor: Indústria alimentícia','UF: GO','UF: MG','Porte: Grande']},
      ultima_ativ: new Date(now - 6*60*1000), dias:25 },
    { nome:'Clínicas médicas — capitais NE', tipo:'icp', status:'Ativa', ritmo:40, universo_est:540,
      criterios:{chips:['Setor: Atividades de saúde','Região: Nordeste','Porte: Pequeno']},
      ultima_ativ: new Date(now - 18*60*1000), dias:20 },
    { nome:'Construtoras porte grande — SP', tipo:'icp', status:'Pausada', ritmo:0, universo_est:3200,
      criterios:{chips:['Setor: Construção de edifícios','UF: SP','Porte: Grande']},
      ultima_ativ: new Date(now - 2*60*60*1000), dias:45 },
    { nome:'Escritórios de advocacia — DF', tipo:'icp', status:'Esgotada', ritmo:60, universo_est:540,
      criterios:{chips:['Setor: Atividades jurídicas','UF: DF']},
      ultima_ativ: new Date(now - 24*60*60*1000), dias:60 },
    { nome:'Startups SaaS — semelhantes', tipo:'lookalike', status:'Ativa', ritmo:100, universo_est:1200,
      criterios:{chips:['Modo: Lookalike','Setor: Software SaaS']},
      ultima_ativ: new Date(now - 1*60*1000), dias:15 },
    { nome:'Restaurantes — POA', tipo:'icp', status:'Encerrada', ritmo:0, universo_est:480,
      criterios:{chips:['Setor: Restaurantes e bares','Cidade: Porto Alegre']},
      ultima_ativ: new Date(now - 24*60*60*1000), dias:90 },
  ];

  const buscaIds = [];
  for (const b of buscasSeed) {
    const { rows:[row] } = await pool.query(
      `INSERT INTO buscas (nome, tipo, status, criador_id, ritmo, criterios, universo_est, ultima_ativ, criado_em)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8, now() - ($9 * interval '1 day')) RETURNING id`,
      [b.nome, b.tipo, b.status, adminId, b.ritmo, JSON.stringify(b.criterios), b.universo_est, b.ultima_ativ, b.dias]
    );
    buscaIds.push(row.id);
  }

  const leadsRaw = [
    {fantasia:'Pulse Marketing',razao:'Pulse Marketing Digital LTDA',cnpj:'18.402.551/0001-09',setor:'Agência de publicidade',cnae:'7311-4/00',porte:'Médio',cidade:'Curitiba',uf:'PR',decisor:'Ricardo Menezes',cargo:'Sócio-administrador',score:88,email:true,phone:true,status:'Qualificado',situacao:'Ativa',abertura:'12/03/2015',capital:'R$ 240.000',endereco:'R. Comendador Araújo, 499 — Batel',buscaIdx:1,mins:3},
    {fantasia:'NovaTech Sistemas',razao:'NovaTech Soluções em Software LTDA',cnpj:'27.918.330/0001-44',setor:'Desenvolvimento de software',cnae:'6201-5/01',porte:'Médio',cidade:'São Paulo',uf:'SP',decisor:'Fernanda Lima',cargo:'Diretora de operações',score:81,email:true,phone:true,status:'Novo',situacao:'Ativa',abertura:'04/08/2017',capital:'R$ 500.000',endereco:'Av. Faria Lima, 2232 — Itaim',buscaIdx:6,mins:6},
    {fantasia:'Verde Vale Alimentos',razao:'Verde Vale Indústria de Alimentos S.A.',cnpj:'09.221.764/0001-72',setor:'Indústria alimentícia',cnae:'1091-1/02',porte:'Grande',cidade:'Goiânia',uf:'GO',decisor:'Marcos Tavares',cargo:'Gerente comercial',score:64,email:true,phone:false,status:'Novo',situacao:'Ativa',abertura:'19/06/2009',capital:'R$ 3.200.000',endereco:'Rod. BR-153, km 12 — Distrito Ind.',buscaIdx:2,mins:9},
    {fantasia:'Atlas Logística',razao:'Atlas Transportes e Logística LTDA',cnpj:'31.556.092/0001-18',setor:'Transporte rodoviário',cnae:'4930-2/02',porte:'Médio',cidade:'Joinville',uf:'SC',decisor:'Paulo Reis',cargo:'Diretor',score:73,email:true,phone:true,status:'Qualificado',situacao:'Ativa',abertura:'30/01/2013',capital:'R$ 850.000',endereco:'R. Otto Boehm, 1100 — América',buscaIdx:4,mins:12},
    {fantasia:'Clínica Bem Estar',razao:'Bem Estar Serviços Médicos LTDA',cnpj:'22.044.871/0001-05',setor:'Atividades de saúde',cnae:'8630-5/03',porte:'Pequeno',cidade:'Recife',uf:'PE',decisor:'Dra. Camila Souza',cargo:'Sócia-proprietária',score:46,email:false,phone:true,status:'Incompleto',situacao:'Ativa',abertura:'22/11/2019',capital:'R$ 120.000',endereco:'Av. Boa Viagem, 3344 — Boa Viagem',buscaIdx:3,mins:15},
    {fantasia:'Forte Construções',razao:'Forte Engenharia e Construções LTDA',cnpj:'14.880.213/0001-66',setor:'Construção de edifícios',cnae:'4120-4/00',porte:'Grande',cidade:'Belo Horizonte',uf:'MG',decisor:'Henrique Dias',cargo:'Diretor de obras',score:79,email:true,phone:true,status:'Enviado',situacao:'Ativa',abertura:'08/05/2008',capital:'R$ 5.000.000',endereco:'Av. do Contorno, 6061 — Funcionários',buscaIdx:4,mins:18},
    {fantasia:'EcoSolar Energia',razao:'EcoSolar Energia Renovável LTDA',cnpj:'35.112.908/0001-30',setor:'Geração de energia solar',cnae:'3511-5/01',porte:'Médio',cidade:'Fortaleza',uf:'CE',decisor:'Juliana Castro',cargo:'CEO',score:91,email:true,phone:true,status:'Qualificado',situacao:'Ativa',abertura:'15/02/2018',capital:'R$ 1.100.000',endereco:'Av. Washington Soares, 909 — Edson Q.',buscaIdx:1,mins:21},
    {fantasia:'Sabor & Cia',razao:'Sabor e Companhia Restaurantes LTDA',cnpj:'40.337.115/0001-92',setor:'Restaurantes',cnae:'5611-2/01',porte:'Pequeno',cidade:'Porto Alegre',uf:'RS',decisor:'André Klein',cargo:'Proprietário',score:52,email:false,phone:true,status:'Novo',situacao:'Ativa',abertura:'03/09/2021',capital:'R$ 80.000',endereco:'R. Padre Chagas, 415 — Moinhos',buscaIdx:7,mins:24},
    {fantasia:'Mendes Advocacia',razao:'Mendes & Associados Advocacia',cnpj:'19.770.844/0001-51',setor:'Atividades jurídicas',cnae:'6911-7/01',porte:'Pequeno',cidade:'Brasília',uf:'DF',decisor:'Dr. Rafael Mendes',cargo:'Sócio-fundador',score:68,email:true,phone:false,status:'Novo',situacao:'Ativa',abertura:'27/07/2014',capital:'R$ 150.000',endereco:'SCS Quadra 9, Bloco C — Asa Sul',buscaIdx:5,mins:27},
    {fantasia:'TechFix Assistência',razao:'TechFix Assistência Técnica LTDA',cnpj:'28.901.556/0001-23',setor:'Reparo de equipamentos',cnae:'9511-8/00',porte:'Pequeno',cidade:'Campinas',uf:'SP',decisor:'Bruno Almeida',cargo:'Gerente',score:41,email:true,phone:false,status:'Descartado',situacao:'Ativa',abertura:'11/04/2020',capital:'R$ 60.000',endereco:'Av. Norte-Sul, 1500 — Cambuí',buscaIdx:6,mins:30},
  ];

  for (let i = 0; i < leadsRaw.length; i++) {
    const l = leadsRaw[i];
    const dom = (l.fantasia||'').toLowerCase().replace(/[^a-z]/g,'');
    const dd = l.uf==='SP'?'11':l.uf==='PR'?'41':'31';
    const contatos = [];
    if (l.email) contatos.push({tipo:'email',valor:`contato@${dom}.com.br`,fonte:'Validação SMTP',recencia:'verificado há 3 dias',selo:'verificado',validado:true});
    if (l.phone) contatos.push({tipo:'telefone',valor:`+55 (${dd}) 9 8842-${3001+i}`,fonte:'Receita / operadora',recencia:'WhatsApp ativo',selo:'WhatsApp',validado:true});
    contatos.push({tipo:'site',valor:`www.${dom}.com.br`,fonte:'Web crawl',recencia:l.score>70?'online':'sem resposta',selo:l.score>70?'online':'não verif.',validado:l.score>70});

    const breakdown = [
      {campo:'CNPJ ativo na Receita',delta:'+30',positivo:true},
      {campo:'E-mail verificado (SMTP)',delta:l.email?'+22':'—',positivo:l.email},
      {campo:'Telefone com WhatsApp',delta:l.phone?'+18':'—',positivo:l.phone},
      {campo:'Decisor identificado',delta:'+15',positivo:true},
      {campo:'Aderência ao setor do ICP',delta:l.score>70?'+12':'+6',positivo:true},
      {campo:'Idade da empresa < 2 anos',delta:l.score<55?'−10':'0',positivo:false},
    ];

    const abordagem = i===0
      ? 'A Pulse Marketing escala campanhas para clientes de médio porte e provavelmente sente o gargalo de prospecção qualificada. Aborde Ricardo destacando como o Hunter automatiza a entrada de leads B2B sem perder curadoria — alinhado ao posicionamento premium da agência.'
      : `A ${l.fantasia} (${l.setor.toLowerCase()}, porte ${l.porte.toLowerCase()}) é um alvo aderente ao ICP. Aborde ${l.decisor.replace(/^(Dr|Dra)\.?\s*/,'').split(' ')[0]} reforçando ganho de eficiência comercial e dados de contato já validados, reduzindo o tempo até a primeira conversa.`;

    await pool.query(
      `INSERT INTO leads (busca_id,origem,estagio,fantasia,razao,cnpj,setor,cnae,porte,
         cidade,uf,decisor,cargo,score,tem_email,tem_telefone,status,
         situacao,abertura,capital,endereco,contatos,breakdown,swot,abordagem,
         criado_em,atualizado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
               $22::jsonb,$23::jsonb,$24::jsonb,$25,
               now() - ($26 * interval '1 minute'),
               now() - ($26 * interval '1 minute'))`,
      [buscaIds[l.buscaIdx-1],'icp','pronto',l.fantasia,l.razao,l.cnpj,l.setor,l.cnae,l.porte,
       l.cidade,l.uf,l.decisor,l.cargo,l.score,l.email,l.phone,l.status,
       l.situacao,l.abertura,l.capital,l.endereco,
       JSON.stringify(contatos),JSON.stringify(breakdown),'{}',abordagem,l.mins]
    );
  }
  console.log('[seed] 7 buscas e 10 leads inseridos.');
}

// ── inicialização ─────────────────────────────────────────────────────────────

async function init() {
  for (let t = 1; t <= 30; t++) {
    try { await pool.query('SELECT 1'); break; }
    catch(e) {
      console.log(`[init] aguardando banco... (${t}/30)`);
      await new Promise(r => setTimeout(r, 2000));
      if (t === 30) throw e;
    }
  }

  // Multi-tenant só é seguro se o RLS valer pro usuário do app — superuser
  // ignora RLS e vazaria os dados de um cliente pro outro. Checa ANTES de
  // qualquer migração e recusa subir se o usuário for privilegiado demais.
  await exigirRlsEnforcavel(pool);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id            SERIAL PRIMARY KEY,
      nome          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      senha_hash    TEXT NOT NULL,
      papel         TEXT NOT NULL DEFAULT 'Operador'
                      CHECK (papel IN ('Admin','Operador','Visualizador')),
      ativo         BOOLEAN NOT NULL DEFAULT true,
      ultimo_acesso TIMESTAMPTZ,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const { rows:[{n:uCount}] } = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
  if (uCount === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await pool.query('INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ($1,$2,$3,$4)',
      [ADMIN_NAME, ADMIN_EMAIL, hash, 'Admin']);
    console.log(`[init] admin criado: ${ADMIN_EMAIL}`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS buscas (
      id            SERIAL PRIMARY KEY,
      nome          TEXT NOT NULL,
      tipo          TEXT NOT NULL DEFAULT 'icp'
                      CHECK (tipo IN ('icp','cnpj','lookalike')),
      status        TEXT NOT NULL DEFAULT 'Ativa'
                      CHECK (status IN ('Ativa','Pausada','Esgotada','Encerrada')),
      criador_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      ritmo         INTEGER NOT NULL DEFAULT 120,
      criterios     JSONB NOT NULL DEFAULT '{}',
      universo_est  INTEGER,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
      ultima_ativ   TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id            SERIAL PRIMARY KEY,
      busca_id      INTEGER REFERENCES buscas(id) ON DELETE SET NULL,
      origem        TEXT,
      estagio       TEXT NOT NULL DEFAULT 'pronto'
                      CHECK (estagio IN ('coletado','ativo','scored','enriquecido','pronto','descartado')),
      fantasia      TEXT NOT NULL,
      razao         TEXT,
      cnpj          TEXT,
      setor         TEXT, cnae TEXT, porte TEXT,
      cidade        TEXT, uf TEXT,
      decisor       TEXT, cargo TEXT,
      score         INTEGER NOT NULL DEFAULT 0,
      tem_email     BOOLEAN NOT NULL DEFAULT false,
      tem_telefone  BOOLEAN NOT NULL DEFAULT false,
      status        TEXT NOT NULL DEFAULT 'Novo'
                      CHECK (status IN ('Novo','Qualificado','Incompleto','Descartado','Enviado')),
      situacao      TEXT, abertura TEXT, capital TEXT, endereco TEXT,
      contatos      JSONB NOT NULL DEFAULT '[]',
      breakdown     JSONB NOT NULL DEFAULT '[]',
      swot          JSONB NOT NULL DEFAULT '{}',
      abordagem     TEXT,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_estagio ON leads(estagio);
    CREATE INDEX IF NOT EXISTS idx_leads_busca   ON leads(busca_id);
  `);

  // ── Fase 3: fundação do motor ────────────────────────────────────────────────
  // empresas: memória PERMANENTE por CNPJ (1 linha por empresa, pra sempre).
  // É o portão anti-duplicação e anti-desperdício de chave paga: antes de
  // qualquer enriquecimento pago, o motor consulta aqui. Estados "travados"
  // (qualificado / em_crm / descarte_duro) fazem o CNPJ ser pulado de vez.
  // Firmografia e contatos_verificados ficam guardados e são reusados de graça
  // por qualquer busca futura — só o score (local à busca) é recalculado.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      cnpj                 TEXT PRIMARY KEY,
      razao                TEXT, fantasia TEXT,
      setor                TEXT, cnae TEXT, porte TEXT,
      cidade               TEXT, uf TEXT,
      situacao             TEXT, abertura TEXT, capital TEXT, endereco TEXT,
      natureza_juridica    TEXT, opcao_simples BOOLEAN,
      decisor              TEXT, cargo TEXT,
      qsa                  JSONB NOT NULL DEFAULT '[]',
      contatos_verificados JSONB NOT NULL DEFAULT '[]',
      contato_receita      JSONB NOT NULL DEFAULT '[]',
      flag_contador        BOOLEAN NOT NULL DEFAULT false,
      origem_descoberta    TEXT,
      primeira_coleta      TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_empresas_uf     ON empresas(uf);
    CREATE INDEX IF NOT EXISTS idx_empresas_cnae   ON empresas(cnae);
  `);
  // `empresas` é a memória cadastral/de contato — GLOBAL, compartilhada entre
  // todos os clientes (reusa o cadastro grátis da Receita e o contato já
  // achado, sem gastar de novo). Mas o estado de qualificação (travado ou não
  // num CRM) é POR CLIENTE: um CNPJ já enviado ao CRM do cliente A não pode
  // travar o mesmo CNPJ pro cliente B — por isso vira tabela própria, com
  // tenant_id na chave.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresa_tenant_estado (
      cnpj          TEXT NOT NULL REFERENCES empresas(cnpj) ON DELETE CASCADE,
      tenant_id     TEXT NOT NULL DEFAULT current_setting('app.tenant_id', true),
      estado_global TEXT NOT NULL DEFAULT 'coletado'
                     CHECK (estado_global IN ('coletado','qualificado','em_crm','descarte_duro')),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (cnpj, tenant_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ete_tenant ON empresa_tenant_estado(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_ete_estado ON empresa_tenant_estado(estado_global);
  `);
  // Migração única: bancos de antes do multi-tenant tinham estado_global DENTRO
  // de `empresas` (só existia o cliente Antídoto). Copia esse histórico pra cá
  // ANTES de derrubar a coluna antiga — SEMPRE pro TENANT_LEGADO, não importa
  // qual stack rode esta migração primeiro (o dono do histórico pré-migração é
  // sempre a instalação original; condicionar ao TENANT_ID da sessão fez a GK
  // dropar a coluna sem copiar quando subiu antes do Antídoto). A cópia roda
  // ANTES do tenantizarTabela de propósito: o RLS, uma vez ligado, barraria
  // (WITH CHECK) inserir linhas de outro tenant a partir desta sessão.
  const { rows: [colAntiga] } = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='empresas' AND column_name='estado_global'`
  );
  if (colAntiga) {
    await pool.query(
      `INSERT INTO empresa_tenant_estado (cnpj, tenant_id, estado_global)
       SELECT cnpj, $1, estado_global FROM empresas
       ON CONFLICT (cnpj, tenant_id) DO NOTHING`, [TENANT_LEGADO]);
    console.log(`[init] estado_global migrado de empresas -> empresa_tenant_estado (tenant ${TENANT_LEGADO}).`);
  }
  await pool.query(`ALTER TABLE empresas DROP COLUMN IF EXISTS estado_global`);
  await tenantizarTabela(pool, 'empresa_tenant_estado');

  // integracoes: chaves dos providers de verificação/CRM, plugáveis e em cascata.
  // Suporta N providers (não é fixo) — cada um com ordem e on/off. A key é
  // guardada cifrada (preenchida pela tela Integrações na 3.1).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS integracoes (
      id            SERIAL PRIMARY KEY,
      categoria     TEXT NOT NULL
                      CHECK (categoria IN ('descoberta','contato','validacao_email','validacao_tel','crm','ia','busca_web')),
      provedor      TEXT NOT NULL,
      key_cifrada   TEXT,
      config        JSONB NOT NULL DEFAULT '{}',
      ativo         BOOLEAN NOT NULL DEFAULT false,
      ordem         INTEGER NOT NULL DEFAULT 100,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (categoria, provedor)
    );
  `);

  // Vínculo leads → empresas + controle de processamento do motor.
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS empresa_cnpj    TEXT REFERENCES empresas(cnpj) ON DELETE SET NULL;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_descarte TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS tentativas      INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS processado_em   TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS swot            JSONB;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS contato_validado JSONB;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS enviado_crm_em  TIMESTAMPTZ;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_busca_cnpj ON leads(busca_id, cnpj);
  `);

  // Heartbeat e progresso por busca (alimenta alertas do Dashboard e o "esgotada").
  await pool.query(`
    ALTER TABLE buscas ADD COLUMN IF NOT EXISTS universo_varrido INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE buscas ADD COLUMN IF NOT EXISTS ultimo_heartbeat TIMESTAMPTZ;
    ALTER TABLE buscas ADD COLUMN IF NOT EXISTS corte_score      INTEGER NOT NULL DEFAULT 60;
    ALTER TABLE buscas ADD COLUMN IF NOT EXISTS cursor_descoberta TEXT;
    ALTER TABLE buscas ADD COLUMN IF NOT EXISTS crm_auto         BOOLEAN NOT NULL DEFAULT false;
  `);

  // Configuração global do sistema (linha única / singleton).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS config (
      id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      ritmo_padrao    INTEGER NOT NULL DEFAULT 120,
      corte_padrao    INTEGER NOT NULL DEFAULT 60,
      ttl_cache_dias  INTEGER NOT NULL DEFAULT 30,
      parada_min      INTEGER NOT NULL DEFAULT 30,
      alerta_email    TEXT,
      crm_auto_global BOOLEAN NOT NULL DEFAULT false
    );
  `);

  // Loop de feedback do CRM → lista de semelhantes (lookalike auto-alimentada).
  await pool.query(`
    ALTER TABLE config ADD COLUMN IF NOT EXISTS crm_conversao_tags     TEXT[] NOT NULL DEFAULT '{fechado,ganho,comprou,cliente,qualificado,won,closed}';
    ALTER TABLE config ADD COLUMN IF NOT EXISTS crm_lookalike_auto     BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE config ADD COLUMN IF NOT EXISTS webhook_entrada_secret TEXT;
    ALTER TABLE buscas ADD COLUMN IF NOT EXISTS lista TEXT;
    ALTER TABLE buscas ADD COLUMN IF NOT EXISTS crm_queue_id TEXT;
    ALTER TABLE buscas ADD COLUMN IF NOT EXISTS descoberta_token TEXT;
    ALTER TABLE leads  ADD COLUMN IF NOT EXISTS crm_ref TEXT;
    CREATE INDEX IF NOT EXISTS idx_leads_crm_ref ON leads(crm_ref);
    ALTER TABLE leads  ADD COLUMN IF NOT EXISTS contato_pendente BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE leads  ADD COLUMN IF NOT EXISTS contato_status TEXT;
    ALTER TABLE buscas ADD COLUMN IF NOT EXISTS sem_contato INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE config ADD COLUMN IF NOT EXISTS limite_diario INTEGER NOT NULL DEFAULT 350;
    ALTER TABLE config ADD COLUMN IF NOT EXISTS descoberta_modo_padrao TEXT NOT NULL DEFAULT 'cnpja';
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS master BOOLEAN NOT NULL DEFAULT false;
    CREATE TABLE IF NOT EXISTS sementes (
      id         SERIAL PRIMARY KEY,
      cnpj       TEXT NOT NULL,
      lista      TEXT NOT NULL DEFAULT 'conversoes_crm',
      origem     TEXT,
      tag        TEXT,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (lista, cnpj)
    );
  `);

  // Empresas verificadas mas fora do perfil (Score 1 reprovou) — não viram lead,
  // só contam aqui. "Leads" passa a conter SOMENTE empresas qualificadas.
  await pool.query(`
    ALTER TABLE buscas ADD COLUMN IF NOT EXISTS fora_perfil INTEGER NOT NULL DEFAULT 0;
  `);

  // Confirmação paga na descoberta pela internet: cada empresa cujo site não
  // trouxe o CNPJ pode custar 1 crédito (bem mais caro que o modo Por CNPJ, que
  // é ~1 crédito por 100 empresas). Teto diário próprio + interruptor.
  await pool.query(`
    ALTER TABLE config ADD COLUMN IF NOT EXISTS web_paid_lookup_ativo   BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE config ADD COLUMN IF NOT EXISTS web_paid_lookup_limite  INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE config ADD COLUMN IF NOT EXISTS swot_perfil             JSONB NOT NULL DEFAULT '{}';
  `);

  // Contador diário genérico (chave + dia), usado pelo teto de confirmação paga
  // do modo internet — sem precisar de uma tabela dedicada por recurso.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contadores (
      chave  TEXT NOT NULL,
      dia    DATE NOT NULL DEFAULT CURRENT_DATE,
      valor  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (chave, dia)
    );
  `);

  // Mesma ideia, mas por HORA — usada só pra fracionar tetos diários (leads e
  // confirmação paga) ao longo do dia, sem deixar o motor gastar tudo de uma
  // vez quando a busca fica ligada direto.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contadores_hora (
      chave  TEXT NOT NULL,
      dia    DATE NOT NULL DEFAULT CURRENT_DATE,
      hora   SMALLINT NOT NULL DEFAULT EXTRACT(HOUR FROM now()),
      valor  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (chave, dia, hora)
    );
  `);

  // Categoria de busca web (Tavily) — bancos criados antes desta versão têm a
  // CHECK antiga; recria a constraint incluindo 'busca_web'.
  await pool.query(`
    ALTER TABLE integracoes DROP CONSTRAINT IF EXISTS integracoes_categoria_check;
    ALTER TABLE integracoes ADD CONSTRAINT integracoes_categoria_check
      CHECK (categoria IN ('descoberta','contato','validacao_email','validacao_tel','crm','ia','busca_web'));
  `);

  // ── Multi-tenant: registro de clientes + isolamento por tenant_id (RLS) ──────
  // Cada stack (Antídoto, GK, ...) sobe com um TENANT_ID fixo (ver tenant.js) e
  // se auto-registra aqui. `clientes` não tem RLS — cada deploy só liga pro
  // próprio banco e nunca precisa enxergar linha de outro cliente aqui.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id        TEXT PRIMARY KEY,
      nome      TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    `INSERT INTO clientes (id, nome) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`, [TENANT_ID]
  );

  // Biblioteca de propostas de valor ("o que você vende") — até 5 variações por
  // cliente, reaproveitadas na criação de radares e usadas pelo agente SWOT.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS propostas_valor (
      id         SERIAL PRIMARY KEY,
      rotulo     TEXT,
      texto      TEXT NOT NULL,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  for (const t of ['usuarios', 'buscas', 'leads', 'integracoes', 'sementes', 'contadores', 'contadores_hora', 'propostas_valor']) {
    await tenantizarTabela(pool, t);
  }

  // usuarios.email era UNIQUE global — dois clientes não podiam ter o mesmo
  // e-mail cadastrado. Agora só precisa ser único DENTRO do tenant.
  await pool.query(`
    ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_email_key;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_tenant_email ON usuarios(tenant_id, lower(email));
  `);
  // integracoes (categoria, provedor) era UNIQUE global — cada cliente precisa
  // da própria chave por provedor.
  await pool.query(`
    ALTER TABLE integracoes DROP CONSTRAINT IF EXISTS integracoes_categoria_provedor_key;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_integracoes_tenant_cat_prov ON integracoes(tenant_id, categoria, provedor);
  `);
  // sementes (lista, cnpj) era UNIQUE global — idem.
  await pool.query(`
    ALTER TABLE sementes DROP CONSTRAINT IF EXISTS sementes_lista_cnpj_key;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sementes_tenant_lista_cnpj ON sementes(tenant_id, lista, cnpj);
  `);
  // contadores / contadores_hora: a PK precisa incluir tenant_id — cada cliente
  // tem teto diário/horário PRÓPRIO (senão um cliente estoura a cota do outro).
  await pool.query(`
    ALTER TABLE contadores DROP CONSTRAINT IF EXISTS contadores_pkey;
    ALTER TABLE contadores ADD PRIMARY KEY (tenant_id, chave, dia);
  `);
  await pool.query(`
    ALTER TABLE contadores_hora DROP CONSTRAINT IF EXISTS contadores_hora_pkey;
    ALTER TABLE contadores_hora ADD PRIMARY KEY (tenant_id, chave, dia, hora);
  `);

  // config e motor_status eram singleton global (id=1) — viram 1 linha por
  // tenant, com a PK sendo o próprio tenant_id.
  await migrarSingletonParaTenant(pool, 'config');
  await pool.query(
    `INSERT INTO config (tenant_id) VALUES (current_setting('app.tenant_id', true)) ON CONFLICT (tenant_id) DO NOTHING`
  );
  await pool.query(`CREATE TABLE IF NOT EXISTS motor_status (worker_boot timestamptz, worker_versao text)`);
  await migrarSingletonParaTenant(pool, 'motor_status');

  // Garante a linha do provider de descoberta (CNPJá) pra tela de Integrações
  // ter o que mostrar mesmo antes da chave ser cadastrada.
  await pool.query(`
    INSERT INTO integracoes (categoria, provedor, ativo, ordem)
    VALUES ('descoberta', 'cnpja', false, 10),
           ('contato', 'google', false, 18),
           ('contato', 'econodata', false, 20),
           ('ia', 'openai', false, 60),
           ('crm', 'gk', false, 35),
           ('crm', 'webhook', false, 40)
    ON CONFLICT (tenant_id, categoria, provedor) DO NOTHING
  `);

  // Seed de demonstração: só roda se explicitamente pedido (SEED_DEMO=true).
  // Em produção fica desligado — o painel começa limpo e só mostra dado real.
  if (process.env.SEED_DEMO === 'true') {
    const { rows:[{n:bCount}] } = await pool.query('SELECT COUNT(*)::int AS n FROM buscas');
    if (bCount === 0) {
      const { rows:[admin] } = await pool.query('SELECT id FROM usuarios LIMIT 1');
      await seed(admin?.id || null);
    }
  }

  // Login MASTER (da Hunter): vê Integrações/Configurações/Monitoramento e os
  // provedores de API. MASTER_EMAIL é a FONTE DA VERDADE — pode ser uma lista
  // separada por vírgula. Esses e-mails viram master; todos os outros são
  // rebaixados (garante que só a Hunter tenha esse acesso).
  // MASTER_EMAIL é só o BOOTSTRAP do primeiro master (aceita lista por vírgula):
  // age apenas se ainda NÃO houver nenhum master. Depois disso, quem manda é a
  // tela de Usuários (promover/rebaixar), sem depender do Portainer.
  const masterEmails = (process.env.MASTER_EMAIL || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (masterEmails.length) {
    await pool.query(
      `UPDATE usuarios SET master=true
       WHERE lower(email) = ANY($1) AND NOT EXISTS (SELECT 1 FROM usuarios WHERE master=true)`,
      [masterEmails]
    );
  }
  // Rede de segurança: se ainda ninguém for master, promove o admin mais antigo
  // pra não travar o acesso (nunca ficar sem quem configure as integrações).
  await pool.query(
    `UPDATE usuarios SET master=true
     WHERE id = (SELECT id FROM usuarios WHERE papel='Admin' ORDER BY id LIMIT 1)
       AND NOT EXISTS (SELECT 1 FROM usuarios WHERE master=true)`
  );

  console.log('[init] banco pronto.');
}

// ── sessão ────────────────────────────────────────────────────────────────────

function setSession(res, user) {
  const token = jwt.sign(
    { id: user.id, nome: user.nome, email: user.email, papel: user.papel, master: !!user.master },
    JWT_SECRET,
    { expiresIn: `${SESSION_HOURS}h` }
  );
  res.cookie(COOKIE, token, {
    httpOnly: true, secure: true, sameSite: COOKIE_SAMESITE,
    maxAge: SESSION_HOURS * 3600 * 1000,
  });
}
function getUser(req) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}
function requireAuth(req, res, next) {
  const u = getUser(req);
  if (!u) return res.status(401).json({ erro: 'não autenticado' });
  req.user = u; next();
}
function requireEditor(req, res, next) {
  if (!req.user || !['Admin','Operador'].includes(req.user.papel))
    return res.status(403).json({ erro: 'sem permissão' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || (req.user.papel !== 'Admin' && !req.user.master))
    return res.status(403).json({ erro: 'apenas administradores' });
  next();
}
// MASTER: login da Hunter. Só ele acessa integrações/config/monitoramento e
// dados sigilosos (quais APIs alimentam o produto).
function requireMaster(req, res, next) {
  if (!req.user || !req.user.master)
    return res.status(403).json({ erro: 'acesso restrito' });
  next();
}

// ── app ───────────────────────────────────────────────────────────────────────

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '12mb' }));   // 12mb cobre upload de PDF/CSV em base64
app.use(cookieParser());

// healthcheck
app.get('/api/health', (req, res) =>
  res.json({ ok: true, versao: 'fase3', ts: new Date().toISOString() })
);

// ── API: auth ─────────────────────────────────────────────────────────────────

const loginLimiter = rateLimit({ windowMs: 5*60*1000, max: 10, standardHeaders: true, legacyHeaders: false });

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');
  if (!email || !senha) return res.status(400).json({ erro: 'informe e-mail e senha' });
  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email]);
    const user = rows[0];
    if (!user || !user.ativo) return res.status(401).json({ erro: 'credenciais inválidas' });
    if (!await bcrypt.compare(senha, user.senha_hash)) return res.status(401).json({ erro: 'credenciais inválidas' });
    await pool.query('UPDATE usuarios SET ultimo_acesso=now() WHERE id=$1', [user.id]);
    setSession(res, user);
    res.json({ nome: user.nome, email: user.email, papel: user.papel, master: !!user.master });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE, { httpOnly: true, secure: true, sameSite: COOKIE_SAMESITE });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) =>
  res.json({ id: req.user.id, nome: req.user.nome, email: req.user.email, papel: req.user.papel, master: !!req.user.master })
);

// Qualquer usuário troca a PRÓPRIA senha (confere a atual).
app.post('/api/auth/trocar-senha', requireAuth, async (req, res) => {
  const atual = String(req.body.senha_atual || '');
  const nova = String(req.body.senha_nova || '');
  if (nova.length < 6) return res.status(400).json({ erro: 'a nova senha precisa ter ao menos 6 caracteres' });
  try {
    const { rows:[u] } = await pool.query('SELECT senha_hash FROM usuarios WHERE id=$1', [req.user.id]);
    if (!u || !await bcrypt.compare(atual, u.senha_hash)) return res.status(401).json({ erro: 'senha atual incorreta' });
    await pool.query('UPDATE usuarios SET senha_hash=$1 WHERE id=$2', [await bcrypt.hash(nova, 12), req.user.id]);
    res.json({ ok: true });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// ── API: usuários ─────────────────────────────────────────────────────────────

app.get('/api/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nome, email, papel, master, ativo, ultimo_acesso, criado_em FROM usuarios ORDER BY criado_em'
  );
  res.json(rows);
});

app.post('/api/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const nome = String(req.body.nome || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const papel = ['Admin','Operador','Visualizador'].includes(req.body.papel) ? req.body.papel : 'Operador';
  let senha = String(req.body.senha || '').trim();
  if (!nome || !email) return res.status(400).json({ erro: 'informe nome e e-mail' });
  if (!senha) senha = Math.random().toString(36).slice(2, 10) + 'A1!';
  try {
    const hash = await bcrypt.hash(senha, 12);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ($1,$2,$3,$4) RETURNING id, nome, email, papel, ativo',
      [nome, email, hash, papel]
    );
    res.status(201).json({ ...rows[0], senha_provisoria: senha });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ erro: 'e-mail já cadastrado' });
    console.error(e); res.status(500).json({ erro: 'erro interno' });
  }
});

app.patch('/api/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  // Só um master mexe em outro master (protege a conta da Hunter).
  if (!req.user.master) {
    const { rows:[alvo] } = await pool.query('SELECT master FROM usuarios WHERE id=$1', [id]);
    if (alvo?.master) return res.status(403).json({ erro: 'acesso restrito' });
  }
  const sets = [], vals = [];
  if (typeof req.body.ativo === 'boolean') { sets.push(`ativo=$${sets.length+1}`); vals.push(req.body.ativo); }
  if (['Admin','Operador','Visualizador'].includes(req.body.papel)) { sets.push(`papel=$${sets.length+1}`); vals.push(req.body.papel); }
  if (req.body.senha) { sets.push(`senha_hash=$${sets.length+1}`); vals.push(await bcrypt.hash(String(req.body.senha), 12)); }
  // Só um master pode marcar/desmarcar master; nunca deixar o sistema sem master.
  if (typeof req.body.master === 'boolean') {
    if (!req.user.master) return res.status(403).json({ erro: 'apenas o master define outro master' });
    if (req.body.master === false) {
      const { rows:[{ n }] } = await pool.query(`SELECT COUNT(*)::int n FROM usuarios WHERE master=true AND id<>$1`, [id]);
      if (n === 0) return res.status(400).json({ erro: 'precisa existir ao menos um master' });
    }
    sets.push(`master=$${sets.length+1}`); vals.push(req.body.master);
  }
  if (!sets.length) return res.status(400).json({ erro: 'nada para atualizar' });
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE usuarios SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING id, nome, email, papel, master, ativo`, vals
  );
  if (!rows[0]) return res.status(404).json({ erro: 'não encontrado' });
  res.json(rows[0]);
});

app.delete('/api/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (req.user.id === id) return res.status(400).json({ erro: 'não é possível excluir a si mesmo' });
  if (!req.user.master) {
    const { rows:[alvo] } = await pool.query('SELECT master FROM usuarios WHERE id=$1', [id]);
    if (alvo?.master) return res.status(403).json({ erro: 'acesso restrito' });
  }
  await pool.query('DELETE FROM usuarios WHERE id=$1', [id]);
  res.json({ ok: true });
});

// ── API: dashboard ────────────────────────────────────────────────────────────

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const [metricasRes, buscasRes, atividadeRes] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*)::int FROM buscas WHERE status='Ativa') AS buscas_ativas,
        -- Empresas encontradas = universo descoberto POR ESTE CLIENTE (dedupado
        -- por CNPJ). Conta na empresa_tenant_estado (escopada por RLS) e não na
        -- tabela empresas, que é o cadastro global compartilhado entre clientes.
        (SELECT COUNT(*)::int FROM empresa_tenant_estado) AS empresas_total,
        -- Leads só existem se qualificaram no Score 1 — leads = qualificados.
        (SELECT COUNT(*)::int FROM leads) AS qualificados,
        -- Verificadas mas fora do perfil = reprovadas na segmentação (nunca viraram lead).
        (SELECT COALESCE(SUM(fora_perfil),0)::int FROM buscas) AS fora_perfil,
        (SELECT COUNT(*)::int FROM leads WHERE status='Enviado' OR enviado_crm_em IS NOT NULL) AS enviados`),
      pool.query(`
        SELECT b.id, b.nome, b.ritmo, b.status, b.ultima_ativ,
          b.universo_varrido AS encontrados
        FROM buscas b
        WHERE b.status = 'Ativa'
        ORDER BY b.ultima_ativ DESC NULLS LAST LIMIT 5`),
      pool.query(`SELECT fantasia, cidade, uf, score, criado_em FROM leads ORDER BY criado_em DESC LIMIT 5`),
    ]);
    const m = metricasRes.rows[0] || {};
    res.json({
      metricas: {
        buscasAtivas: m.buscas_ativas ?? 0,
        empresasEncontradas: m.empresas_total ?? 0,
        leadsQualificados: m.qualificados ?? 0,
        leadsForaPerfil: m.fora_perfil ?? 0,
        leadsCRM: m.enviados ?? 0,
      },
      buscasAtivas: buscasRes.rows.map(b => ({ ...b, enc: b.encontrados, health: computeHealth(b) })),
      atividade: atividadeRes.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// ── API: buscas ───────────────────────────────────────────────────────────────

// ── API: propostas de valor (biblioteca "o que você vende", até 5) ────────────
const MAX_PROPOSTAS = 5;

app.get('/api/propostas', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, rotulo, texto, criado_em FROM propostas_valor ORDER BY criado_em`
    );
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.post('/api/propostas', requireAuth, requireEditor, async (req, res) => {
  const texto = String(req.body.texto || '').trim();
  const rotulo = String(req.body.rotulo || '').trim().slice(0, 60) || null;
  if (!texto) return res.status(400).json({ erro: 'escreva a proposta de valor' });
  if (texto.length > 2000) return res.status(400).json({ erro: 'proposta muito longa (máx. 2000 caracteres)' });
  try {
    const { rows: [{ n }] } = await pool.query(`SELECT COUNT(*)::int n FROM propostas_valor`);
    if (n >= MAX_PROPOSTAS) return res.status(409).json({ erro: `limite de ${MAX_PROPOSTAS} variações — exclua uma antes de criar outra` });
    const { rows: [row] } = await pool.query(
      `INSERT INTO propostas_valor (rotulo, texto) VALUES ($1,$2) RETURNING id, rotulo, texto, criado_em`,
      [rotulo, texto]
    );
    res.status(201).json(row);
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.patch('/api/propostas/:id', requireAuth, requireEditor, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  const texto = String(req.body.texto || '').trim();
  const rotulo = String(req.body.rotulo || '').trim().slice(0, 60) || null;
  if (!texto) return res.status(400).json({ erro: 'escreva a proposta de valor' });
  if (texto.length > 2000) return res.status(400).json({ erro: 'proposta muito longa (máx. 2000 caracteres)' });
  try {
    const { rows: [row] } = await pool.query(
      `UPDATE propostas_valor SET rotulo=$2, texto=$3 WHERE id=$1 RETURNING id, rotulo, texto, criado_em`,
      [id, rotulo, texto]
    );
    if (!row) return res.status(404).json({ erro: 'não encontrada' });
    res.json(row);
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.delete('/api/propostas/:id', requireAuth, requireEditor, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  try {
    const { rowCount } = await pool.query(`DELETE FROM propostas_valor WHERE id=$1`, [id]);
    if (!rowCount) return res.status(404).json({ erro: 'não encontrada' });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.get('/api/buscas', requireAuth, async (req, res) => {
  try {
    const { status, q } = req.query;
    const conds = [], vals = [];
    if (status) { vals.push(status); conds.push(`b.status=$${vals.length}`); }
    if (q && q.trim()) { vals.push(`%${q.trim()}%`); conds.push(`b.nome ILIKE $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(`
      SELECT b.id, b.nome, b.tipo, b.status, b.ritmo, b.criterios, b.ultima_ativ, b.criado_em,
        u.nome AS criador_nome,
        b.universo_varrido AS encontrados,
        COUNT(l.id)::int AS qualificados,
        b.fora_perfil,
        COUNT(l.id) FILTER (WHERE l.status='Enviado')::int AS enviados
      FROM buscas b
      LEFT JOIN usuarios u ON u.id = b.criador_id
      LEFT JOIN leads l ON l.busca_id = b.id
      ${where} GROUP BY b.id, u.nome ORDER BY b.criado_em DESC`, vals);
    res.json(rows.map(b => ({ ...b, health: computeHealth(b) })));
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.post('/api/buscas', requireAuth, requireEditor, async (req, res) => {
  const nome = String(req.body.nome || '').trim();
  if (!nome) return res.status(400).json({ erro: 'nome é obrigatório' });
  const tipo = ['icp','cnpj','lookalike'].includes(req.body.tipo) ? req.body.tipo : 'icp';
  const ritmo = typeof req.body.ritmo === 'number' ? req.body.ritmo : 120;
  const criterios = req.body.criterios || {};
  const corteScore = typeof req.body.corte_score === 'number'
    ? Math.max(0, Math.min(100, req.body.corte_score)) : 60;
  const crmAuto = !!req.body.crm_auto;
  // Fila do CRM específica deste radar (opcional). Vazio = usa a fila padrão
  // configurada em Integrações.
  const crmQueueId = String(req.body.crm_queue_id || '').trim() || null;
  try {
    const { rows:[b] } = await pool.query(
      `INSERT INTO buscas (nome, tipo, ritmo, criterios, corte_score, crm_auto, crm_queue_id, criador_id, ultima_ativ)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,now()) RETURNING *`,
      [nome, tipo, ritmo, JSON.stringify(criterios), corteScore, crmAuto, crmQueueId, req.user.id]
    );
    res.status(201).json({ ...b, health: computeHealth(b), criador_nome: req.user.nome });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.get('/api/buscas/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  try {
    const [bRow, leadsRow, prodRow] = await Promise.all([
      pool.query(`
        SELECT b.*, u.nome AS criador_nome,
          b.universo_varrido AS encontrados,
          COUNT(l.id)::int AS qualificados,
          COUNT(l.id) FILTER (WHERE l.status='Incompleto')::int AS incompletos,
          COUNT(l.id) FILTER (WHERE l.status='Descartado')::int AS descartados,
          COUNT(l.id) FILTER (WHERE l.status='Enviado')::int AS enviados
        FROM buscas b LEFT JOIN usuarios u ON u.id=b.criador_id
        LEFT JOIN leads l ON l.busca_id=b.id
        WHERE b.id=$1 GROUP BY b.id, u.nome`, [id]),
      pool.query(`SELECT id, fantasia, decisor, cidade, uf, score, status
        FROM leads WHERE busca_id=$1 ORDER BY score DESC LIMIT 20`, [id]),
      pool.query(`
        SELECT COUNT(l.id)::int AS n
        FROM generate_series(current_date - interval '13 days', current_date, interval '1 day') d(dia)
        LEFT JOIN leads l ON l.busca_id=$1 AND date(l.criado_em)=d.dia
        GROUP BY d.dia ORDER BY d.dia`, [id]),
    ]);
    const b = bRow.rows[0];
    if (!b) return res.status(404).json({ erro: 'não encontrada' });
    res.json({
      ...b,
      health: computeHealth(b),
      // aliases que o front do detalhe consome
      enc: b.encontrados, qual: b.qualificados, crm: b.enviados, fora: b.fora_perfil,
      sem_contato: b.sem_contato || 0,
      universo_est: b.universo_varrido || 0,
      producao: prodRow.rows.map(r => r.n),
      leads: leadsRow.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.patch('/api/buscas/:id', requireAuth, requireEditor, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  const sets = [], vals = [];
  if (typeof req.body.ritmo === 'number') { sets.push(`ritmo=$${sets.length+1}`); vals.push(req.body.ritmo); }
  if (['Ativa','Pausada','Esgotada','Encerrada'].includes(req.body.status)) {
    sets.push(`status=$${sets.length+1}`); vals.push(req.body.status);
  }
  if (!sets.length) return res.status(400).json({ erro: 'nada para atualizar' });
  vals.push(id);
  try {
    const { rows:[b] } = await pool.query(
      `UPDATE buscas SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals
    );
    if (!b) return res.status(404).json({ erro: 'não encontrada' });
    res.json({ ...b, health: computeHealth(b) });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.delete('/api/buscas/:id', requireAuth, requireEditor, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Remove os leads da busca; as empresas ficam no ledger permanente (memória
    // anti-desperdício), então excluir a busca não apaga o histórico global.
    await client.query('DELETE FROM leads WHERE busca_id=$1', [id]);
    const { rowCount } = await client.query('DELETE FROM buscas WHERE id=$1', [id]);
    await client.query('COMMIT');
    if (!rowCount) return res.status(404).json({ erro: 'não encontrada' });
    res.json({ ok: true });
  } catch(e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e); res.status(500).json({ erro: 'erro interno' });
  } finally {
    client.release();
  }
});

// ── API: leads ────────────────────────────────────────────────────────────────

app.get('/api/leads', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page, 10) || 50));
    const { conditions, vals } = buildLeadsFilter(req.query);
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM leads l ${where}`, vals),
      pool.query(`SELECT l.id, l.fantasia, l.razao, l.setor, l.porte, l.cidade, l.uf,
        l.decisor, l.cargo, l.score, l.tem_email, l.tem_telefone, l.status, l.busca_id, l.contato_validado, l.contato_pendente
        FROM leads l ${where} ORDER BY l.score DESC, l.id
        LIMIT $${vals.length+1} OFFSET $${vals.length+2}`,
        [...vals, perPage, (page-1)*perPage]),
    ]);
    const total = countRes.rows[0].total;
    // Expõe o telefone/e-mail REAIS do enriquecimento (contato_validado) pra a
    // lista pintar os ícones (verde=achou, vermelho=não) e mostrar o valor no
    // clique. Não vaza a fonte/provedor — só o valor comercial.
    const leads = dataRes.rows.map(l => {
      const cv = l.contato_validado || {};
      const email = cv.email || null;
      const telefone = cv.telefone || cv.whatsapp || null;
      const { contato_validado, ...rest } = l;
      return { ...rest,
        email_valor: email, telefone_valor: telefone,
        tem_email: !!email || !!l.tem_email,
        tem_telefone: !!telefone || !!l.tem_telefone };
    });
    res.json({ leads, total, page, per_page: perPage, pages: Math.ceil(total/perPage) || 1 });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// export DEVE vir antes de /:id
app.get('/api/leads/export', requireAuth, async (req, res) => {
  try {
    let rows;
    const idsParam = req.query.ids;
    if (idsParam) {
      const ids = String(idsParam).split(',').map(x => parseInt(x,10)).filter(x => !isNaN(x));
      if (!ids.length) return res.status(400).json({ erro: 'ids inválidos' });
      const { rows:r } = await pool.query(
        `SELECT fantasia,razao,cnpj,setor,porte,cidade,uf,decisor,cargo,score,status,tem_email,tem_telefone
         FROM leads WHERE id = ANY($1::int[]) ORDER BY score DESC`, [ids]);
      rows = r;
    } else {
      const { conditions, vals } = buildLeadsFilter(req.query);
      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      const { rows:r } = await pool.query(
        `SELECT fantasia,razao,cnpj,setor,porte,cidade,uf,decisor,cargo,score,status,tem_email,tem_telefone
         FROM leads l ${where} ORDER BY score DESC`, vals);
      rows = r;
    }
    const esc = v => `"${String(v||'').replace(/"/g,'""')}"`;
    const csv = [
      ['Empresa','Razão Social','CNPJ','Setor','Porte','Cidade','UF','Decisor','Cargo','Score','Status','Tem E-mail','Tem Telefone'].join(';'),
      ...rows.map(r => [esc(r.fantasia),esc(r.razao),esc(r.cnpj),esc(r.setor),esc(r.porte),
        esc(r.cidade),esc(r.uf),esc(r.decisor),esc(r.cargo),r.score,esc(r.status),
        r.tem_email?'Sim':'Não',r.tem_telefone?'Sim':'Não'].join(';')),
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send('﻿' + csv);
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// Leads que precisam de DECISÃO manual (acharam só telefone, sem e-mail).
// Alimenta o popup do próximo login. DEVE vir antes de /:id.
app.get('/api/leads/decisao-pendente', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, fantasia, razao, cnpj, cidade, uf, score,
              contato_validado->>'telefone' AS telefone,
              contato_validado->>'website'  AS website
       FROM leads WHERE contato_status='decisao'
       ORDER BY score DESC, id LIMIT 100`
    );
    res.json({ leads: rows, total: rows.length });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.get('/api/leads/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  try {
    const { rows:[l] } = await pool.query(
      `SELECT l.*, b.nome AS busca_nome FROM leads l
       LEFT JOIN buscas b ON b.id=l.busca_id WHERE l.id=$1`, [id]);
    if (!l) return res.status(404).json({ erro: 'não encontrado' });
    // Qual provedor gerou o quê (modelo de IA, Google/Econodata/scrape) é sigiloso
    // — só o master vê. O cliente só precisa do conteúdo (briefing, contato validado).
    if (!req.user.master) {
      if (l.swot) l.swot = { ...l.swot, modelo: undefined };
      if (l.contato_validado) l.contato_validado = { ...l.contato_validado, fonte: undefined, resumo_fonte: undefined };
    }
    res.json(l);
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.patch('/api/leads/:id', requireAuth, requireEditor, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  const { status } = req.body;
  if (!['Novo','Qualificado','Incompleto','Descartado','Enviado'].includes(status))
    return res.status(400).json({ erro: 'status inválido' });
  try {
    const { rows:[l] } = await pool.query(
      `UPDATE leads SET status=$1, atualizado_em=now() WHERE id=$2 RETURNING *`, [status, id]);
    if (!l) return res.status(404).json({ erro: 'não encontrado' });
    res.json(l);
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// Resolve a decisão de um lead pendente: enviar mesmo assim / marcar não
// qualificado / deixar em revisão manual (o usuário vai achar o dado).
app.post('/api/leads/:id/decisao', requireAuth, requireEditor, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  const acao = String(req.body?.acao || '');
  try {
    if (acao === 'enviar') {
      // Envia ao CRM mesmo sem e-mail (decisão do usuário).
      await pool.query(`UPDATE leads SET contato_status='completo', contato_pendente=false WHERE id=$1`, [id]);
      if (monitorQueues?.crm) {
        await monitorQueues.crm.add('crm', { lead_id: id },
          { jobId: `crm-dec-${id}-${Date.now()}`, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 4, backoff: { type: 'exponential', delay: 15000 } });
      }
      return res.json({ ok: true, acao });
    }
    if (acao === 'descartar') {
      await pool.query(`UPDATE leads SET status='Descartado', contato_status='descartado', contato_pendente=false, atualizado_em=now() WHERE id=$1`, [id]);
      return res.json({ ok: true, acao });
    }
    if (acao === 'manual') {
      // Sai do popup; fica pra o usuário achar/editar o contato à mão.
      await pool.query(`UPDATE leads SET contato_status='revisao_manual' WHERE id=$1`, [id]);
      return res.json({ ok: true, acao });
    }
    return res.status(400).json({ erro: 'ação inválida' });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// Edição MANUAL do contato do lead (quando o usuário acha o dado por conta).
app.patch('/api/leads/:id/contato', requireAuth, requireEditor, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  const tel = String(req.body?.telefone || '').replace(/[^\d]/g, '').slice(0, 15) || null;
  const email = String(req.body?.email || '').trim().slice(0, 160) || null;
  const website = String(req.body?.website || '').trim().slice(0, 200) || null;
  try {
    const { rows: [l] } = await pool.query(`SELECT contato_validado FROM leads WHERE id=$1`, [id]);
    if (!l) return res.status(404).json({ erro: 'não encontrado' });
    const cv = { ...(l.contato_validado || {}) };
    if (tel !== null) { cv.telefone = tel; cv.whatsapp = tel; }
    if (email !== null) cv.email = email;
    if (website !== null) cv.website = website;
    cv.fonte = cv.fonte ? `${cv.fonte}+manual` : 'manual';
    cv.validado = !!(cv.telefone || cv.email);
    const completo = !!((cv.telefone || cv.whatsapp) && cv.email);
    await pool.query(
      `UPDATE leads SET contato_validado=$2::jsonb, contato_status=$3, contato_pendente=$4, atualizado_em=now() WHERE id=$1`,
      [id, JSON.stringify(cv), completo ? 'completo' : 'decisao', !completo]
    );
    res.json({ ok: true, completo, contato_validado: cv });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.post('/api/leads/acoes', requireAuth, requireEditor, async (req, res) => {
  const { ids, status, acao } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ erro: 'ids obrigatório' });
  const idsInt = ids.map(x => parseInt(x,10)).filter(x => !isNaN(x));
  if (!idsInt.length) return res.status(400).json({ erro: 'ids inválidos' });
  try {
    // Envio manual ao CRM: enfileira cada lead (com retry). Aceita qualquer
    // provedor de CRM ativo (gk nativo ou webhook) — o job roteia pelo provedor.
    if (acao === 'enviar_crm') {
      if (!monitorQueues?.crm) return res.status(503).json({ erro: 'motor de envio indisponível' });
      const { rows: [ig] } = await pool.query(
        `SELECT 1 FROM integracoes WHERE categoria='crm' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> '' LIMIT 1`
      );
      if (!ig) return res.status(400).json({ erro: 'Nenhum CRM conectado no momento. Fale com o administrador do sistema.' });
      await Promise.all(idsInt.map(id =>
        monitorQueues.crm.add('crm', { lead_id: id },
          { jobId: `crm-manual-${id}-${Date.now()}`, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 4, backoff: { type: 'exponential', delay: 15000 } })
      ));
      return res.json({ ok: true, enfileirados: idsInt.length });
    }

    // Re-enriquecer: re-roda a validação de contato + SWOT nos leads JÁ
    // existentes, com busca NOVA (limpa o contato web em cache), sem criar
    // duplicata. Útil pra atualizar dados após melhorar a busca (ex.: Tavily).
    if (acao === 'reenriquecer') {
      if (!monitorQueues?.validacao) return res.status(503).json({ erro: 'motor de enriquecimento indisponível' });
      const { rows } = await pool.query(
        `SELECT id, cnpj, busca_id FROM leads WHERE id = ANY($1::int[])`, [idsInt]);
      const cnpjs = rows.map(r => r.cnpj).filter(Boolean);
      // Zera o contato web em cache pra forçar uma busca fresca (pega o provedor atual).
      if (cnpjs.length) await pool.query(
        `UPDATE empresas SET contatos_verificados='[]'::jsonb WHERE cnpj = ANY($1::text[])`, [cnpjs]);
      // Limpa o contato/pendência antigos do lead pra o resultado refletir só a
      // busca nova (senão dado errado anterior fica "grudado" se a nova não achar).
      await pool.query(
        `UPDATE leads SET contato_validado=NULL, contato_pendente=false WHERE id = ANY($1::int[])`, [idsInt]);
      // preservar: o usuário pediu pra ATUALIZAR estes leads — se a busca nova
      // não achar telefone, o lead fica pendente, mas NUNCA é apagado.
      await Promise.all(rows.map(r =>
        monitorQueues.validacao.add('validacao', { cnpj: r.cnpj, busca_id: r.busca_id, lead_id: r.id, preservar: true },
          { jobId: `reval-${r.id}-${Date.now()}`, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 2, backoff: { type: 'exponential', delay: 10000 } })
      ));
      return res.json({ ok: true, reenfileirados: rows.length });
    }

    // Exclusão definitiva dos leads selecionados. Marca a empresa como
    // 'descarte_duro' (estado travado) pra ela NÃO reaparecer: sem isso, uma
    // busca ativa re-descobriria a empresa e recriaria o lead na hora — dando a
    // impressão de que a exclusão "não pegou". Depois apaga os leads.
    if (acao === 'excluir') {
      await pool.query(
        `INSERT INTO empresa_tenant_estado (cnpj, estado_global)
         SELECT cnpj, 'descarte_duro' FROM leads WHERE id = ANY($1::int[])
         ON CONFLICT (cnpj, tenant_id) DO UPDATE SET estado_global='descarte_duro', atualizado_em=now()`,
        [idsInt]);
      const { rowCount } = await pool.query(`DELETE FROM leads WHERE id = ANY($1::int[])`, [idsInt]);
      return res.json({ ok: true, excluidos: rowCount });
    }

    if (!['Novo','Qualificado','Incompleto','Descartado','Enviado'].includes(status))
      return res.status(400).json({ erro: 'status inválido' });
    await pool.query(
      `UPDATE leads SET status=$1, atualizado_em=now() WHERE id = ANY($2::int[])`,
      [status, idsInt]);
    res.json({ ok: true, atualizados: idsInt.length });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// CRM ativo (pro modal de envio mostrar o destino real).
app.get('/api/crm/status', requireAuth, async (req, res) => {
  try {
    const { rows: [ig] } = await pool.query(
      `SELECT provedor, config FROM integracoes
       WHERE categoria='crm' AND ativo=true AND key_cifrada IS NOT NULL AND key_cifrada <> ''
       ORDER BY ordem LIMIT 1`
    );
    if (!ig) return res.json({ ativo: false });
    // Nome/detalhe técnico (qual provedor) é sigiloso — só o master vê. Pro
    // cliente, só importa que HÁ um CRM conectado.
    if (!req.user.master) return res.json({ ativo: true, nome: 'CRM conectado', detalhe: 'Os dados do lead serão enviados ao CRM configurado.' });
    const nomes = { gk: 'CRM GK SaaS', webhook: 'Webhook' };
    const detalhe = ig.provedor === 'gk'
      ? 'Cria/atualiza o contato e abre um ticket na fila configurada (status Aguardando).'
      : 'Envia os dados do lead (empresa, decisor, score, SWOT) via POST para a URL de webhook.';
    res.json({ ativo: true, provedor: ig.provedor, nome: nomes[ig.provedor] || ig.provedor, detalhe });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// ── API: monitoramento do motor (Fase 3) ───────────────────────────────────────

app.get('/api/monitor/queues', requireAuth, requireMaster, async (req, res) => {
  try {
    const [leadsHoje, empresasTotal, buscasAtivas, descartados] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM leads WHERE criado_em >= now() - interval '1 day'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM empresas`),
      pool.query(`SELECT COUNT(*)::int AS n FROM buscas WHERE status='Ativa'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM leads WHERE estagio='descartado' AND criado_em >= now() - interval '1 day'`),
    ]);

    let queues = [];
    let dlq = [];
    if (monitorQueues) {
      const entries = [
        ['descoberta', 'Descoberta'],
        ['enriquecimento', 'Enriquecimento'],
        ['filtroContador', 'Filtro Contador'],
        ['score1', 'Score 1'],
        ['validacao', 'Validação de contato'],
        ['swot', 'Agente SWOT'],
        ['crm', 'Envio CRM'],
      ];
      queues = await Promise.all(entries.map(async ([key, label]) => {
        const q = monitorQueues[key];
        const [waiting, active, completed, failed] = await Promise.all([
          q.getWaitingCount(), q.getActiveCount(), q.getCompletedCount(), q.getFailedCount(),
        ]);
        return { key, label, waiting, active, completed, failed };
      }));

      const falhasPorFila = await Promise.all(entries.map(async ([key, label]) => {
        const q = monitorQueues[key];
        const jobs = await q.getFailed(0, 4);
        return jobs.map(j => ({
          job: label, ref: j.data?.cnpj || j.data?.busca_id || '—',
          motivo: (j.failedReason || 'erro desconhecido').slice(0, 140),
          quando: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
        }));
      }));
      dlq = falhasPorFila.flat().sort((a, b) => (b.quando||'').localeCompare(a.quando||'')).slice(0, 10);
    }

    res.json({
      queues,
      dlq,
      motor_conectado: !!monitorQueues,
      leads_hoje: leadsHoje.rows[0].n,
      empresas_total: empresasTotal.rows[0].n,
      buscas_ativas: buscasAtivas.rows[0].n,
      descartados_hoje: descartados.rows[0].n,
    });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// Limpa as falhas retidas nas filas (a DLQ é histórico; some ao limpar).
app.post('/api/monitor/dlq/limpar', requireAuth, requireMaster, async (req, res) => {
  if (!monitorQueues) return res.json({ ok: true, removidos: 0 });
  try {
    let removidos = 0;
    for (const q of Object.values(monitorQueues)) {
      const jobs = await q.getFailed(0, 999);
      await Promise.all(jobs.map(j => j.remove().then(() => { removidos++; }).catch(() => {})));
    }
    res.json({ ok: true, removidos });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// Alertas do sino: falhas do motor, buscas paradas e o estado da conexão.
app.get('/api/alertas', requireAuth, async (req, res) => {
  try {
    const alertas = [];
    // Alertas de MOTOR/PROVEDOR (citam CNPJá, chaves de API, filas) são sigilosos
    // — só o MASTER da Hunter os recebe. O cliente nunca vê essa informação.
    const master = !!req.user.master;

    if (master && process.env.REDIS_HOST && !monitorQueues) {
      alertas.push({ tipo: 'erro', titulo: 'Motor desconectado do painel', detalhe: 'Redis/BullMQ indisponível', quando: null });
    }

    if (master && monitorQueues) {
      for (const [key, label] of [['descoberta','Descoberta'],['enriquecimento','Enriquecimento'],['filtroContador','Filtro Contador'],['score1','Score 1']]) {
        const jobs = await monitorQueues[key].getFailed(0, 4);
        for (const j of jobs) {
          alertas.push({
            tipo: 'erro',
            titulo: `Falha em ${label}`,
            detalhe: (j.failedReason || 'erro desconhecido').slice(0, 120),
            quando: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
          });
        }
      }
    }

    const { rows: [cfg] } = await pool.query(`SELECT parada_min FROM config`);
    const paradaMin = cfg?.parada_min || 30;
    // Só alerta busca ATIVA que ficou de fato parada além da carência. Usa o
    // sinal de vida mais recente (heartbeat, última atividade OU criação) — assim
    // uma busca recém-criada, ainda sem heartbeat, NÃO dispara alerta na hora.
    const { rows: paradas } = await pool.query(
      `SELECT nome, ultimo_heartbeat FROM buscas
       WHERE status='Ativa' AND ritmo > 0
         AND COALESCE(ultimo_heartbeat, ultima_ativ, criado_em) < now() - ($1 || ' minutes')::interval
       ORDER BY COALESCE(ultimo_heartbeat, ultima_ativ, criado_em) NULLS FIRST LIMIT 5`, [paradaMin]
    );
    for (const b of paradas) {
      alertas.push({ tipo: 'aviso', titulo: `Busca "${b.nome}" sem atividade`, detalhe: `sem heartbeat há mais de ${paradaMin} min`, quando: b.ultimo_heartbeat ? new Date(b.ultimo_heartbeat).toISOString() : null });
    }

    alertas.sort((a, b) => (b.quando || '').localeCompare(a.quando || ''));
    res.json({ alertas: alertas.slice(0, 15), total: alertas.length });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// ── API: integrações (chaves dos providers, Fase 3) ────────────────────────────
// Cifragem real da key fica pra tela dedicada da Fase 3.1; por ora a tela de
// Integrações usa estes endpoints pra ligar/desligar e trocar a chave do CNPJá.

function maskKey(k) {
  if (!k) return null;
  const s = String(k);
  return s.length <= 4 ? '••••' : '•'.repeat(Math.max(0, s.length - 4)) + s.slice(-4);
}

app.get('/api/integracoes', requireAuth, requireMaster, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, categoria, provedor, config, ativo, ordem, criado_em,
        (key_cifrada IS NOT NULL AND key_cifrada <> '') AS tem_chave,
        right(key_cifrada, 4) AS chave_final
       FROM integracoes ORDER BY categoria, ordem`
    );
    res.json(rows.map(r => ({ ...r, chave_mascarada: r.tem_chave ? maskKey('x'.repeat(8) + r.chave_final) : null, chave_final: undefined })));
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.post('/api/integracoes', requireAuth, requireMaster, async (req, res) => {
  const categoria = String(req.body.categoria || '').trim();
  const provedor = String(req.body.provedor || '').trim();
  const key = req.body.key != null ? String(req.body.key).trim() : null;
  const ativo = !!req.body.ativo;
  const ordem = Number.isInteger(req.body.ordem) ? req.body.ordem : 100;
  const config = req.body.config && typeof req.body.config === 'object' ? JSON.stringify(req.body.config) : null;
  const categoriasValidas = ['descoberta','contato','validacao_email','validacao_tel','crm','ia','busca_web'];
  if (!categoriasValidas.includes(categoria) || !provedor) {
    return res.status(400).json({ erro: 'categoria/provedor inválidos' });
  }
  try {
    const { rows: [row] } = await pool.query(`
      INSERT INTO integracoes (categoria, provedor, key_cifrada, config, ativo, ordem)
      VALUES ($1,$2,$3,COALESCE($4::jsonb,'{}'::jsonb),$5,$6)
      ON CONFLICT (tenant_id, categoria, provedor) DO UPDATE SET
        key_cifrada = COALESCE(NULLIF($3,''), integracoes.key_cifrada),
        config = COALESCE($4::jsonb, integracoes.config),
        ativo = $5, ordem = $6
      RETURNING id, categoria, provedor, config, ativo, ordem`,
      [categoria, provedor, key, config, ativo, ordem]
    );
    res.status(201).json(row);
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.patch('/api/integracoes/:id', requireAuth, requireMaster, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  const sets = [], vals = [];
  if (typeof req.body.ativo === 'boolean') { sets.push(`ativo=$${sets.length+1}`); vals.push(req.body.ativo); }
  if (req.body.key) { sets.push(`key_cifrada=$${sets.length+1}`); vals.push(String(req.body.key)); }
  if (req.body.config && typeof req.body.config === 'object') { sets.push(`config=$${sets.length+1}::jsonb`); vals.push(JSON.stringify(req.body.config)); }
  if (Number.isInteger(req.body.ordem)) { sets.push(`ordem=$${sets.length+1}`); vals.push(req.body.ordem); }
  if (!sets.length) return res.status(400).json({ erro: 'nada para atualizar' });
  vals.push(id);
  try {
    const { rows: [row] } = await pool.query(
      `UPDATE integracoes SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING id, categoria, provedor, config, ativo, ordem`, vals
    );
    if (!row) return res.status(404).json({ erro: 'não encontrado' });
    res.json(row);
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// GK CRM: testa a conexão (backend + token) e lista empresas + filas pra a UI.
const gk = require('./providers/gk');
// Filas do CRM usando a integração JÁ salva — sem pedir token e sem exigir
// master. Serve pra escolher a fila na criação de cada radar. Devolve lista
// vazia (200) quando não há CRM configurado, pra UI só esconder o campo.
app.get('/api/crm/filas', requireAuth, async (req, res) => {
  try {
    const { rows: [ig] } = await pool.query(
      `SELECT provedor, key_cifrada, config FROM integracoes
       WHERE categoria='crm' AND provedor='gk' AND ativo=true
         AND key_cifrada IS NOT NULL AND key_cifrada <> '' LIMIT 1`
    );
    if (!ig?.config?.backend) return res.json({ filas: [], padrao: null });
    const filas = await gk.listarFilas(ig.config.backend, ig.key_cifrada).catch(() => []);
    res.json({ filas, padrao: ig.config.queueId || null });
  } catch (e) { console.error(e); res.json({ filas: [], padrao: null }); }
});

app.post('/api/integracoes/gk/conectar', requireAuth, requireMaster, async (req, res) => {
  const backend = String(req.body.backend || '').trim();
  const token = String(req.body.token || '').trim();
  if (!backend || !token) return res.status(400).json({ erro: 'informe Backend e Token' });
  try {
    // Filas é o que importa pra abrir ticket (obrigatório). Empresas é opcional:
    // tokens scoped a uma empresa não acessam /companies/all (401) — tudo bem.
    const filas = await gk.listarFilas(backend, token);
    const empresas = await gk.listarEmpresas(backend, token).catch(() => []);
    res.json({ ok: true, empresas, filas });
  } catch(e) {
    res.status(400).json({ erro: e.message });
  }
});

// ── API: configuração global ────────────────────────────────────────────────────
app.get('/api/config', requireAuth, requireMaster, async (req, res) => {
  try {
    const { rows: [c] } = await pool.query(`SELECT * FROM config`);
    res.json(c || {});
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.patch('/api/config', requireAuth, requireMaster, async (req, res) => {
  const b = req.body || {};
  const sets = [], vals = [];
  const num = (v, min, max) => { const n = parseInt(v, 10); return isNaN(n) ? null : Math.max(min, Math.min(max, n)); };
  const add = (col, val) => { if (val != null) { sets.push(`${col}=$${sets.length+1}`); vals.push(val); } };
  if ('ritmo_padrao'   in b) add('ritmo_padrao',   num(b.ritmo_padrao, 0, 100000));
  if ('corte_padrao'   in b) add('corte_padrao',   num(b.corte_padrao, 0, 100));
  if ('ttl_cache_dias' in b) add('ttl_cache_dias', num(b.ttl_cache_dias, 1, 3650));
  if ('parada_min'     in b) add('parada_min',     num(b.parada_min, 1, 10080));
  if ('limite_diario'  in b) add('limite_diario',  num(b.limite_diario, 0, 100000));
  if ('descoberta_modo_padrao' in b) { sets.push(`descoberta_modo_padrao=$${sets.length+1}`); vals.push(b.descoberta_modo_padrao === 'web' ? 'web' : 'cnpja'); }
  if ('web_paid_lookup_ativo' in b) { sets.push(`web_paid_lookup_ativo=$${sets.length+1}`); vals.push(!!b.web_paid_lookup_ativo); }
  if ('web_paid_lookup_limite' in b) add('web_paid_lookup_limite', num(b.web_paid_lookup_limite, 0, 10000));
  if ('alerta_email'   in b) { sets.push(`alerta_email=$${sets.length+1}`); vals.push(String(b.alerta_email || '').trim() || null); }
  if ('crm_auto_global' in b) { sets.push(`crm_auto_global=$${sets.length+1}`); vals.push(!!b.crm_auto_global); }
  if ('crm_lookalike_auto' in b) { sets.push(`crm_lookalike_auto=$${sets.length+1}`); vals.push(!!b.crm_lookalike_auto); }
  if ('crm_conversao_tags' in b) {
    const tags = (Array.isArray(b.crm_conversao_tags) ? b.crm_conversao_tags : String(b.crm_conversao_tags || '').split(','))
      .map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 40);
    sets.push(`crm_conversao_tags=$${sets.length+1}`); vals.push(tags);
  }
  if ('swot_perfil' in b) {
    // Perfil comercial do cliente (fichamento) — objeto {chave: resposta}. Só
    // aceita strings, corta cada resposta em 1200 chars e no máx. 30 campos.
    const src = (b.swot_perfil && typeof b.swot_perfil === 'object' && !Array.isArray(b.swot_perfil)) ? b.swot_perfil : {};
    const limpo = {};
    for (const [k, v] of Object.entries(src).slice(0, 30)) {
      const val = String(v == null ? '' : v).trim().slice(0, 1200);
      if (val) limpo[String(k).slice(0, 40)] = val;
    }
    sets.push(`swot_perfil=$${sets.length+1}::jsonb`); vals.push(JSON.stringify(limpo));
  }
  if (!sets.length) return res.status(400).json({ erro: 'nada para atualizar' });
  try {
    const { rows: [c] } = await pool.query(`UPDATE config SET ${sets.join(', ')} RETURNING *`, vals);
    res.json(c);
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// ── Webhook de ENTRADA: o CRM avisa quando um lead vira cliente ────────────────
// Quando o closer marca "fechado/comprou/qualificado" no CRM, ele chama esta URL
// e o CNPJ entra na lista de semelhantes — o perfil se refina sozinho.
const webhookLimiter = rateLimit({ windowMs: 60_000, max: 120 });

app.post('/api/webhooks/crm/conversao', webhookLimiter, async (req, res) => {
  try {
    const { rows:[cfg] } = await pool.query(
      `SELECT crm_conversao_tags, crm_lookalike_auto, webhook_entrada_secret FROM config`
    );
    const secret = cfg?.webhook_entrada_secret;
    if (!secret) return res.status(503).json({ erro: 'webhook de entrada não configurado' });
    const token = req.get('x-hunter-token') || req.query.token;
    if (token !== secret) return res.status(401).json({ erro: 'token inválido' });

    const body = req.body || {};
    // Caminho principal: o Hunter carimba um `hunter_ref` único no contato ao
    // enviar pro CRM. O CRM só devolve esse ref e nós achamos o CNPJ na base —
    // sem depender de o CRM reenviar todos os dados. Fallback: extrair o CNPJ.
    const ref = extrairRef(body);
    let cnpj = null, via = 'cnpj';
    if (ref) {
      const { rows:[l] } = await pool.query(`SELECT cnpj FROM leads WHERE crm_ref=$1 ORDER BY id DESC LIMIT 1`, [ref]);
      if (l?.cnpj) { cnpj = l.cnpj; via = 'ref'; }
    }
    if (!cnpj) cnpj = extrairCnpj(body);
    cnpj = String(cnpj || '').replace(/\D/g, '');   // sementes sempre com 14 dígitos limpos
    if (cnpj.length !== 14) return res.status(400).json({ erro: 'não identifiquei o lead: nem hunter_ref conhecido nem CNPJ no payload' });
    const tagsRecebidas = coletarTags(body);

    const tagsConv = (cfg.crm_conversao_tags || []).map(t => String(t).toLowerCase());
    const casou = tagsRecebidas.find(t => tagsConv.some(c => t.includes(c) || c.includes(t)));
    // Se o payload trouxe sinais de tag/status mas NENHUM é de conversão, ignora.
    if (tagsRecebidas.length && tagsConv.length && !casou) {
      return res.json({ ok: true, ignorado: 'tag_nao_conversao', tags: tagsRecebidas });
    }
    const tag = casou || tagsRecebidas[0] || null;

    await pool.query(
      `INSERT INTO sementes (cnpj, lista, origem, tag) VALUES ($1,'conversoes_crm','crm',$2)
       ON CONFLICT (tenant_id, lista, cnpj) DO NOTHING`, [cnpj, tag]
    );
    const { rows:[{ n }] } = await pool.query(`SELECT COUNT(*)::int n FROM sementes WHERE lista='conversoes_crm'`);

    let busca_auto = null;
    if (cfg.crm_lookalike_auto) busca_auto = await garantirBuscaLookalikeAuto(n);
    res.json({ ok: true, cnpj, via, total_lista: n, busca_auto });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// Acha o hunter_ref no payload (chave chamada hunter_ref OU valor no formato hnt_xxxx).
function extrairRef(obj, prof = 0) {
  if (obj == null || prof > 6) return null;
  if (typeof obj === 'string') return /^hnt_[0-9a-f]{8,}$/i.test(obj.trim()) ? obj.trim() : null;
  if (Array.isArray(obj)) { for (const v of obj) { const r = extrairRef(v, prof + 1); if (r) return r; } return null; }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (/hunter_?ref/i.test(k)) {
        if (typeof v === 'string' && v.trim()) return v.trim();
        const r = extrairRef(v, prof + 1); if (r) return r;   // ex.: {name:'hunter_ref', value:'hnt_..'}
      }
    }
    for (const v of Object.values(obj)) { const r = extrairRef(v, prof + 1); if (r) return r; }
  }
  return null;
}

// Varre o payload (qualquer aninhamento) e devolve o primeiro CNPJ (14 dígitos).
// Prioriza chaves com cara de documento pra evitar pegar um id numérico à toa.
function extrairCnpj(obj, prof = 0) {
  if (obj == null || prof > 6) return null;
  if (typeof obj === 'string' || typeof obj === 'number') {
    const d = String(obj).replace(/\D/g, '');
    return d.length === 14 ? d : null;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) { const c = extrairCnpj(v, prof + 1); if (c) return c; }
    return null;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (/cnpj|documento|document|cpf_?cnpj/i.test(k)) { const c = extrairCnpj(obj[k], prof + 1); if (c) return c; }
    }
    for (const k of Object.keys(obj)) { const c = extrairCnpj(obj[k], prof + 1); if (c) return c; }
  }
  return null;
}

// Coleta strings de tag/status/fila/etapa em qualquer nível (inclui tags:[{name}]).
function coletarTags(obj, prof = 0, acc = new Set()) {
  if (obj == null || prof > 6) return [...acc];
  if (Array.isArray(obj)) { for (const v of obj) coletarTags(v, prof + 1, acc); return [...acc]; }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (/^(tag|tags|status|stage|etapa|situac|fila|queue|kanban|lane|evento|event)/i.test(k)) {
        if (typeof v === 'string') acc.add(v.trim().toLowerCase());
        else if (Array.isArray(v)) for (const it of v) {
          if (typeof it === 'string') acc.add(it.trim().toLowerCase());
          else if (it && typeof it === 'object' && it.name) acc.add(String(it.name).trim().toLowerCase());
        } else if (v && typeof v === 'object' && v.name) acc.add(String(v.name).trim().toLowerCase());
      }
      if (v && typeof v === 'object') coletarTags(v, prof + 1, acc);
    }
  }
  return [...acc];
}

// Garante a busca lookalike auto-alimentada; ao chegar semente nova, limpa o
// perfil e reativa pra o motor re-perfilar com a lista atualizada.
async function garantirBuscaLookalikeAuto(total) {
  const status = total >= 3 ? 'Ativa' : 'Pausada';
  const { rows:[existe] } = await pool.query(
    `SELECT id, criterios FROM buscas WHERE lista='conversoes_crm' AND tipo='lookalike' ORDER BY id LIMIT 1`
  );
  if (existe) {
    const crit = existe.criterios || {};
    delete crit.params; // zera o perfil → re-perfila com a nova semente
    await pool.query(`UPDATE buscas SET criterios=$2::jsonb, status=$3, ultima_ativ=now() WHERE id=$1`,
      [existe.id, JSON.stringify(crit), status]);
    return existe.id;
  }
  const { rows:[u] } = await pool.query(`SELECT id FROM usuarios ORDER BY id LIMIT 1`);
  const { rows:[nova] } = await pool.query(
    `INSERT INTO buscas (nome, tipo, status, lista, ritmo, criterios, corte_score, criador_id, ultima_ativ)
     VALUES ('Semelhantes — clientes do CRM','lookalike',$1,'conversoes_crm',100,'{"proposta_valor":""}'::jsonb,60,$2,now())
     RETURNING id`, [status, u?.id || null]
  );
  return nova.id;
}

// Gera/rotaciona o segredo do webhook de entrada (só admin).
app.post('/api/webhooks/rotacionar-secret', requireAuth, requireMaster, async (req, res) => {
  try {
    const secret = crypto.randomBytes(24).toString('hex');
    await pool.query(`UPDATE config SET webhook_entrada_secret=$1`, [secret]);
    res.json({ secret });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// Situação da lista de semelhantes alimentada pelo CRM (pra tela de Config).
app.get('/api/sementes/status', requireAuth, requireMaster, async (req, res) => {
  try {
    const { rows:[{ n }] } = await pool.query(`SELECT COUNT(*)::int n FROM sementes WHERE lista='conversoes_crm'`);
    const { rows:[b] } = await pool.query(
      `SELECT id, status FROM buscas WHERE lista='conversoes_crm' AND tipo='lookalike' ORDER BY id LIMIT 1`
    );
    const { rows: ult } = await pool.query(
      `SELECT cnpj, tag, criado_em FROM sementes WHERE lista='conversoes_crm' ORDER BY criado_em DESC LIMIT 5`
    );
    res.json({ total: n, busca: b || null, ultimas: ult });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// ── Busca de atividade em linguagem natural (texto → CNAE via IA) ──────────────
let _catalogoCnae = null;
function catalogoCnae() {
  if (!_catalogoCnae) {
    try { _catalogoCnae = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'cnae.json'), 'utf8')); }
    catch { _catalogoCnae = []; }
  }
  return _catalogoCnae;
}
const _cacheSugestao = new Map();               // memoiza por texto (evita repagar a IA)
const iaLimiter = rateLimit({ windowMs: 60_000, max: 30 });

// Extrai CNPJs de um arquivo enviado (.txt/.csv/.pdf). O front manda o conteúdo
// em base64; devolvemos a lista de CNPJs (14 dígitos, sem repetição) pra popular
// o campo da busca "Por CNPJ". Não consulta nada pago — só lê o arquivo.
const uploadLimiter = rateLimit({ windowMs: 60_000, max: 20 });
app.post('/api/cnpjs/extrair', requireAuth, requireEditor, uploadLimiter, async (req, res) => {
  try {
    const b64 = String(req.body?.base64 || '');
    const nome = String(req.body?.nome || '');
    if (!b64) return res.status(400).json({ erro: 'arquivo vazio' });
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length) return res.status(400).json({ erro: 'não consegui ler o arquivo' });
    const arquivoCnpj = require('./providers/arquivo-cnpj');
    const { cnpjs, tipo } = arquivoCnpj.extrair(buffer, nome);
    res.json({ cnpjs, total: cnpjs.length, tipo });
  } catch (e) {
    console.error('[cnpjs/extrair]', e.message);
    res.status(500).json({ erro: 'não consegui extrair CNPJs deste arquivo' });
  }
});

app.post('/api/cnae/sugerir', requireAuth, requireEditor, iaLimiter, async (req, res) => {
  try {
    const texto = String(req.body?.texto || '').trim();
    if (texto.length < 3) return res.json({ sugestoes: [] });

    const chave = texto.toLowerCase();
    if (_cacheSugestao.has(chave)) return res.json({ sugestoes: _cacheSugestao.get(chave), cache: true });

    const openai = require('./providers/openai');
    // Preferência: OpenRouter primeiro (quando ativo); se falhar, cai na OpenAI.
    const igs = await openai.integracoesIA(pool);
    if (!igs.length) return res.json({ sugestoes: [], erro: 'ia_inativa' });

    let sugestoes = null, ultimoErro = null;
    for (const ig of igs) {
      try {
        sugestoes = await openai.sugerirCnae(texto, catalogoCnae(), { apiKey: ig.key_cifrada, modelo: ig.config?.modelo, provedor: ig.provedor });
        break;
      } catch (e) { ultimoErro = e; }
    }
    if (sugestoes === null) throw ultimoErro;
    if (sugestoes.length) _cacheSugestao.set(chave, sugestoes);
    res.json({ sugestoes });
  } catch (e) {
    console.error('[cnae/sugerir]', e.message);
    res.status(502).json({ sugestoes: [], erro: e.message });
  }
});

// ── Limpeza dos dados de demonstração (seed) ───────────────────────────────────
const SEED_BUSCAS_NOMES = [
  'Agências de marketing — Sul', 'Indústrias alimentícias — GO/MG', 'Clínicas médicas — capitais NE',
  'Construtoras porte grande — SP', 'Escritórios de advocacia — DF', 'Startups SaaS — semelhantes',
  'Restaurantes — POA',
];
const SEED_LEADS_CNPJS = [
  '18402551000109','27918330000144','09221764000172','31556092000118','22044871000105',
  '14880213000166','35112908000130','40337115000192','19770844000151','28901556000123',
];

// Acha as buscas do seed: nome conhecido + a "impressão digital" do seed
// (critérios em `chips` legados e SEM `params` — buscas reais do usuário têm params).
async function idsBuscasSeed() {
  const { rows } = await pool.query(
    `SELECT id FROM buscas
     WHERE nome = ANY($1)
       AND (criterios ? 'chips') AND NOT (criterios ? 'params')`,
    [SEED_BUSCAS_NOMES]
  );
  return rows.map(r => r.id);
}

// Preview: quantos itens de demonstração existem (sem apagar).
app.get('/api/admin/demo', requireAuth, requireMaster, async (req, res) => {
  try {
    const ids = await idsBuscasSeed();
    const { rows:[l] } = await pool.query(
      `SELECT COUNT(*)::int n FROM leads
       WHERE busca_id = ANY($1) OR regexp_replace(cnpj,'\\D','','g') = ANY($2)`,
      [ids, SEED_LEADS_CNPJS]
    );
    res.json({ buscas: ids.length, leads: l.n });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// Apaga as buscas de demonstração + os leads que elas geraram + os 10 leads fake.
// As empresas ficam (cache grátis da Receita; não aparecem no painel).
app.post('/api/admin/limpar-demo', requireAuth, requireMaster, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id FROM buscas WHERE nome = ANY($1) AND (criterios ? 'chips') AND NOT (criterios ? 'params')`,
      [SEED_BUSCAS_NOMES]
    );
    const ids = rows.map(r => r.id);
    const dl = await client.query(
      `DELETE FROM leads WHERE busca_id = ANY($1) OR regexp_replace(cnpj,'\\D','','g') = ANY($2)`,
      [ids, SEED_LEADS_CNPJS]
    );
    const db = ids.length
      ? await client.query(`DELETE FROM buscas WHERE id = ANY($1)`, [ids])
      : { rowCount: 0 };
    await client.query('COMMIT');
    res.json({ ok: true, buscas_removidas: db.rowCount, leads_removidos: dl.rowCount });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[limpar-demo]', e.message);
    res.status(500).json({ erro: 'erro interno' });
  } finally { client.release(); }
});

// Diagnóstico ao vivo (master): versão/boot do worker + estado de CNPJs.
// Uso: /api/admin/motor?cnpjs=07851438000122,21675387000156
app.get('/api/admin/motor', requireAuth, requireMaster, async (req, res) => {
  try {
    let worker = null;
    try { const { rows:[s] } = await pool.query(`SELECT worker_boot, worker_versao FROM motor_status`); worker = s || null; }
    catch { worker = null; }   // tabela ainda não criada (worker nunca subiu com a versão nova)
    let cnpjs = [];
    if (req.query.cnpjs) {
      const list = String(req.query.cnpjs).split(/[^\d]+/).map(x => x.replace(/\D/g,'')).filter(x => x.length === 14);
      if (list.length) {
        const { rows } = await pool.query(
          `SELECT e.cnpj, coalesce(ete.estado_global, '(sem estado neste tenant)') AS estado_global, e.razao, e.fantasia,
             (SELECT COUNT(*)::int FROM leads l WHERE l.cnpj = e.cnpj) AS leads,
             (SELECT jsonb_build_object(
                'status', l.status, 'pendente', l.contato_pendente,
                'site', l.contato_validado->>'website', 'tel', l.contato_validado->>'telefone',
                'email', l.contato_validado->>'email', 'fonte', l.contato_validado->>'fonte',
                'resumo', left(coalesce(l.contato_validado->>'resumo_site',''), 140))
              FROM leads l WHERE l.cnpj = e.cnpj ORDER BY l.id DESC LIMIT 1) AS contato
           FROM empresas e
           LEFT JOIN empresa_tenant_estado ete ON ete.cnpj = e.cnpj
           WHERE e.cnpj = ANY($1::text[])`, [list]);
        const achados = new Set(rows.map(r => r.cnpj));
        cnpjs = rows;
        for (const c of list) if (!achados.has(c)) cnpjs.push({ cnpj: c, estado_global: '(não está na base)', leads: 0 });
      }
    }
    res.json({ worker, agora: new Date().toISOString(), cnpjs });
  } catch (e) { console.error('[admin/motor]', e.message); res.status(500).json({ erro: 'erro interno' }); }
});

// Contagem da base operacional inteira (pra tela de manutenção).
app.get('/api/admin/base', requireAuth, requireMaster, async (req, res) => {
  try {
    const { rows:[c] } = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM buscas) buscas,
              (SELECT COUNT(*)::int FROM leads) leads,
              (SELECT COUNT(*)::int FROM empresas) empresas,
              (SELECT COUNT(*)::int FROM sementes) sementes`
    );
    res.json(c);
  } catch (e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// Zera TODA a base operacional (buscas, leads, empresas, sementes). Mantém
// usuários, configurações e integrações (chaves). Ação irreversível.
app.post('/api/admin/limpar-tudo', requireAuth, requireMaster, async (req, res) => {
  try {
    await pool.query(`TRUNCATE leads, sementes, buscas, empresas RESTART IDENTITY CASCADE`);
    res.json({ ok: true });
  } catch (e) { console.error('[limpar-tudo]', e.message); res.status(500).json({ erro: 'erro interno' }); }
});

// ── arquivos estáticos ────────────────────────────────────────────────────────

app.get('/login.html', (req, res) => res.sendFile(path.join(PUBLIC, 'login.html')));
app.get('/hunter_logo_icon.png', (req, res) => res.sendFile(path.join(PUBLIC, 'hunter_logo_icon.png')));

function gate(req, res, next) {
  if (getUser(req)) return next();
  return res.status(401).send('Faça login para acessar.');
}
app.get('/app.js', gate, (req, res) => res.sendFile(path.join(PUBLIC, 'app.js')));
app.get('/cnae.json', gate, (req, res) => res.sendFile(path.join(PUBLIC, 'cnae.json')));
app.get('/municipios.json', gate, (req, res) => res.sendFile(path.join(PUBLIC, 'municipios.json')));
app.use('/vendor', gate, express.static(path.join(PUBLIC, 'vendor')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ erro: 'rota não encontrada' });
  return res.sendFile(path.join(PUBLIC, getUser(req) ? 'app.html' : 'login.html'));
});

init()
  .then(() => app.listen(PORT, () => console.log(`[hunter] ouvindo na porta ${PORT}`)))
  .catch(err => { console.error('[init] falhou:', err); process.exit(1); });
