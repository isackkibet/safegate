import { Router } from "express";
import { prisma } from "../db.js";
import { dispatcherAuth } from "../middleware/auth.js";
import { issueRiderCredential } from "../vc/issuer.js";
import { eventStream } from "../events.js";

const router = Router();

// GET /riders — list all riders
router.get("/", async (req, res) => {
  try {
    const riders = await prisma.rider.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(riders);
  } catch (error) {
    res.status(500).json({ error: "Failed to list riders" });
  }
});

// GET /riders/:did — get single rider info
router.get("/:did", async (req, res) => {
  try {
    const rider = await prisma.rider.findUnique({
      where: { did: req.params.did },
    });
    if (!rider) {
      return res.status(404).json({ error: "Rider not found" });
    }
    res.json(rider);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rider" });
  }
});

// POST /riders — register a new rider (protected)
router.post("/", dispatcherAuth, async (req, res) => {
  try {
    const { did, name, phone } = req.body;

    if (!did || !name || !phone) {
      return res.status(400).json({ error: "Missing required rider registry parameters" });
    }

    const rider = await prisma.rider.create({
      data: { did, name, phone },
    });

    eventStream.broadcast("RIDER_CREATED", rider);
    res.status(201).json(rider);
  } catch (error) {
    res.status(500).json({ error: "Failed to register rider. DID may already be in registry." });
  }
});

// POST /riders/:did/issue — issue a signed credential to rider (protected)
router.post("/:did/issue", dispatcherAuth, async (req, res) => {
  try {
    const { did } = req.params;
    const { permissions, maxAmount, currency, expirationDays } = req.body;

    const rider = await prisma.rider.findUnique({
      where: { did },
    });
    if (!rider) {
      return res.status(404).json({ error: "Rider not found" });
    }

    // Default permissions & limits
    const vcSubjectPermissions = permissions || ["COLLECT_COD", "RELEASE_PACKAGE"];
    const vcMaxAmount = maxAmount ? parseFloat(maxAmount) : 50000;
    const vcCurrency = currency || "KES";

    // Generate cryptographically signed VC
    const signedVc = issueRiderCredential({
      riderDid: did,
      permissions: vcSubjectPermissions,
      maxAmount: vcMaxAmount,
      currency: vcCurrency,
      expirationDays: expirationDays || 365,
    });

    // Revoke previous credentials first (a rider should only have one ACTIVE credential)
    await prisma.verifiableCredential.updateMany({
      where: { riderDid: did, status: "ACTIVE" },
      data: { status: "REVOKED" },
    });

    // Save the credential
    const vcRecord = await prisma.verifiableCredential.create({
      data: {
        id: signedVc.id,
        riderDid: did,
        vcJson: JSON.stringify(signedVc),
        status: "ACTIVE",
        expiresAt: signedVc.expirationDate ? new Date(signedVc.expirationDate) : null,
      },
    });

    eventStream.broadcast("CREDENTIAL_ISSUED", {
      riderDid: did,
      credentialId: vcRecord.id,
      vc: signedVc,
      status: "ACTIVE",
    });

    res.status(201).json({
      message: "Credential issued successfully",
      credential: {
        id: vcRecord.id,
        status: vcRecord.status,
        issuedAt: vcRecord.issuedAt,
        expiresAt: vcRecord.expiresAt,
        vc: signedVc,
      },
    });
  } catch (error) {
    console.error("Issuance failed:", error);
    res.status(500).json({ error: "Failed to issue Verifiable Credential" });
  }
});

// POST /riders/:did/revoke — revoke active credential for rider (protected)
router.post("/:did/revoke", dispatcherAuth, async (req, res) => {
  try {
    const { did } = req.params;

    const activeCredentials = await prisma.verifiableCredential.findMany({
      where: { riderDid: did, status: "ACTIVE" },
    });

    if (activeCredentials.length === 0) {
      return res.status(404).json({ error: "No active credential found to revoke" });
    }

    await prisma.verifiableCredential.updateMany({
      where: { riderDid: did, status: "ACTIVE" },
      data: { status: "REVOKED" },
    });

    eventStream.broadcast("CREDENTIAL_REVOKED", {
      riderDid: did,
    });

    res.json({ message: `Successfully revoked ${activeCredentials.length} active credential(s)` });
  } catch (error) {
    res.status(500).json({ error: "Failed to revoke credential" });
  }
});

export default router;
