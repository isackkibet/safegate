import { Router } from 'express';
import { z } from 'zod';
import {
  upsertRider,
  upsertOrder,
  issueCredential,
  revokeCredential,
  findActiveCredential,
  recentAudit,
  migrate,
} from '../db.js';
import { seedDemo } from '../seed.js';

const riderSchema = z.object({
  did: z.string().startsWith('did:key:'),
  name: z.string(),
  role: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

const orderSchema = z.object({
  id: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).optional(),
  status: z.string().optional(),
  riderDid: z.string().startsWith('did:key:'),
});

const credentialSchema = z.object({
  riderDid: z.string().startsWith('did:key:'),
  issuerDid: z.string().startsWith('did:key:').optional(),
  vcJwt: z.string().min(1),
  maxCollection: z.number().nonnegative(),
  currency: z.string().length(3).optional(),
});

/**
 * Admin / registry API for the database — the backend counterpart to the
 * Agent. Provides orders, rider registry, VC issuance & revocation, and
 * the audit log. In production these are protected by auth (JWT).
 */
export function adminRoutes(): Router {
  const router = Router();

  // ---- orders ----
  router.post('/orders', async (req, res) => {
    const p = orderSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Invalid order', issues: p.error.issues });
    await upsertOrder({ ...p.data, status: p.data.status ?? 'OPEN', currency: p.data.currency ?? 'KES' });
    return res.status(201).json({ ok: true, order: p.data });
  });

  // ---- riders ----
  router.post('/riders', async (req, res) => {
    const p = riderSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Invalid rider', issues: p.error.issues });
    await upsertRider({ did: p.data.did, name: p.data.name, role: p.data.role ?? 'delivery_rider', status: p.data.status ?? 'ACTIVE' });
    return res.status(201).json({ ok: true, rider: p.data.did });
  });

  // ---- credentials ----
  router.post('/credentials/issue', async (req, res) => {
    const p = credentialSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Invalid credential', issues: p.error.issues });
    await issueCredential({
      riderDid: p.data.riderDid,
      issuerDid: p.data.issuerDid ?? 'did:key:z6MkplatformDID00',
      vcJwt: p.data.vcJwt,
      maxCollection: p.data.maxCollection,
      currency: p.data.currency ?? 'KES',
    });
    return res.status(201).json({ ok: true });
  });

  router.post('/credentials/revoke', async (req, res) => {
    const p = z.object({ riderDid: z.string().startsWith('did:key:') }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Invalid request', issues: p.error.issues });
    await revokeCredential(p.data.riderDid);
    return res.json({ ok: true });
  });

  router.get('/credentials/:riderDid', async (req, res) => {
    const cred = await findActiveCredential(req.params.riderDid);
    if (!cred) return res.status(404).json({ error: 'No active credential' });
    return res.json(cred);
  });

  // ---- audit ----
  router.get('/audit', async (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    const rows = await recentAudit(limit);
    return res.json(rows);
  });

  // ---- migration / seed ----
  router.post('/db/migrate', async (_req, res) => {
    await migrate();
    return res.json({ ok: true });
  });
  router.post('/db/seed', async (_req, res) => {
    await seedDemo();
    return res.json({ ok: true });
  });

  return router;
}
