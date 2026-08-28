import type { Order, Rider, AuditEntry, VCStatus } from "@safegate/shared-types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";
const API_KEY = "safegate-dispatcher-key-change-me"; // Default dispatcher credential

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-API-Key", API_KEY);

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText || res.statusText}`);
  }

  return res.json();
}

export const api = {
  // Orders
  getOrders: (): Promise<Order[]> => request("/orders"),
  getOrder: (id: string): Promise<Order> => request(`/orders/${id}`),
  createOrder: (order: Partial<Order>): Promise<Order> =>
    request("/orders", {
      method: "POST",
      body: JSON.stringify(order),
    }),
  updateOrder: (id: string, updates: Partial<Order>): Promise<Order> =>
    request(`/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  // Riders
  getRiders: (): Promise<Rider[]> => request("/riders"),
  createRider: (rider: { did: string; name: string; phone: string }): Promise<Rider> =>
    request("/riders", {
      method: "POST",
      body: JSON.stringify(rider),
    }),
  getRiderCredential: (did: string): Promise<{ status: VCStatus | "UNKNOWN" | "EXPIRED"; vc?: Record<string, any> }> =>
    request(`/riders/${encodeURIComponent(did)}/credential`),
  issueCredential: (
    did: string,
    params: { permissions: string[]; maxAmount: number; currency: string }
  ): Promise<any> =>
    request(`/riders/${encodeURIComponent(did)}/issue`, {
      method: "POST",
      body: JSON.stringify(params),
    }),
  revokeCredential: (did: string): Promise<any> =>
    request(`/riders/${encodeURIComponent(did)}/revoke`, {
      method: "POST",
    }),

  // Audit Logs
  getAuditLogs: (filters?: { orderId?: string; riderDid?: string }): Promise<AuditEntry[]> => {
    const params = new URLSearchParams();
    if (filters?.orderId) params.append("orderId", filters.orderId);
    if (filters?.riderDid) params.append("riderDid", filters.riderDid);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request(`/audit${query}`);
  },
};
