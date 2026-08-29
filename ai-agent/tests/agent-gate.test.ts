/**
 * agent-gate.test.ts — the agent's identity pre-check gate.
 *
 * Runs fully offline in LOCAL extraction mode (no Gemini key / no network):
 * a failing pre-check must short-circuit the runner before extraction,
 * returning a clean DENIED result with the rider-facing formatted response.
 */

import { describe, it, expect } from "vitest";
import { SafeGateAgent } from "../src/agent.js";
import { GuardianStub } from "../src/guardian/stub.js";
import { PassingPrechecker, type RiderPrechecker } from "../src/did/precheck.js";

const RIDER_MSG =
  "I am did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK " +
  "collecting KES 5000 for order ORD-001.";

const DENYING_PRECHEcK: RiderPrechecker = {
  async precheck() {
    return {
      ok: false,
      resolved: false,
      signatureValid: false,
      status: "REVOKED",
      reason: "Identity pre-check denied: rider credential is revoked",
    };
  },
};

function localAgent(precheck: RiderPrechecker | null) {
  return new SafeGateAgent("", new GuardianStub("valid"), {
    precheck,
    forceLocal: true,
  });
}

describe("SafeGateAgent — identity pre-check gate (local mode)", () => {
  it("denies early when the message contains no rider DID", async () => {
    const result = await localAgent(new PassingPrechecker()).run(
      "Please collect KES 5000 for order ORD-001."
    );
    expect(result.guardianDecision.decision).toBe("DENIED");
    expect(result.structuredRequest.riderDid).toBe("");
    expect(result.formattedResponse).toContain("❌ Denied");
    expect(result.formattedResponse).toContain("no rider DID");
  });

  it("denies early when the rider's pre-check fails (revoked)", async () => {
    const result = await localAgent(DENYING_PRECHEcK).run(RIDER_MSG);
    expect(result.guardianDecision.decision).toBe("DENIED");
    expect(result.formattedResponse).toBe(
      "❌ Denied: Identity pre-check denied: rider credential is revoked"
    );
  });

  it("runs the full local flow when pre-check succeeds", async () => {
    const stub = new GuardianStub("valid");
    const agent = new SafeGateAgent("", stub, {
      precheck: new PassingPrechecker(),
      forceLocal: true,
    });

    const result = await agent.run(RIDER_MSG);
    expect(result.mode).toBe("local");
    expect(result.structuredRequest.orderId).toBe("ORD-001");
    expect(result.structuredRequest.amount).toBe(5000);
    expect(result.guardianDecision.decision).toBe("APPROVED");
    expect(result.formattedResponse).toBe("✅ Approved");
  });

  it("runs the full local flow with the gate disabled (precheck: null)", async () => {
    const result = await localAgent(null).run(RIDER_MSG);
    expect(result.guardianDecision.decision).toBe("APPROVED");
    expect(result.formattedResponse).toBe("✅ Approved");
  });

  it("denies when no order id can be extracted", async () => {
    const result = await localAgent(new PassingPrechecker()).run(
      "I am did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK please collect KES 5000."
    );
    expect(result.guardianDecision.decision).toBe("DENIED");
    expect(result.formattedResponse).toContain("Could not extract required fields");
  });
});