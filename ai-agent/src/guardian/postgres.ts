import type {
  DenyReason,
  GuardianRequest,
  GuardianResponse,
  GuardianCheck,
} from '../types.js';
import {
  findOrder,
  findActiveCredential,
  insertAudit,
  setOrderStatus,
} from '../db.js';
import type { AttemptLimiter } from '../redis/limiter.js';
import type { ParsedExtraction } from '../types.js';
import type { OrderRow } from '../db.js';

/** Data accessors the Guardian needs. Defaults hit Postgres; injectable for tests. */
export interface GuardianDataSources {
  getOrder(id: string): Promise<OrderRow | null>;
  getCredential(riderDid: string): Promise<{ status: string; max_collection: string | number } | null>;
}

/**
 * Postgres-backed SafeGate Guardian.
 *
 * Implements the deterministic check sequence from the spec, reading ground
 * truth from the database (orders, rider assignment, credentials/revocation)
 * and gating requests with a Redis attempt limiter (anti-brute-force). Every
 * decision is persisted to the audit log.
 *
 * This is the backend counterpart the Agent's `HttpGuardianClient` calls.
 */
export class PostgresGuardian {
  private sources: GuardianDataSources;

  constructor(
    private limiter: AttemptLimiter,
    sources?: Partial<GuardianDataSources>,
  ) {
    this.sources = {
      getOrder: async (id) => (await findOrder(id)),
      getCredential: async (riderDid) => (await findActiveCredential(riderDid)),
      ...sources,
    };
  }

  private okChecks(): { checks: GuardianCheck[]; allowed: true } {
    return { allowed: true as const, checks: [] };
  }

  private fail(reason: DenyReason, checks: GuardianCheck[], detail?: string): void {
    checks.push({ name: reason, passed: false, detail: detail ?? reason });
  }

  async authorize(
    request: GuardianRequest,
    extraction?: ParsedExtraction,
  ): Promise<GuardianResponse> {
    const checks: GuardianCheck[] = [];

    const denied = (reason: DenyReason, detail?: string): GuardianResponse => {
      this.fail(reason, checks, detail);
      return {
        allowed: false,
        orderId: request.orderId,
        riderDid: request.riderDid,
        reason,
        checks,
      };
    };

    // 0. Anti-brute-force: if locked out, block before evaluating anything.
    if (await this.limiter.isLocked(request.riderDid)) {
      return denied('TOO_MANY_ATTEMPTS', 'Rider is temporarily locked out');
    }

    // 1. Order exists.
    const order = await this.sources.getOrder(request.orderId);
    checks.push({ name: 'order_exists', passed: order !== null, detail: order ? undefined : `Order ${request.orderId} not found` });
    if (!order) return denied('ORDER_NOT_FOUND');

    // 2. Rider assigned to this order.
    checks.push({ name: 'rider_assigned', passed: order.rider_did === request.riderDid, detail: order.rider_did === request.riderDid ? undefined : 'Rider not assigned to this order' });
    if (order.rider_did !== request.riderDid) {
      await this.limiter.recordFailure(request.riderDid);
      return denied('RIDER_NOT_ASSIGNED');
    }

    // 3. Active (non-revoked) credential.
    const credential = await this.sources.getCredential(request.riderDid);
    checks.push({ name: 'vc_status', passed: credential?.status === 'ACTIVE', detail: credential?.status === 'ACTIVE' ? undefined : `Credential for ${request.riderDid} not ACTIVE` });
    if (credential?.status !== 'ACTIVE') {
      await this.limiter.recordFailure(request.riderDid);
      return denied('VC_REVOKED');
    }

    // 4. Amount within authorized limit (from the signed VC).
    const max = Number(credential.max_collection);
    checks.push({ name: 'amount_within_limit', passed: request.amount <= max, detail: `${request.amount} exceeds limit ${max}` });
    if (request.amount > max) {
      await this.limiter.recordFailure(request.riderDid);
      return denied('AMOUNT_EXCEEDS_LIMIT');
    }

    // 5. Action permitted for this credential type.
    const actionOk =
      request.action === 'COLLECT_COD' ||
      request.action === 'COLLECT_AND_RELEASE' ||
      request.action === 'RELEASE_PACKAGE';
    checks.push({ name: 'action_permitted', passed: actionOk, detail: actionOk ? undefined : `Action ${request.action} not permitted` });
    if (!actionOk) {
      await this.limiter.recordFailure(request.riderDid);
      return denied('PERMISSION_DENIED');
    }

    // Approved — clear any prior failures.
    await this.limiter.reset(request.riderDid);

    return { allowed: true, orderId: request.orderId, riderDid: request.riderDid, checks };
  }

  /** Persist a decision to the durable audit log. */
  async audit(
    request: GuardianRequest,
    response: GuardianResponse,
    extraction?: ParsedExtraction,
    rawMessage?: string,
  ): Promise<string> {
    return insertAudit({
      id: '',
      order_id: request.orderId,
      rider_did: request.riderDid,
      action: request.action,
      amount: String(request.amount),
      currency: request.currency,
      allowed: response.allowed,
      reason: response.reason ?? null,
      raw_message: rawMessage ?? (extraction?.rawMessage ?? ''),
      extraction: extraction ?? {},
      request: request as unknown as object,
      response: response as unknown as object,
      created_at: new Date().toISOString(),
    });
  }

  /** Mark an order released (called by the execution tool on approval). */
  async markReleased(orderId: string): Promise<void> {
    await setOrderStatus(orderId, 'RELEASED');
  }
}
