"use client";

import { useEffect, useState } from "react";
import type { Rider, VCStatus } from "@safegate/shared-types";
import { api } from "@/lib/api";

interface RiderWithVC extends Rider {
  credentialStatus: VCStatus | "UNKNOWN" | "EXPIRED" | "NONE";
  vc?: any;
}

const VC_BADGE: Record<string, string> = {
  ACTIVE:  "badge badge-approved",
  REVOKED: "badge badge-denied",
  EXPIRED: "badge badge-denied",
  UNKNOWN: "badge badge-pending",
  NONE:    "badge badge-pending",
};

const VC_LABEL: Record<string, string> = {
  ACTIVE:  "VC Active",
  REVOKED: "VC Revoked",
  EXPIRED: "VC Expired",
  UNKNOWN: "No VC",
  NONE:    "No VC",
};

export default function RidersPage() {
  const [riders,      setRiders]      = useState<RiderWithVC[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [registering, setRegistering] = useState(false);
  const [issuing,     setIssuing]     = useState(false);

  // Register form
  const [did,   setDid]   = useState("");
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [regMsg, setRegMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Issue VC panel
  const [issuingForDid, setIssuingForDid] = useState<string | null>(null);
  const [maxAmount,     setMaxAmount]     = useState("50000");
  const [permissions,   setPermissions]   = useState<string[]>(["COLLECT_COD", "RELEASE_PACKAGE"]);

  async function loadRiders() {
    try {
      const list = await api.getRiders();
      const detailed: RiderWithVC[] = await Promise.all(
        list.map(async (r) => {
          try {
            const cred = await api.getRiderCredential(r.did);
            return { ...r, credentialStatus: cred.status as any, vc: cred.vc };
          } catch {
            return { ...r, credentialStatus: "NONE" as const };
          }
        })
      );
      setRiders(detailed);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { loadRiders(); }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true); setRegMsg(null);
    try {
      await api.createRider({ did: did.trim(), name: name.trim(), phone: phone.trim() });
      setDid(""); setName(""); setPhone("");
      setRegMsg({ text: "Rider registered successfully.", ok: true });
      await loadRiders();
    } catch (err) {
      setRegMsg({ text: err instanceof Error ? err.message : "Failed to register", ok: false });
    } finally { setRegistering(false); }
  }

  async function handleIssueVC(e: React.FormEvent) {
    e.preventDefault();
    if (!issuingForDid) return;
    setIssuing(true);
    try {
      await api.issueCredential(issuingForDid, {
        permissions, maxAmount: parseFloat(maxAmount), currency: "KES",
      });
      setIssuingForDid(null);
      await loadRiders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to issue VC");
    } finally { setIssuing(false); }
  }

  async function handleRevoke(did: string, name: string) {
    if (!confirm(`Revoke credential for ${name}?`)) return;
    try {
      await api.revokeCredential(did);
      await loadRiders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke");
    }
  }

  function togglePerm(p: string) {
    setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  if (loading) return <div className="loading-state">Loading rider registry…</div>;

  return (
    <div>
      <div className="page-title">Riders & Credentials</div>
      <div className="page-sub">Register riders and manage their W3C Verifiable Credentials</div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Left: Register + Issue panels ── */}
        <div>
          {/* Register */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🛵 Register Rider</div>
            </div>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>W3C DID</label>
                <input className="form-control" placeholder="did:key:z6Mk…"
                  value={did} onChange={e => setDid(e.target.value)} required />
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                  Decentralized Identifier — used for cryptographic verification
                </div>
              </div>
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-control" placeholder="e.g. James Kamau"
                  value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-control" placeholder="+254 712 345 678"
                  value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
              <button className="btn" style={{ width: "100%" }} disabled={registering}>
                {registering ? "Registering…" : "Add to Registry"}
              </button>
              {regMsg && (
                <div style={{
                  marginTop: 10, padding: "9px 12px", borderRadius: 6, fontSize: 12,
                  background: regMsg.ok ? "var(--emerald-dim)" : "var(--rose-dim)",
                  color: regMsg.ok ? "var(--emerald)" : "var(--rose)",
                  border: `1px solid ${regMsg.ok ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)"}`,
                }}>
                  {regMsg.ok ? "✓" : "✗"} {regMsg.text}
                </div>
              )}
            </form>
          </div>

          {/* Issue VC panel — shown when a rider is selected */}
          {issuingForDid && (
            <div className="card" style={{ border: "1px solid var(--border-active)" }}>
              <div className="card-header">
                <div className="card-title">🔏 Issue Verifiable Credential</div>
                <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }}
                  onClick={() => setIssuingForDid(null)}>✕</button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14, fontFamily: "monospace", wordBreak: "break-all" }}>
                {issuingForDid}
              </div>
              <form onSubmit={handleIssueVC}>
                <div className="form-group">
                  <label>Max Collection Amount (KES)</label>
                  <input className="form-control" type="number"
                    value={maxAmount} onChange={e => setMaxAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Permissions</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                    {["COLLECT_COD", "RELEASE_PACKAGE", "COLLECT_AND_RELEASE"].map(p => (
                      <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", textTransform: "none", letterSpacing: 0, color: "var(--text-primary)", fontWeight: 400 }}>
                        <input type="checkbox" checked={permissions.includes(p)} onChange={() => togglePerm(p)}
                          style={{ accentColor: "var(--purple)", width: 14, height: 14 }} />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
                <button className="btn" style={{ width: "100%" }} disabled={issuing}>
                  {issuing ? "Signing & Issuing…" : "Sign & Issue VC"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── Right: Rider cards ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {riders.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🛵</div>
                <p>No riders registered yet.</p>
                <p style={{ fontSize: 12 }}>Register a rider on the left to get started.</p>
              </div>
            </div>
          ) : (
            riders.map(r => {
              const st = r.credentialStatus;
              const isActive = st === "ACTIVE";
              return (
                <div key={r.did} className="card" style={{ marginBottom: 0, borderLeft: `3px solid ${isActive ? "var(--emerald)" : st === "REVOKED" ? "var(--rose)" : "var(--border)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: "var(--purple-dim)", border: "1px solid rgba(139,92,246,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 700, color: "var(--purple)", flexShrink: 0,
                        }}>
                          {r.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.phone}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 4, wordBreak: "break-all" }}>
                        {r.did}
                      </div>
                    </div>
                    <span className={VC_BADGE[st] ?? "badge badge-pending"}>{VC_LABEL[st] ?? st}</span>
                  </div>

                  {/* VC details if active */}
                  {isActive && r.vc && (
                    <div style={{
                      background: "var(--bg-secondary)", border: "1px solid rgba(16,185,129,0.15)",
                      borderRadius: 6, padding: "10px 14px", marginBottom: 12,
                      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12,
                    }}>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Max Amount</span>
                        <div style={{ fontWeight: 600, color: "var(--emerald)", marginTop: 2 }}>
                          {r.vc.credentialSubject?.maxAmount?.toLocaleString()} {r.vc.credentialSubject?.currency}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Permissions</span>
                        <div style={{ marginTop: 2, display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {(r.vc.credentialSubject?.permissions ?? []).map((p: string) => (
                            <span key={p} style={{ fontSize: 10, padding: "2px 6px", background: "var(--purple-dim)", color: "var(--purple)", borderRadius: 4, fontWeight: 600 }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary" style={{ fontSize: 12, padding: "7px 14px" }}
                      onClick={() => { setIssuingForDid(r.did); setMaxAmount(r.vc?.credentialSubject?.maxAmount ? String(r.vc.credentialSubject.maxAmount) : "50000"); setPermissions(r.vc?.credentialSubject?.permissions ?? ["COLLECT_COD", "RELEASE_PACKAGE"]); }}>
                      {isActive ? "Re-issue VC" : "Issue VC"}
                    </button>
                    {isActive && (
                      <button className="btn btn-danger" style={{ fontSize: 12, padding: "7px 14px" }}
                        onClick={() => handleRevoke(r.did, r.name)}>
                        Revoke
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
  );
}
