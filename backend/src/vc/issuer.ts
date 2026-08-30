import { signVc } from "@safegate/shared-crypto";
import { getPlatformKeys } from "./keys.js";
import type { DeliveryAction } from "@safegate/shared-types";

export interface IssuanceParams {
  riderDid: string;
  permissions: DeliveryAction[];
  maxAmount: number;
  currency: string;
  expirationDays?: number;
}

/**
 * Creates and cryptographically signs a delivery rider Verifiable Credential.
 */
export function issueRiderCredential(params: IssuanceParams): Record<string, any> {
  const { riderDid, permissions, maxAmount, currency, expirationDays = 365 } = params;
  const { privateKey, did: platformDid } = getPlatformKeys();

  const issuanceDate = new Date().toISOString();
  const expirationDate = new Date(
    Date.now() + expirationDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const vcTemplate = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential", "DeliveryRiderCredential"],
    id: `urn:uuid:safegate-rider-credential-${Date.now()}`,
    issuer: platformDid,
    issuanceDate,
    expirationDate,
    credentialSubject: {
      id: riderDid,
      permissions,
      maxAmount,
      currency,
    },
    credentialStatus: {
      status: "ACTIVE",
    },
  };

  // Sign the VC using the Platform's private key
  const verificationMethod = `${platformDid}#key-1`;
  const signed = signVc(vcTemplate, privateKey, platformDid, verificationMethod);

  return signed;
}
