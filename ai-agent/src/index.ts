/**
 * AI Agent entrypoint — interactive CLI for manual testing.
 * In production, the agent is invoked as a library, not a CLI.
 */

import "dotenv/config";
import * as readline from "readline/promises";
import { SafeGateAgent } from "./agent.js";
import { HttpVerifyClient } from "./guardian/client.js";

const apiKey = process.env.GEMINI_API_KEY ?? "";
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3002";

// The agent calls the Backend's agreed /api/guardian/verify contract, which
// proxies to the authoritative Guardian service. Without a Gemini key it runs
// the deterministic local extractor — the flow still works end-to-end.
const guardian = new HttpVerifyClient(backendUrl);
const agent = new SafeGateAgent(apiKey, guardian, { backendUrl });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🛡️  SafeGate AI Agent (type 'exit' to quit)");
console.log(`   Verify endpoint: ${backendUrl}/api/guardian/verify`);
console.log(
  `   Extraction: ${agent.mode}${apiKey ? "" : " (no Gemini key — local parser)"}\n`
);

while (true) {
  const message = await rl.question("Rider message > ");
  if (message.toLowerCase() === "exit") break;

  try {
    const result = await agent.run(message);
    console.log(`\n[${result.mode}] ${result.formattedResponse}\n`);
    if (result.guardianDecision.reason) {
      console.log(`   ${result.guardianDecision.reason}\n`);
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
  }
}

rl.close();