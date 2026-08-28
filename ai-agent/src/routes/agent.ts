import { Router } from 'express';
import { z } from 'zod';
import { Agent } from '../agent/agent.js';
import { listDecisions, getDecision } from '../logging/audit.js';

const messageSchema = z.object({
  message: z.string().min(1),
  riderDid: z.string().startsWith('did:key:').optional(),
});

export function agentRoutes(agent: Agent): Router {
  const router = Router();

  /**
   * POST /agent/process
   * Body: { message: string, riderDid?: string }
   * Accepts a rider's natural-language message and runs the full pipeline.
   */
  router.post('/process', async (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', issues: parsed.error.issues });
    }
    const { message, riderDid } = parsed.data;
    try {
      const result = await agent.run(message, { riderDid });
      return res.status(result.allowed ? 200 : 403).json(result);
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  /** POST /agent/message — alias, same behavior as /process. */
  router.post('/message', (req, res) => res.redirect(307, '/agent/process'));

  /** GET /agent/decisions?limit= — audit trail. */
  router.get('/decisions', (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    res.json(listDecisions(limit));
  });

  /** GET /agent/decisions/:id — single decision. */
  router.get('/decisions/:id', (req, res) => {
    const d = getDecision(req.params.id);
    if (!d) return res.status(404).json({ error: 'Decision not found' });
    return res.json(d);
  });

  /** GET /agent/health. */
  router.get('/health', (_req, res) => res.json({ ok: true, service: 'safegate-ai-agent' }));

  return router;
}
