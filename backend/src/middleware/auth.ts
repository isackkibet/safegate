import type { Request, Response, NextFunction } from "express";

const DISPATCHER_API_KEY = process.env.DISPATCHER_API_KEY || "safegate-dispatcher-key-change-me";

/**
 * Express middleware to verify X-API-Key header.
 * Protects dispatcher-facing write/management operations.
 */
export function dispatcherAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== DISPATCHER_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing X-API-Key authentication header.",
    });
  }

  next();
}
