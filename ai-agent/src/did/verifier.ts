/**
 * DID/VC helper utilities for the AI Agent.
 * These are read-only utilities — the Agent only extracts rider DIDs from
 * messages; it never creates or verifies VCs (that is the Guardian's job).
 */

/**
 * Minimal validation that a string looks like a did:key DID.
 * NOT cryptographic verification — only format check.
 * Full verification happens in the Guardian.
 */
export function looksLikeDid(did: string): boolean {
  return /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(did);
}

/**
 * Extracts a DID from a free-text rider message if present.
 * Returns undefined if none found.
 */
export function extractDidFromText(text: string): string | undefined {
  const match = text.match(/did:[a-z]+:[a-zA-Z0-9._:-]+/);
  return match?.[0];
}

/**
 * Extracts a numeric amount from a free-text message.
 * Returns 0 if none found.
 */
export function extractAmountFromText(text: string): number {
  // Match patterns like "KES 5,000", "5000 KES", "5,000", "5000"
  const match = text.match(/(?:KES\s*)?([\d,]+(?:\.\d+)?)/i);
  if (!match) return 0;
  return parseFloat(match[1].replace(/,/g, ""));
}
