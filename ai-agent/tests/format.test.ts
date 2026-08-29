import { describe, it, expect } from "vitest";
import { formatDecision } from "../src/format.js";

describe("formatDecision", () => {
  it("formats an approval as ✅ Approved", () => {
    expect(
      formatDecision({
        decision: "APPROVED",
        checks: {
          orderExists: true,
          riderDidResolves: true,
          vcSignatureValid: true,
          riderAssignedToOrder: true,
          vcStatus: "ACTIVE",
          permissionIncludesAction: true,
          amountWithinLimit: true,
        },
      })
    ).toBe("✅ Approved");
  });

  it("formats a denial with its reason", () => {
    expect(
      formatDecision({
        decision: "DENIED",
        reason: "rider credential has expired",
        checks: {
          orderExists: true,
          riderDidResolves: true,
          vcSignatureValid: true,
          riderAssignedToOrder: true,
          vcStatus: "EXPIRED",
          permissionIncludesAction: true,
          amountWithinLimit: true,
        },
      })
    ).toBe("❌ Denied: rider credential has expired");
  });

  it("still renders a denial without a reason", () => {
    expect(
      formatDecision({
        decision: "DENIED",
        checks: {
          orderExists: false,
          riderDidResolves: false,
          vcSignatureValid: false,
          riderAssignedToOrder: false,
          vcStatus: "UNKNOWN",
          permissionIncludesAction: false,
          amountWithinLimit: false,
        },
      })
    ).toBe("❌ Denied");
  });
});