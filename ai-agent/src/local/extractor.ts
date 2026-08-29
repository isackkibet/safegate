/**
 * Local rule-based extractor.
 *
 * When no GEMINI_API_KEY is configured the agent falls back to this
 * deterministic parser. It is deliberately simple: keywords + regexes only,
 * and it never parses instructions embedded in the message (which also makes
 * it naturally injection-resistant). Extraction confidence is always "low" —
 * the Guardian's decision is still the only authority.
 */

import type { StructuredRequest, DeliveryAction } from "@safegate/shared-types";
import { extractDidFromText } from "../did/verifier.js";

const ORDER_ID_PATTERN =
  /(?:order|ord|ref|no)[^A-Z0-9]{0,4}(ORD[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*)/i;
const ORDER_ID_FALLBACK = /\bORD[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*\b/i;

const AMOUNT_WITH_CURRENCY =
  /(?:KES|Ksh|KSh|Sh|USD|US\$|EUR|\$|£)\s*([\d,]+(?:\.\d+)?)/i;
const AMOUNT_VERBAL =
  /\b(?:amount|collect|of|for|charge)\s+([\d,]+(?:\.\d+)?)\b/i;
const AMOUNT_BARE = /(?<![\w-])(\d+[,.]?\d*)(?![.,\d])/;

const CURRENCY_PATTERN = /\b(KES|KSh|Sh|USD|EUR|GBP)\b/i;

function detectAction(message: string): DeliveryAction {
  const lower = message.toLowerCase();
  if (/collect\b[^.]*\brelease\b|\brelease\b[^.]*\bcollect\b/.test(lower)) {
    return "COLLECT_AND_RELEASE";
  }
  if (/\brelease\b/.test(lower)) {
    return "RELEASE_PACKAGE";
  }
  return "COLLECT_COD";
}

function extractOrderId(message: string): string {
  const scored = message.match(ORDER_ID_PATTERN);
  if (scored) return scored[1].toUpperCase();
  const fallback = message.match(ORDER_ID_FALLBACK);
  return fallback ? fallback[0].toUpperCase() : "";
}

function extractAmount(message: string): number {
  const withCurrency = message.match(AMOUNT_WITH_CURRENCY);
  if (withCurrency) return parseFloat(withCurrency[1].replace(/,/g, "")) || 0;

  const verbal = message.match(AMOUNT_VERBAL);
  if (verbal) return parseFloat(verbal[1].replace(/,/g, "")) || 0;

  const bare = message.match(AMOUNT_BARE);
  if (bare) return parseFloat(bare[1].replace(/,/g, "")) || 0;

  return 0;
}

function extractCurrency(message: string): string {
  const match = message.match(CURRENCY_PATTERN);
  if (!match) return "KES";
  const code = match[1].toUpperCase();
  return code === "SH" ? "KES" : code;
}

/**
 * Parses a free-text rider message into a StructuredRequest without an LLM.
 * Returns undefined if critical fields (rider DID, order id) are missing.
 */
export function extractStructuredRequest(message: string): StructuredRequest | undefined {
  const riderDid = extractDidFromText(message) ?? "";
  const orderId = extractOrderId(message);

  if (!riderDid || !orderId) {
    return undefined;
  }

  return {
    orderId,
    riderDid,
    action: detectAction(message),
    amount: extractAmount(message),
    currency: extractCurrency(message),
    rawMessage: message,
    extractionConfidence: "low",
  };
}