import { describe, it, expect } from "vitest";
import { extractStructuredRequest } from "../src/local/extractor.js";

const RIDER = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

describe("extractStructuredRequest (local parser)", () => {
  it("parses a clean collection message", () => {
    const r = extractStructuredRequest(
      `I'm here to deliver order ORD-004. Rider ${RIDER}. Collecting KES 5000 cash on delivery.`
    );
    expect(r).toBeDefined();
    expect(r!.orderId).toBe("ORD-004");
    expect(r!.riderDid).toBe(RIDER);
    expect(r!.amount).toBe(5000);
    expect(r!.currency).toBe("KES");
    expect(r!.action).toBe("COLLECT_COD");
    expect(r!.extractionConfidence).toBe("low");
  });

  it("detects KSh amounts and RELEASE_PACKAGE action", () => {
    const r = extractStructuredRequest(
      `Rider ${RIDER} requests release of package for order ORD-010. No cash.`
    );
    expect(r!.action).toBe("RELEASE_PACKAGE");
    expect(r!.amount).toBe(0);
  });

  it("detects COLLECT_AND_RELEASE", () => {
    const r = extractStructuredRequest(
      `Order ORD-011. ${RIDER} collect cash and release the package, KSh 12000.`
    );
    expect(r!.action).toBe("COLLECT_AND_RELEASE");
    expect(r!.amount).toBe(12000);
  });

  it("detects a bare amount and defaults currency to KES", () => {
    const r = extractStructuredRequest(
      `Rider ${RIDER} collecting 2500 for order ORD-012.`
    );
    expect(r!.amount).toBe(2500);
    expect(r!.currency).toBe("KES");
  });

  it("ignores order-id digits when no amount is stated", () => {
    const r = extractStructuredRequest(
      `Rider ${RIDER} here to collect for order ORD-013.`
    );
    expect(r!.amount).toBe(0);
  });

  it("returns undefined when the rider DID is missing", () => {
    expect(extractStructuredRequest("Collect KES 5000 for order ORD-020")).toBeUndefined();
  });

  it("returns undefined when no order id is present", () => {
    expect(
      extractStructuredRequest(`I am ${RIDER}, please collect KES 5000.`)
    ).toBeUndefined();
  });
});