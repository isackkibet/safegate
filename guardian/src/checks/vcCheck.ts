import {
  extractPublicKeyFromDid,
  verifyVcSignature,
} from "@safegate/shared-crypto";
import type { DeliveryRiderVC, VCStatus } from "@safegate/shared-types";
import fetch from "node-fetch";

export interface VCCheckResult {
  signatureValid: boolean;
  status: VCStatus | "EXPIRED" | "UNKNOWN";
  vc?: DeliveryRiderVC;
}

/**
 * Checks a rider's Verifiable Credential:
 * 1. Cryptographically verifies signature using Issuer's DID public key.
 * 2. Checks expiration date.
 * 3. Queries the Backend Registry to check revocation status.
 */
export async function checkVerifiableCredential(
  vcJson: Record<string, any> | undefined,
  riderDid: string,
  backendUrl: string
): Promise<VCCheckResult> {
  if (!vcJson) {
    return { signatureValid: false, status: "UNKNOWN" };
  }

  const vc = vcJson as DeliveryRiderVC;

  try {
    // 1. Cryptographic Signature Verification
    const issuerDid = vc.issuer;
    if (!issuerDid.startsWith("did:key:")) {
      return { signatureValid: false, status: "UNKNOWN" };
    }
    const issuerPubKey = extractPublicKeyFromDid(issuerDid);
    const signatureValid = verifyVcSignature(vc, issuerPubKey);

    if (!signatureValid) {
      return { signatureValid: false, status: "UNKNOWN" };
    }

    // Verify credential subject matches the requesting rider
    if (vc.credentialSubject.id !== riderDid) {
      return { signatureValid: true, status: "UNKNOWN" };
    }

    // 2. Expiry Check
    if (vc.expirationDate) {
      const expiry = new Date(vc.expirationDate);
      if (expiry.getTime() < Date.now()) {
        return { signatureValid: true, status: "EXPIRED", vc };
      }
    }

    // 3. Revocation status check via Backend Registry
    // StatusList2021 spec gap: For MVP, we fetch the status directly from the registry
    // instead of resolving a StatusList2021 credential.
    let status: VCStatus | "UNKNOWN" = "ACTIVE";
    try {
      const res = await fetch(`${backendUrl}/riders/${encodeURIComponent(riderDid)}/credential`);
      if (res.status === 404) {
        status = "UNKNOWN";
      } else if (!res.ok) {
        console.warn(`Registry returned non-ok status: ${res.status}`);
        status = "UNKNOWN";
      } else {
        const data = (await res.json()) as { status: VCStatus };
        status = data.status;
      }
    } catch (err) {
      console.error("Failed to fetch VC status from backend registry:", err);
      status = "UNKNOWN";
    }

    return { signatureValid: true, status, vc };
  } catch (error) {
    console.error("VC Check failed with error:", error);
    return { signatureValid: false, status: "UNKNOWN" };
  }
}
