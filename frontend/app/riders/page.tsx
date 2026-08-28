"use client";

import { useEffect, useState } from "react";
import type { Rider, VCStatus } from "@safegate/shared-types";
import { api } from "@/lib/api";

interface RiderWithCredential extends Rider {
  credentialStatus: VCStatus | "UNKNOWN" | "EXPIRED" | "NONE";
  vc?: any;
}

export default function RidersPage() {
  const [riders, setRiders] = useState<RiderWithCredential[]>([]);
  const [loading, setLoading] = useState(true);

  // Rider registration form
  const [did, setDid] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [registering, setRegistering] = useState(false);

  // Credential issuance modal/state per rider
  const [issuingForDid, setIssuingForDid] = useState<string | null>(null);
  const [maxAmount, setMaxAmount] = useState("50000");
  const [permissions, setPermissions] = useState<string[]>(["COLLECT_COD", "RELEASE_PACKAGE"]);
  const [issuing, setIssuing] = useState(false);

  // Load riders and their credentials
  async function loadRiders() {
    try {
      const ridersList = await api.getRiders();
      const detailedRiders: RiderWithCredential[] = await Promise.all(
        ridersList.map(async (r) => {
          try {
            const cred = await api.getRiderCredential(r.did);
            return {
              ...r,
              credentialStatus: cred.status as any,
              vc: cred.vc,
            };
          } catch {
            return {
              ...r,
              credentialStatus: "NONE",
            };
          }
        })
      );
      setRiders(detailedRiders);
    } catch (err) {
      console.error("Failed to load riders list:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRiders();
  }, []);

  async function handleRegisterRider(e: React.FormEvent) {
    e.preventDefault();
    if (!did || !name || !phone) {
      alert("All fields are required");
      return;
    }

    setRegistering(true);
    try {
      await api.createRider({
        did: did.trim(),
        name: name.trim(),
        phone: phone.trim(),
      });

      setDid("");
      setName("");
      setPhone("");

      await loadRiders();
      alert("Rider registered successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to register rider");
    } finally {
      setRegistering(false);
    }
  }

  async function handleIssueCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!issuingForDid) return;

    setIssuing(true);
    try {
      await api.issueCredential(issuingForDid, {
        permissions,
        maxAmount: parseFloat(maxAmount),
        currency: "KES",
      });

      setIssuingForDid(null);
      await loadRiders();
      alert("W3C Verifiable Credential issued successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to issue credential");
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevokeCredential(riderDid: string) {
    if (!confirm("Are you sure you want to revoke this rider's active credential?")) return;

    try {
      await api.revokeCredential(riderDid);
      await loadRiders();
      alert("Credential revoked successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke credential");
    }
  }

  function togglePermission(perm: string) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  if (loading) return <div style={{ color: "var(--text-secondary)" }}>Loading Rider Registry...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "30px" }}>
      <div className="form-panel">
        <div className="card">
          <div className="card-title">Register Rider Node</div>
          <form onSubmit={handleRegisterRider}>
            <div className="form-group">
              <label>Rider W3C DID (did:key)</label>
              <input
                type="text"
                className="form-control"
                placeholder="did:key:z6Mk..."
                value={did}
                onChange={(e) => setDid(e.target.value)}
                required
              />
              <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                Decentralized Identifier for cryptographic key validation.
              </p>
            </div>

            <div className="form-group">
              <label>Rider Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. John Kamau"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. +254 700 000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn" style={{ width: "100%" }} disabled={registering}>
              {registering ? "Registering..." : "Add Rider to Node"}
            </button>
          </form>
        </div>

        {issuingForDid && (
          <div className="card" style={{ border: "1px solid var(--accent-purple)" }}>
            <div className="card-title">Issue Delivery VC</div>
            <form onSubmit={handleIssueCredential}>
              <div className="form-group">
                <label>Max Authorized Amount (KES)</label>
                <input
                  type="number"
                  className="form-control"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Authorized Permissions</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", textTransform: "none", fontSize: "13px", color: "var(--text-primary)" }}>
                    <input
                      type="checkbox"
                      checked={permissions.includes("COLLECT_COD")}
                      onChange={() => togglePermission("COLLECT_COD")}
                    />
                    Collect Cash-on-Delivery (COLLECT_COD)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", textTransform: "none", fontSize: "13px", color: "var(--text-primary)" }}>
                    <input
                      type="checkbox"
                      checked={permissions.includes("RELEASE_PACKAGE")}
                      onChange={() => togglePermission("RELEASE_PACKAGE")}
                    />
                    Release Package (RELEASE_PACKAGE)
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button type="submit" className="btn" disabled={issuing}>
                  {issuing ? "Signing..." : "Sign & Issue VC"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIssuingForDid(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="list-panel">
        <div className="card">
          <div className="card-title">Riders & Credential Registry</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {riders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                No delivery riders registered in node.
              </div>
            ) : (
              riders.map((r) => {
                const status = r.credentialStatus;
                const statusClass =
                  status === "ACTIVE"
                    ? "badge badge-approved"
                    : status === "REVOKED" || status === "EXPIRED"
                    ? "badge badge-denied"
                    : "badge badge-pending";

                return (
                  <div
                    key={r.did}
                    style={{
                      border: "1px solid var(--border-color)",
                      padding: "20px",
                      borderRadius: "8px",
                      background: "var(--bg-secondary)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div>
                        <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>{r.name}</h3>
                        <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Phone: {r.phone}</p>
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace", marginTop: "4px" }}>
                          DID: {r.did}
                        </p>
                      </div>
                      <span className={statusClass}>
                        {status === "NONE" ? "No Credential" : `VC: ${status}`}
                      </span>
                    </div>

                    {status === "ACTIVE" && r.vc && (
                      <div
                        style={{
                          background: "var(--bg-primary)",
                          padding: "12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          border: "1px solid var(--border-color)",
                          marginBottom: "16px",
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <div>
                            <span style={{ color: "var(--text-secondary)" }}>Max Amount:</span>{" "}
                            <strong>
                              {r.vc.credentialSubject.maxAmount.toLocaleString()}{" "}
                              {r.vc.credentialSubject.currency}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-secondary)" }}>Permissions:</span>{" "}
                            <span style={{ fontFamily: "monospace", fontSize: "11px" }}>
                              {r.vc.credentialSubject.permissions.join(", ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "12px", padding: "8px 16px" }}
                        onClick={() => {
                          setIssuingForDid(r.did);
                          // Reset template params
                          if (r.vc) {
                            setMaxAmount(String(r.vc.credentialSubject.maxAmount));
                            setPermissions(r.vc.credentialSubject.permissions);
                          }
                        }}
                      >
                        {status === "ACTIVE" ? "Re-Issue VC" : "Issue W3C VC"}
                      </button>

                      {status === "ACTIVE" && (
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: "12px", padding: "8px 16px" }}
                          onClick={() => handleRevokeCredential(r.did)}
                        >
                          Revoke VC
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
