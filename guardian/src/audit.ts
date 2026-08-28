import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import type { GuardianDecision, StructuredRequest } from "@safegate/shared-types";

/**
 * Writes the decision to a local append-only JSONL log file.
 * Also attempts to register the audit entry with the Backend.
 * Ensures the local write is completed before resolving.
 */
export async function writeAuditLog(
  logPath: string,
  request: StructuredRequest,
  decision: GuardianDecision,
  backendUrl: string
): Promise<void> {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    request,
    decision,
  };

  const logLine = JSON.stringify(auditEntry) + "\n";
  const absolutePath = path.resolve(logPath);

  // Ensure directory exists
  try {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  } catch (err) {
    // Ignore if already exists
  }

  // 1. Mandatory local write before returning response
  await fs.appendFile(absolutePath, logLine, "utf-8");

  // 2. Notify Backend for the dispatcher dashboard view
  try {
    const res = await fetch(`${backendUrl}/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: request.orderId,
        riderDid: request.riderDid,
        action: request.action,
        decision: decision.decision,
        reason: decision.reason || null,
        checks: decision.checks,
      }),
    });
    if (!res.ok) {
      console.warn(`Failed to push audit to backend: ${res.status}`);
    }
  } catch (error) {
    console.error("Failed to post audit log to backend:", error);
  }
}
