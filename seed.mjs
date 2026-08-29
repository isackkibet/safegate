/**
 * SafeGate seed script — populates example riders, orders, VCs and audit entries
 * Run: node seed.mjs
 */

const BASE  = "http://localhost:3002";
const KEY   = "safegate-dispatcher-key-change-me";

const headers = {
  "Content-Type": "application/json",
  "X-API-Key": KEY,
};

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await r.json();
  if (!r.ok) console.error(`  ✗ POST ${path}:`, json.error ?? json);
  else       console.log(`  ✓ POST ${path}:`, JSON.stringify(json).slice(0, 80));
  return json;
}

async function postPublic(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!r.ok) console.error(`  ✗ POST ${path}:`, json.error ?? json);
  else       console.log(`  ✓ POST ${path}:`, JSON.stringify(json).slice(0, 80));
  return json;
}

// ─── Riders ───────────────────────────────────────────────────────────────────
const riders = [
  { did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK", name: "James Kamau",   phone: "+254 712 345 678" },
  { did: "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuias8sisDArDJF74B", name: "Amina Wanjiru", phone: "+254 722 987 654" },
  { did: "did:key:z6Mkf5rGuvyzxXjmgYKqtfZCe7tGvbHQZHJKBSaEDkVPPQ7", name: "Brian Otieno",  phone: "+254 733 111 222" },
];

// ─── Orders ───────────────────────────────────────────────────────────────────
const orders = [
  {
    id: "ORD-001", amount: 12500, currency: "KES",
    packageDescription: "Electronics – Laptop",
    recipientName: "Grace Njeri", recipientAddress: "Westlands, Nairobi",
    riderDid: riders[0].did,
  },
  {
    id: "ORD-002", amount: 3800, currency: "KES",
    packageDescription: "Clothing – Shoes (x2)",
    recipientName: "Peter Mwangi", recipientAddress: "Kilimani, Nairobi",
    riderDid: riders[1].did,
  },
  {
    id: "ORD-003", amount: 75000, currency: "KES",
    packageDescription: "Industrial Parts",
    recipientName: "Kariokor Supplies Ltd", recipientAddress: "Industrial Area, Nairobi",
    riderDid: riders[2].did,
  },
  {
    id: "ORD-004", amount: 9200, currency: "KES",
    packageDescription: "Groceries – Bulk",
    recipientName: "Susan Achieng", recipientAddress: "Karen, Nairobi",
    riderDid: riders[0].did,
  },
  {
    id: "ORD-005", amount: 500, currency: "KES",
    packageDescription: "Documents – Legal",
    recipientName: "John Gitau", recipientAddress: "CBD, Nairobi",
  },
];

// ─── Audit log examples ───────────────────────────────────────────────────────
const auditEntries = [
  {
    orderId: "ORD-001", riderDid: riders[0].did,
    action: "COLLECT_COD", decision: "APPROVED",
    checks: {
      orderExists: true, riderDidResolves: true, vcSignatureValid: true,
      riderAssignedToOrder: true, vcStatus: "ACTIVE",
      permissionIncludesAction: true, amountWithinLimit: true,
    },
  },
  {
    orderId: "ORD-002", riderDid: riders[1].did,
    action: "COLLECT_COD", decision: "APPROVED",
    checks: {
      orderExists: true, riderDidResolves: true, vcSignatureValid: true,
      riderAssignedToOrder: true, vcStatus: "ACTIVE",
      permissionIncludesAction: true, amountWithinLimit: true,
    },
  },
  {
    orderId: "ORD-003", riderDid: riders[2].did,
    action: "COLLECT_COD", decision: "DENIED",
    reason: "Requested amount KES 75,000 exceeds rider limit of KES 50,000",
    checks: {
      orderExists: true, riderDidResolves: true, vcSignatureValid: true,
      riderAssignedToOrder: true, vcStatus: "ACTIVE",
      permissionIncludesAction: true, amountWithinLimit: false,
    },
  },
  {
    orderId: "ORD-004", riderDid: riders[1].did,
    action: "RELEASE_PACKAGE", decision: "DENIED",
    reason: "Rider is not assigned to this order",
    checks: {
      orderExists: true, riderDidResolves: true, vcSignatureValid: true,
      riderAssignedToOrder: false, vcStatus: "ACTIVE",
      permissionIncludesAction: true, amountWithinLimit: true,
    },
  },
  {
    orderId: "ORD-001", riderDid: riders[0].did,
    action: "RELEASE_PACKAGE", decision: "APPROVED",
    checks: {
      orderExists: true, riderDidResolves: true, vcSignatureValid: true,
      riderAssignedToOrder: true, vcStatus: "ACTIVE",
      permissionIncludesAction: true, amountWithinLimit: true,
    },
  },
  {
    orderId: "ORD-005", riderDid: riders[2].did,
    action: "COLLECT_COD", decision: "DENIED",
    reason: "Rider's Verifiable Credential has been revoked",
    checks: {
      orderExists: true, riderDidResolves: true, vcSignatureValid: false,
      riderAssignedToOrder: false, vcStatus: "REVOKED",
      permissionIncludesAction: false, amountWithinLimit: true,
    },
  },
];

async function main() {
  console.log("\n── Registering riders ──");
  for (const r of riders) await post("/riders", r);

  console.log("\n── Issuing credentials ──");
  for (const r of riders) {
    await post(`/riders/${encodeURIComponent(r.did)}/issue`, {
      permissions: ["COLLECT_COD", "RELEASE_PACKAGE"],
      maxAmount: 50000,
      currency: "KES",
    });
  }

  console.log("\n── Creating orders ──");
  for (const o of orders) await post("/orders", o);

  console.log("\n── Seeding audit log ──");
  for (const a of auditEntries) await postPublic("/audit", a);

  console.log("\n✅ Seed complete — refresh http://localhost:3000\n");
}

main().catch(console.error);
