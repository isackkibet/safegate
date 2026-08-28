import "dotenv/config";
import express from "express";
import cors from "cors";
import { authorizeRequest } from "./authorizer.js";
import { writeAuditLog } from "./audit.js";
import type { StructuredRequest } from "@safegate/shared-types";

const app = express();
const port = process.env.GUARDIAN_PORT || 3001;
const backendUrl = process.env.BACKEND_URL || "http://localhost:3002";
const auditLogPath = process.env.AUDIT_LOG_PATH || "./guardian-audit.log";

app.use(cors());
app.use(express.json());

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "SafeGate Guardian" });
});

// POST /authorize
app.post("/authorize", async (req, res) => {
  try {
    const request = req.body as StructuredRequest;

    if (!request.orderId || !request.riderDid || !request.action) {
      return res.status(400).json({ error: "Missing required fields in StructuredRequest" });
    }

    // Process authorization deterministically
    const decision = await authorizeRequest(request, backendUrl);

    // Save to append-only local audit log before sending response
    await writeAuditLog(auditLogPath, request, decision, backendUrl);

    res.json(decision);
  } catch (error) {
    console.error("Internal server error in Guardian authorize endpoint:", error);
    res.status(500).json({
      decision: "DENIED",
      reason: "Guardian internal processing error: " + (error instanceof Error ? error.message : "unknown"),
      checks: {
        orderExists: false,
        riderDidResolves: false,
        vcSignatureValid: false,
        riderAssignedToOrder: false,
        vcStatus: "UNKNOWN",
        permissionIncludesAction: false,
        amountWithinLimit: false,
      },
    });
  }
});

app.listen(port, () => {
  console.log(`🛡️  SafeGate Guardian service listening on port ${port}`);
  console.log(`   Backend target: ${backendUrl}`);
  console.log(`   Audit log path: ${auditLogPath}`);
});
