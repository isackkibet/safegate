import type { GuardianRequest, GuardianResponse } from '../types.js';

/**
 * Client for the deterministic SafeGate Guardian, which lives in the
 * Backend service. The Agent does NOT make release/collection decisions
 * itself — it formats a `GuardianRequest` and asks the Guardian.
 */
export interface GuardianClient {
  authorize(request: GuardianRequest): Promise<GuardianResponse>;
}

/** HTTP client targeting the backend Guardian endpoint. */
export class HttpGuardianClient implements GuardianClient {
  constructor(
    private baseUrl = process.env.SAFEGATE_BACKEND_URL ?? 'http://localhost:4000',
    private token = process.env.SAFEGATE_BACKEND_TOKEN ?? '',
  ) {}

  async authorize(request: GuardianRequest): Promise<GuardianResponse> {
    const res = await fetch(`${this.baseUrl}/guardian/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(`Guardian request failed: ${res.status}`);
    return (await res.json()) as GuardianResponse;
  }
}

/**
 * Useful when running the AI Agent standalone for the demo / tests: a
 * deterministic Guardian that mirrors the backend's checks so the full
 * call chain (extract -> verify -> authorize -> log) can be demonstrated
 * without a separate backend process.
 */
export class LocalGuardianClient implements GuardianClient {
  private registry: {
    [did: string]: 'ACTIVE' | 'REVOKED';
  };
  private orderAssignments: Record<string, string>;
  private orderAmounts: Record<string, number>;
  private maxByRider: Record<string, number>;

  constructor(opts: {
    registry?: { [did: string]: 'ACTIVE' | 'REVOKED' };
    orderAssignments?: Record<string, string>;
    orderAmounts?: Record<string, number>;
    maxByRider?: Record<string, number>;
  } = {}) {
    this.registry = opts.registry ?? {};
    this.orderAssignments = opts.orderAssignments ?? {};
    this.orderAmounts = opts.orderAmounts ?? {};
    this.maxByRider = opts.maxByRider ?? {};
  }

  async authorize(request: GuardianRequest): Promise<GuardianResponse> {
    const checks = [] as GuardianResponse['checks'];
    const fail = (name: string, reason: GuardianResponse['reason'], detail?: string) => {
      checks.push({ name, passed: false, detail });
      return { allowed: false, orderId: request.orderId, riderDid: request.riderDid, reason, checks };
    };

    checks.push({ name: 'order_exists', passed: this.orderAmounts[request.orderId] !== undefined });
    if (this.orderAmounts[request.orderId] === undefined)
      return fail('order_exists', 'ORDER_NOT_FOUND', `Order ${request.orderId} not found`);

    checks.push({
      name: 'rider_assigned',
      passed: this.orderAssignments[request.orderId] === request.riderDid,
    });
    if (this.orderAssignments[request.orderId] !== request.riderDid)
      return fail('rider_assigned', 'RIDER_NOT_ASSIGNED', 'Rider not assigned to this order');

    checks.push({ name: 'vc_status', passed: this.registry[request.riderDid] === 'ACTIVE' });
    if (this.registry[request.riderDid] !== 'ACTIVE')
      return fail('vc_status', 'VC_REVOKED', `Credential for ${request.riderDid} is not ACTIVE`);

    const max = this.maxByRider[request.riderDid] ?? 0;
    checks.push({ name: 'amount_within_limit', passed: request.amount <= max });
    if (request.amount > max)
      return fail(
        'amount_within_limit',
        'AMOUNT_EXCEEDS_LIMIT',
        `${request.amount} exceeds rider limit ${max}`,
      );

    checks.push({ name: 'action_permitted', passed: request.action === 'COLLECT_COD' || request.action === 'COLLECT_AND_RELEASE' || request.action === 'RELEASE_PACKAGE' });
    if (!checks[checks.length - 1].passed)
      return fail('action_permitted', 'PERMISSION_DENIED', 'Action not permitted');

    return {
      allowed: true,
      orderId: request.orderId,
      riderDid: request.riderDid,
      checks,
      logId: `local-${Date.now()}`,
    };
  }
}
