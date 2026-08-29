"use client";

import { useEffect, useState } from "react";
import type { AuditEntry } from "@safegate/shared-types";
import { api } from "@/lib/api";
import DecisionFeed from "@/components/DecisionFeed";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalOrders:  0,
    totalRiders:  0,
    totalAudits:  0,
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
          totalOrders:  orders.length,
          totalRiders:  riders.length,
          totalAudits:  audits.length,
          approvedCount: approved,
        });
      } catch {}
    }
    loadStats();

    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";
    const sse = new EventSource(`${BACKEND_URL}/events`);
    const refresh = () => loadStats();
    ["ORDER_CREATED","ORDER_UPDATED","RIDER_CREATED","CREDENTIAL_ISSUED","CREDENTIAL_REVOKED","AUDIT_LOGGED"]
      .forEach(e => sse.addEventListener(e, refresh));
    return () => sse.close();
  }, []);

  const passRate = stats.totalAudits > 0
    ? Math.round((stats.approvedCount / stats.totalAudits) * 100)
    : 0;

  return (
    <div>
      <div className="page-title">Overview</div>
      <div className="page-sub">Real-time delivery authorization metrics</div>

      {/* ── Stat cards ── */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon purple">📦</div>
          <div className="stat-label">Total Orders</div>
          <div className="stat-value">{stats.totalOrders}</div>
          <Link href="/orders" className="stat-link">View manifest →</Link>
        </div>

        <div className="stat-card blue">
          <div className="stat-icon blue">🛵</div>
          <div className="stat-label">Active Riders</div>
          <div className="stat-value">{stats.totalRiders}</div>
          <Link href="/riders" className="stat-link">Manage VCs →</Link>
        </div>

        <div className="stat-card amber">
          <div className="stat-icon amber">🔐</div>
          <div className="stat-label">Authorizations</div>
          <div className="stat-value">{stats.totalAudits}</div>
          <div className="stat-sub">Total guardian checks</div>
        </div>

        <div className="stat-card emerald">
          <div className="stat-icon emerald">✓</div>
          <div className="stat-label">Pass Rate</div>
          <div className={`stat-value ${passRate >= 70 ? "emerald" : passRate > 0 ? "amber" : ""}`}>
            {passRate}%
          </div>
          <div className="stat-sub">{stats.approvedCount} approved decisions</div>
        </div>
      </div>

      {/* ── Content grid ── */}
      <div className="section-grid">
        {/* Live feed */}
        <div className="card" style={{ marginBottom: 0, minHeight: 420 }}>
          <div className="card-header">
            <div className="card-title">
              <span>🔴</span> Live Authorization Feed
            </div>
            <span className="badge badge-info">SSE Stream</span>
          </div>
          <DecisionFeed />
        </div>

        {/* Scenarios */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">
              <span>⚡</span> Test Scenarios
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
            Trigger these scenarios via the AI agent to test SafeGate's security checks.
          </p>
          <div className="scenario-list">
            <div className="scenario-item">
              <div className="scenario-num">Scenario 01</div>
              <div className="scenario-title">Valid Credential</div>
              <div className="scenario-desc">
                "Rider did:key:z6Mk... requesting COD collection for ORD-001"
              </div>
            </div>
            <div className="scenario-item">
              <div className="scenario-num">Scenario 02</div>
              <div className="scenario-title">Amount Over Limit</div>
              <div className="scenario-desc">
                "Collect KES 75,000 for ORD-002 — rider limit is 50,000"
              </div>
            </div>
            <div className="scenario-item">
              <div className="scenario-num">Scenario 03</div>
              <div className="scenario-title">Revoked Credential</div>
              <div className="scenario-desc">
                Revoke a VC in Riders, then attempt — request is instantly denied.
              </div>
            </div>
            <div className="scenario-item">
              <div className="scenario-num">Scenario 04</div>
              <div className="scenario-title">Unassigned Rider</div>
              <div className="scenario-desc">
                "Rider tries to collect for an order they are not assigned to"
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <Link href="/orders" className="btn btn-secondary" style={{ fontSize: 12, padding: "7px 14px" }}>
              + New Order
            </Link>
            <Link href="/riders" className="btn btn-secondary" style={{ fontSize: 12, padding: "7px 14px" }}>
              + Register Rider
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
