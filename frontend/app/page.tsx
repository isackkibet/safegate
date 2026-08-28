"use client";

import { useEffect, useState } from "react";
import type { Order, Rider, AuditEntry } from "@safegate/shared-types";
import { api } from "@/lib/api";
import DecisionFeed from "@/components/DecisionFeed";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRiders: 0,
    totalAudits: 0,
    approvedCount: 0,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const [orders, riders, audits] = await Promise.all([
          api.getOrders(),
          api.getRiders(),
          api.getAuditLogs(),
        ]);

        const approved = audits.filter((a) => a.decision === "APPROVED").length;

        setStats({
          totalOrders: orders.length,
          totalRiders: riders.length,
          totalAudits: audits.length,
          approvedCount: approved,
        });
      } catch (err) {
        console.error("Failed to load dashboard statistics:", err);
      }
    }
    loadStats();

    // Setup an SSE connection for stats updates
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";
    const sse = new EventSource(`${BACKEND_URL}/events`);

    const handleUpdate = () => {
      loadStats();
    };

    sse.addEventListener("ORDER_CREATED", handleUpdate);
    sse.addEventListener("ORDER_UPDATED", handleUpdate);
    sse.addEventListener("RIDER_CREATED", handleUpdate);
    sse.addEventListener("CREDENTIAL_ISSUED", handleUpdate);
    sse.addEventListener("CREDENTIAL_REVOKED", handleUpdate);
    sse.addEventListener("AUDIT_LOGGED", handleUpdate);

    return () => {
      sse.close();
    };
  }, []);

  return (
    <div>
      <div className="stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "30px" }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Total Registered Orders</div>
          <div style={{ fontSize: "36px", fontWeight: 800, marginTop: "8px" }}>{stats.totalOrders}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            <Link href="/orders" style={{ color: "var(--accent-purple)", textDecoration: "none", fontWeight: 500 }}>View order manifest →</Link>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Registered Delivery Riders</div>
          <div style={{ fontSize: "36px", fontWeight: 800, marginTop: "8px" }}>{stats.totalRiders}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            <Link href="/riders" style={{ color: "var(--accent-purple)", textDecoration: "none", fontWeight: 500 }}>Issue or view VCs →</Link>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Processed Authorizations</div>
          <div style={{ fontSize: "36px", fontWeight: 800, marginTop: "8px" }}>{stats.totalAudits}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Total requests sent to the Guardian node
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Verification Pass Rate</div>
          <div style={{ fontSize: "36px", fontWeight: 800, marginTop: "8px", color: "var(--accent-emerald)" }}>
            {stats.totalAudits > 0 ? `${Math.round((stats.approvedCount / stats.totalAudits) * 100)}%` : "0%"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            {stats.approvedCount} approved decisions
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="left-panel">
          <div className="card" style={{ minHeight: "450px" }}>
            <div className="card-title">
              <span>Live Authorization Log</span>
              <span className="badge badge-pending">Active Stream</span>
            </div>
            <DecisionFeed />
          </div>
        </div>

        <div className="right-panel">
          <div className="card">
            <div className="card-title">Simulator Scenarios</div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              Test SafeGate's security guarantees by triggering delivery authorization messages.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ padding: "12px", background: "var(--bg-secondary)", borderRadius: "6px", fontSize: "12px", border: "1px solid var(--border-color)" }}>
                <strong>Scenario 1: Valid VC</strong>
                <p style={{ color: "var(--text-secondary)", fontStyle: "italic", marginTop: "4px" }}>
                  "Rider did:key:z6Mk... requesting cash-on-delivery collection for ORD-001"
                </p>
              </div>
              <div style={{ padding: "12px", background: "var(--bg-secondary)", borderRadius: "6px", fontSize: "12px", border: "1px solid var(--border-color)" }}>
                <strong>Scenario 2: Over Limit</strong>
                <p style={{ color: "var(--text-secondary)", fontStyle: "italic", marginTop: "4px" }}>
                  "Collect KES 75000 for ORD-002, rider limit is only 50000"
                </p>
              </div>
              <div style={{ padding: "12px", background: "var(--bg-secondary)", borderRadius: "6px", fontSize: "12px", border: "1px solid var(--border-color)" }}>
                <strong>Scenario 3: Revoked VC</strong>
                <p style={{ color: "var(--text-secondary)", fontStyle: "italic", marginTop: "4px" }}>
                  "Revoke credential in riders menu, request is denied immediately"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
