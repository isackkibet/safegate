"use client";

import { useEffect, useState } from "react";
import type { Order, Rider } from "@safegate/shared-types";
import { api } from "@/lib/api";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [packageDesc, setPackageDesc] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [assignedRider, setAssignedRider] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [ordersData, ridersData] = await Promise.all([
          api.getOrders(),
          api.getRiders(),
        ]);
        setOrders(ordersData);
        setRiders(ridersData);
      } catch (err) {
        console.error("Failed to load orders page data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId || !amount) {
      alert("Order ID and Amount are required");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const newOrder = await api.createOrder({
        id: orderId.trim(),
        amount: parseFloat(amount),
        currency,
        packageDescription: packageDesc.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
        recipientAddress: recipientAddress.trim() || undefined,
        riderDid: assignedRider || undefined,
      });

      setOrders((prev) => [newOrder, ...prev]);

      // Reset form
      setOrderId("");
      setAmount("");
      setPackageDesc("");
      setRecipientName("");
      setRecipientAddress("");
      setAssignedRider("");

      setMessage("Order created successfully!");
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ color: "var(--text-secondary)" }}>Loading Order Manifest...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "30px" }}>
      <div className="form-panel">
        <div className="card">
          <div className="card-title">Register New Order</div>
          <form onSubmit={handleCreateOrder}>
            <div className="form-group">
              <label>Order ID / Reference</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. ORD-001, ORD-993"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label>Order Amount</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select
                  className="form-control"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Assign Delivery Rider</label>
              <select
                className="form-control"
                value={assignedRider}
                onChange={(e) => setAssignedRider(e.target.value)}
              >
                <option value="">-- Unassigned (Pending Rider) --</option>
                {riders.map((r) => (
                  <option key={r.did} value={r.did}>
                    {r.name} ({r.did.substring(0, 15)}...)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Package Description</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Electronics, Documents"
                value={packageDesc}
                onChange={(e) => setPackageDesc(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Recipient Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Jane Doe"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Delivery Address</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Mombasa Road, Nairobi"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
              />
            </div>

            <button type="submit" className="btn" style={{ width: "100%" }} disabled={submitting}>
              {submitting ? "Processing..." : "Create Order Entry"}
            </button>

            {message && (
              <p
                style={{
                  marginTop: "16px",
                  fontSize: "13px",
                  textAlign: "center",
                  color: message.includes("success") ? "var(--accent-emerald)" : "var(--accent-rose)",
                }}
              >
                {message}
              </p>
            )}
          </form>
        </div>
      </div>

      <div className="list-panel">
        <div className="card">
          <div className="card-title">Active Order Manifest</div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Assigned Rider</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "30px 0" }}>
                      No orders registered. Use the left form to create one.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const statusClass =
                      o.status === "ASSIGNED"
                        ? "badge badge-approved"
                        : o.status === "DELIVERED"
                        ? "badge badge-approved"
                        : "badge badge-pending";

                    const assigned = riders.find((r) => r.did === o.riderDid);

                    return (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600 }}>{o.id}</td>
                        <td>
                          <span className={statusClass}>{o.status}</span>
                        </td>
                        <td>{o.amount.toLocaleString()} {o.currency}</td>
                        <td style={{ fontSize: "11px", color: "var(--text-secondary)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {assigned ? assigned.name : <em style={{ color: "var(--text-muted)" }}>None</em>}
                        </td>
                        <td>{o.packageDescription || "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
