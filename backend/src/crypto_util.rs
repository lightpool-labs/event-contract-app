// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use k256::ecdsa::{RecoveryId, Signature as K256Signature, VerifyingKey};
use lightpool_sdk::{Address, Signature, Signer};
use sha3::{Digest, Keccak256};

use crate::error::{AppError, AppResult};

pub fn parse_address(raw: &str) -> AppResult<Address> {
    raw.trim()
        .parse::<Address>()
        .map_err(|e| AppError::BadRequest(format!("invalid address: {e}")))
}

pub fn normalize_address(raw: &str) -> AppResult<String> {
    Ok(parse_address(raw)?.to_string())
}

pub fn personal_sign_hash(message: &[u8]) -> [u8; 32] {
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let mut hasher = Keccak256::new();
    hasher.update(prefix.as_bytes());
    hasher.update(message);
    let out = hasher.finalize();
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&out);
    arr
}

pub fn recover_personal_sign_address(message: &[u8], signature_hex: &str) -> AppResult<Address> {
    let sig_bytes = decode_hex_signature(signature_hex)?;
    if sig_bytes.len() != 65 {
        return Err(AppError::BadRequest(
            "ethereum signature must be 65 bytes".into(),
        ));
    }
    let mut rs = [0u8; 64];
    rs.copy_from_slice(&sig_bytes[..64]);
    let v = sig_bytes[64];
    let recid = match v {
        0 | 27 => 0u8,
        1 | 28 => 1u8,
        other if other >= 35 => ((other - 35) % 2) as u8,
        _ => {
            return Err(AppError::BadRequest(format!(
                "unsupported signature v={v}"
            )))
        }
    };
    let hash = personal_sign_hash(message);
    let k256_sig = K256Signature::from_bytes((&rs).into())
        .map_err(|e| AppError::BadRequest(format!("invalid signature: {e}")))?;
    let recovery_id = RecoveryId::try_from(recid)
        .map_err(|e| AppError::BadRequest(format!("invalid recovery id: {e}")))?;
    let verifying_key = VerifyingKey::recover_from_prehash(&hash, &k256_sig, recovery_id)
        .map_err(|e| AppError::BadRequest(format!("signature recovery failed: {e}")))?;
    let uncompressed = verifying_key.to_encoded_point(false);
    let bytes = uncompressed.as_bytes();
    // 0x04 || x || y
    if bytes.len() != 65 {
        return Err(AppError::Internal("unexpected pubkey length".into()));
    }
    let mut hasher = Keccak256::new();
    hasher.update(&bytes[1..]);
    let digest = hasher.finalize();
    let mut addr = [0u8; 20];
    addr.copy_from_slice(&digest[12..]);
    Ok(Address::new(addr))
}

pub fn decode_hex_signature(raw: &str) -> AppResult<Vec<u8>> {
    let trimmed = raw.trim();
    let body = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
        .unwrap_or(trimmed);
    hex::decode(body).map_err(|e| AppError::BadRequest(format!("invalid hex signature: {e}")))
}

pub fn signature_from_rs_hex(raw: &str) -> AppResult<Signature> {
    let bytes = decode_hex_signature(raw)?;
    let rs = if bytes.len() == 65 {
        bytes[..64].to_vec()
    } else if bytes.len() == 64 {
        bytes
    } else {
        return Err(AppError::BadRequest(
            "LightPool signature must be 64 bytes (r||s) or 65 with v".into(),
        ));
    };
    bincode::deserialize(&rs)
        .map_err(|e| AppError::BadRequest(format!("invalid LightPool signature: {e}")))
}

pub fn encrypt_agent_secret(secret_b64: &str, key: &str, lp_address: &str) -> String {
    let mask = keystream(key, lp_address, secret_b64.len());
    let plain = secret_b64.as_bytes();
    let mixed: Vec<u8> = plain.iter().zip(mask.iter()).map(|(a, b)| a ^ b).collect();
    format!("v1:{}", hex::encode(mixed))
}

pub fn decrypt_agent_secret(encrypted: &str, key: &str, lp_address: &str) -> AppResult<String> {
    let body = encrypted
        .strip_prefix("v1:")
        .ok_or_else(|| AppError::Internal("unsupported agent secret encoding".into()))?;
    let mixed =
        hex::decode(body).map_err(|e| AppError::Internal(format!("corrupt agent secret: {e}")))?;
    let mask = keystream(key, lp_address, mixed.len());
    let plain: Vec<u8> = mixed.iter().zip(mask.iter()).map(|(a, b)| a ^ b).collect();
    String::from_utf8(plain).map_err(|e| AppError::Internal(format!("agent secret utf8: {e}")))
}

fn keystream(key: &str, lp_address: &str, len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(len);
    let mut counter: u64 = 0;
    while out.len() < len {
        let mut hasher = Keccak256::new();
        hasher.update(key.as_bytes());
        hasher.update(lp_address.as_bytes());
        hasher.update(counter.to_le_bytes());
        out.extend_from_slice(&hasher.finalize());
        counter += 1;
    }
    out.truncate(len);
    out
}

pub fn signer_from_encrypted(
    encrypted: &str,
    key: &str,
    lp_address: &str,
) -> AppResult<Signer> {
    let secret = decrypt_agent_secret(encrypted, key, lp_address)?;
    Signer::from_secret_key_base64(&secret)
        .map_err(|e| AppError::Internal(format!("load agent signer: {e}")))
}

pub fn parse_evm_address20(raw: &str) -> AppResult<[u8; 20]> {
    let trimmed = raw.trim();
    let body = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
        .unwrap_or(trimmed);
    if body.len() != 40 {
        return Err(AppError::BadRequest(
            "evm address must be 20 bytes hex".into(),
        ));
    }
    let bytes =
        hex::decode(body).map_err(|e| AppError::BadRequest(format!("invalid evm address: {e}")))?;
    let mut out = [0u8; 20];
    out.copy_from_slice(&bytes);
    Ok(out)
}
