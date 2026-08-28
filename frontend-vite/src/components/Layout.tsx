import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSafeGate } from '../lib/store';
import { LogOut, ScrollText, ShieldHalf, Sparkles } from 'lucide-react';

const NAV = [
  { to: '/dispatcher', label: 'Dispatcher Dashboard', icon: ShieldHalf, end: true },
  { to: '/credentials', label: 'Credential Management', icon: ScrollText },
  { to: '/audit', label: 'Audit History', icon: Sparkles },
];

export default function Layout() {
  const { session, logout } = useSafeGate();
  const navigate = useNavigate();

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-ink-900/60">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <ShieldHalf className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-white">SafeGate</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Dispatch Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600/15 text-brand-200 ring-1 ring-brand-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/5 p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-200">
              {(session?.userName ?? 'D').charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{session?.userName}</p>
              <p className="text-[11px] text-slate-500">Dispatcher</p>
            </div>
          </div>
          <button
            className="btn-ghost w-full text-xs"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="scrollbar-thin flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}