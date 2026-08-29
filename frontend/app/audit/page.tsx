"use client";

import { useEffect, useState } from "react";
import type { AuditEntry } from "@safegate/shared-types";
import { api } from "@/lib/api";

export default function AuditPage() {
  const [logs,    setLogs]    = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [orderIdFilter,  setOrderIdFilter]  = useState("");
  const [riderDidFilter, setRiderDidFilter] = useState("");

  async function loadLogs(orderId?: string, riderDid?: string) {
    setLoading(true);
    try {
      const data = await api.getAuditLogs({
        orderId:  orderId  ?? undefined,
        riderDid: riderDid ?? undefined,
      });
      setLogs(data);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { loadLogs(); }, []);

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    loadLogs(orderIdFilter.trim(), riderDidFilter.trim());
  }

  function handleReset() {
    setOrderIdFilter(""); setRiderDidFilter("");
    loadLogs();
  }

  const approved = logs.filter(l => l.decision === "APPROVED").length;
  const denied   = logs.length - approved;

  return (
    <div>
      <div className="page-title">Audit Ledger</div>
      <div className="page-sub">Append-only cryptographic authorization history</div>

      {/* summary pills */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)" }}>Total  </span>
          <strong>{logs.length}</strong>
        </div>
        <div style={{ padding: "8px 16px", borderRadius: 8, background: "var(--emerald-dim)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 13, color: "var(--emerald)" }}>
          ✓ Approved: <strong>{approved}</strong>
        </div>
        <div style={{ padding: "8px 16px", borderRadius: 8, background: "var(--rose-dim)", border: "1px solid rgba(244,63,94,0.2)", fontSize: 13, color: "var(--rose)" }}>
          ✗ Denied: <strong>{denied}</strong>
        </div>
      </div>

      {/* Filter */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🔍 Filter</div>
        </div>
        <form onSubmit={handleFilter} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Order ID</label>
            <input className="form-control" placeholder="e.g. ORD-001"
              value={orderIdFilter} onChange={e => setOrderIdFilter(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Rider DID</label>
            <input className="form-control" placeholder="did:key:z6Mk…"
              value={riderDidFilter} onChange={e => setRiderDidFilter(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="submit">Search</button>
            <button className="btn btn-secondary" type="button" onClick={handleReset}>Reset</button>
          </div>
        </form>
      </div>

      {/* Log entries */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">📜 Authorization Log</div>
          <span className="badge badge-info">{logs.length} entries</span>
        </div>

        {loading ? (
          <div className="loading-state">Loading audit history…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No audit entries match your filter.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {logs.map(log => {
              const ok = log.decision === "APPROVED";
              const isOpen = expanded === log.id;
              return (
                <div key={log.id} style={{
                  border: `1px solid ${ok ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.18)"}`,
                  borderRadius: 8, overflow: "hidden",
                  background: "var(--bg-secondary)",
                }}>
                  {/* Row header */}
                  <div
                    style={{ display: "grid", gridTemplateColumns: "110px 90px 100px 160px 1fr 28px", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(log.createdAt).toLocaleTimeString()}<br/>
                      <span style={{ fontSize: 10 }}>{new Date(log.createdAt).toLocaleDateString()}</span>
                    </div>
                    <span className={ok ? "badge badge-approved" : "badge badge-denied"}>{log.decision}</span>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{log.orderId}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.riderDid.slice(0, 20)}…
                    </div>
                    <div style={{ fontSize: 12, color: ok ? "var(--text-secondary)" : "var(--rose)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ok ? <span style={{ color: "var(--emerald)" }}>✓ All checks passed</span> : `✗ ${log.reason}`}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
                      {isOpen ? "▲" : "▼"}
                    </div>
                  </div>

                  {/* Expanded checks */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", background: "var(--bg-primary)" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                        Action: <strong style={{ color: "var(--text-primary)" }}>{log.action}</strong>
                        &nbsp;·&nbsp;
                        Rider DID: <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{log.riderDid}</span>
                      </div>
                      <div className="checks-grid">
                        {Object.entries(log.checks).map(([key, val]) => {
                          let isPass = key === "vcStatus" ? val === "ACTIVE" : !!val;
                          let label  = key === "vcStatus"
                            ? `VC Status: ${val}`
                            : key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                          return (
                            <div key={key} className={`check-pill ${isPass ? "pass" : "fail"}`}>
                              <span className="check-dot" />
                              <span>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
