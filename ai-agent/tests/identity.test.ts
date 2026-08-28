import { describe, it, expect } from 'vitest';
import { EdDSASigner } from 'did-jwt';
import { createVerifiableCredentialJwt } from 'did-jwt-vc';
import { verifyRiderCredential, resolveDid } from '../src/did/verifier.js';
import { generateKeyPairFromSeed } from '@stablelib/ed25519';
import { randomBytes } from 'node:crypto';
import bs58 from 'bs58';

const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

function keyPair() {
  return generateKeyPairFromSeed(new Uint8Array(randomBytes(32)));
}

/** Build a did:key (Ed25519, multicodec 0xed01) from a public key. */
function didKeyFromPublicKey(pub: Uint8Array): string {
  const bytes = new Uint8Array(ED25519_MULTICODEC.length + pub.length);
  bytes.set(ED25519_MULTICODEC, 0);
  bytes.set(pub, ED25519_MULTICODEC.length);
  return 'did:key:z' + bs58.encode(bytes as unknown as Uint8Array);
}

/**
 * Identity-layer round trip: a platform DID signs a RiderAuthorizationCredential
 * for a rider DID; our verifier resolves the did:key and validates the signature
 * cryptographically, then surfaces the claims the Guardian needs.
 */
describe('SafeGate identity layer (DID + VC)', () => {
  it('creates and verifies a did:key RiderAuthorizationCredential', async () => {
    const platformKey = keyPair();
    const riderKey = keyPair();

    const platformDid = didKeyFromPublicKey(platformKey.publicKey);
    const riderDid = didKeyFromPublicKey(riderKey.publicKey);

    // The platform DID must resolve to a DID document via did:key.
    const resolution = await resolveDid(platformDid);
    expect(resolution.ok).toBe(true);

    // Platform issues a RiderAuthorizationCredential to the rider.
    const signer = EdDSASigner(platformKey.secretKey);
    const credentialJwt = await createVerifiableCredentialJwt(
      {
        sub: riderDid,
        vc: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'RiderAuthorizationCredential'],
          expirationDate: '2026-12-31T00:00:00.000Z',
          credentialSubject: {
            id: riderDid,
            role: 'delivery_rider',
            permissions: ['collect_cod_payment', 'release_package'],
            maxCollectionAmount: 5000,
            currency: 'KES',
            status: 'ACTIVE',
          },
        },
      },
      { did: platformDid, signer, alg: 'EdDSA' },
    );

    // Our verifier must validate the signature and surface the claims.
    const result = await verifyRiderCredential(credentialJwt);
    expect(result.signatureValid).toBe(true);
    expect(result.status).toBe('ACTIVE');
    expect(result.permissions).toContain('collect_cod_payment');
    expect(result.maxCollectionAmount).toBe(5000);
    expect(result.currency).toBe('KES');
  });

  it('rejects a tampered credential', async () => {
    const platformKey = keyPair();
    const platformDid = didKeyFromPublicKey(platformKey.publicKey);
    const riderDid = didKeyFromPublicKey(keyPair().publicKey);

    const signer = EdDSASigner(platformKey.secretKey);
    const jwt = await createVerifiableCredentialJwt(
      {
        sub: riderDid,
        vc: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential'],
          credentialSubject: { id: riderDid, status: 'ACTIVE', maxCollectionAmount: 5000 },
        },
      },
      { did: platformDid, signer, alg: 'EdDSA' },
    );

    // Corrupt the payload so the EdDSA signature no longer matches.
    const parts = jwt.split('.');
    const tampered = parts
      .map((p, i) => (i === 1 ? Buffer.from('{"sub":"attacker"}').toString('base64url') : p))
      .join('.');

    const result = await verifyRiderCredential(tampered);
    expect(result.signatureValid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
