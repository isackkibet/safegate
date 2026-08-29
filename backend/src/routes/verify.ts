import { Router } from "express";
import type { StructuredRequest, GuardianDecision } from "@safegate/shared-types";

const router = Router();

/**
 * POST /api/guardian/verify
 *
 * The agreed AI Agent → Backend contract. Accepts a StructuredRequest and
 * forwards it to the Guardian's authoritative POST /authorize endpoint.
 *
 * The Backend is deliberately a thin proxy: it performs no authorization logic
 * itself. The Guardian remains the only service that resolves DIDs, verifies
 * VCs, and produces a decision.
 */
const guardianUrl = (
  process.env.GUARDIAN_URL || "http://localhost:3001"
).replace(/\/$/, "");

function denied(
  reason: string,
  checks: GuardianDecision["checks"]
): GuardianDecision {
  return { decision: "DENIED", reason, checks };
}

const ALL_FAILED_CHECKS: GuardianDecision["checks"] = {
  orderExists: false,
  riderDidResolves: false,
  vcSignatureValid: false,
  riderAssignedToOrder: false,
  vcStatus: "UNKNOWN",
  permissionIncludesAction: false,
  amountWithinLimit: false,
};

router.post("/verify", async (req, res) => {
  const request = req.body as StructuredRequest;

  if (!request || !request.orderId || !request.riderDid || !request.action) {
    return res.status(400).json({
      error: "Missing required fields in StructuredRequest",
    });
  }

  try {
    const response = await fetch(`${guardianUrl}/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({
        error: `Guardian HTTP ${response.status}: ${body.slice(0, 500)}`,
      });
    }

    const decision = (await response.json()) as GuardianDecision;
    return res.json(decision);
  } catch (error) {
    console.error("Guardian proxy error:", error);
    return res.status(502).json(
      denied(
        "Guardian unreachable: " +
          (error instanceof Error ? error.message : "unknown error"),
        ALL_FAILED_CHECKS
      )
    );
  }
});

export default router;