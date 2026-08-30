import {
  generateEd25519Keypair,
  createDidKey,
  signVc,
} from "@safegate/shared-crypto";
import type { DeliveryRiderVC } from "@safegate/shared-types";

// Generate platform keys
const platformKeys = generateEd25519Keypair();
export const platformDid = createDidKey(platformKeys.publicKey);

// Generate rider keys
const riderKeys = generateEd25519Keypair();
export const riderDid = createDidKey(riderKeys.publicKey);

// Generate another rider's keys (unassigned)
const otherRiderKeys = generateEd25519Keypair();
export const otherRiderDid = createDidKey(otherRiderKeys.publicKey);

// Create a template VC
const vcTemplate = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  type: ["VerifiableCredential", "DeliveryRiderCredential"],
  id: "urn:uuid:safegate-test-credential-1",
  issuer: platformDid,
  issuanceDate: new Date().toISOString(),
  expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 1 day in future
  credentialSubject: {
    id: riderDid,
    permissions: ["COLLECT_COD", "RELEASE_PACKAGE"],
    maxAmount: 50000,
    currency: "KES",
  },
  credentialStatus: {
    status: "ACTIVE",
  },
};

// 1. Valid VC
export const validVc = signVc(
  vcTemplate,
  platformKeys.privateKey,
  platformDid,
  `${platformDid}#key-1`
) as DeliveryRiderVC;

// 2. Tampered VC (signed validly, but someone modified the maxAmount afterwards)
const tamperedTemplate = JSON.parse(JSON.stringify(vcTemplate));
tamperedTemplate.credentialSubject.maxAmount = 999999; // tampered amount
export const tamperedVc = signVc(
  vcTemplate, // signed on 50000
  platformKeys.privateKey,
  platformDid,
  `${platformDid}#key-1`
) as DeliveryRiderVC;
// Modify after signing to simulate attack
tamperedVc.credentialSubject.maxAmount = 999999;

// 3. Expired VC
const expiredTemplate = JSON.parse(JSON.stringify(vcTemplate));
expiredTemplate.expirationDate = new Date(Date.now() - 1000 * 60).toISOString(); // expired 1 minute ago
export const expiredVc = signVc(
  expiredTemplate,
  platformKeys.privateKey,
  platformDid,
  `${platformDid}#key-1`
) as DeliveryRiderVC;
