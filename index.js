require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/forumdb' });

// Helpers
function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
  next();
}

app.get('/ping', (req, res) => res.json({ ok: true, time: new Date() }));

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });
  const client = await pool.connect();
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await client.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, badge',
      [username, hashed, 'user']
    );
    const user = result.rows[0];
    const token = generateToken(user);
    res.json({ user, token });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'username exists' });
    console.error(e);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT id, username, password_hash, role, badge FROM users WHERE username=$1', [username]);
    if (result.rowCount === 0) return res.status(400).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = generateToken(user);
    delete user.password_hash;
    res.json({ user, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

// Posts CRUD
app.get('/api/posts', async (req, res) => {
  const client = await pool.connect();
  try {
    const posts = await client.query(
      `SELECT p.id, p.title, p.body, p.created_at, p.author_id, u.username AS author, p.likes_count
       FROM posts p JOIN users u ON p.author_id = u.id
       ORDER BY p.created_at DESC LIMIT 100`
    );
    res.json(posts.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  } finally { client.release(); }
});

app.post('/api/posts', authMiddleware, async (req, res) => {
  const { title, body } = req.body;
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO posts (title, body, author_id) VALUES ($1, $2, $3) RETURNING id, title, body, created_at, author_id, likes_count',
      [title, body, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  } finally { client.release(); }
});

app.get('/api/posts/:id', async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();
  try {
    const p = await client.query(
      `SELECT p.id, p.title, p.body, p.created_at, p.author_id, u.username AS author, p.likes_count
       FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id=$1`, [id]
    );
    if (p.rowCount === 0) return res.status(404).json({ error: 'not found' });
    const replies = await client.query(
      `SELECT r.id, r.body, r.created_at, r.author_id, u.username AS author FROM replies r JOIN users u ON r.author_id=u.id WHERE r.post_id=$1 ORDER BY r.created_at`, [id]
    );
    res.json({ post: p.rows[0], replies: replies.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  } finally { client.release(); }
});

// Reply
app.post('/api/posts/:id/replies', authMiddleware, async (req, res) => {
  const postId = req.params.id;
  const { body } = req.body;
  const client = await pool.connect();
  try {
    const r = await client.query('INSERT INTO replies (post_id, body, author_id) VALUES ($1,$2,$3) RETURNING id, body, created_at, author_id', [postId, body, req.user.id]);
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  } finally { client.release(); }
});

// Like (toggle)
app.post('/api/posts/:id/like', authMiddleware, async (req, res) => {
  const postId = req.params.id;
  const client = await pool.connect();
  try {
    # check existing
  } catch (e) {
    console.error(e);
  } finally { client.release(); }
});

// (continued) Like (toggle) implementation
// Like (toggle)
app.post('/api/posts/:id/like', authMiddleware, async (req, res) => {
  const postId = req.params.id;
  const client = await pool.connect();
  try {
    const exists = await client.query('SELECT id FROM likes WHERE post_id=$1 AND user_id=$2', [postId, req.user.id]);
    if (exists.rowCount > 0) {
      await client.query('DELETE FROM likes WHERE id=$1', [exists.rows[0].id]);
      await client.query('UPDATE posts SET likes_count = likes_count - 1 WHERE id=$1', [postId]);
      return res.json({ liked: false });
    } else {
      await client.query('INSERT INTO likes (post_id, user_id) VALUES ($1,$2)', [postId, req.user.id]);
      await client.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id=$1', [postId]);
      return res.json({ liked: true });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  } finally { client.release(); }
});

// Badges & Admin
app.get('/api/badges', async (req, res) => {
  const client = await pool.connect();
  try {
    const b = await client.query('SELECT * FROM badges ORDER BY id');
    res.json(b.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); } finally { client.release(); }
});

app.post('/api/admin/grant-badge', authMiddleware, adminMiddleware, async (req, res) => {
  const { userId, badgeId } = req.body;
  const client = await pool.connect();
  try {
    await client.query('UPDATE users SET badge=$1 WHERE id=$2', [badgeId, userId]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); } finally { client.release(); }
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const u = await client.query('SELECT id, username, role, badge FROM users WHERE id=$1', [req.user.id]);
    res.json(u.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); } finally { client.release(); }
});

// Simple user list (admin)
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const u = await client.query('SELECT id, username, role, badge FROM users ORDER BY id DESC LIMIT 200');
    res.json(u.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); } finally { client.release(); }
});

// Start
pool.connect().then(c=>{ c.release(); console.log('Postgres connected'); }).catch(e=>{ console.error('Postgres connect error', e.message); });
app.listen(PORT, () => {
  console.log('Server listening on', PORT);
});
