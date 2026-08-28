/**
 * @safegate/shared-types
 * Canonical TypeScript contracts shared across all SafeGate services.
 * DO NOT modify the StructuredRequest or GuardianDecision shapes —
 * the AI Agent, Guardian, and integration tests depend on these exactly.
 */

// ─────────────────────────────────────────────────────────────────────────────
// AI Agent → Guardian contract
// ─────────────────────────────────────────────────────────────────────────────

/** Produced by the AI Agent from a rider's free-text message. */
export interface StructuredRequest {
  orderId: string;
  riderDid: string;
  action: "COLLECT_COD" | "RELEASE_PACKAGE" | "COLLECT_AND_RELEASE";
  amount: number;
  currency: string;
  rawMessage: string;
  extractionConfidence: "high" | "low";
}

/**
 * Produced by the Guardian's POST /authorize endpoint.
 * All check fields must be present — Agent tests assert on every key.
 */
export interface GuardianDecision {
  decision: "APPROVED" | "DENIED";
  reason?: string;
  checks: {
    orderExists: boolean;
    riderDidResolves: boolean;
    vcSignatureValid: boolean;
    riderAssignedToOrder: boolean;
    vcStatus: "ACTIVE" | "REVOKED" | "EXPIRED" | "UNKNOWN";
    permissionIncludesAction: boolean;
    amountWithinLimit: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────────────────

export type OrderStatus = "PENDING" | "ASSIGNED" | "DELIVERED" | "CANCELLED";
export type VCStatus = "ACTIVE" | "REVOKED";
export type DeliveryAction = "COLLECT_COD" | "RELEASE_PACKAGE" | "COLLECT_AND_RELEASE";

export interface Order {
  id: string;
  status: OrderStatus;
  riderDid: string | null;
  amount: number;
  currency: string;
  packageDescription?: string;
  recipientName?: string;
  recipientAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Rider {
  did: string;
  name: string;
  phone: string;
  createdAt: string;
}

/** A W3C Verifiable Credential (JSON-LD with Ed25519Signature2020 proof). */
export interface VerifiableCredential {
  id: string;
  riderDid: string;
  /** Full VC JSON blob (including proof). */
  vc: Record<string, unknown>;
  status: VCStatus;
  issuedAt: string;
  expiresAt: string | null;
}

export interface AuditEntry {
  id: string;
  orderId: string;
  riderDid: string;
  action: string;
  decision: "APPROVED" | "DENIED";
  reason?: string;
  checks: GuardianDecision["checks"];
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// W3C VC internal shapes (used by Guardian + Backend)
// ─────────────────────────────────────────────────────────────────────────────

export interface VCProof {
  type: "Ed25519Signature2020";
  created: string;
  verificationMethod: string;
  proofPurpose: "assertionMethod";
  /** Multibase base58btc-encoded signature (z-prefix). */
  proofValue: string;
}

export interface DeliveryRiderVC {
  "@context": string[];
  type: ["VerifiableCredential", "DeliveryRiderCredential"];
  id: string;
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: {
    id: string; // rider DID
    permissions: DeliveryAction[];
    maxAmount: number;
    currency: string;
  };
  credentialStatus: {
    /** Simple ACTIVE|REVOKED status (StatusList2021 upgrade: TODO for post-MVP). */
    status: VCStatus;
  };
  proof?: VCProof;
}
