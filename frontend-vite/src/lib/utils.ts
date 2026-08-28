export const fmtMoney = (n: number | null | undefined, currency = 'KES'): string =>
  n == null ? '—' : `${currency} ${n.toLocaleString()}`;

export const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

export const fmtDateTime = (iso: string): string => `${fmtDate(iso)} · ${fmtTime(iso)}`;

export const shortDid = (did: string, head = 18, tail = 6): string =>
  did.length <= head + tail + 1 ? did : `${did.slice(0, head)}…${did.slice(-tail)}`;

export const timeAgo = (iso: string): string => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};