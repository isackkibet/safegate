/**
 * Guardian stub — in-memory fake for tests.
 * Returns a predictable GuardianDecision based on injected scenario data.
 */

import type { GuardianDecision, StructuredRequest } from "@safegate/shared-types";
import type { IGuardianClient } from "./client.js";

export type StubScenario =
  | "valid"
  | "over_limit"
  | "revoked"
  | "invalid_signature"
  | "order_not_found"
  | "rider_not_assigned";

const APPROVED_CHECKS: GuardianDecision["checks"] = {
  orderExists: true,
  riderDidResolves: true,
  vcSignatureValid: true,
  riderAssignedToOrder: true,
  vcStatus: "ACTIVE",
  permissionIncludesAction: true,
  amountWithinLimit: true,
};

const SCENARIOS: Record<StubScenario, GuardianDecision> = {
  valid: {
    decision: "APPROVED",
    checks: { ...APPROVED_CHECKS },
  },
  over_limit: {
    decision: "DENIED",
    reason: "Amount 75000 exceeds rider limit of 50000 KES",
    checks: { ...APPROVED_CHECKS, amountWithinLimit: false },
  },
  revoked: {
    decision: "DENIED",
    reason: "Rider credential has been revoked",
    checks: { ...APPROVED_CHECKS, vcStatus: "REVOKED" },
  },
  invalid_signature: {
    decision: "DENIED",
    reason: "VC proof signature is invalid — possible tampering",
    checks: {
      ...APPROVED_CHECKS,
      vcSignatureValid: false,
      permissionIncludesAction: false,
      amountWithinLimit: false,
    },
  },
  order_not_found: {
    decision: "DENIED",
    reason: "Order not found",
    checks: {
      orderExists: false,
      riderDidResolves: true,
      vcSignatureValid: false,
      riderAssignedToOrder: false,
      vcStatus: "UNKNOWN",
      permissionIncludesAction: false,
      amountWithinLimit: false,
    },
  },
  rider_not_assigned: {
    decision: "DENIED",
    reason: "Rider is not assigned to this order",
    checks: { ...APPROVED_CHECKS, riderAssignedToOrder: false },
  },
};

export class GuardianStub implements IGuardianClient {
  private scenario: StubScenario;

  constructor(scenario: StubScenario = "valid") {
    this.scenario = scenario;
  }

  setScenario(scenario: StubScenario): void {
    this.scenario = scenario;
  }

  async authorize(_request: StructuredRequest): Promise<GuardianDecision> {
    return structuredClone(SCENARIOS[this.scenario]);
  }
}
