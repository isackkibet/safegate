/**
 * SafeGate AI Agent — core logic.
 *
 * Flow: rider message → identity pre-check → { Gemini | local } extraction
 *         → Guardian → decision
 *
 * The agent NEVER authorizes anything. It pre-checks identity, extracts
 * structure, and calls the Guardian. The Guardian's cryptographic decision is
 * the only authoritative output.
 *
 * Extraction modes:
 *   - gemini: LLM function-calling extraction (needs GEMINI_API_KEY)
 *   - local:  deterministic rule-based parser (works with NO API key)
 */

import {
  GoogleGenerativeAI,
  type FunctionCallPart,
} from "@google/generative-ai";
import type { StructuredRequest, GuardianDecision } from "@safegate/shared-types";
import { SAFEGATE_TOOLS, SYSTEM_PROMPT } from "./tools.js";
import type { IGuardianClient } from "./guardian/client.js";
import {
  DidVcPrechecker,
  HttpRiderPrecheckSource,
  type RiderPrechecker,
} from "./did/precheck.js";
import { extractDidFromText } from "./did/verifier.js";
import { extractStructuredRequest } from "./local/extractor.js";
import { formatDecision } from "./format.js";

export type AgentMode = "gemini" | "local";

export interface AgentRunResult {
  structuredRequest: StructuredRequest;
  guardianDecision: GuardianDecision;
  rawMessage: string;
  /** Rider-facing one-liner, e.g. "✅ Approved" / "❌ Denied: reason". */
  formattedResponse: string;
  /** Which extractor produced the StructuredRequest. */
  mode: AgentMode;
}

export interface AgentOptions {
  /** Identity gate that runs before extraction (defaults to ON). null disables it. */
  precheck?: RiderPrechecker | null;
  /** Backend base URL (used to stand up the default pre-check source). */
  backendUrl?: string;
  /** Force local extraction even when a Gemini key is present. */
  forceLocal?: boolean;
}

const DENIED_CHECKS: GuardianDecision["checks"] = {
  orderExists: false,
  riderDidResolves: false,
  vcSignatureValid: false,
  riderAssignedToOrder: false,
  vcStatus: "UNKNOWN",
  permissionIncludesAction: false,
  amountWithinLimit: false,
};

export class SafeGateAgent {
  private readonly model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null;
  private readonly guardian: IGuardianClient;
  private readonly precheck: RiderPrechecker | null;
  /** How this instance extracts StructuredRequests. */
  readonly mode: AgentMode;

  constructor(apiKey: string, guardian: IGuardianClient, options: AgentOptions = {}) {
    this.guardian = guardian;

    // Gemini requires a real key. Without one (or when forced) we fall back to
    // the deterministic local parser — the whole flow keeps working offline.
    const useGemini = Boolean(apiKey?.trim()) && !options.forceLocal;
    this.mode = useGemini ? "gemini" : "local";

    if (useGemini) {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({
        model: "gemini-3.6-flash",
        systemInstruction: SYSTEM_PROMPT,
        tools: SAFEGATE_TOOLS,
      });
    } else {
      this.model = null;
    }

    // Pre-checks default to ON (identity gate). Passing `null` disables them.
    if (options.precheck === null) {
      this.precheck = null;
    } else if (options.precheck) {
      this.precheck = options.precheck;
    } else {
      const backendUrl =
        options.backendUrl ?? process.env.BACKEND_URL ?? "http://localhost:3002";
      const source = new HttpRiderPrecheckSource(backendUrl);
      this.precheck = new DidVcPrechecker(source);
    }
  }

  /**
   * Process a rider's free-text message end-to-end.
   * Returns the StructuredRequest, the Guardian's decision, and a rider-facing
   * formatted response.
   */
  async run(riderMessage: string): Promise<AgentRunResult> {
    // Step 0: Fast identity pre-check BEFORE extraction, so we never spend time
    // (or a Gemini invocation) on a rider who cannot be authorized.
    const riderDid = extractDidFromText(riderMessage);

    if (!riderDid) {
      return this.earlyDenied(
        riderMessage,
        this.emptyRequest(riderMessage, ""),
        {
          decision: "DENIED",
          reason: "Identity pre-check denied: no rider DID found in message",
          checks: DENIED_CHECKS,
        }
      );
    }

    if (this.precheck) {
      const precheck = await this.precheck.precheck(riderDid);
      if (!precheck.ok) {
        return this.earlyDenied(
          riderMessage,
          this.emptyRequest(riderMessage, riderDid),
          {
            decision: "DENIED",
            reason: precheck.reason,
            checks: DENIED_CHECKS,
          }
        );
      }
    }

    // Step 1: Extract a StructuredRequest — via Gemini (when available) or the
    // local parser. The model/local output is NEVER trusted for authorization.
    const structuredRequest = await this.extract(riderMessage, riderDid);

    if (!structuredRequest) {
      return this.earlyDenied(
        riderMessage,
        this.emptyRequest(riderMessage, riderDid),
        {
          decision: "DENIED",
          reason:
            "Could not extract required fields (order id / rider DID / action) from the message",
          checks: DENIED_CHECKS,
        }
      );
    }

    // Step 2: Call Guardian (deterministic, cryptographic authorization).
    const guardianDecision = await this.guardian.authorize(structuredRequest);

    return {
      structuredRequest,
      guardianDecision,
      rawMessage: riderMessage,
      formattedResponse: formatDecision(guardianDecision),
      mode: this.mode,
    };
  }

  private async extract(
    riderMessage: string,
    riderDid: string
  ): Promise<StructuredRequest | null> {
    if (this.mode === "local") {
      return extractStructuredRequest(riderMessage) ?? null;
    }

    // Gemini function-calling extraction.
    const chat = this.model!.startChat();
    const firstResponse = await chat.sendMessage(riderMessage);
    const firstContent = firstResponse.response;

    const toolCallPart = firstContent
      .candidates?.[0]?.content?.parts?.find(
        (p): p is FunctionCallPart => "functionCall" in p
      );

    if (!toolCallPart?.functionCall) {
      // Newer models may return text instead of a function call — fall back to local parser
      console.warn("Model did not call request_authorization — falling back to local parser");
      return extractStructuredRequest(riderMessage) ?? null;
    }

    const args = toolCallPart.functionCall.args as Record<string, unknown>;
    const structuredRequest: StructuredRequest = {
      orderId: String(args.orderId ?? ""),
      riderDid: String(args.riderDid ?? riderDid),
      action: (args.action as StructuredRequest["action"]) ?? "COLLECT_COD",
      amount: Number(args.amount ?? 0),
      currency: String(args.currency ?? "KES"),
      rawMessage: riderMessage,
      extractionConfidence:
        (args.extractionConfidence as "high" | "low") ?? "low",
    };

    return structuredRequest;
  }

  private emptyRequest(
    rawMessage: string,
    riderDid: string,
    orderId = ""
  ): StructuredRequest {
    return {
      orderId,
      riderDid,
      action: "COLLECT_COD",
      amount: 0,
      currency: "KES",
      rawMessage,
      extractionConfidence: "low",
    };
  }

  private earlyDenied(
    rawMessage: string,
    structuredRequest: StructuredRequest,
    decision: GuardianDecision
  ): AgentRunResult {
    return {
      structuredRequest,
      guardianDecision: decision,
      rawMessage,
      formattedResponse: formatDecision(decision),
      mode: this.mode,
    };
  }
}