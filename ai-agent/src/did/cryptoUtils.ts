import crypto from "crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_MAP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  ALPHABET_MAP[ALPHABET.charAt(i)] = i;
}

export function base58Decode(string: string): Uint8Array {
  if (string.length === 0) return new Uint8Array(0);
  const bytes = [0];
  for (let i = 0; i < string.length; i++) {
    const c = string.charAt(i);
    if (!(c in ALPHABET_MAP)) throw new Error(`Non-base58 character: ${c}`);
    let carry = ALPHABET_MAP[c];
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; string.charAt(i) === "1" && i < string.length - 1; i++) {
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

export function base58Encode(source: Uint8Array): string {
  if (source.length === 0) return "";
  const digits = [0];
  for (let i = 0; i < source.length; i++) {
    let carry = source[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let string = "";
  for (let i = 0; i < source.length && source[i] === 0; i++) {
    string += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    string += ALPHABET.charAt(digits[i]);
  }
  return string;
}

/**
 * Extracts the raw 32-byte Ed25519 public key from a did:key DID
 * (multibase base58btc, multicodec ed25519-pub 0xed 0x01).
 */
export function extractPublicKeyFromDid(did: string): Buffer {
  if (!did.startsWith("did:key:z")) {
    throw new Error("Only Ed25519 did:key DIDs starting with 'did:key:z' are supported");
  }
  const multicodecString = did.substring("did:key:z".length);
  const decoded = base58Decode(multicodecString);
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error("Invalid Ed25519 multicodec prefix");
  }
  const pubKeyBytes = decoded.subarray(2);
  if (pubKeyBytes.length !== 32) {
    throw new Error(`Invalid public key length: expected 32, got ${pubKeyBytes.length}`);
  }
  return Buffer.from(pubKeyBytes);
}

/** Builds a did:key string from a raw 32-byte Ed25519 public key. */
export function createDidKey(publicKey: Buffer): string {
  const multicodec = Buffer.concat([Buffer.from([0xed, 0x01]), publicKey]);
  return `did:key:z${base58Encode(multicodec)}`;
}

/** Stable, key-sorted JSON serialization of a VC (minus its proof). */
function deterministicStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(deterministicStringify).join(",") + "]";
  }
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const properties = keys
    .map((key) => JSON.stringify(key) + ":" + deterministicStringify(record[key]))
    .join(",");
  return "{" + properties + "}";
}

function getVcSigningInput(vc: Record<string, unknown>): Buffer {
  const clone = JSON.parse(JSON.stringify(vc));
  delete clone.proof;
  return Buffer.from(deterministicStringify(clone), "utf-8");
}

function toPublicKeyObject(publicKey: Buffer): crypto.KeyObject {
  return crypto.createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      publicKey,
    ]),
    format: "der",
    type: "spki",
  });
}

/**
 * Verifies an Ed25519Signature2020 proof on a VC using the platform's
 * public key. Mirrors the Guardian's verification exactly.
 */
export function verifyVcSignature(
  vc: Record<string, any>,
  publicKey: Buffer
): boolean {
  try {
    const proof = vc.proof;
    if (!proof || proof.type !== "Ed25519Signature2020") return false;
    const proofValue = proof.proofValue;
    if (!proofValue || !proofValue.startsWith("z")) return false;

    const signature = base58Decode(proofValue.substring(1));
    const signingInput = getVcSigningInput(vc);
    return crypto.verify(null, signingInput, toPublicKeyObject(publicKey), signature);
  } catch (error) {
    console.error("Crypto verification error:", error);
    return false;
  }
}

/** Signs a VC document with an Ed25519 private key (used by tests/issues). */
export function signVc(
  vc: Record<string, any>,
  privateKey: Buffer,
  issuerDid: string,
  verificationMethod: string
): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(vc));
  delete clone.proof;

  const signingInput = getVcSigningInput(clone);
  const privateKeyObj = crypto.createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      privateKey,
    ]),
    format: "der",
    type: "pkcs8",
  });

  const signature = crypto.sign(null, signingInput, privateKeyObj);
  clone.proof = {
    type: "Ed25519Signature2020",
    created: new Date().toISOString(),
    verificationMethod,
    proofPurpose: "assertionMethod",
    proofValue: "z" + base58Encode(signature),
  };

  return clone;
}

/** Generates a fresh Ed25519 keypair (raw 32-byte keys). */
export function generateEd25519Keypair(): {
  publicKey: Buffer;
  privateKey: Buffer;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pubJwk = publicKey.export({ format: "jwk" }) as { x: string };
  const privJwk = privateKey.export({ format: "jwk" }) as { d: string };
  return {
    publicKey: Buffer.from(pubJwk.x, "base64url"),
    privateKey: Buffer.from(privJwk.d, "base64url"),
  };
}