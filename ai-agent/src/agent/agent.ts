import type { ExtractedOffer, LLMClient } from './llm.js';
import { normalizeExtraction, ExtractionError } from './extractor.js';
import type { GuardianClient } from '../guardian/client.js';
import type { ExecutionTools } from '../tools/tools.js';
import { recordDecision } from '../logging/audit.js';
import type { DecisionRecord, GuardianRequest, GuardianResponse } from '../types.js';

export interface AgentDeps {
  llm: LLMClient;
  guardian: GuardianClient;
  tools: ExecutionTools;
  /** Optional sink for persisting decisions to a durable store (e.g. Postgres). */
  onDecision?: (decision: DecisionRecord) => Promise<void> | void;
}

export interface AgentResult {
  allowed: boolean;
  request?: GuardianRequest;
  response?: GuardianResponse;
  decision?: DecisionRecord;
  toolResults?: unknown[];
  /** Non-null when extraction itself blocked the action (e.g. injection). */
  blocked?: { reason: string; code: string };
}

/**
 * The SafeGate AI Agent pipeline.
 *
 *   message --(LLM)--> extraction --> normalize --> Guardian --> tools --> log
 *
 * The Agent never decides on its own. It formats a structured request from
 * the LLM output, then hands authority to the deterministic Guardian. Prompt
 * injection is contained at two independent layers:
 *   1. extraction normalization rejects flagged/ambiguous output, and
 *   2. the Guardian re-checks the numeric limits from the signed VC.
 */
export class Agent {
  constructor(private deps: AgentDeps) {}

  async run(message: string, hint?: { riderDid?: string }): Promise<AgentResult> {
    // 1. LLM understands + extracts.
    let offer: ExtractedOffer;
    try {
      offer = await this.deps.llm.extract(message, hint);
    } catch (err) {
      return {
        allowed: false,
        blocked: {
          reason: err instanceof Error ? err.message : String(err),
          code: 'LLM_ERROR',
        },
      };
    }

    // 2. Normalize into a validated structured request (safety gate #1).
    let extraction;
    try {
      extraction = normalizeExtraction(offer, message);
    } catch (err) {
      const e = err as ExtractionError;
      const decision = recordDecision({
        request: {
          orderId: offer.orderId ?? 'unknown',
          riderDid: hint?.riderDid ?? offer.riderDid ?? 'unknown',
          action: 'COLLECT_COD',
          amount: Number(offer.amount ?? 0),
          currency: (offer.currency ?? 'KES').toUpperCase(),
        },
        extraction: {
          orderId: offer.orderId ?? 'unknown',
          riderDid: offer.riderDid ?? hint?.riderDid ?? 'unknown',
          action: 'COLLECT_COD',
          amount: Number(offer.amount ?? 0),
          currency: (offer.currency ?? '').toUpperCase(),
          rawMessage: message,
          confidence: offer.confidence ?? 0,
          injectionDetected: offer.injectionDetected ?? false,
        },
        response: {
          allowed: false,
          orderId: offer.orderId ?? 'unknown',
          riderDid: offer.riderDid ?? hint?.riderDid ?? 'unknown',
          reason: e.code === 'INJECTION_BLOCKED' ? 'PROMPT_INJECTION_BLOCKED' : 'PERMISSION_DENIED',
          checks: [
            {
              name: 'extraction_normalized',
              passed: false,
              detail: e.message,
            },
          ],
        },
      });
      await this.deps.onDecision?.(decision);
      return {
        allowed: false,
        blocked: { reason: e.message, code: e.code },
        decision,
      };
    }

    const request: GuardianRequest = {
      orderId: extraction.orderId,
      riderDid: extraction.riderDid,
      action: extraction.action,
      amount: extraction.amount,
      currency: extraction.currency || 'KES',
    };

    // 3. Deterministic Guardian decides (safety gate #2).
    const response: GuardianResponse = await this.deps.guardian.authorize(request);

    // 4. Only on approval do tools run.
    let toolResults;
    if (response.allowed) {
      toolResults =
        request.action === 'COLLECT_AND_RELEASE'
          ? [
              await this.deps.tools.collectPayment(request),
              await this.deps.tools.release(request),
            ]
          : request.action === 'COLLECT_COD'
            ? [await this.deps.tools.collectPayment(request)]
            : [await this.deps.tools.release(request)];
    } else {
      await this.deps.tools.deny(request, response);
      if (response.reason === 'VC_REVOKED' || response.reason === 'PROMPT_INJECTION_BLOCKED') {
        await this.deps.tools.alertDispatcher(request, response);
      }
    }

    // 5. Log for audit.
    const decision = recordDecision({ request, extraction, response });
    await this.deps.onDecision?.(decision);

    return {
      allowed: response.allowed,
      request,
      response,
      decision,
      ...(response.allowed ? { toolResults } : {}),
    };
  }
}
