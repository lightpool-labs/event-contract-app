// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub clob_index_url: String,
    pub database_url: String,
    pub dev_secret_key: Option<String>,
    pub cash_token_address: Option<String>,
    pub cash_token_symbol: String,
    pub jwt_secret: String,
    pub agent_encryption_key: String,
    pub eth_usdt: Option<String>,
    pub bridge: Option<String>,
    pub evm_rpc_url: String,
    pub evm_chain_id: u64,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3001),
            clob_index_url: env::var("CLOB_INDEX_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3002".into()),
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://event_app:event_app@127.0.0.1:5432/event_contract_app".into()
            }),
            dev_secret_key: env::var("DEV_SECRET_KEY").ok().filter(|v| !v.trim().is_empty()),
            cash_token_address: env::var("CASH_TOKEN_ADDRESS")
                .ok()
                .filter(|v| !v.trim().is_empty()),
            cash_token_symbol: env::var("CASH_TOKEN_SYMBOL")
                .ok()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| "USDT".into()),
            jwt_secret: env::var("JWT_SECRET")
                .ok()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| "dev-jwt-secret-change-me".into()),
            agent_encryption_key: env::var("AGENT_ENCRYPTION_KEY")
                .ok()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| "dev-agent-encryption-key".into()),
            eth_usdt: env::var("ETH_USDT").ok().filter(|v| !v.trim().is_empty()),
            bridge: env::var("BRIDGE").ok().filter(|v| !v.trim().is_empty()),
            evm_rpc_url: env::var("EVM_RPC_URL")
                .ok()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| "http://127.0.0.1:8545".into()),
            evm_chain_id: env::var("EVM_CHAIN_ID")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1337),
        }
    }
}
