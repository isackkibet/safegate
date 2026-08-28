import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Agent } from './agent/agent.js';
import { createLLMClient } from './agent/llm.js';
import { LocalGuardianClient } from './guardian/client.js';
import { PostgresGuardian } from './guardian/postgres.js';
import {
  InProcessExecutionTools,
  PostgresExecutionTools,
} from './tools/tools.js';
import {
  RedisAttemptLimiter,
  MemoryAttemptLimiter,
} from './redis/limiter.js';
import { migrate, pool, setOrderStatus, persistDecisionRecord } from './db.js';
import { seedDemo } from './seed.js';
import { agentRoutes } from './routes/agent.js';
import { adminRoutes } from './routes/admin.js';
import { env, getBackendPort, getRedisUrl } from './config.js';
import type { ExecutionTools } from './tools/tools.js';
import type { AttemptLimiter } from './redis/limiter.js';

function buildGuardian() {
  // The backend owns the canonical Guardian. For a self-contained demo/tests
  // we seed a LocalGuardianClient that mirrors the backend checks. Point
  // SAFEGATE_BACKEND_URL at the real backend to use HttpGuardianClient instead.
  return new LocalGuardianClient({
    registry: {
      'did:key:z6Mkrider88': 'ACTIVE',
      'did:key:z6Mkrider12': 'REVOKED',
    },
    orderAssignments: {
      '4521': 'did:key:z6Mkrider88',
      '9999': 'did:key:z6Mkrider88',
    },
    orderAmounts: { '4521': 1500, '9999': 1500 },
    maxByRider: {
      'did:key:z6Mkrider88': 5000,
      'did:key:z6Mkrider12': 5000,
    },
  });
}

export interface Runtime {
  agent: Agent;
  postgres: boolean;
}

/**
 * Build the runtime.
 *
 * When `DATABASE_URL` is present we run the Postgres-backed Guardian + tools
 * and Redis attempt limiter (migrating + seeding demo data on boot). Otherwise
 * we fall back to the in-memory/local runtime so tests and quick demos work
 * with zero external services.
 */
export async function buildRuntime(): Promise<Runtime> {
  const llm = createLLMClient();
  const usePostgres = Boolean(env('DATABASE_URL'));

  if (!usePostgres) {
    const guardian = buildGuardian();
    const tools = new InProcessExecutionTools();
    return { agent: new Agent({ llm, guardian, tools }), postgres: false };
  }

  await migrate();
  await seedDemo();

  const limiter: AttemptLimiter = env('REDIS_URL') ? new RedisAttemptLimiter(getRedisUrl()) : new MemoryAttemptLimiter();
  await (limiter as unknown as { connect?: () => Promise<void> }).connect?.().catch(() => {});

  const guardian = new PostgresGuardian(limiter);
  const tools: ExecutionTools = new PostgresExecutionTools(async (orderId, state) => {
    await setOrderStatus(orderId, state);
  });

  const agent = new Agent({
    llm,
    guardian,
    tools,
    onDecision: async (d) => {
      await persistDecisionRecord(d).catch(() => {});
    },
  });

  return { agent, postgres: true };
}

export async function start(): Promise<void> {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const { agent, postgres } = await buildRuntime();
  app.use('/agent', agentRoutes(agent));
  if (postgres) app.use('/admin', adminRoutes());

  const PORT = getBackendPort();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`SafeGate AI Agent listening on :${PORT} (${postgres ? 'postgres' : 'local'})`);
  });

  process.on('SIGINT', async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}

// Only auto-start when run directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
