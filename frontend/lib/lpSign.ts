import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import * as secp from "@noble/secp256k1";
import { getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

secp.etc.hmacSha256Sync = (key, ...msgs) =>
  hmac(sha256, key, secp.etc.concatBytes(...msgs));

const STORAGE_KEY = "lightpool.lpSigningKey";

/** Well-known local Reth/Anvil keys for MetaMask-imported accounts. */
const LOCAL_DEV_KEYS: Record<string, Hex> = {
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266":
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8":
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc":
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
};

function normalizeHex(hex: string): string {
  const body = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  return body.toLowerCase();
}

function hexToBytes(hex: string): Uint8Array {
  const body = normalizeHex(hex);
  if (body.length % 2 !== 0) {
    throw new Error("invalid hex length");
  }
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function addressFromPrivateKey(privateKey: Hex): string {
  return getAddress(privateKeyToAccount(privateKey).address);
}

export function getStoredLpPrivateKey(): Hex | null {
  if (typeof window === "undefined") {
    return null;
  }
  const fromEnv = process.env.NEXT_PUBLIC_LP_PRIVATE_KEY;
  if (fromEnv && /^0x[0-9a-fA-F]{64}$/.test(fromEnv)) {
    return fromEnv as Hex;
  }
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) {
    return stored as Hex;
  }
  return null;
}

export function storeLpPrivateKey(privateKey: string): string {
  const key = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("private key must be 32-byte hex");
  }
  const address = addressFromPrivateKey(key);
  window.sessionStorage.setItem(STORAGE_KEY, key);
  return address;
}

export function clearLpPrivateKey(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function resolveLpPrivateKey(expectedAddress: string): Hex {
  const expected = getAddress(expectedAddress);
  const stored = getStoredLpPrivateKey();
  if (stored) {
    const derived = addressFromPrivateKey(stored);
    if (derived.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(
        `LP signing key address ${derived} does not match connected ${expected}`,
      );
    }
    return stored;
  }
  const local = LOCAL_DEV_KEYS[expected.toLowerCase()];
  if (local) {
    return local;
  }
  throw new Error(
    "LightPool signing key not set. Import the same private key as MetaMask (session only), or use a local Anvil account.",
  );
}

/**
 * Sign a LightPool tx digest the same way lightpool-crypto Signature::new does:
 * ECDSA over SHA256(digest32), low-S, 64-byte r||s.
 */
export function signLpDigest(digestHex: string, privateKey: Hex): `0x${string}` {
  const digest = hexToBytes(digestHex);
  if (digest.length !== 32) {
    throw new Error("digest must be 32 bytes");
  }
  const hash = sha256(digest);
  const keyBytes = hexToBytes(privateKey);
  const sig = secp.sign(hash, keyBytes, { lowS: true });
  return bytesToHex(sig.toCompactRawBytes());
}

export function signLpDigestForAddress(
  digestHex: string,
  address: string,
): `0x${string}` {
  const key = resolveLpPrivateKey(address);
  return signLpDigest(digestHex, key);
}
