/**
 * precheck.test.ts — agent-side DID/VC identity pre-check.
 *
 * Same as the Guardian: verifies the Ed25519Signature2020 proof, subject
 * binding, expiry, and registry status. Runs fully offline (no Gemini, no
 * network) using a locally-issued VC and a stubbed credential source.
 */

import { describe, it, expect } from "vitest";
import {
  DidVcPrechecker,
  PassingPrechecker,
  type RiderPrecheck,
  type RiderPrecheckSource,
} from "../src/did/precheck.js";
import {
  createDidKey,
  generateEd25519Keypair,
  signVc,
} from "@safegate/shared-crypto";

function issueTestVc(riderDid: string, maxAmount = 25000) {
  const { publicKey, privateKey } = generateEd25519Keypair();
  const issuerDid = createDidKey(publicKey);
  const vc = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential", "DeliveryRiderCredential"],
    id: `urn:uuid:test-${Date.now()}`,
    issuer: issuerDid,
    issuanceDate: new Date().toISOString(),
    expirationDate: new Date(Date.now() + 86400000).toISOString(),
    credentialSubject: { id: riderDid, permissions: ["COLLECT_COD"], maxAmount, currency: "KES" },
    credentialStatus: { status: "ACTIVE" },
  };
  const signed = signVc(vc, privateKey, issuerDid, `${issuerDid}#key-1`);
  return { vc, signed, issuerDid };
}

function sourceWith(vc?: Record<string, any>, status?: "ACTIVE" | "REVOKED"): RiderPrecheckSource {
  return {
    fetchCredential: async () => ({ vc, status }),
  };
}

const RIDER_DID = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

describe("DidVcPrechecker", () => {
  it("passes a rider with a valid, ACTIVE credential", async () => {
    const { signed } = issueTestVc(RIDER_DID);
    const prechecker = new DidVcPrechecker(sourceWith(signed, "ACTIVE"));

    const result = await prechecker.precheck(RIDER_DID);
    expect(result.ok).toBe(true);
    expect(result.resolved).toBe(true);
    expect(result.signatureValid).toBe(true);
    expect(result.status).toBe("ACTIVE");
  });

  it("detects a tampered VC (signature no longer valid)", async () => {
    const { signed } = issueTestVc(RIDER_DID);
    const tampered = structuredClone(signed);
    tampered.credentialSubject.maxAmount = 99999999;

    const prechecker = new DidVcPrechecker(sourceWith(tampered, "ACTIVE"));
    const result = await prechecker.precheck(RIDER_DID);
    expect(result.ok).toBe(false);
    expect(result.signatureValid).toBe(false);
    expect(result.reason).toContain("signature");
  });

  it("denies a revoked credential", async () => {
    const { signed } = issueTestVc(RIDER_DID);
    const prechecker = new DidVcPrechecker(sourceWith(signed, "REVOKED"));
    const result = await prechecker.precheck(RIDER_DID);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("REVOKED");
    expect(result.reason).toContain("revoked");
  });

  it("denies when no credential exists", async () => {
    const prechecker = new DidVcPrechecker(sourceWith(undefined, undefined));
    const result = await prechecker.precheck(RIDER_DID);
    expect(result.ok).toBe(false);
    expect(result.signatureValid).toBe(false);
    expect(result.status).toBe("UNKNOWN");
  });

  it("rejects a non-did:key identifier outright", async () => {
    const prechecker = new DidVcPrechecker(sourceWith());
    const result: RiderPrecheck = await prechecker.precheck("alice@example.com");
    expect(result.ok).toBe(false);
    expect(result.resolved).toBe(false);
  });

  it("denies when the VC subject does not match the rider DID", async () => {
    const { signed } = issueTestVc(RIDER_DID);
    const otherRider = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doL";
    const prechecker = new DidVcPrechecker(sourceWith(signed, "ACTIVE"));
    const result = await prechecker.precheck(otherRider);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("subject");
  });
});

describe("PassingPrechecker", () => {
  it("always passes (used to isolate the LLM+Guardian flow in tests)", async () => {
    const result = await new PassingPrechecker().precheck(RIDER_DID);
    expect(result.ok).toBe(true);
  });
});