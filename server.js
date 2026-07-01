'use strict';
/*
 * Hunter — Fase 3
 * Servidor Node/Express: serve o front + API de autenticação + API de dados
 * (leads, buscas, integrações) + monitoramento real das filas do motor.
 */
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'troque-este-segredo';
const COOKIE = 'hunter_session';
const SESSION_HOURS = 8;
const PUBLIC = path.join(__dirname, 'public');

const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@hunter.local').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mudar123';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

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
  const { q, status, uf, busca_id, email_only } = query;
  const conditions = [];
  const vals = [];
  if (q && q.trim()) {
    vals.push(`%${q.trim()}%`);
    const n = vals.length;
    conditions.push(`(l.fantasia ILIKE $${n} OR l.decisor ILIKE $${n} OR l.razao ILIKE $${n})`);
  }
  if (status) { vals.push(status); conditions.push(`l.status = $${vals.length}`); }
  if (uf) { vals.push(uf); conditions.push(`l.uf = $${vals.length}`); }
  if (busca_id) {
    const bid = parseInt(busca_id, 10);
    if (!isNaN(bid)) { vals.push(bid); conditions.push(`l.busca_id = $${vals.length}`); }
  }
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
      estado_global        TEXT NOT NULL DEFAULT 'coletado'
                             CHECK (estado_global IN ('coletado','qualificado','em_crm','descarte_duro')),
      origem_descoberta    TEXT,
      primeira_coleta      TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_empresas_estado ON empresas(estado_global);
    CREATE INDEX IF NOT EXISTS idx_empresas_uf     ON empresas(uf);
    CREATE INDEX IF NOT EXISTS idx_empresas_cnae   ON empresas(cnae);
  `);

  // integracoes: chaves dos providers de verificação/CRM, plugáveis e em cascata.
  // Suporta N providers (não é fixo) — cada um com ordem e on/off. A key é
  // guardada cifrada (preenchida pela tela Integrações na 3.1).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS integracoes (
      id            SERIAL PRIMARY KEY,
      categoria     TEXT NOT NULL
                      CHECK (categoria IN ('descoberta','contato','validacao_email','validacao_tel','crm','ia')),
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

  // Garante a linha do provider de descoberta (CNPJá) pra tela de Integrações
  // ter o que mostrar mesmo antes da chave ser cadastrada.
  await pool.query(`
    INSERT INTO integracoes (categoria, provedor, ativo, ordem)
    VALUES ('descoberta', 'cnpja', false, 10),
           ('ia', 'openai', false, 60),
           ('crm', 'gk', false, 35),
           ('crm', 'webhook', false, 40)
    ON CONFLICT (categoria, provedor) DO NOTHING
  `);

  const { rows:[{n:bCount}] } = await pool.query('SELECT COUNT(*)::int AS n FROM buscas');
  if (bCount === 0) {
    const { rows:[admin] } = await pool.query('SELECT id FROM usuarios LIMIT 1');
    await seed(admin?.id || null);
  }

  console.log('[init] banco pronto.');
}

// ── sessão ────────────────────────────────────────────────────────────────────

function setSession(res, user) {
  const token = jwt.sign(
    { id: user.id, nome: user.nome, email: user.email, papel: user.papel },
    JWT_SECRET,
    { expiresIn: `${SESSION_HOURS}h` }
  );
  res.cookie(COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'lax',
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
  if (!req.user || req.user.papel !== 'Admin')
    return res.status(403).json({ erro: 'apenas administradores' });
  next();
}

// ── app ───────────────────────────────────────────────────────────────────────

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
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
    res.json({ nome: user.nome, email: user.email, papel: user.papel });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE, { httpOnly: true, secure: true, sameSite: 'lax' });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) =>
  res.json({ id: req.user.id, nome: req.user.nome, email: req.user.email, papel: req.user.papel })
);

// ── API: usuários ─────────────────────────────────────────────────────────────

app.get('/api/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nome, email, papel, ativo, ultimo_acesso, criado_em FROM usuarios ORDER BY criado_em'
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
  const sets = [], vals = [];
  if (typeof req.body.ativo === 'boolean') { sets.push(`ativo=$${sets.length+1}`); vals.push(req.body.ativo); }
  if (['Admin','Operador','Visualizador'].includes(req.body.papel)) { sets.push(`papel=$${sets.length+1}`); vals.push(req.body.papel); }
  if (req.body.senha) { sets.push(`senha_hash=$${sets.length+1}`); vals.push(await bcrypt.hash(String(req.body.senha), 12)); }
  if (!sets.length) return res.status(400).json({ erro: 'nada para atualizar' });
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE usuarios SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING id, nome, email, papel, ativo`, vals
  );
  if (!rows[0]) return res.status(404).json({ erro: 'não encontrado' });
  res.json(rows[0]);
});

app.delete('/api/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (req.user.id === id) return res.status(400).json({ erro: 'não é possível excluir a si mesmo' });
  await pool.query('DELETE FROM usuarios WHERE id=$1', [id]);
  res.json({ ok: true });
});

// ── API: dashboard ────────────────────────────────────────────────────────────

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const [metricasRes, buscasRes, atividadeRes] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*)::int FROM buscas WHERE status='Ativa') AS buscas_ativas,
        (SELECT COUNT(*)::int FROM leads) AS leads_total,
        (SELECT COUNT(*)::int FROM leads WHERE status='Qualificado') AS qualificados,
        (SELECT COUNT(*)::int FROM leads WHERE status='Enviado') AS enviados`),
      pool.query(`
        SELECT b.id, b.nome, b.ritmo, b.status, b.ultima_ativ,
          COUNT(l.id)::int AS encontrados
        FROM buscas b LEFT JOIN leads l ON l.busca_id = b.id
        WHERE b.status = 'Ativa'
        GROUP BY b.id ORDER BY b.ultima_ativ DESC NULLS LAST LIMIT 5`),
      pool.query(`SELECT fantasia, cidade, uf, score, criado_em FROM leads ORDER BY criado_em DESC LIMIT 5`),
    ]);
    const m = metricasRes.rows[0] || {};
    res.json({
      metricas: {
        buscasAtivas: m.buscas_ativas ?? 0,
        leadsEncontrados: m.leads_total ?? 0,
        leadsQualificados: m.qualificados ?? 0,
        leadsCRM: m.enviados ?? 0,
      },
      buscasAtivas: buscasRes.rows.map(b => ({ ...b, enc: b.encontrados, health: computeHealth(b) })),
      atividade: atividadeRes.rows,
    });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// ── API: buscas ───────────────────────────────────────────────────────────────

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
        COUNT(l.id)::int AS encontrados,
        COUNT(l.id) FILTER (WHERE l.status='Qualificado')::int AS qualificados,
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
  try {
    const { rows:[b] } = await pool.query(
      `INSERT INTO buscas (nome, tipo, ritmo, criterios, corte_score, crm_auto, criador_id, ultima_ativ)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,now()) RETURNING *`,
      [nome, tipo, ritmo, JSON.stringify(criterios), corteScore, crmAuto, req.user.id]
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
          COUNT(l.id)::int AS encontrados,
          COUNT(l.id) FILTER (WHERE l.status='Qualificado')::int AS qualificados,
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
      enc: b.encontrados, qual: b.qualificados, crm: b.enviados,
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
        l.decisor, l.cargo, l.score, l.tem_email, l.tem_telefone, l.status, l.busca_id
        FROM leads l ${where} ORDER BY l.score DESC, l.id
        LIMIT $${vals.length+1} OFFSET $${vals.length+2}`,
        [...vals, perPage, (page-1)*perPage]),
    ]);
    const total = countRes.rows[0].total;
    res.json({ leads: dataRes.rows, total, page, per_page: perPage, pages: Math.ceil(total/perPage) || 1 });
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

app.get('/api/leads/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'id inválido' });
  try {
    const { rows:[l] } = await pool.query(
      `SELECT l.*, b.nome AS busca_nome FROM leads l
       LEFT JOIN buscas b ON b.id=l.busca_id WHERE l.id=$1`, [id]);
    if (!l) return res.status(404).json({ erro: 'não encontrado' });
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

app.post('/api/leads/acoes', requireAuth, requireEditor, async (req, res) => {
  const { ids, status, acao } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ erro: 'ids obrigatório' });
  const idsInt = ids.map(x => parseInt(x,10)).filter(x => !isNaN(x));
  if (!idsInt.length) return res.status(400).json({ erro: 'ids inválidos' });
  try {
    // Envio manual ao CRM: enfileira cada lead na fila de webhook (com retry).
    if (acao === 'enviar_crm') {
      if (!monitorQueues?.crm) return res.status(503).json({ erro: 'motor de envio indisponível' });
      const { rows: [ig] } = await pool.query(
        `SELECT 1 FROM integracoes WHERE categoria='crm' AND provedor='webhook' AND ativo=true AND key_cifrada IS NOT NULL LIMIT 1`
      );
      if (!ig) return res.status(400).json({ erro: 'Configure o Webhook do CRM em Integrações e ative.' });
      await Promise.all(idsInt.map(id =>
        monitorQueues.crm.add('crm', { lead_id: id },
          { jobId: `crm-manual-${id}-${Date.now()}`, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 }, attempts: 4, backoff: { type: 'exponential', delay: 15000 } })
      ));
      return res.json({ ok: true, enfileirados: idsInt.length });
    }

    if (!['Novo','Qualificado','Incompleto','Descartado','Enviado'].includes(status))
      return res.status(400).json({ erro: 'status inválido' });
    await pool.query(
      `UPDATE leads SET status=$1, atualizado_em=now() WHERE id = ANY($2::int[])`,
      [status, idsInt]);
    res.json({ ok: true, atualizados: idsInt.length });
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

// ── API: monitoramento do motor (Fase 3) ───────────────────────────────────────

app.get('/api/monitor/queues', requireAuth, async (req, res) => {
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
app.post('/api/monitor/dlq/limpar', requireAuth, requireEditor, async (req, res) => {
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

    if (process.env.REDIS_HOST && !monitorQueues) {
      alertas.push({ tipo: 'erro', titulo: 'Motor desconectado do painel', detalhe: 'Redis/BullMQ indisponível', quando: null });
    }

    if (monitorQueues) {
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

    const { rows: paradas } = await pool.query(
      `SELECT nome, ultimo_heartbeat FROM buscas
       WHERE status='Ativa' AND ritmo > 0
         AND (ultimo_heartbeat IS NULL OR ultimo_heartbeat < now() - interval '15 minutes')
       ORDER BY ultimo_heartbeat NULLS FIRST LIMIT 5`
    );
    for (const b of paradas) {
      alertas.push({ tipo: 'aviso', titulo: `Busca "${b.nome}" sem atividade`, detalhe: 'sem heartbeat há mais de 15 min', quando: b.ultimo_heartbeat ? new Date(b.ultimo_heartbeat).toISOString() : null });
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

app.get('/api/integracoes', requireAuth, requireAdmin, async (req, res) => {
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

app.post('/api/integracoes', requireAuth, requireAdmin, async (req, res) => {
  const categoria = String(req.body.categoria || '').trim();
  const provedor = String(req.body.provedor || '').trim();
  const key = req.body.key != null ? String(req.body.key).trim() : null;
  const ativo = !!req.body.ativo;
  const ordem = Number.isInteger(req.body.ordem) ? req.body.ordem : 100;
  const config = req.body.config && typeof req.body.config === 'object' ? JSON.stringify(req.body.config) : null;
  const categoriasValidas = ['descoberta','contato','validacao_email','validacao_tel','crm','ia'];
  if (!categoriasValidas.includes(categoria) || !provedor) {
    return res.status(400).json({ erro: 'categoria/provedor inválidos' });
  }
  try {
    const { rows: [row] } = await pool.query(`
      INSERT INTO integracoes (categoria, provedor, key_cifrada, config, ativo, ordem)
      VALUES ($1,$2,$3,COALESCE($4::jsonb,'{}'::jsonb),$5,$6)
      ON CONFLICT (categoria, provedor) DO UPDATE SET
        key_cifrada = COALESCE(NULLIF($3,''), integracoes.key_cifrada),
        config = COALESCE($4::jsonb, integracoes.config),
        ativo = $5, ordem = $6
      RETURNING id, categoria, provedor, config, ativo, ordem`,
      [categoria, provedor, key, config, ativo, ordem]
    );
    res.status(201).json(row);
  } catch(e) { console.error(e); res.status(500).json({ erro: 'erro interno' }); }
});

app.patch('/api/integracoes/:id', requireAuth, requireAdmin, async (req, res) => {
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
app.post('/api/integracoes/gk/conectar', requireAuth, requireAdmin, async (req, res) => {
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
