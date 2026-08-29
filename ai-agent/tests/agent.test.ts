/**
 * agent.test.ts — AI Agent extraction tests.
 *
 * Primary suite runs against the deterministic LOCAL parser — no Gemini key,
 * no network, fully deterministic. When GEMINI_API_KEY is present, the same
 * assertions are repeated against the real LLM extraction.
 */

import { describe, it, expect } from "vitest";
import { SafeGateAgent } from "../src/agent.js";
import { GuardianStub } from "../src/guardian/stub.js";
import { PassingPrechecker } from "../src/did/precheck.js";
import type { AgentRunResult } from "../src/agent.js";
import "dotenv/config";

function makeAgent(apiKey: string) {
  return new SafeGateAgent(apiKey, new GuardianStub("valid"), {
    precheck: new PassingPrechecker(),
  });
}

function runExtractionSuite(apiKey: string, mode: "local" | "gemini") {
  describe(`SafeGate Agent — extraction (${mode})`, () => {
    it("extracts orderId, riderDid, action, amount from a clean message", async () => {
      const result: AgentRunResult = await makeAgent(apiKey).run(
        "I am did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK " +
          "requesting collection of KES 5000 for order ORD-001."
      );

      expect(result.mode).toBe(mode);
      expect(result.structuredRequest.orderId).toMatch(/ORD-001/i);
      expect(result.structuredRequest.riderDid).toMatch(/^did:/);
      expect(result.structuredRequest.amount).toBe(5000);
      expect(result.structuredRequest.action).toBe("COLLECT_COD");
      expect(result.guardianDecision.decision).toBe("APPROVED");
      expect(result.formattedResponse).toBe("✅ Approved");
    });

    it("propagates DENIED over-limit from stub without overriding", async () => {
      const stub = new GuardianStub("over_limit");
      const result = await new SafeGateAgent(apiKey, stub, {
        precheck: new PassingPrechecker(),
      }).run(
        "Rider did:key:z6MkhaXgBZDvotDkL5257 wants to collect KES 75000 for order ORD-002"
      );
      expect(result.guardianDecision.decision).toBe("DENIED");
      expect(result.guardianDecision.checks.amountWithinLimit).toBe(false);
      expect(result.formattedResponse).toContain("❌ Denied");
    });

    it("propagates DENIED revoked VC from stub", async () => {
      const stub = new GuardianStub("revoked");
      const result = await new SafeGateAgent(apiKey, stub, {
        precheck: new PassingPrechecker(),
      }).run(
        "Collect and release package for order ORD-003, rider did:key:z6MkRevoked"
      );
      expect(result.guardianDecision.decision).toBe("DENIED");
      expect(result.guardianDecision.checks.vcStatus).toBe("REVOKED");
    });
  });
}

runExtractionSuite("", "local");

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const describeWithKey = GEMINI_KEY ? describe : describe.skip;
describeWithKey("(with Gemini key)", () => {
  runExtractionSuite(GEMINI_KEY!, "gemini");
});