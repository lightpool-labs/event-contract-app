// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use std::collections::HashSet;

use axum::{extract::State, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};

use crate::auth::AuthUser;
use crate::chain::decode_unsigned_tx;
use crate::clob::BalanceTokenSpec;
use crate::crypto_util::{parse_address, signature_from_rs_hex};
use crate::error::{AppError, AppResult};
use crate::models::BalanceEntry;
use crate::state::AppState;

#[derive(Serialize)]
pub struct PreparedTxResponse {
    pub digest_hex: String,
    pub unsigned_tx_hex: String,
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

#[derive(Serialize)]
pub struct AccountResponse {
    pub address: String,
}

#[derive(Serialize)]
pub struct AgentStatusResponse {
    pub agent_address: String,
    pub authorized: bool,
    pub lp_address: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_account))
        .route("/balances", get(get_balances))
        .route("/agent", get(get_agent))
        .route("/agent/prepare-set-agent", post(prepare_set_agent))
        .route("/agent/submit", post(submit_set_agent))
}

async fn get_account(
    State(state): State<AppState>,
    user: OptionAuth,
) -> Json<AccountResponse> {
    let address = if let Some(user) = user.0 {
        user.lp_address
    } else {
        state.signer.user_address().await.to_string()
    };
    Json(AccountResponse { address })
}

async fn get_balances(
    State(state): State<AppState>,
    user: OptionAuth,
) -> AppResult<Json<Vec<BalanceEntry>>> {
    let account = if let Some(user) = user.0 {
        user.lp_address
    } else {
        state.signer.user_address().await.to_string()
    };

    let mut tokens: Vec<BalanceTokenSpec> = Vec::new();
    let mut seen_addresses = HashSet::new();

    let mut push_token = |symbol: &str, address: &str| {
        let key = address.trim().to_ascii_lowercase();
        if key.is_empty() || !seen_addresses.insert(key) {
            return;
        }
        tokens.push(BalanceTokenSpec {
            symbol: symbol.to_string(),
            address: address.trim().to_string(),
        });
    };

    if let Some(cash) = state.cash_token.get().await {
        push_token(&cash.symbol, &cash.address);
    }

    let position_specs = state.clob.position_token_specs().await?;
    tokens.extend(position_specs);

    let entries = state.clob.get_balances(&account, &tokens).await?;
    Ok(Json(entries))
}

async fn get_agent(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<AgentStatusResponse>> {
    let record = state.users.get_or_create(&user.lp_address).await?;
    Ok(Json(AgentStatusResponse {
        agent_address: record.agent_address,
        authorized: record.agent_authorized,
        lp_address: record.lp_address,
    }))
}

async fn prepare_set_agent(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<PreparedTxResponse>> {
    let record = state.users.get_or_create(&user.lp_address).await?;
    let sender = parse_address(&record.lp_address)?;
    let agent = parse_address(&record.agent_address)?;
    let prepared = state.chain.prepare_set_agent(sender, agent)?;
    Ok(Json(PreparedTxResponse {
        digest_hex: prepared.digest_hex,
        unsigned_tx_hex: prepared.unsigned_tx_hex,
    }))
}

async fn submit_set_agent(
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
    state.users.mark_agent_authorized(&user.lp_address).await?;
    Ok(Json(SubmitTxResponse {
        digest: response.digest,
        status: "submitted".into(),
    }))
}

/// Optional bearer auth for endpoints that still support the legacy dev signer.
struct OptionAuth(Option<AuthUser>);

#[axum::async_trait]
impl axum::extract::FromRequestParts<AppState> for OptionAuth {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok());
        let Some(header) = header else {
            return Ok(OptionAuth(None));
        };
        let Some(token) = header
            .strip_prefix("Bearer ")
            .or_else(|| header.strip_prefix("bearer "))
        else {
            return Ok(OptionAuth(None));
        };
        match state.auth.decode_jwt(token) {
            Ok(claims) => Ok(OptionAuth(Some(AuthUser {
                lp_address: crate::crypto_util::normalize_address(&claims.sub)?,
            }))),
            Err(_) => Ok(OptionAuth(None)),
        }
    }
}
