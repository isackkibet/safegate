import type { GuardianDecision } from "@safegate/shared-types";

/**
 * Formats a GuardianDecision into a rider-facing one-liner:
 *   "✅ Approved"
 *   "❌ Denied: <reason>"
 */
export function formatDecision(decision: GuardianDecision): string {
  if (decision.decision === "APPROVED") {
    return "✅ Approved";
  }
  const reason = decision.reason ? `: ${decision.reason}` : "";
  return `❌ Denied${reason}`;
}