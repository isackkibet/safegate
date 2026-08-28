import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAttemptLimiter } from '../src/redis/limiter.js';
import { PostgresGuardian } from '../src/guardian/postgres.js';
import type { GuardianDataSources } from '../src/guardian/postgres.js';
import type { OrderRow, CredentialRow } from '../src/db.js';

const ORDER: OrderRow = {
  id: '4521',
  amount: '1500',
  currency: 'KES',
  status: 'OPEN',
  rider_did: 'did:key:rider88',
};

const CRED_ACTIVE: CredentialRow = {
  rider_did: 'did:key:rider88',
  vc_jwt: 'jwt',
  status: 'ACTIVE',
  max_collection: '5000',
  currency: 'KES',
};

describe('MemoryAttemptLimiter (anti-brute-force)', () => {
  it('locks a rider out after the failure threshold', async () => {
    const limiter = new MemoryAttemptLimiter({ maxFailures: 3, windowSeconds: 60, lockSeconds: 300 });
    expect(await limiter.isLocked('did:key:r1')).toBe(false);
    await limiter.recordFailure('did:key:r1');
    await limiter.recordFailure('did:key:r1');
    expect(await limiter.isLocked('did:key:r1')).toBe(false);
    const locked = await limiter.recordFailure('did:key:r1'); // third -> lock
    expect(locked).toBe(true);
    expect(await limiter.isLocked('did:key:r1')).toBe(true);
  });

  it('reset clears lockout', async () => {
    const limiter = new MemoryAttemptLimiter({ maxFailures: 2, windowSeconds: 60, lockSeconds: 300 });
    await limiter.recordFailure('did:key:r2');
    await limiter.recordFailure('did:key:r2');
    expect(await limiter.isLocked('did:key:r2')).toBe(true);
    await limiter.reset('did:key:r2');
    expect(await limiter.isLocked('did:key:r2')).toBe(false);
  });
});

function makeGuardian(overrides: Partial<GuardianDataSources> = {}) {
  const limiter = new MemoryAttemptLimiter({ maxFailures: 3 });
  const sources: GuardianDataSources = {
    getOrder: async () => ORDER,
    getCredential: async () => CRED_ACTIVE,
    ...overrides,
  };
  return { g: new PostgresGuardian(limiter, sources), limiter };
}

describe('PostgresGuardian checks', () => {
  let req: Parameters<PostgresGuardian['authorize']>[0];

  beforeEach(() => {
    req = { orderId: '4521', riderDid: 'did:key:rider88', action: 'COLLECT_COD', amount: 1500, currency: 'KES' };
  });

  it('approves a valid request', async () => {
    const { g } = makeGuardian();
    const res = await g.authorize(req);
    expect(res.allowed).toBe(true);
  });

  it('denies when the order does not exist', async () => {
    const { g } = makeGuardian({ getOrder: async () => null });
    const res = await g.authorize(req);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('ORDER_NOT_FOUND');
  });

  it('denies when the rider is not assigned', async () => {
    const { g } = makeGuardian({
      getOrder: async () => ({ ...ORDER, rider_did: 'did:key:someoneElse' }),
    });
    const res = await g.authorize(req);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('RIDER_NOT_ASSIGNED');
  });

  it('denies when the credential is revoked', async () => {
    const { g } = makeGuardian({
      getCredential: async () => ({ ...CRED_ACTIVE, status: 'REVOKED' as const }),
    });
    const res = await g.authorize(req);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('VC_REVOKED');
  });

  it('denies when the amount exceeds the authorized limit', async () => {
    const { g } = makeGuardian();
    const res = await g.authorize({ ...req, amount: 50000 });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('AMOUNT_EXCEEDS_LIMIT');
  });

  it('blocks a locked-out rider before evaluating anything', async () => {
    const { g, limiter } = makeGuardian();
    await limiter.recordFailure('did:key:rider88');
    await limiter.recordFailure('did:key:rider88');
    await limiter.recordFailure('did:key:rider88'); // locked out
    const res = await g.authorize(req);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('TOO_MANY_ATTEMPTS');
  });
});
