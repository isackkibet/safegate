import { Router } from "express";
import { prisma } from "../db.js";
import { eventStream } from "../events.js";

const router = Router();

// GET /audit — retrieve list of audit logs
router.get("/", async (req, res) => {
  try {
    const { orderId, riderDid } = req.query;

    const whereClause: any = {};
    if (orderId) {
      whereClause.orderId = String(orderId);
    }
    if (riderDid) {
      whereClause.riderDid = String(riderDid);
    }

    const logs = await prisma.auditEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      orderId: log.orderId,
      riderDid: log.riderDid,
      action: log.action,
      decision: log.decision,
      reason: log.reason,
      checks: JSON.parse(log.checksJson),
      createdAt: log.createdAt.toISOString(),
    }));

    res.json(formattedLogs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch audit log history" });
  }
});

// POST /audit — record an authorization decision (called by Guardian)
router.post("/", async (req, res) => {
  try {
    const { orderId, riderDid, action, decision, reason, checks } = req.body;

    if (!orderId || !riderDid || !action || !decision || !checks) {
      return res.status(400).json({ error: "Missing required audit entry attributes" });
    }

    const audit = await prisma.auditEntry.create({
      data: {
        orderId,
        riderDid,
        action,
        decision,
        reason,
        checksJson: JSON.stringify(checks),
      },
    });

    const broadcastPayload = {
      id: audit.id,
      orderId: audit.orderId,
      riderDid: audit.riderDid,
      action: audit.action,
      decision: audit.decision,
      reason: audit.reason,
      checks: checks,
      createdAt: audit.createdAt.toISOString(),
    };

    eventStream.broadcast("AUDIT_LOGGED", broadcastPayload);

    res.status(201).json(broadcastPayload);
  } catch (error) {
    console.error("Failed to save audit log:", error);
    res.status(500).json({ error: "Failed to persist audit log entry" });
  }
});

export default router;
