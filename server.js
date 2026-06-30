'use strict';
/*
 * Hunter — Fase 1
 * Servidor Node/Express: serve o front (login + app) e a API de autenticação.
 * - Sem login: só a tela de login é entregue (o bundle do app fica protegido).
 * - Com login: cookie de sessão (JWT httpOnly) libera o app.
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

// ---- inicialização: cria a tabela e o primeiro admin ----
async function init() {
  for (let tentativa = 1; tentativa <= 30; tentativa++) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (e) {
      console.log(`[init] aguardando o banco... (${tentativa}/30)`);
      await new Promise(r => setTimeout(r, 2000));
      if (tentativa === 30) throw e;
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
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
  if (rows[0].n === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ($1,$2,$3,$4)',
      [ADMIN_NAME, ADMIN_EMAIL, hash, 'Admin']
    );
    console.log(`[init] admin criado: ${ADMIN_EMAIL}`);
  }
  console.log('[init] banco pronto.');
}

// ---- helpers de sessão ----
function setSession(res, user) {
  const token = jwt.sign(
    { id: user.id, nome: user.nome, email: user.email, papel: user.papel },
    JWT_SECRET,
    { expiresIn: `${SESSION_HOURS}h` }
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
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
  req.user = u;
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.papel !== 'Admin')
    return res.status(403).json({ erro: 'apenas administradores' });
  next();
}

const app = express();
app.set('trust proxy', 1); // atrás do Traefik
app.use(express.json());
app.use(cookieParser());

// ---- healthcheck público (verificação de deploy) ----
app.get('/api/health', (req, res) => res.json({ ok: true, versao: 'fase1', ts: new Date().toISOString() }));

// ---- API: autenticação ----
const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');
  if (!email || !senha) return res.status(400).json({ erro: 'informe e-mail e senha' });
  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email]);
    const user = rows[0];
    if (!user || !user.ativo) return res.status(401).json({ erro: 'credenciais inválidas' });
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'credenciais inválidas' });
    await pool.query('UPDATE usuarios SET ultimo_acesso=now() WHERE id=$1', [user.id]);
    setSession(res, user);
    res.json({ nome: user.nome, email: user.email, papel: user.papel });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'erro interno' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE, { httpOnly: true, secure: true, sameSite: 'lax' });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ nome: req.user.nome, email: req.user.email, papel: req.user.papel });
});

// ---- API: usuários (admin) ----
app.get('/api/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nome, email, papel, ativo, ultimo_acesso, criado_em FROM usuarios ORDER BY criado_em'
  );
  res.json(rows);
});

app.post('/api/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const nome = String(req.body.nome || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const papel = ['Admin', 'Operador', 'Visualizador'].includes(req.body.papel) ? req.body.papel : 'Operador';
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
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ erro: 'e-mail já cadastrado' });
    console.error(e);
    res.status(500).json({ erro: 'erro interno' });
  }
});

app.patch('/api/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sets = [], vals = [];
  if (typeof req.body.ativo === 'boolean') { sets.push(`ativo=$${sets.length + 1}`); vals.push(req.body.ativo); }
  if (['Admin', 'Operador', 'Visualizador'].includes(req.body.papel)) { sets.push(`papel=$${sets.length + 1}`); vals.push(req.body.papel); }
  if (req.body.senha) { sets.push(`senha_hash=$${sets.length + 1}`); vals.push(await bcrypt.hash(String(req.body.senha), 12)); }
  if (!sets.length) return res.status(400).json({ erro: 'nada para atualizar' });
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE usuarios SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING id, nome, email, papel, ativo`,
    vals
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

// ---- arquivos públicos (sem login): tela de login + logo ----
app.get('/login.html', (req, res) => res.sendFile(path.join(PUBLIC, 'login.html')));
app.get('/hunter_logo_icon.png', (req, res) => res.sendFile(path.join(PUBLIC, 'hunter_logo_icon.png')));

// ---- arquivos protegidos (exigem login): o app e o React ----
function gate(req, res, next) {
  if (getUser(req)) return next();
  return res.status(401).send('Faça login para acessar.');
}
app.get('/app.js', gate, (req, res) => res.sendFile(path.join(PUBLIC, 'app.js')));
app.use('/vendor', gate, express.static(path.join(PUBLIC, 'vendor')));

// ---- raiz e fallback: login.html (deslogado) ou app.html (logado) ----
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ erro: 'rota não encontrada' });
  return res.sendFile(path.join(PUBLIC, getUser(req) ? 'app.html' : 'login.html'));
});

init()
  .then(() => app.listen(PORT, () => console.log(`[hunter] ouvindo na porta ${PORT}`)))
  .catch(err => { console.error('[init] falhou:', err); process.exit(1); });
