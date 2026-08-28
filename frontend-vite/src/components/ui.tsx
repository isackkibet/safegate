import type { ReactNode } from 'react';
import type { DecisionResult, GuardianCheck, VcStatus } from '../lib/types';
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';

export function Badge({
  tone,
  children,
}: {
  tone: 'green' | 'red' | 'amber' | 'slate' | 'blue';
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    red: 'bg-red-500/10 text-red-300 border-red-500/25',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    slate: 'bg-slate-500/10 text-slate-300 border-slate-500/25',
    blue: 'bg-brand-500/10 text-brand-200 border-brand-500/30',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function ResultBadge({ result }: { result: DecisionResult }) {
  if (result === 'APPROVED')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/30">
        <ShieldCheck className="h-3.5 w-3.5" /> APPROVED
      </span>
    );
  if (result === 'BLOCKED')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-300 ring-1 ring-red-500/30">
        <ShieldAlert className="h-3.5 w-3.5" /> BLOCKED
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-500/30">
      <XCircle className="h-3.5 w-3.5" /> DENIED
    </span>
  );
}

export function VcStatusBadge({ status }: { status: VcStatus }) {
  return <Badge tone={status === 'ACTIVE' ? 'green' : 'red'}>{status}</Badge>;
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue';
}) {
  const ic: Record<string, string> = {
    slate: 'bg-white/5 text-slate-300',
    green: 'bg-emerald-500/10 text-emerald-300',
    red: 'bg-red-500/10 text-red-300',
    amber: 'bg-amber-500/10 text-amber-300',
    blue: 'bg-brand-500/10 text-brand-300',
  };
  return (
    <div className="card flex items-start gap-3 p-4">
      {icon && <div className={`rounded-lg p-2 ${ic[tone]}`}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

export function CheckRow({ check, state }: { check: GuardianCheck; state: 'idle' | 'active' | 'done' }) {
  const tone =
    state === 'active'
      ? 'text-brand-300'
      : state === 'idle'
        ? 'text-slate-600'
        : check.passed
          ? 'text-emerald-400'
          : 'text-red-400';
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg px-3 py-2 transition ${
        state === 'active' ? 'bg-brand-500/5 ring-1 ring-brand-400/30' : state === 'done' ? 'bg-white/[0.02]' : ''
      }`}
    >
      {state === 'idle' ? (
        <span className="mt-0.5 h-4 w-4 rounded-full border border-white/10" />
      ) : state === 'active' ? (
        <Loader2 className={`mt-0.5 h-4 w-4 shrink-0 animate-spin ${tone}`} />
      ) : check.passed ? (
        <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      ) : (
        <XCircle className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      )}
      <div className="min-w-0">
        <p className={`text-sm font-medium ${state === 'idle' ? 'text-slate-600' : 'text-slate-200'}`}>
          {check.name}
          {check.critical && state !== 'idle' && (
            <span className="ml-2 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-300">GUARDIAN LOCK</span>
          )}
        </p>
        {state !== 'idle' && <p className="text-xs text-slate-500">{check.detail}</p>}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`anim-pop card max-h-[88vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-thin overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="rounded-xl bg-white/5 p-3 text-slate-500">{icon}</div>
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      <p className="max-w-sm text-xs text-slate-500">{sub}</p>
    </div>
  );
}