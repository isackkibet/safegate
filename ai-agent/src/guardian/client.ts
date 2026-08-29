/**
 * Guardian client interface + HTTP implementation.
 *
 * The AI Agent calls the Guardian over HTTP to authorize a StructuredRequest.
 * IMPORTANT: The Guardian's decision is advisory to the caller — the Guardian
 * itself is the authoritative source. Never let the LLM's raw output bypass
 * this call.
 */

import type { GuardianDecision, StructuredRequest } from "@safegate/shared-types";

export interface IGuardianClient {
  authorize(request: StructuredRequest): Promise<GuardianDecision>;
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Guardian HTTP ${response.status}: ${text}`);
    }
    return response.json() as Promise<T>;
  });
}

export class HttpGuardianClient implements IGuardianClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async authorize(request: StructuredRequest): Promise<GuardianDecision> {
    return postJson<GuardianDecision>(`${this.baseUrl}/authorize`, request);
  }
}

/**
 * Routes authorization through the Backend's agreed contract:
 * POST /api/guardian/verify.
 *
 * This is the deliverable-specified integration point — the AI Agent calls the
 * Backend endpoint, which proxies to the authoritative Guardian service.
 * Using the Backend keeps a single auth gateway for the platform and means the
 * Agent never needs to know the Guardian's address directly.
 */
export class HttpVerifyClient implements IGuardianClient {
  private readonly backendUrl: string;

  constructor(backendUrl: string) {
    this.backendUrl = backendUrl.replace(/\/$/, "");
  }

  async authorize(request: StructuredRequest): Promise<GuardianDecision> {
    return postJson<GuardianDecision>(`${this.backendUrl}/api/guardian/verify`, request);
  }
}
