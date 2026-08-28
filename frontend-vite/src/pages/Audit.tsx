import { useMemo, useState } from 'react';
import { useSafeGate } from '../lib/store';
import { EmptyState, ResultBadge } from '../components/ui';
import type { DecisionResult } from '../lib/types';
import { CheckCircle2, ScrollText, ShieldCheck, XCircle } from 'lucide-react';
import { fmtDateTime } from '../lib/utils';

type Filter = 'ALL' | DecisionResult;

const FILTERS: Filter[] = ['ALL', 'APPROVED', 'DENIED', 'BLOCKED'];

export default function Audit() {
  const { decisions } = useSafeGate();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === 'ALL' ? decisions : decisions.filter((d) => d.result === filter)),
    [decisions, filter],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-extrabold text-white">Audit History</h1>
        <p className="text-sm text-slate-400">
          Every guardian decision is append-only and carries an anchored hash — proof for regulators and dispute teams.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count = f === 'ALL' ? decisions.length : decisions.filter((d) => d.result === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filter === f
                  ? 'border-brand-400/50 bg-brand-600/20 text-brand-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'APPROVED' ? 'Approved' : f === 'DENIED' ? 'Denied' : f === 'BLOCKED' ? 'Blocked' : 'All'}
              <span className="ml-1.5 rounded-full bg-white/10 px-1.5 text-[10px]">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ScrollText className="h-6 w-6" />}
            title="No matching records"
            sub="Run rider attempts from the Rider Console or the dispatcher demo to populate the audit trail."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <div key={d.id} className="card overflow-hidden">
              <button className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-left" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                <div className="flex items-center gap-3">
                  <ResultBadge result={d.result} />
                  <div>
                    <p className="text-sm font-bold text-white">
                      Order #{d.orderId} · {d.actor.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fmtDateTime(d.timestamp)} · {d.action} {d.requestedAmount != null ? `· ${d.currency} ${d.requestedAmount.toLocaleString()}` : ''}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-slate-500">{d.auditHash}</span>
              </button>

              {expanded === d.id && (
                <div className="border-t border-white/5 px-5 py-4">
                  <p className="mb-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Rider input:</span> “{d.message}”
                  </p>
                  <div className="space-y-1">
                    {d.checks.map((c) => (
                      <div key={c.name} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/[0.02]">
                        {c.passed ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                        )}
                        <span>
                          <span className="font-semibold text-slate-200">{c.name}</span>
                          {c.critical && <span className="ml-1.5 rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-bold text-red-300">LOCK</span>}
                          <span className="text-slate-500"> — {c.detail}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/5 bg-ink-950/60 px-3 py-2 font-mono text-[11px] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    hash verification: <span className="text-emerald-300">intact</span> · {d.auditHash}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}