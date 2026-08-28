import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizeRequest } from "../src/authorizer.js";
import {
  riderDid,
  otherRiderDid,
  validVc,
  tamperedVc,
  expiredVc,
  platformDid,
} from "./fixtures.js";
import type { StructuredRequest } from "@safegate/shared-types";

// Mock node-fetch
const mockFetch = vi.fn();
vi.mock("node-fetch", () => ({
  default: (...args: any[]) => mockFetch(...args),
}));

describe("Guardian Authorization Service", () => {
  const backendUrl = "http://localhost:3002";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("approves a valid delivery request with matching VC and assigned order", async () => {
    // Mock backend responses
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes(`/orders/ORD-001`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "ORD-001",
            status: "ASSIGNED",
            riderDid: riderDid,
            amount: 5000,
            currency: "KES",
          }),
        };
      }
      if (url.includes(`/riders/${encodeURIComponent(riderDid)}/credential`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ACTIVE",
            vc: validVc,
          }),
        };
      }
      throw new Error(`Unexpected mock call: ${url}`);
    });

    const request: StructuredRequest = {
      orderId: "ORD-001",
      riderDid: riderDid,
      action: "COLLECT_COD",
      amount: 5000,
      currency: "KES",
      rawMessage: "Collect 5k for ORD-001",
      extractionConfidence: "high",
    };

    const decision = await authorizeRequest(request, backendUrl);

    expect(decision.decision).toBe("APPROVED");
    expect(decision.checks.orderExists).toBe(true);
    expect(decision.checks.riderDidResolves).toBe(true);
    expect(decision.checks.vcSignatureValid).toBe(true);
    expect(decision.checks.riderAssignedToOrder).toBe(true);
    expect(decision.checks.vcStatus).toBe("ACTIVE");
    expect(decision.checks.amountWithinLimit).toBe(true);
    expect(decision.checks.permissionIncludesAction).toBe(true);
  });

  it("denies if amount exceeds the credential limit", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes(`/orders/ORD-002`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "ORD-002",
            status: "ASSIGNED",
            riderDid: riderDid,
            amount: 75000, // exceeds VC limit (50000)
            currency: "KES",
          }),
        };
      }
      if (url.includes(`/riders/${encodeURIComponent(riderDid)}/credential`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ACTIVE",
            vc: validVc,
          }),
        };
      }
      throw new Error(`Unexpected mock call: ${url}`);
    });

    const request: StructuredRequest = {
      orderId: "ORD-002",
      riderDid: riderDid,
      action: "COLLECT_COD",
      amount: 75000,
      currency: "KES",
      rawMessage: "Collect 75k for ORD-002",
      extractionConfidence: "high",
    };

    const decision = await authorizeRequest(request, backendUrl);

    expect(decision.decision).toBe("DENIED");
    expect(decision.checks.amountWithinLimit).toBe(false);
    expect(decision.reason).toContain("exceeds rider limit");
  });

  it("denies if VC has been revoked", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes(`/orders/ORD-003`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "ORD-003",
            status: "ASSIGNED",
            riderDid: riderDid,
            amount: 5000,
            currency: "KES",
          }),
        };
      }
      if (url.includes(`/riders/${encodeURIComponent(riderDid)}/credential`)) {
        // Registry returns REVOKED
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "REVOKED",
            vc: validVc,
          }),
        };
      }
      throw new Error(`Unexpected mock call: ${url}`);
    });

    const request: StructuredRequest = {
      orderId: "ORD-003",
      riderDid: riderDid,
      action: "COLLECT_COD",
      amount: 5000,
      currency: "KES",
      rawMessage: "Collect 5k for ORD-003",
      extractionConfidence: "high",
    };

    const decision = await authorizeRequest(request, backendUrl);

    expect(decision.decision).toBe("DENIED");
    expect(decision.checks.vcStatus).toBe("REVOKED");
    expect(decision.reason).toContain("credential is revoked");
  });

  it("denies and flags vcSignatureValid: false for tampered signature", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes(`/orders/ORD-004`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "ORD-004",
            status: "ASSIGNED",
            riderDid: riderDid,
            amount: 5000,
            currency: "KES",
          }),
        };
      }
      if (url.includes(`/riders/${encodeURIComponent(riderDid)}/credential`)) {
        // Return the VC with modified/tampered values
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ACTIVE",
            vc: tamperedVc,
          }),
        };
      }
      throw new Error(`Unexpected mock call: ${url}`);
    });

    const request: StructuredRequest = {
      orderId: "ORD-004",
      riderDid: riderDid,
      action: "COLLECT_COD",
      amount: 5000,
      currency: "KES",
      rawMessage: "Collect 5k for ORD-004",
      extractionConfidence: "high",
    };

    const decision = await authorizeRequest(request, backendUrl);

    expect(decision.decision).toBe("DENIED");
    expect(decision.checks.vcSignatureValid).toBe(false);
    expect(decision.reason).toContain("signature is invalid or tampered");
  });

  it("denies if VC has expired", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes(`/orders/ORD-005`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "ORD-005",
            status: "ASSIGNED",
            riderDid: riderDid,
            amount: 5000,
            currency: "KES",
          }),
        };
      }
      if (url.includes(`/riders/${encodeURIComponent(riderDid)}/credential`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ACTIVE",
            vc: expiredVc,
          }),
        };
      }
      throw new Error(`Unexpected mock call: ${url}`);
    });

    const request: StructuredRequest = {
      orderId: "ORD-005",
      riderDid: riderDid,
      action: "COLLECT_COD",
      amount: 5000,
      currency: "KES",
      rawMessage: "Collect 5k for ORD-005",
      extractionConfidence: "high",
    };

    const decision = await authorizeRequest(request, backendUrl);

    expect(decision.decision).toBe("DENIED");
    expect(decision.checks.vcStatus).toBe("EXPIRED");
    expect(decision.reason).toContain("credential has expired");
  });

  it("denies if rider is not assigned to order", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes(`/orders/ORD-006`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "ORD-006",
            status: "ASSIGNED",
            riderDid: otherRiderDid, // assigned to someone else
            amount: 5000,
            currency: "KES",
          }),
        };
      }
      if (url.includes(`/riders/${encodeURIComponent(riderDid)}/credential`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ACTIVE",
            vc: validVc,
          }),
        };
      }
      throw new Error(`Unexpected mock call: ${url}`);
    });

    const request: StructuredRequest = {
      orderId: "ORD-006",
      riderDid: riderDid,
      action: "COLLECT_COD",
      amount: 5000,
      currency: "KES",
      rawMessage: "Collect 5k for ORD-006",
      extractionConfidence: "high",
    };

    const decision = await authorizeRequest(request, backendUrl);

    expect(decision.decision).toBe("DENIED");
    expect(decision.checks.riderAssignedToOrder).toBe(false);
    expect(decision.reason).toContain("rider is not assigned to this order");
  });
});
