/**
 * Shared types for the SafeGate AI Agent.
 *
 * These represent the structured contract between the AI Agent, the
 * SafeGate Guardian, and the execution tools. The Guardian is owned by the
 * Backend engineer; the Agent only *formats* and *submits* these structures.
 */

export const ACTION_TYPES = ['COLLECT_COD', 'RELEASE_PACKAGE', 'COLLECT_AND_RELEASE'] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface GuardianRequest {
  orderId: string;
  riderDid: string;
  action: ActionType;
  amount: number;
  currency: string;
}

export type DenyReason =
  | 'ORDER_NOT_FOUND'
  | 'DID_UNRESOLVED'
  | 'VC_SIGNATURE_INVALID'
  | 'VC_REVOKED'
  | 'VC_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'AMOUNT_EXCEEDS_LIMIT'
  | 'RIDER_NOT_ASSIGNED'
  | 'TOO_MANY_ATTEMPTS'
  | 'PROMPT_INJECTION_BLOCKED';

export interface GuardianResponse {
  allowed: boolean;
  orderId: string;
  riderDid: string;
  reason?: DenyReason;
  logId?: string;
  checks: GuardianCheck[];
}

export interface GuardianCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface ExecutionResult {
  ok: boolean;
  tool: string;
  payload?: unknown;
  error?: string;
}

/**
 * Structured request produced by the AI Agent after parsing a rider's
 * natural language message. Includes the raw message so the Guardian / audit
 * log can always re-inspect what the LLM actually saw.
 */
export interface ParsedExtraction {
  orderId: string;
  riderDid: string;
  action: ActionType;
  amount: number;
  currency: string;
  /** The raw natural-language message that produced this extraction. */
  rawMessage: string;
  /** Confidence (0..1) reported by the LLM. */
  confidence: number;
  /** True if the LLM detected an attempt to override its instructions. */
  injectionDetected: boolean;
}

export interface DecisionRecord {
  id: string;
  ts: string;
  request: GuardianRequest;
  response: GuardianResponse;
  extraction: ParsedExtraction;
}
