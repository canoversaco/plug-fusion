-- SAFE/Idempotent-ish PG DDL
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'fcm_tokens') THEN
    CREATE TABLE fcm_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      platform TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'broadcasts') THEN
    CREATE TABLE broadcasts (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      payload_json TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'courier_locations') THEN
    CREATE TABLE courier_locations (
      id BIGSERIAL PRIMARY KEY,
      courier_username TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'order_status_history') THEN
    CREATE TABLE order_status_history (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      by_username TEXT,
      at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'payments') THEN
    CREATE TABLE payments (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT,
      currency TEXT DEFAULT 'EUR',
      amount_cents INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      txid TEXT,
      meta_json TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'payment_events') THEN
    CREATE TABLE payment_events (
      id BIGSERIAL PRIMARY KEY,
      payment_id BIGINT REFERENCES payments(id) ON DELETE CASCADE,
      type TEXT,
      payload_json TEXT,
      at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;
