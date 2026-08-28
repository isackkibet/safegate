import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { getDatabaseUrl } from './config.js';
import type { DecisionRecord } from './types.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
});

export async function closePool(): Promise<void> {
  await pool.end();
}

/** Apply database/schema.sql. Safe to call on every boot (idempotent). */
export async function migrate(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = await readFile(join(here, '..', 'database', 'schema.sql'), 'utf-8');
  await pool.query(sql);
}

export interface RiderRow {
  did: string;
  name: string;
  role: string;
  status: string;
}

export interface OrderRow {
  id: string;
  amount: string;
  currency: string;
  status: string;
  rider_did: string | null;
}

export interface CredentialRow {
  rider_did: string;
  vc_jwt: string;
  status: 'ACTIVE' | 'REVOKED';
  max_collection: string;
  currency: string;
}

export interface AuditRow {
  id: string;
  order_id: string;
  rider_did: string;
  action: string;
  amount: string;
  currency: string;
  allowed: boolean;
  reason: string | null;
  raw_message: string;
  extraction: unknown;
  request: unknown;
  response: unknown;
  created_at: string;
}

export async function findRider(did: string): Promise<RiderRow | null> {
  const r = await pool.query('SELECT * FROM riders WHERE did = $1', [did]);
  return r.rows[0] ?? null;
}

export async function upsertRider(row: {
  did: string;
  name: string;
  role: string;
  status: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO riders (did, name, role, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (did) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status`,
    [row.did, row.name, row.role, row.status],
  );
}

export async function findOrder(id: string): Promise<OrderRow | null> {
  const r = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}

export async function upsertOrder(row: {
  id: string;
  amount: number;
  currency: string;
  status: string;
  riderDid: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO orders (id, amount, currency, status, rider_did)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       amount = EXCLUDED.amount,
       currency = EXCLUDED.currency,
       status = EXCLUDED.status,
       rider_did = EXCLUDED.rider_did,
       updated_at = now()`,
    [row.id, row.amount, row.currency, row.status, row.riderDid],
  );
}

export async function setOrderStatus(id: string, status: string): Promise<void> {
  await pool.query('UPDATE orders SET status = $2, updated_at = now() WHERE id = $1', [id, status]);
}

export async function findActiveCredential(
  riderDid: string,
): Promise<CredentialRow | null> {
  const r = await pool.query(
    `SELECT * FROM credentials
     WHERE rider_did = $1
     ORDER BY issued_at DESC LIMIT 1`,
    [riderDid],
  );
  return r.rows[0] ?? null;
}

export async function issueCredential(row: {
  riderDid: string;
  issuerDid: string;
  vcJwt: string;
  maxCollection: number;
  currency: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO credentials (rider_did, issuer_did, vc_jwt, max_collection, currency)
     VALUES ($1, $2, $3, $4, $5)`,
    [row.riderDid, row.issuerDid, row.vcJwt, row.maxCollection, row.currency],
  );
}

export async function revokeCredential(riderDid: string): Promise<void> {
  await pool.query(
    `UPDATE credentials SET status = 'REVOKED', revoked_at = now()
     WHERE rider_did = $1 AND status = 'ACTIVE'`,
    [riderDid],
  );
}

export async function insertAudit(row: AuditRow): Promise<string> {
  const r = await pool.query(
    `INSERT INTO audit_log
       (order_id, rider_did, action, amount, currency, allowed, reason,
        raw_message, extraction, request, response)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      row.order_id,
      row.rider_did,
      row.action,
      row.amount,
      row.currency,
      row.allowed,
      row.reason,
      row.raw_message,
      JSON.stringify(row.extraction),
      JSON.stringify(row.request),
      JSON.stringify(row.response),
    ],
  );
  return r.rows[0].id as string;
}

export async function recentAudit(limit = 50): Promise<AuditRow[]> {
  const r = await pool.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1', [
    limit,
  ]);
  return r.rows as AuditRow[];
}

/** Persist an Agent decision record to the durable audit log. */
export async function persistDecisionRecord(decision: DecisionRecord): Promise<string> {
  return insertAudit({
    id: decision.id,
    order_id: decision.request.orderId,
    rider_did: decision.request.riderDid,
    action: decision.request.action,
    amount: String(decision.request.amount),
    currency: decision.request.currency,
    allowed: decision.response.allowed,
    reason: decision.response.reason ?? null,
    raw_message: decision.extraction.rawMessage,
    extraction: decision.extraction as unknown as object,
    request: decision.request as unknown as object,
    response: decision.response as unknown as object,
    created_at: decision.ts,
  });
}
