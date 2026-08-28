"use client";

import { useEffect, useState } from "react";
import type { AuditEntry } from "@safegate/shared-types";
import { api } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";

export default function DecisionFeed() {
  const [decisions, setDecisions] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial logs
  useEffect(() => {
    async function loadLogs() {
      try {
        const logs = await api.getAuditLogs();
        // Keep top 15 for dashboard display
        setDecisions(logs.slice(0, 15));
      } catch (err) {
        console.error("Failed to load initial audit logs:", err);
        setError("Failed to fetch event history");
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  // Listen to live events via Server-Sent Events (SSE)
  useEffect(() => {
    const sse = new EventSource(`${BACKEND_URL}/events`);

    sse.addEventListener("AUDIT_LOGGED", (event) => {
      try {
        const payload = JSON.parse(event.data) as AuditEntry;
        setDecisions((prev) => [payload, ...prev.slice(0, 14)]);
      } catch (err) {
        console.error("Error parsing live audit log event:", err);
      }
    });

    sse.onerror = (err) => {
      console.warn("SSE EventSource encountered error: connection may be retrying.", err);
    };

    return () => {
      sse.close();
    };
  }, []);

  if (loading) return <div style={{ color: "var(--text-secondary)" }}>Loading live event stream...</div>;
  if (error) return <div style={{ color: "var(--accent-rose)" }}>{error}</div>;

  return (
    <div className="feed-list">
      {decisions.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
          No validation decisions logged yet. Simulation events will appear here in real-time.
        </div>
      ) : (
        decisions.map((item) => {
          const isApproved = item.decision === "APPROVED";
          const badgeClass = isApproved ? "badge badge-approved" : "badge badge-denied";

          return (
            <div key={item.id} className="feed-item">
              <div className="feed-header">
                <span className={badgeClass}>{item.decision}</span>
                <span className="feed-meta" style={{ fontSize: "11px" }}>
                  {new Date(item.createdAt).toLocaleTimeString()}
                </span>
              </div>

              <div>
                <p style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>
                  Order: {item.orderId}
                </p>
                <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Rider DID: {item.riderDid}
                </p>
              </div>

              <div className="feed-body">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  <span>Requested Action: <strong style={{ color: "var(--text-primary)" }}>{item.action}</strong></span>
                </div>
                {!isApproved && item.reason && (
                  <p style={{ color: "var(--accent-rose)", fontSize: "12px", marginTop: "4px", fontWeight: 500 }}>
                    ⚠️ {item.reason}
                  </p>
                )}

                <div className="checks-grid">
                  {Object.entries(item.checks).map(([checkName, checkValue]) => {
                    // Normalize display of vcStatus
                    let isPass = false;
                    let displayValue = String(checkValue);

                    if (checkName === "vcStatus") {
                      isPass = checkValue === "ACTIVE";
                      displayValue = `VC Status: ${checkValue}`;
                    } else {
                      isPass = !!checkValue;
                      // Convert camelCase to human readable title
                      const title = checkName
                        .replace(/([A-Z])/g, " $1")
                        .toLowerCase()
                        .replace(/^./, (str) => str.toUpperCase());
                      displayValue = `${title}: ${isPass ? "PASS" : "FAIL"}`;
                    }

                    return (
                      <div key={checkName} className={`check-pill ${isPass ? "pass" : "fail"}`}>
                        <span className="check-indicator"></span>
                        <span>{displayValue}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
