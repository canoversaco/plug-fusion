import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import { query, tx, driver } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(helmet({ contentSecurityPolicy:false, crossOriginEmbedderPolicy:false }));
app.use(express.json({ limit: '2mb' }));
app.use(pinoHttp({ autoLogging: true }));

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_please';

const limiter = rateLimit({ windowMs: 60_000, max: 20 });
app.use('/api/login', limiter);

// ---- AUTH Utils ----
const issueToken = (u) => jwt.sign(
  { sub: u.id, username: u.username, role: u.role },
  JWT_SECRET,
  { expiresIn: '7d' }
);
const auth = (req,res,next)=>{
  const h=req.headers.authorization||''; const m=h.match(/^Bearer (.+)$/);
  if(!m) return res.status(401).json({error:'no_token'});
  try { req.user=jwt.verify(m[1], JWT_SECRET); return next(); }
  catch(e){ return res.status(401).json({error:'bad_token'}); }
};

// ---- API ----
app.get('/api/health', async (_req, res) => {
  try {
    const r = await query('SELECT 1 as ok', []);
    const ok = !!(r.rows?.length);
    res.json({ ok, db: ok, driver, ts: Date.now() });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// LOGIN (username+password)
app.post('/api/login', async (req,res)=>{
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_credentials' });

  // Benutzer holen (Treiber-agnostisch, '?' wird für PG konvertiert)
  const r = await query('SELECT id, username, role, password_hash FROM users WHERE username = ? LIMIT 1', [username]);
  const u = r.rows?.[0];
  if (!u) return res.status(401).json({ error: 'invalid_login' });

  const ok = await bcrypt.compare(password, u.password_hash || '');
  if (!ok) return res.status(401).json({ error: 'invalid_login' });

  const token = issueToken(u);
  res.json({ token, user: { id: u.id, username: u.username, role: u.role } });
});

// Profil
app.get('/api/me', auth, async (req,res)=>{
  const r = await query('SELECT id, username, role FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
  res.json({ user: r.rows?.[0] || null });
});

// Kategorien
app.get('/api/categories', async (_req, res) => {
  const r = await query('SELECT * FROM categories ORDER BY position ASC, id ASC', []);
  res.json({ categories: r.rows });
});
app.post('/api/categories', async (req, res) => {
  const { name, position = 0, active = true } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name ist erforderlich' });
  await query('INSERT INTO categories(name, position, active) VALUES (?,?,?)', [name, position|0, active?1:0]);
  const r = await query('SELECT * FROM categories WHERE name = ? LIMIT 1', [name]);
  res.json(r.rows?.[0] || { ok: true });
});

// Produkte
app.get('/api/products', async (_req, res) => {
  const r = await query(
    'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.active = 1 ORDER BY p.id DESC',
    []
  );
  res.json({ products: r.rows });
});

// Bestellungen
app.post('/api/orders', async (req, res) => {
  const { user_username, items = [], address, slot, notes } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items erforderlich' });

  try {
    const order = await tx(async (dbx) => {
      const tot = items.reduce((s, it) => s + (it.price_cents|0) * (it.qty|0), 0);
      await dbx.query?.(
        `INSERT INTO orders(user_username,address,slot,notes,status,subtotal_cents,delivery_fee_cents,total_cents)
         VALUES (?,?,?,?, 'wartet_bestätigung', ?, 0, ?)`,
        [user_username||null, address||null, slot||null, notes||null, tot, tot]
      );
      const sel = await dbx.query?.('SELECT * FROM orders ORDER BY id DESC LIMIT 1', []);
      const ord = sel.rows?.[0];
      for (const it of items) {
        await dbx.query?.(
          `INSERT INTO order_items(order_id,product_id,name,price_cents,qty)
           VALUES (?,?,?,?,?)`,
          [ord.id, it.product_id||null, it.name||null, it.price_cents|0, it.qty|0]
        );
      }
      return ord;
    });
    res.json({ order });
  } catch (e) {
    console.error('[orders] tx error:', e?.message);
    res.status(500).json({ error: 'order_failed' });
  }
});

// Chat
app.get('/api/orders/:id/chat', async (req, res) => {
  const r = await query(
    'SELECT id, order_id, sender, ciphertext, iv, created_at FROM chat_messages WHERE order_id = ? ORDER BY id ASC',
    [req.params.id|0]
  );
  res.json({ messages: r.rows });
});
app.post('/api/orders/:id/chat', async (req, res) => {
  const { sender='', ciphertext='', iv='' } = req.body || {};
  if (!sender || !ciphertext || !iv) return res.status(400).json({ error: 'Ungültige Nachricht' });
  await query('INSERT INTO chat_messages(order_id,sender,ciphertext,iv) VALUES (?,?,?,?)',
    [req.params.id|0, sender, ciphertext, iv]);
  res.json({ ok: true });
});

// STATIC
const dist = path.resolve(__dirname, '..', 'web', 'dist');
app.use(express.static(dist, { index: false, fallthrough: true }));
app.get(/^\/.*\.[\w]+$/, (_req, res) => res.status(404).end()); // keine Fallbacks für Assets
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, () => console.log(`Plug Fusion läuft auf :${PORT}`));
