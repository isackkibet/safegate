import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSafeGate } from '../lib/store';
import { Badge } from '../components/ui';
import { ArrowRight, ClipboardList, ShieldHalf, Truck } from 'lucide-react';
import { shortDid } from '../lib/utils';

export default function Login() {
  const { riders, login } = useSafeGate();
  const navigate = useNavigate();
  const [chosenRider, setChosenRider] = useState<string>(riders[0]?.id ?? '');

  const enterDispatcher = () => {
    login({ role: 'dispatcher', userName: 'Olive Mwende' });
    navigate('/dispatcher');
  };

  const enterRider = () => {
    const rider = riders.find((r) => r.id === chosenRider);
    if (!rider) return;
    login({ role: 'rider', userName: rider.name, riderId: rider.id });
    navigate('/rider');
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 shadow-lg shadow-brand-600/30">
            <ShieldHalf className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              SafeGate<span className="text-brand-400">.</span>
            </h1>
            <p className="text-xs text-slate-400">
              Verifiable identity + authorization before a package is released or COD is collected
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={enterDispatcher}
            className="card group flex flex-col items-start gap-4 p-6 text-left transition hover:border-brand-400/40 hover:bg-brand-600/5"
          >
            <div className="rounded-xl bg-brand-500/10 p-3 text-brand-300">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-bold text-white">Dispatcher Console</p>
              <p className="mt-1 text-sm text-slate-400">
                Create orders, assign riders, manage credentials and watch guardian decisions live.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-300 group-hover:gap-2">
              Enter as dispatcher <ArrowRight className="h-4 w-4" />
            </span>
          </button>

          <div className="card flex flex-col p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-300">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Rider App</p>
                <p className="text-sm text-slate-400">Pick a rider and drive the demo flow.</p>
              </div>
            </div>

            <select className="input" value={chosenRider} onChange={(e) => setChosenRider(e.target.value)}>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {shortDid(r.did, 14, 4)}
                </option>
              ))}
            </select>

            <div className="mt-2 flex items-center gap-2">
              {riders.find((r) => r.id === chosenRider)?.vcStatus === 'ACTIVE' ? (
                <Badge tone="green">VC ACTIVE</Badge>
              ) : (
                <Badge tone="red">VC REVOKED</Badge>
              )}
              <span className="text-[11px] text-slate-500">presenting {shortDid(riders.find((r) => r.id === chosenRider)?.did ?? 'did:key:…', 14, 4)}</span>
            </div>

            <button onClick={enterRider} className="btn-primary mt-4 w-full">
              Enter rider app <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}