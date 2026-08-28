import {
  upsertRider,
  upsertOrder,
  issueCredential,
  revokeCredential,
} from './db.js';

export const DEMO_RIDER_ACTIVE = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
export const DEMO_RIDER_REVOKED = 'did:key:z6MkrevokeD12xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx123';
export const DEMO_ORDER = '4521';

/**
 * Populate demo data for the hackathon: two riders (one active, one revoked),
 * a credential for each, and an order assigned to the active rider.
 * Idempotent — safe to call on every boot.
 */
export async function seedDemo(): Promise<void> {
  // Riders
  await upsertRider({ did: DEMO_RIDER_ACTIVE, name: 'Rider 88', role: 'delivery_rider', status: 'ACTIVE' });
  await upsertRider({ did: DEMO_RIDER_REVOKED, name: 'Rider 12', role: 'delivery_rider', status: 'ACTIVE' });

  // Credentials (status comes from the DB credentials table)
  await issueCredential({
    riderDid: DEMO_RIDER_ACTIVE,
    issuerDid: 'did:key:z6MkplatformDID00',
    vcJwt: 'eyJhbGciOiJFZERTQSJ9.vc-demo-active',
    maxCollection: 5000,
    currency: 'KES',
  });
  await issueCredential({
    riderDid: DEMO_RIDER_REVOKED,
    issuerDid: 'did:key:z6MkplatformDID00',
    vcJwt: 'eyJhbGciOiJFZERTQSJ9.vc-demo-revoked',
    maxCollection: 5000,
    currency: 'KES',
  });

  // Revoke the demo revoked rider's credential
  await revokeCredential(DEMO_RIDER_REVOKED);

  // Orders
  await upsertOrder({
    id: DEMO_ORDER,
    amount: 1500,
    currency: 'KES',
    status: 'OPEN',
    riderDid: DEMO_RIDER_ACTIVE,
  });
  await upsertOrder({
    id: '9999',
    amount: 1500,
    currency: 'KES',
    status: 'OPEN',
    riderDid: DEMO_RIDER_ACTIVE,
  });
  await upsertOrder({
    id: '7788',
    amount: 1500,
    currency: 'KES',
    status: 'OPEN',
    riderDid: DEMO_RIDER_REVOKED,
  });
}
