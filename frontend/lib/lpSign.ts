import type { Hex } from "viem";
import type { PreparedLpTx } from "./api";

export type LightPoolTypedData = {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Hex;
  };
  types: {
    LightPoolTx: readonly [{ name: "digest"; type: "bytes32" }];
  };
  primaryType: "LightPoolTx";
  message: {
    digest: Hex;
  };
};

/** Build wagmi/viem signTypedData args from prepare response. */
export function lightPoolTypedDataFromPrepared(
  prepared: PreparedLpTx,
): LightPoolTypedData {
  return {
    domain: {
      name: prepared.eip712.domain.name,
      version: prepared.eip712.domain.version,
      chainId: prepared.eip712.domain.chainId,
      verifyingContract: prepared.eip712.domain.verifyingContract as Hex,
    },
    types: {
      LightPoolTx: [{ name: "digest", type: "bytes32" }],
    },
    primaryType: "LightPoolTx",
    message: {
      digest: prepared.eip712.message.digest as Hex,
    },
  };
}

/**
 * MetaMask / viem returns 65-byte ECDSA (r||s||v). LightPool Signature is r||s.
 */
export function compactRsFromEthereumSignature(signature: string): `0x${string}` {
  const body =
    signature.startsWith("0x") || signature.startsWith("0X")
      ? signature.slice(2)
      : signature;
  if (body.length === 128) {
    return `0x${body.toLowerCase()}`;
  }
  if (body.length === 130) {
    return `0x${body.slice(0, 128).toLowerCase()}`;
  }
  throw new Error("ethereum signature must be 64 or 65 bytes hex");
}
