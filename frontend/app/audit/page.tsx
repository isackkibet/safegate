"use client";

import { useEffect, useState } from "react";
import type { AuditEntry } from "@safegate/shared-types";
import { api } from "@/lib/api";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter criteria
  const [orderIdFilter, setOrderIdFilter] = useState("");
  const [riderDidFilter, setRiderDidFilter] = useState("");

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await api.getAuditLogs({
        orderId: orderIdFilter.trim() || undefined,
        riderDid: riderDidFilter.trim() || undefined,
      });
      setLogs(data);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadLogs();
  }

  function handleReset() {
    setOrderIdFilter("");
    setRiderDidFilter("");
    // Load fresh logs without filters
    setLoading(true);
    api.getAuditLogs().then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">Filter Audit Ledger</div>
        <form onSubmit={handleFilterSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "20px", alignItems: "end" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Search Order ID</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. ORD-001"
              value={orderIdFilter}
              onChange={(e) => setOrderIdFilter(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Search Rider DID</label>
            <input
              type="text"
              className="form-control"
              placeholder="did:key:z6Mk..."
              value={riderDidFilter}
              onChange={(e) => setRiderDidFilter(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="submit" className="btn">Search Logs</button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>Reset</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-title">Append-Only Cryptographic Audit Ledger</div>
        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-secondary)" }}>
            Querying audit history...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
            No matching audit logs found in registry node.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Order Reference</th>
                  <th>Rider DID</th>
                  <th>Action</th>
                  <th>Verdict</th>
                  <th>Detailed Check Failure Reason</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isApproved = log.decision === "APPROVED";
                  const badgeClass = isApproved ? "badge badge-approved" : "badge badge-denied";

                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.orderId}</td>
                      <td style={{ fontSize: "11px", fontFamily: "monospace", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.riderDid}
                      </td>
                      <td>{log.action}</td>
                      <td>
                        <span className={badgeClass}>{log.decision}</span>
                      </td>
                      <td style={{ fontSize: "12px", color: isApproved ? "var(--text-secondary)" : "var(--accent-rose)", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isApproved ? "✓ All validations passed" : `❌ ${log.reason}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
