import { Router } from "express";
import { prisma } from "../db.js";
import { dispatcherAuth } from "../middleware/auth.js";
import { eventStream } from "../events.js";

const router = Router();

// GET /orders — fetch list of all orders
router.get("/", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve orders" });
  }
});

// GET /orders/:id — retrieve single order details (Guardian needs this public)
router.get("/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve order" });
  }
});

// POST /orders — create new order (protected)
router.post("/", dispatcherAuth, async (req, res) => {
  try {
    const { id, amount, currency, packageDescription, recipientName, recipientAddress, riderDid } = req.body;

    if (!id || !amount) {
      return res.status(400).json({ error: "Missing order ID or amount" });
    }

    const order = await prisma.order.create({
      data: {
        id,
        amount: parseFloat(amount),
        currency: currency || "KES",
        packageDescription,
        recipientName,
        recipientAddress,
        riderDid: riderDid || null,
        status: riderDid ? "ASSIGNED" : "PENDING",
      },
    });

    eventStream.broadcast("ORDER_CREATED", order);
    res.status(201).json(order);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order. Check if ID is unique." });
  }
});

// PATCH /orders/:id — update order details/status (protected)
router.patch("/:id", dispatcherAuth, async (req, res) => {
  try {
    const { status, riderDid, amount, packageDescription } = req.body;

    // Verify rider exists if changing rider
    if (riderDid) {
      const riderExists = await prisma.rider.findUnique({
        where: { did: riderDid },
      });
      if (!riderExists) {
        return res.status(404).json({ error: "Assigned rider not found in registry" });
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status,
        riderDid,
        amount: amount ? parseFloat(amount) : undefined,
        packageDescription,
      },
    });

    eventStream.broadcast("ORDER_UPDATED", updatedOrder);
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: "Failed to update order" });
  }
});

export default router;
