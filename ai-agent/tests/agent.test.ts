/**
 * agent.test.ts — AI Agent integration tests using the GuardianStub.
 *
 * These tests verify that:
 * 1. The agent correctly extracts StructuredRequest fields from free-text.
 * 2. The agent always calls the Guardian (never self-authorizes).
 * 3. The agent propagates the Guardian's decision unchanged.
 *
 * Note: These tests use GuardianStub, not the real Guardian.
 * To run against the live Guardian, use injection.test.ts with a running server.
 */

import { describe, it, expect } from "vitest";
import { SafeGateAgent } from "../src/agent.js";
import { GuardianStub } from "../src/guardian/stub.js";
import "dotenv/config";

// Skip if no Gemini key (CI without secrets)
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const describeWithKey = GEMINI_KEY ? describe : describe.skip;

describeWithKey("SafeGate Agent — extraction + stub Guardian", () => {
  const stub = new GuardianStub("valid");
  const agent = new SafeGateAgent(GEMINI_KEY!, stub);

  it("extracts orderId, riderDid, action, amount from a clean message", async () => {
    stub.setScenario("valid");
    const result = await agent.run(
      "I am did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK " +
        "requesting collection of KES 5000 for order ORD-001."
    );

    expect(result.structuredRequest.orderId).toMatch(/ORD-001/i);
    expect(result.structuredRequest.riderDid).toMatch(/^did:/);
    expect(result.structuredRequest.amount).toBe(5000);
    expect(result.guardianDecision.decision).toBe("APPROVED");
  }, 30_000);

  it("propagates DENIED over-limit from stub without overriding", async () => {
    stub.setScenario("over_limit");
    const result = await agent.run(
      "Rider did:key:z6MkhaXgBZDvotDkL5257 wants to collect KES 75000 for order ORD-002"
    );
    expect(result.guardianDecision.decision).toBe("DENIED");
    expect(result.guardianDecision.checks.amountWithinLimit).toBe(false);
  }, 30_000);

  it("propagates DENIED revoked VC from stub", async () => {
    stub.setScenario("revoked");
    const result = await agent.run(
      "Collect and release package for order ORD-003, rider did:key:z6MkRevoked"
    );
    expect(result.guardianDecision.decision).toBe("DENIED");
    expect(result.guardianDecision.checks.vcStatus).toBe("REVOKED");
  }, 30_000);
});
