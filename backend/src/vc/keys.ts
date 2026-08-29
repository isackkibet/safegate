import { generateEd25519Keypair, createDidKey } from "./cryptoUtils.js";

let platformPrivateKey: Buffer;
let platformPublicKey: Buffer;
let platformDid: string;

// Initialize platform keys
const envKey = process.env.PLATFORM_PRIVATE_KEY;
if (envKey && envKey.trim().length > 0) {
  try {
    platformPrivateKey = Buffer.from(envKey.trim(), "hex");
    // Generate public key from private key using Node.js crypto
    const crypto = await import("crypto");
    const privateKeyObj = crypto.createPrivateKey({
      key: Buffer.concat([
        Buffer.from("302e020100300506032b657004220420", "hex"),
        platformPrivateKey,
      ]),
      format: "der",
      type: "pkcs8",
    });
    const publicKeyObj = crypto.createPublicKey(privateKeyObj);
    const pubJwk = publicKeyObj.export({ format: "jwk" }) as { x: string };
    platformPublicKey = Buffer.from(pubJwk.x, "base64url");
    platformDid = createDidKey(platformPublicKey);
    console.log(`🛡️  Loaded Platform DID from env: ${platformDid}`);
  } catch (error) {
    console.error("❌  Failed to load platform private key from env, generating a temporary keypair:", error);
    const keys = generateEd25519Keypair();
    platformPrivateKey = keys.privateKey;
    platformPublicKey = keys.publicKey;
    platformDid = createDidKey(platformPublicKey);
    console.log(`🛡️  Generated Platform DID: ${platformDid}`);
  }
} else {
  const keys = generateEd25519Keypair();
  platformPrivateKey = keys.privateKey;
  platformPublicKey = keys.publicKey;
  platformDid = createDidKey(platformPublicKey);
  console.log(`🛡️  No PLATFORM_PRIVATE_KEY specified. Generated temporary Platform DID: ${platformDid}`);
  console.log(`   Private key (hex): ${platformPrivateKey.toString("hex")}`);
}

export function getPlatformKeys() {
  return {
    privateKey: platformPrivateKey,
    publicKey: platformPublicKey,
    did: platformDid,
  };
}
