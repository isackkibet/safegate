import { describe, it, expect, afterEach } from "vitest";
import { vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import verifyRouter from "../src/routes/verify.js";

// Mount the verify router on a throwaway app (same mount as server.ts).
const app = express();
app.use(express.json());
app.use("/api/guardian", verifyRouter);

// Capture the real fetch BEFORE stubbing it — the tests make requests with it
// while the router under test sees the stubbed global fetch.
const realFetch = globalThis.fetch;

const GUARDIAN_DECISION = {
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
};

let server: ReturnType<typeof app.listen>;

async function withServer(fn: (base: string) => Promise<void>) {
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://localhost:${port}`);
  } finally {
    server.close();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/guardian/verify", () => {
  const validBody = {
    orderId: "ORD-001",
    riderDid: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    action: "COLLECT_COD",
    amount: 5000,
    currency: "KES",
  };

  it("proxies a StructuredRequest to the Guardian and returns its decision", async () => {
    const fetchStub = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => GUARDIAN_DECISION,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchStub);

    await withServer(async (base) => {
      const res = await realFetch(`${base}/api/guardian/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(GUARDIAN_DECISION);
    });

    const [url, init] = fetchStub.mock.calls[0];
    expect(String(url)).toMatch(/\/authorize$/);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual(validBody);
  });

  it("returns 400 when required fields are missing", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await withServer(async (base) => {
      const res = await realFetch(`${base}/api/guardian/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "ORD-001" }),
      });
      expect(res.status).toBe(400);
    });
  });

  it("returns a DENIED 502 when the Guardian is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await withServer(async (base) => {
      const res = await realFetch(`${base}/api/guardian/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.decision).toBe("DENIED");
      expect(body.reason).toContain("Guardian unreachable");
      expect(body.checks.vcSignatureValid).toBe(false);
    });
  });
});