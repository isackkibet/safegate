import type { ExecutionResult, GuardianRequest, GuardianResponse } from '../types.js';

export interface ExecutionTools {
  release(request: GuardianRequest): Promise<ExecutionResult>;
  collectPayment(request: GuardianRequest): Promise<ExecutionResult>;
  deny(request: GuardianRequest, response: GuardianResponse): Promise<ExecutionResult>;
  alertDispatcher(request: GuardianRequest, response: GuardianResponse): Promise<ExecutionResult>;
}

/**
 * Tool execution boundary. These tools are ONLY invoked after the Guardian
 * has returned `allowed: true`. Tools are named side-effecting operations,
 * kept separate from the decision logic so the Agent can never short-circuit
 * a check.
 */
export class BackendExecutionTools implements ExecutionTools {
  constructor(
    private baseUrl = process.env.SAFEGATE_BACKEND_URL ?? 'http://localhost:4000',
    private token = process.env.SAFEGATE_BACKEND_TOKEN ?? '',
  ) {}

  private async call(path: string, body: unknown): Promise<ExecutionResult> {
    try {
      const res = await fetch(`${this.baseUrl}/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      return { ok: res.ok, tool: path, payload, ...(res.ok ? {} : { error: `HTTP ${res.status}` }) };
    } catch (err) {
      return { ok: false, tool: path, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async release(request: GuardianRequest): Promise<ExecutionResult> {
    return this.call('tools/release', request);
  }

  async collectPayment(request: GuardianRequest): Promise<ExecutionResult> {
    return this.call('tools/collect-payment', request);
  }

  async deny(request: GuardianRequest, response: GuardianResponse): Promise<ExecutionResult> {
    return this.call('tools/deny', { request, response });
  }

  async alertDispatcher(
    request: GuardianRequest,
    response: GuardianResponse,
  ): Promise<ExecutionResult> {
    return this.call('tools/alert', { request, response });
  }
}

/**
 * Postgres-backed execution tools. On approval these transition the order in
 * the database (RELEASED / COLLECTED), giving a durable record of the
 * side-effect so it can never be replayed outside an authorized decision.
 */
export class PostgresExecutionTools implements ExecutionTools {
  constructor(private onTransition?: (orderId: string, state: string) => Promise<void>) {}

  private ok(tool: string, orderId: string, state: string): ExecutionResult {
    return { ok: true, tool, payload: { orderId, state } };
  }

  async release(request: GuardianRequest): Promise<ExecutionResult> {
    await this.onTransition?.(request.orderId, 'RELEASED');
    return this.ok('release', request.orderId, 'RELEASED');
  }

  async collectPayment(request: GuardianRequest): Promise<ExecutionResult> {
    await this.onTransition?.(request.orderId, 'COLLECTED');
    return this.ok('collect-payment', request.orderId, 'COLLECTED');
  }

  async deny(_r: GuardianRequest, response: GuardianResponse): Promise<ExecutionResult> {
    return { ok: true, tool: 'deny', payload: { allowed: false, reason: response.reason } };
  }

  async alertDispatcher(
    request: GuardianRequest,
    response: GuardianResponse,
  ): Promise<ExecutionResult> {
    return {
      ok: true,
      tool: 'alert',
      payload: { orderId: request.orderId, reason: response.reason },
    };
  }
}

/** No-op in-process tools for standalone demo / tests. */
export class InProcessExecutionTools implements ExecutionTools {
  async release(request: GuardianRequest): Promise<ExecutionResult> {
    return { ok: true, tool: 'release', payload: { orderId: request.orderId, state: 'RELEASED' } };
  }
  async collectPayment(request: GuardianRequest): Promise<ExecutionResult> {
    return {
      ok: true,
      tool: 'collect-payment',
      payload: { orderId: request.orderId, amount: request.amount, state: 'COLLECTED' },
    };
  }
  async deny(_r: GuardianRequest, response: GuardianResponse): Promise<ExecutionResult> {
    return { ok: true, tool: 'deny', payload: { allowed: false, reason: response.reason } };
  }
  async alertDispatcher(
    request: GuardianRequest,
    response: GuardianResponse,
  ): Promise<ExecutionResult> {
    return {
      ok: true,
      tool: 'alert',
      payload: { orderId: request.orderId, reason: response.reason },
    };
  }
}
