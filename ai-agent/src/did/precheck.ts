/**
 * Agent-side rider identity pre-check.
 *
 * Runs BEFORE the LLM call so we never spend a Gemini invocation on a rider
 * whose DID does not resolve or whose credential is invalid/revoked/expired.
 *
 * The pre-check is read-only and purely a fast gate: the Guardian's
 * cryptographic decision remains the only authoritative authorization.
 *
 * NOTE ON `did-jwt-vc`: the spec originally suggested did-jwt-vc, but that
 * library only verifies JWT-formatted credentials. SafeGate issues JSON-LD
 * VCs with Ed25519Signature2020 proofs, so we resolve the DID via the same
 * resolver stack (did-resolver + key-did-resolver) the Guardian uses and
 * verify the Ed25519 proof with node:crypto.
 */

import { Resolver } from "did-resolver";
import { getResolver as getKeyResolver } from "key-did-resolver";
import { extractPublicKeyFromDid, verifyVcSignature } from "@safegate/shared-crypto";
import type { VCStatus } from "@safegate/shared-types";

export interface RiderPrecheck {
  /** True only if the rider may proceed to the LLM + Guardian flow. */
  ok: boolean;
  /** The did:key resolved to a DID document. */
  resolved: boolean;
  /** The VC's Ed25519Signature2020 proof verified against the issuer key. */
  signatureValid: boolean;
  /** Registry status (or derived EXPIRED). */
  status: VCStatus | "EXPIRED" | "UNKNOWN";
  /** Human-readable reason when ok === false. */
  reason?: string;
}

export interface RiderPrecheckSource {
  /** Fetches { vc?, status } for a rider DID from the Backend credential registry. */
  fetchCredential(
    riderDid: string
  ): Promise<{ vc?: Record<string, any>; status?: VCStatus }>;
}

/** Reads rider credentials from the Backend's registry endpoint. */
export class HttpRiderPrecheckSource implements RiderPrecheckSource {
  private readonly baseUrl: string;

  constructor(backendUrl: string) {
    this.baseUrl = backendUrl.replace(/\/$/, "");
  }

  async fetchCredential(
    riderDid: string
  ): Promise<{ vc?: Record<string, any>; status?: VCStatus }> {
    try {
      const res = await fetch(
        `${this.baseUrl}/riders/${encodeURIComponent(riderDid)}/credential`
      );
      if (!res.ok) return {};
      const data = (await res.json()) as {
        vc?: Record<string, any>;
        status?: VCStatus;
      };
      return { vc: data.vc, status: data.status };
    } catch (error) {
      console.error(
        `Pre-check: failed to fetch credential for ${riderDid} from backend:`,
        error
      );
      return {};
    }
  }
}

export interface RiderPrechecker {
  precheck(riderDid: string): Promise<RiderPrecheck>;
}

/**
 * Fast identity gate: resolves the DID and verifies the rider's VC signature,
 * expiry and registry status before the AI even forms a StructuredRequest.
 */
export class DidVcPrechecker implements RiderPrechecker {
  private readonly resolver: Resolver;
  private readonly source: RiderPrecheckSource;

  constructor(source: RiderPrecheckSource) {
    this.source = source;
    this.resolver = new Resolver({ ...getKeyResolver() });
  }

  async precheck(riderDid: string): Promise<RiderPrecheck> {
    if (!/^did:key:/.test(riderDid)) {
      return {
        ok: false,
        resolved: false,
        signatureValid: false,
        status: "UNKNOWN",
        reason: `'${riderDid}' is not a supported did:key identifier`,
      };
    }

    // 1. DID resolution — confirms the DID parses and yields a DID document.
    let resolved = false;
    try {
      const result = await this.resolver.resolve(riderDid);
      resolved = Boolean(result?.didDocument);
    } catch (error) {
      console.error(`Pre-check: DID resolution failed for ${riderDid}:`, error);
    }

    // 2. Fetch the rider's VC + registry status from the Backend.
    const { vc, status } = await this.source.fetchCredential(riderDid);

    // 3. Verify the Ed25519Signature2020 proof against the issuer's key.
    let signatureValid = false;
    if (vc) {
      try {
        const issuer = String(vc.issuer ?? "");
        const issuerPubKey = extractPublicKeyFromDid(issuer);
        signatureValid = verifyVcSignature(vc, issuerPubKey);
      } catch (error) {
        console.error(`Pre-check: VC verification failed for ${riderDid}:`, error);
      }
    }

    // 4. Subject binding, expiry, and registry status.
    const subjectBinding =
      Boolean(vc) && (vc as Record<string, any>).credentialSubject?.id === riderDid;

    let finalStatus: VCStatus | "EXPIRED" | "UNKNOWN" = status ?? "UNKNOWN";
    const expirationDate = vc?.expirationDate as string | undefined;
    if (
      expirationDate &&
      new Date(expirationDate).getTime() < Date.now() &&
      (!status || status !== "REVOKED")
    ) {
      finalStatus = "EXPIRED";
    }

    const ok =
      resolved && signatureValid && subjectBinding && finalStatus === "ACTIVE";

    const reasons: string[] = [];
    if (!resolved) reasons.push("DID could not be resolved");
    if (!signatureValid) reasons.push("VC signature is invalid or missing");
    if (!subjectBinding) reasons.push("VC subject does not match rider DID");
    if (finalStatus === "REVOKED") reasons.push("rider credential is revoked");
    else if (finalStatus === "EXPIRED") reasons.push("rider credential has expired");
    else if (finalStatus === "UNKNOWN") reasons.push("rider credential status is unknown");

    return {
      ok,
      resolved,
      signatureValid,
      status: finalStatus,
      reason: ok ? undefined : "Identity pre-check denied: " + reasons.join(", "),
    };
  }
}

/** Test double — passes any rider through, proving the LLM/Guardian flow. */
export class PassingPrechecker implements RiderPrechecker {
  async precheck(_riderDid: string): Promise<RiderPrecheck> {
    return {
      ok: true,
      resolved: true,
      signatureValid: true,
      status: "ACTIVE",
    };
  }
}