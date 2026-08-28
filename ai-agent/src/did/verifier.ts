import { Resolver } from 'did-resolver';
import { getResolver as getKeyResolver } from 'key-did-resolver';
import { verifyCredential } from 'did-jwt-vc';
import type { W3CCredential } from 'did-jwt-vc';

export interface VerificationResult {
  /** True if the credential resolved and its signature is valid. */
  signatureValid: boolean;
  /** Status extracted from credentialSubject (demo pattern, see README note). */
  status: 'ACTIVE' | 'REVOKED' | 'UNKNOWN';
  /** ExpirationDate from the VC (ISO string), if present. */
  expirationDate?: string;
  /** Derived permissions from the credentialSubject. */
  permissions: string[];
  /** Maximum collection amount the rider is authorized for. */
  maxCollectionAmount: number;
  currency?: string;
  /** W3C credential payload once de-wrapped from the JWT. */
  credential?: W3CCredential;
  error?: string;
}

/**
 * DID/VC verification for the SafeGate identity layer.
 *
 * - Resolves any `did:key` to its verification keys (key-did-resolver).
 * - Verifies a Verifiable Credential JWT through did-jwt-vc.
 *
 * Production note: raw `did:key` gives us issuers/verificationMethods out of
 * the box with no blockchain. Revocation is represented as a simple
 * status: ACTIVE|REVOKED field here; in production this maps to W3C
 * StatusList2021 (a bit set in an off-chain status list), which the backend
 * owns. See README.
 */
const resolver = new Resolver(getKeyResolver());

interface Subject {
  id?: string;
  status?: string;
  permissions?: string[];
  maxCollectionAmount?: number | string;
  currency?: string;
}

/**
 * Verify a VC JWT and pull out the claims the Guardian needs.
 * `statusProvider` can override the in-credential status with a live
 * revocation-list check owned by the backend.
 */
export async function verifyRiderCredential(
  credentialJwt: string,
  statusProvider?: (did: string) => Promise<'ACTIVE' | 'REVOKED' | 'UNKNOWN'>,
): Promise<VerificationResult> {
  const base: VerificationResult = {
    signatureValid: false,
    status: 'UNKNOWN',
    permissions: [],
    maxCollectionAmount: 0,
  };
  try {
    const verified = await verifyCredential(credentialJwt, resolver);
    const cred = verified.verifiableCredential;
    const subject = (cred.credentialSubject ?? {}) as Subject;

    let status: VerificationResult['status'] = 'ACTIVE';
    if (typeof subject.status === 'string' && subject.status !== 'ACTIVE') {
      status = subject.status === 'REVOKED' ? 'REVOKED' : 'UNKNOWN';
    }
    if (statusProvider) {
      const live = await statusProvider(subject.id ?? verified.issuer);
      if (live === 'REVOKED') status = 'REVOKED';
    }

    return {
      signatureValid: true,
      status,
      expirationDate: cred.expirationDate,
      permissions: Array.isArray(subject.permissions) ? (subject.permissions as string[]) : [],
      maxCollectionAmount: Number(subject.maxCollectionAmount ?? 0),
      currency: subject.currency,
      credential: cred,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Resolve a DID to confirm it exists and is well-formed. */
export async function resolveDid(
  did: string,
): Promise<{ ok: boolean; did: string; error?: string }> {
  try {
    const resolution = await resolver.resolve(did);
    if (resolution?.didDocument) return { ok: true, did };
    return { ok: false, did, error: 'No DID document resolved' };
  } catch (err) {
    return {
      ok: false,
      did,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
