/**
 * AI Agent entrypoint — interactive CLI for manual testing.
 * In production, the agent is invoked as a library, not a CLI.
 */

import "dotenv/config";
import * as readline from "readline/promises";
import { SafeGateAgent } from "./agent.js";
import { HttpGuardianClient } from "./guardian/client.js";

const apiKey = process.env.GEMINI_API_KEY;
const guardianUrl = process.env.GUARDIAN_URL ?? "http://localhost:3001";

if (!apiKey) {
  console.error("❌  GEMINI_API_KEY is not set. Copy .env.example → .env");
  process.exit(1);
}

const guardian = new HttpGuardianClient(guardianUrl);
const agent = new SafeGateAgent(apiKey, guardian);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🛡️  SafeGate AI Agent (type 'exit' to quit)");
console.log(`   Guardian: ${guardianUrl}\n`);

while (true) {
  const message = await rl.question("Rider message > ");
  if (message.toLowerCase() === "exit") break;

  try {
    const result = await agent.run(message);
    const { decision, checks, reason } = result.guardianDecision;
    const icon = decision === "APPROVED" ? "✅" : "❌";
    console.log(`\n${icon} ${decision}${reason ? ` — ${reason}` : ""}`);
    console.log("   Checks:", JSON.stringify(checks, null, 2), "\n");
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
  }
}

rl.close();
