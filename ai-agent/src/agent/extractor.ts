import { z } from 'zod';
import { ACTION_TYPES, type ActionType, type ParsedExtraction } from '../types.js';
import type { ExtractedOffer } from './llm.js';

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_ACTION'
      | 'INJECTION_BLOCKED'
      | 'MISSING_FIELDS'
      | 'INVALID_AMOUNT'
      | 'UNPARSABLE',
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/**
 * Normalizes raw LLM output into a typed `ParsedExtraction`.
 *
 * The core safety principle: if the LLM reported instruction-override or an
 * ambiguous "NONE" action, we throw instead of guessing — the Guardian never
 * sees a fabricated, high-confidence request. It is far safer to deny than to
 * guess wrong and release a package.
 */
export function normalizeExtraction(
  offer: ExtractedOffer,
  rawMessage: string,
): ParsedExtraction {
  if (offer.injectionDetected) {
    throw new ExtractionError(
      offer.injectionNote ?? 'Prompt injection detected during extraction.',
      'INJECTION_BLOCKED',
    );
  }

  const action = offer.action;
  if (!action || action === 'NONE') {
    throw new ExtractionError('LLM could not determine a delivery action.', 'NO_ACTION');
  }
  if (!ACTION_TYPES.includes(action as ActionType)) {
    throw new ExtractionError(`Unsupported action: ${action}`, 'MISSING_FIELDS');
  }

  const orderId = offer.orderId?.trim();
  const riderDid = offer.riderDid?.trim();
  if (!orderId || !riderDid) {
    throw new ExtractionError('Missing orderId or riderDid in extraction.', 'MISSING_FIELDS');
  }

  const amount = Number(offer.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ExtractionError(`Invalid amount: ${offer.amount}`, 'INVALID_AMOUNT');
  }

  const currency = (offer.currency ?? '').toUpperCase();
  if (currency && currency.length !== 3) {
    throw new ExtractionError(`Invalid currency code: ${currency}`, 'MISSING_FIELDS');
  }

  return {
    orderId,
    riderDid,
    action: action as ActionType,
    amount,
    currency: currency || (amount > 0 ? 'KES' : 'KES'),
    rawMessage,
    confidence: typeof offer.confidence === 'number' ? offer.confidence : 0,
    injectionDetected: false,
  };
}

const validationSchema = z.object({
  orderId: z.string().min(1),
  riderDid: z.string().startsWith('did:key:'),
  action: z.enum(ACTION_TYPES as unknown as [ActionType, ...ActionType[]]),
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
  rawMessage: z.string().min(0),
  confidence: z.number().min(0).max(1),
  injectionDetected: z.boolean(),
});

/**
 * Final guard before a request is handed to the Guardian: re-validate the
 * fully formed extraction against a strict schema. Even if a caller
 * constructs a request manually (bypassing the LLM), this rejects it.
 */
export function assertSafeExtraction(input: ParsedExtraction): ParsedExtraction {
  return validationSchema.parse(input);
}
