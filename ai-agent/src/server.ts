/**
 * AI Agent HTTP server.
 * Exposes POST /agent/run so the frontend Simulator can call the agent directly.
 * The agent extracts the StructuredRequest (Gemini when a key is set, otherwise
 * a deterministic local parser), then calls the Backend's /api/guardian/verify
 * contract, which proxies to the authoritative Guardian.
 */

import "dotenv/config";
import http from "http";
import { SafeGateAgent } from "./agent.js";
import { HttpVerifyClient } from "./guardian/client.js";

const PORT        = process.env.AGENT_PORT   ?? "3003";
const GEMINI_KEY  = process.env.GEMINI_API_KEY ?? "";
const BACKEND_URL = process.env.BACKEND_URL  ?? "http://localhost:3002";

const guardian = new HttpVerifyClient(BACKEND_URL);
const agent    = new SafeGateAgent(GEMINI_KEY, guardian, { backendUrl: BACKEND_URL });

// ---------------------------------------------------------------------------
// Simple HTTP server (no Express needed — keeps it lightweight)
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // Health
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "OK",
      service: "SafeGate AI Agent",
      mode: agent.mode,
      geminiConfigured: GEMINI_KEY !== "",
      backendUrl: BACKEND_URL,
    }));
    return;
  }

  // Main agent endpoint
  if (req.method === "POST" && req.url === "/agent/run") {
    let body = "";
    for await (const chunk of req) body += chunk;

    let payload: { message: string; riderDid?: string; orderId?: string };
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    if (!payload.message?.trim()) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "message field is required" }));
      return;
    }

    try {
      const result = await agent.run(payload.message);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        mode:            result.mode,
        formatted:       result.formattedResponse,
        structuredRequest: result.structuredRequest,
        decision:        result.guardianDecision.decision,
        reason:          result.guardianDecision.reason,
        checks:          result.guardianDecision.checks,
        rawMessage:      result.rawMessage,
      }));
    } catch (err) {
      console.error("Agent run error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error:    err instanceof Error ? err.message : "Agent processing failed",
        decision: "DENIED",
        reason:   "Agent internal error",
        checks: {
          orderExists: false, riderDidResolves: false, vcSignatureValid: false,
          riderAssignedToOrder: false, vcStatus: "UNKNOWN",
          permissionIncludesAction: false, amountWithinLimit: false,
        },
      }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`🤖 SafeGate AI Agent listening on port ${PORT}`);
  console.log(`   Extraction: ${agent.mode}${GEMINI_KEY ? "" : " — local parser (no Gemini key)"}`);
  console.log(`   Verify contract: ${BACKEND_URL}/api/guardian/verify`);
});