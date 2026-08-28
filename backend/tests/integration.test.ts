import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { issueRiderCredential } from "../src/vc/issuer.js";
import { getPlatformKeys } from "../src/vc/keys.js";
import { checkVerifiableCredential } from "../../guardian/src/checks/vcCheck.js";
import { checkPermissionsAndLimits } from "../../guardian/src/checks/permissionCheck.js";
import { prisma } from "../src/db.js";
import { spawn } from "child_process";
import path from "path";

// Skip Prisma db writes if not initialized, but since it's sqlite we can run it
describe("Backend & Guardian Integration Seam Test", () => {
  const testRiderDid = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

  it("can cryptographically verify a VC issued by the Backend using Guardian checks", async () => {
    // 1. Issue VC using the Backend issuer
    const signedVc = issueRiderCredential({
      riderDid: testRiderDid,
      permissions: ["COLLECT_COD", "RELEASE_PACKAGE"],
      maxAmount: 25000,
      currency: "KES",
    });

    expect(signedVc.proof).toBeDefined();
    expect(signedVc.proof.type).toBe("Ed25519Signature2020");

    // 2. Perform the exact cryptographic verification checks used by the Guardian
    // We mock the backend registry endpoint to return the issued VC
    const backendMockUrl = "http://localhost:9999"; // unused in local mock
    const { extractPublicKeyFromDid, verifyVcSignature } = await import(
      "../../guardian/src/checks/cryptoUtils.js"
    );

    const issuerPubKey = extractPublicKeyFromDid(signedVc.issuer);
    const signatureValid = verifyVcSignature(signedVc, issuerPubKey);

    expect(signatureValid).toBe(true);

    // 3. Verify permissions against the issued VC
    const permissions = checkPermissionsAndLimits(
      signedVc as any,
      "COLLECT_COD",
      15000,
      "KES"
    );
    expect(permissions.permissionIncludesAction).toBe(true);
    expect(permissions.amountWithinLimit).toBe(true);

    // Try over-limit amount
    const overLimit = checkPermissionsAndLimits(
      signedVc as any,
      "COLLECT_COD",
      30000,
      "KES"
    );
    expect(overLimit.amountWithinLimit).toBe(false);
  });
});
