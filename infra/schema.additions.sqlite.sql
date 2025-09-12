-- Add tables if not exists (idempotent)
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  platform TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload_json TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courier_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  courier_username TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  by_username TEXT,
  at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT,               -- e.g. 'crypto_stub', 'btcpay'
  currency TEXT DEFAULT 'EUR',
  amount_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending|confirmed|failed|cancelled
  txid TEXT,
  meta_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
  type TEXT,                   -- created|webhook|confirm|fail|cancel
  payload_json TEXT,
  at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fcm_token_unique ON fcm_tokens(token);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at);
CREATE INDEX IF NOT EXISTS idx_courier_user ON courier_locations(courier_username);
CREATE INDEX IF NOT EXISTS idx_order_hist_order ON order_status_history(order_id);
