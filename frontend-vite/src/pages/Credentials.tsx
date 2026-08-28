import { useMemo, useState } from 'react';
import { useSafeGate } from '../lib/store';
import { Badge, Modal, StatCard, VcStatusBadge } from '../components/ui';
import { riderVcByDid } from '../lib/mockData';
import type { Rider as RiderType } from '../lib/types';
import { Eye, Plus, RotateCcw, ShieldOff, ShieldPlus, UserPlus } from 'lucide-react';
import { fmtDate, shortDid } from '../lib/utils';

export default function Credentials() {
  const { riders, setCredentialStatus, renewCredential, addRider } = useSafeGate();
  const [viewRider, setViewRider] = useState<RiderType | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', max: '' });

  const vcs = useMemo(() => riderVcByDid(riders), [riders]);
  const active = riders.filter((r) => r.vcStatus === 'ACTIVE').length;

  const submitAdd = () => {
    const max = parseFloat(form.max);
    if (!form.name.trim() || !Number.isFinite(max) || max <= 0) return;
    addRider({ name: form.name.trim(), phone: form.phone.trim(), maxCollectionAmount: max });
    setShowAdd(false);
    setForm({ name: '', phone: '', max: '' });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-white">Credential Management</h1>
          <p className="text-sm text-slate-400">
            Issue, renew and revoke rider Verifiable Credentials — revocation is honored instantly.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <UserPlus className="h-4 w-4" /> Issue new rider credential
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Registered riders" value={riders.length} icon={<ShieldPlus className="h-5 w-5" />} tone="blue" />
        <StatCard label="Active credentials" value={active} icon={<ShieldPlus className="h-5 w-5" />} tone="green" />
        <StatCard label="Revoked" value={riders.length - active} icon={<ShieldOff className="h-5 w-5" />} tone="red" />
      </div>

      <div className="card overflow-hidden">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="border-b border-white/5">
              <tr>
                <th className="th">Rider</th>
                <th className="th">DID</th>
                <th className="th">Permissions</th>
                <th className="th">Max collection</th>
                <th className="th">Status</th>
                <th className="th">Issued</th>
                <th className="th">Expires</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {riders.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="td">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-200">
                        {r.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-100">{r.name}</p>
                        <p className="text-xs text-slate-500">{r.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <span className="font-mono text-[11px] text-slate-400" title={r.did}>{shortDid(r.did, 16, 6)}</span>
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {r.permissions.map((p) => (
                        <Badge key={p} tone="blue">{p}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="td font-semibold text-white">
                    {r.maxCollectionAmount.toLocaleString()} <span className="text-xs font-normal text-slate-500">KES</span>
                  </td>
                  <td className="td">
                    <VcStatusBadge status={r.vcStatus} />
                  </td>
                  <td className="td text-xs text-slate-400">{fmtDate(r.vcIssuanceDate)}</td>
                  <td className="td text-xs text-slate-400">{fmtDate(r.vcExpirationDate)}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setViewRider(r)}>
                        <Eye className="h-3.5 w-3.5" /> View VC
                      </button>
                      {r.vcStatus === 'ACTIVE' ? (
                        <button
                          className="btn-danger px-2.5 py-1.5 text-xs"
                          onClick={() => setCredentialStatus(r.id, 'REVOKED')}
                        >
                          <ShieldOff className="h-3.5 w-3.5" /> Revoke
                        </button>
                      ) : (
                        <button className="btn-primary px-2.5 py-1.5 text-xs" onClick={() => renewCredential(r.id)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Reissue
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Issue a new rider credential">
        <div className="space-y-4">
          <div>
            <label className="label">Rider name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Faith Chebet" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254 7XX XXX XXX" />
          </div>
          <div>
            <label className="label">Max collection amount (KES)</label>
            <input className="input" type="number" min="1" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} placeholder="5000" />
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 text-xs text-slate-400">
            A <span className="font-mono text-brand-300">did:key</span> DID is generated, signed with the platform key, and a{' '}
            <span className="font-mono text-brand-300">RiderAuthorizationCredential</span> is issued immediately with
            expiry 2026-12-31.
          </div>
          <button className="btn-primary w-full" onClick={submitAdd}>
            <Plus className="h-4 w-4" /> Issue &amp; sign credential
          </button>
        </div>
      </Modal>

      <Modal open={!!viewRider} onClose={() => setViewRider(null)} title="Verifiable Credential" wide>
        {viewRider && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-white">{viewRider.name}</p>
              <VcStatusBadge status={viewRider.vcStatus} />
              <span className="font-mono text-xs text-slate-500">{viewRider.did}</span>
            </div>
            <div className="flex gap-2">
              {viewRider.permissions.map((p) => (
                <Badge key={p} tone="blue">{p}</Badge>
              ))}
            </div>
            <pre className="scrollbar-thin max-h-[52vh] overflow-auto rounded-lg bg-ink-950/90 p-4 font-mono text-[11px] leading-5 text-slate-300">
              {JSON.stringify(vcs[viewRider.did], null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}