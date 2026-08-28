import { useState } from 'react';
import type { Decision } from '../lib/types';
import { ResultBadge } from './ui';
import { CheckCircle2, ChevronDown, CircleDollarSign, Fingerprint, Hash, PackageOpen } from 'lucide-react';
import { fmtMoney, fmtTime, shortDid, timeAgo } from '../lib/utils';

export default function DecisionCard({ decision, compact }: { decision: Decision; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const failed = decision.checks.filter((c) => !c.passed);

  return (
    <div
      className={`card p-4 anim-rise ${decision.result === 'APPROVED' ? '' : ''}`}
      style={{
        borderColor:
          decision.result === 'APPROVED'
            ? 'rgba(16,185,129,0.25)'
            : decision.result === 'BLOCKED'
              ? 'rgba(239,68,68,0.3)'
              : 'rgba(245,158,11,0.25)',
      }}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {decision.action === 'COLLECT_COD' ? (
            <CircleDollarSign className="h-4 w-4 text-slate-400" />
          ) : (
            <PackageOpen className="h-4 w-4 text-slate-400" />
          )}
          <p className="text-sm font-bold text-white">
            Order #{decision.orderId}
            {decision.orderCustomer ? ` · ${decision.orderCustomer}` : ''}
          </p>
          <ResultBadge result={decision.result} />
        </div>
        <span className="text-[11px] text-slate-500" title={decision.timestamp}>
          {compact ? timeAgo(decision.timestamp) : fmtTime(decision.timestamp)}
        </span>
      </div>

      <p className="text-sm text-slate-400">
        <span className="text-slate-200">{decision.actor.name}</span> ·{' '}
        <span className="font-mono text-xs">{shortDid(decision.actor.did)}</span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-slate-300">
          {decision.action} {decision.requestedAmount != null ? `· ${fmtMoney(decision.requestedAmount, decision.currency)}` : ''}
        </span>
        {decision.message && (
          <span className="max-w-full truncate rounded bg-white/5 px-2 py-0.5 text-slate-400">
            “{decision.message}”
          </span>
        )}
      </div>

      <div className="mt-2">
        <button
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-300 hover:text-brand-200"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
          {open ? 'Hide guardian checks' : `Show ${decision.checks.length} guardian checks${failed.length ? ` · ${failed.length} failed` : ''}`}
        </button>
        {open && (
          <div className="mt-2 space-y-1">
            {decision.checks.map((c) => (
              <div key={c.name} className="flex items-start gap-2 text-xs">
                <CheckCircle2
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c.passed ? 'text-emerald-400' : 'text-red-400'}`}
                />
                <span className={c.passed ? 'text-slate-400' : 'text-slate-300'}>
                  <span className="font-semibold text-slate-300">{c.name}</span> — {c.detail}
                </span>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2 py-1.5 font-mono text-[11px] text-slate-500">
              <Hash className="h-3 w-3" />
              audit-hash: {decision.auditHash}
              <Fingerprint className="ml-1 h-3 w-3 text-slate-600" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}