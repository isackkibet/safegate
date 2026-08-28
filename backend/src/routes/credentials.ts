import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

// GET /riders/:did/credential — retrieves current credential & revocation status
router.get("/riders/:did/credential", async (req, res) => {
  try {
    const { did } = req.params;

    // Fetch the most recently issued credential for the rider
    const credential = await prisma.verifiableCredential.findFirst({
      where: { riderDid: did },
      orderBy: { issuedAt: "desc" },
    });

    if (!credential) {
      return res.status(404).json({
        status: "UNKNOWN",
        message: "No credential found for this rider DID",
      });
    }

    const vc = JSON.parse(credential.vcJson);

    // Dynamic expiry evaluation
    let status = credential.status;
    if (status === "ACTIVE" && credential.expiresAt && credential.expiresAt.getTime() < Date.now()) {
      status = "EXPIRED";
    }

    res.json({
      status,
      vc,
    });
  } catch (error) {
    console.error("Failed to query credential status:", error);
    res.status(500).json({ error: "Internal registry retrieval error" });
  }
});

export default router;
