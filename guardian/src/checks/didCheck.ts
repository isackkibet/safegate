import { Resolver } from "did-resolver";
import { getResolver as getKeyResolver } from "key-did-resolver";

// Create a resolver instance with the did:key resolver
const keyResolver = getKeyResolver();
const resolver = new Resolver({
  ...keyResolver,
});

/**
 * Resolves a did:key DID.
 * Returns the public key if resolved successfully, or null if resolution fails.
 */
export async function resolveRiderDid(did: string): Promise<Record<string, unknown> | null> {
  if (!did.startsWith("did:key:")) {
    return null;
  }
  try {
    const result = await resolver.resolve(did);
    if (!result.didDocument) {
      return null;
    }
    return result.didDocument as unknown as Record<string, unknown>;
  } catch (error) {
    console.error(`Failed to resolve DID ${did}:`, error);
    return null;
  }
}
