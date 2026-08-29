"use client";

import { useEffect, useState } from "react";
import type { AuditEntry } from "@safegate/shared-types";
import { api } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";

export default function DecisionFeed() {
  const [decisions, setDecisions] = useState<AuditEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    api.getAuditLogs()
      .then((logs) => setDecisions(logs.slice(0, 15)))
      .catch(() => setError("Failed to load audit history"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const sse = new EventSource(`${BACKEND_URL}/events`);
    sse.addEventListener("AUDIT_LOGGED", (e) => {
      try {
        const entry = JSON.parse(e.data) as AuditEntry;
        setDecisions((prev) => [entry, ...prev.slice(0, 14)]);
      } catch {}
    });
    sse.onerror = () => {};
    return () => sse.close();
  }, []);

  if (loading) return <div className="loading-state">Loading live stream…</div>;
  if (error)   return <div style={{ color: "var(--rose)", fontSize: 13 }}>{error}</div>;

  if (decisions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <p>No authorization events yet.</p>
        <p style={{ fontSize: 12 }}>Events will appear here in real-time as the AI agent processes requests.</p>
      </div>
    );
  }

  return (
    <div className="feed-list">
      {decisions.map((item) => {
        const ok = item.decision === "APPROVED";
        return (
          <div key={item.id} className="feed-item">
            <div className="feed-header">
              <span className={ok ? "badge badge-approved" : "badge badge-denied"}>
                {item.decision}
              </span>
              <span className="feed-time">
                {new Date(item.createdAt).toLocaleTimeString()}
              </span>
            </div>

            <div>
              <div className="feed-order">Order: {item.orderId}</div>
              <div className="feed-did">{item.riderDid}</div>
            </div>

            <div className="feed-body">
              <div className="feed-action">
                Action: <strong>{item.action}</strong>
              </div>

              {!ok && item.reason && (
                <div className="feed-reason">⚠ {item.reason}</div>
              )}

              <div className="checks-grid">
                {Object.entries(item.checks).map(([key, val]) => {
                  let isPass = false;
                  let label  = key;

                  if (key === "vcStatus") {
                    isPass = val === "ACTIVE";
                    label  = `VC: ${val}`;
                  } else {
                    isPass = !!val;
                    label  = key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase());
                  }

                  return (
                    <div key={key} className={`check-pill ${isPass ? "pass" : "fail"}`}>
                      <span className="check-dot" />
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
