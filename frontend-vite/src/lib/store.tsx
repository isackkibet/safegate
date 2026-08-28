import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Decision, Order, Rider, Session, VcStatus } from './types';
import { DEMO_SCENARIOS, initialOrders, initialRiders } from './mockData';
import { aiParse, buildDecision, evaluate } from './guardian';

interface SafeGateStore {
  session: Session | null;
  riders: Rider[];
  orders: Order[];
  decisions: Decision[];
  login: (session: Session) => void;
  logout: () => void;
  createOrder: (input: { id: string; customer: string; address: string; amount: number; assignedRiderDid: string }) => void;
  assignRider: (orderId: string, riderDid: string | null) => void;
  addRider: (input: { name: string; phone: string; maxCollectionAmount: number }) => void;
  setCredentialStatus: (riderId: string, status: VcStatus) => void;
  renewCredential: (riderId: string) => void;
  evaluateMessage: (riderDid: string, message: string) => { rider: Rider | undefined; order: Order | undefined; decision: Decision };
  simulateActivity: () => Promise<void>;
}

const Ctx = createContext<SafeGateStore | null>(null);

export const useSafeGate = (): SafeGateStore => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSafeGate must be used inside <SafeGateProvider>');
  return ctx;
};

export function SafeGateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [riders, setRiders] = useState<Rider[]>(initialRiders);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  const login = useCallback((s: Session) => setSession(s), []);
  const logout = useCallback(() => setSession(null), []);

  const createOrder = useCallback(
    (input: { id: string; customer: string; address: string; amount: number; assignedRiderDid: string }) => {
      const assigned = riders.find((r) => r.id === input.assignedRiderDid);
      setOrders((prev) => [
        {
          id: input.id,
          customer: input.customer,
          address: input.address,
          amount: input.amount,
          currency: 'KES',
          status: 'pending',
          assignedRiderDid: assigned?.did ?? null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setRiders((prev) =>
        prev.map((r) =>
          r.id === input.assignedRiderDid ? { ...r, assignedOrders: [...r.assignedOrders, input.id] } : r,
        ),
      );
    },
    [riders],
  );

  const assignRider = useCallback((orderId: string, riderDid: string | null) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, assignedRiderDid: riderDid } : o)));
  }, []);

  const addRider = useCallback((input: { name: string; phone: string; maxCollectionAmount: number }) => {
    setRiders((prev) => {
      const seq = prev.length + 1;
      return [
        ...prev,
        {
          id: `rider${seq}`,
          name: input.name,
          phone: input.phone,
          role: 'delivery_rider',
          did: `did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK${seq}${seq}${seq}`,
          permissions: ['collect_cod_payment', 'release_package'],
          maxCollectionAmount: input.maxCollectionAmount,
          currency: 'KES',
          vcStatus: 'ACTIVE',
          vcIssuanceDate: new Date().toISOString(),
          vcExpirationDate: '2026-12-31T00:00:00.000Z',
          vcId: `urn:uuid:vc-rider${seq}`,
          assignedOrders: [],
        },
      ];
    });
  }, []);

  const setCredentialStatus = useCallback((riderId: string, status: VcStatus) => {
    setRiders((prev) =>
      prev.map((r) => {
        if (r.id !== riderId) return r;
        const base = status === 'REVOKED' ? '2026-09-01T00:00:00.000Z' : '2026-12-31T00:00:00.000Z';
        return {
          ...r,
          vcStatus: status,
          vcExpirationDate:
            status === 'REVOKED' ? base : r.vcExpirationDate > base ? r.vcExpirationDate : '2026-12-31T00:00:00.000Z',
        };
      }),
    );
  }, []);

  const renewCredential = useCallback((riderId: string) => {
    setRiders((prev) =>
      prev.map((r) =>
        r.id === riderId
          ? { ...r, vcStatus: 'ACTIVE', vcExpirationDate: '2026-12-31T00:00:00.000Z' }
          : r,
      ),
    );
  }, []);

  const evaluateMessage = useCallback(
    (riderDid: string, message: string) => {
      const rider = riders.find((r) => r.did === riderDid);
      const parsed = aiParse(message, riderDid);
      const { checks, result, summary } = evaluate(parsed, riders, orders);
      const order = orders.find((o) => o.id === parsed.orderId);
      const decision = buildDecision(parsed, rider, order, checks, result, summary);

      if (result === 'APPROVED') {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === decision.orderId
              ? { ...o, status: parsed.action === 'COLLECT_COD' ? ('collected' as const) : ('approved' as const) }
              : o,
          ),
        );
      }
      setDecisions((prev) => [decision, ...prev]);
      return { rider, order, decision };
    },
    [riders, orders],
  );

  const simulateActivity = useCallback(async () => {
    for (const scenario of DEMO_SCENARIOS) {
      await new Promise((res) => setTimeout(res, 1200));
      const rider = riders.find((r) => r.id === scenario.riderId);
      if (rider) evaluateMessage(rider.did, scenario.message);
    }
  }, [riders, evaluateMessage]);

  const value = useMemo<SafeGateStore>(
    () => ({
      session,
      riders,
      orders,
      decisions,
      login,
      logout,
      createOrder,
      assignRider,
      addRider,
      setCredentialStatus,
      renewCredential,
      evaluateMessage,
      simulateActivity,
    }),
    [session, riders, orders, decisions, login, logout, createOrder, assignRider, addRider, setCredentialStatus, renewCredential, evaluateMessage, simulateActivity],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}