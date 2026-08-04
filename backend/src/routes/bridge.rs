// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use axum::{extract::State, routing::{get, post}, Json, Router};
use lightpool_sdk::parse_token_contract;
use serde::{Deserialize, Serialize};

use crate::auth::AuthUser;
use crate::chain::{decode_unsigned_tx, parse_order_size, Eip712TypedDataJson};
use crate::crypto_util::{parse_address, parse_evm_address20, signature_from_rs_hex};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/config", get(bridge_config))
        .route("/withdraw/prepare", post(prepare_withdraw))
        .route("/withdraw/submit", post(submit_withdraw))
}

#[derive(Serialize)]
pub struct BridgeConfigResponse {
    pub eth_usdt: Option<String>,
    pub bridge: Option<String>,
    pub rpc: String,
    pub lp_token: Option<String>,
    pub chain_id: u64,
    pub cash_token_symbol: String,
}

async fn bridge_config(State(state): State<AppState>) -> Json<BridgeConfigResponse> {
    Json(BridgeConfigResponse {
        eth_usdt: state.config.eth_usdt.clone(),
        bridge: state.config.bridge.clone(),
        rpc: state.config.evm_rpc_url.clone(),
        lp_token: state.config.cash_token_address.clone(),
        chain_id: state.config.evm_chain_id,
        cash_token_symbol: state.config.cash_token_symbol.clone(),
    })
}

#[derive(Deserialize)]
pub struct PrepareWithdrawRequest {
    pub amount: String,
    pub evm_recipient: String,
}

#[derive(Serialize)]
pub struct PreparedTxResponse {
    pub digest_hex: String,
    pub unsigned_tx_hex: String,
    pub eip712: Eip712TypedDataJson,
}

async fn prepare_withdraw(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<PrepareWithdrawRequest>,
) -> AppResult<Json<PreparedTxResponse>> {
    let lp_token = state
        .config
        .cash_token_address
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("CASH_TOKEN_ADDRESS not configured".into()))?;
    let token = parse_token_contract(lp_token)
        .map_err(|e| AppError::BadRequest(format!("invalid LP token: {e}")))?;
    let amount = parse_order_size(&body.amount)?;
    if amount == 0 {
        return Err(AppError::BadRequest("amount must be > 0".into()));
    }
    let evm_recipient = parse_evm_address20(&body.evm_recipient)?;
    let sender = parse_address(&user.lp_address)?;
    let prepared = state
        .chain
        .prepare_bridge_withdraw(sender, token, amount, evm_recipient)?;
    Ok(Json(PreparedTxResponse {
        digest_hex: prepared.digest_hex,
        unsigned_tx_hex: prepared.unsigned_tx_hex,
        eip712: prepared.eip712,
    }))
}

#[derive(Deserialize)]
pub struct SubmitSignedTxRequest {
    pub signature: String,
    pub unsigned_tx_hex: String,
}

#[derive(Serialize)]
pub struct SubmitTxResponse {
    pub digest: String,
    pub status: String,
}

async fn submit_withdraw(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<SubmitSignedTxRequest>,
) -> AppResult<Json<SubmitTxResponse>> {
    let tx = decode_unsigned_tx(&body.unsigned_tx_hex)?;
    let sender = parse_address(&user.lp_address)?;
    if tx.sender() != sender {
        return Err(AppError::BadRequest(
            "transaction sender does not match session".into(),
        ));
    }
    let signature = signature_from_rs_hex(&body.signature)?;
    let response = state.chain.submit_user_signed(tx, signature).await?;
    Ok(Json(SubmitTxResponse {
        digest: response.digest,
        status: "submitted".into(),
    }))
}
