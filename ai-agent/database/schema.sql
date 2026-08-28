-- SafeGate schema
-- Serves the deterministic Guardian: rider registry, orders, credential
-- issuance/revocation, and a durable audit log for every decision.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS riders (
  did          TEXT PRIMARY KEY,          -- did:key:...
  name         TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT 'delivery_rider',
  status       TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | DISABLED
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,          -- order reference, e.g. "4521"
  amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'KES',
  status       TEXT NOT NULL DEFAULT 'OPEN',   -- OPEN | RELEASED | COLLECTED | CANCELLED
  rider_did    TEXT REFERENCES riders(did),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verifiable Credentials issued by the platform to riders.
CREATE TABLE IF NOT EXISTS credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_did       TEXT NOT NULL REFERENCES riders(did),
  issuer_did      TEXT NOT NULL,
  vc_jwt          TEXT NOT NULL,               -- the signed JWT
  status          TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | REVOKED
  max_collection  NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'KES',
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ
);

-- Durable record of every Guardian decision (request + response + extraction).
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     TEXT NOT NULL,
  rider_did    TEXT NOT NULL,
  action       TEXT NOT NULL,
  amount       NUMERIC(14,2) NOT NULL,
  currency     TEXT NOT NULL,
  allowed      BOOLEAN NOT NULL,
  reason       TEXT,                            -- DenyReason when denied
  raw_message  TEXT NOT NULL DEFAULT '',
  extraction   JSONB NOT NULL DEFAULT '{}',
  request      JSONB NOT NULL DEFAULT '{}',
  response     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_order   ON audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_rider   ON audit_log(rider_did);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
