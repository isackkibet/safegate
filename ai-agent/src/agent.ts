/**
 * SafeGate AI Agent — core logic.
 *
 * Flow: rider message → Gemini (extracts StructuredRequest) → Guardian → decision
 *
 * The agent NEVER authorizes anything. It extracts structure and calls the Guardian.
 * The Guardian's cryptographic decision is the only authoritative output.
 */

import {
  GoogleGenerativeAI,
  type FunctionCallPart,
} from "@google/generative-ai";
import type { StructuredRequest, GuardianDecision } from "@safegate/shared-types";
import { SAFEGATE_TOOLS, SYSTEM_PROMPT } from "./tools.js";
import type { IGuardianClient } from "./guardian/client.js";

export interface AgentRunResult {
  structuredRequest: StructuredRequest;
  guardianDecision: GuardianDecision;
  rawMessage: string;
}

export class SafeGateAgent {
  private readonly model;
  private readonly guardian: IGuardianClient;

  constructor(apiKey: string, guardian: IGuardianClient) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      tools: SAFEGATE_TOOLS,
    });
    this.guardian = guardian;
  }

  /**
   * Process a rider's free-text message end-to-end.
   * Returns both the extracted StructuredRequest and the Guardian's decision.
   */
  async run(riderMessage: string): Promise<AgentRunResult> {
    const chat = this.model.startChat();

    // Step 1: Send rider message → Gemini extracts fields and emits a tool call
    const firstResponse = await chat.sendMessage(riderMessage);
    const firstContent = firstResponse.response;

    const toolCallPart = firstContent
      .candidates?.[0]?.content?.parts?.find(
        (p): p is FunctionCallPart => "functionCall" in p
      );

    if (!toolCallPart?.functionCall) {
      throw new Error(
        "Model did not call request_authorization. Check system prompt or message format."
      );
    }

    const args = toolCallPart.functionCall.args as any;

    // Step 2: Build StructuredRequest from model output
    const structuredRequest: StructuredRequest = {
      orderId: String(args.orderId ?? ""),
      riderDid: String(args.riderDid ?? ""),
      action: (args.action as StructuredRequest["action"]) ?? "COLLECT_COD",
      amount: Number(args.amount ?? 0),
      currency: String(args.currency ?? "KES"),
      rawMessage: riderMessage,
      extractionConfidence:
        (args.extractionConfidence as "high" | "low") ?? "low",
    };

    // Step 3: Call Guardian (deterministic, cryptographic authorization)
    // This is the authoritative step. The model's extraction is NEVER trusted for auth.
    const guardianDecision = await this.guardian.authorize(structuredRequest);

    // Step 4: Return tool result to model (so model can formulate a user-facing response)
    await chat.sendMessage([
      {
        functionResponse: {
          name: "request_authorization",
          response: guardianDecision,
        },
      },
    ]);

    return { structuredRequest, guardianDecision, rawMessage: riderMessage };
  }
}
