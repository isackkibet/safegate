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

export class HttpGuardianClient implements IGuardianClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async authorize(request: StructuredRequest): Promise<GuardianDecision> {
    const response = await fetch(`${this.baseUrl}/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Guardian HTTP ${response.status}: ${body}`
      );
    }

    return response.json() as Promise<GuardianDecision>;
  }
}
