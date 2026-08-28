import { randomUUID } from 'node:crypto';
import type { DecisionRecord } from '../types.js';

const MAX_ENTRIES = 500;
const store = new Map<string, DecisionRecord>();

/**
 * In-memory decision log. The backend owns the persistent audit store
 * (PostgreSQL + optional Avalanche hash anchoring); this gives the Agent a
 * queryable log for the demo and tests. Entries are immutable snapshots of
 * { request, response, extraction } so the full decision chain is auditable.
 */
export function recordDecision(record: Omit<DecisionRecord, 'id' | 'ts'>): DecisionRecord {
  const entry: DecisionRecord = {
    ...record,
    id: randomUUID(),
    ts: new Date().toISOString(),
  };
  store.set(entry.id, entry);
  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value as string;
    store.delete(oldest);
  }
  return entry;
}

export function listDecisions(limit = 50): DecisionRecord[] {
  return [...store.values()].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
}

export function getDecision(id: string): DecisionRecord | undefined {
  return store.get(id);
}
