/**
 * AI Agent — type re-exports.
 * The StructuredRequest is owned by @safegate/shared-types.
 * This file re-exports it to keep ai-agent self-contained.
 */
export type {
  StructuredRequest,
  GuardianDecision,
} from "@safegate/shared-types";

/** Result of one full agent run. */
export interface AgentResult {
  structuredRequest: import("@safegate/shared-types").StructuredRequest;
  guardianDecision: import("@safegate/shared-types").GuardianDecision;
  /** The raw Gemini model output before tool execution. */
  rawModelText?: string;
}
