import "dotenv/config";
import express from "express";
import cors from "cors";
import ordersRouter from "./routes/orders.js";
import ridersRouter from "./routes/riders.js";
import credentialRouter from "./routes/credentials.js";
import auditRouter from "./routes/audit.js";
import verifyRouter from "./routes/verify.js";
import { eventStream } from "./events.js";

const app = express();
const port = process.env.BACKEND_PORT || 3002;
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Server-Sent Events endpoint for dispatcher dashboard live feed
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // Establish SSE stream

  const clientId = `client-${Date.now()}`;
  eventStream.registerClient(clientId, res);

  console.log(`📡 SSE Subscriber connected: ${clientId}`);

  // Send initial keep-alive heartbeat
  res.write("event: HEARTBEAT\ndata: {\"status\":\"CONNECTED\"}\n\n");

  req.on("close", () => {
    eventStream.unregisterClient(clientId);
    console.log(`🔌 SSE Subscriber disconnected: ${clientId}`);
  });
});

// App routing
app.use("/orders", ordersRouter);
app.use("/riders", ridersRouter);
app.use("/", credentialRouter);
app.use("/audit", auditRouter);

// AI Agent contract — proxies to the authoritative Guardian service.
// This is the agreed Backend endpoint the AI Agent calls, never the Guardian directly.
app.use("/api/guardian", verifyRouter);

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "SafeGate Backend" });
});

// Alias so both /health and /api/health probes succeed
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", service: "SafeGate Backend" });
});

app.listen(port, () => {
  console.log(`🚀 SafeGate Backend listening on port ${port}`);
  console.log(`   CORS allowed origin: ${corsOrigin}`);
});
