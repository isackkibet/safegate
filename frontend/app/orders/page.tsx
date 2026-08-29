"use client";

import { useEffect, useState } from "react";
import type { Order, Rider } from "@safegate/shared-types";
import { api } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  ASSIGNED:  "badge badge-approved",
  DELIVERED: "badge badge-active",
  PENDING:   "badge badge-pending",
  CANCELLED: "badge badge-denied",
};

export default function OrdersPage() {
  const [orders,    setOrders]    = useState<Order[]>([]);
  const [riders,    setRiders]    = useState<Rider[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message,   setMessage]   = useState<{ text: string; ok: boolean } | null>(null);

  // form state
  const [orderId,           setOrderId]           = useState("");
  const [amount,            setAmount]            = useState("");
  const [currency,          setCurrency]          = useState("KES");
  const [packageDesc,       setPackageDesc]       = useState("");
  const [recipientName,     setRecipientName]     = useState("");
  const [recipientAddress,  setRecipientAddress]  = useState("");
  const [assignedRider,     setAssignedRider]     = useState("");

  useEffect(() => {
    Promise.all([api.getOrders(), api.getRiders()])
      .then(([o, r]) => { setOrders(o); setRiders(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const o = await api.createOrder({
        id: orderId.trim(), amount: parseFloat(amount), currency,
        packageDescription: packageDesc.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
        recipientAddress: recipientAddress.trim() || undefined,
        riderDid: assignedRider || undefined,
      });
      setOrders(prev => [o, ...prev]);
      setOrderId(""); setAmount(""); setPackageDesc("");
      setRecipientName(""); setRecipientAddress(""); setAssignedRider("");
      setMessage({ text: "Order created successfully.", ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Failed to create order", ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="loading-state">Loading orders…</div>;

  return (
    <div>
      <div className="page-title">Orders Registry</div>
      <div className="page-sub">Create and manage delivery orders</div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Create form ── */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">📦 New Order</div>
          </div>

          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Order ID</label>
              <input className="form-control" placeholder="e.g. ORD-006"
                value={orderId} onChange={e => setOrderId(e.target.value)} required />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label>Amount</label>
                <input className="form-control" type="number" placeholder="5000"
                  value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select className="form-control" value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option>KES</option>
                  <option>USD</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Assign Rider</label>
              <select className="form-control" value={assignedRider} onChange={e => setAssignedRider(e.target.value)}>
                <option value="">— Unassigned —</option>
                {riders.map(r => (
                  <option key={r.did} value={r.did}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Package</label>
              <input className="form-control" placeholder="e.g. Electronics, Documents"
                value={packageDesc} onChange={e => setPackageDesc(e.target.value)} />
            </div>

            <div className="form-group">
              <label>Recipient Name</label>
              <input className="form-control" placeholder="e.g. Jane Doe"
                value={recipientName} onChange={e => setRecipientName(e.target.value)} />
            </div>

            <div className="form-group">
              <label>Delivery Address</label>
              <input className="form-control" placeholder="e.g. Westlands, Nairobi"
                value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} />
            </div>

            <button className="btn" style={{ width: "100%" }} disabled={submitting}>
              {submitting ? "Creating…" : "Create Order"}
            </button>

            {message && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 6, fontSize: 12,
                background: message.ok ? "var(--emerald-dim)" : "var(--rose-dim)",
                color: message.ok ? "var(--emerald)" : "var(--rose)",
                border: `1px solid ${message.ok ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)"}`,
              }}>
                {message.ok ? "✓" : "✗"} {message.text}
              </div>
            )}
          </form>
        </div>

        {/* ── Orders table ── */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">📋 Order Manifest</div>
            <span className="badge badge-info">{orders.length} orders</span>
          </div>

          {orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No orders yet. Create one on the left.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Recipient</th>
                    <th>Assigned Rider</th>
                    <th>Package</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const rider = riders.find(r => r.did === o.riderDid);
                    return (
                      <tr key={o.id}>
                        <td><strong>{o.id}</strong></td>
                        <td><span className={STATUS_BADGE[o.status] ?? "badge badge-pending"}>{o.status}</span></td>
                        <td><strong>{o.amount.toLocaleString()}</strong> <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{o.currency}</span></td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{o.recipientName || <em style={{ color: "var(--text-muted)" }}>—</em>}</div>
                          {o.recipientAddress && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.recipientAddress}</div>}
                        </td>
                        <td>
                          {rider
                            ? <div>
                                <div style={{ fontWeight: 500 }}>{rider.name}</div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{rider.did.slice(0, 22)}…</div>
                              </div>
                            : <em style={{ color: "var(--text-muted)", fontSize: 12 }}>Unassigned</em>
                          }
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>{o.packageDescription || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
