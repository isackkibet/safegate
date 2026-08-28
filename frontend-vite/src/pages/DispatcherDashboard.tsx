import { useMemo, useState } from 'react';
import { useSafeGate } from '../lib/store';
import { Badge, EmptyState, Modal, StatCard } from '../components/ui';
import DecisionCard from '../components/DecisionCard';
import {
  AlertTriangle,
  ClipboardList,
  CircleDollarSign,
  PackageCheck,
  Play,
  Plus,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { shortDid } from '../lib/utils';

const statusTone = (s: string): 'slate' | 'green' | 'amber' | 'red' => {
  if (s === 'collected') return 'green';
  if (s === 'approved') return 'green';
  if (s === 'denied') return 'red';
  return 'amber';
};

export default function DispatcherDashboard() {
  const { orders, riders, decisions, createOrder, assignRider, simulateActivity } = useSafeGate();
  const [showCreate, setShowCreate] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [form, setForm] = useState({ customer: '', address: '', amount: '', riderId: riders[0]?.id ?? '' });

  const stats = useMemo(() => {
    const collected = orders.filter((o) => o.status === 'collected' || o.status === 'approved').length;
    const denied = decisions.filter((d) => d.result === 'DENIED').length;
    const blocked = decisions.filter((d) => d.result === 'BLOCKED').length;
    const approved = decisions.filter((d) => d.result === 'APPROVED').length;
    const activeRiders = riders.filter((r) => r.vcStatus === 'ACTIVE').length;
    return { collected, denied, blocked, approved, activeRiders };
  }, [orders, decisions, riders]);

  const nextOrderId = useMemo(() => String(Math.max(...orders.map((o) => Number(o.id))) + 1), [orders]);

  const submitCreate = () => {
    const amount = parseFloat(form.amount);
    if (!form.customer.trim() || !Number.isFinite(amount) || amount <= 0) return;
    createOrder({
      id: nextOrderId,
      customer: form.customer.trim(),
      address: form.address.trim() || 'Pickup / drop-off unspecified',
      amount,
      assignedRiderDid: form.riderId,
    });
    setShowCreate(false);
    setForm({ customer: '', address: '', amount: '', riderId: riders[0]?.id ?? '' });
  };

  const runDemo = async () => {
    setSimulating(true);
    await simulateActivity();
    setSimulating(false);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-white">Dispatcher Dashboard</h1>
          <p className="text-sm text-slate-400">Create orders, assign riders, and watch the Guardian decide in real time.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={runDemo} disabled={simulating}>
            <Play className="h-4 w-4" />
            {simulating ? 'Streaming demo…' : 'Play 4-scenario demo'}
          </button>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Pending orders" value={orders.filter((o) => o.status === 'pending').length} icon={<ClipboardList className="h-5 w-5" />} tone="blue" />
        <StatCard label="Collected COD" value={stats.collected} icon={<CircleDollarSign className="h-5 w-5" />} tone="green" />
        <StatCard label="Approved" value={stats.approved} icon={<ShieldCheck className="h-5 w-5" />} tone="green" />
        <StatCard label="Denied" value={stats.denied} icon={<ShieldAlert className="h-5 w-5" />} tone="amber" />
        <StatCard label="Blocked" value={stats.blocked} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
        <StatCard label="Active riders" value={`${stats.activeRiders}/${riders.length}`} icon={<Truck className="h-5 w-5" />} tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
            <h2 className="text-sm font-bold text-white">Orders &amp; assignments</h2>
            <span className="text-xs text-slate-500">{orders.length} total</span>
          </div>
          {orders.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No orders yet" sub="Create your first order to start assigning riders." />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-white/5">
                  <tr>
                    <th className="th">Order</th>
                    <th className="th">Customer</th>
                    <th className="th">COD amount</th>
                    <th className="th">Assigned rider</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map((o) => {
                    const rider = riders.find((r) => r.did === o.assignedRiderDid);
                    return (
                      <tr key={o.id} className="hover:bg-white/[0.02]">
                        <td className="td font-mono text-brand-200">#{o.id}</td>
                        <td className="td">
                          <p className="font-medium text-slate-100">{o.customer}</p>
                          <p className="text-xs text-slate-500">{o.address}</p>
                        </td>
                        <td className="td font-semibold text-white">
                          {o.amount.toLocaleString()} <span className="text-xs font-normal text-slate-500">{o.currency}</span>
                        </td>
                        <td className="td">
                          {rider ? (
                            <div>
                              <p className="text-slate-200">{rider.name}</p>
                              <p className="font-mono text-[11px] text-slate-500">{shortDid(rider.did, 14, 4)}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">Unassigned</span>
                          )}
                        </td>
                        <td className="td">
                          <Badge tone={statusTone(o.status)}>{o.status.toUpperCase()}</Badge>
                        </td>
                        <td className="td text-right">
                          <select
                            className="input w-44 py-1.5 text-xs"
                            value={o.assignedRiderDid ?? ''}
                            onChange={(e) => assignRider(o.id, e.target.value || null)}
                          >
                            <option value="">— unassign —</option>
                            {riders.map((r) => (
                              <option key={r.id} value={r.did}>
                                {r.name} {r.vcStatus === 'REVOKED' ? '(revoked)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3.5">
            <span className="relative flex h-2 w-2">
              <span className="anim-pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
            </span>
            <h2 className="text-sm font-bold text-white">Live Guardian decisions</h2>
          </div>
          <div className="scrollbar-thin max-h-[640px] space-y-3 overflow-y-auto p-4">
            {simulating && (
              <div className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-3 py-2 text-xs text-brand-200">
                <Radio className="h-3.5 w-3.5 animate-pulse" /> Streaming demo activity… watch the checks light up.
              </div>
            )}
            {decisions.length === 0 ? (
              <EmptyState
                icon={<PackageCheck className="h-6 w-6" />}
                title="No decisions yet"
                sub="Rider attempts will appear here the instant the Guardian evaluates them."
              />
            ) : (
              decisions.slice(0, 12).map((d) => <DecisionCard key={d.id} decision={d} compact />)
            )}
          </div>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={`New order — auto ID #${nextOrderId}`}>
        <div className="space-y-4">
          <div>
            <label className="label">Customer name</label>
            <input className="input" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="e.g. Amina Hassan" />
          </div>
          <div>
            <label className="label">Delivery address</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Juja Road, Nairobi" />
          </div>
          <div>
            <label className="label">COD amount (KES)</label>
            <input className="input" type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="1500" />
          </div>
          <div>
            <label className="label">Assign rider</label>
            <select className="input" value={form.riderId} onChange={(e) => setForm({ ...form, riderId: e.target.value })}>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.vcStatus === 'REVOKED' ? '(VC revoked)' : `(max ${r.maxCollectionAmount.toLocaleString()} KES)`}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary w-full" onClick={submitCreate}>
            <Plus className="h-4 w-4" /> Create &amp; assign
          </button>
        </div>
      </Modal>
    </div>
  );
}